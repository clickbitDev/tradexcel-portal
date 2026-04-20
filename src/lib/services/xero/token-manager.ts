import { readEnvValue } from '@/lib/public-env';
import { getSingletonPortalOrgId } from '@/lib/portal-org';
import { createAdminServerClient } from '@/lib/supabase/server';
import type { XeroConnectionRecord } from '@/types/database';

type AdminSupabaseClient = ReturnType<typeof createAdminServerClient>;

const REFRESH_BUFFER_MS = 5 * 60 * 1000;
const XERO_CLIENT_ID = readEnvValue('XERO_CLIENT_ID') || readEnvValue('NEXT_PUBLIC_XERO_CLIENT_ID') || '';
const XERO_CLIENT_SECRET = readEnvValue('XERO_CLIENT_SECRET') || '';
const XERO_TOKEN_ENDPOINT = 'https://identity.xero.com/connect/token';

const refreshPromises = new Map<string, Promise<XeroConnectionRecord>>();

function assertXeroCredentialsConfigured() {
    if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) {
        throw new Error('Xero OAuth client credentials are not configured.');
    }
}

async function fetchConnectionForOrg(
    orgId: string,
    supabase: AdminSupabaseClient
): Promise<XeroConnectionRecord | null> {
    const { data, error } = await supabase
        .from('xero_connections')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle<XeroConnectionRecord>();

    if (error || !data) {
        return null;
    }

    return data;
}

export async function upsertXeroConnectionForOrg(input: {
    orgId?: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    tenantId: string;
    tenantName?: string | null;
    tokenType?: string;
    salesAccountCode?: string;
    purchasesAccountCode?: string;
    salesTaxType?: string;
    purchasesTaxType?: string;
    paymentAccountCode?: string;
    lastRefreshedAt?: string | null;
    lastSyncAt?: string | null;
    lastError?: string | null;
    lastErrorAt?: string | null;
    errorCount?: number;
    supabase?: AdminSupabaseClient;
}): Promise<XeroConnectionRecord> {
    const supabase = input.supabase || createAdminServerClient();
    const orgId = input.orgId || await getSingletonPortalOrgId(supabase);

    const { data, error } = await supabase
        .from('xero_connections')
        .upsert({
            org_id: orgId,
            access_token: input.accessToken,
            refresh_token: input.refreshToken,
            expires_at: input.expiresAt,
            tenant_id: input.tenantId,
            tenant_name: input.tenantName || null,
            token_type: input.tokenType || 'Bearer',
            sales_account_code: input.salesAccountCode || '200',
            purchases_account_code: input.purchasesAccountCode || '300',
            sales_tax_type: input.salesTaxType || 'OUTPUT',
            purchases_tax_type: input.purchasesTaxType || 'INPUT',
            payment_account_code: input.paymentAccountCode || '090',
            last_refreshed_at: input.lastRefreshedAt || null,
            last_sync_at: input.lastSyncAt || null,
            last_error: input.lastError || null,
            last_error_at: input.lastErrorAt || null,
            error_count: input.errorCount || 0,
        }, {
            onConflict: 'org_id',
        })
        .select('*')
        .single<XeroConnectionRecord>();

    if (error || !data) {
        throw new Error(error?.message || 'Unable to persist the Xero connection.');
    }

    return data;
}

export async function getXeroConnectionForOrg(
    orgId: string,
    supabase: AdminSupabaseClient = createAdminServerClient()
): Promise<XeroConnectionRecord | null> {
    return fetchConnectionForOrg(orgId, supabase);
}

export async function getSingletonPortalXeroConnection(
    supabase: AdminSupabaseClient = createAdminServerClient()
): Promise<XeroConnectionRecord | null> {
    const orgId = await getSingletonPortalOrgId(supabase);
    return fetchConnectionForOrg(orgId, supabase);
}

export async function refreshXeroConnection(
    connection: XeroConnectionRecord,
    supabase: AdminSupabaseClient = createAdminServerClient()
): Promise<XeroConnectionRecord> {
    assertXeroCredentialsConfigured();

    const inflight = refreshPromises.get(connection.org_id);
    if (inflight) {
        return inflight;
    }

    const refreshPromise = (async () => {
        const response = await fetch(XERO_TOKEN_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64'),
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: connection.refresh_token,
            }).toString(),
        });

        if (!response.ok) {
            const details = await response.text();
            const message = `Failed to refresh Xero token (${response.status})`;

            await supabase
                .from('xero_connections')
                .update({
                    last_error: `${message}: ${details}`,
                    last_error_at: new Date().toISOString(),
                    error_count: connection.error_count + 1,
                })
                .eq('id', connection.id);

            throw new Error(message);
        }

        const tokenSet = await response.json() as {
            access_token?: string;
            refresh_token?: string;
            expires_in?: number;
            token_type?: string;
        };

        if (!tokenSet.access_token || !tokenSet.refresh_token) {
            throw new Error('Xero token refresh did not return usable credentials.');
        }

        const expiresAt = new Date(Date.now() + ((tokenSet.expires_in || 1800) * 1000)).toISOString();

        return upsertXeroConnectionForOrg({
            orgId: connection.org_id,
            accessToken: tokenSet.access_token,
            refreshToken: tokenSet.refresh_token,
            expiresAt,
            tenantId: connection.tenant_id,
            tenantName: connection.tenant_name,
            tokenType: tokenSet.token_type || connection.token_type,
            salesAccountCode: connection.sales_account_code,
            purchasesAccountCode: connection.purchases_account_code,
            salesTaxType: connection.sales_tax_type,
            purchasesTaxType: connection.purchases_tax_type,
            paymentAccountCode: connection.payment_account_code,
            lastRefreshedAt: new Date().toISOString(),
            lastSyncAt: connection.last_sync_at,
            errorCount: 0,
            lastError: null,
            lastErrorAt: null,
            supabase,
        });
    })();

    refreshPromises.set(connection.org_id, refreshPromise);

    try {
        return await refreshPromise;
    } finally {
        refreshPromises.delete(connection.org_id);
    }
}

export async function getValidXeroConnection(input?: {
    orgId?: string;
    forceRefresh?: boolean;
    supabase?: AdminSupabaseClient;
}): Promise<XeroConnectionRecord> {
    const supabase = input?.supabase || createAdminServerClient();
    const orgId = input?.orgId || await getSingletonPortalOrgId(supabase);
    const connection = await fetchConnectionForOrg(orgId, supabase);

    if (!connection) {
        throw new Error('No active Xero connection configured for this portal.');
    }

    const expiresAt = new Date(connection.expires_at).getTime();
    const shouldRefresh = input?.forceRefresh || Number.isNaN(expiresAt) || expiresAt - Date.now() <= REFRESH_BUFFER_MS;

    if (!shouldRefresh) {
        return connection;
    }

    return refreshXeroConnection(connection, supabase);
}

export async function disconnectXeroConnectionForOrg(input?: {
    orgId?: string;
    supabase?: AdminSupabaseClient;
}): Promise<void> {
    const supabase = input?.supabase || createAdminServerClient();
    const orgId = input?.orgId || await getSingletonPortalOrgId(supabase);

    await supabase
        .from('xero_connections')
        .delete()
        .eq('org_id', orgId);
}

export async function getSingletonPortalXeroConnectionStatus(
    supabase: AdminSupabaseClient = createAdminServerClient()
): Promise<{
    connected: boolean;
    tenantName: string | null;
    tenantId: string | null;
    connectedAt: string | null;
    lastRefreshedAt: string | null;
    tokenExpiresAt: string | null;
    lastSyncAt: string | null;
    error: string | null;
}> {
    const connection = await getSingletonPortalXeroConnection(supabase);

    if (!connection) {
        return {
            connected: false,
            tenantName: null,
            tenantId: null,
            connectedAt: null,
            lastRefreshedAt: null,
            tokenExpiresAt: null,
            lastSyncAt: null,
            error: null,
        };
    }

    return {
        connected: true,
        tenantName: connection.tenant_name,
        tenantId: connection.tenant_id,
        connectedAt: connection.created_at,
        lastRefreshedAt: connection.last_refreshed_at,
        tokenExpiresAt: connection.expires_at,
        lastSyncAt: connection.last_sync_at,
        error: connection.last_error,
    };
}

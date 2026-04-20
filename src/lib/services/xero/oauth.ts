import { readEnvValue } from '@/lib/public-env';
import { createAdminServerClient } from '@/lib/supabase/server';
import { getPublicOrigin } from '@/lib/url/public-origin';
import { getSingletonPortalOrgId } from '@/lib/portal-org';
import { upsertXeroConnectionForOrg } from '@/lib/services/xero/token-manager';

const XERO_CLIENT_ID = readEnvValue('XERO_CLIENT_ID') || readEnvValue('NEXT_PUBLIC_XERO_CLIENT_ID') || '';
const XERO_CLIENT_SECRET = readEnvValue('XERO_CLIENT_SECRET') || '';
const DEFAULT_REDIRECT_PATH = '/auth/xero/callback';

export const XERO_SCOPES = [
    'accounting.invoices',
    'accounting.invoices.read',
    'accounting.payments',
    'accounting.contacts',
    'accounting.contacts.read',
    'accounting.reports.profitandloss.read',
    'accounting.reports.balancesheet.read',
    'offline_access',
] as const;

function getConfiguredRedirectUri(request?: Request): string {
    const explicit = readEnvValue('XERO_REDIRECT_URI');
    if (explicit) {
        return explicit;
    }

    if (request) {
        return `${getPublicOrigin(request)}${DEFAULT_REDIRECT_PATH}`;
    }

    const siteUrl = readEnvValue('NEXT_PUBLIC_SITE_URL');
    if (siteUrl) {
        return new URL(DEFAULT_REDIRECT_PATH, siteUrl).toString();
    }

    return `http://localhost:3000${DEFAULT_REDIRECT_PATH}`;
}

function assertXeroOAuthConfigured() {
    if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) {
        throw new Error('Xero OAuth client credentials are not configured.');
    }
}

export function getXeroAuthorizationUrl(state: string, request?: Request): string {
    assertXeroOAuthConfigured();

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: XERO_CLIENT_ID,
        redirect_uri: getConfiguredRedirectUri(request),
        scope: XERO_SCOPES.join(' '),
        state,
    });

    return `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
}

export async function exchangeXeroAuthorizationCode(input: {
    code: string;
    request?: Request;
}): Promise<{ success: boolean; error?: string; tenantId?: string; tenantName?: string }> {
    assertXeroOAuthConfigured();

    try {
        const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64'),
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: input.code,
                redirect_uri: getConfiguredRedirectUri(input.request),
            }).toString(),
        });

        if (!tokenResponse.ok) {
            const details = await tokenResponse.text();
            return { success: false, error: `Token exchange failed: ${details}` };
        }

        const tokenSet = await tokenResponse.json() as {
            access_token?: string;
            refresh_token?: string;
            expires_in?: number;
            token_type?: string;
        };

        if (!tokenSet.access_token || !tokenSet.refresh_token) {
            return { success: false, error: 'Failed to obtain Xero access and refresh tokens.' };
        }

        const tenantsResponse = await fetch('https://api.xero.com/connections', {
            headers: {
                'Authorization': `Bearer ${tokenSet.access_token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!tenantsResponse.ok) {
            const details = await tenantsResponse.text();
            return { success: false, error: `Failed to load Xero connections: ${details}` };
        }

        const tenants = await tenantsResponse.json() as Array<{
            tenantId: string;
            tenantName?: string | null;
        }>;

        const tenant = tenants[0];
        if (!tenant?.tenantId) {
            return { success: false, error: 'No Xero tenant was returned for this account.' };
        }

        const adminSupabase = createAdminServerClient();
        const orgId = await getSingletonPortalOrgId(adminSupabase);
        const expiresAt = new Date(Date.now() + ((tokenSet.expires_in || 1800) * 1000)).toISOString();

        await upsertXeroConnectionForOrg({
            orgId,
            accessToken: tokenSet.access_token,
            refreshToken: tokenSet.refresh_token,
            expiresAt,
            tenantId: tenant.tenantId,
            tenantName: tenant.tenantName || null,
            tokenType: tokenSet.token_type || 'Bearer',
            errorCount: 0,
            lastError: null,
            lastErrorAt: null,
            supabase: adminSupabase,
        });

        return {
            success: true,
            tenantId: tenant.tenantId,
            tenantName: tenant.tenantName || undefined,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Xero token exchange failed',
        };
    }
}

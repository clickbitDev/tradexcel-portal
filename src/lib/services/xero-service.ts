/**
 * Xero Integration Service
 * Handles OAuth token management, API calls, and entity sync
 */

import { XeroClient } from 'xero-node';
import { createAdminServerClient } from '@/lib/supabase/server';

// ============================================
// Types
// ============================================

export interface XeroConnection {
    id: string;
    access_token: string;
    refresh_token: string;
    token_expires_at: string;
    token_type: string;
    tenant_id: string;
    tenant_name: string | null;
    tenant_type: string | null;
    scopes: string[] | null;
    connected_at: string;
    connected_by: string | null;
    is_active: boolean;
    last_refreshed_at: string | null;
    last_sync_at: string | null;
    last_error: string | null;
    last_error_at: string | null;
    error_count: number;
}

export interface XeroConnectionStatus {
    connected: boolean;
    tenantName: string | null;
    tenantId: string | null;
    connectedAt: string | null;
    lastRefreshedAt: string | null;
    tokenExpiresAt: string | null;
    lastSyncAt: string | null;
    error: string | null;
}

type ApplicationPaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded' | 'waived';

export interface XeroEntityMap {
    id: string;
    entity_type: string;
    lumiere_id: string;
    xero_id: string;
    xero_number: string | null;
    xero_url: string | null;
    sync_status: 'synced' | 'pending' | 'error' | 'deleted';
    sync_direction: 'push' | 'pull';
    last_synced_at: string;
    sync_error: string | null;
}

// ============================================
// Configuration
// ============================================

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID || process.env.NEXT_PUBLIC_XERO_CLIENT_ID || '';
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET || '';
const XERO_REDIRECT_URI = process.env.XERO_REDIRECT_URI || 'http://localhost:3000/auth/xero/callback';

function envOrDefault(value: string | undefined, fallback: string): string {
    const normalized = (value || '').trim();
    return normalized.length > 0 ? normalized : fallback;
}

const XERO_SALES_ACCOUNT_CODE = envOrDefault(process.env.XERO_SALES_ACCOUNT_CODE, '200');
const XERO_PURCHASES_ACCOUNT_CODE = envOrDefault(process.env.XERO_PURCHASES_ACCOUNT_CODE, '300');
const XERO_SALES_TAX_TYPE = envOrDefault(process.env.XERO_SALES_TAX_TYPE, 'OUTPUT');
const XERO_PURCHASES_TAX_TYPE = envOrDefault(process.env.XERO_PURCHASES_TAX_TYPE, 'INPUT');

// Granular scopes required by the Lumiere OAuth web app.
// Confirmed against the current Xero app by testing the authorize endpoint.
export const XERO_SCOPES = [
    'accounting.invoices',
    'accounting.invoices.read',
    'accounting.payments',
    'accounting.contacts',
    'accounting.contacts.read',
    'accounting.reports.profitandloss.read',
    'accounting.reports.balancesheet.read',
    'offline_access',
];

// ============================================
// Xero Client Factory
// ============================================

let xeroClientInstance: XeroClient | null = null;
let xeroClientInitPromise: Promise<XeroClient> | null = null;

/**
 * Get or create Xero client instance
 */
export function getXeroClient(): XeroClient {
    if (!xeroClientInstance) {
        xeroClientInstance = new XeroClient({
            clientId: XERO_CLIENT_ID,
            clientSecret: XERO_CLIENT_SECRET,
            redirectUris: [XERO_REDIRECT_URI],
            scopes: XERO_SCOPES,
        });
    }
    return xeroClientInstance;
}

/**
 * Ensure xero-node internal OpenID client is initialized before token refresh calls.
 */
async function getInitializedXeroClient(): Promise<XeroClient> {
    const xero = getXeroClient();

    if (!xeroClientInitPromise) {
        xeroClientInitPromise = xero.initialize().catch((error) => {
            xeroClientInitPromise = null;
            throw error;
        });
    }

    await xeroClientInitPromise;
    return xero;
}

/**
 * Build the authorization URL for OAuth flow
 */
export function getAuthorizationUrl(state: string): string {
    // Build the authorization URL manually to avoid async issues
    const baseUrl = 'https://login.xero.com/identity/connect/authorize';
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: XERO_CLIENT_ID,
        redirect_uri: XERO_REDIRECT_URI,
        scope: XERO_SCOPES.join(' '),
        state: state,
    });

    return `${baseUrl}?${params.toString()}`;
}

// ============================================
// Token Management
// ============================================

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
    success: boolean;
    error?: string;
    tenantId?: string;
    tenantName?: string;
}> {
    try {
        // Exchange code for tokens using direct HTTP call
        const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64'),
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: XERO_REDIRECT_URI,
            }).toString(),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error('Token exchange failed:', errorData);
            return { success: false, error: 'Token exchange failed: ' + errorData };
        }

        const tokenSet = await tokenResponse.json();

        if (!tokenSet.access_token || !tokenSet.refresh_token) {
            return { success: false, error: 'Failed to obtain tokens' };
        }

        // Get connected tenants
        const tenantsResponse = await fetch('https://api.xero.com/connections', {
            headers: {
                'Authorization': `Bearer ${tokenSet.access_token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!tenantsResponse.ok) {
            const errorData = await tenantsResponse.text();
            console.error('Failed to get tenants:', errorData);
            return { success: false, error: 'Failed to get Xero organizations' };
        }

        const tenants = await tenantsResponse.json();

        if (!tenants || tenants.length === 0) {
            return { success: false, error: 'No Xero organizations found' };
        }

        // Use the first tenant (most common case)
        const tenant = tenants[0];

        // Calculate token expiry
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + (tokenSet.expires_in || 1800));

        // Store in database
        const supabase = createAdminServerClient();

        // Deactivate any existing connections
        await supabase
            .from('xero_connection')
            .update({ is_active: false })
            .eq('is_active', true);

        // Insert new connection
        const { error: insertError } = await supabase
            .from('xero_connection')
            .insert({
                access_token: tokenSet.access_token,
                refresh_token: tokenSet.refresh_token,
                token_expires_at: expiresAt.toISOString(),
                token_type: tokenSet.token_type || 'Bearer',
                tenant_id: tenant.tenantId,
                tenant_name: tenant.tenantName,
                tenant_type: tenant.tenantType,
                scopes: tokenSet.scope?.split(' ') || XERO_SCOPES,
                is_active: true,
            });

        if (insertError) {
            console.error('Failed to store Xero connection:', insertError);
            return { success: false, error: 'Failed to store connection' };
        }

        return {
            success: true,
            tenantId: tenant.tenantId,
            tenantName: tenant.tenantName,
        };
    } catch (error) {
        console.error('Xero token exchange error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Token exchange failed',
        };
    }
}

/**
 * Get the current active Xero connection
 */
export async function getActiveConnection(): Promise<XeroConnection | null> {
    const supabase = createAdminServerClient();

    const { data, error } = await supabase
        .from('xero_connection')
        .select('*')
        .eq('is_active', true)
        .single();

    if (error || !data) {
        return null;
    }

    return data as XeroConnection;
}

/**
 * Get connection status for the UI
 */
export async function getConnectionStatus(): Promise<XeroConnectionStatus> {
    const connection = await getActiveConnection();

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
        connectedAt: connection.connected_at,
        lastRefreshedAt: connection.last_refreshed_at,
        tokenExpiresAt: connection.token_expires_at,
        lastSyncAt: connection.last_sync_at,
        error: connection.last_error,
    };
}

/**
 * Refresh tokens if needed (called before API requests)
 */
export async function ensureValidToken(): Promise<{
    success: boolean;
    accessToken?: string;
    tenantId?: string;
    error?: string;
}> {
    const connection = await getActiveConnection();

    if (!connection) {
        return { success: false, error: 'No active Xero connection' };
    }

    const expiresAt = new Date(connection.token_expires_at);
    const now = new Date();

    // Refresh if token expires in less than 5 minutes
    const fiveMinutes = 5 * 60 * 1000;
    if (expiresAt.getTime() - now.getTime() > fiveMinutes) {
        // Token is still valid
        return {
            success: true,
            accessToken: connection.access_token,
            tenantId: connection.tenant_id,
        };
    }

    // Need to refresh
    try {
        const xero = await getInitializedXeroClient();

        // Set the current token set for refresh
        xero.setTokenSet({
            access_token: connection.access_token,
            refresh_token: connection.refresh_token,
            expires_at: expiresAt.getTime() / 1000,
            token_type: connection.token_type,
        });

        const newTokenSet = await xero.refreshToken();

        if (!newTokenSet.access_token || !newTokenSet.refresh_token) {
            throw new Error('Failed to refresh tokens');
        }

        // Calculate new expiry
        const newExpiresAt = new Date();
        newExpiresAt.setSeconds(newExpiresAt.getSeconds() + (newTokenSet.expires_in || 1800));

        // Update in database
        const supabase = createAdminServerClient();

        const { error: updateError } = await supabase
            .from('xero_connection')
            .update({
                access_token: newTokenSet.access_token,
                refresh_token: newTokenSet.refresh_token,
                token_expires_at: newExpiresAt.toISOString(),
                last_refreshed_at: new Date().toISOString(),
                last_error: null,
                error_count: 0,
            })
            .eq('id', connection.id);

        if (updateError) {
            console.error('Failed to update refreshed tokens:', updateError);
        }

        return {
            success: true,
            accessToken: newTokenSet.access_token,
            tenantId: connection.tenant_id,
        };
    } catch (error) {
        console.error('Token refresh error:', error);

        // Record the error
        const supabase = createAdminServerClient();
        await supabase
            .from('xero_connection')
            .update({
                last_error: error instanceof Error ? error.message : 'Token refresh failed',
                last_error_at: new Date().toISOString(),
                error_count: connection.error_count + 1,
            })
            .eq('id', connection.id);

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Token refresh failed',
        };
    }
}

/**
 * Disconnect from Xero
 */
export async function disconnectXero(): Promise<{ success: boolean; error?: string }> {
    try {
        const connection = await getActiveConnection();

        if (!connection) {
            return { success: true }; // Already disconnected
        }

        // Revoke the token with Xero (optional, but good practice)
        try {
            const xero = getXeroClient();
            xero.setTokenSet({
                access_token: connection.access_token,
                refresh_token: connection.refresh_token,
            });
            // Note: disconnect requires the tenant - we'll just let the token expire
            // Xero tokens expire automatically and can't be used after we delete the record
        } catch (revokeError) {
            // Continue even if revoke fails - we'll still remove locally
            console.warn('Failed to revoke Xero token:', revokeError);
        }

        // Deactivate the connection in database
        const supabase = createAdminServerClient();

        const { error } = await supabase
            .from('xero_connection')
            .update({ is_active: false })
            .eq('id', connection.id);

        if (error) {
            return { success: false, error: 'Failed to disconnect' };
        }

        return { success: true };
    } catch (error) {
        console.error('Disconnect error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Disconnect failed',
        };
    }
}

// ============================================
// Entity Mapping Helpers
// ============================================

/**
 * Get Xero entity ID for a Lumiere entity
 */
export async function getXeroEntityId(
    entityType: string,
    lumiereId: string
): Promise<string | null> {
    const supabase = createAdminServerClient();

    const { data } = await supabase
        .from('xero_entity_map')
        .select('xero_id')
        .eq('entity_type', entityType)
        .eq('lumiere_id', lumiereId)
        .eq('sync_status', 'synced')
        .single();

    return data?.xero_id || null;
}

/**
 * Store a Xero entity mapping
 */
export async function storeEntityMapping(
    entityType: string,
    lumiereId: string,
    xeroId: string,
    xeroNumber?: string,
    xeroUrl?: string
): Promise<boolean> {
    const supabase = createAdminServerClient();

    const { error } = await supabase
        .from('xero_entity_map')
        .upsert({
            entity_type: entityType,
            lumiere_id: lumiereId,
            xero_id: xeroId,
            xero_number: xeroNumber,
            xero_url: xeroUrl,
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
        }, {
            onConflict: 'entity_type,lumiere_id',
        });

    return !error;
}

/**
 * Mark entity as pending sync
 */
export async function markEntityPendingSync(
    entityType: string,
    lumiereId: string
): Promise<boolean> {
    const supabase = createAdminServerClient();

    const { error } = await supabase
        .from('xero_entity_map')
        .upsert({
            entity_type: entityType,
            lumiere_id: lumiereId,
            xero_id: '',
            sync_status: 'pending',
        }, {
            onConflict: 'entity_type,lumiere_id',
        });

    return !error;
}

// ============================================
// API Client for Making Xero API Calls
// ============================================

/**
 * Get valid access token and tenant ID
 */
async function getAuthContext(): Promise<{
    success: boolean;
    accessToken?: string;
    tenantId?: string;
    error?: string;
}> {
    return ensureValidToken();
}

/**
 * Make authenticated Xero API request
 */
type XeroRequestResult =
    | { success: true; data: unknown }
    | { success: false; error: string; status?: number; details?: string; traceId?: string };

function getXeroError(result: XeroRequestResult, fallback: string): string {
    return 'error' in result ? (result.error || fallback) : fallback;
}

async function xeroRequest(
    endpoint: string,
    options: {
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
        body?: unknown;
    } = {}
): Promise<XeroRequestResult> {
    const auth = await getAuthContext();
    if (!auth.success || !auth.accessToken || !auth.tenantId) {
        return { success: false, error: auth.error || 'No connection' };
    }

    try {
        const response = await fetch(`https://api.xero.com/api.xro/2.0${endpoint}`, {
            method: options.method || 'GET',
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
                'xero-tenant-id': auth.tenantId,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: options.body ? JSON.stringify(options.body) : undefined,
        });

        if (!response.ok) {
            const errorText = await response.text();
            let parsedError: unknown = null;
            try {
                parsedError = JSON.parse(errorText);
            } catch {
                parsedError = null;
            }

            const traceId =
                response.headers.get('xero-correlation-id') ||
                response.headers.get('xero-trace-id') ||
                response.headers.get('xero-correlationid') ||
                undefined;

            const extractedMessage =
                (parsedError as { Message?: string; message?: string; ErrorNumber?: number } | null)?.Message ||
                (parsedError as { Message?: string; message?: string } | null)?.message ||
                errorText ||
                `API error: ${response.status}`;

            console.error('Xero API error:', {
                status: response.status,
                traceId,
                error: extractedMessage,
                raw: errorText,
            });

            return {
                success: false,
                error: extractedMessage,
                status: response.status,
                details: errorText,
                traceId,
            };
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error('Xero request error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Request failed',
            details: error instanceof Error ? error.stack : undefined,
        };
    }
}

function looksLikePdf(bytes: Uint8Array): boolean {
    return bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

/**
 * Download invoice PDF bytes from Xero.
 */
export async function downloadInvoicePdfFromXero(
    xeroInvoiceId: string
): Promise<{ success: boolean; pdfData?: Uint8Array; error?: string; status?: number; details?: string; traceId?: string }> {
    const auth = await getAuthContext();
    if (!auth.success || !auth.accessToken || !auth.tenantId) {
        return { success: false, error: auth.error || 'No active Xero connection' };
    }

    const encodedInvoiceId = encodeURIComponent(xeroInvoiceId);
    const endpoints = [
        `/Invoices/${encodedInvoiceId}`,
        `/Invoices/${encodedInvoiceId}?pdf=true`,
        `/Invoices/${encodedInvoiceId}?pdf`,
    ];

    let lastError: { error: string; status?: number; details?: string; traceId?: string } | null = null;

    for (const endpoint of endpoints) {
        try {
            const response = await fetch(`https://api.xero.com/api.xro/2.0${endpoint}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${auth.accessToken}`,
                    'xero-tenant-id': auth.tenantId,
                    'Accept': 'application/pdf',
                },
            });

            const traceId =
                response.headers.get('xero-correlation-id') ||
                response.headers.get('xero-trace-id') ||
                response.headers.get('xero-correlationid') ||
                undefined;

            if (!response.ok) {
                const errorText = await response.text();
                lastError = {
                    error: `Failed to fetch invoice PDF from Xero (${response.status})`,
                    status: response.status,
                    details: errorText,
                    traceId,
                };
                continue;
            }

            const bytes = new Uint8Array(await response.arrayBuffer());
            const contentType = response.headers.get('content-type') || '';

            if ((contentType.toLowerCase().includes('application/pdf') || looksLikePdf(bytes)) && bytes.length > 0) {
                return { success: true, pdfData: bytes };
            }

            lastError = {
                error: 'Xero returned a non-PDF response for invoice PDF download',
                details: `content-type=${contentType || 'unknown'}`,
                traceId,
            };
        } catch (error) {
            lastError = {
                error: error instanceof Error ? error.message : 'Failed to fetch invoice PDF from Xero',
            };
        }
    }

    return {
        success: false,
        error: lastError?.error || 'Unable to download invoice PDF from Xero',
        status: lastError?.status,
        details: lastError?.details,
        traceId: lastError?.traceId,
    };
}

// ============================================
// Phase 2: Invoice Sync
// ============================================

export interface XeroInvoiceData {
    contactId: string;
    invoiceNumber: string;
    reference?: string;
    dueDate: string;
    lineItems: Array<{
        description: string;
        quantity: number;
        unitAmount: number;
        accountCode?: string;
        taxType?: string;
    }>;
    status?: 'DRAFT' | 'SUBMITTED' | 'AUTHORISED';
}

/**
 * Push an invoice to Xero
 */
export async function pushInvoiceToXero(
    lumiereInvoiceId: string,
    data: XeroInvoiceData
): Promise<{ success: boolean; xeroInvoiceId?: string; invoiceNumber?: string; error?: string; details?: string; status?: number; traceId?: string }> {
    // Check if already synced
    const existingXeroId = await getXeroEntityId('invoice', lumiereInvoiceId);
    if (existingXeroId) {
        return { success: true, xeroInvoiceId: existingXeroId, invoiceNumber: data.invoiceNumber };
    }

    const xeroInvoice = {
        Type: 'ACCREC', // Accounts Receivable
        Contact: { ContactID: data.contactId },
        InvoiceNumber: data.invoiceNumber,
        Reference: data.reference,
        DueDate: data.dueDate,
        Status: data.status || 'DRAFT',
        LineAmountTypes: 'Exclusive',
        LineItems: data.lineItems.map(item => ({
            Description: item.description,
            Quantity: item.quantity,
            UnitAmount: item.unitAmount,
            AccountCode: item.accountCode || XERO_SALES_ACCOUNT_CODE,
            TaxType: item.taxType || XERO_SALES_TAX_TYPE,
        })),
    };

    const result = await xeroRequest('/Invoices', {
        method: 'POST',
        body: { Invoices: [xeroInvoice] },
    });

    if (!result.success || !result.data) {
        return {
            success: false,
            error: getXeroError(result, 'Failed to push invoice to Xero'),
            details: 'details' in result ? result.details : undefined,
            status: 'status' in result ? result.status : undefined,
            traceId: 'traceId' in result ? result.traceId : undefined,
        };
    }

    const invoices = (result.data as { Invoices?: Array<{ InvoiceID: string; InvoiceNumber: string; Status?: string }> }).Invoices;
    if (!invoices || invoices.length === 0) {
        return { success: false, error: 'No invoice returned' };
    }

    const xeroInvoiceId = invoices[0].InvoiceID;
    const xeroInvoiceNumber = invoices[0].InvoiceNumber;

    // Store mapping
    await storeEntityMapping('invoice', lumiereInvoiceId, xeroInvoiceId, xeroInvoiceNumber);

    // Update Lumiere invoice with Xero ID
    const supabase = createAdminServerClient();
    await supabase
        .from('invoices')
        .update({
            xero_invoice_id: xeroInvoiceId,
            xero_invoice_url: `https://go.xero.com/AccountsReceivable/View.aspx?invoiceID=${xeroInvoiceId}`,
            xero_status: invoices[0].Status || 'DRAFT',
        })
        .eq('id', lumiereInvoiceId);

    return { success: true, xeroInvoiceId, invoiceNumber: xeroInvoiceNumber };
}

// ============================================
// Phase 2: Bill Sync
// ============================================

export interface XeroBillData {
    contactId: string;
    invoiceNumber?: string;
    reference?: string;
    dueDate: string;
    lineItems: Array<{
        description: string;
        quantity: number;
        unitAmount: number;
        accountCode?: string;
        taxType?: string;
    }>;
    status?: 'DRAFT' | 'SUBMITTED' | 'AUTHORISED';
}

/**
 * Push a bill to Xero
 */
export async function pushBillToXero(
    lumiereBillId: string,
    data: XeroBillData
): Promise<{ success: boolean; xeroBillId?: string; billNumber?: string; error?: string; details?: string; status?: number; traceId?: string }> {
    // Check if already synced
    const existingXeroId = await getXeroEntityId('bill', lumiereBillId);
    if (existingXeroId) {
        return { success: true, xeroBillId: existingXeroId };
    }

    const xeroBill = {
        Type: 'ACCPAY', // Accounts Payable (Bill)
        Contact: { ContactID: data.contactId },
        InvoiceNumber: data.invoiceNumber,
        Reference: data.reference,
        DueDate: data.dueDate,
        Status: data.status || 'DRAFT',
        LineAmountTypes: 'Exclusive',
        LineItems: data.lineItems.map(item => ({
            Description: item.description,
            Quantity: item.quantity,
            UnitAmount: item.unitAmount,
            AccountCode: item.accountCode || XERO_PURCHASES_ACCOUNT_CODE,
            TaxType: item.taxType || XERO_PURCHASES_TAX_TYPE,
        })),
    };

    const result = await xeroRequest('/Invoices', {
        method: 'POST',
        body: { Invoices: [xeroBill] },
    });

    if (!result.success || !result.data) {
        return {
            success: false,
            error: getXeroError(result, 'Failed to push bill to Xero'),
            details: 'details' in result ? result.details : undefined,
            status: 'status' in result ? result.status : undefined,
            traceId: 'traceId' in result ? result.traceId : undefined,
        };
    }

    const invoices = (result.data as { Invoices?: Array<{ InvoiceID: string; InvoiceNumber: string; Status?: string }> }).Invoices;
    if (!invoices || invoices.length === 0) {
        return { success: false, error: 'No bill returned' };
    }

    const xeroBillId = invoices[0].InvoiceID;
    const xeroBillNumber = invoices[0].InvoiceNumber;

    // Store mapping
    await storeEntityMapping('bill', lumiereBillId, xeroBillId, xeroBillNumber);

    // Update Lumiere bill with Xero ID
    const supabase = createAdminServerClient();
    await supabase
        .from('bills')
        .update({
            xero_bill_id: xeroBillId,
            xero_bill_url: `https://go.xero.com/AccountsPayable/View.aspx?invoiceID=${xeroBillId}`,
            xero_status: invoices[0].Status || 'DRAFT',
        })
        .eq('id', lumiereBillId);

    return { success: true, xeroBillId, billNumber: xeroBillNumber };
}

// ============================================
// Phase 2: Contact Sync
// ============================================

export interface XeroContactData {
    name: string;
    firstName?: string;
    lastName?: string;
    emailAddress?: string;
    phone?: string;
    isSupplier?: boolean;
    isCustomer?: boolean;
}

/**
 * Sync or create a contact in Xero
 */
export async function syncContactToXero(
    entityType: 'partner' | 'rto',
    lumiereId: string,
    data: XeroContactData
): Promise<{ success: boolean; contactId?: string; error?: string }> {
    // Check if already synced
    const existingXeroId = await getXeroEntityId(entityType, lumiereId);
    if (existingXeroId) {
        return { success: true, contactId: existingXeroId };
    }

    const xeroContact = {
        Name: data.name,
        FirstName: data.firstName,
        LastName: data.lastName,
        EmailAddress: data.emailAddress,
        Phones: data.phone ? [{ PhoneType: 'DEFAULT', PhoneNumber: data.phone }] : [],
        IsSupplier: data.isSupplier || entityType === 'rto',
        IsCustomer: data.isCustomer || entityType === 'partner',
    };

    const result = await xeroRequest('/Contacts', {
        method: 'POST',
        body: { Contacts: [xeroContact] },
    });

    if (!result.success || !result.data) {
        return { success: false, error: getXeroError(result, 'Failed to sync contact to Xero') };
    }

    const contacts = (result.data as { Contacts?: Array<{ ContactID: string }> }).Contacts;
    if (!contacts || contacts.length === 0) {
        return { success: false, error: 'No contact returned' };
    }

    const xeroContactId = contacts[0].ContactID;

    // Store mapping
    await storeEntityMapping(entityType, lumiereId, xeroContactId);

    // Update Lumiere entity with Xero ID
    const supabase = createAdminServerClient();
    const table = entityType === 'partner' ? 'partners' : 'rtos';
    await supabase
        .from(table)
        .update({
            xero_contact_id: xeroContactId,
            xero_contact_url: `https://go.xero.com/Contacts/View/${xeroContactId}`,
        })
        .eq('id', lumiereId);

    return { success: true, contactId: xeroContactId };
}

/**
 * Get or create Xero contact for a partner/RTO
 */
export async function getOrCreateXeroContact(
    entityType: 'partner' | 'rto',
    lumiereId: string,
    name: string,
    email?: string,
    phone?: string
): Promise<string | null> {
    // Check existing mapping
    const existingId = await getXeroEntityId(entityType, lumiereId);
    if (existingId) return existingId;

    // Create new contact
    const result = await syncContactToXero(entityType, lumiereId, {
        name,
        emailAddress: email,
        phone,
        isSupplier: entityType === 'rto',
        isCustomer: entityType === 'partner',
    });

    return result.success ? result.contactId || null : null;
}

// ============================================
// Phase 3: Import Existing Xero Data
// ============================================

export interface XeroInvoiceSummary {
    invoiceId: string;
    invoiceNumber: string;
    type: 'ACCREC' | 'ACCPAY';
    status: string;
    contactName: string;
    contactId: string;
    date: string;
    dueDate: string;
    total: number;
    amountDue: number;
    amountPaid: number;
}

/**
 * Fetch invoices from Xero
 */
export async function fetchXeroInvoices(options?: {
    type?: 'ACCREC' | 'ACCPAY';
    status?: string;
    page?: number;
    pageSize?: number;
}): Promise<{ success: boolean; invoices?: XeroInvoiceSummary[]; total?: number; error?: string }> {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', options.page.toString());
    if (options?.pageSize) params.set('pageSize', options.pageSize.toString());

    let where = '';
    if (options?.type) where += `Type="${options.type}"`;
    if (options?.status) where += (where ? ' AND ' : '') + `Status="${options.status}"`;
    if (where) params.set('where', where);

    const result = await xeroRequest(`/Invoices?${params.toString()}`);

    if (!result.success || !result.data) {
        return { success: false, error: getXeroError(result, 'Failed to fetch Xero invoices') };
    }

    const data = result.data as {
        Invoices?: Array<{
            InvoiceID: string;
            InvoiceNumber: string;
            Type: 'ACCREC' | 'ACCPAY';
            Status: string;
            Contact: { Name: string; ContactID: string };
            DateString: string;
            DueDateString: string;
            Total: number;
            AmountDue: number;
            AmountPaid: number;
        }>;
        pagination?: { itemCount: number };
    };

    const invoices: XeroInvoiceSummary[] = (data.Invoices || []).map(inv => ({
        invoiceId: inv.InvoiceID,
        invoiceNumber: inv.InvoiceNumber,
        type: inv.Type,
        status: inv.Status,
        contactName: inv.Contact?.Name || '',
        contactId: inv.Contact?.ContactID || '',
        date: inv.DateString,
        dueDate: inv.DueDateString,
        total: inv.Total,
        amountDue: inv.AmountDue,
        amountPaid: inv.AmountPaid,
    }));

    return {
        success: true,
        invoices,
        total: data.pagination?.itemCount,
    };
}

/**
 * Fetch contacts from Xero
 */
export async function fetchXeroContacts(options?: {
    isCustomer?: boolean;
    isSupplier?: boolean;
    page?: number;
}): Promise<{ success: boolean; contacts?: Array<{ id: string; name: string; email?: string }>; error?: string }> {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', options.page.toString());

    let where = '';
    if (options?.isCustomer) where += 'IsCustomer=true';
    if (options?.isSupplier) where += (where ? ' AND ' : '') + 'IsSupplier=true';
    if (where) params.set('where', where);

    const result = await xeroRequest(`/Contacts?${params.toString()}`);

    if (!result.success || !result.data) {
        return { success: false, error: getXeroError(result, 'Failed to fetch Xero contacts') };
    }

    const data = result.data as {
        Contacts?: Array<{ ContactID: string; Name: string; EmailAddress?: string }>;
    };

    return {
        success: true,
        contacts: (data.Contacts || []).map(c => ({
            id: c.ContactID,
            name: c.Name,
            email: c.EmailAddress,
        })),
    };
}

// ============================================
// Phase 4: Payment Recording
// ============================================

/**
 * Record a payment in Xero
 */
export async function recordPaymentInXero(
    xeroInvoiceId: string,
    amount: number,
    accountCode: string = process.env.XERO_PAYMENT_ACCOUNT_CODE || '090',
    date?: string
): Promise<{ success: boolean; paymentId?: string; error?: string }> {
    const payment = {
        Invoice: { InvoiceID: xeroInvoiceId },
        Account: { Code: accountCode },
        Amount: amount,
        Date: date || new Date().toISOString().split('T')[0],
    };

    const result = await xeroRequest('/Payments', {
        method: 'POST',
        body: { Payments: [payment] },
    });

    if (!result.success || !result.data) {
        return { success: false, error: getXeroError(result, 'Failed to record payment in Xero') };
    }

    const payments = (result.data as { Payments?: Array<{ PaymentID: string }> }).Payments;
    if (!payments || payments.length === 0) {
        return { success: false, error: 'No payment returned' };
    }

    return { success: true, paymentId: payments[0].PaymentID };
}

/**
 * Sync application payment status to Xero.
 *
 * Current behavior:
 * - `paid`: records a payment in Xero for the current amount due
 * - other statuses: no write action in Xero (returns informative message)
 */
export async function syncApplicationPaymentStatusToXero(
    applicationId: string,
    paymentStatus: ApplicationPaymentStatus
): Promise<{
    success: boolean;
    synced: boolean;
    message: string;
    xeroPaymentId?: string;
}> {
    const supabase = createAdminServerClient();

    const { data: application, error: appError } = await supabase
        .from('applications')
        .select('id, xero_invoice_id, quoted_tuition, quoted_materials, total_paid')
        .eq('id', applicationId)
        .single();

    if (appError || !application) {
        return { success: false, synced: false, message: 'Application not found' };
    }

    if (!application.xero_invoice_id) {
        return {
            success: true,
            synced: false,
            message: 'Application has no linked Xero invoice',
        };
    }

    const localQuotedTotal = Math.max(
        0,
        Number(application.quoted_tuition || 0) + Number(application.quoted_materials || 0)
    );
    const localPaidAmount = Math.max(0, Number(application.total_paid || 0));

    const invoiceResult = await xeroRequest(`/Invoices/${application.xero_invoice_id}`);
    if (!invoiceResult.success || !invoiceResult.data) {
        return {
            success: false,
            synced: false,
            message: getXeroError(invoiceResult, 'Failed to fetch invoice from Xero'),
        };
    }

    const invoices = (invoiceResult.data as {
        Invoices?: Array<{ InvoiceID: string; Status?: string; AmountDue?: number; AmountPaid?: number; Total?: number }>;
    }).Invoices;

    if (!invoices || invoices.length === 0) {
        return {
            success: false,
            synced: false,
            message: 'Xero invoice not found',
        };
    }

    const xeroInvoice = invoices[0];
    const xeroAmountPaid = Math.max(0, Number(xeroInvoice.AmountPaid || 0));
    const xeroAmountDue = Math.max(0, Number(xeroInvoice.AmountDue || 0));
    const xeroTotal = Math.max(0, Number(xeroInvoice.Total || xeroAmountPaid + xeroAmountDue));

    const localTargetPaid =
        paymentStatus === 'paid'
            ? (localQuotedTotal > 0 ? localQuotedTotal : xeroTotal)
            : paymentStatus === 'partial'
                ? Math.min(localPaidAmount, localQuotedTotal > 0 ? localQuotedTotal : xeroTotal)
                : 0;

    if (localTargetPaid <= 0) {
        return {
            success: true,
            synced: false,
            message: 'Local balance indicates no payable amount to post to Xero',
        };
    }

    const paymentDelta = Number((localTargetPaid - xeroAmountPaid).toFixed(2));

    if (paymentDelta <= 0) {
        await supabase
            .from('applications')
            .update({
                xero_invoice_status: xeroInvoice.Status || null,
                xero_last_synced_at: new Date().toISOString(),
            })
            .eq('id', applicationId);

        if (paymentDelta < 0) {
            return {
                success: true,
                synced: false,
                message: 'Xero already has higher paid amount than local balance; no automatic reverse entry applied',
            };
        }

        return {
            success: true,
            synced: true,
            message: 'Xero payment already matches local balance',
        };
    }

    if (paymentDelta > xeroAmountDue && xeroAmountDue > 0) {
        return {
            success: false,
            synced: false,
            message: 'Local balance exceeds Xero amount due; please reconcile invoice totals before syncing',
        };
    }

    const paymentResult = await recordPaymentInXero(application.xero_invoice_id, paymentDelta);
    if (!paymentResult.success || !paymentResult.paymentId) {
        return {
            success: false,
            synced: false,
            message: paymentResult.error || 'Failed to record payment in Xero',
        };
    }

    await supabase
        .from('applications')
        .update({
            xero_invoice_status: paymentStatus === 'paid' ? 'PAID' : xeroInvoice.Status || null,
            xero_last_synced_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

    return {
        success: true,
        synced: true,
        message: `Payment recorded in Xero (AUD ${paymentDelta.toFixed(2)})`,
        xeroPaymentId: paymentResult.paymentId,
    };
}

// ============================================
// Phase 5: Reports
// ============================================

/**
 * Fetch Profit and Loss report from Xero
 */
export async function fetchProfitAndLoss(
    fromDate: string,
    toDate: string
): Promise<{ success: boolean; report?: unknown; error?: string }> {
    const result = await xeroRequest(
        `/Reports/ProfitAndLoss?fromDate=${fromDate}&toDate=${toDate}`
    );
    return result;
}

/**
 * Fetch Balance Sheet from Xero
 */
export async function fetchBalanceSheet(
    date?: string
): Promise<{ success: boolean; report?: unknown; error?: string }> {
    const dateParam = date || new Date().toISOString().split('T')[0];
    const result = await xeroRequest(`/Reports/BalanceSheet?date=${dateParam}`);
    return result;
}

/**
 * Fetch Aged Receivables from Xero
 */
export async function fetchAgedReceivables(
    date?: string
): Promise<{ success: boolean; report?: unknown; error?: string }> {
    const dateParam = date || new Date().toISOString().split('T')[0];
    const result = await xeroRequest(`/Reports/AgedReceivablesByContact?date=${dateParam}`);
    return result;
}

/**
 * Fetch Aged Payables from Xero
 */
export async function fetchAgedPayables(
    date?: string
): Promise<{ success: boolean; report?: unknown; error?: string }> {
    const dateParam = date || new Date().toISOString().split('T')[0];
    const result = await xeroRequest(`/Reports/AgedPayablesByContact?date=${dateParam}`);
    return result;
}

/**
 * Update last sync timestamp
 */
export async function updateLastSyncTime(): Promise<void> {
    const supabase = createAdminServerClient();
    await supabase
        .from('xero_connection')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('is_active', true);
}

/**
 * Get an authenticated Xero client ready for API calls
 */
export async function getAuthenticatedClient(): Promise<{
    success: boolean;
    client?: XeroClient;
    tenantId?: string;
    error?: string;
}> {
    const tokenResult = await ensureValidToken();

    if (!tokenResult.success || !tokenResult.accessToken) {
        return { success: false, error: tokenResult.error || 'No valid token' };
    }

    const xero = getXeroClient();

    // Set the token
    xero.setTokenSet({
        access_token: tokenResult.accessToken,
    });

    return {
        success: true,
        client: xero,
        tenantId: tokenResult.tenantId,
    };
}

// ============================================
// Export utility functions
// ============================================

export const xeroService = {
    // Phase 1: OAuth
    getXeroClient,
    getAuthorizationUrl,
    exchangeCodeForTokens,
    getActiveConnection,
    getConnectionStatus,
    ensureValidToken,
    disconnectXero,
    getXeroEntityId,
    storeEntityMapping,
    markEntityPendingSync,
    getAuthenticatedClient,
    XERO_SCOPES,
    XERO_SALES_ACCOUNT_CODE,
    XERO_PURCHASES_ACCOUNT_CODE,
    XERO_SALES_TAX_TYPE,
    XERO_PURCHASES_TAX_TYPE,

    // Phase 2: Sync
    pushInvoiceToXero,
    pushBillToXero,
    syncContactToXero,
    getOrCreateXeroContact,

    // Phase 3: Import
    fetchXeroInvoices,
    fetchXeroContacts,

    // Phase 4: Payments
    recordPaymentInXero,
    syncApplicationPaymentStatusToXero,

    // Phase 5: Reports
    fetchProfitAndLoss,
    fetchBalanceSheet,
    fetchAgedReceivables,
    fetchAgedPayables,
    downloadInvoicePdfFromXero,
    updateLastSyncTime,
};

export default xeroService;

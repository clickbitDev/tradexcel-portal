import { getSingletonPortalOrgId } from '@/lib/portal-org';
import { createAdminServerClient } from '@/lib/supabase/server';
import { getValidXeroConnection, upsertXeroConnectionForOrg } from '@/lib/services/xero/token-manager';

type AdminSupabaseClient = ReturnType<typeof createAdminServerClient>;

export type XeroApiError = {
    error: string;
    status?: number;
    details?: string;
    traceId?: string;
};

export type XeroApiResult<T> =
    | { success: true; data: T }
    | ({ success: false } & XeroApiError);

function normalizeTraceId(response: Response): string | undefined {
    return (
        response.headers.get('xero-correlation-id')
        || response.headers.get('xero-trace-id')
        || response.headers.get('xero-correlationid')
        || undefined
    );
}

async function parseJsonResponse<T>(response: Response): Promise<XeroApiResult<T>> {
    const rawText = await response.text();

    if (!response.ok) {
        let parsedError: unknown = null;
        try {
            parsedError = rawText ? JSON.parse(rawText) : null;
        } catch {
            parsedError = null;
        }

        const message =
            (parsedError as { Message?: string; message?: string } | null)?.Message
            || (parsedError as { Message?: string; message?: string } | null)?.message
            || rawText
            || `Xero API request failed (${response.status})`;

        return {
            success: false,
            error: message,
            status: response.status,
            details: rawText,
            traceId: normalizeTraceId(response),
        };
    }

    try {
        return {
            success: true,
            data: (rawText ? JSON.parse(rawText) : {}) as T,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to parse Xero JSON response',
            status: response.status,
            details: rawText,
            traceId: normalizeTraceId(response),
        };
    }
}

export async function requestXeroJson<T>(input: {
    path: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    orgId?: string;
    supabase?: AdminSupabaseClient;
}): Promise<XeroApiResult<T>> {
    const supabase = input.supabase || createAdminServerClient();
    const orgId = input.orgId || await getSingletonPortalOrgId(supabase);
    const connection = await getValidXeroConnection({ orgId, supabase });

    const response = await fetch(`https://api.xero.com/api.xro/2.0${input.path}`, {
        method: input.method || 'GET',
        headers: {
            'Authorization': `Bearer ${connection.access_token}`,
            'xero-tenant-id': connection.tenant_id,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: input.body ? JSON.stringify(input.body) : undefined,
    });

    const parsed = await parseJsonResponse<T>(response);

    if (parsed.success) {
        await upsertXeroConnectionForOrg({
            orgId,
            accessToken: connection.access_token,
            refreshToken: connection.refresh_token,
            expiresAt: connection.expires_at,
            tenantId: connection.tenant_id,
            tenantName: connection.tenant_name,
            tokenType: connection.token_type,
            salesAccountCode: connection.sales_account_code,
            purchasesAccountCode: connection.purchases_account_code,
            salesTaxType: connection.sales_tax_type,
            purchasesTaxType: connection.purchases_tax_type,
            paymentAccountCode: connection.payment_account_code,
            lastRefreshedAt: connection.last_refreshed_at,
            lastSyncAt: new Date().toISOString(),
            lastError: null,
            lastErrorAt: null,
            errorCount: 0,
            supabase,
        });
    }

    return parsed;
}

export async function requestXeroPdf(input: {
    path: string;
    orgId?: string;
    supabase?: AdminSupabaseClient;
}): Promise<{ success: true; data: Uint8Array } | ({ success: false } & XeroApiError)> {
    const supabase = input.supabase || createAdminServerClient();
    const orgId = input.orgId || await getSingletonPortalOrgId(supabase);
    const connection = await getValidXeroConnection({ orgId, supabase });

    const response = await fetch(`https://api.xero.com/api.xro/2.0${input.path}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${connection.access_token}`,
            'xero-tenant-id': connection.tenant_id,
            'Accept': 'application/pdf',
        },
    });

    if (!response.ok) {
        const details = await response.text();
        return {
            success: false,
            error: `Failed to fetch PDF from Xero (${response.status})`,
            status: response.status,
            details,
            traceId: normalizeTraceId(response),
        };
    }

    const bytes = new Uint8Array(await response.arrayBuffer());

    await upsertXeroConnectionForOrg({
        orgId,
        accessToken: connection.access_token,
        refreshToken: connection.refresh_token,
        expiresAt: connection.expires_at,
        tenantId: connection.tenant_id,
        tenantName: connection.tenant_name,
        tokenType: connection.token_type,
        salesAccountCode: connection.sales_account_code,
        purchasesAccountCode: connection.purchases_account_code,
        salesTaxType: connection.sales_tax_type,
        purchasesTaxType: connection.purchases_tax_type,
        paymentAccountCode: connection.payment_account_code,
        lastRefreshedAt: connection.last_refreshed_at,
        lastSyncAt: new Date().toISOString(),
        lastError: null,
        lastErrorAt: null,
        errorCount: 0,
        supabase,
    });

    return { success: true, data: bytes };
}

export async function createInvoice(input: {
    invoice: Record<string, unknown>;
    orgId?: string;
    supabase?: AdminSupabaseClient;
}) {
    return requestXeroJson<{ Invoices?: Array<Record<string, unknown>> }>({
        path: '/Invoices',
        method: 'POST',
        body: { Invoices: [input.invoice] },
        orgId: input.orgId,
        supabase: input.supabase,
    });
}

export async function createBill(input: {
    bill: Record<string, unknown>;
    orgId?: string;
    supabase?: AdminSupabaseClient;
}) {
    return requestXeroJson<{ Invoices?: Array<Record<string, unknown>> }>({
        path: '/Invoices',
        method: 'POST',
        body: { Invoices: [input.bill] },
        orgId: input.orgId,
        supabase: input.supabase,
    });
}

export async function getInvoice(input: {
    xeroInvoiceId: string;
    orgId?: string;
    supabase?: AdminSupabaseClient;
}) {
    return requestXeroJson<{ Invoices?: Array<Record<string, unknown>> }>({
        path: `/Invoices/${encodeURIComponent(input.xeroInvoiceId)}`,
        orgId: input.orgId,
        supabase: input.supabase,
    });
}

export async function getInvoicePdf(input: {
    xeroInvoiceId: string;
    orgId?: string;
    supabase?: AdminSupabaseClient;
}) {
    return requestXeroPdf({
        path: `/Invoices/${encodeURIComponent(input.xeroInvoiceId)}?pdf=true`,
        orgId: input.orgId,
        supabase: input.supabase,
    });
}

export async function getPayments(input: {
    xeroInvoiceId: string;
    orgId?: string;
    supabase?: AdminSupabaseClient;
}) {
    const where = encodeURIComponent(`Invoice.InvoiceID=Guid("${input.xeroInvoiceId}")`);
    const direct = await requestXeroJson<{ Payments?: Array<Record<string, unknown>> }>({
        path: `/Payments?where=${where}`,
        orgId: input.orgId,
        supabase: input.supabase,
    });

    if (direct.success) {
        return direct;
    }

    const invoiceResult = await getInvoice(input);
    if (!invoiceResult.success) {
        return invoiceResult;
    }

    const invoice = invoiceResult.data.Invoices?.[0] as { Payments?: Array<Record<string, unknown>> } | undefined;
    return {
        success: true,
        data: {
            Payments: invoice?.Payments || [],
        },
    };
}

export async function createContact(input: {
    contact: Record<string, unknown>;
    orgId?: string;
    supabase?: AdminSupabaseClient;
}) {
    return requestXeroJson<{ Contacts?: Array<Record<string, unknown>> }>({
        path: '/Contacts',
        method: 'POST',
        body: { Contacts: [input.contact] },
        orgId: input.orgId,
        supabase: input.supabase,
    });
}

export async function getContacts(input?: {
    query?: string;
    orgId?: string;
    supabase?: AdminSupabaseClient;
}) {
    return requestXeroJson<{ Contacts?: Array<Record<string, unknown>> }>({
        path: `/Contacts${input?.query ? `?${input.query}` : ''}`,
        orgId: input?.orgId,
        supabase: input?.supabase,
    });
}

export async function recordPayment(input: {
    payment: Record<string, unknown>;
    orgId?: string;
    supabase?: AdminSupabaseClient;
}) {
    return requestXeroJson<{ Payments?: Array<Record<string, unknown>> }>({
        path: '/Payments',
        method: 'POST',
        body: { Payments: [input.payment] },
        orgId: input.orgId,
        supabase: input.supabase,
    });
}

export async function fetchReport(input: {
    path: string;
    orgId?: string;
    supabase?: AdminSupabaseClient;
}) {
    return requestXeroJson<Record<string, unknown>>({
        path: input.path,
        orgId: input.orgId,
        supabase: input.supabase,
    });
}

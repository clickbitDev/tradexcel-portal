import { createAdminServerClient } from '@/lib/supabase/server';
import type { Invoice, InvoiceCollectionStatus, InvoicePayment } from '@/types/database';
import { getSingletonPortalOrgId } from '@/lib/portal-org';
import { getOrCreateXeroContact } from '@/lib/services/xero/contact-sync-service';
import { getXeroEntityMappingByXeroId, upsertXeroEntityMapping } from '@/lib/services/xero/entity-map-service';
import { buildXeroInvoiceUrl, deriveCollectionStatus, getInvoiceStatusPresentation, isInvoiceSettled } from '@/lib/services/xero/status-mapping';
import { createInvoice, getInvoice, getPayments } from '@/lib/services/xero/xero-client';

type AdminSupabaseClient = ReturnType<typeof createAdminServerClient>;

export type MainApplicationFeeType = 'application_fee';

export interface CreateApplicationInvoiceParams {
    applicationId: string;
    feeType: MainApplicationFeeType;
    amount?: number;
    description?: string;
    dueDate?: string;
}

type ApplicationForInvoice = {
    id: string;
    offering_id: string | null;
    partner_id: string | null;
    student_first_name: string | null;
    student_last_name: string | null;
    student_email: string | null;
    student_phone: string | null;
    xero_invoice_id: string | null;
    xero_invoice_number: string | null;
    partner?: {
        id: string;
        company_name: string;
        email?: string | null;
        phone?: string | null;
    } | null;
    offering?: {
        application_fee?: number | null;
        qualification?: {
            id: string;
            code: string | null;
            name: string | null;
        } | null;
    } | null;
};

type XeroInvoicePaymentRecord = {
    PaymentID?: string;
    Amount?: number;
    Date?: string;
    PaymentDate?: string;
    Reference?: string;
    CurrencyCode?: string;
    Account?: {
        AccountID?: string;
    } | null;
};

type XeroInvoiceRecord = {
    InvoiceID?: string;
    InvoiceNumber?: string;
    Status?: string;
    Total?: number;
    AmountPaid?: number;
    AmountDue?: number;
    AmountCredited?: number;
    SubTotal?: number;
    TotalTax?: number;
    CurrencyCode?: string;
    DateString?: string;
    Date?: string;
    DueDateString?: string;
    DueDate?: string;
    UpdatedDateUTC?: string;
    Payments?: XeroInvoicePaymentRecord[];
};

export type ApplicationInvoiceStatusResponse = ReturnType<typeof getInvoiceStatusPresentation>;

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
    if (!value) return null;
    return Array.isArray(value) ? value[0] ?? null : value;
}

function todayISO(): string {
    return new Date().toISOString().split('T')[0];
}

function parseXeroDate(value: string | null | undefined): Date | null {
    if (!value) return null;

    const match = /^\/Date\((\d+)([+-]\d{4})?\)\/$/.exec(value);
    if (match?.[1]) {
        const timestamp = Number(match[1]);
        if (!Number.isNaN(timestamp)) {
            return new Date(timestamp);
        }
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed;
}

function toIsoDate(value: string | null | undefined): string | null {
    const parsed = parseXeroDate(value);
    if (!parsed) return null;
    return parsed.toISOString().split('T')[0];
}

function toIsoTimestamp(value: string | null | undefined): string | null {
    const parsed = parseXeroDate(value);
    if (!parsed) return null;
    return parsed.toISOString();
}

function buildMainApplicationFeeData(
    application: ApplicationForInvoice,
    params: CreateApplicationInvoiceParams
) {
    const qualification = normalizeOne(application.offering?.qualification);
    const priceListAmount = Number(application.offering?.application_fee ?? 0);

    if (priceListAmount <= 0) {
        throw new Error('Main Application Fee is not configured on the assigned qualification price list');
    }

    return {
        qualification,
        amount: priceListAmount,
        description: params.description?.trim() || `Main Application Fee - ${qualification?.name || 'Qualification'}`,
        dueDate: params.dueDate || todayISO(),
        currencyCode: 'AUD',
    };
}

function getLegacyInvoiceStatus(collectionStatus: InvoiceCollectionStatus): Invoice['status'] {
    switch (collectionStatus) {
        case 'paid':
        case 'overpaid':
            return 'paid';
        case 'voided':
        case 'deleted':
            return 'cancelled';
        case 'draft':
            return 'draft';
        case 'pending_approval':
        case 'open':
        case 'partially_paid':
        default:
            return 'sent';
    }
}

function parseUuid(value: string | null | undefined): string | null {
    if (!value) return null;
    return /^[0-9a-fA-F-]{36}$/.test(value) ? value : null;
}

async function fetchApplicationForInvoice(
    applicationId: string,
    adminSupabase: AdminSupabaseClient
): Promise<ApplicationForInvoice> {
    const { data: applicationRow, error } = await adminSupabase
        .from('applications')
        .select('id, offering_id, partner_id, student_first_name, student_last_name, student_email, student_phone, xero_invoice_id, xero_invoice_number')
        .eq('id', applicationId)
        .single<{
            id: string;
            offering_id: string | null;
            partner_id: string | null;
            student_first_name: string | null;
            student_last_name: string | null;
            student_email: string | null;
            student_phone: string | null;
            xero_invoice_id: string | null;
            xero_invoice_number: string | null;
        }>();

    if (error || !applicationRow) {
        throw new Error(error?.message || 'Application not found');
    }

    const partner = applicationRow.partner_id
        ? await adminSupabase
            .from('partners')
            .select('id, company_name, email, phone')
            .eq('id', applicationRow.partner_id)
            .maybeSingle<{
                id: string;
                company_name: string;
                email?: string | null;
                phone?: string | null;
            }>()
        : { data: null, error: null };

    if (partner.error) {
        throw new Error(partner.error.message || 'Failed to load partner details');
    }

    let qualification: { id: string; code: string | null; name: string | null } | null = null;
    let offering: { application_fee?: number | null; qualification?: { id: string; code: string | null; name: string | null } | null } | null = null;

    if (applicationRow.offering_id) {
        const offeringResult = await adminSupabase
            .from('rto_offerings')
            .select('qualification_id, application_fee')
            .eq('id', applicationRow.offering_id)
            .maybeSingle<{ qualification_id: string | null; application_fee: number | null }>();

        if (offeringResult.error) {
            throw new Error(offeringResult.error.message || 'Failed to load qualification price list');
        }

        if (offeringResult.data?.qualification_id) {
            const qualificationResult = await adminSupabase
                .from('qualifications')
                .select('id, code, name')
                .eq('id', offeringResult.data.qualification_id)
                .maybeSingle<{ id: string; code: string | null; name: string | null }>();

            if (qualificationResult.error) {
                throw new Error(qualificationResult.error.message || 'Failed to load qualification details');
            }

            qualification = qualificationResult.data || null;
        }

        offering = {
            application_fee: offeringResult.data?.application_fee ?? null,
            qualification,
        };
    }

    return {
        ...applicationRow,
        partner: partner.data || null,
        offering,
    };
}

async function getExistingInvoiceForApplication(
    applicationId: string,
    adminSupabase: AdminSupabaseClient
): Promise<Invoice | null> {
    const { data, error } = await adminSupabase
        .from('invoices')
        .select('*')
        .eq('application_id', applicationId)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<Invoice>();

    if (error || !data) {
        return null;
    }

    return data;
}

function latestPaymentTimestamp(payments: XeroInvoicePaymentRecord[]): string | null {
    const timestamps = payments
        .map((payment) => payment.Date || payment.PaymentDate || null)
        .filter((value): value is string => Boolean(value))
        .map((value) => parseXeroDate(value)?.getTime() || NaN)
        .filter((value) => !Number.isNaN(value))
        .sort((left, right) => right - left);

    if (timestamps.length === 0) {
        return null;
    }

    return new Date(timestamps[0]).toISOString();
}

async function syncInvoicePayments(
    invoiceId: string,
    tenantId: string,
    payments: XeroInvoicePaymentRecord[],
    adminSupabase: AdminSupabaseClient
) {
    if (payments.length === 0) {
        await adminSupabase
            .from('invoice_payments')
            .delete()
            .eq('invoice_id', invoiceId);
        return [] as InvoicePayment[];
    }

    const normalizedPayments: InvoicePayment[] = payments
        .map((payment) => ({
            id: '',
            tenant_id: tenantId,
            invoice_id: invoiceId,
            xero_payment_id: String(payment.PaymentID || ''),
            amount: Number(payment.Amount || 0),
            date: toIsoDate(payment.Date || payment.PaymentDate || todayISO()) || todayISO(),
            payment_date: toIsoDate(payment.Date || payment.PaymentDate || todayISO()) || todayISO(),
            currency_code: payment.CurrencyCode || 'AUD',
            reference: payment.Reference || null,
            xero_account_id: parseUuid(payment.Account?.AccountID),
            raw_payload: payment,
            raw_xero_payload: payment,
            created_at: '',
            updated_at: '',
        }))
        .filter((payment) => payment.xero_payment_id.length > 0);

    await adminSupabase
        .from('invoice_payments')
        .delete()
        .eq('invoice_id', invoiceId);

    const { error } = await adminSupabase
        .from('invoice_payments')
        .upsert(normalizedPayments.map((payment) => ({
            tenant_id: payment.tenant_id,
            invoice_id: payment.invoice_id,
            xero_payment_id: payment.xero_payment_id,
            amount: payment.amount,
            date: payment.date,
            payment_date: payment.payment_date,
            currency_code: payment.currency_code,
            reference: payment.reference,
            xero_account_id: payment.xero_account_id,
            raw_payload: payment.raw_payload,
            raw_xero_payload: payment.raw_xero_payload,
        })), {
            onConflict: 'xero_payment_id',
        });

    if (error) {
        throw new Error(error.message || 'Unable to sync invoice payments');
    }

    return normalizedPayments;
}

async function persistInvoiceSnapshot(input: {
    invoiceId: string;
    applicationId: string | null;
    tenantId: string;
    customerId: string | null;
    xeroInvoice: XeroInvoiceRecord;
    adminSupabase: AdminSupabaseClient;
}) {
    const xeroInvoiceId = input.xeroInvoice.InvoiceID;
    if (!xeroInvoiceId) {
        throw new Error('Xero invoice payload is missing InvoiceID');
    }

    const { data: currentInvoice, error: currentInvoiceError } = await input.adminSupabase
        .from('invoices')
        .select('id, status, xero_sent_at, sync_version')
        .eq('id', input.invoiceId)
        .single<{ id: string; status: Invoice['status']; xero_sent_at: string | null; sync_version: number | null }>();

    if (currentInvoiceError || !currentInvoice) {
        throw new Error(currentInvoiceError?.message || 'Cached invoice row not found');
    }

    const rawExternalStatus = (input.xeroInvoice.Status || 'DRAFT').trim().toUpperCase();
    const total = Number(input.xeroInvoice.Total || 0);
    const amountPaid = Number(input.xeroInvoice.AmountPaid || 0);
    const amountDue = Number(input.xeroInvoice.AmountDue ?? Math.max(0, total - amountPaid));
    const amountCredited = Number(input.xeroInvoice.AmountCredited || 0);
    const subTotal = Number(input.xeroInvoice.SubTotal ?? total);
    const totalTax = Number(input.xeroInvoice.TotalTax ?? 0);
    const internalStatus = deriveCollectionStatus(rawExternalStatus, total, amountPaid, amountDue);
    const xeroUrl = buildXeroInvoiceUrl(xeroInvoiceId);
    const xeroInvoiceNumber = input.xeroInvoice.InvoiceNumber || null;
    const issueDate = toIsoDate(input.xeroInvoice.DateString || input.xeroInvoice.Date);
    const dueDate = toIsoDate(input.xeroInvoice.DueDateString || input.xeroInvoice.DueDate);
    const xeroUpdatedDateUtc = toIsoTimestamp(input.xeroInvoice.UpdatedDateUTC) || null;
    const paymentsPayload = Array.isArray(input.xeroInvoice.Payments) ? input.xeroInvoice.Payments : [];
    const fullyPaidAt = isInvoiceSettled(internalStatus) && (internalStatus === 'paid' || internalStatus === 'overpaid')
        ? latestPaymentTimestamp(paymentsPayload) || xeroUpdatedDateUtc || new Date().toISOString()
        : null;

    const { data: updatedInvoice, error } = await input.adminSupabase
        .from('invoices')
        .update({
            tenant_id: input.tenantId,
            customer_id: input.customerId,
            source_system: 'xero',
            type: 'ACCREC',
            currency_code: input.xeroInvoice.CurrencyCode || 'AUD',
            invoice_number: xeroInvoiceNumber || undefined,
            subtotal: subTotal,
            sub_total: subTotal,
            total: total,
            total_amount: total,
            total_tax: totalTax,
            amount_paid: amountPaid,
            amount_due: amountDue,
            amount_credited: amountCredited,
            status: getLegacyInvoiceStatus(internalStatus),
            internal_collection_status: internalStatus,
            date_issued: issueDate,
            due_date: dueDate,
            fully_paid_at: fullyPaidAt,
            raw_payload: input.xeroInvoice,
            raw_xero_payload: input.xeroInvoice,
            xero_invoice_id: xeroInvoiceId,
            xero_invoice_url: xeroUrl,
            xero_status: rawExternalStatus,
            xero_sent_at: currentInvoice.xero_sent_at || new Date().toISOString(),
            xero_synced_at: new Date().toISOString(),
            last_xero_synced_at: new Date().toISOString(),
            xero_updated_date_utc: xeroUpdatedDateUtc,
            sync_version: (currentInvoice.sync_version || 0) + 1,
        })
        .eq('id', input.invoiceId)
        .select('*')
        .single<Invoice>();

    if (error || !updatedInvoice) {
        throw new Error(error?.message || 'Unable to update cached invoice data');
    }

    await syncInvoicePayments(updatedInvoice.id, input.tenantId, paymentsPayload, input.adminSupabase);

    if (input.applicationId) {
        await input.adminSupabase
            .from('applications')
            .update({
                xero_invoice_id: xeroInvoiceId,
                xero_invoice_number: xeroInvoiceNumber,
                xero_invoice_status: rawExternalStatus,
                xero_invoice_url: xeroUrl,
                xero_last_synced_at: new Date().toISOString(),
            })
            .eq('id', input.applicationId);
    }

    await upsertXeroEntityMapping({
        entityType: 'invoice',
        lumiereId: updatedInvoice.id,
        xeroId: xeroInvoiceId,
        xeroNumber: xeroInvoiceNumber,
        xeroUrl,
        supabase: input.adminSupabase,
    });

    return updatedInvoice;
}

export async function createInvoiceForApplication(params: CreateApplicationInvoiceParams): Promise<{
    invoice: Invoice;
    xeroInvoiceId: string;
    invoiceNumber: string;
    xeroUrl: string;
    pdfDownloadUrl: string;
    warning?: string;
}> {
    const adminSupabase = createAdminServerClient();
    const tenantId = await getSingletonPortalOrgId(adminSupabase);
    const application = await fetchApplicationForInvoice(params.applicationId, adminSupabase);
    const partner = normalizeOne(application.partner);

    if (params.feeType !== 'application_fee') {
        throw new Error('Unsupported fee type for invoice creation');
    }

    const invoiceData = buildMainApplicationFeeData(application, params);
    const applicantName = `${application.student_first_name || ''} ${application.student_last_name || ''}`.trim() || `Applicant ${application.id}`;
    const customerId = partner?.id || null;

    let invoice = await getExistingInvoiceForApplication(params.applicationId, adminSupabase);
    if (invoice?.xero_invoice_id) {
        const syncedInvoice = await syncInvoiceByLocalInvoiceId(invoice.id);
        return {
            invoice: syncedInvoice,
            xeroInvoiceId: syncedInvoice.xero_invoice_id || invoice.xero_invoice_id,
            invoiceNumber: syncedInvoice.invoice_number,
            xeroUrl: syncedInvoice.xero_invoice_url || buildXeroInvoiceUrl(syncedInvoice.xero_invoice_id || invoice.xero_invoice_id),
            pdfDownloadUrl: `/api/invoices/${invoice.id}/pdf`,
            warning: 'Invoice already synced to Xero',
        };
    }

    if (!invoice) {
        const { data: createdInvoice, error: createInvoiceError } = await adminSupabase
            .from('invoices')
            .insert({
                tenant_id: tenantId,
                application_id: params.applicationId,
                customer_id: customerId,
                partner_id: partner?.id || null,
                source_system: 'xero',
                type: 'ACCREC',
                currency_code: invoiceData.currencyCode,
                student_name: applicantName,
                course_name: invoiceData.qualification?.name || null,
                rto_name: null,
                tuition_fee: 0,
                material_fee: 0,
                application_fee: invoiceData.amount,
                other_fees: 0,
                discount: 0,
                subtotal: invoiceData.amount,
                sub_total: invoiceData.amount,
                total: invoiceData.amount,
                total_amount: invoiceData.amount,
                total_tax: 0,
                amount_paid: 0,
                amount_due: invoiceData.amount,
                amount_credited: 0,
                status: 'draft',
                internal_collection_status: 'draft',
                date_issued: todayISO(),
                due_date: invoiceData.dueDate,
                notes: invoiceData.description,
                raw_payload: null,
                raw_xero_payload: null,
            })
            .select('*')
            .single<Invoice>();

        if (createInvoiceError || !createdInvoice) {
            throw new Error(createInvoiceError?.message || 'Unable to create the local invoice cache row.');
        }

        invoice = createdInvoice;
    } else {
        const { data: refreshedInvoice, error: refreshInvoiceError } = await adminSupabase
            .from('invoices')
            .update({
                tenant_id: tenantId,
                customer_id: customerId,
                partner_id: partner?.id || null,
                source_system: 'xero',
                type: 'ACCREC',
                currency_code: invoiceData.currencyCode,
                application_fee: invoiceData.amount,
                tuition_fee: 0,
                material_fee: 0,
                other_fees: 0,
                subtotal: invoiceData.amount,
                sub_total: invoiceData.amount,
                total: invoiceData.amount,
                total_amount: invoiceData.amount,
                total_tax: 0,
                amount_due: invoiceData.amount,
                amount_paid: 0,
                amount_credited: 0,
                status: 'draft',
                internal_collection_status: 'draft',
                date_issued: todayISO(),
                due_date: invoiceData.dueDate,
                notes: invoiceData.description,
            })
            .eq('id', invoice.id)
            .select('*')
            .single<Invoice>();

        if (refreshInvoiceError || !refreshedInvoice) {
            throw new Error(refreshInvoiceError?.message || 'Unable to update the local invoice cache row.');
        }

        invoice = refreshedInvoice;
    }

    const contactId = await getOrCreateXeroContact({
        entityType: partner ? 'partner' : 'application_applicant',
        lumiereId: partner?.id || application.id,
        name: partner?.company_name || applicantName,
        email: partner?.email || application.student_email,
        phone: partner?.phone || application.student_phone,
    });

    if (!contactId) {
        throw new Error('Failed to sync contact to Xero');
    }

    const createResult = await createInvoice({
        invoice: {
            Type: 'ACCREC',
            Contact: { ContactID: contactId },
            InvoiceNumber: invoice.invoice_number,
            Reference: `Lumiere:${invoice.id}`,
            DueDate: invoiceData.dueDate,
            Date: todayISO(),
            Status: 'DRAFT',
            CurrencyCode: invoiceData.currencyCode,
            LineAmountTypes: 'Exclusive',
            LineItems: [{
                Description: invoiceData.description,
                Quantity: 1,
                UnitAmount: invoiceData.amount,
            }],
        },
        supabase: adminSupabase,
    });

    if (!createResult.success) {
        throw new Error(createResult.error || 'Failed to create invoice in Xero');
    }

    const xeroInvoice = createResult.data.Invoices?.[0] as XeroInvoiceRecord | undefined;
    if (!xeroInvoice?.InvoiceID) {
        throw new Error('Xero did not return an invoice payload');
    }

    const updatedInvoice = await persistInvoiceSnapshot({
        invoiceId: invoice.id,
        applicationId: params.applicationId,
        tenantId,
        customerId,
        xeroInvoice,
        adminSupabase,
    });

    return {
        invoice: updatedInvoice,
        xeroInvoiceId: xeroInvoice.InvoiceID,
        invoiceNumber: updatedInvoice.invoice_number,
        xeroUrl: updatedInvoice.xero_invoice_url || buildXeroInvoiceUrl(xeroInvoice.InvoiceID),
        pdfDownloadUrl: `/api/invoices/${invoice.id}/pdf`,
    };
}

export async function syncInvoiceByXeroInvoiceId(xeroInvoiceId: string): Promise<Invoice> {
    const adminSupabase = createAdminServerClient();
    const invoiceResult = await getInvoice({ xeroInvoiceId, supabase: adminSupabase });
    if (!invoiceResult.success) {
        throw new Error(invoiceResult.error || 'Failed to fetch invoice from Xero');
    }

    const xeroInvoice = invoiceResult.data.Invoices?.[0] as XeroInvoiceRecord | undefined;
    if (!xeroInvoice?.InvoiceID) {
        throw new Error('Xero invoice was not found');
    }

    const { data: localInvoice, error: invoiceLookupError } = await adminSupabase
        .from('invoices')
        .select('id, application_id, tenant_id, customer_id')
        .eq('xero_invoice_id', xeroInvoiceId)
        .maybeSingle<{ id: string; application_id: string | null; tenant_id: string | null; customer_id: string | null }>();

    const mapping = localInvoice ? null : await getXeroEntityMappingByXeroId('invoice', xeroInvoiceId, adminSupabase);
    if (invoiceLookupError || (!localInvoice && !mapping)) {
        throw new Error('Local invoice cache row not found for the Xero invoice');
    }

    const targetInvoiceId = localInvoice?.id || mapping?.lumiere_id;
    if (!targetInvoiceId) {
        throw new Error('Local invoice cache row not found for the Xero invoice');
    }

    const paymentsResult = await getPayments({ xeroInvoiceId, supabase: adminSupabase });
    if (paymentsResult.success) {
        xeroInvoice.Payments = paymentsResult.data.Payments as XeroInvoicePaymentRecord[];
    }

    return persistInvoiceSnapshot({
        invoiceId: targetInvoiceId,
        applicationId: localInvoice?.application_id || null,
        tenantId: localInvoice?.tenant_id || await getSingletonPortalOrgId(adminSupabase),
        customerId: localInvoice?.customer_id || null,
        xeroInvoice,
        adminSupabase,
    });
}

export async function syncInvoiceByLocalInvoiceId(invoiceId: string): Promise<Invoice> {
    const adminSupabase = createAdminServerClient();
    const { data: invoice, error } = await adminSupabase
        .from('invoices')
        .select('id, xero_invoice_id')
        .eq('id', invoiceId)
        .single<{ id: string; xero_invoice_id: string | null }>();

    if (error || !invoice?.xero_invoice_id) {
        throw new Error(error?.message || 'Invoice is not synced to Xero yet');
    }

    return syncInvoiceByXeroInvoiceId(invoice.xero_invoice_id);
}

export async function getCachedInvoiceForApplication(applicationId: string): Promise<Invoice | null> {
    return getExistingInvoiceForApplication(applicationId, createAdminServerClient());
}

export async function getInvoicePayments(invoiceId: string): Promise<InvoicePayment[]> {
    const adminSupabase = createAdminServerClient();
    const { data, error } = await adminSupabase
        .from('invoice_payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('payment_date', { ascending: false })
        .returns<InvoicePayment[]>();

    if (error || !data) {
        return [];
    }

    return data;
}

export function buildApplicationInvoiceStatus(invoice: Invoice) {
    const internalStatus = invoice.internal_collection_status || deriveCollectionStatus(
        invoice.xero_status,
        Number(invoice.total || invoice.total_amount || 0),
        Number(invoice.amount_paid || 0),
        Number(invoice.amount_due || 0)
    );

    return getInvoiceStatusPresentation({
        externalStatus: invoice.xero_status,
        internalStatus,
    });
}

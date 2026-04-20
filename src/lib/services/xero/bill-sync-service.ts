import { createAdminServerClient } from '@/lib/supabase/server';
import { getResolvedPortalRto } from '@/lib/portal-rto';
import { getOrCreateXeroContact } from '@/lib/services/xero/contact-sync-service';
import { buildXeroBillUrl } from '@/lib/services/xero/status-mapping';
import { createBill as createXeroBill, getInvoice } from '@/lib/services/xero/xero-client';
import { upsertXeroEntityMapping } from '@/lib/services/xero/entity-map-service';

type AdminSupabaseClient = ReturnType<typeof createAdminServerClient>;

type ApplicationForBill = {
    id: string;
    student_first_name: string | null;
    student_last_name: string | null;
    quoted_tuition: number | null;
    quoted_materials: number | null;
    xero_bill_id: string | null;
    offering?: {
        tuition_fee_onshore?: number | null;
        material_fee?: number | null;
    } | null;
};

type BillRow = {
    id: string;
    application_id: string | null;
    bill_number: string;
    rto_invoice_number: string | null;
    xero_bill_id: string | null;
    xero_bill_url: string | null;
    xero_status: string | null;
};

type XeroBillRecord = {
    InvoiceID?: string;
    InvoiceNumber?: string;
    Status?: string;
};

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
    if (!value) return null;
    return Array.isArray(value) ? value[0] ?? null : value;
}

function todayISO(): string {
    return new Date().toISOString().split('T')[0];
}

async function fetchApplication(applicationId: string, adminSupabase: AdminSupabaseClient): Promise<ApplicationForBill> {
    const { data, error } = await adminSupabase
        .from('applications')
        .select(`
            id,
            student_first_name,
            student_last_name,
            quoted_tuition,
            quoted_materials,
            xero_bill_id,
            offering:rto_offerings(tuition_fee_onshore, material_fee)
        `)
        .eq('id', applicationId)
        .single();

    if (error || !data) {
        throw new Error(error?.message || 'Application not found');
    }

    return {
        ...data,
        offering: normalizeOne(data.offering),
    } as ApplicationForBill;
}

async function getExistingBill(applicationId: string, adminSupabase: AdminSupabaseClient): Promise<BillRow | null> {
    const { data, error } = await adminSupabase
        .from('bills')
        .select('id, application_id, bill_number, rto_invoice_number, xero_bill_id, xero_bill_url, xero_status')
        .eq('application_id', applicationId)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<BillRow>();

    if (error || !data) {
        return null;
    }

    return data;
}

async function persistBillSnapshot(input: {
    billId: string;
    applicationId: string;
    xeroBill: XeroBillRecord;
    adminSupabase: AdminSupabaseClient;
}) {
    const xeroBillId = input.xeroBill.InvoiceID;
    if (!xeroBillId) {
        throw new Error('Xero bill payload is missing InvoiceID');
    }

    const xeroBillNumber = input.xeroBill.InvoiceNumber || null;
    const xeroUrl = buildXeroBillUrl(xeroBillId);

    await input.adminSupabase
        .from('bills')
        .update({
            xero_bill_id: xeroBillId,
            xero_bill_url: xeroUrl,
            xero_status: input.xeroBill.Status || 'DRAFT',
        })
        .eq('id', input.billId);

    await input.adminSupabase
        .from('applications')
        .update({
            xero_bill_id: xeroBillId,
            xero_bill_number: xeroBillNumber,
            xero_bill_status: input.xeroBill.Status || 'DRAFT',
            xero_bill_url: xeroUrl,
            xero_last_synced_at: new Date().toISOString(),
        })
        .eq('id', input.applicationId);

    await upsertXeroEntityMapping({
        entityType: 'bill',
        lumiereId: input.billId,
        xeroId: xeroBillId,
        xeroNumber: xeroBillNumber,
        xeroUrl,
        supabase: input.adminSupabase,
    });

    return {
        xeroBillId,
        billNumber: xeroBillNumber,
        xeroUrl,
    };
}

export async function createBillForApplication(input: { applicationId: string; userId: string | null }) {
    const adminSupabase = createAdminServerClient();
    const application = await fetchApplication(input.applicationId, adminSupabase);
    const portalRto = await getResolvedPortalRto(adminSupabase as never);

    if (!portalRto.rto?.id) {
        throw new Error('Portal RTO is not configured');
    }

    let bill = await getExistingBill(input.applicationId, adminSupabase);

    const tuitionCost = application.quoted_tuition ?? application.offering?.tuition_fee_onshore ?? 0;
    const materialCost = application.quoted_materials ?? application.offering?.material_fee ?? 0;
    const totalAmount = tuitionCost + materialCost;

    if (!bill) {
        const { data: createdBill, error: createBillError } = await adminSupabase
            .from('bills')
            .insert({
                rto_id: portalRto.rto.id,
                application_id: input.applicationId,
                description: `Bill for ${application.student_first_name || ''} ${application.student_last_name || ''}`.trim(),
                tuition_cost: tuitionCost,
                material_cost: materialCost,
                other_costs: 0,
                total_amount: totalAmount,
                status: 'pending',
                created_by: input.userId,
            })
            .select('id, application_id, bill_number, rto_invoice_number, xero_bill_id, xero_bill_url, xero_status')
            .single<BillRow>();

        if (createBillError || !createdBill) {
            throw new Error(createBillError?.message || 'Failed to create bill');
        }

        bill = createdBill;
    }

    if (bill.xero_bill_id) {
        return {
            xeroBillId: bill.xero_bill_id,
            billNumber: bill.bill_number || bill.rto_invoice_number,
            lumiereBillId: bill.id,
            xeroUrl: bill.xero_bill_url,
            warning: 'Bill already synced to Xero',
        };
    }

    const contactId = await getOrCreateXeroContact({
        entityType: 'rto',
        lumiereId: portalRto.rto.id,
        name: portalRto.rto.name,
        email: portalRto.rto.email,
        phone: portalRto.rto.phone,
    });

    if (!contactId) {
        throw new Error('Failed to sync contact to Xero');
    }

    const createResult = await createXeroBill({
        bill: {
            Type: 'ACCPAY',
            Contact: { ContactID: contactId },
            InvoiceNumber: bill.bill_number || bill.rto_invoice_number || undefined,
            Reference: `Lumiere:${bill.id}`,
            DueDate: todayISO(),
            Status: 'DRAFT',
            LineAmountTypes: 'Exclusive',
            LineItems: [
                ...(tuitionCost > 0 ? [{ Description: 'Tuition Cost', Quantity: 1, UnitAmount: tuitionCost }] : []),
                ...(materialCost > 0 ? [{ Description: 'Material Cost', Quantity: 1, UnitAmount: materialCost }] : []),
            ],
        },
        supabase: adminSupabase,
    });

    if (!createResult.success) {
        throw new Error(createResult.error || 'Failed to create bill in Xero');
    }

    const xeroBill = createResult.data.Invoices?.[0] as XeroBillRecord | undefined;
    if (!xeroBill?.InvoiceID) {
        throw new Error('Xero did not return a bill payload');
    }

    const persisted = await persistBillSnapshot({
        billId: bill.id,
        applicationId: input.applicationId,
        xeroBill,
        adminSupabase,
    });

    return {
        ...persisted,
        lumiereBillId: bill.id,
    };
}

export async function syncBillByLocalBillId(billId: string) {
    const adminSupabase = createAdminServerClient();
    const { data: bill, error } = await adminSupabase
        .from('bills')
        .select('id, application_id, xero_bill_id')
        .eq('id', billId)
        .single<{ id: string; application_id: string | null; xero_bill_id: string | null }>();

    if (error || !bill) {
        throw new Error(error?.message || 'Bill not found');
    }

    if (!bill.xero_bill_id) {
        if (!bill.application_id) {
            throw new Error('Bill is not linked to an application');
        }

        return createBillForApplication({ applicationId: bill.application_id || '', userId: null });
    }

    const billResult = await getInvoice({ xeroInvoiceId: bill.xero_bill_id, supabase: adminSupabase });
    if (!billResult.success) {
        throw new Error(billResult.error || 'Failed to fetch bill from Xero');
    }

    const xeroBill = billResult.data.Invoices?.[0] as XeroBillRecord | undefined;
    if (!xeroBill?.InvoiceID || !bill.application_id) {
        throw new Error('Xero bill not found');
    }

    return {
        ...(await persistBillSnapshot({
            billId: bill.id,
            applicationId: bill.application_id,
            xeroBill,
            adminSupabase,
        })),
        lumiereBillId: bill.id,
    };
}

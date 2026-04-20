import { config as loadEnv } from 'dotenv';
import {
    ensureValidToken,
    getConnectionStatus,
    getOrCreateXeroContact,
    pushBillToXero,
    pushInvoiceToXero,
    type XeroBillData,
    type XeroInvoiceData,
} from '../src/lib/services/xero-service';
import { createAdminServerClient } from '../src/lib/supabase/server';

loadEnv({ path: '.env' });

type CandidateApplication = {
    id: string;
    student_first_name: string;
    student_last_name: string;
    quoted_tuition: number | null;
    quoted_materials: number | null;
    partner: {
        id: string;
        company_name: string | null;
        contact_name: string | null;
        email: string | null;
        phone: string | null;
    } | null;
    offering: {
        tuition_fee_onshore: number | null;
        material_fee: number | null;
        application_fee: number | null;
        misc_fee?: number | null;
        qualification: {
            name: string | null;
        } | null;
        rto: {
            id: string;
            name: string;
            email: string | null;
            phone: string | null;
        } | null;
    } | null;
};

type PairTestResult = {
    applicationId: string;
    invoice: {
        ok: boolean;
        invoiceId?: string;
        invoiceNumber?: string;
        xeroInvoiceId?: string;
        error?: string;
    };
    bill: {
        ok: boolean;
        billId?: string;
        billNumber?: string;
        xeroBillId?: string;
        error?: string;
    };
};

function todayISO(): string {
    return new Date().toISOString().split('T')[0];
}

function isMissingMiscFeeColumn(error: unknown): boolean {
    const message = String((error as { message?: string } | null)?.message || '').toLowerCase();
    return message.includes('misc_fee') && (message.includes('column') || message.includes('schema cache'));
}

async function loadApplications(limit: number): Promise<CandidateApplication[]> {
    const admin = createAdminServerClient();

    const selectWithMiscFee = `
        id,
        student_first_name,
        student_last_name,
        quoted_tuition,
        quoted_materials,
        partner:partners(id, company_name, contact_name, email, phone),
        offering:rto_offerings(
            tuition_fee_onshore,
            material_fee,
            application_fee,
            misc_fee,
            qualification:qualifications(name),
            rto:rtos(id, name, email, phone)
        )
    `;

    const selectWithoutMiscFee = `
        id,
        student_first_name,
        student_last_name,
        quoted_tuition,
        quoted_materials,
        partner:partners(id, company_name, contact_name, email, phone),
        offering:rto_offerings(
            tuition_fee_onshore,
            material_fee,
            application_fee,
            qualification:qualifications(name),
            rto:rtos(id, name, email, phone)
        )
    `;

    let query: {
        data: unknown;
        error: { message: string } | null;
    } = await admin
        .from('applications')
        .select(selectWithMiscFee)
        .not('partner_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(Math.max(limit * 8, 20));

    if (query.error && isMissingMiscFeeColumn(query.error)) {
        query = await admin
            .from('applications')
            .select(selectWithoutMiscFee)
            .not('partner_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(Math.max(limit * 8, 20));
    }

    if (query.error) {
        throw new Error(`Failed to load applications: ${query.error.message}`);
    }

    const rows = (query.data || []) as unknown as CandidateApplication[];
    return rows.filter((row) => {
        const partner = row.partner;
        const offering = row.offering;
        const rto = offering?.rto;
        const tuition = row.quoted_tuition ?? offering?.tuition_fee_onshore ?? 0;
        const materials = row.quoted_materials ?? offering?.material_fee ?? 0;
        const applicationFee = offering?.application_fee ?? 0;
        const invoiceTotal = tuition + materials + applicationFee + (offering?.misc_fee ?? 0);
        const billTotal = tuition + materials;

        return Boolean(
            partner &&
            rto &&
            (partner.company_name || partner.contact_name) &&
            invoiceTotal > 0 &&
            billTotal > 0
        );
    });
}

async function runPairTest(runId: string, app: CandidateApplication): Promise<PairTestResult> {
    const admin = createAdminServerClient();

    const partner = app.partner;
    const offering = app.offering;
    const rto = offering?.rto;

    if (!partner || !offering || !rto) {
        return {
            applicationId: app.id,
            invoice: { ok: false, error: 'Missing partner/offering/RTO data' },
            bill: { ok: false, error: 'Missing partner/offering/RTO data' },
        };
    }

    const tuitionFee = app.quoted_tuition ?? offering.tuition_fee_onshore ?? 0;
    const materialFee = app.quoted_materials ?? offering.material_fee ?? 0;
    const applicationFee = offering.application_fee ?? 0;
    const otherFees = offering.misc_fee ?? 0;

    const invoiceTotal = tuitionFee + materialFee + applicationFee + otherFees;
    const billTotal = tuitionFee + materialFee;

    const invoiceInsert = await admin
        .from('invoices')
        .insert({
            invoice_number: '',
            application_id: app.id,
            partner_id: partner.id,
            student_name: `${app.student_first_name} ${app.student_last_name}`.trim(),
            course_name: offering.qualification?.name ?? null,
            rto_name: rto.name,
            tuition_fee: tuitionFee,
            material_fee: materialFee,
            application_fee: applicationFee,
            other_fees: otherFees,
            discount: 0,
            total_amount: invoiceTotal,
            status: 'draft',
            due_date: todayISO(),
            notes: `${runId} invoice intensive test`,
        })
        .select('id, invoice_number')
        .single();

    if (invoiceInsert.error || !invoiceInsert.data) {
        return {
            applicationId: app.id,
            invoice: { ok: false, error: `Invoice insert failed: ${invoiceInsert.error?.message || 'unknown'}` },
            bill: { ok: false, error: 'Skipped because invoice insert failed' },
        };
    }

    const invoiceId = invoiceInsert.data.id;
    const invoiceNumber = invoiceInsert.data.invoice_number;

    const partnerName = partner.company_name || partner.contact_name || `Partner-${partner.id}`;
    const partnerContactId = await getOrCreateXeroContact(
        'partner',
        partner.id,
        partnerName,
        partner.email || undefined,
        partner.phone || undefined
    );

    if (!partnerContactId) {
        return {
            applicationId: app.id,
            invoice: { ok: false, invoiceId, invoiceNumber, error: 'Failed to resolve partner contact in Xero' },
            bill: { ok: false, error: 'Skipped because invoice contact failed' },
        };
    }

    const invoiceData: XeroInvoiceData = {
        contactId: partnerContactId,
        invoiceNumber,
        reference: `${runId}:invoice:${invoiceId}`,
        dueDate: todayISO(),
        lineItems: [
            ...(tuitionFee > 0 ? [{ description: 'Intensive Test Tuition Fee', quantity: 1, unitAmount: tuitionFee }] : []),
            ...(materialFee > 0 ? [{ description: 'Intensive Test Material Fee', quantity: 1, unitAmount: materialFee }] : []),
            ...(applicationFee > 0 ? [{ description: 'Intensive Test Application Fee', quantity: 1, unitAmount: applicationFee }] : []),
            ...(otherFees > 0 ? [{ description: 'Intensive Test Other Fees', quantity: 1, unitAmount: otherFees }] : []),
        ],
    };

    const invoicePush = await pushInvoiceToXero(invoiceId, invoiceData);

    if (!invoicePush.success || !invoicePush.xeroInvoiceId) {
        return {
            applicationId: app.id,
            invoice: {
                ok: false,
                invoiceId,
                invoiceNumber,
                error: `Invoice push failed: ${invoicePush.error || 'unknown'}`,
            },
            bill: { ok: false, error: 'Skipped because invoice push failed' },
        };
    }

    const invoiceVerify = await admin
        .from('invoices')
        .select('xero_invoice_id')
        .eq('id', invoiceId)
        .single();

    const invoiceMapVerify = await admin
        .from('xero_entity_map')
        .select('xero_id, sync_status')
        .eq('entity_type', 'invoice')
        .eq('lumiere_id', invoiceId)
        .single();

    const invoiceVerified =
        !invoiceVerify.error &&
        invoiceVerify.data?.xero_invoice_id === invoicePush.xeroInvoiceId &&
        !invoiceMapVerify.error &&
        invoiceMapVerify.data?.xero_id === invoicePush.xeroInvoiceId &&
        invoiceMapVerify.data?.sync_status === 'synced';

    if (!invoiceVerified) {
        return {
            applicationId: app.id,
            invoice: {
                ok: false,
                invoiceId,
                invoiceNumber,
                xeroInvoiceId: invoicePush.xeroInvoiceId,
                error: 'Invoice verification failed (local xero fields or xero_entity_map mismatch)',
            },
            bill: { ok: false, error: 'Skipped because invoice verification failed' },
        };
    }

    const billInsert = await admin
        .from('bills')
        .insert({
            bill_number: '',
            rto_id: rto.id,
            application_id: app.id,
            description: `${runId} bill intensive test for ${app.student_first_name} ${app.student_last_name}`,
            tuition_cost: tuitionFee,
            material_cost: materialFee,
            other_costs: 0,
            total_amount: billTotal,
            status: 'pending',
            due_date: todayISO(),
            notes: `${runId} bill intensive test`,
        })
        .select('id, bill_number')
        .single();

    if (billInsert.error || !billInsert.data) {
        return {
            applicationId: app.id,
            invoice: {
                ok: true,
                invoiceId,
                invoiceNumber,
                xeroInvoiceId: invoicePush.xeroInvoiceId,
            },
            bill: { ok: false, error: `Bill insert failed: ${billInsert.error?.message || 'unknown'}` },
        };
    }

    const billId = billInsert.data.id;
    const billNumber = billInsert.data.bill_number;

    const rtoContactId = await getOrCreateXeroContact(
        'rto',
        rto.id,
        rto.name,
        rto.email || undefined,
        rto.phone || undefined
    );

    if (!rtoContactId) {
        return {
            applicationId: app.id,
            invoice: {
                ok: true,
                invoiceId,
                invoiceNumber,
                xeroInvoiceId: invoicePush.xeroInvoiceId,
            },
            bill: { ok: false, billId, billNumber, error: 'Failed to resolve RTO contact in Xero' },
        };
    }

    const billData: XeroBillData = {
        contactId: rtoContactId,
        invoiceNumber: billNumber,
        reference: `${runId}:bill:${billId}`,
        dueDate: todayISO(),
        lineItems: [
            ...(tuitionFee > 0 ? [{ description: 'Intensive Test Tuition Cost', quantity: 1, unitAmount: tuitionFee }] : []),
            ...(materialFee > 0 ? [{ description: 'Intensive Test Material Cost', quantity: 1, unitAmount: materialFee }] : []),
        ],
    };

    const billPush = await pushBillToXero(billId, billData);

    if (!billPush.success || !billPush.xeroBillId) {
        return {
            applicationId: app.id,
            invoice: {
                ok: true,
                invoiceId,
                invoiceNumber,
                xeroInvoiceId: invoicePush.xeroInvoiceId,
            },
            bill: {
                ok: false,
                billId,
                billNumber,
                error: `Bill push failed: ${billPush.error || 'unknown'}`,
            },
        };
    }

    const billVerify = await admin
        .from('bills')
        .select('xero_bill_id')
        .eq('id', billId)
        .single();

    const billMapVerify = await admin
        .from('xero_entity_map')
        .select('xero_id, sync_status')
        .eq('entity_type', 'bill')
        .eq('lumiere_id', billId)
        .single();

    const billVerified =
        !billVerify.error &&
        billVerify.data?.xero_bill_id === billPush.xeroBillId &&
        !billMapVerify.error &&
        billMapVerify.data?.xero_id === billPush.xeroBillId &&
        billMapVerify.data?.sync_status === 'synced';

    return {
        applicationId: app.id,
        invoice: {
            ok: true,
            invoiceId,
            invoiceNumber,
            xeroInvoiceId: invoicePush.xeroInvoiceId,
        },
        bill: {
            ok: billVerified,
            billId,
            billNumber,
            xeroBillId: billPush.xeroBillId,
            error: billVerified ? undefined : 'Bill verification failed (local xero fields or xero_entity_map mismatch)',
        },
    };
}

async function main() {
    const startTime = Date.now();
    const runId = `xero-intensive-${new Date().toISOString()}`;
    const targetPairs = Math.max(1, Number(process.env.XERO_INTENSIVE_TEST_PAIRS || 3));

    const status = await getConnectionStatus();
    if (!status.connected) {
        throw new Error('Xero is not connected. Connect from Settings before running intensive tests.');
    }

    const tokenCheck = await ensureValidToken();
    if (!tokenCheck.success) {
        throw new Error(`Xero token validation failed: ${tokenCheck.error || 'unknown error'}`);
    }

    const applications = await loadApplications(targetPairs);
    if (applications.length === 0) {
        throw new Error('No suitable applications found for invoice/bill intensive test.');
    }

    const picked = applications.slice(0, targetPairs);
    const results: PairTestResult[] = [];

    for (const app of picked) {
        const result = await runPairTest(runId, app);
        results.push(result);
    }

    const invoicePass = results.filter((r) => r.invoice.ok).length;
    const billPass = results.filter((r) => r.bill.ok).length;
    const fullPass = results.filter((r) => r.invoice.ok && r.bill.ok).length;

    const summary = {
        runId,
        tenantId: status.tenantId,
        tenantName: status.tenantName,
        requestedPairs: targetPairs,
        testedPairs: picked.length,
        invoicePass,
        billPass,
        fullPass,
        durationMs: Date.now() - startTime,
        results,
    };

    console.log(JSON.stringify(summary, null, 2));

    if (fullPass !== picked.length) {
        process.exitCode = 1;
    }
}

void main().catch((error) => {
    console.error('Intensive Xero invoice/bill test failed:', error instanceof Error ? error.message : error);
    process.exit(1);
});

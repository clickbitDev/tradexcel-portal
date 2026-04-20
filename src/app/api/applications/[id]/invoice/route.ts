import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { buildApplicationInvoiceStatus, createInvoiceForApplication, getCachedInvoiceForApplication, getInvoicePayments } from '@/lib/services/xero/invoice-sync-service';
import type { Invoice, InvoicePayment, UserRole } from '@/types/database';

const VIEW_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'developer',
];

const MUTATION_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'developer',
];

const CreateApplicationInvoiceSchema = z.object({
    feeType: z.literal('application_fee').default('application_fee'),
    amount: z.number().nonnegative().optional(),
    description: z.string().trim().min(1).optional(),
    dueDate: z.string().date().optional(),
});

function toPaymentHistory(payments: InvoicePayment[]) {
    return payments.map((payment) => ({
        id: payment.id,
        xeroPaymentId: payment.xero_payment_id,
        amount: payment.amount,
        currencyCode: payment.currency_code || 'AUD',
        date: payment.payment_date || payment.date,
        reference: payment.reference || null,
        xeroAccountId: payment.xero_account_id || null,
    }));
}

function toInvoiceResponse(invoice: Invoice, payments: InvoicePayment[]) {
    const status = buildApplicationInvoiceStatus(invoice);
    return {
        id: invoice.id,
        feeType: 'application_fee' as const,
        invoiceNumber: invoice.invoice_number,
        xeroInvoiceId: invoice.xero_invoice_id || null,
        total: Number(invoice.total || invoice.total_amount || 0),
        amountPaid: invoice.amount_paid,
        amountDue: invoice.amount_due,
        status,
        dates: {
            issuedAt: invoice.date_issued || null,
            dueAt: invoice.due_date || null,
            fullyPaidAt: invoice.fully_paid_at || null,
        },
        pdf: {
            url: invoice.pdf_url || `/api/invoices/${invoice.id}/pdf`,
        },
        xero: {
            invoiceId: invoice.xero_invoice_id || null,
            invoiceUrl: invoice.xero_invoice_url || null,
            lastSyncedAt: invoice.last_xero_synced_at || invoice.xero_synced_at || null,
            updatedAtUtc: invoice.xero_updated_date_utc || null,
        },
        paymentHistory: toPaymentHistory(payments),
    };
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authz = await authorizeApiRequest({
        request,
        resource: 'financial',
        action: 'view_financials',
        applicationId: id,
        allowedRoles: VIEW_ROLES,
        allowCompatibilityPermission: true,
    });

    if (!authz.ok) {
        return authz.response;
    }

    const invoice = await getCachedInvoiceForApplication(id);
    if (!invoice) {
        return NextResponse.json({ error: 'Cached invoice not found for this application' }, { status: 404 });
    }

    const payments = await getInvoicePayments(invoice.id);
    return NextResponse.json({ invoice: toInvoiceResponse(invoice, payments) });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'verify_financials',
        applicationId: id,
        allowedRoles: MUTATION_ROLES,
    });

    if (!authz.ok) {
        return authz.response;
    }

    try {
        const parsedBody = CreateApplicationInvoiceSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsedBody.success) {
            return NextResponse.json(
                { error: parsedBody.error.issues[0]?.message || 'Invalid invoice request payload' },
                { status: 400 }
            );
        }

        const result = await createInvoiceForApplication({
            applicationId: id,
            feeType: parsedBody.data.feeType,
            amount: parsedBody.data.amount,
            description: parsedBody.data.description,
            dueDate: parsedBody.data.dueDate,
        });
        const payments = await getInvoicePayments(result.invoice.id);

        return NextResponse.json({
            success: true,
            invoice: toInvoiceResponse(result.invoice, payments),
            warning: result.warning,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create invoice in Xero' },
            { status: 500 }
        );
    }
}

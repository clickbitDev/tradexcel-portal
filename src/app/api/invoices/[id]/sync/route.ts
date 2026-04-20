import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { buildApplicationInvoiceStatus, getInvoicePayments, syncInvoiceByLocalInvoiceId } from '@/lib/services/xero/invoice-sync-service';
import type { Invoice, InvoicePayment, UserRole } from '@/types/database';

const MUTATION_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'developer',
];

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

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authz = await authorizeApiRequest({
        request,
        resource: 'financial',
        action: 'view_financials',
        allowedRoles: MUTATION_ROLES,
        allowCompatibilityPermission: true,
    });

    if (!authz.ok) {
        return authz.response;
    }

    try {
        const invoice = await syncInvoiceByLocalInvoiceId(id);
        const payments = await getInvoicePayments(invoice.id);
        return NextResponse.json({
            success: true,
            invoice: toInvoiceResponse(invoice, payments),
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to sync invoice from Xero' },
            { status: 500 }
        );
    }
}

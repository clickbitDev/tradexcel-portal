import type { InvoiceCollectionStatus } from '@/types/database';

export function deriveCollectionStatus(
    xeroStatus: string | null | undefined,
    total: number,
    amountPaid: number,
    amountDue: number
): InvoiceCollectionStatus {
    const normalized = (xeroStatus || '').trim().toUpperCase();

    if (normalized === 'DELETED') return 'deleted';
    if (normalized === 'VOIDED') return 'voided';
    if (normalized === 'DRAFT') return 'draft';
    if (normalized === 'SUBMITTED') return 'pending_approval';

    if (amountPaid > total) return 'overpaid';
    if (amountDue <= 0 && amountPaid >= total) return 'paid';
    if (amountPaid > 0 && amountDue > 0) return 'partially_paid';

    return 'open';
}

export function mapXeroStatusToInternal(
    status: string | null | undefined,
    total = 0,
    amountPaid = 0,
    amountDue = 0
): InvoiceCollectionStatus {
    return deriveCollectionStatus(status, total, amountPaid, amountDue);
}

const INVOICE_STATUS_META: Record<InvoiceCollectionStatus, { label: string; color: string }> = {
    draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
    pending_approval: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
    open: { label: 'Awaiting Payment', color: 'bg-blue-100 text-blue-700' },
    partially_paid: { label: 'Partially Paid', color: 'bg-orange-100 text-orange-700' },
    paid: { label: 'Paid', color: 'bg-green-100 text-green-700' },
    overpaid: { label: 'Overpaid', color: 'bg-purple-100 text-purple-700' },
    voided: { label: 'Voided', color: 'bg-red-100 text-red-700' },
    deleted: { label: 'Deleted', color: 'bg-gray-200 text-gray-700' },
};

export function getInvoiceCollectionStatusMeta(status: InvoiceCollectionStatus) {
    return INVOICE_STATUS_META[status] || INVOICE_STATUS_META.draft;
}

export function getInvoiceStatusPresentation(input: {
    externalStatus: string | null | undefined;
    internalStatus: InvoiceCollectionStatus;
}) {
    const meta = getInvoiceCollectionStatusMeta(input.internalStatus);
    return {
        external: input.externalStatus || null,
        internal: input.internalStatus,
        label: meta.label,
        color: meta.color,
    };
}

export function isInvoiceSettled(status: InvoiceCollectionStatus) {
    return status === 'paid' || status === 'overpaid' || status === 'voided' || status === 'deleted';
}

export function getPaymentHistoryLabel(status: InvoiceCollectionStatus) {
    if (status === 'partially_paid') {
        return 'Partial payments';
    }

    return 'Payments';
}

export function buildXeroInvoiceUrl(xeroInvoiceId: string): string {
    return `https://go.xero.com/AccountsReceivable/View.aspx?invoiceID=${xeroInvoiceId}`;
}

export function buildXeroBillUrl(xeroBillId: string): string {
    return `https://go.xero.com/AccountsPayable/View.aspx?invoiceID=${xeroBillId}`;
}

import { createAdminServerClient } from '@/lib/supabase/server';
import { recordPayment } from '@/lib/services/xero/xero-client';
import { syncInvoiceByXeroInvoiceId } from '@/lib/services/xero/invoice-sync-service';
import { getValidXeroConnection } from '@/lib/services/xero/token-manager';

type ApplicationPaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded' | 'waived';

export async function syncApplicationPaymentStatusToXero(
    applicationId: string,
    paymentStatus: ApplicationPaymentStatus
): Promise<{
    success: boolean;
    synced: boolean;
    message: string;
    xeroPaymentId?: string;
}> {
    const adminSupabase = createAdminServerClient();

    const { data: application, error } = await adminSupabase
        .from('applications')
        .select('id, xero_invoice_id')
        .eq('id', applicationId)
        .single<{ id: string; xero_invoice_id: string | null }>();

    if (error || !application) {
        return { success: false, synced: false, message: 'Application not found' };
    }

    if (!application.xero_invoice_id) {
        return { success: true, synced: false, message: 'Application has no linked Xero invoice' };
    }

    const syncedInvoice = await syncInvoiceByXeroInvoiceId(application.xero_invoice_id);

    if (paymentStatus !== 'paid') {
        return {
            success: true,
            synced: false,
            message: 'Only paid status writes a payment to Xero. Cached invoice data has been refreshed.',
        };
    }

    const amountDue = Number(syncedInvoice.amount_due || 0);
    if (amountDue <= 0) {
        return {
            success: true,
            synced: true,
            message: 'Xero invoice already shows no amount due.',
        };
    }

    const connection = await getValidXeroConnection({ supabase: adminSupabase });

    const paymentResult = await recordPayment({
        payment: {
            Invoice: { InvoiceID: application.xero_invoice_id },
            Account: { Code: connection.payment_account_code || '090' },
            Amount: amountDue,
            Date: new Date().toISOString().split('T')[0],
        },
        supabase: adminSupabase,
    });

    if (!paymentResult.success) {
        return {
            success: false,
            synced: false,
            message: paymentResult.error || 'Failed to record payment in Xero',
        };
    }

    const xeroPayment = paymentResult.data.Payments?.[0] as { PaymentID?: string } | undefined;
    await syncInvoiceByXeroInvoiceId(application.xero_invoice_id);

    return {
        success: true,
        synced: true,
        message: `Payment recorded in Xero for AUD ${amountDue.toFixed(2)}`,
        xeroPaymentId: xeroPayment?.PaymentID,
    };
}

/**
 * Xero Sync API Route
 * Compatibility wrapper for syncing invoices, bills, and contacts to Xero
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { createInvoiceForApplication, syncInvoiceByLocalInvoiceId } from '@/lib/services/xero/invoice-sync-service';
import { syncBillByLocalBillId } from '@/lib/services/xero/bill-sync-service';
import { syncEntityContactToXero } from '@/lib/services/xero/contact-sync-service';
import { getSingletonPortalXeroConnection } from '@/lib/services/xero/token-manager';
import type { UserRole } from '@/types/database';

const FINANCIAL_SYNC_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'developer',
];

const INTEGRATION_SYNC_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'developer',
];

type SyncAction = 'sync_invoice' | 'sync_bill' | 'sync_partner' | 'sync_rto';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const action = body?.action as SyncAction | undefined;

        if (!action) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const authz = await authorizeApiRequest({
            request,
            resource: action === 'sync_partner' || action === 'sync_rto' ? 'integration' : 'financial',
            action: action === 'sync_partner' || action === 'sync_rto' ? 'manage_integrations' : 'view_financials',
            allowedRoles: action === 'sync_partner' || action === 'sync_rto' ? INTEGRATION_SYNC_ROLES : FINANCIAL_SYNC_ROLES,
        });
        if (!authz.ok) {
            return authz.response;
        }

        const adminSupabase = createAdminServerClient();
        let result: Record<string, unknown> | null = null;

        switch (action) {
            case 'sync_invoice': {
                const invoiceId = body?.invoiceId as string | undefined;
                if (!invoiceId) {
                    return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });
                }

                const { data: invoice, error } = await adminSupabase
                    .from('invoices')
                    .select('id, application_id, xero_invoice_id, invoice_number, xero_invoice_url')
                    .eq('id', invoiceId)
                    .single<{
                        id: string;
                        application_id: string | null;
                        xero_invoice_id: string | null;
                        invoice_number: string;
                        xero_invoice_url: string | null;
                    }>();

                if (error || !invoice) {
                    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
                }

                if (!invoice.xero_invoice_id && invoice.application_id) {
                    const created = await createInvoiceForApplication({
                        applicationId: invoice.application_id,
                        feeType: 'application_fee',
                    });
                    result = {
                        success: true,
                        xeroInvoiceId: created.xeroInvoiceId,
                        invoiceNumber: created.invoiceNumber,
                        xeroUrl: created.xeroUrl,
                        pdfDownloadUrl: created.pdfDownloadUrl,
                    };
                    break;
                }

                const syncedInvoice = await syncInvoiceByLocalInvoiceId(invoice.id);
                result = {
                    success: true,
                    xeroInvoiceId: syncedInvoice.xero_invoice_id,
                    invoiceNumber: syncedInvoice.invoice_number,
                    xeroUrl: syncedInvoice.xero_invoice_url,
                    pdfDownloadUrl: syncedInvoice.pdf_url || `/api/invoices/${syncedInvoice.id}/pdf`,
                };
                break;
            }

            case 'sync_bill': {
                const billId = body?.billId as string | undefined;
                if (!billId) {
                    return NextResponse.json({ error: 'Missing billId' }, { status: 400 });
                }

                const syncedBill = await syncBillByLocalBillId(billId);
                result = {
                    success: true,
                    xeroBillId: syncedBill.xeroBillId,
                    billNumber: syncedBill.billNumber,
                    xeroUrl: syncedBill.xeroUrl,
                };
                break;
            }

            case 'sync_partner': {
                const partnerId = body?.partnerId as string | undefined;
                if (!partnerId) {
                    return NextResponse.json({ error: 'Missing partnerId' }, { status: 400 });
                }

                const { data: partner, error } = await adminSupabase
                    .from('partners')
                    .select('id, company_name, contact_name, email, phone')
                    .eq('id', partnerId)
                    .single<{ id: string; company_name: string | null; contact_name: string | null; email: string | null; phone: string | null }>();

                if (error || !partner) {
                    return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
                }

                const contactResult = await syncEntityContactToXero({
                    entityType: 'partner',
                    lumiereId: partner.id,
                    name: partner.company_name || partner.contact_name || 'Partner',
                    email: partner.email,
                    phone: partner.phone,
                });

                if (!contactResult.success) {
                    return NextResponse.json({ error: contactResult.error }, { status: 500 });
                }

                result = { success: true, contactId: contactResult.contactId };
                break;
            }

            case 'sync_rto': {
                const rtoId = body?.rtoId as string | undefined;
                if (!rtoId) {
                    return NextResponse.json({ error: 'Missing rtoId' }, { status: 400 });
                }

                const { data: rto, error } = await adminSupabase
                    .from('rtos')
                    .select('id, name, email, phone')
                    .eq('id', rtoId)
                    .single<{ id: string; name: string; email: string | null; phone: string | null }>();

                if (error || !rto) {
                    return NextResponse.json({ error: 'RTO not found' }, { status: 404 });
                }

                const contactResult = await syncEntityContactToXero({
                    entityType: 'rto',
                    lumiereId: rto.id,
                    name: rto.name,
                    email: rto.email,
                    phone: rto.phone,
                });

                if (!contactResult.success) {
                    return NextResponse.json({ error: contactResult.error }, { status: 500 });
                }

                result = { success: true, contactId: contactResult.contactId };
                break;
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const connection = await getSingletonPortalXeroConnection(adminSupabase);
        if (connection) {
            await adminSupabase
                .from('xero_connections')
                .update({ last_sync_at: new Date().toISOString() })
                .eq('id', connection.id);
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Xero sync error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Sync failed' },
            { status: 500 }
        );
    }
}

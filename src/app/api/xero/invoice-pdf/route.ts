import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { getInvoicePdf } from '@/lib/services/xero/xero-client';
import type { UserRole } from '@/types/database';

type InvoiceRow = {
    id: string;
    invoice_number: string | null;
    xero_invoice_id: string | null;
};

const STAFF_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'developer',
];

function safeFilename(input: string): string {
    return input.replace(/[^a-zA-Z0-9-_]/g, '_');
}

export async function GET(request: NextRequest) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'financial',
        action: 'view_financials',
        allowedRoles: STAFF_ROLES,
        allowCompatibilityPermission: true,
    });
    if (!authz.ok) {
        return authz.response;
    }

    const invoiceId = request.nextUrl.searchParams.get('invoiceId');
    const applicationId = request.nextUrl.searchParams.get('applicationId');

    if (!invoiceId && !applicationId) {
        return NextResponse.json({ error: 'Missing invoiceId or applicationId' }, { status: 400 });
    }

    const adminSupabase = createAdminServerClient();
    let query = adminSupabase
        .from('invoices')
        .select('id, invoice_number, xero_invoice_id')
        .order('created_at', { ascending: false })
        .limit(1);

    if (invoiceId) {
        query = query.eq('id', invoiceId);
    } else if (applicationId) {
        query = query.eq('application_id', applicationId);
    }

    const { data: invoice, error } = await query.maybeSingle<InvoiceRow>();
    if (error || !invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (!invoice.xero_invoice_id) {
        return NextResponse.json({ error: 'Invoice exists but is not synced to Xero yet' }, { status: 400 });
    }

    const pdfResult = await getInvoicePdf({
        xeroInvoiceId: invoice.xero_invoice_id,
        supabase: adminSupabase,
    });

    if (!pdfResult.success) {
        return NextResponse.json(
            {
                error: pdfResult.error,
                details: pdfResult.details,
                traceId: pdfResult.traceId,
            },
            { status: pdfResult.status || 502 }
        );
    }

    const filenameBase = safeFilename(invoice.invoice_number || `invoice-${invoice.id}`);
    const pdfBuffer = pdfResult.data.buffer.slice(
        pdfResult.data.byteOffset,
        pdfResult.data.byteOffset + pdfResult.data.byteLength
    ) as ArrayBuffer;

    return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filenameBase}.pdf"`,
            'Cache-Control': 'no-store',
        },
    });
}

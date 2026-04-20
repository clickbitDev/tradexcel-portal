import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { getInvoicePdf } from '@/lib/services/xero/xero-client';
import type { UserRole } from '@/types/database';

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

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

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

    const adminSupabase = createAdminServerClient();
    const { data: invoice, error } = await adminSupabase
        .from('invoices')
        .select('id, invoice_number, xero_invoice_id')
        .eq('id', id)
        .single<{ id: string; invoice_number: string | null; xero_invoice_id: string | null }>();

    if (error || !invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (!invoice.xero_invoice_id) {
        return NextResponse.json({ error: 'Invoice is not synced to Xero yet' }, { status: 400 });
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

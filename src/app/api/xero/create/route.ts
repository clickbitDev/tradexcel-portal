/**
 * Xero Create API Route
 * POST /api/xero/create - Compatibility wrapper for creating invoices/bills in Xero
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createInvoiceForApplication } from '@/lib/services/xero/invoice-sync-service';
import { createBillForApplication } from '@/lib/services/xero/bill-sync-service';
import type { UserRole } from '@/types/database';

type Action = 'create_invoice' | 'create_bill';

const XERO_MUTATION_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'developer',
];

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const action = body?.action as Action | undefined;
        const applicationId = body?.applicationId as string | undefined;

        if (!action || !applicationId) {
            return NextResponse.json({ error: 'Missing action or applicationId' }, { status: 400 });
        }

        if (action !== 'create_invoice' && action !== 'create_bill') {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const authz = await authorizeApiRequest({
            request,
            resource: 'application',
            action: 'verify_financials',
            applicationId,
            allowedRoles: XERO_MUTATION_ROLES,
        });
        if (!authz.ok) {
            return authz.response;
        }

        if (action === 'create_invoice') {
            const result = await createInvoiceForApplication({
                applicationId,
                feeType: 'application_fee',
            });
            return NextResponse.json({
                success: true,
                xeroInvoiceId: result.xeroInvoiceId,
                invoiceNumber: result.invoiceNumber,
                lumiereInvoiceId: result.invoice.id,
                xeroUrl: result.xeroUrl,
                pdfDownloadUrl: result.pdfDownloadUrl,
                warning: result.warning,
            });
        }

        const result = await createBillForApplication({
            applicationId,
            userId: authz.context.userId,
        });

        return NextResponse.json({
            success: true,
            xeroBillId: result.xeroBillId,
            billNumber: result.billNumber,
            lumiereBillId: result.lumiereBillId,
            xeroUrl: result.xeroUrl,
            warning: result.warning,
        });
    } catch (error) {
        console.error('Xero create error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Create failed' },
            { status: 500 }
        );
    }
}

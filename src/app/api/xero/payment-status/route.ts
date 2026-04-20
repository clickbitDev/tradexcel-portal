import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { syncApplicationPaymentStatusToXero } from '@/lib/services/xero/payment-sync-service';
import type { UserRole } from '@/types/database';

type ApplicationPaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded' | 'waived';

const VALID_PAYMENT_STATUSES: ApplicationPaymentStatus[] = ['unpaid', 'partial', 'paid', 'refunded', 'waived'];

const XERO_PAYMENT_UPDATE_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'developer',
];

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const applicationId = body?.applicationId as string | undefined;
        const paymentStatus = body?.paymentStatus as ApplicationPaymentStatus | undefined;

        if (!applicationId || !paymentStatus) {
            return NextResponse.json({ error: 'Missing applicationId or paymentStatus' }, { status: 400 });
        }

        if (!VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
            return NextResponse.json({ error: 'Invalid paymentStatus' }, { status: 400 });
        }

        const authz = await authorizeApiRequest({
            request,
            resource: 'application',
            action: 'verify_financials',
            applicationId,
            allowedRoles: XERO_PAYMENT_UPDATE_ROLES,
        });
        if (!authz.ok) {
            return authz.response;
        }

        const result = await syncApplicationPaymentStatusToXero(applicationId, paymentStatus);

        if (!result.success) {
            return NextResponse.json({
                success: false,
                synced: false,
                error: result.message,
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            synced: result.synced,
            message: result.message,
            xeroPaymentId: result.xeroPaymentId,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to sync payment status to Xero' },
            { status: 500 }
        );
    }
}

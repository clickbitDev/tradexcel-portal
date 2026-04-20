/**
 * Xero Connection Status Route
 * GET /api/xero/status - Returns current Xero connection status
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { getSingletonPortalXeroConnectionStatus, getValidXeroConnection } from '@/lib/services/xero/token-manager';
import type { UserRole } from '@/types/database';

const XERO_STATUS_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'developer',
];

export async function GET(request: NextRequest) {
    try {
        const authz = await authorizeApiRequest({
            request,
            resource: 'financial',
            action: 'view_financials',
            allowedRoles: XERO_STATUS_ROLES,
        });
        if (!authz.ok) {
            return authz.response;
        }

        let status = await getSingletonPortalXeroConnectionStatus();

        // Keep status fresh for UI: if connected, attempt token refresh on demand.
        if (status.connected) {
            let tokenError: string | null = null;
            try {
                await getValidXeroConnection();
            } catch (error) {
                tokenError = error instanceof Error ? error.message : 'Failed to validate Xero token';
            }

            status = await getSingletonPortalXeroConnectionStatus();

            if (tokenError) {
                status.error = tokenError || status.error;
            }
        }

        return NextResponse.json(status);
    } catch (error) {
        console.error('Xero status error:', error);
        return NextResponse.json(
            { error: 'Failed to get Xero status' },
            { status: 500 }
        );
    }
}

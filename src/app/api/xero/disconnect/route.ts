/**
 * Xero Disconnect Route
 * POST /api/xero/disconnect - Disconnects from Xero
 */

import { NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { disconnectXeroConnectionForOrg } from '@/lib/services/xero/token-manager';
import type { UserRole } from '@/types/database';

const XERO_DISCONNECT_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'developer',
];

export async function POST() {
    try {
        const authz = await authorizeApiRequest({
            resource: 'integration',
            action: 'manage_integrations',
            allowedRoles: XERO_DISCONNECT_ROLES,
        });
        if (!authz.ok) {
            return authz.response;
        }

        await disconnectXeroConnectionForOrg();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Xero disconnect error:', error);
        return NextResponse.json(
            { error: 'Failed to disconnect from Xero' },
            { status: 500 }
        );
    }
}

/**
 * Xero OAuth Initiation Route
 * GET /api/xero/auth - Redirects user to Xero authorization page
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { getXeroAuthorizationUrl } from '@/lib/services/xero/oauth';
import type { UserRole } from '@/types/database';

const XERO_AUTH_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'developer',
];

export async function GET(request: NextRequest) {
    try {
        const authz = await authorizeApiRequest({
            request,
            resource: 'integration',
            action: 'manage_integrations',
            allowedRoles: XERO_AUTH_ROLES,
        });
        if (!authz.ok) {
            return authz.response;
        }

        // Generate a random state for CSRF protection
        const state = crypto.randomUUID();

        // Store state in cookie for verification on callback
        const authUrl = getXeroAuthorizationUrl(state, request);

        const response = NextResponse.redirect(authUrl);

        // Set state cookie for verification (expires in 10 minutes)
        response.cookies.set('xero_oauth_state', state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 600, // 10 minutes
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Xero auth initiation error:', error);
        return NextResponse.json(
            { error: 'Failed to initiate Xero authorization' },
            { status: 500 }
        );
    }
}

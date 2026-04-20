/**
 * Xero OAuth Callback Route
 * GET /api/xero/callback - Handles the OAuth callback from Xero
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { exchangeXeroAuthorizationCode } from '@/lib/services/xero/oauth';
import { createPublicUrl } from '@/lib/url/public-origin';
import type { UserRole } from '@/types/database';

const XERO_CALLBACK_ROLES: UserRole[] = [
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
            allowedRoles: XERO_CALLBACK_ROLES,
        });
        if (!authz.ok) {
            return NextResponse.redirect(
                createPublicUrl(request, '/login?error=unauthorized')
            );
        }

        const searchParams = request.nextUrl.searchParams;
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Handle errors from Xero
        if (error) {
            console.error('Xero OAuth error:', error, errorDescription);
            return NextResponse.redirect(
                createPublicUrl(request, `/portal/settings/xero?error=${encodeURIComponent(errorDescription || error)}`)
            );
        }

        // Verify state for CSRF protection
        const storedState = request.cookies.get('xero_oauth_state')?.value;

        if (!state || state !== storedState) {
            console.error('State mismatch:', { receivedState: state, storedState });
            return NextResponse.redirect(
                createPublicUrl(request, '/portal/settings/xero?error=invalid_state')
            );
        }

        // Verify we have a code
        if (!code) {
            return NextResponse.redirect(
                createPublicUrl(request, '/portal/settings/xero?error=no_code')
            );
        }

        // Exchange code for tokens
        const result = await exchangeXeroAuthorizationCode({ code, request });

        if (!result.success) {
            return NextResponse.redirect(
                createPublicUrl(request, `/portal/settings/xero?error=${encodeURIComponent(result.error || 'token_exchange_failed')}`)
            );
        }

        // Success! Redirect to settings with success message
        const response = NextResponse.redirect(
            createPublicUrl(request, `/portal/settings/xero?success=connected&org=${encodeURIComponent(result.tenantName || '')}`)
        );

        // Clear the state cookie
        response.cookies.delete('xero_oauth_state');

        return response;
    } catch (error) {
        console.error('Xero callback error:', error);
        return NextResponse.redirect(
            createPublicUrl(request, '/portal/settings/xero?error=callback_failed')
        );
    }
}

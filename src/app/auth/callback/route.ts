import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { SUPABASE_CONFIGURATION_USER_MESSAGE, isSupabaseConfigurationError } from '@/lib/supabase/config-error';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/portal';
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle forwarded host for production deployments behind proxies
    const headersList = await headers();
    const forwardedHost = headersList.get('x-forwarded-host');
    const forwardedProto = headersList.get('x-forwarded-proto') || 'https';

    // Use forwarded host if available (production), otherwise use origin
    const redirectBase = forwardedHost
        ? `${forwardedProto}://${forwardedHost}`
        : origin;

    // Handle error from Supabase auth
    if (errorParam) {
        console.error('Auth callback error from Supabase:', errorParam, errorDescription);
        return NextResponse.redirect(`${redirectBase}/login?error=${encodeURIComponent(errorParam)}&message=${encodeURIComponent(errorDescription || '')}`);
    }

    if (code) {
        try {
            const supabase = await createServerClient();
            const { error } = await supabase.auth.exchangeCodeForSession(code);

            if (!error) {
                // Create redirect response with proper cache control
                const response = NextResponse.redirect(`${redirectBase}${next}`);
                // Ensure the browser doesn't cache the redirect
                response.headers.set('Cache-Control', 'no-store, max-age=0');
                return response;
            }

            console.error('Auth callback code exchange error:', error.message, error.code);

            // For password reset flow, still redirect to reset-password page
            // The client-side may be able to recover using hash tokens
            if (next === '/reset-password') {
                console.log('Password reset flow - redirecting despite code exchange error');
                return NextResponse.redirect(`${redirectBase}/reset-password?error=code_exchange_failed`);
            }
        } catch (error) {
            if (isSupabaseConfigurationError(error)) {
                return NextResponse.redirect(`${redirectBase}/login?error=service_configuration_error&message=${encodeURIComponent(SUPABASE_CONFIGURATION_USER_MESSAGE)}`);
            }

            throw error;
        }
    }

    // Return the user to an error page with instructions
    return NextResponse.redirect(`${redirectBase}/login?error=auth_callback_error`);
}

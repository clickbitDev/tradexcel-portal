import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { SUPABASE_CONFIGURATION_USER_MESSAGE, isSupabaseConfigurationError } from '@/lib/supabase/config-error';

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            );
        }

        // Get the origin for redirect URL
        // Use NEXT_PUBLIC_SITE_URL if available (set in .env), otherwise derive from headers
        // For password recovery, always use the production URL since it's whitelisted in Supabase
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://portal.clickbit.com.au';

        const redirectTo = `${siteUrl}/auth/callback?next=/reset-password`;
        console.log('[Recovery] Attempting password reset for:', email);
        console.log('[Recovery] Redirect URL:', redirectTo);

        const supabase = await createServerClient();

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo,
        });

        if (error) {
            console.error('[Recovery] Password reset error:', error);
            console.error('[Recovery] Error code:', error.code);
            console.error('[Recovery] Error status:', error.status);
            return NextResponse.json(
                { error: error.message },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Recovery endpoint error:', error);

        if (isSupabaseConfigurationError(error)) {
            return NextResponse.json(
                { error: SUPABASE_CONFIGURATION_USER_MESSAGE },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

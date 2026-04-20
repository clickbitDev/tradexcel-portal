'use client';

import { createBrowserClient } from '@supabase/ssr'
import { getPublicEnvValue } from '@/lib/public-env'
import { withSafeGetUser } from '@/lib/supabase/safe-auth'

export function createClient() {
    const supabaseUrl = getPublicEnvValue('NEXT_PUBLIC_SUPABASE_URL')
    const supabaseAnonKey = getPublicEnvValue('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    const missingVars = [
        !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
        !supabaseAnonKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : null,
    ].filter((value): value is string => Boolean(value))

    // Check if we're in a build/SSR context where env vars might not be available
    const isBuildTime = typeof window === 'undefined'
    
    // During build time, if env vars are missing, use placeholder values
    // This prevents build errors while still allowing the app to work at runtime
    // The client will be recreated on the client side with actual values
    if (!supabaseUrl || !supabaseAnonKey) {
        if (isBuildTime) {
            // Use valid placeholder values that won't cause Supabase client initialization errors
            // These are only used during build-time SSR and will be replaced at runtime
            return withSafeGetUser(createBrowserClient(
                'https://placeholder.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
            ), 'browser')
        }
        
        throw new Error(
            [
                '@supabase/ssr: Your project\'s URL and API key are required to create a Supabase client!',
                '',
                `Missing environment variables: ${missingVars.join(', ')}`,
                '',
                'In standalone Docker deployments, set these values in both:',
                '1. Build Arguments',
                '2. Runtime Environment Variables',
                '3. Or provide them via the runtime public env script',
                '',
                'Check your Supabase project\'s API settings to find these values:',
                'https://supabase.com/dashboard/project/_/settings/api',
            ].join('\n')
        )
    }

    return withSafeGetUser(createBrowserClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() {
                    return document.cookie.split('; ')
                        .filter(Boolean)
                        .map((cookie) => {
                            const [name, ...rest] = cookie.split('=');
                            return { name, value: rest.join('=') };
                        });
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        let cookieString = `${name}=${value}`;
                        if (options?.maxAge) cookieString += `; Max-Age=${options.maxAge}`;
                        if (options?.expires) cookieString += `; Expires=${options.expires.toUTCString()}`;
                        if (options?.path) cookieString += `; Path=${options.path}`;
                        if (options?.domain) cookieString += `; Domain=${options.domain}`;
                        if (options?.sameSite) cookieString += `; SameSite=${options.sameSite}`;
                        if (options?.secure) cookieString += '; Secure';
                        document.cookie = cookieString;
                    });
                },
            },
        }
    ), 'browser')
}

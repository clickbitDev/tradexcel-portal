import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { readEnvValue } from '@/lib/public-env'
import { withSafeGetUser } from '@/lib/supabase/safe-auth'

export async function createServerClient() {
    const cookieStore = await cookies()

    const supabaseUrl = readEnvValue('NEXT_PUBLIC_SUPABASE_URL')
    const supabaseAnonKey = readEnvValue('NEXT_PUBLIC_SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseAnonKey) {
        // Enhanced error message with debugging info
        const missingVars = []
        if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL')
        if (!supabaseAnonKey) missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')

        const errorMessage = [
            '@supabase/ssr: Your project\'s URL and API key are required to create a Supabase client!',
            '',
            `Missing environment variables: ${missingVars.join(', ')}`,
            '',
            'For Next.js standalone mode, these variables must be:',
            '1. Set during build time (as build args), OR',
            '2. Set at runtime by your deployment platform',
            '',
            'Check your Supabase project\'s API settings to find these values:',
            'https://supabase.com/dashboard/project/_/settings/api',
            '',
            'Current environment check:',
            `- NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'SET' : 'MISSING'}`,
            `- NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'SET' : 'MISSING'}`,
        ].join('\n')

        throw new Error(errorMessage)
    }

    return withSafeGetUser(createSupabaseServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet: Array<{
                    name: string
                    value: string
                    options?: Parameters<typeof cookieStore.set>[2]
                }>) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    ), 'server')
}

/**
 * Create an admin Supabase client with service role key.
 * Use sparingly - this bypasses RLS policies.
 */
export function createAdminServerClient() {
    const supabaseUrl = readEnvValue('NEXT_PUBLIC_SUPABASE_URL')
    const serviceRoleKey = readEnvValue('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
        // Enhanced error message with debugging info
        const missingVars = []
        if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL')
        if (!serviceRoleKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY')

        const errorMessage = [
            '@supabase/ssr: Your project\'s URL and service role key are required to create an admin Supabase client!',
            '',
            `Missing environment variables: ${missingVars.join(', ')}`,
            '',
            'These must be set at runtime by your deployment platform.',
            '',
            'Check your Supabase project\'s API settings to find these values:',
            'https://supabase.com/dashboard/project/_/settings/api',
            '',
            'Current environment check:',
            `- NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'SET' : 'MISSING'}`,
            `- SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? 'SET' : 'MISSING'}`,
        ].join('\n')

        throw new Error(errorMessage)
    }

    return createSupabaseClient(
        supabaseUrl,
        serviceRoleKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}

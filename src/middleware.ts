import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
    return await updateSession(request)
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder files
         * - auth/callback (OAuth callback - needs uninterrupted cookie handling)
         * - api/auth/callback (OAuth callback API - needs uninterrupted cookie handling)
         */
        '/((?!_next/static|_next/image|favicon.ico|auth/callback|api/auth/callback|api/ready|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { readEnvValue } from '@/lib/public-env'
import { hasSupabaseAuthCookies } from '@/lib/supabase/auth-cookies'
import { safeGetUser } from '@/lib/supabase/safe-auth'
import {
    ACCOUNTS_MANAGER_PORTAL_ALIAS_BASE,
    ACCOUNTS_MANAGER_PORTAL_BASE,
    ADMIN_PORTAL_BASE,
    AGENT_PORTAL_BASE,
    AGENT_PORTAL_ALIAS_BASE,
    ASSESSOR_BASE,
    ASSESSOR_PORTAL_BASE,
    DISPATCH_COORDINATOR_PORTAL_BASE,
    EXECUTIVE_MANAGER_PORTAL_BASE,
    mapAccountsManagerPathToPortal,
    mapAdminPathToPortal,
    mapAgentPathToPortal,
    mapAssessorPathToPortal,
    mapDispatchCoordinatorPathToPortal,
    mapExecutivePathToPortal,
    mapPortalPathToAccountsManager,
    mapPortalPathToAdmin,
    mapPortalPathToAgent,
    mapPortalPathToAssessor,
    mapPortalPathToDispatchCoordinator,
    mapPortalPathToExecutive,
} from '@/lib/routes/portal'

const SETTINGS_ROUTE_BASES = [
    '/portal',
    ADMIN_PORTAL_BASE,
    EXECUTIVE_MANAGER_PORTAL_BASE,
    ACCOUNTS_MANAGER_PORTAL_BASE,
    ACCOUNTS_MANAGER_PORTAL_ALIAS_BASE,
    DISPATCH_COORDINATOR_PORTAL_BASE,
    ASSESSOR_PORTAL_BASE,
    AGENT_PORTAL_BASE,
    AGENT_PORTAL_ALIAS_BASE,
]

function normalizeSettingsPath(pathname: string): string | null {
    for (const base of SETTINGS_ROUTE_BASES) {
        const settingsBase = `${base}/settings`

        if (pathname === settingsBase || pathname.startsWith(`${settingsBase}/`)) {
            return `/portal/settings${pathname.slice(settingsBase.length)}`
        }
    }

    return null
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const pathname = request.nextUrl.pathname
    const protectedRoutes = ['/portal', '/agent', '/assessor', '/frontdesk']
    const isProtectedRoute = protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))

    if (!hasSupabaseAuthCookies(request.cookies.getAll())) {
        if (isProtectedRoute) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }

        return supabaseResponse
    }

    const supabaseUrl = readEnvValue('NEXT_PUBLIC_SUPABASE_URL')
    const supabaseAnonKey = readEnvValue('NEXT_PUBLIC_SUPABASE_ANON_KEY')

    // If Supabase env vars are not available, skip middleware logic
    // This can happen during build time
    if (!supabaseUrl || !supabaseAnonKey) {
        return supabaseResponse
    }

    let supabase: ReturnType<typeof createServerClient> | null = null
    let user = null

    try {
        supabase = createServerClient(
            supabaseUrl,
            supabaseAnonKey,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll()
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                        supabaseResponse = NextResponse.next({
                            request,
                        })
                        cookiesToSet.forEach(({ name, value, options }) =>
                            supabaseResponse.cookies.set(name, value, options)
                        )
                    },
                },
            }
        )

        // Refresh session if expired - with error handling
        try {
            const {
                data: { user: userData },
                error: userError,
            } = await safeGetUser(supabase, 'middleware')
            
            if (userError) {
                console.error('Error getting user in middleware:', userError)
                // Clear potentially corrupted cookies from response
                if (userError.message?.includes('JWT') || userError.message?.includes('token') || userError.message?.includes('Cannot create property')) {
                    // Clear all Supabase auth-related cookies
                    const allCookies = request.cookies.getAll()
                    allCookies.forEach(({ name }) => {
                        if (name.includes('sb-') && (name.includes('auth') || name.includes('token'))) {
                            supabaseResponse.cookies.delete(name)
                        }
                    })
                }
            } else {
                user = userData
            }
        } catch (authError) {
            console.error('Middleware auth error:', authError)
            // If there's a critical error, clear auth cookies and continue
            // This prevents the middleware from crashing the entire app
            if (authError instanceof Error && 
                (authError.message.includes('Cannot create property') || 
                 authError.message.includes('JWT') || 
                 authError.message.includes('token'))) {
                // Clear all Supabase auth-related cookies
                const allCookies = request.cookies.getAll()
                allCookies.forEach(({ name }) => {
                    if (name.includes('sb-') && (name.includes('auth') || name.includes('token'))) {
                        supabaseResponse.cookies.delete(name)
                    }
                })
            }
        }
    } catch (error) {
        // Catch any errors during Supabase client creation
        console.error('Error creating Supabase client in middleware:', error)
        // Continue without authentication - let the request proceed
        // The route handlers will handle authentication if needed
        return supabaseResponse
    }

    if (!supabase) {
        return supabaseResponse
    }

    if (pathname === ACCOUNTS_MANAGER_PORTAL_ALIAS_BASE || pathname.startsWith(`${ACCOUNTS_MANAGER_PORTAL_ALIAS_BASE}/`)) {
        const url = request.nextUrl.clone()
        url.pathname = `${ACCOUNTS_MANAGER_PORTAL_BASE}${pathname.slice(ACCOUNTS_MANAGER_PORTAL_ALIAS_BASE.length)}`
        return NextResponse.redirect(url)
    }

    if (pathname === AGENT_PORTAL_ALIAS_BASE || pathname.startsWith(`${AGENT_PORTAL_ALIAS_BASE}/`)) {
        const url = request.nextUrl.clone()
        url.pathname = `${AGENT_PORTAL_BASE}${pathname.slice(AGENT_PORTAL_ALIAS_BASE.length)}`
        return NextResponse.redirect(url)
    }

    // Get user profile for role-based routing and account access checks
    let userRole: string | null = null
    let accountStatus: 'active' | 'disabled' | null = null
    if (user) {
        const { data: profileWithStatus, error: profileWithStatusError } = await supabase
            .from('profiles')
            .select('role, account_status')
            .eq('id', user.id)
            .single()

        if (profileWithStatusError && profileWithStatusError.message?.includes('account_status')) {
            const { data: fallbackProfile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            userRole = fallbackProfile?.role ?? null
            accountStatus = 'active'
        } else {
            userRole = profileWithStatus?.role ?? null
            accountStatus = profileWithStatus?.account_status ?? 'active'
        }
    }

    // Protected routes - redirect to login if not authenticated
    if (isProtectedRoute && !user) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // Disabled accounts are blocked from all protected app routes
    if (user && accountStatus === 'disabled') {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('reason', 'disabled')

        const allCookies = request.cookies.getAll()
        allCookies.forEach(({ name }) => {
            if (name.includes('sb-') && (name.includes('auth') || name.includes('token'))) {
                supabaseResponse.cookies.delete(name)
            }
        })

        return NextResponse.redirect(url)
    }

    // Role-based route protection
    if (user && userRole && accountStatus !== 'disabled') {
        const isAgentRoute = pathname.startsWith('/agent')
        const isAssessorRoute = pathname.startsWith(ASSESSOR_BASE)
        const isFrontdeskRoute = pathname.startsWith('/frontdesk')
        const isPortalRoute = pathname.startsWith('/portal')
        const isAgentPortalRoute = pathname === AGENT_PORTAL_BASE
            || pathname.startsWith(`${AGENT_PORTAL_BASE}/`)
            || pathname === AGENT_PORTAL_ALIAS_BASE
            || pathname.startsWith(`${AGENT_PORTAL_ALIAS_BASE}/`)
        const isAdminPortalRoute = pathname === ADMIN_PORTAL_BASE
            || pathname.startsWith(`${ADMIN_PORTAL_BASE}/`)
        const isAccountsManagerPortalRoute = pathname === ACCOUNTS_MANAGER_PORTAL_BASE
            || pathname.startsWith(`${ACCOUNTS_MANAGER_PORTAL_BASE}/`)
        const isDispatchCoordinatorPortalRoute = pathname === DISPATCH_COORDINATOR_PORTAL_BASE
            || pathname.startsWith(`${DISPATCH_COORDINATOR_PORTAL_BASE}/`)
        const isAssessorPortalRoute = pathname === ASSESSOR_PORTAL_BASE
            || pathname.startsWith(`${ASSESSOR_PORTAL_BASE}/`)
        const isExecutiveManagerPortalRoute = pathname === EXECUTIVE_MANAGER_PORTAL_BASE
            || pathname.startsWith(`${EXECUTIVE_MANAGER_PORTAL_BASE}/`)
        const isLegacyPortalRoute = isPortalRoute
            && !isExecutiveManagerPortalRoute
            && !isAgentPortalRoute
            && !isAdminPortalRoute
            && !isAccountsManagerPortalRoute
            && !isDispatchCoordinatorPortalRoute
            && !isAssessorPortalRoute
        const isAgent = userRole === 'agent'
        const isAdmin = userRole === 'admin'
        const isAccountsManager = userRole === 'accounts_manager'
        const isDispatchCoordinator = userRole === 'dispatch_coordinator'
        const isAssessor = userRole === 'assessor'
        const isFrontdesk = userRole === 'frontdesk'
        const isExecutiveManager = userRole === 'executive_manager'
        const isCoreStaff = ['ceo', 'executive_manager', 'admin', 'accounts_manager', 'dispatch_coordinator', 'developer'].includes(userRole)
        const normalizedSettingsPath = normalizeSettingsPath(pathname)
        const canAccessSettings = userRole === 'ceo' || userRole === 'developer'

        if (normalizedSettingsPath && !canAccessSettings) {
            if (normalizedSettingsPath !== pathname) {
                const rewriteUrl = request.nextUrl.clone()
                rewriteUrl.pathname = normalizedSettingsPath
                return NextResponse.rewrite(rewriteUrl)
            }

            return supabaseResponse
        }

        // Agent users should use /portal/agent/* as the canonical route
        if (isAgent && (isLegacyPortalRoute || isExecutiveManagerPortalRoute || isAdminPortalRoute || isAssessorRoute || isFrontdeskRoute || isAgentRoute)) {
            const url = request.nextUrl.clone()
            url.pathname = isAgentRoute ? mapAgentPathToPortal(pathname) : AGENT_PORTAL_BASE
            return NextResponse.redirect(url)
        }

        // Assessors should always use /portal/assessor/* as the canonical route
        if (isAssessor && (isLegacyPortalRoute || isAdminPortalRoute || isExecutiveManagerPortalRoute || isAgentPortalRoute || isAssessorRoute || isAgentRoute || isFrontdeskRoute)) {
            const url = request.nextUrl.clone()
            const portalPath = isAssessorRoute ? mapAssessorPathToPortal(pathname) : pathname
            url.pathname = mapPortalPathToAssessor(portalPath)
            return NextResponse.redirect(url)
        }

        // Accounts managers should always use /portal/accounts_manager/* as the canonical route
        if (isAccountsManager && (isLegacyPortalRoute || isAdminPortalRoute || isExecutiveManagerPortalRoute || isAgentPortalRoute || isAssessorPortalRoute || isAssessorRoute || isAgentRoute || isFrontdeskRoute)) {
            const url = request.nextUrl.clone()
            const portalPath = isAssessorRoute ? mapAssessorPathToPortal(pathname) : pathname
            url.pathname = mapPortalPathToAccountsManager(portalPath)
            return NextResponse.redirect(url)
        }

        // Dispatch coordinators should always use /portal/dispatch_coordinator/* as the canonical route
        if (isDispatchCoordinator && (isLegacyPortalRoute || isAdminPortalRoute || isExecutiveManagerPortalRoute || isAgentPortalRoute || isAccountsManagerPortalRoute || isAssessorPortalRoute || isAssessorRoute || isAgentRoute || isFrontdeskRoute)) {
            const url = request.nextUrl.clone()
            const portalPath = isAssessorRoute ? mapAssessorPathToPortal(pathname) : pathname
            url.pathname = mapPortalPathToDispatchCoordinator(portalPath)
            return NextResponse.redirect(url)
        }

        // Frontdesk users should remain inside the dedicated frontdesk app
        if ((isPortalRoute || isAgentRoute || isAssessorRoute || isAssessorPortalRoute || isAccountsManagerPortalRoute || isDispatchCoordinatorPortalRoute) && isFrontdesk) {
            const url = request.nextUrl.clone()
            url.pathname = '/frontdesk'
            return NextResponse.redirect(url)
        }

        // Executive managers should always use /portal/executive_manager/*
        if (isExecutiveManager && (isLegacyPortalRoute || isAdminPortalRoute)) {
            const url = request.nextUrl.clone()
            const portalPath = isAdminPortalRoute ? mapAdminPathToPortal(pathname) : pathname
            url.pathname = mapPortalPathToExecutive(portalPath)
            return NextResponse.redirect(url)
        }

        // Admin users should always use /portal/admin/*
        if (isAdmin && isLegacyPortalRoute) {
            const url = request.nextUrl.clone()
            url.pathname = mapPortalPathToAdmin(pathname)
            return NextResponse.redirect(url)
        }

        // Accounts manager users should always use /portal/accounts_manager/*
        if (isAccountsManager && isLegacyPortalRoute) {
            const url = request.nextUrl.clone()
            url.pathname = mapPortalPathToAccountsManager(pathname)
            return NextResponse.redirect(url)
        }

        // Dispatch coordinator users should always use /portal/dispatch_coordinator/*
        if (isDispatchCoordinator && isLegacyPortalRoute) {
            const url = request.nextUrl.clone()
            url.pathname = mapPortalPathToDispatchCoordinator(pathname)
            return NextResponse.redirect(url)
        }

        // Other core staff should stay on /portal/*
        if (isCoreStaff && !isExecutiveManager && isExecutiveManagerPortalRoute) {
            const url = request.nextUrl.clone()
            const portalPath = mapExecutivePathToPortal(pathname)
            url.pathname = isAdmin
                ? mapPortalPathToAdmin(portalPath)
                : isAccountsManager
                    ? mapPortalPathToAccountsManager(portalPath)
                    : isDispatchCoordinator
                        ? mapPortalPathToDispatchCoordinator(portalPath)
                    : portalPath
            return NextResponse.redirect(url)
        }

        // Non-admin staff should not stay on /portal/admin/*
        if (isCoreStaff && !isAdmin && isAdminPortalRoute) {
            const url = request.nextUrl.clone()
            const portalPath = mapAdminPathToPortal(pathname)
            url.pathname = isExecutiveManager
                ? mapPortalPathToExecutive(portalPath)
                : isAccountsManager
                    ? mapPortalPathToAccountsManager(portalPath)
                    : isDispatchCoordinator
                        ? mapPortalPathToDispatchCoordinator(portalPath)
                    : portalPath
            return NextResponse.redirect(url)
        }

        // Non-accounts staff should not stay on /portal/accounts_manager/*
        if (isCoreStaff && !isAccountsManager && isAccountsManagerPortalRoute) {
            const url = request.nextUrl.clone()
            const portalPath = mapAccountsManagerPathToPortal(pathname)
            url.pathname = isExecutiveManager
                ? mapPortalPathToExecutive(portalPath)
                : isAdmin
                    ? mapPortalPathToAdmin(portalPath)
                    : isDispatchCoordinator
                        ? mapPortalPathToDispatchCoordinator(portalPath)
                    : portalPath
            return NextResponse.redirect(url)
        }

        // Non-dispatch staff should not stay on /portal/dispatch_coordinator/*
        if (isCoreStaff && !isDispatchCoordinator && isDispatchCoordinatorPortalRoute) {
            const url = request.nextUrl.clone()
            const portalPath = mapDispatchCoordinatorPathToPortal(pathname)
            url.pathname = isExecutiveManager
                ? mapPortalPathToExecutive(portalPath)
                : isAdmin
                    ? mapPortalPathToAdmin(portalPath)
                    : isAccountsManager
                        ? mapPortalPathToAccountsManager(portalPath)
                    : portalPath
            return NextResponse.redirect(url)
        }

        // Core staff trying to access role-specific portals -> redirect to staff portal
        if ((isAgentRoute || isAgentPortalRoute || isAssessorRoute || isAssessorPortalRoute || isFrontdeskRoute) && isCoreStaff) {
            const url = request.nextUrl.clone()
            if (isExecutiveManager) {
                url.pathname = EXECUTIVE_MANAGER_PORTAL_BASE
            } else if (isAdmin) {
                url.pathname = ADMIN_PORTAL_BASE
            } else if (isAccountsManager) {
                url.pathname = ACCOUNTS_MANAGER_PORTAL_BASE
            } else if (isDispatchCoordinator) {
                url.pathname = DISPATCH_COORDINATOR_PORTAL_BASE
            } else {
                url.pathname = '/portal'
            }
            return NextResponse.redirect(url)
        }

        // Route /portal/agent/* to existing /agent/* pages without duplicating routes
        if (isAgent && isAgentPortalRoute) {
            const rewriteUrl = request.nextUrl.clone()
            rewriteUrl.pathname = mapPortalPathToAgent(pathname)
            return NextResponse.rewrite(rewriteUrl)
        }

        // Route /portal/assessor/* to existing /portal/* pages without duplicating routes
        if (isAssessor && isAssessorPortalRoute) {
            const rewriteUrl = request.nextUrl.clone()
            rewriteUrl.pathname = mapAssessorPathToPortal(pathname)
            return NextResponse.rewrite(rewriteUrl)
        }

        // Route /portal/accounts_manager/* to existing /portal/* pages without duplicating routes
        if (isAccountsManager && isAccountsManagerPortalRoute) {
            const rewriteUrl = request.nextUrl.clone()
            rewriteUrl.pathname = mapAccountsManagerPathToPortal(pathname)
            return NextResponse.rewrite(rewriteUrl)
        }

        // Route /portal/dispatch_coordinator/* to existing /portal/* pages without duplicating routes
        if (isDispatchCoordinator && isDispatchCoordinatorPortalRoute) {
            const rewriteUrl = request.nextUrl.clone()
            rewriteUrl.pathname = mapDispatchCoordinatorPathToPortal(pathname)
            return NextResponse.rewrite(rewriteUrl)
        }

        // Route /portal/executive_manager/* to existing /portal/* pages without duplicating routes
        if (isExecutiveManager && isExecutiveManagerPortalRoute) {
            const rewriteUrl = request.nextUrl.clone()
            rewriteUrl.pathname = mapExecutivePathToPortal(pathname)
            return NextResponse.rewrite(rewriteUrl)
        }

        // Route /portal/admin/* to existing /portal/* pages without duplicating routes
        if (isAdmin && isAdminPortalRoute) {
            const rewriteUrl = request.nextUrl.clone()
            rewriteUrl.pathname = mapAdminPathToPortal(pathname)
            return NextResponse.rewrite(rewriteUrl)
        }
    }

    // Redirect authenticated users away from auth pages
    const authRoutes = ['/login', '/signup']
    const isAuthRoute = authRoutes.some(route =>
        pathname.startsWith(route)
    )

    if (isAuthRoute && user && userRole && accountStatus !== 'disabled') {
        const url = request.nextUrl.clone()
        // Redirect based on role
        if (userRole === 'agent') {
            url.pathname = AGENT_PORTAL_BASE
        } else if (userRole === 'accounts_manager') {
            url.pathname = ACCOUNTS_MANAGER_PORTAL_BASE
        } else if (userRole === 'dispatch_coordinator') {
            url.pathname = DISPATCH_COORDINATOR_PORTAL_BASE
        } else if (userRole === 'assessor') {
            url.pathname = ASSESSOR_PORTAL_BASE
        } else if (userRole === 'frontdesk') {
            url.pathname = '/frontdesk'
        } else if (userRole === 'admin') {
            url.pathname = ADMIN_PORTAL_BASE
        } else if (userRole === 'executive_manager') {
            url.pathname = EXECUTIVE_MANAGER_PORTAL_BASE
        } else {
            url.pathname = '/portal'
        }
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}

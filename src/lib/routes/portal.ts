import type { UserRole } from '@/types/database';

export const PORTAL_BASE = '/portal';
export const EXECUTIVE_MANAGER_PORTAL_BASE = '/portal/executive_manager';
export const ADMIN_PORTAL_BASE = '/portal/admin';
export const ACCOUNTS_MANAGER_PORTAL_BASE = '/portal/accounts_manager';
export const ACCOUNTS_MANAGER_PORTAL_ALIAS_BASE = '/portal/accounts_manger';
export const DISPATCH_COORDINATOR_PORTAL_BASE = '/portal/dispatch_coordinator';
export const ASSESSOR_PORTAL_BASE = '/portal/assessor';
export const AGENT_PORTAL_BASE = '/portal/agent';
export const AGENT_PORTAL_ALIAS_BASE = '/portal/aagent';
export const AGENT_BASE = '/agent';
export const ASSESSOR_BASE = '/assessor';
export const FRONTDESK_BASE = '/frontdesk';

export function getPortalBaseForRole(role: UserRole | null | undefined): string {
    if (role === 'admin') {
        return ADMIN_PORTAL_BASE;
    }

    if (role === 'accounts_manager') {
        return ACCOUNTS_MANAGER_PORTAL_BASE;
    }

    if (role === 'dispatch_coordinator') {
        return DISPATCH_COORDINATOR_PORTAL_BASE;
    }

    if (role === 'assessor') {
        return ASSESSOR_PORTAL_BASE;
    }

    if (role === 'executive_manager') {
        return EXECUTIVE_MANAGER_PORTAL_BASE;
    }

    if (role === 'agent') {
        return AGENT_PORTAL_BASE;
    }

    return PORTAL_BASE;
}

export function getPortalRouteBase(
    pathname: string | null | undefined,
    role?: UserRole | string | null
): string {
    if (pathname?.startsWith(FRONTDESK_BASE)) {
        return FRONTDESK_BASE;
    }

    if (pathname?.startsWith(ACCOUNTS_MANAGER_PORTAL_BASE) || pathname?.startsWith(ACCOUNTS_MANAGER_PORTAL_ALIAS_BASE)) {
        return ACCOUNTS_MANAGER_PORTAL_BASE;
    }

    if (pathname?.startsWith(DISPATCH_COORDINATOR_PORTAL_BASE)) {
        return DISPATCH_COORDINATOR_PORTAL_BASE;
    }

    if (pathname?.startsWith(ASSESSOR_PORTAL_BASE) || pathname?.startsWith(ASSESSOR_BASE)) {
        return ASSESSOR_PORTAL_BASE;
    }

    if (pathname?.startsWith(AGENT_PORTAL_BASE) || pathname?.startsWith(AGENT_PORTAL_ALIAS_BASE) || pathname?.startsWith(AGENT_BASE)) {
        return AGENT_PORTAL_BASE;
    }

    if (pathname?.startsWith(EXECUTIVE_MANAGER_PORTAL_BASE)) {
        return EXECUTIVE_MANAGER_PORTAL_BASE;
    }

    if (pathname === ADMIN_PORTAL_BASE || pathname?.startsWith(`${ADMIN_PORTAL_BASE}/`)) {
        return ADMIN_PORTAL_BASE;
    }

    if (role === 'agent') {
        return AGENT_PORTAL_BASE;
    }

    if (role === 'accounts_manager') {
        return ACCOUNTS_MANAGER_PORTAL_BASE;
    }

    if (role === 'dispatch_coordinator') {
        return DISPATCH_COORDINATOR_PORTAL_BASE;
    }

    if (role === 'assessor') {
        return ASSESSOR_PORTAL_BASE;
    }

    if (role === 'executive_manager') {
        return EXECUTIVE_MANAGER_PORTAL_BASE;
    }

    if (role === 'admin') {
        return ADMIN_PORTAL_BASE;
    }

    return PORTAL_BASE;
}

export function withPortalBase(routeBase: string, subPath = ''): string {
    if (!subPath) {
        return routeBase;
    }

    if (subPath.startsWith('/')) {
        return `${routeBase}${subPath}`;
    }

    return `${routeBase}/${subPath}`;
}

export function normalizePortalPath(pathname: string): string {
    if (pathname === AGENT_PORTAL_BASE || pathname === AGENT_PORTAL_ALIAS_BASE) {
        return AGENT_BASE;
    }

    if (pathname.startsWith(`${AGENT_PORTAL_BASE}/`)) {
        return `${AGENT_BASE}${pathname.slice(AGENT_PORTAL_BASE.length)}`;
    }

    if (pathname.startsWith(`${AGENT_PORTAL_ALIAS_BASE}/`)) {
        return `${AGENT_BASE}${pathname.slice(AGENT_PORTAL_ALIAS_BASE.length)}`;
    }

    if (pathname === ACCOUNTS_MANAGER_PORTAL_BASE || pathname === ACCOUNTS_MANAGER_PORTAL_ALIAS_BASE) {
        return PORTAL_BASE;
    }

    if (pathname.startsWith(`${ACCOUNTS_MANAGER_PORTAL_BASE}/`)) {
        return `${PORTAL_BASE}${pathname.slice(ACCOUNTS_MANAGER_PORTAL_BASE.length)}`;
    }

    if (pathname.startsWith(`${ACCOUNTS_MANAGER_PORTAL_ALIAS_BASE}/`)) {
        return `${PORTAL_BASE}${pathname.slice(ACCOUNTS_MANAGER_PORTAL_ALIAS_BASE.length)}`;
    }

    if (pathname === DISPATCH_COORDINATOR_PORTAL_BASE) {
        return PORTAL_BASE;
    }

    if (pathname.startsWith(`${DISPATCH_COORDINATOR_PORTAL_BASE}/`)) {
        return `${PORTAL_BASE}${pathname.slice(DISPATCH_COORDINATOR_PORTAL_BASE.length)}`;
    }

    if (pathname === ASSESSOR_PORTAL_BASE) {
        return PORTAL_BASE;
    }

    if (pathname.startsWith(`${ASSESSOR_PORTAL_BASE}/`)) {
        return `${PORTAL_BASE}${pathname.slice(ASSESSOR_PORTAL_BASE.length)}`;
    }

    if (pathname === EXECUTIVE_MANAGER_PORTAL_BASE) {
        return PORTAL_BASE;
    }

    if (pathname.startsWith(`${EXECUTIVE_MANAGER_PORTAL_BASE}/`)) {
        return `${PORTAL_BASE}${pathname.slice(EXECUTIVE_MANAGER_PORTAL_BASE.length)}`;
    }

    if (pathname === ADMIN_PORTAL_BASE) {
        return PORTAL_BASE;
    }

    if (pathname.startsWith(`${ADMIN_PORTAL_BASE}/`)) {
        return `${PORTAL_BASE}${pathname.slice(ADMIN_PORTAL_BASE.length)}`;
    }

    return pathname;
}

export function mapPortalPathToExecutive(pathname: string): string {
    if (pathname === PORTAL_BASE) {
        return EXECUTIVE_MANAGER_PORTAL_BASE;
    }

    if (pathname.startsWith(`${PORTAL_BASE}/`)) {
        return `${EXECUTIVE_MANAGER_PORTAL_BASE}${pathname.slice(PORTAL_BASE.length)}`;
    }

    return pathname;
}

export function mapPortalPathToAdmin(pathname: string): string {
    if (pathname === PORTAL_BASE) {
        return ADMIN_PORTAL_BASE;
    }

    if (pathname.startsWith(`${PORTAL_BASE}/`)) {
        return `${ADMIN_PORTAL_BASE}${pathname.slice(PORTAL_BASE.length)}`;
    }

    return pathname;
}

export function mapPortalPathToAccountsManager(pathname: string): string {
    if (pathname === PORTAL_BASE) {
        return ACCOUNTS_MANAGER_PORTAL_BASE;
    }

    if (pathname.startsWith(`${PORTAL_BASE}/`)) {
        return `${ACCOUNTS_MANAGER_PORTAL_BASE}${pathname.slice(PORTAL_BASE.length)}`;
    }

    return pathname;
}

export function mapPortalPathToDispatchCoordinator(pathname: string): string {
    if (pathname === PORTAL_BASE) {
        return DISPATCH_COORDINATOR_PORTAL_BASE;
    }

    if (pathname.startsWith(`${PORTAL_BASE}/`)) {
        return `${DISPATCH_COORDINATOR_PORTAL_BASE}${pathname.slice(PORTAL_BASE.length)}`;
    }

    return pathname;
}

export function mapPortalPathToAssessor(pathname: string): string {
    if (pathname === PORTAL_BASE) {
        return ASSESSOR_PORTAL_BASE;
    }

    if (pathname.startsWith(`${PORTAL_BASE}/`)) {
        return `${ASSESSOR_PORTAL_BASE}${pathname.slice(PORTAL_BASE.length)}`;
    }

    return pathname;
}

export function mapDispatchCoordinatorPathToPortal(pathname: string): string {
    if (pathname === DISPATCH_COORDINATOR_PORTAL_BASE) {
        return PORTAL_BASE;
    }

    if (pathname.startsWith(`${DISPATCH_COORDINATOR_PORTAL_BASE}/`)) {
        return `${PORTAL_BASE}${pathname.slice(DISPATCH_COORDINATOR_PORTAL_BASE.length)}`;
    }

    return pathname;
}

export function mapAccountsManagerPathToPortal(pathname: string): string {
    if (pathname === ACCOUNTS_MANAGER_PORTAL_BASE || pathname === ACCOUNTS_MANAGER_PORTAL_ALIAS_BASE) {
        return PORTAL_BASE;
    }

    if (pathname.startsWith(`${ACCOUNTS_MANAGER_PORTAL_BASE}/`)) {
        return `${PORTAL_BASE}${pathname.slice(ACCOUNTS_MANAGER_PORTAL_BASE.length)}`;
    }

    if (pathname.startsWith(`${ACCOUNTS_MANAGER_PORTAL_ALIAS_BASE}/`)) {
        return `${PORTAL_BASE}${pathname.slice(ACCOUNTS_MANAGER_PORTAL_ALIAS_BASE.length)}`;
    }

    return pathname;
}

export function mapExecutivePathToPortal(pathname: string): string {
    if (pathname === EXECUTIVE_MANAGER_PORTAL_BASE) {
        return PORTAL_BASE;
    }

    if (pathname.startsWith(`${EXECUTIVE_MANAGER_PORTAL_BASE}/`)) {
        return `${PORTAL_BASE}${pathname.slice(EXECUTIVE_MANAGER_PORTAL_BASE.length)}`;
    }

    return pathname;
}

export function mapAdminPathToPortal(pathname: string): string {
    if (pathname === ADMIN_PORTAL_BASE) {
        return PORTAL_BASE;
    }

    if (pathname.startsWith(`${ADMIN_PORTAL_BASE}/`)) {
        return `${PORTAL_BASE}${pathname.slice(ADMIN_PORTAL_BASE.length)}`;
    }

    return pathname;
}

export function mapAssessorPathToPortal(pathname: string): string {
    if (pathname === ASSESSOR_PORTAL_BASE) {
        return PORTAL_BASE;
    }

    if (pathname.startsWith(`${ASSESSOR_PORTAL_BASE}/`)) {
        return `${PORTAL_BASE}${pathname.slice(ASSESSOR_PORTAL_BASE.length)}`;
    }

    if (pathname === ASSESSOR_BASE) {
        return PORTAL_BASE;
    }

    if (pathname.startsWith(`${ASSESSOR_BASE}/`)) {
        return `${PORTAL_BASE}${pathname.slice(ASSESSOR_BASE.length)}`;
    }

    return pathname;
}

export function mapPortalPathToAgent(pathname: string): string {
    if (pathname === AGENT_PORTAL_BASE || pathname === AGENT_PORTAL_ALIAS_BASE) {
        return AGENT_BASE;
    }

    if (pathname.startsWith(`${AGENT_PORTAL_BASE}/`)) {
        return `${AGENT_BASE}${pathname.slice(AGENT_PORTAL_BASE.length)}`;
    }

    if (pathname.startsWith(`${AGENT_PORTAL_ALIAS_BASE}/`)) {
        return `${AGENT_BASE}${pathname.slice(AGENT_PORTAL_ALIAS_BASE.length)}`;
    }

    return pathname;
}

export function mapAgentPathToPortal(pathname: string): string {
    if (pathname === AGENT_BASE) {
        return AGENT_PORTAL_BASE;
    }

    if (pathname.startsWith(`${AGENT_BASE}/`)) {
        return `${AGENT_PORTAL_BASE}${pathname.slice(AGENT_BASE.length)}`;
    }

    return pathname;
}

export function applyPortalRouteBase(url: string, routeBase: string): string {
    if (url === PORTAL_BASE) {
        return routeBase;
    }

    if (url.startsWith(`${PORTAL_BASE}/`)) {
        return `${routeBase}${url.slice(PORTAL_BASE.length)}`;
    }

    return url;
}

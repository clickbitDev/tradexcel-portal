import { createServerClient } from '@/lib/supabase/server';
import { Profile, Partner, UserRole } from '@/types/database';

/**
 * Get the current user's profile
 */
export async function getProfile(): Promise<Profile | null> {
    const supabase = await createServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    return profile;
}

/**
 * Get the partner record linked to the current user
 */
export async function getPartner(): Promise<Partner | null> {
    const supabase = await createServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: partner } = await supabase
        .from('partners')
        .select('*')
        .eq('user_id', user.id)
        .single();

    return partner;
}

/**
 * Check if the current user is an agent
 */
export async function isAgent(): Promise<boolean> {
    const profile = await getProfile();
    const accountStatus = profile?.account_status || 'active';
    return profile?.role === 'agent' && accountStatus === 'active';
}

/**
 * Check if user has staff-level access (all internal roles except agent)
 */
export async function isStaff(): Promise<boolean> {
    const profile = await getProfile();
    if (!profile) return false;
    const accountStatus = profile.account_status || 'active';
    if (accountStatus !== 'active') return false;
    const staffRoles: UserRole[] = [
        'ceo', 'executive_manager', 'admin', 'accounts_manager',
        'assessor', 'dispatch_coordinator', 'frontdesk', 'developer'
    ];
    return staffRoles.includes(profile.role);
}

/**
 * Server-side guard for agent routes - redirects if not an agent
 */
export async function requireAgent(): Promise<{ profile: Profile; partner: Partner | null }> {
    const profile = await getProfile();

    if (!profile) {
        throw new Error('Not authenticated');
    }

    const accountStatus = profile.account_status || 'active';

    if (accountStatus !== 'active') {
        throw new Error('Access denied: Account is disabled');
    }

    if (profile.role !== 'agent') {
        throw new Error('Access denied: Agent role required');
    }

    const partner = await getPartner();

    return { profile, partner };
}

/**
 * Server-side guard for staff routes - redirects if not staff
 */
export async function requireStaff(): Promise<{ profile: Profile }> {
    const profile = await getProfile();

    if (!profile) {
        throw new Error('Not authenticated');
    }

    const accountStatus = profile.account_status || 'active';

    if (accountStatus !== 'active') {
        throw new Error('Access denied: Account is disabled');
    }

    const staffRoles: UserRole[] = [
        'ceo', 'executive_manager', 'admin', 'accounts_manager',
        'assessor', 'dispatch_coordinator', 'frontdesk', 'developer'
    ];
    if (!staffRoles.includes(profile.role)) {
        throw new Error('Access denied: Staff role required');
    }

    return { profile };
}

/**
 * Server-side guard for assessor routes - redirects if not an assessor
 */
export async function requireAssessor(): Promise<{ profile: Profile }> {
    const profile = await getProfile();

    if (!profile) {
        throw new Error('Not authenticated');
    }

    const accountStatus = profile.account_status || 'active';

    if (accountStatus !== 'active') {
        throw new Error('Access denied: Account is disabled');
    }

    if (profile.role !== 'assessor') {
        throw new Error('Access denied: Assessor role required');
    }

    return { profile };
}

/**
 * Check if user has specific role
 */
export async function hasRole(roles: UserRole[]): Promise<boolean> {
    const profile = await getProfile();
    if (!profile) return false;
    const accountStatus = profile.account_status || 'active';
    if (accountStatus !== 'active') return false;
    return roles.includes(profile.role);
}

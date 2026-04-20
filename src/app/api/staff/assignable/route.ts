import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { NON_DELETED_PROFILE_FILTER } from '@/lib/staff/profile-filters';
import type { UserRole } from '@/types/database';

const ASSIGNABLE_STAFF_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'developer',
];

type AssignableStaffRow = {
    id: string;
    full_name: string | null;
    role: UserRole;
};

export async function GET(request: NextRequest) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'staff_account',
        allowedRoles: ASSIGNABLE_STAFF_ROLES,
    });

    if (!authz.ok) {
        return authz.response;
    }

    const withStatus = await authz.context.supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ASSIGNABLE_STAFF_ROLES)
        .eq('account_status', 'active')
        .or(NON_DELETED_PROFILE_FILTER)
        .order('full_name', { ascending: true });

    if (!withStatus.error) {
        return NextResponse.json({
            data: (withStatus.data || []) as AssignableStaffRow[],
        });
    }

    const fallback = await authz.context.supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ASSIGNABLE_STAFF_ROLES)
        .or(NON_DELETED_PROFILE_FILTER)
        .order('full_name', { ascending: true });

    if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    }

    return NextResponse.json({
        data: (fallback.data || []) as AssignableStaffRow[],
    });
}

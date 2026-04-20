import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { AGENT_PARTNER_TYPES } from '@/lib/partners/constants';
import type { UserRole } from '@/types/database';

const STAFF_PORTAL_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'developer',
];

type AgentPartnerOptionRow = {
    id: string;
    company_name: string;
    contact_name: string | null;
    email: string | null;
    type: 'agent' | 'subagent';
};

export async function GET(request: NextRequest) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'create',
        allowedRoles: STAFF_PORTAL_ROLES,
    });

    if (!authz.ok) {
        return authz.response;
    }

    let queryClient:
        | typeof authz.context.supabase
        | ReturnType<typeof createAdminServerClient> = authz.context.supabase;

    try {
        queryClient = createAdminServerClient();
    } catch {
        queryClient = authz.context.supabase;
    }

    const { data, error } = await queryClient
        .from('partners')
        .select('id, company_name, contact_name, email, type')
        .eq('status', 'active')
        .in('type', AGENT_PARTNER_TYPES)
        .order('company_name', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message || 'Failed to load agent partners' }, { status: 500 });
    }

    return NextResponse.json({
        data: (data || []) as AgentPartnerOptionRow[],
    });
}

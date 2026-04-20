import { NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient, createServerClient } from '@/lib/supabase/server';

const STAFF_ROLES = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'developer',
] as const;

type SoftDeleteAction = 'delete' | 'restore';

type SoftDeleteBody = {
    action?: SoftDeleteAction;
};

async function restoreRelatedRecords(applicationId: string) {
    const adminClient = createAdminServerClient();

    const restoreOperations = [
        async () => adminClient
            .from('documents')
            .update({ is_deleted: false, deleted_at: null, deleted_by: null })
            .eq('application_id', applicationId),
        async () => adminClient
            .from('invoices')
            .update({ is_deleted: false, deleted_at: null, deleted_by: null })
            .eq('application_id', applicationId),
        async () => adminClient
            .from('bills')
            .update({ is_deleted: false, deleted_at: null, deleted_by: null })
            .eq('application_id', applicationId),
    ];

    const results = await Promise.allSettled(restoreOperations.map((operation) => operation()));

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error('Failed to restore related application records:', {
                applicationId,
                target: ['documents', 'invoices', 'bills'][index],
                error: result.reason,
            });
        }
    });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single<{ role: string }>();

    if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
    }

    if (!STAFF_ROLES.includes(profile.role as typeof STAFF_ROLES[number])) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    let body: SoftDeleteBody = {};
    try {
        body = await request.json() as SoftDeleteBody;
    } catch {
        body = {};
    }

    const action = body.action ?? 'delete';

    let adminClient: ReturnType<typeof createAdminServerClient>;
    try {
        adminClient = createAdminServerClient();
    } catch {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (action === 'restore') {
        const { data, error } = await adminClient
            .from('applications')
            .update({
                is_deleted: false,
                deleted_at: null,
                deleted_by: null,
            })
            .eq('id', id)
            .select('id');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ error: 'Application not found' }, { status: 404 });
        }

        await restoreRelatedRecords(id);

        return NextResponse.json({ success: true, action: 'restored' });
    }

    const { data, error } = await adminClient
        .from('applications')
        .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: user.id,
        })
        .eq('id', id)
        .select('id');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
        return NextResponse.json({ error: 'Application not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({ success: true, action: 'deleted' });
}

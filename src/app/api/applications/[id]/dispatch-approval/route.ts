import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient, createServerClient } from '@/lib/supabase/server';
import { insertApplicationHistory } from '@/lib/workflow/history';
import { NON_DELETED_PROFILE_FILTER, isActiveProfile } from '@/lib/staff/profile-filters';

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

const RequestDispatchApprovalSchema = z.object({
    expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
});

const ApproveDispatchApprovalSchema = z.object({
    expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
});

interface DispatchApprovalApplicationRow {
    id: string;
    workflow_stage: 'docs_review' | 'enrolled' | 'evaluate' | 'accounts' | 'dispatch' | 'completed' | 'TRANSFERRED';
    updated_at: string;
    assessment_result: 'pending' | 'pass' | 'failed';
    payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded' | 'waived';
    xero_invoice_id: string | null;
    xero_bill_id: string | null;
    dispatch_approval_requested_at: string | null;
    dispatch_approval_requested_by: string | null;
    dispatch_approval_approved_at: string | null;
    dispatch_approval_approved_by: string | null;
    dispatch_override_used: boolean | null;
    student_uid: string;
    student_first_name: string | null;
    student_last_name: string | null;
}

interface ReviewerRow {
    id: string;
    full_name: string | null;
    account_status?: string | null;
    is_deleted?: boolean | null;
}

async function getAdminCapableClient(fallback: ServerSupabaseClient): Promise<ServerSupabaseClient> {
    try {
        return createAdminServerClient() as unknown as ServerSupabaseClient;
    } catch {
        return fallback;
    }
}

function buildStudentName(application: DispatchApprovalApplicationRow): string {
    return `${application.student_first_name || ''} ${application.student_last_name || ''}`.trim() || 'Student';
}

function normalizeApprovalState(application: DispatchApprovalApplicationRow) {
    return {
        updated_at: application.updated_at,
        dispatch_approval_requested_at: application.dispatch_approval_requested_at,
        dispatch_approval_requested_by: application.dispatch_approval_requested_by,
        dispatch_approval_approved_at: application.dispatch_approval_approved_at,
        dispatch_approval_approved_by: application.dispatch_approval_approved_by,
        dispatch_override_used: Boolean(application.dispatch_override_used),
    };
}

function hasDispatchApproval(application: DispatchApprovalApplicationRow): boolean {
    return Boolean(application.dispatch_approval_approved_at && application.dispatch_approval_approved_by);
}

async function getActiveProfilesByRoles(
    supabase: ServerSupabaseClient,
    roles: Array<'ceo' | 'developer' | 'accounts_manager'>
): Promise<ReviewerRow[]> {
    const withStatus = await supabase
        .from('profiles')
        .select('id, full_name, account_status, is_deleted')
        .in('role', roles)
        .or(NON_DELETED_PROFILE_FILTER)
        .returns<ReviewerRow[]>();

    if (!withStatus.error) {
        return (withStatus.data || []).filter((profile) => (profile.account_status || 'active') !== 'disabled' && isActiveProfile(profile));
    }

    const fallback = await supabase
        .from('profiles')
        .select('id, full_name, is_deleted')
        .in('role', roles)
        .or(NON_DELETED_PROFILE_FILTER)
        .returns<ReviewerRow[]>();

    return (fallback.data || []).filter(isActiveProfile);
}

async function notifyUsers(input: {
    supabase: ServerSupabaseClient;
    userIds: string[];
    applicationId: string;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
}) {
    if (input.userIds.length === 0) {
        return;
    }

    const notifications = input.userIds.map((userId) => ({
        user_id: userId,
        type: 'system_alert',
        title: input.title,
        message: input.message,
        related_table: 'applications',
        related_id: input.applicationId,
        priority: 'high',
        metadata: input.metadata,
    }));

    const result = await input.supabase.from('notifications').insert(notifications);
    if (result.error) {
        console.warn('Dispatch approval notification insert failed:', result.error.message);
    }
}

async function loadApplication(
    supabase: ServerSupabaseClient,
    applicationId: string
): Promise<DispatchApprovalApplicationRow | null> {
    const { data, error } = await supabase
        .from('applications')
        .select('id, workflow_stage, updated_at, assessment_result, payment_status, xero_invoice_id, xero_bill_id, dispatch_approval_requested_at, dispatch_approval_requested_by, dispatch_approval_approved_at, dispatch_approval_approved_by, dispatch_override_used, student_uid, student_first_name, student_last_name')
        .eq('id', applicationId)
        .maybeSingle<DispatchApprovalApplicationRow>();

    if (error || !data) {
        return null;
    }

    return data;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        applicationId: id,
        allowedRoles: ['accounts_manager'],
    });

    if (!authz.ok) {
        return authz.response;
    }

    const parsedBody = RequestDispatchApprovalSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json({ error: 'Invalid dispatch approval payload', details: parsedBody.error.issues }, { status: 400 });
    }

    const supabase = await getAdminCapableClient(authz.context.supabase);
    const application = await loadApplication(supabase, id);
    if (!application) {
        return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    }

    if (parsedBody.data.expectedUpdatedAt && parsedBody.data.expectedUpdatedAt !== application.updated_at) {
        return NextResponse.json({ error: 'This application was updated by another user. Refresh and try again.', currentUpdatedAt: application.updated_at }, { status: 409 });
    }

    if (application.workflow_stage !== 'accounts' || application.assessment_result !== 'pass') {
        return NextResponse.json({ error: 'Dispatch approval can only be requested for passed Accounts applications.' }, { status: 409 });
    }

    if (!application.xero_invoice_id || !application.xero_bill_id) {
        return NextResponse.json({ error: 'Create both the Xero invoice and Xero bill before requesting dispatch approval.' }, { status: 409 });
    }

    if (application.payment_status === 'paid') {
        return NextResponse.json({ error: 'Dispatch approval is only needed when payment is not cleared.' }, { status: 409 });
    }

    if (hasDispatchApproval(application)) {
        return NextResponse.json({ data: { application: normalizeApprovalState(application) } });
    }

    if (application.dispatch_approval_requested_at) {
        return NextResponse.json({ data: { application: normalizeApprovalState(application) } });
    }

    const requestedAt = new Date().toISOString();
    const { data: updatedApplication, error: updateError } = await supabase
        .from('applications')
        .update({
            dispatch_approval_requested_at: requestedAt,
            dispatch_approval_requested_by: authz.context.userId,
            dispatch_approval_approved_at: null,
            dispatch_approval_approved_by: null,
            last_updated_by: authz.context.userId,
            updated_at: requestedAt,
        })
        .eq('id', id)
        .select('id, workflow_stage, updated_at, assessment_result, payment_status, xero_invoice_id, xero_bill_id, dispatch_approval_requested_at, dispatch_approval_requested_by, dispatch_approval_approved_at, dispatch_approval_approved_by, dispatch_override_used, student_uid, student_first_name, student_last_name')
        .single<DispatchApprovalApplicationRow>();

    if (updateError || !updatedApplication) {
        return NextResponse.json({ error: updateError?.message || 'Unable to request dispatch approval right now.' }, { status: 500 });
    }

    await insertApplicationHistory(supabase, {
        applicationId: id,
        action: 'updated',
        fieldChanged: 'dispatch_approval',
        oldValue: null,
        newValue: 'pending',
        userId: authz.context.userId,
        metadata: {
            source: 'api.applications.dispatch-approval',
            status: 'pending',
        },
        toStage: updatedApplication.workflow_stage,
        notes: 'Accounts manager requested CEO/Developer dispatch approval',
    });

    const reviewers = await getActiveProfilesByRoles(supabase, ['ceo', 'developer']);
    await notifyUsers({
        supabase,
        userIds: reviewers.map((reviewer) => reviewer.id).filter((userId) => userId !== authz.context.userId),
        applicationId: id,
        title: 'Need approval for dispatch',
        message: `${buildStudentName(updatedApplication)} (${updatedApplication.student_uid}) needs approval to move from Accounts to Dispatch.`,
        metadata: {
            source: 'api.applications.dispatch-approval',
            status: 'pending',
        },
    });

    return NextResponse.json({ data: { application: normalizeApprovalState(updatedApplication) } }, { status: 201 });
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        applicationId: id,
        allowedRoles: ['ceo', 'developer'],
    });

    if (!authz.ok) {
        return authz.response;
    }

    const parsedBody = ApproveDispatchApprovalSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json({ error: 'Invalid dispatch approval payload', details: parsedBody.error.issues }, { status: 400 });
    }

    const supabase = await getAdminCapableClient(authz.context.supabase);
    const application = await loadApplication(supabase, id);
    if (!application) {
        return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    }

    if (parsedBody.data.expectedUpdatedAt && parsedBody.data.expectedUpdatedAt !== application.updated_at) {
        return NextResponse.json({ error: 'This application was updated by another user. Refresh and try again.', currentUpdatedAt: application.updated_at }, { status: 409 });
    }

    if (application.workflow_stage !== 'accounts' || application.assessment_result !== 'pass') {
        return NextResponse.json({ error: 'Dispatch approval can only be granted for passed Accounts applications.' }, { status: 409 });
    }

    if (!application.xero_invoice_id || !application.xero_bill_id) {
        return NextResponse.json({ error: 'Create both the Xero invoice and Xero bill before approving dispatch.' }, { status: 409 });
    }

    if (application.payment_status === 'paid') {
        return NextResponse.json({ error: 'Dispatch approval is no longer required because payment is already cleared.' }, { status: 409 });
    }

    if (!application.dispatch_approval_requested_at) {
        return NextResponse.json({ error: 'Dispatch approval has not been requested yet.' }, { status: 409 });
    }

    if (hasDispatchApproval(application)) {
        return NextResponse.json({ data: { application: normalizeApprovalState(application) } });
    }

    const approvedAt = new Date().toISOString();
    const { data: updatedApplication, error: updateError } = await supabase
        .from('applications')
        .update({
            dispatch_approval_approved_at: approvedAt,
            dispatch_approval_approved_by: authz.context.userId,
            last_updated_by: authz.context.userId,
            updated_at: approvedAt,
        })
        .eq('id', id)
        .select('id, workflow_stage, updated_at, assessment_result, payment_status, xero_invoice_id, xero_bill_id, dispatch_approval_requested_at, dispatch_approval_requested_by, dispatch_approval_approved_at, dispatch_approval_approved_by, dispatch_override_used, student_uid, student_first_name, student_last_name')
        .single<DispatchApprovalApplicationRow>();

    if (updateError || !updatedApplication) {
        return NextResponse.json({ error: updateError?.message || 'Unable to approve dispatch right now.' }, { status: 500 });
    }

    await insertApplicationHistory(supabase, {
        applicationId: id,
        action: 'updated',
        fieldChanged: 'dispatch_approval',
        oldValue: 'pending',
        newValue: 'approved',
        userId: authz.context.userId,
        metadata: {
            source: 'api.applications.dispatch-approval',
            status: 'approved',
        },
        toStage: updatedApplication.workflow_stage,
        notes: 'CEO/Developer approved dispatch before payment was cleared',
    });

    const accountsManagers = await getActiveProfilesByRoles(supabase, ['accounts_manager']);
    await notifyUsers({
        supabase,
        userIds: accountsManagers.map((profile) => profile.id),
        applicationId: id,
        title: 'Dispatch approved',
        message: `${buildStudentName(updatedApplication)} (${updatedApplication.student_uid}) has been approved for Dispatch.`,
        metadata: {
            source: 'api.applications.dispatch-approval',
            status: 'approved',
        },
    });

    return NextResponse.json({ data: { application: normalizeApprovalState(updatedApplication) } });
}

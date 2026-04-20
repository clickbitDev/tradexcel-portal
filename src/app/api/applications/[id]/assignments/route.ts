import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { insertApplicationHistory } from '@/lib/workflow/history';
import { getUserFriendlyWorkflowError } from '@/lib/workflow/error-messages';
import type { WorkflowStage } from '@/types/database';

type WorkflowAssignmentRow = {
    id: string;
    application_id: string;
    stage: WorkflowStage;
    assignee_id: string;
    assigned_by: string | null;
    is_active: boolean;
    assigned_at: string;
    unassigned_at: string | null;
    metadata: Record<string, unknown> | null;
};

type WorkflowAssignmentResponseRow = WorkflowAssignmentRow & {
    assignee: {
        id: string;
        full_name: string | null;
        role: string | null;
    } | null;
    assigned_by_profile: {
        id: string;
        full_name: string | null;
    } | null;
};

type ProfileSummary = {
    id: string;
    full_name: string | null;
    role: string | null;
};

const WORKFLOW_STAGES = [
    'TRANSFERRED',
    'docs_review',
    'enrolled',
    'evaluate',
    'accounts',
    'dispatch',
    'completed',
] as const;

const CreateAssignmentSchema = z.object({
    stage: z.enum(WORKFLOW_STAGES),
    assigneeId: z.string().uuid(),
    notes: z.string().trim().max(500).optional(),
});

function getApplicationAssigneeUpdate(stage: WorkflowStage, assigneeId: string, actorId: string) {
    const stageForAdmin: WorkflowStage[] = ['TRANSFERRED', 'docs_review'];
    const stageForAssessor: WorkflowStage[] = ['enrolled', 'evaluate'];

    if (stageForAdmin.includes(stage)) {
        return {
            assigned_admin_id: assigneeId,
            assigned_by: actorId,
            assigned_at: new Date().toISOString(),
            last_updated_by: actorId,
        };
    }

    if (stageForAssessor.includes(stage)) {
        return {
            assigned_assessor_id: assigneeId,
            assigned_by: actorId,
            assigned_at: new Date().toISOString(),
            last_updated_by: actorId,
        };
    }

    return {
        assigned_staff_id: assigneeId,
        assigned_by: actorId,
        assigned_at: new Date().toISOString(),
        last_updated_by: actorId,
    };
}

async function hydrateAssignments(
    supabase: Parameters<typeof insertApplicationHistory>[0],
    rows: WorkflowAssignmentRow[]
): Promise<WorkflowAssignmentResponseRow[]> {
    const profileIds = [...new Set(rows.flatMap((row) => [row.assignee_id, row.assigned_by].filter(Boolean) as string[]))];

    const { data: profiles, error: profilesError } = profileIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name, role')
            .in('id', profileIds)
            .returns<ProfileSummary[]>()
        : { data: [] as ProfileSummary[], error: null };

    if (profilesError) {
        throw new Error(profilesError.message);
    }

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

    return rows.map((row) => ({
        ...row,
        assignee: profileMap.get(row.assignee_id) || null,
        assigned_by_profile: row.assigned_by ? profileMap.get(row.assigned_by) || null : null,
    }));
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'view',
        applicationId: id,
    });

    if (!authz.ok) {
        return authz.response;
    }

    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';

    let query = authz.context.supabase
        .from('workflow_assignments')
        .select('id, application_id, stage, assignee_id, assigned_by, is_active, assigned_at, unassigned_at, metadata')
        .eq('application_id', id)
        .order('assigned_at', { ascending: false });

    if (!includeInactive) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_ASSIGNMENTS_LOAD_FAILED',
                    message: error.message,
                    fallback: 'Unable to load stage assignments right now. Please try again.',
                }),
                code: 'WORKFLOW_ASSIGNMENTS_LOAD_FAILED',
            },
            { status: 500 }
        );
    }

    try {
        const hydrated = await hydrateAssignments(
            authz.context.supabase,
            (data || []) as WorkflowAssignmentRow[]
        );

        return NextResponse.json({ data: hydrated });
    } catch (error) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_ASSIGNMENTS_LOAD_FAILED',
                    message: error instanceof Error ? error.message : 'Failed to hydrate assignments',
                    fallback: 'Unable to load stage assignments right now. Please try again.',
                }),
                code: 'WORKFLOW_ASSIGNMENTS_LOAD_FAILED',
            },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'assign',
        applicationId: id,
    });

    if (!authz.ok) {
        return authz.response;
    }

    const parsedBody = CreateAssignmentSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: 'Invalid assignment payload',
                details: parsedBody.error.issues,
            },
            { status: 400 }
        );
    }

    const { stage, assigneeId, notes } = parsedBody.data;
    let mutationClient = authz.context.supabase;

    try {
        mutationClient = createAdminServerClient() as typeof authz.context.supabase;
    } catch {
        mutationClient = authz.context.supabase;
    }

    const { data: assigneeWithStatus, error: assigneeWithStatusError } = await mutationClient
        .from('profiles')
        .select('id, role, account_status, is_deleted')
        .eq('id', assigneeId)
        .maybeSingle<{ id: string; role: string | null; account_status: string | null; is_deleted: boolean | null }>();

    const assigneeProfile = assigneeWithStatusError && assigneeWithStatusError.message?.includes('account_status')
        ? await mutationClient
            .from('profiles')
            .select('id, role, is_deleted')
            .eq('id', assigneeId)
            .maybeSingle<{ id: string; role: string | null; is_deleted: boolean | null }>()
        : {
            data: assigneeWithStatus,
            error: assigneeWithStatusError,
        };

    if (assigneeProfile.error || !assigneeProfile.data) {
        return NextResponse.json(
            {
                error: 'Selected assignee is invalid.',
            },
            { status: 400 }
        );
    }

    if ('account_status' in assigneeProfile.data && assigneeProfile.data.account_status === 'disabled') {
        return NextResponse.json(
            {
                error: 'Selected assignee is inactive.',
            },
            { status: 400 }
        );
    }

    if ('is_deleted' in assigneeProfile.data && assigneeProfile.data.is_deleted === true) {
        return NextResponse.json(
            {
                error: 'Selected assignee is deleted.',
            },
            { status: 400 }
        );
    }

    const currentWorkflowStage = authz.context.application?.legacyStage || null;

    if (authz.context.role === 'executive_manager' && currentWorkflowStage === 'docs_review') {
        if (stage !== 'docs_review') {
            return NextResponse.json(
                {
                    error: 'When an application is in Docs Review, Executive Managers can only assign the Docs Review stage.',
                },
                { status: 403 }
            );
        }

        if (assigneeProfile.data.role !== 'admin') {
            return NextResponse.json(
                {
                    error: 'When an application is in Docs Review, Executive Managers can only assign an admin.',
                },
                { status: 403 }
            );
        }
    }

    const { data: existingAssignment, error: existingAssignmentError } = await mutationClient
        .from('workflow_assignments')
        .select('id')
        .eq('application_id', id)
        .eq('stage', stage)
        .eq('assignee_id', assigneeId)
        .eq('is_active', true)
        .maybeSingle<{ id: string }>();

    if (existingAssignmentError) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_ASSIGNMENT_CREATE_FAILED',
                    message: existingAssignmentError.message,
                    fallback: 'Unable to prepare stage assignment right now. Please try again.',
                }),
                code: 'WORKFLOW_ASSIGNMENT_CREATE_FAILED',
            },
            { status: 500 }
        );
    }

    if (existingAssignment) {
        return NextResponse.json({ data: existingAssignment });
    }

    const deactivateResult = await mutationClient
        .from('workflow_assignments')
        .update({
            is_active: false,
            unassigned_at: new Date().toISOString(),
        })
        .eq('application_id', id)
        .eq('stage', stage)
        .eq('is_active', true)
        .neq('assignee_id', assigneeId);

    if (deactivateResult.error) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_ASSIGNMENT_UPDATE_FAILED',
                    message: deactivateResult.error.message,
                    fallback: 'Unable to update the previous stage assignment right now. Please try again.',
                }),
                code: 'WORKFLOW_ASSIGNMENT_UPDATE_FAILED',
            },
            { status: 500 }
        );
    }

    const { data: assignment, error: assignmentError } = await mutationClient
        .from('workflow_assignments')
        .insert({
            application_id: id,
            stage,
            assignee_id: assigneeId,
            assigned_by: authz.context.userId,
            is_active: true,
            metadata: {
                notes: notes || null,
                source: 'api.workflow.assignments',
            },
        })
        .select('id, application_id, stage, assignee_id, assigned_by, is_active, assigned_at, unassigned_at, metadata')
        .single<WorkflowAssignmentRow>();

    if (assignmentError || !assignment) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_ASSIGNMENT_CREATE_FAILED',
                    message: assignmentError?.message || 'Failed to create assignment',
                    fallback: 'Unable to create this stage assignment right now. Please try again.',
                }),
                code: 'WORKFLOW_ASSIGNMENT_CREATE_FAILED',
            },
            { status: 500 }
        );
    }

    const applicationUpdate = getApplicationAssigneeUpdate(stage, assigneeId, authz.context.userId);
    const { error: updateApplicationError } = await mutationClient
        .from('applications')
        .update(applicationUpdate)
        .eq('id', id);

    if (updateApplicationError) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_ASSIGNMENT_UPDATE_FAILED',
                    message: updateApplicationError.message,
                    fallback: 'Assignment was created, but the application owner could not be updated right now.',
                }),
                code: 'WORKFLOW_ASSIGNMENT_UPDATE_FAILED',
            },
            { status: 500 }
        );
    }

    await insertApplicationHistory(mutationClient as never, {
        applicationId: id,
        action: 'assigned',
        fieldChanged: 'workflow_assignment',
        oldValue: null,
        newValue: `Assigned ${stage} to ${assigneeId}`,
        userId: authz.context.userId,
        metadata: {
            stage,
            assigneeId,
            notes: notes || null,
            source: 'api.workflow.assignments',
        },
        toStage: stage,
        notes: notes || null,
    });

    if (assigneeId !== authz.context.userId) {
        const notificationResult = await mutationClient
            .from('notifications')
            .insert({
                user_id: assigneeId,
                type: 'assignment',
                title: 'Application assigned to you',
                message: `You were assigned to ${stage.replace(/_/g, ' ')}`,
                related_table: 'applications',
                related_id: id,
                priority: 'normal',
                metadata: {
                    stage,
                    assigned_by: authz.context.userId,
                },
            });

        if (notificationResult.error) {
            console.warn('Assignment notification insert failed:', notificationResult.error.message);
        }
    }

    const [hydratedAssignment] = await hydrateAssignments(mutationClient, [assignment]);

    return NextResponse.json({ data: hydratedAssignment }, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { insertApplicationHistory } from '@/lib/workflow/history';
import { getUserFriendlyWorkflowError } from '@/lib/workflow/error-messages';
import type { WorkflowStage } from '@/types/database';

const UpdateAssignmentSchema = z.object({
    isActive: z.boolean(),
});

function getApplicationAssigneeField(stage: WorkflowStage): 'assigned_admin_id' | 'assigned_assessor_id' | 'assigned_staff_id' {
    if (stage === 'TRANSFERRED' || stage === 'docs_review') {
        return 'assigned_admin_id';
    }

    if (stage === 'enrolled' || stage === 'evaluate') {
        return 'assigned_assessor_id';
    }

    return 'assigned_staff_id';
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
    const { id, assignmentId } = await params;

    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'assign',
        applicationId: id,
    });

    if (!authz.ok) {
        return authz.response;
    }

    const parsedBody = UpdateAssignmentSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: 'Invalid assignment update payload',
                details: parsedBody.error.issues,
            },
            { status: 400 }
        );
    }

    const { isActive } = parsedBody.data;

    const { data: existingAssignment, error: existingAssignmentLookupError } = await authz.context.supabase
        .from('workflow_assignments')
        .select('id, stage, assignee_id')
        .eq('id', assignmentId)
        .eq('application_id', id)
        .maybeSingle<{ id: string; stage: WorkflowStage; assignee_id: string }>();

    if (existingAssignmentLookupError) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_ASSIGNMENTS_LOAD_FAILED',
                    message: existingAssignmentLookupError.message,
                    fallback: 'Unable to load this assignment right now. Please try again.',
                }),
                code: 'WORKFLOW_ASSIGNMENTS_LOAD_FAILED',
            },
            { status: 500 }
        );
    }

    if (!existingAssignment) {
        return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const currentWorkflowStage = authz.context.application?.legacyStage || null;

    if (isActive && authz.context.role === 'executive_manager' && currentWorkflowStage === 'docs_review') {
        if (existingAssignment.stage !== 'docs_review') {
            return NextResponse.json(
                {
                    error: 'When an application is in Docs Review, Executive Managers can only activate Docs Review assignments.',
                },
                { status: 403 }
            );
        }

        const { data: assigneeProfile, error: assigneeLookupError } = await authz.context.supabase
            .from('profiles')
            .select('role')
            .eq('id', existingAssignment.assignee_id)
            .maybeSingle<{ role: string | null }>();

        if (assigneeLookupError || assigneeProfile?.role !== 'admin') {
            return NextResponse.json(
                {
                    error: 'When an application is in Docs Review, Executive Managers can only assign an admin.',
                },
                { status: 403 }
            );
        }
    }

    if (isActive) {
        const deactivateOthers = await authz.context.supabase
            .from('workflow_assignments')
            .update({
                is_active: false,
                unassigned_at: new Date().toISOString(),
            })
            .eq('application_id', id)
            .eq('is_active', true)
            .neq('id', assignmentId);

        if (deactivateOthers.error) {
            return NextResponse.json(
                {
                    error: getUserFriendlyWorkflowError({
                        code: 'WORKFLOW_ASSIGNMENT_UPDATE_FAILED',
                        message: deactivateOthers.error.message,
                        fallback: 'Unable to update existing stage assignments right now. Please try again.',
                    }),
                    code: 'WORKFLOW_ASSIGNMENT_UPDATE_FAILED',
                },
                { status: 500 }
            );
        }
    }

    const { data: assignment, error } = await authz.context.supabase
        .from('workflow_assignments')
        .update({
            is_active: isActive,
            unassigned_at: isActive ? null : new Date().toISOString(),
        })
        .eq('id', assignmentId)
        .eq('application_id', id)
        .select('id, application_id, stage, assignee_id, assigned_by, is_active, assigned_at, unassigned_at, metadata, assignee:profiles!workflow_assignments_assignee_id_fkey(id, full_name, role), assigned_by_profile:profiles!workflow_assignments_assigned_by_fkey(id, full_name)')
        .single();

    if (error || !assignment) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_ASSIGNMENT_UPDATE_FAILED',
                    message: error?.message || 'Failed to update assignment',
                    fallback: 'Unable to update this stage assignment right now. Please try again.',
                }),
                code: 'WORKFLOW_ASSIGNMENT_UPDATE_FAILED',
            },
            { status: 500 }
        );
    }

    const stage = assignment.stage as WorkflowStage;
    const assigneeField = getApplicationAssigneeField(stage);

    const { data: activeStageAssignment, error: activeLookupError } = await authz.context.supabase
        .from('workflow_assignments')
        .select('assignee_id')
        .eq('application_id', id)
        .eq('stage', stage)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ assignee_id: string }>();

    if (activeLookupError) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_ASSIGNMENTS_LOAD_FAILED',
                    message: activeLookupError.message,
                    fallback: 'Unable to verify current stage assignment right now. Please try again.',
                }),
                code: 'WORKFLOW_ASSIGNMENTS_LOAD_FAILED',
            },
            { status: 500 }
        );
    }

    const { error: appSyncError } = await authz.context.supabase
        .from('applications')
        .update({
            [assigneeField]: activeStageAssignment?.assignee_id || null,
            last_updated_by: authz.context.userId,
        })
        .eq('id', id);

    if (appSyncError) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_ASSIGNMENT_UPDATE_FAILED',
                    message: appSyncError.message,
                    fallback: 'Assignment was updated, but application ownership sync failed. Please try again.',
                }),
                code: 'WORKFLOW_ASSIGNMENT_UPDATE_FAILED',
            },
            { status: 500 }
        );
    }

    await insertApplicationHistory(authz.context.supabase, {
        applicationId: id,
        action: isActive ? 'assigned' : 'unassigned',
        fieldChanged: 'workflow_assignment',
        oldValue: null,
        newValue: `${assignment.stage}:${assignment.assignee_id}:${isActive ? 'active' : 'inactive'}`,
        userId: authz.context.userId,
        metadata: {
            assignment_id: assignmentId,
            source: 'api.workflow.assignments',
        },
        toStage: assignment.stage,
        notes: isActive ? 'Assignment activated' : 'Assignment deactivated',
    });

    return NextResponse.json({ data: assignment });
}

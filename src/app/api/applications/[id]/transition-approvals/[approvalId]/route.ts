import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { insertApplicationHistory } from '@/lib/workflow/history';
import {
    canActorReviewApproval,
    executeWorkflowTransition,
    type WorkflowTransitionApprovalRow,
} from '@/lib/workflow/transition-service';
import { getUserFriendlyWorkflowError } from '@/lib/workflow/error-messages';

const UpdateTransitionApprovalSchema = z.object({
    status: z.enum(['approved', 'rejected', 'cancelled']),
    notes: z.string().trim().max(1000).optional(),
});

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; approvalId: string }> }
) {
    const { id, approvalId } = await params;

    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'verify',
        applicationId: id,
    });

    if (!authz.ok) {
        return authz.response;
    }

    const parsedBody = UpdateTransitionApprovalSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: 'Invalid transition approval update payload',
                details: parsedBody.error.issues,
            },
            { status: 400 }
        );
    }

    const { status, notes } = parsedBody.data;

    const { data: approval, error: approvalError } = await authz.context.supabase
        .from('workflow_transition_approvals')
        .select('id, application_id, from_stage, to_stage, status, required_role, requested_by, requested_at, reviewed_by, reviewed_at, transition_notes, review_notes, executed_at, metadata')
        .eq('id', approvalId)
        .eq('application_id', id)
        .maybeSingle<WorkflowTransitionApprovalRow>();

    if (approvalError) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_APPROVALS_LOAD_FAILED',
                    message: approvalError.message,
                    fallback: 'Unable to load this approval request right now. Please try again.',
                }),
                code: 'WORKFLOW_APPROVALS_LOAD_FAILED',
            },
            { status: 500 }
        );
    }

    if (!approval) {
        return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
    }

    if (approval.status !== 'pending') {
        return NextResponse.json({ error: 'Approval request is no longer pending.' }, { status: 409 });
    }

    if (status === 'cancelled') {
        const canCancel = approval.requested_by === authz.context.userId
            || authz.context.role === 'ceo'
            || authz.context.role === 'executive_manager';

        if (!canCancel) {
            return NextResponse.json({ error: 'Only requester or executive roles can cancel approval requests.' }, { status: 403 });
        }

        const { data: cancelled, error: cancelError } = await authz.context.supabase
            .from('workflow_transition_approvals')
            .update({
                status: 'cancelled',
                reviewed_by: authz.context.userId,
                reviewed_at: new Date().toISOString(),
                review_notes: notes || null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', approvalId)
            .eq('status', 'pending')
            .select('id, application_id, from_stage, to_stage, status, required_role, requested_by, requested_at, reviewed_by, reviewed_at, transition_notes, review_notes, executed_at, metadata')
            .single<WorkflowTransitionApprovalRow>();

        if (cancelError || !cancelled) {
            return NextResponse.json(
                {
                    error: getUserFriendlyWorkflowError({
                        code: 'WORKFLOW_APPROVAL_UPDATE_FAILED',
                        message: cancelError?.message || 'Failed to cancel approval request',
                        fallback: 'Unable to cancel this approval request right now. Please try again.',
                    }),
                    code: 'WORKFLOW_APPROVAL_UPDATE_FAILED',
                },
                { status: 500 }
            );
        }

        await insertApplicationHistory(authz.context.supabase, {
            applicationId: id,
            action: 'updated',
            fieldChanged: 'workflow_transition_approval',
            oldValue: 'pending',
            newValue: 'cancelled',
            userId: authz.context.userId,
            metadata: {
                approval_id: approvalId,
                source: 'api.workflow.transition-approvals',
            },
            fromStage: approval.from_stage,
            toStage: approval.to_stage,
            notes: notes || 'Approval request cancelled',
        });

        return NextResponse.json({ data: cancelled });
    }

    const canReview = canActorReviewApproval(
        authz.context.role,
        approval.required_role,
        authz.context.userId,
        approval.requested_by
    );

    if (!canReview) {
        return NextResponse.json({ error: 'You do not have permission to review this approval request.' }, { status: 403 });
    }

    const { data: reviewed, error: reviewError } = await authz.context.supabase
        .from('workflow_transition_approvals')
        .update({
            status,
            reviewed_by: authz.context.userId,
            reviewed_at: new Date().toISOString(),
            review_notes: notes || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', approvalId)
        .eq('status', 'pending')
        .select('id, application_id, from_stage, to_stage, status, required_role, requested_by, requested_at, reviewed_by, reviewed_at, transition_notes, review_notes, executed_at, metadata')
        .single<WorkflowTransitionApprovalRow>();

    if (reviewError || !reviewed) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_APPROVAL_UPDATE_FAILED',
                    message: reviewError?.message || 'Failed to update approval request',
                    fallback: 'Unable to update this approval request right now. Please try again.',
                }),
                code: 'WORKFLOW_APPROVAL_UPDATE_FAILED',
            },
            { status: 500 }
        );
    }

    if (status === 'rejected') {
        await insertApplicationHistory(authz.context.supabase, {
            applicationId: id,
            action: 'updated',
            fieldChanged: 'workflow_transition_approval',
            oldValue: 'pending',
            newValue: 'rejected',
            userId: authz.context.userId,
            metadata: {
                approval_id: approvalId,
                source: 'api.workflow.transition-approvals',
            },
            fromStage: approval.from_stage,
            toStage: approval.to_stage,
            notes: notes || 'Transition approval rejected',
        });

        return NextResponse.json({ data: reviewed });
    }

    const transitionResult = await executeWorkflowTransition({
        supabase: authz.context.supabase,
        actorId: authz.context.userId,
        actorRole: authz.context.role,
        applicationId: id,
        toStage: approval.to_stage,
        notes: approval.transition_notes || notes,
        approvalId,
    });

    if (!transitionResult.ok) {
        const publicMessage = getUserFriendlyWorkflowError({
            code: transitionResult.code,
            message: transitionResult.message,
            fallback: 'Approval was recorded, but the stage change could not be completed right now.',
        });

        return NextResponse.json(
            {
                error: publicMessage,
                code: transitionResult.code,
                approval: reviewed,
                currentUpdatedAt: transitionResult.currentUpdatedAt,
            },
            { status: transitionResult.status }
        );
    }

    return NextResponse.json({
        data: reviewed,
        transition: transitionResult.data,
    });
}

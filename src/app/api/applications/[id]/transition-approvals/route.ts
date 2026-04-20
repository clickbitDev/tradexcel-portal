import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { insertApplicationHistory } from '@/lib/workflow/history';
import {
    buildTransitionRoleRequirementMessage,
    canActorReviewApproval,
    canActorSatisfyTransitionRule,
    getApplicationWorkflowState,
    getWorkflowTransitionRule,
    type WorkflowTransitionApprovalRow,
} from '@/lib/workflow/transition-service';
import { getUserFriendlyWorkflowError } from '@/lib/workflow/error-messages';
import type { UserRole } from '@/types/database';

const WORKFLOW_STAGES = [
    'TRANSFERRED',
    'docs_review',
    'enrolled',
    'evaluate',
    'accounts',
    'dispatch',
    'completed',
] as const;

const CreateTransitionApprovalSchema = z.object({
    toStage: z.enum(WORKFLOW_STAGES),
    notes: z.string().trim().max(1000).optional(),
});

type WorkflowTransitionApprovalWithProfiles = WorkflowTransitionApprovalRow & {
    requested_by_profile?: Array<{
        id: string;
        full_name: string | null;
        role: UserRole | null;
    }> | null;
    reviewed_by_profile?: Array<{
        id: string;
        full_name: string | null;
        role: UserRole | null;
    }> | null;
};

function getReviewerRoles(requiredRole: UserRole | null): UserRole[] {
    const roles = new Set<UserRole>(['ceo', 'executive_manager']);
    if (requiredRole) {
        roles.add(requiredRole);
    }
    return [...roles];
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

    const { data, error } = await authz.context.supabase
        .from('workflow_transition_approvals')
        .select('id, application_id, from_stage, to_stage, status, required_role, requested_by, requested_at, reviewed_by, reviewed_at, transition_notes, review_notes, executed_at, metadata, requested_by_profile:profiles!workflow_transition_approvals_requested_by_fkey(id, full_name, role), reviewed_by_profile:profiles!workflow_transition_approvals_reviewed_by_fkey(id, full_name, role)')
        .eq('application_id', id)
        .order('requested_at', { ascending: false })
        .limit(50);

    if (error) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_APPROVALS_LOAD_FAILED',
                    message: error.message,
                    fallback: 'Unable to load approval requests right now. Please try again.',
                }),
                code: 'WORKFLOW_APPROVALS_LOAD_FAILED',
            },
            { status: 500 }
        );
    }

    const rows = (data || []) as WorkflowTransitionApprovalWithProfiles[];
    const mapped = rows.map((row) => ({
        ...row,
        requested_by_profile: row.requested_by_profile?.[0] || null,
        reviewed_by_profile: row.reviewed_by_profile?.[0] || null,
        canReview: row.status === 'pending'
            ? canActorReviewApproval(
                authz.context.role,
                row.required_role,
                authz.context.userId,
                row.requested_by
            )
            : false,
    }));

    return NextResponse.json({ data: mapped });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'verify',
        applicationId: id,
    });

    if (!authz.ok) {
        return authz.response;
    }

    const parsedBody = CreateTransitionApprovalSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: 'Invalid transition approval payload',
                details: parsedBody.error.issues,
            },
            { status: 400 }
        );
    }

    const { toStage, notes } = parsedBody.data;

    const application = await getApplicationWorkflowState(authz.context.supabase, id);
    if (!application) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const { rule, error: ruleError } = await getWorkflowTransitionRule(
        authz.context.supabase,
        application.workflow_stage,
        toStage
    );

    if (ruleError) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_TRANSITION_RULES_UNAVAILABLE',
                    message: ruleError,
                    fallback: 'Workflow settings are temporarily unavailable. Please try again shortly.',
                }),
                code: 'WORKFLOW_TRANSITION_RULES_UNAVAILABLE',
            },
            { status: 500 }
        );
    }

    if (!rule || !rule.is_allowed) {
        return NextResponse.json(
            { error: `Transition ${application.workflow_stage} -> ${toStage} is not allowed.` },
            { status: 403 }
        );
    }

    if (!rule.requires_approval) {
        return NextResponse.json({ error: 'Selected transition does not require approval.' }, { status: 400 });
    }

    if (!canActorSatisfyTransitionRule({
        actorRole: authz.context.role,
        requiredRole: rule.required_role,
        allowedRoles: rule.allowed_roles,
    })) {
        return NextResponse.json(
            {
                error: buildTransitionRoleRequirementMessage({
                    requiredRole: rule.required_role,
                    allowedRoles: rule.allowed_roles,
                }),
            },
            { status: 403 }
        );
    }

    const { data: existingPending, error: pendingError } = await authz.context.supabase
        .from('workflow_transition_approvals')
        .select('id, application_id, from_stage, to_stage, status, required_role, requested_by, requested_at, reviewed_by, reviewed_at, transition_notes, review_notes, executed_at, metadata')
        .eq('application_id', id)
        .eq('from_stage', application.workflow_stage)
        .eq('to_stage', toStage)
        .eq('status', 'pending')
        .maybeSingle<WorkflowTransitionApprovalRow>();

    if (pendingError) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_APPROVALS_LOAD_FAILED',
                    message: pendingError.message,
                    fallback: 'Unable to check existing approval requests right now. Please try again.',
                }),
                code: 'WORKFLOW_APPROVALS_LOAD_FAILED',
            },
            { status: 500 }
        );
    }

    if (existingPending) {
        return NextResponse.json({ data: existingPending });
    }

    const { data: approval, error: createError } = await authz.context.supabase
        .from('workflow_transition_approvals')
        .insert({
            application_id: id,
            from_stage: application.workflow_stage,
            to_stage: toStage,
            status: 'pending',
            required_role: rule.required_role,
            requested_by: authz.context.userId,
            transition_notes: notes || null,
            metadata: {
                source: 'api.workflow.transition-approvals',
            },
        })
        .select('id, application_id, from_stage, to_stage, status, required_role, requested_by, requested_at, reviewed_by, reviewed_at, transition_notes, review_notes, executed_at, metadata')
        .single<WorkflowTransitionApprovalRow>();

    if (createError || !approval) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_APPROVAL_CREATE_FAILED',
                    message: createError?.message || 'Failed to request transition approval',
                    fallback: 'Unable to request approval right now. Please try again.',
                }),
                code: 'WORKFLOW_APPROVAL_CREATE_FAILED',
            },
            { status: 500 }
        );
    }

    await insertApplicationHistory(authz.context.supabase, {
        applicationId: id,
        action: 'updated',
        fieldChanged: 'workflow_transition_approval',
        oldValue: null,
        newValue: `${application.workflow_stage}->${toStage} pending approval`,
        userId: authz.context.userId,
        metadata: {
            approval_id: approval.id,
            required_role: rule.required_role,
            source: 'api.workflow.transition-approvals',
        },
        fromStage: application.workflow_stage,
        toStage,
        notes: notes || null,
    });

    const reviewerRoles = getReviewerRoles(rule.required_role);
    const { data: reviewerProfiles, error: reviewersError } = await authz.context.supabase
        .from('profiles')
        .select('id, role')
        .in('role', reviewerRoles)
        .neq('id', authz.context.userId);

    if (reviewersError) {
        console.warn('Unable to load transition approval reviewers:', reviewersError.message);
    } else if ((reviewerProfiles || []).length > 0) {
        const notifications = (reviewerProfiles || []).map((reviewer) => ({
            user_id: reviewer.id,
            type: 'system_alert',
            title: 'Workflow transition approval required',
            message: `${application.student_first_name} ${application.student_last_name} requires approval to move to ${toStage.replace(/_/g, ' ')}`,
            related_table: 'applications',
            related_id: id,
            priority: 'high',
            metadata: {
                source: 'workflow_transition_approval',
                approval_id: approval.id,
                from_stage: application.workflow_stage,
                to_stage: toStage,
                required_role: rule.required_role,
            },
        }));

        const notifyResult = await authz.context.supabase
            .from('notifications')
            .insert(notifications);

        if (notifyResult.error) {
            console.warn('Transition approval notification insert failed:', notifyResult.error.message);
        }
    }

    return NextResponse.json({ data: approval }, { status: 201 });
}

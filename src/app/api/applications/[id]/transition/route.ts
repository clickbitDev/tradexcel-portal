import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import {
    executeWorkflowTransition,
    getTransitionOptionsForApplication,
} from '@/lib/workflow/transition-service';
import { getUserFriendlyWorkflowError } from '@/lib/workflow/error-messages';

const WORKFLOW_STAGES = [
    'TRANSFERRED',
    'docs_review',
    'enrolled',
    'evaluate',
    'accounts',
    'dispatch',
    'completed',
] as const;

const TransitionRequestSchema = z.object({
    toStage: z.enum(WORKFLOW_STAGES),
    notes: z.string().trim().max(1000).optional(),
    expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
    notifyUserIds: z.array(z.string().uuid()).max(25).optional(),
    approvalId: z.string().uuid().optional(),
});

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

    const result = await getTransitionOptionsForApplication({
        supabase: authz.context.supabase,
        actorId: authz.context.userId,
        actorRole: authz.context.role,
        applicationId: id,
    });

    if (!result.ok) {
        const publicMessage = getUserFriendlyWorkflowError({
            message: result.message,
            fallback: 'Unable to load available workflow actions right now. Please refresh and try again.',
        });

        return NextResponse.json(
            result.status >= 500
                ? {
                    error: publicMessage,
                    code: 'WORKFLOW_TRANSITION_OPTIONS_UNAVAILABLE',
                }
                : { error: publicMessage },
            { status: result.status }
        );
    }

    return NextResponse.json({ data: result.data });
}

export async function PATCH(
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

    const parsedBody = TransitionRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: 'Invalid transition payload',
                details: parsedBody.error.issues,
            },
            { status: 400 }
        );
    }

    const { toStage, notes, expectedUpdatedAt, notifyUserIds, approvalId } = parsedBody.data;

    let mutationClient = authz.context.supabase;
    try {
        mutationClient = createAdminServerClient() as typeof authz.context.supabase;
    } catch {
        mutationClient = authz.context.supabase;
    }

    const result = await executeWorkflowTransition({
        supabase: mutationClient,
        actorId: authz.context.userId,
        actorRole: authz.context.role,
        applicationId: id,
        toStage,
        notes,
        expectedUpdatedAt,
        notifyUserIds,
        approvalId,
    });

    if (!result.ok) {
        const publicMessage = getUserFriendlyWorkflowError({
            code: result.code,
            message: result.message,
            fallback: 'Unable to update the application stage right now. Please try again.',
        });

        return NextResponse.json(
            {
                error: publicMessage,
                code: result.code,
                currentUpdatedAt: result.currentUpdatedAt,
                approvalId: result.approvalId,
            },
            { status: result.status }
        );
    }

    return NextResponse.json({ data: result.data });
}

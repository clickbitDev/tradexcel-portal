import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { insertApplicationHistory } from '@/lib/workflow/history';
import { getUserFriendlyWorkflowError } from '@/lib/workflow/error-messages';

const UpdateAlertSchema = z.object({
    status: z.enum(['open', 'resolved']),
});

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; alertId: string }> }
) {
    const { id, alertId } = await params;

    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'flag',
        applicationId: id,
    });

    if (!authz.ok) {
        return authz.response;
    }

    const parsedBody = UpdateAlertSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: 'Invalid alert update payload',
                details: parsedBody.error.issues,
            },
            { status: 400 }
        );
    }

    const { status } = parsedBody.data;

    const updatePayload = {
        status,
        resolved_by: status === 'resolved' ? authz.context.userId : null,
        resolved_at: status === 'resolved' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
    };

    const { data: updatedAlert, error: updateError } = await authz.context.supabase
        .from('workflow_alerts')
        .update(updatePayload)
        .eq('id', alertId)
        .eq('application_id', id)
        .select('id, application_id, alert_type, severity, title, message, status, raised_by, resolved_by, resolved_at, metadata, created_at, updated_at, raised_by_profile:profiles!workflow_alerts_raised_by_fkey(id, full_name), resolved_by_profile:profiles!workflow_alerts_resolved_by_fkey(id, full_name)')
        .single();

    if (updateError || !updatedAlert) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_ALERT_UPDATE_FAILED',
                    message: updateError?.message || 'Failed to update alert',
                    fallback: 'Unable to update this alert right now. Please try again.',
                }),
                code: 'WORKFLOW_ALERT_UPDATE_FAILED',
            },
            { status: 500 }
        );
    }

    const { count: openAlertCount, error: openAlertCountError } = await authz.context.supabase
        .from('workflow_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('application_id', id)
        .eq('status', 'open');

    if (openAlertCountError) {
        console.warn('Unable to recalculate open alert count:', openAlertCountError.message);
    } else {
        const needsAttention = (openAlertCount || 0) > 0;
        const updateApplicationResult = await authz.context.supabase
            .from('applications')
            .update({
                needs_attention: needsAttention,
                last_updated_by: authz.context.userId,
            })
            .eq('id', id);

        if (updateApplicationResult.error) {
            console.warn('Unable to update application needs_attention state:', updateApplicationResult.error.message);
        }
    }

    await insertApplicationHistory(authz.context.supabase, {
        applicationId: id,
        action: 'updated',
        fieldChanged: 'workflow_alert',
        oldValue: null,
        newValue: `${updatedAlert.title} marked ${status}`,
        userId: authz.context.userId,
        metadata: {
            alert_id: alertId,
            status,
            source: 'api.workflow.alerts',
        },
        toStage: authz.context.application?.legacyStage || 'docs_review',
        notes: `${updatedAlert.title} marked ${status}`,
    });

    return NextResponse.json({ data: updatedAlert });
}

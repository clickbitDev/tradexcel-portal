import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { insertApplicationHistory } from '@/lib/workflow/history';
import { getUserFriendlyWorkflowError } from '@/lib/workflow/error-messages';

const AlertSeveritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

const CreateAlertSchema = z.object({
    alertType: z.string().trim().min(1).max(80),
    severity: AlertSeveritySchema.default('normal'),
    title: z.string().trim().min(1).max(180),
    message: z.string().trim().max(2000).optional(),
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

    const status = request.nextUrl.searchParams.get('status');

    let query = authz.context.supabase
        .from('workflow_alerts')
        .select('id, application_id, alert_type, severity, title, message, status, raised_by, resolved_by, resolved_at, metadata, created_at, updated_at, raised_by_profile:profiles!workflow_alerts_raised_by_fkey(id, full_name), resolved_by_profile:profiles!workflow_alerts_resolved_by_fkey(id, full_name)')
        .eq('application_id', id)
        .order('created_at', { ascending: false });

    if (status === 'open' || status === 'resolved') {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_ALERTS_LOAD_FAILED',
                    message: error.message,
                    fallback: 'Unable to load workflow alerts right now. Please try again.',
                }),
                code: 'WORKFLOW_ALERTS_LOAD_FAILED',
            },
            { status: 500 }
        );
    }

    return NextResponse.json({ data: data ?? [] });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'flag',
        applicationId: id,
    });

    if (!authz.ok) {
        return authz.response;
    }

    const parsedBody = CreateAlertSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: 'Invalid alert payload',
                details: parsedBody.error.issues,
            },
            { status: 400 }
        );
    }

    const { alertType, severity, title, message } = parsedBody.data;

    const { data: alert, error: alertError } = await authz.context.supabase
        .from('workflow_alerts')
        .insert({
            application_id: id,
            alert_type: alertType,
            severity,
            title,
            message: message || null,
            status: 'open',
            raised_by: authz.context.userId,
            metadata: {
                source: 'api.workflow.alerts',
            },
        })
        .select('id, application_id, alert_type, severity, title, message, status, raised_by, resolved_by, resolved_at, metadata, created_at, updated_at, raised_by_profile:profiles!workflow_alerts_raised_by_fkey(id, full_name), resolved_by_profile:profiles!workflow_alerts_resolved_by_fkey(id, full_name)')
        .single();

    if (alertError || !alert) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_ALERT_CREATE_FAILED',
                    message: alertError?.message || 'Failed to create alert',
                    fallback: 'Unable to create this alert right now. Please try again.',
                }),
                code: 'WORKFLOW_ALERT_CREATE_FAILED',
            },
            { status: 500 }
        );
    }

    const applicationResult = await authz.context.supabase
        .from('applications')
        .select('id, workflow_stage, student_first_name, student_last_name, assigned_admin_id, assigned_assessor_id, assigned_staff_id, received_by')
        .eq('id', id)
        .maybeSingle();

    if (applicationResult.error || !applicationResult.data) {
        return NextResponse.json({ data: alert }, { status: 201 });
    }

    const { data: application } = applicationResult;

    const { error: attentionError } = await authz.context.supabase
        .from('applications')
        .update({
            needs_attention: true,
            last_updated_by: authz.context.userId,
        })
        .eq('id', id);

    if (attentionError) {
        console.warn('Unable to set needs_attention on application:', attentionError.message);
    }

    await insertApplicationHistory(authz.context.supabase, {
        applicationId: id,
        action: 'updated',
        fieldChanged: 'workflow_alert',
        oldValue: null,
        newValue: `${severity.toUpperCase()}: ${title}`,
        userId: authz.context.userId,
        metadata: {
            alertType,
            severity,
            source: 'api.workflow.alerts',
        },
        toStage: application.workflow_stage,
        notes: message || title,
    });

    const recipientIds = new Set<string>();
    const recipients = [
        application.assigned_admin_id,
        application.assigned_assessor_id,
        application.assigned_staff_id,
        application.received_by,
    ];

    for (const recipient of recipients) {
        if (recipient && recipient !== authz.context.userId) {
            recipientIds.add(recipient);
        }
    }

    if (recipientIds.size > 0) {
        const studentName = `${application.student_first_name} ${application.student_last_name}`.trim();
        const notifications = [...recipientIds].map((recipientId) => ({
            user_id: recipientId,
            type: 'system_alert',
            title: `Workflow alert: ${title}`,
            message: `${studentName} requires attention (${severity})`,
            related_table: 'applications',
            related_id: id,
            priority: severity,
            metadata: {
                alert_id: alert.id,
                severity,
                alert_type: alertType,
            },
        }));

        const notificationResult = await authz.context.supabase
            .from('notifications')
            .insert(notifications);

        if (notificationResult.error) {
            console.warn('Alert notification insert failed:', notificationResult.error.message);
        }
    }

    return NextResponse.json({ data: alert }, { status: 201 });
}

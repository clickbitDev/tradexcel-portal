import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient, createServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/services/email-service';
import { insertApplicationHistory } from '@/lib/workflow/history';
import { NON_DELETED_PROFILE_FILTER, isActiveProfile } from '@/lib/staff/profile-filters';
import type { WorkflowStage } from '@/types/database';

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

const NotifyFrontdeskSchema = z.object({
    action: z.literal('notify_frontdesk'),
});

const AgentTaskSchema = z.discriminatedUnion('action', [NotifyFrontdeskSchema]);

interface ApplicationTaskState {
    id: string;
    created_by: string | null;
    workflow_stage: WorkflowStage;
    updated_at: string;
    student_uid: string;
    student_first_name: string | null;
    student_last_name: string | null;
    agent_frontdesk_notified: boolean;
    agent_frontdesk_notified_at: string | null;
}

interface AgentTaskStateSnapshot {
    workflow_stage: WorkflowStage;
    updated_at: string;
    agent_frontdesk_notified: boolean;
    agent_frontdesk_notified_at: string | null;
}

interface FrontdeskRow {
    id: string;
    full_name: string | null;
    email: string | null;
    account_status?: string | null;
    is_deleted?: boolean | null;
}

interface TrackedEmailInput {
    supabase: ServerSupabaseClient;
    actorId: string;
    applicationId: string;
    recipient: string;
    subject: string;
    body: string;
    messageType: string;
    metadata: Record<string, unknown>;
}

const TASK_STATE_SELECT = [
    'workflow_stage',
    'updated_at',
    'agent_frontdesk_notified',
    'agent_frontdesk_notified_at',
].join(', ');

function normalizeTaskState(state: AgentTaskStateSnapshot): AgentTaskStateSnapshot {
    return {
        ...state,
        agent_frontdesk_notified: Boolean(state.agent_frontdesk_notified),
    };
}

async function getAdminCapableClient(fallback: ServerSupabaseClient): Promise<ServerSupabaseClient> {
    try {
        return createAdminServerClient() as unknown as ServerSupabaseClient;
    } catch {
        return fallback;
    }
}

async function sendTrackedEmail(input: TrackedEmailInput): Promise<{ success: boolean; error?: string }> {
    const { data: queuedNotification, error: queueError } = await input.supabase
        .from('notification_queue')
        .insert({
            channel: 'email',
            recipient: input.recipient,
            subject: input.subject,
            body: input.body,
            application_id: input.applicationId,
            status: 'pending',
            scheduled_at: new Date().toISOString(),
            created_by: input.actorId,
            metadata: {
                source: 'api.applications.agent-tasks',
                ...input.metadata,
            },
        })
        .select('id')
        .single<{ id: string }>();

    if (queueError || !queuedNotification?.id) {
        return {
            success: false,
            error: queueError?.message || 'Failed to queue email.',
        };
    }

    const emailResult = await sendEmail({
        to: input.recipient,
        subject: input.subject,
        text: input.body,
    });

    if (!emailResult.success) {
        const errorMessage = emailResult.error || 'Failed to send email.';

        await input.supabase
            .from('notification_queue')
            .update({
                status: 'failed',
                error_message: errorMessage,
                retry_count: 1,
            })
            .eq('id', queuedNotification.id);

        await input.supabase
            .from('notification_logs')
            .insert({
                notification_id: queuedNotification.id,
                channel: 'email',
                recipient: input.recipient,
                subject: input.subject,
                status: 'failed',
                sent_by: input.actorId,
                message_type: input.messageType,
                provider_response: {
                    error: errorMessage,
                    ...input.metadata,
                },
            });

        return {
            success: false,
            error: errorMessage,
        };
    }

    await input.supabase
        .from('notification_queue')
        .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error_message: null,
        })
        .eq('id', queuedNotification.id);

    await input.supabase
        .from('notification_logs')
        .insert({
            notification_id: queuedNotification.id,
            channel: 'email',
            recipient: input.recipient,
            subject: input.subject,
            status: 'sent',
            sent_by: input.actorId,
            message_type: input.messageType,
            provider_message_id: emailResult.messageId,
            provider_response: {
                ...(emailResult.providerResponse || {}),
                ...input.metadata,
            },
        });

    return { success: true };
}

async function getActiveFrontdeskUsers(supabase: ServerSupabaseClient): Promise<FrontdeskRow[]> {
    const { data: profilesWithStatus, error: profilesWithStatusError } = await supabase
        .from('profiles')
        .select('id, full_name, email, account_status, is_deleted')
        .eq('role', 'frontdesk')
        .or(NON_DELETED_PROFILE_FILTER)
        .returns<FrontdeskRow[]>();

    if (!profilesWithStatusError) {
        return (profilesWithStatus || []).filter((profile) => (profile.account_status || 'active') !== 'disabled' && isActiveProfile(profile));
    }

    if (profilesWithStatusError.message?.includes('account_status')) {
        const { data: fallbackProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email, is_deleted')
            .eq('role', 'frontdesk')
            .or(NON_DELETED_PROFILE_FILTER)
            .returns<FrontdeskRow[]>();

        return (fallbackProfiles || []).filter(isActiveProfile);
    }

    return [];
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'view',
        applicationId: id,
        allowedRoles: ['agent'],
    });

    if (!authz.ok) {
        return authz.response;
    }

    const body = await request.json().catch(() => null);
    if (!body) {
        return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
    }

    const parsedBody = AgentTaskSchema.safeParse(body);
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: 'Invalid agent task payload',
                details: parsedBody.error.issues,
            },
            { status: 400 }
        );
    }

    const supabase = await getAdminCapableClient(authz.context.supabase);

    const { data: application, error: applicationError } = await supabase
        .from('applications')
        .select('id, created_by, workflow_stage, updated_at, student_uid, student_first_name, student_last_name, agent_frontdesk_notified, agent_frontdesk_notified_at')
        .eq('id', id)
        .maybeSingle<ApplicationTaskState>();

    if (applicationError || !application) {
        return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    }

    if (application.created_by !== authz.context.userId) {
        return NextResponse.json(
            { error: 'You can only manage tasks for applications that you created.' },
            { status: 403 }
        );
    }

    if (application.workflow_stage !== 'docs_review') {
        return NextResponse.json(
            { error: 'Frontdesk notification is only available while the application is in docs review.' },
            { status: 409 }
        );
    }

    if (application.agent_frontdesk_notified) {
        return NextResponse.json(
            { error: 'Frontdesk has already been notified for this application.' },
            { status: 409 }
        );
    }

    const frontdeskUsers = (await getActiveFrontdeskUsers(supabase))
        .filter((profile) => profile.id !== authz.context.userId);

    if (frontdeskUsers.length === 0) {
        return NextResponse.json(
            { error: 'No active frontdesk users are configured to notify.' },
            { status: 422 }
        );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    const applicationLink = `${siteUrl}/frontdesk/applications/${id}`;
    const studentName = `${application.student_first_name || ''} ${application.student_last_name || ''}`.trim() || 'Student';
    const title = 'New agent application ready for review';
    const message = `${studentName} (${application.student_uid}) is ready for frontdesk review.`;

    const notificationRows = frontdeskUsers.map((frontdeskUser) => ({
        user_id: frontdeskUser.id,
        type: 'system_alert',
        title,
        message,
        related_table: 'applications',
        related_id: id,
        priority: 'normal',
        metadata: {
            source: 'api.applications.agent-tasks',
            task: parsedBody.data.action,
            student_uid: application.student_uid,
            application_link: applicationLink,
        },
    }));

    const notificationInsertResult = await supabase
        .from('notifications')
        .insert(notificationRows);

    if (notificationInsertResult.error) {
        return NextResponse.json(
            { error: 'Unable to create frontdesk notifications right now.' },
            { status: 500 }
        );
    }

    const emailRecipients = frontdeskUsers
        .filter((frontdeskUser) => Boolean(frontdeskUser.email))
        .map((frontdeskUser) => ({
            id: frontdeskUser.id,
            fullName: frontdeskUser.full_name,
            email: (frontdeskUser.email || '').trim().toLowerCase(),
        }));

    if (emailRecipients.length === 0) {
        return NextResponse.json(
            { error: 'Frontdesk email addresses are not configured.' },
            { status: 422 }
        );
    }

    const emailSubject = `Application ready for review - ${studentName} (${application.student_uid})`;
    const emailBody = [
        'Hello Frontdesk Team,',
        '',
        `${studentName} (${application.student_uid}) is ready for review.`,
        `Open application: ${applicationLink}`,
        '',
        'This notification was sent from the Agent application tasks panel.',
    ].join('\n');

    const failedRecipients: string[] = [];
    for (const recipient of emailRecipients) {
        const sendResult = await sendTrackedEmail({
            supabase,
            actorId: authz.context.userId,
            applicationId: id,
            recipient: recipient.email,
            subject: emailSubject,
            body: emailBody,
            messageType: 'agent_notify_frontdesk',
            metadata: {
                source: 'api.applications.agent-tasks',
                task: parsedBody.data.action,
                frontdesk_id: recipient.id,
                frontdesk_name: recipient.fullName,
                student_uid: application.student_uid,
            },
        });

        if (!sendResult.success) {
            failedRecipients.push(recipient.email);
        }
    }

    if (failedRecipients.length > 0) {
        return NextResponse.json(
            { error: `Failed to send frontdesk email notifications to: ${failedRecipients.join(', ')}` },
            { status: 502 }
        );
    }

    const completionTime = new Date().toISOString();
    const { data: updatedApplication, error: updateError } = await supabase
        .from('applications')
        .update({
            agent_frontdesk_notified: true,
            agent_frontdesk_notified_at: completionTime,
            agent_frontdesk_notified_by: authz.context.userId,
            last_updated_by: authz.context.userId,
        })
        .eq('id', id)
        .select(TASK_STATE_SELECT)
        .single<AgentTaskStateSnapshot>();

    if (updateError || !updatedApplication) {
        return NextResponse.json(
            { error: 'Frontdesk notifications were sent, but task completion could not be saved.' },
            { status: 500 }
        );
    }

    await insertApplicationHistory(supabase, {
        applicationId: id,
        action: 'updated',
        fieldChanged: 'agent_frontdesk_notified',
        oldValue: application.agent_frontdesk_notified ? 'true' : 'false',
        newValue: 'true',
        userId: authz.context.userId,
        metadata: {
            source: 'api.applications.agent-tasks',
            task: parsedBody.data.action,
            recipient_count: frontdeskUsers.length,
            recipient_ids: frontdeskUsers.map((frontdeskUser) => frontdeskUser.id),
        },
        toStage: application.workflow_stage,
        notes: 'Agent task completed: frontdesk notified about docs review application',
    });

    return NextResponse.json({
        data: {
            action: parsedBody.data.action,
            recipientCount: frontdeskUsers.length,
            application: normalizeTaskState(updatedApplication),
        },
    });
}

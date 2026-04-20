import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient, createServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/services/email-service';
import { insertApplicationHistory } from '@/lib/workflow/history';
import { ACCOUNTS_MANAGER_PORTAL_BASE, withPortalBase } from '@/lib/routes/portal';
import { NON_DELETED_PROFILE_FILTER, isActiveProfile } from '@/lib/staff/profile-filters';
import type { WorkflowStage } from '@/types/database';

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

const RequestXeroBillSchema = z.object({
    action: z.literal('request_xero_bill'),
    expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
});

interface ApplicationFinanceTaskRow {
    id: string;
    workflow_stage: WorkflowStage;
    updated_at: string;
    assessment_result: 'pending' | 'pass' | 'failed';
    assigned_admin_id: string | null;
    student_uid: string;
    student_first_name: string | null;
    student_last_name: string | null;
    xero_bill_id: string | null;
    admin_accounts_manager_bill_requested: boolean;
    admin_accounts_manager_bill_requested_at: string | null;
}

interface FinanceTaskStateSnapshot {
    updated_at: string;
    admin_accounts_manager_bill_requested: boolean;
    admin_accounts_manager_bill_requested_at: string | null;
    admin_accounts_manager_bill_requested_by: string | null;
}

interface AccountsManagerRow {
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
    'updated_at',
    'admin_accounts_manager_bill_requested',
    'admin_accounts_manager_bill_requested_at',
    'admin_accounts_manager_bill_requested_by',
].join(', ');

function buildStudentName(application: ApplicationFinanceTaskRow): string {
    return `${application.student_first_name || ''} ${application.student_last_name || ''}`.trim() || 'Student';
}

function normalizeTaskState(state: FinanceTaskStateSnapshot): FinanceTaskStateSnapshot {
    return {
        ...state,
        admin_accounts_manager_bill_requested: Boolean(state.admin_accounts_manager_bill_requested),
    };
}

async function getAdminCapableClient(fallback: ServerSupabaseClient): Promise<ServerSupabaseClient> {
    try {
        return createAdminServerClient() as unknown as ServerSupabaseClient;
    } catch {
        return fallback;
    }
}

async function getActiveAccountsManagerUsers(supabase: ServerSupabaseClient): Promise<AccountsManagerRow[]> {
    const { data: profilesWithStatus, error: profilesWithStatusError } = await supabase
        .from('profiles')
        .select('id, full_name, email, account_status, is_deleted')
        .eq('role', 'accounts_manager')
        .or(NON_DELETED_PROFILE_FILTER)
        .returns<AccountsManagerRow[]>();

    if (!profilesWithStatusError) {
        return (profilesWithStatus || []).filter((profile) => (profile.account_status || 'active') !== 'disabled' && isActiveProfile(profile));
    }

    if (profilesWithStatusError.message?.includes('account_status')) {
        const { data: fallbackProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email, is_deleted')
            .eq('role', 'accounts_manager')
            .or(NON_DELETED_PROFILE_FILTER)
            .returns<AccountsManagerRow[]>();

        return (fallbackProfiles || []).filter(isActiveProfile);
    }

    return [];
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
                source: 'api.applications.admin-finance-tasks',
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
        allowedRoles: ['admin'],
    });

    if (!authz.ok) {
        return authz.response;
    }

    const parsedBody = RequestXeroBillSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: 'Invalid finance task payload',
                details: parsedBody.error.issues,
            },
            { status: 400 }
        );
    }

    const supabase = await getAdminCapableClient(authz.context.supabase);

    const { data: application, error: applicationError } = await supabase
        .from('applications')
        .select('id, workflow_stage, updated_at, assessment_result, assigned_admin_id, student_uid, student_first_name, student_last_name, xero_bill_id, admin_accounts_manager_bill_requested, admin_accounts_manager_bill_requested_at')
        .eq('id', id)
        .maybeSingle<ApplicationFinanceTaskRow>();

    if (applicationError || !application) {
        return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    }

    if (application.assigned_admin_id !== authz.context.userId) {
        return NextResponse.json(
            { error: 'Only the assigned admin can request Xero bill creation for this application.' },
            { status: 403 }
        );
    }

    if (parsedBody.data.expectedUpdatedAt && parsedBody.data.expectedUpdatedAt !== application.updated_at) {
        return NextResponse.json(
            {
                error: 'This application was updated by another user. Refresh and try again.',
                code: 'APPLICATION_CONFLICT',
                currentUpdatedAt: application.updated_at,
            },
            { status: 409 }
        );
    }

    if (application.workflow_stage !== 'evaluate' || application.assessment_result !== 'pass') {
        return NextResponse.json(
            { error: 'Accounts manager bill request is only available for passed Evaluate applications.' },
            { status: 409 }
        );
    }

    if (application.xero_bill_id) {
        return NextResponse.json(
            { error: 'A Xero bill already exists for this application.' },
            { status: 409 }
        );
    }

    if (application.admin_accounts_manager_bill_requested) {
        return NextResponse.json(
            { error: 'Accounts manager has already been notified for this application.' },
            { status: 409 }
        );
    }

    const accountsManagers = (await getActiveAccountsManagerUsers(supabase))
        .filter((profile) => profile.id !== authz.context.userId);

    if (accountsManagers.length === 0) {
        return NextResponse.json(
            { error: 'No active accounts manager users are configured to notify.' },
            { status: 422 }
        );
    }

    const emailRecipients = accountsManagers
        .filter((profile) => Boolean(profile.email))
        .map((profile) => ({
            id: profile.id,
            fullName: profile.full_name,
            email: (profile.email || '').trim().toLowerCase(),
        }));

    if (emailRecipients.length === 0) {
        return NextResponse.json(
            { error: 'Accounts manager email addresses are not configured.' },
            { status: 422 }
        );
    }

    const studentName = buildStudentName(application);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    const applicationLink = `${siteUrl}${withPortalBase(ACCOUNTS_MANAGER_PORTAL_BASE, `applications/${id}`)}`;
    const title = 'Create Xero bill requested';
    const message = `${studentName} (${application.student_uid}) passed assessment and needs a Xero bill created.`;

    const notificationRows = accountsManagers.map((accountsManager) => ({
        user_id: accountsManager.id,
        type: 'system_alert',
        title,
        message,
        related_table: 'applications',
        related_id: id,
        priority: 'high',
        metadata: {
            source: 'api.applications.admin-finance-tasks',
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
            { error: 'Unable to create accounts manager notifications right now.' },
            { status: 500 }
        );
    }

    const emailSubject = `Create Xero bill - ${studentName} (${application.student_uid})`;
    const emailBody = [
        'Hello Accounts Manager Team,',
        '',
        `${studentName} (${application.student_uid}) passed assessment and is ready for Xero bill creation.`,
        `Open application: ${applicationLink}`,
        '',
        'This notification was sent from the assigned admin task panel.',
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
            messageType: 'admin_request_xero_bill',
            metadata: {
                source: 'api.applications.admin-finance-tasks',
                task: parsedBody.data.action,
                accounts_manager_id: recipient.id,
                accounts_manager_name: recipient.fullName,
                student_uid: application.student_uid,
                application_link: applicationLink,
            },
        });

        if (!sendResult.success) {
            failedRecipients.push(recipient.email);
        }
    }

    if (failedRecipients.length > 0) {
        return NextResponse.json(
            { error: `Failed to send accounts manager email notifications to: ${failedRecipients.join(', ')}` },
            { status: 502 }
        );
    }

    const completionTime = new Date().toISOString();
    const { data: updatedApplication, error: updateError } = await supabase
        .from('applications')
        .update({
            admin_accounts_manager_bill_requested: true,
            admin_accounts_manager_bill_requested_at: completionTime,
            admin_accounts_manager_bill_requested_by: authz.context.userId,
            last_updated_by: authz.context.userId,
        })
        .eq('id', id)
        .select(TASK_STATE_SELECT)
        .single<FinanceTaskStateSnapshot>();

    if (updateError || !updatedApplication) {
        return NextResponse.json(
            { error: 'Accounts manager was notified, but task completion could not be saved.' },
            { status: 500 }
        );
    }

    await insertApplicationHistory(supabase, {
        applicationId: id,
        action: 'updated',
        fieldChanged: 'admin_accounts_manager_bill_requested',
        oldValue: application.admin_accounts_manager_bill_requested ? 'true' : 'false',
        newValue: 'true',
        userId: authz.context.userId,
        metadata: {
            source: 'api.applications.admin-finance-tasks',
            task: parsedBody.data.action,
            recipient_count: accountsManagers.length,
            recipient_ids: accountsManagers.map((accountsManager) => accountsManager.id),
            application_link: applicationLink,
        },
        toStage: application.workflow_stage,
        notes: 'Admin requested accounts manager to create Xero bill',
    });

    return NextResponse.json({
        data: {
            action: parsedBody.data.action,
            recipientCount: accountsManagers.length,
            application: normalizeTaskState(updatedApplication),
        },
    });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient, createServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/services/email-service';
import { insertApplicationHistory } from '@/lib/workflow/history';
import { getUserFriendlyWorkflowError } from '@/lib/workflow/error-messages';

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

const SendApplicantPdfSchema = z.object({
    action: z.literal('send_applicant_pdf_email'),
    subject: z.string().trim().min(1).max(255),
    body: z.string().trim().min(1).max(10000),
});

const SendReferencesSchema = z.object({
    action: z.literal('send_reference_email'),
    subject: z.string().trim().min(1).max(255),
    body: z.string().trim().min(1).max(10000),
    recipients: z.array(z.string().email()).min(1).max(20),
});

const AdminTaskSchema = z.discriminatedUnion('action', [
    SendApplicantPdfSchema,
    SendReferencesSchema,
]);

type AdminTaskPayload = z.infer<typeof AdminTaskSchema>;

interface ApplicationTaskState {
    id: string;
    workflow_stage: string;
    student_uid: string;
    student_first_name: string | null;
    student_last_name: string | null;
    student_email: string | null;
    assigned_admin_id: string | null;
    admin_applicant_pdf_email_completed: boolean;
    admin_applicant_pdf_email_completed_at: string | null;
    admin_references_email_completed: boolean;
    admin_references_email_completed_at: string | null;
}

interface UploadedAttachment {
    filename: string;
    content: Buffer;
    contentType?: string;
    size: number;
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
    attachments?: UploadedAttachment[];
}

async function getAdminCapableClient(fallback: ServerSupabaseClient): Promise<ServerSupabaseClient> {
    try {
        return createAdminServerClient() as unknown as ServerSupabaseClient;
    } catch {
        return fallback;
    }
}

const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;

function getFormFieldString(formData: FormData, field: string): string {
    const value = formData.get(field);
    return typeof value === 'string' ? value.trim() : '';
}

function isFormDataFile(value: FormDataEntryValue): value is File {
    return typeof value !== 'string';
}

function parseReferenceRecipientsInput(value: string): string[] {
    const entries = value
        .split(/[\n,;]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);

    return [...new Set(entries)];
}

async function parseUploadedAttachments(formData: FormData): Promise<{ attachments: UploadedAttachment[]; error?: string }> {
    const attachmentFiles = formData
        .getAll('attachments')
        .filter(isFormDataFile)
        .filter((file) => file.size > 0);

    if (attachmentFiles.length > MAX_ATTACHMENTS) {
        return {
            attachments: [],
            error: `You can attach up to ${MAX_ATTACHMENTS} files per email.`,
        };
    }

    let totalBytes = 0;
    const attachments: UploadedAttachment[] = [];

    for (const file of attachmentFiles) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
            return {
                attachments: [],
                error: `${file.name} exceeds the ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB file limit.`,
            };
        }

        totalBytes += file.size;
        if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
            return {
                attachments: [],
                error: `Total attachment size cannot exceed ${Math.floor(MAX_TOTAL_ATTACHMENT_BYTES / 1024 / 1024)}MB.`,
            };
        }

        const arrayBuffer = await file.arrayBuffer();
        attachments.push({
            filename: file.name || 'attachment',
            content: Buffer.from(arrayBuffer),
            contentType: file.type || undefined,
            size: file.size,
        });
    }

    return { attachments };
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
                source: 'api.applications.admin-tasks',
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
        attachments: input.attachments,
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

function parseRecipients(payload: AdminTaskPayload): string[] {
    if (payload.action !== 'send_reference_email') {
        return [];
    }

    const deduped = new Set(payload.recipients.map((email) => email.trim().toLowerCase()));
    return [...deduped].filter(Boolean);
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

    const formData = await request.formData().catch(() => null);
    if (!formData) {
        return NextResponse.json({ error: 'Invalid form data payload' }, { status: 400 });
    }

    const action = getFormFieldString(formData, 'action');
    const subject = getFormFieldString(formData, 'subject');
    const body = getFormFieldString(formData, 'body');

    const parsedBody = action === 'send_reference_email'
        ? AdminTaskSchema.safeParse({
            action,
            subject,
            body,
            recipients: parseReferenceRecipientsInput(getFormFieldString(formData, 'recipients')),
        })
        : AdminTaskSchema.safeParse({
            action,
            subject,
            body,
        });

    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: 'Invalid admin task payload',
                details: parsedBody.error.issues,
            },
            { status: 400 }
        );
    }

    const attachmentResult = await parseUploadedAttachments(formData);
    if (attachmentResult.error) {
        return NextResponse.json({ error: attachmentResult.error }, { status: 400 });
    }

    const payload = parsedBody.data;
    const uploadedAttachments = attachmentResult.attachments;
    const supabase = await getAdminCapableClient(authz.context.supabase);

    const { data: application, error: applicationError } = await supabase
        .from('applications')
        .select('id, workflow_stage, student_uid, student_first_name, student_last_name, student_email, assigned_admin_id, admin_applicant_pdf_email_completed, admin_applicant_pdf_email_completed_at, admin_references_email_completed, admin_references_email_completed_at')
        .eq('id', id)
        .maybeSingle<ApplicationTaskState>();

    if (applicationError || !application) {
        return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    }

    if (application.assigned_admin_id !== authz.context.userId) {
        return NextResponse.json(
            {
                error: 'Only the assigned admin can complete Docs Review tasks for this application.',
            },
            { status: 403 }
        );
    }

    if (application.workflow_stage !== 'docs_review') {
        return NextResponse.json(
            {
                error: 'Admin Docs Review tasks are only available while the application is in Docs Review.',
            },
            { status: 409 }
        );
    }

    const studentName = `${application.student_first_name || ''} ${application.student_last_name || ''}`.trim() || 'Student';

    if (payload.action === 'send_applicant_pdf_email') {
        const recipient = (application.student_email || '').trim().toLowerCase();
        if (!recipient) {
            return NextResponse.json(
                {
                    error: 'Student email is missing on this application.',
                },
                { status: 422 }
            );
        }

        if (uploadedAttachments.length === 0) {
            return NextResponse.json(
                {
                    error: 'Attach at least one PDF file for applicant email.',
                },
                { status: 422 }
            );
        }

        const hasPdfAttachment = uploadedAttachments.some((attachment) => {
            const mimeType = (attachment.contentType || '').toLowerCase();
            return mimeType === 'application/pdf' || attachment.filename.toLowerCase().endsWith('.pdf');
        });

        if (!hasPdfAttachment) {
            return NextResponse.json(
                {
                    error: 'Attach at least one PDF file for applicant email.',
                },
                { status: 422 }
            );
        }

        const sendResult = await sendTrackedEmail({
            supabase,
            actorId: authz.context.userId,
            applicationId: id,
            recipient,
            subject: payload.subject,
            body: payload.body,
            messageType: 'admin_applicant_pdf',
            metadata: {
                workflow_stage: application.workflow_stage,
                student_uid: application.student_uid,
                student_name: studentName,
                attachment_count: uploadedAttachments.length,
                attachment_names: uploadedAttachments.map((attachment) => attachment.filename),
            },
            attachments: uploadedAttachments,
        });

        if (!sendResult.success) {
            return NextResponse.json(
                {
                    error: getUserFriendlyWorkflowError({
                        code: 'WORKFLOW_ASSIGNMENT_UPDATE_FAILED',
                        message: sendResult.error,
                        fallback: 'Unable to send applicant email with PDF right now. Please try again.',
                    }),
                },
                { status: 500 }
            );
        }

        const completionTime = new Date().toISOString();
        const { data: updatedApplication, error: updateError } = await supabase
            .from('applications')
            .update({
                admin_applicant_pdf_email_completed: true,
                admin_applicant_pdf_email_completed_at: completionTime,
                admin_applicant_pdf_email_completed_by: authz.context.userId,
                sent_by: authz.context.userId,
                sent_at: completionTime,
                delivery_method: 'email',
                last_updated_by: authz.context.userId,
            })
            .eq('id', id)
            .select('admin_applicant_pdf_email_completed, admin_applicant_pdf_email_completed_at, admin_references_email_completed, admin_references_email_completed_at')
            .single();

        if (updateError || !updatedApplication) {
            return NextResponse.json(
                {
                    error: 'Applicant email sent, but task completion could not be saved.',
                },
                { status: 500 }
            );
        }

        await insertApplicationHistory(supabase, {
            applicationId: id,
            action: 'updated',
            fieldChanged: 'admin_applicant_pdf_email_completed',
            oldValue: application.admin_applicant_pdf_email_completed ? 'true' : 'false',
            newValue: 'true',
            userId: authz.context.userId,
            metadata: {
                source: 'api.applications.admin-tasks',
                task: 'send_applicant_pdf_email',
                recipient,
                attachment_count: uploadedAttachments.length,
                attachment_names: uploadedAttachments.map((attachment) => attachment.filename),
            },
            toStage: 'docs_review',
            notes: 'Admin task completed: applicant email with PDF sent',
        });

        return NextResponse.json({
            data: {
                action: payload.action,
                recipient,
                application: updatedApplication,
            },
        });
    }

    const recipients = parseRecipients(payload);

    const failedRecipients: string[] = [];
    for (const recipient of recipients) {
        const sendResult = await sendTrackedEmail({
            supabase,
            actorId: authz.context.userId,
            applicationId: id,
            recipient,
            subject: payload.subject,
            body: payload.body,
            messageType: 'admin_reference_email',
            metadata: {
                workflow_stage: application.workflow_stage,
                student_uid: application.student_uid,
                student_name: studentName,
                attachment_count: uploadedAttachments.length,
                attachment_names: uploadedAttachments.map((attachment) => attachment.filename),
            },
            attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
        });

        if (!sendResult.success) {
            failedRecipients.push(recipient);
        }
    }

    if (failedRecipients.length > 0) {
        return NextResponse.json(
            {
                error: `Failed to send reference emails to: ${failedRecipients.join(', ')}`,
                failedRecipients,
            },
            { status: 502 }
        );
    }

    const completionTime = new Date().toISOString();
    const { data: updatedApplication, error: updateError } = await supabase
        .from('applications')
        .update({
            admin_references_email_completed: true,
            admin_references_email_completed_at: completionTime,
            admin_references_email_completed_by: authz.context.userId,
            last_updated_by: authz.context.userId,
        })
        .eq('id', id)
        .select('admin_applicant_pdf_email_completed, admin_applicant_pdf_email_completed_at, admin_references_email_completed, admin_references_email_completed_at')
        .single();

    if (updateError || !updatedApplication) {
        return NextResponse.json(
            {
                error: 'Reference emails sent, but task completion could not be saved.',
            },
            { status: 500 }
        );
    }

    await insertApplicationHistory(supabase, {
        applicationId: id,
        action: 'updated',
        fieldChanged: 'admin_references_email_completed',
        oldValue: application.admin_references_email_completed ? 'true' : 'false',
        newValue: 'true',
        userId: authz.context.userId,
        metadata: {
            source: 'api.applications.admin-tasks',
            task: 'send_reference_email',
            recipient_count: recipients.length,
            recipients,
            attachment_count: uploadedAttachments.length,
            attachment_names: uploadedAttachments.map((attachment) => attachment.filename),
        },
        toStage: 'docs_review',
        notes: 'Admin task completed: custom references email sent',
    });

    return NextResponse.json({
        data: {
            action: payload.action,
            recipientCount: recipients.length,
            application: updatedApplication,
        },
    });
}

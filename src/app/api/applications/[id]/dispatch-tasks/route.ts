import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient, createServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/services/email-service';
import { insertApplicationHistory } from '@/lib/workflow/history';
import { getUserFriendlyWorkflowError } from '@/lib/workflow/error-messages';
import { getDocumentBinary } from '@/lib/storage/applications-server';
import type { WorkflowStage } from '@/types/database';

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

const SendCertificateEmailSchema = z.object({
    action: z.literal('send_certificate_email'),
    subject: z.string().trim().min(1).max(255),
    body: z.string().trim().min(1).max(10000),
    documentIds: z.array(z.string().uuid()).min(1).max(10),
});

type DispatchTaskPayload = z.infer<typeof SendCertificateEmailSchema>;

interface DispatchApplicationState {
    id: string;
    workflow_stage: WorkflowStage;
    updated_at: string;
    student_uid: string;
    student_first_name: string | null;
    student_last_name: string | null;
    student_email: string | null;
    sent_at: string | null;
    delivery_method: string | null;
}

interface DocumentRow {
    id: string;
    application_id: string | null;
    document_type: string;
    file_name: string;
    file_url: string;
    mime_type: string | null;
    notes: string | null;
    storage_provider: 'supabase' | 'b2' | null;
    storage_bucket: string | null;
    storage_key: string | null;
}

interface UploadedAttachment {
    filename: string;
    content: Buffer;
    contentType?: string;
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
    attachments: UploadedAttachment[];
}

async function getAdminCapableClient(fallback: ServerSupabaseClient): Promise<ServerSupabaseClient> {
    try {
        return createAdminServerClient() as unknown as ServerSupabaseClient;
    } catch {
        return fallback;
    }
}

function isPdfDocument(document: Pick<DocumentRow, 'file_name' | 'mime_type'>): boolean {
    const mimeType = (document.mime_type || '').toLowerCase();
    return mimeType === 'application/pdf' || document.file_name.toLowerCase().endsWith('.pdf');
}

async function getDocumentAttachments(input: {
    supabase: ServerSupabaseClient;
    applicationId: string;
    documentIds: string[];
}): Promise<{ attachments: UploadedAttachment[]; documents: DocumentRow[]; error?: string }> {
    const uniqueDocumentIds = [...new Set(input.documentIds)];
    if (uniqueDocumentIds.length === 0) {
        return { attachments: [], documents: [] };
    }

    const { data: documents, error: documentsError } = await input.supabase
        .from('documents')
        .select('id, application_id, document_type, file_name, file_url, mime_type, notes, storage_provider, storage_bucket, storage_key')
        .eq('application_id', input.applicationId)
        .in('id', uniqueDocumentIds)
        .returns<DocumentRow[]>();

    if (documentsError) {
        return {
            attachments: [],
            documents: [],
            error: documentsError.message,
        };
    }

    const loadedDocuments = documents || [];
    if (loadedDocuments.length !== uniqueDocumentIds.length) {
        return {
            attachments: [],
            documents: loadedDocuments,
            error: 'One or more selected documents were not found for this application.',
        };
    }

    const invalidDocument = loadedDocuments.find((document) => document.document_type !== 'Certificate' || !isPdfDocument(document));
    if (invalidDocument) {
        return {
            attachments: [],
            documents: loadedDocuments,
            error: 'Only uploaded Certificate PDF documents can be attached to this email.',
        };
    }

    const attachments: UploadedAttachment[] = [];

    for (const document of loadedDocuments) {
        let contentBuffer: Buffer | null = null;
        let contentType: string | undefined = document.mime_type || undefined;

        try {
            const binary = await getDocumentBinary(document, input.supabase);
            contentBuffer = binary.buffer;
            if (!contentType && binary.contentType) {
                contentType = binary.contentType;
            }
        } catch {
            contentBuffer = null;
        }

        if (!contentBuffer) {
            const fallbackUrl = (document.file_url || '').trim();
            if (!fallbackUrl) {
                return {
                    attachments: [],
                    documents: loadedDocuments,
                    error: `Unable to access document file: ${document.file_name}`,
                };
            }

            const response = await fetch(fallbackUrl).catch(() => null);
            if (!response || !response.ok) {
                return {
                    attachments: [],
                    documents: loadedDocuments,
                    error: `Unable to download document file: ${document.file_name}`,
                };
            }

            const arrayBuffer = await response.arrayBuffer();
            contentBuffer = Buffer.from(arrayBuffer);
            if (!contentType) {
                const fallbackContentType = response.headers.get('content-type');
                if (fallbackContentType) {
                    contentType = fallbackContentType;
                }
            }
        }

        attachments.push({
            filename: document.file_name,
            content: contentBuffer,
            contentType,
        });
    }

    return { attachments, documents: loadedDocuments };
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
                source: 'api.applications.dispatch-tasks',
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
        allowedRoles: ['dispatch_coordinator', 'admin', 'executive_manager', 'developer', 'ceo'],
    });

    if (!authz.ok) {
        return authz.response;
    }

    const parsedBody = SendCertificateEmailSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: 'Invalid dispatch task payload',
                details: parsedBody.error.issues,
            },
            { status: 400 }
        );
    }

    const payload = parsedBody.data as DispatchTaskPayload;
    const supabase = await getAdminCapableClient(authz.context.supabase);

    const { data: application, error: applicationError } = await supabase
        .from('applications')
        .select('id, workflow_stage, updated_at, student_uid, student_first_name, student_last_name, student_email, sent_at, delivery_method')
        .eq('id', id)
        .maybeSingle<DispatchApplicationState>();

    if (applicationError || !application) {
        return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    }

    if (!['dispatch', 'completed'].includes(application.workflow_stage)) {
        return NextResponse.json(
            {
                error: 'Dispatch actions are only available for Dispatch and Completed applications.',
            },
            { status: 409 }
        );
    }

    const recipient = (application.student_email || '').trim().toLowerCase();
    if (!recipient) {
        return NextResponse.json(
            {
                error: 'Student email is missing on this application.',
            },
            { status: 422 }
        );
    }

    const attachmentResult = await getDocumentAttachments({
        supabase,
        applicationId: id,
        documentIds: payload.documentIds,
    });

    if (attachmentResult.error) {
        return NextResponse.json({ error: attachmentResult.error }, { status: 422 });
    }

    const sendResult = await sendTrackedEmail({
        supabase,
        actorId: authz.context.userId,
        applicationId: id,
        recipient,
        subject: payload.subject,
        body: payload.body,
        messageType: 'dispatch_certificate_email',
        metadata: {
            source: 'api.applications.dispatch-tasks',
            action: payload.action,
            student_uid: application.student_uid,
            document_ids: attachmentResult.documents.map((document) => document.id),
            document_names: attachmentResult.documents.map((document) => document.file_name),
        },
        attachments: attachmentResult.attachments,
    });

    if (!sendResult.success) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_ASSIGNMENT_UPDATE_FAILED',
                    message: sendResult.error,
                    fallback: 'Unable to send the certificate email right now. Please try again.',
                }),
            },
            { status: 502 }
        );
    }

    const completionTime = new Date().toISOString();
    const { data: updatedApplication, error: updateError } = await supabase
        .from('applications')
        .update({
            sent_by: authz.context.userId,
            sent_at: completionTime,
            delivery_method: 'email',
            last_updated_by: authz.context.userId,
        })
        .eq('id', id)
        .select('sent_at, delivery_method')
        .single<{ sent_at: string | null; delivery_method: string | null }>();

    if (updateError || !updatedApplication) {
        return NextResponse.json(
            {
                error: 'Certificate email sent, but dispatch metadata could not be saved.',
            },
            { status: 500 }
        );
    }

    await insertApplicationHistory(supabase, {
        applicationId: id,
        action: 'updated',
        fieldChanged: 'sent_at',
        oldValue: application.sent_at || '',
        newValue: completionTime,
        userId: authz.context.userId,
        metadata: {
            source: 'api.applications.dispatch-tasks',
            task: payload.action,
            recipient,
            document_ids: attachmentResult.documents.map((document) => document.id),
            document_names: attachmentResult.documents.map((document) => document.file_name),
        },
        toStage: application.workflow_stage,
        notes: 'Dispatch task completed: certificate email sent to applicant',
    });

    return NextResponse.json({
        data: {
            action: payload.action,
            recipient,
            application: updatedApplication,
        },
    });
}

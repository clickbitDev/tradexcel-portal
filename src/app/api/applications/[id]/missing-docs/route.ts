import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient, createServerClient } from '@/lib/supabase/server';
import { insertApplicationHistory } from '@/lib/workflow/history';
import { getUserFriendlyWorkflowError } from '@/lib/workflow/error-messages';
import { BRAND_ADMISSIONS_TEAM } from '@/lib/brand';
import { DOCUMENT_TYPES } from '@/types/database';
import { resolveApplicationId } from '@/lib/application-identifiers';
import {
    EMAIL_AGENT_FOR_MISSING_DOCUMENT_TEMPLATE_NAME,
    renderEmailTemplate,
} from '@/lib/email-templates/presets';

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

const MissingDocsPayloadSchema = z.object({
    missingDocuments: z.array(z.enum(DOCUMENT_TYPES)).min(1).max(DOCUMENT_TYPES.length),
    note: z.string().trim().max(1000).optional(),
    previewOnly: z.boolean().optional().default(false),
});

type PartnerLookupRow = {
    id: string;
    company_name: string;
    email: string | null;
    user_id: string | null;
    parent_partner_id: string | null;
};

type ApplicationLookupRow = {
    id: string;
    application_number: string | null;
    student_uid: string;
    student_first_name: string | null;
    student_last_name: string | null;
    workflow_stage: string;
    partner: PartnerLookupRow | PartnerLookupRow[] | null;
};

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
    if (!value) {
        return null;
    }

    return Array.isArray(value) ? value[0] ?? null : value;
}

function buildMissingDocsEmailBody(input: {
    studentName: string;
    studentUid: string;
    missingDocuments: string[];
    note?: string;
    requestedByName?: string | null;
    applicationLink?: string | null;
}): string {
    const lines = [
        'Hello,',
        '',
        `Frontdesk requested additional documents for student ${input.studentName} (${input.studentUid}).`,
        '',
        'Missing documents:',
        ...input.missingDocuments.map((documentType) => `- ${documentType}`),
    ];

    if (input.note) {
        lines.push('', 'Additional notes:', input.note);
    }

    if (input.applicationLink) {
        lines.push('', `Application link: ${input.applicationLink}`);
    }

    lines.push('', `Requested by: ${input.requestedByName || 'Frontdesk Team'}`, '', 'Regards,', BRAND_ADMISSIONS_TEAM);
    return lines.join('\n');
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
        allowedRoles: ['frontdesk'],
    });

    if (!authz.ok) {
        return authz.response;
    }

    const parsedBody = MissingDocsPayloadSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: 'Invalid missing documents payload',
                details: parsedBody.error.issues,
            },
            { status: 400 }
        );
    }

    const uniqueMissingDocuments = [...new Set(parsedBody.data.missingDocuments)];
    const note = parsedBody.data.note || null;
    const previewOnly = parsedBody.data.previewOnly;

    let adminClient: ReturnType<typeof createAdminServerClient>;
    try {
        adminClient = createAdminServerClient();
    } catch {
        return NextResponse.json(
            { error: 'Server is missing admin Supabase configuration.' },
            { status: 500 }
        );
    }

    const { data: application, error: applicationError } = await adminClient
        .from('applications')
        .select('id, application_number, student_uid, student_first_name, student_last_name, workflow_stage, partner:partners(id, company_name, email, user_id, parent_partner_id)')
        .eq('id', id)
        .maybeSingle<ApplicationLookupRow>();

    if (applicationError || !application) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const linkedPartner = normalizeOne(application.partner);
    if (!linkedPartner) {
        return NextResponse.json(
            { error: 'No agent is linked to this application yet.' },
            { status: 422 }
        );
    }

    let targetPartner = linkedPartner;
    if (linkedPartner.parent_partner_id) {
        const { data: parentPartner } = await adminClient
            .from('partners')
            .select('id, company_name, email, user_id, parent_partner_id')
            .eq('id', linkedPartner.parent_partner_id)
            .maybeSingle<PartnerLookupRow>();

        if (parentPartner) {
            targetPartner = parentPartner;
        }
    }

    let recipientEmail = targetPartner.email?.trim() || '';
    let recipientProfileName: string | null = null;

    if (!recipientEmail && targetPartner.user_id) {
        const { data: linkedProfile } = await adminClient
            .from('profiles')
            .select('email, full_name')
            .eq('id', targetPartner.user_id)
            .maybeSingle<{ email: string | null; full_name: string | null }>();

        recipientEmail = linkedProfile?.email?.trim() || '';
        recipientProfileName = linkedProfile?.full_name || null;
    }

    if (!recipientEmail) {
        return NextResponse.json(
            { error: 'The linked agent does not have an email address configured.' },
            { status: 422 }
        );
    }

    const { data: requesterProfile } = await adminClient
        .from('profiles')
        .select('full_name')
        .eq('id', authz.context.userId)
        .maybeSingle<{ full_name: string | null }>();

    const studentName = `${application.student_first_name || ''} ${application.student_last_name || ''}`.trim() || 'Student';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    const applicationLink = `${siteUrl}/portal/agent/applications/${application.id}`;
    const applicationIdentifier = resolveApplicationId(application.application_number, application.student_uid) || application.student_uid;
    const fallbackSubject = `Missing documents required - ${studentName} (${applicationIdentifier})`;
    const fallbackBody = buildMissingDocsEmailBody({
        studentName,
        studentUid: applicationIdentifier,
        missingDocuments: uniqueMissingDocuments,
        note: note || undefined,
        requestedByName: requesterProfile?.full_name,
        applicationLink,
    });

    const { data: missingDocsTemplate } = await adminClient
        .from('email_templates')
        .select('subject, body')
        .eq('name', EMAIL_AGENT_FOR_MISSING_DOCUMENT_TEMPLATE_NAME)
        .eq('is_active', true)
        .maybeSingle<{ subject: string; body: string }>();

    const templateVariables = {
        '{{student_name}}': studentName,
        '{{student_email}}': '',
        '{{application_id}}': applicationIdentifier,
        '{{qualification}}': '',
        '{{rto}}': '',
        '{{appointment_date}}': '',
        '{{intake_date}}': '',
        '{{status}}': application.workflow_stage.replace(/_/g, ' '),
        '{{agent_name}}': recipientProfileName || targetPartner.company_name,
        '{{portal_link}}': applicationLink,
        '{{missing_documents}}': uniqueMissingDocuments.map((documentType) => `- ${documentType}`).join('\n'),
        '{{requested_by}}': requesterProfile?.full_name || 'Frontdesk Team',
        '{{note_block}}': note ? `Additional notes:\n${note}\n\n` : '',
    };

    const subject = missingDocsTemplate?.subject
        ? renderEmailTemplate(missingDocsTemplate.subject, templateVariables)
        : fallbackSubject;
    const body = missingDocsTemplate?.body
        ? renderEmailTemplate(missingDocsTemplate.body, templateVariables)
        : fallbackBody;

    if (previewOnly) {
        return NextResponse.json({
            data: {
                previewOnly: true,
                recipient: recipientEmail,
                recipientName: recipientProfileName || targetPartner.company_name,
                partnerId: targetPartner.id,
                missingDocuments: uniqueMissingDocuments,
                subject,
                body,
            },
        });
    }

    const { data: queuedNotification, error: queueError } = await adminClient
        .from('notification_queue')
        .insert({
            channel: 'email',
            recipient: recipientEmail,
            subject,
            body,
            application_id: application.id,
            status: 'pending',
            scheduled_at: new Date().toISOString(),
            created_by: authz.context.userId,
            metadata: {
                source: 'frontdesk_missing_documents',
                partner_id: targetPartner.id,
                partner_name: targetPartner.company_name,
                partner_user_id: targetPartner.user_id,
                missing_documents: uniqueMissingDocuments,
                note,
            },
        })
        .select('id')
        .single();

    if (queueError || !queuedNotification?.id) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'WORKFLOW_MISSING_DOCS_EMAIL_FAILED',
                    message: queueError?.message || 'Failed to queue missing-documents email.',
                    fallback: 'Unable to notify the agent right now. Please try again.',
                }),
                code: 'WORKFLOW_MISSING_DOCS_EMAIL_FAILED',
            },
            { status: 500 }
        );
    }

    const alertTitle = `Missing documents requested (${uniqueMissingDocuments.length})`;
    const alertMessage = `${studentName}: ${uniqueMissingDocuments.join(', ')}${note ? `. Note: ${note}` : ''}`;

    const { data: alert } = await adminClient
        .from('workflow_alerts')
        .insert({
            application_id: application.id,
            alert_type: 'missing_documents',
            severity: 'normal',
            title: alertTitle,
            message: alertMessage,
            status: 'open',
            raised_by: authz.context.userId,
            metadata: {
                source: 'api.applications.missing-docs',
                missing_documents: uniqueMissingDocuments,
                note,
                recipient: recipientEmail,
                partner_id: targetPartner.id,
                queued_notification_id: queuedNotification.id,
            },
        })
        .select('id')
        .single();

    const { error: attentionError } = await adminClient
        .from('applications')
        .update({
            needs_attention: true,
            last_updated_by: authz.context.userId,
        })
        .eq('id', application.id);

    if (attentionError) {
        console.warn('Unable to set needs_attention on application:', attentionError.message);
    }

    await insertApplicationHistory(adminClient as unknown as ServerSupabaseClient, {
        applicationId: application.id,
        action: 'updated',
        fieldChanged: 'missing_documents_request',
        oldValue: null,
        newValue: uniqueMissingDocuments.join(', '),
        userId: authz.context.userId,
        metadata: {
            source: 'api.applications.missing-docs',
            missing_documents: uniqueMissingDocuments,
            note,
            recipient: recipientEmail,
            partner_id: targetPartner.id,
            queued_notification_id: queuedNotification.id,
            workflow_alert_id: alert?.id || null,
        },
        toStage: application.workflow_stage,
        notes: note || 'Missing documents requested from agent',
    });

    if (targetPartner.user_id && targetPartner.user_id !== authz.context.userId) {
        const { error: notifyError } = await adminClient
            .from('notifications')
            .insert({
                user_id: targetPartner.user_id,
                type: 'system_alert',
                title: 'Missing documents requested',
                message: `${studentName} requires ${uniqueMissingDocuments.length} additional document(s).`,
                related_table: 'applications',
                related_id: application.id,
                priority: 'normal',
                metadata: {
                    source: 'api.applications.missing-docs',
                    missing_documents: uniqueMissingDocuments,
                    note,
                    queued_notification_id: queuedNotification.id,
                    recipient_email: recipientEmail,
                },
            });

        if (notifyError) {
            console.warn('Missing-docs in-app notification insert failed:', notifyError.message);
        }
    }

    return NextResponse.json(
        {
            data: {
                queuedNotificationId: queuedNotification.id,
                recipient: recipientEmail,
                recipientName: recipientProfileName || targetPartner.company_name,
                partnerId: targetPartner.id,
                missingDocuments: uniqueMissingDocuments,
            },
        },
        { status: 201 }
    );
}

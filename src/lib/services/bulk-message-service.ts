/**
 * Bulk Message Service
 * Handles composing and sending bulk SMS/Email messages to students and partners
 */

import { createClient } from '@/lib/supabase/client';
import { resolveApplicationId } from '@/lib/application-identifiers';
import { ACTIVE_RECORD_FILTER } from '@/lib/soft-delete';

export type MessageChannel = 'email' | 'sms' | 'whatsapp';

export interface RecipientFilters {
    workflowStages?: string[];
    partnerIds?: string[];
    rtoIds?: string[];
    qualificationIds?: string[];
    dateFrom?: string;
    dateTo?: string;
    hasExpiredQualification?: boolean;
}

export interface Recipient {
    id: string;
    applicationId: string;
    applicationNumber: string;
    studentUid: string;
    studentName: string;
    studentEmail: string | null;
    studentPhone: string | null;
    qualificationName: string;
    rtoName: string;
    partnerName: string | null;
    workflowStage: string;
}

export interface BulkMessagePayload {
    channel: MessageChannel;
    recipients: Recipient[];
    templateId?: string;
    subject?: string;
    body: string;
    variables?: Record<string, string>;
}

export interface QueuedMessage {
    id: string;
    channel: MessageChannel;
    recipient: string;
    subject: string | null;
    body: string;
    status: 'pending' | 'sent' | 'failed' | 'cancelled';
    applicationId: string | null;
    createdAt: string;
}

/**
 * Fetch eligible recipients based on filter criteria
 */
export async function getEligibleRecipients(filters: RecipientFilters): Promise<Recipient[]> {
    const supabase = createClient();

    let query = supabase
        .from('applications')
        .select(`
            id,
            application_number,
            student_uid,
            student_first_name,
            student_last_name,
            student_email,
            student_phone,
            workflow_stage,
            partner:partners(id, company_name),
            offering:rto_offerings(
                id,
                qualification:qualifications(id, code, name, status),
                rto:rtos(id, name)
            )
        `)
        .or(ACTIVE_RECORD_FILTER)
        .eq('application_outcome', 'active');

    // Apply filters
    if (filters.workflowStages?.length) {
        query = query.in('workflow_stage', filters.workflowStages);
    }

    if (filters.partnerIds?.length) {
        query = query.in('partner_id', filters.partnerIds);
    }

    if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
    }

    if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching recipients:', error);
        return [];
    }

    // Transform and filter results
    const recipients: Recipient[] = [];

    for (const app of data || []) {
        const offering = app.offering as any;
        const partner = app.partner as any;
        const qualification = offering?.qualification;

        // Filter by RTO if specified
        if (filters.rtoIds?.length && !filters.rtoIds.includes(offering?.rto?.id)) {
            continue;
        }

        // Filter by qualification if specified
        if (filters.qualificationIds?.length && !filters.qualificationIds.includes(qualification?.id)) {
            continue;
        }

        // Filter by expired qualifications
        if (filters.hasExpiredQualification && qualification?.status === 'current') {
            continue;
        }

        recipients.push({
            id: app.id,
            applicationId: app.id,
            applicationNumber: resolveApplicationId(app.application_number, app.student_uid),
            studentUid: app.student_uid,
            studentName: `${app.student_first_name} ${app.student_last_name}`.trim(),
            studentEmail: app.student_email,
            studentPhone: app.student_phone,
            qualificationName: qualification?.name || 'Unknown',
            rtoName: offering?.rto?.name || 'Unknown',
            partnerName: partner?.company_name || null,
            workflowStage: app.workflow_stage,
        });
    }

    return recipients;
}

/**
 * Get students with expired/superseded qualifications
 */
export async function getExpiredQualificationStudents(): Promise<Recipient[]> {
    return getEligibleRecipients({ hasExpiredQualification: true });
}

/**
 * Preview a message with variable substitution
 */
export function previewMessage(
    template: string,
    recipient: Recipient,
    customVariables?: Record<string, string>
): string {
    let message = template;

    // Standard variables
    const variables: Record<string, string> = {
        '{{student_name}}': recipient.studentName,
        '{{student_email}}': recipient.studentEmail || '',
        '{{application_id}}': recipient.applicationNumber,
        '{{qualification}}': recipient.qualificationName,
        '{{rto}}': recipient.rtoName,
        '{{agent_name}}': recipient.partnerName || '',
        '{{status}}': formatWorkflowStage(recipient.workflowStage),
        ...customVariables,
    };

    for (const [key, value] of Object.entries(variables)) {
        message = message.replace(new RegExp(key, 'g'), value);
    }

    return message;
}

/**
 * Format workflow stage for display
 */
function formatWorkflowStage(stage: string): string {
    return stage
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Queue bulk messages for sending
 */
export async function sendBulkMessages(payload: BulkMessagePayload): Promise<{
    success: boolean;
    queued: number;
    errors: string[];
}> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, queued: 0, errors: ['Not authenticated'] };
    }

    const errors: string[] = [];
    const messagesToQueue = [];

    for (const recipient of payload.recipients) {
        // Get recipient contact info based on channel
        let contactInfo: string | null = null;

        if (payload.channel === 'email') {
            contactInfo = recipient.studentEmail;
        } else {
            contactInfo = recipient.studentPhone;
        }

        if (!contactInfo) {
            errors.push(`No ${payload.channel} contact for ${recipient.studentName}`);
            continue;
        }

        // Render the message with variables
        const renderedBody = previewMessage(payload.body, recipient, payload.variables);
        const renderedSubject = payload.subject
            ? previewMessage(payload.subject, recipient, payload.variables)
            : null;

        messagesToQueue.push({
            channel: payload.channel,
            recipient: contactInfo,
            subject: renderedSubject,
            body: renderedBody,
            application_id: recipient.applicationId,
            template_id: payload.templateId || null,
            status: 'pending',
            scheduled_at: new Date().toISOString(),
            created_by: user.id,
            metadata: {
                application_number: recipient.applicationNumber,
                student_uid: recipient.studentUid,
                student_name: recipient.studentName,
                qualification: recipient.qualificationName,
            },
        });
    }

    if (messagesToQueue.length === 0) {
        return {
            success: false,
            queued: 0,
            errors: errors.length > 0 ? errors : ['No valid recipients'],
        };
    }

    // Insert into notification_queue
    const { data, error } = await supabase
        .from('notification_queue')
        .insert(messagesToQueue)
        .select('id');

    if (error) {
        console.error('Error queuing messages:', error);
        return { success: false, queued: 0, errors: [error.message] };
    }

    return {
        success: true,
        queued: data?.length || 0,
        errors,
    };
}

/**
 * Get available email templates
 */
export async function getEmailTemplates(): Promise<Array<{
    id: string;
    name: string;
    subject: string;
    body: string;
    variables: string[];
}>> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('email_templates')
        .select('id, name, subject, body, variables')
        .eq('is_active', true)
        .order('name');

    if (error) {
        console.error('Error fetching templates:', error);
        return [];
    }

    return data || [];
}

/**
 * Get message queue status summary
 */
export async function getQueueStats(): Promise<{
    pending: number;
    sent: number;
    failed: number;
}> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('notification_queue')
        .select('status')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
        console.error('Error fetching queue stats:', error);
        return { pending: 0, sent: 0, failed: 0 };
    }

    const stats = { pending: 0, sent: 0, failed: 0 };
    for (const item of data || []) {
        if (item.status === 'pending') stats.pending++;
        else if (item.status === 'sent') stats.sent++;
        else if (item.status === 'failed') stats.failed++;
    }

    return stats;
}

/**
 * Get recent queued messages
 */
export async function getRecentMessages(limit = 50): Promise<QueuedMessage[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('notification_queue')
        .select('id, channel, recipient, subject, body, status, application_id, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching recent messages:', error);
        return [];
    }

    return (data || []).map(msg => ({
        id: msg.id,
        channel: msg.channel as MessageChannel,
        recipient: msg.recipient,
        subject: msg.subject,
        body: msg.body,
        status: msg.status,
        applicationId: msg.application_id,
        createdAt: msg.created_at,
    }));
}

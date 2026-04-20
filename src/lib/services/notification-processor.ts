'use server';

import { createAdminServerClient } from '@/lib/supabase/server';
import { BRAND_NOTIFICATION_SUBJECT } from '@/lib/brand';
import { sendEmail } from '@/lib/services/email-service';
import { sendSms, sendWhatsAppTemplate } from '@/lib/services/infobip-service';

// Types
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled';
export type NotificationChannel = 'email' | 'whatsapp' | 'sms';

export interface QueuedNotification {
    id: string;
    channel: NotificationChannel;
    recipient: string;
    subject: string | null;
    body: string;
    application_id: string | null;
    partner_id: string | null;
    template_id: string | null;
    invoice_id: string | null;
    bill_id: string | null;
    status: NotificationStatus;
    scheduled_at: string;
    sent_at: string | null;
    error_message: string | null;
    retry_count: number;
    max_retries: number;
    metadata: Record<string, unknown> | null;
    created_by: string | null;
    created_at: string;
}

export interface ProcessResult {
    processed: number;
    success: number;
    failed: number;
    errors: string[];
}

// Get pending notifications
export async function getPendingNotifications(limit: number = 50): Promise<{ data: QueuedNotification[] | null; error: string | null }> {
    const supabase = createAdminServerClient();

    const { data, error } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_at', new Date().toISOString())
        .lt('retry_count', 3) // Only get retryable
        .order('scheduled_at', { ascending: true })
        .limit(limit);

    if (error) {
        console.error('Error fetching pending notifications:', error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Get queue statistics
export async function getQueueStats(): Promise<{
    data: { pending: number; sent: number; failed: number; total: number } | null;
    error: string | null
}> {
    const supabase = createAdminServerClient();

    const { data, error } = await supabase
        .from('notification_queue')
        .select('status');

    if (error) {
        return { data: null, error: error.message };
    }

    const stats = {
        pending: 0,
        sent: 0,
        failed: 0,
        total: data.length,
    };

    for (const item of data) {
        if (item.status === 'pending') stats.pending++;
        else if (item.status === 'sent') stats.sent++;
        else if (item.status === 'failed') stats.failed++;
    }

    return { data: stats, error: null };
}

// Process pending notifications
export async function processNotificationQueue(limit: number = 50): Promise<ProcessResult> {
    const result: ProcessResult = {
        processed: 0,
        success: 0,
        failed: 0,
        errors: [],
    };

    const { data: notifications, error } = await getPendingNotifications(limit);

    if (error || !notifications) {
        result.errors.push(error || 'Failed to fetch notifications');
        return result;
    }

    for (const notification of notifications) {
        result.processed++;

        try {
            const sendResult = await sendNotification(notification);

            if (sendResult.success) {
                result.success++;
            } else {
                result.failed++;
                result.errors.push(`${notification.id}: ${sendResult.error}`);
            }
        } catch (err) {
            result.failed++;
            result.errors.push(`${notification.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }

    return result;
}

// Process a specific queued notification immediately
export async function processQueuedNotificationById(id: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = createAdminServerClient();

    const { data, error } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) {
        return { success: false, error: error?.message || 'Notification not found' };
    }

    if (data.status === 'sent') {
        return { success: true, error: null };
    }

    if (data.status !== 'pending') {
        return { success: false, error: `Notification is in '${data.status}' state` };
    }

    return sendNotification(data as QueuedNotification);
}

// Send a single notification
async function sendNotification(notification: QueuedNotification): Promise<{ success: boolean; error: string | null }> {
    const supabase = createAdminServerClient();

    try {
        let success = false;
        let providerMessageId: string | null = null;
        let errorMessage: string | null = null;
        let providerResponse: Record<string, unknown> | null = null;

        switch (notification.channel) {
            case 'email': {
                const emailResult = await sendEmail({
                    to: notification.recipient,
                    subject: notification.subject || BRAND_NOTIFICATION_SUBJECT,
                    text: notification.body,
                });

                success = emailResult.success;
                providerMessageId = emailResult.messageId;
                errorMessage = emailResult.error;
                providerResponse = emailResult.providerResponse;
                break;
            }

            case 'sms': {
                // Send SMS via Infobip
                const smsResult = await sendSms(notification.recipient, notification.body);
                success = smsResult.success;
                providerMessageId = smsResult.messageId;
                errorMessage = smsResult.error;
                providerResponse = {
                    statusCode: smsResult.statusCode || null,
                };
                break;
            }

            case 'whatsapp': {
                // Send WhatsApp template message via Infobip
                const metadata = notification.metadata || {};
                const templateName = (metadata.whatsapp_template as string) || 'test_whatsapp_template_en';
                const placeholders = (metadata.whatsapp_placeholders as string[]) || [notification.body.slice(0, 100)];

                const waResult = await sendWhatsAppTemplate(
                    notification.recipient,
                    templateName,
                    placeholders
                );
                success = waResult.success;
                providerMessageId = waResult.messageId;
                errorMessage = waResult.error;
                providerResponse = {
                    statusCode: waResult.statusCode || null,
                };
                break;
            }
        }

        if (success) {
            // Update as sent
            await supabase
                .from('notification_queue')
                .update({
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                })
                .eq('id', notification.id);

            // Log to notification_logs
            await supabase
                .from('notification_logs')
                .insert({
                    notification_id: notification.id,
                    channel: notification.channel,
                    recipient: notification.recipient,
                    subject: notification.subject,
                    status: 'sent',
                    provider_message_id: providerMessageId,
                    provider_response: providerResponse,
                });

            return { success: true, error: null };
        } else {
            throw new Error(errorMessage || `Send failed for channel ${notification.channel}`);
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        // Increment retry count
        await supabase
            .from('notification_queue')
            .update({
                retry_count: notification.retry_count + 1,
                error_message: errorMessage,
                status: notification.retry_count + 1 >= notification.max_retries ? 'failed' : 'pending',
            })
            .eq('id', notification.id);

        // Log failure
        await supabase
            .from('notification_logs')
            .insert({
                notification_id: notification.id,
                channel: notification.channel,
                recipient: notification.recipient,
                subject: notification.subject,
                status: 'failed',
                provider_response: { error: errorMessage },
            });

        return { success: false, error: errorMessage };
    }
}

// Retry a failed notification
export async function retryNotification(id: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = createAdminServerClient();

    // Reset status to pending
    const { data, error } = await supabase
        .from('notification_queue')
        .update({
            status: 'pending',
            retry_count: 0,
            error_message: null,
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return { success: false, error: error.message };
    }

    // Process immediately
    return sendNotification(data as QueuedNotification);
}

// Cancel a pending notification
export async function cancelNotification(id: string): Promise<{ error: string | null }> {
    const supabase = createAdminServerClient();

    const { error } = await supabase
        .from('notification_queue')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('status', 'pending');

    if (error) {
        return { error: error.message };
    }

    return { error: null };
}

// Get recent notifications for monitoring
export async function getRecentNotifications(limit: number = 100): Promise<{ data: QueuedNotification[] | null; error: string | null }> {
    const supabase = createAdminServerClient();

    const { data, error } = await supabase
        .from('notification_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

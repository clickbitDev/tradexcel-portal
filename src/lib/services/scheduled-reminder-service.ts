'use server';

import { createServerClient } from '@/lib/supabase/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { processQueuedNotificationById } from '@/lib/services/notification-processor';

// Types
export type ReminderStatus = 'active' | 'paused' | 'completed' | 'expired';
export type TriggerType = 'stage_duration' | 'missing_document' | 'payment_due';
export type NotificationChannel = 'email' | 'whatsapp' | 'sms';

interface ReminderTriggerConfig {
    stage?: string;
    days?: number;
    document_type?: string;
    recipient?: string;
    mention_text?: string;
    mentioned_staff_ids?: string[];
}

interface MentionedStaffRecipient {
    id: string;
    full_name: string | null;
    email: string;
}

const STAFF_ROLES = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'developer',
];

export interface ScheduledReminder {
    id: string;
    name: string;
    description: string | null;
    trigger_type: TriggerType;
    trigger_config: ReminderTriggerConfig;
    notification_channel: NotificationChannel;
    template_id: string | null;
    custom_message: string | null;
    status: ReminderStatus;
    last_run_at: string | null;
    next_run_at: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    template?: {
        name: string;
        subject: string;
    } | null;
}

export interface ReminderHistory {
    id: string;
    reminder_id: string;
    application_id: string | null;
    notification_id: string | null;
    triggered_at: string;
    notes: string | null;
    application?: {
        student_first_name: string;
        student_last_name: string;
    } | null;
}

export interface CreateReminderInput {
    name: string;
    description?: string;
    trigger_type: TriggerType;
    trigger_config: Record<string, unknown>;
    notification_channel: NotificationChannel;
    template_id?: string;
    custom_message?: string;
}

export interface UpdateReminderInput {
    name?: string;
    description?: string;
    trigger_type?: TriggerType;
    trigger_config?: Record<string, unknown>;
    notification_channel?: NotificationChannel;
    template_id?: string | null;
    custom_message?: string | null;
    status?: ReminderStatus;
}

function isValidEmailAddress(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isLikelyPhoneNumber(value: string): boolean {
    return /^\+?[\d\s()-]{8,20}$/.test(value);
}

function stripMentionMarkup(text: string): string {
    return text.replace(/@\[([^\]]+)\]\(user:[^)]+\)/g, '@$1');
}

function extractMentionedStaffIds(config: ReminderTriggerConfig): string[] {
    const ids = new Set<string>();

    if (Array.isArray(config.mentioned_staff_ids)) {
        for (const id of config.mentioned_staff_ids) {
            if (typeof id === 'string' && id.trim()) {
                ids.add(id.trim());
            }
        }
    }

    if (typeof config.mention_text === 'string' && config.mention_text.trim()) {
        const mentionIdPattern = /@\[[^\]]+\]\(user:([^)]+)\)/g;
        let match: RegExpExecArray | null;
        while ((match = mentionIdPattern.exec(config.mention_text)) !== null) {
            if (match[1]) {
                ids.add(match[1]);
            }
        }
    }

    return Array.from(ids);
}

function resolvePrimaryRecipient(
    channel: NotificationChannel,
    config: ReminderTriggerConfig,
    application: { student_email: string | null; student_phone: string | null }
): string {
    const configuredRecipient = typeof config.recipient === 'string' ? config.recipient.trim() : '';
    if (configuredRecipient) {
        return configuredRecipient;
    }

    if (channel === 'email') {
        return (application.student_email || '').trim();
    }

    return (application.student_phone || '').trim();
}

// Get all reminders
export async function getReminders(): Promise<{ data: ScheduledReminder[] | null; error: string | null }> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from('scheduled_reminders')
        .select(`
            *,
            template:email_templates(name, subject)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching reminders:', error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Get single reminder
export async function getReminder(id: string): Promise<{ data: ScheduledReminder | null; error: string | null }> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from('scheduled_reminders')
        .select(`
            *,
            template:email_templates(name, subject)
        `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching reminder:', error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Create reminder
export async function createReminder(input: CreateReminderInput): Promise<{ data: ScheduledReminder | null; error: string | null }> {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from('scheduled_reminders')
        .insert({
            name: input.name,
            description: input.description || null,
            trigger_type: input.trigger_type,
            trigger_config: input.trigger_config,
            notification_channel: input.notification_channel,
            template_id: input.template_id || null,
            custom_message: input.custom_message || null,
            status: 'active',
            created_by: user?.id || null,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating reminder:', error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Update reminder
export async function updateReminder(id: string, input: UpdateReminderInput): Promise<{ data: ScheduledReminder | null; error: string | null }> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from('scheduled_reminders')
        .update({
            ...input,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating reminder:', error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Delete reminder
export async function deleteReminder(id: string): Promise<{ error: string | null }> {
    const supabase = await createServerClient();

    const { error } = await supabase
        .from('scheduled_reminders')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting reminder:', error);
        return { error: error.message };
    }

    return { error: null };
}

// Toggle reminder status (pause/resume)
export async function toggleReminderStatus(id: string): Promise<{ data: ScheduledReminder | null; error: string | null }> {
    const supabase = await createServerClient();

    // Get current status
    const { data: current, error: fetchError } = await supabase
        .from('scheduled_reminders')
        .select('status')
        .eq('id', id)
        .single();

    if (fetchError) {
        return { data: null, error: fetchError.message };
    }

    const newStatus = current.status === 'active' ? 'paused' : 'active';

    const { data, error } = await supabase
        .from('scheduled_reminders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Get reminder history
export async function getReminderHistory(reminderId: string): Promise<{ data: ReminderHistory[] | null; error: string | null }> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from('reminder_history')
        .select(`
            *,
            application:applications(student_first_name, student_last_name)
        `)
        .eq('reminder_id', reminderId)
        .order('triggered_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Error fetching reminder history:', error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Evaluate and execute reminders - called by cron/scheduler
export async function evaluateReminders(): Promise<{ processed: number; errors: string[] }> {
    const supabase = createAdminServerClient();
    const errors: string[] = [];
    let processed = 0;

    // Get active reminders
    const { data: reminders, error } = await supabase
        .from('scheduled_reminders')
        .select('*')
        .eq('status', 'active');

    if (error || !reminders) {
        return { processed: 0, errors: [error?.message || 'Failed to fetch reminders'] };
    }

    for (const reminder of reminders) {
        try {
            const result = await evaluateReminder(reminder);
            processed += result.triggered;
            if (result.error) {
                errors.push(`${reminder.name}: ${result.error}`);
            }
        } catch (err) {
            errors.push(`${reminder.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }

    return { processed, errors };
}

// Evaluate a single reminder and trigger if conditions are met
async function evaluateReminder(reminder: ScheduledReminder): Promise<{ triggered: number; error: string | null }> {
    const supabase = createAdminServerClient();
    let triggered = 0;

    const config = (reminder.trigger_config || {}) as ReminderTriggerConfig;
    const mentionedStaffIds = extractMentionedStaffIds(config);
    let mentionedStaffRecipients: MentionedStaffRecipient[] = [];

    if (mentionedStaffIds.length > 0) {
        const { data: mentionedStaff, error: mentionsError } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .in('id', mentionedStaffIds)
            .in('role', STAFF_ROLES);

        if (!mentionsError && mentionedStaff) {
            mentionedStaffRecipients = mentionedStaff
                .filter((staff) => typeof staff.email === 'string' && isValidEmailAddress(staff.email))
                .map((staff) => ({
                    id: staff.id,
                    full_name: staff.full_name,
                    email: staff.email as string,
                }));
        }
    }

    if (reminder.trigger_type === 'stage_duration' && config.stage && config.days) {
        // Find applications in the specified stage for more than X days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - (config.days as number));

        const { data: applications, error } = await supabase
            .from('applications')
            .select('id, student_email, student_phone, student_first_name, student_last_name')
            .eq('workflow_stage', config.stage)
            .lt('workflow_stage_updated_at', cutoffDate.toISOString())
            .eq('is_deleted', false);

        if (error) {
            return { triggered: 0, error: error.message };
        }

        for (const app of applications || []) {
            // Check if reminder was already sent for this application recently
            const { data: recentHistory } = await supabase
                .from('reminder_history')
                .select('id')
                .eq('reminder_id', reminder.id)
                .eq('application_id', app.id)
                .gte('triggered_at', cutoffDate.toISOString())
                .limit(1);

            if (recentHistory && recentHistory.length > 0) {
                continue; // Already sent recently
            }

            const recipient = resolvePrimaryRecipient(reminder.notification_channel, config, app);
            if (!recipient) {
                continue;
            }

            if (reminder.notification_channel === 'email' && !isValidEmailAddress(recipient)) {
                continue;
            }

            if ((reminder.notification_channel === 'sms' || reminder.notification_channel === 'whatsapp') && !isLikelyPhoneNumber(recipient)) {
                continue;
            }

            const defaultBody = `Your application has been in ${config.stage} for ${config.days} days.`;
            const reminderMessage = stripMentionMarkup((reminder.custom_message || defaultBody).trim());

            // Queue notification
            const { data: notification, error: notifError } = await supabase
                .from('notification_queue')
                .insert({
                    channel: reminder.notification_channel,
                    recipient,
                    subject: `Reminder: Application Update Required`,
                    body: reminderMessage,
                    application_id: app.id,
                    template_id: reminder.template_id,
                    status: 'pending',
                })
                .select()
                .single();

            if (notifError) {
                continue;
            }

            let primaryDeliverySummary = 'queued';
            if (notification?.id) {
                const immediateResult = await processQueuedNotificationById(notification.id);
                primaryDeliverySummary = immediateResult.success
                    ? 'sent instantly'
                    : `queued (instant send failed: ${immediateResult.error || 'unknown error'})`;
            }

            let mentionsSentInstantly = 0;
            let mentionsFailedInstantly = 0;

            if (mentionedStaffRecipients.length > 0) {
                const studentName = `${app.student_first_name || ''} ${app.student_last_name || ''}`.trim() || 'Unknown Student';
                const mentionSubject = `Reminder Triggered: ${reminder.name}`;
                const mentionBody = [
                    `You were mentioned on reminder \"${reminder.name}\".`,
                    `Student: ${studentName}`,
                    `Channel: ${reminder.notification_channel}`,
                    '',
                    'Reminder message:',
                    reminderMessage,
                ].join('\n');

                const mentionNotifications = mentionedStaffRecipients.map((staff) => ({
                    channel: 'email' as const,
                    recipient: staff.email,
                    subject: mentionSubject,
                    body: mentionBody,
                    application_id: app.id,
                    status: 'pending' as const,
                    metadata: {
                        source: 'scheduled_reminder_mention',
                        reminder_id: reminder.id,
                        reminder_name: reminder.name,
                        mentioned_staff_id: staff.id,
                        mentioned_staff_name: staff.full_name,
                    },
                }));

                const { data: insertedMentionNotifications, error: mentionInsertError } = await supabase
                    .from('notification_queue')
                    .insert(mentionNotifications)
                    .select('id');

                if (!mentionInsertError && insertedMentionNotifications) {
                    for (const mentionNotification of insertedMentionNotifications) {
                        const mentionDelivery = await processQueuedNotificationById(mentionNotification.id);
                        if (mentionDelivery.success) {
                            mentionsSentInstantly++;
                        } else {
                            mentionsFailedInstantly++;
                        }
                    }
                } else if (mentionInsertError) {
                    mentionsFailedInstantly = mentionNotifications.length;
                }
            }

            // Log to history
            await supabase
                .from('reminder_history')
                .insert({
                    reminder_id: reminder.id,
                    application_id: app.id,
                    notification_id: notification?.id,
                    notes: `Triggered: stage ${config.stage} > ${config.days} days; primary delivery: ${primaryDeliverySummary}${mentionedStaffRecipients.length > 0 ? `; mentioned staff instantly sent: ${mentionsSentInstantly}, failed: ${mentionsFailedInstantly}` : ''}`,
                });

            triggered++;
        }
    }

    // Update last_run_at
    await supabase
        .from('scheduled_reminders')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', reminder.id);

    return { triggered, error: null };
}

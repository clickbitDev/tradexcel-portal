/**
 * Notification Service
 * Handles creating, fetching, and managing notifications
 */

import { createClient } from '@/lib/supabase/client';

export type NotificationType =
    | 'application_update'
    | 'document_uploaded'
    | 'document_verified'
    | 'comment_added'
    | 'mention'
    | 'payment_received'
    | 'reminder'
    | 'approval_required'
    | 'partner_update'
    | 'system_alert'
    | 'welcome'
    | 'deadline_warning'
    | 'assignment';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
    id: string;
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    related_table: string | null;
    related_id: string | null;
    metadata: Record<string, unknown>;
    is_read: boolean;
    read_at: string | null;
    priority: NotificationPriority;
    created_at: string;
    expires_at: string | null;
}

export interface NotificationPreferences {
    id: string;
    user_id: string;
    email_enabled: boolean;
    email_frequency: 'instant' | 'daily' | 'weekly' | 'never';
    in_app_application_updates: boolean;
    in_app_documents: boolean;
    in_app_comments: boolean;
    in_app_payments: boolean;
    in_app_reminders: boolean;
    in_app_system: boolean;
    email_application_updates: boolean;
    email_documents: boolean;
    email_comments: boolean;
    email_payments: boolean;
    email_reminders: boolean;
    email_system: boolean;
    quiet_hours_enabled: boolean;
    quiet_hours_start: string;
    quiet_hours_end: string;
}

/**
 * Get all notifications for the current user
 */
export async function getNotifications(options?: {
    unreadOnly?: boolean;
    limit?: number;
    type?: NotificationType;
}): Promise<Notification[]> {
    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        // Silently handle auth errors (expected during logout/navigation)
        if (authError || !user) {
            return [];
        }

        let query = supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (options?.unreadOnly) {
            query = query.eq('is_read', false);
        }

        if (options?.type) {
            query = query.eq('type', options.type);
        }

        if (options?.limit) {
            query = query.limit(options.limit);
        }

        const { data, error } = await query;

        if (error) {
            // Use debug level - notifications table might not exist yet
            console.debug('Notifications: fetch error (table may not exist):', error.message || error);
            return [];
        }

        return data || [];
    } catch (err) {
        // Handle AbortError and other unexpected errors silently
        console.debug('Notifications: unexpected error:', err);
        return [];
    }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(): Promise<number> {
    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        // Silently handle auth errors (expected during logout/navigation)
        if (authError || !user) {
            return 0;
        }

        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (error) {
            // Use debug level - notifications table might not exist yet
            console.debug('Notifications: count error (table may not exist):', error.message || error);
            return 0;
        }

        return count || 0;
    } catch (err) {
        // Handle AbortError and other unexpected errors silently
        console.debug('Notifications: unexpected count error:', err);
        return 0;
    }
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId: string): Promise<boolean> {
    const supabase = createClient();

    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

    return !error;
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(): Promise<number> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return 0;

    const { data, error } = await supabase.rpc('mark_all_notifications_read', {
        p_user_id: user.id
    });

    if (error) {
        console.error('Error marking all as read:', error);
        return 0;
    }

    return data || 0;
}

/**
 * Delete/dismiss a notification
 */
export async function dismissNotification(notificationId: string): Promise<boolean> {
    const supabase = createClient();

    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

    return !error;
}

/**
 * Create a notification (for internal use / triggers)
 */
export async function createNotification(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    relatedTable?: string;
    relatedId?: string;
    priority?: NotificationPriority;
    metadata?: Record<string, unknown>;
}): Promise<string | null> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('notifications')
        .insert([{
            user_id: params.userId,
            type: params.type,
            title: params.title,
            message: params.message,
            related_table: params.relatedTable || null,
            related_id: params.relatedId || null,
            priority: params.priority || 'normal',
            metadata: params.metadata || {},
        }])
        .select('id')
        .single();

    if (error) {
        console.error('Error creating notification:', error);
        return null;
    }

    return data?.id || null;
}

/**
 * Get notification preferences
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (error && error.code !== 'PGRST116') { // Not found is ok
        console.error('Error fetching preferences:', error);
    }

    return data || null;
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
    preferences: Partial<Omit<NotificationPreferences, 'id' | 'user_id'>>
): Promise<boolean> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return false;

    const { error } = await supabase
        .from('notification_preferences')
        .upsert({
            user_id: user.id,
            ...preferences,
            updated_at: new Date().toISOString(),
        });

    return !error;
}

/**
 * Subscribe to realtime notifications
 */
export function subscribeToNotifications(
    userId: string,
    onNotification: (notification: Notification) => void
) {
    const supabase = createClient();

    const channel = supabase
        .channel('notifications')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`,
            },
            (payload) => {
                onNotification(payload.new as Notification);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

/**
 * Get notification icon based on type
 */
export function getNotificationIcon(type: NotificationType): string {
    const icons: Record<NotificationType, string> = {
        application_update: '📋',
        document_uploaded: '📄',
        document_verified: '✅',
        comment_added: '💬',
        mention: '@',
        payment_received: '💰',
        reminder: '⏰',
        approval_required: '⚠️',
        partner_update: '🤝',
        system_alert: '🔔',
        welcome: '👋',
        deadline_warning: '⏳',
        assignment: '📌',
    };
    return icons[type] || '🔔';
}

/**
 * Get notification color based on priority
 */
export function getNotificationPriorityColor(priority: NotificationPriority): string {
    const colors: Record<NotificationPriority, string> = {
        low: 'text-gray-500',
        normal: 'text-blue-600',
        high: 'text-orange-500',
        urgent: 'text-red-600',
    };
    return colors[priority];
}

/**
 * Get link for notification navigation
 */
export function getNotificationLink(notification: Notification): string | null {
    if (!notification.related_table || !notification.related_id) return null;

    const metadata = notification.metadata as { application_id?: string } | null;

    const links: Record<string, string> = {
        applications: `/portal/applications/${notification.related_id}`,
        partners: `/portal/partners/${notification.related_id}`,
        rtos: '/portal/settings/rto',
        qualifications: `/portal/qualifications/${notification.related_id}`,
        documents: `/portal/applications/${metadata?.application_id || ''}`,
        invoices: `/portal/reports/invoices`,
    };

    return links[notification.related_table] || null;
}

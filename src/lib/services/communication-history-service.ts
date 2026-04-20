/**
 * Communication History Service
 * Tracks all emails/SMS sent, who sent them, when, and to whom
 */

import { createClient } from '@/lib/supabase/client';

export interface CommunicationRecord {
    id: string;
    channel: 'email' | 'sms' | 'whatsapp';
    recipient: string;
    recipientName: string | null;
    subject: string | null;
    body: string;
    status: 'pending' | 'sent' | 'failed' | 'cancelled';
    sentBy: string | null;
    sentByName: string | null;
    applicationId: string | null;
    invoiceId: string | null;
    billId: string | null;
    messageType: string | null;
    createdAt: string;
    // Related data
    applicationUid?: string;
    invoiceNumber?: string;
}

export interface CommunicationFilters {
    channel?: 'email' | 'sms' | 'whatsapp';
    status?: 'pending' | 'sent' | 'failed' | 'cancelled';
    fromDate?: string;
    toDate?: string;
    recipientSearch?: string;
    messageType?: string;
    sentBy?: string;
}

/**
 * Get communication history with filters
 */
export async function getCommunicationHistory(
    filters?: CommunicationFilters,
    limit = 100
): Promise<CommunicationRecord[]> {
    const supabase = createClient();

    let query = supabase
        .from('notification_logs')
        .select(`
            id,
            channel,
            recipient,
            recipient_name,
            subject,
            status,
            sent_by,
            invoice_id,
            bill_id,
            message_type,
            created_at,
            notification:notification_queue(
                body,
                application_id,
                application:applications(student_uid)
            ),
            sender:profiles!notification_logs_sent_by_fkey(full_name),
            invoice:invoices(invoice_number)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

    // Apply filters
    if (filters?.channel) {
        query = query.eq('channel', filters.channel);
    }
    if (filters?.status) {
        query = query.eq('status', filters.status);
    }
    if (filters?.fromDate) {
        query = query.gte('created_at', filters.fromDate);
    }
    if (filters?.toDate) {
        query = query.lte('created_at', filters.toDate);
    }
    if (filters?.recipientSearch) {
        query = query.or(`recipient.ilike.%${filters.recipientSearch}%,recipient_name.ilike.%${filters.recipientSearch}%`);
    }
    if (filters?.messageType) {
        query = query.eq('message_type', filters.messageType);
    }
    if (filters?.sentBy) {
        query = query.eq('sent_by', filters.sentBy);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching communication history:', error);
        return [];
    }

    return (data || []).map((record) => {
        const notification = record.notification as unknown as {
            body: string;
            application_id: string | null;
            application: { student_uid: string } | null;
        } | null;
        const sender = record.sender as unknown as { full_name: string } | null;
        const invoice = record.invoice as unknown as { invoice_number: string } | null;

        return {
            id: record.id,
            channel: record.channel as 'email' | 'sms' | 'whatsapp',
            recipient: record.recipient,
            recipientName: record.recipient_name,
            subject: record.subject,
            body: notification?.body || '',
            status: record.status as 'pending' | 'sent' | 'failed' | 'cancelled',
            sentBy: record.sent_by,
            sentByName: sender?.full_name || null,
            applicationId: notification?.application_id || null,
            invoiceId: record.invoice_id,
            billId: record.bill_id,
            messageType: record.message_type,
            createdAt: record.created_at,
            applicationUid: notification?.application?.student_uid,
            invoiceNumber: invoice?.invoice_number,
        };
    });
}

/**
 * Get communications for a specific application
 */
export async function getCommunicationsByApplication(
    applicationId: string
): Promise<CommunicationRecord[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('notification_logs')
        .select(`
            id,
            channel,
            recipient,
            recipient_name,
            subject,
            status,
            sent_by,
            invoice_id,
            bill_id,
            message_type,
            created_at,
            notification:notification_queue(body, application_id),
            sender:profiles!notification_logs_sent_by_fkey(full_name)
        `)
        .eq('notification.application_id', applicationId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching application communications:', error);
        return [];
    }

    return (data || []).map((record) => {
        const notification = record.notification as unknown as { body: string; application_id: string } | null;
        const sender = record.sender as unknown as { full_name: string } | null;

        return {
            id: record.id,
            channel: record.channel as 'email' | 'sms' | 'whatsapp',
            recipient: record.recipient,
            recipientName: record.recipient_name,
            subject: record.subject,
            body: notification?.body || '',
            status: record.status as 'pending' | 'sent' | 'failed' | 'cancelled',
            sentBy: record.sent_by,
            sentByName: sender?.full_name || null,
            applicationId: notification?.application_id || null,
            invoiceId: record.invoice_id,
            billId: record.bill_id,
            messageType: record.message_type,
            createdAt: record.created_at,
        };
    });
}

/**
 * Get communication stats for dashboard
 */
export async function getCommunicationStats(days = 30): Promise<{
    totalSent: number;
    emailsSent: number;
    smsSent: number;
    invoicesSent: number;
    failed: number;
}> {
    const supabase = createClient();
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('notification_logs')
        .select('channel, status, invoice_id')
        .gte('created_at', fromDate);

    if (error) {
        console.error('Error fetching communication stats:', error);
        return { totalSent: 0, emailsSent: 0, smsSent: 0, invoicesSent: 0, failed: 0 };
    }

    const stats = {
        totalSent: 0,
        emailsSent: 0,
        smsSent: 0,
        invoicesSent: 0,
        failed: 0,
    };

    for (const record of data || []) {
        if (record.status === 'sent') {
            stats.totalSent++;
            if (record.channel === 'email') stats.emailsSent++;
            if (record.channel === 'sms') stats.smsSent++;
            if (record.invoice_id) stats.invoicesSent++;
        } else if (record.status === 'failed') {
            stats.failed++;
        }
    }

    return stats;
}

/**
 * Log a sent communication
 */
export async function logCommunication(params: {
    notificationId?: string;
    channel: 'email' | 'sms' | 'whatsapp';
    recipient: string;
    recipientName?: string;
    subject?: string;
    status: 'sent' | 'failed';
    invoiceId?: string;
    billId?: string;
    messageType?: string;
}): Promise<string | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from('notification_logs')
        .insert({
            notification_id: params.notificationId || null,
            channel: params.channel,
            recipient: params.recipient,
            recipient_name: params.recipientName || null,
            subject: params.subject || null,
            status: params.status,
            sent_by: user?.id || null,
            invoice_id: params.invoiceId || null,
            bill_id: params.billId || null,
            message_type: params.messageType || 'manual',
        })
        .select('id')
        .single();

    if (error) {
        console.error('Error logging communication:', error);
        return null;
    }

    return data?.id || null;
}

/**
 * Get unique senders for filter dropdown
 */
export async function getUniqueSenders(): Promise<Array<{ id: string; name: string }>> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('notification_logs')
        .select('sent_by, sender:profiles!notification_logs_sent_by_fkey(full_name)')
        .not('sent_by', 'is', null);

    if (error) {
        console.error('Error fetching senders:', error);
        return [];
    }

    // Get unique senders
    const sendersMap = new Map<string, string>();
    for (const record of data || []) {
        if (record.sent_by && !sendersMap.has(record.sent_by)) {
            const sender = record.sender as unknown as { full_name: string } | null;
            sendersMap.set(record.sent_by, sender?.full_name || 'Unknown');
        }
    }

    return Array.from(sendersMap.entries()).map(([id, name]) => ({ id, name }));
}

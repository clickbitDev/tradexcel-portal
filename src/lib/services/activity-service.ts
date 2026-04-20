/**
 * Activity Service
 * Handles activity feed retrieval for records and global activity
 */

import { createClient } from '@/lib/supabase/client';
import type { RecordActivity } from '@/types/database';

export interface ActivityFeedOptions {
    limit?: number;
    offset?: number;
    userId?: string;
    tableNames?: string[];
    actions?: string[];
    fromDate?: string;
    toDate?: string;
}

/**
 * Get activity feed for a specific record
 */
export async function getRecordActivity(
    tableName: string,
    recordId: string,
    options: { limit?: number; offset?: number } = {}
): Promise<{ data: RecordActivity[]; count: number }> {
    const supabase = createClient();
    const { limit = 50, offset = 0 } = options;

    const { data, error, count } = await supabase
        .from('record_activity')
        .select('*', { count: 'exact' })
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('Failed to fetch record activity:', error);
        throw new Error(`Failed to fetch record activity: ${error.message}`);
    }

    return {
        data: (data || []) as RecordActivity[],
        count: count || 0,
    };
}

/**
 * Get recent activity across all records (for dashboard)
 */
export async function getRecentActivity(
    options: ActivityFeedOptions = {}
): Promise<{ data: RecordActivity[]; count: number }> {
    const supabase = createClient();
    const {
        limit = 50,
        offset = 0,
        userId,
        tableNames,
        actions,
        fromDate,
        toDate,
    } = options;

    let query = supabase
        .from('record_activity')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (userId) {
        query = query.eq('user_id', userId);
    }

    if (tableNames && tableNames.length > 0) {
        query = query.in('table_name', tableNames);
    }

    if (actions && actions.length > 0) {
        query = query.in('action', actions);
    }

    if (fromDate) {
        query = query.gte('created_at', fromDate);
    }

    if (toDate) {
        query = query.lte('created_at', toDate);
    }

    const { data, error, count } = await query;

    if (error) {
        console.error('Failed to fetch recent activity:', error);
        throw new Error(`Failed to fetch recent activity: ${error.message}`);
    }

    return {
        data: (data || []) as RecordActivity[],
        count: count || 0,
    };
}

/**
 * Get activity for multiple records (batch fetch)
 */
export async function getMultipleRecordsActivity(
    records: Array<{ tableName: string; recordId: string }>,
    options: { limit?: number } = {}
): Promise<RecordActivity[]> {
    const supabase = createClient();
    const { limit = 10 } = options;

    // Build OR conditions for each record
    const orConditions = records
        .map(r => `and(table_name.eq.${r.tableName},record_id.eq.${r.recordId})`)
        .join(',');

    const { data, error } = await supabase
        .from('record_activity')
        .select('*')
        .or(orConditions)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Failed to fetch multiple records activity:', error);
        throw new Error(`Failed to fetch activity: ${error.message}`);
    }

    return (data || []) as RecordActivity[];
}

/**
 * Get activity summary for a user
 */
export async function getUserActivitySummary(
    userId: string,
    days: number = 30
): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    actionsByTable: Record<string, number>;
}> {
    const supabase = createClient();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const { data, error } = await supabase
        .from('record_activity')
        .select('action, table_name')
        .eq('user_id', userId)
        .gte('created_at', fromDate.toISOString());

    if (error) {
        console.error('Failed to fetch user activity summary:', error);
        throw new Error(`Failed to fetch user activity: ${error.message}`);
    }

    const activities = data || [];
    const actionsByType: Record<string, number> = {};
    const actionsByTable: Record<string, number> = {};

    for (const activity of activities) {
        actionsByType[activity.action] = (actionsByType[activity.action] || 0) + 1;
        actionsByTable[activity.table_name] = (actionsByTable[activity.table_name] || 0) + 1;
    }

    return {
        totalActions: activities.length,
        actionsByType,
        actionsByTable,
    };
}

/**
 * Format activity action for display
 */
export function formatActivityAction(action: string): string {
    const actionLabels: Record<string, string> = {
        created: 'Created',
        update: 'Updated',
        delete: 'Deleted',
        restore: 'Restored',
        archive: 'Archived',
        unarchive: 'Unarchived',
        version_restored: 'Restored to previous version',
    };

    return actionLabels[action] || action.charAt(0).toUpperCase() + action.slice(1);
}

/**
 * Get action icon name for UI
 */
export function getActivityActionIcon(action: string): string {
    const actionIcons: Record<string, string> = {
        created: 'Plus',
        update: 'Edit',
        delete: 'Trash',
        restore: 'RotateCcw',
        archive: 'Archive',
        unarchive: 'ArchiveRestore',
        version_restored: 'History',
    };

    return actionIcons[action] || 'Circle';
}

/**
 * Get action color for UI
 */
export function getActivityActionColor(action: string): string {
    const actionColors: Record<string, string> = {
        created: 'text-green-600 bg-green-100',
        update: 'text-blue-600 bg-blue-100',
        delete: 'text-red-600 bg-red-100',
        restore: 'text-purple-600 bg-purple-100',
        archive: 'text-yellow-600 bg-yellow-100',
        unarchive: 'text-cyan-600 bg-cyan-100',
        version_restored: 'text-indigo-600 bg-indigo-100',
    };

    return actionColors[action] || 'text-gray-600 bg-gray-100';
}

/**
 * Format table name for display
 */
export function formatTableName(tableName: string): string {
    const tableLabels: Record<string, string> = {
        applications: 'Application',
        partners: 'Partner',
        rtos: 'RTO',
        qualifications: 'Qualification',
        rto_offerings: 'RTO Offering',
        documents: 'Document',
        invoices: 'Invoice',
        email_templates: 'Email Template',
        profiles: 'User Profile',
    };

    return tableLabels[tableName] || tableName;
}

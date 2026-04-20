/**
 * Archive Service
 * Handles archiving and unarchiving records
 */

import { createClient } from '@/lib/supabase/client';

export interface ArchiveResult {
    success: boolean;
    error?: string;
}

// Tables that support archiving
export const ARCHIVABLE_TABLES = [
    'applications',
    'partners',
    'rtos',
    'qualifications',
    'rto_offerings',
    'documents',
    'invoices',
    'email_templates',
] as const;

export type ArchivableTable = typeof ARCHIVABLE_TABLES[number];

/**
 * Archive a record (soft archive)
 */
export async function archiveRecord(
    tableName: ArchivableTable,
    recordId: string,
    reason?: string
): Promise<ArchiveResult> {
    const supabase = createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { success: false, error: 'Not authenticated' };
    }

    const { error } = await supabase
        .from(tableName)
        .update({
            is_archived: true,
            archived_at: new Date().toISOString(),
            archived_by: user.id,
        })
        .eq('id', recordId)
        .eq('is_deleted', false); // Cannot archive deleted records

    if (error) {
        console.error('Failed to archive record:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Unarchive a record
 */
export async function unarchiveRecord(
    tableName: ArchivableTable,
    recordId: string
): Promise<ArchiveResult> {
    const supabase = createClient();

    const { error } = await supabase
        .from(tableName)
        .update({
            is_archived: false,
            archived_at: null,
            archived_by: null,
        })
        .eq('id', recordId);

    if (error) {
        console.error('Failed to unarchive record:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Get archived records for a table
 */
export async function getArchivedRecords<T = unknown>(
    tableName: ArchivableTable,
    options: {
        limit?: number;
        offset?: number;
        select?: string;
    } = {}
): Promise<{ data: T[]; count: number }> {
    const supabase = createClient();
    const { limit = 50, offset = 0, select = '*' } = options;

    const { data, error, count } = await supabase
        .from(tableName)
        .select(select, { count: 'exact' })
        .eq('is_archived', true)
        .eq('is_deleted', false)
        .order('archived_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('Failed to fetch archived records:', error);
        throw new Error(`Failed to fetch archived records: ${error.message}`);
    }

    return {
        data: (data || []) as T[],
        count: count || 0,
    };
}

/**
 * Check if a record is archived
 */
export async function isRecordArchived(
    tableName: ArchivableTable,
    recordId: string
): Promise<boolean> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from(tableName)
        .select('is_archived')
        .eq('id', recordId)
        .single();

    if (error) {
        console.error('Failed to check archive status:', error);
        return false;
    }

    return data?.is_archived === true;
}

/**
 * Get archive summary across all tables
 */
export async function getArchiveSummary(): Promise<Record<ArchivableTable, number>> {
    const supabase = createClient();
    const summary: Record<string, number> = {};

    for (const tableName of ARCHIVABLE_TABLES) {
        const { count, error } = await supabase
            .from(tableName)
            .select('id', { count: 'exact', head: true })
            .eq('is_archived', true)
            .eq('is_deleted', false);

        if (!error) {
            summary[tableName] = count || 0;
        }
    }

    return summary as Record<ArchivableTable, number>;
}

/**
 * Bulk archive records
 */
export async function bulkArchiveRecords(
    tableName: ArchivableTable,
    recordIds: string[]
): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
    };

    for (const recordId of recordIds) {
        const result = await archiveRecord(tableName, recordId);
        if (result.success) {
            results.success++;
        } else {
            results.failed++;
            results.errors.push(`${recordId}: ${result.error}`);
        }
    }

    return results;
}

/**
 * Bulk unarchive records
 */
export async function bulkUnarchiveRecords(
    tableName: ArchivableTable,
    recordIds: string[]
): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
    };

    for (const recordId of recordIds) {
        const result = await unarchiveRecord(tableName, recordId);
        if (result.success) {
            results.success++;
        } else {
            results.failed++;
            results.errors.push(`${recordId}: ${result.error}`);
        }
    }

    return results;
}

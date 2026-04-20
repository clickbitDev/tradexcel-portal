/**
 * Trash Service
 * Handles soft delete and restore operations
 * No data is ever permanently deleted in this system
 */

import { createClient } from '@/lib/supabase/client';
import type { TrashItem } from '@/types/database';

export interface DeleteResult {
    success: boolean;
    error?: string;
}

// Tables that support soft delete
export const DELETABLE_TABLES = [
    'applications',
    'partners',
    'rtos',
    'qualifications',
    'rto_offerings',
    'documents',
    'invoices',
    'email_templates',
    'profiles',
] as const;

export type DeletableTable = typeof DELETABLE_TABLES[number];

/**
 * Soft delete a record (move to trash)
 */
export async function deleteRecord(
    tableName: DeletableTable,
    recordId: string,
    reason?: string
): Promise<DeleteResult> {
    if (tableName === 'profiles') {
        try {
            const response = await fetch(`/api/staff/${recordId}/delete`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                return { success: false, error: payload.error || 'Failed to delete staff account.' };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to delete staff account.' };
        }
    }

    const supabase = createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
        .from(tableName)
        .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: user.id,
        })
        .eq('id', recordId)
        .select('id');

    if (error) {
        console.error('Failed to delete record:', error);
        return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
        console.error('Delete operation affected 0 rows — possible RLS restriction, cascade trigger failure, or record not found:', { tableName, recordId });
        return { success: false, error: 'Unable to delete this record. You may not have permission, or a database constraint prevented the operation.' };
    }

    return { success: true };
}

/**
 * Restore a record from trash
 */
export async function restoreRecord(
    tableName: DeletableTable,
    recordId: string
): Promise<DeleteResult> {
    if (tableName === 'profiles') {
        try {
            const response = await fetch(`/api/staff/${recordId}/delete`, {
                method: 'POST',
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                return { success: false, error: payload.error || 'Failed to restore staff account.' };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to restore staff account.' };
        }
    }

    const supabase = createClient();

    const { error } = await supabase
        .from(tableName)
        .update({
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
        })
        .eq('id', recordId);

    if (error) {
        console.error('Failed to restore record:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Get all items in trash using the trash_bin view
 */
export async function getTrash(
    options: {
        tableNames?: DeletableTable[];
        limit?: number;
        offset?: number;
        search?: string;
    } = {}
): Promise<{ data: TrashItem[]; count: number }> {
    const supabase = createClient();
    const { tableNames, limit = 50, offset = 0, search } = options;

    let query = supabase
        .from('trash_bin')
        .select('*', { count: 'exact' })
        .order('deleted_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (tableNames && tableNames.length > 0) {
        query = query.in('table_name', tableNames);
    }

    if (search) {
        query = query.or(`display_name.ilike.%${search}%,identifier.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
        console.error('Failed to fetch trash:', error);
        throw new Error(`Failed to fetch trash: ${error.message}`);
    }

    return {
        data: (data || []) as TrashItem[],
        count: count || 0,
    };
}

/**
 * Get deleted records for a specific table
 */
export async function getDeletedRecords<T = unknown>(
    tableName: DeletableTable,
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
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('Failed to fetch deleted records:', error);
        throw new Error(`Failed to fetch deleted records: ${error.message}`);
    }

    return {
        data: (data || []) as T[],
        count: count || 0,
    };
}

/**
 * Get trash summary (count by table)
 */
export async function getTrashSummary(): Promise<Record<DeletableTable, number>> {
    const supabase = createClient();
    const summary: Record<string, number> = {};

    for (const tableName of DELETABLE_TABLES) {
        const { count, error } = await supabase
            .from(tableName)
            .select('id', { count: 'exact', head: true })
            .eq('is_deleted', true);

        if (!error) {
            summary[tableName] = count || 0;
        }
    }

    return summary as Record<DeletableTable, number>;
}

/**
 * Check if a record is in trash
 */
export async function isRecordDeleted(
    tableName: DeletableTable,
    recordId: string
): Promise<boolean> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from(tableName)
        .select('is_deleted')
        .eq('id', recordId)
        .single();

    if (error) {
        console.error('Failed to check delete status:', error);
        return false;
    }

    return data?.is_deleted === true;
}

/**
 * Bulk delete records (move to trash)
 */
export async function bulkDeleteRecords(
    tableName: DeletableTable,
    recordIds: string[]
): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
    };

    for (const recordId of recordIds) {
        const result = await deleteRecord(tableName, recordId);
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
 * Bulk restore records from trash
 */
export async function bulkRestoreRecords(
    tableName: DeletableTable,
    recordIds: string[]
): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
    };

    for (const recordId of recordIds) {
        const result = await restoreRecord(tableName, recordId);
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
 * Get table display name
 */
export function getTableDisplayName(tableName: string): string {
    const tableNames: Record<string, string> = {
        applications: 'Applications',
        partners: 'Partners',
        rtos: 'RTOs',
        qualifications: 'Qualifications',
        rto_offerings: 'RTO Offerings',
        documents: 'Documents',
        invoices: 'Invoices',
        email_templates: 'Email Templates',
        profiles: 'User Profiles',
    };

    return tableNames[tableName] || tableName;
}

/**
 * Empty trash - permanently delete (DISABLED by default for compliance)
 * This function is intentionally not implemented to ensure no data is ever permanently deleted.
 * Uncomment and implement only if permanent deletion is explicitly required.
 */
// export async function emptyTrash(
//     tableName: DeletableTable,
//     recordId: string,
//     confirmation: string
// ): Promise<DeleteResult> {
//     // Requires typing "PERMANENTLY DELETE" to confirm
//     if (confirmation !== 'PERMANENTLY DELETE') {
//         return { success: false, error: 'Invalid confirmation' };
//     }
//     
//     // PERMANENTLY DELETE - USE WITH EXTREME CAUTION
//     // This bypasses all version control and cannot be undone
//     
//     return { success: false, error: 'Permanent deletion is disabled for compliance' };
// }

/**
 * Version Control Service
 * Handles version history retrieval, comparison, and restoration
 */

import { createClient } from '@/lib/supabase/client';
import type { RecordVersion, FieldDiff, Profile } from '@/types/database';

export interface VersionHistoryOptions {
    limit?: number;
    offset?: number;
    includeUser?: boolean;
}

/**
 * Get version history for a record
 */
export async function getVersionHistory(
    tableName: string,
    recordId: string,
    options: VersionHistoryOptions = {}
): Promise<{ data: RecordVersion[]; count: number }> {
    const supabase = createClient();
    const { limit = 50, offset = 0, includeUser = true } = options;

    let query = supabase
        .from('record_versions')
        .select('*, user:profiles!changed_by(id, full_name, avatar_url)', { count: 'exact' })
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .order('version_number', { ascending: false })
        .range(offset, offset + limit - 1);

    if (!includeUser) {
        query = supabase
            .from('record_versions')
            .select('*', { count: 'exact' })
            .eq('table_name', tableName)
            .eq('record_id', recordId)
            .order('version_number', { ascending: false })
            .range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query;

    if (error) {
        console.error('Failed to fetch version history:', error);
        throw new Error(`Failed to fetch version history: ${error.message}`);
    }

    return {
        data: (data || []) as RecordVersion[],
        count: count || 0,
    };
}

/**
 * Get a specific version of a record
 */
export async function getVersion(
    tableName: string,
    recordId: string,
    versionNumber: number
): Promise<RecordVersion | null> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('record_versions')
        .select('*, user:profiles!changed_by(id, full_name, avatar_url)')
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .eq('version_number', versionNumber)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return null; // Not found
        }
        console.error('Failed to fetch version:', error);
        throw new Error(`Failed to fetch version: ${error.message}`);
    }

    return data as RecordVersion;
}

/**
 * Get the current version number for a record
 */
export async function getCurrentVersionNumber(
    tableName: string,
    recordId: string
): Promise<number> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('record_versions')
        .select('version_number')
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return 0; // No versions yet
        }
        throw new Error(`Failed to get current version: ${error.message}`);
    }

    return data?.version_number || 0;
}

/**
 * Compare two versions and return the differences
 */
export async function compareVersions(
    tableName: string,
    recordId: string,
    fromVersion: number,
    toVersion: number
): Promise<FieldDiff[]> {
    const [from, to] = await Promise.all([
        getVersion(tableName, recordId, fromVersion),
        getVersion(tableName, recordId, toVersion),
    ]);

    if (!from || !to) {
        throw new Error('One or both versions not found');
    }

    const diffs: FieldDiff[] = [];
    const allKeys = new Set([
        ...Object.keys(from.data),
        ...Object.keys(to.data),
    ]);

    // Fields to exclude from comparison
    const excludedFields = ['updated_at', 'created_at', 'id'];

    for (const key of allKeys) {
        if (excludedFields.includes(key)) continue;

        const oldValue = from.data[key];
        const newValue = to.data[key];

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            diffs.push({
                field: key,
                old_value: oldValue,
                new_value: newValue,
            });
        }
    }

    return diffs;
}

/**
 * Restore a record to a previous version
 * This calls the database function which handles the update
 */
export async function restoreVersion(
    tableName: string,
    recordId: string,
    versionNumber: number,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();

    const { data, error } = await supabase.rpc('restore_to_version', {
        p_table_name: tableName,
        p_record_id: recordId,
        p_version_number: versionNumber,
        p_reason: reason || null,
    });

    if (error) {
        console.error('Failed to restore version:', error);
        return { success: false, error: error.message };
    }

    return { success: !!data };
}

/**
 * Get the field labels for a table (for display purposes)
 */
export function getFieldLabel(tableName: string, fieldName: string): string {
    const fieldLabels: Record<string, Record<string, string>> = {
        applications: {
            student_first_name: 'First Name',
            student_last_name: 'Last Name',
            student_email: 'Email',
            student_phone: 'Phone',
            student_dob: 'Date of Birth',
            student_passport_number: 'Passport Number',
            student_nationality: 'Nationality',
            workflow_stage: 'Workflow Stage',
            payment_status: 'Payment Status',
            quoted_tuition: 'Quoted Tuition',
            quoted_materials: 'Material Fee',
            intake_date: 'Appointment Date',
            appointment_date: 'Appointment Date',
            appointment_time: 'Appointment Time',
            notes: 'Notes',
            offering_id: 'Course Offering',
            partner_id: 'Partner',
        },
        partners: {
            company_name: 'Company Name',
            contact_name: 'Contact Name',
            email: 'Email',
            phone: 'Phone',
            country: 'Country',
            status: 'Status',
            priority_level: 'Priority Level',
            commission_rate: 'Commission Rate',
            type: 'Partner Type',
        },
        rtos: {
            code: 'RTO Code',
            name: 'Name',
            status: 'Status',
            location: 'Location',
            state: 'State',
            phone: 'Phone',
            email: 'Email',
            website: 'Website',
        },
        qualifications: {
            code: 'Code',
            name: 'Name',
            level: 'Level',
            status: 'Status',
        },
        invoices: {
            invoice_number: 'Invoice Number',
            student_name: 'Student Name',
            total_amount: 'Total Amount',
            status: 'Status',
            due_date: 'Due Date',
        },
    };

    return fieldLabels[tableName]?.[fieldName] || formatFieldName(fieldName);
}

/**
 * Format a snake_case field name to Title Case
 */
function formatFieldName(fieldName: string): string {
    return fieldName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Format a value for display
 */
export function formatValueForDisplay(value: unknown): string {
    if (value === null || value === undefined) {
        return '—';
    }
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    if (Array.isArray(value)) {
        return value.join(', ');
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}

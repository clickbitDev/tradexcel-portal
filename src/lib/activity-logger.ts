'use client';

export type ActivityAction =
    | 'created'
    | 'updated'
    | 'comment_added'
    | 'document_uploaded'
    | 'document_deleted'
    | 'document_verified'
    | 'document_unverified'
    | 'stage_changed'
    | 'payment_changed'
    | 'assigned'
    | 'unassigned'
    | 'extracted_data'
    | 'invoice_created_in_xero'
    | 'bill_created_in_xero'
    | 'exported';

interface LogActivityParams {
    applicationId: string;
    action: ActivityAction;
    fieldChanged?: string;
    oldValue?: string | null;
    newValue?: string | null;
    metadata?: Record<string, unknown>;
}

/**
 * Log an activity entry to the application history
 */
export async function logActivity({
    applicationId,
    action,
    fieldChanged,
    oldValue,
    newValue,
    metadata
}: LogActivityParams): Promise<boolean> {
    const response = await fetch(`/api/applications/${applicationId}/activity`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            entries: [{
                action,
                fieldChanged: fieldChanged || action,
                oldValue: oldValue || null,
                newValue: newValue || null,
                metadata: metadata || null,
            }],
        }),
    });

    return response.ok;
}

/**
 * Format a field name for display
 */
export function formatFieldName(field: string): string {
    return field
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Log multiple field changes at once
 */
export async function logFieldChanges(
    applicationId: string,
    changes: Record<string, { old: string | null; new: string | null }>
): Promise<boolean> {
    const entries = Object.entries(changes)
        .filter(([, values]) => values.old !== values.new)
        .map(([field, values]) => ({
            action: 'updated' as ActivityAction,
            fieldChanged: field,
            oldValue: values.old,
            newValue: values.new,
        }));

    if (entries.length === 0) return true;

    const response = await fetch(`/api/applications/${applicationId}/activity`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entries }),
    });

    return response.ok;
}

import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';

interface TimelineEntry {
    id: string;
    type: 'transition' | 'assignment' | 'alert' | 'activity';
    title: string;
    description: string;
    createdAt: string;
    metadata: Record<string, unknown>;
}

interface ApplicationHistoryRow {
    id: string;
    created_at: string;
    action?: string | null;
    field_changed?: string | null;
    old_value?: string | null;
    new_value?: string | null;
    metadata?: Record<string, unknown> | string | null;
    notes?: string | null;
    user_id?: string | null;
    changed_by?: string | null;
    from_stage?: string | null;
    to_stage?: string | null;
}

function toObjectMetadata(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return value as Record<string, unknown>;
}

function parseHistoryMetadata(value: unknown): Record<string, unknown> {
    if (!value) {
        return {};
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return toObjectMetadata(parsed);
        } catch {
            return {};
        }
    }

    return toObjectMetadata(value);
}

function formatActivityTitle(row: ApplicationHistoryRow): string {
    if (row.field_changed) {
        return `Updated ${row.field_changed.replace(/_/g, ' ')}`;
    }

    if (row.action) {
        return row.action.replace(/_/g, ' ');
    }

    if (row.from_stage || row.to_stage) {
        const fromStage = row.from_stage || 'Unknown';
        const toStage = row.to_stage || 'Updated';
        return `${fromStage} -> ${toStage}`;
    }

    return 'Application activity';
}

function formatActivityDescription(row: ApplicationHistoryRow): string {
    if (row.notes && row.notes.trim().length > 0) {
        return row.notes;
    }

    if (row.new_value && row.new_value.trim().length > 0) {
        return row.new_value;
    }

    if (row.old_value && row.old_value.trim().length > 0) {
        return `Previous value: ${row.old_value}`;
    }

    return 'Application activity updated';
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'view',
        applicationId: id,
    });

    if (!authz.ok) {
        return authz.response;
    }

    const [transitionsResult, assignmentsResult, alertsResult, historyResult] = await Promise.all([
        authz.context.supabase
            .from('workflow_transition_events')
            .select('id, from_stage, to_stage, actor_id, notes, metadata, created_at')
            .eq('application_id', id)
            .order('created_at', { ascending: false })
            .limit(50),
        authz.context.supabase
            .from('workflow_assignments')
            .select('id, stage, assignee_id, assigned_by, is_active, assigned_at, unassigned_at, metadata')
            .eq('application_id', id)
            .order('assigned_at', { ascending: false })
            .limit(50),
        authz.context.supabase
            .from('workflow_alerts')
            .select('id, alert_type, severity, title, message, status, raised_by, resolved_by, resolved_at, metadata, created_at')
            .eq('application_id', id)
            .order('created_at', { ascending: false })
            .limit(50),
        authz.context.supabase
            .from('application_history')
            .select('*')
            .eq('application_id', id)
            .order('created_at', { ascending: false })
            .limit(50),
    ]);

    if (transitionsResult.error || assignmentsResult.error || alertsResult.error || historyResult.error) {
        return NextResponse.json(
            {
                error:
                    transitionsResult.error?.message
                    || assignmentsResult.error?.message
                    || alertsResult.error?.message
                    || historyResult.error?.message
                    || 'Failed to load timeline',
            },
            { status: 500 }
        );
    }

    const transitionEntries: TimelineEntry[] = (transitionsResult.data || []).map((row) => ({
        id: `transition:${row.id}`,
        type: 'transition',
        title: `${row.from_stage} -> ${row.to_stage}`,
        description: row.notes || 'Workflow stage changed',
        createdAt: row.created_at,
        metadata: {
            actorId: row.actor_id,
            ...toObjectMetadata(row.metadata),
        },
    }));

    const assignmentEntries: TimelineEntry[] = (assignmentsResult.data || []).map((row) => ({
        id: `assignment:${row.id}`,
        type: 'assignment',
        title: `${row.stage} assignment ${row.is_active ? 'set' : 'ended'}`,
        description: row.is_active
            ? `Assigned to ${row.assignee_id}`
            : `Unassigned from ${row.assignee_id}`,
        createdAt: row.is_active ? row.assigned_at : (row.unassigned_at || row.assigned_at),
        metadata: {
            assigneeId: row.assignee_id,
            assignedBy: row.assigned_by,
            ...toObjectMetadata(row.metadata),
        },
    }));

    const alertEntries: TimelineEntry[] = (alertsResult.data || []).map((row) => ({
        id: `alert:${row.id}`,
        type: 'alert',
        title: `${row.status === 'resolved' ? 'Resolved' : 'Raised'} ${row.alert_type}`,
        description: row.message || row.title,
        createdAt: row.status === 'resolved' ? (row.resolved_at || row.created_at) : row.created_at,
        metadata: {
            severity: row.severity,
            status: row.status,
            raisedBy: row.raised_by,
            resolvedBy: row.resolved_by,
            ...toObjectMetadata(row.metadata),
        },
    }));

    const activityEntries: TimelineEntry[] = (historyResult.data || []).map((entry) => {
        const row = entry as ApplicationHistoryRow;

        return {
            id: `activity:${row.id}`,
            type: 'activity',
            title: formatActivityTitle(row),
            description: formatActivityDescription(row),
            createdAt: row.created_at,
            metadata: {
                userId: row.user_id || row.changed_by || null,
                action: row.action || null,
                fieldChanged: row.field_changed || null,
                oldValue: row.old_value || null,
                newValue: row.new_value || null,
                fromStage: row.from_stage || null,
                toStage: row.to_stage || null,
                ...parseHistoryMetadata(row.metadata),
            },
        };
    });

    const entries = [...transitionEntries, ...assignmentEntries, ...alertEntries, ...activityEntries]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({ data: entries });
}

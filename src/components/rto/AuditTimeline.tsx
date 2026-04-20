'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Plus, Edit, Trash2, Archive, ArchiveRestore, RotateCcw } from 'lucide-react';
import type { Profile, RecordActivity } from '@/types/database';

interface TimelineUser {
    full_name: Profile['full_name'];
    email: Profile['email'];
}

export interface TimelineLog extends RecordActivity {
    user?: TimelineUser | null;
}

interface AuditTimelineProps {
    logs: TimelineLog[];
    loading?: boolean;
}

const ACTION_CONFIG = {
    created: {
        label: 'Created',
        color: 'bg-green-100 text-green-700',
        icon: Plus,
    },
    update: {
        label: 'Updated',
        color: 'bg-blue-100 text-blue-700',
        icon: Edit,
    },
    archive: {
        label: 'Archived',
        color: 'bg-amber-100 text-amber-700',
        icon: Archive,
    },
    unarchive: {
        label: 'Unarchived',
        color: 'bg-cyan-100 text-cyan-700',
        icon: ArchiveRestore,
    },
    delete: {
        label: 'Deleted',
        color: 'bg-red-100 text-red-700',
        icon: Trash2,
    },
    restore: {
        label: 'Restored',
        color: 'bg-purple-100 text-purple-700',
        icon: RotateCcw,
    },
    price_update: {
        label: 'Price Updated',
        color: 'bg-indigo-100 text-indigo-700',
        icon: Edit,
    },
    insert: {
        label: 'Created',
        color: 'bg-green-100 text-green-700',
        icon: Plus,
    },
    delete_legacy: {
        label: 'Deleted',
        color: 'bg-red-100 text-red-700',
        icon: Trash2,
    },
};

function formatValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '(empty)';
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    return String(value);
}

function getEntityLabel(tableName: string): string {
    if (tableName === 'rtos') return 'RTO';
    if (tableName === 'rto_offerings') return 'Pricing';
    return tableName.replace(/_/g, ' ');
}

export function AuditTimeline({ logs, loading }: AuditTimelineProps) {
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) {
            return diffMins <= 1 ? 'just now' : `${diffMins} minutes ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleString('en-AU', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        }
    };

    const getFieldChanges = (log: TimelineLog): Array<{ field: string; oldValue: string; newValue: string }> => {
        const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];
        const oldData = log.details?.old_values || {};
        const newData = log.details?.new_values || {};

        const keys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));

        // Compare old and new data
        keys.forEach((key) => {
            if (key === 'updated_at' || key === 'created_at') {
                return;
            }

            const oldValue = oldData[key];
            const newValue = newData[key];
            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                changes.push({
                    field: key,
                    oldValue: formatValue(oldValue),
                    newValue: formatValue(newValue),
                });
            }
        });

        return changes;
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Change History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (logs.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Change History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No changes recorded yet</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Change History ({logs.length})
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative space-y-4">
                    {/* Timeline line */}
                    <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-border" />

                    {logs.map((log) => {
                        const actionKey = log.action.toLowerCase();
                        const normalizedActionKey = actionKey === 'delete' ? 'delete' : actionKey;
                        const config = ACTION_CONFIG[normalizedActionKey as keyof typeof ACTION_CONFIG] || {
                            label: log.action,
                            color: 'bg-gray-100 text-gray-700',
                            icon: History,
                        };
                        const Icon = config.icon;
                        const changes = getFieldChanges(log);
                        const actor = log.user_name || log.user?.full_name || log.user?.email || 'System';
                        const entityLabel = getEntityLabel(log.table_name);

                        return (
                            <div key={log.id} className="relative pl-8">
                                {/* Timeline dot */}
                                <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                                    <Icon className="h-3 w-3 text-primary" />
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge className={config.color}>
                                            {config.label}
                                        </Badge>
                                        <span className="text-sm text-muted-foreground">
                                            {formatDate(log.created_at)}
                                        </span>
                                        <Badge variant="outline" className="text-xs">
                                            {entityLabel}
                                        </Badge>
                                        <span className="text-sm text-muted-foreground">
                                            by {actor}
                                        </span>
                                    </div>

                                    {/* Show field changes for updates */}
                                    {changes.length > 0 && (
                                        <div className="mt-2 space-y-1 text-sm">
                                            {changes.map((change, idx) => (
                                                <div key={idx} className="bg-muted/50 rounded p-2">
                                                    <p className="font-medium text-foreground capitalize">
                                                        {change.field.replace(/_/g, ' ')}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                        <span className="line-through">
                                                            {change.oldValue || '(empty)'}
                                                        </span>
                                                        <span>→</span>
                                                        <span className="font-medium text-foreground">
                                                            {change.newValue || '(empty)'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {changes.length === 0 && log.summary && (
                                        <p className="text-sm text-muted-foreground">
                                            {log.summary}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

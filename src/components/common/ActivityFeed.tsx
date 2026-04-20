'use client';

import React, { useState, useEffect } from 'react';
import {
    Activity,
    Plus,
    Edit,
    Trash2,
    RotateCcw,
    Archive,
    ArchiveRestore,
    History,
    User,
    Circle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { RecordActivity } from '@/types/database';
import {
    getRecordActivity,
    getRecentActivity,
    formatActivityAction,
    getActivityActionColor,
    formatTableName,
} from '@/lib/services/activity-service';

interface ActivityFeedProps {
    /** If provided, shows activity for a specific record */
    tableName?: string;
    recordId?: string;
    /** If true, shows global recent activity */
    global?: boolean;
    /** Maximum height for scroll area */
    maxHeight?: string;
    /** Maximum items to show */
    limit?: number;
    /** Whether to show the table name */
    showTableName?: boolean;
    /** Render without card/header wrapper for embedded layouts */
    embedded?: boolean;
}

const ActionIcons: Record<string, React.ElementType> = {
    created: Plus,
    update: Edit,
    delete: Trash2,
    restore: RotateCcw,
    archive: Archive,
    unarchive: ArchiveRestore,
    version_restored: History,
};

export function ActivityFeed({
    tableName,
    recordId,
    global = false,
    maxHeight = '400px',
    limit = 50,
    showTableName = false,
    embedded = false,
}: ActivityFeedProps) {
    const [activities, setActivities] = useState<RecordActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadActivities();
    }, [tableName, recordId, global, limit]);

    async function loadActivities() {
        try {
            setLoading(true);
            setError(null);

            let result;
            if (global) {
                result = await getRecentActivity({ limit });
            } else if (tableName && recordId) {
                result = await getRecordActivity(tableName, recordId, { limit });
            } else {
                setActivities([]);
                return;
            }

            setActivities(result.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load activity');
        } finally {
            setLoading(false);
        }
    }

    function formatRelativeTime(dateString: string): string {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return new Intl.DateTimeFormat('en-AU', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(date);
    }

    function getChangeSummary(activity: RecordActivity): string {
        if (!activity.details?.changed_fields) {
            return activity.summary;
        }

        const fields = activity.details.changed_fields as string[];
        if (fields.length === 0) return activity.summary;

        if (fields.length <= 2) {
            return `Updated ${fields.join(', ')}`;
        }

        return `Updated ${fields.slice(0, 2).join(', ')} and ${fields.length - 2} more`;
    }

    if (loading) {
        const loadingContent = (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-1">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/4" />
                        </div>
                    </div>
                ))}
            </div>
        );

        if (embedded) {
            return loadingContent;
        }

        return (
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Activity className="h-4 w-4" />
                        Activity
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loadingContent}
                </CardContent>
            </Card>
        );
    }

    if (error) {
        const errorContent = (
            <>
                <p className="text-sm text-red-500">{error}</p>
                <Button variant="outline" size="sm" onClick={loadActivities} className="mt-2">
                    Retry
                </Button>
            </>
        );

        if (embedded) {
            return <div>{errorContent}</div>;
        }

        return (
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Activity className="h-4 w-4" />
                        Activity
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {errorContent}
                </CardContent>
            </Card>
        );
    }

    const activitiesContent = activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
    ) : (
        <ScrollArea style={{ maxHeight }}>
            <div className="space-y-4">
                {activities.map((activity) => {
                    const IconComponent = ActionIcons[activity.action] || Circle;
                    const colorClass = getActivityActionColor(activity.action);

                    return (
                        <div key={activity.id} className="flex items-start gap-3">
                            {/* Icon */}
                            <div
                                className={`flex items-center justify-center h-8 w-8 rounded-full ${colorClass}`}
                            >
                                <IconComponent className="h-4 w-4" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm">
                                        {activity.user_name || 'System'}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {formatActivityAction(activity.action).toLowerCase()}
                                    </span>
                                    {showTableName && (
                                        <Badge variant="outline" className="text-xs">
                                            {formatTableName(activity.table_name)}
                                        </Badge>
                                    )}
                                </div>

                                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                                    {getChangeSummary(activity)}
                                </p>

                                {/* Changed fields details */}
                                {activity.details?.old_values && activity.details?.new_values && (
                                    <div className="mt-2 text-xs">
                                        <details className="group">
                                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                                View changes
                                            </summary>
                                            <div className="mt-2 space-y-1 pl-2 border-l-2 border-muted">
                                                {Object.entries(activity.details.new_values as Record<string, unknown>).map(
                                                    ([field, newValue]) => {
                                                        const oldValue = (activity.details?.old_values as Record<string, unknown>)?.[field];
                                                        return (
                                                            <div key={field} className="text-muted-foreground">
                                                                <span className="font-medium">{field}:</span>{' '}
                                                                <span className="line-through text-red-500">
                                                                    {String(oldValue ?? '—')}
                                                                </span>{' '}
                                                                →{' '}
                                                                <span className="text-green-500">
                                                                    {String(newValue ?? '—')}
                                                                </span>
                                                            </div>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        </details>
                                    </div>
                                )}

                                <p className="text-xs text-muted-foreground mt-1">
                                    {formatRelativeTime(activity.created_at)}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );

    if (embedded) {
        return activitiesContent;
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4" />
                    Activity
                    {activities.length > 0 && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                            {activities.length}
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>{activitiesContent}</CardContent>
        </Card>
    );
}

/**
 * Compact activity feed for inline use
 */
export function ActivityFeedInline({
    tableName,
    recordId,
    limit = 5,
}: {
    tableName: string;
    recordId: string;
    limit?: number;
}) {
    const [activities, setActivities] = useState<RecordActivity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const result = await getRecordActivity(tableName, recordId, { limit });
                setActivities(result.data);
            } catch (err) {
                console.error('Failed to load activity:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [tableName, recordId, limit]);

    if (loading) {
        return (
            <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                ))}
            </div>
        );
    }

    if (activities.length === 0) {
        return <p className="text-xs text-muted-foreground">No activity</p>;
    }

    return (
        <div className="space-y-2">
            {activities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-2 text-xs">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{activity.user_name || 'System'}</span>
                    <span className="text-muted-foreground">{activity.summary}</span>
                </div>
            ))}
        </div>
    );
}

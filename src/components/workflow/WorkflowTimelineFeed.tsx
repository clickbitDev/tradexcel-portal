'use client';

import { useEffect } from 'react';
import { Activity, AlertCircle, Clock3, Loader2, Shuffle, UserCheck } from 'lucide-react';
import { useGetWorkflowTimelineQuery } from '@/store/services/workflowApi';

interface WorkflowTimelineFeedProps {
    applicationId: string;
    refreshKey?: number;
}

function TimelineIcon({ type }: { type: 'transition' | 'assignment' | 'alert' | 'activity' }) {
    if (type === 'assignment') {
        return <UserCheck className="h-4 w-4 text-blue-500" />;
    }

    if (type === 'alert') {
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }

    if (type === 'activity') {
        return <Activity className="h-4 w-4 text-violet-500" />;
    }

    return <Shuffle className="h-4 w-4 text-primary" />;
}

export function WorkflowTimelineFeed({ applicationId, refreshKey }: WorkflowTimelineFeedProps) {
    const { data, isLoading, refetch } = useGetWorkflowTimelineQuery({ applicationId });
    const entries = data?.data || [];

    useEffect(() => {
        if (typeof refreshKey === 'number') {
            void refetch();
        }
    }, [refreshKey, refetch]);

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading workflow timeline...
            </div>
        );
    }

    if (entries.length === 0) {
        return <p className="text-sm text-muted-foreground">No workflow timeline events yet.</p>;
    }

    return (
        <div className="space-y-3">
            {entries.slice(0, 10).map((entry) => (
                <div key={entry.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <TimelineIcon type={entry.type} />
                            <p className="text-sm font-medium">{entry.title}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                            <Clock3 className="mr-1 inline h-3 w-3" />
                            {new Date(entry.createdAt).toLocaleString()}
                        </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>
                </div>
            ))}
        </div>
    );
}

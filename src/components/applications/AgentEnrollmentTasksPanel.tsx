'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WorkflowStage } from '@/types/database';
import { Loader2, Mail, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getWorkflowErrorFromPayload, getWorkflowErrorFromUnknown } from '@/lib/workflow/error-messages';

interface AgentTaskStateSnapshot {
    workflow_stage: WorkflowStage;
    updated_at: string;
    agent_frontdesk_notified: boolean;
    agent_frontdesk_notified_at: string | null;
}

interface AgentEnrollmentTasksPanelProps {
    applicationId: string;
    workflowStage: WorkflowStage;
    canEdit: boolean;
    studentName: string;
    frontdeskNotified: boolean;
    frontdeskNotifiedAt: string | null;
    onTaskStateUpdate: (taskState: AgentTaskStateSnapshot) => void;
    onRefresh: () => void;
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) {
        return '-';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return '-';
    }

    return parsed.toLocaleString('en-AU', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

export function AgentEnrollmentTasksPanel({
    applicationId,
    workflowStage,
    canEdit,
    studentName,
    frontdeskNotified,
    frontdeskNotifiedAt,
    onTaskStateUpdate,
    onRefresh,
}: AgentEnrollmentTasksPanelProps) {
    const [notifyingFrontdesk, setNotifyingFrontdesk] = useState(false);

    const isDocsReview = workflowStage === 'docs_review';

    const handleNotifyFrontdesk = async () => {
        setNotifyingFrontdesk(true);
        try {
            const response = await fetch(`/api/applications/${applicationId}/agent-tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'notify_frontdesk',
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                toast.error('Unable to notify frontdesk', {
                    description: getWorkflowErrorFromPayload(
                        payload,
                        'Unable to notify frontdesk right now. Please try again.'
                    ),
                });
                return;
            }

            onTaskStateUpdate(payload.data.application as AgentTaskStateSnapshot);
            onRefresh();
            toast.success('Frontdesk notified successfully.');
        } catch (error) {
            toast.error('Unable to notify frontdesk', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to notify frontdesk right now. Please try again.'
                ),
            });
        } finally {
            setNotifyingFrontdesk(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Agent Enrollment Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-md border p-3">
                    <div className="space-y-1">
                        <p className="text-sm font-medium">Notify frontdesk about this application</p>
                        <p className="text-xs text-muted-foreground">
                            Sends an in-app notification and email so the frontdesk team can review {studentName || 'this application'}.
                        </p>
                    </div>
                    <Badge variant="outline" className={frontdeskNotified ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}>
                        {frontdeskNotified ? 'Completed' : 'Pending'}
                    </Badge>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    disabled={!canEdit || !isDocsReview || frontdeskNotified || notifyingFrontdesk}
                    onClick={handleNotifyFrontdesk}
                >
                    {notifyingFrontdesk ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Mail className="mr-2 h-4 w-4" />
                    )}
                    Notify Frontdesk
                </Button>

                {frontdeskNotifiedAt ? (
                    <p className="text-xs text-muted-foreground">
                        Last notified: <span className="font-medium">{formatDateTime(frontdeskNotifiedAt)}</span>
                    </p>
                ) : null}

                {!isDocsReview ? (
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        This task becomes available while the application is in docs review.
                    </div>
                ) : null}

                {isDocsReview && !canEdit ? (
                    <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        Frontdesk notification is currently locked for editing.
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}

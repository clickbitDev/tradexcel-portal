'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Siren } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
    useCreateWorkflowAlertMutation,
    useGetWorkflowAlertsQuery,
    useUpdateWorkflowAlertMutation,
} from '@/store/services/workflowApi';
import { getWorkflowErrorFromUnknown } from '@/lib/workflow/error-messages';

interface WorkflowAlertsPanelProps {
    applicationId: string;
    canEdit: boolean;
}

export function WorkflowAlertsPanel({ applicationId, canEdit }: WorkflowAlertsPanelProps) {
    const [alertType, setAlertType] = useState('workflow');
    const [severity, setSeverity] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');

    const alertsQuery = useGetWorkflowAlertsQuery({ applicationId, status: 'open' });
    const [createAlert, createAlertState] = useCreateWorkflowAlertMutation();
    const [updateAlert, updateAlertState] = useUpdateWorkflowAlertMutation();

    const openAlerts = alertsQuery.data?.data || [];

    const handleRaiseAlert = async () => {
        if (!canEdit || !title.trim()) {
            return;
        }

        try {
            await createAlert({
                applicationId,
                alertType,
                severity,
                title: title.trim(),
                message: message.trim() || undefined,
            }).unwrap();

            setTitle('');
            setMessage('');
            toast.success('Alert raised successfully.');
        } catch (error) {
            toast.error('Unable to raise alert', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to create this alert right now. Please try again.'
                ),
            });
        }
    };

    const handleResolve = async (alertId: string) => {
        if (!canEdit) {
            return;
        }

        try {
            await updateAlert({
                applicationId,
                alertId,
                status: 'resolved',
            }).unwrap();

            toast.success('Alert resolved.');
        } catch (error) {
            toast.error('Unable to resolve alert', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to update this alert right now. Please try again.'
                ),
            });
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-3">
                <div className="space-y-2">
                    <Label>Alert type</Label>
                    <Input
                        value={alertType}
                        onChange={(event) => setAlertType(event.target.value)}
                        placeholder="workflow"
                        disabled={!canEdit}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Severity</Label>
                    <Select
                        value={severity}
                        onValueChange={(value) => setSeverity(value as typeof severity)}
                        disabled={!canEdit}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="What needs attention?"
                        disabled={!canEdit}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Details</Label>
                    <Textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder="Optional detail for the assignee"
                        disabled={!canEdit}
                    />
                </div>

                <Button
                    type="button"
                    variant="destructive"
                    className="w-full"
                    disabled={!canEdit || !title.trim() || createAlertState.isLoading}
                    onClick={handleRaiseAlert}
                >
                    {createAlertState.isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Siren className="mr-2 h-4 w-4" />
                    )}
                    Raise Alert
                </Button>
            </div>

            <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Open alerts
                </p>
                {alertsQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading alerts...
                    </div>
                ) : openAlerts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No open alerts.</p>
                ) : (
                    <div className="space-y-2">
                        {openAlerts.map((alert) => (
                            <div key={alert.id} className="rounded-md border p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-medium">{alert.title}</p>
                                        <p className="text-xs text-muted-foreground capitalize">
                                            {alert.alert_type} - {alert.severity}
                                        </p>
                                        {alert.message && (
                                            <p className="mt-1 text-xs text-muted-foreground">{alert.message}</p>
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleResolve(alert.id)}
                                        disabled={!canEdit || updateAlertState.isLoading}
                                    >
                                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                        Resolve
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {alertsQuery.isError && (
                    <div className="flex items-center gap-2 text-xs text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Could not load alerts.
                    </div>
                )}
            </div>
        </div>
    );
}

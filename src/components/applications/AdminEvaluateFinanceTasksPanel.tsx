'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Receipt, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { getWorkflowErrorFromPayload, getWorkflowErrorFromUnknown } from '@/lib/workflow/error-messages';

interface FinanceTaskStateSnapshot {
    updated_at: string;
    admin_accounts_manager_bill_requested: boolean;
    admin_accounts_manager_bill_requested_at: string | null;
    admin_accounts_manager_bill_requested_by: string | null;
}

interface AdminEvaluateFinanceTasksPanelProps {
    applicationId: string;
    canEdit: boolean;
    studentName: string;
    updatedAt: string;
    xeroBillId: string | null | undefined;
    xeroBillNumber: string | null | undefined;
    requestCompleted: boolean;
    requestCompletedAt: string | null;
    onTaskStateUpdate: (taskState: FinanceTaskStateSnapshot) => void;
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

export function AdminEvaluateFinanceTasksPanel({
    applicationId,
    canEdit,
    studentName,
    updatedAt,
    xeroBillId,
    xeroBillNumber,
    requestCompleted,
    requestCompletedAt,
    onTaskStateUpdate,
    onRefresh,
}: AdminEvaluateFinanceTasksPanelProps) {
    const [requesting, setRequesting] = useState(false);

    const billAlreadyExists = Boolean(xeroBillId);

    const statusLabel = billAlreadyExists
        ? 'Bill Exists'
        : requestCompleted
            ? 'Requested'
            : 'Pending';

    const statusClassName = billAlreadyExists
        ? 'bg-blue-100 text-blue-700'
        : requestCompleted
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-yellow-100 text-yellow-700';

    const handleNotifyAccountsManager = async () => {
        setRequesting(true);

        try {
            const response = await fetch(`/api/applications/${applicationId}/admin-finance-tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'request_xero_bill',
                    expectedUpdatedAt: updatedAt,
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                toast.error('Unable to notify accounts manager', {
                    description: getWorkflowErrorFromPayload(
                        payload,
                        'Unable to notify accounts manager right now. Please try again.'
                    ),
                });
                return;
            }

            onTaskStateUpdate(payload.data.application as FinanceTaskStateSnapshot);
            onRefresh();
            toast.success('Accounts manager notified successfully.', {
                description: `${studentName || 'This application'} is ready for Xero bill creation.`,
            });
        } catch (error) {
            toast.error('Unable to notify accounts manager', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to notify accounts manager right now. Please try again.'
                ),
            });
        } finally {
            setRequesting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Finance Task</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-md border p-3">
                    <div className="space-y-1">
                        <p className="text-sm font-medium">Request Accounts Manager to create the Xero bill</p>
                        <p className="text-xs text-muted-foreground">
                            Sends an in-app notification and email to all active Accounts Manager users for {studentName || 'this application'}.
                        </p>
                    </div>
                    <Badge variant="outline" className={statusClassName}>
                        {statusLabel}
                    </Badge>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    disabled={!canEdit || requestCompleted || billAlreadyExists || requesting}
                    onClick={handleNotifyAccountsManager}
                >
                    {requesting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Receipt className="mr-2 h-4 w-4" />
                    )}
                    Notify Accounts Manager to Create Xero Bill
                </Button>

                {requestCompletedAt ? (
                    <p className="text-xs text-muted-foreground">
                        Last requested: <span className="font-medium">{formatDateTime(requestCompletedAt)}</span>
                    </p>
                ) : null}

                {billAlreadyExists ? (
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        {xeroBillNumber
                            ? `Bill ${xeroBillNumber} already exists in Xero for this application.`
                            : 'A Xero bill already exists for this application.'}
                    </div>
                ) : null}

                {!billAlreadyExists && !canEdit ? (
                    <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        Finance task notification is currently locked for editing.
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}

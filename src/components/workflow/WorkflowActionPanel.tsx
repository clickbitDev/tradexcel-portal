'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, MoveRight, ShieldAlert, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { UserRole, WorkflowStage } from '@/types/database';
import {
    useGetTransitionApprovalsQuery,
    useGetTransitionOptionsQuery,
    useRequestTransitionApprovalMutation,
    useReviewTransitionApprovalMutation,
    useTransitionApplicationMutation,
} from '@/store/services/workflowApi';
import { getWorkflowErrorFromUnknown } from '@/lib/workflow/error-messages';
import { WORKFLOW_STAGE_LABELS } from '@/components/workflow/constants';

interface WorkflowActionPanelProps {
    applicationId: string;
    currentStage: WorkflowStage;
    updatedAt: string;
    canEdit: boolean;
    actorRole: UserRole | null;
    onTransitionSuccess: (result: {
        toStage: WorkflowStage;
        updatedAt: string;
    }) => void;
    onConflict: (message: string | null) => void;
}

function getErrorMessage(error: unknown): string {
    return getWorkflowErrorFromUnknown(
        error,
        'Unable to update workflow right now. Please try again.'
    );
}

export function WorkflowActionPanel({
    applicationId,
    currentStage,
    updatedAt,
    canEdit,
    actorRole,
    onTransitionSuccess,
    onConflict,
}: WorkflowActionPanelProps) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const transitionOptionsQuery = useGetTransitionOptionsQuery({ applicationId });
    const approvalsQuery = useGetTransitionApprovalsQuery({ applicationId });
    const [transitionApplication, transitionState] = useTransitionApplicationMutation();
    const [requestTransitionApproval, requestApprovalState] = useRequestTransitionApprovalMutation();
    const [reviewTransitionApproval, reviewApprovalState] = useReviewTransitionApprovalMutation();

    const transitionOptions = useMemo(
        () => transitionOptionsQuery.data?.data.options || [],
        [transitionOptionsQuery.data?.data.options]
    );

    const targetStage = transitionOptions[0]?.toStage ?? null;

    const selectedOption = targetStage
        ? transitionOptions.find((option) => option.toStage === targetStage) || null
        : null;

    const canExecute = Boolean(selectedOption?.canExecute);
    const requiresApproval = Boolean(selectedOption?.requiresApproval);
    const approvalPending = selectedOption?.approvalStatus === 'pending';
    const canRequestApproval = Boolean(selectedOption?.canRequestApproval);
    const nextStageLabel = targetStage ? WORKFLOW_STAGE_LABELS[targetStage] : null;
    const disabled = !canEdit
        || !targetStage
        || transitionState.isLoading
        || transitionOptionsQuery.isLoading
        || !canExecute;

    const handleConfirmTransition = async () => {
        if (!targetStage) {
            return;
        }

        try {
            const response = await transitionApplication({
                applicationId,
                toStage: targetStage,
                expectedUpdatedAt: updatedAt,
                approvalId: selectedOption?.approvalId || undefined,
            }).unwrap();

            onConflict(null);
            onTransitionSuccess({
                toStage: response.data.toStage,
                updatedAt: response.data.updatedAt,
            });
            setConfirmOpen(false);
        } catch (error) {
            const message = getErrorMessage(error);
            onConflict(message);
        }
    };

    const handleRequestApproval = async () => {
        if (!targetStage) {
            return;
        }

        try {
            await requestTransitionApproval({
                applicationId,
                toStage: targetStage,
            }).unwrap();

            onConflict(`Approval requested for ${WORKFLOW_STAGE_LABELS[targetStage]}.`);
        } catch (error) {
            onConflict(getErrorMessage(error));
        }
    };

    const pendingApprovals = (approvalsQuery.data?.data || []).filter(
        (approval) => approval.status === 'pending' && approval.canReview
    );

    const handleReviewApproval = async (
        approvalId: string,
        status: 'approved' | 'rejected'
    ) => {
        try {
            const response = await reviewTransitionApproval({
                applicationId,
                approvalId,
                status,
            }).unwrap();

            if (status === 'approved' && response.transition) {
                onConflict(null);
                onTransitionSuccess({
                    toStage: response.transition.toStage,
                    updatedAt: response.transition.updatedAt,
                });
                return;
            }

            onConflict(status === 'approved'
                ? 'Approval recorded. Transition execution will require refresh.'
                : 'Transition approval was rejected.');
        } catch (error) {
            onConflict(getErrorMessage(error));
        }
    };

    return (
        <div className="space-y-3">
            <div className="space-y-2 rounded-md border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Next Status
                </p>
                <p className="text-sm font-medium text-foreground">
                    {nextStageLabel || 'No valid transitions available'}
                </p>
                {transitionOptionsQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading transition options...
                    </p>
                ) : null}
                {!selectedOption?.canExecute && !selectedOption?.canRequestApproval ? (
                    selectedOption?.blockedReason ? (
                        <p className="text-xs text-destructive">
                            {selectedOption.blockedReason}
                        </p>
                    ) : selectedOption?.allowedRoles && selectedOption.allowedRoles.length > 0 ? (
                        <p className="text-xs text-destructive">
                            This transition requires one of these roles: {selectedOption.allowedRoles.join(', ')}. Your role is {actorRole}.
                        </p>
                    ) : selectedOption?.requiredRole ? (
                        <p className="text-xs text-destructive">
                            This transition requires {selectedOption.requiredRole} role. Your role is {actorRole}.
                        </p>
                    ) : null
                ) : null}
                {requiresApproval ? (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {approvalPending
                            ? 'Approval pending for this transition.'
                            : selectedOption?.approvalStatus === 'approved'
                                ? 'Approval granted. You can execute this transition.'
                                : 'Approval is required before execution.'}
                    </p>
                ) : null}
            </div>

            {requiresApproval && !canExecute ? (
                <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={
                        !canEdit
                        || !targetStage
                        || requestApprovalState.isLoading
                        || approvalPending
                        || !canRequestApproval
                    }
                    onClick={handleRequestApproval}
                >
                    {requestApprovalState.isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <ShieldAlert className="mr-2 h-4 w-4" />
                    )}
                    {approvalPending
                        ? 'Approval requested'
                        : nextStageLabel
                            ? `Request approval for ${nextStageLabel}`
                            : 'Request approval'}
                </Button>
            ) : null}

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogTrigger asChild>
                    <Button disabled={disabled} className="w-full">
                        {transitionState.isLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <MoveRight className="mr-2 h-4 w-4" />
                        )}
                        {nextStageLabel ? `Move to ${nextStageLabel}` : 'No transition available'}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Update application status?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {targetStage
                                ? `This will move the application from ${WORKFLOW_STAGE_LABELS[currentStage]} to ${WORKFLOW_STAGE_LABELS[targetStage]}.`
                                : 'Select a target stage before continuing.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmTransition}>
                            Continue
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {pendingApprovals.length > 0 ? (
                <div className="space-y-2 rounded-md border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Pending approvals
                    </p>
                    {pendingApprovals.map((approval) => (
                        <div key={approval.id} className="rounded-md border p-2 space-y-2">
                            <p className="text-sm">
                                {WORKFLOW_STAGE_LABELS[approval.from_stage]} {'->'} {WORKFLOW_STAGE_LABELS[approval.to_stage]}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleReviewApproval(approval.id, 'approved')}
                                    disabled={!canEdit || reviewApprovalState.isLoading}
                                >
                                    {reviewApprovalState.isLoading ? (
                                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                    )}
                                    Approve
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReviewApproval(approval.id, 'rejected')}
                                    disabled={!canEdit || reviewApprovalState.isLoading}
                                >
                                    <XCircle className="mr-1 h-3.5 w-3.5" />
                                    Reject
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

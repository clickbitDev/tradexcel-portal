'use client';

import { useEffect, useState } from 'react';
import { Loader2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { UserRole, WorkflowStage } from '@/types/database';
import {
    useCreateWorkflowAssignmentMutation,
    useGetAssignableStaffQuery,
    useGetWorkflowAssignmentsQuery,
    useUpdateWorkflowAssignmentMutation,
} from '@/store/services/workflowApi';
import { getWorkflowErrorFromUnknown } from '@/lib/workflow/error-messages';
import { WORKFLOW_STAGE_LABELS } from '@/components/workflow/constants';

const STAGES: WorkflowStage[] = [
    'docs_review',
    'enrolled',
    'evaluate',
    'accounts',
    'dispatch',
    'completed',
];

interface WorkflowAssignmentsPanelProps {
    applicationId: string;
    currentStage: WorkflowStage;
    canEdit: boolean;
    actorRole: UserRole | null;
}

export function WorkflowAssignmentsPanel({
    applicationId,
    currentStage,
    canEdit,
    actorRole,
}: WorkflowAssignmentsPanelProps) {
    const [stage, setStage] = useState<WorkflowStage>(currentStage);
    const [assigneeId, setAssigneeId] = useState('');
    const [notes, setNotes] = useState('');

    const assignableStaffQuery = useGetAssignableStaffQuery();
    const assignmentsQuery = useGetWorkflowAssignmentsQuery({ applicationId });
    const [createAssignment, createAssignmentState] = useCreateWorkflowAssignmentMutation();
    const [updateAssignment, updateAssignmentState] = useUpdateWorkflowAssignmentMutation();

    useEffect(() => {
        setStage(currentStage);
    }, [currentStage]);

    const isExecutiveDocsReviewAdminOnly = actorRole === 'executive_manager'
        && currentStage === 'docs_review';

    useEffect(() => {
        if (isExecutiveDocsReviewAdminOnly) {
            setStage('docs_review');
        }
    }, [isExecutiveDocsReviewAdminOnly]);

    const handleAssign = async () => {
        if (!assigneeId || !canEdit) {
            return;
        }

        try {
            await createAssignment({
                applicationId,
                stage,
                assigneeId,
                notes: notes.trim() || undefined,
            }).unwrap();

            setNotes('');
            toast.success('Stage owner assigned successfully.');
        } catch (error) {
            toast.error('Unable to assign stage owner', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to assign this stage right now. Please try again.'
                ),
            });
        }
    };

    const handleUnassign = async (assignmentId: string) => {
        if (!canEdit) {
            return;
        }

        try {
            await updateAssignment({
                applicationId,
                assignmentId,
                isActive: false,
            }).unwrap();

            toast.success('Assignment removed.');
        } catch (error) {
            toast.error('Unable to update assignment', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to update this assignment right now. Please try again.'
                ),
            });
        }
    };

    const assignments = assignmentsQuery.data?.data || [];
    const staffOptions = assignableStaffQuery.data?.data || [];
    const assigneeOptions = isExecutiveDocsReviewAdminOnly
        ? staffOptions.filter((staff) => staff.role === 'admin')
        : staffOptions;

    useEffect(() => {
        if (assigneeId && !assigneeOptions.some((staff) => staff.id === assigneeId)) {
            setAssigneeId('');
        }
    }, [assigneeId, assigneeOptions]);

    return (
        <div className="space-y-4">
            <div className="space-y-3">
                <div className="space-y-2">
                    <Label>Stage</Label>
                    <Select
                        value={stage}
                        onValueChange={(value) => setStage(value as WorkflowStage)}
                        disabled={!canEdit || isExecutiveDocsReviewAdminOnly}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {STAGES.map((workflowStage) => (
                                <SelectItem key={workflowStage} value={workflowStage}>
                                    {WORKFLOW_STAGE_LABELS[workflowStage]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {isExecutiveDocsReviewAdminOnly ? (
                        <p className="text-xs text-muted-foreground">
                            In Docs Review, Executive Managers can only assign an admin to Docs Review.
                        </p>
                    ) : null}
                </div>

                <div className="space-y-2">
                    <Label>Assignee</Label>
                    <Select
                        value={assigneeId}
                        onValueChange={setAssigneeId}
                        disabled={!canEdit || assignableStaffQuery.isLoading}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select staff member" />
                        </SelectTrigger>
                        <SelectContent>
                            {assigneeOptions.map((staff) => (
                                <SelectItem key={staff.id} value={staff.id}>
                                    {(staff.full_name || 'Unnamed user')} ({staff.role || 'staff'})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {!assignableStaffQuery.isLoading && assigneeOptions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No eligible staff available for assignment.</p>
                    ) : null}
                    {assignableStaffQuery.isLoading ? (
                        <p className="text-xs text-muted-foreground">Loading assignable staff...</p>
                    ) : null}
                    {assignableStaffQuery.isError ? (
                        <p className="text-xs text-destructive">Could not load staff list.</p>
                    ) : null}
                </div>

                <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Optional assignment note"
                        disabled={!canEdit}
                    />
                </div>

                <Button
                    type="button"
                    className="w-full"
                    disabled={!canEdit || !assigneeId || createAssignmentState.isLoading}
                    onClick={handleAssign}
                >
                    {createAssignmentState.isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <UserPlus className="mr-2 h-4 w-4" />
                    )}
                    Assign Stage Owner
                </Button>
            </div>

            <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Active assignments
                </p>
                {assignmentsQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading assignments...
                    </div>
                ) : assignments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active assignments yet.</p>
                ) : (
                    <div className="space-y-2">
                        {assignments.map((assignment) => (
                            <div key={assignment.id} className="rounded-md border p-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium">
                                            {WORKFLOW_STAGE_LABELS[assignment.stage]}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {assignment.assignee?.full_name || assignment.assignee_id}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleUnassign(assignment.id)}
                                        disabled={!canEdit || updateAssignmentState.isLoading}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

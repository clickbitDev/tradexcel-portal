'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, DollarSign, UserCheck, Users, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import type { WorkflowStage } from '@/types/database';
import { getWorkflowErrorFromPayload, getWorkflowErrorFromUnknown } from '@/lib/workflow/error-messages';
import { NON_DELETED_PROFILE_FILTER } from '@/lib/staff/profile-filters';
import { logFieldChanges } from '@/lib/activity-logger';

interface RtoPaymentSectionProps {
    applicationId: string;
    currentRtoId?: string;
    currentQualificationId?: string;
    updatedAt?: string;
    assignedAssessorId?: string | null;
    assignedAdminId?: string | null;
    workflowStage?: WorkflowStage;
    actorRole?: string | null;
    onUpdate?: () => void;
    canEdit?: boolean;
}

interface StaffMember {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string;
    assessor_rate?: number | null;
}

interface RtoOption {
    rtoId: string;
    name: string;
    code: string | null;
    offeringId: string;
    isActiveOffering: boolean;
}

export function RtoPaymentSection({
    applicationId,
    currentRtoId,
    assignedAssessorId,
    assignedAdminId,
    workflowStage,
    actorRole,
    updatedAt,
    onUpdate,
    canEdit = true,
}: RtoPaymentSectionProps) {
    const [assessors, setAssessors] = useState<StaffMember[]>([]);
    const [admins, setAdmins] = useState<StaffMember[]>([]);
    const [rtoOptions, setRtoOptions] = useState<RtoOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingAssignmentOptions, setLoadingAssignmentOptions] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state
    const [selectedRtoId, setSelectedRtoId] = useState<string>(currentRtoId || '__none__');
    const [selectedAssessorId, setSelectedAssessorId] = useState<string>(assignedAssessorId || '__none__');
    const [selectedAdminId, setSelectedAdminId] = useState<string>(assignedAdminId || '__none__');

    const isExecutiveManager = actorRole === 'executive_manager';
    const isExecutiveDocsReviewAdminOnly = isExecutiveManager
        && workflowStage === 'docs_review';
    const isExecutiveEnrolledAssignment = isExecutiveManager
        && workflowStage === 'enrolled';
    const isExecutiveAssignmentStageLocked = isExecutiveManager
        && workflowStage !== 'enrolled';
    const canEditRtoAndAssessor = canEdit && (!isExecutiveManager || isExecutiveEnrolledAssignment);

    const supabase = useMemo(() => createClient(), []);

    const adminOptions = admins;
    const hasInvalidAssignedAdmin = Boolean(
        assignedAdminId
        && assignedAdminId !== '__none__'
        && !adminOptions.some((staff) => staff.id === assignedAdminId)
    );

    const selectedAdminValue = selectedAdminId === '__none__' || adminOptions.some((staff) => staff.id === selectedAdminId)
        ? selectedAdminId
        : '__none__';

    useEffect(() => {
        const fetchStaff = async () => {
            setLoading(true);

            // Always fetch all assessor staff so dropdown is never empty due to qualification mapping gaps
            const [{ data: allAssessors }, { data: adminStaff }] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id, full_name, email, role, assessor_rate')
                    .eq('role', 'assessor')
                    .eq('account_status', 'active')
                    .or(NON_DELETED_PROFILE_FILTER)
                    .order('full_name', { ascending: true }),
                supabase
                    .from('profiles')
                    .select('id, full_name, email, role')
                    .eq('role', 'admin')
                    .eq('account_status', 'active')
                    .or(NON_DELETED_PROFILE_FILTER)
                    .order('full_name', { ascending: true }),
            ]);

            if (allAssessors) {
                setAssessors(allAssessors);
            }

            if (adminStaff) {
                setAdmins(adminStaff);
            }

            setLoading(false);
        };

        void fetchStaff();
    }, [supabase]);

    useEffect(() => {
        if (!isExecutiveManager || !isExecutiveEnrolledAssignment) {
            setRtoOptions([]);
            return;
        }

        const fetchAssignmentOptions = async () => {
            setLoadingAssignmentOptions(true);

            try {
                const response = await fetch(`/api/applications/${applicationId}/docs-review-assignment`);
                const payload = await response.json().catch(() => null);

                if (!response.ok) {
                    throw new Error(
                        getWorkflowErrorFromPayload(
                            payload,
                            'Unable to load RTO and assessor options right now. Please try again.'
                        )
                    );
                }

                const nextRtoOptions = Array.isArray(payload?.data?.rtoOptions)
                    ? payload.data.rtoOptions as RtoOption[]
                    : [];
                const nextAssessorOptions = Array.isArray(payload?.data?.assessorOptions)
                    ? payload.data.assessorOptions as StaffMember[]
                    : [];

                setRtoOptions(nextRtoOptions);

                if (nextAssessorOptions.length > 0) {
                    setAssessors(nextAssessorOptions);
                }

                const nextRtoId = payload?.data?.current?.rtoId || currentRtoId;
                const nextAssessorId = payload?.data?.current?.assessorId || assignedAssessorId;

                setSelectedRtoId(nextRtoId || '__none__');
                setSelectedAssessorId(nextAssessorId || '__none__');
            } catch (error) {
                toast.error('Unable to load assignment options', {
                    description: getWorkflowErrorFromUnknown(
                        error,
                        'Unable to load RTO and assessor options right now. Please try again.'
                    ),
                });
            } finally {
                setLoadingAssignmentOptions(false);
            }
        };

        void fetchAssignmentOptions();
    }, [applicationId, assignedAssessorId, currentRtoId, isExecutiveEnrolledAssignment, isExecutiveManager]);

    // Update local state when props change
    useEffect(() => {
        const timer = setTimeout(() => {
            setSelectedRtoId(currentRtoId || '__none__');
            setSelectedAssessorId(assignedAssessorId || '__none__');
            setSelectedAdminId(assignedAdminId || '__none__');
        }, 0);

        return () => clearTimeout(timer);
    }, [currentRtoId, assignedAssessorId, assignedAdminId]);

    const handleSave = async () => {
        const normalizedCurrentRtoId = currentRtoId || '__none__';
        const normalizedCurrentAssessorId = assignedAssessorId || '__none__';
        const hasExecutiveAssignmentChanges = isExecutiveEnrolledAssignment
            && (
                selectedRtoId !== normalizedCurrentRtoId
                || selectedAssessorId !== normalizedCurrentAssessorId
            );
        const normalizedSelectedAdminId = selectedAdminValue === '__none__' ? null : selectedAdminValue;

        if (hasInvalidAssignedAdmin && !normalizedSelectedAdminId) {
            toast.error('Assign a valid admin', {
                description: 'This application is linked to a user who is not an Admin. Select an Admin before saving changes.',
            });
            return;
        }

        const hasApplicationFieldChanges = (
            normalizedSelectedAdminId !== (assignedAdminId || null)
            || (!isExecutiveManager && selectedAssessorId !== normalizedCurrentAssessorId)
        );

        if (hasExecutiveAssignmentChanges) {
            if (selectedRtoId === '__none__' || selectedAssessorId === '__none__') {
                toast.error('Missing assignment details', {
                    description: 'Select both RTO and assessor before saving this enrolled assignment.',
                });
                return;
            }
        }

        if (!hasExecutiveAssignmentChanges && !hasApplicationFieldChanges) {
            toast.info('No changes to save');
            return;
        }

        setSaving(true);

        try {
            const fieldChanges: Record<string, { old: string | null; new: string | null }> = {};

            if (hasExecutiveAssignmentChanges) {
                const response = await fetch(`/api/applications/${applicationId}/docs-review-assignment`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        rtoId: selectedRtoId,
                        assessorId: selectedAssessorId,
                        expectedUpdatedAt: updatedAt,
                    }),
                });

                const payload = await response.json().catch(() => null);

                if (!response.ok) {
                    throw new Error(
                        getWorkflowErrorFromPayload(
                            payload,
                            'Unable to assign RTO and assessor right now. Please try again.'
                        )
                    );
                }
            }

            if (hasApplicationFieldChanges) {
                const updateData: Record<string, string | number | null> = {
                    assigned_admin_id: normalizedSelectedAdminId,
                };

                if (!isExecutiveManager) {
                    updateData.assigned_assessor_id = selectedAssessorId === '__none__' ? null : selectedAssessorId;
                }

                const { error } = await supabase
                    .from('applications')
                    .update(updateData)
                    .eq('id', applicationId);

                if (error) {
                    throw new Error(error.message);
                }

                fieldChanges.assigned_admin_id = {
                    old: assignedAdminId || null,
                    new: normalizedSelectedAdminId,
                };

                if (!isExecutiveManager) {
                    fieldChanges.assigned_assessor_id = {
                        old: assignedAssessorId || null,
                        new: selectedAssessorId === '__none__' ? null : selectedAssessorId,
                    };
                }
            }

            if (Object.keys(fieldChanges).length > 0) {
                await logFieldChanges(applicationId, fieldChanges);
            }

            toast.success('Application updated successfully');
            onUpdate?.();
        } catch (error) {
            toast.error('Failed to update application', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to update this application right now. Please try again.'
                ),
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading || loadingAssignmentOptions) {
        return (
            <Card>
                <CardHeader className="bg-purple-50 dark:bg-purple-950/30 border-b">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Assigned TO
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="bg-purple-50 dark:bg-purple-950/30 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Assigned TO
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                {isExecutiveManager ? (
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            RTO
                        </Label>
                        <Select
                            value={selectedRtoId}
                            onValueChange={setSelectedRtoId}
                            disabled={!canEditRtoAndAssessor || saving}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select RTO" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">Select RTO</SelectItem>
                                {rtoOptions.map((rto) => (
                                    <SelectItem key={rto.rtoId} value={rto.rtoId}>
                                        {rto.code ? `${rto.code} - ` : ''}{rto.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {isExecutiveAssignmentStageLocked ? (
                            <p className="text-xs text-muted-foreground">
                                Executive Managers can assign RTO only when the application is in Enrolled stage.
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Select an RTO to complete the enrolled assignment workflow.
                            </p>
                        )}
                    </div>
                ) : null}

                {/* Assessor/Admin Assignment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4" />
                            Assessor
                        </Label>
                        <Select
                            value={selectedAssessorId}
                            onValueChange={setSelectedAssessorId}
                            disabled={!canEditRtoAndAssessor || saving}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Assessor (Optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">No Assessor</SelectItem>
                                {assessors.map((assessor) => (
                                    <SelectItem key={assessor.id} value={assessor.id}>
                                        {assessor.full_name || assessor.email || 'Unknown'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {isExecutiveAssignmentStageLocked ? (
                            <p className="text-xs text-muted-foreground">
                                Executive Managers can assign assessor only when the application is in Enrolled stage.
                            </p>
                        ) : isExecutiveEnrolledAssignment ? (
                            <p className="text-xs text-muted-foreground">
                                Select assessor to complete the enrolled assignment workflow.
                            </p>
                        ) : isExecutiveDocsReviewAdminOnly ? (
                            <p className="text-xs text-muted-foreground">
                                Use Stage Assignments to assign admin ownership during Docs Review.
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                All assessor staff are listed here.
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-red-600">
                            <Users className="h-4 w-4" />
                            Assign Admin *
                        </Label>
                        <Select
                            value={selectedAdminValue}
                            onValueChange={setSelectedAdminId}
                            disabled={!canEdit}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Admin" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">No Admin</SelectItem>
                                {adminOptions.map((admin) => (
                                    <SelectItem key={admin.id} value={admin.id}>
                                        {admin.full_name || admin.email || 'Unknown'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {isExecutiveDocsReviewAdminOnly ? (
                            <p className="text-xs text-muted-foreground">
                                In Docs Review, Executive Managers can assign admin users only.
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Only staff with the Admin role are listed here.
                            </p>
                        )}
                        {hasInvalidAssignedAdmin ? (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                The previous assignee is not an Admin. Select a valid Admin before saving changes.
                            </p>
                        ) : null}
                    </div>
                </div>

                {/* Save Button */}
                {canEdit && (
                    <div className="flex justify-end pt-4 border-t">
                        <Button onClick={handleSave} disabled={saving} className="gap-2">
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Update Application
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

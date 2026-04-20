'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Building2, Loader2, Save, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { WorkflowStage } from '@/types/database';
import { getWorkflowErrorFromPayload, getWorkflowErrorFromUnknown } from '@/lib/workflow/error-messages';

interface DocsReviewAssignmentPanelProps {
    applicationId: string;
    workflowStage: WorkflowStage;
    updatedAt: string;
    currentRtoId: string | null;
    currentAssessorId: string | null;
    canEdit: boolean;
    onUpdate?: () => void;
}

interface RtoOption {
    rtoId: string;
    name: string;
    code: string | null;
    offeringId: string;
    isActiveOffering: boolean;
}

interface AssessorOption {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string;
}

const UNSELECTED = '__none__';

export function DocsReviewAssignmentPanel({
    applicationId,
    workflowStage,
    updatedAt,
    currentRtoId,
    currentAssessorId,
    canEdit,
    onUpdate,
}: DocsReviewAssignmentPanelProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rtoOptions, setRtoOptions] = useState<RtoOption[]>([]);
    const [assessorOptions, setAssessorOptions] = useState<AssessorOption[]>([]);
    const [selectedRtoId, setSelectedRtoId] = useState<string>(currentRtoId || UNSELECTED);
    const [selectedAssessorId, setSelectedAssessorId] = useState<string>(currentAssessorId || UNSELECTED);

    useEffect(() => {
        setSelectedRtoId(currentRtoId || UNSELECTED);
        setSelectedAssessorId(currentAssessorId || UNSELECTED);
    }, [currentRtoId, currentAssessorId]);

    useEffect(() => {
        const fetchOptions = async () => {
            setLoading(true);

            try {
                const response = await fetch(`/api/applications/${applicationId}/docs-review-assignment`);
                const payload = await response.json().catch(() => null);

                if (!response.ok) {
                    throw new Error(
                        getWorkflowErrorFromPayload(
                            payload,
                            'Unable to load docs review assignment options right now.'
                        )
                    );
                }

                setRtoOptions(payload?.data?.rtoOptions || []);
                setAssessorOptions(payload?.data?.assessorOptions || []);

                const nextRtoId = payload?.data?.current?.rtoId || currentRtoId;
                const nextAssessorId = payload?.data?.current?.assessorId || currentAssessorId;

                setSelectedRtoId(nextRtoId || UNSELECTED);
                setSelectedAssessorId(nextAssessorId || UNSELECTED);
            } catch (error) {
                toast.error('Unable to load assignment options', {
                    description: getWorkflowErrorFromUnknown(
                        error,
                        'Unable to load docs review assignment options right now.'
                    ),
                });
            } finally {
                setLoading(false);
            }
        };

        void fetchOptions();
    }, [applicationId, currentAssessorId, currentRtoId]);

    const isDocsReviewStage = workflowStage === 'docs_review';

    const handleSave = async () => {
        if (!isDocsReviewStage) {
            toast.error('Assignment unavailable', {
                description: 'You can only assign RTO and assessor while in Docs Review stage.',
            });
            return;
        }

        if (selectedRtoId === UNSELECTED || selectedAssessorId === UNSELECTED) {
            toast.error('Missing assignment details', {
                description: 'Select both an RTO and an assessor to continue.',
            });
            return;
        }

        setSaving(true);

        try {
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
                        'Unable to update docs review assignment right now. Please try again.'
                    )
                );
            }

            toast.success('Docs review assignment updated', {
                description: 'RTO and assessor were assigned successfully.',
            });

            onUpdate?.();
        } catch (error) {
            toast.error('Unable to update assignment', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to update docs review assignment right now. Please try again.'
                ),
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between gap-2">
                    <span>Docs Review Assignment</span>
                    <Badge variant={isDocsReviewStage ? 'default' : 'outline'}>
                        {isDocsReviewStage ? 'Active Stage' : 'Stage Locked'}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading assignment options...
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                RTO
                            </Label>
                            <Select
                                value={selectedRtoId}
                                onValueChange={setSelectedRtoId}
                                disabled={!canEdit || !isDocsReviewStage || saving}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select RTO" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={UNSELECTED}>Select RTO</SelectItem>
                                    {rtoOptions.map((rto) => (
                                        <SelectItem key={rto.rtoId} value={rto.rtoId}>
                                            {rto.code ? `${rto.code} - ` : ''}{rto.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <UserCheck className="h-4 w-4" />
                                Assessor
                            </Label>
                            <Select
                                value={selectedAssessorId}
                                onValueChange={setSelectedAssessorId}
                                disabled={!canEdit || !isDocsReviewStage || saving}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select assessor" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={UNSELECTED}>Select assessor</SelectItem>
                                    {assessorOptions.map((assessor) => (
                                        <SelectItem key={assessor.id} value={assessor.id}>
                                            {assessor.full_name || assessor.email || 'Unknown assessor'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {!isDocsReviewStage && (
                            <p className="text-xs text-muted-foreground">
                                Assignment opens automatically when this application enters Docs Review.
                            </p>
                        )}

                        {!canEdit && (
                            <p className="text-xs text-muted-foreground">
                                Acquire the application lock to update assignments.
                            </p>
                        )}

                        <Button
                            type="button"
                            className="w-full"
                            onClick={handleSave}
                            disabled={!canEdit || !isDocsReviewStage || saving}
                        >
                            {saving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="mr-2 h-4 w-4" />
                            )}
                            Assign RTO & Assessor
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
    WORKFLOW_STAGE_ORDER,
    getStageProgress,
} from '@/lib/workflow-transitions';
import type { WorkflowStage } from '@/types/database';
import { WORKFLOW_STAGE_LABELS } from '@/components/workflow/constants';

interface WorkflowProgressBarProps {
    currentStage: WorkflowStage;
    stageOrder?: WorkflowStage[];
}

export function WorkflowProgressBar({ currentStage, stageOrder }: WorkflowProgressBarProps) {
    const activeStageOrder = useMemo(() => {
        if (stageOrder && stageOrder.length > 0) {
            const deduped = Array.from(new Set(stageOrder));
            if (deduped.includes(currentStage)) {
                return deduped;
            }
        }

        return WORKFLOW_STAGE_ORDER;
    }, [currentStage, stageOrder]);

    const progress = getStageProgress(currentStage, activeStageOrder);
    const currentIndex = activeStageOrder.indexOf(currentStage);

    return (
        <div className="space-y-3">
            <div className="h-2 w-full rounded-full bg-muted">
                <div
                    className="h-2 rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>
            <div
                className="hidden gap-2 md:grid"
                style={{ gridTemplateColumns: `repeat(${activeStageOrder.length}, minmax(0, 1fr))` }}
            >
                {activeStageOrder.map((stage, index) => {
                    const reached = currentIndex >= index;

                    return (
                        <div key={stage} className="text-center">
                            <div
                                className={cn(
                                    'mx-auto mb-2 h-2.5 w-2.5 rounded-full border',
                                    reached
                                        ? 'border-primary bg-primary'
                                        : 'border-border bg-background'
                                )}
                            />
                            <p
                                className={cn(
                                    'text-[11px] leading-tight',
                                    reached ? 'text-foreground' : 'text-muted-foreground'
                                )}
                            >
                                {WORKFLOW_STAGE_LABELS[stage]}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

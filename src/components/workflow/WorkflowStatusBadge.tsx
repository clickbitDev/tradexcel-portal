'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { WorkflowStage } from '@/types/database';
import {
    WORKFLOW_STAGE_BADGE_CLASSES,
    WORKFLOW_STAGE_LABELS,
} from '@/components/workflow/constants';

interface WorkflowStatusBadgeProps {
    stage: WorkflowStage;
    className?: string;
}

export function WorkflowStatusBadge({ stage, className }: WorkflowStatusBadgeProps) {
    return (
        <Badge
            variant="outline"
            className={cn(WORKFLOW_STAGE_BADGE_CLASSES[stage], className)}
        >
            {WORKFLOW_STAGE_LABELS[stage]}
        </Badge>
    );
}

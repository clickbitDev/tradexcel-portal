import type { UserRole, WorkflowStage } from '@/types/database';
import {
    canPerformTransition,
    getTransitionErrorMessage,
    isValidTransition,
} from '@/lib/workflow-transitions';

export const WORKFLOW_STAGE_OWNERS: Record<WorkflowStage, UserRole[]> = {
    TRANSFERRED: ['executive_manager', 'ceo', 'developer'],
    docs_review: ['admin', 'assessor', 'executive_manager', 'ceo', 'developer'],
    enrolled: ['admin', 'assessor', 'executive_manager', 'ceo', 'developer', 'agent'],
    evaluate: ['assessor', 'admin', 'executive_manager', 'ceo', 'developer'],
    accounts: ['accounts_manager', 'admin', 'executive_manager', 'ceo', 'developer'],
    dispatch: ['dispatch_coordinator', 'admin', 'executive_manager', 'ceo', 'developer'],
    completed: ['dispatch_coordinator', 'admin', 'executive_manager', 'ceo', 'developer'],
};

export interface WorkflowTransitionValidationInput {
    fromStage: WorkflowStage;
    toStage: WorkflowStage;
    actorRole: UserRole;
}

export interface WorkflowTransitionValidationResult {
    allowed: boolean;
    reason: string;
}

export function isStageOwner(role: UserRole, stage: WorkflowStage): boolean {
    return WORKFLOW_STAGE_OWNERS[stage]?.includes(role) ?? false;
}

export function validateWorkflowTransition(
    input: WorkflowTransitionValidationInput
): WorkflowTransitionValidationResult {
    const { fromStage, toStage, actorRole } = input;

    if (!isValidTransition(fromStage, toStage)) {
        return {
            allowed: false,
            reason: getTransitionErrorMessage(fromStage, toStage),
        };
    }

    if (!isStageOwner(actorRole, fromStage)) {
        return {
            allowed: false,
            reason: `Role "${actorRole}" cannot manage applications in "${fromStage}" stage.`,
        };
    }

    if (!canPerformTransition(fromStage, toStage, actorRole)) {
        return {
            allowed: false,
            reason: `Role "${actorRole}" cannot move applications from "${fromStage}" to "${toStage}".`,
        };
    }

    return {
        allowed: true,
        reason: 'allowed',
    };
}

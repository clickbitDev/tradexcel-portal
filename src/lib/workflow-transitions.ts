/**
 * Workflow Transitions
 * Defines and validates allowed workflow stage transitions
 */

import type { WorkflowStage, UserRole } from '@/types/database';

/**
 * Valid workflow transitions map
 * Defines which stages can transition to which other stages
 */
export const VALID_TRANSITIONS: Record<WorkflowStage, WorkflowStage[]> = {
    TRANSFERRED: ['docs_review'],
    docs_review: ['enrolled'],
    enrolled: ['evaluate'],
    evaluate: ['accounts'],
    accounts: ['dispatch'],
    dispatch: ['completed'],
    completed: [],
};

/**
 * Transitions that require specific roles
 * Uses the new 9-role system
 */
export const ROLE_REQUIRED_TRANSITIONS: Partial<
    Record<`${WorkflowStage}->${WorkflowStage}`, UserRole[]>
> = {
    'TRANSFERRED->docs_review': ['ceo', 'executive_manager', 'developer'],
    'docs_review->enrolled': ['ceo', 'executive_manager', 'admin', 'developer', 'agent'],
    'enrolled->evaluate': ['ceo', 'executive_manager', 'assessor', 'developer'],
    'evaluate->accounts': ['ceo', 'executive_manager', 'admin', 'developer'],
    'accounts->dispatch': ['ceo', 'executive_manager', 'accounts_manager', 'developer'],
    'dispatch->completed': ['ceo', 'executive_manager', 'dispatch_coordinator', 'admin', 'developer'],
};

/**
 * Check if a workflow transition is valid
 */
export function isValidTransition(from: WorkflowStage, to: WorkflowStage): boolean {
    const validTargets = VALID_TRANSITIONS[from];
    return validTargets?.includes(to) ?? false;
}

/**
 * Check if user role can perform this transition
 */
export function canPerformTransition(
    from: WorkflowStage,
    to: WorkflowStage,
    userRole: UserRole
): boolean {
    // First check if transition is valid
    if (!isValidTransition(from, to)) {
        return false;
    }

    // Check role requirements
    const key = `${from}->${to}` as `${WorkflowStage}->${WorkflowStage}`;
    const requiredRoles = ROLE_REQUIRED_TRANSITIONS[key];

    if (requiredRoles && !requiredRoles.includes(userRole)) {
        return false;
    }

    return true;
}

/**
 * Get all valid next stages for a given stage
 */
export function getValidNextStages(currentStage: WorkflowStage): WorkflowStage[] {
    return VALID_TRANSITIONS[currentStage] || [];
}

/**
 * Get all valid next stages for a user's role
 */
export function getValidNextStagesForRole(
    currentStage: WorkflowStage,
    userRole: UserRole
): WorkflowStage[] {
    const allValid = getValidNextStages(currentStage);

    return allValid.filter((target) => {
        const key = `${currentStage}->${target}` as `${WorkflowStage}->${WorkflowStage}`;
        const requiredRoles = ROLE_REQUIRED_TRANSITIONS[key];

        if (requiredRoles && !requiredRoles.includes(userRole)) {
            return false;
        }

        return true;
    });
}

/**
 * Get a user-friendly error message for an invalid transition
 */
export function getTransitionErrorMessage(
    from: WorkflowStage,
    to: WorkflowStage
): string {
    const validTargets = VALID_TRANSITIONS[from];

    if (!validTargets || validTargets.length === 0) {
        return `Applications in "${from}" stage cannot be moved.`;
    }

    const validNames = validTargets
        .map((s) => `"${s.replace(/_/g, ' ')}"`)
        .join(', ');

    return `Cannot move from "${from.replace(/_/g, ' ')}" to "${to.replace(/_/g, ' ')}". Valid transitions: ${validNames}.`;
}

/**
 * Workflow stage order for funnel visualization
 */
export const WORKFLOW_STAGE_ORDER: WorkflowStage[] = [
    'TRANSFERRED',
    'docs_review',
    'enrolled',
    'evaluate',
    'accounts',
    'dispatch',
    'completed',
];

/**
 * Condensed stage order for details pages where docs_review -> enrolled
 * is a valid direct workflow path.
 */
export const WORKFLOW_DETAILS_STAGE_ORDER: WorkflowStage[] = [
    'TRANSFERRED',
    'docs_review',
    'enrolled',
    'evaluate',
    'accounts',
    'dispatch',
    'completed',
];

/**
 * Terminal stages (no further progression)
 */
export const TERMINAL_STAGES: WorkflowStage[] = ['completed'];

/**
 * Check if a stage is terminal
 */
export function isTerminalStage(stage: WorkflowStage): boolean {
    return TERMINAL_STAGES.includes(stage);
}

/**
 * Get stage progress percentage (for progress bars)
 */
export function getStageProgress(
    stage: WorkflowStage,
    stageOrder: WorkflowStage[] = WORKFLOW_STAGE_ORDER
): number {
    if (isTerminalStage(stage)) return 100;

    const index = stageOrder.indexOf(stage);
    if (index === -1) return 0;

    const denominator = Math.max(stageOrder.length - 1, 1);
    return Math.round((index / denominator) * 100);
}

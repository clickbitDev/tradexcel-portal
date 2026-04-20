import type { WorkflowStage } from '@/types/database';
import type { PolicyStage } from '@/lib/access-control/types';

export const POLICY_STAGE_ORDER: PolicyStage[] = [
    'TRANSFERRED',
    'DOCS_REVIEW',
    'ENROLLED',
    'EVALUATE',
    'ACCOUNTS',
    'DISPATCH',
    'COMPLETED',
];

export const FAILURE_POLICY_STAGES: PolicyStage[] = [];

export const LEGACY_TO_POLICY_STAGE: Record<WorkflowStage, PolicyStage> = {
    TRANSFERRED: 'TRANSFERRED',
    docs_review: 'DOCS_REVIEW',
    enrolled: 'ENROLLED',
    evaluate: 'EVALUATE',
    accounts: 'ACCOUNTS',
    dispatch: 'DISPATCH',
    completed: 'COMPLETED',
};

export const POLICY_TO_LEGACY_STAGE: Record<PolicyStage, WorkflowStage> = {
    TRANSFERRED: 'TRANSFERRED',
    DOCS_REVIEW: 'docs_review',
    ENROLLED: 'enrolled',
    EVALUATE: 'evaluate',
    ACCOUNTS: 'accounts',
    DISPATCH: 'dispatch',
    COMPLETED: 'completed',
};

export function mapLegacyStageToPolicyStage(
    legacyStage: WorkflowStage | null | undefined
): PolicyStage | null {
    if (!legacyStage) {
        return null;
    }

    return LEGACY_TO_POLICY_STAGE[legacyStage] ?? null;
}

export function mapPolicyStageToLegacyStage(
    policyStage: PolicyStage | null | undefined
): WorkflowStage | null {
    if (!policyStage) {
        return null;
    }

    return POLICY_TO_LEGACY_STAGE[policyStage] ?? null;
}

export function isFailurePolicyStage(stage: PolicyStage | null | undefined): boolean {
    if (!stage) {
        return false;
    }

    return FAILURE_POLICY_STAGES.includes(stage);
}

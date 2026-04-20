import type { AccountStatus, UserRole, WorkflowStage } from '@/types/database';

export type PolicyStage =
    | 'TRANSFERRED'
    | 'DOCS_REVIEW'
    | 'ENROLLED'
    | 'EVALUATE'
    | 'ACCOUNTS'
    | 'DISPATCH'
    | 'COMPLETED';

export type PolicyAction =
    | 'create'
    | 'view'
    | 'assign'
    | 'verify'
    | 'approve'
    | 'reject'
    | 'flag'
    | 'dispatch'
    | 'submit_assessment'
    | 'verify_financials'
    | 'view_financials'
    | 'manage_users'
    | 'manage_roles'
    | 'view_audit_logs'
    | 'manage_workflows'
    | 'manage_rtos'
    | 'manage_reminders'
    | 'manage_integrations'
    | 'run_jobs';

export type PolicyResourceType =
    | 'application'
    | 'financial'
    | 'workflow_transition'
    | 'role_permission'
    | 'staff_account'
    | 'rto'
    | 'reminder'
    | 'integration'
    | 'audit_log'
    | 'system_job';

export type PolicyEffect = 'allow' | 'deny';

export type AssignmentAttribute =
    | 'createdByFrontdeskId'
    | 'createdByAgentId'
    | 'assignedAdminId'
    | 'assignedAssessorId'
    | 'assignedAccountsManagerId';

export interface PolicyRuleConditions {
    stages?: PolicyStage[];
    assessmentResults?: string[];
    anyOfAssignments?: AssignmentAttribute[];
    dispatchMethods?: Array<'email' | 'post'>;
    financialStatuses?: string[];
    allowIfUnassigned?: boolean;
}

export interface PolicyRule {
    id: string;
    effect: PolicyEffect;
    action: PolicyAction;
    resource: PolicyResourceType;
    conditions?: PolicyRuleConditions;
}

export interface RolePolicyDocument {
    version: string;
    role: UserRole;
    rules: PolicyRule[];
}

export interface ApplicationPolicyResource {
    applicationId: string;
    legacyStage: WorkflowStage;
    currentStage: PolicyStage;
    assignedAdminId: string | null;
    assignedAssessorId: string | null;
    assignedAccountsManagerId: string | null;
    createdByFrontdeskId: string | null;
    createdByAgentId: string | null;
    dispatchMethod: 'email' | 'post' | null;
    financialStatus: string | null;
    assessmentResult: string | null;
}

export interface AuthorizedUserContext {
    userId: string;
    role: UserRole;
    accountStatus: AccountStatus;
}

export interface AuthorizationDecision {
    allowed: boolean;
    reason: string;
    matchedRuleId?: string;
    usedCompatibilityOverride?: boolean;
}

export interface EvaluatePolicyInput {
    role: UserRole;
    userId: string;
    action: PolicyAction;
    resource: PolicyResourceType;
    application?: ApplicationPolicyResource | null;
    policyDocument?: RolePolicyDocument;
}

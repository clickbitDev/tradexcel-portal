import type { UserRole } from '@/types/database';
import type {
    PolicyAction,
    PolicyResourceType,
    PolicyRule,
    RolePolicyDocument,
} from '@/lib/access-control/types';

export const POLICY_VERSION = '2026-03-stage-map-v2';

const ROLE_RULES: Record<UserRole, PolicyRule[]> = {
    frontdesk: [
        {
            id: 'frontdesk.create.application',
            effect: 'allow',
            action: 'create',
            resource: 'application',
        },
        {
            id: 'frontdesk.view.own.application',
            effect: 'allow',
            action: 'view',
            resource: 'application',
            conditions: {
                anyOfAssignments: ['createdByFrontdeskId'],
            },
        },
    ],
    executive_manager: [
        {
            id: 'exec.view.application',
            effect: 'allow',
            action: 'view',
            resource: 'application',
        },
        {
            id: 'exec.create.application',
            effect: 'allow',
            action: 'create',
            resource: 'application',
        },
        {
            id: 'exec.assign.application',
            effect: 'allow',
            action: 'assign',
            resource: 'application',
        },
        {
            id: 'exec.verify.application',
            effect: 'allow',
            action: 'verify',
            resource: 'application',
        },
        {
            id: 'exec.approve.application',
            effect: 'allow',
            action: 'approve',
            resource: 'application',
        },
        {
            id: 'exec.reject.application',
            effect: 'allow',
            action: 'reject',
            resource: 'application',
        },
        {
            id: 'exec.flag.application',
            effect: 'allow',
            action: 'flag',
            resource: 'application',
        },
        {
            id: 'exec.dispatch.application',
            effect: 'allow',
            action: 'dispatch',
            resource: 'application',
        },
        {
            id: 'exec.submit.assessment',
            effect: 'allow',
            action: 'submit_assessment',
            resource: 'application',
        },
        {
            id: 'exec.verify.financials',
            effect: 'allow',
            action: 'verify_financials',
            resource: 'application',
        },
        {
            id: 'exec.manage.rtos',
            effect: 'allow',
            action: 'manage_rtos',
            resource: 'rto',
        },
        {
            id: 'exec.view.audit.logs',
            effect: 'allow',
            action: 'view_audit_logs',
            resource: 'audit_log',
        },
    ],
    admin: [
        {
            id: 'admin.view.assigned.review',
            effect: 'allow',
            action: 'view',
            resource: 'application',
            conditions: {
                stages: ['DOCS_REVIEW', 'ENROLLED', 'EVALUATE', 'ACCOUNTS', 'DISPATCH', 'COMPLETED'],
                anyOfAssignments: ['assignedAdminId'],
            },
        },
        {
            id: 'admin.verify.assigned.review',
            effect: 'allow',
            action: 'verify',
            resource: 'application',
            conditions: {
                stages: ['DOCS_REVIEW', 'ENROLLED', 'EVALUATE', 'DISPATCH'],
                anyOfAssignments: ['assignedAdminId'],
            },
        },
        {
            id: 'admin.flag.assigned.review',
            effect: 'allow',
            action: 'flag',
            resource: 'application',
            conditions: {
                stages: ['DOCS_REVIEW'],
                anyOfAssignments: ['assignedAdminId'],
            },
        },
        {
            id: 'admin.manage.reminders',
            effect: 'allow',
            action: 'manage_reminders',
            resource: 'reminder',
        },
    ],
    assessor: [
        {
            id: 'assessor.view.assigned',
            effect: 'allow',
            action: 'view',
            resource: 'application',
            conditions: {
                stages: ['ENROLLED', 'EVALUATE', 'ACCOUNTS', 'DISPATCH', 'COMPLETED'],
                anyOfAssignments: ['assignedAssessorId'],
            },
        },
        {
            id: 'assessor.submit.assessment',
            effect: 'allow',
            action: 'submit_assessment',
            resource: 'application',
            conditions: {
                stages: ['ENROLLED', 'EVALUATE'],
                anyOfAssignments: ['assignedAssessorId'],
            },
        },
    ],
    accounts_manager: [
        {
            id: 'accounts.view.finance.queue',
            effect: 'allow',
            action: 'view',
            resource: 'application',
            conditions: {
                stages: ['ACCOUNTS'],
                assessmentResults: ['pass'],
            },
        },
        {
            id: 'accounts.view.financials',
            effect: 'allow',
            action: 'view_financials',
            resource: 'financial',
        },
        {
            id: 'accounts.verify.financials',
            effect: 'allow',
            action: 'verify_financials',
            resource: 'application',
            conditions: {
                stages: ['ACCOUNTS'],
                assessmentResults: ['pass'],
            },
        },
        {
            id: 'accounts.flag.discrepancy',
            effect: 'allow',
            action: 'flag',
            resource: 'application',
            conditions: {
                stages: ['ACCOUNTS'],
                assessmentResults: ['pass'],
            },
        },
    ],
    ceo: [
        {
            id: 'ceo.view.pending.approval',
            effect: 'allow',
            action: 'view',
            resource: 'application',
            conditions: {
                stages: ['ACCOUNTS', 'DISPATCH'],
            },
        },
        {
            id: 'ceo.approve.pending.approval',
            effect: 'allow',
            action: 'approve',
            resource: 'application',
            conditions: {
                stages: ['ACCOUNTS'],
            },
        },
        {
            id: 'ceo.reject.pending.approval',
            effect: 'allow',
            action: 'reject',
            resource: 'application',
            conditions: {
                stages: ['ACCOUNTS'],
            },
        },
        {
            id: 'ceo.manage.users',
            effect: 'allow',
            action: 'manage_users',
            resource: 'staff_account',
        },
        {
            id: 'ceo.manage.roles',
            effect: 'allow',
            action: 'manage_roles',
            resource: 'role_permission',
        },
        {
            id: 'ceo.view.audit',
            effect: 'allow',
            action: 'view_audit_logs',
            resource: 'audit_log',
        },
        {
            id: 'ceo.manage.workflows',
            effect: 'allow',
            action: 'manage_workflows',
            resource: 'workflow_transition',
        },
        {
            id: 'ceo.manage.rtos',
            effect: 'allow',
            action: 'manage_rtos',
            resource: 'rto',
        },
    ],
    dispatch_coordinator: [
        {
            id: 'dispatch.view.approved',
            effect: 'allow',
            action: 'view',
            resource: 'application',
            conditions: {
                stages: ['DISPATCH', 'COMPLETED'],
            },
        },
        {
            id: 'dispatch.dispatch.approved',
            effect: 'allow',
            action: 'dispatch',
            resource: 'application',
            conditions: {
                stages: ['DISPATCH'],
                dispatchMethods: ['email', 'post'],
            },
        },
    ],
    agent: [
        {
            id: 'agent.create.application',
            effect: 'allow',
            action: 'create',
            resource: 'application',
        },
        {
            id: 'agent.view.own.application',
            effect: 'allow',
            action: 'view',
            resource: 'application',
            conditions: {
                anyOfAssignments: ['createdByAgentId'],
            },
        },
    ],
    developer: [
        {
            id: 'developer.view.application',
            effect: 'allow',
            action: 'view',
            resource: 'application',
        },
        {
            id: 'developer.view.financials',
            effect: 'allow',
            action: 'view_financials',
            resource: 'financial',
        },
        {
            id: 'developer.manage.users',
            effect: 'allow',
            action: 'manage_users',
            resource: 'staff_account',
        },
        {
            id: 'developer.approve.pending.approval',
            effect: 'allow',
            action: 'approve',
            resource: 'application',
            conditions: {
                stages: ['ACCOUNTS'],
            },
        },
        {
            id: 'developer.reject.pending.approval',
            effect: 'allow',
            action: 'reject',
            resource: 'application',
            conditions: {
                stages: ['ACCOUNTS'],
            },
        },
        {
            id: 'developer.manage.roles',
            effect: 'allow',
            action: 'manage_roles',
            resource: 'role_permission',
        },
        {
            id: 'developer.view.audit.logs',
            effect: 'allow',
            action: 'view_audit_logs',
            resource: 'audit_log',
        },
        {
            id: 'developer.manage.workflows',
            effect: 'allow',
            action: 'manage_workflows',
            resource: 'workflow_transition',
        },
        {
            id: 'developer.manage.rtos',
            effect: 'allow',
            action: 'manage_rtos',
            resource: 'rto',
        },
        {
            id: 'developer.manage.reminders',
            effect: 'allow',
            action: 'manage_reminders',
            resource: 'reminder',
        },
        {
            id: 'developer.manage.integrations',
            effect: 'allow',
            action: 'manage_integrations',
            resource: 'integration',
        },
        {
            id: 'developer.run.jobs',
            effect: 'allow',
            action: 'run_jobs',
            resource: 'system_job',
        },
    ],
};

const COMPATIBILITY_PERMISSION_KEY_BY_ACTION_RESOURCE: Partial<
    Record<`${PolicyAction}:${PolicyResourceType}`, string>
> = {
    'view:application': 'applications.view',
    'create:application': 'applications.create',
    'assign:application': 'applications.assign',
    'verify:application': 'applications.change_stage',
    'approve:application': 'applications.change_stage',
    'reject:application': 'applications.change_stage',
    'flag:application': 'applications.change_stage',
    'dispatch:application': 'applications.change_stage',
    'submit_assessment:application': 'applications.change_stage',
    'verify_financials:application': 'applications.change_stage',
    'view_financials:financial': 'applications.view',
    'manage_users:staff_account': 'staff.manage',
    'manage_roles:role_permission': 'roles.manage',
    'manage_workflows:workflow_transition': 'settings.manage',
    'manage_rtos:rto': 'rtos.manage',
    'manage_reminders:reminder': 'settings.manage',
    'view_audit_logs:audit_log': 'audit.view',
    'manage_integrations:integration': 'settings.manage',
    'run_jobs:system_job': 'settings.manage',
};

export const STAFF_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'developer',
];

export function getPolicyDocumentForRole(role: UserRole): RolePolicyDocument {
    return {
        version: POLICY_VERSION,
        role,
        rules: ROLE_RULES[role],
    };
}

export function getAllPolicyDocuments(): RolePolicyDocument[] {
    return (Object.keys(ROLE_RULES) as UserRole[]).map((role) => getPolicyDocumentForRole(role));
}

export function getCompatibilityPermissionKey(
    action: PolicyAction,
    resource: PolicyResourceType
): string | null {
    return COMPATIBILITY_PERMISSION_KEY_BY_ACTION_RESOURCE[`${action}:${resource}`] ?? null;
}

import {
    AbilityBuilder,
    createMongoAbility,
    type MongoAbility,
} from '@casl/ability';
import type {
    AssignmentAttribute,
    PolicyRuleConditions,
    PolicyResourceType,
    RolePolicyDocument,
} from '@/lib/access-control/types';

export type PolicySubject =
    | 'Application'
    | 'Financial'
    | 'WorkflowTransition'
    | 'RolePermission'
    | 'StaffAccount'
    | 'Rto'
    | 'Reminder'
    | 'Integration'
    | 'AuditLog'
    | 'SystemJob'
    | 'all';

export type AppAbility = MongoAbility;

function mapResourceToSubject(resource: PolicyResourceType): PolicySubject {
    switch (resource) {
        case 'application':
            return 'Application';
        case 'financial':
            return 'Financial';
        case 'workflow_transition':
            return 'WorkflowTransition';
        case 'role_permission':
            return 'RolePermission';
        case 'staff_account':
            return 'StaffAccount';
        case 'rto':
            return 'Rto';
        case 'reminder':
            return 'Reminder';
        case 'integration':
            return 'Integration';
        case 'audit_log':
            return 'AuditLog';
        case 'system_job':
            return 'SystemJob';
        default:
            return 'all';
    }
}

function mapAssignmentAttribute(attribute: AssignmentAttribute): string {
    switch (attribute) {
        case 'createdByFrontdeskId':
            return 'createdByFrontdeskId';
        case 'createdByAgentId':
            return 'createdByAgentId';
        case 'assignedAdminId':
            return 'assignedAdminId';
        case 'assignedAssessorId':
            return 'assignedAssessorId';
        case 'assignedAccountsManagerId':
            return 'assignedAccountsManagerId';
        default:
            return attribute;
    }
}

function buildConditions(
    ruleConditions: PolicyRuleConditions | undefined,
    userId: string
): Record<string, unknown> | undefined {
    if (!ruleConditions) {
        return undefined;
    }

    const conditions: Record<string, unknown> = {};

    if (ruleConditions.stages && ruleConditions.stages.length > 0) {
        conditions.currentStage = { $in: ruleConditions.stages };
    }

    if (ruleConditions.assessmentResults && ruleConditions.assessmentResults.length > 0) {
        conditions.assessmentResult = { $in: ruleConditions.assessmentResults };
    }

    if (ruleConditions.dispatchMethods && ruleConditions.dispatchMethods.length > 0) {
        conditions.dispatchMethod = { $in: ruleConditions.dispatchMethods };
    }

    if (ruleConditions.financialStatuses && ruleConditions.financialStatuses.length > 0) {
        conditions.financialStatus = { $in: ruleConditions.financialStatuses };
    }

    if (ruleConditions.anyOfAssignments && ruleConditions.anyOfAssignments.length > 0) {
        const assignmentConditions = ruleConditions.anyOfAssignments.map((attribute) => ({
            [mapAssignmentAttribute(attribute)]: userId,
        }));

        if (assignmentConditions.length === 1) {
            Object.assign(conditions, assignmentConditions[0]);
        } else {
            conditions.$or = assignmentConditions;
        }
    }

    return Object.keys(conditions).length > 0 ? conditions : undefined;
}

export function defineAbilityForPolicy(rolePolicy: RolePolicyDocument, userId: string): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    for (const rule of rolePolicy.rules) {
        const subject = mapResourceToSubject(rule.resource);
        const conditions = buildConditions(rule.conditions, userId);

        if (rule.effect === 'allow') {
            if (conditions) {
                can(rule.action, subject, conditions as never);
            } else {
                can(rule.action, subject);
            }
        } else if (conditions) {
            cannot(rule.action, subject, conditions as never);
        } else {
            cannot(rule.action, subject);
        }
    }

    return build({
        detectSubjectType(subject: unknown) {
            return (subject as { __caslSubjectType__?: PolicySubject }).__caslSubjectType__ || 'all';
        },
    });
}

export function createEmptyAbility(): AppAbility {
    return createMongoAbility<AppAbility>([]);
}

import { getPolicyDocumentForRole } from '@/lib/access-control/policies';
import type {
    ApplicationPolicyResource,
    AssignmentAttribute,
    AuthorizationDecision,
    EvaluatePolicyInput,
    PolicyRule,
    PolicyRuleConditions,
} from '@/lib/access-control/types';

function getAssignmentValue(
    application: ApplicationPolicyResource,
    attribute: AssignmentAttribute
): string | null {
    switch (attribute) {
        case 'createdByFrontdeskId':
            return application.createdByFrontdeskId;
        case 'createdByAgentId':
            return application.createdByAgentId;
        case 'assignedAdminId':
            return application.assignedAdminId;
        case 'assignedAssessorId':
            return application.assignedAssessorId;
        case 'assignedAccountsManagerId':
            return application.assignedAccountsManagerId;
        default:
            return null;
    }
}

function ruleRequiresApplicationContext(conditions?: PolicyRuleConditions): boolean {
    if (!conditions) {
        return false;
    }

    return Boolean(
        (conditions.stages && conditions.stages.length > 0)
        || (conditions.assessmentResults && conditions.assessmentResults.length > 0)
        || (conditions.anyOfAssignments && conditions.anyOfAssignments.length > 0)
        || (conditions.dispatchMethods && conditions.dispatchMethods.length > 0)
        || (conditions.financialStatuses && conditions.financialStatuses.length > 0)
    );
}

function matchesConditions(
    conditions: PolicyRuleConditions | undefined,
    userId: string,
    application: ApplicationPolicyResource | null | undefined
): { matches: boolean; reason: string } {
    if (!conditions) {
        return { matches: true, reason: 'no_conditions' };
    }

    if (ruleRequiresApplicationContext(conditions) && !application) {
        return { matches: false, reason: 'application_context_required' };
    }

    if (!application) {
        return { matches: true, reason: 'non_application_rule' };
    }

    if (conditions.stages && conditions.stages.length > 0 && !conditions.stages.includes(application.currentStage)) {
        return {
            matches: false,
            reason: `stage_not_allowed:${application.currentStage}`,
        };
    }

    if (conditions.assessmentResults && conditions.assessmentResults.length > 0) {
        if (!application.assessmentResult || !conditions.assessmentResults.includes(application.assessmentResult)) {
            return {
                matches: false,
                reason: `assessment_result_not_allowed:${application.assessmentResult || 'none'}`,
            };
        }
    }

    if (conditions.dispatchMethods && conditions.dispatchMethods.length > 0) {
        if (!application.dispatchMethod || !conditions.dispatchMethods.includes(application.dispatchMethod)) {
            return {
                matches: false,
                reason: `dispatch_method_not_allowed:${application.dispatchMethod || 'none'}`,
            };
        }
    }

    if (conditions.financialStatuses && conditions.financialStatuses.length > 0) {
        if (!application.financialStatus || !conditions.financialStatuses.includes(application.financialStatus)) {
            return {
                matches: false,
                reason: `financial_status_not_allowed:${application.financialStatus || 'none'}`,
            };
        }
    }

    if (conditions.anyOfAssignments && conditions.anyOfAssignments.length > 0) {
        const assignmentValues = conditions.anyOfAssignments
            .map((attribute) => getAssignmentValue(application, attribute));

        const hasMatch = assignmentValues.some((value) => value === userId);
        if (!hasMatch) {
            const allUnassigned = assignmentValues.every((value) => !value);
            if (!(conditions.allowIfUnassigned && allUnassigned)) {
                return {
                    matches: false,
                    reason: 'assignment_not_allowed',
                };
            }
        }
    }

    return { matches: true, reason: 'conditions_matched' };
}

export function evaluatePolicy(input: EvaluatePolicyInput): AuthorizationDecision {
    const policyDocument = input.policyDocument ?? getPolicyDocumentForRole(input.role);

    const matchingRules = policyDocument.rules.filter(
        (rule) => rule.action === input.action && rule.resource === input.resource
    );

    if (matchingRules.length === 0) {
        return {
            allowed: false,
            reason: 'no_matching_policy_rule',
        };
    }

    const denyRules: PolicyRule[] = [];
    const allowRules: PolicyRule[] = [];

    for (const rule of matchingRules) {
        if (rule.effect === 'deny') {
            denyRules.push(rule);
        } else {
            allowRules.push(rule);
        }
    }

    for (const denyRule of denyRules) {
        const denied = matchesConditions(denyRule.conditions, input.userId, input.application);
        if (denied.matches) {
            return {
                allowed: false,
                reason: `explicit_deny:${denyRule.id}`,
                matchedRuleId: denyRule.id,
            };
        }
    }

    let lastFailedReason = 'no_allow_rule_matched';

    for (const allowRule of allowRules) {
        const decision = matchesConditions(allowRule.conditions, input.userId, input.application);
        if (decision.matches) {
            return {
                allowed: true,
                reason: 'policy_rule_matched',
                matchedRuleId: allowRule.id,
            };
        }

        lastFailedReason = decision.reason;
    }

    return {
        allowed: false,
        reason: lastFailedReason,
    };
}

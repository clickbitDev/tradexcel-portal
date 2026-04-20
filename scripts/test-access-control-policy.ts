import assert from 'node:assert/strict';
import { evaluatePolicy } from '../src/lib/access-control/evaluate';
import { mapLegacyStageToPolicyStage } from '../src/lib/access-control/stages';
import type { ApplicationPolicyResource } from '../src/lib/access-control/types';

function createApplicationResource(input: Partial<ApplicationPolicyResource>): ApplicationPolicyResource {
    return {
        applicationId: input.applicationId || 'app-1',
        legacyStage: input.legacyStage || 'submitted',
        currentStage: input.currentStage || 'SUBMITTED',
        assignedAdminId: input.assignedAdminId || null,
        assignedAssessorId: input.assignedAssessorId || null,
        assignedAccountsManagerId: input.assignedAccountsManagerId || null,
        createdByFrontdeskId: input.createdByFrontdeskId || null,
        createdByAgentId: input.createdByAgentId || null,
        dispatchMethod: input.dispatchMethod || null,
        financialStatus: input.financialStatus || null,
        assessmentResult: input.assessmentResult || null,
    };
}

function run() {
    const mappedStage = mapLegacyStageToPolicyStage('evaluate');
    assert.equal(mappedStage, 'EVALUATE', 'legacy stage mapping should map evaluate');

    const adminVerifyAllowed = evaluatePolicy({
        role: 'admin',
        userId: 'admin-1',
        action: 'verify',
        resource: 'application',
        application: createApplicationResource({
            legacyStage: 'docs_review',
            currentStage: 'DOCS_REVIEW',
            assignedAdminId: 'admin-1',
        }),
    });
    assert.equal(adminVerifyAllowed.allowed, true, 'assigned admin should verify DOCS_REVIEW');

    const adminVerifyDeniedWrongStage = evaluatePolicy({
        role: 'admin',
        userId: 'admin-1',
        action: 'verify',
        resource: 'application',
        application: createApplicationResource({
            legacyStage: 'completed',
            currentStage: 'COMPLETED',
            assignedAdminId: 'admin-1',
        }),
    });
    assert.equal(adminVerifyDeniedWrongStage.allowed, false, 'admin verify should be stage-gated');

    const accountsVerifyAllowed = evaluatePolicy({
        role: 'accounts_manager',
        userId: 'accounts-1',
        action: 'verify_financials',
        resource: 'application',
        application: createApplicationResource({
            legacyStage: 'dispatch',
            currentStage: 'DISPATCH',
            assignedAccountsManagerId: 'accounts-1',
        }),
    });
    assert.equal(accountsVerifyAllowed.allowed, true, 'assigned accounts manager should verify financials');

    const developerCannotApprove = evaluatePolicy({
        role: 'developer',
        userId: 'dev-1',
        action: 'approve',
        resource: 'application',
        application: createApplicationResource({
            legacyStage: 'dispatch',
            currentStage: 'DISPATCH',
        }),
    });
    assert.equal(developerCannotApprove.allowed, false, 'developer should not perform operational approvals');

    const ceoApproveAllowed = evaluatePolicy({
        role: 'ceo',
        userId: 'ceo-1',
        action: 'approve',
        resource: 'application',
        application: createApplicationResource({
            legacyStage: 'dispatch',
            currentStage: 'DISPATCH',
        }),
    });
    assert.equal(ceoApproveAllowed.allowed, true, 'ceo should approve at dispatch stage');

    console.log('Policy tests passed.');
}

run();

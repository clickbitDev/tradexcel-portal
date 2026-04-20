import { insertApplicationHistory } from '@/lib/workflow/history';
import { NON_DELETED_PROFILE_FILTER, isActiveProfile } from '@/lib/staff/profile-filters';
import type { AssessmentResult, UserRole, WorkflowStage } from '@/types/database';

type ServerSupabaseClient = Awaited<
    ReturnType<typeof import('@/lib/supabase/server').createServerClient>
>;

const ROLE_BYPASS_TRANSITION_REQUIREMENTS = new Set<UserRole>(['ceo', 'executive_manager']);

const WORKFLOW_USER_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'developer',
    'agent',
]);

const ISO_TIMESTAMP_WITH_TZ = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/;

function parseIsoTimestampToComparableParts(value: string): {
    utcMilliseconds: number;
    fractionMicroseconds: number;
} | null {
    const match = ISO_TIMESTAMP_WITH_TZ.exec(value);
    if (!match) {
        return null;
    }

    const [
        ,
        year,
        month,
        day,
        hour,
        minute,
        second,
        fraction = '',
        timezone,
    ] = match;

    const baseUtcMilliseconds = Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
        0
    );

    if (!Number.isFinite(baseUtcMilliseconds)) {
        return null;
    }

    let offsetMinutes = 0;
    if (timezone !== 'Z') {
        const sign = timezone.startsWith('+') ? 1 : -1;
        const [offsetHours, offsetMins] = timezone.slice(1).split(':');
        offsetMinutes = sign * ((Number(offsetHours) * 60) + Number(offsetMins));
    }

    const utcMilliseconds = baseUtcMilliseconds - (offsetMinutes * 60 * 1000);
    const fractionMicroseconds = fraction ? Number(fraction.padEnd(6, '0')) : 0;

    if (!Number.isFinite(utcMilliseconds) || !Number.isFinite(fractionMicroseconds)) {
        return null;
    }

    return {
        utcMilliseconds,
        fractionMicroseconds,
    };
}

function timestampsRepresentSameInstant(left: string, right: string): boolean {
    const leftParts = parseIsoTimestampToComparableParts(left);
    const rightParts = parseIsoTimestampToComparableParts(right);

    if (leftParts !== null && rightParts !== null) {
        return leftParts.utcMilliseconds === rightParts.utcMilliseconds
            && leftParts.fractionMicroseconds === rightParts.fractionMicroseconds;
    }

    const leftMilliseconds = Date.parse(left);
    const rightMilliseconds = Date.parse(right);

    if (Number.isFinite(leftMilliseconds) && Number.isFinite(rightMilliseconds)) {
        return leftMilliseconds === rightMilliseconds;
    }

    return left === right;
}

export interface ApplicationWorkflowState {
    id: string;
    workflow_stage: WorkflowStage;
    updated_at: string;
    student_first_name: string;
    student_last_name: string;
    appointment_date: string | null;
    appointment_time: string | null;
    assessment_result: AssessmentResult;
    application_outcome: string;
    payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded' | 'waived';
    xero_invoice_id: string | null;
    xero_bill_id: string | null;
    assigned_admin_id: string | null;
    assigned_assessor_id: string | null;
    assigned_staff_id: string | null;
    received_by: string | null;
    dispatch_approval_requested_at: string | null;
    dispatch_approval_requested_by: string | null;
    dispatch_approval_approved_at: string | null;
    dispatch_approval_approved_by: string | null;
    dispatch_override_used: boolean;
    admin_applicant_pdf_email_completed: boolean;
    admin_references_email_completed: boolean;
    agent_applicant_pdf_email_completed: boolean;
    agent_references_email_completed: boolean;
    agent_enrollment_agreement_uploaded: boolean;
    agent_executive_manager_notified: boolean;
}

export interface WorkflowTransitionRule {
    id: string;
    from_stage: WorkflowStage;
    to_stage: WorkflowStage;
    is_allowed: boolean;
    requires_approval: boolean;
    required_role: UserRole | null;
    allowed_roles: string[] | null;
}

export interface WorkflowTransitionApprovalRow {
    id: string;
    application_id: string;
    from_stage: WorkflowStage;
    to_stage: WorkflowStage;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'executed';
    required_role: UserRole | null;
    requested_by: string;
    requested_at: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
    transition_notes: string | null;
    review_notes: string | null;
    executed_at: string | null;
    metadata: Record<string, unknown>;
}

export type TransitionFailureCode =
    | 'APPLICATION_NOT_FOUND'
    | 'WORKFLOW_CONFLICT'
    | 'TRANSITION_NOT_ALLOWED'
    | 'TRANSITION_ROLE_FORBIDDEN'
    | 'WORKFLOW_ADMIN_TASKS_INCOMPLETE'
    | 'WORKFLOW_APPROVAL_REQUIRED'
    | 'WORKFLOW_APPROVAL_INVALID'
    | 'WORKFLOW_TRANSITION_UPDATE_FAILED'
    | 'WORKFLOW_TRANSITION_RULES_UNAVAILABLE';

export type TransitionResult =
    | {
        ok: true;
        data: {
            id: string;
            fromStage: WorkflowStage;
            toStage: WorkflowStage;
            updatedAt: string;
            approvalId: string | null;
        };
    }
    | {
        ok: false;
        status: number;
        code: TransitionFailureCode;
        message: string;
        currentUpdatedAt?: string;
        approvalId?: string;
    };

export interface ExecuteWorkflowTransitionInput {
    supabase: ServerSupabaseClient;
    actorId: string;
    actorRole: UserRole;
    applicationId: string;
    toStage: WorkflowStage;
    notes?: string;
    expectedUpdatedAt?: string;
    notifyUserIds?: string[];
    approvalId?: string;
}

export function canActorSatisfyRequiredRole(
    actorRole: UserRole,
    requiredRole: UserRole | null
): boolean {
    if (!requiredRole) {
        return true;
    }

    return actorRole === requiredRole || ROLE_BYPASS_TRANSITION_REQUIREMENTS.has(actorRole);
}

function normalizeAllowedRoles(allowedRoles: string[] | null | undefined): UserRole[] | null {
    if (!allowedRoles || allowedRoles.length === 0) {
        return null;
    }

    const normalizedRoles = allowedRoles.filter((role): role is UserRole => WORKFLOW_USER_ROLES.has(role as UserRole));
    return normalizedRoles.length > 0 ? normalizedRoles : null;
}

export function canActorSatisfyTransitionRule(input: {
    actorRole: UserRole;
    requiredRole: UserRole | null;
    allowedRoles?: string[] | null;
}): boolean {
    if (ROLE_BYPASS_TRANSITION_REQUIREMENTS.has(input.actorRole)) {
        return true;
    }

    const normalizedAllowedRoles = normalizeAllowedRoles(input.allowedRoles);
    if (normalizedAllowedRoles) {
        return normalizedAllowedRoles.includes(input.actorRole);
    }

    return canActorSatisfyRequiredRole(input.actorRole, input.requiredRole);
}

export function buildTransitionRoleRequirementMessage(input: {
    requiredRole: UserRole | null;
    allowedRoles?: string[] | null;
}): string {
    const normalizedAllowedRoles = normalizeAllowedRoles(input.allowedRoles);
    if (normalizedAllowedRoles) {
        return `This transition requires one of these roles: ${normalizedAllowedRoles.join(', ')}.`;
    }

    if (input.requiredRole) {
        return `This transition requires ${input.requiredRole} role approval.`;
    }

    return 'You do not have permission to execute this transition.';
}

export function canActorReviewApproval(
    actorRole: UserRole,
    requiredRole: UserRole | null,
    actorId: string,
    requestedBy: string
): boolean {
    if (!canActorSatisfyRequiredRole(actorRole, requiredRole)) {
        return false;
    }

    if (actorId === requestedBy && !ROLE_BYPASS_TRANSITION_REQUIREMENTS.has(actorRole)) {
        return false;
    }

    return true;
}

export async function getApplicationWorkflowState(
    supabase: ServerSupabaseClient,
    applicationId: string
): Promise<ApplicationWorkflowState | null> {
    const { data, error } = await supabase
        .from('applications')
        .select('id, workflow_stage, updated_at, student_first_name, student_last_name, appointment_date, appointment_time, assessment_result, application_outcome, payment_status, xero_invoice_id, xero_bill_id, assigned_admin_id, assigned_assessor_id, assigned_staff_id, received_by, dispatch_approval_requested_at, dispatch_approval_requested_by, dispatch_approval_approved_at, dispatch_approval_approved_by, dispatch_override_used, admin_applicant_pdf_email_completed, admin_references_email_completed, agent_applicant_pdf_email_completed, agent_references_email_completed, agent_enrollment_agreement_uploaded, agent_executive_manager_notified')
        .eq('id', applicationId)
        .maybeSingle<ApplicationWorkflowState>();

    if (!error && data) {
        return data;
    }

    const missingTaskColumns = error?.message?.includes('admin_applicant_pdf_email_completed')
        || error?.message?.includes('admin_references_email_completed')
        || error?.message?.includes('agent_applicant_pdf_email_completed')
        || error?.message?.includes('agent_references_email_completed')
        || error?.message?.includes('agent_enrollment_agreement_uploaded')
        || error?.message?.includes('agent_executive_manager_notified')
        || error?.message?.includes('assessment_result')
        || error?.message?.includes('application_outcome');

    if (missingTaskColumns) {
        const { data: fallbackData, error: fallbackError } = await supabase
            .from('applications')
            .select('id, workflow_stage, updated_at, student_first_name, student_last_name, appointment_date, appointment_time, payment_status, xero_invoice_id, xero_bill_id, assigned_admin_id, assigned_assessor_id, assigned_staff_id, received_by, dispatch_approval_requested_at, dispatch_approval_requested_by, dispatch_approval_approved_at, dispatch_approval_approved_by, dispatch_override_used')
            .eq('id', applicationId)
            .maybeSingle<{
                id: string;
                workflow_stage: WorkflowStage;
                updated_at: string;
                student_first_name: string;
                student_last_name: string;
                appointment_date: string | null;
                appointment_time: string | null;
                payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded' | 'waived';
                xero_invoice_id: string | null;
                xero_bill_id: string | null;
                assigned_admin_id: string | null;
                assigned_assessor_id: string | null;
                assigned_staff_id: string | null;
                received_by: string | null;
                dispatch_approval_requested_at: string | null;
                dispatch_approval_requested_by: string | null;
                dispatch_approval_approved_at: string | null;
                dispatch_approval_approved_by: string | null;
                dispatch_override_used: boolean;
            }>();

        if (!fallbackError && fallbackData) {
            return {
                ...fallbackData,
                assessment_result: 'pending',
                application_outcome: 'active',
                payment_status: fallbackData.payment_status || 'unpaid',
                dispatch_approval_requested_at: fallbackData.dispatch_approval_requested_at || null,
                dispatch_approval_requested_by: fallbackData.dispatch_approval_requested_by || null,
                dispatch_approval_approved_at: fallbackData.dispatch_approval_approved_at || null,
                dispatch_approval_approved_by: fallbackData.dispatch_approval_approved_by || null,
                dispatch_override_used: Boolean(fallbackData.dispatch_override_used),
                admin_applicant_pdf_email_completed: false,
                admin_references_email_completed: false,
                agent_applicant_pdf_email_completed: false,
                agent_references_email_completed: false,
                agent_enrollment_agreement_uploaded: false,
                agent_executive_manager_notified: false,
            };
        }
    }

    if (!data) {
        return null;
    }

    return {
        ...data,
        assessment_result: (data.assessment_result || 'pending') as AssessmentResult,
        application_outcome: data.application_outcome || 'active',
        payment_status: (data.payment_status || 'unpaid') as ApplicationWorkflowState['payment_status'],
        dispatch_approval_requested_at: data.dispatch_approval_requested_at || null,
        dispatch_approval_requested_by: data.dispatch_approval_requested_by || null,
        dispatch_approval_approved_at: data.dispatch_approval_approved_at || null,
        dispatch_approval_approved_by: data.dispatch_approval_approved_by || null,
        dispatch_override_used: Boolean(data.dispatch_override_used),
        admin_applicant_pdf_email_completed: Boolean(data.admin_applicant_pdf_email_completed),
        admin_references_email_completed: Boolean(data.admin_references_email_completed),
        agent_applicant_pdf_email_completed: Boolean(data.agent_applicant_pdf_email_completed),
        agent_references_email_completed: Boolean(data.agent_references_email_completed),
        agent_enrollment_agreement_uploaded: Boolean(data.agent_enrollment_agreement_uploaded),
        agent_executive_manager_notified: Boolean(data.agent_executive_manager_notified),
    };
}

function areAdminDocsReviewTasksComplete(application: ApplicationWorkflowState): boolean {
    return application.admin_applicant_pdf_email_completed === true;
}

function areAgentDocsReviewTasksComplete(application: ApplicationWorkflowState): boolean {
    return application.agent_applicant_pdf_email_completed === true
        && application.agent_enrollment_agreement_uploaded === true
        && application.agent_executive_manager_notified === true;
}

function getDocsReviewToEnrolledBlockedReason(
    application: ApplicationWorkflowState,
    actorRole: UserRole
): string | null {
    if (application.workflow_stage !== 'docs_review') {
        return null;
    }

    if (actorRole === 'agent') {
        if (areAgentDocsReviewTasksComplete(application)) {
            return null;
        }

        if (!application.agent_applicant_pdf_email_completed) {
            return 'Complete step 1 first: send the applicant email with uploaded PDF attachment(s).';
        }

        if (!application.agent_enrollment_agreement_uploaded) {
            return 'Complete step 3 first: upload the enrollment agreement PDF.';
        }

        if (!application.agent_executive_manager_notified) {
            return 'Complete step 4 first: notify the executive manager.';
        }

        return 'Complete all required agent docs-review tasks before moving to Enrolled.';
    }

    if (actorRole === 'admin') {
        if (areAdminDocsReviewTasksComplete(application)) {
            return null;
        }

        return 'Complete the applicant email task first: send applicant email with a PDF attachment.';
    }

    return null;
}

function getTransferredToDocsReviewBlockedReason(application: ApplicationWorkflowState): string | null {
    if (application.workflow_stage !== 'TRANSFERRED') {
        return null;
    }

    if (!application.assigned_admin_id) {
        return 'Assign an admin before moving this transferred application to Docs Review.';
    }

    return null;
}

function getEnrolledToEvaluateBlockedReason(
    application: ApplicationWorkflowState,
    actorRole: UserRole,
    actorId: string
): string | null {
    if (application.workflow_stage !== 'enrolled') {
        return null;
    }

    if (!application.appointment_date || !application.appointment_time) {
        return 'Assign an appointment date and time before moving this application to Evaluate.';
    }

    if (actorRole === 'assessor' && application.assigned_assessor_id !== actorId) {
        return 'Only the assigned assessor can move this application to Evaluate.';
    }

    return null;
}

function getEvaluateToAccountsBlockedReason(
    application: ApplicationWorkflowState,
    actorRole: UserRole,
    actorId: string
): string | null {
    if (application.workflow_stage !== 'evaluate') {
        return null;
    }

    if (application.assessment_result !== 'pass') {
        return 'Only applications marked as Pass can move from Evaluate to Accounts.';
    }

    if (actorRole === 'admin') {
        if (!application.assigned_admin_id) {
            return 'Assign an admin before moving this application to Accounts.';
        }

        if (application.assigned_admin_id !== actorId) {
            return 'Only the assigned admin can move this application to Accounts.';
        }
    }

    return null;
}

function hasDispatchOverrideApproval(application: ApplicationWorkflowState): boolean {
    return Boolean(application.dispatch_approval_approved_at && application.dispatch_approval_approved_by);
}

function hasClearDispatchPayment(application: ApplicationWorkflowState): boolean {
    return application.payment_status === 'paid';
}

function getAccountsToDispatchBlockedReason(application: ApplicationWorkflowState): string | null {
    if (application.workflow_stage !== 'accounts') {
        return null;
    }

    if (application.assessment_result !== 'pass') {
        return 'Only applications marked as Pass can move from Accounts to Dispatch.';
    }

    if (!application.xero_invoice_id) {
        return 'Create the Xero invoice before moving this application to Dispatch.';
    }

    if (!application.xero_bill_id) {
        return 'Create the Xero bill before moving this application to Dispatch.';
    }

    if (!hasClearDispatchPayment(application) && !hasDispatchOverrideApproval(application)) {
        return 'Payment status must be Paid or CEO/Developer dispatch approval must be granted before moving to Dispatch.';
    }

    return null;
}

function isPdfDocument(input: { file_name: string; mime_type: string | null }): boolean {
    const mimeType = (input.mime_type || '').toLowerCase();
    return mimeType === 'application/pdf' || input.file_name.toLowerCase().endsWith('.pdf');
}

async function getDispatchToCompletedBlockedReason(input: {
    supabase: ServerSupabaseClient;
    application: ApplicationWorkflowState;
}): Promise<string | null> {
    if (input.application.workflow_stage !== 'dispatch') {
        return null;
    }

    const { data: documents, error } = await input.supabase
        .from('documents')
        .select('file_name, mime_type')
        .eq('application_id', input.application.id)
        .eq('document_type', 'Certificate')
        .returns<Array<{ file_name: string; mime_type: string | null }>>();

    if (error) {
        console.error('Dispatch completion document lookup failed:', error.message);
        return 'Unable to verify Certificate documents right now. Please try again.';
    }

    const hasCertificatePdf = (documents || []).some((document) => isPdfDocument(document));
    if (!hasCertificatePdf) {
        return 'Upload at least one Certificate PDF before moving this application to Completed.';
    }

    return null;
}

async function getTransitionBlockedReason(input: {
    supabase: ServerSupabaseClient;
    application: ApplicationWorkflowState;
    actorRole: UserRole;
    actorId: string;
    toStage: WorkflowStage;
}): Promise<string | null> {
    const { application, actorRole, actorId, toStage } = input;

    if (application.workflow_stage === 'TRANSFERRED' && toStage === 'docs_review') {
        return getTransferredToDocsReviewBlockedReason(application);
    }

    if (application.workflow_stage === 'docs_review' && toStage === 'enrolled') {
        return getDocsReviewToEnrolledBlockedReason(application, actorRole);
    }

    if (application.workflow_stage === 'enrolled' && toStage === 'evaluate') {
        return getEnrolledToEvaluateBlockedReason(application, actorRole, actorId);
    }

    if (application.workflow_stage === 'evaluate' && toStage === 'accounts') {
        return getEvaluateToAccountsBlockedReason(application, actorRole, actorId);
    }

    if (application.workflow_stage === 'accounts' && toStage === 'dispatch') {
        return getAccountsToDispatchBlockedReason(application);
    }

    if (application.workflow_stage === 'dispatch' && toStage === 'completed') {
        return getDispatchToCompletedBlockedReason({
            supabase: input.supabase,
            application,
        });
    }

    return null;
}

export async function getWorkflowTransitionRule(
    supabase: ServerSupabaseClient,
    fromStage: WorkflowStage,
    toStage: WorkflowStage
): Promise<{ rule: WorkflowTransitionRule | null; error: string | null }> {
    const { data, error } = await supabase
        .from('workflow_transitions')
        .select('id, from_stage, to_stage, is_allowed, requires_approval, required_role, allowed_roles')
        .eq('from_stage', fromStage)
        .eq('to_stage', toStage)
        .maybeSingle<WorkflowTransitionRule>();

    if (error) {
        return { rule: null, error: error.message };
    }

    return { rule: data || null, error: null };
}

async function resolveApprovedTransitionApproval(input: {
    supabase: ServerSupabaseClient;
    applicationId: string;
    fromStage: WorkflowStage;
    toStage: WorkflowStage;
    approvalId?: string;
}): Promise<{ approval: WorkflowTransitionApprovalRow | null; pendingApprovalId?: string; error?: string }> {
    const baseQuery = input.supabase
        .from('workflow_transition_approvals')
        .select('id, application_id, from_stage, to_stage, status, required_role, requested_by, requested_at, reviewed_by, reviewed_at, transition_notes, review_notes, executed_at, metadata')
        .eq('application_id', input.applicationId)
        .eq('from_stage', input.fromStage)
        .eq('to_stage', input.toStage);

    const approvalResult = input.approvalId
        ? await baseQuery.eq('id', input.approvalId).maybeSingle<WorkflowTransitionApprovalRow>()
        : await baseQuery
            .in('status', ['approved', 'pending'])
            .is('executed_at', null)
            .order('reviewed_at', { ascending: false })
            .order('requested_at', { ascending: false })
            .limit(1)
            .maybeSingle<WorkflowTransitionApprovalRow>();

    if (approvalResult.error) {
        return { approval: null, error: approvalResult.error.message };
    }

    const approval = approvalResult.data || null;

    if (!approval) {
        return { approval: null };
    }

    if (approval.status === 'pending') {
        return { approval: null, pendingApprovalId: approval.id };
    }

    if (approval.status !== 'approved' || approval.executed_at) {
        return { approval: null, error: 'Approval is not valid for execution.' };
    }

    return { approval };
}

async function markApprovalExecuted(
    supabase: ServerSupabaseClient,
    approvalId: string
): Promise<void> {
    const { error } = await supabase
        .from('workflow_transition_approvals')
        .update({
            status: 'executed',
            executed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', approvalId)
        .eq('status', 'approved');

    if (error) {
        console.warn('Workflow approval execute mark failed:', error.message);
    }
}

async function notifyTransition(input: {
    supabase: ServerSupabaseClient;
    actorId: string;
    application: ApplicationWorkflowState;
    toStage: WorkflowStage;
    notifyUserIds?: string[];
}): Promise<void> {
    const roleRecipients = await getRoleRecipientsForStage(input.supabase, input.toStage);
    const recipientIds = new Set<string>();

    const defaultRecipients = [
        input.application.assigned_admin_id,
        input.application.assigned_assessor_id,
        input.application.assigned_staff_id,
        input.application.received_by,
    ];

    for (const recipientId of defaultRecipients) {
        if (recipientId && recipientId !== input.actorId) {
            recipientIds.add(recipientId);
        }
    }

    for (const recipientId of roleRecipients) {
        if (recipientId !== input.actorId) {
            recipientIds.add(recipientId);
        }
    }

    for (const recipientId of input.notifyUserIds || []) {
        if (recipientId !== input.actorId) {
            recipientIds.add(recipientId);
        }
    }

    if (recipientIds.size === 0) {
        return;
    }

    const studentName = `${input.application.student_first_name} ${input.application.student_last_name}`.trim();
    const notifications = [...recipientIds].map((userId) => ({
        user_id: userId,
        type: 'application_update',
        title: 'Application stage updated',
        message: `${studentName} moved to ${input.toStage.replace(/_/g, ' ')}`,
        related_table: 'applications',
        related_id: input.application.id,
        priority: 'normal',
        metadata: {
            workflow_stage: input.toStage,
            source: 'workflow_transition',
        },
    }));

    const result = await input.supabase.from('notifications').insert(notifications);
    if (result.error) {
        console.warn('Workflow transition notifications failed:', result.error.message);
    }
}

async function getRoleRecipientsForStage(
    supabase: ServerSupabaseClient,
    stage: WorkflowStage
): Promise<string[]> {
    const roles: UserRole[] = [];

    if (stage === 'accounts') {
        roles.push('accounts_manager');
    }

    if (stage === 'dispatch') {
        roles.push('dispatch_coordinator');
    }

    if (roles.length === 0) {
        return [];
    }

    const withStatus = await supabase
        .from('profiles')
        .select('id, account_status, is_deleted')
        .in('role', roles)
        .or(NON_DELETED_PROFILE_FILTER);

    if (!withStatus.error) {
        return (withStatus.data || [])
            .filter((profile) => (profile.account_status || 'active') !== 'disabled' && isActiveProfile(profile))
            .map((profile) => profile.id);
    }

    const fallback = await supabase
        .from('profiles')
        .select('id, is_deleted')
        .in('role', roles)
        .or(NON_DELETED_PROFILE_FILTER);

    return (fallback.data || [])
        .filter(isActiveProfile)
        .map((profile) => profile.id);
}

export async function executeWorkflowTransition(
    input: ExecuteWorkflowTransitionInput
): Promise<TransitionResult> {
    const application = await getApplicationWorkflowState(input.supabase, input.applicationId);
    if (!application) {
        return {
            ok: false,
            status: 404,
            code: 'APPLICATION_NOT_FOUND',
            message: 'Application not found',
        };
    }

    if (
        input.expectedUpdatedAt
        && !timestampsRepresentSameInstant(input.expectedUpdatedAt, application.updated_at)
    ) {
        return {
            ok: false,
            status: 409,
            code: 'WORKFLOW_CONFLICT',
            message: 'Application has changed since you loaded it. Refresh and try again.',
            currentUpdatedAt: application.updated_at,
        };
    }

    const fromStage = application.workflow_stage;

    if (fromStage === input.toStage) {
        return {
            ok: false,
            status: 409,
            code: 'TRANSITION_NOT_ALLOWED',
            message: 'Application is already in the selected stage.',
        };
    }

    const { rule, error: ruleError } = await getWorkflowTransitionRule(
        input.supabase,
        fromStage,
        input.toStage
    );

    if (ruleError) {
        console.error('Workflow transition rule lookup failed:', ruleError);

        return {
            ok: false,
            status: 500,
            code: 'WORKFLOW_TRANSITION_RULES_UNAVAILABLE',
            message: 'Workflow settings are temporarily unavailable. Please try again shortly.',
        };
    }

    if (!rule || !rule.is_allowed) {
        return {
            ok: false,
            status: 403,
            code: 'TRANSITION_NOT_ALLOWED',
            message: `Transition ${fromStage} -> ${input.toStage} is not allowed.`,
        };
    }

    if (!canActorSatisfyTransitionRule({
        actorRole: input.actorRole,
        requiredRole: rule.required_role,
        allowedRoles: rule.allowed_roles,
    })) {
        return {
            ok: false,
            status: 403,
            code: 'TRANSITION_ROLE_FORBIDDEN',
            message: buildTransitionRoleRequirementMessage({
                requiredRole: rule.required_role,
                allowedRoles: rule.allowed_roles,
            }),
        };
    }

    const blockedReason = await getTransitionBlockedReason({
        supabase: input.supabase,
        application,
        actorRole: input.actorRole,
        actorId: input.actorId,
        toStage: input.toStage,
    });

    if (blockedReason) {
        return {
            ok: false,
            status: 403,
            code: 'WORKFLOW_ADMIN_TASKS_INCOMPLETE',
            message: blockedReason,
        };
    }

    let approvedTransitionId: string | null = null;
    if (rule.requires_approval) {
        const approvalResolution = await resolveApprovedTransitionApproval({
            supabase: input.supabase,
            applicationId: input.applicationId,
            fromStage,
            toStage: input.toStage,
            approvalId: input.approvalId,
        });

        if (approvalResolution.error) {
            return {
                ok: false,
                status: 403,
                code: 'WORKFLOW_APPROVAL_INVALID',
                message: approvalResolution.error,
            };
        }

        if (!approvalResolution.approval) {
            return {
                ok: false,
                status: 409,
                code: 'WORKFLOW_APPROVAL_REQUIRED',
                message: 'This transition requires approval before it can be executed.',
                approvalId: approvalResolution.pendingApprovalId,
            };
        }

        approvedTransitionId = approvalResolution.approval.id;
    }

    const transitionTimestamp = new Date().toISOString();
    const updatePayload: Record<string, string | boolean | null> = {
        workflow_stage: input.toStage,
        workflow_stage_updated_at: transitionTimestamp,
        last_updated_by: input.actorId,
        updated_at: transitionTimestamp,
    };

    if (fromStage === 'accounts' && input.toStage === 'dispatch') {
        updatePayload.dispatch_override_used = !hasClearDispatchPayment(application) && hasDispatchOverrideApproval(application);
    }

    if (fromStage === 'dispatch' && input.toStage === 'completed') {
        updatePayload.delivered_by = input.actorId;
        updatePayload.delivery_date = transitionTimestamp;
        updatePayload.is_delivered = true;
    }

    let updateQuery = input.supabase
        .from('applications')
        .update(updatePayload)
        .eq('id', input.applicationId);

    if (input.expectedUpdatedAt) {
        updateQuery = updateQuery.eq('updated_at', application.updated_at);
    }

    const { data: updatedApplication, error: updateError } = await updateQuery
        .select('id, workflow_stage, updated_at')
        .maybeSingle<{ id: string; workflow_stage: WorkflowStage; updated_at: string }>();

    if (updateError) {
        console.error('Workflow transition update failed:', {
            applicationId: input.applicationId,
            actorId: input.actorId,
            actorRole: input.actorRole,
            fromStage,
            toStage: input.toStage,
            expectedUpdatedAt: input.expectedUpdatedAt || null,
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint,
            code: updateError.code,
        });

        return {
            ok: false,
            status: 500,
            code: 'WORKFLOW_TRANSITION_UPDATE_FAILED',
            message: updateError.message,
        };
    }

    if (!updatedApplication) {
        return {
            ok: false,
            status: 409,
            code: 'WORKFLOW_CONFLICT',
            message: 'Application was updated by another user. Refresh and try again.',
        };
    }

    await insertApplicationHistory(input.supabase, {
        applicationId: input.applicationId,
        action: 'stage_changed',
        fieldChanged: 'workflow_stage',
        oldValue: fromStage,
        newValue: input.toStage,
        userId: input.actorId,
        metadata: {
            fromStage,
            toStage: input.toStage,
            notes: input.notes || null,
            source: 'workflow.transition.service',
            approval_id: approvedTransitionId,
        },
        fromStage,
        toStage: input.toStage,
        notes: input.notes || null,
    });

    const eventInsert = await input.supabase
        .from('workflow_transition_events')
        .insert({
            application_id: input.applicationId,
            from_stage: fromStage,
            to_stage: input.toStage,
            actor_id: input.actorId,
            notes: input.notes || null,
            metadata: {
                source: 'workflow.transition.service',
                approval_id: approvedTransitionId,
            },
        });

    if (eventInsert.error) {
        console.warn('Workflow transition event insert failed:', eventInsert.error.message);
    }

    await notifyTransition({
        supabase: input.supabase,
        actorId: input.actorId,
        application,
        toStage: input.toStage,
        notifyUserIds: input.notifyUserIds,
    });

    if (approvedTransitionId) {
        await markApprovalExecuted(input.supabase, approvedTransitionId);
    }

    return {
        ok: true,
        data: {
            id: updatedApplication.id,
            fromStage,
            toStage: updatedApplication.workflow_stage,
            updatedAt: updatedApplication.updated_at,
            approvalId: approvedTransitionId,
        },
    };
}

export async function getTransitionOptionsForApplication(input: {
    supabase: ServerSupabaseClient;
    actorId: string;
    actorRole: UserRole;
    applicationId: string;
}): Promise<
    | {
        ok: true;
        data: {
            applicationId: string;
            currentStage: WorkflowStage;
            updatedAt: string;
            options: Array<{
                transitionId: string;
                toStage: WorkflowStage;
                requiresApproval: boolean;
                requiredRole: UserRole | null;
                allowedRoles: UserRole[] | null;
                canExecute: boolean;
                canRequestApproval: boolean;
                approvalStatus: 'pending' | 'approved' | null;
                approvalId: string | null;
                blockedReason: string | null;
            }>;
        };
    }
    | {
        ok: false;
        status: number;
        message: string;
    }
> {
    const application = await getApplicationWorkflowState(input.supabase, input.applicationId);
    if (!application) {
        return {
            ok: false,
            status: 404,
            message: 'Application not found',
        };
    }

    const { data: transitions, error: transitionError } = await input.supabase
        .from('workflow_transitions')
        .select('id, from_stage, to_stage, is_allowed, requires_approval, required_role, allowed_roles')
        .eq('from_stage', application.workflow_stage)
        .eq('is_allowed', true)
        .order('to_stage', { ascending: true });

    if (transitionError) {
        console.error('Workflow transition options lookup failed:', transitionError.message);

        return {
            ok: false,
            status: 500,
            message: 'Unable to load available workflow actions right now. Please refresh and try again.',
        };
    }

    const { data: approvals, error: approvalsError } = await input.supabase
        .from('workflow_transition_approvals')
        .select('id, to_stage, status, executed_at, reviewed_at, requested_at')
        .eq('application_id', input.applicationId)
        .eq('from_stage', application.workflow_stage)
        .in('status', ['pending', 'approved'])
        .is('executed_at', null)
        .order('reviewed_at', { ascending: false })
        .order('requested_at', { ascending: false });

    if (approvalsError) {
        console.error('Workflow approvals lookup failed:', approvalsError.message);

        return {
            ok: false,
            status: 500,
            message: 'Unable to load approval status right now. Please refresh and try again.',
        };
    }

    const approvalByTarget = new Map<WorkflowStage, { id: string; status: 'pending' | 'approved' }>();
    for (const approval of approvals || []) {
        const toStage = approval.to_stage as WorkflowStage;
        if (approvalByTarget.has(toStage)) {
            continue;
        }

        if (approval.status === 'pending' || approval.status === 'approved') {
            approvalByTarget.set(toStage, {
                id: approval.id,
                status: approval.status,
            });
        }
    }

    const options = await Promise.all((transitions || []).map(async (transition) => {
        const toStage = transition.to_stage as WorkflowStage;
        const requiredRole = (transition.required_role || null) as UserRole | null;
        const allowedRoles = normalizeAllowedRoles(transition.allowed_roles);
        const canExecuteByRole = canActorSatisfyTransitionRule({
            actorRole: input.actorRole,
            requiredRole,
            allowedRoles: transition.allowed_roles,
        });
        const approval = approvalByTarget.get(toStage);

        const blockedReason = await getTransitionBlockedReason({
            supabase: input.supabase,
            application,
            actorRole: input.actorRole,
            actorId: input.actorId,
            toStage,
        });

        const canExecute = canExecuteByRole
            && (!transition.requires_approval || approval?.status === 'approved')
            && !blockedReason;

        return {
            transitionId: transition.id,
            toStage,
            requiresApproval: transition.requires_approval,
            requiredRole,
            allowedRoles,
            canExecute,
            canRequestApproval: transition.requires_approval && canExecuteByRole,
            approvalStatus: transition.requires_approval
                ? (approval?.status || null)
                : null,
            approvalId: transition.requires_approval
                ? (approval?.id || null)
                : null,
            blockedReason,
        };
    }));

    return {
        ok: true,
        data: {
            applicationId: application.id,
            currentStage: application.workflow_stage,
            updatedAt: application.updated_at,
            options,
        },
    };
}

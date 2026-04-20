import { NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient, createServerClient } from '@/lib/supabase/server';
import { evaluatePolicy } from '@/lib/access-control/evaluate';
import { getCompatibilityPermissionKey } from '@/lib/access-control/policies';
import { getDefaultActionPermissionsForRole } from '@/lib/access-control/action-permissions';
import { mapLegacyStageToPolicyStage } from '@/lib/access-control/stages';
import type {
    ApplicationPolicyResource,
    AuthorizationDecision,
    AuthorizedUserContext,
    PolicyAction,
    PolicyResourceType,
} from '@/lib/access-control/types';
import type { AccountStatus, UserRole, WorkflowStage } from '@/types/database';
import { SUPABASE_CONFIGURATION_USER_MESSAGE, isSupabaseConfigurationError } from '@/lib/supabase/config-error';

const ALL_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'developer',
    'agent',
];

const FULL_FINANCIAL_ROLES = new Set<UserRole>(['accounts_manager', 'developer']);

const FINANCIAL_KEYS = new Set([
    'tuition_fee',
    'material_fee',
    'application_fee',
    'other_fees',
    'tuition_cost',
    'material_cost',
    'other_costs',
    'total_amount',
    'amount_paid',
    'amount_due',
    'discount',
    'quoted_tuition',
    'quoted_materials',
    'assessor_fee',
    'commission_rate',
    'raw_payload',
    'xero_invoice_id',
    'xero_invoice_number',
    'xero_invoice_url',
    'xero_bill_id',
    'xero_bill_number',
    'xero_bill_url',
    'xero_payment_id',
    'xero_last_synced_at',
]);

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

interface AuthContext extends AuthorizedUserContext {
    supabase: ServerSupabaseClient;
}

interface AuthContextResultSuccess {
    ok: true;
    context: AuthContext;
}

interface AuthContextResultFailure {
    ok: false;
    response: NextResponse;
}

type AuthContextResult = AuthContextResultSuccess | AuthContextResultFailure;

export interface ApiAuthorizationOptions {
    request?: NextRequest;
    resource: PolicyResourceType;
    action?: PolicyAction;
    allowedRoles?: UserRole[];
    applicationId?: string | null;
    allowDisabled?: boolean;
    allowCompatibilityPermission?: boolean;
    compatibilityPermissionKey?: string | null;
    audit?: boolean;
}

export interface ApiAuthorizationSuccess {
    supabase: ServerSupabaseClient;
    userId: string;
    role: UserRole;
    accountStatus: AccountStatus;
    decision?: AuthorizationDecision;
    application?: ApplicationPolicyResource | null;
}

interface ApiAuthorizationFailure {
    ok: false;
    response: NextResponse;
}

interface ApiAuthorizationOk {
    ok: true;
    context: ApiAuthorizationSuccess;
}

export type ApiAuthorizationResult = ApiAuthorizationOk | ApiAuthorizationFailure;

type ProfileRow = {
    role?: string | null;
    account_status?: string | null;
};

type PartnerLookupRow = {
    user_id?: string | null;
};

type ApplicationPolicyLookupRow = {
    id: string;
    workflow_stage: WorkflowStage;
    assessment_result: string | null;
    assigned_admin_id: string | null;
    assigned_assessor_id: string | null;
    assigned_staff_id: string | null;
    received_by: string | null;
    payment_status: string | null;
    delivery_method: string | null;
    partner_id: string | null;
    partner?: PartnerLookupRow | PartnerLookupRow[] | null;
};

function isUserRole(value: string | null | undefined): value is UserRole {
    if (!value) {
        return false;
    }

    return ALL_ROLES.includes(value as UserRole);
}

function forbiddenResponse(message: string): NextResponse {
    return NextResponse.json({ error: message }, { status: 403 });
}

function getRequestIp(request: NextRequest | undefined): string | null {
    if (!request) {
        return null;
    }

    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) {
        return xForwardedFor.split(',')[0].trim();
    }

    return request.headers.get('x-real-ip');
}

async function getProfileWithStatus(
    supabase: ServerSupabaseClient,
    userId: string
): Promise<{ role: UserRole | null; accountStatus: AccountStatus }> {
    const { data: profileWithStatus, error: profileWithStatusError } = await supabase
        .from('profiles')
        .select('role, account_status')
        .eq('id', userId)
        .single<ProfileRow>();

    if (profileWithStatusError && profileWithStatusError.message?.includes('account_status')) {
        const { data: fallbackProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single<ProfileRow>();

        return {
            role: isUserRole(fallbackProfile?.role) ? fallbackProfile.role : null,
            accountStatus: 'active',
        };
    }

    const role = isUserRole(profileWithStatus?.role) ? profileWithStatus.role : null;
    const accountStatus = profileWithStatus?.account_status === 'disabled'
        ? 'disabled'
        : 'active';

    return { role, accountStatus };
}

export async function getAuthenticatedUserContext(options?: {
    allowDisabled?: boolean;
}): Promise<AuthContextResult> {
    let supabase: ServerSupabaseClient;

    try {
        supabase = await createServerClient();
    } catch (error) {
        if (isSupabaseConfigurationError(error)) {
            return {
                ok: false,
                response: NextResponse.json({ error: SUPABASE_CONFIGURATION_USER_MESSAGE }, { status: 503 }),
            };
        }

        throw error;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }

    const { role, accountStatus } = await getProfileWithStatus(supabase, user.id);
    if (!role) {
        return {
            ok: false,
            response: forbiddenResponse('Forbidden'),
        };
    }

    if (!options?.allowDisabled && accountStatus === 'disabled') {
        return {
            ok: false,
            response: forbiddenResponse('Your account is disabled'),
        };
    }

    return {
        ok: true,
        context: {
            supabase,
            userId: user.id,
            role,
            accountStatus,
        },
    };
}

async function checkExplicitPermission(
    supabase: ServerSupabaseClient,
    role: UserRole,
    permissionKey: string
): Promise<boolean> {
    const defaultGranted = getDefaultActionPermissionsForRole(role)[permissionKey] === true;

    const { data, error } = await supabase
        .from('role_permissions')
        .select('granted')
        .eq('role', role)
        .eq('permission_key', permissionKey)
        .maybeSingle<{ granted: boolean }>();

    if (error || !data) {
        return defaultGranted;
    }

    return data.granted === true;
}

async function fetchApplicationPolicyResource(
    applicationId: string,
    supabase: ServerSupabaseClient
): Promise<ApplicationPolicyResource | null> {
    let queryClient:
        | ServerSupabaseClient
        | ReturnType<typeof createAdminServerClient> = supabase;

    try {
        queryClient = createAdminServerClient();
    } catch {
        queryClient = supabase;
    }

    const { data: application, error: applicationError } = await queryClient
        .from('applications')
        .select('id, workflow_stage, assessment_result, assigned_admin_id, assigned_assessor_id, assigned_staff_id, received_by, payment_status, delivery_method, partner_id')
        .eq('id', applicationId)
        .maybeSingle<ApplicationPolicyLookupRow>();

    if (applicationError || !application) {
        return null;
    }

    let createdByAgentId: string | null = null;
    if (application.partner_id) {
        const { data: partner } = await queryClient
            .from('partners')
            .select('user_id')
            .eq('id', application.partner_id)
            .maybeSingle<PartnerLookupRow>();

        createdByAgentId = partner?.user_id ?? null;
    }

    const mappedStage = mapLegacyStageToPolicyStage(application.workflow_stage);
    if (!mappedStage) {
        return null;
    }

    const dispatchMethod = application.delivery_method === 'email' || application.delivery_method === 'post'
        ? application.delivery_method
        : null;

    return {
        applicationId: application.id,
        legacyStage: application.workflow_stage,
        currentStage: mappedStage,
        assignedAdminId: application.assigned_admin_id,
        assignedAssessorId: application.assigned_assessor_id || application.assigned_staff_id,
        assignedAccountsManagerId: application.assigned_staff_id,
        createdByFrontdeskId: application.received_by,
        createdByAgentId,
        dispatchMethod,
        financialStatus: application.payment_status,
        assessmentResult: application.assessment_result,
    };
}

async function writeAuditLog(input: {
    request?: NextRequest;
    userId: string;
    role: UserRole;
    resource: PolicyResourceType;
    action: PolicyAction;
    applicationId?: string | null;
    decision: AuthorizationDecision;
}): Promise<void> {
    const metadata = {
        role: input.role,
        resource: input.resource,
        action: input.action,
        reason: input.decision.reason,
        matchedRuleId: input.decision.matchedRuleId,
        compatibilityOverride: input.decision.usedCompatibilityOverride ?? false,
        path: input.request?.nextUrl.pathname || null,
        method: input.request?.method || null,
    };

    try {
        const adminSupabase = createAdminServerClient();
        const { error } = await adminSupabase
            .from('audit_logs')
            .insert({
                user_id: input.userId,
                action: `policy.${input.action}.${input.decision.allowed ? 'allowed' : 'denied'}`,
                table_name: input.resource,
                record_id: input.applicationId || null,
                old_data: null,
                new_data: metadata,
                ip_address: getRequestIp(input.request),
                user_agent: input.request?.headers.get('user-agent') || null,
            });

        if (error) {
            console.warn('Policy audit log insert failed:', error.message);
        }
    } catch (error) {
        console.warn('Policy audit logging unavailable:', error);
    }
}

export async function authorizeApiRequest(options: ApiAuthorizationOptions): Promise<ApiAuthorizationResult> {
    const authResult = await getAuthenticatedUserContext({
        allowDisabled: options.allowDisabled,
    });

    if (!authResult.ok) {
        return authResult;
    }

    const { context } = authResult;

    if (options.allowedRoles && !options.allowedRoles.includes(context.role)) {
        return {
            ok: false,
            response: forbiddenResponse('Forbidden'),
        };
    }

    let applicationResource: ApplicationPolicyResource | null = null;
    if (options.applicationId) {
        applicationResource = await fetchApplicationPolicyResource(options.applicationId, context.supabase);
        if (!applicationResource) {
            return {
                ok: false,
                response: NextResponse.json({ error: 'Application not found' }, { status: 404 }),
            };
        }
    }

    let decision: AuthorizationDecision | undefined;
    if (options.action) {
        decision = evaluatePolicy({
            role: context.role,
            userId: context.userId,
            action: options.action,
            resource: options.resource,
            application: applicationResource,
        });

        if (!decision.allowed && (options.allowCompatibilityPermission ?? true)) {
            const compatibilityPermissionKey = options.compatibilityPermissionKey
                ?? getCompatibilityPermissionKey(options.action, options.resource);

            if (compatibilityPermissionKey) {
                const granted = await checkExplicitPermission(
                    context.supabase,
                    context.role,
                    compatibilityPermissionKey
                );

                if (granted) {
                    decision = {
                        allowed: true,
                        reason: `compatibility_permission_granted:${compatibilityPermissionKey}`,
                        usedCompatibilityOverride: true,
                    };
                }
            }
        }

        if (options.audit !== false) {
            await writeAuditLog({
                request: options.request,
                userId: context.userId,
                role: context.role,
                resource: options.resource,
                action: options.action,
                applicationId: applicationResource?.applicationId,
                decision,
            });
        }

        if (!decision.allowed) {
            return {
                ok: false,
                response: NextResponse.json(
                    { error: 'Forbidden', reason: decision.reason },
                    { status: 403 }
                ),
            };
        }
    }

    return {
        ok: true,
        context: {
            ...context,
            decision,
            application: applicationResource,
        },
    };
}

function redactFinancialPayload(payload: unknown): unknown {
    if (Array.isArray(payload)) {
        return payload.map((item) => redactFinancialPayload(item));
    }

    if (!payload || typeof payload !== 'object') {
        return payload;
    }

    const source = payload as Record<string, unknown>;
    const target: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(source)) {
        if (FINANCIAL_KEYS.has(key)) {
            target[key] = null;
            continue;
        }

        target[key] = redactFinancialPayload(value);
    }

    return target;
}

export function canViewFullFinancialData(role: UserRole): boolean {
    return FULL_FINANCIAL_ROLES.has(role);
}

export function redactFinancialDataForRole<T>(payload: T, role: UserRole): T {
    if (canViewFullFinancialData(role)) {
        return payload;
    }

    return redactFinancialPayload(payload) as T;
}

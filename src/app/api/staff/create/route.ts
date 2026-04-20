import { NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { AgentProvisioningError, ensureAgentPartner } from '@/lib/partners/agent-provisioning';
import type { AccountStatus, UserRole } from '@/types/database';

const ROLE_LABELS: Record<UserRole, string> = {
    ceo: 'CEO',
    executive_manager: 'Executive Manager',
    admin: 'Admin',
    accounts_manager: 'Accounts Manager',
    assessor: 'Assessor',
    dispatch_coordinator: 'Dispatch Coordinator',
    frontdesk: 'Frontdesk',
    developer: 'Developer',
    agent: 'Agent',
};

const VALID_ROLES = new Set<UserRole>([
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

const VALID_ACCOUNT_STATUSES = new Set<AccountStatus>(['active', 'disabled']);
const DISABLE_BAN_DURATION = '876000h';

type CreateStaffPayload = {
    email?: string;
    full_name?: string;
    phone?: string | null;
    role?: UserRole;
    password?: string;
    confirmPassword?: string;
    account_status?: AccountStatus;
};

type ExistingProfileRow = {
    id: string;
    email: string | null;
    full_name: string | null;
    role: UserRole;
    account_status?: AccountStatus | null;
    is_deleted?: boolean | null;
};

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function validatePassword(password: string): string | null {
    if (password.length < 8) {
        return 'Password must be at least 8 characters long';
    }

    if (!/[A-Z]/.test(password)) {
        return 'Password must include at least one uppercase letter';
    }

    if (!/[a-z]/.test(password)) {
        return 'Password must include at least one lowercase letter';
    }

    if (!/[0-9]/.test(password)) {
        return 'Password must include at least one number';
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        return 'Password must include at least one special character';
    }

    return null;
}

function buildExistingUserConflict(profile: ExistingProfileRow) {
    const roleLabel = ROLE_LABELS[profile.role] || profile.role;
    const isDeleted = profile.is_deleted === true;
    const isAgent = profile.role === 'agent';

    return {
        error: isDeleted
            ? `A deleted ${roleLabel} account already uses this email. Restore the existing account instead of creating a new one.`
            : isAgent
                ? 'This email already belongs to an existing Agent account. Agent accounts are managed under Settings -> Agents, not Staff.'
                : `This email already belongs to an existing ${roleLabel} account.`,
        code: 'STAFF_EMAIL_EXISTS',
        existingUser: {
            id: profile.id,
            role: profile.role,
            roleLabel,
            isDeleted,
            accountStatus: profile.account_status || 'active',
            destination: isAgent ? '/portal/settings/agents' : `/portal/settings/staff/${profile.id}`,
        },
    };
}

export async function POST(request: NextRequest) {
    try {
        const authz = await authorizeApiRequest({
            request,
            resource: 'staff_account',
            action: 'manage_users',
            compatibilityPermissionKey: 'staff.manage',
        });
        if (!authz.ok) {
            return authz.response;
        }

        const body = (await request.json()) as CreateStaffPayload;
        const email = body.email ? normalizeEmail(body.email) : '';
        const fullName = body.full_name?.trim() || '';
        const role = body.role || 'admin';
        const password = body.password || '';
        const confirmPassword = body.confirmPassword || '';
        const accountStatus = body.account_status || 'active';

        if (!email || !fullName || !password || !confirmPassword) {
            return NextResponse.json(
                { error: 'Email, full name, password, and confirm password are required' },
                { status: 400 }
            );
        }

        if (!VALID_ROLES.has(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        if (!VALID_ACCOUNT_STATUSES.has(accountStatus)) {
            return NextResponse.json({ error: 'Invalid account status' }, { status: 400 });
        }

        if (password !== confirmPassword) {
            return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            return NextResponse.json({ error: passwordError }, { status: 400 });
        }

        const supabaseAdmin = createAdminServerClient();

        const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id, email, full_name, role, account_status, is_deleted')
            .eq('email', email)
            .maybeSingle<ExistingProfileRow>();

        if (existingProfile) {
            return NextResponse.json(buildExistingUserConflict(existingProfile), { status: 409 });
        }

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            ban_duration: accountStatus === 'disabled' ? DISABLE_BAN_DURATION : undefined,
            user_metadata: {
                full_name: fullName,
                role,
            },
        });

        if (createError || !newUser?.user) {
            const duplicateEmail = createError?.message?.toLowerCase().includes('already');

            if (duplicateEmail) {
                const { data: duplicateProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('id, email, full_name, role, account_status, is_deleted')
                    .eq('email', email)
                    .maybeSingle<ExistingProfileRow>();

                if (duplicateProfile) {
                    return NextResponse.json(buildExistingUserConflict(duplicateProfile), { status: 409 });
                }
            }

            return NextResponse.json(
                { error: duplicateEmail ? 'A user with this email already exists' : (createError?.message || 'Failed to create user') },
                { status: duplicateEmail ? 409 : 500 }
            );
        }

        const { error: profileUpdateError } = await supabaseAdmin
            .from('profiles')
            .update({
                full_name: fullName,
                phone: body.phone || null,
                role,
                account_status: accountStatus,
            })
            .eq('id', newUser.user.id);

        if (profileUpdateError) {
            await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);

            const missingStatusColumn = profileUpdateError.message?.includes('account_status');
            return NextResponse.json(
                {
                    error: missingStatusColumn
                        ? 'Database schema is missing account status support. Run pending migrations.'
                        : 'Failed to initialize user profile',
                },
                { status: 500 }
            );
        }

        if (role === 'agent') {
            try {
                await ensureAgentPartner(supabaseAdmin, {
                    userId: newUser.user.id,
                    email,
                    fullName,
                    phone: body.phone || null,
                });
            } catch (error) {
                await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);

                const message = error instanceof AgentProvisioningError
                    ? error.message
                    : 'Failed to create the linked agent partner profile';
                const status = error instanceof AgentProvisioningError
                    ? error.status
                    : 500;

                return NextResponse.json({ error: message }, { status });
            }
        }

        return NextResponse.json({
            data: {
                user: {
                    id: newUser.user.id,
                    email: newUser.user.email,
                    role,
                    account_status: accountStatus,
                },
            },
            message: 'User created successfully',
        });
    } catch {
        return NextResponse.json(
            { error: 'Failed to create user' },
            { status: 500 }
        );
    }
}

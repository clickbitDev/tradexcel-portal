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

type InviteStaffPayload = {
    email?: string;
    role?: UserRole;
    full_name?: string;
    phone?: string | null;
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

        const body = (await request.json()) as InviteStaffPayload;
        const email = body.email ? normalizeEmail(body.email) : '';
        const fullName = body.full_name?.trim() || '';
        const role = body.role || 'admin';

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        if (!VALID_ROLES.has(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
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

        const redirectTo = new URL('/auth/callback', request.url).toString();
        const { data: invitedUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: {
                role,
                ...(fullName ? { full_name: fullName } : {}),
            },
            redirectTo,
        });

        if (inviteError || !invitedUser.user) {
            const duplicateEmail = inviteError?.message?.toLowerCase().includes('already');

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
                { error: duplicateEmail ? 'A user with this email already exists' : (inviteError?.message || 'Failed to send invitation') },
                { status: duplicateEmail ? 409 : 500 }
            );
        }

        const profileUpdates: {
            role: UserRole;
            email: string;
            full_name?: string;
            phone?: string | null;
        } = {
            role,
            email,
        };

        if (fullName) {
            profileUpdates.full_name = fullName;
        }

        if (typeof body.phone === 'string' || body.phone === null) {
            profileUpdates.phone = body.phone;
        }

        const { error: profileUpdateError } = await supabaseAdmin
            .from('profiles')
            .update(profileUpdates)
            .eq('id', invitedUser.user.id);

        if (profileUpdateError) {
            await supabaseAdmin.auth.admin.deleteUser(invitedUser.user.id);
            return NextResponse.json({ error: 'Failed to initialize user profile' }, { status: 500 });
        }

        if (role === 'agent') {
            try {
                await ensureAgentPartner(supabaseAdmin, {
                    userId: invitedUser.user.id,
                    email,
                    fullName,
                    phone: body.phone || null,
                });
            } catch (error) {
                await supabaseAdmin.auth.admin.deleteUser(invitedUser.user.id);

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
                    id: invitedUser.user.id,
                    email,
                    role,
                },
            },
            message: 'Invitation sent successfully',
        });
    } catch {
        return NextResponse.json(
            { error: 'Failed to send invitation' },
            { status: 500 }
        );
    }
}

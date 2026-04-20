import { NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { NON_DELETED_PROFILE_FILTER } from '@/lib/staff/profile-filters';
import type { AccountStatus, UserRole } from '@/types/database';

const ALLOWED_DELETE_ROLES: UserRole[] = ['ceo', 'developer'];
const DISABLE_BAN_DURATION = '876000h';

type StaffDeleteDependencySummary = {
    assignedApplicationsAsAdmin: number;
    assignedApplicationsAsAssessor: number;
    assignedApplicationsAsStaff: number;
    activeWorkflowAssignments: number;
    managedRtos: number;
    managedPartners: number;
};

type TargetProfileRow = {
    id: string;
    email: string | null;
    full_name: string | null;
    role: UserRole;
    account_status: AccountStatus | null;
    is_deleted: boolean | null;
    deleted_at?: string | null;
    deleted_by?: string | null;
};

function hasBlockingDependencies(summary: StaffDeleteDependencySummary): boolean {
    return Object.values(summary).some((count) => count > 0);
}

function formatDependencyMessage(summary: StaffDeleteDependencySummary): string {
    const labels: Array<[keyof StaffDeleteDependencySummary, string]> = [
        ['assignedApplicationsAsAdmin', 'applications assigned as Admin'],
        ['assignedApplicationsAsAssessor', 'applications assigned as Assessor'],
        ['assignedApplicationsAsStaff', 'applications assigned as Accounts/Dispatch staff'],
        ['activeWorkflowAssignments', 'active workflow assignments'],
        ['managedRtos', 'RTO manager assignments'],
        ['managedPartners', 'partner manager assignments'],
    ];

    const parts = labels
        .filter(([key]) => summary[key] > 0)
        .map(([key, label]) => `${summary[key]} ${label}`);

    return parts.length > 0
        ? `Reassign this staff member before deleting: ${parts.join(', ')}.`
        : 'Reassign this staff member before deleting.';
}

async function loadTargetProfile(staffId: string) {
    const supabaseAdmin = createAdminServerClient();

    const withStatus = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, role, account_status, is_deleted, deleted_at, deleted_by')
        .eq('id', staffId)
        .maybeSingle<TargetProfileRow>();

    if (!withStatus.error) {
        return {
            supabaseAdmin,
            targetProfile: withStatus.data,
        };
    }

    if (!withStatus.error.message?.includes('account_status')) {
        throw new Error(withStatus.error.message || 'Failed to load target profile');
    }

    const fallback = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, role, is_deleted, deleted_at, deleted_by')
        .eq('id', staffId)
        .maybeSingle<Omit<TargetProfileRow, 'account_status'> & { account_status?: never }>();

    if (fallback.error) {
        throw new Error(fallback.error.message || 'Failed to load target profile');
    }

    return {
        supabaseAdmin,
        targetProfile: fallback.data
            ? {
                ...fallback.data,
                account_status: 'active' as AccountStatus,
            }
            : null,
    };
}

async function countBlockingDependencies(staffId: string): Promise<StaffDeleteDependencySummary> {
    const supabaseAdmin = createAdminServerClient();

    const [
        adminApps,
        assessorApps,
        staffApps,
        workflowAssignments,
        managedRtos,
        managedPartners,
    ] = await Promise.all([
        supabaseAdmin
            .from('applications')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_admin_id', staffId)
            .or(NON_DELETED_PROFILE_FILTER),
        supabaseAdmin
            .from('applications')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_assessor_id', staffId)
            .or(NON_DELETED_PROFILE_FILTER),
        supabaseAdmin
            .from('applications')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_staff_id', staffId)
            .or(NON_DELETED_PROFILE_FILTER),
        supabaseAdmin
            .from('workflow_assignments')
            .select('id', { count: 'exact', head: true })
            .eq('assignee_id', staffId)
            .eq('is_active', true),
        supabaseAdmin
            .from('rtos')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_manager_id', staffId)
            .or(NON_DELETED_PROFILE_FILTER),
        supabaseAdmin
            .from('partners')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_manager_id', staffId)
            .or(NON_DELETED_PROFILE_FILTER),
    ]);

    return {
        assignedApplicationsAsAdmin: adminApps.count || 0,
        assignedApplicationsAsAssessor: assessorApps.count || 0,
        assignedApplicationsAsStaff: staffApps.count || 0,
        activeWorkflowAssignments: workflowAssignments.count || 0,
        managedRtos: managedRtos.count || 0,
        managedPartners: managedPartners.count || 0,
    };
}

async function countActiveProfilesForRole(role: UserRole): Promise<number> {
    const supabaseAdmin = createAdminServerClient();
    const { count } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', role)
        .eq('account_status', 'active')
        .or(NON_DELETED_PROFILE_FILTER);

    return count || 0;
}

async function syncAuthUserDeletionState(staffId: string, disabled: boolean) {
    const supabaseAdmin = createAdminServerClient();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(staffId, {
        ban_duration: disabled ? DISABLE_BAN_DURATION : 'none',
    });

    if (!error) {
        return;
    }

    const lowerMessage = error.message?.toLowerCase() || '';
    if (lowerMessage.includes('user not found') || lowerMessage.includes('not found')) {
        return;
    }

    throw error;
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'staff_account',
        action: 'manage_users',
        allowedRoles: ALLOWED_DELETE_ROLES,
        compatibilityPermissionKey: 'staff.manage',
    });

    if (!authz.ok) {
        return authz.response;
    }

    const { id: staffId } = await params;

    if (staffId === authz.context.userId) {
        return NextResponse.json(
            { error: 'You cannot delete your own staff account.' },
            { status: 400 }
        );
    }

    try {
        const { supabaseAdmin, targetProfile } = await loadTargetProfile(staffId);

        if (!targetProfile) {
            return NextResponse.json({ error: 'Staff profile not found.' }, { status: 404 });
        }

        if (targetProfile.is_deleted) {
            return NextResponse.json({ error: 'This staff profile is already deleted.' }, { status: 409 });
        }

        if (
            (targetProfile.role === 'ceo' || targetProfile.role === 'developer')
            && (targetProfile.account_status || 'active') === 'active'
            && await countActiveProfilesForRole(targetProfile.role) <= 1
        ) {
            return NextResponse.json(
                { error: `You cannot delete the last active ${targetProfile.role === 'ceo' ? 'CEO' : 'Developer'} account.` },
                { status: 409 }
            );
        }

        const dependencySummary = await countBlockingDependencies(staffId);
        if (hasBlockingDependencies(dependencySummary)) {
            return NextResponse.json(
                {
                    error: formatDependencyMessage(dependencySummary),
                    code: 'STAFF_DELETE_DEPENDENCIES',
                    dependencies: dependencySummary,
                },
                { status: 409 }
            );
        }

        const deletedAt = new Date().toISOString();
        const previousStatus = targetProfile.account_status || 'active';

        const { error: profileUpdateError } = await supabaseAdmin
            .from('profiles')
            .update({
                is_deleted: true,
                deleted_at: deletedAt,
                deleted_by: authz.context.userId,
                account_status: 'disabled',
            })
            .eq('id', staffId);

        if (profileUpdateError) {
            return NextResponse.json(
                { error: profileUpdateError.message || 'Failed to delete staff profile.' },
                { status: 500 }
            );
        }

        try {
            await syncAuthUserDeletionState(staffId, true);
        } catch (error) {
            await supabaseAdmin
                .from('profiles')
                .update({
                    is_deleted: false,
                    deleted_at: null,
                    deleted_by: null,
                    account_status: previousStatus,
                })
                .eq('id', staffId);

            return NextResponse.json(
                { error: error instanceof Error ? error.message : 'Failed to disable staff sign-in.' },
                { status: 500 }
            );
        }

        await supabaseAdmin
            .from('audit_logs')
            .insert({
                user_id: authz.context.userId,
                action: 'staff_delete',
                table_name: 'profiles',
                record_id: staffId,
                old_data: {
                    account_status: previousStatus,
                    is_deleted: targetProfile.is_deleted,
                },
                new_data: {
                    account_status: 'disabled',
                    is_deleted: true,
                    deleted_at: deletedAt,
                },
            });

        return NextResponse.json({
            message: 'Staff account deleted successfully.',
            data: {
                id: staffId,
                full_name: targetProfile.full_name,
                email: targetProfile.email,
                deleted_at: deletedAt,
            },
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete staff account.' },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'staff_account',
        action: 'manage_users',
        allowedRoles: ALLOWED_DELETE_ROLES,
        compatibilityPermissionKey: 'staff.manage',
    });

    if (!authz.ok) {
        return authz.response;
    }

    const { id: staffId } = await params;

    try {
        const { supabaseAdmin, targetProfile } = await loadTargetProfile(staffId);

        if (!targetProfile) {
            return NextResponse.json({ error: 'Staff profile not found.' }, { status: 404 });
        }

        if (!targetProfile.is_deleted) {
            return NextResponse.json({ error: 'This staff profile is not deleted.' }, { status: 409 });
        }

        const { error: restoreError } = await supabaseAdmin
            .from('profiles')
            .update({
                is_deleted: false,
                deleted_at: null,
                deleted_by: null,
                account_status: 'active',
            })
            .eq('id', staffId);

        if (restoreError) {
            return NextResponse.json(
                { error: restoreError.message || 'Failed to restore staff profile.' },
                { status: 500 }
            );
        }

        try {
            await syncAuthUserDeletionState(staffId, false);
        } catch (error) {
            await supabaseAdmin
                .from('profiles')
                .update({
                    is_deleted: true,
                    deleted_at: targetProfile.deleted_at || new Date().toISOString(),
                    deleted_by: targetProfile.deleted_by || authz.context.userId,
                    account_status: 'disabled',
                })
                .eq('id', staffId);

            return NextResponse.json(
                { error: error instanceof Error ? error.message : 'Failed to reactivate staff sign-in.' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: 'Staff account restored successfully.',
            data: {
                id: staffId,
                account_status: 'active',
            },
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to restore staff account.' },
            { status: 500 }
        );
    }
}

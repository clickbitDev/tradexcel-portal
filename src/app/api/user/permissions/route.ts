import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getPolicyDocumentForRole, POLICY_VERSION } from '@/lib/access-control/policies';
import { getDefaultActionPermissionsForRole } from '@/lib/access-control/action-permissions';
import { LEGACY_TO_POLICY_STAGE } from '@/lib/access-control/stages';

/**
 * GET /api/user/permissions
 * Fetch current user's role permissions
 */
export async function GET() {
    try {
        const supabase = await createServerClient();

        // Get the current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's profile to determine role
        const { data: profileWithStatus, error: profileWithStatusError } = await supabase
            .from('profiles')
            .select('role, account_status')
            .eq('id', user.id)
            .single();

        const profile = profileWithStatusError && profileWithStatusError.message?.includes('account_status')
            ? await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()
            : { data: profileWithStatus, error: profileWithStatusError };

        if (!profile.data) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        const accountStatus = 'account_status' in profile.data
            ? profile.data.account_status
            : 'active';

        if ((accountStatus || 'active') === 'disabled') {
            return NextResponse.json({ error: 'Account disabled' }, { status: 403 });
        }

        const role = profile.data.role;
        const policyDocument = getPolicyDocumentForRole(role);
        const defaultPermissions = getDefaultActionPermissionsForRole(role);

        // CEO and developer always have all permissions
        if (role === 'ceo' || role === 'developer') {
            return NextResponse.json({
                role,
                permissions: defaultPermissions,
                isAdmin: true,
                policyVersion: POLICY_VERSION,
                policy: policyDocument,
                stageMapping: LEGACY_TO_POLICY_STAGE,
            });
        }

        const permissionMap: Record<string, boolean> = {
            ...defaultPermissions,
        };

        // Fetch permissions from database for this role
        const { data: permissions, error } = await supabase
            .from('role_permissions')
            .select('permission_key, granted')
            .eq('role', role);

        if (error) {
            console.warn('Falling back to default permissions for role:', {
                role,
                reason: error.message,
            });
        } else {
            permissions?.forEach((permission) => {
                permissionMap[permission.permission_key] = permission.granted;
            });
        }

        // Determine admin status
        const adminRoles = ['ceo', 'developer', 'admin', 'executive_manager'];
        const isAdmin = adminRoles.includes(role);

        return NextResponse.json({
            role,
            permissions: permissionMap,
            isAdmin,
            policyVersion: POLICY_VERSION,
            policy: policyDocument,
            stageMapping: LEGACY_TO_POLICY_STAGE,
        });
    } catch (error) {
        console.error('Error in GET /api/user/permissions:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

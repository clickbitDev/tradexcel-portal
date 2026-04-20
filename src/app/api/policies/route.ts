import { NextResponse } from 'next/server';
import {
    getPolicyDocumentForRole,
    POLICY_VERSION,
} from '@/lib/access-control/policies';
import { getDefaultActionPermissionsForRole } from '@/lib/access-control/action-permissions';
import { getAuthenticatedUserContext } from '@/lib/access-control/server';
import { LEGACY_TO_POLICY_STAGE } from '@/lib/access-control/stages';

/**
 * GET /api/policies
 * Returns the authenticated user's policy document.
 *
 * This endpoint keeps legacy workflow stages intact and ships an explicit
 * stage mapping so UI and API layers can enforce policy stages without a
 * breaking database enum migration.
 */
export async function GET() {
    const auth = await getAuthenticatedUserContext();
    if (!auth.ok) {
        return auth.response;
    }

    const { role, supabase } = auth.context;
    const policyDocument = getPolicyDocumentForRole(role);
    const compatibilityPermissions = getDefaultActionPermissionsForRole(role);

    const { data: compatibilityRows, error: compatibilityError } = await supabase
        .from('role_permissions')
        .select('permission_key, granted')
        .eq('role', role);

    if (compatibilityError) {
        console.warn('Using default compatibility permissions:', {
            role,
            reason: compatibilityError.message,
        });
    }

    for (const row of compatibilityRows || []) {
        compatibilityPermissions[row.permission_key] = row.granted;
    }

    return NextResponse.json({
        version: POLICY_VERSION,
        role,
        userId: auth.context.userId,
        policy: policyDocument,
        stageMapping: LEGACY_TO_POLICY_STAGE,
        compatibilityPermissions,
    });
}

import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import {
    getAllRolePermissions,
    saveAllRolePermissions,
    getAllHiddenFields,
    setHiddenFields,
    AllRolePermissions,
} from '@/lib/services/permission-service';
import { UserRole } from '@/types/database';

/**
 * GET /api/admin/permissions
 * Fetch all role permissions
 */
export async function GET() {
    try {
        const authz = await authorizeApiRequest({
            resource: 'role_permission',
            action: 'manage_roles',
        });
        if (!authz.ok) {
            return authz.response;
        }

        const permissions = await getAllRolePermissions();
        const hiddenFields = await getAllHiddenFields();

        return NextResponse.json({
            permissions,
            hiddenFields,
        });
    } catch (error) {
        console.error('Error in GET /api/admin/permissions:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/admin/permissions
 * Save all role permissions
 */
export async function PUT(request: NextRequest) {
    try {
        const authz = await authorizeApiRequest({
            request,
            resource: 'role_permission',
            action: 'manage_roles',
            allowedRoles: ['ceo', 'developer'],
        });
        if (!authz.ok) {
            return authz.response;
        }

        const body = await request.json();
        const { permissions, hiddenFields } = body as {
            permissions: AllRolePermissions;
            hiddenFields?: { role: UserRole; context: string; fieldNames: string[] }[];
        };

        // Save permissions
        const permResult = await saveAllRolePermissions(permissions);
        if (!permResult.success) {
            return NextResponse.json(
                { error: permResult.error },
                { status: 500 }
            );
        }

        // Save hidden fields if provided
        if (hiddenFields && Array.isArray(hiddenFields)) {
            for (const hf of hiddenFields) {
                const hfResult = await setHiddenFields(hf.role, hf.context, hf.fieldNames);
                if (!hfResult.success) {
                    console.error('Error saving hidden fields for', hf.role, hfResult.error);
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in PUT /api/admin/permissions:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

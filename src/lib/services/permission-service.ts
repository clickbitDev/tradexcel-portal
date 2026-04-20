import { createServerClient } from '@/lib/supabase/server';
import { UserRole } from '@/types/database';
import {
    cloneDefaultRoleActionPermissions,
    getDefaultActionPermissionsForRole,
} from '@/lib/access-control/action-permissions';

/**
 * Permission Service
 * Handles fetching and saving role permissions from the database
 */

export interface RolePermission {
    role: UserRole;
    permission_key: string;
    granted: boolean;
}

export interface RolePermissionsMap {
    [permissionKey: string]: boolean;
}

export interface AllRolePermissions {
    [role: string]: RolePermissionsMap;
}

export interface HiddenField {
    role: UserRole;
    field_name: string;
    context: string;
}

/**
 * Get all permissions for a specific role
 */
export async function getRolePermissions(role: UserRole): Promise<RolePermissionsMap> {
    const supabase = await createServerClient();
    const fallbackPermissions = getDefaultActionPermissionsForRole(role);

    const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_key, granted')
        .eq('role', role);

    if (error) {
        console.warn('Using default role permissions:', {
            role,
            reason: error.message,
        });
        return fallbackPermissions;
    }

    const permissionsMap: RolePermissionsMap = {
        ...fallbackPermissions,
    };
    data?.forEach((item) => {
        permissionsMap[item.permission_key] = item.granted;
    });

    return permissionsMap;
}

/**
 * Get all permissions for all roles (for admin settings page)
 */
export async function getAllRolePermissions(): Promise<AllRolePermissions> {
    const supabase = await createServerClient();
    const allPermissions: AllRolePermissions = cloneDefaultRoleActionPermissions();

    const { data, error } = await supabase
        .from('role_permissions')
        .select('role, permission_key, granted');

    if (error) {
        console.warn('Using default permissions for all roles:', error.message);
        return allPermissions;
    }

    data?.forEach((item) => {
        if (!allPermissions[item.role]) {
            allPermissions[item.role] = {};
        }
        allPermissions[item.role][item.permission_key] = item.granted;
    });

    return allPermissions;
}

/**
 * Save permissions for a specific role
 */
export async function saveRolePermissions(
    role: UserRole,
    permissions: RolePermissionsMap
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerClient();

    // Upsert each permission
    const upsertData = Object.entries(permissions).map(([key, granted]) => ({
        role,
        permission_key: key,
        granted,
    }));

    const { error } = await supabase
        .from('role_permissions')
        .upsert(upsertData, {
            onConflict: 'role,permission_key',
        });

    if (error) {
        console.error('Error saving role permissions:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Save permissions for all roles at once (batch update)
 */
export async function saveAllRolePermissions(
    allPermissions: AllRolePermissions
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerClient();

    // Flatten all permissions into upsert-ready format
    const upsertData: { role: UserRole; permission_key: string; granted: boolean }[] = [];

    for (const [role, permissions] of Object.entries(allPermissions)) {
        for (const [key, granted] of Object.entries(permissions)) {
            upsertData.push({
                role: role as UserRole,
                permission_key: key,
                granted,
            });
        }
    }

    const { error } = await supabase
        .from('role_permissions')
        .upsert(upsertData, {
            onConflict: 'role,permission_key',
        });

    if (error) {
        console.error('Error saving all role permissions:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Check if a role has a specific permission
 */
export async function hasPermission(role: UserRole, permissionKey: string): Promise<boolean> {
    const supabase = await createServerClient();
    const defaultGranted = getDefaultActionPermissionsForRole(role)[permissionKey] === true;

    const { data, error } = await supabase
        .from('role_permissions')
        .select('granted')
        .eq('role', role)
        .eq('permission_key', permissionKey)
        .single();

    if (error || !data) {
        return defaultGranted;
    }

    return data.granted;
}

/**
 * Get all hidden fields for a role in a specific context
 */
export async function getHiddenFields(
    role: UserRole,
    context: string = 'application'
): Promise<string[]> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from('role_hidden_fields')
        .select('field_name')
        .eq('role', role)
        .eq('context', context);

    if (error) {
        console.error('Error fetching hidden fields:', error);
        return [];
    }

    return data?.map((item) => item.field_name) ?? [];
}

/**
 * Get all hidden fields configuration for all roles
 */
export async function getAllHiddenFields(): Promise<HiddenField[]> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from('role_hidden_fields')
        .select('role, field_name, context');

    if (error) {
        console.error('Error fetching all hidden fields:', error);
        return [];
    }

    return data ?? [];
}

/**
 * Set hidden fields for a role
 */
export async function setHiddenFields(
    role: UserRole,
    context: string,
    fieldNames: string[]
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerClient();

    // First, delete existing hidden fields for this role+context
    const { error: deleteError } = await supabase
        .from('role_hidden_fields')
        .delete()
        .eq('role', role)
        .eq('context', context);

    if (deleteError) {
        console.error('Error deleting hidden fields:', deleteError);
        return { success: false, error: deleteError.message };
    }

    // If no fields to add, we're done
    if (fieldNames.length === 0) {
        return { success: true };
    }

    // Insert new hidden fields
    const insertData = fieldNames.map((fieldName) => ({
        role,
        field_name: fieldName,
        context,
    }));

    const { error: insertError } = await supabase
        .from('role_hidden_fields')
        .insert(insertData);

    if (insertError) {
        console.error('Error inserting hidden fields:', insertError);
        return { success: false, error: insertError.message };
    }

    return { success: true };
}

/**
 * Check if a field should be hidden for a role
 */
export async function isFieldHidden(
    role: UserRole,
    fieldName: string,
    context: string = 'application'
): Promise<boolean> {
    const hiddenFields = await getHiddenFields(role, context);
    return hiddenFields.includes(fieldName);
}

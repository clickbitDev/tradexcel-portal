import type { UserRole } from '@/types/database';

export const ACTION_PERMISSION_KEYS = [
    'applications.view',
    'applications.create',
    'applications.edit',
    'applications.delete',
    'applications.change_stage',
    'applications.assign',
    'applications.export',
    'certificates.view',
    'certificates.manage',
    'documents.view',
    'documents.upload',
    'documents.verify',
    'documents.delete',
    'rtos.view',
    'rtos.manage',
    'qualifications.view',
    'qualifications.manage',
    'partners.view',
    'partners.manage',
    'partners.view_kpi',
    'tickets.view',
    'tickets.create',
    'tickets.manage',
    'staff.view',
    'staff.manage',
    'roles.manage',
    'audit.view',
    'templates.manage',
    'settings.manage',
] as const;

export type ActionPermissionKey = (typeof ACTION_PERMISSION_KEYS)[number];
export type RoleActionPermissions = Record<ActionPermissionKey, boolean>;

function permissionMap(enabled: ActionPermissionKey[]): RoleActionPermissions {
    const map = Object.fromEntries(
        ACTION_PERMISSION_KEYS.map((permission) => [permission, false])
    ) as RoleActionPermissions;

    for (const permission of enabled) {
        map[permission] = true;
    }

    return map;
}

const ALL_PERMISSIONS: ActionPermissionKey[] = [...ACTION_PERMISSION_KEYS];

export const DEFAULT_ROLE_ACTION_PERMISSIONS: Record<UserRole, RoleActionPermissions> = {
    ceo: permissionMap(ALL_PERMISSIONS),
    developer: permissionMap(ALL_PERMISSIONS),
    executive_manager: permissionMap([
        'applications.view',
        'applications.create',
        'applications.edit',
        'applications.change_stage',
        'applications.assign',
        'applications.export',
        'certificates.view',
        'certificates.manage',
        'documents.view',
        'documents.upload',
        'documents.verify',
        'rtos.view',
        'rtos.manage',
        'qualifications.view',
        'qualifications.manage',
        'partners.view',
        'partners.manage',
        'partners.view_kpi',
        'tickets.view',
        'tickets.create',
        'tickets.manage',
        'staff.view',
        'audit.view',
        'templates.manage',
    ]),
    admin: permissionMap([
        'applications.view',
        'applications.create',
        'applications.edit',
        'applications.change_stage',
        'applications.assign',
        'applications.export',
        'certificates.view',
        'certificates.manage',
        'documents.view',
        'documents.upload',
        'documents.verify',
        'rtos.view',
        'rtos.manage',
        'qualifications.view',
        'qualifications.manage',
        'partners.view',
        'partners.manage',
        'partners.view_kpi',
        'tickets.view',
        'tickets.create',
        'tickets.manage',
        'staff.view',
        'audit.view',
    ]),
    accounts_manager: permissionMap([
        'applications.view',
        'applications.create',
        'applications.edit',
        'applications.change_stage',
        'applications.export',
        'documents.view',
        'documents.upload',
        'rtos.view',
        'qualifications.view',
        'partners.view',
        'partners.view_kpi',
        'tickets.view',
        'tickets.create',
    ]),
    assessor: permissionMap([
        'applications.view',
        'applications.edit',
        'applications.change_stage',
        'documents.view',
        'documents.upload',
        'tickets.view',
        'tickets.create',
    ]),
    dispatch_coordinator: permissionMap([
        'applications.view',
        'applications.create',
        'applications.edit',
        'applications.change_stage',
        'certificates.view',
        'certificates.manage',
        'documents.view',
        'documents.upload',
        'rtos.view',
        'qualifications.view',
        'partners.view',
        'tickets.view',
        'tickets.create',
    ]),
    frontdesk: permissionMap([
        'applications.view',
        'applications.create',
        'applications.edit',
        'applications.change_stage',
        'documents.view',
        'documents.upload',
        'rtos.view',
        'qualifications.view',
        'partners.view',
        'tickets.view',
        'tickets.create',
    ]),
    agent: permissionMap([
        'applications.view',
        'applications.create',
        'documents.view',
        'documents.upload',
        'rtos.view',
        'qualifications.view',
        'tickets.view',
        'tickets.create',
    ]),
};

export function getDefaultActionPermissionsForRole(role: UserRole): Record<string, boolean> {
    return { ...DEFAULT_ROLE_ACTION_PERMISSIONS[role] };
}

export function cloneDefaultRoleActionPermissions(): Record<UserRole, Record<string, boolean>> {
    const clone = {} as Record<UserRole, Record<string, boolean>>;

    for (const role of Object.keys(DEFAULT_ROLE_ACTION_PERMISSIONS) as UserRole[]) {
        clone[role] = { ...DEFAULT_ROLE_ACTION_PERMISSIONS[role] };
    }

    return clone;
}

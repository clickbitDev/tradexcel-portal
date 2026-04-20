import { UserRole } from '@/types/database';

/**
 * Field-level permission configuration
 * Defines which roles can view/edit specific sensitive fields
 */

type PermissionLevel = 'view' | 'edit' | 'none';

interface FieldPermission {
    view: UserRole[];
    edit: UserRole[];
}

// Staff roles (everyone except agent)
const STAFF_ROLES: UserRole[] = ['ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer'];
const ADMIN_ROLES: UserRole[] = ['ceo', 'developer'];
const MANAGER_ROLES: UserRole[] = ['ceo', 'executive_manager', 'developer', 'admin'];
const ALL_ROLES: UserRole[] = [...STAFF_ROLES, 'agent'];

// Define sensitive fields and their access levels
const FIELD_PERMISSIONS: Record<string, FieldPermission> = {
    // Student PII - highly sensitive
    'student_passport_number': {
        view: STAFF_ROLES,
        edit: MANAGER_ROLES,
    },
    'student_dob': {
        view: STAFF_ROLES,
        edit: STAFF_ROLES,
    },
    'student_phone': {
        view: ALL_ROLES,
        edit: ALL_ROLES,
    },
    'student_email': {
        view: ALL_ROLES,
        edit: ALL_ROLES,
    },
    'student_nationality': {
        view: ALL_ROLES,
        edit: STAFF_ROLES,
    },

    // Financial data
    'commission_rate': {
        view: MANAGER_ROLES,
        edit: ADMIN_ROLES,
    },
    'quoted_tuition': {
        view: STAFF_ROLES,
        edit: MANAGER_ROLES,
    },
    'total_paid': {
        view: STAFF_ROLES,
        edit: ADMIN_ROLES,
    },
    'tuition_fee_onshore': {
        view: STAFF_ROLES,
        edit: MANAGER_ROLES,
    },
    'tuition_fee_miscellaneous': {
        view: STAFF_ROLES,
        edit: MANAGER_ROLES,
    },

    // Partner sensitive fields
    'kpi_ontime_rate': {
        view: MANAGER_ROLES,
        edit: ADMIN_ROLES,
    },
    'kpi_conversion_rate': {
        view: MANAGER_ROLES,
        edit: ADMIN_ROLES,
    },

    // Workflow control
    'workflow_stage': {
        view: ALL_ROLES,
        edit: STAFF_ROLES,
    },
    'assigned_staff_id': {
        view: STAFF_ROLES,
        edit: MANAGER_ROLES,
    },

    // System fields
    'locked_by': {
        view: STAFF_ROLES,
        edit: ADMIN_ROLES,
    },
};

/**
 * Check if a role can view a specific field
 */
export function canViewField(field: string, role: UserRole): boolean {
    const permission = FIELD_PERMISSIONS[field];
    if (!permission) return true; // Default: allow if not configured
    return permission.view.includes(role);
}

/**
 * Check if a role can edit a specific field
 */
export function canEditField(field: string, role: UserRole): boolean {
    const permission = FIELD_PERMISSIONS[field];
    if (!permission) return true; // Default: allow if not configured
    return permission.edit.includes(role);
}

/**
 * Get the permission level for a field
 */
export function getFieldPermission(field: string, role: UserRole): PermissionLevel {
    if (canEditField(field, role)) return 'edit';
    if (canViewField(field, role)) return 'view';
    return 'none';
}

/**
 * Mask sensitive data based on role permissions
 */
export function maskSensitiveData<T extends Record<string, unknown>>(
    data: T,
    role: UserRole
): T {
    // Create mutable copy with explicit Record type
    const masked: Record<string, unknown> = { ...data };

    for (const field of Object.keys(FIELD_PERMISSIONS)) {
        if (field in masked && !canViewField(field, role)) {
            // Mask the value based on type
            const value = masked[field];
            if (typeof value === 'string') {
                masked[field] = '••••••••';
            } else if (typeof value === 'number') {
                masked[field] = 0;
            } else {
                masked[field] = null;
            }
        }
    }

    return masked as T;
}

/**
 * Get all fields that require permission checks
 */
export function getRestrictedFields(): string[] {
    return Object.keys(FIELD_PERMISSIONS);
}

/**
 * Check if user has admin role
 */
export function isAdmin(role: UserRole): boolean {
    return ADMIN_ROLES.includes(role);
}

/**
 * Check if user has manager or higher role
 */
export function isManagerOrAbove(role: UserRole): boolean {
    return MANAGER_ROLES.includes(role);
}

/**
 * Check if user has staff or higher role
 */
export function isStaffOrAbove(role: UserRole): boolean {
    return STAFF_ROLES.includes(role);
}

/**
 * Check if user is an assessor
 */
export function isAssessor(role: UserRole): boolean {
    return role === 'assessor';
}

/**
 * Check if user is an agent
 */
export function isAgent(role: UserRole): boolean {
    return role === 'agent';
}

// ===========================================
// Hidden Fields Support (Client-side cache)
// ===========================================

// In-memory cache for hidden fields (refreshed per session)
let hiddenFieldsCache: Map<string, string[]> = new Map();

/**
 * Set hidden fields for a role+context (called from usePermissions hook after fetching)
 */
export function setHiddenFieldsCache(role: UserRole, context: string, fields: string[]): void {
    const key = `${role}:${context}`;
    hiddenFieldsCache.set(key, fields);
}

/**
 * Get hidden fields from cache for a role+context
 */
export function getHiddenFieldsFromCache(role: UserRole, context: string): string[] {
    const key = `${role}:${context}`;
    return hiddenFieldsCache.get(key) ?? [];
}

/**
 * Check if a field should be completely hidden for a role
 * This is different from masking - hidden fields are not rendered at all
 */
export function isFieldHidden(field: string, role: UserRole, context: string = 'application'): boolean {
    const hiddenFields = getHiddenFieldsFromCache(role, context);
    return hiddenFields.includes(field);
}

/**
 * Clear the hidden fields cache (e.g., on logout or permission refresh)
 */
export function clearHiddenFieldsCache(): void {
    hiddenFieldsCache = new Map();
}

export { FIELD_PERMISSIONS };
export type { FieldPermission, PermissionLevel };

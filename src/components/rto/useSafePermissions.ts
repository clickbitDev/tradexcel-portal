/**
 * Safe wrapper around usePermissions hook
 * 
 * Catches any errors during permission initialization and returns safe defaults
 * to prevent component crashes. This ensures the RTOs page always renders,
 * even if permission checks fail.
 */

'use client';

import { usePermissions, type ActionPermission } from '@/hooks/usePermissions';
import { UserRole } from '@/types/database';

interface SafePermissionsReturn {
    role: UserRole | null;
    loading: boolean;
    can: (permission: ActionPermission) => boolean;
    actionPermissions: Record<string, boolean>;
    canView: (field: string) => boolean;
    canEdit: (field: string) => boolean;
    getPermission: (field: string) => 'view' | 'edit' | 'none';
    maskData: <T extends Record<string, unknown>>(data: T) => T;
    isHidden: (field: string, context?: string) => boolean;
    hiddenFields: string[];
    isAdmin: boolean;
    isManagerOrAbove: boolean;
    isStaffOrAbove: boolean;
    isAssessor: boolean;
    isAgent: boolean;
    error: Error | null;
}

/**
 * Safe wrapper for usePermissions that never throws errors
 * Returns safe defaults if the hook fails to initialize
 */
export function useSafePermissions(): SafePermissionsReturn {
    try {
        const permissions = usePermissions();
        
        // Wrap the can function to ensure it never throws
        const safeCan = (permission: ActionPermission): boolean => {
            try {
                return permissions.can(permission);
            } catch {
                return false;
            }
        };

        // Wrap other functions that might throw
        const safeCanView = (field: string): boolean => {
            try {
                return permissions.canView(field);
            } catch {
                return false;
            }
        };

        const safeCanEdit = (field: string): boolean => {
            try {
                return permissions.canEdit(field);
            } catch {
                return false;
            }
        };

        const safeGetPermission = (field: string): 'view' | 'edit' | 'none' => {
            try {
                return permissions.getPermission(field);
            } catch {
                return 'none';
            }
        };

        const safeMaskData = <T extends Record<string, unknown>>(data: T): T => {
            try {
                return permissions.maskData(data);
            } catch {
                return data;
            }
        };

        const safeIsHidden = (field: string, context?: string): boolean => {
            try {
                return permissions.isHidden(field, context);
            } catch {
                return false;
            }
        };

        return {
            ...permissions,
            can: safeCan,
            canView: safeCanView,
            canEdit: safeCanEdit,
            getPermission: safeGetPermission,
            maskData: safeMaskData,
            isHidden: safeIsHidden,
            error: null,
        };
    } catch (error) {
        // If usePermissions throws during initialization, return safe defaults
        console.error('Error initializing permissions, using safe defaults:', error);
        
        const safeCan = () => false;
        const safeCanView = () => false;
        const safeCanEdit = () => false;
        const safeGetPermission = () => 'none' as const;
        const safeMaskData = <T extends Record<string, unknown>>(data: T): T => data;
        const safeIsHidden = () => false;

        return {
            role: null,
            loading: false,
            can: safeCan,
            actionPermissions: {},
            canView: safeCanView,
            canEdit: safeCanEdit,
            getPermission: safeGetPermission,
            maskData: safeMaskData,
            isHidden: safeIsHidden,
            hiddenFields: [],
            isAdmin: false,
            isManagerOrAbove: false,
            isStaffOrAbove: false,
            isAssessor: false,
            isAgent: false,
            error: error instanceof Error ? error : new Error('Unknown error'),
        };
    }
}

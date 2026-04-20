'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserRole } from '@/types/database';
import type { ActionPermissionKey } from '@/lib/access-control/action-permissions';
import {
    canViewField,
    canEditField,
    getFieldPermission,
    maskSensitiveData,
    isAdmin,
    isManagerOrAbove,
    isStaffOrAbove,
    isFieldHidden,
    setHiddenFieldsCache,
    isAssessor as checkIsAssessor,
    isAgent as checkIsAgent,
} from '@/lib/permissions';

// Action permission keys (matches the roles settings page)
export type ActionPermission = ActionPermissionKey;

interface UsePermissionsReturn {
    role: UserRole | null;
    loading: boolean;
    // Action permissions (from database)
    can: (permission: ActionPermission) => boolean;
    actionPermissions: Record<string, boolean>;
    // Field-level permissions (from config)
    canView: (field: string) => boolean;
    canEdit: (field: string) => boolean;
    getPermission: (field: string) => 'view' | 'edit' | 'none';
    maskData: <T extends Record<string, unknown>>(data: T) => T;
    isHidden: (field: string, context?: string) => boolean;
    hiddenFields: string[];
    // Role checks
    isAdmin: boolean;
    isManagerOrAbove: boolean;
    isStaffOrAbove: boolean;
    isAssessor: boolean;
    isAgent: boolean;
}

/**
 * React hook for checking permissions
 * - Action permissions: fetched from database (configured in Settings > Roles)
 * - Field permissions: from static config
 * - Hidden fields: fetched from database
 */
export function usePermissions(): UsePermissionsReturn {
    const [role, setRole] = useState<UserRole | null>(null);
    const [loading, setLoading] = useState(true);
    const [hiddenFields, setHiddenFields] = useState<string[]>([]);
    const [actionPermissions, setActionPermissions] = useState<Record<string, boolean>>({});
    const supabase = useMemo(() => {
        try {
            return createClient();
        } catch (err) {
            console.error('Error creating Supabase client:', err);
            return null;
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        const fetchPermissions = async () => {
            try {
                if (!supabase) {
                    if (mounted) setLoading(false);
                    return;
                }

                let user;
                try {
                    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
                    if (authError || !mounted) {
                        if (authError) console.debug('usePermissions: Auth error:', authError.message);
                        if (mounted) {
                            setRole(null);
                            setLoading(false);
                        }
                        return;
                    }
                    user = authUser;
                } catch (err) {
                    // Handle AbortError silently - expected during navigation
                    console.debug('usePermissions: getUser error:', err);
                    if (mounted) {
                        setRole(null);
                        setLoading(false);
                    }
                    return;
                }

                if (!user || !mounted) {
                    if (mounted) {
                        setRole(null);
                        setLoading(false);
                    }
                    return;
                }

                // Fetch action permissions from API
                try {
                    const response = await fetch('/api/user/permissions');
                    if (!mounted) return;

                    if (response.ok) {
                        const data = await response.json();
                        if (mounted) {
                            setRole(data.role);
                            setActionPermissions(data.permissions || {});
                        }
                    } else {
                        // Fallback: fetch role from profile
                        try {
                            const { data: profile, error: profileError } = await supabase
                                .from('profiles')
                                .select('role')
                                .eq('id', user.id)
                                .single();
                            if (!mounted) return;
                            if (profileError) {
                                console.debug('usePermissions: Profile error:', profileError.message);
                            }
                            if (mounted) setRole((profile?.role as UserRole) ?? null);
                        } catch (err) {
                            console.debug('usePermissions: Profile fallback error:', err);
                        }
                    }
                } catch (err) {
                    if (!mounted) return;
                    console.debug('usePermissions: Permissions fetch error:', err);
                    // Fallback: fetch role from profile
                    try {
                        const { data: profile, error: profileError } = await supabase
                            .from('profiles')
                            .select('role')
                            .eq('id', user.id)
                            .single();
                        if (!mounted) return;
                        if (profileError) {
                            console.debug('usePermissions: Profile error:', profileError.message);
                        }
                        if (mounted) setRole((profile?.role as UserRole) ?? null);
                    } catch (fallbackErr) {
                        console.debug('usePermissions: Profile fallback error:', fallbackErr);
                    }
                }

                // Fetch hidden fields for this role if available
                if (!mounted) return;
                try {
                    const { data: profile, error: profileError } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', user.id)
                        .single();

                    if (!mounted) return;
                    if (profileError) {
                        console.debug('usePermissions: Hidden fields profile error:', profileError.message);
                    } else {
                        const userRole = (profile?.role as UserRole) ?? null;

                        if (userRole && mounted) {
                            try {
                                const { data: hiddenFieldsData, error: hiddenFieldsError } = await supabase
                                    .from('role_hidden_fields')
                                    .select('field_name, context')
                                    .eq('role', userRole);

                                if (!mounted) return;
                                if (hiddenFieldsError) {
                                    console.debug('usePermissions: Hidden fields error:', hiddenFieldsError.message);
                                } else if (hiddenFieldsData && hiddenFieldsData.length > 0) {
                                    // Group by context and cache
                                    const byContext: Record<string, string[]> = {};
                                    hiddenFieldsData.forEach((item) => {
                                        if (!byContext[item.context]) {
                                            byContext[item.context] = [];
                                        }
                                        byContext[item.context].push(item.field_name);
                                    });

                                    // Cache for each context
                                    Object.entries(byContext).forEach(([context, fields]) => {
                                        setHiddenFieldsCache(userRole, context, fields);
                                    });

                                    // Set default context hidden fields for state
                                    if (mounted) setHiddenFields(byContext['application'] ?? []);
                                }
                            } catch (err) {
                                console.debug('usePermissions: Hidden fields fetch error:', err);
                            }
                        }
                    }
                } catch (err) {
                    console.debug('usePermissions: Hidden fields outer error:', err);
                }

                if (mounted) setLoading(false);
            } catch (err) {
                console.debug('usePermissions: Unexpected error:', err);
                if (mounted) {
                    setRole(null);
                    setLoading(false);
                }
            }
        };

        fetchPermissions();

        return () => {
            mounted = false;
        };
    }, [supabase]);

    // Check if user has a specific action permission
    const can = useCallback((permission: ActionPermission): boolean => {
        try {
            if (!role) return false;
            // CEO and developer always have all permissions
            if (role === 'ceo' || role === 'developer') return true;
            return actionPermissions[permission] === true;
        } catch {
            return false; // Safe fallback
        }
    }, [role, actionPermissions]);

    const canView = useCallback((field: string) => {
        if (!role) return false;
        return canViewField(field, role);
    }, [role]);

    const canEdit = useCallback((field: string) => {
        if (!role) return false;
        return canEditField(field, role);
    }, [role]);

    const getPermission = useCallback((field: string) => {
        if (!role) return 'none' as const;
        return getFieldPermission(field, role);
    }, [role]);

    const maskData = useCallback(<T extends Record<string, unknown>>(data: T): T => {
        if (!role) return data;
        return maskSensitiveData(data, role);
    }, [role]);

    const isHidden = useCallback((field: string, context: string = 'application') => {
        if (!role) return false;
        return isFieldHidden(field, role, context);
    }, [role]);

    return {
        role,
        loading,
        can,
        actionPermissions,
        canView,
        canEdit,
        getPermission,
        maskData,
        isHidden,
        hiddenFields,
        isAdmin: role ? isAdmin(role) : false,
        isManagerOrAbove: role ? isManagerOrAbove(role) : false,
        isStaffOrAbove: role ? isStaffOrAbove(role) : false,
        isAssessor: role ? checkIsAssessor(role) : false,
        isAgent: role ? checkIsAgent(role) : false,
    };
}

export default usePermissions;

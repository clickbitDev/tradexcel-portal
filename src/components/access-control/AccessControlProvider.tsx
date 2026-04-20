'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { createContextualCan } from '@casl/react';
import { usePathname } from 'next/navigation';
import {
    createEmptyAbility,
    defineAbilityForPolicy,
    type AppAbility,
} from '@/lib/access-control/casl';
import type { RolePolicyDocument } from '@/lib/access-control/types';

interface PoliciesApiResponse {
    role: string;
    userId: string;
    policy: RolePolicyDocument;
}

interface AccessControlState {
    ability: AppAbility;
    role: string | null;
    loading: boolean;
    refreshPolicies: () => Promise<void>;
}

const EMPTY_ABILITY = createEmptyAbility();

const AbilityContext = createContext<AppAbility>(EMPTY_ABILITY);

const AccessControlStateContext = createContext<AccessControlState>({
    ability: EMPTY_ABILITY,
    role: null,
    loading: true,
    refreshPolicies: async () => {
        return;
    },
});

export const Can = createContextualCan(AbilityContext.Consumer);

const POLICY_ROUTE_PREFIXES = ['/portal', '/frontdesk', '/agent', '/assessor'] as const;

function shouldLoadPoliciesForPath(pathname: string): boolean {
    return POLICY_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function AccessControlProvider({ children }: { children: ReactNode }) {
    const [ability, setAbility] = useState<AppAbility>(EMPTY_ABILITY);
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const pathname = usePathname();
    const shouldLoadPolicies = shouldLoadPoliciesForPath(pathname);

    const refreshPolicies = useCallback(async () => {
        try {
            setLoading(true);

            const response = await fetch('/api/policies', {
                method: 'GET',
                cache: 'no-store',
            });

            if (!response.ok) {
                setRole(null);
                setAbility(createEmptyAbility());
                return;
            }

            const payload = await response.json() as Partial<PoliciesApiResponse>;

            if (!payload.policy || !payload.userId || !payload.role) {
                setRole(null);
                setAbility(createEmptyAbility());
                return;
            }

            setRole(payload.role);
            setAbility(defineAbilityForPolicy(payload.policy, payload.userId));
        } catch {
            setRole(null);
            setAbility(createEmptyAbility());
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!shouldLoadPolicies) {
            setRole(null);
            setAbility(createEmptyAbility());
            setLoading(false);
            return;
        }

        void refreshPolicies();
    }, [refreshPolicies, shouldLoadPolicies]);

    const state = useMemo<AccessControlState>(() => ({
        ability,
        role,
        loading,
        refreshPolicies,
    }), [ability, role, loading, refreshPolicies]);

    return (
        <AccessControlStateContext.Provider value={state}>
            <AbilityContext.Provider value={ability}>
                {children}
            </AbilityContext.Provider>
        </AccessControlStateContext.Provider>
    );
}

export function useAbility(): AppAbility {
    return useContext(AbilityContext);
}

export function useAccessControl(): AccessControlState {
    return useContext(AccessControlStateContext);
}

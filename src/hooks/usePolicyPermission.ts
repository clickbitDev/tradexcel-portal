'use client';

import { useCallback } from 'react';
import {
    useAbility,
    useAccessControl,
} from '@/components/access-control/AccessControlProvider';
import type { PolicyAction } from '@/lib/access-control/types';
import type { PolicySubject } from '@/lib/access-control/casl';

type SubjectPayload = Record<string, unknown>;

function withSubjectType(subject: PolicySubject, payload?: SubjectPayload): SubjectPayload {
    return {
        ...(payload || {}),
        __caslSubjectType__: subject,
    };
}

export function usePolicyPermission() {
    const ability = useAbility();
    const { loading, role, refreshPolicies } = useAccessControl();

    const can = useCallback(
        (action: PolicyAction, subject: PolicySubject, payload?: SubjectPayload): boolean => {
            const abilityWithSubjectPayload = ability as unknown as {
                can: (nextAction: PolicyAction, nextSubject: unknown) => boolean;
            };

            if (payload) {
                return abilityWithSubjectPayload.can(action, withSubjectType(subject, payload));
            }

            return abilityWithSubjectPayload.can(action, subject);
        },
        [ability]
    );

    const cannot = useCallback(
        (action: PolicyAction, subject: PolicySubject, payload?: SubjectPayload): boolean => {
            return !can(action, subject, payload);
        },
        [can]
    );

    return {
        loading,
        role,
        can,
        cannot,
        refreshPolicies,
    };
}

export default usePolicyPermission;

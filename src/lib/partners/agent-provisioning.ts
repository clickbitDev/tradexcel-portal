import { createAdminServerClient } from '@/lib/supabase/server';
import { NON_DELETED_PROFILE_FILTER } from '@/lib/staff/profile-filters';

type AdminClient = ReturnType<typeof createAdminServerClient>;

type ExistingAgentPartnerRow = {
    id: string;
    type: string;
    user_id: string | null;
    created_at: string;
};

type AgentProfileSeedRow = {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
};

export type EnsureAgentPartnerInput = {
    userId: string;
    email?: string | null;
    fullName?: string | null;
    phone?: string | null;
};

export type EnsureAgentPartnerResult = {
    partnerId: string;
    created: boolean;
    linkedExisting: boolean;
};

export class AgentProvisioningError extends Error {
    status: number;

    constructor(message: string, status = 500) {
        super(message);
        this.name = 'AgentProvisioningError';
        this.status = status;
    }
}

function normalizeNullableString(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
    const normalized = normalizeNullableString(value);
    return normalized ? normalized.toLowerCase() : null;
}

function buildAgentCompanyName(fullName: string | null, email: string | null, userId: string): string {
    if (fullName) {
        return fullName;
    }

    if (email && email.includes('@')) {
        const localPart = email.split('@')[0]?.trim();
        if (localPart) {
            return localPart;
        }
    }

    return `Agent ${userId.slice(0, 8)}`;
}

export async function ensureAgentPartner(
    adminClient: AdminClient,
    input: EnsureAgentPartnerInput
): Promise<EnsureAgentPartnerResult> {
    const normalizedEmail = normalizeEmail(input.email);
    const normalizedFullName = normalizeNullableString(input.fullName);
    const normalizedPhone = normalizeNullableString(input.phone);

    const { data: ownedPartner, error: ownedPartnerError } = await adminClient
        .from('partners')
        .select('id')
        .eq('type', 'agent')
        .eq('user_id', input.userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle<{ id: string }>();

    if (ownedPartnerError) {
        throw new AgentProvisioningError('Failed to check existing agent partner', 500);
    }

    if (ownedPartner?.id) {
        return {
            partnerId: ownedPartner.id,
            created: false,
            linkedExisting: false,
        };
    }

    if (normalizedEmail) {
        const { data: matchingPartners, error: matchingPartnersError } = await adminClient
            .from('partners')
            .select('id, type, user_id, created_at')
            .ilike('email', normalizedEmail)
            .order('created_at', { ascending: true });

        if (matchingPartnersError) {
            throw new AgentProvisioningError('Failed to look up existing partner records', 500);
        }

        const rows = (matchingPartners || []) as ExistingAgentPartnerRow[];
        const linkedAgent = rows.find((row) => row.type === 'agent' && row.user_id === input.userId);
        if (linkedAgent) {
            return {
                partnerId: linkedAgent.id,
                created: false,
                linkedExisting: false,
            };
        }

        const agentLinkedToAnotherUser = rows.find((row) => row.type === 'agent' && row.user_id && row.user_id !== input.userId);
        if (agentLinkedToAnotherUser) {
            throw new AgentProvisioningError(
                'This email is already linked to another agent partner profile.',
                409
            );
        }

        const unlinkedAgent = rows.find((row) => row.type === 'agent' && !row.user_id);
        if (unlinkedAgent) {
            const { error: linkError } = await adminClient
                .from('partners')
                .update({
                    user_id: input.userId,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', unlinkedAgent.id)
                .is('user_id', null);

            if (linkError) {
                throw new AgentProvisioningError('Failed to link the existing agent partner profile', 500);
            }

            return {
                partnerId: unlinkedAgent.id,
                created: false,
                linkedExisting: true,
            };
        }

        const nonAgentMatch = rows.find((row) => row.type !== 'agent');
        if (nonAgentMatch) {
            throw new AgentProvisioningError(
                'This email is already used by a non-agent partner profile. Please use a different email or update the existing partner record.',
                409
            );
        }
    }

    const { data: insertedPartner, error: insertPartnerError } = await adminClient
        .from('partners')
        .insert({
            type: 'agent',
            company_name: buildAgentCompanyName(normalizedFullName, normalizedEmail, input.userId),
            contact_name: normalizedFullName,
            email: normalizedEmail,
            phone: normalizedPhone,
            status: 'active',
            priority_level: 'standard',
            user_id: input.userId,
        })
        .select('id')
        .single<{ id: string }>();

    if (insertPartnerError || !insertedPartner?.id) {
        throw new AgentProvisioningError(
            insertPartnerError?.message || 'Failed to create the agent partner profile',
            500
        );
    }

    return {
        partnerId: insertedPartner.id,
        created: true,
        linkedExisting: false,
    };
}

export async function backfillMissingAgentPartners(adminClient: AdminClient) {
    const { data: agentProfiles, error: agentProfilesError } = await adminClient
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('role', 'agent')
        .or(NON_DELETED_PROFILE_FILTER);

    if (agentProfilesError) {
        throw new AgentProvisioningError('Failed to load agent profiles for backfill', 500);
    }

    const profiles = (agentProfiles || []) as AgentProfileSeedRow[];
    if (profiles.length === 0) {
        return {
            repairedCount: 0,
            errors: [],
        };
    }

    const { data: linkedPartners, error: linkedPartnersError } = await adminClient
        .from('partners')
        .select('user_id')
        .eq('type', 'agent')
        .in('user_id', profiles.map((profile) => profile.id));

    if (linkedPartnersError) {
        throw new AgentProvisioningError('Failed to load linked agent partners for backfill', 500);
    }

    const linkedUserIds = new Set(
        (linkedPartners || [])
            .map((partner) => partner.user_id)
            .filter((value): value is string => Boolean(value))
    );

    let repairedCount = 0;
    const errors: string[] = [];

    for (const profile of profiles) {
        if (linkedUserIds.has(profile.id)) {
            continue;
        }

        try {
            const result = await ensureAgentPartner(adminClient, {
                userId: profile.id,
                email: profile.email,
                fullName: profile.full_name,
                phone: profile.phone,
            });

            if (result.created || result.linkedExisting) {
                repairedCount += 1;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown provisioning error';
            errors.push(`${profile.id}: ${message}`);
        }
    }

    return {
        repairedCount,
        errors,
    };
}

import type { PartnerType } from '@/types/database';

export const AGENT_PARTNER_TYPES: PartnerType[] = ['agent', 'subagent'];

export function isPartnerType(value: string | null | undefined): value is PartnerType {
    return value === 'agent' || value === 'subagent' || value === 'provider';
}

export function isAgentLikePartnerType(value: string | null | undefined): boolean {
    return value === 'agent' || value === 'subagent';
}

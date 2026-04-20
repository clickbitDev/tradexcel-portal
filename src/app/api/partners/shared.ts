import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { ContactChannel, PartnerStatus, PartnerType, PriorityLevel } from '@/types/database';

type ProfileRow = {
    role?: string | null;
    account_status?: string | null;
};

export type PartnerMutationPayload = {
    type: PartnerType;
    company_name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    status: PartnerStatus;
    priority_level: PriorityLevel;
    commission_rate: number | null;
    preferred_channel: ContactChannel | null;
    address: string | null;
    notes: string | null;
};

const PARTNER_MANAGE_ROLES = new Set([
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'developer',
    // Legacy roles still used in some environments.
    'manager',
    'staff',
]);

const PARTNER_TYPES = new Set<PartnerType>(['agent', 'subagent', 'provider']);
const PARTNER_STATUSES = new Set<PartnerStatus>(['active', 'pending', 'suspended', 'inactive']);
const PRIORITY_LEVELS = new Set<PriorityLevel>(['standard', 'preferred', 'premium']);
const CONTACT_CHANNELS = new Set<ContactChannel>(['email', 'phone', 'whatsapp', 'meeting', 'other']);

type SupabaseErrorLike = {
    message?: string | null;
    details?: string | null;
    hint?: string | null;
    code?: string | null;
};

function normalizeOptionalText(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function parseCommissionRate(value: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
    if (value === null || value === undefined || value === '') {
        return { ok: true, value: null };
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            return { ok: false, error: 'Commission rate must be a valid number' };
        }

        if (value < 0 || value > 100) {
            return { ok: false, error: 'Commission rate must be between 0 and 100' };
        }

        return { ok: true, value };
    }

    if (typeof value === 'string') {
        const normalized = value.trim();
        if (normalized.length === 0) {
            return { ok: true, value: null };
        }

        const parsed = Number.parseFloat(normalized);
        if (!Number.isFinite(parsed)) {
            return { ok: false, error: 'Commission rate must be a valid number' };
        }

        if (parsed < 0 || parsed > 100) {
            return { ok: false, error: 'Commission rate must be between 0 and 100' };
        }

        return { ok: true, value: parsed };
    }

    return { ok: false, error: 'Commission rate must be a valid number' };
}

function toPartnerType(value: unknown): PartnerType | null {
    if (typeof value !== 'string') {
        return null;
    }

    return PARTNER_TYPES.has(value as PartnerType) ? (value as PartnerType) : null;
}

function toPartnerStatus(value: unknown): PartnerStatus | null {
    if (typeof value !== 'string') {
        return null;
    }

    return PARTNER_STATUSES.has(value as PartnerStatus) ? (value as PartnerStatus) : null;
}

function toPriorityLevel(value: unknown): PriorityLevel | null {
    if (typeof value !== 'string') {
        return null;
    }

    return PRIORITY_LEVELS.has(value as PriorityLevel) ? (value as PriorityLevel) : null;
}

function toContactChannel(value: unknown): ContactChannel | null {
    if (typeof value !== 'string') {
        return null;
    }

    return CONTACT_CHANNELS.has(value as ContactChannel) ? (value as ContactChannel) : null;
}

export function validatePartnerPayload(body: unknown): { ok: true; payload: PartnerMutationPayload } | { ok: false; error: string } {
    if (!body || typeof body !== 'object') {
        return { ok: false, error: 'Invalid request payload' };
    }

    const record = body as Record<string, unknown>;

    const type = toPartnerType(record.type);
    if (!type) {
        return { ok: false, error: 'Invalid partner type' };
    }

    const companyName = normalizeOptionalText(record.company_name);
    if (!companyName) {
        return { ok: false, error: 'Company/Agent name is required' };
    }

    const status = toPartnerStatus(record.status) ?? 'active';
    const priorityLevel = toPriorityLevel(record.priority_level) ?? 'standard';

    const commissionRateResult = parseCommissionRate(record.commission_rate);
    if (!commissionRateResult.ok) {
        return { ok: false, error: commissionRateResult.error };
    }

    const preferredChannel = toContactChannel(record.preferred_channel);
    if (record.preferred_channel && !preferredChannel) {
        return { ok: false, error: 'Invalid preferred channel' };
    }

    return {
        ok: true,
        payload: {
            type,
            company_name: companyName,
            contact_name: normalizeOptionalText(record.contact_name),
            email: normalizeOptionalText(record.email)?.toLowerCase() || null,
            phone: normalizeOptionalText(record.phone),
            country: normalizeOptionalText(record.country),
            status,
            priority_level: priorityLevel,
            commission_rate: commissionRateResult.value,
            preferred_channel: preferredChannel,
            address: normalizeOptionalText(record.address),
            notes: normalizeOptionalText(record.notes),
        },
    };
}

export function isRlsPermissionError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const e = error as SupabaseErrorLike;
    const message = (e.message || '').toLowerCase();

    return e.code === '42501'
        || message.includes('row-level security')
        || message.includes('permission denied');
}

export function getPartnerErrorMessage(error: unknown, fallback: string): string {
    if (!error || typeof error !== 'object') {
        return fallback;
    }

    const e = error as SupabaseErrorLike;
    const message = (e.message || '').trim();
    const lowerMessage = message.toLowerCase();

    if (
        lowerMessage.includes('idx_partners_company_email_unique')
        || (lowerMessage.includes('duplicate key value') && lowerMessage.includes('company_name'))
    ) {
        return 'A partner with this company name and email already exists.';
    }

    if (lowerMessage.includes('partners_email_key')) {
        return 'A partner with this email already exists.';
    }

    if (lowerMessage.includes('invalid input value for enum partner_type') && lowerMessage.includes('subagent')) {
        return 'Sub-agent type is not enabled in your database yet. Run the latest migrations and try again.';
    }

    if (message.length > 0) {
        return message;
    }

    return fallback;
}

export function statusCodeForError(error: unknown): number {
    if (!error || typeof error !== 'object') {
        return 500;
    }

    const e = error as SupabaseErrorLike;
    if (e.code === '23505' || e.code === '22P02') {
        return 400;
    }

    if (e.code === '42501') {
        return 403;
    }

    return 500;
}

export async function requirePartnerManageAccess() {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return {
            ok: false as const,
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }

    const { data: profileWithStatus, error: profileWithStatusError } = await supabase
        .from('profiles')
        .select('role, account_status')
        .eq('id', user.id)
        .single<ProfileRow>();

    let role = profileWithStatus?.role ?? null;
    let accountStatus = profileWithStatus?.account_status ?? 'active';

    if (profileWithStatusError && profileWithStatusError.message?.includes('account_status')) {
        const { data: fallbackProfile, error: fallbackError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single<{ role?: string | null }>();

        if (fallbackError) {
            return {
                ok: false as const,
                response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
            };
        }

        role = fallbackProfile?.role ?? null;
        accountStatus = 'active';
    } else if (profileWithStatusError) {
        return {
            ok: false as const,
            response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
        };
    }

    if (!role) {
        return {
            ok: false as const,
            response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
        };
    }

    if (accountStatus === 'disabled') {
        return {
            ok: false as const,
            response: NextResponse.json({ error: 'Your account is disabled' }, { status: 403 }),
        };
    }

    if (!PARTNER_MANAGE_ROLES.has(role)) {
        return {
            ok: false as const,
            response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
        };
    }

    return {
        ok: true as const,
        context: {
            supabase,
        },
    };
}

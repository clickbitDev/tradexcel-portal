import { getSharpFutureConnection } from '@/lib/rto-integration/connection';
import type { Rto } from '@/types/database';

type ServerSupabaseClient = Awaited<
    ReturnType<typeof import('@/lib/supabase/server').createServerClient>
>;

export type PortalRtoRecord = Pick<
    Rto,
    | 'id'
    | 'code'
    | 'name'
    | 'status'
    | 'location'
    | 'state'
    | 'phone'
    | 'email'
    | 'website'
    | 'notes'
    | 'provider_name'
    | 'contact_person_name'
>;

const PORTAL_RTO_SELECT = `
    id,
    code,
    name,
    status,
    location,
    state,
    phone,
    email,
    website,
    notes,
    provider_name,
    contact_person_name
`;

async function fetchPortalRtoById(
    supabase: ServerSupabaseClient,
    rtoId: string
): Promise<PortalRtoRecord | null> {
    const { data, error } = await supabase
        .from('rtos')
        .select(PORTAL_RTO_SELECT)
        .eq('id', rtoId)
        .eq('is_deleted', false)
        .maybeSingle<PortalRtoRecord>();

    if (error || !data) {
        return null;
    }

    return data;
}

export async function getResolvedPortalRto(supabase: ServerSupabaseClient): Promise<{
    configuredRtoId: string | null;
    rto: PortalRtoRecord | null;
    isImplicit: boolean;
}> {
    const connection = await getSharpFutureConnection(supabase);
    const configuredRtoId = connection?.portal_rto_id || null;

    if (configuredRtoId) {
        const configuredRto = await fetchPortalRtoById(supabase, configuredRtoId);
        return {
            configuredRtoId,
            rto: configuredRto,
            isImplicit: false,
        };
    }

    const { data, error } = await supabase
        .from('rtos')
        .select(PORTAL_RTO_SELECT)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false })
        .limit(2)
        .returns<PortalRtoRecord[]>();

    if (error || !data || data.length !== 1) {
        return {
            configuredRtoId: null,
            rto: null,
            isImplicit: false,
        };
    }

    return {
        configuredRtoId: null,
        rto: data[0],
        isImplicit: true,
    };
}

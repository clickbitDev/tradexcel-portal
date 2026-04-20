import { createAdminServerClient } from '@/lib/supabase/server';

type AdminSupabaseClient = ReturnType<typeof createAdminServerClient>;

export type XeroEntityType = 'invoice' | 'bill' | 'partner' | 'rto' | 'payment' | 'application_applicant';

export interface XeroEntityMapRecord {
    id: string;
    entity_type: XeroEntityType;
    lumiere_id: string;
    xero_id: string;
    xero_number: string | null;
    xero_url: string | null;
    sync_status: 'synced' | 'pending' | 'error' | 'deleted';
    sync_direction: 'push' | 'pull';
    last_synced_at: string;
    sync_error: string | null;
}

export async function getXeroEntityMapping(
    entityType: XeroEntityType,
    lumiereId: string,
    supabase: AdminSupabaseClient = createAdminServerClient()
): Promise<XeroEntityMapRecord | null> {
    const { data, error } = await supabase
        .from('xero_entity_map')
        .select('*')
        .eq('entity_type', entityType)
        .eq('lumiere_id', lumiereId)
        .maybeSingle<XeroEntityMapRecord>();

    if (error || !data) {
        return null;
    }

    return data;
}

export async function getXeroEntityMappingByXeroId(
    entityType: XeroEntityType,
    xeroId: string,
    supabase: AdminSupabaseClient = createAdminServerClient()
): Promise<XeroEntityMapRecord | null> {
    const { data, error } = await supabase
        .from('xero_entity_map')
        .select('*')
        .eq('entity_type', entityType)
        .eq('xero_id', xeroId)
        .maybeSingle<XeroEntityMapRecord>();

    if (error || !data) {
        return null;
    }

    return data;
}

export async function getXeroEntityId(
    entityType: XeroEntityType,
    lumiereId: string,
    supabase: AdminSupabaseClient = createAdminServerClient()
): Promise<string | null> {
    const mapping = await getXeroEntityMapping(entityType, lumiereId, supabase);
    if (!mapping || mapping.sync_status !== 'synced') {
        return null;
    }

    return mapping.xero_id;
}

export async function upsertXeroEntityMapping(input: {
    entityType: XeroEntityType;
    lumiereId: string;
    xeroId: string;
    xeroNumber?: string | null;
    xeroUrl?: string | null;
    syncStatus?: 'synced' | 'pending' | 'error' | 'deleted';
    syncDirection?: 'push' | 'pull';
    syncError?: string | null;
    supabase?: AdminSupabaseClient;
}): Promise<void> {
    const supabase = input.supabase || createAdminServerClient();

    const { error } = await supabase
        .from('xero_entity_map')
        .upsert({
            entity_type: input.entityType,
            lumiere_id: input.lumiereId,
            xero_id: input.xeroId,
            xero_number: input.xeroNumber || null,
            xero_url: input.xeroUrl || null,
            sync_status: input.syncStatus || 'synced',
            sync_direction: input.syncDirection || 'push',
            sync_error: input.syncError || null,
            last_synced_at: new Date().toISOString(),
        }, {
            onConflict: 'entity_type,lumiere_id',
        });

    if (error) {
        throw new Error(error.message || 'Unable to store the Xero entity mapping.');
    }
}

export async function markXeroEntityPendingSync(
    entityType: XeroEntityType,
    lumiereId: string,
    supabase: AdminSupabaseClient = createAdminServerClient()
): Promise<void> {
    await upsertXeroEntityMapping({
        entityType,
        lumiereId,
        xeroId: '',
        syncStatus: 'pending',
        syncDirection: 'push',
        supabase,
    });
}

import { createAdminServerClient } from '@/lib/supabase/server';

export const PORTAL_ORG_INTEGRATION_KEY = 'portal';

type AdminSupabaseClient = ReturnType<typeof createAdminServerClient>;

export interface SingletonPortalOrg {
    id: string;
    integration_key: string;
}

export async function ensureSingletonPortalOrg(
    supabase: AdminSupabaseClient = createAdminServerClient()
): Promise<SingletonPortalOrg> {
    const { data: existingOrg, error: existingOrgError } = await supabase
        .from('portal_connections')
        .select('id, integration_key')
        .eq('integration_key', PORTAL_ORG_INTEGRATION_KEY)
        .maybeSingle<SingletonPortalOrg>();

    if (existingOrgError) {
        throw new Error(existingOrgError.message || 'Unable to load the singleton portal org.');
    }

    if (existingOrg) {
        return existingOrg;
    }

    const { data: createdOrg, error: createOrgError } = await supabase
        .from('portal_connections')
        .insert({
            integration_key: PORTAL_ORG_INTEGRATION_KEY,
            is_enabled: true,
        })
        .select('id, integration_key')
        .single<SingletonPortalOrg>();

    if (createOrgError || !createdOrg) {
        throw new Error(createOrgError?.message || 'Unable to create the singleton portal org.');
    }

    return createdOrg;
}

export async function getSingletonPortalOrgId(
    supabase: AdminSupabaseClient = createAdminServerClient()
): Promise<string> {
    const portalOrg = await ensureSingletonPortalOrg(supabase);
    return portalOrg.id;
}

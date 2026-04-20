import { getDefaultActionPermissionsForRole } from '@/lib/access-control/action-permissions';
import type { UserRole } from '@/types/database';
import type { createServerClient } from '@/lib/supabase/server';

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

export async function hasActionPermission(input: {
    supabase: ServerSupabaseClient;
    role: UserRole;
    permissionKey: string;
}): Promise<boolean> {
    const defaultGranted = getDefaultActionPermissionsForRole(input.role)[input.permissionKey] === true;

    const { data, error } = await input.supabase
        .from('role_permissions')
        .select('granted')
        .eq('role', input.role)
        .eq('permission_key', input.permissionKey)
        .maybeSingle<{ granted: boolean }>();

    if (error || !data) {
        return defaultGranted;
    }

    return data.granted === true;
}

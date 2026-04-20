import type { ConnectionStatus, PortalConnection } from '@/types/database';
import { decryptSecret, encryptSecret } from '@/lib/rto-integration/security';

type ServerSupabaseClient = Awaited<
    ReturnType<typeof import('@/lib/supabase/server').createServerClient>
>;

export interface ResolvedPortalConnection extends PortalConnection {
    transferSecret: string | null;
}

const CONNECTION_KEY = 'sharp_future';

export async function getSharpFutureConnection(
    supabase: ServerSupabaseClient
): Promise<ResolvedPortalConnection | null> {
    const { data, error } = await supabase
        .from('portal_connections')
        .select('*')
        .eq('integration_key', CONNECTION_KEY)
        .maybeSingle<PortalConnection>();

    if (error || !data) {
        return null;
    }

    return {
        ...data,
        transferSecret: decryptSecret(data.transfer_secret_encrypted),
    };
}

export async function saveSharpFutureConnection(input: {
    supabase: ServerSupabaseClient;
    portalRtoId?: string | null;
    sharpFutureBaseUrl?: string | null;
    sharpFutureRtoId?: string | null;
    publicPortalUrl?: string | null;
    webhookReceiveUrl?: string | null;
    connectionStatus?: ConnectionStatus;
    isEnabled?: boolean;
    lastConnectedAt?: string | null;
    lastPingAt?: string | null;
    transferSecret?: string | null;
    updatedBy?: string | null;
}): Promise<void> {
    const updatePayload: Record<string, string | boolean | null> = {};

    if (input.portalRtoId !== undefined) {
        updatePayload.portal_rto_id = input.portalRtoId || null;
    }

    if (input.sharpFutureBaseUrl !== undefined) {
        updatePayload.sharp_future_base_url = input.sharpFutureBaseUrl?.trim() || null;
    }

    if (input.sharpFutureRtoId !== undefined) {
        updatePayload.sharp_future_rto_id = input.sharpFutureRtoId || null;
    }

    if (input.publicPortalUrl !== undefined) {
        updatePayload.public_portal_url = input.publicPortalUrl?.trim() || null;
    }

    if (input.webhookReceiveUrl !== undefined) {
        updatePayload.webhook_receive_url = input.webhookReceiveUrl?.trim() || null;
    }

    if (input.connectionStatus !== undefined) {
        updatePayload.connection_status = input.connectionStatus;
    }

    if (input.isEnabled !== undefined) {
        updatePayload.is_enabled = input.isEnabled;
    }

    if (input.lastConnectedAt !== undefined) {
        updatePayload.last_connected_at = input.lastConnectedAt;
    }

    if (input.lastPingAt !== undefined) {
        updatePayload.last_ping_at = input.lastPingAt;
    }

    if (input.updatedBy !== undefined) {
        updatePayload.updated_by = input.updatedBy;
    }

    if (input.transferSecret !== undefined) {
        updatePayload.transfer_secret_encrypted = input.transferSecret
            ? encryptSecret(input.transferSecret)
            : null;
    }

    const { error } = await input.supabase
        .from('portal_connections')
        .update(updatePayload)
        .eq('integration_key', CONNECTION_KEY);

    if (error) {
        throw new Error(error.message);
    }
}

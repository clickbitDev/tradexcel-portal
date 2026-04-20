import { randomUUID } from 'crypto';
import { createAdminServerClient } from '@/lib/supabase/server';
import { getSharpFutureConnection } from '@/lib/rto-integration/connection';
import { signPayload } from '@/lib/rto-integration/security';
import type { ApplicationHistorySyncEvent } from '@/lib/rto-integration/types';

type ServerSupabaseClient = Awaited<
    ReturnType<typeof import('@/lib/supabase/server').createServerClient>
>;

type MirroredApplicationRow = {
    id: string;
    source_application_id: string | null;
    source_portal: string;
    workflow_stage: string | null;
};

export async function emitSharpFutureHistoryEvent(input: {
    supabase: ServerSupabaseClient;
    applicationId: string;
    entry: {
        action: string | null;
        fieldChanged: string | null;
        oldValue: string | null;
        newValue: string | null;
        fromStage: string | null;
        toStage: string | null;
        notes: string | null;
        userId: string | null;
        metadata: Record<string, unknown> | null;
    };
}): Promise<void> {
    const adminSupabase = createAdminServerClient();
    const connection = await getSharpFutureConnection(adminSupabase as never);

    if (!connection?.is_enabled || connection.connection_status !== 'connected' || !connection.transferSecret) {
        return;
    }

    const { data: application, error: applicationError } = await adminSupabase
        .from('applications')
        .select('id, source_application_id, source_portal, workflow_stage')
        .eq('id', input.applicationId)
        .maybeSingle<MirroredApplicationRow>();

    if (applicationError || !application || application.source_portal !== 'sharp_future' || !application.source_application_id) {
        return;
    }

    const eventPayload: ApplicationHistorySyncEvent = {
        rtoId: connection.sharp_future_rto_id || '',
        eventId: randomUUID(),
        eventType: 'application.history.created',
        occurredAt: new Date().toISOString(),
        sourceApplicationId: application.source_application_id,
        remoteApplicationId: application.id,
        workflowStage: application.workflow_stage,
        historyEntry: input.entry,
    };

    if (!eventPayload.rtoId) {
        return;
    }

    const rawPayload = JSON.stringify(eventPayload);
    const webhookReceiveUrl = connection.webhook_receive_url
        || (connection.sharp_future_base_url
            ? new URL('/api/webhooks/rto-events', connection.sharp_future_base_url).toString()
            : null);

    if (!webhookReceiveUrl) {
        return;
    }

    await adminSupabase
        .from('sharp_future_event_deliveries')
        .insert({
            event_id: eventPayload.eventId,
            application_id: application.id,
            event_type: eventPayload.eventType,
            payload: eventPayload,
            delivery_status: 'pending',
            last_attempt_at: eventPayload.occurredAt,
        });

    try {
        const response = await fetch(webhookReceiveUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-rto-signature': signPayload(connection.transferSecret, rawPayload),
            },
            body: rawPayload,
            cache: 'no-store',
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(
                payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
                    ? payload.error
                    : `Sharp Future sync failed with status ${response.status}`
            );
        }

        await adminSupabase
            .from('sharp_future_event_deliveries')
            .update({
                delivery_status: 'delivered',
                delivered_at: new Date().toISOString(),
                error_message: null,
            })
            .eq('event_id', eventPayload.eventId);
    } catch (error) {
        await adminSupabase
            .from('sharp_future_event_deliveries')
            .update({
                delivery_status: 'failed',
                error_message: error instanceof Error ? error.message : 'Unknown sync error',
            })
            .eq('event_id', eventPayload.eventId);
    }
}

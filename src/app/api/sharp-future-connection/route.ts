import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { getSharpFutureConnection, saveSharpFutureConnection } from '@/lib/rto-integration/connection';
import { signPayload } from '@/lib/rto-integration/security';

const ConnectionPayloadSchema = z.object({
    action: z.enum(['save', 'save-and-connect', 'test']),
    sharpFutureBaseUrl: z.string().trim().url().optional(),
    sharpFutureRtoId: z.string().uuid().optional(),
    transferSecret: z.string().trim().min(16).optional(),
    publicPortalUrl: z.string().trim().url().optional(),
});

const ALLOWED_ROLES = ['ceo', 'developer'] as const;

async function verifyConnection(input: {
    baseUrl: string;
    rtoId: string;
    portalUrl: string;
    transferSecret: string;
}) {
    const rawPayload = JSON.stringify({
        rtoId: input.rtoId,
        portalUrl: input.portalUrl,
        requestedAt: new Date().toISOString(),
    });

    const response = await fetch(new URL('/api/rto/handshake', input.baseUrl).toString(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-rto-signature': signPayload(input.transferSecret, rawPayload),
        },
        body: rawPayload,
        cache: 'no-store',
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(
            payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
                ? payload.error
                : `Handshake failed with status ${response.status}`
        );
    }

    return payload && typeof payload === 'object' && 'data' in payload ? payload.data as {
        webhookReceiveUrl?: string;
    } : {};
}

function formatConnectionResponse(connection: Awaited<ReturnType<typeof getSharpFutureConnection>>) {
    if (!connection) {
        return null;
    }

    return {
        id: connection.id,
        sharpFutureBaseUrl: connection.sharp_future_base_url,
        sharpFutureRtoId: connection.sharp_future_rto_id,
        publicPortalUrl: connection.public_portal_url,
        webhookReceiveUrl: connection.webhook_receive_url,
        connectionStatus: connection.connection_status,
        isEnabled: connection.is_enabled,
        lastConnectedAt: connection.last_connected_at,
        lastPingAt: connection.last_ping_at,
        hasTransferSecret: Boolean(connection.transferSecret),
    };
}

export async function GET(request: NextRequest) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'integration',
        action: 'manage_integrations',
        allowedRoles: [...ALLOWED_ROLES],
    });

    if (!authz.ok) {
        return authz.response;
    }

    const adminSupabase = createAdminServerClient();
    const connection = await getSharpFutureConnection(adminSupabase as never);
    return NextResponse.json({ data: formatConnectionResponse(connection) });
}

export async function POST(request: NextRequest) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'integration',
        action: 'manage_integrations',
        allowedRoles: [...ALLOWED_ROLES],
    });

    if (!authz.ok) {
        return authz.response;
    }

    const parsedBody = ConnectionPayloadSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json({ error: 'Invalid Sharp Future connection payload.' }, { status: 400 });
    }

    const adminSupabase = createAdminServerClient();
    const currentConnection = await getSharpFutureConnection(adminSupabase as never);
    const nextBaseUrl = parsedBody.data.sharpFutureBaseUrl || currentConnection?.sharp_future_base_url || null;
    const nextRtoId = parsedBody.data.sharpFutureRtoId || currentConnection?.sharp_future_rto_id || null;
    const nextPublicPortalUrl = parsedBody.data.publicPortalUrl || currentConnection?.public_portal_url || null;
    const nextTransferSecret = parsedBody.data.transferSecret || currentConnection?.transferSecret || null;

    if (parsedBody.data.action === 'save' || parsedBody.data.action === 'save-and-connect') {
        await saveSharpFutureConnection({
            supabase: adminSupabase as never,
            sharpFutureBaseUrl: nextBaseUrl,
            sharpFutureRtoId: nextRtoId,
            publicPortalUrl: nextPublicPortalUrl,
            transferSecret: parsedBody.data.transferSecret,
            connectionStatus: currentConnection?.connection_status || 'disconnected',
            updatedBy: authz.context.userId,
        });
    }

    if (parsedBody.data.action === 'save') {
        const saved = await getSharpFutureConnection(adminSupabase as never);
        return NextResponse.json({ data: formatConnectionResponse(saved) });
    }

    if (!nextBaseUrl || !nextRtoId || !nextPublicPortalUrl || !nextTransferSecret) {
        return NextResponse.json(
            { error: 'Base URL, RTO ID, portal URL, and transfer secret are required to connect.' },
            { status: 409 }
        );
    }

    try {
        const handshake = await verifyConnection({
            baseUrl: nextBaseUrl,
            rtoId: nextRtoId,
            portalUrl: nextPublicPortalUrl,
            transferSecret: nextTransferSecret,
        });

        await saveSharpFutureConnection({
            supabase: adminSupabase as never,
            sharpFutureBaseUrl: nextBaseUrl,
            sharpFutureRtoId: nextRtoId,
            publicPortalUrl: nextPublicPortalUrl,
            webhookReceiveUrl: handshake.webhookReceiveUrl || null,
            transferSecret: parsedBody.data.transferSecret,
            connectionStatus: 'connected',
            isEnabled: true,
            lastConnectedAt: new Date().toISOString(),
            lastPingAt: new Date().toISOString(),
            updatedBy: authz.context.userId,
        });

        const updated = await getSharpFutureConnection(adminSupabase as never);
        return NextResponse.json({ data: formatConnectionResponse(updated) });
    } catch (error) {
        await saveSharpFutureConnection({
            supabase: adminSupabase as never,
            connectionStatus: 'error',
            isEnabled: false,
            updatedBy: authz.context.userId,
        });

        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unable to connect to Sharp Future.' },
            { status: 502 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'integration',
        action: 'manage_integrations',
        allowedRoles: [...ALLOWED_ROLES],
    });

    if (!authz.ok) {
        return authz.response;
    }

    const adminSupabase = createAdminServerClient();
    await saveSharpFutureConnection({
        supabase: adminSupabase as never,
        transferSecret: null,
        webhookReceiveUrl: null,
        connectionStatus: 'disconnected',
        isEnabled: false,
        lastConnectedAt: null,
        lastPingAt: null,
        updatedBy: authz.context.userId,
    });

    const updated = await getSharpFutureConnection(adminSupabase as never);
    return NextResponse.json({ data: formatConnectionResponse(updated) });
}

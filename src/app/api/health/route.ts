import { NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { getSharpFutureConnection } from '@/lib/rto-integration/connection';

export async function GET() {
    try {
        const adminSupabase = createAdminServerClient();
        const connection = await getSharpFutureConnection(adminSupabase as never);

        return NextResponse.json({
            data: {
                portalName: 'Edward Portal',
                rtoPortalId: connection?.sharp_future_rto_id || null,
                connectionStatus: connection?.connection_status || 'disconnected',
            },
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Health check failed.' },
            { status: 500 }
        );
    }
}

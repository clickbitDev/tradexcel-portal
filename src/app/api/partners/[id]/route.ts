import { NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import {
    getPartnerErrorMessage,
    isRlsPermissionError,
    requirePartnerManageAccess,
    statusCodeForError,
    validatePartnerPayload,
} from '../shared';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
    try {
        const access = await requirePartnerManageAccess();
        if (!access.ok) {
            return access.response;
        }

        const { id } = await params;

        const attemptWithUserClient = await access.context.supabase
            .from('partners')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (!attemptWithUserClient.error) {
            if (!attemptWithUserClient.data) {
                return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
            }

            return NextResponse.json({ data: attemptWithUserClient.data });
        }

        if (!isRlsPermissionError(attemptWithUserClient.error)) {
            return NextResponse.json(
                { error: getPartnerErrorMessage(attemptWithUserClient.error, 'Failed to fetch partner') },
                { status: statusCodeForError(attemptWithUserClient.error) }
            );
        }

        let adminClient: ReturnType<typeof createAdminServerClient>;
        try {
            adminClient = createAdminServerClient();
        } catch {
            return NextResponse.json(
                { error: getPartnerErrorMessage(attemptWithUserClient.error, 'Failed to fetch partner') },
                { status: statusCodeForError(attemptWithUserClient.error) }
            );
        }

        const attemptWithAdminClient = await adminClient
            .from('partners')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (attemptWithAdminClient.error) {
            return NextResponse.json(
                { error: getPartnerErrorMessage(attemptWithAdminClient.error, 'Failed to fetch partner') },
                { status: statusCodeForError(attemptWithAdminClient.error) }
            );
        }

        if (!attemptWithAdminClient.data) {
            return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
        }

        return NextResponse.json({ data: attemptWithAdminClient.data });
    } catch {
        return NextResponse.json({ error: 'Failed to fetch partner' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
    try {
        const access = await requirePartnerManageAccess();
        if (!access.ok) {
            return access.response;
        }

        const { id } = await params;
        const body = await request.json().catch(() => null);
        const validation = validatePartnerPayload(body);
        if (!validation.ok) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        const writePayload = {
            ...validation.payload,
            updated_at: new Date().toISOString(),
        };

        const attemptWithUserClient = await access.context.supabase
            .from('partners')
            .update(writePayload)
            .eq('id', id)
            .select('id')
            .maybeSingle<{ id: string }>();

        if (!attemptWithUserClient.error) {
            if (!attemptWithUserClient.data) {
                return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
            }

            return NextResponse.json({ data: attemptWithUserClient.data });
        }

        if (!isRlsPermissionError(attemptWithUserClient.error)) {
            return NextResponse.json(
                { error: getPartnerErrorMessage(attemptWithUserClient.error, 'Failed to update partner') },
                { status: statusCodeForError(attemptWithUserClient.error) }
            );
        }

        let adminClient: ReturnType<typeof createAdminServerClient>;
        try {
            adminClient = createAdminServerClient();
        } catch {
            return NextResponse.json(
                { error: getPartnerErrorMessage(attemptWithUserClient.error, 'Failed to update partner') },
                { status: statusCodeForError(attemptWithUserClient.error) }
            );
        }

        const attemptWithAdminClient = await adminClient
            .from('partners')
            .update(writePayload)
            .eq('id', id)
            .select('id')
            .maybeSingle<{ id: string }>();

        if (attemptWithAdminClient.error) {
            return NextResponse.json(
                { error: getPartnerErrorMessage(attemptWithAdminClient.error, 'Failed to update partner') },
                { status: statusCodeForError(attemptWithAdminClient.error) }
            );
        }

        if (!attemptWithAdminClient.data) {
            return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
        }

        return NextResponse.json({ data: attemptWithAdminClient.data });
    } catch {
        return NextResponse.json({ error: 'Failed to update partner' }, { status: 500 });
    }
}

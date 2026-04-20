import { NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import {
    getPartnerErrorMessage,
    isRlsPermissionError,
    requirePartnerManageAccess,
    statusCodeForError,
    validatePartnerPayload,
} from './shared';

export async function POST(request: NextRequest) {
    try {
        const access = await requirePartnerManageAccess();
        if (!access.ok) {
            return access.response;
        }

        const body = await request.json().catch(() => null);
        const validation = validatePartnerPayload(body);
        if (!validation.ok) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        const writePayload = validation.payload;

        const attemptWithUserClient = await access.context.supabase
            .from('partners')
            .insert(writePayload)
            .select('id')
            .single<{ id: string }>();

        if (!attemptWithUserClient.error && attemptWithUserClient.data) {
            return NextResponse.json({ data: attemptWithUserClient.data }, { status: 201 });
        }

        if (!isRlsPermissionError(attemptWithUserClient.error)) {
            return NextResponse.json(
                { error: getPartnerErrorMessage(attemptWithUserClient.error, 'Failed to create partner') },
                { status: statusCodeForError(attemptWithUserClient.error) }
            );
        }

        let adminClient: ReturnType<typeof createAdminServerClient>;
        try {
            adminClient = createAdminServerClient();
        } catch {
            return NextResponse.json(
                { error: getPartnerErrorMessage(attemptWithUserClient.error, 'Failed to create partner') },
                { status: statusCodeForError(attemptWithUserClient.error) }
            );
        }

        const attemptWithAdminClient = await adminClient
            .from('partners')
            .insert(writePayload)
            .select('id')
            .single<{ id: string }>();

        if (attemptWithAdminClient.error || !attemptWithAdminClient.data) {
            return NextResponse.json(
                { error: getPartnerErrorMessage(attemptWithAdminClient.error, 'Failed to create partner') },
                { status: statusCodeForError(attemptWithAdminClient.error) }
            );
        }

        return NextResponse.json({ data: attemptWithAdminClient.data }, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Failed to create partner' }, { status: 500 });
    }
}

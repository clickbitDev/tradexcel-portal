import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUserContext } from '@/lib/access-control/server';
import { hasActionPermission } from '@/lib/access-control/runtime-permissions';
import { deleteBackblazeObject } from '@/lib/storage/backblaze-server';

const DeleteQualificationPreviewSchema = z.object({
    storageKey: z.string().trim().min(1).max(500),
});

export async function DELETE(request: NextRequest) {
    const authResult = await getAuthenticatedUserContext();
    if (!authResult.ok) {
        return authResult.response;
    }

    const canManageQualifications = await hasActionPermission({
        supabase: authResult.context.supabase,
        role: authResult.context.role,
        permissionKey: 'qualifications.manage',
    });

    if (!canManageQualifications) {
        return NextResponse.json({ error: 'You do not have permission to manage qualification previews.' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = DeleteQualificationPreviewSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({
            error: 'Invalid qualification preview delete request.',
            details: parsed.error.issues,
        }, { status: 400 });
    }

    if (!parsed.data.storageKey.startsWith('qualification-previews/')) {
        return NextResponse.json({ error: 'Invalid qualification preview object key.' }, { status: 422 });
    }

    try {
        await deleteBackblazeObject(parsed.data.storageKey);
        return NextResponse.json({ data: { deleted: true } });
    } catch (error) {
        console.error('Failed to delete qualification preview object:', error);
        return NextResponse.json({
            error: 'Unable to delete the qualification preview object right now.',
        }, { status: 500 });
    }
}

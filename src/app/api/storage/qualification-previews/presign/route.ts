import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUserContext } from '@/lib/access-control/server';
import { hasActionPermission } from '@/lib/access-control/runtime-permissions';
import { createBackblazeUploadUrl, getBackblazeConfig } from '@/lib/storage/backblaze-server';
import { buildQualificationPreviewStorageKey } from '@/lib/storage/applications-shared';

const MAX_QUALIFICATION_PREVIEW_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_QUALIFICATION_PREVIEW_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
] as const;

const PresignQualificationPreviewSchema = z.object({
    qualificationCode: z.string().trim().min(1).max(50),
    fileName: z.string().trim().min(1).max(255),
    contentType: z.enum(ALLOWED_QUALIFICATION_PREVIEW_MIME_TYPES),
    fileSize: z.number().int().positive().max(MAX_QUALIFICATION_PREVIEW_SIZE_BYTES),
});

export async function POST(request: NextRequest) {
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
    const parsed = PresignQualificationPreviewSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({
            error: 'Invalid qualification preview upload request.',
            details: parsed.error.issues,
        }, { status: 400 });
    }

    const storageKey = buildQualificationPreviewStorageKey({
        qualificationCode: parsed.data.qualificationCode,
        fileName: parsed.data.fileName,
    });

    try {
        const uploadUrl = await createBackblazeUploadUrl({
            key: storageKey,
            contentType: parsed.data.contentType,
        });

        return NextResponse.json({
            data: {
                uploadUrl,
                storageKey,
                storageBucket: getBackblazeConfig().bucketName,
                storageProvider: 'b2',
                contentType: parsed.data.contentType,
                expiresIn: 900,
            },
        });
    } catch (error) {
        console.error('Failed to create qualification preview upload URL:', error);
        return NextResponse.json({
            error: 'Unable to prepare the qualification preview upload right now.',
        }, { status: 500 });
    }
}

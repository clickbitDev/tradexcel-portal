import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { hasActionPermission } from '@/lib/access-control/runtime-permissions';
import { createBackblazeUploadUrl } from '@/lib/storage/backblaze-server';
import { buildDocumentStorageKey } from '@/lib/storage/applications-shared';
import type { UserRole } from '@/types/database';

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
] as const;

const DOCUMENT_UPLOAD_ROLES: UserRole[] = [
    'ceo',
    'developer',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'agent',
];

const PresignDocumentUploadSchema = z.object({
    applicationId: z.string().uuid(),
    documentType: z.string().trim().min(1).max(100),
    fileName: z.string().trim().min(1).max(255),
    contentType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES),
    fileSize: z.number().int().positive().max(MAX_DOCUMENT_SIZE_BYTES),
});

export async function POST(request: NextRequest) {
    const authzBody = await request.json().catch(() => null);
    const parsed = PresignDocumentUploadSchema.safeParse(authzBody);

    if (!parsed.success) {
        return NextResponse.json({
            error: 'Invalid document upload request.',
            details: parsed.error.issues,
        }, { status: 400 });
    }

    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'view',
        applicationId: parsed.data.applicationId,
        allowedRoles: DOCUMENT_UPLOAD_ROLES,
    });

    if (!authz.ok) {
        return authz.response;
    }

    const canUpload = await hasActionPermission({
        supabase: authz.context.supabase,
        role: authz.context.role,
        permissionKey: 'documents.upload',
    });

    if (!canUpload) {
        return NextResponse.json({ error: 'You do not have permission to upload documents.' }, { status: 403 });
    }

    const storageKey = buildDocumentStorageKey({
        applicationId: parsed.data.applicationId,
        documentType: parsed.data.documentType,
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
                contentType: parsed.data.contentType,
                expiresIn: 900,
            },
        });
    } catch (error) {
        console.error('Failed to create Backblaze upload URL:', error);
        return NextResponse.json({
            error: 'Unable to prepare document upload right now. Please try again.',
        }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { hasActionPermission } from '@/lib/access-control/runtime-permissions';
import {
    deleteBackblazeObject,
    getBackblazeConfig,
    headBackblazeObjectWithRetry,
} from '@/lib/storage/backblaze-server';
import type { Document, UserRole } from '@/types/database';

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

const FinalizeDocumentUploadSchema = z.object({
    applicationId: z.string().uuid(),
    documentType: z.string().trim().min(1).max(100),
    fileName: z.string().trim().min(1).max(255),
    storageKey: z.string().trim().min(1).max(500),
});

function isValidDocumentStorageKey(applicationId: string, storageKey: string): boolean {
    return storageKey.startsWith(`documents/${applicationId}/`);
}

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null);
    const parsed = FinalizeDocumentUploadSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({
            error: 'Invalid document finalize request.',
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

    if (!isValidDocumentStorageKey(parsed.data.applicationId, parsed.data.storageKey)) {
        return NextResponse.json({ error: 'Invalid storage key for this application.' }, { status: 422 });
    }

    let objectMeta;
    try {
        objectMeta = await headBackblazeObjectWithRetry({
            key: parsed.data.storageKey,
        });
    } catch (error) {
        console.error('Failed to verify uploaded Backblaze object:', {
            storageKey: parsed.data.storageKey,
            error,
        });

        const verificationMessage = error instanceof Error
            && error.message.toLowerCase().includes('timeout')
            ? 'The uploaded file is still being verified in storage. Please try again in a few seconds.'
            : 'The uploaded file could not be verified. Please upload it again.';

        return NextResponse.json({
            error: verificationMessage,
        }, { status: 422 });
    }

    const bucketName = getBackblazeConfig().bucketName;
    let mutationClient = authz.context.supabase;

    try {
        mutationClient = createAdminServerClient() as typeof authz.context.supabase;
    } catch {
        mutationClient = authz.context.supabase;
    }

    const insertPayload = {
        application_id: parsed.data.applicationId,
        document_type: parsed.data.documentType,
        file_name: parsed.data.fileName,
        file_url: parsed.data.storageKey,
        file_size: typeof objectMeta.ContentLength === 'number' ? objectMeta.ContentLength : null,
        mime_type: objectMeta.ContentType || 'application/octet-stream',
        is_verified: false,
        uploaded_by: authz.context.userId,
        storage_provider: 'b2' as const,
        storage_bucket: bucketName,
        storage_key: parsed.data.storageKey,
    };

    const { data: document, error: insertError } = await mutationClient
        .from('documents')
        .insert(insertPayload)
        .select('*')
        .single<Document>();

    if (insertError || !document) {
        console.error('Failed to create Backblaze-backed document record:', insertError);

        try {
            await deleteBackblazeObject(parsed.data.storageKey);
        } catch (cleanupError) {
            console.error('Failed to clean up Backblaze object after finalize error:', cleanupError);
        }

        return NextResponse.json({
            error: 'The file uploaded successfully, but the document record could not be saved.',
            details: insertError?.message || null,
        }, { status: 500 });
    }

    return NextResponse.json({
        data: {
            document,
            storagePath: parsed.data.storageKey,
        },
    });
}

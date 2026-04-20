import { createAdminServerClient } from '@/lib/supabase/server';
import { getSharpFutureConnection } from '@/lib/rto-integration/connection';
import { signPayload } from '@/lib/rto-integration/security';
import { buildDocumentStorageKey, LEGACY_SUPABASE_APPLICATIONS_BUCKET } from '@/lib/storage/applications-shared';
import { getBackblazeBucketName } from '@/lib/storage/applications-server';
import { putBackblazeObject } from '@/lib/storage/backblaze-server';
import type { Document, UserRole } from '@/types/database';

export type DocumentAccessRow = Pick<
    Document,
    'id'
    | 'application_id'
    | 'document_type'
    | 'file_name'
    | 'file_url'
    | 'notes'
    | 'mime_type'
    | 'storage_provider'
    | 'storage_bucket'
    | 'storage_key'
    | 'is_remote'
    | 'remote_source_url'
    | 'remote_url_expires_at'
    | 'remote_source_document_id'
    | 'remote_source_application_id'
    | 'remote_source_portal'
>;

export const DOCUMENT_VIEW_ROLES: UserRole[] = [
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

export const DOCUMENT_ACCESS_SELECT = 'id, application_id, document_type, file_name, file_url, notes, mime_type, storage_provider, storage_bucket, storage_key, is_remote, remote_source_url, remote_url_expires_at, remote_source_document_id, remote_source_application_id, remote_source_portal';

export async function ensureDocumentLocalized(input: {
    document: DocumentAccessRow;
    supabase: ReturnType<typeof createAdminServerClient>;
}): Promise<DocumentAccessRow> {
    if (!input.document.is_remote) {
        return input.document;
    }

    await localizeRemoteDocument(input);

    const { data: refreshedDocument, error } = await input.supabase
        .from('documents')
        .select(DOCUMENT_ACCESS_SELECT)
        .eq('id', input.document.id)
        .single<DocumentAccessRow>();

    if (error || !refreshedDocument) {
        throw new Error(error?.message || 'Failed to reload localized document.');
    }

    return refreshedDocument;
}

async function localizeRemoteDocument(input: {
    document: DocumentAccessRow;
    supabase: ReturnType<typeof createAdminServerClient>;
}) {
    const sourceUrl = await ensureRemoteSourceUrl(input);

    const response = await fetch(sourceUrl, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Remote document fetch failed with status ${response.status}.`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || input.document.mime_type || 'application/octet-stream';
    const storageKey = buildDocumentStorageKey({
        applicationId: input.document.application_id || 'remote-transfer',
        documentType: input.document.document_type,
        fileName: input.document.file_name,
    });

    let storageProvider: 'b2' | 'supabase' = 'b2';
    let storageBucket = getBackblazeBucketName();

    try {
        await putBackblazeObject({
            key: storageKey,
            body: Buffer.from(arrayBuffer),
            contentType,
            contentDisposition: `inline; filename="${input.document.file_name.replace(/"/g, '')}"`,
        });
    } catch (error) {
        let fallbackUpload = await input.supabase.storage
            .from(LEGACY_SUPABASE_APPLICATIONS_BUCKET)
            .upload(storageKey, Buffer.from(arrayBuffer), {
                contentType,
                upsert: true,
            });

        if (fallbackUpload.error?.message?.toLowerCase().includes('bucket not found')) {
            await input.supabase.storage.createBucket(LEGACY_SUPABASE_APPLICATIONS_BUCKET, {
                public: false,
                fileSizeLimit: 10 * 1024 * 1024,
                allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            });

            fallbackUpload = await input.supabase.storage
                .from(LEGACY_SUPABASE_APPLICATIONS_BUCKET)
                .upload(storageKey, Buffer.from(arrayBuffer), {
                    contentType,
                    upsert: true,
                });
        }

        if (fallbackUpload.error) {
            throw new Error(
                fallbackUpload.error.message
                || (error instanceof Error ? error.message : 'Remote document localization failed.')
            );
        }

        storageProvider = 'supabase';
        storageBucket = LEGACY_SUPABASE_APPLICATIONS_BUCKET;
    }

    const { error } = await input.supabase
        .from('documents')
        .update({
            file_url: storageKey,
            storage_provider: storageProvider,
            storage_bucket: storageBucket,
            storage_key: storageKey,
            is_remote: false,
            copied_to_local_at: new Date().toISOString(),
            remote_download_error: null,
        })
        .eq('id', input.document.id);

    if (error) {
        throw new Error(error.message);
    }
}

async function ensureRemoteSourceUrl(input: {
    document: DocumentAccessRow;
    supabase: ReturnType<typeof createAdminServerClient>;
}): Promise<string> {
    const expiresAt = input.document.remote_url_expires_at
        ? Date.parse(input.document.remote_url_expires_at)
        : Number.NaN;
    const sourceUrlStillValid = Boolean(
        input.document.remote_source_url
        && Number.isFinite(expiresAt)
        && expiresAt > Date.now() + (15 * 60 * 1000)
    );

    if (sourceUrlStillValid && input.document.remote_source_url) {
        return input.document.remote_source_url;
    }

    if (!input.document.remote_source_document_id) {
        if (!input.document.remote_source_url) {
            throw new Error('Remote document source URL is missing.');
        }

        return input.document.remote_source_url;
    }

    const connection = await getSharpFutureConnection(input.supabase as never);
    if (!connection?.transferSecret || !connection.sharp_future_base_url || !connection.sharp_future_rto_id) {
        throw new Error('Sharp Future connection is not available for remote document refresh.');
    }

    const rawPayload = JSON.stringify({
        rtoId: connection.sharp_future_rto_id,
        documentIds: [input.document.remote_source_document_id],
    });

    const response = await fetch(new URL('/api/documents/refresh-urls', connection.sharp_future_base_url).toString(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-rto-signature': signPayload(connection.transferSecret, rawPayload),
        },
        body: rawPayload,
        cache: 'no-store',
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(
            payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
                ? payload.error
                : `Remote URL refresh failed with status ${response.status}`
        );
    }

    const refreshedDocument = payload
        && typeof payload === 'object'
        && 'data' in payload
        && payload.data
        && typeof payload.data === 'object'
        && 'documents' in payload.data
        && Array.isArray(payload.data.documents)
        ? payload.data.documents[0] as { fileUrl?: string; remoteUrlExpiresAt?: string }
        : null;

    if (!refreshedDocument?.fileUrl || !refreshedDocument.remoteUrlExpiresAt) {
        throw new Error('Remote URL refresh response was incomplete.');
    }

    const { error } = await input.supabase
        .from('documents')
        .update({
            remote_source_url: refreshedDocument.fileUrl,
            remote_url_expires_at: refreshedDocument.remoteUrlExpiresAt,
        })
        .eq('id', input.document.id);

    if (error) {
        throw new Error(error.message);
    }

    return refreshedDocument.fileUrl;
}

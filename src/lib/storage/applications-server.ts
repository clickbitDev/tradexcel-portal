import type { Document, Qualification } from '@/types/database';
import type { createServerClient } from '@/lib/supabase/server';
import {
    createBackblazeDownloadUrl,
    deleteBackblazeObject,
    getBackblazeConfig,
    getBackblazeObjectBuffer,
} from '@/lib/storage/backblaze-server';
import {
    BACKBLAZE_STORAGE_PROVIDER,
    LEGACY_SUPABASE_APPLICATIONS_BUCKET,
    resolveDocumentStorageLocation,
    resolveQualificationPreviewStorageLocation,
    type ResolvedApplicationStorageLocation,
} from '@/lib/storage/applications-shared';

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

async function createLegacySupabaseDownloadUrl(
    supabase: ServerSupabaseClient,
    key: string,
    expiresIn = 3600
): Promise<string | null> {
    const { data, error } = await supabase.storage
        .from(LEGACY_SUPABASE_APPLICATIONS_BUCKET)
        .createSignedUrl(key, expiresIn);

    if (error || !data?.signedUrl) {
        return null;
    }

    return data.signedUrl;
}

async function downloadLegacySupabaseObject(
    supabase: ServerSupabaseClient,
    key: string
): Promise<{ buffer: Buffer; contentType: string | null; contentLength: number | null } | null> {
    const { data, error } = await supabase.storage
        .from(LEGACY_SUPABASE_APPLICATIONS_BUCKET)
        .download(key);

    if (error || !data) {
        return null;
    }

    return {
        buffer: Buffer.from(await data.arrayBuffer()),
        contentType: data.type || null,
        contentLength: data.size ?? null,
    };
}

async function downloadFromFallbackUrl(url: string): Promise<{ buffer: Buffer; contentType: string | null; contentLength: number | null }> {
    const response = await fetch(url).catch(() => null);
    if (!response || !response.ok) {
        throw new Error('Unable to download file from its fallback URL.');
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentLengthHeader = response.headers.get('content-length');

    return {
        buffer: Buffer.from(arrayBuffer),
        contentType: response.headers.get('content-type'),
        contentLength: contentLengthHeader ? Number(contentLengthHeader) : null,
    };
}

async function getResolvedStorageAccessUrl(
    location: ResolvedApplicationStorageLocation,
    supabase: ServerSupabaseClient,
    fileName?: string
): Promise<string> {
    if (location.provider === BACKBLAZE_STORAGE_PROVIDER) {
        return createBackblazeDownloadUrl({ key: location.key, fileName });
    }

    const legacyUrl = await createLegacySupabaseDownloadUrl(supabase, location.key);
    if (!legacyUrl) {
        throw new Error('Unable to generate a signed URL for the legacy Supabase file.');
    }

    return legacyUrl;
}

export async function getDocumentAccessUrl(
    document: Pick<Document, 'file_name' | 'file_url' | 'notes' | 'storage_provider' | 'storage_bucket' | 'storage_key'>,
    supabase: ServerSupabaseClient
): Promise<string> {
    const storageLocation = resolveDocumentStorageLocation(document);
    if (storageLocation) {
        return getResolvedStorageAccessUrl(storageLocation, supabase, document.file_name);
    }

    const fallbackUrl = document.file_url?.trim();
    if (fallbackUrl) {
        return fallbackUrl;
    }

    throw new Error('No accessible URL found for this document.');
}

export async function getDocumentBinary(
    document: Pick<Document, 'file_url' | 'notes' | 'storage_provider' | 'storage_bucket' | 'storage_key'>,
    supabase: ServerSupabaseClient
): Promise<{ buffer: Buffer; contentType: string | null; contentLength: number | null }> {
    const storageLocation = resolveDocumentStorageLocation(document);
    if (storageLocation) {
        if (storageLocation.provider === BACKBLAZE_STORAGE_PROVIDER) {
            return getBackblazeObjectBuffer(storageLocation.key);
        }

        const legacyFile = await downloadLegacySupabaseObject(supabase, storageLocation.key);
        if (legacyFile) {
            return legacyFile;
        }
    }

    const fallbackUrl = document.file_url?.trim();
    if (fallbackUrl) {
        return downloadFromFallbackUrl(fallbackUrl);
    }

    throw new Error('No downloadable file source found for this document.');
}

export async function getQualificationPreviewAccessUrl(
    qualification: Pick<Qualification, 'certificate_preview_path' | 'certificate_preview_provider' | 'certificate_preview_bucket' | 'certificate_preview_key'>,
    supabase: ServerSupabaseClient
): Promise<string | null> {
    const storageLocation = resolveQualificationPreviewStorageLocation(qualification);
    if (!storageLocation) {
        return null;
    }

    return getResolvedStorageAccessUrl(storageLocation, supabase);
}

export async function deleteApplicationStorageObject(input: {
    provider: 'supabase' | 'b2';
    key: string;
    supabase?: ServerSupabaseClient;
}): Promise<void> {
    if (input.provider === BACKBLAZE_STORAGE_PROVIDER) {
        await deleteBackblazeObject(input.key);
        return;
    }

    if (!input.supabase) {
        throw new Error('Supabase client is required to delete legacy storage objects.');
    }

    await input.supabase.storage
        .from(LEGACY_SUPABASE_APPLICATIONS_BUCKET)
        .remove([input.key]);
}

export function getBackblazeBucketName(): string {
    return getBackblazeConfig().bucketName;
}

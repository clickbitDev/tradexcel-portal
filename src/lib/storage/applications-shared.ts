import type { Document, Qualification } from '@/types/database';

export const LEGACY_SUPABASE_APPLICATIONS_BUCKET = 'applications';
export const BACKBLAZE_STORAGE_PROVIDER = 'b2';
export const SUPABASE_STORAGE_PROVIDER = 'supabase';

export type ApplicationStorageProvider = typeof BACKBLAZE_STORAGE_PROVIDER | typeof SUPABASE_STORAGE_PROVIDER;

type DocumentStorageFields = Pick<Document, 'file_url' | 'notes' | 'storage_provider' | 'storage_bucket' | 'storage_key'>;
type QualificationPreviewFields = Pick<Qualification, 'certificate_preview_path' | 'certificate_preview_provider' | 'certificate_preview_bucket' | 'certificate_preview_key'>;

export interface ResolvedApplicationStorageLocation {
    provider: ApplicationStorageProvider;
    bucket: string | null;
    key: string;
}

function safeTrim(value: string | null | undefined): string {
    return typeof value === 'string' ? value.trim() : '';
}

export function sanitizeStorageSegment(value: string): string {
    return value
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '')
        .replace(/_+/g, '_')
        .replace(/^[_-]+|[_-]+$/g, '')
        .slice(0, 120) || 'file';
}

function parseLegacySupabaseStoragePath(notes: string | null | undefined): string | null {
    const trimmedNotes = safeTrim(notes);
    if (!trimmedNotes.includes('storage_path:')) {
        return null;
    }

    const rawPath = trimmedNotes.slice(trimmedNotes.indexOf('storage_path:') + 'storage_path:'.length).trim();
    const parsedPath = rawPath.split(/\s+/)[0];
    return parsedPath || null;
}

function parseSupabaseStoragePathFromUrl(fileUrl: string | null | undefined): string | null {
    const trimmedUrl = safeTrim(fileUrl);
    if (!trimmedUrl) {
        return null;
    }

    if (!/^https?:\/\//i.test(trimmedUrl)) {
        return trimmedUrl;
    }

    try {
        const url = new URL(trimmedUrl);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/applications\/(.+)/);
        if (!pathMatch?.[1]) {
            return null;
        }

        return decodeURIComponent(pathMatch[1].split('?')[0]);
    } catch {
        return null;
    }
}

export function resolveLegacySupabaseObjectKey(record: Pick<DocumentStorageFields, 'file_url' | 'notes'>): string | null {
    return parseLegacySupabaseStoragePath(record.notes) || parseSupabaseStoragePathFromUrl(record.file_url);
}

export function resolveDocumentStorageLocation(record: DocumentStorageFields): ResolvedApplicationStorageLocation | null {
    if (record.storage_provider === BACKBLAZE_STORAGE_PROVIDER && safeTrim(record.storage_key)) {
        return {
            provider: BACKBLAZE_STORAGE_PROVIDER,
            bucket: safeTrim(record.storage_bucket) || null,
            key: safeTrim(record.storage_key),
        };
    }

    const supabaseKey = safeTrim(record.storage_key) || resolveLegacySupabaseObjectKey(record);
    if (supabaseKey) {
        return {
            provider: SUPABASE_STORAGE_PROVIDER,
            bucket: LEGACY_SUPABASE_APPLICATIONS_BUCKET,
            key: supabaseKey,
        };
    }

    return null;
}

export function resolveQualificationPreviewStorageLocation(record: QualificationPreviewFields): ResolvedApplicationStorageLocation | null {
    if (record.certificate_preview_provider === BACKBLAZE_STORAGE_PROVIDER && safeTrim(record.certificate_preview_key)) {
        return {
            provider: BACKBLAZE_STORAGE_PROVIDER,
            bucket: safeTrim(record.certificate_preview_bucket) || null,
            key: safeTrim(record.certificate_preview_key),
        };
    }

    const legacyKey = safeTrim(record.certificate_preview_key) || safeTrim(record.certificate_preview_path);
    if (legacyKey) {
        return {
            provider: SUPABASE_STORAGE_PROVIDER,
            bucket: LEGACY_SUPABASE_APPLICATIONS_BUCKET,
            key: legacyKey,
        };
    }

    return null;
}

export function buildDocumentStorageKey(input: {
    applicationId: string;
    documentType: string;
    fileName: string;
    timestamp?: number;
}): string {
    const timestamp = input.timestamp || Date.now();
    const sanitizedDocumentType = sanitizeStorageSegment(input.documentType.replace(/\//g, '_'));
    const sanitizedFileName = sanitizeStorageSegment(input.fileName);
    return `documents/${input.applicationId}/${timestamp}-${sanitizedDocumentType}-${sanitizedFileName}`;
}

export function buildQualificationPreviewStorageKey(input: {
    qualificationCode: string;
    fileName: string;
    timestamp?: number;
}): string {
    const timestamp = input.timestamp || Date.now();
    const sanitizedCode = sanitizeStorageSegment(input.qualificationCode.toUpperCase()) || 'qualification';
    const sanitizedFileName = sanitizeStorageSegment(input.fileName);
    return `qualification-previews/${sanitizedCode}/${timestamp}-${sanitizedFileName}`;
}

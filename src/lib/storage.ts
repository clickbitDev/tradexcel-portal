import { createClient } from '@/lib/supabase/client';
import type { Document } from '@/types/database';

export interface UploadResult {
    success: boolean;
    url?: string;
    path?: string;
    error?: string;
}

interface DocumentRecordResult {
    success: boolean;
    document?: Document;
    storagePath?: string;
    error?: string;
}

interface PendingDocumentUploadResult {
    success: boolean;
    uploaded: number;
    failed: number;
    errors: string[];
    documents: Document[];
}

interface PresignedUploadPayload {
    uploadUrl: string;
    storageKey: string;
    contentType: string;
    storageBucket?: string;
    storageProvider?: 'b2';
}

function resolveFileContentType(file: File): string {
    if (file.type) {
        return file.type;
    }

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.pdf')) {
        return 'application/pdf';
    }
    if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
        return 'image/jpeg';
    }
    if (lowerName.endsWith('.png')) {
        return 'image/png';
    }
    if (lowerName.endsWith('.webp')) {
        return 'image/webp';
    }
    if (lowerName.endsWith('.doc')) {
        return 'application/msword';
    }
    if (lowerName.endsWith('.docx')) {
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    if (lowerName.endsWith('.txt')) {
        return 'text/plain';
    }

    return 'application/octet-stream';
}

function getErrorMessage(payload: unknown, fallback: string): string {
    if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
        return payload.error;
    }

    return fallback;
}

async function parseJsonSafe(response: Response): Promise<unknown> {
    return response.json().catch(() => null);
}

async function uploadFileToPresignedUrl(input: {
    uploadUrl: string;
    file: File;
    contentType: string;
}): Promise<void> {
    try {
        const response = await fetch(input.uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': input.contentType,
            },
            body: input.file,
        });

        if (!response.ok) {
            const responseText = await response.text().catch(() => '');
            if (response.status === 403 && /cors/i.test(responseText)) {
                throw new Error('Backblaze rejected the upload because S3 CORS is not enabled for this origin. Allow PUT from your app origin in the bucket S3 CORS settings.');
            }

            throw new Error(responseText || 'Failed to upload file to storage.');
        }
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error('Direct upload to Backblaze failed before the server could respond. This is usually caused by missing S3 CORS rules or an incorrect BACKBLAZE_BUCKET_ENDPOINT.');
        }

        throw error;
    }
}

async function requestDocumentUploadUrl(input: {
    applicationId: string;
    documentType: string;
    file: File;
}): Promise<{ success: boolean; data?: PresignedUploadPayload; error?: string }> {
    const contentType = resolveFileContentType(input.file);
    const response = await fetch('/api/storage/documents/presign', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            applicationId: input.applicationId,
            documentType: input.documentType,
            fileName: input.file.name,
            contentType,
            fileSize: input.file.size,
        }),
    });

    const payload = await parseJsonSafe(response);
    if (!response.ok) {
        return {
            success: false,
            error: getErrorMessage(payload, 'Unable to prepare document upload.'),
        };
    }

    const data = payload && typeof payload === 'object' && 'data' in payload
        ? payload.data as PresignedUploadPayload
        : null;

    if (!data?.uploadUrl || !data.storageKey) {
        return {
            success: false,
            error: 'Document upload configuration is incomplete.',
        };
    }

    return { success: true, data };
}

async function finalizeDocumentUpload(input: {
    applicationId: string;
    documentType: string;
    fileName: string;
    storageKey: string;
}): Promise<DocumentRecordResult> {
    const response = await fetch('/api/storage/documents/finalize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
    });

    const payload = await parseJsonSafe(response);
    if (!response.ok) {
        return {
            success: false,
            error: getErrorMessage(payload, 'Unable to finalize document upload.'),
        };
    }

    const data = payload && typeof payload === 'object' && 'data' in payload
        ? payload.data as { document?: Document; storagePath?: string }
        : null;

    if (!data?.document) {
        return {
            success: false,
            error: 'Document upload completed, but the saved record was not returned.',
        };
    }

    return {
        success: true,
        document: data.document,
        storagePath: data.storagePath,
    };
}

/**
 * Upload a file to Backblaze via a pre-signed URL.
 */
export async function uploadDocument(
    file: File,
    applicationId: string,
    documentType: string
): Promise<UploadResult> {
    try {
        const presignResult = await requestDocumentUploadUrl({
            applicationId,
            documentType,
            file,
        });

        if (!presignResult.success || !presignResult.data) {
            return { success: false, error: presignResult.error };
        }

        await uploadFileToPresignedUrl({
            uploadUrl: presignResult.data.uploadUrl,
            file,
            contentType: presignResult.data.contentType,
        });

        return {
            success: true,
            url: presignResult.data.storageKey,
            path: presignResult.data.storageKey,
        };
    } catch (error) {
        console.error('Backblaze document upload error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to upload file',
        };
    }
}

/**
 * Upload document and create database record in one operation.
 */
export async function uploadAndRecordDocument(
    file: File,
    applicationId: string,
    documentType: string,
    storedFileName = file.name
): Promise<DocumentRecordResult> {
    const uploadResult = await uploadDocument(file, applicationId, documentType);

    if (!uploadResult.success || !uploadResult.path) {
        return { success: false, error: uploadResult.error };
    }

    return finalizeDocumentUpload({
        applicationId,
        documentType,
        fileName: storedFileName,
        storageKey: uploadResult.path,
    });
}

/**
 * Delete a document database record. Storage cleanup is provider-aware on the server route layer.
 */
export async function deleteDocument(documentId: string) {
    const supabase = createClient();
    const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

    if (error) {
        console.error('Error deleting document record:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Get a temporary access URL for a document record.
 */
export async function getDocumentAccessUrl(documentId: string): Promise<string> {
    const response = await fetch(`/api/storage/documents/${documentId}/access-url`, {
        method: 'GET',
        cache: 'no-store',
    });

    const payload = await parseJsonSafe(response);
    if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Unable to generate a temporary document URL.'));
    }

    const url = payload && typeof payload === 'object' && 'data' in payload && payload.data
        && typeof payload.data === 'object' && 'url' in payload.data
        ? payload.data.url
        : null;

    if (typeof url !== 'string' || url.length === 0) {
        throw new Error('Document access URL was not returned by the server.');
    }

    return url;
}

/**
 * Verify/approve a document.
 */
export async function verifyDocument(documentId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from('documents')
        .update({
            is_verified: true,
            verified_by: user?.id,
            verified_at: new Date().toISOString(),
        })
        .eq('id', documentId);

    if (error) {
        console.error('Error verifying document:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Sanitize a name for use in filenames.
 */
function sanitizeForFilename(name: string): string {
    return name
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .substring(0, 50);
}

/**
 * Generate a well-formatted filename for a document.
 */
export function generateDocumentFilename(
    studentFirstName: string,
    studentLastName: string,
    documentType: string,
    originalFilename: string
): string {
    const firstName = sanitizeForFilename(studentFirstName || 'Unknown');
    const lastName = sanitizeForFilename(studentLastName || 'Student');
    const docType = sanitizeForFilename(documentType.replace(/\//g, '_'));
    const ext = originalFilename.split('.').pop() || 'pdf';

    return `${firstName}_${lastName}_${docType}.${ext}`;
}

export async function uploadDocumentWithName(
    file: File,
    applicationId: string,
    documentType: string,
    studentFirstName: string,
    studentLastName: string
): Promise<UploadResult> {
    const formattedFilename = generateDocumentFilename(
        studentFirstName,
        studentLastName,
        documentType,
        file.name
    );

    const result = await uploadAndRecordDocument(
        file,
        applicationId,
        documentType,
        formattedFilename
    );

    return {
        success: result.success,
        url: result.storagePath,
        path: result.storagePath,
        error: result.error,
    };
}

export async function uploadAndRecordDocumentWithName(
    file: File,
    applicationId: string,
    documentType: string,
    studentFirstName: string,
    studentLastName: string
): Promise<DocumentRecordResult> {
    const formattedFilename = generateDocumentFilename(
        studentFirstName,
        studentLastName,
        documentType,
        file.name
    );

    return uploadAndRecordDocument(
        file,
        applicationId,
        documentType,
        formattedFilename
    );
}

export async function uploadPendingDocuments(
    files: Array<{ file: File; documentType: string }>,
    applicationId: string,
    studentFirstName: string,
    studentLastName: string
): Promise<PendingDocumentUploadResult> {
    const errors: string[] = [];
    const documents: Document[] = [];
    let uploaded = 0;
    let failed = 0;

    for (const { file, documentType } of files) {
        const result = await uploadAndRecordDocumentWithName(
            file,
            applicationId,
            documentType,
            studentFirstName,
            studentLastName
        );

        if (result.success && result.document) {
            uploaded++;
            documents.push(result.document);
        } else {
            failed++;
            errors.push(`${file.name}: ${result.error}`);
        }
    }

    return {
        success: failed === 0,
        uploaded,
        failed,
        errors,
        documents,
    };
}

export async function requestQualificationPreviewUpload(input: {
    qualificationCode: string;
    file: File;
}): Promise<{ success: boolean; storageKey?: string; storageBucket?: string; storageProvider?: 'b2'; error?: string }> {
    const contentType = resolveFileContentType(input.file);
    const response = await fetch('/api/storage/qualification-previews/presign', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            qualificationCode: input.qualificationCode,
            fileName: input.file.name,
            contentType,
            fileSize: input.file.size,
        }),
    });

    const payload = await parseJsonSafe(response);
    if (!response.ok) {
        return {
            success: false,
            error: getErrorMessage(payload, 'Unable to prepare qualification preview upload.'),
        };
    }

    const data = payload && typeof payload === 'object' && 'data' in payload
        ? payload.data as PresignedUploadPayload
        : null;

    if (!data?.uploadUrl || !data.storageKey) {
        return {
            success: false,
            error: 'Qualification preview upload configuration is incomplete.',
        };
    }

    try {
        await uploadFileToPresignedUrl({
            uploadUrl: data.uploadUrl,
            file: input.file,
            contentType: data.contentType,
        });

        return {
            success: true,
            storageKey: data.storageKey,
            storageBucket: 'storageBucket' in data && typeof data.storageBucket === 'string' ? data.storageBucket : undefined,
            storageProvider: 'storageProvider' in data && data.storageProvider === 'b2' ? 'b2' : undefined,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to upload qualification preview.',
        };
    }
}

export async function deleteQualificationPreviewObject(storageKey: string): Promise<void> {
    const response = await fetch('/api/storage/qualification-previews/object', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storageKey }),
    });

    const payload = await parseJsonSafe(response);
    if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Unable to delete the qualification preview object.'));
    }
}

/**
 * Document Extraction API Route
 * 
 * Server-side processing for document data extraction.
 * Receives a file from Supabase Storage and returns extracted data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest, getAuthenticatedUserContext } from '@/lib/access-control/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import type { DocumentType, ExtractionResult } from '@/lib/extraction/types';
import { extractPassportData } from '@/lib/extraction/extractors/passport';
import { extractResumeData } from '@/lib/extraction/extractors/resume';
import { extractUSIData } from '@/lib/extraction/extractors/usi';
import { extractTranscriptData } from '@/lib/extraction/extractors/transcript';
import type { UserRole } from '@/types/database';
import { getDocumentBinary } from '@/lib/storage/applications-server';

// Document types that support extraction
const EXTRACTABLE_TYPES: DocumentType[] = [
    'Passport',
    'Visa',
    'Transcript',
    'Resume/CV',
    'USI',
    'English Test',
];

const EXTRACT_ALLOWED_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'developer',
    'agent',
];

/**
 * Extract text from a PDF buffer using pdf-parse
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParseModule = await import('pdf-parse') as any;
    const pdfParse = typeof pdfParseModule.default === 'function'
        ? pdfParseModule.default
        : pdfParseModule;
    const data = await pdfParse(buffer);
    return data.text;
}

/**
 * Extract text from a DOCX buffer using mammoth
 */
async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
}

/**
 * Extract text from an image buffer using Tesseract.js
 */
async function extractTextFromImage(buffer: Buffer): Promise<string> {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');

    try {
        const { data: { text } } = await worker.recognize(buffer);
        return text;
    } finally {
        await worker.terminate();
    }
}

/**
 * Route extraction to the appropriate extractor based on document type
 */
function routeExtraction(text: string, documentType: DocumentType): ExtractionResult {
    switch (documentType) {
        case 'Passport':
        case 'Visa':
            return extractPassportData(text);
        case 'Resume/CV':
            return extractResumeData(text);
        case 'USI':
            return extractUSIData(text);
        case 'Transcript':
        case 'English Test':
            return extractTranscriptData(text);
        default:
            return {
                documentType,
                status: 'skipped',
                overallConfidence: 0,
                fields: {},
                error: `Extraction not supported for document type: ${documentType}`,
            };
    }
}

export async function POST(request: NextRequest) {
    try {
        const authContext = await getAuthenticatedUserContext();
        if (!authContext.ok) {
            return authContext.response;
        }

        if (!EXTRACT_ALLOWED_ROLES.includes(authContext.context.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Parse request body
        const body = await request.json();
        const { documentId, documentType } = body as {
            documentId: string;
            documentType: DocumentType;
        };

        if (!documentId || !documentType) {
            return NextResponse.json(
                { error: 'Missing required fields: documentId, documentType' },
                { status: 400 }
            );
        }

        let lookupClient;
        try {
            lookupClient = createAdminServerClient();
        } catch {
            lookupClient = authContext.context.supabase;
        }

        const { data: documentRecord, error: documentLookupError } = await lookupClient
            .from('documents')
            .select('id, application_id, document_type, file_name, file_url, notes, storage_provider, storage_bucket, storage_key, mime_type')
            .eq('id', documentId)
            .maybeSingle<{
                id: string;
                application_id: string | null;
                document_type: string;
                file_name: string;
                file_url: string;
                notes: string | null;
                storage_provider: 'supabase' | 'b2' | null;
                storage_bucket: string | null;
                storage_key: string | null;
                mime_type: string | null;
            }>();

        if (documentLookupError || !documentRecord || !documentRecord.application_id) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        const authz = await authorizeApiRequest({
            request,
            resource: 'application',
            action: 'view',
            applicationId: documentRecord.application_id,
            allowedRoles: EXTRACT_ALLOWED_ROLES,
        });
        if (!authz.ok) {
            return authz.response;
        }

        const supabase = authz.context.supabase;

        // Check if document type supports extraction
        if (!EXTRACTABLE_TYPES.includes(documentType)) {
            return NextResponse.json({
                documentType,
                status: 'skipped',
                overallConfidence: 0,
                fields: {},
                error: `Extraction not supported for document type: ${documentType}`,
            });
        }

        // Update extraction status to processing
        await supabase
            .from('documents')
            .update({ extraction_status: 'processing' })
            .eq('id', documentId);

        let fileBinary;
        try {
            fileBinary = await getDocumentBinary(documentRecord, supabase);
        } catch (downloadError) {
            await supabase
                .from('documents')
                .update({
                    extraction_status: 'failed',
                    extraction_error: downloadError instanceof Error ? downloadError.message : 'Failed to download file',
                })
                .eq('id', documentId);

            return NextResponse.json(
                { error: 'Failed to download file from storage' },
                { status: 500 }
            );
        }

        // Convert blob to buffer
        const buffer = fileBinary.buffer;
        const mimeType = (documentRecord.mime_type || fileBinary.contentType || '').toLowerCase();

        if (!mimeType) {
            await supabase
                .from('documents')
                .update({
                    extraction_status: 'failed',
                    extraction_error: 'Missing file content type',
                })
                .eq('id', documentId);

            return NextResponse.json(
                { error: 'Unable to determine file type for extraction' },
                { status: 500 }
            );
        }

        // Extract text based on file type
        let text: string;
        try {
            if (mimeType === 'application/pdf') {
                text = await extractTextFromPDF(buffer);
            } else if (
                mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                mimeType === 'application/msword'
            ) {
                text = await extractTextFromDOCX(buffer);
            } else if (mimeType.startsWith('image/')) {
                text = await extractTextFromImage(buffer);
            } else {
                throw new Error(`Unsupported file type: ${mimeType}`);
            }
        } catch (extractError) {
            const errorMessage = extractError instanceof Error ? extractError.message : 'Text extraction failed';

            await supabase
                .from('documents')
                .update({
                    extraction_status: 'failed',
                    extraction_error: errorMessage
                })
                .eq('id', documentId);

            return NextResponse.json(
                { error: errorMessage },
                { status: 500 }
            );
        }

        // Run document-type-specific extraction
        const result = routeExtraction(text, documentType);

        // Store extraction result in database
        await supabase
            .from('documents')
            .update({
                extraction_status: result.status,
                extracted_data: result,
                extraction_error: result.error || null,
                extracted_at: new Date().toISOString(),
            })
            .eq('id', documentId);

        return NextResponse.json(result);

    } catch (error) {
        console.error('Extraction API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

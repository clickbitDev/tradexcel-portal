/**
 * Document Extraction Service
 * 
 * Main entry point for document data extraction.
 * Routes documents to appropriate extractors based on document type.
 */

import type {
    DocumentType,
    ExtractionResult,
    ApplicationFieldMapping,
    ExtractedField
} from './types';
import { extractPassportData } from './extractors/passport';
import { extractResumeData } from './extractors/resume';
import { extractUSIData } from './extractors/usi';
import { extractTranscriptData } from './extractors/transcript';
import { extractDriverLicenseData } from './extractors/license';

// Document types that support extraction
const EXTRACTABLE_TYPES: DocumentType[] = [
    'Passport',
    'Visa',
    'Driver License',
    'Transcript',
    'Resume/CV',
    'USI',
    'English Test',
];

/**
 * Check if a document type supports data extraction
 */
export function isExtractable(documentType: DocumentType): boolean {
    return EXTRACTABLE_TYPES.includes(documentType);
}

/**
 * Extract text from a PDF file using pdfjs-dist (browser-compatible)
 */
async function extractTextFromPDF(file: File): Promise<string> {
    const pdfjsLib = await import('pdfjs-dist');

    // Set worker source using unpkg CDN (more reliable)
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
    }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((item: any) => item.str || '')
            .join(' ');
        fullText += pageText + '\n';
    }

    return fullText;
}

/**
 * Extract text from a DOCX file using mammoth
 */
async function extractTextFromDOCX(file: File): Promise<string> {
    const mammoth = await import('mammoth');
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
}

/**
 * Preprocess image for OCR - resize large images for better accuracy and speed
 * Tesseract works best with images around 1000-2000px
 */
async function preprocessImage(file: File, maxDimension: number = 1500): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            let { width, height } = img;
            console.log(`[OCR] Original image dimensions: ${width}x${height}`);

            // Calculate new dimensions if image is too large
            if (width > maxDimension || height > maxDimension) {
                const scale = Math.min(maxDimension / width, maxDimension / height);
                width = Math.round(width * scale);
                height = Math.round(height * scale);
                console.log(`[OCR] Resizing to: ${width}x${height}`);
            }

            // Create canvas and draw resized image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            // Fill with white background (helps OCR)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);

            // Draw image
            ctx.drawImage(img, 0, 0, width, height);

            // Optional: Increase contrast for better OCR
            // This can help with license cards that have subtle text
            try {
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;

                // Simple contrast enhancement
                const factor = 1.2; // Slightly increase contrast
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.min(255, Math.max(0, ((data[i] - 128) * factor) + 128));     // R
                    data[i + 1] = Math.min(255, Math.max(0, ((data[i + 1] - 128) * factor) + 128)); // G
                    data[i + 2] = Math.min(255, Math.max(0, ((data[i + 2] - 128) * factor) + 128)); // B
                }

                ctx.putImageData(imageData, 0, 0);
            } catch (e) {
                console.warn('[OCR] Could not apply contrast enhancement:', e);
            }

            // Convert to blob with good quality
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        console.log(`[OCR] Preprocessed image size: ${(blob.size / 1024).toFixed(1)}KB`);
                        resolve(blob);
                    } else {
                        reject(new Error('Could not convert canvas to blob'));
                    }
                },
                'image/jpeg',
                0.9
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Could not load image for preprocessing'));
        };

        img.src = url;
    });
}

/**
 * Extract text from an image using Tesseract.js OCR
 * Improved with image preprocessing, better error handling, logging, and timeout
 */
async function extractTextFromImage(file: File): Promise<string> {
    console.log('[OCR] Starting image extraction for:', file.name, 'Type:', file.type, 'Size:', file.size);

    // Timeout wrapper for the entire OCR operation (90 seconds should be plenty with preprocessing)
    const timeoutMs = 90000;
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('OCR timeout - image processing took too long')), timeoutMs);
    });

    const ocrPromise = (async () => {
        try {
            // Preprocess large images for better OCR results
            let imageSource: Blob | File = file;
            if (file.size > 500 * 1024) { // > 500KB - preprocess
                console.log('[OCR] Preprocessing image for better OCR accuracy...');
                imageSource = await preprocessImage(file, 1500);
            }

            console.log('[OCR] Importing Tesseract.js module...');
            const Tesseract = await import('tesseract.js');
            console.log('[OCR] Tesseract.js module loaded successfully');
            const { createWorker } = Tesseract;

            // Create worker with explicit logging
            console.log('[OCR] Creating Tesseract worker...');
            const worker = await createWorker('eng', 1, {
                logger: (m: { status: string; progress: number }) => {
                    if (m.progress > 0) {
                        console.log(`[OCR] Status: ${m.status}, Progress: ${Math.round(m.progress * 100)}%`);
                    }
                },
            });
            console.log('[OCR] Worker created successfully');

            try {
                console.log('[OCR] Starting text recognition...');

                // Convert to blob URL for Tesseract
                const blobUrl = URL.createObjectURL(imageSource);

                const { data: { text } } = await worker.recognize(blobUrl);

                URL.revokeObjectURL(blobUrl);

                console.log('[OCR] Extracted text length:', text.length);
                console.log('[OCR] First 500 chars:', text.substring(0, 500));
                return text;
            } finally {
                await worker.terminate();
                console.log('[OCR] Worker terminated');
            }
        } catch (error) {
            console.error('[OCR] Image extraction failed:', error);
            throw new Error(`Image OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    })();

    return Promise.race([ocrPromise, timeoutPromise]);
}

/**
 * Extract text from a file based on its MIME type
 */
export async function extractText(file: File): Promise<string> {
    const mimeType = file.type.toLowerCase();

    if (mimeType === 'application/pdf') {
        return extractTextFromPDF(file);
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword') {
        return extractTextFromDOCX(file);
    }

    if (mimeType.startsWith('image/')) {
        return extractTextFromImage(file);
    }

    throw new Error(`Unsupported file type: ${mimeType}`);
}

/**
 * Route extraction to the appropriate extractor based on document type
 */
function routeExtraction(text: string, documentType: DocumentType): ExtractionResult {
    switch (documentType) {
        case 'Passport':
        case 'Visa':
            return extractPassportData(text);

        case 'Driver License':
            return extractDriverLicenseData(text);

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
                rawText: text,
                error: `Extraction not supported for document type: ${documentType}`,
            };
    }
}

/**
 * Main extraction function
 * Extracts text from a file and runs document-type-specific extraction
 */
export async function extractDocumentData(
    file: File,
    documentType: DocumentType
): Promise<ExtractionResult> {
    if (!isExtractable(documentType)) {
        return {
            documentType,
            status: 'skipped',
            overallConfidence: 0,
            fields: {},
            error: `Extraction not supported for document type: ${documentType}`,
        };
    }

    try {
        const text = await extractText(file);
        const result = routeExtraction(text, documentType);
        return {
            ...result,
            documentType, // Ensure correct document type is returned
        };
    } catch (error) {
        return {
            documentType,
            status: 'failed',
            overallConfidence: 0,
            fields: {},
            error: error instanceof Error ? error.message : 'Unknown extraction error',
        };
    }
}

/**
 * Map extracted fields to application database columns
 */
export function mapToApplicationFields(result: ExtractionResult): ApplicationFieldMapping {
    const mapping: ApplicationFieldMapping = {};
    const fields = result.fields;

    // Helper to get high-confidence values only (>= 70%)
    const getValue = (field: ExtractedField | undefined, minConfidence = 0.70): string | undefined => {
        if (!field || field.confidence < minConfidence) return undefined;
        return field.value;
    };

    switch (result.documentType) {
        case 'Passport':
        case 'Visa':
            mapping.student_first_name = getValue(fields.first_name);
            mapping.student_last_name = getValue(fields.last_name);
            mapping.student_dob = getValue(fields.dob);
            mapping.student_nationality = getValue(fields.nationality);
            mapping.student_passport_number = getValue(fields.passport_number);
            if (result.documentType === 'Visa') {
                mapping.student_visa_number = getValue(fields.visa_number);
                mapping.student_visa_grant_date = getValue(fields.visa_grant_date);
                mapping.student_visa_expiry = getValue(fields.expiry_date);
            }
            break;

        case 'Resume/CV':
            mapping.student_first_name = getValue(fields.first_name);
            mapping.student_last_name = getValue(fields.last_name);
            mapping.student_email = getValue(fields.email);
            mapping.student_phone = getValue(fields.phone);
            mapping.student_address = getValue(fields.address);
            break;

        case 'Driver License':
            console.log('[Field Mapping] Mapping Driver License fields...');
            console.log('[Field Mapping] Available fields:', Object.keys(fields));
            // Use lower confidence for license (OCR on IDs is challenging)
            mapping.student_first_name = getValue(fields.first_name, 0.50);
            mapping.student_last_name = getValue(fields.last_name, 0.50);
            mapping.student_dob = getValue(fields.dob, 0.50);
            mapping.student_address = getValue(fields.address, 0.50);
            console.log('[Field Mapping] Mapped fields:', mapping);
            break;

        case 'USI':
            mapping.student_usi = getValue(fields.usi_number);
            break;

        case 'Transcript':
        case 'English Test':
            // Transcripts typically provide reference info, not primary student data
            // The student_name can be used for verification
            break;
    }

    // Remove undefined values
    return Object.fromEntries(
        Object.entries(mapping).filter(([_, v]) => v !== undefined)
    ) as ApplicationFieldMapping;
}

/**
 * Get confidence level label
 */
export function getConfidenceLabel(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 0.90) return 'high';
    if (confidence >= 0.70) return 'medium';
    return 'low';
}

/**
 * Format confidence as percentage
 */
export function formatConfidence(confidence: number): string {
    return `${Math.round(confidence * 100)}%`;
}

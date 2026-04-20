'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
    Upload,
    X,
    FileText,
    CheckCircle,
    AlertCircle,
    Loader2,
    FileSearch,
    Sparkles
} from 'lucide-react';
import { uploadAndRecordDocument } from '@/lib/storage';
import { logActivity } from '@/lib/activity-logger';
import { ExtractionReview } from './ExtractionReview';
import type { ExtractionResult, ApplicationFieldMapping, DocumentType } from '@/lib/extraction/types';
import type { Document } from '@/types/database';

type UploadDocumentType = DocumentType | 'Certificate';

// Document types that support server-side extraction
const EXTRACTABLE_TYPES: DocumentType[] = [
    'Passport',
    'Visa',
    'Transcript',
    'Resume/CV',
    'USI',
    'English Test',
];

function isExtractable(documentType: UploadDocumentType): documentType is DocumentType {
    return EXTRACTABLE_TYPES.includes(documentType as DocumentType);
}

// Call server-side extraction API
async function extractViaServer(
    documentId: string,
    documentType: DocumentType,
): Promise<ExtractionResult> {
    const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            documentId,
            documentType,
        }),
    });

    if (!response.ok) {
        throw new Error('Extraction request failed');
    }

    return response.json();
}

const DEFAULT_DOCUMENT_TYPES: UploadDocumentType[] = [
    'Passport',
    'Visa',
    'Transcript',
    'English Test',
    'TAS',
    'LLN Management',
    'Photo',
    'Resume/CV',
    'Offer Letter',
    'CoE',
    'Student Assessment Report',
    'Assessment Meeting Record',
    'USI',
    'Evaluation File',
    'Other',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    mp4: 'video/mp4',
};

function resolveUploadMimeType(file: File): string {
    const browserMimeType = (file.type || '').toLowerCase();

    if (browserMimeType && browserMimeType !== 'application/octet-stream') {
        return browserMimeType;
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return MIME_TYPES_BY_EXTENSION[extension] || browserMimeType;
}

function supportsServerExtraction(file: File): boolean {
    const mimeType = resolveUploadMimeType(file);

    return mimeType === 'application/pdf'
        || mimeType === 'application/msword'
        || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        || mimeType.startsWith('image/');
}

interface DocumentUploadProps {
    applicationId: string;
    onUploadComplete?: (document: Document) => void;
    onError?: (error: string) => void;
    onFieldsExtracted?: (fields: ApplicationFieldMapping) => void;
    documentTypes?: UploadDocumentType[];
    validateSelectedFile?: (file: File, documentType: UploadDocumentType) => string | null;
    acceptedMimeTypes?: string[];
    maxFileSize?: number;
}

interface FileUpload {
    file: File;
    documentType: UploadDocumentType;
    status: 'pending' | 'uploading' | 'extracting' | 'success' | 'error';
    progress: number;
    error?: string;
    extractionResult?: ExtractionResult;
}

export function DocumentUpload({
    applicationId,
    onUploadComplete,
    onError,
    onFieldsExtracted,
    documentTypes,
    validateSelectedFile,
    acceptedMimeTypes,
    maxFileSize,
}: DocumentUploadProps) {
    const [files, setFiles] = useState<FileUpload[]>([]);
    const [documentType, setDocumentType] = useState<UploadDocumentType | ''>('');
    const [isDragging, setIsDragging] = useState(false);
    const [showExtractionReview, setShowExtractionReview] = useState(false);
    const [currentExtractionResult, setCurrentExtractionResult] = useState<ExtractionResult | null>(null);
    const [isApplyingFields, setIsApplyingFields] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const availableDocumentTypes = documentTypes && documentTypes.length > 0 ? documentTypes : DEFAULT_DOCUMENT_TYPES;
    const uploadMimeTypes = acceptedMimeTypes && acceptedMimeTypes.length > 0
        ? acceptedMimeTypes.map((mimeType) => mimeType.toLowerCase())
        : ALLOWED_TYPES;
    const effectiveMaxFileSize = maxFileSize ?? MAX_FILE_SIZE;
    const allowsOnlyPdf = uploadMimeTypes.length === 1 && uploadMimeTypes[0] === 'application/pdf';
    const allowsOnlyMp4 = uploadMimeTypes.length === 1 && uploadMimeTypes[0] === 'video/mp4';
    const allowsVideoFiles = uploadMimeTypes.includes('video/mp4');
    const allowsTextFiles = uploadMimeTypes.includes('text/plain');
    const uploadFormatsLabel = allowsOnlyPdf
        ? 'PDF up to 10MB'
        : allowsOnlyMp4
            ? `MP4 up to ${Math.round(effectiveMaxFileSize / 1024 / 1024)}MB`
        : allowsTextFiles
            ? `PDF, Images, Word docs, Text files up to ${Math.round(effectiveMaxFileSize / 1024 / 1024)}MB`
            : allowsVideoFiles
                ? `PDF, Images, Word docs, MP4 up to ${Math.round(effectiveMaxFileSize / 1024 / 1024)}MB`
                : `PDF, Images, Word docs up to ${Math.round(effectiveMaxFileSize / 1024 / 1024)}MB`;
    const unsupportedFileTypeMessage = allowsOnlyPdf
        ? 'File type not supported. Please upload a PDF document.'
        : allowsOnlyMp4
            ? 'File type not supported. Please upload an MP4 video file.'
        : allowsTextFiles
            ? 'File type not supported. Please upload PDF, images, Word documents, or text files.'
            : allowsVideoFiles
                ? 'File type not supported. Please upload PDF, images, Word documents, or MP4 files.'
                : 'File type not supported. Please upload PDF, images, or Word documents.';

    const validateFile = useCallback((file: File, selectedDocumentType: UploadDocumentType): string | null => {
        if (file.size > effectiveMaxFileSize) {
            return `File too large. Maximum size is ${Math.round(effectiveMaxFileSize / 1024 / 1024)}MB`;
        }
        const mimeType = resolveUploadMimeType(file);
        const isAcceptedByMimeType = uploadMimeTypes.includes(mimeType);

        if (!isAcceptedByMimeType) {
            return unsupportedFileTypeMessage;
        }

        if (validateSelectedFile) {
            return validateSelectedFile(file, selectedDocumentType);
        }

        return null;
    }, [effectiveMaxFileSize, unsupportedFileTypeMessage, uploadMimeTypes, validateSelectedFile]);

    const addFiles = useCallback((newFiles: FileList | File[]) => {
        if (!documentType) {
            onError?.('Please select a document type first');
            return;
        }

        const filesToAdd: FileUpload[] = [];

        for (const file of Array.from(newFiles)) {
            const error = validateFile(file, documentType);
            if (error) {
                onError?.(error);
                continue;
            }
            filesToAdd.push({
                file,
                documentType,
                status: 'pending',
                progress: 0,
            });
        }

        setFiles((prev) => [...prev, ...filesToAdd]);
    }, [documentType, onError, validateFile]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        addFiles(e.dataTransfer.files);
    }, [addFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const uploadFile = async (index: number) => {
        const fileUpload = files[index];
        if (!fileUpload || fileUpload.status !== 'pending') return;

        // Update status to uploading
        setFiles((prev) => prev.map((f, i) =>
            i === index ? { ...f, status: 'uploading', progress: 30 } : f
        ));

        try {
            const result = await uploadAndRecordDocument(
                fileUpload.file,
                applicationId,
                fileUpload.documentType
            );

            if (result.success && result.document) {
                // Check if extraction is supported for this document type
                if (isExtractable(fileUpload.documentType) && supportsServerExtraction(fileUpload.file)) {
                    setFiles((prev) => prev.map((f, i) =>
                        i === index ? { ...f, status: 'extracting', progress: 60 } : f
                    ));

                    try {
                        // Call server-side extraction API
                        const extractionResult = await extractViaServer(
                            result.document.id,
                            fileUpload.documentType,
                        );

                        setFiles((prev) => prev.map((f, i) =>
                            i === index ? {
                                ...f,
                                status: 'success',
                                progress: 100,
                                extractionResult
                            } : f
                        ));

                        // If extraction found fields, show the review UI
                        if (extractionResult.status === 'completed' &&
                            Object.keys(extractionResult.fields).length > 0) {
                            setCurrentExtractionResult(extractionResult);
                            setShowExtractionReview(true);
                        }
                    } catch {
                        // Extraction failed, but upload succeeded
                        setFiles((prev) => prev.map((f, i) =>
                            i === index ? { ...f, status: 'success', progress: 100 } : f
                        ));
                    }
                } else {
                    // Non-extractable document type - just mark as success
                    setFiles((prev) => prev.map((f, i) =>
                        i === index ? { ...f, status: 'success', progress: 100 } : f
                    ));
                }

                onUploadComplete?.(result.document);

                // Log activity
                await logActivity({
                    applicationId,
                    action: 'document_uploaded',
                    fieldChanged: 'documents',
                    newValue: `${fileUpload.documentType}: ${result.document.file_name}`,
                    metadata: { documentId: result.document.id, fileName: result.document.file_name }
                });
            } else {
                setFiles((prev) => prev.map((f, i) =>
                    i === index ? { ...f, status: 'error', error: result.error } : f
                ));
                onError?.(result.error || 'Upload failed');
            }
        } catch {
            setFiles((prev) => prev.map((f, i) =>
                i === index ? { ...f, status: 'error', error: 'Upload failed' } : f
            ));
            onError?.('Upload failed');
        }
    };

    const uploadAll = async () => {
        for (let i = 0; i < files.length; i++) {
            if (files[i].status === 'pending') {
                await uploadFile(i);
            }
        }
    };

    const handleApplyExtractedFields = (fields: ApplicationFieldMapping) => {
        setIsApplyingFields(true);
        try {
            onFieldsExtracted?.(fields);
            setShowExtractionReview(false);
            setCurrentExtractionResult(null);
        } finally {
            setIsApplyingFields(false);
        }
    };

    const handleCancelExtraction = () => {
        setShowExtractionReview(false);
        setCurrentExtractionResult(null);
    };

    const pendingCount = files.filter((file) => file.status === 'pending').length;
    const canExtract = documentType !== '' && isExtractable(documentType);

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getStatusIcon = (status: FileUpload['status']) => {
        switch (status) {
            case 'uploading':
                return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
            case 'extracting':
                return <FileSearch className="h-4 w-4 animate-pulse text-blue-500" />;
            case 'success':
                return <CheckCircle className="h-5 w-5 text-green-600" />;
            case 'error':
                return <AlertCircle className="h-5 w-5 text-red-600" />;
            default:
                return null;
        }
    };

    const getStatusText = (status: FileUpload['status']) => {
        switch (status) {
            case 'extracting':
                return 'Extracting data...';
            case 'uploading':
                return 'Uploading...';
            default:
                return null;
        }
    };

    return (
        <div className="space-y-4">
            {/* Extraction Review Modal */}
            {showExtractionReview && currentExtractionResult && (
                <div className="mb-4">
                    <ExtractionReview
                        result={currentExtractionResult}
                        onApply={handleApplyExtractedFields}
                        onCancel={handleCancelExtraction}
                        isApplying={isApplyingFields}
                    />
                </div>
            )}

            {/* Document Type Selector */}
            <div className="flex gap-4">
                <Select value={documentType} onValueChange={(value) => setDocumentType(value as UploadDocumentType)}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                        {availableDocumentTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                                <div className="flex items-center gap-2">
                                    {type}
                                    {isExtractable(type) && (
                                        <Sparkles className="h-3 w-3 text-amber-500" />
                                    )}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!documentType}
                >
                    <Upload className="h-4 w-4 mr-2" />
                    Select Files
                </Button>

                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    accept={uploadMimeTypes.join(',')}
                    onChange={(e) => e.target.files && addFiles(e.target.files)}
                />
            </div>

            {/* Extraction info badge */}
            {canExtract && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span>
                        Data extraction available for {documentType}.
                        Extracted data can be used to auto-fill the application form.
                    </span>
                </div>
            )}

            {/* Drop Zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                    } ${!documentType ? 'opacity-50' : ''}`}
            >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                    {documentType
                        ? `Drag and drop ${documentType} files here`
                        : 'Select a document type first'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    {uploadFormatsLabel}
                </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-2">
                    {files.map((fileUpload, index) => (
                        <div
                            key={index}
                            className={`flex items-center gap-3 p-3 rounded-lg border ${fileUpload.status === 'success' ? 'bg-green-50 border-green-200' :
                                fileUpload.status === 'error' ? 'bg-red-50 border-red-200' :
                                    fileUpload.status === 'extracting' ? 'bg-blue-50 border-blue-200' :
                                        'bg-muted/50'
                                }`}
                        >
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                <FileText className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{fileUpload.file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {fileUpload.documentType} • {formatFileSize(fileUpload.file.size)}
                                    {getStatusText(fileUpload.status) && (
                                        <span className="ml-2 text-primary">
                                            {getStatusText(fileUpload.status)}
                                        </span>
                                    )}
                                </p>
                                {(fileUpload.status === 'uploading' || fileUpload.status === 'extracting') && (
                                    <Progress value={fileUpload.progress} className="mt-1 h-1" />
                                )}
                                {fileUpload.error && (
                                    <p className="text-xs text-red-600 mt-1">{fileUpload.error}</p>
                                )}
                                {fileUpload.extractionResult?.status === 'completed' && (
                                    <p className="text-xs text-green-600 mt-1">
                                        ✓ {Object.keys(fileUpload.extractionResult.fields).length} fields extracted
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {fileUpload.status === 'pending' && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => uploadFile(index)}
                                    >
                                        Upload
                                    </Button>
                                )}
                                {getStatusIcon(fileUpload.status)}
                                {fileUpload.status !== 'uploading' && fileUpload.status !== 'extracting' && (
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => removeFile(index)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Upload All Button */}
                    {pendingCount > 0 && (
                        <Button onClick={uploadAll} className="w-full">
                            <Upload className="h-4 w-4 mr-2" />
                            Upload All ({pendingCount} files)
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

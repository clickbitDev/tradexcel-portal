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
    FileSearch,
    Sparkles,
    Plus
} from 'lucide-react';
import { extractDocumentData, mapToApplicationFields } from '@/lib/extraction';
import type { ExtractionResult, ApplicationFieldMapping, DocumentType } from '@/lib/extraction/types';

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

const DOCUMENT_TYPES: DocumentType[] = [
    'Passport',
    'Visa',
    'Driver License',
    'Transcript',
    'English Test',
    'TAS',
    'LLN Management',
    'Photo',
    'Resume/CV',
    'Offer Letter',
    'CoE',
    'USI',
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
    'text/plain',
];

// File info to be passed to parent for saving
export interface PendingFile {
    file: File;
    documentType: DocumentType;
}

interface SmartExtractUploadProps {
    onFieldsExtracted?: (fields: ApplicationFieldMapping) => void;
    onFilesReady?: (files: PendingFile[]) => void;
    onError?: (error: string) => void;
}

interface FileUpload {
    file: File;
    documentType: DocumentType | '';
    status: 'pending' | 'extracting' | 'success' | 'error';
    progress: number;
    error?: string;
    extractionResult?: ExtractionResult;
}

/**
 * Smart extraction-only upload component for new applications.
 * This component extracts data from documents without storing them.
 * Documents can be uploaded properly after the application is created.
 * 
 * NEW: Allows uploading multiple files and assigning document types per file.
 */
export function SmartExtractUpload({
    onFieldsExtracted,
    onFilesReady,
    onError,
}: SmartExtractUploadProps) {
    const [files, setFiles] = useState<FileUpload[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateFile = (file: File): string | null => {
        if (file.size > MAX_FILE_SIZE) {
            const actualSize = (file.size / 1024 / 1024).toFixed(2);
            return `File too large (${actualSize}MB). Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`;
        }

        // Check MIME type, with fallback to extension-based detection
        let mimeType = file.type;
        if (!mimeType || mimeType === '' || mimeType === 'application/octet-stream') {
            // Fallback: determine type from extension
            const ext = file.name.split('.').pop()?.toLowerCase();
            const extToMime: Record<string, string> = {
                'pdf': 'application/pdf',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'webp': 'image/webp',
                'doc': 'application/msword',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'txt': 'text/plain',
            };
            mimeType = ext ? extToMime[ext] || '' : '';
        }

        if (!mimeType || !ALLOWED_TYPES.includes(mimeType)) {
            const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown';
            return `File type not supported (.${ext}). Please upload PDF, images (JPG, PNG, WebP), Word documents, or text files.`;
        }
        return null;
    };

    const isExtractable = (type: DocumentType | ''): boolean => {
        if (!type) return false;
        return EXTRACTABLE_TYPES.includes(type as DocumentType);
    };

    // Guess document type from filename
    const guessDocumentType = (filename: string): DocumentType | '' => {
        const lower = filename.toLowerCase();
        if (lower.includes('passport')) return 'Passport';
        if (lower.includes('visa')) return 'Visa';
        if (lower.includes('license') || lower.includes('licence') || lower.includes('driver')) return 'Driver License';
        if (lower.includes('resume') || lower.includes('cv')) return 'Resume/CV';
        if (lower.includes('transcript')) return 'Transcript';
        if (lower.includes('usi')) return 'USI';
        if (lower.includes('ielts') || lower.includes('pte') || lower.includes('english')) return 'English Test';
        if (lower.includes('photo') || lower.includes('headshot') || lower.includes('portrait')) return 'Photo';
        if (lower.includes('offer')) return 'Offer Letter';
        if (lower.includes('coe')) return 'CoE';
        return '';
    };

    const addFiles = useCallback((newFiles: FileList | File[]) => {
        const filesToAdd: FileUpload[] = [];

        for (const file of Array.from(newFiles)) {
            const error = validateFile(file);
            if (error) {
                onError?.(error);
                continue;
            }
            filesToAdd.push({
                file,
                documentType: guessDocumentType(file.name),
                status: 'pending',
                progress: 0,
            });
        }

        setFiles((prev) => [...prev, ...filesToAdd]);
    }, [onError]);

    // Update parent when files or types change
    const notifyParent = useCallback((updatedFiles: FileUpload[]) => {
        const readyFiles = updatedFiles
            .filter(f => f.documentType) // Only files with assigned types
            .map(f => ({
                file: f.file,
                documentType: f.documentType as DocumentType,
            }));
        onFilesReady?.(readyFiles);
    }, [onFilesReady]);

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
        const newFiles = files.filter((_, i) => i !== index);
        setFiles(newFiles);
        notifyParent(newFiles);
    };

    const updateFileType = (index: number, type: DocumentType | '') => {
        const newFiles = files.map((f, i) =>
            i === index ? { ...f, documentType: type } : f
        );
        setFiles(newFiles);
        notifyParent(newFiles);
    };

    const extractFile = async (index: number) => {
        const fileUpload = files[index];
        if (!fileUpload || fileUpload.status !== 'pending' || !fileUpload.documentType) return;

        // Update status to extracting
        setFiles((prev) => prev.map((f, i) =>
            i === index ? { ...f, status: 'extracting', progress: 30 } : f
        ));

        try {
            console.log('[SmartExtractUpload] Starting extraction for:', fileUpload.file.name, 'Type:', fileUpload.documentType);

            // Run extraction directly (client-side)
            const extractionResult = await extractDocumentData(
                fileUpload.file,
                fileUpload.documentType as DocumentType
            );

            console.log('[SmartExtractUpload] Extraction result:', extractionResult);
            console.log('[SmartExtractUpload] Raw text length:', extractionResult.rawText?.length || 0);
            console.log('[SmartExtractUpload] Fields found:', Object.keys(extractionResult.fields));

            // Handle failed or skipped extractions
            if (extractionResult.status === 'failed' || extractionResult.status === 'skipped') {
                setFiles((prev) => prev.map((f, i) =>
                    i === index ? {
                        ...f,
                        status: 'error',
                        progress: 100,
                        error: extractionResult.error || 'No data could be extracted',
                        extractionResult
                    } : f
                ));
                onError?.(extractionResult.error || 'Extraction failed - no data found');
                return;
            }

            setFiles((prev) => prev.map((f, i) =>
                i === index ? {
                    ...f,
                    status: 'success',
                    progress: 100,
                    extractionResult
                } : f
            ));

            // Map extracted fields and notify parent
            if (extractionResult.status === 'completed' &&
                Object.keys(extractionResult.fields).length > 0) {
                const mappedFields = mapToApplicationFields(extractionResult);
                console.log('[SmartExtractUpload] Mapped fields:', mappedFields);
                onFieldsExtracted?.(mappedFields);
            }
        } catch (err) {
            console.error('[SmartExtractUpload] Extraction error:', err);
            setFiles((prev) => prev.map((f, i) =>
                i === index ? { ...f, status: 'error', error: err instanceof Error ? err.message : 'Extraction failed' } : f
            ));
            onError?.(err instanceof Error ? err.message : 'Extraction failed');
        }
    };

    const extractAll = async () => {
        for (let i = 0; i < files.length; i++) {
            if (files[i].status === 'pending' && files[i].documentType && isExtractable(files[i].documentType)) {
                await extractFile(i);
            }
        }
    };

    const pendingExtractableCount = files.filter(f =>
        f.status === 'pending' && f.documentType && isExtractable(f.documentType)
    ).length;

    const filesWithoutType = files.filter(f => !f.documentType).length;

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getStatusIcon = (status: FileUpload['status']) => {
        switch (status) {
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

    return (
        <div className="space-y-4">
            {/* Drop Zone - Always visible, no pre-selection needed */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                    }`}
            >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">
                    Drop files here or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    PDF, Images, Word docs, Text files up to 10MB • You can assign document types after uploading
                </p>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept={ALLOWED_TYPES.join(',')}
                onChange={(e) => e.target.files && addFiles(e.target.files)}
            />

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-2">
                    {files.map((fileUpload, index) => (
                        <div
                            key={index}
                            className={`flex items-center gap-3 p-3 rounded-lg border ${fileUpload.status === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' :
                                fileUpload.status === 'error' ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' :
                                    fileUpload.status === 'extracting' ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800' :
                                        !fileUpload.documentType ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' :
                                            'bg-muted/50'
                                }`}
                        >
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                <FileText className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{fileUpload.file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {formatFileSize(fileUpload.file.size)}
                                    {fileUpload.status === 'extracting' && (
                                        <span className="ml-2 text-primary">Extracting data...</span>
                                    )}
                                </p>
                                {fileUpload.status === 'extracting' && (
                                    <Progress value={fileUpload.progress} className="mt-1 h-1" />
                                )}
                                {fileUpload.error && (
                                    <p className="text-xs text-red-600 mt-1">{fileUpload.error}</p>
                                )}
                                {fileUpload.extractionResult?.status === 'completed' && (
                                    <p className="text-xs text-green-600 mt-1">
                                        ✓ {Object.keys(fileUpload.extractionResult.fields).length} fields extracted and applied
                                    </p>
                                )}
                            </div>

                            {/* Document Type Selector per file */}
                            <Select
                                value={fileUpload.documentType}
                                onValueChange={(v) => updateFileType(index, v as DocumentType)}
                                disabled={fileUpload.status === 'extracting'}
                            >
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {DOCUMENT_TYPES.map((type) => (
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

                            <div className="flex items-center gap-2">
                                {fileUpload.status === 'pending' && fileUpload.documentType && isExtractable(fileUpload.documentType) && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => extractFile(index)}
                                    >
                                        <Sparkles className="h-4 w-4 mr-1" />
                                        Extract
                                    </Button>
                                )}
                                {getStatusIcon(fileUpload.status)}
                                {fileUpload.status !== 'extracting' && (
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

                    {/* Warning for files without type */}
                    {filesWithoutType > 0 && (
                        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                            <AlertCircle className="h-4 w-4" />
                            <span>
                                {filesWithoutType} file{filesWithoutType > 1 ? 's' : ''} need{filesWithoutType === 1 ? 's' : ''} a document type assigned
                            </span>
                        </div>
                    )}

                    {/* Extract All Button */}
                    {pendingExtractableCount > 0 && (
                        <Button onClick={extractAll} className="w-full">
                            <Sparkles className="h-4 w-4 mr-2" />
                            Extract All ({pendingExtractableCount} files)
                        </Button>
                    )}

                    {/* Add More Files Button */}
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add More Files
                    </Button>
                </div>
            )}

            <p className="text-xs text-muted-foreground">
                Documents will be automatically renamed and saved when you create the application.
            </p>
        </div>
    );
}

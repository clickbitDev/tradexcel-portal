'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
    Download, 
    ZoomIn, 
    ZoomOut, 
    RotateCw,
    X,
    FileText,
    Loader2,
    AlertCircle
} from 'lucide-react';
import { getDocumentAccessUrl as fetchDocumentAccessUrl } from '@/lib/storage';

interface DocumentPreviewProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    document: {
        id: string;
        file_name: string;
        file_url: string;
        mime_type: string | null;
        document_type: string;
        notes?: string | null;
        storage_path?: string | null;
    } | null;
}

const PREVIEWABLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const PREVIEWABLE_PDF_TYPES = ['application/pdf'];

function resolveStoragePath(document: NonNullable<DocumentPreviewProps['document']>): string | null {
    return document.storage_path?.trim() || null;
}

export function DocumentPreview({ open, onOpenChange, document }: DocumentPreviewProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [zoom, setZoom] = useState(100);
    const [rotation, setRotation] = useState(0);

    useEffect(() => {
        if (!open || !document) {
            setSignedUrl(null);
            setLoading(true);
            setError(null);
            setZoom(100);
            setRotation(0);
            return;
        }

        const fetchSignedUrl = async () => {
            setLoading(true);
            setError(null);

            try {
                const documentAccessUrl = await fetchDocumentAccessUrl(document.id);
                setSignedUrl(documentAccessUrl);
            } catch {
                // Fall back to public URL on any error
                if (document.file_url && /^https?:\/\//i.test(document.file_url)) {
                    setSignedUrl(document.file_url);
                } else if (resolveStoragePath(document)) {
                    setError('Unable to load a temporary access URL for this document.');
                } else {
                    setError('Unable to load document URL');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchSignedUrl();
    }, [open, document]);

    if (!document) return null;

    const mimeType = document.mime_type || '';
    const isImage = PREVIEWABLE_IMAGE_TYPES.includes(mimeType);
    const isPdf = PREVIEWABLE_PDF_TYPES.includes(mimeType);
    const isPreviewable = isImage || isPdf;

    const handleDownload = async () => {
        if (!signedUrl) {
            return;
        }

        try {
            const response = await fetch(signedUrl);
            if (!response.ok) {
                throw new Error('Failed to fetch file for download');
            }

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);

            const link = window.document.createElement('a');
            link.href = blobUrl;
            link.download = document.file_name;
            link.click();

            window.URL.revokeObjectURL(blobUrl);
        } catch {
            const link = window.document.createElement('a');
            link.href = signedUrl;
            link.download = document.file_name;
            link.click();
        }
    };

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
    const handleRotate = () => setRotation(prev => (prev + 90) % 360);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-4 border-b flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            {document.file_name}
                        </DialogTitle>
                        <div className="flex items-center gap-2">
                            {isImage && (
                                <>
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        onClick={handleZoomOut}
                                        disabled={zoom <= 50}
                                    >
                                        <ZoomOut className="h-4 w-4" />
                                    </Button>
                                    <span className="text-sm text-muted-foreground w-12 text-center">
                                        {zoom}%
                                    </span>
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        onClick={handleZoomIn}
                                        disabled={zoom >= 200}
                                    >
                                        <ZoomIn className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={handleRotate}>
                                        <RotateCw className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                            <Button variant="outline" size="icon" onClick={handleDownload}>
                                <Download className="h-4 w-4" />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => onOpenChange(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-auto bg-gray-100 min-h-[400px]">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                            <AlertCircle className="h-12 w-12" />
                            <p>{error}</p>
                            <Button variant="outline" onClick={handleDownload}>
                                Download Instead
                            </Button>
                        </div>
                    ) : !isPreviewable ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                            <FileText className="h-12 w-12" />
                            <p>Preview not available for this file type</p>
                            <Button variant="outline" onClick={handleDownload}>
                                <Download className="h-4 w-4 mr-2" />
                                Download File
                            </Button>
                        </div>
                    ) : isPdf ? (
                        <iframe
                            src={`${signedUrl}#toolbar=1&navpanes=0`}
                            className="w-full h-full min-h-[500px] border-0"
                            title={document.file_name}
                        />
                    ) : isImage ? (
                        <div className="flex items-center justify-center p-4 h-full overflow-auto">
                            <img
                                src={signedUrl || ''}
                                alt={document.file_name}
                                className="max-w-none transition-transform duration-200"
                                style={{
                                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                                }}
                                onError={() => setError('Failed to load image')}
                            />
                        </div>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default DocumentPreview;

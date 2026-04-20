'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Download, Expand, X } from 'lucide-react';

interface CertificatePreviewDialogProps {
    imageUrl: string;
    qualificationCode: string;
}

export function CertificatePreviewDialog({ imageUrl, qualificationCode }: CertificatePreviewDialogProps) {
    const [open, setOpen] = useState(false);

    const buildFileName = () => {
        const cleanUrl = imageUrl.split('?')[0];
        const extensionMatch = cleanUrl.match(/\.([a-zA-Z0-9]+)$/);
        const extension = extensionMatch?.[1] || 'jpg';
        return `${qualificationCode}-certificate-preview.${extension}`;
    };

    const handleDownload = async () => {
        const fileName = buildFileName();

        try {
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error('Failed to fetch image for download');
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            const link = window.document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            window.document.body.appendChild(link);
            link.click();
            window.document.body.removeChild(link);

            URL.revokeObjectURL(blobUrl);
        } catch {
            // Fallback to direct link if blob download fails
            window.open(imageUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const handleDownloadClick = () => {
        void handleDownload();
    };

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <>
            <div className="space-y-3">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="w-full overflow-hidden rounded-md border border-border bg-muted/20 hover:border-primary/60"
                    aria-label="Open certificate preview"
                >
                    <img
                        src={imageUrl}
                        alt={`Certificate preview for ${qualificationCode}`}
                        className="max-h-64 w-full object-contain"
                    />
                </button>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
                        <Expand className="h-4 w-4 mr-2" />
                        Open Preview
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleDownloadClick}>
                        <Download className="h-4 w-4 mr-2" />
                        Download Image
                    </Button>
                </div>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Certificate Preview</DialogTitle>
                    </DialogHeader>

                    <div className="max-h-[70vh] overflow-auto rounded-md border border-border bg-muted/20 p-4">
                        <img
                            src={imageUrl}
                            alt={`Certificate preview for ${qualificationCode}`}
                            className="mx-auto max-h-[65vh] w-auto object-contain"
                        />
                    </div>

                    <DialogFooter className="sm:justify-between">
                        <Button type="button" variant="outline" onClick={handleDownloadClick}>
                            <Download className="h-4 w-4 mr-2" />
                            Download Image
                        </Button>
                        <Button type="button" onClick={handleClose}>
                            <X className="h-4 w-4 mr-2" />
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

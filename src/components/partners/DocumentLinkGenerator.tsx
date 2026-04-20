'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    Link as LinkIcon, 
    Copy, 
    Check, 
    Calendar, 
    FileText,
    X,
    Plus,
    ExternalLink,
    QrCode
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DOCUMENT_TYPES } from '@/types/database';

interface DocumentLinkGeneratorProps {
    partnerId: string;
    partnerName: string;
    onClose: () => void;
    onSuccess?: () => void;
}

export function DocumentLinkGenerator({ 
    partnerId, 
    partnerName, 
    onClose, 
    onSuccess 
}: DocumentLinkGeneratorProps) {
    const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([]);
    const [expiryDays, setExpiryDays] = useState<number | null>(7);
    const [maxUploads, setMaxUploads] = useState<number | null>(null);
    const [notes, setNotes] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const supabase = createClient();

    const toggleDocType = (type: string) => {
        setSelectedDocTypes(prev => 
            prev.includes(type) 
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    const generateLink = async () => {
        if (selectedDocTypes.length === 0) return;

        setIsGenerating(true);

        try {
            // Generate a unique token
            const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            const expiresAt = expiryDays 
                ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
                : null;

            const { data, error } = await supabase
                .from('document_request_links')
                .insert({
                    partner_id: partnerId,
                    token,
                    document_types: selectedDocTypes,
                    notes: notes || null,
                    expires_at: expiresAt,
                    max_uploads: maxUploads,
                    is_active: true,
                })
                .select()
                .single();

            if (error) throw error;

            // Generate the full URL
            const baseUrl = typeof window !== 'undefined' 
                ? window.location.origin 
                : '';
            setGeneratedLink(`${baseUrl}/upload/${token}`);
            
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Error generating link:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = async () => {
        if (!generatedLink) return;
        
        try {
            await navigator.clipboard.writeText(generatedLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-lg mx-4">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div>
                        <h2 className="text-lg font-semibold">Generate Document Request Link</h2>
                        <p className="text-sm text-muted-foreground">for {partnerName}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Content */}
                <div className="px-6 py-4 space-y-5">
                    {!generatedLink ? (
                        <>
                            {/* Document Types */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Required Documents *
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {DOCUMENT_TYPES.map(type => (
                                        <Badge
                                            key={type}
                                            variant={selectedDocTypes.includes(type) ? 'default' : 'outline'}
                                            className="cursor-pointer transition-colors"
                                            onClick={() => toggleDocType(type)}
                                        >
                                            {selectedDocTypes.includes(type) && (
                                                <Check className="h-3 w-3 mr-1" />
                                            )}
                                            {type}
                                        </Badge>
                                    ))}
                                </div>
                                {selectedDocTypes.length === 0 && (
                                    <p className="text-sm text-red-500 mt-1">
                                        Select at least one document type
                                    </p>
                                )}
                            </div>

                            {/* Expiry */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    <Calendar className="h-4 w-4 inline mr-1" />
                                    Link Expiry
                                </label>
                                <div className="flex gap-2">
                                    {[7, 14, 30, null].map(days => (
                                        <Button
                                            key={days ?? 'never'}
                                            variant={expiryDays === days ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setExpiryDays(days)}
                                        >
                                            {days ? `${days} days` : 'Never'}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Max Uploads */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    <FileText className="h-4 w-4 inline mr-1" />
                                    Maximum Uploads
                                </label>
                                <div className="flex gap-2">
                                    {[1, 5, 10, null].map(count => (
                                        <Button
                                            key={count ?? 'unlimited'}
                                            variant={maxUploads === count ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setMaxUploads(count)}
                                        >
                                            {count ?? 'Unlimited'}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Notes (optional)
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="e.g., For student visa application"
                                    className="w-full px-3 py-2 border rounded-md resize-none"
                                    rows={2}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                                <Check className="h-8 w-8 text-green-600" />
                            </div>
                            <h3 className="text-lg font-medium mb-2">Link Generated!</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Share this link with the partner to collect documents.
                            </p>
                            
                            <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                                <input
                                    type="text"
                                    value={generatedLink}
                                    readOnly
                                    className="flex-1 bg-transparent text-sm truncate border-none outline-none"
                                />
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={copyToClipboard}
                                >
                                    {copied ? (
                                        <Check className="h-4 w-4" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>

                            <div className="flex justify-center gap-2 mt-4">
                                <Button variant="outline" size="sm">
                                    <QrCode className="h-4 w-4 mr-1" />
                                    Show QR Code
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => window.open(generatedLink, '_blank')}
                                >
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    Open Link
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-6 py-4 border-t">
                    {!generatedLink ? (
                        <>
                            <Button variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button 
                                onClick={generateLink}
                                disabled={selectedDocTypes.length === 0 || isGenerating}
                            >
                                {isGenerating ? (
                                    <>
                                        <span className="animate-spin mr-2">⏳</span>
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <LinkIcon className="h-4 w-4 mr-2" />
                                        Generate Link
                                    </>
                                )}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    setGeneratedLink(null);
                                    setSelectedDocTypes([]);
                                    setNotes('');
                                }}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Create Another
                            </Button>
                            <Button onClick={onClose}>
                                Done
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

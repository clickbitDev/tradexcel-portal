'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Loader2, RefreshCw, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface XeroSyncButtonProps {
    entityType: 'invoice' | 'bill' | 'partner' | 'rto';
    entityId: string;
    xeroId?: string | null;
    xeroUrl?: string | null;
    xeroStatus?: string | null;
    onSyncComplete?: (xeroId: string) => void;
    size?: 'sm' | 'default';
}

export function XeroSyncButton({
    entityType,
    entityId,
    xeroId,
    xeroUrl,
    xeroStatus,
    onSyncComplete,
    size = 'sm',
}: XeroSyncButtonProps) {
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const actionMap = {
                invoice: 'sync_invoice',
                bill: 'sync_bill',
                partner: 'sync_partner',
                rto: 'sync_rto',
            };
            const idMap = {
                invoice: 'invoiceId',
                bill: 'billId',
                partner: 'partnerId',
                rto: 'rtoId',
            };

            const response = await fetch('/api/xero/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: actionMap[entityType],
                    [idMap[entityType]]: entityId,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Sync failed');
            }

            toast.success(`Synced to Xero`, {
                description: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} synced successfully`,
            });

            if (onSyncComplete && (data.xeroInvoiceId || data.xeroBillId || data.contactId)) {
                onSyncComplete(data.xeroInvoiceId || data.xeroBillId || data.contactId);
            }
        } catch (error) {
            toast.error('Sync Failed', {
                description: error instanceof Error ? error.message : 'Failed to sync with Xero',
            });
        } finally {
            setIsSyncing(false);
        }
    };

    // Already synced - show status and link
    if (xeroId) {
        return (
            <div className="flex items-center gap-2">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger render={
                            <Badge variant="outline" className="gap-1">
                                <Check className="h-3 w-3 text-green-600" />
                                Synced
                            </Badge>
                        } />
                        <TooltipContent>
                            <p>Status: {xeroStatus || 'Synced'}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                {xeroUrl && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => window.open(xeroUrl, '_blank')}
                    >
                        <ExternalLink className="h-4 w-4" />
                    </Button>
                )}

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleSync}
                    disabled={isSyncing}
                >
                    {isSyncing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4" />
                    )}
                </Button>
            </div>
        );
    }

    // Not synced - show sync button
    return (
        <Button
            variant="outline"
            size={size}
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2"
        >
            {isSyncing ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Syncing...
                </>
            ) : (
                <>
                    <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                    Sync to Xero
                </>
            )}
        </Button>
    );
}

interface XeroSyncStatusProps {
    xeroId?: string | null;
    xeroUrl?: string | null;
    xeroStatus?: string | null;
}

export function XeroSyncStatus({ xeroId, xeroUrl, xeroStatus }: XeroSyncStatusProps) {
    if (!xeroId) {
        return (
            <Badge variant="secondary" className="gap-1">
                <X className="h-3 w-3" />
                Not Synced
            </Badge>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                <Check className="h-3 w-3" />
                {xeroStatus || 'Synced'}
            </Badge>

            {xeroUrl && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => window.open(xeroUrl, '_blank')}
                >
                    <ExternalLink className="h-3 w-3" />
                </Button>
            )}
        </div>
    );
}

'use client';

import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { CheckCircle2, Clock, AlertCircle, XCircle } from 'lucide-react';
import type { TgaSyncStatus } from '@/types/database';

interface TGASyncBadgeProps {
    status: TgaSyncStatus | null | undefined;
    lastSyncedAt?: string | null;
    error?: string | null;
    showLabel?: boolean;
}

const STATUS_CONFIG = {
    synced: {
        label: 'Synced',
        color: 'bg-green-100 text-green-700 border-green-200',
        icon: CheckCircle2,
    },
    pending: {
        label: 'Pending',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        icon: Clock,
    },
    error: {
        label: 'Error',
        color: 'bg-red-100 text-red-700 border-red-200',
        icon: AlertCircle,
    },
    never: {
        label: 'Never Synced',
        color: 'bg-gray-100 text-gray-700 border-gray-200',
        icon: XCircle,
    },
} as const;

export function TGASyncBadge({ status, lastSyncedAt, error, showLabel = true }: TGASyncBadgeProps) {
    // Fallback to 'never' if status is null, undefined, or invalid
    const safeStatus: TgaSyncStatus = (status && status in STATUS_CONFIG) ? status : 'never';
    const config = STATUS_CONFIG[safeStatus];
    const Icon = config.icon;

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('en-AU', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const tooltipContent = (
        <div className="space-y-1">
            <p className="font-semibold">TGA Sync Status: {config.label}</p>
            {lastSyncedAt && (
                <p className="text-xs">Last synced: {formatDate(lastSyncedAt)}</p>
            )}
            {error && (
                <p className="text-xs text-red-200">Error: {error}</p>
            )}
            {safeStatus === 'never' && (
                <p className="text-xs">This RTO has not been synced with TGA yet</p>
            )}
        </div>
    );

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger render={
                    <Badge variant="outline" className={`${config.color} cursor-help`}>
                        <Icon className="h-3 w-3 mr-1" />
                        {showLabel && config.label}
                    </Badge>
                } />
                <TooltipContent>
                    {tooltipContent}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

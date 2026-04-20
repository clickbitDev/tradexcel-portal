'use client';

import { Lock, LockOpen, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert';

interface LockIndicatorProps {
    isLocked: boolean;
    lockedByName: string | null;
    lockedAt: Date | null;
    isOwnLock: boolean;
    canEdit: boolean;
    onAcquireLock?: () => void;
    onReleaseLock?: () => void;
    isLoading?: boolean;
    error?: string | null;
}

export function LockIndicator({
    isLocked,
    lockedByName,
    lockedAt,
    isOwnLock,
    canEdit,
    onAcquireLock,
    onReleaseLock,
    isLoading,
    error,
}: LockIndicatorProps) {
    if (!isLocked && canEdit) {
        return (
            <div className="flex items-center gap-2">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger render={
                            <Badge variant="outline" className="text-muted-foreground">
                                <LockOpen className="h-3 w-3 mr-1" />
                                Unlocked
                            </Badge>
                        } />
                        <TooltipContent>
                            <p>Click Edit to start making changes</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        );
    }

    if (isOwnLock) {
        return (
            <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
                    <Lock className="h-3 w-3 mr-1" />
                    Editing
                </Badge>
                {onReleaseLock && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onReleaseLock}
                        disabled={isLoading}
                    >
                        Release Lock
                    </Button>
                )}
            </div>
        );
    }

    // Someone else has the lock
    return (
        <div className="flex items-center gap-2">
            <Badge variant="destructive">
                <Lock className="h-3 w-3 mr-1" />
                Locked by {lockedByName || 'another user'}
            </Badge>
            {lockedAt && (
                <span className="text-xs text-muted-foreground">
                    since {lockedAt.toLocaleTimeString()}
                </span>
            )}
        </div>
    );
}

interface LockBannerProps {
    isLocked: boolean;
    lockedByName: string | null;
    isOwnLock: boolean;
    canEdit: boolean;
    onAcquireLock?: () => void;
    error?: string | null;
}

export function LockBanner({
    isLocked,
    lockedByName,
    isOwnLock,
    canEdit,
    onAcquireLock,
    error,
}: LockBannerProps) {
    if (canEdit) return null;

    return (
        <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Record Locked</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
                <span>
                    This application is currently being edited by <strong>{lockedByName || 'another user'}</strong>.
                    You cannot make changes until they finish editing.
                </span>
            </AlertDescription>
        </Alert>
    );
}

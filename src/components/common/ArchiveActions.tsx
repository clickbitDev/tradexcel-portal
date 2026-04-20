'use client';

import React, { useState } from 'react';
import { Archive, ArchiveRestore, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { archiveRecord, unarchiveRecord, type ArchivableTable } from '@/lib/services/archive-service';

interface ArchiveActionsProps {
    tableName: ArchivableTable;
    recordId: string;
    isArchived: boolean;
    onSuccess?: () => void;
    variant?: 'button' | 'dropdown-item';
    size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function ArchiveActions({
    tableName,
    recordId,
    isArchived,
    onSuccess,
    variant = 'button',
    size = 'default',
}: ArchiveActionsProps) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleAction() {
        try {
            setLoading(true);
            setError(null);

            const result = isArchived
                ? await unarchiveRecord(tableName, recordId)
                : await archiveRecord(tableName, recordId);

            if (result.success) {
                setShowConfirm(false);
                onSuccess?.();
            } else {
                setError(result.error || 'Operation failed');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Operation failed');
        } finally {
            setLoading(false);
        }
    }

    const actionText = isArchived ? 'Unarchive' : 'Archive';
    const ActionIcon = isArchived ? ArchiveRestore : Archive;

    if (variant === 'dropdown-item') {
        return (
            <>
                <DropdownMenuItem onClick={() => setShowConfirm(true)}>
                    <ActionIcon className="h-4 w-4 mr-2" />
                    {actionText}
                </DropdownMenuItem>

                <ConfirmDialog
                    open={showConfirm}
                    onOpenChange={setShowConfirm}
                    onConfirm={handleAction}
                    loading={loading}
                    error={error}
                    isArchived={isArchived}
                    tableName={tableName}
                />
            </>
        );
    }

    return (
        <>
            <Button
                variant={isArchived ? 'outline' : 'secondary'}
                size={size}
                onClick={() => setShowConfirm(true)}
                disabled={loading}
            >
                <ActionIcon className="h-4 w-4 mr-2" />
                {loading ? 'Processing...' : actionText}
            </Button>

            <ConfirmDialog
                open={showConfirm}
                onOpenChange={setShowConfirm}
                onConfirm={handleAction}
                loading={loading}
                error={error}
                isArchived={isArchived}
                tableName={tableName}
            />
        </>
    );
}

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    loading: boolean;
    error: string | null;
    isArchived: boolean;
    tableName: string;
}

function ConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    loading,
    error,
    isArchived,
    tableName,
}: ConfirmDialogProps) {
    const tableDisplayName = {
        applications: 'application',
        partners: 'partner',
        rtos: 'RTO',
        qualifications: 'qualification',
        rto_offerings: 'offering',
        documents: 'document',
        invoices: 'invoice',
        email_templates: 'email template',
    }[tableName] || 'record';

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {isArchived ? 'Unarchive' : 'Archive'} this {tableDisplayName}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {isArchived ? (
                            <>
                                This will restore the {tableDisplayName} to active status. It will appear
                                in normal lists and searches again.
                            </>
                        ) : (
                            <>
                                This will move the {tableDisplayName} to the archive. It will be hidden
                                from normal lists but can be restored at any time.
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {error && (
                    <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-md">
                        <AlertTriangle className="h-4 w-4" />
                        {error}
                    </div>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={(e) => { e.preventDefault(); onConfirm(); }} disabled={loading}>
                        {loading ? 'Processing...' : isArchived ? 'Unarchive' : 'Archive'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

/**
 * Archive status badge
 */
export function ArchiveStatusBadge({ isArchived }: { isArchived: boolean }) {
    if (!isArchived) return null;

    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <Archive className="h-3 w-3" />
            Archived
        </span>
    );
}

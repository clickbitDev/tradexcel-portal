'use client';

import React, { useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
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
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { deleteRecord, restoreRecord, type DeletableTable } from '@/lib/services/trash-service';

interface DeleteActionsProps {
    tableName: DeletableTable;
    recordId: string;
    isDeleted: boolean;
    onSuccess?: () => void;
    variant?: 'button' | 'dropdown-item';
    size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function DeleteActions({
    tableName,
    recordId,
    isDeleted,
    onSuccess,
    variant = 'button',
    size = 'default',
}: DeleteActionsProps) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleAction() {
        try {
            setLoading(true);
            setError(null);

            const result = isDeleted
                ? await restoreRecord(tableName, recordId)
                : await deleteRecord(tableName, recordId);

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

    const actionText = isDeleted ? 'Restore' : 'Delete';
    const ActionIcon = isDeleted ? RotateCcw : Trash2;

    if (variant === 'dropdown-item') {
        return (
            <>
                <DropdownMenuItem
                    onClick={() => setShowConfirm(true)}
                    className={isDeleted ? '' : 'text-red-600 focus:text-red-600'}
                >
                    <ActionIcon className="h-4 w-4 mr-2" />
                    {actionText}
                </DropdownMenuItem>

                <DeleteConfirmDialog
                    open={showConfirm}
                    onOpenChange={setShowConfirm}
                    onConfirm={handleAction}
                    loading={loading}
                    error={error}
                    isDeleted={isDeleted}
                    tableName={tableName}
                />
            </>
        );
    }

    return (
        <>
            <Button
                variant={isDeleted ? 'outline' : 'destructive'}
                size={size}
                onClick={() => setShowConfirm(true)}
                disabled={loading}
            >
                <ActionIcon className="h-4 w-4 mr-2" />
                {loading ? 'Processing...' : actionText}
            </Button>

            <DeleteConfirmDialog
                open={showConfirm}
                onOpenChange={setShowConfirm}
                onConfirm={handleAction}
                loading={loading}
                error={error}
                isDeleted={isDeleted}
                tableName={tableName}
            />
        </>
    );
}

interface DeleteConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    loading: boolean;
    error: string | null;
    isDeleted: boolean;
    tableName: string;
}

function DeleteConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    loading,
    error,
    isDeleted,
    tableName,
}: DeleteConfirmDialogProps) {
    const tableDisplayName = {
        applications: 'application',
        partners: 'partner',
        rtos: 'RTO',
        qualifications: 'qualification',
        rto_offerings: 'offering',
        documents: 'document',
        invoices: 'invoice',
        email_templates: 'email template',
        profiles: 'user profile',
    }[tableName] || 'record';

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className={isDeleted ? '' : 'text-red-600'}>
                        {isDeleted ? 'Restore' : 'Delete'} this {tableDisplayName}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {isDeleted ? (
                            <>
                                This will restore the {tableDisplayName} from trash. It will appear
                                in normal lists and be fully accessible again.
                            </>
                        ) : (
                            <>
                                This will move the {tableDisplayName} to trash. You can restore it
                                at any time from the Trash bin. <strong>No data is permanently deleted.</strong>
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
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            onConfirm();
                        }}
                        disabled={loading}
                        className={isDeleted ? '' : 'bg-red-600 hover:bg-red-700'}
                    >
                        {loading ? 'Processing...' : isDeleted ? 'Restore' : 'Move to Trash'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

/**
 * Deleted status badge
 */
export function DeletedStatusBadge({ isDeleted }: { isDeleted: boolean }) {
    if (!isDeleted) return null;

    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <Trash2 className="h-3 w-3" />
            In Trash
        </span>
    );
}

/**
 * Combined status badges component
 */
export function RecordStatusBadges({
    isArchived,
    isDeleted,
}: {
    isArchived?: boolean;
    isDeleted?: boolean;
}) {
    return (
        <div className="flex items-center gap-2">
            {isDeleted && <DeletedStatusBadge isDeleted={true} />}
            {isArchived && !isDeleted && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    Archived
                </span>
            )}
        </div>
    );
}

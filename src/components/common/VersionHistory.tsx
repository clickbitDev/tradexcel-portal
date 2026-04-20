'use client';

import React, { useState, useEffect } from 'react';
import { Clock, RotateCcw, ChevronDown, ChevronUp, Eye, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { RecordVersion, FieldDiff } from '@/types/database';
import {
    getVersionHistory,
    getVersion,
    compareVersions,
    restoreVersion,
    getFieldLabel,
    formatValueForDisplay,
} from '@/lib/services/version-service';

interface VersionHistoryProps {
    tableName: string;
    recordId: string;
    maxHeight?: string;
    embedded?: boolean;
    onVersionRestored?: () => void;
}

export function VersionHistory({
    tableName,
    recordId,
    maxHeight = '500px',
    embedded = false,
    onVersionRestored,
}: VersionHistoryProps) {
    const [versions, setVersions] = useState<RecordVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedVersion, setSelectedVersion] = useState<RecordVersion | null>(null);
    const [showRestoreDialog, setShowRestoreDialog] = useState(false);
    const [restoreReason, setRestoreReason] = useState('');
    const [restoring, setRestoring] = useState(false);
    const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set());

    useEffect(() => {
        loadVersions();
    }, [tableName, recordId]);

    async function loadVersions() {
        try {
            setLoading(true);
            setError(null);
            const result = await getVersionHistory(tableName, recordId);
            setVersions(result.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load version history');
        } finally {
            setLoading(false);
        }
    }

    async function handleRestore() {
        if (!selectedVersion) return;

        try {
            setRestoring(true);
            const result = await restoreVersion(
                tableName,
                recordId,
                selectedVersion.version_number,
                restoreReason
            );

            if (result.success) {
                setShowRestoreDialog(false);
                setSelectedVersion(null);
                setRestoreReason('');
                await loadVersions();
                onVersionRestored?.();
            } else {
                setError(result.error || 'Failed to restore version');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to restore version');
        } finally {
            setRestoring(false);
        }
    }

    function toggleVersionExpanded(versionNumber: number) {
        const newExpanded = new Set(expandedVersions);
        if (newExpanded.has(versionNumber)) {
            newExpanded.delete(versionNumber);
        } else {
            newExpanded.add(versionNumber);
        }
        setExpandedVersions(newExpanded);
    }

    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-AU', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(date);
    }

    function getChangeTypeColor(changeType: string): string {
        const colors: Record<string, string> = {
            create: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
            update: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
            delete: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
            restore: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
            archive: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
            unarchive: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
            version_restored: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
        };
        return colors[changeType] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }

    function getChangeTypeLabel(changeType: string): string {
        const labels: Record<string, string> = {
            create: 'Created',
            update: 'Updated',
            delete: 'Deleted',
            restore: 'Restored',
            archive: 'Archived',
            unarchive: 'Unarchived',
            version_restored: 'Version Restored',
        };
        return labels[changeType] || changeType;
    }

    if (loading) {
        const loadingContent = (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        );

        if (embedded) {
            return loadingContent;
        }

        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Version History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loadingContent}
                </CardContent>
            </Card>
        );
    }

    if (error) {
        const errorContent = (
            <>
                <p className="text-sm text-red-500">{error}</p>
                <Button variant="outline" size="sm" onClick={loadVersions} className="mt-2">
                    Retry
                </Button>
            </>
        );

        if (embedded) {
            return <div>{errorContent}</div>;
        }

        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Version History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {errorContent}
                </CardContent>
            </Card>
        );
    }

    const versionsContent = (
        <>
            {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No version history available.</p>
            ) : (
                <ScrollArea style={{ maxHeight }}>
                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                        {/* Version entries */}
                        <div className="space-y-4">
                            {versions.map((version, index) => (
                                <Collapsible
                                    key={version.id}
                                    open={expandedVersions.has(version.version_number)}
                                    onOpenChange={() => toggleVersionExpanded(version.version_number)}
                                >
                                    <div className="relative pl-10">
                                        {/* Timeline dot */}
                                        <div
                                            className={`absolute left-2 top-2 h-4 w-4 rounded-full border-2 border-background ${index === 0
                                                    ? 'bg-primary'
                                                    : 'bg-muted'
                                                }`}
                                        />

                                        <div className="rounded-lg border p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Badge
                                                            variant="outline"
                                                            className={getChangeTypeColor(version.change_type)}
                                                        >
                                                            {getChangeTypeLabel(version.change_type)}
                                                        </Badge>
                                                        <span className="text-sm font-medium">
                                                            v{version.version_number}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatDate(version.created_at)}
                                                        </span>
                                                    </div>

                                                    {version.user && (
                                                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                                            <User className="h-3 w-3" />
                                                            {(version.user as { full_name?: string }).full_name || 'Unknown'}
                                                        </div>
                                                    )}

                                                    {version.changed_fields.length > 0 && (
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Changed: {version.changed_fields
                                                                .map(f => getFieldLabel(tableName, f))
                                                                .join(', ')}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <CollapsibleTrigger render={
                                                        <Button variant="ghost" size="sm">
                                                            {expandedVersions.has(version.version_number) ? (
                                                                <ChevronUp className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronDown className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    } />
                                                    {index > 0 && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedVersion(version);
                                                                setShowRestoreDialog(true);
                                                            }}
                                                        >
                                                            <RotateCcw className="h-4 w-4 mr-1" />
                                                            Restore
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            <CollapsibleContent>
                                                <div className="mt-3 pt-3 border-t">
                                                    <h4 className="text-sm font-medium mb-2">Snapshot at this version:</h4>
                                                    <div className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto">
                                                        <pre>{JSON.stringify(version.data, null, 2)}</pre>
                                                    </div>
                                                </div>
                                            </CollapsibleContent>
                                        </div>
                                    </div>
                                </Collapsible>
                            ))}
                        </div>
                    </div>
                </ScrollArea>
            )}
        </>
    );

    return (
        <>
            {embedded ? (
                versionsContent
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Version History
                            <Badge variant="secondary" className="ml-auto">
                                {versions.length} versions
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>{versionsContent}</CardContent>
                </Card>
            )}

            {/* Restore Dialog */}
            <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Restore to Version {selectedVersion?.version_number}</DialogTitle>
                        <DialogDescription>
                            This will restore the record to its state at this version. The current state
                            will be saved as a new version before restoration.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="restore-reason">Reason for restoration (optional)</Label>
                            <Textarea
                                id="restore-reason"
                                value={restoreReason}
                                onChange={(e) => setRestoreReason(e.target.value)}
                                placeholder="Why are you restoring to this version?"
                                className="mt-1"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowRestoreDialog(false)}
                            disabled={restoring}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleRestore} disabled={restoring}>
                            {restoring ? 'Restoring...' : 'Restore Version'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

'use client';

import React, { useState, useEffect } from 'react';
import {
    Trash2,
    RotateCcw,
    Search,
    Filter,
    FileText,
    Users,
    Building2,
    GraduationCap,
    Receipt,
    File,
    AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
import { Checkbox } from '@/components/ui/checkbox';
import type { TrashItem } from '@/types/database';
import {
    getTrash,
    getTrashSummary,
    restoreRecord,
    bulkRestoreRecords,
    getTableDisplayName,
    type DeletableTable,
    DELETABLE_TABLES,
} from '@/lib/services/trash-service';

const TableIcons: Record<string, React.ElementType> = {
    applications: FileText,
    partners: Users,
    rtos: Building2,
    qualifications: GraduationCap,
    invoices: Receipt,
    documents: File,
    rto_offerings: GraduationCap,
    email_templates: FileText,
    profiles: Users,
};

export default function TrashPage() {
    const [items, setItems] = useState<TrashItem[]>([]);
    const [summary, setSummary] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [itemToRestore, setItemToRestore] = useState<TrashItem | null>(null);
    const [bulkRestoring, setBulkRestoring] = useState(false);

    useEffect(() => {
        loadData();
    }, [activeTab, search]);

    async function loadData() {
        try {
            setLoading(true);
            setError(null);

            // Load summary counts
            const summaryData = await getTrashSummary();
            setSummary(summaryData);

            // Load items
            const tableFilter = activeTab === 'all' ? undefined : [activeTab as DeletableTable];
            const result = await getTrash({
                tableNames: tableFilter,
                search: search || undefined,
                limit: 100,
            });
            setItems(result.data);
            setSelectedItems(new Set());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load trash');
        } finally {
            setLoading(false);
        }
    }

    async function handleRestore(item: TrashItem) {
        try {
            const result = await restoreRecord(item.table_name as DeletableTable, item.record_id);
            if (result.success) {
                await loadData();
            } else {
                setError(result.error || 'Failed to restore');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to restore');
        }
        setRestoreDialogOpen(false);
        setItemToRestore(null);
    }

    async function handleBulkRestore() {
        if (selectedItems.size === 0) return;

        try {
            setBulkRestoring(true);

            // Group by table
            const byTable: Record<string, string[]> = {};
            for (const key of selectedItems) {
                const [tableName, recordId] = key.split(':');
                if (!byTable[tableName]) byTable[tableName] = [];
                byTable[tableName].push(recordId);
            }

            // Restore each group
            for (const [tableName, recordIds] of Object.entries(byTable)) {
                await bulkRestoreRecords(tableName as DeletableTable, recordIds);
            }

            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to restore items');
        } finally {
            setBulkRestoring(false);
        }
    }

    function toggleSelectItem(item: TrashItem) {
        const key = `${item.table_name}:${item.record_id}`;
        const newSelected = new Set(selectedItems);
        if (newSelected.has(key)) {
            newSelected.delete(key);
        } else {
            newSelected.add(key);
        }
        setSelectedItems(newSelected);
    }

    function toggleSelectAll() {
        if (selectedItems.size === items.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(items.map(i => `${i.table_name}:${i.record_id}`)));
        }
    }

    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-AU', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(date);
    }

    const totalCount = Object.values(summary).reduce((a, b) => a + b, 0);

    // Get tabs with counts
    const tabs = [
        { value: 'all', label: 'All', count: totalCount },
        ...DELETABLE_TABLES.filter(t => (summary[t] || 0) > 0).map(t => ({
            value: t,
            label: getTableDisplayName(t),
            count: summary[t] || 0,
        })),
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Trash2 className="h-6 w-6" />
                        Trash
                    </h1>
                    <p className="text-muted-foreground">
                        Deleted items are kept here and can be restored at any time.
                    </p>
                </div>

                {selectedItems.size > 0 && (
                    <Button onClick={handleBulkRestore} disabled={bulkRestoring}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {bulkRestoring ? 'Restoring...' : `Restore ${selectedItems.size} item(s)`}
                    </Button>
                )}
            </div>

            {error && (
                <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded-md">
                    <AlertTriangle className="h-4 w-4" />
                    {error}
                    <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
                        Dismiss
                    </Button>
                </div>
            )}

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Deleted Items</CardTitle>
                            <CardDescription>
                                {totalCount === 0
                                    ? 'No items in trash'
                                    : `${totalCount} item(s) in trash`}
                            </CardDescription>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search trash..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8 w-64"
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="mb-4">
                            {tabs.map((tab) => (
                                <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                                    {tab.label}
                                    <Badge variant="secondary" className="text-xs">
                                        {tab.count}
                                    </Badge>
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        <TabsContent value={activeTab}>
                            {loading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div key={i} className="flex items-center gap-4">
                                            <Skeleton className="h-4 w-4" />
                                            <Skeleton className="h-10 w-10 rounded" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-1/3" />
                                                <Skeleton className="h-3 w-1/4" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : items.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-medium">Trash is empty</p>
                                    <p className="text-sm">Deleted items will appear here</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12">
                                                <Checkbox
                                                    checked={selectedItems.size === items.length}
                                                    onCheckedChange={toggleSelectAll}
                                                />
                                            </TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>ID</TableHead>
                                            <TableHead>Deleted</TableHead>
                                            <TableHead>Deleted By</TableHead>
                                            <TableHead className="w-24">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item) => {
                                            const key = `${item.table_name}:${item.record_id}`;
                                            const IconComponent = TableIcons[item.table_name] || File;

                                            return (
                                                <TableRow key={key}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={selectedItems.has(key)}
                                                            onCheckedChange={() => toggleSelectItem(item)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <IconComponent className="h-4 w-4 text-muted-foreground" />
                                                            <span className="text-sm">
                                                                {getTableDisplayName(item.table_name)}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {item.display_name || '—'}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                                        {item.identifier || item.record_id.slice(0, 8)}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {formatDate(item.deleted_at)}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {item.deleted_by_name || '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setItemToRestore(item);
                                                                setRestoreDialogOpen(true);
                                                            }}
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Info card */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                        </div>
                        <div>
                            <h3 className="font-medium">Data Retention Policy</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Items in trash are never permanently deleted. All data is retained for
                                compliance purposes. You can restore any item at any time. Version history
                                is preserved even for deleted items.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Restore confirmation dialog */}
            <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restore this item?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will restore &quot;{itemToRestore?.display_name || 'this item'}&quot; from trash.
                            It will appear in normal lists and be fully accessible again.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => itemToRestore && handleRestore(itemToRestore)}>
                            Restore
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

/**
 * Qualifications List Client Component
 * 
 * Handles client-side interactions like bulk selection and export
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Download,
    Search,
    X,
    Filter,
} from 'lucide-react';
import Link from 'next/link';
import { exportQualificationsToCSV } from '@/lib/services/csv-import';

interface Qualification {
    id: string;
    code: string;
    name: string;
    status: string;
    release_date: string | null;
    core_units: number | null;
    elective_units: number | null;
    total_units: number | null;
}

interface QualificationsListProps {
    qualifications: Qualification[];
}

export function QualificationsList({ qualifications }: QualificationsListProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [exporting, setExporting] = useState(false);

    const statusColors: Record<string, string> = {
        current: 'bg-green-100 text-green-700 border-green-200',
        superseded: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        deleted: 'bg-red-100 text-red-700 border-red-200',
    };

    const filteredQualifications = qualifications.filter((qual) => {
        // Status filter
        if (statusFilter !== 'all' && qual.status !== statusFilter) {
            return false;
        }
        // Search filter
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return (
            qual.code.toLowerCase().includes(searchLower) ||
            qual.name.toLowerCase().includes(searchLower)
        );
    });

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelected(new Set(filteredQualifications.map((q) => q.id)));
        } else {
            setSelected(new Set());
        }
    };

    const handleSelect = (id: string, checked: boolean) => {
        const newSelected = new Set(selected);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelected(newSelected);
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const selectedIds = selected.size > 0 ? Array.from(selected) : undefined;
            const csv = await exportQualificationsToCSV(selectedIds);

            // Download the CSV
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `qualifications-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    const allSelected = filteredQualifications.length > 0 &&
        filteredQualifications.every((q) => selected.has(q.id));

    return (
        <div className="space-y-4">
            {/* Search and Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search qualifications..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[160px]">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Filter status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="current">Current</SelectItem>
                            <SelectItem value="superseded">Superseded</SelectItem>
                            <SelectItem value="deleted">Deleted</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    {selected.size > 0 && (
                        <span className="text-sm text-muted-foreground mr-2">
                            {selected.size} selected
                        </span>
                    )}
                    <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
                        <Download className="h-4 w-4 mr-2" />
                        {exporting ? 'Exporting...' : 'Export CSV'}
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-card rounded-lg border border-border overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={handleSelectAll}
                                />
                            </TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Qualification</TableHead>
                            <TableHead>Core Units</TableHead>
                            <TableHead>Elective Units</TableHead>
                            <TableHead>Total Units</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Release Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredQualifications.map((qual) => (
                            <TableRow key={qual.id} className="hover:bg-muted/50">
                                <TableCell>
                                    <Checkbox
                                        checked={selected.has(qual.id)}
                                        onCheckedChange={(checked) => handleSelect(qual.id, checked as boolean)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Link
                                        href={`/portal/qualifications/${qual.id}`}
                                        className="font-medium text-primary hover:underline"
                                    >
                                        {qual.code}
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <div className="max-w-md">
                                        <Link
                                            href={`/portal/qualifications/${qual.id}`}
                                            className="font-medium text-foreground hover:text-primary hover:underline text-left"
                                        >
                                                    {qual.name}
                                        </Link>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {qual.core_units ?? '-'}
                                </TableCell>
                                <TableCell>
                                    {qual.elective_units ?? '-'}
                                </TableCell>
                                <TableCell>
                                    {qual.total_units ?? '-'}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={statusColors[qual.status] || ''}>
                                        {qual.status.charAt(0).toUpperCase() + qual.status.slice(1)}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {qual.release_date
                                        ? new Date(qual.release_date).toLocaleDateString()
                                        : '-'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

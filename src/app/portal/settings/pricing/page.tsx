'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    DollarSign,
    Loader2,
    Search,
    Edit,
    ChevronDown,
    ChevronRight,
    Filter,
    RefreshCw
} from 'lucide-react';
import type { RtoOffering, Qualification } from '@/types/database';
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS } from '@/types/database';
import { PricingEditDialog } from '@/components/pricing-edit-dialog';
import { PriceHistoryPanel } from '@/components/price-history-panel';

interface OfferingWithRelations extends RtoOffering {
    qualification: Qualification;
}

export default function PricingPage() {
    const [offerings, setOfferings] = useState<OfferingWithRelations[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [editingOffering, setEditingOffering] = useState<OfferingWithRelations | null>(null);
    const supabase = createClient();

    const fetchData = useCallback(async () => {
        setLoading(true);

        // Fetch all offerings with RTO and qualification data
        const { data: offeringsData } = await supabase
            .from('rto_offerings')
            .select('*, qualification:qualifications(*)')
            .eq('is_deleted', false)
            .eq('is_active', true)
            .order('updated_at', { ascending: false });

        if (offeringsData) {
            setOfferings(offeringsData as OfferingWithRelations[]);
        }

        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void fetchData();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [fetchData]);

    // Filter offerings based on search and filters
    const filteredOfferings = offerings.filter((offering) => {
        const matchesSearch =
            searchQuery === '' ||
            offering.qualification?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            offering.qualification?.code?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus =
            statusFilter === 'all' || offering.approval_status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const formatCurrency = (amount: number | null) => {
        if (amount === null || amount === undefined) return '-';
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
        }).format(amount);
    };

    const formatDate = (date: string | null) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const handleEditSave = async () => {
        await fetchData();
        setEditingOffering(null);
    };

    const toggleRowExpand = (id: string) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    if (loading) {
        return (
            <main className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </main>
        );
    }

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-4 sm:px-6 py-4 sticky top-0 z-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-semibold text-foreground">Pricing Management</h1>
                            <p className="text-sm text-muted-foreground">
                                Manage fee structures and track price versions
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={fetchData} size="sm" className="self-start sm:self-auto sm:size-default">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </header>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{offerings.length}</div>
                            <p className="text-sm text-muted-foreground">Qualification Price Lists</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-green-600">
                                {offerings.filter(o => o.approval_status === 'published').length}
                            </div>
                            <p className="text-sm text-muted-foreground">Published</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-yellow-600">
                                {offerings.filter(o => o.approval_status === 'pending_review').length}
                            </div>
                            <p className="text-sm text-muted-foreground">Pending Review</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-gray-600">
                                {offerings.filter(o => o.approval_status === 'draft').length}
                            </div>
                            <p className="text-sm text-muted-foreground">Draft</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Filter className="h-4 w-4" />
                            Filters
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-4">
                            <div className="flex-1 min-w-[200px]">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search qualification..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filter by status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="published">Published</SelectItem>
                                    <SelectItem value="pending_review">Pending Review</SelectItem>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="archived">Archived</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Fee Schedule Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Fee Schedule</CardTitle>
                        <CardDescription>
                            {filteredOfferings.length} qualification price list{filteredOfferings.length !== 1 ? 's' : ''} found
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-6 sm:pt-0">
                        <div className="rounded-md border overflow-x-auto">
                            <Table className="min-w-[900px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40px]"></TableHead>
                                        <TableHead>Qualification</TableHead>
                                        <TableHead className="text-right">Tuition (Onshore)</TableHead>
                                        <TableHead className="text-right">Tuition (Miscellaneous)</TableHead>
                                        <TableHead className="text-right">Materials</TableHead>
                                        <TableHead className="text-right">Application</TableHead>
                                        <TableHead>Effective</TableHead>
                                        <TableHead>Version</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredOfferings.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                                                No price lists found matching your criteria
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredOfferings.map((offering) => (
                                            <React.Fragment key={offering.id}>
                                                <TableRow className="hover:bg-muted/50">
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            onClick={() => toggleRowExpand(offering.id)}
                                                        >
                                                            {expandedRow === offering.id ? (
                                                                <ChevronDown className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronRight className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div>
                                                            <div className="font-medium">{offering.qualification?.name}</div>
                                                            <div className="text-xs text-muted-foreground font-mono">
                                                                {offering.qualification?.code}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {formatCurrency(offering.tuition_fee_onshore)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {formatCurrency(offering.tuition_fee_miscellaneous)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {formatCurrency(offering.material_fee)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {formatCurrency(offering.application_fee)}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {formatDate(offering.effective_date)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">v{offering.version}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={APPROVAL_STATUS_COLORS[offering.approval_status]}>
                                                            {APPROVAL_STATUS_LABELS[offering.approval_status]}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setEditingOffering(offering)}
                                                        >
                                                            <Edit className="h-4 w-4 mr-1" />
                                                            Edit
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                                {expandedRow === offering.id && (
                                                    <TableRow>
                                                        <TableCell colSpan={10} className="bg-muted/30 p-4">
                                                            <PriceHistoryPanel offeringId={offering.id} />
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Edit Dialog */}
            {editingOffering && (
                <PricingEditDialog
                    offering={editingOffering}
                    open={!!editingOffering}
                    onOpenChange={(open) => !open && setEditingOffering(null)}
                    onSave={handleEditSave}
                />
            )}
        </main>
    );
}

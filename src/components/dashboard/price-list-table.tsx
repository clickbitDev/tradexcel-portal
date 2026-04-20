'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RtoOffering, Qualification } from '@/types/database';

interface OfferingWithRelations extends RtoOffering {
    qualification: Qualification;
}

export function PriceListTable() {
    const [offerings, setOfferings] = useState<OfferingWithRelations[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const supabase = createClient();

    const fetchData = useCallback(async () => {
        setLoading(true);

        // Fetch all offerings with RTO and qualification data
        const { data: offeringsData } = await supabase
            .from('rto_offerings')
            .select('*, qualification:qualifications(*)')
            .eq('is_active', true)
            .eq('is_deleted', false)
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

        return matchesSearch;
    });

    const formatCurrency = (amount: number | null | undefined) => {
        if (amount === null || amount === undefined) return '-';
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const calculateTotal = (offering: OfferingWithRelations, useOnshore: boolean) => {
        const tuition = useOnshore ? (offering.tuition_fee_onshore || 0) : (offering.tuition_fee_miscellaneous || 0);
        const material = offering.material_fee || 0;
        const application = offering.application_fee || 0;
        const agent = offering.agent_fee || 0;
        const student = offering.student_fee || 0;
        const enrollment = offering.enrollment_fee || 0;
        const misc = offering.misc_fee || 0;
        const assessor = offering.assessor_fee || 0;
        const provider = offering.provider_fee || 0;
        return tuition + material + application + agent + student + enrollment + misc + assessor + provider;
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <CardTitle className="text-lg">Price List</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Qualification-level fee breakdown across the portal
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchData}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search qualification..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Price Table */}
                <div className="rounded-md border overflow-x-auto">
                    <Table className="min-w-[2550px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-[180px] sticky left-0 bg-background z-10">Qualification</TableHead>
                                <TableHead className="text-right text-xs">Core Units</TableHead>
                                <TableHead className="text-right text-xs">Elective Units</TableHead>
                                <TableHead className="text-right text-xs">Total Units</TableHead>
                                <TableHead className="text-right text-xs">Assessor Fee</TableHead>
                                <TableHead className="text-right text-xs">Provider Fee</TableHead>
                                <TableHead className="text-right text-xs">Agent Fee</TableHead>
                                <TableHead className="text-right text-xs">Student Fee</TableHead>
                                <TableHead className="text-right text-xs">Enrollment</TableHead>
                                <TableHead className="text-right text-xs">Material</TableHead>
                                <TableHead className="text-right text-xs">Application</TableHead>
                                <TableHead className="text-right text-xs">Misc</TableHead>
                                <TableHead className="text-right text-xs">Onshore</TableHead>
                                <TableHead className="text-right text-xs">Miscellaneous</TableHead>
                                <TableHead className="text-right bg-primary/10 font-semibold text-xs">Total (Onshore)</TableHead>
                                <TableHead className="text-right bg-primary/10 font-semibold text-xs">Total (Miscellaneous)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredOfferings.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={16} className="text-center py-8 text-muted-foreground">
                                        No price lists found matching your criteria
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredOfferings.map((offering) => (
                                    <TableRow key={offering.id} className="hover:bg-muted/30">
                                        <TableCell className="sticky left-0 bg-background z-10">
                                            <div>
                                                <div className="font-medium text-sm">{offering.qualification?.code}</div>
                                                <div className="text-xs text-muted-foreground line-clamp-2">
                                                    {offering.qualification?.name}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-sm">
                                            {offering.qualification?.core_units ?? '-'}
                                        </TableCell>
                                        <TableCell className="text-right text-sm">
                                            {offering.qualification?.elective_units ?? '-'}
                                        </TableCell>
                                        <TableCell className="text-right text-sm font-medium">
                                            {offering.qualification?.total_units ?? '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {formatCurrency(offering.assessor_fee)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {formatCurrency(offering.provider_fee)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {formatCurrency(offering.agent_fee)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {formatCurrency(offering.student_fee)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {formatCurrency(offering.enrollment_fee)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {formatCurrency(offering.material_fee)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {formatCurrency(offering.application_fee)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {formatCurrency(offering.misc_fee)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {formatCurrency(offering.tuition_fee_onshore)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {formatCurrency(offering.tuition_fee_miscellaneous)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm font-semibold bg-primary/5">
                                            {formatCurrency(calculateTotal(offering, true))}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm font-semibold bg-primary/5">
                                            {formatCurrency(calculateTotal(offering, false))}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Results count */}
                <p className="text-sm text-muted-foreground text-center">
                    Showing {filteredOfferings.length} of {offerings.length} offering{offerings.length !== 1 ? 's' : ''}
                </p>
            </CardContent>
        </Card>
    );
}

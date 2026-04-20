'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, History, Calendar, User, DollarSign } from 'lucide-react';
import type { PriceVersion, Profile } from '@/types/database';

interface PriceVersionWithApprover extends PriceVersion {
    approver?: Profile;
}

interface PriceHistoryPanelProps {
    offeringId: string;
}

export function PriceHistoryPanel({ offeringId }: PriceHistoryPanelProps) {
    const [versions, setVersions] = useState<PriceVersionWithApprover[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const fetchHistory = async () => {
            const { data } = await supabase
                .from('price_versions')
                .select('*, approver:profiles!price_versions_approved_by_fkey(*)')
                .eq('offering_id', offeringId)
                .order('created_at', { ascending: false });

            if (data) {
                setVersions(data as PriceVersionWithApprover[]);
            }
            setLoading(false);
        };

        fetchHistory();
    }, [offeringId, supabase]);

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

    const formatDateTime = (date: string) => {
        return new Date(date).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (versions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <History className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No price history available</p>
                <p className="text-xs">Price changes will appear here</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
                <History className="h-4 w-4" />
                Price History ({versions.length} version{versions.length !== 1 ? 's' : ''})
            </h4>

            <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />

                <div className="space-y-4">
                    {versions.map((version, index) => (
                        <div key={version.id} className="relative pl-8">
                            {/* Timeline dot */}
                            <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center ${index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                }`}>
                                <DollarSign className="h-3 w-3" />
                            </div>

                            <div className="bg-card border rounded-lg p-4">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3 text-sm">
                                        <span className="flex items-center gap-1 text-muted-foreground">
                                            <Calendar className="h-3 w-3" />
                                            {formatDate(version.effective_from)}
                                            {version.effective_to && (
                                                <> → {formatDate(version.effective_to)}</>
                                            )}
                                        </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {formatDateTime(version.created_at)}
                                    </span>
                                </div>

                                {/* Pricing grid */}
                                <div className="grid grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <span className="text-xs text-muted-foreground">Onshore</span>
                                        <p className="font-mono font-medium">
                                            {formatCurrency(version.tuition_fee_onshore)}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-foreground">Miscellaneous</span>
                                        <p className="font-mono font-medium">
                                            {formatCurrency(version.tuition_fee_miscellaneous)}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-foreground">Materials</span>
                                        <p className="font-mono font-medium">
                                            {formatCurrency(version.material_fee)}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-foreground">Application</span>
                                        <p className="font-mono font-medium">
                                            {formatCurrency(version.application_fee)}
                                        </p>
                                    </div>
                                </div>

                                {/* Notes */}
                                {version.approval_notes && (
                                    <div className="mt-3 pt-3 border-t text-sm">
                                        <p className="text-muted-foreground">{version.approval_notes}</p>
                                    </div>
                                )}

                                {/* Approver */}
                                {version.approver && (
                                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                        <User className="h-3 w-3" />
                                        Approved by {version.approver.full_name || version.approver.email}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

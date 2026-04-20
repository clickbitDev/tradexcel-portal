'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
    calculateOfferingTotals,
    createEmptyQualificationOfferingRow,
    type QualificationOfferingFormRow,
} from '@/lib/qualifications/offering-pricing';

interface QualificationOfferingsEditorProps {
    rows: QualificationOfferingFormRow[];
    onChange: (rows: QualificationOfferingFormRow[]) => void;
    disabled?: boolean;
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function QualificationOfferingsEditor({ rows, onChange, disabled = false }: QualificationOfferingsEditorProps) {
    const row = useMemo(() => rows[0] || createEmptyQualificationOfferingRow(), [rows]);
    const totals = useMemo(() => calculateOfferingTotals(row), [row]);

    const updateRow = (clientId: string, field: keyof QualificationOfferingFormRow, value: string) => {
        onChange(rows.map((row) => row.clientId === clientId ? { ...row, [field]: value } : row));
    };

    const updateSingleRow = (field: keyof QualificationOfferingFormRow, value: string) => {
        if (rows.length === 0) {
            onChange([{ ...createEmptyQualificationOfferingRow(), [field]: value }]);
            return;
        }

        updateRow(row.clientId, field, value);
    };

    return (
        <Card>
            <CardHeader>
                <div>
                    <CardTitle>Price List Fields</CardTitle>
                    <CardDescription>
                        Define the single price list used for this qualification across applications and reporting.
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="rounded-xl border p-4 shadow-sm">
                    <div className="mb-4">
                        <h3 className="text-sm font-semibold text-foreground">Qualification Price List</h3>
                        <p className="text-xs text-muted-foreground">
                            Maintain one active price list for this qualification.
                        </p>
                    </div>

                    <div className="space-y-5">
                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor={`${row.clientId}-onshore-total`}>Total (Onshore)</Label>
                                <div
                                    id={`${row.clientId}-onshore-total`}
                                    className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-semibold"
                                >
                                    {formatCurrency(totals.onshore)}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor={`${row.clientId}-misc-total`}>Total (Miscellaneous)</Label>
                                <div
                                    id={`${row.clientId}-misc-total`}
                                    className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-semibold"
                                >
                                    {formatCurrency(totals.miscellaneous)}
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {[
                                ['assessor_fee', 'Assessor Fee'],
                                ['provider_fee', 'Provider Fee'],
                                ['agent_fee', 'Agent Fee'],
                                ['student_fee', 'Student Fee'],
                                ['enrollment_fee', 'Enrollment Fee'],
                                ['material_fee', 'Material Fee'],
                                ['application_fee', 'Application Fee'],
                                ['misc_fee', 'Misc Fee'],
                                ['tuition_fee_onshore', 'Tuition Fee (Onshore)'],
                                ['tuition_fee_miscellaneous', 'Tuition Fee (Miscellaneous)'],
                            ].map(([field, label]) => (
                                <div key={field} className="space-y-2">
                                    <Label htmlFor={`${row.clientId}-${field}`}>{label}</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                        <Input
                                            id={`${row.clientId}-${field}`}
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="pl-7"
                                            value={row[field as keyof QualificationOfferingFormRow] as string}
                                            onChange={(event) => updateSingleRow(
                                                field as keyof QualificationOfferingFormRow,
                                                event.target.value
                                            )}
                                            disabled={disabled}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <input
                            type="hidden"
                            value={row.effective_date}
                            onChange={() => undefined}
                            className={cn('hidden')}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, DollarSign, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { RtoOffering, Qualification } from '@/types/database';

interface OfferingWithRelations extends RtoOffering {
    qualification?: Qualification;
}

interface PricingEditDialogProps {
    offering: OfferingWithRelations;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
}

export function PricingEditDialog({
    offering,
    open,
    onOpenChange,
    onSave,
}: PricingEditDialogProps) {
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        tuition_fee_onshore: offering.tuition_fee_onshore ?? 0,
        tuition_fee_miscellaneous: offering.tuition_fee_miscellaneous ?? 0,
        material_fee: offering.material_fee ?? 0,
        application_fee: offering.application_fee ?? 0,
        assessor_fee: offering.assessor_fee ?? 0,
        provider_fee: offering.provider_fee ?? 0,
        agent_fee: offering.agent_fee ?? 0,
        student_fee: offering.student_fee ?? 0,
        enrollment_fee: offering.enrollment_fee ?? 0,
        misc_fee: offering.misc_fee ?? 0,
    });
    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            // 1. Create price version record with old values
            const { error: versionError } = await supabase.from('price_versions').insert({
                offering_id: offering.id,
                tuition_fee_onshore: offering.tuition_fee_onshore,
                tuition_fee_miscellaneous: offering.tuition_fee_miscellaneous,
                material_fee: offering.material_fee,
                application_fee: offering.application_fee,
                assessor_fee: offering.assessor_fee,
                provider_fee: offering.provider_fee,
                agent_fee: offering.agent_fee,
                student_fee: offering.student_fee,
                enrollment_fee: offering.enrollment_fee,
                misc_fee: offering.misc_fee,
                effective_from: offering.effective_date,
                effective_to: new Date().toISOString().split('T')[0],
                approval_notes: `Archived: Version ${offering.version}`,
            });

            if (versionError) {
                console.error('Error creating price version:', versionError);
                toast.error('Failed to archive current pricing version');
            }

            // 2. Update the offering with new values
            const { error: updateError } = await supabase
                .from('rto_offerings')
                .update({
                    tuition_fee_onshore: formData.tuition_fee_onshore,
                    tuition_fee_miscellaneous: formData.tuition_fee_miscellaneous,
                    material_fee: formData.material_fee,
                    application_fee: formData.application_fee,
                    assessor_fee: formData.assessor_fee,
                    provider_fee: formData.provider_fee,
                    agent_fee: formData.agent_fee,
                    student_fee: formData.student_fee,
                    enrollment_fee: formData.enrollment_fee,
                    misc_fee: formData.misc_fee,
                    effective_date: new Date().toISOString().split('T')[0],
                    version: offering.version + 1,
                    approval_status: 'published', // Auto-publish for now
                })
                .eq('id', offering.id);

            if (updateError) {
                console.error('Error updating offering:', updateError);
                toast.error(`Failed to update pricing: ${updateError.message}`);
                return;
            }

            // 3. Log audit entry
            await supabase.from('audit_logs').insert({
                action: 'price_update',
                table_name: 'rto_offerings',
                record_id: offering.id,
                old_data: {
                    tuition_fee_onshore: offering.tuition_fee_onshore,
                    tuition_fee_miscellaneous: offering.tuition_fee_miscellaneous,
                    material_fee: offering.material_fee,
                    application_fee: offering.application_fee,
                    assessor_fee: offering.assessor_fee,
                    provider_fee: offering.provider_fee,
                    agent_fee: offering.agent_fee,
                    student_fee: offering.student_fee,
                    enrollment_fee: offering.enrollment_fee,
                    misc_fee: offering.misc_fee,
                    version: offering.version,
                },
                new_data: {
                    tuition_fee_onshore: formData.tuition_fee_onshore,
                    tuition_fee_miscellaneous: formData.tuition_fee_miscellaneous,
                    material_fee: formData.material_fee,
                    application_fee: formData.application_fee,
                    assessor_fee: formData.assessor_fee,
                    provider_fee: formData.provider_fee,
                    agent_fee: formData.agent_fee,
                    student_fee: formData.student_fee,
                    enrollment_fee: formData.enrollment_fee,
                    misc_fee: formData.misc_fee,
                    version: offering.version + 1,
                },
            });

            toast.success('Pricing updated successfully!');
            onSave();
        } catch (error) {
            console.error('Error saving pricing:', error);
            toast.error(error instanceof Error ? error.message : 'An unexpected error occurred');
        } finally {
            setSaving(false);
        }
    };

    const formatCurrency = (amount: number | null) => {
        if (amount === null) return '-';
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
        }).format(amount);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-primary" />
                            Update Pricing
                        </DialogTitle>
                        <DialogDescription>
                            <span className="font-medium text-foreground">{offering.qualification?.name}</span>
                        </DialogDescription>
                    </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="grid gap-6 py-4">
                        {/* Current vs New comparison */}
                        <div className="bg-muted/50 rounded-lg p-4">
                            <h4 className="text-sm font-medium mb-3">Current Pricing (Version {offering.version})</h4>
                            <div className="grid grid-cols-4 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Onshore</span>
                                    <p className="font-mono">{formatCurrency(offering.tuition_fee_onshore)}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Miscellaneous</span>
                                    <p className="font-mono">{formatCurrency(offering.tuition_fee_miscellaneous)}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Materials</span>
                                    <p className="font-mono">{formatCurrency(offering.material_fee)}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Application</span>
                                    <p className="font-mono">{formatCurrency(offering.application_fee)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="tuition_onshore">Tuition Fee (Onshore)</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input
                                        id="tuition_onshore"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="pl-7"
                                        value={formData.tuition_fee_onshore}
                                        onChange={(e) =>
                                            setFormData({ ...formData, tuition_fee_onshore: parseFloat(e.target.value) || 0 })
                                        }
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="tuition_miscellaneous">Tuition Fee (Miscellaneous)</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input
                                        id="tuition_miscellaneous"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="pl-7"
                                        value={formData.tuition_fee_miscellaneous}
                                        onChange={(e) =>
                                            setFormData({ ...formData, tuition_fee_miscellaneous: parseFloat(e.target.value) || 0 })
                                        }
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="material_fee">Material Fee</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input
                                        id="material_fee"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="pl-7"
                                        value={formData.material_fee}
                                        onChange={(e) =>
                                            setFormData({ ...formData, material_fee: parseFloat(e.target.value) || 0 })
                                        }
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="application_fee">Application Fee</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input
                                        id="application_fee"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="pl-7"
                                        value={formData.application_fee}
                                        onChange={(e) =>
                                            setFormData({ ...formData, application_fee: parseFloat(e.target.value) || 0 })
                                        }
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="agent_fee">Agent Fee</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input id="agent_fee" type="number" step="0.01" min="0" className="pl-7" value={formData.agent_fee} onChange={(e) => setFormData({ ...formData, agent_fee: parseFloat(e.target.value) || 0 })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="assessor_fee">Assessor Fee</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input id="assessor_fee" type="number" step="0.01" min="0" className="pl-7" value={formData.assessor_fee} onChange={(e) => setFormData({ ...formData, assessor_fee: parseFloat(e.target.value) || 0 })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="provider_fee">Provider Fee</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input id="provider_fee" type="number" step="0.01" min="0" className="pl-7" value={formData.provider_fee} onChange={(e) => setFormData({ ...formData, provider_fee: parseFloat(e.target.value) || 0 })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="student_fee">Student Fee</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input id="student_fee" type="number" step="0.01" min="0" className="pl-7" value={formData.student_fee} onChange={(e) => setFormData({ ...formData, student_fee: parseFloat(e.target.value) || 0 })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="enrollment_fee">Enrollment Fee</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input id="enrollment_fee" type="number" step="0.01" min="0" className="pl-7" value={formData.enrollment_fee} onChange={(e) => setFormData({ ...formData, enrollment_fee: parseFloat(e.target.value) || 0 })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="misc_fee">Misc Fee</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input id="misc_fee" type="number" step="0.01" min="0" className="pl-7" value={formData.misc_fee} onChange={(e) => setFormData({ ...formData, misc_fee: parseFloat(e.target.value) || 0 })} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

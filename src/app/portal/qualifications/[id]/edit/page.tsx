/**
 * Edit Qualification Page
 * 
 * Form for editing an existing qualification
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2, GraduationCap, Save } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { QualificationOfferingsEditor } from '@/components/qualifications/QualificationOfferingsEditor';
import {
    buildOfferingSavePayload,
    createEmptyQualificationOfferingRow,
    hasOfferingPricingChanges,
    isOfferingRowEmpty,
    mapOfferingToFormRow,
    type QualificationOfferingFormRow,
    type QualificationOfferingWithRto,
    validateOfferingRows,
} from '@/lib/qualifications/offering-pricing';

const QUALIFICATION_LEVELS = [
    'Certificate I',
    'Certificate II',
    'Certificate III',
    'Certificate IV',
    'Diploma',
    'Advanced Diploma',
    'Graduate Certificate',
    'Graduate Diploma',
    'Bachelor Degree',
    'Masters Degree',
];

const DELIVERY_MODES = [
    { value: 'rpl', label: 'RPL (Recognition of Prior Learning)' },
    { value: 'online', label: 'Online' },
    { value: 'face_to_face', label: 'Face-to-Face' },
    { value: 'blended', label: 'Blended' },
];

export default function EditQualificationPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [initialPriceList, setInitialPriceList] = useState<QualificationOfferingWithRto | null>(null);
    const [offeringRows, setOfferingRows] = useState<QualificationOfferingFormRow[]>([
        createEmptyQualificationOfferingRow(),
    ]);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        level: '',
        core_units: '',
        elective_units: '',
        total_units: '',
        status: 'current',
        release_date: '',
        superseded_by: '',
        entry_requirements: '',
        cricos_code: '',
        delivery_mode: [] as string[],
    });

    const supabase = createClient();

    useEffect(() => {
        const loadQualification = async () => {
            const [{ data, error }, { data: offeringsData, error: offeringsError }] = await Promise.all([
                supabase
                    .from('qualifications')
                    .select('*')
                    .eq('id', id)
                    .single(),
                supabase
                    .from('rto_offerings')
                    .select('*')
                    .eq('qualification_id', id)
                    .eq('is_active', true)
                    .eq('is_deleted', false)
                    .order('updated_at', { ascending: false }),
            ]);

            if (error) {
                console.error('Error loading qualification:', error);
                toast.error('Failed to load qualification');
                router.push('/portal/qualifications');
                return;
            }

            if (offeringsError) {
                console.error('Error loading qualification offerings:', offeringsError);
                toast.error('Failed to load qualification pricing rows');
                router.push('/portal/qualifications');
                return;
            }

            if (data) {
                setFormData({
                    code: data.code || '',
                    name: data.name || '',
                    level: data.level || '',
                    core_units: data.core_units !== null && data.core_units !== undefined ? String(data.core_units) : '',
                    elective_units: data.elective_units !== null && data.elective_units !== undefined ? String(data.elective_units) : '',
                    total_units: data.total_units !== null && data.total_units !== undefined ? String(data.total_units) : '',
                    status: data.status || 'current',
                    release_date: data.release_date || '',
                    superseded_by: data.superseded_by || '',
                    entry_requirements: data.entry_requirements || '',
                    cricos_code: data.cricos_code || '',
                    delivery_mode: data.delivery_mode || [],
                });
            }

            const normalizedOfferings = (offeringsData || []) as QualificationOfferingWithRto[];
            const currentPriceList = normalizedOfferings[0] || null;
            setInitialPriceList(currentPriceList);
            setOfferingRows(
                currentPriceList
                    ? [mapOfferingToFormRow(currentPriceList)]
                    : [createEmptyQualificationOfferingRow()]
            );
            setLoading(false);
        };

        void loadQualification();
    }, [id, router, supabase]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.code || !formData.name) {
            toast.error('Code and Name are required');
            return;
        }

        const pricingValidationError = validateOfferingRows(offeringRows);
        if (pricingValidationError) {
            toast.error(pricingValidationError);
            return;
        }

        const parseUnitCount = (value: string): number | null => {
            if (value === '') return null;
            const parsed = Number.parseInt(value, 10);
            return Number.isNaN(parsed) ? null : parsed;
        };

        const coreUnits = parseUnitCount(formData.core_units);
        const electiveUnits = parseUnitCount(formData.elective_units);
        const hasAnyUnitBreakdown = coreUnits !== null || electiveUnits !== null;
        const totalUnits = hasAnyUnitBreakdown
            ? (coreUnits ?? 0) + (electiveUnits ?? 0)
            : (formData.total_units ? Number(formData.total_units) : null);

        setSaving(true);

        try {
            // Get current user for last_edited_by
            const { data: { user } } = await supabase.auth.getUser();
            const priceListRow = offeringRows.find((row) => !isOfferingRowEmpty(row)) || offeringRows[0] || createEmptyQualificationOfferingRow();

            const { data, error } = await supabase
                .from('qualifications')
                .update({
                    code: formData.code.toUpperCase(),
                    name: formData.name,
                    level: formData.level || null,
                    core_units: coreUnits,
                    elective_units: electiveUnits,
                    total_units: totalUnits,
                    status: formData.status,
                    release_date: formData.release_date || null,
                    superseded_by: formData.superseded_by || null,
                    entry_requirements: formData.entry_requirements || null,
                    cricos_code: formData.cricos_code || null,
                    delivery_mode: formData.delivery_mode.length > 0 ? formData.delivery_mode : null,
                    last_edited_by: user?.id || null,
                })
                .eq('id', id)
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    toast.error('A qualification with this code already exists');
                } else if (error.code === 'PGRST116') {
                    // No rows returned - likely RLS blocking the update
                    toast.error('You do not have permission to edit this qualification');
                } else {
                    throw error;
                }
            } else if (!data) {
                toast.error('Failed to update - qualification not found or access denied');
            } else {
                const pricingPayload = buildOfferingSavePayload(priceListRow);

                const { error: archiveOtherRowsError } = await supabase
                    .from('rto_offerings')
                    .update({
                        is_active: false,
                        is_archived: true,
                        archived_at: new Date().toISOString(),
                        archived_by: user?.id || null,
                    })
                    .eq('qualification_id', id)
                    .neq('id', initialPriceList?.id || '00000000-0000-0000-0000-000000000000')
                    .eq('is_deleted', false)
                    .eq('is_active', true);

                if (archiveOtherRowsError) {
                    throw archiveOtherRowsError;
                }

                if (initialPriceList) {
                    if (hasOfferingPricingChanges(initialPriceList, priceListRow)) {
                        const { error: versionError } = await supabase
                            .from('price_versions')
                            .insert({
                                offering_id: initialPriceList.id,
                                tuition_fee_onshore: initialPriceList.tuition_fee_onshore,
                                tuition_fee_miscellaneous: initialPriceList.tuition_fee_miscellaneous,
                                material_fee: initialPriceList.material_fee,
                                application_fee: initialPriceList.application_fee,
                                assessor_fee: initialPriceList.assessor_fee,
                                provider_fee: initialPriceList.provider_fee,
                                agent_fee: initialPriceList.agent_fee,
                                student_fee: initialPriceList.student_fee,
                                enrollment_fee: initialPriceList.enrollment_fee,
                                misc_fee: initialPriceList.misc_fee,
                                effective_from: initialPriceList.effective_date,
                                effective_to: pricingPayload.effective_date,
                                approval_notes: `Archived from qualification edit: Version ${initialPriceList.version}`,
                            });

                        if (versionError) {
                            console.error('Failed to archive qualification price list version:', versionError);
                        }

                        const { error: offeringUpdateError } = await supabase
                            .from('rto_offerings')
                            .update({
                                ...pricingPayload,
                                rto_id: null,
                                is_active: true,
                                is_archived: false,
                                archived_at: null,
                                archived_by: null,
                                approval_status: 'published',
                                version: (initialPriceList.version || 1) + 1,
                            })
                            .eq('id', initialPriceList.id);

                        if (offeringUpdateError) {
                            throw offeringUpdateError;
                        }
                    }
                } else {
                    const { error: offeringInsertError } = await supabase
                        .from('rto_offerings')
                        .insert({
                            qualification_id: id,
                            rto_id: null,
                            ...pricingPayload,
                            approval_status: 'published',
                            version: 1,
                            is_active: true,
                            is_archived: false,
                            is_deleted: false,
                        });

                    if (offeringInsertError) {
                        throw offeringInsertError;
                    }
                }

                toast.success('Qualification updated successfully');
                router.push(`/portal/qualifications/${id}`);
            }
        } catch (error) {
            console.error('Error updating qualification:', error);
            toast.error('Failed to update qualification. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <main className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </main>
        );
    }

    const derivedTotalUnits = (() => {
        const coreUnits = formData.core_units ? Number.parseInt(formData.core_units, 10) : null;
        const electiveUnits = formData.elective_units ? Number.parseInt(formData.elective_units, 10) : null;
        const hasUnitBreakdown = formData.core_units !== '' || formData.elective_units !== '';

        if (hasUnitBreakdown && (coreUnits !== null || electiveUnits !== null)) {
            return String((coreUnits || 0) + (electiveUnits || 0));
        }

        return formData.total_units;
    })();

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link href={`/portal/qualifications/${id}`}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                            <GraduationCap className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-foreground">Edit Qualification</h1>
                            <p className="text-sm text-muted-foreground font-mono">{formData.code}</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="p-6 max-w-6xl mx-auto">
                <form onSubmit={handleSubmit}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Qualification Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Code & Name */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="code">Code *</Label>
                                    <Input
                                        id="code"
                                        placeholder="e.g., BSB50120"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        className="font-mono uppercase"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="level">Level</Label>
                                    <Select
                                        value={formData.level}
                                        onValueChange={(value) => setFormData({ ...formData, level: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select level" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {QUALIFICATION_LEVELS.map((level) => (
                                                <SelectItem key={level} value={level}>
                                                    {level}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name">Name *</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g., Diploma of Business"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-3">
                                <Label>Units</Label>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="core_units">Core Units</Label>
                                        <Input
                                            id="core_units"
                                            type="number"
                                            min="0"
                                            step="1"
                                            placeholder="e.g., 8"
                                            value={formData.core_units}
                                            onChange={(e) => setFormData({ ...formData, core_units: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="elective_units">Elective Units</Label>
                                        <Input
                                            id="elective_units"
                                            type="number"
                                            min="0"
                                            step="1"
                                            placeholder="e.g., 4"
                                            value={formData.elective_units}
                                            onChange={(e) => setFormData({ ...formData, elective_units: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="total_units">Total Units</Label>
                                        <Input
                                            id="total_units"
                                            value={derivedTotalUnits}
                                            readOnly
                                            className="bg-muted/40"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Total units are calculated automatically from core + elective units.
                                </p>
                            </div>

                            {/* Status & Release Date */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="status">Status</Label>
                                    <Select
                                        value={formData.status}
                                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="current">Current</SelectItem>
                                            <SelectItem value="superseded">Superseded</SelectItem>
                                            <SelectItem value="deleted">Deleted</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="release_date">Release Date</Label>
                                    <Input
                                        id="release_date"
                                        type="date"
                                        value={formData.release_date}
                                        onChange={(e) => setFormData({ ...formData, release_date: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* CRICOS & Superseded By */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="cricos_code">CRICOS Code</Label>
                                    <Input
                                        id="cricos_code"
                                        placeholder="e.g., 123456A"
                                        value={formData.cricos_code}
                                        onChange={(e) => setFormData({ ...formData, cricos_code: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="superseded_by">Superseded By</Label>
                                    <Input
                                        id="superseded_by"
                                        placeholder="e.g., BSB50220"
                                        value={formData.superseded_by}
                                        onChange={(e) => setFormData({ ...formData, superseded_by: e.target.value })}
                                        className="font-mono uppercase"
                                    />
                                </div>
                            </div>

                            {/* Entry Requirements */}
                            <div className="space-y-2">
                                <Label htmlFor="entry_requirements">Entry Requirements</Label>
                                <Textarea
                                    id="entry_requirements"
                                    placeholder="Describe the entry requirements..."
                                    value={formData.entry_requirements}
                                    onChange={(e) => setFormData({ ...formData, entry_requirements: e.target.value })}
                                    rows={3}
                                />
                            </div>

                            {/* Delivery Mode */}
                            <div className="space-y-3">
                                <Label>Delivery Mode</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    {DELIVERY_MODES.map((mode) => (
                                        <div key={mode.value} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`mode-${mode.value}`}
                                                checked={formData.delivery_mode.includes(mode.value)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setFormData({
                                                            ...formData,
                                                            delivery_mode: [...formData.delivery_mode, mode.value]
                                                        });
                                                    } else {
                                                        setFormData({
                                                            ...formData,
                                                            delivery_mode: formData.delivery_mode.filter(m => m !== mode.value)
                                                        });
                                                    }
                                                }}
                                            />
                                            <label
                                                htmlFor={`mode-${mode.value}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                            >
                                                {mode.label}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <QualificationOfferingsEditor
                                rows={offeringRows}
                                onChange={setOfferingRows}
                                disabled={saving}
                            />

                            {/* Submit */}
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Link href={`/portal/qualifications/${id}`}>
                                    <Button type="button" variant="outline">Cancel</Button>
                                </Link>
                                <Button type="submit" disabled={saving}>
                                    {saving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4 mr-2" />
                                            Save Changes
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </div>
        </main>
    );
}

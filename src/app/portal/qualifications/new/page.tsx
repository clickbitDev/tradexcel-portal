/**
 * New Qualification Page
 * 
 * Form for adding a new qualification manually
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, GraduationCap, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { deleteQualificationPreviewObject, requestQualificationPreviewUpload } from '@/lib/storage';
import { QualificationOfferingsEditor } from '@/components/qualifications/QualificationOfferingsEditor';
import {
    buildOfferingSavePayload,
    createEmptyQualificationOfferingRow,
    isOfferingRowEmpty,
    type QualificationOfferingFormRow,
    validateOfferingRows,
} from '@/lib/qualifications/offering-pricing';

const ALLOWED_CERTIFICATE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_CERTIFICATE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

type SupabaseErrorLike = {
    code?: string;
    message?: string;
} | null | undefined;

const isMissingColumnError = (error: SupabaseErrorLike): boolean => {
    const message = error?.message || '';
    return (
        error?.code === '42703' ||
        error?.code === 'PGRST204' ||
        message.includes('does not exist') ||
        message.includes('Could not find')
    );
};

export default function NewQualificationPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [certificateInputKey, setCertificateInputKey] = useState(0);
    const [prerequisiteInput, setPrerequisiteInput] = useState('');
    const [certificateImageFile, setCertificateImageFile] = useState<File | null>(null);
    const [certificateImagePreviewUrl, setCertificateImagePreviewUrl] = useState<string | null>(null);
    const [offeringRows, setOfferingRows] = useState<QualificationOfferingFormRow[]>([
        createEmptyQualificationOfferingRow(),
    ]);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        core_units: '',
        elective_units: '',
        status: 'current',
        release_date: '',
        superseded_by: '',
        entry_requirements: '',
        cricos_code: '',
        prerequisites: [] as string[],
    });

    useEffect(() => {
        if (!certificateImageFile) {
            setCertificateImagePreviewUrl(null);
            return;
        }

        const objectUrl = URL.createObjectURL(certificateImageFile);
        setCertificateImagePreviewUrl(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [certificateImageFile]);

    const addPrerequisite = () => {
        const value = prerequisiteInput.trim();
        if (!value) return;

        const alreadyExists = formData.prerequisites.some((item) => item.toLowerCase() === value.toLowerCase());
        if (alreadyExists) {
            alert('This prerequisite is already added');
            return;
        }

        setFormData((prev) => ({
            ...prev,
            prerequisites: [...prev.prerequisites, value],
        }));
        setPrerequisiteInput('');
    };

    const removePrerequisite = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            prerequisites: prev.prerequisites.filter((_, idx) => idx !== index),
        }));
    };

    const handleCertificateImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!ALLOWED_CERTIFICATE_IMAGE_TYPES.includes(file.type)) {
            alert('Please upload a JPG, PNG, or WebP image file');
            e.target.value = '';
            return;
        }

        if (file.size > MAX_CERTIFICATE_IMAGE_SIZE_BYTES) {
            alert('Image must be less than 5MB');
            e.target.value = '';
            return;
        }

        setCertificateImageFile(file);
    };

    const removeCertificateImage = () => {
        setCertificateImageFile(null);
        setCertificateInputKey((prev) => prev + 1);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.code || !formData.name) {
            alert('Code and Name are required');
            return;
        }

        const parseUnitCount = (value: string): number | null => {
            if (value === '') return null;
            const parsed = Number.parseInt(value, 10);
            return Number.isNaN(parsed) ? null : parsed;
        };

        const coreUnits = parseUnitCount(formData.core_units);
        const electiveUnits = parseUnitCount(formData.elective_units);
        const hasAnyUnitInput = coreUnits !== null || electiveUnits !== null;
        const totalUnits = hasAnyUnitInput
            ? (coreUnits ?? 0) + (electiveUnits ?? 0)
            : null;
        const pricingValidationError = validateOfferingRows(offeringRows);
        if (pricingValidationError) {
            alert(pricingValidationError);
            return;
        }

        setLoading(true);
        const supabase = createClient();
        let uploadedCertificatePath: string | null = null;
        let uploadedCertificateProvider: 'b2' | null = null;
        let uploadedCertificateBucket: string | null = null;
        let usedLegacyInsert = false;
        const hasExtendedInputs = formData.prerequisites.length > 0 || Boolean(certificateImageFile);
        const priceListRow = offeringRows.find((row) => !isOfferingRowEmpty(row)) || offeringRows[0] || createEmptyQualificationOfferingRow();

        const baseInsertPayload = {
            code: formData.code.toUpperCase(),
            name: formData.name,
            core_units: coreUnits,
            elective_units: electiveUnits,
            total_units: totalUnits,
            status: formData.status,
            release_date: formData.release_date || null,
            superseded_by: formData.superseded_by || null,
            entry_requirements: formData.entry_requirements || null,
            cricos_code: formData.cricos_code || null,
        };

        try {
            const { error: schemaCheckError } = await supabase
                .from('qualifications')
                .select('id, prerequisites, certificate_preview_path, certificate_preview_provider, certificate_preview_bucket, certificate_preview_key')
                .limit(1);

            if (schemaCheckError && !isMissingColumnError(schemaCheckError)) {
                throw schemaCheckError;
            }

            const supportsExtendedFields = !schemaCheckError;

            if (supportsExtendedFields && certificateImageFile) {
                const uploadResult = await requestQualificationPreviewUpload({
                    qualificationCode: formData.code,
                    file: certificateImageFile,
                });

                if (!uploadResult.success || !uploadResult.storageKey) {
                    throw new Error(uploadResult.error || 'Failed to upload certificate preview image.');
                }

                uploadedCertificatePath = uploadResult.storageKey;
                uploadedCertificateProvider = uploadResult.storageProvider || 'b2';
                uploadedCertificateBucket = uploadResult.storageBucket || null;
            }

            const extendedInsertPayload = {
                ...baseInsertPayload,
                prerequisites: formData.prerequisites.length > 0 ? formData.prerequisites : null,
                certificate_preview_path: uploadedCertificatePath,
                certificate_preview_provider: uploadedCertificateProvider,
                certificate_preview_bucket: uploadedCertificateBucket,
                certificate_preview_key: uploadedCertificatePath,
            };

            let insertError: SupabaseErrorLike = null;

            if (supportsExtendedFields) {
                const { error } = await supabase
                    .from('qualifications')
                    .insert([extendedInsertPayload]);
                insertError = error;
            } else {
                const { error } = await supabase
                    .from('qualifications')
                    .insert([baseInsertPayload]);
                insertError = error;
                usedLegacyInsert = hasExtendedInputs;
            }

            if (insertError && isMissingColumnError(insertError)) {
                if (uploadedCertificatePath) {
                    await deleteQualificationPreviewObject(uploadedCertificatePath).catch((cleanupError) => {
                        console.error('Failed to clean up uploaded qualification preview:', cleanupError);
                    });
                }

                const { error: fallbackError } = await supabase
                    .from('qualifications')
                    .insert([baseInsertPayload]);

                insertError = fallbackError;
                usedLegacyInsert = hasExtendedInputs;
            }

            if (insertError) {
                if (uploadedCertificatePath) {
                    await deleteQualificationPreviewObject(uploadedCertificatePath).catch((cleanupError) => {
                        console.error('Failed to clean up uploaded qualification preview:', cleanupError);
                    });
                }

                if (insertError.code === '23505') {
                    alert('A qualification with this code already exists');
                } else if (isMissingColumnError(insertError)) {
                    alert('Database migration is pending. Run migration 047 to enable prerequisites and certificate preview image fields.');
                } else {
                    throw insertError;
                }
            } else {
                if (usedLegacyInsert) {
                    alert('Qualification created, but prerequisites and certificate preview were not saved because migration 047 is not applied yet.');
                }

                const { data: createdQualification } = await supabase
                    .from('qualifications')
                    .select('id')
                    .eq('code', formData.code.toUpperCase())
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle<{ id: string }>();

                if (!createdQualification?.id) {
                    throw new Error('Qualification was created but the price list could not be linked.');
                }

                const pricingPayload = buildOfferingSavePayload(priceListRow);
                const { error: offeringInsertError } = await supabase
                    .from('rto_offerings')
                    .insert({
                        qualification_id: createdQualification.id,
                        rto_id: null,
                        tuition_fee_onshore: pricingPayload.tuition_fee_onshore,
                        tuition_fee_miscellaneous: pricingPayload.tuition_fee_miscellaneous,
                        material_fee: pricingPayload.material_fee,
                        application_fee: pricingPayload.application_fee,
                        assessor_fee: pricingPayload.assessor_fee,
                        provider_fee: pricingPayload.provider_fee,
                        agent_fee: pricingPayload.agent_fee,
                        student_fee: pricingPayload.student_fee,
                        enrollment_fee: pricingPayload.enrollment_fee,
                        misc_fee: pricingPayload.misc_fee,
                        effective_date: pricingPayload.effective_date,
                        approval_status: 'published',
                        version: 1,
                        is_active: true,
                        is_archived: false,
                        is_deleted: false,
                    });

                if (offeringInsertError) {
                    throw offeringInsertError;
                }

                router.push('/portal/qualifications');
            }
        } catch (error) {
            console.error('Error creating qualification:', error);
            alert('Failed to create qualification. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link href="/portal/qualifications">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                            <GraduationCap className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-foreground">Add Qualification</h1>
                            <p className="text-sm text-muted-foreground">Create a new qualification</p>
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
                                <div className="grid grid-cols-2 gap-4">
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

                            {/* Prerequisites */}
                            <div className="space-y-3">
                                <Label htmlFor="prerequisite_input">Prerequisites</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="prerequisite_input"
                                        placeholder="Add prerequisite and press Enter"
                                        value={prerequisiteInput}
                                        onChange={(e) => setPrerequisiteInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addPrerequisite();
                                            }
                                        }}
                                    />
                                    <Button type="button" variant="outline" onClick={addPrerequisite}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add
                                    </Button>
                                </div>
                                {formData.prerequisites.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {formData.prerequisites.map((item, index) => (
                                            <Badge key={`${item}-${index}`} variant="secondary" className="gap-1 pr-1">
                                                {item}
                                                <button
                                                    type="button"
                                                    onClick={() => removePrerequisite(index)}
                                                    className="rounded-sm p-0.5 hover:bg-black/10"
                                                    aria-label={`Remove prerequisite ${item}`}
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">No prerequisites added yet.</p>
                                )}
                            </div>

                            {/* Certificate Preview Image */}
                            <div className="space-y-3">
                                <Label htmlFor="certificate_preview_image">Certificate Preview Image</Label>
                                <Input
                                    key={certificateInputKey}
                                    id="certificate_preview_image"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handleCertificateImageChange}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Upload JPG, PNG, or WebP image (max 5MB).
                                </p>

                                {certificateImagePreviewUrl && (
                                    <div className="space-y-3">
                                        <div className="rounded-md border border-border p-3 bg-muted/20">
                                            <Image
                                                src={certificateImagePreviewUrl}
                                                alt="Certificate preview"
                                                width={640}
                                                height={360}
                                                unoptimized
                                                className="max-h-64 w-auto rounded-md object-contain"
                                            />
                                        </div>
                                        <Button type="button" variant="outline" onClick={removeCertificateImage}>
                                            Remove Image
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <QualificationOfferingsEditor
                                rows={offeringRows}
                                onChange={setOfferingRows}
                                disabled={loading}
                            />

                            {/* Submit */}
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Link href="/portal/qualifications">
                                    <Button type="button" variant="outline">Cancel</Button>
                                </Link>
                                <Button type="submit" disabled={loading}>
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        'Create Qualification'
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

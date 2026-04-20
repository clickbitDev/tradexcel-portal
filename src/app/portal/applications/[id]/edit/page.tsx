'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useRecordLock } from '@/hooks/use-record-lock';
import { LockIndicator, LockBanner } from '@/components/ui/lock-indicator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2, Save, User, GraduationCap, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import type { Application, Qualification, Partner, WorkflowStage } from '@/types/database';
import { logFieldChanges } from '@/lib/activity-logger';
import { getPortalRouteBase } from '@/lib/routes/portal';
import { formatDateInput, formatTimeInput } from '@/lib/date-utils';

const STAGE_LABELS: Record<WorkflowStage, string> = {
    TRANSFERRED: 'Transferred',
    docs_review: 'Docs Review',
    enrolled: 'Enrolled',
    evaluate: 'Evaluate',
    accounts: 'Accounts',
    dispatch: 'Dispatch',
    completed: 'Completed',
};

const GENDERS = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const AUSTRALIAN_STATES = [
    { value: 'NSW', label: 'New South Wales' },
    { value: 'VIC', label: 'Victoria' },
    { value: 'QLD', label: 'Queensland' },
    { value: 'WA', label: 'Western Australia' },
    { value: 'SA', label: 'South Australia' },
    { value: 'TAS', label: 'Tasmania' },
    { value: 'ACT', label: 'Australian Capital Territory' },
    { value: 'NT', label: 'Northern Territory' },
];

interface OfferingWithRelations {
    id: string;
    qualification_id: string;
    rto_id: string | null;
    tuition_fee_onshore: number | null;
    material_fee: number;
    is_active: boolean;
    qualification?: { id: string; code: string; name: string } | null;
}

interface RawOffering extends Omit<OfferingWithRelations, 'qualification'> {
    qualification?: { id: string; code: string; name: string } | { id: string; code: string; name: string }[] | null;
}

interface ApplicationWithRelations extends Application {
    offering?: OfferingWithRelations | null;
    partner?: { id: string; company_name: string; type: string } | null;
}

const normalizeOffering = (raw: RawOffering | RawOffering[] | null | undefined): OfferingWithRelations | null => {
    if (!raw) return null;

    const offering = Array.isArray(raw) ? raw[0] : raw;
    if (!offering) return null;

    const qualification = Array.isArray(offering.qualification)
        ? offering.qualification[0] || null
        : offering.qualification || null;

    return {
        ...offering,
        qualification,
    };
};

const normalizePartner = (
    raw: { id: string; company_name: string; type: string } | { id: string; company_name: string; type: string }[] | null | undefined
) => {
    if (!raw) return null;
    return Array.isArray(raw) ? raw[0] || null : raw;
};

interface FormData {
    student_first_name: string;
    student_last_name: string;
    student_email: string;
    student_phone: string;
    student_dob: string;
    student_usi: string;
    student_passport_number: string;
    student_visa_number: string;
    student_visa_expiry: string;
    student_gender: string;
    student_country_of_birth: string;
    application_from: string;
    student_street_no: string;
    student_suburb: string;
    student_state: string;
    student_postcode: string;
    qualification_id: string;
    offering_id: string;
    partner_id: string;
    received_date: string;
    appointment_date: string;
    appointment_time: string;
    notes: string;
}

const emptyFormData: FormData = {
    student_first_name: '',
    student_last_name: '',
    student_email: '',
    student_phone: '',
    student_dob: '',
    student_usi: '',
    student_passport_number: '',
    student_visa_number: '',
    student_visa_expiry: '',
    student_gender: '',
    student_country_of_birth: '',
    application_from: '',
    student_street_no: '',
    student_suburb: '',
    student_state: '',
    student_postcode: '',
    qualification_id: '',
    offering_id: '',
    partner_id: '',
    received_date: '',
    appointment_date: '',
    appointment_time: '',
    notes: '',
};

const normalizeText = (value: string): string | null => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const valueForLog = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    return String(value);
};

const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
    }).format(amount);
};

export default function EditApplicationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const pathname = usePathname();
    const supabase = useMemo(() => createClient(), []);
    const { can, loading: permissionsLoading, role } = usePermissions();

    const routeBase = getPortalRouteBase(pathname, role);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [application, setApplication] = useState<ApplicationWithRelations | null>(null);
    const [formData, setFormData] = useState<FormData>(emptyFormData);

    const [qualifications, setQualifications] = useState<Qualification[]>([]);
    const [offerings, setOfferings] = useState<OfferingWithRelations[]>([]);
    const [filteredOfferings, setFilteredOfferings] = useState<OfferingWithRelations[]>([]);
    const [selectedOffering, setSelectedOffering] = useState<OfferingWithRelations | null>(null);
    const [partners, setPartners] = useState<Partner[]>([]);

    const {
        lockState,
        acquireLock,
        releaseLock,
        isLoading: lockLoading,
        error: lockError,
    } = useRecordLock({
        tableName: 'applications',
        recordId: id,
    });

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);

            const { data: appData, error: appError } = await supabase
                .from('applications')
                .select(`
          *,
          offering:rto_offerings(
            id,
            qualification_id,
            rto_id,
            tuition_fee_onshore,
            material_fee,
            is_active,
            qualification:qualifications(id, code, name)
          ),
          partner:partners(id, company_name, type)
        `)
                .eq('id', id)
                .single();

            if (appError || !appData) {
                setError('Application not found or you do not have access to edit it.');
                setLoading(false);
                return;
            }

            const rawApp = appData as Application & {
                offering?: RawOffering | RawOffering[] | null;
                partner?: { id: string; company_name: string; type: string } | { id: string; company_name: string; type: string }[] | null;
            };

            const typedApp: ApplicationWithRelations = {
                ...rawApp,
                offering: normalizeOffering(rawApp.offering),
                partner: normalizePartner(rawApp.partner),
            };

            setApplication(typedApp);

            setFormData({
                student_first_name: typedApp.student_first_name || '',
                student_last_name: typedApp.student_last_name || '',
                student_email: typedApp.student_email || '',
                student_phone: typedApp.student_phone || '',
                student_dob: formatDateInput(typedApp.student_dob),
                student_usi: typedApp.student_usi || '',
                student_passport_number: typedApp.student_passport_number || '',
                student_visa_number: typedApp.student_visa_number || '',
                student_visa_expiry: formatDateInput(typedApp.student_visa_expiry),
                student_gender: typedApp.student_gender || '',
                student_country_of_birth: typedApp.student_country_of_birth || typedApp.student_nationality || '',
                application_from: typedApp.application_from || '',
                student_street_no: typedApp.student_street_no || typedApp.student_address || '',
                student_suburb: typedApp.student_suburb || '',
                student_state: typedApp.student_state || '',
                student_postcode: typedApp.student_postcode || '',
                qualification_id: typedApp.offering?.qualification_id || typedApp.qualification_id || '',
                offering_id: typedApp.offering_id || '',
                partner_id: typedApp.partner_id || '',
                received_date: formatDateInput(typedApp.received_at || typedApp.created_at),
                appointment_date: formatDateInput(typedApp.appointment_date),
                appointment_time: formatTimeInput(typedApp.appointment_time),
                notes: typedApp.notes || '',
            });

            const offeringsQuery = supabase
                .from('rto_offerings')
                .select(`
          id,
          qualification_id,
          rto_id,
          tuition_fee_onshore,
          material_fee,
          is_active,
          qualification:qualifications(id, code, name)
        `);

            const offeringsRequest = typedApp.offering_id
                ? offeringsQuery.or(`is_active.eq.true,id.eq.${typedApp.offering_id}`)
                : offeringsQuery.eq('is_active', true);

            const [qualificationsResult, offeringsResult, partnersResult] = await Promise.all([
                supabase
                    .from('qualifications')
                    .select('*')
                    .eq('status', 'current')
                    .order('name', { ascending: true }),
                offeringsRequest,
                supabase
                    .from('partners')
                    .select('*')
                    .eq('status', 'active')
                    .in('type', ['agent', 'subagent'])
                    .order('company_name', { ascending: true }),
            ]);

            setQualifications((qualificationsResult.data || []) as Qualification[]);
            const normalizedOfferings = ((offeringsResult.data || []) as RawOffering[])
                .map((offering) => normalizeOffering(offering))
                .filter((offering): offering is OfferingWithRelations => offering !== null);

            setOfferings(normalizedOfferings);
            setPartners((partnersResult.data || []) as Partner[]);
            setLoading(false);
        };

        void loadData();
    }, [id, supabase]);

    useEffect(() => {
        if (!formData.qualification_id) {
            setFilteredOfferings([]);
            setSelectedOffering(null);
            return;
        }

        const byQualification = offerings.filter(
            (offering) => offering.qualification_id === formData.qualification_id
        );
        setFilteredOfferings(byQualification);

        if (!byQualification.some((offering) => offering.id === formData.offering_id)) {
            const nextOfferingId = byQualification[0]?.id || '';
            setFormData((prev) => ({ ...prev, offering_id: nextOfferingId }));
            setSelectedOffering(byQualification[0] || null);
        }
    }, [formData.qualification_id, formData.offering_id, offerings]);

    useEffect(() => {
        if (!formData.offering_id) {
            setSelectedOffering(null);
            return;
        }

        const selected = offerings.find((offering) => offering.id === formData.offering_id) || null;
        setSelectedOffering(selected);
    }, [formData.offering_id, offerings]);

    const canEditApplication = can('applications.edit');
    const isReadOnly = !canEditApplication || !lockState.canEdit || saving;

    const updateField = (field: keyof FormData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const validateForm = () => {
        if (!formData.student_first_name.trim()) {
            return 'First name is required.';
        }
        if (!formData.student_last_name.trim()) {
            return 'Last name is required.';
        }
        if (!formData.qualification_id) {
            return 'Qualification is required.';
        }
        return null;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!application) return;

        if (!canEditApplication) {
            toast.error('You do not have permission to edit applications.');
            return;
        }

        if (!lockState.canEdit) {
            toast.error('This application is currently locked by another user.');
            return;
        }

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            toast.error(validationError);
            return;
        }

        let offeringForPricing = formData.offering_id
            ? offerings.find((offering) => offering.id === formData.offering_id) || null
            : null;

        if (!offeringForPricing && formData.qualification_id) {
            const { data: createdPriceList, error: createPriceListError } = await supabase
                .from('rto_offerings')
                .insert({
                    qualification_id: formData.qualification_id,
                    rto_id: null,
                    is_active: true,
                    approval_status: 'published',
                    version: 1,
                    effective_date: new Date().toISOString().split('T')[0],
                })
                .select('id, qualification_id, rto_id, tuition_fee_onshore, material_fee, is_active')
                .single<OfferingWithRelations>();

            if (createPriceListError || !createdPriceList) {
                const message = createPriceListError?.message || 'Unable to create the qualification price list.';
                setError(message);
                toast.error(message);
                return;
            }

            offeringForPricing = {
                id: createdPriceList.id,
                qualification_id: createdPriceList.qualification_id,
                rto_id: null,
                tuition_fee_onshore: createdPriceList.tuition_fee_onshore ?? null,
                material_fee: createdPriceList.material_fee ?? 0,
                is_active: createdPriceList.is_active ?? true,
                qualification: null,
            };

            setOfferings((current) => current.some((offering) => offering.id === offeringForPricing?.id)
                ? current
                : [...current, offeringForPricing as OfferingWithRelations]);
            setFilteredOfferings((current) => current.some((offering) => offering.id === offeringForPricing?.id)
                ? current
                : [...current, offeringForPricing as OfferingWithRelations]);
            setSelectedOffering(offeringForPricing as OfferingWithRelations);
            setFormData((prev) => ({ ...prev, offering_id: offeringForPricing?.id || '' }));
        }

        if (!offeringForPricing) {
            const message = 'Unable to assign the portal offering for this qualification.';
            setError(message);
            toast.error(message);
            return;
        }

        if (!lockState.isOwnLock) {
            const acquired = await acquireLock();
            if (!acquired) {
                toast.error('Unable to acquire edit lock', {
                    description: lockError || 'Please try again in a moment.',
                });
                return;
            }
        }

        setSaving(true);
        setError(null);

        const receivedAt = formData.received_date
            ? new Date(`${formData.received_date}T00:00:00`).toISOString()
            : null;

        const applicationUpdate = {
            student_first_name: formData.student_first_name.trim(),
            student_last_name: formData.student_last_name.trim(),
            student_email: normalizeText(formData.student_email),
            student_phone: normalizeText(formData.student_phone),
            student_dob: formData.student_dob || null,
            student_usi: normalizeText(formData.student_usi),
            student_passport_number: normalizeText(formData.student_passport_number),
            student_visa_number: normalizeText(formData.student_visa_number),
            student_visa_expiry: formData.student_visa_expiry || null,
            student_gender: normalizeText(formData.student_gender),
            student_country_of_birth: normalizeText(formData.student_country_of_birth),
            application_from: normalizeText(formData.application_from),
            student_street_no: normalizeText(formData.student_street_no),
            student_suburb: normalizeText(formData.student_suburb),
            student_state: normalizeText(formData.student_state),
            student_postcode: normalizeText(formData.student_postcode),
            qualification_id: formData.qualification_id,
            offering_id: offeringForPricing.id,
            partner_id: formData.partner_id || null,
            received_at: receivedAt,
            appointment_date: formData.appointment_date || null,
            appointment_time: formData.appointment_time || null,
            notes: normalizeText(formData.notes),
            quoted_tuition: offeringForPricing.tuition_fee_onshore ?? null,
            quoted_materials: offeringForPricing.material_fee ?? null,
        };

        const changes: Record<string, { old: string | null; new: string | null }> = {};
        (Object.keys(applicationUpdate) as Array<keyof typeof applicationUpdate>).forEach((field) => {
            const oldRaw = application[field as keyof ApplicationWithRelations];
            const newRaw = applicationUpdate[field];
            const oldValue = valueForLog(oldRaw);
            const newValue = valueForLog(newRaw);

            if (oldValue !== newValue) {
                changes[field] = { old: oldValue, new: newValue };
            }
        });

        try {
            const { error: updateError } = await supabase
                .from('applications')
                .update(applicationUpdate)
                .eq('id', id);

            if (updateError) {
                throw updateError;
            }

            if (Object.keys(changes).length > 0) {
                void logFieldChanges(id, changes);
            }

            toast.success('Application updated successfully');
            router.push(`${routeBase}/applications/${id}`);
            router.refresh();
        } catch (submitError) {
            const message = submitError instanceof Error
                ? submitError.message
                : 'Failed to update application. Please try again.';
            setError(message);
            toast.error('Failed to update application', {
                description: message,
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading || permissionsLoading) {
        return (
            <main className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </main>
        );
    }

    if (!application) {
        return (
            <main className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-2">Application not found</h2>
                    <Link href={`${routeBase}/applications`}>
                        <Button variant="outline">Back to Applications</Button>
                    </Link>
                </div>
            </main>
        );
    }

    if (!canEditApplication) {
        return (
            <main className="flex-1 flex items-center justify-center px-6">
                <Card className="max-w-lg w-full">
                    <CardHeader>
                        <CardTitle>Access denied</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            You do not have permission to edit application records.
                        </p>
                        <Link href={`${routeBase}/applications/${id}`}>
                            <Button variant="outline">Back to application details</Button>
                        </Link>
                    </CardContent>
                </Card>
            </main>
        );
    }

    return (
        <main className="flex-1 overflow-y-auto">
            <header className="bg-card border-b border-border px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href={`${routeBase}/applications/${id}`}>
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-semibold text-foreground">Edit Application</h1>
                                <Badge variant="outline">{application.student_uid}</Badge>
                                <Badge variant="outline">{STAGE_LABELS[application.workflow_stage]}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                {application.student_first_name} {application.student_last_name}
                            </p>
                        </div>
                    </div>
                    <LockIndicator
                        isLocked={lockState.isLocked}
                        lockedByName={lockState.lockedByName}
                        lockedAt={lockState.lockedAt}
                        isOwnLock={lockState.isOwnLock}
                        canEdit={lockState.canEdit}
                        onAcquireLock={acquireLock}
                        onReleaseLock={releaseLock}
                        isLoading={lockLoading}
                        error={lockError}
                    />
                </div>
            </header>

            <div className="p-6 max-w-5xl mx-auto">
                <LockBanner
                    isLocked={lockState.isLocked}
                    lockedByName={lockState.lockedByName}
                    isOwnLock={lockState.isOwnLock}
                    canEdit={lockState.canEdit}
                    onAcquireLock={acquireLock}
                    error={lockError}
                />

                {error && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <GraduationCap className="h-5 w-5" />
                                Application Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="received_date">Application Received Date</Label>
                                    <Input
                                        id="received_date"
                                        type="date"
                                        value={formData.received_date}
                                        onChange={(event) => updateField('received_date', event.target.value)}
                                        disabled={isReadOnly}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="appointment_date">Appointment Date</Label>
                                    <Input
                                        id="appointment_date"
                                        type="date"
                                        value={formData.appointment_date}
                                        onChange={(event) => updateField('appointment_date', event.target.value)}
                                        disabled={isReadOnly}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="appointment_time">Appointment Time</Label>
                                    <Input
                                        id="appointment_time"
                                        type="time"
                                        value={formData.appointment_time}
                                        onChange={(event) => updateField('appointment_time', event.target.value)}
                                        disabled={isReadOnly}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Agent</Label>
                                <Select
                                    value={formData.partner_id || '__none__'}
                                    onValueChange={(value) => updateField('partner_id', value === '__none__' ? '' : value)}
                                    disabled={isReadOnly}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select an agent (optional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">No agent</SelectItem>
                                        {partners.map((partner) => (
                                            <SelectItem key={partner.id} value={partner.id}>
                                                {partner.company_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="application_from">Country Applying From</Label>
                                <Input
                                    id="application_from"
                                    value={formData.application_from}
                                    onChange={(event) => updateField('application_from', event.target.value)}
                                    placeholder="e.g., Australia"
                                    disabled={isReadOnly}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Qualification *</Label>
                                    <Select
                                        value={formData.qualification_id}
                                        onValueChange={(value) => updateField('qualification_id', value)}
                                        disabled={isReadOnly}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select qualification" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {qualifications.map((qualification) => (
                                                <SelectItem key={qualification.id} value={qualification.id}>
                                                    {qualification.code} - {qualification.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>
                                        Qualification Price List
                                    </Label>
                                    <Select
                                        value={formData.offering_id}
                                        onValueChange={(value) => updateField('offering_id', value)}
                                        disabled={isReadOnly || filteredOfferings.length === 0}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select the qualification price list" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {filteredOfferings.map((offering) => (
                                                <SelectItem key={offering.id} value={offering.id}>
                                                    Qualification Price List
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {filteredOfferings.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            No price list exists for this qualification yet. One will be created automatically when you save.
                                        </p>
                                    ) : null}
                                </div>
                            </div>

                            {selectedOffering && (
                                <div className="rounded-lg border p-4 bg-muted/30">
                                    <p className="text-sm font-medium mb-2">Pricing (from selected offering)</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Quoted Tuition:</span>{' '}
                                            <span className="font-medium">{formatCurrency(selectedOffering.tuition_fee_onshore)}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Quoted Materials:</span>{' '}
                                            <span className="font-medium">{formatCurrency(selectedOffering.material_fee)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Student Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="student_first_name">First Name *</Label>
                                    <Input
                                        id="student_first_name"
                                        value={formData.student_first_name}
                                        onChange={(event) => updateField('student_first_name', event.target.value)}
                                        disabled={isReadOnly}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="student_last_name">Last Name *</Label>
                                    <Input
                                        id="student_last_name"
                                        value={formData.student_last_name}
                                        onChange={(event) => updateField('student_last_name', event.target.value)}
                                        disabled={isReadOnly}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="student_email">Email</Label>
                                    <Input
                                        id="student_email"
                                        type="email"
                                        value={formData.student_email}
                                        onChange={(event) => updateField('student_email', event.target.value)}
                                        disabled={isReadOnly}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="student_phone">Phone</Label>
                                    <Input
                                        id="student_phone"
                                        value={formData.student_phone}
                                        onChange={(event) => updateField('student_phone', event.target.value)}
                                        disabled={isReadOnly}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="student_dob">Date of Birth</Label>
                                    <Input
                                        id="student_dob"
                                        type="date"
                                        value={formData.student_dob}
                                        onChange={(event) => updateField('student_dob', event.target.value)}
                                        disabled={isReadOnly}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="student_usi">USI</Label>
                                    <Input
                                        id="student_usi"
                                        value={formData.student_usi}
                                        onChange={(event) => updateField('student_usi', event.target.value)}
                                        disabled={isReadOnly}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Gender</Label>
                                    <Select
                                        value={formData.student_gender || '__none__'}
                                        onValueChange={(value) => updateField('student_gender', value === '__none__' ? '' : value)}
                                        disabled={isReadOnly}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select gender" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Not specified</SelectItem>
                                            {GENDERS.map((gender) => (
                                                <SelectItem key={gender.value} value={gender.value}>
                                                    {gender.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="student_country_of_birth">Country of Birth</Label>
                                    <Input
                                        id="student_country_of_birth"
                                        value={formData.student_country_of_birth}
                                        onChange={(event) => updateField('student_country_of_birth', event.target.value)}
                                        disabled={isReadOnly}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="student_passport_number">Passport Number</Label>
                                    <Input
                                        id="student_passport_number"
                                        value={formData.student_passport_number}
                                        onChange={(event) => updateField('student_passport_number', event.target.value)}
                                        disabled={isReadOnly}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="student_visa_number">Visa Number</Label>
                                    <Input
                                        id="student_visa_number"
                                        value={formData.student_visa_number}
                                        onChange={(event) => updateField('student_visa_number', event.target.value)}
                                        disabled={isReadOnly}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 max-w-sm">
                                <Label htmlFor="student_visa_expiry">Visa Expiry Date</Label>
                                <Input
                                    id="student_visa_expiry"
                                    type="date"
                                    value={formData.student_visa_expiry}
                                    onChange={(event) => updateField('student_visa_expiry', event.target.value)}
                                    disabled={isReadOnly}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="h-5 w-5" />
                                Address & Notes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="student_street_no">Street</Label>
                                    <Input
                                        id="student_street_no"
                                        value={formData.student_street_no}
                                        onChange={(event) => updateField('student_street_no', event.target.value)}
                                        disabled={isReadOnly}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="student_suburb">Suburb</Label>
                                    <Input
                                        id="student_suburb"
                                        value={formData.student_suburb}
                                        onChange={(event) => updateField('student_suburb', event.target.value)}
                                        disabled={isReadOnly}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>State</Label>
                                    <Select
                                        value={formData.student_state || '__none__'}
                                        onValueChange={(value) => updateField('student_state', value === '__none__' ? '' : value)}
                                        disabled={isReadOnly}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select state" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Not specified</SelectItem>
                                            {AUSTRALIAN_STATES.map((state) => (
                                                <SelectItem key={state.value} value={state.value}>
                                                    {state.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="student_postcode">Postcode</Label>
                                    <Input
                                        id="student_postcode"
                                        maxLength={4}
                                        value={formData.student_postcode}
                                        onChange={(event) => updateField('student_postcode', event.target.value)}
                                        disabled={isReadOnly}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea
                                    id="notes"
                                    value={formData.notes}
                                    onChange={(event) => updateField('notes', event.target.value)}
                                    rows={5}
                                    maxLength={1000}
                                    disabled={isReadOnly}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-3 pb-6">
                        <Link href={`${routeBase}/applications/${id}`}>
                            <Button type="button" variant="outline" disabled={saving}>
                                Cancel
                            </Button>
                        </Link>
                        <Button type="submit" disabled={isReadOnly}>
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
                </form>
            </div>
        </main>
    );
}

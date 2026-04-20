'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    ArrowLeft,
    Loader2,
    User,
    Building2,
    MapPin,
    Check,
    ChevronsUpDown,
    Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddressAutocomplete, type AddressComponents } from '@/components/ui/address-autocomplete';
import { toast } from 'sonner';
import { AGENT_PARTNER_TYPES } from '@/lib/partners/constants';
import type { Application, WorkflowStage } from '@/types/database';
import { formatDateInput, formatTimeInput } from '@/lib/date-utils';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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

const COUNTRIES = [
    'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria',
    'Bangladesh', 'Belgium', 'Brazil', 'Cambodia', 'Canada', 'Chile', 'China',
    'Colombia', 'Croatia', 'Czech Republic', 'Denmark', 'Egypt', 'Ethiopia',
    'Fiji', 'Finland', 'France', 'Germany', 'Ghana', 'Greece', 'Hong Kong',
    'Hungary', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
    'Japan', 'Jordan', 'Kenya', 'South Korea', 'Kuwait', 'Lebanon', 'Malaysia',
    'Maldives', 'Mexico', 'Morocco', 'Myanmar', 'Nepal', 'Netherlands', 'New Zealand',
    'Nigeria', 'Norway', 'Oman', 'Pakistan', 'Peru', 'Philippines', 'Poland',
    'Portugal', 'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Singapore',
    'South Africa', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland', 'Taiwan',
    'Thailand', 'Turkey', 'UAE', 'Uganda', 'UK', 'Ukraine', 'USA', 'Vietnam', 'Zimbabwe',
];

const GENDERS = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

interface QualificationOption {
    id: string;
    code: string;
    name: string;
    level: string | null;
}

interface QualificationRelation {
    id: string;
    code: string;
    name: string;
    level: string | null;
}

interface EditableApplication extends Application {
    qualification?: QualificationRelation | QualificationRelation[] | null;
}

interface FormData {
    applicant_type: 'agent';
    received_date: string;
    received_by_name: string;
    country_applying_from: string;
    student_first_name: string;
    student_middle_name: string;
    student_last_name: string;
    student_usi: string;
    student_dob: string;
    country_of_birth: string;
    student_passport_number: string;
    student_visa_number: string;
    student_visa_expiry: string;
    qualification_id: string;
    flat_unit: string;
    street_no: string;
    suburb: string;
    state: string;
    postcode: string;
    student_email: string;
    student_phone: string;
    gender: string;
    notes: string;
    appointment_date: string;
    appointment_time: string;
}

const EMPTY_FORM: FormData = {
    applicant_type: 'agent',
    received_date: new Date().toISOString().split('T')[0],
    received_by_name: '',
    country_applying_from: 'Australia',
    student_first_name: '',
    student_middle_name: '',
    student_last_name: '',
    student_usi: '',
    student_dob: '',
    country_of_birth: '',
    student_passport_number: '',
    student_visa_number: '',
    student_visa_expiry: '',
    qualification_id: '',
    flat_unit: '',
    street_no: '',
    suburb: '',
    state: '',
    postcode: '',
    student_email: '',
    student_phone: '',
    gender: '',
    notes: '',
    appointment_date: '',
    appointment_time: '',
};

function SearchableCombobox({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    searchPlaceholder = 'Search...',
    emptyText = 'No results found.',
    disabled = false,
}: {
    options: { value: string; label: string; searchText?: string }[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const selectedOption = options.find((option) => option.value === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground')}
                    disabled={disabled}
                >
                    {selectedOption ? selectedOption.label : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.searchText || option.label}
                                    onSelect={() => {
                                        onChange(option.value);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            'mr-2 h-4 w-4',
                                            value === option.value ? 'opacity-100' : 'opacity-0'
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default function EditAgentApplicationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);

    const [loadingData, setLoadingData] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const [userId, setUserId] = useState<string | null>(null);
    const [partnerId, setPartnerId] = useState<string | null>(null);
    const [application, setApplication] = useState<EditableApplication | null>(null);
    const [qualifications, setQualifications] = useState<QualificationOption[]>([]);
    const [addressSearchValue, setAddressSearchValue] = useState('');

    const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

    const loadData = useCallback(async () => {
        setLoadingData(true);
        setError(null);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push('/login');
                return;
            }

            setUserId(user.id);

            const [partnerRes, qualificationsRes, profileRes, applicationRes] = await Promise.all([
                supabase
                    .from('partners')
                    .select('id')
                    .eq('user_id', user.id)
                    .in('type', AGENT_PARTNER_TYPES)
                    .order('created_at', { ascending: true })
                    .limit(1),
                supabase
                    .from('qualifications')
                    .select('id, code, name, level')
                    .eq('status', 'current')
                    .order('name'),
                supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .maybeSingle(),
                supabase
                    .from('applications')
                    .select('*, qualification:qualifications(id, code, name, level)')
                    .eq('id', id)
                    .eq('created_by', user.id)
                    .maybeSingle(),
            ]);

            if (partnerRes.error) {
                console.error('Error loading partner for agent:', partnerRes.error);
            }
            if (qualificationsRes.error) {
                console.error('Error loading qualifications:', qualificationsRes.error);
            }
            if (profileRes.error) {
                console.error('Error loading profile:', profileRes.error);
            }
            if (applicationRes.error) {
                console.error('Error loading application:', applicationRes.error);
            }

            const loadedApplication = (applicationRes.data as EditableApplication | null);
            if (!loadedApplication) {
                const message = 'Application not found or you do not have access.';
                setError(message);
                toast.error(message);
                router.replace('/portal/agent/applications');
                return;
            }

            if (loadedApplication.workflow_stage !== 'docs_review') {
                toast.error('Only docs review applications can be edited.');
                router.replace(`/portal/agent/applications/${id}`);
                return;
            }

            setApplication(loadedApplication);

            const relationRaw = loadedApplication.qualification;
            const relation = Array.isArray(relationRaw)
                ? relationRaw[0] || null
                : relationRaw || null;

            const loadedQualifications = (qualificationsRes.data || []) as QualificationOption[];
            const qualificationExistsInList = relation
                ? loadedQualifications.some((qualification) => qualification.id === relation.id)
                : false;

            const qualificationsWithCurrent = relation && !qualificationExistsInList
                ? [...loadedQualifications, relation]
                : loadedQualifications;

            setQualifications(qualificationsWithCurrent);

            const resolvedPartnerId = partnerRes.data?.[0]?.id ?? loadedApplication.partner_id ?? null;
            setPartnerId(resolvedPartnerId);

            const receivedByName = profileRes.data?.full_name || user.email || '';

            setFormData({
                applicant_type: 'agent',
                received_date: formatDateInput(loadedApplication.received_at) || EMPTY_FORM.received_date,
                received_by_name: receivedByName,
                country_applying_from: loadedApplication.application_from || 'Australia',
                student_first_name: loadedApplication.student_first_name || '',
                student_middle_name: '',
                student_last_name: loadedApplication.student_last_name || '',
                student_usi: loadedApplication.student_usi || '',
                student_dob: formatDateInput(loadedApplication.student_dob),
                country_of_birth: loadedApplication.student_country_of_birth || loadedApplication.student_nationality || '',
                student_passport_number: loadedApplication.student_passport_number || '',
                student_visa_number: loadedApplication.student_visa_number || '',
                student_visa_expiry: formatDateInput(loadedApplication.student_visa_expiry),
                qualification_id: loadedApplication.qualification_id || relation?.id || '',
                flat_unit: '',
                street_no: loadedApplication.student_street_no || '',
                suburb: loadedApplication.student_suburb || '',
                state: loadedApplication.student_state || '',
                postcode: loadedApplication.student_postcode || '',
                student_email: loadedApplication.student_email || '',
                student_phone: loadedApplication.student_phone || '',
                gender: loadedApplication.student_gender || '',
                notes: loadedApplication.notes || '',
                appointment_date: formatDateInput(loadedApplication.appointment_date),
                appointment_time: formatTimeInput(loadedApplication.appointment_time),
            });

            const addressParts = [
                loadedApplication.student_street_no,
                loadedApplication.student_suburb,
                loadedApplication.student_state,
                loadedApplication.student_postcode,
            ].filter((value): value is string => Boolean(value && value.trim()));
            setAddressSearchValue(addressParts.join(', '));

            if (!resolvedPartnerId) {
                toast.info('No linked partner profile found. Saving may fail until your partner profile is linked.');
            }
        } catch (err) {
            console.error('Failed to load application for editing:', err);
            const message = 'Failed to load application details. Please refresh and try again.';
            setError(message);
            toast.error(message);
        } finally {
            setLoadingData(false);
        }
    }, [id, router, supabase]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const qualificationOptions = useMemo(
        () => qualifications.map((qualification) => ({
            value: qualification.id,
            label: `${qualification.code} - ${qualification.name}`,
            searchText: `${qualification.code} ${qualification.name}`,
        })),
        [qualifications]
    );

    const countryOptions = useMemo(
        () => COUNTRIES.map((country) => ({
            value: country,
            label: country,
            searchText: country,
        })),
        []
    );

    const updateField = (field: keyof FormData, value: string) => {
        setFormData((previous) => ({ ...previous, [field]: value }));

        setFieldErrors((previous) => {
            if (!previous[field]) {
                return previous;
            }

            const next = { ...previous };
            delete next[field];
            return next;
        });
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setFieldErrors({});

        if (!application) {
            toast.error('Application data is not ready yet.');
            return;
        }

        const validationErrors: Record<string, string> = {};

        if (!formData.student_first_name.trim()) {
            validationErrors.student_first_name = 'First name is required';
        }
        if (!formData.student_last_name.trim()) {
            validationErrors.student_last_name = 'Last name is required';
        }
        if (!formData.qualification_id) {
            validationErrors.qualification_id = 'Please select a qualification';
        }

        if (Object.keys(validationErrors).length > 0) {
            setFieldErrors(validationErrors);
            const message = 'Please complete the required fields before saving.';
            setError(message);
            toast.error(message);
            return;
        }

        const resolvedPartnerId = partnerId || application.partner_id || null;
        if (!resolvedPartnerId) {
            const message = 'Your agent profile is not linked to a partner. Please contact support.';
            setError(message);
            toast.error(message);
            return;
        }

        if (!userId) {
            const message = 'Your session is no longer available. Please sign in again.';
            setError(message);
            toast.error(message);
            router.push('/login');
            return;
        }

        const receivedAt = formData.received_date
            ? new Date(`${formData.received_date}T00:00:00`).toISOString()
            : null;

        setSubmitting(true);

        try {
            const updatePayload = {
                qualification_id: formData.qualification_id,
                partner_id: resolvedPartnerId,
                student_first_name: formData.student_first_name.trim(),
                student_last_name: formData.student_last_name.trim(),
                student_email: formData.student_email || null,
                student_phone: formData.student_phone || null,
                student_dob: formData.student_dob || null,
                student_usi: formData.student_usi || null,
                student_passport_number: formData.student_passport_number || null,
                student_nationality: formData.country_of_birth || null,
                student_visa_number: formData.student_visa_number || null,
                student_visa_expiry: formData.student_visa_expiry || null,
                student_gender: formData.gender || null,
                student_country_of_birth: formData.country_of_birth || null,
                application_from: formData.country_applying_from || null,
                student_street_no: formData.street_no || null,
                student_suburb: formData.suburb || null,
                student_state: formData.state || null,
                student_postcode: formData.postcode || null,
                notes: formData.notes || null,
                appointment_date: formData.appointment_date || null,
                appointment_time: formData.appointment_time || null,
                received_at: receivedAt,
                last_updated_by: userId,
            };

            const { data: updatedApplication, error: updateError } = await supabase
                .from('applications')
                .update(updatePayload)
                .eq('id', id)
                .eq('created_by', userId)
                .eq('workflow_stage', 'docs_review')
                .select('id')
                .maybeSingle<{ id: string }>();

            if (updateError) {
                throw updateError;
            }

            if (!updatedApplication?.id) {
                const message = 'This application is no longer editable.';
                setError(message);
                toast.error(message);
                router.replace(`/portal/agent/applications/${id}`);
                return;
            }

            toast.success('Application updated successfully');
            router.push(`/portal/agent/applications/${id}`);
            router.refresh();
        } catch (err) {
            const message = err instanceof Error
                ? err.message
                : 'Failed to update application';
            setError(message);
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    const selectedStage = application?.workflow_stage as WorkflowStage | undefined;

    return (
        <main className="flex-1 overflow-y-auto">
            <header className="bg-card border-b border-border px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link href={`/portal/agent/applications/${id}`}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Edit Application</h1>
                        <p className="text-muted-foreground mt-1">
                            Update your application details while it is in docs review.
                            {selectedStage ? ` Current stage: ${selectedStage}.` : ''}
                        </p>
                    </div>
                </div>
            </header>

            <div className="p-6 pb-12 max-w-4xl mx-auto">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
                            {error}
                        </div>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Applicant Information
                            </CardTitle>
                            <CardDescription>
                                Update applicant details and selected qualification.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>I&apos;m an:</Label>
                                <div className="h-10 px-3 py-2 rounded-md border bg-muted text-muted-foreground flex items-center">
                                    <Building2 className="h-4 w-4 mr-2" />
                                    Agent
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="received_date">Application Received Date</Label>
                                    <Input
                                        id="received_date"
                                        type="date"
                                        value={formData.received_date}
                                        onChange={(event) => updateField('received_date', event.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="received_by_name">Application Received By</Label>
                                    <Input
                                        id="received_by_name"
                                        value={formData.received_by_name}
                                        disabled
                                        className="bg-muted"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Agent Name *</Label>
                                <Input value={formData.received_by_name || 'Agent profile not linked'} disabled className="bg-muted" />
                            </div>

                            <div className="space-y-2">
                                <Label>Country Applying From *</Label>
                                <SearchableCombobox
                                    options={countryOptions}
                                    value={formData.country_applying_from}
                                    onChange={(value) => updateField('country_applying_from', value)}
                                    placeholder="Select country..."
                                    searchPlaceholder="Search countries..."
                                    disabled={loadingData}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="student_first_name" className={fieldErrors.student_first_name ? 'text-destructive' : ''}>
                                        First Name *
                                    </Label>
                                    <Input
                                        id="student_first_name"
                                        value={formData.student_first_name}
                                        onChange={(event) => updateField('student_first_name', event.target.value)}
                                        className={fieldErrors.student_first_name ? 'border-destructive' : ''}
                                        required
                                    />
                                    {fieldErrors.student_first_name && (
                                        <p className="text-xs text-destructive">{fieldErrors.student_first_name}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="student_middle_name">Middle Name</Label>
                                    <Input
                                        id="student_middle_name"
                                        value={formData.student_middle_name}
                                        onChange={(event) => updateField('student_middle_name', event.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="student_last_name" className={fieldErrors.student_last_name ? 'text-destructive' : ''}>
                                        Last Name *
                                    </Label>
                                    <Input
                                        id="student_last_name"
                                        value={formData.student_last_name}
                                        onChange={(event) => updateField('student_last_name', event.target.value)}
                                        className={fieldErrors.student_last_name ? 'border-destructive' : ''}
                                        required
                                    />
                                    {fieldErrors.student_last_name && (
                                        <p className="text-xs text-destructive">{fieldErrors.student_last_name}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className={fieldErrors.qualification_id ? 'text-destructive' : ''}>Qualification *</Label>
                                <SearchableCombobox
                                    options={qualificationOptions}
                                    value={formData.qualification_id}
                                    onChange={(value) => updateField('qualification_id', value)}
                                    placeholder={loadingData ? 'Loading qualifications...' : 'Search for a qualification...'}
                                    searchPlaceholder="Type to search..."
                                    disabled={loadingData}
                                />
                                {fieldErrors.qualification_id && (
                                    <p className="text-xs text-destructive">{fieldErrors.qualification_id}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="student_usi">USI</Label>
                                    <Input
                                        id="student_usi"
                                        value={formData.student_usi}
                                        onChange={(event) => updateField('student_usi', event.target.value)}
                                        maxLength={10}
                                        placeholder="10 character USI"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="student_dob">Date of Birth</Label>
                                    <Input
                                        id="student_dob"
                                        type="date"
                                        value={formData.student_dob}
                                        onChange={(event) => updateField('student_dob', event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Country of Birth</Label>
                                <SearchableCombobox
                                    options={countryOptions}
                                    value={formData.country_of_birth}
                                    onChange={(value) => updateField('country_of_birth', value)}
                                    placeholder="Select country"
                                    searchPlaceholder="Search countries..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="student_passport_number">Passport Number</Label>
                                    <Input
                                        id="student_passport_number"
                                        value={formData.student_passport_number}
                                        onChange={(event) => updateField('student_passport_number', event.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="student_visa_number">Visa Number</Label>
                                    <Input
                                        id="student_visa_number"
                                        value={formData.student_visa_number}
                                        onChange={(event) => updateField('student_visa_number', event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="student_visa_expiry">Visa Expiry Date</Label>
                                    <Input
                                        id="student_visa_expiry"
                                        type="date"
                                        value={formData.student_visa_expiry}
                                        onChange={(event) => updateField('student_visa_expiry', event.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="appointment_date">Preferred Appointment Date</Label>
                                    <Input
                                        id="appointment_date"
                                        type="date"
                                        value={formData.appointment_date}
                                        onChange={(event) => updateField('appointment_date', event.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="appointment_time">Preferred Appointment Time</Label>
                                    <Input
                                        id="appointment_time"
                                        type="time"
                                        value={formData.appointment_time}
                                        onChange={(event) => updateField('appointment_time', event.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="h-5 w-5" />
                                Address Information
                            </CardTitle>
                            <CardDescription>
                                Start typing to search for an address, or enter details manually.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Search Address</Label>
                                <AddressAutocomplete
                                    value={addressSearchValue}
                                    onChange={setAddressSearchValue}
                                    onAddressSelect={(components: AddressComponents) => {
                                        setFormData((previous) => ({
                                            ...previous,
                                            street_no: components.address,
                                            suburb: components.city,
                                            state: components.state,
                                            postcode: components.postcode,
                                        }));
                                        setAddressSearchValue(components.fullAddress);
                                    }}
                                    apiKey={GOOGLE_MAPS_API_KEY}
                                    placeholder="Start typing your address..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="flat_unit">Flat/Unit No.</Label>
                                    <Input
                                        id="flat_unit"
                                        value={formData.flat_unit}
                                        onChange={(event) => updateField('flat_unit', event.target.value)}
                                        placeholder="Optional"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="street_no">Street No. & Name</Label>
                                    <Input
                                        id="street_no"
                                        value={formData.street_no}
                                        onChange={(event) => updateField('street_no', event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="suburb">Suburb</Label>
                                <Input
                                    id="suburb"
                                    value={formData.suburb}
                                    onChange={(event) => updateField('suburb', event.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>State</Label>
                                    <Select value={formData.state} onValueChange={(value) => updateField('state', value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a state" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {AUSTRALIAN_STATES.map((state) => (
                                                <SelectItem key={state.value} value={state.value}>
                                                    {state.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="postcode">Postcode</Label>
                                    <Input
                                        id="postcode"
                                        value={formData.postcode}
                                        onChange={(event) => updateField('postcode', event.target.value)}
                                        maxLength={4}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Contact Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="student_email">Email</Label>
                                    <Input
                                        id="student_email"
                                        type="email"
                                        value={formData.student_email}
                                        onChange={(event) => updateField('student_email', event.target.value)}
                                        placeholder="email@example.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="student_phone">Mobile No.</Label>
                                    <Input
                                        id="student_phone"
                                        value={formData.student_phone}
                                        onChange={(event) => updateField('student_phone', event.target.value)}
                                        placeholder="+61 400 000 000"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Gender</Label>
                                <Select value={formData.gender} onValueChange={(value) => updateField('gender', value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Gender" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {GENDERS.map((gender) => (
                                            <SelectItem key={gender.value} value={gender.value}>{gender.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                placeholder="Enter any additional notes or comments..."
                                value={formData.notes}
                                onChange={(event) => updateField('notes', event.target.value)}
                                className="min-h-[100px]"
                                maxLength={1000}
                            />
                            <p className="text-xs text-muted-foreground text-right mt-2">
                                {formData.notes.length}/1000
                            </p>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-3">
                        <Link href={`/portal/agent/applications/${id}`}>
                            <Button type="button" variant="outline">Cancel</Button>
                        </Link>
                        <Button type="submit" disabled={submitting || loadingData}>
                            {submitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
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

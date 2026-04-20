'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
    DollarSign,
    MapPin,
    Check,
    ChevronsUpDown,
    Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SmartExtractUpload, type PendingFile } from '@/components/documents/SmartExtractUpload';
import { uploadAndRecordDocument } from '@/lib/storage';
import { AddressAutocomplete, validateAddress, type AddressComponents } from '@/components/ui/address-autocomplete';
import type { Qualification, Partner } from '@/types/database';
import type { ApplicationFieldMapping } from '@/lib/extraction/types';
import { useCreateApplicationMutation } from '@/store/services/workflowApi';
import { getPortalRouteBase } from '@/lib/routes/portal';
import { usePermissions } from '@/hooks/usePermissions';

// Google Maps API key for address autocomplete (from environment variable)
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
    'Thailand', 'Turkey', 'UAE', 'Uganda', 'UK', 'Ukraine', 'USA', 'Vietnam', 'Zimbabwe'
];

const GENDERS = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

interface OfferingWithRelations {
    id: string;
    rto_id: string | null;
    qualification_id: string;
    tuition_fee_onshore: number | null;
    tuition_fee_miscellaneous: number | null;
    material_fee: number;
    application_fee: number;
    duration_weeks: number | null;
    intakes: string[] | null;
    is_active: boolean;
    qualification?: Qualification;
}

type AgentPartnerOption = Pick<Partner, 'id' | 'company_name' | 'contact_name' | 'email' | 'type'>;

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
    const selectedOption = options.find(o => o.value === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between font-normal",
                        !value && "text-muted-foreground"
                    )}
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
                                            "mr-2 h-4 w-4",
                                            value === option.value ? "opacity-100" : "opacity-0"
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

export default function NewApplicationPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createClient();
    const [createApplication] = useCreateApplicationMutation();
    const { role } = usePermissions();

    const routeBase = getPortalRouteBase(pathname, role);

    const [qualifications, setQualifications] = useState<Qualification[]>([]);
    const [offerings, setOfferings] = useState<OfferingWithRelations[]>([]);
    const [partners, setPartners] = useState<AgentPartnerOption[]>([]);
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [addressSearchValue, setAddressSearchValue] = useState('');
    const [loadingAgentOptions, setLoadingAgentOptions] = useState(true);

    const [formData, setFormData] = useState({
        applicant_type: 'agent',
        received_date: new Date().toISOString().split('T')[0],
        received_by: '', // UUID of the user who received the application
        received_by_name: '', // Display name for the form
        partner_id: '',
        country_applying_from: 'Australia',
        has_full_name: 'yes',
        student_first_name: '',
        student_middle_name: '',
        student_last_name: '',
        student_usi: '',
        student_dob: '',
        country_of_birth: '',
        student_email: '',
        student_phone: '',
        student_passport_number: '',
        student_visa_number: '',
        student_visa_expiry: '',
        gender: '',
        flat_unit: '',
        street_no: '',
        suburb: '',
        state: '',
        postcode: '',
        qualification_id: '',
        offering_id: '',
        notes: '',
    });

    useEffect(() => {
        const loadData = async () => {
            setLoadingAgentOptions(true);
            setError(null);

            try {
                const [qualRes, offeringsRes, partnersResponse, userRes] = await Promise.all([
                    supabase.from('qualifications').select('*').eq('status', 'current').order('name'),
                    supabase.from('rto_offerings').select(`*, qualification:qualifications(*)`).eq('is_active', true).eq('is_deleted', false),
                    fetch('/api/applications/agent-partners', {
                        method: 'GET',
                        credentials: 'same-origin',
                    }),
                    supabase.auth.getUser(),
                ]);

                if (qualRes.error) {
                    throw new Error(qualRes.error.message || 'Failed to load qualifications');
                }

                if (offeringsRes.error) {
                    throw new Error(offeringsRes.error.message || 'Failed to load qualification price lists');
                }

                const partnersPayload = await partnersResponse.json().catch(() => null) as { data?: AgentPartnerOption[]; error?: string } | null;
                if (!partnersResponse.ok) {
                    throw new Error(partnersPayload?.error || 'Failed to load agent options');
                }

                setQualifications(qualRes.data || []);
                setOfferings((offeringsRes.data || []) as OfferingWithRelations[]);
                setPartners(partnersPayload?.data || []);

                if (userRes.data.user) {
                    const user = userRes.data.user;
                    const { data: profile, error: profileError } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', user.id)
                        .single();

                    if (profileError) {
                        throw new Error(profileError.message || 'Failed to load your profile');
                    }

                    setFormData(prev => ({ ...prev, received_by: user.id, received_by_name: profile?.full_name || user.email || '' }));
                }
            } catch (loadError) {
                console.error('Failed to load new application form data:', loadError);
                setError(loadError instanceof Error ? loadError.message : 'Failed to load application form data');
            } finally {
                setLoadingAgentOptions(false);
            }
        };

        void loadData();
    }, [supabase]);

    const filteredOfferings = useMemo(
        () => offerings.filter((offering) => offering.qualification_id === formData.qualification_id),
        [offerings, formData.qualification_id]
    );

    useEffect(() => {
        if (!formData.qualification_id) {
            if (formData.offering_id) {
                setFormData((prev) => ({ ...prev, offering_id: '' }));
            }
            return;
        }

        const nextOfferingId = filteredOfferings[0]?.id || '';
        if (formData.offering_id !== nextOfferingId) {
            setFormData((prev) => ({ ...prev, offering_id: nextOfferingId }));
        }
    }, [filteredOfferings, formData.offering_id, formData.qualification_id]);

    const selectedOffering = useMemo(
        () => offerings.find((offering) => offering.id === formData.offering_id) || null,
        [offerings, formData.offering_id]
    );

    const qualificationOptions = useMemo(() => qualifications.map(q => ({ value: q.id, label: `${q.code} - ${q.name}`, searchText: `${q.code} ${q.name}` })), [qualifications]);
    const agentOptions = useMemo(() => partners.map((partner) => {
        const email = partner.email?.trim();
        const contactName = partner.contact_name?.trim();
        const secondaryLabel = contactName && contactName !== partner.company_name
            ? contactName
            : email;

        return {
            value: partner.id,
            label: secondaryLabel ? `${partner.company_name} (${secondaryLabel})` : partner.company_name,
            searchText: [partner.company_name, contactName, email].filter(Boolean).join(' '),
        };
    }), [partners]);
    const countryOptions = useMemo(() => COUNTRIES.map(c => ({ value: c, label: c, searchText: c })), []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('[Form Submit] Starting submission with formData:', formData);
        setError(null);
        setFieldErrors({});
        setLoading(true);

        // Validate required fields
        const errors: Record<string, string> = {};

        if (!formData.student_first_name.trim()) {
            errors.student_first_name = 'First name is required';
        }
        if (!formData.student_last_name.trim()) {
            errors.student_last_name = 'Last name is required';
        }
        if (!formData.qualification_id) {
            errors.qualification_id = 'Please select a qualification';
        }
        if (formData.applicant_type === 'agent' && !formData.partner_id) {
            errors.partner_id = 'Please select an agent';
        }

        if (Object.keys(errors).length > 0) {
            console.log('[Form Submit] Validation errors:', errors);
            setFieldErrors(errors);
            const errorFields = Object.keys(errors).map(key => {
                const labels: Record<string, string> = {
                    student_first_name: 'First Name',
                    student_last_name: 'Last Name',
                    qualification_id: 'Qualification',
                    partner_id: 'Agent',
                };
                return labels[key] || key;
            });
            setError(`Please complete the following required fields: ${errorFields.join(', ')}`);
            setLoading(false);
            // Scroll to top to show error
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        console.log('[Form Submit] Validation passed, proceeding with insert');

        try {
            const receivedAt = formData.received_date
                ? new Date(`${formData.received_date}T00:00:00`).toISOString()
                : new Date().toISOString();

            const createdApplication = await createApplication({
                student_first_name: formData.student_first_name,
                student_last_name: formData.student_last_name,
                student_email: formData.student_email || null,
                student_phone: formData.student_phone || null,
                student_dob: formData.student_dob || null,
                student_usi: formData.student_usi || null,
                student_passport_number: formData.student_passport_number || null,
                student_visa_number: formData.student_visa_number || null,
                student_visa_expiry: formData.student_visa_expiry || null,
                student_gender: formData.gender || null,
                student_country_of_birth: formData.country_of_birth || null,
                application_from: formData.country_applying_from || null,
                student_street_no: formData.street_no || null,
                student_suburb: formData.suburb || null,
                student_state: formData.state || null,
                student_postcode: formData.postcode || null,
                qualification_id: formData.qualification_id,
                offering_id: formData.offering_id,
                partner_id: formData.partner_id || null,
                quoted_tuition: selectedOffering?.tuition_fee_onshore || null,
                quoted_materials: selectedOffering?.material_fee || null,
                notes: formData.notes || null,
                received_at: receivedAt,
            }).unwrap();

            const insertedApplicationId = createdApplication.data.id;

            if (pendingFiles.length > 0) {
                for (const pendingFile of pendingFiles) {
                    try {
                        await uploadAndRecordDocument(pendingFile.file, insertedApplicationId, pendingFile.documentType);
                    } catch (uploadErr) {
                        console.error('Document upload failed:', uploadErr);
                        // Continue even if document upload fails
                    }
                }
            }

            // Success - redirect to applications list
            router.push(`${routeBase}/applications`);
            router.refresh();
        } catch (err) {
            console.error('Unexpected error in application create flow:', err);

            let errorMessage = 'Failed to create application. Please try again.';

            if (err && typeof err === 'object' && 'data' in err) {
                const data = err.data as { error?: string } | undefined;
                if (data?.error) {
                    errorMessage = data.error;
                }
            } else if (err instanceof Error && err.message) {
                errorMessage = err.message;
            }

            setError(errorMessage);
            setLoading(false);
        }
    };

    const updateField = (field: string, value: string | boolean) => {
        setFormData(prev => {
            if (field === 'qualification_id' && typeof value === 'string') {
                return {
                    ...prev,
                    qualification_id: value,
                    offering_id: '',
                };
            }

            return { ...prev, [field]: value };
        });
    };

    const handleFieldsExtracted = async (fields: ApplicationFieldMapping) => {
        console.log('[Form] Received extracted fields:', fields);

        // Handle address validation through Google Places API if address is provided
        if (fields.student_address) {
            console.log('[Form] Validating address through Google Places:', fields.student_address);
            try {
                const validatedAddress = await validateAddress(fields.student_address, GOOGLE_MAPS_API_KEY);
                if (validatedAddress) {
                    console.log('[Form] Google validated address:', validatedAddress);
                    setFormData(prev => ({
                        ...prev,
                        street_no: validatedAddress.address || prev.street_no,
                        suburb: validatedAddress.city || prev.suburb,
                        state: validatedAddress.state || prev.state,
                        postcode: validatedAddress.postcode || prev.postcode,
                    }));
                    setAddressSearchValue(validatedAddress.fullAddress);
                }
            } catch (error) {
                console.error('[Form] Address validation failed:', error);
            }
        }

        setFormData(prev => {
            const updates: Partial<typeof formData> = {};
            if (fields.student_first_name && !prev.student_first_name) {
                updates.student_first_name = fields.student_first_name;
                console.log('[Form] Setting first name:', fields.student_first_name);
            }
            if (fields.student_last_name && !prev.student_last_name) {
                updates.student_last_name = fields.student_last_name;
                console.log('[Form] Setting last name:', fields.student_last_name);
            }
            if (fields.student_email && !prev.student_email) updates.student_email = fields.student_email;
            if (fields.student_phone && !prev.student_phone) updates.student_phone = fields.student_phone;
            if (fields.student_dob && !prev.student_dob) {
                updates.student_dob = fields.student_dob;
                console.log('[Form] Setting DOB:', fields.student_dob);
            }
            if (fields.student_usi && !prev.student_usi) updates.student_usi = fields.student_usi;
            if (fields.student_nationality && !prev.country_of_birth) {
                updates.country_of_birth = fields.student_nationality;
                console.log('[Form] Setting nationality:', fields.student_nationality);
            }
            if (fields.student_passport_number && !prev.student_passport_number) {
                updates.student_passport_number = fields.student_passport_number;
                console.log('[Form] Setting passport number:', fields.student_passport_number);
            }
            if (fields.student_visa_number && !prev.student_visa_number) {
                updates.student_visa_number = fields.student_visa_number;
                console.log('[Form] Setting visa number:', fields.student_visa_number);
            }
            if (fields.student_visa_expiry && !prev.student_visa_expiry) {
                updates.student_visa_expiry = fields.student_visa_expiry;
                console.log('[Form] Setting visa expiry:', fields.student_visa_expiry);
            }

            console.log('[Form] Final updates:', updates);
            return { ...prev, ...updates };
        });
    };

    const formatCurrency = (amount: number | null) => {
        if (amount === null) return '-';
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
    };

    return (
        <main>
            <header className="bg-card border-b border-border px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link href={`${routeBase}/applications`}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">Create New Application</h1>
                        <p className="text-sm text-muted-foreground">Fill in the applicant details</p>
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

                    {/* Smart Document Upload */}
                    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-primary" />
                                Smart Document Upload
                            </CardTitle>
                            <CardDescription>
                                Upload documents to automatically extract and fill in applicant information.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SmartExtractUpload
                                onFieldsExtracted={handleFieldsExtracted}
                                onFilesReady={(files) => setPendingFiles(files)}
                                onError={(err) => setError(err)}
                            />
                        </CardContent>
                    </Card>

                    {/* Applicant Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Applicant Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>I&apos;m an:</Label>
                                <RadioGroup value={formData.applicant_type} onValueChange={(v) => updateField('applicant_type', v)} className="flex gap-4">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="agent" id="type-agent" />
                                        <Label htmlFor="type-agent" className="font-normal cursor-pointer">Agent</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="applicant" id="type-applicant" />
                                        <Label htmlFor="type-applicant" className="font-normal cursor-pointer">Applicant</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="received_date">Application Received Date</Label>
                                    <Input id="received_date" type="date" value={formData.received_date} onChange={(e) => updateField('received_date', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="received_by_name">Application Received By</Label>
                                    <Input id="received_by_name" value={formData.received_by_name} onChange={(e) => updateField('received_by_name', e.target.value)} placeholder="Staff name" disabled className="bg-muted" />
                                </div>
                            </div>

                            {formData.applicant_type === 'agent' && (
                                <div className="space-y-2">
                                    <Label>Agent Name *</Label>
                                    <SearchableCombobox
                                        options={agentOptions}
                                        value={formData.partner_id}
                                        onChange={(v) => updateField('partner_id', v)}
                                        placeholder={loadingAgentOptions ? 'Loading agents...' : 'Search for an agent...'}
                                        searchPlaceholder="Search agents..."
                                        emptyText={loadingAgentOptions ? 'Loading agents...' : 'No agents found.'}
                                        disabled={loadingAgentOptions}
                                    />
                                </div>
                            )}

                            {formData.applicant_type === 'applicant' && (
                                <div className="space-y-2">
                                    <Label>Agent</Label>
                                    <div className="h-10 px-3 py-2 rounded-md border bg-muted text-muted-foreground flex items-center">
                                        <Building2 className="h-4 w-4 mr-2" />
                                        Sharp Future
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Country Applying From *</Label>
                                <SearchableCombobox options={countryOptions} value={formData.country_applying_from} onChange={(v) => updateField('country_applying_from', v)} placeholder="Select country..." searchPlaceholder="Search countries..." />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="student_first_name" className={fieldErrors.student_first_name ? 'text-destructive' : ''}>First Name *</Label>
                                    <Input id="student_first_name" placeholder="First name" value={formData.student_first_name} onChange={(e) => updateField('student_first_name', e.target.value)} required className={fieldErrors.student_first_name ? 'border-destructive' : ''} />
                                    {fieldErrors.student_first_name && <p className="text-xs text-destructive">{fieldErrors.student_first_name}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="student_middle_name">Middle Name</Label>
                                    <Input id="student_middle_name" value={formData.student_middle_name} onChange={(e) => updateField('student_middle_name', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="student_last_name" className={fieldErrors.student_last_name ? 'text-destructive' : ''}>Last Name *</Label>
                                    <Input id="student_last_name" placeholder="Last name" value={formData.student_last_name} onChange={(e) => updateField('student_last_name', e.target.value)} required className={fieldErrors.student_last_name ? 'border-destructive' : ''} />
                                    {fieldErrors.student_last_name && <p className="text-xs text-destructive">{fieldErrors.student_last_name}</p>}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className={fieldErrors.qualification_id ? 'text-destructive' : ''}>Qualification *</Label>
                                <SearchableCombobox options={qualificationOptions} value={formData.qualification_id} onChange={(v) => updateField('qualification_id', v)} placeholder="Search for a qualification..." searchPlaceholder="Type to search..." />
                                {fieldErrors.qualification_id && <p className="text-xs text-destructive">{fieldErrors.qualification_id}</p>}
                            </div>

                            {formData.qualification_id && (
                                <div className="space-y-2">
                                    <Label>
                                        Qualification Price List
                                    </Label>
                                    <Select value={formData.offering_id} onValueChange={(v) => updateField('offering_id', v)} disabled={filteredOfferings.length === 0}>
                                        <SelectTrigger><SelectValue placeholder="Select the qualification price list" /></SelectTrigger>
                                        <SelectContent>
                                            {filteredOfferings.map((offering) => (
                                                <SelectItem key={offering.id} value={offering.id}>
                                                    <div className="flex items-center justify-between gap-4 w-full">
                                                        <div className="flex items-center gap-2">
                                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                                            Qualification Price List
                                                        </div>
                                                        <span className="text-muted-foreground text-sm">
                                                            {offering.tuition_fee_onshore
                                                                ? `$${offering.tuition_fee_onshore.toLocaleString()}`
                                                                : '-'}
                                                        </span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {filteredOfferings.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            No price list exists for this qualification yet. One will be created automatically when you save the application.
                                        </p>
                                    ) : null}
                                </div>
                            )}

                            {selectedOffering && (
                                <div className="p-4 bg-muted/50 rounded-lg border">
                                    <div className="flex items-center gap-2 mb-3">
                                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium text-sm">Pricing (Auto-filled)</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">Tuition (Onshore)</p>
                                            <p className="font-semibold">{formatCurrency(selectedOffering.tuition_fee_onshore)}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Tuition (Miscellaneous)</p>
                                            <p className="font-semibold">{formatCurrency(selectedOffering.tuition_fee_miscellaneous)}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Materials</p>
                                            <p className="font-semibold">{formatCurrency(selectedOffering.material_fee)}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Duration</p>
                                            <p className="font-semibold">{selectedOffering.duration_weeks ? `${selectedOffering.duration_weeks} weeks` : '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="student_usi">USI</Label>
                                    <Input id="student_usi" value={formData.student_usi} onChange={(e) => updateField('student_usi', e.target.value)} placeholder="10 character USI" maxLength={10} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="student_dob">Date of Birth</Label>
                                    <Input id="student_dob" type="date" value={formData.student_dob} onChange={(e) => updateField('student_dob', e.target.value)} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Country of Birth</Label>
                                <SearchableCombobox options={countryOptions} value={formData.country_of_birth} onChange={(v) => updateField('country_of_birth', v)} placeholder="Select country" searchPlaceholder="Search countries..." />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="student_passport_number">Passport Number</Label>
                                    <Input id="student_passport_number" value={formData.student_passport_number} onChange={(e) => updateField('student_passport_number', e.target.value)} placeholder="e.g., N1234567 or P9876543" />
                                    <p className="text-xs text-muted-foreground">Format: Usually 8-9 characters (letters and numbers)</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="student_visa_number">Visa Number</Label>
                                    <Input id="student_visa_number" value={formData.student_visa_number} onChange={(e) => updateField('student_visa_number', e.target.value)} placeholder="e.g., 1234567890123" />
                                    <p className="text-xs text-muted-foreground">Format: 13-15 digit visa grant number</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="student_visa_expiry">Visa Expiry Date</Label>
                                <Input id="student_visa_expiry" type="date" value={formData.student_visa_expiry} onChange={(e) => updateField('student_visa_expiry', e.target.value)} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Address Information */}
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
                            {/* Address Autocomplete Search */}
                            <div className="space-y-2">
                                <Label>Search Address</Label>
                                <AddressAutocomplete
                                    value={addressSearchValue}
                                    onChange={setAddressSearchValue}
                                    onAddressSelect={(components: AddressComponents) => {
                                        setFormData(prev => ({
                                            ...prev,
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
                                    <Input id="flat_unit" value={formData.flat_unit} onChange={(e) => updateField('flat_unit', e.target.value)} placeholder="Optional" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="street_no">Street No. & Name</Label>
                                    <Input id="street_no" value={formData.street_no} onChange={(e) => updateField('street_no', e.target.value)} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="suburb">Suburb</Label>
                                <Input id="suburb" value={formData.suburb} onChange={(e) => updateField('suburb', e.target.value)} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>State</Label>
                                    <Select value={formData.state} onValueChange={(v) => updateField('state', v)}>
                                        <SelectTrigger><SelectValue placeholder="Select a state" /></SelectTrigger>
                                        <SelectContent>
                                            {AUSTRALIAN_STATES.map((state) => (
                                                <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="postcode">Postcode</Label>
                                    <Input id="postcode" value={formData.postcode} onChange={(e) => updateField('postcode', e.target.value)} maxLength={4} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Contact Information */}
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
                                    <Input id="student_email" type="email" placeholder="email@example.com" value={formData.student_email} onChange={(e) => updateField('student_email', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="student_phone">Mobile No.</Label>
                                    <Input id="student_phone" type="tel" placeholder="+61 400 000 000" value={formData.student_phone} onChange={(e) => updateField('student_phone', e.target.value)} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Gender</Label>
                                <Select value={formData.gender} onValueChange={(v) => updateField('gender', v)}>
                                    <SelectTrigger><SelectValue placeholder="Select Gender" /></SelectTrigger>
                                    <SelectContent>
                                        {GENDERS.map((g) => (
                                            <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Notes */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea placeholder="Enter any additional notes or comments..." value={formData.notes} onChange={(e) => updateField('notes', e.target.value)} className="min-h-[100px]" maxLength={1000} />
                            <p className="text-xs text-muted-foreground text-right mt-2">Maximum 1000 characters</p>
                        </CardContent>
                    </Card>

                    {/* Submit */}
                    <div className="flex justify-end gap-3 sticky bottom-6">
                        <Link href={`${routeBase}/applications`}>
                            <Button type="button" variant="outline">Cancel</Button>
                        </Link>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Application'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </main>
    );
}

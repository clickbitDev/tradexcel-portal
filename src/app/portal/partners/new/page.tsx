/**
 * New Partner Page
 * 
 * Form for creating a new partner (agent, subagent, or provider)
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { ArrowLeft, Loader2, Users, Building2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { AddressAutocomplete, type AddressComponents } from '@/components/ui/address-autocomplete';
import type { PartnerType, PartnerStatus, PriorityLevel, ContactChannel } from '@/types/database';
import { isAgentLikePartnerType, isPartnerType } from '@/lib/partners/constants';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
    agent: 'Agent',
    subagent: 'Sub-agent',
    provider: 'Provider',
};

const STATUS_OPTIONS: { value: PartnerStatus; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'inactive', label: 'Inactive' },
];

const PRIORITY_OPTIONS: { value: PriorityLevel; label: string }[] = [
    { value: 'standard', label: 'Standard' },
    { value: 'preferred', label: 'Preferred' },
    { value: 'premium', label: 'Premium' },
];

const CHANNEL_OPTIONS: { value: ContactChannel; label: string }[] = [
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'other', label: 'Other' },
];

function NewPartnerForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryType = searchParams.get('type');
    const defaultType: PartnerType = isPartnerType(queryType) ? queryType : 'agent';

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        type: defaultType,
        company_name: '',
        contact_name: '',
        email: '',
        phone: '',
        country: '',
        status: 'active' as PartnerStatus,
        priority_level: 'standard' as PriorityLevel,
        commission_rate: '',
        preferred_channel: '' as ContactChannel | '',
        address: '',
        notes: '',
    });

    useEffect(() => {
        if (!isPartnerType(queryType)) {
            return;
        }

        setFormData((previous) => ({
            ...previous,
            type: queryType,
        }));
    }, [queryType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const companyName = formData.company_name.trim();
        if (!companyName) {
            setError('Company/Agent name is required');
            return;
        }

        const partnerType: PartnerType = isPartnerType(formData.type) ? formData.type : 'agent';

        setLoading(true);

        try {
            const response = await fetch('/api/partners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: partnerType,
                    company_name: companyName,
                    contact_name: formData.contact_name,
                    email: formData.email,
                    phone: formData.phone,
                    country: formData.country,
                    status: formData.status,
                    priority_level: formData.priority_level,
                    commission_rate: formData.commission_rate,
                    preferred_channel: formData.preferred_channel,
                    address: formData.address,
                    notes: formData.notes,
                }),
            });

            const result = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(result?.error || 'Failed to create partner');
            }

            router.push('/portal/partners');
        } catch (err) {
            console.error('Error creating partner:', err);
            setError(
                typeof err === 'object' && err !== null && 'message' in err
                    ? String((err as { message: unknown }).message)
                    : 'Failed to create partner'
            );
        } finally {
            setLoading(false);
        }
    };

    const selectedType: PartnerType = isPartnerType(formData.type) ? formData.type : 'agent';
    const isAgent = isAgentLikePartnerType(selectedType);
    const pageTitle = `Add ${PARTNER_TYPE_LABELS[selectedType]}`;

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link href="/portal/partners">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                            {isAgent ? (
                                <Users className="h-6 w-6 text-primary" />
                            ) : (
                                <Building2 className="h-6 w-6 text-primary" />
                            )}
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-foreground">{pageTitle}</h1>
                            <p className="text-sm text-muted-foreground">Create a new partner record</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="p-6 max-w-2xl mx-auto">
                {error && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <form onSubmit={handleSubmit}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Partner Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Type Selection */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="type">Partner Type *</Label>
                                    <Select
                                        value={formData.type}
                                        onValueChange={(value: PartnerType) => setFormData({ ...formData, type: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="agent">Agent</SelectItem>
                                            <SelectItem value="subagent">Sub-agent</SelectItem>
                                            <SelectItem value="provider">Provider</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="status">Status</Label>
                                    <Select
                                        value={formData.status}
                                        onValueChange={(value: PartnerStatus) => setFormData({ ...formData, status: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STATUS_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Company Name */}
                            <div className="space-y-2">
                                <Label htmlFor="company_name">
                                    {isAgent ? 'Agent Name' : 'Company Name'} *
                                </Label>
                                <Input
                                    id="company_name"
                                    placeholder={isAgent ? 'e.g., John Smith Agency' : 'e.g., ABC Education'}
                                    value={formData.company_name}
                                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                    required
                                />
                            </div>

                            {/* Contact Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="contact_name">Contact Person</Label>
                                    <Input
                                        id="contact_name"
                                        placeholder="Full name"
                                        value={formData.contact_name}
                                        onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="country">Country</Label>
                                    <Input
                                        id="country"
                                        placeholder="e.g., Australia"
                                        value={formData.country}
                                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Email & Phone */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="email@example.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder="+61 400 000 000"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Priority & Commission */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="priority_level">Priority Level</Label>
                                    <Select
                                        value={formData.priority_level}
                                        onValueChange={(value: PriorityLevel) => setFormData({ ...formData, priority_level: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PRIORITY_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="commission_rate">Commission Rate (%)</Label>
                                    <Input
                                        id="commission_rate"
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        placeholder="e.g., 10"
                                        value={formData.commission_rate}
                                        onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Preferred Channel */}
                            <div className="space-y-2">
                                <Label htmlFor="preferred_channel">Preferred Contact Channel</Label>
                                <Select
                                    value={formData.preferred_channel}
                                    onValueChange={(value: ContactChannel) => setFormData({ ...formData, preferred_channel: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select preferred channel" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CHANNEL_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Address */}
                            <div className="space-y-2">
                                <Label htmlFor="address">Address</Label>
                                {GOOGLE_MAPS_API_KEY ? (
                                    <AddressAutocomplete
                                        value={formData.address}
                                        onChange={(value) => setFormData({ ...formData, address: value })}
                                        onAddressSelect={(components: AddressComponents) => {
                                            setFormData({ ...formData, address: components.fullAddress });
                                        }}
                                        apiKey={GOOGLE_MAPS_API_KEY}
                                        placeholder="Start typing address..."
                                    />
                                ) : (
                                    <Input
                                        id="address"
                                        placeholder="Street address"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    />
                                )}
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Additional notes..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows={3}
                                />
                            </div>

                            {/* Submit */}
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Link href="/portal/partners">
                                    <Button type="button" variant="outline">Cancel</Button>
                                </Link>
                                <Button type="submit" disabled={loading}>
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        `Create ${PARTNER_TYPE_LABELS[formData.type as PartnerType]}`
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

// Loading fallback
function LoadingFallback() {
    return (
        <main className="flex-1 overflow-y-auto flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
    );
}

// Wrap in Suspense for useSearchParams
export default function NewPartnerPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <NewPartnerForm />
        </Suspense>
    );
}

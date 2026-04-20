'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

type RtoStatus = 'active' | 'pending' | 'suspended' | 'inactive';

type PortalRtoResponse = {
    configuredRtoId: string | null;
    isImplicit: boolean;
    rto: {
        id: string;
        code: string;
        name: string;
        status: RtoStatus;
        location: string | null;
        state: string | null;
        phone: string | null;
        email: string | null;
        website: string | null;
        notes: string | null;
        providerName: string | null;
        contactPersonName: string | null;
    } | null;
};

const EMPTY_FORM = {
    code: '',
    name: '',
    status: 'active' as RtoStatus,
    location: '',
    state: '',
    phone: '',
    email: '',
    website: '',
    notes: '',
    providerName: '',
    contactPersonName: '',
};

export default function PortalRtoSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [portalRto, setPortalRto] = useState<PortalRtoResponse | null>(null);
    const [formData, setFormData] = useState(EMPTY_FORM);

    async function loadPortalRto() {
        setLoading(true);
        try {
            const response = await fetch('/api/portal-rto', { cache: 'no-store' });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
                        ? payload.error
                        : 'Unable to load portal RTO settings.'
                );
            }

            const data = payload && typeof payload === 'object' && 'data' in payload
                ? payload.data as PortalRtoResponse
                : null;

            setPortalRto(data);
            setFormData({
                code: data?.rto?.code || '',
                name: data?.rto?.name || '',
                status: data?.rto?.status || 'active',
                location: data?.rto?.location || '',
                state: data?.rto?.state || '',
                phone: data?.rto?.phone || '',
                email: data?.rto?.email || '',
                website: data?.rto?.website || '',
                notes: data?.rto?.notes || '',
                providerName: data?.rto?.providerName || '',
                contactPersonName: data?.rto?.contactPersonName || '',
            });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to load portal RTO settings.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadPortalRto();
    }, []);

    async function handleSave() {
        setSaving(true);
        try {
            const response = await fetch('/api/portal-rto', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(
                    payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
                        ? payload.error
                        : 'Unable to save the portal RTO.'
                );
            }

            const data = payload && typeof payload === 'object' && 'data' in payload
                ? payload.data as PortalRtoResponse
                : null;
            setPortalRto(data);
            toast.success('Portal RTO saved.', {
                description: 'Transferred applications will now use this RTO by default.',
            });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to save the portal RTO.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className="flex-1 overflow-y-auto">
            <header className="bg-card border-b border-border px-6 py-4">
                <div>
                    <h1 className="text-2xl font-semibold text-foreground">Portal RTO</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Configure the single RTO this portal uses for transferred applications and qualification pricing.
                    </p>
                </div>
            </header>

            <div className="p-6">
                <Card className="max-w-4xl">
                    <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5" />
                                    RTO Details
                                </CardTitle>
                                <CardDescription>
                                    This record becomes the default local RTO for every incoming transferred application.
                                </CardDescription>
                            </div>
                            {portalRto?.rto ? (
                                <Badge variant={portalRto.isImplicit ? 'outline' : 'default'}>
                                    {portalRto.isImplicit ? 'Needs confirmation' : 'Configured'}
                                </Badge>
                            ) : (
                                <Badge variant="outline">Not configured</Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {loading ? (
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading portal RTO settings...
                            </div>
                        ) : (
                            <>
                                {portalRto?.isImplicit ? (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                        One existing RTO record was found. Save this page once to confirm it as the portal default.
                                    </div>
                                ) : null}

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="portal-rto-code">RTO Code</Label>
                                        <Input
                                            id="portal-rto-code"
                                            value={formData.code}
                                            onChange={(event) => setFormData((current) => ({
                                                ...current,
                                                code: event.target.value,
                                            }))}
                                            placeholder="e.g. 91234"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="portal-rto-status">Status</Label>
                                        <Select
                                            value={formData.status}
                                            onValueChange={(value) => setFormData((current) => ({
                                                ...current,
                                                status: value as RtoStatus,
                                            }))}
                                        >
                                            <SelectTrigger id="portal-rto-status">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="pending">Pending</SelectItem>
                                                <SelectItem value="suspended">Suspended</SelectItem>
                                                <SelectItem value="inactive">Inactive</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="portal-rto-name">Organization Name</Label>
                                        <Input
                                            id="portal-rto-name"
                                            value={formData.name}
                                            onChange={(event) => setFormData((current) => ({
                                                ...current,
                                                name: event.target.value,
                                            }))}
                                            placeholder="Edward College"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="portal-provider-name">Provider Name</Label>
                                        <Input
                                            id="portal-provider-name"
                                            value={formData.providerName}
                                            onChange={(event) => setFormData((current) => ({
                                                ...current,
                                                providerName: event.target.value,
                                            }))}
                                            placeholder="Trading name"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="portal-contact-person">Contact Person</Label>
                                        <Input
                                            id="portal-contact-person"
                                            value={formData.contactPersonName}
                                            onChange={(event) => setFormData((current) => ({
                                                ...current,
                                                contactPersonName: event.target.value,
                                            }))}
                                            placeholder="Primary contact"
                                        />
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="portal-rto-location">Location</Label>
                                        <Input
                                            id="portal-rto-location"
                                            value={formData.location}
                                            onChange={(event) => setFormData((current) => ({
                                                ...current,
                                                location: event.target.value,
                                            }))}
                                            placeholder="Street address"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="portal-rto-state">State</Label>
                                        <Select
                                            value={formData.state || 'none'}
                                            onValueChange={(value) => setFormData((current) => ({
                                                ...current,
                                                state: value === 'none' ? '' : value,
                                            }))}
                                        >
                                            <SelectTrigger id="portal-rto-state">
                                                <SelectValue placeholder="Select state" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Not set</SelectItem>
                                                <SelectItem value="NSW">New South Wales</SelectItem>
                                                <SelectItem value="VIC">Victoria</SelectItem>
                                                <SelectItem value="QLD">Queensland</SelectItem>
                                                <SelectItem value="WA">Western Australia</SelectItem>
                                                <SelectItem value="SA">South Australia</SelectItem>
                                                <SelectItem value="TAS">Tasmania</SelectItem>
                                                <SelectItem value="ACT">ACT</SelectItem>
                                                <SelectItem value="NT">Northern Territory</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="portal-rto-phone">Phone</Label>
                                        <Input
                                            id="portal-rto-phone"
                                            value={formData.phone}
                                            onChange={(event) => setFormData((current) => ({
                                                ...current,
                                                phone: event.target.value,
                                            }))}
                                            placeholder="+61 2 9000 0000"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="portal-rto-email">Email</Label>
                                        <Input
                                            id="portal-rto-email"
                                            type="email"
                                            value={formData.email}
                                            onChange={(event) => setFormData((current) => ({
                                                ...current,
                                                email: event.target.value,
                                            }))}
                                            placeholder="info@example.edu.au"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="portal-rto-website">Website</Label>
                                        <Input
                                            id="portal-rto-website"
                                            value={formData.website}
                                            onChange={(event) => setFormData((current) => ({
                                                ...current,
                                                website: event.target.value,
                                            }))}
                                            placeholder="https://example.edu.au"
                                        />
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="portal-rto-notes">Notes</Label>
                                        <Textarea
                                            id="portal-rto-notes"
                                            value={formData.notes}
                                            onChange={(event) => setFormData((current) => ({
                                                ...current,
                                                notes: event.target.value,
                                            }))}
                                            placeholder="Internal notes about this portal RTO"
                                            rows={4}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button onClick={() => void handleSave()} disabled={saving}>
                                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Save Portal RTO
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}

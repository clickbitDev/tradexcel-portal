/**
 * New Staff/Agent Page
 * 
 * Form for inviting or creating a new user account
 */

'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, UserPlus, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import type { AccountStatus, UserRole } from '@/types/database';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
    { value: 'ceo', label: 'CEO' },
    { value: 'executive_manager', label: 'Executive Manager' },
    { value: 'admin', label: 'Admin' },
    { value: 'accounts_manager', label: 'Accounts Manager' },
    { value: 'assessor', label: 'Assessor' },
    { value: 'dispatch_coordinator', label: 'Dispatch Coordinator' },
    { value: 'frontdesk', label: 'Frontdesk' },
    { value: 'developer', label: 'Developer' },
    { value: 'agent', label: 'Agent' },
];

const PASSWORD_RULES = [
    'At least 8 characters',
    'At least 1 uppercase letter',
    'At least 1 lowercase letter',
    'At least 1 number',
    'At least 1 special character',
] as const;

function validatePassword(password: string): string | null {
    if (password.length < 8) {
        return 'Password must be at least 8 characters long';
    }

    if (!/[A-Z]/.test(password)) {
        return 'Password must include at least one uppercase letter';
    }

    if (!/[a-z]/.test(password)) {
        return 'Password must include at least one lowercase letter';
    }

    if (!/[0-9]/.test(password)) {
        return 'Password must include at least one number';
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        return 'Password must include at least one special character';
    }

    return null;
}

function NewStaffForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const requestedRole = searchParams.get('role');
    const defaultRole: UserRole = ROLE_OPTIONS.some((option) => option.value === requestedRole)
        ? requestedRole as UserRole
        : 'admin';

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showManualPassword, setShowManualPassword] = useState(false);
    const [showManualConfirmPassword, setShowManualConfirmPassword] = useState(false);

    const [inviteData, setInviteData] = useState({
        email: '',
        role: defaultRole,
    });

    const [manualData, setManualData] = useState({
        email: '',
        full_name: '',
        phone: '',
        role: defaultRole,
        password: '',
        confirmPassword: '',
        account_status: 'active' as AccountStatus,
    });

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!inviteData.email) {
            setError('Email is required');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/staff/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: inviteData.email,
                    role: inviteData.role,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to send invitation');
            }

            setSuccess(`Invitation sent to ${inviteData.email}. They will receive a magic link to create their account.`);

            // Redirect after success
            setTimeout(() => {
                if (inviteData.role === 'agent') {
                    router.push('/portal/settings/agents');
                } else {
                    router.push('/portal/settings/staff');
                }
            }, 2000);
        } catch (err) {
            console.error('Invite error:', err);
            setError(err instanceof Error ? err.message : 'Failed to send invitation');
        } finally {
            setLoading(false);
        }
    };

    const handleManualCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!manualData.email || !manualData.full_name || !manualData.password || !manualData.confirmPassword) {
            setError('Email, full name, password, and confirm password are required');
            return;
        }

        if (manualData.password !== manualData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        const passwordError = validatePassword(manualData.password);
        if (passwordError) {
            setError(passwordError);
            return;
        }

        setLoading(true);

        try {
            // Use API route to create user via Admin API
            const response = await fetch('/api/staff/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: manualData.email,
                    full_name: manualData.full_name,
                    phone: manualData.phone || null,
                    role: manualData.role,
                    password: manualData.password,
                    confirmPassword: manualData.confirmPassword,
                    account_status: manualData.account_status,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create user');
            }

            setSuccess(
                manualData.account_status === 'disabled'
                    ? `User created for ${manualData.full_name} as disabled. They will not be able to sign in until activated.`
                    : `User created for ${manualData.full_name}. They can now sign in with the configured password.`
            );

            // Redirect after success
            setTimeout(() => {
                if (manualData.role === 'agent') {
                    router.push('/portal/settings/agents');
                } else {
                    router.push('/portal/settings/staff');
                }
            }, 2000);
        } catch (err) {
            console.error('Create error:', err);
            setError(err instanceof Error ? err.message : 'Failed to create user');
        } finally {
            setLoading(false);
        }
    };

    const backLink = defaultRole === 'agent' ? '/portal/settings/agents' : '/portal/settings/staff';
    const pageTitle = defaultRole === 'agent' ? 'Add Agent' : 'Add Staff Member';

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link href={backLink}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                            <UserPlus className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-foreground">{pageTitle}</h1>
                            <p className="text-sm text-muted-foreground">Invite or create a new user</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="p-6 max-w-2xl mx-auto">
                {error && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {success && (
                    <Alert className="mb-6 border-green-200 bg-green-50 text-green-700">
                        <Mail className="h-4 w-4" />
                        <AlertDescription>{success}</AlertDescription>
                    </Alert>
                )}

                <Tabs defaultValue="manual" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="invite">Send Invitation</TabsTrigger>
                        <TabsTrigger value="manual">Create Profile</TabsTrigger>
                    </TabsList>

                    {/* Invite Tab */}
                    <TabsContent value="invite">
                        <form onSubmit={handleInvite}>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Invite by Email</CardTitle>
                                    <CardDescription>
                                        Send an invitation email to the user. They will be able to create their own password.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="invite-email">Email Address *</Label>
                                        <Input
                                            id="invite-email"
                                            type="email"
                                            placeholder="user@example.com"
                                            value={inviteData.email}
                                            onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="invite-role">Role</Label>
                                        <Select
                                            value={inviteData.role}
                                            onValueChange={(value: UserRole) => setInviteData({ ...inviteData, role: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ROLE_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t">
                                        <Link href={backLink}>
                                            <Button type="button" variant="outline">Cancel</Button>
                                        </Link>
                                        <Button type="submit" disabled={loading}>
                                            {loading ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Sending...
                                                </>
                                            ) : (
                                                <>
                                                    <Mail className="h-4 w-4 mr-2" />
                                                    Send Invitation
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </form>
                    </TabsContent>

                    {/* Manual Tab */}
                    <TabsContent value="manual">
                        <form onSubmit={handleManualCreate}>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Create Profile Manually</CardTitle>
                                    <CardDescription>
                                        Create a full user account with an initial password and account status.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="manual-name">Full Name *</Label>
                                            <Input
                                                id="manual-name"
                                                placeholder="John Doe"
                                                value={manualData.full_name}
                                                onChange={(e) => setManualData({ ...manualData, full_name: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="manual-role">Role</Label>
                                            <Select
                                                value={manualData.role}
                                                onValueChange={(value: UserRole) => setManualData({ ...manualData, role: value })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ROLE_OPTIONS.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="manual-email">Email Address *</Label>
                                        <Input
                                            id="manual-email"
                                            type="email"
                                            placeholder="user@example.com"
                                            value={manualData.email}
                                            onChange={(e) => setManualData({ ...manualData, email: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="manual-phone">Phone</Label>
                                        <Input
                                            id="manual-phone"
                                            type="tel"
                                            placeholder="+61 400 000 000"
                                            value={manualData.phone}
                                            onChange={(e) => setManualData({ ...manualData, phone: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="manual-password">Password *</Label>
                                        <div className="relative">
                                            <Input
                                                id="manual-password"
                                                type={showManualPassword ? 'text' : 'password'}
                                                placeholder="Enter initial password"
                                                value={manualData.password}
                                                onChange={(e) => setManualData({ ...manualData, password: e.target.value })}
                                                required
                                                className="pr-11"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                                                onClick={() => setShowManualPassword((prev) => !prev)}
                                            >
                                                {showManualPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                        <div className="text-xs text-muted-foreground space-y-1">
                                            <p>Password must include:</p>
                                            <ul className="list-disc pl-4 space-y-0.5">
                                                {PASSWORD_RULES.map((rule) => (
                                                    <li key={rule}>{rule}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="manual-confirm-password">Confirm Password *</Label>
                                        <div className="relative">
                                            <Input
                                                id="manual-confirm-password"
                                                type={showManualConfirmPassword ? 'text' : 'password'}
                                                placeholder="Confirm initial password"
                                                value={manualData.confirmPassword}
                                                onChange={(e) => setManualData({ ...manualData, confirmPassword: e.target.value })}
                                                required
                                                className="pr-11"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                                                onClick={() => setShowManualConfirmPassword((prev) => !prev)}
                                            >
                                                {showManualConfirmPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="manual-account-status">Account Status</Label>
                                        <Select
                                            value={manualData.account_status}
                                            onValueChange={(value: AccountStatus) => setManualData({ ...manualData, account_status: value })}
                                        >
                                            <SelectTrigger id="manual-account-status">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="disabled">Disabled</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">
                                            Disabled users are blocked from signing in until reactivated.
                                        </p>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t">
                                        <Link href={backLink}>
                                            <Button type="button" variant="outline">Cancel</Button>
                                        </Link>
                                        <Button type="submit" disabled={loading}>
                                            {loading ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Creating...
                                                </>
                                            ) : (
                                                'Create Account'
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </form>
                    </TabsContent>
                </Tabs>
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

// Wrap the form component in Suspense to fix build error
export default function NewStaffPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <NewStaffForm />
        </Suspense>
    );
}

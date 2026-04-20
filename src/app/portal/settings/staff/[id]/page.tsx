'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Save, Loader2, User, Shield, Calendar, Lock, DollarSign, GraduationCap, Trash2, Plus, Eye, EyeOff } from 'lucide-react';
import {
    getAssessorQualifications,
    getAvailableQualifications,
    addAssessorQualification,
    removeAssessorQualification,
    type AssessorQualification,
} from '@/lib/services/assessor-qualification-service';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AccountStatus, Profile, UserRole } from '@/types/database';
import { usePermissions } from '@/hooks/usePermissions';
import { NON_DELETED_PROFILE_FILTER } from '@/lib/staff/profile-filters';

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
    { value: 'ceo', label: 'CEO', description: 'Full admin access' },
    { value: 'executive_manager', label: 'Executive Manager', description: 'Manage staff and operations' },
    { value: 'admin', label: 'Admin', description: 'Staff with admin features' },
    { value: 'accounts_manager', label: 'Accounts Manager', description: 'Finance and payments' },
    { value: 'assessor', label: 'Assessor', description: 'Assessment workflow' },
    { value: 'dispatch_coordinator', label: 'Dispatch Coordinator', description: 'Dispatch and logistics' },
    { value: 'frontdesk', label: 'Frontdesk', description: 'Basic operations' },
    { value: 'developer', label: 'Developer', description: 'Full system access' },
    { value: 'agent', label: 'Agent', description: 'Submit and view own applications' },
];

const ROLE_LABELS: Record<UserRole, string> = {
    ceo: 'CEO',
    executive_manager: 'Executive Manager',
    admin: 'Admin',
    accounts_manager: 'Accounts Manager',
    assessor: 'Assessor',
    dispatch_coordinator: 'Dispatch Coordinator',
    frontdesk: 'Frontdesk',
    developer: 'Developer',
    agent: 'Agent',
};

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

// Only CEO and Developer can modify user roles
const ROLE_MODIFY_ROLES: UserRole[] = ['ceo', 'developer'];

export default function StaffEditPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        full_name: '',
        phone: '',
        role: 'agent' as UserRole,
        assessor_rate: '' as string,
        account_status: 'active' as AccountStatus,
    });
    const [passwordData, setPasswordData] = useState({
        newPassword: '',
        confirmPassword: '',
    });
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteConfirmValue, setDeleteConfirmValue] = useState('');
    const [deleting, setDeleting] = useState(false);
    // Assessor qualifications state
    const [qualifications, setQualifications] = useState<AssessorQualification[]>([]);
    const [availableQualifications, setAvailableQualifications] = useState<{ id: string; code: string; name: string }[]>([]);
    const [loadingQualifications, setLoadingQualifications] = useState(false);
    const [addingQualification, setAddingQualification] = useState(false);
    const [selectedQualificationId, setSelectedQualificationId] = useState<string>('');
    const supabase = useMemo(() => createClient(), []);
    const { role: currentUserRole, can } = usePermissions();

    // Only CEO and Developer can edit roles
    const canEditRole = currentUserRole && ROLE_MODIFY_ROLES.includes(currentUserRole);
    const canDeleteStaff = currentUserRole && ROLE_MODIFY_ROLES.includes(currentUserRole);
    const canManageAccount = can('staff.manage');

    useEffect(() => {
        const fetchProfile = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', id)
                .or(NON_DELETED_PROFILE_FILTER)
                .single();

            if (error) {
                toast.error(error.message || 'Failed to load staff profile');
            }

            if (data) {
                setProfile(data);
                setFormData({
                    full_name: data.full_name || '',
                    phone: data.phone || '',
                    role: data.role,
                    assessor_rate: data.assessor_rate?.toString() || '',
                    account_status: data.account_status || 'active',
                });
            }
            setLoading(false);
        };

        fetchProfile();
    }, [id, supabase]);

    // Fetch qualifications when profile is loaded and is an assessor
    useEffect(() => {
        const fetchQualifications = async () => {
            if (!profile || profile.role !== 'assessor') return;

            setLoadingQualifications(true);
            const [qualResult, availResult] = await Promise.all([
                getAssessorQualifications(id),
                getAvailableQualifications(id),
            ]);

            if (qualResult.data) setQualifications(qualResult.data);
            if (availResult.data) setAvailableQualifications(availResult.data);
            setLoadingQualifications(false);
        };

        fetchQualifications();
    }, [profile, id]);

    // Add qualification handler
    const handleAddQualification = async () => {
        if (!selectedQualificationId) return;

        setAddingQualification(true);
        const { data, error } = await addAssessorQualification(id, selectedQualificationId);

        if (error) {
            toast.error(error);
        } else if (data) {
            setQualifications(prev => [data, ...prev]);
            setAvailableQualifications(prev => prev.filter(q => q.id !== selectedQualificationId));
            setSelectedQualificationId('');
            toast.success('Qualification added');
        }
        setAddingQualification(false);
    };

    // Remove qualification handler
    const handleRemoveQualification = async (qualificationId: string) => {
        const { error } = await removeAssessorQualification(id, qualificationId);

        if (error) {
            toast.error(error);
        } else {
            const removed = qualifications.find(q => q.qualification_id === qualificationId);
            setQualifications(prev => prev.filter(q => q.qualification_id !== qualificationId));
            if (removed?.qualification) {
                setAvailableQualifications(prev => [...prev, {
                    id: removed.qualification!.id,
                    code: removed.qualification!.code,
                    name: removed.qualification!.name,
                }].sort((a, b) => a.code.localeCompare(b.code)));
            }
            toast.success('Qualification removed');
        }
    };

    const handleSave = async () => {
        setSaving(true);

        const wantsPasswordChange = passwordData.newPassword.length > 0 || passwordData.confirmPassword.length > 0;
        const currentStatus = profile?.account_status || 'active';
        const statusChanged = formData.account_status !== currentStatus;

        if (wantsPasswordChange) {
            if (!passwordData.newPassword || !passwordData.confirmPassword) {
                toast.error('Enter both password fields to change password');
                setSaving(false);
                return;
            }

            if (passwordData.newPassword !== passwordData.confirmPassword) {
                toast.error('Passwords do not match');
                setSaving(false);
                return;
            }

            const passwordError = validatePassword(passwordData.newPassword);
            if (passwordError) {
                toast.error(passwordError);
                setSaving(false);
                return;
            }
        }

        if ((wantsPasswordChange || statusChanged) && !canManageAccount) {
            toast.error('You do not have permission to update account security');
            setSaving(false);
            return;
        }

        // Only include role in update if user has permission to edit roles
        const updateData: { full_name: string; phone: string; role?: UserRole; assessor_rate?: number | null } = {
            full_name: formData.full_name,
            phone: formData.phone,
        };

        if (canEditRole) {
            updateData.role = formData.role;
        }

        // Include assessor_rate if the user is an assessor
        if (formData.role === 'assessor' || profile?.role === 'assessor') {
            updateData.assessor_rate = formData.assessor_rate ? parseFloat(formData.assessor_rate) : null;
        }

        const { error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', id);

        if (error) {
            toast.error(error.message || 'Failed to save profile changes');
            setSaving(false);
            return;
        }

        if (wantsPasswordChange || statusChanged) {
            const response = await fetch(`/api/staff/${id}/account`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    account_status: statusChanged ? formData.account_status : undefined,
                    password: wantsPasswordChange ? passwordData.newPassword : undefined,
                    confirmPassword: wantsPasswordChange ? passwordData.confirmPassword : undefined,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                toast.error(result.error || 'Failed to update account security');
                setSaving(false);
                return;
            }
        }

        toast.success('Staff account updated');
        router.push('/portal/settings/staff');

        setSaving(false);
    };

    const expectedDeleteConfirmValue = (profile?.email || profile?.full_name || profile?.id || '').trim();

    const handleDeleteStaff = async () => {
        if (!profile) {
            return;
        }

        if (!canDeleteStaff) {
            toast.error('Only CEO and Developer can delete staff accounts');
            return;
        }

        if (deleteConfirmValue.trim() !== expectedDeleteConfirmValue) {
            toast.error('Confirmation text does not match');
            return;
        }

        setDeleting(true);

        try {
            const response = await fetch(`/api/staff/${profile.id}/delete`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                toast.error(payload.error || 'Failed to delete staff account');
                return;
            }

            toast.success('Staff account deleted');
            router.push('/portal/settings/staff');
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete staff account');
        } finally {
            setDeleting(false);
            setDeleteDialogOpen(false);
            setDeleteConfirmValue('');
        }
    };

    const getInitials = (name: string | null) => {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    if (loading) {
        return (
            <main className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </main>
        );
    }

    if (!profile) {
        return (
            <main className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-2">User not found</h2>
                    <Link href="/portal/settings/staff">
                        <Button variant="outline">Back to Staff</Button>
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/portal/settings/staff">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12">
                                <AvatarImage src={profile.avatar_url || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                    {getInitials(profile.full_name)}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h1 className="text-xl font-semibold text-foreground">
                                    {profile.full_name || 'Unnamed User'}
                                </h1>
                                <p className="text-sm text-muted-foreground">{profile.email}</p>
                            </div>
                        </div>
                    </div>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Changes
                    </Button>
                </div>
            </header>

            <div className="p-6 max-w-2xl">
                <div className="space-y-6">
                    {/* Profile Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Profile Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="full_name">Full Name</Label>
                                <Input
                                    id="full_name"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    placeholder="Enter full name"
                                />
                            </div>
                            <div>
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    value={profile.email || ''}
                                    disabled
                                    className="bg-muted"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Email cannot be changed here
                                </p>
                            </div>
                            <div>
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="Enter phone number"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Role Assignment */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Role Assignment
                                {!canEditRole && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                        <Lock className="h-3 w-3 mr-1" />
                                        Read Only
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Label htmlFor="role">User Role</Label>
                            {canEditRole ? (
                                <Select
                                    value={formData.role}
                                    onValueChange={(v) => setFormData({ ...formData, role: v as UserRole })}
                                >
                                    <SelectTrigger className="w-full mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ROLE_OPTIONS.map((role) => (
                                            <SelectItem key={role.value} value={role.value}>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{role.label}</span>
                                                    <span className="text-xs text-muted-foreground">{role.description}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="mt-2">
                                    <Badge variant="secondary" className="text-sm px-3 py-1.5">
                                        {ROLE_LABELS[profile.role] || profile.role}
                                    </Badge>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Only CEO and Developer can modify user roles.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Account Security */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Lock className="h-5 w-5" />
                                Account Security
                                {!canManageAccount && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                        <Lock className="h-3 w-3 mr-1" />
                                        Read Only
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="account_status">Account Status</Label>
                                <Select
                                    value={formData.account_status}
                                    onValueChange={(value: AccountStatus) => setFormData({ ...formData, account_status: value })}
                                    disabled={!canManageAccount}
                                >
                                    <SelectTrigger id="account_status" className="w-full mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="disabled">Disabled</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Disabled users are blocked from sign-in until their account is reactivated.
                                </p>
                            </div>

                            <div>
                                <Label htmlFor="new_password">New Password</Label>
                                <div className="relative mt-1">
                                    <Input
                                        id="new_password"
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        placeholder="Leave blank to keep current password"
                                        className="pr-11"
                                        disabled={!canManageAccount}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                                        onClick={() => setShowNewPassword((prev) => !prev)}
                                        disabled={!canManageAccount}
                                    >
                                        {showNewPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                                <div className="text-xs text-muted-foreground mt-2 space-y-1">
                                    <p>You can set an initial password here for older accounts that were created without one.</p>
                                    <p>Password must include:</p>
                                    <ul className="list-disc pl-4 space-y-0.5">
                                        {PASSWORD_RULES.map((rule) => (
                                            <li key={rule}>{rule}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="confirm_new_password">Confirm New Password</Label>
                                <div className="relative mt-1">
                                    <Input
                                        id="confirm_new_password"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        placeholder="Re-enter new password"
                                        className="pr-11"
                                        disabled={!canManageAccount}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                                        disabled={!canManageAccount}
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Re-enter the same password.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Assessor Settings - Only show for assessor role */}
                    {(formData.role === 'assessor' || profile.role === 'assessor') && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <DollarSign className="h-5 w-5" />
                                    Assessor Settings
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="assessor_rate">Fixed Rate (AUD)</Label>
                                    <Input
                                        id="assessor_rate"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.assessor_rate}
                                        onChange={(e) => setFormData({ ...formData, assessor_rate: e.target.value })}
                                        placeholder="Enter fixed rate e.g. 150.00"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        This rate will be used when assigning this assessor to applications
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Assessor Qualifications - Only show for assessor role */}
                    {(formData.role === 'assessor' || profile.role === 'assessor') && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <GraduationCap className="h-5 w-5" />
                                    Assessor Qualifications
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Add qualification dropdown */}
                                <div className="flex gap-2">
                                    <Select
                                        value={selectedQualificationId}
                                        onValueChange={setSelectedQualificationId}
                                        disabled={loadingQualifications || availableQualifications.length === 0}
                                    >
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder={
                                                loadingQualifications
                                                    ? "Loading..."
                                                    : availableQualifications.length === 0
                                                        ? "All qualifications assigned"
                                                        : "Select qualification to add"
                                            } />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableQualifications.map((qual) => (
                                                <SelectItem key={qual.id} value={qual.id}>
                                                    <span className="font-mono text-xs mr-2">{qual.code}</span>
                                                    <span className="text-sm">{qual.name}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        onClick={handleAddQualification}
                                        disabled={!selectedQualificationId || addingQualification}
                                        size="icon"
                                    >
                                        {addingQualification ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Plus className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>

                                {/* Qualifications list */}
                                {loadingQualifications ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : qualifications.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No qualifications assigned yet
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {qualifications.map((qual) => (
                                            <div
                                                key={qual.id}
                                                className="flex items-center justify-between p-2 rounded-md border bg-muted/30"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-mono text-xs text-muted-foreground">
                                                        {qual.qualification?.code}
                                                    </p>
                                                    <p className="text-sm truncate">
                                                        {qual.qualification?.name}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleRemoveQualification(qual.qualification_id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Assigned qualifications determine which applications this assessor can be assigned to
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Account Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Account Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">User ID</span>
                                <span className="font-mono text-xs">{profile.id}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Created</span>
                                <span>{new Date(profile.created_at).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Last Updated</span>
                                <span>{new Date(profile.updated_at).toLocaleString()}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Danger Zone */}
                    {canDeleteStaff ? (
                        <Card className="border-destructive/30">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-destructive">
                                    <Trash2 className="h-5 w-5" />
                                    Danger Zone
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-sm text-muted-foreground space-y-2">
                                    <p>
                                        Deleting a staff member disables their login and hides them from active staff lists,
                                        assignments, mentions, and recipient pickers.
                                    </p>
                                    <p>
                                        Historical application, workflow, audit, and notification records stay intact.
                                    </p>
                                    <p>
                                        You must reassign any active staff dependencies before this action can succeed.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={() => setDeleteDialogOpen(true)}
                                    disabled={deleting}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Staff
                                </Button>
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            </div>

            <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                    setDeleteDialogOpen(open);
                    if (!open) {
                        setDeleteConfirmValue('');
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">Delete this staff account?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This safely deletes the staff account by disabling sign-in and removing the user from active
                            staff pickers, while preserving historical application and audit records. To confirm, type
                            <span className="mx-1 font-semibold text-foreground">{expectedDeleteConfirmValue}</span>
                            below.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-2">
                        <Label htmlFor="delete-confirm-value">Confirmation</Label>
                        <Input
                            id="delete-confirm-value"
                            value={deleteConfirmValue}
                            onChange={(event) => setDeleteConfirmValue(event.target.value)}
                            placeholder={expectedDeleteConfirmValue || 'Type confirmation text'}
                            disabled={deleting}
                        />
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                event.preventDefault();
                                void handleDeleteStaff();
                            }}
                            disabled={deleting}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete Staff'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    );
}

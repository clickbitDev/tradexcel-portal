'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User, Building2, Phone, AlertCircle, CheckCircle2, Upload, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Profile } from '@/types/database';
import Link from 'next/link';

export default function AgentProfilePage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [authAvatarUrl, setAuthAvatarUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [companyName, setCompanyName] = useState('');

    const supabase = createClient();

    const loadProfile = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const oauthAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;
            setAuthAvatarUrl(oauthAvatar || null);

            const { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('Error loading profile:', error);
            } else if (profileData) {
                setProfile(profileData);
                setFullName(profileData.full_name || '');
                setPhone(profileData.phone || '');
                setCompanyName(profileData.company_name || '');
            }
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !profile) return;

        if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
            setMessage({ type: 'error', text: 'Please upload a valid image file (JPEG, PNG, GIF, or WebP)' });
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'Image must be less than 5MB' });
            return;
        }

        setUploadingAvatar(true);
        setMessage(null);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${profile.id}/avatar.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file, { upsert: true });

            if (uploadError) {
                setMessage({ type: 'error', text: uploadError.message });
                return;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            const avatarUrl = `${publicUrl}?t=${Date.now()}`;

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: avatarUrl })
                .eq('id', profile.id);

            if (updateError) {
                setMessage({ type: 'error', text: updateError.message });
            } else {
                setMessage({ type: 'success', text: 'Profile photo updated' });
                await loadProfile();
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to upload avatar' });
        } finally {
            setUploadingAvatar(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleRemoveAvatar = async () => {
        if (!profile) return;

        setUploadingAvatar(true);
        setMessage(null);

        try {
            const { data: files } = await supabase.storage
                .from('avatars')
                .list(profile.id);

            if (files && files.length > 0) {
                const filePaths = files.map(f => `${profile.id}/${f.name}`);
                await supabase.storage.from('avatars').remove(filePaths);
            }

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('id', profile.id);

            if (updateError) {
                setMessage({ type: 'error', text: updateError.message });
            } else {
                setMessage({ type: 'success', text: 'Profile photo removed' });
                await loadProfile();
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to remove avatar' });
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName,
                    phone: phone || null,
                    company_name: companyName || null,
                })
                .eq('id', profile?.id);

            if (error) {
                setMessage({ type: 'error', text: error.message });
            } else {
                setMessage({ type: 'success', text: 'Profile updated successfully' });
                await loadProfile();
            }
        } catch {
            setMessage({ type: 'error', text: 'An unexpected error occurred' });
        } finally {
            setSaving(false);
        }
    };

    const getInitials = (name: string | null | undefined) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-2xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold">Edit Profile</h1>
                <p className="text-muted-foreground mt-1">
                    Update your personal and business information
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Profile Photo
                    </CardTitle>
                    <CardDescription>
                        Your profile photo is visible to other team members
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-6">
                    <Avatar className="h-20 w-20">
                        <AvatarImage src={profile?.avatar_url || authAvatarUrl || undefined} />
                        <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                            {getInitials(profile?.full_name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            onChange={handleAvatarUpload}
                            className="hidden"
                            id="avatar-upload"
                        />
                        <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingAvatar}
                        >
                            {uploadingAvatar ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Upload className="h-4 w-4 mr-2" />
                            )}
                            {profile?.avatar_url ? 'Change photo' : 'Upload photo'}
                        </Button>
                        {profile?.avatar_url && (
                            <Button
                                variant="ghost"
                                onClick={handleRemoveAvatar}
                                disabled={uploadingAvatar}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Personal Information
                    </CardTitle>
                    <CardDescription>
                        Your name and contact information
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSave} className="space-y-4">
                        {message && (
                            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
                                {message.type === 'error' ? (
                                    <AlertCircle className="h-4 w-4" />
                                ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                )}
                                <AlertDescription>{message.text}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email">Email address</Label>
                            <Input
                                id="email"
                                type="email"
                                value={profile?.email || ''}
                                disabled
                                className="bg-muted"
                            />
                            <p className="text-xs text-muted-foreground">
                                To change your email, go to <Link href="/portal/agent/profile/security" className="text-primary hover:underline">Account Security</Link>
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="fullName">Full name</Label>
                            <Input
                                id="fullName"
                                type="text"
                                placeholder="Enter your full name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone" className="flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                Phone number
                            </Label>
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="+61 400 000 000"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="companyName" className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                Company / Business Name
                            </Label>
                            <Input
                                id="companyName"
                                type="text"
                                placeholder="Your company or agent name"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                This is used to identify your business in the portal
                            </p>
                        </div>

                        <div className="pt-4">
                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save changes'
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Account Role</CardTitle>
                    <CardDescription>
                        Your role determines your access level in the portal
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3">
                        <div className="px-3 py-1.5 bg-primary/10 rounded-md">
                            <span className="text-sm font-medium text-primary capitalize">
                                {profile?.role?.replace('_', ' ') || 'Unknown'}
                            </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                            Contact an administrator to change your role
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

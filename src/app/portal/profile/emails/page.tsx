'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, Plus, Trash2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import type { Profile } from '@/types/database';

export default function EmailsPage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [newEmail, setNewEmail] = useState('');
    const [secondaryEmails, setSecondaryEmails] = useState<string[]>([]);

    const supabase = createClient();

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileData) {
                setProfile(profileData);
                setSecondaryEmails(profileData.secondary_emails || []);
            }
        }
        setLoading(false);
    };

    const handleAddEmail = async () => {
        if (!newEmail || !profile) return;

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            setMessage({ type: 'error', text: 'Please enter a valid email address' });
            return;
        }

        if (secondaryEmails.includes(newEmail) || newEmail === profile.email) {
            setMessage({ type: 'error', text: 'This email is already added' });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            const updatedEmails = [...secondaryEmails, newEmail];
            const { error } = await supabase
                .from('profiles')
                .update({ secondary_emails: updatedEmails })
                .eq('id', profile.id);

            if (error) {
                setMessage({ type: 'error', text: error.message });
            } else {
                setSecondaryEmails(updatedEmails);
                setNewEmail('');
                setMessage({ type: 'success', text: 'Email added successfully' });
            }
        } catch {
            setMessage({ type: 'error', text: 'An unexpected error occurred' });
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveEmail = async (emailToRemove: string) => {
        if (!profile) return;

        setSaving(true);
        setMessage(null);

        try {
            const updatedEmails = secondaryEmails.filter(e => e !== emailToRemove);
            const { error } = await supabase
                .from('profiles')
                .update({ secondary_emails: updatedEmails })
                .eq('id', profile.id);

            if (error) {
                setMessage({ type: 'error', text: error.message });
            } else {
                setSecondaryEmails(updatedEmails);
                setMessage({ type: 'success', text: 'Email removed' });
            }
        } catch {
            setMessage({ type: 'error', text: 'An unexpected error occurred' });
        } finally {
            setSaving(false);
        }
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
            <div className="flex items-center gap-4">
                <Link href="/portal/profile">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Manage Emails</h1>
                    <p className="text-muted-foreground mt-1">
                        Add secondary email addresses to your account
                    </p>
                </div>
            </div>

            {/* Primary Email */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Primary Email
                    </CardTitle>
                    <CardDescription>
                        Your primary email is used for login and notifications
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                            <Mail className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">{profile?.email}</span>
                        </div>
                        <Badge variant="secondary">Primary</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        To change your primary email, go to <Link href="/portal/profile/security" className="text-primary hover:underline">Account Security</Link>
                    </p>
                </CardContent>
            </Card>

            {/* Secondary Emails */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Secondary Emails
                    </CardTitle>
                    <CardDescription>
                        Add additional email addresses for receiving notifications
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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

                    {/* Existing secondary emails */}
                    {secondaryEmails.length > 0 ? (
                        <div className="space-y-2">
                            {secondaryEmails.map((email) => (
                                <div key={email} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">{email}</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveEmail(email)}
                                        disabled={saving}
                                        className="text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground py-2">
                            No secondary emails added yet
                        </p>
                    )}

                    {/* Add new email */}
                    <div className="flex gap-2 pt-2">
                        <div className="flex-1">
                            <Label htmlFor="newEmail" className="sr-only">New email address</Label>
                            <Input
                                id="newEmail"
                                type="email"
                                placeholder="Add email address"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddEmail();
                                    }
                                }}
                            />
                        </div>
                        <Button onClick={handleAddEmail} disabled={saving || !newEmail}>
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

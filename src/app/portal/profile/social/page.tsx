'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Link2, Linkedin, Twitter, Facebook, Instagram, AlertCircle, CheckCircle2, ArrowLeft, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import type { Profile } from '@/types/database';

interface SocialLinks {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
}

const SOCIAL_PLATFORMS = [
    { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/in/yourprofile', color: 'text-blue-600' },
    { key: 'twitter', label: 'Twitter / X', icon: Twitter, placeholder: 'https://twitter.com/yourhandle', color: 'text-sky-500' },
    { key: 'facebook', label: 'Facebook', icon: Facebook, placeholder: 'https://facebook.com/yourprofile', color: 'text-blue-700' },
    { key: 'instagram', label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/yourhandle', color: 'text-pink-600' },
] as const;

export default function SocialPage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [socialLinks, setSocialLinks] = useState<SocialLinks>({});

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
                setSocialLinks(profileData.social_links || {});
            }
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!profile) return;

        setSaving(true);
        setMessage(null);

        try {
            // Clean up empty strings
            const cleanedLinks: SocialLinks = {};
            Object.entries(socialLinks).forEach(([key, value]) => {
                if (value && value.trim()) {
                    cleanedLinks[key as keyof SocialLinks] = value.trim();
                }
            });

            const { error } = await supabase
                .from('profiles')
                .update({ social_links: cleanedLinks })
                .eq('id', profile.id);

            if (error) {
                setMessage({ type: 'error', text: error.message });
            } else {
                setSocialLinks(cleanedLinks);
                setMessage({ type: 'success', text: 'Social links saved successfully' });
            }
        } catch {
            setMessage({ type: 'error', text: 'An unexpected error occurred' });
        } finally {
            setSaving(false);
        }
    };

    const updateLink = (key: keyof SocialLinks, value: string) => {
        setSocialLinks(prev => ({ ...prev, [key]: value }));
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
                    <h1 className="text-2xl font-bold">Social Accounts</h1>
                    <p className="text-muted-foreground mt-1">
                        Link your social media profiles
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Link2 className="h-5 w-5" />
                        Social Media Links
                    </CardTitle>
                    <CardDescription>
                        Add links to your social media profiles to make it easier for team members to connect
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
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

                    {SOCIAL_PLATFORMS.map(({ key, label, icon: Icon, placeholder, color }) => (
                        <div key={key} className="space-y-2">
                            <Label htmlFor={key} className="flex items-center gap-2">
                                <Icon className={`h-4 w-4 ${color}`} />
                                {label}
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id={key}
                                    type="url"
                                    placeholder={placeholder}
                                    value={socialLinks[key as keyof SocialLinks] || ''}
                                    onChange={(e) => updateLink(key as keyof SocialLinks, e.target.value)}
                                />
                                {socialLinks[key as keyof SocialLinks] && (
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        nativeButton={false}
                                        render={
                                            <a
                                                href={socialLinks[key as keyof SocialLinks]}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        }
                                    />
                                )}
                            </div>
                        </div>
                    ))}

                    <div className="pt-4">
                        <Button onClick={handleSave} disabled={saving}>
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
                </CardContent>
            </Card>
        </div>
    );
}

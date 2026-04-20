'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, Unlink, Mail, AlertCircle, CheckCircle2, Lock, Shield, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { User, UserIdentity } from '@supabase/supabase-js';
import Link from 'next/link';

function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
            />
            <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
            />
            <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
            />
            <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
            />
        </svg>
    );
}

export default function AgentSecurityPage() {
    const [user, setUser] = useState<User | null>(null);
    const [identities, setIdentities] = useState<UserIdentity[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const supabase = createClient();

    const loadUser = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUser(user);
            setIdentities(user.identities || []);
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        loadUser();
    }, [loadUser]);

    const handleLinkGoogle = async () => {
        setActionLoading('google');
        setMessage(null);

        try {
            const { error } = await supabase.auth.linkIdentity({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback?next=/portal/agent/profile/security`,
                },
            });

            if (error) {
                setMessage({ type: 'error', text: error.message });
                setActionLoading(null);
            }
        } catch {
            setMessage({ type: 'error', text: 'An unexpected error occurred' });
            setActionLoading(null);
        }
    };

    const handleUnlinkIdentity = async (identity: UserIdentity) => {
        if (identities.length <= 1) {
            setMessage({ type: 'error', text: 'You must have at least one login method' });
            return;
        }

        setActionLoading(identity.id);
        setMessage(null);

        try {
            const { error } = await supabase.auth.unlinkIdentity(identity);

            if (error) {
                setMessage({ type: 'error', text: error.message });
            } else {
                setMessage({ type: 'success', text: 'Account unlinked successfully' });
                await loadUser();
            }
        } catch {
            setMessage({ type: 'error', text: 'An unexpected error occurred' });
        } finally {
            setActionLoading(null);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordLoading(true);
        setPasswordMessage(null);

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
            setPasswordLoading(false);
            return;
        }

        if (newPassword.length < 6) {
            setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' });
            setPasswordLoading(false);
            return;
        }

        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user?.email || '',
                password: currentPassword,
            });

            if (signInError) {
                setPasswordMessage({ type: 'error', text: 'Current password is incorrect' });
                setPasswordLoading(false);
                return;
            }

            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) {
                setPasswordMessage({ type: 'error', text: error.message });
            } else {
                setPasswordMessage({ type: 'success', text: 'Password updated successfully' });
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }
        } catch {
            setPasswordMessage({ type: 'error', text: 'An unexpected error occurred' });
        } finally {
            setPasswordLoading(false);
        }
    };

    const hasGoogleLinked = identities.some((i) => i.provider === 'google');

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
                <Link href="/portal/agent/profile">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Account Security</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your login methods and security settings
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Link2 className="h-5 w-5" />
                        Linked Accounts
                    </CardTitle>
                    <CardDescription>
                        Connect multiple login methods to your account.
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

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-lg">
                                <Mail className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-medium">Email & Password</p>
                                <p className="text-sm text-muted-foreground">{user?.email}</p>
                            </div>
                        </div>
                        <Badge variant="secondary">Primary</Badge>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-lg">
                                <GoogleIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-medium">Google</p>
                                {hasGoogleLinked ? (
                                    <p className="text-sm text-muted-foreground">
                                        {identities.find((i) => i.provider === 'google')?.identity_data?.email || 'Connected'}
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Not connected</p>
                                )}
                            </div>
                        </div>
                        {hasGoogleLinked ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const googleIdentity = identities.find((i) => i.provider === 'google');
                                    if (googleIdentity) handleUnlinkIdentity(googleIdentity);
                                }}
                                disabled={actionLoading === identities.find((i) => i.provider === 'google')?.id || identities.length <= 1}
                            >
                                {actionLoading === identities.find((i) => i.provider === 'google')?.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <Unlink className="h-4 w-4 mr-2" />
                                        Unlink
                                    </>
                                )}
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleLinkGoogle}
                                disabled={actionLoading === 'google'}
                            >
                                {actionLoading === 'google' ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <Link2 className="h-4 w-4 mr-2" />
                                        Link Account
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Lock className="h-5 w-5" />
                        Change Password
                    </CardTitle>
                    <CardDescription>
                        Update your password. You&apos;ll need to enter your current password.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        {passwordMessage && (
                            <Alert variant={passwordMessage.type === 'error' ? 'destructive' : 'default'}>
                                {passwordMessage.type === 'error' ? (
                                    <AlertCircle className="h-4 w-4" />
                                ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                )}
                                <AlertDescription>{passwordMessage.text}</AlertDescription>
                            </Alert>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="currentPassword">Current password</Label>
                            <Input
                                id="currentPassword"
                                type="password"
                                placeholder="••••••••"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New password</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm new password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" disabled={passwordLoading}>
                            {passwordLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                'Update password'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-400">
                        <Shield className="h-5 w-5" />
                        Security Notifications
                    </CardTitle>
                    <CardDescription>
                        You will automatically receive email notifications for:
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="text-sm text-muted-foreground space-y-2">
                        <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Password changes
                        </li>
                        <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Account linking/unlinking
                        </li>
                        <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            New sign-ins from unrecognized devices
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}

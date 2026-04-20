'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useBrowserSupabaseConfig } from '@/hooks/use-browser-supabase-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

function ResetPasswordContent() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [sessionChecked, setSessionChecked] = useState(false);
    const [hasSession, setHasSession] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabaseConfig = useBrowserSupabaseConfig();
    const configError = supabaseConfig.checked && !supabaseConfig.isConfigured
        ? supabaseConfig.message
        : null;

    // Check for error from callback
    const callbackError = searchParams.get('error');

    // Check if we have a valid session (user came from reset email)
    useEffect(() => {
        if (!supabaseConfig.checked) {
            return;
        }

        if (!supabaseConfig.isConfigured) {
            setError(supabaseConfig.message);
            setSessionChecked(true);
            setHasSession(false);
            return;
        }

        const checkSession = async () => {
            const supabase = createClient();

            // First check for hash tokens (for implicit flow)
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            const type = hashParams.get('type');

            if (accessToken && type === 'recovery') {
                // Set the session from hash tokens
                const { error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken || '',
                });
                if (!error) {
                    setHasSession(true);
                    setSessionChecked(true);
                    // Clean up the URL
                    window.history.replaceState(null, '', window.location.pathname);
                    return;
                }
            }

            // Check existing session
            const { data: { session } } = await supabase.auth.getSession();
            setHasSession(!!session);
            setSessionChecked(true);
        };
        void checkSession();
    }, [supabaseConfig.checked, supabaseConfig.isConfigured, supabaseConfig.message]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (configError) {
            setError(configError);
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            const supabase = createClient();
            const { error } = await supabase.auth.updateUser({
                password,
            });

            if (error) {
                setError(error.message);
                return;
            }

            setSuccess(true);
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    // Show loading while checking session
    if (!supabaseConfig.checked || !sessionChecked) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (configError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
                <Card className="w-full max-w-md shadow-xl">
                    <CardHeader className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-orange-500 rounded-xl flex items-center justify-center">
                            <AlertCircle className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold">Service unavailable</CardTitle>
                            <CardDescription className="mt-2">
                                {configError}
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardFooter>
                        <Button className="w-full" nativeButton={false} render={<Link href="/login">Back to login</Link>} />
                    </CardFooter>
                </Card>
            </div>
        );
    }

    // No valid session - user needs to request a new reset link
    if (!hasSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
                <Card className="w-full max-w-md shadow-xl">
                    <CardHeader className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-orange-500 rounded-xl flex items-center justify-center">
                            <AlertCircle className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold">
                                {callbackError ? 'Authentication Failed' : 'Link expired'}
                            </CardTitle>
                            <CardDescription className="mt-2">
                                {callbackError
                                    ? 'There was an authentication error. The reset link may have expired or already been used.'
                                    : 'This password reset link has expired or is invalid.'}
                                {' '}Please request a new one.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardFooter>
                        <Button 
                            className="w-full" 
                            nativeButton={false}
                            render={<Link href="/forgot-password">Request new link</Link>} 
                        />
                    </CardFooter>
                </Card>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
                <Card className="w-full max-w-md shadow-xl">
                    <CardHeader className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-green-500 rounded-xl flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold">Password updated</CardTitle>
                            <CardDescription className="mt-2">
                                Your password has been successfully reset.
                                You can now sign in with your new password.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardFooter>
                        <Button className="w-full" onClick={() => router.push('/login')}>
                            Sign in
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-primary rounded-xl flex items-center justify-center">
                        <Lock className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold">Reset your password</CardTitle>
                        <CardDescription className="mt-2">
                            Enter your new password below.
                        </CardDescription>
                    </div>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {error && (
                            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="password">New password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoFocus
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
                    </CardContent>

                    <CardFooter>
                        <Button type="submit" className="w-full" disabled={loading || Boolean(configError)}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                'Update password'
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            }
        >
            <ResetPasswordContent />
        </Suspense>
    );
}

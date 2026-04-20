'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useBrowserSupabaseConfig } from '@/hooks/use-browser-supabase-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function MagicLinkPage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const supabaseConfig = useBrowserSupabaseConfig();
    const configError = supabaseConfig.checked && !supabaseConfig.isConfigured
        ? supabaseConfig.message
        : null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (configError) {
            setError(configError);
            return;
        }

        setLoading(true);

        try {
            const supabase = createClient();
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
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

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
                <Card className="w-full max-w-md shadow-xl">
                    <CardHeader className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-green-500 rounded-xl flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
                            <CardDescription className="mt-2">
                                We&apos;ve sent a magic link to <strong>{email}</strong>.
                                Click the link to sign in instantly.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardFooter className="flex flex-col gap-3">
                        <Button 
                            variant="outline" 
                            className="w-full" 
                            nativeButton={false}
                            render={
                                <Link href="/login">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to login
                                </Link>
                            } 
                        />
                        <p className="text-xs text-muted-foreground text-center">
                            Didn&apos;t receive the email? Check your spam folder or{' '}
                            <button
                                type="button"
                                onClick={() => setSuccess(false)}
                                className="text-primary hover:underline"
                            >
                                try again
                            </button>
                        </p>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold">Magic link sign in</CardTitle>
                        <CardDescription className="mt-2">
                            No password needed. We&apos;ll email you a link to sign in instantly.
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
                        {!error && configError && (
                            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
                                {configError}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email">Email address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                    </CardContent>

                    <CardFooter className="flex flex-col gap-3">
                        <Button type="submit" className="w-full" disabled={loading || Boolean(configError)}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Send magic link
                                </>
                            )}
                        </Button>
                        <Button 
                            variant="ghost" 
                            className="w-full" 
                            nativeButton={false}
                            render={
                                <Link href="/login">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to login
                                </Link>
                            } 
                        />
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}

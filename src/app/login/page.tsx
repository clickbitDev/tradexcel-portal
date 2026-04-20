'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { BRAND_LOGO_ALT, BRAND_LOGO_SRC } from '@/lib/brand';

function LoginContent() {
    const searchParams = useSearchParams();
    const errorParam = searchParams.get('error');
    const reason = searchParams.get('reason');
    const message = searchParams.get('message');

    const error = reason === 'disabled'
        ? 'Your account is disabled. Please contact an administrator.'
        : errorParam === 'service_configuration_error'
            ? (message || 'The portal is temporarily unavailable because authentication is not configured correctly. Please contact an administrator.')
            : errorParam === 'auth_callback_error'
                ? 'Authentication failed. Please try again.'
                : null;

    return (
        <div className="grid min-h-svh lg:grid-cols-2">
            <div className="flex flex-col gap-4 p-6 lg:p-12">
                <div className="flex justify-center md:justify-start">
                    <a href="#" className="flex items-center">
                        <Image
                            src={BRAND_LOGO_SRC}
                            alt={BRAND_LOGO_ALT}
                            width={264}
                            height={88}
                            className="h-auto w-full max-w-[220px] shrink-0 object-contain md:max-w-[264px]"
                            priority
                        />
                    </a>
                </div>
                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-sm">
                        <LoginForm error={error} />
                    </div>
                </div>
            </div>
            <div className="relative hidden w-full flex-col overflow-hidden bg-background lg:flex">
                <div className="absolute inset-0 bg-gradient-to-br from-[#faf5fb] via-white to-[#f4f0f7] dark:from-[#1a1d22] dark:via-[#212429] dark:to-[#271d2a]" />
                
                <div className="pointer-events-none absolute -right-[20%] -top-[30%] h-[100%] w-[100%] rounded-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#611c69]/12 via-[#a559a5]/6 to-transparent blur-[120px] dark:from-[#a559a5]/24 dark:via-[#611c69]/10" />
                <div className="pointer-events-none absolute -bottom-[30%] -left-[20%] h-[100%] w-[100%] rounded-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#e0215b]/10 via-[#611c69]/5 to-transparent blur-[120px] dark:from-[#611c69]/20 dark:via-[#e0215b]/10" />
                
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-black/5 dark:from-black/60 dark:via-black/0 dark:to-black/30" />
                
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#611c6908_1px,transparent_1px),linear-gradient(to_bottom,#611c6908_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_70%,transparent_100%)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)]" />

                <div className="relative z-10 flex h-full flex-col justify-between p-12 text-foreground">
                    <div className="max-w-lg space-y-6">
                        <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground lg:text-5xl">
                            Streamline your workflows seamlessly.
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            The centralized platform for Edward Business College. Manage applications, coordinate tasks, and track real-time progress.
                        </p>
                    </div>

                    <div className="mt-12 mb-8 flex flex-1 items-center justify-center drop-shadow-xl dark:drop-shadow-2xl">
                        <div className="relative aspect-square w-full max-w-[450px]">
                            <Image
                                src="/Company-amico.svg"
                                alt="Company illustration"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <p>&copy; {new Date().getFullYear()} Edward Business College.</p>
                        <div className="flex gap-4">
                            <a href="#" className="transition-colors hover:text-foreground">Privacy Policy</a>
                            <a href="#" className="transition-colors hover:text-foreground">Terms of Service</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}

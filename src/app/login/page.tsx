'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

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
                    <a href="#" className="flex items-center gap-3">
                        <Image
                            src="/edward_portal_logo_symbol.png"
                            alt="Edward Business College"
                            width={44}
                            height={44}
                            className="size-11 shrink-0"
                        />
                        <span className="font-sans font-extrabold text-2xl tracking-tight text-black dark:text-white">
                            Edward Business College
                        </span>
                    </a>
                </div>
                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-sm">
                        <LoginForm error={error} />
                    </div>
                </div>
            </div>
            <div className="relative hidden w-full flex-col lg:flex overflow-hidden bg-white dark:bg-zinc-950">
                {/* Rich Modern Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#fdfbf7] via-white to-[#f4eee0] dark:from-zinc-900 dark:via-zinc-950 dark:to-[#050505]" />
                
                {/* Dynamic Brand Glows */}
                <div className="absolute -top-[30%] -right-[20%] w-[100%] h-[100%] rounded-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-400/10 via-amber-300/5 dark:from-[#ffd061]/25 dark:via-[#ffd061]/5 to-transparent blur-[120px] pointer-events-none" />
                <div className="absolute -bottom-[30%] -left-[20%] w-[100%] h-[100%] rounded-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-400/10 via-amber-300/5 dark:from-amber-600/20 dark:via-[#ffd061]/5 to-transparent blur-[120px] pointer-events-none" />
                
                {/* Depth and Vignette Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-black/5 dark:from-black/60 dark:via-black/0 dark:to-black/30 pointer-events-none" />
                
                {/* Delicate Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000006_1px,transparent_1px),linear-gradient(to_bottom,#00000006_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

                <div className="relative z-10 flex flex-col h-full justify-between p-12 text-zinc-900 dark:text-zinc-100">
                    <div className="space-y-6 max-w-lg">
                        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white leading-tight">
                            Streamline your workflows seamlessly.
                        </h1>
                        <p className="text-lg text-zinc-600 dark:text-zinc-400">
                            The centralized platform for Edward Business College. Manage applications, coordinate tasks, and track real-time progress.
                        </p>
                    </div>

                    <div className="flex-1 flex items-center justify-center mt-12 mb-8 drop-shadow-xl dark:drop-shadow-2xl">
                        <div className="relative w-full max-w-[450px] aspect-square">
                            <Image
                                src="/Accept tasks-pana.svg"
                                alt="Task management illustration"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-zinc-500">
                        <p>&copy; {new Date().getFullYear()} Edward Business College.</p>
                        <div className="flex gap-4">
                            <a href="#" className="hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">Privacy Policy</a>
                            <a href="#" className="hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">Terms of Service</a>
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

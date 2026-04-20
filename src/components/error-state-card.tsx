'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { DisplayError } from '@/lib/error-display';
import { isMaskedServerComponentError } from '@/lib/error-display';

type RetryAction = {
    label: string;
    mode: 'reload' | 'reset';
    onReset?: () => void;
};

type NavAction = {
    label: string;
    href: string;
};

interface ErrorStateCardProps {
    title: string;
    description: string;
    error: DisplayError;
    retryAction?: RetryAction;
    navAction?: NavAction;
    forceShowDetails?: boolean;
    minHeightClassName?: string;
    componentStack?: string | null;
    debugContext?: Record<string, unknown>;
}

interface ErrorDebugAccess {
    allowed: boolean;
    loaded: boolean;
}

function DebugBlock({ label, value }: { label: string; value: string }) {
    return (
        <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <pre className="overflow-x-auto rounded-md bg-background p-3 text-xs leading-5 text-foreground whitespace-pre-wrap break-words">
                {value}
            </pre>
        </div>
    );
}

export function ErrorStateCard({
    title,
    description,
    error,
    retryAction,
    navAction,
    forceShowDetails = false,
    minHeightClassName = 'min-h-screen',
    componentStack = null,
    debugContext,
}: ErrorStateCardProps) {
    const pathname = usePathname();
    const [debugAccess, setDebugAccess] = useState<ErrorDebugAccess>({
        allowed: process.env.NODE_ENV !== 'production',
        loaded: process.env.NODE_ENV !== 'production',
    });
    const [capturedAt] = useState(() => new Date().toISOString());

    useEffect(() => {
        if (process.env.NODE_ENV !== 'production' || forceShowDetails) {
            return;
        }

        let active = true;

        fetch('/api/debug/error-mode', {
            cache: 'no-store',
            credentials: 'same-origin',
        })
            .then(async (response) => {
                if (!response.ok) {
                    return { allowed: false };
                }

                return await response.json() as { allowed?: boolean };
            })
            .then((payload) => {
                if (!active) {
                    return;
                }

                setDebugAccess({
                    allowed: Boolean(payload.allowed),
                    loaded: true,
                });
            })
            .catch(() => {
                if (!active) {
                    return;
                }

                setDebugAccess({
                    allowed: false,
                    loaded: true,
                });
            });

        return () => {
            active = false;
        };
    }, [forceShowDetails]);

    const showDetails = forceShowDetails || process.env.NODE_ENV !== 'production' || debugAccess.allowed;
    const isMaskedServerError = isMaskedServerComponentError(error.message);
    const visibleMessage = showDetails
        ? (error.message || description)
        : description;

    const serializedContext = useMemo(() => {
        if (!debugContext) {
            return null;
        }

        try {
            return JSON.stringify(debugContext, null, 2);
        } catch {
            return null;
        }
    }, [debugContext]);

    const handleRetry = () => {
        if (retryAction?.mode === 'reset' && retryAction.onReset) {
            retryAction.onReset();
            return;
        }

        window.location.reload();
    };

    const handleNavigate = () => {
        if (!navAction) {
            return;
        }

        window.location.href = navAction.href;
    };

    return (
        <div className={`flex items-center justify-center ${minHeightClassName} p-4`}>
            <Card className="w-full max-w-3xl">
                <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-destructive" />
                                <CardTitle>{title}</CardTitle>
                            </div>
                            <CardDescription>{visibleMessage}</CardDescription>
                        </div>
                        {error.digest ? <Badge variant="outline">Ref {error.digest}</Badge> : null}
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {isMaskedServerError ? (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Masked production server error</AlertTitle>
                            <AlertDescription>
                                {showDetails
                                    ? 'Next.js masked the original server-side message for this error. Use the digest shown here to match the real stack trace in server logs.'
                                    : 'The production app hid the original server-side message. Capture the reference ID and check server logs for the matching digest.'}
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {showDetails ? (
                        <div className="space-y-4 rounded-lg border bg-muted/40 p-4 text-left">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold">Detailed error output</p>
                                {!debugAccess.loaded && !forceShowDetails && process.env.NODE_ENV === 'production'
                                    ? <span className="text-xs text-muted-foreground">Checking access...</span>
                                    : null}
                            </div>

                            {pathname ? <DebugBlock label="Path" value={pathname} /> : null}
                            {error.name ? <DebugBlock label="Name" value={error.name} /> : null}
                            {error.message ? <DebugBlock label="Message" value={error.message} /> : null}
                            {error.digest ? <DebugBlock label="Digest" value={error.digest} /> : null}
                            {error.code ? <DebugBlock label="Code" value={error.code} /> : null}
                            {error.cause ? <DebugBlock label="Cause" value={error.cause} /> : null}
                            {error.stack ? <DebugBlock label="Stack" value={error.stack} /> : null}
                            {componentStack ? <DebugBlock label="Component Stack" value={componentStack} /> : null}
                            {serializedContext ? <DebugBlock label="Context" value={serializedContext} /> : null}
                            <DebugBlock label="Captured At" value={capturedAt} />
                        </div>
                    ) : null}

                    <div className="flex flex-wrap gap-3">
                        {retryAction ? (
                            <Button onClick={handleRetry}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                {retryAction.label}
                            </Button>
                        ) : null}

                        {navAction ? (
                            <Button onClick={handleNavigate} variant="outline">
                                {navAction.label}
                            </Button>
                        ) : null}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

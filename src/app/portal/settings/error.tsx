'use client';

import { useEffect } from 'react';
import { ErrorStateCard } from '@/components/error-state-card';
import { toDisplayError } from '@/lib/error-display';

export default function SettingsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Settings error:', error);
    }, [error]);

    return (
        <ErrorStateCard
            title="Settings Error"
            description="An error occurred while loading settings. This may be due to a permissions issue or a server-side failure."
            error={toDisplayError(error)}
            retryAction={{ label: 'Try again', mode: 'reset', onReset: reset }}
            navAction={{ label: 'Go to Settings', href: '/portal/settings' }}
            minHeightClassName="min-h-[400px]"
            debugContext={{ boundary: 'src/app/portal/settings/error.tsx' }}
        />
    );
}

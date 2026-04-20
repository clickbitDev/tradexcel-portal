'use client';

import { useEffect } from 'react';
import { ErrorStateCard } from '@/components/error-state-card';
import { toDisplayError } from '@/lib/error-display';

export default function RTOsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('RTOs error:', error);
    }, [error]);

    return (
        <ErrorStateCard
            title="RTOs Error"
            description="An error occurred while loading portal RTO settings. Try the request again or open the Portal RTO settings page."
            error={toDisplayError(error)}
            retryAction={{ label: 'Try again', mode: 'reset', onReset: reset }}
            navAction={{ label: 'Go to Portal RTO', href: '/portal/settings/rto' }}
            minHeightClassName="min-h-[400px]"
            debugContext={{ boundary: 'src/app/portal/rtos/error.tsx' }}
        />
    );
}

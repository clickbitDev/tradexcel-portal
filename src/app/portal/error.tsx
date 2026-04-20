'use client';

import { useEffect } from 'react';
import { ErrorStateCard } from '@/components/error-state-card';
import { toDisplayError } from '@/lib/error-display';

export default function PortalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Portal error:', error);
    }, [error]);

    return (
        <ErrorStateCard
            title="Something went wrong"
            description="An unexpected error occurred in the portal. Try the request again or return to the portal home page."
            error={toDisplayError(error)}
            retryAction={{ label: 'Try again', mode: 'reset', onReset: reset }}
            navAction={{ label: 'Go to Portal Home', href: '/portal' }}
            debugContext={{ boundary: 'src/app/portal/error.tsx' }}
        />
    );
}

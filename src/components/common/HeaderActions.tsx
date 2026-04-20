'use client';

import React, { useState, useEffect } from 'react';
import { NotificationBell } from '@/components/notifications/NotificationBell';

/**
 * HeaderActions is a client-only wrapper for header action components
 * that use Radix UI dropdowns. This prevents hydration mismatches caused
 * by Radix's internal ID generation differing between server and client.
 */
export function HeaderActions() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="flex items-center gap-1 md:gap-2">
                <div className="h-9 w-9 bg-muted rounded-md animate-pulse" />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1 md:gap-2">
            <NotificationBell />
        </div>
    );
}

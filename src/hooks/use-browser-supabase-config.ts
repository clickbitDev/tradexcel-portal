'use client';

import { useSyncExternalStore } from 'react';
import { getPublicEnvValue } from '@/lib/public-env';
import { SUPABASE_CONFIGURATION_USER_MESSAGE } from '@/lib/supabase/config-error';

interface BrowserSupabaseConfigState {
    checked: boolean;
    isConfigured: boolean;
    missingVars: string[];
    message: string | null;
}

const SERVER_SUPABASE_CONFIG_SNAPSHOT: BrowserSupabaseConfigState = {
    checked: false,
    isConfigured: true,
    missingVars: [],
    message: null,
};

let browserSupabaseConfigSnapshot: BrowserSupabaseConfigState | null = null;

function readBrowserSupabaseConfig(): BrowserSupabaseConfigState {
    const missingVars = [
        !getPublicEnvValue('NEXT_PUBLIC_SUPABASE_URL') ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
        !getPublicEnvValue('NEXT_PUBLIC_SUPABASE_ANON_KEY') ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : null,
    ].filter((value): value is string => Boolean(value));

    return {
        checked: true,
        isConfigured: missingVars.length === 0,
        missingVars,
        message: missingVars.length > 0 ? SUPABASE_CONFIGURATION_USER_MESSAGE : null,
    };
}

function getBrowserSupabaseConfigSnapshot(): BrowserSupabaseConfigState {
    if (!browserSupabaseConfigSnapshot) {
        browserSupabaseConfigSnapshot = readBrowserSupabaseConfig();
    }

    return browserSupabaseConfigSnapshot;
}

function getServerSupabaseConfigSnapshot(): BrowserSupabaseConfigState {
    return SERVER_SUPABASE_CONFIG_SNAPSHOT;
}

function subscribeToBrowserSupabaseConfig(): () => void {
    return () => {
        return;
    };
}

export function useBrowserSupabaseConfig(): BrowserSupabaseConfigState {
    return useSyncExternalStore(
        subscribeToBrowserSupabaseConfig,
        getBrowserSupabaseConfigSnapshot,
        getServerSupabaseConfigSnapshot,
    );
}

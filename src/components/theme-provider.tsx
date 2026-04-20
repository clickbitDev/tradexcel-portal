'use client';

import * as React from 'react';
import { BRAND_THEME_STORAGE_KEY } from '@/lib/brand';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
};

type ThemeProviderState = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
};

const LEGACY_THEME_STORAGE_KEYS = ['lumiere-theme'];

const ThemeProviderContext = React.createContext<ThemeProviderState | undefined>(
    undefined
);

export function ThemeProvider({
    children,
    defaultTheme = 'system',
    storageKey = BRAND_THEME_STORAGE_KEY,
    ...props
}: ThemeProviderProps) {
    const [theme, setTheme] = React.useState<Theme>(() => {
        if (typeof window === 'undefined') {
            return defaultTheme;
        }

        const storedTheme = localStorage.getItem(storageKey) as Theme | null;
        if (storedTheme) {
            return storedTheme;
        }

        for (const legacyKey of LEGACY_THEME_STORAGE_KEYS) {
            const legacyTheme = localStorage.getItem(legacyKey) as Theme | null;
            if (legacyTheme) {
                return legacyTheme;
            }
        }

        return defaultTheme;
    });

    React.useEffect(() => {
        const root = window.document.documentElement;

        root.classList.remove('light', 'dark');

        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
                .matches
                ? 'dark'
                : 'light';

            root.classList.add(systemTheme);
            return;
        }

        root.classList.add(theme);
    }, [theme]);

    const value = {
        theme,
        setTheme: (theme: Theme) => {
            localStorage.setItem(storageKey, theme);
            LEGACY_THEME_STORAGE_KEYS.forEach((legacyKey) => {
                if (legacyKey !== storageKey) {
                    localStorage.removeItem(legacyKey);
                }
            });
            setTheme(theme);
        },
    };

    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

export const useTheme = () => {
    const context = React.useContext(ThemeProviderContext);

    if (context === undefined)
        throw new Error('useTheme must be used within a ThemeProvider');

    return context;
};

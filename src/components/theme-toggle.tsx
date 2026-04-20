'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/components/theme-provider';

interface ThemeToggleProps {
    collapsed?: boolean;
    className?: string;
}

export function ThemeToggle({ collapsed = false, className }: ThemeToggleProps) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    // Only render theme icon after mounting to avoid hydration mismatch
    React.useEffect(() => {
        setMounted(true);
    }, []);

    const getCurrentIcon = () => {
        // During SSR and initial hydration, show a consistent icon
        if (!mounted) {
            return <Monitor className="h-5 w-5" />;
        }
        switch (theme) {
            case 'dark':
                return <Moon className="h-5 w-5" />;
            case 'light':
                return <Sun className="h-5 w-5" />;
            default:
                return <Monitor className="h-5 w-5" />;
        }
    };

    const getLabel = () => {
        if (!mounted) {
            return 'System';
        }
        switch (theme) {
            case 'dark':
                return 'Dark';
            case 'light':
                return 'Light';
            default:
                return 'System';
        }
    };

    // Don't render the dropdown until mounted to avoid hydration mismatch with Radix IDs
    if (!mounted) {
        return (
            <Button
                variant="ghost"
                className={className || "flex items-center gap-3 px-3 py-2 rounded-lg w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent transition-colors h-auto"}
            >
                <Monitor className="h-5 w-5" />
                {!collapsed && <span className="text-sm font-medium">System</span>}
                <span className="sr-only">Toggle theme</span>
            </Button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={
                <Button
                    variant="ghost"
                    className={className || "flex items-center gap-3 px-3 py-2 rounded-lg w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent transition-colors h-auto"}
                />
            }>
                    {getCurrentIcon()}
                    {!collapsed && <span className="text-sm font-medium">{getLabel()}</span>}
                    <span className="sr-only">Toggle theme</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-36">
                <DropdownMenuItem onClick={() => setTheme('light')}>
                    <Sun className="mr-2 h-4 w-4" />
                    Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                    <Moon className="mr-2 h-4 w-4" />
                    Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                    <Monitor className="mr-2 h-4 w-4" />
                    System
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

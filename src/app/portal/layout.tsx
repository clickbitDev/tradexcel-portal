'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CommandPalette, SearchTrigger } from '@/components/search/CommandPalette';
import { HeaderActions } from '@/components/common';
import { AppSidebar } from '@/components/portal/app-sidebar';
import { PortalBreadcrumb } from '@/components/portal/portal-breadcrumb';
import { Separator } from '@/components/ui/separator';
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from '@/components/ui/sidebar';

export default function PortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [searchOpen, setSearchOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Lazy initialize Supabase client only after mount to avoid build-time errors
    const supabase = useMemo(() => {
        if (!mounted) return null;
        try {
            return createClient();
        } catch {
            return null;
        }
    }, [mounted]);

    // Suppress unused variable warning - supabase is available for future use
    void supabase;

    useEffect(() => {
        setMounted(true);
    }, []);

    // Show loading skeleton during SSR/hydration to prevent layout mismatch
    if (!mounted) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="overflow-x-hidden">
                <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                    <SidebarTrigger className="-ml-1" />
                    <Separator
                        orientation="vertical"
                        className="mr-2 data-[orientation=vertical]:h-4"
                    />
                    <PortalBreadcrumb />
                    <div className="ml-auto flex items-center gap-2">
                        <div className="max-w-md hidden lg:block">
                            <SearchTrigger onClick={() => setSearchOpen(true)} />
                        </div>
                        <HeaderActions />
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                    {children}
                </div>
            </SidebarInset>

            {/* Command Palette */}
            <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
        </SidebarProvider>
    );
}

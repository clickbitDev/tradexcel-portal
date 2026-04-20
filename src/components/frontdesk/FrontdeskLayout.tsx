'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    FileText,
    LogOut,
    ChevronLeft,
    Menu,
    Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { UserProfileDropdown } from '@/components/common';
import { BrandImage } from '@/components/branding/BrandImage';
import { BRAND_PORTAL_SIDEBAR_LOGO_SRC, BRAND_PORTAL_SIDEBAR_LOGO_DARK_SRC } from '@/lib/brand';

interface FrontdeskLayoutProps {
    children: React.ReactNode;
    frontdeskName?: string;
}

const navItems = [
    { name: 'Dashboard', href: '/frontdesk', icon: LayoutDashboard },
    { name: 'Applications', href: '/frontdesk/applications', icon: FileText },
];

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export default function FrontdeskLayout({ children }: FrontdeskLayoutProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const checkBreakpoints = () => {
            const width = window.innerWidth;
            setIsMobile(width < MOBILE_BREAKPOINT);

            if (width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT) {
                setCollapsed(true);
            }
        };

        checkBreakpoints();
        window.addEventListener('resize', checkBreakpoints);
        return () => window.removeEventListener('resize', checkBreakpoints);
    }, []);

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const renderNavContent = (inSheet = false) => (
        <>
            <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href
                        || (item.href !== '/frontdesk' && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                                isActive
                                    ? 'bg-cyan-600 text-white'
                                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                            )}
                        >
                            <item.icon className="h-5 w-5 flex-shrink-0" />
                            {(inSheet || !collapsed) && <span className="text-sm font-medium">{item.name}</span>}
                        </Link>
                    );
                })}
            </nav>

            <div className="py-4 px-2 border-t border-sidebar-border">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg w-full text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                >
                    <LogOut className="h-5 w-5 flex-shrink-0" />
                    {(inSheet || !collapsed) && <span className="text-sm font-medium">Logout</span>}
                </button>
            </div>
        </>
    );

    const renderLogoSection = (showFull = true) => (
        <BrandImage
            src={BRAND_PORTAL_SIDEBAR_LOGO_SRC}
            darkSrc={BRAND_PORTAL_SIDEBAR_LOGO_DARK_SRC}
            width={128}
            height={96}
            priority
            className={showFull ? 'max-w-[88px]' : 'max-w-[48px]'}
            imageClassName={showFull ? 'w-full h-auto max-h-10' : 'w-full h-auto'}
        />
    );

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-background overflow-hidden">
            {isMobile && (
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <SheetContent side="left" className="w-64 p-0 bg-sidebar">
                        <SheetHeader className="h-16 flex flex-row items-center justify-between px-4 border-b border-sidebar-border">
                            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                            {renderLogoSection()}
                        </SheetHeader>
                        <div className="flex flex-col h-[calc(100%-4rem)]">
                            {renderNavContent(true)}
                        </div>
                    </SheetContent>
                </Sheet>
            )}

            {!isMobile && (
                <aside
                    className={cn(
                        'bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300',
                        collapsed ? 'w-16' : 'w-64'
                    )}
                >
                    <div className="h-16 flex items-center justify-between gap-2 px-4 border-b border-sidebar-border">
                        {!collapsed ? <div className="min-w-0 flex-1">{renderLogoSection(true)}</div> : null}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCollapsed(!collapsed)}
                            className="text-sidebar-foreground hover:bg-sidebar-accent"
                        >
                            {collapsed ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                        </Button>
                    </div>

                    {renderNavContent()}
                </aside>
            )}

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 gap-2 md:gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        {isMobile && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setMobileMenuOpen(true)}
                            >
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Open menu</span>
                            </Button>
                        )}

                        {isMobile && (
                            <span className="text-sm font-semibold text-foreground truncate">Frontdesk Portal</span>
                        )}
                    </div>

                    <div className="flex items-center gap-1 md:gap-2">
                        <Link href="/frontdesk/applications/new">
                            <Button
                                size="sm"
                                className="h-9 gap-1.5 bg-cyan-600 hover:bg-cyan-700"
                            >
                                <Plus className="h-4 w-4" />
                                <span className="hidden sm:inline">Add Application</span>
                            </Button>
                        </Link>

                        <UserProfileDropdown
                            settingsHref="/frontdesk"
                            showProfileItem={false}
                        />
                    </div>
                </header>

                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto relative">
                    {children}
                </div>
            </div>
        </div>
    );
}

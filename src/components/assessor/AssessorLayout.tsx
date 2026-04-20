'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    FileText,
    GraduationCap,
    LogOut,
    ChevronLeft,
    Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BrandImage } from '@/components/branding/BrandImage';
import { BRAND_PORTAL_SIDEBAR_LOGO_SRC, BRAND_PORTAL_SIDEBAR_LOGO_DARK_SRC } from '@/lib/brand';

interface AssessorLayoutProps {
    children: React.ReactNode;
    assessorName?: string;
}

const navItems = [
    { name: 'Dashboard', href: '/assessor', icon: LayoutDashboard },
    { name: 'Assigned Applications', href: '/assessor/applications', icon: FileText },
    { name: 'Qualifications', href: '/assessor/qualifications', icon: GraduationCap },
];

// Breakpoints
const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export default function AssessorLayout({ children }: AssessorLayoutProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    // Handle responsive breakpoints
    useEffect(() => {
        const checkBreakpoints = () => {
            const width = window.innerWidth;
            setIsMobile(width < MOBILE_BREAKPOINT);
            // Auto-collapse sidebar on tablet
            if (width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT) {
                setCollapsed(true);
            }
        };

        checkBreakpoints();
        window.addEventListener('resize', checkBreakpoints);
        return () => window.removeEventListener('resize', checkBreakpoints);
    }, []);

    // Close mobile menu when navigating
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const NavContent = ({ inSheet = false }: { inSheet?: boolean }) => (
        <>
            {/* Navigation */}
            <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== '/assessor' && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                                isActive
                                    ? "bg-cyan-600 text-white"
                                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                            )}
                        >
                            <item.icon className="h-5 w-5 flex-shrink-0" />
                            {(inSheet || !collapsed) && <span className="text-sm font-medium">{item.name}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom */}
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

    const LogoSection = ({ showFull = true }: { showFull?: boolean }) => (
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
            {/* Mobile Sidebar Sheet */}
            {isMobile && (
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <SheetContent side="left" className="w-64 p-0 bg-sidebar">
                        <SheetHeader className="h-16 flex flex-row items-center justify-between px-4 border-b border-sidebar-border">
                            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                            <LogoSection />
                        </SheetHeader>
                        <div className="flex flex-col h-[calc(100%-4rem)]">
                            <NavContent inSheet />
                        </div>
                    </SheetContent>
                </Sheet>
            )}

            {/* Desktop/Tablet Sidebar */}
            {!isMobile && (
                <aside
                    className={cn(
                        "bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
                        collapsed ? "w-16" : "w-64"
                    )}
                >
                    {/* Logo */}
                    <div className="h-16 flex items-center justify-between gap-2 px-4 border-b border-sidebar-border">
                        {!collapsed ? <div className="min-w-0 flex-1"><LogoSection showFull /></div> : null}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCollapsed(!collapsed)}
                            className="text-sidebar-foreground hover:bg-sidebar-accent"
                        >
                            {collapsed ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                        </Button>
                    </div>

                    <NavContent />
                </aside>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile Header */}
                {isMobile && (
                    <header className="h-14 border-b bg-background/95 backdrop-blur flex items-center px-4 gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMobileMenuOpen(true)}
                        >
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Open menu</span>
                        </Button>
                        <div className="flex items-center gap-3 min-w-0">
                            <LogoSection showFull={false} />
                            <span className="text-sm font-semibold text-foreground truncate">Assessor Portal</span>
                        </div>
                    </header>
                )}
                {children}
            </div>
        </div>
    );
}

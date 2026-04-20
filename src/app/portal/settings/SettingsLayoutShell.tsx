'use client';

import { useState, type ElementType, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Bell,
    Database,
    DollarSign,
    Building2,
    FileCheck,
    FileText,
    Key,
    Link2,
    Mail,
    Menu,
    Receipt,
    Send,
    Trash2,
    Users,
    Users2,
    BarChart3,
    Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const settingsNav: { name: string; href: string; icon: ElementType }[] = [
    { name: 'Portal RTO', href: '/portal/settings/rto', icon: Building2 },
    { name: 'Staff', href: '/portal/settings/staff', icon: Users },
    { name: 'Agents', href: '/portal/settings/agents', icon: Users },
    { name: 'Partners', href: '/portal/partners', icon: Building2 },
    { name: 'Staff Activity', href: '/portal/settings/staff-activity', icon: BarChart3 },
    { name: 'Pricing', href: '/portal/settings/pricing', icon: DollarSign },
    { name: 'Invoicing', href: '/portal/settings/invoicing', icon: FileText },
    { name: 'Billing', href: '/portal/settings/billing', icon: Receipt },
    { name: 'Xero', href: '/portal/settings/xero', icon: Link2 },
    { name: 'Email Templates', href: '/portal/settings/templates', icon: Mail },
    { name: 'Communications', href: '/portal/settings/communications', icon: Send },
    { name: 'Reminders', href: '/portal/settings/reminders', icon: Clock },
    { name: 'Students', href: '/portal/settings/students', icon: Users2 },
    { name: 'Notifications', href: '/portal/settings/notifications', icon: Bell },
    { name: 'Audit Logs', href: '/portal/settings/audit', icon: Database },
    { name: 'Compliance', href: '/portal/settings/compliance', icon: FileCheck },
    { name: 'Trash', href: '/portal/settings/trash', icon: Trash2 },
    { name: 'Integrations', href: '/portal/settings/api', icon: Key },
];

function normalizePathname(pathname: string) {
    return pathname.replace(/\/$/, '') || '/portal';
}

function SettingsNavigation({
    pathname,
    onNavigate,
}: {
    pathname: string;
    onNavigate?: () => void;
}) {
    return (
        <nav className="space-y-1 overflow-y-auto p-4">
            {settingsNav.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                            isActive
                                ? 'bg-primary/10 font-medium text-primary'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                    >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        {item.name}
                    </Link>
                );
            })}
        </nav>
    );
}

export default function SettingsLayoutShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const normalizedPathname = normalizePathname(pathname);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const currentPage = settingsNav.find((item) => {
        return normalizedPathname === item.href || normalizedPathname.startsWith(`${item.href}/`);
    });

    return (
        <div className="flex h-full flex-col md:flex-row">
            <div className="flex items-center justify-between border-b border-border bg-card p-4 md:hidden">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Settings</h2>
                    {currentPage && <span className="text-muted-foreground">/ {currentPage.name}</span>}
                </div>
                <Sheet key={pathname} open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <SheetTrigger render={
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Open settings menu</span>
                        </Button>
                    } />
                    <SheetContent side="left" className="w-72 p-0">
                        <div className="border-b border-border p-6">
                            <h2 className="text-lg font-semibold">Settings</h2>
                            <p className="text-sm text-muted-foreground">Manage your portal</p>
                        </div>
                        <SettingsNavigation
                            pathname={normalizedPathname}
                            onNavigate={() => setMobileMenuOpen(false)}
                        />
                    </SheetContent>
                </Sheet>
            </div>

            <aside className="hidden w-64 flex-shrink-0 overflow-y-auto border-r border-border bg-card md:block">
                <div className="border-b border-border p-6">
                    <h2 className="text-lg font-semibold">Settings</h2>
                    <p className="text-sm text-muted-foreground">Manage your portal</p>
                </div>
                <SettingsNavigation pathname={normalizedPathname} />
            </aside>

            <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
    );
}

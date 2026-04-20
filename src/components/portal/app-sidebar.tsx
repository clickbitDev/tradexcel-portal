'use client';

import * as React from 'react';
import {
    LayoutDashboard,
    GraduationCap,
    FileText,
    BarChart3,
    Settings,
    ShieldCheck,
} from 'lucide-react';
import Image from 'next/image';

import { NavMainPortal, type NavItem } from '@/components/portal/nav-main-portal';
import { NavUserPortal } from '@/components/portal/nav-user-portal';
import { ThemeToggle } from '@/components/theme-toggle';
import { usePermissions, ActionPermission } from '@/hooks/usePermissions';
import { usePathname } from 'next/navigation';
import {
    getPortalRouteBase,
} from '@/lib/routes/portal';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarGroup,
    SidebarGroupContent,
    SidebarRail,
    useSidebar,
} from '@/components/ui/sidebar';

interface NavItemDefinition extends NavItem {
    permission?: ActionPermission;
}

const defaultNavItems: NavItemDefinition[] = [
    { name: 'Dashboard', path: '', icon: LayoutDashboard },
    { name: 'Qualifications', path: 'qualifications', icon: GraduationCap, permission: 'qualifications.view' },
    { name: 'Applications', path: 'applications', icon: FileText, permission: 'applications.view' },
    { name: 'Certificates', path: 'certificates', icon: ShieldCheck, permission: 'certificates.view' },
    { name: 'Reports', path: 'reports', icon: BarChart3 },
];

const executiveManagerNavItems: NavItemDefinition[] = [
    { name: 'Dashboard', path: '', icon: LayoutDashboard },
    { name: 'Applications', path: 'applications', icon: FileText, permission: 'applications.view' },
    { name: 'Certificates', path: 'certificates', icon: ShieldCheck, permission: 'certificates.view' },
    { name: 'Qualifications', path: 'qualifications', icon: GraduationCap, permission: 'qualifications.view' },
    { name: 'Reports', path: 'reports', icon: BarChart3 },
];

const adminNavItems: NavItemDefinition[] = [
    { name: 'Dashboard', path: '', icon: LayoutDashboard },
    { name: 'Applications', path: 'applications', icon: FileText, permission: 'applications.view' },
    { name: 'Certificates', path: 'certificates', icon: ShieldCheck, permission: 'certificates.view' },
];

const accountsManagerNavItems: NavItemDefinition[] = [
    { name: 'Dashboard', path: '', icon: LayoutDashboard },
    { name: 'Applications', path: 'applications', icon: FileText, permission: 'applications.view' },
];

const dispatchCoordinatorNavItems: NavItemDefinition[] = [
    { name: 'Dashboard', path: '', icon: LayoutDashboard },
    { name: 'Applications', path: 'applications', icon: FileText, permission: 'applications.view' },
    { name: 'Certificates', path: 'certificates', icon: ShieldCheck, permission: 'certificates.view' },
];

const assessorNavItems: NavItemDefinition[] = [
    { name: 'Dashboard', path: '', icon: LayoutDashboard },
    { name: 'Applications', path: 'applications', icon: FileText, permission: 'applications.view' },
];

const ROLE_LABELS: Record<string, string> = {
    ceo: 'CEO',
    executive_manager: 'Executive Manager',
    admin: 'Admin',
    accounts_manager: 'Accounts Manager',
    assessor: 'Assessor',
    dispatch_coordinator: 'Dispatch Coordinator',
    frontdesk: 'Frontdesk',
    developer: 'Developer',
    agent: 'Agent',
    staff: 'Staff',
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { can, loading: permissionsLoading, role } = usePermissions();
    const { state } = useSidebar();
    const pathname = usePathname();
    const routeBase = getPortalRouteBase(pathname, role);
    const isCollapsed = state === 'collapsed';

    const navItemsForRole = role === 'executive_manager'
        ? executiveManagerNavItems
        : role === 'admin'
            ? adminNavItems
            : role === 'accounts_manager'
                ? accountsManagerNavItems
                : role === 'dispatch_coordinator'
                    ? dispatchCoordinatorNavItems
                    : role === 'assessor'
                        ? assessorNavItems
                        : defaultNavItems;

    // Filter nav items based on permissions
    const visibleNavItems = navItemsForRole.filter((item) => {
        if (!item.permission) return true;
        if (permissionsLoading) return true;
        return can(item.permission);
    });

    const showSettings = role === 'ceo' || role === 'developer';
    const showThemeToggle = role !== 'admin'
        && role !== 'accounts_manager'
        && role !== 'dispatch_coordinator'
        && role !== 'assessor';

    const settingsHref = '/portal/settings';
    const normalizedPathname = pathname.replace(/\/$/, '') || '/portal';
    const settingsActive = normalizedPathname.startsWith('/portal/settings');

    return (
        <Sidebar collapsible="icon" variant="inset" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-white/10">
                                <Image
                                    src="/edward_portal_logo_symbol.png"
                                    alt="Edward Business College"
                                    width={32}
                                    height={32}
                                    className="size-8"
                                />
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-bold text-base">
                                    {role ? (ROLE_LABELS[role] || role.replace(/_/g, ' ')) : 'Loading...'}
                                </span>
                                <span className="truncate text-xs">Edward Business College</span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMainPortal
                    items={visibleNavItems}
                    routeBase={routeBase}
                />

                {/* Bottom nav items (Settings, ThemeToggle) */}
                {(showSettings || showThemeToggle) && (
                    <SidebarGroup className="mt-auto">
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {showSettings && (
                                    <SidebarMenuItem>
                                        <SidebarMenuButton
                                            tooltip="Settings"
                                            isActive={settingsActive}
                                            render={<a href={settingsHref} />}
                                            className="text-base py-3 h-auto"
                                        >
                                            <Settings />
                                            <span>Settings</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )}
                                {showThemeToggle && (
                                    <SidebarMenuItem>
                                        <ThemeToggle
                                            collapsed={isCollapsed}
                                            className={`flex items-center rounded-md w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-base ${isCollapsed
                                                ? 'justify-center px-0 py-2 h-8'
                                                : 'justify-start gap-2 px-2 py-3 h-auto'
                                                }`}
                                        />
                                    </SidebarMenuItem>
                                )}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>
            <SidebarFooter>
                <NavUserPortal />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}

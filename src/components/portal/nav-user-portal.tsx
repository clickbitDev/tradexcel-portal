'use client';

import { useState, useEffect } from 'react';
import {
    BadgeCheck,
    LogOut,
    ChevronsUpDown,
    Settings,
} from 'lucide-react';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { usePathname, useRouter } from 'next/navigation';
import { getPortalRouteBase, withPortalBase } from '@/lib/routes/portal';

interface UserData {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
    role?: string;
    company_name?: string;
}

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

export function NavUserPortal() {
    const [user, setUser] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const { isMobile } = useSidebar();
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createClient();

    useEffect(() => {
        const loadUser = async () => {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url, role, company_name')
                    .eq('id', authUser.id)
                    .single();

                setUser({
                    id: authUser.id,
                    email: authUser.email || '',
                    full_name: profile?.full_name || authUser.user_metadata?.full_name,
                    avatar_url: profile?.avatar_url || authUser.user_metadata?.avatar_url,
                    role: profile?.role || 'staff',
                    company_name: profile?.company_name,
                });
            }
            setLoading(false);
        };

        loadUser();
    }, [supabase]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const getInitials = (name?: string, email?: string) => {
        if (name) {
            return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        }
        if (email) {
            return email[0].toUpperCase();
        }
        return 'U';
    };

    if (loading || !user) {
        return (
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton size="lg">
                        <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
                        <div className="grid flex-1 gap-1">
                            <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                            <div className="h-2 w-28 bg-muted animate-pulse rounded" />
                        </div>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        );
    }

    const routeBase = getPortalRouteBase(pathname, user.role);
    const profileHref = withPortalBase(routeBase, 'profile');
    const showSettings = user.role === 'ceo' || user.role === 'developer';

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger render={
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        />
                    }>
                            <Avatar className="h-8 w-8 rounded-lg">
                                {user.avatar_url && (
                                    <AvatarImage src={user.avatar_url} alt={user.full_name || user.email} />
                                )}
                                <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xs">
                                    {getInitials(user.full_name, user.email)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">{user.full_name || 'User'}</span>
                                <span className="truncate text-xs">{user.email}</span>
                            </div>
                            <ChevronsUpDown className="ml-auto size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="min-w-56 rounded-lg"
                        side={isMobile ? 'bottom' : 'right'}
                        align="end"
                        sideOffset={4}
                    >
                        <DropdownMenuGroup>
                            <DropdownMenuLabel className="p-0 font-normal">
                                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                    <Avatar className="h-8 w-8 rounded-lg">
                                        {user.avatar_url && (
                                            <AvatarImage src={user.avatar_url} alt={user.full_name || user.email} />
                                        )}
                                        <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xs">
                                            {getInitials(user.full_name, user.email)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-medium">{user.full_name || 'User'}</span>
                                        <span className="truncate text-xs">{user.email}</span>
                                        {user.role && (
                                            <span className="truncate text-xs text-muted-foreground">
                                                {ROLE_LABELS[user.role] || user.role.replace(/_/g, ' ')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </DropdownMenuLabel>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem render={<Link href={profileHref} />}>
                                <BadgeCheck />
                                Profile
                            </DropdownMenuItem>
                            {showSettings && (
                                <DropdownMenuItem render={<Link href="/portal/settings" />}>
                                    <Settings />
                                    Settings
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout}>
                            <LogOut />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

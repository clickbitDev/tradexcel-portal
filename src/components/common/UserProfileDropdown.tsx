'use client';

import React, { useState, useEffect } from 'react';
import { User, Settings, LogOut, ChevronDown, Building2, KeyRound } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuItem,
    DropdownMenuGroup,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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

// Role display labels
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

interface UserProfileDropdownProps {
    profileHref?: string;
    settingsHref?: string;
    credentialsHref?: string;
    showProfileItem?: boolean;
}

export function UserProfileDropdown({
    profileHref,
    settingsHref,
    credentialsHref,
    showProfileItem = true,
}: UserProfileDropdownProps = {}) {
    const [user, setUser] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createClient();

    useEffect(() => {
        const loadUser = async () => {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                // Try to get additional user data from profiles table
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

    if (loading) {
        return (
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        );
    }

    if (!user) {
        return null;
    }

    const routeBase = getPortalRouteBase(pathname, user.role);
    const resolvedProfileHref = profileHref || withPortalBase(routeBase, 'profile');
    const resolvedSettingsHref = settingsHref || withPortalBase(routeBase, 'settings');

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={
                <Button variant="ghost" className="flex items-center gap-2 h-9 px-2" />
            }>
                    <Avatar className="h-7 w-7">
                        {user.avatar_url ? (
                            <AvatarImage src={user.avatar_url} alt={user.full_name || user.email} />
                        ) : null}
                        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {getInitials(user.full_name, user.email)}
                        </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none">
                                {user.full_name || 'User'}
                            </p>
                            <p className="text-xs text-muted-foreground leading-none">
                                {user.email}
                            </p>
                            {user.company_name && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {user.company_name}
                                </p>
                            )}
                            {user.role && (
                                <p className="text-xs text-muted-foreground">
                                    {ROLE_LABELS[user.role] || user.role.replace(/_/g, ' ')}
                                </p>
                            )}
                        </div>
                    </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />

                {showProfileItem && (
                    <DropdownMenuItem render={<Link href={resolvedProfileHref} className="cursor-pointer" />}>
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                    </DropdownMenuItem>
                )}

                <DropdownMenuItem render={<Link href={resolvedSettingsHref} className="cursor-pointer" />}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                </DropdownMenuItem>

                {credentialsHref && (
                    <DropdownMenuItem render={<Link href={credentialsHref} className="cursor-pointer" />}>
                        <KeyRound className="mr-2 h-4 w-4" />
                        <span>Credentials</span>
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive cursor-pointer"
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

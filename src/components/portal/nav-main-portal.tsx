'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type LucideIcon } from 'lucide-react';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
    PORTAL_BASE,
    withPortalBase,
} from '@/lib/routes/portal';

export interface NavItem {
    name: string;
    path: string;
    icon: LucideIcon;
}

export function NavMainPortal({
    items,
    routeBase,
    label = 'Navigation',
}: {
    items: NavItem[];
    routeBase: string;
    label?: string;
}) {
    const pathname = usePathname();

    const normalizedPathname = pathname.replace(/\/$/, '') || '/portal';

    const isPathActive = (targetPortalPath: string) => {
        const normalizedTarget = targetPortalPath.replace(/\/$/, '');
        if (normalizedPathname === normalizedTarget) {
            return true;
        }
        if (normalizedTarget === PORTAL_BASE) {
            return false;
        }
        return normalizedPathname.startsWith(`${normalizedTarget}/`);
    };

    return (
        <SidebarGroup>
            {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
            <SidebarMenu>
                {items.map((item) => {
                    const href = withPortalBase(routeBase, item.path);
                    const portalPath = withPortalBase(PORTAL_BASE, item.path);
                    const isActive = isPathActive(portalPath);

                    return (
                        <SidebarMenuItem key={item.name}>
                            <SidebarMenuButton
                                tooltip={item.name}
                                isActive={isActive}
                                render={<Link href={href} />}
                                className="text-base py-3 h-auto"
                            >
                                <item.icon />
                                <span>{item.name}</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}

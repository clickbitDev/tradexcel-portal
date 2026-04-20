'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import React from 'react';

const ROUTE_LABELS: Record<string, string> = {
    portal: 'Portal',
    rtos: 'RTOs',
    qualifications: 'Qualifications',
    partners: 'Partners',
    applications: 'Applications',
    tickets: 'Tickets',
    reports: 'Reports',
    settings: 'Settings',
    profile: 'Profile',
    new: 'New',
};

export function PortalBreadcrumb() {
    const pathname = usePathname();
    const segments = pathname.split('/').filter(Boolean);

    // Remove the portal base segment and any role-base prefix
    const portalIndex = segments.indexOf('portal');
    const crumbSegments = portalIndex >= 0 ? segments.slice(portalIndex) : segments;

    // Build breadcrumb items
    const items = crumbSegments.map((segment, index) => {
        const href = '/' + crumbSegments.slice(0, index + 1).join('/');
        const label = ROUTE_LABELS[segment] || segment.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const isLast = index === crumbSegments.length - 1;

        return { href, label, isLast };
    });

    // If on /portal root, show "Portal > Dashboard"
    if (items.length === 1 && items[0].label === 'Portal') {
        return (
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink render={<Link href="/portal" />}>
                            Portal
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Dashboard</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
        );
    }

    return (
        <Breadcrumb>
            <BreadcrumbList>
                {items.map((item, index) => (
                    <React.Fragment key={item.href}>
                        {index > 0 && <BreadcrumbSeparator />}
                        <BreadcrumbItem>
                            {item.isLast ? (
                                <BreadcrumbPage>{item.label}</BreadcrumbPage>
                            ) : (
                                <BreadcrumbLink render={<Link href={item.href} />}>
                                    {item.label}
                                </BreadcrumbLink>
                            )}
                        </BreadcrumbItem>
                    </React.Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    );
}

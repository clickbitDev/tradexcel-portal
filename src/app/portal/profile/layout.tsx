'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { User, Shield, Mail, Share2 } from 'lucide-react';

const profileNav = [
    { name: 'Edit Profile', href: '/portal/profile', icon: User },
    { name: 'Account Security', href: '/portal/profile/security', icon: Shield },
    { name: 'Manage Emails', href: '/portal/profile/emails', icon: Mail },
    { name: 'Social Accounts', href: '/portal/profile/social', icon: Share2 },
];

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex h-full">
            {/* Profile Sidebar */}
            <aside className="w-64 border-r border-border bg-card">
                <div className="p-6 border-b border-border">
                    <h2 className="text-lg font-semibold">Profile</h2>
                    <p className="text-sm text-muted-foreground">Manage your account</p>
                </div>
                <nav className="p-4 space-y-1">
                    {profileNav.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                                    isActive
                                        ? 'bg-primary/10 text-primary font-medium'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>
        </div>
    );
}

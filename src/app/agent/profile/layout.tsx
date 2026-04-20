'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { User, Shield } from 'lucide-react';
import { mapAgentPathToPortal } from '@/lib/routes/portal';

const profileNav = [
    { name: 'Edit Profile', href: '/portal/agent/profile', icon: User },
    { name: 'Account Security', href: '/portal/agent/profile/security', icon: Shield },
];

export default function AgentProfileLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const normalizedPathname = pathname.startsWith('/agent')
        ? mapAgentPathToPortal(pathname)
        : pathname;

    return (
        <div className="flex h-full">
            <aside className="w-64 border-r border-border bg-card">
                <div className="p-6 border-b border-border">
                    <h2 className="text-lg font-semibold">Profile</h2>
                    <p className="text-sm text-muted-foreground">Manage your account</p>
                </div>
                <nav className="p-4 space-y-1">
                    {profileNav.map((item) => {
                        const isActive = normalizedPathname === item.href;
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

            <div className="flex-1 overflow-y-auto">
                {children}
            </div>
        </div>
    );
}

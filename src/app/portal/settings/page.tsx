import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Users,
    Shield,
    Bell,
    Mail,
    FileText,
    DollarSign,
    Settings as SettingsIcon,
    Database,
    Building2,
    Calendar,
    UserPlus,
    Trash2,
    TrendingUp,
    Globe,
} from 'lucide-react';
import Link from 'next/link';

interface SettingSection {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    href: string;
    color: string;
    badge?: string;
}

const settingsSections: SettingSection[] = [
    {
        title: 'Staff Management',
        description: 'Manage user accounts, roles, and permissions',
        icon: Users,
        href: '/portal/settings/staff',
        color: 'bg-blue-100 text-blue-700',
    },
    {
        title: 'Account Settings',
        description: 'Update your account information and preferences',
        icon: Shield,
        href: '/portal/settings/account',
        color: 'bg-purple-100 text-purple-700',
    },
    {
        title: 'Notifications',
        description: 'Configure notification preferences and alerts',
        icon: Bell,
        href: '/portal/settings/notifications',
        color: 'bg-yellow-100 text-yellow-700',
    },
    {
        title: 'Communications',
        description: 'Manage email templates and communication settings',
        icon: Mail,
        href: '/portal/settings/communications',
        color: 'bg-green-100 text-green-700',
    },
    {
        title: 'Billing & Invoicing',
        description: 'Configure billing settings and invoice templates',
        icon: DollarSign,
        href: '/portal/settings/billing',
        color: 'bg-emerald-100 text-emerald-700',
    },
    {
        title: 'Pricing Configuration',
        description: 'Set up pricing rules and product pricing',
        icon: TrendingUp,
        href: '/portal/settings/pricing',
        color: 'bg-indigo-100 text-indigo-700',
    },
    {
        title: 'API Configuration',
        description: 'Manage API keys and third-party integrations',
        icon: Database,
        href: '/portal/settings/api',
        color: 'bg-cyan-100 text-cyan-700',
    },
    {
        title: 'Sharp Future Connection',
        description: 'Connect this portal to the Sharp Future hub',
        icon: Globe,
        href: '/portal/settings/sharp-future',
        color: 'bg-teal-100 text-teal-700',
    },
    {
        title: 'Portal RTO',
        description: 'Configure the single RTO used by this portal and transferred applications',
        icon: Building2,
        href: '/portal/settings/rto',
        color: 'bg-blue-100 text-blue-700',
    },
    {
        title: 'Agent Settings',
        description: 'Configure agent-specific settings and commissions',
        icon: UserPlus,
        href: '/portal/settings/agents',
        color: 'bg-orange-100 text-orange-700',
    },
    {
        title: 'Partners',
        description: 'Manage partners, providers, and partner performance data',
        icon: Building2,
        href: '/portal/partners',
        color: 'bg-cyan-100 text-cyan-700',
    },
    {
        title: 'Student Settings',
        description: 'Manage student portal and document requirements',
        icon: Building2,
        href: '/portal/settings/students',
        color: 'bg-violet-100 text-violet-700',
    },
    {
        title: 'Compliance',
        description: 'Monitor compliance requirements and audits',
        icon: FileText,
        href: '/portal/settings/compliance',
        color: 'bg-amber-100 text-amber-700',
    },
    {
        title: 'Reminders',
        description: 'Set up automated reminder schedules',
        icon: Calendar,
        href: '/portal/settings/reminders',
        color: 'bg-lime-100 text-lime-700',
    },
    {
        title: 'Xero Integration',
        description: 'Connect and configure Xero accounting integration',
        icon: Globe,
        href: '/portal/settings/xero',
        color: 'bg-sky-100 text-sky-700',
    },
    {
        title: 'Audit Logs',
        description: 'View system activity and change history',
        icon: FileText,
        href: '/portal/settings/audit',
        color: 'bg-slate-100 text-slate-700',
    },
    {
        title: 'Trash & Recovery',
        description: 'Restore deleted items and manage trash',
        icon: Trash2,
        href: '/portal/settings/trash',
        color: 'bg-gray-100 text-gray-700',
    },
];

export default function SettingsPage() {
    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Configure your portal settings and preferences
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <SettingsIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                </div>
            </header>

            <div className="p-6">
                {/* Settings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {settingsSections.map((section) => {
                        const Icon = section.icon;
                        return (
                            <Link key={section.href} href={section.href}>
                                <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer group h-full">
                                    <div className="flex flex-col h-full">
                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${section.color}`}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                                            {section.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground flex-1">
                                            {section.description}
                                        </p>
                                        {section.badge && (
                                            <div className="mt-3">
                                                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                                    {section.badge}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            </Link>
                        );
                    })}
                </div>

                {/* Quick Links */}
                <div className="mt-8">
                    <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                    <div className="flex flex-wrap gap-3">
                        <Link href="/portal/settings/staff/new">
                            <Button variant="outline" size="sm">
                                <UserPlus className="h-4 w-4 mr-2" />
                                Add Staff Member
                            </Button>
                        </Link>
                        <Link href="/portal/settings/audit">
                            <Button variant="outline" size="sm">
                                <FileText className="h-4 w-4 mr-2" />
                                View Audit Logs
                            </Button>
                        </Link>
                        <Link href="/portal/settings/api">
                            <Button variant="outline" size="sm">
                                <Database className="h-4 w-4 mr-2" />
                                Manage API Keys
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}

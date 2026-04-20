'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Shield,
    Users,
    FileText,
    GraduationCap,
    Settings,
    Check,
    Save,
    Loader2,
    Info,
    RefreshCw,
    AlertCircle
} from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cloneDefaultRoleActionPermissions } from '@/lib/access-control/action-permissions';

type UserRole = 'ceo' | 'executive_manager' | 'admin' | 'accounts_manager' | 'assessor' | 'dispatch_coordinator' | 'frontdesk' | 'developer' | 'agent';

interface Permission {
    key: string;
    name: string;
    description: string;
    category: string;
}

interface RolePermissions {
    [key: string]: boolean;
}

const ROLES: { key: UserRole; name: string; description: string; color: string }[] = [
    { key: 'ceo', name: 'CEO', description: 'Full system access', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
    { key: 'executive_manager', name: 'Executive Manager', description: 'Team and data management', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' },
    { key: 'admin', name: 'Admin', description: 'Staff with admin features', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
    { key: 'accounts_manager', name: 'Accounts Manager', description: 'Finance operations', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
    { key: 'assessor', name: 'Assessor', description: 'Assessment workflow', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300' },
    { key: 'dispatch_coordinator', name: 'Dispatch Coordinator', description: 'Logistics', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' },
    { key: 'frontdesk', name: 'Frontdesk', description: 'Basic operations', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
    { key: 'developer', name: 'Developer', description: 'Full system access', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300' },
    { key: 'agent', name: 'Agent', description: 'Limited partner access', color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
];

const PERMISSIONS: Permission[] = [
    // Applications
    { key: 'applications.view', name: 'View Applications', description: 'View application list and details', category: 'Applications' },
    { key: 'applications.create', name: 'Create Applications', description: 'Submit new applications', category: 'Applications' },
    { key: 'applications.edit', name: 'Edit Applications', description: 'Modify application data', category: 'Applications' },
    { key: 'applications.delete', name: 'Delete Applications', description: 'Remove applications', category: 'Applications' },
    { key: 'applications.change_stage', name: 'Change Stage', description: 'Move applications through workflow', category: 'Applications' },
    { key: 'applications.assign', name: 'Assign Applications', description: 'Assign to staff members', category: 'Applications' },
    { key: 'applications.export', name: 'Export Applications', description: 'Export applications to CSV/Excel', category: 'Applications' },
    { key: 'certificates.view', name: 'View Certificates', description: 'Access certificate queue and verification records', category: 'Applications' },
    { key: 'certificates.manage', name: 'Manage Certificates', description: 'Generate, regenerate, and verify certificates', category: 'Applications' },

    // Documents
    { key: 'documents.view', name: 'View Documents', description: 'Access uploaded documents', category: 'Documents' },
    { key: 'documents.upload', name: 'Upload Documents', description: 'Add new documents', category: 'Documents' },
    { key: 'documents.verify', name: 'Verify Documents', description: 'Mark documents as verified', category: 'Documents' },
    { key: 'documents.delete', name: 'Delete Documents', description: 'Remove documents', category: 'Documents' },

    // RTOs & Qualifications
    { key: 'rtos.view', name: 'View RTOs', description: 'Access RTO list', category: 'Master Data' },
    { key: 'rtos.manage', name: 'Manage RTOs', description: 'Create, edit, delete RTOs', category: 'Master Data' },
    { key: 'qualifications.view', name: 'View Qualifications', description: 'Access qualification list', category: 'Master Data' },
    { key: 'qualifications.manage', name: 'Manage Qualifications', description: 'Create, edit, delete qualifications', category: 'Master Data' },

    // Partners
    { key: 'partners.view', name: 'View Partners', description: 'Access partner list', category: 'Partners' },
    { key: 'partners.manage', name: 'Manage Partners', description: 'Create, edit, delete partners', category: 'Partners' },
    { key: 'partners.view_kpi', name: 'View Partner KPIs', description: 'Access partner performance data', category: 'Partners' },

    // Tickets
    { key: 'tickets.view', name: 'View Tickets', description: 'Access support tickets', category: 'Tickets' },
    { key: 'tickets.create', name: 'Create Tickets', description: 'Submit new tickets', category: 'Tickets' },
    { key: 'tickets.manage', name: 'Manage Tickets', description: 'Update and close tickets', category: 'Tickets' },

    // Settings & Admin
    { key: 'staff.view', name: 'View Staff', description: 'Access staff list', category: 'Administration' },
    { key: 'staff.manage', name: 'Manage Staff', description: 'Add, edit, remove staff', category: 'Administration' },
    { key: 'roles.manage', name: 'Manage Roles', description: 'Configure role permissions', category: 'Administration' },
    { key: 'audit.view', name: 'View Audit Logs', description: 'Access system audit trail', category: 'Administration' },
    { key: 'templates.manage', name: 'Manage Templates', description: 'Configure email templates', category: 'Administration' },
    { key: 'settings.manage', name: 'System Settings', description: 'Modify system configuration', category: 'Administration' },
];

// Default permissions (fallback when database is empty)
const DEFAULT_PERMISSIONS: Record<UserRole, RolePermissions> =
    cloneDefaultRoleActionPermissions() as Record<UserRole, RolePermissions>;

const CATEGORY_ICONS: Record<string, React.ElementType> = {
    'Applications': FileText,
    'Documents': FileText,
    'Master Data': GraduationCap,
    'Partners': Users,
    'Tickets': FileText,
    'Administration': Settings,
};

export default function RolesPermissionsPage() {
    const [permissions, setPermissions] = useState<Record<UserRole, RolePermissions>>(DEFAULT_PERMISSIONS);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [hasChanges, setHasChanges] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Fetch permissions from database on mount
    useEffect(() => {
        fetchPermissions();
    }, []);

    const fetchPermissions = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/permissions');
            if (!response.ok) {
                throw new Error('Failed to fetch permissions');
            }
            const data = await response.json();

            if (data.permissions && Object.keys(data.permissions).length > 0) {
                // Merge with defaults to ensure all permissions are present
                const mergedPermissions = { ...DEFAULT_PERMISSIONS };
                for (const role of Object.keys(data.permissions)) {
                    if (mergedPermissions[role as UserRole]) {
                        mergedPermissions[role as UserRole] = {
                            ...mergedPermissions[role as UserRole],
                            ...data.permissions[role],
                        };
                    }
                }
                setPermissions(mergedPermissions);
            }
        } catch (err) {
            console.error('Error fetching permissions:', err);
            setError('Failed to load permissions from database. Using defaults.');
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = (role: UserRole, permissionKey: string) => {
        // CEO and Developer always have all permissions
        if (role === 'ceo' || role === 'developer') return;

        setPermissions(prev => ({
            ...prev,
            [role]: {
                ...prev[role],
                [permissionKey]: !prev[role][permissionKey],
            },
        }));
        setHasChanges(true);
        setSuccessMessage(null);
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await fetch('/api/admin/permissions', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ permissions }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save permissions');
            }

            setHasChanges(false);
            setSuccessMessage('Permissions saved successfully!');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            console.error('Error saving permissions:', err);
            setError(err instanceof Error ? err.message : 'Failed to save permissions');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setPermissions(DEFAULT_PERMISSIONS);
        setHasChanges(true);
        setSuccessMessage(null);
    };

    const categories = [...new Set(PERMISSIONS.map(p => p.category))];

    if (loading) {
        return (
            <main className="flex-1 overflow-y-auto">
                <header className="bg-card border-b border-border px-4 sm:px-6 py-4">
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Roles & Permissions</h1>
                    <p className="text-sm text-muted-foreground mt-1">Configure access levels for each user role</p>
                </header>
                <div className="p-4 sm:p-6 flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <p className="mt-2 text-muted-foreground">Loading permissions...</p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-4 sm:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Roles & Permissions</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Configure access levels for each user role
                        </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <Button variant="outline" size="sm" onClick={fetchPermissions} disabled={saving} className="sm:size-default">
                            <RefreshCw className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Refresh</span>
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges} className="sm:size-default">
                            {saving ? (
                                <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4 sm:mr-2" />
                            )}
                            <span className="hidden sm:inline">Save Changes</span>
                            <span className="sm:hidden">Save</span>
                        </Button>
                    </div>
                </div>
            </header>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Status Messages */}
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                {successMessage && (
                    <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                        <Check className="h-4 w-4" />
                        <AlertDescription>{successMessage}</AlertDescription>
                    </Alert>
                )}

                {/* Role Overview Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {ROLES.map((role) => {
                        const grantedCount = Object.values(permissions[role.key]).filter(Boolean).length;
                        const totalCount = PERMISSIONS.length;

                        return (
                            <Card key={role.key}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <Badge className={role.color}>{role.name}</Badge>
                                        <Shield className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground mb-2">{role.description}</p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all"
                                                style={{ width: `${(grantedCount / totalCount) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-medium">{grantedCount}/{totalCount}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Permission Matrix */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Permission Matrix
                        </CardTitle>
                        <CardDescription>
                            Toggle permissions for each role. CEO and Developer roles always have full access.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue={categories[0]} className="w-full">
                            <TabsList className="mb-4 flex-wrap h-auto">
                                {categories.map((category) => {
                                    const Icon = CATEGORY_ICONS[category] || Settings;
                                    return (
                                        <TabsTrigger key={category} value={category} className="flex items-center gap-2">
                                            <Icon className="h-4 w-4" />
                                            {category}
                                        </TabsTrigger>
                                    );
                                })}
                            </TabsList>

                            {categories.map((category) => (
                                <TabsContent key={category} value={category}>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[300px] min-w-[200px]">Permission</TableHead>
                                                    {ROLES.map((role) => (
                                                        <TableHead key={role.key} className="text-center w-[100px] min-w-[80px]">
                                                            <Badge variant="outline" className={`${role.color} text-xs`}>
                                                                {role.name.split(' ')[0]}
                                                            </Badge>
                                                        </TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {PERMISSIONS.filter(p => p.category === category).map((permission) => (
                                                    <TableRow key={permission.key}>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">{permission.name}</span>
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger>
                                                                            <Info className="h-4 w-4 text-muted-foreground" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>{permission.description}</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </div>
                                                        </TableCell>
                                                        {ROLES.map((role) => (
                                                            <TableCell key={role.key} className="text-center">
                                                                {(role.key === 'ceo' || role.key === 'developer') ? (
                                                                    <div className="flex justify-center">
                                                                        <Check className="h-5 w-5 text-green-600" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex justify-center">
                                                                        <Switch
                                                                            checked={permissions[role.key][permission.key] || false}
                                                                            onCheckedChange={() => togglePermission(role.key, permission.key)}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>
                            ))}
                        </Tabs>
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-3">
                            <Button variant="outline" onClick={handleReset}>
                                Reset to Defaults
                            </Button>
                            <Button variant="outline" onClick={() => {
                                // Copy Executive Manager permissions to Admin
                                setPermissions(prev => ({
                                    ...prev,
                                    admin: { ...prev.executive_manager },
                                }));
                                setHasChanges(true);
                            }}>
                                Copy Executive Manager → Admin
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}

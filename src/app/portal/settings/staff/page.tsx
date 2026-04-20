'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Plus, Shield, Mail, Phone, MoreVertical, ArrowUpDown, ArrowUp, ArrowDown, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import type { AccountStatus, Profile, UserRole } from '@/types/database';
import { usePermissions } from '@/hooks/usePermissions';
import { NON_DELETED_PROFILE_FILTER } from '@/lib/staff/profile-filters';

const ROLE_LABELS: Record<UserRole, string> = {
    ceo: 'CEO',
    executive_manager: 'Executive Manager',
    admin: 'Admin',
    accounts_manager: 'Accounts Manager',
    assessor: 'Assessor',
    dispatch_coordinator: 'Dispatch Coordinator',
    frontdesk: 'Frontdesk',
    developer: 'Developer',
    agent: 'Agent',
};

const ROLE_COLORS: Record<UserRole, string> = {
    ceo: 'bg-red-100 text-red-700 border-red-200',
    executive_manager: 'bg-purple-100 text-purple-700 border-purple-200',
    admin: 'bg-orange-100 text-orange-700 border-orange-200',
    accounts_manager: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    assessor: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    dispatch_coordinator: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    frontdesk: 'bg-blue-100 text-blue-700 border-blue-200',
    developer: 'bg-pink-100 text-pink-700 border-pink-200',
    agent: 'bg-green-100 text-green-700 border-green-200',
};

const ACCOUNT_STATUS_COLORS: Record<AccountStatus, string> = {
    active: 'bg-green-100 text-green-700 border-green-200',
    disabled: 'bg-red-100 text-red-700 border-red-200',
};

// Role ordering for sorting
const ROLE_ORDER: Record<UserRole, number> = {
    ceo: 1,
    executive_manager: 2,
    admin: 3,
    accounts_manager: 4,
    assessor: 5,
    dispatch_coordinator: 6,
    frontdesk: 7,
    developer: 8,
    agent: 9,
};

type SortField = 'name' | 'email' | 'phone' | 'role' | 'created';
type SortDirection = 'asc' | 'desc';

export default function StaffPage() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const supabase = useMemo(() => createClient(), []);
    
    // Safe permissions hook
    const permissions = usePermissions();
    const { can, loading: permissionsLoading } = permissions;

    const loadProfiles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .or(NON_DELETED_PROFILE_FILTER)
                .order('created_at', { ascending: false });

            if (fetchError) {
                console.error('Error fetching profiles:', fetchError);
                setError(fetchError.message || 'Failed to load accounts. Please try again.');
                setProfiles([]);
            } else {
                setProfiles(data || []);
            }
        } catch (err) {
            console.error('Unexpected error fetching profiles:', err);
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
            setError(errorMessage);
            setProfiles([]);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        loadProfiles();
    }, [loadProfiles]);
    
    // Safe permission check function
    const canManage = useMemo(() => {
        try {
            if (permissionsLoading) return false;
            return can('staff.manage');
        } catch {
            return false;
        }
    }, [can, permissionsLoading]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const sortedProfiles = useMemo(() => {
        const sorted = [...profiles].sort((a, b) => {
            let comparison = 0;

            switch (sortField) {
                case 'name':
                    comparison = (a.full_name || '').localeCompare(b.full_name || '');
                    break;
                case 'email':
                    comparison = (a.email || '').localeCompare(b.email || '');
                    break;
                case 'phone':
                    comparison = (a.phone || '').localeCompare(b.phone || '');
                    break;
                case 'role':
                    comparison = (ROLE_ORDER[a.role] || 99) - (ROLE_ORDER[b.role] || 99);
                    break;
                case 'created':
                    comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    break;
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });

        return sorted;
    }, [profiles, sortField, sortDirection]);

    const getInitials = (name: string | null) => {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) {
            return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
        }
        return sortDirection === 'asc'
            ? <ArrowUp className="h-4 w-4 ml-1" />
            : <ArrowDown className="h-4 w-4 ml-1" />;
    };

    if (loading) {
        return (
            <main className="flex-1 overflow-y-auto flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading staff members...</p>
                </div>
            </main>
        );
    }
    
    if (error) {
        return (
            <main className="flex-1 overflow-y-auto">
                <header className="bg-card border-b border-border px-4 sm:px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Staff</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Manage staff and agent accounts and roles
                            </p>
                        </div>
                    </div>
                </header>
                <div className="p-4 sm:p-6 flex items-center justify-center min-h-[400px]">
                    <Card className="p-12 text-center max-w-md">
                        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
                        <h3 className="text-lg font-medium mb-2 text-destructive">Error Loading Accounts</h3>
                        <p className="text-muted-foreground mb-4">{error}</p>
                        <Button onClick={loadProfiles} variant="outline">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Try Again
                        </Button>
                    </Card>
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
                        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Staff</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage staff and agent accounts and roles.
                        </p>
                    </div>
                    {canManage && (
                        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
                            <Link href="/portal/settings/staff/new?role=admin">
                                <Button size="sm" className="sm:size-default">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Staff Member
                                </Button>
                            </Link>
                            <Link href="/portal/settings/staff/new?role=agent">
                                <Button size="sm" variant="outline" className="sm:size-default">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Agent
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>
            </header>

            <div className="p-4 sm:p-6">
                {/* Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 mb-6">
                    {(['ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer', 'agent'] as UserRole[]).map((role) => {
                        const count = profiles?.filter(p => p.role === role).length || 0;
                        return (
                            <Card key={role} className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ROLE_COLORS[role]?.replace('text-', 'bg-').replace('-700', '-100') || 'bg-gray-100'}`}>
                                        <Shield className={`h-5 w-5 ${ROLE_COLORS[role]?.split(' ')[1] || 'text-gray-700'}`} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{count}</p>
                                        <p className="text-xs text-muted-foreground">{ROLE_LABELS[role] || role}</p>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>

                {/* Staff Table */}
                {sortedProfiles && sortedProfiles.length > 0 ? (
                    <div className="bg-card rounded-lg border border-border overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table className="min-w-[700px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>
                                            <button
                                                onClick={() => handleSort('name')}
                                                className="flex items-center hover:text-foreground transition-colors"
                                            >
                                                User
                                                <SortIcon field="name" />
                                            </button>
                                        </TableHead>
                                        <TableHead>
                                            <button
                                                onClick={() => handleSort('email')}
                                                className="flex items-center hover:text-foreground transition-colors"
                                            >
                                                Email
                                                <SortIcon field="email" />
                                            </button>
                                        </TableHead>
                                        <TableHead>
                                            <button
                                                onClick={() => handleSort('phone')}
                                                className="flex items-center hover:text-foreground transition-colors"
                                            >
                                                Phone
                                                <SortIcon field="phone" />
                                            </button>
                                        </TableHead>
                                         <TableHead>
                                             <button
                                                 onClick={() => handleSort('role')}
                                                 className="flex items-center hover:text-foreground transition-colors"
                                             >
                                                 Role
                                                 <SortIcon field="role" />
                                             </button>
                                         </TableHead>
                                         <TableHead>Account</TableHead>
                                         <TableHead>
                                             <button
                                                 onClick={() => handleSort('created')}
                                                 className="flex items-center hover:text-foreground transition-colors"
                                            >
                                                Created
                                                <SortIcon field="created" />
                                            </button>
                                        </TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedProfiles.map((profile: Profile) => (
                                        <TableRow key={profile.id} className="hover:bg-muted/50">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9">
                                                        <AvatarImage src={profile.avatar_url || undefined} />
                                                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                                            {getInitials(profile.full_name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium">{profile.full_name || 'Unnamed User'}</p>
                                                        <p className="text-xs text-muted-foreground">{profile.id.slice(0, 8)}...</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                                    {profile.email || '-'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                                    {profile.phone || '-'}
                                                </div>
                                            </TableCell>
                                             <TableCell>
                                                 <Badge variant="outline" className={ROLE_COLORS[profile.role]}>
                                                     {ROLE_LABELS[profile.role]}
                                                 </Badge>
                                             </TableCell>
                                             <TableCell>
                                                 <Badge
                                                     variant="outline"
                                                     className={ACCOUNT_STATUS_COLORS[(profile.account_status || 'active') as AccountStatus]}
                                                 >
                                                     {(profile.account_status || 'active') === 'active' ? 'Active' : 'Disabled'}
                                                 </Badge>
                                             </TableCell>
                                             <TableCell className="text-sm text-muted-foreground">
                                                 {new Date(profile.created_at).toLocaleDateString()}
                                             </TableCell>
                                            <TableCell>
                                                <Link href={`/portal/settings/staff/${profile.id}`}>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                ) : (
                    <Card className="p-8 sm:p-12 text-center">
                        <Users className="h-12 sm:h-16 w-12 sm:w-16 mx-auto mb-4 text-muted-foreground/50" />
                        <h3 className="text-lg font-medium mb-2">No user accounts yet</h3>
                        <p className="text-muted-foreground mb-4">
                            Add your first staff member or agent to get started.
                        </p>
                        {canManage && (
                            <div className="flex flex-wrap justify-center gap-2">
                                <Link href="/portal/settings/staff/new?role=admin">
                                    <Button>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Staff Member
                                    </Button>
                                </Link>
                                <Link href="/portal/settings/staff/new?role=agent">
                                    <Button variant="outline">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Agent
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </Card>
                )}
            </div>
        </main>
    );
}

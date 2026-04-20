import { backfillMissingAgentPartners } from '@/lib/partners/agent-provisioning';
import { createAdminServerClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Plus, Mail, Phone, MoreVertical, ExternalLink, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import type { AccountStatus, Partner, Profile } from '@/types/database';

export const dynamic = 'force-dynamic';
const PARTNER_STATUS_COLORS: Record<string, string> = {
    active: 'bg-green-100 text-green-700 border-green-200',
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    suspended: 'bg-red-100 text-red-700 border-red-200',
    inactive: 'bg-gray-100 text-gray-700 border-gray-200',
};

const ACCOUNT_STATUS_COLORS: Record<AccountStatus, string> = {
    active: 'bg-green-100 text-green-700 border-green-200',
    disabled: 'bg-red-100 text-red-700 border-red-200',
};

type AgentPartnerRow = Pick<Partner, 'id' | 'company_name' | 'contact_name' | 'email' | 'phone' | 'status' | 'user_id' | 'created_at'>;
type LinkedProfileRow = Pick<Profile, 'id' | 'full_name' | 'email' | 'account_status'>;

export default async function AgentsPage() {
    const adminClient = createAdminServerClient();

    try {
        const repairResult = await backfillMissingAgentPartners(adminClient);

        if (repairResult.errors.length > 0) {
            console.warn('Agent partner backfill completed with errors:', repairResult.errors);
        }
    } catch (error) {
        console.error('Error repairing missing agent partner records:', error);
    }

    const { data: partners, error } = await adminClient
        .from('partners')
        .select('id, company_name, contact_name, email, phone, status, user_id, created_at')
        .eq('type', 'agent')
        .order('company_name', { ascending: true });

    const agentPartners = (partners || []) as AgentPartnerRow[];
    const linkedUserIds = agentPartners
        .map((partner) => partner.user_id)
        .filter((value): value is string => Boolean(value));

    let linkedProfilesById = new Map<string, LinkedProfileRow>();
    if (linkedUserIds.length > 0) {
        const { data: profiles, error: profilesError } = await adminClient
            .from('profiles')
            .select('id, full_name, email, account_status')
            .in('id', linkedUserIds);

        if (profilesError) {
            console.error('Error fetching linked agent profiles:', profilesError);
        }

        linkedProfilesById = new Map((profiles || []).map((profile) => [profile.id, profile as LinkedProfileRow]));
    }

    const totalAgents = agentPartners.length;
    const linkedAgents = agentPartners.filter((partner) => partner.user_id && linkedProfilesById.has(partner.user_id)).length;

    if (error) {
        console.error('Error fetching agent partners:', error);

        return (
            <main className="flex-1 overflow-y-auto">
                <header className="bg-card border-b border-border px-4 sm:px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Agent Management</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Manage agent accounts and linked partner records
                            </p>
                        </div>
                        <Link href="/portal/settings/staff/new?role=agent" className="self-start sm:self-auto">
                            <Button size="sm" className="sm:size-default">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Agent
                            </Button>
                        </Link>
                    </div>
                </header>

                <div className="p-4 sm:p-6">
                    <Card className="p-8 sm:p-12 text-center">
                        <AlertCircle className="h-12 sm:h-16 w-12 sm:w-16 mx-auto mb-4 text-destructive" />
                        <h3 className="text-lg font-medium mb-2">Unable to load agents</h3>
                        <p className="text-muted-foreground">{error.message || 'Failed to load the agent list.'}</p>
                    </Card>
                </div>
            </main>
        );
    }

    return (
        <main className="flex-1 overflow-y-auto">
            <header className="bg-card border-b border-border px-4 sm:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Agent Management</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage agent accounts and linked partner records
                        </p>
                    </div>
                    <Link href="/portal/settings/staff/new?role=agent" className="self-start sm:self-auto">
                        <Button size="sm" className="sm:size-default">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Agent
                        </Button>
                    </Link>
                </div>
            </header>

            <div className="p-4 sm:p-6">
                <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <Users className="h-5 w-5 text-green-700" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{totalAgents}</p>
                                <p className="text-xs text-muted-foreground">Total Agent Partners</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Users className="h-5 w-5 text-blue-700" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{linkedAgents}</p>
                                <p className="text-xs text-muted-foreground">Linked User Accounts</p>
                            </div>
                        </div>
                    </Card>
                </div>

                {agentPartners.length > 0 ? (
                    <div className="bg-card rounded-lg border border-border overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table className="min-w-[760px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Agent</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Linked Account</TableHead>
                                        <TableHead>Account Status</TableHead>
                                        <TableHead>Partner Status</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {agentPartners.map((partner) => {
                                        const linkedProfile = partner.user_id
                                            ? linkedProfilesById.get(partner.user_id)
                                            : null;

                                        return (
                                            <TableRow key={partner.id} className="hover:bg-muted/50">
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{partner.company_name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {partner.contact_name || 'No contact person'}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                                        {partner.email || linkedProfile?.email || '-'}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                                        {partner.phone || '-'}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {linkedProfile ? (
                                                        <Link
                                                            href={`/portal/settings/staff/${linkedProfile.id}`}
                                                            className="flex items-center gap-1 text-sm text-primary hover:underline"
                                                        >
                                                            {linkedProfile.full_name || 'Unnamed User'}
                                                            <ExternalLink className="h-3 w-3" />
                                                        </Link>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">Not linked</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {linkedProfile ? (
                                                        <Badge
                                                            variant="outline"
                                                            className={ACCOUNT_STATUS_COLORS[(linkedProfile.account_status || 'active') as AccountStatus]}
                                                        >
                                                            {(linkedProfile.account_status || 'active') === 'active' ? 'Active' : 'Disabled'}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-gray-100 text-gray-500">
                                                            No account
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={PARTNER_STATUS_COLORS[partner.status] || ''}>
                                                        {partner.status.charAt(0).toUpperCase() + partner.status.slice(1)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {new Date(partner.created_at).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Link href={`/portal/partners/${partner.id}`}>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                ) : (
                    <Card className="p-8 sm:p-12 text-center">
                        <Users className="h-12 sm:h-16 w-12 sm:w-16 mx-auto mb-4 text-muted-foreground/50" />
                        <h3 className="text-lg font-medium mb-2">No agents yet</h3>
                        <p className="text-muted-foreground mb-4">
                            Add your first agent to get started.
                        </p>
                        <Link href="/portal/settings/staff/new?role=agent">
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Agent
                            </Button>
                        </Link>
                    </Card>
                )}
            </div>
        </main>
    );
}

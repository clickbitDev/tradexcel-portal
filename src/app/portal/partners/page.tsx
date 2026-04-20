import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Plus, Mail, Phone, MapPin, Building2, Star, TrendingUp, Clock, Target, Upload, Download, DollarSign, FileText, AlertTriangle, Trophy } from 'lucide-react';
import Link from 'next/link';
import type { Partner } from '@/types/database';
import { PermissionButton } from '@/components/permissions/permission-button';
import { isAgentLikePartnerType } from '@/lib/partners/constants';
import { ACTIVE_RECORD_FILTER } from '@/lib/soft-delete';

interface AgentMetrics {
    partner_id: string;
    company_name: string;
    applications: number;
    revenue: number;
}

export default async function PartnersPage() {
    const supabase = await createServerClient();

    // Fetch partners
    const { data: partners, error } = await supabase
        .from('partners')
        .select('*')
        .order('company_name');

    if (error) {
        console.error('Error fetching partners:', error);
    }

    // Fetch applications with partner data for metrics
    const { data: applications } = await supabase
        .from('applications')
        .select(`
            id,
            partner_id,
            quoted_tuition,
            total_paid,
            workflow_stage,
            partner:partners(id, company_name)
        `)
        .or(ACTIVE_RECORD_FILTER);

    // Calculate agent metrics
    const agentMetricsMap = new Map<string, AgentMetrics>();
    let totalApplications = 0;
    let totalValue = 0;    // quoted_tuition = Total Amount (quoted)
    let totalRevenue = 0;  // total_paid = Payment Amount (received)
    let unlinkedApplications = 0;

    applications?.forEach(app => {
        totalApplications++;
        const value = (app.quoted_tuition || 0);
        const revenue = (app.total_paid || 0);
        totalValue += value;
        totalRevenue += revenue;

        if (!app.partner_id) {
            unlinkedApplications++;
            return;
        }

        const partnerId = app.partner_id;
        const partner = Array.isArray(app.partner) ? app.partner[0] : app.partner;
        const partnerName = partner?.company_name || 'Unknown';

        if (!agentMetricsMap.has(partnerId)) {
            agentMetricsMap.set(partnerId, {
                partner_id: partnerId,
                company_name: partnerName,
                applications: 0,
                revenue: 0,
            });
        }

        const metrics = agentMetricsMap.get(partnerId)!;
        metrics.applications++;
        metrics.revenue += value;  // Using quoted value for leaderboard
    });

    // Sort agents by applications (leaderboard)
    const agentLeaderboard = Array.from(agentMetricsMap.values())
        .sort((a, b) => b.applications - a.applications)
        .slice(0, 10);

    const agents = partners?.filter((p) => p.type === 'agent') || [];
    const subagents = partners?.filter((p) => p.type === 'subagent') || [];
    const providers = partners?.filter((p) => p.type === 'provider') || [];
    const activeAgents = agents.filter(a => a.status === 'active').length;

    const statusColors: Record<string, string> = {
        active: 'bg-green-100 text-green-700 border-green-200',
        pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        suspended: 'bg-red-100 text-red-700 border-red-200',
        inactive: 'bg-gray-100 text-gray-700 border-gray-200',
    };

    const priorityColors: Record<string, string> = {
        standard: 'bg-gray-100 text-gray-700',
        preferred: 'bg-blue-100 text-blue-700',
        premium: 'bg-purple-100 text-purple-700',
    };

    const getKpiColor = (value: number | null) => {
        if (value === null) return 'bg-gray-200';
        if (value >= 80) return 'bg-green-500';
        if (value >= 60) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const PartnerCard = ({ partner }: { partner: Partner }) => (
        <Link href={`/portal/partners/${partner.id}`}>
            <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            {isAgentLikePartnerType(partner.type) ? (
                                <Users className="w-5 h-5 text-primary" />
                            ) : (
                                <Building2 className="w-5 h-5 text-primary" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">{partner.company_name}</h3>
                            {partner.contact_name && (
                                <p className="text-sm text-muted-foreground">{partner.contact_name}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className={statusColors[partner.status] || ''}>
                            {partner.status.charAt(0).toUpperCase() + partner.status.slice(1)}
                        </Badge>
                        {partner.priority_level !== 'standard' && (
                            <Badge className={priorityColors[partner.priority_level]}>
                                <Star className="h-3 w-3 mr-1" />
                                {partner.priority_level}
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="space-y-1.5 text-sm">
                    {partner.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-4 h-4" />
                            <span className="truncate">{partner.email}</span>
                        </div>
                    )}
                    {partner.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-4 h-4" />
                            <span>{partner.phone}</span>
                        </div>
                    )}
                    {partner.country && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span>{partner.country}</span>
                        </div>
                    )}
                </div>

                {/* KPI Section */}
                {(partner.kpi_conversion_rate !== null || partner.kpi_ontime_rate !== null) && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                        {partner.kpi_conversion_rate !== null && (
                            <div className="flex items-center gap-2">
                                <Target className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-muted-foreground">Conversion</span>
                                        <span className="font-medium">{partner.kpi_conversion_rate}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${getKpiColor(partner.kpi_conversion_rate)} transition-all`}
                                            style={{ width: `${partner.kpi_conversion_rate}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        {partner.kpi_ontime_rate !== null && (
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-muted-foreground">On-time</span>
                                        <span className="font-medium">{partner.kpi_ontime_rate}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${getKpiColor(partner.kpi_ontime_rate)} transition-all`}
                                            style={{ width: `${partner.kpi_ontime_rate}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {partner.commission_rate && !partner.kpi_conversion_rate && !partner.kpi_ontime_rate && (
                    <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-sm">
                            <span className="text-muted-foreground">Commission:</span>{' '}
                            <span className="font-semibold">{partner.commission_rate}%</span>
                        </p>
                    </div>
                )}
            </Card>
        </Link>
    );

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">Partners</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage agents and education providers
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline">
                            <Download className="h-4 w-4 mr-2" />
                            Export CSV
                        </Button>
                        <PermissionButton permission="partners.manage" variant="outline" href="/portal/partners/import">
                            <Upload className="h-4 w-4 mr-2" />
                            Import CSV
                        </PermissionButton>
                        <PermissionButton permission="partners.manage" href="/portal/partners/new?type=agent">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Partner
                        </PermissionButton>
                    </div>
                </div>
            </header>

            <div className="p-6 space-y-6">
                {/* Dashboard Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-lg bg-blue-100">
                                    <FileText className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Applications</p>
                                    <p className="text-2xl font-bold">{totalApplications.toLocaleString()}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-lg bg-indigo-100">
                                    <TrendingUp className="h-6 w-6 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Value</p>
                                    <p className="text-2xl font-bold">${totalValue.toLocaleString()}</p>
                                    <p className="text-xs text-muted-foreground">Quoted tuition</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-lg bg-green-100">
                                    <DollarSign className="h-6 w-6 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                                    <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
                                    <p className="text-xs text-muted-foreground">Payments received</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-lg bg-purple-100">
                                    <Users className="h-6 w-6 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Active Agents</p>
                                    <p className="text-2xl font-bold">{activeAgents}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-lg ${unlinkedApplications > 0 ? 'bg-amber-100' : 'bg-gray-100'}`}>
                                    <AlertTriangle className={`h-6 w-6 ${unlinkedApplications > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Unlinked Apps</p>
                                    <p className="text-2xl font-bold">{unlinkedApplications}</p>
                                    <p className="text-xs text-muted-foreground">No agent assigned</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Agent Leaderboard */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-amber-500" />
                            Top Agents by Applications
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead>Agent</TableHead>
                                    <TableHead className="text-right">Applications</TableHead>
                                    <TableHead className="text-right">Revenue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {agentLeaderboard.map((agent, index) => (
                                    <TableRow key={agent.partner_id}>
                                        <TableCell>
                                            {index < 3 ? (
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold ${index === 0 ? 'bg-amber-100 text-amber-700' :
                                                    index === 1 ? 'bg-gray-200 text-gray-700' :
                                                        'bg-orange-100 text-orange-700'
                                                    }`}>
                                                    {index + 1}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">{index + 1}</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <Link
                                                href={`/portal/partners/${agent.partner_id}`}
                                                className="hover:text-primary hover:underline"
                                            >
                                                {agent.company_name}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums font-medium">
                                            {agent.applications}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-green-600 font-medium">
                                            ${agent.revenue.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {agentLeaderboard.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                            No application data available yet
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Partner Tabs */}
                <Tabs defaultValue="agents">
                    <TabsList className="mb-6">
                        <TabsTrigger value="agents" className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Agents ({agents.length})
                        </TabsTrigger>
                        <TabsTrigger value="subagents" className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Sub-agents ({subagents.length})
                        </TabsTrigger>
                        <TabsTrigger value="providers" className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Providers ({providers.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="agents">
                        {agents.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {agents.map((partner) => (
                                    <PartnerCard key={partner.id} partner={partner} />
                                ))}
                            </div>
                        ) : (
                            <Card className="p-12 text-center">
                                <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                                <h3 className="text-lg font-medium mb-2">No agents yet</h3>
                                <p className="text-muted-foreground mb-4">
                                    Add your first agent to get started.
                                </p>
                                <Link href="/portal/partners/new?type=agent">
                                    <Button>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Agent
                                    </Button>
                                </Link>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="subagents">
                        {subagents.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {subagents.map((partner) => (
                                    <PartnerCard key={partner.id} partner={partner} />
                                ))}
                            </div>
                        ) : (
                            <Card className="p-12 text-center">
                                <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                                <h3 className="text-lg font-medium mb-2">No sub-agents yet</h3>
                                <p className="text-muted-foreground mb-4">
                                    Add your first sub-agent to get started.
                                </p>
                                <Link href="/portal/partners/new?type=subagent">
                                    <Button>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Sub-agent
                                    </Button>
                                </Link>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="providers">
                        {providers.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {providers.map((partner) => (
                                    <PartnerCard key={partner.id} partner={partner} />
                                ))}
                            </div>
                        ) : (
                            <Card className="p-12 text-center">
                                <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                                <h3 className="text-lg font-medium mb-2">No providers yet</h3>
                                <p className="text-muted-foreground mb-4">
                                    Add your first provider to get started.
                                </p>
                                <Link href="/portal/partners/new?type=provider">
                                    <Button>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Provider
                                    </Button>
                                </Link>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </main>
    );
}

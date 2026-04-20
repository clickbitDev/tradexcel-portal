'use client';

import { useState, useMemo, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
    BarChart3,
    Users,
    Building2,
    TrendingUp,
    DollarSign,
    FileText,
    RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DateRangePicker,
    ApplicationsTrendChart,
    AgentPerformanceTableChart,
    WorkflowFunnelChart,
    RTODistributionChart,
    ConversionRateCard,
    StatCard,
    AgentPerformanceTable,
    FinancialSummaryCard,
    ExportButton,
} from '@/components/reports';
import { ApplicationsChart, AgentPerformanceChart } from '@/components/dashboard/charts';
import {
    DateRange,
    getDateRangeFromPreset,
    aggregateByMonth,
    aggregateByAgent,
    aggregateByStage,
    calculateFinancialSummary,
    ApplicationData,
} from '@/lib/report-utils';
import { usePermissions } from '@/hooks/usePermissions';
import { getPortalRouteBase, withPortalBase } from '@/lib/routes/portal';

interface ReportsClientPageProps {
    applications: ApplicationData[];
    initialFrom?: string;
    initialTo?: string;
}

export function ReportsClientPage({ applications, initialFrom, initialTo }: ReportsClientPageProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { role } = usePermissions();
    const routeBase = getPortalRouteBase(pathname, role);

    // Initialize date range from URL params or default to last 30 days
    const [dateRange, setDateRange] = useState<DateRange>(() => {
        if (initialFrom && initialTo) {
            return {
                from: new Date(initialFrom),
                to: new Date(initialTo),
                preset: 'custom',
            };
        }
        return getDateRangeFromPreset('last30days');
    });

    const [isRefreshing, setIsRefreshing] = useState(false);

    // Aggregate data
    const monthlyData = useMemo(() => aggregateByMonth(applications, 12), [applications]);
    const agentData = useMemo(() => aggregateByAgent(applications), [applications]);
    const stageData = useMemo(() => aggregateByStage(applications), [applications]);
    const financialData = useMemo(() => calculateFinancialSummary(applications), [applications]);

    // Calculate KPIs
    const totalApplications = applications.length;
    const enrolledCount = applications.filter(a => a.workflow_stage === 'enrolled').length;
    const dispatchCount = applications.filter(a => a.workflow_stage === 'dispatch').length;
    const completedCount = applications.filter(a => a.workflow_stage === 'completed').length;
    const conversionRate = totalApplications > 0 ? Math.round((enrolledCount / totalApplications) * 100) : 0;

    const handleDateRangeChange = useCallback((range: DateRange) => {
        setDateRange(range);
    }, []);

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);

        // Build URL with date params
        const params = new URLSearchParams();
        params.set('from', dateRange.from.toISOString().split('T')[0]);
        params.set('to', dateRange.to.toISOString().split('T')[0]);

        router.push(`${withPortalBase(routeBase, 'reports')}?${params.toString()}`);

        // Reset refresh state after navigation
        setTimeout(() => setIsRefreshing(false), 500);
    }, [dateRange, routeBase, router]);

    // Export all data
    const exportAllData = applications.map(app => ({
        ID: app.id,
        'Created At': app.created_at,
        'Workflow Stage': app.workflow_stage,
        Partner: (app.partner as { company_name?: string } | null)?.company_name || 'Unknown',
        RTO: app.offering?.rto?.name || 'Unknown',
        Qualification: app.offering?.qualification?.name || 'Unknown',
        'Tuition Fee': app.offering?.tuition_fee_onshore || 0,
    }));

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">Reports & Analytics</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Analyze application trends, agent performance, and financial metrics
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <DateRangePicker
                            dateRange={dateRange}
                            onDateRangeChange={handleDateRangeChange}
                        />
                        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Apply
                        </Button>
                        <ExportButton
                            data={exportAllData}
                            filename="applications-report"
                        />
                    </div>
                </div>
            </header>

            <div className="p-6 space-y-6">
                {/* KPI Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="Total Applications"
                        value={totalApplications}
                        description="In selected period"
                        icon={<FileText className="h-8 w-8" />}
                    />
                    <StatCard
                        title="Enrolled"
                        value={enrolledCount}
                        description={`${conversionRate}% conversion rate`}
                        icon={<TrendingUp className="h-8 w-8" />}
                    />
                    <StatCard
                        title="Completed"
                        value={completedCount}
                        description="Finalized applications"
                        icon={<Building2 className="h-8 w-8" />}
                    />
                    <StatCard
                        title="Active Agents"
                        value={agentData.length}
                        description="Partners with applications"
                        icon={<Users className="h-8 w-8" />}
                    />
                </div>

                {/* Tab Navigation */}
                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="overview" className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="agents" className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Agent Performance
                        </TabsTrigger>
                        <TabsTrigger value="financial" className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Financial
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Analytics
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <ApplicationsTrendChart data={monthlyData} />
                            <WorkflowFunnelChart data={stageData} />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <RTODistributionChart data={financialData.byRTO} />
                            </div>
                            <div className="space-y-4">
                                <ConversionRateCard
                                    rate={conversionRate}
                                    label="Overall Conversion Rate"
                                />
                                <ConversionRateCard
                                    rate={dispatchCount > 0 && completedCount > 0 ? Math.round((completedCount / dispatchCount) * 100) : 0}
                                    label="Dispatch to Completed Rate"
                                />
                            </div>
                        </div>
                    </TabsContent>

                    {/* Agent Performance Tab */}
                    <TabsContent value="agents" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <AgentPerformanceTableChart data={agentData} />
                            <div className="grid grid-cols-2 gap-4 content-start">
                                <StatCard
                                    title="Top Performer"
                                    value={agentData[0]?.name || 'N/A'}
                                    description={`${agentData[0]?.total || 0} applications`}
                                />
                                <StatCard
                                    title="Highest Conversion"
                                    value={[...agentData].sort((a, b) => b.conversionRate - a.conversionRate)[0]?.name || 'N/A'}
                                    description={`${[...agentData].sort((a, b) => b.conversionRate - a.conversionRate)[0]?.conversionRate || 0}%`}
                                />
                                <StatCard
                                    title="Avg Conversion Rate"
                                    value={`${agentData.length > 0 ? Math.round(agentData.reduce((sum, a) => sum + a.conversionRate, 0) / agentData.length) : 0}%`}
                                    description="Across all agents"
                                />
                                <StatCard
                                    title="Avg Applications"
                                    value={agentData.length > 0 ? Math.round(agentData.reduce((sum, a) => sum + a.total, 0) / agentData.length) : 0}
                                    description="Per agent"
                                />
                            </div>
                        </div>

                        <AgentPerformanceTable data={agentData} />
                    </TabsContent>

                    {/* Financial Tab */}
                    <TabsContent value="financial" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <FinancialSummaryCard
                                totalApplications={financialData.totalApplications}
                                totalPotentialFees={financialData.totalPotentialFees}
                                enrolledFees={financialData.enrolledFees}
                                averageFeePerApplication={financialData.averageFeePerApplication}
                            />
                            <div className="lg:col-span-2">
                                <RTODistributionChart
                                    data={financialData.byRTO}
                                    title="Revenue by RTO"
                                />
                            </div>
                        </div>

                        {/* RTO Fees Table */}
                        <div className="bg-card rounded-lg border">
                            <div className="px-6 py-4 border-b flex items-center justify-between">
                                <h3 className="font-semibold">Fees by RTO</h3>
                                <ExportButton
                                    data={financialData.byRTO.map(r => ({
                                        RTO: r.rtoName,
                                        Applications: r.count,
                                        Percentage: `${r.percentage}%`,
                                        'Total Fees': r.totalFees,
                                    }))}
                                    filename="fees-by-rto"
                                />
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="text-left py-3 px-6 font-medium">RTO</th>
                                            <th className="text-right py-3 px-6 font-medium">Applications</th>
                                            <th className="text-right py-3 px-6 font-medium">Share</th>
                                            <th className="text-right py-3 px-6 font-medium">Total Fees</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {financialData.byRTO.slice(0, 10).map((rto) => (
                                            <tr key={rto.rtoName} className="border-b hover:bg-muted/50">
                                                <td className="py-3 px-6 font-medium">{rto.rtoName}</td>
                                                <td className="py-3 px-6 text-right">{rto.count}</td>
                                                <td className="py-3 px-6 text-right">{rto.percentage}%</td>
                                                <td className="py-3 px-6 text-right text-green-600 font-medium">
                                                    {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(rto.totalFees)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {financialData.byRTO.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No RTO data available for the selected period.
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {/* Analytics Tab */}
                    <TabsContent value="analytics" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ApplicationsChart
                                data={monthlyData}
                            />
                            <AgentPerformanceChart
                                data={agentData.slice(0, 5).map(a => ({
                                    name: a.name,
                                    applications: a.total,
                                    partner_id: a.partner_id,
                                }))}
                            />
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </main>
    );
}

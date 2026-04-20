/**
 * Report Utilities
 * Helper functions for report generation, data aggregation, and exports
 */

// Date range presets
export type DateRangePreset = 'today' | 'last7days' | 'last30days' | 'last90days' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';

export interface DateRange {
    from: Date;
    to: Date;
    preset?: DateRangePreset;
}

export function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
        case 'today':
            return { from: today, to: now, preset };
        case 'last7days':
            return { from: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), to: now, preset };
        case 'last30days':
            return { from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), to: now, preset };
        case 'last90days':
            return { from: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000), to: now, preset };
        case 'thisMonth':
            return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now, preset };
        case 'lastMonth':
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
            return { from: lastMonth, to: lastMonthEnd, preset };
        case 'thisYear':
            return { from: new Date(now.getFullYear(), 0, 1), to: now, preset };
        default:
            return { from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), to: now, preset: 'last30days' };
    }
}

// CSV Export utilities
export function exportToCSV<T extends Record<string, unknown>>(
    data: T[],
    filename: string,
    columns?: { key: keyof T; label: string }[]
): void {
    if (data.length === 0) return;

    // Determine columns
    const cols = columns || Object.keys(data[0]).map(key => ({ key: key as keyof T, label: String(key) }));

    // Build CSV content
    const header = cols.map(c => `"${String(c.label)}"`).join(',');
    const rows = data.map(row =>
        cols.map(col => {
            const value = row[col.key];
            if (value === null || value === undefined) return '""';
            if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
            if (value instanceof Date) return `"${value.toISOString()}"`;
            return `"${String(value)}"`;
        }).join(',')
    );

    const csv = [header, ...rows].join('\n');

    // Download file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Data aggregation helpers
export interface ApplicationData {
    id: string;
    created_at: string;
    workflow_stage: string;
    partner_id?: string;
    partner?: { company_name?: string } | null;
    offering?: {
        qualification?: { name?: string } | null;
        rto?: { name?: string } | null;
        tuition_fee_onshore?: number | null;
    } | null;
}

export interface MonthlyDataPoint {
    month: string;
    monthKey: string;
    applications: number;
    enrolled: number;
    docs_review: number;
    evaluate: number;
    accounts: number;
    dispatch: number;
}

export function aggregateByMonth(applications: ApplicationData[], months: number = 6): MonthlyDataPoint[] {
    const now = new Date();
    const dataMap: Record<string, MonthlyDataPoint> = {};

    // Initialize all months
    for (let i = months - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        dataMap[monthKey] = {
            month: monthLabel,
            monthKey,
            applications: 0,
            enrolled: 0,
            docs_review: 0,
            evaluate: 0,
            accounts: 0,
            dispatch: 0,
        };
    }

    // Populate from data
    applications.forEach(app => {
        const appDate = new Date(app.created_at);
        const monthKey = `${appDate.getFullYear()}-${String(appDate.getMonth() + 1).padStart(2, '0')}`;
        if (dataMap[monthKey]) {
            dataMap[monthKey].applications++;
            if (app.workflow_stage === 'enrolled') dataMap[monthKey].enrolled++;
            if (app.workflow_stage === 'docs_review') dataMap[monthKey].docs_review++;
            if (app.workflow_stage === 'evaluate') dataMap[monthKey].evaluate++;
            if (app.workflow_stage === 'accounts') dataMap[monthKey].accounts++;
            if (app.workflow_stage === 'dispatch') dataMap[monthKey].dispatch++;
        }
    });

    return Object.values(dataMap).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

export interface AgentPerformanceData {
    name: string;
    partner_id: string;
    total: number;
    enrolled: number;
    completed: number;
    conversionRate: number;
    avgTurnaroundDays: number;
}

export function aggregateByAgent(applications: ApplicationData[]): AgentPerformanceData[] {
    const agentMap: Record<string, AgentPerformanceData> = {};

    applications.forEach(app => {
        const partnerId = app.partner_id || 'unknown';
        let agentName = 'Unknown';
        if (app.partner && typeof app.partner === 'object' && !Array.isArray(app.partner)) {
            agentName = app.partner.company_name || 'Unknown';
        }

        if (!agentMap[partnerId]) {
            agentMap[partnerId] = {
                name: agentName,
                partner_id: partnerId,
                total: 0,
                enrolled: 0,
                completed: 0,
                conversionRate: 0,
                avgTurnaroundDays: 0,
            };
        }

        agentMap[partnerId].total++;
        if (app.workflow_stage === 'enrolled') agentMap[partnerId].enrolled++;
        if (app.workflow_stage === 'completed') agentMap[partnerId].completed++;
    });

    // Calculate conversion rates
    return Object.values(agentMap).map(agent => ({
        ...agent,
        conversionRate: agent.total > 0 ? Math.round((agent.enrolled / agent.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);
}

export interface StageBreakdown {
    stage: string;
    stageLabel: string;
    count: number;
    percentage: number;
    color: string;
}

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
    docs_review: { label: 'Docs Review', color: '#eab308' },
    enrolled: { label: 'Enrolled', color: '#10b981' },
    evaluate: { label: 'Evaluate', color: '#f59e0b' },
    accounts: { label: 'Accounts', color: '#8b5cf6' },
    dispatch: { label: 'Dispatch', color: '#6366f1' },
    completed: { label: 'Completed', color: '#64748b' },
};

export function aggregateByStage(applications: ApplicationData[]): StageBreakdown[] {
    const stageMap: Record<string, number> = {};
    const total = applications.length;

    applications.forEach(app => {
        const stage = app.workflow_stage || 'unknown';
        stageMap[stage] = (stageMap[stage] || 0) + 1;
    });

    return Object.entries(stageMap).map(([stage, count]) => ({
        stage,
        stageLabel: STAGE_CONFIG[stage]?.label || stage.replace('_', ' '),
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        color: STAGE_CONFIG[stage]?.color || '#94a3b8',
    })).sort((a, b) => {
        const order = ['docs_review', 'enrolled', 'evaluate', 'accounts', 'dispatch', 'completed'];
        return order.indexOf(a.stage) - order.indexOf(b.stage);
    });
}

export interface RTOBreakdown {
    rtoName: string;
    count: number;
    percentage: number;
    totalFees: number;
    [key: string]: string | number;
}

export function aggregateByRTO(applications: ApplicationData[]): RTOBreakdown[] {
    const rtoMap: Record<string, RTOBreakdown> = {};
    const total = applications.length;

    applications.forEach(app => {
        const rtoName = app.offering?.rto?.name || 'Unknown RTO';
        const fee = app.offering?.tuition_fee_onshore || 0;

        if (!rtoMap[rtoName]) {
            rtoMap[rtoName] = { rtoName, count: 0, percentage: 0, totalFees: 0 };
        }
        rtoMap[rtoName].count++;
        rtoMap[rtoName].totalFees += fee;
    });

    return Object.values(rtoMap)
        .map(rto => ({ ...rto, percentage: total > 0 ? Math.round((rto.count / total) * 100) : 0 }))
        .sort((a, b) => b.count - a.count);
}

// Financial summary
export interface FinancialSummary {
    totalApplications: number;
    totalPotentialFees: number;
    enrolledFees: number;
    averageFeePerApplication: number;
    byRTO: RTOBreakdown[];
}

export function calculateFinancialSummary(applications: ApplicationData[]): FinancialSummary {
    const total = applications.length;
    let totalFees = 0;
    let enrolledFees = 0;

    applications.forEach(app => {
        const fee = app.offering?.tuition_fee_onshore || 0;
        totalFees += fee;
        if (['enrolled', 'evaluate', 'dispatch', 'completed'].includes(app.workflow_stage)) {
            enrolledFees += fee;
        }
    });

    return {
        totalApplications: total,
        totalPotentialFees: totalFees,
        enrolledFees,
        averageFeePerApplication: total > 0 ? Math.round(totalFees / total) : 0,
        byRTO: aggregateByRTO(applications),
    };
}

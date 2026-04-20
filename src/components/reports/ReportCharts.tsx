'use client';

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MonthlyDataPoint, AgentPerformanceData, StageBreakdown, RTOBreakdown } from '@/lib/report-utils';

// Applications Over Time Chart
interface ApplicationsTrendChartProps {
    data: MonthlyDataPoint[];
    title?: string;
}

export function ApplicationsTrendChart({ data, title = 'Applications Over Time' }: ApplicationsTrendChartProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>Monthly application submissions and enrollments</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--popover))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                }}
                            />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="applications"
                                name="Applications"
                                stroke="#6366f1"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorApps)"
                            />
                            <Line
                                type="monotone"
                                dataKey="enrolled"
                                name="Enrolled"
                                stroke="#10b981"
                                strokeWidth={2}
                                dot={{ fill: '#10b981', strokeWidth: 2 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="dispatch"
                                name="Dispatch"
                                stroke="#6366f1"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

// Agent Performance Table Chart
interface AgentPerformanceTableChartProps {
    data: AgentPerformanceData[];
    title?: string;
}

export function AgentPerformanceTableChart({ data, title = 'Agent Performance' }: AgentPerformanceTableChartProps) {
    const top10 = data.slice(0, 10);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>Top agents by application volume and conversion rate</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={top10} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <YAxis type="category" dataKey="name" width={75} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--popover))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                }}
                            />
                            <Legend />
                            <Bar dataKey="total" name="Total Applications" fill="#6366f1" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="enrolled" name="Enrolled" fill="#10b981" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

// Workflow Stage Funnel
interface WorkflowFunnelChartProps {
    data: StageBreakdown[];
    title?: string;
}

export function WorkflowFunnelChart({ data, title = 'Application Pipeline' }: WorkflowFunnelChartProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>Distribution of applications across workflow stages</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="stageLabel" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--popover))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                }}
                                formatter={(value: number | undefined, name?: string) => {
                                    const displayName = name || 'Applications';
                                    if (value === undefined) return ['-', displayName];
                                    return [`${value} (${data.find(d => d.count === value)?.percentage || 0}%)`, displayName];
                                }}
                            />
                            <Bar dataKey="count" name="Applications" radius={[4, 4, 0, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

// RTO Distribution Pie Chart
interface RTODistributionChartProps {
    data: RTOBreakdown[];
    title?: string;
}

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

export function RTODistributionChart({ data, title = 'Applications by RTO' }: RTODistributionChartProps) {
    const top8 = data.slice(0, 8);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>Application distribution across RTOs</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={top8 as any}
                                dataKey="count"
                                nameKey="rtoName"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label={({ name, percent }: { name?: string; percent?: number }) => `${name || 'Unknown'} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                                labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                            >
                                {top8.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--popover))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

// Conversion Rate Gauge
interface ConversionRateCardProps {
    rate: number;
    label: string;
    trend?: number;
}

export function ConversionRateCard({ rate, label, trend }: ConversionRateCardProps) {
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (rate / 100) * circumference;

    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex flex-col items-center">
                    <div className="relative w-32 h-32">
                        <svg className="w-32 h-32 -rotate-90">
                            <circle
                                cx="64"
                                cy="64"
                                r="45"
                                stroke="hsl(var(--muted))"
                                strokeWidth="10"
                                fill="none"
                            />
                            <circle
                                cx="64"
                                cy="64"
                                r="45"
                                stroke="#10b981"
                                strokeWidth="10"
                                fill="none"
                                strokeLinecap="round"
                                style={{
                                    strokeDasharray: circumference,
                                    strokeDashoffset,
                                    transition: 'stroke-dashoffset 0.5s ease-in-out',
                                }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-2xl font-bold">{rate}%</span>
                        </div>
                    </div>
                    <p className="mt-3 text-sm font-medium text-muted-foreground">{label}</p>
                    {trend !== undefined && (
                        <p className={`text-xs mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last period
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

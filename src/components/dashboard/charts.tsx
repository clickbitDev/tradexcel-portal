'use client';

import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend,
    LabelList,
    Cell,
    LineChart,
    Line,
} from 'recharts';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MonthlyDataPoint {
    month: string;
    docs_review: number;
    enrolled: number;
    evaluate: number;
    dispatch: number;
}

interface AgentDataPoint {
    name: string;
    applications: number;
    partner_id: string;
}

interface ApplicationsChartProps {
    data: MonthlyDataPoint[];
}

interface AgentPerformanceChartProps {
    data: AgentDataPoint[];
}

// Status colors that work in both light and dark mode
const statusColors = {
    docs_review: '#f59e0b',    // amber
    enrolled: '#10b981',       // emerald
    evaluate: '#f59e0b',       // amber
    dispatch: '#6366f1',       // indigo
};

export function ApplicationsChart({ data }: ApplicationsChartProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Applications by Month</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={data}
                            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                className="stroke-border"
                            />
                            <XAxis
                                dataKey="month"
                                tick={{ className: 'fill-muted-foreground text-xs' }}
                                axisLine={{ className: 'stroke-border' }}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ className: 'fill-muted-foreground text-xs' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 12px rgb(0 0 0 / 0.15)',
                                }}
                                labelStyle={{
                                    color: 'hsl(var(--card-foreground))',
                                    fontWeight: 600,
                                    marginBottom: '4px'
                                }}
                                itemStyle={{
                                    color: 'hsl(var(--card-foreground))',
                                    padding: '2px 0',
                                }}
                            />
                            <Legend
                                wrapperStyle={{ paddingTop: '10px' }}
                                formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                            />
                            <Line
                                type="monotone"
                                dataKey="docs_review"
                                name="Docs Review"
                                stroke={statusColors.docs_review}
                                strokeWidth={2}
                                dot={{ fill: statusColors.docs_review, strokeWidth: 0, r: 3 }}
                                activeDot={{ r: 5 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="evaluate"
                                name="Evaluate"
                                stroke={statusColors.evaluate}
                                strokeWidth={2}
                                dot={{ fill: statusColors.evaluate, strokeWidth: 0, r: 3 }}
                                activeDot={{ r: 5 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="dispatch"
                                name="Dispatch"
                                stroke={statusColors.dispatch}
                                strokeWidth={2}
                                dot={{ fill: statusColors.dispatch, strokeWidth: 0, r: 3 }}
                                activeDot={{ r: 5 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="enrolled"
                                name="Enrolled"
                                stroke={statusColors.enrolled}
                                strokeWidth={2}
                                dot={{ fill: statusColors.enrolled, strokeWidth: 0, r: 3 }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

export function AgentPerformanceChart({ data }: AgentPerformanceChartProps) {
    const router = useRouter();

    const handleBarClick = (barData: { partner_id?: string }) => {
        if (barData?.partner_id) {
            router.push(`/portal/partners/${barData.partner_id}`);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Agent Performance</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data}
                            margin={{ top: 10, right: 40, left: 0, bottom: 0 }}
                            layout="vertical"
                        >
                            <defs>
                                <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={1} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                horizontal={true}
                                vertical={false}
                                className="stroke-border"
                            />
                            <XAxis
                                type="number"
                                tick={{ className: 'fill-muted-foreground text-xs' }}
                                axisLine={{ className: 'stroke-border' }}
                                tickLine={{ className: 'stroke-border' }}
                            />
                            <YAxis
                                type="category"
                                dataKey="name"
                                width={120}
                                tick={{ className: 'fill-foreground text-xs' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Bar
                                dataKey="applications"
                                name="Applications"
                                fill="url(#barGradient)"
                                radius={[0, 6, 6, 0]}
                                barSize={28}
                                cursor="pointer"
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                onClick={(data: any) => handleBarClick(data)}
                            >
                                <LabelList
                                    dataKey="applications"
                                    position="insideRight"
                                    fill="#ffffff"
                                    fontSize={12}
                                    fontWeight={600}
                                    offset={8}
                                />
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        className="transition-opacity hover:opacity-80"
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WORKFLOW_STAGE_LABELS, type WorkflowStage } from '@/types/database';
import { WORKFLOW_STAGE_ORDER } from '@/lib/workflow-transitions';

interface FunnelData {
    stage: WorkflowStage;
    count: number;
    percentage: number;
    dropOff: number;
}

interface ConversionFunnelProps {
    applications: { workflow_stage: WorkflowStage }[];
    className?: string;
}

export function ConversionFunnel({ applications, className }: ConversionFunnelProps) {
    const funnelData = useMemo(() => {
        // Count applications at each stage
        const stageCounts: Record<string, number> = {};
        for (const stage of WORKFLOW_STAGE_ORDER) {
            stageCounts[stage] = 0;
        }

        // Count applications that have reached or passed each stage
        for (const app of applications) {
            const stageIndex = WORKFLOW_STAGE_ORDER.indexOf(app.workflow_stage);
            if (stageIndex >= 0) {
                // Count this app for its current stage and all previous stages
                for (let i = 0; i <= stageIndex; i++) {
                    stageCounts[WORKFLOW_STAGE_ORDER[i]]++;
                }
            }
        }

        // Calculate funnel data
        const total = applications.length;
        const data: FunnelData[] = [];

        for (let i = 0; i < WORKFLOW_STAGE_ORDER.length; i++) {
            const stage = WORKFLOW_STAGE_ORDER[i];
            const count = stageCounts[stage];
            const percentage = total > 0 ? (count / total) * 100 : 0;
            const prevCount = i > 0 ? stageCounts[WORKFLOW_STAGE_ORDER[i - 1]] : total;
            const dropOff = prevCount > 0 ? ((prevCount - count) / prevCount) * 100 : 0;

            data.push({
                stage,
                count,
                percentage,
                dropOff: i === 0 ? 0 : dropOff,
            });
        }

        return data;
    }, [applications]);

    const maxCount = Math.max(...funnelData.map(d => d.count), 1);

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>Lead-to-Enrollment Funnel</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {funnelData.map((data, index) => {
                        const widthPercent = (data.count / maxCount) * 100;
                        const colors = [
                            'bg-blue-500',
                            'bg-blue-400',
                            'bg-indigo-500',
                            'bg-indigo-400',
                            'bg-purple-500',
                            'bg-purple-400',
                            'bg-pink-500',
                            'bg-green-500',
                            'bg-emerald-500',
                        ];
                        const bgColor = colors[index % colors.length];

                        return (
                            <div key={data.stage} className="relative">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium">
                                        {WORKFLOW_STAGE_LABELS[data.stage]}
                                    </span>
                                    <div className="flex items-center gap-4">
                                        {data.dropOff > 0 && (
                                            <span className="text-xs text-red-500">
                                                ↓ {data.dropOff.toFixed(1)}% drop
                                            </span>
                                        )}
                                        <span className="text-sm font-semibold">
                                            {data.count}
                                        </span>
                                        <span className="text-xs text-muted-foreground w-12 text-right">
                                            {data.percentage.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                                <div className="h-6 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${bgColor} rounded-full transition-all duration-500`}
                                        style={{ width: `${Math.max(widthPercent, 2)}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Conversion Summary */}
                <div className="mt-6 pt-4 border-t">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-blue-600">
                                {funnelData[0]?.count || 0}
                            </div>
                            <div className="text-xs text-muted-foreground">Total Leads</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-emerald-600">
                                {funnelData[funnelData.length - 1]?.count || 0}
                            </div>
                            <div className="text-xs text-muted-foreground">Enrolled</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-purple-600">
                                {funnelData[0]?.count && funnelData[funnelData.length - 1]?.count
                                    ? ((funnelData[funnelData.length - 1].count / funnelData[0].count) * 100).toFixed(1)
                                    : 0}%
                            </div>
                            <div className="text-xs text-muted-foreground">Conversion Rate</div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

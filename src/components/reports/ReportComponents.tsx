'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { exportToCSV, ApplicationData, AgentPerformanceData, StageBreakdown, RTOBreakdown } from '@/lib/report-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ExportButtonProps {
  data: Record<string, unknown>[];
  filename: string;
  columns?: { key: string; label: string }[];
  disabled?: boolean;
}

export function ExportButton({ data, filename, columns, disabled }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 200));
      exportToCSV(data as Record<string, unknown>[], filename, columns as { key: keyof Record<string, unknown>; label: string }[]);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button variant="outline" size="sm" disabled={disabled || isExporting || data.length === 0} />
      }>
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF (coming soon)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// KPI Stats Card
interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  className?: string;
}

export function StatCard({ title, value, description, icon, trend, className }: StatCardProps) {
  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
            {trend && (
              <p className={`text-xs mt-2 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% from last period
              </p>
            )}
          </div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

// Agent Performance Table
interface AgentPerformanceTableProps {
  data: AgentPerformanceData[];
}

export function AgentPerformanceTable({ data }: AgentPerformanceTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Agent Performance Details</CardTitle>
        <ExportButton
          data={data.map(a => ({
            Name: a.name,
            'Total Applications': a.total,
            Enrolled: a.enrolled,
            Completed: a.completed,
            'Conversion Rate (%)': a.conversionRate,
          }))}
          filename="agent-performance"
          columns={[
            { key: 'Name', label: 'Agent Name' },
            { key: 'Total Applications', label: 'Total Applications' },
            { key: 'Enrolled', label: 'Enrolled' },
            { key: 'Completed', label: 'Completed' },
            { key: 'Conversion Rate (%)', label: 'Conversion Rate (%)' },
          ]}
        />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Agent</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Total</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Enrolled</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Completed</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 15).map((agent) => (
                <tr key={agent.partner_id} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-2 font-medium">{agent.name}</td>
                  <td className="py-3 px-2 text-right">{agent.total}</td>
                  <td className="py-3 px-2 text-right text-green-600">{agent.enrolled}</td>
                  <td className="py-3 px-2 text-right">{agent.completed}</td>
                  <td className="py-3 px-2 text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      agent.conversionRate >= 50 ? 'bg-green-100 text-green-700' :
                      agent.conversionRate >= 25 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {agent.conversionRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No agent data available for the selected period.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Financial Summary Card
interface FinancialSummaryCardProps {
  totalApplications: number;
  totalPotentialFees: number;
  enrolledFees: number;
  averageFeePerApplication: number;
}

export function FinancialSummaryCard({
  totalApplications,
  totalPotentialFees,
  enrolledFees,
  averageFeePerApplication,
}: FinancialSummaryCardProps) {
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Financial Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Applications</p>
            <p className="text-2xl font-bold">{totalApplications}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Potential Fees</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalPotentialFees)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Enrolled Fees</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(enrolledFees)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Avg Fee / App</p>
            <p className="text-2xl font-bold">{formatCurrency(averageFeePerApplication)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { generateComplianceReport } from '@/lib/services/compliance-report';
import { hasPermission } from '@/lib/services/permission-service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WORKFLOW_STAGE_LABELS, WorkflowStage, UserRole } from '@/types/database';

interface PageProps {
    searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function CompliancePage({ searchParams }: PageProps) {
    const params = await searchParams;
    const supabase = await createServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    // Get user role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    // Check permission using the database-backed RBAC system
    const userRole = profile?.role as UserRole | undefined;
    if (!userRole || !(await hasPermission(userRole, 'settings.manage'))) {
        redirect('/portal');
    }

    // Default to last 30 days if no date range specified
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const fromDate = params.from || thirtyDaysAgo.toISOString().split('T')[0];
    const toDate = params.to || today.toISOString().split('T')[0];

    // Generate report data
    const reportData = await generateComplianceReport(fromDate, toDate);
    return (
        <div className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
                        <p className="text-muted-foreground mt-1">
                            Review compliance reporting and audit data
                        </p>
                    </div>
                </div>
            </header>

            <main className="p-6 space-y-6">
                {/* Date Range Selector */}
                <Card>
                    <CardHeader>
                        <CardTitle>Report Period</CardTitle>
                        <CardDescription>Select the date range for the compliance report</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <label htmlFor="from" className="text-sm font-medium">From:</label>
                                <input
                                    type="date"
                                    id="from"
                                    name="from"
                                    defaultValue={fromDate}
                                    className="border rounded-md px-3 py-2 text-sm"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label htmlFor="to" className="text-sm font-medium">To:</label>
                                <input
                                    type="date"
                                    id="to"
                                    name="to"
                                    defaultValue={toDate}
                                    className="border rounded-md px-3 py-2 text-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
                            >
                                Update Report
                            </button>
                        </form>
                    </CardContent>
                </Card>

                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Applications
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{reportData.summary.totalApplications}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Audit Log Entries
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{reportData.auditLogs.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Active Partners
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{reportData.summary.byPartner.length}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Applications by Stage */}
                <Card>
                    <CardHeader>
                        <CardTitle>Applications by Workflow Stage</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {Object.entries(reportData.summary.byStage)
                                .filter(([, count]) => count > 0)
                                .map(([stage, count]) => (
                                    <div key={stage} className="bg-gray-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold">{count}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {WORKFLOW_STAGE_LABELS[stage as WorkflowStage]}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Document Status */}
                <Card>
                    <CardHeader>
                        <CardTitle>Document Compliance Status</CardTitle>
                        <CardDescription>
                            Applications with missing or unverified documents
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2 px-2 text-sm font-medium text-muted-foreground">Application</th>
                                        <th className="text-left py-2 px-2 text-sm font-medium text-muted-foreground">Student</th>
                                        <th className="text-center py-2 px-2 text-sm font-medium text-muted-foreground">Uploaded</th>
                                        <th className="text-center py-2 px-2 text-sm font-medium text-muted-foreground">Verified</th>
                                        <th className="text-left py-2 px-2 text-sm font-medium text-muted-foreground">Missing Documents</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.documentStatus.slice(0, 20).map((doc) => (
                                        <tr key={doc.application_uid} className="border-b">
                                            <td className="py-2 px-2 text-sm font-mono">{doc.application_uid}</td>
                                            <td className="py-2 px-2 text-sm">{doc.student_name}</td>
                                            <td className="py-2 px-2 text-sm text-center">{doc.documents_uploaded}</td>
                                            <td className="py-2 px-2 text-sm text-center">{doc.documents_verified}</td>
                                            <td className="py-2 px-2">
                                                {doc.missing_types.length === 0 ? (
                                                    <Badge className="bg-green-100 text-green-700">Complete</Badge>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {doc.missing_types.map(type => (
                                                            <Badge key={type} variant="outline" className="text-xs">
                                                                {type}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {reportData.documentStatus.length > 20 && (
                                <p className="text-sm text-muted-foreground mt-2 text-center">
                                    Showing 20 of {reportData.documentStatus.length} applications. Download CSV for full list.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

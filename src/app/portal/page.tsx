import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Building2,
    GraduationCap,
    FileText,
    TrendingUp,
    Clock,
    CheckCircle2,
    AlertCircle,
    DollarSign,
    Receipt,
    Wallet,
    Mail,
    ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { PriceListTable } from '@/components/dashboard/price-list-table';
import type { UserRole } from '@/types/database';
import { getPortalBaseForRole, withPortalBase } from '@/lib/routes/portal';
import { ACTIVE_RECORD_FILTER } from '@/lib/soft-delete';
import { DeploymentConfigErrorState } from '@/components/deployment-config-error-state';
import { isSupabaseConfigurationError } from '@/lib/supabase/config-error';

/* ─── Types ──────────────────────────────────────────────────────── */

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    description?: string;
    trend?: string;
    href?: string;
}

interface FinancialApplicationRow {
    quoted_tuition: number | null;
    total_paid: number | null;
}

interface AssignedAdminApplicationRow {
    id: string;
    student_uid: string;
    student_first_name: string;
    student_last_name: string;
    workflow_stage: string;
    created_at: string;
    updated_at: string;
}

interface AccountsManagerApplicationRow extends AssignedAdminApplicationRow {
    assessment_result: string;
    payment_status: string | null;
    xero_invoice_id: string | null;
    xero_bill_id: string | null;
    dispatch_approval_approved_at: string | null;
    dispatch_approval_approved_by: string | null;
}

interface DispatchCoordinatorApplicationRow extends AssignedAdminApplicationRow {
    docs_prepared_at: string | null;
    sent_at: string | null;
    delivery_method: string | null;
}

interface RecentApplicationRow {
    id: string;
    student_uid: string;
    student_first_name: string;
    student_last_name: string;
    workflow_stage: string;
}

/* ─── StatCard Component ─────────────────────────────────────────── */

function StatCard({ title, value, icon, description, trend, href }: StatCardProps) {
    const content = (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                <div className="text-muted-foreground">{icon}</div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {description && (
                    <CardDescription className="mt-1">{description}</CardDescription>
                )}
                {trend && (
                    <div className="flex items-center gap-1 mt-2">
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                        <span className="text-xs text-emerald-500">{trend}</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }
    return content;
}

function renderAccountsManagerDashboardContent(rows: AccountsManagerApplicationRow[], routeBase: string) {
    return <AccountsManagerDashboard rows={rows} routeBase={routeBase} />;
}

function renderDispatchCoordinatorDashboardContent(rows: DispatchCoordinatorApplicationRow[], routeBase: string) {
    return <DispatchCoordinatorDashboard rows={rows} routeBase={routeBase} />;
}

function renderAssessorDashboardContent(rows: AssignedAdminApplicationRow[], routeBase: string) {
    return <AssessorDashboard rows={rows} routeBase={routeBase} />;
}

function renderAdminDashboardContent(rows: AssignedAdminApplicationRow[], routeBase: string) {
    return <AdminDashboard rows={rows} routeBase={routeBase} />;
}

function renderDefaultPortalDashboard({
    routeBase,
    showFinancialCards,
    qualCount,
    appCount,
    recentApps,
    stageCountMap,
    totalPaid,
    outstanding,
    pipelineStages,
}: {
    routeBase: string;
    showFinancialCards: boolean;
    qualCount: number | null;
    appCount: number | null;
    recentApps: RecentApplicationRow[];
    stageCountMap: Record<string, number>;
    totalPaid: number;
    outstanding: number;
    pipelineStages: Array<{
        stage: string;
        key: string;
        icon: React.ComponentType<{ className?: string }>;
        color: string;
    }>;
}) {
    return (
        <div className="space-y-6">
            {/* Page header */}
            <div>
                <h2 className="text-lg font-semibold">Welcome back!</h2>
                <p className="text-sm text-muted-foreground">Here&apos;s your overview.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard
                    title="Qualifications"
                    value={qualCount || 0}
                    icon={<GraduationCap className="h-5 w-5" />}
                    description="Available courses"
                    href={withPortalBase(routeBase, 'qualifications')}
                />
                <StatCard
                    title="Applications"
                    value={appCount || 0}
                    icon={<FileText className="h-5 w-5" />}
                    description="Student applications"
                    href={withPortalBase(routeBase, 'applications')}
                />
            </div>

            {/* Financial Cards (second row) */}
            {showFinancialCards && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatCard
                        title="Total Revenue"
                        value={`$${totalPaid.toLocaleString()}`}
                        icon={<DollarSign className="h-5 w-5" />}
                        description="Payments received"
                    />
                    <StatCard
                        title="Outstanding"
                        value={`$${outstanding.toLocaleString()}`}
                        icon={<Wallet className="h-5 w-5" />}
                        description="Pending payments"
                    />
                </div>
            )}

            {/* Recent Applications */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Recent Applications</CardTitle>
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={withPortalBase(routeBase, 'applications')} />}>
                        View all <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent>
                    {recentApps.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student</TableHead>
                                    <TableHead>UID</TableHead>
                                    <TableHead className="text-right">Stage</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentApps.map((app) => (
                                    <TableRow key={app.id} className="cursor-pointer">
                                        <TableCell>
                                            <Link href={withPortalBase(routeBase, `applications/${app.id}`)} className="flex items-center gap-3 hover:underline">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                    <span className="text-xs font-medium text-primary">
                                                        {app.student_first_name?.[0]}{app.student_last_name?.[0]}
                                                    </span>
                                                </div>
                                                <span className="font-medium">
                                                    {app.student_first_name} {app.student_last_name}
                                                </span>
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{app.student_uid}</TableCell>
                                        <TableCell className="text-right">
                                            <StageBadge stage={app.workflow_stage} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No applications yet</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Application Pipeline */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Application Pipeline</CardTitle>
                    <CardDescription>Workflow stage breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4">
                        {pipelineStages.map((item) => (
                            <div key={item.stage} className="text-center">
                                <div className={`w-12 h-12 ${item.color} rounded-xl mx-auto flex items-center justify-center mb-2`}>
                                    <item.icon className="h-6 w-6 text-white" />
                                </div>
                                <p className="text-xs text-muted-foreground">{item.stage}</p>
                                <p className="text-lg font-semibold">{stageCountMap[item.key] || 0}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Price List Section */}
            <PriceListTable />
        </div>
    );
}

/* ─── Stage badge helper ─────────────────────────────────────────── */

const stageColors: Record<string, string> = {
    TRANSFERRED: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
    docs_review: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    enrolled: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
    evaluate: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    accounts: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
    dispatch: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
    completed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

function StageBadge({ stage }: { stage: string }) {
    return (
        <Badge variant="secondary" className={stageColors[stage] || 'bg-gray-100'}>
            {stage.replace(/_/g, ' ')}
        </Badge>
    );
}

/* ─── Accounts Manager Dashboard ─────────────────────────────────── */

function AccountsManagerDashboard({
    rows,
    routeBase,
}: {
    rows: AccountsManagerApplicationRow[];
    routeBase: string;
}) {
    const invoiceReadyCount = rows.filter((app) => Boolean(app.xero_invoice_id)).length;
    const billReadyCount = rows.filter((app) => Boolean(app.xero_bill_id)).length;
    const readyToDispatchCount = rows.filter((app) => {
        const hasApproval = Boolean(app.dispatch_approval_approved_at && app.dispatch_approval_approved_by);
        return Boolean(app.xero_invoice_id) && Boolean(app.xero_bill_id) && (app.payment_status === 'paid' || hasApproval);
    }).length;
    const recentFinanceQueue = rows.slice(0, 6);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Accounts Manager Dashboard</h2>
                <p className="text-sm text-muted-foreground">
                    Process passed applications in Accounts, create Xero records, and hand off to Dispatch.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                    title="Finance Queue"
                    value={rows.length}
                    icon={<FileText className="h-5 w-5" />}
                    description="Passed Accounts applications"
                    href={withPortalBase(routeBase, 'applications')}
                />
                <StatCard
                    title="Invoices Created"
                    value={invoiceReadyCount}
                    icon={<Receipt className="h-5 w-5" />}
                    description="Applications with Xero invoice"
                    href={withPortalBase(routeBase, 'applications')}
                />
                <StatCard
                    title="Bills Created"
                    value={billReadyCount}
                    icon={<Wallet className="h-5 w-5" />}
                    description="Applications with Xero bill"
                    href={withPortalBase(routeBase, 'applications')}
                />
                <StatCard
                    title="Ready for Dispatch"
                    value={readyToDispatchCount}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    description="Bill and invoice complete, paid or approved"
                    href={withPortalBase(routeBase, 'applications')}
                />
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Recent Finance Queue</CardTitle>
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={withPortalBase(routeBase, 'applications')} />}>
                        View all <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent>
                    {recentFinanceQueue.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student</TableHead>
                                    <TableHead>UID</TableHead>
                                    <TableHead className="text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentFinanceQueue.map((app) => (
                                    <TableRow key={app.id} className="cursor-pointer">
                                        <TableCell>
                                            <Link href={withPortalBase(routeBase, `applications/${app.id}`)} className="font-medium hover:underline">
                                                {app.student_first_name} {app.student_last_name}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{app.student_uid}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Badge variant="secondary">Pass</Badge>
                                                <Badge variant="outline">
                                                    {app.xero_invoice_id && app.xero_bill_id
                                                        ? (app.payment_status === 'paid' || (app.dispatch_approval_approved_at && app.dispatch_approval_approved_by)
                                                            ? 'Ready to dispatch'
                                                            : 'Awaiting payment')
                                                        : 'Finance pending'}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No passed Accounts applications right now</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

/* ─── Dispatch Coordinator Dashboard ─────────────────────────────── */

function DispatchCoordinatorDashboard({
    rows,
    routeBase,
}: {
    rows: DispatchCoordinatorApplicationRow[];
    routeBase: string;
}) {
    const dispatchQueueCount = rows.filter((app) => app.workflow_stage === 'dispatch').length;
    const certificateReadyCount = rows.filter((app) => Boolean(app.docs_prepared_at)).length;
    const emailedCount = rows.filter((app) => Boolean(app.sent_at)).length;
    const completedCount = rows.filter((app) => app.workflow_stage === 'completed').length;
    const recentDispatchQueue = rows.slice(0, 6);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Dispatch Coordinator Dashboard</h2>
                <p className="text-sm text-muted-foreground">
                    Upload certificate PDFs, email applicants, and complete dispatch-ready applications.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                    title="Dispatch Queue"
                    value={dispatchQueueCount}
                    icon={<FileText className="h-5 w-5" />}
                    description="Applications awaiting completion"
                    href={withPortalBase(routeBase, 'certificates')}
                />
                <StatCard
                    title="Certificate Uploaded"
                    value={certificateReadyCount}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    description="Dispatch files prepared"
                    href={withPortalBase(routeBase, 'certificates')}
                />
                <StatCard
                    title="Applicant Emailed"
                    value={emailedCount}
                    icon={<Mail className="h-5 w-5" />}
                    description="Certificate sent by email"
                    href={withPortalBase(routeBase, 'certificates')}
                />
                <StatCard
                    title="Completed"
                    value={completedCount}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    description="Finished dispatch applications"
                    href={withPortalBase(routeBase, 'certificates')}
                />
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Recent Dispatch Applications</CardTitle>
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={withPortalBase(routeBase, 'certificates')} />}>
                        View all <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent>
                    {recentDispatchQueue.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student</TableHead>
                                    <TableHead>UID</TableHead>
                                    <TableHead className="text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentDispatchQueue.map((app) => (
                                    <TableRow key={app.id} className="cursor-pointer">
                                        <TableCell>
                                            <Link href={withPortalBase(routeBase, `applications/${app.id}`)} className="font-medium hover:underline">
                                                {app.student_first_name} {app.student_last_name}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{app.student_uid}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Badge variant="outline">
                                                    {app.docs_prepared_at ? 'Certificate ready' : 'Needs certificate'}
                                                </Badge>
                                                <StageBadge stage={app.workflow_stage} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No dispatch applications right now</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

/* ─── Assessor Dashboard ─────────────────────────────────────────── */

function AssessorDashboard({
    rows,
    routeBase,
}: {
    rows: AssignedAdminApplicationRow[];
    routeBase: string;
}) {
    const enrolledCount = rows.filter((app) => app.workflow_stage === 'enrolled').length;
    const evaluateCount = rows.filter((app) => app.workflow_stage === 'evaluate').length;
    const completedCount = rows.filter((app) => app.workflow_stage === 'completed').length;
    const recentAssigned = rows.slice(0, 6);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Assessor Dashboard</h2>
                <p className="text-sm text-muted-foreground">
                    Review assigned applications, set appointment dates, and complete evaluation outcomes.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                    title="Assigned Applications"
                    value={rows.length}
                    icon={<FileText className="h-5 w-5" />}
                    description="Applications assigned to you"
                    href={withPortalBase(routeBase, 'applications')}
                />
                <StatCard
                    title="Awaiting Intake"
                    value={enrolledCount}
                    icon={<Clock className="h-5 w-5" />}
                    description="Enrolled applications"
                    href={withPortalBase(routeBase, 'applications')}
                />
                <StatCard
                    title="In Evaluation"
                    value={evaluateCount}
                    icon={<AlertCircle className="h-5 w-5" />}
                    description="Ready for pass or failed"
                    href={withPortalBase(routeBase, 'applications')}
                />
                <StatCard
                    title="Completed"
                    value={completedCount}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    description="Finished applications"
                    href={withPortalBase(routeBase, 'applications')}
                />
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Recent Assigned Applications</CardTitle>
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={withPortalBase(routeBase, 'applications')} />}>
                        View all <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent>
                    {recentAssigned.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student</TableHead>
                                    <TableHead>UID</TableHead>
                                    <TableHead className="text-right">Stage</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentAssigned.map((app) => (
                                    <TableRow key={app.id} className="cursor-pointer">
                                        <TableCell>
                                            <Link href={withPortalBase(routeBase, `applications/${app.id}`)} className="font-medium hover:underline">
                                                {app.student_first_name} {app.student_last_name}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{app.student_uid}</TableCell>
                                        <TableCell className="text-right">
                                            <StageBadge stage={app.workflow_stage} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No assigned applications yet</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

/* ─── Admin Dashboard ────────────────────────────────────────────── */

function AdminDashboard({
    rows,
    routeBase,
}: {
    rows: AssignedAdminApplicationRow[];
    routeBase: string;
}) {
    const docsReviewCount = rows.filter((app) => app.workflow_stage === 'docs_review').length;
    const enrolledCount = rows.filter((app) => app.workflow_stage === 'enrolled').length;
    const recentAssigned = rows.slice(0, 6);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Admin Dashboard</h2>
                <p className="text-sm text-muted-foreground">
                    Manage assigned applications from Docs Review to Enrolled.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    title="Assigned Applications"
                    value={rows.length}
                    icon={<FileText className="h-5 w-5" />}
                    description="Applications assigned to you"
                    href={withPortalBase(routeBase, 'applications')}
                />
                <StatCard
                    title="Docs Review"
                    value={docsReviewCount}
                    icon={<AlertCircle className="h-5 w-5" />}
                    description="Pending admin tasks"
                    href={withPortalBase(routeBase, 'applications')}
                />
                <StatCard
                    title="Enrolled"
                    value={enrolledCount}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    description="Completed applications"
                    href={withPortalBase(routeBase, 'applications')}
                />
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Recent Assigned Applications</CardTitle>
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={withPortalBase(routeBase, 'applications')} />}>
                        View all <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent>
                    {recentAssigned.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student</TableHead>
                                    <TableHead>UID</TableHead>
                                    <TableHead className="text-right">Stage</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentAssigned.map((app) => (
                                    <TableRow key={app.id} className="cursor-pointer">
                                        <TableCell>
                                            <Link href={withPortalBase(routeBase, `applications/${app.id}`)} className="font-medium hover:underline">
                                                {app.student_first_name} {app.student_last_name}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{app.student_uid}</TableCell>
                                        <TableCell className="text-right">
                                            <StageBadge stage={app.workflow_stage} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No assigned applications yet</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

/* ─── Main Dashboard Page ────────────────────────────────────────── */

export default async function PortalDashboard() {
    try {
        const supabase = await createServerClient();

        const { data: { user } } = await supabase.auth.getUser();
        const role = user
            ? (
                await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .maybeSingle<{ role: UserRole }>()
            ).data?.role || null
            : null;
        const routeBase = getPortalBaseForRole(role);
        const showFinancialCards = role !== 'executive_manager';

        /* ── Accounts Manager ─────────────────── */
        if (role === 'accounts_manager' && user) {
            const { data: financeApplications } = await supabase
                .from('applications')
                .select('id, student_uid, student_first_name, student_last_name, workflow_stage, assessment_result, payment_status, xero_invoice_id, xero_bill_id, dispatch_approval_approved_at, dispatch_approval_approved_by, created_at, updated_at')
                .or(ACTIVE_RECORD_FILTER)
                .eq('workflow_stage', 'accounts')
                .eq('assessment_result', 'pass')
                .order('updated_at', { ascending: false });

            return renderAccountsManagerDashboardContent((financeApplications || []) as AccountsManagerApplicationRow[], routeBase);
        }

        /* ── Dispatch Coordinator ─────────────── */
        if (role === 'dispatch_coordinator' && user) {
            const { data: dispatchApplications } = await supabase
                .from('applications')
                .select('id, student_uid, student_first_name, student_last_name, workflow_stage, docs_prepared_at, sent_at, delivery_method, created_at, updated_at')
                .or(ACTIVE_RECORD_FILTER)
                .in('workflow_stage', ['dispatch', 'completed'])
                .order('updated_at', { ascending: false });

            return renderDispatchCoordinatorDashboardContent((dispatchApplications || []) as DispatchCoordinatorApplicationRow[], routeBase);
        }

        /* ── Assessor ─────────────────────────── */
        if (role === 'assessor' && user) {
            const { data: assignedApplications } = await supabase
                .from('applications')
                .select('id, student_uid, student_first_name, student_last_name, workflow_stage, created_at, updated_at')
                .eq('assigned_assessor_id', user.id)
                .or(ACTIVE_RECORD_FILTER)
                .order('updated_at', { ascending: false });

            return renderAssessorDashboardContent((assignedApplications || []) as AssignedAdminApplicationRow[], routeBase);
        }

        /* ── Admin ────────────────────────────── */
        if (role === 'admin' && user) {
            const { data: assignedApplications } = await supabase
                .from('applications')
                .select('id, student_uid, student_first_name, student_last_name, workflow_stage, created_at, updated_at')
                .eq('assigned_admin_id', user.id)
                .or(ACTIVE_RECORD_FILTER)
                .order('updated_at', { ascending: false });

            return renderAdminDashboardContent((assignedApplications || []) as AssignedAdminApplicationRow[], routeBase);
        }

        /* ── Default / CEO / Executive Manager Dashboard ─── */
        const [
            { count: qualCount },
            { count: appCount },
            { data: recentApps },
            { data: stageCounts },
            { data: agentApps },
        ] = await Promise.all([
            supabase.from('qualifications').select('*', { count: 'exact', head: true }),
            supabase.from('applications').select('*', { count: 'exact', head: true }).or(ACTIVE_RECORD_FILTER),
            supabase
                .from('applications')
                .select(`
        id,
        student_uid,
        student_first_name,
        student_last_name,
        workflow_stage,
        created_at,
        offering:rto_offerings(
          qualification:qualifications(name)
        )
      `)
                .or(ACTIVE_RECORD_FILTER)
                .order('created_at', { ascending: false })
                .limit(5),
            supabase.from('applications').select('workflow_stage').or(ACTIVE_RECORD_FILTER),
            showFinancialCards
                ? supabase.from('applications').select('quoted_tuition, total_paid').or(ACTIVE_RECORD_FILTER)
                : Promise.resolve({ data: [] as FinancialApplicationRow[] }),
        ]);

    // Calculate stage counts
    const stageCountMap: Record<string, number> = {};
    if (stageCounts) {
        stageCounts.forEach((app) => {
            const stage = app.workflow_stage;
            stageCountMap[stage] = (stageCountMap[stage] || 0) + 1;
        });
    }

    let totalQuoted = 0;
    let totalPaid = 0;
    if (showFinancialCards && agentApps) {
        agentApps.forEach((app) => {
            totalQuoted += Number(app.quoted_tuition) || 0;
            totalPaid += Number(app.total_paid) || 0;
        });
    }
    const outstanding = totalQuoted - totalPaid;

        const pipelineStages = [
            { stage: 'Transferred', key: 'TRANSFERRED', icon: ArrowRight, color: 'bg-cyan-500' },
            { stage: 'Docs Review', key: 'docs_review', icon: AlertCircle, color: 'bg-yellow-500' },
            { stage: 'Enrolled', key: 'enrolled', icon: GraduationCap, color: 'bg-emerald-500' },
            { stage: 'Evaluate', key: 'evaluate', icon: Building2, color: 'bg-amber-500' },
            { stage: 'Accounts', key: 'accounts', icon: Wallet, color: 'bg-violet-500' },
            { stage: 'Dispatch', key: 'dispatch', icon: Wallet, color: 'bg-indigo-500' },
            { stage: 'Completed', key: 'completed', icon: CheckCircle2, color: 'bg-slate-500' },
        ];

        return renderDefaultPortalDashboard({
            routeBase,
            showFinancialCards,
            qualCount,
            appCount,
            recentApps: (recentApps || []) as RecentApplicationRow[],
            stageCountMap,
            totalPaid,
            outstanding,
            pipelineStages,
        });
    } catch (error) {
        if (isSupabaseConfigurationError(error)) {
            return (
                <DeploymentConfigErrorState
                    error={error}
                    title="Portal unavailable"
                    navHref="/login"
                    navLabel="Go to Login"
                    debugContext={{ page: 'src/app/portal/page.tsx' }}
                />
            );
        }

        throw error;
    }
}

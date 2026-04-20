import { createServerClient } from '@/lib/supabase/server';
import { redirect, unstable_rethrow } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    FileText,
    Upload,
    AlertTriangle,
    CheckCircle2,
    ArrowRight,
} from 'lucide-react';
import { WORKFLOW_STAGE_LABELS, WORKFLOW_STAGE_COLORS, type WorkflowStage } from '@/types/database';
import { ACTIVE_RECORD_FILTER } from '@/lib/soft-delete';
import { DeploymentConfigErrorState } from '@/components/deployment-config-error-state';
import { isSupabaseConfigurationError } from '@/lib/supabase/config-error';

interface DashboardApplicationRow {
    id: string;
    student_uid: string;
    student_first_name: string;
    student_last_name: string;
    workflow_stage: WorkflowStage;
    created_at: string;
    partner: {
        company_name: string;
    } | {
        company_name: string;
    }[] | null;
}

function asSinglePartner(value: DashboardApplicationRow['partner']): { company_name: string } | null {
    if (!value) return null;
    return Array.isArray(value) ? value[0] || null : value;
}

export default async function FrontdeskDashboardPage() {
    let totalPipeline = 0;
    let docsReviewCount = 0;
    let enrolledCount = 0;
    let needsAttentionCount = 0;
    let applications: DashboardApplicationRow[] = [];

    try {
        const supabase = await createServerClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            redirect('/login');
        }

        const [
            { count: totalPipelineResult },
            { count: docsReviewCountResult },
            { count: enrolledCountResult },
            { count: needsAttentionCountResult },
            { data: recentApplications },
        ] = await Promise.all([
            supabase.from('applications').select('id', { count: 'exact', head: true }).or(ACTIVE_RECORD_FILTER),
            supabase.from('applications').select('id', { count: 'exact', head: true }).or(ACTIVE_RECORD_FILTER).eq('workflow_stage', 'docs_review'),
            supabase.from('applications').select('id', { count: 'exact', head: true }).or(ACTIVE_RECORD_FILTER).eq('workflow_stage', 'enrolled'),
            supabase.from('applications').select('id', { count: 'exact', head: true }).or(ACTIVE_RECORD_FILTER).eq('needs_attention', true),
            supabase
                .from('applications')
                .select('id, student_uid, student_first_name, student_last_name, workflow_stage, created_at, partner:partners(company_name)')
                .or(ACTIVE_RECORD_FILTER)
                .order('created_at', { ascending: false })
                .limit(8),
        ]);

        totalPipeline = totalPipelineResult || 0;
        docsReviewCount = docsReviewCountResult || 0;
        enrolledCount = enrolledCountResult || 0;
        needsAttentionCount = needsAttentionCountResult || 0;
        applications = (recentApplications || []) as DashboardApplicationRow[];
    } catch (error) {
        unstable_rethrow(error);

        if (isSupabaseConfigurationError(error)) {
            return (
                <DeploymentConfigErrorState
                    error={error}
                    title="Frontdesk unavailable"
                    navHref="/login"
                    navLabel="Go to Login"
                    debugContext={{ page: 'src/app/frontdesk/page.tsx' }}
                />
            );
        }

        throw error;
    }

    return (
        <main className="flex-1 overflow-y-auto">
            <header className="bg-card border-b border-border px-4 md:px-6 py-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-semibold text-foreground">Frontdesk Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Application processing overview and document follow-ups.
                    </p>
                </div>
            </header>

            <div className="p-4 md:p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Active Pipeline
                            </CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{totalPipeline}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Docs Review
                            </CardTitle>
                            <Upload className="h-4 w-4 text-yellow-600" />
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-yellow-700">{docsReviewCount}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Docs Review
                            </CardTitle>
                            <FileText className="h-4 w-4 text-yellow-600" />
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-yellow-700">{docsReviewCount}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Enrolled
                            </CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-emerald-700">{enrolledCount}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Needs Attention
                            </CardTitle>
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-red-700">{needsAttentionCount}</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Recent Applications</CardTitle>
                        <Link
                            href="/frontdesk/applications"
                            className="text-sm text-cyan-600 hover:text-cyan-700 inline-flex items-center"
                        >
                            View all
                            <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {applications.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No applications available.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {applications.map((application) => {
                                    const partner = asSinglePartner(application.partner);

                                    return (
                                        <Link
                                            key={application.id}
                                            href={`/frontdesk/applications/${application.id}`}
                                            className="block rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-medium text-sm">
                                                        {application.student_first_name} {application.student_last_name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {application.student_uid}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Agent: {partner?.company_name || '-'}
                                                    </p>
                                                </div>
                                                <Badge className={WORKFLOW_STAGE_COLORS[application.workflow_stage]}>
                                                    {WORKFLOW_STAGE_LABELS[application.workflow_stage]}
                                                </Badge>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}

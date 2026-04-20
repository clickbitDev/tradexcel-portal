'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DocumentUpload } from '@/components/documents/document-upload';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import { AgentEnrollmentTasksPanel } from '@/components/applications/AgentEnrollmentTasksPanel';
import { WorkflowProgressBar } from '@/components/workflow/WorkflowProgressBar';
import { WorkflowTimelineFeed } from '@/components/workflow/WorkflowTimelineFeed';
import {
    WORKFLOW_STAGE_LABELS,
    WORKFLOW_STAGE_COLORS,
    type Application,
    type Document,
    type WorkflowStage,
} from '@/types/database';
import { resolveApplicationId } from '@/lib/application-identifiers';
import { WORKFLOW_DETAILS_STAGE_ORDER } from '@/lib/workflow-transitions';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { getDocumentAccessUrl as fetchDocumentAccessUrl } from '@/lib/storage';
import { formatAppointmentDateTime as formatAppointmentDateTimeValue } from '@/lib/date-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ArrowLeft,
    Building2,
    Download,
    Eye,
    FileText,
    Loader2,
} from 'lucide-react';

interface ApplicationWithRelations extends Application {
    qualification?: {
        id: string;
        name: string;
        code: string;
        level: string | null;
    } | {
        id: string;
        name: string;
        code: string;
        level: string | null;
    }[] | null;
    offering?: {
        id: string;
        duration_weeks: number | null;
        qualification?: {
            id: string;
            name: string;
            code: string;
            level: string | null;
        } | null;
        rto?: {
            id: string;
            name: string;
            code: string | null;
            logo_url: string | null;
        } | null;
    } | null;
    partner?: {
        id: string;
        company_name: string;
        type: string;
    } | null;
}

interface AgentTaskStateSnapshot {
    workflow_stage: WorkflowStage;
    updated_at: string;
    agent_frontdesk_notified: boolean;
    agent_frontdesk_notified_at: string | null;
}

function formatDate(value: string | null | undefined): string {
    if (!value) {
        return '-';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return '-';
    }

    return parsed.toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) {
        return '-';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return '-';
    }

    return parsed.toLocaleString('en-AU', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

function getApplicationQualification(application: ApplicationWithRelations | null): {
    id: string;
    name: string;
    code: string;
    level: string | null;
} | null {
    if (!application) {
        return null;
    }

    if (application.offering?.qualification) {
        return application.offering.qualification;
    }

    const qualification = application.qualification;
    if (!qualification) {
        return null;
    }

    return Array.isArray(qualification) ? qualification[0] || null : qualification;
}

export default function AgentApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();
    const { can } = usePermissions();

    const [application, setApplication] = useState<ApplicationWithRelations | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
    const [documentPreviewOpen, setDocumentPreviewOpen] = useState(false);
    const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);
    const [feedRefreshKey, setFeedRefreshKey] = useState(0);

    const fetchData = useCallback(async () => {
        setLoading(true);

        try {
            const { data: auth } = await supabase.auth.getUser();
            const user = auth.user;

            if (!user) {
                router.replace('/login');
                return;
            }

            const { data: app, error: appError } = await supabase
                .from('applications')
                .select(`
                    *,
                    qualification:qualifications(id, name, code, level),
                    offering:rto_offerings(
                        id,
                        duration_weeks,
                        qualification:qualifications(id, name, code, level),
                        rto:rtos(id, name, code, logo_url)
                    ),
                    partner:partners(id, company_name, type)
                `)
                .eq('id', id)
                .eq('created_by', user.id)
                .maybeSingle<ApplicationWithRelations>();

            if (appError || !app) {
                setApplication(null);
                setDocuments([]);
                return;
            }

            setApplication(app);

            const documentsResult = await supabase
                .from('documents')
                .select('*')
                .eq('application_id', id)
                .order('created_at', { ascending: false });

            setDocuments((documentsResult.data || []) as Document[]);
        } finally {
            setLoading(false);
        }
    }, [id, router, supabase]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const triggerFeedRefresh = () => {
        setFeedRefreshKey((value) => value + 1);
    };

    const refreshAllData = useCallback(async () => {
        await fetchData();
        triggerFeedRefresh();
    }, [fetchData]);

    const handleTaskStateUpdate = useCallback((taskState: AgentTaskStateSnapshot) => {
        setApplication((previous) => {
            if (!previous) {
                return previous;
            }

            return {
                ...previous,
                ...taskState,
                workflow_stage: taskState.workflow_stage,
                updated_at: taskState.updated_at,
            };
        });
        triggerFeedRefresh();
    }, []);

    const handleOpenDocumentPreview = (documentRecord: Document) => {
        setSelectedDocument(documentRecord);
        setDocumentPreviewOpen(true);
    };

    const handleDownloadDocument = async (documentRecord: Document) => {
        setDownloadingDocumentId(documentRecord.id);
        try {
            const accessUrl = await fetchDocumentAccessUrl(documentRecord.id);
            const response = await fetch(accessUrl);

            if (!response.ok) {
                throw new Error('Unable to fetch document.');
            }

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = window.document.createElement('a');
            link.href = blobUrl;
            link.download = documentRecord.file_name || 'document';
            window.document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch {
            toast.error('Unable to download document right now.');
        } finally {
            setDownloadingDocumentId(null);
        }
    };

    if (loading) {
        return (
            <main className="flex-1 flex items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </main>
        );
    }

    if (!application) {
        return (
            <div className="flex-1 p-6">
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                    <h2 className="text-lg font-semibold text-destructive">Application Not Found</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        This application does not exist or you do not have permission to access it.
                    </p>
                    <Link href="/portal/agent/applications">
                        <Button variant="outline" className="mt-4">
                            Back to Applications
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    const qualification = getApplicationQualification(application);
    const canEditApplication = application.workflow_stage === 'docs_review';
    const canManageTasks = application.workflow_stage === 'docs_review';

    return (
        <main className="flex-1 overflow-y-auto">
            <header className="border-b bg-card px-4 py-4 md:px-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/portal/agent/applications">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-xl font-semibold text-foreground md:text-2xl">
                                    {resolveApplicationId(application.application_number, application.student_uid)}
                                </h1>
                                <Badge className={WORKFLOW_STAGE_COLORS[application.workflow_stage]}>
                                    {WORKFLOW_STAGE_LABELS[application.workflow_stage]}
                                </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {application.student_first_name} {application.student_last_name}
                            </p>
                        </div>
                    </div>

                    {canEditApplication ? (
                        <div className="flex items-center gap-2">
                            <Link href={`/portal/agent/applications/${id}/edit`}>
                                <Button variant="outline">Edit Application</Button>
                            </Link>
                        </div>
                    ) : null}
                </div>
            </header>

            <div className="p-4 md:p-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        <Tabs defaultValue="overview">
                            <TabsList>
                                <TabsTrigger value="overview">Overview</TabsTrigger>
                                <TabsTrigger value="documents" className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Documents ({documents.length})
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="overview" className="mt-6 space-y-6">
                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                    <Card>
                                        <CardHeader className="border-b bg-blue-50">
                                            <CardTitle className="text-lg">Application Information</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <table className="w-full text-sm">
                                                <tbody>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Application ID</td>
                                                        <td className="px-4 py-2 font-medium">
                                                            {resolveApplicationId(application.application_number, application.student_uid)}
                                                        </td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Qualification</td>
                                                        <td className="px-4 py-2 font-medium">{qualification?.name || '-'}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Qualification Code</td>
                                                        <td className="px-4 py-2 font-mono">{qualification?.code || '-'}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">RTO</td>
                                                        <td className="px-4 py-2 font-medium">{application.offering?.rto?.name || '-'}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Workflow Stage</td>
                                                        <td className="px-4 py-2 font-medium">{WORKFLOW_STAGE_LABELS[application.workflow_stage]}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Payment Status</td>
                                                        <td className="px-4 py-2 font-medium">{application.payment_status || '-'}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Appointment Date</td>
                                                        <td className="px-4 py-2 font-medium">{formatAppointmentDateTimeValue(application.appointment_date, application.appointment_time)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="px-4 py-2 text-muted-foreground">Last Updated</td>
                                                        <td className="px-4 py-2 font-medium">{formatDateTime(application.updated_at)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="border-b bg-amber-50">
                                            <CardTitle className="text-lg">Student Information</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <table className="w-full text-sm">
                                                <tbody>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Full Name</td>
                                                        <td className="px-4 py-2 font-medium">
                                                            {application.student_first_name} {application.student_last_name}
                                                        </td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Email</td>
                                                        <td className="px-4 py-2 font-medium">{application.student_email || '-'}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Phone</td>
                                                        <td className="px-4 py-2 font-medium">{application.student_phone || '-'}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Date of Birth</td>
                                                        <td className="px-4 py-2 font-medium">{formatDate(application.student_dob)}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Nationality</td>
                                                        <td className="px-4 py-2 font-medium">{application.student_nationality || '-'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="px-4 py-2 text-muted-foreground">Passport Number</td>
                                                        <td className="px-4 py-2 font-medium">{application.student_passport_number || '-'}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </CardContent>
                                    </Card>
                                </div>

                            </TabsContent>

                            <TabsContent value="documents" className="mt-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Documents</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        {can('documents.upload') ? (
                                            <DocumentUpload
                                                applicationId={id}
                                                onUploadComplete={(documentRecord) => {
                                                    setDocuments((previous) => [documentRecord as Document, ...previous]);
                                                    triggerFeedRefresh();
                                                }}
                                            />
                                        ) : null}

                                        {documents.length > 0 ? (
                                            <div className="space-y-3">
                                                {documents.map((documentRecord) => (
                                                    <div key={documentRecord.id} className="flex items-center justify-between rounded-lg border p-3">
                                                        <div>
                                                            <p className="text-sm font-medium">{documentRecord.file_name}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {documentRecord.document_type} • {formatDateTime(documentRecord.created_at)}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {documentRecord.is_verified ? (
                                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                                                                    Verified
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                                                                    Pending Review
                                                                </Badge>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleOpenDocumentPreview(documentRecord)}
                                                                title="View document"
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => void handleDownloadDocument(documentRecord)}
                                                                disabled={downloadingDocumentId === documentRecord.id}
                                                                title="Download document"
                                                            >
                                                                {downloadingDocumentId === documentRecord.id ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Download className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-8 text-center text-muted-foreground">
                                                <FileText className="mx-auto mb-2 h-10 w-10 opacity-50" />
                                                <p>No documents uploaded yet.</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                        </Tabs>
                    </div>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-muted-foreground">Workflow</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Current stage</span>
                                    <Badge className={WORKFLOW_STAGE_COLORS[application.workflow_stage]}>
                                        {WORKFLOW_STAGE_LABELS[application.workflow_stage]}
                                    </Badge>
                                </div>
                                <WorkflowProgressBar
                                    currentStage={application.workflow_stage}
                                    stageOrder={WORKFLOW_DETAILS_STAGE_ORDER}
                                />
                            </CardContent>
                        </Card>

                        <AgentEnrollmentTasksPanel
                            applicationId={id}
                            workflowStage={application.workflow_stage}
                            canEdit={canManageTasks}
                            studentName={`${application.student_first_name || ''} ${application.student_last_name || ''}`.trim()}
                            frontdeskNotified={application.agent_frontdesk_notified}
                            frontdeskNotifiedAt={application.agent_frontdesk_notified_at}
                            onTaskStateUpdate={handleTaskStateUpdate}
                            onRefresh={() => {
                                void refreshAllData();
                            }}
                        />

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-muted-foreground">Timeline</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <WorkflowTimelineFeed applicationId={id} refreshKey={feedRefreshKey} />
                            </CardContent>
                        </Card>

                        {application.partner ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Agent</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-3 rounded-lg p-2">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                            <Building2 className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{application.partner.company_name}</p>
                                            <p className="text-xs capitalize text-muted-foreground">{application.partner.type}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : null}
                    </div>
                </div>
            </div>

            <DocumentPreview
                open={documentPreviewOpen}
                onOpenChange={setDocumentPreviewOpen}
                document={selectedDocument}
            />
        </main>
    );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    Download,
    ExternalLink,
    Eye,
    FilePlus2,
    Loader2,
    Mail,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { getPortalRouteBase, withPortalBase } from '@/lib/routes/portal';
import { getDocumentAccessUrl } from '@/lib/storage';
import {
    type CertificateGenerationJobSummary,
    DEFAULT_CERTIFICATE_STANDARD,
    TRANSCRIPT_RESULT_OPTIONS,
    type CertificateDraftPayload,
    type CertificateQueueItem,
    type CertificateTranscriptRow,
} from '@/lib/certificates/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type QueueStatusFilter = 'all' | 'missing' | 'generated' | 'emailed';
type QueueStageFilter = 'all' | 'dispatch' | 'completed';
type CertificateGenerationMutationResponse = {
    data?: {
        job?: CertificateGenerationJobSummary;
        alreadyQueued?: boolean;
    };
    error?: string;
} | null;

const CERTIFICATE_MANAGE_ROLES = new Set(['ceo', 'developer', 'executive_manager', 'admin', 'dispatch_coordinator']);

function formatDate(value: string | null | undefined): string {
    if (!value) {
        return '-';
    }

    return new Date(value).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) {
        return '-';
    }

    return new Date(value).toLocaleString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function createDefaultTranscriptRow(issueDate: string, sortOrder: number): CertificateTranscriptRow {
    return {
        qualificationUnitId: null,
        unitCode: '',
        unitTitle: '',
        result: 'Competent',
        year: issueDate.slice(0, 4),
        included: true,
        sortOrder,
    };
}

function reorderRows(rows: CertificateTranscriptRow[]): CertificateTranscriptRow[] {
    return rows.map((row, index) => ({
        ...row,
        sortOrder: index,
    }));
}

function buildDefaultCertificateEmail(item: CertificateQueueItem): { subject: string; body: string } {
    return {
        subject: `Your certificate for application ${item.applicationNumber}`,
        body: [
            `Dear ${item.studentName},`,
            '',
            'Please find your certificate attached to this email.',
            '',
            `Application ID: ${item.applicationNumber}`,
            '',
            'Kind regards,',
            'Edward Business College',
        ].join('\n'),
    };
}

function isJobActive(job: CertificateGenerationJobSummary | null | undefined): boolean {
    return job?.status === 'queued' || job?.status === 'processing';
}

function getJobStatusLabel(job: CertificateGenerationJobSummary | null | undefined): string | null {
    if (!job) {
        return null;
    }

    if (job.status === 'queued') {
        return 'Queued';
    }

    if (job.status === 'processing') {
        return 'Generating';
    }

    if (job.status === 'failed') {
        return 'Failed';
    }

    if (job.status === 'completed') {
        return 'Completed';
    }

    return 'Cancelled';
}

function mergeJobIntoItems(items: CertificateQueueItem[], job: CertificateGenerationJobSummary): CertificateQueueItem[] {
    return items.map((item) => {
        if (item.applicationId !== job.applicationId) {
            return item;
        }

        return {
            ...item,
            latestJob: job,
            latestCertificate: job.certificate || item.latestCertificate,
        };
    });
}

async function openSignedDocument(documentId: string, mode: 'preview' | 'download', fileName?: string | null) {
    const accessUrl = await getDocumentAccessUrl(documentId);

    if (mode === 'preview') {
        window.open(accessUrl, '_blank', 'noopener,noreferrer');
        return;
    }

    const response = await fetch(accessUrl);
    if (!response.ok) {
        throw new Error('Unable to download the generated certificate.');
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = blobUrl;
    link.download = fileName || 'certificate.pdf';
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
}

export function CertificatesClientPage() {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { can, loading: permissionsLoading, role } = usePermissions();
    const routeBase = getPortalRouteBase(pathname, role);
    const requestedApplicationId = searchParams.get('applicationId');
    const canManageCertificates = Boolean(role && CERTIFICATE_MANAGE_ROLES.has(role) && can('certificates.manage'));

    const [items, setItems] = useState<CertificateQueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [stageFilter, setStageFilter] = useState<QueueStageFilter>('all');
    const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>('all');

    const [composerOpen, setComposerOpen] = useState(false);
    const [composerLoading, setComposerLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [draft, setDraft] = useState<CertificateDraftPayload | null>(null);
    const [issueDate, setIssueDate] = useState('');
    const [standard, setStandard] = useState(DEFAULT_CERTIFICATE_STANDARD);
    const [scope, setScope] = useState('');
    const [auditRef, setAuditRef] = useState('');
    const [includeTranscript, setIncludeTranscript] = useState(false);
    const [transcriptRows, setTranscriptRows] = useState<CertificateTranscriptRow[]>([]);

    const [emailOpen, setEmailOpen] = useState(false);
    const [emailing, setEmailing] = useState(false);
    const [emailItem, setEmailItem] = useState<CertificateQueueItem | null>(null);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [pendingJobId, setPendingJobId] = useState<string | null>(null);
    const [handledRequestedApplicationId, setHandledRequestedApplicationId] = useState<string | null>(null);
    const [clearingQueue, setClearingQueue] = useState(false);
    const [restartingJobId, setRestartingJobId] = useState<string | null>(null);

    const loadQueue = useCallback(async (showRefreshing = false) => {
        if (showRefreshing) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const response = await fetch('/api/certificates', { cache: 'no-store' });
            const payload = await response.json().catch(() => null) as { data?: CertificateQueueItem[]; error?: string } | null;

            if (!response.ok) {
                throw new Error(payload?.error || 'Unable to load certificates.');
            }

            setItems(payload?.data || []);
        } catch (error) {
            toast.error('Unable to load certificates', {
                description: error instanceof Error ? error.message : 'Please try again.',
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (permissionsLoading) {
            return;
        }

        if (!can('certificates.view')) {
            return;
        }

        void loadQueue();
    }, [can, loadQueue, permissionsLoading]);

    useEffect(() => {
        if (pendingJobId) {
            return;
        }

        const activeJob = items.find((item) => isJobActive(item.latestJob))?.latestJob;
        if (activeJob) {
            setPendingJobId(activeJob.id);
        }
    }, [items, pendingJobId]);

    useEffect(() => {
        if (!pendingJobId) {
            return;
        }

        let cancelled = false;
        let timer: number | null = null;

        const poll = async () => {
            try {
                const response = await fetch(`/api/certificates/jobs/${pendingJobId}`, { cache: 'no-store' });
                const payload = await response.json().catch(() => null) as { data?: CertificateGenerationJobSummary; error?: string } | null;

                if (!response.ok || !payload?.data) {
                    throw new Error(payload?.error || 'Unable to load certificate generation status.');
                }

                if (cancelled) {
                    return;
                }

                setItems((previous) => mergeJobIntoItems(previous, payload.data as CertificateGenerationJobSummary));

                if (payload.data.status === 'completed') {
                    toast.success('Certificate generated', {
                        description: payload.data.certificateNumber
                            ? `Certificate ${payload.data.certificateNumber} is ready.`
                            : 'The certificate PDF has been generated.',
                    });
                    setPendingJobId(null);
                    void loadQueue(true);
                    return;
                }

                if (payload.data.status === 'failed' || payload.data.status === 'cancelled') {
                    toast.error('Certificate generation failed', {
                        description: payload.data.lastError || 'Please try again.',
                    });
                    setPendingJobId(null);
                    void loadQueue(true);
                    return;
                }

                timer = window.setTimeout(() => {
                    void poll();
                }, 2_000);
            } catch (error) {
                if (cancelled) {
                    return;
                }

                toast.error('Unable to refresh certificate status', {
                    description: error instanceof Error ? error.message : 'Please refresh and try again.',
                });
                setPendingJobId(null);
            }
        };

        void poll();

        return () => {
            cancelled = true;
            if (timer !== null) {
                window.clearTimeout(timer);
            }
        };
    }, [loadQueue, pendingJobId]);

    const filteredItems = useMemo(() => {
        const search = searchTerm.trim().toLowerCase();

        return items.filter((item) => {
            if (stageFilter !== 'all' && item.workflowStage !== stageFilter) {
                return false;
            }

            if (statusFilter === 'missing' && item.latestCertificate) {
                return false;
            }

            if (statusFilter === 'generated' && (!item.latestCertificate || item.sentAt)) {
                return false;
            }

            if (statusFilter === 'emailed' && !item.sentAt) {
                return false;
            }

            if (!search) {
                return true;
            }

            return [
                item.studentName,
                item.studentUid,
                item.applicationNumber,
                item.qualificationCode || '',
                item.qualificationName || '',
                item.latestCertificate?.certificateNumber || '',
            ].some((value) => value.toLowerCase().includes(search));
        });
    }, [items, searchTerm, stageFilter, statusFilter]);

    const openComposer = useCallback(async (item: CertificateQueueItem) => {
        setComposerOpen(true);
        setComposerLoading(true);
        setDraft(null);

        try {
            const response = await fetch(`/api/certificates/applications/${item.applicationId}/draft`, { cache: 'no-store' });
            const payload = await response.json().catch(() => null) as { data?: CertificateDraftPayload; error?: string } | null;

            if (!response.ok || !payload?.data) {
                throw new Error(payload?.error || 'Unable to load the certificate draft.');
            }

            setDraft(payload.data);
            setIssueDate(payload.data.defaults.issueDate);
            setStandard(payload.data.defaults.standard);
            setScope(payload.data.defaults.scope);
            setAuditRef(payload.data.defaults.auditRef);
            setTranscriptRows(reorderRows(payload.data.transcriptRows));
            setIncludeTranscript(payload.data.latestCertificate?.includesTranscript || false);
        } catch (error) {
            toast.error('Unable to open certificate composer', {
                description: error instanceof Error ? error.message : 'Please try again.',
            });
            setComposerOpen(false);
        } finally {
            setComposerLoading(false);
        }
    }, []);

    useEffect(() => {
        if (permissionsLoading || loading || !requestedApplicationId || handledRequestedApplicationId === requestedApplicationId) {
            return;
        }

        if (!canManageCertificates) {
            setHandledRequestedApplicationId(requestedApplicationId);
            void router.replace('/portal/certificates', { scroll: false });
            return;
        }

        const targetItem = items.find((item) => item.applicationId === requestedApplicationId) || null;
        if (!targetItem) {
            setHandledRequestedApplicationId(requestedApplicationId);
            toast.error('Unable to open certificate composer', {
                description: 'Certificates can only be generated for Dispatch or Completed applications.',
            });
            void router.replace('/portal/certificates', { scroll: false });
            return;
        }

        setHandledRequestedApplicationId(requestedApplicationId);
        void openComposer(targetItem);
        void router.replace('/portal/certificates', { scroll: false });
    }, [
        canManageCertificates,
        handledRequestedApplicationId,
        items,
        loading,
        openComposer,
        permissionsLoading,
        requestedApplicationId,
        router,
    ]);

    const updateTranscriptRow = useCallback((index: number, patch: Partial<CertificateTranscriptRow>) => {
        setTranscriptRows((previous) => previous.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
    }, []);

    const addTranscriptRow = useCallback(() => {
        setTranscriptRows((previous) => reorderRows([
            ...previous,
            createDefaultTranscriptRow(issueDate || new Date().toISOString().slice(0, 10), previous.length),
        ]));
    }, [issueDate]);

    const removeTranscriptRow = useCallback((index: number) => {
        setTranscriptRows((previous) => reorderRows(previous.filter((_, rowIndex) => rowIndex !== index)));
    }, []);

    const handleGenerate = useCallback(async () => {
        if (!draft) {
            return;
        }

        setGenerating(true);

        try {
            const response = await fetch('/api/certificates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    applicationId: draft.application.id,
                    issueDate,
                    standard,
                    scope,
                    auditRef,
                    includeTranscript,
                    transcriptRows,
                }),
            });

            const payload = await response.json().catch(() => null) as CertificateGenerationMutationResponse;
            if (!response.ok) {
                throw new Error(payload?.error || 'Unable to generate this certificate.');
            }

            const job = payload?.data?.job;
            if (!job) {
                throw new Error('The portal did not return a certificate generation job.');
            }

            setItems((previous) => mergeJobIntoItems(previous, job));
            setPendingJobId(job.id);
            setComposerOpen(false);
            setDraft(null);

            if (payload?.data?.alreadyQueued) {
                toast.success('Certificate generation is already in progress.', {
                    description: job.certificateNumber
                        ? `We resumed tracking job ${job.certificateNumber}.`
                        : 'The existing job is still being processed.',
                });
                return;
            }

            toast.success('Certificate generation queued', {
                description: job.certificateNumber
                    ? `Certificate ${job.certificateNumber} has been queued for generation.`
                    : 'The certificate job has been queued.',
            });
        } catch (error) {
            toast.error('Certificate generation failed', {
                description: error instanceof Error ? error.message : 'Please try again.',
            });
        } finally {
            setGenerating(false);
        }
    }, [auditRef, draft, includeTranscript, issueDate, scope, standard, transcriptRows]);

    const handleClearQueue = useCallback(async () => {
        if (!canManageCertificates) {
            toast.error('You do not have permission to clear certificate jobs.');
            return;
        }

        if (!window.confirm('Clear all queued certificate generation jobs? Processing jobs will be left untouched.')) {
            return;
        }

        setClearingQueue(true);

        try {
            const response = await fetch('/api/certificates/jobs/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const payload = await response.json().catch(() => null) as { data?: { clearedCount?: number }; error?: string } | null;

            if (!response.ok) {
                throw new Error(payload?.error || 'Unable to clear queued certificate jobs.');
            }

            setPendingJobId(null);
            await loadQueue(true);
            toast.success('Queued certificate jobs cleared', {
                description: `${payload?.data?.clearedCount ?? 0} queued job(s) were cancelled.`,
            });
        } catch (error) {
            toast.error('Unable to clear queue', {
                description: error instanceof Error ? error.message : 'Please try again.',
            });
        } finally {
            setClearingQueue(false);
        }
    }, [canManageCertificates, loadQueue]);

    const handleRestartJob = useCallback(async (item: CertificateQueueItem) => {
        if (!item.latestJob) {
            return;
        }

        if (!canManageCertificates) {
            toast.error('You do not have permission to restart certificate jobs.');
            return;
        }

        setRestartingJobId(item.latestJob.id);

        try {
            const response = await fetch(`/api/certificates/jobs/${item.latestJob.id}/restart`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const payload = await response.json().catch(() => null) as {
                data?: { job?: CertificateGenerationJobSummary; restartedFromJobId?: string };
                error?: string;
            } | null;

            if (!response.ok || !payload?.data?.job) {
                throw new Error(payload?.error || 'Unable to restart certificate generation.');
            }

            setItems((previous) => mergeJobIntoItems(previous, payload.data!.job!));
            setPendingJobId(payload.data.job.id);
            toast.success('Certificate generation restarted', {
                description: payload.data.job.certificateNumber
                    ? `Job restarted for certificate ${payload.data.job.certificateNumber}.`
                    : 'A new certificate generation job has been queued.',
            });
        } catch (error) {
            toast.error('Unable to restart certificate generation', {
                description: error instanceof Error ? error.message : 'Please try again.',
            });
        } finally {
            setRestartingJobId(null);
        }
    }, [canManageCertificates]);

    const openEmailDialog = useCallback((item: CertificateQueueItem) => {
        if (!item.studentEmail) {
            toast.error('Student email is required before sending a certificate.');
            return;
        }

        if (!item.latestCertificate?.documentId) {
            toast.error('Generate a certificate before sending it by email.');
            return;
        }

        const defaults = buildDefaultCertificateEmail(item);
        setEmailItem(item);
        setEmailSubject(defaults.subject);
        setEmailBody(defaults.body);
        setEmailOpen(true);
    }, []);

    const handlePreviewDocument = useCallback(async (item: CertificateQueueItem) => {
        if (!item.latestCertificate?.documentId) {
            return;
        }

        try {
            await openSignedDocument(item.latestCertificate.documentId, 'preview');
        } catch (error) {
            toast.error('Unable to preview certificate', {
                description: error instanceof Error ? error.message : 'Please try again.',
            });
        }
    }, []);

    const handleDownloadDocument = useCallback(async (item: CertificateQueueItem) => {
        if (!item.latestCertificate?.documentId) {
            return;
        }

        try {
            await openSignedDocument(item.latestCertificate.documentId, 'download', item.latestCertificate.documentFileName);
        } catch (error) {
            toast.error('Unable to download certificate', {
                description: error instanceof Error ? error.message : 'Please try again.',
            });
        }
    }, []);

    const handleDownloadUnlocked = useCallback(async (item: CertificateQueueItem) => {
        if (!item.latestCertificate?.id) {
            return;
        }

        try {
            const response = await fetch(`/api/certificates/${item.latestCertificate.id}/download/unlocked`);
            if (!response.ok) {
                throw new Error('Unable to download unlocked certificate');
            }

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = window.document.createElement('a');
            link.href = blobUrl;
            link.download = `${item.latestCertificate.certificateNumber}_Unlocked.pdf`;
            window.document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            toast.error('Unable to download unlocked certificate', {
                description: error instanceof Error ? error.message : 'Please try again.',
            });
        }
    }, []);

    const handleSendEmail = useCallback(async () => {
        if (!emailItem?.latestCertificate?.documentId) {
            return;
        }

        setEmailing(true);

        try {
            const response = await fetch(`/api/applications/${emailItem.applicationId}/dispatch-tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'send_certificate_email',
                    subject: emailSubject,
                    body: emailBody,
                    documentIds: [emailItem.latestCertificate.documentId],
                }),
            });

            const payload = await response.json().catch(() => null) as { error?: string } | null;
            if (!response.ok) {
                throw new Error(payload?.error || 'Unable to send the certificate email.');
            }

            toast.success('Certificate email sent to the student.');
            setEmailOpen(false);
            setEmailItem(null);
            await loadQueue(true);
        } catch (error) {
            toast.error('Unable to send certificate email', {
                description: error instanceof Error ? error.message : 'Please try again.',
            });
        } finally {
            setEmailing(false);
        }
    }, [emailBody, emailItem, emailSubject, loadQueue]);

    const statValues = useMemo(() => ({
        dispatch: items.filter((item) => item.workflowStage === 'dispatch').length,
        generated: items.filter((item) => Boolean(item.latestCertificate)).length,
        transcript: items.filter((item) => item.latestCertificate?.includesTranscript).length,
        emailed: items.filter((item) => Boolean(item.sentAt)).length,
    }), [items]);

    const queuedJobsCount = useMemo(
        () => items.filter((item) => item.latestJob?.status === 'queued').length,
        [items]
    );

    if (!permissionsLoading && !can('certificates.view')) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">Certificates access is restricted</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Ask an administrator to grant `certificates.view` for your role.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Certificates</h1>
                    <p className="text-sm text-muted-foreground">
                        Generate Edward-only certificate PDFs, prepare transcript pages, and send certificate emails.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => void handleClearQueue()}
                        disabled={!canManageCertificates || clearingQueue || queuedJobsCount === 0}
                    >
                        {clearingQueue ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Clear Queue
                    </Button>
                    <Button variant="outline" onClick={() => void loadQueue(true)} disabled={refreshing || loading}>
                        {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Dispatch Queue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-semibold">{statValues.dispatch}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Generated</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-semibold">{statValues.generated}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">With Transcript</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-semibold">{statValues.transcript}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Emailed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-semibold">{statValues.emailed}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <CardTitle>Certificate Queue</CardTitle>
                    </div>
                    <div className="grid w-full gap-3 md:grid-cols-3 lg:max-w-4xl">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Search applications or certificate numbers"
                                className="pl-9"
                            />
                        </div>
                        <Select value={stageFilter} onValueChange={(value) => setStageFilter(value as QueueStageFilter)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Stage" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All stages</SelectItem>
                                <SelectItem value="dispatch">Dispatch</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as QueueStatusFilter)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="missing">Needs certificate</SelectItem>
                                <SelectItem value="generated">Generated not emailed</SelectItem>
                                <SelectItem value="emailed">Emailed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredItems.length > 0 ? (
                        <div className="overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Student</TableHead>
                                        <TableHead>Qualification</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Latest Certificate</TableHead>
                                        <TableHead>Issue Date</TableHead>
                                        <TableHead>Emailed</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredItems.map((item) => {
                                        const activeJob = isJobActive(item.latestJob);
                                        const jobStatusLabel = getJobStatusLabel(item.latestJob);
                                        const canRestartJob = Boolean(item.latestJob && ['queued', 'failed', 'cancelled'].includes(item.latestJob.status));

                                        return (
                                            <TableRow key={item.applicationId}>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <Link href={withPortalBase(routeBase, `applications/${item.applicationId}`)} className="font-medium hover:underline">
                                                            {item.studentName}
                                                        </Link>
                                                        <p className="text-xs text-muted-foreground">
                                                            {item.applicationNumber} • {item.studentUid}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <p className="font-medium">{item.qualificationName || '-'}</p>
                                                        <p className="text-xs text-muted-foreground">{item.qualificationCode || 'No code'}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Badge variant="outline">{item.workflowStage}</Badge>
                                                        <Badge
                                                            variant={
                                                                item.latestJob?.status === 'failed'
                                                                    ? 'destructive'
                                                                    : activeJob
                                                                        ? 'default'
                                                                        : item.latestCertificate
                                                                            ? 'secondary'
                                                                            : 'outline'
                                                            }
                                                        >
                                                            {jobStatusLabel || (item.latestCertificate ? 'Generated' : 'Needs certificate')}
                                                        </Badge>
                                                        {item.latestCertificate?.includesTranscript ? <Badge>Transcript</Badge> : null}
                                                    </div>
                                                    {item.latestJob?.status === 'failed' && item.latestJob.lastError ? (
                                                        <p className="mt-2 max-w-sm text-xs text-destructive">
                                                            {item.latestJob.lastError}
                                                        </p>
                                                    ) : null}
                                                </TableCell>
                                                <TableCell>
                                                    {item.latestCertificate ? (
                                                        <div className="space-y-1">
                                                            <p className="font-medium">{item.latestCertificate.certificateNumber}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                v{item.latestCertificate.version} • {formatDateTime(item.latestCertificate.generatedAt)}
                                                            </p>
                                                            {activeJob ? (
                                                                <p className="text-xs text-muted-foreground">
                                                                    Replacement job queued at {formatDateTime(item.latestJob?.queuedAt)}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    ) : item.latestJob ? (
                                                        <div className="space-y-1">
                                                            <p className="font-medium">{item.latestJob.certificateNumber || 'Pending certificate'}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {jobStatusLabel} • queued {formatDateTime(item.latestJob.queuedAt)}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{formatDate(item.latestCertificate?.issueDate || item.issueDate)}</TableCell>
                                                <TableCell>{formatDate(item.sentAt)}</TableCell>
                                                <TableCell>
                                                    <div className="flex justify-end gap-2">
                                                        {canRestartJob ? (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => void handleRestartJob(item)}
                                                                disabled={!canManageCertificates || restartingJobId === item.latestJob?.id}
                                                            >
                                                                {restartingJobId === item.latestJob?.id ? (
                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <RefreshCw className="mr-2 h-4 w-4" />
                                                                )}
                                                                Restart
                                                            </Button>
                                                        ) : null}
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => void openComposer(item)}
                                                            disabled={activeJob || !canManageCertificates}
                                                            title={!canManageCertificates ? 'You do not have permission to generate certificates.' : undefined}
                                                        >
                                                            <FilePlus2 className="mr-2 h-4 w-4" />
                                                            {activeJob ? 'Queued' : item.latestCertificate ? 'Regenerate' : 'Generate'}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => void handlePreviewDocument(item)}
                                                            disabled={!item.latestCertificate?.documentId}
                                                            title="Preview certificate"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => void handleDownloadDocument(item)}
                                                            disabled={!item.latestCertificate?.documentId}
                                                            title="Download certificate"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </Button>
                                                        {can('certificates.manage') && (
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                onClick={() => void handleDownloadUnlocked(item)}
                                                                disabled={!item.latestCertificate?.id}
                                                                title="Download unlocked (admin)"
                                                            >
                                                                <ShieldCheck className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => openEmailDialog(item)}
                                                            disabled={!item.latestCertificate?.documentId || !item.studentEmail || activeJob}
                                                            title="Email certificate"
                                                        >
                                                            <Mail className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => item.latestCertificate?.verificationUrl && window.open(item.latestCertificate.verificationUrl, '_blank', 'noopener,noreferrer')}
                                                            disabled={!item.latestCertificate?.verificationUrl}
                                                            title="Open verification page"
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="py-16 text-center text-sm text-muted-foreground">
                            No applications match the current certificate filters.
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={composerOpen} onOpenChange={(open) => !generating && setComposerOpen(open)}>
                <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>{draft?.latestCertificate ? 'Regenerate Certificate' : 'Generate Certificate'}</DialogTitle>
                        <DialogDescription>
                            {draft
                                ? `${draft.application.studentName} • ${draft.application.qualificationName}`
                                : 'Prepare the certificate and transcript payload.'}
                        </DialogDescription>
                    </DialogHeader>

                    {composerLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : draft ? (
                        <div className="space-y-6 overflow-y-auto pr-2">
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <div className="space-y-2">
                                    <Label htmlFor="certificate-issue-date">Issue Date</Label>
                                    <Input id="certificate-issue-date" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
                                </div>
                                <div className="space-y-2 xl:col-span-3">
                                    <Label htmlFor="certificate-standard">Standard</Label>
                                    <Input id="certificate-standard" value={standard} onChange={(event) => setStandard(event.target.value)} />
                                </div>
                                <div className="space-y-2 md:col-span-2 xl:col-span-2">
                                    <Label htmlFor="certificate-scope">Scope</Label>
                                    <Textarea id="certificate-scope" value={scope} onChange={(event) => setScope(event.target.value)} rows={3} />
                                </div>
                                <div className="space-y-2 md:col-span-2 xl:col-span-2">
                                    <Label htmlFor="certificate-audit-ref">Audit Reference</Label>
                                    <Input id="certificate-audit-ref" value={auditRef} onChange={(event) => setAuditRef(event.target.value)} />
                                </div>
                            </div>

                            <div className="rounded-md border bg-muted/20 p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="font-medium">Transcript / Unit Results</p>
                                        <p className="text-sm text-muted-foreground">
                                            Edward transcript pages are generated from the rows below. Qualification units are prefilled for manual confirmation.
                                        </p>
                                    </div>
                                    <label className="flex items-center gap-2 text-sm font-medium">
                                        <Checkbox checked={includeTranscript} onCheckedChange={(value) => setIncludeTranscript(Boolean(value))} />
                                        Include transcript
                                    </label>
                                </div>

                                <div className="mt-4 flex justify-between gap-2">
                                    <p className="text-xs text-muted-foreground">
                                        Included rows: {transcriptRows.filter((row) => row.included).length}
                                    </p>
                                    <Button type="button" variant="outline" size="sm" onClick={addTranscriptRow}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Custom Row
                                    </Button>
                                </div>

                                <div className="mt-4 max-h-[420px] overflow-auto rounded-md border bg-background">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-16">Use</TableHead>
                                                <TableHead className="w-[160px]">Unit Code</TableHead>
                                                <TableHead>Unit Title</TableHead>
                                                <TableHead className="w-[210px]">Result</TableHead>
                                                <TableHead className="w-[110px]">Year</TableHead>
                                                <TableHead className="w-[70px]" />
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {transcriptRows.map((row, index) => (
                                                <TableRow key={`${row.qualificationUnitId || 'custom'}-${index}`}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={row.included}
                                                            onCheckedChange={(value) => updateTranscriptRow(index, { included: Boolean(value) })}
                                                            disabled={!includeTranscript}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            value={row.unitCode}
                                                            onChange={(event) => updateTranscriptRow(index, { unitCode: event.target.value })}
                                                            disabled={!includeTranscript || Boolean(row.qualificationUnitId)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            value={row.unitTitle}
                                                            onChange={(event) => updateTranscriptRow(index, { unitTitle: event.target.value })}
                                                            disabled={!includeTranscript || Boolean(row.qualificationUnitId)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select
                                                            value={row.result}
                                                            onValueChange={(value) => updateTranscriptRow(index, { result: value as CertificateTranscriptRow['result'] })}
                                                            disabled={!includeTranscript}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {TRANSCRIPT_RESULT_OPTIONS.map((option) => (
                                                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            value={row.year}
                                                            onChange={(event) => updateTranscriptRow(index, { year: event.target.value.replace(/[^0-9]/g, '').slice(0, 4) })}
                                                            disabled={!includeTranscript}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {row.qualificationUnitId ? null : (
                                                            <Button type="button" size="icon" variant="ghost" onClick={() => removeTranscriptRow(index)} disabled={!includeTranscript}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {transcriptRows.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                                                        No qualification units were found. Add custom transcript rows if you need a record of results.
                                                    </TableCell>
                                                </TableRow>
                                            ) : null}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setComposerOpen(false)} disabled={generating}>Cancel</Button>
                        <Button onClick={() => void handleGenerate()} disabled={generating || composerLoading || !draft}>
                            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />}
                            Generate Certificate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={emailOpen} onOpenChange={(open) => !emailing && setEmailOpen(open)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Email Certificate</DialogTitle>
                        <DialogDescription>
                            Send the latest certificate PDF to {emailItem?.studentName || 'the student'}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="certificate-email-subject">Subject</Label>
                            <Input id="certificate-email-subject" value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="certificate-email-body">Message</Label>
                            <Textarea id="certificate-email-body" rows={8} value={emailBody} onChange={(event) => setEmailBody(event.target.value)} />
                        </div>
                        <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                            Attachment: {emailItem?.latestCertificate?.documentFileName || 'Latest generated certificate PDF'}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEmailOpen(false)} disabled={emailing}>Cancel</Button>
                        <Button onClick={() => void handleSendEmail()} disabled={emailing || !emailItem?.latestCertificate?.documentId}>
                            {emailing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                            Send Certificate Email
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

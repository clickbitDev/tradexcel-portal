'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useRecordLock } from '@/hooks/use-record-lock';
import { LockIndicator, LockBanner } from '@/components/ui/lock-indicator';
import { DocumentUpload } from '@/components/documents/document-upload';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import { VersionHistory, ActivityFeed, ArchiveActions, DeleteActions, RecordStatusBadges } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { TimePickerField } from '@/components/ui/time-picker-field';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MentionTextarea, CommentContent } from '@/components/ui/mention-textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { WorkflowActionPanel } from '@/components/workflow/WorkflowActionPanel';
import { WorkflowConflictBanner } from '@/components/workflow/WorkflowConflictBanner';
import { WorkflowProgressBar } from '@/components/workflow/WorkflowProgressBar';
import { WorkflowStatusBadge } from '@/components/workflow/WorkflowStatusBadge';
import { WorkflowTimelineFeed } from '@/components/workflow/WorkflowTimelineFeed';
import {
    WORKFLOW_STAGE_LABELS,
} from '@/components/workflow/constants';
import {
    ArrowLeft,
    Activity,
    User,
    Building2,
    CalendarDays,
    Mail,
    FileText,
    MessageSquare,
    History,
    CheckCircle,
    Clock,
    AlertCircle,
    Loader2,
    Send,
    Download,
    Eye,
    FilePlus2,
    Pencil,
    Receipt,
    ShieldAlert,
    XCircle,
} from 'lucide-react';
import Link from 'next/link';
import type {
    Application,
    Document,
    ApplicationComment,
    ApplicationHistory,
    AssessmentResult,
    AssessmentReportVenue,
    AssessmentReportVirtualPlatform,
} from '@/types/database';
import {
    ASSESSMENT_RESULT_COLORS,
    ASSESSMENT_RESULT_LABELS,
    DOCUMENT_TYPES,
} from '@/types/database';
import type { ApplicationFieldMapping } from '@/lib/extraction/types';
import { logActivity } from '@/lib/activity-logger';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { RtoPaymentSection } from '@/components/applications/RtoPaymentSection';
import { ApplicationFeeSection } from '@/components/applications/ApplicationFeeSection';
import { AdminDocsReviewTasksPanel } from '@/components/applications/AdminDocsReviewTasksPanel';
import { resolveApplicationId } from '@/lib/application-identifiers';
import { useGetTransitionOptionsQuery } from '@/store/services/workflowApi';
import {
    getWorkflowErrorFromPayload,
    getWorkflowErrorFromUnknown,
} from '@/lib/workflow/error-messages';
import { getPortalRouteBase } from '@/lib/routes/portal';
import { BRAND_NAME } from '@/lib/brand';
import { WORKFLOW_DETAILS_STAGE_ORDER } from '@/lib/workflow-transitions';
import { getDocumentAccessUrl as fetchDocumentAccessUrl } from '@/lib/storage';
import { hydrateApplicationRelations } from '@/lib/applications/hydration';
import { isActiveRecord } from '@/lib/soft-delete';
import {
    formatAppointmentDateTime as formatAppointmentDateTimeValue,
    formatDate as formatDateValue,
    formatDateInput as formatDateInputValue,
    formatDateTime as formatDateTimeValue,
    formatTimeInput as formatTimeInputValue,
} from '@/lib/date-utils';
import {
    renderEmailTemplate,
    WELCOME_EMAIL_TO_APPLICATION_TEMPLATE_NAME,
} from '@/lib/email-templates/presets';

const STAGE_LABELS = WORKFLOW_STAGE_LABELS;

const STANDARD_DOCUMENT_UPLOAD_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
];

const STAFF_ROLES = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'developer',
];

const CERTIFICATE_MANAGE_ROLES = new Set(['ceo', 'developer', 'executive_manager', 'admin', 'dispatch_coordinator']);
const ACCOUNTS_TAB_ROLES = new Set(['ceo', 'developer', 'accounts_manager']);
const ASSESSMENT_REPORT_VIEW_ROLES = new Set(['ceo', 'developer', 'admin']);
const EVALUATION_READY_STAGES: Application['workflow_stage'][] = ['evaluate', 'accounts', 'dispatch', 'completed'];
const ASSESSMENT_REPORT_VENUE_LABELS: Record<AssessmentReportVenue, string> = {
    on_campus: 'On campus (Edward Business College)',
    virtual: 'Virtual',
};
const ASSESSMENT_REPORT_PLATFORM_LABELS: Record<AssessmentReportVirtualPlatform, string> = {
    google_meet: 'Google Meet',
    zoom: 'Zoom',
};

const APPLICATION_DETAILS_SELECT = `
  *
`;

interface ApplicationWithRelations extends Application {
    xero_invoice_id?: string | null;
    xero_invoice_number?: string | null;
    xero_invoice_status?: string | null;
    xero_invoice_url?: string | null;
    xero_bill_id?: string | null;
    xero_bill_number?: string | null;
    xero_bill_status?: string | null;
    xero_bill_url?: string | null;
    xero_last_synced_at?: string | null;
    qualification?: { id: string; code: string; name: string } | null;
    offering?: {
        qualification?: { id: string; code: string; name: string };
        rto?: { id: string; code: string; name: string };
        tuition_fee_onshore: number | null;
        tuition_fee_miscellaneous: number | null;
        material_fee: number | null;
        application_fee: number | null;
        agent_fee: number | null;
        assessor_fee: number | null;
    };
    partner?: {
        id: string;
        company_name: string;
        type: string;
        email?: string | null;
        user_id?: string | null;
        parent_partner_id?: string | null;
    };
    // Profile relations for user-reference fields
    received_by_profile?: { full_name: string };
    last_updated_by_profile?: { full_name: string };
    assigned_staff_profile?: { full_name: string };
    assigned_by_profile?: { full_name: string };
    signed_off_by_profile?: { full_name: string };
    docs_prepared_by_profile?: { full_name: string };
    docs_checked_by_profile?: { full_name: string };
    docs_approved_by_profile?: { full_name: string };
    sent_by_profile?: { full_name: string };
    delivered_by_profile?: { full_name: string };
    created_by_profile?: { full_name: string };
    assigned_assessor_profile?: { full_name: string };
    assigned_admin_profile?: { full_name: string };
}

interface AssignableStaffOption {
    id: string;
    role: string;
}

function getApplicationQualification(application: ApplicationWithRelations | null | undefined) {
    return application?.offering?.qualification || application?.qualification || null;
}

function getAssessorStepBadge(completed: boolean, current: boolean, unlocked: boolean) {
    if (completed) {
        return {
            label: 'Completed',
            className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
        };
    }

    if (current) {
        return {
            label: 'Current',
            className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800',
        };
    }

    if (!unlocked) {
        return {
            label: 'Locked',
            className: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
        };
    }

    return {
        label: 'Pending',
        className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    };
}

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [application, setApplication] = useState<ApplicationWithRelations | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [comments, setComments] = useState<ApplicationComment[]>([]);
    const [history, setHistory] = useState<ApplicationHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);
    const [workflowBannerMessage, setWorkflowBannerMessage] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [emailTemplates, setEmailTemplates] = useState<Array<{ id: string; name: string; subject: string; body: string }>>([]);
    const [loadingEmailTemplates, setLoadingEmailTemplates] = useState(false);
    const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState('__none__');
    const [sendingEmail, setSendingEmail] = useState(false);
    const [missingDocsDialogOpen, setMissingDocsDialogOpen] = useState(false);
    const [selectedMissingDocuments, setSelectedMissingDocuments] = useState<string[]>([]);
    const [missingDocsNote, setMissingDocsNote] = useState('');
    const [sendingMissingDocsEmail, setSendingMissingDocsEmail] = useState(false);
    const [previewingMissingDocsEmail, setPreviewingMissingDocsEmail] = useState(false);
    const [adminEnrollmentConfirmOpen, setAdminEnrollmentConfirmOpen] = useState(false);
    const [confirmingEnrollment, setConfirmingEnrollment] = useState(false);
    const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);
    const [missingDocsEmailPreview, setMissingDocsEmailPreview] = useState<{
        recipient: string;
        subject: string;
        body: string;
    } | null>(null);
    const [documentPreviewOpen, setDocumentPreviewOpen] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
    const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);
    const [xeroConnected, setXeroConnected] = useState(false);
    const [checkingXeroConnection, setCheckingXeroConnection] = useState(true);
    const [xeroStatusError, setXeroStatusError] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);
    const [assessorAppointmentDialogOpen, setAssessorAppointmentDialogOpen] = useState(false);
    const [assessorAppointmentDate, setAssessorAppointmentDate] = useState('');
    const [assessorAppointmentTime, setAssessorAppointmentTime] = useState('');
    const [savingAssessorAppointmentDate, setSavingAssessorAppointmentDate] = useState(false);
    const [movingToEvaluate, setMovingToEvaluate] = useState(false);
    const [savingAssessmentResult, setSavingAssessmentResult] = useState<AssessmentResult | null>(null);
    const [adminAccountsConfirmOpen, setAdminAccountsConfirmOpen] = useState(false);
    const [movingToAccounts, setMovingToAccounts] = useState(false);
    const [accountsDispatchConfirmOpen, setAccountsDispatchConfirmOpen] = useState(false);
    const [movingToDispatch, setMovingToDispatch] = useState(false);
    const [requestingDispatchApproval, setRequestingDispatchApproval] = useState(false);
    const [approvingDispatchApproval, setApprovingDispatchApproval] = useState(false);
    const [dispatchCompleteConfirmOpen, setDispatchCompleteConfirmOpen] = useState(false);
    const [completingDispatch, setCompletingDispatch] = useState(false);
    const [selectedStudentEmailDocumentIds, setSelectedStudentEmailDocumentIds] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [activeAssessorWorkflowStep, setActiveAssessorWorkflowStep] = useState('step-1');
    const [assessmentReportForm, setAssessmentReportForm] = useState({
        evaluationDate: '',
        startTime: '',
        endTime: '',
        venue: 'on_campus' as AssessmentReportVenue,
        virtualPlatform: '' as AssessmentReportVirtualPlatform | '',
        meetingRecordDocumentId: '',
        outcome: '',
        overview: '',
        recommendation: '',
    });
    const [savingAssessmentReport, setSavingAssessmentReport] = useState(false);
    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();
    const pathname = usePathname();
    const { can, role, loading: permissionsLoading } = usePermissions();

    const isFrontdeskView = pathname.startsWith('/frontdesk');
    const isAccountsManagerView = role === 'accounts_manager';
    const isDispatchCoordinatorView = role === 'dispatch_coordinator';
    const canManageCertificates = Boolean(role && CERTIFICATE_MANAGE_ROLES.has(role) && can('certificates.manage'));
    const canViewAccountsTab = Boolean(role && ACCOUNTS_TAB_ROLES.has(role));
    const isAssessorView = role === 'assessor';
    const routeBase = getPortalRouteBase(pathname, role);
    const isPassedAccountsFinanceQueue = application?.workflow_stage === 'accounts' && application?.assessment_result === 'pass';
    const isAssignedAdmin = role === 'admin'
        && Boolean(currentUserId)
        && application?.assigned_admin_id === currentUserId;
    const isAssignedAssessor = isAssessorView
        && Boolean(currentUserId)
        && application?.assigned_assessor_id === currentUserId;
    const hasDispatchApprovalRequest = Boolean(application?.dispatch_approval_requested_at);
    const hasDispatchApprovalGranted = Boolean(application?.dispatch_approval_approved_at && application?.dispatch_approval_approved_by);
    const hasClearDispatchPayment = application?.payment_status === 'paid';
    const canAccountsManagerDispatch = isAccountsManagerView
        && isPassedAccountsFinanceQueue
        && Boolean(application?.xero_invoice_id)
        && Boolean(application?.xero_bill_id)
        && (hasClearDispatchPayment || hasDispatchApprovalGranted);
    const evaluationFiles = useMemo(
        () => documents.filter((document) => isActiveRecord(document) && ['Evaluation File', 'Student Assessment Report'].includes(document.document_type)),
        [documents]
    );
    const hasEvaluationFile = evaluationFiles.length > 0;
    const assessmentMeetingRecordDocuments = useMemo(
        () => documents.filter((document) => isActiveRecord(document) && document.document_type === 'Assessment Meeting Record'),
        [documents]
    );
    const meetingRecordDocument = useMemo(
        () => documents.find((document) => isActiveRecord(document) && document.id === assessmentReportForm.meetingRecordDocumentId) || null,
        [assessmentReportForm.meetingRecordDocumentId, documents]
    );
    const hasMovedToEvaluate = Boolean(application && EVALUATION_READY_STAGES.includes(application.workflow_stage));
    const appointmentStepCompleted = Boolean(application?.appointment_date && application?.appointment_time);
    const evaluateStepCompleted = hasMovedToEvaluate;
    const uploadEvaluateStepCompleted = hasEvaluationFile;
    const assessmentReportCompleted = Boolean(application?.assessment_report_completed_at);
    const assessmentResultCompleted = application?.assessment_result !== undefined && application.assessment_result !== 'pending';

    const appointmentStepCurrent = application?.workflow_stage === 'enrolled' && !appointmentStepCompleted;
    const evaluateStepCurrent = application?.workflow_stage === 'enrolled' && appointmentStepCompleted;
    const uploadEvaluateStepCurrent = application?.workflow_stage === 'evaluate' && !uploadEvaluateStepCompleted;
    const assessmentReportCurrent = application?.workflow_stage === 'evaluate' && uploadEvaluateStepCompleted && !assessmentReportCompleted;
    const assessmentResultCurrent = application?.workflow_stage === 'evaluate' && assessmentReportCompleted && !assessmentResultCompleted;

    const canEditAppointmentDate = application ? ['enrolled', 'evaluate', 'accounts', 'dispatch', 'completed'].includes(application.workflow_stage) : false;
    const canEditAssessmentReport = Boolean(isAssignedAssessor && application?.workflow_stage === 'evaluate');
    const canViewAssessmentReportTab = Boolean(
        isAssignedAssessor
        || (role && ASSESSMENT_REPORT_VIEW_ROLES.has(role) && application?.assessment_result !== 'pending')
    );
    const requiresMeetingRecord = assessmentReportForm.venue === 'virtual';
    const assessorWorkflowSteps = useMemo(() => {
        if (!application) {
            return [] as Array<{
                value: string;
                title: string;
                description: string;
                badgeValue: string;
                completed: boolean;
                current: boolean;
                unlocked: boolean;
                lockReason: string;
                label: string;
                className: string;
            }>;
        }

        return [
            {
                value: 'step-1',
                title: 'Step 1: Set Appointment Date',
                description: 'Assign the appointment date and time before the assessor moves this application to Evaluate.',
                badgeValue: application.appointment_date
                    ? formatAppointmentDateTimeValue(application.appointment_date, application.appointment_time)
                    : 'Not set',
                completed: appointmentStepCompleted,
                current: appointmentStepCurrent,
                unlocked: canEditAppointmentDate,
                lockReason: 'Appointment date becomes available once the application reaches Enrolled.',
            },
            {
                value: 'step-2',
                title: 'Step 2: Move to Evaluate',
                description: 'Move the application into Evaluate once the appointment date and time are set.',
                badgeValue: hasMovedToEvaluate ? 'Moved to Evaluate' : 'Waiting for appointment date and time',
                completed: evaluateStepCompleted,
                current: evaluateStepCurrent,
                unlocked: appointmentStepCompleted,
                lockReason: 'Set the appointment date and time first.',
            },
            {
                value: 'step-3',
                title: 'Step 3: Upload Student Assessment Report',
                description: 'Upload the student assessment report from the Documents tab.',
                badgeValue: hasEvaluationFile ? `${evaluationFiles.length} file${evaluationFiles.length === 1 ? '' : 's'} uploaded` : 'No Student Assessment Report uploaded',
                completed: uploadEvaluateStepCompleted,
                current: uploadEvaluateStepCurrent,
                unlocked: evaluateStepCompleted,
                lockReason: 'Move the application to Evaluate first.',
            },
            {
                value: 'step-4',
                title: 'Step 4: Assessment Report',
                description: 'Complete the structured assessment report after uploading the student assessment report.',
                badgeValue: assessmentReportCompleted ? 'Completed' : 'Pending',
                completed: assessmentReportCompleted,
                current: assessmentReportCurrent,
                unlocked: uploadEvaluateStepCompleted,
                lockReason: 'Upload the student assessment report first.',
            },
            {
                value: 'step-5',
                title: 'Step 5: Assessment Result',
                description: 'Mark the evaluation as pass or failed after completing the assessment report.',
                badgeValue: ASSESSMENT_RESULT_LABELS[application.assessment_result],
                completed: assessmentResultCompleted,
                current: assessmentResultCurrent,
                unlocked: assessmentReportCompleted,
                lockReason: 'Complete the assessment report first.',
            },
        ].map((step) => ({
            ...step,
            ...getAssessorStepBadge(step.completed, step.current, step.unlocked),
        }));
    }, [
        application,
        assessmentResultCompleted,
        assessmentResultCurrent,
        canEditAppointmentDate,
        evaluateStepCompleted,
        evaluateStepCurrent,
        evaluationFiles.length,
        hasEvaluationFile,
        hasMovedToEvaluate,
        appointmentStepCompleted,
        appointmentStepCurrent,
        assessmentReportCompleted,
        assessmentReportCurrent,
        uploadEvaluateStepCompleted,
        uploadEvaluateStepCurrent,
    ]);

    const nextAssessorWorkflowStep = useMemo(
        () => assessorWorkflowSteps.find((step) => step.current)?.value
            || assessorWorkflowSteps.find((step) => !step.completed && step.unlocked)?.value
            || assessorWorkflowSteps.find((step) => step.completed)?.value
            || 'step-1',
        [assessorWorkflowSteps]
    );

    // Record locking
    const {
        lockState,
        acquireLock,
        releaseLock,
        isLoading: lockLoading,
        error: lockError,
    } = useRecordLock({
        tableName: 'applications',
        recordId: id,
    });

    const xeroActionUnavailableReason = useMemo(() => {
        if (!lockState.canEdit) {
            return 'Acquire lock to use Xero actions';
        }

        if (checkingXeroConnection) {
            return 'Checking Xero connection...';
        }

        if (xeroStatusError) {
            return xeroStatusError;
        }

        if (!xeroConnected) {
            return 'Xero connection required. Connect Xero in Settings -> Xero.';
        }

        return undefined;
    }, [checkingXeroConnection, lockState.canEdit, xeroConnected, xeroStatusError]);

    const transitionOptionsQuery = useGetTransitionOptionsQuery({ applicationId: id });

    const adminEnrolledOption = useMemo(
        () => transitionOptionsQuery.data?.data.options.find((option) => option.toStage === 'enrolled') || null,
        [transitionOptionsQuery.data?.data.options]
    );

    const adminAccountsOption = useMemo(
        () => transitionOptionsQuery.data?.data.options.find((option) => option.toStage === 'accounts') || null,
        [transitionOptionsQuery.data?.data.options]
    );

    const accountsDispatchOption = useMemo(
        () => transitionOptionsQuery.data?.data.options.find((option) => option.toStage === 'dispatch') || null,
        [transitionOptionsQuery.data?.data.options]
    );

    const dispatchCompletedOption = useMemo(
        () => transitionOptionsQuery.data?.data.options.find((option) => option.toStage === 'completed') || null,
        [transitionOptionsQuery.data?.data.options]
    );
    const refetchTransitionOptions = transitionOptionsQuery.refetch;

    const canAdminConfirmEnrollment = Boolean(adminEnrolledOption?.canExecute);
    const canAdminMoveToAccounts = Boolean(adminAccountsOption?.canExecute);
    const canAccountsChangeToDispatch = Boolean(accountsDispatchOption?.canExecute);
    const canDispatchChangeToCompleted = Boolean(dispatchCompletedOption?.canExecute);

    useEffect(() => {
        const loadCurrentUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUserId(user?.id || null);

            if (!user?.id) {
                setCurrentUserName(null);
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .maybeSingle<{ full_name: string | null }>();

            setCurrentUserName(profile?.full_name || null);
        };

        void loadCurrentUser();
    }, [supabase]);

    useEffect(() => {
        // Check Xero connection status
        const checkXeroConnection = async () => {
            setCheckingXeroConnection(true);
            setXeroStatusError(null);

            try {
                const response = await fetch('/api/xero/status');
                if (response.ok) {
                    const status = await response.json();
                    setXeroConnected(status.connected || false);
                    setXeroStatusError(!status.connected && status.error ? String(status.error) : null);
                    return;
                }

                const payload = await response.json().catch(() => null);
                setXeroConnected(false);
                setXeroStatusError(
                    getWorkflowErrorFromPayload(
                        payload,
                        response.status === 403
                            ? 'You do not have access to view Xero connection status right now.'
                            : 'Unable to verify Xero connection right now. Please try again.'
                    )
                );
            } catch (error) {
                setXeroConnected(false);
                setXeroStatusError('Unable to verify Xero connection right now. Please try again.');
                console.error('Failed to check Xero connection:', error);
            } finally {
                setCheckingXeroConnection(false);
            }
        };

        void checkXeroConnection();
    }, []);

    const loadApplicationData = useCallback(async (options?: {
        showLoading?: boolean;
        redirectOnMissing?: boolean;
    }) => {
        const { showLoading = true, redirectOnMissing = false } = options || {};

        if (permissionsLoading) {
            return false;
        }

        if (showLoading) {
            setLoading(true);
        }

        const { data: { user } } = await supabase.auth.getUser();

        let applicationQuery = supabase
            .from('applications')
            .select(APPLICATION_DETAILS_SELECT)
            .eq('id', id);

        if (role === 'assessor' && user?.id) {
            applicationQuery = applicationQuery.eq('assigned_assessor_id', user.id);
        }

        if (role === 'dispatch_coordinator') {
            applicationQuery = applicationQuery.in('workflow_stage', ['dispatch', 'completed']);
        }

        const { data: app, error: appError } = await applicationQuery.single<ApplicationWithRelations>();

        if (appError) {
            console.error('Error loading application detail:', appError);
        }

        if (!app) {
            setApplication(null);
            setDocuments([]);
            setComments([]);
            setHistory([]);

            if (showLoading) {
                setLoading(false);
            }

            if (redirectOnMissing && (role === 'assessor' || role === 'accounts_manager' || role === 'dispatch_coordinator')) {
                toast.error('Application not available', {
                    description: role === 'assessor'
                            ? 'You can only view applications assigned to you.'
                            : role === 'accounts_manager'
                                ? 'This application is not available right now.'
                                : 'Dispatch Coordinator can only view Dispatch and Completed applications.',
                });
                router.replace(`${routeBase}/applications`);
            }

            return false;
        }

        try {
            const [hydratedApp] = await hydrateApplicationRelations([app], supabase as never);
            setApplication(hydratedApp || app);
        } catch (hydrationError) {
            console.error('Application relation hydration failed:', hydrationError);
            setApplication(app);
        }

        const [documentsResult, commentsResult, historyResult] = await Promise.all([
            supabase
                .from('documents')
                .select('*')
                .eq('application_id', id)
                .order('created_at', { ascending: false }),
            supabase
                .from('application_comments')
                .select('*, user:profiles(full_name, avatar_url)')
                .eq('application_id', id)
                .order('created_at', { ascending: false }),
            supabase
                .from('application_history')
                .select('*, user:profiles(full_name)')
                .eq('application_id', id)
                .order('created_at', { ascending: false }),
        ]);

        setDocuments((documentsResult.data || []) as Document[]);
        setComments((commentsResult.data || []) as ApplicationComment[]);
        setHistory((historyResult.data || []) as ApplicationHistory[]);

        if (showLoading) {
            setLoading(false);
        }

        return true;
    }, [id, permissionsLoading, role, routeBase, router, supabase]);

    useEffect(() => {
        void loadApplicationData({
            showLoading: true,
            redirectOnMissing: true,
        });
    }, [loadApplicationData]);

    useEffect(() => {
        if (permissionsLoading) {
            return;
        }

        const channel = supabase
            .channel(`portal-application-${id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'applications',
                    filter: `id=eq.${id}`,
                },
                () => {
                    void (async () => {
                        const loaded = await loadApplicationData({
                            showLoading: false,
                            redirectOnMissing: true,
                        });

                        if (loaded) {
                            setTimelineRefreshKey((previous) => previous + 1);
                            void refetchTransitionOptions();
                        }
                    })();
                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [id, loadApplicationData, permissionsLoading, supabase, refetchTransitionOptions]);

    useEffect(() => {
        setAssessorAppointmentDate(formatDateInputValue(application?.appointment_date));
        setAssessorAppointmentTime(formatTimeInputValue(application?.appointment_time));
    }, [application?.appointment_date, application?.appointment_time]);

    useEffect(() => {
        setAssessmentReportForm({
            evaluationDate: formatDateInputValue(application?.assessment_report_date),
            startTime: formatTimeInputValue(application?.assessment_report_start_time),
            endTime: formatTimeInputValue(application?.assessment_report_end_time),
            venue: application?.assessment_report_venue || 'on_campus',
            virtualPlatform: application?.assessment_report_virtual_platform || '',
            meetingRecordDocumentId: application?.assessment_report_meeting_record_document_id || '',
            outcome: application?.assessment_report_outcome || '',
            overview: application?.assessment_report_overview || '',
            recommendation: application?.assessment_report_recommendation || '',
        });
    }, [
        application?.assessment_report_completed_at,
        application?.assessment_report_date,
        application?.assessment_report_end_time,
        application?.assessment_report_meeting_record_document_id,
        application?.assessment_report_outcome,
        application?.assessment_report_overview,
        application?.assessment_report_recommendation,
        application?.assessment_report_start_time,
        application?.assessment_report_venue,
        application?.assessment_report_virtual_platform,
    ]);

    useEffect(() => {
        if (!assessmentReportForm.meetingRecordDocumentId && assessmentMeetingRecordDocuments.length === 1) {
            setAssessmentReportForm((previous) => ({
                ...previous,
                meetingRecordDocumentId: assessmentMeetingRecordDocuments[0].id,
            }));
        }
    }, [assessmentMeetingRecordDocuments, assessmentReportForm.meetingRecordDocumentId]);

    useEffect(() => {
        if (!canViewAccountsTab && activeTab === 'accounts') {
            setActiveTab('overview');
        }
    }, [activeTab, canViewAccountsTab]);

    useEffect(() => {
        if (!canViewAssessmentReportTab && activeTab === 'assessment-report') {
            setActiveTab('overview');
        }
    }, [activeTab, canViewAssessmentReportTab]);

    useEffect(() => {
        if (!isAssignedAssessor) {
            return;
        }

        const selectedStep = assessorWorkflowSteps.find((step) => step.value === activeAssessorWorkflowStep);
        if (!selectedStep || (!selectedStep.unlocked && !selectedStep.completed)) {
            setActiveAssessorWorkflowStep(nextAssessorWorkflowStep);
        }
    }, [activeAssessorWorkflowStep, assessorWorkflowSteps, isAssignedAssessor, nextAssessorWorkflowStep]);

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        setSubmittingComment(true);

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setSubmittingComment(false);
            return;
        }

        const { data, error } = await supabase
            .from('application_comments')
            .insert([{
                application_id: id,
                content: newComment,
                user_id: user.id
            }])
            .select('*, user:profiles(full_name, avatar_url)')
            .single();

        if (!error && data) {
            setComments([data, ...comments]);
            setNewComment('');

            // Add to activity history
            await supabase
                .from('application_history')
                .insert([{
                    application_id: id,
                    action: 'comment_added',
                    field_changed: 'comments',
                    new_value: newComment.substring(0, 100) + (newComment.length > 100 ? '...' : ''),
                    user_id: user.id
                }]);

            // Extract @mentions and send notifications
            // New format: @[Name](user:id) - extract user IDs directly
            const mentionIdPattern = /@\[([^\]]+)\]\(user:([^)]+)\)/g;
            const mentionedUserIds: string[] = [];
            let matchId;
            while ((matchId = mentionIdPattern.exec(newComment)) !== null) {
                mentionedUserIds.push(matchId[2]); // User ID from format
            }

            // Also support old format: @Name (for backwards compatibility)
            const oldMentionPattern = /@(\S+)/g;
            const oldMentions: string[] = [];
            let matchOld;
            while ((matchOld = oldMentionPattern.exec(newComment)) !== null) {
                // Skip if this is part of the new format
                if (!matchOld[1].startsWith('[')) {
                    oldMentions.push(matchOld[1].replace(/[.,!?;:]+$/, ''));
                }
            }

            if (mentionedUserIds.length > 0 || oldMentions.length > 0) {
                // Get current user's name for the notification message
                const { data: currentUserProfile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single();

                const authorName = currentUserProfile?.full_name || 'Someone';

                // For new format - fetch users by IDs directly
                let mentionedUsers: Array<{ id: string; full_name: string | null }> = [];

                if (mentionedUserIds.length > 0) {
                    const { data: usersById } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .in('id', mentionedUserIds)
                        .in('role', STAFF_ROLES);
                    if (usersById) mentionedUsers = [...mentionedUsers, ...usersById];
                }

                // For old format - fuzzy match by name (backwards compat)
                if (oldMentions.length > 0) {
                    const { data: usersByName } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .in('role', STAFF_ROLES)
                        .or(oldMentions.map(m => `full_name.ilike.%${m}%`).join(','));
                    if (usersByName) {
                        // Deduplicate
                        const existingIds = new Set(mentionedUsers.map(u => u.id));
                        mentionedUsers = [...mentionedUsers, ...usersByName.filter(u => !existingIds.has(u.id))];
                    }
                }

                // Create notifications for mentioned users (excluding the author)
                if (mentionedUsers.length > 0) {
                    const notifications = mentionedUsers
                        .filter(u => u.id !== user.id) // Don't notify yourself
                        .map(mentionedUser => ({
                            user_id: mentionedUser.id,
                            type: 'mention',
                            title: 'You were mentioned in a comment',
                            message: `${authorName} mentioned you in a comment on ${application?.student_first_name || ''} ${application?.student_last_name || ''}'s application`.trim(),
                            related_table: 'applications',
                            related_id: id,
                            priority: 'normal',
                            metadata: {
                                comment_id: data.id,
                                author_id: user.id,
                                author_name: authorName,
                                application_id: id,
                                student_name: `${application?.student_first_name || ''} ${application?.student_last_name || ''}`.trim(),
                            }
                        }));

                    if (notifications.length > 0) {
                        await supabase.from('notifications').insert(notifications);
                    }
                }
            }

            // Refresh history
            const { data: hist } = await supabase
                .from('application_history')
                .select('*, user:profiles(full_name)')
                .eq('application_id', id)
                .order('created_at', { ascending: false });
            if (hist) setHistory(hist);
        }

        setSubmittingComment(false);
    };

    const handleFieldsExtracted = async (fields: ApplicationFieldMapping) => {
        if (!application) return;

        // Build the update object from extracted fields
        const updateData: Record<string, string | null> = {};

        if (fields.student_first_name) updateData.student_first_name = fields.student_first_name;
        if (fields.student_last_name) updateData.student_last_name = fields.student_last_name;
        if (fields.student_email) updateData.student_email = fields.student_email;
        if (fields.student_phone) updateData.student_phone = fields.student_phone;
        if (fields.student_dob) updateData.student_dob = fields.student_dob;
        if (fields.student_passport_number) updateData.student_passport_number = fields.student_passport_number;
        if (fields.student_nationality) updateData.student_nationality = fields.student_nationality;
        if (fields.student_address) updateData.student_address = fields.student_address;
        if (fields.student_usi) updateData.student_usi = fields.student_usi;
        if (fields.student_visa_number) updateData.student_visa_number = fields.student_visa_number;
        if (fields.student_visa_expiry) updateData.student_visa_expiry = fields.student_visa_expiry;

        if (Object.keys(updateData).length === 0) return;

        // Update the application in the database
        const { error } = await supabase
            .from('applications')
            .update(updateData)
            .eq('id', id);

        if (!error) {
            // Update local state
            setApplication(prev => prev ? { ...prev, ...updateData } : prev);

            // Log activity for extracted fields
            await logActivity({
                applicationId: id,
                action: 'extracted_data',
                fieldChanged: 'multiple',
                newValue: `Extracted: ${Object.keys(updateData).join(', ')}`,
                metadata: { fieldsUpdated: Object.keys(updateData) }
            });

            // Refresh history
            const { data: hist } = await supabase
                .from('application_history')
                .select('*, user:profiles(full_name)')
                .eq('application_id', id)
                .order('created_at', { ascending: false });
            if (hist) setHistory(hist);
        } else {
            console.error('Failed to update application with extracted fields:', error);
        }
    };

    const formatDate = (dateString: string | null) => {
        return formatDateValue(dateString);
    };

    const formatDateTime = (dateString: string) => {
        return formatDateTimeValue(dateString);
    };

    const formatAppointmentDateTime = (appointmentDate: string | null | undefined, appointmentTime: string | null | undefined) => {
        return formatAppointmentDateTimeValue(appointmentDate, appointmentTime);
    };

    const isPdfDocumentRecord = (documentRecord: Pick<Document, 'file_name' | 'mime_type'>) => {
        const mimeType = (documentRecord.mime_type || '').toLowerCase();
        return mimeType === 'application/pdf' || documentRecord.file_name.toLowerCase().endsWith('.pdf');
    };

    const certificateDocuments = useMemo(
        () => documents.filter((document) => document.document_type === 'Certificate' && isPdfDocumentRecord(document)),
        [documents]
    );

    const handleOpenDocumentPreview = (documentRecord: Document) => {
        setSelectedDocument(documentRecord);
        setDocumentPreviewOpen(true);
    };

    const handleDocumentPreviewOpenChange = (open: boolean) => {
        setDocumentPreviewOpen(open);
        if (!open) {
            setSelectedDocument(null);
        }
    };

    const handleDownloadDocument = async (documentRecord: Document) => {
        setDownloadingDocumentId(documentRecord.id);

        try {
            const accessUrl = await fetchDocumentAccessUrl(documentRecord.id);
            const response = await fetch(accessUrl);

            if (!response.ok) {
                throw new Error('Unable to fetch document file from storage.');
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
        } catch (error) {
            toast.error('Document download failed', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'We could not download this document right now. Please try again.'
                ),
            });
        } finally {
            setDownloadingDocumentId(null);
        }
    };

    // Export application to CSV
    const handleExportApplication = async () => {
        if (!application) {
            toast.error('Application data not available');
            return;
        }

        setExporting(true);
        try {
            // Prepare application data for export with safe defaults
        const exportData = {
                'Application ID': resolveApplicationId(application.application_number, application.student_uid) || 'N/A',
                'First Name': application.student_first_name || '',
                'Last Name': application.student_last_name || '',
                'Email': application.student_email || '',
                'Phone': application.student_phone || '',
                'Date of Birth': application.student_dob || '',
                'Gender': application.student_gender || '',
                'Nationality': application.student_nationality || '',
                'Country of Birth': application.student_country_of_birth || '',
                'Passport Number': application.student_passport_number || '',
                'Visa Number': application.student_visa_number || '',
                'Visa Expiry': application.student_visa_expiry || '',
                'USI': application.student_usi || '',
                'Address': application.student_address || '',
                'Street No': application.student_street_no || '',
                'Suburb': application.student_suburb || '',
                'State': application.student_state || '',
                'Postcode': application.student_postcode || '',
                'Application From': application.application_from || '',
                'Workflow Stage': STAGE_LABELS[application.workflow_stage] || 'Unknown',
                'Payment Status': application.payment_status || 'Unpaid',
                'Qualification': getApplicationQualification(application)?.name || '',
                'Qualification Code': getApplicationQualification(application)?.code || '',
                'RTO': application.offering?.rto?.name || '',
                'RTO Code': application.offering?.rto?.code || '',
                'Partner': application.partner?.company_name || '',
                'Tuition Fee': application.quoted_tuition || application.offering?.tuition_fee_onshore || 0,
                'Material Fee': application.quoted_materials || application.offering?.material_fee || 0,
                'Assessor Fee': application.assessor_fee || 0,
                'Received Date': formatDate(application.received_at || application.created_at),
                'Issue Date': formatDate(application.issue_date),
                'Appointment Date': formatAppointmentDateTime(application.appointment_date, application.appointment_time),
                'Created At': formatDateTime(application.created_at),
                'Updated At': formatDateTime(application.updated_at),
                'Notes': (application.notes || '').replace(/\n/g, ' ').replace(/\r/g, ' '),
            };

            // Convert to CSV with proper escaping
            const headers = Object.keys(exportData);
            const values = Object.values(exportData).map(val => {
                if (val === null || val === undefined) return '';
                const str = String(val);
                // Escape quotes and wrap in quotes if contains comma, quote, or newline
                if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            });

            const csvContent = [
                headers.join(','),
                values.join(',')
            ].join('\n');

            // Add BOM for Excel compatibility with special characters
            const BOM = '\uFEFF';
            const csvWithBOM = BOM + csvContent;

            // Create and download file
            const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.download = `application_${application.student_uid || 'export'}_${new Date().toISOString().split('T')[0]}.csv`;
            
            // Ensure link is added to DOM for better browser compatibility
            document.body.appendChild(link);
            link.click();
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);

            // Log activity
            await logActivity({
                applicationId: id,
                action: 'exported',
                fieldChanged: 'export',
                newValue: `Application exported to CSV`,
            });

            // Refresh history
            const { data: hist } = await supabase
                .from('application_history')
                .select('*, user:profiles(full_name)')
                .eq('application_id', id)
                .order('created_at', { ascending: false });
            if (hist) setHistory(hist);

            toast.success('Application exported successfully', {
                description: `Downloaded as ${link.download}`,
            });
        } catch (error) {
            console.error('Error exporting application:', error);
            toast.error('Failed to export application', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to export this application right now. Please try again.'
                ),
            });
        } finally {
            setExporting(false);
        }
    };

    // Handle archive success
    const handleArchiveSuccess = async () => {
        const wasArchived = application?.is_archived;
        toast.success(wasArchived ? 'Application unarchived successfully' : 'Application archived successfully', {
            description: wasArchived ? 'The application is now visible in the main list' : 'The application has been archived',
        });

        await loadApplicationData({ showLoading: false });
    };

    // Handle delete success
    const handleDeleteSuccess = async () => {
        const wasDeleted = application?.is_deleted;
        toast.success(wasDeleted ? 'Application restored successfully' : 'Application moved to trash', {
            description: wasDeleted ? 'The application is now visible again' : 'The application has been moved to trash',
        });
        
        if (!wasDeleted) {
            // If deleted, redirect to applications list after a short delay
            setTimeout(() => {
                router.push(`${routeBase}/applications`);
            }, 1500);
        } else {
            await loadApplicationData({ showLoading: false });
        }
    };

    const buildDefaultStudentEmail = () => {
        const currentApplication = application;

        if (!currentApplication) {
            return {
                subject: 'Update on your application',
                body: `Dear Student,\n\nWe are writing to share an update on your application.\n\nKind regards,\n${BRAND_NAME}`,
            };
        }

        const studentName = `${currentApplication.student_first_name || ''} ${currentApplication.student_last_name || ''}`.trim() || 'Student';
        const applicationId = resolveApplicationId(currentApplication.application_number, currentApplication.student_uid);

        return {
            subject: `Update on your application ${applicationId || currentApplication.student_uid}`,
            body: [
                `Dear ${studentName},`,
                '',
                'We are writing to share an update on your application.',
                '',
                `Application ID: ${applicationId || currentApplication.student_uid}`,
                `Current Stage: ${STAGE_LABELS[currentApplication.workflow_stage]}`,
                '',
                'Please reply to this email if you have any questions.',
                '',
                'Kind regards,',
                BRAND_NAME,
            ].join('\n'),
        };
    };

    const buildDefaultDispatchStudentEmail = () => {
        const currentApplication = application;

        if (!currentApplication) {
            return {
                subject: 'Your certificate is attached',
                body: `Dear Student,\n\nPlease find your certificate attached to this email.\n\nKind regards,\n${BRAND_NAME}`,
            };
        }

        const studentName = `${currentApplication.student_first_name || ''} ${currentApplication.student_last_name || ''}`.trim() || 'Student';
        const applicationId = resolveApplicationId(currentApplication.application_number, currentApplication.student_uid);

        return {
            subject: `Your certificate for application ${applicationId || currentApplication.student_uid}`,
            body: [
                `Dear ${studentName},`,
                '',
                'Please find your certificate attached to this email.',
                '',
                `Application ID: ${applicationId || currentApplication.student_uid}`,
                '',
                'Kind regards,',
                BRAND_NAME,
            ].join('\n'),
        };
    };

    const buildEmailTemplateVariables = (currentApplication: ApplicationWithRelations) => {
        const appointmentDate = formatAppointmentDateTime(currentApplication.appointment_date, currentApplication.appointment_time);

        const portalLink = typeof window !== 'undefined'
            ? `${window.location.origin}${routeBase}/applications/${id}`
            : `${routeBase}/applications/${id}`;

        return {
            '{{student_name}}': `${currentApplication.student_first_name || ''} ${currentApplication.student_last_name || ''}`.trim(),
            '{{student_email}}': currentApplication.student_email || '',
            '{{application_id}}': resolveApplicationId(currentApplication.application_number, currentApplication.student_uid) || '',
            '{{qualification}}': getApplicationQualification(currentApplication)?.name || '',
            '{{rto}}': currentApplication.offering?.rto?.name || '',
            '{{appointment_date}}': appointmentDate === '-' ? '' : appointmentDate,
            '{{intake_date}}': appointmentDate === '-' ? '' : appointmentDate,
            '{{status}}': STAGE_LABELS[currentApplication.workflow_stage] || currentApplication.workflow_stage,
            '{{agent_name}}': currentApplication.partner?.company_name || '',
            '{{portal_link}}': portalLink,
            '{{missing_documents}}': '',
            '{{requested_by}}': '',
            '{{note_block}}': '',
        };
    };

    const renderEmailTemplateContent = (template: string, currentApplication: ApplicationWithRelations) => {
        return renderEmailTemplate(template, buildEmailTemplateVariables(currentApplication));
    };

    const fetchEmailTemplates = async () => {
        setLoadingEmailTemplates(true);

        const response = await fetch('/api/email-templates', {
            credentials: 'same-origin',
            cache: 'no-store',
        });

        const payload = await response.json().catch(() => null) as {
            data?: Array<{ id: string; name: string; subject: string; body: string; is_active?: boolean | null }>;
            error?: string;
        } | null;

        if (!response.ok) {
            toast.error('Unable to load email templates', {
                description: payload?.error || 'Unable to load email templates right now. Please try again.',
            });
            setEmailTemplates([]);
            setLoadingEmailTemplates(false);
            return [] as Array<{ id: string; name: string; subject: string; body: string }>;
        }

        const nextTemplates = (payload?.data || [])
            .filter((template) => template.is_active !== false)
            .map(({ id, name, subject, body }) => ({ id, name, subject, body }));

        setEmailTemplates(nextTemplates);
        setLoadingEmailTemplates(false);
        return nextTemplates;
    };

    const handleStudentEmailTemplateChange = (templateId: string) => {
        setSelectedEmailTemplateId(templateId);

        if (templateId === '__none__') {
            const defaults = isDispatchCoordinatorView
                ? buildDefaultDispatchStudentEmail()
                : buildDefaultStudentEmail();
            setEmailSubject(defaults.subject);
            setEmailBody(defaults.body);
            return;
        }

        const selectedTemplate = emailTemplates.find((template) => template.id === templateId);
        if (!selectedTemplate) {
            toast.error('Selected template could not be loaded');
            return;
        }

        setEmailSubject(selectedTemplate.subject || '');
        setEmailBody(selectedTemplate.body || '');
    };

    const isValidEmailAddress = (value: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    };

    const sleep = (ms: number) => new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });

    const renderDeliveryToastDescription = (progress: number, detail: string) => (
        <div className="space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
            <Progress value={progress} className="h-1.5" />
        </div>
    );

    const getQueuedEmailStatus = async (notificationId: string) => {
        const { data, error } = await supabase
            .from('notification_queue')
            .select('status, error_message, retry_count, max_retries')
            .eq('id', notificationId)
            .single();

        if (error || !data) {
            return null;
        }

        return {
            status: data.status,
            errorMessage: data.error_message,
            retryCount: Number(data.retry_count || 0),
            maxRetries: Number(data.max_retries || 3),
        };
    };

    const toggleStudentEmailDocumentSelection = (documentId: string, checked: boolean) => {
        setSelectedStudentEmailDocumentIds((previous) => {
            if (checked) {
                if (previous.includes(documentId)) {
                    return previous;
                }

                return [...previous, documentId];
            }

            return previous.filter((value) => value !== documentId);
        });
    };

    const handleOpenStudentEmailDialog = async () => {
        const currentApplication = application;

        if (!currentApplication) {
            return;
        }

        const recipient = (currentApplication.student_email || '').trim();
        if (!recipient) {
            toast.error('Student email not available', {
                description: 'Please add a valid student email address first.',
            });
            return;
        }

        const defaults = isDispatchCoordinatorView
            ? buildDefaultDispatchStudentEmail()
            : buildDefaultStudentEmail();

        setSelectedStudentEmailDocumentIds(
            isDispatchCoordinatorView
                ? certificateDocuments.map((document) => document.id)
                : []
        );

        const availableTemplates = await fetchEmailTemplates();
        const welcomeTemplate = !isDispatchCoordinatorView
            ? availableTemplates.find((template) => template.name === WELCOME_EMAIL_TO_APPLICATION_TEMPLATE_NAME) || null
            : null;

        if (welcomeTemplate) {
            setSelectedEmailTemplateId(welcomeTemplate.id);
            setEmailSubject(welcomeTemplate.subject || defaults.subject);
            setEmailBody(welcomeTemplate.body || defaults.body);
        } else {
            setSelectedEmailTemplateId('__none__');
            setEmailSubject(defaults.subject);
            setEmailBody(defaults.body);
        }

        setEmailDialogOpen(true);
    };

    const handleSendStudentEmail = async () => {
        const currentApplication = application;

        if (!currentApplication) {
            return;
        }

        const recipient = (currentApplication.student_email || '').trim();
        const renderedSubject = renderEmailTemplateContent(emailSubject, currentApplication).trim();
        const renderedBody = renderEmailTemplateContent(emailBody, currentApplication).trim();
        const selectedTemplate = selectedEmailTemplateId === '__none__'
            ? null
            : emailTemplates.find((template) => template.id === selectedEmailTemplateId) || null;

        if (!recipient) {
            toast.error('Student email not available');
            return;
        }

        if (!isValidEmailAddress(recipient)) {
            toast.error('Invalid recipient email', {
                description: 'Please correct the student email before sending.',
            });
            return;
        }

        if (!renderedSubject) {
            toast.error('Subject is required');
            return;
        }

        if (!renderedBody) {
            toast.error('Message body is required');
            return;
        }

        if (isDispatchCoordinatorView && selectedStudentEmailDocumentIds.length === 0) {
            toast.error('Select at least one Certificate PDF to attach.');
            return;
        }

        setSendingEmail(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                toast.error('Authentication required', {
                    description: 'Please sign in again and retry.',
                });
                return;
            }

            if (isDispatchCoordinatorView) {
                const response = await fetch(`/api/applications/${id}/dispatch-tasks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'send_certificate_email',
                        subject: renderedSubject,
                        body: renderedBody,
                        documentIds: selectedStudentEmailDocumentIds,
                    }),
                });

                const payload = await response.json().catch(() => null);
                if (!response.ok) {
                    toast.error('Failed to send certificate email', {
                        description: getWorkflowErrorFromPayload(
                            payload,
                            'Unable to send the certificate email right now. Please try again.'
                        ),
                    });
                    return;
                }

                const sentAt = payload?.data?.application?.sent_at || new Date().toISOString();
                setApplication((previous) => previous ? {
                    ...previous,
                    sent_at: sentAt,
                    delivery_method: 'email',
                    sent_by_profile: currentUserName
                        ? { full_name: currentUserName }
                        : previous.sent_by_profile,
                } : previous);
                setEmailDialogOpen(false);
                toast.success('Certificate email sent to student.');
                await refreshHistoryFeed();
                return;
            }

            const { data: queuedNotification, error: queueError } = await supabase
                .from('notification_queue')
                .insert({
                    channel: 'email',
                    recipient,
                    subject: renderedSubject,
                    body: renderedBody,
                    application_id: id,
                    template_id: selectedTemplate?.id || null,
                    status: 'pending',
                    scheduled_at: new Date().toISOString(),
                    created_by: user.id,
                    metadata: {
                        source: 'application_quick_action',
                        student_uid: currentApplication.student_uid,
                        student_name: `${currentApplication.student_first_name || ''} ${currentApplication.student_last_name || ''}`.trim(),
                        workflow_stage: currentApplication.workflow_stage,
                        template_id: selectedTemplate?.id || null,
                        template_name: selectedTemplate?.name || null,
                    },
                })
                .select('id')
                .single();

            if (queueError) {
                toast.error('Failed to queue email', {
                    description: getWorkflowErrorFromUnknown(
                        queueError,
                        'Unable to queue this email right now. Please try again.'
                    ),
                });
                return;
            }

            if (!queuedNotification?.id) {
                toast.error('Failed to queue email', {
                    description: 'Notification ID was not returned. Please retry.',
                });
                return;
            }

            void logActivity({
                applicationId: id,
                action: 'updated',
                fieldChanged: 'communication',
                newValue: `Queued email to ${recipient}${selectedTemplate ? ` using template ${selectedTemplate.name}` : ''}`,
                metadata: {
                    channel: 'email',
                    recipient,
                    source: 'application_quick_action',
                    template_id: selectedTemplate?.id || null,
                    template_name: selectedTemplate?.name || null,
                },
            });

            setEmailDialogOpen(false);

            const deliveryToastId = `email-delivery-${queuedNotification.id}`;
            const updateDeliveryToast = (title: string, detail: string, progress: number) => {
                toast(title, {
                    id: deliveryToastId,
                    duration: Infinity,
                    description: renderDeliveryToastDescription(progress, detail),
                });
            };

            updateDeliveryToast(
                'Email queued for delivery',
                `Queued for ${recipient}. Starting delivery worker...`,
                8
            );

            try {
                const processPromise = fetch('/api/notifications/process?limit=20&includeReminders=false', {
                    method: 'POST',
                });

                let progressValue = 14;
                let latestStatus: 'pending' | 'sent' | 'failed' | 'cancelled' | null = null;
                let latestErrorMessage: string | null = null;
                let latestRetryCount = 0;
                let latestMaxRetries = 3;
                let statusResolved = false;
                const pollingStartedAt = Date.now();

                for (let pollAttempt = 0; pollAttempt < 30; pollAttempt++) {
                    await sleep(350);

                    const statusSnapshot = await getQueuedEmailStatus(queuedNotification.id);
                    if (!statusSnapshot) {
                        continue;
                    }

                    latestStatus = statusSnapshot.status as 'pending' | 'sent' | 'failed' | 'cancelled';
                    latestErrorMessage = statusSnapshot.errorMessage;
                    latestRetryCount = statusSnapshot.retryCount;
                    latestMaxRetries = statusSnapshot.maxRetries;

                    if (latestStatus === 'sent' || latestStatus === 'failed' || latestStatus === 'cancelled') {
                        statusResolved = true;
                        break;
                    }

                    const elapsedMs = Date.now() - pollingStartedAt;
                    const smoothTimeProgress = Math.min(90, 18 + (elapsedMs / 12000) * 72);
                    const retryBoost = latestRetryCount > 0 ? Math.min(8, latestRetryCount * 4) : 0;
                    progressValue = Math.max(progressValue, Math.min(90, smoothTimeProgress + retryBoost));

                    const retrying = latestRetryCount > 0;
                    const statusDetail = retrying
                        ? `Delivery attempt ${Math.min(latestRetryCount + 1, latestMaxRetries)}/${latestMaxRetries} in progress...`
                        : 'Sending through Zoho SMTP...';

                    updateDeliveryToast('Delivering email', statusDetail, progressValue);
                }

                let processResponseOk = false;
                try {
                    const processResponse = await processPromise;
                    processResponseOk = processResponse.ok;
                } catch {
                    processResponseOk = false;
                }

                if (!statusResolved) {
                    const finalSnapshot = await getQueuedEmailStatus(queuedNotification.id);
                    if (finalSnapshot) {
                        latestStatus = finalSnapshot.status as 'pending' | 'sent' | 'failed' | 'cancelled';
                        latestErrorMessage = finalSnapshot.errorMessage;
                        latestRetryCount = finalSnapshot.retryCount;
                        latestMaxRetries = finalSnapshot.maxRetries;
                        statusResolved = latestStatus === 'sent' || latestStatus === 'failed' || latestStatus === 'cancelled';
                    }
                }

                if (!processResponseOk && !statusResolved) {
                    toast.info('Email queued for delivery', {
                        id: deliveryToastId,
                        duration: 6000,
                        description: renderDeliveryToastDescription(
                            Math.max(progressValue, 45),
                            'Delivery worker is unavailable right now. The email remains queued and will retry in the next background run.'
                        ),
                    });
                    return;
                }

                if (latestStatus === 'sent') {
                    const { data: notificationLog } = await supabase
                        .from('notification_logs')
                        .select('provider_message_id, provider_response')
                        .eq('notification_id', queuedNotification.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    const providerResponse = notificationLog?.provider_response && typeof notificationLog.provider_response === 'object' && !Array.isArray(notificationLog.provider_response)
                        ? notificationLog.provider_response as Record<string, unknown>
                        : null;

                    const smtpResponse = typeof providerResponse?.response === 'string'
                        ? providerResponse.response
                        : null;

                    const acceptedRecipients = Array.isArray(providerResponse?.accepted)
                        ? providerResponse.accepted.filter((entry: unknown): entry is string => typeof entry === 'string')
                        : [];

                    const messageId = typeof notificationLog?.provider_message_id === 'string' && notificationLog.provider_message_id.trim().length > 0
                        ? notificationLog.provider_message_id.trim()
                        : null;

                    const deliveryDetails = [
                        acceptedRecipients.length > 0 ? `Accepted: ${acceptedRecipients.join(', ')}` : null,
                        messageId ? `Message ID: ${messageId}` : null,
                        smtpResponse ? `Provider response: ${smtpResponse}` : null,
                    ].filter(Boolean).join(' | ');

                    toast.success('Email sent to student', {
                        id: deliveryToastId,
                        duration: 7000,
                        description: renderDeliveryToastDescription(
                            100,
                            deliveryDetails || 'Accepted by SMTP provider.'
                        ),
                    });
                    return;
                }

                if (latestStatus === 'failed' || latestStatus === 'cancelled') {
                    toast.error('Email delivery failed', {
                        id: deliveryToastId,
                        duration: 8000,
                        description: renderDeliveryToastDescription(
                            100,
                            latestErrorMessage || 'The SMTP provider rejected this email.'
                        ),
                    });
                    return;
                }

                toast.info('Email queued for delivery', {
                    id: deliveryToastId,
                    duration: 6000,
                    description: renderDeliveryToastDescription(
                        Math.max(progressValue, 75),
                        latestRetryCount > 0
                            ? `Delivery is retrying (${Math.min(latestRetryCount + 1, latestMaxRetries)}/${latestMaxRetries}). It will continue in the background.`
                            : 'Not delivered yet. Delivery will complete in the next background run.'
                    ),
                });
            } catch {
                toast.info('Email queued for delivery', {
                    id: deliveryToastId,
                    duration: 6000,
                    description: renderDeliveryToastDescription(
                        55,
                        'Delivery status could not be verified right now. It will continue in the background.'
                    ),
                });
            }
        } catch (error) {
            toast.error('Failed to send email', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to send this email right now. Please try again.'
                ),
            });
        } finally {
            setSendingEmail(false);
        }
    };

    const uploadedDocumentTypes = useMemo(
        () => new Set(documents.map((document) => document.document_type).filter((type): type is string => Boolean(type))),
        [documents]
    );

    const missingDocumentsByChecklist = useMemo(
        () => DOCUMENT_TYPES.filter((documentType) => !uploadedDocumentTypes.has(documentType)),
        [uploadedDocumentTypes]
    );

    const handleOpenMissingDocsDialog = () => {
        if (!application) {
            return;
        }

        const defaultSelection = missingDocumentsByChecklist.length > 0
            ? [...missingDocumentsByChecklist]
            : [...DOCUMENT_TYPES];

        setSelectedMissingDocuments(defaultSelection);
        setMissingDocsNote('');
        setMissingDocsEmailPreview(null);
        setMissingDocsDialogOpen(true);
    };

    const toggleMissingDocumentSelection = (documentType: string, checked: boolean) => {
        setMissingDocsEmailPreview(null);
        setSelectedMissingDocuments((previous) => {
            if (checked) {
                if (previous.includes(documentType)) {
                    return previous;
                }
                return [...previous, documentType];
            }

            return previous.filter((value) => value !== documentType);
        });
    };

    const fetchExecutiveManagerIds = async (): Promise<string[]> => {
        const response = await fetch('/api/staff/assignable');
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(
                getWorkflowErrorFromPayload(
                    payload,
                    'Unable to load executive manager recipients right now. Please try again.'
                )
            );
        }

        const staff = Array.isArray(payload?.data) ? payload.data as AssignableStaffOption[] : [];
        const executiveManagerIds = staff
            .filter((member) => member.role === 'executive_manager')
            .map((member) => member.id)
            .filter(Boolean);

        return [...new Set(executiveManagerIds)];
    };

    const handleConfirmEnrollment = async () => {
        if (!application) {
            return;
        }

        if (application.workflow_stage !== 'docs_review') {
            toast.error('This action is only available for docs review applications');
            setAdminEnrollmentConfirmOpen(false);
            return;
        }

        if (!lockState.canEdit) {
            toast.error('You need to acquire a lock to perform this action');
            return;
        }

        if (transitionOptionsQuery.isLoading) {
            toast.error('Workflow actions are still loading. Please wait a moment and try again.');
            return;
        }

        if (!canAdminConfirmEnrollment) {
            toast.error('Unable to confirm enrollment', {
                description: adminEnrolledOption?.blockedReason
                    || 'This stage change is not available for your role right now.',
            });
            return;
        }

        setConfirmingEnrollment(true);

        try {
            const executiveManagerIds = await fetchExecutiveManagerIds();
            if (executiveManagerIds.length === 0) {
                throw new Error('No active executive manager users are available to notify.');
            }

            const response = await fetch(`/api/applications/${id}/transition`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    toStage: 'enrolled',
                    expectedUpdatedAt: application.updated_at,
                    notifyUserIds: executiveManagerIds,
                    notes: 'Enrollment confirmed by admin from application details page',
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(
                    getWorkflowErrorFromPayload(
                        payload,
                        'Unable to confirm enrollment right now. Please try again.'
                    )
                );
            }

            const updatedAt = payload?.data?.updatedAt || application.updated_at;
            const recipientLabel = executiveManagerIds.length === 1
                ? 'executive manager'
                : 'executive managers';

            setApplication((previous) => {
                if (!previous) {
                    return previous;
                }

                return {
                    ...previous,
                    workflow_stage: 'enrolled',
                    updated_at: updatedAt,
                };
            });

            setWorkflowBannerMessage(null);
            setAdminEnrollmentConfirmOpen(false);
            setTimelineRefreshKey((previous) => previous + 1);

            toast.success('Enrollment confirmed', {
                description: `Application moved to Enrolled and ${executiveManagerIds.length} ${recipientLabel} notified.`,
            });

            const { data: hist } = await supabase
                .from('application_history')
                .select('*, user:profiles(full_name)')
                .eq('application_id', id)
                .order('created_at', { ascending: false });

            if (hist) {
                setHistory(hist);
            }
        } catch (error) {
            toast.error('Unable to confirm enrollment', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to confirm enrollment right now. Please try again.'
                ),
            });
        } finally {
            setConfirmingEnrollment(false);
        }
    };

    const refreshHistoryFeed = async () => {
        const { data: hist } = await supabase
            .from('application_history')
            .select('*, user:profiles(full_name)')
            .eq('application_id', id)
            .order('created_at', { ascending: false });

        if (hist) {
            setHistory(hist);
        }
    };

    const handleDispatchCertificateUploaded = async () => {
        if (!isDispatchCoordinatorView || !currentUserId) {
            return;
        }

        const preparedAt = new Date().toISOString();
        const { error } = await supabase
            .from('applications')
            .update({
                docs_prepared_by: currentUserId,
                docs_prepared_at: preparedAt,
                last_updated_by: currentUserId,
            })
            .eq('id', id);

        if (error) {
            console.error('Failed to update dispatch preparation metadata:', error);
            return;
        }

        setApplication((previous) => previous ? {
            ...previous,
            docs_prepared_by: currentUserId,
            docs_prepared_at: preparedAt,
            docs_prepared_by_profile: currentUserName
                ? { full_name: currentUserName }
                : previous.docs_prepared_by_profile,
        } : previous);
    };

    const handleAssessorSetAppointmentDate = async () => {
        if (!application || !assessorAppointmentDate || !assessorAppointmentTime) {
            return;
        }

        setSavingAssessorAppointmentDate(true);

        try {
            const response = await fetch(`/api/applications/${id}/assessor-tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'set_appointment_date',
                    appointmentDate: assessorAppointmentDate,
                    appointmentTime: assessorAppointmentTime,
                    expectedUpdatedAt: application.updated_at,
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(
                    getWorkflowErrorFromPayload(
                        payload,
                        'Unable to assign the appointment date right now. Please try again.'
                    )
                );
            }

            const nextApplication = payload?.data?.application as Partial<ApplicationWithRelations> | undefined;
            setApplication((previous) => previous ? {
                ...previous,
                ...nextApplication,
            } : previous);
            setAssessorAppointmentDialogOpen(false);
            setActiveAssessorWorkflowStep('step-2');
            setWorkflowBannerMessage(null);
            setTimelineRefreshKey((previous) => previous + 1);

            toast.success('Appointment date assigned', {
                description: 'The assigned admin has been notified in-app.',
            });

            await refreshHistoryFeed();
        } catch (error) {
            toast.error('Unable to assign appointment date', {
                        description: getWorkflowErrorFromUnknown(
                            error,
                            'Unable to assign the appointment date right now. Please try again.'
                        ),
            });
        } finally {
            setSavingAssessorAppointmentDate(false);
        }
    };

    const handleAssessorMoveToEvaluate = async () => {
        if (!application) {
            return;
        }

        setMovingToEvaluate(true);

        try {
            const response = await fetch(`/api/applications/${id}/assessor-tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'start_evaluation',
                    expectedUpdatedAt: application.updated_at,
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(
                    getWorkflowErrorFromPayload(
                        payload,
                        'Unable to move this application to Evaluate right now. Please try again.'
                    )
                );
            }

            const nextApplication = payload?.data?.application as Partial<ApplicationWithRelations> | undefined;
            setApplication((previous) => previous ? {
                ...previous,
                ...nextApplication,
            } : previous);
            setActiveAssessorWorkflowStep('step-3');
            setActiveTab('documents');
            setWorkflowBannerMessage(null);
            setTimelineRefreshKey((previous) => previous + 1);

            toast.success('Application moved to Evaluate');

            await refreshHistoryFeed();
        } catch (error) {
            toast.error('Unable to move application', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to move this application to Evaluate right now. Please try again.'
                ),
            });
        } finally {
            setMovingToEvaluate(false);
        }
    };

    const handleSaveAssessmentReport = async () => {
        if (!application) {
            return;
        }

        setSavingAssessmentReport(true);

        try {
            const response = await fetch(`/api/applications/${id}/assessor-tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'save_assessment_report',
                    evaluationDate: assessmentReportForm.evaluationDate,
                    startTime: assessmentReportForm.startTime,
                    endTime: assessmentReportForm.endTime,
                    venue: assessmentReportForm.venue,
                    virtualPlatform: assessmentReportForm.venue === 'virtual' ? assessmentReportForm.virtualPlatform || null : null,
                    meetingRecordDocumentId: assessmentReportForm.venue === 'virtual' ? assessmentReportForm.meetingRecordDocumentId || null : null,
                    outcome: assessmentReportForm.outcome,
                    overview: assessmentReportForm.overview,
                    recommendation: assessmentReportForm.recommendation,
                    expectedUpdatedAt: application.updated_at,
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(
                    getWorkflowErrorFromPayload(
                        payload,
                        'Unable to save the assessment report right now. Please try again.'
                    )
                );
            }

            const nextApplication = payload?.data?.application as Partial<ApplicationWithRelations> | undefined;
            setApplication((previous) => previous ? {
                ...previous,
                ...nextApplication,
            } : previous);
            setActiveAssessorWorkflowStep('step-5');
            setWorkflowBannerMessage(null);
            setTimelineRefreshKey((previous) => previous + 1);

            toast.success('Assessment report saved', {
                description: 'The report is ready for the assessment result step.',
            });

            await refreshHistoryFeed();
        } catch (error) {
            toast.error('Unable to save assessment report', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to save the assessment report right now. Please try again.'
                ),
            });
        } finally {
            setSavingAssessmentReport(false);
        }
    };

    const handleAssessorSetAssessmentResult = async (result: Extract<AssessmentResult, 'pass' | 'failed'>) => {
        if (!application) {
            return;
        }

        setSavingAssessmentResult(result);

        try {
            const response = await fetch(`/api/applications/${id}/assessor-tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'set_assessment_result',
                    result,
                    expectedUpdatedAt: application.updated_at,
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(
                    getWorkflowErrorFromPayload(
                        payload,
                        'Unable to save the assessment result right now. Please try again.'
                    )
                );
            }

            const nextApplication = payload?.data?.application as Partial<ApplicationWithRelations> | undefined;
            setApplication((previous) => previous ? {
                ...previous,
                ...nextApplication,
            } : previous);
            setActiveAssessorWorkflowStep('step-4');
            setWorkflowBannerMessage(null);
            setTimelineRefreshKey((previous) => previous + 1);

            toast.success(`Application marked as ${result === 'pass' ? 'Pass' : 'Failed'}`, {
                description: 'The assigned admin has been notified in-app.',
            });

            await refreshHistoryFeed();
        } catch (error) {
            toast.error('Unable to save assessment result', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to save the assessment result right now. Please try again.'
                ),
            });
        } finally {
            setSavingAssessmentResult(null);
        }
    };

    const handleAdminMoveToAccounts = async () => {
        if (!application) {
            return;
        }

        setMovingToAccounts(true);

        try {
            const response = await fetch(`/api/applications/${id}/transition`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    toStage: 'accounts',
                    expectedUpdatedAt: application.updated_at,
                    notes: 'Moved from Evaluate to Accounts by assigned admin after a passing assessment.',
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(
                    getWorkflowErrorFromPayload(
                        payload,
                        'Unable to move this application to Accounts right now. Please try again.'
                    )
                );
            }

            const updatedAt = payload?.data?.updatedAt || application.updated_at;

            setApplication((previous) => previous ? {
                ...previous,
                workflow_stage: 'accounts',
                updated_at: updatedAt,
            } : previous);
            setAdminAccountsConfirmOpen(false);
            setWorkflowBannerMessage(null);
            setTimelineRefreshKey((previous) => previous + 1);

            toast.success('Application moved to Accounts');

            await refreshHistoryFeed();
        } catch (error) {
            toast.error('Unable to move application', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to move this application to Accounts right now. Please try again.'
                ),
            });
        } finally {
            setMovingToAccounts(false);
        }
    };

    const handleRequestDispatchApproval = async () => {
        if (!application) {
            return;
        }

        setRequestingDispatchApproval(true);

        try {
            const response = await fetch(`/api/applications/${id}/dispatch-approval`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    expectedUpdatedAt: application.updated_at,
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(
                    getWorkflowErrorFromPayload(
                        payload,
                        'Unable to request dispatch approval right now. Please try again.'
                    )
                );
            }

            setApplication((previous) => previous ? {
                ...previous,
                ...payload?.data?.application,
            } : previous);
            setTimelineRefreshKey((previous) => previous + 1);

            toast.success('CEO/Developer approval requested', {
                description: 'The dispatch approval request has been sent.',
            });

            await refreshHistoryFeed();
        } catch (error) {
            toast.error('Unable to request approval', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to request dispatch approval right now. Please try again.'
                ),
            });
        } finally {
            setRequestingDispatchApproval(false);
        }
    };

    const handleApproveDispatch = async () => {
        if (!application) {
            return;
        }

        setApprovingDispatchApproval(true);

        try {
            const response = await fetch(`/api/applications/${id}/dispatch-approval`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    expectedUpdatedAt: application.updated_at,
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(
                    getWorkflowErrorFromPayload(
                        payload,
                        'Unable to approve dispatch right now. Please try again.'
                    )
                );
            }

            setApplication((previous) => previous ? {
                ...previous,
                ...payload?.data?.application,
            } : previous);
            setTimelineRefreshKey((previous) => previous + 1);

            toast.success('Dispatch approved', {
                description: 'Accounts Manager can now move this application to Dispatch even if payment is not clear.',
            });

            await refreshHistoryFeed();
        } catch (error) {
            toast.error('Unable to approve dispatch', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to approve dispatch right now. Please try again.'
                ),
            });
        } finally {
            setApprovingDispatchApproval(false);
        }
    };

    const handleAccountsManagerMoveToDispatch = async () => {
        if (!application) {
            return;
        }

        setMovingToDispatch(true);

        try {
            const response = await fetch(`/api/applications/${id}/transition`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    toStage: 'dispatch',
                    expectedUpdatedAt: application.updated_at,
                    notes: hasClearDispatchPayment
                        ? 'Moved from Accounts to Dispatch by accounts manager after payment cleared.'
                        : 'Moved from Accounts to Dispatch by accounts manager with CEO/Developer approval before payment cleared.',
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(
                    getWorkflowErrorFromPayload(
                        payload,
                        'Unable to move this application to Dispatch right now. Please try again.'
                    )
                );
            }

            const updatedAt = payload?.data?.updatedAt || application.updated_at;

            setApplication((previous) => previous ? {
                ...previous,
                workflow_stage: 'dispatch',
                updated_at: updatedAt,
                dispatch_override_used: !hasClearDispatchPayment && hasDispatchApprovalGranted,
            } : previous);
            setAccountsDispatchConfirmOpen(false);
            setWorkflowBannerMessage(null);
            setTimelineRefreshKey((previous) => previous + 1);

            toast.success('Application moved to Dispatch');

            await refreshHistoryFeed();
        } catch (error) {
            toast.error('Unable to move application', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to move this application to Dispatch right now. Please try again.'
                ),
            });
        } finally {
            setMovingToDispatch(false);
        }
    };

    const handleDispatchCoordinatorMarkCompleted = async () => {
        if (!application) {
            return;
        }

        if (application.workflow_stage !== 'dispatch') {
            toast.error('This action is only available for dispatch applications');
            setDispatchCompleteConfirmOpen(false);
            return;
        }

        if (!lockState.canEdit) {
            toast.error('You need to acquire a lock to perform this action');
            return;
        }

        if (transitionOptionsQuery.isLoading) {
            toast.error('Workflow actions are still loading. Please wait a moment and try again.');
            return;
        }

        if (!canDispatchChangeToCompleted) {
            toast.error('Unable to complete application', {
                description: dispatchCompletedOption?.blockedReason
                    || 'Upload a Certificate PDF before marking this application as Completed.',
            });
            return;
        }

        setCompletingDispatch(true);

        try {
            const response = await fetch(`/api/applications/${id}/transition`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    toStage: 'completed',
                    expectedUpdatedAt: application.updated_at,
                    notes: 'Marked as Completed by dispatch coordinator after certificate upload',
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(
                    getWorkflowErrorFromPayload(
                        payload,
                        'Unable to mark this application as Completed right now. Please try again.'
                    )
                );
            }

            const updatedAt = payload?.data?.updatedAt || application.updated_at;
            const deliveryDate = new Date().toISOString();

            setApplication((previous) => previous ? {
                ...previous,
                workflow_stage: 'completed',
                updated_at: updatedAt,
                is_delivered: true,
                delivery_date: deliveryDate,
                delivered_by_profile: currentUserName
                    ? { full_name: currentUserName }
                    : previous.delivered_by_profile,
            } : previous);
            setDispatchCompleteConfirmOpen(false);
            setWorkflowBannerMessage(null);
            setTimelineRefreshKey((previous) => previous + 1);

            toast.success('Application marked as Completed');

            await refreshHistoryFeed();
        } catch (error) {
            toast.error('Unable to complete application', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to mark this application as Completed right now. Please try again.'
                ),
            });
        } finally {
            setCompletingDispatch(false);
        }
    };

    const handlePreviewMissingDocsEmail = async () => {
        if (!application) {
            return;
        }

        if (selectedMissingDocuments.length === 0) {
            toast.error('Select at least one missing document');
            return;
        }

        setPreviewingMissingDocsEmail(true);

        try {
            const response = await fetch(`/api/applications/${id}/missing-docs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    missingDocuments: selectedMissingDocuments,
                    note: missingDocsNote.trim() || undefined,
                    previewOnly: true,
                }),
            });

            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    getWorkflowErrorFromPayload(
                        payload,
                        'Unable to generate the missing-document preview right now. Please try again.'
                    )
                );
            }

            setMissingDocsEmailPreview({
                recipient: payload?.data?.recipient || '',
                subject: payload?.data?.subject || '',
                body: payload?.data?.body || '',
            });
        } catch (error) {
            toast.error('Unable to generate preview', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to generate the missing-document preview right now. Please try again.'
                ),
            });
        } finally {
            setPreviewingMissingDocsEmail(false);
        }
    };

    const handleSendMissingDocsToAgent = async () => {
        if (!application) {
            return;
        }

        if (selectedMissingDocuments.length === 0) {
            toast.error('Select at least one missing document');
            return;
        }

        setSendingMissingDocsEmail(true);

        try {
            const response = await fetch(`/api/applications/${id}/missing-docs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    missingDocuments: selectedMissingDocuments,
                    note: missingDocsNote.trim() || undefined,
                }),
            });

            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    getWorkflowErrorFromPayload(
                        payload,
                        'Unable to notify the agent right now. Please try again.'
                    )
                );
            }

            setMissingDocsDialogOpen(false);
            setMissingDocsEmailPreview(null);
            toast.success('Missing-document email queued to agent', {
                description: payload?.data?.recipient || 'The assigned agent will be notified shortly.',
            });

            void fetch('/api/notifications/process?limit=20&includeReminders=false', {
                method: 'POST',
            }).catch(() => {
                // Queue remains scheduled for background processing even if immediate processing fails.
            });

            const { data: hist } = await supabase
                .from('application_history')
                .select('*, user:profiles(full_name)')
                .eq('application_id', id)
                .order('created_at', { ascending: false });

            if (hist) {
                setHistory(hist);
            }
        } catch (error) {
            toast.error('Unable to notify agent', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to notify the agent right now. Please try again.'
                ),
            });
        } finally {
            setSendingMissingDocsEmail(false);
        }
    };


    if (loading) {
        return (
            <main className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </main>
        );
    }

    if (!application) {
        return (
            <main className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-2">Application not found</h2>
                    <Link href={`${routeBase}/applications`}>
                        <Button variant="outline">Back to Applications</Button>
                    </Link>
                </div>
            </main>
        );
    }

    const renderedEmailPreviewSubject = renderEmailTemplateContent(emailSubject, application).trim();
    const renderedEmailPreviewBody = renderEmailTemplateContent(emailBody, application).trim();

    return (
        <>
            <Dialog
                open={assessorAppointmentDialogOpen}
                onOpenChange={(open) => {
                    if (savingAssessorAppointmentDate) {
                        return;
                    }

                    setAssessorAppointmentDialogOpen(open);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign appointment date</DialogTitle>
                        <DialogDescription>
                            Save the appointment date and time before moving this application to Evaluate.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="assessor-appointment-date">Appointment Date</Label>
                            <Input
                                id="assessor-appointment-date"
                                type="date"
                                value={assessorAppointmentDate}
                                onChange={(event) => setAssessorAppointmentDate(event.target.value)}
                                disabled={savingAssessorAppointmentDate}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="assessor-appointment-time">Appointment Time</Label>
                            <TimePickerField
                                value={assessorAppointmentTime}
                                onChange={setAssessorAppointmentTime}
                                disabled={savingAssessorAppointmentDate}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setAssessorAppointmentDialogOpen(false)}
                            disabled={savingAssessorAppointmentDate}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => void handleAssessorSetAppointmentDate()}
                            disabled={savingAssessorAppointmentDate || !assessorAppointmentDate || !assessorAppointmentTime}
                        >
                            {savingAssessorAppointmentDate ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Save Appointment Date
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`${routeBase}/applications`}>
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">UID(Unique Identity)</p>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-semibold text-foreground">
                                    {application.student_uid}
                                </h1>
                                <WorkflowStatusBadge stage={application.workflow_stage} />
                                {application.source_portal === 'sharp_future' ? (
                                    <Badge variant="outline" className="bg-cyan-100 text-cyan-700 border-cyan-300">
                                        Transferred from Sharp Future
                                    </Badge>
                                ) : null}
                                {application.dispatch_override_used && application.payment_status !== 'paid' ? (
                                    <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                                        Payment Not Cleared
                                    </Badge>
                                ) : null}
                                <RecordStatusBadges
                                    isArchived={application.is_archived}
                                    isDeleted={application.is_deleted}
                                />
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                {application.student_first_name} {application.student_last_name}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <LockIndicator
                            isLocked={lockState.isLocked}
                            lockedByName={lockState.lockedByName}
                            lockedAt={lockState.lockedAt}
                            isOwnLock={lockState.isOwnLock}
                            canEdit={lockState.canEdit}
                            onAcquireLock={acquireLock}
                            onReleaseLock={releaseLock}
                            isLoading={lockLoading}
                            error={lockError}
                        />
                        {can('applications.edit') && (
                            <Link href={`${routeBase}/applications/${id}/edit`}>
                                <Button variant="outline" size="sm" className="gap-2">
                                    <Pencil className="h-4 w-4" />
                                    Edit Application
                                </Button>
                            </Link>
                        )}
                        {isAssignedAdmin && application.workflow_stage === 'evaluate' && application.assessment_result === 'pass' ? (
                            <AlertDialog
                                open={adminAccountsConfirmOpen}
                                onOpenChange={(open) => {
                                    if (movingToAccounts) return;
                                    setAdminAccountsConfirmOpen(open);
                                }}
                            >
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                        disabled={
                                            !lockState.canEdit
                                            || movingToAccounts
                                            || transitionOptionsQuery.isLoading
                                            || !canAdminMoveToAccounts
                                        }
                                        title={
                                            !lockState.canEdit
                                                ? 'Acquire lock to update status'
                                                : adminAccountsOption?.blockedReason || undefined
                                        }
                                    >
                                        {movingToAccounts ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Receipt className="h-4 w-4" />
                                        )}
                                        Move to Accounts
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Move application to Accounts?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will hand the passed application to Accounts Manager for invoice, bill, and payment processing.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={movingToAccounts}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={(event) => {
                                                event.preventDefault();
                                                void handleAdminMoveToAccounts();
                                            }}
                                            disabled={movingToAccounts}
                                        >
                                            {movingToAccounts ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : null}
                                            Confirm
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        ) : null}
                        {isAccountsManagerView && isPassedAccountsFinanceQueue && !hasClearDispatchPayment ? (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                disabled={
                                    !lockState.canEdit
                                    || requestingDispatchApproval
                                    || hasDispatchApprovalRequest
                                    || hasDispatchApprovalGranted
                                    || !application.xero_invoice_id
                                    || !application.xero_bill_id
                                }
                                title={
                                    !lockState.canEdit
                                        ? 'Acquire lock to update status'
                                        : !application.xero_invoice_id || !application.xero_bill_id
                                            ? 'Create both the Xero invoice and Xero bill first'
                                            : undefined
                                }
                                onClick={() => void handleRequestDispatchApproval()}
                            >
                                {requestingDispatchApproval ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <ShieldAlert className="h-4 w-4" />
                                )}
                                {hasDispatchApprovalGranted
                                    ? 'Dispatch Approved'
                                    : hasDispatchApprovalRequest
                                        ? 'CEO Approval Requested'
                                        : 'CEO Approval'}
                            </Button>
                        ) : null}
                        {(role === 'ceo' || role === 'developer') && application.workflow_stage === 'accounts' && hasDispatchApprovalRequest && !hasDispatchApprovalGranted ? (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                disabled={!lockState.canEdit || approvingDispatchApproval}
                                title={!lockState.canEdit ? 'Acquire lock to update status' : undefined}
                                onClick={() => void handleApproveDispatch()}
                            >
                                {approvingDispatchApproval ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCircle className="h-4 w-4" />
                                )}
                                Approve Dispatch
                            </Button>
                        ) : null}
                        {isDispatchCoordinatorView && application.workflow_stage === 'dispatch' ? (
                            <AlertDialog
                                open={dispatchCompleteConfirmOpen}
                                onOpenChange={(open) => {
                                    if (completingDispatch) return;
                                    setDispatchCompleteConfirmOpen(open);
                                }}
                            >
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                        disabled={
                                            !lockState.canEdit
                                            || completingDispatch
                                            || transitionOptionsQuery.isLoading
                                            || !canDispatchChangeToCompleted
                                        }
                                        title={
                                            !lockState.canEdit
                                                ? 'Acquire lock to update status'
                                                : dispatchCompletedOption?.blockedReason || undefined
                                        }
                                    >
                                        {completingDispatch ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <CheckCircle className="h-4 w-4" />
                                        )}
                                        Completed
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Mark application as Completed?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will move the application from Dispatch to Completed after the Certificate PDF has been uploaded.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={completingDispatch}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={(event) => {
                                                event.preventDefault();
                                                void handleDispatchCoordinatorMarkCompleted();
                                            }}
                                            disabled={completingDispatch}
                                        >
                                            {completingDispatch ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : null}
                                            Confirm
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        ) : null}
                        {isAccountsManagerView && isPassedAccountsFinanceQueue ? (
                            <AlertDialog
                                open={accountsDispatchConfirmOpen}
                                onOpenChange={(open) => {
                                    if (movingToDispatch) return;
                                    setAccountsDispatchConfirmOpen(open);
                                }}
                            >
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                        disabled={
                                            !lockState.canEdit
                                            || movingToDispatch
                                            || transitionOptionsQuery.isLoading
                                            || !canAccountsManagerDispatch
                                            || !canAccountsChangeToDispatch
                                        }
                                        title={
                                            !lockState.canEdit
                                                ? 'Acquire lock to update status'
                                                : accountsDispatchOption?.blockedReason || undefined
                                        }
                                    >
                                        {movingToDispatch ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Receipt className="h-4 w-4" />
                                        )}
                                        Change to Dispatch
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Change application to Dispatch?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will move the application from Accounts to Dispatch after finance processing is complete.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={movingToDispatch}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={(event) => {
                                                event.preventDefault();
                                                void handleAccountsManagerMoveToDispatch();
                                            }}
                                            disabled={movingToDispatch}
                                        >
                                            {movingToDispatch ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : null}
                                            Confirm
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        ) : null}
                        {role === 'admin' && can('applications.change_stage') && application.workflow_stage === 'docs_review' && (
                            <AlertDialog
                                open={adminEnrollmentConfirmOpen}
                                onOpenChange={(open) => {
                                    if (confirmingEnrollment) return;
                                    setAdminEnrollmentConfirmOpen(open);
                                }}
                            >
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                        disabled={
                                            !lockState.canEdit
                                            || confirmingEnrollment
                                            || transitionOptionsQuery.isLoading
                                            || !canAdminConfirmEnrollment
                                        }
                                        title={
                                            !lockState.canEdit
                                                ? 'Acquire lock to update status'
                                                : adminEnrolledOption?.blockedReason || undefined
                                        }
                                    >
                                        {confirmingEnrollment ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <CheckCircle className="h-4 w-4" />
                                        )}
                                        Confirm Enrollment
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Confirm enrollment?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will move the application from Docs Review to Enrolled and notify all executive managers in-app.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={confirmingEnrollment}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={(event) => {
                                                event.preventDefault();
                                                void handleConfirmEnrollment();
                                            }}
                                            disabled={confirmingEnrollment}
                                        >
                                            {confirmingEnrollment ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : null}
                                            Confirm
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </div>
            </header>

            <div className="p-6">
                {/* Lock Banner */}
                <LockBanner
                    isLocked={lockState.isLocked}
                    lockedByName={lockState.lockedByName}
                    isOwnLock={lockState.isOwnLock}
                    canEdit={lockState.canEdit}
                    onAcquireLock={acquireLock}
                    error={lockError}
                />

                <div className="mt-4">
                    <WorkflowConflictBanner message={workflowBannerMessage} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Details */}
                    <div className="lg:col-span-2 space-y-6">
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="h-auto flex-wrap justify-start">
                                <TabsTrigger value="overview" className="flex-none">Overview</TabsTrigger>
                                <TabsTrigger value="documents" className="flex-none items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Documents ({documents.length})
                                </TabsTrigger>
                                {canViewAssessmentReportTab ? (
                                    <TabsTrigger value="assessment-report" className="flex-none items-center gap-2">
                                        <FilePlus2 className="h-4 w-4" />
                                        Assessment Report
                                    </TabsTrigger>
                                ) : null}
                                {canViewAccountsTab ? (
                                    <TabsTrigger value="accounts" className="flex-none items-center gap-2">
                                        <Receipt className="h-4 w-4" />
                                        Accounts
                                    </TabsTrigger>
                                ) : null}
                                <TabsTrigger value="comments" className="flex-none items-center gap-2">
                                    <MessageSquare className="h-4 w-4" />
                                    Comments ({comments.length})
                                </TabsTrigger>
                                <TabsTrigger
                                    value="history"
                                    className="flex-none items-center gap-2"
                                    title={`${history.length} workflow events cached in the background`}
                                >
                                    <History className="h-4 w-4" />
                                    Version History
                                </TabsTrigger>
                                <TabsTrigger value="timeline" className="flex-none items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Timeline
                                </TabsTrigger>
                                <TabsTrigger value="activity" className="flex-none items-center gap-2">
                                    <Activity className="h-4 w-4" />
                                    Activity Feed
                                </TabsTrigger>
                            </TabsList>

                            {/* Overview Tab */}
                            <TabsContent value="overview" className="space-y-6 mt-6">
                                {/* Application Info + Applicant Info - Two Columns */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Application Information */}
                                    <Card>
                                        <CardHeader className="bg-blue-50 border-b">
                                            <CardTitle className="text-lg">Application Information</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <table className="w-full text-sm">
                                                <tbody>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Application ID</td>
                                                        <td className="px-4 py-2 font-medium">{resolveApplicationId(application.application_number, application.student_uid)}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Qualification Name</td>
                                                        <td className="px-4 py-2 font-medium">
                                                            {getApplicationQualification(application)?.id && !isFrontdeskView ? (
                                                                <Link href={`${routeBase}/qualifications/${getApplicationQualification(application)?.id}`} className="text-primary hover:underline">
                                                                    {getApplicationQualification(application)?.name}
                                                                </Link>
                                                            ) : getApplicationQualification(application)?.name || '-'}
                                                        </td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Qualification Code</td>
                                                        <td className="px-4 py-2 font-mono">{getApplicationQualification(application)?.code || '-'}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Application Received By</td>
                                                        <td className="px-4 py-2 font-medium">{application.received_by_profile?.full_name || application.created_by_profile?.full_name || '-'}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Application Received Date</td>
                                                        <td className="px-4 py-2 font-medium">{formatDate(application.received_at || application.created_at)}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">RTO Name</td>
                                                        <td className="px-4 py-2 font-medium">
                                                            {application.offering?.rto?.name || 'N/A'}
                                                        </td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Application Status</td>
                                                        <td className="px-4 py-2">
                                                            <WorkflowStatusBadge stage={application.workflow_stage} />
                                                        </td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Appointment Date</td>
                                                        <td className="px-4 py-2 font-medium">{formatAppointmentDateTime(application.appointment_date, application.appointment_time)}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Assessment Result</td>
                                                        <td className="px-4 py-2">
                                                            <Badge
                                                                variant="outline"
                                                                className={ASSESSMENT_RESULT_COLORS[application.assessment_result]}
                                                            >
                                                                {ASSESSMENT_RESULT_LABELS[application.assessment_result]}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Payment Status</td>
                                                        <td className="px-4 py-2">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <Badge variant="outline" className={
                                                                    application.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                                                                        application.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                                                            'bg-gray-100 text-gray-700'
                                                                }>
                                                                    {application.payment_status || 'Unpaid'}
                                                                </Badge>
                                                                {application.dispatch_override_used && application.payment_status !== 'paid' ? (
                                                                    <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                                                                        Dispatch Override
                                                                    </Badge>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Created At</td>
                                                        <td className="px-4 py-2 font-medium">{formatDateTime(application.created_at)}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Last Updated</td>
                                                        <td className="px-4 py-2 font-medium">{formatDateTime(application.updated_at)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="px-4 py-2 text-muted-foreground">Last Updated By</td>
                                                        <td className="px-4 py-2 font-medium">{application.last_updated_by_profile?.full_name || '-'}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </CardContent>
                                    </Card>

                                    {/* Applicant Information */}
                                    <Card>
                                        <CardHeader className="bg-amber-50 border-b">
                                            <CardTitle className="text-lg">Applicant Information</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <table className="w-full text-sm">
                                                <tbody>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Applicant&apos;s Full Name</td>
                                                        <td className="px-4 py-2 font-medium">{application.student_first_name} {application.student_last_name}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Agent&apos;s Name</td>
                                                        <td className="px-4 py-2 font-medium">
                                                            {application.partner?.id && !isFrontdeskView ? (
                                                                <Link href={`${routeBase}/partners/${application.partner.id}`} className="text-primary hover:underline">
                                                                    {application.partner.company_name}
                                                                </Link>
                                                            ) : application.partner?.company_name || '-'}
                                                        </td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Date of Birth</td>
                                                        <td className="px-4 py-2 font-medium">{formatDate(application.student_dob)}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Gender</td>
                                                        <td className="px-4 py-2 font-medium">{application.student_gender || '-'}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Student Email</td>
                                                        <td className="px-4 py-2 font-medium">{application.student_email || '-'}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Student Mobile</td>
                                                        <td className="px-4 py-2 font-medium">{application.student_phone || '-'}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Country of Birth</td>
                                                        <td className="px-4 py-2 font-medium">{application.student_country_of_birth || application.student_nationality || '-'}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">Application From</td>
                                                        <td className="px-4 py-2 font-medium">{application.application_from || '-'}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground">UID(Unique Identity)</td>
                                                        <td className="px-4 py-2 font-medium">{application.student_uid || '-'}</td>
                                                    </tr>
                                                    <tr className="border-b bg-muted/30">
                                                        <td className="px-4 py-2 text-muted-foreground font-medium" colSpan={2}>Address:</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground pl-8">Street No.</td>
                                                        <td className="px-4 py-2 font-medium">{application.student_street_no || application.student_address || '-'}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground pl-8">Suburb</td>
                                                        <td className="px-4 py-2 font-medium">{application.student_suburb || '-'}</td>
                                                    </tr>
                                                    <tr className="border-b">
                                                        <td className="px-4 py-2 text-muted-foreground pl-8">State</td>
                                                        <td className="px-4 py-2 font-medium">{application.student_state || '-'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="px-4 py-2 text-muted-foreground pl-8">Postcode</td>
                                                        <td className="px-4 py-2 font-medium">{application.student_postcode || '-'}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </CardContent>
                                    </Card>
                                </div>

                                {!isAssessorView ? (
                                    <RtoPaymentSection
                                        applicationId={id}
                                        currentRtoId={application.offering?.rto?.id}
                                        currentQualificationId={getApplicationQualification(application)?.id}
                                        updatedAt={application.updated_at}
                                        assignedAssessorId={application.assigned_assessor_id}
                                        assignedAdminId={application.assigned_admin_id}
                                        workflowStage={application.workflow_stage}
                                        actorRole={role}
                                        onUpdate={() => window.location.reload()}
                                        canEdit={lockState.canEdit}
                                    />
                                ) : null}

                                {/* Recent Comments Preview */}
                                <Card>
                                    <CardHeader className="bg-violet-50 border-b">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <MessageSquare className="h-5 w-5" />
                                            Recent Comments
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 space-y-4">
                                        {comments.length > 0 ? (
                                            <>
                                                <div className="space-y-4">
                                                    {comments.slice(0, 3).map((comment) => {
                                                        const commentAuthor = (
                                                            comment.user as { full_name?: string | null } | null
                                                        )?.full_name || 'Unknown';

                                                        return (
                                                            <div key={comment.id} className="border-b pb-3 last:border-0 last:pb-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="font-medium text-sm">{commentAuthor}</span>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {formatDateTime(comment.created_at)}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm text-muted-foreground line-clamp-3">
                                                                    <CommentContent content={comment.content} />
                                                                </p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {comments.length > 3 && (
                                                    <p className="text-xs text-muted-foreground pt-1">
                                                        Showing latest 3 comments. Open the Comments tab to view all.
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-center py-6 text-muted-foreground">
                                                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                                <p>No comments yet</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Notes Section */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Notes</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <p className="text-sm whitespace-pre-wrap">{application.notes || 'No notes'}</p>
                                        <Separator />
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <p className="text-muted-foreground">Issue Date</p>
                                                <p className="font-medium">{formatDate(application.issue_date) || '-'}</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                                            <p className="text-sm font-medium mb-2">Signed off by:</p>
                                            <div className="grid grid-cols-3 gap-4 text-sm">
                                                <div>
                                                    <p className="text-muted-foreground">Name</p>
                                                    <p className="font-medium">{application.signed_off_by_profile?.full_name || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground">Date</p>
                                                    <p className="font-medium">{formatDate(application.signed_off_at) || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground">Time</p>
                                                    <p className="font-medium">{application.signed_off_at ? new Date(application.signed_off_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                            </TabsContent>

                            {/* Documents Tab */}
                            <TabsContent value="documents" className="mt-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Documents</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        {/* Upload Section */}
                                        {(role === 'admin' || can('documents.upload'))
                                            && (!isAssessorView || application.workflow_stage === 'evaluate')
                                            && (!isDispatchCoordinatorView || application.workflow_stage === 'dispatch') && (
                                            <DocumentUpload
                                                applicationId={id}
                                                documentTypes={isDispatchCoordinatorView ? ['Certificate'] : isAssignedAssessor ? ['Student Assessment Report'] : undefined}
                                                validateSelectedFile={isDispatchCoordinatorView
                                                    ? (file, documentType) => {
                                                        if (documentType !== 'Certificate') {
                                                            return 'Dispatch uploads must use the Certificate document type.';
                                                        }

                                                        const mimeType = (file.type || '').toLowerCase();
                                                        const isPdf = mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                                                        return isPdf ? null : 'Certificate must be uploaded as a PDF file.';
                                                    }
                                                    : undefined}
                                                acceptedMimeTypes={isDispatchCoordinatorView ? ['application/pdf'] : STANDARD_DOCUMENT_UPLOAD_MIME_TYPES}
                                                onUploadComplete={(doc) => {
                                                    setDocuments((prev) => [doc, ...prev]);
                                                    if (isAssignedAssessor && ['Student Assessment Report', 'Evaluation File'].includes(doc.document_type)) {
                                                        setActiveAssessorWorkflowStep('step-4');
                                                    }
                                                    if (isDispatchCoordinatorView) {
                                                        void handleDispatchCertificateUploaded();
                                                    }
                                                }}
                                                onError={(err) => console.error('Upload error:', err)}
                                                onFieldsExtracted={handleFieldsExtracted}
                                            />
                                        )}

                                        {isAssignedAssessor && application.workflow_stage !== 'evaluate' ? (
                                            <p className="text-sm text-muted-foreground">
                                                Student assessment reports can be uploaded once the application has moved to Evaluate.
                                            </p>
                                        ) : isAssignedAssessor ? (
                                            <p className="text-sm text-muted-foreground">
                                                Assessors can upload only <span className="font-medium">Student Assessment Report</span> documents during the Evaluate step.
                                            </p>
                                        ) : isDispatchCoordinatorView && application.workflow_stage !== 'dispatch' ? (
                                            <p className="text-sm text-muted-foreground">
                                                Certificate uploads are available while the application is in Dispatch.
                                            </p>
                                        ) : null}

                                        <Separator />

                                        {/* Document List */}
                                        {documents.length > 0 ? (
                                            <div className="space-y-3">
                                                {documents.map((doc) => (
                                                    <div
                                                        key={doc.id}
                                                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                                <FileText className="h-5 w-5 text-primary" />
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-sm">{doc.file_name}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {doc.document_type} • {formatDateTime(doc.created_at)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {doc.is_verified ? (
                                                                <Badge variant="outline" className="bg-green-50 text-green-700">
                                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                                    Verified
                                                                </Badge>
                                                            ) : (
                                                                <Badge
                                                                    variant="outline"
                                                                    className={isFrontdeskView ? 'bg-blue-50 text-blue-700' : 'bg-yellow-50 text-yellow-700'}
                                                                >
                                                                    <Clock className="h-3 w-3 mr-1" />
                                                                    {isFrontdeskView ? 'Uploaded' : 'Pending Review'}
                                                                </Badge>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleOpenDocumentPreview(doc)}
                                                                title="View document"
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDownloadDocument(doc)}
                                                                disabled={downloadingDocumentId === doc.id}
                                                                title="Download document"
                                                            >
                                                                {downloadingDocumentId === doc.id ? (
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
                                            <div className="text-center py-8 text-muted-foreground">
                                                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                                <p>No documents uploaded yet</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {canViewAssessmentReportTab ? (
                                <TabsContent value="assessment-report" className="mt-6">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg">Assessment Report</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label htmlFor="assessment-report-date">Evaluation Log: Date</Label>
                                                    <Input
                                                        id="assessment-report-date"
                                                        type="date"
                                                        value={assessmentReportForm.evaluationDate}
                                                        onChange={(event) => setAssessmentReportForm((previous) => ({ ...previous, evaluationDate: event.target.value }))}
                                                        disabled={!canEditAssessmentReport || savingAssessmentReport}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="assessment-report-start-time">Start Time</Label>
                                                    <Input
                                                        id="assessment-report-start-time"
                                                        type="time"
                                                        value={assessmentReportForm.startTime}
                                                        onChange={(event) => setAssessmentReportForm((previous) => ({ ...previous, startTime: event.target.value }))}
                                                        disabled={!canEditAssessmentReport || savingAssessmentReport}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="assessment-report-end-time">End Time</Label>
                                                    <Input
                                                        id="assessment-report-end-time"
                                                        type="time"
                                                        value={assessmentReportForm.endTime}
                                                        onChange={(event) => setAssessmentReportForm((previous) => ({ ...previous, endTime: event.target.value }))}
                                                        disabled={!canEditAssessmentReport || savingAssessmentReport}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Venue</Label>
                                                    <Select
                                                        value={assessmentReportForm.venue}
                                                        onValueChange={(value: AssessmentReportVenue) => setAssessmentReportForm((previous) => ({
                                                            ...previous,
                                                            venue: value,
                                                            virtualPlatform: value === 'virtual' ? previous.virtualPlatform : '',
                                                            meetingRecordDocumentId: value === 'virtual' ? previous.meetingRecordDocumentId : '',
                                                        }))}
                                                        disabled={!canEditAssessmentReport || savingAssessmentReport}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="on_campus">{ASSESSMENT_REPORT_VENUE_LABELS.on_campus}</SelectItem>
                                                            <SelectItem value="virtual">{ASSESSMENT_REPORT_VENUE_LABELS.virtual}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {requiresMeetingRecord ? (
                                                <div className="space-y-4 rounded-lg border p-4">
                                                    <div className="space-y-2">
                                                        <Label>Virtual Platform</Label>
                                                        <Select
                                                            value={assessmentReportForm.virtualPlatform}
                                                            onValueChange={(value: AssessmentReportVirtualPlatform) => setAssessmentReportForm((previous) => ({ ...previous, virtualPlatform: value }))}
                                                            disabled={!canEditAssessmentReport || savingAssessmentReport}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select platform" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="google_meet">{ASSESSMENT_REPORT_PLATFORM_LABELS.google_meet}</SelectItem>
                                                                <SelectItem value="zoom">{ASSESSMENT_REPORT_PLATFORM_LABELS.zoom}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {canEditAssessmentReport ? (
                                                        <div className="space-y-3">
                                                            <Label>Meeting Record (.mp4)</Label>
                                                            <DocumentUpload
                                                                applicationId={id}
                                                                documentTypes={['Assessment Meeting Record']}
                                                                acceptedMimeTypes={['video/mp4']}
                                                                maxFileSize={100 * 1024 * 1024}
                                                                onUploadComplete={(doc) => {
                                                                    setDocuments((previous) => [doc, ...previous]);
                                                                    setAssessmentReportForm((previous) => ({
                                                                        ...previous,
                                                                        meetingRecordDocumentId: doc.id,
                                                                    }));
                                                                }}
                                                                onError={(err) => console.error('Meeting record upload error:', err)}
                                                            />
                                                        </div>
                                                    ) : null}

                                                    {meetingRecordDocument ? (
                                                        <div className="flex items-center justify-between rounded-md border p-3 text-sm">
                                                            <div>
                                                                <p className="font-medium">{meetingRecordDocument.file_name}</p>
                                                                <p className="text-muted-foreground">Assessment meeting record</p>
                                                            </div>
                                                            <Button variant="outline" size="sm" onClick={() => void handleDownloadDocument(meetingRecordDocument)}>
                                                                <Download className="mr-2 h-4 w-4" />
                                                                Download
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground">
                                                            Upload the meeting record before saving a virtual assessment report.
                                                        </p>
                                                    )}
                                                </div>
                                            ) : null}

                                            <div className="space-y-2">
                                                <Label htmlFor="assessment-report-outcome">Outcome</Label>
                                                <Textarea
                                                    id="assessment-report-outcome"
                                                    rows={4}
                                                    value={assessmentReportForm.outcome}
                                                    onChange={(event) => setAssessmentReportForm((previous) => ({ ...previous, outcome: event.target.value }))}
                                                    disabled={!canEditAssessmentReport || savingAssessmentReport}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="assessment-report-overview">Overview</Label>
                                                <Textarea
                                                    id="assessment-report-overview"
                                                    rows={4}
                                                    value={assessmentReportForm.overview}
                                                    onChange={(event) => setAssessmentReportForm((previous) => ({ ...previous, overview: event.target.value }))}
                                                    disabled={!canEditAssessmentReport || savingAssessmentReport}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="assessment-report-recommendation">Recommendation</Label>
                                                <Textarea
                                                    id="assessment-report-recommendation"
                                                    rows={4}
                                                    value={assessmentReportForm.recommendation}
                                                    onChange={(event) => setAssessmentReportForm((previous) => ({ ...previous, recommendation: event.target.value }))}
                                                    disabled={!canEditAssessmentReport || savingAssessmentReport}
                                                />
                                            </div>

                                            {canEditAssessmentReport ? (
                                                <div className="flex justify-end">
                                                    <Button onClick={() => void handleSaveAssessmentReport()} disabled={savingAssessmentReport}>
                                                        {savingAssessmentReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                        Save Assessment Report
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                                                    This assessment report is read-only.
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            ) : null}

                            {/* Accounts Tab */}
                            {canViewAccountsTab ? (
                                <TabsContent value="accounts" className="mt-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <ApplicationFeeSection
                                            applicationId={id}
                                            amount={application.offering?.application_fee ?? 0}
                                            hasQualification={Boolean(application.offering?.qualification)}
                                            canUseActions={!isDispatchCoordinatorView}
                                            xeroActionUnavailableReason={xeroActionUnavailableReason}
                                            onInvoiceChanged={() => loadApplicationData({ showLoading: false })}
                                        />

                                        {[
                                            {
                                                id: 'agent_fee',
                                                title: 'Agent Fee (Payment)',
                                                amount: application.offering?.agent_fee ?? 0,
                                                status: 'unpaid',
                                                canAction: false,
                                                isPrimary: false
                                            },
                                            {
                                                id: 'assessor_fee',
                                                title: 'Assessor Fee (Payment)',
                                                amount: application.offering?.assessor_fee ?? 0,
                                                status: 'unpaid',
                                                canAction: false,
                                                isPrimary: false
                                            }
                                        ].map((feeInfo) => (
                                            <Card key={feeInfo.id} className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
                                                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-muted/20">
                                                    <CardTitle className="text-base font-semibold">{feeInfo.title}</CardTitle>
                                                    <Badge
                                                        variant={
                                                            feeInfo.status === 'payment_received' || feeInfo.status === 'paid' ? 'default' :
                                                            feeInfo.status === 'payment_pending' ? 'secondary' :
                                                            feeInfo.status === 'in_review' ? 'outline' : 'destructive'
                                                        }
                                                        className={
                                                            feeInfo.status === 'payment_received' || feeInfo.status === 'paid' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                                                            feeInfo.status === 'payment_pending' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' :
                                                            feeInfo.status === 'in_review' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                                                            'bg-red-100 text-red-700 hover:bg-red-100'
                                                        }
                                                    >
                                                        {(feeInfo.status || 'unpaid').replace(/_/g, ' ').toUpperCase()}
                                                    </Badge>
                                                </CardHeader>
                                                <CardContent className="pt-6 flex-grow">
                                                    <div className="mb-4 text-center">
                                                        <p className="text-sm text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Amount</p>
                                                        <p className="text-3xl font-bold text-foreground">
                                                            {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(feeInfo.amount))}
                                                        </p>
                                                    </div>
                                                </CardContent>
                                                <div className="p-4 pt-0 mt-auto border-t bg-muted/10">
                                                    <div className="flex justify-between gap-2 pt-4">
                                                        {!isDispatchCoordinatorView ? (
                                                            <>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="flex-1 text-xs"
                                                                    disabled
                                                                    title="Coming soon"
                                                                >
                                                                    <FileText className="h-3 w-3 mr-1" />
                                                                    <span className="hidden sm:inline">Create Invoice</span>
                                                                    <span className="sm:hidden">Invoice</span>
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="flex-1 text-xs"
                                                                    disabled
                                                                    title="Coming soon"
                                                                >
                                                                    <Download className="h-3 w-3 mr-1" />
                                                                    <span className="hidden sm:inline">Download PDF</span>
                                                                    <span className="sm:hidden">PDF</span>
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="flex-1 text-xs"
                                                                    disabled
                                                                    title="Coming soon"
                                                                >
                                                                    <Receipt className="h-3 w-3 mr-1" />
                                                                    <span className="hidden sm:inline">Create Bill</span>
                                                                    <span className="sm:hidden">Bill</span>
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <p className="text-xs text-muted-foreground italic w-full text-center">Actions not available</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                </TabsContent>
                            ) : null}

                            {/* Comments Tab */}
                            <TabsContent value="comments" className="mt-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Comments & Notes</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {/* Add Comment */}
                                        <div className="flex gap-3">
                                            <MentionTextarea
                                                placeholder="Add a comment... Use @ to mention users"
                                                value={newComment}
                                                onChange={setNewComment}
                                            />
                                            <Button
                                                onClick={handleAddComment}
                                                disabled={submittingComment || !newComment.trim()}
                                            >
                                                {submittingComment ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Send className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>

                                        <Separator />

                                        {/* Comments List */}
                                        {comments.length > 0 ? (
                                            <div className="space-y-4">
                                                {comments.map((comment) => (
                                                    <div key={comment.id} className="flex gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                            <User className="h-4 w-4 text-primary" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-medium text-sm">
                                                                    {(comment.user as { full_name?: string | null } | null)?.full_name || 'Unknown'}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {formatDateTime(comment.created_at)}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground"><CommentContent content={comment.content} /></p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-muted-foreground">
                                                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                                <p>No comments yet</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Version History Tab */}
                            <TabsContent value="history" className="mt-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Version History</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <VersionHistory
                                            tableName="applications"
                                            recordId={id}
                                            maxHeight="none"
                                            embedded
                                            onVersionRestored={() => window.location.reload()}
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="timeline" className="mt-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Timeline</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                                            <div className="rounded-md border p-3">
                                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Created</p>
                                                <p className="mt-1 font-medium">{formatDateTime(application.created_at)}</p>
                                            </div>
                                            <div className="rounded-md border p-3">
                                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last Updated</p>
                                                <p className="mt-1 font-medium">{formatDateTime(application.updated_at)}</p>
                                            </div>
                                        </div>
                                        <WorkflowTimelineFeed applicationId={id} refreshKey={timelineRefreshKey} />
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="activity" className="mt-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Activity Feed</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ActivityFeed
                                            tableName="applications"
                                            recordId={id}
                                            maxHeight="none"
                                            embedded
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Right Column - Sidebar */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Application Status
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <WorkflowProgressBar
                                    currentStage={application.workflow_stage}
                                    stageOrder={WORKFLOW_DETAILS_STAGE_ORDER}
                                />
                                {can('applications.change_stage') && !isAccountsManagerView && (
                                    <WorkflowActionPanel
                                        applicationId={id}
                                        currentStage={application.workflow_stage}
                                        updatedAt={application.updated_at}
                                        canEdit={lockState.canEdit}
                                        actorRole={role}
                                        onConflict={setWorkflowBannerMessage}
                                        onTransitionSuccess={async ({ toStage, updatedAt }) => {
                                            setApplication((prev) => {
                                                if (!prev) {
                                                    return prev;
                                                }

                                                return {
                                                    ...prev,
                                                    workflow_stage: toStage,
                                                    updated_at: updatedAt,
                                                };
                                            });

                                            setTimelineRefreshKey((previous) => previous + 1);

                                            const { data: hist } = await supabase
                                                .from('application_history')
                                                .select('*, user:profiles(full_name)')
                                                .eq('application_id', id)
                                                .order('created_at', { ascending: false });

                                            if (hist) {
                                                setHistory(hist);
                                            }
                                        }}
                                    />
                                )}
                            </CardContent>
                        </Card>

                        {role === 'admin' ? (
                            <AdminDocsReviewTasksPanel
                                applicationId={id}
                                workflowStage={application.workflow_stage}
                                canEdit={lockState.canEdit}
                                studentEmail={application.student_email}
                                studentName={`${application.student_first_name || ''} ${application.student_last_name || ''}`.trim()}
                                additionalEmails={application.additional_emails}
                                applicantTaskCompleted={application.admin_applicant_pdf_email_completed}
                                referencesTaskCompleted={application.admin_references_email_completed}
                                onTaskStateUpdate={(taskState) => {
                                    setApplication((prev) => {
                                        if (!prev) {
                                            return prev;
                                        }

                                        return {
                                            ...prev,
                                            ...taskState,
                                        };
                                    });
                                }}
                            />
                        ) : null}

                        {isAssignedAssessor ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Assessor Workflow
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <Accordion
                                        type="single"
                                        collapsible
                                        value={activeAssessorWorkflowStep}
                                        onValueChange={(value) => setActiveAssessorWorkflowStep(value || nextAssessorWorkflowStep)}
                                        className="rounded-md border"
                                    >
                                        {assessorWorkflowSteps.map((step) => {
                                            const isLocked = !step.unlocked && !step.completed;

                                            return (
                                                <AccordionItem key={step.value} value={step.value} className="px-4">
                                                    <AccordionTrigger disabled={isLocked} className="py-4 hover:no-underline">
                                                        <div className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left">
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium text-foreground">{step.title}</p>
                                                                <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                                                            </div>
                                                            <Badge variant="outline" className={step.className}>
                                                                {step.label}
                                                            </Badge>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="space-y-3 pb-4">
                                                        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                                                            {step.badgeValue}
                                                        </div>

                                                        {step.value === 'step-1' ? (
                                                            canEditAppointmentDate ? (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="w-full justify-start gap-2"
                                                                    disabled={!lockState.canEdit || savingAssessorAppointmentDate}
                                                                    onClick={() => setAssessorAppointmentDialogOpen(true)}
                                                                >
                                                                    <CalendarDays className="h-4 w-4" />
                                                                    {application.appointment_date ? 'Update Appointment Date' : 'Assign Appointment Date'}
                                                                </Button>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground">{step.lockReason}</p>
                                                            )
                                                        ) : null}

                                                        {step.value === 'step-2' ? (
                                                            application.workflow_stage === 'enrolled' ? (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="w-full justify-start gap-2"
                                                                    disabled={!lockState.canEdit || movingToEvaluate || !application.appointment_date || !application.appointment_time}
                                                                    onClick={() => void handleAssessorMoveToEvaluate()}
                                                                    title={!application.appointment_date || !application.appointment_time ? 'Set the appointment date and time before moving to Evaluate.' : undefined}
                                                                >
                                                                    {movingToEvaluate ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <CalendarDays className="h-4 w-4" />
                                                                    )}
                                                                    Move to Evaluate
                                                                </Button>
                                                            ) : evaluateStepCompleted ? (
                                                                <p className="text-xs text-muted-foreground">Application is already in Evaluate or a later stage.</p>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground">{step.lockReason}</p>
                                                            )
                                                        ) : null}

                                                        {step.value === 'step-3' ? (
                                                            evaluateStepCompleted ? (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="w-full justify-start gap-2"
                                                                    onClick={() => setActiveTab('documents')}
                                                                >
                                                                    <FileText className="h-4 w-4" />
                                                                    {hasEvaluationFile ? 'Review Student Assessment Report' : 'Open Documents Tab'}
                                                                </Button>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground">{step.lockReason}</p>
                                                            )
                                                        ) : null}

                                                        {step.value === 'step-4' ? (
                                                            uploadEvaluateStepCompleted ? (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="w-full justify-start gap-2"
                                                                    onClick={() => setActiveTab('assessment-report')}
                                                                >
                                                                    <FilePlus2 className="h-4 w-4" />
                                                                    {assessmentReportCompleted ? 'Review Assessment Report' : 'Open Assessment Report Tab'}
                                                                </Button>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground">{step.lockReason}</p>
                                                            )
                                                        ) : null}

                                                        {step.value === 'step-5' ? (
                                                            assessmentReportCompleted ? (
                                                                application.workflow_stage === 'evaluate' ? (
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            className="gap-2"
                                                                            disabled={!lockState.canEdit || savingAssessmentResult !== null}
                                                                            onClick={() => void handleAssessorSetAssessmentResult('pass')}
                                                                        >
                                                                            {savingAssessmentResult === 'pass' ? (
                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                            ) : (
                                                                                <CheckCircle className="h-4 w-4" />
                                                                            )}
                                                                            Pass
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            className="gap-2"
                                                                            disabled={!lockState.canEdit || savingAssessmentResult !== null}
                                                                            onClick={() => void handleAssessorSetAssessmentResult('failed')}
                                                                        >
                                                                            {savingAssessmentResult === 'failed' ? (
                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                            ) : (
                                                                                <XCircle className="h-4 w-4" />
                                                                            )}
                                                                            Failed
                                                                        </Button>
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-xs text-muted-foreground">Assessment result has already been recorded for this application.</p>
                                                                )
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground">{step.lockReason}</p>
                                                            )
                                                        ) : null}
                                                    </AccordionContent>
                                                </AccordionItem>
                                            );
                                        })}
                                    </Accordion>
                                </CardContent>
                            </Card>
                        ) : null}

                        {/* Agent Info */}
                        {application.partner && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Agent</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {isFrontdeskView ? (
                                        <div className="flex items-center gap-3 p-2 -m-2 rounded-lg">
                                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <Building2 className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{application.partner.company_name}</p>
                                                <p className="text-xs text-muted-foreground capitalize">
                                                    {application.partner.type}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <Link href={`${routeBase}/partners/${application.partner.id}`}>
                                            <div className="flex items-center gap-3 hover:bg-muted/50 p-2 -m-2 rounded-lg">
                                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    <Building2 className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{application.partner.company_name}</p>
                                                    <p className="text-xs text-muted-foreground capitalize">
                                                        {application.partner.type}
                                                    </p>
                                                </div>
                                            </div>
                                        </Link>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Quick Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Quick Actions
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {role === 'frontdesk' && (
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start"
                                            size="sm"
                                            onClick={handleOpenMissingDocsDialog}
                                            disabled={!application.partner?.id || sendingMissingDocsEmail}
                                            title={!application.partner?.id ? 'Agent is not linked for this application' : undefined}
                                        >
                                            {sendingMissingDocsEmail ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <AlertCircle className="h-4 w-4 mr-2" />
                                            )}
                                            Notify Agent: Missing Documents
                                        </Button>
                                )}

                                {canManageCertificates && (
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start"
                                        size="sm"
                                        nativeButton={false}
                                        render={<Link href={`/portal/certificates?applicationId=${encodeURIComponent(id)}`} />}
                                        disabled={!['dispatch', 'completed'].includes(application.workflow_stage)}
                                        title={
                                            !['dispatch', 'completed'].includes(application.workflow_stage)
                                                ? 'Certificates can only be generated for Dispatch or Completed applications.'
                                                : undefined
                                        }
                                    >
                                        <FilePlus2 className="h-4 w-4 mr-2" />
                                        Generate Certificate
                                    </Button>
                                )}

                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    size="sm"
                                    onClick={handleOpenStudentEmailDialog}
                                    disabled={!application.student_email || (isDispatchCoordinatorView && certificateDocuments.length === 0)}
                                    title={!application.student_email
                                        ? 'Student email is required'
                                        : isDispatchCoordinatorView && certificateDocuments.length === 0
                                            ? 'Upload a Certificate PDF first'
                                            : undefined}
                                >
                                    <Mail className="h-4 w-4 mr-2" />
                                    {isDispatchCoordinatorView ? 'Email Certificate to Student' : 'Send Email to Student'}
                                </Button>

                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    size="sm"
                                    onClick={handleExportApplication}
                                    disabled={exporting || !application}
                                >
                                    {exporting ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Download className="h-4 w-4 mr-2" />
                                    )}
                                    Export Application
                                </Button>
                            </CardContent>
                        </Card>

                        {!isAssessorView ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Record Management
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <ArchiveActions
                                        tableName="applications"
                                        recordId={id}
                                        isArchived={application.is_archived}
                                        onSuccess={handleArchiveSuccess}
                                        size="sm"
                                    />
                                    <DeleteActions
                                        tableName="applications"
                                        recordId={id}
                                        isDeleted={application.is_deleted}
                                        onSuccess={handleDeleteSuccess}
                                        size="sm"
                                    />
                                </CardContent>
                            </Card>
                        ) : null}
                    </div>
                </div>
            </div>

            <DocumentPreview
                open={documentPreviewOpen}
                onOpenChange={handleDocumentPreviewOpenChange}
                document={selectedDocument}
            />

            <Dialog
                open={emailDialogOpen}
                onOpenChange={(open) => {
                    if (sendingEmail) return;
                    setEmailDialogOpen(open);
                }}
            >
                <DialogContent className="inset-0 top-0 left-0 h-screen w-screen max-w-none sm:max-w-none max-h-none translate-x-0 translate-y-0 rounded-none overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isDispatchCoordinatorView ? 'Email Certificate to Student' : 'Send Email to Student'}</DialogTitle>
                        <DialogDescription>
                            Compose an email for {application.student_first_name} {application.student_last_name}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Email Template (Optional)</Label>
                            <Select
                                value={selectedEmailTemplateId}
                                onValueChange={handleStudentEmailTemplateChange}
                                disabled={sendingEmail || loadingEmailTemplates}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose a template" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">No template</SelectItem>
                                    {emailTemplates.map((template) => (
                                        <SelectItem key={template.id} value={template.id}>
                                            {template.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Selecting a template will replace the current subject and message.
                            </p>
                            {loadingEmailTemplates && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Loading templates...
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="student-email-recipient">Recipient</Label>
                            <Input
                                id="student-email-recipient"
                                value={application.student_email || ''}
                                readOnly
                                disabled
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="student-email-subject">Subject</Label>
                            <Input
                                id="student-email-subject"
                                value={emailSubject}
                                onChange={(event) => setEmailSubject(event.target.value)}
                                placeholder="Enter email subject"
                                maxLength={255}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="student-email-body">Message</Label>
                            <Textarea
                                id="student-email-body"
                                value={emailBody}
                                onChange={(event) => setEmailBody(event.target.value)}
                                placeholder="Write your message"
                                rows={10}
                            />
                        </div>

                        {isDispatchCoordinatorView ? (
                            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                                <Label>Certificate PDF Attachments</Label>
                                {certificateDocuments.length > 0 ? (
                                    <div className="space-y-2">
                                        {certificateDocuments.map((document) => {
                                            const checked = selectedStudentEmailDocumentIds.includes(document.id);

                                            return (
                                                <label
                                                    key={document.id}
                                                    className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 cursor-pointer hover:bg-muted/40"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <Checkbox
                                                            checked={checked}
                                                            onCheckedChange={(nextValue) => toggleStudentEmailDocumentSelection(document.id, Boolean(nextValue))}
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium truncate">{document.file_name}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {document.document_type} • {formatDateTime(document.created_at)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => handleOpenDocumentPreview(document)}
                                                        title="Preview document"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </label>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Upload a Certificate PDF in the Documents tab before emailing the applicant.
                                    </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Selected attachments: {selectedStudentEmailDocumentIds.length}
                                </p>
                            </div>
                        ) : null}

                        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                            <Label className="text-xs text-muted-foreground">Preview Rendered Email</Label>
                            <div className="text-sm">
                                <p>
                                    <span className="text-muted-foreground">Subject: </span>
                                    <span className="font-medium">{renderedEmailPreviewSubject || 'No subject'}</span>
                                </p>
                            </div>
                            <div className="rounded border bg-background p-3 max-h-48 overflow-y-auto">
                                <pre className="whitespace-pre-wrap text-sm font-sans">
                                    {renderedEmailPreviewBody || 'No message content'}
                                </pre>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setEmailDialogOpen(false)}
                            disabled={sendingEmail}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSendStudentEmail} disabled={sendingEmail}>
                            {sendingEmail ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4 mr-2" />
                            )}
                            {isDispatchCoordinatorView ? 'Send Certificate Email' : 'Send Email'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={missingDocsDialogOpen}
                onOpenChange={(open) => {
                    if (sendingMissingDocsEmail || previewingMissingDocsEmail) return;
                    if (!open) {
                        setMissingDocsEmailPreview(null);
                    }
                    setMissingDocsDialogOpen(open);
                }}
            >
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Notify Agent About Missing Documents</DialogTitle>
                        <DialogDescription>
                            Select the missing documents to notify {application.partner?.company_name || 'the assigned agent'}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-1">
                        <div className="space-y-2">
                            <Label>Missing Documents</Label>
                            <div className="rounded-md border p-3 max-h-64 overflow-y-auto">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {DOCUMENT_TYPES.map((documentType) => {
                                        const checked = selectedMissingDocuments.includes(documentType);
                                        const detectedMissing = missingDocumentsByChecklist.includes(documentType);

                                        return (
                                            <label
                                                key={documentType}
                                                className="flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/40"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={(nextValue) => toggleMissingDocumentSelection(documentType, Boolean(nextValue))}
                                                    />
                                                    <span className="text-sm">{documentType}</span>
                                                </div>
                                                {detectedMissing && (
                                                    <Badge variant="outline" className="text-[10px]">Detected</Badge>
                                                )}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Selected documents: {selectedMissingDocuments.length}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="missing-docs-note">Additional Notes (Optional)</Label>
                            <Textarea
                                id="missing-docs-note"
                                value={missingDocsNote}
                                onChange={(event) => {
                                    setMissingDocsNote(event.target.value);
                                    setMissingDocsEmailPreview(null);
                                }}
                                placeholder="Add extra instructions for the agent..."
                                rows={4}
                                maxLength={1000}
                            />
                        </div>

                        {missingDocsEmailPreview && (
                            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                                <Label className="text-xs text-muted-foreground">Preview Email Content</Label>
                                <div className="text-sm space-y-1">
                                    <p>
                                        <span className="text-muted-foreground">To: </span>
                                        <span className="font-medium">{missingDocsEmailPreview.recipient || '-'}</span>
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">Subject: </span>
                                        <span className="font-medium">{missingDocsEmailPreview.subject || '-'}</span>
                                    </p>
                                </div>
                                <div className="rounded border bg-background p-3 max-h-56 overflow-y-auto">
                                    <pre className="whitespace-pre-wrap text-sm font-sans">
                                        {missingDocsEmailPreview.body || 'No email content generated.'}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setMissingDocsDialogOpen(false)}
                            disabled={sendingMissingDocsEmail || previewingMissingDocsEmail}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handlePreviewMissingDocsEmail}
                            disabled={sendingMissingDocsEmail || previewingMissingDocsEmail || selectedMissingDocuments.length === 0}
                        >
                            {previewingMissingDocsEmail ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Eye className="h-4 w-4 mr-2" />
                            )}
                            Preview Email
                        </Button>
                        <Button
                            onClick={handleSendMissingDocsToAgent}
                            disabled={sendingMissingDocsEmail || previewingMissingDocsEmail || selectedMissingDocuments.length === 0}
                        >
                            {sendingMissingDocsEmail ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <AlertCircle className="h-4 w-4 mr-2" />
                            )}
                            Send Missing-Docs Email
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            </main>
        </>
    );
}

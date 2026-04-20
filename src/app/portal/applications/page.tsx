'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    User,
    GraduationCap,
    Calendar,
    Building2,
    LayoutGrid,
    List,
    RefreshCw,
    Search,
    X,
    Download,
    Filter,
    ChevronLeft,
    ChevronRight,
    FileText,
    Loader2,
    Receipt,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import type { WorkflowStage } from '@/types/database';
import { formatAppointmentDateTime, formatDate } from '@/lib/date-utils';
import { createBulkInvoices } from '@/lib/services/invoice-generator';
import { createBulkBillsFromApps } from '@/lib/services/bill-service';
import { usePermissions } from '@/hooks/usePermissions';
import ApplicationImportDialog from '@/components/applications/ApplicationImportDialog';
import { resolveApplicationId } from '@/lib/application-identifiers';
import { useTransitionApplicationMutation } from '@/store/services/workflowApi';
import {
    getUserFriendlyWorkflowError,
    getWorkflowErrorFromPayload,
    getWorkflowErrorFromUnknown,
} from '@/lib/workflow/error-messages';
import { getPortalRouteBase, withPortalBase } from '@/lib/routes/portal';
import { ACTIVE_RECORD_FILTER, isActiveRecord } from '@/lib/soft-delete';
import { hydrateApplicationRelations } from '@/lib/applications/hydration';

const KANBAN_STAGES: WorkflowStage[] = [
    'TRANSFERRED',
    'docs_review',
    'enrolled',
    'evaluate',
    'accounts',
    'dispatch',
    'completed',
];

const ADMIN_KANBAN_STAGES: WorkflowStage[] = ['docs_review', 'enrolled', 'evaluate', 'accounts', 'dispatch', 'completed'];
const ACCOUNTS_MANAGER_KANBAN_STAGES: WorkflowStage[] = KANBAN_STAGES;
const DISPATCH_COORDINATOR_KANBAN_STAGES: WorkflowStage[] = ['dispatch', 'completed'];
const ASSESSOR_KANBAN_STAGES: WorkflowStage[] = ['enrolled', 'evaluate', 'accounts', 'dispatch', 'completed'];

const STAGE_FILTER_ORDER: WorkflowStage[] = [
    'TRANSFERRED',
    'docs_review',
    'enrolled',
    'evaluate',
    'accounts',
    'dispatch',
    'completed',
];

const STAGE_LABELS: Record<WorkflowStage, string> = {
    TRANSFERRED: 'Transferred',
    docs_review: 'Docs Review',
    enrolled: 'Enrolled',
    evaluate: 'Evaluate',
    accounts: 'Accounts',
    dispatch: 'Dispatch',
    completed: 'Completed',
};

const stageColors: Record<WorkflowStage, string> = {
    TRANSFERRED: 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900/50 dark:text-cyan-300 dark:border-cyan-700',
    docs_review: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
    enrolled: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700',
    evaluate: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700',
    accounts: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/50 dark:text-violet-300 dark:border-violet-700',
    dispatch: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-700',
    completed: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-700',
};

// Row background colors for status indication
const rowStatusColors: Record<WorkflowStage, string> = {
    TRANSFERRED: 'border-l-4 border-l-cyan-500 bg-cyan-50 dark:bg-cyan-950/30',
    docs_review: 'border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/30',
    enrolled: 'border-l-4 border-l-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
    evaluate: 'border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/30',
    accounts: 'border-l-4 border-l-violet-500 bg-violet-50 dark:bg-violet-950/30',
    dispatch: 'border-l-4 border-l-indigo-500 bg-indigo-50 dark:bg-indigo-950/30',
    completed: 'border-l-4 border-l-slate-500 bg-slate-50 dark:bg-slate-950/30',
};

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
});

const XERO_STATUS_COLORS: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
    AUTHORISED: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700',
    SUBMITTED: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700',
    PAID: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
    VOIDED: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
    DELETED: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
    CANCELLED: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
};

const getXeroStatusMeta = (status: string | null | undefined) => {
    const normalized = status?.trim().toUpperCase();
    if (!normalized) {
        return {
            label: 'Not Created',
            className: 'bg-muted text-muted-foreground border-border',
        };
    }

    const label = normalized
        .toLowerCase()
        .split('_')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');

    return {
        label,
        className: XERO_STATUS_COLORS[normalized]
            || 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
    };
};

const formatCurrencyAmount = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return CURRENCY_FORMATTER.format(value);
};

interface ApplicationWithRelations {
    id: string;
    student_uid: string;
    application_number?: string | null;
    is_deleted?: boolean | null;
    student_first_name: string;
    student_last_name: string;
    workflow_stage: WorkflowStage;
    assessment_result: string | null;
    payment_status: string;
    quoted_tuition: number | null;
    quoted_materials: number | null;
    total_paid: number | null;
    appointment_date: string | null;
    appointment_time: string | null;
    created_at: string;
    updated_at: string;
    xero_invoice_status: string | null;
    xero_bill_status: string | null;
    qualification?: { name: string; code: string } | null;
    offering?: {
        qualification?: { name: string; code: string };
        rto?: { name: string; code: string | null };
    };
    partner?: { company_name: string; type: string | null; parent_partner_id: string | null };
}

interface XeroCreateResponse {
    success?: boolean;
    error?: string;
    warning?: string;
    invoiceNumber?: string | null;
    billNumber?: string | null;
    pdfDownloadUrl?: string | null;
}

export default function ApplicationsPage() {
    const [view, setView] = useState<'kanban' | 'table'>('kanban');
    const [applications, setApplications] = useState<ApplicationWithRelations[]>([]);
    const [providerNamesById, setProviderNamesById] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [draggedApp, setDraggedApp] = useState<string | null>(null);

    // Search and filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [stageFilter, setStageFilter] = useState<string>('all');
    const [rtoFilter, setRtoFilter] = useState<string>('all');
    const [paymentFilter, setPaymentFilter] = useState<string>('all');
    const [qualFilter, setQualFilter] = useState<string>('all');
    // Date range filter - default to no filter (show all applications)
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [generatingInvoices, setGeneratingInvoices] = useState(false);
    const [generatingBills, setGeneratingBills] = useState(false);
    const [invoiceActionIds, setInvoiceActionIds] = useState<Set<string>>(new Set());
    const [billActionIds, setBillActionIds] = useState<Set<string>>(new Set());

    // Pagination state
    const ITEMS_PER_PAGE = 50;
    const [currentPage, setCurrentPage] = useState(1);

    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();
    const pathname = usePathname();
    const { can, role } = usePermissions();
    const [transitionApplication] = useTransitionApplicationMutation();

    const isFrontdeskView = pathname.startsWith('/frontdesk');
    const isAdminRoute = pathname === '/portal/admin/applications' || pathname.startsWith('/portal/admin/');
    const isAdminView = role === 'admin' || isAdminRoute;
    const isAccountsManagerView = role === 'accounts_manager'
        || pathname === '/portal/accounts_manager/applications'
        || pathname.startsWith('/portal/accounts_manager/');
    const isDispatchCoordinatorView = role === 'dispatch_coordinator'
        || pathname === '/portal/dispatch_coordinator/applications'
        || pathname.startsWith('/portal/dispatch_coordinator/');
    const isAssessorView = role === 'assessor' || pathname === '/portal/assessor/applications' || pathname.startsWith('/portal/assessor/');
    const routeBase = getPortalRouteBase(pathname, role);

    const kanbanStages = useMemo(
        () => {
            if (isAdminView) {
                return ADMIN_KANBAN_STAGES;
            }

            if (isAccountsManagerView) {
                return ACCOUNTS_MANAGER_KANBAN_STAGES;
            }

            if (isDispatchCoordinatorView) {
                return DISPATCH_COORDINATOR_KANBAN_STAGES;
            }

            if (isAssessorView) {
                return ASSESSOR_KANBAN_STAGES;
            }

            return KANBAN_STAGES;
        },
        [isAdminView, isAccountsManagerView, isDispatchCoordinatorView, isAssessorView]
    );

    const stageFilterOptions = useMemo(
        () => {
            if (isAdminView) {
                return ADMIN_KANBAN_STAGES.map((stage) => [stage, STAGE_LABELS[stage]] as [WorkflowStage, string]);
            }

            if (isAccountsManagerView) {
                return ACCOUNTS_MANAGER_KANBAN_STAGES.map((stage) => [stage, STAGE_LABELS[stage]] as [WorkflowStage, string]);
            }

            if (isDispatchCoordinatorView) {
                return DISPATCH_COORDINATOR_KANBAN_STAGES.map((stage) => [stage, STAGE_LABELS[stage]] as [WorkflowStage, string]);
            }

            if (isAssessorView) {
                return ASSESSOR_KANBAN_STAGES.map((stage) => [stage, STAGE_LABELS[stage]] as [WorkflowStage, string]);
            }

            return STAGE_FILTER_ORDER.map((stage) => [stage, STAGE_LABELS[stage]] as [WorkflowStage, string]);
        },
        [isAdminView, isAccountsManagerView, isDispatchCoordinatorView, isAssessorView]
    );

    const fetchApplications = useCallback(async () => {
        setLoading(true);
        try {
            // Check if user is authenticated first
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError) {
                console.error('Auth error:', authError);
                toast.error('Authentication error', { description: 'Please log in again' });
            }
            // Note: Role is in profiles table, not user_metadata
            console.log('Current user:', user?.email);

            let query = supabase
                .from('applications')
                .select('*')
                .or(ACTIVE_RECORD_FILTER)
                .order('created_at', { ascending: false });

            if (isAdminView && user?.id) {
                query = query.eq('assigned_admin_id', user.id);
            } else if (isDispatchCoordinatorView) {
                query = query.in('workflow_stage', DISPATCH_COORDINATOR_KANBAN_STAGES);
            } else if (isAssessorView && user?.id) {
                query = query.eq('assigned_assessor_id', user.id);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching applications:', error);
                toast.error('Failed to load applications', {
                    description: getWorkflowErrorFromUnknown(
                        error,
                        'Unable to load applications right now. Please try again.'
                    ),
                });
            } else {
                console.log('Fetched applications count:', data?.length);

                const hydratedApplications = await hydrateApplicationRelations(
                    (data || []) as ApplicationWithRelations[],
                    supabase as never
                );
                const normalizedApplications = hydratedApplications.filter(isActiveRecord);
                setApplications(normalizedApplications);

                const parentPartnerIds = Array.from(
                    new Set(
                        normalizedApplications
                            .map((app) => app.partner?.parent_partner_id)
                            .filter((value): value is string => Boolean(value))
                    )
                );

                if (parentPartnerIds.length > 0) {
                    const { data: providerRows, error: providerError } = await supabase
                        .from('partners')
                        .select('id, company_name')
                        .in('id', parentPartnerIds);

                    if (providerError) {
                        console.error('Error fetching provider names:', providerError);
                        setProviderNamesById({});
                    } else {
                        const nextProviderNames = (providerRows || []).reduce<Record<string, string>>((acc, row) => {
                            acc[row.id] = row.company_name;
                            return acc;
                        }, {});
                        setProviderNamesById(nextProviderNames);
                    }
                } else {
                    setProviderNamesById({});
                }
            }
        } catch (err) {
            console.error('Unexpected error:', err);
        }
        setLoading(false);
    }, [isAdminView, isDispatchCoordinatorView, isAssessorView, supabase]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void fetchApplications();
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [fetchApplications]);

    useEffect(() => {
        if (isAdminView && stageFilter !== 'all' && !ADMIN_KANBAN_STAGES.includes(stageFilter as WorkflowStage)) {
            setStageFilter('all');
        }
    }, [isAdminView, stageFilter]);

    useEffect(() => {
        if (isAccountsManagerView && stageFilter !== 'all' && !ACCOUNTS_MANAGER_KANBAN_STAGES.includes(stageFilter as WorkflowStage)) {
            setStageFilter('all');
        }
    }, [isAccountsManagerView, stageFilter]);

    useEffect(() => {
        if (isDispatchCoordinatorView && stageFilter !== 'all' && !DISPATCH_COORDINATOR_KANBAN_STAGES.includes(stageFilter as WorkflowStage)) {
            setStageFilter('all');
        }
    }, [isDispatchCoordinatorView, stageFilter]);

    useEffect(() => {
        if (isAssessorView && stageFilter !== 'all' && !ASSESSOR_KANBAN_STAGES.includes(stageFilter as WorkflowStage)) {
            setStageFilter('all');
        }
    }, [isAssessorView, stageFilter]);

    const activeApplications = useMemo(
        () => applications.filter(isActiveRecord),
        [applications]
    );

    // Get unique RTOs for filter dropdown
    const uniqueRtos = useMemo(() => {
        const rtos = new Set<string>();
        activeApplications.forEach((app) => {
            if (app.offering?.rto?.name) {
                rtos.add(app.offering.rto.name);
            }
        });
        return Array.from(rtos).sort();
    }, [activeApplications]);

    // Get unique Qualifications for filter dropdown (with code and name)
    const uniqueQuals = useMemo(() => {
        const qualsMap = new Map<string, { code: string; name: string }>();
        activeApplications.forEach((app) => {
            const qualification = app.offering?.qualification || app.qualification;
            if (qualification?.code) {
                const code = qualification.code;
                const name = qualification.name || '';
                if (!qualsMap.has(code)) {
                    qualsMap.set(code, { code, name });
                }
            }
        });
        return Array.from(qualsMap.values()).sort((a, b) => a.code.localeCompare(b.code));
    }, [activeApplications]);

    const visibleApplicationsCount = useMemo(
        () => activeApplications.filter((app) => {
            if (isAdminView) {
                return ADMIN_KANBAN_STAGES.includes(app.workflow_stage);
            }

            if (isAccountsManagerView) {
                return ACCOUNTS_MANAGER_KANBAN_STAGES.includes(app.workflow_stage);
            }

            if (isDispatchCoordinatorView) {
                return DISPATCH_COORDINATOR_KANBAN_STAGES.includes(app.workflow_stage);
            }

            if (isAssessorView) {
                return ASSESSOR_KANBAN_STAGES.includes(app.workflow_stage);
            }

            return true;
        }).length,
        [activeApplications, isAdminView, isAccountsManagerView, isDispatchCoordinatorView, isAssessorView]
    );

    // Filter applications based on search and filters
    const filteredApplications = useMemo(() => {
        return activeApplications.filter((app) => {
            if (isAdminView && !ADMIN_KANBAN_STAGES.includes(app.workflow_stage)) {
                return false;
            }

            if (isAccountsManagerView) {
                if (!ACCOUNTS_MANAGER_KANBAN_STAGES.includes(app.workflow_stage)) {
                    return false;
                }
            }

            if (isDispatchCoordinatorView && !DISPATCH_COORDINATOR_KANBAN_STAGES.includes(app.workflow_stage)) {
                return false;
            }

            if (isAssessorView && !ASSESSOR_KANBAN_STAGES.includes(app.workflow_stage)) {
                return false;
            }

            // Date range filter
            if (startDate) {
                const appDate = new Date(app.created_at);
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                if (appDate < start) return false;
            }
            if (endDate) {
                const appDate = new Date(app.created_at);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (appDate > end) return false;
            }

            // Search filter (Name / Email / RTO / Course / Agent)
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                const qualification = app.offering?.qualification || app.qualification;
                const matchesSearch =
                    resolveApplicationId(app.application_number, app.student_uid).toLowerCase().includes(search) ||
                    app.student_uid.toLowerCase().includes(search) ||
                    app.student_first_name.toLowerCase().includes(search) ||
                    app.student_last_name.toLowerCase().includes(search) ||
                    qualification?.name?.toLowerCase().includes(search) ||
                    qualification?.code?.toLowerCase().includes(search) ||
                    app.offering?.rto?.name?.toLowerCase().includes(search) ||
                    app.partner?.company_name?.toLowerCase().includes(search);
                if (!matchesSearch) return false;
            }

            // Stage filter
            if (stageFilter !== 'all' && app.workflow_stage !== stageFilter) {
                return false;
            }

            // RTO filter
            if (rtoFilter !== 'all' && app.offering?.rto?.name !== rtoFilter) {
                return false;
            }

            // Payment filter
            if (paymentFilter !== 'all' && (app.payment_status || 'unpaid') !== paymentFilter) {
                return false;
            }

            // Qualification filter
            if (qualFilter !== 'all' && (app.offering?.qualification?.code || app.qualification?.code) !== qualFilter) {
                return false;
            }

            return true;
        });
    }, [activeApplications, endDate, isAdminView, isAccountsManagerView, isDispatchCoordinatorView, isAssessorView, paymentFilter, qualFilter, rtoFilter, searchTerm, stageFilter, startDate]);

    const sortedApplications = useMemo(() => filteredApplications, [filteredApplications]);

    // Paginate sorted applications
    const paginatedApplications = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedApplications.slice(start, start + ITEMS_PER_PAGE);
    }, [sortedApplications, currentPage]);

    const totalPages = Math.ceil(sortedApplications.length / ITEMS_PER_PAGE);

    // Reset page when filters change
    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setCurrentPage(1);
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [searchTerm, stageFilter, rtoFilter, paymentFilter, qualFilter, startDate, endDate]);

    const showUnfinishedFeatureWarning = (featureName: string) => {
        toast.warning(`${featureName} is not available yet`, {
            description: 'This feature is under development and will be enabled in an upcoming release.',
        });
    };

    const getAgentAndProviderNames = (app: ApplicationWithRelations) => {
        const partner = app.partner;

        if (!partner) {
            return { agentName: '-', providerName: '-' };
        }

        if (partner.type === 'provider') {
            return {
                agentName: '-',
                providerName: partner.company_name || '-',
            };
        }

        const providerName = partner.parent_partner_id
            ? (providerNamesById[partner.parent_partner_id] || '-')
            : '-';

        return {
            agentName: partner.company_name || '-',
            providerName,
        };
    };

    const getApplicationsByStage = (stage: WorkflowStage) => {
        return filteredApplications.filter((app) => app.workflow_stage === stage);
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStageFilter('all');
        setRtoFilter('all');
        setPaymentFilter('all');
        setQualFilter('all');
        // Reset to no date filter (show all)
        setStartDate('');
        setEndDate('');
    };

    const hasActiveFilters = searchTerm || stageFilter !== 'all' || rtoFilter !== 'all' || paymentFilter !== 'all' || qualFilter !== 'all';

    // Bulk selection functions
    const toggleSelection = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const selectAll = () => {
        const ids = filteredApplications.map((app) => app.id);
        setSelectedIds(new Set(ids));
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    const isAllSelected = filteredApplications.length > 0 &&
        filteredApplications.every((app) => selectedIds.has(app.id));

    // Export to CSV
    const exportToCSV = () => {
        const appsToExport = selectedIds.size > 0
            ? filteredApplications.filter((app) => selectedIds.has(app.id))
            : filteredApplications;

        const headers = [
            'Application ID',
            'First Name',
            'Last Name',
            'Stage',
            'Qualification',
            'RTO',
            'Partner',
            'Appointment Date'
        ];

        const rows = appsToExport.map((app) => [
            resolveApplicationId(app.application_number, app.student_uid),
            app.student_first_name,
            app.student_last_name,
            STAGE_LABELS[app.workflow_stage],
            app.offering?.qualification?.name || app.qualification?.name || '',
            app.offering?.rto?.name || '',
            app.partner?.company_name || '',
            formatAppointmentDateTime(app.appointment_date, app.appointment_time)
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `applications_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const downloadInvoicePdf = async (
        applicationId: string,
        pdfUrl?: string | null,
        fallbackInvoiceNumber?: string | null
    ) => {
        const targetUrl = pdfUrl || `/api/xero/invoice-pdf?applicationId=${applicationId}`;
        const response = await fetch(targetUrl);

        if (!response.ok) {
            let errorMessage = 'Unable to download the invoice PDF right now.';
            try {
                const payload = await response.json() as { error?: string };
                errorMessage = getWorkflowErrorFromPayload(
                    payload,
                    'Unable to download the invoice PDF right now.'
                );
            } catch {
                // no-op
            }

            throw new Error(errorMessage);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const contentDisposition = response.headers.get('content-disposition') || '';
        const extractedFileName = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1];
        const fileName = extractedFileName || `${fallbackInvoiceNumber || 'invoice'}.pdf`;

        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const handleCreateInvoiceForApplication = async (applicationId: string) => {
        if (invoiceActionIds.has(applicationId)) {
            return;
        }

        setInvoiceActionIds((prev) => {
            const next = new Set(prev);
            next.add(applicationId);
            return next;
        });

        try {
            const response = await fetch('/api/xero/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'create_invoice',
                    applicationId,
                }),
            });

            let result: XeroCreateResponse = {};
            try {
                result = await response.json() as XeroCreateResponse;
            } catch {
                result = {};
            }

            if (!response.ok || !result.success) {
                toast.error('Failed to create invoice in Xero', {
                    description: getUserFriendlyWorkflowError({
                        message: result.error,
                        fallback: 'Unable to create the invoice in Xero right now. Please try again.',
                    }),
                });
                return;
            }

            toast.success('Invoice created in Xero successfully', {
                description: result.warning || `Invoice ${result.invoiceNumber || 'created'} is ready.`,
                action: {
                    label: isFrontdeskView ? 'Refresh Applications' : 'Open Invoicing Hub',
                    onClick: () => router.push(isFrontdeskView ? '/frontdesk/applications' : withPortalBase(routeBase, 'settings/invoicing')),
                },
            });

            setApplications((prev) => prev.map((app) => {
                if (app.id !== applicationId) return app;
                return {
                    ...app,
                    xero_invoice_status: app.xero_invoice_status || 'DRAFT',
                };
            }));

            try {
                await downloadInvoicePdf(
                    applicationId,
                    result.pdfDownloadUrl || undefined,
                    result.invoiceNumber || null
                );
            } catch (downloadError) {
                toast.error('Invoice PDF download failed', {
                    description: getWorkflowErrorFromUnknown(
                        downloadError,
                        'Invoice created, but the PDF could not be downloaded right now.'
                    ),
                });
            }
        } catch (error) {
            toast.error('Error creating invoice in Xero', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to create the invoice in Xero right now. Please try again.'
                ),
            });
        } finally {
            setInvoiceActionIds((prev) => {
                const next = new Set(prev);
                next.delete(applicationId);
                return next;
            });
        }
    };

    const handleCreateBillForApplication = async (applicationId: string) => {
        if (billActionIds.has(applicationId)) {
            return;
        }

        setBillActionIds((prev) => {
            const next = new Set(prev);
            next.add(applicationId);
            return next;
        });

        try {
            const response = await fetch('/api/xero/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'create_bill',
                    applicationId,
                }),
            });

            let result: XeroCreateResponse = {};
            try {
                result = await response.json() as XeroCreateResponse;
            } catch {
                result = {};
            }

            if (!response.ok || !result.success) {
                toast.error('Failed to create bill in Xero', {
                    description: getUserFriendlyWorkflowError({
                        message: result.error,
                        fallback: 'Unable to create the bill in Xero right now. Please try again.',
                    }),
                });
                return;
            }

            toast.success('Bill created in Xero successfully', {
                description: result.warning || `Bill ${result.billNumber || 'created'} is ready.`,
                action: {
                    label: isFrontdeskView ? 'Refresh Applications' : 'Open Billing Hub',
                    onClick: () => router.push(isFrontdeskView ? '/frontdesk/applications' : withPortalBase(routeBase, 'settings/billing')),
                },
            });

            setApplications((prev) => prev.map((app) => {
                if (app.id !== applicationId) return app;
                return {
                    ...app,
                    xero_bill_status: app.xero_bill_status || 'DRAFT',
                };
            }));
        } catch (error) {
            toast.error('Error creating bill in Xero', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to create the bill in Xero right now. Please try again.'
                ),
            });
        } finally {
            setBillActionIds((prev) => {
                const next = new Set(prev);
                next.delete(applicationId);
                return next;
            });
        }
    };

    // Generate invoices for selected applications
    const handleGenerateInvoices = async () => {
        if (selectedIds.size === 0) {
            toast.error('No applications selected');
            return;
        }

        setGeneratingInvoices(true);
        const result = await createBulkInvoices(Array.from(selectedIds), { autoSyncXero: true });
        setGeneratingInvoices(false);

        if (result.success) {
            toast.success(`Invoices generated for ${result.operation?.processed_items || selectedIds.size} applications`, {
                description: isFrontdeskView
                    ? 'Invoice generation completed for selected applications.'
                    : 'View them in Settings → Invoicing',
                action: {
                    label: isFrontdeskView ? 'Refresh Applications' : 'View Invoices',
                    onClick: () => router.push(isFrontdeskView ? '/frontdesk/applications' : withPortalBase(routeBase, 'settings/invoicing')),
                },
            });
            clearSelection();
        } else {
            toast.error(result.error || 'Failed to generate invoices');
        }
    };

    // Generate bills for selected applications
    const handleGenerateBills = async () => {
        if (selectedIds.size === 0) {
            toast.error('No applications selected');
            return;
        }

        setGeneratingBills(true);
        const result = await createBulkBillsFromApps(Array.from(selectedIds), { autoSyncXero: true });
        setGeneratingBills(false);

        if (result.success) {
            toast.success(`Bills generated for ${result.operation?.processed_items || selectedIds.size} applications`, {
                description: isFrontdeskView
                    ? 'Bill generation completed for selected applications.'
                    : 'View them in Settings → Billing',
                action: {
                    label: isFrontdeskView ? 'Refresh Applications' : 'View Bills',
                    onClick: () => router.push(isFrontdeskView ? '/frontdesk/applications' : withPortalBase(routeBase, 'settings/billing')),
                },
            });
            clearSelection();
        } else {
            toast.error(result.error || 'Failed to generate bills');
        }
    };

    const handleDragStart = (appId: string) => {
        setDraggedApp(appId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (stage: WorkflowStage) => {
        if (!draggedApp) return;

        // Check permission to change stages
        if (!can('applications.change_stage')) {
            toast.error('Permission Denied', {
                description: 'You do not have permission to change application stages.',
            });
            setDraggedApp(null);
            return;
        }

        // Find the current stage of the dragged application
        const currentApp = applications.find((app) => app.id === draggedApp);
        if (!currentApp) {
            setDraggedApp(null);
            return;
        }

        // If same stage, no update needed
        if (currentApp.workflow_stage === stage) {
            setDraggedApp(null);
            return;
        }

        // Optimistic update
        setApplications((prev) =>
            prev.map((app) =>
                app.id === draggedApp ? { ...app, workflow_stage: stage } : app
            )
        );

        // Update via workflow transition API (single transition path)
        try {
            const response = await transitionApplication({
                applicationId: draggedApp,
                toStage: stage,
                expectedUpdatedAt: currentApp.updated_at,
            }).unwrap();

            setApplications((prev) =>
                prev.map((app) =>
                    app.id === draggedApp
                        ? {
                            ...app,
                            workflow_stage: response.data.toStage,
                            updated_at: response.data.updatedAt,
                        }
                        : app
                )
            );

            toast.success('Application moved', {
                description: `Moved to ${STAGE_LABELS[stage]}`,
            });
        } catch (error) {
            console.error('Error updating application:', error);

            toast.error('Failed to update application', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to update the application stage right now. Please try again.'
                ),
            });

            setApplications((prev) =>
                prev.map((app) =>
                    app.id === draggedApp
                        ? { ...app, workflow_stage: currentApp.workflow_stage, updated_at: currentApp.updated_at }
                        : app
                )
            );
        }

        setDraggedApp(null);
    };

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-4 md:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-semibold text-foreground">Applications</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {isAdminView
                                ? 'Manage your assigned applications from Docs Review to Enrolled'
                                : isDispatchCoordinatorView
                                    ? 'Track dispatch-ready applications and completed certificates'
                                : 'Track student application progress'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                        <Tabs value={view} onValueChange={(v) => setView(v as 'kanban' | 'table')}>
                            <TabsList>
                                <TabsTrigger value="kanban" className="flex items-center gap-1 md:gap-2 px-2 md:px-3">
                                    <LayoutGrid className="h-4 w-4" />
                                    <span className="hidden sm:inline">Kanban</span>
                                </TabsTrigger>
                                <TabsTrigger value="table" className="flex items-center gap-1 md:gap-2 px-2 md:px-3">
                                    <List className="h-4 w-4" />
                                    <span className="hidden sm:inline">Table</span>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <Button variant="outline" size="icon" onClick={fetchApplications}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                        {can('applications.create') && !isAdminView && !isAccountsManagerView && !isDispatchCoordinatorView && !isAssessorView && (
                            <ApplicationImportDialog
                                onImportComplete={() => fetchApplications()}
                            />
                        )}
                    </div>
                </div>

                {/* Search and Filters */}
                <div className="flex flex-wrap items-center gap-3 mt-4">
                    <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search name, ID, RTO, course, agent..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                                <Filter className="h-4 w-4" />
                                Filters
                                {hasActiveFilters && (
                                    <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                                        {(stageFilter !== 'all' ? 1 : 0) + (rtoFilter !== 'all' ? 1 : 0) + (paymentFilter !== 'all' ? 1 : 0) + (qualFilter !== 'all' ? 1 : 0)}
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="start">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium">Filters</h4>
                                    {hasActiveFilters && (
                                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                                            <X className="h-3 w-3 mr-1" />
                                            Clear All
                                        </Button>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-sm text-muted-foreground">Status</label>
                                        <Select value={stageFilter} onValueChange={setStageFilter}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="All Statuses" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Statuses</SelectItem>
                                                {stageFilterOptions.map(([key, label]) => (
                                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-sm text-muted-foreground">RTO</label>
                                        <Select value={rtoFilter} onValueChange={setRtoFilter}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="All RTOs" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All RTOs</SelectItem>
                                                {uniqueRtos.map((rto) => (
                                                    <SelectItem key={rto} value={rto}>{rto}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-sm text-muted-foreground">Payment</label>
                                        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="All Payments" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Payments</SelectItem>
                                                <SelectItem value="paid">Paid</SelectItem>
                                                <SelectItem value="partial">Partial</SelectItem>
                                                <SelectItem value="unpaid">Unpaid</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-sm text-muted-foreground">Qualification</label>
                                        <Select value={qualFilter} onValueChange={setQualFilter}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="All Qualifications" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Qualifications</SelectItem>
                                                {uniqueQuals.map((qual) => (
                                                    <SelectItem key={qual.code} value={qual.code}>
                                                        {qual.code}{qual.name ? ` - ${qual.name}` : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-sm text-muted-foreground">Date Range</label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="flex-1"
                                            />
                                            <span className="text-muted-foreground text-sm">to</span>
                                            <Input
                                                type="date"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                        {selectedIds.size > 0 && !isAssessorView && !isDispatchCoordinatorView && (
                            <>
                                <span className="text-sm font-medium text-primary">
                                    {selectedIds.size} selected
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleGenerateInvoices}
                                    disabled={generatingInvoices}
                                    className="gap-1 md:gap-2"
                                >
                                    {generatingInvoices ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <FileText className="h-4 w-4" />
                                    )}
                                    <span className="hidden sm:inline">Generate Invoices</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleGenerateBills}
                                    disabled={generatingBills}
                                    className="gap-1 md:gap-2"
                                >
                                    {generatingBills ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Receipt className="h-4 w-4" />
                                    )}
                                    <span className="hidden sm:inline">Generate Bills</span>
                                </Button>
                            </>
                        )}

                        {can('applications.export') && !isAssessorView && (
                            <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-1 md:gap-2">
                                <Download className="h-4 w-4" />
                                <span className="hidden sm:inline">Export CSV</span>
                            </Button>
                        )}
                    </div>

                    <div className="text-sm text-muted-foreground">
                        {hasActiveFilters ? (
                            <span>{filteredApplications.length} of {visibleApplicationsCount} applications</span>
                        ) : (
                            <span>{visibleApplicationsCount} applications</span>
                        )}
                    </div>
                </div>
            </header>

            <div className="p-4 md:p-6">
                {view === 'kanban' ? (
                    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                        <div
                            className="grid gap-4 min-w-max"
                            style={{ gridTemplateColumns: `repeat(${kanbanStages.length}, minmax(240px, 1fr))` }}
                        >
                            {kanbanStages.map((stage) => {
                                const allStageApps = getApplicationsByStage(stage);
                                // Paginate kanban cards per column
                                const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
                                const apps = allStageApps.slice(startIdx, startIdx + ITEMS_PER_PAGE);
                                return (
                                    <div
                                        key={stage}
                                        className="flex flex-col"
                                        onDragOver={handleDragOver}
                                        onDrop={() => handleDrop(stage)}
                                    >
                                        <div className="bg-muted/50 px-4 py-3 rounded-t-lg border border-b-0 border-border">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-semibold text-sm">{STAGE_LABELS[stage]}</h3>
                                                <Badge variant="secondary">{allStageApps.length}</Badge>
                                            </div>
                                        </div>
                                        <div className="flex-1 bg-muted/20 p-3 rounded-b-lg border border-border space-y-3 min-h-[500px]">
                                            {apps.map((app) => (
                                                <Link key={app.id} href={`${routeBase}/applications/${app.id}`}>
                                                    <Card
                                                        className="p-4 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                                                        draggable
                                                        onDragStart={() => handleDragStart(app.id)}
                                                    >
                                                        <div className="space-y-3">
                                                            <div className="flex items-start justify-between">
                                                                <p className="font-medium text-sm text-primary">{resolveApplicationId(app.application_number, app.student_uid)}</p>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <User className="w-4 h-4 text-muted-foreground" />
                                                                <p className="text-sm font-medium">
                                                                    {app.student_first_name} {app.student_last_name}
                                                                </p>
                                                            </div>

                                                            {(app.offering?.qualification || app.qualification) && (
                                                                <div className="flex items-start gap-2">
                                                                    <GraduationCap className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                                                        {(app.offering?.qualification || app.qualification)?.name}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {app.offering?.rto && (
                                                                <div className="flex items-center gap-2">
                                                                    <Building2 className="w-4 h-4 text-muted-foreground" />
                                                                    <p className="text-xs text-muted-foreground truncate">
                                                                        {app.offering.rto.name}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {app.appointment_date && (
                                                                <div className="flex items-center gap-2 pt-2 border-t border-border">
                                                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Appointment: {formatAppointmentDateTime(app.appointment_date, app.appointment_time)}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Card>
                                                </Link>
                                            ))}

                                            {apps.length === 0 && (
                                                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                                                    <p>No applications</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Pagination for Kanban */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-4 mt-6">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Previous
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-card rounded-lg border border-border overflow-x-auto">
                        <Table className="min-w-[1520px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[56px] sticky left-0 z-10 bg-card">
                                        <Checkbox
                                            checked={isAllSelected}
                                            onCheckedChange={(checked) => checked ? selectAll() : clearSelection()}
                                        />
                                    </TableHead>
                                    <TableHead className="min-w-[220px]">Status</TableHead>
                                    <TableHead className="min-w-[220px]">Agent &amp; Provider</TableHead>
                                    <TableHead className="min-w-[220px]">Application</TableHead>
                                    <TableHead className="min-w-[220px]">Qualification</TableHead>
                                    <TableHead className="min-w-[170px]">RTO</TableHead>
                                    <TableHead className="min-w-[260px]">Financials</TableHead>
                                    <TableHead className="min-w-[140px]">Actions</TableHead>
                                    <TableHead className="min-w-[160px]">Meta</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedApplications.map((app) => {
                                    const { agentName, providerName } = getAgentAndProviderNames(app);
                                    const invoiceStatus = getXeroStatusMeta(app.xero_invoice_status);
                                    const billingStatus = getXeroStatusMeta(app.xero_bill_status);
                                    const hasTotalAmount = app.quoted_tuition !== null || app.quoted_materials !== null;
                                    const totalAmount = hasTotalAmount
                                        ? (app.quoted_tuition || 0) + (app.quoted_materials || 0)
                                        : null;

                                    return (
                                        <TableRow
                                            key={app.id}
                                            className={`hover:bg-muted/50 cursor-pointer ${rowStatusColors[app.workflow_stage]} ${selectedIds.has(app.id) ? 'bg-primary/5' : ''}`}
                                            onClick={(e) => {
                                                if ((e.target as HTMLElement).closest('button, [role="checkbox"]')) return;
                                                router.push(`${routeBase}/applications/${app.id}`);
                                            }}
                                        >
                                            <TableCell className="sticky left-0 z-10 bg-inherit align-top">
                                                <Checkbox
                                                    checked={selectedIds.has(app.id)}
                                                    onCheckedChange={() => toggleSelection(app.id)}
                                                />
                                            </TableCell>

                                            <TableCell className="align-top">
                                                <div className="space-y-2">
                                                    <div className="space-y-1">
                                                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Application Status</p>
                                                        <Badge variant="outline" className={stageColors[app.workflow_stage]}>
                                                            {STAGE_LABELS[app.workflow_stage]}
                                                        </Badge>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Invoice Status</p>
                                                        <Badge variant="outline" className={invoiceStatus.className}>
                                                            {invoiceStatus.label}
                                                        </Badge>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Billing Status</p>
                                                        <Badge variant="outline" className={billingStatus.className}>
                                                            {billingStatus.label}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            <TableCell className="align-top">
                                                <div className="space-y-2">
                                                    <div className="space-y-1">
                                                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Agent</p>
                                                        <p className="text-sm leading-5">{agentName}</p>
                                                    </div>
                                                    <div className="border-t border-dashed border-border pt-2 space-y-1">
                                                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Provider</p>
                                                        <p className="text-sm leading-5">{providerName}</p>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            <TableCell className="align-top">
                                                <div className="space-y-1.5">
                                                    <p className="font-mono text-xs font-semibold text-primary">{resolveApplicationId(app.application_number, app.student_uid)}</p>
                                                    <p className="text-sm leading-5 font-medium">
                                                        {[app.student_first_name, app.student_last_name].filter(Boolean).join(' ') || '-'}
                                                    </p>
                                                </div>
                                            </TableCell>

                                            <TableCell className="align-top">
                                                <div className="space-y-1.5">
                                                    <p className="font-mono text-xs text-foreground">
                                                        {app.offering?.qualification?.code || app.qualification?.code || '-'}
                                                    </p>
                                                    <p className="text-sm leading-5 text-muted-foreground">
                                                        {app.offering?.qualification?.name || app.qualification?.name || '-'}
                                                    </p>
                                                </div>
                                            </TableCell>

                                            <TableCell className="align-top">
                                                <div className="space-y-2">
                                                    <div className="space-y-1">
                                                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">RTO Code</p>
                                                        <p className="font-mono text-xs text-foreground">{app.offering?.rto?.code || '-'}</p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 text-xs"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            showUnfinishedFeatureWarning('RTO Payment');
                                                        }}
                                                    >
                                                        Payment
                                                    </Button>
                                                </div>
                                            </TableCell>

                                            <TableCell className="align-top">
                                                <div className="space-y-2">
                                                    <div className="space-y-1">
                                                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Amount</p>
                                                        <p className="font-mono text-sm font-semibold text-green-600 dark:text-green-400">
                                                            {formatCurrencyAmount(totalAmount)}
                                                        </p>
                                                    </div>
                                                    <div className="border-t border-dashed border-border pt-2 space-y-2">
                                                        <div className="space-y-1">
                                                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Payment Amount</p>
                                                            <p className="font-mono text-xs text-foreground">
                                                                {formatCurrencyAmount(app.total_paid)}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 text-xs"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                showUnfinishedFeatureWarning('Payment Action');
                                                            }}
                                                        >
                                                            Payment
                                                        </Button>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            <TableCell className="align-top">
                                                {isDispatchCoordinatorView ? (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 justify-start text-xs"
                                                            disabled={invoiceActionIds.has(app.id)}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                void handleCreateInvoiceForApplication(app.id);
                                                            }}
                                                        >
                                                            {invoiceActionIds.has(app.id) ? (
                                                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                                            ) : null}
                                                            🧾 Invoice
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 justify-start text-xs"
                                                            disabled={billActionIds.has(app.id)}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                void handleCreateBillForApplication(app.id);
                                                            }}
                                                        >
                                                            {billActionIds.has(app.id) ? (
                                                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                                            ) : null}
                                                            📄 Bill
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>

                                            <TableCell className="align-top">
                                                <div className="space-y-1">
                                                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Created On</p>
                                                    <p className="font-mono text-xs text-foreground">{formatDate(app.created_at)}</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {sortedApplications.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                            {applications.length === 0 ? (
                                                isAdminView
                                                    ? 'No assigned applications found.'
                                                    : isDispatchCoordinatorView
                                                        ? 'No dispatch applications found.'
                                                    : 'No applications found.'
                                            ) : (
                                                'No applications match your filters.'
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                        {/* Pagination for Table */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                                <span className="text-sm text-muted-foreground">
                                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sortedApplications.length)} of {sortedApplications.length}
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-sm px-2">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}

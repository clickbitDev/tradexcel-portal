'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Plus,
    LayoutGrid,
    List,
    RefreshCw,
    Search,
    Filter,
    X,
    User,
    GraduationCap,
    Building2,
    Calendar,
    Loader2,
} from 'lucide-react';
import type { WorkflowStage } from '@/types/database';
import { formatAppointmentDateTime, formatDate } from '@/lib/date-utils';
import { resolveApplicationId } from '@/lib/application-identifiers';
import { ACTIVE_RECORD_FILTER, isActiveRecord } from '@/lib/soft-delete';

const KANBAN_STAGES: WorkflowStage[] = [
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

const STAGE_BADGE_COLORS: Record<WorkflowStage, string> = {
    TRANSFERRED: 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900/50 dark:text-cyan-300 dark:border-cyan-700',
    docs_review: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
    enrolled: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700',
    evaluate: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700',
    accounts: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/50 dark:text-violet-300 dark:border-violet-700',
    dispatch: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-700',
    completed: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-700',
};

type Relation<T> = T | T[] | null;

interface QualificationSummary {
    name: string;
    code: string;
}

interface RtoSummary {
    name: string;
    code: string | null;
}

interface OfferingSummary {
    qualification?: Relation<QualificationSummary>;
    rto?: Relation<RtoSummary>;
}

interface ApplicationWithRelations {
    id: string;
    student_uid: string;
    application_number: string | null;
    is_deleted?: boolean | null;
    student_first_name: string;
    student_last_name: string;
    workflow_stage: WorkflowStage;
    payment_status: string;
    appointment_date: string | null;
    appointment_time: string | null;
    created_at: string;
    qualification?: Relation<QualificationSummary>;
    offering?: Relation<OfferingSummary>;
}

function asSingle<T>(value: Relation<T> | undefined): T | undefined {
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
}

function getOfferingRelations(app: ApplicationWithRelations) {
    const offering = asSingle(app.offering);
    const qualification = asSingle(offering?.qualification) ?? asSingle(app.qualification);
    const rto = asSingle(offering?.rto);

    return { qualification, rto };
}

export default function AgentApplicationsPage() {
    const [view, setView] = useState<'kanban' | 'table'>('kanban');
    const [applications, setApplications] = useState<ApplicationWithRelations[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [stageFilter, setStageFilter] = useState<string>('all');
    const [rtoFilter, setRtoFilter] = useState<string>('all');
    const [paymentFilter, setPaymentFilter] = useState<string>('all');
    const [qualFilter, setQualFilter] = useState<string>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();

    const fetchApplications = useCallback(async () => {
        setLoading(true);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push('/login');
                return;
            }

            const { data, error } = await supabase
                .from('applications')
                .select(`
                    id,
                    student_uid,
                    application_number,
                    is_deleted,
                    student_first_name,
                    student_last_name,
                    workflow_stage,
                    payment_status,
                    appointment_date,
                    appointment_time,
                    created_at,
                    qualification:qualifications(name, code),
                    offering:rto_offerings(
                        qualification:qualifications(name, code),
                        rto:rtos(name, code)
                    )
                `)
                .eq('created_by', user.id)
                .or(ACTIVE_RECORD_FILTER)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching agent applications:', error);
                setApplications([]);
            } else {
                setApplications(((data || []) as ApplicationWithRelations[]).filter(isActiveRecord));
            }
        } catch (error) {
            console.error('Unexpected error loading agent applications:', error);
            setApplications([]);
        } finally {
            setLoading(false);
        }
    }, [router, supabase]);

    useEffect(() => {
        fetchApplications();
    }, [fetchApplications]);

    const uniqueRtos = useMemo(() => {
        return Array.from(
            new Set(
                applications
                    .map((app) => getOfferingRelations(app).rto?.name)
                    .filter((value): value is string => Boolean(value))
            )
        ).sort((a, b) => a.localeCompare(b));
    }, [applications]);

    const uniqueQuals = useMemo(() => {
        const map = new Map<string, { code: string; name: string }>();

        applications.forEach((app) => {
            const qualification = getOfferingRelations(app).qualification;
            if (!qualification?.code) return;

            map.set(qualification.code, {
                code: qualification.code,
                name: qualification.name,
            });
        });

        return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
    }, [applications]);

    const filteredApplications = useMemo(() => {
        return applications.filter((app) => {
            if (!isActiveRecord(app)) {
                return false;
            }

            const { qualification, rto } = getOfferingRelations(app);

            if (searchTerm) {
                const query = searchTerm.toLowerCase();
                const matchesSearch = [
                    resolveApplicationId(app.application_number, app.student_uid),
                    app.student_uid,
                    app.student_first_name,
                    app.student_last_name,
                    qualification?.name,
                    qualification?.code,
                    rto?.name,
                    rto?.code || '',
                ]
                    .filter((value): value is string => Boolean(value))
                    .some((value) => value.toLowerCase().includes(query));

                if (!matchesSearch) return false;
            }

            if (stageFilter !== 'all' && app.workflow_stage !== stageFilter) {
                return false;
            }

            if (rtoFilter !== 'all' && rto?.name !== rtoFilter) {
                return false;
            }

            if (paymentFilter !== 'all' && app.payment_status !== paymentFilter) {
                return false;
            }

            if (qualFilter !== 'all' && qualification?.code !== qualFilter) {
                return false;
            }

            if (startDate) {
                const createdDate = new Date(app.created_at);
                const start = new Date(startDate);
                if (createdDate < start) return false;
            }

            if (endDate) {
                const createdDate = new Date(app.created_at);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (createdDate > end) return false;
            }

            return true;
        });
    }, [applications, endDate, paymentFilter, qualFilter, rtoFilter, searchTerm, stageFilter, startDate]);

    const hasActiveFilters =
        searchTerm.length > 0
        || stageFilter !== 'all'
        || rtoFilter !== 'all'
        || paymentFilter !== 'all'
        || qualFilter !== 'all'
        || startDate.length > 0
        || endDate.length > 0;

    const activeFilterCount =
        (stageFilter !== 'all' ? 1 : 0)
        + (rtoFilter !== 'all' ? 1 : 0)
        + (paymentFilter !== 'all' ? 1 : 0)
        + (qualFilter !== 'all' ? 1 : 0)
        + (startDate || endDate ? 1 : 0);

    const clearFilters = () => {
        setSearchTerm('');
        setStageFilter('all');
        setRtoFilter('all');
        setPaymentFilter('all');
        setQualFilter('all');
        setStartDate('');
        setEndDate('');
    };

    const getApplicationsByStage = useCallback(
        (stage: WorkflowStage) => filteredApplications.filter((app) => app.workflow_stage === stage),
        [filteredApplications]
    );

    return (
        <main className="flex-1 overflow-y-auto">
            <header className="bg-card border-b border-border px-4 md:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-semibold text-foreground">Applications</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Applications created by you
                        </p>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                        <Tabs value={view} onValueChange={(value) => setView(value as 'kanban' | 'table')}>
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

                        <Link href="/portal/agent/applications/new">
                            <Button className="gap-1 md:gap-2">
                                <Plus className="h-4 w-4" />
                                <span>Add Application</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-4">
                    <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search name, ID, RTO, course..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                                <Filter className="h-4 w-4" />
                                Filters
                                {hasActiveFilters && activeFilterCount > 0 && (
                                    <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                                        {activeFilterCount}
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
                                                {Object.entries(STAGE_LABELS).map(([key, label]) => (
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
                                                {uniqueQuals.map((qualification) => (
                                                    <SelectItem key={qualification.code} value={qualification.code}>
                                                        {qualification.code}{qualification.name ? ` - ${qualification.name}` : ''}
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
                                                onChange={(event) => setStartDate(event.target.value)}
                                                className="flex-1"
                                            />
                                            <span className="text-muted-foreground text-sm">to</span>
                                            <Input
                                                type="date"
                                                value={endDate}
                                                onChange={(event) => setEndDate(event.target.value)}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <div className="text-sm text-muted-foreground sm:ml-auto">
                        {hasActiveFilters ? (
                            <span>{filteredApplications.length} of {applications.length} applications</span>
                        ) : (
                            <span>{applications.length} applications</span>
                        )}
                    </div>
                </div>
            </header>

            <div className="p-4 md:p-6">
                {loading ? (
                    <Card>
                        <CardContent className="py-16 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </CardContent>
                    </Card>
                ) : filteredApplications.length === 0 ? (
                    <Card>
                        <CardContent className="py-16 text-center">
                            <p className="text-sm text-muted-foreground">No applications found for your filters.</p>
                            {hasActiveFilters ? (
                                <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                                    <X className="h-4 w-4 mr-2" />
                                    Clear Filters
                                </Button>
                            ) : (
                                <Link href="/portal/agent/applications/new">
                                    <Button className="mt-4">Add Application</Button>
                                </Link>
                            )}
                        </CardContent>
                    </Card>
                ) : view === 'kanban' ? (
                    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 min-w-0 sm:min-w-[640px] lg:min-w-0">
                            {KANBAN_STAGES.map((stage) => {
                                const stageApplications = getApplicationsByStage(stage);

                                return (
                                    <div key={stage} className="flex flex-col">
                                        <div className="bg-muted/50 px-4 py-3 rounded-t-lg border border-b-0 border-border">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-semibold text-sm">{STAGE_LABELS[stage]}</h3>
                                                <Badge variant="secondary">{stageApplications.length}</Badge>
                                            </div>
                                        </div>

                                        <div className="flex-1 bg-muted/20 p-3 rounded-b-lg border border-border space-y-3 min-h-[500px]">
                                            {stageApplications.map((app) => {
                                                const { qualification, rto } = getOfferingRelations(app);

                                                return (
                                                    <Link key={app.id} href={`/portal/agent/applications/${app.id}`}>
                                                        <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                                                            <div className="space-y-3">
                                                                <p className="font-medium text-sm text-primary">
                                                                    {resolveApplicationId(app.application_number, app.student_uid)}
                                                                </p>

                                                                <div className="flex items-center gap-2">
                                                                    <User className="w-4 h-4 text-muted-foreground" />
                                                                    <p className="text-sm font-medium">
                                                                        {app.student_first_name} {app.student_last_name}
                                                                    </p>
                                                                </div>

                                                                {qualification && (
                                                                    <div className="flex items-start gap-2">
                                                                        <GraduationCap className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                                                            {qualification.code} - {qualification.name}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {rto && (
                                                                    <div className="flex items-center gap-2">
                                                                        <Building2 className="w-4 h-4 text-muted-foreground" />
                                                                        <p className="text-xs text-muted-foreground truncate">{rto.name}</p>
                                                                    </div>
                                                                )}

                                                                {app.appointment_date && (
                                                                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                                                                        <Calendar className="w-4 h-4 text-muted-foreground" />
                                                                        <p className="text-xs text-muted-foreground">
                                                                            Appointment {formatAppointmentDateTime(app.appointment_date, app.appointment_time)}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </Card>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table className="min-w-[980px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[140px]">ID</TableHead>
                                            <TableHead>Student</TableHead>
                                            <TableHead>Qualification</TableHead>
                                            <TableHead>RTO</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Appointment</TableHead>
                                            <TableHead>Created</TableHead>
                                            <TableHead className="w-[100px]" />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredApplications.map((app) => {
                                            const { qualification, rto } = getOfferingRelations(app);

                                            return (
                                                <TableRow key={app.id}>
                                                    <TableCell className="font-medium text-primary">
                                                        {resolveApplicationId(app.application_number, app.student_uid)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {app.student_first_name} {app.student_last_name}
                                                    </TableCell>
                                                    <TableCell>
                                                        {qualification ? `${qualification.code} - ${qualification.name}` : '-'}
                                                    </TableCell>
                                                    <TableCell>{rto?.name || '-'}</TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className={STAGE_BADGE_COLORS[app.workflow_stage]}
                                                        >
                                                            {STAGE_LABELS[app.workflow_stage]}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{formatAppointmentDateTime(app.appointment_date, app.appointment_time)}</TableCell>
                                                    <TableCell>{formatDate(app.created_at)}</TableCell>
                                                    <TableCell>
                                                        <Link href={`/portal/agent/applications/${app.id}`}>
                                                            <Button variant="ghost" size="sm">View</Button>
                                                        </Link>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </main>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    AlertTriangle,
    Loader2,
    RefreshCw,
    Search,
    Mail,
    MessageSquare,
    Download,
    ExternalLink,
    ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { ACTIVE_RECORD_FILTER } from '@/lib/soft-delete';

interface ExpiredQualificationStudent {
    applicationId: string;
    studentUid: string;
    studentName: string;
    studentEmail: string | null;
    studentPhone: string | null;
    qualificationCode: string;
    qualificationName: string;
    qualificationStatus: 'superseded' | 'deleted' | 'outdated'; // outdated = still current but has newer version
    supersededBy: string | null;
    rtoName: string;
    partnerName: string | null;
    workflowStage: string;
    createdAt: string;
}

export default function ExpiredQualificationsPage() {
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<ExpiredQualificationStudent[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [contactDialogOpen, setContactDialogOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<ExpiredQualificationStudent | null>(null);
    const supabase = createClient();

    useEffect(() => {
        fetchExpiredQualificationStudents();
    }, []);

    const fetchExpiredQualificationStudents = async () => {
        setLoading(true);

        // First, fetch all qualifications to build a map of base code -> latest release
        // Qualification code format: ABC123YY where YY is the release year (e.g., BSB50120 = 2020 release)
        const { data: allQualifications } = await supabase
            .from('qualifications')
            .select('code, name, status, superseded_by')
            .eq('status', 'current');

        // Build map of base code (first 6 chars) -> highest release year
        const latestVersionMap = new Map<string, { code: string; releaseYear: number }>();

        for (const qual of allQualifications || []) {
            if (!qual.code || qual.code.length < 8) continue;

            const baseCode = qual.code.slice(0, 6); // e.g., BSB501 from BSB50120
            const releaseYear = parseInt(qual.code.slice(-2), 10); // e.g., 20 from BSB50120

            if (isNaN(releaseYear)) continue;

            const existing = latestVersionMap.get(baseCode);
            if (!existing || releaseYear > existing.releaseYear) {
                latestVersionMap.set(baseCode, { code: qual.code, releaseYear });
            }
        }

        // Query applications with their qualifications
        const { data, error } = await supabase
            .from('applications')
            .select(`
                id,
                student_uid,
                student_first_name,
                student_last_name,
                student_email,
                student_phone,
                workflow_stage,
                created_at,
                partner:partners(company_name),
                offering:rto_offerings(
                    qualification:qualifications(code, name, status, superseded_by),
                    rto:rtos(name)
                )
            `)
            .or(ACTIVE_RECORD_FILTER)
            .eq('application_outcome', 'active')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching students:', error);
            setLoading(false);
            return;
        }

        // Filter to expired/superseded/outdated qualifications
        const expiredStudents: ExpiredQualificationStudent[] = [];

        for (const app of data || []) {
            const offering = app.offering as any;
            const qualification = offering?.qualification;

            if (!qualification || !qualification.code) continue;

            const code = qualification.code;
            const baseCode = code.length >= 6 ? code.slice(0, 6) : code;
            const releaseYear = code.length >= 8 ? parseInt(code.slice(-2), 10) : NaN;

            // Check if status is not current (superseded or deleted)
            const isExpired = qualification.status !== 'current';

            // Check if superseded_by field is set
            const hasSupersededBy = qualification.superseded_by != null && qualification.superseded_by !== '';

            // Check if there's a newer release year available for the same base code
            const latestVersion = latestVersionMap.get(baseCode);
            const hasNewerRelease = latestVersion && !isNaN(releaseYear) && releaseYear < latestVersion.releaseYear;

            if (!isExpired && !hasSupersededBy && !hasNewerRelease) {
                continue;
            }

            // Determine the display status and superseding code
            let displayStatus: 'superseded' | 'deleted' | 'outdated';
            let supersededByCode: string | null = qualification.superseded_by || null;

            if (qualification.status === 'deleted') {
                displayStatus = 'deleted';
            } else if (qualification.status === 'superseded') {
                displayStatus = 'superseded';
            } else if (hasNewerRelease && latestVersion) {
                // Status is 'current' but a newer release exists
                displayStatus = 'outdated';
                supersededByCode = latestVersion.code;
            } else {
                // Has superseded_by set
                displayStatus = 'outdated';
            }

            expiredStudents.push({
                applicationId: app.id,
                studentUid: app.student_uid,
                studentName: `${app.student_first_name} ${app.student_last_name}`.trim(),
                studentEmail: app.student_email,
                studentPhone: app.student_phone,
                qualificationCode: qualification.code,
                qualificationName: qualification.name,
                qualificationStatus: displayStatus,
                supersededBy: supersededByCode,
                rtoName: offering?.rto?.name || 'Unknown',
                partnerName: (app.partner as any)?.company_name || null,
                workflowStage: app.workflow_stage,
                createdAt: app.created_at,
            });
        }

        setStudents(expiredStudents);
        setLoading(false);
    };

    const openContactDialog = (student: ExpiredQualificationStudent) => {
        setSelectedStudent(student);
        setContactDialogOpen(true);
    };

    const exportToCSV = () => {
        const headers = [
            'Student UID',
            'Student Name',
            'Email',
            'Phone',
            'Qualification Code',
            'Qualification Name',
            'Status',
            'Superseded By',
            'RTO',
            'Partner',
            'Workflow Stage',
        ];

        const rows = filteredStudents.map(s => [
            s.studentUid,
            s.studentName,
            s.studentEmail || '',
            s.studentPhone || '',
            s.qualificationCode,
            s.qualificationName,
            s.qualificationStatus,
            s.supersededBy || '',
            s.rtoName,
            s.partnerName || '',
            s.workflowStage,
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expired-qualifications-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const filteredStudents = students.filter(student => {
        const matchesSearch =
            student.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.studentUid.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.qualificationCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.qualificationName.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || student.qualificationStatus === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const supersededCount = students.filter(s => s.qualificationStatus === 'superseded').length;
    const deletedCount = students.filter(s => s.qualificationStatus === 'deleted').length;
    const outdatedCount = students.filter(s => s.qualificationStatus === 'outdated').length;

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                            <AlertTriangle className="h-6 w-6 text-amber-500" />
                            Expired Qualifications
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Students enrolled in superseded or deleted qualifications
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={fetchExpiredQualificationStudents}>
                            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportToCSV} disabled={filteredStudents.length === 0}>
                            <Download className="h-4 w-4 mr-1" />
                            Export CSV
                        </Button>
                    </div>
                </div>
            </header>

            <div className="p-6 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Affected</p>
                                    <p className="text-3xl font-bold">{students.length}</p>
                                </div>
                                <AlertTriangle className="h-10 w-10 text-amber-500/20" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Superseded</p>
                                    <p className="text-3xl font-bold text-amber-600">{supersededCount}</p>
                                </div>
                                <Badge variant="outline" className="text-amber-600 border-amber-200">
                                    Needs Upgrade
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Outdated</p>
                                    <p className="text-3xl font-bold text-blue-600">{outdatedCount}</p>
                                </div>
                                <Badge variant="outline" className="text-blue-600 border-blue-200">
                                    Newer Available
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Deleted</p>
                                    <p className="text-3xl font-bold text-red-600">{deletedCount}</p>
                                </div>
                                <Badge variant="outline" className="text-red-600 border-red-200">
                                    Critical
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex flex-wrap gap-4">
                            <div className="flex-1 min-w-[200px] max-w-md">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by name, ID, or qualification..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Filter by status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="outdated">Outdated (Newer Avail.)</SelectItem>
                                    <SelectItem value="superseded">Superseded</SelectItem>
                                    <SelectItem value="deleted">Deleted</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Students Table */}
                <Card>
                    <CardHeader className="pb-0">
                        <CardTitle className="text-base">
                            Affected Students ({filteredStudents.length})
                        </CardTitle>
                        <CardDescription>
                            Contact students to inform them of qualification changes
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredStudents.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student</TableHead>
                                            <TableHead>Qualification</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>RTO</TableHead>
                                            <TableHead>Stage</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredStudents.map((student) => (
                                            <TableRow key={student.applicationId}>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{student.studentName}</p>
                                                        <p className="text-xs text-muted-foreground">{student.studentUid}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-mono text-sm">{student.qualificationCode}</p>
                                                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                            {student.qualificationName}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <Badge
                                                            variant="outline"
                                                            className={
                                                                student.qualificationStatus === 'outdated'
                                                                    ? 'text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/20'
                                                                    : student.qualificationStatus === 'superseded'
                                                                        ? 'text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/20'
                                                                        : 'text-red-600 border-red-200 bg-red-50 dark:bg-red-900/20'
                                                            }
                                                        >
                                                            {student.qualificationStatus === 'outdated' ? 'newer available' : student.qualificationStatus}
                                                        </Badge>
                                                        {student.supersededBy && (
                                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                <ArrowRight className="h-3 w-3" />
                                                                <span className="font-mono">{student.supersededBy}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {student.rtoName}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-xs">
                                                        {student.workflowStage.replace(/_/g, ' ')}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => openContactDialog(student)}
                                                            title="Contact student"
                                                        >
                                                            <Mail className="h-4 w-4" />
                                                        </Button>
                                                        <Link href={`/portal/applications/${student.applicationId}`}>
                                                            <Button variant="ghost" size="icon" title="View application">
                                                                <ExternalLink className="h-4 w-4" />
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No affected students found</p>
                                <p className="text-sm">All enrolled qualifications are current</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Contact Dialog */}
            <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Contact Student</DialogTitle>
                        <DialogDescription>
                            Send a notification about qualification changes
                        </DialogDescription>
                    </DialogHeader>
                    {selectedStudent && (
                        <div className="space-y-4 py-4">
                            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                                <p className="font-medium">{selectedStudent.studentName}</p>
                                <p className="text-sm text-muted-foreground">
                                    {selectedStudent.qualificationCode} - {selectedStudent.qualificationName}
                                </p>
                                {selectedStudent.supersededBy && (
                                    <p className="text-sm">
                                        <span className="text-muted-foreground">Superseded by:</span>{' '}
                                        <span className="font-mono">{selectedStudent.supersededBy}</span>
                                    </p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {selectedStudent.studentEmail && (
                                    <a
                                        href={`mailto:${selectedStudent.studentEmail}?subject=Important: Qualification Update - ${selectedStudent.qualificationCode}`}
                                        className="flex items-center justify-center gap-2 p-3 border rounded-lg hover:bg-muted transition-colors"
                                    >
                                        <Mail className="h-4 w-4" />
                                        <span className="text-sm">Send Email</span>
                                    </a>
                                )}
                                {selectedStudent.studentPhone && (
                                    <a
                                        href={`sms:${selectedStudent.studentPhone}`}
                                        className="flex items-center justify-center gap-2 p-3 border rounded-lg hover:bg-muted transition-colors"
                                    >
                                        <MessageSquare className="h-4 w-4" />
                                        <span className="text-sm">Send SMS</span>
                                    </a>
                                )}
                            </div>
                            <div className="text-center">
                                <Link href="/portal/settings/communications">
                                    <Button variant="link" className="text-sm">
                                        Or use Bulk Communications →
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setContactDialogOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
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
} from '@/components/ui/alert-dialog';
import {
    Users,
    Loader2,
    RefreshCw,
    Search,
    GitMerge,
    AlertTriangle,
    Mail,
    Phone,
    FileText,
    Calendar
} from 'lucide-react';

interface StudentMaster {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    passport_number: string | null;
    nationality: string | null;
    dob: string | null;
}

interface DuplicateGroup {
    key: string;
    reason: string;
    students: StudentMaster[];
}

export default function StudentsPage() {
    const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
    const [students, setStudents] = useState<StudentMaster[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
    const [keepId, setKeepId] = useState<string>('');
    const [isMerging, setIsMerging] = useState(false);
    const [viewMode, setViewMode] = useState<'duplicates' | 'all'>('duplicates');

    useEffect(() => {
        if (viewMode === 'duplicates') {
            fetchDuplicates();
        } else {
            fetchAllStudents();
        }
    }, [viewMode]);

    async function fetchDuplicates() {
        setLoading(true);
        try {
            const res = await fetch('/api/students/duplicates');
            const { data, error } = await res.json();
            if (error) throw new Error(error);
            setDuplicates(data || []);
        } catch (error) {
            console.error('Error fetching duplicates:', error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchAllStudents() {
        setLoading(true);
        try {
            const res = await fetch(`/api/students/duplicates?all=true&search=${encodeURIComponent(search)}`);
            const { data, error } = await res.json();
            if (error) throw new Error(error);
            setStudents(data || []);
        } catch (error) {
            console.error('Error fetching students:', error);
        } finally {
            setLoading(false);
        }
    }

    const openMergeDialog = (group: DuplicateGroup) => {
        setSelectedGroup(group);
        setKeepId(group.students[0].id);
        setMergeDialogOpen(true);
    };

    const handleMerge = async () => {
        if (!selectedGroup || !keepId) return;

        setIsMerging(true);
        try {
            const mergeIds = selectedGroup.students
                .filter(s => s.id !== keepId)
                .map(s => s.id);

            const res = await fetch('/api/students/duplicates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keepId, mergeIds }),
            });

            const { error } = await res.json();
            if (error) throw new Error(error);

            setMergeDialogOpen(false);
            setConfirmDialogOpen(false);
            await fetchDuplicates();
        } catch (error) {
            console.error('Error merging students:', error);
        } finally {
            setIsMerging(false);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Student Master
                        </CardTitle>
                        <CardDescription>
                            View and manage student records. Find and merge duplicate entries.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex border rounded-md">
                            <Button
                                variant={viewMode === 'duplicates' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('duplicates')}
                            >
                                Duplicates
                            </Button>
                            <Button
                                variant={viewMode === 'all' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('all')}
                            >
                                All Students
                            </Button>
                        </div>
                        <Button variant="outline" onClick={viewMode === 'duplicates' ? fetchDuplicates : fetchAllStudents}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {viewMode === 'all' && (
                        <div className="mb-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name, email, or passport..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && fetchAllStudents()}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    )}

                    {viewMode === 'duplicates' ? (
                        <>
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-muted/50 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold">{duplicates.length}</div>
                                    <div className="text-sm text-muted-foreground">Duplicate Groups</div>
                                </div>
                                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold text-yellow-600">
                                        {duplicates.reduce((sum, g) => sum + g.students.length, 0)}
                                    </div>
                                    <div className="text-sm text-muted-foreground">Total Affected</div>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold text-blue-600">
                                        {duplicates.filter(g => g.reason.includes('email')).length}
                                    </div>
                                    <div className="text-sm text-muted-foreground">Email Duplicates</div>
                                </div>
                            </div>

                            {/* Duplicate Groups */}
                            {duplicates.length > 0 ? (
                                <div className="space-y-4">
                                    {duplicates.map((group) => (
                                        <Card key={group.key} className="border-yellow-200 bg-yellow-50/30">
                                            <CardHeader className="pb-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                                        <span className="font-medium">{group.reason}</span>
                                                        <Badge variant="outline">{group.students.length} records</Badge>
                                                    </div>
                                                    <Button size="sm" onClick={() => openMergeDialog(group)}>
                                                        <GitMerge className="h-4 w-4 mr-2" />
                                                        Merge
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="rounded-md border bg-white">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Name</TableHead>
                                                                <TableHead>Email</TableHead>
                                                                <TableHead>Phone</TableHead>
                                                                <TableHead>Passport</TableHead>
                                                                <TableHead>DOB</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {group.students.map((student) => (
                                                                <TableRow key={student.id}>
                                                                    <TableCell className="font-medium">
                                                                        {student.first_name} {student.last_name}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {student.email ? (
                                                                            <div className="flex items-center gap-1">
                                                                                <Mail className="h-3 w-3 text-muted-foreground" />
                                                                                {student.email}
                                                                            </div>
                                                                        ) : '-'}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {student.phone ? (
                                                                            <div className="flex items-center gap-1">
                                                                                <Phone className="h-3 w-3 text-muted-foreground" />
                                                                                {student.phone}
                                                                            </div>
                                                                        ) : '-'}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {student.passport_number ? (
                                                                            <div className="flex items-center gap-1">
                                                                                <FileText className="h-3 w-3 text-muted-foreground" />
                                                                                {student.passport_number}
                                                                            </div>
                                                                        ) : '-'}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {student.dob ? (
                                                                            <div className="flex items-center gap-1">
                                                                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                                                                {formatDate(student.dob)}
                                                                            </div>
                                                                        ) : '-'}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                    <p>No duplicate records found.</p>
                                    <p className="text-sm">All student records appear to be unique.</p>
                                </div>
                            )}
                        </>
                    ) : (
                        /* All Students View */
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Passport</TableHead>
                                        <TableHead>Nationality</TableHead>
                                        <TableHead>DOB</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {students.map((student) => (
                                        <TableRow key={student.id}>
                                            <TableCell className="font-medium">
                                                {student.first_name} {student.last_name}
                                            </TableCell>
                                            <TableCell>{student.email || '-'}</TableCell>
                                            <TableCell>{student.phone || '-'}</TableCell>
                                            <TableCell>{student.passport_number || '-'}</TableCell>
                                            <TableCell>{student.nationality || '-'}</TableCell>
                                            <TableCell>{formatDate(student.dob)}</TableCell>
                                        </TableRow>
                                    ))}
                                    {students.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                No students found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Merge Dialog */}
            <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <GitMerge className="h-5 w-5" />
                            Merge Duplicate Records
                        </DialogTitle>
                        <DialogDescription>
                            Select the primary record to keep. Other records will be merged into it.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedGroup && (
                        <div className="space-y-4">
                            <div className="text-sm text-muted-foreground">
                                {selectedGroup.reason}
                            </div>

                            <div className="space-y-2">
                                {selectedGroup.students.map((student) => (
                                    <div
                                        key={student.id}
                                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${keepId === student.id
                                                ? 'border-primary bg-primary/5'
                                                : 'hover:border-gray-400'
                                            }`}
                                        onClick={() => setKeepId(student.id)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                checked={keepId === student.id}
                                                onChange={() => setKeepId(student.id)}
                                            />
                                            <div>
                                                <div className="font-medium">
                                                    {student.first_name} {student.last_name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {student.email || 'No email'} • {student.passport_number || 'No passport'}
                                                </div>
                                            </div>
                                            {keepId === student.id && (
                                                <Badge className="ml-auto">Keep</Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                                <div className="flex items-center gap-2 text-yellow-800">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span className="font-medium">This action cannot be undone</span>
                                </div>
                                <p className="text-yellow-700 mt-1">
                                    All applications linked to merged records will be reassigned to the kept record.
                                </p>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => setConfirmDialogOpen(true)} disabled={!keepId}>
                            <GitMerge className="h-4 w-4 mr-2" />
                            Merge Records
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Dialog */}
            <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Merge</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you absolutely sure you want to merge these records? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleMerge} disabled={isMerging}>
                            {isMerging && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Confirm Merge
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

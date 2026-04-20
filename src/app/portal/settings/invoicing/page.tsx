'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    FileText,
    Plus,
    Search,
    Loader2,
    RefreshCw,
    Download,
    Send,
    DollarSign,
    CheckCircle,
    Clock,
    AlertCircle,
    Trash2,
    Eye,
} from 'lucide-react';
import {
    type Invoice,
    type InvoiceStatus,
    INVOICE_STATUS_LABELS,
    INVOICE_STATUS_COLORS,
} from '@/types/database';
import {
    updateInvoiceStatus,
    deleteInvoice,
    formatCurrency,
    generateInvoiceHTML,
    invoiceToGenerated,
    sendInvoiceEmail,
    sendBulkInvoiceEmails,
} from '@/lib/services/invoice-generator';
import { toast } from 'sonner';

export default function InvoicingPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
    const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
    const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
    const [bulkProcessing, setBulkProcessing] = useState(false);
    const [sendDialogOpen, setSendDialogOpen] = useState(false);
    const [sendTarget, setSendTarget] = useState<'agent' | 'student'>('agent');
    const [isSending, setIsSending] = useState(false);

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            if (statusFilter !== 'all') {
                query.set('status', statusFilter);
            }

            const queryString = query.toString();
            const response = await fetch(
                `/api/invoices/list${queryString ? `?${queryString}` : ''}`,
                { method: 'GET' }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result?.error || 'Failed to load invoices');
            }

            setInvoices(Array.isArray(result?.invoices) ? result.invoices : []);
        } catch (error) {
            setInvoices([]);
            toast.error('Failed to load invoices', {
                description: error instanceof Error ? error.message : 'Unexpected error while loading invoicing hub',
            });
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void fetchInvoices();
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [fetchInvoices]);

    // Filter invoices based on search
    const filteredInvoices = invoices.filter((inv) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const applicationNumber = (inv.application?.application_number || '').toLowerCase();
        const applicationStudentUid = (inv.application?.student_uid || '').toLowerCase();
        return (
            inv.id.toLowerCase().includes(q) ||
            (inv.application_id || '').toLowerCase().includes(q) ||
            inv.invoice_number.toLowerCase().includes(q) ||
            applicationNumber.includes(q) ||
            applicationStudentUid.includes(q) ||
            inv.student_name.toLowerCase().includes(q) ||
            inv.course_name?.toLowerCase().includes(q) ||
            inv.rto_name?.toLowerCase().includes(q)
        );
    });

    // Stats
    const stats = {
        total: invoices.length,
        draft: invoices.filter(i => i.status === 'draft').length,
        sent: invoices.filter(i => i.status === 'sent').length,
        paid: invoices.filter(i => i.status === 'paid').length,
        overdue: invoices.filter(i => i.status === 'overdue').length,
        totalAmount: invoices.reduce((sum, i) => sum + (i.total_amount || 0), 0),
        paidAmount: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total_amount || 0), 0),
    };

    const toggleInvoiceSelection = (id: string) => {
        const newSet = new Set(selectedInvoices);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedInvoices(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedInvoices.size === filteredInvoices.length) {
            setSelectedInvoices(new Set());
        } else {
            setSelectedInvoices(new Set(filteredInvoices.map(i => i.id)));
        }
    };

    const handleStatusChange = async (id: string, status: InvoiceStatus) => {
        const success = await updateInvoiceStatus(id, status);
        if (success) {
            await fetchInvoices();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this invoice?')) return;
        const success = await deleteInvoice(id);
        if (success) {
            await fetchInvoices();
        }
    };

    const handleBulkSend = async () => {
        setSendDialogOpen(true);
    };

    const confirmBulkSend = async () => {
        setIsSending(true);
        const result = await sendBulkInvoiceEmails(
            Array.from(selectedInvoices),
            sendTarget
        );
        setIsSending(false);
        setSendDialogOpen(false);

        if (result.success) {
            toast.success(`Sent ${result.sent} invoice(s) successfully`);
        } else if (result.sent > 0) {
            toast.warning(`Sent ${result.sent}, failed ${result.failed}`);
        } else {
            toast.error('Failed to send invoices');
        }

        setSelectedInvoices(new Set());
        await fetchInvoices();
    };

    const handleSingleSend = async (invoiceId: string, target: 'student' | 'agent') => {
        const result = await sendInvoiceEmail(invoiceId, target);
        if (result.success) {
            toast.success(`Invoice sent to ${result.recipient}`);
            await fetchInvoices();
        } else {
            toast.error(result.error || 'Failed to send invoice');
        }
    };

    const handlePreview = (invoice: Invoice) => {
        setPreviewInvoice(invoice);
    };

    const formatDate = (date: string | null) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-foreground">Invoicing</h1>
                        <p className="text-sm text-muted-foreground">
                            Manage invoices for agents and customers
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchInvoices}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                    <Button onClick={() => setBulkDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Bulk Generate
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Total</span>
                        </div>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-muted-foreground">Draft</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <Send className="h-4 w-4 text-blue-500" />
                            <span className="text-sm text-muted-foreground">Sent</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-600">{stats.sent}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-muted-foreground">Paid</span>
                        </div>
                        <div className="text-2xl font-bold text-green-600">{stats.paid}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-muted-foreground">Overdue</span>
                        </div>
                        <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-emerald-500" />
                            <span className="text-sm text-muted-foreground">Collected</span>
                        </div>
                        <div className="text-xl font-bold text-emerald-600">
                            {formatCurrency(stats.paidAmount)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters & Actions */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search invoices..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                        {selectedInvoices.size > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                    {selectedInvoices.size} selected
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleBulkSend}
                                    disabled={bulkProcessing}
                                >
                                    <Send className="h-4 w-4 mr-1" />
                                    Send Selected
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Invoice Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Invoices</CardTitle>
                    <CardDescription>
                        {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} found
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]">
                                        <Checkbox
                                            checked={selectedInvoices.size === filteredInvoices.length && filteredInvoices.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Course</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Due Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredInvoices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                            No invoices found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredInvoices.map((invoice) => (
                                        <TableRow key={invoice.id}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedInvoices.has(invoice.id)}
                                                    onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {invoice.invoice_number}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {invoice.student_name}
                                            </TableCell>
                                            <TableCell>
                                                <div className="max-w-[200px] truncate">
                                                    {invoice.course_name || '-'}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {invoice.rto_name}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-medium">
                                                {formatCurrency(invoice.total_amount)}
                                            </TableCell>
                                            <TableCell>{formatDate(invoice.due_date)}</TableCell>
                                            <TableCell>
                                                <Badge className={INVOICE_STATUS_COLORS[invoice.status]}>
                                                    {INVOICE_STATUS_LABELS[invoice.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handlePreview(invoice)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    {invoice.status === 'draft' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleStatusChange(invoice.id, 'sent')}
                                                        >
                                                            <Send className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {invoice.status === 'sent' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleStatusChange(invoice.id, 'paid')}
                                                        >
                                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(invoice.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Preview Dialog */}
            <Dialog open={!!previewInvoice} onOpenChange={() => setPreviewInvoice(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Invoice Preview</DialogTitle>
                        <DialogDescription>
                            {previewInvoice?.invoice_number}
                        </DialogDescription>
                    </DialogHeader>
                    {previewInvoice && (
                        <div
                            className="bg-white p-4 rounded border"
                            dangerouslySetInnerHTML={{
                                __html: generateInvoiceHTML(invoiceToGenerated(previewInvoice))
                            }}
                        />
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPreviewInvoice(null)}>
                            Close
                        </Button>
                        <Button>
                            <Download className="h-4 w-4 mr-2" />
                            Download PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Generate Dialog */}
            <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Bulk Generate Invoices</DialogTitle>
                        <DialogDescription>
                            Generate invoices for multiple applications at once.
                            Go to Applications page and use the bulk actions there.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 text-center text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>
                            To generate bulk invoices, go to the Applications page,
                            select the applications you want to invoice, and use the
                            bulk actions menu.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Send Invoices Dialog */}
            <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Send Invoices</DialogTitle>
                        <DialogDescription>
                            Send {selectedInvoices.size} invoice(s) via email
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Choose who should receive the invoice emails:
                        </p>
                        <div className="flex gap-4">
                            <Button
                                variant={sendTarget === 'agent' ? 'default' : 'outline'}
                                className="flex-1"
                                onClick={() => setSendTarget('agent')}
                            >
                                Send to Agents
                            </Button>
                            <Button
                                variant={sendTarget === 'student' ? 'default' : 'outline'}
                                className="flex-1"
                                onClick={() => setSendTarget('student')}
                            >
                                Send to Students
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {sendTarget === 'agent'
                                ? 'Invoices will be grouped by agent. Each agent receives one email with all their students\' invoices.'
                                : 'Each student will receive an individual email with their invoice.'}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={confirmBulkSend} disabled={isSending}>
                            {isSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            <Send className="h-4 w-4 mr-2" />
                            Send Emails
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

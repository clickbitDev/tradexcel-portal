'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
    Receipt,
    Plus,
    Search,
    Loader2,
    RefreshCw,
    DollarSign,
    CheckCircle,
    Clock,
    AlertCircle,
    Trash2,
    Building2,
    Eye,
} from 'lucide-react';
import {
    type Bill,
    type BillStatus,
    BILL_STATUS_LABELS,
    BILL_STATUS_COLORS,
} from '@/types/database';
import {
    createBill,
    updateBillStatus,
    deleteBill,
} from '@/lib/services/bill-service';
import { toast } from 'sonner';

export default function BillingPage() {
    const [bills, setBills] = useState<Bill[]>([]);
    const [rtos, setRtos] = useState<Array<{ id: string; name: string; code: string }>>([]);
    const [billSummary, setBillSummary] = useState<Array<{
        rto_id: string;
        rto_name: string;
        total_pending: number;
        total_paid: number;
        count: number;
    }>>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [rtoFilter, setRtoFilter] = useState<string>('all');
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [detailBill, setDetailBill] = useState<Bill | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        rtoId: '',
        rtoInvoiceNumber: '',
        description: '',
        tuitionCost: 0,
        materialCost: 0,
        otherCosts: 0,
        dueDate: '',
        notes: '',
    });

    const buildBillSummary = (items: Bill[]) => {
        const summary = new Map<string, { rto_name: string; total_pending: number; total_paid: number; count: number }>();

        for (const bill of items) {
            const rtoId = bill.rto_id || 'unknown';
            const rtoData = bill.rto as unknown;
            const rto = Array.isArray(rtoData) ? rtoData[0] : rtoData;
            const rtoName = (rto as { name?: string } | null)?.name || 'Unknown RTO';

            if (!summary.has(rtoId)) {
                summary.set(rtoId, { rto_name: rtoName, total_pending: 0, total_paid: 0, count: 0 });
            }

            const entry = summary.get(rtoId);
            if (!entry) {
                continue;
            }

            entry.count += 1;

            if (bill.status === 'paid') {
                entry.total_paid += bill.total_amount || 0;
            } else if (bill.status !== 'cancelled') {
                entry.total_pending += bill.total_amount || 0;
            }
        }

        return Array.from(summary.entries()).map(([rto_id, data]) => ({
            rto_id,
            ...data,
        }));
    };

    const fetchData = useCallback(async () => {
        setLoading(true);

        try {
            const query = new URLSearchParams();
            if (statusFilter !== 'all') {
                query.set('status', statusFilter);
            }

            const queryString = query.toString();
            const billsPromise = fetch(`/api/bills/list${queryString ? `?${queryString}` : ''}`, {
                method: 'GET',
            });

            const rtosPromise = createClient()
                .from('rtos')
                .select('id, name, code')
                .order('name');

            const [billsResponse, rtosResult] = await Promise.all([billsPromise, rtosPromise]);
            const billsResult = await billsResponse.json();

            if (!billsResponse.ok) {
                throw new Error(billsResult?.error || 'Failed to load bills');
            }

            const billsData = Array.isArray(billsResult?.bills) ? billsResult.bills : [];
            setBills(billsData);
            setBillSummary(buildBillSummary(billsData));

            if (rtosResult.data) {
                setRtos(rtosResult.data);
            }
        } catch (error) {
            setBills([]);
            setBillSummary([]);
            toast.error('Failed to load billing hub', {
                description: error instanceof Error ? error.message : 'Unexpected error while loading bills',
            });
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void fetchData();
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [fetchData]);

    // Filter bills
    const filteredBills = bills.filter((bill) => {
        if (!searchQuery && rtoFilter === 'all') return true;

        const q = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || (
            bill.bill_number.toLowerCase().includes(q) ||
            bill.description?.toLowerCase().includes(q) ||
            bill.rto_invoice_number?.toLowerCase().includes(q)
        );

        const matchesRto = rtoFilter === 'all' || bill.rto_id === rtoFilter;

        return matchesSearch && matchesRto;
    });

    // Stats
    const stats = {
        total: bills.length,
        pending: bills.filter(b => b.status === 'pending').length,
        paid: bills.filter(b => b.status === 'paid').length,
        overdue: bills.filter(b => b.status === 'overdue').length,
        totalOwed: bills.filter(b => b.status !== 'paid' && b.status !== 'cancelled')
            .reduce((sum, b) => sum + (b.total_amount || 0), 0),
        totalPaid: bills.filter(b => b.status === 'paid')
            .reduce((sum, b) => sum + (b.total_amount || 0), 0),
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
        }).format(amount);
    };

    const formatDate = (date: string | null) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const handleCreate = async () => {
        if (!formData.rtoId) return;

        setIsSaving(true);
        const bill = await createBill({
            rtoId: formData.rtoId,
            rtoInvoiceNumber: formData.rtoInvoiceNumber || undefined,
            description: formData.description || undefined,
            tuitionCost: formData.tuitionCost,
            materialCost: formData.materialCost,
            otherCosts: formData.otherCosts || undefined,
            dueDate: formData.dueDate || undefined,
            notes: formData.notes || undefined,
        });

        if (bill) {
            await fetchData();
            setCreateDialogOpen(false);
            resetForm();
        }
        setIsSaving(false);
    };

    const resetForm = () => {
        setFormData({
            rtoId: '',
            rtoInvoiceNumber: '',
            description: '',
            tuitionCost: 0,
            materialCost: 0,
            otherCosts: 0,
            dueDate: '',
            notes: '',
        });
    };

    const handleStatusChange = async (id: string, status: BillStatus, paymentInfo?: { reference?: string; method?: string }) => {
        const success = await updateBillStatus(id, status, paymentInfo);
        if (success) {
            await fetchData();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this bill?')) return;
        const success = await deleteBill(id);
        if (success) {
            await fetchData();
        }
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
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                        <Receipt className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-foreground">Billing</h1>
                        <p className="text-sm text-muted-foreground">
                            Track bills from RTOs and sources
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchData}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                    <Button onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Bill
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Total</span>
                        </div>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm text-muted-foreground">Pending</span>
                        </div>
                        <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
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
                            <DollarSign className="h-4 w-4 text-orange-500" />
                            <span className="text-sm text-muted-foreground">Owed</span>
                        </div>
                        <div className="text-xl font-bold text-orange-600">
                            {formatCurrency(stats.totalOwed)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-muted-foreground">Paid Out</span>
                        </div>
                        <div className="text-xl font-bold text-green-600">
                            {formatCurrency(stats.totalPaid)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* RTO Summary */}
            {billSummary.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Bills by RTO
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {billSummary.map((item) => (
                                <div
                                    key={item.rto_id}
                                    className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
                                >
                                    <div className="font-medium">{item.rto_name}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {item.count} bill{item.count !== 1 ? 's' : ''}
                                    </div>
                                    <div className="flex justify-between mt-2 text-sm">
                                        <span className="text-orange-600">
                                            Pending: {formatCurrency(item.total_pending)}
                                        </span>
                                        <span className="text-green-600">
                                            Paid: {formatCurrency(item.total_paid)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search bills..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <Select value={rtoFilter} onValueChange={setRtoFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by RTO" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All RTOs</SelectItem>
                                {rtos.map((rto) => (
                                    <SelectItem key={rto.id} value={rto.id}>
                                        {rto.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="received">Received</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Bills Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Bills</CardTitle>
                    <CardDescription>
                        {filteredBills.length} bill{filteredBills.length !== 1 ? 's' : ''} found
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bill #</TableHead>
                                    <TableHead>RTO</TableHead>
                                    <TableHead>Their Invoice</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Due Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredBills.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                            No bills found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredBills.map((bill) => (
                                        <TableRow key={bill.id}>
                                            <TableCell className="font-mono text-sm">
                                                {bill.bill_number}
                                            </TableCell>
                                            <TableCell>
                                                {(bill.rto as { name?: string })?.name || '-'}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {bill.rto_invoice_number || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="max-w-[200px] truncate">
                                                    {bill.description || '-'}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-medium">
                                                {formatCurrency(bill.total_amount)}
                                            </TableCell>
                                            <TableCell>{formatDate(bill.due_date)}</TableCell>
                                            <TableCell>
                                                <Badge className={BILL_STATUS_COLORS[bill.status]}>
                                                    {BILL_STATUS_LABELS[bill.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setDetailBill(bill)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    {bill.status === 'pending' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleStatusChange(bill.id, 'paid')}
                                                            title="Mark as Paid"
                                                        >
                                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(bill.id)}
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

            {/* Create Bill Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Bill</DialogTitle>
                        <DialogDescription>
                            Record a bill from an RTO or source
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="rtoId">RTO / Source *</Label>
                            <Select
                                value={formData.rtoId}
                                onValueChange={(v) => setFormData({ ...formData, rtoId: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select RTO" />
                                </SelectTrigger>
                                <SelectContent>
                                    {rtos.map((rto) => (
                                        <SelectItem key={rto.id} value={rto.id}>
                                            {rto.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="rtoInvoiceNumber">Their Invoice Number</Label>
                            <Input
                                id="rtoInvoiceNumber"
                                value={formData.rtoInvoiceNumber}
                                onChange={(e) => setFormData({ ...formData, rtoInvoiceNumber: e.target.value })}
                                placeholder="RTO's invoice reference"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="tuitionCost">Tuition Cost</Label>
                                <Input
                                    id="tuitionCost"
                                    type="number"
                                    value={formData.tuitionCost}
                                    onChange={(e) => setFormData({ ...formData, tuitionCost: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="materialCost">Material Cost</Label>
                                <Input
                                    id="materialCost"
                                    type="number"
                                    value={formData.materialCost}
                                    onChange={(e) => setFormData({ ...formData, materialCost: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="otherCosts">Other Costs</Label>
                                <Input
                                    id="otherCosts"
                                    type="number"
                                    value={formData.otherCosts}
                                    onChange={(e) => setFormData({ ...formData, otherCosts: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>

                        <div className="p-3 bg-muted rounded-lg">
                            <div className="flex justify-between items-center">
                                <span className="font-medium">Total Amount</span>
                                <span className="text-lg font-bold">
                                    {formatCurrency(formData.tuitionCost + formData.materialCost + formData.otherCosts)}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="dueDate">Due Date</Label>
                            <Input
                                id="dueDate"
                                type="date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Brief description of this bill"
                                rows={2}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={isSaving || !formData.rtoId}>
                            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Create Bill
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bill Detail Dialog */}
            <Dialog open={!!detailBill} onOpenChange={() => setDetailBill(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Bill Details</DialogTitle>
                        <DialogDescription>
                            {detailBill?.bill_number}
                        </DialogDescription>
                    </DialogHeader>

                    {detailBill && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-sm text-muted-foreground">RTO</div>
                                    <div className="font-medium">
                                        {(detailBill.rto as { name?: string })?.name || '-'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-muted-foreground">Their Invoice</div>
                                    <div className="font-medium font-mono">
                                        {detailBill.rto_invoice_number || '-'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-muted-foreground">Status</div>
                                    <Badge className={BILL_STATUS_COLORS[detailBill.status]}>
                                        {BILL_STATUS_LABELS[detailBill.status]}
                                    </Badge>
                                </div>
                                <div>
                                    <div className="text-sm text-muted-foreground">Due Date</div>
                                    <div className="font-medium">{formatDate(detailBill.due_date)}</div>
                                </div>
                            </div>

                            <div className="border rounded-lg p-4 space-y-2">
                                <div className="flex justify-between">
                                    <span>Tuition Cost</span>
                                    <span className="font-mono">{formatCurrency(detailBill.tuition_cost)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Material Cost</span>
                                    <span className="font-mono">{formatCurrency(detailBill.material_cost)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Other Costs</span>
                                    <span className="font-mono">{formatCurrency(detailBill.other_costs)}</span>
                                </div>
                                <div className="border-t pt-2 flex justify-between font-bold">
                                    <span>Total</span>
                                    <span className="font-mono">{formatCurrency(detailBill.total_amount)}</span>
                                </div>
                            </div>

                            {detailBill.notes && (
                                <div>
                                    <div className="text-sm text-muted-foreground">Notes</div>
                                    <div className="text-sm">{detailBill.notes}</div>
                                </div>
                            )}

                            {detailBill.payment_reference && (
                                <div>
                                    <div className="text-sm text-muted-foreground">Payment Reference</div>
                                    <div className="font-mono">{detailBill.payment_reference}</div>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDetailBill(null)}>
                            Close
                        </Button>
                        {detailBill && detailBill.status !== 'paid' && (
                            <Button
                                onClick={() => {
                                    handleStatusChange(detailBill.id, 'paid');
                                    setDetailBill(null);
                                }}
                            >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark as Paid
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

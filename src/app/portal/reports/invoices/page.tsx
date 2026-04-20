'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    FileText,
    Download,
    Loader2,
    Search,
    Calendar,
    Users,
    RefreshCw,
    Eye,
} from 'lucide-react';
import { InvoicePreview, CreateInvoiceDialog } from '@/components/invoices';
import {
    createBulkInvoices,
    formatCurrency,
    generateInvoiceHTML,
    invoiceToGenerated,
    type GeneratedInvoice,
} from '@/lib/services/invoice-generator';
import {
    INVOICE_STATUS_COLORS,
    INVOICE_STATUS_LABELS,
    type Invoice,
    type Partner,
    type InvoiceStatus,
} from '@/types/database';
import { AGENT_PARTNER_TYPES } from '@/lib/partners/constants';
import { ACTIVE_RECORD_FILTER } from '@/lib/soft-delete';

interface ApplicationWithRelations {
    id: string;
    student_uid: string;
    student_first_name: string;
    student_last_name: string;
    quoted_tuition: number | null;
    quoted_materials: number | null;
    partner_id: string | null;
    workflow_stage: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    offering?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    partner?: any;
}

// Simplified partner type for filter dropdown
interface PartnerOption {
    id: string;
    company_name: string;
    type: string;
}

export default function BulkInvoicesPage() {
    const [applications, setApplications] = useState<ApplicationWithRelations[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [partners, setPartners] = useState<PartnerOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Filters
    const [partnerId, setPartnerId] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Preview state
    const [previewInvoice, setPreviewInvoice] = useState<GeneratedInvoice | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [generating, setGenerating] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        try {
            // Fetch partners
            const { data: partnersData } = await supabase
                .from('partners')
                .select('id, company_name, type')
                .in('type', AGENT_PARTNER_TYPES)
                .order('company_name');

            setPartners(partnersData || []);

            // Fetch recent invoices
            const { data: invoicesData } = await supabase
                .from('invoices')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            setInvoices(invoicesData || []);

            // Fetch applications ready for invoicing
            const { data: applicationsData } = await supabase
                .from('applications')
                .select(`
                    id,
                    student_uid,
                    student_first_name,
                    student_last_name,
                    quoted_tuition,
                    quoted_materials,
                    partner_id,
                    workflow_stage,
                    offering:rto_offerings(
                        application_fee,
                        qualification:qualifications(name, code),
                        rto:rtos(name)
                    ),
                    partner:partners(company_name)
                `)
                .or(ACTIVE_RECORD_FILTER)
                .in('workflow_stage', ['enrolled', 'dispatch', 'completed'])
                .order('created_at', { ascending: false })
                .limit(100);

            setApplications(applicationsData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }

    // Filter applications
    const filteredApplications = applications.filter((app) => {
        // Partner filter
        if (partnerId !== 'all' && app.partner_id !== partnerId) return false;

        // Search filter
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            const fullName = `${app.student_first_name} ${app.student_last_name}`.toLowerCase();
            if (
                !fullName.includes(search) &&
                !app.student_uid.toLowerCase().includes(search)
            ) {
                return false;
            }
        }

        return true;
    });

    // Selection handlers
    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const selectAll = () => {
        setSelectedIds(new Set(filteredApplications.map((a) => a.id)));
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    // Generate bulk invoices
    const handleBulkGenerate = async () => {
        if (selectedIds.size === 0) return;

        setGenerating(true);
        try {
            const selectedApps = applications.filter((a) => selectedIds.has(a.id));
            const appIds = selectedApps.map((app) => app.id);

            await createBulkInvoices(appIds, { autoSyncXero: true });

            // Refresh data
            await fetchData();
            clearSelection();
        } catch (error) {
            console.error('Error generating invoices:', error);
        } finally {
            setGenerating(false);
        }
    };

    // Preview invoice
    const handlePreviewInvoice = (invoice: Invoice) => {
        const generated = invoiceToGenerated(invoice);
        setPreviewInvoice(generated);
        setShowPreview(true);
    };

    // Download all selected as batch (using print dialog)
    const handleBulkDownload = () => {
        const selectedInvoices = invoices.filter((inv) => selectedIds.has(inv.id));
        if (selectedInvoices.length === 0) return;

        // Generate combined HTML
        const htmlParts = selectedInvoices.map((inv) => {
            const generated = invoiceToGenerated(inv);
            return generateInvoiceHTML(generated);
        });

        // Open in new window
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head><title>Batch Invoices</title></head>
                <body>
                    ${htmlParts.join('<div style="page-break-after: always;"></div>')}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.onload = () => printWindow.print();
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Bulk Invoice Generation</h1>
                    <p className="text-muted-foreground">
                        Generate invoices for multiple applications at once
                    </p>
                </div>
                <Button variant="outline" onClick={fetchData}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Invoices
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{invoices.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Pending
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">
                            {invoices.filter((i) => i.status === 'sent').length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Paid
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {invoices.filter((i) => i.status === 'paid').length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Ready for Invoice
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-indigo-600">
                            {applications.length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Applications Ready for Invoicing */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Applications Ready for Invoicing
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="flex flex-wrap gap-4 mb-4">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search students..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <Select value={partnerId} onValueChange={setPartnerId}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Filter by Partner" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Partners</SelectItem>
                                {partners.map((partner) => (
                                    <SelectItem key={partner.id} value={partner.id}>
                                        {partner.company_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Selection controls */}
                    <div className="flex items-center gap-4 mb-4">
                        <Button variant="outline" size="sm" onClick={selectAll}>
                            Select All
                        </Button>
                        <Button variant="outline" size="sm" onClick={clearSelection}>
                            Clear
                        </Button>
                        {selectedIds.size > 0 && (
                            <Button onClick={handleBulkGenerate} disabled={generating}>
                                {generating ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <FileText className="h-4 w-4 mr-2" />
                                )}
                                Generate {selectedIds.size} Invoice(s)
                            </Button>
                        )}
                    </div>

                    {/* Applications Table */}
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12"></TableHead>
                                    <TableHead>Application</TableHead>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Course</TableHead>
                                    <TableHead>Partner</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredApplications.map((app) => {
                                    const offeringData = Array.isArray(app.offering)
                                        ? app.offering[0]
                                        : app.offering;
                                    const qualData = offeringData?.qualification;
                                    const qualification = Array.isArray(qualData)
                                        ? qualData[0]
                                        : qualData;
                                    const partnerData = Array.isArray(app.partner)
                                        ? app.partner[0]
                                        : app.partner;
                                    const total =
                                        (app.quoted_tuition || 0) +
                                        (app.quoted_materials || 0) +
                                        (offeringData?.application_fee || 0);

                                    return (
                                        <TableRow key={app.id}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedIds.has(app.id)}
                                                    onCheckedChange={() => toggleSelection(app.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {app.student_uid}
                                            </TableCell>
                                            <TableCell>
                                                {app.student_first_name} {app.student_last_name}
                                            </TableCell>
                                            <TableCell>{qualification?.name || '-'}</TableCell>
                                            <TableCell>{partnerData?.company_name || '-'}</TableCell>
                                            <TableCell className="text-right font-medium">
                                                {formatCurrency(total)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {filteredApplications.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No applications ready for invoicing
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Recent Invoices */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Recent Invoices
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Course</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.slice(0, 10).map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell className="font-mono text-sm">
                                            {invoice.invoice_number}
                                        </TableCell>
                                        <TableCell>{invoice.student_name}</TableCell>
                                        <TableCell>{invoice.course_name || '-'}</TableCell>
                                        <TableCell className="font-medium">
                                            {formatCurrency(invoice.total_amount)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={INVOICE_STATUS_COLORS[invoice.status]}>
                                                {INVOICE_STATUS_LABELS[invoice.status]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(invoice.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handlePreviewInvoice(invoice)}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {invoices.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            No invoices generated yet
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Preview Dialog */}
            <InvoicePreview
                invoice={previewInvoice}
                open={showPreview}
                onOpenChange={setShowPreview}
            />
        </div>
    );
}

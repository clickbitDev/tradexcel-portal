'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link2, FileText, Receipt, Users, BarChart3, Loader2, RefreshCw, Download } from 'lucide-react';
import XeroConnectionCard from '@/components/settings/XeroConnectionCard';

type CachedInvoiceSummary = {
    id: string;
    invoice_number: string;
    student_name: string;
    course_name: string | null;
    total_amount: number;
    amount_paid: number;
    amount_due: number | null;
    xero_invoice_id?: string | null;
    xero_status?: string | null;
    xero_invoice_url?: string | null;
    xero_synced_at?: string | null;
};

function formatCurrency(amount: number | null | undefined) {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
    }).format(Number(amount || 0));
}

function humanizeStatus(status: string | null | undefined) {
    if (!status) {
        return 'Not synced';
    }

    return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusBadgeClass(status: string | null | undefined) {
    switch ((status || '').toLowerCase()) {
        case 'paid':
            return 'bg-green-100 text-green-700';
        case 'open':
            return 'bg-blue-100 text-blue-700';
        case 'pending_approval':
            return 'bg-amber-100 text-amber-700';
        case 'voided':
            return 'bg-red-100 text-red-700';
        case 'draft':
            return 'bg-gray-100 text-gray-700';
        default:
            return 'bg-muted text-muted-foreground';
    }
}

export default function XeroSettingsPage() {
    const searchParams = useSearchParams();
    const [cachedInvoices, setCachedInvoices] = useState<CachedInvoiceSummary[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(true);
    const [refreshingInvoiceId, setRefreshingInvoiceId] = useState<string | null>(null);
    const missing: string[] = [];
    if (!XeroConnectionCard) missing.push('XeroConnectionCard');
    if (!Tabs) missing.push('Tabs');
    if (!TabsList) missing.push('TabsList');
    if (!TabsTrigger) missing.push('TabsTrigger');
    if (!TabsContent) missing.push('TabsContent');
    if (!Card) missing.push('Card');
    if (!CardHeader) missing.push('CardHeader');
    if (!CardTitle) missing.push('CardTitle');
    if (!CardContent) missing.push('CardContent');
    if (!CardDescription) missing.push('CardDescription');
    if (!Badge) missing.push('Badge');

    // Handle success/error messages from OAuth callback
    useEffect(() => {
        const success = searchParams.get('success');
        const org = searchParams.get('org');
        const error = searchParams.get('error');

        if (success === 'connected') {
            toast.success(`Connected to Xero${org ? `: ${org}` : ''}`, {
                description: 'Your Xero account is now linked to Lumiere Portal',
            });
            // Clean up URL
            window.history.replaceState({}, '', '/portal/settings/xero');
        }

        if (error) {
            const errorMessages: Record<string, string> = {
                invalid_state: 'Security validation failed. Please try again.',
                no_code: 'Authorization was not completed.',
                token_exchange_failed: 'Failed to complete authorization.',
                callback_failed: 'An error occurred during connection.',
            };
            toast.error('Connection Failed', {
                description: errorMessages[error] || error,
            });
            // Clean up URL
            window.history.replaceState({}, '', '/portal/settings/xero');
        }
    }, [searchParams]);

    const loadCachedInvoices = async () => {
        setLoadingInvoices(true);
        try {
            const response = await fetch('/api/invoices/list', { cache: 'no-store' });
            const payload = await response.json().catch(() => null) as { invoices?: CachedInvoiceSummary[]; error?: string } | null;

            if (!response.ok) {
                throw new Error(payload?.error || 'Failed to load cached invoices');
            }

            const invoices = Array.isArray(payload?.invoices)
                ? payload.invoices.filter((invoice) => Boolean(invoice.xero_invoice_id))
                : [];
            setCachedInvoices(invoices);
        } catch (loadError) {
            toast.error('Failed to load cached Xero invoices', {
                description: loadError instanceof Error ? loadError.message : 'Unexpected Xero invoice cache error',
            });
            setCachedInvoices([]);
        } finally {
            setLoadingInvoices(false);
        }
    };

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadCachedInvoices();
        }, 0);

        return () => window.clearTimeout(timer);
    }, []);

    const invoiceMetrics = useMemo(() => {
        const total = cachedInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
        const paid = cachedInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid || 0), 0);
        const due = cachedInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_due || 0), 0);

        return {
            count: cachedInvoices.length,
            total,
            paid,
            due,
        };
    }, [cachedInvoices]);

    const handleRefreshInvoice = async (invoiceId: string) => {
        setRefreshingInvoiceId(invoiceId);
        try {
            const response = await fetch(`/api/invoices/${invoiceId}/sync`, { method: 'POST' });
            const payload = await response.json().catch(() => null) as { error?: string } | null;

            if (!response.ok) {
                throw new Error(payload?.error || 'Failed to refresh invoice from Xero');
            }

            toast.success('Invoice refreshed from Xero');
            await loadCachedInvoices();
        } catch (refreshError) {
            toast.error('Failed to refresh invoice', {
                description: refreshError instanceof Error ? refreshError.message : 'Unexpected Xero refresh error',
            });
        } finally {
            setRefreshingInvoiceId(null);
        }
    };

    if (missing.length > 0 && process.env.NODE_ENV !== 'production') {
        console.error('[XeroSettingsPage] Missing components:', missing);
        return (
            <div className="p-6">
                <h1 className="text-lg font-semibold">Xero Settings Error</h1>
                <p className="text-sm text-muted-foreground mt-2">
                    Missing components: {missing.join(', ')}
                </p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Xero Integration</h1>
                <p className="text-muted-foreground">
                    Connect your Xero account to sync invoices, bills, and financial data
                </p>
            </div>

            {/* Connection Card */}
            <XeroConnectionCard />

            {/* Features Tabs */}
            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview" className="gap-2">
                        <Link2 className="h-4 w-4" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="invoices" className="gap-2">
                        <FileText className="h-4 w-4" />
                        Invoices
                    </TabsTrigger>
                    <TabsTrigger value="bills" className="gap-2">
                        <Receipt className="h-4 w-4" />
                        Bills
                    </TabsTrigger>
                    <TabsTrigger value="contacts" className="gap-2">
                        <Users className="h-4 w-4" />
                        Contacts
                    </TabsTrigger>
                    <TabsTrigger value="reports" className="gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Reports
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Cached Invoices</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-semibold">{invoiceMetrics.count}</div>
                                <p className="text-xs text-muted-foreground">Invoices synced from Xero</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Total</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-semibold">{formatCurrency(invoiceMetrics.total)}</div>
                                <p className="text-xs text-muted-foreground">Cached invoice total</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Amount Paid</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-semibold text-green-700">{formatCurrency(invoiceMetrics.paid)}</div>
                                <p className="text-xs text-muted-foreground">From Xero summary fields</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Amount Due</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-semibold text-amber-700">{formatCurrency(invoiceMetrics.due)}</div>
                                <p className="text-xs text-muted-foreground">Outstanding from Xero</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {/* Invoice Sync Card */}
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">Invoice Sync</CardTitle>
                                    <Badge className="bg-green-600">Active</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>
                                    Push invoices to Xero when generated.
                                    Use the &quot;Sync to Xero&quot; button on any invoice.
                                </CardDescription>
                            </CardContent>
                        </Card>

                        {/* Bill Sync Card */}
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">Bill Sync</CardTitle>
                                    <Badge className="bg-green-600">Active</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>
                                    Create RTO bills in Xero automatically.
                                    Track payments and reconcile with bank feeds.
                                </CardDescription>
                            </CardContent>
                        </Card>

                        {/* Contact Sync Card */}
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">Contact Sync</CardTitle>
                                    <Badge className="bg-green-600">Active</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>
                                    Agents sync as Xero Customers, RTOs as Suppliers.
                                    Contacts are auto-created when syncing invoices/bills.
                                </CardDescription>
                            </CardContent>
                        </Card>

                        {/* Payment Recording Card */}
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">Payment Recording</CardTitle>
                                    <Badge className="bg-green-600">Active</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>
                                    Record payments in Xero when marked as paid.
                                    Automatic bank reconciliation matching.
                                </CardDescription>
                            </CardContent>
                        </Card>

                        {/* Reports Card */}
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">Financial Reports</CardTitle>
                                    <Badge className="bg-amber-600">Partial</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>
                                    View Profit &amp; Loss and Balance Sheet reports from Xero.
                                    Aged receivables/payables are temporarily disabled during granular-scope migration.
                                </CardDescription>
                            </CardContent>
                        </Card>

                        {/* Import Existing Card */}
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">Import Existing</CardTitle>
                                    <Badge className="bg-green-600">Active</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>
                                    View existing Xero invoices and bills.
                                    Link them to Lumiere records.
                                </CardDescription>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="invoices">
                    <Card>
                        <CardHeader>
                            <CardTitle>Invoice Synchronization</CardTitle>
                            <CardDescription>
                                Cached invoice data synced from Xero and available for PDF download or manual refresh
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-lg border p-4 space-y-3">
                                <h4 className="font-medium">How to sync an invoice:</h4>
                                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
                                    <li>Go to an application or the invoicing hub and create/sync the invoice</li>
                                    <li>Xero becomes the source of truth for Total, Amount Paid, and Amount Due</li>
                                    <li>Use Refresh Status below to force a cached sync</li>
                                    <li>Use Download PDF to fetch the latest Xero invoice PDF</li>
                                </ol>
                            </div>

                            <div className="flex justify-end">
                                <Button variant="outline" onClick={() => void loadCachedInvoices()} disabled={loadingInvoices}>
                                    {loadingInvoices ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                    Refresh Cached List
                                </Button>
                            </div>

                            <div className="rounded-md border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Invoice #</TableHead>
                                            <TableHead>Student</TableHead>
                                            <TableHead>Total</TableHead>
                                            <TableHead>Amount Paid</TableHead>
                                            <TableHead>Amount Due</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loadingInvoices ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                                                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                                                    Loading cached invoices...
                                                </TableCell>
                                            </TableRow>
                                        ) : cachedInvoices.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                                                    No cached Xero invoices yet
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            cachedInvoices.slice(0, 12).map((invoice) => (
                                                <TableRow key={invoice.id}>
                                                    <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{invoice.student_name}</div>
                                                        <div className="text-xs text-muted-foreground">{invoice.course_name || '-'}</div>
                                                    </TableCell>
                                                    <TableCell>{formatCurrency(invoice.total_amount)}</TableCell>
                                                    <TableCell>{formatCurrency(invoice.amount_paid)}</TableCell>
                                                    <TableCell>{formatCurrency(invoice.amount_due)}</TableCell>
                                                    <TableCell>
                                                        <Badge className={statusBadgeClass(invoice.xero_status)}>
                                                            {humanizeStatus(invoice.xero_status)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => void handleRefreshInvoice(invoice.id)}
                                                                disabled={refreshingInvoiceId === invoice.id}
                                                            >
                                                                {refreshingInvoiceId === invoice.id ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <RefreshCw className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                nativeButton={false}
                                                                render={<a href={`/api/invoices/${invoice.id}/pdf`}><Download className="h-4 w-4" /></a>}
                                                            />
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
                </TabsContent>

                <TabsContent value="bills">
                    <Card>
                        <CardHeader>
                            <CardTitle>Bill Synchronization</CardTitle>
                            <CardDescription>
                                Push bills to Xero to track payables
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-lg border p-4 space-y-3">
                                <h4 className="font-medium">How to sync a bill:</h4>
                                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
                                    <li>Go to <span className="font-medium text-foreground">Settings → Billing</span></li>
                                    <li>Find the bill you want to sync</li>
                                    <li>Click the <span className="font-medium text-foreground">&quot;Sync to Xero&quot;</span> button</li>
                                    <li>The bill will be created in Xero as a draft</li>
                                </ol>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                <p>• RTO contacts are auto-created in Xero as Suppliers</p>
                                <p>• RTO invoice numbers are preserved</p>
                                <p>• Due dates sync automatically</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="contacts">
                    <Card>
                        <CardHeader>
                            <CardTitle>Contact Synchronization</CardTitle>
                            <CardDescription>
                                Map Lumiere entities to Xero contacts
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-lg border p-4 space-y-3">
                                <h4 className="font-medium">Contact Mapping:</h4>
                                <div className="text-sm text-muted-foreground space-y-2">
                                    <p><span className="font-medium text-foreground">Partners/Agents</span> → Xero Customers</p>
                                    <p><span className="font-medium text-foreground">RTOs</span> → Xero Suppliers</p>
                                </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                <p>• Contacts are automatically created when you sync invoices or bills</p>
                                <p>• Email and phone are synced from Lumiere records</p>
                                <p>• Once linked, future syncs reuse the same Xero contact</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="reports">
                    <Card>
                        <CardHeader>
                            <CardTitle>Financial Reports</CardTitle>
                            <CardDescription>
                                Access Xero financial reports via API
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-lg border p-4 space-y-3">
                                <h4 className="font-medium">Available Reports:</h4>
                                <div className="text-sm text-muted-foreground space-y-2">
                                    <p>• <span className="font-medium text-foreground">Profit & Loss</span> - Income and expenses</p>
                                    <p>• <span className="font-medium text-foreground">Balance Sheet</span> - Assets and liabilities</p>
                                    <p>• <span className="font-medium text-foreground">Aged Receivables</span> - temporarily disabled while granular Xero report scopes are being confirmed</p>
                                    <p>• <span className="font-medium text-foreground">Aged Payables</span> - temporarily disabled while granular Xero report scopes are being confirmed</p>
                                </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                <p>Reports are available via API at <code className="bg-muted px-1 rounded">/api/xero/reports</code></p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileText, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activity-logger';
import { getWorkflowErrorFromPayload, getWorkflowErrorFromUnknown } from '@/lib/workflow/error-messages';

type PaymentHistoryItem = {
    id: string;
    xeroPaymentId: string;
    amount: number;
    currencyCode: string;
    date: string | null;
    reference: string | null;
    xeroAccountId: string | null;
};

type ApplicationInvoiceResponse = {
    invoice: {
        id: string;
        feeType: 'application_fee';
        invoiceNumber: string;
        xeroInvoiceId: string | null;
        total: number;
        amountPaid: number;
        amountDue: number | null;
        status: {
            external: string | null;
            internal: string;
            label: string;
            color: string;
        };
        dates: {
            issuedAt: string | null;
            dueAt: string | null;
            fullyPaidAt: string | null;
        };
        pdf: {
            url: string;
        };
        xero: {
            invoiceId: string | null;
            invoiceUrl: string | null;
            lastSyncedAt: string | null;
            updatedAtUtc: string | null;
        };
        paymentHistory: PaymentHistoryItem[];
    };
    warning?: string;
};

interface ApplicationFeeSectionProps {
    applicationId: string;
    amount: number;
    hasQualification: boolean;
    canUseActions: boolean;
    xeroActionUnavailableReason?: string;
    onInvoiceChanged?: () => Promise<unknown> | void;
}

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
});

function formatCurrency(amount: number | null | undefined) {
    return CURRENCY_FORMATTER.format(Number(amount || 0));
}

function formatDate(value: string | null | undefined) {
    if (!value) {
        return '-';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return '-';
    }

    return parsed.toLocaleDateString('en-AU');
}

function getInvoiceCreateUnavailableReason(props: Pick<ApplicationFeeSectionProps, 'amount' | 'hasQualification' | 'canUseActions' | 'xeroActionUnavailableReason'>) {
    if (!props.canUseActions) {
        return 'Actions not available';
    }

    if (!props.hasQualification) {
        return 'Application has no qualification assigned';
    }

    if (Number(props.amount || 0) <= 0) {
        return 'Main Application Fee is not configured on the assigned qualification price list';
    }

    return props.xeroActionUnavailableReason;
}

export function ApplicationFeeSection(props: ApplicationFeeSectionProps) {
    const [invoice, setInvoice] = useState<ApplicationInvoiceResponse['invoice'] | null>(null);
    const [loadingInvoice, setLoadingInvoice] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const createUnavailableReason = useMemo(
        () => getInvoiceCreateUnavailableReason(props),
        [props]
    );

    const loadInvoice = useCallback(async () => {
        setLoadingInvoice(true);
        try {
            const response = await fetch(`/api/applications/${props.applicationId}/invoice`, {
                cache: 'no-store',
            });

            if (response.status === 404) {
                setInvoice(null);
                return;
            }

            const payload = await response.json().catch(() => null) as ApplicationInvoiceResponse | { error?: string } | null;
            if (!response.ok) {
                throw new Error((payload as { error?: string } | null)?.error || 'Failed to load invoice status');
            }

            setInvoice((payload as ApplicationInvoiceResponse).invoice || null);
        } catch (error) {
            toast.error('Failed to load invoice status', {
                description: error instanceof Error ? error.message : 'Unable to load the cached invoice details right now.',
            });
            setInvoice(null);
        } finally {
            setLoadingInvoice(false);
        }
    }, [props.applicationId]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadInvoice();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [loadInvoice]);

    const handleCreateInvoice = async () => {
        if (createUnavailableReason) {
            toast.error('Cannot create invoice', {
                description: createUnavailableReason,
            });
            return;
        }

        setIsCreating(true);
        try {
            const response = await fetch(`/api/applications/${props.applicationId}/invoice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    feeType: 'application_fee',
                    amount: props.amount,
                }),
            });

            const payload = await response.json().catch(() => null) as ApplicationInvoiceResponse | { error?: string; warning?: string } | null;
            if (!response.ok) {
                throw new Error(getWorkflowErrorFromPayload(payload, 'Unable to create the invoice in Xero right now. Please try again.'));
            }

            const nextInvoice = (payload as ApplicationInvoiceResponse).invoice || null;
            setInvoice(nextInvoice);

            await logActivity({
                applicationId: props.applicationId,
                action: 'invoice_created_in_xero',
                fieldChanged: 'invoice',
                newValue: `Invoice created in Xero: ${nextInvoice?.invoiceNumber || 'N/A'}`,
                metadata: {
                    xero_invoice_id: nextInvoice?.xeroInvoiceId,
                    invoice_number: nextInvoice?.invoiceNumber,
                    xero_url: nextInvoice?.xero.invoiceUrl,
                    fee_type: 'application_fee',
                },
            });

            if (props.onInvoiceChanged) {
                await props.onInvoiceChanged();
            }

            toast.success('Invoice created in Xero successfully', {
                description: (payload as ApplicationInvoiceResponse).warning || `Invoice ${nextInvoice?.invoiceNumber || 'created'} is ready.`,
            });
        } catch (error) {
            toast.error('Failed to create invoice in Xero', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to create the invoice in Xero right now. Please try again.'
                ),
            });
        } finally {
            setIsCreating(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!invoice) {
            return;
        }

        setIsDownloading(true);
        try {
            const response = await fetch(`/api/invoices/${invoice.id}/pdf`);
            if (!response.ok) {
                let errorMessage = 'Unable to download the invoice PDF right now.';
                try {
                    const payload = await response.json();
                    errorMessage = getWorkflowErrorFromPayload(payload, errorMessage);
                } catch {
                    // no-op
                }

                throw new Error(errorMessage);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const header = response.headers.get('content-disposition') || '';
            const extracted = header.match(/filename="?([^";]+)"?/i)?.[1];
            const filename = extracted || `${invoice.invoiceNumber || 'invoice'}.pdf`;

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast.error('Invoice PDF download failed', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to download the invoice PDF right now. Please try again.'
                ),
            });
        } finally {
            setIsDownloading(false);
        }
    };

    const handleSyncStatus = async () => {
        if (!invoice) {
            return;
        }

        setIsSyncing(true);
        try {
            const response = await fetch(`/api/invoices/${invoice.id}/sync`, {
                method: 'POST',
            });
            const payload = await response.json().catch(() => null) as ApplicationInvoiceResponse | { error?: string } | null;
            if (!response.ok) {
                throw new Error(getWorkflowErrorFromPayload(payload, 'Unable to refresh invoice status right now.'));
            }

            setInvoice((payload as ApplicationInvoiceResponse).invoice || null);
            if (props.onInvoiceChanged) {
                await props.onInvoiceChanged();
            }

            toast.success('Invoice status refreshed from Xero');
        } catch (error) {
            toast.error('Failed to refresh invoice status', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to refresh the invoice status right now. Please try again.'
                ),
            });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-muted/20">
                <CardTitle className="text-base font-semibold">Main Application Fee</CardTitle>
                <Badge className={invoice ? invoice.status.color : 'bg-muted text-muted-foreground'}>
                    {invoice ? invoice.status.label : 'Not Created'}
                </Badge>
            </CardHeader>

            <CardContent className="pt-6 flex-grow space-y-4">
                <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Amount</p>
                    <p className="text-3xl font-bold text-foreground">{formatCurrency(props.amount)}</p>
                </div>

                {loadingInvoice ? (
                    <div className="flex items-center justify-center py-6 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Loading invoice details...
                    </div>
                ) : invoice ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-muted-foreground">Invoice Number</p>
                                <p className="font-medium">{invoice.invoiceNumber || '-'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">External Status</p>
                                <p className="font-medium">{invoice.status.external || '-'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Total</p>
                                <p className="font-medium">{formatCurrency(invoice.total)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Amount Paid</p>
                                <p className="font-medium">{formatCurrency(invoice.amountPaid)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Amount Due</p>
                                <p className="font-medium">{formatCurrency(invoice.amountDue)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Last Synced</p>
                                <p className="font-medium">{formatDate(invoice.xero.lastSyncedAt)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Issued Date</p>
                                <p className="font-medium">{formatDate(invoice.dates.issuedAt)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Due Date</p>
                                <p className="font-medium">{formatDate(invoice.dates.dueAt)}</p>
                            </div>
                        </div>

                        <div>
                            <p className="text-sm font-medium mb-2">Payment History</p>
                            {invoice.paymentHistory.length > 0 ? (
                                <div className="rounded-md border overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Reference</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {invoice.paymentHistory.map((payment) => (
                                                <TableRow key={payment.id}>
                                                    <TableCell>{formatDate(payment.date)}</TableCell>
                                                    <TableCell>{formatCurrency(payment.amount)}</TableCell>
                                                    <TableCell>{payment.reference || '-'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                            )}
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center">No Xero invoice created yet for the Main Application Fee.</p>
                )}
            </CardContent>

            <div className="p-4 pt-0 mt-auto border-t bg-muted/10">
                <div className="flex flex-wrap gap-2 pt-4">
                    {!props.canUseActions ? (
                        <p className="text-xs text-muted-foreground italic w-full text-center">Actions not available</p>
                    ) : (
                        <>
                            {!invoice ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 text-xs"
                                    onClick={handleCreateInvoice}
                                    disabled={isCreating || Boolean(createUnavailableReason)}
                                    title={createUnavailableReason}
                                >
                                    {isCreating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FileText className="h-3 w-3 mr-1" />}
                                    <span className="hidden sm:inline">Create Invoice</span>
                                    <span className="sm:hidden">Invoice</span>
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 text-xs"
                                        onClick={handleDownloadPdf}
                                        disabled={isDownloading}
                                    >
                                        {isDownloading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                                        <span className="hidden sm:inline">Download Invoice</span>
                                        <span className="sm:hidden">Invoice</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 text-xs"
                                        onClick={handleSyncStatus}
                                        disabled={isSyncing}
                                    >
                                        {isSyncing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                                        <span className="hidden sm:inline">Refresh Status</span>
                                        <span className="sm:hidden">Refresh</span>
                                    </Button>
                                </>
                            )}

                            {!invoice && createUnavailableReason ? (
                                <p className="w-full text-xs text-muted-foreground text-center">{createUnavailableReason}</p>
                            ) : null}

                        </>
                    )}
                </div>
            </div>
        </Card>
    );
}

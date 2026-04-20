'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Mail, Loader2, Printer, FileText } from 'lucide-react';
import {
    type GeneratedInvoice,
    formatCurrency,
    generateInvoiceHTML
} from '@/lib/services/invoice-generator';
import { INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS } from '@/types/database';
import { BRAND_NAME } from '@/lib/brand';

interface InvoicePreviewProps {
    invoice: GeneratedInvoice | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave?: () => Promise<void>;
    onSendEmail?: () => Promise<void>;
    isSaving?: boolean;
}

export function InvoicePreview({
    invoice,
    open,
    onOpenChange,
    onSave,
    onSendEmail,
    isSaving = false,
}: InvoicePreviewProps) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSending, setIsSending] = useState(false);

    if (!invoice) return null;

    const handleDownloadPDF = async () => {
        setIsDownloading(true);
        try {
            // Generate HTML and open in new window for printing
            const html = generateInvoiceHTML(invoice);
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(html);
                printWindow.document.close();
                // Wait for content to load then trigger print
                printWindow.onload = () => {
                    printWindow.print();
                };
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleSendEmail = async () => {
        if (!onSendEmail) return;
        setIsSending(true);
        try {
            await onSendEmail();
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Invoice Preview
                        </span>
                        <Badge className={INVOICE_STATUS_COLORS[invoice.status]}>
                            {INVOICE_STATUS_LABELS[invoice.status]}
                        </Badge>
                    </DialogTitle>
                </DialogHeader>

                {/* Invoice Preview Content */}
                <div className="bg-card border rounded-lg p-6 space-y-6">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">
                                Sharp <span className="text-sky-500">Future</span>
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Education Management System
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-semibold">{invoice.invoiceNumber}</div>
                            <div className="text-sm text-muted-foreground">
                                Date: {invoice.date}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Due: {invoice.dueDate}
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Billing Info */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <div className="text-xs uppercase text-muted-foreground mb-1">
                                Bill To
                            </div>
                            <div className="font-semibold">{invoice.studentName}</div>
                        </div>
                        <div>
                            <div className="text-xs uppercase text-muted-foreground mb-1">
                                Course Details
                            </div>
                            <div className="font-semibold">{invoice.courseName}</div>
                            <div className="text-sm text-muted-foreground">{invoice.rtoName}</div>
                        </div>
                    </div>

                    <Separator />

                    {/* Line Items */}
                    <div>
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-2 text-xs uppercase text-muted-foreground">
                                        Description
                                    </th>
                                    <th className="text-right py-2 text-xs uppercase text-muted-foreground">
                                        Amount
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.lineItems.map((item, index) => (
                                    <tr key={index} className="border-b">
                                        <td className="py-3">{item.description}</td>
                                        <td className="py-3 text-right">
                                            {formatCurrency(item.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Totals */}
                        <div className="mt-4 space-y-2">
                            <div className="flex justify-end">
                                <div className="w-48 flex justify-between">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>{formatCurrency(invoice.subtotal)}</span>
                                </div>
                            </div>
                            {invoice.discount > 0 && (
                                <div className="flex justify-end">
                                    <div className="w-48 flex justify-between">
                                        <span className="text-muted-foreground">Discount</span>
                                        <span className="text-green-600">
                                            -{formatCurrency(invoice.discount)}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end pt-2 border-t">
                                <div className="w-48 flex justify-between font-bold text-lg">
                                    <span>Total Due</span>
                                    <span className="text-indigo-600">
                                        {formatCurrency(invoice.total)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    {invoice.notes && (
                        <div className="bg-amber-50 rounded-lg p-3 text-sm">
                            <span className="font-semibold">Notes: </span>
                            {invoice.notes}
                        </div>
                    )}

                    {/* Payment Info */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="font-semibold mb-2">Payment Information</div>
                        <div className="text-sm space-y-1">
                            <div>Bank: Commonwealth Bank of Australia</div>
                            <div>Account Name: {BRAND_NAME}</div>
                            <div>BSB: 062-000 | Account: 1234 5678</div>
                            <div className="mt-2 italic text-muted-foreground">
                                Reference: {invoice.invoiceNumber}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex gap-2 sm:gap-0">
                    {onSave && invoice.status === 'draft' && (
                        <Button
                            onClick={onSave}
                            disabled={isSaving}
                            variant="outline"
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Save Invoice
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        onClick={handleDownloadPDF}
                        disabled={isDownloading}
                    >
                        {isDownloading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Printer className="h-4 w-4 mr-2" />
                        )}
                        Print / Save PDF
                    </Button>
                    {onSendEmail && (
                        <Button onClick={handleSendEmail} disabled={isSending}>
                            {isSending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Mail className="h-4 w-4 mr-2" />
                            )}
                            Send via Email
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

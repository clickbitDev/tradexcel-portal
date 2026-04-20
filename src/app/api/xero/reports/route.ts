/**
 * Xero Reports API Route
 * Fetches financial reports and reference lists from Xero
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { fetchReport, getContacts, requestXeroJson } from '@/lib/services/xero/xero-client';
import type { UserRole } from '@/types/database';

const REPORT_SCOPE_MESSAGE = 'Aged receivables and aged payables are temporarily disabled until their exact granular Xero report scopes are confirmed for this app.';

const XERO_REPORT_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'accounts_manager',
    'developer',
];

type XeroInvoiceSummary = {
    invoiceId: string;
    invoiceNumber: string;
    type: 'ACCREC' | 'ACCPAY';
    status: string;
    contactName: string;
    contactId: string;
    date: string;
    dueDate: string;
    total: number;
    amountDue: number;
    amountPaid: number;
};

async function fetchXeroInvoices(query: URLSearchParams) {
    const params = new URLSearchParams();
    const page = query.get('page');
    const type = query.get('type');

    if (page) params.set('page', page);

    let where = '';
    if (type === 'ACCREC' || type === 'ACCPAY') {
        where += `Type="${type}"`;
    }

    if (where) {
        params.set('where', where);
    }

    const result = await requestXeroJson<{
        Invoices?: Array<{
            InvoiceID: string;
            InvoiceNumber: string;
            Type: 'ACCREC' | 'ACCPAY';
            Status: string;
            Contact: { Name: string; ContactID: string };
            DateString: string;
            DueDateString: string;
            Total: number;
            AmountDue: number;
            AmountPaid: number;
        }>;
        pagination?: { itemCount: number };
    }>({
        path: `/Invoices${params.toString() ? `?${params.toString()}` : ''}`,
    });

    if (!result.success) {
        return result;
    }

    const invoices: XeroInvoiceSummary[] = (result.data.Invoices || []).map((invoice) => ({
        invoiceId: invoice.InvoiceID,
        invoiceNumber: invoice.InvoiceNumber,
        type: invoice.Type,
        status: invoice.Status,
        contactName: invoice.Contact?.Name || '',
        contactId: invoice.Contact?.ContactID || '',
        date: invoice.DateString,
        dueDate: invoice.DueDateString,
        total: invoice.Total,
        amountDue: invoice.AmountDue,
        amountPaid: invoice.AmountPaid,
    }));

    return {
        success: true as const,
        invoices,
        total: result.data.pagination?.itemCount,
    };
}

export async function GET(request: NextRequest) {
    try {
        const authz = await authorizeApiRequest({
            request,
            resource: 'financial',
            action: 'view_financials',
            allowedRoles: XERO_REPORT_ROLES,
            allowCompatibilityPermission: true,
        });
        if (!authz.ok) {
            return authz.response;
        }

        const searchParams = request.nextUrl.searchParams;
        const report = searchParams.get('report');
        const fromDate = searchParams.get('fromDate');
        const toDate = searchParams.get('toDate');
        const date = searchParams.get('date');

        let result:
            | { success: true; report?: unknown; invoices?: XeroInvoiceSummary[]; contacts?: Array<{ id: string; name: string; email?: string }>; total?: number }
            | { success: false; error: string };

        switch (report) {
            case 'profit_loss':
                if (!fromDate || !toDate) {
                    return NextResponse.json({ error: 'fromDate and toDate required' }, { status: 400 });
                }
                {
                    const reportResult = await fetchReport({ path: `/Reports/ProfitAndLoss?fromDate=${fromDate}&toDate=${toDate}` });
                    result = reportResult.success
                        ? { success: true, report: reportResult.data }
                        : { success: false, error: reportResult.error };
                }
                break;

            case 'balance_sheet': {
                const reportDate = date || new Date().toISOString().split('T')[0];
                const reportResult = await fetchReport({ path: `/Reports/BalanceSheet?date=${reportDate}` });
                result = reportResult.success
                    ? { success: true, report: reportResult.data }
                    : { success: false, error: reportResult.error };
                break;
            }

            case 'aged_receivables':
                return NextResponse.json({ success: false, error: REPORT_SCOPE_MESSAGE, report: 'aged_receivables' }, { status: 501 });

            case 'aged_payables':
                return NextResponse.json({ success: false, error: REPORT_SCOPE_MESSAGE, report: 'aged_payables' }, { status: 501 });

            case 'invoices':
                result = await fetchXeroInvoices(searchParams);
                break;

            case 'contacts': {
                const params = new URLSearchParams();
                const whereParts: string[] = [];

                if (searchParams.get('isCustomer') === 'true') {
                    whereParts.push('IsCustomer=true');
                }

                if (searchParams.get('isSupplier') === 'true') {
                    whereParts.push('IsSupplier=true');
                }

                if (whereParts.length > 0) {
                    params.set('where', whereParts.join(' AND '));
                }

                if (searchParams.get('page')) {
                    params.set('page', searchParams.get('page') || '1');
                }

                const contactsResult = await getContacts({
                    query: params.toString(),
                });

                if (!contactsResult.success) {
                    result = { success: false, error: contactsResult.error };
                    break;
                }

                result = {
                    success: true,
                    contacts: (contactsResult.data.Contacts || []).map((contact) => ({
                        id: String(contact.ContactID || ''),
                        name: String(contact.Name || ''),
                        email: typeof contact.EmailAddress === 'string' ? contact.EmailAddress : undefined,
                    })),
                };
                break;
            }

            default:
                return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
        }

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Xero reports error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Report fetch failed' },
            { status: 500 }
        );
    }
}

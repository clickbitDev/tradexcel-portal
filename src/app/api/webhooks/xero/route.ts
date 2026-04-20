import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { readEnvValue } from '@/lib/public-env';
import { createAdminServerClient } from '@/lib/supabase/server';
import { getSingletonPortalXeroConnection } from '@/lib/services/xero/token-manager';
import { syncInvoiceByXeroInvoiceId } from '@/lib/services/xero/invoice-sync-service';

type XeroWebhookEvent = {
    resourceId?: string;
    tenantId?: string;
    eventType?: string;
    eventCategory?: string;
};

type XeroWebhookPayload = {
    events?: XeroWebhookEvent[];
    firstEventSequence?: number;
    lastEventSequence?: number;
    entropy?: string;
};

const XERO_WEBHOOK_KEY = readEnvValue('XERO_WEBHOOK_KEY') || '';

function isPaymentEvent(eventType: string) {
    return eventType.startsWith('PAYMENT.');
}

function isInvoiceEvent(eventType: string) {
    return eventType.startsWith('INVOICE.');
}

function verifyXeroWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!XERO_WEBHOOK_KEY || !signatureHeader) {
        return false;
    }

    const expected = createHmac('sha256', XERO_WEBHOOK_KEY).update(rawBody).digest('base64');
    const actualBuffer = Buffer.from(signatureHeader.trim());
    const expectedBuffer = Buffer.from(expected);

    if (actualBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
}

async function findInvoiceIdForPayment(paymentId: string): Promise<string | null> {
    const adminSupabase = createAdminServerClient();
    const { data, error } = await adminSupabase
        .from('invoice_payments')
        .select('invoice:invoices(xero_invoice_id)')
        .eq('xero_payment_id', paymentId)
        .maybeSingle<{ invoice?: { xero_invoice_id?: string | null } | Array<{ xero_invoice_id?: string | null }> | null }>();

    if (error || !data?.invoice) {
        return null;
    }

    const invoice = Array.isArray(data.invoice) ? data.invoice[0] : data.invoice;
    return invoice?.xero_invoice_id || null;
}

async function processEvents(events: XeroWebhookEvent[]) {
    const connection = await getSingletonPortalXeroConnection();
    if (!connection) {
        return;
    }

    const relevantEvents = events.filter((event) => event.tenantId === connection.tenant_id);
    for (const event of relevantEvents) {
        const eventType = (event.eventType || '').trim().toUpperCase();
        const resourceId = event.resourceId || null;

        if (!eventType || !resourceId) {
            continue;
        }

        try {
            if (isInvoiceEvent(eventType)) {
                await syncInvoiceByXeroInvoiceId(resourceId);
                continue;
            }

            if (isPaymentEvent(eventType)) {
                const xeroInvoiceId = await findInvoiceIdForPayment(resourceId);
                if (xeroInvoiceId) {
                    await syncInvoiceByXeroInvoiceId(xeroInvoiceId);
                }
            }
        } catch (error) {
            console.error('Xero webhook sync failed', {
                eventType,
                resourceId,
                error,
            });
        }
    }
}

export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    const signature = request.headers.get('x-xero-signature');

    if (!verifyXeroWebhookSignature(rawBody, signature)) {
        return NextResponse.json({ error: 'Invalid Xero webhook signature' }, { status: 401 });
    }

    let payload: XeroWebhookPayload = {};
    try {
        payload = rawBody ? JSON.parse(rawBody) as XeroWebhookPayload : {};
    } catch {
        return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    const events = Array.isArray(payload.events) ? payload.events : [];

    queueMicrotask(() => {
        void processEvents(events);
    });

    return NextResponse.json({ received: true, events: events.length });
}

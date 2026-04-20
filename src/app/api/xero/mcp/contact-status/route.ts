/**
 * Xero MCP Contact Status
 * GET /api/xero/mcp/contact-status?applicationId=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { callXeroMcpTool } from '@/lib/mcp/xero-mcp-client';

function isMcpEnabled(): boolean {
    return (process.env.XERO_MCP_ENABLED || '').toLowerCase() === 'true';
}

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
    if (!value) return null;
    return Array.isArray(value) ? value[0] ?? null : value;
}

export async function GET(request: NextRequest) {
    try {
        if (!isMcpEnabled()) {
            return NextResponse.json({ error: 'Xero MCP is disabled' }, { status: 503 });
        }

        const { searchParams } = new URL(request.url);
        const applicationId = searchParams.get('applicationId');
        if (!applicationId) {
            return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });
        }

        const authz = await authorizeApiRequest({
            request,
            resource: 'financial',
            action: 'view_financials',
            allowedRoles: ['accounts_manager', 'developer'],
        });
        if (!authz.ok) {
            return authz.response;
        }

        const supabase = authz.context.supabase;

        const { data: application, error: appError } = await supabase
            .from('applications')
            .select(`
                id,
                partner:partners(id, company_name, email, phone, xero_contact_id),
                offering:rto_offerings(
                    id,
                    rto:rtos(id, name, email, phone, xero_contact_id)
                )
            `)
            .eq('id', applicationId)
            .single();

        if (appError || !application) {
            return NextResponse.json({ error: 'Application not found' }, { status: 404 });
        }

        const partner = normalizeOne(application.partner);
        const offering = normalizeOne(application.offering);
        const rto = normalizeOne(offering?.rto);

        const checks: Array<{ type: 'partner' | 'rto'; term: string }> = [];
        if (partner?.company_name) checks.push({ type: 'partner', term: partner.company_name });
        if (partner?.email) checks.push({ type: 'partner', term: partner.email });
        if (rto?.name) checks.push({ type: 'rto', term: rto.name });
        if (rto?.email) checks.push({ type: 'rto', term: rto.email });

        const results = [];
        for (const check of checks) {
            const result = await callXeroMcpTool('list-contacts', { searchTerm: check.term });
            results.push({ ...check, result });
        }

        return NextResponse.json({
            applicationId,
            partner: partner
                ? {
                    id: partner.id,
                    company_name: partner.company_name,
                    email: partner.email,
                    xero_contact_id: partner.xero_contact_id,
                }
                : null,
            rto: rto
                ? {
                    id: rto.id,
                    name: rto.name,
                    email: rto.email,
                    xero_contact_id: rto.xero_contact_id,
                }
                : null,
            checks: results,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Contact status check failed' },
            { status: 500 }
        );
    }
}

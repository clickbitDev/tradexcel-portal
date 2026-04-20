import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient } from '@/lib/supabase/server';

const EmailTemplatePatchSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    subject: z.string().trim().min(1).max(255).optional(),
    body: z.string().trim().min(1).max(10000).optional(),
    variables: z.array(z.string().trim().min(1)).optional(),
    is_active: z.boolean().optional(),
});

function getTemplateClient() {
    try {
        return createAdminServerClient();
    } catch {
        return null;
    }
}

async function authorizeTemplateRequest(request: NextRequest) {
    return authorizeApiRequest({
        request,
        resource: 'audit_log',
        action: 'view_audit_logs',
        compatibilityPermissionKey: 'templates.manage',
        audit: false,
    });
}

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
    const authz = await authorizeTemplateRequest(request);
    if (!authz.ok) {
        return authz.response;
    }

    const adminClient = getTemplateClient();
    if (!adminClient) {
        return NextResponse.json({ error: 'Template management is not configured on the server.' }, { status: 500 });
    }

    const { id } = await params;
    const parsed = EmailTemplatePatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
        return NextResponse.json({ error: 'Invalid template payload', details: parsed.success ? [] : parsed.error.issues }, { status: 400 });
    }

    const { data, error } = await adminClient
        .from('email_templates')
        .update(parsed.data)
        .eq('id', id)
        .select('*')
        .single();

    if (error) {
        const status = error.code === '23505' ? 409 : 500;
        return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
    const authz = await authorizeTemplateRequest(request);
    if (!authz.ok) {
        return authz.response;
    }

    const adminClient = getTemplateClient();
    if (!adminClient) {
        return NextResponse.json({ error: 'Template management is not configured on the server.' }, { status: 500 });
    }

    const { id } = await params;
    const { error } = await adminClient
        .from('email_templates')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

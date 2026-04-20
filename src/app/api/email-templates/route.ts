import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient } from '@/lib/supabase/server';

const EmailTemplatePayloadSchema = z.object({
    name: z.string().trim().min(1).max(100),
    subject: z.string().trim().min(1).max(255),
    body: z.string().trim().min(1).max(10000),
    variables: z.array(z.string().trim().min(1)).default([]),
    is_active: z.boolean().default(true),
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

export async function GET(request: NextRequest) {
    const authz = await authorizeTemplateRequest(request);
    if (!authz.ok) {
        return authz.response;
    }

    const adminClient = getTemplateClient();
    if (!adminClient) {
        return NextResponse.json({ error: 'Template management is not configured on the server.' }, { status: 500 });
    }

    const { data, error } = await adminClient
        .from('email_templates')
        .select('*')
        .order('name');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
}

export async function POST(request: NextRequest) {
    const authz = await authorizeTemplateRequest(request);
    if (!authz.ok) {
        return authz.response;
    }

    const adminClient = getTemplateClient();
    if (!adminClient) {
        return NextResponse.json({ error: 'Template management is not configured on the server.' }, { status: 500 });
    }

    const parsed = EmailTemplatePayloadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid template payload', details: parsed.error.issues }, { status: 400 });
    }

    const { data, error } = await adminClient
        .from('email_templates')
        .insert([{ ...parsed.data, created_by: authz.context.userId }])
        .select('*')
        .single();

    if (error) {
        const status = error.code === '23505' ? 409 : 500;
        return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    return NextResponse.json({ data }, { status: 201 });
}

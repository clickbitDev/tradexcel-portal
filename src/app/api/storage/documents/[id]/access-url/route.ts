import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import {
    DOCUMENT_ACCESS_SELECT,
    DOCUMENT_VIEW_ROLES,
    type DocumentAccessRow,
} from '@/lib/storage/document-access-server';
import { createDocumentProxyToken } from '@/lib/storage/document-proxy-token';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    let lookupClient;
    try {
        lookupClient = createAdminServerClient();
    } catch {
        const authz = await authorizeApiRequest({
            request,
            resource: 'application',
            action: 'view',
            allowedRoles: DOCUMENT_VIEW_ROLES,
        });

        if (!authz.ok) {
            return authz.response;
        }

        lookupClient = authz.context.supabase;
    }

    const { data: document, error: documentError } = await lookupClient
        .from('documents')
        .select(DOCUMENT_ACCESS_SELECT)
        .eq('id', id)
        .maybeSingle<DocumentAccessRow>();

    if (documentError || !document || !document.application_id) {
        return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }

    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'view',
        applicationId: document.application_id,
        allowedRoles: DOCUMENT_VIEW_ROLES,
    });

    if (!authz.ok) {
        return authz.response;
    }

    try {
        const proxyToken = createDocumentProxyToken(id);
        const url = new URL(`/api/storage/documents/${id}/content?token=${encodeURIComponent(proxyToken)}`, request.nextUrl.origin).toString();
        return NextResponse.json({ data: { url } });
    } catch (error) {
        console.error('Failed to generate document proxy URL:', error);
        return NextResponse.json({
            error: 'Unable to generate a document access path for this document.',
        }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { getDocumentBinary } from '@/lib/storage/applications-server';
import {
    DOCUMENT_ACCESS_SELECT,
    DOCUMENT_VIEW_ROLES,
    ensureDocumentLocalized,
    type DocumentAccessRow,
} from '@/lib/storage/document-access-server';
import { verifyDocumentProxyToken } from '@/lib/storage/document-proxy-token';

function sanitizeFileName(fileName: string): string {
    return fileName.replace(/[\r\n"]/g, '').trim() || 'document';
}

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

    const proxyToken = request.nextUrl.searchParams.get('token');
    const hasValidProxyToken = verifyDocumentProxyToken(proxyToken, id);

    if (!hasValidProxyToken) {
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
    }

    try {
        const resolvedDocument = await ensureDocumentLocalized({
            document,
            supabase: lookupClient,
        });

        const binary = await getDocumentBinary(resolvedDocument as never, lookupClient as never);

        return new NextResponse(new Uint8Array(binary.buffer), {
            status: 200,
            headers: {
                'Content-Type': binary.contentType || resolvedDocument.mime_type || 'application/octet-stream',
                'Content-Disposition': `inline; filename="${sanitizeFileName(resolvedDocument.file_name)}"`,
                'Cache-Control': 'private, no-store, max-age=0',
                ...(binary.contentLength ? { 'Content-Length': String(binary.contentLength) } : {}),
            },
        });
    } catch (error) {
        console.error('Failed to stream document content:', error);
        return NextResponse.json(
            { error: 'Unable to load this document right now.' },
            { status: 500 }
        );
    }
}

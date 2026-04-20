import { NextRequest, NextResponse } from 'next/server';
import { authorizeCertificateRequest, fetchCertificateDraftPayload } from '@/lib/certificates/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authz = await authorizeCertificateRequest({
        request,
        permissionKey: 'certificates.manage',
    });

    if (!authz.ok) {
        return authz.response;
    }

    const { id } = await params;

    try {
        const payload = await fetchCertificateDraftPayload(id, authz.context.adminSupabase);
        return NextResponse.json({ data: payload });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load certificate draft.';
        const status = message === 'Application not found.' ? 404 : 409;

        return NextResponse.json({ error: message }, { status });
    }
}

import { NextResponse } from 'next/server';
import {
    authorizeCertificateRequest,
    fetchCertificateGenerationJob,
} from '@/lib/certificates/server';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const authz = await authorizeCertificateRequest({
        permissionKey: 'certificates.view',
    });

    if (!authz.ok) {
        return authz.response;
    }

    const { id } = await params;

    try {
        const job = await fetchCertificateGenerationJob(id, authz.context.adminSupabase);

        if (!job) {
            return NextResponse.json({ error: 'Certificate generation job not found.' }, { status: 404 });
        }

        return NextResponse.json({ data: job });
    } catch (error) {
        console.error('Failed to load certificate generation job:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unable to load certificate generation job.' },
            { status: 500 }
        );
    }
}

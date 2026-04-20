import { NextRequest, NextResponse } from 'next/server';
import { authorizeCertificateRequest, cancelCertificateGenerationJobs, fetchCertificateGenerationJobsByStatus } from '@/lib/certificates/server';

export async function POST(request: NextRequest) {
    const authz = await authorizeCertificateRequest({
        request,
        permissionKey: 'certificates.manage',
    });

    if (!authz.ok) {
        return authz.response;
    }

    try {
        const queuedJobs = await fetchCertificateGenerationJobsByStatus(['queued'], authz.context.adminSupabase);
        const jobIds = queuedJobs.map((job) => job.id);

        await cancelCertificateGenerationJobs({
            jobIds,
            supabase: authz.context.adminSupabase,
            lastError: 'Cleared from certificate queue.',
        });

        return NextResponse.json({
            data: {
                clearedCount: jobIds.length,
            },
        });
    } catch (error) {
        console.error('Failed to clear queued certificate jobs:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unable to clear queued certificate jobs.' },
            { status: 500 }
        );
    }
}

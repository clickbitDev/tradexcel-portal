import { NextRequest, NextResponse } from 'next/server';
import {
    authorizeCertificateRequest,
    cancelCertificateGenerationJobs,
    createQueuedCertificateGenerationJob,
    fetchActiveCertificateGenerationJobForApplication,
    fetchCertificateGenerationJob,
    fetchCertificateGenerationJobRecord,
} from '@/lib/certificates/server';
import { dispatchCertificateGenerationJob } from '@/lib/certificates/queue';

const RESTARTABLE_STATUSES = new Set(['queued', 'failed', 'cancelled']);

export async function POST(
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
        const job = await fetchCertificateGenerationJobRecord(id, authz.context.adminSupabase);
        if (!job) {
            return NextResponse.json({ error: 'Certificate generation job not found.' }, { status: 404 });
        }

        if (!RESTARTABLE_STATUSES.has(job.status)) {
            return NextResponse.json(
                { error: 'Only queued, failed, or cancelled jobs can be restarted.' },
                { status: 409 }
            );
        }

        if (!job.request_payload || !job.certificate_number || !job.verification_url) {
            return NextResponse.json(
                { error: 'This certificate job cannot be restarted because the saved payload is incomplete.' },
                { status: 409 }
            );
        }

        const activeJob = await fetchActiveCertificateGenerationJobForApplication(job.application_id, authz.context.adminSupabase);
        if (activeJob && activeJob.id !== job.id) {
            return NextResponse.json(
                { error: 'Another certificate generation job is already active for this application.' },
                { status: 409 }
            );
        }

        if (job.status === 'queued') {
            await cancelCertificateGenerationJobs({
                jobIds: [job.id],
                supabase: authz.context.adminSupabase,
                lastError: 'Restarted from certificate queue.',
            });
        }

        const newJobId = await createQueuedCertificateGenerationJob({
            applicationId: job.application_id,
            requestedBy: authz.context.userId,
            certificateNumber: job.certificate_number,
            verificationUrl: job.verification_url,
            requestPayload: job.request_payload,
            supabase: authz.context.adminSupabase,
        });

        try {
            await dispatchCertificateGenerationJob({
                jobId: newJobId,
                applicationId: job.application_id,
                requestedBy: authz.context.userId,
                certificateNumber: job.certificate_number,
                verificationUrl: job.verification_url,
                requestPayload: job.request_payload,
            });
        } catch (queueError) {
            await cancelCertificateGenerationJobs({
                jobIds: [newJobId],
                supabase: authz.context.adminSupabase,
                lastError: queueError instanceof Error ? queueError.message : 'Unable to enqueue restarted certificate job.',
            });
            throw queueError;
        }

        const restartedJob = await fetchCertificateGenerationJob(newJobId, authz.context.adminSupabase);
        if (!restartedJob) {
            throw new Error('The restarted certificate generation job could not be loaded.');
        }

        return NextResponse.json({
            data: {
                job: restartedJob,
                restartedFromJobId: job.id,
            },
        });
    } catch (error) {
        console.error('Failed to restart certificate generation job:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unable to restart certificate generation job.' },
            { status: 500 }
        );
    }
}

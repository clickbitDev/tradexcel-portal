import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createPublicUrl } from '@/lib/url/public-origin';
import { generatePortalCertificateNumber } from '@/lib/certificates/certificate-number';
import {
    authorizeCertificateRequest,
    buildCertificateGenerationPayload,
    fetchCertificateDraftPayload,
    fetchCertificateGenerationJob,
    fetchCertificateQueue,
    fetchActiveCertificateGenerationJobForApplication,
    type CertificateQueryClient,
} from '@/lib/certificates/server';
import { dispatchCertificateGenerationJob } from '@/lib/certificates/queue';
import type { CertificateGenerationRequestPayload } from '@/lib/certificates/shared';
import type { TranscriptUnitResult } from '@/types/database';

const TranscriptUnitResultSchema = z.enum(['Competent', 'Not Yet Competent', 'Credit Transfer']);

const CertificateTranscriptRowSchema = z.object({
    qualificationUnitId: z.string().uuid().nullable().optional(),
    unitCode: z.string().trim().min(1).max(50),
    unitTitle: z.string().trim().min(1).max(255),
    result: TranscriptUnitResultSchema,
    year: z.string().regex(/^\d{4}$/),
    included: z.boolean().default(true),
    sortOrder: z.number().int().nonnegative().default(0),
});

const GenerateCertificateRequestSchema = z.object({
    applicationId: z.string().uuid(),
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    standard: z.string().trim().min(1).max(255),
    scope: z.string().trim().min(1).max(500),
    auditRef: z.string().trim().min(1).max(255),
    includeTranscript: z.boolean().default(false),
    transcriptRows: z.array(CertificateTranscriptRowSchema).max(500).default([]),
});

type TranscriptGenerationRow = {
    qualificationUnitId: string | null;
    unitCode: string;
    unitTitle: string;
    result: TranscriptUnitResult;
    year: string;
    included: boolean;
    sortOrder: number;
};

function isActiveJobConflict(error: { message?: string; code?: string } | null): boolean {
    const message = error?.message || '';
    return message.includes('idx_certificate_generation_jobs_active_application');
}

async function respondWithJob(
    jobId: string,
    supabase: CertificateQueryClient,
    alreadyQueued: boolean
) {
    const job = await fetchCertificateGenerationJob(jobId, supabase);

    if (!job) {
        throw new Error('The certificate generation job could not be loaded after queueing.');
    }

    return NextResponse.json(
        {
            data: {
                job,
                alreadyQueued,
            },
        },
        { status: 202 }
    );
}

export async function GET(request: NextRequest) {
    const authz = await authorizeCertificateRequest({
        request,
        permissionKey: 'certificates.view',
    });

    if (!authz.ok) {
        return authz.response;
    }

    try {
        const items = await fetchCertificateQueue(authz.context.adminSupabase);
        return NextResponse.json({ data: items });
    } catch (error) {
        console.error('Failed to load certificate queue:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unable to load certificate queue.' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    const authz = await authorizeCertificateRequest({
        request,
        permissionKey: 'certificates.manage',
    });

    if (!authz.ok) {
        return authz.response;
    }

    const body = await request.json().catch(() => null);
    const parsed = GenerateCertificateRequestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid certificate generation request.', details: parsed.error.issues }, { status: 400 });
    }

    try {
        const draft = await fetchCertificateDraftPayload(parsed.data.applicationId, authz.context.adminSupabase);
        const includedTranscriptRows: TranscriptGenerationRow[] = parsed.data.includeTranscript
            ? parsed.data.transcriptRows
                .filter((row) => row.included)
                .map((row) => ({
                    qualificationUnitId: row.qualificationUnitId ?? null,
                    unitCode: row.unitCode,
                    unitTitle: row.unitTitle,
                    result: row.result,
                    year: row.year,
                    included: row.included,
                    sortOrder: row.sortOrder,
                }))
            : [];

        if (parsed.data.includeTranscript && includedTranscriptRows.length === 0) {
            return NextResponse.json(
                { error: 'Select at least one transcript row before generating a transcript certificate.' },
                { status: 422 }
            );
        }

        const activeJob = await fetchActiveCertificateGenerationJobForApplication(
            draft.application.id,
            authz.context.adminSupabase
        );

        if (activeJob) {
            return NextResponse.json(
                {
                    data: {
                        job: activeJob,
                        alreadyQueued: true,
                    },
                },
                { status: 202 }
            );
        }

        const certificateNumber = await generatePortalCertificateNumber();
        const verificationUrl = createPublicUrl(request, `/verify/certificates/${encodeURIComponent(certificateNumber)}`).toString();
        const requestPayload: CertificateGenerationRequestPayload = buildCertificateGenerationPayload({
            draft,
            issueDate: parsed.data.issueDate,
            scope: parsed.data.scope,
            standard: parsed.data.standard,
            auditRef: parsed.data.auditRef,
            includeTranscript: parsed.data.includeTranscript,
            transcriptRows: includedTranscriptRows,
        });

        const { data: queuedJob, error: queuedJobError } = await authz.context.adminSupabase
            .from('certificate_generation_jobs')
            .insert({
                application_id: draft.application.id,
                requested_by: authz.context.userId,
                status: 'queued',
                certificate_number: certificateNumber,
                verification_url: verificationUrl,
                request_payload: requestPayload,
                updated_at: new Date().toISOString(),
            })
            .select('id')
            .single<{ id: string }>();

        if (queuedJobError || !queuedJob) {
            if (isActiveJobConflict(queuedJobError)) {
                const conflictingJob = await fetchActiveCertificateGenerationJobForApplication(
                    draft.application.id,
                    authz.context.adminSupabase
                );

                if (conflictingJob) {
                    return NextResponse.json(
                        {
                            data: {
                                job: conflictingJob,
                                alreadyQueued: true,
                            },
                        },
                        { status: 202 }
                    );
                }
            }

            throw new Error(queuedJobError?.message || 'Unable to create the certificate generation job.');
        }

        try {
            await dispatchCertificateGenerationJob({
                jobId: queuedJob.id,
                applicationId: draft.application.id,
                requestedBy: authz.context.userId,
                certificateNumber,
                verificationUrl,
                requestPayload,
            });
        } catch (queueError) {
            await authz.context.adminSupabase
                .from('certificate_generation_jobs')
                .delete()
                .eq('id', queuedJob.id);

            throw queueError instanceof Error
                ? queueError
                : new Error('Unable to enqueue the certificate generation job.');
        }

        return respondWithJob(queuedJob.id, authz.context.adminSupabase, false);
    } catch (error) {
        console.error('Failed to queue certificate generation:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unable to queue certificate generation.' },
            { status: 500 }
        );
    }
}

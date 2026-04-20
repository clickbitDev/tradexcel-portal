import { createAdminServerClient } from '@/lib/supabase/server';
import { putBackblazeObject, deleteBackblazeObject } from '@/lib/storage/backblaze-server';
import { generateCertificate } from '@/lib/pdf/certificate-generator';
import { type CertificateGenerationQueuePayload } from './queue';
import type { CertificateGenerationRequestPayload } from './shared';

const CERTIFICATE_GENERATION_QUEUE_NAME = 'certificate-generation';

const supabase = createAdminServerClient();

function sanitizeStorageSegment(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
    .slice(0, 120) || 'file';
}

function buildCertificateFileName(input: { studentName: string; certificateNumber: string }): string {
  const studentSegment = sanitizeStorageSegment(input.studentName.replace(/\s+/g, '_'));
  const certificateSegment = sanitizeStorageSegment(input.certificateNumber);
  return `${studentSegment}_${certificateSegment}_Certificate.pdf`;
}

function buildDocumentStorageKey(input: {
  applicationId: string;
  documentType: string;
  fileName: string;
  timestamp?: number;
}): string {
  const timestamp = input.timestamp || Date.now();
  const sanitizedDocumentType = sanitizeStorageSegment(input.documentType.replace(/\//g, '_'));
  const sanitizedFileName = sanitizeStorageSegment(input.fileName);
  return `documents/${input.applicationId}/${timestamp}-${sanitizedDocumentType}-${sanitizedFileName}`;
}

async function fetchJobRecord(jobId: string) {
  const { data, error } = await supabase
    .from('certificate_generation_jobs')
    .select('id, application_id, certificate_record_id, document_id, requested_by, status, certificate_number, verification_url, request_payload, attempt_count, last_error, queued_at, started_at, completed_at, failed_at, created_at, updated_at')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load job ${jobId}: ${error.message}`);
  }

  return data;
}

async function findCertificateRecord(applicationId: string, certificateNumber: string) {
  const { data, error } = await supabase
    .from('certificate_records')
    .select('id, document_id, version, certificate_number')
    .eq('application_id', applicationId)
    .eq('certificate_number', certificateNumber)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load certificate record: ${error.message}`);
  }

  return data;
}

async function updateJob(jobId: string, patch: Record<string, unknown>) {
  const { error } = await supabase
    .from('certificate_generation_jobs')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Unable to update job ${jobId}: ${error.message}`);
  }
}

async function storeCertificateDocument(input: {
  applicationId: string;
  userId: string;
  studentName: string;
  certificateNumber: string;
  pdfBuffer: Buffer;
  suffix?: string;
}): Promise<{ document: { id: string; file_name: string; storage_key: string }; storageKey: string }> {
  const fileName = buildCertificateFileName({
    studentName: input.studentName,
    certificateNumber: input.certificateNumber,
  });
  
  const suffix = input.suffix || '';
  const storageKey = buildDocumentStorageKey({
    applicationId: input.applicationId,
    documentType: `Certificate${suffix}`,
    fileName: suffix ? fileName.replace('.pdf', `${suffix}.pdf`) : fileName,
  });

  await putBackblazeObject({
    key: storageKey,
    body: input.pdfBuffer,
    contentType: 'application/pdf',
    contentDisposition: `inline; filename="${fileName.replace(/"/g, '')}"`,
  });

  const { data: document, error } = await supabase
    .from('documents')
    .insert({
      application_id: input.applicationId,
      document_type: 'Certificate',
      file_name: fileName,
      file_url: storageKey,
      file_size: input.pdfBuffer.length,
      mime_type: 'application/pdf',
      is_verified: false,
      uploaded_by: input.userId,
      storage_provider: 'b2',
      storage_bucket: process.env.BACKBLAZE_APPLICATION_BUCKETNAME,
      storage_key: storageKey,
    })
    .select('id, file_name, storage_key')
    .single();

  if (error || !document) {
    await deleteBackblazeObject(storageKey).catch(() => null);
    throw new Error(error?.message || 'Unable to save the generated certificate document.');
  }

  return { document, storageKey };
}

async function cleanupAttemptArtifacts(input: {
  certificateRecordId: string | null;
  documentId: string | null;
  unlockedDocumentId: string | null;
  storageKey: string | null;
  unlockedStorageKey: string | null;
}) {
  if (input.certificateRecordId) {
    await supabase.from('certificate_records').delete().eq('id', input.certificateRecordId);
  }

  if (input.documentId) {
    await supabase.from('documents').delete().eq('id', input.documentId);
  }

  if (input.unlockedDocumentId) {
    await supabase.from('documents').delete().eq('id', input.unlockedDocumentId);
  }

  if (input.storageKey) {
    await deleteBackblazeObject(input.storageKey).catch(() => null);
  }

  if (input.unlockedStorageKey) {
    await deleteBackblazeObject(input.unlockedStorageKey).catch(() => null);
  }
}

export async function processJobPayload(jobData: CertificateGenerationQueuePayload) {
  const persistedJob = await fetchJobRecord(jobData.jobId);
  if (!persistedJob) {
    throw new Error(`Certificate generation job ${jobData.jobId} was not found.`);
  }

  if (persistedJob.status === 'completed' && persistedJob.certificate_record_id) {
    console.log('Skipping already completed certificate job', { jobId: jobData.jobId });
    return;
  }

  const existingCertificate = await findCertificateRecord(jobData.applicationId, jobData.certificateNumber);
  if (existingCertificate) {
    await updateJob(jobData.jobId, {
      status: 'completed',
      certificate_record_id: existingCertificate.id,
      document_id: existingCertificate.document_id,
      completed_at: new Date().toISOString(),
      failed_at: null,
      last_error: null,
    });
    console.log('Recovered completed certificate job from persisted certificate record', {
      jobId: jobData.jobId,
      certificateRecordId: existingCertificate.id,
    });
    return;
  }

  const requestPayload = (persistedJob.request_payload || jobData.requestPayload) as CertificateGenerationRequestPayload;
  const nowIso = new Date().toISOString();

  await updateJob(jobData.jobId, {
    status: 'processing',
    started_at: persistedJob.started_at || nowIso,
    failed_at: null,
    last_error: null,
    attempt_count: Number(persistedJob.attempt_count || 0) + 1,
  });

  let storageKey: string | null = null;
  let unlockedStorageKey: string | null = null;
  let documentId: string | null = null;
  let unlockedDocumentId: string | null = null;
  let certificateRecordId: string | null = null;

  try {
    const latestCertificate = await supabase
      .from('certificate_records')
      .select('id, version, certificate_number')
      .eq('application_id', jobData.applicationId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestCertificate.error) {
      throw new Error(`Unable to determine the next certificate version: ${latestCertificate.error.message}`);
    }

    const version = Number(latestCertificate.data?.version || 0) + 1;

    // Generate user version (restricted)
    const userCertificateResult = await generateCertificate({
      certificateNumber: jobData.certificateNumber,
      clientName: requestPayload.application.studentName,
      certificateTitle: requestPayload.certificateTitle,
      qualificationCode: requestPayload.application.qualificationCode || undefined,
      issueDate: requestPayload.issueDate,
      keyDetails: requestPayload.keyDetails,
      verificationUrl: jobData.verificationUrl || undefined,
      units: requestPayload.includeTranscript && requestPayload.transcriptRows.length > 0
        ? requestPayload.transcriptRows.map((row) => ({
            unitCode: row.unitCode,
            unitTitle: row.unitTitle,
            result: row.result,
            year: row.year,
          }))
        : undefined,
    });

    if (userCertificateResult.certificateNumber !== jobData.certificateNumber) {
      throw new Error('Certificate service returned an unexpected certificate number.');
    }

    const pdfBuffer = Buffer.from(userCertificateResult.pdf, 'base64');
    const { document, storageKey: createdStorageKey } = await storeCertificateDocument({
      applicationId: jobData.applicationId,
      userId: jobData.requestedBy,
      studentName: requestPayload.application.studentName,
      certificateNumber: jobData.certificateNumber,
      pdfBuffer,
    });

    storageKey = createdStorageKey;
    documentId = document.id;

    // Generate unlocked version (admin)
    const ownerPassword = process.env.OWNER_PASSWORD;
    if (ownerPassword) {
      const unlockedCertificateResult = await generateCertificate({
        certificateNumber: jobData.certificateNumber,
        clientName: requestPayload.application.studentName,
        certificateTitle: requestPayload.certificateTitle,
        qualificationCode: requestPayload.application.qualificationCode || undefined,
        issueDate: requestPayload.issueDate,
        keyDetails: requestPayload.keyDetails,
        verificationUrl: jobData.verificationUrl || undefined,
        units: requestPayload.includeTranscript && requestPayload.transcriptRows.length > 0
          ? requestPayload.transcriptRows.map((row) => ({
              unitCode: row.unitCode,
              unitTitle: row.unitTitle,
              result: row.result,
              year: row.year,
            }))
          : undefined,
        ownerPassword,
      });

      const unlockedPdfBuffer = Buffer.from(unlockedCertificateResult.pdf, 'base64');
      const { document: unlockedDocument, storageKey: createdUnlockedStorageKey } = await storeCertificateDocument({
        applicationId: jobData.applicationId,
        userId: jobData.requestedBy,
        studentName: requestPayload.application.studentName,
        certificateNumber: jobData.certificateNumber,
        pdfBuffer: unlockedPdfBuffer,
        suffix: '-Unlocked',
      });

      unlockedStorageKey = createdUnlockedStorageKey;
      unlockedDocumentId = unlockedDocument.id;
    }

    const { data: certificateRecord, error: certificateRecordError } = await supabase
      .from('certificate_records')
      .insert({
        application_id: jobData.applicationId,
        qualification_id: requestPayload.application.qualificationId,
        document_id: document.id,
        unlocked_document_id: unlockedDocumentId || null,
        certificate_number: jobData.certificateNumber,
        certificate_title: requestPayload.certificateTitle,
        issue_date: requestPayload.issueDate,
        status: 'active',
        version,
        includes_transcript: requestPayload.includeTranscript,
        verification_url: jobData.verificationUrl,
        request_payload: {
          ...requestPayload,
          certificateNumber: jobData.certificateNumber,
          verificationUrl: jobData.verificationUrl,
        },
        generated_by: jobData.requestedBy,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id, generated_at')
      .single();

    if (certificateRecordError || !certificateRecord) {
      throw new Error(certificateRecordError?.message || 'Unable to save the certificate record.');
    }

    certificateRecordId = certificateRecord.id;

    if (requestPayload.includeTranscript && requestPayload.transcriptRows.length > 0) {
      const { error: transcriptInsertError } = await supabase
        .from('certificate_unit_results')
        .insert(requestPayload.transcriptRows.map((row, index) => ({
          certificate_id: certificateRecord.id,
          qualification_unit_id: row.qualificationUnitId,
          unit_code: row.unitCode,
          unit_title: row.unitTitle,
          result: row.result,
          year: row.year,
          sort_order: row.sortOrder ?? index,
        })));

      if (transcriptInsertError) {
        throw new Error(`Unable to save transcript unit results: ${transcriptInsertError.message}`);
      }
    }

    const preparedAt = new Date().toISOString();
    const { error: applicationUpdateError } = await supabase
      .from('applications')
      .update({
        issue_date: requestPayload.issueDate,
        docs_prepared_by: jobData.requestedBy,
        docs_prepared_at: preparedAt,
        last_updated_by: jobData.requestedBy,
      })
      .eq('id', jobData.applicationId);

    if (applicationUpdateError) {
      throw new Error(`Certificate generated, but application metadata could not be updated: ${applicationUpdateError.message}`);
    }

    const { error: replaceError } = await supabase
      .from('certificate_records')
      .update({
        status: 'replaced',
        updated_at: new Date().toISOString(),
      })
      .eq('application_id', jobData.applicationId)
      .eq('status', 'active')
      .neq('id', certificateRecord.id);

    if (replaceError) {
      throw new Error(`Unable to retire previous certificates: ${replaceError.message}`);
    }

    await updateJob(jobData.jobId, {
      status: 'completed',
      certificate_record_id: certificateRecord.id,
      document_id: document.id,
      completed_at: new Date().toISOString(),
      failed_at: null,
      last_error: null,
    });

    console.log('Certificate generation job completed', {
      jobId: jobData.jobId,
      certificateNumber: jobData.certificateNumber,
      certificateRecordId,
      documentId,
      unlockedDocumentId,
    });
  } catch (error) {
    await cleanupAttemptArtifacts({
      certificateRecordId,
      documentId,
      unlockedDocumentId,
      storageKey,
      unlockedStorageKey,
    }).catch((cleanupError) => {
      console.warn('Certificate job cleanup failed', {
        jobId: jobData.jobId,
        error: String(cleanupError),
      });
    });

    const message = error instanceof Error ? error.message : 'Certificate generation failed.';
    const MAX_ATTEMPTS = 3;
    const jobRecord = await fetchJobRecord(jobData.jobId);
    const nextAttempt = (jobRecord?.attempt_count ?? 0) + 1;
    const isFinal = nextAttempt >= MAX_ATTEMPTS;

    await updateJob(jobData.jobId, {
      status: isFinal ? 'failed' : 'queued',
      attempt_count: nextAttempt,
      last_error: message,
      failed_at: isFinal ? new Date().toISOString() : null,
    });

    if (!isFinal) {
      const delay = 5000 * Math.pow(2, nextAttempt - 1); // 5s, 10s, 20s
      setTimeout(() => {
        dispatchCertificateGenerationJob(jobData).catch(() => null);
      }, delay);
    }

    console.error('Certificate generation job failed', {
      jobId: jobData.jobId,
      isFinal,
      error: message,
    });
  }
}

export async function recoverStuckJobs() {
  const { data: stuckJobs } = await supabase
    .from('certificate_generation_jobs')
    .select('id, application_id, requested_by, certificate_number, verification_url, request_payload')
    .in('status', ['queued', 'processing'])
    .limit(20);

  for (const job of stuckJobs ?? []) {
    setImmediate(() => {
      processJobPayload({
        jobId: job.id,
        applicationId: job.application_id,
        requestedBy: job.requested_by,
        certificateNumber: job.certificate_number,
        verificationUrl: job.verification_url,
        requestPayload: job.request_payload,
      }).catch(() => null);
    });
  }
}

async function dispatchCertificateGenerationJob(payload: CertificateGenerationQueuePayload): Promise<void> {
  setImmediate(() => {
    processJobPayload(payload).catch((err: unknown) => {
      console.error('Background certificate job failed', { jobId: payload.jobId, error: err });
    });
  });
}

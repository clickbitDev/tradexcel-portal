import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserContext } from '@/lib/access-control/server';
import { hasActionPermission } from '@/lib/access-control/runtime-permissions';
import { createAdminServerClient, createServerClient } from '@/lib/supabase/server';
import type {
    CertificateGenerationJobStatus,
    CertificateRecordStatus,
    TranscriptUnitResult,
    UserRole,
    WorkflowStage,
} from '@/types/database';
import {
    DEFAULT_CERTIFICATE_STANDARD,
    type CertificateGenerationJobSummary,
    type CertificateDraftPayload,
    type CertificateQueueItem,
    type CertificateGenerationRequestPayload,
    type CertificateSummary,
    type CertificateTranscriptRow,
    type CertificateVerificationPayload,
} from './shared';

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerClient>>;
type AdminSupabaseClient = ReturnType<typeof createAdminServerClient>;
type QuerySupabaseClient = ServerSupabaseClient | AdminSupabaseClient;

export type CertificateQueryClient = QuerySupabaseClient;

type QualificationLookup = {
    id: string;
    code: string;
    name: string;
};

type DocumentLookup = {
    id: string;
    file_name: string;
};

type CertificateRecordRow = {
    id: string;
    application_id: string;
    certificate_number: string;
    certificate_title: string;
    issue_date: string;
    status: CertificateRecordStatus;
    version: number;
    includes_transcript: boolean;
    verification_url: string | null;
    generated_at: string;
    request_payload: Record<string, unknown> | null;
    document_id: string | null;
    document?: DocumentLookup | DocumentLookup[] | null;
};

type ApplicationDraftRow = {
    id: string;
    application_number: string;
    student_uid: string;
    student_first_name: string;
    student_last_name: string;
    student_email: string | null;
    workflow_stage: WorkflowStage;
    issue_date: string | null;
    docs_prepared_at: string | null;
    sent_at: string | null;
    offering_id: string | null;
    qualification_id: string | null;
    qualification?: QualificationLookup | null;
};

type OfferingQualificationRow = {
    id: string;
    qualification_id: string | null;
};

type QualificationUnitRow = {
    id: string;
    unit_code: string;
    unit_title: string;
};

type CertificateUnitResultRow = {
    qualification_unit_id: string | null;
    unit_code: string;
    unit_title: string;
    result: TranscriptUnitResult;
    year: string;
    sort_order: number;
};

type CertificateGenerationJobRow = {
    id: string;
    application_id: string;
    certificate_record_id: string | null;
    document_id: string | null;
    status: CertificateGenerationJobStatus;
    certificate_number: string | null;
    verification_url: string | null;
    attempt_count: number;
    last_error: string | null;
    queued_at: string;
    started_at: string | null;
    completed_at: string | null;
    failed_at: string | null;
    created_at: string;
    updated_at: string;
};

type CertificateGenerationJobRecordRow = CertificateGenerationJobRow & {
    requested_by: string | null;
    request_payload: CertificateGenerationRequestPayload | null;
};

const CERTIFICATE_ALLOWED_ROLES: UserRole[] = [
    'ceo',
    'developer',
    'executive_manager',
    'admin',
    'dispatch_coordinator',
];

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
    if (!value) {
        return null;
    }

    return Array.isArray(value) ? value[0] ?? null : value;
}

function todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
}

function getApplicationStudentName(application: ApplicationDraftRow): string {
    return `${application.student_first_name || ''} ${application.student_last_name || ''}`.trim() || 'Student';
}

function getApplicationQualification(application: ApplicationDraftRow): QualificationLookup | null {
    return normalizeOne(application.qualification);
}

async function fetchQualificationsById(
    qualificationIds: string[],
    supabase: QuerySupabaseClient
): Promise<Map<string, QualificationLookup>> {
    if (qualificationIds.length === 0) {
        return new Map();
    }

    const { data, error } = await supabase
        .from('qualifications')
        .select('id, code, name')
        .in('id', qualificationIds)
        .returns<QualificationLookup[]>();

    if (error) {
        throw new Error(`Unable to load qualifications: ${error.message}`);
    }

    return new Map((data || []).map((qualification) => [qualification.id, qualification]));
}

async function hydrateApplicationQualifications(
    applications: ApplicationDraftRow[],
    supabase: QuerySupabaseClient
): Promise<ApplicationDraftRow[]> {
    const offeringIds = Array.from(new Set(
        applications
            .map((application) => application.offering_id)
            .filter((offeringId): offeringId is string => Boolean(offeringId))
    ));

    const offeringMap = new Map<string, OfferingQualificationRow>();
    if (offeringIds.length > 0) {
        const { data, error } = await supabase
            .from('rto_offerings')
            .select('id, qualification_id')
            .in('id', offeringIds)
            .returns<OfferingQualificationRow[]>();

        if (error) {
            throw new Error(`Unable to load RTO offerings: ${error.message}`);
        }

        for (const offering of data || []) {
            offeringMap.set(offering.id, offering);
        }
    }

    const qualificationIds = Array.from(new Set(
        applications
            .map((application) => offeringMap.get(application.offering_id || '')?.qualification_id || application.qualification_id)
            .filter((qualificationId): qualificationId is string => Boolean(qualificationId))
    ));

    const qualificationMap = await fetchQualificationsById(qualificationIds, supabase);

    return applications.map((application) => {
        const offeringQualificationId = application.offering_id
            ? offeringMap.get(application.offering_id)?.qualification_id || null
            : null;
        const qualificationId = offeringQualificationId || application.qualification_id;

        return {
            ...application,
            qualification: qualificationId ? qualificationMap.get(qualificationId) || null : null,
        };
    });
}

function readNestedString(payload: Record<string, unknown> | null | undefined, path: string[]): string | null {
    let current: unknown = payload;

    for (const segment of path) {
        if (!current || typeof current !== 'object' || !(segment in current)) {
            return null;
        }

        current = (current as Record<string, unknown>)[segment];
    }

    return typeof current === 'string' && current.trim().length > 0 ? current.trim() : null;
}

function toCertificateSummary(record: CertificateRecordRow | null): CertificateSummary | null {
    if (!record) {
        return null;
    }

    const document = normalizeOne(record.document);

    return {
        id: record.id,
        certificateNumber: record.certificate_number,
        certificateTitle: record.certificate_title,
        issueDate: record.issue_date,
        status: record.status,
        version: Number(record.version || 1),
        includesTranscript: record.includes_transcript === true,
        verificationUrl: record.verification_url,
        generatedAt: record.generated_at,
        documentId: record.document_id,
        documentFileName: document?.file_name || null,
    };
}

function toCertificateGenerationJobSummary(
    job: CertificateGenerationJobRow | null,
    certificate: CertificateSummary | null
): CertificateGenerationJobSummary | null {
    if (!job) {
        return null;
    }

    return {
        id: job.id,
        applicationId: job.application_id,
        status: job.status,
        certificateNumber: job.certificate_number,
        verificationUrl: job.verification_url,
        certificateRecordId: job.certificate_record_id,
        documentId: job.document_id,
        attemptCount: Number(job.attempt_count || 0),
        lastError: job.last_error,
        queuedAt: job.queued_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        failedAt: job.failed_at,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        certificate,
    };
}

async function getAdminCapableClient(fallback: QuerySupabaseClient): Promise<QuerySupabaseClient> {
    try {
        return createAdminServerClient();
    } catch {
        return fallback;
    }
}

export async function authorizeCertificateRequest(input: {
    request?: NextRequest;
    permissionKey: 'certificates.view' | 'certificates.manage';
}): Promise<
    | {
        ok: true;
        context: {
            supabase: ServerSupabaseClient;
            adminSupabase: QuerySupabaseClient;
            userId: string;
            role: UserRole;
        };
    }
    | {
        ok: false;
        response: NextResponse;
    }
> {
    const authResult = await getAuthenticatedUserContext();
    if (!authResult.ok) {
        return authResult;
    }

    if (!CERTIFICATE_ALLOWED_ROLES.includes(authResult.context.role)) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
        };
    }

    const granted = await hasActionPermission({
        supabase: authResult.context.supabase,
        role: authResult.context.role,
        permissionKey: input.permissionKey,
    });

    if (!granted) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
        };
    }

    return {
        ok: true,
        context: {
            ...authResult.context,
            adminSupabase: await getAdminCapableClient(authResult.context.supabase),
        },
    };
}

async function fetchLatestCertificateRecords(
    supabase: QuerySupabaseClient,
    applicationIds: string[]
): Promise<Map<string, CertificateRecordRow>> {
    if (applicationIds.length === 0) {
        return new Map();
    }

    const { data, error } = await supabase
        .from('certificate_records')
        .select('id, application_id, certificate_number, certificate_title, issue_date, status, version, includes_transcript, verification_url, generated_at, request_payload, document_id, document:documents(id, file_name)')
        .in('application_id', applicationIds)
        .order('generated_at', { ascending: false })
        .returns<CertificateRecordRow[]>();

    if (error) {
        throw new Error(`Unable to load certificate records: ${error.message}`);
    }

    const records = new Map<string, CertificateRecordRow>();
    for (const row of data || []) {
        if (!records.has(row.application_id)) {
            records.set(row.application_id, row);
        }
    }

    return records;
}

async function fetchCertificateRecordsById(
    supabase: QuerySupabaseClient,
    certificateIds: string[]
): Promise<Map<string, CertificateRecordRow>> {
    if (certificateIds.length === 0) {
        return new Map();
    }

    const { data, error } = await supabase
        .from('certificate_records')
        .select('id, application_id, certificate_number, certificate_title, issue_date, status, version, includes_transcript, verification_url, generated_at, request_payload, document_id, document:documents(id, file_name)')
        .in('id', certificateIds)
        .returns<CertificateRecordRow[]>();

    if (error) {
        throw new Error(`Unable to load certificate records by id: ${error.message}`);
    }

    return new Map((data || []).map((row) => [row.id, row]));
}

async function fetchLatestCertificateJobs(
    supabase: QuerySupabaseClient,
    applicationIds: string[]
): Promise<Map<string, CertificateGenerationJobSummary>> {
    if (applicationIds.length === 0) {
        return new Map();
    }

    const { data, error } = await supabase
        .from('certificate_generation_jobs')
        .select('id, application_id, certificate_record_id, document_id, status, certificate_number, verification_url, attempt_count, last_error, queued_at, started_at, completed_at, failed_at, created_at, updated_at')
        .in('application_id', applicationIds)
        .order('created_at', { ascending: false })
        .returns<CertificateGenerationJobRow[]>();

    if (error) {
        throw new Error(`Unable to load certificate generation jobs: ${error.message}`);
    }

    const latestJobs = new Map<string, CertificateGenerationJobRow>();
    for (const row of data || []) {
        if (!latestJobs.has(row.application_id)) {
            latestJobs.set(row.application_id, row);
        }
    }

    const certificateMap = await fetchCertificateRecordsById(
        supabase,
        Array.from(new Set(
            Array.from(latestJobs.values())
                .map((job) => job.certificate_record_id)
                .filter((value): value is string => Boolean(value))
        ))
    );

    return new Map(
        Array.from(latestJobs.entries()).map(([applicationId, job]) => [
            applicationId,
            toCertificateGenerationJobSummary(
                job,
                job.certificate_record_id
                    ? toCertificateSummary(certificateMap.get(job.certificate_record_id) || null)
                    : null
            ) as CertificateGenerationJobSummary,
        ])
    );
}

export async function fetchCertificateGenerationJob(
    jobId: string,
    supabase: QuerySupabaseClient
): Promise<CertificateGenerationJobSummary | null> {
    const { data, error } = await supabase
        .from('certificate_generation_jobs')
        .select('id, application_id, certificate_record_id, document_id, status, certificate_number, verification_url, attempt_count, last_error, queued_at, started_at, completed_at, failed_at, created_at, updated_at')
        .eq('id', jobId)
        .maybeSingle<CertificateGenerationJobRow>();

    if (error) {
        throw new Error(`Unable to load certificate generation job: ${error.message}`);
    }

    if (!data) {
        return null;
    }

    const certificateMap = await fetchCertificateRecordsById(
        supabase,
        data.certificate_record_id ? [data.certificate_record_id] : []
    );

    return toCertificateGenerationJobSummary(
        data,
        data.certificate_record_id
            ? toCertificateSummary(certificateMap.get(data.certificate_record_id) || null)
            : null
    );
}

export async function fetchCertificateGenerationJobRecord(
    jobId: string,
    supabase: QuerySupabaseClient
): Promise<CertificateGenerationJobRecordRow | null> {
    const { data, error } = await supabase
        .from('certificate_generation_jobs')
        .select('id, application_id, certificate_record_id, document_id, requested_by, status, certificate_number, verification_url, request_payload, attempt_count, last_error, queued_at, started_at, completed_at, failed_at, created_at, updated_at')
        .eq('id', jobId)
        .maybeSingle<CertificateGenerationJobRecordRow>();

    if (error) {
        throw new Error(`Unable to load certificate generation job record: ${error.message}`);
    }

    return data;
}

export async function fetchCertificateGenerationJobsByStatus(
    statuses: CertificateGenerationJobStatus[],
    supabase: QuerySupabaseClient
): Promise<CertificateGenerationJobRecordRow[]> {
    if (statuses.length === 0) {
        return [];
    }

    const { data, error } = await supabase
        .from('certificate_generation_jobs')
        .select('id, application_id, certificate_record_id, document_id, requested_by, status, certificate_number, verification_url, request_payload, attempt_count, last_error, queued_at, started_at, completed_at, failed_at, created_at, updated_at')
        .in('status', statuses)
        .order('created_at', { ascending: false })
        .returns<CertificateGenerationJobRecordRow[]>();

    if (error) {
        throw new Error(`Unable to load certificate generation jobs by status: ${error.message}`);
    }

    return data || [];
}

export async function fetchActiveCertificateGenerationJobForApplication(
    applicationId: string,
    supabase: QuerySupabaseClient
): Promise<CertificateGenerationJobSummary | null> {
    const { data, error } = await supabase
        .from('certificate_generation_jobs')
        .select('id, application_id, certificate_record_id, document_id, status, certificate_number, verification_url, attempt_count, last_error, queued_at, started_at, completed_at, failed_at, created_at, updated_at')
        .eq('application_id', applicationId)
        .in('status', ['queued', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<CertificateGenerationJobRow>();

    if (error) {
        throw new Error(`Unable to load active certificate generation job: ${error.message}`);
    }

    if (!data) {
        return null;
    }

    const certificateMap = await fetchCertificateRecordsById(
        supabase,
        data.certificate_record_id ? [data.certificate_record_id] : []
    );

    return toCertificateGenerationJobSummary(
        data,
        data.certificate_record_id
            ? toCertificateSummary(certificateMap.get(data.certificate_record_id) || null)
            : null
    );
}

export async function cancelCertificateGenerationJobs(
    input: {
        jobIds: string[];
        supabase: QuerySupabaseClient;
        lastError?: string | null;
    }
): Promise<void> {
    const jobIds = [...new Set(input.jobIds.filter(Boolean))];
    if (jobIds.length === 0) {
        return;
    }

    const { error } = await input.supabase
        .from('certificate_generation_jobs')
        .update({
            status: 'cancelled',
            last_error: input.lastError ?? 'Cancelled from certificate queue.',
            updated_at: new Date().toISOString(),
        })
        .in('id', jobIds);

    if (error) {
        throw new Error(`Unable to cancel certificate generation jobs: ${error.message}`);
    }
}

export async function createQueuedCertificateGenerationJob(
    input: {
        applicationId: string;
        requestedBy: string;
        certificateNumber: string;
        verificationUrl: string;
        requestPayload: CertificateGenerationRequestPayload;
        supabase: QuerySupabaseClient;
    }
): Promise<string> {
    const { data, error } = await input.supabase
        .from('certificate_generation_jobs')
        .insert({
            application_id: input.applicationId,
            requested_by: input.requestedBy,
            status: 'queued',
            certificate_number: input.certificateNumber,
            verification_url: input.verificationUrl,
            request_payload: input.requestPayload,
            updated_at: new Date().toISOString(),
        })
        .select('id')
        .single<{ id: string }>();

    if (error || !data) {
        throw new Error(error?.message || 'Unable to create the certificate generation job.');
    }

    return data.id;
}

export function buildCertificateGenerationPayload(input: {
    draft: CertificateDraftPayload;
    issueDate: string;
    scope: string;
    standard: string;
    auditRef: string;
    includeTranscript: boolean;
    transcriptRows: CertificateTranscriptRow[];
}): CertificateGenerationRequestPayload {
    return {
        application: {
            id: input.draft.application.id,
            applicationNumber: input.draft.application.applicationNumber,
            studentUid: input.draft.application.studentUid,
            studentName: input.draft.application.studentName,
            studentEmail: input.draft.application.studentEmail,
            qualificationId: input.draft.application.qualificationId,
            qualificationCode: input.draft.application.qualificationCode,
            qualificationName: input.draft.application.qualificationName,
        },
        issueDate: input.issueDate,
        certificateTitle: input.draft.application.qualificationName || 'Certificate',
        keyDetails: {
            scope: input.scope,
            standard: input.standard,
            auditRef: input.auditRef,
        },
        includeTranscript: input.includeTranscript,
        transcriptRows: input.transcriptRows,
    };
}

async function fetchApplicationDraftRow(
    applicationId: string,
    supabase: QuerySupabaseClient
): Promise<ApplicationDraftRow> {
    const { data, error } = await supabase
        .from('applications')
        .select('id, application_number, student_uid, student_first_name, student_last_name, student_email, workflow_stage, issue_date, docs_prepared_at, sent_at, offering_id, qualification_id')
        .eq('id', applicationId)
        .maybeSingle<ApplicationDraftRow>();

    if (error) {
        throw new Error(`Unable to load application draft: ${error.message}`);
    }

    if (!data) {
        throw new Error('Application not found.');
    }

    const [hydratedApplication] = await hydrateApplicationQualifications([data], supabase);
    return hydratedApplication;
}

async function fetchTranscriptRows(input: {
    supabase: QuerySupabaseClient;
    qualificationId: string | null;
    latestCertificate: CertificateRecordRow | null;
    defaultYear: string;
}): Promise<CertificateTranscriptRow[]> {
    const qualificationUnits = input.qualificationId
        ? await input.supabase
            .from('qualification_units')
            .select('id, unit_code, unit_title')
            .eq('qualification_id', input.qualificationId)
            .eq('is_current', true)
            .order('unit_code', { ascending: true })
            .returns<QualificationUnitRow[]>()
        : { data: [] as QualificationUnitRow[], error: null };

    if (qualificationUnits.error) {
        throw new Error(`Unable to load qualification units: ${qualificationUnits.error.message}`);
    }

    const latestUnitResults = input.latestCertificate
        ? await input.supabase
            .from('certificate_unit_results')
            .select('qualification_unit_id, unit_code, unit_title, result, year, sort_order')
            .eq('certificate_id', input.latestCertificate.id)
            .order('sort_order', { ascending: true })
            .returns<CertificateUnitResultRow[]>()
        : { data: [] as CertificateUnitResultRow[], error: null };

    if (latestUnitResults.error) {
        throw new Error(`Unable to load transcript rows: ${latestUnitResults.error.message}`);
    }

    const priorRows = latestUnitResults.data || [];
    const priorByQualificationUnitId = new Map<string, CertificateUnitResultRow>();
    const priorByUnitCode = new Map<string, CertificateUnitResultRow>();

    for (const row of priorRows) {
        if (row.qualification_unit_id) {
            priorByQualificationUnitId.set(row.qualification_unit_id, row);
        }
        priorByUnitCode.set(row.unit_code, row);
    }

    const hasPreviousCertificate = Boolean(input.latestCertificate);
    const rows: CertificateTranscriptRow[] = (qualificationUnits.data || []).map((unit, index) => {
        const prior = priorByQualificationUnitId.get(unit.id) || priorByUnitCode.get(unit.unit_code) || null;

        return {
            qualificationUnitId: unit.id,
            unitCode: unit.unit_code,
            unitTitle: unit.unit_title,
            result: prior?.result || 'Competent',
            year: prior?.year || input.defaultYear,
            included: prior ? true : !hasPreviousCertificate,
            sortOrder: typeof prior?.sort_order === 'number' ? prior.sort_order : index,
        };
    });

    const knownQualificationUnitIds = new Set(rows.map((row) => row.qualificationUnitId).filter((value): value is string => Boolean(value)));
    const knownUnitCodes = new Set(rows.map((row) => row.unitCode));

    for (const row of priorRows) {
        if ((row.qualification_unit_id && knownQualificationUnitIds.has(row.qualification_unit_id)) || knownUnitCodes.has(row.unit_code)) {
            continue;
        }

        rows.push({
            qualificationUnitId: row.qualification_unit_id,
            unitCode: row.unit_code,
            unitTitle: row.unit_title,
            result: row.result,
            year: row.year,
            included: true,
            sortOrder: row.sort_order,
        });
    }

    return rows.sort((left, right) => left.sortOrder - right.sortOrder || left.unitCode.localeCompare(right.unitCode));
}

export async function fetchCertificateDraftPayload(
    applicationId: string,
    supabase: QuerySupabaseClient
): Promise<CertificateDraftPayload> {
    const application = await fetchApplicationDraftRow(applicationId, supabase);
    if (!['dispatch', 'completed'].includes(application.workflow_stage)) {
        throw new Error('Certificates can only be generated for Dispatch or Completed applications.');
    }

    const qualification = getApplicationQualification(application);
    if (!qualification) {
        throw new Error('A qualification is required before generating certificates.');
    }

    const latestCertificates = await fetchLatestCertificateRecords(supabase, [applicationId]);
    const latestCertificate = latestCertificates.get(applicationId) || null;
    const latestCertificateSummary = toCertificateSummary(latestCertificate);

    const payload = latestCertificate?.request_payload;
    const issueDate = latestCertificate?.issue_date || application.issue_date || todayIsoDate();
    const transcriptRows = await fetchTranscriptRows({
        supabase,
        qualificationId: qualification.id,
        latestCertificate,
        defaultYear: issueDate.slice(0, 4),
    });

    return {
        application: {
            id: application.id,
            applicationNumber: application.application_number,
            studentUid: application.student_uid,
            studentName: getApplicationStudentName(application),
            studentEmail: application.student_email,
            workflowStage: application.workflow_stage,
            qualificationId: qualification.id,
            qualificationCode: qualification.code,
            qualificationName: qualification.name,
        },
        defaults: {
            issueDate,
            standard: readNestedString(payload, ['keyDetails', 'standard']) || DEFAULT_CERTIFICATE_STANDARD,
            scope: readNestedString(payload, ['keyDetails', 'scope']) || qualification.name,
            auditRef: readNestedString(payload, ['keyDetails', 'auditRef']) || application.application_number || application.student_uid,
        },
        latestCertificate: latestCertificateSummary,
        transcriptRows,
    };
}

export async function fetchCertificateQueue(
    supabase: QuerySupabaseClient
): Promise<CertificateQueueItem[]> {
    const { data, error } = await supabase
        .from('applications')
        .select('id, application_number, student_uid, student_first_name, student_last_name, student_email, workflow_stage, issue_date, docs_prepared_at, sent_at, offering_id, qualification_id')
        .in('workflow_stage', ['dispatch', 'completed'])
        .order('updated_at', { ascending: false })
        .returns<ApplicationDraftRow[]>();

    if (error) {
        throw new Error(`Unable to load certificate queue: ${error.message}`);
    }

    const applications = await hydrateApplicationQualifications(data || [], supabase);
    const latestCertificates = await fetchLatestCertificateRecords(supabase, applications.map((application) => application.id));
    const latestJobs = await fetchLatestCertificateJobs(supabase, applications.map((application) => application.id));

    return applications.map((application) => {
        const qualification = getApplicationQualification(application);

        return {
            applicationId: application.id,
            applicationNumber: application.application_number,
            studentUid: application.student_uid,
            studentName: getApplicationStudentName(application),
            studentEmail: application.student_email,
            workflowStage: application.workflow_stage,
            issueDate: application.issue_date,
            docsPreparedAt: application.docs_prepared_at,
            sentAt: application.sent_at,
            qualificationId: qualification?.id || null,
            qualificationCode: qualification?.code || null,
            qualificationName: qualification?.name || null,
            latestCertificate: toCertificateSummary(latestCertificates.get(application.id) || null),
            latestJob: latestJobs.get(application.id) || null,
        };
    });
}

export async function fetchCertificateVerificationPayload(
    certificateNumber: string,
    supabase: QuerySupabaseClient
): Promise<CertificateVerificationPayload | null> {
    const { data, error } = await supabase
        .from('certificate_records')
        .select('id, application_id, certificate_number, certificate_title, issue_date, status, version, includes_transcript, verification_url, generated_at')
        .eq('certificate_number', certificateNumber)
        .maybeSingle<{
            id: string;
            application_id: string;
            certificate_number: string;
            certificate_title: string;
            issue_date: string;
            status: CertificateRecordStatus;
            version: number;
            includes_transcript: boolean;
            verification_url: string | null;
            generated_at: string;
        }>();

    if (error) {
        throw new Error(`Unable to verify certificate: ${error.message}`);
    }

    if (!data) {
        return null;
    }

    const application = await fetchApplicationDraftRow(data.application_id, supabase);
    const qualification = getApplicationQualification(application);

    return {
        certificateNumber: data.certificate_number,
        certificateTitle: data.certificate_title,
        issueDate: data.issue_date,
        status: data.status,
        version: Number(data.version || 1),
        includesTranscript: data.includes_transcript === true,
        verificationUrl: data.verification_url,
        generatedAt: data.generated_at,
        studentName: getApplicationStudentName(application),
        applicationNumber: application.application_number,
        qualificationCode: qualification?.code || null,
        qualificationName: qualification?.name || null,
    };
}

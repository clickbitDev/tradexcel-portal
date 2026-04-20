import type {
    CertificateGenerationJobStatus,
    CertificateRecordStatus,
    TranscriptUnitResult,
    WorkflowStage,
} from '@/types/database';

export const DEFAULT_CERTIFICATE_STANDARD = 'Australian Qualifications Framework';
export const TRANSCRIPT_RESULT_OPTIONS: TranscriptUnitResult[] = [
    'Competent',
    'Not Yet Competent',
    'Credit Transfer',
];

export interface CertificateTranscriptRow {
    qualificationUnitId: string | null;
    unitCode: string;
    unitTitle: string;
    result: TranscriptUnitResult;
    year: string;
    included: boolean;
    sortOrder: number;
}

export interface CertificateGenerationRequestPayload {
    application: {
        id: string;
        applicationNumber: string;
        studentUid: string;
        studentName: string;
        studentEmail: string | null;
        qualificationId: string | null;
        qualificationCode: string | null;
        qualificationName: string | null;
    };
    issueDate: string;
    certificateTitle: string;
    keyDetails: {
        scope: string;
        standard: string;
        auditRef: string;
    };
    includeTranscript: boolean;
    transcriptRows: CertificateTranscriptRow[];
}

export interface CertificateGenerationJobSummary {
    id: string;
    applicationId: string;
    status: CertificateGenerationJobStatus;
    certificateNumber: string | null;
    verificationUrl: string | null;
    certificateRecordId: string | null;
    documentId: string | null;
    attemptCount: number;
    lastError: string | null;
    queuedAt: string;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    createdAt: string;
    updatedAt: string;
    certificate: CertificateSummary | null;
}

export interface CertificateSummary {
    id: string;
    certificateNumber: string;
    certificateTitle: string;
    issueDate: string;
    status: CertificateRecordStatus;
    version: number;
    includesTranscript: boolean;
    verificationUrl: string | null;
    generatedAt: string;
    documentId: string | null;
    documentFileName: string | null;
}

export interface CertificateQueueItem {
    applicationId: string;
    applicationNumber: string;
    studentUid: string;
    studentName: string;
    studentEmail: string | null;
    workflowStage: WorkflowStage;
    issueDate: string | null;
    docsPreparedAt: string | null;
    sentAt: string | null;
    qualificationId: string | null;
    qualificationCode: string | null;
    qualificationName: string | null;
    latestCertificate: CertificateSummary | null;
    latestJob: CertificateGenerationJobSummary | null;
}

export interface CertificateDraftPayload {
    application: {
        id: string;
        applicationNumber: string;
        studentUid: string;
        studentName: string;
        studentEmail: string | null;
        workflowStage: WorkflowStage;
        qualificationId: string | null;
        qualificationCode: string | null;
        qualificationName: string | null;
    };
    defaults: {
        issueDate: string;
        standard: string;
        scope: string;
        auditRef: string;
    };
    latestCertificate: CertificateSummary | null;
    transcriptRows: CertificateTranscriptRow[];
}

export interface CertificateVerificationPayload {
    certificateNumber: string;
    certificateTitle: string;
    issueDate: string;
    status: CertificateRecordStatus;
    version: number;
    includesTranscript: boolean;
    verificationUrl: string | null;
    generatedAt: string;
    studentName: string;
    applicationNumber: string;
    qualificationCode: string | null;
    qualificationName: string | null;
}

import type { CertificateGenerationRequestPayload } from './shared';

export const CERTIFICATE_GENERATION_QUEUE_NAME = 'certificate-generation';

export interface CertificateGenerationQueuePayload {
    jobId: string;
    applicationId: string;
    requestedBy: string;
    certificateNumber: string;
    verificationUrl: string;
    requestPayload: CertificateGenerationRequestPayload;
}

export async function dispatchCertificateGenerationJob(payload: CertificateGenerationQueuePayload): Promise<void> {
    const { processJobPayload } = await import('./worker');
    setImmediate(() => {
        processJobPayload(payload).catch((err: unknown) => {
            console.error('Background certificate job failed', { jobId: payload.jobId, error: err });
        });
    });
}

export async function cancelCertificateGenerationJob(jobId: string): Promise<void> {
    // Cancellation is handled via DB status updates elsewhere
    // This is a no-op for compatibility
}

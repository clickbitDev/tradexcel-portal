CREATE TABLE "certificate_generation_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "certificate_record_id" UUID,
    "document_id" UUID,
    "requested_by" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "certificate_number" VARCHAR(64),
    "verification_url" TEXT,
    "request_payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "queued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificate_generation_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "certificate_generation_jobs_status_check" CHECK ("status" IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    CONSTRAINT "certificate_generation_jobs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE,
    CONSTRAINT "certificate_generation_jobs_certificate_record_id_fkey" FOREIGN KEY ("certificate_record_id") REFERENCES "certificate_records"("id") ON DELETE SET NULL,
    CONSTRAINT "certificate_generation_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL,
    CONSTRAINT "certificate_generation_jobs_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "profiles"("id") ON DELETE SET NULL
);

CREATE INDEX "idx_certificate_generation_jobs_application" ON "certificate_generation_jobs"("application_id");
CREATE INDEX "idx_certificate_generation_jobs_certificate_record" ON "certificate_generation_jobs"("certificate_record_id");
CREATE INDEX "idx_certificate_generation_jobs_document" ON "certificate_generation_jobs"("document_id");
CREATE INDEX "idx_certificate_generation_jobs_requested_by" ON "certificate_generation_jobs"("requested_by");
CREATE INDEX "idx_certificate_generation_jobs_status" ON "certificate_generation_jobs"("status");
CREATE INDEX "idx_certificate_generation_jobs_queued_at" ON "certificate_generation_jobs"("queued_at");

CREATE UNIQUE INDEX "idx_certificate_generation_jobs_active_application"
ON "certificate_generation_jobs"("application_id")
WHERE "status" IN ('queued', 'processing');

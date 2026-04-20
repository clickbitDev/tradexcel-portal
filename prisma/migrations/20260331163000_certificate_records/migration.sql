CREATE TABLE "certificate_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "qualification_id" UUID,
    "document_id" UUID,
    "certificate_number" VARCHAR(64) NOT NULL,
    "certificate_title" TEXT NOT NULL,
    "issue_date" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "includes_transcript" BOOLEAN NOT NULL DEFAULT false,
    "verification_url" TEXT,
    "request_payload" JSONB DEFAULT '{}'::jsonb,
    "generated_by" UUID,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificate_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "certificate_records_status_check" CHECK ("status" IN ('active', 'replaced', 'revoked')),
    CONSTRAINT "certificate_records_certificate_number_key" UNIQUE ("certificate_number"),
    CONSTRAINT "certificate_records_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE,
    CONSTRAINT "certificate_records_qualification_id_fkey" FOREIGN KEY ("qualification_id") REFERENCES "qualifications"("id") ON DELETE SET NULL,
    CONSTRAINT "certificate_records_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL,
    CONSTRAINT "certificate_records_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "profiles"("id") ON DELETE SET NULL
);

CREATE TABLE "certificate_unit_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "certificate_id" UUID NOT NULL,
    "qualification_unit_id" UUID,
    "unit_code" VARCHAR(50) NOT NULL,
    "unit_title" TEXT NOT NULL,
    "result" VARCHAR(30) NOT NULL,
    "year" VARCHAR(4) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificate_unit_results_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "certificate_unit_results_result_check" CHECK ("result" IN ('Competent', 'Not Yet Competent', 'Credit Transfer')),
    CONSTRAINT "certificate_unit_results_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificate_records"("id") ON DELETE CASCADE,
    CONSTRAINT "certificate_unit_results_qualification_unit_id_fkey" FOREIGN KEY ("qualification_unit_id") REFERENCES "qualification_units"("id") ON DELETE SET NULL
);

CREATE INDEX "idx_certificate_records_application" ON "certificate_records"("application_id");
CREATE INDEX "idx_certificate_records_qualification" ON "certificate_records"("qualification_id");
CREATE INDEX "idx_certificate_records_document" ON "certificate_records"("document_id");
CREATE INDEX "idx_certificate_records_generated_by" ON "certificate_records"("generated_by");
CREATE INDEX "idx_certificate_records_status" ON "certificate_records"("status");

CREATE INDEX "idx_certificate_unit_results_certificate" ON "certificate_unit_results"("certificate_id");
CREATE INDEX "idx_certificate_unit_results_qualification_unit" ON "certificate_unit_results"("qualification_unit_id");
CREATE INDEX "idx_certificate_unit_results_sort_order" ON "certificate_unit_results"("sort_order");

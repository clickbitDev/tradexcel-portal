BEGIN;

ALTER TABLE public.applications
    ADD COLUMN IF NOT EXISTS assessment_report_date date,
    ADD COLUMN IF NOT EXISTS assessment_report_start_time time,
    ADD COLUMN IF NOT EXISTS assessment_report_end_time time,
    ADD COLUMN IF NOT EXISTS assessment_report_venue varchar(50),
    ADD COLUMN IF NOT EXISTS assessment_report_virtual_platform varchar(50),
    ADD COLUMN IF NOT EXISTS assessment_report_meeting_record_document_id uuid,
    ADD COLUMN IF NOT EXISTS assessment_report_outcome text,
    ADD COLUMN IF NOT EXISTS assessment_report_overview text,
    ADD COLUMN IF NOT EXISTS assessment_report_recommendation text,
    ADD COLUMN IF NOT EXISTS assessment_report_completed_at timestamptz,
    ADD COLUMN IF NOT EXISTS assessment_report_completed_by uuid;

COMMIT;

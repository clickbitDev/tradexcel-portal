-- ============================================
-- EDWARD PORTAL DATABASE MIGRATION
-- Migration: 20260405103000_transfer_qualification_matching_and_application_fks
-- Purpose: Persist transferred qualification codes and restore application foreign keys
-- ============================================

BEGIN;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS source_qualification_code text;

CREATE INDEX IF NOT EXISTS idx_applications_source_qualification_code
  ON public.applications(source_qualification_code);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.applications'::regclass
      AND conname = 'applications_qualification_id_fkey'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_qualification_id_fkey
      FOREIGN KEY (qualification_id)
      REFERENCES public.qualifications(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.applications'::regclass
      AND conname = 'applications_offering_id_fkey'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_offering_id_fkey
      FOREIGN KEY (offering_id)
      REFERENCES public.rto_offerings(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

COMMIT;

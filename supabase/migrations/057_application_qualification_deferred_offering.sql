-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 057_application_qualification_deferred_offering
-- Purpose: Support qualification-first intake before RTO assignment
-- ============================================

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS qualification_id uuid;

UPDATE public.applications AS a
SET qualification_id = ro.qualification_id
FROM public.rto_offerings AS ro
WHERE a.offering_id = ro.id
  AND (a.qualification_id IS NULL OR a.qualification_id <> ro.qualification_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'applications'
      AND constraint_name = 'applications_qualification_id_fkey'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_qualification_id_fkey
      FOREIGN KEY (qualification_id) REFERENCES public.qualifications(id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_applications_qualification_id
  ON public.applications(qualification_id);

ALTER TABLE public.applications
  ALTER COLUMN offering_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_student_uid()
RETURNS TRIGGER AS $$
DECLARE
  v_date_prefix text;
  v_serial bigint;
  v_first_name text;
  v_qualification_code text;
BEGIN
  IF NEW.application_number IS NOT NULL AND NEW.application_number <> '' THEN
    IF NEW.application_number ~ '^APP-[0-9]+$' THEN
      v_serial := (regexp_match(NEW.application_number, '^APP-([0-9]+)$'))[1]::bigint;
    ELSE
      RAISE EXCEPTION 'Invalid application_number format: %', NEW.application_number;
    END IF;
  ELSIF NEW.student_uid IS NOT NULL AND NEW.student_uid <> '' THEN
    IF NEW.student_uid ~ '^[0-9]{8}-[0-9]+[A-Z]+-[A-Z0-9]+$' THEN
      v_serial := (regexp_match(NEW.student_uid, '^[0-9]{8}-([0-9]+)[A-Z]+-[A-Z0-9]+$'))[1]::bigint;
    ELSIF NEW.student_uid ~ '^APP-[0-9]+$' THEN
      v_serial := (regexp_match(NEW.student_uid, '^APP-([0-9]+)$'))[1]::bigint;
    ELSIF NEW.student_uid ~ '^APP-[0-9]{4}-[0-9]+$' THEN
      v_serial := (regexp_match(NEW.student_uid, '^APP-[0-9]{4}-([0-9]+)$'))[1]::bigint;
    END IF;
  END IF;

  IF v_serial IS NULL THEN
    v_serial := nextval('public.application_uid_serial_seq');
  END IF;

  IF NEW.application_number IS NULL OR NEW.application_number = '' THEN
    NEW.application_number := 'APP-' || v_serial::text;
  END IF;

  IF NEW.student_uid IS NULL OR NEW.student_uid = '' THEN
    v_date_prefix := to_char(COALESCE(NEW.created_at, now()), 'YYYYDDMM');

    v_first_name := upper(COALESCE(NULLIF(NEW.student_first_name, ''), 'STUDENT'));
    v_first_name := regexp_replace(v_first_name, '[^A-Z]', '', 'g');
    IF v_first_name = '' THEN
      v_first_name := 'STUDENT';
    END IF;

    IF NEW.qualification_id IS NULL AND NEW.offering_id IS NOT NULL THEN
      SELECT ro.qualification_id
      INTO NEW.qualification_id
      FROM public.rto_offerings ro
      WHERE ro.id = NEW.offering_id;
    END IF;

    SELECT upper(q.code)
    INTO v_qualification_code
    FROM public.qualifications q
    WHERE q.id = NEW.qualification_id;

    IF v_qualification_code IS NULL AND NEW.offering_id IS NOT NULL THEN
      SELECT upper(q.code)
      INTO v_qualification_code
      FROM public.rto_offerings ro
      JOIN public.qualifications q ON q.id = ro.qualification_id
      WHERE ro.id = NEW.offering_id;
    END IF;

    v_qualification_code := regexp_replace(COALESCE(v_qualification_code, 'UNKNOWN'), '[^A-Z0-9]', '', 'g');
    IF v_qualification_code = '' THEN
      v_qualification_code := 'UNKNOWN';
    END IF;

    NEW.student_uid := v_date_prefix || '-' || v_serial::text || v_first_name || '-' || v_qualification_code;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

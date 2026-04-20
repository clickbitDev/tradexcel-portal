-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 049_application_number_separate_from_uid
-- Purpose: Keep Application ID (APP-<serial>) separate from UID
-- ============================================

CREATE SEQUENCE IF NOT EXISTS public.application_uid_serial_seq;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS application_number text;

-- Backfill application_number from existing student_uid values.
UPDATE public.applications a
SET application_number = 'APP-' || parsed.serial::text
FROM (
  SELECT
    id,
    CASE
      WHEN student_uid ~ '^APP-[0-9]+$' THEN (regexp_match(student_uid, '^APP-([0-9]+)$'))[1]::bigint
      WHEN student_uid ~ '^APP-[0-9]{4}-[0-9]+$' THEN (regexp_match(student_uid, '^APP-[0-9]{4}-([0-9]+)$'))[1]::bigint
      WHEN student_uid ~ '^[0-9]{8}-[0-9]+[A-Z]+-[A-Z0-9]+$' THEN (regexp_match(student_uid, '^[0-9]{8}-([0-9]+)[A-Z]+-[A-Z0-9]+$'))[1]::bigint
      ELSE NULL
    END AS serial
  FROM public.applications
) parsed
WHERE a.id = parsed.id
  AND (a.application_number IS NULL OR a.application_number = '')
  AND parsed.serial IS NOT NULL;

-- Normalize any legacy APP-YYYY-NNNN values to APP-<serial>.
UPDATE public.applications
SET application_number = 'APP-' || (regexp_match(application_number, '^APP-[0-9]{4}-([0-9]+)$'))[1]::bigint::text
WHERE application_number ~ '^APP-[0-9]{4}-[0-9]+$';

-- Fill any remaining null/empty application numbers with fresh serials.
WITH base AS (
  SELECT COALESCE(MAX((regexp_match(application_number, '^APP-([0-9]+)$'))[1]::bigint), 0) AS max_serial
  FROM public.applications
  WHERE application_number ~ '^APP-[0-9]+$'
),
missing AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.applications
  WHERE application_number IS NULL OR application_number = ''
),
assigned AS (
  SELECT m.id, b.max_serial + m.rn AS serial
  FROM missing m
  CROSS JOIN base b
)
UPDATE public.applications a
SET application_number = 'APP-' || assigned.serial::text
FROM assigned
WHERE a.id = assigned.id;

-- Resolve any duplicates defensively by reassigning later rows.
WITH ranked AS (
  SELECT
    id,
    application_number,
    ROW_NUMBER() OVER (PARTITION BY application_number ORDER BY created_at, id) AS rn
  FROM public.applications
  WHERE application_number IS NOT NULL
),
dupes AS (
  SELECT id
  FROM ranked
  WHERE rn > 1
),
base AS (
  SELECT COALESCE(MAX((regexp_match(application_number, '^APP-([0-9]+)$'))[1]::bigint), 0) AS max_serial
  FROM public.applications
  WHERE application_number ~ '^APP-[0-9]+$'
),
assigned AS (
  SELECT d.id, b.max_serial + ROW_NUMBER() OVER (ORDER BY d.id) AS serial
  FROM dupes d
  CROSS JOIN base b
)
UPDATE public.applications a
SET application_number = 'APP-' || assigned.serial::text
FROM assigned
WHERE a.id = assigned.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'applications_application_number_format'
      AND conrelid = 'public.applications'::regclass
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_application_number_format
      CHECK (application_number ~ '^APP-[0-9]+$');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'applications_application_number_key'
      AND conrelid = 'public.applications'::regclass
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_application_number_key
      UNIQUE (application_number);
  END IF;
END;
$$;

ALTER TABLE public.applications
  ALTER COLUMN application_number SET NOT NULL;

DO $$
DECLARE
  v_last_serial bigint;
BEGIN
  SELECT GREATEST(
    COALESCE(
      (
        SELECT MAX((regexp_match(application_number, '^APP-([0-9]+)$'))[1]::bigint)
        FROM public.applications
        WHERE application_number ~ '^APP-[0-9]+$'
      ),
      0
    ),
    COALESCE(
      (
        SELECT MAX((regexp_match(student_uid, '^[0-9]{8}-([0-9]+)[A-Z]+-[A-Z0-9]+$'))[1]::bigint)
        FROM public.applications
        WHERE student_uid ~ '^[0-9]{8}-[0-9]+[A-Z]+-[A-Z0-9]+$'
      ),
      0
    ),
    COALESCE(
      (
        SELECT MAX((regexp_match(student_uid, '^APP-([0-9]+)$'))[1]::bigint)
        FROM public.applications
        WHERE student_uid ~ '^APP-[0-9]+$'
      ),
      0
    ),
    COALESCE(
      (
        SELECT MAX((regexp_match(student_uid, '^APP-[0-9]{4}-([0-9]+)$'))[1]::bigint)
        FROM public.applications
        WHERE student_uid ~ '^APP-[0-9]{4}-[0-9]+$'
      ),
      0
    ),
    COALESCE((SELECT COUNT(*)::bigint FROM public.applications), 0)
  )
  INTO v_last_serial;

  IF v_last_serial > 0 THEN
    PERFORM setval('public.application_uid_serial_seq', v_last_serial, true);
  ELSE
    PERFORM setval('public.application_uid_serial_seq', 1, false);
  END IF;
END;
$$;

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

    SELECT upper(q.code)
    INTO v_qualification_code
    FROM public.rto_offerings ro
    JOIN public.qualifications q ON q.id = ro.qualification_id
    WHERE ro.id = NEW.offering_id;

    v_qualification_code := regexp_replace(COALESCE(v_qualification_code, 'UNKNOWN'), '[^A-Z0-9]', '', 'g');
    IF v_qualification_code = '' THEN
      v_qualification_code := 'UNKNOWN';
    END IF;

    NEW.student_uid := v_date_prefix || '-' || v_serial::text || v_first_name || '-' || v_qualification_code;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS set_student_uid ON public.applications;

CREATE TRIGGER set_student_uid
  BEFORE INSERT ON public.applications
  FOR EACH ROW
  WHEN (
    NEW.student_uid IS NULL OR NEW.student_uid = ''
    OR NEW.application_number IS NULL OR NEW.application_number = ''
  )
  EXECUTE FUNCTION public.generate_student_uid();

COMMENT ON FUNCTION public.generate_student_uid() IS 'Generates UID and Application ID from one shared serial.';
COMMENT ON COLUMN public.applications.application_number IS 'Application ID format: APP-<serial number>';
COMMENT ON COLUMN public.applications.student_uid IS 'Unique Identity (UID): YYYYDDMM-<serial><FIRSTNAME>-<QUALIFICATION_CODE>';

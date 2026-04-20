-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 048_application_uid_format
-- Purpose: Generate application UID as YYYYDDMM-<serial><FIRSTNAME>-<QUALIFICATION_CODE>
-- ============================================

CREATE SEQUENCE IF NOT EXISTS public.application_uid_serial_seq;

DO $$
DECLARE
  v_last_serial bigint;
BEGIN
  SELECT GREATEST(
    COALESCE(
      (
        SELECT MAX((regexp_match(student_uid, '^\d{8}-(\d+)[A-Z]+-[A-Z0-9]+$'))[1]::bigint)
        FROM public.applications
        WHERE student_uid ~ '^\d{8}-\d+[A-Z]+-[A-Z0-9]+$'
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
  v_date_prefix := to_char(COALESCE(NEW.created_at, now()), 'YYYYDDMM');
  v_serial := nextval('public.application_uid_serial_seq');

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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

COMMENT ON FUNCTION public.generate_student_uid() IS 'Generates application UID as YYYYDDMM-<serial><FIRSTNAME>-<QUALIFICATION_CODE>';
COMMENT ON COLUMN public.applications.student_uid IS 'Unique Identity (UID): YYYYDDMM-<serial><FIRSTNAME>-<QUALIFICATION_CODE>';

-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 20260313110000_workflow_stage_reset_and_assessor_evaluation
-- Purpose: Prepare new workflow stages and assessor evaluation fields
-- ============================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'assessment_result'
  ) THEN
    CREATE TYPE public.assessment_result AS ENUM ('pending', 'pass', 'failed');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'application_outcome'
  ) THEN
    CREATE TYPE public.application_outcome AS ENUM ('active', 'withdrawn', 'rejected');
  END IF;
END;
$$;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS assessment_result public.assessment_result NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS assessment_result_at timestamptz,
  ADD COLUMN IF NOT EXISTS assessment_result_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evaluation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS evaluation_started_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS application_outcome public.application_outcome NOT NULL DEFAULT 'active';

COMMIT;

ALTER TYPE public.workflow_stage ADD VALUE IF NOT EXISTS 'evaluate' AFTER 'enrolled';
ALTER TYPE public.workflow_stage ADD VALUE IF NOT EXISTS 'dispatch' AFTER 'evaluate';
ALTER TYPE public.workflow_stage ADD VALUE IF NOT EXISTS 'completed' AFTER 'dispatch';

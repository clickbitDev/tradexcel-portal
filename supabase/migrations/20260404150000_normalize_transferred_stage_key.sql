-- ============================================
-- EDWARD PORTAL DATABASE MIGRATION
-- Migration: 20260404150000_normalize_transferred_stage_key
-- Purpose: Normalize transferred workflow enum key casing
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typnamespace = 'public'::regnamespace
      AND t.typname = 'workflow_stage'
      AND e.enumlabel = 'transferred'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typnamespace = 'public'::regnamespace
      AND t.typname = 'workflow_stage'
      AND e.enumlabel = 'TRANSFERRED'
  ) THEN
    ALTER TYPE public.workflow_stage RENAME VALUE 'transferred' TO 'TRANSFERRED';
  END IF;
END;
$$;

UPDATE public.workflow_transitions
SET from_stage = 'TRANSFERRED'
WHERE from_stage = 'transferred';

UPDATE public.workflow_transitions
SET to_stage = 'TRANSFERRED'
WHERE to_stage = 'transferred';

UPDATE public.workflow_transition_events
SET from_stage = 'TRANSFERRED'
WHERE from_stage = 'transferred';

UPDATE public.workflow_transition_events
SET to_stage = 'TRANSFERRED'
WHERE to_stage = 'transferred';

UPDATE public.workflow_transition_approvals
SET from_stage = 'TRANSFERRED'
WHERE from_stage = 'transferred';

UPDATE public.workflow_transition_approvals
SET to_stage = 'TRANSFERRED'
WHERE to_stage = 'transferred';

UPDATE public.application_history
SET from_stage = 'TRANSFERRED'
WHERE from_stage = 'transferred';

UPDATE public.application_history
SET to_stage = 'TRANSFERRED'
WHERE to_stage = 'transferred';

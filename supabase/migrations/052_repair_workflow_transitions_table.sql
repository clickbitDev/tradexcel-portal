-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 052_repair_workflow_transitions_table
-- Purpose: Restore workflow_transitions table required by transition trigger
-- ============================================

CREATE TABLE IF NOT EXISTS public.workflow_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_stage text NOT NULL,
  to_stage text NOT NULL,
  is_allowed boolean NOT NULL DEFAULT true,
  requires_approval boolean NOT NULL DEFAULT false,
  required_role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_stage, to_stage)
);

ALTER TABLE public.workflow_transitions
  ADD COLUMN IF NOT EXISTS is_allowed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS required_role text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.workflow_transitions'::regclass
      AND conname = 'workflow_transitions_from_stage_to_stage_key'
  ) THEN
    ALTER TABLE public.workflow_transitions
      ADD CONSTRAINT workflow_transitions_from_stage_to_stage_key
      UNIQUE (from_stage, to_stage);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_workflow_transitions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_workflow_transitions_updated_at ON public.workflow_transitions;

CREATE TRIGGER update_workflow_transitions_updated_at
  BEFORE UPDATE ON public.workflow_transitions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workflow_transitions_updated_at();

INSERT INTO public.workflow_transitions (from_stage, to_stage, is_allowed, requires_approval, required_role)
VALUES
  ('draft', 'submitted', true, false, null),
  ('draft', 'withdrawn', true, false, null),
  ('submitted', 'docs_review', true, false, 'admin'),
  ('submitted', 'rejected', true, false, 'admin'),
  ('submitted', 'withdrawn', true, false, null),
  ('docs_review', 'rto_processing', true, false, 'assessor'),
  ('docs_review', 'submitted', true, false, 'admin'),
  ('docs_review', 'rejected', true, false, 'admin'),
  ('docs_review', 'withdrawn', true, false, null),
  ('rto_processing', 'offer_issued', true, false, 'admin'),
  ('rto_processing', 'rejected', true, false, 'admin'),
  ('rto_processing', 'withdrawn', true, false, null),
  ('offer_issued', 'payment_pending', true, false, 'accounts_manager'),
  ('offer_issued', 'withdrawn', true, false, null),
  ('payment_pending', 'coe_issued', true, false, 'accounts_manager'),
  ('payment_pending', 'withdrawn', true, false, null),
  ('coe_issued', 'visa_applied', true, false, 'ceo'),
  ('coe_issued', 'enrolled', true, false, 'dispatch_coordinator'),
  ('coe_issued', 'withdrawn', true, false, null),
  ('visa_applied', 'enrolled', true, false, 'dispatch_coordinator'),
  ('visa_applied', 'withdrawn', true, false, null),
  ('enrolled', 'withdrawn', true, false, null)
ON CONFLICT (from_stage, to_stage)
DO UPDATE SET
  is_allowed = EXCLUDED.is_allowed,
  requires_approval = EXCLUDED.requires_approval,
  required_role = EXCLUDED.required_role,
  updated_at = now();

ALTER TABLE public.workflow_transitions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workflow_transitions'
      AND policyname = 'Read workflow transitions'
  ) THEN
    CREATE POLICY "Read workflow transitions"
      ON public.workflow_transitions
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workflow_transitions'
      AND policyname = 'Manage workflow transitions by admin'
  ) THEN
    CREATE POLICY "Manage workflow transitions by admin"
      ON public.workflow_transitions
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('ceo', 'executive_manager', 'admin', 'developer')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('ceo', 'executive_manager', 'admin', 'developer')
        )
      );
  END IF;
END;
$$;

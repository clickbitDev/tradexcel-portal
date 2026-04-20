-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 056_workflow_transition_approvals_and_stage_tracking
-- Purpose: Add approval workflow + normalize workflow stage tracking
-- ============================================

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS workflow_stage_updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.applications
SET workflow_stage_updated_at = COALESCE(workflow_stage_updated_at, updated_at, now())
WHERE workflow_stage_updated_at IS NULL;

CREATE TABLE IF NOT EXISTS public.workflow_transition_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  from_stage text NOT NULL,
  to_stage text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  required_role text,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  transition_notes text,
  review_notes text,
  executed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_transition_approvals
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS required_role text,
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS transition_notes text,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS executed_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.workflow_transition_approvals'::regclass
      AND conname = 'workflow_transition_approvals_status_check'
  ) THEN
    ALTER TABLE public.workflow_transition_approvals
      ADD CONSTRAINT workflow_transition_approvals_status_check
      CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'executed'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'workflow_transition_approvals'
      AND constraint_name = 'workflow_transition_approvals_requested_by_fkey'
  ) THEN
    ALTER TABLE public.workflow_transition_approvals
      ADD CONSTRAINT workflow_transition_approvals_requested_by_fkey
      FOREIGN KEY (requested_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'workflow_transition_approvals'
      AND constraint_name = 'workflow_transition_approvals_reviewed_by_fkey'
  ) THEN
    ALTER TABLE public.workflow_transition_approvals
      ADD CONSTRAINT workflow_transition_approvals_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_workflow_transition_approvals_application
  ON public.workflow_transition_approvals(application_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_transition_approvals_status
  ON public.workflow_transition_approvals(status, required_role);

CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_transition_approvals_pending
  ON public.workflow_transition_approvals(application_id, from_stage, to_stage)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.set_workflow_transition_approvals_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_workflow_transition_approvals_updated_at ON public.workflow_transition_approvals;

CREATE TRIGGER update_workflow_transition_approvals_updated_at
  BEFORE UPDATE ON public.workflow_transition_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workflow_transition_approvals_updated_at();

ALTER TABLE public.workflow_transition_approvals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workflow_transition_approvals'
      AND policyname = 'Workflow transition approvals viewable by app access'
  ) THEN
    CREATE POLICY "Workflow transition approvals viewable by app access"
      ON public.workflow_transition_approvals
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.applications a
          LEFT JOIN public.partners p ON p.id = a.partner_id
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE a.id = workflow_transition_approvals.application_id
            AND (
              pr.role <> 'agent'
              OR p.user_id = auth.uid()
            )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workflow_transition_approvals'
      AND policyname = 'Workflow transition approvals managed by staff'
  ) THEN
    CREATE POLICY "Workflow transition approvals managed by staff"
      ON public.workflow_transition_approvals
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer')
        )
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_application_workflow_transition()
RETURNS trigger AS $$
DECLARE
  transition_allowed boolean;
  v_required_role text;
  v_current_role text;
BEGIN
  IF NEW.workflow_stage IS NOT DISTINCT FROM OLD.workflow_stage THEN
    RETURN NEW;
  END IF;

  IF OLD.workflow_stage IS NULL THEN
    NEW.workflow_stage_updated_at = COALESCE(NEW.workflow_stage_updated_at, now());
    RETURN NEW;
  END IF;

  SELECT wt.is_allowed, wt.required_role::text
  INTO transition_allowed, v_required_role
  FROM public.workflow_transitions wt
  WHERE wt.from_stage::text = OLD.workflow_stage::text
    AND wt.to_stage::text = NEW.workflow_stage::text;

  IF transition_allowed IS NULL THEN
    RAISE WARNING 'Workflow transition not defined: % -> % for application %',
      OLD.workflow_stage, NEW.workflow_stage, NEW.id;

    INSERT INTO public.record_activity (table_name, record_id, action, summary, user_id)
    VALUES (
      'applications',
      NEW.id,
      'undefined_transition',
      format('Undefined workflow transition: %s -> %s', OLD.workflow_stage, NEW.workflow_stage),
      COALESCE(NEW.last_updated_by, auth.uid())
    );

    NEW.workflow_stage_updated_at = now();
    RETURN NEW;
  END IF;

  IF NOT transition_allowed THEN
    RAISE EXCEPTION 'Workflow transition disabled: % -> %', OLD.workflow_stage, NEW.workflow_stage;
  END IF;

  IF v_required_role IS NOT NULL THEN
    SELECT p.role::text
    INTO v_current_role
    FROM public.profiles p
    WHERE p.id = COALESCE(NEW.last_updated_by, auth.uid());

    IF v_current_role NOT IN ('ceo', 'executive_manager', v_required_role) THEN
      RAISE EXCEPTION 'Insufficient permissions: transition % -> % requires % role',
        OLD.workflow_stage, NEW.workflow_stage, v_required_role;
    END IF;
  END IF;

  NEW.workflow_stage_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 051_workflow_engine_core
-- Purpose: Add non-breaking workflow engine support tables
-- ============================================

CREATE TABLE IF NOT EXISTS public.workflow_transition_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  from_stage text NOT NULL,
  to_stage text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_transition_events_application
  ON public.workflow_transition_events(application_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.workflow_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'normal',
  title text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'open',
  raised_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_alerts_application
  ON public.workflow_alerts(application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_alerts_status
  ON public.workflow_alerts(status, severity);

CREATE TABLE IF NOT EXISTS public.workflow_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  stage text NOT NULL,
  assignee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  unassigned_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_assignments_active
  ON public.workflow_assignments(application_id, stage, assignee_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_workflow_assignments_lookup
  ON public.workflow_assignments(application_id, stage, is_active);

CREATE OR REPLACE FUNCTION public.set_workflow_alerts_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_workflow_alerts_updated_at ON public.workflow_alerts;

CREATE TRIGGER update_workflow_alerts_updated_at
  BEFORE UPDATE ON public.workflow_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workflow_alerts_updated_at();

ALTER TABLE public.workflow_transition_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workflow_transition_events'
      AND policyname = 'Workflow transition events viewable by app access'
  ) THEN
    CREATE POLICY "Workflow transition events viewable by app access"
      ON public.workflow_transition_events
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.applications a
          LEFT JOIN public.partners p ON p.id = a.partner_id
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE a.id = workflow_transition_events.application_id
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
      AND tablename = 'workflow_transition_events'
      AND policyname = 'Workflow transition events insert by app access'
  ) THEN
    CREATE POLICY "Workflow transition events insert by app access"
      ON public.workflow_transition_events
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.applications a
          LEFT JOIN public.partners p ON p.id = a.partner_id
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE a.id = workflow_transition_events.application_id
            AND (
              pr.role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer')
              OR (pr.role = 'agent' AND p.user_id = auth.uid())
            )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workflow_alerts'
      AND policyname = 'Workflow alerts viewable by app access'
  ) THEN
    CREATE POLICY "Workflow alerts viewable by app access"
      ON public.workflow_alerts
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.applications a
          LEFT JOIN public.partners p ON p.id = a.partner_id
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE a.id = workflow_alerts.application_id
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
      AND tablename = 'workflow_alerts'
      AND policyname = 'Workflow alerts managed by staff'
  ) THEN
    CREATE POLICY "Workflow alerts managed by staff"
      ON public.workflow_alerts
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workflow_assignments'
      AND policyname = 'Workflow assignments viewable by app access'
  ) THEN
    CREATE POLICY "Workflow assignments viewable by app access"
      ON public.workflow_assignments
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.applications a
          LEFT JOIN public.partners p ON p.id = a.partner_id
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE a.id = workflow_assignments.application_id
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
      AND tablename = 'workflow_assignments'
      AND policyname = 'Workflow assignments managed by staff'
  ) THEN
    CREATE POLICY "Workflow assignments managed by staff"
      ON public.workflow_assignments
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

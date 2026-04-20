-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 058_workflow_transition_allowed_roles_hotfix
-- Purpose: Add allowed_roles support and permit frontdesk submitted -> docs_review
-- ============================================

BEGIN;

ALTER TABLE public.workflow_transitions
  ADD COLUMN IF NOT EXISTS allowed_roles text[];

INSERT INTO public.workflow_transitions (
  from_stage,
  to_stage,
  is_allowed,
  requires_approval,
  required_role,
  allowed_roles
)
VALUES (
  'submitted',
  'docs_review',
  true,
  false,
  'admin',
  ARRAY['admin', 'frontdesk', 'executive_manager']::text[]
)
ON CONFLICT (from_stage, to_stage)
DO UPDATE SET
  is_allowed = EXCLUDED.is_allowed,
  requires_approval = EXCLUDED.requires_approval,
  required_role = EXCLUDED.required_role,
  allowed_roles = EXCLUDED.allowed_roles,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.validate_application_workflow_transition()
RETURNS trigger AS $$
DECLARE
  transition_allowed boolean;
  v_required_role text;
  v_allowed_roles text[];
  v_current_role text;
BEGIN
  IF NEW.workflow_stage IS NOT DISTINCT FROM OLD.workflow_stage THEN
    RETURN NEW;
  END IF;

  IF OLD.workflow_stage IS NULL THEN
    NEW.workflow_stage_updated_at = COALESCE(NEW.workflow_stage_updated_at, now());
    RETURN NEW;
  END IF;

  SELECT wt.is_allowed, wt.required_role::text, wt.allowed_roles
  INTO transition_allowed, v_required_role, v_allowed_roles
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

  SELECT p.role::text
  INTO v_current_role
  FROM public.profiles p
  WHERE p.id = COALESCE(NEW.last_updated_by, auth.uid());

  IF v_allowed_roles IS NOT NULL AND COALESCE(array_length(v_allowed_roles, 1), 0) > 0 THEN
    IF NOT (
      COALESCE(v_current_role = ANY(v_allowed_roles), false)
      OR COALESCE(v_current_role = 'ceo', false)
      OR COALESCE(v_current_role = 'executive_manager', false)
    ) THEN
      RAISE EXCEPTION 'Insufficient permissions: transition % -> % requires one of [%] roles',
        OLD.workflow_stage, NEW.workflow_stage, array_to_string(v_allowed_roles, ', ');
    END IF;
  ELSIF v_required_role IS NOT NULL THEN
    IF NOT (
      COALESCE(v_current_role = 'ceo', false)
      OR COALESCE(v_current_role = 'executive_manager', false)
      OR COALESCE(v_current_role = v_required_role, false)
    ) THEN
      RAISE EXCEPTION 'Insufficient permissions: transition % -> % requires % role',
        OLD.workflow_stage, NEW.workflow_stage, v_required_role;
    END IF;
  END IF;

  NEW.workflow_stage_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

COMMIT;

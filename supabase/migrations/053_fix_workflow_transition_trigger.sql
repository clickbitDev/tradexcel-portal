-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 053_fix_workflow_transition_trigger
-- Purpose: Ensure workflow transition trigger resolves public.workflow_transitions
-- ============================================

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
    RETURN NEW;
  END IF;

  SELECT wt.is_allowed, wt.required_role
  INTO transition_allowed, v_required_role
  FROM public.workflow_transitions wt
  WHERE wt.from_stage = OLD.workflow_stage::text
    AND wt.to_stage = NEW.workflow_stage::text;

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

  INSERT INTO public.application_history (
    application_id,
    from_stage,
    to_stage,
    changed_by,
    created_at
  ) VALUES (
    NEW.id,
    OLD.workflow_stage::text,
    NEW.workflow_stage::text,
    COALESCE(NEW.last_updated_by, auth.uid()),
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS tr_validate_workflow_transition ON public.applications;

CREATE TRIGGER tr_validate_workflow_transition
  BEFORE UPDATE OF workflow_stage ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_application_workflow_transition();

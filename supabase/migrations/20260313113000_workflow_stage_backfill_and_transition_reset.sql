-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 20260313113000_workflow_stage_backfill_and_transition_reset
-- Purpose: Backfill new workflow stages and reseed transitions
-- ============================================

BEGIN;

DROP TRIGGER IF EXISTS tr_validate_workflow_transition ON public.applications;
DROP TRIGGER IF EXISTS tr_application_stage_change ON public.applications;

UPDATE public.applications
SET
  application_outcome = CASE
    WHEN workflow_stage::text = 'withdrawn' THEN 'withdrawn'::public.application_outcome
    WHEN workflow_stage::text = 'rejected' THEN 'rejected'::public.application_outcome
    ELSE 'active'::public.application_outcome
  END,
  assessment_result = CASE
    WHEN workflow_stage::text IN ('offer_issued', 'payment_pending', 'coe_issued', 'visa_applied') THEN 'pass'::public.assessment_result
    ELSE COALESCE(assessment_result, 'pending'::public.assessment_result)
  END,
  evaluation_started_at = CASE
    WHEN workflow_stage::text IN ('rto_processing', 'offer_issued', 'payment_pending', 'coe_issued', 'visa_applied')
      THEN COALESCE(evaluation_started_at, workflow_stage_updated_at, updated_at, now())
    ELSE evaluation_started_at
  END,
  assessment_result_at = CASE
    WHEN workflow_stage::text IN ('offer_issued', 'payment_pending', 'coe_issued', 'visa_applied')
      THEN COALESCE(assessment_result_at, workflow_stage_updated_at, updated_at, now())
    ELSE assessment_result_at
  END;

UPDATE public.applications
SET workflow_stage = CASE workflow_stage::text
  WHEN 'rto_processing' THEN 'evaluate'::public.workflow_stage
  WHEN 'offer_issued' THEN 'dispatch'::public.workflow_stage
  WHEN 'payment_pending' THEN 'dispatch'::public.workflow_stage
  WHEN 'coe_issued' THEN 'dispatch'::public.workflow_stage
  WHEN 'visa_applied' THEN 'dispatch'::public.workflow_stage
  WHEN 'withdrawn' THEN 'completed'::public.workflow_stage
  WHEN 'rejected' THEN 'completed'::public.workflow_stage
  ELSE workflow_stage
END
WHERE workflow_stage::text IN (
  'rto_processing',
  'offer_issued',
  'payment_pending',
  'coe_issued',
  'visa_applied',
  'withdrawn',
  'rejected'
);

UPDATE public.workflow_assignments
SET stage = CASE stage
  WHEN 'rto_processing' THEN 'evaluate'
  WHEN 'offer_issued' THEN 'dispatch'
  WHEN 'payment_pending' THEN 'dispatch'
  WHEN 'coe_issued' THEN 'dispatch'
  WHEN 'visa_applied' THEN 'dispatch'
  WHEN 'withdrawn' THEN 'completed'
  WHEN 'rejected' THEN 'completed'
  ELSE stage
END
WHERE stage IN (
  'rto_processing',
  'offer_issued',
  'payment_pending',
  'coe_issued',
  'visa_applied',
  'withdrawn',
  'rejected'
);

UPDATE public.workflow_transition_events
SET
  from_stage = CASE from_stage
    WHEN 'rto_processing' THEN 'evaluate'
    WHEN 'offer_issued' THEN 'dispatch'
    WHEN 'payment_pending' THEN 'dispatch'
    WHEN 'coe_issued' THEN 'dispatch'
    WHEN 'visa_applied' THEN 'dispatch'
    WHEN 'withdrawn' THEN 'completed'
    WHEN 'rejected' THEN 'completed'
    ELSE from_stage
  END,
  to_stage = CASE to_stage
    WHEN 'rto_processing' THEN 'evaluate'
    WHEN 'offer_issued' THEN 'dispatch'
    WHEN 'payment_pending' THEN 'dispatch'
    WHEN 'coe_issued' THEN 'dispatch'
    WHEN 'visa_applied' THEN 'dispatch'
    WHEN 'withdrawn' THEN 'completed'
    WHEN 'rejected' THEN 'completed'
    ELSE to_stage
  END
WHERE from_stage IN ('rto_processing', 'offer_issued', 'payment_pending', 'coe_issued', 'visa_applied', 'withdrawn', 'rejected')
   OR to_stage IN ('rto_processing', 'offer_issued', 'payment_pending', 'coe_issued', 'visa_applied', 'withdrawn', 'rejected');

UPDATE public.workflow_transition_approvals
SET
  from_stage = CASE from_stage
    WHEN 'rto_processing' THEN 'evaluate'
    WHEN 'offer_issued' THEN 'dispatch'
    WHEN 'payment_pending' THEN 'dispatch'
    WHEN 'coe_issued' THEN 'dispatch'
    WHEN 'visa_applied' THEN 'dispatch'
    WHEN 'withdrawn' THEN 'completed'
    WHEN 'rejected' THEN 'completed'
    ELSE from_stage
  END,
  to_stage = CASE to_stage
    WHEN 'rto_processing' THEN 'evaluate'
    WHEN 'offer_issued' THEN 'dispatch'
    WHEN 'payment_pending' THEN 'dispatch'
    WHEN 'coe_issued' THEN 'dispatch'
    WHEN 'visa_applied' THEN 'dispatch'
    WHEN 'withdrawn' THEN 'completed'
    WHEN 'rejected' THEN 'completed'
    ELSE to_stage
  END
WHERE from_stage IN ('rto_processing', 'offer_issued', 'payment_pending', 'coe_issued', 'visa_applied', 'withdrawn', 'rejected')
   OR to_stage IN ('rto_processing', 'offer_issued', 'payment_pending', 'coe_issued', 'visa_applied', 'withdrawn', 'rejected');

UPDATE public.application_history
SET
  from_stage = CASE from_stage
    WHEN 'rto_processing' THEN 'evaluate'
    WHEN 'offer_issued' THEN 'dispatch'
    WHEN 'payment_pending' THEN 'dispatch'
    WHEN 'coe_issued' THEN 'dispatch'
    WHEN 'visa_applied' THEN 'dispatch'
    WHEN 'withdrawn' THEN 'completed'
    WHEN 'rejected' THEN 'completed'
    ELSE from_stage
  END,
  to_stage = CASE to_stage
    WHEN 'rto_processing' THEN 'evaluate'
    WHEN 'offer_issued' THEN 'dispatch'
    WHEN 'payment_pending' THEN 'dispatch'
    WHEN 'coe_issued' THEN 'dispatch'
    WHEN 'visa_applied' THEN 'dispatch'
    WHEN 'withdrawn' THEN 'completed'
    WHEN 'rejected' THEN 'completed'
    ELSE to_stage
  END
WHERE from_stage IN ('rto_processing', 'offer_issued', 'payment_pending', 'coe_issued', 'visa_applied', 'withdrawn', 'rejected')
   OR to_stage IN ('rto_processing', 'offer_issued', 'payment_pending', 'coe_issued', 'visa_applied', 'withdrawn', 'rejected');

DELETE FROM public.workflow_transitions;

INSERT INTO public.workflow_transitions (
  from_stage,
  to_stage,
  is_allowed,
  requires_approval,
  required_role,
  allowed_roles
)
VALUES
  ('draft', 'submitted', true, false, null, ARRAY['frontdesk', 'admin', 'executive_manager', 'agent', 'developer', 'ceo']::text[]),
  ('submitted', 'docs_review', true, false, null, ARRAY['frontdesk', 'admin', 'executive_manager', 'developer', 'ceo']::text[]),
  ('docs_review', 'enrolled', true, false, 'admin', ARRAY['admin', 'agent']::text[]),
  ('enrolled', 'evaluate', true, false, 'assessor', ARRAY['assessor']::text[]),
  ('evaluate', 'dispatch', true, false, 'dispatch_coordinator', ARRAY['dispatch_coordinator', 'admin', 'executive_manager']::text[]),
  ('dispatch', 'completed', true, false, 'dispatch_coordinator', ARRAY['dispatch_coordinator', 'admin', 'executive_manager']::text[])
ON CONFLICT (from_stage, to_stage)
DO UPDATE SET
  is_allowed = EXCLUDED.is_allowed,
  requires_approval = EXCLUDED.requires_approval,
  required_role = EXCLUDED.required_role,
  allowed_roles = EXCLUDED.allowed_roles,
  updated_at = now();

CREATE OR REPLACE VIEW public.valid_workflow_transitions WITH (security_invoker = true) AS
SELECT
  from_stage,
  to_stage,
  requires_approval,
  required_role
FROM public.workflow_transitions
WHERE is_allowed = true
ORDER BY from_stage, to_stage;

CREATE TRIGGER tr_validate_workflow_transition
  BEFORE UPDATE OF workflow_stage ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_application_workflow_transition();

CREATE TRIGGER tr_application_stage_change
  AFTER UPDATE OF workflow_stage ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.log_application_stage_change();

COMMIT;

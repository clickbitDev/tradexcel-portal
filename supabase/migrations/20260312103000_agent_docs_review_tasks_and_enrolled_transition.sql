-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 20260312103000_agent_docs_review_tasks_and_enrolled_transition
-- Purpose: Track mandatory agent Docs Review tasks and allow agent docs_review -> enrolled
-- ============================================

BEGIN;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS agent_applicant_pdf_email_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agent_applicant_pdf_email_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS agent_applicant_pdf_email_completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_references_email_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agent_references_email_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS agent_references_email_completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_enrollment_agreement_uploaded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agent_enrollment_agreement_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS agent_enrollment_agreement_uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_enrollment_agreement_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_executive_manager_notified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agent_executive_manager_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS agent_executive_manager_notified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.workflow_transitions
SET
  is_allowed = true,
  requires_approval = false,
  required_role = 'admin',
  allowed_roles = ARRAY['admin', 'agent']::text[],
  updated_at = now()
WHERE from_stage = 'docs_review'
  AND to_stage = 'enrolled';

INSERT INTO public.workflow_transitions (
  from_stage,
  to_stage,
  is_allowed,
  requires_approval,
  required_role,
  allowed_roles
)
SELECT
  'docs_review',
  'enrolled',
  true,
  false,
  'admin',
  ARRAY['admin', 'agent']::text[]
WHERE NOT EXISTS (
  SELECT 1
  FROM public.workflow_transitions
  WHERE from_stage = 'docs_review'
    AND to_stage = 'enrolled'
);

COMMIT;

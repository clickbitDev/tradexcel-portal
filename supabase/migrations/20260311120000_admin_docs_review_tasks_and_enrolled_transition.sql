-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 20260311120000_admin_docs_review_tasks_and_enrolled_transition
-- Purpose: Track admin Docs Review tasks and allow docs_review -> enrolled
-- ============================================

BEGIN;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS admin_applicant_pdf_email_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_applicant_pdf_email_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_applicant_pdf_email_completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_references_email_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_references_email_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_references_email_completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

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
  'docs_review',
  'enrolled',
  true,
  false,
  'admin',
  ARRAY['admin']::text[]
)
ON CONFLICT (from_stage, to_stage)
DO UPDATE SET
  is_allowed = EXCLUDED.is_allowed,
  requires_approval = EXCLUDED.requires_approval,
  required_role = EXCLUDED.required_role,
  allowed_roles = EXCLUDED.allowed_roles,
  updated_at = now();

COMMIT;

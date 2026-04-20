BEGIN;

-- Normalize existing workflow stage data before rebuilding the enum.
UPDATE public.applications
SET workflow_stage = 'docs_review'::public.workflow_stage,
    workflow_stage_updated_at = now(),
    updated_at = now()
WHERE workflow_stage::text IN ('draft', 'submitted');

UPDATE public.workflow_transition_events
SET from_stage = 'docs_review'
WHERE from_stage IN ('draft', 'submitted');

UPDATE public.workflow_transition_events
SET to_stage = 'docs_review'
WHERE to_stage IN ('draft', 'submitted');

UPDATE public.workflow_transition_approvals
SET from_stage = 'docs_review'
WHERE from_stage IN ('draft', 'submitted');

UPDATE public.workflow_transition_approvals
SET to_stage = 'docs_review'
WHERE to_stage IN ('draft', 'submitted');

UPDATE public.workflow_assignments
SET stage = 'docs_review'
WHERE stage IN ('draft', 'submitted');

UPDATE public.application_history
SET from_stage = 'docs_review'
WHERE from_stage IN ('draft', 'submitted');

UPDATE public.application_history
SET to_stage = 'docs_review'
WHERE to_stage IN ('draft', 'submitted');

UPDATE public.application_history
SET old_value = 'docs_review'
WHERE field_changed = 'workflow_stage'
  AND old_value IN ('draft', 'submitted');

UPDATE public.application_history
SET new_value = 'docs_review'
WHERE field_changed = 'workflow_stage'
  AND new_value IN ('draft', 'submitted');

-- Reset workflow transition rows so removed stages no longer appear in DB state.
DELETE FROM public.workflow_transitions
WHERE from_stage::text IN ('draft', 'submitted')
   OR to_stage::text IN ('draft', 'submitted');

INSERT INTO public.workflow_transitions (
  from_stage,
  to_stage,
  is_allowed,
  requires_approval,
  required_role,
  allowed_roles
)
VALUES
  ('TRANSFERRED', 'docs_review', true, false, 'executive_manager', ARRAY['executive_manager', 'developer', 'ceo']::text[]),
  ('docs_review', 'enrolled', true, false, 'admin', ARRAY['admin', 'agent']::text[]),
  ('enrolled', 'evaluate', true, false, 'assessor', ARRAY['assessor']::text[]),
  ('evaluate', 'accounts', true, false, 'admin', ARRAY['admin', 'developer', 'ceo', 'executive_manager']::text[]),
  ('accounts', 'dispatch', true, false, 'accounts_manager', ARRAY['accounts_manager', 'developer', 'ceo', 'executive_manager']::text[]),
  ('dispatch', 'completed', true, false, 'dispatch_coordinator', ARRAY['dispatch_coordinator', 'admin', 'executive_manager']::text[])
ON CONFLICT (from_stage, to_stage)
DO UPDATE SET
  is_allowed = EXCLUDED.is_allowed,
  requires_approval = EXCLUDED.requires_approval,
  required_role = EXCLUDED.required_role,
  allowed_roles = EXCLUDED.allowed_roles,
  updated_at = now();

-- Rebuild the enum so draft/submitted are removed from the database type itself.
ALTER TABLE public.applications
  ALTER COLUMN workflow_stage DROP DEFAULT;

DO $$
DECLARE
  target record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'workflow_stage'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = 'workflow_stage'
        AND e.enumlabel IN ('draft', 'submitted')
    ) THEN
      CREATE TYPE public.workflow_stage_new AS ENUM (
        'TRANSFERRED',
        'docs_review',
        'rto_processing',
        'offer_issued',
        'payment_pending',
        'coe_issued',
        'visa_applied',
        'enrolled',
        'evaluate',
        'accounts',
        'dispatch',
        'completed',
        'withdrawn',
        'rejected'
      );

      FOR target IN
        SELECT
          n.nspname AS schema_name,
          c.relname AS table_name,
          a.attname AS column_name
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_type t ON t.oid = a.atttypid
        WHERE n.nspname = 'public'
          AND t.typname = 'workflow_stage'
          AND a.attnum > 0
          AND NOT a.attisdropped
      LOOP
        EXECUTE format(
          'ALTER TABLE %I.%I ALTER COLUMN %I TYPE public.workflow_stage_new USING (CASE WHEN %I::text IN (''draft'', ''submitted'') THEN ''docs_review'' ELSE %I::text END)::public.workflow_stage_new',
          target.schema_name,
          target.table_name,
          target.column_name,
          target.column_name,
          target.column_name
        );
      END LOOP;

      DROP TYPE public.workflow_stage;
      ALTER TYPE public.workflow_stage_new RENAME TO workflow_stage;
    END IF;
  END IF;
END $$;

ALTER TABLE public.applications
  ALTER COLUMN workflow_stage SET DEFAULT 'docs_review'::public.workflow_stage;

-- Agents can still update their own applications while they remain in docs_review.
DROP POLICY IF EXISTS "Update applications" ON public.applications;

CREATE POLICY "Update applications" ON public.applications
    FOR UPDATE TO authenticated
    USING (
        public.current_user_role() <> 'agent'::public.user_role
        OR (
            public.current_user_role() = 'agent'::public.user_role
            AND partner_id IN (
                SELECT p.id
                FROM public.partners p
                WHERE p.user_id = auth.uid()
            )
            AND workflow_stage = 'docs_review'::public.workflow_stage
        )
    )
    WITH CHECK (
        public.current_user_role() <> 'agent'::public.user_role
        OR (
            public.current_user_role() = 'agent'::public.user_role
            AND partner_id IN (
                SELECT p.id
                FROM public.partners p
                WHERE p.user_id = auth.uid()
            )
            AND workflow_stage = 'docs_review'::public.workflow_stage
        )
    );

COMMIT;

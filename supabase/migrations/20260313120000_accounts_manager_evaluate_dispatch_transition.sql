-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 20260313120000_accounts_manager_evaluate_dispatch_transition
-- Purpose: Make Accounts Manager the source-of-truth owner for Evaluate -> Dispatch
-- ============================================

BEGIN;

UPDATE public.workflow_transitions
SET
  required_role = 'accounts_manager',
  allowed_roles = ARRAY['accounts_manager']::text[],
  updated_at = now()
WHERE from_stage = 'evaluate'
  AND to_stage = 'dispatch';

COMMIT;

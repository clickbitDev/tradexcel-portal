-- ============================================
-- SHARP FUTURE DATABASE MIGRATION
-- Migration: 20260319070929_admin_accounts_manager_bill_request_task
-- Purpose: Track admin requests to accounts manager for Xero bill creation
-- ============================================

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS admin_accounts_manager_bill_requested BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_accounts_manager_bill_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_accounts_manager_bill_requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.applications.admin_accounts_manager_bill_requested IS 'Whether the assigned admin requested the accounts manager team to create a Xero bill';
COMMENT ON COLUMN public.applications.admin_accounts_manager_bill_requested_at IS 'Timestamp when the assigned admin requested Xero bill creation from the accounts manager team';
COMMENT ON COLUMN public.applications.admin_accounts_manager_bill_requested_by IS 'User who requested Xero bill creation from the accounts manager team';

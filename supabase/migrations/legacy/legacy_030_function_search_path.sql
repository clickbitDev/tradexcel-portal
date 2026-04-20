-- ============================================
-- FUNCTION SEARCH PATH & RLS POLICY FIXES
-- Migration: 030_function_search_path
-- ============================================
-- Fixes Supabase linter warnings:
-- 1. Set search_path on all functions (prevents security issues)
-- 2. Tighten audit partition INSERT policies
-- 3. Revoke public access to materialized view
-- ============================================

-- ============================================
-- 1. FIX FUNCTION SEARCH PATHS
-- ============================================
-- Set search_path = '' to prevent schema injection attacks

ALTER FUNCTION public.unlock_expired_locks() SET search_path = '';
ALTER FUNCTION public.validate_application_transition() SET search_path = '';
ALTER FUNCTION public.cascade_partner_soft_delete() SET search_path = '';
ALTER FUNCTION public.cascade_rto_soft_delete() SET search_path = '';
ALTER FUNCTION public.cascade_application_soft_delete() SET search_path = '';
ALTER FUNCTION public.validate_application_dates() SET search_path = '';
ALTER FUNCTION public.validate_invoice_dates() SET search_path = '';
ALTER FUNCTION public.validate_bill_dates() SET search_path = '';
ALTER FUNCTION public.sync_application_to_student_master() SET search_path = '';
ALTER FUNCTION public.log_to_audit_trail(text, uuid, text, text, text, jsonb, jsonb, text[], text, text) SET search_path = '';
ALTER FUNCTION public.create_audit_partition_if_needed() SET search_path = '';
ALTER FUNCTION public.validate_application_workflow_transition() SET search_path = '';
ALTER FUNCTION public.lock_application(uuid, uuid, interval) SET search_path = '';
ALTER FUNCTION public.unlock_application(uuid, uuid) SET search_path = '';
ALTER FUNCTION public.unlock_expired_application_locks() SET search_path = '';
ALTER FUNCTION public.update_application_payment_status() SET search_path = '';
ALTER FUNCTION public.sync_invoice_payment_to_application() SET search_path = '';
ALTER FUNCTION public.initialize_document_extraction() SET search_path = '';

-- ============================================
-- 2. TIGHTEN AUDIT PARTITION INSERT POLICIES
-- ============================================
-- Change from WITH CHECK (true) to require user_id = auth.uid()

DO $$
DECLARE
    partition_name text;
BEGIN
    FOR partition_name IN 
        SELECT tablename FROM pg_tables 
        WHERE (tablename LIKE 'audit_trail_20%' OR tablename = 'audit_trail_default' OR tablename = 'audit_trail_legacy')
        AND schemaname = 'public'
    LOOP
        -- Drop permissive policy
        EXECUTE format('DROP POLICY IF EXISTS "System can insert partition" ON %I', partition_name);
        EXECUTE format('DROP POLICY IF EXISTS "System can insert audit" ON %I', partition_name);
        
        -- Create restrictive policy (user can only insert their own audit entries)
        EXECUTE format(
            'CREATE POLICY "User can insert own audit" ON %I FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL)',
            partition_name
        );
        
        RAISE NOTICE 'Fixed INSERT policy on %', partition_name;
    END LOOP;
END $$;

-- ============================================
-- 3. RESTRICT MATERIALIZED VIEW ACCESS
-- ============================================
-- Revoke public access to qualification_rto_usage

REVOKE SELECT ON public.qualification_rto_usage FROM anon;
-- Keep access for authenticated users (staff only query this)

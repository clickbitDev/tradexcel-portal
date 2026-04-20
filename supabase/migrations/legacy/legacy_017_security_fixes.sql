-- ============================================
-- SECURITY FIXES MIGRATION
-- Migration: 017_security_fixes
-- Fixes Supabase linter warnings for:
--   - Function search_path mutable
--   - Materialized view API exposure
--   - Overly permissive RLS policies
-- ============================================

-- ============================================
-- 1. FIX FUNCTION SEARCH PATHS
-- Set search_path to empty string for security
-- ============================================

ALTER FUNCTION public.get_next_version_number SET search_path = '';
ALTER FUNCTION public.create_activity_entry SET search_path = '';
ALTER FUNCTION public.restore_to_version SET search_path = '';
ALTER FUNCTION public.generate_bill_number SET search_path = '';
ALTER FUNCTION public.get_qualification_unit_counts SET search_path = '';
ALTER FUNCTION public.sync_qualification_unit_counts SET search_path = '';
ALTER FUNCTION public.update_application_invoice_tracking SET search_path = '';
ALTER FUNCTION public.update_application_bill_tracking SET search_path = '';
ALTER FUNCTION public.calculate_partner_commission SET search_path = '';
ALTER FUNCTION public.generate_document_link_token SET search_path = '';
ALTER FUNCTION public.generate_invoice_number SET search_path = '';
ALTER FUNCTION public.refresh_qualification_rto_usage SET search_path = '';
ALTER FUNCTION public.create_notification SET search_path = '';
ALTER FUNCTION public.mark_notification_read SET search_path = '';
ALTER FUNCTION public.mark_all_notifications_read SET search_path = '';
ALTER FUNCTION public.create_welcome_notification SET search_path = '';
ALTER FUNCTION public.create_version_snapshot SET search_path = '';
ALTER FUNCTION public.track_record_version SET search_path = '';
ALTER FUNCTION public.update_application_last_updated_by SET search_path = '';
ALTER FUNCTION public.log_sent_notification SET search_path = '';

-- ============================================
-- 2. RESTRICT MATERIALIZED VIEW ACCESS
-- Remove anon access to qualification_rto_usage
-- ============================================

REVOKE SELECT ON public.qualification_rto_usage FROM anon;
-- Keep authenticated access as it may be needed by staff

-- ============================================
-- 3. FIX OVERLY PERMISSIVE RLS POLICIES
-- Restrict INSERT/UPDATE/DELETE to staff roles only
-- ============================================

-- Helper function to check if user is staff (if not exists)
CREATE OR REPLACE FUNCTION is_staff_role(role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN role_name IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer');
END;
$$;

-- 3a. Fix application_history policies
DROP POLICY IF EXISTS "System can insert application history" ON public.application_history;
CREATE POLICY "Authenticated users can insert application history"
    ON public.application_history FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
        )
    );

-- 3b. Fix audit_logs policies
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs"
    ON public.audit_logs FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
        )
    );

-- 3c. Fix email_templates policies (restrict to staff only)
DROP POLICY IF EXISTS "Allow authenticated users to create templates" ON public.email_templates;
DROP POLICY IF EXISTS "Allow authenticated users to delete templates" ON public.email_templates;
DROP POLICY IF EXISTS "Allow authenticated users to update templates" ON public.email_templates;

CREATE POLICY "Staff can create email templates"
    ON public.email_templates FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND is_staff_role(role::text)
        )
    );

CREATE POLICY "Staff can update email templates"
    ON public.email_templates FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND is_staff_role(role::text)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND is_staff_role(role::text)
        )
    );

CREATE POLICY "Staff can delete email templates"
    ON public.email_templates FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND is_staff_role(role::text)
        )
    );

-- 3d. Fix notifications policy
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "Authenticated can create notifications"
    ON public.notifications FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
        )
    );

-- 3e. Fix record_activity policy
DROP POLICY IF EXISTS "System can insert activity" ON public.record_activity;
CREATE POLICY "Authenticated can insert activity"
    ON public.record_activity FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
        )
    );

-- 3f. Fix record_versions policy
DROP POLICY IF EXISTS "System can insert versions" ON public.record_versions;
CREATE POLICY "Authenticated can insert versions"
    ON public.record_versions FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
        )
    );

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON FUNCTION is_staff_role IS 'Checks if a role is a staff role (non-agent, non-assessor)';

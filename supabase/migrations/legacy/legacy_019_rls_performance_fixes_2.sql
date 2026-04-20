-- ============================================
-- RLS PERFORMANCE FIXES (Batch 3)
-- Migration: 019_rls_performance_fixes_2
-- ============================================
-- Fixes remaining auth_rls_initplan and multiple_permissive_policies warnings
-- ============================================

-- ============================================
-- 1. FIX EMAIL_TEMPLATES (auth_rls_initplan)
-- Policies: Staff can create/update/delete email templates
-- ============================================

DROP POLICY IF EXISTS "Staff can create email templates" ON email_templates;
DROP POLICY IF EXISTS "Staff can update email templates" ON email_templates;
DROP POLICY IF EXISTS "Staff can delete email templates" ON email_templates;

CREATE POLICY "Staff can create email templates" ON email_templates
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = (SELECT auth.uid())
            AND is_staff_role(role::text)
        )
    );

CREATE POLICY "Staff can update email templates" ON email_templates
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = (SELECT auth.uid())
            AND is_staff_role(role::text)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = (SELECT auth.uid())
            AND is_staff_role(role::text)
        )
    );

CREATE POLICY "Staff can delete email templates" ON email_templates
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = (SELECT auth.uid())
            AND is_staff_role(role::text)
        )
    );

-- ============================================
-- 2. FIX APPLICATION_HISTORY (auth_rls_initplan)
-- Policy: Authenticated users can insert application history
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can insert application history" ON application_history;

CREATE POLICY "Authenticated users can insert application history" ON application_history
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = (SELECT auth.uid())
        )
    );

-- ============================================
-- 3. FIX AUDIT_LOGS (auth_rls_initplan)
-- Policy: Authenticated users can insert audit logs
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_logs;

CREATE POLICY "Authenticated users can insert audit logs" ON audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = (SELECT auth.uid())
        )
    );

-- ============================================
-- 4. FIX NOTIFICATIONS (auth_rls_initplan)
-- Policy: Authenticated can create notifications
-- ============================================

DROP POLICY IF EXISTS "Authenticated can create notifications" ON notifications;

CREATE POLICY "Authenticated can create notifications" ON notifications
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = (SELECT auth.uid())
        )
    );

-- ============================================
-- 5. FIX RECORD_ACTIVITY (auth_rls_initplan)
-- Policy: Authenticated can insert activity
-- ============================================

DROP POLICY IF EXISTS "Authenticated can insert activity" ON record_activity;

CREATE POLICY "Authenticated can insert activity" ON record_activity
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = (SELECT auth.uid())
        )
    );

-- ============================================
-- 6. FIX RECORD_VERSIONS (auth_rls_initplan)
-- Policy: Authenticated can insert versions
-- ============================================

DROP POLICY IF EXISTS "Authenticated can insert versions" ON record_versions;

CREATE POLICY "Authenticated can insert versions" ON record_versions
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = (SELECT auth.uid())
        )
    );

-- ============================================
-- 7. FIX PRICE_VERSIONS (auth_rls_initplan + multiple_permissive_policies)
-- ============================================

DROP POLICY IF EXISTS "Staff can manage price versions" ON price_versions;
DROP POLICY IF EXISTS "Staff can view price versions" ON price_versions;

-- Single SELECT policy
CREATE POLICY "Staff can view price versions" ON price_versions
    FOR SELECT TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- Separate INSERT/UPDATE/DELETE policies
CREATE POLICY "Staff insert price versions" ON price_versions
    FOR INSERT TO authenticated
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff update price versions" ON price_versions
    FOR UPDATE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff delete price versions" ON price_versions
    FOR DELETE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- 8. FIX STUDENT_MASTER (auth_rls_initplan + multiple_permissive_policies)
-- ============================================

DROP POLICY IF EXISTS "Staff can view students" ON student_master;
DROP POLICY IF EXISTS "Staff can manage students" ON student_master;

-- Single SELECT policy
CREATE POLICY "Staff can view students" ON student_master
    FOR SELECT TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- Separate INSERT/UPDATE/DELETE policies
CREATE POLICY "Staff insert students" ON student_master
    FOR INSERT TO authenticated
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff update students" ON student_master
    FOR UPDATE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff delete students" ON student_master
    FOR DELETE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- 9. FIX TICKET_COMMENTS (auth_rls_initplan + multiple_permissive_policies)
-- ============================================

DROP POLICY IF EXISTS "Staff can manage ticket comments" ON ticket_comments;
DROP POLICY IF EXISTS "Users can view ticket comments" ON ticket_comments;

-- Single SELECT policy (consolidated)
CREATE POLICY "View ticket comments" ON ticket_comments
    FOR SELECT TO authenticated
    USING (
        is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid())))
        OR ticket_id IN (
            SELECT id FROM tickets WHERE created_by = (SELECT auth.uid())
        )
    );

-- Separate INSERT/UPDATE/DELETE for staff
CREATE POLICY "Staff insert ticket comments" ON ticket_comments
    FOR INSERT TO authenticated
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff update ticket comments" ON ticket_comments
    FOR UPDATE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff delete ticket comments" ON ticket_comments
    FOR DELETE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- 10. FIX APPLICATIONS (multiple_permissive_policies INSERT/UPDATE)
-- Issue: Agents create + Staff insert both grant INSERT
-- Issue: Agents update + Staff update both grant UPDATE
-- Fix: Consolidate into single policies with combined conditions
-- ============================================

DROP POLICY IF EXISTS "Agents create applications" ON applications;
DROP POLICY IF EXISTS "Staff insert applications" ON applications;
DROP POLICY IF EXISTS "Agents update own draft applications" ON applications;
DROP POLICY IF EXISTS "Staff update applications" ON applications;

-- Consolidated INSERT policy
CREATE POLICY "Insert applications" ON applications
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Staff can insert any
        is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid())))
        -- Agents can insert for their own partner
        OR partner_id IN (SELECT id FROM partners WHERE user_id = (SELECT auth.uid()))
    );

-- Consolidated UPDATE policy
CREATE POLICY "Update applications" ON applications
    FOR UPDATE TO authenticated
    USING (
        -- Staff can update any
        is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid())))
        -- Agents can update their own drafts
        OR (
            partner_id IN (SELECT id FROM partners WHERE user_id = (SELECT auth.uid()))
            AND workflow_stage = 'draft'
        )
    )
    WITH CHECK (
        is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid())))
        OR (
            partner_id IN (SELECT id FROM partners WHERE user_id = (SELECT auth.uid()))
            AND workflow_stage = 'draft'
        )
    );

-- Keep delete for staff only
-- (Staff delete applications policy should still exist from migration 018)

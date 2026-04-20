-- ============================================
-- RLS PERFORMANCE OPTIMIZATION
-- Migration: 013_rls_performance_fixes
-- ============================================
-- Fixes auth_rls_initplan warnings by wrapping auth.uid() in subselects
-- Fixes multiple_permissive_policies by consolidating redundant policies

-- ============================================
-- PROFILES TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Recreate with optimized auth calls
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Admins can update any profile" ON profiles
    FOR UPDATE TO authenticated
    USING (is_admin_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = (SELECT auth.uid()));

-- ============================================
-- QUALIFICATIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Manage qualifications" ON qualifications;
DROP POLICY IF EXISTS "Read qualifications" ON qualifications;
DROP POLICY IF EXISTS "Authenticated users read qualifications" ON qualifications;

-- Consolidated: Single read policy (public read)
CREATE POLICY "Read qualifications" ON qualifications
    FOR SELECT TO authenticated
    USING (true);

-- Manage policy with optimized auth
CREATE POLICY "Staff manage qualifications" ON qualifications
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- RTOS TABLE
-- ============================================
DROP POLICY IF EXISTS "Manage rtos" ON rtos;
DROP POLICY IF EXISTS "Read rtos" ON rtos;
DROP POLICY IF EXISTS "Authenticated users read rtos" ON rtos;

-- Consolidated: Single read policy
CREATE POLICY "Read rtos" ON rtos
    FOR SELECT TO authenticated
    USING (true);

-- Manage policy with optimized auth
CREATE POLICY "Staff manage rtos" ON rtos
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- RTO_OFFERINGS TABLE
-- ============================================
DROP POLICY IF EXISTS "Manage offerings" ON rto_offerings;
DROP POLICY IF EXISTS "Read offerings" ON rto_offerings;
DROP POLICY IF EXISTS "Authenticated users read rto_offerings" ON rto_offerings;

-- Consolidated: Single read policy
CREATE POLICY "Read rto offerings" ON rto_offerings
    FOR SELECT TO authenticated
    USING (true);

-- Manage policy with optimized auth
CREATE POLICY "Staff manage rto offerings" ON rto_offerings
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- PARTNERS TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff read all partners" ON partners;
DROP POLICY IF EXISTS "Agents read own partner" ON partners;
DROP POLICY IF EXISTS "Staff manage partners" ON partners;
DROP POLICY IF EXISTS "Authenticated users read partners" ON partners;

-- Consolidated read policy: Staff sees all, agents see own
CREATE POLICY "Read partners" ON partners
    FOR SELECT TO authenticated
    USING (
        is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid())))
        OR user_id = (SELECT auth.uid())
    );

-- Staff manage policy
CREATE POLICY "Staff manage partners" ON partners
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- APPLICATIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff read all applications" ON applications;
DROP POLICY IF EXISTS "Agents read own applications" ON applications;
DROP POLICY IF EXISTS "Staff manage applications" ON applications;
DROP POLICY IF EXISTS "Agents create applications" ON applications;
DROP POLICY IF EXISTS "Agents update own draft applications" ON applications;

-- Consolidated read policy
CREATE POLICY "Read applications" ON applications
    FOR SELECT TO authenticated
    USING (
        is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid())))
        OR partner_id IN (SELECT id FROM partners WHERE user_id = (SELECT auth.uid()))
    );

-- Staff manage all
CREATE POLICY "Staff manage applications" ON applications
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- Agents can create (INSERT only)
CREATE POLICY "Agents create applications" ON applications
    FOR INSERT TO authenticated
    WITH CHECK (
        NOT is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid())))
        AND partner_id IN (SELECT id FROM partners WHERE user_id = (SELECT auth.uid()))
    );

-- Agents update own drafts
CREATE POLICY "Agents update own draft applications" ON applications
    FOR UPDATE TO authenticated
    USING (
        NOT is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid())))
        AND partner_id IN (SELECT id FROM partners WHERE user_id = (SELECT auth.uid()))
        AND workflow_stage = 'draft'
    )
    WITH CHECK (
        partner_id IN (SELECT id FROM partners WHERE user_id = (SELECT auth.uid()))
        AND workflow_stage = 'draft'
    );

-- ============================================
-- DOCUMENTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff can manage documents" ON documents;

CREATE POLICY "Staff manage documents" ON documents
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- TICKETS TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff can manage tickets" ON tickets;

CREATE POLICY "Staff manage tickets" ON tickets
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- APPLICATION_COMMENTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff can manage application comments" ON application_comments;

CREATE POLICY "Staff manage application comments" ON application_comments
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- APPLICATION_HISTORY TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff can view application history" ON application_history;

CREATE POLICY "Staff view application history" ON application_history
    FOR SELECT TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- AUDIT_LOGS TABLE
-- ============================================
DROP POLICY IF EXISTS "Admin can view audit logs" ON audit_logs;

CREATE POLICY "Admin view audit logs" ON audit_logs
    FOR SELECT TO authenticated
    USING (is_admin_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- PARTNER_CONTACT_HISTORY TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff manage contact history" ON partner_contact_history;
DROP POLICY IF EXISTS "Agents view own contact history" ON partner_contact_history;

-- Consolidated policy
CREATE POLICY "View contact history" ON partner_contact_history
    FOR SELECT TO authenticated
    USING (
        is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid())))
        OR partner_id IN (SELECT id FROM partners WHERE user_id = (SELECT auth.uid()))
    );

CREATE POLICY "Staff manage contact history" ON partner_contact_history
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- PARTNER_REMINDERS TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff manage reminders" ON partner_reminders;

CREATE POLICY "Staff manage reminders" ON partner_reminders
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- DOCUMENT_REQUEST_LINKS TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff manage document links" ON document_request_links;

CREATE POLICY "Staff manage document links" ON document_request_links
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- PARTNER_COMMISSION_RULES TABLE
-- ============================================
DROP POLICY IF EXISTS "Managers manage commission rules" ON partner_commission_rules;
DROP POLICY IF EXISTS "Staff view commission rules" ON partner_commission_rules;

-- Consolidated: Staff can read, managers can manage
CREATE POLICY "Read commission rules" ON partner_commission_rules
    FOR SELECT TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Managers manage commission rules" ON partner_commission_rules
    FOR ALL TO authenticated
    USING (is_manager_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_manager_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- INVOICES TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff can manage invoices" ON invoices;
DROP POLICY IF EXISTS "Agents can view own invoices" ON invoices;

-- Consolidated read policy
CREATE POLICY "Read invoices" ON invoices
    FOR SELECT TO authenticated
    USING (
        is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid())))
        OR partner_id IN (SELECT id FROM partners WHERE user_id = (SELECT auth.uid()))
    );

CREATE POLICY "Staff manage invoices" ON invoices
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- NOTIFICATION_QUEUE TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff can manage notifications" ON notification_queue;

CREATE POLICY "Staff manage notification queue" ON notification_queue
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- NOTIFICATION_LOGS TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff can view notification logs" ON notification_logs;

CREATE POLICY "Staff view notification logs" ON notification_logs
    FOR SELECT TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- SCHEDULED_REMINDERS TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff can manage reminders" ON scheduled_reminders;

CREATE POLICY "Staff manage scheduled reminders" ON scheduled_reminders
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- LEAD_SOURCES TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff can manage lead sources" ON lead_sources;
DROP POLICY IF EXISTS "All can read lead sources" ON lead_sources;

-- Consolidated: Public read, staff manage
CREATE POLICY "Read lead sources" ON lead_sources
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Staff manage lead sources" ON lead_sources
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- ADMIN_IMPERSONATION_LOGS TABLE
-- ============================================
DROP POLICY IF EXISTS "Admin can view impersonation logs" ON admin_impersonation_logs;
DROP POLICY IF EXISTS "Admin can insert impersonation logs" ON admin_impersonation_logs;

CREATE POLICY "Admin view impersonation logs" ON admin_impersonation_logs
    FOR SELECT TO authenticated
    USING (is_admin_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Admin insert impersonation logs" ON admin_impersonation_logs
    FOR INSERT TO authenticated
    WITH CHECK (is_admin_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- WORKFLOW_TRANSITIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Admin can manage workflow transitions" ON workflow_transitions;
DROP POLICY IF EXISTS "All can read workflow transitions" ON workflow_transitions;

-- Consolidated: Public read, admin manage
CREATE POLICY "Read workflow transitions" ON workflow_transitions
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Admin manage workflow transitions" ON workflow_transitions
    FOR ALL TO authenticated
    USING (is_admin_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_admin_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- QUALIFICATION_UNITS TABLE
-- ============================================
DROP POLICY IF EXISTS "Manage qualification units" ON qualification_units;
DROP POLICY IF EXISTS "Read qualification units" ON qualification_units;

-- Consolidated: Public read, staff manage
CREATE POLICY "Read qualification units" ON qualification_units
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Staff manage qualification units" ON qualification_units
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- TGA_SYNC_LOG TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff manage sync logs" ON tga_sync_log;
DROP POLICY IF EXISTS "Read sync logs" ON tga_sync_log;

-- Consolidated
CREATE POLICY "Read tga sync logs" ON tga_sync_log
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Staff manage tga sync logs" ON tga_sync_log
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- RECORD_VERSIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff can view all versions" ON record_versions;

CREATE POLICY "Staff view all versions" ON record_versions
    FOR SELECT TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- RECORD_ACTIVITY TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff can view all activity" ON record_activity;

CREATE POLICY "Staff view all activity" ON record_activity
    FOR SELECT TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

CREATE POLICY "Users view own notifications" ON notifications
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users update own notifications" ON notifications
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================
-- NOTIFICATION_PREFERENCES TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can manage their preferences" ON notification_preferences;

CREATE POLICY "Users manage own preferences" ON notification_preferences
    FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================
-- ASSESSOR_QUALIFICATIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Staff read assessor qualifications" ON assessor_qualifications;
DROP POLICY IF EXISTS "Staff manage assessor qualifications" ON assessor_qualifications;

-- Consolidated
CREATE POLICY "Read assessor qualifications" ON assessor_qualifications
    FOR SELECT TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff manage assessor qualifications" ON assessor_qualifications
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

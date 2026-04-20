-- ============================================
-- RLS PERFORMANCE FIXES (Batch 2)
-- Migration: 018_rls_performance_fixes
-- ============================================
-- Fixes:
--   1. auth_rls_initplan: Wrap auth.uid() in (SELECT ...) for single evaluation
--   2. multiple_permissive_policies: Consolidate redundant policies
-- ============================================

-- ============================================
-- 1. FIX REMINDER_HISTORY (auth_rls_initplan)
-- ============================================

DROP POLICY IF EXISTS "Staff can view reminder history" ON reminder_history;
DROP POLICY IF EXISTS "System can insert reminder history" ON reminder_history;

CREATE POLICY "Staff can view reminder history" ON reminder_history
    FOR SELECT TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "System can insert reminder history" ON reminder_history
    FOR INSERT TO authenticated
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- 2. FIX BILLS TABLE (auth_rls_initplan + multiple_permissive_policies)
-- ============================================
-- Issue: Multiple SELECT policies (manage + view) for authenticated role
-- Fix: Consolidate into single SELECT policy, keep separate ALL for writes

DROP POLICY IF EXISTS "Staff can manage bills" ON bills;
DROP POLICY IF EXISTS "Staff can view bills" ON bills;

-- Single SELECT policy for all staff
CREATE POLICY "Staff can view bills" ON bills
    FOR SELECT TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- INSERT/UPDATE/DELETE for accounts roles only (not SELECT to avoid multiple_permissive_policies)
CREATE POLICY "Staff insert bills" ON bills
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = (SELECT auth.uid()) 
        AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'developer')
    ));

CREATE POLICY "Staff update bills" ON bills
    FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = (SELECT auth.uid()) 
        AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'developer')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = (SELECT auth.uid()) 
        AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'developer')
    ));

CREATE POLICY "Staff delete bills" ON bills
    FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = (SELECT auth.uid()) 
        AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'developer')
    ));

-- ============================================
-- 3. FIX BILL_LINE_ITEMS TABLE (auth_rls_initplan)
-- ============================================

DROP POLICY IF EXISTS "Staff can manage bill line items" ON bill_line_items;

CREATE POLICY "Staff can manage bill line items" ON bill_line_items
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = (SELECT auth.uid()) 
        AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'developer')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = (SELECT auth.uid()) 
        AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'developer')
    ));

-- ============================================
-- 4. FIX INVOICE_LINE_ITEMS TABLE (auth_rls_initplan + multiple_permissive_policies)
-- ============================================
-- Issue: Multiple SELECT policies for authenticated role
-- Fix: Consolidate into single SELECT policy

DROP POLICY IF EXISTS "Staff can manage invoice line items" ON invoice_line_items;
DROP POLICY IF EXISTS "Agents can view own invoice line items" ON invoice_line_items;

-- Single consolidated SELECT policy
CREATE POLICY "View invoice line items" ON invoice_line_items
    FOR SELECT TO authenticated
    USING (
        is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid())))
        OR invoice_id IN (
            SELECT id FROM invoices 
            WHERE partner_id IN (SELECT id FROM partners WHERE user_id = (SELECT auth.uid()))
        )
    );

-- Staff manage (INSERT/UPDATE/DELETE only - not SELECT to avoid multiple_permissive_policies)
CREATE POLICY "Staff insert invoice line items" ON invoice_line_items
    FOR INSERT TO authenticated
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff update invoice line items" ON invoice_line_items
    FOR UPDATE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff delete invoice line items" ON invoice_line_items
    FOR DELETE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- 5. FIX BULK_OPERATIONS TABLE (auth_rls_initplan)
-- ============================================

DROP POLICY IF EXISTS "Staff can manage bulk operations" ON bulk_operations;

CREATE POLICY "Staff can manage bulk operations" ON bulk_operations
    FOR ALL TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- 6. FIX APPLICATIONS TABLE (multiple_permissive_policies)
-- Issue: "Read applications" SELECT + "Staff manage applications" ALL both grant SELECT
-- Fix: Split manage policy into INSERT/UPDATE/DELETE only
-- ============================================

DROP POLICY IF EXISTS "Staff manage applications" ON applications;

CREATE POLICY "Staff insert applications" ON applications
    FOR INSERT TO authenticated
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff update applications" ON applications  
    FOR UPDATE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff delete applications" ON applications
    FOR DELETE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- 7. FIX INVOICES TABLE (multiple_permissive_policies)  
-- Issue: "Read invoices" SELECT + "Staff manage invoices" ALL both grant SELECT
-- Fix: Split manage policy into INSERT/UPDATE/DELETE only
-- ============================================

DROP POLICY IF EXISTS "Staff manage invoices" ON invoices;

CREATE POLICY "Staff insert invoices" ON invoices
    FOR INSERT TO authenticated
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff update invoices" ON invoices
    FOR UPDATE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff delete invoices" ON invoices
    FOR DELETE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- 8. FIX LEAD_SOURCES TABLE (multiple_permissive_policies)
-- Issue: "Read lead sources" SELECT + "Staff manage lead sources" ALL both grant SELECT
-- ============================================

DROP POLICY IF EXISTS "Staff manage lead sources" ON lead_sources;

CREATE POLICY "Staff insert lead sources" ON lead_sources
    FOR INSERT TO authenticated
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff update lead sources" ON lead_sources
    FOR UPDATE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff delete lead sources" ON lead_sources
    FOR DELETE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- 9. FIX PARTNER_COMMISSION_RULES TABLE (multiple_permissive_policies)
-- Issue: "Read commission rules" SELECT + "Managers manage commission rules" ALL both grant SELECT
-- ============================================

DROP POLICY IF EXISTS "Managers manage commission rules" ON partner_commission_rules;

CREATE POLICY "Managers insert commission rules" ON partner_commission_rules
    FOR INSERT TO authenticated
    WITH CHECK (is_manager_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Managers update commission rules" ON partner_commission_rules
    FOR UPDATE TO authenticated
    USING (is_manager_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_manager_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Managers delete commission rules" ON partner_commission_rules
    FOR DELETE TO authenticated
    USING (is_manager_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- 10. FIX PARTNER_CONTACT_HISTORY TABLE (multiple_permissive_policies)
-- Issue: "View contact history" SELECT + "Staff manage contact history" ALL both grant SELECT
-- ============================================

DROP POLICY IF EXISTS "Staff manage contact history" ON partner_contact_history;

CREATE POLICY "Staff insert contact history" ON partner_contact_history
    FOR INSERT TO authenticated
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff update contact history" ON partner_contact_history
    FOR UPDATE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff delete contact history" ON partner_contact_history
    FOR DELETE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- 11. FIX PARTNERS TABLE (multiple_permissive_policies)
-- Issue: "Read partners" SELECT + "Staff manage partners" ALL both grant SELECT
-- ============================================

DROP POLICY IF EXISTS "Staff manage partners" ON partners;

CREATE POLICY "Staff insert partners" ON partners
    FOR INSERT TO authenticated
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff update partners" ON partners
    FOR UPDATE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff delete partners" ON partners
    FOR DELETE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- 12. FIX PROFILES TABLE (multiple_permissive_policies)
-- Issue: "Users can update own profile" + "Admins can update any profile" for UPDATE
-- Fix: Consolidate into single UPDATE policy with combined conditions
-- ============================================

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

CREATE POLICY "Update own or admin update any profile" ON profiles
    FOR UPDATE TO authenticated
    USING (
        id = (SELECT auth.uid())
        OR is_admin_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid())))
    )
    WITH CHECK (
        id = (SELECT auth.uid())
        OR is_admin_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid())))
    );

-- ============================================
-- 13. FIX QUALIFICATION_UNITS TABLE (multiple_permissive_policies)
-- Issue: "Read qualification units" SELECT + "Staff manage qualification units" ALL both grant SELECT
-- ============================================

DROP POLICY IF EXISTS "Staff manage qualification units" ON qualification_units;

CREATE POLICY "Staff insert qualification units" ON qualification_units
    FOR INSERT TO authenticated
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff update qualification units" ON qualification_units
    FOR UPDATE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff delete qualification units" ON qualification_units
    FOR DELETE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- 14. FIX QUALIFICATIONS TABLE (multiple_permissive_policies)
-- Issue: "Read qualifications" SELECT + "Staff manage qualifications" ALL both grant SELECT
-- ============================================

DROP POLICY IF EXISTS "Staff manage qualifications" ON qualifications;

CREATE POLICY "Staff insert qualifications" ON qualifications
    FOR INSERT TO authenticated
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff update qualifications" ON qualifications
    FOR UPDATE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff delete qualifications" ON qualifications
    FOR DELETE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- 15. FIX RTO_OFFERINGS TABLE (multiple_permissive_policies)
-- Issue: "Read rto offerings" SELECT + "Staff manage rto offerings" ALL both grant SELECT
-- ============================================

DROP POLICY IF EXISTS "Staff manage rto offerings" ON rto_offerings;

CREATE POLICY "Staff insert rto offerings" ON rto_offerings
    FOR INSERT TO authenticated
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff update rto offerings" ON rto_offerings
    FOR UPDATE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff delete rto offerings" ON rto_offerings
    FOR DELETE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- 16. FIX RTOS TABLE (multiple_permissive_policies)
-- Issue: "Read rtos" SELECT + "Staff manage rtos" ALL both grant SELECT
-- ============================================

DROP POLICY IF EXISTS "Staff manage rtos" ON rtos;

CREATE POLICY "Staff insert rtos" ON rtos
    FOR INSERT TO authenticated
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff update rtos" ON rtos
    FOR UPDATE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff delete rtos" ON rtos
    FOR DELETE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- 17. FIX TGA_SYNC_LOG TABLE (multiple_permissive_policies)
-- Issue: "Read tga sync logs" SELECT + "Staff manage tga sync logs" ALL both grant SELECT
-- ============================================

DROP POLICY IF EXISTS "Staff manage tga sync logs" ON tga_sync_log;

CREATE POLICY "Staff insert tga sync logs" ON tga_sync_log
    FOR INSERT TO authenticated
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff update tga sync logs" ON tga_sync_log
    FOR UPDATE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Staff delete tga sync logs" ON tga_sync_log
    FOR DELETE TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- 18. FIX WORKFLOW_TRANSITIONS TABLE (multiple_permissive_policies)
-- Issue: "Read workflow transitions" SELECT + "Admin manage workflow transitions" ALL both grant SELECT
-- ============================================

DROP POLICY IF EXISTS "Admin manage workflow transitions" ON workflow_transitions;

CREATE POLICY "Admin insert workflow transitions" ON workflow_transitions
    FOR INSERT TO authenticated
    WITH CHECK (is_admin_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Admin update workflow transitions" ON workflow_transitions
    FOR UPDATE TO authenticated
    USING (is_admin_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))))
    WITH CHECK (is_admin_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

CREATE POLICY "Admin delete workflow transitions" ON workflow_transitions
    FOR DELETE TO authenticated
    USING (is_admin_role((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))));

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE reminder_history IS 'History of partner reminders with optimized RLS';

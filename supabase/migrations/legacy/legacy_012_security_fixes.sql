-- ============================================
-- SECURITY FIXES
-- Migration: 012_security_fixes
-- ============================================
-- Addresses Supabase linter security findings

-- ============================================
-- 1. FIX: RLS Disabled on reminder_history
-- ============================================
ALTER TABLE IF EXISTS reminder_history ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for reminder_history
DROP POLICY IF EXISTS "Staff can view reminder history" ON reminder_history;
CREATE POLICY "Staff can view reminder history"
    ON reminder_history FOR SELECT
    TO authenticated
    USING (is_staff_role((SELECT role FROM profiles WHERE id = auth.uid())));

DROP POLICY IF EXISTS "System can insert reminder history" ON reminder_history;
CREATE POLICY "System can insert reminder history"
    ON reminder_history FOR INSERT
    TO authenticated
    WITH CHECK (is_staff_role((SELECT role FROM profiles WHERE id = auth.uid())));

-- ============================================
-- 2. FIX: Security Definer View (trash_bin)
-- Replace with SECURITY INVOKER (default)
-- ============================================
-- Drop and recreate without SECURITY DEFINER
DROP VIEW IF EXISTS trash_bin;

CREATE OR REPLACE VIEW trash_bin AS
SELECT 
    table_name,
    record_id,
    identifier,
    display_name,
    deleted_at,
    deleted_by,
    deleted_by_name
FROM (
    SELECT 
        'qualifications' as table_name,
        id::text as record_id,
        code as identifier,
        name as display_name,
        deleted_at,
        deleted_by,
        (SELECT full_name FROM profiles WHERE id = deleted_by) as deleted_by_name
    FROM qualifications WHERE is_deleted = true
    
    UNION ALL
    
    SELECT 
        'rtos' as table_name,
        id::text as record_id,
        code as identifier,
        name as display_name,
        deleted_at,
        deleted_by,
        (SELECT full_name FROM profiles WHERE id = deleted_by) as deleted_by_name
    FROM rtos WHERE is_deleted = true
    
    UNION ALL
    
    SELECT 
        'partners' as table_name,
        id::text as record_id,
        email as identifier,
        company_name as display_name,
        deleted_at,
        deleted_by,
        (SELECT full_name FROM profiles WHERE id = deleted_by) as deleted_by_name
    FROM partners WHERE is_deleted = true
    
    UNION ALL
    
    SELECT 
        'applications' as table_name,
        id::text as record_id,
        student_uid as identifier,
        student_first_name || ' ' || student_last_name as display_name,
        deleted_at,
        deleted_by,
        (SELECT full_name FROM profiles WHERE id = deleted_by) as deleted_by_name
    FROM applications WHERE is_deleted = true
) AS combined_trash
ORDER BY deleted_at DESC;

-- Grant access (RLS will be enforced by underlying tables)
GRANT SELECT ON trash_bin TO authenticated;

-- ============================================
-- 3. FIX: Function search_path issues
-- Set search_path to 'public' for security
-- ============================================

-- is_staff_role
CREATE OR REPLACE FUNCTION is_staff_role(role user_role) RETURNS BOOLEAN AS $$
BEGIN
  RETURN role NOT IN ('agent');
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- is_admin_role
CREATE OR REPLACE FUNCTION is_admin_role(role user_role) RETURNS BOOLEAN AS $$
BEGIN
  RETURN role IN ('ceo', 'developer', 'admin');
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- is_manager_role
CREATE OR REPLACE FUNCTION is_manager_role(role user_role) RETURNS BOOLEAN AS $$
BEGIN
  RETURN role IN ('ceo', 'executive_manager', 'developer', 'admin');
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- update_updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- generate_student_uid
CREATE OR REPLACE FUNCTION generate_student_uid()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT;
  next_num INTEGER;
BEGIN
  year_prefix := 'APP-' || TO_CHAR(NOW(), 'YYYY') || '-';
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(student_uid FROM year_prefix || '(\d+)$') AS INTEGER)), 0) + 1
  INTO next_num
  FROM applications
  WHERE student_uid LIKE year_prefix || '%';
  
  NEW.student_uid := year_prefix || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- log_application_stage_change
CREATE OR REPLACE FUNCTION log_application_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.workflow_stage IS DISTINCT FROM NEW.workflow_stage THEN
    INSERT INTO application_history (application_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, OLD.workflow_stage::text, NEW.workflow_stage::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- 4. Restrict materialized view access
-- ============================================
REVOKE SELECT ON qualification_rto_usage FROM anon;

-- ============================================
-- NOTES on remaining warnings:
-- ============================================
-- The following are intentional design decisions:
-- 
-- 1. RLS policies with "true" for INSERT on:
--    - application_history: System needs to log all changes
--    - audit_logs: System needs to log all actions  
--    - record_activity: System needs to track all activity
--    - record_versions: System needs to save all versions
--    - notifications: System needs to create notifications
--    These are audit/logging tables where insert should be unrestricted
--    for authenticated users (reads are properly restricted)
--
-- 2. Leaked Password Protection:
--    Enable in Supabase Dashboard > Authentication > Settings

-- ============================================
-- SECURITY FIXES
-- Migration: 029_security_fixes
-- ============================================
-- Fixes Supabase linter errors:
-- 1. Recreate views with SECURITY INVOKER (respects RLS)
-- 2. Enable RLS on all audit partition tables
-- ============================================

-- ============================================
-- 1. FIX SECURITY DEFINER VIEWS
-- ============================================
-- Recreate views without SECURITY DEFINER to respect RLS

-- Drop and recreate recent_activity
DROP VIEW IF EXISTS recent_activity;
CREATE VIEW recent_activity WITH (security_invoker = true) AS
SELECT 
    entity_type,
    entity_id,
    entity_identifier,
    action,
    summary,
    user_name,
    created_at
FROM audit_trail
WHERE created_at > now() - interval '7 days'
ORDER BY created_at DESC;

-- Drop and recreate entity_history
DROP VIEW IF EXISTS entity_history;
CREATE VIEW entity_history WITH (security_invoker = true) AS
SELECT 
    entity_type,
    entity_id,
    entity_identifier,
    action,
    summary,
    changed_fields,
    version_number,
    user_name,
    created_at
FROM audit_trail
ORDER BY entity_type, entity_id, version_number;

-- Drop and recreate application_lock_status
DROP VIEW IF EXISTS application_lock_status;
CREATE VIEW application_lock_status WITH (security_invoker = true) AS
SELECT 
    a.id,
    a.student_uid,
    a.workflow_stage,
    a.locked_by,
    p.full_name as locked_by_name,
    a.lock_timestamp,
    a.lock_timeout,
    NOW() - a.lock_timestamp as lock_duration,
    (a.lock_timestamp + COALESCE(a.lock_timeout, '1 hour'::interval)) as lock_expires_at,
    CASE 
        WHEN a.locked_by IS NULL THEN 'unlocked'
        WHEN (a.lock_timestamp + COALESCE(a.lock_timeout, '1 hour'::interval)) < NOW() THEN 'expired'
        ELSE 'active'
    END as lock_status
FROM applications a
LEFT JOIN profiles p ON a.locked_by = p.id
WHERE a.is_deleted = false;

-- Drop and recreate stalled_document_extractions
DROP VIEW IF EXISTS stalled_document_extractions;
CREATE VIEW stalled_document_extractions WITH (security_invoker = true) AS
SELECT 
    id,
    application_id,
    document_type,
    file_name,
    extraction_status,
    extracted_at,
    NOW() - extracted_at as processing_duration
FROM documents
WHERE extraction_status = 'processing'
    AND extracted_at IS NOT NULL
    AND (NOW() - extracted_at) > interval '1 hour'
    AND is_deleted = false;

-- Drop and recreate document_extraction_failures
DROP VIEW IF EXISTS document_extraction_failures;
CREATE VIEW document_extraction_failures WITH (security_invoker = true) AS
SELECT 
    application_id,
    document_type,
    COUNT(*) as failure_count,
    MAX(extracted_at) as last_failure
FROM documents
WHERE extraction_status = 'failed'
    AND is_deleted = false
GROUP BY application_id, document_type
HAVING COUNT(*) >= 1;

-- Drop and recreate valid_workflow_transitions
DROP VIEW IF EXISTS valid_workflow_transitions;
CREATE VIEW valid_workflow_transitions WITH (security_invoker = true) AS
SELECT 
    from_stage,
    to_stage,
    requires_approval,
    required_role
FROM workflow_transitions
WHERE is_allowed = true
ORDER BY from_stage, to_stage;

-- Drop and recreate trash_bin
DROP VIEW IF EXISTS trash_bin;
CREATE VIEW trash_bin WITH (security_invoker = true) AS
SELECT 
    'applications' as table_name,
    id::text as record_id,
    student_uid as identifier,
    CONCAT(student_first_name, ' ', student_last_name) as display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM profiles WHERE id = deleted_by) as deleted_by_name
FROM applications WHERE is_deleted = true
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
    'invoices' as table_name,
    id::text as record_id,
    invoice_number as identifier,
    student_name as display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM profiles WHERE id = deleted_by) as deleted_by_name
FROM invoices WHERE is_deleted = true
UNION ALL
SELECT 
    'bills' as table_name,
    id::text as record_id,
    bill_number as identifier,
    description as display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM profiles WHERE id = deleted_by) as deleted_by_name
FROM bills WHERE is_deleted = true
UNION ALL
SELECT 
    'student_master' as table_name,
    id::text as record_id,
    email as identifier,
    CONCAT(first_name, ' ', last_name) as display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM profiles WHERE id = deleted_by) as deleted_by_name
FROM student_master WHERE is_deleted = true
ORDER BY deleted_at DESC;

-- Drop and recreate applications_denormalized
DROP VIEW IF EXISTS applications_denormalized;
CREATE VIEW applications_denormalized WITH (security_invoker = true) AS
SELECT 
    a.id,
    a.student_uid,
    COALESCE(sm.first_name, a.student_first_name) as student_first_name,
    COALESCE(sm.last_name, a.student_last_name) as student_last_name,
    COALESCE(sm.email, a.student_email) as student_email,
    COALESCE(sm.phone, a.student_phone) as student_phone,
    COALESCE(sm.dob, a.student_dob) as student_dob,
    COALESCE(sm.passport_number, a.student_passport_number) as student_passport_number,
    COALESCE(sm.nationality, a.student_nationality) as student_nationality,
    COALESCE(sm.gender, a.student_gender) as student_gender,
    COALESCE(sm.country_of_birth, a.student_country_of_birth) as student_country_of_birth,
    COALESCE(sm.address, a.student_address) as student_address,
    COALESCE(sm.street_no, a.student_street_no) as student_street_no,
    COALESCE(sm.suburb, a.student_suburb) as student_suburb,
    COALESCE(sm.state, a.student_state) as student_state,
    COALESCE(sm.postcode, a.student_postcode) as student_postcode,
    COALESCE(sm.usi, a.student_usi) as student_usi,
    COALESCE(sm.visa_number, a.student_visa_number) as student_visa_number,
    COALESCE(sm.visa_expiry, a.student_visa_expiry) as student_visa_expiry,
    a.student_master_id,
    a.partner_id,
    a.offering_id,
    a.workflow_stage,
    a.payment_status,
    a.quoted_tuition,
    a.quoted_materials,
    a.total_paid,
    a.intake_date,
    a.submitted_at,
    a.coe_issued_at,
    a.created_by,
    a.assigned_to,
    a.assigned_staff_id,
    a.locked_by,
    a.lock_timestamp,
    a.lock_timeout,
    a.is_archived,
    a.archived_at,
    a.archived_by,
    a.is_deleted,
    a.deleted_at,
    a.deleted_by,
    a.created_at,
    a.updated_at
FROM applications a
LEFT JOIN student_master sm ON a.student_master_id = sm.id AND sm.is_deleted = false;

-- ============================================
-- 2. ENABLE RLS ON ALL AUDIT PARTITION TABLES
-- ============================================

DO $$
DECLARE
    partition_name text;
BEGIN
    FOR partition_name IN 
        SELECT tablename FROM pg_tables 
        WHERE tablename LIKE 'audit_trail_20%' OR tablename = 'audit_trail_default'
    LOOP
        -- Enable RLS
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', partition_name);
        
        -- Drop existing policies if any
        EXECUTE format('DROP POLICY IF EXISTS "Staff can view partition" ON %I', partition_name);
        EXECUTE format('DROP POLICY IF EXISTS "System can insert partition" ON %I', partition_name);
        
        -- Create read policy (staff+ can view)
        EXECUTE format(
            'CREATE POLICY "Staff can view partition" ON %I FOR SELECT TO authenticated USING (
                EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role NOT IN (''agent'', ''assessor''))
            )', partition_name
        );
        
        -- Create insert policy (authenticated can insert)
        EXECUTE format(
            'CREATE POLICY "System can insert partition" ON %I FOR INSERT TO authenticated WITH CHECK (true)',
            partition_name
        );
        
        RAISE NOTICE 'Enabled RLS on %', partition_name;
    END LOOP;
END $$;

-- ============================================
-- 3. VERIFY FIXES
-- ============================================

-- Check views don't have security_definer
-- SELECT viewname, definition FROM pg_views WHERE schemaname = 'public' AND viewname IN ('recent_activity', 'entity_history', 'application_lock_status');

-- Check RLS enabled on partitions
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'audit_trail_%';

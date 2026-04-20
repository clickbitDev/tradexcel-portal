-- ============================================
-- SCHEMA INTEGRITY FIXES
-- Migration: 021_schema_integrity
-- ============================================
-- Addresses issues from schema analysis report:
-- - Soft-delete for student_master
-- - Document parent constraint
-- - Payment validation constraints
-- - Application lock timeout
-- - JSONB GIN indexes
-- ============================================

-- ============================================
-- 1. SOFT-DELETE FOR STUDENT_MASTER (Issue 1.2)
-- ============================================

ALTER TABLE student_master ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id);

-- Add index for soft-delete queries
CREATE INDEX IF NOT EXISTS idx_student_master_deleted 
    ON student_master(is_deleted) WHERE is_deleted = false;

-- Add FK index for deleted_by
CREATE INDEX IF NOT EXISTS idx_student_master_deleted_by 
    ON student_master(deleted_by);

-- ============================================
-- 2. DOCUMENT PARENT CONSTRAINT (Issue 2.1)
-- ============================================
-- Ensures documents have at least one parent (application OR partner)

ALTER TABLE documents DROP CONSTRAINT IF EXISTS document_has_parent;
ALTER TABLE documents ADD CONSTRAINT document_has_parent CHECK (
    application_id IS NOT NULL OR partner_id IS NOT NULL
);

-- ============================================
-- 3. PAYMENT VALIDATION CONSTRAINTS (Issue 4.1)
-- ============================================

-- NOTE: If existing data violates this, fix it first:
-- ALTER TABLE applications DISABLE TRIGGER tr_applications_version;
-- UPDATE applications SET quoted_tuition = total_paid 
--   WHERE total_paid > quoted_tuition AND total_paid IS NOT NULL AND quoted_tuition IS NOT NULL;
-- ALTER TABLE applications ENABLE TRIGGER tr_applications_version;

-- Prevent overpayment (allow NULLs for incomplete data)
ALTER TABLE applications DROP CONSTRAINT IF EXISTS payment_not_exceeded;
ALTER TABLE applications ADD CONSTRAINT payment_not_exceeded CHECK (
    total_paid IS NULL OR quoted_tuition IS NULL OR total_paid <= quoted_tuition
);

-- Ensure non-negative amounts
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoice_amount_valid;
ALTER TABLE invoices ADD CONSTRAINT invoice_amount_valid CHECK (
    total_amount >= 0
);

ALTER TABLE bills DROP CONSTRAINT IF EXISTS bill_amount_valid;
ALTER TABLE bills ADD CONSTRAINT bill_amount_valid CHECK (
    total_amount >= 0
);

-- Line item validation
ALTER TABLE invoice_line_items DROP CONSTRAINT IF EXISTS invoice_line_item_valid;
ALTER TABLE invoice_line_items ADD CONSTRAINT invoice_line_item_valid CHECK (
    quantity > 0 AND unit_price >= 0 AND total >= 0
);

ALTER TABLE bill_line_items DROP CONSTRAINT IF EXISTS bill_line_item_valid;
ALTER TABLE bill_line_items ADD CONSTRAINT bill_line_item_valid CHECK (
    quantity > 0 AND unit_price >= 0 AND total >= 0
);

-- ============================================
-- 4. APPLICATION LOCK TIMEOUT (Issue 2.2)
-- ============================================

-- Add configurable lock timeout column
ALTER TABLE applications ADD COLUMN IF NOT EXISTS lock_timeout interval DEFAULT '1 hour';

-- Function to unlock expired locks
CREATE OR REPLACE FUNCTION unlock_expired_locks()
RETURNS integer AS $$
DECLARE 
    unlocked_count integer;
BEGIN
    UPDATE applications
    SET locked_by = NULL, 
        lock_timestamp = NULL
    WHERE locked_by IS NOT NULL 
      AND lock_timestamp IS NOT NULL
      AND (lock_timestamp + COALESCE(lock_timeout, '1 hour'::interval)) < now();
    
    GET DIAGNOSTICS unlocked_count = ROW_COUNT;
    RETURN unlocked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment for documentation
COMMENT ON FUNCTION unlock_expired_locks() IS 
    'Unlocks applications where lock has expired. Call periodically via pg_cron or API.';

-- ============================================
-- 5. JSONB GIN INDEXES (Issue 3.2)
-- ============================================

-- Index for document extraction queries
CREATE INDEX IF NOT EXISTS idx_documents_extracted_data_gin 
    ON documents USING GIN(extracted_data);

-- Index for scheduled reminder trigger config queries
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_trigger_config_gin 
    ON scheduled_reminders USING GIN(trigger_config);

-- ============================================
-- 6. UPDATE TRASH_BIN VIEW (include student_master)
-- ============================================

DROP VIEW IF EXISTS trash_bin;

CREATE VIEW trash_bin AS
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

-- ============================================
-- 7. VERSION TRACKING FOR STUDENT_MASTER
-- ============================================

DROP TRIGGER IF EXISTS tr_student_master_version ON student_master;
CREATE TRIGGER tr_student_master_version
    AFTER INSERT OR UPDATE ON student_master
    FOR EACH ROW
    EXECUTE FUNCTION track_record_version();

-- Update timestamp trigger
DROP TRIGGER IF EXISTS update_student_master_timestamp ON student_master;
CREATE TRIGGER update_student_master_timestamp 
    BEFORE UPDATE ON student_master 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at();

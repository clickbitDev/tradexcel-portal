-- ============================================
-- ADDITIONAL INDEXES & CONSTRAINTS
-- Migration: 027_additional_indexes
-- ============================================
-- Addresses remaining Phase 1 items from schema review:
-- - Composite indexes for common query patterns
-- - Additional payment validation constraints
-- - Audit FK to partitioned tables
-- - Soft-delete aware indexes
-- ============================================

-- ============================================
-- 1. COMPOSITE INDEXES FOR QUERY PATTERNS
-- ============================================

-- Applications: workflow + created_at (filtered by is_deleted)
CREATE INDEX IF NOT EXISTS idx_applications_workflow_created 
  ON applications(workflow_stage, created_at DESC) 
  WHERE is_deleted = false;

-- Applications: partner + workflow (filtered by is_deleted)
CREATE INDEX IF NOT EXISTS idx_applications_partner_status
  ON applications(partner_id, workflow_stage)
  WHERE is_deleted = false;

-- Invoices: partner + status + date (filtered)
CREATE INDEX IF NOT EXISTS idx_invoices_partner_status_date
  ON invoices(partner_id, status, created_at DESC)
  WHERE is_deleted = false;

-- Bills: RTO + status + date (filtered)
CREATE INDEX IF NOT EXISTS idx_bills_rto_status_date
  ON bills(rto_id, status, created_at DESC)
  WHERE is_deleted = false;

-- ============================================
-- 2. ADDITIONAL SINGLE-COLUMN INDEXES
-- ============================================

-- Applications: workflow_stage and payment_status (if not exists)
CREATE INDEX IF NOT EXISTS idx_applications_workflow_stage ON applications(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_applications_payment_status ON applications(payment_status);
CREATE INDEX IF NOT EXISTS idx_applications_student_email ON applications(student_email);
CREATE INDEX IF NOT EXISTS idx_applications_lead_source_id ON applications(lead_source_id);

-- Documents: extraction_status
CREATE INDEX IF NOT EXISTS idx_documents_extraction_status ON documents(extraction_status);

-- Notification queue: scheduled_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_at ON notification_queue(scheduled_at);

-- Partner commission rules
CREATE INDEX IF NOT EXISTS idx_partner_commission_rules_partner_id ON partner_commission_rules(partner_id);

-- Assessor qualifications
CREATE INDEX IF NOT EXISTS idx_assessor_qualifications_assessor_id ON assessor_qualifications(assessor_id);

-- ============================================
-- 3. SOFT-DELETE AWARE INDEXES
-- ============================================
-- Speed up queries filtered by is_deleted = false

CREATE INDEX IF NOT EXISTS idx_applications_not_deleted 
  ON applications(id) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_documents_not_deleted 
  ON documents(id) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_invoices_not_deleted 
  ON invoices(id) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_bills_not_deleted 
  ON bills(id) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_partners_not_deleted 
  ON partners(id) WHERE is_deleted = false;

-- ============================================
-- 4. ADDITIONAL PAYMENT VALIDATION CONSTRAINTS
-- ============================================

-- Check if data violates before adding constraints
DO $$
DECLARE
  violation_count integer;
BEGIN
  -- Check for line item calculation mismatches
  SELECT COUNT(*) INTO violation_count 
  FROM invoice_line_items 
  WHERE total != quantity * unit_price;
  
  IF violation_count > 0 THEN
    RAISE NOTICE 'Found % invoice_line_items with mismatched totals, fixing...', violation_count;
    UPDATE invoice_line_items SET total = quantity * unit_price WHERE total != quantity * unit_price;
  END IF;
  
  SELECT COUNT(*) INTO violation_count 
  FROM bill_line_items 
  WHERE total != quantity * unit_price;
  
  IF violation_count > 0 THEN
    RAISE NOTICE 'Found % bill_line_items with mismatched totals, fixing...', violation_count;
    UPDATE bill_line_items SET total = quantity * unit_price WHERE total != quantity * unit_price;
  END IF;
END $$;

-- Line item total calculation constraints
ALTER TABLE invoice_line_items DROP CONSTRAINT IF EXISTS invoice_line_items_total_calculation;
ALTER TABLE invoice_line_items ADD CONSTRAINT invoice_line_items_total_calculation CHECK (
  total = quantity * unit_price
);

ALTER TABLE bill_line_items DROP CONSTRAINT IF EXISTS bill_line_items_total_calculation;
ALTER TABLE bill_line_items ADD CONSTRAINT bill_line_items_total_calculation CHECK (
  total = quantity * unit_price
);

-- Non-negative amounts in applications
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_quoted_amounts_nonnegative;
ALTER TABLE applications ADD CONSTRAINT applications_quoted_amounts_nonnegative CHECK (
  COALESCE(quoted_tuition, 0) >= 0 AND COALESCE(quoted_materials, 0) >= 0
);

ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_total_paid_nonnegative;
ALTER TABLE applications ADD CONSTRAINT applications_total_paid_nonnegative CHECK (
  COALESCE(total_paid, 0) >= 0
);

-- ============================================
-- 5. AUDIT TRAIL FK CONSTRAINT FOR PARTITIONS
-- ============================================

-- Add FK to all existing partitions
DO $$
DECLARE
  partition_name text;
  constraint_name text;
BEGIN
  FOR partition_name IN 
    SELECT tablename FROM pg_tables 
    WHERE tablename LIKE 'audit_trail_20%' OR tablename = 'audit_trail_default'
  LOOP
    constraint_name := partition_name || '_user_id_fkey';
    
    -- Check if constraint already exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = constraint_name
    ) THEN
      BEGIN
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES public.profiles(id)',
          partition_name, constraint_name
        );
        RAISE NOTICE 'Added FK constraint to %', partition_name;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add FK to %: %', partition_name, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 6. FIX DOCUMENT PARENT CONSTRAINT
-- ============================================
-- Allow documents to belong to BOTH application AND partner (edge case)
-- Current constraint requires XOR, changing to require at least one

ALTER TABLE documents DROP CONSTRAINT IF EXISTS document_has_parent;
ALTER TABLE documents ADD CONSTRAINT document_has_parent CHECK (
  application_id IS NOT NULL OR partner_id IS NOT NULL
);

-- ============================================
-- 7. ADDITIONAL JSONB EXPRESSION INDEXES
-- ============================================

-- Extracted data document type (if frequently queried)
CREATE INDEX IF NOT EXISTS idx_documents_extracted_doc_type 
  ON documents((extracted_data->>'document_type'))
  WHERE extracted_data IS NOT NULL;

-- Audit trail entity type from new_data
CREATE INDEX IF NOT EXISTS idx_audit_trail_new_data_entity 
  ON audit_trail((new_data->>'entity_type'))
  WHERE new_data IS NOT NULL;

-- ============================================
-- 8. BILLS TOTAL CALCULATION CONSTRAINT
-- ============================================

-- First fix any violations
DO $$
DECLARE
  violation_count integer;
BEGIN
  SELECT COUNT(*) INTO violation_count 
  FROM bills 
  WHERE total_amount != COALESCE(tuition_cost, 0) + COALESCE(material_cost, 0) + COALESCE(other_costs, 0);
  
  IF violation_count > 0 THEN
    RAISE NOTICE 'Found % bills with mismatched totals, fixing...', violation_count;
    UPDATE bills 
    SET total_amount = COALESCE(tuition_cost, 0) + COALESCE(material_cost, 0) + COALESCE(other_costs, 0)
    WHERE total_amount != COALESCE(tuition_cost, 0) + COALESCE(material_cost, 0) + COALESCE(other_costs, 0);
  END IF;
END $$;

ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_total_calculation;
ALTER TABLE bills ADD CONSTRAINT bills_total_calculation CHECK (
  total_amount = COALESCE(tuition_cost, 0) + COALESCE(material_cost, 0) + COALESCE(other_costs, 0)
);

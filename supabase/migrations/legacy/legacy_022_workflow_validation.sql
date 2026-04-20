-- ============================================
-- WORKFLOW VALIDATION & PARTNER CONSTRAINTS
-- Migration: 022_workflow_validation
-- ============================================
-- Addresses remaining Phase 2 items:
-- - Workflow transition validation trigger
-- - Partner company/email uniqueness
-- ============================================

-- ============================================
-- 1. FIX DUPLICATE PARTNERS BEFORE CONSTRAINT
-- ============================================
-- Merge duplicate partners (same company_name + email)
-- Keep the first one, update references, delete duplicates

DO $$
DECLARE
    dup_record RECORD;
    keep_id uuid;
    delete_ids uuid[];
BEGIN
    FOR dup_record IN 
        SELECT company_name, email 
        FROM partners 
        GROUP BY company_name, email 
        HAVING COUNT(*) > 1
    LOOP
        -- Get the ID to keep (first created)
        SELECT id INTO keep_id 
        FROM partners 
        WHERE company_name = dup_record.company_name 
          AND (email = dup_record.email OR (email IS NULL AND dup_record.email IS NULL))
        ORDER BY created_at ASC 
        LIMIT 1;
        
        -- Get IDs to delete
        SELECT array_agg(id) INTO delete_ids
        FROM partners 
        WHERE company_name = dup_record.company_name 
          AND (email = dup_record.email OR (email IS NULL AND dup_record.email IS NULL))
          AND id != keep_id;
        
        -- Update references in related tables
        UPDATE applications SET partner_id = keep_id WHERE partner_id = ANY(delete_ids);
        UPDATE invoices SET partner_id = keep_id WHERE partner_id = ANY(delete_ids);
        UPDATE documents SET partner_id = keep_id WHERE partner_id = ANY(delete_ids);
        UPDATE notification_queue SET partner_id = keep_id WHERE partner_id = ANY(delete_ids);
        UPDATE tickets SET partner_id = keep_id WHERE partner_id = ANY(delete_ids);
        
        -- Soft-delete the duplicates
        UPDATE partners 
        SET is_deleted = true, deleted_at = now() 
        WHERE id = ANY(delete_ids);
        
        RAISE NOTICE 'Merged % duplicate partners into %', array_length(delete_ids, 1), keep_id;
    END LOOP;
END $$;

-- ============================================
-- 2. PARTNER UNIQUENESS CONSTRAINT
-- ============================================
-- Note: Excludes soft-deleted records

CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_company_email_unique 
    ON partners(company_name, COALESCE(email, ''))
    WHERE is_deleted = false;

-- ============================================
-- 3. WORKFLOW TRANSITION VALIDATION TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION validate_application_transition()
RETURNS TRIGGER AS $$
DECLARE
    valid_transition boolean;
    transition_record RECORD;
BEGIN
    -- Only validate if workflow_stage is changing
    IF NEW.workflow_stage IS NOT DISTINCT FROM OLD.workflow_stage THEN
        RETURN NEW;
    END IF;
    
    -- Allow transition from NULL (new records)
    IF OLD.workflow_stage IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Check if transition is valid
    SELECT EXISTS(
        SELECT 1 FROM workflow_transitions
        WHERE from_stage = OLD.workflow_stage::text
          AND to_stage = NEW.workflow_stage::text
          AND is_allowed = true
    ) INTO valid_transition;
    
    IF NOT valid_transition THEN
        -- Log the invalid attempt but allow it with a warning
        -- This prevents breaking existing flows while alerting about invalid transitions
        RAISE WARNING 'Potentially invalid workflow transition: % → % for application %', 
            OLD.workflow_stage, NEW.workflow_stage, NEW.id;
        
        -- Create activity entry for audit
        INSERT INTO record_activity (table_name, record_id, action, summary, user_id)
        VALUES (
            'applications',
            NEW.id,
            'invalid_transition_warning',
            format('Workflow transition from %s to %s may not be valid', OLD.workflow_stage, NEW.workflow_stage),
            auth.uid()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger (BEFORE to allow modification)
DROP TRIGGER IF EXISTS tr_validate_workflow_transition ON applications;
CREATE TRIGGER tr_validate_workflow_transition
    BEFORE UPDATE OF workflow_stage ON applications
    FOR EACH ROW
    EXECUTE FUNCTION validate_application_transition();

-- ============================================
-- 4. HELPER VIEW: VALID TRANSITIONS
-- ============================================

CREATE OR REPLACE VIEW valid_workflow_transitions AS
SELECT 
    from_stage,
    to_stage,
    requires_approval,
    required_role
FROM workflow_transitions
WHERE is_allowed = true
ORDER BY from_stage, to_stage;

-- ============================================
-- 5. ADD DOCUMENT TYPE ENUM (Issue 2.1 enhancement)
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type_enum') THEN
        CREATE TYPE document_type_enum AS ENUM (
            'passport',
            'visa',
            'drivers_license',
            'qualification',
            'resume',
            'academic_transcript',
            'english_test',
            'coe',
            'offer_letter',
            'invoice',
            'bill',
            'other'
        );
    END IF;
END $$;

-- Add validated document_type column (keeping varchar for backward compat)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_type_validated document_type_enum;

-- Index for document type queries
CREATE INDEX IF NOT EXISTS idx_documents_type_validated 
    ON documents(document_type_validated);

COMMENT ON COLUMN documents.document_type_validated IS 
    'Validated document type enum. Original varchar document_type kept for backward compatibility.';

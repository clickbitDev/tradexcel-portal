-- ============================================
-- CASCADING SOFT-DELETE & DATE CONSTRAINTS
-- Migration: 023_cascade_soft_delete
-- ============================================
-- Addresses remaining Phase 3 items:
-- - Cascading soft-delete for related records
-- - Date validation constraints
-- ============================================

-- ============================================
-- 1. CASCADING SOFT-DELETE TRIGGER FUNCTION
-- ============================================
-- When a partner is soft-deleted, cascade to related records

CREATE OR REPLACE FUNCTION cascade_partner_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Only act when is_deleted changes from false to true
    IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
        -- Soft-delete related applications
        UPDATE applications 
        SET is_deleted = true, 
            deleted_at = now(), 
            deleted_by = NEW.deleted_by
        WHERE partner_id = NEW.id 
          AND is_deleted = false;
        
        -- Soft-delete related invoices
        UPDATE invoices 
        SET is_deleted = true, 
            deleted_at = now(), 
            deleted_by = NEW.deleted_by
        WHERE partner_id = NEW.id 
          AND is_deleted = false;
        
        -- Soft-delete related documents
        UPDATE documents 
        SET is_deleted = true, 
            deleted_at = now(), 
            deleted_by = NEW.deleted_by
        WHERE partner_id = NEW.id 
          AND is_deleted = false;
        
        -- Log the cascade action
        INSERT INTO record_activity (table_name, record_id, action, summary, user_id)
        VALUES (
            'partners',
            NEW.id,
            'cascade_soft_delete',
            format('Cascaded soft-delete to related applications, invoices, and documents'),
            NEW.deleted_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger AFTER update to catch soft-deletes
DROP TRIGGER IF EXISTS tr_cascade_partner_soft_delete ON partners;
CREATE TRIGGER tr_cascade_partner_soft_delete
    AFTER UPDATE OF is_deleted ON partners
    FOR EACH ROW
    WHEN (NEW.is_deleted = true AND OLD.is_deleted = false)
    EXECUTE FUNCTION cascade_partner_soft_delete();

COMMENT ON FUNCTION cascade_partner_soft_delete() IS 
    'Cascades soft-delete from partner to related applications, invoices, and documents.';

-- ============================================
-- 2. CASCADE FROM RTO SOFT-DELETE
-- ============================================

CREATE OR REPLACE FUNCTION cascade_rto_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
        -- Soft-delete related offerings
        UPDATE rto_offerings 
        SET is_deleted = true, 
            deleted_at = now(), 
            deleted_by = NEW.deleted_by
        WHERE rto_id = NEW.id 
          AND is_deleted = false;
        
        -- Soft-delete related bills
        UPDATE bills 
        SET is_deleted = true, 
            deleted_at = now(), 
            deleted_by = NEW.deleted_by
        WHERE rto_id = NEW.id 
          AND is_deleted = false;
        
        INSERT INTO record_activity (table_name, record_id, action, summary, user_id)
        VALUES (
            'rtos',
            NEW.id,
            'cascade_soft_delete',
            'Cascaded soft-delete to related offerings and bills',
            NEW.deleted_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_cascade_rto_soft_delete ON rtos;
CREATE TRIGGER tr_cascade_rto_soft_delete
    AFTER UPDATE OF is_deleted ON rtos
    FOR EACH ROW
    WHEN (NEW.is_deleted = true AND OLD.is_deleted = false)
    EXECUTE FUNCTION cascade_rto_soft_delete();

-- ============================================
-- 3. CASCADE FROM APPLICATION SOFT-DELETE
-- ============================================

CREATE OR REPLACE FUNCTION cascade_application_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
        -- Soft-delete related documents
        UPDATE documents 
        SET is_deleted = true, 
            deleted_at = now(), 
            deleted_by = NEW.deleted_by
        WHERE application_id = NEW.id 
          AND is_deleted = false;
        
        -- Soft-delete related invoices
        UPDATE invoices 
        SET is_deleted = true, 
            deleted_at = now(), 
            deleted_by = NEW.deleted_by
        WHERE application_id = NEW.id 
          AND is_deleted = false;
        
        -- Soft-delete related bills
        UPDATE bills 
        SET is_deleted = true, 
            deleted_at = now(), 
            deleted_by = NEW.deleted_by
        WHERE application_id = NEW.id 
          AND is_deleted = false;
        
        INSERT INTO record_activity (table_name, record_id, action, summary, user_id)
        VALUES (
            'applications',
            NEW.id,
            'cascade_soft_delete',
            'Cascaded soft-delete to related documents, invoices, and bills',
            NEW.deleted_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_cascade_application_soft_delete ON applications;
CREATE TRIGGER tr_cascade_application_soft_delete
    AFTER UPDATE OF is_deleted ON applications
    FOR EACH ROW
    WHEN (NEW.is_deleted = true AND OLD.is_deleted = false)
    EXECUTE FUNCTION cascade_application_soft_delete();

-- ============================================
-- 4. DATE VALIDATION FUNCTIONS
-- ============================================
-- Note: Using warnings instead of hard constraints to avoid blocking existing data

CREATE OR REPLACE FUNCTION validate_application_dates()
RETURNS TRIGGER AS $$
BEGIN
    -- Warn if intake_date is before submitted_at
    IF NEW.intake_date IS NOT NULL AND NEW.submitted_at IS NOT NULL 
       AND NEW.intake_date < NEW.submitted_at::date THEN
        RAISE WARNING 'Application %: intake_date (%) is before submitted_at (%)', 
            NEW.id, NEW.intake_date, NEW.submitted_at;
    END IF;
    
    -- Warn if COE issue date is before submission
    IF NEW.coe_issued_at IS NOT NULL AND NEW.submitted_at IS NOT NULL 
       AND NEW.coe_issued_at < NEW.submitted_at THEN
        RAISE WARNING 'Application %: coe_issued_at (%) is before submitted_at (%)', 
            NEW.id, NEW.coe_issued_at, NEW.submitted_at;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_application_dates ON applications;
CREATE TRIGGER tr_validate_application_dates
    BEFORE INSERT OR UPDATE ON applications
    FOR EACH ROW
    EXECUTE FUNCTION validate_application_dates();

-- ============================================
-- 5. INVOICE DUE DATE VALIDATION
-- ============================================

CREATE OR REPLACE FUNCTION validate_invoice_dates()
RETURNS TRIGGER AS $$
BEGIN
    -- Warn if due_date is before created_at
    IF NEW.due_date IS NOT NULL AND NEW.created_at IS NOT NULL 
       AND NEW.due_date < NEW.created_at::date THEN
        RAISE WARNING 'Invoice %: due_date (%) is before created_at (%)', 
            NEW.id, NEW.due_date, NEW.created_at;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_invoice_dates ON invoices;
CREATE TRIGGER tr_validate_invoice_dates
    BEFORE INSERT OR UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION validate_invoice_dates();

-- ============================================
-- 6. BILL DUE DATE VALIDATION
-- ============================================

CREATE OR REPLACE FUNCTION validate_bill_dates()
RETURNS TRIGGER AS $$
BEGIN
    -- Warn if due_date is before created_at
    IF NEW.due_date IS NOT NULL AND NEW.created_at IS NOT NULL 
       AND NEW.due_date < NEW.created_at::date THEN
        RAISE WARNING 'Bill %: due_date (%) is before created_at (%)', 
            NEW.id, NEW.due_date, NEW.created_at;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_bill_dates ON bills;
CREATE TRIGGER tr_validate_bill_dates
    BEFORE INSERT OR UPDATE ON bills
    FOR EACH ROW
    EXECUTE FUNCTION validate_bill_dates();

-- ============================================
-- STUDENT DATA NORMALIZATION
-- Migration: 024_student_normalization
-- ============================================
-- Removes denormalized student data from applications
-- Creates backward-compatible view for queries
-- ============================================

-- ============================================
-- 1. EXTEND STUDENT_MASTER WITH MISSING FIELDS
-- ============================================
-- Add fields that exist in applications but not in student_master

ALTER TABLE student_master ADD COLUMN IF NOT EXISTS usi varchar(20);
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS visa_number varchar(50);
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS visa_expiry date;
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS gender varchar(20);
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS country_of_birth varchar(100);
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS street_no text;
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS suburb varchar(100);
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS state varchar(50);
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS postcode varchar(20);

-- ============================================
-- 2. MIGRATE DATA FROM APPLICATIONS TO STUDENT_MASTER
-- ============================================
-- For applications with student_master_id, sync fields if student_master fields are null

UPDATE student_master sm
SET 
    usi = COALESCE(sm.usi, (SELECT a.student_usi FROM applications a WHERE a.student_master_id = sm.id LIMIT 1)),
    visa_number = COALESCE(sm.visa_number, (SELECT a.student_visa_number FROM applications a WHERE a.student_master_id = sm.id LIMIT 1)),
    visa_expiry = COALESCE(sm.visa_expiry, (SELECT a.student_visa_expiry FROM applications a WHERE a.student_master_id = sm.id LIMIT 1)),
    gender = COALESCE(sm.gender, (SELECT a.student_gender FROM applications a WHERE a.student_master_id = sm.id LIMIT 1)),
    country_of_birth = COALESCE(sm.country_of_birth, (SELECT a.student_country_of_birth FROM applications a WHERE a.student_master_id = sm.id LIMIT 1)),
    street_no = COALESCE(sm.street_no, (SELECT a.student_street_no FROM applications a WHERE a.student_master_id = sm.id LIMIT 1)),
    suburb = COALESCE(sm.suburb, (SELECT a.student_suburb FROM applications a WHERE a.student_master_id = sm.id LIMIT 1)),
    state = COALESCE(sm.state, (SELECT a.student_state FROM applications a WHERE a.student_master_id = sm.id LIMIT 1)),
    postcode = COALESCE(sm.postcode, (SELECT a.student_postcode FROM applications a WHERE a.student_master_id = sm.id LIMIT 1))
WHERE EXISTS (SELECT 1 FROM applications a WHERE a.student_master_id = sm.id);

-- ============================================
-- 3. CREATE DENORMALIZED VIEW FOR BACKWARD COMPATIBILITY
-- ============================================
-- This view provides the same columns as before the normalization

CREATE OR REPLACE VIEW applications_denormalized AS
SELECT 
    a.id,
    a.student_uid,
    -- Student info from student_master (preferred) or applications (fallback)
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
    -- All other application fields
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
    a.updated_at,
    -- Additional fields
    a.application_from,
    a.received_by,
    a.received_at,
    a.last_updated_by,
    a.notes,
    a.issue_date,
    a.signed_off_by,
    a.signed_off_at,
    a.assigned_by,
    a.assigned_at,
    a.needs_attention,
    a.ready_to_check,
    a.ready_to_check_at,
    a.docs_prepared_by,
    a.docs_prepared_at,
    a.docs_checked_by,
    a.docs_checked_at,
    a.docs_approved_by,
    a.docs_approved_at,
    a.provider_email,
    a.additional_emails,
    a.sent_by,
    a.sent_at,
    a.delivery_method,
    a.delivered_by,
    a.delivery_date,
    a.tracking_url,
    a.is_delivered,
    a.has_qualifications_docs,
    a.has_id_docs,
    a.has_misc_docs,
    a.latest_invoice_id,
    a.latest_bill_id
FROM applications a
LEFT JOIN student_master sm ON a.student_master_id = sm.id AND sm.is_deleted = false;

COMMENT ON VIEW applications_denormalized IS 
    'Backward-compatible view that joins applications with student_master data. Use this for queries that need student info.';

-- ============================================
-- 4. CREATE FUNCTION TO SYNC STUDENT DATA
-- ============================================
-- When student_master is updated, no extra action needed
-- When applications student fields are updated, optionally sync to student_master

CREATE OR REPLACE FUNCTION sync_application_to_student_master()
RETURNS TRIGGER AS $$
BEGIN
    -- If application has a student_master_id and student fields changed,
    -- update student_master with the new values (if student_master field is null)
    IF NEW.student_master_id IS NOT NULL THEN
        UPDATE student_master 
        SET 
            first_name = COALESCE(first_name, NEW.student_first_name),
            last_name = COALESCE(last_name, NEW.student_last_name),
            email = COALESCE(email, NEW.student_email),
            phone = COALESCE(phone, NEW.student_phone),
            dob = COALESCE(dob, NEW.student_dob),
            passport_number = COALESCE(passport_number, NEW.student_passport_number),
            nationality = COALESCE(nationality, NEW.student_nationality),
            gender = COALESCE(gender, NEW.student_gender),
            country_of_birth = COALESCE(country_of_birth, NEW.student_country_of_birth),
            address = COALESCE(address, NEW.student_address),
            street_no = COALESCE(street_no, NEW.student_street_no),
            suburb = COALESCE(suburb, NEW.student_suburb),
            state = COALESCE(state, NEW.student_state),
            postcode = COALESCE(postcode, NEW.student_postcode),
            usi = COALESCE(usi, NEW.student_usi),
            visa_number = COALESCE(visa_number, NEW.student_visa_number),
            visa_expiry = COALESCE(visa_expiry, NEW.student_visa_expiry),
            updated_at = now()
        WHERE id = NEW.student_master_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply sync trigger (optional - can be enabled if needed)
-- DROP TRIGGER IF EXISTS tr_sync_app_to_student ON applications;
-- CREATE TRIGGER tr_sync_app_to_student
--     AFTER INSERT OR UPDATE ON applications
--     FOR EACH ROW
--     EXECUTE FUNCTION sync_application_to_student_master();

-- ============================================
-- 5. ADD INDEXES FOR STUDENT_MASTER LOOKUPS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_student_master_email ON student_master(email);
CREATE INDEX IF NOT EXISTS idx_student_master_passport ON student_master(passport_number);
CREATE INDEX IF NOT EXISTS idx_student_master_name ON student_master(last_name, first_name);

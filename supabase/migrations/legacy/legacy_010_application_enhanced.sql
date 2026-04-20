-- ============================================
-- ENHANCED APPLICATION FIELDS
-- Migration: 010_application_enhanced
-- ============================================

-- Add student demographic fields
ALTER TABLE applications ADD COLUMN IF NOT EXISTS student_gender VARCHAR(20);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS student_country_of_birth VARCHAR(100);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS application_from VARCHAR(100);

-- Split address into components
ALTER TABLE applications ADD COLUMN IF NOT EXISTS student_street_no TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS student_suburb VARCHAR(100);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS student_state VARCHAR(50);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS student_postcode VARCHAR(20);

-- Application tracking fields
ALTER TABLE applications ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES profiles(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS last_updated_by UUID REFERENCES profiles(id);

-- Notes and sign-off
ALTER TABLE applications ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS issue_date DATE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS signed_off_by UUID REFERENCES profiles(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS signed_off_at TIMESTAMPTZ;

-- Assignment tracking
ALTER TABLE applications ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES profiles(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ready_to_check BOOLEAN DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ready_to_check_at TIMESTAMPTZ;

-- Document status tracking
ALTER TABLE applications ADD COLUMN IF NOT EXISTS docs_prepared_by UUID REFERENCES profiles(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS docs_prepared_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS docs_checked_by UUID REFERENCES profiles(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS docs_checked_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS docs_approved_by UUID REFERENCES profiles(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS docs_approved_at TIMESTAMPTZ;

-- Document delivery fields
ALTER TABLE applications ADD COLUMN IF NOT EXISTS provider_email VARCHAR(255);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS additional_emails TEXT[];
ALTER TABLE applications ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES profiles(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(50);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS delivered_by UUID REFERENCES profiles(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS delivery_date DATE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT false;

-- Required documents checklist (for executive review)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS has_qualifications_docs BOOLEAN DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS has_id_docs BOOLEAN DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS has_misc_docs BOOLEAN DEFAULT false;

-- Indexes for new fields
CREATE INDEX IF NOT EXISTS idx_applications_received_by ON applications(received_by);
CREATE INDEX IF NOT EXISTS idx_applications_assigned_by ON applications(assigned_by);
CREATE INDEX IF NOT EXISTS idx_applications_needs_attention ON applications(needs_attention) WHERE needs_attention = true;

-- Trigger to track last_updated_by
CREATE OR REPLACE FUNCTION update_application_last_updated_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_by = auth.uid();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_application_last_updated ON applications;
CREATE TRIGGER tr_application_last_updated
  BEFORE UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION update_application_last_updated_by();

-- Comments for documentation
COMMENT ON COLUMN applications.student_gender IS 'Student gender: Male, Female, Other';
COMMENT ON COLUMN applications.needs_attention IS 'Flag when application needs further attention';
COMMENT ON COLUMN applications.ready_to_check IS 'Admin marks this when ready for executive review';

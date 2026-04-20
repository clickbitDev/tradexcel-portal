-- Migration: Add assessor and admin assignment fields to applications
-- This adds fields for assigning assessors and admins to applications

-- Add new columns for assessor and admin assignment
ALTER TABLE applications ADD COLUMN IF NOT EXISTS assigned_assessor_id UUID REFERENCES profiles(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS assigned_admin_id UUID REFERENCES profiles(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS assessor_fee DECIMAL(10,2) DEFAULT 0;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_applications_assigned_assessor 
    ON applications(assigned_assessor_id) 
    WHERE assigned_assessor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_applications_assigned_admin 
    ON applications(assigned_admin_id) 
    WHERE assigned_admin_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN applications.assigned_assessor_id IS 'The assessor assigned to evaluate this application';
COMMENT ON COLUMN applications.assigned_admin_id IS 'The admin staff member assigned to manage this application';
COMMENT ON COLUMN applications.assessor_fee IS 'Fee payable to the assessor for this application';

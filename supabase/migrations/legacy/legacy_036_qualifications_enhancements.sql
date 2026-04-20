-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 036_qualifications_enhancements
-- Purpose: Add delivery_mode and last_edited_by fields to qualifications
-- ============================================

-- Add delivery_mode as an array to support multiple modes
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS delivery_mode TEXT[];

-- Add last_edited_by to track who made the last edit
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES profiles(id);

-- Comment on columns for documentation
COMMENT ON COLUMN qualifications.delivery_mode IS 'Array of delivery modes: rpl, online, face_to_face, blended';
COMMENT ON COLUMN qualifications.last_edited_by IS 'UUID of the user who last edited this qualification';

-- Create index for last_edited_by for faster lookups
CREATE INDEX IF NOT EXISTS idx_qualifications_last_edited_by ON qualifications(last_edited_by);

-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 047_qualification_prerequisites_certificate_preview
-- Purpose: Add prerequisites list and certificate preview image path to qualifications
-- ============================================

ALTER TABLE qualifications
  ADD COLUMN IF NOT EXISTS prerequisites TEXT[];

ALTER TABLE qualifications
  ADD COLUMN IF NOT EXISTS certificate_preview_path TEXT;

COMMENT ON COLUMN qualifications.prerequisites IS 'List of prerequisite requirements for the qualification';
COMMENT ON COLUMN qualifications.certificate_preview_path IS 'Supabase storage path for certificate preview image';

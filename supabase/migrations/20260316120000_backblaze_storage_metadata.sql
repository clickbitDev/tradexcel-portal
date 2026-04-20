-- ============================================
-- SHARP FUTURE DATABASE MIGRATION
-- Migration: 20260316120000_backblaze_storage_metadata
-- Purpose: Add provider-aware storage metadata for Backblaze B2 application files
-- ============================================

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS storage_provider TEXT,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
  ADD COLUMN IF NOT EXISTS storage_key TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_storage_provider_check'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_storage_provider_check
      CHECK (storage_provider IS NULL OR storage_provider IN ('supabase', 'b2'));
  END IF;
END $$;

COMMENT ON COLUMN documents.storage_provider IS 'Storage provider for the file record. Expected values: supabase or b2';
COMMENT ON COLUMN documents.storage_bucket IS 'Backing bucket/container name for the stored file';
COMMENT ON COLUMN documents.storage_key IS 'Provider-specific object key/path for the stored file';

ALTER TABLE qualifications
  ADD COLUMN IF NOT EXISTS certificate_preview_provider TEXT,
  ADD COLUMN IF NOT EXISTS certificate_preview_bucket TEXT,
  ADD COLUMN IF NOT EXISTS certificate_preview_key TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'qualifications_certificate_preview_provider_check'
  ) THEN
    ALTER TABLE qualifications
      ADD CONSTRAINT qualifications_certificate_preview_provider_check
      CHECK (certificate_preview_provider IS NULL OR certificate_preview_provider IN ('supabase', 'b2'));
  END IF;
END $$;

COMMENT ON COLUMN qualifications.certificate_preview_path IS 'Legacy Supabase storage path or object key for the qualification certificate preview image';
COMMENT ON COLUMN qualifications.certificate_preview_provider IS 'Storage provider for the qualification certificate preview. Expected values: supabase or b2';
COMMENT ON COLUMN qualifications.certificate_preview_bucket IS 'Backing bucket/container name for the qualification certificate preview image';
COMMENT ON COLUMN qualifications.certificate_preview_key IS 'Provider-specific object key/path for the qualification certificate preview image';

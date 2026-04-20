-- ============================================
-- DOCUMENT EXTRACTION SUPPORT
-- Migration: 007_document_extraction
-- ============================================

-- Add new student fields for extracted document data
ALTER TABLE applications ADD COLUMN IF NOT EXISTS student_address TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS student_usi VARCHAR(10);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS student_visa_number VARCHAR(50);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS student_visa_expiry DATE;

-- Add extraction metadata to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_data JSONB;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(20) DEFAULT 'pending'
  CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed', 'skipped'));
ALTER TABLE documents ADD COLUMN IF NOT EXISTS extraction_error TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ;

-- Index for extraction status queries
CREATE INDEX IF NOT EXISTS idx_documents_extraction_status ON documents(extraction_status);

-- Comment for documentation
COMMENT ON COLUMN documents.extracted_data IS 'JSON containing extracted fields with confidence scores';
COMMENT ON COLUMN documents.extraction_status IS 'Status of OCR/text extraction: pending, processing, completed, failed, skipped';

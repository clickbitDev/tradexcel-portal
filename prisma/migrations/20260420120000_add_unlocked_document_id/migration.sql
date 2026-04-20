-- Add unlocked_document_id column to certificate_records
ALTER TABLE certificate_records ADD COLUMN unlocked_document_id UUID REFERENCES documents(id);

-- Add index for unlocked_document_id
CREATE INDEX idx_certificate_records_unlocked_document ON certificate_records(unlocked_document_id);

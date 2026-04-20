-- Migration 041: Add Assessor Fee and Provider Fee to RTO Offerings
-- These columns allow per-qualification pricing for assessors and providers

-- Add assessor_fee column to rto_offerings
ALTER TABLE rto_offerings ADD COLUMN IF NOT EXISTS assessor_fee DECIMAL(10,2) DEFAULT 0;
COMMENT ON COLUMN rto_offerings.assessor_fee IS 'Fee payable to assessors for this qualification';

-- Add provider_fee column to rto_offerings  
ALTER TABLE rto_offerings ADD COLUMN IF NOT EXISTS provider_fee DECIMAL(10,2) DEFAULT 0;
COMMENT ON COLUMN rto_offerings.provider_fee IS 'Fee charged by the RTO/provider for this qualification';

-- Create indexes for potential filtering
CREATE INDEX IF NOT EXISTS idx_rto_offerings_assessor_fee ON rto_offerings(assessor_fee) WHERE assessor_fee > 0;
CREATE INDEX IF NOT EXISTS idx_rto_offerings_provider_fee ON rto_offerings(provider_fee) WHERE provider_fee > 0;

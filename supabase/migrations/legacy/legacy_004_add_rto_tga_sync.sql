-- ============================================
-- Migration 004: Add TGA Sync Fields to RTOs
-- ============================================
-- This migration adds TGA sync status tracking to the RTOs table,
-- similar to the existing qualifications table sync tracking.

-- Add TGA sync columns to RTOs table
ALTER TABLE rtos ADD COLUMN IF NOT EXISTS tga_sync_status tga_sync_status DEFAULT 'never';
ALTER TABLE rtos ADD COLUMN IF NOT EXISTS tga_last_synced_at TIMESTAMPTZ;
ALTER TABLE rtos ADD COLUMN IF NOT EXISTS tga_sync_error TEXT;

-- Create index for faster filtering by sync status
CREATE INDEX IF NOT EXISTS idx_rtos_tga_sync_status ON rtos(tga_sync_status);

-- Add comment for documentation
COMMENT ON COLUMN rtos.tga_sync_status IS 'TGA API synchronization status: synced, pending, error, or never';
COMMENT ON COLUMN rtos.tga_last_synced_at IS 'Timestamp of last successful TGA sync';
COMMENT ON COLUMN rtos.tga_sync_error IS 'Error message if last sync failed';

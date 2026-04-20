-- ============================================
-- LUMIERE PORTAL DATABASE SCHEMA
-- Migration: 006_qualifications_extended
-- Purpose: Add units breakdown, TGA sync logging, and RTO dependency tracking
-- ============================================

-- ============================================
-- 1. QUALIFICATION UNITS TABLE
-- ============================================
CREATE TABLE qualification_units (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  qualification_id UUID NOT NULL REFERENCES qualifications(id) ON DELETE CASCADE,
  unit_code TEXT NOT NULL,
  unit_title TEXT NOT NULL,
  unit_type TEXT CHECK(unit_type IN ('core', 'elective')),
  field_of_education TEXT,
  nominal_hours INTEGER,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(qualification_id, unit_code)
);

CREATE INDEX idx_qualification_units_qual ON qualification_units(qualification_id);
CREATE INDEX idx_qualification_units_code ON qualification_units(unit_code);
CREATE INDEX idx_qualification_units_type ON qualification_units(unit_type);

-- ============================================
-- 2. TGA SYNC AUDIT TRAIL
-- ============================================
CREATE TYPE sync_result AS ENUM ('success', 'partial', 'failed', 'skipped');

CREATE TABLE tga_sync_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  qualification_id UUID REFERENCES qualifications(id) ON DELETE CASCADE,
  sync_result sync_result NOT NULL,
  changes_detected JSONB DEFAULT '{}',
  api_response JSONB,
  error_message TEXT,
  synced_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tga_sync_log_qual ON tga_sync_log(qualification_id);
CREATE INDEX idx_tga_sync_log_created ON tga_sync_log(created_at DESC);
CREATE INDEX idx_tga_sync_log_result ON tga_sync_log(sync_result);

-- ============================================
-- 3. MATERIALIZED VIEW FOR RTO DEPENDENCY COUNTS
-- ============================================
CREATE MATERIALIZED VIEW qualification_rto_usage AS
SELECT 
  q.id as qualification_id,
  q.code,
  q.name,
  COUNT(DISTINCT ro.rto_id) as rto_count,
  ARRAY_AGG(DISTINCT r.id) FILTER (WHERE r.id IS NOT NULL) as rto_ids,
  ARRAY_AGG(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) as rto_names
FROM qualifications q
LEFT JOIN rto_offerings ro ON ro.qualification_id = q.id AND ro.is_active = true
LEFT JOIN rtos r ON r.id = ro.rto_id AND r.status = 'active'
GROUP BY q.id, q.code, q.name;

CREATE UNIQUE INDEX idx_qual_rto_usage_qual ON qualification_rto_usage(qualification_id);

-- Refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_qualification_rto_usage()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY qualification_rto_usage;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. RLS POLICIES
-- ============================================
ALTER TABLE qualification_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tga_sync_log ENABLE ROW LEVEL SECURITY;

-- Qualification Units: Read for all authenticated, write for staff+
CREATE POLICY "Read qualification units" 
  ON qualification_units FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Manage qualification units" 
  ON qualification_units FOR ALL 
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'staff')));

-- TGA Sync Logs: Read for all authenticated, write for staff+
CREATE POLICY "Read sync logs" 
  ON tga_sync_log FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Staff manage sync logs" 
  ON tga_sync_log FOR ALL 
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'staff')));

-- ============================================
-- 5. UPDATE TRIGGERS
-- ============================================
CREATE TRIGGER update_qualification_units_timestamp 
  BEFORE UPDATE ON qualification_units 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 6. EXTEND QUALIFICATIONS TABLE
-- ============================================
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS core_units INTEGER;
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS elective_units INTEGER;
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS total_units INTEGER;
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS entry_requirements TEXT;
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS cricos_code VARCHAR(20);

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Function to get unit count for a qualification
CREATE OR REPLACE FUNCTION get_qualification_unit_counts(qual_id UUID)
RETURNS TABLE(core_count INTEGER, elective_count INTEGER, total_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE unit_type = 'core')::INTEGER as core_count,
    COUNT(*) FILTER (WHERE unit_type = 'elective')::INTEGER as elective_count,
    COUNT(*)::INTEGER as total_count
  FROM qualification_units
  WHERE qualification_id = qual_id AND is_current = true;
END;
$$ LANGUAGE plpgsql;

-- Function to sync unit counts to qualifications table
CREATE OR REPLACE FUNCTION sync_qualification_unit_counts()
RETURNS TRIGGER AS $$
DECLARE
  counts RECORD;
BEGIN
  SELECT * INTO counts FROM get_qualification_unit_counts(COALESCE(NEW.qualification_id, OLD.qualification_id));
  
  UPDATE qualifications
  SET 
    core_units = counts.core_count,
    elective_units = counts.elective_count,
    total_units = counts.total_count
  WHERE id = COALESCE(NEW.qualification_id, OLD.qualification_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update unit counts
CREATE TRIGGER sync_unit_counts_on_change
  AFTER INSERT OR UPDATE OR DELETE ON qualification_units
  FOR EACH ROW
  EXECUTE FUNCTION sync_qualification_unit_counts();

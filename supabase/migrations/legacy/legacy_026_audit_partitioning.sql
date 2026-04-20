-- ============================================
-- TABLE PARTITIONING FOR AUDIT_TRAIL
-- Migration: 026_audit_partitioning
-- ============================================
-- Implements time-based partitioning on audit_trail
-- for improved query performance on large datasets
-- ============================================

-- ============================================
-- 1. CREATE PARTITIONED AUDIT TABLE
-- ============================================
-- NOTE: This creates a new partitioned table structure
-- The original audit_trail table must be renamed first

-- Rename existing table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'audit_trail' AND schemaname = 'public') THEN
        ALTER TABLE audit_trail RENAME TO audit_trail_legacy;
    END IF;
END $$;

-- Create new partitioned table
CREATE TABLE IF NOT EXISTS audit_trail (
    id uuid DEFAULT gen_random_uuid(),
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    entity_identifier text,
    action text NOT NULL,
    action_category text,
    summary text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_fields text[] DEFAULT '{}',
    change_reason text,
    version_number integer,
    user_id uuid,
    user_name text,
    user_role text,
    ip_address inet,
    user_agent text,
    request_id text,
    created_at timestamptz DEFAULT now() NOT NULL,
    
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ============================================
-- 2. CREATE PARTITIONS BY MONTH
-- ============================================

-- Historical partitions (past year)
CREATE TABLE IF NOT EXISTS audit_trail_2025_01 PARTITION OF audit_trail
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS audit_trail_2025_02 PARTITION OF audit_trail
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS audit_trail_2025_03 PARTITION OF audit_trail
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS audit_trail_2025_04 PARTITION OF audit_trail
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE IF NOT EXISTS audit_trail_2025_05 PARTITION OF audit_trail
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS audit_trail_2025_06 PARTITION OF audit_trail
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE IF NOT EXISTS audit_trail_2025_07 PARTITION OF audit_trail
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE IF NOT EXISTS audit_trail_2025_08 PARTITION OF audit_trail
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS audit_trail_2025_09 PARTITION OF audit_trail
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS audit_trail_2025_10 PARTITION OF audit_trail
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE IF NOT EXISTS audit_trail_2025_11 PARTITION OF audit_trail
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS audit_trail_2025_12 PARTITION OF audit_trail
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Current year partitions
CREATE TABLE IF NOT EXISTS audit_trail_2026_01 PARTITION OF audit_trail
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS audit_trail_2026_02 PARTITION OF audit_trail
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS audit_trail_2026_03 PARTITION OF audit_trail
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS audit_trail_2026_04 PARTITION OF audit_trail
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS audit_trail_2026_05 PARTITION OF audit_trail
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS audit_trail_2026_06 PARTITION OF audit_trail
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS audit_trail_2026_07 PARTITION OF audit_trail
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS audit_trail_2026_08 PARTITION OF audit_trail
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS audit_trail_2026_09 PARTITION OF audit_trail
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS audit_trail_2026_10 PARTITION OF audit_trail
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS audit_trail_2026_11 PARTITION OF audit_trail
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS audit_trail_2026_12 PARTITION OF audit_trail
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Default partition for any dates outside defined ranges
CREATE TABLE IF NOT EXISTS audit_trail_default PARTITION OF audit_trail DEFAULT;

-- ============================================
-- 3. MIGRATE DATA FROM LEGACY TABLE
-- ============================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'audit_trail_legacy') THEN
        INSERT INTO audit_trail 
        SELECT * FROM audit_trail_legacy
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ============================================
-- 4. CREATE INDEXES ON PARTITIONED TABLE
-- ============================================
-- Indexes are automatically created on partitions

CREATE INDEX IF NOT EXISTS idx_audit_trail_entity_part 
    ON audit_trail(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_trail_user_part 
    ON audit_trail(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_trail_action_part 
    ON audit_trail(action, created_at DESC);

-- ============================================
-- 5. FUNCTION TO AUTO-CREATE FUTURE PARTITIONS
-- ============================================

CREATE OR REPLACE FUNCTION create_audit_partition_if_needed()
RETURNS void AS $$
DECLARE
    partition_date date;
    partition_name text;
    start_date date;
    end_date date;
BEGIN
    -- Check for next 3 months
    FOR i IN 0..2 LOOP
        partition_date := date_trunc('month', now() + (i || ' months')::interval)::date;
        partition_name := 'audit_trail_' || to_char(partition_date, 'YYYY_MM');
        start_date := partition_date;
        end_date := partition_date + interval '1 month';
        
        -- Check if partition exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = partition_name AND schemaname = 'public'
        ) THEN
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_trail FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_date, end_date
            );
            RAISE NOTICE 'Created partition: %', partition_name;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create any missing partitions now
SELECT create_audit_partition_if_needed();

-- ============================================
-- 6. RLS ON PARTITIONED TABLE
-- ============================================

ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view partitioned audit"
    ON audit_trail FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role NOT IN ('agent', 'assessor')
    ));

CREATE POLICY "System can insert partitioned audit"
    ON audit_trail FOR INSERT TO authenticated
    WITH CHECK (true);

-- ============================================
-- 7. CLEANUP (run manually after verification)
-- ============================================
-- DROP TABLE IF EXISTS audit_trail_legacy;

COMMENT ON TABLE audit_trail IS 
    'Partitioned audit trail table. Partitions created monthly for performance.';

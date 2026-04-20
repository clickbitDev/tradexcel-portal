-- ============================================
-- AUDIT TABLE CONSOLIDATION
-- Migration: 025_audit_consolidation
-- ============================================
-- Consolidates audit_logs, record_activity, and record_versions
-- into a unified audit_trail table
-- ============================================

-- ============================================
-- 1. CREATE UNIFIED AUDIT_TRAIL TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_trail (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Entity identification
    entity_type text NOT NULL,           -- 'application', 'invoice', 'partner', etc.
    entity_id uuid NOT NULL,
    entity_identifier text,              -- student_uid, invoice_number, etc.
    
    -- Action details
    action text NOT NULL,                -- 'create', 'update', 'delete', 'archive', 'restore', etc.
    action_category text,                -- 'data_change', 'workflow', 'financial', 'security'
    summary text NOT NULL,               -- Human-readable summary
    
    -- Change data
    old_data jsonb,                      -- Previous state (for updates/deletes)
    new_data jsonb,                      -- New state (for creates/updates)
    changed_fields text[] DEFAULT '{}',  -- List of changed field names
    change_reason text,                  -- Optional reason for change
    
    -- Version tracking
    version_number integer,              -- Sequential per entity
    
    -- User context
    user_id uuid REFERENCES profiles(id),
    user_name text,                      -- Cached for performance
    user_role text,                      -- Role at time of action
    
    -- Request context
    ip_address inet,
    user_agent text,
    request_id text,                     -- For correlating related changes
    
    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================
-- 2. CREATE INDEXES FOR COMMON QUERIES
-- ============================================

-- Primary lookup patterns
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity 
    ON audit_trail(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_trail_user 
    ON audit_trail(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_trail_action 
    ON audit_trail(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_trail_created 
    ON audit_trail(created_at DESC);

-- Text search on summary
CREATE INDEX IF NOT EXISTS idx_audit_trail_summary_gin
    ON audit_trail USING GIN(to_tsvector('english', summary));

-- Category filtering
CREATE INDEX IF NOT EXISTS idx_audit_trail_category 
    ON audit_trail(action_category, created_at DESC);

-- ============================================
-- 3. MIGRATE EXISTING DATA
-- ============================================

-- Migrate from record_activity (most human-readable)
INSERT INTO audit_trail (
    entity_type,
    entity_id,
    action,
    summary,
    new_data,
    user_id,
    user_name,
    ip_address,
    user_agent,
    created_at
)
SELECT 
    table_name,
    record_id,
    action,
    summary,
    details,
    user_id,
    user_name,
    ip_address,
    user_agent,
    created_at
FROM record_activity
ON CONFLICT DO NOTHING;

-- Migrate from audit_logs (original audit)
INSERT INTO audit_trail (
    entity_type,
    entity_id,
    action,
    summary,
    old_data,
    new_data,
    user_id,
    ip_address,
    user_agent,
    created_at
)
SELECT 
    table_name,
    record_id,
    action,
    action || ' on ' || table_name,
    old_data,
    new_data,
    user_id,
    ip_address,
    user_agent,
    created_at
FROM audit_logs
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. CREATE UNIFIED AUDIT FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION log_to_audit_trail(
    p_entity_type text,
    p_entity_id uuid,
    p_entity_identifier text,
    p_action text,
    p_summary text,
    p_old_data jsonb DEFAULT NULL,
    p_new_data jsonb DEFAULT NULL,
    p_changed_fields text[] DEFAULT '{}',
    p_action_category text DEFAULT 'data_change',
    p_change_reason text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_audit_id uuid;
    v_user_name text;
    v_user_role text;
    v_version integer;
BEGIN
    -- Get user info
    SELECT full_name, role::text INTO v_user_name, v_user_role
    FROM profiles WHERE id = auth.uid();
    
    -- Get next version number for this entity
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version
    FROM audit_trail
    WHERE entity_type = p_entity_type AND entity_id = p_entity_id;
    
    INSERT INTO audit_trail (
        entity_type,
        entity_id,
        entity_identifier,
        action,
        action_category,
        summary,
        old_data,
        new_data,
        changed_fields,
        change_reason,
        version_number,
        user_id,
        user_name,
        user_role
    ) VALUES (
        p_entity_type,
        p_entity_id,
        p_entity_identifier,
        p_action,
        p_action_category,
        p_summary,
        p_old_data,
        p_new_data,
        p_changed_fields,
        p_change_reason,
        v_version,
        auth.uid(),
        v_user_name,
        v_user_role
    )
    RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. CREATE VIEWS FOR COMMON AUDIT QUERIES
-- ============================================

CREATE OR REPLACE VIEW recent_activity AS
SELECT 
    entity_type,
    entity_id,
    entity_identifier,
    action,
    summary,
    user_name,
    created_at
FROM audit_trail
WHERE created_at > now() - interval '7 days'
ORDER BY created_at DESC;

CREATE OR REPLACE VIEW entity_history AS
SELECT 
    entity_type,
    entity_id,
    entity_identifier,
    action,
    summary,
    changed_fields,
    version_number,
    user_name,
    created_at
FROM audit_trail
ORDER BY entity_type, entity_id, version_number;

-- ============================================
-- 6. RLS POLICIES
-- ============================================

ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

-- Staff+ can view all audit entries
CREATE POLICY "Staff can view audit trail"
    ON audit_trail FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role NOT IN ('agent', 'assessor')
    ));

-- System can insert audit entries
CREATE POLICY "System can insert audit"
    ON audit_trail FOR INSERT TO authenticated
    WITH CHECK (true);

-- ============================================
-- 7. MARK OLD TABLES AS DEPRECATED (but keep for now)
-- ============================================

COMMENT ON TABLE audit_logs IS 'DEPRECATED: Use audit_trail instead. Kept for backward compatibility.';
COMMENT ON TABLE record_activity IS 'DEPRECATED: Use audit_trail instead. Kept for backward compatibility.';
COMMENT ON TABLE record_versions IS 'DEPRECATED: Use audit_trail instead. Kept for backward compatibility.';

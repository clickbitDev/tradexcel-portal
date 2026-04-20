-- Migration: 004_version_control_schema
-- Implements version control, archive, activity tracking, and soft-delete trash system
-- No data is ever permanently deleted

-- ============================================
-- 1. RECORD VERSIONS TABLE
-- Stores complete snapshots of records for version history
-- ============================================

CREATE TABLE IF NOT EXISTS record_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,           -- e.g., 'applications', 'partners'
    record_id UUID NOT NULL,                     -- ID of the versioned record
    version_number INTEGER NOT NULL,             -- Sequential version number per record
    data JSONB NOT NULL,                         -- Complete snapshot of the record at this version
    changed_fields TEXT[] DEFAULT '{}',          -- List of fields that changed from previous version
    change_type VARCHAR(20) NOT NULL             -- 'create', 'update', 'archive', 'restore', 'delete'
        CHECK (change_type IN ('create', 'update', 'archive', 'restore', 'delete', 'unarchive')),
    changed_by UUID REFERENCES profiles(id),    -- User who made the change
    change_reason TEXT,                          -- Optional reason for the change
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(table_name, record_id, version_number)
);

-- Indexes for version queries
CREATE INDEX IF NOT EXISTS idx_record_versions_table_record ON record_versions(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_record_versions_created ON record_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_record_versions_user ON record_versions(changed_by);

-- ============================================
-- 2. RECORD ACTIVITY TABLE
-- Human-readable activity timeline
-- ============================================

CREATE TABLE IF NOT EXISTS record_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,                 -- 'created', 'updated', 'archived', 'restored', 'deleted', etc.
    summary TEXT NOT NULL,                       -- Human-readable: "Updated student email from X to Y"
    details JSONB,                               -- Structured change details for programmatic use
    user_id UUID REFERENCES profiles(id),
    user_name TEXT,                              -- Cached user name for display
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for activity queries
CREATE INDEX IF NOT EXISTS idx_record_activity_table_record ON record_activity(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_record_activity_user ON record_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_record_activity_created ON record_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_record_activity_action ON record_activity(action);

-- ============================================
-- 3. ADD SOFT DELETE & ARCHIVE COLUMNS TO CORE TABLES
-- ============================================

-- Applications
ALTER TABLE applications ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- Partners
ALTER TABLE partners ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- RTOs
ALTER TABLE rtos ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE rtos ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE rtos ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id);
ALTER TABLE rtos ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE rtos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE rtos ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- Qualifications
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id);
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- RTO Offerings
ALTER TABLE rto_offerings ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE rto_offerings ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE rto_offerings ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id);
ALTER TABLE rto_offerings ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE rto_offerings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE rto_offerings ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- Documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- Invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- Email Templates
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id);
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- Profiles (soft delete only, no archive)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- ============================================
-- 4. INDEXES FOR SOFT DELETE QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_applications_deleted ON applications(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_applications_archived ON applications(is_archived) WHERE is_archived = true;
CREATE INDEX IF NOT EXISTS idx_partners_deleted ON partners(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_partners_archived ON partners(is_archived) WHERE is_archived = true;
CREATE INDEX IF NOT EXISTS idx_rtos_deleted ON rtos(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_rtos_archived ON rtos(is_archived) WHERE is_archived = true;
CREATE INDEX IF NOT EXISTS idx_qualifications_deleted ON qualifications(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_qualifications_archived ON qualifications(is_archived) WHERE is_archived = true;
CREATE INDEX IF NOT EXISTS idx_rto_offerings_deleted ON rto_offerings(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_rto_offerings_archived ON rto_offerings(is_archived) WHERE is_archived = true;
CREATE INDEX IF NOT EXISTS idx_documents_deleted ON documents(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_documents_archived ON documents(is_archived) WHERE is_archived = true;
CREATE INDEX IF NOT EXISTS idx_invoices_deleted ON invoices(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_invoices_archived ON invoices(is_archived) WHERE is_archived = true;

-- ============================================
-- 5. HELPER FUNCTION: GET NEXT VERSION NUMBER
-- ============================================

CREATE OR REPLACE FUNCTION get_next_version_number(p_table_name VARCHAR, p_record_id UUID)
RETURNS INTEGER AS $$
DECLARE
    next_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_version
    FROM record_versions
    WHERE table_name = p_table_name AND record_id = p_record_id;
    
    RETURN next_version;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. HELPER FUNCTION: CREATE VERSION SNAPSHOT
-- ============================================

CREATE OR REPLACE FUNCTION create_version_snapshot(
    p_table_name VARCHAR,
    p_record_id UUID,
    p_data JSONB,
    p_changed_fields TEXT[],
    p_change_type VARCHAR,
    p_changed_by UUID DEFAULT NULL,
    p_change_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    version_id UUID;
    next_version INTEGER;
BEGIN
    next_version := get_next_version_number(p_table_name, p_record_id);
    
    INSERT INTO record_versions (
        table_name,
        record_id,
        version_number,
        data,
        changed_fields,
        change_type,
        changed_by,
        change_reason
    ) VALUES (
        p_table_name,
        p_record_id,
        next_version,
        p_data,
        p_changed_fields,
        p_change_type,
        COALESCE(p_changed_by, auth.uid()),
        p_change_reason
    )
    RETURNING id INTO version_id;
    
    RETURN version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. HELPER FUNCTION: CREATE ACTIVITY ENTRY
-- ============================================

CREATE OR REPLACE FUNCTION create_activity_entry(
    p_table_name VARCHAR,
    p_record_id UUID,
    p_action VARCHAR,
    p_summary TEXT,
    p_details JSONB DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    activity_id UUID;
    v_user_name TEXT;
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Get user name for caching
    SELECT full_name INTO v_user_name
    FROM profiles
    WHERE id = v_user_id;
    
    INSERT INTO record_activity (
        table_name,
        record_id,
        action,
        summary,
        details,
        user_id,
        user_name
    ) VALUES (
        p_table_name,
        p_record_id,
        p_action,
        p_summary,
        p_details,
        v_user_id,
        v_user_name
    )
    RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. GENERIC VERSION TRACKING TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION track_record_version()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields TEXT[] := '{}';
    old_jsonb JSONB;
    new_jsonb JSONB;
    key TEXT;
    change_type VARCHAR;
    summary TEXT;
BEGIN
    -- Determine change type
    IF TG_OP = 'INSERT' THEN
        change_type := 'create';
        
        -- Create version for new record
        PERFORM create_version_snapshot(
            TG_TABLE_NAME,
            NEW.id,
            to_jsonb(NEW),
            '{}',
            change_type
        );
        
        -- Create activity
        PERFORM create_activity_entry(
            TG_TABLE_NAME,
            NEW.id,
            'created',
            'Record created'
        );
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        old_jsonb := to_jsonb(OLD);
        new_jsonb := to_jsonb(NEW);
        
        -- Find changed fields (excluding timestamps)
        FOR key IN SELECT jsonb_object_keys(old_jsonb)
        LOOP
            IF key NOT IN ('updated_at', 'created_at') AND 
               (old_jsonb->key IS DISTINCT FROM new_jsonb->key) THEN
                changed_fields := array_append(changed_fields, key);
            END IF;
        END LOOP;
        
        -- Skip if no meaningful changes
        IF array_length(changed_fields, 1) IS NULL OR array_length(changed_fields, 1) = 0 THEN
            RETURN NEW;
        END IF;
        
        -- Determine specific change type
        IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
            change_type := 'delete';
            summary := 'Record moved to trash';
        ELSIF NEW.is_deleted = false AND OLD.is_deleted = true THEN
            change_type := 'restore';
            summary := 'Record restored from trash';
        ELSIF NEW.is_archived = true AND OLD.is_archived = false THEN
            change_type := 'archive';
            summary := 'Record archived';
        ELSIF NEW.is_archived = false AND OLD.is_archived = true THEN
            change_type := 'unarchive';
            summary := 'Record unarchived';
        ELSE
            change_type := 'update';
            summary := 'Updated: ' || array_to_string(changed_fields, ', ');
        END IF;
        
        -- Create version snapshot (saves OLD data before change)
        PERFORM create_version_snapshot(
            TG_TABLE_NAME,
            NEW.id,
            old_jsonb,
            changed_fields,
            change_type
        );
        
        -- Create activity entry
        PERFORM create_activity_entry(
            TG_TABLE_NAME,
            NEW.id,
            change_type,
            summary,
            jsonb_build_object(
                'changed_fields', changed_fields,
                'old_values', (
                    SELECT jsonb_object_agg(f, old_jsonb->f)
                    FROM unnest(changed_fields) AS f
                ),
                'new_values', (
                    SELECT jsonb_object_agg(f, new_jsonb->f)
                    FROM unnest(changed_fields) AS f
                )
            )
        );
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. APPLY VERSION TRACKING TRIGGERS
-- ============================================

-- Applications
DROP TRIGGER IF EXISTS tr_applications_version ON applications;
CREATE TRIGGER tr_applications_version
    AFTER INSERT OR UPDATE ON applications
    FOR EACH ROW
    EXECUTE FUNCTION track_record_version();

-- Partners
DROP TRIGGER IF EXISTS tr_partners_version ON partners;
CREATE TRIGGER tr_partners_version
    AFTER INSERT OR UPDATE ON partners
    FOR EACH ROW
    EXECUTE FUNCTION track_record_version();

-- RTOs
DROP TRIGGER IF EXISTS tr_rtos_version ON rtos;
CREATE TRIGGER tr_rtos_version
    AFTER INSERT OR UPDATE ON rtos
    FOR EACH ROW
    EXECUTE FUNCTION track_record_version();

-- Qualifications
DROP TRIGGER IF EXISTS tr_qualifications_version ON qualifications;
CREATE TRIGGER tr_qualifications_version
    AFTER INSERT OR UPDATE ON qualifications
    FOR EACH ROW
    EXECUTE FUNCTION track_record_version();

-- RTO Offerings
DROP TRIGGER IF EXISTS tr_rto_offerings_version ON rto_offerings;
CREATE TRIGGER tr_rto_offerings_version
    AFTER INSERT OR UPDATE ON rto_offerings
    FOR EACH ROW
    EXECUTE FUNCTION track_record_version();

-- Documents
DROP TRIGGER IF EXISTS tr_documents_version ON documents;
CREATE TRIGGER tr_documents_version
    AFTER INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION track_record_version();

-- Invoices
DROP TRIGGER IF EXISTS tr_invoices_version ON invoices;
CREATE TRIGGER tr_invoices_version
    AFTER INSERT OR UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION track_record_version();

-- Email Templates
DROP TRIGGER IF EXISTS tr_email_templates_version ON email_templates;
CREATE TRIGGER tr_email_templates_version
    AFTER INSERT OR UPDATE ON email_templates
    FOR EACH ROW
    EXECUTE FUNCTION track_record_version();

-- ============================================
-- 10. RLS POLICIES FOR NEW TABLES
-- ============================================

ALTER TABLE record_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_activity ENABLE ROW LEVEL SECURITY;

-- Record Versions: Staff+ can view all, agents can view their related records
CREATE POLICY "Staff can view all versions"
    ON record_versions FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'staff')));

CREATE POLICY "System can insert versions"
    ON record_versions FOR INSERT TO authenticated
    WITH CHECK (true);

-- Record Activity: Staff+ can view all, agents can view their related records
CREATE POLICY "Staff can view all activity"
    ON record_activity FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'staff')));

CREATE POLICY "System can insert activity"
    ON record_activity FOR INSERT TO authenticated
    WITH CHECK (true);

-- ============================================
-- 11. FUNCTION: RESTORE TO SPECIFIC VERSION
-- ============================================

CREATE OR REPLACE FUNCTION restore_to_version(
    p_table_name VARCHAR,
    p_record_id UUID,
    p_version_number INTEGER,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    version_data JSONB;
    restore_sql TEXT;
    col_name TEXT;
    col_value TEXT;
    set_clauses TEXT[] := '{}';
    excluded_cols TEXT[] := ARRAY['id', 'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'deleted_by', 'is_archived', 'archived_at', 'archived_by'];
BEGIN
    -- Get the version data
    SELECT data INTO version_data
    FROM record_versions
    WHERE table_name = p_table_name 
      AND record_id = p_record_id 
      AND version_number = p_version_number;
    
    IF version_data IS NULL THEN
        RAISE EXCEPTION 'Version not found';
    END IF;
    
    -- Build SET clauses for each column (excluding system columns)
    FOR col_name IN SELECT jsonb_object_keys(version_data)
    LOOP
        IF col_name != ALL(excluded_cols) THEN
            set_clauses := array_append(
                set_clauses, 
                format('%I = %L', col_name, version_data->>col_name)
            );
        END IF;
    END LOOP;
    
    -- Build and execute the update
    restore_sql := format(
        'UPDATE %I SET %s, updated_at = now() WHERE id = %L',
        p_table_name,
        array_to_string(set_clauses, ', '),
        p_record_id
    );
    
    EXECUTE restore_sql;
    
    -- Log the restore action
    PERFORM create_activity_entry(
        p_table_name,
        p_record_id,
        'version_restored',
        format('Restored to version %s', p_version_number),
        jsonb_build_object('restored_version', p_version_number, 'reason', p_reason)
    );
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. VIEW: TRASH BIN (All deleted records)
-- ============================================

CREATE OR REPLACE VIEW trash_bin AS
SELECT 
    'applications' as table_name,
    id as record_id,
    student_uid as identifier,
    CONCAT(student_first_name, ' ', student_last_name) as display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM profiles WHERE id = deleted_by) as deleted_by_name
FROM applications WHERE is_deleted = true

UNION ALL

SELECT 
    'partners' as table_name,
    id as record_id,
    email as identifier,
    company_name as display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM profiles WHERE id = deleted_by) as deleted_by_name
FROM partners WHERE is_deleted = true

UNION ALL

SELECT 
    'rtos' as table_name,
    id as record_id,
    code as identifier,
    name as display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM profiles WHERE id = deleted_by) as deleted_by_name
FROM rtos WHERE is_deleted = true

UNION ALL

SELECT 
    'qualifications' as table_name,
    id as record_id,
    code as identifier,
    name as display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM profiles WHERE id = deleted_by) as deleted_by_name
FROM qualifications WHERE is_deleted = true

UNION ALL

SELECT 
    'invoices' as table_name,
    id as record_id,
    invoice_number as identifier,
    student_name as display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM profiles WHERE id = deleted_by) as deleted_by_name
FROM invoices WHERE is_deleted = true

ORDER BY deleted_at DESC;

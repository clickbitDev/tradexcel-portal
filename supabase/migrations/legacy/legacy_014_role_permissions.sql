-- ============================================
-- ROLE PERMISSIONS SYSTEM
-- Migration: 014_role_permissions
-- ============================================
-- Persists role permission configurations to database
-- and adds field visibility controls

-- ===========================================
-- ROLE PERMISSIONS TABLE
-- ===========================================
-- Stores permission grants per role (keyed by role + permission_key)

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role user_role NOT NULL,
    permission_key TEXT NOT NULL,
    granted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role, permission_key)
);

-- Add updated_at trigger
CREATE TRIGGER update_role_permissions_updated_at
    BEFORE UPDATE ON role_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- ROLE HIDDEN FIELDS TABLE
-- ===========================================
-- Stores which fields should be completely hidden from which roles
-- context: 'application', 'partner', 'rto', etc.

CREATE TABLE IF NOT EXISTS role_hidden_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role user_role NOT NULL,
    field_name TEXT NOT NULL,
    context TEXT NOT NULL DEFAULT 'application',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role, field_name, context)
);

-- ===========================================
-- INDEXES FOR PERFORMANCE
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_key ON role_permissions(permission_key);
CREATE INDEX IF NOT EXISTS idx_role_hidden_fields_role ON role_hidden_fields(role);
CREATE INDEX IF NOT EXISTS idx_role_hidden_fields_context ON role_hidden_fields(context);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_hidden_fields ENABLE ROW LEVEL SECURITY;

-- Only admin-level users can read permissions
DROP POLICY IF EXISTS "Admins can read role_permissions" ON role_permissions;
CREATE POLICY "Admins can read role_permissions" ON role_permissions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('ceo', 'developer', 'admin', 'executive_manager')
        )
    );

-- Only admin-level users can modify permissions
DROP POLICY IF EXISTS "Admins can modify role_permissions" ON role_permissions;
CREATE POLICY "Admins can modify role_permissions" ON role_permissions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('ceo', 'developer')
        )
    );

-- All authenticated users can read hidden fields (for their role)
DROP POLICY IF EXISTS "Users can read hidden_fields" ON role_hidden_fields;
CREATE POLICY "Users can read hidden_fields" ON role_hidden_fields
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Only admin-level users can modify hidden fields
DROP POLICY IF EXISTS "Admins can modify hidden_fields" ON role_hidden_fields;
CREATE POLICY "Admins can modify hidden_fields" ON role_hidden_fields
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('ceo', 'developer')
        )
    );

-- ===========================================
-- SEED DEFAULT PERMISSIONS
-- ===========================================
-- Insert default permissions for each role based on current hardcoded values

-- CEO and Developer get all permissions
INSERT INTO role_permissions (role, permission_key, granted)
SELECT r.role, p.key, true
FROM (VALUES ('ceo'::user_role), ('developer'::user_role)) AS r(role)
CROSS JOIN (VALUES 
    ('applications.view'), ('applications.create'), ('applications.edit'), ('applications.delete'),
    ('applications.change_stage'), ('applications.assign'),
    ('documents.view'), ('documents.upload'), ('documents.verify'), ('documents.delete'),
    ('rtos.view'), ('rtos.manage'), ('qualifications.view'), ('qualifications.manage'),
    ('partners.view'), ('partners.manage'), ('partners.view_kpi'),
    ('tickets.view'), ('tickets.create'), ('tickets.manage'),
    ('staff.view'), ('staff.manage'), ('roles.manage'),
    ('audit.view'), ('templates.manage'), ('settings.manage')
) AS p(key)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Executive Manager
INSERT INTO role_permissions (role, permission_key, granted) VALUES
    ('executive_manager', 'applications.view', true),
    ('executive_manager', 'applications.create', true),
    ('executive_manager', 'applications.edit', true),
    ('executive_manager', 'applications.delete', false),
    ('executive_manager', 'applications.change_stage', true),
    ('executive_manager', 'applications.assign', true),
    ('executive_manager', 'documents.view', true),
    ('executive_manager', 'documents.upload', true),
    ('executive_manager', 'documents.verify', true),
    ('executive_manager', 'documents.delete', false),
    ('executive_manager', 'rtos.view', true),
    ('executive_manager', 'rtos.manage', true),
    ('executive_manager', 'qualifications.view', true),
    ('executive_manager', 'qualifications.manage', true),
    ('executive_manager', 'partners.view', true),
    ('executive_manager', 'partners.manage', true),
    ('executive_manager', 'partners.view_kpi', true),
    ('executive_manager', 'tickets.view', true),
    ('executive_manager', 'tickets.create', true),
    ('executive_manager', 'tickets.manage', true),
    ('executive_manager', 'staff.view', true),
    ('executive_manager', 'staff.manage', false),
    ('executive_manager', 'roles.manage', false),
    ('executive_manager', 'audit.view', true),
    ('executive_manager', 'templates.manage', true),
    ('executive_manager', 'settings.manage', false)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Admin
INSERT INTO role_permissions (role, permission_key, granted) VALUES
    ('admin', 'applications.view', true),
    ('admin', 'applications.create', true),
    ('admin', 'applications.edit', true),
    ('admin', 'applications.delete', false),
    ('admin', 'applications.change_stage', true),
    ('admin', 'applications.assign', true),
    ('admin', 'documents.view', true),
    ('admin', 'documents.upload', true),
    ('admin', 'documents.verify', true),
    ('admin', 'documents.delete', false),
    ('admin', 'rtos.view', true),
    ('admin', 'rtos.manage', true),
    ('admin', 'qualifications.view', true),
    ('admin', 'qualifications.manage', true),
    ('admin', 'partners.view', true),
    ('admin', 'partners.manage', true),
    ('admin', 'partners.view_kpi', true),
    ('admin', 'tickets.view', true),
    ('admin', 'tickets.create', true),
    ('admin', 'tickets.manage', true),
    ('admin', 'staff.view', true),
    ('admin', 'staff.manage', false),
    ('admin', 'roles.manage', false),
    ('admin', 'audit.view', true),
    ('admin', 'templates.manage', false),
    ('admin', 'settings.manage', false)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Accounts Manager
INSERT INTO role_permissions (role, permission_key, granted) VALUES
    ('accounts_manager', 'applications.view', true),
    ('accounts_manager', 'applications.create', true),
    ('accounts_manager', 'applications.edit', true),
    ('accounts_manager', 'applications.delete', false),
    ('accounts_manager', 'applications.change_stage', true),
    ('accounts_manager', 'applications.assign', false),
    ('accounts_manager', 'documents.view', true),
    ('accounts_manager', 'documents.upload', true),
    ('accounts_manager', 'documents.verify', false),
    ('accounts_manager', 'documents.delete', false),
    ('accounts_manager', 'rtos.view', true),
    ('accounts_manager', 'rtos.manage', false),
    ('accounts_manager', 'qualifications.view', true),
    ('accounts_manager', 'qualifications.manage', false),
    ('accounts_manager', 'partners.view', true),
    ('accounts_manager', 'partners.manage', false),
    ('accounts_manager', 'partners.view_kpi', true),
    ('accounts_manager', 'tickets.view', true),
    ('accounts_manager', 'tickets.create', true),
    ('accounts_manager', 'tickets.manage', false),
    ('accounts_manager', 'staff.view', false),
    ('accounts_manager', 'staff.manage', false),
    ('accounts_manager', 'roles.manage', false),
    ('accounts_manager', 'audit.view', false),
    ('accounts_manager', 'templates.manage', false),
    ('accounts_manager', 'settings.manage', false)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Assessor
INSERT INTO role_permissions (role, permission_key, granted) VALUES
    ('assessor', 'applications.view', true),
    ('assessor', 'applications.create', true),
    ('assessor', 'applications.edit', true),
    ('assessor', 'applications.delete', false),
    ('assessor', 'applications.change_stage', true),
    ('assessor', 'applications.assign', false),
    ('assessor', 'documents.view', true),
    ('assessor', 'documents.upload', true),
    ('assessor', 'documents.verify', true),
    ('assessor', 'documents.delete', false),
    ('assessor', 'rtos.view', true),
    ('assessor', 'rtos.manage', false),
    ('assessor', 'qualifications.view', true),
    ('assessor', 'qualifications.manage', false),
    ('assessor', 'partners.view', true),
    ('assessor', 'partners.manage', false),
    ('assessor', 'partners.view_kpi', false),
    ('assessor', 'tickets.view', true),
    ('assessor', 'tickets.create', true),
    ('assessor', 'tickets.manage', false),
    ('assessor', 'staff.view', false),
    ('assessor', 'staff.manage', false),
    ('assessor', 'roles.manage', false),
    ('assessor', 'audit.view', false),
    ('assessor', 'templates.manage', false),
    ('assessor', 'settings.manage', false)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Dispatch Coordinator
INSERT INTO role_permissions (role, permission_key, granted) VALUES
    ('dispatch_coordinator', 'applications.view', true),
    ('dispatch_coordinator', 'applications.create', true),
    ('dispatch_coordinator', 'applications.edit', true),
    ('dispatch_coordinator', 'applications.delete', false),
    ('dispatch_coordinator', 'applications.change_stage', true),
    ('dispatch_coordinator', 'applications.assign', false),
    ('dispatch_coordinator', 'documents.view', true),
    ('dispatch_coordinator', 'documents.upload', true),
    ('dispatch_coordinator', 'documents.verify', false),
    ('dispatch_coordinator', 'documents.delete', false),
    ('dispatch_coordinator', 'rtos.view', true),
    ('dispatch_coordinator', 'rtos.manage', false),
    ('dispatch_coordinator', 'qualifications.view', true),
    ('dispatch_coordinator', 'qualifications.manage', false),
    ('dispatch_coordinator', 'partners.view', true),
    ('dispatch_coordinator', 'partners.manage', false),
    ('dispatch_coordinator', 'partners.view_kpi', false),
    ('dispatch_coordinator', 'tickets.view', true),
    ('dispatch_coordinator', 'tickets.create', true),
    ('dispatch_coordinator', 'tickets.manage', false),
    ('dispatch_coordinator', 'staff.view', false),
    ('dispatch_coordinator', 'staff.manage', false),
    ('dispatch_coordinator', 'roles.manage', false),
    ('dispatch_coordinator', 'audit.view', false),
    ('dispatch_coordinator', 'templates.manage', false),
    ('dispatch_coordinator', 'settings.manage', false)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Frontdesk
INSERT INTO role_permissions (role, permission_key, granted) VALUES
    ('frontdesk', 'applications.view', true),
    ('frontdesk', 'applications.create', true),
    ('frontdesk', 'applications.edit', true),
    ('frontdesk', 'applications.delete', false),
    ('frontdesk', 'applications.change_stage', true),
    ('frontdesk', 'applications.assign', false),
    ('frontdesk', 'documents.view', true),
    ('frontdesk', 'documents.upload', true),
    ('frontdesk', 'documents.verify', false),
    ('frontdesk', 'documents.delete', false),
    ('frontdesk', 'rtos.view', true),
    ('frontdesk', 'rtos.manage', false),
    ('frontdesk', 'qualifications.view', true),
    ('frontdesk', 'qualifications.manage', false),
    ('frontdesk', 'partners.view', true),
    ('frontdesk', 'partners.manage', false),
    ('frontdesk', 'partners.view_kpi', false),
    ('frontdesk', 'tickets.view', true),
    ('frontdesk', 'tickets.create', true),
    ('frontdesk', 'tickets.manage', false),
    ('frontdesk', 'staff.view', false),
    ('frontdesk', 'staff.manage', false),
    ('frontdesk', 'roles.manage', false),
    ('frontdesk', 'audit.view', false),
    ('frontdesk', 'templates.manage', false),
    ('frontdesk', 'settings.manage', false)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Agent (limited access)
INSERT INTO role_permissions (role, permission_key, granted) VALUES
    ('agent', 'applications.view', true),
    ('agent', 'applications.create', true),
    ('agent', 'applications.edit', false),
    ('agent', 'applications.delete', false),
    ('agent', 'applications.change_stage', false),
    ('agent', 'applications.assign', false),
    ('agent', 'documents.view', true),
    ('agent', 'documents.upload', true),
    ('agent', 'documents.verify', false),
    ('agent', 'documents.delete', false),
    ('agent', 'rtos.view', true),
    ('agent', 'rtos.manage', false),
    ('agent', 'qualifications.view', true),
    ('agent', 'qualifications.manage', false),
    ('agent', 'partners.view', false),
    ('agent', 'partners.manage', false),
    ('agent', 'partners.view_kpi', false),
    ('agent', 'tickets.view', true),
    ('agent', 'tickets.create', true),
    ('agent', 'tickets.manage', false),
    ('agent', 'staff.view', false),
    ('agent', 'staff.manage', false),
    ('agent', 'roles.manage', false),
    ('agent', 'audit.view', false),
    ('agent', 'templates.manage', false),
    ('agent', 'settings.manage', false)
ON CONFLICT (role, permission_key) DO NOTHING;

-- ===========================================
-- GRANT PERMISSIONS
-- ===========================================

GRANT SELECT, INSERT, UPDATE, DELETE ON role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON role_hidden_fields TO authenticated;

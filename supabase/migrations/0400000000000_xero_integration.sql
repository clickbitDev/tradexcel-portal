-- Migration: 040_xero_integration.sql
-- Description: Add Xero OAuth integration tables and columns
-- Created: 2026-01-21

-- ============================================
-- 1. Xero Connection Table (OAuth tokens)
-- ============================================
CREATE TABLE IF NOT EXISTS xero_connection (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- OAuth Tokens (encrypted at rest by Supabase)
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    token_expires_at timestamptz NOT NULL,
    token_type varchar(50) DEFAULT 'Bearer',
    
    -- Xero Organization Info
    tenant_id varchar(100) NOT NULL,
    tenant_name varchar(255),
    tenant_type varchar(50), -- 'ORGANISATION', 'PRACTICE', etc.
    
    -- Connection Metadata
    scopes text[], -- Array of granted scopes
    connected_at timestamptz DEFAULT now(),
    connected_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- Status
    is_active boolean DEFAULT true,
    last_refreshed_at timestamptz,
    last_sync_at timestamptz,
    
    -- Error tracking
    last_error text,
    last_error_at timestamptz,
    error_count integer DEFAULT 0,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Ensure only one active connection at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_xero_connection_active 
ON xero_connection (is_active) WHERE is_active = true;

-- Index for token refresh checks
CREATE INDEX IF NOT EXISTS idx_xero_connection_expires 
ON xero_connection (token_expires_at) WHERE is_active = true;

-- ============================================
-- 2. Xero Entity Mapping Table
-- ============================================
CREATE TABLE IF NOT EXISTS xero_entity_map (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Entity Type: 'agent', 'partner', 'rto', 'invoice', 'bill', 'payment'
    entity_type varchar(50) NOT NULL,
    
    -- Lumiere Reference
    lumiere_id uuid NOT NULL,
    
    -- Xero Reference
    xero_id varchar(100) NOT NULL,
    xero_number varchar(50), -- INV-00123, BILL-00456, etc.
    xero_url varchar(500), -- Direct link to Xero
    
    -- Sync Status
    sync_status varchar(20) DEFAULT 'synced', -- 'synced', 'pending', 'error', 'deleted'
    sync_direction varchar(10) DEFAULT 'push', -- 'push' (Lumiere→Xero), 'pull' (Xero→Lumiere)
    last_synced_at timestamptz DEFAULT now(),
    
    -- Error tracking
    sync_error text,
    sync_attempts integer DEFAULT 0,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Constraints
    CONSTRAINT xero_entity_map_unique UNIQUE (entity_type, lumiere_id)
);

-- Index for lookups by Xero ID
CREATE INDEX IF NOT EXISTS idx_xero_entity_map_xero_id 
ON xero_entity_map (xero_id);

-- Index for lookups by Lumiere ID
CREATE INDEX IF NOT EXISTS idx_xero_entity_map_lumiere 
ON xero_entity_map (entity_type, lumiere_id);

-- Index for pending sync items
CREATE INDEX IF NOT EXISTS idx_xero_entity_map_pending 
ON xero_entity_map (sync_status) WHERE sync_status = 'pending';

-- ============================================
-- 3. Application-Level Xero Linking
-- ============================================
ALTER TABLE applications ADD COLUMN IF NOT EXISTS xero_invoice_id varchar(100);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS xero_invoice_number varchar(50);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS xero_invoice_status varchar(30);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS xero_invoice_url varchar(500);

ALTER TABLE applications ADD COLUMN IF NOT EXISTS xero_bill_id varchar(100);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS xero_bill_number varchar(50);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS xero_bill_status varchar(30);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS xero_bill_url varchar(500);

ALTER TABLE applications ADD COLUMN IF NOT EXISTS xero_last_synced_at timestamptz;

-- ============================================
-- 4. Invoice-Level Xero Linking
-- ============================================
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_invoice_id varchar(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_invoice_url varchar(500);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_sent_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_status varchar(30);

-- ============================================
-- 5. Bill-Level Xero Linking
-- ============================================
ALTER TABLE bills ADD COLUMN IF NOT EXISTS xero_bill_id varchar(100);
ALTER TABLE bills ADD COLUMN IF NOT EXISTS xero_bill_url varchar(500);
ALTER TABLE bills ADD COLUMN IF NOT EXISTS xero_status varchar(30);

-- ============================================
-- 6. Partner/Agent Xero Contact Linking
-- ============================================
ALTER TABLE partners ADD COLUMN IF NOT EXISTS xero_contact_id varchar(100);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS xero_contact_url varchar(500);

-- ============================================
-- 7. RTO Xero Supplier Linking
-- ============================================
ALTER TABLE rtos ADD COLUMN IF NOT EXISTS xero_contact_id varchar(100);
ALTER TABLE rtos ADD COLUMN IF NOT EXISTS xero_contact_url varchar(500);

-- ============================================
-- 8. Row Level Security
-- ============================================
ALTER TABLE xero_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_entity_map ENABLE ROW LEVEL SECURITY;

-- Only staff can view/manage Xero connection
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'xero_connection' AND policyname = 'Staff can view xero connection'
    ) THEN
        CREATE POLICY "Staff can view xero connection"
        ON xero_connection FOR SELECT
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM profiles
                WHERE id = auth.uid()
                AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer')
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'xero_connection' AND policyname = 'Admin staff can manage xero connection'
    ) THEN
        CREATE POLICY "Admin staff can manage xero connection"
        ON xero_connection FOR ALL
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM profiles
                WHERE id = auth.uid()
                AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer')
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM profiles
                WHERE id = auth.uid()
                AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer')
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'xero_entity_map' AND policyname = 'Staff can view xero entity map'
    ) THEN
        CREATE POLICY "Staff can view xero entity map"
        ON xero_entity_map FOR SELECT
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM profiles
                WHERE id = auth.uid()
                AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer')
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'xero_entity_map' AND policyname = 'Staff can manage xero entity map'
    ) THEN
        CREATE POLICY "Staff can manage xero entity map"
        ON xero_entity_map FOR ALL
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM profiles
                WHERE id = auth.uid()
                AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer')
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM profiles
                WHERE id = auth.uid()
                AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer')
            )
        );
    END IF;
END$$;

-- ============================================
-- 9. Updated At Trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_xero_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_xero_connection_updated ON xero_connection;
CREATE TRIGGER tr_xero_connection_updated
    BEFORE UPDATE ON xero_connection
    FOR EACH ROW
    EXECUTE FUNCTION update_xero_updated_at();

DROP TRIGGER IF EXISTS tr_xero_entity_map_updated ON xero_entity_map;
CREATE TRIGGER tr_xero_entity_map_updated
    BEFORE UPDATE ON xero_entity_map
    FOR EACH ROW
    EXECUTE FUNCTION update_xero_updated_at();

-- ============================================
-- 10. Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_applications_xero_invoice ON applications (xero_invoice_id) WHERE xero_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_applications_xero_bill ON applications (xero_bill_id) WHERE xero_bill_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_xero ON invoices (xero_invoice_id) WHERE xero_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bills_xero ON bills (xero_bill_id) WHERE xero_bill_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partners_xero ON partners (xero_contact_id) WHERE xero_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rtos_xero ON rtos (xero_contact_id) WHERE xero_contact_id IS NOT NULL;

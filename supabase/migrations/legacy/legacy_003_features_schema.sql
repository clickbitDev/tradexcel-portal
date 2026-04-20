-- Migration: 003_features_schema
-- Adds tables for invoices, notifications, reminders, source tracking, and admin impersonation

-- ============================================
-- 1. INVOICES
-- ============================================

CREATE TABLE IF NOT EXISTS invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number varchar(20) NOT NULL UNIQUE,
    application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
    partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
    
    -- Invoice details
    student_name varchar(255) NOT NULL,
    course_name varchar(255),
    rto_name varchar(255),
    
    -- Amounts
    tuition_fee decimal(10,2) DEFAULT 0,
    material_fee decimal(10,2) DEFAULT 0,
    application_fee decimal(10,2) DEFAULT 0,
    other_fees decimal(10,2) DEFAULT 0,
    discount decimal(10,2) DEFAULT 0,
    total_amount decimal(10,2) NOT NULL,
    
    -- Status
    status varchar(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    due_date date,
    paid_at timestamptz,
    
    -- PDF storage
    pdf_url text,
    
    -- Metadata
    notes text,
    created_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Invoice number sequence
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    next_num INTEGER;
BEGIN
    year_prefix := 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-';
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM year_prefix || '(\d+)$') AS INTEGER)), 0) + 1
    INTO next_num
    FROM invoices
    WHERE invoice_number LIKE year_prefix || '%';
    
    NEW.invoice_number := year_prefix || LPAD(next_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number
    BEFORE INSERT ON invoices
    FOR EACH ROW
    WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
    EXECUTE FUNCTION generate_invoice_number();

-- ============================================
-- 2. NOTIFICATION SYSTEM
-- ============================================

CREATE TYPE notification_channel AS ENUM ('email', 'whatsapp', 'sms');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed', 'cancelled');

CREATE TABLE IF NOT EXISTS notification_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel notification_channel NOT NULL,
    recipient varchar(255) NOT NULL,
    subject varchar(255),
    body text NOT NULL,
    
    -- References
    application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
    partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
    template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
    
    -- Status tracking
    status notification_status DEFAULT 'pending',
    scheduled_at timestamptz DEFAULT now(),
    sent_at timestamptz,
    error_message text,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    
    -- Metadata
    metadata jsonb,
    created_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id uuid REFERENCES notification_queue(id) ON DELETE SET NULL,
    channel notification_channel NOT NULL,
    recipient varchar(255) NOT NULL,
    subject varchar(255),
    status notification_status NOT NULL,
    
    -- Provider response
    provider_message_id varchar(255),
    provider_response jsonb,
    
    created_at timestamptz DEFAULT now()
);

-- ============================================
-- 3. SCHEDULED REMINDERS
-- ============================================

CREATE TYPE reminder_status AS ENUM ('active', 'paused', 'completed', 'expired');

CREATE TABLE IF NOT EXISTS scheduled_reminders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    description text,
    
    -- Trigger conditions
    trigger_type varchar(50) NOT NULL, -- 'stage_duration', 'missing_document', 'payment_due'
    trigger_config jsonb NOT NULL, -- {"stage": "docs_review", "days": 7}
    
    -- Action
    notification_channel notification_channel NOT NULL,
    template_id uuid REFERENCES email_templates(id),
    custom_message text,
    
    -- Status
    status reminder_status DEFAULT 'active',
    last_run_at timestamptz,
    next_run_at timestamptz,
    
    -- Metadata
    created_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminder_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reminder_id uuid REFERENCES scheduled_reminders(id) ON DELETE CASCADE,
    application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
    notification_id uuid REFERENCES notification_queue(id) ON DELETE SET NULL,
    triggered_at timestamptz DEFAULT now(),
    notes text
);

-- ============================================
-- 4. LEAD/QUERY SOURCE TRACKING
-- ============================================

CREATE TYPE query_source_type AS ENUM ('web_form', 'api', 'manual', 'import', 'referral', 'walk_in');

CREATE TABLE IF NOT EXISTS lead_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    source_type query_source_type NOT NULL,
    identifier varchar(100), -- Form ID, API key name, etc.
    description text,
    is_active boolean DEFAULT true,
    
    -- Tracking
    total_leads integer DEFAULT 0,
    conversion_rate decimal(5,2),
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add source tracking fields to applications
ALTER TABLE applications ADD COLUMN IF NOT EXISTS query_source query_source_type;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS query_source_id varchar(100);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS lead_source_id uuid REFERENCES lead_sources(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS referrer_url text;

-- ============================================
-- 5. ADMIN IMPERSONATION
-- ============================================

CREATE TABLE IF NOT EXISTS admin_impersonation_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id uuid NOT NULL REFERENCES profiles(id),
    impersonated_user_id uuid NOT NULL REFERENCES profiles(id),
    reason text NOT NULL,
    
    -- Session tracking
    started_at timestamptz DEFAULT now(),
    ended_at timestamptz,
    ip_address inet,
    user_agent text,
    
    -- Actions during impersonation
    actions_count integer DEFAULT 0
);

-- ============================================
-- 6. WORKFLOW TRANSITIONS (for enforcement)
-- ============================================

CREATE TABLE IF NOT EXISTS workflow_transitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_stage workflow_stage NOT NULL,
    to_stage workflow_stage NOT NULL,
    is_allowed boolean DEFAULT true,
    requires_approval boolean DEFAULT false,
    required_role user_role,
    
    UNIQUE(from_stage, to_stage)
);

-- Insert valid workflow transitions
INSERT INTO workflow_transitions (from_stage, to_stage, is_allowed) VALUES
    ('draft', 'submitted', true),
    ('draft', 'withdrawn', true),
    ('submitted', 'docs_review', true),
    ('submitted', 'rejected', true),
    ('submitted', 'withdrawn', true),
    ('docs_review', 'rto_processing', true),
    ('docs_review', 'submitted', true),
    ('docs_review', 'rejected', true),
    ('docs_review', 'withdrawn', true),
    ('rto_processing', 'offer_issued', true),
    ('rto_processing', 'rejected', true),
    ('rto_processing', 'withdrawn', true),
    ('offer_issued', 'payment_pending', true),
    ('offer_issued', 'withdrawn', true),
    ('payment_pending', 'coe_issued', true),
    ('payment_pending', 'withdrawn', true),
    ('coe_issued', 'visa_applied', true),
    ('coe_issued', 'enrolled', true),
    ('coe_issued', 'withdrawn', true),
    ('visa_applied', 'enrolled', true),
    ('visa_applied', 'withdrawn', true),
    ('enrolled', 'withdrawn', true)
ON CONFLICT (from_stage, to_stage) DO NOTHING;

-- ============================================
-- 7. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_invoices_application ON invoices(application_id);
CREATE INDEX IF NOT EXISTS idx_invoices_partner ON invoices(partner_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled ON notification_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_applications_source ON applications(lead_source_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_admin ON admin_impersonation_logs(admin_id);

-- ============================================
-- 8. RLS POLICIES
-- ============================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_impersonation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_transitions ENABLE ROW LEVEL SECURITY;

-- Invoices: Staff can manage, agents see their own
CREATE POLICY "Staff can manage invoices"
    ON invoices FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'staff')));

CREATE POLICY "Agents can view own invoices"
    ON invoices FOR SELECT TO authenticated
    USING (partner_id IN (SELECT id FROM partners WHERE user_id = auth.uid()));

-- Notifications: Staff only
CREATE POLICY "Staff can manage notifications"
    ON notification_queue FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'staff')));

CREATE POLICY "Staff can view notification logs"
    ON notification_logs FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'staff')));

-- Reminders: Staff only
CREATE POLICY "Staff can manage reminders"
    ON scheduled_reminders FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'staff')));

-- Lead sources: Staff can manage, all can read
CREATE POLICY "All can read lead sources"
    ON lead_sources FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can manage lead sources"
    ON lead_sources FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'staff')));

-- Impersonation logs: Admin only
CREATE POLICY "Admin can view impersonation logs"
    ON admin_impersonation_logs FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin can insert impersonation logs"
    ON admin_impersonation_logs FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Workflow transitions: All can read
CREATE POLICY "All can read workflow transitions"
    ON workflow_transitions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage workflow transitions"
    ON workflow_transitions FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

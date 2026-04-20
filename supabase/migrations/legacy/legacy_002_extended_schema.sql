-- Phase 2: Extended Schema Migration
-- Adds new tables and fields required for full portal functionality

-- ============================================
-- 1. Extend existing tables
-- ============================================

-- Add fields to qualifications
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS core_units integer;
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS elective_units integer;
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS total_units integer;
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS entry_requirements text;
ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS cricos_code varchar(20);

-- Add fields to rtos
ALTER TABLE rtos ADD COLUMN IF NOT EXISTS cricos_provider_code varchar(20);
ALTER TABLE rtos ADD COLUMN IF NOT EXISTS delivery_modes text[] DEFAULT '{}';
ALTER TABLE rtos ADD COLUMN IF NOT EXISTS certificate_types text[] DEFAULT '{}';

-- Add fields to rto_offerings for price versioning
ALTER TABLE rto_offerings ADD COLUMN IF NOT EXISTS effective_date date DEFAULT CURRENT_DATE;
ALTER TABLE rto_offerings ADD COLUMN IF NOT EXISTS expiry_date date;
ALTER TABLE rto_offerings ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;
ALTER TABLE rto_offerings ADD COLUMN IF NOT EXISTS approval_status varchar(20) DEFAULT 'published' 
  CHECK (approval_status IN ('draft', 'pending_review', 'published', 'archived'));

-- Add KPI and assignment fields to partners
ALTER TABLE partners ADD COLUMN IF NOT EXISTS delivery_method varchar(50);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS kpi_ontime_rate decimal(5,2);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS kpi_conversion_rate decimal(5,2);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS assigned_manager_id uuid REFERENCES profiles(id);

-- Add workflow fields to applications
ALTER TABLE applications ADD COLUMN IF NOT EXISTS assigned_staff_id uuid REFERENCES profiles(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES profiles(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS lock_timestamp timestamptz;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS student_master_id uuid;

-- ============================================
-- 2. New Tables
-- ============================================

-- Student Master Database
CREATE TABLE IF NOT EXISTS student_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  email varchar(255),
  phone varchar(50),
  passport_number varchar(50),
  nationality varchar(100),
  dob date,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add foreign key for student_master_id
ALTER TABLE applications ADD CONSTRAINT fk_student_master 
  FOREIGN KEY (student_master_id) REFERENCES student_master(id) ON DELETE SET NULL;

-- Documents table for file management
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  document_type varchar(100) NOT NULL,
  file_name varchar(255) NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  mime_type varchar(100),
  version integer DEFAULT 1,
  is_verified boolean DEFAULT false,
  verified_by uuid REFERENCES profiles(id),
  verified_at timestamptz,
  notes text,
  uploaded_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Audit logs for compliance
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  action varchar(50) NOT NULL,
  table_name varchar(100) NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Tickets/Queries system
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject varchar(255) NOT NULL,
  description text,
  status ticket_status DEFAULT 'open',
  priority ticket_priority DEFAULT 'normal',
  application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
  partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id),
  assigned_to uuid REFERENCES profiles(id),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ticket comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  content text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Application comments/notes
CREATE TABLE IF NOT EXISTS application_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  content text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Application workflow history
CREATE TABLE IF NOT EXISTS application_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  from_stage varchar(50),
  to_stage varchar(50) NOT NULL,
  changed_by uuid REFERENCES profiles(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE,
  subject varchar(255) NOT NULL,
  body text NOT NULL,
  variables text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Price versions for audit trail
CREATE TABLE IF NOT EXISTS price_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid REFERENCES rto_offerings(id) ON DELETE CASCADE,
  tuition_fee_onshore decimal(10,2),
  tuition_fee_offshore decimal(10,2),
  material_fee decimal(10,2),
  application_fee decimal(10,2),
  effective_from date NOT NULL,
  effective_to date,
  approved_by uuid REFERENCES profiles(id),
  approval_notes text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 3. Indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_documents_application ON documents(application_id);
CREATE INDEX IF NOT EXISTS idx_documents_partner ON documents(partner_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_application_comments_app ON application_comments(application_id);
CREATE INDEX IF NOT EXISTS idx_application_history_app ON application_history(application_id);

-- ============================================
-- 4. RLS Policies for new tables
-- ============================================

ALTER TABLE student_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_versions ENABLE ROW LEVEL SECURITY;

-- Documents: Staff can manage, agents can view their own
CREATE POLICY "Staff can manage documents"
  ON documents FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_role IN ('admin', 'manager', 'staff'))
  );

-- Audit logs: Admin only
CREATE POLICY "Admin can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_role = 'admin')
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Tickets: Staff can manage, agents see their own
CREATE POLICY "Staff can manage tickets"
  ON tickets FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_role IN ('admin', 'manager', 'staff'))
    OR created_by = auth.uid()
  );

-- Application comments: Staff and assigned agents
CREATE POLICY "Staff can manage application comments"
  ON application_comments FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_role IN ('admin', 'manager', 'staff'))
  );

-- Application history: Read-only for staff
CREATE POLICY "Staff can view application history"
  ON application_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_role IN ('admin', 'manager', 'staff'))
  );

CREATE POLICY "System can insert application history"
  ON application_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- 5. Trigger for application history
-- ============================================

CREATE OR REPLACE FUNCTION log_application_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.workflow_stage IS DISTINCT FROM NEW.workflow_stage THEN
    INSERT INTO application_history (application_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, OLD.workflow_stage, NEW.workflow_stage, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_application_stage_change ON applications;
CREATE TRIGGER tr_application_stage_change
  AFTER UPDATE OF workflow_stage ON applications
  FOR EACH ROW
  EXECUTE FUNCTION log_application_stage_change();

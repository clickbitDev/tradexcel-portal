-- ============================================
-- LUMIERE PORTAL DATABASE SCHEMA
-- Migration: 005_partners_enhancement
-- Partners Module Enhancements
-- ============================================

-- ============================================
-- 1. NEW ENUMS
-- ============================================

CREATE TYPE contact_channel AS ENUM ('email', 'phone', 'whatsapp', 'meeting', 'other');

-- ============================================
-- 2. EXTEND PARTNERS TABLE
-- ============================================

-- Preferred communication channel
ALTER TABLE partners ADD COLUMN IF NOT EXISTS preferred_channel contact_channel;

-- Link provider to their RTO (for fee display)
ALTER TABLE partners ADD COLUMN IF NOT EXISTS linked_rto_id UUID REFERENCES rtos(id);

-- Subagent hierarchy (parent-child relationship)
ALTER TABLE partners ADD COLUMN IF NOT EXISTS parent_partner_id UUID REFERENCES partners(id);

-- ============================================
-- 3. PARTNER CONTACT HISTORY (CRM)
-- ============================================

CREATE TABLE IF NOT EXISTS partner_contact_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  channel contact_channel NOT NULL,
  subject VARCHAR(255),
  content TEXT,
  contacted_by UUID REFERENCES profiles(id),
  contacted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_contact_history_partner 
  ON partner_contact_history(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_contact_history_date 
  ON partner_contact_history(contacted_at DESC);

-- ============================================
-- 4. AUTOMATED REMINDER CONFIGURATION
-- ============================================

CREATE TABLE IF NOT EXISTS partner_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  reminder_type VARCHAR(50) NOT NULL, -- 'intake_reminder', 'document_followup', 'payment_reminder'
  template_id UUID REFERENCES email_templates(id),
  days_before INTEGER NOT NULL DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_reminders_partner 
  ON partner_reminders(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_reminders_active 
  ON partner_reminders(is_active) WHERE is_active = true;

-- ============================================
-- 5. DOCUMENT REQUEST LINKS
-- ============================================

CREATE TABLE IF NOT EXISTS document_request_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  document_types TEXT[] NOT NULL,
  notes TEXT,
  expires_at TIMESTAMPTZ,
  max_uploads INTEGER,
  current_uploads INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_request_links_partner 
  ON document_request_links(partner_id);
CREATE INDEX IF NOT EXISTS idx_document_request_links_token 
  ON document_request_links(token);
CREATE INDEX IF NOT EXISTS idx_document_request_links_active 
  ON document_request_links(is_active, expires_at);

-- ============================================
-- 6. COMMISSION RULES
-- ============================================

CREATE TABLE IF NOT EXISTS partner_commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  qualification_id UUID REFERENCES qualifications(id), -- NULL = applies to all qualifications
  min_volume INTEGER, -- Minimum applications for this tier (NULL = no minimum)
  max_volume INTEGER, -- Maximum applications for this tier (NULL = no maximum)
  commission_rate DECIMAL(5,2) NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE, -- NULL = no end date
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure min <= max when both are set
  CONSTRAINT valid_volume_range CHECK (
    min_volume IS NULL OR max_volume IS NULL OR min_volume <= max_volume
  ),
  -- Ensure dates are valid
  CONSTRAINT valid_date_range CHECK (
    effective_to IS NULL OR effective_from <= effective_to
  )
);

CREATE INDEX IF NOT EXISTS idx_partner_commission_rules_partner 
  ON partner_commission_rules(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_commission_rules_qualification 
  ON partner_commission_rules(qualification_id);
CREATE INDEX IF NOT EXISTS idx_partner_commission_rules_active 
  ON partner_commission_rules(is_active, effective_from, effective_to);

-- ============================================
-- 7. RLS POLICIES
-- ============================================

ALTER TABLE partner_contact_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_request_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_commission_rules ENABLE ROW LEVEL SECURITY;

-- Contact History: Staff can manage, agents can view their own
CREATE POLICY "Staff manage contact history" 
  ON partner_contact_history FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'staff')
  ));

CREATE POLICY "Agents view own contact history" 
  ON partner_contact_history FOR SELECT TO authenticated
  USING (
    partner_id IN (SELECT id FROM partners WHERE user_id = auth.uid())
  );

-- Reminders: Staff only
CREATE POLICY "Staff manage reminders" 
  ON partner_reminders FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'staff')
  ));

-- Document Links: Staff can manage, public can use (via separate endpoint)
CREATE POLICY "Staff manage document links" 
  ON document_request_links FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'staff')
  ));

-- Commission Rules: Admin/Manager only (sensitive data)
CREATE POLICY "Managers manage commission rules" 
  ON partner_commission_rules FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
  ));

CREATE POLICY "Staff view commission rules" 
  ON partner_commission_rules FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'staff'
  ));

-- ============================================
-- 8. UPDATE TRIGGERS
-- ============================================

CREATE TRIGGER update_partner_reminders_timestamp 
  BEFORE UPDATE ON partner_reminders 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_partner_commission_rules_timestamp 
  BEFORE UPDATE ON partner_commission_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 9. HELPER FUNCTIONS
-- ============================================

-- Function to calculate commission for a given partner and qualification
CREATE OR REPLACE FUNCTION calculate_partner_commission(
  p_partner_id UUID,
  p_qualification_id UUID,
  p_volume INTEGER DEFAULT 1
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_rate DECIMAL(5,2);
BEGIN
  -- Find the best matching rule
  SELECT commission_rate INTO v_rate
  FROM partner_commission_rules
  WHERE partner_id = p_partner_id
    AND is_active = true
    AND (qualification_id IS NULL OR qualification_id = p_qualification_id)
    AND (effective_from <= CURRENT_DATE)
    AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
    AND (min_volume IS NULL OR min_volume <= p_volume)
    AND (max_volume IS NULL OR max_volume >= p_volume)
  ORDER BY 
    -- Prefer qualification-specific rules
    CASE WHEN qualification_id IS NOT NULL THEN 0 ELSE 1 END,
    -- Prefer more specific volume tiers
    CASE WHEN min_volume IS NOT NULL THEN 0 ELSE 1 END,
    -- Higher rates first if multiple match
    commission_rate DESC
  LIMIT 1;
  
  -- Fall back to partner's default rate if no rule found
  IF v_rate IS NULL THEN
    SELECT commission_rate INTO v_rate
    FROM partners
    WHERE id = p_partner_id;
  END IF;
  
  RETURN COALESCE(v_rate, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to generate a unique document request token
CREATE OR REPLACE FUNCTION generate_document_link_token()
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a URL-safe random token
    v_token := encode(gen_random_bytes(32), 'base64');
    -- Make it URL-safe
    v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
    -- Take first 32 characters
    v_token := substring(v_token from 1 for 32);
    
    -- Check if it already exists
    SELECT EXISTS(
      SELECT 1 FROM document_request_links WHERE token = v_token
    ) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_token;
END;
$$ LANGUAGE plpgsql;

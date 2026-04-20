-- ============================================
-- LUMIERE PORTAL DATABASE SCHEMA
-- Migration: 001_initial_schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES (extends auth.users)
-- ============================================
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff', 'agent');

CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'staff',
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Users can read all profiles, but only admins can update
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'staff')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. QUALIFICATIONS (Master Data)
-- ============================================
CREATE TYPE qualification_status AS ENUM ('current', 'superseded', 'deleted');
CREATE TYPE tga_sync_status AS ENUM ('synced', 'pending', 'error', 'never');

CREATE TABLE qualifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE, -- e.g., BSB50120
  name TEXT NOT NULL,
  level TEXT, -- Certificate IV, Diploma, etc.
  status qualification_status DEFAULT 'current',
  release_date DATE,
  superseded_by TEXT, -- code of replacement qualification
  tga_sync_status tga_sync_status DEFAULT 'never',
  tga_last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. RTOs (Registered Training Organizations)
-- ============================================
CREATE TYPE rto_status AS ENUM ('active', 'pending', 'suspended', 'inactive');

CREATE TABLE rtos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE, -- e.g., RTO 91234
  name TEXT NOT NULL,
  logo_url TEXT,
  status rto_status DEFAULT 'active',
  location TEXT,
  state TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. RTO_OFFERINGS (The Pricing Engine)
-- ============================================
CREATE TABLE rto_offerings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  rto_id UUID NOT NULL REFERENCES rtos(id) ON DELETE CASCADE,
  qualification_id UUID NOT NULL REFERENCES qualifications(id) ON DELETE CASCADE,
  
  -- Pricing
  tuition_fee_onshore DECIMAL(10,2),
  tuition_fee_offshore DECIMAL(10,2),
  material_fee DECIMAL(10,2) DEFAULT 0,
  application_fee DECIMAL(10,2) DEFAULT 0,
  
  -- Duration & Schedule
  duration_weeks INTEGER,
  intakes TEXT[], -- ['Feb', 'Jun', 'Oct']
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(rto_id, qualification_id)
);

-- ============================================
-- 5. PARTNERS (Consolidated Agents & Providers)
-- ============================================
CREATE TYPE partner_type AS ENUM ('agent', 'provider');
CREATE TYPE partner_status AS ENUM ('active', 'pending', 'suspended', 'inactive');
CREATE TYPE priority_level AS ENUM ('standard', 'preferred', 'premium');

CREATE TABLE partners (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type partner_type NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  address TEXT,
  country TEXT,
  
  -- Business Terms
  commission_rate DECIMAL(5,2), -- percentage
  priority_level priority_level DEFAULT 'standard',
  
  -- Linked user account (for agent portal access)
  user_id UUID REFERENCES profiles(id),
  
  status partner_status DEFAULT 'active',
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. APPLICATIONS (The Core Workload)
-- ============================================
CREATE TYPE workflow_stage AS ENUM (
  'draft',
  'submitted', 
  'docs_review',
  'rto_processing',
  'offer_issued',
  'payment_pending',
  'coe_issued',
  'visa_applied',
  'enrolled',
  'withdrawn',
  'rejected'
);

CREATE TYPE payment_status AS ENUM ('unpaid', 'partial', 'paid', 'refunded');

CREATE TABLE applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_uid TEXT UNIQUE NOT NULL, -- Auto-generated: APP-2024-001
  
  -- Student Info
  student_first_name TEXT NOT NULL,
  student_last_name TEXT NOT NULL,
  student_email TEXT,
  student_phone TEXT,
  student_dob DATE,
  student_passport_number TEXT,
  student_nationality TEXT,
  
  -- Relationships
  partner_id UUID REFERENCES partners(id),
  offering_id UUID NOT NULL REFERENCES rto_offerings(id), -- Locks in pricing
  
  -- Workflow
  workflow_stage workflow_stage DEFAULT 'draft',
  payment_status payment_status DEFAULT 'unpaid',
  
  -- Fees (copied from offering at time of application)
  quoted_tuition DECIMAL(10,2),
  quoted_materials DECIMAL(10,2),
  total_paid DECIMAL(10,2) DEFAULT 0,
  
  -- Dates
  intake_date DATE,
  submitted_at TIMESTAMPTZ,
  coe_issued_at TIMESTAMPTZ,
  
  -- Documents (Supabase Storage paths)
  documents JSONB DEFAULT '[]',
  
  -- Audit
  created_by UUID REFERENCES profiles(id),
  assigned_to UUID REFERENCES profiles(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_applications_stage ON applications(workflow_stage);
CREATE INDEX idx_applications_partner ON applications(partner_id);
CREATE INDEX idx_applications_uid ON applications(student_uid);
CREATE INDEX idx_rto_offerings_rto ON rto_offerings(rto_id);
CREATE INDEX idx_rto_offerings_qual ON rto_offerings(qualification_id);
CREATE INDEX idx_qualifications_code ON qualifications(code);
CREATE INDEX idx_rtos_code ON rtos(code);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rto_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Qualifications: Read for all authenticated, write for staff+
CREATE POLICY "Read qualifications" ON qualifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage qualifications" ON qualifications FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'staff'));

-- RTOs: Read for all authenticated, write for staff+
CREATE POLICY "Read rtos" ON rtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage rtos" ON rtos FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'staff'));

-- Offerings: Read for all authenticated, write for staff+
CREATE POLICY "Read offerings" ON rto_offerings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage offerings" ON rto_offerings FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'staff'));

-- Partners: Staff+ see all, agents see themselves
CREATE POLICY "Staff read all partners" ON partners FOR SELECT TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'staff'));

CREATE POLICY "Agents read own partner" ON partners FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Staff manage partners" ON partners FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'staff'));

-- Applications: Staff+ see all, agents see their own applications
CREATE POLICY "Staff read all applications" ON applications FOR SELECT TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'staff'));

CREATE POLICY "Agents read own applications" ON applications FOR SELECT TO authenticated
USING (
  partner_id IN (SELECT id FROM partners WHERE user_id = auth.uid())
);

CREATE POLICY "Staff manage applications" ON applications FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'staff'));

CREATE POLICY "Agents create applications" ON applications FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'agent'
  AND partner_id IN (SELECT id FROM partners WHERE user_id = auth.uid())
);

CREATE POLICY "Agents update own draft applications" ON applications FOR UPDATE TO authenticated
USING (
  partner_id IN (SELECT id FROM partners WHERE user_id = auth.uid())
  AND workflow_stage = 'draft'
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-generate student_uid
CREATE OR REPLACE FUNCTION generate_student_uid()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT;
  next_num INTEGER;
BEGIN
  year_prefix := 'APP-' || TO_CHAR(NOW(), 'YYYY') || '-';
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(student_uid FROM year_prefix || '(\d+)$') AS INTEGER)), 0) + 1
  INTO next_num
  FROM applications
  WHERE student_uid LIKE year_prefix || '%';
  
  NEW.student_uid := year_prefix || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_student_uid
  BEFORE INSERT ON applications
  FOR EACH ROW
  WHEN (NEW.student_uid IS NULL OR NEW.student_uid = '')
  EXECUTE FUNCTION generate_student_uid();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_timestamp BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_qualifications_timestamp BEFORE UPDATE ON qualifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_rtos_timestamp BEFORE UPDATE ON rtos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_offerings_timestamp BEFORE UPDATE ON rto_offerings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_partners_timestamp BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_applications_timestamp BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- STORAGE BUCKETS
-- ============================================
-- Run this separately in Supabase dashboard or via API
-- INSERT INTO storage.buckets (id, name, public) VALUES ('applications', 'applications', false);

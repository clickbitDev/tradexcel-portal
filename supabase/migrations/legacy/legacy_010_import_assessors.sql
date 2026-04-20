-- ============================================
-- ASSESSORS IMPORT
-- Migration: 010_import_assessors
-- ============================================
-- This script imports assessor users into the profiles table
-- Note: These users need to be created in auth.users first via Supabase dashboard
-- or using the Admin API, then this script updates/creates their profiles
-- ============================================

-- For now, we'll insert directly into profiles with generated UUIDs
-- In production, you would first create auth.users entries

-- Insert assessors into profiles
-- Using INSERT ... ON CONFLICT to handle duplicates
INSERT INTO profiles (id, full_name, email, role, phone, created_at, updated_at)
VALUES 
  (uuid_generate_v4(), 'Aditya SISODIA', 'aditya_dontknow@gmail.com', 'assessor', '0431 774 898', NOW(), NOW()),
  (uuid_generate_v4(), 'Farhana AKHTER', 'farhan@dontknow.com', 'assessor', '0434 286 758', NOW(), NOW()),
  (uuid_generate_v4(), 'Ferdous Ahmad', 'rinzinit19.lumiere@gmail.com', 'assessor', '0450 638 244', NOW(), NOW()),
  (uuid_generate_v4(), 'Hossain Md MOHSIN', 'mohsin_dontknow@gmail.com', 'assessor', '0433 633 535', NOW(), NOW()),
  (uuid_generate_v4(), 'Israt Jakia SULTANA', 'israt@lumieresolutions.com.au', 'assessor', '0434 105 527', NOW(), NOW()),
  (uuid_generate_v4(), 'Mita GHOSH', 'mita@dontknow.com', 'assessor', '0432 363 980', NOW(), NOW()),
  (uuid_generate_v4(), 'Rassel Ahmed', 'ferdous4898@gmail.com', 'assessor', '0450638244', NOW(), NOW()),
  (uuid_generate_v4(), 'Romana PARVEEN', 'romana@dontknow.com', 'assessor', '0444 576 453', NOW(), NOW()),
  (uuid_generate_v4(), 'Ruksana Afrin ONJOLEE', 'onjolee_dontknow@gmail.com', 'assessor', '0469 051 977', NOW(), NOW()),
  (uuid_generate_v4(), 'Saifu Ahmed', 'saifu.test@gmail.com', 'assessor', '0401 611 682', NOW(), NOW()),
  (uuid_generate_v4(), 'Soroush IGHANIYAN', 'soroush_ighaniyan@hotmail.com', 'assessor', '0439 801 755', NOW(), NOW()),
  (uuid_generate_v4(), 'Test Assessor Tanvir', 'tanvir+assessor@lumieresoultions.com.au', 'assessor', '041123355', NOW(), NOW()),
  (uuid_generate_v4(), 'Test Hasan', 'info.acts46254@gmail.com', 'assessor', '0412345678', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Update existing users who match by email to assessor role
UPDATE profiles 
SET role = 'assessor', 
    updated_at = NOW()
WHERE email IN (
  'aditya_dontknow@gmail.com',
  'farhan@dontknow.com',
  'rinzinit19.lumiere@gmail.com',
  'mohsin_dontknow@gmail.com',
  'israt@lumieresolutions.com.au',
  'mita@dontknow.com',
  'ferdous4898@gmail.com',
  'romana@dontknow.com',
  'onjolee_dontknow@gmail.com',
  'saifu.test@gmail.com',
  'soroush_ighaniyan@hotmail.com',
  'tanvir+assessor@lumieresoultions.com.au',
  'info.acts46254@gmail.com'
);

-- Create an assessors linking table for tracking qualifications they can assess
CREATE TABLE IF NOT EXISTS assessor_qualifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  assessor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  qualification_id UUID NOT NULL REFERENCES qualifications(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assessor_id, qualification_id)
);

-- Enable RLS
ALTER TABLE assessor_qualifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assessor_qualifications
CREATE POLICY "Staff read assessor qualifications" 
  ON assessor_qualifications FOR SELECT TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'staff', 'assessor'));

CREATE POLICY "Staff manage assessor qualifications" 
  ON assessor_qualifications FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_assessor_qualifications_assessor ON assessor_qualifications(assessor_id);
CREATE INDEX IF NOT EXISTS idx_assessor_qualifications_qual ON assessor_qualifications(qualification_id);

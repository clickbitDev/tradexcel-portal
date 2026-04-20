-- ============================================
-- USER IMPORT SQL 
-- Generated from users_2026-01-16_21-22-34.csv
-- ============================================
-- NOTE: This inserts directly into profiles table.
-- For users to actually log in, they need to be created in auth.users.
-- Use Supabase Dashboard -> Authentication -> Users -> Invite User for each.

-- First, let's see what we have
SELECT COUNT(*) as existing_profiles FROM profiles;

-- Insert/Update profiles from CSV
-- Role mapping: Agent->agent, Admin->admin, CEO->ceo, etc.
INSERT INTO profiles (id, email, full_name, phone, role, created_at, updated_at)
VALUES 
    (gen_random_uuid(), 'admin@lumiere.com', 'Admin User', '', 'ceo', NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    updated_at = NOW();

-- CSV User Data (run this after adding users via Supabase Auth)
-- The users need to be created through Supabase Auth first, then their profiles will be auto-created by the trigger

-- Quick verification
SELECT id, email, full_name, role FROM profiles ORDER BY created_at DESC LIMIT 10;

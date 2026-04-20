-- ============================================
-- EXPANDED ROLE SYSTEM
-- Migration: 009_expanded_roles
-- ============================================
-- This migration requires dropping and recreating RLS policies

-- Helper: Check if a type value exists
CREATE OR REPLACE FUNCTION pg_temp.type_exists(type_name text) RETURNS boolean AS $$
BEGIN
    PERFORM 1 FROM pg_type WHERE typname = type_name;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Skip if already migrated (check for new enum value)
DO $$
BEGIN
    -- Check if 'ceo' value already exists in user_role
    IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ceo' AND enumtypid = 'user_role'::regtype) THEN
        RAISE NOTICE 'Migration already applied, skipping';
        RETURN;
    END IF;

    -- Add new enum values to existing type (PostgreSQL 10+)
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ceo';
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'executive_manager';
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'accounts_manager';
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'assessor';
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'dispatch_coordinator';
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'frontdesk';
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'developer';
    
    RAISE NOTICE 'Added new role values to user_role enum';
END;
$$;

-- Update default to 'agent' (already exists in enum)
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'agent';

-- Update the trigger to default to 'agent'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'agent')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if role is internal staff (not agent)
CREATE OR REPLACE FUNCTION is_staff_role(role user_role) RETURNS BOOLEAN AS $$
BEGIN
  RETURN role NOT IN ('agent');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to check admin-level access
CREATE OR REPLACE FUNCTION is_admin_role(role user_role) RETURNS BOOLEAN AS $$
BEGIN
  RETURN role IN ('ceo', 'developer', 'admin');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to check manager-level access
CREATE OR REPLACE FUNCTION is_manager_role(role user_role) RETURNS BOOLEAN AS $$
BEGIN
  RETURN role IN ('ceo', 'executive_manager', 'developer', 'admin');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Migrate existing users from old roles to new roles
-- admin -> ceo, manager -> executive_manager, staff -> admin
UPDATE profiles SET role = 'ceo' WHERE role::text = 'admin';
UPDATE profiles SET role = 'executive_manager' WHERE role::text = 'manager';
UPDATE profiles SET role = 'admin' WHERE role::text = 'staff';

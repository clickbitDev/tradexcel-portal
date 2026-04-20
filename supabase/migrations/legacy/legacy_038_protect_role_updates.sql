-- ============================================
-- Migration: 038_protect_role_updates
-- Purpose: Restrict role column updates to CEO and Developer only
-- ============================================

-- Drop existing update policies on profiles
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Staff can update any profile" ON profiles;
DROP POLICY IF EXISTS "Update own or admin update any profile" ON profiles;

-- Policy 1: Users can update their OWN profile (except role field)
-- This allows updating: full_name, phone, avatar_url, etc.
CREATE POLICY "Users can update own profile fields"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- If role is being changed, it must stay the same (no self-promotion)
    AND (
      role = (SELECT role FROM profiles WHERE id = auth.uid())
    )
  );

-- Policy 2: Staff (non-CEO/developer) can update OTHER profiles but NOT the role field
CREATE POLICY "Staff can update profiles except role"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    -- User is staff (not agent/assessor)
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role NOT IN ('agent', 'assessor')
    )
  )
  WITH CHECK (
    -- The role must remain unchanged (preventing role escalation)
    role = (SELECT p.role FROM profiles p WHERE p.id = profiles.id)
  );

-- Policy 3: CEO and Developer can update ANY profile INCLUDING role
CREATE POLICY "CEO and Developer can update any profile with role"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('ceo', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('ceo', 'developer')
    )
  );

-- Add a comment for documentation
COMMENT ON POLICY "Users can update own profile fields" ON profiles IS 
  'Allows users to update their own profile but prevents self-role changes';
COMMENT ON POLICY "Staff can update profiles except role" ON profiles IS 
  'Allows staff to update profiles but the role field must remain unchanged';
COMMENT ON POLICY "CEO and Developer can update any profile with role" ON profiles IS 
  'Only CEO and Developer can modify user roles - critical security policy';

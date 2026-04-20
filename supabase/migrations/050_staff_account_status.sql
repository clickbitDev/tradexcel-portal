-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 050_staff_account_status
-- Purpose: Add account status controls for staff/agents and protect profile updates
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'account_status'
  ) THEN
    CREATE TYPE public.account_status AS ENUM ('active', 'disabled');
  END IF;
END;
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status public.account_status;

UPDATE public.profiles
SET account_status = 'active'::public.account_status
WHERE account_status IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN account_status SET DEFAULT 'active'::public.account_status;

ALTER TABLE public.profiles
  ALTER COLUMN account_status SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);

COMMENT ON COLUMN public.profiles.account_status IS 'Account access state: active users can sign in, disabled users are blocked.';

-- Replace profile UPDATE policies to also protect account_status from non-privileged edits.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Update own or admin update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile fields" ON public.profiles;
DROP POLICY IF EXISTS "Staff can update profiles except role" ON public.profiles;
DROP POLICY IF EXISTS "CEO and Developer can update any profile with role" ON public.profiles;

CREATE POLICY "Users can update own profile fields"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (
      SELECT p.role
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
    AND account_status = (
      SELECT p.account_status
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Staff can update profiles except role"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role NOT IN ('agent', 'assessor')
    )
  )
  WITH CHECK (
    role = (
      SELECT p.role
      FROM public.profiles p
      WHERE p.id = public.profiles.id
    )
    AND account_status = (
      SELECT p.account_status
      FROM public.profiles p
      WHERE p.id = public.profiles.id
    )
  );

CREATE POLICY "CEO and Developer can update any profile with role"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('ceo', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('ceo', 'developer')
    )
  );

COMMENT ON POLICY "Users can update own profile fields" ON public.profiles IS
  'Allows users to update own profile but blocks role/account_status self-elevation.';

COMMENT ON POLICY "Staff can update profiles except role" ON public.profiles IS
  'Allows staff profile updates while role and account_status remain unchanged.';

COMMENT ON POLICY "CEO and Developer can update any profile with role" ON public.profiles IS
  'Only CEO and Developer can modify role/account_status fields.';

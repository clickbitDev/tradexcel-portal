-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 20260319121059_protect_profile_soft_delete_and_trash_view
-- Purpose: Protect profile soft-delete fields and expose deleted staff in trash
-- ============================================

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
    AND is_deleted = (
      SELECT p.is_deleted
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
    AND deleted_at IS NOT DISTINCT FROM (
      SELECT p.deleted_at
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
    AND deleted_by IS NOT DISTINCT FROM (
      SELECT p.deleted_by
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
    AND is_deleted = (
      SELECT p.is_deleted
      FROM public.profiles p
      WHERE p.id = public.profiles.id
    )
    AND deleted_at IS NOT DISTINCT FROM (
      SELECT p.deleted_at
      FROM public.profiles p
      WHERE p.id = public.profiles.id
    )
    AND deleted_by IS NOT DISTINCT FROM (
      SELECT p.deleted_by
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
  'Allows users to update own profile but blocks role/account_status/delete-state self-elevation.';

COMMENT ON POLICY "Staff can update profiles except role" ON public.profiles IS
  'Allows staff profile updates while role, account_status, and delete-state remain unchanged.';

COMMENT ON POLICY "CEO and Developer can update any profile with role" ON public.profiles IS
  'Only CEO and Developer can modify role, account_status, or delete-state fields.';

CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted ON public.profiles(is_deleted) WHERE is_deleted = false;

DROP VIEW IF EXISTS public.trash_bin;
CREATE VIEW public.trash_bin WITH (security_invoker = true) AS
SELECT
    'applications' AS table_name,
    id::text AS record_id,
    student_uid AS identifier,
    CONCAT(student_first_name, ' ', student_last_name) AS display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM public.profiles WHERE id = deleted_by) AS deleted_by_name
FROM public.applications WHERE is_deleted = true
UNION ALL
SELECT
    'partners' AS table_name,
    id::text AS record_id,
    email AS identifier,
    company_name AS display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM public.profiles WHERE id = deleted_by) AS deleted_by_name
FROM public.partners WHERE is_deleted = true
UNION ALL
SELECT
    'rtos' AS table_name,
    id::text AS record_id,
    code AS identifier,
    name AS display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM public.profiles WHERE id = deleted_by) AS deleted_by_name
FROM public.rtos WHERE is_deleted = true
UNION ALL
SELECT
    'qualifications' AS table_name,
    id::text AS record_id,
    code AS identifier,
    name AS display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM public.profiles WHERE id = deleted_by) AS deleted_by_name
FROM public.qualifications WHERE is_deleted = true
UNION ALL
SELECT
    'invoices' AS table_name,
    id::text AS record_id,
    invoice_number AS identifier,
    student_name AS display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM public.profiles WHERE id = deleted_by) AS deleted_by_name
FROM public.invoices WHERE is_deleted = true
UNION ALL
SELECT
    'bills' AS table_name,
    id::text AS record_id,
    bill_number AS identifier,
    description AS display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM public.profiles WHERE id = deleted_by) AS deleted_by_name
FROM public.bills WHERE is_deleted = true
UNION ALL
SELECT
    'student_master' AS table_name,
    id::text AS record_id,
    email AS identifier,
    CONCAT(first_name, ' ', last_name) AS display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM public.profiles WHERE id = deleted_by) AS deleted_by_name
FROM public.student_master WHERE is_deleted = true
UNION ALL
SELECT
    'profiles' AS table_name,
    id::text AS record_id,
    email AS identifier,
    full_name AS display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM public.profiles WHERE id = deleted_by) AS deleted_by_name
FROM public.profiles WHERE is_deleted = true
ORDER BY deleted_at DESC;

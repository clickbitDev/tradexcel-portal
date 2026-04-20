-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 055_restore_role_permissions_matrix
-- Purpose: Restore role_permissions table and seed default role matrix
-- ============================================

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission_key text NOT NULL,
  granted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS permission_key text,
  ADD COLUMN IF NOT EXISTS granted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'role_permissions'
      AND column_name = 'role'
      AND data_type <> 'text'
  ) THEN
    ALTER TABLE public.role_permissions
      ALTER COLUMN role TYPE text USING role::text;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_role_permissions_role_permission
  ON public.role_permissions(role, permission_key);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role
  ON public.role_permissions(role);

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_key
  ON public.role_permissions(permission_key);

CREATE OR REPLACE FUNCTION public.set_role_permissions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_role_permissions_updated_at ON public.role_permissions;

CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_role_permissions_updated_at();

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Admins can modify role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Users can read own role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Admins manage role permissions" ON public.role_permissions;

CREATE POLICY "Users can read own role permissions"
  ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role::text = role_permissions.role
          OR p.role IN ('ceo', 'developer')
        )
    )
  );

CREATE POLICY "Admins manage role permissions"
  ON public.role_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('ceo', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('ceo', 'developer')
    )
  );

WITH roles(role) AS (
  VALUES
    ('ceo'),
    ('developer'),
    ('executive_manager'),
    ('admin'),
    ('accounts_manager'),
    ('assessor'),
    ('dispatch_coordinator'),
    ('frontdesk'),
    ('agent')
),
permission_keys(permission_key) AS (
  VALUES
    ('applications.view'),
    ('applications.create'),
    ('applications.edit'),
    ('applications.delete'),
    ('applications.change_stage'),
    ('applications.assign'),
    ('applications.export'),
    ('documents.view'),
    ('documents.upload'),
    ('documents.verify'),
    ('documents.delete'),
    ('rtos.view'),
    ('rtos.manage'),
    ('qualifications.view'),
    ('qualifications.manage'),
    ('partners.view'),
    ('partners.manage'),
    ('partners.view_kpi'),
    ('tickets.view'),
    ('tickets.create'),
    ('tickets.manage'),
    ('staff.view'),
    ('staff.manage'),
    ('roles.manage'),
    ('audit.view'),
    ('templates.manage'),
    ('settings.manage')
),
defaults AS (
  SELECT
    r.role,
    p.permission_key,
    CASE
      WHEN r.role IN ('ceo', 'developer') THEN true
      WHEN r.role = 'executive_manager' THEN p.permission_key = ANY (ARRAY[
        'applications.view',
        'applications.create',
        'applications.edit',
        'applications.change_stage',
        'applications.assign',
        'applications.export',
        'documents.view',
        'documents.upload',
        'documents.verify',
        'rtos.view',
        'rtos.manage',
        'qualifications.view',
        'qualifications.manage',
        'partners.view',
        'partners.manage',
        'partners.view_kpi',
        'tickets.view',
        'tickets.create',
        'tickets.manage',
        'staff.view',
        'audit.view',
        'templates.manage'
      ]::text[])
      WHEN r.role = 'admin' THEN p.permission_key = ANY (ARRAY[
        'applications.view',
        'applications.create',
        'applications.edit',
        'applications.change_stage',
        'applications.assign',
        'applications.export',
        'documents.view',
        'documents.upload',
        'documents.verify',
        'rtos.view',
        'rtos.manage',
        'qualifications.view',
        'qualifications.manage',
        'partners.view',
        'partners.manage',
        'partners.view_kpi',
        'tickets.view',
        'tickets.create',
        'tickets.manage',
        'staff.view',
        'audit.view'
      ]::text[])
      WHEN r.role = 'accounts_manager' THEN p.permission_key = ANY (ARRAY[
        'applications.view',
        'applications.create',
        'applications.edit',
        'applications.change_stage',
        'applications.export',
        'documents.view',
        'documents.upload',
        'rtos.view',
        'qualifications.view',
        'partners.view',
        'partners.view_kpi',
        'tickets.view',
        'tickets.create'
      ]::text[])
      WHEN r.role = 'assessor' THEN p.permission_key = ANY (ARRAY[
        'applications.view',
        'applications.create',
        'applications.edit',
        'applications.change_stage',
        'documents.view',
        'documents.upload',
        'documents.verify',
        'rtos.view',
        'qualifications.view',
        'partners.view',
        'tickets.view',
        'tickets.create'
      ]::text[])
      WHEN r.role = 'dispatch_coordinator' THEN p.permission_key = ANY (ARRAY[
        'applications.view',
        'applications.create',
        'applications.edit',
        'applications.change_stage',
        'documents.view',
        'documents.upload',
        'rtos.view',
        'qualifications.view',
        'partners.view',
        'tickets.view',
        'tickets.create'
      ]::text[])
      WHEN r.role = 'frontdesk' THEN p.permission_key = ANY (ARRAY[
        'applications.view',
        'applications.create',
        'applications.edit',
        'applications.change_stage',
        'documents.view',
        'documents.upload',
        'rtos.view',
        'qualifications.view',
        'partners.view',
        'tickets.view',
        'tickets.create'
      ]::text[])
      WHEN r.role = 'agent' THEN p.permission_key = ANY (ARRAY[
        'applications.view',
        'applications.create',
        'documents.view',
        'documents.upload',
        'rtos.view',
        'qualifications.view',
        'tickets.view',
        'tickets.create'
      ]::text[])
      ELSE false
    END AS granted
  FROM roles r
  CROSS JOIN permission_keys p
)
INSERT INTO public.role_permissions (role, permission_key, granted)
SELECT role, permission_key, granted
FROM defaults
ON CONFLICT (role, permission_key)
DO UPDATE SET
  granted = EXCLUDED.granted,
  updated_at = now();

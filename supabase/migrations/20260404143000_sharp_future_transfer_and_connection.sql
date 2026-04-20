-- ============================================
-- EDWARD PORTAL DATABASE MIGRATION
-- Migration: 20260404143000_sharp_future_transfer_and_connection
-- Purpose: Add Sharp Future connection settings, transferred intake support, and remote document metadata
-- ============================================

BEGIN;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS dispatch_approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_approval_requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispatch_approval_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_approval_approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispatch_override_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_application_id uuid,
  ADD COLUMN IF NOT EXISTS source_portal text NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS source_rto_id uuid,
  ADD COLUMN IF NOT EXISTS transferred_at timestamptz,
  ADD COLUMN IF NOT EXISTS transfer_event_id text;

CREATE INDEX IF NOT EXISTS idx_applications_source_application_id
  ON public.applications(source_application_id);

CREATE INDEX IF NOT EXISTS idx_applications_source_portal
  ON public.applications(source_portal);

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS is_remote boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS remote_source_url text,
  ADD COLUMN IF NOT EXISTS remote_url_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS remote_source_document_id uuid,
  ADD COLUMN IF NOT EXISTS remote_source_application_id uuid,
  ADD COLUMN IF NOT EXISTS remote_source_portal text,
  ADD COLUMN IF NOT EXISTS remote_download_error text,
  ADD COLUMN IF NOT EXISTS copied_to_local_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_documents_is_remote
  ON public.documents(is_remote, remote_url_expires_at);

CREATE TABLE IF NOT EXISTS public.portal_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_key text NOT NULL,
  sharp_future_base_url text,
  sharp_future_rto_id uuid,
  transfer_secret_encrypted text,
  public_portal_url text,
  webhook_receive_url text,
  connection_status text NOT NULL DEFAULT 'disconnected',
  is_enabled boolean NOT NULL DEFAULT false,
  last_connected_at timestamptz,
  last_ping_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.portal_connections'::regclass
      AND conname = 'portal_connections_integration_key_key'
  ) THEN
    ALTER TABLE public.portal_connections
      ADD CONSTRAINT portal_connections_integration_key_key UNIQUE (integration_key);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.portal_connections'::regclass
      AND conname = 'portal_connections_status_check'
  ) THEN
    ALTER TABLE public.portal_connections
      ADD CONSTRAINT portal_connections_status_check
      CHECK (connection_status IN ('pending', 'connected', 'disconnected', 'error'));
  END IF;
END;
$$;

INSERT INTO public.portal_connections (integration_key)
VALUES ('sharp_future')
ON CONFLICT (integration_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_portal_connections_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_portal_connections_updated_at ON public.portal_connections;

CREATE TRIGGER update_portal_connections_updated_at
  BEFORE UPDATE ON public.portal_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_portal_connections_updated_at();

ALTER TABLE public.portal_connections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'portal_connections'
      AND policyname = 'Portal connections managed by ceo developer'
  ) THEN
    CREATE POLICY "Portal connections managed by ceo developer"
      ON public.portal_connections
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('ceo', 'developer')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('ceo', 'developer')
        )
      );
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.sharp_future_event_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_status text NOT NULL DEFAULT 'pending',
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.sharp_future_event_deliveries'::regclass
      AND conname = 'sharp_future_event_deliveries_event_id_key'
  ) THEN
    ALTER TABLE public.sharp_future_event_deliveries
      ADD CONSTRAINT sharp_future_event_deliveries_event_id_key UNIQUE (event_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.sharp_future_event_deliveries'::regclass
      AND conname = 'sharp_future_event_deliveries_status_check'
  ) THEN
    ALTER TABLE public.sharp_future_event_deliveries
      ADD CONSTRAINT sharp_future_event_deliveries_status_check
      CHECK (delivery_status IN ('pending', 'delivered', 'failed'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_sharp_future_event_deliveries_application
  ON public.sharp_future_event_deliveries(application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sharp_future_event_deliveries_status
  ON public.sharp_future_event_deliveries(delivery_status, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_sharp_future_event_deliveries_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sharp_future_event_deliveries_updated_at ON public.sharp_future_event_deliveries;

CREATE TRIGGER update_sharp_future_event_deliveries_updated_at
  BEFORE UPDATE ON public.sharp_future_event_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sharp_future_event_deliveries_updated_at();

ALTER TABLE public.sharp_future_event_deliveries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sharp_future_event_deliveries'
      AND policyname = 'Sharp Future event deliveries managed by ceo developer'
  ) THEN
    CREATE POLICY "Sharp Future event deliveries managed by ceo developer"
      ON public.sharp_future_event_deliveries
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('ceo', 'developer')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('ceo', 'developer')
        )
      );
  END IF;
END;
$$;

COMMIT;

ALTER TYPE public.workflow_stage ADD VALUE IF NOT EXISTS 'TRANSFERRED' AFTER 'submitted';
ALTER TYPE public.workflow_stage ADD VALUE IF NOT EXISTS 'accounts' AFTER 'evaluate';

UPDATE public.workflow_transitions
SET
  is_allowed = false,
  updated_at = now()
WHERE from_stage = 'evaluate'
  AND to_stage = 'dispatch';

INSERT INTO public.workflow_transitions (
  from_stage,
  to_stage,
  is_allowed,
  requires_approval,
  required_role,
  allowed_roles
)
VALUES
  (
    'TRANSFERRED',
    'docs_review',
    true,
    false,
    'executive_manager',
    ARRAY['executive_manager', 'developer', 'ceo']::text[]
  ),
  (
    'evaluate',
    'accounts',
    true,
    false,
    'admin',
    ARRAY['admin', 'developer', 'ceo', 'executive_manager']::text[]
  ),
  (
    'accounts',
    'dispatch',
    true,
    false,
    'accounts_manager',
    ARRAY['accounts_manager', 'developer', 'ceo', 'executive_manager']::text[]
  )
ON CONFLICT (from_stage, to_stage)
DO UPDATE SET
  is_allowed = EXCLUDED.is_allowed,
  requires_approval = EXCLUDED.requires_approval,
  required_role = EXCLUDED.required_role,
  allowed_roles = EXCLUDED.allowed_roles,
  updated_at = now();

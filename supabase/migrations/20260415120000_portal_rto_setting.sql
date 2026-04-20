BEGIN;

ALTER TABLE public.portal_connections
  ADD COLUMN IF NOT EXISTS portal_rto_id uuid REFERENCES public.rtos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_portal_connections_portal_rto_id
  ON public.portal_connections(portal_rto_id);

COMMIT;

BEGIN;

INSERT INTO public.portal_connections (integration_key, is_enabled)
VALUES ('portal', true)
ON CONFLICT (integration_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.xero_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.portal_connections(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  tenant_id text NOT NULL,
  tenant_name text,
  token_type text NOT NULL DEFAULT 'Bearer',
  sales_account_code text NOT NULL DEFAULT '200',
  purchases_account_code text NOT NULL DEFAULT '300',
  sales_tax_type text NOT NULL DEFAULT 'OUTPUT',
  purchases_tax_type text NOT NULL DEFAULT 'INPUT',
  payment_account_code text NOT NULL DEFAULT '090',
  last_refreshed_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  error_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xero_connections_org_id_key UNIQUE (org_id)
);

CREATE INDEX IF NOT EXISTS idx_xero_connections_expires_at
  ON public.xero_connections(expires_at);

CREATE INDEX IF NOT EXISTS idx_xero_connections_tenant_id
  ON public.xero_connections(tenant_id);

CREATE OR REPLACE FUNCTION public.set_xero_connections_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_xero_connections_updated_at ON public.xero_connections;

CREATE TRIGGER update_xero_connections_updated_at
  BEFORE UPDATE ON public.xero_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_xero_connections_updated_at();

INSERT INTO public.xero_connections (
  org_id,
  access_token,
  refresh_token,
  expires_at,
  tenant_id,
  tenant_name,
  token_type,
  sales_account_code,
  purchases_account_code,
  sales_tax_type,
  purchases_tax_type,
  payment_account_code,
  last_refreshed_at,
  last_sync_at,
  last_error,
  last_error_at,
  error_count,
  created_at,
  updated_at
)
SELECT
  portal_org.id,
  legacy.access_token,
  legacy.refresh_token,
  legacy.token_expires_at,
  legacy.tenant_id,
  legacy.tenant_name,
  COALESCE(legacy.token_type, 'Bearer'),
  '200',
  '300',
  'OUTPUT',
  'INPUT',
  '090',
  legacy.last_refreshed_at,
  legacy.last_sync_at,
  legacy.last_error,
  legacy.last_error_at,
  COALESCE(legacy.error_count, 0),
  COALESCE(legacy.connected_at, legacy.created_at, now()),
  COALESCE(legacy.updated_at, now())
FROM public.xero_connection legacy
CROSS JOIN LATERAL (
  SELECT id
  FROM public.portal_connections
  WHERE integration_key = 'portal'
  LIMIT 1
) AS portal_org
WHERE legacy.is_active = true
ON CONFLICT (org_id) DO UPDATE
SET access_token = EXCLUDED.access_token,
    refresh_token = EXCLUDED.refresh_token,
    expires_at = EXCLUDED.expires_at,
    tenant_id = EXCLUDED.tenant_id,
    tenant_name = EXCLUDED.tenant_name,
    token_type = EXCLUDED.token_type,
    sales_account_code = EXCLUDED.sales_account_code,
    purchases_account_code = EXCLUDED.purchases_account_code,
    sales_tax_type = EXCLUDED.sales_tax_type,
    purchases_tax_type = EXCLUDED.purchases_tax_type,
    payment_account_code = EXCLUDED.payment_account_code,
    last_refreshed_at = EXCLUDED.last_refreshed_at,
    last_sync_at = EXCLUDED.last_sync_at,
    last_error = EXCLUDED.last_error,
    last_error_at = EXCLUDED.last_error_at,
    error_count = EXCLUDED.error_count,
    updated_at = now();

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_due numeric(10,2),
  ADD COLUMN IF NOT EXISTS raw_payload jsonb,
  ADD COLUMN IF NOT EXISTS xero_synced_at timestamptz;

UPDATE public.invoices
SET amount_due = COALESCE(amount_due, total_amount)
WHERE amount_due IS NULL;

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  xero_payment_id text NOT NULL,
  amount numeric(10,2) NOT NULL,
  date date NOT NULL,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_payments_xero_payment_id_key UNIQUE (xero_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id
  ON public.invoice_payments(invoice_id);

CREATE OR REPLACE FUNCTION public.set_invoice_payments_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoice_payments_updated_at ON public.invoice_payments;

CREATE TRIGGER update_invoice_payments_updated_at
  BEFORE UPDATE ON public.invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invoice_payments_updated_at();

COMMIT;

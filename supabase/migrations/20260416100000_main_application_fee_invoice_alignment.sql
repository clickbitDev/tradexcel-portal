BEGIN;

INSERT INTO public.portal_connections (integration_key, is_enabled)
VALUES ('portal', true)
ON CONFLICT (integration_key) DO NOTHING;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.portal_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT 'xero',
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'ACCREC',
  ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'AUD',
  ADD COLUMN IF NOT EXISTS internal_collection_status text,
  ADD COLUMN IF NOT EXISTS amount_credited numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total numeric(18,2),
  ADD COLUMN IF NOT EXISTS sub_total numeric(18,2),
  ADD COLUMN IF NOT EXISTS total_tax numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_issued date,
  ADD COLUMN IF NOT EXISTS fully_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_xero_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS xero_updated_date_utc timestamptz,
  ADD COLUMN IF NOT EXISTS sync_version bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_xero_payload jsonb;

ALTER TABLE public.invoice_payments
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.portal_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'AUD',
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS xero_account_id uuid,
  ADD COLUMN IF NOT EXISTS raw_xero_payload jsonb;

WITH portal_org AS (
  SELECT id
  FROM public.portal_connections
  WHERE integration_key = 'portal'
  LIMIT 1
)
UPDATE public.invoices i
SET tenant_id = portal_org.id,
    customer_id = COALESCE(i.customer_id, i.partner_id),
    total = COALESCE(i.total, i.total_amount),
    sub_total = COALESCE(i.sub_total, i.subtotal, i.total_amount),
    total_tax = COALESCE(i.total_tax, 0),
    date_issued = COALESCE(i.date_issued, i.issue_date, i.created_at::date),
    last_xero_synced_at = COALESCE(i.last_xero_synced_at, i.xero_synced_at),
    raw_xero_payload = COALESCE(i.raw_xero_payload, i.raw_payload),
    internal_collection_status = COALESCE(
      i.internal_collection_status,
      CASE
        WHEN UPPER(COALESCE(i.xero_status, '')) = 'DELETED' THEN 'deleted'
        WHEN UPPER(COALESCE(i.xero_status, '')) = 'VOIDED' THEN 'voided'
        WHEN UPPER(COALESCE(i.xero_status, '')) = 'DRAFT' THEN 'draft'
        WHEN UPPER(COALESCE(i.xero_status, '')) = 'SUBMITTED' THEN 'pending_approval'
        WHEN COALESCE(i.amount_paid, 0) > COALESCE(i.total, i.total_amount, 0) THEN 'overpaid'
        WHEN COALESCE(i.amount_due, 0) <= 0 AND COALESCE(i.amount_paid, 0) >= COALESCE(i.total, i.total_amount, 0) THEN 'paid'
        WHEN COALESCE(i.amount_paid, 0) > 0 AND COALESCE(i.amount_due, 0) > 0 THEN 'partially_paid'
        ELSE 'open'
      END
    ),
    fully_paid_at = COALESCE(
      i.fully_paid_at,
      CASE
        WHEN COALESCE(i.amount_due, 0) <= 0 AND COALESCE(i.amount_paid, 0) >= COALESCE(i.total, i.total_amount, 0)
          THEN COALESCE(i.paid_at, i.updated_at)
        ELSE NULL
      END
    )
FROM portal_org
WHERE i.tenant_id IS NULL
   OR i.customer_id IS NULL
   OR i.total IS NULL
   OR i.sub_total IS NULL
   OR i.date_issued IS NULL
   OR i.last_xero_synced_at IS NULL
   OR i.raw_xero_payload IS NULL
   OR i.internal_collection_status IS NULL
   OR i.fully_paid_at IS NULL;

WITH invoice_tenants AS (
  SELECT id, tenant_id
  FROM public.invoices
)
UPDATE public.invoice_payments ip
SET tenant_id = COALESCE(ip.tenant_id, invoice_tenants.tenant_id),
    payment_date = COALESCE(ip.payment_date, ip.date),
    raw_xero_payload = COALESCE(ip.raw_xero_payload, ip.raw_payload)
FROM invoice_tenants
WHERE invoice_tenants.id = ip.invoice_id
  AND (
    ip.tenant_id IS NULL
    OR ip.payment_date IS NULL
    OR ip.raw_xero_payload IS NULL
  );

UPDATE public.invoice_payments
SET payment_date = COALESCE(payment_date, date)
WHERE payment_date IS NULL;

ALTER TABLE public.invoices
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN source_system SET NOT NULL,
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN currency_code SET NOT NULL;

ALTER TABLE public.invoice_payments
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN currency_code SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_xero_id
  ON public.invoices(xero_invoice_id)
  WHERE xero_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_collection_status
  ON public.invoices(tenant_id, internal_collection_status);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice
  ON public.invoice_payments(invoice_id);

COMMIT;

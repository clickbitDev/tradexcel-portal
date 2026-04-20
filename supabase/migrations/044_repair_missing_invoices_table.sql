-- Repair migration for environments where invoice migrations did not run.
-- Creates invoices table and supporting objects required for invoice generation and Xero sync.

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number varchar(20) UNIQUE NOT NULL,
  application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
  partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  student_name varchar(255) NOT NULL,
  course_name varchar(255),
  rto_name varchar(255),
  tuition_fee decimal(10,2) DEFAULT 0,
  material_fee decimal(10,2) DEFAULT 0,
  application_fee decimal(10,2) DEFAULT 0,
  other_fees decimal(10,2) DEFAULT 0,
  discount decimal(10,2) DEFAULT 0,
  total_amount decimal(10,2) NOT NULL,
  status varchar(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'archived')),
  issue_date date DEFAULT CURRENT_DATE,
  due_date date,
  paid_at timestamptz,
  pdf_url text,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_archived boolean DEFAULT false,
  archived_at timestamptz,
  archived_by uuid REFERENCES profiles(id),
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES profiles(id),
  invoice_type varchar(20) DEFAULT 'customer',
  tax_rate decimal(5,2) DEFAULT 10,
  tax_amount decimal(10,2) DEFAULT 0,
  subtotal decimal(10,2),
  payment_reference varchar(100),
  payment_method varchar(50),
  sent_at timestamptz,
  sent_to varchar(255),
  sent_via varchar(20),
  send_count integer DEFAULT 0,
  xero_invoice_id varchar(100),
  xero_invoice_url varchar(500),
  xero_sent_at timestamptz,
  xero_status varchar(30)
);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES applications(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS student_name varchar(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS course_name varchar(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS rto_name varchar(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tuition_fee decimal(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS material_fee decimal(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS application_fee decimal(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS other_fees decimal(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount decimal(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_amount decimal(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'draft';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issue_date date DEFAULT CURRENT_DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_url text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES profiles(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type varchar(20) DEFAULT 'customer';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate decimal(5,2) DEFAULT 10;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount decimal(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal decimal(10,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_reference varchar(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method varchar(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_to varchar(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_via varchar(20);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS send_count integer DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_invoice_id varchar(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_invoice_url varchar(500);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_sent_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_status varchar(30);

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT;
  next_num INTEGER;
BEGIN
  year_prefix := 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-';
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM year_prefix || '(\d+)$') AS INTEGER)), 0) + 1
  INTO next_num
  FROM invoices
  WHERE invoice_number LIKE year_prefix || '%';
  NEW.invoice_number := year_prefix || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_invoice_number ON invoices;
CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
  EXECUTE FUNCTION generate_invoice_number();

CREATE OR REPLACE FUNCTION set_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoices_timestamp ON invoices;
CREATE TRIGGER update_invoices_timestamp
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoices_updated_at();

CREATE INDEX IF NOT EXISTS idx_invoices_application_id ON invoices(application_id);
CREATE INDEX IF NOT EXISTS idx_invoices_partner_id ON invoices(partner_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_deleted ON invoices(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_invoices_archived ON invoices(is_archived) WHERE is_archived = true;
CREATE INDEX IF NOT EXISTS idx_invoices_xero ON invoices(xero_invoice_id) WHERE xero_invoice_id IS NOT NULL;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'Staff can view invoices'
  ) THEN
    CREATE POLICY "Staff can view invoices"
      ON invoices FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role NOT IN ('agent', 'assessor')
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'Staff insert invoices'
  ) THEN
    CREATE POLICY "Staff insert invoices"
      ON invoices FOR INSERT TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'developer')
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'Staff update invoices'
  ) THEN
    CREATE POLICY "Staff update invoices"
      ON invoices FOR UPDATE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'developer')
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'Staff delete invoices'
  ) THEN
    CREATE POLICY "Staff delete invoices"
      ON invoices FOR DELETE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'developer')
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'Agents can view own invoices'
  ) THEN
    CREATE POLICY "Agents can view own invoices"
      ON invoices FOR SELECT TO authenticated
      USING (
        partner_id IN (
          SELECT id FROM partners WHERE user_id = auth.uid()
        )
      );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description varchar(255) NOT NULL,
  quantity integer DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  total decimal(10,2) NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);

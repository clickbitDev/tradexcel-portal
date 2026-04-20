-- Repair migration for environments where migration 015 did not run.
-- Creates bills table and required dependencies used by Xero create_bill flow.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bill_status') THEN
    CREATE TYPE bill_status AS ENUM ('pending', 'received', 'paid', 'overdue', 'cancelled');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number varchar(20) UNIQUE NOT NULL,
  rto_id uuid REFERENCES rtos(id) ON DELETE SET NULL,
  application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
  description text,
  rto_invoice_number varchar(100),
  tuition_cost decimal(10,2) DEFAULT 0,
  material_cost decimal(10,2) DEFAULT 0,
  other_costs decimal(10,2) DEFAULT 0,
  total_amount decimal(10,2) NOT NULL,
  status bill_status DEFAULT 'pending',
  due_date date,
  paid_at timestamptz,
  payment_reference varchar(100),
  payment_method varchar(50),
  is_archived boolean DEFAULT false,
  archived_at timestamptz,
  archived_by uuid REFERENCES profiles(id),
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES profiles(id),
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  xero_bill_id varchar(100),
  xero_bill_url varchar(500),
  xero_status varchar(30)
);

CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT;
  next_num INTEGER;
BEGIN
  year_prefix := 'BILL-' || TO_CHAR(NOW(), 'YYYY') || '-';

  SELECT COALESCE(MAX(CAST(SUBSTRING(bill_number FROM year_prefix || '(\d+)$') AS INTEGER)), 0) + 1
  INTO next_num
  FROM bills
  WHERE bill_number LIKE year_prefix || '%';

  NEW.bill_number := year_prefix || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_bill_number ON bills;
CREATE TRIGGER set_bill_number
  BEFORE INSERT ON bills
  FOR EACH ROW
  WHEN (NEW.bill_number IS NULL OR NEW.bill_number = '')
  EXECUTE FUNCTION generate_bill_number();

CREATE OR REPLACE FUNCTION set_bills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_bills_timestamp ON bills;
CREATE TRIGGER update_bills_timestamp
  BEFORE UPDATE ON bills
  FOR EACH ROW
  EXECUTE FUNCTION set_bills_updated_at();

CREATE INDEX IF NOT EXISTS idx_bills_rto ON bills(rto_id);
CREATE INDEX IF NOT EXISTS idx_bills_application ON bills(application_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills(due_date);
CREATE INDEX IF NOT EXISTS idx_bills_deleted ON bills(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_bills_archived ON bills(is_archived) WHERE is_archived = true;
CREATE INDEX IF NOT EXISTS idx_bills_xero ON bills(xero_bill_id) WHERE xero_bill_id IS NOT NULL;

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bills' AND policyname = 'Staff can view bills'
  ) THEN
    CREATE POLICY "Staff can view bills"
      ON bills FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role NOT IN ('agent', 'assessor')
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bills' AND policyname = 'Staff insert bills'
  ) THEN
    CREATE POLICY "Staff insert bills"
      ON bills FOR INSERT TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager')
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bills' AND policyname = 'Staff update bills'
  ) THEN
    CREATE POLICY "Staff update bills"
      ON bills FOR UPDATE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager')
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bills' AND policyname = 'Staff delete bills'
  ) THEN
    CREATE POLICY "Staff delete bills"
      ON bills FOR DELETE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager')
      ));
  END IF;
END$$;

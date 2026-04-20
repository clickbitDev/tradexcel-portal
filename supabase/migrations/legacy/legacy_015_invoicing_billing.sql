-- ============================================
-- INVOICING & BILLING SCHEMA
-- Migration: 015_invoicing_billing
-- ============================================

-- ============================================
-- 1. INVOICE LINE ITEMS (for itemized invoices)
-- ============================================

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

-- ============================================
-- 2. BILLS TABLE (what we pay to sources/RTOs)
-- ============================================

CREATE TYPE bill_status AS ENUM ('pending', 'received', 'paid', 'overdue', 'cancelled');

CREATE TABLE IF NOT EXISTS bills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_number varchar(20) UNIQUE NOT NULL,
    
    -- Source we're paying (RTO)
    rto_id uuid REFERENCES rtos(id) ON DELETE SET NULL,
    application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
    
    -- Bill details
    description text,
    rto_invoice_number varchar(100),  -- Their invoice reference
    
    -- Amounts (what we pay TO source/RTO)
    tuition_cost decimal(10,2) DEFAULT 0,
    material_cost decimal(10,2) DEFAULT 0,
    other_costs decimal(10,2) DEFAULT 0,
    total_amount decimal(10,2) NOT NULL,
    
    -- Status
    status bill_status DEFAULT 'pending',
    due_date date,
    paid_at timestamptz,
    payment_reference varchar(100),
    payment_method varchar(50),
    
    -- Version control fields
    is_archived boolean DEFAULT false,
    archived_at timestamptz,
    archived_by uuid REFERENCES profiles(id),
    is_deleted boolean DEFAULT false,
    deleted_at timestamptz,
    deleted_by uuid REFERENCES profiles(id),
    
    -- Metadata
    notes text,
    created_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Bill number sequence (BILL-YYYY-XXXX)
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

CREATE TRIGGER set_bill_number
    BEFORE INSERT ON bills
    FOR EACH ROW
    WHEN (NEW.bill_number IS NULL OR NEW.bill_number = '')
    EXECUTE FUNCTION generate_bill_number();

-- Update timestamp trigger
CREATE TRIGGER update_bills_timestamp 
    BEFORE UPDATE ON bills 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 3. BILL LINE ITEMS
-- ============================================

CREATE TABLE IF NOT EXISTS bill_line_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    description varchar(255) NOT NULL,
    quantity integer DEFAULT 1,
    unit_price decimal(10,2) NOT NULL,
    total decimal(10,2) NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_line_items_bill ON bill_line_items(bill_id);

-- ============================================
-- 4. BULK OPERATIONS TRACKING
-- ============================================

CREATE TYPE bulk_operation_type AS ENUM ('invoice', 'bill');
CREATE TYPE bulk_operation_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS bulk_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type bulk_operation_type NOT NULL,
    status bulk_operation_status DEFAULT 'pending',
    total_items integer DEFAULT 0,
    processed_items integer DEFAULT 0,
    failed_items integer DEFAULT 0,
    error_log jsonb DEFAULT '[]',
    
    -- Metadata
    created_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now(),
    completed_at timestamptz
);

-- ============================================
-- 5. INDEXES FOR BILLS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_bills_rto ON bills(rto_id);
CREATE INDEX IF NOT EXISTS idx_bills_application ON bills(application_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills(due_date);
CREATE INDEX IF NOT EXISTS idx_bills_deleted ON bills(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_bills_archived ON bills(is_archived) WHERE is_archived = true;

-- ============================================
-- 6. RLS POLICIES FOR BILLS
-- ============================================

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_operations ENABLE ROW LEVEL SECURITY;

-- Bills: Staff+ can manage
CREATE POLICY "Staff can manage bills"
    ON bills FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager')
    ));

CREATE POLICY "Staff can view bills"
    ON bills FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role NOT IN ('agent', 'assessor')
    ));

-- Bill line items: Same access as bills
CREATE POLICY "Staff can manage bill line items"
    ON bill_line_items FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager')
    ));

-- Invoice line items: Same access as invoices
CREATE POLICY "Staff can manage invoice line items"
    ON invoice_line_items FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role NOT IN ('agent', 'assessor')
    ));

CREATE POLICY "Agents can view own invoice line items"
    ON invoice_line_items FOR SELECT TO authenticated
    USING (
        invoice_id IN (
            SELECT id FROM invoices 
            WHERE partner_id IN (SELECT id FROM partners WHERE user_id = auth.uid())
        )
    );

-- Bulk operations: Staff+ can manage
CREATE POLICY "Staff can manage bulk operations"
    ON bulk_operations FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role NOT IN ('agent', 'assessor')
    ));

-- ============================================
-- 7. ENHANCE INVOICES TABLE (add missing fields)
-- ============================================

-- Add invoice type to distinguish customer invoices from agent invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type varchar(20) DEFAULT 'customer';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate decimal(5,2) DEFAULT 10;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount decimal(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal decimal(10,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_reference varchar(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method varchar(50);

-- Comments for documentation
COMMENT ON TABLE bills IS 'Bills from RTOs/sources - what we pay TO them';
COMMENT ON TABLE invoices IS 'Invoices to agents/customers - what they pay TO us';
COMMENT ON COLUMN bills.rto_invoice_number IS 'The invoice number from the RTO/source';
COMMENT ON COLUMN invoices.invoice_type IS 'customer = student invoice, agent = agent invoice';

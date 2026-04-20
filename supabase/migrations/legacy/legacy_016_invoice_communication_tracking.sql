-- ============================================
-- INVOICE/BILL COMMUNICATION TRACKING
-- Migration: 016_invoice_communication_tracking
-- ============================================

-- ============================================
-- 1. ADD INVOICE/BILL TRACKING TO APPLICATIONS
-- ============================================

-- Track if an invoice has been generated for this application
ALTER TABLE applications ADD COLUMN IF NOT EXISTS has_invoice boolean DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS latest_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS invoice_sent_at timestamptz;

-- Track if a bill has been created for this application
ALTER TABLE applications ADD COLUMN IF NOT EXISTS has_bill boolean DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS latest_bill_id uuid REFERENCES bills(id) ON DELETE SET NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS bill_created_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_applications_has_invoice ON applications(has_invoice) WHERE has_invoice = true;
CREATE INDEX IF NOT EXISTS idx_applications_has_bill ON applications(has_bill) WHERE has_bill = true;

-- ============================================
-- 2. ENHANCE NOTIFICATION_QUEUE WITH INVOICE/BILL REFS
-- ============================================

ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS bill_id uuid REFERENCES bills(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notification_queue_invoice ON notification_queue(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_queue_bill ON notification_queue(bill_id) WHERE bill_id IS NOT NULL;

-- ============================================
-- 3. ENHANCE NOTIFICATION_LOGS FOR HISTORY VIEW
-- ============================================

-- Add sender tracking and recipient name for better history display
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS sent_by uuid REFERENCES profiles(id);
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS recipient_name varchar(255);
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS bill_id uuid REFERENCES bills(id) ON DELETE SET NULL;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS message_type varchar(50);  -- 'invoice', 'bill', 'reminder', 'bulk', 'manual'

CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_by ON notification_logs(sent_by);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_invoice ON notification_logs(invoice_id) WHERE invoice_id IS NOT NULL;

-- ============================================
-- 4. ADD SEND TRACKING TO INVOICES
-- ============================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_to varchar(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_via varchar(20);  -- 'email', 'sms', 'whatsapp'
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS send_count integer DEFAULT 0;

-- ============================================
-- 5. TRIGGER TO UPDATE APPLICATION TRACKING
-- ============================================

-- When an invoice is created, update the application's tracking fields
CREATE OR REPLACE FUNCTION update_application_invoice_tracking()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.application_id IS NOT NULL THEN
        UPDATE applications
        SET has_invoice = true,
            latest_invoice_id = NEW.id
        WHERE id = NEW.application_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_application_invoice ON invoices;
CREATE TRIGGER trigger_update_application_invoice
    AFTER INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_application_invoice_tracking();

-- When a bill is created, update the application's tracking fields
CREATE OR REPLACE FUNCTION update_application_bill_tracking()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.application_id IS NOT NULL THEN
        UPDATE applications
        SET has_bill = true,
            latest_bill_id = NEW.id,
            bill_created_at = NOW()
        WHERE id = NEW.application_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_application_bill ON bills;
CREATE TRIGGER trigger_update_application_bill
    AFTER INSERT ON bills
    FOR EACH ROW
    EXECUTE FUNCTION update_application_bill_tracking();

-- ============================================
-- 6. FUNCTION TO LOG SENT MESSAGES
-- ============================================

CREATE OR REPLACE FUNCTION log_sent_notification(
    p_notification_id uuid,
    p_recipient varchar,
    p_recipient_name varchar,
    p_channel varchar,
    p_subject varchar,
    p_sent_by uuid,
    p_invoice_id uuid DEFAULT NULL,
    p_bill_id uuid DEFAULT NULL,
    p_message_type varchar DEFAULT 'manual'
)
RETURNS uuid AS $$
DECLARE
    v_log_id uuid;
BEGIN
    INSERT INTO notification_logs (
        notification_id,
        recipient,
        recipient_name,
        channel,
        subject,
        status,
        sent_by,
        invoice_id,
        bill_id,
        message_type,
        created_at
    ) VALUES (
        p_notification_id,
        p_recipient,
        p_recipient_name,
        p_channel::notification_channel,
        p_subject,
        'sent',
        p_sent_by,
        p_invoice_id,
        p_bill_id,
        p_message_type,
        NOW()
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

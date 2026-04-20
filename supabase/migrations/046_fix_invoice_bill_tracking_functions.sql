-- Repair migration: fix invoice/bill tracking trigger functions when search_path is empty.

CREATE OR REPLACE FUNCTION public.update_application_invoice_tracking()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.application_id IS NOT NULL THEN
    UPDATE public.applications
    SET has_invoice = true,
        latest_invoice_id = NEW.id
    WHERE id = NEW.application_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.update_application_bill_tracking()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.application_id IS NOT NULL THEN
    UPDATE public.applications
    SET has_bill = true,
        latest_bill_id = NEW.id,
        bill_created_at = NOW()
    WHERE id = NEW.application_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trigger_update_application_invoice ON invoices;
CREATE TRIGGER trigger_update_application_invoice
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_application_invoice_tracking();

DROP TRIGGER IF EXISTS trigger_update_application_bill ON bills;
CREATE TRIGGER trigger_update_application_bill
  AFTER INSERT ON bills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_application_bill_tracking();

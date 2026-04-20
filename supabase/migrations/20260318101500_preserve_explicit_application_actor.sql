BEGIN;

CREATE OR REPLACE FUNCTION public.update_application_last_updated_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_by = COALESCE(NEW.last_updated_by, auth.uid());
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

COMMIT;

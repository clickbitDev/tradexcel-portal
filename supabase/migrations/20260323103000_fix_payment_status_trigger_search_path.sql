-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 20260323103000_fix_payment_status_trigger_search_path
-- Purpose: Ensure payment_status enum exists and the payment-status trigger works with search_path = ''
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'payment_status'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.payment_status AS ENUM ('unpaid', 'partial', 'paid', 'refunded');
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'applications'
          AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE public.applications
            ADD COLUMN payment_status public.payment_status DEFAULT 'unpaid'::public.payment_status;
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'applications'
          AND column_name = 'payment_status'
          AND (
              udt_schema IS DISTINCT FROM 'public'
              OR udt_name IS DISTINCT FROM 'payment_status'
          )
    ) THEN
        ALTER TABLE public.applications
            ALTER COLUMN payment_status TYPE public.payment_status
            USING CASE
                WHEN payment_status IS NULL OR btrim(payment_status::text) = '' THEN NULL
                ELSE lower(btrim(payment_status::text))::public.payment_status
            END;
    END IF;
END;
$$;

ALTER TABLE public.applications
    ALTER COLUMN payment_status SET DEFAULT 'unpaid'::public.payment_status;

CREATE OR REPLACE FUNCTION public.update_application_payment_status()
RETURNS trigger AS $$
DECLARE
    total_quoted numeric;
    new_status public.payment_status;
BEGIN
    total_quoted := COALESCE(NEW.quoted_tuition, 0) + COALESCE(NEW.quoted_materials, 0);

    IF COALESCE(NEW.total_paid, 0) = 0 THEN
        new_status := 'unpaid'::public.payment_status;
    ELSIF NEW.total_paid < total_quoted THEN
        new_status := 'partial'::public.payment_status;
    ELSE
        new_status := 'paid'::public.payment_status;
    END IF;

    IF new_status IS DISTINCT FROM NEW.payment_status THEN
        NEW.payment_status := new_status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

DROP TRIGGER IF EXISTS tr_applications_payment_status_sync ON public.applications;

CREATE TRIGGER tr_applications_payment_status_sync
    BEFORE INSERT OR UPDATE OF total_paid, quoted_tuition, quoted_materials ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_application_payment_status();

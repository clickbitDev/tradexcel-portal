CREATE OR REPLACE FUNCTION public.cascade_partner_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
        UPDATE public.applications
        SET is_deleted = true,
            deleted_at = now(),
            deleted_by = NEW.deleted_by
        WHERE partner_id = NEW.id
          AND is_deleted = false;

        UPDATE public.invoices
        SET is_deleted = true,
            deleted_at = now(),
            deleted_by = NEW.deleted_by
        WHERE partner_id = NEW.id
          AND is_deleted = false;

        UPDATE public.documents
        SET is_deleted = true,
            deleted_at = now(),
            deleted_by = NEW.deleted_by
        WHERE partner_id = NEW.id
          AND is_deleted = false;

        INSERT INTO public.record_activity (table_name, record_id, action, summary, user_id)
        VALUES (
            'partners',
            NEW.id,
            'cascade_soft_delete',
            format('Cascaded soft-delete to related applications, invoices, and documents'),
            NEW.deleted_by
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cascade_rto_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
        UPDATE public.rto_offerings
        SET is_deleted = true,
            deleted_at = now(),
            deleted_by = NEW.deleted_by
        WHERE rto_id = NEW.id
          AND is_deleted = false;

        UPDATE public.bills
        SET is_deleted = true,
            deleted_at = now(),
            deleted_by = NEW.deleted_by
        WHERE rto_id = NEW.id
          AND is_deleted = false;

        INSERT INTO public.record_activity (table_name, record_id, action, summary, user_id)
        VALUES (
            'rtos',
            NEW.id,
            'cascade_soft_delete',
            'Cascaded soft-delete to related offerings and bills',
            NEW.deleted_by
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cascade_application_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
        UPDATE public.documents
        SET is_deleted = true,
            deleted_at = now(),
            deleted_by = NEW.deleted_by
        WHERE application_id = NEW.id
          AND is_deleted = false;

        UPDATE public.invoices
        SET is_deleted = true,
            deleted_at = now(),
            deleted_by = NEW.deleted_by
        WHERE application_id = NEW.id
          AND is_deleted = false;

        UPDATE public.bills
        SET is_deleted = true,
            deleted_at = now(),
            deleted_by = NEW.deleted_by
        WHERE application_id = NEW.id
          AND is_deleted = false;

        INSERT INTO public.record_activity (table_name, record_id, action, summary, user_id)
        VALUES (
            'applications',
            NEW.id,
            'cascade_soft_delete',
            'Cascaded soft-delete to related documents, invoices, and bills',
            NEW.deleted_by
        );
    END IF;

    RETURN NEW;
END;
$$;

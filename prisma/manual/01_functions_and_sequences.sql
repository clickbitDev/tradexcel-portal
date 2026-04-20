-- Manual SQL Phase 1
-- Essential helper functions and sequences that Prisma does not manage.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.role
    FROM public.profiles p
    WHERE p.id = auth.uid()
$$;

CREATE SEQUENCE IF NOT EXISTS public.application_uid_serial_seq;

DO $$
DECLARE
    v_last_serial bigint;
BEGIN
    SELECT GREATEST(
        COALESCE(
            (
                SELECT MAX((regexp_match(application_number, '^APP-([0-9]+)$'))[1]::bigint)
                FROM public.applications
                WHERE application_number ~ '^APP-[0-9]+$'
            ),
            0
        ),
        COALESCE(
            (
                SELECT MAX((regexp_match(student_uid, '^[0-9]{8}-([0-9]+)[A-Z]+-[A-Z0-9]+$'))[1]::bigint)
                FROM public.applications
                WHERE student_uid ~ '^[0-9]{8}-[0-9]+[A-Z]+-[A-Z0-9]+$'
            ),
            0
        ),
        COALESCE(
            (
                SELECT MAX((regexp_match(student_uid, '^APP-([0-9]+)$'))[1]::bigint)
                FROM public.applications
                WHERE student_uid ~ '^APP-[0-9]+$'
            ),
            0
        ),
        COALESCE(
            (
                SELECT MAX((regexp_match(student_uid, '^APP-[0-9]{4}-([0-9]+)$'))[1]::bigint)
                FROM public.applications
                WHERE student_uid ~ '^APP-[0-9]{4}-[0-9]+$'
            ),
            0
        ),
        COALESCE((SELECT COUNT(*)::bigint FROM public.applications), 0)
    )
    INTO v_last_serial;

    IF v_last_serial > 0 THEN
        PERFORM setval('public.application_uid_serial_seq', v_last_serial, true);
    ELSE
        PERFORM setval('public.application_uid_serial_seq', 1, false);
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_student_uid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_date_prefix text;
    v_serial bigint;
    v_first_name text;
    v_qualification_code text;
BEGIN
    IF NEW.application_number IS NOT NULL AND NEW.application_number <> '' THEN
        IF NEW.application_number ~ '^APP-[0-9]+$' THEN
            v_serial := (regexp_match(NEW.application_number, '^APP-([0-9]+)$'))[1]::bigint;
        ELSE
            RAISE EXCEPTION 'Invalid application_number format: %', NEW.application_number;
        END IF;
    ELSIF NEW.student_uid IS NOT NULL AND NEW.student_uid <> '' THEN
        IF NEW.student_uid ~ '^[0-9]{8}-[0-9]+[A-Z]+-[A-Z0-9]+$' THEN
            v_serial := (regexp_match(NEW.student_uid, '^[0-9]{8}-([0-9]+)[A-Z]+-[A-Z0-9]+$'))[1]::bigint;
        ELSIF NEW.student_uid ~ '^APP-[0-9]+$' THEN
            v_serial := (regexp_match(NEW.student_uid, '^APP-([0-9]+)$'))[1]::bigint;
        ELSIF NEW.student_uid ~ '^APP-[0-9]{4}-[0-9]+$' THEN
            v_serial := (regexp_match(NEW.student_uid, '^APP-[0-9]{4}-([0-9]+)$'))[1]::bigint;
        END IF;
    END IF;

    IF v_serial IS NULL THEN
        v_serial := nextval('public.application_uid_serial_seq');
    END IF;

    IF NEW.application_number IS NULL OR NEW.application_number = '' THEN
        NEW.application_number := 'APP-' || v_serial::text;
    END IF;

    IF NEW.student_uid IS NULL OR NEW.student_uid = '' THEN
        v_date_prefix := to_char(COALESCE(NEW.created_at, now()), 'YYYYDDMM');

        v_first_name := upper(COALESCE(NULLIF(NEW.student_first_name, ''), 'STUDENT'));
        v_first_name := regexp_replace(v_first_name, '[^A-Z]', '', 'g');
        IF v_first_name = '' THEN
            v_first_name := 'STUDENT';
        END IF;

        IF NEW.qualification_id IS NULL AND NEW.offering_id IS NOT NULL THEN
            SELECT ro.qualification_id
            INTO NEW.qualification_id
            FROM public.rto_offerings ro
            WHERE ro.id = NEW.offering_id;
        END IF;

        SELECT upper(q.code)
        INTO v_qualification_code
        FROM public.qualifications q
        WHERE q.id = NEW.qualification_id;

        IF v_qualification_code IS NULL AND NEW.offering_id IS NOT NULL THEN
            SELECT upper(q.code)
            INTO v_qualification_code
            FROM public.rto_offerings ro
            JOIN public.qualifications q ON q.id = ro.qualification_id
            WHERE ro.id = NEW.offering_id;
        END IF;

        v_qualification_code := regexp_replace(COALESCE(v_qualification_code, 'UNKNOWN'), '[^A-Z0-9]', '', 'g');
        IF v_qualification_code = '' THEN
            v_qualification_code := 'UNKNOWN';
        END IF;

        NEW.student_uid := v_date_prefix || '-' || v_serial::text || v_first_name || '-' || v_qualification_code;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_application_last_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.last_updated_by = COALESCE(NEW.last_updated_by, auth.uid());
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_application_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.log_application_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF OLD.workflow_stage IS DISTINCT FROM NEW.workflow_stage THEN
        INSERT INTO public.application_history (application_id, from_stage, to_stage, changed_by)
        VALUES (NEW.id, OLD.workflow_stage::text, NEW.workflow_stage::text, auth.uid());
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_application_workflow_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    transition_allowed boolean;
    v_required_role text;
    v_allowed_roles text[];
    v_current_role text;
BEGIN
    IF NEW.workflow_stage IS NOT DISTINCT FROM OLD.workflow_stage THEN
        RETURN NEW;
    END IF;

    IF OLD.workflow_stage IS NULL THEN
        NEW.workflow_stage_updated_at = COALESCE(NEW.workflow_stage_updated_at, now());
        RETURN NEW;
    END IF;

    SELECT wt.is_allowed, wt.required_role::text, wt.allowed_roles
    INTO transition_allowed, v_required_role, v_allowed_roles
    FROM public.workflow_transitions wt
    WHERE wt.from_stage::text = OLD.workflow_stage::text
      AND wt.to_stage::text = NEW.workflow_stage::text;

    IF transition_allowed IS NULL THEN
        RAISE WARNING 'Workflow transition not defined: % -> % for application %', OLD.workflow_stage, NEW.workflow_stage, NEW.id;

        INSERT INTO public.record_activity (table_name, record_id, action, summary, user_id)
        VALUES (
            'applications',
            NEW.id,
            'undefined_transition',
            format('Undefined workflow transition: %s -> %s', OLD.workflow_stage, NEW.workflow_stage),
            COALESCE(NEW.last_updated_by, auth.uid())
        );

        NEW.workflow_stage_updated_at = now();
        RETURN NEW;
    END IF;

    IF NOT transition_allowed THEN
        RAISE EXCEPTION 'Workflow transition disabled: % -> %', OLD.workflow_stage, NEW.workflow_stage;
    END IF;

    SELECT p.role::text
    INTO v_current_role
    FROM public.profiles p
    WHERE p.id = COALESCE(NEW.last_updated_by, auth.uid());

    IF v_allowed_roles IS NOT NULL AND COALESCE(array_length(v_allowed_roles, 1), 0) > 0 THEN
        IF NOT (
            COALESCE(v_current_role = ANY(v_allowed_roles), false)
            OR COALESCE(v_current_role = 'ceo', false)
            OR COALESCE(v_current_role = 'executive_manager', false)
        ) THEN
            RAISE EXCEPTION 'Insufficient permissions: transition % -> % requires one of [%] roles',
                OLD.workflow_stage, NEW.workflow_stage, array_to_string(v_allowed_roles, ', ');
        END IF;
    ELSIF v_required_role IS NOT NULL THEN
        IF NOT (
            COALESCE(v_current_role = 'ceo', false)
            OR COALESCE(v_current_role = 'executive_manager', false)
            OR COALESCE(v_current_role = v_required_role, false)
        ) THEN
            RAISE EXCEPTION 'Insufficient permissions: transition % -> % requires % role',
                OLD.workflow_stage, NEW.workflow_stage, v_required_role;
        END IF;
    END IF;

    NEW.workflow_stage_updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_workflow_transitions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_workflow_alerts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_workflow_transition_approvals_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

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
            'Cascaded soft-delete to related applications, invoices, and documents',
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
        BEGIN
            UPDATE public.invoices
            SET is_deleted = true,
                deleted_at = now(),
                deleted_by = NEW.deleted_by
            WHERE application_id = NEW.id
              AND is_deleted = false;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'cascade_application_soft_delete: failed to cascade to invoices for application %: %', NEW.id, SQLERRM;
        END;

        BEGIN
            UPDATE public.bills
            SET is_deleted = true,
                deleted_at = now(),
                deleted_by = NEW.deleted_by
            WHERE application_id = NEW.id
              AND is_deleted = false;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'cascade_application_soft_delete: failed to cascade to bills for application %: %', NEW.id, SQLERRM;
        END;

        BEGIN
            INSERT INTO public.record_activity (table_name, record_id, action, summary, user_id)
            VALUES (
                'applications',
                NEW.id,
                'cascade_soft_delete',
                'Cascaded soft-delete to related invoices and bills (documents preserved)',
                NEW.deleted_by
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'cascade_application_soft_delete: failed to log activity for application %: %', NEW.id, SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id uuid,
    p_type public.notification_type,
    p_title varchar(255),
    p_message text,
    p_related_table varchar(100) DEFAULT NULL,
    p_related_id uuid DEFAULT NULL,
    p_priority varchar(20) DEFAULT 'normal',
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_notification_id uuid;
    v_prefs public.notification_preferences;
BEGIN
    SELECT * INTO v_prefs FROM public.notification_preferences WHERE user_id = p_user_id;

    IF v_prefs IS NULL THEN
        INSERT INTO public.notification_preferences (user_id) VALUES (p_user_id)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        related_table,
        related_id,
        priority,
        metadata
    ) VALUES (
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_related_table,
        p_related_id,
        p_priority,
        p_metadata
    ) RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_welcome_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public.create_notification(
        NEW.id,
        'welcome'::public.notification_type,
        'Welcome to Lumiere Portal!',
        'Your account has been set up. Start by exploring the dashboard.',
        NULL,
        NULL,
        'normal',
        '{}'::jsonb
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email,
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'agent')
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        email = COALESCE(EXCLUDED.email, public.profiles.email),
        role = COALESCE(EXCLUDED.role, public.profiles.role),
        updated_at = now();
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        UPDATE public.profiles SET
            full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', public.profiles.full_name),
            email = COALESCE(NEW.email, public.profiles.email),
            updated_at = now()
        WHERE id = NEW.id;
        RETURN NEW;
    WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user error: %', SQLERRM;
        RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_role_permissions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

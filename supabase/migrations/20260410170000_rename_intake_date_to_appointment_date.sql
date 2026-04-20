BEGIN;

ALTER TABLE public.applications
    RENAME COLUMN intake_date TO appointment_date;

ALTER TABLE public.applications
    ADD COLUMN IF NOT EXISTS appointment_time time;

CREATE OR REPLACE FUNCTION public.validate_application_dates()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.appointment_date IS NOT NULL AND NEW.submitted_at IS NOT NULL
       AND NEW.appointment_date < NEW.submitted_at::date THEN
        RAISE WARNING 'Application %: appointment_date (%) is before submitted_at (%)',
            NEW.id, NEW.appointment_date, NEW.submitted_at;
    END IF;

    IF NEW.coe_issued_at IS NOT NULL AND NEW.submitted_at IS NOT NULL
       AND NEW.coe_issued_at < NEW.submitted_at THEN
        RAISE WARNING 'Application %: coe_issued_at (%) is before submitted_at (%)',
            NEW.id, NEW.coe_issued_at, NEW.submitted_at;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP VIEW IF EXISTS public.applications_denormalized;
CREATE VIEW public.applications_denormalized WITH (security_invoker = true) AS
SELECT
    a.id,
    a.student_uid,
    COALESCE(sm.first_name, a.student_first_name) AS student_first_name,
    COALESCE(sm.last_name, a.student_last_name) AS student_last_name,
    COALESCE(sm.email, a.student_email) AS student_email,
    COALESCE(sm.phone, a.student_phone) AS student_phone,
    COALESCE(sm.dob, a.student_dob) AS student_dob,
    COALESCE(sm.passport_number, a.student_passport_number) AS student_passport_number,
    COALESCE(sm.nationality, a.student_nationality) AS student_nationality,
    COALESCE(sm.gender, a.student_gender) AS student_gender,
    COALESCE(sm.country_of_birth, a.student_country_of_birth) AS student_country_of_birth,
    COALESCE(sm.address, a.student_address) AS student_address,
    COALESCE(sm.street_no, a.student_street_no) AS student_street_no,
    COALESCE(sm.suburb, a.student_suburb) AS student_suburb,
    COALESCE(sm.state, a.student_state) AS student_state,
    COALESCE(sm.postcode, a.student_postcode) AS student_postcode,
    COALESCE(sm.usi, a.student_usi) AS student_usi,
    COALESCE(sm.visa_number, a.student_visa_number) AS student_visa_number,
    COALESCE(sm.visa_expiry, a.student_visa_expiry) AS student_visa_expiry,
    a.student_master_id,
    a.partner_id,
    a.offering_id,
    a.workflow_stage,
    a.payment_status,
    a.quoted_tuition,
    a.quoted_materials,
    a.total_paid,
    a.appointment_date,
    a.appointment_time,
    a.submitted_at,
    a.coe_issued_at,
    a.created_by,
    a.assigned_to,
    a.assigned_staff_id,
    a.locked_by,
    a.lock_timestamp,
    a.lock_timeout,
    a.is_archived,
    a.archived_at,
    a.archived_by,
    a.is_deleted,
    a.deleted_at,
    a.deleted_by,
    a.created_at,
    a.updated_at
FROM public.applications a
LEFT JOIN public.student_master sm ON a.student_master_id = sm.id AND sm.is_deleted = false;

COMMIT;

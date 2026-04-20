-- Manual SQL Phase 4
-- App-facing views excluded from Prisma ownership.

DROP VIEW IF EXISTS public.trash_bin;
CREATE VIEW public.trash_bin WITH (security_invoker = true) AS
SELECT
    'applications' AS table_name,
    id::text AS record_id,
    student_uid AS identifier,
    CONCAT(student_first_name, ' ', student_last_name) AS display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM public.profiles WHERE id = deleted_by) AS deleted_by_name
FROM public.applications WHERE is_deleted = true
UNION ALL
SELECT
    'partners' AS table_name,
    id::text AS record_id,
    email AS identifier,
    company_name AS display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM public.profiles WHERE id = deleted_by) AS deleted_by_name
FROM public.partners WHERE is_deleted = true
UNION ALL
SELECT
    'rtos' AS table_name,
    id::text AS record_id,
    code AS identifier,
    name AS display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM public.profiles WHERE id = deleted_by) AS deleted_by_name
FROM public.rtos WHERE is_deleted = true
UNION ALL
SELECT
    'qualifications' AS table_name,
    id::text AS record_id,
    code AS identifier,
    name AS display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM public.profiles WHERE id = deleted_by) AS deleted_by_name
FROM public.qualifications WHERE is_deleted = true
UNION ALL
SELECT
    'invoices' AS table_name,
    id::text AS record_id,
    invoice_number AS identifier,
    student_name AS display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM public.profiles WHERE id = deleted_by) AS deleted_by_name
FROM public.invoices WHERE is_deleted = true
UNION ALL
SELECT
    'bills' AS table_name,
    id::text AS record_id,
    bill_number AS identifier,
    description AS display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM public.profiles WHERE id = deleted_by) AS deleted_by_name
FROM public.bills WHERE is_deleted = true
UNION ALL
SELECT
    'student_master' AS table_name,
    id::text AS record_id,
    email AS identifier,
    CONCAT(first_name, ' ', last_name) AS display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM public.profiles WHERE id = deleted_by) AS deleted_by_name
FROM public.student_master WHERE is_deleted = true
UNION ALL
SELECT
    'profiles' AS table_name,
    id::text AS record_id,
    email AS identifier,
    full_name AS display_name,
    deleted_at,
    deleted_by,
    (SELECT full_name FROM public.profiles WHERE id = deleted_by) AS deleted_by_name
FROM public.profiles WHERE is_deleted = true
ORDER BY deleted_at DESC;

CREATE OR REPLACE VIEW public.valid_workflow_transitions WITH (security_invoker = true) AS
SELECT
    from_stage,
    to_stage,
    requires_approval,
    required_role
FROM public.workflow_transitions
WHERE is_allowed = true
ORDER BY from_stage, to_stage;

DROP VIEW IF EXISTS public.application_lock_status;
CREATE VIEW public.application_lock_status WITH (security_invoker = true) AS
SELECT
    a.id,
    a.student_uid,
    a.workflow_stage,
    a.locked_by,
    p.full_name AS locked_by_name,
    a.lock_timestamp,
    a.lock_timeout,
    NOW() - a.lock_timestamp AS lock_duration,
    (a.lock_timestamp + COALESCE(a.lock_timeout, '1 hour'::interval)) AS lock_expires_at,
    CASE
        WHEN a.locked_by IS NULL THEN 'unlocked'
        WHEN (a.lock_timestamp + COALESCE(a.lock_timeout, '1 hour'::interval)) < NOW() THEN 'expired'
        ELSE 'active'
    END AS lock_status
FROM public.applications a
LEFT JOIN public.profiles p ON a.locked_by = p.id
WHERE a.is_deleted = false;

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

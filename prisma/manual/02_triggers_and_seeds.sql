-- Manual SQL Phase 2
-- Essential triggers and seed data.

ALTER TABLE public.workflow_transition_approvals
    DROP CONSTRAINT IF EXISTS workflow_transition_approvals_status_check;

ALTER TABLE public.workflow_transition_approvals
    ADD CONSTRAINT workflow_transition_approvals_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'executed'));

DROP TRIGGER IF EXISTS set_student_uid ON public.applications;
CREATE TRIGGER set_student_uid
    BEFORE INSERT ON public.applications
    FOR EACH ROW
    WHEN (
        NEW.student_uid IS NULL OR NEW.student_uid = ''
        OR NEW.application_number IS NULL OR NEW.application_number = ''
    )
    EXECUTE FUNCTION public.generate_student_uid();

DROP TRIGGER IF EXISTS tr_application_last_updated ON public.applications;
CREATE TRIGGER tr_application_last_updated
    BEFORE UPDATE ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_application_last_updated_by();

DROP TRIGGER IF EXISTS tr_applications_payment_status_sync ON public.applications;
CREATE TRIGGER tr_applications_payment_status_sync
    BEFORE INSERT OR UPDATE OF total_paid, quoted_tuition, quoted_materials ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_application_payment_status();

DROP TRIGGER IF EXISTS tr_validate_workflow_transition ON public.applications;
CREATE TRIGGER tr_validate_workflow_transition
    BEFORE UPDATE OF workflow_stage ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_application_workflow_transition();

DROP TRIGGER IF EXISTS tr_application_stage_change ON public.applications;
CREATE TRIGGER tr_application_stage_change
    AFTER UPDATE OF workflow_stage ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION public.log_application_stage_change();

DROP TRIGGER IF EXISTS tr_cascade_partner_soft_delete ON public.partners;
CREATE TRIGGER tr_cascade_partner_soft_delete
    AFTER UPDATE OF is_deleted ON public.partners
    FOR EACH ROW
    WHEN (NEW.is_deleted = true AND OLD.is_deleted = false)
    EXECUTE FUNCTION public.cascade_partner_soft_delete();

DROP TRIGGER IF EXISTS tr_cascade_rto_soft_delete ON public.rtos;
CREATE TRIGGER tr_cascade_rto_soft_delete
    AFTER UPDATE OF is_deleted ON public.rtos
    FOR EACH ROW
    WHEN (NEW.is_deleted = true AND OLD.is_deleted = false)
    EXECUTE FUNCTION public.cascade_rto_soft_delete();

DROP TRIGGER IF EXISTS tr_cascade_application_soft_delete ON public.applications;
CREATE TRIGGER tr_cascade_application_soft_delete
    AFTER UPDATE OF is_deleted ON public.applications
    FOR EACH ROW
    WHEN (NEW.is_deleted = true AND OLD.is_deleted = false)
    EXECUTE FUNCTION public.cascade_application_soft_delete();

DROP TRIGGER IF EXISTS update_workflow_transitions_updated_at ON public.workflow_transitions;
CREATE TRIGGER update_workflow_transitions_updated_at
    BEFORE UPDATE ON public.workflow_transitions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_workflow_transitions_updated_at();

DROP TRIGGER IF EXISTS update_workflow_alerts_updated_at ON public.workflow_alerts;
CREATE TRIGGER update_workflow_alerts_updated_at
    BEFORE UPDATE ON public.workflow_alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_workflow_alerts_updated_at();

DROP TRIGGER IF EXISTS update_workflow_transition_approvals_updated_at ON public.workflow_transition_approvals;
CREATE TRIGGER update_workflow_transition_approvals_updated_at
    BEFORE UPDATE ON public.workflow_transition_approvals
    FOR EACH ROW
    EXECUTE FUNCTION public.set_workflow_transition_approvals_updated_at();

DROP TRIGGER IF EXISTS update_role_permissions_updated_at ON public.role_permissions;
CREATE TRIGGER update_role_permissions_updated_at
    BEFORE UPDATE ON public.role_permissions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_role_permissions_updated_at();

DROP TRIGGER IF EXISTS tr_welcome_notification ON public.profiles;
CREATE TRIGGER tr_welcome_notification
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.create_welcome_notification();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

DELETE FROM public.workflow_transitions;

INSERT INTO public.workflow_transitions (
    from_stage,
    to_stage,
    is_allowed,
    requires_approval,
    required_role,
    allowed_roles
)
VALUES
    ('draft', 'submitted', true, false, null, ARRAY['frontdesk', 'admin', 'executive_manager', 'agent', 'developer', 'ceo']::text[]),
    ('submitted', 'docs_review', true, false, null, ARRAY['frontdesk', 'admin', 'executive_manager', 'developer', 'ceo']::text[]),
    ('docs_review', 'enrolled', true, false, 'admin', ARRAY['admin', 'agent']::text[]),
    ('enrolled', 'evaluate', true, false, 'assessor', ARRAY['assessor']::text[]),
    ('evaluate', 'dispatch', true, false, 'accounts_manager', ARRAY['accounts_manager']::text[]),
    ('dispatch', 'completed', true, false, 'dispatch_coordinator', ARRAY['dispatch_coordinator', 'admin', 'executive_manager']::text[])
ON CONFLICT (from_stage, to_stage)
DO UPDATE SET
    is_allowed = EXCLUDED.is_allowed,
    requires_approval = EXCLUDED.requires_approval,
    required_role = EXCLUDED.required_role,
    allowed_roles = EXCLUDED.allowed_roles,
    updated_at = now();

WITH roles(role) AS (
    VALUES
        ('ceo'),
        ('developer'),
        ('executive_manager'),
        ('admin'),
        ('accounts_manager'),
        ('assessor'),
        ('dispatch_coordinator'),
        ('frontdesk'),
        ('agent')
),
permission_keys(permission_key) AS (
    VALUES
        ('applications.view'),
        ('applications.create'),
        ('applications.edit'),
        ('applications.delete'),
        ('applications.change_stage'),
        ('applications.assign'),
        ('applications.export'),
        ('documents.view'),
        ('documents.upload'),
        ('documents.verify'),
        ('documents.delete'),
        ('rtos.view'),
        ('rtos.manage'),
        ('qualifications.view'),
        ('qualifications.manage'),
        ('partners.view'),
        ('partners.manage'),
        ('partners.view_kpi'),
        ('tickets.view'),
        ('tickets.create'),
        ('tickets.manage'),
        ('staff.view'),
        ('staff.manage'),
        ('roles.manage'),
        ('audit.view'),
        ('templates.manage'),
        ('settings.manage')
),
defaults AS (
    SELECT
        r.role,
        p.permission_key,
        CASE
            WHEN r.role IN ('ceo', 'developer') THEN true
            WHEN r.role = 'executive_manager' THEN p.permission_key = ANY (ARRAY[
                'applications.view','applications.create','applications.edit','applications.change_stage','applications.assign','applications.export',
                'documents.view','documents.upload','documents.verify','rtos.view','rtos.manage','qualifications.view','qualifications.manage',
                'partners.view','partners.manage','partners.view_kpi','tickets.view','tickets.create','tickets.manage','staff.view','audit.view','templates.manage'
            ]::text[])
            WHEN r.role = 'admin' THEN p.permission_key = ANY (ARRAY[
                'applications.view','applications.create','applications.edit','applications.change_stage','applications.assign','applications.export',
                'documents.view','documents.upload','documents.verify','rtos.view','rtos.manage','qualifications.view','qualifications.manage',
                'partners.view','partners.manage','partners.view_kpi','tickets.view','tickets.create','tickets.manage','staff.view','audit.view'
            ]::text[])
            WHEN r.role = 'accounts_manager' THEN p.permission_key = ANY (ARRAY[
                'applications.view','applications.create','applications.edit','applications.change_stage','applications.export','documents.view',
                'documents.upload','rtos.view','qualifications.view','partners.view','partners.view_kpi','tickets.view','tickets.create'
            ]::text[])
            WHEN r.role = 'assessor' THEN p.permission_key = ANY (ARRAY[
                'applications.view','applications.create','applications.edit','applications.change_stage','documents.view','documents.upload',
                'documents.verify','rtos.view','qualifications.view','partners.view','tickets.view','tickets.create'
            ]::text[])
            WHEN r.role = 'dispatch_coordinator' THEN p.permission_key = ANY (ARRAY[
                'applications.view','applications.create','applications.edit','applications.change_stage','documents.view','documents.upload',
                'rtos.view','qualifications.view','partners.view','tickets.view','tickets.create'
            ]::text[])
            WHEN r.role = 'frontdesk' THEN p.permission_key = ANY (ARRAY[
                'applications.view','applications.create','applications.edit','applications.change_stage','documents.view','documents.upload',
                'rtos.view','qualifications.view','partners.view','tickets.view','tickets.create'
            ]::text[])
            WHEN r.role = 'agent' THEN p.permission_key = ANY (ARRAY[
                'applications.view','applications.create','documents.view','documents.upload','rtos.view','qualifications.view','tickets.view','tickets.create'
            ]::text[])
            ELSE false
        END AS granted
    FROM roles r
    CROSS JOIN permission_keys p
)
INSERT INTO public.role_permissions (role, permission_key, granted)
SELECT role, permission_key, granted
FROM defaults
ON CONFLICT (role, permission_key)
DO UPDATE SET
    granted = EXCLUDED.granted,
    updated_at = now();

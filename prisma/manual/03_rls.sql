-- Manual SQL Phase 3
-- RLS policies for key Supabase-managed tables.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rto_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_transition_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_transition_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile fields" ON public.profiles;
CREATE POLICY "Users can update own profile fields"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
        AND account_status = (SELECT p.account_status FROM public.profiles p WHERE p.id = auth.uid())
        AND is_deleted = (SELECT p.is_deleted FROM public.profiles p WHERE p.id = auth.uid())
        AND deleted_at IS NOT DISTINCT FROM (SELECT p.deleted_at FROM public.profiles p WHERE p.id = auth.uid())
        AND deleted_by IS NOT DISTINCT FROM (SELECT p.deleted_by FROM public.profiles p WHERE p.id = auth.uid())
    );

DROP POLICY IF EXISTS "Staff can update profiles except role" ON public.profiles;
CREATE POLICY "Staff can update profiles except role"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role NOT IN ('agent', 'assessor')
        )
    )
    WITH CHECK (
        role = (SELECT p.role FROM public.profiles p WHERE p.id = public.profiles.id)
        AND account_status = (SELECT p.account_status FROM public.profiles p WHERE p.id = public.profiles.id)
        AND is_deleted = (SELECT p.is_deleted FROM public.profiles p WHERE p.id = public.profiles.id)
        AND deleted_at IS NOT DISTINCT FROM (SELECT p.deleted_at FROM public.profiles p WHERE p.id = public.profiles.id)
        AND deleted_by IS NOT DISTINCT FROM (SELECT p.deleted_by FROM public.profiles p WHERE p.id = public.profiles.id)
    );

DROP POLICY IF EXISTS "CEO and Developer can update any profile with role" ON public.profiles;
CREATE POLICY "CEO and Developer can update any profile with role"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('ceo', 'developer')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('ceo', 'developer')
        )
    );

DROP POLICY IF EXISTS "Staff read all applications" ON public.applications;
DROP POLICY IF EXISTS "Agents read own applications" ON public.applications;
DROP POLICY IF EXISTS "Staff manage applications" ON public.applications;
DROP POLICY IF EXISTS "Staff insert applications" ON public.applications;
DROP POLICY IF EXISTS "Staff update applications" ON public.applications;
DROP POLICY IF EXISTS "Staff delete applications" ON public.applications;
DROP POLICY IF EXISTS "Agents create applications" ON public.applications;
DROP POLICY IF EXISTS "Agents update own draft applications" ON public.applications;
DROP POLICY IF EXISTS "Read applications" ON public.applications;
DROP POLICY IF EXISTS "Insert applications" ON public.applications;
DROP POLICY IF EXISTS "Update applications" ON public.applications;
DROP POLICY IF EXISTS "Delete applications" ON public.applications;

CREATE POLICY "Read applications" ON public.applications
    FOR SELECT TO authenticated
    USING (
        public.current_user_role() <> 'agent'::public.user_role
        OR partner_id IN (
            SELECT p.id
            FROM public.partners p
            WHERE p.user_id = auth.uid()
        )
    );

CREATE POLICY "Insert applications" ON public.applications
    FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'executive_manager'::public.user_role,
                'admin'::public.user_role,
                'accounts_manager'::public.user_role,
                'dispatch_coordinator'::public.user_role,
                'frontdesk'::public.user_role,
                'developer'::public.user_role
            ]
        )
        OR (
            public.current_user_role() = 'agent'::public.user_role
            AND partner_id IN (
                SELECT p.id
                FROM public.partners p
                WHERE p.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Update applications" ON public.applications
    FOR UPDATE TO authenticated
    USING (
        public.current_user_role() <> 'agent'::public.user_role
        OR (
            public.current_user_role() = 'agent'::public.user_role
            AND partner_id IN (
                SELECT p.id
                FROM public.partners p
                WHERE p.user_id = auth.uid()
            )
            AND workflow_stage = 'draft'::public.workflow_stage
        )
    )
    WITH CHECK (
        public.current_user_role() <> 'agent'::public.user_role
        OR (
            public.current_user_role() = 'agent'::public.user_role
            AND partner_id IN (
                SELECT p.id
                FROM public.partners p
                WHERE p.user_id = auth.uid()
            )
            AND workflow_stage = 'draft'::public.workflow_stage
        )
    );

CREATE POLICY "Delete applications" ON public.applications
    FOR DELETE TO authenticated
    USING (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'developer'::public.user_role
            ]
        )
    );

DROP POLICY IF EXISTS "Staff read all partners" ON public.partners;
DROP POLICY IF EXISTS "Agents read own partner" ON public.partners;
DROP POLICY IF EXISTS "Staff manage partners" ON public.partners;
DROP POLICY IF EXISTS "Authenticated users read partners" ON public.partners;
DROP POLICY IF EXISTS "Read partners" ON public.partners;
DROP POLICY IF EXISTS "Staff insert partners" ON public.partners;
DROP POLICY IF EXISTS "Staff update partners" ON public.partners;
DROP POLICY IF EXISTS "Staff delete partners" ON public.partners;

CREATE POLICY "Read partners" ON public.partners
    FOR SELECT TO authenticated
    USING (
        public.current_user_role() <> 'agent'::public.user_role
        OR user_id = auth.uid()
    );

CREATE POLICY "Staff insert partners" ON public.partners
    FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'executive_manager'::public.user_role,
                'admin'::public.user_role,
                'developer'::public.user_role
            ]
        )
    );

CREATE POLICY "Staff update partners" ON public.partners
    FOR UPDATE TO authenticated
    USING (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'executive_manager'::public.user_role,
                'admin'::public.user_role,
                'developer'::public.user_role
            ]
        )
    )
    WITH CHECK (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'executive_manager'::public.user_role,
                'admin'::public.user_role,
                'developer'::public.user_role
            ]
        )
    );

CREATE POLICY "Staff delete partners" ON public.partners
    FOR DELETE TO authenticated
    USING (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'executive_manager'::public.user_role,
                'admin'::public.user_role,
                'developer'::public.user_role
            ]
        )
    );

DROP POLICY IF EXISTS "Manage qualifications" ON public.qualifications;
DROP POLICY IF EXISTS "Read qualifications" ON public.qualifications;
DROP POLICY IF EXISTS "Authenticated users read qualifications" ON public.qualifications;
DROP POLICY IF EXISTS "Staff manage qualifications" ON public.qualifications;
DROP POLICY IF EXISTS "Staff insert qualifications" ON public.qualifications;
DROP POLICY IF EXISTS "Staff update qualifications" ON public.qualifications;
DROP POLICY IF EXISTS "Staff delete qualifications" ON public.qualifications;

CREATE POLICY "Read qualifications" ON public.qualifications
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Staff insert qualifications" ON public.qualifications
    FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'executive_manager'::public.user_role,
                'admin'::public.user_role,
                'developer'::public.user_role
            ]
        )
    );

CREATE POLICY "Staff update qualifications" ON public.qualifications
    FOR UPDATE TO authenticated
    USING (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'executive_manager'::public.user_role,
                'admin'::public.user_role,
                'developer'::public.user_role
            ]
        )
    )
    WITH CHECK (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'executive_manager'::public.user_role,
                'admin'::public.user_role,
                'developer'::public.user_role
            ]
        )
    );

CREATE POLICY "Staff delete qualifications" ON public.qualifications
    FOR DELETE TO authenticated
    USING (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'executive_manager'::public.user_role,
                'admin'::public.user_role,
                'developer'::public.user_role
            ]
        )
    );

DROP POLICY IF EXISTS "Manage rtos" ON public.rtos;
DROP POLICY IF EXISTS "Read rtos" ON public.rtos;
DROP POLICY IF EXISTS "Authenticated users read rtos" ON public.rtos;
DROP POLICY IF EXISTS "Staff manage rtos" ON public.rtos;
DROP POLICY IF EXISTS "Staff insert rtos" ON public.rtos;
DROP POLICY IF EXISTS "Staff update rtos" ON public.rtos;
DROP POLICY IF EXISTS "Staff delete rtos" ON public.rtos;

CREATE POLICY "Read rtos" ON public.rtos
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Staff insert rtos" ON public.rtos
    FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'executive_manager'::public.user_role,
                'admin'::public.user_role,
                'developer'::public.user_role
            ]
        )
    );

CREATE POLICY "Staff update rtos" ON public.rtos
    FOR UPDATE TO authenticated
    USING (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'executive_manager'::public.user_role,
                'admin'::public.user_role,
                'developer'::public.user_role
            ]
        )
    )
    WITH CHECK (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'executive_manager'::public.user_role,
                'admin'::public.user_role,
                'developer'::public.user_role
            ]
        )
    );

CREATE POLICY "Staff delete rtos" ON public.rtos
    FOR DELETE TO authenticated
    USING (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'executive_manager'::public.user_role,
                'admin'::public.user_role,
                'developer'::public.user_role
            ]
        )
    );

DROP POLICY IF EXISTS "Manage offerings" ON public.rto_offerings;
DROP POLICY IF EXISTS "Read offerings" ON public.rto_offerings;
DROP POLICY IF EXISTS "Authenticated users read rto_offerings" ON public.rto_offerings;
DROP POLICY IF EXISTS "Read rto offerings" ON public.rto_offerings;
DROP POLICY IF EXISTS "Staff manage rto offerings" ON public.rto_offerings;
DROP POLICY IF EXISTS "Staff insert rto offerings" ON public.rto_offerings;
DROP POLICY IF EXISTS "Staff update rto offerings" ON public.rto_offerings;
DROP POLICY IF EXISTS "Staff delete rto offerings" ON public.rto_offerings;

CREATE POLICY "Read rto offerings" ON public.rto_offerings
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Staff insert rto offerings" ON public.rto_offerings
    FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'executive_manager'::public.user_role,
                'admin'::public.user_role,
                'developer'::public.user_role
            ]
        )
    );

CREATE POLICY "Staff update rto offerings" ON public.rto_offerings
    FOR UPDATE TO authenticated
    USING (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'executive_manager'::public.user_role,
                'admin'::public.user_role,
                'developer'::public.user_role
            ]
        )
    )
    WITH CHECK (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'executive_manager'::public.user_role,
                'admin'::public.user_role,
                'developer'::public.user_role
            ]
        )
    );

CREATE POLICY "Staff delete rto offerings" ON public.rto_offerings
    FOR DELETE TO authenticated
    USING (
        public.current_user_role() = ANY (
            ARRAY[
                'ceo'::public.user_role,
                'executive_manager'::public.user_role,
                'admin'::public.user_role,
                'developer'::public.user_role
            ]
        )
    );

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "System can create notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage their preferences" ON public.notification_preferences;
CREATE POLICY "Users can manage their preferences"
    ON public.notification_preferences FOR ALL
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Read workflow transitions" ON public.workflow_transitions;
CREATE POLICY "Read workflow transitions"
    ON public.workflow_transitions FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Manage workflow transitions by admin" ON public.workflow_transitions;
CREATE POLICY "Manage workflow transitions by admin"
    ON public.workflow_transitions FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('ceo', 'executive_manager', 'admin', 'developer')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('ceo', 'executive_manager', 'admin', 'developer')
        )
    );

DROP POLICY IF EXISTS "Workflow transition events viewable by app access" ON public.workflow_transition_events;
CREATE POLICY "Workflow transition events viewable by app access"
    ON public.workflow_transition_events FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.applications a
            LEFT JOIN public.partners p ON p.id = a.partner_id
            JOIN public.profiles pr ON pr.id = auth.uid()
            WHERE a.id = workflow_transition_events.application_id
              AND (pr.role <> 'agent' OR p.user_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Workflow transition events insert by app access" ON public.workflow_transition_events;
CREATE POLICY "Workflow transition events insert by app access"
    ON public.workflow_transition_events FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.applications a
            LEFT JOIN public.partners p ON p.id = a.partner_id
            JOIN public.profiles pr ON pr.id = auth.uid()
            WHERE a.id = workflow_transition_events.application_id
              AND (
                pr.role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer')
                OR (pr.role = 'agent' AND p.user_id = auth.uid())
              )
        )
    );

DROP POLICY IF EXISTS "Workflow alerts viewable by app access" ON public.workflow_alerts;
CREATE POLICY "Workflow alerts viewable by app access"
    ON public.workflow_alerts FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.applications a
            LEFT JOIN public.partners p ON p.id = a.partner_id
            JOIN public.profiles pr ON pr.id = auth.uid()
            WHERE a.id = workflow_alerts.application_id
              AND (pr.role <> 'agent' OR p.user_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Workflow alerts managed by staff" ON public.workflow_alerts;
CREATE POLICY "Workflow alerts managed by staff"
    ON public.workflow_alerts FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer')
        )
    );

DROP POLICY IF EXISTS "Workflow assignments viewable by app access" ON public.workflow_assignments;
CREATE POLICY "Workflow assignments viewable by app access"
    ON public.workflow_assignments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.applications a
            LEFT JOIN public.partners p ON p.id = a.partner_id
            JOIN public.profiles pr ON pr.id = auth.uid()
            WHERE a.id = workflow_assignments.application_id
              AND (pr.role <> 'agent' OR p.user_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Workflow assignments managed by staff" ON public.workflow_assignments;
CREATE POLICY "Workflow assignments managed by staff"
    ON public.workflow_assignments FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer')
        )
    );

DROP POLICY IF EXISTS "Workflow transition approvals viewable by app access" ON public.workflow_transition_approvals;
CREATE POLICY "Workflow transition approvals viewable by app access"
    ON public.workflow_transition_approvals FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.applications a
            LEFT JOIN public.partners p ON p.id = a.partner_id
            JOIN public.profiles pr ON pr.id = auth.uid()
            WHERE a.id = workflow_transition_approvals.application_id
              AND (pr.role <> 'agent' OR p.user_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Workflow transition approvals managed by staff" ON public.workflow_transition_approvals;
CREATE POLICY "Workflow transition approvals managed by staff"
    ON public.workflow_transition_approvals FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('ceo', 'executive_manager', 'admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer')
        )
    );

DROP POLICY IF EXISTS "Users can read own role permissions" ON public.role_permissions;
CREATE POLICY "Users can read own role permissions"
    ON public.role_permissions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (p.role::text = role_permissions.role OR p.role IN ('ceo', 'developer'))
        )
    );

DROP POLICY IF EXISTS "Admins manage role permissions" ON public.role_permissions;
CREATE POLICY "Admins manage role permissions"
    ON public.role_permissions FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('ceo', 'developer')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('ceo', 'developer')
        )
    );

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_object THEN NULL;
    END;
END;
$$;

-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 061_restore_core_rls_policies
-- Purpose: Restore browser-facing RLS policies for core catalog and application tables
-- ============================================

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

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rto_offerings ENABLE ROW LEVEL SECURITY;

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

BEGIN;

DROP POLICY IF EXISTS "Staff can view email templates" ON public.email_templates;

CREATE POLICY "Staff can view email templates"
    ON public.email_templates FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE id = auth.uid()
              AND is_staff_role(role::text)
        )
    );

COMMIT;

-- Manual SQL Phase 5
-- Partial and non-Prisma indexes for app behavior/performance.

CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted
    ON public.profiles(is_deleted)
    WHERE is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_assignments_active
    ON public.workflow_assignments(application_id, stage, assignee_id)
    WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_transition_approvals_pending
    ON public.workflow_transition_approvals(application_id, from_stage, to_stage)
    WHERE status = 'pending';

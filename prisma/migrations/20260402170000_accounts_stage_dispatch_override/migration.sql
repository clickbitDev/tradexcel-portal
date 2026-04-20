ALTER TYPE "workflow_stage" ADD VALUE IF NOT EXISTS 'accounts' AFTER 'evaluate';

ALTER TABLE "applications"
ADD COLUMN IF NOT EXISTS "dispatch_approval_requested_at" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "dispatch_approval_requested_by" UUID,
ADD COLUMN IF NOT EXISTS "dispatch_approval_approved_at" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "dispatch_approval_approved_by" UUID,
ADD COLUMN IF NOT EXISTS "dispatch_override_used" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "idx_applications_dispatch_approval_requested_by"
ON "applications"("dispatch_approval_requested_by");

CREATE INDEX IF NOT EXISTS "idx_applications_dispatch_approval_approved_by"
ON "applications"("dispatch_approval_approved_by");

DELETE FROM "workflow_transitions"
WHERE "from_stage" = 'evaluate'
  AND "to_stage" = 'dispatch';

INSERT INTO "workflow_transitions" (
    "from_stage",
    "to_stage",
    "is_allowed",
    "requires_approval",
    "required_role",
    "allowed_roles"
)
VALUES
    ('evaluate', 'accounts', true, false, 'admin', ARRAY['admin', 'developer']::text[]),
    ('accounts', 'dispatch', true, false, 'accounts_manager', ARRAY['accounts_manager']::text[])
ON CONFLICT ("from_stage", "to_stage")
DO UPDATE SET
    "is_allowed" = EXCLUDED."is_allowed",
    "requires_approval" = EXCLUDED."requires_approval",
    "required_role" = EXCLUDED."required_role",
    "allowed_roles" = EXCLUDED."allowed_roles",
    "updated_at" = now();

-- Ensure sub-agent is supported as a partner type.
-- This keeps form options and DB enum values in sync.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'partner_type'
    ) THEN
        ALTER TYPE partner_type ADD VALUE IF NOT EXISTS 'subagent';
    END IF;
END $$;

-- ============================================
-- SHARP FUTURE DATABASE MIGRATION
-- Migration: 20260317153000_agent_frontdesk_notification_task
-- Purpose: Track agent-to-frontdesk notification task completion for new applications
-- ============================================

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS agent_frontdesk_notified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agent_frontdesk_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agent_frontdesk_notified_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN applications.agent_frontdesk_notified IS 'Whether an agent has notified the frontdesk team about a newly submitted application';
COMMENT ON COLUMN applications.agent_frontdesk_notified_at IS 'Timestamp when the frontdesk team was notified by the agent';
COMMENT ON COLUMN applications.agent_frontdesk_notified_by IS 'User who triggered the frontdesk notification task';

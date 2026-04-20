-- ============================================
-- PROFILE ENHANCEMENTS
-- Migration: 011_profile_enhancements
-- ============================================
-- Add new fields for enhanced profile management

-- Add company_name field (for agents who may have their own business name)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Add secondary_emails array (for additional email addresses)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS secondary_emails TEXT[] DEFAULT '{}';

-- Add social_links JSONB for social media accounts
-- Format: {"linkedin": "url", "twitter": "url", "facebook": "url", "instagram": "url"}
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';

-- Add index on role for faster filtering in staff/agent management
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

COMMENT ON COLUMN profiles.company_name IS 'Business/company name for the user';
COMMENT ON COLUMN profiles.secondary_emails IS 'Additional email addresses for the user';
COMMENT ON COLUMN profiles.social_links IS 'Social media account links as JSON object';

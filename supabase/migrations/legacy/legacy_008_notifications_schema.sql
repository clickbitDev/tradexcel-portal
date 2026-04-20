-- Notifications System Schema
-- Comprehensive notification system for all portal events

-- Notification types enum
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'application_update',   -- Application status/workflow changes
        'document_uploaded',    -- New document added
        'document_verified',    -- Document verification status changed
        'comment_added',        -- New comment on application
        'mention',              -- User was mentioned
        'payment_received',     -- Payment/invoice update
        'reminder',             -- Deadline or scheduled reminder
        'approval_required',    -- Action needs approval
        'partner_update',       -- Partner status change
        'system_alert',         -- System-wide notifications
        'welcome',              -- Welcome/onboarding
        'deadline_warning',     -- Upcoming deadline
        'assignment'            -- Record assigned to user
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Related entities (optional, for navigation)
    related_table VARCHAR(100),
    related_id UUID,
    
    -- Metadata for additional context
    metadata JSONB DEFAULT '{}',
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    -- Priority (for sorting and filtering)
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ -- Optional expiration for temporary notifications
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_related ON notifications(related_table, related_id);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    
    -- Email preferences
    email_enabled BOOLEAN DEFAULT TRUE,
    email_frequency VARCHAR(20) DEFAULT 'instant' CHECK (email_frequency IN ('instant', 'daily', 'weekly', 'never')),
    
    -- In-app preferences by type
    in_app_application_updates BOOLEAN DEFAULT TRUE,
    in_app_documents BOOLEAN DEFAULT TRUE,
    in_app_comments BOOLEAN DEFAULT TRUE,
    in_app_payments BOOLEAN DEFAULT TRUE,
    in_app_reminders BOOLEAN DEFAULT TRUE,
    in_app_system BOOLEAN DEFAULT TRUE,
    
    -- Email preferences by type
    email_application_updates BOOLEAN DEFAULT TRUE,
    email_documents BOOLEAN DEFAULT FALSE,
    email_comments BOOLEAN DEFAULT FALSE,
    email_payments BOOLEAN DEFAULT TRUE,
    email_reminders BOOLEAN DEFAULT TRUE,
    email_system BOOLEAN DEFAULT TRUE,
    
    -- Quiet hours
    quiet_hours_enabled BOOLEAN DEFAULT FALSE,
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '07:00',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type notification_type,
    p_title VARCHAR(255),
    p_message TEXT,
    p_related_table VARCHAR(100) DEFAULT NULL,
    p_related_id UUID DEFAULT NULL,
    p_priority VARCHAR(20) DEFAULT 'normal',
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
    v_prefs notification_preferences;
BEGIN
    -- Check if user has disabled this notification type
    SELECT * INTO v_prefs FROM notification_preferences WHERE user_id = p_user_id;
    
    -- If no preferences exist, create default
    IF v_prefs IS NULL THEN
        INSERT INTO notification_preferences (user_id) VALUES (p_user_id);
    END IF;
    
    -- Insert notification
    INSERT INTO notifications (
        user_id, type, title, message, 
        related_table, related_id, priority, metadata
    ) VALUES (
        p_user_id, p_type, p_title, p_message,
        p_related_table, p_related_id, p_priority, p_metadata
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE notifications 
    SET is_read = TRUE, read_at = NOW()
    WHERE id = p_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE notifications 
    SET is_read = TRUE, read_at = NOW()
    WHERE user_id = p_user_id AND is_read = FALSE;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications" ON notifications
    FOR INSERT WITH CHECK (TRUE);

-- RLS Policies for preferences
DROP POLICY IF EXISTS "Users can manage their preferences" ON notification_preferences;
CREATE POLICY "Users can manage their preferences" ON notification_preferences
    FOR ALL USING (auth.uid() = user_id);

-- Trigger to create welcome notification for new users
CREATE OR REPLACE FUNCTION create_welcome_notification()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_notification(
        NEW.id,
        'welcome',
        'Welcome to Lumiere Portal!',
        'Your account has been set up. Start by exploring the dashboard.',
        NULL,
        NULL,
        'normal',
        '{}'::jsonb
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_welcome_notification ON profiles;
CREATE TRIGGER tr_welcome_notification
AFTER INSERT ON profiles
FOR EACH ROW EXECUTE FUNCTION create_welcome_notification();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

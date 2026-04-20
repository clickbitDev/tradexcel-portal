-- ============================================
-- FIX WELCOME NOTIFICATION TRIGGER
-- Migration: 033_fix_welcome_notification
-- ============================================
-- This fixes the profile creation failure caused by
-- create_welcome_notification calling create_notification
-- with incorrect argument types.
-- ============================================

-- Fix the trigger function with proper type casts and error handling
CREATE OR REPLACE FUNCTION public.create_welcome_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Call create_notification with explicit type casts
    PERFORM public.create_notification(
        NEW.id::uuid,
        'welcome'::text,
        'Welcome to Lumiere Portal!'::text,
        'Your account has been set up. Start by exploring the dashboard.'::text,
        NULL::text,
        NULL::uuid,
        'normal'::text,
        '{}'::jsonb
    );
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Don't fail profile creation if notification fails
        RAISE WARNING 'Welcome notification failed: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FIX APPLICATION CASCADE SOFT-DELETE
-- Migration: 060_fix_application_cascade_soft_delete
-- ============================================
-- Fixes two issues:
-- 1. Documents should NOT be cascade-deleted when an application is deleted
-- 2. Cascade failures (e.g. on bills/invoices) should not silently
--    roll back the entire application delete
-- ============================================

CREATE OR REPLACE FUNCTION cascade_application_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
        -- Soft-delete related invoices (best-effort)
        BEGIN
            UPDATE invoices
            SET is_deleted = true,
                deleted_at = now(),
                deleted_by = NEW.deleted_by
            WHERE application_id = NEW.id
              AND is_deleted = false;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'cascade_application_soft_delete: failed to cascade to invoices for application %: %', NEW.id, SQLERRM;
        END;

        -- Soft-delete related bills (best-effort)
        BEGIN
            UPDATE bills
            SET is_deleted = true,
                deleted_at = now(),
                deleted_by = NEW.deleted_by
            WHERE application_id = NEW.id
              AND is_deleted = false;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'cascade_application_soft_delete: failed to cascade to bills for application %: %', NEW.id, SQLERRM;
        END;

        -- NOTE: Documents are intentionally NOT cascade-deleted.
        -- Deleting an application should preserve its documents.

        -- Log the cascade action (best-effort)
        BEGIN
            INSERT INTO record_activity (table_name, record_id, action, summary, user_id)
            VALUES (
                'applications',
                NEW.id,
                'cascade_soft_delete',
                'Cascaded soft-delete to related invoices and bills (documents preserved)',
                NEW.deleted_by
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'cascade_application_soft_delete: failed to log activity for application %: %', NEW.id, SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger itself doesn't need to be recreated since we only replaced
-- the function body. But let's ensure it exists:
DROP TRIGGER IF EXISTS tr_cascade_application_soft_delete ON applications;
CREATE TRIGGER tr_cascade_application_soft_delete
    AFTER UPDATE OF is_deleted ON applications
    FOR EACH ROW
    WHEN (NEW.is_deleted = true AND OLD.is_deleted = false)
    EXECUTE FUNCTION cascade_application_soft_delete();

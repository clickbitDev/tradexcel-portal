-- ============================================
-- FIX VERSION TRACKING TRIGGER TYPE MISMATCH
-- Migration: 035_fix_version_trigger
-- ============================================
-- This fixes the 'function create_version_snapshot(name, uuid, jsonb, ...)
-- does not exist' error by explicitly casting TG_TABLE_NAME to text.
-- 
-- Affected operations:
--   - Creating RTOs (#1)
--   - Editing RTO status (#2)
--   - Archiving applications (#5)
--   - Creating/editing qualifications (#6)
--   - Creating agents/partners (#7)
-- ============================================

-- Recreate the trigger function with explicit type casts
CREATE OR REPLACE FUNCTION public.track_record_version()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields TEXT[] := '{}';
    old_jsonb JSONB;
    new_jsonb JSONB;
    key TEXT;
    change_type VARCHAR;
    summary TEXT;
BEGIN
    -- Determine change type
    IF TG_OP = 'INSERT' THEN
        change_type := 'create';
        
        -- Create version for new record
        -- FIX: Explicitly cast TG_TABLE_NAME to text
        PERFORM public.create_version_snapshot(
            TG_TABLE_NAME::text,
            NEW.id,
            to_jsonb(NEW),
            '{}',
            change_type
        );
        
        -- Create activity
        PERFORM public.create_activity_entry(
            TG_TABLE_NAME::text,
            NEW.id,
            'created',
            'Record created'
        );
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        old_jsonb := to_jsonb(OLD);
        new_jsonb := to_jsonb(NEW);
        
        -- Find changed fields (excluding timestamps)
        FOR key IN SELECT jsonb_object_keys(old_jsonb)
        LOOP
            IF key NOT IN ('updated_at', 'created_at') AND 
               (old_jsonb->key IS DISTINCT FROM new_jsonb->key) THEN
                changed_fields := array_append(changed_fields, key);
            END IF;
        END LOOP;
        
        -- Skip if no meaningful changes
        IF array_length(changed_fields, 1) IS NULL OR array_length(changed_fields, 1) = 0 THEN
            RETURN NEW;
        END IF;
        
        -- Determine specific change type
        IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
            change_type := 'delete';
            summary := 'Record moved to trash';
        ELSIF NEW.is_deleted = false AND OLD.is_deleted = true THEN
            change_type := 'restore';
            summary := 'Record restored from trash';
        ELSIF NEW.is_archived = true AND OLD.is_archived = false THEN
            change_type := 'archive';
            summary := 'Record archived';
        ELSIF NEW.is_archived = false AND OLD.is_archived = true THEN
            change_type := 'unarchive';
            summary := 'Record unarchived';
        ELSE
            change_type := 'update';
            summary := 'Updated: ' || array_to_string(changed_fields, ', ');
        END IF;
        
        -- Create version snapshot (saves OLD data before change)
        -- FIX: Explicitly cast TG_TABLE_NAME to text
        PERFORM public.create_version_snapshot(
            TG_TABLE_NAME::text,
            NEW.id,
            old_jsonb,
            changed_fields,
            change_type
        );
        
        -- Create activity entry
        -- FIX: Explicitly cast TG_TABLE_NAME to text
        PERFORM public.create_activity_entry(
            TG_TABLE_NAME::text,
            NEW.id,
            change_type,
            summary,
            jsonb_build_object(
                'changed_fields', changed_fields,
                'old_values', (
                    SELECT jsonb_object_agg(f, old_jsonb->f)
                    FROM unnest(changed_fields) AS f
                ),
                'new_values', (
                    SELECT jsonb_object_agg(f, new_jsonb->f)
                    FROM unnest(changed_fields) AS f
                )
            )
        );
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add comment for documentation
COMMENT ON FUNCTION public.track_record_version() IS 
    'Version tracking trigger - fixed in migration 035 to cast TG_TABLE_NAME to text';

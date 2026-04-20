-- ============================================
-- RLS PERFORMANCE & DUPLICATE INDEX FIXES
-- Migration: 031_rls_performance_fix
-- ============================================
-- Fixes Supabase linter warnings:
-- 1. auth_rls_initplan: Wrap auth.<function>() in (select ...) for RLS policies
-- 2. duplicate_index: Remove redundant indexes
-- ============================================

-- ============================================
-- 1. FIX RLS POLICIES ON AUDIT TRAIL PARTITIONS
-- ============================================
-- Replace auth.uid() with (select auth.uid()) to prevent per-row re-evaluation

DO $$
DECLARE
    partition_name text;
BEGIN
    FOR partition_name IN 
        SELECT tablename FROM pg_tables 
        WHERE (tablename LIKE 'audit_trail_20%' OR tablename = 'audit_trail_default' OR tablename = 'audit_trail_legacy')
        AND schemaname = 'public'
    LOOP
        -- Drop existing policies
        EXECUTE format('DROP POLICY IF EXISTS "User can insert own audit" ON %I', partition_name);
        EXECUTE format('DROP POLICY IF EXISTS "Staff can view partition" ON %I', partition_name);
        EXECUTE format('DROP POLICY IF EXISTS "Staff can view audit trail" ON %I', partition_name);
        
        -- Recreate INSERT policy with (select auth.uid()) for InitPlan optimization
        EXECUTE format(
            'CREATE POLICY "User can insert own audit" ON %I FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()) OR user_id IS NULL)',
            partition_name
        );
        
        -- Recreate SELECT policy with (select auth.uid()) for InitPlan optimization
        EXECUTE format(
            'CREATE POLICY "Staff can view partition" ON %I FOR SELECT TO authenticated USING (
                EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role NOT IN (''agent'', ''assessor''))
            )', partition_name
        );
        
        RAISE NOTICE 'Fixed RLS policies on %', partition_name;
    END LOOP;
END $$;

-- ============================================
-- 2. FIX RLS POLICY ON PARENT AUDIT_TRAIL TABLE
-- ============================================
-- The parent table also needs the same fix

DO $$
BEGIN
    -- Drop and recreate the parent table's SELECT policy
    DROP POLICY IF EXISTS "Staff can view partitioned audit" ON audit_trail;
    
    CREATE POLICY "Staff can view partitioned audit" ON audit_trail
        FOR SELECT TO authenticated
        USING (
            EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role NOT IN ('agent', 'assessor'))
        );
    
    RAISE NOTICE 'Fixed RLS policy on parent audit_trail table';
END $$;

-- ============================================
-- 3. REMOVE DUPLICATE INDEXES
-- ============================================
-- Keep the more descriptively named index in each pair

-- applications: idx_applications_lead_source_id vs idx_applications_source (both on lead_source_id)
-- Keep: idx_applications_lead_source_id (more descriptive)
DROP INDEX IF EXISTS idx_applications_source;

-- applications: idx_applications_stage vs idx_applications_workflow_stage (both on workflow_stage)
-- Keep: idx_applications_workflow_stage (more descriptive)
DROP INDEX IF EXISTS idx_applications_stage;

-- assessor_qualifications: idx_assessor_qualifications_assessor vs idx_assessor_qualifications_assessor_id
-- Keep: idx_assessor_qualifications_assessor_id (more descriptive)
DROP INDEX IF EXISTS idx_assessor_qualifications_assessor;

-- notification_queue: idx_notification_queue_scheduled vs idx_notification_queue_scheduled_at
-- Keep: idx_notification_queue_scheduled_at (more descriptive)
DROP INDEX IF EXISTS idx_notification_queue_scheduled;

-- partner_commission_rules: idx_partner_commission_rules_partner vs idx_partner_commission_rules_partner_id
-- Keep: idx_partner_commission_rules_partner_id (more descriptive)
DROP INDEX IF EXISTS idx_partner_commission_rules_partner;

-- ============================================
-- 4. VERIFY FIXES
-- ============================================
-- Uncomment to verify:
-- SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE tablename LIKE 'audit_trail%';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'applications' AND indexname LIKE '%source%' OR indexname LIKE '%stage%';

-- ============================================
-- PHASE 2: TRIGGERS & AUTOMATION
-- Migration: 028_phase2_triggers
-- ============================================
-- Comprehensive trigger package for:
-- 1. Enhanced workflow validation with role checks
-- 2. Application lock management functions
-- 3. Payment status synchronization
-- 4. Document extraction automation
-- ============================================

-- ============================================
-- 1. ENHANCED WORKFLOW VALIDATION TRIGGER
-- ============================================

-- Drop existing simple trigger
DROP TRIGGER IF EXISTS tr_validate_workflow_transition ON applications;

-- Create enhanced validation function with role checks
CREATE OR REPLACE FUNCTION validate_application_workflow_transition()
RETURNS TRIGGER AS $$
DECLARE
  transition_allowed boolean;
  v_required_role text;
  v_current_role text;
  v_requires_approval boolean;
BEGIN
  -- Only validate if workflow_stage is changing
  IF NEW.workflow_stage IS NOT DISTINCT FROM OLD.workflow_stage THEN
    RETURN NEW;
  END IF;
  
  -- Allow transition from NULL (new records)
  IF OLD.workflow_stage IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if transition is defined and allowed
  SELECT is_allowed, requires_approval, required_role 
  INTO transition_allowed, v_requires_approval, v_required_role
  FROM workflow_transitions
  WHERE from_stage = OLD.workflow_stage::text
    AND to_stage = NEW.workflow_stage::text;
  
  -- If transition not found, log warning but allow (soft enforcement)
  IF transition_allowed IS NULL THEN
    RAISE WARNING 'Workflow transition not defined: % → % for application %',
      OLD.workflow_stage, NEW.workflow_stage, NEW.id;
    
    -- Log to audit
    INSERT INTO record_activity (table_name, record_id, action, summary, user_id)
    VALUES (
      'applications', NEW.id, 'undefined_transition',
      format('Undefined workflow transition: %s → %s', OLD.workflow_stage, NEW.workflow_stage),
      COALESCE(NEW.last_updated_by, auth.uid())
    );
    
    RETURN NEW;
  END IF;
  
  -- If transition explicitly disabled, reject
  IF NOT transition_allowed THEN
    RAISE EXCEPTION 'Workflow transition disabled: % → %',
      OLD.workflow_stage, NEW.workflow_stage;
  END IF;
  
  -- If transition requires specific role, check
  IF v_required_role IS NOT NULL THEN
    SELECT role::text INTO v_current_role 
    FROM profiles 
    WHERE id = COALESCE(NEW.last_updated_by, auth.uid());
    
    -- Allow CEO and executive roles to bypass role restrictions
    IF v_current_role NOT IN ('ceo', 'executive_manager', v_required_role) THEN
      RAISE EXCEPTION 'Insufficient permissions: transition % → % requires % role',
        OLD.workflow_stage, NEW.workflow_stage, v_required_role;
    END IF;
  END IF;

  -- Log successful transition to history
  INSERT INTO application_history (
    application_id, from_stage, to_stage, changed_by, created_at
  ) VALUES (
    NEW.id, OLD.workflow_stage::text, NEW.workflow_stage::text,
    COALESCE(NEW.last_updated_by, auth.uid()), NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER tr_validate_workflow_transition
  BEFORE UPDATE OF workflow_stage ON applications
  FOR EACH ROW
  EXECUTE FUNCTION validate_application_workflow_transition();

-- ============================================
-- 2. APPLICATION LOCK MANAGEMENT FUNCTIONS
-- ============================================

-- Enhanced lock acquisition with timeout
CREATE OR REPLACE FUNCTION lock_application(
  p_application_id uuid,
  p_user_id uuid,
  p_lock_timeout interval DEFAULT '1 hour'::interval
)
RETURNS boolean AS $$
DECLARE
  v_locked boolean;
BEGIN
  -- Try to acquire lock (only if unlocked or expired)
  UPDATE applications
  SET 
    locked_by = p_user_id,
    lock_timestamp = NOW(),
    lock_timeout = p_lock_timeout
  WHERE id = p_application_id
    AND is_deleted = false
    AND (
      locked_by IS NULL 
      OR locked_by = p_user_id  -- Same user can refresh lock
      OR (lock_timestamp + COALESCE(lock_timeout, '1 hour'::interval)) < NOW()  -- Expired
    );
  
  v_locked := FOUND;
  
  IF v_locked THEN
    -- Log lock acquisition
    INSERT INTO record_activity (table_name, record_id, action, summary, user_id)
    VALUES ('applications', p_application_id, 'lock_acquired', 
      format('Application locked for %s', p_lock_timeout), p_user_id);
  END IF;
  
  RETURN v_locked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unlock function
CREATE OR REPLACE FUNCTION unlock_application(
  p_application_id uuid,
  p_user_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_unlocked boolean;
BEGIN
  -- Only allow unlock if user holds the lock or is admin
  UPDATE applications
  SET locked_by = NULL, lock_timestamp = NULL
  WHERE id = p_application_id
    AND (
      locked_by = p_user_id 
      OR EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND role IN ('ceo', 'admin', 'executive_manager'))
    );
  
  v_unlocked := FOUND;
  
  IF v_unlocked THEN
    INSERT INTO record_activity (table_name, record_id, action, summary, user_id)
    VALUES ('applications', p_application_id, 'lock_released', 'Application unlocked', p_user_id);
  END IF;
  
  RETURN v_unlocked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Batch unlock expired locks
CREATE OR REPLACE FUNCTION unlock_expired_application_locks()
RETURNS TABLE(unlocked_count bigint, checked_count bigint) AS $$
DECLARE
  v_checked_rows bigint;
  v_unlocked_rows bigint;
BEGIN
  -- Count applications currently locked
  SELECT COUNT(*) INTO v_checked_rows
  FROM applications
  WHERE locked_by IS NOT NULL 
    AND lock_timestamp IS NOT NULL
    AND is_deleted = false;

  -- Unlock expired
  WITH updated AS (
    UPDATE applications
    SET locked_by = NULL, lock_timestamp = NULL
    WHERE locked_by IS NOT NULL 
      AND lock_timestamp IS NOT NULL
      AND (lock_timestamp + COALESCE(lock_timeout, '1 hour'::interval)) < NOW()
      AND is_deleted = false
    RETURNING id
  )
  SELECT COUNT(*) INTO v_unlocked_rows FROM updated;

  RETURN QUERY SELECT v_unlocked_rows, v_checked_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Lock status view
CREATE OR REPLACE VIEW application_lock_status AS
SELECT 
  a.id,
  a.student_uid,
  a.workflow_stage,
  a.locked_by,
  p.full_name as locked_by_name,
  a.lock_timestamp,
  a.lock_timeout,
  NOW() - a.lock_timestamp as lock_duration,
  (a.lock_timestamp + COALESCE(a.lock_timeout, '1 hour'::interval)) as lock_expires_at,
  CASE 
    WHEN a.locked_by IS NULL THEN 'unlocked'
    WHEN (a.lock_timestamp + COALESCE(a.lock_timeout, '1 hour'::interval)) < NOW() THEN 'expired'
    ELSE 'active'
  END as lock_status
FROM applications a
LEFT JOIN profiles p ON a.locked_by = p.id
WHERE a.is_deleted = false;

-- ============================================
-- 3. PAYMENT STATUS SYNCHRONIZATION
-- ============================================

-- Automatic payment status update based on amounts
CREATE OR REPLACE FUNCTION update_application_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  total_quoted numeric;
  new_status payment_status;
BEGIN
  -- Calculate total quoted amount
  total_quoted := COALESCE(NEW.quoted_tuition, 0) + COALESCE(NEW.quoted_materials, 0);
  
  -- Determine new payment status
  IF COALESCE(NEW.total_paid, 0) = 0 THEN
    new_status := 'unpaid'::payment_status;
  ELSIF NEW.total_paid < total_quoted THEN
    new_status := 'partial'::payment_status;
  ELSE
    new_status := 'paid'::payment_status;
  END IF;
  
  -- Update status if changed
  IF new_status IS DISTINCT FROM NEW.payment_status THEN
    NEW.payment_status := new_status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_applications_payment_status_sync ON applications;

CREATE TRIGGER tr_applications_payment_status_sync
  BEFORE INSERT OR UPDATE OF total_paid, quoted_tuition, quoted_materials ON applications
  FOR EACH ROW
  EXECUTE FUNCTION update_application_payment_status();

-- Invoice payment sync to application
CREATE OR REPLACE FUNCTION sync_invoice_payment_to_application()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if application_id exists
  IF NEW.application_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- If invoice status changed to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    UPDATE applications
    SET total_paid = COALESCE(total_paid, 0) + COALESCE(NEW.total_amount, 0)
    WHERE id = NEW.application_id;
  
  -- If invoice status changed FROM 'paid' to something else
  ELSIF OLD.status = 'paid' AND NEW.status != 'paid' THEN
    UPDATE applications
    SET total_paid = GREATEST(0, COALESCE(total_paid, 0) - COALESCE(OLD.total_amount, 0))
    WHERE id = NEW.application_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_invoices_payment_sync ON invoices;

CREATE TRIGGER tr_invoices_payment_sync
  AFTER UPDATE OF status ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_payment_to_application();

-- ============================================
-- 4. DOCUMENT EXTRACTION AUTOMATION
-- ============================================

-- Initialize extraction status on document upload
CREATE OR REPLACE FUNCTION initialize_document_extraction()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-set extraction status based on document type
  IF NEW.document_type IN ('passport', 'visa', 'drivers_license', 'qualification', 'id', 'resume', 'academic_transcript') THEN
    NEW.extraction_status := COALESCE(NEW.extraction_status, 'pending');
  ELSE
    NEW.extraction_status := COALESCE(NEW.extraction_status, 'skipped');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_documents_initialize_extraction ON documents;

CREATE TRIGGER tr_documents_initialize_extraction
  BEFORE INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION initialize_document_extraction();

-- Stalled extraction monitoring view
CREATE OR REPLACE VIEW stalled_document_extractions AS
SELECT 
  id,
  application_id,
  document_type,
  file_name,
  extraction_status,
  extracted_at,
  NOW() - extracted_at as processing_duration
FROM documents
WHERE extraction_status = 'processing'
  AND extracted_at IS NOT NULL
  AND (NOW() - extracted_at) > interval '1 hour'
  AND is_deleted = false;

-- Extraction failure summary view
CREATE OR REPLACE VIEW document_extraction_failures AS
SELECT 
  application_id,
  document_type,
  COUNT(*) as failure_count,
  MAX(extracted_at) as last_failure
FROM documents
WHERE extraction_status = 'failed'
  AND is_deleted = false
GROUP BY application_id, document_type
HAVING COUNT(*) >= 1;

-- ============================================
-- 5. CRON JOB FOR LOCK CLEANUP (if pg_cron available)
-- ============================================

-- Check if pg_cron is available and schedule job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule if exists
    PERFORM cron.unschedule('unlock-expired-application-locks');
    
    -- Schedule every 5 minutes
    PERFORM cron.schedule(
      'unlock-expired-application-locks',
      '*/5 * * * *',
      'SELECT unlock_expired_application_locks();'
    );
    RAISE NOTICE 'Scheduled lock cleanup cron job';
  ELSE
    RAISE NOTICE 'pg_cron not available - manual lock cleanup required';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule cron job: %', SQLERRM;
END $$;

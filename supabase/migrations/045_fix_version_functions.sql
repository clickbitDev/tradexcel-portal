-- Repair migration for environments missing version-control helper functions.
-- These functions are used by versioning triggers on invoices and other entities.

CREATE OR REPLACE FUNCTION public.get_next_version_number(p_table_name VARCHAR, p_record_id UUID)
RETURNS INTEGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO next_version
  FROM public.record_versions
  WHERE table_name = p_table_name AND record_id = p_record_id;

  RETURN next_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.create_version_snapshot(
  p_table_name VARCHAR,
  p_record_id UUID,
  p_data JSONB,
  p_changed_fields TEXT[],
  p_change_type VARCHAR,
  p_changed_by UUID DEFAULT NULL,
  p_change_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  version_id UUID;
  next_version INTEGER;
BEGIN
  next_version := public.get_next_version_number(p_table_name, p_record_id);

  INSERT INTO public.record_versions (
    table_name,
    record_id,
    version_number,
    data,
    changed_fields,
    change_type,
    changed_by,
    change_reason
  ) VALUES (
    p_table_name,
    p_record_id,
    next_version,
    p_data,
    p_changed_fields,
    p_change_type,
    COALESCE(p_changed_by, auth.uid()),
    p_change_reason
  )
  RETURNING id INTO version_id;

  RETURN version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.create_activity_entry(
  p_table_name VARCHAR,
  p_record_id UUID,
  p_action VARCHAR,
  p_summary TEXT,
  p_details JSONB DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  activity_id UUID;
  v_user_name TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  SELECT full_name INTO v_user_name
  FROM public.profiles
  WHERE id = v_user_id;

  INSERT INTO public.record_activity (
    table_name,
    record_id,
    action,
    summary,
    details,
    user_id,
    user_name
  ) VALUES (
    p_table_name,
    p_record_id,
    p_action,
    p_summary,
    p_details,
    v_user_id,
    v_user_name
  )
  RETURNING id INTO activity_id;

  RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

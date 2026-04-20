BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rto_offerings'
      AND column_name = 'tuition_fee_offshore'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rto_offerings'
      AND column_name = 'tuition_fee_miscellaneous'
  ) THEN
    EXECUTE 'ALTER TABLE public.rto_offerings RENAME COLUMN tuition_fee_offshore TO tuition_fee_miscellaneous';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'price_versions'
      AND column_name = 'tuition_fee_offshore'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'price_versions'
      AND column_name = 'tuition_fee_miscellaneous'
  ) THEN
    EXECUTE 'ALTER TABLE public.price_versions RENAME COLUMN tuition_fee_offshore TO tuition_fee_miscellaneous';
  END IF;
END
$$;

COMMIT;

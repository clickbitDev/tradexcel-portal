BEGIN;

ALTER TABLE public.rto_offerings
  ALTER COLUMN rto_id DROP NOT NULL;

DROP INDEX IF EXISTS public.rto_offerings_rto_id_qualification_id_key;

ALTER TABLE public.price_versions
  ADD COLUMN IF NOT EXISTS assessor_fee numeric,
  ADD COLUMN IF NOT EXISTS provider_fee numeric,
  ADD COLUMN IF NOT EXISTS agent_fee numeric,
  ADD COLUMN IF NOT EXISTS student_fee numeric,
  ADD COLUMN IF NOT EXISTS enrollment_fee numeric,
  ADD COLUMN IF NOT EXISTS misc_fee numeric;

INSERT INTO public.rto_offerings (
  qualification_id,
  rto_id,
  is_active,
  effective_date,
  approval_status,
  version,
  is_archived,
  is_deleted
)
SELECT
  q.id,
  NULL,
  TRUE,
  CURRENT_DATE,
  'published',
  1,
  FALSE,
  FALSE
FROM public.qualifications q
WHERE NOT EXISTS (
  SELECT 1
  FROM public.rto_offerings ro
  WHERE ro.qualification_id = q.id
    AND COALESCE(ro.is_deleted, FALSE) = FALSE
);

WITH ranked AS (
  SELECT
    ro.id,
    ro.qualification_id,
    ROW_NUMBER() OVER (
      PARTITION BY ro.qualification_id
      ORDER BY
        (
          SELECT COUNT(*)
          FROM public.applications a
          WHERE a.offering_id = ro.id
            AND COALESCE(a.is_deleted, FALSE) = FALSE
        ) DESC,
        COALESCE(ro.is_active, FALSE) DESC,
        ro.updated_at DESC NULLS LAST,
        ro.created_at DESC NULLS LAST,
        ro.id DESC
    ) AS row_rank
  FROM public.rto_offerings ro
  WHERE COALESCE(ro.is_deleted, FALSE) = FALSE
),
canonical AS (
  SELECT qualification_id, id
  FROM ranked
  WHERE row_rank = 1
),
repointed AS (
  UPDATE public.applications a
  SET offering_id = c.id,
      updated_at = NOW()
  FROM canonical c,
       public.rto_offerings ro
  WHERE ro.qualification_id = c.qualification_id
    AND ro.id = a.offering_id
    AND a.offering_id IS DISTINCT FROM c.id
    AND COALESCE(a.is_deleted, FALSE) = FALSE
  RETURNING a.id
)
UPDATE public.rto_offerings ro
SET rto_id = NULL,
    is_active = CASE WHEN ro.id = c.id THEN TRUE ELSE FALSE END,
    is_archived = CASE WHEN ro.id = c.id THEN FALSE ELSE TRUE END,
    archived_at = CASE WHEN ro.id = c.id THEN NULL ELSE COALESCE(ro.archived_at, NOW()) END,
    archived_by = CASE WHEN ro.id = c.id THEN NULL ELSE ro.archived_by END,
    effective_date = COALESCE(ro.effective_date, CURRENT_DATE),
    approval_status = COALESCE(ro.approval_status, 'published'),
    version = COALESCE(ro.version, 1)
FROM canonical c
WHERE ro.qualification_id = c.qualification_id;

DROP INDEX IF EXISTS public.idx_rto_offerings_active_qualification;
CREATE UNIQUE INDEX idx_rto_offerings_active_qualification
  ON public.rto_offerings (qualification_id)
  WHERE COALESCE(is_deleted, FALSE) = FALSE AND COALESCE(is_active, FALSE) = TRUE;

COMMIT;

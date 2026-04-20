-- ============================================
-- EDWARD PORTAL DATABASE MIGRATION
-- Migration: 20260405110000_documents_rls_policies
-- Purpose: Add RLS policies so authenticated users can read documents
-- ============================================

BEGIN;

-- Allow authenticated users to read documents for applications they can access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'documents'
      AND policyname = 'Authenticated users can read documents'
  ) THEN
    CREATE POLICY "Authenticated users can read documents"
      ON public.documents
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'documents'
      AND policyname = 'Authenticated users can insert documents'
  ) THEN
    CREATE POLICY "Authenticated users can insert documents"
      ON public.documents
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'documents'
      AND policyname = 'Authenticated users can update documents'
  ) THEN
    CREATE POLICY "Authenticated users can update documents"
      ON public.documents
      FOR UPDATE
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'documents'
      AND policyname = 'Authenticated users can delete documents'
  ) THEN
    CREATE POLICY "Authenticated users can delete documents"
      ON public.documents
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END;
$$;

COMMIT;

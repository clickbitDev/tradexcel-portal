# Manual SQL ownership

Keep these database features outside Prisma Migrate and manage them with SQL migrations:

- views:
  - `public.recent_activity`
  - `public.entity_history`
  - `public.application_lock_status`
  - `public.stalled_document_extractions`
  - `public.document_extraction_failures`
  - `public.valid_workflow_transitions`
  - `public.trash_bin`
  - `public.applications_denormalized`
- materialized views:
  - `public.qualification_rto_usage`
- partitioned audit objects:
  - `public.audit_trail`
  - `public.audit_trail_2025_*`
  - `public.audit_trail_2026_*`
  - `public.audit_trail_default`
- Supabase auth objects:
  - `auth.users`
- Postgres-only behavior:
  - RLS policies
  - `SECURITY DEFINER` and `SECURITY INVOKER` functions
  - triggers and sequences
  - check constraints
  - partial indexes
  - expression and GIN indexes
  - extensions and publications

Execution phases used in this repo:

1. `01_functions_and_sequences.sql`
2. `02_triggers_and_seeds.sql`
3. `03_rls.sql`
4. `04_views.sql`
5. `05_indexes.sql`
6. `06_optional_audit_partitioning.sql` (manual opt-in only)

When a schema change needs both Prisma and SQL-managed objects:

1. change `prisma/schema.prisma`
2. create the Prisma migration
3. add a companion SQL migration for the unsupported objects
4. deploy both in the same release

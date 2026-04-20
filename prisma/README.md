# Prisma onboarding

This project now carries a Prisma schema in `prisma/schema.prisma` derived from the authoritative Supabase SQL migration history.

## Ownership split

Prisma owns:

- `public` tables and enums represented in `prisma/schema.prisma`
- future Prisma-manageable DDL changes for those models

Raw SQL remains authoritative for:

- RLS policies
- triggers and trigger functions
- views and materialized views
- partitioned audit tables
- partial, expression, and GIN indexes
- extensions, publications, and other Postgres-specific objects

See `prisma/manual/README.md` for the excluded object list.

## Safe onboarding for an existing database

1. Validate the datamodel:

   `npm run prisma:validate`

2. On a reachable staging or production clone, compare Prisma's model to the live database without writing changes:

   `npm run prisma:db:pull -- --print`

3. Regenerate the baseline SQL from the Prisma datamodel when you are ready to freeze onboarding:

   `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0000_baseline/migration.sql`

4. For existing environments, mark that baseline as already applied instead of executing it:

   `npm run prisma:migrate:resolve:baseline`

5. Only after the baseline is resolved should new Prisma migrations be created:

   `npm run prisma:migrate:dev -- --name <change_name>`

## Manual SQL replay after baseline

After the Prisma baseline is in place, replay unsupported Supabase/Postgres objects with Prisma CLI:

1. `npx prisma db execute --file prisma/manual/01_functions_and_sequences.sql`
2. `npx prisma db execute --file prisma/manual/02_triggers_and_seeds.sql`
3. `npx prisma db execute --file prisma/manual/03_rls.sql`
4. `npx prisma db execute --file prisma/manual/04_views.sql`
5. `npx prisma db execute --file prisma/manual/05_indexes.sql`

`prisma/manual/06_optional_audit_partitioning.sql` is intentionally not applied by default.

## Important safety rule

Do not run `prisma migrate reset`, `prisma db push`, or any generated baseline SQL against an existing Supabase production database.

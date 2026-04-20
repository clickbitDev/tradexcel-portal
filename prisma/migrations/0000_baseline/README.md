# Baseline migration

This folder is intentionally a safe placeholder for onboarding an existing production database.

- Existing databases: mark `0000_baseline` as applied with `prisma migrate resolve --applied 0000_baseline`
- New databases: do not rely on this placeholder until `migration.sql` has been regenerated and verified from `prisma/schema.prisma`
- The placeholder avoids accidental schema recreation or drift during the Supabase-to-Prisma handoff

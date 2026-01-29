# SQL Scripts

This folder contains SQL scripts for database migrations and maintenance tasks.

Since this project uses Supabase as a hosted PostgreSQL database (not Prisma migrations),
these scripts document database changes and can be executed manually or via `prisma db execute`.

## Running a migration

```bash
cd backend
pnpm prisma db execute --file sql/script_name.sql
```

## Scripts

- `migrate_existing_lot_assignments.sql` - Migrates existing lot.assignedSubcontractorId to the new LotSubcontractorAssignment table (2026-01-29)

# SQL Scripts

This folder contains SQL scripts for legacy data fixes and maintenance tasks.

Schema changes are managed through Prisma migrations. Use these scripts only for targeted data
backfills or operational maintenance that is not part of the Prisma schema.

## Running a migration

```bash
cd backend
npx prisma db execute --file sql/script_name.sql
```

## Scripts

- `migrate_existing_lot_assignments.sql` - Migrates existing lot.assignedSubcontractorId to the new LotSubcontractorAssignment table (2026-01-29)

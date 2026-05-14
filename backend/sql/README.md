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

No active SQL scripts are currently maintained in this folder.

## Archived Scripts

- `archive/2026-05-repo-hygiene/migrate_existing_lot_assignments.sql` - Historical one-off helper for migrating `lot.assignedSubcontractorId` into `LotSubcontractorAssignment` (2026-01-29).

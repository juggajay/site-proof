# SQL Archive - 2026-05 Repo Hygiene

Archived 2026-05-14 as part of Batch 3a repo hygiene. These SQL files are preserved for historical/operator reference only.

## Index

| File | Subject |
|------|---------|
| `migrate_existing_lot_assignments.sql` | One-off helper that migrated `lot.assignedSubcontractorId` data into `LotSubcontractorAssignment` |

## Operational Status

This folder is not an active migration path. Schema changes remain managed through Prisma migrations, and operational SQL should only run from a fresh reviewed plan.

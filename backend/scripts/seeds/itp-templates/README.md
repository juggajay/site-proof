# ITP Template Seeders

This folder contains global ITP template seeders for Australian civil construction specifications. The seeders create `ITPTemplate` rows with `projectId = null`, so projects can include global templates by matching `Project.specificationSet` to `ITPTemplate.stateSpec`.

## Included Sets

| State | Source | Files |
|-------|--------|-------|
| Austroads | National baseline and Australian Standards | 1 |
| NSW | TfNSW / RMS specifications | 5 |
| QLD | TMR MRTS specifications | 7 |
| SA | DIT specifications | 7 |
| VIC | VicRoads specifications | 7 |

## Usage

List all seeders without opening a database connection:

```bash
cd backend
pnpm seed:itp -- --list
```

Preview a filtered run:

```bash
cd backend
pnpm seed:itp -- --state=qld --activity=structures
```

Execute a filtered run:

```bash
cd backend
pnpm seed:itp -- --state=qld --activity=structures --execute
```

Execute all seeders:

```bash
cd backend
pnpm seed:itp -- --execute
```

The orchestrator loads `backend/.env` only in `--execute` mode. Dry-run and `--list` mode do not load env, import Prisma, or open a database connection.

## Safety

The child seeders are idempotent: each one checks for an existing global template by name, state spec, and `projectId = null` before inserting.

Do not run these against production as a casual setup step. A production run should still have an operator-approved plan and a recent backup, even though the scripts are additive and idempotent.

# Stage 142 - Operations Restore Closeout

Date: 2026-07-01
Branch: `qa/stage142-ops-restore-drift`
Baseline: `5492d3a3e8b776df29c7cf73848ebc37dd02d778`

## Scope

This stage followed up the release-candidate operations gap found after Stage
141: the `Database Restore Drill` workflow restored a backup successfully, but
failed the final Prisma migration-status check.

This was an operations-readiness check, not a normal user-workflow browser bug.
Supabase storage was being restored separately during this stage, so document,
photo, evidence, and signed-link browser checks remain a separate storage smoke
after Supabase is healthy.

## Failed Evidence That Started This Stage

- Workflow: `Database Restore Drill`
- Run: `28510364604`
- Result: failure
- Ref: `master`
- Head SHA: `5492d3a3e8b776df29c7cf73848ebc37dd02d778`

The failed run proved the encrypted backup artifact could be downloaded,
decrypted, verified, and restored into disposable PostgreSQL. The failure was
only at `npm run migrate:status`.

The drift output showed additions such as:

- `scheduled_report_runs`
- `scheduled_report_recipient_deliveries`
- `notification_digest_items.source_key`
- subcontractor counter-rate columns
- `subcontractor_companies.invitation_token_hash`
- late June account-export indexes

## Root Cause

Production had not yet applied the late June Prisma migrations that were already
merged into `master`.

Evidence:

- Last successful `Production Migrations` run before this stage:
  - Run: `28338678862`
  - Head SHA: `a2dd818b4e6cbc20856fb464270163d9eb6a47fb`
  - Created: 2026-06-28T22:50:05Z
- Later merged migrations were present in `backend/prisma/migrations`, including:
  - `20260629123000_add_subcontractor_invitation_token`
  - `20260629150000_add_subcontractor_counter_rates`
  - `20260629163000_add_digest_retry_state`
  - `20260629172000_add_scheduled_report_delivery_runs`
  - `20260630090000_add_scheduled_report_artifacts`
  - `20260630110000_add_account_export_user_indexes`

The Prisma diff direction in `backend/scripts/migrate.ts` compares the live
database schema to the current `prisma/schema.prisma`. The `[+] Added` drift
items therefore meant the restored database was missing current schema objects,
not that production had unknown extra objects.

## Remediation Performed

Ran the existing protected production migration workflow from `master`.

- Workflow: `Production Migrations`
- Run: `28510733412`
- Head SHA: `5492d3a3e8b776df29c7cf73848ebc37dd02d778`
- Result: success
- Important steps passed:
  - Validate migration dispatch
  - Check production database secret
  - Install dependencies
  - Audit dependencies
  - Generate Prisma client
  - Check unique-index migration preconditions
  - Deploy migrations
  - Verify migration status

Then created a fresh backup from the migrated production database.

- Workflow: `Database Backup`
- Run: `28510792666`
- Head SHA: `5492d3a3e8b776df29c7cf73848ebc37dd02d778`
- Result: success
- Important steps passed:
  - Validate backup secret
  - Create and verify backup
  - Encrypt backup artifact
  - Upload verified backup artifact

Then restored that fresh backup into disposable PostgreSQL.

- Workflow: `Database Restore Drill`
- Run: `28510849495`
- Backup run id: `28510792666`
- Head SHA: `5492d3a3e8b776df29c7cf73848ebc37dd02d778`
- Result: success
- Important steps passed:
  - Download encrypted backup artifact
  - Decrypt backup artifact
  - Verify backup readability
  - Restore into disposable database
  - Verify restored migration status

Post-check production probes:

- `https://site-proof-production.up.railway.app/ready`: HTTP 200,
  `{"status":"ready"}`
- `https://site-proof.vercel.app/`: HTTP 200

## Current Status

The PostgreSQL backup/restore launch gate is green as of this stage.

The previous restore-drill failure was not caused by Supabase. Supabase storage
can still affect user workflows that upload or open documents, photos, drawings,
NCR evidence, hold-point evidence, report artifacts, and signed file links. Run a
fresh storage/evidence browser smoke after the Supabase project is restored.

## Next Recommended Stage

Stage 143 should be a Supabase-backed storage and evidence smoke:

1. Backend `/ready`.
2. Upload a normal project document.
3. Upload a lot/ITP/evidence photo or document.
4. Open/download through the backend-mediated access route.
5. Verify hold-point or NCR evidence links resolve through the app.
6. Confirm report artifacts, if available, can be opened.

# Storage Backup And Restore Runbook

Last updated: 2026-07-24

## Objective

Protect the Supabase Storage `documents` bucket — the only copy of every
uploaded photo, test certificate, drawing, logo, and document in production —
from accidental deletion, provider incidents, and bad application writes. Until
this workflow shipped, the bucket was backed up by nothing.

Target baseline:

- RPO: 24 hours while the scheduled GitHub Actions backup is the primary backup.
- RTO: 4 hours for a practiced restore into a replacement bucket.
- Retention: 30 days of encrypted, verified snapshot artifacts in GitHub Actions.

The bucket is private and is accessed only with the service-role key. The backup
is an independently downloadable, encrypted snapshot; treat any Supabase-side
retention as an additional control, not a replacement, until a restore drill
proves it.

## Automated Backup

Workflow: `.github/workflows/storage-backup.yml`

Schedule: daily at `15:37 UTC` (`01:37 Australia/Sydney` during standard time),
offset one hour after the database backup so the two jobs never contend.

The workflow:

1. Reads the storage backup secrets (below).
2. Runs `backend/scripts/storage-backup.ts create --dry-run` to log the object
   count and total bytes before downloading anything.
3. Runs `backend/scripts/storage-backup.ts create`, which lists every object in
   the bucket (paginated, recursive), downloads each one preserving its path,
   and writes a `manifest.json` recording `path`, `size`, and a SHA-256
   `checksum` per object. It logs `listed / downloaded / archived` counts and
   **fails the job on any mismatch** — a partial snapshot that looks complete is
   worse than none.
4. Tars the `manifest.json` + `objects/` tree.
5. Encrypts the tar with `gpg --symmetric --cipher-algo AES256`.
6. Computes a SHA-256 of the encrypted `.tar.gpg`.
7. **Verifies** by decrypting the `.tar.gpg` into an independent temp directory,
   extracting it, and running `storage-backup.ts verify`, which re-checks every
   object path + size against the manifest and re-hashes a deterministic sample
   of objects. The job fails if anything drifts.
8. Uploads only the encrypted `.tar.gpg` and its `.sha256` as a GitHub Actions
   artifact, kept for 30 days.

Required GitHub repository secrets:

- `STORAGE_BACKUP_SUPABASE_URL` — the Supabase project URL
  (`https://vhlvutvzdliwxorfhxxv.supabase.co`).
- `STORAGE_BACKUP_SUPABASE_SERVICE_ROLE_KEY` — the service-role key. The backup
  is read-only against storage, but the service-role key is still a full-access
  secret; keep it out of logs and tickets.
- `STORAGE_BACKUP_ENCRYPTION_KEY` — the symmetric passphrase for the archive.
  Store this outside GitHub as well (company password manager), because it is
  required for restores.

The script also accepts the plain `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
names as a fallback for local runs; the workflow uses the `STORAGE_BACKUP_*`
names so it can point at a dedicated backup project/key without touching the app
runtime secrets.

Do not commit any of these values. Do not paste them in tickets, audit notes,
chat, or logs.

## Size ceiling — read before relying on the artifact

A GitHub Actions artifact / runner has finite disk (~14 GB usable) and the tar +
gpg round-trip needs roughly 2–3× the raw bucket size in scratch space. The
`create --dry-run` step logs the observed object count and total bytes on every
run, and the script prints a `::warning::` when the bucket exceeds
`STORAGE_BACKUP_SIZE_WARN_BYTES` (default 5 GiB).

If the first run's dry-run report shows the bucket is comfortably under a few GB,
this single-artifact design holds. If it approaches or exceeds the runner disk,
**stop relying on the full-download path** and move to an incremental / chunked
or object-store-to-object-store copy instead. The workflow will still attempt
the full path and fail loudly on a listed-vs-archived mismatch rather than
silently truncating.

## Daily Check

Every business day:

1. Open GitHub Actions.
2. Check the latest `Storage Backup` run.
3. Confirm the run passed and the `verify` step is green.
4. Confirm the artifact exists and contains one `.tar.gpg` and one
   `.tar.gpg.sha256`.

If the latest scheduled run failed, treat it as a launch-blocking production
incident until a fresh backup has passed.

## Restore Drill

Run this before paying customers and then at least monthly.

Prerequisites:

- Node 20+ and the repo checked out (`cd backend && npm ci`).
- `gpg` and `tar` available locally.
- The `STORAGE_BACKUP_ENCRYPTION_KEY` value from the password manager.
- A downloaded backup artifact containing one `.tar.gpg` and one
  `.tar.gpg.sha256`.

Steps:

1. Download the latest `siteproof-storage-backup-*` artifact and extract it into
   a local folder.

2. Verify the encrypted artifact checksum:

   ```powershell
   Get-FileHash .\siteproof-storage-YYYY-MM-DDTHH-MM-SSZ.tar.gpg -Algorithm SHA256
   Get-Content .\siteproof-storage-YYYY-MM-DDTHH-MM-SSZ.tar.gpg.sha256
   ```

3. Decrypt and extract:

   ```powershell
   gpg --batch --yes --pinentry-mode loopback `
     --passphrase "<storage-backup-encryption-key>" `
     --decrypt --output snapshot.tar `
     .\siteproof-storage-YYYY-MM-DDTHH-MM-SSZ.tar.gpg

   mkdir snapshot
   tar -C snapshot -xf snapshot.tar
   ```

   `snapshot/` now holds `manifest.json` and an `objects/` tree that mirrors the
   bucket layout.

4. Verify the snapshot against its manifest (count + size + sampled checksums):

   ```powershell
   cd backend
   npm ci
   npx tsx scripts/storage-backup.ts verify ..\snapshot
   ```

5. Restore objects back into a bucket. There is intentionally no automated
   destructive restore command — restores are rare and target selection must be
   deliberate. Upload the extracted `objects/` tree with the Supabase CLI or a
   short script using the service-role key of the **target** project:

   ```bash
   # Example: Supabase CLI, restoring into a disposable bucket first.
   # Preserves each object's path under objects/ as its key in the bucket.
   cd snapshot/objects
   find . -type f | while read -r f; do
     key="${f#./}"
     supabase storage cp "$f" "ss:///documents/$key" \
       --experimental --project-ref <TARGET_PROJECT_REF>
   done
   ```

   Or, in Node, iterate `manifest.json` and call
   `supabase.storage.from('documents').upload(object.path, fileBuffer, { upsert: true })`
   with the target project's service-role key.

6. Spot-check: open a handful of restored objects and confirm they render, and
   re-run the `verify` step above against the extracted snapshot to confirm the
   local copy was intact.

7. Record the drill result in the launch notes: date/time, artifact name, target
   was disposable (not production), restore succeeded or failed, follow-ups.

## Production Restore

Only do this during an incident after confirming the chosen target bucket.

1. Confirm which objects are lost and whether a full or partial restore is
   needed. Prefer restoring only the missing/corrupted keys.
2. Decrypt and verify the chosen snapshot as in the restore drill.
3. Upload the affected object keys into the production `documents` bucket using
   the target project's service-role key, with `upsert: true` only where you
   intend to overwrite.
4. Spot-check affected records in the app (documents, photos, certificates).
5. Keep the snapshot and incident notes until the review is complete.

## Launch Gate

Before paying users:

- The scheduled storage-backup workflow must be merged.
- `STORAGE_BACKUP_SUPABASE_URL`, `STORAGE_BACKUP_SUPABASE_SERVICE_ROLE_KEY`, and
  `STORAGE_BACKUP_ENCRYPTION_KEY` must be configured as GitHub secrets, and the
  encryption key stored in the password manager.
- At least one scheduled or manual backup run must pass, and its dry-run size
  report reviewed to confirm the single-artifact design fits the bucket.
- At least one restore drill into a disposable bucket must pass and be recorded.

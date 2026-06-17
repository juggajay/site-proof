# Database Backup And Restore Runbook

Last updated: 2026-06-17

## Objective

Protect the Railway PostgreSQL production database from accidental deletion,
failed migrations, provider incidents, and bad application writes.

Target baseline:

- RPO: 24 hours while the scheduled GitHub Actions backup is the primary backup.
- RTO: 4 hours for a practiced restore into a replacement PostgreSQL database.
- Retention: 30 days of encrypted, verified dump artifacts in GitHub Actions.

Railway point-in-time recovery, if enabled for the production database plan, can
improve RPO/RTO. Treat Railway PITR as an additional control, not a replacement
for an independently downloadable dump, until a restore drill proves it.

## Automated Backup

Workflow: `.github/workflows/database-backup.yml`

Schedule: daily at `14:37 UTC` (`00:37 Australia/Sydney` during standard time).

The workflow:

1. Reads `DATABASE_BACKUP_URL` if configured, otherwise `DATABASE_URL`.
2. Runs `backend/scripts/backup.ts create` on a GitHub-hosted runner.
3. Verifies the dump checksum and `pg_restore --list` output.
4. Bundles the `.dump` and `.sha256` files into a tar archive.
5. Encrypts the archive with `gpg --symmetric --cipher-algo AES256`.
6. Uploads only the encrypted `.tar.gpg` file and its `.sha256` checksum as a
   GitHub Actions artifact.
7. Keeps artifacts for 30 days.

Required GitHub repository secret:

- `DATABASE_BACKUP_URL` preferred. Use a dedicated least-privilege backup
  database user if Railway supports it.
- `DATABASE_BACKUP_ENCRYPTION_KEY` required. Store this outside GitHub as well,
  for example in the company password manager, because it is needed for
  restores.

Fallback secret:

- `DATABASE_URL`

Do not commit any of these values. Do not paste them in tickets, audit notes,
chat, or logs.

## Daily Check

Every business day:

1. Open GitHub Actions.
2. Check the latest `Database Backup` run.
3. Confirm the run passed.
4. Confirm the artifact exists and contains a `.tar.gpg` file plus a
   `.tar.gpg.sha256` file.

If the latest scheduled run failed, treat it as a launch-blocking production
incident until a fresh backup has passed.

## Restore Drill

Run this before paying customers and then at least monthly.

Prerequisites:

- PostgreSQL client tools available locally or on a trusted runner.
- A disposable PostgreSQL database that is not production.
- The `DATABASE_BACKUP_ENCRYPTION_KEY` value from the password manager.
- A downloaded backup artifact containing one `.tar.gpg` and one
  `.tar.gpg.sha256`.

Steps:

1. Download the latest `siteproof-db-backup-*` artifact from GitHub Actions.
2. Extract it into a local folder.
3. Set a disposable target database URL only in the current shell:

   ```powershell
   $env:DATABASE_URL = "<disposable-postgres-url>"
   $env:BACKUP_DIR = "C:\path\to\extracted\artifact"
   ```

4. Verify the encrypted artifact checksum:

   ```powershell
   Get-FileHash .\siteproof-YYYY-MM-DDTHH-MM-SS-msZ.tar.gpg -Algorithm SHA256
   Get-Content .\siteproof-YYYY-MM-DDTHH-MM-SS-msZ.tar.gpg.sha256
   ```

5. Decrypt and extract the artifact:

   ```powershell
   gpg --batch --yes --pinentry-mode loopback `
     --passphrase "<database-backup-encryption-key>" `
     --decrypt --output siteproof-YYYY-MM-DDTHH-MM-SS-msZ.tar `
     siteproof-YYYY-MM-DDTHH-MM-SS-msZ.tar.gpg

   tar -xf siteproof-YYYY-MM-DDTHH-MM-SS-msZ.tar
   ```

6. Verify the dump:

   ```powershell
   cd backend
   npm ci
   npx tsx scripts/backup.ts verify siteproof-YYYY-MM-DDTHH-MM-SS-msZ.dump
   ```

7. Restore into the disposable database:

   ```powershell
   $env:CONFIRM_RESTORE = "siteproof-YYYY-MM-DDTHH-MM-SS-msZ.dump"
   npx tsx scripts/backup.ts restore siteproof-YYYY-MM-DDTHH-MM-SS-msZ.dump
   ```

8. Validate the restored database:

   ```powershell
   npm run migrate:status
   ```

9. Run a small read-only sanity check against the disposable database:

   ```sql
   SELECT COUNT(*) FROM users;
   SELECT COUNT(*) FROM projects;
   SELECT COUNT(*) FROM daily_dockets;
   SELECT COUNT(*) FROM claims;
   ```

10. Record the drill result in the launch notes:

   - Date and time.
   - Backup artifact name.
   - Target was disposable, not production.
   - Restore succeeded or failed.
   - Any follow-up action.

## Production Restore

Only do this during an incident after confirming the chosen target database.

1. Pause writes if the current production app is still running.
2. Create or select the replacement Railway PostgreSQL database.
3. Set application maintenance mode if available, or temporarily stop the app.
4. Restore the selected dump into the replacement database using the same
   `CONFIRM_RESTORE` flow from the restore drill.
5. Run `npm run migrate:status` against the restored database.
6. Point the production app `DATABASE_URL` to the restored database.
7. Start the app and run production smoke checks.
8. Keep the damaged database untouched until the incident review is complete.

## Launch Gate

Before paying users:

- The scheduled backup workflow must be merged.
- `DATABASE_BACKUP_URL` or `DATABASE_URL` must be configured as a GitHub secret.
- `DATABASE_BACKUP_ENCRYPTION_KEY` must be configured as a GitHub secret and
  stored in the password manager.
- At least one scheduled or manual backup run must pass.
- At least one restore drill into a disposable database must pass and be
  recorded.

# Migration Guide

This document covers migration procedures for SiteProof upgrades.

## Password Migration (SHA256 to bcrypt)

### Overview

Earlier versions of SiteProof used SHA256 for password hashing. The system has been upgraded to use bcrypt with 12 rounds for improved security.

### How It Works

The migration happens automatically and transparently:

1. **On Login:** When a user logs in, the system checks if their password hash starts with `$2b$` (bcrypt format)
2. **If SHA256:** The system verifies the password against the SHA256 hash
3. **Auto-Upgrade:** Upon successful verification, the password is automatically re-hashed using bcrypt
4. **Future Logins:** All subsequent logins use the bcrypt hash

### User Experience

- Users do not need to reset their passwords
- Migration is invisible to end users
- No downtime required

### Technical Details

```
SHA256 hash format: 64 character hex string
bcrypt hash format: $2b$12$... (60 characters)
```

The system detects the hash format and applies the appropriate verification algorithm.

## Environment Variables

### Required Production Variables

| Variable                                       | Description                                                                                    | Example                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `DATABASE_URL`                                 | PostgreSQL connection string                                                                   | `postgresql://user:pass@db.example.com:5432/siteproof` |
| `JWT_SECRET`                                   | 32+ character secret for signing JWT tokens                                                    | Generated random value                                 |
| `ENCRYPTION_KEY`                               | 64-character hex key for MFA/TOTP secret encryption                                            | Generated random hex value                             |
| `FRONTEND_URL`                                 | Public HTTPS frontend origin                                                                   | `https://app.example.com`                              |
| `BACKEND_URL` or `API_URL`                     | Public HTTPS backend origin                                                                    | `https://api.example.com`                              |
| `RESEND_API_KEY`                               | Resend key for production email delivery, unless `EMAIL_ENABLED=false`                         | `re_...`                                               |
| `EMAIL_FROM`                                   | Verified sender address for production email delivery, unless `EMAIL_ENABLED=false`            | `noreply@example.com`                                  |
| `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` | Durable production file storage, unless `ALLOW_LOCAL_FILE_STORAGE=true` is explicitly accepted | Supabase project URL and service key                   |

### Optional Production Variables

| Variable                                   | Description                                                                                                       | Default            |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------ |
| `RATE_LIMIT_STORE`                         | Durable rate-limit store. Production defaults to database and rejects `memory`.                                   | `database`         |
| `API_RATE_LIMIT_MAX`                       | General API requests per minute per source                                                                        | `1000`             |
| `AUTH_RATE_LIMIT_MAX`                      | Auth requests per minute per source                                                                               | `10` in production |
| `SUPPORT_RATE_LIMIT_MAX`                   | Public support request submissions per minute per source                                                          | `10` in production |
| `WEBHOOK_DELIVERY_TIMEOUT_MS`              | Webhook delivery timeout, capped at 30000ms                                                                       | `10000`            |
| `ERROR_LOG_TO_FILE`                        | Persist structured API error logs to `logs/errors.log`; set `false` when stdout/monitoring is the source of truth | `true`             |
| `ERROR_LOG_MAX_BYTES`                      | Maximum size for the local structured error log before it is trimmed                                              | `5242880`          |
| `GOOGLE_REDIRECT_URI`                      | Optional Google OAuth redirect URI. If set in production, it must be public HTTPS; otherwise it derives from `BACKEND_URL`. | unset              |
| `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` | Push notification keys. Configure both together.                                                                  | unset              |
| `VAPID_SUBJECT`                            | Required contact subject when production VAPID keys are configured; use `mailto:` or a public HTTPS URL.          | unset              |

### Frontend Production Build Variables

| Variable            | Description                                                                                         | Example                     |
| ------------------- | --------------------------------------------------------------------------------------------------- | --------------------------- |
| `VITE_API_URL`      | Public API base for browser requests. Use a same-origin path when the API is reverse-proxied.        | `/api` or `https://api.example.com` |
| `VITE_SUPABASE_URL` | Optional public Supabase URL for browser Supabase access. Leave blank unless a real project is used. | `https://project.supabase.co`       |

Production frontend builds reject localhost, plain HTTP, and placeholder
`VITE_API_URL` / `VITE_SUPABASE_URL` values.

### Generating Secure Keys

```bash
# Generate JWT_SECRET (64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPTION_KEY (64 hex characters = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Migration Script Usage

### Running Migrations

Database migrations are handled by Prisma:

```bash
cd backend

# Check the configured database has migration history and matches schema.prisma.
npm run migrate:status

# Check that committed migrations match schema.prisma.
# SHADOW_DATABASE_URL must point to a disposable PostgreSQL database.
SHADOW_DATABASE_URL=postgresql://user:password@localhost:5432/siteproof_shadow npm run db:diff

# Development - create and apply migrations
npx prisma migrate dev

# Production - apply pending migrations
npx prisma migrate deploy

# Production-shaped smoke check after build and deploy.
# Requires public HTTPS FRONTEND_URL/BACKEND_URL settings and a migrated database.
npm run smoke:production

# Production integration preflight.
# Uses safe read-only checks for Resend, Supabase Storage, Google OAuth, and VAPID settings.
npm run preflight:integrations

# Reset database (CAUTION: destroys all data)
npx prisma migrate reset
```

### Checking Migration Status

```bash
# Full operational preflight: connection, Prisma history, live-schema drift, schema validity.
npm run migrate:status

# Raw Prisma migration status
npx prisma migrate status

# Generate Prisma client after schema changes
npx prisma generate
```

### Baselining Existing Databases

This repository now includes a Prisma baseline migration named `20260508000000_initial`.

For a new database, run:

```bash
cd backend
npx prisma migrate deploy
```

For an existing database that was previously managed with `prisma db push` or manual SQL, do not run the initial migration directly against production tables. First take a PostgreSQL backup, confirm the live schema matches `prisma/schema.prisma`, then mark the baseline as already applied:

```bash
cd backend

# Requires pg_dump and pg_restore on PATH. Writes a custom-format PostgreSQL dump plus checksum.
DATABASE_URL="$DATABASE_URL" npm run db:backup
npx tsx scripts/backup.ts verify <backup-file>

# This must pass before baselining. If it fails, do not run migrate resolve.
npm run migrate:status

# Optional direct drift check. Exit code 0 means the live schema matches schema.prisma.
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code

npx prisma migrate resolve --applied 20260508000000_initial
npx prisma migrate deploy
npm run migrate:status
```

If the drift check reports changes, resolve the drift before baselining. Generate a read-only review script, inspect it, take a fresh PostgreSQL backup, and apply it only during an approved database maintenance window:

```bash
cd backend

# Review-only. This command does not change the database.
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > drift-to-schema.sql

# After review, backup, and approval, apply the reviewed script.
npx prisma db execute --file drift-to-schema.sql --url "$DATABASE_URL"

# Re-run the preflight. It must pass the drift check before resolving the baseline.
npm run migrate:status
```

After the baseline is recorded, future schema changes should be committed as Prisma migration folders and deployed with `npx prisma migrate deploy`.

Never run `npx prisma migrate resolve --applied 20260508000000_initial` on a database that still has schema drift. That records migration history without making the live schema match the application.

## Rollback Procedures

### Database Rollback

Prisma does not support automatic rollbacks. To revert a migration:

1. Restore from a verified PostgreSQL backup:

   ```bash
   cd backend
   CONFIRM_RESTORE=<backup-file-name> DATABASE_URL="$DATABASE_URL" npx tsx scripts/backup.ts restore <backup-file>
   ```

2. Or manually write a new migration to undo changes

### Application Rollback

1. Deploy the previous application version
2. Ensure database schema matches the application version
3. Verify all functionality works correctly

## Troubleshooting

### Common Issues

**Error: Invalid password after migration**

- The password hash format may not have migrated correctly
- Have the user reset their password via the forgot password flow

**Error: ENCRYPTION_KEY not set**

- Set `ENCRYPTION_KEY` to a 64-character hex string before enabling MFA in production.
- If 2FA was enabled with a different key, users may need to reconfigure MFA.

**Error: JWT_SECRET not set**

- This is a required variable - set it before starting the application
- All active sessions will be invalidated when changing this value

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

### New Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for signing JWT tokens | `your-secure-random-string-here` |

### New Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENCRYPTION_KEY` | 32-byte hex key for encrypting 2FA secrets | Auto-generated if not set |
| `JWT_EXPIRY` | Token expiration time | `24h` |
| `BCRYPT_ROUNDS` | Number of bcrypt rounds | `12` |

### Generating Secure Keys

```bash
# Generate JWT_SECRET (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPTION_KEY (64 hex characters = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Migration Script Usage

### Running Migrations

Database migrations are handled by Prisma:

```bash
cd backend

# Development - create and apply migrations
npx prisma migrate dev

# Production - apply pending migrations
npx prisma migrate deploy

# Reset database (CAUTION: destroys all data)
npx prisma migrate reset
```

### Checking Migration Status

```bash
# View migration history
npx prisma migrate status

# Generate Prisma client after schema changes
npx prisma generate
```

## Rollback Procedures

### Database Rollback

Prisma does not support automatic rollbacks. To revert a migration:

1. Restore from database backup
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
- Set the `ENCRYPTION_KEY` environment variable
- If 2FA was enabled without this key, users may need to reconfigure 2FA

**Error: JWT_SECRET not set**
- This is a required variable - set it before starting the application
- All active sessions will be invalidated when changing this value

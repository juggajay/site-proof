# Security Documentation

This document describes the security controls implemented in SiteProof and the deployment requirements that support them.

## Authentication

### Password Hashing

- Passwords are hashed with bcrypt using 12 rounds.
- Legacy SHA-256 password hashes are detected for migration compatibility and should be phased out through reset or rehash flows.
- New passwords must be at least 12 characters and include uppercase letters, lowercase letters, numbers, and special characters.

### JWT Authentication

- API authentication uses bearer JWTs.
- Logout and security-sensitive account changes invalidate existing tokens with a server-side invalidation timestamp.
- The frontend stores sessions in local or session storage through guarded helper functions. Because bearer tokens are readable by JavaScript, production deployments must keep XSS controls strict and avoid unreviewed HTML/script injection.

### Multi-Factor Authentication

- Optional TOTP MFA is supported.
- TOTP secrets are encrypted at rest with AES-256-GCM.
- Production startup requires a 64-character hex `ENCRYPTION_KEY`.

## Runtime Security Controls

- Production startup validates required secrets, public HTTPS URLs, email delivery configuration, and file-storage settings.
- `npm run preflight:integrations` performs read-only production checks for configured Resend, Supabase Storage, Google OAuth, and VAPID push settings before go-live.
- If Google OAuth is configured, `GOOGLE_REDIRECT_URI` must also use the public HTTPS backend origin in production.
- Production frontend builds validate public browser URLs and reject localhost, plain HTTP, and placeholder `VITE_API_URL` / `VITE_SUPABASE_URL` values.
- `RATE_LIMIT_STORE=memory` is rejected in production; durable database-backed rate limiting and auth lockouts are required for multi-instance deployments.
- Login attempts are rate-limited, and repeated failed authentication attempts trigger account lockout.
- Helmet is enabled with HSTS headers.
- Production HTTP requests are redirected to HTTPS when `NODE_ENV=production`.
- CORS is restricted to the configured `FRONTEND_URL` in production.
- Set `TRUST_PROXY=true` only when Express is behind a trusted proxy or load balancer that owns `X-Forwarded-*` headers.

## Data Protection

- Prisma parameterized queries are used for database access. Raw SQL must use parameterized Prisma template APIs, not unsafe string-built SQL.
- Uploaded documents, drawings, certificates, and protected files must be served through signed or authorized routes.
- Production file storage requires Supabase configuration unless durable local storage is explicitly accepted with `ALLOW_LOCAL_FILE_STORAGE=true`.
- Operational logs use redaction helpers for authorization headers, cookies, tokens, and secret-like values.
- Database backups use PostgreSQL `pg_dump` custom-format dumps with SHA-256 checksums. Restore requires an explicit `CONFIRM_RESTORE` value.

## Frontend Security

- React JSX escaping is the default rendering path.
- Intentional HTML/SVG rendering paths sanitize content with DOMPurify or narrow rich-text policies.
- New-tab links and programmatic opens use `noopener`/`noreferrer` or clear `window.opener`.
- The service worker must not runtime-cache authenticated API responses.

## Deployment Checklist

1. Use HTTPS for frontend and backend origins.
2. Set strong, unique values for `JWT_SECRET` and `ENCRYPTION_KEY`.
3. Build frontend assets with `VITE_API_URL=/api` or an HTTPS API origin, and leave `VITE_SUPABASE_URL` blank unless a real Supabase project is enabled.
4. Use PostgreSQL in production and require encrypted database connections at the infrastructure/provider level.
5. Configure durable Supabase file storage, or explicitly document the accepted risk of local file storage.
6. Keep `RATE_LIMIT_STORE` database-backed in production.
7. Configure production email delivery with `RESEND_API_KEY`, unless email is intentionally disabled.
8. Run `npm run preflight:integrations` with real production integration credentials before go-live.
9. Run the manual GitHub Actions `Production Preflight` workflow from the staging or production environment before go-live.
10. Run `npm run migrate:status` before and after database migration windows.
11. Create and verify a PostgreSQL backup before any migration, restore, or manual SQL maintenance.
12. Keep Node.js and dependencies patched; run dependency audits from an environment with working TLS certificate validation.
13. Forward structured logs to durable monitoring and alerting.

## Reporting Vulnerabilities

Report suspected security issues privately to the development team. Include affected routes, reproduction steps, expected impact, and any relevant logs or request examples. Do not disclose vulnerabilities publicly before they have been triaged and fixed.

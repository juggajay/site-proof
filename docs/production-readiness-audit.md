# Production Readiness Audit

Last updated: 2026-05-10

## Objective

Prepare SiteProof for paying users by verifying the full codebase, hardening release gates, optimizing obvious performance risks, and documenting live environment checks that are explicitly outside this codebase task.

## Current Status

Status: codebase/local readiness complete for the active audit scope.

Live third-party verification was explicitly marked out of scope on 2026-05-10. Local code, build, test, Docker, CI, production-shape smoke checks, and repeatable live-preflight tooling are in place.

Latest local `npm run preflight:integrations` result: failed as expected because the local environment is not production-grade. The current local environment has a too-short `JWT_SECRET`, local Supabase storage URL, unreachable provider checks from local config, and no VAPID configuration.

## Evidence Checklist

| Requirement                              | Evidence                                                                                                                                                   | Status                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Backend lint/type safety                 | `npm run lint`, `npm run type-check` in `backend`                                                                                                          | Passed                                   |
| Backend tests and coverage               | `npm run test:coverage` with disposable PostgreSQL                                                                                                         | Passed                                   |
| Backend route protection guardrails      | `npm test -- src/lib/routeAuthCoverage.test.ts --silent`                                                                                                   | Passed                                   |
| Frontend lint/format/build               | `npm run lint`, `npm run format:check`, production `npm run build` in `frontend`                                                                           | Passed                                   |
| Frontend production readiness guardrails | `npm run test:readiness`                                                                                                                                   | Passed, 71 tests                         |
| Full frontend E2E workflow coverage      | `npm run test:e2e -- --reporter=list`                                                                                                                      | Passed, 222 tests                        |
| Real-backend E2E coverage                | Full Playwright suite against disposable PostgreSQL and actual backend server                                                                              | Passed                                   |
| Dependency vulnerability floor           | `npm audit --audit-level=moderate` in backend and frontend with valid TLS trust                                                                            | Passed                                   |
| Database migration safety                | Prisma generate, deploy, status, and drift checks                                                                                                          | Passed                                   |
| Production startup safety                | Compiled backend fail-closed check for missing `DATABASE_URL`                                                                                              | Passed                                   |
| Production smoke                         | Compiled backend smoke with disposable PostgreSQL, `/health`, `/ready`, and HTTPS redirect checks                                                          | Passed                                   |
| Backend Docker image                     | Local Docker build and runtime sanity check                                                                                                                | Passed                                   |
| CI release gates                         | Workflows cover audits, format, migrations, lint, type checks, builds, Docker image build, preflight, backend tests, coverage, readiness, and frontend E2E | Enforced                                 |
| Production integration preflight         | `backend/scripts/preflight-production-integrations.ts` and `npm run preflight:integrations`                                                                | Implemented and CI skip-mode passed      |
| Manual live preflight workflow           | `.github/workflows/production-preflight.yml` uses GitHub Environment secrets for staging or production checks                                              | Implemented, live execution out of scope |
| Resend live email                        | Requires real `RESEND_API_KEY`, verified domain, and `EMAIL_FROM`                                                                                          | Out of scope for this codebase audit     |
| Supabase Storage live uploads            | Requires real `SUPABASE_URL`, service role key, and `documents` bucket                                                                                     | Out of scope for this codebase audit     |
| Google OAuth live sign-in                | Requires real Google client, secret, and HTTPS redirect URI configured in Google Cloud                                                                     | Out of scope for this codebase audit     |
| Push notification delivery               | Requires persistent VAPID keys, supported browser test, and production service worker origin                                                               | Out of scope for this codebase audit     |

## Changes Made During This Pass

- Added production performance indexes and a Prisma migration for high-traffic query paths.
- Split backend bootstrap from server wiring so production config is validated before application modules load.
- Added fail-closed runtime configuration validation for production secrets, public URLs, storage, email, rate limiting, OAuth, and VAPID settings.
- Added production integration preflight checks for Resend, Supabase Storage, Google OAuth metadata, and VAPID shape.
- Added production startup validation for partial or malformed Google OAuth client configuration.
- Hardened backend Docker builds with non-root runtime, readiness healthcheck, BuildKit CA secret support, and production artifact exclusions.
- Added CI Docker image build gates with `DOCKER_BUILDKIT=1`.
- Deferred the offline indicator so Dexie/offline code is not pulled into the initial frontend bundle.
- Added and expanded production readiness guardrails for unsafe URLs, mock OAuth, static upload exposure, logging redaction, browser storage safety, new-tab opener safety, no blocking dialogs, and CI gate coverage.

## Out-Of-Scope Live Checks

These checks are still recommended before a real go-live, but they are not part of the completed codebase/local readiness scope:

1. Run `npm run preflight:integrations` with real staging or production credentials.
2. Run the manual GitHub Actions `Production Preflight` workflow from the staging or production environment.
3. Perform a browser smoke test for Google OAuth against the configured public HTTPS redirect URI.
4. Upload, view, download, and delete at least one document through real Supabase Storage.
5. Send at least one real Resend email from the production domain.
6. Subscribe to push notifications from the production frontend origin and verify delivery plus safe click routing.

The active codebase audit can be marked complete because these live checks were explicitly removed from scope.

## GitHub Environment Secrets For `Production Preflight`

Required secrets:

- `DATABASE_URL`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `FRONTEND_URL`
- `BACKEND_URL`
- `API_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional secrets, required when the feature is enabled:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Optional environment variable:

- `EMAIL_ENABLED`: set to `false` only when production email delivery is intentionally disabled for that environment.

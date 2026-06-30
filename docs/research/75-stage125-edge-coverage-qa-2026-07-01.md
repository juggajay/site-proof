# Stage125 Edge Coverage QA - 2026-07-01

## Scope

Stage125 followed Stage124's final coverage-closure report. The goal was to close cheap, high-signal gaps that were already identified as edge coverage rather than start another broad feature audit.

Worktree: `C:\Users\jayso\siteproof-wt\qa-stage125-edge-coverage`

Branch: `qa/stage125-edge-coverage`

Base: `origin/master` at `9629612a` after PR #1287.

## Parallel Audit Inputs

Three read-only agents checked independent follow-up areas:

- Backend admin/diagnostic endpoints: `/api/notifications/email-queue`, system-alert checks, escalation checks, and `/api/metrics`.
- Frontend route/browser edges: public/static routes, `/documentation`, `/accept-invite`, MFA/OAuth branches, and classic subbie deep links.
- Push/consent behavior: push settings UI, web-push subscription cleanup, and cookie consent auditability.

## Changes Made

### 1. Notification diagnostic and alert-check routes now have direct coverage

Added route tests for:

- `GET /api/notifications/email-queue`
- `DELETE /api/notifications/email-queue`
- production guard coverage for email queue diagnostics
- `POST /api/notifications/system-alerts/check`
- `POST /api/notifications/alerts/check-escalations`

The tests cover happy paths, unauthenticated access, and non-admin denial where applicable.

File:

- `backend/src/routes/notifications.test.ts`

### 2. Push notification UI and cleanup paths are now pinned down

Added behavior tests for:

- enabling push from settings
- failed subscription feedback
- browser permission denied state
- disabling an existing subscription
- test-push success and failure result semantics
- cleanup of a newly-created browser subscription when server registration fails
- permission denial stopping before VAPID/server registration

Files:

- `frontend/src/components/settings/PushNotificationSettings.test.tsx`
- `frontend/src/lib/pushNotifications.test.ts`

### 3. Auth edge branches now have direct tests

Added unit coverage for:

- MFA login challenge after password sign-in
- preserving entered credentials through MFA verification
- OAuth callback provider error without code exchange
- OAuth missing-code error without code exchange
- OAuth MFA-required exchange failure, including one-time-code scrubbing

Files:

- `frontend/src/pages/auth/LoginPage.test.tsx`
- `frontend/src/pages/auth/OAuthCallbackPage.test.tsx`

### 4. Public and compatibility browser routes now have smoke coverage

Added Playwright coverage for:

- logged-out `/` and `/landing`
- public legal pages
- authenticated `/documentation` redirecting to `/docs`
- short `/accept-invite?id=...` alias rendering invitation context
- desktop classic subbie direct links staying classic when `shell=off`

Files:

- `frontend/e2e/public-routes.spec.ts`
- `frontend/e2e/subbie-mobile-shell.spec.ts`

## Verification

Backend disposable database:

- Docker Postgres `siteproof_stage125_test`
- `npm run db:deploy`: passed, 25 migrations applied before this report.

Backend tests:

- `DATABASE_URL=postgresql://...siteproof_stage125_test npm test -- --run src/routes/notifications.test.ts --maxWorkers=1`
- Result: 1 file, 116 tests passed.

Frontend unit tests:

- `npm run test:unit -- --run src/components/settings/PushNotificationSettings.test.tsx src/lib/pushNotifications.test.ts src/pages/auth/LoginPage.test.tsx src/pages/auth/OAuthCallbackPage.test.tsx`
- Result: 4 files, 17 tests passed.

Frontend browser tests:

- `npm run test:e2e -- e2e/public-routes.spec.ts e2e/subbie-mobile-shell.spec.ts`
- Result: 2 files, 9 tests passed.

Static checks:

- Backend `npm run type-check`: passed.
- Backend `npm run lint`: passed.
- Frontend `npm run type-check`: passed.
- Frontend `npm run lint`: passed with the known existing `frontend/src/lib/theme.tsx` fast-refresh warning only.

## Remaining Follow-Ups

No new P0/P1 blocker was found in Stage125.

Still open from Stage124/125:

- Direct `/api/metrics` endpoint tests are still weak because the route is mounted inside `backend/src/server.ts` rather than an exported Express app factory. A future refactor should extract app construction and test the real route with Supertest.
- Cookie consent is local-only today. That is acceptable if the banner is treated as local preference state, but if the product wants auditable cookie consent history, authenticated accept/decline should write best-effort records to `POST /api/consent` with `consentType: cookie_policy`.
- Claims report/export and account export still need scale caps before large imported histories.
- Scheduled report snapshots still generate all-history artifacts rather than cadence-windowed snapshots.
- Audit log CSV can still export all filtered rows with no total cap.
- Retention worker policy and document versioning UI remain hardening/product follow-ups.

## Current Readiness Judgment

Stage125 did not find a new broken core workflow. It converted several previously manual/implicit checks into repeatable tests around admin diagnostics, push settings, auth edge cases, public routes, and subbie shell compatibility.

The whole-app readiness loop is close to the evidence finish line, but should remain open until this Stage125 PR is merged green and the remaining scale/product decisions are either accepted for launch or assigned to a later stage.

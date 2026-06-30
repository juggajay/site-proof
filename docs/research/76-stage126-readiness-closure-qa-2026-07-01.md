# Stage126 Readiness Closure QA - 2026-07-01

## Scope

Stage126 continued the whole-app readiness loop after Stage125 merged green. The focus was on the remaining small, testable closure items rather than starting another broad audit pass.

Worktree: `C:\Users\jayso\siteproof-wt\qa-stage126-readiness-closure`

Branch: `qa/stage126-readiness-closure`

Base: `origin/master` at `57b6c5f7` after PR #1288.

## Parallel Audit Inputs

Three read-only agents checked the remaining Stage125 follow-ups:

- `/api/metrics` route coverage and server startup structure.
- Cookie consent auditability and safe frontend/backend semantics.
- Export and scale follow-ups: claims reports, account export, scheduled reports, and audit log CSV.

## Changes Made

### 1. `/api/metrics` now has direct endpoint coverage

Problem:

- `/api/metrics` was mounted only inside `startServer()`.
- Calling `startServer()` in a Supertest route test would also open a listener and start scheduled/report/notification/data-retention workers.
- Stage125 therefore only documented the gap rather than proving the route directly.

Fix:

- Extracted `createServerApp()` from `backend/src/server.ts`.
- Kept listener startup, runtime validation, worker startup, and graceful shutdown inside `startServer()`.
- Added direct Supertest coverage for `/api/metrics`:
  - unauthenticated request -> `401`
  - authenticated non-admin company role -> `403`
  - owner/admin company roles -> `200` with metrics shape

Files:

- `backend/src/server.ts`
- `backend/src/server.test.ts`

### 2. Cookie consent is now auditable for authenticated browser users

Problem:

- The frontend cookie banner only wrote local preference state.
- Backend `/api/consent` already supported `cookie_policy`, but the banner never wrote an authenticated audit record.

Fix:

- Added a small `recordCookiePolicyConsentDecision()` helper.
- The banner still stores consent locally and dismisses immediately.
- Authenticated users get a best-effort raw `POST /api/consent` with `{ consentType: 'cookie_policy', granted }`.
- The helper skips users with no token and suppresses request failures.
- It intentionally does not use `authFetch`/`apiFetch`, so a failed audit write cannot trigger auth-expiry handling or trap the user behind the banner.

Files:

- `frontend/src/lib/consentAudit.ts`
- `frontend/src/lib/consentAudit.test.ts`
- `frontend/src/components/CookieConsentBanner.tsx`
- `frontend/src/components/CookieConsentBanner.test.tsx`

### 3. Export/scale follow-ups were re-checked

No P0/P1 blocker was found in the export/scale review.

- Claims report/export is still unbounded, but expected launch volume is bounded by project/billing-period usage unless large historical imports happen immediately.
- Account export already caps several operational collections and reports truncation metadata. Some core user-authored collections remain uncapped as a privacy/product tradeoff.
- Scheduled report snapshots remain all-history for counts/groupings, with capped detail samples.
- Audit log CSV pages through all filtered rows. This is admin-triggered and not core launch-blocking.

Recommendation:

- Leave these as accepted scale/product follow-ups for launch unless large imported histories are expected before first paying customers.
- The safest later hardening patch is an audit CSV frontend export cap with a "narrow filters" message.

## Verification

Backend disposable database:

- Docker Postgres `siteproof_stage126_test`.
- `npm run db:deploy`: passed, 25 migrations applied.
- `npx prisma generate`: passed after copying cached Prisma engines into the fresh worktree.

Backend tests:

- `DATABASE_URL=postgresql://...siteproof_stage126_test NODE_ENV=test npm test -- --run src/server.test.ts --maxWorkers=1`
- Result: 1 file, 3 tests passed.

Frontend unit tests:

- `npm run test:unit -- --run src/lib/consentAudit.test.ts src/components/CookieConsentBanner.test.tsx`
- Result: 2 files, 6 tests passed.

Static checks:

- Backend `npm run type-check`: passed.
- Backend `npm run lint`: passed.
- Frontend `npm run type-check`: passed.
- Frontend `npm run lint`: passed with the known existing `frontend/src/lib/theme.tsx` fast-refresh warning only.

## Remaining Follow-Ups

No new P0/P1 blocker was found in Stage126.

Still open:

- Claims report/export cap or required date-window contract before large imported histories.
- Account export cap policy for the remaining uncapped core user-authored collections.
- Scheduled report cadence-window product decision.
- Audit log CSV total export cap.
- Retention worker policy automation.
- Document versioning UI.

## Current Readiness Judgment

Stage126 closed two previously documented readiness gaps with direct tests: metrics route coverage and authenticated cookie consent audit writes.

The remaining items are scale/product hardening rather than evidence of broken launch-critical workflows. The overall app loop should remain active until the final readiness index is written and the remaining accepted risks are explicitly signed off or assigned.

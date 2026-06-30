# Stage 117 Authenticated Role Browser QA

Date: 2026-07-01 Australia/Sydney
Stage owner: Codex
Scope: local seeded browser QA across owner/admin, foreman, subcontractor, lot, ITP, hold point, NCR, docket, document, reporting, admin, auth, and guardrail workflows.

## Summary

Stage 116 proved production reachability: public domains, backend health, CORS, deploy status, and master CI were green.

Stage 117 moved back to a local seeded authenticated browser loop. The goal was to exercise the app as real roles, not just as isolated unit tests. This stage used the e2e seed data and normal browser login flows for the seeded owner/admin, foreman, and subcontractor users.

Result: passed after correcting a local test-environment setup mistake.

## Current Overall Loop Position

The overall launch-readiness loop is now in the confidence-check phase, not the broad discovery phase.

Completed checkpoints:

- Production is booting and reachable.
- Public frontend domains can call the Railway backend.
- Master CI was green after the Stage 116 production CORS fixes.
- Sentry and backup work were previously shipped as launch gates.
- Core local authenticated role journeys are passing in browser tests.
- The high-risk lot, ITP, hold point, docket, NCR, document, and report paths have all had repeated focused review and browser coverage.

Remaining work before calling the whole loop finished:

- Record this Stage 117 checkpoint in git and PR/merge it.
- Do one final production/staging smoke with real browser accounts after the current frontend/auth work is merged.
- Re-run the full CI gate on master after that merge.
- Triage any remaining findings as launch blocker, pre-scale fix, or polish.

## Practical Finish Line

There is an actual finish line for this loop.

The loop should be considered complete when all of the following are true:

1. Local full-role browser QA passes with seeded owner/admin, foreman, and subcontractor accounts.
2. Production health checks and public-domain browser canaries pass.
3. PR and master CI are green, including backend tests, frontend coverage, PR smoke, and full E2E where applicable.
4. Launch gates remain configured: Sentry/error visibility, database backups, restore runbook, and production preflight.
5. Any known issues are documented and classified, with no open launch blockers.

At that point, continuing QA is optional hardening rather than the same launch-readiness loop.

## Test Setup

Worktree:

`C:\Users\jayso\siteproof-wt\qa-stage117-authenticated-role-loop`

Base commit:

`84e36db5 docs: record stage 116 live confidence qa (#1278)`

Local database:

`postgresql://postgres:postgres@localhost:5432/siteproof_test`

Seed command:

```powershell
cd backend
$env:NODE_TLS_REJECT_UNAUTHORIZED='0'
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/siteproof_test'
$env:NODE_ENV='e2e'
npm run seed:e2e
```

Backend runtime:

- URL: `http://localhost:3001`
- `NODE_ENV=e2e`
- `ALLOW_TEST_AUTH_ENDPOINTS=true`
- `EMAIL_PROVIDER=mock`
- `EMAIL_ENABLED=true`
- Local filesystem storage fallback was expected because production Supabase storage credentials were not used for this local run.

Seeded browser users:

- `test@example.com`
- `foreman@example.com`
- `subcontractor@example.com`

All used the checked-in e2e password from `backend/scripts/seed-e2e.mjs`.

## Environment Issue Found

The first run of `e2e/seeded-role-journeys.spec.ts` failed in the hold point release journey.

Observed failure:

- Browser showed `Failed to send hold point release request email`.
- Backend returned `POST /api/holdpoints/request-release 502`.
- Backend log showed `[Email Service] Email sending disabled`.

Root cause:

The local backend had been started with `EMAIL_ENABLED=false`. That made the hold point request-release flow fail even though the app code was behaving correctly for the configured environment.

Resolution:

Restarted the local backend with `EMAIL_ENABLED=true`, reseeded the database, and reran the test. The full seeded role journey then passed.

This should be treated as a QA setup pitfall, not a product bug.

## Browser QA Results

### Seeded Role Journeys

Command:

```powershell
cd frontend
$env:VITE_API_URL='http://localhost:3001'
$env:PLAYWRIGHT_WORKERS='1'
npx playwright test e2e/seeded-role-journeys.spec.ts --project=chromium --reporter=list
```

Result:

- Initial run: 4 passed, 1 failed due to local `EMAIL_ENABLED=false`.
- Rerun after environment fix: 5 passed.

Covered:

- owner/admin login and authenticated route access
- subcontractor role journey
- foreman mobile shell route
- hold point release
- ITP item completion
- lot conformance unblock

### Mobile Shell And Subcontractor Access

Command:

```powershell
npx playwright test e2e/foreman-mobile-shell.spec.ts e2e/subbie-mobile-shell.spec.ts e2e/subcontractor-portal-rbac.spec.ts e2e/subcontractor-docket-reachability.spec.ts --project=chromium --reporter=list
```

Result:

- 19 passed.

Expected denied-access tests produced browser console 403 entries.

### Core Quality, Commercial, Documents, And Reports

Command:

```powershell
npx playwright test e2e/lots.spec.ts e2e/lot-detail.spec.ts e2e/holdpoints.spec.ts e2e/dockets.spec.ts e2e/ncr.spec.ts e2e/documents.spec.ts e2e/subcontractor-documents.spec.ts e2e/drawings.spec.ts e2e/reports.spec.ts --project=chromium --reporter=list
```

Result:

- 90 passed.

Covered:

- lots
- lot detail
- hold points
- dockets
- NCRs
- documents
- subcontractor documents
- drawings
- reports

### Admin, Account, Commercial, And Remaining Role Areas

Command:

```powershell
npx playwright test e2e/dashboard.spec.ts e2e/projects.spec.ts e2e/project-users.spec.ts e2e/project-settings.spec.ts e2e/project-areas.spec.ts e2e/company-settings.spec.ts e2e/claims.spec.ts e2e/diary.spec.ts e2e/costs.spec.ts e2e/audit-log.spec.ts e2e/global-search.spec.ts e2e/header-notifications.spec.ts e2e/settings.spec.ts e2e/profile.spec.ts e2e/subcontractors.spec.ts e2e/itp.spec.ts e2e/test-results.spec.ts --project=chromium --reporter=list
```

Result:

- 133 passed.

The command exited successfully. The terminal output was truncated in the session log, but the process exit code was 0.

### Auth, Logged-Out, Guardrail, And Support Areas

Command:

```powershell
npx playwright test e2e/auth.spec.ts e2e/csv.spec.ts e2e/delay-register.spec.ts e2e/documentation.spec.ts e2e/downloads.spec.ts e2e/error-handling.spec.ts e2e/not-found.spec.ts e2e/onboarding.spec.ts e2e/portfolio.spec.ts e2e/support.spec.ts e2e/productionReadiness.spec.ts --project=chromium --reporter=list
```

Result:

- 138 passed.

Expected negative-path tests produced console errors such as duplicate email, service unavailable, and support delivery unavailable.

## Total Stage 117 Browser Result

Passed browser tests after the environment fix:

- Seeded role journeys: 5
- Mobile shell and subcontractor access: 19
- Core domain group: 90
- Admin/account/commercial group: 133
- Auth/guardrail group: 138

Total: 385 passed.

## Non-Blocking Observations

- Browser output repeatedly warned that Browserslist/caniuse-lite data is old. This is maintenance noise, not a product failure.
- Browser output also warned that a PostCSS plugin did not pass a `from` option to `postcss.parse`. This is worth cleaning up, but it did not block QA.
- Several console errors were expected because the relevant specs intentionally test failed requests, denied access, and retry/error states.
- Local antivirus/security software continued to mark some older research docs as deleted in worktrees. Those changes were not staged or committed.

## Stage 117 Result

Status: passed.

No new product blocker was found in this stage. The one failure investigated was caused by local QA backend configuration, then cleared by running the backend with mock email enabled.

## Next Recommended Stage

Stage 118 should be the final production-facing pass after the current frontend/auth work is merged:

- verify logged-out landing/login behavior on the public domain
- verify owner, foreman, and subcontractor login against the intended environment
- run one production-safe hold point request/release canary using disposable data
- verify generated reports and document links with real browser navigation
- confirm Sentry still receives a test event after deploy
- confirm backup workflow status and latest backup artifact location

If Stage 118 passes and CI is green, the current launch-readiness loop can be closed with remaining work tracked as normal product hardening.

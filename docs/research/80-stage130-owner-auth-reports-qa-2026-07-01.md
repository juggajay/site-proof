# Stage130 Owner, Auth, And Reports QA - 2026-07-01

Branch: `qa/stage130-owner-auth-reports`
Base: `origin/master` at `47457245` (Stage129 merged)

## Scope

This pass targeted owner/admin surfaces, magic-link auth edges, and report artifact delivery:

- Owner and company-admin company settings access.
- Company member denial for owner/admin-only settings.
- Magic-link verification failure UX and backend regression coverage.
- Scheduled report artifact downloads, especially generated filenames from real project/report names.

The goal was to catch bugs that only appear outside the happy path: expired or reused auth links, non-owner company admins, denied members, and scheduled report files with user-supplied names.

## Parallel Audit Inputs

Three read-only subagents reviewed separate areas before fixes:

- Auth/magic login: confirmed the core flow was sound, but found generic frontend error copy for expired/reused/invalid magic links and missing explicit backend tests for those cases.
- Owner/admin settings: found good existing coverage for owners, but weaker browser coverage for plain company admins and member denial.
- Reports: found a real backend bug where scheduled report artifact downloads could fail for non-ASCII filenames because raw Unicode was written into `Content-Disposition`.

## Findings Fixed

### 1. Magic-link failures were too generic for real users

Files:

- `frontend/src/pages/auth/MagicLinkPage.tsx`
- `frontend/src/pages/auth/MagicLinkPage.test.tsx`
- `frontend/e2e/auth.spec.ts`
- `backend/src/routes/auth.test.ts`

Problem:

The backend already returned useful messages for expired, reused, invalid, MFA-blocked, and setup-blocked magic links. The frontend mostly collapsed them into a generic "Failed to verify magic link" message. A user clicking an old email link would not know whether to request a new link, use MFA, or complete account setup.

Fix:

- Added a table-driven frontend mapper for safe backend magic-link errors.
- Kept the token scrub behavior, so failed links do not reappear in the URL.
- Added frontend unit coverage for expired and reused links.
- Added browser coverage for expired, reused, and invalid magic-link errors.
- Added backend regression tests for expired and already-used magic-link verification.

### 2. Scheduled report artifact downloads could fail for non-ASCII filenames

Files:

- `backend/src/lib/scheduledReports/artifacts.ts`
- `backend/src/routes/reports.test.ts`

Problem:

Scheduled report filenames can include project or report names. If the generated filename contained non-ASCII characters, for example an em dash, the backend wrote that raw string into the `Content-Disposition` header. Node can reject non-ASCII header values, which can turn an otherwise valid report download into a 500.

Fix:

- Kept the stored/display filename intact.
- Added an ASCII fallback filename for the legacy `filename="..."` value.
- Added RFC 5987 `filename*=UTF-8''...` encoding for the real Unicode filename.
- Added backend coverage using `Lot Status Report - Stage 2.pdf` with a Unicode dash in the stored filename.

### 3. Company settings role behavior needed browser-level coverage

File:

- `frontend/e2e/company-settings.spec.ts`

Problem:

The app logic already intended:

- Company owners see billing and ownership transfer.
- Company admins can manage team, API keys, and webhooks, but not billing or ownership transfer.
- Company members are denied before company settings data loads.

That behavior had strong lower-level coverage but not enough browser coverage for the non-owner/admin split.

Fix:

- Extended the company settings E2E API mock to run as different company users.
- Added a browser test proving company admins can manage team and integrations without owner-only controls.
- Added a browser test proving company members see Access Denied before settings APIs are fetched.

## Verification

Passed:

- `npm run type-check` in `backend`
- `npm run type-check` in `frontend`
- `npm run lint` in `backend`
- `npm run lint` in `frontend`
  - Existing warning only: `frontend/src/lib/theme.tsx` fast-refresh export warning.
- `npm run test:unit -- --run src/pages/auth/MagicLinkPage.test.tsx`
  - 1 file, 6 tests passed.
- `DATABASE_URL=... NODE_ENV=test npm test -- src/routes/auth.test.ts -t "Magic Link Authentication"`
  - Test runner executed the full auth route file: 1 file, 98 tests passed.
- `DATABASE_URL=... NODE_ENV=test npm test -- src/routes/reports.test.ts -t "non-ASCII filenames"`
  - Test runner executed the full reports route file: 1 file, 93 tests passed.
- `npx playwright test e2e/auth.spec.ts --project=chromium --reporter=list`
  - 30 tests passed.
- `npx playwright test e2e/company-settings.spec.ts --project=chromium --reporter=list`
  - 13 tests passed.
- `fallow audit --base origin/master --format json --quiet`
  - Verdict: `warn`
  - Introduced dead code: 0
  - Introduced complexity: 0
  - Introduced duplication: 7 clone groups, mostly existing E2E/test harness patterns and repeated private download headers.

Observed non-blocking warnings:

- Browserslist data is stale.
- A PostCSS plugin warning about missing `from` option appears during Playwright web-server startup.
- The company settings failure-recovery test intentionally logs mocked 500 responses while proving recovery.

## Remaining Overall Loop Work

Stage130 closes the owner/auth/reports slice, but it is not the end of the full app loop. Remaining useful passes:

- Production-like browser journeys using real seeded owner, foreman, and subcontractor accounts.
- End-to-end report/PDF creation across all report types, not just scheduled artifact download.
- Offline/online boundaries for diary, dockets, photos, ITPs, and NCR evidence.
- Cross-company denial checks through live browser flows, not only mocked route tests.
- Billing/account-exit edge cases around owners, company admins, invited users, and passwordless users.
- Production canary checks after this PR merges.

Stage130 should be treated as a completed slice of the launch-readiness loop, not the overall finish line.

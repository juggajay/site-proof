# Stage 96 - Authenticated Role Browser QA

Date: 2026-06-30

Branch: `qa/stage96-role-browser`

Baseline: `0f011947 fix: harden claim evidence reports (#1253)`

## Scope

Stage 96 focused on authenticated multi-role browser journeys after the
reports/claims Stage 95 pass.

Roles and surfaces covered:

- Admin/owner-style workspace: dashboard, portfolio/projects, lots, claims,
  reports, company settings, documents, drawings, project settings, project
  users, project areas, global search.
- Foreman mobile shell: `/m`, lots/ITP, diary shell, dockets, issues, photos,
  docs/drawings route map.
- Subcontractor portal and mobile shell: classic portal RBAC, `/p` shell
  routes, assigned work, ITP access, dockets, documents, project/company scope.
- Real seeded local backend journey: admin, foreman, and subcontractor logins
  against local `siteproof_e2e`, including ITP pass/N/A/fail, hold-point
  request/release, and lot conformance.

## Browser Evidence

Local disposable E2E setup:

- Created local database `siteproof_e2e` on localhost Postgres.
- Applied all 24 Prisma migrations.
- Seeded the guarded E2E accounts through `backend/scripts/seed-e2e.mjs`.
- Ran backend on `http://localhost:3001` with local-only test env and mock
  email provider.

Browser runs:

- `npm run test:e2e -- e2e/seeded-role-journeys.spec.ts --project=chromium --reporter=list`
  - Result: 5 passed.
- `npm run test:e2e -- e2e/foreman-mobile-shell.spec.ts e2e/subbie-mobile-shell.spec.ts e2e/subcontractor-portal-rbac.spec.ts --project=chromium --reporter=list`
  - Result: 14 passed.
- `npm run test:e2e -- e2e/dashboard.spec.ts e2e/projects.spec.ts e2e/lots.spec.ts e2e/claims.spec.ts e2e/reports.spec.ts e2e/company-settings.spec.ts e2e/documents.spec.ts e2e/drawings.spec.ts e2e/project-users.spec.ts e2e/project-settings.spec.ts e2e/project-areas.spec.ts e2e/global-search.spec.ts --project=chromium --reporter=list`
  - Result: 100 passed.
- `npm run test:e2e -- e2e/diary.spec.ts e2e/dockets.spec.ts e2e/itp.spec.ts e2e/holdpoints.spec.ts e2e/ncr.spec.ts e2e/lot-detail.spec.ts e2e/subcontractor-documents.spec.ts e2e/subcontractor-docket-reachability.spec.ts e2e/subcontractors.spec.ts e2e/downloads.spec.ts e2e/audit-log.spec.ts e2e/settings.spec.ts e2e/profile.spec.ts e2e/support.spec.ts --project=chromium --reporter=list`
  - Result: 94 passed.

Total Stage 96 browser coverage in this pass: 213 passing browser tests.

## Confirmed Fix

### 1. Foreman diary shell emitted a Tailwind ambiguity warning

Impact:

- Every Vite/Playwright browser run printed a Tailwind warning for
  `duration-[180ms]`.
- This was not user-visible, but it added noise to the QA signal and could hide
  more important warnings.

Fix:

- Replaced the ambiguous class in
  `frontend/src/shell/screens/diary/PathScreen.tsx` with the explicit arbitrary
  CSS property `[transition-duration:180ms]`.
- The visual transition timing remains 180ms.

Verification:

- `npm run test:e2e -- e2e/foreman-mobile-shell.spec.ts --project=chromium --reporter=list`
  - Result: 1 passed.
  - The `duration-[180ms]` Tailwind warning no longer appears.
- `npm run test:unit -- src/shell/screens/diary/test/PathScreen.test.tsx`
  - Result: 8 passed.
- `npm run format:check -- src/shell/screens/diary/PathScreen.tsx`
  - Result: passed.

## Findings

No functional blockers were found in the Stage 96 role-browser pass.

The real-backend seeded journey confirmed:

- Admin sees the assigned lot ITP permissions.
- Assigned subcontractor can open and complete ITP items.
- Subcontractor pass, N/A, and fail outcomes post correctly.
- Foreman reaches the mobile shell from dashboard on mobile viewport.
- Hold-point release updates the ITP completion state and enables normal lot
  conformance.

The mocked browser suites confirmed:

- Subcontractor portal RBAC and mobile shell routing remain intact.
- Foreman mobile shell route/project scoping remains intact.
- Owner/admin workspace surfaces still render expected happy paths and error
  states.
- Dockets, diary, ITP, hold points, NCR, documents, drawings, settings,
  profile, support, and subcontractor surfaces still pass their current
  browser coverage.

## Observations To Carry Forward

- Several browser specs intentionally mock 403/500/503 responses to verify
  graceful UI error states. These produce console error output during tests.
  That is expected for the current specs, but a later polish pass could decide
  whether handled expected errors should be quieter in development logs.
- Browserslist reports stale `caniuse-lite` data during Vite runs. This is
  housekeeping, not a Stage 96 product bug.
- A PostCSS plugin still warns that it did not pass `from` to `postcss.parse`.
  This appears independent of the Stage 96 code change and should be tracked as
  build-tooling cleanup if it becomes noisy in CI.
- The gstack `browse` binary was not built in this worktree, so this stage used
  Playwright browser automation instead. The app behavior was still tested in
  Chromium.
- Large real-world claim/evidence package generation remains a separate
  stress-test follow-up from Stage 95. Stage 96 did not retest PDF generation
  size limits.

## Next Suggested Stage

Stage 97 should target real-size data and performance pressure:

- Seed or mock many lots, photos, ITP items, NCRs, dockets, and documents.
- Walk the slowest pages with browser timing and memory observations:
  dashboard, lots table/detail, claim evidence package, reports, documents,
  drawings, and mobile shell lists.
- Record hard numbers for load time, API fan-out, and main-thread PDF/export
  behavior.

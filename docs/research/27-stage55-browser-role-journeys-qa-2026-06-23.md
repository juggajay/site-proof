# Stage 55 Browser Role Journeys QA - 2026-06-23

## Scope

Stage 55 focused on cross-role browser journeys around the owner/admin dashboard, project workspace, lots, ITPs, hold points, dockets, NCRs, reports, subcontractor portal, subbie mobile shell, and foreman mobile shell.

This pass used an isolated worktree on `qa/stage55-browser-role-journeys` based on `origin/master` after PR #1109. The main checkout was not edited.

## Parallel Audit Notes

- Browser/harness audit confirmed the best true seeded path is local backend plus frontend with `backend/scripts/seed-e2e.mjs` against a disposable Postgres. Local Docker was installed but not running, and `psql` was unavailable, so this pass used the existing Playwright browser suites with mocked API contracts.
- API/code audit found two dashboard API links pointing at unmounted frontend routes and one subcontractor portal error state that could mask a denied project scope.

## Confirmed Findings

1. NCR register load failure could trigger a render loop.
   - Symptom: the broad browser run emitted `Warning: Maximum update depth exceeded` from `NCRFiltersInner` / `NCRPage`.
   - Cause: `useNCRData` returned a fresh `[]` fallback every render when the NCR query had no data after a load failure. `NCRFilters` recomputed a new filtered array and notified the parent on every render.
   - Fix: use a stable empty NCR register fallback and add a regression test.

2. Foreman dashboard hold-point cards emitted a dead internal route.
   - Old API link: `/projects/:projectId/lots/:lotId/holdpoints?hp=:hpId`
   - Mounted route: `/projects/:projectId/hold-points`
   - Fix: emit `/projects/:projectId/hold-points?hp=:hpId` and cover it with a DB-backed route test.

3. Quality dashboard pending verification cards emitted a dead internal route.
   - Old API link: `/projects/:projectId/lots/:lotId/itp`
   - Mounted lot route: `/projects/:projectId/lots/:lotId`
   - Fix: emit `/projects/:projectId/lots/:lotId?tab=itp`, with fallback to `/projects/:projectId/itp`, and cover it with backend and browser assertions.

4. Subcontractor portal project-scope 403s could look like a normal blank portal.
   - A denied `/api/subcontractors/my-company?projectId=...` could leave fallback labels such as "Your Company" / "Project" and show the docket CTA.
   - Fix: render a real portal access error panel and hide the docket CTA when the company query fails with no company data.

## Verification

Passed locally:

- `frontend`: `npm run test:unit -- src/pages/ncr/hooks/useNCRData.test.tsx`
- `frontend`: `npx playwright test e2e/dashboard.spec.ts e2e/subcontractor-portal-rbac.spec.ts --project=chromium --reporter=line`
- `frontend`: `npx playwright test e2e/ncr.spec.ts --project=chromium --reporter=line`
- `frontend`: broad Stage 55 slice, 103 browser tests passed:
  - `dashboard.spec.ts`
  - `projects.spec.ts`
  - `lots.spec.ts`
  - `lot-detail.spec.ts`
  - `itp.spec.ts`
  - `holdpoints.spec.ts`
  - `dockets.spec.ts`
  - `ncr.spec.ts`
  - `reports.spec.ts`
  - `subcontractor-portal-rbac.spec.ts`
  - `subcontractor-docket-reachability.spec.ts`
  - `subbie-mobile-shell.spec.ts`
  - `foreman-mobile-shell.spec.ts`
- `frontend`: `npm run type-check`
- `frontend`: `npm run lint` (existing warning only: `src/lib/theme.tsx` fast-refresh export warning)
- `frontend`: `npm run format:check`
- `backend`: `npm run type-check`
- `backend`: `npm run lint`
- `backend`: `npm run format:check`
- root: `git diff --check`

Blocked locally:

- `backend`: `npm run test -- src/routes/dashboard.test.ts`
  - Initial run needed Prisma client generation.
  - `npm run db:generate` required a local TLS workaround for Prisma's Windows engine download.
  - The dashboard route test then stopped because this worktree has no `DATABASE_URL`. No production DB was used. CI should run these DB-backed tests with the configured test database.

## Non-Blocking Warnings Observed

- Playwright web server still reports old Browserslist data.
- Tailwind warns that `duration-[180ms]` is ambiguous.
- A PostCSS plugin warning says the `from` option was not passed.
- Several browser console errors are intentionally induced by error-state tests that mock 4xx/5xx responses.

## Next Suggested Sweep

Run a true local seeded multi-role browser session against a disposable Postgres once Docker Desktop is running. Prioritize:

- real owner/foreman/subbie account journeys without API mocks,
- project setup through lot creation and ITP assignment,
- hold-point request/release and lot conformance,
- docket creation/approval from both sides,
- report generation/export with real seeded data.


# Stage 56 Seeded Role Browser QA - 2026-06-23

## Scope

Goal: run a real-browser, real-backend pass against a disposable seeded Postgres database instead of relying only on mocked Playwright routes.

This pass focused on the first layer of cross-role reachability:

- Head contractor/admin project workspace.
- Subcontractor portal against an assigned lot.
- Foreman mobile shell against the same seeded project.
- Console/page error and 4xx/5xx response capture while navigating core pages.

## Environment

- Worktree: `.gstack/worktrees/stage56-seeded-role-workflows`
- Branch: `qa/stage56-seeded-role-workflows`
- Database: disposable local Docker Postgres on port `55432`
- Backend: local API on `3001`
- Frontend: local Vite app on `5174`
- Seed source: `backend/scripts/seed-e2e.mjs`

No production database, Railway environment, or production credentials were used.

## Method

1. Applied migrations to the disposable database.
2. Ran the E2E seed script.
3. Started backend and frontend locally.
4. Used a temporary ignored Playwright probe to log in as the seeded admin, subbie, and foreman users in separate browser contexts.
5. Navigated 42 authenticated routes across the three roles.
6. Captured visible page text, screenshots, console errors, page errors, failed requests, and HTTP 4xx/5xx responses.
7. Converted the confirmed coverage gap into a permanent Playwright spec.

Temporary browser artifacts live under `.gstack/tmp/` and are intentionally not committed.

## Findings

### Fixed: seeded data could not test subbie ITP completion

The existing E2E seed created `Lot.assignedSubcontractorId`, but it did not create the newer `LotSubcontractorAssignment` row that carries `canCompleteITP`.

Effect:

- The subbie could open the assigned lot and ITP.
- The page correctly treated them as view-only because no completion permission row existed.
- This meant the automated seeded environment could not exercise the assigned-subbie ITP completion path.

Fix:

- `backend/scripts/seed-e2e.mjs` now creates an active lot subcontractor assignment with `canCompleteITP: true` and `itpRequiresVerification: true`.
- The seed now also includes a foreman user and project membership so browser QA can cover the foreman shell without manual setup.

### Added permanent coverage

Added `frontend/e2e/seeded-role-journeys.spec.ts`.

It verifies against the real seeded backend:

- Admin sees the modern lot subcontractor assignment and does not see the legacy-assignment warning.
- Assigned subbie can open the lot ITP without view-only/permission-denied messaging.
- Foreman reaches the mobile shell and sees the seeded project work summary.

This spec is intentionally not tagged `@pr-smoke`; it will run in the full E2E job.

### Browser pass result

The real browser probe found no confirmed customer-facing route failures across the visited pages.

Observed request failures were false positives from local Vite/lazy-route navigation aborts or in-flight weather requests cancelled during route changes. They did not render error boundaries, access-denied states, or missing pages.

## Verification

Passed locally:

- `npm run seed:e2e` in `backend` against disposable Postgres.
- `npx eslint scripts/seed-e2e.mjs` in `backend`.
- `npx prettier --check scripts/seed-e2e.mjs` in `backend`.
- `npm run build` in `backend`.
- `npx eslint e2e/seeded-role-journeys.spec.ts` in `frontend`.
- `npx prettier --check e2e/seeded-role-journeys.spec.ts` in `frontend`.
- `npm run type-check` in `frontend`.
- `npx playwright test e2e/seeded-role-journeys.spec.ts --project=chromium` in `frontend`.

## Next Audit Areas

Recommended next staged sweeps:

1. Real seeded mutations, not just route reachability: subbie completes ITP item, HC verifies, hold point requests/release flows, then lot conformance.
2. Reports/export generation from seeded data: diary PDF, claim evidence package, test report, docket/CSV exports.
3. Storage and signed-file access: documents, drawings, evidence links, and external hold-point evidence links.
4. Settings/invites/team lifecycle: company users, project users, subcontractor invites, role changes, and access revocation.
5. Offline/mobile pass: ITP/photo/diary/docket offline behavior on narrow viewport with network toggled.

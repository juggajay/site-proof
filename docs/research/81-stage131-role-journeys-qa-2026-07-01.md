# Stage 131 Role Journeys QA

Date: 2026-07-01  
Branch: `qa/stage131-role-journeys`  
Base: `origin/master` at `6abcdd70`

## Scope

Production-like seeded role journeys for owner/admin/foreman/subcontractor behavior, with the local backend running against a disposable Postgres database seeded by `backend/scripts/seed-e2e.mjs`.

Three read-only audit agents inspected owner/admin, foreman/mobile, and subbie/mobile surfaces. Confirmed defects were fixed in this stage; broader coverage gaps are recorded below.

## Fixed

1. Foreman mobile blocked hold point had no working path to Hold Points.
   - Root cause: `ItpRunScreen` told the foreman to use Hold Points, but `/m/hold-points` does not exist and the working route is `/projects/:projectId/hold-points`.
   - Fix: the blocked hold-point banner now has an `Open Hold Points` button that opens the existing project Hold Points register.
   - Coverage: component test plus seeded real-backend browser journey before the release/conformance test mutates the hold point.

2. Subbie mobile shell hid bootstrap access errors.
   - Root cause: `useSubbieShellData()` produced `loadError`, but `SubbieShellRoutes` always rendered child screens, allowing empty/default portal states after hard bootstrap failures.
   - Fix: route-level bootstrap error screen renders before child portal screens.
   - Coverage: provider-level unit test.

## Reviewed, Not Changed

- NCR mobile `Add photo` visibility: the audit finding was broader than the backend rule. `requireNcrEvidenceMutationAccess` allows `owner`, `admin`, `project_manager`, `site_manager`, `quality_manager`, `site_engineer`, `foreman`, the responsible user, responsible subcontractor access, or original uploader access. For the foreman shell’s intended users, always showing Add photo is not currently a confirmed backend mismatch.

## Coverage Gaps To Pick Up In Later Stages

- Real-backend owner/admin mutation journeys remain light: project team invite/role/remove, project settings module saves, company settings invite/cancel, and report schedule create/pause/delete are still mostly mocked elsewhere.
- Real-backend subbie mobile coverage should be expanded beyond classic ITP: `/p`, docs signed URL, NCR response/rectification, and docket submit using seeded rows.
- Route-segment encoding should be audited for slash-containing IDs in classic subbie ITP/docket URLs and offline ITP sync. Normal production IDs are UUID-like, so this is not currently a customer blocker, but the code should be hardened.
- Lot Photos tile in the foreman shell still navigates to `/m/photos` without preserving lot context.

## Verification

- `cd frontend && npm run type-check` passed.
- `cd frontend && npm run lint` passed with one existing warning in `src/lib/theme.tsx`.
- `cd frontend && npm run test:unit -- --run src/shell/subbie/SubbieShellRoutes.test.tsx src/shell/screens/lots/test/ItpRunScreen.test.tsx src/shell/screens/issues/test/IssueDetailScreen.test.tsx src/shell/screens/issues/test/issuesShellState.test.ts` passed: 53 tests.
- `cd backend && npm run seed:e2e` passed against the disposable Stage131 database.
- `cd frontend && npx playwright test e2e/seeded-role-journeys.spec.ts --project=chromium --reporter=list` passed: 7 tests.
- `npm run fallow:audit -- -- --format json --quiet` completed with `warn`: no dead code; inherited `ItpRunScreen` complexity and test-only duplication.

Non-blocking test noise: the seeded browser run logs a Vite client `Failed to fetch` from `HoldPointsPage` after the relevant assertions pass, likely while the page/context is closing. The test remains green and data assertions pass.

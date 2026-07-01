# Stage128 Role Depth QA - 2026-07-01

## Scope

Stage128 continued the whole-app readiness loop after Stage127 merged green. The focus was role-depth rather than broad smoke coverage: owner desktop access, foreman mobile docket direct routes, and subbie NCR/ITP return paths.

Worktree: `C:\Users\jayso\siteproof-wt\qa-stage128-role-depth`

Branch: `qa/stage128-role-depth`

Base: `origin/master` at `98a5fd84` after PR #1290.

## Local Test Environment

- Disposable Docker Postgres: `siteproof_stage128_test`.
- Backend ran locally on `http://localhost:3001`.
- Frontend Playwright web server ran through the repo Playwright config.
- E2E seed users were reset with `npm run seed:e2e`.

No production database or production user data was used.

## Parallel Read-Only Agent Findings

Three read-only agents reviewed independent slices:

- Owner desktop: confirmed the E2E seed had admin, foreman, and subcontractor users, but no real owner. Existing company settings coverage used mocked owner auth, so the owner-only billing/transfer path was a coverage gap rather than a confirmed app bug.
- Foreman mobile dockets: confirmed the `/m/dockets` shell had route coverage but direct `/m/dockets/:id/adjust` could render not-found before async docket data arrived. It also flagged later gaps around approve/reject/query action coverage and list retry UX.
- Subbie NCR/ITP: confirmed backend/classic NCR and ITP workflows are stronger than mobile shell browser coverage. It found a likely user-visible gap where returned NCR rectification feedback was stored by the backend but not shown in the subbie NCR cards.

## Confirmed Fixes

### 1. Real owner seed and browser coverage

Problem:

- The seeded real-backend role suite had no true company owner account.
- Owner-only company settings behavior was covered only by mocked Playwright routes, not by real auth/session/backend access.

Fix:

- Added `owner@example.com` to the E2E seed with `roleInCompany: owner`.
- Added owner login helpers.
- Added a real-backend browser journey proving the owner reaches company settings and sees owner-only billing, transfer ownership, team member, and company information sections.

Files:

- `backend/scripts/seed-e2e.mjs`
- `frontend/e2e/helpers.ts`
- `frontend/e2e/seeded-role-journeys.spec.ts`

### 2. Foreman mobile docket adjust direct route no longer shows false not-found

Problem:

- `AdjustHoursScreen` initialized its local labour/plant hour state from `docket` at mount.
- On a direct route, the shell can render before async docket data resolves, causing a false "This docket isn't here anymore" state or stale `0`/`0` hour inputs.

Fix:

- Added a loading state while the docket list is still resolving.
- Seeded the form fields from the docket once the matching docket id arrives.
- Added unit and browser assertions for the direct adjust route.

Files:

- `frontend/src/shell/screens/dockets/AdjustHoursScreen.tsx`
- `frontend/src/shell/screens/dockets/test/AdjustHoursScreen.test.tsx`
- `frontend/e2e/foreman-mobile-shell.spec.ts`

### 3. Returned NCR feedback is visible to subcontractors

Problem:

- The backend stores reviewer feedback for response revisions (`qmReviewComments`) and rejected rectification (`verificationNotes`).
- The classic subbie NCR page and the new subbie shell NCR screen both rendered NCR description, evidence, and actions, but not the returned feedback. A subcontractor could see "Submit Rectification" without seeing what the reviewer asked them to fix.

Fix:

- Added a shared subcontractor NCR feedback helper.
- Rendered response/rectification feedback callouts in both the classic subbie NCR card and the mobile shell NCR card.
- Passed `verificationNotes` through to the existing NCR modal adapter.
- Added regression tests for both surfaces.

Files:

- `frontend/src/pages/subcontractor-portal/ncrFeedback.ts`
- `frontend/src/pages/subcontractor-portal/SubcontractorNCRsPage.tsx`
- `frontend/src/pages/subcontractor-portal/SubcontractorNCRsPage.test.tsx`
- `frontend/src/shell/subbie/screens/NcrsScreen.tsx`
- `frontend/src/shell/subbie/screens/test/NcrsScreen.test.tsx`

## Verification

Focused unit tests:

- `npm run test:unit -- --run src/shell/screens/dockets/test/AdjustHoursScreen.test.tsx src/shell/subbie/screens/test/NcrsScreen.test.tsx src/pages/subcontractor-portal/SubcontractorNCRsPage.test.tsx`
- Result: 3 files passed, 14 tests passed.

Static checks:

- Frontend `npm run type-check`: passed.
- Frontend `npm run lint`: passed with the existing `src/lib/theme.tsx` fast-refresh warning.
- Backend `npm run lint`: passed.

Browser verification:

- `npx playwright test e2e/seeded-role-journeys.spec.ts --project=chromium --reporter=list`: 6 passed.
- `npx playwright test e2e/foreman-mobile-shell.spec.ts --project=chromium --reporter=list`: 2 passed.
- `npx playwright test e2e/subbie-mobile-shell.spec.ts --project=chromium --reporter=list`: 6 passed.

Known harness warnings during browser runs:

- Browserslist data is stale.
- A PostCSS plugin omits the `from` option.
- One seeded role run logged a transient Vite `Failed to fetch` console error from a hold-points query after assertions still passed. This was not tied to a failing user assertion, but should be watched in later browser sweeps.

## Remaining Follow-Ups

No new P0/P1 blocker was found in Stage128 after the fixes above.

Still worth closing in later loops:

- Add foreman mobile docket approve/reject/query action browser coverage beyond route load and adjust-field assertions.
- Add a retry affordance for foreman mobile docket list load errors.
- Add not-found/loading states for foreman mobile docket query and reject direct bad-id routes.
- Add subbie shell browser coverage for NCR response/rectification submission, not only unit coverage and direct route reachability.
- Add subbie shell browser coverage for rejected ITP resubmission.
- Add document versioning UI coverage or explicitly accept the missing UI affordance as a launch follow-up.
- Investigate the transient hold-points `Failed to fetch` browser-console warning if it repeats in later real-backend sweeps.

## Current Readiness Judgment

Stage128 closed three meaningful readiness gaps: true owner coverage, a foreman mobile direct-route bug, and missing subcontractor NCR feedback. The broader app is in a stronger state, but the overall readiness loop is not complete until the remaining role-depth workflows above have browser evidence or are explicitly accepted as launch follow-ups.

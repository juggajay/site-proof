# Stage 115 Final Cross-Role Rehearsal QA

Date: 2026-06-30  
Branch/worktree: `qa/stage115-final-rehearsal` in `C:\Users\jayso\siteproof-wt\qa-stage115-final-rehearsal`  
Base: `origin/master` at `4850984b fix: harden company admin access (#1274)`

## Finish Line For The Overall Loop

The loop is not finished by reaching a stage number. The practical finish line is a release-candidate gate:

1. Full connected owner/foreman/subbie/external-superintendent rehearsal passes.
2. Full browser E2E suite passes from a clean seeded state.
3. Backend API/workflow test suite passes.
4. Frontend unit/coverage suite passes.
5. Any P0/P1 issues found in the pass are fixed, merged by PR, and master CI is green.
6. Remaining items are documented as non-blocking polish, known business decisions, or future hardening.

## Scope Covered

This pass focused on proving the app as a connected product rather than isolated pages:

- Owner/admin project, lot, ITP assignment, reports, audit, company, settings, and commercial surfaces.
- Foreman mobile shell reachability and scoped project navigation.
- Subcontractor portal and mobile shell access, assigned work, ITPs, dockets, documents, and RBAC boundaries.
- External superintendent public hold-point release link.
- Hold-point release propagation into ITP completion and normal lot conformance.
- Dockets, diary, NCR, claims, documents, drawings, reports, notifications, settings, MFA, exports, onboarding, and production-readiness guardrails.

## What Happened

The first run of the real-backend seeded role journey failed at hold-point release request email delivery. Root cause was local harness configuration, not product code: the backend had been started with `EMAIL_ENABLED=false`, so the mock email provider was bypassed and the route correctly returned a delivery failure.

The local backend was restarted with mock email enabled, the disposable local E2E database was reseeded, and the same connected journey passed.

No product code changes were made in Stage 115.

## Verification Results

- Real-backend seeded cross-role browser journey:
  - `npx playwright test e2e/seeded-role-journeys.spec.ts --project=chromium --reporter=list --timeout=60000`
  - Result: 5 passed.

- Mobile shell and subcontractor portal RBAC browser sweep:
  - `npx playwright test e2e/foreman-mobile-shell.spec.ts e2e/subbie-mobile-shell.spec.ts e2e/subcontractor-portal-rbac.spec.ts --project=chromium --reporter=list`
  - Result: 14 passed.

- Heavy workflow browser sweep:
  - `npx playwright test e2e/holdpoints.spec.ts e2e/dockets.spec.ts e2e/lot-detail.spec.ts e2e/reports.spec.ts --project=chromium --reporter=list`
  - Result: 57 passed.

- Full Chromium E2E suite:
  - `npx playwright test --project=chromium --reporter=list`
  - Result: 385 passed.

- Backend API/workflow suite:
  - `npm test -- --runInBand`
  - Result: 263 test files passed, 3,635 tests passed.

- Frontend unit/coverage suite:
  - `npm run test:coverage`
  - Result: 344 test files passed, 2,919 tests passed.

## Non-Blocking Follow-Ups

These did not fail the pass, but are worth cleaning up:

- `frontend/src/pages/ncr/components/NCRActionModals.test.tsx` has a nested `vi.mock("@/hooks/useMediaQuery")` warning. Vitest currently hoists it, but says this will become an error in a future version.
- Frontend tests still emit jsdom canvas `getContext()` warnings where PDF/canvas code is exercised without a canvas implementation.
- Browserslist data is stale and should be refreshed during dependency maintenance.

## Current Readiness View

This is the strongest green pass so far for the overall app loop. The app is now past the broad release-candidate rehearsal gate from the local QA perspective.

The remaining distinction is operational rather than code-level: production still needs normal ongoing monitoring, backups/restore confidence, and real-user pilot observation. From this Stage 115 pass, there are no newly discovered P0/P1 product bugs waiting on fixes.

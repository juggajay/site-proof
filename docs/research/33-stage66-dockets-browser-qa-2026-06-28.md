# Stage 66 Dockets Browser QA

Date: 2026-06-28  
Branch: `qa/stage66-dockets-qa`  
Focus: subcontractor dockets, foreman/PM approval permissions, commercial totals, and lot scoping.

## Scope

- Read current docket implementation across backend routes, classic subbie portal, mobile subbie shell, foreman mobile shell, and desktop approvals.
- Rechecked prior docket audit notes against current `origin/master`.
- Ran targeted browser coverage for `/p/work` and `/p/docket` direct mobile shell routes.
- Used two read-only side agents to scan for docket workflow gaps while the main pass verified and fixed confirmed issues.

## Fixed In This Stage

1. Mobile subbie docket lot picker now scopes assigned lots by selected subcontractor company.
   - Before: `/p/docket` called assigned lots with only `projectId`.
   - Risk: multi-company subbies could see wrong lots or hit a late API 403 when saving.
   - Fix: pass `company.id` to `useAssignedLotsQuery`, matching classic `DocketEditPage`.

2. Docket history load failures now show errors instead of empty states.
   - Classic subbie portal and mobile shell list screens no longer display "No dockets yet" when the dockets API fails.
   - This avoids making a load failure look like lost or missing commercial records.

3. Quality Manager docket approval UI now matches backend permissions.
   - Backend already includes `quality_manager` in `DOCKET_APPROVERS`.
   - Frontend approval helper now includes `quality_manager` too.

4. Rejected dockets no longer get approval metadata.
   - Reject previously wrote `approvedById` and `approvedAt`.
   - This could make details/exports read like a rejected docket had been approved.
   - Reject now clears approval metadata instead.

5. API submission guard now requires every labour row to have a lot allocation.
   - Previously one allocated labour row was enough for the whole docket.
   - Lot-level cost and evidence rollups depend on every labour entry being scoped to a lot.

## Browser Coverage Added

- `frontend/e2e/subbie-mobile-shell.spec.ts`
  - Adds `/p/docket?projectId=...&subcontractorCompanyId=...` mobile route coverage.
  - Verifies the actual `/api/lots` request includes both `projectId` and `subcontractorCompanyId`.

## Verification

Passed:

- `frontend`: targeted docket unit tests, 33 passed.
- `frontend`: `npm run test:e2e -- e2e/subbie-mobile-shell.spec.ts --project=chromium`, 3 passed.
- `frontend`: `npm run format:check`
- `frontend`: `npm run lint` (existing `theme.tsx` fast-refresh warning only)
- `frontend`: `npm run type-check`
- `backend`: `npm run test -- src/routes/dockets/submissionGuards.test.ts`, 7 passed.
- `backend`: `npm run format:check`
- `backend`: `npm run lint` (existing `dataRetention.test.ts` unused-disable warning only)
- `backend`: `npm run type-check`

Could not run locally:

- `backend`: full `src/routes/dockets.test.ts` needs a configured `DATABASE_URL` in this fresh worktree. The new rejection assertion is in that file and should run in CI.

## Deferred Follow-Up

- Plant entries still have no UI path for lot allocation even though the schema has plant-lot allocation support. This needs a product/data-contract decision, not a one-line fix.
- Plant approved hours are represented by approved cost only; per-entry plant hours still display submitted hours. A clean fix likely needs an `approvedHours`-style field for plant or an explicit derived display contract.
- Dashboard cost trend still includes pending dockets and submitted totals. Project cost pages already use approved-cost fallback correctly. Decide whether trend should show forecast/submitted costs or approved commercial actuals.
- Overnight labour spans are currently supported by both frontend and backend math. Confirm whether night-shift wrapping is intentional or whether start-after-finish should require an explicit overnight marker.
- Offline docket helpers exist, but active docket screens are intentionally online-only. Keep marketing/help copy narrow unless the helper path is wired into the UI.

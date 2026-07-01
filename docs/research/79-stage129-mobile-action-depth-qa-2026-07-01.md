# Stage129 Mobile Action Depth QA — 2026-07-01

Branch: `qa/stage129-mobile-action-depth`
Base: `origin/master` at `822d9f8c` (Stage128 merged)

## Scope

This pass targeted mobile action workflows that were still thin after the earlier role-depth sweep:

- Foreman mobile docket direct action routes and adjusted approval.
- Subbie mobile NCR rectification evidence upload and submit-for-verification.
- Subbie mobile rejected ITP resubmission.

The aim was not another broad read-only screen crawl. It was to prove that action screens send the right payloads, avoid stale or invalid states, and remain scoped to the selected project/subcontractor context.

## Findings Fixed

### 1. Foreman docket action deep links could expose invalid forms

Screens:

- `frontend/src/shell/screens/dockets/QueryFormScreen.tsx`
- `frontend/src/shell/screens/dockets/RejectFormScreen.tsx`
- `frontend/src/shell/screens/dockets/AdjustHoursScreen.tsx`

Problem:

Direct action URLs could render a form while docket data was still loading, and could still show action controls when a docket was no longer `pending_approval`. That created a poor mobile state and could drive users into backend 400s on stale deep links.

Fix:

- Added shared `DocketActionState` loading/missing/non-pending states.
- Blocked query/reject/adjust submit unless the docket is still `pending_approval`.
- Added focused unit coverage for loading, missing, and non-pending states.
- Added browser coverage for adjusted approval payload.

### 2. Subbie NCR rectification upload did not refresh the shell after evidence link

Files:

- `frontend/src/pages/ncr/components/RectifyNCRModal.tsx`
- `frontend/src/shell/subbie/screens/NcrsScreen.tsx`

Problem:

The shared rectification modal updated local uploaded-file state after upload/link, but the subbie shell's NCR data stayed stale until final submit. A user could successfully upload evidence, but the surrounding screen would not pick it up immediately.

Fix:

- Added an optional `onEvidenceUploaded` callback to `RectifyNCRModal`.
- The subbie NCR shell now refetches NCRs after each successful evidence link.
- Added unit coverage for upload, link, immediate refetch, and submit-for-verification.
- Added browser coverage for the same mobile flow.

## Coverage Added

### Unit

- `frontend/src/shell/screens/dockets/test/ReasonFormScreens.test.tsx`
- `frontend/src/shell/screens/dockets/test/AdjustHoursScreen.test.tsx`
- `frontend/src/shell/subbie/screens/test/NcrsScreen.test.tsx`

Existing ITP unit coverage was also rerun:

- `frontend/src/shell/subbie/screens/test/SubbieItpRunScreen.test.tsx`
- `frontend/src/shell/subbie/screens/test/useSubbieItpRun.test.tsx`

### Browser

- `frontend/e2e/foreman-mobile-shell.spec.ts`
  - Added adjusted docket approval from `/m/dockets/:id/adjust`.
  - Proves changed hours require a reason and POST the expected approve payload.

- `frontend/e2e/subbie-mobile-shell.spec.ts`
  - Added subbie NCR rectification evidence upload/link/submit.
  - Added rejected ITP item resubmission from `/p/lots/:id/itp`.

## Verification

Passed:

- `npm run type-check`
- `npm run lint`
  - Existing warning only: `src/lib/theme.tsx` fast-refresh export warning.
- `npm run test:unit -- --run src/shell/subbie/screens/test/NcrsScreen.test.tsx src/shell/screens/dockets/test/ReasonFormScreens.test.tsx src/shell/screens/dockets/test/AdjustHoursScreen.test.tsx src/shell/subbie/screens/test/SubbieItpRunScreen.test.tsx src/shell/subbie/screens/test/useSubbieItpRun.test.tsx`
  - 5 files, 37 tests passed.
- `npx playwright test e2e/foreman-mobile-shell.spec.ts --project=chromium --reporter=list`
  - 3 tests passed.
- `npx playwright test e2e/subbie-mobile-shell.spec.ts --project=chromium --reporter=list`
  - 8 tests passed.

Observed non-blocking warnings:

- Browserslist data is stale.
- A PostCSS plugin warning about missing `from` option appears during Playwright web-server startup.

## Remaining Overall Loop Work

The overall app QA loop is not complete yet. Stage129 closes several mobile action gaps, but the remaining finish line still includes:

- Owner/admin production-like browser journeys.
- Magic login and auth edge cases.
- Report/PDF generation paths.
- Permission denial and cross-company access checks through browser flows.
- Offline/online boundary checks for dockets, diary, photos, and ITP evidence.
- Production canary checks after merge.

Stage129 should be treated as one completed slice of the launch-readiness loop, not the end of the full loop.

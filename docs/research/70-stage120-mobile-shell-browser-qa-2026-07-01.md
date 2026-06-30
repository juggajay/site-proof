# Stage 120 Mobile Shell Browser QA

Date: 2026-07-01 Australia/Sydney
Stage owner: Codex
Branch: `qa/stage120-mobile-shell`
Base: `4a1164e3 docs: record stage 119 endpoint coverage map (#1281)`

## Scope

Stage 120 targeted the highest-priority Stage 119 browser gap: direct mobile shell
navigation for foreman and subcontractor paths.

Covered surfaces:

- Foreman shell `/m/*`
- Subcontractor shell `/p/*`
- Mobile classic subcontractor deep links that should redirect into `/p/*`

This stage changed tests only. No production app code was changed.

## What Changed

Added direct browser coverage to `frontend/e2e/foreman-mobile-shell.spec.ts` for:

- `/m/diary/weather`
- `/m/diary/crew`
- `/m/diary/work`
- `/m/diary/work/activity`
- `/m/diary/work/delay`
- `/m/diary/work/delivery`
- `/m/diary/work/event`
- `/m/diary/review`
- `/m/diary/done?queued=1`
- `/m/lots/:lotId`
- `/m/lots/:lotId/details`
- `/m/lots/:lotId/itp`
- `/m/dockets/:docketId`
- `/m/dockets/:docketId/adjust`
- `/m/dockets/:docketId/query`
- `/m/dockets/:docketId/reject`
- `/m/issues/:ncrId`
- `/m/photos/:documentId`

Added direct browser coverage to `frontend/e2e/subbie-mobile-shell.spec.ts` for:

- `/p`
- `/p/dockets`
- `/p/docket/:docketId`
- `/p/itps`
- `/p/lots/:lotId/itp`
- `/p/quality`
- `/p/ncrs`
- `/p/docs`
- `/p/company`

Added mobile classic-to-shell redirect coverage for:

- `/subcontractor-portal/tests` -> `/p/quality`
- `/subcontractor-portal/holdpoints` -> `/p/quality`
- `/subcontractor-portal/ncrs` -> `/p/ncrs`
- `/subcontractor-portal/documents` -> `/p/docs`
- `/subcontractor-portal/lots/:lotId/itp` -> `/p/lots/:lotId/itp`
- `/my-company` -> `/p/company`

The expanded subbie shell fixture now includes realistic mocked lot, ITP,
docket, hold point, test result, NCR, document, employee, and plant data. That
lets the browser prove the nested routes render real screens instead of only
empty states.

## Results

Confirmed:

- Foreman nested `/m/*` deep links preserve `projectId` and render the intended
  shell screen.
- Foreman direct ITP, docket adjust/query/reject, NCR, photo, and diary subform
  paths do not throw console errors or page errors under the mocked full API
  fixture.
- Subbie nested `/p/*` direct links preserve `projectId` and
  `subcontractorCompanyId`.
- Subbie ITP, quality, NCR, documents, company, docket detail, and docket list
  routes render actual shell content.
- Classic subbie mobile deep links redirect to the matching `/p/*` route while
  preserving project and company scope.

No app bug was found in this stage.

## Verification

Passed:

```powershell
cd frontend
npm run test:e2e -- e2e/foreman-mobile-shell.spec.ts e2e/subbie-mobile-shell.spec.ts --project=chromium --reporter=list
```

Result: 7 passed.

Passed:

```powershell
cd frontend
npm run format:check
```

Passed:

```powershell
cd frontend
npm run type-check
```

Passed with existing warning only:

```powershell
cd frontend
npm run lint
```

Existing warning:

- `frontend/src/lib/theme.tsx`: `react-refresh/only-export-components`

Local browser run warnings, existing/non-blocking:

- Browserslist data is stale.
- A PostCSS plugin warning says the plugin did not pass the `from` option.

Attempted but not completed locally:

- Real-backend `seeded-role-journeys.spec.ts` run.

Reason:

- Docker is unavailable in this environment.
- A local Postgres process is listening, but Prisma could not download/check its
  Windows engines because certificate verification failed against
  `binaries.prisma.sh`.
- TLS was not weakened to force the tool download.

CI remains the authoritative real-backend gate for this PR.

## Follow-Up Notes

Worth adding later:

- A true seeded `owner` user in `backend/scripts/seed-e2e.mjs`. Current seeded
  real-backend users cover admin/project-manager, foreman, and subcontractor,
  but not a literal owner account.
- A small maintenance ticket for the stale Browserslist data.
- A small maintenance ticket to identify the PostCSS plugin producing the
  missing `from` warning.

## Stage 120 Status

Passed for the mobile shell browser coverage slice.

The overall app loop is still active. The next recommended stage is Stage 121:
hold point, docket, and ITP branch pass.

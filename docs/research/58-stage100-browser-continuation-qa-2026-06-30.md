# Stage 100 Browser Continuation QA

Date: 2026-06-30
Branch: `qa/stage100-browser-continuation`
Baseline: `439e4db0 fix: preserve hold point release identity (#1259)`

## Browser Runs

Owner/admin browser group:

- Command:
  `npx playwright test e2e/projects.spec.ts e2e/project-settings.spec.ts e2e/project-areas.spec.ts e2e/project-users.spec.ts e2e/subcontractors.spec.ts e2e/lots.spec.ts e2e/itp.spec.ts e2e/documents.spec.ts e2e/reports.spec.ts --project=chromium`
- Result: 81 passed.

Field/workflow browser group:

- Command:
  `npx playwright test e2e/lot-detail.spec.ts e2e/holdpoints.spec.ts e2e/diary.spec.ts e2e/dockets.spec.ts e2e/ncr.spec.ts e2e/test-results.spec.ts e2e/seeded-role-journeys.spec.ts e2e/foreman-mobile-shell.spec.ts e2e/subbie-mobile-shell.spec.ts e2e/subcontractor-docket-reachability.spec.ts --project=chromium`
- First run result: 62 passed, 1 failed, 4 did not run.
- Root cause: `seeded-role-journeys.spec.ts` is a real-backend spec, but the
  grouped run only had the frontend Playwright web server. The login page showed
  `Failed to fetch` because the backend was not running.

Real-backend seeded role journey:

- Setup:
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_e2e`
  - `NODE_ENV=e2e`
  - `npm run db:generate`
  - `npx prisma migrate deploy`
  - `npm run seed:e2e`
  - backend started on `http://localhost:3001`
- Command:
  `npm run test:e2e -- e2e/seeded-role-journeys.spec.ts --project=chromium --reporter=list`
- Result: 5 passed.
- Conclusion: the earlier failure was a local harness setup issue, not a product
  failure.

Account, commercial, and register browser group:

- Command:
  `npx playwright test e2e/audit-log.spec.ts e2e/auth.spec.ts e2e/claims.spec.ts e2e/company-settings.spec.ts e2e/costs.spec.ts e2e/csv.spec.ts e2e/dashboard.spec.ts e2e/delay-register.spec.ts e2e/documentation.spec.ts e2e/downloads.spec.ts e2e/drawings.spec.ts e2e/error-handling.spec.ts --project=chromium --reporter=list`
- Result: 91 passed.

Remaining account, support, RBAC, and production-readiness browser group:

- Command:
  `npx playwright test e2e/global-search.spec.ts e2e/header-notifications.spec.ts e2e/not-found.spec.ts e2e/onboarding.spec.ts e2e/portfolio.spec.ts e2e/profile.spec.ts e2e/settings.spec.ts e2e/subcontractor-documents.spec.ts e2e/subcontractor-portal-rbac.spec.ts e2e/support.spec.ts e2e/productionReadiness.spec.ts --project=chromium --reporter=list`
- Result: 129 passed.

Whole existing Chromium Playwright surface:

- Every existing `frontend/e2e/*.spec.ts` file has now been exercised in this
  continuation pass.
- Playwright lists 368 runnable Chromium tests across 42 files.
- Total result across grouped runs: 368 passing checks.
- Caveat: `seeded-role-journeys.spec.ts` must be run with the real local backend
  and seeded E2E database. Running it inside the mocked frontend-only browser
  group creates a harness failure (`Failed to fetch` at login), not a product
  failure.

## Coverage Scout Findings

Existing browser coverage is broad, but the route-to-browser map still shows
important gaps:

- Owner/admin: metrics, company logo file route, webhook delivery/test/history.
- Projects: project audit-log deep link and project delete/archive flow.
- Lots: bulk status update, bulk subcontractor assignment, bulk delete,
  direct assignment PATCH/DELETE, subcontractor `mine` assignment view, status
  override.
- ITP: template detail/delete/archive/restore/propagate, completion PATCH,
  verify/reject, pending verifications, attachment GET/DELETE.
- Subcontractors: ABN validation, portal-access readback, employee/plant status
  updates, my-company roster deletion.
- Documents: direct file route, public download validation, classification save,
  document version upload/list.
- Reports: `/api/reports/summary`.
- Dockets: submit, reject, respond/resubmit, labour CRUD, plant update/delete.
- NCR: analytics, detail PATCH, evidence list/delete, QM review, rectify,
  reject rectification, close, notify client, reopen, submit-for-verification.
- Diary: entry-by-id, previous personnel/plant copy, deliveries/events/personnel
  and visitors CRUD, validation, reopen, recent-plant/activity suggestions.
- Hold points: evidence package, notification-time calculation, working-hours,
  preview evidence package, escalate/resolve escalation.

## New Coverage Added In This Pass

Dockets:

- Extended `frontend/e2e/dockets.spec.ts` from 12 to 15 runnable Chromium tests.
- Added browser coverage for:
  - rejecting a pending docket with a required rejection reason
  - querying a pending docket with a required foreman question
  - subcontractor seeing a rejected docket reason and resubmitting it
  - subcontractor responding to a queried docket and resubmitting it
- Verification:
  `npx playwright test e2e/dockets.spec.ts --project=chromium --reporter=list`
  passed 15/15.

Remaining docket notes:

- Plant update has a backend route but no current visible edit affordance, so it
  is not a browser-testable user flow yet.
- The classic subcontractor docket delete controls use icon-only buttons without
  explicit accessible labels. Browser tests can still target them structurally,
  but the product should label them before relying on them as stable user-facing
  controls.

## Deeper Scout Results

NCR:

- Current browser coverage exercises the register, filter, respond, QM approve,
  load retry, duplicate QM approve guard, and create deep link.
- Follow-up coverage added in PR branch `qa/ncr-lifecycle-browser-coverage`:
  - QM review accept flow from an investigating NCR into rectification
  - client notification modal and payload for a major NCR
  - major NCR close modal and payload after QM approval/client notification
  - quieter responsible-party option mocks for the create-dialog path
- Verification:
  `npx playwright test e2e/ncr.spec.ts --project=chromium --reporter=list`
  passed 5/5.
- Thin or missing browser coverage remains for:
  - NCR detail GET and assignment PATCH
  - evidence list/delete
  - QM review request-revision branch
  - rectification with evidence upload/link and submit-for-verification
  - reject rectification and resubmit
  - close with concession
  - reopen
- Reopen currently has a backend route but no visible frontend action, so this
  is a product/UI gap rather than just a missing browser test.

Documents and ITP:

- Documents browser coverage handles list/filter/upload/favourite/preview/
  download/delete with mocked signed-url responses.
- Missing user-facing browser coverage remains for classification save from the
  AI classification modal.
- Document version upload/list routes exist, but no current UI route/component
  was found. Treat this like a UI decision before adding Playwright coverage.
- ITP browser coverage handles templates and lot checklist completion/attachment
  POST.
- Follow-up coverage added in PR branch
  `qa/itp-verification-browser-coverage`:
  - head-contractor reviewer verifies a pending ITP completion
  - head-contractor reviewer rejects a pending ITP completion with a required
    reason
  - pending verification disables the ordinary checklist checkbox and removes
    review buttons after terminal review
- Verification:
  `npx playwright test e2e/lot-detail.spec.ts --project=chromium --reporter=list`
  passed 14/14 on rerun. A first full-spec run had a transient empty-app-shell
  first-load miss before the new tests; rerun was clean.
- Missing user-facing browser coverage remains for ITP completion PATCH,
  positive attachment GET/DELETE, and template archive/restore/propagate.
- Template archive/restore/propagate also does not appear UI-reachable today.

## Observations

- Mocked browser tests intentionally exercise 403/500/503 paths and emit
  console errors. These are expected for the current specs.
- The Playwright/Vite runs still warn about stale Browserslist data and a
  PostCSS plugin missing the `from` option. These are tooling cleanup items.
- Some mocked specs log unhandled route noise, such as
  `/api/itp/pending-verifications` and diary timeline/docket-summary endpoints.
  The tests still pass, but route mocks should eventually cover these requests
  so console noise does not hide real failures.
- The full existing browser suite is now green on Chromium when real-backend
  seeded specs are run with their required backend setup.

## Next Suggested Slice

Continue filling the highest-value browser gaps from the scout map:

1. NCR desktop lifecycle through request-revision, rectification/evidence,
   submit for verification, reject rectification, resubmit, and concession close.
2. Document classification save from the lot photo/ITP evidence flow.
3. Diary copy/reopen/entry CRUD.
4. ITP completion PATCH and positive attachment GET/DELETE if those flows are
   visible to users.
5. Decide whether document versions and ITP template archive/restore/propagate
   are intended user-facing features. If yes, wire UI before browser coverage;
   if no, keep them API-only and add backend success coverage where thin.

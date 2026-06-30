# Stage 123 Reports and Exports QA - 2026-07-01

## Scope

Stage 123 covered the reports and exports surface:

- Reports page browser flow across lot status, test results, diary, claims, scheduled reports, and scheduled artifact downloads.
- Backend report generation for scheduled report delivery, retry behavior, and claim report timezone formatting.
- Print/export behavior for report pages.
- Scheduled report failure and reactivation handling.

This stage started from `origin/master` at `14fb6ef8` after Stage 122 merged.

## Explorer Findings

Three read-only explorer agents inspected different slices of the reports/export area.

- Reports API explorer found that claim report date presentation and monthly buckets still used UTC/server dates even though report filtering uses the project timezone.
- Scheduled reports explorer found that scheduled report artifact upload was not crash-idempotent: if object storage succeeded but DB metadata persistence failed, a retry could generate different bytes and fail to adopt the existing object.
- Scheduled reports explorer found that reactivating a paused failed schedule did not cancel old retryable runs.
- Frontend reports explorer found that diary print/export included the filter controls, and print timestamps were computed once at page load rather than when printing.
- Frontend reports explorer found that test type filter buttons were derived from the current filtered result, so a narrowed API response could hide other valid test-type filters.

## Fixes Applied

- Added project-timezone date string helpers in `backend/src/lib/projectTimeZone.ts`.
- Updated claim reports to format claim dates and monthly breakdown keys in the project timezone.
- Made scheduled report artifact storage adopt an existing owned artifact path by reading the stored bytes and persisting metadata from those bytes.
- Reused the original run `generatedAt` timestamp when rebuilding a scheduled report artifact for retry.
- Ensured adopted stored artifact bytes are the bytes attached to the retry email.
- Cancelled incomplete/retryable scheduled report runs when a disabled schedule is reactivated.
- Hid diary report filter controls under print media.
- Refreshed the printed timestamp immediately before `window.print()`, with a `beforeprint` fallback.
- Preserved known test type filters after a narrowed test-results response.

## Verification

Backend:

- `npm run db:deploy` against local disposable `siteproof_stage123_test`: passed.
- `npm test -- --run src/lib/scheduledReports.test.ts src/routes/reports.test.ts`: passed, 113 tests.
- `npm run format:check`: passed.
- `npm run type-check`: passed.
- `npm run lint`: passed.

Frontend:

- `npx playwright test e2e/reports.spec.ts --project=chromium --reporter=list`: passed, 15 tests.
- `npm run format:check`: passed.
- `npm run type-check`: passed.
- `npm run lint`: passed with one pre-existing warning in `frontend/src/lib/theme.tsx`.

Repo:

- `git diff --check`: passed.

## Remaining Follow-Ups

- Reports endpoints that can generate large all-history exports should get pagination/capping review in a later scale pass.
- Scheduled report cadence still sends all-history snapshots; product may want weekly/monthly periods to constrain the generated period automatically.
- Claims scheduling remains unavailable in the UI by design today; treat as a product gap rather than a bug.
- The known antivirus-affected research doc deletion was left unstaged and is unrelated to this stage.

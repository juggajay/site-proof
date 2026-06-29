# Stage 85 - Scheduled Report Artifact Immutability QA

Date: 2026-06-30
Branch: `qa/stage85-scheduled-report-artifacts`

## Scope

Follow-up from Stage 84 scheduled-report visibility. The issue was that partial delivery retries rebuilt the scheduled report PDF from live database state. That meant the first recipient and a retried recipient could receive different PDFs for the same `ScheduledReportRun`.

## Change

- Added immutable artifact metadata to `scheduled_report_runs`.
- Stored each generated scheduled-report PDF once per run.
- Reused the stored PDF for retry delivery instead of rebuilding from live report data.
- Changed scheduled-report email and digest links to a run-scoped frontend artifact route.
- Added authenticated backend download route:
  - `GET /api/reports/scheduled-runs/:runId/artifact`
- Added frontend downloader route:
  - `/reports/scheduled-runs/:runId/artifact`

## Access Model

Schedule management remains restricted to schedule managers. Artifact download uses normal internal project report access so valid internal digest recipients can open the report without needing schedule-management permission. Outsiders, pending project users, and subcontractor roles remain denied by the backend.

## Verification

Local checks completed:

- `npm run db:generate` (backend)
- `DATABASE_URL=postgresql://user:pass@localhost:5432/siteproof_validate npx prisma validate` (backend)
- `npm run type-check` (backend)
- `npm run type-check` (frontend)
- `npm run lint` (backend)
- `npm run lint` (frontend) - passed with existing `theme.tsx` Fast Refresh warning only
- `npm run test -- src/routes/reports/scheduleRoutes.test.ts` (backend)
- `npm run test:unit -- src/pages/reports/ScheduledReportArtifactPage.test.tsx` (frontend)
- `git diff --check`

Local DB-backed tests attempted but blocked because this shell has no `DATABASE_URL`:

- `npm run test -- src/lib/scheduledReports.test.ts`
- `npm run test -- src/routes/reports.test.ts`

Those suites should run in GitHub CI, where the test database environment is configured.

## Follow-Up

Watch CI for the DB-backed scheduled-report and reports route tests. If either fails, fix in this PR before merging.

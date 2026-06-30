# Stage 109 Reports / Exports QA

Date: 2026-06-30
Branch: `qa/reports-exports`
Baseline: `520de7d8 fix: harden document version register (#1268)`

## Scope

Focused audit slice for reports and export artifacts:

- Backend report APIs: test results, diary, claims, scheduled report artifacts.
- Frontend reports page: filter controls, refresh action, print header, scheduled artifact download route.
- Claim evidence package payload/PDF manifest.

Three read-only subagents reviewed backend report APIs, frontend report UX, and generated artifact correctness.

## Findings Fixed

1. Backend date-only report filters used server timezone boundaries.
   - A QLD project querying `startDate=2026-05-01&endDate=2026-05-01` could include records from the next Brisbane calendar day.
   - Fixed date-only parsing for Test Results, Diary, and Claims reports to resolve start/end-of-day in the project's local timezone from project state.

2. Reports page top-level refresh dropped active tab filters.
   - Test, Diary, and Claims filter controls lived inside tab components, while the page Refresh button called the report API with no filter params.
   - Fixed by tracking current filter params in `ReportsPage` and using them for top-level refresh.

3. Scheduled artifact page treated any HTTP 200 blob as a successful PDF download.
   - A `200 application/json` or empty PDF response could show "download started".
   - Fixed by requiring a non-empty `application/pdf` response and surfacing JSON error messages.

4. Claim evidence packages omitted ITP attachment document identity.
   - The backend counted ITP completion attachments but did not return their document metadata, so the PDF manifest could not identify evidence attached only to checklist completions.
   - Fixed by returning non-sensitive attachment document metadata and deduping those documents into the PDF evidence manifest.

5. Claim evidence PDF rendered raw/truncated status labels.
   - Fixed the PDF to use readable status labels in the claim summary, lot summary, and lot details.

## Verification

- Backend:
  - `npm run db:deploy` against local `siteproof_test` to bring the test database up to the current migration set.
  - `npm test -- src/lib/projectTimeZone.test.ts src/routes/reports.test.ts`
  - `npm test -- src/routes/claims.test.ts`
  - `npm run type-check`
  - `npm run lint`

- Frontend:
  - `npm run test:unit -- src/pages/reports/ReportsPage.test.tsx src/pages/reports/ScheduledReportArtifactPage.test.tsx src/lib/pdf/__tests__/pdfGenerator.characterization.test.ts`
  - `npm run test:e2e -- e2e/reports.spec.ts --project=chromium --reporter=list`
  - `npm run type-check`
  - `npm run lint`

Frontend lint passed with the existing `src/lib/theme.tsx` fast-refresh warning.

## Deferred Findings

Valid findings intentionally left out of this PR:

- Claims report backend still loads all matching claims and nested claimed lots in memory. It needs pagination, streaming, or an async export job before very large customer datasets.
- Account data export still includes broad unbounded collections and raw file locator fields in some places. Needs a privacy/export hardening pass.
- NCR analytics access may be broader than intended for report-style data. Needs product role decision and viewer/site-engineer tests.
- Some report payloads expose emails where display names may be enough. Needs a PII minimization pass by role.
- Scheduled artifact backend security has thin negative unit coverage for bad paths, bad hashes, unsafe filenames, missing files, and oversized artifacts.
- Hold Points and Test Results page CSV exports should export filtered visible rows, not the raw full client collection.
- Scheduled report PDFs intentionally cap detail rows at 50; either generate complete artifacts or label the artifact clearly as a summary/sample.
- Lot-status and NCR report period summaries still use server-side month boundary logic. This is lower risk than explicit date filters but should be aligned with project timezone in a later pass.

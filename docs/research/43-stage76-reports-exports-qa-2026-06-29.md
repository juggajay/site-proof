# Stage 76 Reports and Exports QA - 2026-06-29

## Scope

Focused audit of report views, report filters, generated PDFs, and export flows:

- Lot conformance PDF generation, including ITP completion progress and hold point release rows.
- NCR detail PDF generation from the NCR list actions.
- Reports page tabs for lot status, test results, diary, and claims.
- Browser-backed reports E2E coverage for filters, scheduling controls, retry states, and mobile header behavior.

Stage numbering note: any "stage 14/15" wording from older local notes or subagent scratch output is not the live QA sequence. The live sequence is Stage 76, following Stage 75 NCR lifecycle QA.

## Fixes Made

- Fixed conformance PDFs so ITP rows match completions by checklist item ID first, with the older order-based fallback retained for legacy data.
- Fixed conformance PDF progress so completed N/A items count as accepted and empty ITP templates show `0%` instead of `NaN%`.
- Fixed conformance PDF hold point release timestamps so missing or malformed release times print `Not recorded` instead of `Invalid Date`.
- Fixed NCR detail PDF generation from the NCR table so it receives the real response, closure, responsible subcontractor, and evidence data instead of a flattened partial payload.
- Added an NCR detail PDF data adapter that deliberately strips raw evidence storage URLs from PDF data while keeping document filenames, MIME type, upload date, and evidence type.
- Expanded NCR detail PDFs to include root-cause category, verification notes, responsible subcontractor fallback, and an evidence register.
- Added date-range validation to Test Results, Diary, and Claims reports so inverted ranges cannot generate misleading output.
- Improved Test Results and Diary report date filter layout on narrow mobile screens.
- Removed the duplicate local Test Results print/export button, leaving the Reports page global action as the single PDF/export command.
- Added empty states for Lot Status and Claims report detail tables.

## Verification

- Frontend targeted tests:
  - `npm run test:unit -- src/pages/ncr/ncrDetailPdfData.test.ts src/lib/pdf/__tests__/pdfGenerator.characterization.test.ts src/lib/pdf/__tests__/conformanceReportPdf.test.ts src/pages/reports/components/ReportDetailPaginationCaption.test.tsx`
  - Result: 22 passed.
- Frontend type check:
  - `npm run type-check`
  - Result: passed.
- Reports browser-backed E2E:
  - `npm run test:e2e -- e2e/reports.spec.ts --project=chromium`
  - Result: 9 passed.
- Fallow:
  - `npm run fallow:audit -- -- --format json --quiet`
  - Result: warn, with no introduced complexity and no dead code. Remaining warnings are inherited PDF/report duplication and large-function debt.

## Deferred Findings

- Claims report/export backend payloads are still broad and should be bounded before heavy production use.
- Report date parsing still uses server `Date` behavior instead of project-local day boundaries; this needs a backend pass that threads project timezone through report query parsing.
- Report pagination should cap very large offsets instead of accepting arbitrary offsets.
- NCR report summaries still load broader closed/responsible row sets than the visible page requires.
- Scheduled report list responses expose recipient email addresses to users who can manage schedules; this is functionally expected today but should be reviewed as privacy hardening.
- Dashboard reports quick links can race project loading and briefly route through `/projects`; this needs a navigation/loading-state pass.
- Basic-tier PM report upsell currently targets a settings route that can be access denied for some users.
- Audit log loading copy can imply an empty result while data is still loading.
- NCR CSV filenames still include the raw project ID; prefer a project number or slug for exported filenames.
- The PDF subsystem has inherited large functions and duplicated page setup across PDF generators. This stage avoided a broad PDF refactor to keep the bugfix PR reviewable.

## Next Suggested Area

Stage 77 should move into project setup/admin settings and cross-company access edges: company settings, project membership changes, role-scoped invitations, plan gates, and account switching behavior.

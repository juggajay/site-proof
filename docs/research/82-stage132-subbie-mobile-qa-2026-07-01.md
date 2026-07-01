# Stage132 Subbie Mobile QA — 2026-07-01

## Scope

Stage132 focused on the subcontractor mobile shell and the classic subbie paths it reuses:

- `/p` mobile shell real-backend navigation.
- Classic subbie ITP and docket route hardening.
- Offline ITP sync path handling.
- Lot-scoped photo navigation from the foreman mobile lot hub.
- Assigned-work visibility after lots move into later lifecycle statuses.

Three audit agents reviewed subbie mobile, owner/admin mutations, and route/photo hardening. This stage fixed the subbie/mobile findings with direct user impact and logged the wider owner/admin follow-ups below.

## Fixes Shipped In This Stage

1. **Subbie/classic route path IDs are now encoded.**
   - Classic ITP lot links and fetches now encode lot IDs before placing them in path segments.
   - Classic docket edit fetch/mutation routes now use shared encoded path builders.
   - Offline ITP completion sync now encodes the lot ID before lookup.
   - Risk removed: IDs containing `/`, spaces, or reserved URL characters could call the wrong route or fail.

2. **Subbie mobile ITP no longer hides access/server failures.**
   - `/p/lots/:lotId/itp` still treats a 404 as “no ITP assigned”.
   - 403/500 and other failures now surface as a load error instead of silently rendering “No ITP is assigned”.
   - Risk removed: rare “access denied” or backend failures could look like missing work.

3. **Foreman lot hub Photos now preserves lot context.**
   - The lot hub Photos tile now opens `/m/photos?projectId=...&lotId=...`.
   - The photos list honours the lot filter and hides unrelated/unfiled photos in lot-scoped mode.
   - Photo detail back navigation preserves the same lot context.
   - Risk removed: “Photos on this lot” previously opened the generic photo grid.

4. **Assigned Work no longer drops later-status lots.**
   - Classic and mobile subbie assigned-work screens now share one status-grouping helper.
   - `conformed` and `claimed` show under Completed.
   - `hold_point` and `ncr_raised` show under On Hold/attention.
   - `awaiting_test` shows under In Progress.
   - Unknown future statuses stay visible under Other with human-readable labels.
   - Risk removed: a subbie could see “2 lots” in the header with a blank list after those lots moved to later statuses.

5. **Real-backend subbie mobile smoke added.**
   - The seeded role journey suite now covers `/p`, `/p/work`, `/p/itps`, `/p/lots/:id/itp`, `/p/quality`, `/p/dockets`, and `/p/docs` with the real backend.

## Verification

- `npm run test:unit -- --run ...affected files`
  - 8 files, 127 tests passed.
- `npx playwright test e2e/seeded-role-journeys.spec.ts --project=chromium --reporter=list`
  - 8/8 passed against the disposable Stage132 database.
- `npm run type-check`
  - Passed.
- `npm run lint`
  - Passed with one existing warning in `frontend/src/lib/theme.tsx`.
- `npm run fallow:audit -- -- --format json --quiet`
  - Warn only.
  - No dead code introduced.
  - No new complexity findings after extracting assigned-work status grouping.
  - Remaining introduced duplication warning is advisory and mostly reflects parity/overlap with older large classic/mobile screens.

## Follow-Ups

High-value next sweeps:

- Owner/admin real-backend mutation journey:
  - Project team invite/change/remove.
  - Scheduled report create/delete.
  - Project modules/settings real-backend checks.
- Subbie mobile deeper data coverage:
  - Seed approved employee/plant rows and test `/p/docket` create/edit/submit against the real backend.
  - Add seeded docs, test results, NCRs, and multi-subco scope rows to cover `/p/docs`, `/p/quality`, `/p/ncrs`, and scoping more completely.
  - Investigate access readiness/module gating race where `/p` screens can briefly use default access before selected company scope finishes loading.
- Technical debt worth scheduling outside bug-fix PRs:
  - Refactor duplicated classic/mobile docket and ITP hook parity only if it remains stable; avoid risky consolidation while the mobile shell is still moving.

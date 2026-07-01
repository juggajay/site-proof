# Stage 138 - Subcontractor Docket Depth QA

Date: 2026-07-01
Branch: `qa/stage138-subbie-docket-depth`

## Scope

Deep pass over subcontractor docket creation/edit/resubmit/delete behavior across:

- Backend docket entry mutation routes.
- Backend queried-docket response flow.
- Docket submit notification recipient logic.
- Classic subcontractor portal docket editor.
- New `/p` subbie mobile docket shell.
- Browser-level docket and subbie-shell E2E coverage.

## Findings Fixed

### Labour partial updates could leave stale hours and cost

`PUT /api/dockets/:id/labour/:entryId` recalculated hours from only the submitted
time fields. Updating just `finishTime` could keep the old submitted hours/cost.
The route now calculates from the effective stored+submitted time range.

### Existing lot allocations were not revalidated after a time reduction

If a labour entry already had 8 allocated lot hours, reducing the entry to 5
hours without resubmitting lot allocations could leave allocations above the
entry total. The update route now validates existing allocations against the
effective hours when no replacement allocation payload is supplied.

### Queried dockets could be responded to without resubmission invariants

Initial submission used `assertDocketSubmittable`, but query response moved a
docket from `queried` back to `pending_approval` without rechecking entries and
lot allocations. Query responses now reuse the same entry/lot guard with
`queried` as the allowed status.

### Delete mutations could make frontend totals drift

Backend delete routes refreshed docket totals but returned only `{ message }`.
Classic and `/p` frontend screens then recomputed locally. Delete responses now
return authoritative `runningTotal`, and both frontends prefer that value.

### Quality managers could approve dockets but missed submit notifications

The submit notification query had a hard-coded role list that omitted
`quality_manager`, despite `DOCKET_APPROVERS` allowing the role to approve.
Submit notifications now reuse `DOCKET_APPROVERS`.

### Zero-hour labour entries were exposed in the UI

The backend rejects equal start/finish labour times, but classic and `/p` sheets
allowed the user to click Add. Shared docket sheet state now flags zero-hour
labour ranges, shows the validation message, and disables Add in both surfaces.

### Classic subcontractor docket editor exposed writes while offline

The `/p` shell already blocked writes offline. The classic editor now uses the
same offline status source to show a connection-required notice, disable write
controls, skip notes autosave offline, and defensively block add/delete handlers.

## Follow-Up Not Fixed In This Stage

Plant lot allocation support is inconsistent: the schema has `DocketPlantLot`
and some rollups/tests can use it, but the current plant entry API and frontend
do not expose plant lot allocation. This needs a product decision before a fix:
either plant rows stay unscoped by design, or the API and both docket UIs need a
plant lot picker plus validation.

## Verification

- Backend targeted tests:
  `npm test -- src/routes/dockets/presentation.test.ts src/routes/dockets/submissionGuards.test.ts src/routes/dockets.test.ts`
  - 114 passed.
- Frontend targeted tests:
  `npm run test:unit -- src/pages/subcontractor-portal/useDocketEntrySheetState.test.ts src/pages/subcontractor-portal/components/DocketEditPagePanels.test.tsx src/shell/subbie/screens/dockets/test/DocketScreen.test.tsx`
  - 25 passed.
- Backend static checks:
  - `npm run type-check`
  - `npm run lint`
  - `npm run format:check`
- Frontend static checks:
  - `npm run type-check`
  - `npm run lint` (existing `src/lib/theme.tsx` fast-refresh warning only)
  - `npm run format:check`
- Browser E2E:
  - `npm run test:e2e -- e2e/dockets.spec.ts --project=chromium` - 15 passed.
  - `npm run test:e2e -- e2e/subbie-mobile-shell.spec.ts --project=chromium` - 8 passed.
- `git diff --check` passed.

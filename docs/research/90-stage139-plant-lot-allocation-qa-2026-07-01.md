# Stage 139 - Plant Lot Allocation QA

Date: 2026-07-01

Branch: `qa/stage139-plant-lot-allocation`

Base: `origin/master` at `53748325` after PR #1301.

## Scope

Stage 139 converted the open Stage 138 follow-up into a finite release-gate
check, then audited and fixed plant lot allocation in subcontractor dockets.

Surfaces checked:

- Backend plant docket entry API.
- Backend docket detail and plant-entry response mappers.
- Project cost rollup consumers that already read `DocketPlantLot`.
- Classic subcontractor portal docket editor.
- `/p` subcontractor mobile docket shell.
- Browser docket creation/editing coverage.

Two read-only subagents audited the backend and frontend paths separately. Both
confirmed the same mismatch: the schema and downstream rollups could represent
plant lot allocations, but the normal plant entry API and UI could not create or
display them.

## Release Gate Added

Added `docs/research/89-release-candidate-gate-2026-07-01.md`.

Purpose:

- Stop the QA loop from becoming infinite.
- Define a practical controlled-pilot gate.
- Classify future findings as pilot blocker, broad launch blocker, scale
  hardening, product decision, or polish.

Current readiness judgment in that gate:

- Controlled pilot users are reasonable once the finite release-candidate gate
  passes in one clean run.
- Broad paid launch should wait for pilot feedback, support process, restore
  evidence, monitoring, and accepted legal/commercial wording sign-offs.

## Finding Fixed

### Plant costs could be missing from lot-level actual cost

Problem:

- `DocketPlantLot` existed in the Prisma schema.
- Project cost rollups already read plant lot allocations when rows exist.
- Lot deletion guards already treated plant lot allocations as real links.
- Diary auto-population already used the first plant allocation when present.
- Normal subcontractor plant entry flows did not accept, validate, persist,
  return, or display plant allocations.

User impact:

- A subcontractor could add plant hours to a docket.
- The project total included the plant cost.
- Lot-level actual cost could omit that plant cost because no normal UI path
  created `docket_plant_lots`.

Classification:

- Fixed as launch-quality correctness work.
- The implementation is conservative: plant entries are lot-scoped when a lot is
  available and selected, while plant-only/no-lot dockets still work when the
  subcontractor has no assigned lots or the lots module is disabled.

## Changes Made

Backend:

- Plant create/update schemas now accept `lotAllocations`.
- Plant create/update routes validate allocations belong to the docket project
  and assigned subcontractor.
- Plant allocation hours cannot exceed plant entry hours.
- Plant create/update routes persist `DocketPlantLot` rows.
- Plant get/detail/mutation responses include `lotAllocations` as
  `{ lotId, lotNumber, hours }`.
- Full docket detail includes plant allocations.

Frontend:

- Classic subcontractor plant sheet now shows the same lot selector pattern as
  labour when assigned lots exist.
- `/p` mobile plant sheet now shows the same lot selector pattern.
- Classic and `/p` plant add payloads send `lotAllocations` when a lot is
  selected.
- Plant rows in classic and `/p` display returned lot chips.

Browser coverage:

- The classic docket E2E plant-entry test now asserts:
  - encoded plant hours are blocked before submission,
  - valid plant POST includes `lotAllocations`,
  - the added plant row displays the lot chip.

## Verification

Disposable database:

- Docker Postgres `siteproof-stage139-postgres`.
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/siteproof_stage139_test`
- `npm run db:deploy`: passed, 25 migrations applied.

Backend:

- `npm test -- src/routes/dockets/presentation.test.ts src/routes/dockets/entryMutationResponses.test.ts`
  - 32 passed.
- `DATABASE_URL=... NODE_ENV=test npx vitest run src/routes/dockets.test.ts --maxWorkers=1`
  - 79 passed.
- `npm run type-check`: passed.
- `npm run lint`: passed.
- `npm run format:check`: passed.

Frontend:

- `npm run test:unit -- src/shell/subbie/screens/dockets/test/DocketScreen.test.tsx src/pages/subcontractor-portal/components/DocketEditTabs.test.tsx`
  - 18 passed.
- `npm run type-check`: passed.
- `npm run lint`: passed with the known existing `src/lib/theme.tsx`
  fast-refresh warning only.
- `npm run format:check`: passed.

Browser:

- `npm run test:e2e -- e2e/dockets.spec.ts --project=chromium`
  - 15 passed.
- `npm run test:e2e -- e2e/subbie-mobile-shell.spec.ts --project=chromium`
  - 8 passed.

Notes:

- A parallel run of both Playwright specs caused `dockets.spec.ts` to time out
  in its final test while waiting for the Plant tab. Running the spec alone
  immediately passed. Treat this as Playwright dev-server contention from
  concurrent local runs, not an app failure.
- The local worktree still shows `docs/research/07-onboarding-implementation.md`
  as deleted by local/security tooling. It is unrelated to this stage and must
  not be staged.

## Remaining Follow-Ups

No new pilot blocker was left open in this stage.

Accepted follow-ups:

- Decide later whether plant allocations should support splitting one plant
  entry across multiple lots in the UI. Backend supports multiple allocations;
  current UI follows the existing labour single-selected-lot pattern.
- Consider a uniqueness constraint on `(docketPlantId, lotId)` if multi-lot
  plant editing becomes more advanced. Current UI sends one lot per entry.

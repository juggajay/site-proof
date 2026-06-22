# Stage 57 Seeded Mutation QA - 2026-06-23

## Scope

Verified real seeded browser workflows against a disposable Postgres database and the local app:

- Admin seeded lot/ITP assignment visibility.
- Assigned subcontractor ITP access.
- Foreman mobile shell reachability.
- Hold-point request release -> manual release -> ITP completion reconciliation -> normal lot conformance.

Also reviewed the backend ITP completion path for subcontractor outcomes that feed conformance.

## Findings

### Fixed: subcontractor N/A and failed outcomes bypassed HC verification

When a project required subcontractor ITP verification and the lot assignment required verification, the backend only set `pending_verification` for subcontractor `completed` outcomes.

`not_applicable` and `failed` are also finished outcomes, but they could remain outside the HC verification path. That meant a subcontractor N/A could satisfy completion state without the same review gate as a pass.

Change made:

- Apply subcontractor verification resolution to every finished outcome: `completed`, `not_applicable`, and `failed`.
- Notify the head-contractor review team whenever a subcontractor outcome enters `pending_verification`.
- Keep notification wording accurate for N/A/failed review submissions.

### Covered: hold-point release now proves ITP completion reconciliation

Added real-browser coverage proving:

- Subbie can open the seeded assigned lot ITP.
- The hold-point item blocks PASS before release.
- Admin requests release from the hold-point register.
- Admin records manual release with release identity and signature.
- The released hold point updates the ITP completion count to `1/1`.
- Normal `Conform Lot` succeeds after release.

This directly protects the earlier bug class where hold-point signoff/release existed but the ITP completion and lot conformance gate did not pick it up.

### Adjusted: foreman shell smoke assertion

The foreman shell test was asserting a brittle badge string (`1 due`). The durable contract is that the foreman lands in the v2 mobile shell and sees the Lots card. The assertion now checks the Lots card label and subtext instead.

## Verification

- `backend`: `npm test -- src/routes/itp.test.ts`
  - 81 passed.
- `frontend`: `npx playwright test e2e/seeded-role-journeys.spec.ts --project=chromium`
  - 4 passed.
- Targeted lint:
  - `backend`: `npx eslint src/routes/itp/completions.ts src/routes/itp/completionWorkflow.ts src/routes/itp.test.ts`
  - `frontend`: `npx eslint e2e/seeded-role-journeys.spec.ts`

## Remaining Next Sweep

The current E2E seed still has only one ITP checklist item, and it is a hold point. A later sweep should add or create a standard subcontractor item so browser QA can cover ordinary subbie PASS, N/A, and FAIL from the UI as separate flows.

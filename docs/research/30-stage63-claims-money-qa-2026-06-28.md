# Stage 63 Claims And Money QA

Date: 2026-06-28
Branch: `qa/stage63-claims-money`
Base: `origin/master` at `8ba624a0`

## Scope

This pass focused on progress-claim money integrity and browser-facing claim workflows:

- concurrent partial claims against the same lot
- claim certification and payment transitions
- claim read/list/detail response sanitisation
- claim summary totals and outstanding money display
- create-claim modal usability/accessibility
- Playwright coverage for the seeded claims workflow

## Findings

Older audit blockers for over-claiming, duplicate paid transitions, duplicate certification, and raw metadata leakage are fixed on current master. The backend uses row-level locks for claim creation and claim status transitions, and regression tests exist for the main race paths.

Two smaller frontend issues were still valid:

1. The seeded claims E2E fixture created impossible draft claims with `paidAmount` set, and the summary logic could display negative outstanding values for inconsistent data.
2. Multiple selected lots in the create-claim modal produced percentage inputs with the same accessible label, making browser automation and screen-reader operation ambiguous.

## Changes Made

- Clamped claim summary outstanding totals to zero, matching the row/payment modal behaviour.
- Updated the claims Playwright fixture so draft/submitted claims do not default to paid money.
- Made each selected lot percentage input identify its lot number through the associated label.
- Allowed the percentage input row to wrap on narrow screens.
- Added regression tests for non-negative outstanding totals and lot-specific percentage input names.

## Verification

Passed locally:

- `cd backend && npm test -- src/routes/claims/presentation.test.ts src/routes/claims/workflowValidation.test.ts`
- `cd frontend && npm run test:unit -- src/pages/claims/claimsPageData.test.ts src/pages/claims/components/CreateClaimModal.test.tsx`
- `cd frontend && npm run test:e2e -- e2e/claims.spec.ts --reporter=list`
- `cd frontend && npm run type-check`
- `git diff --check`

Notes:

- Prisma Client generation initially failed because the local certificate store rejected the Prisma binary host. It succeeded after running generation in the isolated worktree with TLS verification disabled for that command only. No secrets were read or printed.
- DB-backed full route tests were not run locally because this worktree has no disposable local Postgres and Docker Desktop is not available. The source audit and existing tests confirm coverage, but CI should remain the authority for those DB-backed race tests.

## Follow-Up Browser Gaps

The mocked claims Playwright suite is strong, but the next live/seeded browser pass should still cover:

- mobile viewport claims table and create-claim modal layout
- actual evidence package PDF generation/download in-browser
- certification with certificate upload and read-back link
- partial payment followed by final payment
- direct route denial for non-commercial roles before claims API actions appear

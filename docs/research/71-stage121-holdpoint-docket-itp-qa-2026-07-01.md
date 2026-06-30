# Stage 121 Hold Point, Docket, And ITP Branch QA

Date: 2026-07-01 Australia/Sydney
Stage owner: Codex
Branch: `qa/stage121-hold-docket-itp`
Base: `36d560b3 test: allow time-aware subbie greeting (#1283)`

## Scope

Stage 121 targeted the highest-risk workflow branches identified in Stage 119:

- Hold point request, release, public-token release, escalation, and ITP reconciliation.
- Docket approve, reject, query/respond, adjustment, PDF/CSV, and subbie edit paths.
- ITP template, lot assignment, completion, verification/rejection, attachment, hold-point gating, and subbie/foreman run paths.

## Baseline Browser Coverage

The existing browser coverage for this slice is already substantial.

Passed locally:

```powershell
cd frontend
npx playwright test e2e/holdpoints.spec.ts e2e/dockets.spec.ts e2e/itp.spec.ts e2e/lots.spec.ts e2e/lot-detail.spec.ts --project=chromium --reporter=list
```

Result: 61 passed.

Covered by that run:

- Hold point register, request release, chase, manual record release, validation, public secure release, expired token, mobile cards.
- Docket approval, reject, query, CSV/PDF, adjustment validation, subbie blocked from PM approvals, rejected resubmit, queried response.
- ITP templates, cross-project import, lot ITP assignment, checklist completion duplicate guard, pending verification, rejection reason, evidence photo/link upload, force conformance.
- Lot register create/edit/import/export/clone and access-denied handling.

## Bug Found

The backend allowed `POST /api/holdpoints/:id/resolve-escalation` to mark a hold point's escalation as resolved even when the hold point had never been escalated.

Why it matters:

- It creates impossible state: `isEscalated=false` with `escalationResolved=true`.
- It can pollute audit history with a resolved escalation that never existed.
- It weakens the hold point state machine around a workflow used when release is blocked or stale.

## Fix

Updated `backend/src/routes/holdpoints/escalationRoutes.ts` so resolve-escalation now requires:

- the user has read and writable escalation permission first, preserving access-control behavior;
- the hold point is currently escalated;
- the escalation has not already been resolved.

Added backend integration coverage in `backend/src/routes/holdpoints.test.ts` for:

- successful escalation with notification and `HP_ESCALATED` audit log;
- successful resolution with `HP_ESCALATION_RESOLVED` audit log;
- rejection when resolving a hold point that was never escalated, with DB state unchanged.

## Verification

Passed against a disposable local Postgres database:

```powershell
cd backend
$env:DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/siteproof_stage121_test'
$env:JWT_SECRET='local-stage121-jwt-secret-at-least-32-chars'
npm test -- --run src/routes/holdpoints.test.ts
```

Result: 53 passed.

Passed:

```powershell
cd backend
npm run type-check
```

Local setup note:

- `npm run db:generate` and the first `npm run db:deploy` attempt hit Windows certificate verification errors against `binaries.prisma.sh`.
- I did not weaken TLS.
- For local verification only, I reused generated Prisma engine artifacts from another worktree with the same schema hash, then applied migrations to the disposable local database.

## Audit Findings To Carry Forward

No additional production blocker was found in this slice.

Worth closing in later stages or focused PRs:

- Dockets: add positive browser coverage for approve-with-adjustments asserting adjusted totals, per-entry approved cost/reason, and reason visibility after approval.
- Dockets: add browser coverage for classic subbie labour and plant delete with total recalculation after refetch.
- ITP: add browser proof that public hold point release updates the associated ITP row to completed and verified after refetch.
- ITP: add browser/API coverage for subbie rejected item resubmission through head-contractor verification.
- ITP admin: template archive, restore, propagate, and template-lots routes are mostly backend/API coverage candidates, not currently obvious user-facing UI flows.

## Stage 121 Status

Stage 121 found and fixed one real backend state-machine bug in hold point escalation resolution.

The overall app loop remains active. The next recommended stage is Stage 122: documents, drawings, test results, signed URLs/downloads, and file lifecycle branches.

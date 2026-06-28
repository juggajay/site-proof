# Stage 65 QA - Ordinary ITP Outcome Flows

Date: 2026-06-28
Branch: `qa/stage65-next-qa`

## Scope

Audited ordinary, non-hold-point ITP item completion paths for subcontractor and foreman users:

- PASS
- N/A
- FAIL with NCR creation
- rejected item rework/resubmission
- lot progression and conformance counting for N/A items under verification review

This was chosen because earlier seeded E2E coverage only exercised a single hold-point item, while Jay had previously seen ITP items refusing to pass/fail in testing.

## Findings

1. The new foreman and subcontractor shell hooks treated any `isCompleted` item as already done. Rejected completions can still carry `isCompleted: true`, so a rejected ordinary item could show as actionable but tapping Pass would return success without sending a write. Fixed in:
   - `frontend/src/shell/screens/lots/useShellItpRun.ts`
   - `frontend/src/shell/subbie/screens/useSubbieItpRun.ts`

2. The seeded real-backend browser journey only covered one ITP item, and that item was a hold point. It did not exercise ordinary PASS, N/A, or FAIL controls. Added a separate seeded standard-outcomes lot so FAIL/NCR state cannot affect the existing hold-point conformance journey.

3. Backend helper behavior already excluded pending/rejected verification states from progress, but the N/A variant was under-tested. Added regressions so N/A counts only once accepted, not while `pending_verification` or `rejected`.

4. Added a route-level regression for foreman ordinary PASS, N/A, and FAIL outcomes. Foreman outcomes should save with `verificationStatus: none`; FAIL should still create an NCR and move the lot to `ncr_raised`.

## Verification

Local checks completed:

- `frontend`: targeted shell hook tests passed, 10 tests.
- `backend`: pure conformance and lot progression helper tests passed, 51 tests.
- `frontend`: type-check passed.
- `backend`: type-check passed.
- `frontend`: lint passed with one existing warning in `src/lib/theme.tsx`.
- `backend`: lint passed with one existing warning in `src/lib/dataRetention.test.ts`.
- `frontend`: format check passed.
- `backend`: format check passed.
- `backend/scripts/seed-e2e.mjs`: syntax check passed.

Local limitation:

- `backend/src/routes/itp.test.ts` could not run in this isolated worktree because no local `DATABASE_URL` is configured. The test was still type-checked locally and should run in GitHub CI where the disposable test database is provided.

## Remaining Follow-Up

- Let CI run the DB-backed ITP route suite and the seeded E2E changes.
- After merge, run production smoke and continue the broader app QA loop.

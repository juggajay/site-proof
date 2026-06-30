# Stage127 Role Browser Loop QA - 2026-07-01

## Scope

Stage127 continued the whole-app readiness loop after Stage126 merged green. The focus was a fresh seeded browser pass across the main roles and the highest-risk lot/ITP/hold-point/docket surfaces, with parallel read-only agents looking for remaining gaps.

Worktree: `C:\Users\jayso\siteproof-wt\qa-stage127-role-browser-loop`

Branch: `qa/stage127-role-browser-loop`

Base: `origin/master` at `3ee6a2be` after PR #1289.

## Local Test Environment

- Disposable Docker Postgres: `siteproof_stage127_test`.
- Backend ran locally on `http://localhost:3001`.
- Frontend Playwright web server ran through the repo Playwright config.
- E2E seed users were reset with `npm run seed:e2e`.

No production database or production user data was used.

## Browser QA Evidence

The following browser suites passed against the disposable backend:

- `e2e/seeded-role-journeys.spec.ts`: 5 passed.
- `e2e/foreman-mobile-shell.spec.ts`, `e2e/subbie-mobile-shell.spec.ts`, `e2e/subcontractor-portal-rbac.spec.ts`, `e2e/subcontractor-docket-reachability.spec.ts`: 23 passed.
- `e2e/holdpoints.spec.ts`, `e2e/dockets.spec.ts`, `e2e/itp.spec.ts`: 32 passed.
- `e2e/dashboard.spec.ts`, `e2e/projects.spec.ts`, `e2e/project-users.spec.ts`, `e2e/project-settings.spec.ts`, `e2e/project-areas.spec.ts`, `e2e/company-settings.spec.ts`, `e2e/settings.spec.ts`, `e2e/profile.spec.ts`, `e2e/audit-log.spec.ts`: 75 passed.
- `e2e/documents.spec.ts`, `e2e/subcontractor-documents.spec.ts`, `e2e/drawings.spec.ts`, `e2e/test-results.spec.ts`: 17 passed.
- After the backend fix, `e2e/seeded-role-journeys.spec.ts` plus `e2e/holdpoints.spec.ts`: 18 passed.

Expected negative-path console errors appeared in a few browser tests where the test deliberately mocks backend 400/503/fetch failures.

One local harness issue was found: running two Playwright commands in parallel in the same worktree can race through `npm run copy:pdf-assets`, causing `ENOTEMPTY` while clearing `frontend/public/pdfjs/cmaps`. The affected docs/drawings/test-results slice passed when rerun sequentially.

## Parallel Read-Only Agent Findings

Three read-only agents reviewed independent surfaces:

- Owner/PM desktop: no release blocker found. Remaining valuable coverage gaps are a true seeded `owner` desktop journey, batch test-certificate browser journey, document versioning UI coverage, and richer docket adjustment assertions.
- Foreman/subbie mobile and classic: no release blocker found. Remaining valuable coverage gaps are foreman mobile docket approve/adjust/reject, diary save/copy/submit depth, subbie `/p/*` company scoping, classic company plant/employee add-delete-refetch, subbie docket entry delete totals, subbie ITP rejection resubmission, and subbie NCR response/rectification.
- Hold-point/docket/ITP deep pass: found one confirmed public hold-point release bug and one public release email consistency bug. Both were fixed in this stage.

## Confirmed Fixes

### 1. Public secure-link release no longer re-releases completed hold points

Problem:

- The public `POST /api/holdpoints/public/:token/release` route blocked already `released` hold points but not already `completed` hold points.
- If an unused release token existed for a completed hold point, the public path could overwrite the terminal completed state to `released`.

Fix:

- Public token metadata now reports `canRelease: false` for both `released` and `completed`.
- The public release route rejects both terminal states before mutation.
- The transactional `updateMany` now guards with `status: { notIn: ['released', 'completed'] }`.
- If a race changes the hold point into a terminal state during release, the route refetches and returns the correct terminal-state error without consuming the token.

Files:

- `backend/src/routes/holdpoints.ts`
- `backend/src/routes/holdpoints.test.ts`

### 2. Public release confirmation emails now use the project timezone

Problem:

- Authenticated hold-point release emails format the release timestamp using `projectTimeZoneFromState(project.state)`.
- Public secure-link release confirmation emails reused the stored release instant but omitted `timeZone`, so WA and other non-server-local projects could show the wrong wall-clock time.

Fix:

- Public secure-link release confirmation emails now format `releasedAt` with the project timezone.
- A WA project route test freezes the release instant and asserts the confirmation email shows the Perth wall-clock time.

Files:

- `backend/src/routes/holdpoints.ts`
- `backend/src/routes/holdpoints.test.ts`

## Verification

Backend tests:

- Targeted completed-token regression: passed.
- Targeted public release timezone regression: failed before the fix, passed after the fix.
- Full `src/routes/holdpoints.test.ts`: 55 passed.

Static checks:

- Backend `npm run lint`: passed.
- Backend `npm run type-check`: passed.

Browser verification after the backend fix:

- `npx playwright test e2e/seeded-role-journeys.spec.ts e2e/holdpoints.spec.ts --project=chromium --reporter=list`
- Result: 18 passed.

## Remaining Follow-Ups

No new P0/P1 blocker was found in Stage127 after the fixes above.

Still worth closing in later loops:

- Add a true seeded `owner` browser journey, not only admin/project-manager coverage.
- Strengthen foreman mobile docket approve/adjust/reject browser coverage.
- Strengthen subbie NCR response/rectification and rejected ITP resubmission coverage.
- Add document versioning UI coverage or document the missing UI affordance as an accepted product gap.
- Add deeper docket adjustment assertions after approval, especially adjusted totals/cost/reason visibility.
- Avoid parallel Playwright commands in one worktree until `copy-pdf-assets` is made concurrency-safe.

## Current Readiness Judgment

Stage127 materially improved confidence in the lot/ITP/hold-point path and fixed two real public-release issues found during the deeper pass.

The overall app readiness loop should remain active until the remaining role-depth gaps above are either covered by browser evidence or explicitly accepted as launch follow-ups. The current confirmed blockers from this stage are fixed locally and ready for PR verification/merge.

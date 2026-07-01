# Stage 136 - Document Evidence And Storage QA

Date: 2026-07-01  
Branch: `qa/stage136-doc-evidence`  
Base: `origin/master` at `bdabe4e8` (`Fix stale scheduled report and notification access`)

## Scope

Audited document/photo/evidence/report-access and cleanup paths across:

- Scheduled report PDF artifact generation, download, and schedule deletion.
- Test-result certificate replacement and deletion.
- Mobile NCR evidence upload affordances.
- Hold-point manual release gating and public release-token form state.
- Existing secure document download/public hold-point evidence link behavior.

Read-only subagents covered backend storage/access, frontend evidence surfaces, and E2E coverage gaps.

## Findings Fixed

1. Scheduled report PDFs were orphaned when a scheduled report was deleted.
   - Added best-effort artifact deletion for local files and Supabase object references.
   - Schedule deletion now captures artifact runs before the DB delete and removes the stored PDFs after commit.
   - Added a regression test proving the local generated PDF is deleted with the schedule.

2. Local test-result certificate files were orphaned on replace/delete.
   - Added `deleteStoredCertificateFile()` for Supabase and local certificate storage.
   - Certificate replacement now deletes the old stored file after the DB swap commits.
   - Test-result deletion now deletes the linked local/Supabase certificate file after the DB delete commits.
   - Added regression assertions using real local fixture files.

3. Mobile NCR Add Photo could start an upload that the backend would later reject.
   - Added `canAddNcrEvidence()` state derivation.
   - The mobile issue detail screen now disables Add Photo for closed NCRs and ineligible users before upload starts.
   - Added tests for open, closed, and ineligible states.

4. Hold-point manual release UI could proceed toward a release the backend would reject.
   - Manual release modal now accepts a permission state and disables submit/signature capture when blocked.
   - HoldPointsPage uses current project role plus detail `approvalRequirement` to block superintendent-required manual releases for ineligible roles.
   - Submit handler also refuses early, before release evidence upload starts.
   - Public release-token page now disables the signature pad when the token cannot release.

## Confirmed Existing Behavior

- Signed document downloads are re-authorized at download time through backend access checks.
- Public hold-point evidence links scope downloads to documents included in that token's evidence package.
- Public hold-point responses already strip raw storage URLs.

## Deferred / Notes

- Public hold-point tokens still allow package/document viewing after release until token expiry. Current behavior blocks a second release but keeps evidence review available. Treat as a product decision.
- Browser E2E coverage still needs broader seeded flows for document download/open, uploaded evidence read-back, and public hold-point evidence links across roles.
- `docs/research/07-onboarding-implementation.md` is deleted in the local worktree but unrelated to this stage and should not be staged in this PR.

## Verification

- `backend`: `npm test -- src/routes/reports.test.ts src/routes/testResults.test.ts` - 198 passed.
- `backend`: `npm run type-check` - passed.
- `backend`: `npm run lint` - passed.
- `frontend`: `npm run test:unit -- src/shell/screens/issues/test/IssueDetailScreen.test.tsx src/pages/holdpoints/components/RecordReleaseModal.test.tsx` - 20 passed.
- `frontend`: `npm run test:unit -- src/pages/holdpoints/HoldPointsPage.test.tsx src/pages/holdpoints/components/RecordReleaseModal.test.tsx` - 14 passed.
- `frontend`: `npm run test:coverage` - 348 files passed, 2,974 tests passed.
- `frontend`: `npm run type-check` - passed.
- `frontend`: `npm run lint` - passed with one existing warning in `frontend/src/lib/theme.tsx`.
- `frontend`: `npx playwright test --grep "@pr-smoke"` - 12 passed.
- `git diff --check` - passed.
- `fallow audit --base origin/master --format json --quiet` - advisory fail: 0 dead code, 0 introduced duplication, 5 introduced complexity findings in already-large touched React functions.

## CI Fix Follow-Up

PR #1299 initially failed Frontend coverage and PR smoke because the new hold-point
role gate reads `/api/projects/:id` through `useCurrentProjectRole`. The real
project detail response includes `currentUserRole`, but the unit and Playwright
mocks did not. Updated the mocks to return `currentUserRole: 'project_manager'`
and adjusted the register unit assertion to check the hold-point fetch directly.

# Stage 75 NCR Lifecycle QA - 2026-06-29

## Scope

Focused audit of NCR lifecycle and subcontractor-facing NCR workflows:

- Responsible-party response and rectification flow.
- QM response review and major-NCR approval.
- Verification, closure, concession closure, and post-closure mutation rules.
- Dashboard/project overview NCR deep links.
- NCR status wording in UI and exported PDFs.

Stage numbering note: prior "stage 14/15" labels were local report labels, not the live QA sequence. The live sequence is Stage 75 after Stage 73 and Stage 74 were merged and production-checked.

## Fixes Made

- Required meaningful response fields before an NCR can move from `open` to `investigating`.
- Blocked `/rectify`, `/submit-for-verification`, and the shared verification claim helper unless the NCR is already in `rectification`.
- Blocked major-NCR QM approval unless the NCR is in `verification`.
- Blocked evidence uploads and reassignment updates after an NCR is closed or closed with concession.
- Returned `qmApprovedBy.id` from NCR APIs so the frontend can detect the same-approver close restriction.
- Disabled close/concession in desktop and mobile NCR views when the current user is the same user who granted QM approval.
- Stopped showing "Submit Rectification" while NCRs are still in `investigating` on main NCR actions, classic subcontractor portal, and the subbie mobile shell.
- Standardized dashboard/project/portfolio NCR links to `?ncr=` so deep-linked NCRs highlight correctly.
- Replaced raw NCR status tokens in report tables, concession modal copy, and NCR-related PDFs with user-facing status labels.
- Updated the subbie NCR shell subtitle so it no longer says "Read-only" while response/rectification actions are available.

## Verification

- Backend targeted tests:
  - `npm test -- src/routes/ncrs.test.ts src/routes/ncrs/ncrWorkflowValidation.test.ts src/routes/dashboard/roleDashboardResponses.test.ts`
  - Result: 116 passed.
- Frontend targeted tests:
  - `npm run test:unit -- src/pages/ncr/ncrActions.test.ts src/pages/ncr/components/NCRMobileDetailSheet.test.tsx src/pages/subcontractor-portal/SubcontractorNCRsPage.test.tsx src/shell/subbie/screens/test/NcrsScreen.test.tsx`
  - Result: 20 passed.
- Type checks:
  - `backend npm run type-check`
  - `frontend npm run type-check`
  - Result: both passed.

## Deferred Findings

- NCR detail PDF still needs a deeper lifecycle/evidence expansion so printed NCRs fully mirror the detail page. This is larger than a status-label cleanup.
- NCR email preferences exist, but NCR routes still create in-app notifications directly in places instead of routing through the preference/digest helper.
- Rectify NCR modal upload flow should be reviewed separately for stale state and multi-file race behavior.
- The older OAuth redirect tests still use `?ncrId=` as an arbitrary redirect string; production dashboard/project link producers now emit `?ncr=`.

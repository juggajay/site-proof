# Stage134 Company / Account / Report Access QA

Date: 2026-07-01  
Worktree: `C:\Users\jayso\siteproof-wt\qa-stage134-company-account`  
Branch: `qa/stage134-company-account`

## Scope

Stage134 covered company settings, company-member mutation paths, account privacy/export/delete,
company exit paths, project-user removal, and scheduled report artifact/error handling. The main
goal was to test real backend behavior rather than relying only on mocked Playwright routes.

## Confirmed Issues Fixed

1. Active scheduled reports survived access removal.
   - A user who left a company, was removed from a company, or was removed from a project could
     still own active scheduled reports with external recipients.
   - Fixed by deactivating user-owned schedules, clearing recipients, and clearing `createdById`
     inside the same transaction as the access removal.

2. Company invite API-key guard order was misleading.
   - API-key-authenticated company invite requests hit email-verification failure before the
     intended browser-session boundary.
   - Fixed by checking browser-session first, then email verification.

3. No-company users could not reach Settings.
   - Users with no `companyId` were forced to `/onboarding`, which blocked account export/delete.
   - Fixed by allowing `/settings`, `/profile`, `/support`, `/docs`, and `/documentation` through
     the company-onboarding gate.

4. Scheduled report artifact page dropped real backend error messages.
   - The frontend only parsed top-level `message` or string `error`, while the backend returns
     `{ error: { message, code } }`.
   - Fixed nested backend error parsing so users see the real reason.

## Coverage Added

- Backend route tests:
  - Company leave disables/clears owned scheduled reports.
  - Company member removal disables/clears owned scheduled reports.
  - Project user removal disables/clears owned scheduled reports for that project.
  - API-key company invite/role-change/remove requests are rejected before mutation.

- Frontend unit tests:
  - Scheduled report artifact page surfaces nested backend error messages.
  - Company onboarding gate allows account/support pages before company setup while keeping product
    pages gated.

- Real-backend Playwright coverage:
  - Owner opens company settings.
  - Owner invites an existing no-company user, changes company role, removes them.
  - Owner manages project team membership.
  - Owner toggles project modules.
  - Owner creates/pauses/reactivates/deletes scheduled report emails.
  - Non-owner leaves company and can still reach Settings afterward.
  - No-company user exports data and deletes account.
  - Existing subcontractor/foreman/ITP/hold-point seeded journeys still pass.

## Verification

- `backend`: `npm test -- src/routes/company.test.ts src/routes/projects.test.ts` -> 196 passed.
- `backend`: `npm run type-check` -> passed.
- `backend`: `npm run lint` -> passed.
- `frontend`: `npm run test:unit -- ScheduledReportArtifactPage.test.tsx ProtectedAppShell.test.tsx` -> 23 passed.
- `frontend`: `npm run type-check` -> passed.
- `frontend`: `npm run lint` -> passed with one existing warning in `src/lib/theme.tsx`.
- `frontend`: `npm run test:e2e -- e2e/seeded-role-journeys.spec.ts` -> 14 passed.

## Not Changed

- Scheduled report artifact downloads remain guarded by project report access, not the stricter
  schedule-management gate. Existing backend tests explicitly allow active internal project users to
  download artifacts. This should be treated as a product/security policy decision rather than a
  silent bug fix.

## Notes

- `docs/research/07-onboarding-implementation.md` was already deleted in the worktree, matching the
  earlier security-software deletion pattern. It was not part of Stage134 and should not be included
  in the PR.

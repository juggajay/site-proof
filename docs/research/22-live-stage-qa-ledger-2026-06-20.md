# Live Staged QA Ledger - 2026-06-20

This ledger tracks the staged live QA pass Jay requested: test one area at a
time in browsers/API, fix issues through PR/CI/merge, retest production, and
keep going until the app has been exercised end to end.

## Current External Blocker

- Earlier email-dependent flows were parked because production Resend was
  returning `daily_quota_exceeded`.
- Stage 3 did submit a hold-point request to Jay's nominated superintendent
  email and the API returned success, so at least that send path is accepting
  mail again. Inbox-read verification was not performed in Stage 3.
- Still parked until a dedicated email pass: invite emails, magic login links,
  password reset emails, notification test emails, and any browser QA that
  requires reading an inbox.
- Disposable inbox APIs are not allowed for this QA work. AVG flagged
  `1secmail.com` from an old Codex process, so future email QA must use Jay's
  nominated inbox, a trusted mailbox, or Resend's safe test recipient.

## Stage 1 - Production Integration Gates

Status: partial pass, one external blocker remains.

Evidence:
- Production preflight now verifies Resend domain setup and performs a safe send
  probe.
- Supabase `documents` bucket was changed from public to private in production.
- Private storage smoke passed: upload document, mint signed URL, download via
  backend route, delete document.
- Production preflight now passes Supabase private-bucket check.

Remaining issue:
- Resend send probe fails while the account is over the daily quota.

Related merged work:
- #995 - Resend production preflight send probe.
- #996 - Document private Supabase bucket configuration.

## Stage 2 - Non-Email Auth, Project, Dashboard, Documents, Access Guards

Status: passed after one QA-found UI fix.

Scope covered:
- Backend `/health` and `/ready`.
- Password registration and login for a new owner.
- Company creation and project creation.
- Project list/detail and dashboard stats.
- Private document upload, list, signed URL minting, public token validation,
  signed download, and cleanup delete.
- Separate unrelated owner account.
- API guards proving the unrelated owner cannot read the first owner's project,
  list project documents, or mint document signed URLs.
- Browser login form, authenticated `/login` redirect, desktop dashboard,
  projects, project detail, documents page, mobile dashboard, mobile documents,
  and visual access-denied state.

Initial live run:
- Run: `stage2-20260620T085909-cdf3d`.
- Result: 30 passed, 0 failed, 0 unexpected network failures.
- Visual finding: the product tour auto-opened over an access-denied project
  deep link for a first-run user. The API guard was correct, but the UI made the
  denial unclear.

Fix:
- #997 - Suppress first-run onboarding tour auto-show on deep links.
- Behavior: first-run tour auto-opens only on neutral landing routes
  `/dashboard`, `/projects`, and `/portfolio`; explicit "Take the tour" replay
  remains available elsewhere.

Verification:
- Local focused unit: `npm run test:unit -- src/components/layouts/ProtectedAppShell.test.tsx`.
- Local focused lint/prettier on touched files passed.
- PR #997 CI passed: frontend, PR smoke, Vercel preview.
- Merged to master at `40497fed92ccec8180d58df5288cdd16e0a7c90b`.
- Master CI passed: backend, frontend, full post-merge E2E.
- Vercel production deploy completed for the merge commit.
- Post-merge production rerun: `stage2-20260620T092206-1b5d6`, 30 passed,
  0 failed, 0 unexpected network failures.
- Visual verification: access-denied page now shows the denial banner directly
  with no tour modal overlay.

Notes for Review:
- The three browser console errors in the Stage 2 runs were the expected 403s
  from the deliberate outsider access-denial test.
- The verification banner appears on test accounts because email verification
  emails cannot currently be delivered while Resend quota is exhausted.
- Cookie banner overlays the bottom of first-run pages. It is expected behavior,
  but should be watched during mobile QA because it can partially cover bottom
  navigation until accepted/dismissed.

## Stage 3 - Owner Quality Workflow: Lots, ITP, Hold Points, NCR, Evidence

Status: passed, no product fixes required in this stage.

Scope covered:
- Backend `/health` and `/ready`.
- Password registration and login for a new owner and an unrelated owner.
- Company creation and project creation.
- Project ITP template creation with contractor and superintendent checklist
  groups.
- Lot creation with ITP template assignment and automatic ITP instance creation.
- Hold point prerequisite guard: request-release is blocked before preceding
  checklist items are complete.
- ITP completion guard: a hold-point item cannot be completed directly before
  the hold-point release flow records release attribution.
- Hold-point request-release to Jay's nominated external superintendent email.
- Hold-point detail and evidence-package preview.
- Manual hold-point release with releaser name, organisation, method, date/time,
  and notes.
- Verification that the released hold point is reflected back into the ITP
  completion as `completed` and `verified`, with release organisation present.
- Standard ITP pass flow after hold-point release.
- Failed ITP item flow creating an NCR.
- NCR list filtering by project/lot.
- Document upload scoped to the lot.
- NCR evidence attachment, duplicate evidence idempotency, and evidence listing.
- API guards proving the unrelated owner cannot read the lot ITP, project hold
  points, NCR, or NCR evidence.
- Browser verification for desktop lot detail ITP tab, project lots list, hold
  points page, and NCR list.

Exploration support:
- Two read-only subagents mapped Stage 3 backend routes, access invariants,
  frontend routes, selectors, likely failure points, and follow-up tests. They
  made no edits and did not touch production.

Run evidence:
- First completed run: `stage3-20260620T094727-5606b`, 47 checks, 1 browser
  locator failure, 0 product issues. The page was valid; the harness looked for
  a hold-point item inside a collapsed responsible-party group.
- Second completed run: `stage3-20260620T094856-9328c`, 47 checks, 1 browser
  locator failure, 0 product issues. Screenshot confirmed the superintendent
  group was collapsed intentionally.
- Final run: `stage3-20260620T095010-36813`, 47 checks, 0 failures, 0 issues,
  4 screenshots.

Notes for Review:
- The hold-point email path returned `200` during Stage 3, but the inbox was not
  inspected in this pass.
- The lot detail ITP checklist groups items by responsible party. Completed
  contractor items were visible immediately; superintendent hold-point content
  required expanding the `superintendent` group. The harness now accounts for
  that behavior.
- The failed ITP item stayed visibly linked to `NCR-0001` on the lot detail ITP
  tab, and the NCR page showed the same failure description.
- No browser console errors or unexpected network failures were recorded in the
  final run.

## Stage 4 - Role-Specific Mobile Shells and Subcontractor Portal

Status: passed after one QA-found frontend crash fix.

Scope covered:
- Backend `/health` and `/ready`.
- Password registration/login for owner, foreman, subcontractor, and unrelated
  outsider accounts.
- Owner company/project setup.
- Foreman attached to the owner company and added to the project as `foreman`.
- Subcontractor invitation, acceptance, and portal module enablement.
- Project setting `requireSubcontractorVerification` enabled.
- ITP template with contractor, subcontractor, and superintendent hold-point
  items.
- Three subcontractor-assigned lots:
  - writable lot for API completion and verification checks.
  - read-only lot for blocked completion checks.
  - separate writable browser lot left incomplete so the mobile subbie detail
    page could show actionable checklist content.
- Subbie ITP view hides superintendent-only hold-point item.
- Subbie completion on writable assigned lot records `pending_verification`.
- Owner verifies the subbie pending completion.
- Subbie completion on read-only assigned lot is blocked with `403`.
- Foreman completes contractor-visible ITP item.
- Owner uploads a generic project/lot document for classic subcontractor
  document visibility.
- Owner uploads a real drawing-register row via `POST /api/drawings` for the
  foreman `/m/docs` surface.
- Owner creates an NCR assigned to the foreman.
- API guards proving outsider lot access is blocked and subbie project settings
  access is blocked.
- Visible browser verification for:
  - foreman `/m/lots`
  - foreman `/m/lots/:lotId/itp`
  - foreman `/m/issues`
  - foreman `/m/docs`
  - subbie `/p/itps`
  - subbie `/p/lots/:lotId/itp` writable assignment
  - subbie `/p/lots/:lotId/itp` read-only assignment
  - subbie `/p/ncrs`
  - classic subbie `/subcontractor-portal/documents?shell=off`

Exploration support:
- Two read-only subagents mapped Stage 4 backend route setup, drawing-register
  seeding, frontend shell expectations, and auth rate-limit behavior. They made
  no edits and did not touch production.

Initial run evidence:
- First run: `stage4-20260620T100203-722b2`, 76 checks, 6 failures, 3 issues.
- The failures were triaged into harness problems and auth rate-limit noise:
  - `/m/docs` only reads drawing-register rows, but the harness had uploaded a
    generic document.
  - subbie `/p/itps` correctly renders `Inspections`, not `ITPs`.
  - subbie writable ITP detail was already complete because the API setup had
    completed the same lot before the browser assertion.
  - production auth limits all `/api/auth/*` routes, including `/api/auth/me`,
    to 10 requests per minute per source IP; the harness had exhausted that
    bucket by doing several rapid registrations/logins before browser mounting.
- Harness was corrected to seed a real drawing row, use a separate incomplete
  browser lot, assert current UI copy, and wait for the auth limiter window
  before browser verification.

Product issue found:
- Visible rerun `stage4-20260620T100908-c6ffe` found a real crash in the
  classic subcontractor Documents page:
  `Cannot read properties of null (reading 'toLowerCase')`.
- Cause: `SubcontractorDocumentsPage` grouped null document categories under
  `Other`, but the document card still passed the raw null category into the
  icon helper, which called `.toLowerCase()`.

Fix:
- #1000 - Fix subcontractor documents with uncategorised files.
- Behavior: null/blank categories normalize to `Other` before grouping and icon
  selection, so uncategorised shared documents render instead of tripping the
  app error boundary.

Verification:
- Local focused unit: `npm run test:unit -- SubcontractorDocumentsPage.test.tsx`.
- Local frontend type-check: `npm run type-check`.
- Local focused ESLint on touched files passed.
- Precommit hook passed frontend lint and Prettier check, with one existing
  warning in `frontend/src/lib/theme.tsx`.
- PR #1000 CI passed: frontend and PR E2E smoke.
- Merged to master at `42e561cbbe7396b7d05f841eaaa1e7b39f7e1cba`.
- Master CI passed: backend, frontend, and full post-merge frontend E2E.
- Final visible production rerun: `stage4-20260620T103541-4a968`, 80 checks,
  0 failures, 0 issues, 9 screenshots.

Notes for Review:
- Stage 4 intentionally used a visible browser window after Jay asked to watch
  the QA navigation rather than relying only on headless screenshots.
- The earlier `/api/auth/me` 429s were harness-created. The frontend verifies a
  stored session once on `AuthProvider` mount and falls back to the cached user
  on unavailable `/me`; it does not retry in a loop.
- A real-world edge remains worth reviewing later: a busy site office with many
  people signing in from the same NAT could hit the production 10/minute auth
  limiter. The current user experience is not catastrophic, but this is worth a
  separate auth-rate-limit tuning pass before large customer rollouts.

## Stage 5a - Commercial Dockets

Status: passed. Follow-up Stage 17 production recheck also passed after
follow-up docket fixes #1025, #1026, and #1027.

Scope covered:
- Backend `/health` and `/ready`.
- Password registration/login for owner, subcontractor, and unrelated outsider
  accounts.
- Owner company/project setup.
- Subcontractor invitation, acceptance, and portal module enablement.
- Subcontractor-assigned lot plus same-project unassigned lot.
- Approved and pending employee roster records.
- Approved and pending plant records.
- Empty docket submit guard: blocked before any labour/plant entries.
- Labour-without-lot-allocation submit guard.
- Same-project unassigned lot allocation guard.
- Pending employee and pending plant blocked from docket entries.
- Submitted docket approval access guards:
  - subbie cannot approve its own docket.
  - unrelated outsider cannot approve the docket.
- Adjusted approval guard: reduced hours require a nonblank adjustment reason.
- Reduced approval success:
  - submitted labour hours remain visible at entry level.
  - submitted labour cost remains `400`.
  - approved labour hours persist as `6.5`.
  - approved labour cost persists as `325`.
  - submitted plant hours remain visible at entry level.
  - submitted plant cost remains `450`.
  - approved plant hours persist as `2`.
  - approved plant cost persists as `300`.
- Subbie detail API reads the approved cost totals, preventing the old
  submitted-vs-approved dollar mismatch.
- Approved docket list preserves reduced hours and approved dollar totals.
- Approved docket rejects further entry edits.
- Query flow:
  - owner queries a pending docket.
  - subbie sees the query notes.
  - subbie responds and resubmits.
  - response is stored in docket notes.
- Reject flow:
  - owner rejects a pending docket with reason.
  - subbie docket history shows the rejection state and reason preview.
- Subbie can list its own dockets.
- Unrelated outsider cannot list project dockets or read the approved docket.
- Visible browser verification for:
  - owner desktop `/projects/:projectId/dockets`.
  - owner desktop pending docket actions.
  - mobile approver view of project dockets.
  - subbie portal dashboard.
  - subbie docket history.
  - subbie approved docket labour tab.
  - subbie approved docket plant tab.
  - subbie resubmitted queried docket.
  - unrelated outsider deep link to project dockets, blocked before leakage by
    the company-setup gate.

Exploration support:
- Two read-only subagents mapped dockets and claims route/API/browser
  expectations. They made no edits and did not touch production.

Run evidence:
- First run: `stage5a-20260620T105101-ee0f4`, stopped on a harness expectation.
  The harness treated `totalLabourSubmitted`/`totalPlantSubmitted` as hours.
  Current code intentionally uses those legacy-named fields as submitted dollar
  totals; entry rows expose the submitted hours.
- Second run: `stage5a-20260620T105324-026b9`, 127 checks, 8 browser assertion
  failures. Screenshot review showed assertion problems, not product failures:
  status labels matched broad absent-action strings, plant cost was on the Plant
  tab, query response text is stored in notes but not shown after resubmission,
  and the outsider was blocked by onboarding rather than the access-denied page.
- Final visible production rerun: `stage5a-20260620T105711-08001`, 135 checks,
  0 failures, 0 issues, 9 screenshots.

Notes for Review:
- The dockets flow is in better shape than the earlier audit suggested. The
  reduced approved dollar totals are now persisted and rendered back to the
  subbie on approved docket detail.
- `totalLabourSubmitted` and `totalPlantSubmitted` are legacy-named submitted
  cost fields. This is confusing for future developers, but current UI helpers
  intentionally treat them as money and use entry rows / `labourHours` /
  `plantHours` for hours.
- Resolved in follow-up production QA: the subbie approved docket detail now
  shows the adjustment reason, and the owner read-only docket modal no longer
  shows action notes controls on already-actioned dockets.
- The visible QA browser still shows the email-verification banner on generated
  test users. This is expected until the email-focused pass verifies account
  verification delivery.

## Stage 5b - Commercial Claims and Payments

Status: passed, no product fixes required in this slice.

Scope covered:
- Backend `/health` and `/ready`.
- Password registration/login for owner, subcontractor, and unrelated outsider
  accounts.
- Owner company/project setup with WA jurisdiction to exercise project-state
  claim due-date data.
- Subcontractor invitation, acceptance, and portal module enablement.
- Lot setup for claim edge cases:
  - conformed budgeted main lot.
  - conformed no-rate lot.
  - budgeted but not-conformed lot.
  - conformed budgeted lot claimed at 100%.
- Claim readiness:
  - budgeted conformed lot appears with 100% remaining claimable percentage.
  - commercial budget value is visible to owner.
  - conformed/no-rate lot remains blocked by missing budget.
- Claim creation guards:
  - legacy `lotIds` payload is rejected because `percentageComplete` is now
    mandatory per selected lot.
  - no-rate lot is rejected with `RATE_REQUIRED`.
  - not-conformed lot is rejected.
  - subcontractor claim creation is rejected.
- Commercial access guards:
  - subcontractor cannot list claims.
  - subcontractor cannot read claim readiness.
  - subcontractor cannot fetch claim evidence packages.
  - subcontractor cannot run claim completeness checks.
  - unrelated outsider cannot list or read project claims.
- Cumulative claiming:
  - main lot claimed at 50%, producing `$5,000` from a `$10,000` budget.
  - full lot claimed at 100%, producing `$3,000` from a `$3,000` budget.
  - 100% claimed lot flips to `claimed`.
  - later attempt to claim another 60% on the already-50%-claimed main lot is
    rejected with `OVER_CLAIM`.
- Evidence surfaces:
  - claim evidence package returns the claim, lot, generated summary, and total
    claimed amount.
  - claim completeness check returns the readiness summary keys used by the UI.
- Workflow transitions:
  - payment before certification is rejected.
  - draft claim can be submitted.
  - submitted claim can be disputed with notes.
  - reduced certification without variation notes is rejected.
  - disputed claim can be certified at `$4,500` with variation notes.
  - certification detail read-back includes certified amount, variation notes,
    and certifier display name.
  - partial payment of `$2,000` moves the claim to `partially_paid` with
    `$2,500` outstanding.
  - final payment of `$2,500` moves the claim to `paid`, outstanding `$0`.
  - both payment history entries remain in the response.
  - fully paid claim rejects further generic updates and extra payment attempts.
- Claims list read-back:
  - total claimed remains `$5,000`.
  - certified amount is `$4,500`.
  - paid amount is `$4,500`.
  - project state is `WA` for due-date calculation.
- Visible browser verification for:
  - owner desktop `/projects/:projectId/claims`.
  - owner desktop New Claim modal.
  - owner mobile claims page.
  - subcontractor portal dashboard with no commercial claims/costs leakage.
  - subcontractor direct deep link to project claims, blocked by Access Denied.
  - unrelated outsider deep link to project claims, blocked before leakage by
    the company-setup gate.

Run evidence:
- First run: `stage5b-20260620T110916-9e98d`, stopped on a setup assumption.
  The harness sent `budgetAmount` in the create-lot payload, but the real create
  endpoint does not persist budget; owner budget edit is a separate PATCH flow.
- Second run: `stage5b-20260620T111022-35eef`, 126 checks, 2 harness failures.
  Screenshot review showed the owner mobile H1 wrapped over two lines and did
  not match the exact `"Progress Claims"` text assertion, while the page itself
  was correct.
- Final visible production rerun: `stage5b-20260620T111258-f455c`, 127 checks,
  0 failures, 0 issues, 6 screenshots.

Notes for Review:
- Claims/payment workflow passed the money and access-boundary checks that
  matter most for paying customers: partial claim math, cumulative percentage
  guards, reduced certification notes, partial/final payment history, and
  subcontractor/outsider denial.
- The current lot create API silently strips `budgetAmount`; budgets are set by
  `PATCH /api/lots/:id`. That is valid today, but it is an easy place for future
  QA harnesses or integrations to assume the wrong thing.
- Desktop claim list rendered certification audit detail directly under the
  paid status: certifier name plus variation notes. This is good evidence for
  the commercial audit trail.
- Generated test users still show the email-verification banner in visible
  screenshots. This remains expected until the separate email-focused pass.

## Next Stage Candidate

Stage 6 should target documents/photos/reports/export surfaces end to end:
document upload and categorisation, project documents, subcontractor shared
documents, drawing/document access guards, claim CSV/evidence-package downloads,
report pages, storage URL handling, and public/private leakage checks.

A separate email-focused pass should follow when Jay can confirm inbox receipt:
invites, magic login, password reset, hold-point public token release, and
notification emails.

## Stage 6 - Documents, Drawings, Photos Shell, and Reports

Status: passed, no blocking product fixes required in this slice.

Scope covered:
- Backend `/health` and `/ready`.
- Password registration/login for owner, foreman, subcontractor, and unrelated
  outsider accounts.
- Owner company/project setup, company-member foreman invite, and project-team
  foreman assignment.
- Subcontractor invitation, acceptance, and documents-only portal module
  enablement.
- Lot setup for document access edges:
  - assigned lot linked to the subcontractor.
  - unassigned lot not linked to the subcontractor.
- Document uploads:
  - owner project-level photo with category, tags, GPS, and captured timestamp.
  - owner assigned-lot photo.
  - owner unassigned-lot photo.
  - owner `itp_evidence` category photo.
  - subcontractor assigned-lot photo.
- Document write/access guards:
  - subcontractor project-level upload rejected.
  - subcontractor unassigned-lot upload rejected.
  - subcontractor `itp_evidence` upload rejected while ITP portal module is off.
  - unrelated outsider document list/download rejected.
  - subcontractor cannot list `itp_evidence` without the ITP module.
  - subcontractor can see project-level shared documents, assigned-lot documents,
    and their own assigned-lot uploads.
  - subcontractor cannot see unassigned-lot or hidden ITP evidence documents.
  - list rows omit raw `fileUrl`.
- Document lifecycle:
  - owner patches document metadata.
  - subcontractor cannot mutate owner-uploaded document.
  - subcontractor can patch their own assigned-lot document.
  - authenticated file streaming works for owner and scoped subcontractor.
  - deleted document later returns not found.
  - owner uploads a new document version and version listing includes it.
  - manual multi-label classification persists.
- Public/signed document access:
  - owner creates an inline signed URL.
  - public signed-token validation succeeds.
  - public signed URL streams the PNG.
  - invalid token validation returns invalid.
  - missing token download is blocked.
  - subcontractor cannot create a signed URL for an unassigned document.
- Drawings:
  - owner uploads a PDF drawing.
  - duplicate drawing number/revision is rejected.
  - owner drawing register includes the uploaded drawing.
  - subcontractor and outsider drawing lists are rejected.
  - owner patches drawing status/title.
  - owner supersedes revision A with revision B.
  - current drawing set includes the superseding revision and excludes the
    superseded revision.
  - owner deletes a temporary drawing.
- Reports:
  - owner can fetch summary, lot-status, NCR, test, diary, and claims reports.
  - invalid test report date range is rejected.
  - subcontractor and outsider report access is rejected.
  - scheduled reports are blocked for the new basic-tier company.
- Visible browser verification for:
  - owner desktop documents page.
  - owner desktop drawing register.
  - owner desktop reports page.
  - real foreman mobile `/m/photos` shell.
  - subcontractor mobile documents shell.
  - subcontractor direct drawing/report deep links, both blocked.
  - unrelated outsider deep link to project documents, blocked by setup gate.

Run evidence:
- First run: `stage6-20260620T112816-ec98a`, stopped on a harness assumption.
  The drawing supersede endpoint correctly returns the new drawing with
  `supersededById: null`; the script expected the field to be omitted.
- Second run: `stage6-20260620T112858-f1186`, 127 checks, 4 failures, all
  harness/coverage issues:
  - desktop documents screenshot clearly showed `Safety`; the locator chose a
    hidden/earlier duplicate text match.
  - `/m/photos` was being tested with an owner account even though it is a
    foreman shell route.
- Third run: `stage6-20260620T113448-194c4`, stopped on a harness comparison.
  The backend normalised the generated foreman email to lowercase.
- Final visible production rerun: `stage6-20260620T113512-e8996`, 131 checks,
  0 failures, 0 issues, 8 screenshots.

Notes for Review:
- The document security boundaries passed the important leak checks: no raw
  `fileUrl` in list rows, scoped signed URL creation, invalid/missing public
  token handling, subcontractor module gating, and outsider denial.
- The drawings workflow passed revision lifecycle checks: duplicate guard,
  supersede, current-set exclusion of old revision, and subcontractor denial.
- The reports endpoints are owner/internal surfaces; subcontractor/outsider
  denial held.
- The real foreman mobile photos shell loaded with the expected unfiled count and
  photo grid once the harness used an actual foreman/project-team member.
- Visual polish opportunity: the subbie mobile documents shell can feel cramped
  with very long filenames in narrow viewports. The card truncates, but the
  screenshot showed the content pushed hard against the viewport edge. Worth
  revisiting when the new subbie shell polish pass runs.

## Stage 7 - Auth, Email-Link Surfaces, Notifications, and MFA

Status: passed for safe browser/API coverage, no blocking product fixes required
in this slice.

Scope covered in a visible browser:
- Login page, password login, magic-link request UI, forgot-password request UI.
- Register page and unverified-account login path.
- Email verification page with no token and with an invalid token.
- Reset password page with an invalid token.
- Magic-link consume page with an invalid token, including URL token stripping.
- Onboarding company setup for a fresh account.
- Settings page after onboarding, including Email Notifications and MFA/security
  sections.
- Notifications page.
- Public invalid hold-point release link.
- Public invalid subcontractor invitation link.

Supporting API checks:
- Generic resend-verification, forgot-password, and magic-link request responses
  for known and unknown emails.
- Invalid and missing verification/reset/magic-token handling.
- Email preferences load/update, invalid timing normalization, disabled
  test-email rejection, re-enable, and test-email send to a sacrificial QA
  account.
- Email service status.
- Production diagnostic queue endpoints are blocked.
- Notifications list and unread count.
- MFA status, setup, TOTP verify, wrong-password disable rejection, and
  correct-password disable.

Run evidence:
- Visible production run: `stage7-mqmakp8w`, 47 checks, 0 confirmed failures,
  0 product findings, 16 screenshots, 0 unexpected browser/API errors after
  excluding deliberate negative-test 400/401/403/404/429 responses.
- Report artifact:
  `.gstack/qa-reports/stage7-mqmakp8w/qa-report.md` inside the QA worktree.

Notes for Review:
- Before company setup, `/settings` redirects to `/onboarding`; after company
  setup it is reachable. This is valid gating.
- Self-serve registration signs users in before email verification and shows an
  in-app verification nudge. Confirm this is the desired paid-user policy.
- MFA setup/verify/disable passed on a sacrificial account. MFA login challenge
  checks hit the production auth rate limit after the broad auth-negative test
  sweep, so those should be rerun as a focused check after cooldown rather than
  repeatedly hammering `/api/auth/login`.
- Real inbox receipt and click-through for verification, magic link, password
  reset, invite, and hold-point emails were not proven in this run. API/UI
  request paths were verified, and public invalid-link handling was verified.

## Next Stage Candidate

Stage 8 should target company administration and team/project membership:
company settings, company member invites, role changes, project team invites,
seat limits, company leave/delete edge cases, audit-log visibility, settings
exports, and the access split between owner/admin/project manager/foreman/site
engineer/subcontractor.

## Stage 8 - Company Admin, Project Team, Audit, and Settings

Status: two confirmed frontend findings, both fixed in this branch. Live
production will continue showing them until this branch is merged and deployed.

Scope covered in a visible browser:
- Owner Company Settings load, team table, usage/billing/transfer sections.
- Invite Company Member modal and pending-member row.
- Owner project team page.
- Owner project settings page.
- Owner audit-log page.
- Owner settings export/danger-control page.
- Project-manager Company Settings access check.

Supporting API checks:
- Company members list.
- Project creation.
- Project team list, unknown-user invite guard, existing company-member invite,
  duplicate guard, role update, self-role-change guard, remove member, and
  missing-remove guard.
- Owner cannot leave company.
- Audit-log list and audit-log users endpoints.
- Active non-admin member role boundaries:
  - can read assigned project users.
  - cannot mutate project team.
  - cannot read company members.
  - cannot read global audit logs.
- Data export returns JSON metadata for the current user without saving content.
- Owner account deletion is blocked.
- Disposable non-owner can leave company and loses company-member admin access.

Findings fixed:
1. Company Settings user-usage counters stayed stale after inviting a member.
   The team row appeared immediately, but `User Usage` stayed on the old count
   until a page refresh. Fix: `CompanyTeamMembersSection` now invalidates
   `queryKeys.companySettings` after a successful invite.
2. Project managers could open editable Company Settings even though backend
   company mutations are owner/admin-only. Fix: added `COMPANY_ADMIN_ROLES =
   ['owner', 'admin']` and used it for `/company-settings` only, while keeping
   `project_manager` in the broader project-admin role group.

Run evidence:
- Visible production run: `stage8-mqmawyrr`, 38 checks, 2 confirmed production
  findings, 2 branch fixes, 8 screenshots, 0 unexpected browser/API errors after
  excluding deliberate negative-test 400/401/403/404 responses.
- Report artifact:
  `.gstack/qa-reports/stage8-mqmawyrr/qa-report.md` inside the QA worktree.
- Verification:
  - `npm run test:unit -- src/pages/company/components/CompanyTeamMembersSection.test.tsx src/appRouteRoles.test.ts`
    passed.
  - `npm run type-check` passed.

Notes for Review:
- Company member removal by an admin is not implemented. The only company-member
  removal path in this surface is a non-owner leaving their own company. This
  may be acceptable for MVP, but it is a product/admin gap to review before
  larger teams onboard.

## Stage 9 - Project Setup, Settings, Areas, and Modules

Scope:
- Visible-browser owner onboarding into a sacrificial company.
- Projects empty state, sample project creation, project create modal, project
  limit behavior, General Settings, Modules, Notifications, standalone Areas,
  and standalone Project Team.

Findings:
1. Hold-point minimum notice setting was persisted under the Project Settings UI
   key but request-release enforcement read a different backend key. Fixed in
   PR #1003 by reading `hpMinimumNoticeDays`, falling back to the legacy backend
   key, then defaulting to 1.
2. Standalone Project Team displayed `Invalid Date` in the Joined column. Fixed
   in PR #1004 by returning `joinedAt` from the API and adding a defensive UI
   formatter. Live re-test showed a real joined date.
3. Sample-project copy said "Delete it whenever you like" even though seeded
   sample projects contain retained records and should be archived. Fixed in PR
   #1005.

Run evidence:
- Visible production run: `stage9-mqmfz0tg`, headed Chromium via gstack browse,
  3 confirmed production findings, 3 merged fixes, 0 unexpected browser/API
  errors after excluding deliberate negative-test 400/403 responses.
- Report artifact:
  `.gstack/qa-reports/stage9-mqmfz0tg/qa-report.md` inside the QA worktree.
- Verification:
  - PR #1003: Backend CI and PR smoke passed.
  - PR #1004: Backend CI, Frontend CI, and PR smoke passed.
  - PR #1005: Frontend CI and PR smoke passed.

Notes for Review:
- The New Project button still opens at the plan limit and rejects only after
  submit. The message is clear, so this is polish rather than a blocker.
- Project Areas lets equal start/end chainage reach the backend, then shows a
  clear inline error. Client-side blocking would save a round trip but is not a
  correctness issue.
- Disabled modules hide navigation only; backend route access is not disabled
  by project module settings. This matches current UI wording.

## Next Stage Candidate

Stage 10 should target role-specific access with separate visible sessions where
possible: owner/admin/project manager/foreman/viewer/subcontractor/outsider
navigation, direct-route access, project settings mutations, project team
mutations, lot/ITP access, and subcontractor portal redirects.

## Stage 10 - Role Access and Project Scope

Scope:
- Visible-browser role matrix on production using separate QA accounts for
  owner, project-scoped project manager, project-scoped foreman,
  project-scoped viewer, logged-out user, and cross-company outsider.
- Direct-route checks for dashboard, project settings, project team, areas,
  lots, ITP, claims, reports, and company settings.
- Visible-control checks for project settings save/delete controls and lot
  create/import/bulk-create controls.

Findings:
1. Project role UI gates needed to consistently use the project-scoped role.
   Fixed in PR #1008 by centralizing role helpers and applying
   `getProjectScopedRole(user)` to project nav, route, lot setup, and
   danger-zone controls.
2. Project-scoped viewers were denied the project dashboard because login did
   not expose `viewer` memberships as a dashboard role. Fixed in PR #1009 by
   carrying `viewer` and `site_engineer` memberships through backend auth and
   frontend auth/redirect typing.

Live re-test results:
- Owner can access Project Settings, Project Team, Lots, Claims, and Company
  Settings. Owner sees project settings save/delete controls and lot setup
  controls.
- Project-scoped PM can access Project Settings, Project Team, Lots, Claims,
  and Reports. Company Settings is denied. Permanent project delete is hidden.
- Project-scoped foreman can access dashboard, Lots, ITP, and Reports. Project
  Settings, Project Team, Claims, and Company Settings are denied. Lot setup
  controls are hidden.
- Project-scoped viewer can access dashboard, Lots, and Reports. Project
  Settings, Project Team, ITP, Claims, and Company Settings are denied. Lot
  setup controls are hidden.
- Logged-out direct project access redirects to login.
- A cross-company owner cannot open the QA project and receives Access Denied.

Run evidence:
- Visible production run: `stage10-mqmjzrym`, headed Chromium via gstack
  browse, 2 confirmed production findings, 2 merged fixes.
- Report artifact:
  `.gstack/qa-reports/stage10-mqmjzrym/qa-report.md` inside the QA worktree.
- Verification:
  - PR #1008 CI passed and merged.
  - PR #1009 local type/lint/focused tests passed, PR CI passed, merged, master
    CI passed including full Frontend E2E, Vercel Production and Railway
    deployment statuses passed, and backend `/ready` returned HTTP 200.

Notes for Review:
- The first broad role matrix was discarded after stale auth made PM/foreman
  appear to have owner controls. The corrected matrix explicitly checked stored
  role and dashboard role before evaluating each route.
- Subcontractor invitation could not be completed with Resend QA recipients.
  Both a generated Resend plus-address and `delivered@resend.dev` returned HTTP
  500 from `/api/subcontractors/invite`; generic test email also returned HTTP
  500 for the QA account while email service status reported Resend configured.
  This needs a focused email-delivery follow-up using Sentry/logs or a real
  recipient before subcontractor portal invite QA is considered complete.

## Stage 11 - Email Delivery and Subcontractor Invite Flow

Scope:
- Visible-browser disposable owner registration, company creation, and project
  creation on production.
- Production email service status.
- Test notification email path.
- Subcontractor invite email path.

Finding:
- Production Resend delivery was quota-blocked. Before the fix, the app masked
  this as generic HTTP 500 responses from both `/api/notifications/send-test-email`
  and `/api/subcontractors/invite`, while `/api/notifications/email-service-status`
  still implied real delivery was ready.

Fix:
- PR #1011 merged to master and deployed. It preserves provider error metadata,
  returns operational HTTP 503 `EXTERNAL_SERVICE_ERROR` responses for quota/rate
  delivery failures, and changes email-service-status copy so it does not claim
  delivery is guaranteed by configuration alone.

Live re-test results:
- Disposable owner registration, company creation, and project creation all
  returned HTTP 201 in the visible browser session.
- Email service status returned HTTP 200, provider `resend`, status `ready`, and
  now warns that live delivery still depends on provider quota and sender-domain
  status.
- Test notification email returned HTTP 503 with code `EXTERNAL_SERVICE_ERROR`
  and details reason `quota_exceeded`.
- Subcontractor invite returned HTTP 503 with code `EXTERNAL_SERVICE_ERROR` and
  details reason `quota_exceeded`.

Run evidence:
- Report artifact:
  `.gstack/qa-reports/stage11-email-subbie-flow-20260621/qa-report.md` inside
  the QA worktree.
- Verification:
  - Local focused helper tests passed.
  - Backend type-check and lint passed.
  - PR #1011 CI passed.
  - Master CI after merge passed, including Backend, Frontend, and full
    Frontend E2E.

Notes for Review:
- The remaining blocker is operational, not product-code behavior: Resend quota
  must reset or be upgraded before real outgoing emails and full subcontractor
  invite click-through can be proven.
- Full subcontractor portal onboarding remains unverified until a real email can
  be delivered or a safe QA-only invite-link capture mechanism exists.

## Stage 12 - Test Results, Certificates, Verification, and Conformance Evidence

Scope:
- Visible-browser production owner registration, company creation, project
  creation, and lot creation.
- Test specifications, requested test creation, enter-result validation,
  certificate attachment, verification, request-form metadata, verification view,
  failed-test handling, linked NCR creation, lot conformance status, lot
  readiness, claim readiness, project test-result listing, unauthenticated
  denial, and desktop/mobile Test Results UI action gating.

Findings:
1. Claim readiness did not count current-workflow pending test statuses such as
   `requested` and `entered`; lot readiness did. Fixed in PR #1013 by sharing
   pending status logic across lot and claim readiness.
2. NCRs raised from failed test results accepted `linkedTestResultId` in the
   payload but did not persist/expose the link. Fixed in PR #1013 with a nullable
   linked-test relation, validation, response inclusion, and tests.
3. Test Results UI showed Print Certificate for requested/unfinished tests.
   Fixed in PR #1013 by gating certificate PDF generation to verified tests with
   a certificate document.
4. Full E2E failed after #1013 because two stale browser assertions still
   expected Print Certificate before the new gate allowed it. Fixed in PR #1014.

Live re-test results:
- Production browser/API probe passed all 25 Stage 12 checks after migration.
- Lot readiness and claim readiness both reported the requested test as pending
  with singular grammar: `1 test result is not verified yet.`
- NCR creation from the verified failed test returned HTTP 201 and the response
  linked test result matched the failed test.
- Lot conformance after linked NCR reflected both blockers: no assigned ITP and
  one open NCR.
- Desktop Test Results UI showed Print Certificate only on the two verified
  rows. The requested row showed Enter Results and Attach certificate, with no
  Print Certificate action.
- Mobile Test Results UI at `390x844` showed the same corrected gate.

Run evidence:
- Report artifact:
  `.gstack/qa-reports/stage12-test-results-conformance-20260621/qa-report.md`
  inside the QA worktree.
- PR #1013 merged and deployed the product fixes.
- PR #1014 merged the E2E assertion update.
- Master CI run `27881752487` passed, including Backend, Frontend, and full
  Frontend E2E.
- Production migration run `27882111339` passed. This was required because #1013
  added the nullable `ncrs.linked_test_result_id` column. Before the migration,
  the live linked-NCR create path returned HTTP 500; after the migration it
  returned HTTP 201.

Notes for Review:
- The deliberate negative tests still produce expected browser console resource
  errors: HTTP 400 for entering an incomplete requested test, HTTP 400 for
  verifying before certificate attachment, and HTTP 401 for unauthenticated
  list access.
- The QA lot intentionally remained non-conformable because no ITP was assigned
  and an NCR remained open. A later cross-domain workflow stage should cover the
  full path from ITP assignment through NCR closure and final lot conformance.

## Stage 13 - Documents, Drawings, Storage Access, and Evidence Payloads

Scope:
- Visible-browser production owner setup, project/lot creation, document upload
  surfaces, document list/access denial, signed URL behavior, drawing revision
  handling, test-certificate document access, public hold-point evidence payloads,
  and generic document deletion safety.
- Static/code audit with two focused subagents covering backend storage routes
  and frontend document/drawing surfaces.

Findings:
1. Public hold-point release evidence packages exposed raw storage locators in
   checklist attachments and photo entries. Fixed in this stage by sanitizing
   public responses only; authenticated evidence-package responses are unchanged.
2. Generic `DELETE /api/documents/:documentId` could delete test-result
   certificate documents and could attempt to delete drawing-register documents.
   Fixed in this stage by rejecting `test_certificate` and `drawing` document
   types from the generic delete path with HTTP 409, leaving those files under
   their owning workflows.
3. Production subcontractor invite creation returned HTTP 503
   `EXTERNAL_SERVICE_ERROR`, blocking live subcontractor document-visibility
   checks. This is the same operational email-delivery class seen in Stage 11.
4. Signed download URLs remain valid until expiry after permission changes. This
   should be documented as the intended short-lived-link policy or tightened
   later if stricter revocation is required.
5. Project-wide documents are visible to subcontractors with Documents portal
   access. This needs product-policy confirmation.
6. Follow-up hardening remains for drawing revision concurrency/blank revisions,
   project-scoped drawing manager controls, mobile lot-documents empty-state
   semantics, and the claim submit modal's "download package" wording.

Live test results:
- Production backend `/ready` responded healthy.
- Owner registration, company creation, project creation, and lot creation
  succeeded.
- Project-wide, assigned-lot, unassigned-lot, and test-result document uploads
  succeeded and upload responses did not expose raw file URLs.
- Unauthenticated document listing and direct file-route access were denied.
- Owner signed URL creation worked; invalid tokens were denied; excessive
  expiry was rejected; an outsider could not create a signed URL.
- Drawing duplicate number/revision upload was rejected. Superseding created
  revision B, and the current drawing set excluded superseded revision A.
- Current drawing and test certificate access used the signed-download path.
- Subcontractor visibility checks stopped at invite creation because production
  email delivery returned 503.

Run evidence:
- Report artifact:
  `.gstack/qa-reports/stage13-documents-storage-20260621/qa-report.md` inside
  the QA worktree.
- Local focused regressions:
  - `npm test -- src/routes/documents/deleteRoutes.test.ts` passed, 2 tests.
  - `npm test -- src/routes/holdpoints/evidencePackage.test.ts` passed, 16 tests.
  - Combined focused run passed, 18 tests.
- Backend type-check passed.
- Backend lint passed.
- Fallow changed-code audit passed: no introduced dead code, complexity, or
  duplication.

Notes for Review:
- The DB-backed document route regression cases were added to
  `documents.test.ts`, but the suite could not be run locally because this
  worktree has no safe local `DATABASE_URL`. The safety setup correctly refused
  to use production.
- After this PR lands, rerun the owner-side production probe to verify the
  deployed public evidence payload no longer includes storage locators and that
  generic deletion rejects domain-managed documents.

## Next Stage Candidate

Stage 14 should target cross-domain closeout from lot to claim: assign an ITP,
complete standard/witness/hold-point items, release the hold point, attach and
verify test results, raise and close an NCR from a failed result, confirm lot
conformance, then confirm claim readiness and evidence package behavior.

## Stage 14 - Cross-Domain Lot Closeout

Scope:
- Visible-browser production owner setup, project/lot creation, ITP assignment,
  standard item completion, hold-point release request and release, test-result
  certificate verification, NCR lifecycle, lot conformance, and claim-readiness
  handoff.
- Static/code audit with focused backend and frontend subagents covering lot
  closeout state, ITP completion, hold-point prerequisites, NCR status effects,
  test evidence matching, and frontend cache refreshes.

Findings:
1. Lot conformance treated `pending_verification` ITP completions as finished.
   Fixed in this stage by requiring `verificationStatus === verified` for
   completed checklist items before lot conformance can pass.
2. Hold-point release requests ignored pending/rejected verification on
   prerequisite ITP items. Fixed in this stage by carrying verification status
   into hold-point prerequisite checks.
3. Conformed or claimed lots could be downgraded by a later linked NCR create or
   close path. Fixed in this stage by rejecting new NCR links to terminal lots
   and only clearing `ncr_raised` lots back to `in_progress` on NCR closure.
4. Any verified passing test could satisfy any ITP item that required test
   evidence. Fixed in this stage by matching verified passing tests to each
   required ITP item by direct checklist-item link or normalized test type.
5. Failed ITP completion accepted `critical` NCR severity while the normal NCR
   workflow only supports `minor` and `major`. Fixed in this stage by aligning
   the ITP failure schema to the NCR workflow.
6. Test-results UI exposed Verify before a certificate was attached. Fixed in
   this stage by sharing a certificate-gated action helper across desktop and
   mobile test lists.
7. Lot closeout/readiness views could stay stale after ITP, hold-point, or NCR
   mutations. Fixed in this stage by invalidating lot, readiness,
   claim-readiness, and mobile badge readers after those closeout mutations.
8. NCR close/concession actions were visible to roles that the backend rejects,
   and concession was offered before verification. Fixed in this stage by
   sharing a role helper and limiting both actions to verification status.

Live pre-fix probe results:
- Owner registration, company/project/lot setup, ITP assignment, standard ITP
  completion, hold-point release request/read/release, test-result certificate
  attach/verify, and open-NCR conformance blocker all worked.
- Premature hold-point completion was correctly blocked before release.
- The authenticated hold-point release correctly updated the matching ITP
  completion to completed/verified.
- The first probe stopped at NCR submit-for-verification because the probe had
  not uploaded NCR evidence first. The probe has been updated to upload and link
  evidence before the submit step.

Run evidence:
- Report artifact:
  `.gstack/qa-reports/stage14-lot-closeout-20260621/qa-report.md` inside the QA
  worktree.
- Local focused backend regressions:
  - `npm test -- src/lib/conformancePrerequisites.test.ts src/lib/evidenceReadiness.test.ts src/routes/holdpoints/prerequisites.test.ts src/routes/ncrs/ncrLotStatus.test.ts` passed, 54 tests.
- Local focused frontend regressions:
  - `npm run test:unit -- src/pages/tests/constants.test.ts src/pages/lots/hooks/useItpInstance.test.ts src/pages/ncr/components/NCRTable.sort.test.tsx src/shell/screens/lots/test/useShellItpRun.test.ts` passed, 36 tests.
- Backend type-check, frontend type-check, backend format check, frontend format
  check, backend lint, frontend lint, and `git diff --check` passed.
- Fallow changed-code audit was refactored from a complexity failure to an
  advisory warning only. Remaining warnings are duplication in test setup and
  existing desktop/mobile or shell/subbie parallel UI paths touched by the fix.

Notes for Review:
- Post-merge production probe was rerun after PR #1017 and exposed a follow-up
  bug: `POST /api/lots` dropped `budgetAmount`, leaving the conformed lot
  blocked in claim readiness with `missing_budget`.
- PR #1018 fixed lot-create budget persistence for owner/admin/project-manager
  roles, kept site managers unable to set commercial budget values at create
  time, and normalized the audit log to a readable numeric budget value.
- Master CI run `27885688779` passed after #1018, including Backend, Frontend,
  and full Frontend E2E.
- The production Stage 14 probe then passed with the stricter claim-readiness
  assertion: the conformed lot appeared as claim state `ready`, blocker count
  `0`, and budget amount `10000`.
- Stage 15 picks up the backend audit follow-up found here: verified
  test-result corrections can still change/move verified evidence without
  clearing verification.

## Stage 15 - Test Result Evidence Immutability

Scope:
- Focused backend/API audit and visible-browser production probe for verified
  test-result corrections, lot reassignment, certificate replacement, extraction
  confirmation, and deletion paths.
- Frontend audit of desktop/mobile test-result actions and cache invalidation
  after test-result mutations.

Findings:
1. `PATCH /api/test-results/:id` let verifier roles change verified test data,
   including `lotId`, `resultValue`, and `passFail`, while leaving
   `status = verified` and verifier stamps intact. Fixed in this stage by
   reopening a verified result to `entered` and clearing `verifiedById` /
   `verifiedAt` whenever a verifier correction changes the row.
2. `POST /api/test-results/:id/certificate` could replace the certificate
   document on a verified test result without re-verification. Fixed in this
   stage by rejecting verified certificate replacement with HTTP 409 before any
   storage or document mutation.
3. `PATCH /api/test-results/:id/confirm-extraction` and
   `POST /api/test-results/batch-confirm` could apply extracted-data
   corrections to already verified rows. Fixed in this stage by rejecting
   verified confirmation; batch confirmation reports the row as a per-item
   failure without mutation.
4. `DELETE /api/test-results/:id` could remove verified evidence after closeout.
   Fixed in this stage by rejecting verified test-result deletion with HTTP 409.
5. Claim evidence presentation treated `verifiedById !== null` as verified.
   Fixed in this stage by using `status === verified`, making old stale verifier
   fields non-authoritative.
6. The test-results screen refreshed only its local list after mutations, leaving
   lot/readiness/claim-readiness caches stale. Fixed in this stage by
   invalidating project test results, lots, claim readiness, and affected lot
   detail/readiness keys after test-result mutations.

Live pre-fix probe results:
- Owner registration, company/project/lots creation, test-result creation,
  certificate attach, and verification all worked.
- A verified passing test could be patched to failing and moved to a different
  lot while remaining stored as `verified`.
- A verified test certificate could be replaced and the row still remained
  stored as `verified`.

Run evidence:
- Production repro probe:
  `.gstack/tmp/stage15-test-result-corrections-probe.js` inside the QA worktree.
- Local focused backend checks:
  - `npm test -- src/routes/testResults/certificateAttachment.test.ts src/routes/testResults/extractionConfirmation.test.ts` passed, 19 tests.
  - `npm run type-check` passed.
  - `npm run lint` passed.
- Local focused frontend checks:
  - `npm run test:unit -- TestResultsPage.test.tsx` passed, 8 tests.
  - `npm run type-check` passed.
  - `npm run lint` passed with one existing warning in
    `frontend/src/lib/theme.tsx`.
- `git diff --check` passed.
- PR #1019 merged as `93c07d62`; master CI run `27886644448` passed,
  including Backend, Frontend, and full Frontend E2E.
- Post-merge production probe passed:
  - verified result correction returned `status = entered` and persisted as no
    longer verified;
  - verified certificate replacement returned HTTP 409;
  - the active certificate document remained the original document after the
    blocked replacement.

Notes for Review:
- The DB-backed route regression tests were added to `testResults.test.ts`, but
  the file could not run locally because this worktree has no safe
  `DATABASE_URL`. They passed in CI as part of PR #1019 and the master run.

## Stage 16 - Claims Lifecycle Edge Cases

Scope:
- Focused owner-side claims lifecycle audit covering claim creation, partial
  claim increments, draft deletion, submit retry, dispute, certification, payment
  rounding, evidence package wording, and claims table cache/export behavior.
- Production browser/API probe using a fresh throwaway owner, company, project,
  lots, and claims against the live Railway backend.

Findings:
1. Zero-percent claim increments could create a no-value claim. Fixed by
   rejecting non-positive claim percentages before claim creation.
2. Claims could be marked disputed with a blank dispute reason. Fixed by
   requiring non-empty dispute notes whenever status moves to `disputed`.
3. Certification and payment amounts accepted sub-cent float values and stored
   float artifacts. Fixed by rounding certified, paid, payment-history, audit,
   and notification amounts to cents.
4. Retrying a generic submitted-status update could re-stamp `submittedAt` and
   add duplicate status-change audit entries. Fixed by making submitted-status
   retries idempotent.
5. Certifying a previously disputed claim left active dispute fields visible.
   Fixed by clearing active dispute fields while preserving the old dispute text
   as resolved certification metadata.
6. Draft claim deletion checked status before the transaction/row lock, leaving
   a stale-delete race against simultaneous submission. Fixed by moving the
   status check inside the locked transaction.
7. Claims UI mutations did not refresh all relevant claims/readiness/lots caches.
   Fixed by invalidating the claims, claim-readiness, lot, and dashboard readers
   after claims mutations.
8. The submit modal still referred to a claim package even though the current
   action exports the summary CSV/register. Fixed by updating the copy and E2E
   selectors.

Run evidence:
- PR #1021 merged as `fd0dee80` with the main claims lifecycle fixes.
- PR #1022 merged as `3fe9b944` to align the remaining claims E2E selector with
  the updated submit-modal copy.
- PR #1023 merged as `25c91eb0` to fix the claims test fixture's stale manual
  claim-number counter after master Backend CI exposed a collision.
- Local focused backend checks before #1021:
  - `npm test -- src/routes/claims/workflowValidation.test.ts` passed.
  - `npm run type-check` passed.
  - `npm run lint` passed.
- Local focused frontend checks before #1021:
  - `npm run test:unit -- src/pages/claims` passed, 95 tests.
  - `npm run type-check` passed.
  - `npm run lint` passed with the existing `frontend/src/lib/theme.tsx`
    fast-refresh warning.
  - `npx playwright test --grep @pr-smoke` passed after the submit-copy selector
    was updated.
- Follow-up local checks for #1023:
  - `npm run type-check`, `npm run lint`, `npm run format:check`,
    `npm run build`, and `git diff --check` passed in `backend/`.
  - DB-backed local `claims.test.ts` could not run because this worktree has no
    safe local `DATABASE_URL`; the CI Backend job supplied the PostgreSQL-backed
    verification.
- Final master CI run `27889159832` passed after #1023, including Backend,
  Frontend, and full post-merge Frontend E2E.
- Post-merge production probe passed on 2026-06-21:
  - zero-percent claim increment returned HTTP 400;
  - blank dispute reason returned HTTP 400;
  - certification amount `999.999` stored/read back as `1000`;
  - partial payment amount `333.333` stored/read back as `333.33`, including
    payment history, with outstanding amount `666.67`;
  - the probe completed with `findings: []`.

Notes for Review:
- The production probe script lives at
  `.gstack/tmp/stage16-claims-lifecycle-probe.js` inside the QA worktree. It
  creates throwaway production data and does not use external temp-email
  services.
- The final #1023 change is test-only; it protects CI from direct Prisma fixture
  claim-number collisions after route-created claims advance the same project's
  claim sequence.

## Stage 17 - Dockets Lifecycle Production Recheck

Scope:
- Re-ran the commercial dockets lifecycle against production after the Stage 5a
  fixes and the later docket lifecycle hardening.
- Used fresh throwaway owner, subcontractor, and unrelated outsider accounts.
- Exercised both API-level state transitions and visible browser verification
  for the owner and subcontractor surfaces.

Status: passed after one QA-found UI polish fix.

API run evidence:
- Run: `stage17-308bb7b653dc`.
- Result: 40 checks, 0 failures.
- Covered owner registration, company creation, project creation,
  subcontractor invite acceptance, scoped `my-company`, valid portal access
  keys, invalid `dockets` portal key rejection, roster setup, assigned lot
  setup, empty docket submit guard, missing start-time guard, labour cost
  calculation, plant cost calculation, adjusted approval, query/response,
  rejection, owner/subbie list/detail reads, diary auto-sync, and unrelated
  outsider denial.

Visible browser evidence:
- Subcontractor docket history showed rejected, queried/approved,
  adjusted/approved, and draft dockets.
- Subcontractor approved docket detail showed submitted and approved labour,
  submitted and approved plant, summary totals, and the adjustment reason.
- Owner project dockets list showed approved submitted-vs-approved values,
  rejected/query states, and the operational summary.
- Owner approved docket read-only modal showed docket details and no longer
  rendered `Rejection Reason`, `Approval Notes`, `Query Details`, or voice input
  controls.
- No console errors were observed on the verified owner or subcontractor pages.

Related merged work:
- #1025 - Fix docket lifecycle approval edge cases, merged as `1703433e`.
- #1026 - Fix docket reachability E2E project links, merged as `3ff38353`.
- #1027 - Hide docket action notes in view mode, merged as `5867b76f`.

Verification:
- PR #1027 local focused check:
  `npm run test:unit -- DocketActionModal.test.tsx` passed, 15 tests.
- PR #1027 local frontend `format:check`, `lint -- --quiet`, `git diff --check`,
  and changed-file `fallow:audit` passed. The only lint warning was the existing
  fast-refresh warning in `frontend/src/lib/theme.tsx`.
- PR #1027 CI passed: Frontend, PR E2E smoke, Detect changes, and Vercel
  ignored-build.
- Master CI run `27891667191` passed after #1027, including Backend, Frontend,
  and full Frontend E2E.
- Production health after deploy: frontend returned HTTP 200 and backend
  `/ready` returned HTTP 200. The production frontend served asset
  `assets/index-BbNtblpr.js` during the final verification.

Notes for Review:
- Query response resubmits the docket to `pending_approval` by design. This is
  covered by `backend/src/routes/dockets/review.ts` and the route tests.
- `dockets` is intentionally not a subcontractor portal access key. The valid
  keys remain `lots`, `itps`, `holdPoints`, `testResults`, `ncrs`, and
  `documents`.
- The visible QA browser initially held the old frontend bundle through the
  service worker and showed the app update banner. The QA browser was refreshed
  to the new bundle before final verification.

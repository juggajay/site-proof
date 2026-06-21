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

## Stage 18 - Daily Diary Lifecycle and Reporting

Scope:

- Re-ran the daily diary lifecycle against production with fresh throwaway
  owner, foreman, viewer, and outsider users.
- Covered backend/API behavior for diary creation, draft updates, all diary item
  families, submit validation, submitted-record locking, addendums, delay
  register export, diary reporting, and project access control.
- Covered visible browser behavior for the foreman mobile diary shell, desktop
  diary deep links, delay register filtering/export, diary report filters, PDF
  generation, and submitted-diary addendums.

Status: passed after four QA-found fixes.

API run evidence:

- Run: `stage18-1782013003377-6wtqv2`.
- Result: 63 checks, 0 findings.
- Covered owner/company/project setup, foreman and viewer project membership,
  missing-diary null reads for the shell, invalid date and temperature guards,
  previous personnel/plant carry-forward without source IDs, create/update/delete
  paths for personnel, plant, activities, delays, deliveries, events, and
  visitors, cross-project lot rejection, complete-diary validation, sparse-diary
  warning acknowledgement, successful submit, submitted-diary mutation guards,
  blank addendum rejection, submitted-diary addendum creation and readback,
  diary detail/timeline/list reads, delay register filtering and CSV export,
  recent plant and activity suggestions, diary report section summaries, invalid
  report-section rejection, viewer read-only access, and outsider denial.

Visible browser evidence:

- Foreman mobile diary shell showed the expected path/work/review screens for
  the live Stage 18 diary.
- After #1029, the submitted mobile review page no longer showed the
  slide-to-submit control and instead showed the locked submitted state.
- After #1030, desktop direct navigation to
  `/projects/:projectId/diary?date=2026-06-19` preserved the requested date,
  populated the date input with `2026-06-19`, and requested
  `/api/diary/:projectId/2026-06-19?missing=null`.
- After #1031, the delay register Weather filter returned the stored `Weather`
  delay and the UI showed 1 delay / 2.0 hours. The CSV export button requested
  `/api/diary/project/:projectId/delays/export?delayType=weather` with HTTP 200
  and no console errors.
- After #1032, the diary report Today preset stayed mounted through loading.
  A follow-up Weather-only generate requested
  `sections=weather&startDate=2026-06-21&endDate=2026-06-21`, kept both date
  inputs at `2026-06-21`, and showed 1 total diary / 1 submitted / 0 drafts /
  1 section.
- The submitted desktop diary kept original weather fields disabled, accepted a
  new addendum through `POST /api/diary/:id/addendum` with HTTP 201, and rendered
  the addendum in the Addendums section.
- The Daily Diary `Print` action lazy-loaded the PDF generator and jsPDF assets
  without console errors.
- No console errors were observed on the verified Stage 18 production browser
  pages after the fixes were deployed.

Related merged work:

- #1029 - Hide diary submit controls after submission, merged as `27222784`.
- #1030 - Respect diary date query parameter, merged as `d0aa1b14`.
- #1031 - Fix delay register filters for mixed diary labels, merged as
  `7851a618`.
- #1032 - Preserve report filters while loading, merged as `4cde91ae`.

Verification:

- #1029 local focused check:
  `npm run test:unit -- ReviewScreen.test.tsx` passed.
- #1030 local focused checks:
  `npm run test:unit -- DailyDiaryPage.test.tsx ReviewScreen.test.tsx`,
  frontend `type-check`, `lint -- --quiet`, `format:check`, `git diff --check`,
  and changed-file `fallow:audit` passed.
- #1031 local focused checks:
  backend `format:check`, `type-check`, `lint`, `git diff --check`, and
  changed-file `fallow:audit` passed. The local DB-backed `diary.test.ts` run
  was blocked by the intentionally absent local `DATABASE_URL`; the CI Backend
  job supplied PostgreSQL-backed verification.
- #1032 local focused checks:
  `npm run test:unit -- ReportsPage.test.tsx`, frontend `format:check`,
  `type-check`, `lint -- --quiet`, `git diff --check`, and changed-file
  `fallow:audit` passed. The only lint warning was the existing fast-refresh
  warning in `frontend/src/lib/theme.tsx`.
- PR #1032 CI passed: Frontend, Frontend PR E2E smoke, Detect changes, and
  Vercel ignored-build.
- Master CI run `27894493541` passed after #1032, including Backend, Frontend,
  and full post-merge Frontend E2E.
- Production health after #1032: Railway backend `/ready` returned HTTP 200 and
  the production frontend returned HTTP 200.

Artifacts:

- Production probe script:
  `.gstack/tmp/stage18-diary-lifecycle-probe.js` inside the QA worktree.
- Screenshots:
  - `.gstack/qa-reports/stage18-diary-lifecycle-20260621/screenshots/foreman-mobile-diary-path.png`
  - `.gstack/qa-reports/stage18-diary-lifecycle-20260621/screenshots/foreman-mobile-work.png`
  - `.gstack/qa-reports/stage18-diary-lifecycle-20260621/screenshots/foreman-mobile-review.png`
  - `.gstack/qa-reports/stage18-diary-lifecycle-20260621/screenshots/foreman-mobile-review-after.png`
  - `.gstack/qa-reports/stage18-diary-lifecycle-20260621/screenshots/foreman-mobile-review-after-mobile.png`
  - `.gstack/qa-reports/stage18-diary-lifecycle-20260621/screenshots/desktop-diary-date-query-after.png`
  - `.gstack/qa-reports/stage18-diary-lifecycle-20260621/screenshots/delay-register-weather-filter-after.png`
  - `.gstack/qa-reports/stage18-diary-lifecycle-20260621/screenshots/diary-report-preserve-filters-after.png`
  - `.gstack/qa-reports/stage18-diary-lifecycle-20260621/screenshots/desktop-diary-submitted-addendum-after.png`

Notes for Review:

- The Stage 18 browser used a visible production session and was refreshed after
  service-worker cache clearing before post-deploy verification.
- The production probe creates throwaway Stage 18 data and does not use external
  temporary-email services.

## Stage 19 - Account, Company, Project Settings, Notifications, and Audit Logs

Scope:

- Ran a production API and browser sweep over account settings, MFA,
  notification preferences, company settings, company limits, project settings,
  project team/areas/modules/notifications, audit logs, API keys, export/delete
  account guards, and role-gated settings surfaces.
- Used throwaway Stage 19 users only. No production customer data was used.
- Rechecked visible owner/admin and foreman browser behavior after fixes were
  merged.

Status: passed after two QA-found fixes and one test-only CI follow-up.

API run evidence:

- Production API probe completed with no remaining failing assertions after the
  MFA fix.
- Covered company member and user limits, project creation limits, project team
  and settings updates, project area create validation, notification email
  preferences and alert reads, audit log reads/filters, MFA setup/disable flows,
  password/export/delete-account guards, logout behavior, and API-key behavior.
- Confirmed MFA setup now rejects an invalid six-digit code with HTTP 400 and
  leaves MFA disabled; a valid current TOTP code enables MFA.

Visible browser evidence:

- Owner/admin settings pages loaded without console errors:
  `/settings`, `/company-settings`, `/audit-log`,
  `/projects/:projectId/settings?tab=general`,
  `/projects/:projectId/settings?tab=notifications`,
  `/projects/:projectId/settings?tab=modules`, and
  `/projects/:projectId/areas`.
- Project Areas production modal now says chainage bounds are required, marks
  both chainage inputs as required, and shows helper text that the end must be
  greater than the start.
- Name-only Project Area submission now shows the local required-chainage error,
  keeps the modal open, sends no project-area create request, and logs no
  console errors.
- Foreman direct-route checks rendered `Access Denied` for `/company-settings`,
  `/audit-log`, `/projects/:projectId/areas`, and
  `/projects/:projectId/settings?tab=general`; `/settings` remained available
  as an account-level page.

Related merged work:

- #1034 - Fix MFA verification result handling, merged as `d9d67efb`.
- #1035 - Fix project area chainage validation, merged as `d39d2233`.
- #1036 - Update project area E2E validation text, merged as `238ef2e5`.

Verification:

- #1034 local checks:
  - `npm run test -- src/lib/otpVerifyResult.test.ts` passed.
  - Backend `format:check`, `type-check`, `lint -- --quiet`, `build`, and
    `git diff --check` passed.
  - Local DB-backed `mfa.test.ts` was blocked by intentionally absent local
    `DATABASE_URL`; GitHub Backend CI supplied DB-backed verification.
- #1034 post-merge production verification:
  - backend `/ready` returned HTTP 200;
  - invalid MFA setup code returned HTTP 400 and did not enable MFA;
  - valid current TOTP code returned HTTP 200 and enabled MFA.
- #1035 local checks:
  - `npm run test:unit -- src/pages/projects/settings/projectAreaForm.test.ts src/pages/projects/settings/ProjectAreasPage.test.tsx`
    passed.
  - Frontend `format:check`, `type-check`, `lint -- --quiet`, and
    `git diff --check` passed.
  - Frontend build passed with a non-secret dummy `VITE_SENTRY_DSN`.
  - Changed-file `fallow audit --base origin/master --format json --quiet`
    passed.
- #1035 PR CI passed: Frontend, Frontend PR E2E smoke, Detect changes, and
  Vercel ignored-build.
- The first #1035 post-merge master run exposed one stale full-E2E assertion in
  `frontend/e2e/project-areas.spec.ts`; the app behavior was correct, but the
  test still expected the old `less than or equal` validation text.
- #1036 local check:
  `npm run test:e2e -- e2e/project-areas.spec.ts` passed, 4 tests.
- Final master CI run `27896744994` passed after #1036, including Backend,
  Frontend, and full post-merge Frontend E2E.

Observations for Review:

- Push notifications are visibly disabled in production because VAPID is not
  configured. The UI communicates this state; decide whether push should be
  configured before launch or left as a later enhancement.
- Write-scoped API keys can update company and project settings. Read-scoped
  API keys cannot write, and MFA setup rejects API-key sessions. Treat this as a
  product/security policy decision: either keep API-key settings automation or
  explicitly block API keys from sensitive settings writes.
- The custom `www.siteproof.com.au/login` route returned 404 during this stage;
  the verified production app URL remains `https://site-proof.vercel.app`.

Artifacts:

- Production API probe script:
  `.gstack/tmp/stage19-admin-settings-probe.js` inside the QA worktree.
- MFA production verification script:
  `.gstack/tmp/stage19-mfa-production-verify.js` inside the QA worktree.

## Stage 20 - Platform Edge, Public Auth Links, Portal Shells, and Webhooks

Scope:

- Ran production-safe checks over platform edge endpoints and supporting
  surfaces: support/contact, consent records, metrics access, webhooks, API
  keys, push notification configuration, account export, public auth-link
  screens, owner utility pages, foreman mobile dockets, and subcontractor portal
  shell routes.
- Used the visible gstack-controlled browser for the user-facing checks.
- Created only throwaway Stage 20 test data. No customer data or external
  temporary-email services were used.

Status: passed after one QA-found production fix.

API run evidence:

- Backend `/ready` returned HTTP 200.
- `/api/metrics` denied unauthenticated and foreman access, and allowed owner
  access.
- `/api/support/contact` and client-error reporting rejected invalid request
  bodies before any email send.
- Consent endpoints denied unauthenticated access and allowed current, single,
  bulk, history, withdraw-all, and post-withdraw current reads for the logged-in
  throwaway user.
- Webhook management denied unauthenticated and foreman access. It rejected
  private hosts, credentialed URLs, invalid event arrays, and production test
  receiver use.
- API key checks confirmed owner read-only key creation, read-only denial on
  admin-scoped webhooks, key revocation, and revoked-key rejection.
- Push notification status showed VAPID is not configured in production. Public
  key lookup returned the expected unavailable status, test send rejected a
  missing subscription, and malformed subscription writes were rejected.
- Account export returned an attachment response and the checked payload did not
  expose raw secrets, token hashes, API-key hashes, or webhook secrets.
- Public auth-link endpoint matrix passed 16 production checks:
  magic-link request validation, no-enumeration success for unknown email,
  existing throwaway-account magic-link request path, invalid magic-token
  rejection, forgot-password validation/no-enumeration, reset-token validation,
  magic-token rejection on reset, email verification invalid-token handling,
  resend-verification no-enumeration, and production disablement of the test auth
  helper.
- Webhook lifecycle CRUD passed on a temporary config pointed at
  `https://example.com/siteproof-stage20-webhook`: list, create, masked get,
  patch disable/events, delivery-history read, regenerate secret, masked
  list-after-regenerate, delete cleanup, and final absence check.

Visible browser evidence:

- Public mobile pages loaded without console errors:
  `/landing`, `/privacy-policy`, and `/terms-of-service`.
- Owner utility pages loaded without `Access Denied` or console errors:
  `/support`, `/docs`, `/profile`, and `/notifications`.
- The support form kept submit disabled until required fields were present; no
  live support request was sent in this pass.
- Invalid public auth links rendered recoverable user states:
  `/auth/magic-link?token=...` showed `Magic Link Error` and stripped the token
  from the URL; `/reset-password?token=...` showed `Invalid Reset Link`; and
  `/verify-email?token=...` showed `Verification Failed`.
- The visible login magic-link request flow switched modes, posted once to
  `/api/auth/magic-link/request`, returned HTTP 200 for a non-existent
  `.invalid` address, and showed `Magic link sent` with no console errors.
- The visible forgot-password flow posted once to `/api/auth/forgot-password`,
  returned HTTP 200 for a non-existent `.invalid` address, and showed the sent
  state with no console errors.
- Foreman `/m/dockets?projectId=:id` originally rendered the Dockets screen but
  made an avoidable bare `GET /api/dockets` call before the project ID resolved,
  causing a handled production HTTP 400 and browser console resource error.
- After #1038 deployed and the visible browser cache/service worker was cleared,
  the same foreman dockets route made only
  `GET /api/dockets?projectId=:id -> 200`, rendered the Dockets screen, and
  produced no console errors.
- A throwaway subcontractor portal identity was created through the production
  invitation/acceptance flow. Routes `/p`, `/p/docket`, `/p/dockets`, `/p/work`,
  `/p/quality`, `/p/itps`, `/p/docs`, `/p/ncrs`, and `/p/company` loaded without
  `Access Denied`, console errors, or 4xx/5xx API responses.
- Toggling the throwaway subcontractor's documents module off caused
  `/p/docs?projectId=:id` to show a gated/denied module state without console
  errors or failed API responses; the module was restored afterward.

Related merged work:

- #1038 - Fix foreman dockets shell project query gate, merged as `6336f335`.

Verification:

- #1038 local focused checks passed:
  - `npm run test:unit -- src/shell/screens/dockets/test/useDocketsShellData.test.tsx src/shell/screens/dockets/test/DocketsListScreen.test.tsx`
  - frontend `format:check`
  - frontend `type-check`
  - frontend `lint -- --quiet`
  - `git diff --check`
  - frontend production build with a non-secret dummy `VITE_SENTRY_DSN`
  - changed-file `fallow audit --base origin/master --format json --quiet`
- PR #1038 CI passed: Frontend, Frontend PR E2E smoke, Detect changes, and
  Vercel ignored-build. Backend was correctly skipped for the frontend-only
  change.
- Master CI run `27897965287` passed after #1038, including Backend, Frontend,
  and full post-merge Frontend E2E.
- Production verification after #1038 confirmed the live foreman dockets route no
  longer emits the bare `/api/dockets` request.

Artifacts:

- Production platform-edge probe script:
  `.gstack/tmp/stage20-platform-edge-probe.js`.
- Throwaway subcontractor setup script:
  `.gstack/tmp/stage20-subbie-setup.js`.
- Sensitive throwaway browser/session handoff files remain under ignored
  `.gstack/tmp/` paths and are not committed.

Observations for Review:

- Push notifications remain disabled in production because VAPID is not
  configured. The app handles this state cleanly; decide whether push is a launch
  requirement or a later enhancement.
- Full happy-path public auth-link verification still needs a mailbox-controlled
  test because the app correctly stores only hashed one-time tokens. This pass
  verified request/send paths, invalid-token UI, no-enumeration behavior, and
  production test-helper disablement, but did not click a delivered email link.
- Webhook CRUD and masking were verified live. Webhook delivery was not fired to
  a third-party receiver in this pass.
- Local Node fetch needed `NODE_TLS_REJECT_UNAUTHORIZED=0` for production API
  probes because this Windows/AVG Node trust store did not trust the leaf chain.
  PowerShell and the visible browser trusted production normally, so this appears
  to be a local test-runner certificate-store issue rather than an app issue.

## Stage 21 - Documents, Drawings, Reports, and File Access

Status: completed on production. No code fix was required in this stage.

Scope:

- Backend document download, signed URL generation, signed URL validation,
  deletion, and expiry.
- Project document, drawing, report, claim, cost, audit-log, and subcontractor
  document browser surfaces.
- Report role boundaries and report input validation.
- Drawing file-locator response behavior.
- Privacy export and audit-log secret redaction checks.
- CSV formula-injection hardening for shared frontend CSV exports.

Read-only mapping:

- Three read-only subagents mapped the backend and frontend file-access surfaces
  before live testing. They covered document signed URLs, project documents,
  drawings, reports, claims PDFs, NCR evidence, ITP/lot evidence, hold-point
  evidence packages, subcontractor documents, foreman file surfaces, comment
  attachments, and CSV/PDF export surfaces.
- The highest-risk checks selected from that map were stale signed URLs,
  deleted-file link behavior, raw storage URL leakage, subcontractor document
  scope, report role boundaries, privacy/audit export redaction, and public
  hold-point evidence leakage.

Production API evidence:

- A sacrificial document upload did not expose `fileUrl` in owner document list
  responses.
- Owner signed URL generation succeeded, public validation returned valid, and
  public download returned HTTP 200 with `Cache-Control: private, no-store,
  max-age=0`, `Pragma: no-cache`, `Referrer-Policy: no-referrer`, and
  `X-Content-Type-Options: nosniff`.
- The same signed token failed validation when paired with the wrong document.
- An outsider was denied signed URL generation with HTTP 403.
- A subcontractor with the documents portal module enabled could generate a
  signed URL for an allowed document; after the module was disabled, new signed
  URL generation was denied with HTTP 403.
- The pre-existing bearer signed URL still downloaded until expiry after module
  revocation. This is expected bearer-link behavior under the current design,
  but it should remain a documented product/security decision. If immediate
  revocation is required later, signed tokens need explicit revocation on portal
  access changes or public download must re-check current access.
- Restoring the subcontractor documents module succeeded, and the sacrificial
  document cleanup returned HTTP 204.
- A second sacrificial document confirmed delete/expiry behavior: after document
  deletion, public validation returned invalid and public download returned
  denied; a 1-minute token validated before expiry and invalidated after expiry.
- Report API matrix passed: lot status, NCR, test, diary, summary, and claims
  report endpoints returned HTTP 200 for the owner; invalid pagination, invalid
  date range, invalid diary sections, and invalid claim status returned HTTP
  400; subcontractor and outsider report access returned HTTP 403; foreman
  claims-report access returned HTTP 403.
- Scheduled reports were not created because the current subscription tier
  correctly returned HTTP 403 for scheduled-report access.
- Document list checks returned HTTP 200 for owner/subcontractor and HTTP 403
  for an outsider. Normal document list responses exposed no `fileUrl`, signed
  URL, raw storage URL, or token URL fields.
- Drawing list/current-set checks returned HTTP 200 for owner and HTTP 403 for a
  subcontractor. The project initially had no drawings.
- A sacrificial drawing upload returned HTTP 201, produced only a `supabase://`
  storage reference instead of a public HTTP storage URL, appeared normalized in
  list/current-set responses, and cleanup delete returned HTTP 204.
- Privacy export returned HTTP 200 and did not expose password hashes, reset
  tokens, verification tokens, bearer tokens, signed URL token hashes, API key
  hashes, push secrets, or environment secrets. The initial broad text probe
  matched harmless key names only.
- Audit log returned HTTP 200 and did not expose sensitive key/value paths in
  the inspected page. File-locator fields found in audit metadata were not raw
  HTTP storage URLs or signed URLs.

Visible browser evidence:

- Owner pages loaded in a headed Chromium browser with expected headings, no
  `Access Denied`, no page-level error state, no console errors, and no 4xx/5xx
  network responses:
  - `/projects/:projectId/documents` - `Documents & Photos`
  - `/projects/:projectId/drawings` - `Drawing Register`
  - `/projects/:projectId/reports` - `Reports & Analytics`
  - `/projects/:projectId/claims` - `Progress Claims`
  - `/projects/:projectId/costs` - `Project Costs`
  - `/audit-log` - `Audit Log`
- Subcontractor document pages loaded in a headed mobile browser with expected
  heading, no access denial, no error state, no console errors, no 4xx/5xx
  network responses, and no upload/add-document controls:
  - `/subcontractor-portal/documents`
  - `/p/docs`

Code-level hardening evidence:

- Shared frontend CSV downloads go through `frontend/src/lib/csv.ts`.
  `escapeCsvCell` prefixes formula-looking cells that begin with `=`, `+`, `-`,
  or `@`, and `downloadCsv` applies that escaping to all shared CSV exports.
- Drawing response mapping normalizes document locators to storage references
  rather than exposing raw public object URLs.

Not live-exercised in this stage:

- Public hold-point evidence package leakage with a valid public token. The
  current Stage 21 QA project had zero hold points, so there was no safe live
  token to inspect. Existing unit coverage characterizes public evidence package
  redaction, but this should be live-tested during a later hold-point/ITP stage
  by creating a sacrificial hold point and requesting release to a controlled
  mailbox.
- Comment attachment download drift after comment deletion or assignment/module
  change. This belongs with a later comments/activity sweep.
- Offline evidence retry/orphan behavior. This belongs with a later offline
  sync sweep.

Findings:

- No exploitable file-access issue was confirmed in Stage 21.
- No Stage 21 code change was required.
- The main product decision to keep visible is signed URL revocation semantics:
  a valid signed document URL is a bearer link until it expires, even if the
  user's portal module access is removed after minting.

Artifacts:

- Sensitive throwaway session files remain under ignored `.gstack/tmp/` paths
  and are not committed.
- No response bodies containing signed URLs, bearer tokens, credentials, or
  public-release tokens were committed or copied into this ledger.

## Stage 22 - Comments, Attachments, Notifications, Activity, and Audit Logs

Status: completed on production. Two code fixes were merged from this stage.

Scope:

- Comment create/list/edit/delete and attachment download lifecycle.
- Mention notifications, notification list/mutation ownership, and mention-user
  search boundaries.
- Audit-log role gates, metadata redaction, and visible audit UI access.
- Project dashboard recent activity, notification page behaviour, lot activity
  history refresh, and hold-point default notification recipients.
- System alert routing for stale hold points.

Read-only mapping:

- Three read-only subagents mapped the backend comments, notification, alert,
  audit, and activity routes plus the matching frontend surfaces before live
  testing.
- The highest-risk checks selected from that map were attachment URL leakage,
  author-only comment mutation, subcontractor lot-scoped comment visibility,
  mention-notification ownership, notification pagination/filter behaviour,
  audit-log role gates, stale activity data after failed refresh, future
  timestamp labels, and stale hold-point alert recipient roles.

Production API evidence:

- Comment attachment lifecycle passed on a sacrificial assigned lot:
  owner-created comment with attachment returned an attachment ID and
  `downloadUrl`, did not expose `fileUrl`, and did not leak raw storage locators
  in create/list responses.
- Comment list access was correct: owner and assigned subcontractor could see
  the lot comment, while an outsider received HTTP 403.
- Attachment download access was correct: unauthenticated request returned HTTP
  401, owner and assigned subcontractor received HTTP 200, and outsider received
  HTTP 403. The download response used `image/png` and `X-Content-Type-Options:
  nosniff`.
- Author-only mutation was enforced: a foreman who did not author the comment
  received HTTP 403 for edit, delete, and add-attachment attempts.
- Attachment cleanup worked: adding a second attachment returned HTTP 201 with
  no raw locator leakage; deleting it returned HTTP 200; download after
  attachment deletion returned HTTP 404.
- Mention notification ownership worked: the mentioned viewer received a
  notification with an internal app link; the owner could not mark the viewer's
  notification read, while the viewer could mark it read and delete it.
- Comment deletion cleaned up attachment access: after deleting the comment, the
  original attachment download returned HTTP 404 and the comment no longer
  appeared in list results.
- Notifications API matrix passed for owner: list, unread count, invalid
  `unreadOnly`, zero limit, invalid offset, and backend max-limit cap behaviour.
- Mention-user search matrix passed: owner search returned users without secret
  fields, outsider search returned HTTP 403, and overlong search returned HTTP
  400.
- Audit-log API matrix passed: owner/admin/project manager received HTTP 200;
  foreman/viewer/subcontractor/outsider received HTTP 403. Invalid page, limit,
  date, and reversed date filters returned HTTP 400. Actions, entity types, and
  users helper endpoints returned HTTP 200 for allowed access and did not expose
  secret-like fields in the inspected payload.

Visible browser evidence:

- Owner pages loaded in headed Chromium with no access denial, no page-level
  error state, no console errors, and no 4xx/5xx network responses:
  `/notifications`, `/settings`, and `/audit-log`.
- The owner settings page exposed notification preference controls.
- Viewer `/audit-log` showed a clean access-denied state with no console or
  network errors.

Confirmed issues fixed:

- CSV export formula escaping did not treat newline-prefixed formulas as formula
  starts. Fixed in #1041 by hardening `frontend/src/lib/csv.ts` and adding unit
  coverage for newline/whitespace formula prefixes.
- `/notifications` fetched the backend default page size only, so the in-page
  filters could silently filter only the first 20 notifications. Fixed in #1041
  by fetching the backend max page size used by that screen.
- Future notification/dashboard timestamps rendered as `Just now`. Fixed in
  #1041 by labelling future timestamps as `Scheduled`.
- Lot activity history could keep stale entries after a failed refresh. Fixed in
  #1041 by clearing lot history before fetch and on fetch failure.
- Dashboard recent activity carried safe internal links but rendered them as
  inert text. Fixed in #1041 by making only safe internal paths clickable.
- Hold-point default-recipient duplicate detection was case-sensitive for roles.
  Fixed in #1041 by comparing trimmed lower-case role/email pairs.
- Stale hold-point system alerts only targeted legacy `superintendent`,
  project-manager, and quality roles in some paths. Current project settings
  create canonical site roles, so site managers/site engineers could miss stale
  hold-point alerts. Fixed in #1042 by sharing one escalation config across
  manual routes and scheduled automation, adding canonical site roles while
  keeping legacy `superintendent` compatibility.

Related merged work:

- #1041 - Fix Stage 22 notification and CSV hardening, merged as
  `28a4eb1f`.
- #1042 - Fix stale hold point alert recipient roles, merged as `dc0942df`.

Verification:

- #1041 local checks passed:
  - `npm run test:unit -- src/lib/csv.test.ts src/pages/lots/hooks/useLotTabData.test.ts src/components/dashboard/ProjectDashboardParts.test.tsx src/components/dashboard/RecentActivityWidget.test.tsx src/pages/projects/settings/components/notificationSettingsHelpers.test.ts`
  - frontend `format:check`
  - frontend `type-check`
  - frontend `lint -- --quiet` with the existing `theme.tsx` fast-refresh
    warning only
  - `git diff --check`
  - frontend production build with a non-secret dummy `VITE_SENTRY_DSN`
  - changed-file `fallow audit --base origin/master --format json --quiet`,
    advisory `warn` only for inherited complexity and test mock duplication
- PR #1041 CI passed: Frontend, Frontend PR E2E smoke, Detect changes, and
  Vercel ignored-build. Backend was correctly skipped for the frontend-only PR.
- Master CI run `27900380039` passed after #1041, including Backend, Frontend,
  and full post-merge Frontend E2E.
- #1042 local checks passed:
  - `npm test -- src/lib/notificationAutomation/systemAutomation.test.ts src/lib/notificationAutomation/alertEscalations.test.ts src/routes/notifications/alertPersistence.test.ts`
  - backend `format:check`
  - backend `lint -- --quiet`
  - backend `type-check`
  - backend `build`
  - `git diff --check`
  - changed-file `fallow audit --base origin/master --format json --quiet`,
    verdict `pass`
- PR #1042 CI passed: Backend, Frontend PR E2E smoke, Detect changes, and
  Vercel ignored-build. Frontend was correctly skipped for the backend-only PR.
- Master CI run `27900955155` passed after #1042, including Backend, Frontend,
  and full post-merge Frontend E2E.

Not live-exercised in this stage:

- Real email delivery for mention notifications. This stage verified in-app
  mention notification creation/mutation ownership, not outbound mailbox
  delivery.
- Push notification delivery, because production VAPID push configuration is
  still intentionally absent.
- Browser-driven comment creation/editing through every frontend comment widget.
  The backend lifecycle was exercised live with production-safe API calls; the
  visible browser pass covered the high-level notification/settings/audit pages.

Findings:

- No exploitable comment attachment, notification ownership, or audit-log access
  issue was confirmed in Stage 22.
- The main issues were correctness/polish items that could mislead users:
  stale notification filtering, stale lot activity history, misleading future
  timestamps, inert activity links, case-sensitive duplicate HP recipients, and
  stale hold-point alerts missing current canonical site roles.

Artifacts:

- Sensitive throwaway session files remain under ignored `.gstack/tmp/` paths
  and are not committed.
- No comment attachment download URLs, notification IDs tied to credentials,
  bearer tokens, or session cookies were committed or copied into this ledger.

## Stage 23 - Project Admin Guardrails and Copy Accuracy

Status: completed. Four code fixes were merged from this stage.

Scope:

- Archived project write protection for high-risk project-scoped mutations.
- Dashboard company/team shortcut behaviour for non-admin company roles.
- Project settings module copy accuracy.
- Company member invite failure rollback and audit-log retention.

Confirmed issues fixed:

- Archived projects still allowed some write endpoints after a project entered a
  read-only state. Fixed in #1049 by enforcing archived-project read-only checks
  on the affected backend write routes and adding regression coverage.
- The dashboard `Team Members` KPI could send non-admin company users to a
  company-settings route they cannot access. Fixed in #1050 by making the KPI
  role-aware: owners/admins keep the company settings destination, while other
  company roles get the project-access destination.
- Project Settings > Modules copy implied that toggles controlled backend
  feature/data access. Fixed in #1051 by clarifying that current module toggles
  are navigation/shortcut controls, and by updating matching documentation.
- Failed company-member invite email delivery could delete historical
  `USER_INVITED` audit rows for that user during rollback. Fixed in #1052 by
  preserving prior audit evidence and recording the new invite audit only after
  invite/setup email delivery succeeds.

Related merged work:

- #1049 - Enforce archived project read-only writes, merged as `5b7fbc70`.
- #1050 - Fix dashboard team KPI access dead end, merged as `34ffa680`.
- #1051 - Clarify project module shortcut settings, merged as `ce0c418c`.
- #1052 - Preserve company invite audit history on email failure, merged as
  `fe2a807e`.

Verification:

- #1049 PR CI passed, and master CI run `27903863371` passed after merge,
  including Backend, Frontend, and full post-merge Frontend E2E.
- #1050 PR CI passed, and master CI run `27904478315` passed after merge,
  including Backend, Frontend, and full post-merge Frontend E2E.
- #1051 PR CI passed, and master CI run `27905051177` passed after merge,
  including Backend, Frontend, and full post-merge Frontend E2E.
- #1052 local checks passed:
  - backend `db:generate`
  - backend `type-check`
  - backend `lint -- --quiet`
  - backend `format:check`
  - backend `build`
  - `git diff --check`
  - changed-file `fallow audit --base origin/master --format json --quiet`,
    verdict `pass` with inherited findings only
- #1052 focused `company.test.ts` could not be run in the local checkout
  because no safe local `DATABASE_URL` is configured; a disposable Docker
  Postgres attempt was blocked because Docker Desktop's Linux engine was not
  running. PR #1052 Backend CI supplied the PostgreSQL-backed verification and
  passed.
- Master CI run `27905699826` passed after #1052, including Backend, Frontend,
  and full post-merge Frontend E2E.

Not live-exercised in this stage:

- End-to-end browser walkthroughs for every archived-project mutation surface.
  This stage was code-and-test focused, with CI regression coverage carrying the
  write-protection and invite-rollback behaviours.
- Real outbound invite email delivery. #1052 verifies rollback/audit ordering
  around simulated email failure; deliverability belongs in a separate email
  pass.

Findings:

- No new exploitable access-control issue was confirmed during this stage.
- The main risks were product trust and supportability issues: writes after
  archive, dead-end navigation for non-admin users, copy overstating module
  enforcement, and audit history loss during failed re-invites.

Artifacts:

- No credentials, invite tokens, session cookies, or email setup links were
  committed or copied into this ledger.

## Stage 24 - Lot Comments and Activity History Browser QA

Status: completed. One production bug was fixed and merged from this stage.

Scope:

- Browser-driven lot comment lifecycle on a production-safe throwaway lot.
- Comment attachment upload/download rendering and access.
- Author-only comment edit/delete controls across owner/project-manager users.
- Mention notification creation for a project member.
- Lot History tab behaviour for current lot audit records.

Production API and visible-browser evidence:

- Owner comment creation passed in headed Chromium: empty composer disabled the
  submit button, markdown content and a project-member mention posted with HTTP
  201, and rendered safely in the lot Comments tab.
- Comment attachment upload passed: the selected file rendered in the draft,
  the multipart comment posted with HTTP 201, the attachment rendered with
  filename and size, and an authenticated download returned HTTP 200.
- Nested reply create/delete passed through the browser: reply composer
  enabled only after content, reply posted with HTTP 201, and owner deletion
  removed the reply after confirmation.
- Owner edit passed through normal browser input: the edited comment saved with
  HTTP 200 and showed the edited badge.
- Project-manager member access was correct: the member could view the owner
  comments and attachment, could not see owner edit/delete controls, could post
  their own comment, and received the mention notification.
- Cross-company outsider API checks returned HTTP 403 for lot comments.
- Unsupported comment entity type returned HTTP 400.
- Legacy standalone comment attachment upload endpoint returned HTTP 410.
- Client-supplied attachment locator payloads were rejected with HTTP 400.

Confirmed issue fixed:

- Lot History showed `No Activity History` for newly created lots even though a
  `lot_created` audit record existed. Root cause: the lot page queried
  `entityType=Lot`, while current lot creation writes `entityType: 'lot'`, and
  the audit-log API filter was case-sensitive. Fixed in #1054 by keeping the
  filter exact but making it case-insensitive, with regression coverage for an
  uppercase `Lot` query returning lowercase `lot` records.

Related merged work:

- #1054 - Fix audit log entity type filtering, merged as `1e5e7383`.

Verification:

- Before the fix, production API evidence matched the browser empty state:
  `entityType=Lot` returned zero records, while `entityType=lot` and search-only
  returned the existing `lot:lot_created` record for the same lot.
- #1054 local checks passed:
  - backend `type-check`
  - backend `lint`
  - backend `format:check`
  - `git diff --check`
  - changed-file `fallow audit --base origin/master --format json --quiet`,
    verdict `pass` with no introduced findings
- Local DB-backed `auditLog.test.ts` could not run because this machine has no
  disposable local Postgres running and the repo safety guard correctly refused
  to use the Railway database.
- PR #1054 CI passed, including Backend with the PostgreSQL-backed regression
  test and Frontend PR E2E smoke.
- After #1054 merged, production `/ready` returned HTTP 200 and the same
  uppercase `Lot` production API query returned the existing
  `lot:lot_created` audit record.
- The visible browser History tab then showed the `lot_created` Activity
  History row instead of the empty state.

Not live-exercised in this stage:

- Email delivery for mentions. This stage verified in-app mention notification
  creation and ownership, not outbound mailbox delivery.
- Every non-lot comment surface. Code mapping found the reusable comment UI is
  currently on the Lot page; adjacent document/evidence upload surfaces remain
  separate domains.
- Full audit-log admin export flow. This stage only touched the lot-scoped
  History read path and role/access checks relevant to lot activity visibility.

Findings:

- No exploitable comment attachment or comment mutation access issue was
  confirmed.
- The main confirmed defect was a trust/polish issue: valid lot activity existed
  but the UI incorrectly told users no history had been recorded.

Artifacts:

- Ignored screenshots and scratch files remain under `.gstack/qa-reports/` and
  `.gstack/tmp/` in the Stage 24 worktree.
- No bearer tokens, session cookies, generated passwords, attachment download
  URLs, or notification IDs tied to credentials were committed or copied into
  this ledger.

## Stage 25 - Reports and Scheduled Reports Backend QA

Status: completed. One backend code fix was merged from this stage.

Scope:

- Backend report/export and scheduled-report route mapping.
- Frontend Reports-page control mapping and role/tier expectations.
- Scheduled-report worker delivery flow and failure-mode review.
- Code fixes for confirmed backend report/scheduled-report defects.

Subagent coverage:

- Backend reports mapper reviewed report endpoints, role gates, validation, and
  high-risk backend bug candidates.
- Frontend reports mapper reviewed route access, tab controls, schedule modal
  behaviour, export copy, and browser-QA targets.
- Scheduled-report worker mapper reviewed delivery entrypoints, timing,
  recipient handling, and retry/duplicate-send risks.
- A final diff-review agent checked the Stage 25 code changes and found two
  pre-PR issues: schedule claim eligibility needed an atomic recheck, and diary
  summaries should not load every filtered diary row. Both were fixed before
  merge.

Confirmed issues fixed:

- Scheduled reports could be created on archived/read-only projects because
  `POST /api/reports/schedules` did not request writable project access. Fixed
  in #1056 by applying the archived-project write gate to create, matching the
  existing update/delete behaviour.
- Existing due scheduled reports could keep sending after a project was archived
  or a company was below the scheduled-report tier. Fixed in #1056 by filtering
  worker selection to active projects on eligible tiers and repeating that same
  eligibility check during the atomic schedule claim.
- Diary report summary counts were page-scoped while `totalDiaries` was
  full-filter scoped. Fixed in #1056 by computing status, weather, personnel,
  plant, activity, and delay summaries from the full filtered set while keeping
  detail rows paginated.
- The first diary-summary fix loaded all filtered diary rows and selected child
  records, which was correct but risky for large projects. Before merge, #1056
  replaced that with aggregate/groupBy summary queries.

Related merged work:

- #1056 - Fix report schedule edge cases, merged as `5df87a4e`.

Verification:

- #1056 local checks passed:
  - backend `format:check`
  - backend `lint`
  - backend `type-check`
  - backend `build`
  - `git diff --check`
  - changed-file `fallow audit --base origin/master --format json --quiet`,
    verdict `pass` with no introduced findings
- Local DB-backed `scheduledReports.test.ts` and `reports.test.ts` could not be
  run because this machine has no safe local Postgres target. CI supplied the
  PostgreSQL-backed verification.
- PR #1056 CI run `27907940112` passed, including Backend and Frontend PR E2E
  smoke. Frontend and full E2E were correctly skipped on the PR because this was
  a backend-only change.
- Master CI run `27908076304` passed after merge, including Backend, Frontend,
  and full post-merge Frontend E2E.
- After merge, production health checks returned HTTP 200 for:
  - `https://site-proof-production.up.railway.app/ready`
  - `https://site-proof.vercel.app`

Not live-exercised in this stage:

- Real scheduled-report email delivery to external recipients. The worker path
  is covered by DB-backed CI tests with queued email assertions, but no
  production email was intentionally sent during this pass.
- Browser walkthroughs for every Reports tab after #1056. This stage focused on
  backend correctness and worker safety; the frontend mapper produced a browser
  QA checklist for a later UI pass.
- Timezone semantics for scheduled report `timeOfDay`. Current scheduling still
  uses server-local time; project/company timezone support remains a separate
  product decision.
- Duplicate-email recovery if the provider send succeeds and the post-send DB
  update fails. That remains an architectural reliability follow-up.
- Dead-letter handling for permanently invalid stored schedules. Invalid stored
  schedules currently retry rather than being parked after a retry cap.

Remaining findings for a later pass:

- The schedule modal should be browser-tested as a project-scoped viewer on an
  eligible-tier company. Backend denies mutation, but the UI should ideally hide
  write controls instead of letting a viewer reach a denied action.
- Reports help copy says PDF or CSV export, while the mapped UI only exposes
  `Print / Save PDF` for Test Results. Either add the missing export controls or
  narrow the copy.
- Claims report UI has no visible date/status filters even though the backend
  supports claim filters. This is a usability/commercial-reporting follow-up.
- `GET /api/reports/schedules` currently requires writable project access even
  though it is read-only. That may be acceptable product policy, but it should
  be explicitly decided.
- Manual scheduled-report processing still cannot target a single schedule ID,
  which makes production-safe one-off delivery testing awkward.

Artifacts:

- No bearer tokens, session cookies, production secrets, email payloads,
  schedule IDs tied to credentials, or recipient-specific delivery evidence were
  committed or copied into this ledger.

## Stage 26 - Reports UI Role, Claims Filter, and Schedule Modal QA

Status: completed. One frontend/UI code fix was merged from this stage.

Scope:

- Reports page frontend role/tier gating for Claims and scheduled-report
  controls.
- Schedule modal load-error behaviour and small mobile layout risks.
- Claims report UI controls against the backend's existing date/status filters.
- Reports help copy compared with the actions currently exposed in the UI.

Subagent coverage:

- Fixture/auth mapper confirmed a fresh production-safe registration can only
  create a `basic` company, so eligible-tier schedule modal QA needs either an
  existing eligible company or mocked/stubbed browser coverage.
- Frontend reports mapper found the likely mismatches: viewer-accessible
  schedule controls, `+ New Schedule` after schedule-load errors, overbroad
  export help copy, missing Claims filters, and mobile overflow risks.
- Existing coverage mapper confirmed backend scheduled-report access tests are
  strong, while frontend coverage was mostly admin happy path and needed viewer
  and basic-tier regressions.

Confirmed issues fixed:

- Eligible-tier report viewers could see the `Schedule Reports` control even
  though backend schedule routes allow only owner/admin/project-manager roles.
  Fixed in #1058 by deriving the project-scoped role in `ReportsPage` and only
  showing schedule management to commercial roles.
- Report viewers could also reach the commercial Claims report tab, which the
  backend denies to non-commercial roles. Fixed in #1058 by hiding Claims for
  non-commercial report viewers and redirecting stale `?tab=claims` deep links
  back to Lot Status.
- The schedule modal exposed `+ New Schedule` after a schedule-list load error.
  Fixed in #1058 by making creation fail closed until schedules load
  successfully.
- Claims report date/status filters existed in the backend but not in the UI.
  Fixed in #1058 by adding period-end date range and status controls wired to
  `startDate`, `endDate`, and `status`.
- Reports help copy promised PDF or CSV export, while the mapped UI exposes
  print/save-PDF rather than a CSV export action. Fixed in #1058 by narrowing
  the help copy.
- Mobile layout risks in Reports tabs and the schedule modal were reduced by
  making tab navigation horizontally scrollable and stacking schedule form/list
  controls on small screens.

Related merged work:

- #1058 - Fix reports schedule access and claim filters, merged as `08bb7432`.

Verification:

- #1058 local checks passed:
  - frontend `type-check`
  - frontend targeted unit tests:
    `npm run test:unit -- src/pages/reports/ReportsPage.test.tsx src/components/reports/scheduleReportModalHelpers.test.ts`
  - frontend reports E2E:
    `npx playwright test e2e/reports.spec.ts --project=chromium`
  - frontend production-readiness guard:
    `npx playwright test e2e/productionReadiness.spec.ts --project=chromium -g "scheduled reports are capped per project across API and UI"`
  - frontend `format:check`
  - frontend `lint`, passing with the existing unrelated
    `src/lib/theme.tsx` fast-refresh warning
  - `git diff --check`
  - changed-file `fallow audit --base origin/master --format json --quiet`,
    verdict `warn` for inherited E2E helper complexity/duplication in
    `reports.spec.ts`, with no dead-code findings
- PR #1058 initially failed the Frontend job because the static
  production-readiness guard still expected the old
  `disabled={hasReachedScheduleLimit}` literal. The guard was updated to assert
  the stronger `canCreateSchedule` gate and the PR checks then passed.
- Master CI run `27909145462` passed after merge, including Backend, Frontend,
  and full post-merge Frontend E2E.
- After merge, production health checks returned HTTP 200 for:
  - `https://site-proof-production.up.railway.app/ready`
  - `https://site-proof.vercel.app`

Not live-exercised in this stage:

- A real production eligible-tier viewer account. Fresh production-safe
  onboarding creates `basic` companies only, so the viewer/professional path was
  covered with E2E mocks rather than by mutating production subscription data.
- Real scheduled-report creation/delivery. This stage intentionally avoided
  creating active production schedules or sending external report emails.
- Visible Chrome automation. The existing Chrome automation session was blocked
  by an extension UI overlay, so the browser verification used isolated
  Playwright/Chromium E2E instead.

Remaining findings for a later pass:

- `GET /api/reports/schedules` still requires schedule-management access even
  though it is read-only. #1058 makes the UI match current backend policy, but
  the product decision remains whether read-only schedule visibility should be
  allowed.
- Timezone semantics for scheduled report `timeOfDay` are still server-local
  and were not changed in this UI pass.
- Duplicate-email recovery if an email provider send succeeds but the post-send
  DB update fails remains an architectural reliability follow-up.
- Dead-letter handling for permanently invalid stored schedules remains open.

Artifacts:

- No bearer tokens, session cookies, generated passwords, production secrets,
  recipient emails, schedule IDs tied to credentials, or browser-session data
  were committed or copied into this ledger.

## Stage 27 - Operational Access, Scheduled Reports, and Session Cache QA

Status: completed. One code PR was merged from this stage.

Scope:

- Operational/access QA follow-ups around project-scoped roles, lot editing,
  dockets, project settings, and report scheduling.
- Scheduled-report worker failure behaviour and UI visibility for delivery
  failures.
- Signed document URL cache invalidation across auth/session transitions.
- Reports schedule modal behaviour under async company-tier loading.

Subagent coverage:

- A read-only sidecar agent reviewed the Stage 27 diff and called out a
  document-access/auth circular dependency, coarse `dashboardRole` leakage into
  project-specific commercial surfaces, and scheduled-report failure semantics.
  The circular dependency was removed by splitting cache state into
  `documentAccessCache.ts`; the current-project role issues were fixed where the
  project API can provide the real role.
- The sidecar also flagged the broader sidebar/route limitation where login
  `dashboardRole` still cannot always distinguish `site_manager` from
  `foreman`. That was not widened globally in this stage; project-detail
  surfaces now use the live project role where available.

Confirmed issues fixed:

- Invalid stored scheduled reports could retry indefinitely without durable
  operator-visible failure state. Fixed in #1060 by adding
  `failureCount`, `lastFailureAt`, and `lastFailureReason`, retrying transient
  failures, and auto-pausing a schedule after three failed delivery attempts.
- Reactivating a paused/failed scheduled report now clears failure metadata and
  recalculates an overdue or missing `nextRunAt`, avoiding immediate surprise
  delivery on reactivation.
- The schedule modal now displays retrying/paused failure states and the last
  delivery error, and monthly schedules expose all day-of-month choices from
  1-31.
- Signed document URLs cached for one user/session could survive sign-in,
  sign-up, OAuth/magic-token, sign-out, refresh-expiry, or session-expired
  transitions. Fixed by centralising the document-access cache and clearing it
  on auth boundary changes.
- Project list/detail responses no longer expose `contractValue` based on a
  user's broader company role when their current project role is non-commercial.
  `/api/projects/:id` now returns `currentUserRole`; dockets and project
  settings use that role when deciding whether the current project can approve
  dockets or view/manage commercial settings.
- Lot edit access is now separated from subcontractor assignment access: quality
  and site-engineering roles can edit lot details without automatically getting
  subcontractor assignment controls.
- A fast click on `Schedule Reports` before `/api/company` returned could route
  an eligible paid user to the upgrade/Advanced Analytics tab because the page
  defaulted the tier to `basic`. Fixed by treating the tier as unknown until
  loaded and disabling the schedule action during that short window.

Related merged work:

- #1060 - Fix stage 27 operational access QA issues, merged as `201f50ba`.

Verification:

- #1060 local checks passed:
  - backend `type-check`
  - backend `lint`
  - backend `format:check`
  - backend Prisma schema validation with a dummy local `DATABASE_URL`
  - frontend `type-check`
  - frontend `lint`, passing with the existing unrelated
    `src/lib/theme.tsx` fast-refresh warning
  - frontend `format:check`
  - frontend targeted unit tests:
    `npm run test:unit -- src/App.projectScopedCommercialRoutes.test.tsx src/pages/lots/components/LotHeader.test.tsx src/components/reports/scheduleReportModalHelpers.test.ts src/lib/documentAccess.test.ts src/lib/auth.test.tsx src/pages/dockets/docketApprovalsData.test.ts`
  - headed reports E2E:
    `npx playwright test e2e/reports.spec.ts --project=chromium --headed`
  - `git diff --check`
  - changed-file `fallow audit --base origin/master --format json --quiet`,
    verdict `warn`; no introduced dead code, cycles, or complexity. Remaining
    introduced warnings were the established repeated E2E auth-state fixture
    pattern involving `frontend/e2e/reports.spec.ts`.
- PR #1060 checks passed before merge: Backend, Frontend, Frontend PR E2E smoke,
  Detect changes, and Vercel's ignored-build status.
- Master CI run `27911290154` passed after merge, including Backend, Frontend,
  and full post-merge Frontend E2E.
- After merge, production health checks returned HTTP 200 for:
  - `https://site-proof-production.up.railway.app/ready`
  - `https://site-proof.vercel.app`

Not live-exercised in this stage:

- Local backend DB-backed tests were not run from the worktree because there was
  no safe disposable local Postgres URL. The same changed backend suites ran in
  CI against disposable CI databases.
- Real production scheduled-report delivery was not triggered. The stage avoided
  creating active production schedules or sending external report emails.
- Real live multi-user browser QA for each role was not repeated after these
  fixes; the role/access regressions were covered with unit, route, and E2E
  fixtures.

Remaining findings for a later pass:

- Consider extracting the repeated Playwright auth-state setup into a shared E2E
  helper. Fallow still warns on that existing fixture pattern when any E2E file
  adds another instance.
- `GET /api/reports/schedules` still requires schedule-management access even
  though it is read-only. The UI matches current backend policy, but the product
  decision remains whether read-only schedule visibility should be allowed.
- Timezone semantics for scheduled report `timeOfDay` are still server-local and
  were not changed in this stage.
- Duplicate-email recovery if an email provider send succeeds but the post-send
  DB update fails remains an architectural reliability follow-up.
- Login-time `dashboardRole` still cannot fully express every project-specific
  role distinction for global navigation. Project-detail surfaces now prefer
  live `currentUserRole`, but broader route/sidebar cleanup remains separate.

Artifacts:

- No bearer tokens, session cookies, generated passwords, production secrets,
  recipient emails, schedule IDs tied to credentials, or browser-session data
  were committed or copied into this ledger.

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

## Next Stage Candidate

Stage 5 should target commercial workflows end to end: dockets, docket
adjustment reasons, subcontractor docket visibility, claims/payment-claim
evidence packages, claim approvals/rejections, and commercial access guards.

A separate email-focused pass should follow when Jay can confirm inbox receipt:
invites, magic login, password reset, hold-point public token release, and
notification emails.

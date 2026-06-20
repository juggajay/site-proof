# Live Staged QA Ledger - 2026-06-20

This ledger tracks the staged live QA pass Jay requested: test one area at a
time in browsers/API, fix issues through PR/CI/merge, retest production, and
keep going until the app has been exercised end to end.

## Current External Blocker

- Email-dependent flows are parked because production Resend is returning
  `daily_quota_exceeded`.
- Parked flows: invite emails, magic login links, password reset emails, hold
  point superintendent emails, notification test emails, and any browser QA that
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

## Next Stage Candidate

Stage 3 should move into project quality workflows that do not require email:
lots, ITP templates/instances, ITP item pass/fail, hold-point request/record
release without external superintendent email, NCR create/evidence/closure, and
document/evidence attachment behavior.

Email-specific hold-point superintendent release should be rerun after Resend
quota is available again.

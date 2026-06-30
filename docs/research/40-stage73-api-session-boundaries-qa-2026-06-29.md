# Stage 73 API Key and Browser Session Boundary QA

Date: 2026-06-29
Branch: `qa/api-session-boundaries-pass`
Base: `origin/master`

## Numbering Note

This pass was initially resumed under an older local label from the Stage 63
workstream. The research folder now records global QA stages through Stage 72,
so this report is numbered Stage 73. Smaller labels such as "stage 14/15" in
subtask notes are not global QA stages.

## Scope

This pass followed up the Stage 62 deferred finding that some sensitive
browser-only mutations could be reached with API-key authentication because the
global API-key middleware populates `req.user`.

The audit focused on mutation routes where an API key should not be allowed to
act like an interactive browser session:

- Company profile, logo upload, and company leave.
- Project create, sample project create, settings update, deletion, team, and
  area administration.
- Consent writes and consent withdrawal.
- Browser push subscription, push send/test, unsubscribe, and local VAPID key
  generation.
- Subcontractor invitation, status/delete, portal access, roster, and plant
  administration.

Three parallel read-only agents mapped backend routes, frontend/browser
workflows, and test coverage before the patch was selected.

## Fixed In This Stage

1. Added a shared `requireBrowserSession` guard in
   `backend/src/middleware/browserSession.ts`.

2. Reused the shared guard from the existing MFA and company-member protection
   paths so the browser-session rule has one implementation.

3. Blocked API-key-authenticated company profile updates, company logo uploads,
   and company leave.

4. Blocked API-key-authenticated project creation, sample project creation,
   project settings updates, project deletion, project team mutations, and
   project area mutations.

5. Blocked API-key-authenticated consent recording, bulk consent recording, and
   consent withdrawal.

6. Blocked API-key-authenticated push subscription/device mutations and push
   send/test/configuration endpoints.

7. Blocked API-key-authenticated subcontractor admin mutations including
   invite, status, delete, portal access, employee roster, and plant register
   writes.

8. Added route regression tests for each guarded area so future API-key scope
   expansion does not silently reopen these browser-only mutation paths.

## Product Decision Left Intact

Webhook management was not changed in this pass. Existing tests intentionally
allow admin-scoped API keys to manage webhooks, which appears to be an intended
integration API. If the product wants webhooks to become browser-only too, that
should be a deliberate API contract change rather than folded into this
hardening patch.

## Verification

Passed locally:

- Backend `npm run type-check`.
- Backend `npm run lint`.
- Prettier write/check through formatting of all touched backend files.

Attempted locally:

- Backend targeted route suite:
  `npm run test -- src/routes/company.test.ts src/routes/consent.test.ts src/routes/projects.test.ts src/routes/projects/sampleProjectRoute.test.ts src/routes/pushNotifications.test.ts src/routes/subcontractors.test.ts`.

The targeted route suite did not reach assertions locally because this isolated
worktree has no safe disposable `DATABASE_URL`, and Docker Desktop was not
running to start a local Postgres instance. The same DB-backed route tests are
expected to run in GitHub Actions against the disposable CI Postgres service.

## Deferred Findings

- Decide whether webhook management should remain API-key manageable or become
  browser-session-only.
- Continue a later pass over remaining lower-risk browser-only surfaces such as
  account export, notification alert creation, and any route-local mutations
  outside the project/company/subcontractor/admin surfaces covered here.
- Consider adding a formal API-key scope model that distinguishes integration
  APIs from browser-session mutations instead of relying only on route-level
  browser-session guards.

## Artifacts

No bearer tokens, session cookies, generated passwords, production secrets,
external email contents, or browser-session data were committed or copied into
this report.

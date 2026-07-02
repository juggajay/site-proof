# Stage 61 Company Admin Integration QA - 2026-06-28

## Scope

Audited company-admin and integration surfaces after the earlier staged QA work:

- Company API key inventory and same-company key revocation.
- Company member invite attach races and company audit-log durability.
- Company webhooks, including destructive UI actions and outbound delivery safety.
- Audit-log route/sidebar access for project-scoped commercial quality roles.
- Company settings and audit-log responsive/mobile usability.

This stage used isolated worktree `qa/stage61-company-admin` and kept the dirty
main checkout untouched.

## Confirmed Issues Fixed

### Company admins could see API keys but not revoke member keys

Company API key inventory exposed same-company member keys, but revocation was
only available through the creator-owned key route. A company admin could see a
risky active integration key but had no company-level kill switch.

Fix:

- Added `DELETE /api/company/api-keys/:keyId`.
- Requires browser session plus company owner/admin role.
- Rejects API-key-auth management attempts and cross-company revokes.
- Writes `API_KEY_REVOKED` audit in the same transaction as the revoke.
- Updated the frontend inventory flow to use the company route for active rows.

### Webhook destructive actions were too easy to trigger

Webhook deletion and signing-secret rotation were one-click actions. API key
revocation also had no explicit confirmation.

Fix:

- Added confirmation dialogs for API-key revocation, webhook deletion, and
  webhook signing-secret regeneration.
- Clarified that regenerating a signing secret invalidates the old secret.
- Improved narrow-screen layouts for company integrations.

### Webhook outbound delivery was vulnerable to DNS rebinding

Webhook destination validation blocked private/local destinations at save/test
time, but production delivery later used raw `fetch` against the URL. A hostname
could validate to a public IP and later resolve to a private IP during delivery.

Fix:

- Added shared destination safety checks for private, loopback, link-local,
  multicast, and reserved IPv4/IPv6 ranges.
- Production delivery re-resolves the host before sending.
- Production delivery connects to the checked public IP while preserving Host
  and SNI.
- Destination validation failures are not retried as transient webhook failures.

### Existing-user company invites could race across companies

Two companies could invite the same existing no-company user concurrently. The
attach path did not make the "still unclaimed or same company" predicate part of
the update.

Fix:

- Existing-user invite attach now uses conditional `updateMany`.
- The attach succeeds only if the target user still has no company or already
  belongs to the same company.
- Added a concurrent invite regression using a PostgreSQL trigger/sleep.

### Some privileged company writes were not atomically audited

Company creation, profile/logo updates, leave, and API-key company revoke needed
stronger audit durability.

Fix:

- Moved company creation/profile/logo audit writes into the same transaction as
  the mutation.
- Moved company leave audit into the same transaction.
- API-key company revoke writes audit in the revoke transaction.

Invite email audit remains best-effort after email send because changing email
rollback semantics would be a larger product/reliability decision.

### Audit-log access missed project-scoped quality managers

The audit-log route and sidebar used broader company-level assumptions and did
not line up with project-scoped commercial access.

Fix:

- `/audit-log` now allows project-scoped audit roles.
- Sidebar audit-log visibility uses the audit-log access check without exposing
  Company Settings.
- Audit-log table narrow-screen reachability was tightened.

## Pull Request

- PR #1195: `Fix company admin integration safety`
- Merged to `master` as `c71c8f57187720600c3dcf62975bf31d4ed4374b`.

## Verification

Local verification before merge:

- Frontend targeted unit tests: 30 passed.
- Frontend Playwright company settings + audit-log E2E: 16 passed.
- Backend webhook delivery/validation tests: 11 passed.
- Backend `npm run type-check`: passed.
- Frontend `npm run type-check`: passed.
- Backend `npm run lint`: passed with existing warning in
  `backend/src/lib/dataRetention.test.ts`.
- Frontend `npm run lint`: passed with existing warning in
  `frontend/src/lib/theme.tsx`.
- Backend `npm run format:check`: passed.
- Frontend `npm run format:check`: passed.
- `git diff --check -- backend frontend`: passed.
- `npm run test:readiness`: 87 passed.
- `npm run fallow:audit`: advisory fail only for complexity/duplication, with
  no dead code issues.

CI and production gates:

- Initial PR CI found one readiness allowlist miss for the new webhook delivery
  transport file. Fixed in commit `470cad5b`.
- Final PR #1195 checks passed.
- Post-merge master CI run `28311134850` passed, including Backend, Frontend,
  and full Frontend E2E.
- Fresh database backup run `28311457633` passed before production migrations.
- Production migrations run `28311478152` passed. It applied the pending
  additive migrations that production was missing:
  - `20260622090000_add_scheduled_report_failure_state`
  - `20260626120000_add_ncr_client_approval_reference`
  - `20260627090000_add_user_onboarding_completed_at`
- Production preflight retry `28311497721` passed after migrations.

## Not Covered

- No real customer webhook receiver was configured or called.
- No real production API key was created for this stage.
- Real browser dogfood of every company-admin path should still be repeated
  with sacrificial data in a visible browser.
- Existing local DB-backed `company.test.ts` could not run in the worktree
  because the local test DB schema was behind current master; CI covered the
  DB-backed tests against disposable databases.

## Follow-Ups

- Decide whether invite email audit should be made atomic via an outbox pattern.
- Add broader webhook event wiring beyond the current lot/business-event set.
- Consider extracting large company settings tests/components flagged by fallow
  once the staged QA bugfix loop slows down.

No bearer tokens, session cookies, generated passwords, production secrets,
webhook URLs, webhook secrets, or browser-session data were written to this
report.

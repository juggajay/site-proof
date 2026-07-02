# Production Behaviour Audit Sweep - 2026-06-13

## Scope

This sweep looked at a different risk angle from the earlier lot/ITP/subcontractor workflow audits: release gates, public bearer-link surfaces, background jobs, observability, data retention, and cross-tenant response shaping.

Audit source: clean worktree from latest deployed master at `141a7fb`.

No production credentials, cookies, session data, or private records were used.

## Method

- Reviewed CI and production preflight workflows.
- Traced backend worker startup and email-producing background jobs.
- Rechecked unauthenticated/public routes against route coverage tests.
- Compared subcontractor lot list and lot detail response shaping.
- Reviewed signed document links, hold-point evidence links, and subcontractor invitation payloads.
- Checked production logging, client error reporting, push notification config, and retention scripts.

## Findings

### P1 - Subcontractor lot list can leak another assigned subcontractor's company

Evidence:

- `backend/src/routes/lots/listQuery.ts:43-51` selects `assignedSubcontractorId` and `assignedSubcontractor.companyName`.
- `backend/src/routes/lots/listPresentation.ts:34-49` filters `subcontractorAssignments`, but spreads every other selected field back into the response unchanged.
- `backend/src/routes/lots/detailPresentation.ts:47-73` already hides `assignedSubcontractorId` and `assignedSubcontractor` from subcontractors unless the legacy assigned subcontractor is their own company.
- `backend/src/routes/lots/readRoutes.ts:126-164` allows subcontractors to see lots through either legacy `assignedSubcontractorId` or active `LotSubcontractorAssignment`.

Impact:

If a lot has multiple active assignment rows, but the legacy `assignedSubcontractorId` points to company A, company B can still receive company A's id/name in the lot list response. The detail route already handles this correctly, so the bug is a list/detail mismatch.

Recommended fix:

Make `presentLotList` mirror the detail presenter:

- For subcontractor users, keep `assignedSubcontractorId` only when it equals the resolved subcontractor company id.
- Null `assignedSubcontractor` unless it is the caller's company.
- Add a backend test where the caller has an active assignment but `assignedSubcontractorId` points to another subcontractor.

### P1 - Background email jobs are not outbox/idempotent

Evidence:

- `backend/src/server.ts:167-169` starts scheduled reports, digest notifications, and notification automation from the web server process.
- `backend/src/lib/scheduledReports.ts:58-86` claims a scheduled report by moving `nextRunAt` into a lock window.
- `backend/src/lib/scheduledReports.ts:125-143` sends email first, then updates `lastSentAt` and the next run time.
- `backend/src/lib/notificationJobs.ts:154-164` sends a daily digest email first, then deletes the digest rows.
- `backend/src/lib/notificationJobs.ts:238-254` holds a Postgres transaction/advisory lock while running the unlocked digest processing.
- `backend/src/lib/notificationAutomation/runner.ts:72-88` holds a transaction/advisory lock while running notification automation.

Impact:

These workers are safe enough for a single instance most of the time, but they can duplicate external side effects if a process crashes after email success but before the database cleanup/update. They also keep DB transactions open while email/network work may happen. This becomes more important if Railway scales to more than one backend instance, if the email provider stalls, or if the process restarts during job execution.

Recommended fix:

Move email-producing scheduled work to an outbox model:

- Create durable rows with `pending`, `sending`, `sent`, `failed`.
- Use a `dedupeKey` for scheduled report period/user/project and digest period/user.
- Mark intent before sending email.
- Store provider message id when available.
- Keep advisory locks short; do not hold a transaction open around network sends.

### P2 - PR CI does not run E2E checks before merge

Evidence:

- `.github/workflows/ci.yml:222-226` defines `frontend-e2e` with `if: github.event_name != 'pull_request'`.
- `.github/workflows/production-preflight.yml:4` is manual `workflow_dispatch` only.

Impact:

PRs can merge with backend/frontend checks green but without E2E coverage. E2E then runs only after code reaches a pushed branch such as master. That saves GitHub minutes, but it means browser-flow regressions are detected later than the merge decision.

Recommended fix:

Keep the full E2E suite cost-controlled, but add a small PR smoke suite:

- Login/auth bootstrap.
- Create/open project.
- Lot list/detail access.
- ITP pass/fail or readonly denial path.
- Hold-point evidence link route loads.
- Subcontractor portal access smoke.

Leave the heavier production-readiness suite for push/nightly/manual preflight.

### P2 - Production preflight exists but is not a normal release gate

Evidence:

- `.github/workflows/production-preflight.yml:4` only runs manually.

Impact:

The preflight checks important production assumptions, but they depend on someone remembering to run them. Config drift in email, storage, OAuth, push, rate limit store, or environment variables may not be caught before a release.

Recommended fix:

Run preflight automatically on one of:

- Main branch after CI and before deploy.
- Nightly against production/staging.
- Manual release train step with required status.

### P2 - Public bearer-link surfaces should be hardened and documented

Evidence:

- `backend/src/routes/holdpoints.ts:63-202` exposes public hold-point evidence by token.
- `backend/src/routes/holdpoints/evidencePackage.ts:153,197,216` returns evidence file URLs in the public package payload.
- `backend/src/routes/documents/fileHelpers.ts:63-116` stores and validates multi-use signed URL tokens until expiry.
- `backend/src/routes/subcontractors/invitationResponses.ts:44-58` returns subcontractor invitation details including full contact email/name before authentication.

Impact:

These routes appear intentional and are protected by bearer tokens or invite ids, but they carry real project/contact data outside normal login. A leaked email link gives access until expiry, and the subcontractor invite detail route reveals full invited contact details by id.

Recommended hardening:

- Mask invited email/name on unauthenticated invitation detail; reveal full data only after login or submit validation.
- Add audit events for public hold-point evidence opens and document signed-link downloads.
- Confirm public evidence package file URLs are short-lived or private-gated, not reusable public storage URLs.
- Keep token TTLs short for external superintendent links.

### P2 - Expired bearer-token cleanup is incomplete/manual

Evidence:

- `backend/scripts/data-retention.ts:287-312` deletes expired password reset/email verification tokens and old sync queue rows.
- `backend/src/routes/documents/fileHelpers.ts:63-64` cleans expired document signed URL tokens opportunistically when generating/validating tokens.
- `backend/src/routes/holdpoints/requestReleaseRoutes.ts:285-291` deletes previous unused hold-point release tokens for the same hold point during a new request, but there is no general scheduled cleanup for old used/expired hold-point tokens.

Impact:

Expired public-access token rows can accumulate unless matching flows are hit again. This is not an immediate access-control bug because expiry is checked, but it is weak retention hygiene for bearer-link data.

Recommended fix:

Extend `backend/scripts/data-retention.ts` and/or a scheduled cleanup job to delete:

- Expired `DocumentSignedUrlToken` rows.
- Expired or old used `HoldPointReleaseToken` rows.
- Old OAuth state/callback rows if not already covered by route cleanup cadence.

### P3 - Production error monitoring is mostly logs/support email, not an external tracker

Evidence:

- `backend/src/middleware/errorHandler.ts:165-168` has a placeholder `sendToMonitoringService`.
- `frontend/src/lib/logger.ts:72-113` reports fatal client errors to `/api/support/client-error` in production.
- `backend/src/routes/support.ts:217-255` logs client errors and attempts to email support.
- `backend/src/server.ts:143-144` rate-limits public support/client-error posts.

Impact:

There is useful structured logging and sanitized client-error capture, but there is no external crash dashboard/alerting integration visible in the code. In early user rollout, rare field-only issues may be discovered only through support emails or manual log review.

Recommended fix:

Wire the monitoring hook to Sentry/Datadog/Rollbar or a similarly searchable alerting system. Tag events by environment, company id when authenticated, project id when available, release SHA, route, and user role. Keep log sanitization rules in place.

### P3 - Push notifications can be silently unavailable in production

Evidence:

- `backend/src/lib/runtimeConfig.ts:246-275` requires valid VAPID subject only when VAPID keys are present.
- `backend/src/routes/pushNotifications/delivery.ts:83-91` skips push delivery if the push config is not configured.
- `frontend/src/components/settings/PushNotificationSettings.tsx:226-236` tells the user push is not configured.

Impact:

This is acceptable if push is optional. If push is part of the intended launch promise, production can come up with push disabled rather than failing readiness.

Recommended fix:

Decide whether push is launch-critical. If yes, make production VAPID keys mandatory in runtime config and production preflight. If no, keep current behavior and mark push as optional in launch docs.

### P3 - Large workflow files remain high-risk maintenance hotspots

Evidence from production file line count sweep:

- `frontend/src/lib/offline/syncWorker.ts` - 668 lines.
- `frontend/src/components/foreman/DiaryFinishFlow.tsx` - 636 lines.
- `frontend/src/pages/itp/ITPPage.tsx` - 594 lines.
- `backend/src/routes/holdpoints/actionRoutes.ts` - 568 lines.
- `frontend/src/shell/screens/lots/ItpRunScreen.tsx` - 561 lines.
- `backend/src/routes/ncrs/ncrCore.ts` - 531 lines.
- `frontend/src/App.tsx` - 520 lines.
- `backend/src/routes/claims/workflowRoutes.ts` - 515 lines.

Impact:

These files are where regressions are most likely when future changes land. This is especially true for offline sync, ITP run screens, hold-point email/release behavior, and claims workflows.

Recommended fix:

Do not refactor all at once. For each future bug fix, extract only the logic needed to make that behavior testable:

- Pure response presenters.
- Small mutation helpers.
- Offline queue executors by entity type.
- Email/job outbox handlers.

## Positive Findings

- `backend/src/lib/routeAuthCoverage.test.ts` explicitly freezes the intended public API surface. That is a strong control against accidental unauthenticated routes.
- Runtime config blocks several dangerous production states: mock OAuth, mock email, local storage in production, missing database secrets, bad production URLs, and memory rate-limit store.
- Subcontractor project access is centralized through `backend/src/lib/projectAccess.ts`, and several surfaces correctly filter by active subcontractor assignment.
- Lot detail response shaping already handles the legacy assigned subcontractor privacy issue correctly; the list endpoint can reuse that pattern.
- Document signed URL generation checks `canReadDocument` before issuing a token.

## Ruled Out In This Sweep

- The webhook test receiver is not a production exposure; it rejects production access.
- OAuth mock pages/test auth endpoints are gated from production.
- Budget/contract values are generally hidden correctly from subcontractor users in project and lot responses.
- Rate limiting uses the database store in production unless explicitly misconfigured, and runtime config rejects memory store in production.

## Suggested Fix Order

1. Fix the subcontractor lot-list response leak and add the missing test.
2. Add a small PR E2E smoke suite while keeping the expensive suite push/nightly/manual.
3. Turn production preflight into a scheduled or release-gated check.
4. Design the outbox/idempotency change for scheduled reports and notification digests.
5. Harden public bearer-link surfaces: masked invite details, audit opens/downloads, token cleanup.
6. Decide whether push notifications are optional or required for launch.
7. Wire external error monitoring before inviting real customers.

## Next Audit Angle

The next high-value sweep should be a live dogfood audit with sacrificial users:

- Owner/admin creates project, lots, ITPs, subcontractor, superintendent release.
- Foreman completes ITP and raises NCR/evidence on mobile.
- Subcontractor completes allowed work and is denied disallowed work.
- External superintendent opens evidence links from email.
- Offline mode is toggled mid-flow and sync is observed after reconnect.
- Repeat with one suspended/removed subcontractor to verify access disappears everywhere.

That live pass is the best way to find issues static code review will miss.

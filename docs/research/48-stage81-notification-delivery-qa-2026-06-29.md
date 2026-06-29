# Stage 81 Notification Delivery QA

Date: 2026-06-29
Branch/worktree: `qa/stage81-notification-delivery` at `a9fa213e`
Scope: notification delivery links, NCR subcontractor notification dispatch, scheduled-report delivery reliability, webhook delivery reliability.

## Stage Numbering Note

This is global audit Stage 81. Earlier local worktree names with lower stage numbers were narrow workstream labels and are not the global audit count.

## How This Stage Was Audited

- Continued from Stage 80's integration/reporting findings.
- Spawned three read-only subagents:
  - scheduled-report delivery and repair UI
  - notification dispatch, email preferences, digest fairness, and deep links
  - webhook durability and admin debug UX
- Locally inspected and fixed the narrow issues that could be made safer without schema or worker changes.
- Deferred durable outbox/report artifact work because it needs migrations, workers, UI state, and retry semantics.

## Fixed In This Stage

1. Subcontractor NCR notifications now use the shared notification dispatch helper.
   - Before: `notifySubcontractorNcrPortalUsers` wrote `Notification` rows directly, so web push did not fan out through `notificationDispatch`.
   - After: it calls `createNotificationsForRecipients`, preserving in-app notifications and enabling existing push fan-out behavior.

2. Subcontractor NCR notification emails now respect NCR preference categories.
   - Assignment/redirect notifications map to `ncrAssigned`.
   - Response accepted, revision requested, and rectification rejected notifications map to `ncrStatusChange`.
   - Email failures are logged but do not block the in-app notification or main workflow.

3. Subcontractor lot-assignment notifications now deep-link to the subcontractor portal.
   - Before: lot assignment notifications sent subcontractor users to `/projects/:projectId/lots/:lotId`, an internal project route.
   - After: links use `/subcontractor-portal/work?...` through `buildSubcontractorPortalEntityLink`.

4. Hold-point escalation notifications now deep-link to the real hold-point route.
   - Before: escalation notifications linked to `/projects/:projectId/holdpoints/:id`, which does not match the frontend route.
   - After: links use `buildProjectEntityLink('hold_point', ...)`, which produces `/projects/:projectId/hold-points?holdPoint=:id`.

## Findings That Need Separate Follow-Up

### High: Webhook Delivery Needs A Durable Outbox

Webhook delivery is still fire-and-forget. Delivery rows are written only after the HTTP retry loop finishes, so a process restart can lose a business event without a failed delivery row.

Recommended follow-up:
- add pending delivery/outbox rows with status, attempts, and next retry time
- claim and send rows through a worker
- add manual replay from the admin UI

### High: Scheduled Reports Need Per-Recipient Run Tracking

Partial recipient failures are still marked as a sent schedule. Retrying the whole schedule would duplicate already-sent emails, so the correct fix is per-recipient delivery state.

Recommended follow-up:
- add scheduled report run / recipient delivery records
- track `sent`, `failed`, `queued`, and `suppressed`
- retry only failed recipients
- show partial failures and repair actions in the schedule UI

### High: Scheduled Report Digest Links Are Live Views, Not Snapshots

Immediate recipients receive an attached generated PDF. Digest recipients receive only a live Reports page link, so opening it later may show changed project data.

Recommended follow-up:
- persist immutable scheduled-report artifacts
- link immediate emails and digest items to the same artifact
- label any remaining live links clearly

### Medium: Notification Dispatch Migration Is Incomplete

Several workflows still write notifications directly. Stage 81 improved NCR subcontractor notifications, but claims, dockets, test results, alerts, and some automation flows still need migration to a central dispatcher or outbox.

Recommended follow-up:
- migrate direct `prisma.notification.create/createMany` call sites
- define how post-transaction push/email dispatch runs
- add tests proving each customer-visible notification type reaches inbox, email/digest where expected, and push where configured

### Medium: Email Preference Categories Are Too Coarse

Claims, dockets, test results, and team membership notifications often use the global `enabled` category, so users cannot opt into digest/opt-out per workflow.

Recommended follow-up:
- add explicit preference keys for dockets, claims/commercial, test results, and project/team membership
- update Settings UI copy
- update delivery tests

### Medium: Digest Failure Fairness

Digest users are selected in stable `userId` order with a hard `take` limit. A repeatedly failing early user can keep consuming a batch slot.

Recommended follow-up:
- add digest retry/backoff metadata
- or rotate/paginate selection around recently failed users
- add a regression test with `limit: 1` and a failing first user

### Medium: Webhook Admin Debuggability

The backend has delivery history, but the frontend does not expose recent real delivery status, response previews, failed counts, or replay.

Recommended follow-up:
- add `fetchWebhookDeliveries`
- show last delivery status per webhook
- add a delivery details drawer and failed-delivery replay action

## Verification

Passed locally:
- `backend`: `npm test -- src/routes/ncrs/ncrNotifications.test.ts`
- `backend`: `npm test -- src/routes/ncrs/ncrNotifications.test.ts src/routes/notifications/links.test.ts`
- `backend`: `npm run type-check`
- `backend`: `npm run lint`
- `git diff --check`

Not run locally:
- full DB-backed route suites, because this machine can have production DB env configured and repo rules forbid production DB testing. CI should run them against safe test services.


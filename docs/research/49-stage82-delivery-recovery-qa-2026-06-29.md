# Stage 82 Delivery Recovery QA

Date: 2026-06-29
Branch/worktree: `qa/stage82-delivery-recovery`
Scope: webhook delivery recovery, notification digest retry behavior, email preference timing, notification navigation, and scheduled-report recovery design.

## Stage Numbering Note

This is global audit Stage 82. Older Stage 14/15 labels in previous QA ledgers were historical local labels, not the current global audit count. New reports should use the global stage number.

## How This Stage Was Audited

- Continued from Stage 81's notification delivery and integration findings.
- Spawned three read-only subagents:
  - webhook durability, replay, and admin debugging
  - scheduled-report delivery, recovery, and artifact handling
  - notification digest retry fairness and notification navigation
- Used targeted static readiness checks and mocked Playwright browser flows because the in-app browser tool was not available in this session.
- Avoided production data and production DB testing.

## Fixed In This Stage

1. Notification digest failures now back off failed items instead of repeatedly consuming the same batch slot.
   - Added retry metadata to `NotificationDigestItem`: failure count, last failure time, failure reason, and next attempt time.
   - `processDueNotificationDigests` now skips digest rows whose next attempt time is still in the future.
   - Failed sends update only the rows included in that email attempt, so old rows that were not attempted are not hidden.

2. Digest timing no longer falls through to immediate email when Daily Digest is disabled.
   - Backend notification delivery now suppresses digest-timed emails if the user has Daily Digest off.
   - Notification automation follows the same rule.
   - Settings UI disables the Digest timing option until Daily Digest is enabled.

3. Notification links open even if marking the notification as read fails.
   - Before: navigation waited for the mark-read mutation success callback.
   - After: mark-read is best effort, and safe internal links open immediately.

4. Webhook delivery creates visible pending history before sending.
   - Delivery records are created before URL validation and network delivery starts.
   - DNS/private-network validation failures update the pending delivery row with a failed status.
   - This is not a full durable outbox, but it improves operator visibility for deliveries that fail before a final HTTP response.

5. Webhook response previews and log text redaction are safer.
   - Response body previews are sanitized before being stored.
   - Log sanitization now redacts JSON-style sensitive keys in addition to query/header-style secrets.

6. Corrupted stored webhook event filters now fail closed.
   - Before: invalid JSON in the stored event list parsed as `['*']`.
   - After: invalid JSON parses to `[]`, avoiding accidental all-event dispatch.

7. Manual webhook test payloads no longer expose the triggering user's email address.
   - The payload now sends the triggering user id instead of the admin email.

## Findings That Need Separate Follow-Up

### High: Webhook Delivery Still Needs A Durable Outbox

Stage 82 records a pending delivery before network send, but the business event can still be lost if the process exits before the asynchronous delivery task inserts or updates all required state.

Recommended follow-up:
- create durable outbox rows transactionally with the business event
- add status, attempt count, next attempt time, and terminal error fields
- deliver through a worker
- add manual replay for failed deliveries

### High: Scheduled Reports Need Per-Recipient Delivery Tracking

Scheduled reports can still drop partial recipient failures or duplicate already-sent recipients if a retry is attempted at the schedule level.

Recommended follow-up:
- add scheduled report run and recipient delivery records
- track sent, failed, queued, suppressed, and retryable state per recipient
- retry only failed recipients
- expose partial failures and repair actions in the schedule UI

### High: Scheduled Reports Need Immutable Artifacts

Immediate scheduled-report emails generate a PDF attachment, but digest links can point users at a live report page that may show changed project data.

Recommended follow-up:
- persist the generated report artifact
- attach or link the same immutable artifact for immediate and digest delivery
- show artifact generation status and failure reason in admin/reporting UI

### Medium: Digest Recovery Needs An Admin Dead-Letter Path

Digest failures now back off, but there is still no max-failure dead-letter queue or admin retry screen.

Recommended follow-up:
- add max attempt handling
- surface failed digest items in an admin recovery view
- add manual retry and suppress actions

### Medium: Webhook Admin Debuggability Still Needs UI

The backend stores webhook delivery rows, but the owner UI still does not show recent deliveries, response previews, failed counts, or replay controls.

Recommended follow-up:
- add `fetchWebhookDeliveries`
- show last delivery status beside each webhook
- add a delivery details drawer
- add replay for failed delivery rows after the durable outbox lands

### Medium: Push Dispatch Is Still Inconsistently Centralized

Some workflows still bypass shared dispatch helpers and write notification rows directly.

Recommended follow-up:
- migrate remaining direct `prisma.notification.create/createMany` sites to shared dispatch
- define post-transaction push/email dispatch semantics
- add per-workflow notification delivery tests

## Verification

Passed locally:
- `backend`: `npx prisma generate`
- `backend`: `npm run type-check`
- `backend`: `npm run lint`
- `backend`: `npm test -- src/routes/webhooks/delivery.test.ts src/routes/webhooks/validation.test.ts src/routes/notifications/delivery.test.ts src/lib/logSanitization.test.ts`
- `frontend`: `npm run type-check`
- `frontend`: `npm run lint` (existing `theme.tsx` fast-refresh warning only)
- `frontend`: `npm run test:unit -- src/pages/NotificationsPage.test.tsx`
- `frontend`: `npx playwright test e2e/productionReadiness.spec.ts --grep "notification digest queue has a production sender"`
- `frontend`: `npx playwright test e2e/productionReadiness.spec.ts --grep "production network calls have bounded timeouts"`
- `frontend`: `npx playwright test e2e/settings.spec.ts --grep "persists appearance, regional, and email notification preferences"`
- `frontend`: `npx playwright test e2e/company-settings.spec.ts --grep "manages owner integrations from the company settings page"`
- `frontend`: `npx playwright test e2e/header-notifications.spec.ts --grep "routes the notification bell to the full notifications page"`
- `git diff --check` (no whitespace errors; Prisma schema line-ending warning only)

Not run locally:
- `backend`: `npm test -- src/lib/notificationJobs.test.ts`, because it is DB-backed and this shell has no safe local `DATABASE_URL`. CI should run DB-backed backend tests against the test database.
- `backend`: `npm run db:diff`, because Docker Desktop was not running for a disposable local PostgreSQL shadow database. CI runs this check.

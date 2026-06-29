# Global Stage 83 Scheduled Report Recovery QA

Date: 2026-06-29
Branch/worktree: `qa/stage83-scheduled-report-recovery`
Scope: scheduled report delivery recovery, partial recipient failures, digest retry idempotency, and repair behavior.

## Stage Numbering Note

This is global audit Stage 83. Older Stage 14/15 labels were historical local labels from prior QA ledgers and should not be used for new reports.

## What Was Found

Scheduled reports still had a correctness gap after earlier reporting fixes:

- a report could send to one recipient, fail for another, log the partial failure, then mark the whole schedule as sent
- the failed recipient was not persisted anywhere recoverable
- retrying at schedule level would either skip the failed recipient forever or risk re-sending to recipients who already got the report
- digest recipients could get duplicate digest queue rows if the process retried after queueing but before marking the delivery row complete

## Fixed In This Stage

1. Added a scheduled report delivery ledger.
   - New `ScheduledReportRun` records track each processing run.
   - New `ScheduledReportRecipientDelivery` rows track each recipient's delivery status.
   - Rows record status, retryability, attempt count, lock expiry, failure reason, and retry time.

2. Partial failures are now retryable without duplicate sends.
   - Successful recipient rows are marked `sent` and are not re-sent.
   - Failed rows are marked `failed`, retryable, and given `nextAttemptAt`.
   - The next worker pass sends only due failed rows for the incomplete run.

3. Schedule edits cancel stale recovery rows.
   - Changing report type, timing, or recipients cancels incomplete runs and pending/sending/failed delivery rows.
   - This prevents retries from using an old recipient list after an owner repairs the schedule.

4. Scheduled-report digest queueing is idempotent.
   - Added optional `NotificationDigestItem.sourceKey`.
   - Scheduled report digest items use `scheduled-report-delivery:<deliveryId>` as the source key.
   - Queue inserts use `skipDuplicates` so retry does not duplicate digest items.

## Verification

Passed locally:

- `backend`: `npx prisma generate`
- `backend`: `npm run type-check`
- `backend`: `npm run lint`
- `backend`: `npm test -- src/routes/reports/scheduleRoutes.test.ts`
- `backend`: `DATABASE_URL=postgresql://user:pass@localhost:5432/siteproof_validate npx prisma validate`
- `git diff --check` (no whitespace errors; Windows line-ending warnings only)

Not run locally:

- `backend`: `npm test -- src/lib/scheduledReports.test.ts`, because it is DB-backed and this shell has no safe local `DATABASE_URL`. CI must prove this against the test database.
- Prisma migration drift, because Docker Desktop is not available in this shell. CI runs the migration checks.

## Follow-Up Still Needed

High:

- Persist immutable scheduled report artifacts so immediate email and digest recipients reference the same generated report snapshot.
- Add owner UI/API visibility for run status, failed recipient counts, retry state, and masked delivery detail.

Medium:

- Add manual `retry failed` controls after the owner UI can safely show delivery detail.
- Add a manual-review state for stale `sending` rows if provider idempotency is not available.
- Consider external-recipient confirmation or allowlists for scheduled reports.

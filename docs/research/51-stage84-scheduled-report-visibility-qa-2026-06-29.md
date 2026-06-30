# Stage 84 - Scheduled Report Delivery Visibility QA

Date: 2026-06-29
Branch: qa/stage84-scheduled-report-artifacts-ui

## Scope

Stage 83 added a durable scheduled-report run and per-recipient delivery ledger. Stage 84 checked whether owners could actually see that delivery state from the schedule management UI.

## Finding

The backend now records the truth at run/delivery level, but the owner-facing scheduled report modal still relied on old aggregate schedule fields such as `failureCount` and `lastFailureReason`. That meant an owner could see a broad "Retrying" state without knowing whether the latest run was sent, partially failed, suppressed, queued for digest, or still processing.

## Fix

- `GET /api/reports/schedules` now includes a sanitized `latestRun` summary for each schedule.
- The summary exposes counts and status only: total recipients, sent, failed, digest, suppressed, retryable failed count, next retry time, and error reason.
- Raw per-recipient delivery rows and recipient addresses are not exposed.
- The schedule modal now shows a compact latest-run line under the next-run time.
- Frontend helper tests cover sent, partial failure, digest, and suppressed display text.
- Backend route tests assert the latest-run summary is returned without leaking `recipient` or `deliveries`.

## Verification

- `frontend`: `npm run test:unit -- src/components/reports/scheduleReportModalHelpers.test.ts`
- `backend`: `npm run type-check`
- `frontend`: `npm run type-check`
- `backend`: `npm run lint`
- `frontend`: `npm run lint` (passes with the existing `theme.tsx` fast-refresh warning)

The DB-backed route test could not run locally because no safe local `DATABASE_URL` is configured in this shell. It is covered by CI.

## Remaining Follow-Up

Scheduled report PDF artifacts are still generated in memory. Immediate recipients get an attached PDF, but digest items still link to the live reports page rather than an immutable generated snapshot.

Recommended next stage:

- Add artifact metadata to scheduled report runs.
- Store generated scheduled report PDFs under a private Supabase path such as `scheduled-reports/<projectId>/<scheduleId>/<runId>.pdf`.
- Reuse the same artifact on partial-delivery retries instead of regenerating from live data.
- Add an authenticated artifact download route with project access checks.
- Point digest links at the artifact route instead of the live report tab.

# Stage 52 Reporting And Export QA Sweep

Date: 2026-06-23  
Branch: `qa/stage52-reporting-qa`  
Base: `origin/master` at `8d1b8240 Fix NCR evidence document access check (#1106)`

## Scope

This pass focused on reports, scheduled report delivery, report emails, and frontend report surfaces.

Areas reviewed:

- `backend/src/routes/reports/**`
- `backend/src/lib/scheduledReports*`
- `backend/src/lib/email/reportTemplates.ts`
- `frontend/src/pages/reports/**`
- Claim/evidence-package export paths at source-audit level

## Fixed In This Stage

### Downgraded scheduled reports could be retried every worker interval

Severity: Medium

When a due scheduled report belonged to a project whose company was no longer on a Professional/Enterprise tier, the worker returned a `skipped` result without claiming or advancing the schedule. Because `nextRunAt` stayed due, the production worker could revisit the same schedule every minute.

Fix:

- The worker now claims the due schedule before tier validation.
- If the tier no longer permits delivery, it records a clean skipped run, clears failure state, and advances `nextRunAt` to the next normal cadence.
- Existing test coverage was updated so basic-tier due schedules must advance instead of remaining due.

### Reports page could show stale report data after refresh/project errors

Severity: High

`ReportsPage` kept the previous report object until a successful replacement fetch. If a refresh or project switch failed, users could see old report content beneath an error banner.

Fix:

- Clear all report state when `projectId` changes.
- Clear the active report state before starting a new report fetch.
- Clear claims state when a claims request is blocked by commercial access.
- Added a regression test proving stale lot report content disappears after a failed refresh.

## Verified Current-Master False Positives

These were reported by source audit but are already fixed or protected on current master:

- Scheduled report recipient preferences are enforced for registered users, including opt-out and digest handling.
- Scheduled report delivery failures already persist `failureCount`, `lastFailureAt`, `lastFailureReason`, and auto-disable after repeated failures.
- Diary report summaries are already computed from the full filtered set, not just the visible page, with regression coverage.
- Claims tab and Schedule Reports button are already gated by the effective project role and `ROLE_GROUPS.COMMERCIAL`; the wider reports route is intentionally available to internal/viewer report roles.

## Deferred Findings

### Scheduled report timezone semantics are server-local

Severity: Medium

Scheduled report `timeOfDay` currently uses JavaScript `Date` setters, so it follows the runtime timezone rather than an explicit project/user timezone. In production this may mean a user-selected `09:00` runs at UTC/server-local time.

Recommended fix: store or derive a timezone for scheduled reports and add DST-sensitive tests for Sydney, Brisbane, and Perth.

### Claim submit "Download package" path is not a real package

Severity: High

The claim submit flow's download option currently downloads a small CSV summary and can still mutate the claim to submitted. This should either generate the real claim/evidence package before status mutation or be renamed to a CSV export action.

### Claim evidence packages summarize artifacts instead of carrying them

Severity: High

The evidence package PDF currently reports evidence counts/summary text. It does not include a signed-link manifest or embedded evidence artifacts for photos, test certificates, ITP attachments, or NCR evidence. This limits the package's usefulness for client/auditor handover.

### Scheduled report CRUD lacks audit-log events

Severity: Medium

Creating, updating, disabling, and deleting scheduled reports is not reflected in the project audit log. Add audit actions with safe metadata such as recipient count, report type, and cadence. Do not log raw recipient lists.

### Backend scheduled-report PDFs are minimal text PDFs

Severity: Low/Medium

The backend scheduled-report PDF generator is intentionally simple and ASCII-oriented. For richer scheduled reports, move to a proper PDF renderer with Unicode font support and render/text extraction tests.

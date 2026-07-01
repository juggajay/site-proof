# Stage135 Report Storage / Scheduled Report / Notification QA

Date: 2026-07-01
Worktree: `C:\Users\jayso\siteproof-wt\qa-stage135-report-storage`
Branch: `qa/stage135-report-storage`

## Scope

Stage135 covered scheduled report delivery, retry, artifact access, notification digest queues,
project notification visibility, and schedule ownership cleanup after project/company role changes.
The focus was stale access: places where a user, recipient, or schedule could keep seeing or
receiving report-related content after their access changed.

## Confirmed Issues Fixed

1. Scheduled report retries could email a known recipient after project access was removed.
   - Retry delivery rows stored the original recipient and reused it without re-checking current
     project access.
   - Fixed by reclassifying retry recipients before sending email or queuing digest delivery.
     Known users who no longer qualify are now suppressed instead of retried.

2. Scheduled report delivery races could resurrect cancelled runs.
   - A schedule update/delete during provider delivery could leave claimed delivery rows as sent or
     failed after the run had been cancelled.
   - Fixed delivery and run finalization with conditional updates so cancelled runs are not moved
     back to sent/failed state.

3. Queued scheduled-report digest items survived recipient changes or schedule deletion.
   - Digest queue rows are generic notification digest items keyed by delivery source, not a real
     foreign key to the schedule.
   - Fixed schedule update/delete paths to delete queued scheduled-report digest rows for affected
     digest deliveries before cancelling runs or deleting schedules.

4. Disabled daily digest users could keep queued due digest items.
   - The worker skipped disabled users, but the queued items could remain and send later if the
     user re-enabled digests.
   - Fixed by deleting due digest items for users whose digest/email preferences are disabled before
     selecting due users.

5. Stale project notifications stayed visible after project access was removed.
   - Notification list/count/read-all only filtered by `userId`.
   - Fixed notification visibility to require current active project access for project-scoped
     notifications, while preserving projectless account notices.
   - Direct read/delete now preserves the existing 403 for another user's notification, but returns
     404 for same-user notifications that are no longer visible through current project access.

6. Scheduled report owners could keep active schedules after demotion.
   - Access-removal cleanup existed, but project/company role demotion did not disable schedules
     owned by users who lost schedule-management authority.
   - Fixed project-manager and company-admin demotion paths to disable owned schedules and clear
     recipients/ownership inside the role-change transaction.

7. Unsupported scheduled-report artifact references returned a low-level path error.
   - Signed/private/remote artifact URLs could surface as `Invalid upload path`.
   - Fixed artifact resolution to treat unsupported non-local upload references as a clean missing
     artifact.

## Coverage Added

- Scheduled report worker tests:
  - Does not resurrect a cancelled run when the schedule changes during provider delivery.
  - Suppresses retry delivery when a known recipient loses project access.

- Report route tests:
  - Deletes queued digest items when schedule recipients change.
  - Deletes queued digest items before deleting a schedule.
  - Treats unsupported signed artifact URLs as missing artifacts.

- Notification digest tests:
  - Disabled daily digest users' due queued items are deleted.
  - Disabled users do not keep due items after enabled users are processed.

- Notification route tests:
  - Hides stale project notifications after project access is removed.
  - Keeps projectless account notices visible.
  - Prevents direct read/delete of stale project notifications while preserving cross-user 403s.

- Project/company route tests:
  - Project-manager demotion disables that user's owned schedules for the project.
  - Company-admin demotion disables owned schedules where the user has no project-manager fallback.

## Verification

- `backend`: `npm run type-check` -> passed.
- `backend`: `npm run lint` -> passed.
- `backend`: `npm test -- src/lib/scheduledReports.test.ts src/lib/notificationJobs.test.ts src/routes/reports.test.ts src/routes/notifications.test.ts src/routes/projects.test.ts src/routes/company.test.ts` -> 444 passed.

## Not Changed

- Scheduled report artifact downloads still use current project report access, not schedule-manager
  access or active-schedule ownership. Existing tests treat this as allowed behavior for active
  internal project users. This remains a product/security policy decision.

- Generic daily digest rows for other future notification types still do not carry a guaranteed
  `projectId`. Stage135 fixed scheduled-report digest cleanup where source delivery rows can be
  traced, and it fixed project notification visibility. A broader digest schema change would be a
  separate migration-level design.

## Notes

- `docs/research/07-onboarding-implementation.md` is deleted in the worktree but unrelated to
  Stage135. It should stay out of the Stage135 PR unless Jay intentionally wants that deletion
  shipped.

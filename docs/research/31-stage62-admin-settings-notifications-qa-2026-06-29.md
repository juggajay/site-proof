# Stage 62 Admin, Settings, Subcontractor, and Notifications QA

Date: 2026-06-29
Branch: `qa/admin-settings-pass`
Base: `origin/master`

## Scope

This pass focused on admin/settings surfaces that affect paid-user setup and ongoing operations:

- Project settings, team invites, hold-point notification policy, modules, and areas.
- Subcontractor administration, My Company roster/plant screens, and subbie mobile company view.
- Notification alert creation and notifications page recovery states.
- Backend audit trail coverage for destructive subcontractor operations.

Three parallel read-only agents audited backend routes, frontend surfaces, and E2E coverage gaps before the fixes were selected.

## Fixed In This Stage

1. Subcontractor counter-proposed roster and plant rates now persist after reload.
   - Added nullable counter-rate columns to `employee_roster` and `plant_register`.
   - `PATCH /api/subcontractors/:id/employees/:employeeId/status` and plant equivalent now save counter rates for `counter` status and clear stale approvals/counters on other statuses.
   - `/api/subcontractors/my-company` now returns `counter` status and counter-rate fields instead of collapsing them to `pending`.

2. Project notification alerts now require notification-admin access.
   - `POST /api/notifications/alerts` no longer lets project readers create project alerts.

3. Permanent subcontractor deletion now leaves an audit trail.
   - Removed subcontractor hard-delete writes `subcontractor_permanently_deleted` in the same transaction as the delete.

4. Project team invite role picker now matches backend authorization.
   - Non-owner/non-company-admin/non-project-admin users no longer see the Project Admin option in the project team invite role select.

5. Subcontractor invite modal now blocks invalid email and phone values before submit.
   - Frontend validation mirrors the backend patterns and shows field-level errors.

6. My Company roster and plant deletion now needs a second confirmation click.
   - Prevents accidental one-click hard deletes from the desktop subcontractor company screen.

7. Project settings preserves hold-point approval requirement `none`.
   - Previously the frontend only understood `any` and `superintendent`, so `none` could be hidden or overwritten.

8. Project settings tab and areas table now behave better on small screens.
   - Settings tabs scroll horizontally instead of squeezing labels.
   - Areas table scrolls horizontally without clipping the outer card.

9. Notifications page load failure now has a retry action.
   - A failed notification query no longer leaves the user stuck with a static error.

## Verification

Backend:

- `npm test -- src/routes/subcontractors/portalResourceResponses.test.ts src/routes/subcontractors/rosterAdminResponses.test.ts src/lib/auditLog.test.ts src/routes/notifications/access.test.ts`
  - 4 files passed, 17 tests passed.
- `npm test -- src/routes/subcontractors/portalResourceResponses.test.ts src/routes/subcontractors/rosterAdminResponses.test.ts src/routes/subcontractors/adminResponses.test.ts src/routes/subcontractors/invitationResponses.test.ts src/routes/notifications/access.test.ts src/routes/notifications/alertResponses.test.ts src/routes/notifications/alertPersistence.test.ts src/routes/notifications/systemAlertResponses.test.ts src/routes/notifications/validation.test.ts src/lib/auditLog.test.ts`
  - 10 files passed, 74 tests passed.
- `npm run type-check`
  - Passed.

Frontend:

- `npm run test:unit -- src/pages/projects/settings/components/TeamTab.test.tsx src/pages/subcontractors/components/InviteSubcontractorModal.test.tsx src/pages/subcontractors/MyCompanySections.test.tsx src/pages/NotificationsPage.test.tsx`
  - 4 files passed, 18 tests passed.
- `npm run test:unit -- src/pages/projects/settings/components/TeamTab.test.tsx src/pages/projects/settings/components/NotificationsTabSections.test.tsx src/pages/projects/settings/components/ModulesTab.test.tsx src/pages/projects/settings/ProjectAreasPage.test.tsx src/pages/projects/settings/ProjectUsersPage.test.ts src/pages/subcontractors/components/InviteSubcontractorModal.test.tsx src/pages/subcontractors/MyCompanySections.test.tsx src/pages/subcontractors/MyCompanyFormModals.test.tsx src/pages/subcontractors/myCompanyData.test.ts src/pages/NotificationsPage.test.tsx`
  - 10 files passed, 46 tests passed.
- `npm run type-check`
  - Passed.

Repo checks:

- `git diff --check`
  - Passed with only the existing CRLF warning for `backend/prisma/schema.prisma`.
- `npm run fallow:audit -- -- --format json --quiet`
  - Advisory verdict improved from fail to warn after cleanup.
  - Dead code: 0.
  - Introduced complexity: 0.
  - Remaining introduced duplication warnings are small test/setup/table fragments and are not product-risk findings.

Not run locally:

- DB-backed route tests in `backend/src/routes/subcontractors.test.ts` and `backend/src/routes/notifications.test.ts` need a disposable `DATABASE_URL`. Regression coverage was added there, but local execution was blocked by missing local DB configuration. CI should run these against its configured test DB.
- Branch browser smoke is pending PR preview deployment. Production master is healthy, but it would not prove this branch's UI changes.

## Deferred Findings

These were found during the Stage 62 audit but are intentionally not bundled into this PR:

1. Subcontractor invite duplicate race.
   - `backend/src/routes/subcontractors/invitationRoutes.ts` can still race without a project-level unique constraint. This needs a reviewed Prisma migration and duplicate-data check.

2. API-key mutation scope.
   - Some admin/settings mutation routes may accept API-key authenticated requests because global API-key auth populates `req.user`. Needs a deliberate API scope model or browser-session-only guard for sensitive UI-only mutations.

3. Notification alert list scan bounds.
   - Escalated alert scans should be bounded/paginated before large-scale use.

4. Email preference write validation.
   - Reads normalize invalid stored preference values, but writes should reject invalid values earlier.

5. Account export bounds.
   - Export helpers should cap very large collections before larger paying-user datasets exist.

6. E2E coverage gaps.
   - Add role-specific tests for company admin vs owner settings, non-admin company settings denial, project settings denial, Team tab invite success, portal access cross-flow, pending subcontractor approval, notification mark-all/delete/load-more/unread flows, and settings leave/delete flows.

## Next Stage Candidate

After this PR lands, the next QA stage should target API-key/session boundaries and the remaining admin mutation routes. That stage should start with read-only route mapping, then add browser/API probes for company settings, project settings, notification alerts, subcontractor invites, and export endpoints.

# Stage133 Owner/Admin QA - 2026-07-01

## Scope

Stage133 focused on owner/admin project management and reporting workflows that still had too much mock-only coverage:

- Project team invite/change/remove with real backend state.
- Project module shortcut persistence through the project settings API.
- Scheduled report create/pause/reactivate/delete from the reports UI.
- Backend invariants for project-admin rows and scheduled report delivery cancellation.

Three audit agents reviewed owner/admin mutation paths, scheduled reports, and settings/company coverage. This stage fixed the confirmed issues with direct correctness impact and added real-backend browser coverage for the weak owner/admin seams.

## Fixes Shipped In This Stage

1. **Owner project rows are now protected as project-admin rows.**
   - Backend project-admin invariant roles now include `owner`.
   - Project team mutation guards now treat `owner` rows as protected.
   - Frontend project-team guards now count active owner rows as team leads.
   - Risk removed: seeded or migrated `ProjectUser.role = owner` rows could be demoted/removed without the same last-admin protection as admins/project managers.

2. **Scheduled reports no longer send after pause/delete races.**
   - Pausing a schedule now cancels incomplete processing/failed/partial runs and pending/sending/failed deliveries.
   - The worker re-checks a claimed delivery before sending email or queuing digest work.
   - The re-check requires the delivery to still be `sending`, the schedule to still be active, and the project to still be active.
   - Risk removed: an already-claimed delivery could send after a user paused, changed, or deleted the schedule.

3. **Project-team backend tests now verify persistence and audit records.**
   - Role update tests now assert response shape, DB role change, and `USER_ROLE_CHANGED` audit log.
   - Removal tests now assert response shape, DB deletion, and `USER_REMOVED` audit log.
   - Owner-row demotion/removal protection now has direct backend coverage.

4. **Real-backend owner/admin browser coverage added.**
   - Seeded E2E data now includes a same-company project candidate user who is reset out of the project on every seed.
   - Seeded E2E data now resets project module settings and scheduled-report rows for repeatable runs.
  - `seeded-role-journeys.spec.ts` now covers project-team invite/change/remove, module persistence after reload, and scheduled-report create/pause/reactivate/delete against the real backend.

## Verification

- Backend focused tests:
  - `npm test -- --run src/routes/projects.test.ts src/routes/reports.test.ts src/lib/scheduledReports.test.ts`
  - 3 files, 189 tests passed.
- Frontend focused tests:
  - `npm run test:unit -- --run src/pages/projects/settings/projectUsersGuards.test.ts`
  - 1 file, 3 tests passed.
- Real-backend browser E2E:
  - `npx playwright test e2e/seeded-role-journeys.spec.ts --project=chromium --reporter=list`
  - 11/11 passed against the disposable Stage133 database.
- Static checks:
  - Backend `npm run type-check` passed.
  - Backend `npm run lint` passed.
  - Frontend `npm run type-check` passed.
  - Frontend `npm run lint` passed with one existing warning in `frontend/src/lib/theme.tsx`.
- Fallow:
  - `npm run fallow:audit -- -- --format json --quiet`
  - Verdict: warn.
  - No dead code introduced.
  - Warns on duplicated test/setup patterns, mostly inherited; introduced duplication is advisory test-flow overlap, not runtime code.

## Notes

- The first local browser rerun failed because the Stage133 backend process had been started with `EMAIL_ENABLED=false`. The hold-point request flow correctly failed email delivery in that harness mode. Restarting the disposable backend with `EMAIL_PROVIDER=mock` and `EMAIL_ENABLED=true` made the same browser journey pass.
- `docs/research/07-onboarding-implementation.md` was already deleted in the dirty worktree before this stage and is intentionally excluded from the Stage133 change.

## Follow-Ups

High-value next sweeps:

- Company settings and account-exit backend coverage:
  - Real-backend checks for company member role changes/removal.
  - Account deletion/export blockers against active project ownership, scheduled reports, and subcontractor links.
- Reporting/export depth:
  - Generated report payloads and downloads with seeded lots, NCRs, tests, claims, diaries, and scheduled artifacts.
  - Permission and subscription gating for scheduled reports across owner/admin/project-manager/viewer roles.
- Storage/document hardening:
  - Private-bucket signed URL migration surface.
  - Document/photo link expiry and access checks across owner, foreman, subbie, and external hold-point recipients.

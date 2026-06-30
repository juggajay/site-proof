# Stage 69 Report, Admin, And Browser QA

Date: 2026-06-28
Branch: `qa/stage69-report-admin-browser-qa`
Base: `fbd24d34 Fix report and notification delivery edge cases (#1204)`

## Scope

This pass continued the staged QA loop after Stage 68, focusing on report
scheduling and adjacent admin/account surfaces that affect paying-user trust.

Three read-only sidecar sweeps were used:

- Scheduled reports, delivery snapshots, timezone behavior, external
  recipients, and report export expectations.
- Company/admin/account/customer-readiness surfaces including audit logs,
  API keys, member controls, usage copy, and notification preferences.
- Browser QA coverage for report/admin/settings/account routes and the best
  next headed-browser paths.

## Fixed In This Stage

- Scheduled report `nextRunAt` is now calculated from the project's Australian
  state timezone instead of the server/browser timezone. The calculation is
  reused on create, update, reactivation, due delivery, and paid-tier skip
  advancement.
- The scheduled report API now returns `projectTimeZone`, and the frontend
  schedule modal formats the "Next" run timestamp in that project timezone.
  A WA project scheduled for 09:00 now displays as 09:00 Perth time even when
  the browser is elsewhere.
- The audit-log `action` dropdown filter now matches exact action names
  case-insensitively. Fuzzy matching remains available through the free-text
  search field. This prevents an exact action filter such as `user_login` from
  also returning `user_login_failed`.

## Follow-Up Findings

- Digest recipients still receive a live reports page link, not the generated
  report snapshot/PDF. A durable scheduled-report artifact model is needed if
  digest recipients must see exactly what immediate recipients received.
- Partial scheduled-report email failures are marked sent after at least one
  recipient succeeds. A future delivery-attempt model should retry failed
  recipients only and surface partial failure state in the admin UI.
- Scheduled report PDFs cap detail rows at 50 and should say "first 50 of N" or
  move to a complete export/snapshot path.
- Test and diary report print/PDF views do not surface backend pagination, so
  users can unknowingly print/export only the first page.
- External scheduled-report recipient behavior is implicit: unknown emails get
  immediate PDFs, while known app users without project access are suppressed.
  This needs an explicit product/audit decision.
- Company-admin UI still has follow-ups outside this PR: non-owner admins can
  see owner/admin member actions that the backend rejects, API-key creation has
  no browser expiry control, usage warnings imply hard quota enforcement while
  enforcement is disabled, and frontend/backend email preference defaults drift
  for NCR status-change timing.
- Browser QA should next run a real-backend headed pass through login,
  dashboard, reports, audit log, project settings, users, areas, company
  settings, account settings, and profile. Existing mocked E2E coverage is good
  but does not fully exercise navigation plus backend role behavior.

## Verification

Passed locally:

- `backend`: `npx vitest run src/routes/reportResponses.test.ts src/lib/scheduledReports.test.ts --testNamePattern "reportResponses|calculateNextScheduledReportRunAt"`
- `frontend`: `npm run test:unit -- --run src/components/reports/scheduleReportModalHelpers.test.ts`
- `backend`: `npm run type-check`
- `frontend`: `npm run type-check`
- `backend`: `npm run lint` (existing warning in `src/lib/dataRetention.test.ts`)
- `frontend`: `npm run lint` (existing warning in `src/lib/theme.tsx`)
- `git diff --check`

Not completed locally:

- Full `backend/src/lib/scheduledReports.test.ts` and
  `backend/src/routes/auditLog.test.ts` need a disposable `DATABASE_URL`.
  The new DB-backed regressions are expected to run in GitHub CI.

Local environment note:

- The fresh worktree needed `npm ci` in backend/frontend and `prisma generate`.
  Prisma generate required `NODE_EXTRA_CA_CERTS` with the local AVG root cert
  because Node rejected the intercepted TLS certificate.

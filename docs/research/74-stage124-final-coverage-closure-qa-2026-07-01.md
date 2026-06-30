# Stage124 Final Coverage Closure QA - 2026-07-01

## Scope

Stage124 was the closure pass after Stages 120-123. The goal was to check the remaining weak areas from the endpoint/screen map rather than re-test only the recently fixed workflows.

Worktree: `C:\Users\jayso\siteproof-wt\qa-stage124-coverage-closure`

Branch: `qa/stage124-coverage-closure`

Base: `origin/master` at `e9950780` after PR #1286.

## Master CI Gate

Stage123 merge run `28474233064` completed successfully:

- Detect changes: passed
- Backend: passed
- Frontend: passed
- Full frontend E2E: passed

## Parallel Audit Inputs

Four read-only closure agents checked independent areas:

- Admin/integration: API keys, webhooks, notifications, email queue, metrics, MFA, OAuth, consent, support, audit log.
- Quality workflow follow-ups: test-result NCR linkage, ITP templates, dockets, hold points, document/version access.
- Frontend route/browser coverage: mounted routes versus E2E specs and recent stage reports.
- Data/privacy/export/storage/scale: backups, Sentry, storage access, reports/export size, account export, retention.

## Fixes Made

### 1. AI certificate failed-test NCRs now retain lot linkage

Problem:

- Single certificate confirm and batch confirm hard-coded the failed-test NCR prompt to `lotId: null`.
- Backend correction mapping could not persist a reviewed/suggested lot during extraction confirmation.
- Result: a failed AI certificate could raise an NCR linked to the test result but not linked to the lot, so lot status/readiness could miss the NCR impact.

Fix:

- Single and batch certificate review now seed a "Suggested Lot" select from the backend chainage/lot suggestion.
- Confirm corrections include reviewed `lotId`.
- Backend confirm and batch-confirm validate the lot belongs to the same project before persisting it.
- Batch upload responses now include the same lot suggestion metadata as single upload.

Files:

- `backend/src/routes/testResults/corrections.ts`
- `backend/src/routes/testResults/extractionConfirmation.ts`
- `backend/src/routes/testResults/certificateIntake.ts`
- `backend/src/routes/testResults.test.ts`
- `frontend/src/pages/tests/components/UploadCertificateModal.tsx`
- `frontend/src/pages/tests/components/BatchUploadModal.tsx`
- `frontend/src/pages/tests/components/UploadCertificateModal.test.tsx`
- `frontend/src/pages/tests/components/BatchUploadModal.test.tsx`

### 2. Archived ITP templates are hidden from lot assignment

Problem:

- Archived/inactive ITP templates could still be returned by `GET /api/itp/templates`.
- Lot assignment screens could show an inactive template, then the backend rejected assignment later.

Fix:

- Added `activeOnly=true` support to the template list endpoint.
- Lot creation and lot detail assignment flows request `activeOnly=true`.
- Lot detail hook also filters inactive templates defensively if an old/mock response includes them.

Files:

- `backend/src/routes/itp/templates.ts`
- `backend/src/routes/itp.test.ts`
- `frontend/src/pages/lots/components/CreateLotModal.tsx`
- `frontend/src/pages/lots/hooks/useItpInstance.ts`
- `frontend/src/pages/lots/hooks/useItpInstance.test.ts`
- `frontend/src/pages/lots/types.ts`

## Verification

Backend disposable database:

- Docker Postgres `siteproof_stage124_test`
- `npm run db:deploy`: passed, 25 migrations applied.

Backend tests:

- `npm test -- --run src/routes/apiKeys.test.ts src/routes/webhooks.test.ts src/routes/consent.test.ts src/routes/mfa.test.ts src/routes/oauth.test.ts src/routes/auth.test.ts src/routes/pushNotifications.test.ts src/routes/notifications.test.ts src/routes/auditLog.test.ts src/routes/support.test.ts --maxWorkers=1`
- Result: 10 files, 589 tests passed.

- `npm test -- --run src/routes/testResults.test.ts src/routes/itp.test.ts --maxWorkers=1`
- Result: 2 files, 191 tests passed.

Frontend unit tests:

- `npm run test:unit -- --run src/pages/tests/components/UploadCertificateModal.test.tsx src/pages/tests/components/BatchUploadModal.test.tsx src/pages/lots/hooks/useItpInstance.test.ts`
- Result: 3 files, 42 tests passed.

Frontend browser closure suite:

- `npx playwright test e2e/auth.spec.ts e2e/settings.spec.ts e2e/company-settings.spec.ts e2e/header-notifications.spec.ts e2e/support.spec.ts e2e/audit-log.spec.ts e2e/documentation.spec.ts e2e/subcontractor-portal-rbac.spec.ts --project=chromium --reporter=list`
- Result: 79 tests passed.

Static checks:

- Backend `npm run type-check`: passed.
- Backend `npm run lint`: passed.
- Frontend `npm run type-check`: passed.
- Frontend `npm run lint`: passed with the known existing `frontend/src/lib/theme.tsx` fast-refresh warning only.
- `git diff --check`: passed.

## Remaining Follow-Ups

No P0 blockers found in Stage124.

Conditional P1 scale follow-ups:

- Claims report/export remains unbounded for all matching claims. This is acceptable for small launch datasets but should block large imported claim histories until paginated/capped.
- Account export remains synchronous and uncapped for several canonical construction collections. Existing operational collections have caps, but core export sets can still become large.

P2 coverage/product follow-ups:

- Add direct backend route coverage for `/api/metrics`.
- Add route coverage for `/api/notifications/email-queue` diagnostics.
- Add route/side-effect coverage for manual notification alert checks.
- Add browser smokes for public/static routes, login MFA challenge, OAuth error branches, and classic subbie desktop direct links.
- Add UI coverage for push notification enable/disable/test success and failure paths.
- Decide whether frontend cookie consent should write to backend `/api/consent`, or document registration ToS as the auditable consent event.
- Scheduled report snapshots are still all-history rather than cadence-windowed.
- Audit log CSV export pages through all filtered results with no total cap.
- Retention worker does not enforce project/audit/scheduled-report artifact windows automatically.
- Document versioning exists server-side but still has no full documents-page UI workflow.

## Current Readiness Judgment

The two real Stage124 workflow bugs found during closure are fixed and verified locally. The remaining Stage124 items are coverage, scale, or policy follow-ups rather than current evidence of broken core user workflows.

This stage is ready for PR/CI. The overall whole-app loop should remain open until this PR is merged, CI is green, and the remaining follow-up list is either accepted as post-launch hardening or closed in later stages.

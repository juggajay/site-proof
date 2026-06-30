# Stage 119 Endpoint Inventory And Coverage Map

Date: 2026-07-01 Australia/Sydney
Stage owner: Codex
Scope: static backend endpoint inventory, frontend/browser route inventory, coverage mapping, and next-stage prioritization.

## Summary

Stage 119 did not try to run another broad browser suite. It built the map needed to make the next browser stages precise.

The question for this stage was: what app surfaces still need direct proof?

Result:

- Current master is `9903a5e7fc709a1851e035c05b43f590d206d976`.
- Latest master CI is green.
- Latest database backup workflow is green.
- Backend has 32 mounted server/API/static surfaces in `backend/src/server.ts`, including duplicate `/api/auth` and `/api/projects` mounts for intentionally split routers.
- `backend/src/routes/**` contains 303 TypeScript source files and 208 route test files.
- Frontend has 68 mounted app routes in `frontend/src/App.tsx` and `frontend/src/appProjectRoutes.tsx`.
- Frontend has 42 Playwright E2E specs and 344 frontend unit/spec files.

No production blocker was found in this stage. The main output is a prioritized list of browser and endpoint coverage gaps for the next stages.

## Current CI And Operational State

Latest master:

- Commit: `9903a5e7 docs: record stage 118 production landing smoke (#1280)`
- CI: success.
- Backend job: success.
- Frontend job: success.
- Full Frontend E2E job: success.

Recent operational signal:

- Database Backup workflow after the Stage 118 fix merge: success.

Local note:

- Antivirus/security software again marked old local research docs as deleted in the worktree. Those deletions were not staged or committed.

## Backend Mounted Surfaces

Mounted in `backend/src/server.ts`:

| Surface | Notes |
| --- | --- |
| `/uploads` | Private static upload serving through `privateUploadGuard`. |
| `/health` | Public health check. |
| `/ready` | Readiness check. |
| `/api/metrics` | Authenticated owner/admin metrics. |
| `/api/auth` | Auth routes and OAuth routes are mounted separately under this prefix. |
| `/api/api-keys` | API key management. |
| `/api/projects` | Projects router and claims router both mount under this prefix. |
| `/api/lots` | Lots, readiness, conformance, assignments. |
| `/api/ncrs` | NCR list, workflow, evidence, analytics. |
| `/api/subcontractors` | Directory, invitations, portal access, roster/my-company. |
| `/api/reports` | Reports and scheduled reports. |
| `/api/test-results` | Test result specs, uploads, verification, request forms. |
| `/api/itp` | Templates, instances, completions, verification, attachments. |
| `/api/diary` | Diary core, items, roster, reporting, submission. |
| `/api/holdpoints` | Hold point read/action/request/release/escalation/public-token flows. |
| `/api/dockets` | Docket CRUD, entries, submit, review, query, reject. |
| `/api/company` | Company settings, team, API key/webhook inventory. |
| `/api/support/request` | Rate-limited support request. |
| `/api/support/client-error` | Rate-limited client error report. |
| `/api/support` | Support router. |
| `/api/audit-logs` | Audit log listing. |
| `/api/comments` | Comments and attachments. |
| `/api/notifications` | Notifications, email prefs/queue, alerts. |
| `/api/documents` | Documents, upload, signed access, versioning, classification, delete. |
| `/api/drawings` | Drawing register, supersede, delete, current set. |
| `/api/dashboard` | Dashboards, portfolio, role dashboards, foreman today. |
| `/api/consent` | Consent state/history/withdrawal/types. |
| `/api/mfa` | MFA setup/verify/disable flows. |
| `/api/webhooks` | Webhook management, deliveries, test receiver. |
| `/api/push` | Push subscription and send/status routes. |

Structural auth coverage is guarded by `backend/src/lib/routeAuthCoverage.test.ts`. That is important, but it is not the same as proving every role/tenant branch behaves correctly.

## Backend Coverage Observations

Strongly covered by backend tests and E2E:

- Auth/session basics.
- Projects/team/areas.
- Lots and lot detail.
- ITP basics.
- NCR lifecycle.
- Test results basics.
- Hold point basics and release delivery.
- Diary core and delay register.
- Dockets core/review paths.
- Claims/commercial paths.
- Reports/scheduled reports.
- Documents/drawings.
- Subcontractors.
- Notifications and push.
- Webhooks and support.

Endpoint/branch gaps worth turning into targeted stages:

| Priority | Area | Gap |
| --- | --- | --- |
| P1 | Mobile shell browser coverage | Many nested `/m/*` and `/p/*` routes have unit tests but not direct browser navigation. |
| P1 | Hold points | Browser coverage is still thin for escalation, resolve-escalation, evidence package, and public token release paths. |
| P1 | Dockets | Browser coverage is thinner for reject/query/respond and labour/plant delete paths than for approve/submit. |
| P1 | ITP | Direct backend/browser proof should be strengthened for completion PATCH, verify/reject, attachment GET/DELETE, template clone/archive/restore/propagate/lots. |
| P2 | Test results | Browser coverage should cover request-form PDF/json, workflow view, batch-confirm, and verification-view paths. |
| P2 | Documents/drawings | Browser coverage should cover classification, versioning, signed URL/download, drawing current-set, and supersede lifecycle. |
| P2 | Subcontractors | Browser coverage should cover my-company employee/plant delete/status and portal-access edge states. |
| P2 | Notifications/push | Browser coverage is thin for email queue/digest/admin alert automation and push subscription flows. |
| P2 | Webhooks/API keys | No obvious browser coverage for webhook management or API key management. Backend coverage exists. |
| P3 | MFA/consent/OAuth edge flows | Backend tests exist, but browser coverage is thin for MFA setup/disable, consent history/withdraw, and OAuth callback/exchange edge states. |
| P3 | Metrics/dashboard foreman today | Backend/static coverage exists, but direct browser/API checks are not obvious for `/api/metrics` and foreman today dashboard branches. |

The report subroute false alarm from a nearby-test scan was resolved: `backend/src/routes/reports.test.ts` directly exercises `/api/reports/summary`, `/lot-status`, `/ncr`, `/test`, `/diary`, `/claims`, and schedules.

## Frontend Mounted Routes

Top-level route count from `App.tsx` and `appProjectRoutes.tsx`: 68.

Important route groups:

- Public/auth: `/`, `/landing`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/magic-link`, `/auth/oauth-callback`, `/privacy-policy`, `/terms-of-service`, `/hp-release/:token`.
- Desktop protected app: `/dashboard`, `/portfolio`, `/projects`, `/projects/:projectId`, project settings/users/areas, lots, ITP, hold points, tests, NCR, diary, delays, dockets, claims, costs, documents, drawings, subcontractors, reports.
- Account/admin: `/settings`, `/company-settings`, `/profile`, `/notifications`, `/docs`, `/support`, `/audit-log`, `/my-company`.
- Classic subcontractor portal: `/subcontractor-portal`, docket routes, work, ITPs, lot ITP, hold points, tests, NCRs, documents.
- Foreman mobile shell: `/m/*`.
- Subcontractor mobile shell: `/p/*`.

Playwright E2E specs: 42.

High-confidence desktop coverage exists for the major project routes through named specs such as:

- `dashboard.spec.ts`
- `projects.spec.ts`
- `project-users.spec.ts`
- `project-areas.spec.ts`
- `project-settings.spec.ts`
- `lots.spec.ts`
- `lot-detail.spec.ts`
- `itp.spec.ts`
- `holdpoints.spec.ts`
- `test-results.spec.ts`
- `ncr.spec.ts`
- `diary.spec.ts`
- `delay-register.spec.ts`
- `dockets.spec.ts`
- `claims.spec.ts`
- `costs.spec.ts`
- `documents.spec.ts`
- `drawings.spec.ts`
- `reports.spec.ts`
- `subcontractors.spec.ts`
- `settings.spec.ts`
- `company-settings.spec.ts`
- `profile.spec.ts`
- `audit-log.spec.ts`
- `header-notifications.spec.ts`
- `support.spec.ts`
- `documentation.spec.ts`

## Browser Coverage Gaps

Mounted but not directly covered enough by browser navigation:

### Public Static/Auth Edges

- `/privacy-policy`
- `/terms-of-service`
- `/documentation` redirect
- OAuth callback edge states
- MFA setup/disable
- consent history/withdrawal

Stage 118 already covered `/`, `/landing`, `/login`, and protected `/projects` redirect in production.

### Foreman Mobile Shell

Top-level `/m` shell is covered, but nested direct routes need browser proof:

- `/m/diary/weather`
- `/m/diary/crew`
- `/m/diary/work`
- `/m/diary/work/activity`
- `/m/diary/work/delay`
- `/m/diary/work/delivery`
- `/m/diary/work/event`
- `/m/diary/review`
- `/m/diary/done`
- `/m/lots/:lotId`
- `/m/lots/:lotId/itp`
- `/m/lots/:lotId/details`
- `/m/dockets/:docketId`
- `/m/dockets/:docketId/adjust`
- `/m/dockets/:docketId/query`
- `/m/dockets/:docketId/reject`
- `/m/issues/:ncrId`
- `/m/photos/:documentId`

### Subcontractor Mobile Shell

Direct `/p/*` shell routes needing browser proof:

- `/p`
- `/p/docket/:docketId`
- `/p/dockets`
- `/p/itps`
- `/p/lots/:lotId/itp`
- `/p/quality`
- `/p/ncrs`
- `/p/company`

### Classic Subcontractor Portal

Classic portal routes with weaker direct browser proof:

- `/subcontractor-portal/tests`
- `/subcontractor-portal/ncrs`
- `/subcontractor-portal/documents`
- my-company employee/plant delete/status paths
- portal access edge states

## Recommended Next Stages

### Stage 120: Mobile Shell Deep Browser Pass

This is the highest-value next stage because it aligns with recent product work and the largest browser coverage gaps.

Scope:

- direct navigation to every nested `/m/*` foreman route
- direct navigation to every nested `/p/*` subcontractor route
- seeded owner/foreman/subcontractor accounts
- verify redirects, loading states, empty states, and primary actions
- fix any route, data, auth, or layout bugs found

### Stage 121: Hold Point/Docket/ITP Branch Pass

Scope:

- hold point escalation and evidence package
- public token release
- docket reject/query/respond paths
- ITP verify/reject and attachment lifecycle

### Stage 122: Documents/Drawings/Test Results Pass

Scope:

- document classification
- versioning
- signed URL/download flows
- drawing supersede/current-set lifecycle
- test result request forms and verification/batch flows

### Stage 123: Admin/Integration Pass

Scope:

- API keys
- webhook management
- notification email queue/digest/admin automation
- push subscription flow
- MFA/consent/OAuth edge states

## Stage 119 Result

Status: passed for inventory.

No app code was changed. No launch blocker was found. The next work should be targeted browser execution against the specific gaps above, starting with the mobile shell deep pass.

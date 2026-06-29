# Agent Handoff

Last updated: 2026-06-20

This file is the tracked handoff for the current SiteProof workstream. It is
intended for a fresh agent starting from `master`.

## Current Repo State

- Current branch: `master`
- Current app-code baseline when this handoff refresh was last updated:
  `7ddec84 refactor(lots): move ITP completion mutations into useItpInstance (#316)`
- Expected local status after syncing: clean tracked tree, with `.deepsec/`
  possibly present as an untracked local audit workspace.
- Do not commit `.deepsec/`, `.gstack/`, browser profiles, backup dumps,
  connection strings, cookies, JWTs, keys, or generated audit exports.

## Critical Safety Rules

- `CLAUDE.md` is the canonical developer guide. Read it first.
- `tasks/lessons.md` is shared agent memory. It includes important workflow
  lessons, especially that Jay means real Claude when he says "Claude"; do not
  substitute a Codex subagent unless Jay explicitly approves it.
- Do not open or print mirrored DeepSec file snapshots under
  `.deepsec/data/**/files/**`. They may contain sensitive local files such as
  env mirrors.
- Never run production `prisma db push`, `prisma migrate dev`,
  `--accept-data-loss`, or unreviewed schema writes.
- Production DB is Railway Postgres. Supabase is storage-only.
- Keep all credentials out of terminal output, reports, commits, PR bodies, and
  handoff notes.

## Completed Workstreams

### Supabase Storage And Orphan Cleanup

Status: closed.

- Supabase Storage is the durable production file store for the private
  `documents` bucket. Browser access must go through backend access routes,
  not raw Supabase object URLs.
- The 2026-05-12 DB orphan cleanup deleted 24 backed-up orphan rows:
  11 `documents` rows and 13 `comment_attachments` rows.
- Post-cleanup DB verification returned zero rows for all targeted orphan
  checks.
- The single known PR #7 storage-only `company-logos/...` object was deleted
  through the Supabase dashboard and post-delete public GET returned the
  expected missing-object response.
- The follow-up docs PR closed the stale orphan-audit language in
  `docs/supabase-storage-setup.md`.

Primary doc: `docs/supabase-storage-setup.md`

### Prisma Drift Reconciliation

Status: closed.

- Production migration drift was reconciled on 2026-05-13.
- Live production DB now matches `backend/prisma/schema.prisma`.
- Existing committed migrations are marked applied.
- Future schema changes must use reviewed Prisma migrations.
- Railway backend deployment commands must not run Prisma schema writes on
  startup or pre-deploy.

Primary doc: `CLAUDE.md`, "Production database (Railway Postgres)"

### ITP Template Seeders

Status: closed.

- Jurisdictional ITP seeders were moved into
  `backend/scripts/seeds/itp-templates/` and wired through
  `pnpm seed:itp`.
- Production was backed up before seeding.
- All 27 seeders executed successfully against production.
- Idempotency re-run skipped existing templates without duplicates.
- UI verification confirmed TfNSW library templates were visible in production
  for an NSW project.

Primary docs:

- `backend/scripts/seeds/itp-templates/README.md`
- `CLAUDE.md`, "Seed global ITP templates"

### Repo Hygiene

Status: mostly closed.

- Stale planning docs were archived under dated archive folders.
- Applied one-off migration scripts and superseded docs were archived in the
  Batch 3a hygiene PR.
- The stale February codebase audit tracker was archived at
  `docs/archive/2026-05-repo-hygiene/codebase-audit-report.md` after the May
  readiness and DeepSec hardening work made its top-level status misleading.
- The stale `skills/codebase-review/SKILL.md` workflow was replaced with a
  deprecation stub that points agents to the current handoff/DeepSec workflow
  and preserves the "Claude means real Claude" rule.

Relevant archive indexes:

- `docs/archive/2026-05-repo-hygiene/README.md`
- `backend/scripts/archive/2026-05-repo-hygiene/README.md`
- `backend/sql/archive/2026-05-repo-hygiene/README.md`
- `tasks/archive/2026-05-repo-hygiene/README.md`

### DeepSec Security Hardening

Status: all known findings from the May 2026 DeepSec pass are fixed in code.

Full DeepSec revalidation run reported by Jay:

- Run: `20260519065030-cf318479622b5fd0`
- TP: 1
- FP: 0
- Fixed: 79
- Uncertain: 0

The one remaining TP from that run was:

- `[MEDIUM] Diary submission validates and finalizes a stale snapshot`

It was already fixed in PR #80:

- Commit on `master`: `829895d`
- Change: docket approval diary auto-population now runs inside a transaction
  and calls `requireEditableDiaryForWrite` before inserting
  `diary_personnel` or `diary_plant` rows.
- Regression: `backend/src/routes/dockets.test.ts` verifies approving a docket
  does not auto-populate a locked draft diary.

Verification run before PR #80 merge:

- `cd backend; pnpm test -- src/routes/dockets.test.ts -t "should not auto-populate a locked draft diary"`
- `cd backend; pnpm test -- src/routes/dockets.test.ts`
- `cd backend; pnpm lint`
- `cd backend; pnpm type-check`
- GitHub PR #80 checks all passed before squash merge.

Targeted DeepSec revalidation after syncing current `master`:

- Run: `20260520183932-5119f506f6826681`
- Scope: one forced recheck of
  `backend/src/routes/diary/diarySubmission.ts`
- Result: TP 0, FP 0, Fixed 1, Uncertain 0

Current DeepSec status after that targeted revalidation:

- Revalidated: 80/80
- TP: 0
- FP: 0
- Fixed: 80
- Uncertain: 0

Additional safety hardening after the DeepSec queue was cleared:

- PR #143 changed the Vitest database safety guard to reject unsafe external
  `DATABASE_URL` values even when `NODE_ENV` was not pre-set before the test
  process started.
- `backend/vitest.config.ts` now explicitly sets `NODE_ENV=test`.
- A controlled fake remote-DB test run produced
  `REMOTE_TEST_DB_REFUSAL_OK`, confirming the guard fails closed before tests
  can touch a non-local database.
- `cd backend; pnpm test -- src/test/databaseSafety.test.ts --runInBand`
- `cd backend; pnpm format:check`
- `cd backend; pnpm type-check`
- `cd backend; pnpm lint`
- `git diff --check`
- GitHub PR #143 checks all passed before squash merge.

Important: Jay reported the DeepSec revalidation output above from
`.deepsec`. Treat `.deepsec/` as local audit input only. If another paid
revalidation is needed later, prefer targeted scope and record the run ID and
cost.

### Full-App QA Cleanup

Status: initial QA queue closed, plus follow-up polish closed through PR #98.

Codex ran a report-only app QA sweep on 2026-05-19. The first report scored the
app at 66/100 and called out ten customer-facing quality issues. The following
merges closed that initial queue:

- PR #82 removed retired `SiteProof v2` branding from active app surfaces and
  PDF generators.
- PR #83 kept dashboard project and lot rollups independent of date filters.
- Commit `777c4a5` degraded diary weather lookup failures without blocking the
  diary page.
- PR #85 replaced the dashboard print-dialog path with a real PDF download.
- PR #86 routed report generated timestamps through the shared Australian
  date/time formatting path.
- PR #87 wrapped mobile dashboard actions at iPhone width.
- PR #88 labelled the mobile lot filter trigger.
- PR #89 changed CSV export filenames from project UUIDs to project-name slugs.
- PR #90 compacted the mobile reports header.
- PR #91 clarified the mobile diary quick-add rail and scroll affordance.
- PR #92 formatted dashboard activity timestamps consistently.
- PR #93 normalized the remaining frontend raw browser-locale date-time
  displays and added a production-readiness guard against regressions.
- PR #145 added explicit `en-AU` locale arguments to the remaining live-source
  no-arg `toLocaleDateString`, `toLocaleTimeString`, and `toLocaleString`
  calls in frontend/backend source.
- PR #94 refreshed this handoff after the first QA cleanup batch.
- PR #95 stopped empty-date daily diary loads from logging noisy 404s.
- PR #96 unmounted closed header dropdown contents so hidden notification and
  user-menu actions are not present in the accessibility/text tree.
- PR #97 added browser/password-manager autocomplete hints to login,
  registration, and reset-password forms.
- PR #98 moved the cookie consent banner above the fixed mobile navigation for
  authenticated mobile users.

Verification evidence now lives in CI and guardrail tests:

- `frontend/e2e/productionReadiness.spec.ts` includes checks for retired
  branding, dashboard PDF generation, report timestamps, raw browser-locale
  date-time formatting, and several production readiness invariants.
- Static source guard after PR #145:
  `rg -n "toLocale(?:Date|Time|String)String\(\)" frontend/src backend/src`
  returns no live-source matches.
- PR #98 CI passed Backend, backend-tests, Frontend, frontend-build,
  frontend-e2e, and Vercel before merge.

The original report artifacts under `.gstack/dev-browser/full-app-qa-*` are
historical. Do not treat their issue list as current without rechecking
`master`; most referenced findings are now intentionally stale.

### Paying-User Readiness Hardening

Status: main source-audit gap list is largely closed in code through PR #190.

After the first QA cleanup batch, Codex and Claude ran a paying-user readiness
review focused on compliance trust scaffolding: audit logs, workflow state
guards, auth edge cases, subbie boundaries, and security ergonomics. The report
artifacts under `.gstack/dev-browser/paying-user-readiness-*` are useful for
history, but many line-item findings are now stale. Recheck `master` before
using any item as live work.

Closed areas since PR #98:

- Hold point public release now binds the release identity to the token and
  uses server-owned release timestamps.
- ITP verification transitions are guarded: repeat verification is idempotent,
  verified completions cannot be rejected, and verified completion edits require
  verifier revision context.
- Test result verification is idempotent and verified test results are guarded
  against unsafe edits.
- NCR rectification now requires evidence before entering verification, NCR
  close requires verification status, and NCR close/reopen/QM transitions write
  audit logs.
- NCR creation, evidence add/remove, client notification, and workflow
  transitions now have focused audit coverage.
- Lot conformance and lot status overrides write audit entries.
- Docket submit/approve/reject/query/respond transitions write audit entries.
- Diary submissions and addendums write audit entries.
- Claims re-certification is guarded, and certification/payment paths have
  audit coverage.
- Subcontractor invitations now expire, portal access changes are audited, and
  representative cross-subbie isolation tests exist.
- Company settings, membership changes, profile updates, avatar changes,
  account deletion requests, API keys, webhooks, MFA enable/disable, auth
  register/login/email verification/password reset/magic link/OAuth login, and
  OAuth registration/callback login now write audit logs where appropriate.
- OAuth callback now rejects Google userinfo unless `verified_email` is
  explicitly true. The helper no longer defaults missing provider verification
  state to trusted.
- Global Prisma `P2003` errors now return HTTP 422 `INVALID_REFERENCE` instead
  of generic database errors.
- Subcontractor project creation is blocked unless the user has an
  organization, and dedicated subcontractor portal users cannot create head
  contractor projects.
- In-app subcontractor invitation acceptance exists and records the accepted
  invitation audit event.
- Document uploads now return user-facing rejection reasons for unsupported file
  types instead of a generic "uploaded 0 of 1" message.
- Project, lot, subcontractor invitation, and portal-access creation/change
  events have audit coverage.
- Dashboard lot status counts use the real lifecycle status buckets.
- Newly created projects open directly after creation, instead of leaving the
  owner on the project list.
- Audit log search covers actions, entities, users, and projects, and the
  placeholder now describes that scope.
- 404s now provide safe recovery links back to the relevant project, projects
  list, dashboard, or subcontractor portal.

Recent verification pattern:

- Each code PR used focused regression coverage first, then broader affected
  backend/frontend tests, `pnpm format:check`, `pnpm type-check`, `pnpm lint`,
  and `git diff --check` where relevant.
- GitHub checks were watched before merge. The usual green set is Backend,
  Frontend, backend-tests, frontend-build, frontend-e2e, Vercel, and Vercel
  Preview Comments.

### Evidence Readiness And Activation QA

Status: core activation and dogfood findings are closed through PR #234. No
known activation/RBAC blocker remains from the May 2026 dogfood queue; use fresh
live QA before treating any older `.gstack` report item as active.

Evidence Readiness shipped in PRs #175-#178:

- PR #175 added the backend lot evidence-readiness endpoint.
- PR #176 added the lot readiness panel.
- PR #177 added claim creation readiness.
- PR #178 reframed the claim evidence review copy and contract around
  deterministic evidence readiness.

Production dogfood and activation follow-up PRs:

- PR #166 counted explicit subcontractor lot assignments.
- PR #167 required organization setup before head-contractor project creation.
- PR #168 blocked subcontractor project creation.
- PR #169 added in-app subcontractor invite acceptance.
- PR #170 surfaced document upload failure reasons.
- PR #171 audited project, lot, subcontractor invitation, and portal-access
  creation/change events.
- PR #172 polished dogfood UX and audit search.
- PR #173 audited lot assignments and exposed force conform.
- PR #174 kept force-conformed lots claim-ready by preserving or allowing the
  required budget path.
- PR #179 accepted blank docket approval notes.
- PR #180 used seeded ITP templates from the readiness inline action.
- PR #181 showed mobile docket approval actions.
- PR #182 added company onboarding through `/onboarding` and `POST /api/company`.
- PR #183 repaired subcontractor portal RBAC.
- PR #184 fixed dashboard lot status counts.
- PR #185 removed the stale login changelog modal.
- PR #186 replaced the invalid ABN invite placeholder.
- PR #187 guided empty docket approvals toward subcontractor invites.
- PR #188 opened newly created projects.
- PR #189 clarified and tested audit log search scope.
- PR #190 added contextual 404 recovery links.
- PR #191 refreshed this tracked handoff after the activation/RBAC cleanup.
- PR #192 added a claims-oriented project reports tab backed by the existing
  claims reporting API.
- PR #193 changed audit log action display, details, filters, and CSV export
  from raw backend event codes to readable customer-facing labels.
- PR #194 surfaced audit log pagination controls above the table as well as
  below it, so large audit trails do not require scrolling to navigate.
- PR #195 refreshed this tracked handoff after the audit and activation polish
  sequence.
- PR #196 enforced the "owner is never a subbie" invariant on backend
  company-creation and invitation-acceptance paths.
- PR #197 clarified that lot status override is workflow-only; conformance and
  claimed states remain controlled by Evidence Readiness, Force Conform, and
  progress claims.
- PR #198 added a controlled demo/QA email-verification bypass so self-serve
  testing no longer stalls on unavailable inboxes.
- PR #199 routed accepted subcontractor portal identities to subcontractor
  surfaces instead of head-contractor dashboard/project workspaces.
- PR #200 defaulted newly invited or unconfigured subcontractor portal access
  to assigned work and evidence modules, while keeping NCR access opt-in.
- PR #201 required an active portal identity flag, not just stale
  `subcontractor_admin` role text, before frontend subcontractor routes open.
- PR #202 refreshed this tracked handoff after the owner/subbie invariant and
  portal-identity fixes.
- PR #203 stopped authenticated launch modals from auto-opening on every login.
- PR #204 added the authenticated notifications page route behind the existing
  header bell.
- PR #205 required a Force Conform reason, recorded it in the audit metadata,
  and invalidated readiness state after conforming a lot.
- PR #206 made forbidden project workspaces render Access Denied instead of
  empty/blank states.
- PR #207 clarified the ITP template picker copy so activity matches are
  suggestions, not a hard filter.
- PR #208 routed the dashboard Reports quick-link to project reports instead of
  the project list dead-end.
- PR #209 rewrote project dashboard KPI labels into plain operational English.
- PR #210 made the subcontractor Pending Approvals banner actionable.
- PR #211 disabled the empty lot-assignment removal action.
- PR #212 returned an empty ITP instance state for lots with no ITP instead of
  surfacing a 404 to the frontend.
- PR #213 added explicit autosave feedback to the portal access panel.
- PR #214 kept head-contractor users out of stale subcontractor redirects.
- PR #215 made reset-password submit errors uniform for invalid, used, and
  expired reset tokens.
- PR #216 aligned the Company Settings ABN placeholder with the valid invite
  placeholder.
- PR #217 made the dev role override apply to both `role` and `roleInCompany`,
  so route guards, navigation, and pages use the same effective role in QA.
- PR #218 refreshed this tracked handoff after the first activation-fix batch.
- PR #219 polished dogfood navigation and mobile UI: auth redirects, dashboard
  labels, reset-password copy, cookie banner behaviour, and notification
  navigation guardrails.
- PR #220 made Evidence Readiness actions scroll to the relevant lot tabs.
- PR #221 allowed approved subcontractor invites to be accepted and covered the
  accepted-before-acceptance flow with regression tests.
- PR #222 routed the notification bell to the authenticated notifications page.
- PR #223 routed subcontractor project links to portal work surfaces instead of
  head-contractor project workspaces.
- PR #224 opened the ITP assignment surface from the readiness action.
- PR #225 made the subcontractor portal show all active linked projects and
  assigned work across those projects.
- PR #226 exposed the existing backend docket query action in desktop and
  mobile docket approvals, and taught docket PDFs the `queried` status.
- PR #227 refreshed this tracked handoff after the first dogfood fix sequence.
- PR #228 scoped subcontractor roster rates by project so fresh subbie
  employee/rate creation is visible to the right project and docket flow.
- PR #229 showed a clear Access Denied state for unrelated subcontractor
  project links instead of redirecting with misleading project context.
- PR #230 focused Evidence Readiness action targets so users land on the
  specific lot tab or panel needed to resolve the blocker.
- PR #231 surfaced Force Conform reasons in audit search, details, and exports.
- PR #232 removed the duplicate subcontractor dashboard notification bell so
  the global header bell is the single notifications entry point.

Historical `.gstack/dev-browser` reports remain useful as evidence trails, but
their issue lists are not live backlogs. In particular, these are stale unless a
fresh production recheck proves otherwise:

- "No in-app company creation" from the launch-readiness synthesis, closed by
  PR #182.
- "Subcontractor portal access denied after invite acceptance" and "subbie sees
  head-contractor workspace", closed by PR #183.
- "Dashboard lot status all zeros", closed by PR #184.
- "Double modal on login", closed by PR #185.
- "ABN placeholder fails validation", closed by PR #186.
- "Docket approvals empty state has no next action", closed by PR #187.
- "Project create leaves users on the project list", closed by PR #188.
- "Audit log search does not match user/project columns", closed by PR #189.
- "404 dead-end page", closed by PR #190.
- "No claims-oriented reports tab", closed by PR #192.
- "Audit log action labels are too raw", closed by PR #193.
- "Audit log pagination is only at the bottom", closed by PR #194.
- "Owner account can also behave as a subbie", closed by PRs #196 and #201.
- "Status override looks like the path to conformance", closed by PR #197.
- "Fresh QA/self-serve signup blocks on email verification", closed for demo/QA
  flows by PR #198.
- "Subbie dashboard/project routes show head-contractor surfaces", closed by
  PR #199.
- "New subbie portal appears empty unless HC remembers toggles", closed by
  PR #200.
- "Welcome tour / What's New modal nag stack", closed by PR #203.
- "Notifications bell routes to 404", closed by PR #204.
- "Force Conform has no reason / stale readiness after conform", closed by
  PR #205.
- "Cross-tenant 403 UX varies by page", closed by PR #206.
- "ITP template picker claims an activity filter it does not enforce", closed
  by PR #207.
- "Dashboard Reports quick-link points to the project list", closed by PR #208.
- "Project dashboard KPI labels are unclear", closed by PR #209.
- "Pending Approvals banner is not clickable", closed by PR #210.
- "Remove Assignment appears when nothing is assigned", closed by PR #211.
- "Lots with no ITP return 404 instance state", closed by PR #212.
- "Portal access autosave is implicit", closed by PR #213.
- "Owner login can follow stale subcontractor redirect", closed by PR #214.
- "Reset-password submit reveals token state", closed by PR #215.
- "Company Settings ABN placeholder is not a valid example", closed by
  PR #216.
- "Dev role switcher says one role while route guards use another", closed by
  PR #217.
- "Readiness actions only scroll near the right area", closed by PR #220 and
  PR #224.
- "Approved subcontractor invite cannot be accepted", closed by PR #221.
- "Notification bell opens a panel instead of the full notifications surface",
  closed by PR #222.
- "Subcontractor project links hit Access Denied / HC workspace routes", closed
  by PR #223.
- "Subcontractor portal only shows the first linked project", closed by
  PR #225.
- "Head contractor can approve or reject dockets but cannot query them from the
  approvals UI", closed by PR #226.
- "Fresh subbie employee/rate appears created but is invisible for docket
  submission", closed by PR #228.
- "Subbie link to unrelated head-contractor project gives unclear routing",
  closed by PR #229.
- "Readiness actions need clearer focus/scroll targets", closed by PR #230.
- "Force Conform reason is buried in raw audit JSON", closed by PR #231.
- "Subbie portal shows two notification bells, one of which opens settings",
  closed by PR #232.
- "In-app documentation route and missing docs tab", closed by PR #233.
- "Pilot onboarding guidance polish and HC docs portal link confusion", closed
  by PR #234.

### Product Strategy Docs And Codebase Health

Status: active; the code-health wave has continued on `master` through PR #316
(testResults route split, ITP hook extraction, more PDF/test characterization).

Product context docs:

- PR #235 added the curated product user-stories source of truth.
- PR #236 added the four-role pilot journey map.
- Use `docs/product/user-stories.md` and
  `docs/product/pilot-journeys.md` before planning role-aware UX, onboarding,
  dogfood, or workflow simplification work.

Local guardrails and test harness:

- PR #238 added dependency-free local dev guardrails: Node/npm pinning,
  generated Git hooks, and the root `npm run precommit` path.
- PR #239 updated pinned GitHub Actions runtime pins for Node 24 compatibility.
- PR #241 added the frontend Vitest/React Testing Library unit-test harness.

Backend refactor safety:

- PR #240 consolidated effective project role lookup through a shared helper.
- PR #254 reused the shared project-role access helper in the backend route
  layer.
- PR #255 covered production lot-assignment mount order.
- PR #256 removed the dead lot-assignments router.
- PRs #257-#261 added focused backend characterization coverage around
  subcontractor ITP lot access, lot clone round trips, test-result workflow
  statuses, test-result notifications, and Supabase certificate uploads.
- PR #278 characterized `DELETE /api/lots/:id` blocker responses for
  conformed, claimed, labour-docket, and plant-docket lots. The current wire
  contract is `error.code === 'VALIDATION_ERROR'` with domain markers under
  `error.details.code`.

PDF refactor and characterization:

- PR #242 added the first PDF output characterization tests.
- PRs #243-#253 split PDF runtime/types and the dashboard, test certificate,
  NCR, daily diary, docket detail, hold point, claim evidence, and conformance
  report generators into `frontend/src/lib/pdf/*`.
- `frontend/src/lib/pdfGenerator.ts` is now a barrel file; extend
  `frontend/src/lib/pdf/__tests__/pdfGenerator.characterization.test.ts` rather
  than creating duplicate PDF mocks.
- PRs #275 and #276 added dashboard and NCR detail PDF characterization.

Dashboard and lot-detail frontend refactors:

- PRs #265-#274 split dashboard date ranges, widget constants, widget hook,
  lot-status overview, KPI tiles, date-range picker, widget customizer, recent
  activity, and issue summary widgets.
- PR #277 started the `LotDetailPage` low-risk extraction sequence by moving
  pure ITP evidence helpers and override status constants out of the page.

Refactor wave since PR #278 (now merged to `master` through #316):

- `backend/src/routes/testResults.ts` was split into a `routes/testResults/`
  folder of 11 focused files (validation, access control, certificate intake/
  storage/extraction, corrections, presentation, status workflow,
  specifications); the main route is down to ~1,500 lines.
- `frontend/src/pages/lots/LotDetailPage.tsx` is down to ~1,463 lines after
  further component/hook extraction, including `useItpInstance` (#313, #316).
- More PDF and backend characterization coverage landed (hold-point and claim
  evidence-package PDFs, test-result access control).

Current large-file pressure (counts as of 2026-06-01, `master` @ `7ddec84`;
the still-monolithic backend routes now dominate — re-measure before picking
one):

- `backend/src/routes/holdpoints.ts` ~2,825, `notifications.ts` ~2,807,
  `lots.ts` ~2,802, `auth.ts` ~2,476, `dockets.ts` ~2,364 — all single files.
- `backend/src/lib/email.ts` ~1,640 and `lib/notificationAutomation.ts` ~1,527.
- Former targets `testResults.ts`, `pdfGenerator.ts`, `LotsPage.tsx`, and
  `DailyDiaryPage.tsx` are no longer primary oversized files.

These targets and the phase rules come from the **2026-06-01 engineering-health
roadmap**, the prioritized plan for this phase. In Workstream order it covers:
(1) split the giant backend route files (highest priority), (2) unify frontend
data-fetching on TanStack Query, (3) close testing gaps + add a coverage floor,
(4) consolidate the duplicate `ci.yml`/`test.yml` workflows, (5) small cleanups,
(6) refresh stale docs. Every PR must be behavior-preserving (no schema/API/UI
changes), one domain per PR, with tests green before and after. The roadmap is
framed as groundwork for a future AI/agentic layer; no AI features are built in
this phase. (The roadmap currently lives as Jay's external planning doc dated
2026-06-01, not yet a tracked file in this repo.)

Current merge discipline:

- Keep extracting in small PRs from fresh `origin/master` worktrees.
- Characterize first when moving backend route logic or PDF output.
- Land one PR at a time and wait for GitHub checks before merging the next.

### In-App And Tracked Documentation

Status: current as of this handoff refresh.

- The app now has first-party authenticated documentation at `/docs`.
- `/documentation` redirects to `/docs`.
- Help & Support links Documentation to the in-app guide instead of the unused
  external docs domain.
- Sidebar navigation includes Documentation for internal and subcontractor
  users.
- The tracked user-facing guide is `docs/user-guide.md`.
- The docs folder index is `docs/README.md`.
- The curated product/persona source of truth is
  `docs/product/user-stories.md`. Use it before planning UX, onboarding, QA, or
  feature work that depends on target users, pain points, or role-based jobs.
- The pilot journey source of truth is `docs/product/pilot-journeys.md`. Use it
  before planning role-aware dashboards, onboarding, dogfood scripts, or UI
  simplification PRs for the four core pilot users: owner/director, PM/QM,
  foreman/site supervisor, and subcontractor.
- Raw market and sales research remains under `docs/research/`; keep it for
  traceability rather than replacing it with curated summaries.

When user-facing workflow guidance changes, update both the app documentation
content under `frontend/src/pages/docs/` and `docs/user-guide.md` in the same
PR.

Open product-decision items:

- Pricing and free-tier packaging are intentionally deferred.
- Public/self-serve email verification policy is still a product/security
  decision. PR #198 is a demo/QA bypass, not a blanket production weakening.

Open low-risk polish candidates:

- Keep watching for new audit action names that fall back to automatic
  formatting. PR #193 added the known production action map, but new backend
  audit events should get an explicit label when added.
- Re-run live dogfood after each activation batch using sacrificial data and
  compare against the latest merged PRs, not historical report text.

### QA Loop Stage 86: Documents, Drawings, And ITP Evidence

Status: in PR from `qa/stage86-documents-drawings`.

- Documents/drawings browser E2E and focused unit coverage passed for document
  listing, signed thumbnail refresh, download/open fallback, drawing role
  controls, and subcontractor document access.
- Fixed image document thumbnails that could stay hidden after a signed preview
  URL arrived or refreshed.
- Aligned general document upload UI with backend-supported email evidence
  files (`.eml`, `.msg`).
- Changed read-only drawing register copy so viewers are not told to upload or
  manage drawings.
- Tightened ITP completion attachment intake: local `/uploads/documents/...`
  locators must now be attached by `documentId`, where project/lot/read-access
  checks already run; project-scoped Supabase document references remain
  supported for pre-uploaded files.
- Local DB-backed ITP route tests require a disposable test `DATABASE_URL`;
  this worktree did not have one, so the ITP regression is expected to be
  proven by CI.

## Open Follow-Ups

1. Re-run live sacrificial-data dogfood before the first paying customer and
   after any activation/RBAC change. Use the current app state, not stale
   `.gstack` report assumptions.
2. Keep production backup discipline in place for any future production data or
   schema work. PostgreSQL client tools are now installed on Jay's Windows
   machine, but do not assume the local shell has the intended production
   `DATABASE_URL`.
3. If new DeepSec findings appear, work them one by one. Root cause first,
   focused regression test, PR, wait for checks, merge, sync `master`.
4. If using historical `.gstack/dev-browser` reports, treat them as leads only.
   Many findings from the 2026-05-19 through 2026-05-28 reports have been
   closed by PRs #99-#278.

## Handoff Checklist For The Next Agent

1. `git switch master && git pull --ff-only`
2. Confirm `git status --short --branch`.
3. Read `CLAUDE.md`, this file, and `tasks/lessons.md`.
4. Treat `.deepsec/` as local audit input only. Do not stage it.
5. If continuing DeepSec work, use DeepSec metadata/export commands rather than
   reading mirrored file snapshots.
6. For each code fix: branch, patch, focused test, broader affected tests,
   lint/type/format/diff checks, PR, wait for GitHub checks, squash merge, sync
   `master`.

# Agent Handoff

Last updated: 2026-05-25

This file is the tracked handoff for the current SiteProof workstream. It is
intended for a fresh agent starting from `master`.

## Current Repo State

- Current branch: `master`
- Current app-code baseline when this handoff refresh was last updated:
  `4dc7dd3 fix: require active portal identity for subbie routes (#201)`
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

- Supabase Storage is the durable production file store for the public
  `documents` bucket.
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

Status: core activation and dogfood findings are closed through PR #201. No
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
   Many findings from the 2026-05-19 through 2026-05-25 reports have been
   closed by PRs #99-#201.

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

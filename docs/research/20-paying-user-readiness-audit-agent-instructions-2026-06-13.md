# Paying User Readiness Audit - Fresh Agent Instructions

Date: 2026-06-13

## Mission

Run a fresh, skeptical, end-to-end readiness audit of SiteProof as if the goal is to confidently allow paying construction customers onto the product.

The bar is not "CI passes." The bar is:

- Critical workflows behave correctly for every supported role.
- Authorization and project/company isolation are correct server-side.
- Uploaded evidence, emailed links, documents, dockets, ITPs, hold points, NCRs, diaries, claims, and reports remain accessible to the right people only.
- The app degrades safely when external services fail.
- Production configuration, monitoring, retention, backups, and deployment gates are good enough for real customers.
- The report is backed by concrete code references, tests, logs, and reproduction steps.

Do not assume prior audits were complete. Use them as background only.

## Ground Rules

- Read `CLAUDE.md` and `docs/agent-handoff.md` first.
- Read `AGENTS.md` if present.
- Read `tasks/lessons.md` before making decisions.
- Audit current clean `origin/master`, not a dirty local feature branch. This is mandatory.
- Start from a fresh worktree or clean checkout based on `origin/master`. If the checkout is dirty, stop and create a clean worktree rather than auditing mixed local work.
- Before auditing, record `git rev-parse --short HEAD`, `git rev-parse --short origin/master`, `git branch --show-current`, and `git status --short --branch` in the report.
- If `HEAD` is not exactly `origin/master`, say so in the first paragraph and do not present the report as a current launch-readiness verdict.
- Keep secrets, cookies, JWTs, database URLs, API keys, and browser-session data out of logs, reports, commits, and screenshots.
- Do not use `prisma db push` against production.
- Do not run destructive production commands.
- Do not modify files during the audit unless Jay explicitly asks for fixes.
- If fixes are later requested, use small PRs through CI. Do not push directly to `master`.
- Respect the foreman shell workstream boundary if it is still active. Avoid concurrent edits under `frontend/src/shell/**` unless Jay explicitly assigns that work.
- Treat client-side role checks as UX only. The audit must verify backend enforcement.
- Findings need evidence. "Looks risky" is not enough unless marked as a hypothesis requiring live validation.

## Required Output

Create or update the report at:

`docs/research/21-paying-user-readiness-audit-results-2026-06-13.md`

The report must explicitly state whether it audited clean `origin/master`.
If it did not, it must be labelled `not a current master audit` in the
Executive Summary and Launch Readiness Verdict.

Use this structure:

1. Executive Summary
2. Launch Readiness Verdict
3. Branch, Workspace, and Evidence Provenance
4. Top Blocking Issues
5. Findings by Severity
6. Workflow Coverage Matrix
7. Role and Permission Matrix
8. External Integration Matrix
9. Test/Command Evidence
10. Creative/Adversarial Audit Results
11. Fix Plan, split into PR-sized batches
12. Residual Risks and Required Manual Checks

Each finding must include:

- ID, severity, and affected workflow.
- User-visible impact in plain English.
- Exact file and line references where possible.
- Reproduction steps or a test gap that should reproduce it.
- Whether it is confirmed, likely, or needs live-environment validation.
- Suggested fix scope.
- Suggested regression test.

Severity definitions:

- `P0`: Data leak, unauthorized mutation, payment/customer-blocking outage, production data loss, or a workflow that cannot be used by paying users.
- `P1`: Important workflow broken or unreliable, incorrect business logic, evidence/document link failure, inconsistent permissions, or silent data corruption.
- `P2`: Degraded UX, poor failure handling, missing guardrail, operational risk, flaky behavior, confusing state, or incomplete reporting.
- `P3`: Cleanup, maintainability, polish, low-risk refactor, or documentation gap.

## How To Use Subagents

Use as many independent subagents as useful. Start with at least these lanes, then add more if a lane uncovers deeper risk.

Every subagent must return:

- Scope covered.
- Files and routes inspected.
- Commands/tests run.
- Confirmed findings.
- Suspected findings.
- Areas not covered.
- Recommended regression tests.

Do not let subagents fix code during the audit. Main agent should integrate and de-duplicate findings.

### Subagent 1 - Lot Lifecycle and ITPs

Audit complete lot creation and interaction from project setup through lot closeout.

Cover:

- Project setup prerequisites.
- Lot creation/edit/delete/assignment.
- Subcontractor assignment visibility.
- ITP template attachment to lots.
- Foreman and subcontractor pass/fail/NA/comment/evidence flows.
- Hold point gating inside ITP flow.
- Offline/mobile ITP behavior and sync conflict handling.
- Lot conformance, readiness, and closeout calculations.
- Reports generated from lot data.

Focus files:

- `backend/src/routes/lots*`
- `backend/src/routes/itp*`
- `backend/src/routes/holdpoints*`
- `frontend/src/pages/lots/**`
- `frontend/src/pages/itp/**`
- `frontend/src/components/foreman/**`
- `frontend/src/pages/subcontractor-portal/**`
- `frontend/e2e/lot-detail.spec.ts`
- `frontend/e2e/lots.spec.ts`
- `frontend/e2e/holdpoints.spec.ts`

### Subagent 2 - Hold Points, Evidence Links, and External Superintendent Emails

Audit every hold point request/release path and every emailed/public evidence link.

Cover:

- Token generation, hashing, expiry, revocation, and one-time use rules.
- Public release route mounting and unauthenticated access boundaries.
- Evidence attachment upload/download paths.
- Email templates, frontend URLs, backend URLs, and signed document URLs.
- Superintendent/external recipient path from email click to evidence view.
- Failure modes when evidence is missing, expired, or storage is unavailable.

Focus files:

- `backend/src/routes/holdpoints*`
- `backend/src/lib/email*`
- `backend/src/lib/documentSignedUrls*`
- `frontend/src/pages/holdpoints/**`
- `frontend/src/pages/public/**`
- `frontend/e2e/holdpoints.spec.ts`
- `frontend/e2e/productionReadiness.spec.ts`

### Subagent 3 - Subcontractor Portal and Access Control

Audit subcontractor onboarding, invitations, portal modules, and project-scoped access.

Cover:

- Invite creation, resend, acceptance, locked email handling, and public invite privacy.
- Subcontractor access switches by module.
- Direct-route access to assigned work, ITPs, dockets, NCRs, test results, documents, hold points.
- Cross-project and cross-company isolation.
- Rare access denied cases caused by mismatched project/company/subcontractor IDs.
- Frontend route guards versus backend authorization.

Focus files:

- `backend/src/routes/subcontractors/**`
- `backend/src/routes/subcontractors.test.ts`
- `frontend/src/pages/subcontractor-portal/**`
- `frontend/src/components/auth/**`
- `frontend/src/hooks/useProjectAccess.ts`
- `frontend/e2e/subcontractor-portal-rbac.spec.ts`

### Subagent 4 - NCRs, Defects, Corrective Actions, and Evidence

Audit NCR lifecycle and evidence handling.

Cover:

- NCR creation from lot/foreman/mobile flows.
- Assignments, comments, status changes, closeout, reopen, and evidence upload.
- Capture modal and offline sync attachment behavior.
- Permissions for creators, assignees, subcontractors, site managers, and project managers.
- Email/notification behavior.
- Report output and document links.

Focus files:

- `backend/src/routes/ncrs/**`
- `frontend/src/pages/ncr/**`
- `frontend/src/components/foreman/CaptureModal.tsx`
- `frontend/src/lib/offline/**`

### Subagent 5 - Dockets, Daily Diaries, and Field Operations

Audit field workflows used repeatedly on site.

Cover:

- Daily diary create/edit/submit/finish/approval.
- Weather, labour, plant, subcontractors, photos, and warnings.
- Docket create/edit/submit/approve/reject/rework.
- Subcontractor docket visibility and mutation restrictions.
- Offline/mobile behavior.
- Duplicate submission and retry behavior.

Focus files:

- `backend/src/routes/diary/**`
- `backend/src/routes/dockets*`
- `frontend/src/pages/diary/**`
- `frontend/src/pages/dockets/**`
- `frontend/src/pages/subcontractor-portal/*Docket*`
- `frontend/src/shell/**` only for read-only context unless assigned.

### Subagent 6 - Progress Claims, Commercial Access, and Reporting

Audit commercial workflows and payment-sensitive logic.

Cover:

- Claim creation from lots and percentages.
- Variation/progress calculations.
- Commercial role gating.
- Export/report/PDF correctness.
- Claim review, approval, rejection, history, and audit trails.
- Cross-project leakage and stale cached values.

Focus files:

- `backend/src/routes/claims/**`
- `frontend/src/pages/claims/**`
- `frontend/src/hooks/useCommercialAccess*`
- `frontend/src/lib/pdf/**`
- Claim-related tests.

### Subagent 7 - Documents, Drawings, Photos, Storage, and Signed URLs

Audit file storage and all customer-facing document paths.

Cover:

- Upload, download, preview, delete, replacement cleanup.
- Supabase path construction and origin checks.
- Signed URL token creation and retention cleanup.
- Comment attachments and document attachment links.
- Drawings, test certificates, avatars, logos, and generated reports.
- MIME type safety, filename safety, object URL revocation, and browser rendering.

Focus files:

- `backend/src/routes/documents*`
- `backend/src/routes/drawings*`
- `backend/src/routes/testResults*`
- `backend/src/lib/storage*`
- `backend/src/lib/supabase*`
- `frontend/src/pages/documents/**`
- `frontend/src/pages/drawings/**`
- `frontend/src/lib/download*`
- `frontend/e2e/productionReadiness.spec.ts`

### Subagent 8 - Authentication, Session Safety, MFA, and RBAC

Audit auth end to end.

Cover:

- Login/logout/register/password reset/invite acceptance.
- JWT signing, expiry, refresh behavior, and stale state cleanup.
- MFA setup, challenge, backup/recovery behavior.
- Public route allow-list.
- Role hierarchy and project-specific roles.
- Rate limits and brute-force protections.
- Development/mock auth gates.

Focus files:

- `backend/src/routes/auth*`
- `backend/src/middleware/authMiddleware*`
- `backend/src/middleware/rateLimit*`
- `frontend/src/lib/auth*`
- `frontend/src/components/auth/**`
- `frontend/e2e/auth.spec.ts`

### Subagent 9 - External Integrations and Operational Readiness

Audit production dependencies and failure handling.

Cover:

- Railway Postgres configuration assumptions.
- Supabase storage configuration.
- Resend email behavior.
- Google OAuth environment variables.
- Production startup validation.
- Error monitoring webhook.
- Backup, retention, and scheduled jobs.
- Production preflight behavior and missing-secret guardrails.

Focus files:

- `backend/src/config/**`
- `backend/src/index.ts`
- `backend/scripts/**`
- `.github/workflows/**`
- `docs/deployment*`
- `docs/agent-handoff.md`
- `backend/src/middleware/errorHandler.ts`

### Subagent 10 - Frontend UX, Navigation, and Mobile Responsiveness

Audit whether real users can complete workflows without dead ends.

Cover:

- Navigation for each role.
- Mobile layout and touch flows.
- Forms, validation, loading, empty, error, and success states.
- Buttons with correct types inside forms.
- Dead routes, blank pages, stale feature flags, and unmounted CTAs.
- Accessibility basics: labels, keyboard focus, dialogs, contrast, headings.
- Browser console errors in local E2E/manual flows.

Focus files:

- `frontend/src/App.tsx`
- `frontend/src/components/layouts/**`
- `frontend/src/pages/**`
- `frontend/src/components/ui/**`
- `frontend/e2e/**`

### Subagent 11 - Data Model, Migrations, Invariants, and Multi-Tenancy

Audit database-level correctness.

Cover:

- Prisma model relationships and cascade behavior.
- Company/project/user membership boundaries.
- Unique constraints and indexes.
- Soft delete or archival assumptions.
- Migration history and drift risk.
- Data retention scripts.
- Orphan records and stale tokens.

Focus files:

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/**`
- `backend/src/lib/prisma*`
- `backend/scripts/data-retention.ts`
- Route files that query by project/company/user IDs.

### Subagent 12 - Test Suite, CI, Coverage, and Flake Risk

Audit whether current tests would catch production blockers.

Cover:

- Backend unit/integration coverage for permission boundaries.
- Frontend unit/E2E coverage for critical flows.
- CI change detection and skipped jobs.
- PR smoke versus master full E2E.
- Production readiness guardrails.
- Flaky tests, long-running tests, and missing mocks.
- Whether recent fixes have regression tests.

Focus files:

- `.github/workflows/ci.yml`
- `.github/workflows/production-preflight.yml`
- `frontend/e2e/**`
- `backend/src/**/*.test.ts`
- `frontend/src/**/*.test.tsx`
- `frontend/vitest.config.ts`
- `frontend/playwright.config.ts`

## Commands To Run When Safe

Run from repo root unless noted. Record exact commands and outcomes.

```powershell
git fetch origin master
git rev-parse --short HEAD
git rev-parse --short origin/master
git branch --show-current
git status --short --branch
git log --oneline -5
```

If `HEAD` and `origin/master` differ, either switch to a clean `origin/master`
worktree before continuing or label the audit as stale/non-current. Do not mix
findings from a dirty branch with current-master launch advice.

Backend:

```powershell
cd backend
npm run format:check
npm run type-check
npm run lint
npm run build
npm test
```

Frontend:

```powershell
cd frontend
npm run format:check
npm run type-check
npm run lint
npm run test:coverage
npm run test:readiness
npm run build
npx playwright test --grep @pr-smoke
```

Full E2E is expensive but important before a launch-readiness verdict:

```powershell
cd frontend
npm run test:e2e
```

Advisory code intelligence:

```powershell
npm run fallow:audit
```

If a command cannot run because environment variables, services, or credentials are missing, say exactly what is missing without printing secrets.

## Manual Browser QA Requirements

Use local seeded/test users only. Do not use production customer data unless Jay explicitly asks and provides safe test accounts.

Run at least these browser journeys:

- Owner/admin creates project, lot, ITP assignment, subcontractor invite.
- Foreman works a lot on mobile, passes/fails/NA ITP items, adds evidence, requests hold point release.
- External superintendent opens hold point email link and views evidence.
- Subcontractor accepts invite, sees only assigned work, completes allowed ITP/docket/NCR actions, and is blocked from unassigned/direct routes.
- Project manager reviews lot readiness, reports, NCRs, dockets, and claims.
- Negative checks: unauthenticated user, wrong project user, wrong subcontractor, expired token, deleted evidence, missing storage config.

Capture screenshots only if they do not expose secrets or private user data.

## Creative and Adversarial Audit Angles

If the normal lane-by-lane audit is not finding meaningful issues, do not pad
the report. Change angle. Use these techniques to look for bugs, gaps, and
high-value upgrades that ordinary static review can miss.

### Abuse-Case Role Matrix

For every important object type, try the wrong actor:

- Wrong company admin reads or mutates it.
- Same-company non-project user opens the direct route/API.
- Subcontractor from project A opens project B object IDs.
- Subcontractor assigned to lot A mutates lot B.
- Foreman/site manager tries commercial-only claim routes.
- External token user tries expired, used, malformed, and unrelated IDs.

Report both confirmed bugs and missing tests. A clean audit should include
negative proof, not only happy-path proof.

### State-Machine Breakage

Draw the state machine for ITP items, hold points, NCRs, dockets, claims, and
diaries. Then try invalid transitions:

- Approve twice.
- Approve and reject concurrently.
- Submit after delete/archive.
- Complete before prerequisite.
- Reopen after closeout.
- Upload evidence after status is final.
- Retry after a network timeout where the server may already have committed.

Look for handlers that check state with `findFirst` and later update without a
conditional update, transaction, unique constraint, or idempotency key.

### Time, Expiry, and Timezone Attacks

Test behavior around:

- Expired invite/reset/magic-link/hold-point/document tokens.
- Midnight in Australia/Sydney versus UTC.
- Weekends and public holidays for claims, dockets, and hold-point scheduling.
- Long-lived browser tabs where permissions changed server-side.
- Clock skew between frontend, backend, database, and emailed links.

### Link and Evidence Chain Testing

For every file/evidence/email/report link, trace the full chain:

1. Who creates it.
2. What URL or token is stored.
3. What is sent to email or rendered in the browser.
4. What authorization is checked on click.
5. What happens after expiry, deletion, permission revocation, or storage
   cleanup failure.

Specifically try copying final redirected storage URLs and using them outside
the app session. Evidence privacy matters more than link convenience.

### Offline, Retry, and Conflict Chaos

Use browser offline mode and deliberate request failures:

- Submit the same action twice.
- Kill the network after the server commits but before the client receives the
  response.
- Queue work offline, then change the server state before reconnecting.
- Upload a file, fail the metadata write, then retry.
- Sync from two tabs or two devices for the same user.

Look for UI that says work is complete before the durable server state exists.

### Input Fuzzing and Boundary Values

Use malformed but realistic payloads:

- Empty strings, whitespace-only strings, very long strings, emoji, control
  characters, formula prefixes in CSV fields, path separators in filenames.
- Negative quantities, zero coordinates, huge costs, decimal rounding edges,
  duplicate emails with different casing.
- Wrong enum values, missing IDs, IDs from another project, and stale IDs.

Prefer route-level tests or disposable local DB tests over manual guessing.

### Cache and Stale Permission Hunting

Inspect TanStack Query keys and browser storage:

- Does the cache key include project/company/subcontractor/user scope?
- Does logout clear offline DB, localStorage, query cache, and service worker
  state?
- Does switching projects/users show stale lots, claims, dockets, or documents?
- Does a permission change invalidate visible modules and direct-route access?

### Production-Configuration Chaos

Run preflight/startup style checks with intentionally incomplete safe dummy
configuration:

- Missing email provider.
- Missing Supabase storage.
- Missing Google OAuth.
- Bad frontend/backend base URLs.
- `DATABASE_URL` pointing to localhost or malformed text.
- Monitoring endpoint invalid, slow, or returning 500.

The app should fail closed for required production dependencies and degrade
visibly for optional ones.

### Dead-End Product and Upgrade Hunt

Also look for possible upgrades that would reduce support risk or make the app
more sellable:

- A workflow that needs an audit trail but does not show history to users.
- A user action that needs confirmation, undo, or idempotency.
- A complex form that should autosave drafts.
- A missing dashboard signal for blocked lots, overdue hold points, or rejected
  dockets.
- A report/export that should include evidence links, signatures, timestamps,
  and responsible parties.
- A manual admin task that should become a preflight check, scheduled job, or
  visible health indicator.

Label upgrades separately from bugs. Do not inflate severity unless the current
behavior would hurt paying users.

### Fresh-Eyes Product Walkthrough

Ask at least one subagent to ignore the code initially and act like a paying
customer:

- What would they expect to click next?
- What states are confusing?
- Where does copy imply an action happened when it only recorded intent?
- Where is the product asking for trust without evidence?
- Where would a site team get stuck on mobile with poor reception?

Then cross-check those observations against code and tests.

## Audit Method

For each workflow:

1. Map the expected business process in plain English.
2. Trace frontend route to backend API.
3. Trace backend handler to Prisma queries and storage/email integrations.
4. Identify every role that can view or mutate it.
5. Check direct API access, not only UI access.
6. Check empty/loading/error/retry/offline states.
7. Check evidence/doc links from creation to later viewing.
8. Check audit trail/history/notifications where applicable.
9. Check tests that should fail if the behavior regresses.
10. Record confirmed gaps and missing coverage.

## Things To Be Especially Suspicious Of

- Any query that filters by `projectId` but not `companyId` where company isolation matters.
- Any subcontractor route that trusts frontend-selected IDs.
- Any role check implemented only in React.
- Any public token route mounted after auth middleware by accident.
- Any email link built from the wrong base URL.
- Any evidence link that works for internal users but not external recipients.
- Any report that fabricates missing data or silently omits failed lookups.
- Any upload flow that writes metadata but loses the actual file.
- Any offline sync path that marks work complete before upload/mutation success.
- Any cache key that misses project/company/subcontractor/user scope.
- Any mutation that returns success when no row was updated.
- Any direct route that loads data before checking project access.
- Any localStorage/sessionStorage parse that can crash the app.
- Any production job that is green because required secrets are absent and checks were skipped.

## Expected Final Recommendation

End with one of these verdicts:

- `Ready for limited pilot`: no P0/P1 blockers, production preflight genuinely configured, and critical workflows manually verified.
- `Close, but not ready`: no known P0 issues, but P1 workflow or operational gaps remain.
- `Not ready`: one or more P0 issues or multiple P1 issues in core customer workflows.

Be blunt. The goal is not to make the app look good; the goal is to find what would hurt paying users before they do.

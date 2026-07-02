# Paying User Readiness Audit — Results (Agent A)

Date: 2026-06-13
Auditor: Agent A (Claude)
Method: 12 independent read-only subagent lanes over a clean `origin/master`
worktree, integrated and spot-verified by the main agent.

> **This report audited clean `origin/master`** (`4f6b61b`), in a dedicated
> detached worktree, with no local feature-branch changes mixed in. It **is** a
> current-master launch-readiness verdict (not stale, not labelled
> "not a current master audit").

---

## 1. Executive Summary

SiteProof's **security, isolation, authentication, money, and storage
foundations are genuinely strong** — unusually so for a solo-built product.
Across eight separate adversarial lanes (auth/MFA/RBAC, subcontractor portal
access control, hold-point tokens, documents/storage/signed-URLs, progress
claims, data-model multi-tenancy, external integrations, and the public route
allow-list) the audit found **no confirmed P0 issues**: no cross-tenant data
leak, no auth bypass, no unauthorized-mutation path, no money-math error, no
silent ephemeral-storage trap reachable in a correctly-booting production.
Every high-risk surface came back with concrete negative proof (cited below).

The risk is **not** in the security perimeter. It is concentrated in
**data-integrity and audit-trail correctness inside core customer workflows** —
exactly where a construction-compliance product cannot afford to be wrong:

- **Offline ITP inspection integrity (the field-first core).** When the server
  rejects an offline-queued ITP completion with a 4xx, the device keeps showing
  the item as **PASS forever** and never reconciles — and the current test
  suite *pins this as correct behavior*. A second device can silently overwrite
  a FAIL with a stale PASS (last-write-wins, no conflict detection), destroying
  a real inspection result and orphaning the NCR it spawned.
- **Audit-trail completeness (the compliance selling point).** Deleting a
  project cascade-deletes its entire `audit_logs` history (and claims, NCR
  evidence rows, documents) — silently bypassing the stated 7-year retention.
  NCR reassignment writes no audit row at all.
- **Daily docket loop.** Concurrent docket approval (a double-tap on a slow
  phone) is non-atomic and can duplicate the auto-populated diary labour/plant
  rows that later feed claim reconciliation.
- **NCR workflow correctness.** A *major* NCR raised from a failed ITP item can
  never have its client formally notified, because the ITP-creation path never
  sets `clientNotificationRequired` (the standalone NCR form does) — a silent
  divergence in a compliance-critical action.

There are also several **operational P2s** worth closing before real customers:
a scheduled production preflight that goes green when secrets are *absent*
(false confidence), email-send failures swallowed with no UI signal, no
automated database backup, and a PR gate that runs only 6 mock-API smoke tests
(the full E2E suite runs **after** merge, not before).

**Bottom line:** the product is one focused, well-scoped fix batch away from a
supervised limited pilot. The architecture is sound; the gaps are specific,
located, and individually fixable. But shipping to paying customers *today*
would expose them to silent inspection-record corruption and audit-trail loss —
the two things a construction QA product exists to prevent.

---

## 2. Launch Readiness Verdict

### **NOT READY** (for unsupervised paying use)

Rationale, against the audit's own definitions:

- **No confirmed P0 issues.** This is real and earned, not assumed.
- **Multiple P1 issues in core customer workflows** (offline ITP integrity ×2,
  project-delete audit-trail loss, docket-approval duplication, NCR client
  notification, NCR reassignment audit gap). The definition of *Not ready* is
  "one or more P0 **or** multiple P1 issues in core customer workflows." The
  latter applies.

This is a **tractable** "Not ready," not a structural one. None of the P1s
require architectural rework; each has a clear, small fix (see §11). After the
P1 batch lands with regression tests and the two highest operational P2s
(preflight false-green, email-failure signalling) are closed, the honest
verdict moves to **Ready for limited (supervised) pilot** — subject to the live
manual checks in §12 that a static audit cannot perform (real Supabase ACL,
Railway start-command, GitHub required-status-checks, production secret
presence).

---

## 3. Branch, Workspace, and Evidence Provenance

| Item | Value |
|------|-------|
| Audit workspace | `C:\Users\jayso\siteproof-audit-master` (dedicated detached worktree) |
| Workspace HEAD | `4f6b61b` — *"Fix production preflight when secrets are missing (#870)"* |
| `origin/master` | `4f6b61b` (fetched at audit start) |
| HEAD == origin/master? | **Yes** — this is a current-master audit |
| Workspace status | clean (`## HEAD (no branch)`, no modifications) |
| Main repo (not audited) | `C:\Users\jayso\site-proofv3` on `perf/audit-2026-06-10`, **dirty** (50+ modified files) — deliberately excluded |
| Recent master log | `4f6b61b`(#870), `08ad593`(#869), `141a7fb`, `ebe1790`, `157b6b3`(#866), `3043a46`(#865), `4edc8de`(#863), `337a816`(#864) |

**Why a clean worktree:** the active branch `perf/audit-2026-06-10` carries
50+ uncommitted edits. Auditing it would conflate work-in-progress with the
shippable baseline. Per the audit ground rules, a detached worktree at exactly
`origin/master` was created so every finding describes the bytes that would
actually ship.

**Context docs read first** (per ground rules): `CLAUDE.md`,
`docs/agent-handoff.md` (baseline `7ddec84`/PR #316 dated 2026-06-01 — far
behind current `4f6b61b`/#870, so treated as background only as instructed),
`tasks/lessons.md`, and `AGENTS.md`.

**Evidence basis.** Findings are static code-trace plus targeted first-party
verification. The main agent independently re-read and confirmed the four
highest-impact P1s at the cited lines (S1-1, S5-1, S11-1, and the
4xx-vs-5xx gap), and executed one targeted unit test (§9). Backend DB-backed
suites were **not run** — the worktree has no `backend/.env` and the Prisma
client is the non-initialized stub (`@prisma/client did not initialize`), and
pointing tests at the production `DATABASE_URL` is forbidden. This is stated
plainly rather than worked around.

---

## 4. Top Blocking Issues

These are the issues that should block unsupervised paying use, in priority
order.

1. **S1-1 (P1) — Offline ITP completion rejected by the server stays "PASS" on
   the device forever.** A foreman in poor reception marks an item PASS offline;
   on reconnect the server rejects it (e.g. the I1-core hold-point guard, or any
   validation/permission 4xx); the sync worker error-marks the queue item and
   returns, but **never reverts the local cached completion** and **never
   distinguishes a terminal 4xx from a retriable 5xx**. The device shows a
   passed inspection the server refused to record. *Confirmed by code + test +
   test run.*

2. **S1-2 (P1) — Two-device ITP completion is silent last-write-wins.** Device A
   (offline) PASSes an item; Device B (online) FAILs the same item, raising an
   NCR. A's queued PASS later overwrites B's FAIL with no conflict detection —
   destroying a legitimate inspection result and orphaning the NCR. Lot edits
   have conflict detection; completions do not.

3. **S11-1 (P1) — Deleting a project destroys its entire audit trail.** The
   `audit_logs.project_id` FK is `ON DELETE CASCADE`, so an owner/admin deleting
   a project silently erases all `AuditLog` rows for it (plus claims, NCR
   evidence join rows, document rows), directly contradicting the product's
   7-year retention claim. Supabase storage objects are orphaned. *Confirmed in
   schema + migration.*

4. **S5-1 (P1) — Concurrent docket approval duplicates diary rows.** The approve
   handler reads the docket, checks status, then updates with `where: { id }`
   only (no conditional/transactional guard), and runs diary auto-population
   unconditionally. Two near-simultaneous approves (double-tap / client retry)
   both pass and both insert labour/plant rows into the diary — inflating
   records that feed claim reconciliation. *Confirmed in code.*

5. **S4-2 (P1) — Major NCRs raised from a failed ITP item can never notify the
   client.** The ITP-failed creation path omits `clientNotificationRequired`, so
   `notify-client` always 400s for these NCRs, while the standalone NCR form
   sets the flag. Whether a client must be formally notified about a major
   non-conformance depends on which screen raised it.

6. **S4-1 (P1) — NCR reassignment writes no audit trail.** Every other NCR state
   change is audited; re-pointing responsibility (a key accountability event)
   is not.

---

## 5. Findings by Severity

No confirmed **P0** findings.

### P1 — important workflow broken / silent data or audit corruption

| ID | Workflow | Impact | Evidence | Confidence |
|----|----------|--------|----------|------------|
| **S1-1** | Offline ITP completion sync | Server-rejected (4xx) completion shows PASS on device forever; no revert; 4xx not distinguished from 5xx | `frontend/src/lib/offline/syncWorker.ts:160-170`; `syncQueue.ts:7-12,60-68`; test pins it `syncWorker.test.ts:242-258` | Confirmed (code+test+run) |
| **S1-2** | Two-device ITP completion | Stale offline PASS overwrites a server FAIL; inspection result lost, NCR orphaned | `syncWorker.ts:145-158`; backend upsert has no optimistic lock `backend/src/routes/itp/completions.ts:301-361` (contrast lot PATCH `lots.ts:72-90`) | High |
| **S11-1** | Project deletion | Cascade-deletes all `audit_logs` for the project (+claims, NCR evidence, docs); 7-yr retention bypassed; Supabase objects orphaned | `migrations/20260508000000_initial/migration.sql:1652` (`ON DELETE CASCADE`); `schema.prisma:1406`; route `projects/writeRoutes.ts:437` | Confirmed (schema+migration) |
| **S5-1** | Docket approval (+reject/query) | Non-atomic status transition → concurrent approve duplicates diary labour/plant rows + double audit | `backend/src/routes/dockets/review.ts:52-98` (update `where:{id}` only, auto-pop `:126-200`); no `@@unique` on `DiaryPersonnel/Plant [diaryId,docketId]` | Confirmed (code) |
| **S4-2** | NCR from failed ITP item | Major NCR can never notify client (`clientNotificationRequired` never set on ITP path) | `backend/src/routes/itp/completions.ts:391-413` vs `ncrs/ncrCore.ts:272-273`; reject guard `ncrClosureWorkflow.ts:251` | High |
| **S4-1** | NCR reassignment | Re-pointing responsible party / overwriting QM comments writes no audit row | `backend/src/routes/ncrs/ncrCore.ts:434-592` (no `createAuditLog` in PATCH) | High |

### P2 — workflow unreliability, operational risk, degraded trust

| ID | Workflow | Impact | Evidence | Confidence |
|----|----------|--------|----------|------------|
| **S4-3** | NCR quality decisions | Inconsistent privileged-role sets → **owner-only org cannot close a major NCR** (owner can `close`/`notify-client` but not `qm-approve`, and close needs `qmApprovedAt`); site_manager can reject but not qm-review | `ncrWorkflow.ts:136,409`; `ncrClosureWorkflow.ts:55,134,266,355` | High (deadlock derived) |
| **S4-4** | NCR close concurrency | `close`/`qm-approve`/`notify-client` are findUnique→check→unconditional update (TOCTOU); double audit / loser-identity recorded | `ncrClosureWorkflow.ts:119-170` (contrast atomic `ncrWorkflow.ts:164-192`) | Likely |
| **S5-2** | Docket entry mutation | Status read happens *before* the row lock → entry can land on an already-submitted/approved docket | `dockets/entries.ts:92-111,192-199,271-285`; `plantEntries.ts:90-119` | Med-High |
| **S5-3** | Docket creation | No per-subbie-per-day uniqueness (DB or server); duplicate dockets; offline sync compounds | `backend/src/routes/dockets.ts:124-178`; `schema.prisma:1117-1148` (no `@@unique`); `frontend/src/lib/offline/syncClient.ts:201-226` | High |
| **S11-2** | Subbie invite (GlobalSubcontractor dedup) | App-only normalized dedup + exact-byte DB unique mismatch + read-then-create TOCTOU → duplicate subbie companies | `schema.prisma:998`; `subcontractors.ts:201-203`; `subcontractors/invitationRoutes.ts:258-298` | High |
| **S11-3** | Token/retention cleanup | `data-retention.ts` is manual-only (no cron/script/boot call) → reset/verification/signed-URL/HP tokens grow unbounded | `backend/scripts/data-retention.ts:339-409`; no script in `package.json`; not in `index.ts` | High |
| **S11-4** | Lot deletion | A released-but-not-conformed lot is deletable; cascade destroys hold-point release tokens/signatures (signed superintendent evidence) | `backend/src/lib/lotDeletion.ts:38-89` (only blocks *unreleased* HPs); cascades `schema.prisma:612,637` | High |
| **S9-1 / S12-7** | Production preflight | On `schedule`/`push`, missing secrets → `::warning::`+`exit 0`, integration steps skipped → job green having verified nothing (only `workflow_dispatch` fails closed) | `.github/workflows/production-preflight.yml:124-145` | High (mechanism); secret presence = live-check |
| **S9-2** | Invite / HP-release / member-invite emails | Routes ignore `sendEmail().success`; a Resend failure returns HTTP 200 with no `emailSent:false` signal → recipient never emailed, sender unaware | `backend/src/lib/email.ts:196-202`; `subcontractors/invitationRoutes.ts:342-354`; `holdpoints/requestReleaseRoutes.ts:342-345` | High |
| **S9-3** | Disaster recovery | No scheduled DB backup; `backup.ts` exists but is never invoked and defaults to ephemeral `./backups`; relies on (unverified) Railway managed backups | `backend/scripts/backup.ts:29`; no scheduler in `.github/**`; handoff §Open Follow-Ups | High |
| **S10-1** | Viewer navigation | Viewer enters a project and sees the full project nav, but 7 items (ITPs, Hold Points, Tests, NCRs, Diary, Dockets, Documents) are gated to `INTERNAL_ROLES` → each dead-ends on Access Denied, contradicting the "viewers can read everything" intent | `Sidebar.tsx:111-125,247-306`; routes `App.tsx:280-345`; `appRouteRoles.ts:6-17` | High |
| **S10-2** | Lot detail → Documents tab | Permanent placeholder; "Upload Document" button has no handler; tab never fetches/lists lot documents but looks like a feature | `frontend/src/pages/lots/components/LotDetailTabPanel.tsx:212-229` | High |
| **S12-1** | PR merge gate (E2E) | Full Playwright suite runs only `if: github.event_name != 'pull_request'` (post-merge). PRs run only 6 `@pr-smoke` tests; claims/dockets/ncr/test-results/diary have zero smoke coverage → a regression there merges unseen | `.github/workflows/ci.yml:222-256`; smoke tags in 6 specs only | High |
| **S12-3** | Test coverage (authz) | `auth.test.ts`, `claims.test.ts`, `dockets.test.ts` have **no** cross-tenant / wrong-role denial tests (only happy paths) → an authz regression in claims/dockets could merge | sampled suites; contrast strong denial coverage in `subcontractors/holdpoints/projects/lots` | High |
| **S2-4** | HP evidence links (external) | Evidence `fileUrl`s in the public release package are public-bucket URLs that resolve outside any session and after token expiry (by design — public bucket; confirm acceptable) | `holdpoints/evidencePackage.ts:153,198,218`; `lib/supabase.ts:51-57` | Needs live validation |
| **S12-2/4/5/6** | CI/test posture | PR smoke is 100% mock-API (no backend); `test:readiness` skipped on backend-only PRs; no internal-role RBAC denial E2E; frontend coverage floor is ~8–15% (near-meaningless) | `ci.yml:222-250,170-215`; `frontend/vitest.config.ts:38-43` | High |
| **S7-4** | Comment attachments | Content-sniffing is a no-op for `text/plain` allow-listed uploads (low risk; `text/plain` doesn't execute) | `backend/src/lib/imageValidation.ts:224-226` | Needs live validation |

### P3 — hardening, polish, cleanup (selected)

| ID | Note | Evidence |
|----|------|----------|
| S1-3 | Offline cache stores only `isHoldPoint` (drops `pointType`/`evidenceRequired`): witness/superintendent items over-gated offline, and evidence-required gate doesn't fire offline (no hold-point *bypass* though) | `frontend/src/pages/lots/lib/itpOfflineMapping.ts:41,68,69` |
| S1-4 | Offline ITP supports only PASS through the queue; N/A and FAIL are online-only (error toast offline) | `useItpMobileActions.ts:26-99` |
| S4-5 | `submit-for-verification` (the path the UI uses) writes no audit log, unlike `rectify` | `ncrClosureWorkflow.ts:397-461` vs `ncrWorkflow.ts:355` |
| S5-4 | Rejecting a docket sets `approvedById`/`approvedAt` (semantic misuse; "approved by" shows on rejected dockets) | `dockets/review.ts:287-295` |
| S6-1 | Claim report `variance`/`outstanding` use truthiness, so a claim certified at **$0** renders `null` instead of the full shortfall | `backend/src/routes/reports/claimRoutes.ts:190-199` |
| S6-2 | Certification document row created outside the claim-update transaction (orphan on partial failure; not money-affecting) | `claims/postEvidenceWorkflowRoutes.ts:131-170` |
| S6-3 | Audit-log write failures are swallowed on money-mutating claim actions (no metric/alert) | `backend/src/lib/auditLog.ts:87-90` |
| S7-1 | Silent ephemeral-disk fallback exists if Supabase unconfigured — **but** unreachable in prod (boot FATAL guard) | `runtimeConfig.ts:165-192`; `index.ts:46-47` |
| S7-2 | Drawings/certs/logos/avatars store the raw client `mimetype` (documents clamp it); safe today because allow-lists exclude svg/html | `drawings/storage.ts:76`; `documents/storage.ts:127` |
| S2-1 | Public HP release `signatureDataUrl` accepts any string (no `data:image/` refinement); not rendered, so inert today | `holdpoints/validation.ts:228` |
| S2-3 | Internal HP release `/:id/release` is not hardened with the public path's `updateMany`+count guard (duplicate "released" emails on concurrent release) | `holdpoints/actionRoutes.ts:301-310` |
| S8-1 | `generateRefreshToken()` is dead code (no refresh flow); a 7d-token minter inviting future misuse | `backend/src/lib/auth.ts:156-158` |
| S8-2 | Legacy unsalted SHA256 password verification still active "for migration"; no force-rehash on legacy login | `backend/src/lib/auth.ts:180-190` |
| S3-1/S3-2 | `canReadNcr` does sequential per-NCR lookups (latency); `getScopedSubcontractorUserLink` fallback returns suspended links (safe only because callers pair it with `assertSubcontractorPortalActive`) | `ncrs/ncrAccess.ts:165-248`; `subcontractors.ts:224-254` |
| S10-3 | A few raw `<button>` without `type` exist but none are inside a `<form>` today (latent) | `ExportLotsModal.tsx:205,209` et al |

---

## 6. Workflow Coverage Matrix

| Workflow | Audited | Verdict | Key findings |
|----------|---------|---------|--------------|
| Project setup / lot create-edit-delete-assign | ✅ | Backend role gating **solid**; delete-cascade audit loss | S11-1, S11-4; negative proof: foreman blocked server-side |
| ITP template attach + completion (pass/fail/NA/evidence) | ✅ | Online path solid; **offline path P1** | S1-1, S1-2, S1-3, S1-4; HP-gating correct |
| Hold points: request/release/tokens/public link | ✅ | **Strong** (hashed, expiring, single-use, identity-bound) | S2-1/2/3 (P3); S2-4 (evidence-URL privacy, by design) |
| Subcontractor onboarding / portal / module access | ✅ | **Strong** server-side isolation | S3-1/2 (P3 hardening) |
| NCR lifecycle / evidence / corrective actions | ✅ | Core guards solid; **audit + notify gaps** | S4-1, S4-2 (P1); S4-3, S4-4 (P2) |
| Dockets / daily diary / field ops | ✅ | Diary submit **fixed**; **approval concurrency P1** | S5-1 (P1); S5-2, S5-3 (P2) |
| Progress claims / commercial / reporting | ✅ | **Strong** money math + gating + state machine | S6-1/2/3 (P3) |
| Documents / drawings / storage / signed URLs | ✅ | **Strong** (origin/traversal guards, magic-byte sniff, FATAL config guard) | S7-1/2/3 (P3); S7-4 (P2 live-check) |
| Auth / session / MFA / RBAC | ✅ | **Strong** (fail-closed config, no MFA bypass, no enumeration) | S8-1/2 (P3) |
| External integrations / ops readiness | ✅ | App fails-closed correctly; **CI/ops P2s** | S9-1, S9-2, S9-3 |
| Frontend UX / navigation / mobile | ✅ | Mostly solid; **viewer nav + dead tab** | S10-1, S10-2 (P2) |
| Data model / migrations / multi-tenancy | ✅ | Internally consistent; **delete cascades + dedup** | S11-1, S11-2, S11-3, S11-4 |
| Test suite / CI / coverage | ✅ | Strong allow-list gate; **PR E2E gate weak** | S12-1, S12-3 (and S12-2/4/5/6) |

---

## 7. Role and Permission Matrix (server-side enforcement)

Verified that **backend** enforcement — not just React — gates each surface.

| Surface | Enforced server-side? | Evidence | Notes |
|---------|----------------------|----------|-------|
| Lot create/edit/delete/assign | ✅ excludes foreman | `lots/roles.ts:11-13`, `updateFields.ts:18-25`; every route calls `requireProjectRole` | Foreman = field execution only, confirmed |
| ITP completion (subbie) | ✅ project + module + assigned-lot | `itp/helpers/access.ts:155-231`; `instances.ts:339-360` (withholds superintendent items) | Superintendent items hidden from subbie view |
| Commercial / claims | ✅ owner/admin/PM only | `claims.ts:36-46` `requireCommercialProjectAccess`; `projectAccess.ts:94-143` | Frontend `ROLE_GROUPS.COMMERCIAL` matches exactly |
| Subcontractor portal data | ✅ membership + per-module switch + lot scope | `subcontractors.ts`; `testResults/accessControl.ts:95-102`; never trusts client IDs | NCR module opt-in (default off) |
| Hold-point public release | ✅ token-bound identity, superintendent gate | `holdpoints.ts:267-268`; `superintendentRecipients.ts:86-109` | Client-supplied name overridden by token |
| Public route allow-list | ✅ CI-enforced | `routeAuthCoverage.test.ts:215-245,247-776` | New unauthenticated route ⇒ red CI |
| **NCR quality decisions** | ⚠️ enforced but **inconsistent** | S4-3 role-set drift | Owner-only org deadlock on major NCR |
| **Viewer project pages** | ⚠️ enforced but **nav advertises denied routes** | S10-1 | Read-only intent contradicted |
| Dev role override (RoleSwitcher) | ✅ DEV-only, never read by backend | `auth.tsx:82-86`; `oauth/helpers.ts:28-30`; FATAL in prod | Cannot escalate in production |

---

## 8. External Integration Matrix

| Integration | Required? | Fail mode | Verdict |
|-------------|-----------|-----------|---------|
| Railway Postgres | Required | Boot FATAL on missing/localhost/malformed `DATABASE_URL`; **no** `db push`/`migrate deploy` at startup (`Dockerfile CMD node dist/index.js`) | ✅ Fails closed; live-check Railway start-command (§12) |
| Supabase Storage | Required | `assertProductionStorageConfig` FATAL if Supabase unconfigured or `ALLOW_LOCAL_FILE_STORAGE=true` | ✅ Ephemeral-disk trap unreachable in prod; live-check bucket ACL (§12) |
| Resend email | Required (unless `EMAIL_ENABLED=false`) | `sendEmail` returns `{success:false}` (does not throw); **callers ignore it** | ⚠️ S9-2 — workflow continues but gives no UI signal |
| Google OAuth | Optional | Paired env validated; prod verifies credential against Google tokeninfo, rejects unverified email | ✅ |
| Error-monitoring webhook | Optional | Disabled if unset; fire-and-forget; failures only logged | ✅ but if unset, only error log is ephemeral disk (S9-S3, live-check) |
| GitHub Actions preflight | Ops | `schedule`/`push` go green when secrets absent | ⚠️ S9-1 false-confidence |
| Backups | Ops | `backup.ts` never scheduled; ephemeral default dir | ⚠️ S9-3 |

---

## 9. Test / Command Evidence

| Command | Where | Outcome |
|---------|-------|---------|
| `git fetch origin master` + provenance | repo root | HEAD `25557e4` (dirty branch) ≠ origin/master `4f6b61b` → clean worktree created |
| `git worktree add … 4f6b61b` | repo root | Clean detached worktree at origin/master |
| `git status --short --branch` (worktree) | worktree | `## HEAD (no branch)` — clean |
| `npx vitest run src/lib/offline/syncWorker.test.ts` | worktree frontend | **54 passed** — includes the test (line 242) that asserts a 422 only error-marks and does NOT revert the local completion → first-party proof that S1-1 is real *and* encoded as "correct" |
| `vitest run claims/workflowValidation.test.ts + presentation.test.ts` | worktree (lane 6) | **42 passed** (pure money math/validation — no DB) |
| Direct re-read of S1-1, S5-1, S11-1 cited lines | main agent | All three confirmed at the exact cited locations |

**Commands intentionally not run (and why — no secrets printed):**

- Backend `npm test` / DB-backed suites — worktree has **no `backend/.env`** and
  the Prisma client is the non-initialized stub (`@prisma/client did not
  initialize`); pointing tests at the production `DATABASE_URL` is forbidden by
  `assertSafeTestDatabaseUrl`. Requires a disposable local Postgres + a real
  `prisma generate` to run safely.
- `backend npm run type-check` / `build` — same Prisma-client dependency.
- Full `npm run test:e2e` — requires a seeded backend + Postgres service;
  expensive and environment-gated. Recommended before the final pilot sign-off
  (see §12).
- `npm run fallow:audit` — advisory; not run in this read-only pass.

---

## 10. Creative / Adversarial Audit Results

The lanes deliberately ran the abuse-case, state-machine, time/expiry, link-chain,
offline-chaos, fuzzing, and stale-permission angles. Highlights:

- **Abuse-case role matrix:** No cross-company read/mutate path found. Subbie
  routes re-verify project membership + module switch + assigned-lot scope
  server-side (never trust client IDs). Commercial routes reject
  foreman/site_manager/subcontractor. *Negative proof is strong here.*
- **State-machine breakage:** Found the real gaps — docket double-approve
  (S5-1), NCR close TOCTOU (S4-4), internal HP double-release (S2-3), entry
  mutation vs status race (S5-2). The claims state machine is **airtight**
  (`partially_paid` excluded from the generic transition table; payment capped
  with `FOR UPDATE`). ITP hold-point completion gate is server-enforced and
  tested.
- **Time/expiry:** HP tokens (48h, hashed, single-use), reset (1h), magic-link
  (15m), verification (24h) all expire and are single-use. Expired-token cleanup
  is manual-only (S11-3).
- **Link & evidence chain:** Email links use `FRONTEND_URL` via `buildFrontendUrl`;
  prod enforces https + non-localhost. The one open question is HP evidence
  file URLs being public-bucket (S2-4) — resolves outside the session by design;
  needs a product decision on whether evidence privacy should exceed link
  obscurity.
- **Offline/retry/conflict chaos:** This is where the worst findings live —
  S1-1 (rejected completion never reverts) and S1-2 (no completion conflict
  detection). Diary and docket-create offline paths are *honest* (don't claim
  server commit; dedup by `syncKey`/`serverId`), and the NCR offline evidence
  path is robust (`serverDocumentId` retained so a re-attach doesn't re-upload).
- **Input fuzzing:** Money math bounds 0–100%, finite, non-negative; CSV
  formula-injection escaped on both server and client; filenames sanitized; the
  $0-certified report-rendering bug (S6-1) surfaced from boundary thinking.
- **Production-configuration chaos:** App fails closed on every *required*
  dependency (verified end-to-end through `validateRuntimeConfig`); the gap is
  the *CI preflight* going green when secrets are absent (S9-1).
- **Dead-end / upgrade hunt:** Viewer nav dead-ends (S10-1), the placeholder
  lot Documents tab (S10-2), and the absence of an automated backup/retention
  job (S9-3, S11-3) are the support-risk reducers worth doing.

---

## 11. Fix Plan (PR-sized batches)

Each batch is one domain, behavior-preserving where possible, with the
regression test that should ship with it. Use small PRs through CI; do not push
to `master`.

### Batch A — Offline ITP integrity (highest priority; field-first core)
- **S1-1:** In `syncWorker.ts`, branch on `response.status`: a non-retriable
  4xx must revert the local completion to server truth (or a `conflict` state)
  and surface an item-level error — not dead-letter as transient. Update
  `syncWorker.test.ts:242-258` to assert the reverted behavior (it currently
  asserts the bug).
- **S1-2:** Add a completion version/`updatedAt` to the offline row and an
  optimistic-lock check on `POST /api/itp/completions` (mirror the lot PATCH
  `expectedUpdatedAt` pattern); on divergence, flag a conflict instead of
  overwriting.
- **S1-3 (fold in):** Persist `pointType` + `evidenceRequired` in the offline
  row instead of deriving from `isHoldPoint`.
- *Tests:* 4xx-replay reverts local state; stale-PASS does not overwrite a
  server FAIL; witness/superintendent/test items round-trip with classification
  intact.

### Batch B — Audit-trail & retention integrity (compliance promise)
- **S11-1:** Make project deletion preserve the audit trail — either soft-delete
  projects, or change `audit_logs.project_id` FK to `SET NULL` (copy to a
  retention table first), and block hard delete when claims/conformed lots/audit
  history exist. Reviewed Prisma migration only (no `db push`).
- **S4-1:** Add `createAuditLog` to the NCR PATCH (responsible-party from/to).
- **S4-5 (fold in):** Add the same audit write to `submit-for-verification`.
- **S11-4:** Block lot deletion when any hold point has `releasedAt != null`.
- *Tests:* project with audit history → delete blocked or audit survives;
  PATCH redirect writes an audit row; lot with a released HP → delete blocked.

### Batch C — Docket approval & creation integrity (daily loop)
- **S5-1:** Make approve/reject/query atomic — conditional `updateMany({ where:
  { id, status:'pending_approval' }})` (or `$transaction` + `FOR UPDATE`), with
  diary auto-population inside the same guarded transaction; `count===0` ⇒
  idempotent no-op.
- **S5-2:** Re-assert editability *inside* the locked transaction in
  `entries.ts`/`plantEntries.ts`.
- **S5-3:** Decide the one-docket-per-subbie-per-day rule; if intended, add
  `@@unique([subcontractorCompanyId, projectId, date])` + return-existing on
  create, and make `syncOfflineDocketDraft` handle the conflict.
- *Tests:* concurrent double-approve ⇒ one success + one diary row-set + one
  audit; entry-add vs submit race rejected; duplicate-day create returns
  existing.

### Batch D — NCR workflow correctness
- **S4-2:** Set `clientNotificationRequired: isMajor` on the ITP-failed NCR
  create path.
- **S4-3:** Pick one canonical quality-decision role set (likely
  `NCR_QUALITY_MANAGEMENT_ROLES`) and apply uniformly; at minimum add `owner` to
  `qm-approve` to remove the deadlock.
- **S4-4:** Convert `close` (and reject/reopen) to conditional `updateMany`.
- *Tests:* major NCR from ITP → `notify-client` 200; owner-only org can
  qm-approve→close a major NCR; concurrent double-close ⇒ one audit row.

### Batch E — Operational hardening (before pilot)
- **S9-1:** `schedule` preflight must fail (not exit 0) when required secrets
  are missing.
- **S9-2:** Surface `emailResult.success` to the client on invite / HP-release /
  member-invite (e.g. `emailDelivered: false`) so the UI can warn.
- **S9-3:** Schedule `backup.ts` to an offsite destination, or document + test a
  Railway managed-backup restore runbook.
- **S11-3:** Schedule `data-retention.ts apply` (or inline expiry cleanup).

### Batch F — UX & test-gate
- **S10-1:** Filter the 7 internal-only items out of viewer nav (or grant viewer
  read access to those routes).
- **S10-2:** Wire the lot Documents-tab upload, or hide the tab.
- **S12-1/S12-3:** Tag ≥1 happy-path `@pr-smoke` E2E per revenue/compliance
  domain; add cross-tenant/role denial tests to `claims.test.ts`,
  `dockets.test.ts`, `auth.test.ts`.

### Batch G — P3 cleanup (opportunistic)
S1-4, S2-1/3, S5-4, S6-1/2/3, S7-2, S8-1/2, S3-1/2 — bundle as small,
low-risk PRs as capacity allows.

---

## 12. Residual Risks and Required Manual Checks

A static audit cannot confirm these. They must be checked live before the pilot
sign-off:

1. **Supabase bucket ACL (S2-4, S7-3, S7-4).** Confirm whether public-bucket
   evidence/comment URLs are an accepted privacy tradeoff, and that served
   content-types are safe. If evidence must be private beyond the token holder,
   switch HP evidence references to signed, token-scoped URLs.
2. **Railway start/pre-deploy commands (S9-S2).** Confirm in the Railway
   dashboard that the backend's Custom Start Command and Pre-deploy Command are
   **blank** (so no stray `prisma db push`/`migrate deploy` runs on deploy).
3. **Production secret presence (S9-1/S9-S1).** Confirm the `production` GitHub
   Environment holds all preflight secrets — otherwise the nightly green check
   verified nothing.
4. **Error-monitoring endpoint (S9-S3).** Confirm `ERROR_MONITORING_ENDPOINT_URL`
   is set; otherwise production 5xx history lives only on ephemeral disk.
5. **GitHub required status checks (S12, biggest unknown).** Confirm `backend`,
   `frontend`, and `frontend-pr-e2e-smoke` are *required* checks on `master` —
   the gates only matter if merge is actually blocked on them.
6. **Live DB drift (S11-S1).** Run `check-migration-drift.mjs` with a disposable
   shadow DB against production before relying on "no drift."
7. **Full E2E + backend test suite.** Run `npm run test:e2e` and the backend
   suite (local Postgres + generated Prisma client) on a clean `master`
   checkout to confirm green before sign-off — this audit could not.
8. **Manual browser journeys** (from the audit brief), especially the offline
   ITP path on a real phone with the network toggled, the external
   superintendent email→evidence→release chain, and a subcontractor blocked
   from unassigned/direct routes.

---

*End of Agent A report. No secrets, tokens, connection strings, or private user
data were printed, logged, or committed during this audit. No files in the
codebase were modified; the audit ran in a read-only detached worktree at
`origin/master` `4f6b61b`.*

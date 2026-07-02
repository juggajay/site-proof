# QA + Progress-Claim change campaign (from PR #762)

Source of truth: `docs/change-requests.md`, `docs/dev-handoff-changes.md`,
`docs/research-findings-qa-claims.md` (merged 2026-06-09, commit `2dd9a92`).

**Guiding principle:** SiteProof is single-sided / contractor-side. The
client / Principal / superintendent is **external** — served by outputs (PDF,
exports, tokenised hold-point release link), never by an in-app login.

**Operating model:** one focused PR per ticket, built by a subagent
build→verify→review workflow, gate-merged by me (poll CI green → squash-merge →
confirm master CI). Behaviour-preserving where possible; add/adjust tests.

## Order (per dev handoff: bugs/concrete first, design last)

- [x] **B1** — Fix Evidence Package PDF crash. MERGED #763 `a8124cb`. *bug/high*
- [x] **B2** — Attach a certificate to an existing test. MERGED #764 `e6ee59d`
  (needed a CI fix: dropped a mis-placed Supabase-replace test). *bug/high*
- [x] **T1** — Conformance test requirement derives from the ITP. MERGED #765
  `6cd819c` (CI fix: no-ITP lot no longer shows a stale test blocker). *change/high*
- [x] **T2** — Simplify test submission (RESULT_REQUIRED gate + EnterResultsModal;
  short path <=2 clicks). MERGED #767 `2980ce9` (green first try). NATA status deferred. *change/high*
- [x] **C2** — Claim a % (or $) of a lot's total. ALREADY SHIPPED in PR #722
  (`4745077`); change-request premise was a stale snapshot. No-op. *feature/high*
- [x] **N1** — NCRs assignable to subcontractor or user. MERGED #766 `ef82e77`
  (graceful picker degrade + portal-gated notify; CI fix: test response shapes). *feature/high*
- [x] **C1-core** — "Record certification received" (outbound). MERGED #768
  `24d6343` (green first try). Relabel + cert-PDF upload + read-back. **No migration.** *change/med-high*
- [x] **I1-core** — One source of truth for hold-point sign-off. MERGED #769
  `be2f29d` (green first try). Guard + release find-or-creates completed completion +
  attribution display + locked checkbox. **NO migration**; trust boundary untouched. *change/med*

## Deferred — need Jay's product call + an operator-approved Prisma migration
- [ ] **C1-direction/inbound** — true `direction` column + the INBOUND subbie->HC
  claim (does NOT exist today; claims are HC-only). Net-new feature, not a relabel.
- [ ] **C1-output (larger)** — SOPA payment-claim PDF + supporting statement +
  evidence-pack bundle. Spec ready: `docs/research/progress-claim-output-spec.md`.
- [ ] **T2-NATA** — capture NATA accreditation status on the cert (needs a column).
- [ ] **Schema cleanup** — promote claim JSON-in-disputeNotes to real columns; any
  ITPCompletion<->HoldPoint FK (not recommended — would create a 2nd source of truth).

## Side workstreams
- [ ] **Research (running):** concrete SOPA payment-claim PDF + payment-schedule
  output spec (NSW + QLD/VIC) -> feeds C1's "real output" larger piece.
- [ ] **C1-output (separate, larger):** implement the SOPA payment-claim PDF +
  supporting statement + evidence-pack bundle (scope after research). Replaces thin CSV.

## Review — CAMPAIGN COMPLETE (2026-06-09 → 2026-06-10)
- #762 change plan + research + handoff MERGED `2dd9a92`.
- **All 8 backlog tickets resolved**, each a focused gated PR (build→adversarial
  review→fix → poll CI green → squash-merge → verify master CI):
  - B1 #763 `a8124cb` — evidence-package PDF null-guard + empty-lot test.
  - B2 #764 `e6ee59d` — attach a cert to an existing test (unblocks Verify).
  - T1 #765 `6cd819c` — conformance test requirement derives from the ITP.
  - T2 #767 `2980ce9` — require a recorded result before entered/verified; <=2-click path.
  - N1 #766 `ef82e77` — NCRs assignable to a subcontractor or a user.
  - C2 — already shipped (#722); change-request premise was a stale snapshot (no-op).
  - C1-core #768 `24d6343` — "record certification received" (relabel + cert upload + read-back).
  - I1-core #769 `be2f29d` — one source of truth for hold-point sign-off (close the loophole).
- **No production schema migration was performed** — both design tickets (C1/I1)
  were delivered migration-free by design. Deferred items above still await Jay's
  product call + an operator-approved migration.
- Recurring ops note: backend DB-backed tests can't run locally (prod-DB guard),
  so B2/T1/N1 each needed one CI round-trip to fix a test-shape assertion (not a
  logic bug); fixed in throwaway worktrees so concurrent builds were undisturbed.
  T2/C1/I1 passed first try once reviews started grepping the suite proactively.

---

# Onboarding tour: existing users keep getting the first-run tour (2026-06-27)

**Bug:** product tour auto-shows on every login for existing (non-new) users.
**Root cause (verified):** the "seen the tour" gate is a per-device localStorage
marker only (`siteproof_onboarding_completed:<userId>`). There is NO account-level
record (backend has no field). Sign-out does NOT clear it (only auth keys). So any
browser/device without the marker — first login after the tour revival (#783), a
new device, incognito, cleared storage, or cycling QA accounts — re-shows the tour
because the system literally can't tell the account is "not new".
**Fix (Jay's call):** durable backend flag `User.onboardingCompletedAt`.

- [x] Backend: add `User.onboardingCompletedAt DateTime?` + additive migration (no backfill).
- [x] Backend: include it in `verifyToken` (/me) + login response serializers.
- [x] Backend: `POST /api/auth/onboarding/complete` sets it (first completion only).
- [x] Backend tests (auth.test.ts, DB-backed → CI): /me+login expose it; endpoint sets it; replay no-op.
- [x] Frontend: add to `User` type; gate auto-show on `!user.onboardingCompletedAt`; persist on open + dismiss.
- [x] Frontend test (OnboardingTour.test.tsx, local): account flag suppresses auto-show on a fresh device.
- [x] Verify: frontend type-check + test:unit local (green); backend type-check local (green); backend DB tests run in CI.

DEPLOY ORDERING (critical): apply the migration to prod BEFORE deploying this
backend — `/me` and login now SELECT `onboarding_completed_at`. Additive/nullable,
so migrate-then-deploy is safe and non-breaking.

Ops note: backend DB-backed tests can't run locally (prod-DB guard) — no `prisma
migrate` run here; migration is hand-authored + applied via the reviewed deploy.

---

# Performance audit run (2026-06-10)

Scoped, time-boxed audit: bundle, N+1 queries, live prod timings. Health
baseline: fallow score 82.5 (B); dead code essentially zero.

## Findings
- **Bundle: already healthy.** Eager initial JS ~150KB gzip; recharts/jsPDF/
  PDFViewer/html2canvas all lazy chunks. No fix needed.
- **Prod baseline (QA tenant): 191-360ms** per hot endpoint — mostly network
  floor; QA tenant nearly empty, so N+1 wins show at data scale, not here.
- Real wins were backend query patterns on daily-use endpoints.

## Shipped
- [x] **PR #770** (MERGED) — diary list: stop hydrating 6 child tables + lot
  joins per row (UI shows date/status/weather/personnel-count only); **bug
  fix**: diary search results never rendered (envelope treated as array).
- [x] **PR #771** (MERGED) — docket detail: 3 sequential lookups → Promise.all; docket
  approve: per-entry diary inserts → 2 createMany; added the missing positive
  auto-population test (only negative cases existed; code swallows errors).
- [x] **PR #772** (MERGED) — foreman dashboard: 4 sequential reads → Promise.all.

## Deferred (diminishing returns / needs care)
- lots `/:id/readiness` deep include → `_count` (response-shape risk).
- lots `/:id/conform-status` fetch-all-tests-filter-in-JS (conformance logic,
  wants its own characterized PR).
- docket submit/respond sequential email loops (error-semantics change;
  consider background queue instead).
- notifications endpoint slowest baseline (357-762ms, 12.5KB) — not in scope.

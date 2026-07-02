# SiteProof v3 — Launch-Readiness Audit (2026-07-02)

**Target:** `origin/master` @ `216d107a` (audited in a clean worktree — NOT the local
`fix/landing-logged-out` branch, which is 127 commits behind master).
**Method:** 6 parallel read-only review agents (prior-findings verification, authz/tenancy,
money paths, production operability, frontend correctness, performance) + fallow static
analysis + CI check. Every finding verified by reading the actual handler code.
**Prior audit:** 2026-06-15 (`tasks/launch-readiness-audit.md`) — 435 commits have landed since.

---

## Verdict: READY TO LAUNCH. 0 blockers. 2 fix-before-charging items.

The big story since June 15: **all five "fix before charging" items from the last audit are
already fixed on master**, along with the three worst hardening-backlog items. The 435
commits of QA-stage hardening did their job. This audit's fresh pass over the new surface
(Xero export, batch hold points, document versioning, company-admin hardening) found **no
cross-tenant leaks, no auth bypass, no privilege escalation** — and production operability
is the strongest area of the codebase.

### June 15 items — current status (verified in code)

| Item | Status | Evidence |
|---|---|---|
| FBC-1 Claims over-claim race | **FIXED** | `claims/workflowRoutes.ts:82-89,150` — `lockClaimLotsForUpdate` (`SELECT … FOR UPDATE`) + cumulative guard at :228-233 |
| FBC-2 OAuth sig only in prod | **FIXED** | `oauth.ts:405-411` — verification unconditional; test fixture needs `NODE_ENV==='test' && ALLOW_TEST_GOOGLE_CREDENTIALS` |
| FBC-3 Seat limit unenforced | **IMPLEMENTED, DELIBERATELY OFF** | `company/memberRoutes.ts:385-397` enforces; gated on `TIER_QUOTA_ENFORCEMENT_ENABLED=false` (`lib/tierLimits.ts:14`) — intentional until billing/upgrade path exists |
| FBC-4 NCR self-approval | **FIXED** | `ncrs/ncrClosureWorkflow.ts:251-255` — approver≠closer enforced |
| FBC-5 Concession w/o justification | **FIXED** | `ncrs/ncrWorkflowValidation.ts:111-138` — superRefine requires justification + risk assessment |
| HB duplicate payment emails | **FIXED** | `postEvidenceWorkflowRoutes.ts:309-348` — locked, status-checked, email post-tx |
| HB API keys survive logout-all | **FIXED** | `auth/sessionRoutes.ts:191` — `revokeActiveApiKeysForUser` |
| HB stale offline diary snapshot | **FIXED** | `diary/diaryAccess.ts:98-120` + `diarySubmission.ts:166-204` — row-locked, server re-derives |

---

## FIX BEFORE CHARGING (2 new findings — both money integrity)

### 1. (HIGH confidence) Editing a lot's budget after it's partially claimed corrupts billing math
- **Files:** `backend/src/routes/lots.ts:116-135` (budget edit allowed while `conformed`),
  `claims/workflowRoutes.ts:237-271` (claim lines snapshot `budget × increment%`),
  `claims/workflowValidation.ts:253-272` (over-claim cap is **percentage**, not dollars).
- **Scenario:** Lot budget $100k → Claim 1 bills 50% = $50k (lot stays `conformed`) → PM
  edits budget to $200k (a routine variation) → Claim 2 bills "remaining 50%" = $100k and
  the lot locks at 100%. Total billed $150k against a $200k budget — $50k can never be
  claimed. Edit the budget *down* instead and you **over-bill** the client. Either way the
  ledger reconciles to no coherent budget.
- **Why it matters:** variations are routine in civil; this will happen in normal use.
- **Fix:** block `budgetAmount` edits once a lot has any `ClaimedLot` row (or require a
  re-rate flow). Small backend-only change + regression test.

### 2. (MEDIUM confidence) Generic PUT certify path can certify below the amount already paid
- **File:** `backend/src/routes/claims/workflowRoutes.ts:419-426`.
- The HEAD commit (`216d107a`) added `assertCertifiedAmountCoversPaid` to the dedicated
  `POST …/certify` — but the generic `PUT /claims/:id` certify branch didn't get it.
- **Scenario:** certify → partial payment ($500) → `PUT status:'disputed'` (allowed) →
  `PUT status:'certified', certifiedAmount:100` → paid > certified (negative outstanding);
  certifying at 0 via this path wipes the recorded payment.
- **Fix:** one line — add the same `assertCertifiedAmountCoversPaid(roundedCertifiedAmount,
  claim.paidAmount)` guard to the PUT branch, + test.

---

## Decision needed from Jay (not bugs)

- **Tier quotas are OFF** (`TIER_QUOTA_ENFORCEMENT_ENABLED=false`). Deliberate: no
  billing/upgrade path yet, so a hard cap would brick a paying company mid-project. Confirm
  you're OK charging with seats/projects unenforced until billing ships.
- **Railway healthcheck path** — code has both a static `/health` (200 even if Postgres is
  down) and a DB-aware `/ready`. Verify the Railway service healthcheck targets `/ready`.
  Config check, not code.

---

## HARDENING BACKLOG (post-launch fine; roughly ranked)

1. **Offline sync failures show no reason** — `syncWorker.ts` stores the server rejection in
   `lastError` but no component renders it; `OfflineIndicator.tsx:94-108` shows only
   "{n} items failed to sync". A foreman whose diary was rejected can't see why.
2. **Retry on a terminally-failed offline item loops forever** — Retry resets attempts, the
   same 409 re-fails, the pill returns. No dismiss/acknowledge path; permanent badge.
3. **Xero export ignores claim status** — `claims/xeroExport.ts:166-217` exports draft
   claims and always uses claimed (not certified) amounts. Gate on
   `status ∈ {submitted, certified, paid, partially_paid}`. (Claimed-amount is defensible
   for AU progress claims; draft export is the foot-gun.)
4. **Xero export "cumulative %" is latest, not as-of-claim** — `xeroExport.ts:193-211`;
   re-exporting an old claim shows wrong % in the line description. Display-only.
5. **Notification dedup queries are unindexed** — reminder/alert crons do
   `findFirst({projectId, type, message:{contains:date}})`
   (`notifications/diaryReminderRoutes.ts:70-76` et al) but `Notification` has no
   projectId/type index (`schema.prisma:1441-1442`). Add `@@index([projectId, type])` and
   move the date out of `message contains`. Grows with every notification row.
6. **`POST /system-alerts/check` is a serial nested N+1** — `notifications/systemAlerts.ts:58-301`;
   ~600–1000 sequential queries per hourly run at 20 projects. Cron-only, not user-facing.
7. **Audit-log search ILIKEs 8 fields including the `changes` JSON** — `auditLog.ts:272-293`;
   full-scan at 500k rows. Admin-only, only when searching. Trigram index or drop `changes`
   from searchable fields.
8. **Frontend ships broken if `VITE_API_URL` is dropped from Vercel** — `lib/config.ts:55`
   falls back to `''` in prod, every API call 404s, build still succeeds. Add a build-time
   throw when `PROD && !configuredApiUrl`.
9. **Unread-bell count runs a per-row project-membership subquery** — `notifications/userRoutes.ts:132-149`.
   Fine at launch; watch item.
10. **Role-gate consistency nit** — 3 components gate on `user?.role` instead of
    `actualRole`/`roleInCompany` (`CompanySettingsPage.tsx:46-49`, subbie `CompanyScreen.tsx:252`,
    `MyCompanyPage.tsx:45`). Inert in prod (RoleSwitcher is DEV-only) + server-checked.
11. **`pdfjs-dist`** appears unused in `frontend/package.json` (fallow) — verify (may be a
    worker-URL string import) then drop.

---

## What's verified solid (don't re-litigate)

- **Tenancy/authz:** every new surface (Xero export, batch hold points, doc versioning,
  scheduled reports, account export, subbie docket fixes) correctly scoped;
  `routeAuthCoverage` guardrail self-maintains the public allow-list; public hold-point
  tokens are 256-bit, SHA-256-stored, 48h expiry.
- **Money spine:** Decimal storage throughout, `FOR UPDATE` locks on claim
  create/certify/payment/delete, atomic docket state transitions, per-line cent rounding
  with export-total reconciliation, CSV formula injection neutralized in the one shared
  serializer (`frontend/src/lib/csv.ts:13-21`).
- **Ops:** fail-fast prod boot on every missing secret (incl. refusing local file storage),
  DB-backed rate limiting with lockouts, exact-match CORS allow-list, Sentry with
  cookie/auth scrubbing, emails after commit, double-run-safe cron, dead-lettering offline
  queue, crash → exit(1) → Railway restart.
- **Frontend:** no silent mutation failures on the paying-user flows, single shared AUD
  formatter, all `dangerouslySetInnerHTML` sanitized, no raw Supabase URLs rendered,
  server-authoritative `ProjectProtectedRoute`.
- **Static health (fallow):** 0 dead files, 0 dead exports, 0 circular deps, avg cyclomatic
  2.0, maintainability 91/100 over 1,822 files.

## CI status
**Green.** The run covering the two newest commits (Xero export `a40752b7` + certify-guard
`216d107a`) completed successfully (run 28567346339) — master is fully green at the audited
SHA. A recent E2E flake (`#1310`) was fixed forward by `ba2b5d30`.

## Recommended order
1. Fix-before-charging #1 (lot budget edit lock) — backend-only, + regression test.
2. Fix-before-charging #2 (PUT certify coversPaid guard) — one line + test.
3. Hardening #1–2 (offline failure reason + retry dead-end) — the foreman field experience.
4. Hardening #3 + #5 (Xero draft gate, notification index) — cheap.
5. Everything else post-launch.

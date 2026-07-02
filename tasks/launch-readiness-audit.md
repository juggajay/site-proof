# SiteProof v3 — Pre-Launch Security & Integrity Audit

**Date:** 2026-06-15
**Reviewer:** Lead security review (synthesis of adversarially-verified findings)
**Context:** First paying head-contractor customers imminent. Scope = cross-tenant isolation, auth/session, money/claims integrity, business-logic and permission correctness.
**Branch reviewed:** `perf/audit-2026-06-10` (findings verified against current `backend/src`).

---

## Executive summary (plain English)

The codebase is **fundamentally sound for launch**. There are **no cross-tenant data leaks, no authentication bypasses, no privilege-escalation paths, and no way for the wrong actor to touch another customer's data or money** in a normally-configured production deployment. Tenant scoping (companyId / projectId), `requireAuth`, and role gates are applied consistently, and the worst classes of error leakage (stack traces, raw SQL, Prisma internals) are correctly suppressed in production.

What the audit *did* find is a small number of **integrity and revenue-correctness gaps** that are worth fixing before you start charging, plus a longer list of defense-in-depth hardening items. The single most important one is a **money-integrity race**: two near-simultaneous progress claims on the same lot can push that lot past 100% of its budget, silently corrupting the cumulative-claim ledger. It requires a trusted commercial user double-submitting concurrently, so it is not an attacker scenario — but it corrupts the exact financial artifact this product exists to produce, so it should be fixed first.

The other "fix before charging" items are: a **per-seat billing limit that is advertised but never enforced** (basic-tier customers can invite unlimited users past their paid cap), a **Google-OAuth signature check that only runs when `NODE_ENV==='production'`** (safe in real prod, but one env-var away from total auth bypass in any staging/preview deploy that shares the prod database), an **NCR compliance control that one project manager can self-approve and self-close** (defeats the "independent QM review" selling point), and an **NCR concession closure that persists with no justification/risk text**.

**Bottom line: ship, but close the four "fix before charging" items first — especially the claims over-claim race and the OAuth `NODE_ENV` gate — since they touch money integrity and auth posture respectively. None of these block a careful launch; all are well-contained and have clear, low-risk fixes.**

**Overall readiness: nearly-ready.**

---

## Readiness verdict

| Bucket | Count | Meaning |
|---|---|---|
| **Launch blockers** | 0 | Nothing confirmed lets the wrong actor act, leaks cross-tenant data, or corrupts money/data via a reachable single request. |
| **Fix before charging** | 5 | Medium-severity integrity/billing/auth-posture gaps, plus the one high-severity concurrency money bug. Reachable by legitimate in-tenant users; fix before money/SLAs are on the line. |
| **Hardening backlog** | 8 | Low-severity / defense-in-depth / latent. None reachable as a present customer-harm exploit. |

**Total confirmed findings:** 13 (after dedup; 0 dropped as noise — every survivor was independently reproduced in code).

> Note on the one **high-severity** item (claims over-claim race): it is high because it corrupts the financial ledger, but it is **not** a launch *blocker* in the strict "wrong-actor / cross-tenant / single-request" sense — it needs a trusted commercial user racing themselves. It sits at the top of *Fix before charging*.

---

## FIX BEFORE CHARGING

### FBC-1 (HIGH) — Concurrent progress claims can over-claim a lot past 100% of budget

- **File:** `backend/src/routes/claims/workflowRoutes.ts:112-255` (cumulative check at 165-170); helper `backend/src/routes/claims/cumulativeClaims.ts:18-47`; schema `prisma/schema.prisma:1276`
- **Who can do what:** A commercial user (owner / admin / project_manager) who submits two claims for the **same conformed lot** concurrently can claim it past 100% of its budgeted value, inflating revenue figures and corrupting the cumulative-claim ledger.
- **Impact:** Silent money-integrity corruption. The lot deliberately stays `status='conformed'` / `claimedInId=null` until it hits 100%, so two concurrent requests both read `priorCumulative=0`, both pass the `<=100%` guard, and both commit `ClaimedLot` rows → lot is now (e.g.) 120% claimed. Every subsequent claim then computes from a `>100%` base. The DB safety net (the `updateMany` count check at lines 233-251) only fires when a lot is taken to exactly 100% in a single claim, so partial over-claims below 100% bypass it. `@@unique([claimId, lotId])` only blocks duplicate lots **within one claim**, not across two.
- **Evidence:** `workflowRoutes.ts:165` reads cumulative percentages with **no row lock**; the `$transaction` at line 114 passes no `isolationLevel`, so it runs at Postgres default **READ COMMITTED**. Contrast the payment path `postEvidenceWorkflowRoutes.ts:276-281`, which **does** `SELECT id FROM progress_claims ... FOR UPDATE` — proving the codebase knows the lock pattern and omits it here. The migration confirms `claimed_lots` has no CHECK/trigger enforcing `SUM(percentage_complete) <= 100` per lot.
- **Fix:** At the top of the create transaction, lock the candidate lot rows with a raw `SELECT id FROM lots WHERE id = ANY($1) FOR UPDATE` (mirroring the payment route), then re-read cumulative percentages **inside** the locked region. Alternatively (or additionally) add a DB constraint/trigger asserting `SUM(percentageComplete) per lot <= 100`. Add a concurrency regression test.

### FBC-2 (MEDIUM) — Per-seat tier limit (`TIER_USER_LIMITS`) is advertised but never enforced

- **File:** `backend/src/routes/company/memberRoutes.ts:141-325` (invite handler)
- **Who can do what:** Any company owner/admin can invite **unlimited** company members through the normal UI, exceeding the seat quota they pay for (basic=5, professional=25, enterprise=100).
- **Impact:** Billing-integrity / revenue leak. The company profile surfaces a `userLimit` (so the cap is a real, pricing-tied constraint and the UI shows "X of 5 users"), but the (X+1)th invite still succeeds. Customers bypass per-seat pricing. **In-tenant only — no cross-tenant or privilege issue** (created users are scoped to the caller's own `companyId`; a mismatch is rejected at line 201).
- **Evidence:** The invite handler goes straight from `requireCompanyAdmin` → `tx.user.update` / `tx.user.create` (lines 225-263) with **no** read of `company.subscriptionTier` and **no** `prisma.user.count` vs a cap. `TIER_USER_LIMITS` is referenced in exactly one place repo-wide — `company.ts:213`, purely to compute the display `userLimit` in `GET /api/company`. The parallel **project** quota **is** enforced (`projects/writeRoutes.ts:108-127`), making the asymmetry obvious. The project-team route (`teamRoutes.ts`) only links existing members and is documented/tested to **not** create a seat, so no other path compensates.
- **Fix:** In the invite handler, **before** creating/attaching a member and **only when a new seat is consumed** (i.e. `existingUser` is not already in this company), load `company.subscriptionTier`, resolve `const limit = TIER_USER_LIMITS[tier] || TIER_USER_LIMITS.basic`, count current members with `prisma.user.count({ where: { companyId } })`, and throw `AppError.forbidden('Your ${tier} subscription allows up to ${limit} users...')` when `userCount >= limit` (skip for `Infinity`/unlimited). Do the count **inside the existing `$transaction`** to avoid a two-concurrent-invite race. Add a regression test mirroring the project-limit test.

### FBC-3 (MEDIUM) — Google OAuth ID-token signature verified only when `NODE_ENV==='production'`

- **File:** `backend/src/routes/oauth.ts:258-265` (`getGoogleCredentialPayload`) + `backend/src/routes/oauth/helpers.ts:75-93` (`decodeJwtPayload`)
- **Who can do what:** In any deploy where `NODE_ENV` is **not exactly `'production'`** (staging / preview / misconfigured), anyone who can reach `POST /api/auth/google/token` can hand-craft an **unsigned** JWT `{sub, email, email_verified:true}` for any victim email and receive a valid app JWT for that account → full account takeover / arbitrary account creation.
- **Impact:** Latent total auth bypass. **Real production is safe** because `NODE_ENV=production` is set there (signature-validating Google `tokeninfo` path runs). The danger is that the control is **one env var away** from collapse, and the `aud`/`iss` forgery checks are *themselves* gated behind `NODE_ENV==='production'` (lines 227-240), so in non-prod only `exp` / `sub` / `email` / `email_verified` are checked — all attacker-controllable. A staging deploy pointed at the shared prod Railway DB would be fully exploitable.
- **Evidence:** `oauth.ts:259-262`: `payload = NODE_ENV==='production' ? verifyProductionGoogleCredential(credential) : decodeJwtPayload(credential)`. `helpers.ts:75-93`: `decodeJwtPayload` base64-decodes and `JSON.parse`s the JWT body with **zero** signature verification. The repo's own tests lock this in (`oauth.test.ts:707-740` sends a forged credential in test mode and asserts a real token is returned). Route is public by design (login endpoint, on the `routeAuthCoverage` allow-list, rate-limited).
- **Fix:** **Always** verify the Google ID token cryptographically (tokeninfo / JWKS) regardless of `NODE_ENV`. Reserve the unverified decode strictly for a unit-test double behind an explicit, **non-deployable** flag — the codebase already has the right pattern in `ALLOW_MOCK_OAUTH` (`isMockOAuthEnabled()` additionally refuses to run when `NODE_ENV==='production'`). Also **unconditionally** enforce `aud == GOOGLE_CLIENT_ID` and the `iss` allow-list.

### FBC-4 (MEDIUM) — Major-NCR QM approval is self-satisfiable by one project_manager/admin (no segregation of duties)

- **File:** `backend/src/routes/ncrs/ncrClosureWorkflow.ts:33-96` (qm-approve), `100-217` (close)
- **Who can do what:** A single project_manager (or admin) who is an active project member can call `POST /:id/qm-approve` on a major NCR and then immediately `POST /:id/close` it — fully bypassing the intended **independent** Quality-Manager review.
- **Impact:** Defeats the compliance control that distinguishes major NCRs (independent QM verification before closure). The audit trail then shows a "QM-approved" closure that **no Quality Manager ever reviewed** — directly undermining the auditability that is a core head-contractor selling point. In-tenant only; not an auth bypass or escalation.
- **Evidence:** The route's own header comment (line 32) reads *"QM approval for major NCRs (Quality Manager only)"*, but the role gate at lines 51-56 allows `['quality_manager','admin','project_manager']` — strong evidence the gap is unintended. The close gate at line 145 (`if (ncr.severity==='major' && ncr.qmApprovalRequired && !ncr.qmApprovedAt)`) checks only the **presence** of the `qmApprovedAt` timestamp — never the approver's role nor that `qmApprovedById !== closedById` (closer id set at line 160). Both ids are already persisted.
- **Fix:** Restrict `/qm-approve` to the `quality_manager` role (or `owner`) when `qmApprovalRequired`, **and** reject closure when `qmApprovedById === closedById` (the closing user). Both checks are one-liners against already-stored fields.

### FBC-5 (MEDIUM) — NCR concession closure persists with no justification or risk assessment

- **File:** `backend/src/routes/ncrs/ncrWorkflowValidation.ts:75-90` (schema); enforced at `backend/src/routes/ncrs/ncrClosureWorkflow.ts:151-164`
- **Who can do what:** A QM / PM / admin can `POST /api/ncrs/:id/close` with `{ withConcession: true }` and **no** `concessionJustification` or `concessionRiskAssessment`, moving the NCR to `closed_concession` with both compliance fields stored as `null`.
- **Impact:** Formally accepting non-conforming construction work "under concession" — a significant QA/contractual decision in AU civil — **without** the mandatory justification or risk record. Produces an incomplete compliance/audit artifact (the very thing this product defends in disputes/handover), with no later prompt to fill it. Data-integrity gap; not a security boundary issue (the decision itself is still audit-logged at line 207).
- **Evidence:** `closeNcrSchema` has `withConcession: z.boolean().optional()` and both concession fields as `optionalTrimmedWorkflowString(...)` with **no `.superRefine`** binding them. The handler writes `concessionJustification: withConcession ? concessionJustification : null` (and likewise for risk) then sets `closed_concession`.
- **Fix:** Add a `.superRefine` to `closeNcrSchema` requiring non-empty `concessionJustification` (and per policy `concessionRiskAssessment`) whenever `withConcession === true`, returning a 400 before the NCR is moved to `closed_concession`. The codebase already uses this exact pattern in `ncrCoreValidation.ts:103,122` and `ncrEvidence.ts:75`.

---

## HARDENING BACKLOG (low / defense-in-depth / latent)

These are real but bounded. None is reachable as a present cross-tenant, auth-bypass, escalation, or money-corruption exploit. Schedule after launch.

### HB-1 — Claims list returns raw certification/payment JSON blob verbatim
`backend/src/routes/claims/presentation.ts:192`. `mapClaimListItem` returns `claim.disputeNotes` raw; after certify/pay this column holds internal JSON `{certifiedBy, paymentHistory:[{...recordedBy}], lastPaymentNotes}` with internal user IDs. Audience is fully gated (owner/admin/PM on that project — `readRoutes.ts:110,262`) and the response already exposes a parsed `certification` view, so this is data-hygiene only, no new data class leaked. **Fix:** return only the parsed `certification` object; drop the raw `disputeNotes` from the list mapper. (Note: the GET-by-id path also spreads raw `disputeNotes` at `readRoutes.ts:356` — fix both.)

### HB-2 — PUT claim update can mark a claim paid without a row lock (duplicate payment emails)
`backend/src/routes/claims/workflowRoutes.ts:292-353, 478-539`. The generic `PUT .../claims/:claimId` accepts `status='paid'` via an unlocked `findFirst`→`update` (no transaction, no `FOR UPDATE`, no conditional `where:{status:'certified'}`). Two concurrent fires both send the full "Claim Payment Received" email set to every PM and re-stamp `paidAt`. **No money corruption** — `paidAmount` is a flat absolute assignment validated to equal the certified total, so duplicates write the same value. Harm = duplicate notifications/emails + ledger divergence from the dedicated locked `POST /payment`. **Fix:** route paid finalization through the locked transaction pattern, or guard with a conditional `updateMany({where:{id,status:'certified'}})` and only notify when `count===1`; consider deprecating the paid transition on the generic PUT.

### HB-3 — Dedicated certify endpoint has no lock/idempotency (duplicate cert doc + emails)
`backend/src/routes/claims/postEvidenceWorkflowRoutes.ts:76-253`. Two concurrent `POST .../certify` both pass the `submitted` check, both `prisma.document.create` a separate certificate row, both overwrite `certifiedAmount/certifiedAt` (same value → no amount error), both email all PMs. Actor restricted to commercial roles; no amount corruption. **Fix:** wrap read+update in `$transaction` with `SELECT ... FOR UPDATE` (as the payment endpoint does), and create the doc / send emails only when the status transition committed (`updateMany` count===1).

### HB-4 — Legacy SHA256 password verification is unsalted, fast, and uses `===` compare
`backend/src/lib/auth.ts:172-193`. For any stored hash that is 64 hex chars, `verifyPassword` computes `sha256(password + JWT_SECRET)` and compares with `===` (not `timingSafeEqual`). Single unsalted round keyed only by the global `JWT_SECRET`. `needsPasswordRehash()` exists but is **never called in any login path**, so legacy hashes never auto-upgrade. **No online exploit** — this only matters as offline-cracking risk *if* the users table AND `JWT_SECRET` both leak (at which point the attacker can forge JWTs directly anyway). **Fix:** use `crypto.timingSafeEqual`; opportunistically bcrypt-rehash on successful legacy verify; force-migrate and delete the SHA256 branch.

### HB-5 — API keys bypass session-invalidation (logout-all / password change don't revoke them)
`backend/src/routes/apiKeys.ts:296-377`. `authenticateApiKey` runs globally and sets `req.user` directly; `requireAuth` then short-circuits. Unlike `verifyToken`, it never consults `token_invalidated_at`, so "log out all devices", change-password, and reset-password (all of which set `tokenInvalidatedAt`) have **zero** effect on outstanding API keys. Presupposes the attacker already exfiltrated a key (shown once at creation). **Fix:** on password change/reset/logout-all, deactivate the user's API keys (or compare `apiKey.createdAt` to `token_invalidated_at`); surface keys in the post-reset UX.

### HB-6 — `generateRefreshToken` mints a refresh JWT under the same secret with no `type` consumer (latent token-confusion)
`backend/src/lib/auth.ts:156-158` + `51-135`. `generateRefreshToken` signs `{userId, type:'refresh'}` (7d) with the same secret as 24h access tokens, and `verifyToken` never inspects `type`. **Currently dead code** — no route issues or consumes a refresh token (`reachable=false`). **Fix:** delete the unused function, OR before wiring any refresh flow: reject `type==='refresh'` in `verifyToken`, sign refresh tokens with a separate secret/audience, and add a regression test.

### HB-7 — Same-day diary aggregate counts exposed to subcontractor on docket detail
`backend/src/routes/dockets.ts:226-282`. A linked subcontractor viewing their own docket receives the project-wide same-day diary **aggregate counts** (total personnel/plant/activities, weather, hours-lost, status) via `foremanDiary`/discrepancies — crossing the "subbie must not see other subbies' data" rule. **Only coarse integers + weather leak** — no names, companies, rates, or activity detail (the underlying arrays are fetched but only `.length` is surfaced). **Fix:** null `foremanDiary`/`discrepancies` when `isSubcontractorUser(req.user)`, or scope counts to the requesting subbie's own contribution.

### HB-8 — Permission-mismatch & info-hygiene cluster (frontend gates wider than backend; 4xx message passthrough; link-possession flows)

A set of low-severity, consistent-direction inconsistencies. None grants access the actor lacks; the backend is always the stricter authority.

- **Project Users / Areas list reads** open to any active project member while the UI gates the pages to admins — `backend/src/routes/projects/teamRoutes.ts:56-84`, `areaRoutes.ts:42-61`. Read-only, **same-tenant** (subcontractors excluded), exposes teammate names/emails/roles + area list. All mutations correctly require `isProjectAdmin`. **Fix:** tighten the GETs to `isProjectAdmin`, or document the read as intentional.
- **Docket Approvals page** shown to `quality_manager`/`site_engineer` but backend rejects their approve/reject/query with 403 — `frontend/src/App.tsx:279-286` vs `backend/src/routes/dockets/access.ts:20`. SAFE direction; UX-only (buttons 403 on click). **Fix:** disable the action controls for non-`DOCKET_APPROVERS` roles.
- **`useCommercialAccess` / `RoleProtectedRoute` decide on `user.role`** (the RoleSwitcher dev-override surface) instead of `actualRole` — `frontend/src/hooks/useCommercialAccess.ts:9-14`, `RoleProtectedRoute.tsx:41`. Inert in production (override compiled out; DEV-only + admin/owner-only), backend enforces server-side anyway. **Fix:** derive from `actualRole`, or pin the two preconditions with a test/comment.
- **ITP completion self-verification** — `backend/src/routes/itp/completionVerificationRoutes.ts:57-172` doesn't compare verifier to `completedById`, so an in-house HC user with a verify role can verify their own completion (subcontractors are excluded from verify roles, so the boundary that matters holds). Soft four-eyes weakness. **Fix:** reject verify/reject when caller is `completedById`, or document as intentional.
- **Public `GET /invitation/:id`** returns the invited subcontractor's full email + name to any holder of the (non-enumerable) invitation UUID — `backend/src/routes/subcontractors/invitationRoutes.ts:80-119`. Inconsistent with the authed accept path which **masks** the same email (`invitationRoutes.ts:429-431`). PII usable for targeted phishing; gated behind link possession. **Fix:** mask via the existing `maskInvitedEmail()` on the public path, or omit the email.
- **Invitation accept treats link possession as sufficient** — `backend/src/routes/subcontractors/invitationRoutes.ts:413-495`. A standalone (non-HC, no `companyId`) user holding the link can accept an invite addressed to a different email (via `acknowledgeEmailMismatch:true`) and become admin of that subcontractor company. **Deliberate, documented design**; strictly single-use (N-1 enforced atomically); HC-tenant accounts blocked; non-enumerable token. One-shot race-to-claim, not a harvest. **Fix (optional hardening):** out-of-band confirmation code on mismatch, domain-match, or notify the HC on a non-matching accept.
- **4xx legacy error-message passthrough** — `backend/src/middleware/errorHandler.ts:296-345`. Stack traces, 500-level messages, and Prisma internals are correctly suppressed in production; the residual gap is that a third-party library throwing an `Error` with `statusCode<500` has its raw `.message` echoed, and ZodError issue text is returned on 400s. No secrets/SQL/PII path demonstrated. **Fix:** for non-`AppError` errors, return curated per-status generic messages instead of echoing arbitrary library `.message`.

---

## What is solid (stated plainly)

- **Tenant isolation holds.** Every confirmed finding that touches another party's data is either same-tenant by construction (`companyId`/`projectId` scoping via `getProjectAccessContext`, `requireActiveProjectUser`, `requireCommercialProjectAccess`) or gated behind link possession. **No cross-tenant read/write was found.**
- **No auth bypass in real production.** `requireAuth` is applied router-wide; the public allow-list is guarded by `routeAuthCoverage.test.ts`. The OAuth gap (FBC-3) is the only auth-posture concern and it is inert with `NODE_ENV=production` set.
- **No privilege escalation.** The RoleSwitcher override cannot grant more than an admin already has and is compiled out of production; subcontractors are correctly excluded from every sensitive role set (ITP verify, docket approver, NCR management, company membership).
- **Money mutations are mostly guarded.** The dedicated payment endpoint already uses `SELECT ... FOR UPDATE`. The gaps (FBC-1, HB-2, HB-3) are missing-lock concurrency issues on *sibling* paths, with a clear in-repo pattern to copy.
- **Error handling is production-hardened.** Stack traces, raw SQL, Prisma internals, and 500-level messages are suppressed in prod.

---

## Recommended sequencing

1. **FBC-1** (over-claim race) — money integrity, fix first.
2. **FBC-3** (OAuth `NODE_ENV` gate) — cheap, removes a latent auth footgun; verify `NODE_ENV=production` is set on every deploy that can reach the prod DB.
3. **FBC-2** (seat-limit enforcement) — revenue correctness before billing goes live.
4. **FBC-4 / FBC-5** (NCR compliance gaps) — protect the auditability selling point.
5. Hardening backlog — schedule post-launch; HB-2/HB-3 (claims duplicate emails) and HB-5 (API-key revocation) are the most user-visible.

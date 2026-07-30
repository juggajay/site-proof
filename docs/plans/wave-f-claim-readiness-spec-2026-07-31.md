# Wave F Execution Specification — Claim-Readiness Exposure + Accounting Integrations

**Date:** 31 July 2026 · **Rev 1** · **Status:** draft, pending adversarial review. No build starts on any increment before this document is accepted and the increment's own gate (§5) is met.

**Specified against:** `18bd3cfc8a42a5da725aa47e8a208aa0d9c2c959` (`origin/master`, 31 Jul 2026 — "feat(handover): branded self-contained README.html replaces README.txt (#1699)"). **Every code citation below is `file:line` at that SHA. Re-verify line numbers at build time and stamp the fresh SHA in the PR body** (the standing rule from `docs/plans/f0-execution-spec-2026-07-24.md:136`).

**Program of record:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` (Rev 1.2a). Wave F is §3's "Claim-readiness exposure + integrations (M)". This document is the §9 execution specification that must exist before Wave F build starts; the §9 thirteen-item list is the section structure below.

**Evidence register:** `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md`. Grades A–D are used verbatim. **No grade-D claim carries a load-bearing decision alone in this spec**, and where a D-grade row is the only support for a direction, the decision is written as a *direction*, not a *requirement* (§2.1).

---

## 0. How to read this

### 0.1 Three-state honesty on every factual claim

Following the Wave 0 convention (program §3) and the Wave E.0 threat-model format (`docs/plans/wave-e0-threat-model-2026-07-28.md`):

- **Verified** — cited to code at `18bd3cfc`, or to a primary source with a URL.
- **[VERIFY BEFORE BUILD]** — believed true, not confirmed at this SHA / not confirmed against the vendor's current documentation. **Never asserted in a PR body, a UI string, or to a customer until re-checked.** Every such tag names who checks it and when.
- **[UNKNOWN]** — could not be established from code or docs. Listed in §6, never asserted anywhere.

### 0.2 The single most important thing this spec found

**Wave F's Xero limb is substantially already shipped, and the program document does not know it.** A Xero-importable sales-invoice CSV export exists today at `backend/src/routes/claims/xeroExport.ts` (304 lines, tested), wired to a per-claim "Export to Xero" button at `frontend/src/pages/claims/components/ClaimsTable.tsx:397-402`. The program's Wave F line — *"Xero first (CSV exists; API sync when a pilot demands)"* (Rev 1.2a §3) — is accurate, and its own condition (**"when a pilot demands"**) has not been met.

Likewise, **per-lot claim-readiness with reasons is already exposed** — inside `CreateClaimModal` (`frontend/src/pages/claims/components/CreateClaimModal.tsx:403-511`) and on lot detail (`frontend/src/pages/lots/components/LotReadinessPanel.tsx:336-351`).

This spec is therefore **not** "build claim-readiness and build Xero". It is: build the one claim-readiness surface that genuinely does not exist (§1.2), close the one real defect in the shipped CSV path (§2.2), and hold the live API integration behind an explicit demand gate with its design locked so it can be built fast when the gate opens (§2.3).

### 0.3 Standing boundaries this wave must not cross

Reproduced here so the document is self-contained (program §6 self-containment rule):

1. **CIVOS is a data compiler, not a financial tool. Xero owns money.** CIVOS never computes GST, retention, revenue, cash flow, or amounts owed. `docs/research/xero-integration-research-and-spec-2026-07-02.md:9-26`.
2. **Budget / claimed / certified / paid are all imported or user-recorded statuses. None replaces Xero's financial truth.** (Program §3, Rev 1.2a clarification.)
3. **No CIVOS-computed dollar total appears on an evidence document.** Screen indicators are permitted with the §1.4 label; folios, evidence packages and exported PDFs are not. Backed by the grade-**A** Treasury source (appendix §F: *"never imply evidence = payable amount"*).
4. **HCs pay, subbies free.** Nothing in Wave F is exposed to `subcontractor` / `subcontractor_admin` — already hard-denied at `backend/src/routes/claims.ts:15`.
5. **Readiness is computed, never a stored `ready=true` flag.** F0's governing principle (`docs/plans/f0-execution-spec-2026-07-24.md:6`). Wave F adds **zero new readiness computations** — every surface below is a view over the shipped predicate library.

---

## 1. Scope — what "claim-readiness exposure" means concretely

### 1.1 What already ships (do not re-build, do not re-spec)

| Capability | Where | Status |
|---|---|---|
| Per-lot claim readiness computation | `backend/src/lib/evidenceReadiness.ts:443-450` (`readiness.claim` = `{state, blockers, warnings, support, budgetAmount?, claimedInId, claimedPercentage, remainingPercentage}`) | Shipped |
| Claim-eligibility predicate | `backend/src/lib/readiness/predicates.ts:509` `lotClaimEligible` | Shipped (F0.1, #1546) |
| Paginated claim-readiness endpoint | `GET /api/projects/:projectId/claim-readiness` — `backend/src/routes/claims/readRoutes.ts:326`; cursor encode/decode `:87`/`:93`; page cap 500 `:75` | Shipped (F0.2a, #1556) |
| Frontend pagination adoption | `CreateClaimModal.tsx:128-143` (`useInfiniteQuery`, page size 100 at `:61`, "Load more" `:514-525`) | Shipped (F0.2a) |
| Per-lot "why not claimable", inline | `CreateClaimModal.tsx:404-410` (bucketing) and `:442-459` (render, capped at 3 items) | Shipped |
| Claim bucket on lot detail | `LotReadinessPanel.tsx:336-351`; claim state labels `:110-119`; deep-link actions `:179-206` | Shipped |
| Post-hoc completeness check on an existing claim | `CompletenessCheckModal.tsx:56-78` | Shipped |
| Claim decision snapshots (aggregate + per-member) | `backend/src/routes/claims/inclusionDecision.ts:346-368`, via `recordDecision` at `workflowRoutes.ts:253` | Shipped (F0.4b PR5) |
| Xero sales-invoice CSV export | `backend/src/routes/claims/xeroExport.ts` — header `:23-33`, mapping `:129`, total-matches-lines invariant `:184-194`, route `:232` | Shipped (v0, 2026-07-02) |

### 1.2 The one gap — project-level blocked-value exposure (**F1**)

**Verified absent.** There is no project-wide view answering *"how much of this project's lot budget cannot be claimed right now, and what is blocking it?"* The data exists but is reachable only by opening the create-claim modal, which is a commercial-role modal on one page. The nearest widget, `frontend/src/components/dashboard/ProjectCloseoutReadiness.tsx:108-181`, explicitly disclaims commercial scope at `:176-179`: *"Quality only — conformance, ITPs, tests, hold points and NCRs. It does not assess commercial or record completeness."*

This is precisely the program's Wave F sentence: *"lot-budget value blocked from claim selection, by blocking condition, drill-down to source lots"*.

**F1 delivers exactly that and nothing else:**

- One new read endpoint returning, for a project: total lot budget in scope, value claimable now, value blocked, **grouped by blocking condition** using the existing reason-code vocabulary — `CLAIM_MEMBER_REASON_CODES` at `backend/src/lib/readiness/requirements/claimMember.v1.ts:33-51` (17 codes, already stable and machine-readable).
- One panel on `ClaimsPage` rendering those groups, each expandable to the source lots (lot number + activity + blocked value + the readiness item's existing `title`/`detail`/`actionLabel`/`actionHref` — types at `frontend/src/types/evidenceReadiness.ts:18-35`).
- Drill-down rows deep-link to the lot, reusing the action plumbing `LotReadinessPanel.tsx:179-206` already renders.

**No new readiness computation.** The endpoint calls the same `computeClaimReadinessItems` (`readRoutes.ts:212`) the paginated endpoint calls, and aggregates. Reason-code grouping mirrors `groupBlockedLotsByReason` (`ProjectCloseoutReadiness.tsx:93`) — reuse it if the shape fits, otherwise state why in the PR.

### 1.3 Explicitly excluded from F1 (with owning wave / trigger)

| Excluded | Why | Unparks when |
|---|---|---|
| Claim-ready **column or filter on the lots register** | The register filters client-side over an already-fetched payload with no readiness field (`frontend/src/pages/lots/hooks/useLotsData.ts:236-266`; `Lot` type `lotsPageTypes.ts:1-25`). Adding readiness to the list payload is a new N-lot computation on the hottest register in the product, to answer a question §1.2's panel already answers. | A pilot user asks for it *after* using the F1 panel. **Jay decision D5.** |
| A **new "My Work" / ball-in-court** treatment of claim blockers | Owned by A4 over the F0.3 `ActionAssignment` contract (`backend/src/lib/readiness/contracts/actionAssignment.ts`). Wave F must not fork it. | A4. |
| Per-lot **certified / paid** values | Do not exist in the schema: certification and payment are claim-grain only (`ProgressClaim.certifiedAmount` `backend/prisma/schema.prisma:1533`, `paidAmount` `:1535`). Adding lot-grain money is accounting modelling — boundary §0.3. | Never, as specified. |
| Blocker detail on claim **member snapshots** | By construction every committed member is `ready:true, blockingReasonCodes:[]` — the evaluator rejects the whole claim if any member is blocked (`inclusionDecision.ts:297-310`). Populating blockers would need new plumbing for no consumer. | A consumer appears. |
| Retention, GST, SOPA validity, revenue, cash flow | Boundary §0.3. | Never. |

### 1.4 The label rule (non-negotiable, testable)

Every surface that renders a CIVOS-derived dollar figure introduced by F1 carries, in the same visual block, the string:

> **Project-management indicator — not an accounting balance or entitlement.**

**AT-F1-LABEL:** a frontend test asserts the label is present in the panel's rendered output and that removing it fails the suite. **AT-F1-NOFOLIO:** a test asserts the F1 aggregate does not appear in any folio / evidence-package / PDF generator output (grep-level assertion over the folio builders is acceptable; state the mechanism in the PR).

---

## 2. Xero — the boundary, the thin slice, and the mechanics

### 2.1 What the research actually supports (and what it does not)

The appendix's Xero row (§F) is **grade D**: *"Xero >60% AU share; Assignar's Xero integration its most-used (800+)"*, sourced to a consultancy page and a vendor integrations page, with the caveat *"direction is safe (Xero-first), the exact share figure is not; do not quote the 60% externally."*

**What that licenses:** Xero before MYOB. Nothing more.

**What it does not license:** any claim that an API integration (as opposed to the shipped CSV) is required, or that Tier-2 civil contractors are blocked without one. **No evidence in the appendix, in the six research streams, or in the repo establishes demand for live Xero API push.** The 2026-07-02 design doc reached the same conclusion from the same position (`docs/plans/2026-07-02-xero-export-v0-design.md:13-17`: *"no specific head contractor is blocked on it today"*), and nothing has changed since.

The competitor evidence (`docs/research/xero-integration-research-and-spec-2026-07-02.md:33-44`, grade B/C) establishes that Buildxact, Payapps, Simpro and Sitemate all ship push and most ship payment sync-back — i.e. **API integration is table stakes for a commercial tool**. CIVOS is not a commercial tool (§0.3). The same research names the counter-example explicitly at `:44`: Assignar *"promised accounting integration, under-delivered; public reviews cite it 'never successfully integrated'"* — and at `:79-81` draws the rule: *"a half-working integration is worse than none."*

**Therefore the recommended posture is a demand gate, not a build order.** See D1.

### 2.2 F2 — close the real defect in the shipped CSV path (small, unconditional)

The shipped export reads its account code and tax type from **`localStorage`** (`frontend/src/pages/claims/ClaimsPage.tsx:527`; the deliberate `// ponytail:` shortcut at `docs/plans/2026-07-02-xero-export-v0-design.md:163-165`). That was correct for v0 and is a live defect now:

**Two people at the same company exporting the same claim from different browsers silently produce CSVs with different account codes.** Neither sees a warning. The failure surfaces in the customer's ledger, not in CIVOS.

**F2 promotes exactly two values to a per-company setting** — income account code, GST tax type — and makes the export read them server-side. It is the config half of F3 built early, it fixes a real correctness bug today, and it is worth shipping whether or not F3 is ever built.

Deliberately **not** in F2: `XeroConnection`, OAuth, tokens, contacts, tracking categories. F2 needs one small table (or two columns on `Company` — decide at build time and justify in the PR; the reviewed-migration rule of `CLAUDE.md` applies either way).

### 2.3 F3 — the live thin slice (design locked, build gated)

**If and only if D1 opens the gate.** The minimum slice that is worth more than the CSV:

> **Push one claim as one DRAFT `ACCREC` invoice into the connected Xero org, with the evidence-pack PDF attached.**

**Why that, and not something smaller.** Xero's CSV import already lands invoices as Draft (`docs/plans/2026-07-02-xero-export-v0-design.md:132-134`) — so the API buys *no* extra safety gate. It buys exactly three things CSV cannot do: (1) attach the evidence PDF, (2) remove the download/import shuffle, (3) enable payment sync-back later. **Only (1) is a moat limb** — CIVOS is the only party holding the ITP/test/hold-point proof, so it is the only party that can staple it to the invoice (`docs/research/xero-integration-research-and-spec-2026-07-02.md:56-59`). A push slice without the attachment is a worse CSV with an OAuth liability bolted on. **The attachment is in the first slice or the slice is not worth building** (see D4).

**Deliberately deferred out of F3:** payment sync-back, Xero webhooks, contact create (link-only in the first slice), tracking categories, variations as credit notes, accounts payable, retention. Payment sync-back is the reconciliation minefield (§2.6) and needs a durable poller; it is a separate increment behind its own gate (D3).

### 2.4 What crosses the boundary — and what never does

**Egress inventory. This is the largest single data egress in the product and must be stated to the customer before the first push.**

| Crosses to Xero | Source | Notes |
|---|---|---|
| Client contact name | `Project.clientName` | Free text. |
| Invoice reference `Claim #{n} — {Project.name}` | `ProgressClaim.claimNumber`, `Project.name` | Ties the invoice back to CIVOS. |
| One line per claimed lot: description, quantity `1`, unit amount | `ClaimedLot` (`schema.prisma:1557-1574`), description format `Lot {n} — {activityType} — this claim {x}% (cumulative {y}%)` | Ex-GST. Lot numbers, activity types and percentages leave the tenant. |
| Account code, tax type | F2 per-company config | |
| **Evidence-pack PDF** (D4) | `ProgressClaim.evidencePackageUrl` | **Contains site photographs, test certificates, and personnel names.** Highest-sensitivity item in the inventory. |

| **NEVER crosses** | Why |
|---|---|
| Readiness state, blockers, reason codes, `RequirementEvaluation` snapshots | Quality truth stays in CIVOS. Xero has no field for it and no need. |
| GST, retention, certified amount, paid amount, entitlement | CIVOS does not compute these (§0.3). GST is computed by Xero from `LineAmountTypes: Exclusive`. |
| NCR content, hold-point decisions, ITP records, user credentials, other projects' data | Out of scope of an invoice. |
| Any CIVOS auth token, session, or internal id beyond the reference string | |

**Rule:** the push payload is built by a **pure function** with the egress inventory above as its complete output surface, unit-tested against a frozen expected payload, so an accidental field addition fails a test rather than silently exporting customer data. This mirrors the shipped CSV's frozen-header discipline (`docs/plans/2026-07-02-xero-export-v0-design.md:144-146`).

### 2.5 OAuth, tokens, tenancy, revocation, failure modes

**Xero API facts.** Grades: **A** = Xero's own developer documentation, read directly. **[VERIFY BEFORE BUILD]** = returned by search against `developer.xero.com` but the source page could not be fetched in full during this spec pass (repeated 60s timeouts), or was confirmed only via secondary sources.

| Fact | Value | Grade / status |
|---|---|---|
| Access token lifetime | **30 minutes** | A — [developer.xero.com OAuth 2.0 FAQs](https://developer.xero.com/faq/oauth2) |
| Refresh token lifetime (unused) | **60 days**; then full re-authorisation | A — same source |
| Refresh token rotation | **Rotates on every refresh — the new one must be persisted or the connection dies** | A — same source |
| Failed-refresh grace | The existing refresh token may be retried for **up to 30 minutes** if no response was received | A — same source |
| Daily limit | **5,000 calls per tenant per 24h** | A — [Limits FAQs](https://developer.xero.com/faq/limits) |
| Concurrency limit | **5 in-flight calls** | A — same source |
| Limit headers | `X-DayLimit-Remaining`, `X-MinLimit-Remaining`, `X-AppMinLimit-Remaining` | A — same source |
| Limit breach response | **HTTP 429** | A — same source |
| Per-minute per-tenant limit | Commonly cited as 60/min | **[VERIFY BEFORE BUILD]** — the exact number was not confirmed from a fetched primary page. Build must read `X-MinLimit-Remaining` rather than hard-code any number. |
| `Retry-After` / `X-Rate-Limit-Problem` headers | Believed present on 429 | **[VERIFY BEFORE BUILD]** |
| Idempotency | `Idempotency-Key` header, UUID, **max 128 characters**, supported on POST/PUT including `POST /Invoices` | **[VERIFY BEFORE BUILD]** — 128-char limit and header name from [Xero idempotency docs](https://developer.xero.com/documentation/guides/idempotent-requests/idempotency/) via search snippet and secondary sources; the page itself did not fetch. **Key retention window is [UNKNOWN]** (§6). |
| Attachment limits on invoices | 10 attachments, 25 MB each *(confirmed for credit notes)* | **[VERIFY BEFORE BUILD]** — the 25 MB / 10-file figure was confirmed on the credit-notes page; the invoice-specific figure was not fetched. |
| `xero-node` SDK | **Not installed** — no `xero` dependency in `backend/package.json`, no `XERO_*` in `backend/.env.example` | Verified at `18bd3cfc` |

**Owner of the verification pass:** the F3 build agent, as build step 0, before writing the client — mirroring the shipped CSV's own step 0 (`docs/plans/2026-07-02-xero-export-v0-design.md:127-129`, which is why the header row is under test today).

**Mechanics — reuse, do not reinvent.** The repo already has an outbound OAuth2 client (Google, login-only): `backend/src/routes/oauth.ts:94` (authorize redirect), `:263-270` (token exchange), `:384` (issuer allowlist). Reuse:

- **State/CSRF:** `backend/src/routes/oauth/stateStore.ts:10` `createOAuthState()` — 32 random bytes, **sha256-hashed** at rest, `OAUTH_STATE_EXPIRY_MS = 10 * 60 * 1000` (`:6`), verify at `:24`, cleanup interval `:100`.
- **HTTP:** `backend/src/lib/fetchWithTimeout.ts:10`, default 15s (`:1`). **Never bare `fetch`.**
- **Production config assertion:** `backend/src/lib/runtimeConfig.ts:486-487` is the fail-fast pattern; `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` asserts belong there.
- **Company scoping:** `backend/src/routes/company/access.ts:6` `requireCompanyAdmin` — the connection is **per-company** (one head contractor, one Xero org, all their projects), matching `WebhookConfig.companyId` (`schema.prisma:187`) and the decision already recorded at `docs/research/xero-integration-research-and-spec-2026-07-02.md:236-238`.

**Token storage.** The refresh token is the crown jewel: it grants ongoing access to a customer's accounting system. The precedent is `WebhookConfig.secret` — a secret that must be *replayed*, therefore **encrypted** (AES-256-GCM, `backend/src/lib/encryption.ts:44`/`:80`), not hashed. Hashing is only for compare-only secrets (`HoldPointReleaseToken.token`, sha256, `schema.prisma:825`). Three constraints the build must honour, all verified at this SHA:

1. **`encrypt()` silently returns plaintext when no key is configured and plaintext storage is allowed** — `encryption.ts:49-54`, gated by `isPlaintextSecretStorageAllowed()` at `:12-18` (true for `NODE_ENV` development/test **or** `ALLOW_PLAINTEXT_SECRET_STORAGE === 'true'`). A misconfigured staging environment therefore stores a live customer's Xero refresh token in cleartext with no error. **F3 must assert `ENCRYPTION_KEY` is present at connect time and refuse to create a connection otherwise** — do not rely on the generic encrypt path.
2. **There is no key-rotation story.** The ciphertext format `iv:authTag:ciphertext` (`encryption.ts:10`) carries no key id, so rotating `ENCRYPTION_KEY` orphans every stored token. F3 must document the recovery path — **re-consent** (the customer reconnects) — and surface it as a `status: 'expired'` reconnect prompt rather than a silent failure. A versioned-key envelope is a separate, larger change and is **out of scope** here.
3. **Audit redaction is already sufficient — verified, not assumed.** `SENSITIVE_AUDIT_KEY_PATTERNS` at `backend/src/lib/auditLog.ts:18-40` includes `/token/i` and `/secret/i`, applied on write *and* on every historic read via `parseAuditLogChanges` (`:142`). `refresh_token`, `refreshToken`, `access_token` and `client_secret` all match. No change needed; a test should pin it.

**Revocation.** Three paths, all must be handled:
- *CIVOS-initiated:* a "Disconnect" action deletes the stored tokens and writes an audit row. **[VERIFY BEFORE BUILD]** whether Xero exposes a token-revocation endpoint to call as well; if it does, call it, and treat its failure as non-fatal to the local delete.
- *Xero-initiated:* the customer disconnects in Xero. Detected on the next call as an auth failure → flip `status='revoked'`, surface a reconnect prompt, **stop all further calls** (do not retry into a revoked connection).
- *Expiry:* 60 days unused → `status='expired'` → reconnect prompt.

**Failure modes and required behaviour:**

| Failure | Required behaviour |
|---|---|
| Xero unreachable / 5xx | Push fails **loudly**. Claim state unchanged. Error persisted and rendered on the claim. Never a silent success. |
| 429 rate-limited | Respect the limit headers; do not hot-retry. Surface "Xero rate limit reached, try again shortly". |
| Token expired mid-push | Refresh once, retry the push once. **Persist the rotated refresh token before retrying.** If refresh fails, use the documented 30-minute grace (retry with the existing token) before declaring the connection dead. |
| Refresh returns a new refresh token but the DB write fails | **The connection is now dead** — Xero has rotated, CIVOS has the old token. Write the new token **before** using the new access token, and treat a write failure as a hard error that flips `status='expired'` with an explicit reconnect prompt. This ordering is the single most dangerous line in the integration. |
| Network drop after Xero created the invoice | The `Idempotency-Key` (UUID derived deterministically from `claimId`) makes the retry return the original invoice instead of creating a duplicate. **[VERIFY BEFORE BUILD]** the key retention window; if it is shorter than a plausible retry gap, fall back to a Xero query-by-reference before creating. |
| Invoice created but PDF attach fails | Invoice remains, attach state recorded as failed, **retry attach is offered separately** — never re-push the invoice. |
| Total-matches-lines invariant fails | Block the push before any call. Reuse the shipped guard (`xeroExport.ts:184-194`). |
| Claim re-pushed after the Xero invoice left DRAFT | **Refuse** (§2.6). |

### 2.6 Reconciliation posture — when CIVOS and Xero disagree

**CIVOS is the source of truth for quality evidence. Xero is the source of truth for money. Neither overwrites the other.** Concretely:

1. **Push is create-only and idempotent.** CIVOS creates a DRAFT invoice. It never updates an existing one.
2. **Once the invoice leaves `DRAFT` in Xero, CIVOS is read-only against it, forever.** A re-push attempt against an `AUTHORISED`/`PAID`/`VOIDED` invoice is **refused with an explicit reason naming the Xero status** — never a silent update, never a duplicate.
3. **CIVOS never reads a Xero amount back into `totalClaimedAmount`.** If a human edits the invoice in Xero so its total diverges from the claim, CIVOS **surfaces the divergence and stops**. It does not reconcile, does not pick a winner, does not adjust either side. The surfaced text names both numbers and both systems.
4. **Payment sync-back (deferred, D3), if ever built, writes only `paidAmount` and the resulting status, and only through the existing payment path** (`backend/src/routes/claims/postEvidenceWorkflowRoutes.ts:291`) so the audit log and status transitions fire identically to a manual entry. It never writes claim totals and never performs money arithmetic beyond applying a delta. Note the hazard at `docs/research/xero-integration-research-and-spec-2026-07-02.md:311-324`: `ProgressClaim.disputeNotes` (`schema.prisma:1541`) is already an overloaded JSON column with three writers — **a Xero payment must not become the fourth independent writer.**
5. **Xero state on the claim lives in dedicated columns**, never in `disputeNotes`.

**The user-facing sentence for the divergence case**, to be used verbatim so it is testable: *"This claim's total in CIVOS (\$A) no longer matches the Xero invoice (\$B). CIVOS has not changed either. Resolve in Xero, or raise a new claim."*

### 2.7 MYOB and Power BI — explicitly deferred, with triggers

Both are named in the program's Wave F line and are **not** in this spec.

- **MYOB.** Trigger to unpark: **a design partner or pilot whose accounting system is MYOB, named, in writing.** Until then the only support is the appendix's grade-D Xero-share row, which orders Xero first and says nothing about MYOB demand. Building a second accounting integration before the first has one paying user is the Assignar failure mode (§2.1).
- **Power BI starter dataset + API docs.** Trigger: **a Tier-2 buyer asking for reporting egress during a procurement conversation**, or the F1 panel proving insufficient for a real management reporting need. Note the competitive context (appendix §B, grade B): CivilPro ships a Power BI connector — so this is table stakes to *match*, not a wedge, and matching table stakes with zero users is the over-build the program warns against.
- **SharePoint, SSO/SAML.** Program §3 already defers these to "when procurement demands". Unchanged.

**Neither is scoped, estimated, or designed here.** When a trigger fires, that integration gets its own §9 execution spec.

---

## 3. Security engineering

### 3.1 The gate

**Program §7 requires a threat model as a gated artifact before integration waves.** Wave F's F3 is an external-integration increment and therefore **must not start before a Wave F threat model exists and is reviewed**, in the format of `docs/plans/wave-e0-threat-model-2026-07-28.md` (numbered items, each ending in a binding `### Disposition`).

**F1 and F2 do not require a separate threat model** — F1 adds no new trust boundary (it is a read view over existing project-scoped data behind the existing commercial gate) and F2 moves two non-secret configuration values from `localStorage` into a company-scoped row. Both still carry the standing requirements below. **This scoping is itself a claim the reviewer should test**; if F1's aggregate is judged to widen a trust boundary, the threat model gates F1 too.

### 3.2 Rows this wave adds to the threat model (F3)

| # | Threat | Surface | Required control |
|---|---|---|---|
| 1 | **Refresh-token theft = ongoing access to a customer's accounting system** | `XeroConnection` row, DB backups, logs, Sentry | AES-256-GCM at rest (`encryption.ts:44`); **explicit `ENCRYPTION_KEY` presence assert at connect** (§2.5 constraint 1); never returned by any API; never logged (`/token/i` redaction verified, `auditLog.ts:20`); excluded from Sentry breadcrumbs. |
| 2 | **Plaintext token storage via misconfiguration** | `ALLOW_PLAINTEXT_SECRET_STORAGE` / `NODE_ENV` (`encryption.ts:12-18`) | Connect route refuses to create a connection when `getEncryptionKey()` would return null. Production assert in `runtimeConfig.ts`. |
| 3 | **Key rotation orphans all tokens** | `ENCRYPTION_KEY` (no key id in ciphertext, `encryption.ts:10`) | Documented re-consent recovery; `status='expired'` + reconnect prompt on decrypt failure, never a crash or a silent skip. |
| 4 | **OAuth CSRF / authorization-code injection** | connect + callback routes | Reuse `stateStore.ts:10` (sha256 state, 10-min TTL). PKCE. **Exact-match redirect-URI allowlist** — no wildcards, no user-supplied redirect. |
| 5 | **Confused deputy: any commercial-role user pushes into the company's Xero org** | push action | **Connect/disconnect = company-admin only** (`company/access.ts:6`). **Push = the existing commercial project gate** (`claims.ts:14`). This is a deliberate widening and must be stated to the customer at connect time: *"anyone who can create a claim on any of your projects can push a draft invoice into this Xero organisation."* If that is unacceptable, a per-project allowlist is a follow-on — **D7**. |
| 6 | **Data egress beyond the customer's expectation** | push payload, especially the evidence PDF | The frozen-payload test (§2.4). Explicit connect-time disclosure of the egress inventory. **Per-company opt-in for the PDF attachment**, separate from the connection itself (D4). |
| 7 | **Evidence PDF leaks personal data into a third-party system** | attachment | The PDF contains photographs and personnel names. Treat as a subprocessor-grade disclosure: **Xero is added to the subprocessor register (Wave 0, program §3)** before the first production push. Retention in Xero is the customer's, not CIVOS's — say so. |
| 8 | **Server-side request forgery via the token/API endpoints** | outbound calls | Host is fixed and compiled in — **never** built from user input. Unlike webhooks (`backend/src/routes/webhooks/destinationSafety.ts:66-113`), there is no user-supplied destination; the control is "there is no configurable host", and a test should assert the host constant. |
| 9 | **Tenant crossing: company A's claim pushed into company B's Xero org** | connection lookup | The connection is looked up **from the claim's project's company**, never from a request parameter. Tenant-isolation test on every new query surface (program §7 standing requirement). |
| 10 | **Idempotency key collision → wrong invoice returned** | `Idempotency-Key` | Key derived deterministically from `claimId` (a UUID), never from a counter, never reused across companies. |
| 11 | **Push replay / duplicate invoicing** | push route | Store `xeroInvoiceId` on the claim; a second push links rather than creates. The existing claim-create replay machinery is *not* reused — note `workflowRoutes.ts:236-242`, which deliberately keeps claim-create's own `(projectId, requestKey)` idempotency and explains why migrating it would reopen the F-03 double-billing hole. **Do not touch that path.** |
| 12 | **Rate-limit exhaustion as denial of service against the customer's Xero org** | push | 5,000/day/tenant is shared with every other app the customer has connected. A push is a small fixed number of calls (ensure-contact, create-invoice, attach). No polling in F3 (that is D3's problem). Respect `X-DayLimit-Remaining`. |

### 3.3 Standing requirements (program §7) that apply unchanged

Malware scanning and file-type validation on any new upload surface — **F3 adds none** (the PDF is CIVOS-generated). Permission tests for every new export and external workflow. Audit-log tamper resistance and retention. Tenant-isolation tests on every new query surface. New audit actions go in `AuditAction` (`auditLog.ts:157-274`) alongside the existing `WEBHOOK_*` / `API_KEY_*` vocabulary, and connect/disconnect/push use `writeAuditLogInTransaction` (`auditLog.ts:127`, hard-fail) rather than best-effort `createAuditLog` — the helper's own doc comment (`:114-126`) puts privileged company/security actions in that class.

---

## 4. Scale, performance budgets, and monitoring

### 4.1 Settled — do not reopen

**Claim decision path budgets are settled by F0 and this wave does not touch them:** single-entity decision overhead p95 < 50ms; **claim decisions p95 < 2s at the 5,000-member ceiling** (`docs/plans/f0-execution-spec-2026-07-24.md:80`, `:115`). Wave F adds no work to the decision transaction.

### 4.2 New budgets (program §8 format — percentile, device, network, dataset)

Measured against the **defined production-like reference dataset** (5,000 lots, 10,000 map features, 50GB evidence, 10k-row registers), on a **mid-tier Android device over 4G** for client-side figures, server-side timings measured server-side.

| Surface | Budget | Notes |
|---|---|---|
| **F1** blocked-value aggregate endpoint, 5,000-lot project | **p95 < 3s server-side** | This is the genuine performance risk of the wave (§4.3). Derived from F0's measured 5,000-member claim-decision budget of 2s, plus aggregation headroom. |
| **F1** panel first meaningful paint | **p95 < 4s** on mid-tier Android / 4G | Must render a loading state immediately and never block the rest of `ClaimsPage`. |
| **F1** drill-down expand (already-fetched data) | **p95 < 300ms** | Client-side only; no refetch on expand. |
| **F2** CSV export, 500-lot claim | **p95 < 2s** — unchanged from today | F2 changes config source, not the mapping. Regression check only. |
| **F3** claim push end-to-end (create + attach) | **p95 < 10s**, with a progress state and a hard 30s ceiling | Dominated by Xero, not CIVOS. `fetchWithTimeout` default is 15s (`fetchWithTimeout.ts:1`) — raise per-call deliberately for the attachment upload and state the value. |
| **F3** PDF attachment upload | Must handle the **p95 evidence-pack size** on the reference dataset without timeout | The size distribution is **[UNKNOWN]** (§6) — measure before setting the timeout. |

### 4.3 The F1 performance risk, stated plainly

The shipped endpoint computes readiness **per page of 100** (`readRoutes.ts:212`, one `getCumulativeClaimedPercentByLot` + one `checkConformancePrerequisitesBatch` per page). The F1 aggregate needs **every** lot in the project — at the 5,000-lot reference size that is 50 pages' worth of computation in one request.

**Constraint:** F0's governing principle forbids a stored `ready` flag (`f0-execution-spec-2026-07-24.md:6`) — so caching the aggregate is not the default answer.

**Required approach, in order:**
1. Build it computed, streamed in batches (the streaming fetcher already exists — `backend/src/lib/readiness/sufficiency/prismaStream.ts`), and **measure at 5,000 lots**.
2. If p95 exceeds 3s, the escape hatch is the one F0 already named: a materialized cache **decided visibly**, in a PR that states the measurement that forced it — not a quiet addition. F0 scoped exactly this: *"stored/materialized readiness cache (only if F0.5 measurement fails, decided visibly)"* (`f0-execution-spec-2026-07-24.md:23`).
3. A per-request lot ceiling with an honest "showing the first N" is **not acceptable** for a figure labelled as a project total — a partial total is a wrong total. Either it covers the project or it does not ship.

**Exit-gate evidence for F1 includes the measured p95 at 5,000 lots.** No verdict without the number.

### 4.4 Production monitoring

- **F1:** aggregate endpoint p95 and error rate; count of projects exceeding the 3s budget.
- **F2:** export count by account code — a sudden new code is a misconfiguration signal.
- **F3:** push success/failure counts by failure class (auth, rate-limit, invariant, network, attach); **refresh-token rotation failures (any non-zero value is an incident)**; connections by status (`connected`/`expired`/`revoked`); days-since-last-refresh per connection with an alert before the 60-day cliff; `X-DayLimit-Remaining` low-water mark per tenant.

---

## 5. Phasing, gates, and delivery control

Each increment is **independently shippable and independently revertible**. Nothing dependent starts before its predecessor's exit gate passes (program §9).

### F1 — Blocked-value exposure (S–M) · no Xero · **starts on acceptance of this spec**

- **Included:** the aggregate endpoint (§1.2), the `ClaimsPage` panel with reason-code grouping and lot drill-down, the §1.4 label.
- **Excluded:** everything in §1.3.
- **Migration:** none. Read-only over existing data.
- **Permissions:** existing commercial gate only — `requireCommercialProjectAccess` (`claims.ts:37-54`). **Do not widen.** Note the trap: `readRoutes.ts:250` hardcodes `canViewCommercial: true` on the claim-readiness path; the aggregate must set it from the effective role, not inherit the hardcode, so the surface stays correct if the role set ever changes.
- **Feature flag:** none needed (additive read surface, no behaviour change to existing paths). If the reviewer disagrees, an env flag following the `readinessSnapshotsEnabled()` shape (`recordDecision.ts:234-237`, read at call time, default false) is the pattern.
- **Rollback:** plain git revert.
- **Exit gate:** all ATs green (§5.5); **measured p95 at 5,000 lots on the reference dataset, stated as a number in the PR**; label tests present; zero new readiness computations (reviewer-checkable: the diff adds no new predicate).

### F2 — Per-company Xero export config (S) · **parallel with F1, no dependency**

- **Included:** income account code + GST tax type as company-scoped settings; a card in `CompanySettingsPage` at the integrations group (`frontend/src/pages/company/CompanySettingsPage.tsx:385-388`, mirroring `CompanyWebhooksSection`); the export route reads them server-side; `localStorage` reads removed from `ClaimsPage.tsx:527`.
- **Migration:** one small reviewed additive migration. Prod apply via the production-migrations workflow (`CLAUDE.md` ops rules — no `db push`, no `--accept-data-loss`).
- **Backfill:** existing users have no stored value. Default to the current default `'200'` (`xeroExport.ts:239-244`) and `'GST on Income'` (`:71`) so behaviour is unchanged for anyone who never edited the localStorage value; anyone who did is **told once, in the UI, that the setting moved** — not silently reset.
- **Permissions:** read/write = company admin (`company/access.ts:6`); the export route continues to use the commercial project gate.
- **Rollback:** revert the code; the table/columns remain harmlessly (additive migrations are not reverted).
- **Exit gate:** export produces byte-identical CSV to today for a company on the defaults (characterization test against the existing frozen header/body test in `xeroExport.test.ts`); two users in different browsers now produce identical output — pinned by test.

### F3 — Live Xero connection + draft push + evidence attach (L) · **GATED**

**Three gates, all of which must be open before build starts:**
1. **D1** — Jay opens the demand gate (a named pilot wants API push).
2. **D2** — Xero developer app registered, credentials in the backend env, a Xero demo org available for testing. **Jay action, interactive, cannot be done by an agent.** Startable now, in parallel with F1/F2.
3. **Wave F threat model** written and reviewed (§3.1).

- **Included:** `XeroConnection` (per-company) + Xero columns on `ProgressClaim`; connect/callback/disconnect routes; encrypted token store with rotation-safe persistence ordering (§2.5); contact **link** (select an existing Xero contact) — create deferred; the push action producing one DRAFT `ACCREC` invoice with one line per claimed lot, `LineAmountTypes: Exclusive`; PDF attach (D4); idempotent push; sync status and error surfaced on the claim; the invariant reused from `xeroExport.ts:184-194`.
- **Excluded:** payment sync-back (D3), webhooks, contact create, tracking categories, retention, GST, credit notes, accounts payable.
- **Reuse, do not fork:** the invoice payload builder is the **same pure mapping function** the CSV uses — the 2026-07-02 design built it precisely so the sink could be swapped (`docs/plans/2026-07-02-xero-export-v0-design.md:26-31`, `:216-225`). If the F3 build writes a second mapping function, that is a review failure.
- **Migration:** one reviewed additive migration.
- **Feature flag:** `XERO_API_ENABLED`, default false everywhere including production, following `recordDecision.ts:234-237` (read at call time; enabling is an explicit logged rollout step, never an implicit environment default). Rollout: migrate → deploy disabled → enable for one pilot company → verify one real low-stakes push on prod by direct query → enable generally.
- **Rollback:** disable the flag. **Note the asymmetry:** disabling stops new pushes but does not un-create invoices already in the customer's Xero org. Recovery from a bad push is a human action in Xero, and the runbook must say so.
- **Exit gate:** all ATs green; **one real push into a real Xero org verified end-to-end by Jay** (per rule 1 of the global instructions — if it wasn't run, it doesn't work); token refresh exercised across a real 30-minute access-token expiry, not a mocked clock; rotation-failure path exercised by fault injection; the egress inventory disclosed in-product at connect; Xero added to the subprocessor register; monitoring live.

### F4 — Payment sync-back (M) · **gated on D3, not scoped here**

Named only so the reviewer can see the intended shape: a durable poller modelled on `backend/src/worker/handoverExportWorker.ts` (DB lease + fencing token, separate process) — **not** on the in-process webhook retry loop, which is fixed-delay, non-durable and does not survive restart (`backend/src/routes/webhooks/delivery.ts:18-21`, `:108-113`).

### 5.5 Acceptance tests

**F1.** Aggregate totals equal the sum of the per-lot values from the paginated endpoint over the same project (cross-check against the shipped path — the strongest available correctness assertion). Grouping by every reason code in `CLAIM_MEMBER_REASON_CODES`. Project with zero lots; zero blocked lots; all lots blocked. Lots with a null `budgetAmount` — counted in the *count*, excluded from the *value*, and stated in the UI (never silently dropped). Already-claimed and partially-claimed lots (`claimedPercentage`/`remainingPercentage`, `evidenceReadiness.ts:443-450`). Commercial-gate denial for every non-commercial role. `AT-F1-LABEL` and `AT-F1-NOFOLIO` (§1.4). Tenant isolation. Measured 5,000-lot p95.

**F2.** Byte-identical CSV on defaults (characterization). Company A's setting never affects company B. Non-admin cannot write the setting. Export still works when the setting row is absent (defaults apply).

**F3.** Payload frozen-output test covering the complete egress inventory (§2.4) — an added field fails the test. Invariant failure blocks the push before any Xero call. Token refresh: happy path with persisted rotation; **rotation-persist failure → `status='expired'` + reconnect prompt, never a silent dead connection**; the 30-minute grace retry. Xero 5xx, 429, and network-drop-after-create (idempotent retry returns the original invoice). Attach failure leaves the invoice and offers attach retry, never a re-push. Re-push against a non-DRAFT invoice is refused naming the Xero status. Divergence surfaces the §2.6 sentence verbatim. Revocation: CIVOS-initiated, Xero-initiated, expiry. Cross-company push rejection. `ENCRYPTION_KEY` absent → connect refused. Audit rows written in-transaction for connect/disconnect/push with tokens redacted. Permission matrix: company-admin-only connect/disconnect, commercial-only push, subcontractor roles denied everywhere.

### 5.6 Pilot acceptance owner

**Jay**, for every increment — consistent with F0 (`f0-execution-spec-2026-07-24.md:171`). F3's exit gate additionally requires Jay to perform one real push, because no automated test can prove an integration against a live third-party org.

---

## 6. Honest unknowns

Listed rather than asserted. Each names how it gets resolved.

1. **Xero per-minute rate limit (exact number).** Search snippets confirm daily 5,000/tenant and concurrency 5; the per-minute figure was not confirmed from a fetched primary page (`developer.xero.com` timed out repeatedly during this pass). → *Read `X-MinLimit-Remaining` at runtime rather than hard-code any number; confirm at F3 build step 0.*
2. **`Idempotency-Key` retention window.** The header name and 128-char limit came through search snippets and secondary sources; how long Xero honours a key is unresolved. → *Confirm at build step 0; if shorter than a plausible retry gap, add a query-by-reference fallback before create.*
3. **Invoice attachment limits.** 10 files / 25 MB confirmed on the credit-notes page; the invoice-specific figure was not fetched. → *Confirm at build step 0 before sizing the PDF path.*
4. **Whether the shipped CSV header still matches Xero's current import template.** It was verified once at 2026-07-02 and frozen in a test (`xeroExport.ts:23-33`); Xero may have changed it since. **A silently-drifted header fails the customer's import, not our tests.** → *Re-verify in F2 as a cheap side-effect of touching that path.*
5. **Whether `xero-node` is current and maintained.** Not installed at this SHA. The 2026-07-02 spec recommended it (`:260`). → *Evaluate at F3 start; hand-rolling four HTTP calls against a documented OAuth2 flow may be the lazier and more auditable choice than a heavyweight SDK — decide with the reviewer, do not assume the SDK.*
6. **Whether `READINESS_SNAPSHOTS_ENABLED` is true in production.** Default is false (`recordDecision.ts:234-237`) and `docs/reviews/fable-deep-review-2026-07-28.md:216` flags it as likely still false in prod. F1 does not depend on snapshots (it reads live readiness), but the exit-gate story for F0 does. → *Confirm with Jay; not a Wave F blocker, but do not claim F0 is complete while it is off.*
7. **Evidence-pack PDF size distribution at pilot scale.** Needed to size the F3 attachment timeout and check it against Xero's per-file limit. → *Measure on the reference dataset during F3.*
8. **Whether any real head contractor wants API push over the shipped CSV.** Zero validation exists. The only supporting evidence is grade D (§2.1). → **This is D1, and it is the most consequential unknown in the wave.**
9. **Whether Xero exposes a token-revocation endpoint to call on disconnect.** Not confirmed. → *Confirm at build step 0; if it exists, call it and treat failure as non-fatal to the local delete.*
10. **Whether the F1 aggregate is achievable within 3s at 5,000 lots without materialization.** Genuinely open (§4.3) — it depends on the cost of `checkConformancePrerequisitesBatch` at full-project scale, which has never been measured at that size. → *Measure first, decide visibly second.*

---

## 7. Decisions for Jay (D1–D7)

Each carries a recommendation and the one-line why.

**D1 — Does the live Xero API integration (F3) get built in Wave F, or does Wave F stop at F1 + F2?**
→ **Recommend: stop at F1 + F2. Hold F3 until a named design partner says they want to invoice through CIVOS.** The program's own Wave F wording already sets this condition ("API sync when a pilot demands"), the only supporting evidence is grade D, and the research doc's own verdict on half-built accounting integrations is that they are worse than none (`xero-integration-research-and-spec-2026-07-02.md:79-81`). F3's design is locked in §2.3–§2.6, so it can be built fast the day the gate opens. **This is the decision that shapes the whole wave.**

**D2 — Register the Xero developer app and provision a demo org.**
→ **Recommend: do it now regardless of D1.** It is interactive (Jay-only), free, takes under an hour, and it is the classic thing that turns a two-week build into a four-week one when discovered late. **This is the wave's only deployment-style blocker and it is startable today.**

**D3 — Payment sync-back: in Wave F or deferred?**
→ **Recommend: deferred (F4, own gate).** It is the highest-value feature to users (it kills the manual Record Payment step) *and* the highest-risk to the money boundary, and it needs a durable worker that does not exist yet. Shipping push first proves the connection before adding a background process that writes payment state.

**D4 — Is the evidence-pack PDF attached in the first push slice?**
→ **Recommend: yes, and it is the reason to build F3 at all** (§2.3) — **but behind a separate per-company opt-in from the connection itself**, because it is the largest data egress in the product and contains photographs and personnel names (§3.2 rows 6–7). Without the attachment, F3 is a worse CSV with an OAuth liability.

**D5 — Claim-ready column/filter on the lots register?**
→ **Recommend: defer.** It costs a new N-lot computation on the product's hottest register to answer a question the F1 panel already answers. Unpark if a pilot user asks after using F1.

**D6 — The three invoice-shape defaults, open since 2026-07-02 and still unanswered** (`docs/plans/2026-07-02-xero-export-v0-design.md:181-189`): invoice date, invoice number, tracking category.
→ **Recommend: invoice date = claim `periodEnd`** (it is what the claim covers, and Xero ages receivables from it); **invoice number set from `Claim #{n} — {Project.name}`** (ties the invoice back to CIVOS and to the client's expectation); **no tracking category in the first slice** (it needs `accounting.settings` reads and per-company mapping for a reporting nicety). These apply to the shipped CSV too and can be answered during F2.

**D7 — Push authority: is "any commercial-role user on any project can push into the company Xero org" acceptable?**
→ **Recommend: yes for the first slice, disclosed explicitly at connect time** (§3.2 row 5). It matches how the CSV export already works (any commercial user can export any claim), so it is not a new capability — only a lower-friction one. A per-project allowlist is a follow-on if a pilot objects.

---

## 8. Delivery-control checklist (program §9 — all thirteen items)

| # | Item | Where |
|---|---|---|
| 1 | Included / excluded behaviour | §1.1–§1.3, §2.2–§2.3, §5 per increment |
| 2 | Schema and data flow | §2.4 (egress), §5 (migrations per increment); F1 = none |
| 3 | Permission matrix | §5 per increment; §3.2 rows 5, 9, 12 |
| 4 | Edge cases | §2.5 (failure table), §2.6 (divergence), §5.5 |
| 5 | Migration plan | §5 F2/F3 — reviewed Prisma migrations, prod apply via the production-migrations workflow, no `db push` |
| 6 | Security threats (§7) | §3 |
| 7 | Performance tests (§8, reference dataset) | §4 |
| 8 | Feature flag + rollout | §5 per increment |
| 9 | Rollback / recovery | §5 per increment, incl. the F3 asymmetry |
| 10 | Acceptance tests | §5.5 |
| 11 | Pilot acceptance owner | §5.6 — Jay |
| 12 | Production monitoring | §4.4 |
| 13 | Exit-gate evidence | §5 per increment |

---

## Sources

Code citations are `file:line` at `18bd3cfc8a42a5da725aa47e8a208aa0d9c2c959`. External sources used in §2.5:

- [OAuth 2.0 FAQs — Xero Developer](https://developer.xero.com/faq/oauth2) — token lifetimes, rotation, grace period (grade A)
- [Limits FAQs — Xero Developer](https://developer.xero.com/faq/limits) — daily and concurrency limits, headers, 429 (grade A)
- [Idempotent requests — Xero Developer](https://developer.xero.com/documentation/guides/idempotent-requests/idempotency/) — `Idempotency-Key`, 128 characters ([VERIFY BEFORE BUILD] — page did not fetch; snippet + secondary sources only)
- [Accounting API Invoices — Xero Developer](https://developer.xero.com/documentation/api/accounting/invoices) and [Accounting API Attachments — Xero Developer](https://developer.xero.com/documentation/api/accounting/attachments) — endpoint shapes ([VERIFY BEFORE BUILD] — pages did not fetch)

Internal documents: `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` (Rev 1.2a) · `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md` (Rev 1.2a) · `docs/plans/f0-execution-spec-2026-07-24.md` (Rev 3.1) · `docs/plans/2026-07-02-xero-export-v0-design.md` · `docs/research/xero-integration-research-and-spec-2026-07-02.md` · `docs/plans/wave-e0-threat-model-2026-07-28.md` (format) · `docs/reviews/fable-deep-review-2026-07-28.md`

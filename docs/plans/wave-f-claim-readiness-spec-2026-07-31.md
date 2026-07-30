# Wave F Execution Specification — Claim-Readiness Exposure + Accounting Integrations

**Date:** 31 July 2026 · **Rev 2** · **Status:** build-ready for F1 and F2. F3 build-blocked on the Wave F threat model (§3.1) only — D1 and D2 are decided.

### Revision history

| Rev | Date | What changed |
|---|---|---|
| 1 | 31 Jul 2026 | First execution spec (#1701). Written under the assumption that F3 would be parked behind a demand gate (D1). |
| **2** | **31 Jul 2026** | **Folds the adversarial review of Rev 1.** Nine blockers (FR-B1…FR-B9) and eleven non-blocking findings (FR-1…FR-11) dispositioned in §9 — **seven blockers folded, one folded with a material correction to the reviewer's evidence, one refuted in part; four non-blocking findings refuted or corrected.** Substantive changes: §4.1/§4.3 rewritten against the F0.5 benchmark the spec had missed, with a derived F1 budget replacing "measure first" [FR-B1]; §1.2 states a grouping rule so dollar figures cannot double-count [FR-B2]; §2.4 gains variation lines and `*DueDate` [FR-B3, FR-B4]; §2.5 gains connect-time company binding as an explicit design item [FR-B5]; F2 re-derived from three config values, not two [FR-B6]; F1 reshaped to an aggregate-only endpoint that also closes an F0.2a exit item [FR-B7]; D6's invoice number moved to `projectNumber` [FR-B8]; the Wave F threat model named as a build-blocking artifact with a path and an author [FR-B9]. **New decision D8** (SOPA due date on an accounting document). **D1 and D2 marked DECIDED** (Jay, 2026-07-31): full scope — F1, F2 **and** F3 all build this wave. |

**Specified against:** `4bce1fda` (`origin/master`, 31 Jul 2026 — "feat(handover): put the number in the folio-coverage nudge (#1700)"). Rev 1 was written at `18bd3cfc` and reviewed at `69b0a54d`. **Every citation in this Rev 2 was re-verified at `4bce1fda`.** `git diff --stat 69b0a54d 4bce1fda` touches six files, all in the handover-export surface — **no Wave F surface moved**, so Rev 1's citation defects (§9, FR-10) are authoring errors, not drift. **Re-verify line numbers at build time and stamp the fresh SHA in the PR body** (the standing rule from `docs/plans/f0-execution-spec-2026-07-24.md:136`).

**Program of record:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` (Rev 1.2a). Wave F is §3's "Claim-readiness exposure + integrations (M)". This document is the §9 execution specification that must exist before Wave F build starts; the §9 thirteen-item list is the section structure below.

**Evidence register:** `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md`. Grades A–D are used verbatim. **No grade-D claim carries a load-bearing decision alone in this spec**, and where a D-grade row is the only support for a direction, the decision is written as a *direction*, not a *requirement* (§2.1).

---

## 0. How to read this

### 0.1 Three-state honesty on every factual claim

Following the Wave 0 convention (program §3) and the Wave E.0 threat-model format (`docs/plans/wave-e0-threat-model-2026-07-28.md`):

- **Verified** — cited to code at `4bce1fda`, or to a primary source with a URL.
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
4. **HCs pay, subbies free.** Nothing in Wave F is exposed to `subcontractor` / `subcontractor_admin` — already hard-denied: the role set is defined at `backend/src/routes/claims.ts:15` and the `forbidden` throw is at `:42-44` `[FR-10]`.
5. **Readiness is computed, never a stored `ready=true` flag.** F0's governing principle (`docs/plans/f0-execution-spec-2026-07-24.md:6`). Wave F adds **zero new readiness computations** — every surface below is a view over the shipped predicate library.

---

## 1. Scope — what "claim-readiness exposure" means concretely

### 1.1 What already ships (do not re-build, do not re-spec)

| Capability | Where | Status |
|---|---|---|
| Per-lot claim readiness computation | `backend/src/lib/evidenceReadiness.ts:443-450` (`readiness.claim` = `{state, blockers, warnings, support, budgetAmount?, claimedInId, claimedPercentage, remainingPercentage}`) | Shipped |
| Claim-eligibility predicate | `backend/src/lib/readiness/predicates.ts:509` `lotClaimEligible` | Shipped (F0.1, #1546) |
| Paginated claim-readiness endpoint | `GET /api/projects/:projectId/claim-readiness` — `backend/src/routes/claims/readRoutes.ts:326`; cursor encode/decode `:87`/`:93`; page cap 500 `:75` | Shipped (F0.2a, #1556) |
| Frontend pagination adoption | `CreateClaimModal.tsx:128-143` (`useInfiniteQuery`, `CLAIM_READINESS_PAGE_SIZE = 100` at `:64`, "Load more" `:514-523`) `[FR-10]` | Shipped (F0.2a) |
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
- One panel on `ClaimsPage` rendering those groups, each expandable to the source lots (lot number + activity + blocked value + the readiness item's existing `title`/`detail`/`actionLabel`/`actionHref` — types at `frontend/src/types/evidenceReadiness.ts:18-38`).
- Drill-down rows deep-link to the lot, reusing the action plumbing `LotReadinessPanel.tsx:179-206` already renders.

**No new readiness computation.** The endpoint calls the same `computeClaimReadinessItems` (declared `readRoutes.ts:212`, called at `:346` and `:387`) the paginated endpoint calls, and aggregates.

#### `[FR-B7]` The endpoint shape: aggregate-only, and it closes an F0.2a exit item

**Do not build F1 as "the paginated endpoint without pagination".** That path already exists, unpaginated, and is scheduled for deletion:

> `backend/src/routes/claims/readRoutes.ts:338-340` — *"Legacy full-list behaviour (no cursor/limit params): unchanged for existing callers. **Its removal is an F0.2a exit item.**"*

Building a second full-project path next to a path someone else is scheduled to remove guarantees one of two bad outcomes: F1 duplicates it, or the F0.2a closer deletes F1's sibling without knowing why it existed. **Reconciled here, binding on both waves:**

- **F1's aggregate endpoint is the sanctioned replacement.** `GET /api/projects/:projectId/claim-readiness/summary` returns **sums and group keys, not 5,000 hydrated view-models**: `{ totalBudget, claimableValue, blockedValue, lotsInScope, lotsBlocked, lotsWithNullBudget, groups: [{ code, label, lotCount, blockedValue }] }`, plus a **separate paginated drill-down** (`?reasonCode=…`, reusing the shipped keyset cursor at `:87`/`:93` and the 500 cap at `:75`) that returns the source lots for one group at a time.
- **F0.2a's exit item closes by pointing at this endpoint**, once `CreateClaimModal` is the only remaining caller of the paginated path. F1's PR must state that reconciliation explicitly; the F0.2a closer must not delete the legacy path before it does.

This shape is not just tidier — it is why F1 fits its budget (§4.3) and why it carries no memory/event-loop risk `[FR-7]`: the drill-down never materialises more than 500 lots at once, and the summary never materialises a view-model at all.

#### `[FR-B2]` The grouping rule — stated, because dollars do not tolerate overlap

The shipped helper `groupBlockedLotsByReason` (`ProjectCloseoutReadiness.tsx:93-106`) **counts code occurrences, not lots**:

```ts
for (const code of verdict.reasonCodes) {
  counts.set(code, (counts.get(code) ?? 0) + 1);
}
```

In the shipped widget that is harmless — group counts sit alongside a separately-computed `blocked` count (`:127-128`) and nobody adds them. In F1 the same structure would carry **dollars**, and with 17 reason codes multi-code lots are the common case, not an edge case: a $100k lot blocked by `no_photos`, `pending_tests` and `unreleased_hold_points` would render as $300k of blocked value against a stated total of $100k. "Project-management indicator" (§1.4) does not license internally inconsistent arithmetic.

**The rule, chosen and binding:** **a lot appears in every group that blocks it, and group values therefore overlap and do not sum to the total.** The UI states this in the same visual block as the groups:

> **A lot can be blocked by more than one thing, so these add up to more than the total.**

Primary-reason attribution was rejected: it needs a priority ordering over 17 codes that nothing in the product currently defines, and it under-reports how much value each individual blocker is holding up — which is the exact question the panel exists to answer.

**Reuse verdict:** `groupBlockedLotsByReason` is reused **for the label lookup and sort only**. The value/count accumulation is new code in the backend aggregate, because the shipped helper takes `HandoverReadinessVerdict`-shaped rows and carries no money. State that in the PR rather than forcing the shape.

**AT-F1-OVERLAP** pins the chosen invariant both ways: (a) `Σ group.blockedValue ≥ blockedValue` for a fixture with at least one multi-code lot, and (b) `Σ group.blockedValue == blockedValue` when every blocked lot carries exactly one code. Presence-only tests over `CLAIM_MEMBER_REASON_CODES` do not catch this and are not a substitute.

### 1.3 Explicitly excluded from F1 (with owning wave / trigger)

| Excluded | Why | Unparks when |
|---|---|---|
| Claim-ready **column or filter on the lots register** | The register filters client-side over an already-fetched payload with no readiness field (`frontend/src/pages/lots/hooks/useLotsData.ts:236-266`; `Lot` type `lotsPageTypes.ts:1-25`). Adding readiness to the list payload is a new N-lot computation on the hottest register in the product, to answer a question §1.2's panel already answers. | A pilot user asks for it *after* using the F1 panel. **Jay decision D5.** |
| A **new "My Work" / ball-in-court** treatment of claim blockers | Owned by A4 over the F0.3 `ActionAssignment` contract (`backend/src/lib/readiness/contracts/actionAssignment.ts`). Wave F must not fork it. | A4. |
| Per-lot **certified / paid** values | Do not exist in the schema: certification and payment are claim-grain only (`ProgressClaim.certifiedAmount` `backend/prisma/schema.prisma:1533`, `paidAmount` `:1535`). Adding lot-grain money is accounting modelling — boundary §0.3. | Never, as specified. |
| Blocker detail on claim **member snapshots** | By construction every committed member is `ready:true, blockingReasonCodes:[]` — the evaluator rejects the whole claim if any member is blocked (`inclusionDecision.ts:297-310`). Populating blockers would need new plumbing for no consumer. | A consumer appears. |
| Retention, GST, SOPA validity, revenue, cash flow | Boundary §0.3. | Never. **`[FR-B4]` Caveat, added in Rev 2: a CIVOS-computed SOPA payment *date* already ships in the Xero CSV export. That is not "SOPA validity" as this row means it, but it is close enough that Rev 1 should have said so. See §2.4 and decision D8.** |

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

### 2.2 F2 — the shipped CSV's three config values (small, unconditional)

**`[FR-B6]` Rev 1 said "two values, both from `localStorage`". Verified at `4bce1fda`, that is wrong on one of the two and misses a third.** The three values have three different problems and three different justifications, and F2 must be scoped from the real three:

| Value | Actual state at `4bce1fda` | What F2 does, and why |
|---|---|---|
| **`accountCode`** | `ClaimsPage.tsx:527` — `readLocalStorageItem('xeroExport.accountCode') ?? '' \|\| '200'`, sent at `:542`. One localStorage key, per-browser. | **Real drift defect.** Two people at the same company exporting the same claim from different browsers silently produce CSVs with different account codes; neither sees a warning and the failure surfaces in the customer's ledger, not in CIVOS. → **Promote to a per-company setting.** |
| **`taxType`** | **Not in `localStorage`, and not settable by a user at all.** `grep -rn 'taxType\|TaxType' frontend/src` returns **zero matches**; no tax parameter is ever sent. The route accepts `?taxType=` (`xeroExport.ts:240`) but nothing populates it, so every export gets the server default `XERO_DEFAULT_TAX_TYPE = 'GST on Income'` (`:71`). | **Not a drift defect — a missing feature.** Today's tax behaviour is already consistent across browsers. It still needs promoting, because an org whose chart uses a different display name currently has no way to say so and Xero rejects or mis-taxes the import. → **Promote as new configuration**, with the route's existing "must match your chart exactly" help text, and say in the PR that this is a feature, not a fix. |
| **`dueDate`** | Computed **client-side** from CIVOS's per-state SOPA business-day tables (`ClaimsPage.tsx:531-534` → `utils.ts:186-190`), sent as `&dueDate=`, lands in `*DueDate` (`xeroExport.ts:148`, `:163`). | **A boundary question, not a config one.** See §2.4 and **decision D8**. F2 does **not** move it and does **not** bless it; F2's exit gate must not be read as endorsing it. |

**F2 promotes two values to a per-company setting** — income account code and GST tax type — and makes the export read them server-side.

**`[FR-B6]` The exit gate is narrowed accordingly.** Rev 1's gate was *"byte-identical CSV to today"*, which would have silently locked in the un-examined SOPA due date as correct-by-test. The gate is now: **byte-identical CSV for a company on the defaults, with `dueDate` supplied by the caller exactly as today** — the characterization test pins the mapping, not the provenance of the due date, and it carries a comment saying so.

**`[FR-B6]` Fold Rev 1's Unknown #4 into F2's exit gate rather than leaving it open.** The CSV header was verified against `central.xero.com/s/article/Import-customer-invoices` on 2026-07-02 and the code already tells the operator how to re-check — `xeroExport.ts:17-21`: *"confirm the header row + the tax-rate display name against a template downloaded from their own Xero org (Sales > Invoices > Import > Download template file)"*. F2 touches this path anyway. **Exit gate adds: the header row re-confirmed against a freshly downloaded Xero template, with the date recorded in the code comment.** A silently-drifted header fails the customer's import, not our tests.

Deliberately **not** in F2: `XeroConnection`, OAuth, tokens, contacts, tracking categories, and the due-date question (D8). F2 needs one small table (or two columns on `Company` — decide at build time and justify in the PR; the reviewed-migration rule of `CLAUDE.md` applies either way).

### 2.3 F3 — the live thin slice (design locked, build gated)

**D1 is DECIDED — F3 builds this wave (Jay, 2026-07-31).** The minimum slice that is worth more than the CSV:

> **Push one claim as one DRAFT `ACCREC` invoice into the connected Xero org, with the evidence-pack PDF attached.**

**Why that, and not something smaller.** Xero's CSV import already lands invoices as Draft (`docs/plans/2026-07-02-xero-export-v0-design.md:132-134`) — so the API buys *no* extra safety gate. It buys exactly three things CSV cannot do: (1) attach the evidence PDF, (2) remove the download/import shuffle, (3) enable payment sync-back later. **Only (1) is a moat limb** — CIVOS is the only party holding the ITP/test/hold-point proof, so it is the only party that can staple it to the invoice (`docs/research/xero-integration-research-and-spec-2026-07-02.md:56-59`). A push slice without the attachment is a worse CSV with an OAuth liability bolted on. **The attachment is in the first slice or the slice is not worth building** (see D4).

**Deliberately deferred out of F3:** payment sync-back, Xero webhooks, contact create (link-only in the first slice), tracking categories, variations as credit notes, accounts payable, retention. Payment sync-back is the reconciliation minefield (§2.6) and needs a durable poller; it is a separate increment behind its own gate (D3).

### 2.4 What crosses the boundary — and what never does

**Egress inventory. This is the largest single data egress in the product and must be stated to the customer before the first push.**

**Rev 1's inventory was incomplete on two rows, both verified at `4bce1fda`. Both omissions are load-bearing** — §2.4 is presented as *"the complete output surface"* for a frozen-payload test, so anything missing here becomes a test that fails on real data or a field that ships undisclosed.

| Crosses to Xero | Source | Notes |
|---|---|---|
| Client contact name | `Project.clientName`, falling back to `Project.name` | Free text. `xeroExport.ts:149`. |
| Invoice reference `Claim {n} — {Project.projectNumber}` | `ProgressClaim.claimNumber`, `Project.projectNumber` | **`[FR-B8]` Changed from `Project.name` — see D6.** Shipped code builds it at `xeroExport.ts:138`. |
| One line per claimed lot: description, quantity `1`, unit amount | `ClaimedLot` (`schema.prisma:1557-1574`), description format `Lot {n} — {activityType} — this claim {x}% (cumulative {y}%)` — `xeroExport.ts:153-170` | Ex-GST. Lot numbers, activity types and percentages leave the tenant. |
| **`[FR-B3]` One line per claimed variation: `Variation {number} — {title}`, quantity `1`, approved amount** | `Variation.variationNumber`, `Variation.title`, `Variation.approvedAmount` — mapper at `xeroExport.ts:171-181`, query at `:257-264` | **Omitted from Rev 1.** **Free-text variation titles leave the tenant.** In the first slice as invoice lines. |
| **`[FR-B4]` `*DueDate` — a CIVOS-computed SOPA statutory payment date** | `calculatePaymentDueDate(claim.submittedAt, claim.projectState)` (`ClaimsPage.tsx:531-534`) → `getSopaTimeframeForClaim` → `sopaDueDateKey` (`claims/utils.ts:186-190`), per-state business-day tables. Lands at `xeroExport.ts:148`, `:163`. | **Omitted from Rev 1. The highest-consequence row in the whole Xero path** — see below. **Subject to D8.** |
| Account code, tax type | F2 per-company config (§2.2) | |
| **Evidence-pack PDF** (D4) | `ProgressClaim.evidencePackageUrl` | **Contains site photographs, test certificates, and personnel names.** Highest-sensitivity item in the inventory. |

#### `[FR-B3]` Variations are in the first slice, as invoice lines

§2.3's Excluded list says *"variations as **credit notes**"* — that is a different, genuinely deferred thing (an approved *downward* adjustment modelled as a Xero credit note). It must not be read as "variations are out". Variation **invoice lines are in**, because the shipped mapper already emits them and §5 F3's reuse rule requires the API path use that same pure function.

**Why this was a blocker rather than a documentation nit.** A build agent writing the §2.4 frozen-payload test from Rev 1's one-line-source inventory hits one of two outcomes:

1. Test written from the inventory → the reused mapper emits variation rows → **the frozen-payload test fails on every claim carrying a variation.**
2. The agent "fixes" it by dropping variation lines → but `totalClaimedAmount` still includes them (`inclusionDecision.ts:292` — `roundClaimAmountToCents(lotClaimedAmount + variationClaimedAmount)`) → the total-matches-lines invariant at `xeroExport.ts:189-194` throws → **every claim containing a variation becomes permanently unpushable**, with §2.5's prescribed behaviour ("block the push before any call") and no remediation path.

**AT (added to §5.5 F3):** a claim with at least one variation and at least one lot pushes successfully, and its frozen payload contains both row shapes.

#### `[FR-B4]` `*DueDate` is a CIVOS-computed statutory date on an accounting document

This is **already shipped in the CSV**, so F3 does not create it — but F3 promotes it from a CSV a human reviews on an import screen into a **live API write into the customer's receivables ageing**.

The tension is stated plainly rather than resolved here:

- §0.3 boundary 1 says *"CIVOS never computes GST, retention, revenue, cash flow, or amounts owed."* A due **date** is not an amount, so it is arguably outside that boundary as written. §1.3 nonetheless lists **"SOPA validity"** as excluded, unparking *"Never."*
- The frontend already hedges the same value elsewhere — `ClaimsTable.tsx` renders *"Indicative Payment Schedule Due"* / *"Indicative Payment Due"*. **The hedge does not survive the trip into Xero, where the field is just `DueDate`**, and in an AU civil context a payment date sits adjacent to a statutory entitlement position under the relevant state's Security of Payment Act.
- The alternative is already in the code and costs nothing: `invoiceDate + paymentTermsDays`, `XERO_DEFAULT_PAYMENT_TERMS_DAYS = 30` (`xeroExport.ts:74`, applied at `:144-148`).

**This is a boundary call for Jay, not an engineering one. Filed as decision D8 (§7). F3's build must not start on the due-date path before D8 is answered**; every other part of F3 is unblocked by it.

| **NEVER crosses** | Why |
|---|---|
| Readiness state, blockers, reason codes, `RequirementEvaluation` snapshots | Quality truth stays in CIVOS. Xero has no field for it and no need. |
| GST, retention, certified amount, paid amount, entitlement | CIVOS does not compute these (§0.3). GST is computed by Xero from `LineAmountTypes: Exclusive`. |
| NCR content, hold-point decisions, ITP records, user credentials, other projects' data | Out of scope of an invoice. |
| Any CIVOS auth token, session, or internal id beyond the reference string | |

**Rule:** the push payload is built by a **pure function** with the egress inventory above as its complete output surface, unit-tested against a frozen expected payload, so an accidental field addition fails a test rather than silently exporting customer data. This mirrors the shipped CSV's frozen-header discipline (`docs/plans/2026-07-02-xero-export-v0-design.md:144-146`).

### 2.5 OAuth, tokens, tenancy, revocation, failure modes

**Xero API facts.** **`[FR-6]` Grading corrected in Rev 2.** Rev 1 graded two rows **A — "read directly"**. The reviewer could not reach `developer.xero.com` either (`/faq/limits`, `/faq/oauth2`, `/documentation/guides/oauth2/auth-flow/` and the idempotency guide all returned 60s timeouts on an independent pass, matching the spec author's own reported experience). **The substance corroborates through secondary sources and is not in dispute; the grade-A "read directly" provenance is not reproducible from this environment and is withdrawn.** Every former grade-A row is relabelled **B — secondary-corroborated**.

Grades: **B** = consistent across independent secondary sources and search snippets of the primary page; substance believed correct, primary page not fetchable from this environment. **[VERIFY BEFORE BUILD]** = believed true, thinner corroboration, must be re-checked before it is relied on. See the verification-owner note below — **this pass cannot be an agent step.**

| Fact | Value | Grade / status |
|---|---|---|
| Access token lifetime | **30 minutes** | B — [developer.xero.com OAuth 2.0 FAQs](https://developer.xero.com/faq/oauth2), via snippet + secondary sources |
| Refresh token lifetime (unused) | **60 days**; then full re-authorisation | B — same source |
| Refresh token rotation | **Rotates on every refresh — the new one must be persisted or the connection dies** | B — same source |
| Failed-refresh grace | The existing refresh token may be retried for **up to 30 minutes** if no response was received | B — same source |
| Daily limit | **5,000 calls per tenant per 24h** | B — [Limits FAQs](https://developer.xero.com/faq/limits) |
| Concurrency limit | **5 in-flight calls** | B — same source |
| Limit headers | `X-DayLimit-Remaining`, `X-MinLimit-Remaining`, `X-AppMinLimit-Remaining` | B — same source |
| Limit breach response | **HTTP 429** | B — same source |
| Per-minute per-tenant limit | Commonly cited as 60/min | **[VERIFY BEFORE BUILD]** — Build must read `X-MinLimit-Remaining` rather than hard-code any number. |
| **`[FR-B9]` App-wide ceiling across all tenants** | Commonly cited as **10,000 calls/minute across every tenant the app is connected to** | **[VERIFY BEFORE BUILD]** — **Omitted from Rev 1.** This is the cross-tenant noisy-neighbour surface: one CIVOS customer's push burst can degrade every other CIVOS customer. `X-AppMinLimit-Remaining` is the header that exposes it, and §4.4 must monitor it app-wide, not only per tenant. |
| **`[FR-2]` Token revocation endpoint** | **`POST https://identity.xero.com/connect/revocation`**, authenticated with the app's `client_id`/`client_secret` | **[VERIFY BEFORE BUILD]** — corroborated independently during review against `developer.xero.com/documentation/guides/oauth2/pkce-flow` (search snippet) and the `xero-ruby` issue tracker (#67, "Add Revocation endpoint helper"); the primary page did not fetch. **Rev 1's Unknown #9 ("whether an endpoint exists") is closed — an endpoint exists.** The disconnect path is written unconditionally as "call it, treat failure as non-fatal to the local delete"; only the exact request shape needs confirming. |
| `Retry-After` / `X-Rate-Limit-Problem` headers | Believed present on 429 | **[VERIFY BEFORE BUILD]** |
| Idempotency | `Idempotency-Key` header, UUID, **max 128 characters**, supported on POST/PUT including `POST /Invoices` | **[VERIFY BEFORE BUILD]** — 128-char limit and header name from [Xero idempotency docs](https://developer.xero.com/documentation/guides/idempotent-requests/idempotency/) via search snippet and secondary sources; the page itself did not fetch. **Key retention window is [UNKNOWN]** (§6). |
| Attachment limits on invoices | 10 attachments, 25 MB each *(confirmed for credit notes)* | **[VERIFY BEFORE BUILD]** — the 25 MB / 10-file figure was confirmed on the credit-notes page; the invoice-specific figure was not fetched. |
| `xero-node` SDK | **Not installed** — no `xero` dependency in `backend/package.json`, no `XERO_*` in `backend/.env.example` | Verified at `4bce1fda` |

**`[FR-6]` Owner of the verification pass — changed in Rev 2.** Rev 1 assigned build step 0 to the F3 build agent. **That cannot work: `developer.xero.com` does not fetch from this environment at all**, independently reproduced during review. Split it:

- **Agent-doable, at build step 0:** endpoint shapes, request/response bodies, field names. The `XeroAPI/Xero-OpenAPI` specs on GitHub (`xero_accounting.yaml`) and `xeroapi.github.io/xero-node` both fetch fine and are authoritative for shape.
- **Jay action, browser, bundled with D2:** the **rate-limit numbers, the idempotency-key retention window, and the invoice attachment limits**. These live only on `developer.xero.com` behind a domain this environment cannot reach. D2 is already accepted and staged, so this rides along with it — **it is not an agent step and must not be scheduled as one.** None of the three changes the design; they change constants.

**Mechanics — reuse, do not reinvent.** The repo already has an outbound OAuth2 client (Google, login-only): `backend/src/routes/oauth.ts:94` (authorize redirect), `:263-270` (token exchange). Reuse:

- **State/CSRF:** `backend/src/routes/oauth/stateStore.ts:10` `createOAuthState()` — 32 random bytes, **sha256-hashed** at rest, `OAUTH_STATE_EXPIRY_MS = 10 * 60 * 1000` (`:6`), verify at `:24-48`, `cleanupExpiredStates` at `:88`, cleanup interval registered at `:100`. **Read the binding note below before reusing it.**
- **HTTP:** `backend/src/lib/fetchWithTimeout.ts:10`, default 15s (`:1`). **Never bare `fetch`.**
- **`[FR-3]` Production config assertion:** the fail-fast pattern is `backend/src/lib/runtimeConfig.ts:445-446` — `assertProductionSecret('JWT_SECRET', …)` / `assertProductionHexKey('ENCRYPTION_KEY', …, 32)`. (Rev 1 cited `:486-487`, which is the **Resend** assertion — corrected.) `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` asserts belong alongside `:445-446`.
- **Company scoping:** `backend/src/routes/company/access.ts:6` `requireCompanyAdmin` — the connection is **per-company** (one head contractor, one Xero org, all their projects), matching `WebhookConfig.companyId` (`schema.prisma:187`) and the decision already recorded at `docs/research/xero-integration-research-and-spec-2026-07-02.md:236-238`.

**`[FR-B5]` Connect-time company binding — an explicit design item, not a reuse.**

`createOAuthState()` **binds no actor.** Verified at `stateStore.ts:10-22`: it stores `{ stateHash, redirectUri, expiresAt }` and nothing else, and `verifyOAuthState` (`:24-48`) returns only `{ valid, redirectUri }`. **No `userId`, no `companyId`.**

That is *correct* for Google login, where the callback establishes identity **from the returned ID token**. It is **insufficient for Xero**, where the callback must attach the returned refresh token to one specific CIVOS company and **there is no identity in the Xero response to derive it from**. "Reuse `stateStore.ts`" without this note points a build agent at three paths, of which the lowest-friction one is a tenant-crossing vulnerability:

| Path | Verdict |
|---|---|
| Read `companyId` from a **callback query parameter** | **Forbidden.** This is threat row 9 (tenant crossing) realised at *connect* time, and row 9's control only covers the *push*-time lookup. The lowest-friction path and the wrong one. |
| Smuggle it through `redirectUri` | **Forbidden.** It is returned to the caller and is a tamperable channel. |
| **Extend `OauthState` with a nullable `companyId` + `userId`, set at connect, read at callback** | **Required.** Nullable so the Google login path is untouched. |

**This is an additional reviewed additive migration on `OauthState`**, budgeted here rather than discovered mid-build — §5 F3's "one reviewed additive migration" (for `XeroConnection`) is corrected to **two**. The connect route sets `companyId` from `requireCompanyAdmin`'s resolved company; the callback reads it **from the state row only**, and a state row with a null `companyId` is rejected on the Xero callback path. Threat row 13 (§3.2) covers it.

**`[FR-4]` PKCE is not specified, and the reason is stated.** Rev 1's §3.2 row 4 listed "PKCE" as a required control. Two problems: `grep -rn 'code_verifier|code_challenge|pkce|PKCE' backend/src` returns **zero matches repo-wide** — the state store Rev 1 points at has no PKCE support whatsoever, so the control read as though it came for free — and **PKCE is arguably the wrong flow here.** Xero positions PKCE as the flow for native, mobile and single-page apps **that cannot hold a client secret**. The CIVOS backend is a confidential client, for which the standard authorization-code flow with `client_secret` is the correct choice. **Decision: standard authorization-code flow with `client_secret`; PKCE is not built.** Row 4's real controls are the sha256 state + the exact-match redirect-URI allowlist.

**Token storage.** The refresh token is the crown jewel: it grants ongoing access to a customer's accounting system. The precedent is `WebhookConfig.secret` — a secret that must be *replayed*, therefore **encrypted** (AES-256-GCM, `backend/src/lib/encryption.ts:44`/`:80`), not hashed. Hashing is only for compare-only secrets (`HoldPointReleaseToken.token`, sha256, `schema.prisma:825`). Three constraints the build must honour, all verified at this SHA:

1. **`encrypt()` silently returns plaintext when no key is configured and plaintext storage is allowed** — `encryption.ts:49-54`, gated by `isPlaintextSecretStorageAllowed()` at `:12-18` (true for `NODE_ENV` development/test **or** `ALLOW_PLAINTEXT_SECRET_STORAGE === 'true'`). **`[FR-3]` Rev 1 stated this risk without scoping it. Verified scope: in *production* both escapes are already closed** — `runtimeConfig.ts:446` (`assertProductionHexKey('ENCRYPTION_KEY', …, 32)`) and `:461` (`throw new Error('FATAL: ALLOW_PLAINTEXT_SECRET_STORAGE=true is not allowed in production')`). **The live risk is a staging or staging-like environment holding a real customer's Xero refresh token in cleartext with no error** — which is a real risk, because a Xero demo-org connection made from staging carries a genuine refresh token. **F3 must still assert `ENCRYPTION_KEY` is present at connect time and refuse to create a connection otherwise, in every environment** — do not rely on the generic encrypt path, and do not rely on the production-only assert.
2. **There is no key-rotation story.** The ciphertext format `iv:authTag:ciphertext` (`encryption.ts:10`) carries no key id, so rotating `ENCRYPTION_KEY` orphans every stored token. F3 must document the recovery path — **re-consent** (the customer reconnects) — and surface it as a `status: 'expired'` reconnect prompt rather than a silent failure. A versioned-key envelope is a separate, larger change and is **out of scope** here.
3. **Audit redaction is already sufficient — verified, not assumed.** `SENSITIVE_AUDIT_KEY_PATTERNS` at `backend/src/lib/auditLog.ts:18-40` includes `/token/i` and `/secret/i`, applied on write *and* on every historic read via `parseAuditLogChanges` (declared `:134`; the sanitize call is `:142`). `refresh_token`, `refreshToken`, `access_token` and `client_secret` all match. No change needed; a test should pin it.
4. **`[FR-B9]` `decrypt()` has an unconditional plaintext passthrough, and it runs BEFORE the key check.** `encryption.ts:84-87`:
   ```ts
   if (!isEncrypted(encryptedValue)) {
     // Value is not encrypted, return as-is (for migration support)
     return encryptedValue;
   }
   ```
   It is not env-gated and it is not conditional on `NODE_ENV`. Constraint 1's control guards only the **write**. **In production, a refresh token that reached the DB as cleartext by any route decrypts "successfully" forever, and the integration keeps working perfectly** — hiding a live customer's refresh token sitting in plaintext in the table and in every backup, with no error and no signal. **Required control: assert `isEncrypted()` on read of `XeroConnection.refreshToken`; a bare value is treated as `status='expired'` and a reconnect prompt, never as a usable token.** Do not change `decrypt()` itself — other callers depend on the migration passthrough. Threat row 14 (§3.2).

**Revocation.** Three paths, all must be handled:
- *CIVOS-initiated:* a "Disconnect" action deletes the stored tokens and writes an audit row, **and calls `POST https://identity.xero.com/connect/revocation` with the app's `client_id`/`client_secret` and the refresh token — treating its failure as non-fatal to the local delete** (`[FR-2]`; Rev 1 left this conditional on an endpoint existing, which is now established — only the exact request shape is [VERIFY BEFORE BUILD]).
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
| Total-matches-lines invariant fails | Block the push before any call. Reuse the shipped guard (`xeroExport.ts:184-194`). **`[FR-11]` The user is told what to do next** (see below) — Rev 1 specified the block and tested it but left the user at a dead end. |
| Claim re-pushed after the Xero invoice left DRAFT | **Refuse** (§2.6). |

**`[FR-11]` Remediation for an invariant failure.** The path looks near-unreachable by construction — `amountClaimed` is rounded per lot at write (`inclusionDecision.ts:247`) and the claim total is `round(round(Σ lots) + round(Σ variations))` (`:292`), so line and claim totals agree arithmetically — but it *is* reachable if a stored claim total ever diverges from its member rows. The user-facing text, and the runbook line: *"This claim's line items add to \$A but its recorded total is \$B. Nothing was sent to Xero. This is a data fault in the claim — raise it with support (support@civos.com.au) rather than editing around it."* **CIVOS does not offer a "force push" and does not adjust either number.**

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

### 3.1 The gate — `[FR-B9]` now a named, scheduled, build-blocking artifact

**Program §7 requires a threat model as a gated artifact before integration waves.** Under Rev 1's posture (F3 parked behind D1) this was a future concern. **D1 is now DECIDED — full scope — so the Wave F threat model is on the critical path today**, and Rev 1 assigned it to nobody.

| | |
|---|---|
| **Artifact** | **`docs/plans/wave-f0-threat-model-2026-07-31.md`** |
| **Format** | `docs/plans/wave-e0-threat-model-2026-07-28.md` — numbered items, each closing in a binding `### Disposition`; a per-field disclosure inventory where every field carries its own verdict, owner and evidence; a citation-regeneration pass at a fresh SHA. **Measured: 1,172 lines.** (The review cited 1,426; the file measures 1,172 at `4bce1fda`. The bar is the structure, not the line count.) |
| **Author** | **A dedicated threat-model agent, authoring in parallel with this spec.** Not the F3 build agent — the E0 precedent found real violations *because* the author was not the builder, and its §0.2 citation-regeneration pass caught one of its own citations wrong. |
| **Sequence** | **Before F3 build step 0.** F1 and F2 do not wait on it. |
| **Scope input** | §3.2 below is **the row list, not the model.** Every row marked *"→ threat model"* defers its disposition, its owner and its evidence to that document. This spec does not dispose of them. |

**F1 and F2 do not require a separate threat model** — F1 adds no new trust boundary (it is a read view over existing project-scoped data behind the existing commercial gate, and `[FR-B7]`'s aggregate-only shape narrows rather than widens what it returns) and F2 moves two non-secret configuration values from `localStorage` into a company-scoped row. Both still carry the standing requirements below.

### 3.2 Rows this wave contributes to the threat model (F3)

**These are inputs to `docs/plans/wave-f0-threat-model-2026-07-31.md`, not dispositions.** Every row's `→ threat model` marker means: that document owns the disposition, the owner and the evidence. Rows 13–17 are `[FR-B9]` additions the review found missing.

| # | Threat | Surface | Control this spec requires | Disposition |
|---|---|---|---|---|
| 1 | **Refresh-token theft = ongoing access to a customer's accounting system** | `XeroConnection` row, DB backups, logs, Sentry | AES-256-GCM at rest (`encryption.ts:44`); **explicit `ENCRYPTION_KEY` presence assert at connect** (§2.5 constraint 1); never returned by any API; never logged (`/token/i` redaction **verified** at `auditLog.ts:18-40`). **`[FR-B9]` Sentry breadcrumb exclusion is asserted in Rev 1 with no citation — unlike the audit redaction in the same row, which was verified properly. Treat it as TO-BUILD, not as existing.** | → threat model |
| 2 | **Plaintext token storage via misconfiguration** | `ALLOW_PLAINTEXT_SECRET_STORAGE` / `NODE_ENV` (`encryption.ts:12-18`) | Connect route refuses to create a connection when `getEncryptionKey()` would return null, **in every environment**. Production is already covered by `runtimeConfig.ts:446`/`:461` `[FR-3]`; **staging is the live gap.** | → threat model |
| 3 | **Key rotation orphans all tokens** | `ENCRYPTION_KEY` (no key id in ciphertext, `encryption.ts:10`) | Documented re-consent recovery; `status='expired'` + reconnect prompt on decrypt failure, never a crash or a silent skip. | → threat model |
| 4 | **OAuth CSRF / authorization-code injection** | connect + callback routes | Reuse `stateStore.ts:10` (sha256 state, 10-min TTL) + **exact-match redirect-URI allowlist** — no wildcards, no user-supplied redirect. **`[FR-4]` PKCE removed from this row** — it does not exist in the repo and is the wrong flow for a confidential client (§2.5). | → threat model |
| 5 | **Confused deputy: any commercial-role user pushes into the company's Xero org** | push action | **Connect/disconnect = company-admin only** (`company/access.ts:6`). **Push = the existing commercial project gate** (`claims.ts:37-54`; the subcontractor hard-deny set is defined at `:15` and thrown at `:42-44`). Stated to the customer at connect time: *"anyone who can create a claim on any of your projects can push a draft invoice into this Xero organisation."* Per-project allowlist is a follow-on — **D7**. | → threat model |
| 6 | **Data egress beyond the customer's expectation** | push payload, especially the evidence PDF | The frozen-payload test over the **corrected** §2.4 inventory — including variation lines `[FR-B3]` and `*DueDate` `[FR-B4]`. Explicit connect-time disclosure. **Per-company opt-in for the PDF attachment**, separate from the connection (D4). | → threat model |
| 7 | **Evidence PDF leaks personal data into a third-party system** | attachment | Subprocessor-grade disclosure. **`[FR-8]` Two files, not one:** `docs/ops/customer-operations-pack.md:259-279` **and** `frontend/src/pages/legal/PrivacyPolicyPage.tsx`. The register explicitly cross-checks against the policy and states *"the code's disclosed list and this pack match exactly"* (`:276-278`) — updating only the ops doc **breaks the register's own accuracy invariant**, and the privacy policy is the legally operative disclosure. **Framing question for the threat model:** the customer owns the Xero relationship and chooses the destination org, so Xero is arguably a *customer-directed disclosure* rather than a CIVOS subprocessor — the register has no category for that today. | → threat model |
| 8 | **Server-side request forgery via the token/API endpoints** | outbound calls | Host is fixed and compiled in — **never** built from user input. Unlike webhooks (`backend/src/routes/webhooks/destinationSafety.ts:66-113`), there is no user-supplied destination; a test asserts the host constant. | → threat model |
| 9 | **Tenant crossing at push time: company A's claim pushed into company B's Xero org** | connection lookup | The connection is looked up **from the claim's project's company**, never from a request parameter. Tenant-isolation test on every new query surface. | → threat model |
| 10 | **Idempotency key collision → wrong invoice returned** | `Idempotency-Key` | Key derived deterministically from `claimId` (a UUID), never from a counter, never reused across companies. | → threat model |
| 11 | **Push replay / duplicate invoicing** | push route | Store `xeroInvoiceId` on the claim; a second push links rather than creates. The existing claim-create replay machinery is *not* reused — `workflowRoutes.ts:236-242` deliberately keeps claim-create's own `(projectId, requestKey)` idempotency and explains why migrating it would reopen the F-03 double-billing hole. **Do not touch that path.** | → threat model |
| 12 | **Per-tenant rate-limit exhaustion against the customer's Xero org** | push | 5,000/day/tenant is shared with every other app the customer has connected. A push is a small fixed number of calls (ensure-contact, create-invoice, attach). No polling in F3 (that is D3's problem). Respect `X-DayLimit-Remaining`. | → threat model |
| **13** | **`[FR-B5]` Tenant crossing at CONNECT time** | callback route, `OauthState` | The company is bound **into the state row** at connect and read only from there (§2.5). A Xero callback whose state row has a null `companyId` is rejected. **Never** a callback query parameter, never `redirectUri`. Row 9 does not cover this — it only covers the push-time lookup. | → threat model |
| **14** | **`[FR-B9]` A plaintext token survives undetected on the READ path** | `decrypt()` passthrough, `encryption.ts:84-87` | Row 2 guards only the write. Assert `isEncrypted()` on read of `XeroConnection.refreshToken`; a bare value → `status='expired'`, never a usable token (§2.5 constraint 4). Without this, a cleartext token works forever and is invisible. | → threat model |
| **15** | **`[FR-B9]` App-wide rate ceiling as a cross-tenant noisy neighbour** | push, all customers | Row 12 covers the per-tenant limit only. An app-wide ceiling (commonly cited 10,000/min across all tenants, [VERIFY BEFORE BUILD]) means **one CIVOS customer's push burst degrades every other CIVOS customer.** Read `X-AppMinLimit-Remaining`, monitor it **app-wide** (§4.4), and back off on it independently of the per-tenant headers. | → threat model |
| **16** | **`[FR-B9]` Attachment egress is irreversible** | attachment opt-out (D4) | There is no un-send. **A customer who opts out of attachments after 50 evidence PDFs are already in their Xero org has opted out prospectively only** — the existing files stay, and removing them is a human action in the customer's Xero. Say this plainly at the opt-in *and* at the opt-out, not only in the runbook. | → threat model |
| **17** | **`[FR-B4]` A CIVOS-derived statutory date written into a customer's ledger** | `*DueDate` | Blocked on **D8**. Whatever D8 decides, the threat model records the value's provenance and the reasoning. | → threat model, **after D8** |

### 3.3 Standing requirements (program §7) that apply unchanged

Malware scanning and file-type validation on any new upload surface — **F3 adds none** (the PDF is CIVOS-generated). Permission tests for every new export and external workflow. Audit-log tamper resistance and retention. Tenant-isolation tests on every new query surface. New audit actions go in `AuditAction` (`auditLog.ts:157-274`) alongside the existing `WEBHOOK_*` / `API_KEY_*` vocabulary, and connect/disconnect/push use `writeAuditLogInTransaction` (`auditLog.ts:127`, hard-fail) rather than best-effort `createAuditLog` — the helper's own doc comment (`:114-126`) puts privileged company/security actions in that class.

---

## 4. Scale, performance budgets, and monitoring

### 4.1 The claim decision path — current, measured, and NOT what Rev 1 said

**`[FR-B1]` Rev 1 asserted "settled — do not reopen: claim decisions p95 < 2s at the 5,000-member ceiling", citing the F0 spec's *target* lines and never a result. That number is wrong, and the "do not reopen" framing was unearned. Retracted.** Rev 1 also cited `docs/plans/f0-5-benchmark-results-2026-07-26.md` **zero times** and omitted it from Sources, despite it being the measurement of this wave's single biggest stated unknown. Both are authoring failures, not drift.

**The corrected state, read from the whole benchmark document (it has four sections; the first is superseded twice over):**

| | |
|---|---|
| **Budget** | **p95 < 3,000ms** at the 5,000-member ceiling. Revised from 2s by **Jay on 2026-07-27** — option 2 of three recorded options — `f0-5-benchmark-results-2026-07-26.md:406-415`. **The authority is the code: `backend/scripts/bench-f05.ts:608-611` carries the revision comment and `verdict(…, 3000)`.** |
| **Measured** | **PASS.** p95 **2,383.2ms** (full gate, n=20) and **2,507.4ms** (n=5), two committed idle-box records on 2026-07-29 with their own `cpuBusyPercent` evidence (`:490-499`) — **79–84% of budget**. |
| **Transaction headroom** | `DECISION_TRANSACTION_TIMEOUT_MS = 15_000` is now **5.3×** the observed max of 2,838ms (`:605`). |
| **Open product decision** | **None.** The benchmark's original item 6 (*"whether the target or the ceiling should move is a product call… recorded here without a recommendation"*, `:169-173`) **was answered on 2026-07-27** (`:406`). |

**Three corrections to the F0 spec, recorded here because Wave F cited it faithfully and it is the stale document:** `docs/plans/f0-execution-spec-2026-07-24.md:80` and `:115` **both still say "p95 < 2s"** at `4bce1fda`. They predate Jay's 2026-07-27 revision and contradict the benchmark script. **Not a Wave F blocker and not Wave F's to fix in this PR — flagged for the F0 owner as a one-line correction each.** Until it is made, `bench-f05.ts` is the authority on this budget, not the F0 spec.

**What Wave F owes this path: nothing.** Wave F adds no work to the decision transaction. But the margin is 16–21%, on a path that has already flipped from PASS to FAIL once on unrelated work (C1.1 #1585 + D14, `:456-463`). **F3 pushes claims that pass through this transaction; if F3's build touches anything inside `recordDecision`, re-run `npm run bench:f05` and state the number.**

### 4.2 New budgets (program §8 format — percentile, device, network, dataset)

Measured against the **defined production-like reference dataset** (5,000 lots, 10,000 map features, 50GB evidence, 10k-row registers), on a **mid-tier Android device over 4G** for client-side figures, server-side timings measured server-side.

| Surface | Budget | Notes |
|---|---|---|
| **F1** blocked-value aggregate endpoint, 5,000-lot project | **p95 < 3s server-side** | Unchanged number, **but the basis is now a derivation from measured components, not "the claim budget plus headroom" (§4.3).** `[FR-B1]` |
| **F1** drill-down page (one reason code, 500 lots) | **p95 < 1s server-side** | Same budget the shipped paginated claim-readiness endpoint already meets at page 500 (measured 136.2ms, `f0-5-benchmark-results-2026-07-26.md:499`). `[FR-B7]` |
| **F1** panel first meaningful paint | **p95 < 4s** on mid-tier Android / 4G | Must render a loading state immediately and never block the rest of `ClaimsPage`. |
| **F1** drill-down expand (already-fetched data) | **p95 < 300ms** | Client-side only; no refetch on expand. |
| **F2** CSV export, 500-lot claim | **p95 < 2s** — unchanged from today | F2 changes config source, not the mapping. Regression check only. |
| **F3** claim push end-to-end (create + attach) | **p95 < 10s**, with a progress state and a hard 30s ceiling | Dominated by Xero, not CIVOS. `fetchWithTimeout` default is 15s (`fetchWithTimeout.ts:1`) — raise per-call deliberately for the attachment upload and state the value. |
| **F3** PDF attachment upload | Must handle the **p95 evidence-pack size** on the reference dataset without timeout | The size distribution is **[UNKNOWN]** (§6) — measure before setting the timeout. |

### 4.3 `[FR-B1]` The F1 budget, derived from measured components

**Rev 1 wrote this section as if from zero** — "measure first, decide visibly second", with a materialized cache pre-authorised as the escape hatch, and Honest Unknown #10 claiming the cost *"has never been measured at that size"*. **All three were wrong.** The reference dataset (5,000 lots, a real ITP instance per lot, 60,000 `ITPCompletion` rows) has been benchmarked repeatedly since 2026-07-26, on this exact code, and the numbers are committed.

**Measured components, all at the 5,000-lot reference size, all post-optimization** (`f0-5-benchmark-results-2026-07-26.md`):

| Component | Measured | Source |
|---|---|---|
| `checkConformancePrerequisitesBatch` over 5,000 lots — the whole batch, DB + JS | **857ms** | `:557` (2026-07-28 pass, as shipped) |
| Paginated claim-readiness, **full computation for 500 lots**, end to end through the real route | **136.2ms p95** | `:499` (idle-box record, 2026-07-29) |
| `getCumulativeClaimedPercentByLot` at 5,000 | **~31ms** | `:313` |
| Eligibility read, narrowed | **~51ms** | `:558` |

**Derivation.** Cost scales with page size, not register size — keyset pagination, no `OFFSET` scan (`:225-227`). Scaling the measured 500-lot full computation by 10 gives **≈1.4s p95 for a complete 5,000-lot readiness pass**, and that is consistent from the other direction: the conformance batch alone is 857ms of it, leaving ~500ms of per-lot hydration and mapping. **Against the 3s budget that is ~45%, on benchmark hardware.**

**Two caveats, both stated rather than hidden:**
1. **Railway adds one network round trip per query.** The benchmark runs app and database on one host (`:64-69`). The benchmark's own note applies: these costs are *"dominated by a few large single queries rather than by query count"*, so they are comparatively RTT-insensitive — but **treat 1.4s as a floor, not a ceiling.**
2. **JSON serialization of 5,000 view-models is not in that figure** — and `[FR-B7]`'s aggregate-only shape removes it entirely. The summary endpoint serializes ~20 numbers and up to 17 group rows. **This is the single reason F1 fits comfortably rather than marginally**, and it is why the endpoint shape is specified in §1.2 rather than left to the builder.

**The named optimization is already shipped.** The lever the earliest benchmark section identified — narrowing the conformance read from `include` to `select`, worth −53% on that query — **landed in #1580** (`:325-331`) and was extended on 2026-07-28 by fetching completions flat (`:553-564`). **Rev 2 does not re-propose it, and a build agent must not "discover" it.** Two warnings for anyone reading the benchmark to re-derive this:

- **`bench-f05.ts` section D is STALE and the document says so** (`:574-588`). Its variant 2 is a hardcoded `CONFORMANCE_LOT_INCLUDE` literal that has not matched shipped code since #1580, reading ~2,363ms against ~980ms for the select actually used — *"a ~1.4s phantom lever that does not exist."* Variant 4's 920.2ms overstates too. **Do not quote section D numbers as current.**
- **The first verdict table (`:15`, 4,340.7ms FAIL) is superseded twice.** Read to the end of the file.

**Required approach, in order:**
1. **Build it as the aggregate-only endpoint of §1.2 `[FR-B7]`** — sums and group keys computed server-side, drill-down paginated separately. Not a re-hydration of 5,000 view-models.
2. **Measure at 5,000 lots on the reference dataset and state the number in the PR.** The derivation above sets the expectation (~1.4s, ~45% of budget); it does not replace the measurement. **A result materially above ~2s is a signal that the endpoint was built in the shape §1.2 forbids** — check that before reaching for any cache.
3. **`[FR-7]` The exit gate adds a memory and event-loop observation, not just latency.** The repo's precedent is direct: `handoverExportWorker.ts` was split into a separate process over measured 69.99ms event-loop stalls. F1 is a synchronous request on the main API process. The aggregate-only shape should make this a non-event — **record that it is, with a number, rather than assuming it.**
4. **Escape hatches, in order, and only on a measurement:** (a) push the group sums into SQL aggregates; (b) only then, a materialized cache **decided visibly** in a PR that states the measurement that forced it — F0 scoped exactly this (*"stored/materialized readiness cache (only if F0.5 measurement fails, decided visibly)"*, `f0-execution-spec-2026-07-24.md:23`), and F0's governing principle still forbids a stored `ready` flag (`:6`). **Rev 1 pre-authorised (b) and skipped (a); corrected.**
5. **A per-request lot ceiling with an honest "showing the first N" is not acceptable** for a figure labelled as a project total — a partial total is a wrong total. Either it covers the project or it does not ship.

**Exit-gate evidence for F1 includes the measured p95 at 5,000 lots.** No verdict without the number.

### 4.4 Production monitoring

- **F1:** aggregate endpoint p95 and error rate; count of projects exceeding the 3s budget.
- **F2:** export count by account code — a sudden new code is a misconfiguration signal.
- **F3:** push success/failure counts by failure class (auth, rate-limit, invariant, network, attach); **refresh-token rotation failures (any non-zero value is an incident)**; **`[FR-B9]` plaintext-token-detected-on-read count (any non-zero value is an incident** — threat row 14**)**; connections by status (`connected`/`expired`/`revoked`); days-since-last-refresh per connection with an alert before the 60-day cliff; `X-DayLimit-Remaining` low-water mark per tenant; **`[FR-B9]` `X-AppMinLimit-Remaining` low-water mark APP-WIDE** — this is the cross-tenant signal, and per-tenant monitoring alone cannot see it (threat row 15).

---

## 5. Phasing, gates, and delivery control

Each increment is **independently shippable and independently revertible**. Nothing dependent starts before its predecessor's exit gate passes (program §9).

**Scope under D1 (DECIDED, Jay, 2026-07-31): F1, F2 and F3 all build this wave.** F1 and F2 start on acceptance of this Rev 2. F3 starts when the threat model lands (§3.1) — it is the only remaining gate.

### F1 — Blocked-value exposure (S–M) · no Xero · **starts on acceptance of this spec**

- **Included:** the aggregate-only summary endpoint + the separate paginated drill-down (§1.2 `[FR-B7]`), the `ClaimsPage` panel with reason-code grouping and lot drill-down, the §1.4 label, the §1.2 overlap disclosure `[FR-B2]`.
- **Excluded:** everything in §1.3.
- **Migration:** none. Read-only over existing data.
- **`[FR-B7]` F0.2a reconciliation:** the PR states, in the body, that this endpoint is the sanctioned replacement for the legacy unpaginated full-list path (`readRoutes.ts:338-348`) and that F0.2a's exit item closes by pointing at it. **Do not delete the legacy path in this PR** — `CreateClaimModal` still uses the paginated route and the legacy path has its own callers.
- **`[FR-5]` Permissions — Rev 1's note was wrong and following it would have produced a wrong number. Corrected:** the existing commercial gate only, `requireCommercialProjectAccess` (`claims.ts:37-54`). **Do not widen.** Rev 1 called `readRoutes.ts:250`'s hardcoded `canViewCommercial: true` a "trap" and told the aggregate to derive it from the effective role. **Verified: that route sits behind `requireCommercialProjectAccess` at `:330`, so every caller who reaches `:250` is commercial and `true` is correct, not a bug.** Following Rev 1's advice risks the opposite failure: `buildLotReadinessFromInputs` drops `budgetAmount` when `canViewCommercial` is false (`evidenceReadiness.ts:446`), so a role-derived `false` **silently produces an under-counted blocked-value total with no error** — the exact class of wrong number §1.4 exists to prevent. **The aggregate asserts commercial access at the route and then sets `canViewCommercial: true` deliberately, with a comment saying why.**
- **Feature flag:** none needed (additive read surface, no behaviour change to existing paths). If the reviewer disagrees, an env flag following the `readinessSnapshotsEnabled()` shape (`recordDecision.ts:234-237`, read at call time) is the pattern.
- **Rollback:** plain git revert.
- **Exit gate:** all ATs green (§5.5); **measured p95 at 5,000 lots on the reference dataset, stated as a number in the PR** (expectation ~1.4s, §4.3 — a result materially above ~2s means the endpoint shape is wrong); **an event-loop/memory observation at 5,000 lots `[FR-7]`**; label tests present; `AT-F1-OVERLAP` present `[FR-B2]`; zero new readiness computations (reviewer-checkable: the diff adds no new predicate).

### F2 — Per-company Xero export config (S) · **parallel with F1, no dependency**

- **Included:** income account code + GST tax type as company-scoped settings (§2.2 — **two values, with two different justifications: one fixes a drift defect, one adds a missing capability** `[FR-B6]`); a card in `CompanySettingsPage` at the integrations group (`frontend/src/pages/company/CompanySettingsPage.tsx:385-388`, mirroring `CompanyWebhooksSection`); the export route reads them server-side; the `localStorage` read removed from `ClaimsPage.tsx:527`.
- **Excluded:** the `dueDate` value — it is a boundary question (D8), not a config one, and F2 must not be read as blessing it `[FR-B4]`.
- **Migration:** one small reviewed additive migration. Prod apply via the production-migrations workflow (`CLAUDE.md` ops rules — no `db push`, no `--accept-data-loss`).
- **Backfill:** existing users have no stored value. Default to the current default `'200'` (`xeroExport.ts:239`) and `'GST on Income'` (`:71`) so behaviour is unchanged for anyone who never edited the localStorage value; anyone who did is **told once, in the UI, that the setting moved** — not silently reset. Tax type has no per-browser value to migrate — nothing ever set one `[FR-B6]`.
- **Permissions:** read/write = company admin (`company/access.ts:6`); the export route continues to use the commercial project gate.
- **Rollback:** revert the code; the table/columns remain harmlessly (additive migrations are not reverted).
- **Exit gate:** (a) export produces byte-identical CSV to today **for a company on the defaults, with `dueDate` supplied by the caller exactly as today** — characterization test against the existing frozen header/body test in `xeroExport.test.ts`, carrying a comment that it pins the mapping and not the due date's provenance `[FR-B6]`; (b) two users in different browsers now produce identical output — pinned by test; (c) **the CSV header row re-confirmed against a freshly downloaded Xero import template, with the date updated in the `xeroExport.ts:17-21` comment** — this closes Rev 1's Unknown #4 as a side-effect of touching the path `[FR-B6]`.

### F3 — Live Xero connection + draft push + evidence attach (L) · **one gate remaining**

**Gate status under Jay's 2026-07-31 override:**

| Gate | Status |
|---|---|
| **D1** — does F3 build this wave? | **DECIDED — YES, full scope** (Jay, 2026-07-31). Rev 1 recommended stopping at F1+F2; Jay overrode. |
| **D2** — Xero developer app + credentials + demo org | **DECIDED — staged** (Jay). Interactive, Jay-only, in progress in parallel. **`[FR-6]` Now also carries the three `developer.xero.com` figures no agent can fetch: rate-limit numbers, idempotency-key retention window, invoice attachment limits.** |
| **Wave F threat model** (`docs/plans/wave-f0-threat-model-2026-07-31.md`) | **OPEN — the only remaining build blocker.** Authored in parallel (§3.1). |
| **D8** — SOPA due date on the API path | **OPEN — blocks the due-date path only**, not the rest of F3 `[FR-B4]`. |

- **Included:** `XeroConnection` (per-company) + Xero columns on `ProgressClaim`; connect/callback/disconnect routes **with connect-time company binding on `OauthState`** `[FR-B5]`; encrypted token store with rotation-safe persistence ordering **and an `isEncrypted()` assert on read** (§2.5 constraints 1 and 4) `[FR-B9]`; contact **link** (select an existing Xero contact) — create deferred; the push action producing one DRAFT `ACCREC` invoice with **one line per claimed lot and one line per claimed variation** `[FR-B3]`, `LineAmountTypes: Exclusive`; PDF attach (D4); idempotent push; sync status and error surfaced on the claim; the invariant reused from `xeroExport.ts:184-194` **with the §2.5 remediation text** `[FR-11]`.
- **Excluded:** payment sync-back (D3), webhooks, contact create, tracking categories, retention, GST, **variations as credit notes** (a downward adjustment modelled as a Xero credit note — **not** the variation invoice lines, which are in `[FR-B3]`), accounts payable.
- **Reuse, do not fork:** the invoice payload builder is the **same pure mapping function** the CSV uses — the 2026-07-02 design built it precisely so the sink could be swapped (`docs/plans/2026-07-02-xero-export-v0-design.md:26-31`, `:216-225`). If the F3 build writes a second mapping function, that is a review failure. **This is exactly why §2.4's inventory had to gain variations: the reused function emits them.**
- **Migration: `[FR-B5]` two reviewed additive migrations, not one** — `XeroConnection` + `ProgressClaim` columns, and a nullable `companyId`/`userId` on `OauthState`.
- **Feature flag:** `XERO_API_ENABLED`, default false everywhere including production, following `recordDecision.ts:234-237` (read at call time; enabling is an explicit logged rollout step, never an implicit environment default). Rollout: migrate → deploy disabled → enable for one pilot company → verify one real low-stakes push on prod by direct query → enable generally.
- **Rollback:** disable the flag. **Note the asymmetry:** disabling stops new pushes but does not un-create invoices already in the customer's Xero org. Recovery from a bad push is a human action in Xero, and the runbook must say so.
- **Exit gate:** all ATs green; **one real push into a real Xero org verified end-to-end by Jay** (per rule 1 of the global instructions — if it wasn't run, it doesn't work); token refresh exercised across a real 30-minute access-token expiry, not a mocked clock; rotation-failure path exercised by fault injection; the egress inventory disclosed in-product at connect; Xero added to the subprocessor register; monitoring live.

### F4 — Payment sync-back (M) · **gated on D3, not scoped here**

Named only so the reviewer can see the intended shape: a durable poller modelled on `backend/src/worker/handoverExportWorker.ts` (DB lease + fencing token, separate process) — **not** on the in-process webhook retry loop, which is fixed-delay, non-durable and does not survive restart (`backend/src/routes/webhooks/delivery.ts:18-21`; `waitForRetryDelay` at `:110-115`, and `:312` hoists the delay outside the loop, so there is no backoff).

### 5.5 Acceptance tests

**F1.** Aggregate totals equal the sum of the per-lot values from the paginated endpoint over the same project (cross-check against the shipped path — the strongest available correctness assertion). **`AT-F1-OVERLAP` — the grouping invariant, both directions (§1.2 `[FR-B2]`): `Σ group.blockedValue ≥ blockedValue` with a multi-code lot present, and `Σ group.blockedValue == blockedValue` when every blocked lot carries exactly one code.** Grouping by every reason code in `CLAIM_MEMBER_REASON_CODES` (presence — **not a substitute for `AT-F1-OVERLAP`**). Project with zero lots; zero blocked lots; all lots blocked. Lots with a null `budgetAmount` — counted in the *count*, excluded from the *value*, and stated in the UI (never silently dropped). Already-claimed and partially-claimed lots (`claimedPercentage`/`remainingPercentage`, `evidenceReadiness.ts:443-450`). Commercial-gate denial for every non-commercial role. `AT-F1-LABEL` and `AT-F1-NOFOLIO` (§1.4). Tenant isolation. Measured 5,000-lot p95. **Drill-down returns only the lots of the requested reason code, paginated, honouring the 500 cap `[FR-B7]`.**

> **`[FR-9]` Known divergence to state in the F1 PR, not to silently create.** F1's null-`budgetAmount` rule (count it, exclude it from the value, say so) is the right rule and is **the opposite of what `CreateClaimModal` does today**: `claims/utils.ts:275` computes `(lot.budgetAmount ?? 0) * (percentComplete / 100)`, i.e. a null budget silently becomes $0, pinned by `utils.test.ts`. In practice the path is narrow — `lotClaimEligible` blocks these lots via `missing_budget` — but **the F1 panel and the create-claim modal must not disagree in front of a user without anyone having decided that they should.** F1's PR either aligns the modal or states why the divergence is acceptable.

**F2.** Byte-identical CSV on defaults, with `dueDate` supplied by the caller (characterization) `[FR-B6]`. Company A's setting never affects company B. Non-admin cannot write the setting. Export still works when the setting row is absent (defaults apply). **Tax type: a company-configured value reaches the CSV; an unset value still yields `'GST on Income'`; a blank value is treated as unset and never emitted blank** (`xeroExport.ts:151` — a blank `TaxType` imports as untaxed and under-bills GST).

**F3.** Payload frozen-output test covering the **corrected** egress inventory (§2.4) — an added field fails the test. **`[FR-B3]` A claim with at least one lot AND at least one variation pushes successfully, and its frozen payload contains both row shapes** (the mapper emits variation rows at `xeroExport.ts:171-181`; a test written from Rev 1's inventory would have failed on every such claim). **`[FR-B8]` Two projects in one company sharing a `name` produce distinct invoice numbers.** Invariant failure blocks the push before any Xero call **and surfaces the §2.5 remediation text** `[FR-11]`. Token refresh: happy path with persisted rotation; **rotation-persist failure → `status='expired'` + reconnect prompt, never a silent dead connection**; the 30-minute grace retry. Xero 5xx, 429, and network-drop-after-create (idempotent retry returns the original invoice). Attach failure leaves the invoice and offers attach retry, never a re-push. Re-push against a non-DRAFT invoice is refused naming the Xero status. Divergence surfaces the §2.6 sentence verbatim. Revocation: CIVOS-initiated (**including the revocation call, and a revocation-call failure still deleting locally** `[FR-2]`), Xero-initiated, expiry. Cross-company push rejection. **`[FR-B5]` Callback with a state row carrying a null `companyId` is rejected; a `companyId` supplied as a callback query parameter is ignored entirely.** `ENCRYPTION_KEY` absent → connect refused. **`[FR-B9]` A `XeroConnection` row whose `refreshToken` is not `isEncrypted()` is treated as `status='expired'`, never used, and counted.** Audit rows written in-transaction for connect/disconnect/push with tokens redacted. Permission matrix: company-admin-only connect/disconnect, commercial-only push, subcontractor roles denied everywhere.

### 5.6 Pilot acceptance owner

**Jay**, for every increment — consistent with F0 (`f0-execution-spec-2026-07-24.md:171`). F3's exit gate additionally requires Jay to perform one real push, because no automated test can prove an integration against a live third-party org.

---

## 6. Honest unknowns

Listed rather than asserted. Each names how it gets resolved. **`[FR-6]` The three `developer.xero.com` items below are Jay actions bundled with D2, not agent steps** — that domain does not fetch from this environment, independently reproduced.

1. **Xero per-minute rate limits (exact numbers, per-tenant and app-wide).** Secondary sources give 60/min/tenant and ~10,000/min app-wide; neither is confirmed from a fetched primary page. → *Read `X-MinLimit-Remaining` and `X-AppMinLimit-Remaining` at runtime rather than hard-code any number. **Jay, with D2.*** `[FR-B9]`
2. **`Idempotency-Key` retention window.** The header name and 128-char limit came through search snippets and secondary sources; how long Xero honours a key is unresolved. → ***Jay, with D2.*** *If shorter than a plausible retry gap, add a query-by-reference fallback before create.*
3. **Invoice attachment limits.** 10 files / 25 MB confirmed on the credit-notes page; the invoice-specific figure was not fetched. → ***Jay, with D2**, before sizing the PDF path.*
4. **Whether `xero-node` is current and maintained.** Not installed at `4bce1fda`. The 2026-07-02 spec recommended it (`:260`). → *Evaluate at F3 start; hand-rolling four HTTP calls against a documented OAuth2 flow may be the lazier and more auditable choice than a heavyweight SDK — decide with the reviewer, do not assume the SDK. Endpoint shapes are agent-fetchable from `XeroAPI/Xero-OpenAPI` on GitHub.*
5. **Evidence-pack PDF size distribution at pilot scale.** Needed to size the F3 attachment timeout and check it against Xero's per-file limit. → *Measure on the reference dataset during F3.*
6. **Whether the SOPA-derived due date belongs on an accounting document at all.** → **This is D8**, and it is the only genuinely open *product* question left in the wave `[FR-B4]`.

**Closed since Rev 1 — recorded so they are not re-opened:**

| Rev 1 unknown | Status |
|---|---|
| #4 — whether the CSV header still matches Xero's template | **Folded into F2's exit gate** as a re-confirmation step, not left open `[FR-B6]`. |
| #6 — whether `READINESS_SNAPSHOTS_ENABLED` is true in production | **CLOSED — it is ON, and has been since 2026-07-26** (F0.5 ritual, verified by direct query against production). Rev 1 said the opposite, citing `docs/reviews/fable-deep-review-2026-07-28.md:216`. **`[FR-1]` The repo still asserts the stale "off" in three places** that a future agent will read as current: `backend/.env.example:77` (`READINESS_SNAPSHOTS_ENABLED=false`), `backend/src/routes/claims/workflowRoutes.ts:240-242` (reasons about snapshot-backed replay being inert *"while `READINESS_SNAPSHOTS_ENABLED` is off"* — **load-bearing**, it explains why migrating claim-create idempotency would reopen the F-03 double-billing hole), and `backend/src/lib/readiness/sufficiency/rulesets/index.ts:36` (*"`RequirementEvaluation` has ZERO rows"*). **Worth a one-line cleanup PR; not a Wave F blocker and not in Wave F's diff.** |
| #8 — whether any head contractor wants API push | **Superseded by D1 (DECIDED, full scope).** The validation gap is real and unchanged; Jay chose to build anyway. Recorded honestly rather than retro-justified. |
| #9 — whether Xero exposes a revocation endpoint | **CLOSED — one exists** (`POST https://identity.xero.com/connect/revocation`). Only the exact request shape remains [VERIFY BEFORE BUILD] `[FR-2]`. |
| #10 — whether the F1 aggregate is achievable within 3s at 5,000 lots | **CLOSED — it was measured, five days before Rev 1 was written.** Rev 1's claim that the cost *"has never been measured at that size"* was false. §4.3 now derives ~1.4s p95 (~45% of budget) from committed measurements `[FR-B1]`. The build still states its own measured number. |

---

## 7. Decisions for Jay (D1–D8)

Each carries a recommendation and the one-line why. **D1 and D2 are now DECIDED; D3–D8 are open.**

**D1 — Does the live Xero API integration (F3) get built in Wave F, or does Wave F stop at F1 + F2?**
→ **DECIDED (Jay, 2026-07-31): full scope. F1, F2 AND F3 all build this wave.**
→ *Rev 1 recommended: stop at F1 + F2, hold F3 until a named design partner asks* — on the grounds that the program's own Wave F wording sets that condition ("API sync when a pilot demands"), the only supporting evidence is grade D, and the research doc's verdict on half-built accounting integrations is that they are worse than none (`xero-integration-research-and-spec-2026-07-02.md:79-81`). **Jay overrode.** The recommendation is preserved rather than rewritten, because the risk it names has not gone away: **F3 ships with zero demand validation, and "a half-working integration is worse than none" is the failure mode to watch.** That makes F3's exit gate (one real push, verified by Jay) and its `XERO_API_ENABLED` flag load-bearing, not ceremonial.

**D2 — Register the Xero developer app and provision a demo org.**
→ **DECIDED (Jay): staged, in progress.** Interactive, Jay-only, free, under an hour.
→ **`[FR-6]` Scope added in Rev 2:** D2 now also carries the three figures that live only on `developer.xero.com`, a domain this environment cannot reach — **rate-limit numbers, idempotency-key retention window, invoice attachment limits.** They were assigned to the F3 build agent in Rev 1 as "build step 0"; that could never have worked. None changes the design; each sets a constant.

**D3 — Payment sync-back: in Wave F or deferred?**
→ **Recommend: deferred (F4, own gate).** It is the highest-value feature to users (it kills the manual Record Payment step) *and* the highest-risk to the money boundary, and it needs a durable worker that does not exist yet. Shipping push first proves the connection before adding a background process that writes payment state.

**D4 — Is the evidence-pack PDF attached in the first push slice?**
→ **Recommend: yes, and it is the reason to build F3 at all** (§2.3) — **but behind a separate per-company opt-in from the connection itself**, because it is the largest data egress in the product and contains photographs and personnel names (§3.2 rows 6–7). Without the attachment, F3 is a worse CSV with an OAuth liability.

**D5 — Claim-ready column/filter on the lots register?**
→ **Recommend: defer.** It costs a new N-lot computation on the product's hottest register to answer a question the F1 panel already answers. Unpark if a pilot user asks after using F1.

**D6 — The three invoice-shape defaults, open since 2026-07-02 and still unanswered** (`docs/plans/2026-07-02-xero-export-v0-design.md:181-189`): invoice date, invoice number, tracking category.
→ **Recommend: invoice date = claim `periodEnd`** (it is what the claim covers, and Xero ages receivables from it); **`[FR-B8]` invoice number = `Claim {n} — {Project.projectNumber}`, not `{Project.name}`** — Rev 1 recommended the name, and **`Project.name` has no uniqueness constraint**: the only unique key on the model is `@@unique([companyId, projectNumber])` (`schema.prisma:434`), so two projects in one company may share a name and nothing in the product prevents it. Xero requires invoice numbers unique per org; in CSV that degrades gracefully (a human sees the import screen), **via the API two same-named projects each pushing their Claim 1 collide or fail.** `projectNumber` is already unique per company, so this is a one-field fix. **No tracking category in the first slice** (it needs `accounting.settings` reads and per-company mapping for a reporting nicety). These apply to the shipped CSV too (`xeroExport.ts:138`) and can be answered during F2.

**D7 — Push authority: is "any commercial-role user on any project can push into the company Xero org" acceptable?**
→ **Recommend: yes for the first slice, disclosed explicitly at connect time** (§3.2 row 5). It matches how the CSV export already works (any commercial user can export any claim), so it is not a new capability — only a lower-friction one. A per-project allowlist is a follow-on if a pilot objects.

**`[FR-B4]` D8 — NEW. May a CIVOS-computed SOPA statutory payment date be written into a customer's accounting system by the API?**

*The situation:* CIVOS already computes a per-state SOPA payment due date from its own business-day tables (`claims/utils.ts:186-190`) and already sends it as `*DueDate` in the shipped CSV (`ClaimsPage.tsx:531-534` → `xeroExport.ts:148`). F3 promotes that value from a CSV a human reviews on an import screen into a **silent API write into the customer's receivables ageing**. CIVOS hedges the same number in its own UI — *"Indicative Payment Due"* — and **that hedge cannot travel into a Xero field called `DueDate`.**

→ **Recommend: the API path writes `invoiceDate + paymentTermsDays` (the existing `XERO_DEFAULT_PAYMENT_TERMS_DAYS = 30`, `xeroExport.ts:74`); CIVOS keeps showing the SOPA date in its own UI where the "Indicative" label lives; the CSV path is unchanged. Offer the SOPA date on the API path as a per-company opt-in only if a pilot asks.**
→ *The one-line why:* a date CIVOS derives is a projection, and the API write is the one place the "indicative" hedge cannot go with it — into a field that drives a customer's receivables ageing and sits next to a statutory entitlement position.

*If you decide the other way* ("write the SOPA date, it's more useful than a generic +30"), that is defensible — a due date is not an amount, so §0.3 boundary 1 does not strictly forbid it — but then §1.3's *"SOPA validity — Never"* row needs amending to say so explicitly, and threat row 17 records the reasoning. **Either answer is fine; leaving it unstated while shipping a live API write is not.**

---

## 8. Delivery-control checklist (program §9 — all thirteen items)

| # | Item | Where |
|---|---|---|
| 1 | Included / excluded behaviour | §1.1–§1.3, §2.2–§2.3, §5 per increment |
| 2 | Schema and data flow | §2.4 (egress — **corrected in Rev 2**), §5 (migrations per increment); F1 = none, F3 = **two** |
| 3 | Permission matrix | §5 per increment (**F1's corrected in Rev 2, `[FR-5]`**); §3.2 rows 5, 9, 12, 13 |
| 4 | Edge cases | §2.5 (failure table + remediation), §2.6 (divergence), §5.5 |
| 5 | Migration plan | §5 F2/F3 — reviewed Prisma migrations, prod apply via the production-migrations workflow, no `db push` |
| 6 | Security threats (§7) | §3 — **and `docs/plans/wave-f0-threat-model-2026-07-31.md`, which owns every §3.2 disposition** |
| 7 | Performance tests (§8, reference dataset) | §4 — **§4.3 is now a derived budget, not a measurement plan** |
| 8 | Feature flag + rollout | §5 per increment |
| 9 | Rollback / recovery | §5 per increment, incl. the F3 asymmetry and threat row 16 |
| 10 | Acceptance tests | §5.5 |
| 11 | Pilot acceptance owner | §5.6 — Jay |
| 12 | Production monitoring | §4.4 |
| 13 | Exit-gate evidence | §5 per increment |
| — | **Review traceability** | **§9 — every FR-B*n* / FR-*n* disposition, folded or refuted with evidence** |

---

## 9. Review disposition (Rev 1 adversarial review)

**Every finding was re-verified against the code and docs at `4bce1fda` before folding. Where the reviewer is refuted, the refutation carries `file:line` evidence.** Of nine blockers: **seven folded as written, one folded with a material correction to the reviewer's own evidence (FR-B1), one folded in part and refuted in part (FR-B1's derived consequences).** Of eleven non-blocking findings: **seven folded, three refuted or corrected, one flagged to another owner.**

### Blockers

| # | Finding | Disposition | Where |
|---|---|---|---|
| **FR-B1** | The F0.5 benchmark exists, is uncited, and contradicts §4.1 | **FOLDED — with the reviewer's evidence corrected. See the detail below; this is the one finding where the reviewer was materially wrong on direction while being right on substance.** | §4.1, §4.3, §6 |
| **FR-B2** | Reason-code grouping double-counts dollars | **FOLDED.** Verified `groupBlockedLotsByReason` counts code occurrences, not lots (`ProjectCloseoutReadiness.tsx:96-102`); 17 codes confirmed (`claimMember.v1.ts:33-51`), so multi-code lots are the common case. Grouping rule chosen (overlap, disclosed), `AT-F1-OVERLAP` added. | §1.2, §5.5 |
| **FR-B3** | Egress inventory omits variation lines → claims-with-variations unpushable | **FOLDED.** Verified the mapper emits variation rows (`xeroExport.ts:171-181`), the query fetches them (`:257-264`), and the total includes them (`inclusionDecision.ts:292`) so dropping the rows trips the invariant at `:189-194`. Inventory row added, "credit notes" disambiguated, AT added. | §2.4, §5 F3, §5.5 |
| **FR-B4** | `*DueDate` is a CIVOS-computed SOPA date, undisclosed | **FOLDED as new decision D8**, framed for Jay with a recommendation, not decided here. Full chain verified: `ClaimsPage.tsx:531-534` → `claims/utils.ts:186-190` → `xeroExport.ts:148`, `:163`. | §2.4, §1.3, §7 D8, §3.2 row 17 |
| **FR-B5** | OAuth state store binds no company; "reuse it" points at tenant crossing | **FOLDED.** Verified `createOAuthState` stores only `{stateHash, redirectUri, expiresAt}` (`stateStore.ts:10-22`) and `verifyOAuthState` returns only `{valid, redirectUri}` (`:24-48`). Connect-time binding specified, second migration budgeted, threat row 13 added. PKCE absence confirmed (zero matches repo-wide). | §2.5, §3.2 row 13, §5 F3 |
| **FR-B6** | F2's premise wrong on `taxType`, misses `dueDate` | **FOLDED, and the reviewer understated it.** `grep -rn 'taxType\|TaxType' frontend/src` returns **zero** matches (the reviewer reported "exactly one hit"). F2 re-derived from three values with three rationales; exit gate narrowed so it no longer blesses the due date; Unknown #4 folded in. | §2.2, §5 F2 |
| **FR-B7** | F1 collides with an open F0.2a exit item | **FOLDED.** Verified the legacy full-list path and its exit-item comment (`readRoutes.ts:338-348`). Took the reviewer's recommended resolution: F1 is an **aggregate-only** endpoint plus a separate paginated drill-down, and it is the sanctioned replacement. This also dissolves FR-7. | §1.2, §4.3, §5 F1 |
| **FR-B8** | `Project.name` is not unique; Xero requires unique invoice numbers | **FOLDED.** Verified: the only unique key on `Project` is `@@unique([companyId, projectNumber])` (`schema.prisma:434`). D6 changed to `projectNumber`; AT added. | §7 D6, §2.4, §5.5 |
| **FR-B9** | Threat model has no author, no schedule; five rows missing | **FOLDED.** Named as `docs/plans/wave-f0-threat-model-2026-07-31.md`, authored in parallel, sequenced before F3 step 0, with every §3.2 row marked as deferring to it. All five missing rows added (13–17). **One correction: the E0 precedent measures 1,172 lines at `4bce1fda`, not 1,426.** The `decrypt()` passthrough (`encryption.ts:84-87`) is confirmed unconditional and pre-key-check — the most serious of the five. | §3.1, §3.2, §2.5, §4.4 |

#### FR-B1 in detail — right that it matters, wrong on what it says

**Upheld, and it is the highest-value edit in this Rev 2:** Rev 1 cited `f0-5-benchmark-results-2026-07-26.md` zero times, omitted it from Sources, asserted a budget number it never checked against a result, and claimed in Unknown #10 that the cost *"has never been measured at that size"*. All true, all fixed.

**Refuted, with evidence — the reviewer read only §1 of a document with four sections:**

| Reviewer's claim | Evidence | Verdict |
|---|---|---|
| *"§4.1 is asserting a budget that is measured FAILING"* — citing `:15`, 4,340.7ms vs a 2s budget | The 2s budget was **superseded**. Jay revised it to **3s on 2026-07-27** (`:406-415`), pinned in code at `bench-f05.ts:608-611` (`verdict(…, 3000)` with the revision comment). Current measurement **PASSES**: p95 2,383.2ms / 2,507.4ms on two committed idle-box records (`:490-499`) = 79–84% of budget. | **REFUTED.** §4.1's *number* was wrong; the *area* is passing, not failing. |
| *"a live, unresolved, Jay-owned decision… not in §7's D1–D7"* — benchmark item 6 | Item 6 (`:169-173`) was **answered on 2026-07-27**: option 2, budget → 3s, *"Jay accepted the recommendation"* (`:406`). | **REFUTED.** No open decision. |
| *"Rev 2 must land [narrowing the conformance select] as the F1 approach"* — citing variant 4, 920.2ms vs 1,938.4ms | **That optimization shipped.** `include`→`select` landed in **#1580** (`:325-331`); flat completions fetch landed 2026-07-28 (`:553-564`). The document explicitly declares section D **STALE** and variant 2 *"a ~1.4s phantom lever that does not exist"* (`:574-588`). | **REFUTED.** Cannot be "landed"; already shipped. Rev 2 warns build agents off re-proposing it. |
| *"headroom is 3.3×, not the comfortable margin the comment implies"* — `DECISION_TRANSACTION_TIMEOUT_MS` | Now **5.3×** the observed max of 2,838ms (`:605`). | **REFUTED** (stale figure). |
| Derived F1 estimate ≈ **2.6s** against a 3s budget | Built from superseded components (1,846.7ms conformance, pre-#1580). Post-optimization the conformance batch is **857ms** (`:557`) and a 500-lot full readiness pass is **136.2ms p95** (`:499`), giving **≈1.4s**. | **REFUTED** — and the correction is the point: F1 is comfortable, not marginal. |

**Beyond the review:** `docs/plans/f0-execution-spec-2026-07-24.md:80` and `:115` **both still say "p95 < 2s"** at `4bce1fda` — they predate the 2026-07-27 revision and contradict `bench-f05.ts`. Rev 1 cited them faithfully; the F0 spec is the stale document. Flagged to the F0 owner (§4.1).

### Non-blocking findings

| # | Finding | Disposition |
|---|---|---|
| FR-1 | Unknown #6 wrong — `READINESS_SNAPSHOTS_ENABLED` is ON in prod | **FOLDED.** Unknown struck; ON since 2026-07-26 confirmed by the orchestrator's direct production query. Three stale in-code assertions verified at `.env.example:77`, `workflowRoutes.ts:240-242`, `rulesets/index.ts:36` — **flagged for a separate one-line cleanup PR, not in Wave F's diff.** (§6) |
| FR-2 | Xero revocation endpoint exists | **FOLDED.** Unknown #9 closed; the disconnect path is now written unconditionally. (§2.5) |
| FR-3 | `runtimeConfig` already implements two controls; wrong line cited | **FOLDED with the reviewer's scoping confirmed.** Verified `:446` (`assertProductionHexKey('ENCRYPTION_KEY', …)`) and `:461` (`ALLOW_PLAINTEXT_SECRET_STORAGE` throw); `:486-487` is indeed Resend. Production is already covered; **staging is the live gap** and the connect-time assert is still built. (§2.5, §3.2 row 2) |
| FR-4 | PKCE specified but absent and arguably wrong flow | **FOLDED.** Zero matches repo-wide confirmed. PKCE dropped with the reason stated: CIVOS is a confidential client. (§2.5, §3.2 row 4) |
| FR-5 | The F1 permission note may make the number wrong | **FOLDED — Rev 1's advice was wrong and is retracted.** Verified `readRoutes.ts:250` sits behind `requireCommercialProjectAccess` at `:330`, so `true` is correct; and `evidenceReadiness.ts:446` drops `budgetAmount` when the flag is false, so following Rev 1 would have silently under-counted the total. (§5 F1) |
| FR-6 | `developer.xero.com` does not fetch; grade-A claims not reproducible | **FOLDED.** All grade-A rows relabelled **B — secondary-corroborated**; the verification pass split into an agent part (OpenAPI specs on GitHub) and a **Jay part bundled with D2**. (§2.5, §6) |
| FR-7 | No memory / event-loop budget for F1 | **FOLDED, and largely dissolved by FR-B7's endpoint shape.** An event-loop and memory observation is now explicit exit-gate evidence. (§4.3, §5 F1) |
| FR-8 | Subprocessor row needs a second file | **FOLDED.** Verified the register at `docs/ops/customer-operations-pack.md:259-279`, its cross-check against `PrivacyPolicyPage.tsx` at `:261-262`, and its accuracy invariant at `:276-278`. Both files named; the customer-directed-disclosure framing question passed to the threat model. (§3.2 row 7) |
| FR-9 | Null `budgetAmount` — F1's AT contradicts shipped behaviour | **FOLDED.** Verified `claims/utils.ts:275` (`(lot.budgetAmount ?? 0) * …`). Divergence must be stated and resolved in F1's PR, not created silently. (§5.5) |
| FR-10 | Citation defects | **FOLDED — all eight verified and corrected**, including the two that mattered: `oauth.ts:382-387` is **inbound Google ID-token issuer validation**, not outbound-client precedent (citation removed, not relocated); and `prismaStream.ts` is `prismaRegimeStreamFetcher` (`:29-41`) — a single bounded `findMany` where "stream" is a *domain* noun (frequency regime), **not a row streamer**, so it gave F1 no batching mechanism. Rev 1's §4.3 offered it as one; that offer is deleted. Also corrected: `readRoutes.ts:212` (declaration; calls `:346`/`:387`), `claims.ts:15` (set; throw `:42-44`), `auditLog.ts:134` (declaration; `:142` a line within), `stateStore.ts:88`/`:100`, `delivery.ts:110-115`, `CreateClaimModal.tsx:64`, `evidenceReadiness.ts:18-38`. |
| FR-11 | Invariant-failure path has no user remediation | **FOLDED.** User-facing text and runbook line added; no "force push" offered. (§2.5) |

---

## Sources

Code citations are `file:line` at `4bce1fda`. External sources used in §2.5:

**`[FR-6]` No page on `developer.xero.com` fetched from this environment, during the Rev 1 pass or the independent review pass. Every row below is grade B — secondary-corroborated — not grade A.**

- [OAuth 2.0 FAQs — Xero Developer](https://developer.xero.com/faq/oauth2) — token lifetimes, rotation, grace period (**B**, was A in Rev 1)
- [Limits FAQs — Xero Developer](https://developer.xero.com/faq/limits) — daily and concurrency limits, headers, 429 (**B**, was A in Rev 1)
- [Idempotent requests — Xero Developer](https://developer.xero.com/documentation/guides/idempotent-requests/idempotency/) — `Idempotency-Key`, 128 characters ([VERIFY BEFORE BUILD] — Jay, with D2)
- [Accounting API Invoices](https://developer.xero.com/documentation/api/accounting/invoices) and [Attachments](https://developer.xero.com/documentation/api/accounting/attachments) — endpoint shapes ([VERIFY BEFORE BUILD]; **agent-fetchable alternative: `XeroAPI/Xero-OpenAPI` `xero_accounting.yaml` on GitHub, and `xeroapi.github.io/xero-node`**)
- `POST https://identity.xero.com/connect/revocation` — token revocation ([VERIFY BEFORE BUILD] on request shape; existence corroborated via `developer.xero.com/documentation/guides/oauth2/pkce-flow` snippet and `xero-ruby` issue #67) `[FR-2]`

Internal documents: `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` (Rev 1.2a) · `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md` (Rev 1.2a) · `docs/plans/f0-execution-spec-2026-07-24.md` (Rev 3.1 — **note: `:80` and `:115` carry a superseded 2s budget, §4.1**) · **`docs/plans/f0-5-benchmark-results-2026-07-26.md` (all four sections — the authority on every claim-path performance figure in §4, and absent from Rev 1's Sources) `[FR-B1]`** · **`backend/scripts/bench-f05.ts` (`:608-611` — the authoritative budget constant)** · `docs/plans/2026-07-02-xero-export-v0-design.md` · `docs/research/xero-integration-research-and-spec-2026-07-02.md` · **`docs/plans/wave-f0-threat-model-2026-07-31.md` (build-blocking for F3, authored in parallel) `[FR-B9]`** · `docs/plans/wave-e0-threat-model-2026-07-28.md` (format precedent, 1,172 lines) · `docs/reviews/fable-deep-review-2026-07-28.md`

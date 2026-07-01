# Xero Integration — Market Research + v1 Spec

**Status:** research complete; implementation-ready v1 scope. Hand to a dev agent.
**Date:** 2026-07-02
**Author context:** SiteProof v3, progress-claims module.

---

## 0. The one thing to understand first

**SiteProof is a data-compilation tool, NOT a financial/accounting tool.** It
captures what happened in the field (which lots, what % complete, backed by
ITP/test/hold-point evidence) and hands that data off. **Xero is the money
system.** It owns GST, the ledger, retention accounting, the actual invoice that
goes to the client.

The Xero integration is the bridge: it turns a compiled progress claim into a
**draft invoice in Xero** with the evidence attached, and (fast-follow) pulls
the **payment status back** so the claim self-updates when the client pays.

**Do NOT build inside SiteProof:** GST calculation, retention waterfalls,
statutory-endorsement/SOPA-validity logic, or any "source of truth for the
money" behaviour. Every one of those belongs in Xero. (See
`docs/research/progress-claim-output-spec.md` — that spec described building a
compliant claim generator; it is now **out of scope** as written. This doc
supersedes its "build the money engine" recommendation.)

---

## 1. Market research — what established players do

Two archetypes exist in this space. SiteProof is the **second** one (a
field/records system, not a commercial/estimating system).

| Tool | What it is | How it bridges to Xero |
|---|---|---|
| **Payapps** | Progress-claim specialist (AU) | Claim submit/approve → **auto-creates a Xero invoice with the claim PDF attached**; user *nominates* the trigger (on submission vs on approval); models variations + retention on its own side |
| **Procore** | Enterprise construction PM | Progress claims → Xero; handles retention/retainage, cost codes, tracking categories; "one source of truth" |
| **Planyard** | Job-costing / subcontractor claims (AU) | Tracks retention booked/released + variations; syncs to Xero; GST-inclusive or exclusive |
| **Buildxact** | Builder job management | **2-way sync; invoices land as DRAFT by default (configurable); watches Xero and marks the invoice partially/fully paid when payment is recorded there** |
| **Simpro** | Field-service / trades ops | 2-way; apply payment in either system, transfers both ways; one-click |
| **Sitemate / Dashpivot** | **Site records & forms (closest analogue to SiteProof — not accounting)** | Pushes field data to Xero via a no-code layer (Flowsite); positions itself as field-data → accounting |
| **Assignar** | Civil field ops | **Cautionary tale** — promised accounting integration, under-delivered; public reviews cite it "never successfully integrated" |

**Closest models for us: Buildxact + Sitemate.** Capture field reality → push to
Xero → pull payment back.

### 1.1 What consistently WORKS (adopt these)

1. **Push as a DRAFT invoice by default.** Buildxact invoices "land in Draft
   status and need to be approved" (configurable to land approved). A human
   reviews in Xero before it's sent → keeps us out of "we sent a wrong invoice"
   liability. This is also Xero's own recommended default for third-party apps.
2. **User-chosen trigger.** Payapps lets the user nominate *on claim submission*
   vs *on approval*. Make it a per-company setting; don't hard-code the moment.
3. **Attach the claim/evidence PDF to the Xero invoice.** Payapps attaches the
   claim PDF. **This is SiteProof's unique wedge** — we are the only party that
   can staple the ITP / test / hold-point proof to the invoice, because we're
   the only one holding it. No pure-accounting bridge can do this.
4. **Payment sync-back (Xero → SiteProof).** Buildxact and Simpro both do it and
   users rate it highly: when the invoice is paid in Xero, the claim auto-marks
   paid. Removes the manual "Record Payment" step SiteProof has today.
5. **Contact mapping with link / create / reuse.** Buildxact handles three cases
   (new contact, first-time link, already linked) so it never spawns duplicate
   customers.
6. **Account code + GST tax-type mapping with a default + override.** Set a
   default income account + GST tax type once per company; Xero applies the GST.
   SiteProof never computes tax.
7. **Tracking categories = one per project.** Buildxact/Procore tag each invoice
   with the job so the HC can report by project in Xero. High value for our
   users (they run 15–20 concurrent projects), nearly free to add.
8. **A visible sync log / error surface.** Buildxact has "View Log." Integrations
   fail; a *silently* failed push is exactly the "success lies" failure mode
   flagged in our own audits — surface it.

### 1.2 What to AVOID (from the losers + complaints)

- **The Assignar trap:** a half-working integration is worse than none — it burns
  trust with the exact paying customers (head contractors) we're courting. Ship
  it reliable or don't ship it.
- **Rounding drift:** Buildxact calculates to 4dp, Xero rounds to 2dp →
  mismatches. Round to cents *before* pushing (we already have
  `roundClaimAmountToCents`, `workflowValidation.ts:173`).
- **Duplicate / archived contacts** breaking sync.
- **Silent sync failures.**
- **Retention in the accounting sync is messy** — Buildxact punts it entirely to
  the accounting side. Payapps/Procore model it because they *are* commercial
  tools. Given our philosophy, **punt retention** (or offer a single optional
  deduction line later), don't build the waterfall.

---

## 2. SiteProof's current claim model (grounded — what the dev builds on)

- **`ProgressClaim`** (`backend/prisma/schema.prisma:1245`): `claimNumber`,
  `claimPeriodStart/End`, `status` (draft→submitted→certified→paid, plus
  disputed/partially_paid), `totalClaimedAmount`, `certifiedAmount`, `paidAmount`,
  `evidencePackageUrl`, `disputeNotes` (⚠️ overloaded JSON — see §7),
  `sopaStatementGenerated`.
- **`ClaimedLot`** (`schema.prisma:1279`): one row per lot on the claim —
  `lotId`, `quantity`, `unit`, `rate`, **`amountClaimed`**,
  **`percentageComplete`** (this claim's increment), `evidencePackageUrl`, `notes`.
  Unique on `[claimId, lotId]`.
- **Line amount math** (`backend/src/routes/claims/workflowRoutes.ts:206-212`):
  `amountClaimed = lot.budgetAmount × thisClaimPercent / 100`. Every claimed lot
  is guaranteed to have a `budgetAmount` (creation is blocked otherwise, feature
  #894, `workflowRoutes.ts:178-193`) → **every invoice line always has an amount.**
- **Cumulative + partial claiming** (`workflowRoutes.ts:195-284`,
  `cumulativeClaims.ts`): a lot can be claimed across multiple claims over time;
  each claim bills only its increment; an over-claim past 100% is rejected under
  a row-level `FOR UPDATE` lock (`workflowRoutes.ts:70-85`). **This is why the
  same lot can legitimately appear on more than one invoice** (see §3.2).
- **All amounts are stored EX-GST.** There is no GST or retention anywhere in the
  model today — correct, because Xero owns GST.
- **Current output** (the thing we're replacing/augmenting): a single-row summary
  CSV (`frontend/src/pages/claims/components/ClaimsTable.tsx:131-164`).
- **Payment recording today is manual:** `POST /:projectId/claims/:claimId/payment`
  (`backend/src/routes/claims/postEvidenceWorkflowRoutes.ts:267`), driven by
  `RecordPaymentModal.tsx`. Supports partial payments (`partially_paid`).
- **Jurisdiction/SOPA timing** already exists (`sopaBusinessDays.ts`,
  `constants.ts` `SOPA_TIMEFRAMES`) — not needed for Xero, but `Project.state`
  is available if we ever want it on the invoice reference.
- **Identity fields available:** `Project.clientName` (free text — the client),
  `Project.contractValue`, `Company.abn` (the *claimant's* ABN, not the client's),
  `Lot.lotNumber`, `Lot.activityType`.

---

## 3. THE CORE — claim → Xero invoice mapping

### 3.1 Granularity: one CLAIM = one INVOICE, many LINES

**This is the load-bearing rule.** A single project has many lots. A claim can
span **several lots / sections of the same job at once**, each at a different
% complete. All of those lots belong to **one claim**, and that one claim maps
to **exactly one Xero invoice** with **one line item per claimed lot**.

```
Project "Northern Interchange" (has 40+ lots open)
   │
   └── ProgressClaim #5  (June period)  ─────────►  ONE Xero DRAFT invoice
         ├── ClaimedLot: Lot 12 Bulk Earthworks   →  line 1
         ├── ClaimedLot: Lot 18 Drainage Ch0–200  →  line 2
         └── ClaimedLot: Lot 23 Kerb & Channel    →  line 3
```

Worked example (amounts ex-GST):

| Invoice line | From ClaimedLot | This-claim % | Cumulative % | Line amount |
|---|---|---|---|---|
| Lot 12 — Bulk Earthworks | budget $100,000 | 40% | 100% (final) | $40,000 |
| Lot 18 — Drainage Ch0–200 | budget $50,000 | 25% | 25% | $12,500 |
| Lot 23 — Kerb & Channel | budget $15,000 | 60% | 85% | $9,000 |
| **Subtotal (ex-GST)** | | | | **$61,500** |
| GST (added by Xero, 10%) | | | | $6,150 |
| **Invoice total** | | | | **$67,650** |

→ **One** draft AR invoice, contact = the project's client, **3 line items**,
project tracking category = "Northern Interchange", claim evidence-pack PDF
attached.

### 3.2 Partial/cumulative claiming across invoices (must not confuse the client)

Because claiming is cumulative, the **same lot reappears on later claims** for
its next increment — so it appears as a line on **multiple invoices** over the
life of the job. Each invoice bills only that claim's increment.

```
Claim #5 → Invoice A:  Lot 18 @ 25%  ($12,500)
Claim #6 → Invoice B:  Lot 18 @ +30% ($15,000)   ← same lot, new increment, new invoice
Claim #7 → Invoice C:  Lot 18 @ +45% ($22,500)   ← final; lot now 100%, flips to `claimed`
```

**Line-item descriptions must make the increment explicit** so the client
doesn't think they're being double-billed for "Lot 18." Recommended description
format per line:

```
Lot {lotNumber} — {activityType} — this claim {thisPct}% (cumulative {cumPct}%)
e.g. "Lot 18 — Drainage Ch0–200 — this claim 30% (cumulative 55%)"
```

The `cumPct` is derivable from `getCumulativeClaimedPercentByLot`
(`cumulativeClaims.ts`) at send time.

### 3.3 Xero invoice field mapping (Accounting API — verify against current API)

| Xero invoice field | Value from SiteProof |
|---|---|
| `Type` | `ACCREC` (accounts receivable / sales) |
| `Status` | `DRAFT` by default (per-company setting can allow `AUTHORISED`) |
| `Contact` | linked Xero contact for the project's client (see §4) |
| `LineAmountTypes` | `Exclusive` (our amounts are ex-GST; Xero adds GST) |
| `Reference` | `Claim #{claimNumber} — {Project.name}` (ties invoice back to SiteProof) |
| `Date` | claim period end or send date (decision — §9) |
| `LineItems[]` | **one per `ClaimedLot`** (§3.1/§3.2) |
| — `Description` | the format in §3.2 |
| — `Quantity` | `1` (line amount carries the value; we bill % of budget, not units) |
| — `UnitAmount` | `ClaimedLot.amountClaimed` (rounded to cents) |
| — `AccountCode` | default income account from the connection config (overridable) |
| — `TaxType` | default GST-on-income tax type from config (Xero computes GST) |
| — `Tracking` | project tracking-category option = `Project.name`/code |
| `Attachments` | the claim evidence-pack PDF (`ProgressClaim.evidencePackageUrl`) |

**Invariant to assert before send:** `sum(LineItems.UnitAmount) ==
roundClaimAmountToCents(ProgressClaim.totalClaimedAmount)`. If they don't match,
**block the send and surface it** — never push a subtly wrong total.

### 3.4 Grouping (deferred / config, not v1)

Default is **one line per lot** (maximum transparency, and each line maps 1:1 to
its evidence). A later option can group lines by `activityType`/section or
collapse to a single summary line for clients who prefer a terse invoice. Keep
the per-lot data internally regardless.

---

## 4. Contacts (client ↔ Xero contact)

`Project.clientName` is **free text**, so name-matching alone is fragile (typos,
"Pty Ltd" vs "P/L"). Follow Buildxact's link/create/reuse pattern:

- On first "Send to Xero" for a project, prompt the user to **link to an existing
  Xero contact** (search Xero contacts) or **create a new one**.
- Persist the chosen `xeroContactId` against the project (or a mapping table).
- Reuse it silently on subsequent claims for that project.
- Optionally seed the new-contact form with `Project.clientName`.

ABN of the client is not modelled today; leave it to be filled in Xero, or add an
optional `Project.clientAbn` later if users want it on the contact.

---

## 5. Connection model (per-company OAuth2)

**Decision (confirmed with product owner): the Xero connection is per-company
(per SiteProof organization / tenant), not per-project.** One head contractor
connects their Xero org once; all their projects' claims flow through it.

New table **`XeroConnection`** (one active row per SiteProof organization):

| Field | Notes |
|---|---|
| `organizationId` | FK to the SiteProof tenant (the head contractor) |
| `xeroTenantId` | the connected Xero org id |
| `accessToken` / `refreshToken` | **encrypted at rest** (reuse the app's `ENCRYPTION_KEY` / encryption lib) |
| `tokenExpiresAt` | access token ~30 min; refresh proactively |
| `connectedByUserId`, `connectedAt` | audit |
| `status` | `connected` / `expired` / `revoked` / `disconnected` |
| `defaultAccountCode` | income account for claim lines |
| `defaultTaxType` | GST-on-income tax type |
| `invoiceStatus` | `DRAFT` (default) / `AUTHORISED` |
| `trigger` | `on_submit` / `on_approve` |
| `paymentSyncEnabled` | bool (§6) |
| `trackingCategoryId` | the Xero tracking category used for "project" (optional) |

On **`ProgressClaim`** add: `xeroInvoiceId`, `xeroInvoiceStatus`, `xeroSyncedAt`,
`xeroSyncError`.

**OAuth2 mechanics** (use the official `xero-node` SDK — do not hand-roll):

- Authorization-code flow **with PKCE**; redirect URI registered in the Xero
  developer app.
- **Scopes:** `openid profile email offline_access accounting.transactions
  accounting.contacts accounting.settings` (`offline_access` is required for the
  refresh token; `accounting.settings` to read accounts + tax rates for the
  mapping dropdowns).
- **Token refresh:** access token expires ~30 min; refresh token rotates on every
  refresh — **always persist the new refresh token** or the connection dies.
  Refresh proactively before a push, and handle a failed refresh by flipping
  `status=expired` and prompting reconnect.
- **Tenant:** after auth, resolve the tenant id from the connections endpoint and
  store it; send it on every API call.
- **Rate limits (verify current):** ~60 calls/min and a daily cap per tenant, plus
  a concurrency limit — batch/minimise calls (a claim push should be a small
  fixed number of calls: ensure-contact, create-invoice, attach-PDF).
- **Reconnect UX:** a clear "Reconnect Xero" path in company settings when the
  token is revoked/expired.

**Security:** tokens are secrets — encrypt at rest, never log them, never expose
to the frontend. Only surface connection *status* to the client.

---

## 6. Payment sync-back (fast-follow, high value)

When the invoice is paid in Xero, mark the SiteProof claim paid — killing the
manual `RecordPayment` step.

- **v1 mechanism: polling** (simpler than webhooks). A scheduled in-process
  sweep (reuse the existing worker pattern from the data-retention sweep) checks
  the status of invoices for claims that have a `xeroInvoiceId` and aren't yet
  fully paid. Xero exposes invoice `Status` (`PAID`), `AmountPaid`, `AmountDue`.
- **Enhancement: Xero webhooks** for invoices (real-time; requires a public
  endpoint + "intent to receive" validation). Defer unless polling proves too
  slow.
- **Apply the payment through the existing path**, don't write `paidAmount`
  directly — reuse the additive payment logic in
  `postEvidenceWorkflowRoutes.ts` so the audit log + status transition
  (`certified → partially_paid → paid`) fire consistently. Support **partial
  payments** (Xero can record part payment → `AmountPaid < Total`).
- Record a payment reference identifying it as Xero-sourced (e.g. the Xero
  payment id) for the audit trail.
- **Idempotency:** never double-apply the same Xero payment; track the last-seen
  `AmountPaid` and only apply the delta.

---

## 7. Known data-model hazard to respect (don't make it worse)

`ProgressClaim.disputeNotes` is a **single text column overloaded as JSON** that
already stores three unrelated things: certification metadata (`certifiedBy`,
`variationNotes`, `certificationDocumentId`), payment history
(`paymentHistory[]`), and the plain dispute reason
(`workflowValidation.ts:330-358`, `postEvidenceWorkflowRoutes.ts:332-369`, parsed
in `presentation.ts:103-186`). It works via careful key-merging but the paths can
clobber each other.

- **Do NOT** stuff Xero state into `disputeNotes`. Put `xeroInvoiceId` etc. in
  **dedicated columns** on `ProgressClaim` (§5).
- If payment sync-back writes payment history, go through the **existing** payment
  path so the JSON is merged the same way (don't add a fourth writer).
- (Out of scope but noted: formalising `disputeNotes` into a real
  `PaymentScheduleRecord` table is a separate cleanup — not required for Xero.)

---

## 8. Scope

### v1 (build this)
- Per-company Xero OAuth2 connection + encrypted token storage + refresh +
  reconnect UX (§5).
- Company settings: default income account, GST tax type, invoice status
  (draft/authorised), trigger (on submit/on approve), project tracking category.
- Contact link/create/reuse per project (§4).
- **"Send to Xero"** on a claim → one DRAFT ACCREC invoice, one line per claimed
  lot with the §3.2 description format, ex-GST amounts + GST tax type, project
  tracking, evidence-pack PDF attached (§3.3).
- Idempotent send (store `xeroInvoiceId`; second send links/updates, never
  duplicates).
- Sync status + error surfaced on the claim (no silent failures).
- Total-matches-lines invariant assertion before send (§3.3).

### Fast-follow
- Payment sync-back via polling (§6).
- Configurable line grouping (§3.4).

### Deferred / out of scope
- Retention modelling (leave to Xero / manual).
- GST calculation (Xero's job).
- SOPA-validity / statutory endorsement / supporting statement.
- Xero webhooks (use polling first).
- Variations as credit/negative lines.
- Bills / accounts-payable (subcontractor-up-the-chain) — this is AR only.

---

## 9. Open decisions for the product owner
1. **Invoice date** = claim `periodEnd`, or the send date? (Xero uses it for aged
   receivables.)
2. **Invoice number** — let Xero auto-number, or set `InvoiceNumber` from a
   project code + claim number so it matches the client's expectations?
3. **Trigger default** — `on_submit` or `on_approve`? (Recommend `on_submit`,
   draft status keeps the human gate.)
4. **Retention** — truly out, or a single optional deduction line in a later
   iteration?
5. **Client ABN on the Xero contact** — add `Project.clientAbn`, or leave manual?

---

## 10. Build sequence (for the dev agent)
1. Register the Xero app (dev portal) → client id/secret, redirect URI, scopes.
   Store secrets in backend env (never commit).
2. `XeroConnection` model + migration (reviewed Prisma migration — **no
   `db push`**, per CLAUDE.md ops rules). Add Xero columns to `ProgressClaim`.
3. OAuth2 connect/callback/disconnect routes + encrypted token store + refresh
   helper (TDD the refresh + rotation logic — it's the fragile part).
4. Settings UI: connect button, account/tax/status/trigger pickers (populated
   from Xero `accounting.settings`).
5. Contact link/create/reuse flow + `xeroContactId` persistence.
6. Claim → invoice builder (pure function: claim + claimedLots + config →
   invoice payload; **unit-test the mapping + the total-matches-lines invariant +
   the multi-lot/cumulative description**). Then the send action + PDF attach +
   idempotency.
7. Sync status/error surfacing on the claims page.
8. (Fast-follow) payment-sync poller reusing the retention-sweep worker pattern.

Every step: TDD, and surface failures — a silent Xero error is the "success lie"
failure mode our audits already flagged.

---

## Sources
- Payapps + Xero: https://www.payapps.com/blogs/payapps-xero-integration/ · https://apps.xero.com/au/app/payapps
- Buildxact & Xero (2-way, draft default, payment watch-back, mapping, pitfalls): https://help.buildxact.com/en/articles/8542921-buildxact-and-xero
- Simpro Xero: https://www.simprogroup.com/partners/integration-partners/xero
- Procore Project Financials + Xero (retention/retainage, tracking categories): https://support.procore.com/products/online/user-guide/company-level/erp-integrations/xero · https://www.procore.com/accounting-integrations
- Planyard Xero job costing (AU): https://planyard.com/en-au/xero-job-costing-integration-for-construction
- Sitemate/Dashpivot Xero invoicing (field-data → accounting analogue): https://help.sitemate.com/en/articles/8535164-xero-invoicing-integration
- Assignar reviews (integration cautionary tale): https://www.capterra.com/p/143935/Assignar/reviews/
- Xero create a progress invoice: https://central.xero.com/s/article/Create-an-invoice

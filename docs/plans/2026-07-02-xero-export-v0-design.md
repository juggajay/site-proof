# Xero Export v0 — Design

**Status:** design approved (scope split), ready to plan the build.
**Date:** 2026-07-02
**Supersedes for v0:** the "full v1" scope in
`docs/research/xero-integration-research-and-spec-2026-07-02.md`. That spec stays
the reference for the *deferred* live integration; this doc defines the leaner
first slice we actually build now.

---

## 1. Decision & why

The Xero build is driven by **completing the claims story for demo/sell** — no
specific head contractor is blocked on it today. Given that (and the project's
history of dying at the polish stage rather than shipping), we deliberately
**defer the fragile half** of the full spec and ship the reusable core.

- **Build now (v0):** a pure claim→invoice **mapping function** with the
  total-matches-lines invariant, emitted as a **Xero-importable sales-invoice
  CSV** the user downloads and imports (Xero lands it as Draft → human reviews).
- **Defer** (until a real HC is invoicing through it): per-company OAuth2
  connection, live draft-invoice creation via the API, auto-attaching the
  evidence PDF, and payment sync-back.

**Why this isn't throwaway:** the spec's own build sequence (§10.6) says build
the pure mapping function first and unit-test it *including the invariant*. That
function is identical whether the output goes to a CSV file or the Xero API — v0
is literally step 1 of the real integration with the risky transport deferred,
not a discarded prototype. When demand is real, we keep the tested mapping +
config and swap the output sink from "write CSV" to "call Xero API + attach PDF."

**Honesty constraint:** the wedge that *sells* — the ITP/test/hold-point
evidence PDF stapled to the invoice — lives in the deferred half (CSV import
can't carry attachments). In a demo we may show "compile claim → export → draft
invoice in Xero" and *describe* auto-attach as roadmap, but must not demo
auto-attach as live until it is (don't-fabricate rule).

---

## 2. Scope

### In (v0)
- Backend pure function: `ProgressClaim + ClaimedLot[] + config → invoice rows`.
- Total-matches-lines invariant, asserted server-side before any CSV is produced.
- Per-lot line rows with the cumulative-aware description format (§4).
- CSV generation in Xero's customer-invoice import format (§5).
- "Export to Xero (CSV)" action on a claim in the claims UI.
- Minimal config (income account code + GST tax type) with **no schema change**
  (§6).
- Unit tests on the mapping + invariant + cumulative description; one frontend
  wiring test.

### Out (deferred — see the research spec)
- OAuth2 per-company connection + encrypted token storage + refresh/rotation.
- Live draft-invoice creation via the Accounting API.
- Auto-attaching the evidence-pack PDF.
- Payment sync-back (polling or webhooks).
- `XeroConnection` table and Xero columns on `ProgressClaim`.
- Contact link/create/reuse, tracking-category management, retention, GST math.

---

## 3. Architecture

```
Claims UI (ClaimsTable / claim detail)
  │  click "Export to Xero (CSV)"
  │  (reads last-used account code + tax type from localStorage; small dialog to confirm/edit)
  ▼
GET /:projectId/claims/:claimId/xero-export?accountCode=200&taxType=OUTPUT
  backend/src/routes/claims/xeroExport.ts   ← new thin route (requireAuth + project role)
  │
  ├─ loads claim + claimedLots (with lot budget/number/activityType)
  ├─ computes cumulative % via getCumulativeClaimedPercentByLot (cumulativeClaims.ts)
  ├─ buildXeroInvoiceCsv(claim, claimedLots, cumulativeByLot, config)   ← PURE, tested
  │     ├─ maps each ClaimedLot → one row
  │     ├─ rounds amounts via roundClaimAmountToCents (workflowValidation.ts:173)
  │     └─ asserts sum(rows.UnitAmount) === roundClaimAmountToCents(totalClaimedAmount)
  │           └─ on mismatch → throw 422 (block export, surface the numbers)
  └─ responds text/csv (Content-Disposition: attachment)
```

- **Mapping + invariant + CSV string live on the backend** so the money math and
  the exact Xero header row are both under test. Xero is strict about column
  headers and about `AccountCode` referencing a real account; getting the header
  format wrong fails the whole import, so it belongs in a locked test
  (edge-case-correct beats convenient).
- **Frontend is wiring only:** a button + a small "confirm account/tax code"
  dialog, then hit the route and trigger the download. Reuse the existing
  download plumbing (`@/lib/csv` `downloadCsv`, mirroring `downloadClaimCsv` in
  `ClaimsTable.tsx:131`) or a direct anchor to the route.

---

## 4. Data mapping (per claimed lot → one CSV row)

One `ProgressClaim` = one Xero invoice = many rows (one per `ClaimedLot`). Rows
sharing the same invoice number become that invoice's line items on import.

| CSV field (verify exact header — §5) | Value from SiteProof |
|---|---|
| Contact name | `Project.clientName` (free text; user fixes in Xero if needed) |
| Invoice number | `Claim #{claimNumber} — {Project.name}` (or leave for Xero — §7 open) |
| Invoice date | claim `periodEnd` (open decision, spec §9.1) |
| Due date | per Xero org terms; leave blank or period end + terms (open) |
| Description | `Lot {lotNumber} — {activityType} — this claim {thisPct}% (cumulative {cumPct}%)` |
| Quantity | `1` (line amount carries the value; we bill % of budget, not units) |
| Unit amount | `ClaimedLot.amountClaimed`, via `roundClaimAmountToCents` (ex-GST) |
| Account code | from config (default `200` Sales; user-editable — §6) |
| Tax type | from config (GST-on-income, e.g. `OUTPUT`; Xero computes the GST) |
| Tracking (optional) | `Project.name` — only if we emit a tracking column |

- `thisPct` = `ClaimedLot.percentageComplete`; `cumPct` from
  `getCumulativeClaimedPercentByLot` (`cumulativeClaims.ts:18`) at export time.
- **Invariant (the highest-value check):** before emitting,
  `sum(rows.UnitAmount) === roundClaimAmountToCents(ProgressClaim.totalClaimedAmount)`.
  Mismatch → **block the export with a 422 and show both numbers**; never emit a
  subtly wrong total (the "success lie" failure mode our audits flagged).
- All amounts stay **ex-GST**. SiteProof never computes GST or retention — Xero
  owns them.

---

## 5. CSV format

**Build step 0: verify the exact header set against Xero's current customer-
invoice import template** (`central.xero.com` "Import customer invoices") before
writing the generator — do not hard-code guessed headers. Known constraints from
Xero docs to design around:

- Every CSV-imported sales invoice lands as **Draft** (deliberate Xero safety
  gate — matches our "human reviews before send" requirement; nothing to build).
- `AccountCode` must be the **numeric** code of an existing, non-archived account
  in the org's chart (name won't do) → this is why account code is user-confirmed
  config, not hard-coded.
- **Date format must match the Xero org's General Settings** date format, or rows
  misparse. Emit an unambiguous format and document the assumption; consider
  ISO-ish `dd/mm/yyyy` for AU orgs.
- Multiple rows with the **same invoice number** = line items on one invoice —
  this is how our per-lot lines map to a single claim invoice.
- `TaxType` optional (org default applies if blank) but we set it from config for
  predictable GST-on-income handling.

Lock the emitted header row and a representative multi-lot body in a unit test so
a later "cleanup" can't silently change the format Xero depends on.

---

## 6. Config without a schema change

The deferred full version stores `defaultAccountCode` / `defaultTaxType` on
`XeroConnection`. v0 needs the same two values but **no migration** (CLAUDE.md:
reviewed migrations only, and a table for a deferred feature is premature):

- Collect income **account code** (default `200`) and **GST tax type** in the
  export dialog, prefilled from **localStorage** (`xeroExport.accountCode`,
  `xeroExport.taxType`), remembering the last-used values per browser.
- Passed to the backend as query params on the export request.
- When the full integration lands, these move into `XeroConnection` config and
  the dialog reads from the connection instead — same two values, new home.

`// ponytail:` localStorage config, no table. Promote to XeroConnection when the
live OAuth integration is built.

---

## 7. Error handling & edge cases

- **Invariant mismatch** → 422, response body names claim total vs line sum; UI
  shows it, no file downloads.
- **Empty claim (no claimed lots)** → 422 "nothing to export"; don't emit a
  header-only file.
- **Missing/blank account code** → block with a clear message (Xero import would
  fail anyway); the dialog requires it.
- **`clientName` blank** → still export (user sets the contact in Xero on
  import); optionally warn.
- Amounts already guaranteed present: every `ClaimedLot` has a `budgetAmount`
  (creation blocked otherwise, feature #894), so every line has an amount.

## 8. Open decisions (inherit from spec §9 — pick before build, not blockers)

1. Invoice date = claim `periodEnd` (recommended) vs export date.
2. Invoice number = set from `Claim #{n} — {project}` (recommended, ties back)
   vs let Xero auto-number.
3. Whether to emit a tracking-category column in v0 (recommend: skip; add with
   the live integration).

Recommend defaults in parentheses; confirm with product owner (Jay) in planning.

---

## 9. Testing

- **Backend unit** (`xeroExport` mapping): single lot; multi-lot claim; cumulative
  description string (`this claim X% (cumulative Y%)`); rounding to cents;
  **invariant pass**; **invariant fail → throws 422**; empty claim; ex-GST (no
  GST appears anywhere).
- **CSV format test:** exact header row + a two-line-item body snapshot (frozen
  so format drift fails loudly), TZ-stable assertions only.
- **Frontend:** one wiring test — button present for a claim, dialog remembers
  localStorage values, request fires with the chosen codes. (Mirror existing
  claims-table test patterns.)

## 10. Build sequence

1. Verify Xero customer-invoice CSV header set + date-format rules (§5).
2. Pure `buildXeroInvoiceCsv(claim, claimedLots, cumulativeByLot, config)` +
   invariant, TDD (§9) — this is the reusable core.
3. Thin route `GET /:projectId/claims/:claimId/xero-export` (requireAuth +
   project role), wiring the pure fn to loaded claim/lot/cumulative data;
   register in `backend/src/index.ts`.
4. Frontend export button + account/tax-code dialog + download wiring; one test.
5. Fallow audit on the diff; PR with the honesty caveat noted.

## 11. What carries into the deferred live integration

- `buildXeroInvoiceCsv`'s mapping + invariant + description logic → reused as the
  invoice-payload builder for the Accounting API (swap CSV row emit for
  `LineItems[]`).
- The account-code / tax-type config → moves from localStorage into
  `XeroConnection`.
- Nothing about OAuth, tokens, contacts, tracking, or payment sync-back is built
  here — all of that stays as designed in the research spec, added when a real
  head contractor pulls it.

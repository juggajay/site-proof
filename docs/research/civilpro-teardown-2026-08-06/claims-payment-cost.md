# CivilPro — Payment / Progress Claims / Cost Management / Schedule

Sources: `bundles/claims-payment-cost.md` (23 KB articles, Zendesk KB, updated 2023-12 → 2026-06),
`transcripts/pYyG_kQS93M.txt` (Progress Claim from Lot Quantities), `transcripts/wLd4vHmenT4.txt`
(Progress Claim without Lot Quantities). Articles suffixed `(D)` are **Desktop V11 only**; unsuffixed
articles are CivilPro Cloud. That split is load-bearing — see §5.

---

## 1. Feature inventory (mechanics)

### 1.1 Schedule Items ("Payment Items") — the contract spine

Source: *Schedule Items*, *Add Schedule Items*, *Add Schedule Items (D)*, *Insert and Re-order Schedule Items (D)*

The Payment Schedule is set up at project start and is a hard prerequisite for recording quantities
against lots and for any claim. Fields per item:

| Field | Notes |
|---|---|
| Schedule Number | Sort/identity key. Editable. |
| Description | |
| Qty Scheduled | |
| Unit | |
| **DJC Rate** | Direct Job Cost rate = the *budget* rate. Optional. |
| **Sell Rate** | The contract rate paid by the client. |
| DJC Total / Sell Total | Auto-computed = Qty × rate. |
| Markup | Derived column, computed from DJC vs Sell on import. |
| Placed Under | Parent item — builds a collapsible parent/child tree. |
| Order ID | Numeric; drives "Force re-order". |

Two orthogonal type flags, both settable from the schedule *or* from inside a claim:

- **Pay item vs Overhead item** (in claim UI: "Claimed" / "Not Claimed"). Overhead items have no sell
  rate, never appear on the client-facing claim, and exist only to carry a DJC budget for internal
  reporting.
- **Fixed Rate vs Variable Rate.** Fixed = only the quantity changes claim to claim; the rate is
  immutable. Variable = both rate and quantity are editable per claim. Variable exists specifically
  for lump-sum variations (*Progress Claim Concepts and Terms* gives the canonical example: a private
  access variation done on dayworks, 1 × LS at $3,500 in August, same 1 × LS at $5,500 in September —
  quantity unchanged, rate changed).

Colour code, used identically in the schedule and in the claim grid:

| | Fixed Rate | Variable Rate |
|---|---|---|
| **Claimed** | White | Blue |
| **Not Claimed** | Green | Yellow |

Schedule maintenance tools (*Add Schedule Items*, *Insert and Re-order Schedule Items (D)*):
- **Import from CSV or clipboard**, with a per-column header-mapping step (Schedule Number,
  Description, Qty Scheduled, Unit, DJC Rate, Sell Rate). Cloud supports paste-from-Excel directly.
- **Define Headings** — bulk-mark rows as headings by rule: "Set Rows with 0 Sell Rate to Headings" /
  "Set Rows with 0 Quantity to Headings". A heading is an item with no qty and no rate.
- **Create Structure** — drag-drop or `Ctrl+Right/Left Arrow` to indent/outdent into parent/child.
  Drop-target colour is semantic: green arrow = indent as child, blue arrow = reorder.
- **Prepend Characters / Strip Leading Characters** — for projects with two schedules (Schedule A and
  B), bulk-prefix item numbers with an identifier, optionally including sub-items.
- **Force re-order** — re-sequence by Order ID.
- The schedule is **locked by default**; you must explicitly "Unlock schedule" + "Enable Editing"
  before structural edits. Deliberate friction against accidental reorganisation.
- Related Items on a schedule item: Quantities, ITPs/Specifications, Work Types, Cost Codes (desktop
  only), Variations.

### 1.2 Quantities Register — the QA↔money bridge

Source: *Quantities Register*, *Assign Quantities to Lots / Add Floating Quantities*, *Statusing Quantities*

Two quantity types:

- **Lot Quantity** — has a Lot reference, links a Lot to a Schedule Item. "nearly all quantities are
  added in CivilPro" this way, usually from the Related Items panel of the Lot Register.
- **Floating Quantity** — no Lot reference, carries a free-text description instead. For claimable
  items with no work-lot behind them: "Preparation of Environment Management Plan", "Site Office
  Provision". Documented pattern: on a 10-month contract, either add a new floating qty of 0.1 each
  month claimed at 100%, or hold a single qty of 1 and step its % complete by 10% monthly. Floating
  quantities can only be created from the Quantities Register, never the Lot Register.

Per-quantity fields: Type, Schedule Item, Lot, Description (floating only), Quantity, **Preliminary**
(flag meaning "estimate, unconfirmed"), **Non-Claimable**, **Reduced Payment Factor**, Comments,
% Complete. Entry helpers: blue shortcut buttons to set qty = full schedule quantity or = remaining
schedule quantity.

**The Effective Quantity formula** (the single most important mechanic in the whole module):

```
Effective Quantity = Quantity × Effective % Complete × RPF × NC
```

- **Effective % Complete** — for Lot Quantities this *defaults to the Lot's % complete*, driven from
  the Lot Register. Conformed or Guaranteed lots are **always 100%**; Open lots default to **0%**.
  Individual lot quantities can be overridden manually, in which case the row turns **orange**;
  "Revert % compl to Lot %" restores the link. Floating quantity % is always manual, hence always
  orange.
- **RPF — Reduced Payment Factor.** For work conditionally accepted at a reduced level of service.
  Worked example from *Quantities Register*: footpath specified at 25 MPa, placed at 20 MPa, client
  conditionally accepts at a 5% discount → RPF = 95%. Default 100%.
- **NC — Non-Claimable.** Track a quantity for QA purposes but exclude it from the claim. Documented
  case: stockpile quantities you need for QA but are only paid for once installed.

Status-specific expansion (*Progress Claim Concepts and Terms*):

```
Open lots:                Eff Qty = lot qty × lot % complete × lot qty % complete × RPF × NC
Conformed / Guaranteed:   Eff Qty = lot qty × RPF × NC
Rejected lots:            included in the snapshot only if rejection date > cutoff date
```

### 1.3 Progress Claims

Source: *Progress Claim Register*, *Progress Claim Concepts and Terms*, *Create Progress Claims*,
*Create Progress Claims (D)*, *View, Update and Generate Reports for Progress Claims* (+ `(D)`), both transcripts

**Claims are project TO DATE**, not periodic. CivilPro states this repeatedly and justifies it as
industry standard and as the basis on which contractor and client reconcile. The periodic value is
*derived*: `Periodic Qty (this claim) = Quantity to date − Previous period certified qty`.

**A claim is a frozen copy of the schedule** taken at creation. This is stated explicitly in both the
KB and the transcripts: "when CivilPro creates a progress claim it takes a copy of the schedule".
Consequences drive three explicit repair operations (§2.4).

Claim quantities can be sourced three ways:
1. **QA-backed / lot-based** — computed from a Lot Quantity *snapshot*.
2. **Directly entered** — manual grid entry (transcript `wLd4vHmenT4` demonstrates this path end to end).
3. **Copied from previous claim** — "Set to previous period claim qty" or "Set to previous period cert qty".

The claim detail grid has 4 pinned left columns (the schedule) and scrollable right-hand **bands**:
Previously Certified · Certification · To Date · This Claim. Hidden by default and available via
column chooser: **Forecast**, **At Completion**, **To Complete**, **Admin**.

Pre-baked views (*View, Update and Generate Reports…*): **Standard** (prev claimed / certified / claim
qty + Diff), **Min**, **Earned** (QTD, O/U adjustment, Actual Qty), **Forecast** (QTD, value to date,
QAC, sell rate at completion, total value at completion), **Budget** (prev qty, QTD, over/under,
actual qty, forecast qty against DJC rates), **All**.

Claim-level financial inputs typed directly into the Summary Panel: **Security**, **Retention**,
**Paid this claim**. Everything else on the panel is computed.

**Claim value formulas** (*Progress Claim Concepts and Terms*):

```
Value          = QTD × Sell Rate
Budget         = QTD × DJC Rate
Periodic Qty   = QTD − previous certified qty
Earned budget  = (QTD − Over/Under Qty) × DJC Rate
Revenue at completion = QAC × Sell Rate
Budget at completion  = QAC × DJC Rate
```

**Over/Under Qty (O/U)** is a distinct concept from certification: it records what was *actually*
built where that differs from what was *claimed*, so earned-value reporting stays honest even while
the contractor deliberately over-claims. The KB calls the deliberate case "overclaim" and the
Cashflow report lists it under **Risk**.

**Quantity at Completion (QAC)** is carried forward automatically from the previous claim on creation
and edited via the Forecast view. It is the *only* revenue estimate in the entire system (§1.6).

### 1.4 Certification / payment certificates

There is **no separate payment-certificate object**. Certification is a column band inside the claim:
the client's representative certifies quantities offline, and the contractor transcribes them into
the Certification–Qty column. The efficiency mechanic is **"Set Certified = Claimed"** — bulk-set all
certified quantities equal to claimed, then hand-edit only the exceptions. Certified quantities then
feed the next period's periodic calculation and can be switched on in reports via **"Use Certified
Quantity"**.

### 1.5 Cost Management (Desktop only)

Source: *Cost Management Concepts (D)*, *Daycosts (D)*, *Invoices (D)*, *Purchase Orders (D)*,
*Receipting Purchase Orders (D)*, *Cost Codes (D)*, *Suppliers (D)*, *Project Suppliers (D)*, *Resources (D)*

Four registers — **Daycosts, Invoices, Purchase Orders, Forecasts** — tied together by two concepts:

**Reporting Periods.** One period spine shared by Progress Claims, Daycosts, Invoices and Forecasts,
so cost and revenue are comparable within a period. Fields: Reporting Period End Date, Claim Cutoff
Date, Reporting Period Name (defaults to month/year). **Creating a new reporting period immediately
locks all previous periods** across Invoice/Daycost/Forecast registers; locking is toggled
independently per register. Visual cues: a large lock watermark behind the register plus a checked
column in the period grid.

**Daycosts** — the daily record of Resources used. Fields: Date, Supplier, Resource, Resource Type
(Plant/Labour/Materials/Subcontract), **Cost Code**, Qty, Unit, Rate, Total, *Not invoiced*, *Docket
reference* (free text), *Not accrued*, Notes. Power-user tooling: smart copy/paste across days with
optional collapse of previously split lines; **Split Daycost** (split out a quantity / split out % /
create N equal quantities) to allocate one resource-day across multiple cost codes; **Ditto** ("new
daycost like this"); Move Daycost to another period or project; bulk "tag internal".
A **Production Register** summarises cost by cost code and date and computes a production rate once a
production quantity is entered.

**Critically: "When Civil Pro reports its costs, it uses the Daycost register NOT the Invoices."**
The stated reasoning (*Cost Management Concepts (D)*): daycosts allocate cleanly to cost codes, are
timely (<1 day old vs ~45 days for invoice processing), and capture costs for which no invoice has
arrived yet. Daycosts are categorised as Reconciled / Not Invoiced / **Accruals** (no invoice yet but
one is expected — automatic) / **Unaccrued** (tagged "no accrual").

**Invoices** — imported as CSV from the user's accounting system (MYOB, Quicken, Dynamics is the
stated list); CivilPro explicitly does *not* handle payment or accounting. Fields include Amount (ex
GST), PO Reference, Approved By, Approval Date. Computed reconciliation fields:

```
Accounts Total = Invoice total − dispute total + retention total
CivilPro Total = Daycost total + adjustment total
Misclose       = Accounts total − CivilPro total
```

**Invoice reconciliation** matches each invoice to daycosts in an "Invoice Reconciler" (assigned
daycosts on top, unassigned below, chevron button to promote). Residual difference must be explained
as one of three things: a **Daycost Adjustment** (adds a new cost line — "by far the most common"),
an **Invoice Dispute** (keeps the invoice at its legally submitted value while not booking cost the
contractor disputes), or a **Subcontract Retention**. Invoices can only be approved at zero misclose.
Invoices can be split across projects by amount / % / N equal parts. Invoice PDFs can be bulk-matched
to invoice records by filename convention `Supplier Name_Invoice Ref` (*Attach Image / PDF to Invoice (D)*).

**Purchase Orders** — configurable PO numbering template (`#POI(n)` = padded index, `#CPN(n)` =
trimmed contractor project number; default `#CPN(5)-#POI(5)` → `CP123-00001`), with collision-avoiding
index increment. **Role-based approval limits**: each role has a value limit, a user's limit is the
max across their roles on that project, and the UI shows *Not Approved (No Value)* / *Not Approved
(Outside Limit)* / *Not Approved (Can Approve)*. Unapproved POs are red and print with an "unapproved"
watermark; approved POs are green and fully read-only. PO line items support a **Rate Only** flag
(qty and total omitted from the printed PO but still required for approval valuation) and can
auto-create a Resource of a chosen type. **Receipts** record partial delivery against a PO (Qty,
Qty to Date, Qty Remaining) and can auto-generate Daycosts either summarised or line-by-line —
CivilPro actively checks receipt↔daycost agreement on form exit.

**Cost Codes** — the allocation layer between schedule (revenue/budget) and daycosts (actual cost).
A schedule item is distributed across one or more cost codes by percentage and **must total 100% to
save**. An `Excl. Qty` flag stops a schedule item's quantity contributing to a cost code's budget
quantity. Bulk helpers: "Create cost codes to mirror schedule" (one code per non-heading item, 100%
allocated) and "Match to schedule by code".

### 1.6 Forecasts (Desktop only)

Source: *Forecasts (D)*

One forecast per reporting period, one row per cost code plus an **Unassigned** row. Four bands:
cost code details · to date (beige) · to complete (blue) · at completion (green).

The design premise, stated plainly: **"there is absolutely no estimation of revenue in the forecast.
This is because it is already known."** Revenue at completion falls out of QAC × sell rate from the
claim. Only *cost to complete* is estimated. Everything else is derived:

```
Cost to date        ← Daycost register (incl. invoice reconciliation adjustments)
Cost to complete    ← the ONLY estimated input
Cost at completion  = cost to date + cost to complete
Revenue/Budget to date       ← claim QTD (incl. under/overclaim) × rates
Revenue/Budget at completion ← claim QAC × rates
Revenue/Budget to complete   = at completion − to date
Budget variance = budget − cost
Gross margin    = revenue − cost
```

Cost-code revenue/budget rollup:

```
CC Revenue To Date = Σ (SIAlloc × PeriodQTD × SellRate)
CC Budget To Date  = Σ (SIAlloc × (PeriodClaimQty − PeriodOverclaim) × DJCRate)
CC Revenue At Completion = Σ (SIAlloc × PeriodQAC × SellRate)
CC Budget At Completion  = Σ (SIAlloc × PeriodQAC × DJCRate)
```

(`PeriodQTD` uses the **certified** quantity if any certification exists in the claim, else the
claimed quantity.) The article carries a full worked two-item / two-cost-code example.

**Cost to Complete methods**, per cost code: *Revised budget* (assume remaining work runs on budget),
*Rate to date* (assume remaining work runs at the rate achieved so far), *Manual CTC* (direct entry or
a detailed estimate buildup). **QTD methods**: Manual, Sum Actual QTD, Sum Earned QAC (QTD derived as
BTD ÷ adjusted BAC applied to QAC), or Default (QTD = BTD ÷ adjusted BAC as a percentage, QAC fixed
at 1). **Cashflow** requires only a start and end date per cost code, entered via "Cashflow Timing";
a Forecast Cashflow Chart is generated from it.

### 1.7 Variations

Source: *Variation Register*, *Create a Variation*, *Create a Variation (D)*

Fields: VRN Reference (auto from "0001", customisable), Client Reference, Raised by, Description,
Detail, Notes. Estimate captured **twice — Submitted and Approved** — as Quantity / Unit / Rate /
Total, plus **Extension of Time (EOT)**. **Waypoints** track lifecycle status: Identified → Notified →
Submission → Approved, each stamped with a date. Related items: Lots, Photos, Instructions, Schedule
Items, Contract Notices, Filestore Docs.

**Variations are NOT automatically added to the progress claim.** The register offers "New Schedule
from Variation" / "Create New Schedule from Variation", which mints a schedule item you must then
pull into the claim. Also "View/Change Estimate" which produces estimate totals accounting for
quantities and margins.

### 1.8 Reports

Claim presentation: **Progress Claim Cover** (one-page: amount claimed, security/retention/previous
payment adjustments, amount claimed + GST), **Progress Claim** (schedule qty, qty claimed, sell rate,
total), **Progress Claim Detail** (+ previous certified qty/amount, this-claim qty/amount),
**Claim – Completion** (+ to-complete and at-completion qty/amount).

Evidence: **Lot Qty Report (Val)** and **(No val)** — each schedule item with the lots (grouped by
status) that support the claimed quantity, with per-lot qty and optionally value.

Cost vs revenue (desktop only): **Cashflow** (revenue less cash security and retention, costs from
Daycosts, `Free Cashflow = revenue − costs`, plus a **Risk** section listing overclaim and disputed
supplier invoices, plus reconciliations), **Profit and Loss** (`Profit/Loss = earned budget − costs`).

Two report options worth noting: **"Use Certified Quantity"** toggle on all claim presentation
reports, and **Split Date** (§4.6).

---

## 2. UX flows, step by step

### 2.1 Project financial setup (once)
1. Financials Setup → Schedule Items → import CSV/clipboard, map columns (Schedule Number,
   Description, Qty Scheduled, Unit, DJC Rate, Sell Rate).
2. Define Headings by rule (zero qty and/or zero sell rate).
3. Delete empty rows; Create Structure by drag or `Ctrl+Right`; Prepend Characters per schedule.
4. (Desktop) Financials Setup → Cost Codes → "Create cost codes to mirror schedule", or hand-allocate
   each schedule item across codes to 100%.
5. (Desktop) Project Suppliers → tick Include, or "Import Supplier Links" from a previous project.

### 2.2 Booking quantities against work (continuous)
- **From the Lot Register:** select lot → Related Items / chain icon → Quantities → `+` → pick
  schedule item → enter Quantity (or "full schedule qty" / "remaining schedule qty" shortcut) →
  set Preliminary / Non-claimable / RPF → Save.
- **From the Quantities Register:** New Quantity → Type = Lot or Floating → schedule item → lot (or
  description for floating) → quantity → flags → Save.
- **Statusing:** Lot % complete is driven from the Lot Register; conformed/guaranteed force 100%.
  Override an individual quantity in the Quantities register (turns orange) or revert it.

### 2.3 Building the claim (monthly)
1. Payment → Progress Claims → **New Report Period** (End Date, Name). This locks all prior periods.
2. Double-click the period → New Claim dialog: Claim Cutoff Date, Approved/Forecast Completion Date,
   **Previous Report Period** (blank if first claim — this is what makes periodic values work).
3. Choose quantity source: *Use Lot Quantities / Create Quantity Snapshot* Yes/No, and Claim Qty =
   *Do not set* | *Set to quantity snapshot* | *Set to previous period claim qty* | *Set to previous
   period cert qty*.
4. If snapshotting: Snapshot Options — *Show Only Quantities up to Cutoff date*, *Set Claim Qty to
   Snapshot*, and status inclusion tickboxes **Include Open / Guaranteed / Conformed Lots**.
   Documented subtlety: the snapshot always captures *every* lot quantity up to the cutoff regardless
   of status; the status tickboxes only govern which ones total into each schedule item.
5. Desktop prompts **"Unguarantee lots older than 30 days?"** (Yes/No) and then a confirm-quantities step.
6. Enter Retention and Security (cloud wizard does this as a step; desktop via the Summary Panel).
7. Save → claim detail grid opens.

### 2.4 Fixing a claim after upstream changes (the three repair operations)
Both transcripts spend real time on this because the frozen-schedule-copy design guarantees drift.

- **Lot % complete changed** → claim does *not* update. Claim Operations → **Renew Quantity Snapshot**
  → confirm overwrite of existing snapshot → answer yes to "update the claim quantities to match the
  updated snapshot?". Transcript walkthrough: item 9005 sat at qty 1 × 50% = 0.5; editing the lot to
  80% left the claim at 0.5 until the snapshot was renewed, then read 0.8.
- **Schedule changed** (new variation item, renumber, reorder, restructure) → Claim Operations →
  **Update Claim Items from Schedule / Rebuild Claim**, with three independent options: *Add items in
  the schedule but not in the claim*, *Update existing schedule items* (metadata only — never rates or
  quantities), *Delete claim items without matching schedule items*.
- **Item typed wrongly** → right-click → Mark Items → pay item / overhead / fixed / variable, with a
  prompt "Do you want to update the schedule item to reflect these changes in the claim?" so future
  claims inherit the fix. Previous claims are untouched unless rebuilt.

### 2.5 Certification and closing the period
1. Client returns certified quantities offline.
2. Claim Operations → **Set Certified = Claimed**, then hand-edit only the differing rows.
3. Enter *Paid this claim* on the Summary Panel.
4. Update **Quantity at Completion** via the Forecast view (pre-seeded from last period's QAC).
5. Print: Progress Claim Cover + Progress Claim Detail + Lot Qty Report (Val) with a split date.
6. (Desktop) reconcile invoices → daycost adjustments → run Cashflow and P&L → build the forecast.

### 2.6 Variation → claim
New Variation → VRN/Client Ref/Description/Detail → Submitted and Approved estimates + EOT →
waypoints → Save → link Lots/Photos/Schedule Items → Operations → **New Schedule from Variation** →
then rebuild the claim to pull the new item in. Order it correctly in the schedule *before*
rebuilding, because claim ordering is inherited from the schedule copy.

---

## 3. Terminology & data model

**Entities:** Schedule Item · Quantity (Lot | Floating) · Lot · Reporting Period · Progress Claim ·
Claim Item (a copy of a Schedule Item) · Quantity Snapshot · Variation · Waypoint · Cost Code ·
Supplier (Master, system-wide) · Project Supplier (per-project subset) · Resource · Purchase Order ·
PO Item · Receipt · Daycost · Daycost Adjustment · Invoice · Invoice Dispute · Subcontract Retention ·
Forecast · Forecast Estimate (CTC buildup).

**Terms worth adopting or deliberately renaming:**

| CivilPro term | Meaning |
|---|---|
| Schedule Item / Payment Item | Contract pay item |
| DJC Rate | Direct Job Cost = internal budget rate (vs Sell Rate = client rate) |
| Lot Quantity / Floating Quantity | Quantity with / without a lot behind it |
| Effective Quantity | Claimable quantity after % complete, RPF and NC are applied |
| RPF (Reduced Payment Factor) | Discount for conditionally accepted non-conforming work |
| NC (Non-Claimable) | Tracked for QA, excluded from claim |
| Preliminary | Quantity is an unconfirmed estimate |
| Snapshot | Frozen set of lot quantities as at the cutoff date |
| Claim-to-date | Claims are cumulative; periodic value is derived |
| QTD / QAC | Quantity to Date / Quantity at Completion |
| O/U Qty (Over/Under) | Difference between claimed and actually-built quantity |
| Overclaim | Deliberate over-claiming; reported as Risk on Cashflow |
| Earned budget | (QTD − O/U) × DJC Rate |
| Guaranteed (lot status) | Contractor guarantees conformance ahead of paperwork; claims at 100% |
| Certified Qty | Client-approved quantity |
| Misclose | Invoice total vs reconciled daycost total gap |
| Accrual | Cost incurred, invoice expected but not received |
| Waypoint | Timestamped lifecycle status on a variation |
| Reporting Period | Shared time bucket across claims, daycosts, invoices, forecasts |

**The dependency chain — the thing to understand:**

```
Lot conformance status  →  Lot % complete  →  Effective Quantity (× RPF × NC)
   →  Snapshot at cutoff  →  Claim QTD  →  Claim Value (× Sell Rate)
                                        →  Budget (× DJC Rate)
                                        →  Earned budget (− O/U Qty)
   →  Cost Code allocation %  →  CC revenue / budget
   →  Forecast (vs Daycost actuals)  →  Profit & Loss, Cashflow, Gross margin
```

A site engineer marking a lot conformed moves the company's reported gross margin. That single chain
is CivilPro's real moat, not any individual screen.

---

## 4. Strengths worth stealing

**4.1 Effective Quantity as an explicit, named, visible formula.** One line
(`Qty × Eff%Complete × RPF × NC`) that everybody in the business can reason about, exposed as a
toggleable column group ("View → Eff. Qty Calcs"). It makes the QA→claim link auditable rather than
magical. This is a pure data-compiler mechanic and fits SiteProof's positioning exactly: it computes
*claimable quantity*, not money.

**4.2 Reduced Payment Factor.** The missing bridge between an NCR / conditional acceptance and what
gets claimed. SiteProof already has NCRs and hold points; RPF gives conditional acceptance a numeric
consequence that flows automatically. Nobody else in the KB corpus surfaces this. Strong candidate —
and it stays on the quantity side of the money line.

**4.3 Non-Claimable flag.** Lets QA track things (stockpiles, test quantities) without polluting the
claim. Cheap to build, immediately obvious to a user.

**4.4 Snapshot-plus-frozen-schedule-copy semantics.** A submitted claim must not silently mutate when
someone edits a lot next week. CivilPro's answer — the claim is a *copy*, and updating it is an
explicit, named, confirm-prompted operation — is correct and worth copying wholesale. The lesson is
the *explicitness*, not the mechanism.

**4.5 "Set Certified = Claimed", then edit exceptions.** Trivial to implement, removes the single most
tedious hour of the month. Same pattern class as "set qty to remaining schedule quantity".

**4.6 Split Date roll-up on the Lot Qty Report.** Rolls all lot quantities older than a chosen date
(usually the previous claim date) into one summary line per status, listing only recent lots in
detail. Solves the "evidence pack grows unboundedly every month" problem elegantly. The tie-break
rule is well-specified: the date used is the later of last-modified and conformed/guaranteed date;
Open lots are never summarised.

**4.7 Lot Qty Report (Val / No val) itself** — schedule item → the lots that back it, grouped by
status, with quantities. This *is* the data-compiler deliverable. The No-val variant (quantities
only, no dollars) is exactly SiteProof's "no CIVOS-computed $ on evidence docs" rule, already
validated in the market.

**4.8 Floating Quantities.** Prelims, EMP preparation, site office — claimable but not lot-backed.
Any lot-only quantity model breaks on month one without this. Two documented usage patterns (new
0.1 each month vs one qty stepped 10%) show it's been used in anger.

**4.9 Cutoff date + status inclusion as claim filters.** "Include Open / Guaranteed / Conformed" makes
the contractor's aggressiveness an explicit, recorded decision rather than a hidden judgement call.

**4.10 The "Guaranteed" lot status and auto-unguarantee prompt.** An intermediate state meaning "I
guarantee this will conform, let me claim it now" that claims at 100%, plus a prompt at claim time to
unguarantee anything older than 30 days. That's a genuinely clever pressure valve between commercial
reality and QA rigour, with a built-in decay mechanism.

**4.11 Preliminary flag on quantities.** Distinguishes estimate from measured without blocking the claim.

**4.12 Schedule import ergonomics.** Import from clipboard (paste straight from Excel), per-column
header mapping, rule-based heading detection, prepend/strip characters for multi-schedule contracts.
Every civil contractor's schedule arrives as a spreadsheet; this is table stakes done well.

**4.13 Variable-rate items for lump-sum variations.** Recognises that a lump-sum variation's *rate*
moves while its quantity stays at 1. Without this, dayworks variations can't be claimed progressively.

**4.14 Variation dual estimate (Submitted vs Approved) + EOT + waypoints.** Captures the negotiation,
not just the outcome. EOT alongside value is correct for civil.

**4.15 Role-based approval limits with three-state messaging.** "Not Approved (No Value)" /
"(Outside Limit)" / "(Can Approve)" tells the user *why* they can't act. Good pattern for any
SiteProof approval gate, not just commercial ones.

---

## 5. Weaknesses / gaps we can exploit

**5.1 The desktop/cloud split is a chasm.** Every Cost Management article is `(D)` — Daycosts,
Invoices, Purchase Orders, Receipting, Forecasts, Cost Codes, Suppliers, Resources. Cashflow and
Profit-and-Loss reports are explicitly "available on CivilPro Desktop" only. "Update Claim Properties
— please refer to desktop … This function is currently not available in the Web App". A Windows
desktop app in 2026 for the entire cost side means no site access, no tablet, no phone.

**5.2 The UX is a 2010 ribbon-and-grid application.** "Enable Editing" before you can type. "Unlock
schedule" before you can reorder. Column Chooser drag-and-drop to see a number. Right-click context
menus as primary navigation. And this, verbatim from *Add Schedule Items*: *"This view is only
temporary and will return to the default view once you exit the register."* Column layouts don't
persist. There is no mobile story anywhere in the corpus.

**5.3 Snapshot staleness is a silent-wrong-number generator.** Update a lot's % complete and the claim
keeps the old figure until someone remembers to renew the snapshot, confirm an overwrite prompt, and
answer a second prompt about updating claim quantities. The transcript demonstrates this as normal
operating procedure. A live-computed claim (with an explicit freeze at submission) is strictly better
and is the obvious differentiator.

**5.4 Variations are a money-losing footgun.** *Create a Variation (D)* states plainly: "Variations are
NOT added to the Progress Claim." You must remember to (a) create a schedule item from the variation,
(b) order it correctly in the schedule, (c) rebuild the claim, (d) check it wasn't auto-typed as an
overhead. The tutorial itself shows variations 1, 2 and 5 wrongly flagged as overheads — meaning they
had **zero sell rate and were silently excluded from the claim**. Approved variations dropping out of
a claim is the single most expensive failure mode in the whole module, and CivilPro's own training
material demonstrates it happening. **This is the sharpest wedge in this bundle:** an approved
variation should be claimable by construction, with a loud unclaimed-variation warning at claim time.

**5.5 No spatial dimension anywhere.** Quantities are bare numbers against schedule items. No
chainage, no station range, no geometry, no map. Nothing derives a quantity from where the work is.
SiteProof's spatial lot map plus chainage means quantity can be *computed* from extent rather than
typed — CivilPro cannot do this at all, and their own competitive chainage-map capability lives on
the QA side, not the payment side.

**5.6 No Security of Payment (SOPA) awareness.** Retention and security are free-typed numbers on a
summary panel. Nothing in the corpus mentions reference dates, statutory due dates, payment schedule
responses, or the response clock. For AU civil subcontractors this is the legally consequential part
of a progress claim and it is entirely absent.

**5.7 No client or superintendent involvement.** Certification is a manual transcription exercise: the
client marks up a PDF, someone retypes the numbers. No portal, no shared link, no digital
certification, no query/response thread on a disputed line item. The entire client-facing half of the
claim cycle happens outside the software.

**5.8 Dockets are a text field.** On the revenue side, dockets do not exist. On the cost side, a
Daycost has a *"Docket reference — a text column in which docket references can be recorded for the
purposes of assisting in reconciliation"*. Free text. SiteProof's structured docket → cost/claim link
has no equivalent here, and their docket-to-invoice reconciliation is manual matching against
free-text references.

**5.9 No accounting integration — CSV round trips only.** *Invoices (D)*: export the invoice list from
MYOB/Quicken/Dynamics, import into CivilPro. No API, no Xero (notably absent from a list written for
the AU market), no push-back of certified claim values as invoices. Given SiteProof's "Xero owns
money" stance, a genuine Xero integration on the claims side is a clean differentiator that
*reinforces* rather than violates the data-compiler position.

**5.10 The cost-code allocation layer is heavy manual maintenance.** Every schedule item must be
distributed to 100% across cost codes or its revenue lands in an "Unassigned" bucket that the docs
themselves warn about twice ("of limited functional use in determining the profitability of your
project"). The fix requires going back to the Daycost register, re-coding lines, then running "Update
Forecast Data".

**5.11 Locking is advisory, not an audit trail.** Periods lock on new-period creation, but any user
with access can Toggle Claim Lock / Toggle Daycost Lock. No mention anywhere of an immutable history
of claim edits, who changed a certified quantity, or when. For a document that underpins a payment
dispute, that is a real weakness — and SiteProof already has the immutable-log pattern from the
AiProposal work.

**5.12 Overhead items are a workaround, not a budget model.** Internal budget lines are modelled as
schedule items with $0 sell rate that must be manually excluded from the client's claim, distinguished
only by cell colour. Mis-typing one (see 5.4) has direct revenue consequences.

**5.13 No approvals on the claim itself.** POs have role-based value limits and a proper approval
state machine. Progress claims — worth vastly more — have a toggleable lock and nothing else.

---

## 6. Surprises

**6.1 They are much deeper into "financial tool" territory than expected — a shadow ledger.** Not just
claims: accruals with automatic/no-accrual tagging, invoice dispute registers, subcontract retention,
supplier creditor tracking, PO approval hierarchies with per-role dollar limits, Profit & Loss,
Cashflow with a Risk section, gross margin and budget variance by cost code, and a forecast module
with three cost-to-complete methods. This is ERP-adjacent. **And yet** they explicitly disclaim the
ledger: *"The payment and accounting function of Invoice management is handled outside Civil Pro by
the User's accounting application"*. So CivilPro is a **project-level shadow ledger that reconciles
against the real one** — it computes profit without holding a general ledger. That's a distinct third
position between SiteProof's data-compiler and a true financial system, and it's worth naming
explicitly when positioning against them: they will out-feature SiteProof on financial reporting and
under-deliver on it being *correct*, because every number depends on manual cost-code hygiene and
manual snapshot refreshes.

**6.2 "Costs come from Daycosts, NOT Invoices" is the same philosophy SiteProof uses for QA.** Their
justification — invoices lag ~45 days, daycosts are <1 day old and allocate cleanly — is a deliberate
choice of *field-captured data over back-office data as the source of truth*. That is precisely the
argument SiteProof makes for the diary and docket. They arrived at it on the cost side; SiteProof
should make it on both.

**6.3 Revenue is never forecast.** *"There is absolutely no estimation of revenue in the forecast.
This is because it is already known."* Revenue at completion = QAC × sell rate, straight from the
claim. Only cost is estimated. This is a genuinely elegant reduction — it collapses a normally
hand-wavy forecasting exercise down to a single estimated input per cost code, and makes a full
project forecast achievable "in as little as 5 minutes". Worth stealing as a *principle* even if
SiteProof never builds forecasting: derive everything you can, estimate exactly one thing.

**6.4 QA status is wired directly into revenue recognition.** Conformed or Guaranteed = 100% claimable,
Open = 0% by default. A site engineer's conformance decision moves reported revenue, earned budget and
gross margin with no accountant in the loop. Aggressive, and completely undefended — there is no
approval gate, no segregation of duties, no sign-off between "lot conformed" and "money claimed".

**6.5 The "Guaranteed" status and the 30-day unguarantee prompt** are an unusually honest piece of
product design: an explicit affordance for claiming work whose paperwork isn't closed, with a built-in
nag to clean it up. It encodes real contractor behaviour instead of pretending it doesn't happen.

**6.6 Rejected lots can still be claimed.** *"Lot Quantities for Lots that have been rejected will be
included in snapshots if the rejection date is after the cutoff date."* Defensible (the work wasn't
rejected as at the cutoff) and commercially realistic, but it means a claim can include work that is
known-rejected at the time of submission.

**6.7 The colour-code-as-data-model.** Four semantic cell colours (white/blue/green/yellow) encode two
independent boolean flags, and both transcripts and the KB rely on colour as the *primary* way to read
an item's type. No text label, no icon. Fails accessibility outright and is unlearnable for new users —
the tutorial spends a full minute explaining the palette. An easy, unambiguous win to do better.

**6.8 Effective Quantity has two different formulas depending on lot status**, and the difference is
only documented in one article (*Progress Claim Concepts and Terms*) while a different, simpler
formula appears in three others (*Quantities Register*, both *Statusing Quantities* articles). Open
lots multiply by *both* lot % complete and lot-qty % complete; conformed/guaranteed skip both. A user
reading the wrong article will get the wrong answer. Symptom of accreted complexity — and a reminder
to keep SiteProof's equivalent to exactly one formula.

# UI benchmark — CivilPro vs SiteProof: Progress Claims / Quantities / Variations

Scope: CivilPro **Cloud** (web) claim, quantity, schedule and variation screens, benchmarked against
SiteProof's `/projects/:projectId/claims` and `/projects/:projectId/variations`. Desktop V11 shots are
used only where the Cloud article has no equivalent (the claim-grid column bands and the claim
operations menu are identical in both, and the Cloud app is missing a few of them).

Screenshot roots (absolute):
- CivilPro: `C:\Users\jayso\AppData\Local\Temp\claude\C--Users-jayso-site-proofv3\1f629074-8d2a-4548-84d3-660e9613b45f\scratchpad\civilpro-kb\shots\<articleId>\NN.png`
- SiteProof: `C:\Users\jayso\site-proofv3\.gstack\dev-browser\ui-sweep2-2026-08\`

Article IDs referenced: `4411108377999` Create Progress Claims · `8542620488335` View/Update/Reports ·
`4407233804431` Assign Quantities to Lots · `5200206395407` Statusing Quantities · `4407233806607`
Add Schedule Items · `4412990451471` Create a Variation · `5275300999055` View/Update Claims (D) ·
`5258066730895` Create Progress Claims (D) · `5206074378639` Statusing Quantities (D) ·
`6205305623823` Create a Variation (D).

**Structural fact that governs every ticket below.** CivilPro's claim spine is
`Schedule Item → Quantity (lot or floating) → Claim Item`. SiteProof's spine is
`Lot → ClaimedLot` (`backend/prisma/schema.prisma:1357`, fields `quantity`, `unit`, `rate`,
`amountClaimed`, `percentageComplete`) hanging off `ProgressClaim` (`schema.prisma:1320`). We have no
schedule of rates and no pay-item register. **Nothing below asks for one.** Every pattern is
re-expressed against the lot spine, because the lot spine is the moat — CivilPro's quantity is a bare
number typed against a contract line, ours is already attached to a conformed, chainaged, photographed
lot.

---

## 1. Their flow, screen by screen

### 1.1 The schedule (contract spine) — set up once
`shots\4407233806607\01.png` Financials Setup → Schedule Items. Financial setup is a **separate
top-level nav section** from Quality Assurance, Payment and Cost Management. Payment holds only the
three working registers: Quantities, Variations, Progress Claims (`shots\4411108377999\01.png`).

`shots\4407233806607\06.png` **Import from clipboard** — the import panel sits beside an open Excel
window in the screenshot, which is the honest depiction of how every civil schedule arrives. Two
buttons: `IMPORT FROM CLIPBOARD`, `IMPORT FROM FILE` (or drop). Columns imported: Item no,
Description, Quantity, Unit, DJC rate, Spread rate.

`shots\4407233806607\12.png` **Set Headings** dialog — rule-based, not row-by-row: "Set Rows with 0
Sell Rate to Headings" / "Set Rows with 0 Quantity to Headings", with the affected rows circled live
behind the modal. `shots\4407233806607\11.png` shows the full Schedule Operations menu (Define
Headings, Prepend Characters, Strip Leading Characters, Force Re-Order, Set DJC as % of Sell Rate).
`shots\4407233806607\17.png` **Prepend Characters** with an "Include Subitems" checkbox — for
contracts with a Schedule A and Schedule B.

`shots\4407233806607\19.png` The resulting grid: drag-handles at row start, parent/child arrows,
`SCHEDULE A` / `SCHEDULE B` as bold heading rows, Markup as a derived column, and a Column Chooser
offering DJC Rate / DJC Total / **Is VRN?** (i.e. "did this line come from a variation").

Two flags per item, set from a right-hand **Action on Selection** rail: `Pay Item ↔ Overhead`,
`Fixed Rate ↔ Variable Rate`, `Enabled ↔ Disabled` (`shots\4407233806607\11.png`, right rail).

### 1.2 Booking a quantity against a lot
`shots\4407233804431\02.png` Lot Register → tick a lot → the chain-link icon on the right rail opens
**Related Items**: Quantities, Checklists, Approvals, NCR Linked, Checklist Linked, Non Conformances,
Test Requests, Variations, Photos, Filestore Documents, Tags, Users, Subcontractors, Related Lots.
Every one of these has a `+`. Quantities is the first row in the panel; you click its `+`.

`shots\4407233804431\03.png` **Add Quantities** — a full-screen schedule picker showing the tree
(headings, indent arrows, unit, sell total per item). You pick the pay item you're booking against.

`shots\4407233804431\04.png` **Add Quantity** form. The interesting part is one line:
*"Quantity — input your quantity either by selecting one of the buttons or by inputting your quantity
manually"*, followed by the qty field and two blue shortcut buttons carrying live values:
`COPY SCHEDULE QTY (37800 M2)` and `COPY REMAINING QTY (35658 M2)`. Below: `Preliminary` toggle,
`Non Claimable` toggle, `Reduced Payment Factor (RPF)` defaulting to `100%`, Comments. Footer:
`SAVE AND ADD MORE` / `SAVE AND EXIT`.

`shots\4407233804431\05.png` Back on the Lot Register, the Related Items panel now reads
`1910 m2, 3101.01: Clearing and grubbi…` — the booking is visible from the lot without navigating.

`shots\4407233804431\07-08.png` The same form reached from Payment → Quantities → `NEW QUANTITY`,
where `Type` is switchable to `FloatingQuantity` (no lot; free-text description instead) — prelims,
EMP preparation, site office.

### 1.3 The Quantities register and the effective-quantity column group
`shots\5200206395407\03.png` Payment → Quantities. Columns: Schedule Item · Description (rendered as
`LOTNUMBER: description`) · Lot Status · Qty · Unit · Value · **Effective Qty** · **Effective Value** ·
Comments. Effective Qty is the whole point of the screen: `CGRWNB001 … Open, 2,142.00 m2, $706.86,
Eff Qty 0, Eff Value $0.00` sits directly above `CGRWNSGL001 … Conformed, 2,580.00, $851.40, Eff Qty
2580, Eff Value $851.40`. The consequence of conformance is visible as a number on the same screen as
the status that caused it.

`shots\5200206395407\05.png` **% Complete** is a dedicated editable sub-screen (title bar "% Complete",
Save/Cancel in the footer), not an inline cell you might nudge by accident.

`shots\5200206395407\04.png` Right-click → `Show Percentage Complete` · `Views` ·
**`Manually Approve selection`** · `Remove Approval information` · **`Revert Percentage complete to Lot
Percentage`** · Delete Selected. That penultimate item is the escape hatch from a manual override back
to the lot-driven value.

`shots\5206074378639\02.png` (desktop) the Views ribbon exposes the column groups as named radio
buttons: `Standard` · **`Eff. Qty calcs (Lot Based)`** · `Approval Details (Lot Based)` ·
`Approval Details (No lots)` · `Schedule Grouped`. `shots\5206074378639\03.png` shows the result — a
`% Comp` column where **manually overridden percentages render in orange** (`100.0%`, `100.0%`, `60.0%`
orange against black `0.0%` / `100.0%` derived values).

### 1.4 Building the claim — a 4-step wizard
`shots\4411108377999\02.png` Progress Claims register, empty: `+ NEW PROGRESS CLAIMS`, four tabs
(`INPUTS` · `GENERAL` · `CERTIFICATION` · `BUDGET`), a banded grid, and four persistent summary cards
pinned along the bottom — **TO DATE · TO COMPLETE · AT COMPLETION · CERTIFIED**, each with
TOTAL / PREVIOUS / THIS CLAIM (AT COMPLETION substitutes DIFFERENCE).

Step 1 **Definition** (`shots\4411108377999\03.png`): Report Period End Date, Reporting Period Name
(auto "December 2021"), then a CLAIM DATES group (Claim Cutoff Date, Approved Completion Date,
Forecast Completion Date), then PROGRESS CLAIM DETAILS: **Previous Report Period** (the field that
makes periodic values derivable), `Use Lot Quantities` toggle, and Claim Quantity as four radios —
`None` / `Set to previous period claim qty` / `Set to previous period cert qty` / `Set to quantity
snapshot`.

Step 2 **Quantities** (`shots\4411108377999\04.png`): Claim Cutoff Date echoed read-only, then
`Show Only Quantities Up To Cutoff Date`, then an `INCLUDE IN SNAPSHOT` group of four toggles —
**Open Lots · Guaranteed Lots · Conformed Lots · Floating Quantities**. How aggressive this claim is
becomes an explicit, recorded decision on its own screen.

Step 3 **Details** (`shots\4411108377999\05.png`): Retention and Security, two fields, nothing else.

Step 4 **Confirmation** (`shots\4411108377999\06.png`): a flat read-only label/value review of all
eleven decisions before `SAVE`. Every wizard in the product ends this way — the variation wizard does
the same (`shots\4412990451471\06.png`).

### 1.5 The claim detail grid — pinned schedule + scrollable bands
`shots\4411108377999\07.png` (Cloud) and `shots\5275300999055\05.png` (desktop, wider). Left, pinned:
`Claim Item Details` — Schedule N…, Description, Qty Scheduled, Unit. Right, scrollable, grouped under
a **band header row above the column header row**:

| Band | Columns |
|---|---|
| Previous Certified | Qty · Total |
| Certification | Qty · Sell Rate · Total · (Claim − Cert) Qty |
| To Date | Qty Claimed · Sell Rate · Total |
| This Claim | Claimed (Diff) · Claim Value (Diff) · Certified (Diff) · Certified Value (Diff) |
| Admin | (hidden by default) |

The Cloud screenshot is annotated by CivilPro's own docs team with two red arrows reading "scroll down"
and "Scroll right for more columns" — they know the grid is wider than the viewport and shipped an
instruction instead of a fix. `shots\8542620488335\05.png` highlights `Certification → Qty` and
`To Date → Qty Claimed` as the only two cells you normally type in.

`shots\8542620488335\01.png` Right rail → **Views**: `Standard` · `Min` · `Earned` · `Forecast` ·
`Budgets` · `All` · `Custom Views` · `SAVE VIEW`. Same set as the desktop ribbon
(`shots\5275300999055\01.png`), where it is a radio group. Heading rows collapse via chevrons; the
schedule tree survives into the claim.

### 1.6 Claim operations — repairing a frozen claim
`shots\8542620488335\06.png` / `07.png` / `10.png` (Cloud right rail) and `shots\5275300999055\09.png` /
`11.png` / `14.png` (desktop ribbon). One flat menu, no submenus:

```
Update Claim Items From Schedule
Renew Qty SnapShot
Set Certified = Claimed
Set Claim = Snapshot
─────
Claim All for Selected
Set Claim Rates to Schedule (Selection)
Set At Comp Rates to Schedule (Selection)
Set At Comp Qty to Schedule (Selection)
─────
Selected Not Claimed / Selected As Claimed
─────
Selected As Variable Rate / Selected As Fixed Rate
```

`shots\8542620488335\08.png` **Update Claim From Schedule** dialog: three independent checkboxes (Add
items in the Schedule but not in the claim / Update Existing schedule items / Delete Claim Items
without matching schedule items), a `New Claim Item Quantities` radio group (the same four options as
the creation wizard), and `Update Claim Items` → `Update Rates` vs "I will select which rates to update
later". Every destructive dimension is a separate opt-in.

`shots\5258066730895\07.png` The snapshot confirm dialog prints the decision back at you before acting:
*"This function will only add quantities visible in your snapshot. Open Lots:Yes / Guaranteed Lots:Yes
/ Conformed Lots:Yes / Floating Qties:No — Do you want to continue?"*

### 1.7 Certification and the register
`shots\8542620488335\03.png` The `INPUTS` tab reduces the register to only the three hand-typed
fields: **Retention · Security · Paid This Claim**. Everything else in the product is derived, so the
tab that holds the typed inputs is its own tab.

`shots\8542620488335\02.png` Right-click a period → `Show Cents` · `Toggle Claim Lock` ·
`Delete Progress Claim`. A padlock glyph renders inline next to the locked period's name
(`August 2022 🔒`). That is the entire claim governance model.

`shots\8542620488335\11.png` After `Set Certified = Claimed`, the register's Certified To Date reads
`$907,622` and the CERTIFIED summary card's THIS CLAIM jumps to `$907,621.77` — the bottom cards are
the feedback channel for bulk operations.

### 1.8 Reports
`shots\4411108377999\08.png` / `shots\8542620488335\11.png` The print rail: three global options
(`Use Certified Qty` toggle, `Use Long Description` toggle, **`Split Date`** picker) sitting *above*
the report list, so the option applies to whichever report you then pick. Reports, grouped by rule:

```
Progress Claim Cover / Cover (Payment) / Cover with Completion / Cover with Completion (Payment)
─────
Progress Claim · Progress Claim Detail · Claim - Completion
─────
Lot Quantity Report (Value) · Lot Quantity Report (Quantity Only)
```

`shots\4411108377999\09.png` The rendered *Progress Claim*: contractor logo block top-left, project
number and name top-right, then `Description / Schedule Qty / Claim Qty / Sell Rate / Total`, schedule
headings as bold un-numbered rows, and a single underlined `Progress Claim Total (ex GST)`. Plain,
monochrome, prints on one page.

### 1.9 Variations
`shots\4412990451471\02.png` Register: `Variation No · Description · Sell (Submitted) · Sell
(Approved) · Raised By`. Two money columns from the start.

Step 1 (`shots\4412990451471\03.png`): Variation Number (auto `0001`), Client Reference, Raised By,
Description, Detail, then **`Create and Link to Schedule Item`** as a toggle defaulted to **Yes** — the
Cloud app fixes the desktop's worst footgun right in the creation wizard.

Step 2 (`shots\4412990451471\04.png`) **Valuation & EOT**: a two-column `Submitted | Approved` grid over
Quantity / Measurement Unit / Rate / Total, with Total computed live (30 × $50 = $1,500 submitted;
25 × $50 = $1,250 approved), then the same two-column treatment for `EOT Days`. The negotiation
delta is legible at a glance.

Step 3 (`shots\4412990451471\05.png`) **Waypoints**: a small table (`Status · Waypoint Date · Notes`)
with `+ NEW WAYPOINT` and per-row pencil/bin. Statuses run Identified → Notified → Submission →
Approved. `shots\6205305623823\08.png` (desktop) shows two waypoints accumulated on one variation, both
dated — the history is additive, not a single overwritten status field.

`shots\4412990451471\08.png` Related Items for a variation: Waypoints, Filestore Docs, **Lots**,
Photos, **Schedule Items** — with the generated `VRN0001: Cattle Dip` schedule item visible.

`shots\4412990451471\09.png` Nine variation reports, including `Variation Valuation (Mark Up) (pdf)`
and `Variation Valuation (DJC)`.

---

## 2. Click-path comparison

### Task A — book a quantity against a lot

| | CivilPro Cloud | SiteProof |
|---|---|---|
| 1 | Quality Assurance → Lot Register | Lots → open lot |
| 2 | Tick lot → chain icon → Related Items | — |
| 3 | Quantities `+` | — |
| 4 | Pick schedule item from tree | — |
| 5 | Type qty **or** click `COPY REMAINING QTY (35658 M2)` | — |
| 6 | Set Preliminary / Non-Claimable / RPF | — |
| 7 | `SAVE AND ADD MORE` or `SAVE AND EXIT` | — |
| | **7 clicks, quantity is now a first-class record visible from the lot** | **Not possible.** |

There is no quantity-booking step in SiteProof at all. `Lot.budgetAmount` (`schema.prisma:464`) is a
single lump figure per lot, and `ClaimedLot.quantity/unit/rate` (`schema.prisma:1361-1363`) exist in the
schema but are never written by the UI — `CreateClaimModal.tsx` only collects `percentageComplete`
(`frontend/src/pages/claims/components/CreateClaimModal.tsx:211`). Our claim measures *percent of a lot
budget*, theirs measures *quantity of a contract item*. Neither is wrong, but ours cannot answer
"how many m² of clearing have we claimed to date across the job", and a head contractor's QS will ask
that in month one.

### Task B — build the monthly claim

| | CivilPro Cloud | SiteProof |
|---|---|---|
| 1 | Payment → Progress Claims → `+ NEW PROGRESS CLAIMS` | Progress Claims → `+ New Claim` |
| 2 | Definition: period end, name, cutoff, completion dates, previous period, claim-qty source | Period start/end |
| 3 | Quantities: cutoff filter + Open/Guaranteed/Conformed/Floating toggles | — (only conformed lots are offered) |
| 4 | Details: Retention, Security | — |
| 5 | Confirmation: review 11 values → `SAVE` | Tick lots, type % per lot, tick variations → create |
| 6 | Claim grid opens; type into Certification-Qty / To-Date-Qty per line | **No claim detail screen exists** |

Ours is materially faster to *create* (`105-claims-desktop.png` → `+ New Claim` → tick and go) and
better at *gating* — the "Value Blocked From Claiming" panel with its ITP Checklist Incomplete /
Missing Budget / Not Conformed breakdown has no CivilPro equivalent anywhere in the 138 screenshots.
CivilPro's answer to "can I claim this lot" is a toggle that says *include Open lots: yes*.

But after creation our claim is a **row in a register and nothing else**. `App.tsx:448` registers
exactly one claims route (`/projects/:projectId/claims`); there is no `/claims/:claimId`. Everything
post-creation happens through modals fired from the ten-icon Actions column in `ClaimsTable.tsx:311-395`
(Submit, Delete, Dispute, Record Payment Schedule, Record Payment, Evidence Review, Generate Evidence
Package, Download CSV, Export to Xero). CivilPro can show a QS the 32 lines behind a $907k claim;
we can show them one row and a CSV.

### Task C — certify

| | CivilPro Cloud | SiteProof |
|---|---|---|
| 1 | Open claim grid | Claims register → certificate icon |
| 2 | Right rail → `Set Certified = Claimed` | Type a single claim-level Certified Amount |
| 3 | Hand-edit only the differing lines in Certification-Qty | Certification date |
| 4 | `INPUTS` tab → type `Paid This Claim` | Variation notes — **required if certified < claimed** (`RecordCertificationModal.tsx:49-67`) |
| 5 | Print Cover + Detail + Lot Qty Report with a Split Date | Attach the certificate PDF |

Ours is one screen and enforces an explanation for any shortfall, which CivilPro does not. Theirs
records *which lines* were cut. When the principal certifies $850k against a $907k claim, CivilPro
knows it was lines A3101.01 and B3102.01; we know only the total and a free-text note. That is the
difference between a claim record and a dispute-ready record — and SOPA disputes are line-item
arguments.

---

## 3. Patterns worth adopting — ranked tickets

Ranked by (value to a claiming QS) ÷ (build cost), constrained to the data-compiler stance: we compile
quantities and evidence, we do not compute entitlement.

---

### T1 — Claim detail page with band columns *(highest value, largest build)*
**Build.** A new route `/projects/:projectId/claims/:claimId` rendering one row per `ClaimedLot`, with
the left columns pinned (Lot #, description, chainage, activity) and the right columns grouped under a
band header row:

```
                    │ Previously Claimed │   This Claim    │  Certified   │    To Date
Lot / description   │  Qty      Value    │  Qty     Value  │ Qty    Value │ Qty     Value
```

Only `This Claim → Qty` and `Certified → Qty` are editable; everything else derives. Band headers are a
plain second `<thead>` row with `colSpan` — no grid library needed.

**Where.** New `frontend/src/pages/claims/ClaimDetailPage.tsx` + route in
`frontend/src/App.tsx` (beside line 448). Backend: `GET /api/claims/:id` returning claimedLots with
prior-period aggregates; `backend/src/routes/claims/`.

**Evidence.** `shots\4411108377999\07.png`, `shots\5275300999055\05.png`, `shots\8542620488335\05.png`.

**Why first.** It is the single missing screen. Every other ticket here either lives on this page or is
weakened without it. It also converts our existing `ClaimedLot.quantity/unit/rate` columns from dead
schema into the thing the page is made of.

**Do differently.** Do not ship "scroll right for more columns" as an instruction. Bands collapse to
one at a time under `useIsMobile()` (`reference_mobile_responsive_pattern`), with a segmented control
picking the visible band — that is our answer to their Views radio group and it works on a tablet in a
site office, which theirs does not.

---

### T2 — "Set Certified = Claimed", then edit exceptions
**Build.** One button on the claim detail grid header that writes `certifiedQty = claimedQty` for every
row, then leaves the QS to hand-edit the handful the principal cut. Rows edited away from claimed get
a marker (see T4). The claim-level certified total becomes the sum, replacing the single typed figure.

**Where.** `frontend/src/pages/claims/ClaimDetailPage.tsx` header action;
`frontend/src/pages/claims/components/RecordCertificationModal.tsx` keeps the certificate upload,
date, and the existing shortfall-notes requirement (`RecordCertificationModal.tsx:49-67` — keep it, it
is better than anything CivilPro has) but sources its amount from the line sum.

**Evidence.** `shots\8542620488335\10.png`, `shots\5275300999055\14.png`.

**Why.** Trivial to build, removes the most tedious hour of the claim month, and turns certification
from a scalar into a line-item record — which is what makes a SOPA dispute arguable.

---

### T3 — Shortcut buttons carrying live values
**Build.** Beside any quantity or percentage input, buttons whose *labels contain the number they will
insert*: `Claim remaining (42%)`, `Claim full lot (100%)`. In the claim creation modal that is the
per-lot percent field; on the detail grid it is the This-Claim qty field.

**Where.** `frontend/src/pages/claims/components/CreateClaimModal.tsx:445-460` (the per-lot percentage
input, which today is a bare number field with a validation error hanging off it), then reused on T1.

**Evidence.** `shots\4407233804431\04.png` — `COPY SCHEDULE QTY (37800 M2)` / `COPY REMAINING QTY
(35658 M2)`; `shots\4407233804431\08.png`.

**Why.** Cheapest ticket on the list and it removes an arithmetic step the user currently does in their
head. Putting the value *in the label* is the detail worth copying — a button reading "Remaining" makes
you click to find out; one reading "Remaining (35,658 m²)" answers the question without the click.

---

### T4 — Manual-override marker
**Build.** Any figure a human typed over a derived value renders in amber with a small `Edited` chip
and a tooltip giving the derived value plus a one-click "revert to computed". Applies to: a
This-Claim percentage that differs from the lot's ITP-derived completion, and a Certified qty that
differs from Claimed.

**Where.** T1's grid cells; a shared `<OverriddenValue>` in `frontend/src/components/`.

**Evidence.** `shots\5206074378639\03.png` (orange `% Comp` values), `shots\5200206395407\04.png`
(`Revert Percentage complete to Lot Percentage`).

**Why.** This is the honest version of their colour coding: colour as an *annotation on a value that
still reads as a number*, plus a text chip, plus an escape hatch — not colour as the only carrier of
meaning (see §4). It answers "why doesn't this match the ITP?" without anyone opening a spreadsheet.

---

### T5 — Quantity transparency line
**Build.** Under each claim line, a single grey line showing the derivation as text rather than magic:

```
Lot budget $42,000 × 65% complete (ITP 13/20 items signed) = $27,300 claimable
```

Expanding it lists the ITP items that moved the percentage. Nothing is invented — every term already
exists in our data. On the evidence report this line appears **without the dollar column**.

**Where.** T1's grid, expandable row; the same string generator feeds the evidence package
(`frontend/src/pages/claims/components/EvidencePackageModal.tsx`).

**Evidence.** `shots\5200206395407\03.png` (Qty / Value / Effective Qty / Effective Value side by side),
`shots\5206074378639\02.png` (`Eff. Qty calcs (Lot Based)` as a named view).

**Why.** CivilPro's effective-quantity formula is the most-stolen-worthy idea in the module, and its
strength is that it's *shown*, not that it's clever. Ours is stronger because the multiplier is backed
by signed ITP items rather than a typed percentage — but only if we show the working. This is the
data-compiler pitch made visible.

---

### T6 — Lot-backed evidence report, quantity-only variant
**Build.** Restructure the evidence package so its spine is **claim line → the lots and records behind
it**, grouped by lot status, with two variants exactly as CivilPro ships them: `(Value)` and
`(Quantity Only)`. The Quantity-Only variant carries no dollars at all and is the one we hand to a
principal as proof of work.

**Where.** `frontend/src/pages/claims/components/EvidencePackageModal.tsx` — today it offers
`Lot Summary Table` / `Individual Lot Details` as flat checkboxes (lines 18-25). Make the two report
*shapes* the primary choice and the sections secondary.

**Evidence.** `shots\4411108377999\08.png` and `shots\8542620488335\11.png` (`Lot Quantity Report
(Value)` / `(Quantity Only)`), `shots\4411108377999\09.png` (the printed layout).

**Why.** A no-dollars evidence report is our stated position (`product_claims_data_compiler_not_financial`)
and CivilPro has already validated that the market wants it — they ship it as a first-class report, not
a toggle. Also adopt their **Split Date**: roll every lot older than the chosen date into one summary
line per status so the pack stops growing without bound.

---

### T7 — Variation waypoint timeline
**Build.** Replace the single `status` string on `Variation` (`schema.prisma:1382`) with an append-only
`VariationWaypoint` table (status, date, note, user) rendered as a vertical timeline in the variation
detail sheet. The register keeps showing the latest waypoint as today's status chip.

**Where.** `frontend/src/pages/variations/components/VariationDetailSheet.tsx`; new Prisma model +
migration.

**Evidence.** `shots\4412990451471\05.png`, `shots\6205305623823\08.png` (two dated waypoints on one
variation).

**Why.** A variation's value is in the negotiation history, and `submittedAt`/`approvedAt`/`rejectedAt`
(`schema.prisma:1387-1389`) already half-model this — the waypoint table generalises them and captures
the "Notified" step that currently has nowhere to live. Cheap, and it is the substrate for an EOT claim
later.

---

### T8 — Submitted vs Approved side by side on variations
**Build.** In the variation form and detail sheet, a two-column `Submitted | Approved` block over
Quantity / Unit / Rate / Total, plus EOT Days. Today we hold only `approvedAmount`
(`schema.prisma:1383`) — the submitted figure is lost, so the register can never show what was conceded.

**Where.** `frontend/src/pages/variations/components/CreateVariationModal.tsx` and
`VariationDetailSheet.tsx`; add `submittedAmount` + `eotDaysSubmitted`/`eotDaysApproved`.

**Evidence.** `shots\4412990451471\04.png`, `shots\4412990451471\02.png` (register showing both money
columns).

**Why.** One extra column pair turns the variation register from a list into a negotiation ledger.
EOT alongside value is correct for AU civil and we currently model neither.

---

### T9 — Claim creation as a reviewed wizard
**Build.** Keep our fast tick-and-go path, but add a final read-only confirmation panel listing every
decision (period, cutoff, lots included, lots excluded and why, variations included, totals) before the
claim is created. Not a four-step wizard — one review pane.

**Where.** `frontend/src/pages/claims/components/CreateClaimModal.tsx`, final step.

**Evidence.** `shots\4411108377999\06.png`, `shots\5258066730895\07.png` (the dialog that prints
`Open Lots:Yes / Guaranteed Lots:Yes / Conformed Lots:Yes / Floating Qties:No` back at you before
acting).

**Why.** A claim is the most consequential object in the product and ours is currently created by a
modal with no summary step. Their habit of restating a decision as flat text immediately before a
destructive action is worth adopting wholesale — cheap, and it is the difference between a mistake
caught in five seconds and one caught by the principal.

---

### T10 — Persistent claim summary strip
**Build.** Pin a four-card strip to the claim detail page: `To Date` / `This Claim` / `Certified` /
`Outstanding`, each with TOTAL / PREVIOUS / THIS CLAIM. Our claims register already has the right idea
(`105-claims-desktop.png` — Total Claimed / Total Certified / Total Paid / Outstanding), it just
doesn't survive into a detail view because there isn't one.

**Where.** T1's page; reuse `frontend/src/pages/claims/components/ClaimsSummary.tsx`.

**Evidence.** `shots\4411108377999\10.png`, `shots\8542620488335\11.png`.

**Why.** It is the feedback channel for bulk operations — after T2's "Set Certified = Claimed" the user
needs to see the number move. Low cost given the component exists.

---

### Explicitly not adopting
- **Schedule Items / pay-item register.** A second spine beside lots doubles the data-entry burden and
  buys us a contract structure our users' head contractors already hold in Excel. Revisit only if a
  real customer's QS asks for pay-item roll-up.
- **Floating quantities.** Only meaningful once a schedule exists. Our equivalent problem (prelims,
  site office) is better solved by a lot type than by a second quantity kind.
- **Snapshot / renew-snapshot.** Their staleness bug dressed as a feature (`claims-payment-cost.md` §5.3).
  Compute live, freeze at submission. We already do this; do not import the ceremony.
- **DJC rate / cost codes / forecasting.** Xero owns money.

---

## 4. Anti-patterns to avoid

**4.1 Colour as the data model.** Four cell colours encode two independent booleans:
white = Claimed+Fixed, blue = Claimed+Variable, green = Not-Claimed+Fixed, yellow = Not-Claimed+Variable
(`claims-payment-cost.md` §1.1). There is no text label and no icon anywhere. In
`shots\5275300999055\05.png` the row `2106.01 Lay Footpath` is green and the only way to know it is an
overhead item excluded from the client's claim is to have memorised the palette. Same disease in the
Quantities register: `shots\5200206395407\06.png` shows two yellow rows among fourteen white ones with
no legend on screen. This fails contrast, fails colour-blind users, fails anyone who prints the grid,
and is unlearnable — their own tutorial spends a minute on the palette. **Our rule:** state carries a
text chip; colour is a second channel that reinforces it and never the only one. T4 is deliberately
"amber + `Edited` chip + tooltip", not "amber".

**4.2 "Scroll right for more columns" as documentation.** `shots\4411108377999\07.png` carries two
red arrows drawn by CivilPro's docs team onto a screenshot of their own product. When you find yourself
annotating a screenshot to explain the layout, fix the layout. T1's band segmented control is the fix.

**4.3 Modal edit gates.** `Enable Editing (Ctrl+E)` before typing (`shots\5275300999055\03.png`),
`Unlock schedule` before reordering. Deliberate friction that reads as broken software on first
contact. Our answer is optimistic inline edit plus a real audit trail — the same protection without
the ceremony.

**4.4 Right-click as primary navigation.** `Toggle Claim Lock`, `Show Cents`, `Delete Progress Claim`
and `Revert Percentage complete to Lot Percentage` are all right-click-only
(`shots\8542620488335\02.png`, `shots\5200206395407\04.png`). On a tablet none of them exist.

**4.5 Views that don't persist.** From their own docs: *"This view is only temporary and will return to
the default view once you exit the register."* Column layout is per-session. If we ship band or column
choices, persist them per user per project.

**4.6 Locking as governance.** `shots\8542620488335\02.png` — a claim worth $907k is protected by a
toggle any user can flip, with no history of who changed a certified quantity. Meanwhile their purchase
orders have role-based dollar approval limits. We already have the immutable-log pattern from the
AiProposal work; a certified figure should never be silently editable.

**4.7 Two formulas for one concept.** Effective Quantity is documented one way in
*Progress Claim Concepts* and a different, simpler way in three other articles
(`claims-payment-cost.md` §6.8). Whatever T5 shows, there is exactly one derivation and one place it
is written down.

**4.8 Overheads as $0 schedule items distinguished only by colour.** Their own training material shows
variations 1, 2 and 5 mis-typed as overheads — meaning approved variations were silently excluded from
a claim (`claims-payment-cost.md` §5.4). A type flag with revenue consequences must be a labelled
control, and anything approved-but-unclaimed must be loud at claim time. Our variation status filter
row (`151-variations-desktop.png` — All / Proposed / Submitted / Approved / Rejected / Claimed) is
already the better shape; it just needs an alert when Approved is non-zero at claim time.

---

## 5. Verdict

CivilPro is ten years ahead of us on the *inside* of a claim — banded to-date columns, bulk
certification, an explicit and visible quantity derivation, and a lot-backed evidence report they ship
in a no-dollars variant — and roughly ten years behind on everything around it: no mobile, colour as
the data model, snapshots that go silently stale, and a $907k document guarded by a toggle.

Our real gap is one screen, not one feature: a claim in SiteProof is a register row and ten action
icons, with no way to see or edit the lines behind it. T1 plus T2 (band-column detail page + Set
Certified = Claimed) closes most of the distance, and T5 (show the derivation) converts our ITP-backed
percentage from a hidden advantage into the visible reason a QS trusts the number.

Everything worth taking here fits the data-compiler stance without strain, because CivilPro's best
ideas are all on the *quantity* side of the money line — effective quantity, quantity-only evidence
reports, line-item certification — while the parts we should refuse (DJC rates, cost codes, forecast
margin, their shadow ledger) are exactly the parts Xero already owns.

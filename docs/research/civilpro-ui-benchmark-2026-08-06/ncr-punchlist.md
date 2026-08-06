# UI benchmark — CivilPro NCR + Punchlist vs SiteProof

Scope: **UI/UX only**. Mechanics live in
`C:\Users\jayso\AppData\Local\Temp\claude\C--Users-jayso-site-proofv3\1f629074-8d2a-4548-84d3-660e9613b45f\scratchpad\civilpro-kb\findings\ncr-punchlist-field.md`
and are not repeated here except where a mechanic *is* the UI.

Screenshot paths are written as `SHOTS\<articleId>\NN.png`, where

```
SHOTS = C:\Users\jayso\AppData\Local\Temp\claude\C--Users-jayso-site-proofv3\1f629074-8d2a-4548-84d3-660e9613b45f\scratchpad\civilpro-kb\shots
SWEEP = C:\Users\jayso\site-proofv3\.gstack\dev-browser\ui-sweep2-2026-08
```

Article IDs: `4407417543823` Create NCR (Web) · `5090437163151` Create NCR (Desktop) ·
`10393437160207` Edit an NCR · `14101719661071` Re-submit an NCR ·
`4408088629775` / `5097311594895` Link Photos to NCR · `8246143993103` Create Punchlists (Web) ·
`6015571688975` Create Punchlists (Desktop) · `8246383469327` View/Edit Punchlists (Web) ·
`6016778426383` View/Edit Punchlists (Desktop).

**Source-of-truth note.** SiteProof file paths below are verified against `origin/master`
(`01e430c5`), not the stale local `master` (`228a3fcc`). The sweep screenshots show `Trends`
and `Views` buttons on the NCR register header that exist on `origin/master`
(`frontend/src/pages/ncr/analytics/NCRAnalyticsPage.tsx`) — the local checkout predates them.

---

## 1. Their flow, screen by screen

### 1.1 NCR creation — a six-page linear wizard (Web)

`SHOTS\4407417543823\01.png` → `09.png`.

Entry is a flat register with a single blue **+ NEW NCR** primary button top-left and a
**vertical icon rail pinned to the right edge** — register / search / related-items (chain) /
column-chooser / print. That rail is the same on every register in the product; it is their
global object-actions surface (`SHOTS\4407417543823\02.png`).

The wizard header is a six-node stepper with labels under each node, ticked green as you pass
(`03.png`–`08.png`). Footer is fixed: `DISCARD` bottom-left, `BACK` / `NEXT` bottom-right,
`SAVE` only on the last page. Field order:

| Step | Fields, in screen order | Control type | Shot |
|---|---|---|---|
| **NCR Definition** | NCR Number (auto, editable), Date NCR Raised\*, Raised By\*, **Location\*** (multi-line), Description\* | number + date + person picker + 2 textareas | `03.png` |
| **Properties** | Estimated Cost ($), **Severity\*** (Incidental / Minor / Major), **Third Party Approval Required\*** (No⇄Yes toggle), Related Parties, Notes | radio group + toggle switch + textareas | `04.png` |
| **Actions** | **Action Type\*** (Retest / Retest-Rectify / Replace-Reconstruct / Reject / Use As Is / Other), Corrective Action\* | 6-way radio list + textarea | `05.png` |
| **Root Cause** | **Root Cause Category\*** (dropdown), Root Cause Detail (optional), **Action To Prevent Reoccurence\*** | dropdown + 2 textareas | `06.png` |
| **Lots** | "Select a Lot…" combo, then a list of chosen lots each with a **trash icon** | typeahead + removable list | `07.png` |
| **Confirmation** | Every field as a read-only label/value table, `BACK` + `SAVE` | review screen | `08.png` |

Three things are worth naming precisely:

- **Severity and Action Type are radio lists, not dropdowns.** All options visible, zero clicks
  to compare. Severity is a 3-point scale (Incidental / Minor / Major), not our binary.
- **Third Party Approval Required is a labelled No⇄Yes toggle** with the question restated above
  it. It reads as a decision, not a checkbox someone skims past.
- **Root Cause Category is a dropdown while Root Cause Detail is a free textarea and optional** —
  the structured field is the mandatory one. `Action To Prevent Reoccurence` carries the red
  asterisk; `Root Cause Detail` does not.

The Desktop client runs the same field set as a **persistent breadcrumb trail**
(`Details → Properties → Actions → Root Cause → Lots → Notes → Approval → Closeout`,
current step in bold magenta) rather than a stepper — see `SHOTS\5090437163151\05.png`,
`06.png`. Desktop adds two extra pages the Web wizard drops: **Approval** (Approval Date /
Approved By / Approval Details, `09.png`) and **Closeout** (Closeout Date / Closeout By /
Closeout Details, `10.png`). Both are three-field forms; both are blank at creation and the
tutorial says "skip this for now".

### 1.2 Register, status chips and the publish/private UI

`SHOTS\14101719661071\02.png`, `03.png`; `SHOTS\10393437160207\01.png`–`03.png`.

The register is a dense grid: `NCR No.` (blue hyperlink) · `Description` · `Location` · `Status` ·
`Raised` · `Is Complete` · `Requested` · `Is Published`. The last three are **tick-or-blank
boolean columns**, not badges. Status is a **small colour square + text label**, and the colours
carry meaning: red = Rejected, blue = Client Review / Approved / Closed Out, hollow = Open
(`SHOTS\14101719661071\02.png`). Grouping is by drag-a-column-header-here.

The publish model surfaces as a right-click context menu (`SHOTS\14101719661071\03.png`) and an
identical right-rail **Action on Selection** panel (`SHOTS\10393437160207\02.png`):

```
View Approvals · Set Manual Approval · Set Close Out
Remove Manual Approval · Remove Close Out
NCR Summary · Build Conformance Folio
Reports ▸
Access ▸ → Make Public | Make Private
Import from File · Re-assign Requester · Notify Selection · Delete Selected
```

`Make Public` / `Make Private` is the entire visibility-and-edit-lock control. There is no
"Draft" chip, no lock icon on the row — the only signal is a tick in the `Is Published` column.
The mechanic ("published = frozen") is invisible until you try to edit and fail.

### 1.3 Approval request, the approver screen, and rejection

The Approval is a **separate object**, reached from the same right-rail. Its UI surface in the
NCR is the Related Items panel (`SHOTS\4408088629775\01.png`), which lists
`Lots · Photos · Filestore Documents · Approvals (Related / Linked) · Punchlist Items ·
Notifications` — each with its own inline action icons: download ⤓, **camera** (take photo),
chain (link existing), `+` (upload new). Approvals resolve to a plain hyperlink
("145: Soaring Heights Civil Works – NCR 15").

The approver's decision lands in an **Action Logs** table on the NCR:
`Log Date · Action By · Action · Status · Comment` — every column filterable
(`SHOTS\14101719661071\01.png`). One row per action; the rejection comment
("Please update the 'Action to Prevent Occurrence' field to something more suitable. Rejected.")
sits in the grid as plain text. This is their audit trail UI and it is a good, boring table.

Rejection recovery is where the UI collapses. `SHOTS\14101719661071\05.png` and `06.png` show
the actual remedy: a **draw.io-style workflow graph editor**, with states as ovals/boxes,
transitions as labelled arrows, and a right panel of **Action Permissions** (`Requester Can
Action` / `Addressee Can Action` checkboxes, `Users Can Action` and `Roles Can Action` pickers).
The user is expected to drag a new arrow from `Rejected` back to `NCR Requested`, label it
"Resubmit NCR", and set its permissions — to resubmit an NCR.

### 1.4 Punchlist — creation, the item grid, and the three gate columns

Create is a **single short form**, not a wizard: Description\* (a large 6-row textarea),
Raised By (defaulted), Date Raised (defaulted today), footer `DISCARD` / `CREATE`
(`SHOTS\8246143993103\03.png`). Desktop is the same three fields in a small modal
(`SHOTS\6015571688975\03.png`). There is no location, area or lot field — the tutorial's own
advice is to type location into Description.

The punchlist detail is a **flat editable grid** under a collapsed `SHOW PUNCHLIST INFORMATION`
disclosure, with `+ NEW ITEM` above it and `DELETE` / `CANCEL` / `SAVE` / `SAVE & CLOSE` in a
fixed footer (`SHOTS\8246143993103\05.png`). Columns:

```
⠿(drag)  ☐  Item No.  Description  Person Responsible  │ Checked │ Verified │ Approved │ Notes │ 🗑
```

The three gates are **three adjacent checkbox columns in the row itself** — the whole
sign-off model is visible without opening anything (`SHOTS\8246383469327\03.png`). State is
carried by row colour: white = outstanding, **green = fully resolved**, blue = selected.
A gate set to "Not Required" renders as an **empty cell with no checkbox at all**
(`SHOTS\8246143993103\07.png` — the circled Approved cell is blank, not an unchecked box).
That is a genuinely good three-state control: ☐ pending / ☑ done / ∅ not required, with no extra
chrome.

Gate assignment is per-punchlist, via Related Items → `Roles (all items)` → chain icon → a plain
user list (`SHOTS\8246143993103\09.png`) → a modal **"Scope for User"** offering three text
buttons `CHECK · VERIFY · APPROVE` with the hint "You can add the user again with a different
scope for multiple scopes on the punchlist" (`SHOTS\8246143993103\10.png`). Result renders in
the rail as `John Doe (Check)` / `Jane Doe (Verify)` / `Amos Soo (Approve)`, each with an
unlink icon (`SHOTS\8246383469327\04.png`).

Attribution (`Checked By` / `Verified By` / `Approved By` + dates) is **not shown by default**.
You open a `Column Chooser` flyout and physically drag `Approved By` onto the header row
(`SHOTS\8246383469327\06.png`) to get the column (`07.png`). Desktop is the same drag ritual
(`SHOTS\6016778426383\05.png`).

Close-out is a Global Action (⋯) panel with three items — `Renumber Items`, **`Close Out
Punchlist`**, `Remove Punchlist Close Out` (`SHOTS\8246383469327\05.png`). Closed rows show a
**green square glyph before the description** in the register (`SHOTS\8246383469327\08.png`).

Desktop's item screen replaces the checkbox columns with a ribbon whose **buttons swap label in
place**: `Check Selected` / `Verify Selected` / `Set Approval Selected` become
`Uncheck Selected` / `Unverify Selected` once ticked, and downstream buttons **grey out** until
the upstream gate is unwound (`SHOTS\6016778426383\02.png` vs `03.png`). The undo hierarchy is
taught entirely by disabled state — no error message needed.

Desktop also ships **named preset views as radio buttons**: NCR register has
`Standard · Approval · NCR value · Closeout` (`SHOTS\5097311594895\03.png`); the punchlist has
`Default · ByInfo · Approval` (`SHOTS\6016778426383\05.png`). One click swaps the whole column
set to the one that matters for that stage of the lifecycle.

### 1.5 The pre/post photo report

The report is not a screen — it is a `Detail Report` button on the **Reports ribbon tab**
(`SHOTS\6016778426383\06.png`), and on Web a **printer icon that only appears on the register,
not the item page** (`SHOTS\8246383469327\08.png`). The NCR equivalent is a right-rail `Reports`
drawer with a `Report Options` accordion of three No⇄Yes toggles — **Show Related Photos**,
**Show CloseOut**, **Show Root Cause** — a `SAVE AS DEFAULT` button, then a list of eight outputs
(`NCR Report (pdf)`, `NCR Report (zip)`, `NCR Electronic (pdf/zip)`, `NCR Register`,
`NCR by Work Type`, `NCR by ITP`, `NCR Summary`, `Build Conformance Folio`)
(`SHOTS\4407417543823\09.png`). The per-report `⋮` offers format variants.

Photo attachment itself is a **full-page picker** listing every project photo with thumbnail,
description and date, paginated 16 pages deep, with checkboxes and a `SAVE`
(`SHOTS\4408088629775\02.png`); documents get the same treatment, 262 rows
(`SHOTS\4408088629775\03.png`). Nothing narrows the list to the lot or the date of the defect.

---

## 2. Click-path comparison

Counts are discrete user interactions (clicks, taps, field entries counted as one each);
navigation between screens counted.

### 2.1 Raise an NCR from a lot

| | CivilPro (Web) | SiteProof |
|---|---|---|
| 1 | Lot Register → select lot → **New NCR** (lot auto-links) | Lot detail → NCRs tab → **Raise NCR** (deep-links `?create=1&lot=<id>`, lot preselected) |
| 2 | Step 1: Location, Description → NEXT | One modal: Description, Category, Affected Lots, Severity, Responsible, Spec Ref, Linked Delivery, Due Date |
| 3 | Step 2: Cost, Severity, 3rd-party toggle, Related Parties, Notes → NEXT | — |
| 4 | Step 3: Action Type, Corrective Action → NEXT | — |
| 5 | Step 4: Root Cause Category, Detail, Prevent Recurrence → NEXT | — |
| 6 | Step 5: confirm lots → NEXT | — |
| 7 | Step 6: review everything → SAVE | **Raise NCR** |
| 8 | Related Items → `+` → attach photos | (mobile) shell → Raise an issue → camera capture inline |
| **Screens** | **7 wizard pages + 1 attach dialog** | **1 modal** |

We win decisively on speed to record and on field capture (their whole NCR story is desk-shaped;
we have camera-first capture at `SWEEP\036-m-issues-phone.png`). We lose on *completeness* — five
of their fields have no home in our record at all (Location, Estimated Cost, Third Party Approval
Required, Action Type, Action to Prevent Recurrence).

### 2.2 Get an NCR approved

| | CivilPro | SiteProof |
|---|---|---|
| 1 | Right-click NCR → Approval → Request Approval | Register row → `Respond` (root cause + corrective action) |
| 2 | Prompt: "not published — publish and issue?" → Yes | — |
| 3 | Pick Workflow (must be pre-built), Addressees, CC | `Submit Rectification` (upload evidence, gated on ≥1 file) |
| 4 | Build Approval → Preview email → Start & Send | `Review Response` (QM) |
| 5 | Enter days-until-step-due | `QM Approve` (major only) |
| 6 | Attach files **again** to the Approval (NCR-linked photos are not visible to approvers) | `Notify Client` (major only) |
| 7 | Approver: open email → deep link → View Approval → Action Step → pick from 5-option dropdown → comment → attach → Action | `Close` or `Concession` |
| **Config prerequisite** | **A workflow graph must exist before the first NCR can be sent** | none |
| **Steps** | 7 + a configuration project | 5, all inline in the register row |

We are already better here and the gap is structural, not cosmetic. Their one advantage: the
approval email **carries a PDF of the NCR**, so the client acts without logging in.

### 2.3 Track a defect list to close-out

CivilPro: create punchlist (3 fields) → link 3 users with 3 scopes → add items in a grid → per
item, Related Items → Photos → `+` → browse a `pre` folder → rename with " - Pre" suffix →
rectify → repeat with " - Post" → tick Checked → right-click register → Notify Selection → tick
Verified → Notify → client runs Detail Report → ticks Approved → Global Action → Close Out
Punchlist. Roughly **12–15 interactions per defect**, plus a Windows Explorer folder ritual and a
scanned A3 markup PDF attached as a dummy first line item.

SiteProof: **there is no equivalent.** `git grep -il punchlist origin/master -- frontend/src
backend/src` returns nothing. Our closest surface is the NCR register, which is a one-defect-
per-record formal instrument — wrong granularity for a 60-item handover walk. This is the single
largest functional gap in this comparison and it is discussed in §3 T8.

---

## 3. Patterns worth adopting — ranked tickets

Ranked by (value to a real AU civil user) ÷ (build cost). Known internal findings (p-ncrs
triple-nesting, `Assig` truncation, FAB overlap) are excluded.

---

### T1 — Gate strip on the NCR row, with attribution
**Value: high · Cost: low**

CivilPro puts `Checked │ Verified │ Approved` as three adjacent columns **in the row**, coloured
green when resolved, blank when not required (`SHOTS\8246383469327\03.png`,
`SHOTS\8246143993103\07.png`). One glance tells you which of three parties still owes something.

Our register (`SWEEP\135-ncr-desktop.png`) shows a single `Status` chip — `Open` (pink) or
`Closed` (grey) — for a lifecycle that actually has six states and four distinct actors.

**Build:** in `C:\Users\jayso\site-proofv3\frontend\src\pages\ncr\components\NCRTable.tsx`,
replace the single status cell with a four-dot gate strip — **Responded · Rectified · Verified ·
Closed** — driven by fields we already store (`responseSubmittedAt`, `rectificationSubmittedAt`,
`verifiedAt`, `closedAt` in `backend/prisma/schema.prisma:774–808`). Each dot: filled = done with
a `title` of "{who} · {date}" from `verifiedBy` / `closedBy` / `qmApprovedBy`, hollow = pending,
dash = not required (e.g. QM gate on a minor NCR — mirror their "Not Required = no checkbox"
rather than showing a permanently-empty box). Keep the text status chip; the strip goes beside
it. No schema change.

**Page:** NCR register (desktop table + `NCRMobileList.tsx` card).
**Evidence:** `SHOTS\8246383469327\03.png` · `SHOTS\8246143993103\07.png` ·
`SHOTS\8246383469327\07.png` (attribution column).

---

### T2 — Status chips that carry lifecycle colour
**Value: high · Cost: trivial**

Their colour square is load-bearing: red Rejected, blue Client Review, hollow Open
(`SHOTS\14101719661071\02.png`). Ours is monochrome by design —
`frontend\src\pages\ncr\constants.ts` maps `investigating`, `rectification`, `verification`,
`closed`, `closed_concession` **all to `bg-muted text-muted-foreground`**. Five different
lifecycle states render identically grey.

**Build:** give `ncrStatusColors` four tiers within Quiet Authority — destructive tint for `open`
(already), warning tint for `rectification` awaiting the responsible party, an accent tint for
`verification` (ball in our court), success/neutral for `closed` and `closed_concession`
distinguished from each other. One file, ~10 lines. Do it before T1 so the strip and the chip
agree.

**Page:** NCR register, mobile list, lot NCRs tab (`components/lots/NCRsTabContent.tsx` imports
the same map).
**Evidence:** `SHOTS\14101719661071\02.png`.

---

### T3 — Named lifecycle preset views
**Value: high · Cost: low**

Desktop CivilPro ships preset column sets as radio buttons: `Standard · Approval · NCR value ·
Closeout` (`SHOTS\5097311594895\03.png`), punchlist `Default · ByInfo · Approval`
(`SHOTS\6016778426383\05.png`). One click reframes the register for the stage you're working.

Ours has five filter dropdowns (`Status`, `Category`, `Responsible`, `Date From`, `Date To`) and
a `Views` affordance, but no defaults — the user has to know what combination they want
(`SWEEP\135-ncr-desktop.png`).

**Build:** a row of 3–4 preset chips above the filter card in
`frontend\src\pages\ncr\components\NCRFilters.tsx`: **Needs my action** (status ∈ open/
rectification where responsible = me, or verification where I can verify) · **Awaiting the
client** · **Ready to close** · **All**. Pure client-side predicates over data already fetched by
`hooks/useNCRData.ts`. Chips, not radios — matches our existing shell language.

**Page:** NCR register.
**Evidence:** `SHOTS\5097311594895\03.png` · `SHOTS\6016778426383\05.png`.

---

### T4 — The wizard field set: Location, Action Type, Action to Prevent Recurrence
**Value: high · Cost: medium (schema)**

Their creation form is a credible ISO-9001 shape and three fields of it have no home in our
record at all. Checked against `backend/prisma/schema.prisma:774–808`, we have no `location`, no
`actionType`, no `actionToPreventRecurrence`, no `estimatedCost`, no
`thirdPartyApprovalRequired`.

Take the three that change what an auditor sees; leave cost and third-party (cost belongs in the
claims/variation spine, and our approval model doesn't have their third-party concept):

1. **Location** — free text on `CreateNCRModal.tsx`, placed directly under Description as they do
   (`SHOTS\4407417543823\03.png`). "Lot MC10-001" is not an answer to "where"; "Ch 1240, LHS
   batter" is. Feeds the eventual map pin.
2. **Action Type** — the 6-way radio list (`Retest / Repair-Rectify / Replace-Reconstruct /
   Reject / Use as is / Other`) on the **respond** step, not create — it is the responsible
   party's disposition, and `Use as is` is exactly our existing Concession path, so the radio
   becomes the route-selector for it (`SHOTS\4407417543823\05.png`,
   `SHOTS\14101719661071\04.png`).
3. **Action to Prevent Recurrence** — mandatory, on `RespondNCRModal.tsx` beside root cause
   (`SHOTS\4407417543823\06.png`). We currently capture "Lessons Learned" at *close* time in
   `CloseNCRModal.tsx`, typed by the verifier — the wrong person at the wrong moment. CivilPro's
   inversion (Root Cause Detail optional, Prevention mandatory) is right and worth copying
   verbatim; keep our root-cause-description required if we want, but make prevention required
   and make it the responsible party's words.

**Pages:** `frontend\src\pages\ncr\components\CreateNCRModal.tsx`,
`RespondNCRModal.tsx`, `CloseNCRModal.tsx`, `constants.ts`, plus `NCR` model +
`ncrDetailPdfData.ts` for the PDF.
**Evidence:** `SHOTS\4407417543823\03.png` · `05.png` · `06.png` · `SHOTS\5090437163151\06.png`.

---

### T5 — Radio lists over dropdowns for short, comparable option sets
**Value: medium · Cost: trivial**

Severity (3 options) and Action Type (6 options) are radio lists in their wizard —
every option visible, one click to choose, trivial to compare (`SHOTS\4407417543823\04.png`,
`05.png`). Our `Root Cause Category` is a 6-option `NativeSelect` in
`RespondNCRModal.tsx:105–121`, and `Category` is a 6-option `NativeSelect` in
`CreateNCRModal.tsx:213–225`. Both are short, closed, and compared-not-searched — exactly the
case where a dropdown is the wrong control.

**Build:** convert `Category` and `Root Cause Category` to radio groups (we already use one for
Severity at `CreateNCRModal.tsx:300–309`, so the pattern is in-house). Keep `NativeSelect` for
the open-ended pickers (Responsible, Linked Delivery) where the list can grow.

**Page:** create + respond modals.
**Evidence:** `SHOTS\4407417543823\04.png` · `05.png`.

---

### T6 — Before/After evidence pairing, and the same split in the PDF
**Value: high · Cost: medium**

This is the pattern to adopt by *inverting* theirs. CivilPro has no pre/post data model at all —
the distinction is a human typing " - Pre" and " - Post" into a photo title, sourced from two
Windows Explorer folders, imported one at a time through a 16-page picker
(`SHOTS\4408088629775\02.png`). Nothing pairs them; nothing stops Checked being ticked with no
post photo. Yet the **Detail Report with pre/post side by side is the deliverable the client
actually reviews** — the whole clumsy ritual exists to produce that one page.

We already have the primitives: `NCREvidence.evidenceType` (`photo` / `retest_certificate`),
a hard gate that rectification cannot submit with zero evidence
(`RectifyNCRModal.tsx:163` — `disabled={... || !hasEvidence}`), and server-side thumbnails.

**Build:**
1. Add `before` / `after` to `evidenceType` and split the upload control in
   `RectifyNCRModal.tsx` into two labelled dropzones ("Before rectification" / "After
   rectification") instead of one "Photos (Rectification Evidence)" input.
2. Render `NCREvidenceList.tsx` as two columns, paired by index.
3. Extend the existing close gate: closing a rectified NCR requires ≥1 *after* photo, the same
   way rectification already requires ≥1 evidence. This is the gate CivilPro documents itself as
   lacking.
4. Mirror the two-column layout in `frontend\src\lib\pdf\ncrDetailPdf.ts` — a
   before-left / after-right photo block above the close-out text.

**Page:** rectify modal, evidence list, NCR PDF.
**Evidence:** mechanics §1.7 (their manual ritual) · `SHOTS\4408088629775\02.png` (the picker) ·
`SHOTS\6016778426383\06.png` (Detail Report button — the destination).

---

### T7 — Red checklist row that names its NCR and deep-links to it
**Value: medium · Cost: low**

Their pattern: pick an existing NCR in the inspection item's `Non-conformance` dropdown, and the
**item highlights red in the checklist** (mechanics §1.5). One glance says this hold/witness
point has an open non-conformance.

We are two-thirds there. `frontend\src\pages\lots\components\ITPChecklistItemRow.tsx:102` already
paints `bg-destructive/10` when `isFailed`, and line 465–478 renders
`Failed: … View NCR NCR-0003`. Three gaps:

1. The link is `href={/projects/${projectId}/ncr}` — the **register root, no deep link**, even
   though the register supports `?ncr=<id>` (used by `components/lots/NCRsTabContent.tsx:36`).
   One-line fix.
2. Red is tied to `isFailed`, not to *NCR open*. A closed NCR leaves the row red forever; an NCR
   raised against a passing item shows nothing. Drive the tint off the linked NCR's status
   instead — red while open, a neutral resolved marker once closed.
3. No way to link an *existing* NCR to an item (their core mechanic — link, not create-from-here).
   Add it to the row's action set, reusing the responsible-party picker shape.

**Page:** `ITPChecklistItemRow.tsx`, and `NCR` model needs a nullable
`itpCompletionId` for (3).
**Evidence:** mechanics §1.5 · current behaviour at `ITPChecklistItemRow.tsx:465–478`.

---

### T8 — A defect list (punchlist) built on the three-gate model
**Value: high · Cost: high — flagged, not costed as a UI ticket**

We have no punchlist. The NCR register is the wrong instrument for a 60-item handover walk: one
formal record per defect, a six-state lifecycle, a QM gate. CivilPro's punchlist is deliberately
lighter — a header with three fields, a flat editable grid, and three checkbox columns.

If and when this gets built, the UI spec is already drawn by their screens and should be copied
closely, because it is the best-designed surface in their product:

- Flat editable grid, gates as **columns in the row**, not behind a detail view
  (`SHOTS\8246143993103\05.png`).
- Row colour as state: green = resolved (`SHOTS\8246383469327\03.png`).
- **"Not required" renders as an empty cell**, not an unchecked box
  (`SHOTS\8246143993103\07.png`).
- Undo enforced by **greying out** the downstream button until the upstream gate is unwound
  (`SHOTS\6016778426383\02.png` vs `03.png`) — no modal, no error copy.
- **Person Responsible can be a non-user contact** — typing a new name opens a contact form
  (`SHOTS\6015571688975\05.png`). This is how a subbie's leading hand gets assigned defects
  without a seat, and it fits our subbies-are-free model exactly.
- Close-out gated on every item Approved-or-Not-Required, auto-prompted the moment the last item
  resolves.

Two things to fix rather than copy: give the punchlist a **lot and chainage**, not a naming
convention in the Description; and default the gate roles at **project** level so every new
punchlist doesn't re-link the same three people.

**Evidence:** `SHOTS\8246143993103\05.png` · `07.png` · `09.png` · `10.png` ·
`SHOTS\8246383469327\03.png`–`08.png` · `SHOTS\6016778426383\02.png`, `03.png` ·
`SHOTS\6015571688975\05.png`.

---

### T9 — One mobile NCR card, not three
**Value: medium · Cost: low**

Three surfaces render the same NCRs three different ways:

- `SWEEP\136-ncr-phone.png` — register mobile card: NCR no. + status pill top-right, description,
  a two-column CATEGORY / RESPONSIBLE block, Due + Age footer, chevron.
- `SWEEP\042-p-ncrs-phone.png` — subbie portal: orange flag icon, NCR no. + MINOR chip + OPEN
  pill, `Lot:` line, description, "Raised 24 July by jay ryan", plus a bordered **Evidence**
  sub-panel listing filenames — grouped under `OPEN` / `CLOSED` section headers with counts.
- `SWEEP\036-m-issues-phone.png` — foreman shell: NCR no. + chevron, description, then MINOR and
  OPEN as two equal chips on a row with the date right-aligned; filter pills `Open (2) / Closed /
  All` above.

Three card grammars, three chip placements, three date treatments. The foreman-shell version is
closest to Jay's uniform-card rule (icon+label+chip+chevron, no subtitles). CivilPro's answer to
this problem is one grid everywhere — crude, but at least learnable once.

**Build:** promote the foreman-shell card to a shared component and use it in all three places;
keep the portal's Evidence sub-panel as an opt-in prop, since the subbie genuinely needs to see
what was attached.

**Pages:** `frontend\src\pages\ncr\components\NCRMobileList.tsx`,
`frontend\src\pages\subcontractor-portal\SubcontractorNCRsPage.tsx`,
`frontend\src\shell\subbie\screens\NcrsScreen.tsx` / `shell\screens\issues\`.
**Evidence:** the three sweep shots above.

---

### T10 — Approval email carries the PDF, not just a link
**Value: medium · Cost: low**

Their approver gets an email **with a PDF copy of the NCR attached**, plus a deep link, and can
read the whole record on a phone without logging in (mechanics §1.3). We have
`ncrDetailPdf.ts` and `NotifyClientModal.tsx` already; attaching the generated PDF to the client
notification is a small backend change with an outsized effect on how quickly a superintendent
responds.

**Page:** `frontend\src\pages\ncr\components\NotifyClientModal.tsx` + the backend NCR notify
route.
**Evidence:** mechanics §1.3.

---

### T11 — Report options as toggles at the point of export
**Value: low · Cost: low**

Their print rail is a `Report Options` accordion of three No⇄Yes toggles — Show Related Photos /
Show CloseOut / Show Root Cause — with `SAVE AS DEFAULT`, above the list of outputs
(`SHOTS\4407417543823\09.png`). Sensible: the same record goes to the client (photos yes, root
cause no) and to the internal QA file (everything). Our NCR print button
(`NCRTable.tsx:270–277`) generates one fixed PDF.

**Build:** a small options popover on the print action — include photos / include root cause and
prevention / include close-out — persisted to localStorage. Ties into the report-surfaces
workstream; do it there, not standalone.

**Evidence:** `SHOTS\4407417543823\09.png`.

---

## 4. Anti-patterns to avoid

1. **Publish/unpublish as the edit lock, with no visual state.** The only signal that a record is
   frozen is a tick in an `Is Published` column (`SHOTS\10393437160207\03.png`). The user
   discovers the lock by failing to edit. If we ever freeze a record for a client, say so on the
   record with a lock affordance and an explicit "Reopen for editing" action.
2. **Editing a state-machine graph as a user task.** `SHOTS\14101719661071\05.png`, `06.png` —
   the documented remedy for a rejected NCR is to drag a new arrow on a workflow diagram and
   configure its action permissions. Rejection-then-resubmit is the *normal* AU civil lifecycle.
   Ours must be a `Resubmit` button that carries the client's comment through, and nothing else.
3. **Attribution hidden behind a Column Chooser.** Who checked, who verified, who approved is the
   entire point of the record, and it requires opening a flyout and dragging a column onto the
   header (`SHOTS\8246383469327\06.png`). Attribution is default-visible or it doesn't exist.
4. **Two attachment surfaces where one is invisible to the approver.** Photos linked to the NCR
   are *not* shown to approvers and *not* attached to the approval email; you must attach them
   again (mechanics §5.11). One evidence set, always visible to whoever is deciding.
5. **A configuration project between signup and the first approved NCR.** Approval workflows must
   be pre-built before a single NCR can be sent. Ship working defaults; make configuration
   optional and late.
6. **A dummy line item with all gates switched off** as official best practice
   (mechanics §1.7 step 5). When users invent a fake row to hold data the model can't express,
   the model is wrong. Our version of that pressure will be "where do I put the marked-up plan" —
   answer it with the spatial map, not a fake item.
7. **Full-project pickers with no context filter.** Attaching a photo means scanning 77 photos
   over 16 pages (`SHOTS\4408088629775\02.png`); a document means 262 rows
   (`SHOTS\4408088629775\03.png`). Default any picker to this lot, this week, then let the user
   widen.
8. **The printer icon that only exists on the register.** You must navigate out of the item you
   are looking at to print it (`SHOTS\8246383469327\08.png`). Export belongs on the thing being
   exported.
9. **Keyboard-only destructive actions.** Removing a mis-linked lot or user is "press Del". Their
   own Web wizard fixed this with a trash icon per row (`SHOTS\4407417543823\07.png`) — copy the
   fix, not the original.
10. **A confirmation page as compensation for a six-page form.** `SHOTS\4407417543823\08.png` is a
    good screen solving a problem we don't have. Do not add a review step to our single-modal
    create flow; if the form grows past one screen, group it into labelled sections first.

---

## 5. Verdict

CivilPro's NCR creation is a 2005 WinForms grid transplanted into a browser — seven pages, a
right-click context menu as the primary action surface, and a workflow-graph editor as the
documented fix for a rejected NCR — but their **field set is the best-argued part of the product**
(structured Root Cause Category, mandatory Action to Prevent Recurrence, an explicit Location),
and we are missing three fields of it outright.

Their punchlist is the opposite: the single best-designed surface either product has. Three gate
columns in the row, colour as state, "not required" as an empty cell, and undo taught by greying
out the next button. We have no punchlist at all, and the gate model transfers to our NCR row
today (T1) whether or not we ever build one.

Highest-leverage work, in order: **T1 gate strip + T2 status colour** (a day, transforms the
register from "a list of things" into "a list of who owes what"), **T4 field set** (the audit
credibility gap), and **T6 before/after evidence with a hard close gate** — the place where their
documented workflow is a Windows Explorer folder and a naming convention, and ours can be a
structured pair captured on a phone at the defect.

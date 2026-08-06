# UI benchmark — ITP / Checklist / Hold Point flow: CivilPro vs SiteProof

Scope: the screens a site engineer and a superintendent actually touch — completing a checklist,
raising and releasing a hold point, and seeing progress across lots. Template *authoring* and
import formats are out of scope except where they leak into the field UI.

Path conventions used below (all absolute):

- `SHOTS` = `C:\Users\jayso\AppData\Local\Temp\claude\C--Users-jayso-site-proofv3\1f629074-8d2a-4548-84d3-660e9613b45f\scratchpad\civilpro-kb\shots`
- `OURS` = `C:\Users\jayso\site-proofv3\.gstack\dev-browser\ui-sweep2-2026-08`

Mechanics reference read first:
`C:\Users\jayso\AppData\Local\Temp\claude\C--Users-jayso-site-proofv3\1f629074-8d2a-4548-84d3-660e9613b45f\scratchpad\civilpro-kb\findings\itp-holdpoints-tests.md`

Our implementation was read from source, not inferred from screenshots — the file paths cited in
§2 and §3 are real and current.

---

## 1. Their flow, screen by screen

### 1.1 Entry point: a global Checklists register

`SHOTS\4407299313167\02.png` · `SHOTS\12322693519631\02.png`

CivilPro's front door to inspection work is **Quality Assurance > Checklists** — one flat register
of every lot × ITP pairing on the project, not a tab buried inside a lot. Columns: `Open Detail`,
`Lot`, `ITP`, `Lot Status`, `Description`, `Spec. Reference`, `Raised By`, then three roll-up
tick columns `Check…` / `Verified` / `Appro…`, then `Eff. Close` (effective close date). Lot and
ITP are hyperlinks; `Open` opens the checklist. Footer reads `Count: 16` / `Count: 37`.

The three roll-up ticks are the useful bit: from the register you can see, per lot, whether the
checking is done, whether someone independent has verified it, and whether the authority has
signed off — before opening anything. Lot Status renders as a coloured square plus word
(`Open` white, `Conformed` green, `Guaranteed` blue).

### 1.2 The checklist grid — the core screen

`SHOTS\4407299313167\03.png` (annotated: the Checked/Verified columns are the subject)

Columns, left to right: drag handle, select checkbox, `Open Detail`, `QVC Line #`, `Item Type`,
`HpWpC`, `Reference Text`, `Description`, `Has Tests`, **`Checked`**, **`Verified`**,
**`Approved`**, `NCR No.`, `Comment`.

The three state columns are the whole design. Each renders one of three things:

- an **empty white checkbox** — this box is required and not yet done
- a **green filled tick** — done
- a **greyed-out, non-interactive box** — this box is *not required* for this row

So a Check Item shows one live box (Checked) and two greyed; a Hold Point shows all three live.
The required/not-required distinction is visible without opening anything, which is the thing our
UI cannot currently express at all.

**Row colour is the status language**, and it is consistent across every screenshot:

| Colour | Meaning | Evidence |
|---|---|---|
| white | open, work outstanding | `SHOTS\4407299313167\03.png` rows 2, 4 |
| pale green | row complete (all *required* boxes ticked) | same shot, rows 1, 3, 5 |
| gold / amber | approval requested, awaiting the approver | `SHOTS\4407291428111\02.png`, `SHOTS\4407299313167\04.png` |
| pink / red | an NCR is attached to this row | `SHOTS\4407811518351\04.png` row 3 |
| blue | currently selected | everywhere |

`Reference Text` is worth calling out: it is being used as a **short activity label** —
"Loosen & Breakdown Material", "Excavate to Batter Slopes", "Batter Tolerance Check" — while
`Description` holds the full spec sentence (`SHOTS\4407811518351\02.png`). Two fields, one
scannable, one authoritative. Hold Point rows put a bold red `HOLD POINT 5` / `WITNESS POINT` /
`MILESTONE` in that same column (`SHOTS\4407299313167\04.png`), so the point type is legible from
across the room, not just as a small type chip.

`Item Type` also carries a `Heading` value that renders as a structural section title row
(`SHOTS\4407811518351\02.png` row 1, `CUTTING EXCAVATION`), giving free grouping without a
separate grouping mechanism.

### 1.3 Evidence attachment — the Related Items rail

`SHOTS\4407299313167\04.png`

Selecting a row and opening the chain icon slides in a right-hand **Related Items** panel scoped
to the selected row: `Checklist Items > Filestore Documents` (download / link / `+`),
`Approvals` (split into `Related` and `Checklist Linked`, each showing
`297: QVC UBNTH006 | Unbound Pav…`), and `Photos` (download / **camera** / link / `+`). The camera
icon opens the device camera directly on tablet.

The same rail on an Approval (`SHOTS\4407804517007\02.png`) is much richer: `Direct Item`,
`Direct Lot`, `Additional Lots`, `Non Conformances (NCRs)`, `Filestore Documents`, `Email Log`,
`Punchlist Items`, `ITP Detail Links`, `Checklist Item Links`, `Photos`, `Notifications`. It is
their universal "everything hanging off this record" pattern.

### 1.4 Per-row actions — one menu, everything on it

`SHOTS\4407291428111\01.png` (right-click menu and the `Action on Selection` rail, identical items)

`Add Comment` · `Mark N/A` · `unMark N/A` · `Lock/Unlock Status Columns` · **`Request Approval`** ·
`New Test Request` · `View Approval` · **`Quick Approval`** · `Set Manual Approval` ·
`Remove Manual Approval` · `View Manual Approval` · `View Quick Approval` · `Delete Selected`.

Unavailable actions are greyed rather than hidden, so the menu shape is stable and the user learns
one map. Note that **raising a hold point, raising a test request and QR-releasing all live on the
checklist row** — you never leave the checklist to make progress.

### 1.5 Raising a hold point

`SHOTS\4407291428111\02.png` — the `Request Approval` modal

Fields: `Workflow:` (prefilled `Hold Point Workflow - Default`), `Days until 1st step due:` (`1`),
`Addressees:` with a checkbox **`Show only users that can approve`** above a chip field
(`Principal's Representative - Client ⊗`) plus an `Add Group 👥` link, `CC:` with its own
`Add Group`, `Attachments:` with link and `+` icons. Two submit buttons:
**`CREATE APPROVAL`** (draft, sends nothing) and **`START & NOTIFY`** (send now).

Behind the modal, two rows already show gold with a **`?` glyph in the `Approved` cell** — that is
the pending indicator, and it is the single cheapest, most useful thing on the whole screen.
Confirmed again in `SHOTS\4407291428111\06.png`, where the selected Hold Point row carries a gold
`?` in Approved while Witness Point rows below show a plain grey (not-required) box.

The draft path then opens `Start Workflow` (`SHOTS\4407291428111\04.png`) with `Workflow`,
`Days until 1st step due`, `Attachments` (chip `TEST REPORT ⊗`), and
**`START WORKFLOW (PREVIEW)` / `START WORKFLOW (SEND)`** — preview-before-send as a first-class
button, not a hidden option.

The workflow list itself (`SHOTS\4407226059919\04.png`) is one row per approval category:
`Witness Point Workflow - Default`, `Purchase Order`, `Non-conformance`, `Independent Approval`,
`Hold Point Workflow - Default`, `Check Item Workflow - Default`, with `Is Active` / `Is Default` /
`Approval Category` columns.

### 1.6 The approval record

`SHOTS\4407291428111\07.png` · `SHOTS\4407804517007\02.png`

Header `Approval 34` / `Approval 342`. `Status` reads **`HP Requested`**. Then `Linked Item`
(hyperlink `Check/Hold/Witness Point`), `Publish Date`, `Priority`, `Requested By`, `Date Created`,
`Action Date`, `Due Days`, `Workflow`, `Approvers` (chip), `CC`, `Subject Text`
(`HOLD POINT 6 | Unbound Pavement MC02 Ch (st):65,650 o/s -5 to 8 …`), and `Approval Text`.

`Approval Text` is auto-composed and the composition is good:

```
Lot: UBNTH008 - Unbound Pavement
ITP: Unbound Pavement - Construction [Type 2,3 & 4]   Clause: MRTS05 Cl. 9.5.1
<the inspection description>
```

Lot, ITP and Clause as labelled fields, then the actual inspection wording. The approver reads
what they are approving and against which clause without opening anything. The same block is
reproduced verbatim in the notification email (`SHOTS\4407804517007\01.png`), which also carries
`Project` / `Requested By` / `Request To` / `Request Cc` / `Request Date` / `Required Action Date`,
a sign-in link, and **the Electronic Checklist PDF as an inline attachment thumbnail**.

At the bottom, `Action Logs` — `Log Date` / `Action By` / `Action` / `Status` / `Comment`, first
entry `30/03/2026 · Amos Soo · Hold Point Requested · Workflow started 30/3/2026 by Amos Soo`.
Footer buttons `VIEW PROGRESS` and `ACTION STEP`. `Show QR Code` sits top-right of the details
panel — any raised approval can be flipped to QR release at any time.

### 1.7 The approver's action screen

`SHOTS\4407804517007\03.png` — `Action Approval Step` modal

`Current Status` (read-only `HP Requested`) → **`Action`** dropdown (`Conditionally Approve`) →
**`Status after Action`** (read-only preview: `Conditionally Approved`) → `Days to Complete Next
Step` → `Attachments` → `Comments:` with a live counter reading **`51 characters - min 25`** →
`ACTION (SEND)`.

Three details worth stealing outright: the **status-after preview** (the approver sees where this
lands before committing), the **live character counter with the minimum stated**, and the action
set itself — Approve / Conditionally Approve / Rejected / **Request NCR** / Other Approval, with
the NCR raised from inside the approval without navigating away.

### 1.8 QR quick approval

`SHOTS\12322693519631\04.png` → `05.png` → `06.png` — the full three-screen flow

On the requester's iPad: select the Hold Point row → `Action on Selection` → `Quick Approval`.
A centred dialog renders with the instruction **"Please have the approver scan the code or click
the 'Send Notification' button"**, a QR code, and `CANCEL` / `SEND NOTIFICATION`
(`SHOTS\12322693519631\05.png`). The co-located fallback is a nice touch: same dialog handles
"he's standing here" and "he's not".

The approver's phone screen (`SHOTS\12322693519631\06.png`) is the standout artefact of the whole
corpus — a genuinely stripped, single-purpose screen:

- blue bar: `‹ Quick Approval`
- section `Inspection Details`: `Hold Point & Witness Point Check: Hold Point`, `Reference Text`
  (bold `HOLD POINT`), `Description` (the full inspection wording)
- section `Quick Approval Details`: a single `Comments` textarea
- sticky footer: `CANCEL` and a solid blue **`APPROVE`**

No navigation, no register, no thread, no other verbs. Deliberate: the KB states Approve is the
only option and that Quick Approvals are intentionally kept out of the Approvals register.

### 1.9 The two printed checklists

`SHOTS\4407299313167\05.png` shows the report picker (`Electronic Checklist` / `Field Complete
Checklist`); `06.png` and `07.png` are the outputs.

**Electronic Checklist** (`SHOTS\4407299313167\06.png`) — the digital state as a signed-looking
record. Header block: checklist number, full lot description with chainages, `Date Open` /
`Date Work Started`. Then numbered rows with four right-hand columns `Check` / `Verify` /
`Appr.` / `NCR`. Each satisfied cell contains **initials over a date** (`AS` / `25/10/21`), not a
tick; not-required cells are solid grey. Beneath a row with tests, indented and italic:

```
Q111A: insitu Dry Density (Sand Replacement)        1 per 1,000m2 || 2 per lot (N)
    Compliance:  95% RDD
```

— test method, frequency, minimum per lot, and the acceptance criterion, on the row. At the foot,
an **`Abbreviation Key`** mapping `AS → Amos Soo (Building Point )`. Footer: print date, revision
number and date, page x of y.

**Field Complete Checklist** (`SHOTS\4407299313167\07.png`) — same layout with the four columns
**empty and ruled for pen**, plus an `Item No. / Description / Qty` table, a `Comments` block, and
two signature blocks: **`Responsible Officer`** and **`Verifying Authority`**, each with
Signature / Print Name / Date rules. This is the only output carrying signature blocks, and the
documented loop is print → complete in pen → scan → link to the lot filestore.

### 1.10 ITP Progress Matrix

`SHOTS\10088266592911\02.png` (entry: Specifications (ITP) → `Reports` → `Checklist Progress`) ·
`03.png` (empty state) · `04.png` (populated)

**Desktop-only, V12.** Toolbar: `Get Status Matrix`, `Export to Excel (data aware)`,
`Export to Excel (WYSIWYG)`. Filter bar: `ITP:` dropdown, `Revision:` dropdown, and three
checkboxes `Unconformed Only` / `HP` / `WP` / `Check`.

The grid is **lots down, inspection points across**. Row headers: `LotNumber` (hyperlink) and
`Description` (which in this data includes chainage and even raw lat/long strings). Column
headers are numbered and typed: `1. WITNESS PO…`, `2. HOLD POINT`, `3. HOLD POINT`,
`4. HOLD POINT`, … `11. HOLD POINT`. Cells contain one of:

- `No Approval` (plain grey text)
- `#01057: Requested (18/10/2018)` — hyperlink into the approval
- `Approved` in green

Below the grid, a detached **`Column Key`** table mapping `Col. …` → `Inspection` full text
("All mixes >20MPa have a trial mix complete and Administrator given 3 days notice…").

This is the only cross-lot QA rollup in the entire corpus, and it is trapped in the thick client.

---

## 2. Click-path comparison

Our surfaces, for reference:
`C:\Users\jayso\site-proofv3\frontend\src\pages\lots\components\ITPChecklistTab.tsx` and
`ITPChecklistItemRow.tsx` (desktop tab),
`C:\Users\jayso\site-proofv3\frontend\src\shell\screens\lots\ItpRunScreen.tsx` (foreman shell run),
`C:\Users\jayso\site-proofv3\frontend\src\pages\holdpoints\HoldPointsPage.tsx` (register).

### A. Complete one checklist row with photo evidence

**CivilPro (web or tablet — identical UI):** QA > Checklists → `Open` → tick `Checked` → tick
`Verified` → select the row → chain icon → expand `Checklist Items` → expand `Photos` → camera or
`+` → pick file → **`SAVE`**. Ten interactions, ending in an explicit save that can be lost.

**SiteProof desktop:** Lots → lot → scroll past the header, chainage tiles and the Evidence
Readiness panel → `ITP Checklist` tab → expand the category → `Pass` → `Add Photo` → pick file.
Eight, autosaved. But the tab is below the fold (`OURS\153-lot-detail-desktop.png` — the tab strip
sits at y≈866 of a 900px viewport, with zero rows visible).

**SiteProof foreman shell:** Lots → lot → Inspection → `Pass` → `Add evidence photo` → camera. Six,
autosaved, one check per screen with 58px thumb-zone buttons and a `Criteria:` line.
`OURS\041-p-itps-phone.png` shows the entry list.

**Verdict:** we win the field case decisively and the desktop case narrowly. Their advantages are
structural, not per-click: (i) the global Checklists register means you can start from "what
inspection work exists" rather than having to know the lot first; (ii) `Checked` and `Verified` are
two adjacent columns on the same row, so the second pair of eyes is one click in the same place —
ours routes verification through a separate `PendingItpVerificationsSection` on the ITP page,
which is a different screen entirely (`OURS\131-itp-desktop.png`, the "ITP items awaiting
verification" panel).

### B. Raise and release a hold point

**CivilPro, normal path — requester:** select row → `Action on Selection` → `Request Approval` →
`START & NOTIFY`. **Four clicks**, because Workflow and Addressee are both prefilled. Row goes gold
with a `?`.
**Approver:** email → link → `ACTION STEP` → pick action → comment → `ACTION (SEND)`. Six, and the
action can be Approve, Conditionally Approve, Reject or Request NCR.

**CivilPro, QR path:** select row → `Action on Selection` → `Quick Approval` → QR renders. Four.
Approver: point phone camera → sign in → `APPROVE`. Three. Seconds, in person.

**SiteProof:** **you cannot raise a release from the checklist row at all.** Both mobile runs put
up a panel reading *"This is a hold point. It can't be ticked complete until it's released… Open
the Hold Points register to request or record the release"* with an `Open Hold Points` button that
navigates to `/projects/:id/hold-points`. That register currently holds **1,728 hold points**
(`OURS\129-hold-points-desktop.png`) and on a phone is a stack of summary cards and filters before
you reach the first row (`OURS\130-hold-points-phone.png`). The path is: leave the checklist →
Hold Points → filter by lot → find the row → `Request Release` → date → time → recipients →
`Request Release`. Roughly eight interactions plus a full context switch, on the exact screen
where the user is standing in front of the work.

Then the row you came from **still shows the same generic lock**. Confirmed in source:
`ITPChecklistItemRow.tsx:93` derives its only hold-point state as
`const isReleased = !!completion?.holdPointRelease?.releasedByName` — the row knows *released or
not* and nothing else. The `HoldPoint.status` values `pending` / `notified` / `released`, the
`scheduledDate`, and `notificationSentAt` never reach the checklist row. There is no equivalent of
the gold `?`.

**Approver side:** ours is genuinely good and in one respect better than theirs — the public token
page (`PublicHoldPointReleasePage.tsx`) shows the evidence package inline, states
`{complete}/{total} checklist items`, locks the releaser name to the invited recipient, and
captures a real drawn signature. But it has **exactly one verb: `Release Hold Point`.** A
superintendent who wants to say "no" or "yes, subject to the 28-day break" has to pick up the
phone, and whatever they say never lands in the record.

### C. See ITP progress across lots

**CivilPro:** Specifications (ITP) → select ITP → `Reports` ribbon → `Checklist Progress` → set
ITP + Revision + filters → `Get Status Matrix`. Six steps, **thick-client only** — a web or tablet
user cannot do this at all.

**SiteProof:** not possible in any form. Nearest surfaces are the Hold Points register (hold points
only, but genuinely good — status, notified, scheduled, released, batch request, CSV export), the
`ITP items awaiting verification` panel (verification queue only), and a single project-wide
`ITP Completion` percentage tile on the QM dashboard. Nothing renders lots × checklist items.

---

## 3. Patterns worth adopting — ranked tickets

Ranked by field value ÷ build cost against our current code, not by how impressive the feature is.

---

### T1 — Hold-point rows must show *requested* state, and let you request from the row
**Priority: highest. This is the gap that costs a real user real time today.**

**What to build.** Two joined changes:

(a) Plumb `HoldPoint.status`, `scheduledDate` and `notificationSentAt` through to the checklist
item so the row can render three distinct states instead of two:

| State | Row shows |
|---|---|
| no release requested | current lock panel + a `Request release` action |
| requested / `notified` | a **pending pip** plus `Requested — {recipient}, due {scheduledDate}` |
| released | existing `Released by {name}, {org} on {date} via {method}` |

(b) Put a `Request release` button *on the row* (desktop) and *in the gate panel* (both mobile
runs), opening the existing `RequestReleaseModal` prefilled with this lot and hold point — instead
of the `Open Hold Points` navigation that exists today.

**Which page.**
`C:\Users\jayso\site-proofv3\frontend\src\pages\lots\components\ITPChecklistItemRow.tsx` (the
`isReleased` binary at line 93 and the lock panel),
`C:\Users\jayso\site-proofv3\frontend\src\shell\screens\lots\ItpRunScreen.tsx` (the
`awaiting-release` gate panel and its `Open Hold Points` button),
`C:\Users\jayso\site-proofv3\frontend\src\shell\subbie\screens\SubbieItpRunScreen.tsx`.

**Evidence.** `SHOTS\4407291428111\02.png` and `SHOTS\4407291428111\06.png` — gold row + `?` in
the Approved cell. Ours: `OURS\130-hold-points-phone.png` shows what we currently make a foreman
navigate to instead.

**Note.** The pending pip is worth shipping even if (b) slips — right now a foreman standing at a
hold point cannot tell whether someone in the office already called the super.

---

### T2 — QR release: render the token we already mint as a QR code
**Priority: very high. Highest value-to-effort ratio in this document.**

**What to build.** We already have `HoldPointReleaseToken` (sha256-constrained, expiring) and a
working public release page. Add: a `Show QR code` action on an awaiting-release hold point that
renders the existing public release URL as a QR on screen, in a dialog that also carries the
existing "send email" action — copy CivilPro's co-located framing verbatim in spirit:
*"Have the approver scan this, or send them the link."*

**Which page.** `C:\Users\jayso\site-proofv3\frontend\src\pages\holdpoints\HoldPointsPage.tsx` +
`components\RequestReleaseModal.tsx`, and the row action in T1(b). We already render QR codes
elsewhere (`frontend\src\components\lots\LotQRCode.tsx`) so there is no new dependency.

**Evidence.** `SHOTS\12322693519631\05.png` (QR dialog + `SEND NOTIFICATION` fallback),
`SHOTS\12322693519631\06.png` (approver's phone screen).

**Where we should beat them.** CivilPro deliberately makes QR approvals *approve-only* and keeps
them **out of the Approvals register** — a hold-point release with no register record is a hole in
an evidence pack, and their own KB admits the traceability is scattered. Ours should hit the same
token-backed public page, capture the same signature, and land in the register like any other
release. Same three-second field experience, a real audit trail.

---

### T3 — Give the approver more than one verb
**Priority: high.**

**What to build.** On the public release page, replace the single `Release Hold Point` submit with
an action set: **Release** / **Release with conditions** / **Reject** / **Raise NCR**. Conditions
and Reject require a comment with a stated minimum and a **live counter** (`51 characters -
min 25`), and set a "respond by" date. Reject returns the row to the contractor with the reason
visible on the checklist row. Raise NCR creates an NCR against the lot — we already have the NCR
module, so this is a link, not a build.

Also copy the **`Status after Action`** read-only preview: tell the approver where their choice
lands before they commit.

**Which page.**
`C:\Users\jayso\site-proofv3\frontend\src\pages\holdpoints\PublicHoldPointReleasePage.tsx` and
`PublicHoldPointBatchReleasePage.tsx`; the reject/conditional state then needs rendering on the
row (T1).

**Evidence.** `SHOTS\4407804517007\03.png`.

---

### T4 — Author acceptance criteria, and print it on the row
**Priority: high. Smallest diff on this list.**

**What to build.** `acceptanceCriteria` already exists on `ITPChecklistItem`, is already displayed
on all three checklist surfaces, and is already round-tripped by `EditTemplateModal` — but
**there is no input for it anywhere in the editor**, so it is blank on every template a customer
builds themselves. Add the field to the item editor. Then put it on the printed checklist the way
they do: indented under the row, with the test method and frequency beside it.

**Which page.**
`C:\Users\jayso\site-proofv3\frontend\src\pages\itp\components\TemplateChecklistEditor.tsx` (add
the input) and `itpTemplateFormData.ts:23-32` (`ChecklistEditorItem` currently omits it), plus
whatever backs `Print Checklist` in `ITPChecklistTab.tsx`.

**Evidence.** `SHOTS\4407299313167\06.png` — `Compliance: 95% RDD` printed under the row with
`1 per 1,000m2 || 2 per lot (N)`. Also `SHOTS\4407400951695\04.png` for how they capture it
(`Unit`, `Quantity Basis`, `Freq. Test (norm)`, `Min Tests per Lot`, rich-text `Compliance`).

---

### T5 — Initials-and-date cells, plus an abbreviation key, on the printed checklist
**Priority: high, low cost.**

**What to build.** Our printed checklist should render each satisfied state as **initials over a
date** in a boxed cell rather than a tick, with grey fill for cells that were never required, and
an `Abbreviation Key` at the foot mapping initials → full name and organisation. That single change
turns a printout into something a client's document controller will accept.

Ship a second print mode at the same time: a **Field Complete** variant with the cells empty and
ruled, an `Item No. / Description / Qty` block, a `Comments` block, and `Responsible Officer` /
`Verifying Authority` signature blocks — for the crews and clients who still want wet ink, with the
scan landing back on the lot.

**Which page.** The `Print Checklist` path from
`C:\Users\jayso\site-proofv3\frontend\src\pages\lots\components\ITPChecklistTab.tsx`.

**Evidence.** `SHOTS\4407299313167\06.png` (electronic) and `07.png` (field/wet-ink),
`SHOTS\4407299313167\05.png` (the two-option report picker).

---

### T6 — Three state pips on the checklist row: done / verified / released
**Priority: medium-high.**

**What to build.** Not a rebuild of our completion model — just make the three parties' state
visible in one glance on the row, as three small pips at the right edge, each in one of three
renderings: **filled** (done, with a tooltip carrying who and when), **outline** (required, not
yet done), **greyed** (not required for this row). Today verification state is a badge that only
appears once something is pending, and release state is a lock panel; a scanning eye cannot tell
a row needing verification from one that does not.

For that to mean anything, the template editor needs to be able to *say* a row requires
verification — CivilPro's `Check Options Toggle` (`Inspect Required` / `Verify Required` /
`Authority Required` / `Included on Checklist`) is the model. Our editor currently derives
everything from the point-type dropdown.

**Which page.** `ITPChecklistItemRow.tsx` (render),
`TemplateChecklistEditor.tsx` (author), `MobileITPChecklistSections.tsx` (mobile list row).

**Evidence.** `SHOTS\4407299313167\03.png` (the greyed vs live vs green box language),
`SHOTS\15450163334415\01.png` and `02.png` (the toggles).

**Caution on their execution:** they label the same three flags three different ways —
`Inspect/Verify/Authority Required` on the ITP, `Check/Verify/Approval Required` on the checklist,
`Checked/Verified/Approved` as grid columns. Pick one vocabulary and hold it everywhere.

---

### T7 — ITP Progress Matrix, on the web
**Priority: medium. New page, but they can't answer it on web or mobile at all.**

**What to build.** A lots × checklist-items grid for one ITP template: pick a template, filter to
`Hold points` / `Witness points` / `All` and `Unresolved only`, get a grid of every lot using that
template against every checklist item. Export CSV.

**Design improvements over theirs, all cheap:**

- **Pips, not sentences.** Their cells read `No Approval` in ~90% of positions — pure noise
  (`SHOTS\10088266592911\04.png`). Use a glyph per state and reserve text for the interesting cells.
- **Sticky first column.** Eleven columns already overflows; the lot number must not scroll away.
- **Column key on hover.** Theirs is a detached table below the grid, so reading column 7 means
  scrolling down and counting. Put the inspection text in a tooltip on the header, and keep a
  printable key for export only.
- **Lot description column should not carry raw lat/long strings** — theirs does, and it eats a
  third of the width.

**Which page.** New route under `frontend\src\pages\itp\`, linked from `ITPPage.tsx`.

**Evidence.** `SHOTS\10088266592911\04.png` (populated), `03.png` (filter bar).

---

### T8 — A cross-lot Checklists register
**Priority: medium.**

**What to build.** A project-level list of every lot × ITP with `Lot`, `ITP`, `Lot Status`,
`Description`, `Spec reference`, and roll-up state (checked / verified / released) — the entry
point for "what inspection work is open", which today requires knowing the lot first and clicking
through a lot detail page whose ITP tab is below the fold.

We have most of the ingredients: `PendingItpVerificationsSection` is already a real cross-lot list,
just scoped to one status.

**Which page.** New section or route under `frontend\src\pages\itp\`.

**Evidence.** `SHOTS\4407299313167\02.png`, `SHOTS\12322693519631\02.png`.

---

### T9 — A short label per checklist item, distinct from the full description
**Priority: medium-low, but it compounds with our mobile design.**

**What to build.** One extra field: a short activity label (~40 chars) shown as the row title, with
the full spec description underneath or on tap. CivilPro does this twice over — `Reference Text` as
the scannable label against `Description` as the authority, and `AltQvcText` as a separate shorter
wording for the field checklist. `SHOTS\11990530011279\04.png` shows both in one row:
Description = *"Any trees, shrubs and overhanging branches to be left undisturbed shall be clearly
marked prior to clearing operations reaching the area concerned."*, AltQvcText = *"All undisturbed
vegetation clearly marked."*

Our one-check-per-screen mobile run currently renders the full spec sentence as the question, which
is exactly the problem `AltQvcText` was invented to solve.

**Which page.** `TemplateChecklistEditor.tsx`, `ItpRunScreen.tsx`, `ITPChecklistItemRow.tsx`.

---

### T10 — Structural finding, not a UI ticket: one ITP per lot
CivilPro's `Add Itp` screen (`SHOTS\4407226150543\03.png`) attaches ITPs to a lot with a `+` per
row and a running `Number of Itps` count — a lot routinely carries several (Subgrade + Unbound
Pavement + Asphalt). Our `ITPInstance.lotId` is **unique** in
`C:\Users\jayso\site-proofv3\backend\prisma\schema.prisma`, so a lot can hold exactly one template.
Worth surfacing to whoever owns the data model; nothing in the UI layer can work around it.

---

## 4. Anti-patterns to avoid

1. **The same desktop grid, unchanged, on a tablet.** `SHOTS\12322693519631\03.png` and `04.png`
   are an iPad: eleven columns, ~8pt body text, a right-click context menu, and checkbox targets
   well under 44px — for a user in gloves. Their entire mobile story is "it runs in a mobile
   browser". Our foreman shell (`OURS\041-p-itps-phone.png`, `ItpRunScreen`) is the correct answer
   and we should not regress toward a responsive grid.

2. **Explicit `SAVE` / `CANCEL` / `SAVE & CLOSE` on a field data-entry screen.** Every CivilPro
   checklist screenshot has them. A morning of ticks in a cutting with no signal dies on `CANCEL`
   or a dropped session. Our `All saved` pill (`OURS\159-m-lot-itp-phone.png`) plus offline queueing
   is strictly better — keep it, and don't let a "save changes?" pattern creep into the ITP run.

3. **Rows that go green without anyone touching them.** In `SHOTS\4407299313167\03.png` rows 3 and
   5 are `Check Item`s with no configured boxes; they render as complete pale-green alongside rows
   someone actually inspected. Their own training video concedes it: *"We didn't configure these
   ones… that's why CivilPro thinks those are already closed out."* Silent false conformance in an
   evidence system. If we adopt required/not-required flags (T6), a row with **zero** required
   actions must render as *not applicable* or be rejected at template save — never as complete.

4. **Three vocabularies for the same three flags.** `Inspect/Verify/Authority Required` →
   `Check/Verify/Approval Required` → `Checked/Verified/Approved`
   (`SHOTS\15450163334415\01.png` vs `02.png` vs `SHOTS\4407299313167\03.png`). Users have to learn
   a translation table. We already have `lib/statusLabels.ts` — route every one of these through it.

5. **Repeating the null state as prose in every cell.** `No Approval` appears ~50 times in one
   screen of `SHOTS\10088266592911\04.png`. The eye has to filter the page to find the two green
   `Approved` cells. Absence should be quiet.

6. **A detached column key.** Same shot: the grid says `7. HOLD POINT`, and the meaning of 7 lives
   in a separate table below the fold. Reading one cell is a two-place lookup.

7. **Configuration burden pushed to the user.** Saved Views, drag-drop column choosers, a
   recommended font (*"Segoe UI, 9"*), a per-user "tablet view" you build yourself, and
   *"make sure your view is not filtered"* as a documented troubleshooting step in four separate
   articles. Role-tailored defaults that are right out of the box beat configurability.

8. **State that depends on invisible configuration.** Their single most-documented FAQ: raising a
   hold point on a row typed `Check Item` shows an **empty workflow dropdown** with no explanation,
   and fixing it requires editing both the checklist row and the master ITP. If an action is
   unavailable, say why on the spot.

9. **Free-text as the audit record.** `Approval Text` is an editable rich-text blob that is also
   the thing the approver is deemed to have approved; the standing-approval flow has users
   *typing an approval number into a free-text reason field* to link records. Compose from
   structured fields (their auto-composed `Lot: / ITP: / Clause:` block is the good version of
   this) and store references as references.

10. **A separate, forgettable "now actually send it" step.** Not visible in these shots but
    documented across three of their registers, with `CREATE APPROVAL` sitting beside
    `START & NOTIFY` as an equal-weight button. Created-but-never-sent is their default failure
    mode. Our `Request Release` sends — keep drafting as the exception, and if we ever add it,
    surface an unsent count.

---

## 5. Verdict

CivilPro's grid is ugly and their tablet story is a shrunken desktop app, but the *information
design* of their checklist row beats ours: three state columns that show at a glance who still owes
what, a gold `?` when an approval is out, row colour that encodes NCR and pending, and every action
— raise hold point, raise test, QR-release — available on the row without leaving the checklist.

Our field UI is a generation ahead (one check per screen, thumb-zone buttons, autosave, offline)
and our token-backed public release page with inline evidence and a real signature is better than
their Quick Approval, which they deliberately keep out of their own audit trail. The hole is that
our checklist row is a dead end for hold points: it shows released-or-not, and to change that a
foreman must abandon the run and go find one row among 1,728.

Do T1 and T2 first — pending state plus a request action on the row, then render the release token
we already mint as a QR. That closes the only gap where CivilPro genuinely serves a site engineer
better than we do, and it is a few days of work against infrastructure that already exists.

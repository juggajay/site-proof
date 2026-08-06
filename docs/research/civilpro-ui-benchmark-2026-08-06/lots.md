# CivilPro vs SiteProof — LOTS flow UI benchmark

Screenshots read: 62 CivilPro (Cloud prioritised, Desktop `(D)` used only where the Cloud article
has no equivalent) + 12 SiteProof authed prod screens.

CivilPro shot paths below are relative to
`C:\Users\jayso\AppData\Local\Temp\claude\C--Users-jayso-site-proofv3\1f629074-8d2a-4548-84d3-660e9613b45f\scratchpad\civilpro-kb\shots\`
(format `<articleId>/NN.png`). SiteProof shots are in
`C:\Users\jayso\site-proofv3\.gstack\dev-browser\ui-sweep2-2026-08\`.

Article IDs used:
- `4407233797007` Create Lots (Cloud)
- `4410780815247` Manage Lot Status (Cloud)
- `10158283845519` Manage Lot Status Using Lot Review (Cloud)
- `13875001381135` How to Manage Sub Lots
- `4415204419343` Create a Lot Map – Lot Mapping
- `4559252580495` Generate Lot Register Reports (Cloud)
- `4406438979855` Add Area Codes (Cloud)
- `5651546952463` Manage Lot Status (D) — desktop, used for the colour/views evidence only
- `4939484801551` Create Lots (D)

---

## 1. Their flow, screen by screen

### 1.1 The Lot Register is the whole product

`4410780815247/05` is the canonical screen and it is one thing: a DevExpress data grid, full-bleed,
no page header, no stat cards, no description text. A single `+ NEW LOT` button top-left, then the
literal instruction strip *"Drag a column header here to group by that column"*, a column-chooser
icon and a filter icon at top-right. Down the right edge sits a permanent 5-icon vertical rail:
kebab (Global Action), search, clipboard (Action on Selection), printer (Reports), chainlink
(Related Items), columns. Every one of those opens a **right-side panel over the grid, never a new
page** — the grid stays visible and selected rows stay selected underneath.

Row anatomy (`4410780815247/05`): checkbox · Lot Number (blue link) · **Lot Status rendered as a
coloured swatch + word** (green square "Conformed", blue square "Guaranteed", empty outline square
"Open") · Description · Date Opened · Control Line. Additional columns available and visible in
later shots: Days Open, Days Guaranteed, Ch Start, Ch End, **Has Docs?**, % Complete, Eff %
Complete, Review Status, Reviewed By, Review Date, Lot Value, Work Type.

On Desktop the colour goes further (`5651546952463/04`): the **lot number and the description text
themselves are recoloured** — green for Conformed, blue for Guaranteed, black for Open. You can read
project state from ten feet away.

### 1.2 Create-lot wizard (Cloud) — 5 steps

`4407233797007/03` → `/04` → `/05` → `/06` → `/07`.

A full-page wizard with a 5-node stepper across the top (Lot Definition · Details · Geometry ·
Custom Registers · Confirmation), green ticks filling in behind you, `DISCARD` bottom-left and
`BACK`/`NEXT` bottom-right on a fixed footer bar.

- **Step 1 Lot Definition** (`/03`): Work Type dropdown, Area Code dropdown, Description textarea.
  Three fields on an otherwise empty page. Both dropdowns are hard prerequisites — no lot can exist
  on a project with empty registers.
- **Step 2 Details** (`/04`): Raised By, Date Open, Date Work Started, Level of Testing
  (Normal/Reduced radio).
- **Step 3 Geometry** (`/05`): **this is their best screen.** Left column = geometry type radios
  (No Geometry / Chainage / Coordinates Position / Coordinates Region), Control Line dropdown, then
  a two-column START/END block for chainage and left/right offsets, then Depth / Base Level / Top
  Level, then an `AVL Override? No—Yes` toggle with Length / Area / Volume fields that **compute
  live** (200.00 m, 4000.00 m², 0.00 m³ shown greyed as derived values). Right 70% of the screen is
  a live Google Map with the design PDF overlaid as an image layer and the lot drawn as a black
  polygon on the alignment. Form and map are side by side, and the map has a collapse chevron.
  `/06` shows the same screen in Coordinates Position mode: a lat/long row grid with a drag handle
  and a bin icon, a `+` to add points, and a location search box on the map.
- **Step 5 Confirmation** (`/07`): the wizard title bar changes to **`New Lot: EVGNRL001`** — the
  composed lot number appears only here — over a plain grey label/value review table, then `SAVE`.

### 1.3 Status change — right-click, or the selection panel

`4410780815247/04` shows both entry points at once, which is the point: a right-click context menu
on the row (Select All / Unselect All / Show Percentage Complete / Show on Map / Import / Duplicate
Lot / **Lot Status ▸** / New Related Item ▸ / Lot Summary / Delete Lot) and, in the right rail, an
identical **"Action on Selection"** panel. The Lot Status submenu lists Activate · Guarantee ·
Conform · Reject, a divider, then Undo Activate · Undo Guarantee · **Undo Guarantee by age** · Undo
Conform · Undo Reject — with every inapplicable verb **greyed but still present**. `4410780815247/10`
shows the mirror state: on a Guaranteed lot, Guarantee is greyed and Undo Guarantee is live.

`4410780815247/11` (a later build) adds Duplicate Lot with Quantities, Copy Quantities, Close /
Undo Close, Build Conformance Folio, and **Notify Selection**.

The result lands back in the grid (`4410780815247/05`) with the row repainted green.

### 1.4 Readiness before conforming: the Related Items panel

`4410780815247/03`. Chainlink icon → a right panel listing every linked record type as a collapsible
section with a `+` to link more: Quantities · Checklists · Approvals (Related / NCR Linked /
Checklist Linked) · Non Conformances · Test Requests · Variations · Photos · Filestore Documents ·
Tags · Users · Subcontractors. Each section shows either the linked items or the words "No item".
Their KB instructs the user to "take note of the items highlighted in orange and red as these are
the incomplete items" — the panel is the pre-conform checklist.

`13875001381135/01` shows the same panel with **Related Lots** expanded, and the relation vocabulary
is civil-specific: **Replaced by · Replaces · Parent of · Child of · Overlies · Underlies · Other**.
`/02` shows the inverse link auto-populated on the child (AAGNRL012 appears under "Child of").

### 1.5 Lot Review — a second status axis, and the queue UI

`10158283845519/01` is the payoff screen and it looks nothing like their normal register: the grid is
**collapsed into groups** — `Review Status: Pending Internal Review (54 items)`,
`Review Status: Pending Administrator Review (3 items)` (expanded, showing 3 rows), `Administrator
Reviewed and Rejected (2 items)`, `Administrator Reviewed and Approved (21 items)`. A "Review
Status ↓" chip sits next to the NEW LOT button showing the active grouping. The three visible rows
carry both axes at once — Lot Status green "Conformed" *and* Review Status "Pending Administrator
Review". That is the whole idea in one screenshot.

Getting there is the ugly part: `10158283845519/16` shows the required setup — filter icon →
Column Chooser → find "Review Status" in a scrolling list of hidden fields → **drag it onto the
header** (the screenshot has a hand-drawn red arrow labelled "Drag to the header"), repeat for
"Reviewed By" and "Review Date", then drag it again into the group-by strip.

Authoring the statuses (`10158283845519/04`, `/05`, `/09`, `/12`): QA Setup → Lot Review Statuses is
a grid of Status Name × seven boolean columns (Requires Comment, Reviewer Can Assign, Add Can
Assign, Admin Can Assign, Allows Synch, Is Reported, Is Public). The editor (`/06`, `/10`, `/11`) is
Status Name + a **full Word-style rich text editor** (HOME/INSERT/DESIGN/LAYOUT tabs, font picker,
TABLE/PICTURE/HYPERLINK) for the Comment Template, then the seven flags as labelled No—Yes toggles
in a 3-column grid under a "REVIEW STATUS ACTIONS" heading. The shipped template is a 6-row table:
Checklists completed / Tests Requests complied / Survey attached, if required / NCRs closed out /
All approvals closed out / Quantities confirmed.

Applying a review (`10158283845519/14` → `/15`): select rows → Action on Selection → **Add Review to
Selected** → a modal with Review Status dropdown, Review By (pre-filled, read-only), Date Review,
and the comment template pre-loaded as an editable table — the reviewer types "Checked 8 Jul 24 by
John Doe" into the second column of the row they verified.

`10158283845519/17` is their **lot detail page**: title `Lot: ACGCBR001` and five tabs — PROPERTIES ·
KEY DATES · GEOMETRY · CUSTOM REGISTERS · **REVIEWS**. The Reviews tab is an append-only table
(Review Status / Reviewed By / Date / Comments / bin icon) with `+ NEW REVIEW`. Footer:
DELETE · CANCEL · SAVE · SAVE & CLOSE.

### 1.6 Reports off the register

`4559252580495/03`: printer icon → right panel: Custom Reports ▸, Conformance Report Options ▸,
then Conformance Report (pdf), Conformance Report (zip), Quantity Sheet, Measure Up Sheet,
Conformance Declaration, Lot Register Report — each with its own kebab.

`4559252580495/06` expands **Conformance Report Options**: ~18 No—Yes toggles laid out in a 2-column
grid (Work/Area, Geometry, Other Details, Notes, Dates, Test Requests, Test Results, NCRs, ATPs,
Related Approvals, Checklists, Quantities, Variations, Related Lots, Sign off, Photos, App. Sign
off) with a **`SAVE AS DEFAULT`** button. You configure your firm's conformance pack once.

`4559252580495/10`: Lot Summary Report — a reorderable (drag-handle) checklist of the actual
documents that will be concatenated: `Lot: EMRWS001 / Conformance_Report`, `Checklist: Concrete /
Checklist`, `TR: 4 / Test_Request`, `Approval: 30 / Direct_Approvals`, then PREVIEW.

`4559252580495/13` **Folio Options Builder**: 9 rows (Include Lots / Approvals / Photos / Files /
Ncrs / Tests / Surveys / Checklist / ATP) × [Lot Folder checkbox] × [None ○ Related ○ All] radio
triple, then DOWNLOAD FOLIO. `/15` shows the output — a Windows folder tree of per-register PDFs
plus per-lot subfolders. This is the handover deliverable.

### 1.7 Spatial

Two disconnected things. `4415204419343/03`–`/07`: a **4-step wizard** (Details · Layers · Layout
Properties · Lots) to author a cross-section map — control line + chainage range, a layer list, then
a Layout Properties step that is five bare numeric inputs (Chainage Intervals, Image Height, Image
Width, Font Size, Left Margin — four of them sitting at `0`). The Lots tab has UPDATE LOT LIST /
ADD LOT MANUALLY / EXCLUDE SELECTED LOTS. Output (`/08`) is a **PDF**: a chainage ruler across the
top, one horizontal band per work-type layer, each lot a grey box labelled with its lot number, the
selected lot filled purple. Static, printed, generated on demand.

Separately, the create-lot wizard's step 3 has a live Google Map (`4407233797007/05`). The two never
meet.

---

## 2. Click-path comparison

### Create one lot

| | CivilPro | SiteProof |
|---|---|---|
| Prerequisite | Work Types **and** Area Codes registers must be populated first, or NEW LOT is unusable | none |
| Path | Register → NEW LOT → 5 wizard screens → SAVE | Register → Create Lot → one scrolling form → Save |
| Screens | 5 + confirmation | 1 |
| Clicks (happy path, chainage lot) | ~14 (4× NEXT, 2 dropdowns, control line, 4 chainage/offset fields, SAVE) | ~8 |
| Lot number | composed by the system, revealed at step 5 (`4407233797007/07`) | typed by the user (`155-lot-edit-desktop.png`, "Lot Number *" free text) |
| Bulk | Duplicate Lot / Duplicate with Quantities from the row menu | **Bulk Create Lots** wizard + **Import Register** in the header (`133-lots-list-desktop.png`) |

We win on speed and on not gating the first lot behind taxonomy setup. They win on lot numbers
being systematic rather than whatever the foreman typed, and on the geometry step being a
form-plus-live-map instead of four blind numeric inputs (`155-lot-edit-desktop.png` Location
section: Chainage Start, Chainage End, Offset, Layer — no map, no preview, no derived length/area).

### Conform a lot

| | CivilPro | SiteProof |
|---|---|---|
| Check readiness | chainlink → Related Items panel, incomplete items coloured orange/red (`4410780815247/03`) — **without leaving the register** | open the lot → Evidence Readiness panel, 3 cards, blockers/warnings named in prose (`153-lot-detail-desktop.png`) |
| Act | right-click row → Lot Status → Conform. **3 clicks, from the list** | Lots → View → header ⋮ → Conform. ~4 clicks, one page load, one lot |
| Many at once | Ctrl-select N rows → Action on Selection → Conform | not available from the register |
| Gate | modal refuses if NCRs or Test Requests outstanding; Guarantee offered as the release valve | Evidence Readiness computes blockers; force-conform is recorded ("Conformance accepted by override — An owner or admin force-conformed this lot on 2026-07-26") |

Our readiness verdict is **substantially better** — theirs is "some items are orange", ours names
the blocker and the fix in a sentence. But theirs is available on 200 rows at once from the grid,
and ours costs a navigation per lot.

### "What's waiting on me"

| | CivilPro | SiteProof |
|---|---|---|
| First time | filter icon → Column Chooser → scroll → drag "Review Status" to header → drag to group-by strip (`10158283845519/16`) — ~6 fiddly steps | Status dropdown → pick a status (`133-lots-list-desktop.png`) — 2 clicks |
| Afterwards | grid is permanently a grouped queue with live counts per group (`10158283845519/01`) | flat filtered list, count shown as "Showing 109 of 109 lots" |
| Question answered | "which lots are pending **my** review, and how many" — a person + a stage | "which lots are in state X" — a state only |

Ours is far easier to reach and answers a strictly weaker question. There is no concept in our lots
UI of a lot being *handed to someone* — only of it being in a workflow state.

---

## 3. Patterns worth adopting — ranked tickets

### T1 — Put status colour back in the lot register (P0, ~half a day)

**Build:** a single lot-status colour token map, applied as a small filled swatch (or a tinted chip)
in the Status column of `frontend/src/pages/lots/components/LotTable.tsx` and the mobile cards in
`LotMobileList.tsx`.

**Why:** in `133-lots-list-desktop.png`, "Conformed" and "Not Started" render as the *same neutral
grey pill*. `frontend/src/pages/lots/constants.ts` is explicit about it:

```
export const lotStatusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-muted text-muted-foreground',
  completed: 'bg-muted text-muted-foreground',
  on_hold: 'bg-warning/10 text-warning',
};
```

Three of four states are literally the same class. Compare `4410780815247/05`, where a 10px green /
blue / hollow square in front of the word carries the entire register at a glance, and
`5651546952463/04` where Desktop also recolours the lot number and description text.

We are not short of a palette — `029-m-lots-map-phone.png` already ships an 8-colour legend (Not
Started grey, In Progress blue, Awaiting Test yellow, Hold Point amber, NCR Raised orange-red,
Completed dark blue, Conformed green, Claimed pink). The table just doesn't use it.

**Sub-finding worth fixing in the same PR — we have four competing status colour systems:**
- `pages/lots/constants.ts` → all grey (the table)
- `components/lots/LotQuickView.tsx:46` → raw Tailwind `bg-yellow-100 / bg-blue-100 / bg-green-100 / bg-purple-100`
- the map legend → the 8-colour set above
- `components/lots/LinearMapView.tsx:43-47` → receives a `statusColors` prop and **explicitly
  discards it** (`void _statusColors;` with the comment "we use the local getStatusColor function
  instead")

Same lot, four different colours depending on which surface you're looking at. One token map,
consumed by all four, is the fix.

---

### T2 — Group-by on the lot register (P0, ~2 days)

**Build:** a "Group by" control next to the existing Views button on `LotsPage.tsx`, offering
Status / Activity Type / Subcontractor / Area, rendering collapsible section headers with counts
(`LotTableSections.tsx` already exists and is the natural home).

**Why:** `10158283845519/01` — their entire queue workflow is grouping, not a bespoke inbox. The
group header carries the count (`Pending Internal Review (54 items)`), collapsed groups stay
collapsed, and one grid serves the field engineer, the QA manager and the client. Our register at
109 lots (`133-lots-list-desktop.png`) is a flat scroll where every row looks identical; the phone
list (`028-m-lots-phone.png`) is 17 visually identical cards before you reach anything actionable.

Cheaper and more reusable than building a dedicated queue screen, and it composes with the filters
we already have.

---

### T3 — Readiness signals as register columns (P1, ~2 days)

**Build:** compact columns in `LotTable.tsx` — ITP progress (`7/12`), open NCRs (count, red when
>0), tests outstanding, **Has evidence?** — plus **Days open** and **Days since conformed**.

**Why:** two distinct CivilPro moves. `10158283845519/13` and `/14` show a boolean **"Has Docs?"**
column rendered as a ticked/unticked checkbox — instant "is there anything attached to this lot".
`4410780815247/11` shows **Days Open** and **Days Guaranteed** as first-class numeric columns, and
`4559252580495/02` shows a register sorted by Days Open with values of 205, 225, 231, 256, 325, 361,
373 — the aging is the story.

Our register carries Chainage / Activity Type / Status / Subcontractor / Budget — nothing that says
whether a lot is *ready*. We compute all of this already for the Evidence Readiness panel
(`LotReadinessPanel.tsx`); it just never reaches the list. Note the mobile card already does a
version of this ("0 ITPs  0 Tests", `134-lots-list-phone.png`) — desktop is behind mobile here.

---

### T4 — Bulk status actions from the register (P1, ~2 days)

**Build:** wire the existing header checkbox column in `133-lots-list-desktop.png` to a selection
action bar (n selected → Conform · Mark ready for review · Assign subcontractor · Export
conformance pack). `BulkActionModals.tsx` and `LotContextMenu.tsx` already exist — this is mostly
surfacing.

**Why:** `4410780815247/04` and `/11`. Every verb they have works on a multi-row selection, and
their documented client workflow (sample 20%, bulk-mark the rest "Client review not required")
*only* works because of it. Their menu design is worth copying exactly: **show inapplicable verbs
greyed rather than hiding them** — "Undo Guarantee" being visible-but-grey teaches the user the
state machine. Ours currently makes the user open each lot to change its state.

---

### T5 — A review/handoff axis, orthogonal to lot status (P1, ~1 week)

**Build:** a per-lot append-only review log — status (from a small fixed set: Ready for
conformance · More info required · Ready for client review · Client reviewed), author, timestamp,
comment — surfaced as (a) a Review Status column, (b) a group-by option from T2, (c) a tab on the
lot detail page.

**Why:** `10158283845519/01` and `/17`. This is the single best idea in their product and it is a
*UI* idea as much as a data one: two independent state badges on one row let a QA manager see
"Conformed, but still pending administrator review" without opening anything. `/17` shows the
review history as a plain append-only table with author and date — trivially simple UI for a very
high-value answer.

**Deliberately skip their configurability.** Their seven per-status boolean flags
(`10158283845519/11`) and the Word-grade rich-text Comment Template editor (`/06`, `/10`) are how a
good idea becomes a setup project. Ship 4 fixed statuses and a plain textarea; the value is in the
axis existing, not in it being authorable.

---

### T6 — Related-lot links with civil vocabulary (P2, ~3 days)

**Build:** a "Related lots" section on the lot detail page with typed, auto-inverse links:
**Overlies / Underlies / Parent of / Child of / Replaces / Replaced by**.

**Why:** `13875001381135/01`. They ship exactly this vocabulary and it is *right* for civil —
"Overlies/Underlies" is the pavement layer stack, which is precisely the relationship our chainage
+ layer model already implies but never records. `/02` shows the inverse link auto-appearing on the
counterpart lot, which is the correct interaction (link once, both sides update).

Their own KB admits the weakness we can beat: the links are display-only, *"CivilPro cannot filter /
group Child Lots that are associated with a Parent Lot"*, and their documented workaround
(`13875001381135/03`–`/06`) is to create a global custom register of values "Parent / Layer 1 /
Layer 2 / Layer 3" and **type the parent's name into a filter row**. If our version is groupable via
T2, we straightforwardly beat them.

---

### T7 — Saved conformance-pack presets (P2, ~2 days)

**Build:** on our existing `ConformanceReportModal.tsx`, a "Save as default" on the include/exclude
options so a firm configures its pack once.

**Why:** `4559252580495/06` — 18 content toggles with `SAVE AS DEFAULT`. Every civil firm has one
house format for its conformance report and re-picking it per lot is pure friction. Also worth
stealing: `4559252580495/10`, the **drag-to-reorder list of the actual documents** that will be
concatenated, shown before you generate. That is a much better mental model than a silent PDF.

---

### T8 — Preset register views (P2, ~1 day)

**Build:** ship default entries in the existing Views menu (`LotSavedFiltersMenu.tsx`): Open lots ·
Conformed · Awaiting test · NCR raised · My lots.

**Why:** `5651546952463/05` shows Desktop's "Standard Views" radio group — Standard / Open lots /
Conformed Lots / Guaranteed Lots / Dates / Related item summary / Value. One click to a useful
register. We have the Views mechanism (`133-lots-list-desktop.png`) but it starts empty, so nobody
discovers it.

---

### T9 — Live geometry preview in the lot form (P3, ~3 days)

**Build:** on the create/edit lot form, put a map preview beside the Location fields that draws the
chainage span on the control line as you type, and shows derived length/area read-only.

**Why:** `4407233797007/05` is the best single screen in their product — form left, live map right,
Length/Area/Volume computing as you enter chainages, with an explicit `AVL Override? No—Yes` toggle
for when the engineer disagrees with the maths. Our `155-lot-edit-desktop.png` Location section is
four blind inputs (Chainage Start, Chainage End, Offset, Layer) with no feedback that CH2000–2100
landed anywhere sensible. We already have the map, the control line (`107-control-lines-desktop.png`
— and note we carry a real coordinate system, GDA2020 / MGA Zone 56 EPSG:7856, which they punt to
"ask a surveyor"), and the geometry code.

Compute-with-override is the pattern to copy, not just the map.

---

## 4. Anti-patterns to avoid

1. **Hiding the important columns behind a Column Chooser.** Review Status, Reviewed By, Review Date
   and % Complete all ship hidden and must be *dragged* onto the header (`10158283845519/16`,
   `5651546952463/06`). Their best feature is invisible until the user configures a grid. If we ship
   T5, Review Status is visible by default.

2. **Five wizard screens to create one row.** `4407233797007/03` shows a full-page wizard step
   holding **three fields**. Our single form is better; do not "improve" it into a stepper.

3. **Taxonomy before first value.** No lot can exist until Work Types and Area Codes are populated
   (`4406438979855/05`). Our `103-areas-desktop.png` empty state ("No areas defined… Add First
   Area") is correctly *optional* — keep it that way.

4. **Right-click as a primary action surface.** `4410780815247/04` puts the same menu in a
   right-click and in a rail panel because right-click alone is undiscoverable and impossible on a
   phone. If we add row actions, they must be a visible affordance first.

5. **Status rendered as a fake checkbox.** Their Lot Status cell draws an *unticked checkbox* next
   to the word "Open" (`4410780815247/05`, `13875001381135/03`). It looks clickable, it isn't, and
   an empty checkbox reads as "not done" for states like Rejected. Use a swatch (T1), never a
   control-shaped glyph, for a read-only state.

6. **Shipping non-functional fields.** The Lot Mapping layer editor has three fields their own KB
   flags as "currently non-functional", and the lot wizard carries a Tag Code feature documented as
   "not ready for use". `4415204419343/05` shows four numeric layout inputs sitting at `0` with no
   hint of what a good value is.

7. **A generated PDF as the navigation surface.** `4415204419343/08` — their flagship spatial view
   is a printed cross-section whose lot numbers happen to be clickable links. Our interactive map
   (`029-m-lots-map-phone.png`) is the better artefact; do not regress toward "generate a picture".

8. **A rich-text editor as a configuration field.** `10158283845519/06` embeds a Word-class toolbar
   (fonts, sub/superscript, borders, table style) to author a status comment template. Enormous
   surface area, endless formatting bugs, for what is a 6-row checklist.

9. **Modal-on-modal with four footer buttons.** `10158283845519/17` ends with DELETE · CANCEL ·
   SAVE · SAVE & CLOSE on a tab inside a detail page. Two of those are the same button.

---

## 5. Verdict

**Where their lots UI beats ours:** the register *is* the workspace — grouping, multi-select, bulk
status verbs, related-items inspection and report generation all happen without leaving the grid,
while we make the user navigate into a lot to do almost anything; status is legible at a glance
through colour, where our chips are uniformly grey; and Lot Review gives them a second axis that
answers "who has the ball", which we cannot express at all.

**Where ours beats theirs:** our readiness verdict names the actual blocker and the fix in plain
English instead of colouring a row orange, and it records force-conformance as an audit fact; our
create-lot path is one form against their five-screen wizard with a taxonomy prerequisite; and our
spatial story is a single live interactive map with real coordinate-system support (GDA2020 / MGA
Zone 56) against their three disconnected artefacts, one of which requires installing QGIS.

**Net:** they are a better *register*, we are a better *record*. The cheapest way to close the gap is
T1–T4 — colour, grouping, readiness columns, bulk actions — none of which need new data, all of
which turn our existing lot list into something a QA manager can work from.

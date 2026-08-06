# UI benchmark — CivilPro Test Request / Results vs SiteProof (CIVOS)

Scope: the test-request → tester → structured results → conformance loop.
CivilPro sources: 17 `tests` articles (111 shots) + 2 video transcripts, prioritising Cloud/web.
SiteProof baseline: **`origin/master` @ `01e430c5`** — not the local working tree, which sits at
`228a3fcc` (#1412) and is ~340 commits stale. Everything asserted about SiteProof below was read
from `git show origin/master:<path>`.

**Correction to `findings/itp-holdpoints-tests.md` §5.17.** That section says CivilPro has "no
statistical lot assessment (characteristic value / CV of a lot)". Wrong. The Lot Conformance Report
test-results table auto-appends **Average**, **CV Lower** and **CV Upper** rows per result column —
see `…\civilpro-kb\shots\11962600057999\01.png`. CivilPro does compute characteristic value; what it
does *not* do is auto-evaluate conformance against the criteria (that stays a human `conforms` tick).
The gap is narrower than recorded and the §5.17 framing should not be quoted at a customer.

---

## 1. Their flow, screen by screen

### 1.1 Raise from a checklist row — the standout

`…\civilpro-kb\shots\14526557053839\01.png`
Checklist grid (`Quality Assurance > Checklists`, lot `UBGNRL035: Unbound Pavement`). Every row
carries a **`Has Tests`** computed tick column, right of `Insp Method`. Right-click the row → a
15-item context menu where **New Test Request** is live and the approval items are greyed. The
important UI fact is the `Has Tests` column: the field user is told, in the register, which rows
will produce testing before they open anything. Note also `HpWpC` (Check/Hold/Witness/Milestone) and
`Insp Method` (`Visual` / `Test` / `Survey`) as first-class columns — the row *declares* how it gets
verified.

### 1.2 The Test Request wizard

`…\civilpro-kb\shots\4407402188559\03.png` — **Step 1 "TR Definition"**: `Lot Tested`,
`Test Request Number` (0 = auto-number), `Requested By`, `Test Request To` (the tester),
`Date Requested` / `Date Required` / `Time Required` with an explicit `(UTC+10:00) Canberra,
Melbourne, Sydney` hint, `Description`, and `Test Reason` as a four-way radio —
**Compliance / Control / Information / Retest**. Raised from a checklist row, `Lot Tested` and the
geometry are pre-filled.

`…\civilpro-kb\shots\4407402188559\04.png` — **Step 2 "Geometry"**: left rail of radios
(No Geometry / Chainage / Coordinates Position / Coordinates Region), `Control Line` picker, then
**Start/End chainage each with its own left+right offset pair**, `Level Datum`, `Depth to Test (mm)`.
Below that an **`AVL Override?` toggle** exposing `Test Length (m)` / `Test Area (m²)` /
`Test Volume (m³)` — greyed until you flip it, because they are derived from the chainage box. Right
two-thirds is a live map with the design drawing georeferenced under the control line. This is the
screen that makes the count arithmetic possible later.

`…\civilpro-kb\shots\4407402188559\05.png` — **Step 3 "Options"**: `Material Source` free text, then
`Method of Location` (Tester Locates / **Random Stratified Testing** / Location Specified). Picking
random stratified reveals three checkbox+integer pairs — Calculate Longitudinal / Lateral / Depth
Position, each with a `Resolution`. The system then *generates* sample positions inside the lot.

`…\civilpro-kb\shots\14526557053839\02.png` — **Step 4 "Tests"**, empty state. Two buttons:
`+ ADD NEW TEST` and `+ ADD TESTS FROM ITP`. Two stacked grids — **Test Grid** (what you asked for:
method, schedule item, number of tests, compliance) and **Generated Tests** (what that expands into:
one row per sample with `X Ref (ch)` / `Y Ref (ch)` / `Z Ref (ch)`), with a `Count: 0` footer.
`…\civilpro-kb\shots\4407402188559\06.png` shows it populated: 2 methods × 4 tests = `Count: 4`
generated rows, each carrying its control line and computed position.

`…\civilpro-kb\shots\14526557053839\03.png` — **the "Retrieve From ITP" modal. The single best screen
in the corpus.** Columns: `Test Method`, `Freq. (n)`, `Unit`, `Freq. Lot (n)`, `Qty for Calc`,
**`Calc Tests`**, `Tests this req`, `Compliance`. A `Filter` radio group scopes to
**Lot / Checklist / Checklist Line**. A `Quantity Options` dropdown (`Lot area: 2600`) plus
`+ ASSIGN SELECTED` and `RE-CALCULATE NO. OF TESTS`.

The `Calc Tests` cell is green and contains the **literal working**: `2,600 / 500 => 6 - 0 => 6`.
Read it as quantity ÷ frequency ⇒ 6, minus 0 already requested ⇒ 6 to raise. The `Freq. Lot (n)` = 4
column is the per-lot minimum floor that the docs say wins when the division comes out lower. Rows
are grouped under a collapsible header showing the ITP item text (`COMPACTION — The characteristic
value of relative compaction must be >100% as per Table 8.4.3(a)`), and the `Compliance` column
carries the acceptance criteria verbatim from the ITP into the request.

`…\civilpro-kb\shots\4407402188559\08.png` — **Step 6 "Confirmation"**: a flat read-only key/value
review of all 18 fields including the derived `Length 30 / Area 360 / Volume 0` and
`Tests: 2 x Q111A :: 2106.01`, above `BACK` / `SAVE`.

### 1.3 The tester-facing screens

There is **no tester-facing screen**. The tester is a CivilPro user with a filtered register.

`…\civilpro-kb\shots\4407559615759\02.png` — **Notify/Email Tester**, a manual step after Save that
the KB opens with "IMPORTANT: The Test Request has NOT been sent to the Tester." Mail To / CC /
Attachments / Subject / a full rich-text editor (Tahoma 8, bold, colour, font pickers). The message
body is pre-seeded with an HTML table — `# | Description | Lot | Tests | Date Required`, tests
rendered as `3 x Q111A: insitu Dry Density (Sand Replacement)`. A **PDF cover sheet of the request is
auto-attached** carrying the itemised tests and compliance targets.

Transcript `smaIA3mAC1A.txt` (tester's own words): the tester clicks the TR number hyperlink in the
email, signs in, lands on the request, `Action on Selection > Notify Result`, `+` in Attachments,
drags the result PDF in, Next, `Publish & Send`. They can also reach it via
`Quality Assurance > Test Requests`, which shows only requests involving them.

`…\civilpro-kb\shots\4407586258447\05.png` — **Publishing Options**, the third step of the result
notification: `Publish, Sending notification & emails` / `Publish, Previewing…` / `Save,
Unpublished`, with the line `2 recipients receiving email notifications.`
`…\civilpro-kb\shots\4407586258447\06.png` — the resulting Outlook email, `[EXTERNAL EMAIL]` banner,
both the tester's `Test Results.docx` and the CivilPro-generated
`TR 9_ GTRWNB001 - Ground surface treatment tests prior to embankment installation.pdf` attached,
plus an "Attached document list" table of TR # / Filestore Id / Description / Date.

### 1.4 Structured results grid + mark complete

`…\civilpro-kb\shots\11962600057999\04.png` — **Test Method Details** (`QA Setup > Test Methods`):
method code, description, and a `TEST RESULT FIELDS` mini-grid of `Result Name` / `Result Unit`
(`FMC | %`, `DDR | %`) with inline add/tick/edit. **This is the schema definition step** — it decides
what columns the results grid will have for every request using that method.

`…\civilpro-kb\shots\11962600057999\08.png` — the results grid, reached from the Test Request via a
"canister" icon. Columns: `Test Request | Lot | Sample Id | Date Sampled | DDR | FMC`. **One row per
requested sample**, sample ids auto-formed as `<TR#>-<nn>` (`6-01`). The method columns are dynamic —
the header dropdown at top-left (`Q111A`) switches which method's grid you are editing.

`…\civilpro-kb\shots\11962600057999\01.png` — how it lands in the **Lot Conformance Report**:
`Q112: Insitu Dry Density (Nuclear Gauge)` with rows `23-01 … 23-04` then computed **Average**,
**CV Lower**, **CV Upper** per column, above the geometry/notes/checklist/TR headers.

`…\civilpro-kb\shots\4407559615759\03.png` — the **Test Request register** and its right-hand
`Related Items` rail. Register columns: `No. | Description | Compl… | Lot Tested | Requested |
Ch Start | Ch End | Geometry Type | Control Line | Test Result Status | Has Doc`. The
**`Test Result Status`** column is the lifecycle at a glance — observed values `No Result`,
`Tested In Field`, **`Conforms`**, **`Has Failure`** — and conforming rows render green with a status
pip. The rail shows `Tests` (`3 x Q111A…`), `Properties` (the concrete mix key/values), `Filestore
Documents`, and a full `Email Logs` history.

Transcript `Bu1uPpJtp_0.txt` — **mark complete is the visibility gate.** Engineer receives a
non-conforming result, remediates, gets a compliant retest, ticks `conforms`, saves, then right-click
`Mark Complete` → the row turns green with a tick in the `Complete` column. Only then does a role
carrying `Limit Test Request View to Completed` (client rep / project administrator) see the request
*or its results* at all.

---

## 2. Click-path comparison — checklist item → results recorded

Assume: pavement lot, area 2,600 m², ITP compaction row requires 1 test per 500 m² with a minimum of
4 per lot, so **6 tests**.

**CivilPro — 6 tests raised, sent, returned, recorded**

| # | Action | Screen |
|---|---|---|
| 1 | Right-click the `Has Tests` checklist row → New Test Request | `14526557053839\01.png` |
| 2 | Wizard 1/6 Definition — tester, date required, description, test reason (lot + geometry pre-filled) | `4407402188559\03.png` |
| 3 | Wizard 2/6 Geometry — confirm chainage/offset, area derives to 2,600 | `4407402188559\04.png` |
| 4 | Wizard 3/6 Options — Random Stratified, resolution 3 | `4407402188559\05.png` |
| 5 | Wizard 4/6 Tests → `ADD TESTS FROM ITP` | `14526557053839\02.png` |
| 6 | Scope `Checklist Line` → `Quantity: Lot area 2600` → `ASSIGN TO SELECTED` → **6 computed, working shown** → Save | `14526557053839\03.png` |
| 7 | Wizard 5/6 Properties, 6/6 Confirmation → Save | `4407402188559\08.png` |
| 8 | **Separate manual step** — Notify Tester: Mail To, subject, send | `4407559615759\02.png` |
| 9 | *(tester)* email link → TR → Notify Result → drag PDF → Next → Publish & Send | transcript `smaIA3mAC1A` |
| 10 | *(engineer)* open TR → canister icon → type DDR/FMC into 6 sample rows → Save | `11962600057999\08.png` |
| 11 | Tick `conforms` → right-click `Mark Complete` | transcript `Bu1uPpJtp_0` |

≈ **11 steps, 1 pass, 6 tests**. Two of them (8 and 11) are steps users demonstrably forget — CivilPro
ships three KB articles and a bold "IMPORTANT" whose only content is "press send".

**SiteProof today**

| # | Action | File |
|---|---|---|
| 1 | Lot detail → ITP Checklist tab → row action "Add test result" (only when `evidenceRequired === 'test'`) | `frontend/src/pages/lots/components/ITPChecklistItemRow.tsx` |
| 2 | `CreateTestModal` — prefilled lot + testType + sample date, `satisfiesItem` locked | `frontend/src/pages/tests/components/CreateTestModal.tsx` |
| 3 | Save → **one** `TestResult` row at `status: 'requested'` | `backend/src/routes/testResults/crudRoutes.ts` |
| 4 | **Repeat steps 1–3 five more times.** No multi-raise anywhere. | — |
| 5 | Per row: "Send to lab" → flips `status` to `at_lab`, stamps `sentToLabAt`. **Nothing is sent to anyone.** | `TestResultsTable.tsx` / `TestResultsMobileList.tsx` |
| 6 | Email the lab out-of-band (Outlook). SiteProof's printable lab request form exists at `GET /api/test-results/:id/request-form` but **has zero frontend callers** | `backend/src/routes/testResults.ts:44` |
| 7 | Lab emails a PDF back. Engineer: Upload Certificate → Claude extraction → confirm | `UploadCertificateModal.tsx` |
| 8 | Enter Results — **one scalar** `resultValue` + pass/fail | `EnterResultsModal.tsx` |
| 9 | Verify (requires `certificateDocId`, else `CERTIFICATE_REQUIRED`) | `workflowRoutes.ts` |
| 10 | Repeat 7–9 per row | — |

≈ **6 modal round-trips to raise, then 6 more to record** — roughly 30 interactions against
CivilPro's 11, entirely because SiteProof has no concept of "this lot needs 6 of these".

**The asymmetry that matters.** SiteProof already *knows* the answer is 6 and knows why. The
sufficiency engine (`backend/src/lib/readiness/sufficiency/`) resolves a governing ruleset
(`vicroads-204.v2`, `tfnsw-q6.v1`), computes
`requiredCount = max(minCountByScale[scale], ceil(quantity / perQuantity.every))`
(`counts.ts:requiredTestCount`), attributes results by *resolved test category* rather than raw
string, and snapshots the decision immutably at conformance, hold-point release and claim time. It
carries authority / document / edition / clause provenance and a `draft | confirmed` status per pack.
That is a materially better engine than CivilPro's user-typed `Freq (norm)` / `Lot Freq (N)` — which
its own UI disclaims ("CivilPro cannot provide any guarantees or warranties").

**And none of it is visible on the Test Results page.** Grepping
`origin/master:frontend/src/pages/tests/TestResultsPage.tsx` (929 lines) for
`sufficien|required|of [0-9]` returns nothing. The register in
`…\ui-sweep2-2026-08\147-tests-desktop.png` shows two flat rows and no denominator. The only place
the count surfaces is the Evidence Readiness card on lot detail
(`…\ui-sweep2-2026-08\153-lot-detail-desktop.png`), and there it appears as a *blocker* —
"Test frequency cannot be checked — Select this lot's specified relative compaction… Record this
lot's quantity (or draw its geometry)" — i.e. the user meets the engine as an obstacle before ever
meeting it as help.

---

## 3. Patterns worth adopting — ranked tickets

### T1 — Put the required-count denominator on the register and the raise path
**Rank 1. Highest value per line of code; presentation only, no schema, no new arithmetic.**

What to build: surface the already-computed sufficiency result wherever tests are raised or read.
Minimum viable version is a header strip on the Test Results page when a lot filter is active —
`Compaction: 3 of 6 verified` — plus the same string on the lot detail Tests tab and inside
`CreateTestModal` when `satisfiesItem` is set. Reuse `useGoverningRuleset`
(`frontend/src/hooks/useGoverningRuleset.ts`) and `frontend/src/lib/testSufficiency.ts`; the
`/api/test-sufficiency` route already returns the ruleset, and `LotReadinessPanel.tsx` already
renders the evaluated state — this is lifting an existing panel's data into two more places.

Pages: `frontend/src/pages/tests/TestResultsPage.tsx`,
`frontend/src/components/lots/TestsTabContent.tsx`,
`frontend/src/pages/tests/components/CreateTestModal.tsx`.
Evidence: `…\civilpro-kb\shots\14526557053839\03.png` (`Tests this req` = 6),
`…\civilpro-kb\shots\4407402188559\06.png` (`Count: 4` footer).
Counter-evidence: `…\ui-sweep2-2026-08\147-tests-desktop.png` — no denominator anywhere.

### T2 — Show the working, and cite the clause
**Rank 2. This is the differentiator, not a parity item.**

CivilPro renders the literal arithmetic in a green cell: `2,600 / 500 => 6 - 0 => 6`. Copy the
transparency, beat the substance — SiteProof's engine knows the authority, document, edition and
clause, and its packs carry a `confirmed` vs `draft` status. Render, on hover or in a small
disclosure under T1's counter:

> **6 tests required** — VicRoads/DTP Section 204 v8.0 (Nov 2025), cl. 204.13(a), Compaction Scale A.
> 3 verified, 1 at lab, 2 not yet raised.

And when the count is unknown, say which input is missing rather than emitting a blocker: "Record the
lot quantity to check this" is help; "Test frequency cannot be checked" is an accusation.

`vicroads-204.v2.ts` also has an honest under-warning documented in its own header (Type B/C area
caps). Where a rule is `draft` or a cap is knowingly unencoded, the disclosure should say so. That is
the exact opposite of CivilPro's blanket "CivilPro cannot provide any guarantees" and it is worth
saying out loud in a sales conversation.

Pages: same three as T1, plus `frontend/src/pages/lots/components/LotReadinessPanel.tsx`.
Evidence: `…\civilpro-kb\shots\14526557053839\03.png` (green `Calc Tests` cell).

### T3 — Raise N tests in one action
**Rank 3. Removes the largest single click-count gap.**

When T1 says "0 of 6", offer `Raise 6 tests` — one modal, one POST, six `TestResult` rows sharing
lot, testType, `itpChecklistItemId` and `testRequestNumber`, differing only by a sample index. Add a
quantity stepper to `CreateTestModal` and a batch endpoint beside
`backend/src/routes/testResults/crudRoutes.ts`. Default the stepper to the outstanding count, never
above it.

Also worth stealing from the same screen: CivilPro's **scope filter** (`Lot` / `Checklist` /
`Checklist Line`). Raising every outstanding test on a lot in one action is a real field behaviour —
the truck is there once.

Pages: `frontend/src/pages/tests/components/CreateTestModal.tsx`,
`frontend/src/pages/lots/hooks/useLotTestCreation.ts`, new backend batch route.
Evidence: `…\civilpro-kb\shots\14526557053839\03.png` (checkbox column + `ASSIGN SELECTED`).

### T4 — Wire up the lab request form that is already built
**Rank 4. Almost certainly the smallest diff in this document.**

`GET /api/test-results/:id/request-form?format=html|json` exists on `origin/master`
(`backend/src/routes/testResults.ts:44`), is backed by a 361-line renderer
(`backend/src/routes/testResults/requestFormPresentation.ts`), pulls company name/ABN/address/logo,
project, lot number + chainage + layer + activity, and requester contact — and **nothing in
`frontend/` calls it**. Same story for `GET /:id/verification-view` and
`backend/src/routes/testResults/presentation.ts`.

Add a `Print lab request` action next to `Send to lab`, and make `Send to lab` open it rather than
silently flipping a status. CivilPro's equivalent is the auto-attached TR cover-sheet PDF that gives
the tester the itemised tests and the compliance targets without a phone call
(`…\civilpro-kb\shots\4407559615759\02.png`, `…\shots\4407586258447\06.png`).

Pages: `frontend/src/pages/tests/components/TestResultsTable.tsx`,
`TestResultsMobileList.tsx`. Watch the known 5-buttons-per-row problem — this belongs in the overflow
sheet, not as a sixth button.

### T5 — Put the sufficiency inputs where the blocker appears
**Rank 5. Cheap, and it converts a dead-end into a two-click fix.**

`Lot.testScale`, `Lot.quantityValue` / `quantityUnit` and `Lot.materialType` are only editable on the
Edit Lot page (`frontend/src/pages/lots/components/LotEditFormFields.tsx`), well below the fold —
`…\ui-sweep2-2026-08\155-lot-edit-desktop.png` shows Basic Information and Location filling the
viewport with no sign of them. The blocker they resolve renders on lot detail
(`…\ui-sweep2-2026-08\153-lot-detail-desktop.png`). Make the readiness item's inputs editable inline,
or at minimum deep-link to the right anchor.

`testSufficiency.ts` already exports `scaleAppliesToActivity` and `quantityDrivesCountForActivity`,
so the panel can ask only for inputs that change this lot's answer — a better default than CivilPro,
which asks for `Freq (norm)`, `Freq (red)`, `Lot Freq (N)`, `Lot Freq (R)`, `Unit` and
`Quantity Basis` on every ITP test row regardless.

### T6 — Structured per-property results with one row per sample
**Rank 6. The one place CivilPro's data model is genuinely better. Schema work — plan it, don't rush it.**

`TestResult` on `origin/master` holds a single `resultValue` Decimal + `resultUnit` +
`specificationMin`/`specificationMax`. A nuclear-gauge certificate reporting DDR and FMC has to
become two rows or lose a number. CivilPro defines `Result Name`/`Result Unit` per test method
(`…\shots\11962600057999\04.png`) and renders a grid of one row per requested sample with those
columns and an auto sample id `<TR#>-<nn>` (`…\shots\11962600057999\08.png`). That model is what
makes the Average / CV Lower / CV Upper block on the conformance report possible
(`…\shots\11962600057999\01.png`).

Two things follow, and the second is the prize:
1. AU earthworks and pavement specs are written in characteristic values. Without per-sample rows,
   SiteProof cannot compute a lot's CV and cannot state lot conformance the way the spec words it.
2. SiteProof already resolves test *categories* rather than raw strings
   (`sufficiency/testCategories.ts`). Named result fields keyed to a category, with
   `specificationMin`/`Max` already on the row, gets to **auto pass/fail against the spec** — which
   CivilPro cannot do, because its `Compliance` field is free rich text.

Sequence it after T1–T3; those pay off immediately and this one needs a migration and a spec.

### T7 — Tokenised external tester response
**Rank 7. Strategic, not urgent. Build it when a real lab asks.**

Every external party in CivilPro needs an invited account before they can even be selected as an
addressee — stated as a prerequisite in ~8 articles, and the transcript admits "if you don't see the
person available to select in here it may mean that they haven't been invited". SiteProof already has
the pattern to beat it: `HoldPointReleaseToken` + `backend/src/routes/holdpoints/publicBatchRoutes.ts`
+ `frontend/src/pages/holdpoints/PublicHoldPointReleasePage.tsx` — a signed link, no account, a
single-purpose screen. The same shape for a lab (see the request, upload the PDF, done) removes the
onboarding step CivilPro cannot remove.

Today `laboratoryName` is free text with a most-recent-20 autocomplete
(`backend/src/routes/testResults/listRoutes.ts`). Labs are not entities. That is the prerequisite.

### T8 — Result visibility gate (`Limit Test Request View to Completed`)
**Rank 8. Blocked on a client role existing. Record the intent, don't build yet.**

CivilPro's most commercially pointed feature: a role flag that hides a test request *and its results*
from client-side roles until the request is marked complete, explicitly so the contractor can
remediate a failure and produce a compliant retest first (transcript `Bu1uPpJtp_0.txt`). SiteProof has
no `client` role at all (`frontend/src/appRouteRoles.ts`), and `GET /api/test-results` filters by
project access and subcontractor lot assignment only — never by `passFail` or `status`. When a client
role ships, this belongs in the same PR, because the alternative is a contractor discovering the
exposure the hard way.

---

## 4. Anti-patterns to avoid

1. **A seven-step wizard to ask for a test.** Details → Custom Registers → Geometry → Options → Tests
   → Properties → Confirmation (`…\shots\4407402188559\06.png`). Six of the seven are pre-fillable
   from the lot and the ITP. SiteProof's single `CreateTestModal` is the better shape — extend it,
   don't wizardise it.
2. **"Save" and "send" as separate acts.** CivilPro's own docs open with "IMPORTANT: The Test Request
   has NOT been sent to the Tester", and three separate KB articles exist only to tell users to press
   send. Created-but-never-sent is the default state. SiteProof has the mirror-image bug: `Send to
   lab` sounds like sending and is a status flip that transmits nothing (T4). Either wording matches
   behaviour or the button is a lie.
3. **Free-text acceptance criteria.** CivilPro's `Compliance` is rich text, so nothing can be
   evaluated and `conforms` is a human tick. SiteProof already has numeric
   `specificationMin`/`specificationMax` with a server-side backstop that overrides a client-claimed
   pass contradicting the value. Never regress that to a text field for the sake of expressiveness.
4. **Disclaiming your own calculator.** "Always verify the calculated number of tests… CivilPro
   cannot provide any guarantees or warranties" printed inside the feature. A number nobody stands
   behind is a number nobody uses. SiteProof's answer is provenance and a `draft`/`confirmed` status
   per pack — cite the clause instead of disclaiming the arithmetic.
5. **Results hidden behind an unlabelled icon.** The whole structured-results grid is reached by
   clicking a "canister" icon in a right rail. The step users must not miss should not be the step
   with no label.
6. **Mandatory setup before the first useful action.** Test Methods and Test Properties registers
   must both be populated before a request can be raised at all. SiteProof's `testTypeSpecs` +
   `stateTestMethods` in `frontend/src/pages/tests/constants.ts` ship the catalogue instead — keep it.
7. **Configurable grids as the answer to layout.** Column choosers, saved personal views, saved
   "tablet" views, and "make sure your view is not filtered" as a documented troubleshooting step in
   four articles. Role-tailored defaults beat teaching every user to build their own screen.
8. **`Test Result Status` conflating two axes.** `No Result` / `Tested In Field` / `Conforms` /
   `Has Failure` (`…\shots\4407559615759\03.png`) mixes workflow position with outcome in one column.
   SiteProof's split — `status` (requested → at_lab → results_received → entered → verified) and
   `passFail` (pending/pass/fail) — is correct. Keep them separate in the UI too.

---

## 5. Verdict

CivilPro wins the *raise* — one right-click off a checklist row produces six correctly-counted tests
with the arithmetic shown on screen, while SiteProof needs six modal round-trips and shows no
denominator anywhere on the Test Results page.

But SiteProof already owns the harder half: a spec-derived sufficiency engine with clause provenance,
category-resolved attribution and immutable decision snapshots, against CivilPro's user-typed
frequencies that its own UI disclaims — the gap is presentation, not capability, and T1–T4 close most
of it without a migration.

The one genuine data-model deficit is per-sample structured results (T6): until a test can hold named
result fields across multiple specimens, SiteProof cannot compute a lot's characteristic value, which
is the language AU earthworks and pavement specs are actually written in.

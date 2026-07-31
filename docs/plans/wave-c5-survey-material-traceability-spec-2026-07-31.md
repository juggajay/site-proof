# Wave C5 Execution Specification — the survey and the delivery are evidence CIVOS files, not evidence CIVOS computes

**Date:** 31 July 2026 · **Rev 1:** authored 31 Jul at `f944c39a`. No prior revision.

**Status:** implementation-ready for **C5.1, C5.2 and C5.3**. **C5.4 and C5.5 are specified and BLOCKED** — each on a named research gap and, for the workflow-shaped parts, on pilot validation the program itself already requires (`CIVOS-Validated-Buildout-Plan-2026-07-24.md:84`). Nothing in C5.1–C5.3 is gated on a Jay decision; the four decisions in §15.1 shape C5.4/C5.5 and the rollout, not the build.

**All `file:line` citations in this document were opened in this worktree at HEAD `f944c39abc9b8670061f82f7bb3da5f8db49255d`** (= `origin/master`, `chore(bench): idle-box re-run — the owed C1 evidence, all targets pass (#1709)`). Nothing is carried forward from another document without being re-derived here; where a prior spec's citation is now stale, §18 records it.

**Program contract:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` §3 Wave C, **line 79** (*"C5. Survey & material traceability (NEW — dev-review gap 4): survey request → completion → review → acceptance workflow; design-vs-as-built values with tolerance results; survey file + instrument provenance; survey revision/supersession; material/product approvals; supplier certificates; batch/delivery traceability (concrete/asphalt dockets → installed lot); rejected/quarantined material state. Feeds C4 integrity, E2 release packages, and D2 asset records."*), plus **§4 line 110** (the non-build: *"survey modelling/authoring (12d's ground — we import and link)"*), **§3 line 86** (*"Imported certified survey geometry is immutable and versioned — CIVOS may enrich evidence links against it but never modifies the certified geometry itself"*), **§3 line 90** (*"Preserve the surveyor/RPEQ certification boundary — CIVOS assembles and links; certifiers certify"*), **§6 lines 121–131** (definition of done), **§7 line 134–135** (threat-model gate and standing security requirements), **§8 lines 138–146** (performance targets and the reference dataset), **§9 line 149** (this document's existence).

**Parent specs, read not remembered:**
- `docs/plans/wave-c2-test-lifecycle-spec-2026-07-28.md` — the lifecycle shape C5.2 copies, and the decision that settled the sample-entity question (`TestResult` **is** the sample record). C5 does not re-open it.
- `docs/plans/wave-c3-spatial-tests-lims-spec-2026-07-28.md` — **line 87**, the honesty rule this wave generalises; **line 970-972 of `backend/prisma/schema.prisma`**, the `sampleLocationSource` comment that pre-authorises a future imported provenance value and forbids overloading an existing one.
- `docs/plans/wave-b-migration-importer-spec-2026-07-26.md` — the import-with-provenance envelope C5.5 must ride if it is ever unblocked. `ImportBatch.kind` reserves `'test_register'` (`backend/prisma/schema.prisma:2147-2148`); C5 does **not** claim that slot.
- `docs/plans/wave-d-handover-spec-2026-07-28.md` — the folio payload contract C5.3 extends, and the acceptance-test high-water mark (**line 30**).
- `docs/plans/wave-e-approvals-spec-2026-07-28.md` — the hold-point release surface C5.3 feeds.
- `docs/research/d0-adac-handover-research-2026-07-28.md` — **the D2 kill.** Its verdict deletes the XML-writer limb of D2 outright. Program line 79's *"and D2 asset records"* therefore has no receiver, and §1.2 disposes of it rather than pretending otherwise.

**House style** matches the C1, C2, C3, D, E and F specs: numbered sections, an explicit non-goal disposal of every clause of the program line, a current-state map read at a stated SHA, a decision register with flip conditions, per-phase rollback, named acceptance tests continuing the shared series, an exit gate, and program §9's thirteen delivery-control items enumerated.

**Tag namespace.** `[C5S-*]` (C5 **S**urvey/**S**upply) for this spec's own decisions; `[C5S-B*]` for the blockers no PR may violate; `[C5R-B*]` / `[C5R-A*]` reserved for a future review fold. `[C1C-*]`, `[C1R-*]`, `[C2L-*]`, `[C2R-*]`, `[C3S-*]`, `[C3R-*]`, `[D14R-*]`, `[DH-*]`, `[DR2-*]`, `[FR-*]` and `[WBR2-*]` are taken. **Never use a bare `C5` tag** — `C5` is a live clause-number fragment across `docs/research/sa-dit-*.md` and `docs/research/vic-itp/01-earthworks-pavements.md`.

**Acceptance-test numbering.** The shared series' highest allocated number across `docs/` at this SHA is **AT-156** (`docs/plans/wave-d1b-threat-model-2026-07-28.md:55-56`; `wave-d-handover-spec-2026-07-28.md:30` records *"The next free number is AT-157"*). **C5 deliberately does not take AT-157.** A second execution spec (Wave G) is being authored against the same tree on the same day, and a monotonic series cannot be allocated by two authors at once without a merge collision that silently renumbers someone's assertions. **C5 takes AT-170 onward and reserves AT-157 … AT-169 for Wave G and for D1c.1's in-flight numbers.** A gap in the series is harmless; a collision is not — the same reasoning `FolioIssueReservation` already ships (`backend/prisma/schema.prisma:2262-2268`).

**Ponytail note.** This wave's program line names eight things. Read against the tree, three of them can be built with **one nullable FK, one nullable text column, one new table and three read routes**; three of them are blocked on primary sources nobody in this program has read; and one of them — *"and D2 asset records"* — has no receiver left. The largest contribution this document makes is not the build. It is the finding in §0.4 that the word *"dockets"* in program line 79 does not refer to CIVOS's `Docket` model, and that building it there would have put supplier evidence inside a subcontractor payment approval flow.

---

## 0. What this slice is, what it deliberately is not

### 0.1 The one-paragraph version

A quality manager can answer two questions that today live in somebody's inbox: **"has the conformance survey for this lot been done and accepted, and by whom?"** and **"what material went into this lot, from which supplier, on which docket?"** Both answers are *filed evidence with attribution and a lifecycle* — a survey record that moves requested → in progress → received → accepted, carrying the surveyor's name, the report file, and **the verdict the surveyor themselves stated**; and a delivery record that already exists in the diary, now carrying the supplier's docket as an attached document and a lot it was placed in. Both appear in the lot conformance folio and in the hold-point release package, so an external reviewer sees them without being sent an email. **CIVOS never computes a tolerance verdict, never declares a survey conforming, and never holds certified survey geometry** — the three things that would put it on the wrong side of the RPEQ boundary the program draws at line 90.

### 0.2 The scope cut — every clause of program line 79, disposed

| Program line 79 clause | Disposition |
| --- | --- |
| *"survey request → completion → review → acceptance workflow"* | **PARTIALLY IN — C5.2.** The **record and its states** ship (§4.5). The *outbound request to an external surveyor* does **not**: that is an external-party token surface and it belongs to Wave E's threat model, not a new one invented here (§1.2). The state names themselves are **pilot-gated** `[C5S-B4]` — see §1.3. |
| *"design-vs-as-built values with tolerance results"* | **OUT of v1 — C5.4, BLOCKED.** Three independent research gaps (RG-2, RG-3, RG-7, §3). What ships instead is the **surveyor's own stated verdict, transcribed and attributed** — never a CIVOS-computed one `[C5S-B1]`. |
| *"survey file + instrument provenance"* | **HALF IN — C5.2.** The *file* is provenance: which document, produced by whom, when, superseding what. **Instrument provenance is OUT** — RG-4 (§3): nobody in this program has established what a total-station/GNSS record carries or whether any of it reaches a head contractor. A nullable `instrumentNote` free-text column was considered and **rejected** `[C5S-c]`: a field that is empty on every real record is a claim the product cannot keep. |
| *"survey revision/supersession"* | **IN — C5.2.** The `Drawing` pattern, verbatim: a new revision is a new row, the old row gets `supersededById`, and the underlying `Document` is `onDelete: Restrict` so the original file cannot be deleted out from under it (`backend/prisma/schema.prisma:1759`, `:1764`; guard `backend/src/routes/drawings.ts:36-63`). |
| *"material/product approvals"* | **OUT of v1 — C5.4, BLOCKED.** RG-5 (§3). Submittal/approval-register practice, and who the approving authority is, is not established at any grade in `docs/research/`. |
| *"supplier certificates"* | **PARTIALLY IN — C5.1.** A supplier's certificate or docket is filed as a `Document` attached to the delivery it belongs to (§4.4). **Structured extraction of certificate fields is OUT** — RG-6 (§3): the field lists are governed by material standards nobody here has read, and inventing them is the failure class `[C5S-B1]` names. |
| *"batch/delivery traceability (concrete/asphalt dockets → installed lot)"* | **IN — C5.1**, and it is the phase that ships first because the data already exists (§0.4, §2.1). |
| *"rejected/quarantined material state"* | **OUT of v1 — C5.4, BLOCKED.** RG-8 (§3). Whether AU civil contractors run a distinct quarantine state or route it through an NCR is unestablished, and CIVOS's NCR is lot-scoped, not material-scoped (`NCRLot`, `backend/prisma/schema.prisma:1098`). |
| *"Feeds C4 integrity"* | **IN — C5.2/C5.3** by construction: originals preserved, supersession chains, attributed provenance. C5 does **not** build C4; it stops leaving C4 a mess to clean up. |
| *"Feeds E2 release packages"* | **IN — C5.3.** `backend/src/routes/holdpoints/evidencePackage.ts` gains one collection and one summary count, read by all three of its consumers. |
| *"Feeds D2 asset records"* | **CLOSED — the receiver does not exist.** `docs/research/d0-adac-handover-research-2026-07-28.md` deletes the XML-writer limb of D2 on two independent kills. **The program line should be amended.** What survives is the folio (D1), and C5.3 feeds *that* instead. |

### 0.3 The honesty rule this whole wave turns on `[C5S-B1]`

**A conformance verdict is a certification. CIVOS records who made one; it never makes one.**

C3 stated this for coordinates: *"A location on a test record is evidence. CIVOS never writes one it did not receive from a human or an instrument"* (`docs/plans/wave-c3-spatial-tests-lims-spec-2026-07-28.md:85`). C5 is the same rule one level up, and it is the rule the program itself draws at line 90 (*"CIVOS assembles and links; certifiers certify"*).

Concretely, and asserted by AT-172 and AT-181:

- No CIVOS-computed design-vs-as-built tolerance verdict. Not in v1, not behind a flag, not as an "indicative" number.
- No survey record may reach `accepted` without a named human actor and a timestamp — enforced by a `CHECK`, not by prose (§5.2).
- The `surveyorVerdict` column stores **what the report says**, is labelled in every surface as *the surveyor's verdict*, and carries `'not_stated'` as a first-class value so "the report did not say" is recordable as a fact rather than backfilled as a guess.
- No AI extraction writes a verdict, a tolerance or an acceptance without a human decision passing through `AiProposal` — and C5.1–C5.3 ship **no AI extraction at all** (§1.2).
- No user-facing string, marketing copy or Clancy knowledge entry may say CIVOS *checks*, *validates*, *verifies* or *certifies* a survey. Permanent `[C5S-B2]`.

### 0.4 The finding that changes the wave's shape — *"dockets"* in line 79 is not CIVOS's `Docket`

Program line 79 says *"concrete/asphalt dockets → installed lot"*. The obvious build is on the model named `Docket`. **That build would be wrong, and it would be wrong in a way that is hard to undo.**

`DailyDocket` (`backend/prisma/schema.prisma:1461-1497`) is a **subcontractor labour-and-plant timesheet for a project-day**. Its twenty columns are hours, rates and approval amounts: `totalLabourSubmitted`, `totalLabourApprovedCost`, `totalPlantApprovedCost` (`:1476-1481`); its children are `DocketLabour` (`:1499`) and `DocketPlant` (`:1536`); its statuses are `draft | pending_approval | approved | rejected | queried` (`backend/src/routes/dockets/validation.ts:10-16`). **It has no supplier, no material, no quantity of anything but time, no batch number, no attachment relation of any kind, and no `lotId`** — lots attach one level down, on hour allocations (`DocketLabourLot:1522`, `DocketPlantLot:1557`), gated so a subcontractor may only allocate to lots assigned to their own company (`backend/src/routes/dockets/access.ts:220-261`).

The record program line 79 actually describes already exists under a different name. **`DiaryDelivery`** (`backend/prisma/schema.prisma:1253-1273`) carries `description`, `supplier`, `docketNumber`, `quantity`, `unit` and a nullable `lotId`. It is written from the foreman's field capture path, including offline (`frontend/src/lib/offline/diaryQuickAdd.ts:202`, `:214`; sync at `frontend/src/lib/offline/syncWorker.ts:501`), and it is idempotent under retry via `@@unique([diaryId, requestKey])`.

So C5.1 is **eight-tenths already shipped**, and the correct build is two nullable columns on a table foremen already fill in — not a new subsystem, and emphatically not a change to the payment flow.

**`[C5S-B3]` — C5 touches no file under `backend/src/routes/dockets/` and adds no column to `daily_dockets`, `docket_labour` or `docket_plant`.** Enforced as a diff grep in the exit gate (§14 item 7).

**A boundary the repo does not currently write down, and C5 must not be the wave that erodes it.** The lead brief for this spec described a standing rule that dockets and claims never cross. **That rule is not written anywhere in this repository** — grepped across `docs/`, `CLAUDE.md`, `AGENTS.md`, `tasks/lessons.md`, `backend/src` and `frontend/src` for every phrasing of it: **NOT FOUND.** What exists is a de-facto separation plus one inert wire: the readiness engine declares `approvedDockets: number` in `evidenceCounts` (`backend/src/lib/evidenceReadiness/core.ts:184`) and emits it as a `severity: 'support'`, `blocksAction: false` item (`backend/src/lib/evidenceReadiness.ts:243-250`), and **every producer feeds it a hard-coded `0`** (`backend/src/routes/claims/readRoutes.ts:288`, `backend/src/routes/lots/qualityRoutes.ts:355`, `backend/src/routes/projectCloseoutReadiness.ts:118`). The one contrary statement in docs runs the *other* way (`docs/product/pilot-journeys.md:354-355`: *"dockets are part of commercial proof"*).

C5's obligation is narrow and absolute: **it does not change any of those three zeros, and it does not add a docket-sourced input to any claim or conformance path.** `[C5S-B3]`. Whether that de-facto separation should become a written rule is **DC5-4** (§15.1) — a product call, not this wave's to make unilaterally.

---

## 1. Outcome, scope and non-goals

### 1.1 Outcome

1. **A lot's material history is answerable from the lot.** Every delivery recorded against the lot, with supplier, docket number, batch reference, quantity, and the supplier's docket filed as a retrievable document.
2. **A lot's survey history is answerable from the lot.** Every survey record with its kind, its status, who surveyed it, when, the report file, the surveyor's stated verdict, who accepted it, and what it superseded.
3. **Both appear where an external party already looks** — the lot conformance folio (D1) and the hold-point release package (E2) — without a human assembling them.
4. **Nothing is automatically decided.** C5 adds **no blocking readiness code**, moves **no** lot to conformed, and gates **no** claim. Its readiness contributions are `warning` and `support` only `[C5S-B5]`.
5. **The three blocked limbs are blocked out loud**, with the specific primary source each needs, so the next agent does not silently approximate one (§3).

### 1.2 Non-goals (explicit — do not build in C5)

- **No survey modelling or authoring.** Program §4 line 110. CIVOS does not create, edit, adjust or reduce survey data.
- **No certified survey geometry in the database, in any form, in v1.** Not a point, not a surface, not a string. This is the strongest available compliance with program line 86 (*"never modifies the certified geometry itself"*): CIVOS cannot modify what it does not hold. C5.5 is where that would change, and C5.5 is blocked (§3.2).
- **No CIVOS-computed tolerance verdict.** `[C5S-B1]`. Permanent for v1; its flip condition is RG-2 **and** RG-3 **and** a pilot, all three, and it is stated at `[C5S-a]`.
- **No new geometry file format.** No LandXML surface reader, no `.12da`, no shapefile, no KML, no coordinate CSV importer. The tree parses LandXML and DXF **alignments only** (`backend/src/lib/spatial/alignmentFileImport.ts:16`, `:25`), and adding a format means adding a magic-byte signature kind to `backend/src/lib/imageValidation.ts` — a security-surface change C5 does not need.
- **No datum transformation work.** `backend/src/lib/spatial/crs.ts:12-20` records, in a `ponytail:` comment, that GDA94 and GDA2020 are **both** treated as WGS84-aligned (`towgs84=0,0,0`) and that the ~1.8 m GDA94→GDA2020 shift is unimplemented. C5 neither uses nor fixes this. It is named here because it is the *hard* blocker on C5.5 (§3.2) and the next agent must not discover it after starting.
- **No outbound survey request to an external party.** No email, no token, no public page. Wave E owns external-party surfaces and has a merged threat model for them (`docs/plans/wave-e0-threat-model-2026-07-28.md`); C5 does not open a second one. A survey "request" in v1 is an internal record state.
- **No AI extraction in C5.1–C5.3.** No survey-report reader, no supplier-certificate reader. If one is ever built it rides `AiProposal` (`backend/prisma/schema.prisma:2110-2136`) with a server-side whitelist normaliser, per the shipped doctrine at `backend/src/routes/copilot/projectFactsExtraction.ts:91-95` — **not** the bespoke inline loop the test-certificate path uses (`backend/src/routes/testResults/certificateIntake.ts:261-271`), which stores no proposal row, no citations and no rollback target. `[C5S-d]`.
- **No change to the test-certificate lifecycle.** C2 is shipped and C4 owns its integrity gaps — including the real one at `backend/src/routes/testResults/certificateAttachment.ts:210`, where replacing a certificate **deletes** the prior `Document` row rather than versioning it. C5 records the finding (§18) and **does not reuse that pattern**; fixing it is C4's.
- **No `Supplier` entity, no supplier registry, no supplier approval.** `supplier` stays the free-text column it is (`backend/prisma/schema.prisma:1257`). A registry is C5.4's, and C5.4 is blocked.
- **No second readiness engine, no cached verdict column, no recalculation job.** Inherited from `[C2L-B3]` via `[C3S-B2]`.
- **No blocking readiness reason code.** `[C5S-B5]`. C5 adds members to `READINESS_REASON_CODES` (`backend/src/lib/readiness/contracts/reasonCodes.ts:29`) but **not** to `HANDOVER_BLOCKING_REASON_CODES` (`:114`).
- **No new Logan PSP5 profile item.** PSP5 §5.6.5's mandatory pack list, as quoted in `docs/research/d0-adac-handover-research-2026-07-28.md`, names the inspection-and-testing certificate, test results, retest/rectification detail, CCTV, pre-backfill photographs, an asset list and O&M manuals. **It does not name a survey deliverable.** Adding a profile item for one would be inventing a council requirement. `backend/src/lib/handover/loganPsp5Profile.ts` is untouched.
- **No change to `ImportBatch.kind`.** `'test_register'` stays reserved and parked (`backend/prisma/schema.prisma:2147-2148`); C5 does not claim it and does not add a `'survey'` kind while C5.5 is blocked.

### 1.3 What is pilot-gated, and why the gate is real

Program line 84 already requires the D2 workflow to be validated *"with surveyors, contractors, and ≥3 receiving councils"* before it is defined. C5.2's workflow inherits the first two of those three. The split this spec draws:

**Structurally safe without pilot validation** — because it is a filing structure whose correctness does not depend on how anyone works: the record's existence, its lot link, its attached file, its supersession chain, its immutable original, its tenancy scoping, its appearance in the folio and the release package.

**NOT safe without pilot validation** — because it encodes a claim about how a real job runs: the **names and count of the workflow states**, whether *review* and *acceptance* are two steps or one, who performs each, and whether a survey is requested per-lot or per-area-per-visit.

**The resolution `[C5S-B4]`:** C5.2 ships the five states named in §4.5 **behind the feature flag** (§11), and the flag stays off for any tenant until **one real conformance survey has round-tripped with a real contractor and the state names have been confirmed or corrected**. The states are `CHECK`-constrained in the migration, so correcting them is a reviewed migration and not a silent data drift — which is exactly why they are constrained rather than free text. Pilot acceptance owner: **Jay**, with a design-partner surveyor (§17 item 10).

---

## 2. Current-state map (read at `f944c39a`)

### 2.1 Material traceability — what exists

| Thing | Where |
| --- | --- |
| **The delivery record** | `DiaryDelivery` `backend/prisma/schema.prisma:1253-1273`. `description String` (required), `supplier String?` `:1257`, `docketNumber String?` `:1258`, `quantity Decimal?`, `unit String?`, `lotId String?` `:1261` (`onDelete: SetNull` `:1269`), `notes String?`, `requestKey String?` `:1264`, `@@unique([diaryId, requestKey])` `:1271`. **No attachment relation, no batch reference.** |
| Write routes | `POST /api/diary/:diaryId/deliveries` `backend/src/routes/diary/diaryItems.ts:239`; `PUT` `:280`; `DELETE` `:320`. Zod at `backend/src/routes/diary/diaryItemsValidation.ts:126-137`. |
| Read paths | diary fetch `backend/src/routes/diary/diaryCore.ts:184`, `:235`, `:308`, `:335`; report `diaryReporting.ts:481`, `:516`; submission `diarySubmission.ts:48`, `:173`, `:226`. |
| Field capture | `frontend/src/components/foreman/sheets/AddDeliverySheet.tsx:20`, `:31`, `:56`, `:84`, `:116`, `:164-169`; timeline `frontend/src/components/foreman/DiaryTimelineEntry.tsx:10`, `:134-136`. |
| Offline | `frontend/src/lib/offline/core.ts:228`; `diaryQuickAdd.ts:202`, `:214`; `syncWorker.ts:501`. |
| **Reachability** | **Only through a diary.** There is no delivery register, no project-level query, and no lot-level query. `Lot.diaryDeliveries DiaryDelivery[]` exists as a relation (`schema.prisma:641` region) with **no route reading it**. |
| Material classification | `Lot.materialType String?` `backend/prisma/schema.prisma:605`, migration `backend/prisma/migrations/20260727120000_d14_lot_material_type/migration.sql:9`. Validated at the route against the resolved ruleset's `materialTypes` (`backend/src/lib/readiness/sufficiency/types.ts:312`; whitelist `sufficiency/lotAttributeValidation.ts:74-86`). **It is a test-frequency classification, not a traceability link** — nothing joins it to any delivered material. |
| Photo category | `'Material Delivery'` already exists in `PHOTO_CLASSIFICATION_CATEGORIES` (`backend/src/routes/documents/classificationRoutes.ts:44-57`), alongside `'Survey'`. |
| **NOT FOUND** | `Supplier` model · `batchNumber` / `batch_number` / `batchPlant` · `mixDesign` · `productApproval` · `quarantine` · any material-scoped NCR · any material conformance certificate concept. All grepped across `backend/prisma`, `backend/src`, `frontend/src`. The only `batch` hits are `HoldPointReleaseBatch` (`:867`), `ImportBatch` (`:2145`) and `HoldPointReleaseToken.batchId` (`:832`) — none of them material. |

### 2.2 Survey — what exists

| Thing | Where |
| --- | --- |
| **NOT FOUND** | `model Survey`, `SurveyPoint`, `AsBuilt`, any as-constructed record. Grepped `backend/prisma/schema.prisma` in full. |
| Design alignment import | `ControlLine` `backend/prisma/schema.prisma:487-504` — `coordinateSystem String` (EPSG, `:490`), `points Json` (`[{chainage, easting, northing}]`, `:491`), `geometryWgs84 Json?` derived cache (`:492`). Parsers: `parseAlignmentFile` `backend/src/lib/spatial/alignmentFileImport.ts:25`, dispatch `detectFormat` `:16` (LandXML **or** DXF, by extension then `<`-sniff), 20 MB cap `:14`; `parseLandXml` `backend/src/lib/spatial/landxmlParser.ts:147` (on `fast-xml-parser` 5.10.1); `parseDxf` `backend/src/lib/spatial/dxfParser.ts:298` (hand-written, 315 lines). Route `POST /:projectId/control-lines/import` `backend/src/routes/controlLines/index.ts:221` — **preview only, no DB write**. |
| Set-out sheet AI read | `POST /:projectId/control-lines/extract-points` `backend/src/routes/controlLines/index.ts:192`; extractor `controlLines/setoutExtraction.ts:231`; output-side trust boundary `cleanSetoutCandidate` `:116` (*"this is the trust boundary that turns untrusted model output into a safe candidate"*, `:107-115`); `MAX_SETOUT_POINTS = 2000` `:17`. Rides `AiProposal` stage `control_line`. |
| Lot geometry | `LotGeometry` `backend/prisma/schema.prisma:506-527` — `geometryWgs84 Json` (`:515`), `kind` (`chainage_offset|drawn|point`, `:509`). **No CRS column** — WGS84 by convention. |
| Sample points (C3) | Four nullable columns on `TestResult` `backend/prisma/schema.prisma:967-976`, `sampleLocationSource` `CHECK`-constrained to `('gps','map_pick')` (`backend/prisma/migrations/20260729000000_test_sample_point/migration.sql:29-31`). The schema comment at `:970-972` pre-authorises a future imported provenance value: *"A future imported source adds a value here; it never overloads an existing one."* |
| **Versioning / immutability of spatial data** | **None.** `ControlLine`, `LotGeometry` and `PlanSheet` all carry `updatedAt` and all have live `PATCH`/`DELETE` (`controlLines/index.ts:333`, `:379`; `lots/geometryRoutes.ts:243`; `planSheets/index.ts:219`, `:277`). No version column, no supersede chain, no trigger. |
| **The datum gap** | `backend/src/lib/spatial/crs.ts:12-20` — a `ponytail:` comment stating GDA2020 and GDA94 are both mapped `towgs84=0,0,0`, that GDA94 is ~1.8 m off, that no 7-parameter transformation exists, and naming the upgrade path. Presets `:34-42`. |
| Photo category | `'Survey'` `backend/src/routes/documents/classificationRoutes.ts:45`. |
| Diary suggestion | `'Survey and setout'` `backend/src/routes/diary/diarySuggestions.ts:159`. |
| Handover note | `backend/src/lib/handover/loganPsp5Profile.ts:238-239`, `:827-828` — already records that as-constructed survey data is **not** produced by CIVOS. |

### 2.3 The lifecycle and integrity patterns C5 inherits

Four shipped patterns. C5 copies three and explicitly refuses one.

**(a) Supersession — `Drawing`. COPY.** A revision is a new row; the old row gets `supersededById`; reads filter `supersededById: null` (`backend/src/routes/drawings/readRoutes.ts:110`). The guard `requireSupersededByInProject` (`backend/src/routes/drawings.ts:36-63`) enforces not-self, same project, same drawing number, and target-is-current. The file is `onDelete: Restrict` (`backend/prisma/schema.prisma:1764`) so the original cannot be deleted.

**(b) Immutable proposal + human decision + rollback — `AiProposal`. COPY if C5 ever extracts.** `payload` is immutable (`schema.prisma:2118`), edits go to `editedPayload` (`:2122`), apply runs inside the deciding transaction (`backend/src/routes/copilot/proposalService.ts:166`), `appliedRecordIds` is the rollback target (`:17-20`), every transition writes an `AuditLog` (`:100-107`, `:180-187`, `:229-236`).

**(c) Conditional immutability — `TestResult`'s verified rows. COPY.** `NON_SUBSTANTIVE_EDIT_FIELDS` (`backend/src/routes/testResults/crudRoutes.ts:370-400`) is a shared list, and its header calls itself a **trust boundary**: because `hasSubstantiveEdit` iterates `Object.keys(updateData)`, a key omitted from the list un-verifies the row. C5.2's `accepted` state uses the same shape and the same explicit list.

**(d) Certificate replacement — `TestResult`. DO NOT COPY.** `backend/src/routes/testResults/certificateAttachment.ts:210` calls `tx.document.delete(...)` on the prior certificate, and `:225` best-effort deletes the storage object. `Document.version`, `parentDocumentId` and `isLatestVersion` exist (`backend/prisma/schema.prisma:1701-1703`) and this path does not use them. C5 uses them (§4.3). Fixing the C2 path is **C4's**, and §18 records the finding rather than silently fixing it in the wrong wave.

**Upload validation as it stands.** Twelve independent multer configs; no shared upload router. The real gate is magic-byte sniffing: `assertUploadedFileMatchesDeclaredType` (`backend/src/lib/imageValidation.ts:232-260`) resolves a signature kind from **both** the declared MIME and the extension and **rejects when they disagree** (`:248-250`), then verifies the first 4096 bytes (`hasUploadSignature` `:200`). Signatures cover PDF (`:159`), JPEG/PNG/GIF/WebP (`:55-83`), TIFF (`:163`), DWG (`:171`), DXF (`:175-191`) and ZIP/OOXML (`:196`). **An unrecognised kind returns silently** (`:244-246`) — unknown types are pass-through, which is why C5 adds no new type. **Malware scanning: NOT FOUND.** `clamav|virus|malware|antivirus` across `backend/src` returns one *comment* (`backend/src/routes/copilot/import/importSourceStorage.ts:41`) and no scanner.

**Storage.** Refs are `supabase://documents/<path>` (`getSupabaseStorageReference` `backend/src/lib/supabase.ts:82-84`). Ownership checks via `getSupabaseStoragePath(fileUrl, {bucket, expectedPrefix})` (`:131`). Path traversal guarded at `backend/src/lib/uploadPaths.ts:16`, `:43` and `backend/src/lib/supabase.ts:15`, `:52-67`. Browser access is backend-mediated (`DocumentSignedUrlToken` `schema.prisma:1733-1748`; routes `backend/src/routes/documents/fileAccessRoutes.ts:58`, `:88`).

### 2.4 The consumers C5 must feed

**The folio payload contract.** `backend/src/lib/handover/folioPayload.ts` is the renderer's only input and is deliberately Prisma-free (asserted by AT-153, header `:5-11`). To be includable, a C5 record must:

1. add a `FolioXxxPayload` interface and a key on `FolioEvidencePayload` (`:126-132`), and be counted in `countEvidenceRows` (`:148`);
2. add its `FolioSourceType` (`backend/src/lib/handover/revisionTokens.ts:32-40`) and a `RevisionTokenKind` entry in `REVISION_TOKEN_KINDS` (`:47-60`) — `'version' | 'updated_at' | 'row_digest'`;
3. **bump `FOLIO_PAYLOAD_SCHEMA_VERSION`** (`revisionTokens.ts:107`) — the rule is stated in that comment and applies to a shape change *or* a digest-field-list change;
4. be queried in `backend/src/routes/folio/assemble.ts` at `CEILING + 1` and counted against `FOLIO_EVIDENCE_ROW_CEILING_DEFAULT = 5000` (`assemble.ts:51`, read at call time by `folioEvidenceRowCeiling()` `:53-58`) — **over-ceiling is a refusal with the measured number, never truncation**;
5. have any verdict decided **server-side** (`testVerdict()` `assemble.ts:64-70`) — the renderer prints the string it is given.

**The hold-point evidence package.** `backend/src/routes/holdpoints/evidencePackage.ts` — pure DB-free presentation mappers shared by three consumers (`GET /:id/evidence-package` `backend/src/routes/holdpoints/readRoutes.ts:276`, `POST /preview-evidence-package` `:453`, and the public token page). Its input types are `EvidenceChecklistItemInput` (`:26`), `EvidenceCompletionInput` (`:34`), `EvidenceTestResultInput` (`:56`) and a photo input; resolution at `evidencePackageInputs.ts:16`.

**Readiness.** `EvidenceReadinessArea` (`backend/src/lib/evidenceReadiness/core.ts:8-19`) is a closed union — a C5 area is a new member. `EvidenceReadinessItem.code` is narrowed to `ReadinessReasonCode` (`core.ts:21` and the comment at `:22-31`: *"An unregistered code is now a COMPILE ERROR at the emitter"*), so a C5 code requires an entry in `READINESS_REASON_CODES` (`reasonCodes.ts:29`) **and** in `REASON_CODE_PROVENANCE` (`:149`) in the same change.

### 2.5 F0 status — C5 is standalone

`RequirementDefinition`, `RequirementInstance`, `EvidenceLink`, `ActionAssignment` and `ExceptionOrWaiver`: **NOT FOUND** in `backend/prisma/schema.prisma`. All five grepped. What exists is `RequirementEvaluation` (`:1836`) — the immutable **snapshot** table, written only by `backend/src/lib/readiness/recordDecision.ts` behind `READINESS_SNAPSHOTS_ENABLED` (`:237`), rows explicitly *"immutable: no update/delete API"* (`schema.prisma:1830-1834`) — plus `ActionAssignment` as a **type with no table** (`backend/src/lib/readiness/contracts/actionAssignment.ts`).

**Consequence:** C5 cannot hang a survey or material requirement on a definition model, and **must not invent a fourth definition store** — the mistake C3 §1.3 already refused once. C5's only F0 integration is the cheap, correct one: a new `EvidenceReadinessArea` member and two new registered reason codes, which then flow into D1's closeout roll-up for free.

---

## 3. Blocking research — what must not be invented

Every row is a fact this spec would have had to make up. None is approximated; each names the phase it blocks and the primary source that unblocks it. Grades follow the program §10 scale (**A** primary authority/specification/legal; **B** official vendor/competitor documentation; **C** customer or independent secondary; **D** marketing/consultancy/directional).

### 3.1 The register

| ID | The gap | What would be invented without it | Blocks | Unblocked by |
| --- | --- | --- | --- | --- |
| **RG-1** | **What a conformance-survey deliverable actually is when it reaches a head contractor.** A signed PDF report? A CSV/TXT of reduced points? A LandXML surface? A 12d `.12da`? All of the above per job? | The file types C5.5 accepts, and whether "import" is even the right verb. | **C5.5** | Three real deliverables from three real jobs, plus one surveyor conversation. Grade C is sufficient here — this is practice, not specification. |
| **RG-2** | **How authority specifications express surface/level tolerance**: per-point vs statistical, the conformance unit (point / lot / area), and whether a "result" is a deviation, a pass/fail, or a distribution. | The shape of any tolerance record and of any verdict. | **C5.4** | The relevant clauses of the same editions C1 already encodes — VicRoads Section 204 and TfNSW R44 — read as primary sources, grade **A**. Nothing below A is admissible: C1's own precedent is that frequency rules are read from the cited edition and confirmed (`backend/src/lib/readiness/sufficiency/types.ts:301-302`). |
| **RG-3** | **Whether a head contractor holds a machine-readable design surface** to compare an as-built against, and in what datum. | That design-vs-as-built comparison is possible at all inside CIVOS. | **C5.4, C5.5** | Contractor conversation + one real job's design deliverable. Grade C. |
| **RG-4** | **What instrument provenance a survey deliverable carries**, and whether any of it survives to the contractor. | Every field of an "instrument provenance" record. | **C5.2's deferred limb** | Surveyor conversation + one real deliverable. Grade C. |
| **RG-5** | **Material/product approval practice in AU civil**: who submits, who approves (superintendent? designer?), what artefact records the approval, and whether it is per-project or per-supplier. | The entire approval workflow, its states and its authority model. | **C5.4** | A real project's approved-materials register + the contract clause that mandates it. Grade A for the clause, C for the register. |
| **RG-6** | **What a supplier conformance certificate / delivery docket is required to contain** for concrete and asphalt. | Every structured field of a certificate record. | **C5.4** | The governing material standards, read directly, grade **A**. Note the trap: a field list inferred from one supplier's docket layout is grade C masquerading as A. |
| **RG-7** | **Whether "survey acceptance" is a distinct contractual act** in AU civil, or a byproduct of the superintendent releasing a hold point. | Whether C5.2's `accepted` state duplicates a hold-point release. | **C5.2 state names** (pilot gate `[C5S-B4]`) | One contractor + one surveyor. Grade C. |
| **RG-8** | **Whether AU civil contractors run a distinct quarantine/rejected-material state**, or route non-conforming material through an NCR. | A whole state machine, and possibly a duplicate of NCR. | **C5.4** | Contractor conversation; check against the NCR flow already shipped. Grade C. |
| **RG-9** | **Whether `fast-xml-parser` 5.10.1 as configured is XXE-safe**, and what a hostile LandXML/GML file can do to it. | The safety of any future survey XML import. | **C5.5** | Read the parser's entity/DTD handling and its configuration at `backend/src/lib/spatial/landxmlParser.ts:33`; write one hostile-fixture test. This is a code question, not a domain one — **an hour's work, not a research pass** — but it must be answered *before* C5.5, not during. |

### 3.2 What each blocked phase is actually blocked on

**C5.4 (material approvals, structured supplier certificates, quarantine) is blocked on RG-5, RG-6 and RG-8** — three independent domain gaps. It is *not* blocked on code: the tables would be routine. It is blocked because a materials-approval register whose states and fields were guessed is worse than none — it will be filled in wrong, and it will then be exported into a folio that an engineer signs.

**C5.5 (survey file/geometry import and design-vs-as-built) is blocked on four things, and the fourth is not research at all:**

1. RG-1 — what the file is;
2. RG-2 — what a verdict means;
3. RG-3 — whether the comparison input exists;
4. **The datum gap.** `backend/src/lib/spatial/crs.ts:12-20`. Level and position tolerances in civil work are millimetre-to-centimetre. The shipped CRS layer carries a **~1.8 m** unimplemented datum shift between GDA94 and GDA2020 and is honest about it in a comment. Importing certified survey positions through that layer and comparing them to a design would produce a verdict that is wrong by two orders of magnitude more than the tolerance being tested — and it would look plausible. **This is a code blocker with a known fix (a 7-parameter transformation), and it must be closed before any coordinate C5 did not create passes through `localToWgs84` (`crs.ts:78`).** `[C5S-B6]`.

Any of the four alone is sufficient to stop C5.5. The datum one is the cheapest to close and the most dangerous to skip.

### 3.3 What is structurally safe to build with none of it

The line is clean: **a filing structure is safe; a domain claim is not.**

Safe, and therefore in C5.1–C5.3 — the record's existence, its identity, its lot link, its attached original file, its supersession chain, its actor attribution, its timestamps, its tenancy scoping, its immutability rules, its appearance in the folio and the release package, and the transcription of a verdict *somebody else made*.

Unsafe, and therefore blocked — the states of a workflow nobody has watched, the fields of a certificate nobody has read the standard for, the numeric meaning of a tolerance, and any verdict CIVOS computes.

---

## 4. The design

### 4.1 Two subjects, two tables, no shared abstraction

A survey deliverable and a materials delivery are not the same kind of thing: one is a professional service with a review lifecycle and a certifier, the other is a goods receipt captured by a foreman in the field, often offline. A shared `TraceabilityRecord` with a `kind` discriminator would be an interface with two implementations and a permission matrix that has to branch on the discriminator anyway. **Two tables — and one of them already exists.** `[C5S-b]`

### 4.2 Attributed verdicts, never computed ones

`SurveyRecord.surveyorVerdict` is `CHECK`-constrained to `('conforms','does_not_conform','qualified','not_stated')`. It is a **transcription**, and every surface that renders it must render it attributed — *"Surveyor's verdict: conforms — J. Smith, Registered Surveyor, per report rev B"* — never as a bare status chip that reads like CIVOS's own finding. `'not_stated'` exists so that "the report gave no verdict" is a recordable fact, which is the difference between an honest gap and a backfilled guess. `[C5S-B1]`, AT-172.

### 4.3 Originals are preserved; replacements supersede

Two mechanisms, both already in the tree, neither of them new:

- **Record-level:** the `Drawing` supersession chain (§2.3a). A new survey revision is a **new `SurveyRecord` row** with `supersededById` set on the old one. Reads default to `supersededById: null`.
- **File-level:** `Document.version` / `parentDocumentId` / `isLatestVersion` (`backend/prisma/schema.prisma:1701-1703`, self-relation `"DocumentVersions"` `:1712-1713`) — **which exist and are used by nothing.** C5 is their first consumer. A replacement docket or report is a **new `Document` with `parentDocumentId` set and the prior row's `isLatestVersion` cleared**. `[C5S-B7]` — **no C5 code path calls `document.delete`**, asserted by a diff grep in the exit gate.

Both FKs from a C5 record to its `Document` are `onDelete: Restrict`, matching `Drawing` (`schema.prisma:1764`): the file cannot be deleted out from under the evidence record.

### 4.4 The delivery record — C5.1

`DiaryDelivery` gains exactly two nullable columns:

- **`docketDocumentId String?`** → `Document`, `onDelete: Restrict`. The supplier's docket or certificate as filed. Single-valued for the same reason `TestResult.certificateDocId` is (`schema.prisma:949`): a delivery has one docket. **Deliberately `Restrict` where `certificateDoc` is `SetNull`** (`schema.prisma:988`) — it follows `Drawing.document` (`:1764`) instead, because a delivery whose docket silently detached is worse evidence than a document that refuses to delete. Additional photographs continue to go to `Document` with `lotId` and category `'Material Delivery'`, which already exists (`backend/src/routes/documents/classificationRoutes.ts:47`).
- **`batchRef String?`** — free text, capped, **transcribed from the docket**. Not a modelled batch entity, not parsed, not validated against anything. It is honest for the same reason `Lot.materialType` shipped as free text validated only against an authority vocabulary: CIVOS records what the paper says. Structuring it is C5.4's, behind RG-6.

Plus three read surfaces that do not exist today: a lot-scoped delivery list, a project-scoped delivery register with filters, and the folio/release-package projections (§4.6). `lotId` stays **nullable** — a foreman recording a delivery at 6am who does not yet know the lot must not be blocked, and forcing the link would produce wrong links, not more links. The register surfaces unlinked deliveries as a **warning-severity** readiness item so they get linked, never as a blocker `[C5S-B5]`.

### 4.5 The survey record — C5.2

A new `SurveyRecord`, deliberately shaped like `TestResult`'s lifecycle because that lifecycle is shipped, understood, and already renders in the surfaces C5 must feed.

**States** (`CHECK`-constrained, pilot-gated `[C5S-B4]`): `requested → in_progress → received → accepted`, with `rejected` reachable from `received`. Transitions are a map in one module, in the shape of `VALID_STATUS_TRANSITIONS` (`backend/src/routes/testResults/statusWorkflow.ts:27-33`), and `accepted` is terminal.

**Kinds** (`CHECK`-constrained): `set_out | conformance | as_built`. Three, because they are three different contractual acts. No fourth is added speculatively.

**Gates, mirroring C2's:**
- A record cannot reach `received` without `reportDocumentId` — the analogue of C2's `CERTIFICATE_REQUIRED` (`backend/src/routes/testResults/workflowRoutes.ts:262-268`).
- A record cannot reach `accepted` without a surveyor identity **and** a `surveyorVerdict` (which may be `'not_stated'` — the requirement is that a human looked, not that the report said something).
- `accepted_at IS NULL OR accepted_by IS NOT NULL`, as a `CHECK`. `[C5S-B1]`.
- Once `accepted`, a substantive edit is refused, using the shared-list shape at `backend/src/routes/testResults/crudRoutes.ts:370-400`. The non-substantive list is a **named exported const**, not an inline literal — the `[C3R-A8]` lesson, which cost C3 a review round.

**What it does not have:** coordinates, levels, deviations, tolerances, instrument fields, or any numeric survey value. §3.

### 4.6 What the consumers receive — C5.3

- **Folio.** `FolioEvidencePayload` gains `surveys` and `deliveries`; `FolioSourceType` gains `'survey_record'` and `'diary_delivery'`, both `'updated_at'` (both tables have `updatedAt`; neither needs a digest); `FOLIO_PAYLOAD_SCHEMA_VERSION` **1 → 2**; `countEvidenceRows` counts both; `assemble.ts` queries both at `CEILING + 1`. The survey projection carries the **attributed** verdict string, resolved server-side in the `testVerdict()` shape (`assemble.ts:64-70`) so the renderer prints and never decides.
- **Hold-point evidence package.** One new input type (`EvidenceSurveyInput`) and one new summary count in `backend/src/routes/holdpoints/evidencePackage.ts`, reaching all three consumers through `evidencePackageInputs.ts:16`. Deliveries are **not** added to the release package: a superintendent releasing a hold point is deciding about workmanship and testing, and the delivery register would be noise. Flip condition at `[C5S-e]`.
- **Readiness.** One new `EvidenceReadinessArea` member — **`'survey'`** (`core.ts:8-19`). Deliveries reuse the existing `'diary'` area rather than minting a second one. Two new codes in `READINESS_REASON_CODES` + `REASON_CODE_PROVENANCE`: `survey_not_accepted` (`warning`) and `delivery_not_lot_linked` (`support`). **Neither joins `HANDOVER_BLOCKING_REASON_CODES`** `[C5S-B5]`.

---

## 5. Data model and migrations

Two migrations, both additive, both in the hand-authored wave-tagged slot convention (`20260801000000_d1b_issued_folio`, `20260802000000_d1c1_handover_export`, `20260803000000_f2_company_xero_export_settings` are the three most recent).

### 5.1 `20260804000000_c5_delivery_evidence` (C5.1)

```sql
ALTER TABLE "diary_deliveries" ADD COLUMN "docket_document_id" TEXT;
ALTER TABLE "diary_deliveries" ADD COLUMN "batch_ref"          TEXT;

ALTER TABLE "diary_deliveries"
  ADD CONSTRAINT "diary_deliveries_docket_document_id_fkey"
  FOREIGN KEY ("docket_document_id") REFERENCES "documents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "diary_deliveries_lot_id_idx"    ON "diary_deliveries"("lot_id");
CREATE INDEX "diary_deliveries_supplier_idx"  ON "diary_deliveries"("supplier");
```

`diary_deliveries_lot_id_idx` is required, not optional: `lot_id` has an FK but **no index** today, and every C5 read is lot-scoped.

### 5.2 `20260805000000_c5_survey_record` (C5.2)

```sql
CREATE TABLE "survey_records" (
    "id"                     TEXT NOT NULL,
    "project_id"             TEXT NOT NULL,
    "lot_id"                 TEXT,
    "kind"                   TEXT NOT NULL,
    "status"                 TEXT NOT NULL DEFAULT 'requested',
    "requested_by"           TEXT,
    "requested_at"           TIMESTAMP(3),
    "surveyor_name"          TEXT,
    "surveyor_company"       TEXT,
    "surveyor_registration"  TEXT,
    "surveyed_at"            TIMESTAMP(3),
    "report_document_id"     TEXT,
    "surveyor_verdict"       TEXT,
    "verdict_source_note"    TEXT,
    "reviewed_by"            TEXT,
    "reviewed_at"            TIMESTAMP(3),
    "accepted_by"            TEXT,
    "accepted_at"            TIMESTAMP(3),
    "rejection_reason"       TEXT,
    "superseded_by_id"       TEXT,
    "notes"                  TEXT,
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"             TIMESTAMP(3) NOT NULL,
    CONSTRAINT "survey_records_pkey" PRIMARY KEY ("id")
);

-- Vocabulary is a CHECK, not prose. `[C5S-B4]`: correcting a state name after the
-- pilot is a reviewed migration, which is the point.
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_kind_check"
  CHECK ("kind" IN ('set_out','conformance','as_built'));
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_status_check"
  CHECK ("status" IN ('requested','in_progress','received','accepted','rejected'));
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_verdict_check"
  CHECK ("surveyor_verdict" IS NULL
      OR "surveyor_verdict" IN ('conforms','does_not_conform','qualified','not_stated'));

-- `[C5S-B1]` as a constraint: no acceptance without an accepting human.
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_accepted_actor_check"
  CHECK (("accepted_at" IS NULL) = ("accepted_by" IS NULL));
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_accepted_requires_verdict_check"
  CHECK ("status" <> 'accepted' OR "surveyor_verdict" IS NOT NULL);
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_self_supersede_check"
  CHECK ("superseded_by_id" IS NULL OR "superseded_by_id" <> "id");

-- Restrict on the report: the original file cannot be deleted out from under the
-- evidence record. Matches `drawings.document_id` (schema.prisma:1764).
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_report_document_id_fkey"
  FOREIGN KEY ("report_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT;
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_lot_id_fkey"
  FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL;
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_superseded_by_id_fkey"
  FOREIGN KEY ("superseded_by_id") REFERENCES "survey_records"("id") ON DELETE SET NULL;

CREATE INDEX "survey_records_project_id_status_idx" ON "survey_records"("project_id","status");
CREATE INDEX "survey_records_lot_id_idx"            ON "survey_records"("lot_id");
CREATE INDEX "survey_records_project_id_kind_idx"   ON "survey_records"("project_id","kind");
```

Actor FKs (`requested_by`, `reviewed_by`, `accepted_by`) are `ON DELETE SET NULL` to `users`, matching `TestResult.verifiedById` (`schema.prisma:990` region). **Nothing is backfilled** — there is no historical survey data to recover, unlike C2's `sentToLabAt` (`backend/src/lib/sentToLabBackfill.ts`).

**Both migrations are additive and reversible by column/table drop.** Neither rewrites nor deletes an existing row. Prod apply is the `Production Migrations` GitHub Actions workflow, manually dispatched from `master` with the exact confirmation phrase (`.github/workflows/production-migrations.yml:7`, `:25`, `:30`) — never `db push`, never `--accept-data-loss` (`CLAUDE.md:259-263`).

---

## 6. Invariants C5 must not break

| Tag | Invariant |
| --- | --- |
| **`[C5S-B1]`** | CIVOS records a verdict; it never makes one. No computed tolerance result; no `accepted` without a named actor and timestamp; `'not_stated'` is a value, not a gap to fill. |
| **`[C5S-B2]`** | No user-facing string, marketing copy or Clancy entry says CIVOS checks, validates, verifies or certifies a survey. |
| **`[C5S-B3]`** | C5 touches nothing under `backend/src/routes/dockets/`, adds no column to `daily_dockets`/`docket_labour`/`docket_plant`, and does not change the three hard-coded `approvedDockets: 0` producers. |
| **`[C5S-B4]`** | The C5.2 workflow states stay behind the feature flag until one real conformance survey has round-tripped with a real contractor and the state names are confirmed or corrected. |
| **`[C5S-B5]`** | C5 adds no member to `HANDOVER_BLOCKING_REASON_CODES`. Its readiness items are `warning` and `support` only. C5 blocks no conformance, no claim, no hold-point release, no folio. |
| **`[C5S-B6]`** | No coordinate CIVOS did not itself create passes through `crs.ts:78` until the GDA94↔GDA2020 datum gap (`crs.ts:12-20`) is closed. |
| **`[C5S-B7]`** | No C5 code path calls `document.delete`. Replacements version; they do not destroy. |
| **`[C5S-B8]`** | No new upload file type, no new magic-byte signature kind. C5 accepts only what `imageValidation.ts` already validates: PDF, JPEG, PNG. |
| *(inherited)* `[C2L-B3]` via `[C3S-B2]` | No second readiness engine, no cached verdict column, no recalculation job. |
| *(inherited)* `[C3S-B1]` | No location written that a human or instrument did not supply. C5 writes no locations at all. |

---

## 7. API and UI surface

### 7.1 Backend

| Route | Phase | Guard |
| --- | --- | --- |
| `GET /api/lots/:lotId/deliveries` | C5.1 | `requireInternalProjectAccess` via a `deliveryAccess.ts` that **delegates**, plus `assertBelongsToLot` |
| `GET /api/projects/:projectId/deliveries` (paginated, filters: supplier, lot, date range, linked/unlinked) | C5.1 | same |
| `PATCH /api/diary/:diaryId/deliveries/:deliveryId` — extended for `docketDocumentId`, `batchRef` | C5.1 | existing diary guard, unchanged |
| `POST /api/lots/:lotId/surveys` | C5.2 | `SURVEY_CREATORS` |
| `GET /api/lots/:lotId/surveys` · `GET /api/projects/:projectId/surveys` | C5.2 | project read |
| `GET /api/surveys/:id` · `PATCH /api/surveys/:id` | C5.2 | read / `SURVEY_CREATORS` |
| `POST /api/surveys/:id/status` | C5.2 | `SURVEY_ACCEPTORS` when target is `accepted` or `rejected`; `SURVEY_CREATORS` otherwise — the exact split at `backend/src/routes/testResults/workflowRoutes.ts:336-343` |
| `POST /api/surveys/:id/report` (upload) | C5.2 | `SURVEY_CREATORS` |
| `POST /api/surveys/:id/supersede` | C5.2 | `SURVEY_CREATORS`, guard in the `requireSupersededByInProject` shape (`backend/src/routes/drawings.ts:36-63`) |

No public/unauthenticated route. No token surface. No webhook.

### 7.2 Frontend

- **Lot detail** — one "Survey & materials" section listing accepted/outstanding surveys and lot-linked deliveries. No new page, no new nav entry.
- **Delivery register** — a saved-view-shaped register at project level, matching the existing register idiom.
- **Survey record editor** — one modal, one status control. Captures on **one** surface, per the `[C3R-B3]` lesson (a control on a second, wrong surface stamps the wrong provenance).
- **Foreman shell: untouched.** Adding a docket photo to a delivery goes on the existing `AddDeliverySheet` (`frontend/src/components/foreman/sheets/AddDeliverySheet.tsx`) as an optional attach, reusing the shipped photo-capture path. **No shell layout change** — a shell touch needs Jay's explicit go (program §5 item 4) and C5 does not spend it.
- **Offline: unchanged surface, unchanged contract.** The delivery quick-add already queues (`frontend/src/lib/offline/diaryQuickAdd.ts:202`). The docket attachment rides the existing photo queue or is added later online; C5 adds **no new offline entity**.

### 7.3 Permission matrix

Role sets are **route-local const arrays**, not hierarchy checks — the convention stated and reasoned at `backend/src/routes/folio/access.ts:14-22` (*"`canApproveItems` resolves to the same four roles today and drifts the moment a role is inserted into `ROLE_HIERARCHY`"*), with precedent at `TEST_VERIFIERS` (`backend/src/routes/testResults/accessControl.ts:41`).

```
SURVEY_CREATORS  = ['owner','admin','project_manager','site_engineer','quality_manager']
SURVEY_ACCEPTORS = ['owner','admin','project_manager','quality_manager']
```

| Action | owner | admin | project_manager | quality_manager | site_manager | site_engineer | foreman | subcontractor* | viewer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Read deliveries (lot / register) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | assigned lots only | ✓ |
| Create / edit a delivery | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Attach a docket document | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Read surveys | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Create / edit a survey record | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Move to `received` | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| **Accept / reject a survey** | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Supersede a survey | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Edit an accepted survey (substantive) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

\* **Subcontractors get no survey visibility at all in v1.** A survey record names a certifier and carries a conformance verdict about work a subcontractor performed; exposing it through the portal is a decision with contractual weight and it has not been made. `requireSubcontractorPortalModuleAccess` (`backend/src/lib/projectAccess.ts:382`) is not extended with a `'surveys'` module. **DC5-3.** Delivery read is scoped to assigned lots by the shipped portal mechanism, unchanged.

**Foreman is not a survey actor** — consistent with the shipped rule that foreman is not a lot setup manager. Foreman *is* a delivery actor, because that is what a foreman already does today.

---

## 8. Security, tenancy and privacy

**Threat model gate.** Program §7 line 134 gates a threat model as an artifact before A3, C2, D2 and E — **not before C5**. C5 nonetheless opens a file-upload surface, which §7 line 135 makes a standing requirement regardless of wave. The disposition: **C5.1/C5.2 add no new upload mechanism** — they attach `Document` rows produced by the shipped document-upload path, which already runs magic-byte validation. **`[C5S-B8]` is what makes a separate threat-model artifact unnecessary for C5.1–C5.3.** **C5.5, if unblocked, ships a new parser over externally-authored survey files and DOES require its own threat model first** — that is the artifact gate, and RG-9 is its first item.

| Threat | Disposition |
| --- | --- |
| **Malicious upload.** No malware scanning exists anywhere (`clamav\|virus\|malware\|antivirus` across `backend/src` → one comment at `backend/src/routes/copilot/import/importSourceStorage.ts:41`, no scanner). | C5 adds **no new accepted type** `[C5S-B8]`. Every C5 file is PDF/JPEG/PNG through `assertUploadedFileMatchesDeclaredType` (`backend/src/lib/imageValidation.ts:232-260`), which rejects a MIME/extension disagreement (`:248-250`) and verifies the first 4096 bytes. The residual — an unscanned but well-formed PDF — is the **same** residual every shipped upload surface carries; C5 does not widen it and does not claim to have closed it. Program §7's malware-scanning requirement remains **open program-wide**, and C5 is not the wave that closes it. Recorded in §16. |
| **Tenant isolation on new query surfaces.** Five new read routes. | Every one delegates to `requireInternalProjectAccess` (`backend/src/lib/projectAccess.ts:212`) — **no fifth copy of `requireProjectReadAccess`** (the argument-order transposition hazard reasoned at `backend/src/routes/folio/access.ts:26-40`). Every row loaded by its own id is re-checked against `(lot.id, lot.projectId)` via an `assertBelongsToLot`-shaped guard (`folio/access.ts:62-79`). Asserted by AT-176 in the lettered sub-case style of AT-92, seeding a whole second tenant (`backend/src/routes/folio/folioIssuance.db.test.ts:144-146`, `:380-413`). |
| **The register is a new bulk-read surface.** `GET /api/projects/:projectId/deliveries` returns supplier names and quantities across a project. | Internal roles only; subcontractors reach deliveries only through the shipped assigned-lot scoping. Paginated with a hard `take` cap — the `[C3R-B1]` lesson (an unbounded test query with only transitive scoping was C3's single security finding). |
| **Imported files are data, never instructions.** | C5.1–C5.3 run **no AI over any C5 file**. If C5.4/C5.5 ever do, the output-side whitelist normaliser is mandatory (`backend/src/routes/copilot/projectFactsExtraction.ts:91-95`) and the result rides `AiProposal`, never a bespoke inline loop `[C5S-d]`. |
| **False attribution.** A survey record names a real, identifiable professional and states a verdict attributed to them. A wrong or fabricated entry is a defamation-shaped risk, not just a data-quality one. | Every attributed field is transcribed by a named CIVOS user, and every write is audited with old and new values through the shipped `createAuditLog` path (the `[C3R-A7]` shape: extend the existing audit call, do not add a site). The folio renders *"as recorded by <CIVOS user> on <date>"* alongside the surveyor's name, so the reader can tell a transcription from a signature. **This is the single most important privacy/liability property of the wave** and it is an exit-gate item. |
| **Personal data.** `surveyorName`, `surveyorCompany`, `surveyorRegistration` are personal/professional identifiers of a third party. | Covered by the existing project data-retention and export paths; no new subprocessor, no new egress. Not rendered on any public/token surface in v1 (§7.1: C5 has none). |
| **Audit-log tamper resistance.** | Unchanged. C5 writes through the shipped `AuditLog` path; it adds no new audit mechanism. |
| **XXE / hostile XML.** | Not reachable in C5.1–C5.3 (no XML). **RG-9 is a named prerequisite of C5.5.** |

---

## 9. Scale and performance

Measured against the program §8 reference dataset (5,000 lots, 10,000 map features, 50 GB evidence, 10k-row registers), server-side p95 plus a mid-tier Android over 4G where a field surface is involved.

| Target | Value | Dataset | Why this number |
| --- | --- | --- | --- |
| Delivery register p95 | **< 2,000 ms** at 10k rows without pagination collapse | 10k `diary_deliveries` on one project | Program §8 line 141, unmodified. The two new indexes in §5.1 are what make it reachable; `lot_id` is unindexed today. |
| Lot-scoped delivery + survey read p95 | **< 400 ms** | reference project, a lot with 20 deliveries and 3 surveys | It renders inside the lot page, which already has a budget; C5 must not be what a user notices. |
| **Folio evidence-row ceiling headroom** | **C5's two collections add < 50 rows at p99 per lot**, and **`FOLIO_EVIDENCE_ROW_CEILING_DEFAULT` is not raised** | reference dataset, worst lot | This is the sharp one. `countEvidenceRows` (`backend/src/lib/handover/folioPayload.ts:148`) drives a **refusal**, not a truncation (`backend/src/routes/folio/assemble.ts:44-51`). Two new collections can push a large lot from "folio issues" to "folio refuses". The number must be **measured on the worst lot in the reference dataset and recorded in the PR body**, and if it is exceeded the answer is to scope the projection, **never** to raise the ceiling. AT-179. |
| Folio assemble p95 delta | **< 15%** over the pre-C5 baseline | reference dataset | Two more queries at `CEILING + 1` each. |
| Hold-point evidence package p95 delta | **< 10%** | reference dataset | One more collection across three consumers. |

No new background job, no new worker, no new async path. C5 adds no load-test job to CI beyond re-running the existing folio benchmark harness (`backend/scripts/bench-pdf-folio.mjs` shape) with the C5 collections present.

---

## 10. Phases and PR slicing

### C5.1 — Delivery evidence: the docket, the batch reference, and a way to read them (S/M) — *ships first*

- **Depends on:** nothing. All three of its data prerequisites are shipped.
- **Why first:** the data already exists and foremen already produce it; it is the only phase with zero research exposure; and it discharges program line 79's *"batch/delivery traceability"* clause on its own.
- **Contains:** migration §5.1; the two columns; the three read routes; the `AddDeliverySheet` optional attach; the register view; the `delivery_not_lot_linked` support code.
- **Exit:** AT-170, AT-171, AT-176, AT-177.

### C5.2 — The survey record (M)

- **Depends on:** C5.1 only for the shared access-helper module; otherwise independent.
- **Contains:** migration §5.2; the model; the transition map; the gates; supersession; the editor; the `survey_not_accepted` warning code; the new `'survey'` readiness area.
- **Ships behind the flag, off, for every tenant** `[C5S-B4]`.
- **Exit:** AT-172 … AT-176, AT-178, AT-181.

### C5.3 — Consumer wiring: folio and release package (M)

- **Depends on:** C5.1 **and** C5.2 both merged. This is the only hard dependency edge in the wave.
- **Contains:** `FolioEvidencePayload` + `FolioSourceType` + `REVISION_TOKEN_KINDS` + `FOLIO_PAYLOAD_SCHEMA_VERSION` **1 → 2** + `assemble.ts` queries + `countEvidenceRows`; `evidencePackage.ts` survey input and count; the renderer sections; the attribution line.
- **Note:** bumping the folio schema version is not cosmetic. Existing `FolioSnapshot` rows carry `payloadSchemaVersion: 1` and `expiresAt`; a v1 snapshot must continue to render or be refused cleanly — never silently read as v2. Asserted by AT-180.
- **Exit:** AT-179, AT-180, AT-182.

### C5.4 — Material/product approvals, structured supplier certificates, quarantine (L) — **BLOCKED**

- **Blocked on:** RG-5, RG-6, RG-8 (§3). Not startable. A PR opening a `material_approvals` table before those three are discharged should be closed on sight.

### C5.5 — Survey file import and design-vs-as-built (XL) — **BLOCKED**

- **Blocked on:** RG-1, RG-2, RG-3, **and the datum gap** `[C5S-B6]` (§3.2), **and** its own threat model (RG-9 first).
- If it ever runs, it rides the Wave B `ImportBatch` → one `AiProposal` → human decision → apply → rollback envelope (`backend/src/routes/copilot/import/routes.ts:212`, `:539`, `:618`; `proposalService.ts:139`, `:202`), and its imported provenance value is a **new** `sampleLocationSource`-style enum member added by migration, never an overload of `'gps'` or `'map_pick'` (`backend/prisma/schema.prisma:970-972`).

### Deliberately outside C5

Instrument provenance (RG-4). Outbound survey requests to external parties (Wave E's surface). Any fix to the C2 certificate-deletion path (C4's). Any change to `Docket` (`[C5S-B3]`). Any tenant-authored rule or waiver (F0's definition model, per C3 §1.3). Any Logan PSP5 profile item (§1.2).

---

## 11. Feature flag and rollout

House pattern is a backend env var parsed inline in the `READINESS_SNAPSHOTS_ENABLED` shape (`backend/src/lib/readiness/recordDecision.ts:237-238`), and the house rollout ritual is F0's four steps (`docs/plans/f0-execution-spec-2026-07-24.md:119-125`).

**`C5_SURVEY_RECORDS_ENABLED`** — gates C5.2's routes and its UI section only.

1. Migration applied to production via the workflow, flag absent (⇒ off).
2. Deploy C5.2 disabled; confirm no route is reachable and no readiness item is emitted.
3. Enable for one pilot project's tenant; **one real conformance survey round-trips end to end with a real contractor**; state names confirmed or corrected `[C5S-B4]`.
4. Enable permanently, or ship a reviewed migration correcting the `CHECK` vocabulary and repeat step 3.

**C5.1 ships unflagged.** Two nullable columns and three read routes on a record foremen already create is not a behaviour change worth a flag, and a flag that is never turned off is a lie in the config. `[C5S-f]`

**C5.3 ships unflagged but is inert until C5.2's flag is on** — with no survey records, its collection is empty and the folio payload gains one empty array. The delivery collection is live immediately, which is intentional: it is the half with no research exposure.

---

## 12. Rollback and recovery

| Phase | Rollback |
| --- | --- |
| C5.1 | Revert the code. The two columns are nullable and orphan harmlessly; a `docket_document_id` pointing at a live `Document` keeps that document reachable through the normal document surfaces. Dropping the columns is a clean reverse migration, but **is not required** to restore behaviour. |
| C5.2 | Set `C5_SURVEY_RECORDS_ENABLED` off — that is the whole rollback, no deploy needed. `survey_records` rows persist and are readable by direct query; nothing else reads the table. Dropping the table is a clean reverse migration and loses only C5-created rows. |
| C5.3 | Revert the code **and** restore `FOLIO_PAYLOAD_SCHEMA_VERSION` to `1`. **The one asymmetry in the wave:** `FolioSnapshot` rows written at v2 become unreadable by a reverted v1 renderer. They must be **refused with a clear error, never coerced** — the same discipline `expiresAt` already enforces. Issued `FolioIssue` PDFs are unaffected: they are append-only files, already rendered (`backend/prisma/migrations/20260801000000_d1b_issued_folio/migration.sql:133-147`). |

**Data-loss risk: none.** No migration rewrites or deletes an existing row; no C5 code path deletes a `Document` `[C5S-B7]`. The only recovery action that touches production data is dropping a C5 table, which loses only C5-created records.

---

## 13. Acceptance tests

Continuing the shared series, starting at **AT-170** (see the numbering note in the header). Every item is a real assertion in a real test file, except where marked.

| AT | Phase | Assertion | Where |
| --- | --- | --- | --- |
| **AT-170** | C5.1 | **A delivery carries its docket and its batch reference, and the document survives.** A `DiaryDelivery` with `docketDocumentId` set refuses deletion of that `Document` with a FK `Restrict` error; `batchRef` round-trips unmodified including whitespace and non-ASCII. | `backend/src/routes/diary/deliveryEvidence.db.test.ts` |
| **AT-171** | C5.1 | **The register is bounded.** `GET /api/projects/:id/deliveries` applies a hard `take` cap and paginates; a project seeded past the cap returns the cap plus a next-page marker, never the full set. `[C3R-B1]` lesson. | `backend/src/routes/deliveries/register.db.test.ts` |
| **AT-172** | C5.2 | **CIVOS never accepts on its own.** `survey_records_accepted_actor_check` and `survey_records_accepted_requires_verdict_check` both reject at the DB, asserted by raw SQL that bypasses the route — a route-only guard would not prove this. And no route accepts a body field named `computedVerdict`, `tolerance*` or `deviation*`: a diff grep asserts zero such identifiers in C5 code. `[C5S-B1]` | `backend/src/routes/surveys/surveyRecord.db.test.ts` + diff grep in the PR body |
| **AT-173** | C5.2 | **The transition map is the only path.** Every pair outside `VALID_SURVEY_TRANSITIONS` is rejected with a 400; `accepted` is terminal; `rejected` is reachable only from `received`. Table-driven over the full cross product. | `backend/src/routes/surveys/statusWorkflow.test.ts` |
| **AT-174** | C5.2 | **An accepted survey resists substantive edits, field by field.** Each non-substantive key is asserted **individually** to leave `accepted` intact, and one substantive key is asserted to be refused. `[C3R-A8]` — the list is an exported const, not an inline literal. | `backend/src/routes/surveys/surveyRecord.db.test.ts` |
| **AT-175** | C5.2 | **Supersession cannot cross a project, cannot self-reference, and cannot target a superseded row.** Mirrors `requireSupersededByInProject` (`backend/src/routes/drawings.ts:36-63`); reads default to `supersededById: null`. | `backend/src/routes/surveys/supersede.db.test.ts` |
| **AT-176** | C5.1, C5.2 | **Cross-tenant is refused on every new route, lettered.** With a whole second tenant seeded: (a) another tenant's lot on the lot-scoped delivery route → 403; (b) another tenant's project on the register → 403; (c) another tenant's survey id presented by a user who legitimately holds *a* project → 403 (the `assertBelongsToLot` case); (d) a cross-tenant `docketDocumentId` in a PATCH body → rejected; (e) a subcontractor on any survey route → 403. | `backend/src/routes/surveys/surveyRecord.db.test.ts`, `backend/src/routes/deliveries/register.db.test.ts` |
| **AT-177** | C5.1 | **An unlinked delivery warns and never blocks.** The `delivery_not_lot_linked` item is emitted with `severity: 'support'`, `blocksAction: false`, and does **not** appear in `HANDOVER_BLOCKING_REASON_CODES`. `[C5S-B5]` | `backend/src/lib/evidenceReadiness/*.test.ts` + the reason-code contract test |
| **AT-178** | C5.2 | **A survey short of acceptance warns and never blocks.** Same shape at `severity: 'warning'`; a lot with an unaccepted survey still conforms and still claims. | same |
| **AT-179** | C5.3 | **The folio ceiling is respected, not raised.** `countEvidenceRows` includes both new collections; a lot seeded past `folioEvidenceRowCeiling()` **refuses with the measured number** and does not truncate; and `FOLIO_EVIDENCE_ROW_CEILING_DEFAULT` is unchanged at 5000. The p99 per-lot row delta is measured on the reference dataset and **recorded in the PR body**. | `backend/src/routes/folio/assemble.db.test.ts` + benchmark artefact |
| **AT-180** | C5.3 | **The schema-version bump is honest.** `FOLIO_PAYLOAD_SCHEMA_VERSION === 2`; a stored v1 snapshot is refused with a clear error and is **never** read as v2. | `backend/src/lib/handover/folioPayload.test.ts` |
| **AT-181** | C5.3 | **The folio attributes rather than asserts.** The rendered survey section prints the surveyor's name and the verdict **labelled as the surveyor's**, plus *"as recorded by \<user\> on \<date\>"*. A snapshot test asserts the label strings; a grep asserts the words *validated*, *verified*, *certified* and *checked* appear nowhere in C5 survey copy. `[C5S-B2]` | renderer snapshot test + diff grep |
| **AT-182** | C5.3 | **The release package gains surveys and nothing else.** All three `evidencePackage.ts` consumers return the survey collection and the new count; the public batch route returns it **only** for the hold points in its own batch; deliveries are absent. | `backend/src/routes/holdpoints/evidencePackage.test.ts` + `publicBatchRoutes.db.test.ts` |
| **AT-183** | all | **C5 did not touch the docket domain.** `git diff origin/master...HEAD` shows zero changes under `backend/src/routes/dockets/`, zero to `daily_dockets`/`docket_labour`/`docket_plant` in any migration, and the three `approvedDockets: 0` literals unchanged. `[C5S-B3]` | mechanical, in the PR body |

---

## 14. Exit gate

1. AT-170 … AT-183 pass in CI; the DB-backed ones against the local disposable Postgres, per `CLAUDE.md:180-189`. `src/test/databaseSafety.ts` is not weakened.
2. Both migrations applied to production via the `Production Migrations` workflow from `master` with the confirmation phrase; **no `db push`, no `--accept-data-loss`**.
3. `C5_SURVEY_RECORDS_ENABLED` completes all four rollout steps (§11), including step 3's **real** round-trip. `[C5S-B4]`
4. **A real project round-trips, owner Jay:** a delivery captured in the field with its docket photographed and attached, linked to a lot; a conformance survey requested, received, accepted; both appearing in that lot's issued folio; the survey appearing in a hold-point release package an external reviewer opens.
5. The folio p99 row delta and the register p95 are **measured on the reference dataset and recorded in the PR body** — a number, not an adjective. AT-179.
6. `[C5S-B2]` grep over the wave's diff (`git diff origin/master...HEAD`, **not** the tree — the `[C3R-A6]` lesson): no *validates* / *verifies* / *certifies* / *checks* in C5 survey copy.
7. `[C5S-B3]` grep over the wave's diff: no docket-domain change. AT-183.
8. `[C5S-B7]` grep over the wave's diff: no `document.delete` in C5 code.
9. `[C5S-B8]` grep over the wave's diff: no new entry in `imageValidation.ts`'s signature tables, no new multer `fileFilter` allow-set.
10. The nine research gaps are **recorded in `docs/research/`** as an open register, not left in this document only — so the next agent finds them by grep.
11. Docs and the Clancy knowledge mirror updated in the feature PR (standing boundary, program line 5).
12. **`npm run fallow:audit` verdict recorded in every PR body.**
13. §16's honest unknowns re-read at the end of the wave; any that closed are moved to the closed table with the evidence, not deleted.

**Not in this gate:** malware scanning (open program-wide, §8); the C2 certificate-deletion fix (C4's); C5.4 and C5.5 in any form; the GDA94↔GDA2020 datum work; any pilot outcome beyond item 3's single round-trip.

---

## 15. Decisions

### 15.1 Decisions for Jay

**DC5-1 — Does the survey record ship at all before a surveyor conversation, or does the whole of C5.2 wait?**
→ *Recommendation:* **ship it behind the flag now, keep the flag off until the round-trip.** The record's *structure* is safe without validation (§1.3); only its state names are not, and those are `CHECK`-constrained so correcting them is a reviewed migration rather than a data drift. Waiting costs the folio and release-package integration too, and those are the parts with real pull.
*One-line why:* the risk is five string values, and it is already contained by a constraint and a flag.

**DC5-2 — Is C5.4 (material approvals, structured certificates, quarantine) worth the research passes, or does it come off the roadmap?**
→ *Recommendation:* **park it, do not schedule the research yet.** Three grade-A/C primary-source passes to build a submittal register — a feature no pilot has asked for, competing against C4, D and E, which have named receivers. Revisit when a design partner asks for it by name.
*One-line why:* three research passes is the most expensive thing in this document and nothing downstream is waiting on it.

**DC5-3 — Do subcontractors see survey records in the portal?**
→ *Recommendation:* **no, not in v1** (§7.3). A survey record names a certifier and carries a conformance verdict about a subcontractor's own work; exposing it has contractual weight and no pilot has asked.
*One-line why:* it is a one-line change to add later and an unretractable disclosure to add now.

**DC5-4 — Should the docket/claim separation become a written rule?**
→ *Recommendation:* **yes, one paragraph in `CLAUDE.md` or `tasks/lessons.md`, separately from C5.** The rule is currently de-facto only (§0.4) and it survived this wave by one agent reading the schema carefully. The next agent handed *"concrete/asphalt dockets → installed lot"* may not.
*One-line why:* an unwritten invariant is one confident PR away from gone.

### 15.2 The spec's own decisions

- **`[C5S-a]`** — CIVOS computes no tolerance verdict in v1. *(§0.3, §4.2.)* *Flip condition:* RG-2 **and** RG-3 discharged at grade A/C respectively **and** a pilot contractor confirms they would act on a CIVOS-computed verdict. All three; any two is not enough.
- **`[C5S-b]`** — Two tables, no shared traceability abstraction. *(§4.1.)* *Flip condition:* a third subject appears with the same lifecycle **and** the same permission shape.
- **`[C5S-c]`** — No `instrumentNote` free-text column. *(§0.2.)* *Flip condition:* RG-4 shows a real deliverable that carries instrument data reaching contractors, at which point it is fields, not a note.
- **`[C5S-d]`** — Any future C5 AI extraction rides `AiProposal`, never the bespoke certificate loop. *(§1.2.)* *Flip condition:* none foreseeable; the certificate loop's own gaps are C4 findings (§18).
- **`[C5S-e]`** — Deliveries are in the folio but **not** in the hold-point release package. *(§4.6.)* *Flip condition:* a real superintendent asks for delivery evidence at a hold point.
- **`[C5S-f]`** — C5.1 ships unflagged; only C5.2 is flagged. *(§11.)* *Flip condition:* none foreseeable.
- **`[C5S-g]`** — C5 takes AT-170 onward and leaves AT-157 … AT-169 free. *(Header.)* *Flip condition:* none — a series gap is harmless, a collision is not.
- **`[C5S-h]`** — `DiaryDelivery.lotId` stays nullable. *(§4.4.)* *Flip condition:* the pilot shows unlinked deliveries are ignored rather than linked later; the fix is then a prompt, not a `NOT NULL`.

---

## 16. Honest unknowns

Listed rather than asserted. Each names how it gets resolved.

1. **Whether a contractor's quality manager will use a survey register at all, or keep living in email.** The pain is inferred from the program's dev-review gap 4, not from a user saying it. → *Resolved by step 3 of the rollout (§11).* ***Jay, with a design partner.***
2. **Whether "survey acceptance" duplicates hold-point release.** If the superintendent's hold-point release *is* the acceptance, C5.2's `accepted` state is ceremony. → *RG-7. One contractor, one surveyor.* If it duplicates, the fix is to delete a state, which the `CHECK` makes a clean migration.
3. **Whether deliveries get linked to lots in practice.** `lotId` is nullable and always has been; nobody has measured how often it is filled today because nothing reads it. → *Measure it on the pilot tenant in week one of C5.1 — a query, not a research pass.* This is the cheapest unknown in the document and it should be answered before C5.1 merges if possible.
4. **The real per-lot folio row delta.** Estimated as small (a lot has single-digit surveys and low-tens deliveries), but estimated. → *AT-179 measures it. If the estimate is wrong the projection gets scoped, not the ceiling raised.*
5. **Whether `Document.version`/`parentDocumentId`/`isLatestVersion` behave as intended.** They have been in the schema since Feature #481 and **have no consumer** (`backend/prisma/schema.prisma:1701-1703`, `:1712-1713`). C5 is the first. Unused schema is untested schema. → *AT-170 and the C5.1 tests are the first exercise of them; expect to find at least one thing.*
6. **Whether malware scanning matters more than this wave thinks.** C5 reasons its way out of a threat-model artifact by adding no new file type `[C5S-B8]`. That is correct as far as it goes, and it does not make the program-wide gap smaller. → *Program §7's requirement stays open and unowned. Someone should own it; it is not C5.*
7. **Whether the program line's *"Feeds D2 asset records"* leaves anything C5 owes.** D0 killed the receiver. This spec concludes it owes nothing beyond the folio. → *If D2 is ever revived in another form, re-read this section rather than assuming C5 covered it.*
8. **Whether five survey states is right, or three, or seven.** → `[C5S-B4]`, RG-7, step 3 of the rollout.

---

## 17. Delivery-control checklist (program §9 — all thirteen items)

| # | Item | Where |
| --- | --- | --- |
| 1 | Exact included and excluded behaviour | §0.2, §1.1, §1.2 |
| 2 | Schema and data flow | §4, §5 |
| 3 | Permission matrix | §7.3 |
| 4 | Edge cases | §5.2 constraints, §12, §13 (AT-172 … AT-176, AT-180) |
| 5 | Migration plan | §5 — two additive reviewed Prisma migrations, prod apply via the production-migrations workflow, no `db push` |
| 6 | Security threats (§7) | §8 |
| 7 | Performance tests (§8, reference dataset) | §9, AT-179 |
| 8 | Feature flag + rollout | §11 |
| 9 | Rollback / recovery | §12 |
| 10 | Acceptance tests | §13 |
| 11 | Pilot acceptance owner | **Jay**, with a design-partner contractor and surveyor — §1.3, §11 step 3, §14 item 4 |
| 12 | Production monitoring | Sentry on the new routes (shipped path, no new config); the register's p95 in the existing perf series; **the count of surveys stuck in `received` for > 14 days** as the one C5-specific signal worth watching, because it is the failure mode the feature exists to expose |
| 13 | Exit-gate evidence | §14 |

---

## 18. Verification notes — derived at `f944c39a`

### 18.1 Claims this spec corrects or records

| Claim | What was believed | **Correct at `f944c39a`** |
| --- | --- | --- |
| *"dockets and claims never cross"* is a standing repo rule | Stated as an existing rule in this wave's brief | **NOT FOUND** in `docs/`, `CLAUDE.md`, `AGENTS.md`, `tasks/lessons.md`, `backend/src`, `frontend/src` under any phrasing. It is de-facto (three hard-coded `approvedDockets: 0` producers feeding a `blocksAction: false` support item) and the one contrary doc statement runs the other way (`docs/product/pilot-journeys.md:354-355`). **DC5-4.** |
| Program line 79's *"dockets"* means CIVOS's `Docket` | The natural reading | **It means the supplier's delivery docket.** `DailyDocket` is a labour/plant timesheet with no supplier, material, quantity, batch or attachment (`backend/prisma/schema.prisma:1461-1497`). The record described is `DiaryDelivery` (`:1253-1273`). §0.4. |
| C5 feeds D2 asset records | Program line 79 | **The receiver was deleted.** `docs/research/d0-adac-handover-research-2026-07-28.md` kills the D2 XML limb on two independent grounds. The program line should be amended. |
| Imported certified geometry must be immutable and versioned | Program line 86 | **True, and C5 v1 satisfies it by holding none.** No spatial table in the tree is versioned or immutable today; all three have live `PATCH`/`DELETE`. Building certified-geometry storage into that would have required inventing an immutability layer *and* closing the datum gap. §3.2. |
| The CRS layer is fit for certified survey data | — | **No, and it says so itself.** `backend/src/lib/spatial/crs.ts:12-20` — GDA94 and GDA2020 both `towgs84=0,0,0`, ~1.8 m unimplemented, named as the upgrade path. `[C5S-B6]`. |

### 18.2 Observations for whoever builds this — none blocking

1. **`diary_deliveries.lot_id` has a foreign key and no index.** Every C5 read is lot-scoped. §5.1 adds it; do not drop it from the migration to make the diff smaller.
2. **`Document.version` / `parentDocumentId` / `isLatestVersion` have zero consumers.** C5 is the first. Budget time for finding out that unused schema does not work the way the column names suggest.
3. **The certificate-replacement path deletes the prior `Document`** (`backend/src/routes/testResults/certificateAttachment.ts:210`, storage object at `:225`). It is a real evidence-integrity defect, it is **C4's**, and it is recorded here so it is not discovered a third time. Do not fix it in a C5 PR.
4. **`hasSubstantiveEdit` iterates every key of the update object** (`backend/src/routes/testResults/crudRoutes.ts:394-403`). If C5.2 copies the pattern — and it should — the exemption list must be a shared exported const or the next field added silently un-accepts records. This cost C3 a review round (`[C3R-A8]`).
5. **`sample_location_source` is a hard `CHECK`, not a lookup table** (`backend/prisma/migrations/20260729000000_test_sample_point/migration.sql:29-31`). If C5.5 ever lands an imported survey position, admitting its provenance value is a migration — and the schema comment at `backend/prisma/schema.prisma:970-972` already forbids overloading `'gps'`.
6. **There are twelve independent multer configurations and no shared upload router.** `[C5S-B8]` exists partly so C5 does not become the thirteenth.

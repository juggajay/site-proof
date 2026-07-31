# Wave C5 Execution Specification — the survey and the delivery are evidence CIVOS files, not evidence CIVOS computes

**Date:** 31 July 2026 · **Rev 2:** 31 Jul at `1e6ed156`, folding adversarial review R1 (7/10, Rev 2 required). **Rev 1:** 31 Jul at `f944c39a`, merged as #1713.

**Status:** implementation-ready for **C5.1, C5.2 and C5.3**. **C5.4 and C5.5 are specified and BLOCKED** — each on a named research gap and, for the workflow-shaped parts, on pilot validation the program itself already requires (`CIVOS-Validated-Buildout-Plan-2026-07-24.md:84`). Nothing in C5.1–C5.3 is gated on a Jay decision; the five decisions in §15.1 shape C5.4/C5.5 and the rollout, not the build.

**All `file:line` citations in this document were re-opened for Rev 2 at HEAD `1e6ed1567429b598008beea12fbba026ef6adbf8`** (= `origin/master`, `docs(plans): Wave G execution spec (#1714)`). Rev 1's citations were derived at `f944c39a`; the review was written at `ee4d59c6`. **Every line number in Rev 2 was re-verified at `1e6ed156`, including the review's own** — §19 records which of the review's citations were off and which of its claims are refuted. Nothing is carried forward from another document without being re-derived here.

**Program contract:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` §3 Wave C, **line 79** (*"C5. Survey & material traceability (NEW — dev-review gap 4): survey request → completion → review → acceptance workflow; design-vs-as-built values with tolerance results; survey file + instrument provenance; survey revision/supersession; material/product approvals; supplier certificates; batch/delivery traceability (concrete/asphalt dockets → installed lot); rejected/quarantined material state. Feeds C4 integrity, E2 release packages, and D2 asset records."*), plus **§4 line 110** (the non-build: *"survey modelling/authoring (12d's ground — we import and link)"*), **§3 line 86** (*"Imported certified survey geometry is immutable and versioned — CIVOS may enrich evidence links against it but never modifies the certified geometry itself"*), **§3 line 90** (*"Preserve the surveyor/RPEQ certification boundary — CIVOS assembles and links; certifiers certify"*), **§6 lines 121–131** (definition of done), **§7 line 134–135** (threat-model gate and standing security requirements), **§8 lines 138–146** (performance targets and the reference dataset), **§9 line 149** (this document's existence).

**Parent specs, read not remembered:**
- `docs/plans/wave-c2-test-lifecycle-spec-2026-07-28.md` — the lifecycle shape C5.2 copies, and the decision that settled the sample-entity question (`TestResult` **is** the sample record). C5 does not re-open it.
- `docs/plans/wave-c3-spatial-tests-lims-spec-2026-07-28.md` — **line 87**, the honesty rule this wave generalises; **line 970-972 of `backend/prisma/schema.prisma`**, the `sampleLocationSource` comment that pre-authorises a future imported provenance value and forbids overloading an existing one.
- `docs/plans/wave-b-migration-importer-spec-2026-07-26.md` — the import-with-provenance envelope C5.5 must ride if it is ever unblocked. `ImportBatch.kind` reserves `'test_register'` (`backend/prisma/schema.prisma:2147-2148`); C5 does **not** claim that slot.
- `docs/plans/wave-d-handover-spec-2026-07-28.md` — the folio payload contract C5.3 extends, and the acceptance-test high-water mark (**line 30**).
- `docs/plans/wave-e-approvals-spec-2026-07-28.md` — the hold-point release surface C5.3 feeds.
- `docs/plans/wave-g-execution-spec-2026-07-31.md` — merged after Rev 1. It takes **no** number in the shared AT series; see the numbering note below.
- `docs/research/d0-adac-handover-research-2026-07-28.md` — **the D2 kill.** Its verdict deletes the XML-writer limb of D2 outright. Program line 79's *"and D2 asset records"* therefore has no receiver, and §1.2 disposes of it rather than pretending otherwise.

**House style** matches the C1, C2, C3, D, E, F and G specs: numbered sections, an explicit non-goal disposal of every clause of the program line, a current-state map read at a stated SHA, a decision register with flip conditions, per-phase rollback, named acceptance tests continuing the shared series, an exit gate, program §9's thirteen delivery-control items enumerated, and — from Rev 2 — a review-disposition section (§19).

**Tag namespace.** `[C5S-*]` (C5 **S**urvey/**S**upply) for this spec's own decisions; `[C5S-B*]` for the blockers no PR may violate; `[C5R-B*]` / `[C5R-A*]` / `[C5R-N*]` are **now taken** by review R1 and are used throughout Rev 2 to mark folded changes. `[C1C-*]`, `[C1R-*]`, `[C2L-*]`, `[C2R-*]`, `[C3S-*]`, `[C3R-*]`, `[D14R-*]`, `[DH-*]`, `[DR2-*]`, `[FR-*]` and `[WBR2-*]` are taken. **Never use a bare `C5` tag** — `C5` is a live clause-number fragment across `docs/research/sa-dit-*.md` and `docs/research/vic-itp/01-earthworks-pavements.md`.

**Acceptance-test numbering — updated at Rev 2.** Rev 1 reserved `AT-157 … AT-169` on the reasoning that Wave G was being authored concurrently and a monotonic series cannot be allocated by two authors at once. **Wave G shipped with its own `AT-G1 … AT-G34` namespace and took no number in the shared series** (`docs/plans/wave-g-execution-spec-2026-07-31.md:205-211`, `:279-286`, `:337-340`, `:387-392`, `:423-428`, `:467-469`) — the collision Rev 1 avoided never materialised. The reservation stands anyway: `AT-157 … AT-169` remain free for D1c.1's in-flight numbers, and a gap in the series is harmless where a collision is not. **C5 occupies AT-170 … AT-188.** Re-measured at `1e6ed156`: the highest number allocated anywhere under `docs/` is **AT-188**, all of it C5's. **The next free number is AT-189.** `[C5S-g]`

**Ponytail note.** This wave's program line names eight things. Read against the tree, three of them can be built with **one nullable FK, one nullable text column, one new table, one narrow mutation route and three read routes**; three of them are blocked on primary sources nobody in this program has read; and one of them — *"and D2 asset records"* — has no receiver left. The largest contribution Rev 1 made was not the build: it was the finding in §0.4 that the word *"dockets"* in program line 79 does not refer to CIVOS's `Docket` model. **The largest contribution Rev 2 makes is §4.4a** — the discovery that the workflow C5.1 exists to serve (*attach the docket that arrives the morning after the pour*) is refused by the shipped diary write path from the moment the foreman hits submit, and the narrow evidence route that fixes it without unwinding a submitted daily record.

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
| *"survey revision/supersession"* | **IN — C5.2.** The `Drawing` pattern, verbatim: a new revision is a new row, the old row gets `supersededById`, and the underlying `Document` is `onDelete: Restrict` so the original file cannot be deleted out from under it (`backend/prisma/schema.prisma:1759`, `:1764`; guard `backend/src/routes/drawings.ts:36-65`). |
| *"material/product approvals"* | **OUT of v1 — C5.4, BLOCKED.** RG-5 (§3). Submittal/approval-register practice, and who the approving authority is, is not established at any grade in `docs/research/`. |
| *"supplier certificates"* | **PARTIALLY IN — C5.1.** A supplier's certificate or docket is filed as a `Document` attached to the delivery it belongs to (§4.4). **Structured extraction of certificate fields is OUT** — RG-6 (§3): the field lists are governed by material standards nobody here has read, and inventing them is the failure class `[C5S-B1]` names. |
| *"batch/delivery traceability (concrete/asphalt dockets → installed lot)"* | **IN — C5.1**, and it is the phase that ships first because the data already exists (§0.4, §2.1). Rev 2 adds §4.4a, without which the clause is unbuildable — see `[C5R-B2]`. |
| *"rejected/quarantined material state"* | **OUT of v1 — C5.4, BLOCKED.** RG-8 (§3). Whether AU civil contractors run a distinct quarantine state or route it through an NCR is unestablished, and CIVOS's NCR is lot-scoped, not material-scoped (`NCRLot`, `backend/prisma/schema.prisma:1098`). |
| *"Feeds C4 integrity"* | **IN — C5.2/C5.3** by construction: originals preserved, supersession chains, attributed provenance. C5 does **not** build C4; it stops leaving C4 a mess to clean up. |
| *"Feeds E2 release packages"* | **IN — C5.3.** `backend/src/routes/holdpoints/evidencePackage.ts` gains one collection and one summary count, read by all three of its consumers. |
| *"Feeds D2 asset records"* | **CLOSED — the receiver does not exist.** `docs/research/d0-adac-handover-research-2026-07-28.md` deletes the XML-writer limb of D2 on two independent kills. **The program line should be amended.** What survives is the folio (D1), and C5.3 feeds *that* instead. |

### 0.3 The honesty rule this whole wave turns on `[C5S-B1]`

**A conformance verdict is a certification. CIVOS records who made one; it never makes one.**

C3 stated this for coordinates: *"A location on a test record is evidence. CIVOS never writes one it did not receive from a human or an instrument"* (`docs/plans/wave-c3-spatial-tests-lims-spec-2026-07-28.md:85`). C5 is the same rule one level up, and it is the rule the program itself draws at line 90 (*"CIVOS assembles and links; certifiers certify"*).

Concretely, and asserted by AT-172 and AT-181:

- No CIVOS-computed design-vs-as-built tolerance verdict. Not in v1, not behind a flag, not as an "indicative" number.
- **No survey record may reach `accepted` without a named human actor and a timestamp — enforced by a `CHECK`, not by prose (§5.2).** `[C5R-B1]`: Rev 1 shipped two constraints for this and **neither of them enforced it** — a row with `status='accepted'`, `accepted_by=NULL`, `accepted_at=NULL`, `surveyor_verdict='conforms'` satisfied both. Rev 2 adds the constraint that actually does the work, `survey_records_accepted_requires_actor_check`, and AT-172 now names it explicitly. The review is right that the more likely failure was not a red test but a green one written against the constraints that existed.
- The `surveyorVerdict` column stores **what the report says**, is labelled in every surface as *the surveyor's verdict*, and carries `'not_stated'` as a first-class value so "the report did not say" is recordable as a fact rather than backfilled as a guess.
- No AI extraction writes a verdict, a tolerance or an acceptance without a human decision passing through `AiProposal` — and C5.1–C5.3 ship **no AI extraction at all** (§1.2).
- No user-facing string, marketing copy or Clancy knowledge entry may say CIVOS *checks*, *validates*, *verifies* or *certifies* a survey. Permanent `[C5S-B2]`.

### 0.4 The finding that changes the wave's shape — *"dockets"* in line 79 is not CIVOS's `Docket`

Program line 79 says *"concrete/asphalt dockets → installed lot"*. The obvious build is on the model named `Docket`. **That build would be wrong, and it would be wrong in a way that is hard to undo.**

`DailyDocket` (`backend/prisma/schema.prisma:1461-1497`) is a **subcontractor labour-and-plant timesheet for a project-day**. Its **twenty** scalar columns (`:1462-1481`, re-counted at `1e6ed156` — see §19 `[C5R-A10]`) are hours, rates and approval amounts: `totalLabourSubmitted`, `totalLabourApprovedCost`, `totalPlantApprovedCost` (`:1476-1481`); its children are `DocketLabour` (`:1499`) and `DocketPlant` (`:1536`); its statuses are `draft | pending_approval | approved | rejected | queried` (`backend/src/routes/dockets/validation.ts:10-16`). **It has no supplier, no material, no quantity of anything but time, no batch number, no attachment relation of any kind, and no `lotId`** — lots attach one level down, on hour allocations (`DocketLabourLot:1522`, `DocketPlantLot:1557`), gated so a subcontractor may only allocate to lots assigned to their own company (`backend/src/routes/dockets/access.ts:220-261`).

The record program line 79 actually describes already exists under a different name. **`DiaryDelivery`** (`backend/prisma/schema.prisma:1253-1273`) carries `description`, `supplier`, `docketNumber`, `quantity`, `unit` and a nullable `lotId`. It is written from the foreman's field capture path, including offline (`frontend/src/lib/offline/diaryQuickAdd.ts:198`, `:209-210`; sync at `frontend/src/lib/offline/syncWorker.ts:494-511`), and it is idempotent under retry via `@@unique([diaryId, requestKey])`.

So C5.1 is **eight-tenths already shipped**, and the correct build is two nullable columns on a table foremen already fill in — not a new subsystem, and emphatically not a change to the payment flow. **Rev 2 adds the missing tenth**: the shipped write path refuses to touch those columns the moment the diary is submitted (§4.4a).

**`[C5S-B3]` — C5 touches no file under `backend/src/routes/dockets/` and adds no column to `daily_dockets`, `docket_labour` or `docket_plant`.** Enforced as a diff grep in the exit gate (§14 item 7).

**A boundary the repo does not currently write down, and C5 must not be the wave that erodes it.** The lead brief for this spec described a standing rule that dockets and claims never cross. **That rule is not written anywhere in this repository** — grepped across `docs/`, `CLAUDE.md`, `AGENTS.md`, `tasks/lessons.md`, `backend/src` and `frontend/src` for every phrasing of it: **NOT FOUND**, and independently re-grepped by review R1 with the same result. What exists is a de-facto separation plus one inert wire: the readiness engine declares `approvedDockets: number` in `evidenceCounts` (`backend/src/lib/evidenceReadiness/core.ts:184`) and emits it as a `severity: 'support'`, `blocksAction: false` item (`backend/src/lib/evidenceReadiness.ts:243-250`), and **every producer feeds it a hard-coded `0`** (`backend/src/routes/claims/readRoutes.ts:288`, `backend/src/routes/lots/qualityRoutes.ts:355`, `backend/src/routes/projectCloseoutReadiness.ts:118`). The one contrary statement in docs runs the *other* way (`docs/product/pilot-journeys.md:354-355`: *"dockets are part of commercial proof"*).

C5's obligation is narrow and absolute: **it does not change any of those three zeros, and it does not add a docket-sourced input to any claim or conformance path.** `[C5S-B3]`. Whether that de-facto separation should become a written rule is **DC5-4** (§15.1) — a product call, not this wave's to make unilaterally.

---

## 1. Outcome, scope and non-goals

### 1.1 Outcome

1. **A lot's material history is answerable from the lot.** Every delivery recorded against the lot, with supplier, docket number, batch reference, quantity, and the supplier's docket filed as a retrievable document — **and attachable after the fact**, which is when the docket actually arrives (§4.4a).
2. **A lot's survey history is answerable from the lot.** Every survey record with its kind, its status, who surveyed it, when, the report file, the surveyor's stated verdict, who accepted it, and what it superseded.
3. **Both appear where an external party already looks** — the lot conformance folio (D1) and the hold-point release package (E2) — without a human assembling them.
4. **Nothing is automatically decided.** C5 adds **no blocking readiness code**, moves **no** lot to conformed, and gates **no** claim. Its readiness contributions are `warning` and `support` only `[C5S-B5]`.
5. **The three blocked limbs are blocked out loud**, with the specific primary source each needs, so the next agent does not silently approximate one (§3).

### 1.2 Non-goals (explicit — do not build in C5)

- **No survey modelling or authoring.** Program §4 line 110. CIVOS does not create, edit, adjust or reduce survey data.
- **No certified survey geometry in the database, in any form, in v1.** Not a point, not a surface, not a string. This is the strongest available compliance with program line 86 (*"never modifies the certified geometry itself"*): CIVOS cannot modify what it does not hold. C5.5 is where that would change, and C5.5 is blocked (§3.2).
- **No CIVOS-computed tolerance verdict.** `[C5S-B1]`. Permanent for v1; its flip condition is RG-2 **and** RG-3 **and** a pilot, all three, and it is stated at `[C5S-a]`.
- **No new geometry file format.** No LandXML surface reader, no `.12da`, no shapefile, no KML, no coordinate CSV importer. The tree parses LandXML and DXF **alignments only** (`backend/src/lib/spatial/alignmentFileImport.ts:16`, `:25`), and adding a format means adding a magic-byte signature kind to `backend/src/lib/imageValidation.ts` — a security-surface change C5 does not need.
- **No datum transformation work.** `backend/src/lib/spatial/crs.ts:5-21` records, in a `ponytail:` comment, that GDA94 and GDA2020 are **both** treated as WGS84-aligned (`towgs84=0,0,0`) and that the ~1.8 m GDA94→GDA2020 shift is unimplemented (`:13-16`, upgrade path at `:18-20`). C5 neither uses nor fixes this. It is named here because it is the *hard* blocker on C5.5 (§3.2) and the next agent must not discover it after starting. `[C5R-A8]` narrows what `[C5S-B6]` actually forbids — see §6.
- **No outbound survey request to an external party.** No email, no token, no public page. Wave E owns external-party surfaces and has a merged threat model for them (`docs/plans/wave-e0-threat-model-2026-07-28.md`); C5 does not open a second one. A survey "request" in v1 is an internal record state.
- **No AI extraction in C5.1–C5.3.** No survey-report reader, no supplier-certificate reader. If one is ever built it rides `AiProposal` (`backend/prisma/schema.prisma:2110-2136`) with a server-side whitelist normaliser, per the shipped doctrine at `backend/src/routes/copilot/projectFactsExtraction.ts:91-95` — **not** the bespoke inline loop the test-certificate path uses (`backend/src/routes/testResults/certificateIntake.ts:261-271`), which stores no proposal row, no citations and no rollback target. `[C5S-d]`.
- **No change to the test-certificate lifecycle.** C2 is shipped and C4 owns its integrity gaps — including the real one at `backend/src/routes/testResults/certificateAttachment.ts:210`, where replacing a certificate **deletes** the prior `Document` row rather than versioning it. C5 records the finding (§18) and **does not reuse that pattern**; fixing it is C4's.
- **No `Supplier` entity, no supplier registry, no supplier approval.** `supplier` stays the free-text column it is (`backend/prisma/schema.prisma:1257`). A registry is C5.4's, and C5.4 is blocked.
- **No second readiness engine, no cached verdict column, no recalculation job.** Inherited from `[C2L-B3]` via `[C3S-B2]`.
- **No blocking readiness reason code.** `[C5S-B5]`. C5 adds members to `READINESS_REASON_CODES` (`backend/src/lib/readiness/contracts/reasonCodes.ts:29-85`) but **not** to `HANDOVER_BLOCKING_REASON_CODES` (`:114-137`).
- **No refactor of the shipped document-versioning route.** `[C5R-B4]`, §4.3. C5 blocks that route on its own documents; it does not extract, reshape or re-enter it.
- **No change to the diary's own content lock.** `[C5R-B2]`, §4.4a. `description`, `quantity`, `unit`, `notes` and `supplier` stay exactly as locked as they are today; C5 opens a path for three *evidence* fields and nothing else.
- **No new Logan PSP5 profile item.** PSP5 §5.6.5's mandatory pack list, as quoted in `docs/research/d0-adac-handover-research-2026-07-28.md`, names the inspection-and-testing certificate, test results, retest/rectification detail, CCTV, pre-backfill photographs, an asset list and O&M manuals. **It does not name a survey deliverable.** Adding a profile item for one would be inventing a council requirement. `backend/src/lib/handover/loganPsp5Profile.ts` is untouched.
- **No change to `ImportBatch.kind`.** `'test_register'` stays reserved and parked (`backend/prisma/schema.prisma:2147-2148`); C5 does not claim it and does not add a `'survey'` kind while C5.5 is blocked.

### 1.3 What is pilot-gated, and why the gate is real

Program line 84 already requires the D2 workflow to be validated *"with surveyors, contractors, and ≥3 receiving councils"* before it is defined. C5.2's workflow inherits the first two of those three. The split this spec draws:

**Structurally safe without pilot validation** — because it is a filing structure whose correctness does not depend on how anyone works: the record's existence, its lot link, its attached file, its supersession chain, its immutable original, its tenancy scoping, its appearance in the folio and the release package.

**NOT safe without pilot validation** — because it encodes a claim about how a real job runs: the **names and count of the workflow states**, whether *review* and *acceptance* are two steps or one, who performs each, and whether a survey is requested per-lot or per-area-per-visit.

**The resolution `[C5S-B4]`:** C5.2 ships the five states named in §4.5 **behind the feature flag** (§11), and the flag stays off for any tenant until **one real conformance survey has round-tripped with a real contractor and the state names have been confirmed or corrected**. The states are `CHECK`-constrained in the migration, so correcting them is a reviewed migration and not a silent data drift — which is exactly why they are constrained rather than free text. Pilot acceptance owner: **Jay**, with a design-partner surveyor (§17 item 11).

---

## 2. Current-state map (re-read at `1e6ed156`)

### 2.1 Material traceability — what exists

| Thing | Where |
| --- | --- |
| **The delivery record** | `DiaryDelivery` `backend/prisma/schema.prisma:1253-1273`. `description String` (required), `supplier String?` `:1257`, `docketNumber String?` `:1258`, `quantity Decimal?`, `unit String?`, `lotId String?` `:1261` (`onDelete: SetNull` `:1269`), `notes String?`, `requestKey String?` `:1264`, `@@unique([diaryId, requestKey])` `:1272`. **No attachment relation, no batch reference, no `project_id`, and no declared `@@index` of any kind** `[C5R-A9]`. |
| Write routes | `POST /api/diary/:diaryId/deliveries` `backend/src/routes/diary/diaryItems.ts:239` (handler wraps at `:254`); `PUT` `:281` (`:288`); `DELETE` `:319` (`:327`). Zod at `backend/src/routes/diary/diaryItemsValidation.ts:126-137`. |
| **The write gate — load-bearing for C5.1** `[C5R-B2]` | All three wrap in `withEditableDiary` (`backend/src/routes/diary/diaryItemMutation.ts:10-22`) → `requireEditableDiaryForWrite` (`backend/src/routes/diary/diaryAccess.ts:92-123`), which enforces `DIARY_WRITE_ROLES` (`:19-26`) via `requireDiaryWriteAccess` (`:63-74`), then **refuses `status === 'submitted'` (`:114-116`)** and **refuses `lockedAt` (`:118-120`)**. See §4.4a. |
| Read paths | diary fetch `backend/src/routes/diary/diaryCore.ts:184`, `:235`, `:308`, `:335`; report `diaryReporting.ts:481`, `:516`; submission `diarySubmission.ts:48`, `:173`, `:226`. |
| Field capture | `frontend/src/components/foreman/sheets/AddDeliverySheet.tsx:20`, `:31`, `:56`, `:84`, `:116`, `:164-169`; timeline `frontend/src/components/foreman/DiaryTimelineEntry.tsx:10`, `:134-136`. |
| Offline | `frontend/src/lib/offline/core.ts:141` (`delivery_save` queue type), `:224`; `diaryQuickAdd.ts:198`, `:209-210`, enqueue at `:225-231` with `action: 'create'` hard-coded; `syncWorker.ts:479` (`syncDelivery`), body at `:494-511`. |
| **Reachability** | **Only through a diary.** There is no delivery register, no project-level query, and no lot-level query. `Lot.diaryDeliveries DiaryDelivery[]` exists as a relation (`schema.prisma:640`) with **no route reading it**. Re-grepped at `1e6ed156`: outside `backend/src/routes/diary/` the only production consumer of delivery data is the frontend diary PDF (`frontend/src/lib/pdf/dailyDiaryPdf.ts:508-513`), which renders rows already fetched through the gated diary reads. |
| Material classification | `Lot.materialType String?` `backend/prisma/schema.prisma:605`, migration `backend/prisma/migrations/20260727120000_d14_lot_material_type/migration.sql:9`. Validated at the route against the resolved ruleset's `materialTypes` (`backend/src/lib/readiness/sufficiency/types.ts:312`; whitelist `sufficiency/lotAttributeValidation.ts:74-86`). **It is a test-frequency classification, not a traceability link** — nothing joins it to any delivered material. |
| Photo category | `'Material Delivery'` already exists at `backend/src/routes/documents/classificationRoutes.ts:47`, inside `PHOTO_CLASSIFICATION_CATEGORIES` (`:44-57`), alongside `'Survey'` (`:45`). Module-local, not exported. |
| **NOT FOUND** | `Supplier` model · `batchNumber` / `batch_number` / `batchPlant` · `mixDesign` · `productApproval` · `quarantine` · any material-scoped NCR · any material conformance certificate concept. All grepped across `backend/prisma`, `backend/src`, `frontend/src`. The only `batch` hits are `HoldPointReleaseBatch` (`:867`), `ImportBatch` (`:2145`) and `HoldPointReleaseToken.batchId` (`:832`) — none of them material. |

### 2.2 Survey — what exists

| Thing | Where |
| --- | --- |
| **NOT FOUND** | `model Survey`, `SurveyPoint`, `AsBuilt`, any as-constructed record. Grepped `backend/prisma/schema.prisma` in full. |
| Design alignment import | `ControlLine` `backend/prisma/schema.prisma:487-504` — `coordinateSystem String` (EPSG, `:490`), `points Json` (`[{chainage, easting, northing}]`, `:491`), `geometryWgs84 Json?` derived cache (`:492`). Parsers: `parseAlignmentFile` `backend/src/lib/spatial/alignmentFileImport.ts:25`, dispatch `detectFormat` `:16` (LandXML **or** DXF, by extension then `<`-sniff), 20 MB cap `MAX_ALIGNMENT_FILE_BYTES` `:14`; `parseLandXml` `backend/src/lib/spatial/landxmlParser.ts:147` (on `fast-xml-parser` `^5.10.1`, `backend/package.json:69`); `parseDxf` `backend/src/lib/spatial/dxfParser.ts:298` (hand-written, 315 lines). Route `POST /:projectId/control-lines/import` `backend/src/routes/controlLines/index.ts:221` — **preview only, no DB write**. |
| Set-out sheet AI read | `POST /:projectId/control-lines/extract-points` `backend/src/routes/controlLines/index.ts:192`; extractor `controlLines/setoutExtraction.ts:231`; output-side trust boundary `cleanSetoutCandidate` `:116` (*"this is the trust boundary that turns untrusted model output into a safe candidate"*, `:107-115`); `MAX_SETOUT_POINTS = 2000` `:17`. Rides `AiProposal` stage `control_line`. |
| Lot geometry | `LotGeometry` `backend/prisma/schema.prisma:506-527` — `geometryWgs84 Json` (`:515`), `kind` (`chainage_offset|drawn|point`, `:509`). **No CRS column** — WGS84 by convention. |
| Sample points (C3) | Four nullable columns on `TestResult` `backend/prisma/schema.prisma:967-976`, `sampleLocationSource` `CHECK`-constrained to `('gps','map_pick')` (`backend/prisma/migrations/20260729000000_test_sample_point/migration.sql:29-31`). The schema comment at `:970-972` pre-authorises a future imported provenance value: *"A future imported source adds a value here; it never overloads an existing one."* |
| **Versioning / immutability of spatial data** | **None.** `ControlLine`, `LotGeometry` and `PlanSheet` all carry `updatedAt` and all have live `PATCH`/`DELETE` (`controlLines/index.ts:333`, `:379`; `lots/geometryRoutes.ts:243`; `planSheets/index.ts:219`, `:277`). No version column, no supersede chain, no trigger. |
| **The datum gap** | `backend/src/lib/spatial/crs.ts:5-21` — a comment stating canonical storage is **local grid coordinates as entered** with WGS84 a derived cache (`:8-10`), that GDA2020 and GDA94 are both mapped `towgs84=0,0,0` and GDA94 is ~1.8 m off (`:13-16`), and a `ponytail:` line naming the 7-parameter upgrade path (`:18-20`). Presets `:34-42`; `localToWgs84` `:78`. |
| Photo category | `'Survey'` `backend/src/routes/documents/classificationRoutes.ts:45`. |
| Diary suggestion | `'Survey and setout'` `backend/src/routes/diary/diarySuggestions.ts:159`. |
| Handover note | `backend/src/lib/handover/loganPsp5Profile.ts:238-239`, `:827-828` — already records that as-constructed survey data is **not** produced by CIVOS. |

### 2.3 The lifecycle and integrity patterns C5 inherits

Five shipped patterns. C5 copies three, explicitly refuses one, and — new at Rev 2 — must *extend* one it originally overlooked.

**(a) Supersession — `Drawing`. COPY.** A revision is a new row; the old row gets `supersededById`; reads filter `supersededById: null` (`backend/src/routes/drawings/readRoutes.ts:110`). The guard `requireSupersededByInProject` (`backend/src/routes/drawings.ts:36-65`) enforces **four** things: not-self (`:43-45`), same project (`:47-54`), **same `drawingNumber` (`:56-60`)** and target-is-current (`:62-64`). The file is `onDelete: Restrict` (`backend/prisma/schema.prisma:1764`) so the original cannot be deleted. `[C5R-A3]`: the third check is the load-bearing one — it scopes the chain to one drawing *identity* — and Rev 1's AT-175 omitted its analogue. §4.5 and AT-175 now carry it.

**(b) Immutable proposal + human decision + rollback — `AiProposal`. COPY if C5 ever extracts.** `payload` is immutable (`schema.prisma:2118`), edits go to `editedPayload` (`:2122`), apply runs inside the deciding transaction (`backend/src/routes/copilot/proposalService.ts:166`), `appliedRecordIds` is the rollback target (`:17-20`), every transition writes an `AuditLog` (`:100-107`, `:180-187`, `:229-236`).

**(c) Conditional immutability — `TestResult`'s verified rows. COPY THE SHAPE, NOT THE SCOPE.** `[C5R-A1]` — **Rev 1 was wrong to call `NON_SUBSTANTIVE_EDIT_FIELDS` "a shared list".** It is a `const` declared **inside the PATCH handler** at `backend/src/routes/testResults/crudRoutes.ts:394-398`, and **nothing imports it** (re-grepped: the only other hits are prose at `testResults/validation.ts:184` and a comment at `testResults.test.ts:5412`). Its own header comment does correctly call itself a trust boundary (`:374-376`: *"This list is a TRUST BOUNDARY… anything added here is asserting 'this field is not evidence'"*), and `hasSubstantiveEdit` does iterate every key of `updateData` (`:399-401`), so a key omitted from the list un-verifies the row. **C5.2 must export its own module-level const** — it cannot reuse C2's, because C2's is not reachable. This is exactly what `[C3R-A8]` cost C3 a review round for.

**(d) Certificate replacement — `TestResult`. DO NOT COPY.** `backend/src/routes/testResults/certificateAttachment.ts:210` calls `tx.document.delete(...)` on the prior certificate, and `:225` best-effort deletes the storage object. Fixing that path is **C4's**, and §18 records the finding rather than silently fixing it in the wrong wave.

**(e) The document evidence-link guards and the versioning subsystem. EXTEND — this is `[C5R-B3]` and `[C5R-B4]`, and Rev 1 missed both.** Three shipped mechanisms exist for precisely the kind of `Document` link C5 adds twice:

1. **`EVIDENCE_LINK_GUARDS`** (`backend/src/routes/documents/evidenceLinkGuards.ts:25-69`) with the entry type at `:14-23`. The file header says it outright (`:11-13`): *"Each evidence-link table is described once here… **Adding the next evidence table is a single entry**, not another hand-written check in three routes."* Two entries exist today (`ncr`, `variation`). An entry is exactly four fields:
   ```ts
   type EvidenceLinkGuard = {
     evidenceType: string;
     findLink: (prisma: PrismaClient, documentId: string) => Promise<{ metadataLocked: boolean } | null>;
     deleteBlockedMessage: string;
     metadataLockedMessage: string;
   };
   ```
   It drives two guards: `assertDocumentDeletableOutsideEvidenceWorkflow` (`:102-116`, throws `AppError.conflict` with `code: 'WORKFLOW_EVIDENCE_DELETE_BLOCKED'` on **any** link, locked or not) and `assertEvidenceMetadataMutable` (`:120-133`, `code: 'WORKFLOW_EVIDENCE_LOCKED'`, only when `metadataLocked`). Both are called from `requireDocumentMutationAccess` (`backend/src/routes/documents/access.ts:603`) and `deleteRoutes.ts:122`, which reaches `POST /:documentId/classify`, `POST /:documentId/save-classification`, `PATCH /:documentId`, `DELETE /:documentId` and `POST /:documentId/version`.
2. **`assertDocumentCanUseGenericVersioning`** (`backend/src/routes/documents/versionRoutes.ts:56-82`) — refuses generic versioning for ITP-attachment and NCR-evidence documents with `code: 'WORKFLOW_EVIDENCE_VERSION_BLOCKED'`. **Note the asymmetry, which matters for the estimate:** this is a *hand-written* check that does **not** read `EVIDENCE_LINK_GUARDS`, so "a single entry" covers delete and metadata but **not** versioning. C5 therefore adds two table entries *and* two hand-written conditions. Unifying them is a real cleanup and it is **not C5's** (§18.2).
3. **`GENERIC_DELETE_BLOCKED_DOCUMENT_MESSAGES`** (`backend/src/routes/documents/deleteRoutes.ts:23-27`) — the `documentType`-keyed map that makes `Drawing`'s `Restrict` FK survivable with a real message. Without an entry of some kind, a `Restrict` FK violation reaches `errorHandler.ts:319-327` and is returned as a bare **422 `INVALID_REFERENCE` "Invalid reference"** with an optional `details.field` — no code the UI can branch on, no guidance. C5's two links use the `EVIDENCE_LINK_GUARDS` route (mechanism 1) rather than this map, because C5's links are evidence links, not document *types*.

**Upload validation as it stands.** **Twelve** independent multer configs (re-counted at `1e6ed156`: `grep -rln "multer(" backend/src | grep -v test` → 12); no shared upload router. The real gate is magic-byte sniffing: `assertUploadedFileMatchesDeclaredType` (`backend/src/lib/imageValidation.ts:232-260`) resolves a signature kind from **both** the declared MIME and the extension and **rejects when they disagree** (`:248-250`), then verifies the first 4096 bytes (`hasUploadSignature` `:200`). Signatures cover PDF (`:159`), JPEG/PNG/GIF/WebP (`:55-83`), TIFF (`:163`), DWG (`:171`), DXF (`:175-191`) and ZIP/OOXML (`:196`). **An unrecognised kind returns silently** (`:244-246`) — unknown types are pass-through, which is why C5 adds no new type. **Malware scanning: NOT FOUND.** `clamav|virus|malware|antivirus` across `backend/src` returns one *comment* (`backend/src/routes/copilot/import/importSourceStorage.ts:41`) and no scanner.

**Storage.** Refs are `supabase://documents/<path>` (`getSupabaseStorageReference` `backend/src/lib/supabase.ts:82-84`). Ownership checks via `getSupabaseStoragePath(fileUrl, {bucket, expectedPrefix})` (`:131`). Path traversal guarded at `backend/src/lib/uploadPaths.ts:16`, `:43` and `backend/src/lib/supabase.ts:15`, `:52-67`. Browser access is backend-mediated (`DocumentSignedUrlToken` `schema.prisma:1733-1748`; routes `backend/src/routes/documents/fileAccessRoutes.ts:58`, `:88`).

**Audit.** Two helpers, and the difference is load-bearing for §4.4a: `createAuditLog(params)` (`backend/src/lib/auditLog.ts:105`) is **best-effort** — it swallows failures and only logs (`:106-112`) — while `writeAuditLogInTransaction(tx, params)` (`:127-129`) is **hard-fail**, which is what the diary reopen path uses (`diarySubmission.ts:390-402`). Action constants live in the `AuditAction` map (`auditLog.ts:213-214` for the diary entries).

### 2.4 The consumers C5 must feed

**The folio payload contract.** `backend/src/lib/handover/folioPayload.ts` is the renderer's only input and is deliberately Prisma-free (asserted by AT-153, header `:5-11`). To be includable, a C5 record must:

1. add a `FolioXxxPayload` interface and a key on `FolioEvidencePayload` (`:126-132`), and be counted in `countEvidenceRows` (`:148`);
2. add its `FolioSourceType` (`backend/src/lib/handover/revisionTokens.ts:32-38`, six members today) and a `RevisionTokenKind` entry in `REVISION_TOKEN_KINDS` (`:47-61`) — `'version' | 'updated_at' | 'row_digest'` (`:40`);
3. **bump `FOLIO_PAYLOAD_SCHEMA_VERSION`** (`revisionTokens.ts:107`, currently `1`) — the rule is stated at `:103-106` and applies to a shape change *or* a digest-field-list change;
4. be queried in `backend/src/routes/folio/assemble.ts` at `CEILING + 1` and counted against `FOLIO_EVIDENCE_ROW_CEILING_DEFAULT = 5000` (`assemble.ts:51`, comment `:40-50`, read at call time by `folioEvidenceRowCeiling()` `:53-59`) — **over-ceiling is a refusal with the measured number, never truncation** (`:369-380`);
5. have any verdict decided **server-side** (`testVerdict()` `assemble.ts:64-70`) — the renderer prints the string it is given.

**The hold-point evidence package.** `backend/src/routes/holdpoints/evidencePackage.ts` — pure DB-free presentation mappers shared by three consumers (`GET /:id/evidence-package` `backend/src/routes/holdpoints/readRoutes.ts:276`, `POST /preview-evidence-package` `:453`, and the public token page). Its input types are `EvidenceChecklistItemInput` (`:26`), `EvidenceCompletionInput` (`:34`), `EvidenceTestResultInput` (`:56`) and a photo input; resolution at `evidencePackageInputs.ts:16`.

**Readiness.** `EvidenceReadinessArea` (`backend/src/lib/evidenceReadiness/core.ts:8-19`) is a closed union of eleven members — a C5 area is a new member. `EvidenceReadinessItem.code` is narrowed to `ReadinessReasonCode` (`core.ts:21` and the comment at `:22-31`: *"An unregistered code is now a COMPILE ERROR at the emitter"*), so a C5 code requires an entry in `READINESS_REASON_CODES` (`reasonCodes.ts:29-85` — a flat `as const` array of **bare string literals**, type derived at `:87`) **and** in `REASON_CODE_PROVENANCE` (`:149-152`, `Record<ReadinessReasonCode, { predicate: string; source: string }>`) in the same change. `HANDOVER_BLOCKING_REASON_CODES` (`:114-137`) is nine members, compile-checked as a subset.

### 2.5 F0 status — C5 is standalone

`RequirementDefinition`, `RequirementInstance`, `EvidenceLink`, `ActionAssignment` and `ExceptionOrWaiver`: **NOT FOUND** in `backend/prisma/schema.prisma`. All five grepped. What exists is `RequirementEvaluation` (`:1836`) — the immutable **snapshot** table, written only by `backend/src/lib/readiness/recordDecision.ts` behind `READINESS_SNAPSHOTS_ENABLED` (`:236-239`), rows explicitly *"immutable: no update/delete API"* (`schema.prisma:1830-1834`) — plus `ActionAssignment` as a **type with no table** (`backend/src/lib/readiness/contracts/actionAssignment.ts`).

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
| **RG-9** *(restated at Rev 2, `[C5R-N1]`)* | **What a hostile LandXML/GML file can do to `fast-xml-parser` as configured — specifically internal entity expansion (billion laughs), not XXE.** fast-xml-parser resolves no external entities and fetches nothing; there is no DTD/external-entity resolver in it, so classic XXE (local file read, SSRF) is **not** the reachable risk. The residual is **entity-expansion / parser DoS**, bounded today only by the 20 MB cap at `alignmentFileImport.ts:14`. | The safety envelope of any future survey XML import, and the size/time bound it needs. | **C5.5** | Read the parser's entity handling at its pinned version against the config at `backend/src/lib/spatial/landxmlParser.ts:33-39`; write one hostile-fixture test with a wall-clock bound. **An hour's work, not a research pass** — but it must be answered *before* C5.5. **Note for whoever does it:** the two OOXML configs (`copilot/import/excelParser.ts:154`, `:157-162`; `wordParser.ts:176-183`) are fed externally-authored files **today** and share the same exposure, so the fixture belongs in a shared test, and the finding is not C5.5-only. Also note `fast-xml-parser` is declared (`backend/package.json:69`) but is not installed in a fresh worktree — `npm ci` in `backend/` first. |

### 3.2 What each blocked phase is actually blocked on

**C5.4 (material approvals, structured supplier certificates, quarantine) is blocked on RG-5, RG-6 and RG-8** — three independent domain gaps. It is *not* blocked on code: the tables would be routine. It is blocked because a materials-approval register whose states and fields were guessed is worse than none — it will be filled in wrong, and it will then be exported into a folio that an engineer signs.

**C5.5 (survey file/geometry import and design-vs-as-built) is blocked on four things, and the fourth is not research at all:**

1. RG-1 — what the file is;
2. RG-2 — what a verdict means;
3. RG-3 — whether the comparison input exists;
4. **The datum gap.** `backend/src/lib/spatial/crs.ts:5-21`. Level and position tolerances in civil work are millimetre-to-centimetre. The shipped CRS layer carries a **~1.8 m** unimplemented GDA94→GDA2020 shift and is honest about it in a comment. **`[C5R-A8]` sharpens where the danger actually is:** the canonical storage is *local grid coordinates as entered* (`crs.ts:8-10`), and a comparison performed in local grid with both inputs in the same datum carries **zero** datum error. The 1.8 m appears only when two coordinate sets of *different or unknown* datum are compared, or when an absolute WGS84 position is claimed. So the invariant is not "no imported coordinate may touch `localToWgs84`" — that would block drawing an imported point on a map, which is not where the danger is, and it would send the next agent to implement a 7-parameter transform before establishing they need one. See `[C5S-B6]` in §6 for the restated form.

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

### 4.3 Originals are preserved; replacements supersede — **rewritten at Rev 2** `[C5R-B4]`

**What Rev 1 got wrong, and it changed the build.** Rev 1 asserted three times (§4.3, §16 item 5, §18.2 item 2) that `Document.version` / `parentDocumentId` / `isLatestVersion` *"exist and are used by nothing"*, that *"C5 is their first consumer"*, and budgeted pilot time for discovering that unused schema misbehaves. **That is false.** Re-verified at `1e6ed156`, the three columns (`schema.prisma:1700-1703`, self-relation `onDelete: SetNull` `:1712`, index `:1729`) have **seventeen production consumers across nine backend files**, plus frontend UI and three dedicated tests:

- **Write:** `versionRoutes.ts` — root resolution `:152-163`, stale-parent 409 guard `:193-204`, `MAX(version)+1` `:206-211`, flip-all-to-false `:213-216`, new row `:231-233`, chain read `GET /:documentId/versions` `:284-289`. `deleteRoutes.ts` — successor selection `:125-137`, root re-parenting `:139-159`, promotion `:176-181`.
- **Read:** `listRoutes.ts:132` (`isLatestVersion: true` on the register), `folio/assemble.ts:140` + `:150` + `:288` (the `v:{n}` revision token), `handoverExports/snapshot.ts:99`, `:124`, `:169`, `handoverExports/scope.ts:91`, `auth/accountPrivacyRoutes.ts:400-402` (privacy export).
- **Contract:** `lib/handover/revisionTokens.ts:49-50` declares `document: 'version'` with the comment *"Real version tracking"* — `document` is the **only** `FolioSourceType` with a real version, and both folio assembly and export snapshots depend on it.
- **Tests:** `documents.test.ts:2156`, `:2200`, `:2267` already assert exactly one `isLatestVersion` per chain, including under concurrency.

These columns are not dormant. **They are part of the folio/export freeze contract**, and a second hand-written write path over them — which is what Rev 1's §4.3 instructed — would diverge from invariants `deleteRoutes.ts` already assumes.

**What Rev 2 builds instead.** Two mechanisms, both already in the tree, and **C5 versions no documents at all**:

- **Record-level supersession — `Drawing`'s chain (§2.3a). This is C5's only revision mechanism.** A new survey revision is a **new `SurveyRecord` row** carrying its own new `Document`, with `supersededById` set on the old row. Reads default to `supersededById: null`. The prior report row and its file are untouched and remain retrievable through the chain. This is the correct granularity for a survey: a re-survey is a new professional act, not a new revision of a file.
- **File-level — C5 links to `Document` rows and protects them from the generic routes.** A replacement delivery docket (the photo was blurry; the supplier reissued) is a **newly uploaded `Document`** and a re-point of `docketDocumentId` through the §4.4a evidence route, which audits `{from, to}`. The superseded file stays in the document register, unreferenced and intact. `[C5S-B7]` — **no C5 code path calls `document.delete`**, asserted by a diff grep in the exit gate.

**The three guard entries C5 owes** `[C5R-B3]` — without them, C5's two new links are exactly the hole the shipped guards exist to close:

| # | Where | Entry | What it prevents |
| --- | --- | --- | --- |
| 1 | `evidenceLinkGuards.ts` `EVIDENCE_LINK_GUARDS` (`:25-69`) | `evidenceType: 'survey_report'`; `findLink` → `surveyRecord.findFirst({ where: { reportDocumentId: documentId }, select: { status: true } })`, returning `{ metadataLocked: status === 'accepted' }`; `deleteBlockedMessage: 'Survey report documents must be removed from the survey record.'`; `metadataLockedMessage: 'A survey report cannot be modified once the survey has been accepted.'` | `DELETE /api/documents/:id` on a linked report returning a bare 422 `INVALID_REFERENCE` from the FK (`errorHandler.ts:319-327`) instead of a 409 with guidance; and free renaming/re-categorising of the report behind an `accepted` record §4.5 refuses to edit. |
| 2 | same array | `evidenceType: 'delivery_docket'`; `findLink` → `diaryDelivery.findFirst({ where: { docketDocumentId: documentId } })`, returning `{ metadataLocked: false }`; `deleteBlockedMessage: 'Delivery docket documents must be removed from the delivery.'` | Same bare-422 problem on the delivery side. **`metadataLocked` is deliberately `false`:** §4.4a exists precisely to keep delivery evidence editable after the diary is submitted, so locking the document's caption while the link itself is editable would be incoherent. Flip it only if the pilot shows docket metadata being churned. |
| 3 | `versionRoutes.ts` `assertDocumentCanUseGenericVersioning` (`:56-82`) | Two more `findFirst` probes (survey report, delivery docket) in the existing `Promise.all`, joining the ITP/NCR refusal with `code: 'WORKFLOW_EVIDENCE_VERSION_BLOCKED'` and `evidenceType`. | **The sharp one.** Generic versioning creates a **new `Document` row with a new id** (`versionRoutes.ts:218-233`) and flips the old row to `isLatestVersion: false` (`:213-216`). C5's FK still points at the **old** row. The folio and the release package would then render the *superseded* file while the document register (`listRoutes.ts:132`) shows the current one — the exact inverse of "originals preserved, replacements supersede", and stale evidence inside a signed folio. |

**Why C5 does not call the shipped versioning route** — a deliberate divergence from the review's prescription, recorded in §19: (a) entries 1–3 make that route **refuse** C5 documents by construction, so "call it, gated" is self-cancelling; (b) its logic is inline in a multer Express handler (`versionRoutes.ts:102-249`) with a `FOR UPDATE` row lock and three concurrency tests against it — extracting a callable service from it is a refactor of a shipped path, larger than the wave and out of C5's blast radius. **Record-level supersession plus an audited FK re-point covers every C5 replacement case with no new write path over the version columns.** *Flip condition:* if C4 or a later wave extracts a `createDocumentVersion(tx, …)` service, C5's delivery-docket replacement should re-point at it rather than keep uploading standalone rows.

Both FKs from a C5 record to its `Document` are `onDelete: Restrict`, matching `Drawing` (`schema.prisma:1764`): the file cannot be deleted out from under the evidence record. The guard entries are what turn that FK error into a usable message.

### 4.4 The delivery record — C5.1

`DiaryDelivery` gains exactly two nullable columns:

- **`docketDocumentId String?`** → `Document`, `onDelete: Restrict`. The supplier's docket or certificate as filed. Single-valued for the same reason `TestResult.certificateDocId` is (`schema.prisma:949`): a delivery has one docket. **Deliberately `Restrict` where `certificateDoc` is `SetNull`** (`schema.prisma:988`) — it follows `Drawing.document` (`:1764`) instead, because a delivery whose docket silently detached is worse evidence than a document that refuses to delete. Additional photographs continue to go to `Document` with `lotId` and category `'Material Delivery'`, which already exists (`backend/src/routes/documents/classificationRoutes.ts:47`).
- **`batchRef String?`** — free text, capped, **transcribed from the docket**. Not a modelled batch entity, not parsed, not validated against anything. It is honest for the same reason `Lot.materialType` shipped as free text validated only against an authority vocabulary: CIVOS records what the paper says. Structuring it is C5.4's, behind RG-6.

Plus three read surfaces that do not exist today: a lot-scoped delivery list, a project-scoped delivery register with filters, and the folio/release-package projections (§4.6). `lotId` stays **nullable** — a foreman recording a delivery at 6am who does not yet know the lot must not be blocked, and forcing the link would produce wrong links, not more links. The register surfaces unlinked deliveries as a **support-severity** readiness item so they get linked, never as a blocker `[C5S-B5]`.

### 4.4a The evidence-mutation path — **new at Rev 2** `[C5R-B2]`

**The problem, stated exactly.** Every `DiaryDelivery` mutation runs through `withEditableDiary` (`backend/src/routes/diary/diaryItemMutation.ts:10-22`) → `requireEditableDiaryForWrite` (`backend/src/routes/diary/diaryAccess.ts:92-123`), which refuses `diary.status === 'submitted'` (`:114-116`) and `diary.lockedAt` (`:118-120`). **The refusal begins the moment the foreman submits the day's diary** — it does not wait for the 7-day auto-lock (`DIARY_LOCK_AFTER_MS`, `:30`), because `requireEditableDiaryForWrite` never calls `isDiaryLocked` (`:37-48`) at all and the `submitted` check fires first. The window is therefore hours, not days: the diary is submitted the evening of the pour, and the concrete docket arrives the next morning.

Rev 1 sold three things that this refuses outright:

- §4.4 / §4.6 / AT-177: the unlinked-delivery readiness item exists *"so they get linked"*. They could not be linked; `lotId` is on the frozen row.
- §7.2: *"The docket attachment rides the existing photo queue **or is added later online**."* It could not be added later.
- §0.1's whole premise — a quality manager asking *"what material went into this lot"* during handover prep, weeks or months after every relevant diary was submitted.

The only shipped escape is `POST /api/diary/:diaryId/reopen` (`diarySubmission.ts:335-336`, gate `DIARY_REOPEN_ROLES = owner|admin|project_manager` at `:26`, `:371-377`, mandatory reason ≤1000 chars, hard-fail audit `DIARY_REOPENED` at `:390-402`, and it clears `lockedAt` at `:385`). Using it to attach a supplier docket means **unwinding a submitted daily record** — a control designed for correcting the day's account of work — and it degrades the diary's own evidentiary value. Nobody will do it, and they should not.

**The decision.** `docketDocumentId`, `batchRef` and `lotId` are **evidence fields, not diary content**. They get one narrow mutation path that does not take the diary-editable lock. `description`, `quantity`, `unit`, `supplier` and `notes` — the foreman's account of the day — stay exactly as locked as they are today.

**The route.**

```
PATCH /api/deliveries/:deliveryId/evidence
```

Mounted at a new top-level `/api/deliveries` router (free at `1e6ed156`; no existing route claims it). **Not** nested under `/api/diary/:diaryId/...`, because the caller is a quality manager at handover who has a lot and a delivery, not a diary id.

**Body — a Zod `.strict()` object with exactly three optional keys**, each nullable:

```ts
z.object({
  docketDocumentId: z.string().uuid().nullable().optional(),
  batchRef:         z.string().trim().max(120).nullable().optional(),
  lotId:            z.string().uuid().nullable().optional(),
}).strict()
```

`.strict()` is the trust boundary and it is the inverse of C2's mistake: C2 gates by an *exemption list* that silently widens when a field is added (`hasSubstantiveEdit`, §2.3c), where this gates by a *whitelist schema* that rejects an unknown key with a 400. A future `quantity` in this body is a test failure, not a silent diary edit. AT-184.

**Access — one shipped helper, one new route-local const:**

```ts
// Route-local, per the FOLIO_ISSUERS / TEST_VERIFIERS convention
// (folio/access.ts:12-23, testResults/accessControl.ts:41). NOT a hierarchy check.
const DELIVERY_EVIDENCE_EDITORS = [
  'owner', 'admin', 'project_manager', 'quality_manager',
  'site_manager', 'site_engineer', 'foreman',
];
```

That is `DIARY_WRITE_ROLES` (`diaryAccess.ts:19-26`) **plus `quality_manager`** — which resolves `[C5R-B5]`(b): the QM is the persona §0.1 is written for, this attach action is theirs, and `quality_manager` is absent from `DIARY_WRITE_ROLES`. Foreman stays in: the foreman who photographed the pour is who attaches the docket that arrives next morning.

Enforcement reuses the shipped call, not a new helper — the same one `requireDiaryWriteAccess` makes (`diaryAccess.ts:63-74`), with a different const:

```ts
await requireEffectiveProjectRole(user, diary.projectId, DELIVERY_EVIDENCE_EDITORS, msg, {
  client: tx, excludeSubcontractorProjectMemberships: true, requireWritable: true,
});
```

`requireWritable: true` is **not optional**: `requireInternalProjectAccess` (`projectAccess.ts:212-231`) does *not* perform the archived-project check — `assertProjectAllowsWrite` lives on the `requireEffectiveProjectRole` path (`:205-207`). A write route that used `requireInternalProjectAccess` would accept edits on an archived project. `excludeSubcontractorProjectMemberships: true` keeps portal roles out (`isSubcontractorPortalRole`, `projectAccess.ts:17`).

**Validation inside the transaction:**

1. Load the delivery with its diary (`select: { id, lotId, docketDocumentId, batchRef, diary: { select: { id, projectId, status, lockedAt } } }`). Missing → 404.
2. Role check as above, against `diary.projectId`.
3. If `lotId` is present and non-null: `requireLotInProject(lotId, diary.projectId, tx)` — the shipped helper (`diaryAccess.ts:125-142`), identical to what `POST` (`diaryItems.ts:255`) and `PUT` (`:289`) already do. `[C5R-A4]`.
4. If `docketDocumentId` is present and non-null: the `Document` must resolve **within the same project** (`document.findFirst({ where: { id, projectId: diary.projectId } })`) or 400. This is the cross-tenant case AT-176(d) asserts, and it is the reason the route takes a `documentId` rather than a file (`[C5R-A6]`, §7.1).
5. `updateMany({ where: { id: deliveryId } })`; a count of 0 (concurrent delete on a still-draft diary) → 404.

**Audit — hard-fail, in the same transaction:**

```ts
await writeAuditLogInTransaction(tx, {
  projectId: diary.projectId,
  userId: user.id,
  entityType: 'diary_delivery',
  entityId: delivery.id,
  action: AuditAction.DELIVERY_EVIDENCE_UPDATED,   // new member, auditLog.ts
  changes: {
    // only keys actually present in the validated body
    docketDocumentId: { from: prev.docketDocumentId, to: next.docketDocumentId },
    batchRef:         { from: prev.batchRef,         to: next.batchRef },
    lotId:            { from: prev.lotId,            to: next.lotId },
    // context: this edit deliberately bypassed the diary lock, so record the lock state
    diaryStatus:   diary.status,
    diaryLockedAt: diary.lockedAt,
  },
});
```

`writeAuditLogInTransaction` (`auditLog.ts:127-129`), **not** `createAuditLog` (`:105`), because the latter swallows failures (`:106-112`). A route whose entire justification is that it edits evidence outside the normal lock cannot have a best-effort audit trail. `diaryStatus` / `diaryLockedAt` are recorded so a reader of the audit log can see the edit landed after submission — that is the control that makes the bypass legible rather than invisible.

**Edge cases, worked:**

| Case | Behaviour |
| --- | --- |
| **Delivery deleted concurrently** | `DELETE` stays under the diary lock, so it is only possible while the diary is draft. The `updateMany` count-0 path returns 404. No partial write — everything is in one transaction. |
| **The delivery's `Document` is deleted** | It cannot be: `docket_document_id` is `onDelete: Restrict` (§5.1), and guard entry 2 (§4.3) turns the attempt into a 409 with a message instead of a bare 422. |
| **Diary hard-deleted** | No diary hard-delete route exists — the only `router.delete` calls under `backend/src/routes/diary/` are item-level (`diaryItems.ts:131`, `:215`, `:319`, `:414`; `diaryRosterItems.ts:73`, `:157`, `:238`). Diaries die only with their project, and the project hard-delete guard counts `dailyDiaries` (`projects/writeRoutes.ts:688-702`), so a project holding any diary cannot be hard-deleted. Nothing to handle. |
| **Lot deleted / link goes stale** | `diary_deliveries.lot_id` is `onDelete: SetNull` (`schema.prisma:1269`). Deleting a lot nulls the link and the delivery reverts to unlinked, where the `delivery_not_lot_linked` support item surfaces it. Coherent by construction; no extra code. |
| **Lot changes project** | Not reachable — no route moves a lot between projects. The link is validated against `diary.projectId` at write time (step 3) and there is no path that can invalidate it afterwards except lot deletion, above. |
| **Diary reopened, edited, re-submitted** | No interaction. This route never reads `diary.status` as a gate; it only records it in the audit payload. |
| **Offline** `[C5R-N4]` | **The offline-captured delivery is exactly the one that will need a later evidence edit.** The offline queue is create-only: one `delivery_save` type (`offline/core.ts:141`), one enqueue site with `action: 'create'` hard-coded (`diaryQuickAdd.ts:225-231`), one executor that always POSTs (`syncWorker.ts:479`), a fixed seven-field body plus `requestKey` (`:494-511`), idempotent through `createDiaryItemOnce` + `@@unique([diaryId, requestKey])`. The three evidence columns are never sent, so a retry can never null them. **One standing constraint follows:** `lotId` **is** in the offline body, so `createDiaryItemOnce` must stay create-only — if it ever became an upsert, a delayed sync would clobber a lot link set later through this route. Asserted by AT-185. |

**What this route is not.** It is not a general delivery editor, it is not reachable by subcontractors or viewers, it does not unlock the diary, it does not touch `description`/`quantity`/`unit`/`supplier`/`notes`, and it is the **only** C5 write path that bypasses a shipped lock. Acceptance: AT-184 (schema + lock bypass + content still locked), AT-185 (permissions, audit, offline non-interference), AT-176(d)/(f) (cross-tenant).

### 4.5 The survey record — C5.2

A new `SurveyRecord`, deliberately shaped like `TestResult`'s lifecycle because that lifecycle is shipped, understood, and already renders in the surfaces C5 must feed.

**States** (`CHECK`-constrained, pilot-gated `[C5S-B4]`): `requested → in_progress → received → accepted`, with `rejected` reachable from `received`. Transitions are a map in one module, in the shape of `VALID_STATUS_TRANSITIONS` (`backend/src/routes/testResults/statusWorkflow.ts:27-33`), and `accepted` is terminal.

**Short paths are in the map from day one** `[C5R-A2]`. C2 shipped its map without them and had to widen it additively later — the comment recording why is at `statusWorkflow.ts:17-22`: *"the map is widened **additively** so a test that already has a recorded result + certificate can reach 'entered' in a single step"*, and C2's shipped map now has **three** edges out of `requested` (`:28`). Retrospective filing is the *dominant* real case for a survey — the report arrives, and only then does anyone create the record — so C5.2 ships:

```
requested   → in_progress | received | accepted
in_progress → received | accepted
received    → accepted | rejected
accepted    → (terminal)
rejected    → (terminal)
```

and `POST /api/lots/:lotId/surveys` accepts an explicit non-default `status` in the create body, subject to the same gates below. A user filing one PDF must not click three buttons.

**Kinds** (`CHECK`-constrained): `set_out | conformance | as_built`. Three, because they are three different contractual acts. No fourth is added speculatively.

**Gates, mirroring C2's:**
- A record cannot reach `received` without `reportDocumentId` — the analogue of C2's `CERTIFICATE_REQUIRED` (`backend/src/routes/testResults/workflowRoutes.ts:261-268`). **Route-level, not a `CHECK`** — see `[C5R-N5]` in §5.2.
- A record cannot reach `accepted` without a surveyor identity **and** a `surveyorVerdict` (which may be `'not_stated'` — the requirement is that a human looked, not that the report said something).
- `status <> 'accepted' OR (accepted_by IS NOT NULL AND accepted_at IS NOT NULL)`, as a `CHECK`. `[C5S-B1]`, `[C5R-B1]`. §5.2.
- Once `accepted`, a substantive edit is refused. The non-substantive list is a **module-level exported const** — not an inline literal and not an import of C2's, which is unreachable (§2.3c, `[C5R-A1]`).

**Supersession carries an identity check** `[C5R-A3]`. `Drawing`'s guard is meaningful because of `supersedingDrawing.drawingNumber !== drawing.drawingNumber` (`drawings.ts:56-60`) — the chain is scoped to one drawing identity. `SurveyRecord` has **no identity key** (no `surveyNumber`, no reference column), so a not-self/same-project/target-current guard alone would permit a `set_out` record on lot A superseding a `conformance` record on lot B. C5's guard therefore enforces **five** things: not-self, same project, **same `lot_id`**, **same `kind`**, target-is-current. Adding a reference column was considered and rejected — `(lot_id, kind)` is the identity, and a nullable free-text reference would be empty on every real record, which is `[C5S-c]`'s own reasoning.

**What it does not have:** coordinates, levels, deviations, tolerances, instrument fields, or any numeric survey value. §3.

### 4.6 What the consumers receive — C5.3

- **Folio.** `FolioEvidencePayload` gains `surveys` and `deliveries`; `FolioSourceType` gains `'survey_record'` and `'diary_delivery'`, both `'updated_at'` (both tables have `updatedAt`; neither needs a digest); `FOLIO_PAYLOAD_SCHEMA_VERSION` **1 → 2**; `countEvidenceRows` counts both; `assemble.ts` queries both at `CEILING + 1`. The survey projection carries the **attributed** verdict string, resolved server-side in the `testVerdict()` shape (`assemble.ts:64-70`) so the renderer prints and never decides.
- **Hold-point evidence package.** One new input type (`EvidenceSurveyInput`) and one new summary count in `backend/src/routes/holdpoints/evidencePackage.ts`, reaching all three consumers through `evidencePackageInputs.ts:16`. Deliveries are **not** added to the release package: a superintendent releasing a hold point is deciding about workmanship and testing, and the delivery register would be noise. Flip condition at `[C5S-e]`.
- **Readiness.** One new `EvidenceReadinessArea` member — **`'survey'`** (`core.ts:8-19`). Deliveries reuse the existing `'diary'` area rather than minting a second one. Two new codes in `READINESS_REASON_CODES` + `REASON_CODE_PROVENANCE`: `survey_not_accepted` (`warning`) and `delivery_not_lot_linked` (`support`). **Neither joins `HANDOVER_BLOCKING_REASON_CODES`** `[C5S-B5]`.

---

## 5. Data model and migrations

Two migrations, both additive, both in the hand-authored wave-tagged slot convention (`20260801000000_d1b_issued_folio`, `20260802000000_d1c1_handover_export`, `20260803000000_f2_company_xero_export_settings`, `20260731000000_h5_offline_idempotency` are the recent set; `20260804000000` / `20260805000000` are free).

### 5.1 `20260804000000_c5_delivery_evidence` (C5.1)

```sql
ALTER TABLE "diary_deliveries" ADD COLUMN "docket_document_id" TEXT;
ALTER TABLE "diary_deliveries" ADD COLUMN "batch_ref"          TEXT;

ALTER TABLE "diary_deliveries"
  ADD CONSTRAINT "diary_deliveries_docket_document_id_fkey"
  FOREIGN KEY ("docket_document_id") REFERENCES "documents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "diary_deliveries_lot_id_idx" ON "diary_deliveries"("lot_id");
```

`diary_deliveries_lot_id_idx` is required, not optional: `lot_id` has an FK and **no index** today, and every C5 lot-scoped read uses it.

**Rev 1's second index is deleted** `[C5R-A9]`. `diary_deliveries` has **no `project_id`** — every row reaches a project only through `daily_diaries` — so `GET /api/projects/:projectId/deliveries` is a join, and a single-column global `diary_deliveries_supplier_idx` cannot serve `WHERE diary.projectId = ? AND supplier = ?`. Postgres will drive from the diary side and filter; the index would be decoration. **The fact §9's 2,000 ms / 10k-row target actually rests on**, and which Rev 1 never named, is that `@@unique([diaryId, requestKey])` (`schema.prisma:1272`) yields `diary_deliveries_diary_id_request_key_key` — a `diary_id`-leading index that serves the join. Note `DiaryDelivery` declares **no `@@index` at all**; the unique constraint is the only usable index on the table today. *Flip condition:* if the measured register p95 (§9, exit gate item 5) misses the target with a supplier filter applied, add a composite index chosen from the actual plan — not a guessed single-column one.

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

-- `[C5S-B1]` as constraints. THE FIRST ONE IS THE GATE; the other two are hygiene.
-- [C5R-B1]: Rev 1 shipped only the latter two, and a row with status='accepted',
-- accepted_by=NULL, accepted_at=NULL, surveyor_verdict='conforms' satisfied BOTH.
-- The wave's flagship invariant was prose.
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_accepted_requires_actor_check"
  CHECK ("status" <> 'accepted'
      OR ("accepted_by" IS NOT NULL AND "accepted_at" IS NOT NULL));
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_accepted_actor_check"
  CHECK (("accepted_at" IS NULL) = ("accepted_by" IS NULL));
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_accepted_requires_verdict_check"
  CHECK ("status" <> 'accepted' OR "surveyor_verdict" IS NOT NULL);
ALTER TABLE "survey_records" ADD CONSTRAINT "survey_records_self_supersede_check"
  CHECK ("superseded_by_id" IS NULL OR "superseded_by_id" <> "id");

-- Restrict on the report: the original file cannot be deleted out from under the
-- evidence record. Matches `drawings.document_id` (schema.prisma:1764). The
-- usable error message comes from the §4.3 guard entry, not from this FK.
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

**Which invariants are DB-level and which are route-only** `[C5R-N5]`. §0.3 says *"enforced by a `CHECK`, not by prose"*, and a reader is entitled to know where that stops. **DB-enforced:** the three vocabularies, acceptance-requires-an-actor, acceptance-requires-a-verdict, no self-supersession, and every FK. **Route-only, deliberately:** `received` requires `report_document_id` (a `CHECK` would forbid a legitimate `requested → received` body that supplies both in one statement only if written carefully, and C2's shipped analogue `CERTIFICATE_REQUIRED` is likewise route-level at `workflowRoutes.ts:261-268`); the transition map itself (a `CHECK` cannot see the previous row); the supersession identity checks of §4.5 (a `CHECK` cannot join); and the accepted-row edit refusal. Route-only invariants are asserted by AT-173, AT-174, AT-175; **the DB ones are asserted by raw SQL that bypasses the route** (AT-172), because a route-only test of a `CHECK` proves nothing about the `CHECK`.

**Both migrations are additive and reversible by column/table drop.** Neither rewrites nor deletes an existing row. Prod apply is the `Production Migrations` GitHub Actions workflow, manually dispatched from `master` with the exact confirmation phrase (`.github/workflows/production-migrations.yml:7`, `:25`, `:30`) — never `db push`, never `--accept-data-loss` (`CLAUDE.md:259-263`).

---

## 6. Invariants C5 must not break

| Tag | Invariant |
| --- | --- |
| **`[C5S-B1]`** | CIVOS records a verdict; it never makes one. No computed tolerance result; **no `accepted` row without `accepted_by` AND `accepted_at`, enforced by `survey_records_accepted_requires_actor_check`** `[C5R-B1]`; `'not_stated'` is a value, not a gap to fill. |
| **`[C5S-B2]`** | No user-facing string, marketing copy or Clancy entry says CIVOS checks, validates, verifies or certifies a survey. |
| **`[C5S-B3]`** | C5 touches nothing under `backend/src/routes/dockets/`, adds no column to `daily_dockets`/`docket_labour`/`docket_plant`, and does not change the three hard-coded `approvedDockets: 0` producers. |
| **`[C5S-B4]`** | The C5.2 workflow states stay behind the feature flag until one real conformance survey has round-tripped with a real contractor and the state names are confirmed or corrected. |
| **`[C5S-B5]`** | C5 adds no member to `HANDOVER_BLOCKING_REASON_CODES`. Its readiness items are `warning` and `support` only. C5 blocks no conformance, no claim, no hold-point release, no folio. |
| **`[C5S-B6]`** *(restated at Rev 2, `[C5R-A8]`)* | **No comparison between two coordinate sets whose datums are not both known and equal, and no absolute-position claim, until the GDA94↔GDA2020 gap (`crs.ts:5-21`) is closed.** Displaying an imported point on a map through `localToWgs84` (`crs.ts:78`) is *not* forbidden — canonical storage is local grid as entered (`:8-10`), and a same-datum local-grid comparison carries zero datum error. What is forbidden is mixing datums in a comparison, or presenting a derived WGS84 position as an absolute one. |
| **`[C5S-B7]`** | No C5 code path calls `document.delete`. Replacements supersede at the record level or re-point an audited FK; they do not destroy. |
| **`[C5S-B8]`** | No new upload file type, no new magic-byte signature kind, and **no new multer config** — C5 adds no upload route at all `[C5R-A6]`. C5 accepts only what `imageValidation.ts` already validates, through the shipped document-upload path: PDF, JPEG, PNG. |
| **`[C5S-B9]`** *(new at Rev 2, `[C5R-B3]`)* | Every `Document` FK C5 adds carries its `EVIDENCE_LINK_GUARDS` entry **and** its `assertDocumentCanUseGenericVersioning` condition, in the same PR as the FK. A C5-linked document that the generic routes can version or silently delete is a stale-evidence bug in a signed folio. |
| **`[C5S-B10]`** *(new at Rev 2, `[C5R-B2]`)* | The evidence-mutation route (§4.4a) writes **only** `docketDocumentId`, `batchRef`, `lotId`; its body schema is `.strict()`; and it is the only C5 write path that bypasses a shipped lock. Diary content fields stay locked. |
| *(inherited)* `[C2L-B3]` via `[C3S-B2]` | No second readiness engine, no cached verdict column, no recalculation job. |
| *(inherited)* `[C3S-B1]` | No location written that a human or instrument did not supply. C5 writes no locations at all. |

---

## 7. API and UI surface

### 7.1 Backend

| Route | Phase | Guard |
| --- | --- | --- |
| `GET /api/lots/:lotId/deliveries` | C5.1 | `requireInternalProjectAccess` via a `deliveryAccess.ts` that **delegates**, plus the `assertBelongsToLot` rule of §8 |
| `GET /api/projects/:projectId/deliveries` (paginated, filters: supplier, lot, date range, linked/unlinked) | C5.1 | same |
| **`PATCH /api/deliveries/:deliveryId/evidence`** — `docketDocumentId`, `batchRef`, `lotId` only | C5.1 | `DELIVERY_EVIDENCE_EDITORS` via `requireEffectiveProjectRole(..., { requireWritable: true })`. **Does not take the diary-editable lock** — §4.4a, `[C5S-B10]` |
| `PUT /api/diary/:diaryId/deliveries/:deliveryId` — **unchanged, not extended** | — | existing diary guard, untouched. Rev 1 planned to extend this; §4.4a explains why that ships a warning item pointing at an action the user cannot perform |
| `POST /api/lots/:lotId/surveys` (accepts an explicit non-default `status`, `[C5R-A2]`) | C5.2 | `SURVEY_CREATORS`; `project_id` is **derived from the lot**, never taken from the body `[C5R-A4]` |
| `GET /api/lots/:lotId/surveys` · `GET /api/projects/:projectId/surveys` | C5.2 | project read |
| `GET /api/surveys/:id` · `PATCH /api/surveys/:id` | C5.2 | read / `SURVEY_CREATORS`; a changed `lotId` is re-validated against the record's project `[C5R-A4]` |
| `POST /api/surveys/:id/status` | C5.2 | `SURVEY_ACCEPTORS` when target is `accepted` or `rejected`; `SURVEY_CREATORS` otherwise — the exact split at `backend/src/routes/testResults/workflowRoutes.ts:336-343` |
| `POST /api/surveys/:id/report` — body `{ documentId }`, **no file upload** `[C5R-A6]` | C5.2 | `SURVEY_CREATORS`; the document must resolve within the record's project |
| `POST /api/surveys/:id/supersede` | C5.2 | `SURVEY_CREATORS`, guard in the `requireSupersededByInProject` shape (`backend/src/routes/drawings.ts:36-65`) **plus same-lot and same-kind** `[C5R-A3]` |

**`[C5R-A6]` resolved: C5 adds no upload route.** Rev 1's §7.1 listed `POST /api/surveys/:id/report (upload)` while §8 claimed *"C5.1/C5.2 add no new upload mechanism"* and §18.2 item 6 said `[C5S-B8]` exists partly so C5 does not become the thirteenth multer config (twelve confirmed at `1e6ed156`). Both could not be true. **The report route takes an already-uploaded `documentId`**, which also gives the cross-tenant document check one place to live (§4.4a step 4 has the identical check on the delivery side). No thirteenth multer.

No public/unauthenticated route. No token surface. No webhook.

### 7.2 Frontend

- **Lot detail** — one "Survey & materials" section listing accepted/outstanding surveys and lot-linked deliveries. No new page, no new nav entry.
- **Delivery register** — a saved-view-shaped register at project level, matching the existing register idiom. Rows carrying no lot expose the evidence editor inline; that editor calls `PATCH /api/deliveries/:id/evidence` and therefore works on deliveries whose diary was submitted months ago (§4.4a).
- **Survey record editor** — one modal, one status control. Captures on **one** surface, per the `[C3R-B3]` lesson (a control on a second, wrong surface stamps the wrong provenance).
- **Foreman shell: untouched.** Adding a docket photo to a delivery goes on the existing `AddDeliverySheet` (`frontend/src/components/foreman/sheets/AddDeliverySheet.tsx`) as an optional attach, reusing the shipped photo-capture path. **No shell layout change** — a shell touch needs Jay's explicit go (program §5 item 4) and C5 does not spend it.
- **Offline: unchanged surface, unchanged contract.** The delivery quick-add already queues (`frontend/src/lib/offline/diaryQuickAdd.ts:225-231`); C5 adds **no new offline entity** and no offline evidence action. The docket attachment rides the existing photo queue, **or is added later online through §4.4a** — which is now a route that exists rather than a sentence that was untrue.

### 7.3 Permission matrix

Role sets are **route-local const arrays**, not hierarchy checks — the convention stated and reasoned at `backend/src/routes/folio/access.ts:12-23` (*"`canApproveItems` resolves to the same four roles today and drifts the moment a role is inserted into `ROLE_HIERARCHY`"*), with precedent at `TEST_VERIFIERS` (`backend/src/routes/testResults/accessControl.ts:41`).

```
SURVEY_CREATORS           = ['owner','admin','project_manager','site_engineer','quality_manager']
SURVEY_ACCEPTORS          = ['owner','admin','project_manager','quality_manager']
DELIVERY_EVIDENCE_EDITORS = ['owner','admin','project_manager','quality_manager',
                             'site_manager','site_engineer','foreman']   // [C5R-B5]b
```

| Action | owner | admin | project_manager | quality_manager | site_manager | site_engineer | foreman | viewer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Read deliveries (lot / register) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create / edit a delivery (diary content, while the diary is editable) | ✓ | ✓ | ✓ | ✗† | ✓ | ✓ | ✓ | ✗ |
| **Edit delivery evidence — docket / batch / lot — after submission** (§4.4a) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Read surveys | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create / edit a survey record | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| Move to `received` | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| **Accept / reject a survey** | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Supersede a survey | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Edit an accepted survey (substantive) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

† `quality_manager` is **absent from the shipped `DIARY_WRITE_ROLES`** (`backend/src/routes/diary/diaryAccess.ts:19-26`) and C5 does not widen it — changing who may write diary content is a diary decision, not C5's. The QM reaches the evidence fields through `DELIVERY_EVIDENCE_EDITORS` on the §4.4a route, which is the action §0.1's persona actually needs. `[C5R-B5]`(b).

**Subcontractors appear in no row — 403 on every C5 surface.** `[C5R-B5]`(a). Rev 1's matrix granted subcontractors *"Read deliveries — assigned lots only"* with a footnote claiming *"the shipped portal mechanism, unchanged."* **There is no such mechanism**: `requireSubcontractorPortalModuleAccess` (`backend/src/lib/projectAccess.ts:382-391`) has a closed six-member vocabulary — `lots | itps | holdPoints | testResults | ncrs | documents` (`:7-13`) — with no diary or delivery key, and `DiaryDelivery` has never been exposed to the portal in any form (re-grepped at `1e6ed156`: no production consumer outside `backend/src/routes/diary/`). Meanwhile §8 requires every new read route to delegate to `requireInternalProjectAccess`, which **hard-rejects portal roles** at `projectAccess.ts:217-219` (company role) and again at `:226` (resolved project role) before any lot scoping could run. The two sections could not both be built, and building the matrix literally would mean writing a bespoke subbie path onto a brand-new bulk read surface carrying supplier names, quantities and docket numbers — the exact widening `[C5S-B3]` and `docs/product/pilot-journeys.md:352-355` warn about. **The row is deleted, and the call is recorded as DC5-5** (§15.1) rather than left as an unexamined matrix cell. Surveys were already `✗` for subcontractors under **DC5-3**; `requireSubcontractorPortalModuleAccess` gains no `'surveys'` and no `'deliveries'` module.

**Foreman is not a survey actor** — consistent with the shipped rule that foreman is not a lot setup manager. Foreman *is* a delivery actor, because that is what a foreman already does today.

---

## 8. Security, tenancy and privacy

**Threat model gate.** Program §7 line 134 gates a threat model as an artifact before A3, C2, D2 and E — **not before C5**. C5 nonetheless touches file evidence, which §7 line 135 makes a standing requirement regardless of wave. The disposition: **C5.1/C5.2 add no new upload mechanism and no new multer config** — they attach `Document` rows produced by the shipped document-upload path, which already runs magic-byte validation (`[C5R-A6]`, §7.1). **`[C5S-B8]` is what makes a separate threat-model artifact unnecessary for C5.1–C5.3.** **C5.5, if unblocked, ships a new parser over externally-authored survey files and DOES require its own threat model first** — that is the artifact gate, and RG-9 is its first item.

| Threat | Disposition |
| --- | --- |
| **Malicious upload.** No malware scanning exists anywhere (`clamav\|virus\|malware\|antivirus` across `backend/src` → one comment at `backend/src/routes/copilot/import/importSourceStorage.ts:41`, no scanner). | C5 adds **no new accepted type and no upload route** `[C5S-B8]`. Every C5 file is PDF/JPEG/PNG through `assertUploadedFileMatchesDeclaredType` (`backend/src/lib/imageValidation.ts:232-260`), which rejects a MIME/extension disagreement (`:248-250`) and verifies the first 4096 bytes. The residual — an unscanned but well-formed PDF — is the **same** residual every shipped upload surface carries; C5 does not widen it and does not claim to have closed it. Program §7's malware-scanning requirement remains **open program-wide**, and C5 is not the wave that closes it. Recorded in §16. |
| **Tenant isolation on new query surfaces.** Five new read routes plus one write route. | Every read delegates to `requireInternalProjectAccess` (`backend/src/lib/projectAccess.ts:212-231`) — **no fifth copy of `requireProjectReadAccess`** (the argument-order transposition hazard reasoned at `backend/src/routes/folio/access.ts:25-40`). The §4.4a write route uses `requireEffectiveProjectRole(..., { requireWritable: true })` instead, because `requireInternalProjectAccess` does **not** perform the archived-project check (`assertProjectAllowsWrite` is at `projectAccess.ts:205-207`, on the other path). Asserted by AT-176 in the lettered sub-case style of AT-92, seeding a whole second tenant (`backend/src/routes/folio/folioIssuance.db.test.ts:144-146`, `:380-413`). |
| **Row-to-lot binding, both directions** `[C5R-A4]` `[C5R-A5]`. | **Read side:** every row loaded by its own id is re-checked against `(lot.id, lot.projectId)` via `assertBelongsToLot` (`backend/src/routes/folio/access.ts:72-80`). That helper's row type is `{ projectId: string; lotId: string }` — **`lotId` is non-nullable**, and both C5 rows have a nullable `lot_id`. **The rule for `lotId === null`:** on a **lot-scoped** route the call site narrows first and passes `null` for the row when the record has no lot — `assertBelongsToLot(row.lotId ? { projectId: row.projectId, lotId: row.lotId } : null, lot, 'Survey record')` — which yields the correct 404 through the shipped guard with no new helper. On a **project-scoped** route the row is legitimately returned; scoping is `where: { projectId }` and no lot guard applies. **Write side:** `POST /api/lots/:lotId/surveys` derives `project_id` from the lot and never reads it from the body; `PATCH /api/surveys/:id` and `PATCH /api/deliveries/:id/evidence` re-validate a changed `lotId` with `requireLotInProject(lotId, projectId, tx)` — the shipped helper the diary routes already call at `diaryItems.ts:255` and `:289`. Without this, `survey_records` carries `project_id` and `lot_id` with no constraint tying them, and another project's survey could reach a lot's issued folio. AT-176(f). |
| **The register is a new bulk-read surface.** `GET /api/projects/:projectId/deliveries` returns supplier names and quantities across a project. | Internal roles only; **subcontractors are 403 on every C5 surface** (§7.3, DC5-5). Paginated with a hard `take` cap — the `[C3R-B1]` lesson (an unbounded test query with only transitive scoping was C3's single security finding). |
| **A write route that bypasses a shipped lock** (§4.4a). | Narrowed four ways: a `.strict()` three-key body schema (an unknown key is a 400, not a silent diary edit); a route-local role const that excludes viewers and portal roles; `requireWritable: true` so archived projects still refuse; and a **hard-fail** `writeAuditLogInTransaction` recording `{from, to}` for each field plus the diary's status and lock state at the moment of the edit. `[C5S-B10]`, AT-184, AT-185. |
| **Imported files are data, never instructions.** | C5.1–C5.3 run **no AI over any C5 file**. If C5.4/C5.5 ever do, the output-side whitelist normaliser is mandatory (`backend/src/routes/copilot/projectFactsExtraction.ts:91-95`) and the result rides `AiProposal`, never a bespoke inline loop `[C5S-d]`. |
| **False attribution.** A survey record names a real, identifiable professional and states a verdict attributed to them. A wrong or fabricated entry is a defamation-shaped risk, not just a data-quality one. | Every attributed field is transcribed by a named CIVOS user, and every write is audited with old and new values through the shipped audit path (the `[C3R-A7]` shape: extend the existing audit call, do not add a site). The folio renders *"as recorded by <CIVOS user> on <date>"* alongside the surveyor's name, so the reader can tell a transcription from a signature. **This is the single most important privacy/liability property of the wave** and it is an exit-gate item. |
| **Personal data.** `surveyorName`, `surveyorCompany`, `surveyorRegistration` are personal/professional identifiers of a third party. | Covered by the existing project data-retention and export paths; no new subprocessor, no new egress. Not rendered on any public/token surface in v1 (§7.1: C5 has none). |
| **Retention on project hard-delete** `[C5R-A7]`. | `backend/src/routes/projects/writeRoutes.ts:683-729` refuses a permanent delete when any of **fifteen** enumerated `_count` relations (`:688-702`, including `drawings` and `dailyDiaries`) or two computed counts (`:712-721`) is non-zero — *"Project contains retained records and cannot be permanently deleted. Archive the project instead."* (`:723-729`). **`surveyRecords` must join that `_count`.** Deliveries are covered transitively via `dailyDiaries`; a project-scoped `survey_records` table that is not enumerated is either invisible to the guard (project classed empty, survey evidence destroyed) or blows up on the FK. One line, the same "enumerate the next one" pattern as `EVIDENCE_LINK_GUARDS`. AT-188. |
| **Audit-log tamper resistance.** | Unchanged. C5 writes through the shipped `AuditLog` path; it adds no new audit mechanism, only one new `AuditAction` member. |
| **XXE / hostile XML.** | Not reachable in C5.1–C5.3 (no XML). **RG-9 is a named prerequisite of C5.5, and it is an entity-expansion question, not an XXE one** `[C5R-N1]` — §3.1. |

---

## 9. Scale and performance

Measured against the program §8 reference dataset (5,000 lots, 10,000 map features, 50 GB evidence, 10k-row registers), server-side p95 plus a mid-tier Android over 4G where a field surface is involved.

| Target | Value | Dataset | Why this number |
| --- | --- | --- | --- |
| Delivery register p95 | **< 2,000 ms** at 10k rows without pagination collapse | 10k `diary_deliveries` on one project | Program §8 line 141, unmodified. **The join is what this rests on** `[C5R-A9]`: `diary_deliveries` has no `project_id`, so the query drives from `daily_diaries` and uses the `diary_id`-leading `diary_deliveries_diary_id_request_key_key` (from `@@unique([diaryId, requestKey])`, `schema.prisma:1272`). §5.1's `diary_deliveries_lot_id_idx` serves the lot-scoped read and the linked/unlinked filter. |
| Lot-scoped delivery + survey read p95 | **< 400 ms** | reference project, a lot with 20 deliveries and 3 surveys | It renders inside the lot page, which already has a budget; C5 must not be what a user notices. |
| **Folio evidence-row ceiling headroom** | **C5's two collections add < 50 rows at p99 per lot**, and **`FOLIO_EVIDENCE_ROW_CEILING_DEFAULT` is not raised** | reference dataset, worst lot | `countEvidenceRows` (`backend/src/lib/handover/folioPayload.ts:148`) drives a **refusal**, not a truncation (`assemble.ts:369-380`). The ceiling is **per lot** (`assembleFolioPayload` takes one `lotId`, `:326`, `:336-360`) while the shipped comment records the reference dataset as 5,000 rows for a whole *project* (`:43-50`) — so a lot flipping to "refuses" over single-digit surveys and low-tens deliveries is remote, but it must be **measured on the worst lot in the reference dataset and recorded in the PR body**, and if exceeded the answer is to scope the projection, **never** to raise the ceiling. AT-179. |
| Folio assemble p95 delta | **< 15%** over the pre-C5 baseline | reference dataset | Two more queries at `CEILING + 1` each. |
| Hold-point evidence package p95 delta | **< 10%** | reference dataset | One more collection across three consumers. |

No new background job, no new worker, no new async path. C5 adds no load-test job to CI beyond re-running the existing folio benchmark harness (`backend/scripts/bench-pdf-folio.mjs` shape) with the C5 collections present.

---

## 10. Phases and PR slicing

### C5.1 — Delivery evidence: the docket, the batch reference, the evidence route, and a way to read them (M) — *ships first*

- **Depends on:** nothing. All three of its data prerequisites are shipped.
- **Why first:** the data already exists and foremen already produce it; it is the only phase with zero research exposure; and it discharges program line 79's *"batch/delivery traceability"* clause on its own.
- **Contains:** migration §5.1; the two columns; **the §4.4a evidence route** (`[C5R-B2]` — without it the phase ships a warning item pointing at an impossible action); the `delivery_docket` guard entries of §4.3; the three read routes; the `AddDeliverySheet` optional attach; the register view; the `delivery_not_lot_linked` support code.
- **Size note:** Rev 1 called this S/M. With §4.4a and the guard entries it is **M**.
- **Exit:** AT-170, AT-171, AT-176, AT-177, AT-184, AT-185, AT-186.

### C5.2 — The survey record (M)

- **Depends on:** C5.1 only for the shared access-helper module; otherwise independent.
- **Contains:** migration §5.2; the model; the transition map (with short paths, `[C5R-A2]`); the gates; supersession with the lot+kind identity check (`[C5R-A3]`); the `survey_report` guard entries of §4.3; the project hard-delete `_count` entry (`[C5R-A7]`); the editor; the `survey_not_accepted` warning code; the new `'survey'` readiness area.
- **Ships behind the flag, off, for every tenant** `[C5S-B4]`.
- **Exit:** AT-172 … AT-176, AT-178, AT-181, AT-187, AT-188.

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

Instrument provenance (RG-4). Outbound survey requests to external parties (Wave E's surface). Any fix to the C2 certificate-deletion path (C4's). Any refactor of `versionRoutes.ts` or unification of `assertDocumentCanUseGenericVersioning` with `EVIDENCE_LINK_GUARDS` (§18.2). Any change to `Docket` (`[C5S-B3]`). Any change to `DIARY_WRITE_ROLES`. Any tenant-authored rule or waiver (F0's definition model, per C3 §1.3). Any Logan PSP5 profile item (§1.2).

---

## 11. Feature flag and rollout

House pattern is a backend env var parsed inline in the `READINESS_SNAPSHOTS_ENABLED` shape (`backend/src/lib/readiness/recordDecision.ts:236-239`), and the house rollout ritual is F0's four steps (`docs/plans/f0-execution-spec-2026-07-24.md:119-125`).

**`C5_SURVEY_RECORDS_ENABLED`** — gates C5.2's routes and its UI section only.

**Its parse must be copied verbatim, not approximated** `[C5R-N6]`:

```ts
const configured = process.env.C5_SURVEY_RECORDS_ENABLED?.trim().toLowerCase();
return configured === 'true' || configured === '1' || configured === 'yes';
```

Absent ⇒ **off**, which is what §11 step 1 depends on. The shipped header comment mandates exactly this (`recordDecision.ts:232-235`: *"default FALSE everywhere, including production. Enabling is an explicit, logged rollout step — never an implicit environment default"*). A `!== 'false'` idiom would default the flag **on** in every environment that has not set it, which inverts the gate.

1. Migration applied to production via the workflow, flag absent (⇒ off).
2. Deploy C5.2 disabled; confirm no route is reachable and no readiness item is emitted.
3. Enable for one pilot project's tenant; **one real conformance survey round-trips end to end with a real contractor**; state names confirmed or corrected `[C5S-B4]`.
4. Enable permanently, or ship a reviewed migration correcting the `CHECK` vocabulary and repeat step 3.

**C5.1 ships unflagged.** Two nullable columns, one narrow evidence route and three read routes on a record foremen already create is not a behaviour change worth a flag, and a flag that is never turned off is a lie in the config. `[C5S-f]`

**C5.3 ships unflagged but is inert until C5.2's flag is on** — with no survey records, its collection is empty and the folio payload gains one empty array. The delivery collection is live immediately, which is intentional: it is the half with no research exposure.

---

## 12. Rollback and recovery

| Phase | Rollback |
| --- | --- |
| C5.1 | Revert the code. The two columns are nullable and orphan harmlessly; a `docket_document_id` pointing at a live `Document` keeps that document reachable through the normal document surfaces. Dropping the columns is a clean reverse migration, but **is not required** to restore behaviour. Reverting also removes the §4.4a route, which restores the pre-C5 behaviour exactly (evidence fields frozen with the diary) — no data is stranded, only uneditable. |
| C5.2 | Set `C5_SURVEY_RECORDS_ENABLED` off — that is the whole rollback, no deploy needed. `survey_records` rows persist and are readable by direct query; nothing else reads the table. Dropping the table is a clean reverse migration and loses only C5-created rows. |
| C5.3 | Revert the code **and** restore `FOLIO_PAYLOAD_SCHEMA_VERSION` to `1`. **The one asymmetry in the wave:** `FolioSnapshot` rows written at v2 become unreadable by a reverted v1 renderer. They must be **refused with a clear error, never coerced** — the same discipline `expiresAt` already enforces. Issued `FolioIssue` PDFs are unaffected: they are append-only files, already rendered (`backend/prisma/migrations/20260801000000_d1b_issued_folio/migration.sql:133-147`). |

**Orphaned dockets** `[C5R-N3]`. `DELETE /api/diary/:diaryId/deliveries/:deliveryId` is a bare `deleteMany` with no document handling (`diaryItems.ts:327-332`), so deleting a delivery that carried a docket leaves the `Document` with no referrer. **Harmless** — the `Restrict` FK means nothing is destroyed, and the file stays in the document register where it can be re-attached or deleted deliberately. Note the delete is only reachable while the diary is still editable, and that it writes **no audit log today** (see §18.2 item 5 — an observation, not C5's to fix).

**Data-loss risk: none.** No migration rewrites or deletes an existing row; no C5 code path deletes a `Document` `[C5S-B7]`. The only recovery action that touches production data is dropping a C5 table, which loses only C5-created records.

---

## 13. Acceptance tests

Continuing the shared series, **AT-170 … AT-188** (see the numbering note in the header; next free is **AT-189**). Every item is a real assertion in a real test file, except where marked.

| AT | Phase | Assertion | Where |
| --- | --- | --- | --- |
| **AT-170** | C5.1 | **A delivery carries its docket and its batch reference, and the document survives.** A `DiaryDelivery` with `docketDocumentId` set refuses deletion of that `Document`; `batchRef` round-trips unmodified including whitespace and non-ASCII. | `backend/src/routes/diary/deliveryEvidence.db.test.ts` |
| **AT-171** | C5.1 | **The register is bounded.** `GET /api/projects/:id/deliveries` applies a hard `take` cap and paginates; a project seeded past the cap returns the cap plus a next-page marker, never the full set. `[C3R-B1]` lesson. | `backend/src/routes/deliveries/register.db.test.ts` |
| **AT-172** *(restated, `[C5R-B1]`)* | C5.2 | **CIVOS never accepts on its own — proven at the DB.** By **raw SQL that bypasses the route**: (a) `INSERT … status='accepted', accepted_by=NULL, accepted_at=NULL, surveyor_verdict='conforms'` is rejected by **`survey_records_accepted_requires_actor_check` by name** — this is the row Rev 1's constraints permitted; (b) `accepted_at` set with `accepted_by` NULL is rejected by `survey_records_accepted_actor_check`; (c) `status='accepted'` with a NULL verdict is rejected by `survey_records_accepted_requires_verdict_check`. And no route accepts a body field named `computedVerdict`, `tolerance*` or `deviation*`: a diff grep asserts zero such identifiers in C5 code. `[C5S-B1]` | `backend/src/routes/surveys/surveyRecord.db.test.ts` + diff grep in the PR body |
| **AT-173** *(extended, `[C5R-A2]`)* | C5.2 | **The transition map is the only path, and it includes the short paths.** Table-driven over the full cross product: every pair outside `VALID_SURVEY_TRANSITIONS` is rejected with a 400; `requested → received` and `requested → accepted` **succeed**; creation at an explicit non-default status succeeds subject to the same gates; `accepted` and `rejected` are terminal; `rejected` is reachable only from `received`. | `backend/src/routes/surveys/statusWorkflow.test.ts` |
| **AT-174** | C5.2 | **An accepted survey resists substantive edits, field by field.** Each non-substantive key is asserted **individually** to leave `accepted` intact, and one substantive key is asserted to be refused. `[C3R-A8]`/`[C5R-A1]` — the list is a **module-level exported const** in C5's own module, and a test asserts it is exported (C2's equivalent is unreachable, `crudRoutes.ts:394-398`). | `backend/src/routes/surveys/surveyRecord.db.test.ts` |
| **AT-175** *(extended, `[C5R-A3]`)* | C5.2 | **Supersession is scoped to one survey identity.** Five refusals: self-reference; a record in another project; **a record on a different lot**; **a record of a different `kind`**; a target that is itself superseded. Reads default to `supersededById: null`. Mirrors `requireSupersededByInProject` (`drawings.ts:36-65`) plus the two identity checks `Drawing` gets from `drawingNumber` (`:56-60`) and `SurveyRecord` has no column for. | `backend/src/routes/surveys/supersede.db.test.ts` |
| **AT-176** *(extended, `[C5R-A4]` `[C5R-A5]`)* | C5.1, C5.2 | **Cross-tenant is refused on every new route, lettered.** With a whole second tenant seeded: (a) another tenant's lot on the lot-scoped delivery route → 403; (b) another tenant's project on the register → 403; (c) another tenant's survey id presented by a user who legitimately holds *a* project → 404 via the `assertBelongsToLot` rule; (d) a cross-tenant `docketDocumentId` in the §4.4a body → 400; (e) a subcontractor on **any** C5 route, read or write → 403 (DC5-3, DC5-5); **(f) write-side binding:** `POST /api/lots/:lotId/surveys` ignores a `projectId` in the body and derives it from the lot, and a `PATCH` moving `lotId` to another project's lot → 400 from `requireLotInProject`; **(g) null-lot rule:** a survey with `lot_id IS NULL` 404s on the lot-scoped route and **is returned** on the project-scoped route. | `backend/src/routes/surveys/surveyRecord.db.test.ts`, `backend/src/routes/deliveries/register.db.test.ts` |
| **AT-177** | C5.1 | **An unlinked delivery warns and never blocks.** The `delivery_not_lot_linked` item is emitted with `severity: 'support'`, `blocksAction: false`, and does **not** appear in `HANDOVER_BLOCKING_REASON_CODES`. `[C5S-B5]` | `backend/src/lib/evidenceReadiness/*.test.ts` + the reason-code contract test |
| **AT-178** | C5.2 | **A survey short of acceptance warns and never blocks.** Same shape at `severity: 'warning'`; a lot with an unaccepted survey still conforms and still claims. | same |
| **AT-179** | C5.3 | **The folio ceiling is respected, not raised.** `countEvidenceRows` includes both new collections; a lot seeded past `folioEvidenceRowCeiling()` **refuses with the measured number** and does not truncate; and `FOLIO_EVIDENCE_ROW_CEILING_DEFAULT` is unchanged at 5000. The p99 per-lot row delta is measured on the reference dataset and **recorded in the PR body**. | `backend/src/routes/folio/assemble.db.test.ts` + benchmark artefact |
| **AT-180** | C5.3 | **The schema-version bump is honest.** `FOLIO_PAYLOAD_SCHEMA_VERSION === 2`; a stored v1 snapshot is refused with a clear error and is **never** read as v2. | `backend/src/lib/handover/folioPayload.test.ts` |
| **AT-181** | C5.3 | **The folio attributes rather than asserts.** The rendered survey section prints the surveyor's name and the verdict **labelled as the surveyor's**, plus *"as recorded by \<user\> on \<date\>"*. A snapshot test asserts the label strings; a grep asserts the words *validated*, *verified*, *certified* and *checked* appear nowhere in C5 survey copy. `[C5S-B2]` | renderer snapshot test + diff grep |
| **AT-182** | C5.3 | **The release package gains surveys and nothing else.** All three `evidencePackage.ts` consumers return the survey collection and the new count; the public batch route returns it **only** for the hold points in its own batch; deliveries are absent. | `backend/src/routes/holdpoints/evidencePackage.test.ts` + `publicBatchRoutes.db.test.ts` |
| **AT-183** | all | **C5 did not touch the docket domain.** `git diff origin/master...HEAD` shows zero changes under `backend/src/routes/dockets/`, zero to `daily_dockets`/`docket_labour`/`docket_plant` in any migration, and the three `approvedDockets: 0` literals unchanged. `[C5S-B3]` | mechanical, in the PR body |
| **AT-184** *(new, `[C5R-B2]`)* | C5.1 | **Evidence is editable after submission; diary content is not.** Against a delivery on a **submitted** diary and again on a diary with `lockedAt` set: `PATCH /api/deliveries/:id/evidence` setting `docketDocumentId`, `batchRef` and `lotId` **succeeds** and persists all three; the same fields through `PUT /api/diary/:diaryId/deliveries/:id` still **400** with *"Cannot modify submitted diary"* / *"Cannot modify locked diary"*; a body carrying `quantity` (or any key outside the three) is **400** from the `.strict()` schema, and the row is unchanged. `[C5S-B10]` | `backend/src/routes/deliveries/evidence.db.test.ts` |
| **AT-185** *(new, `[C5R-B2]` `[C5R-B5]`b `[C5R-N4]`)* | C5.1 | **The bypass is narrow, audited and offline-safe.** (a) `quality_manager` — absent from `DIARY_WRITE_ROLES` — **succeeds** on the evidence route; `viewer` and a subcontractor **403**; (b) the route **403s on an archived project** (`requireWritable: true`); (c) a `writeAuditLogInTransaction` row exists with `entityType: 'diary_delivery'`, `action: DELIVERY_EVIDENCE_UPDATED`, `{from, to}` for each changed field, and the `diaryStatus` / `diaryLockedAt` context, and **a forced audit-write failure rolls the update back** (it is not best-effort); (d) replaying the offline `delivery_save` POST with the same `requestKey` after an evidence edit returns the existing row and **does not null `lotId`** — `createDiaryItemOnce` stays create-only. | `backend/src/routes/deliveries/evidence.db.test.ts`, `backend/src/routes/offlineIdempotency.db.test.ts` |
| **AT-186** *(new, `[C5R-B3]`)* | C5.1 | **A linked docket cannot be deleted or metadata-churned through the generic document routes, and the error is usable.** `DELETE /api/documents/:id` on a document referenced by `diary_deliveries.docket_document_id` returns **409 with `code: 'WORKFLOW_EVIDENCE_DELETE_BLOCKED'`, `evidenceType: 'delivery_docket'`** and the guard's message — **not** the bare 422 `INVALID_REFERENCE` the raw FK produces (`errorHandler.ts:319-327`). An unlinked document still deletes. | `backend/src/routes/documents/deleteRoutes.test.ts` |
| **AT-187** *(new, `[C5R-B3]` `[C5R-B4]`)* | C5.2 | **Generic versioning cannot strand a C5 evidence link.** `POST /api/documents/:id/version` on a document referenced by `survey_records.report_document_id` or `diary_deliveries.docket_document_id` returns **409 `WORKFLOW_EVIDENCE_VERSION_BLOCKED`** with the right `evidenceType`; the C5 FK still resolves to a row with `isLatestVersion: true`. And `DELETE`/`PATCH` on a report attached to an **accepted** survey returns 409 `WORKFLOW_EVIDENCE_LOCKED`, while the same document under a `received` survey permits a metadata edit. `[C5S-B9]` | `backend/src/routes/documents/versionRoutes.test.ts`, `backend/src/routes/surveys/surveyRecord.db.test.ts` |
| **AT-188** *(new, `[C5R-A7]`)* | C5.2 | **Survey evidence survives the retention guard.** A project holding one `SurveyRecord` and nothing else is **refused** a permanent delete with the shipped conflict message and a non-zero `surveyRecords` entry in `retainedRecordCounts`; archiving still succeeds. | `backend/src/routes/projects/writeRoutes.test.ts` |

---

## 14. Exit gate

1. AT-170 … AT-188 pass in CI; the DB-backed ones against the local disposable Postgres, per `CLAUDE.md:180-189`. `src/test/databaseSafety.ts` is not weakened.
2. Both migrations applied to production via the `Production Migrations` workflow from `master` with the confirmation phrase; **no `db push`, no `--accept-data-loss`**.
3. `C5_SURVEY_RECORDS_ENABLED` completes all four rollout steps (§11), including step 3's **real** round-trip. `[C5S-B4]`
4. **A real project round-trips, owner Jay:** a delivery captured in the field **and its docket attached the next day, after the diary was submitted** (§4.4a — this is the step that proves the wave works), linked to a lot; a conformance survey requested, received, accepted; both appearing in that lot's issued folio; the survey appearing in a hold-point release package an external reviewer opens.
5. The folio p99 row delta and the register p95 are **measured on the reference dataset and recorded in the PR body** — a number, not an adjective. AT-179.
6. `[C5S-B2]` grep over the wave's diff (`git diff origin/master...HEAD`, **not** the tree — the `[C3R-A6]` lesson): no *validates* / *verifies* / *certifies* / *checks* in C5 survey copy.
7. `[C5S-B3]` grep over the wave's diff: no docket-domain change. AT-183.
8. `[C5S-B7]` grep over the wave's diff: no `document.delete` in C5 code.
9. `[C5S-B8]` grep over the wave's diff: no new entry in `imageValidation.ts`'s signature tables, **no new `multer(` call site** (the count stays at twelve), no new multer `fileFilter` allow-set.
10. **`[C5S-B9]` mechanical check:** every `Document` FK added by the wave has both its `EVIDENCE_LINK_GUARDS` entry and its `assertDocumentCanUseGenericVersioning` condition in the same PR. A one-line grep pairing new `documents("id")` FK lines in the migrations against new entries in the two guard files. AT-186, AT-187.
11. The nine research gaps are **recorded in `docs/research/`** as an open register, not left in this document only — so the next agent finds them by grep.
12. Docs and the Clancy knowledge mirror updated in the feature PR (standing boundary, program line 5).
13. **`npm run fallow:audit` verdict recorded in every PR body.**
14. §16's honest unknowns re-read at the end of the wave; any that closed are moved to the closed table with the evidence, not deleted.

**Not in this gate:** malware scanning (open program-wide, §8); the C2 certificate-deletion fix (C4's); the `assertDocumentCanUseGenericVersioning` / `EVIDENCE_LINK_GUARDS` unification (§18.2); C5.4 and C5.5 in any form; the GDA94↔GDA2020 datum work; any pilot outcome beyond item 3's single round-trip.

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
→ *Recommendation:* **no, not in v1** (§7.3). A survey record names a certifier and carries a conformance verdict about a subcontractor's own work; exposing it has contractual weight and no pilot has asked. `requireSubcontractorPortalModuleAccess` (`projectAccess.ts:382-391`) gains no `'surveys'` module.
*One-line why:* it is a one-line change to add later and an unretractable disclosure to add now.

**DC5-4 — Should the docket/claim separation become a written rule?**
→ *Recommendation:* **yes, one paragraph in `CLAUDE.md` or `tasks/lessons.md`, separately from C5.** The rule is currently de-facto only (§0.4) and it survived this wave by one agent reading the schema carefully. The next agent handed *"concrete/asphalt dockets → installed lot"* may not.
*One-line why:* an unwritten invariant is one confident PR away from gone.

**DC5-5 — Do subcontractors see *deliveries*?** *(new at Rev 2, `[C5R-B5]`a)*
→ *Recommendation:* **no — 403 on every C5 delivery surface, same as surveys.** Rev 1's matrix granted "assigned lots only" on the strength of a portal mechanism that **does not exist**: the portal's module vocabulary is a closed six (`lots|itps|holdPoints|testResults|ncrs|documents`, `projectAccess.ts:7-13`), `DiaryDelivery` has never been portal-exposed, and `requireInternalProjectAccess` hard-rejects portal roles (`:217-219`, `:226`) before any lot scoping could run. Building it would mean a bespoke subbie path onto a brand-new bulk surface carrying supplier names, quantities and docket numbers.
*One-line why:* it is not a matrix cell, it is a new disclosure surface — and no pilot has asked for it.

### 15.2 The spec's own decisions

- **`[C5S-a]`** — CIVOS computes no tolerance verdict in v1. *(§0.3, §4.2.)* *Flip condition:* RG-2 **and** RG-3 discharged at grade A/C respectively **and** a pilot contractor confirms they would act on a CIVOS-computed verdict. All three; any two is not enough.
- **`[C5S-b]`** — Two tables, no shared traceability abstraction. *(§4.1.)* *Flip condition:* a third subject appears with the same lifecycle **and** the same permission shape.
- **`[C5S-c]`** — No `instrumentNote` free-text column. *(§0.2.)* *Flip condition:* RG-4 shows a real deliverable that carries instrument data reaching contractors, at which point it is fields, not a note.
- **`[C5S-d]`** — Any future C5 AI extraction rides `AiProposal`, never the bespoke certificate loop. *(§1.2.)* *Flip condition:* none foreseeable; the certificate loop's own gaps are C4 findings (§18).
- **`[C5S-e]`** — Deliveries are in the folio but **not** in the hold-point release package. *(§4.6.)* *Flip condition:* a real superintendent asks for delivery evidence at a hold point.
- **`[C5S-f]`** — C5.1 ships unflagged; only C5.2 is flagged. *(§11.)* *Flip condition:* none foreseeable.
- **`[C5S-g]`** *(updated at Rev 2)* — C5 takes **AT-170 … AT-188**; `AT-157 … AT-169` stay free. Wave G shipped its own `AT-G*` namespace and took no shared number, so Rev 1's collision hazard did not materialise — the gap is kept anyway for D1c.1's in-flight numbers. Next free: **AT-189**. *Flip condition:* none — a series gap is harmless, a collision is not.
- **`[C5S-h]`** — `DiaryDelivery.lotId` stays nullable. *(§4.4.)* *Flip condition:* the pilot shows unlinked deliveries are ignored rather than linked later; the fix is then a prompt, not a `NOT NULL`. **Rev 2 note:** Rev 1's version of this decision was unbuildable — the "linked later" it relies on did not exist until §4.4a.
- **`[C5S-i]`** *(new at Rev 2, `[C5R-B4]`)* — C5 uses **record-level supersession only** and versions no `Document`. *(§4.3.)* *Flip condition:* a later wave extracts a callable `createDocumentVersion(tx, …)` service out of `versionRoutes.ts:102-249`; C5's delivery-docket replacement then re-points at it instead of uploading standalone rows.
- **`[C5S-j]`** *(new at Rev 2, `[C5R-B2]`)* — Delivery evidence fields get their own mutation path outside the diary-editable lock; diary content stays locked. *(§4.4a.)* *Flip condition:* the pilot shows the split confuses users, in which case the answer is UI wording, **not** widening the route's field set — `[C5S-B10]` is a blocker, not a default.

---

## 16. Honest unknowns

Listed rather than asserted. Each names how it gets resolved.

1. **Whether a contractor's quality manager will use a survey register at all, or keep living in email.** The pain is inferred from the program's dev-review gap 4, not from a user saying it. → *Resolved by step 3 of the rollout (§11).* ***Jay, with a design partner.***
2. **Whether "survey acceptance" duplicates hold-point release.** If the superintendent's hold-point release *is* the acceptance, C5.2's `accepted` state is ceremony. → *RG-7. One contractor, one surveyor.* If it duplicates, the fix is to delete a state, which the `CHECK` makes a clean migration.
3. **Whether deliveries get linked to lots in practice.** `lotId` is nullable and always has been; nobody has measured how often it is filled today because nothing reads it — **and until §4.4a, nobody could fill it after the diary was submitted, which may be most of the reason it is empty.** → *Measure it on the pilot tenant in week one of C5.1 — a query, not a research pass.* This is the cheapest unknown in the document and it should be answered before C5.1 merges if possible.
4. **The real per-lot folio row delta.** Estimated as small (a lot has single-digit surveys and low-tens deliveries), but estimated. → *AT-179 measures it. If the estimate is wrong the projection gets scoped, not the ceiling raised.* One wrinkle worth naming `[C5R-N2]`: the shipped refusal text is *"Split the lot or contact support."* (`assemble.ts:374-376`) — advice a user cannot act on if the overflow came from deliveries they did not file. Not C5's to reword, but if C5's collections are what tip a real lot over, that message is the thing the user will see.
5. **Whether the `.strict()` body schema is the right trust boundary for §4.4a, or whether it will be widened under pressure.** It is the inverse of C2's exemption-list shape and it is deliberately rigid. → *`[C5S-B10]` and AT-184 are the control; the first PR that adds a fourth key to that schema is the signal.*
6. **Whether malware scanning matters more than this wave thinks.** C5 reasons its way out of a threat-model artifact by adding no new file type and no upload route `[C5S-B8]`. That is correct as far as it goes, and it does not make the program-wide gap smaller. → *Program §7's requirement stays open and unowned. Someone should own it; it is not C5.*
7. **Whether the program line's *"Feeds D2 asset records"* leaves anything C5 owes.** D0 killed the receiver. This spec concludes it owes nothing beyond the folio. → *If D2 is ever revived in another form, re-read this section rather than assuming C5 covered it.*
8. **Whether five survey states is right, or three, or seven.** → `[C5S-B4]`, RG-7, step 3 of the rollout.

*(Rev 1's item 5 — "whether `Document.version`/`parentDocumentId`/`isLatestVersion` behave as intended, since they have no consumer" — is **deleted**, not softened. They have seventeen production consumers and three dedicated tests; it was never an unknown. §4.3, §18.1, `[C5R-B4]`.)*

---

## 17. Delivery-control checklist (program §9 — all thirteen items)

| # | Item | Where |
| --- | --- | --- |
| 1 | Exact included and excluded behaviour | §0.2, §1.1, §1.2 |
| 2 | Schema and data flow | §4, §5 |
| 3 | Permission matrix | §7.3 |
| 4 | Edge cases | §4.4a (worked table), §5.2 constraints, §12, §13 (AT-172 … AT-176, AT-180, AT-184 … AT-188) |
| 5 | Migration plan | §5 — two additive reviewed Prisma migrations, prod apply via the production-migrations workflow, no `db push` |
| 6 | Security threats (§7) | §8 |
| 7 | Performance tests (§8, reference dataset) | §9, AT-179 |
| 8 | Feature flag + rollout | §11 |
| 9 | Rollback / recovery | §12 |
| 10 | Acceptance tests | §13 |
| 11 | Pilot acceptance owner | **Jay**, with a design-partner contractor and surveyor — §1.3, §11 step 3, §14 item 4 |
| 12 | Production monitoring | Sentry on the new routes (shipped path, no new config); the register's p95 in the existing perf series; **the count of surveys stuck in `received` for > 14 days** as the one C5-specific signal worth watching, because it is the failure mode the feature exists to expose; and **the rate of §4.4a evidence edits against submitted diaries**, which is the direct measure of whether the wave's central premise was real |
| 13 | Exit-gate evidence | §14 |

---

## 18. Verification notes — re-derived at `1e6ed156`

### 18.1 Claims this spec corrects or records

| Claim | What was believed | **Correct at `1e6ed156`** |
| --- | --- | --- |
| *"dockets and claims never cross"* is a standing repo rule | Stated as an existing rule in this wave's brief | **NOT FOUND** in `docs/`, `CLAUDE.md`, `AGENTS.md`, `tasks/lessons.md`, `backend/src`, `frontend/src` under any phrasing — independently re-grepped by review R1. It is de-facto (three hard-coded `approvedDockets: 0` producers feeding a `blocksAction: false` support item) and the one contrary doc statement runs the other way (`docs/product/pilot-journeys.md:354-355`). **DC5-4.** |
| Program line 79's *"dockets"* means CIVOS's `Docket` | The natural reading | **It means the supplier's delivery docket.** `DailyDocket` is a labour/plant timesheet with **twenty** scalar columns and no supplier, material, quantity, batch or attachment (`backend/prisma/schema.prisma:1461-1497`, scalars `:1462-1481`). The record described is `DiaryDelivery` (`:1253-1273`). §0.4. |
| **`DiaryDelivery` is writable whenever someone needs to attach evidence** | Implied throughout Rev 1 (§4.4, §4.6, §7.2, AT-177) | **FALSE, and it was the hole in the wave.** All three delivery mutations pass `requireEditableDiaryForWrite` (`diaryAccess.ts:92-123`), which refuses `status === 'submitted'` (`:114-116`) and `lockedAt` (`:118-120`). The freeze starts at **submit**, not at the 7-day auto-lock — `requireEditableDiaryForWrite` never calls `isDiaryLocked` (`:37-48`). §4.4a is Rev 2's answer. `[C5R-B2]` |
| **`Document.version` / `parentDocumentId` / `isLatestVersion` are unused; C5 is their first consumer** | Rev 1 §4.3, §16 item 5, §18.2 item 2 | **FALSE.** Seventeen production consumers across nine backend files plus frontend UI and three tests — enumerated in §4.3. `revisionTokens.ts:49-50` makes `document` the only `FolioSourceType` with real version tracking, and both `folio/assemble.ts:288` and `handoverExports/snapshot.ts:99` depend on it. Rev 1's instruction to hand-write version rows would have opened a second write path over columns `deleteRoutes.ts:125-181` already assumes invariants about. `[C5R-B4]`, `[C5S-i]` |
| **The three shipped document guards do not concern C5** | Rev 1 never mentioned them | **FALSE.** `EVIDENCE_LINK_GUARDS` (`evidenceLinkGuards.ts:25-69`) says in its own header that the next evidence table is *"a single entry"* (`:11-13`); C5 adds two evidence links and Rev 1 extended none of the three mechanisms. Without them, generic versioning strands C5's FKs on superseded files and generic delete returns a bare 422. §4.3, `[C5S-B9]`, `[C5R-B3]` |
| The §7.3 matrix's subcontractor delivery row is buildable | Rev 1 §7.3 footnote | **FALSE** in two directions — no portal mechanism for deliveries exists, and `requireInternalProjectAccess` hard-rejects portal roles before scoping. Row deleted, recorded as **DC5-5**. `[C5R-B5]` |
| `NON_SUBSTANTIVE_EDIT_FIELDS` is "a shared list" | Rev 1 §2.3c, §18.2 item 4 | **FALSE.** It is declared inside the PATCH handler at `crudRoutes.ts:394-398` and nothing imports it. C5.2 must export its own. `[C5R-A1]` |
| C5 feeds D2 asset records | Program line 79 | **The receiver was deleted.** `docs/research/d0-adac-handover-research-2026-07-28.md` kills the D2 XML limb on two independent grounds. The program line should be amended. |
| Imported certified geometry must be immutable and versioned | Program line 86 | **True, and C5 v1 satisfies it by holding none.** No spatial table in the tree is versioned or immutable today; all three have live `PATCH`/`DELETE`. |
| The CRS layer is fit for certified survey data | — | **No, and it says so itself** (`crs.ts:5-21`). But the risk is **mixed or unknown datums in a comparison**, not any use of `localToWgs84` — canonical storage is local grid as entered (`:8-10`). `[C5S-B6]` restated, `[C5R-A8]`. |

### 18.2 Observations for whoever builds this — none blocking

1. **`diary_deliveries` has no `@@index` at all** — not on `diaryId`, not on `lotId`. The `@@unique([diaryId, requestKey])` (`schema.prisma:1272`) is the only usable index, and its `diary_id` lead is what the register's join rides. §5.1 adds `lot_id`; do not drop it from the migration to make the diff smaller, and do not add a bare `supplier` index in its place (`[C5R-A9]`).
2. **`assertDocumentCanUseGenericVersioning` (`versionRoutes.ts:56-82`) is a hand-written check that does not read `EVIDENCE_LINK_GUARDS`.** So "adding the next evidence table is a single entry" (`evidenceLinkGuards.ts:11-13`) is true for delete and metadata and **false for versioning** — C5 adds two table entries *and* two hand-written conditions. Unifying them is a genuine cleanup worth about twenty lines and it is **not C5's**: it would change refusal behaviour for ITP and NCR documents, which is C4's blast radius, not this wave's.
3. **The certificate-replacement path deletes the prior `Document`** (`backend/src/routes/testResults/certificateAttachment.ts:210`, storage object at `:225`). It is a real evidence-integrity defect, it is **C4's**, and it is recorded here so it is not discovered a third time. Do not fix it in a C5 PR.
4. **`hasSubstantiveEdit` iterates every key of the update object** (`crudRoutes.ts:399-401`). C5.2 copies the shape with its own **exported** const (`[C5R-A1]`), and §4.4a inverts it — a `.strict()` whitelist schema rather than an exemption list — because a new-route body is the one place you can have the strict form for free.
5. **`DELETE /api/diary/:diaryId/deliveries/:deliveryId` writes no audit log** (`diaryItems.ts:327-332` — a bare `deleteMany`). Every other diary lifecycle mutation audits. Not C5's to fix (C5 adds no delete path), but if a delivery carrying a docket is ever deleted, there is no record of who did it. Worth a diary-owned ticket.
6. **`sample_location_source` is a hard `CHECK`, not a lookup table** (`backend/prisma/migrations/20260729000000_test_sample_point/migration.sql:29-31`). If C5.5 ever lands an imported survey position, admitting its provenance value is a migration — and the schema comment at `schema.prisma:970-972` already forbids overloading `'gps'`.
7. **There are twelve independent multer configurations and no shared upload router.** `[C5S-B8]` exists partly so C5 does not become the thirteenth — and after `[C5R-A6]`, C5 adds no upload route at all, so the count is unchanged. Exit gate item 9 asserts it.
8. **`fast-xml-parser` is declared but not installed in a fresh worktree** (`backend/package.json:69`; no `backend/node_modules/fast-xml-parser`). Whoever discharges RG-9 must `npm ci` in `backend/` first, or they will conclude the parser is absent.

---

## 19. Rev 2 review disposition — every tag from review R1

**Method.** Every `file:line` the review cited was re-opened at `1e6ed156` before its claim was encoded. The review's own line numbers were treated as claims, not as facts — five were off by a few lines and two of its assertions are **refuted below with evidence**. Where a review claim and the tree disagreed, the tree won.

### Blockers — all five folded

| Tag | Disposition |
| --- | --- |
| **`[C5R-B1]`** | **FOLDED.** The review is right and the failure mode it names (a green test written against the constraints that exist) is the likelier one. `survey_records_accepted_requires_actor_check` added to §5.2; `[C5S-B1]` in §0.3 and §6 restated around it; **AT-172 rewritten** to name each constraint and to assert case (a) — the exact row Rev 1's two constraints permitted — by raw SQL. |
| **`[C5R-B2]`** | **FOLDED as a full design, §4.4a** — the route shape, `.strict()` body schema, route-local `DELIVERY_EVIDENCE_EDITORS` const, `requireEffectiveProjectRole(..., { requireWritable: true })` (**not** `requireInternalProjectAccess`, which does not check archived projects — `projectAccess.ts:205-207` vs `:212-231`), hard-fail `writeAuditLogInTransaction` payload including the diary's lock state, a worked edge-case table, the offline interaction, a permission-matrix row, `[C5S-B10]`, `[C5S-j]`, and AT-184/AT-185. **One correction to the review's framing:** it attributes the freeze to the 7-day auto-lock, but `requireEditableDiaryForWrite` never calls `isDiaryLocked` (`diaryAccess.ts:37-48`) — the `status === 'submitted'` check at `:114-116` fires first. The problem is **worse** than reported: the window is hours, not days. Also folded: §1.2 non-goal, §7.1 (the `PUT` is explicitly *not* extended), §7.2, §10 (C5.1 resized S/M → M), §12, §14 item 4, §16 item 3, §17 item 12, §18.1. |
| **`[C5R-B3]`** | **FOLDED**, §4.3's three-entry table with the exact `EvidenceLinkGuard` shape from `evidenceLinkGuards.ts:14-23`, plus `[C5S-B9]`, exit-gate item 10, AT-186 and AT-187. **One substantive correction:** the review says "one `EVIDENCE_LINK_GUARDS` entry per new link, an entry in `assertDocumentCanUseGenericVersioning`, ~30 lines". `assertDocumentCanUseGenericVersioning` (`versionRoutes.ts:56-82`) is a **hand-written check that does not read the guard table**, so C5 owes two table entries **and** two hand-written conditions — the "single entry" promise in `evidenceLinkGuards.ts:11-13` does not cover versioning. Recorded as §18.2 item 2. |
| **`[C5R-B4]`** | **FACTUAL CORE FOLDED IN FULL; PRESCRIPTION PARTIALLY REFUTED.** Folded: Rev 1's "used by nothing / C5 is their first consumer" is false — §4.3 now enumerates all seventeen production consumers; §16 item 5 **deleted**; §18.2 item 2 replaced; §18.1 carries the correction row. **Refuted:** the review's fix — *"C5 calls the shipped route, gated per `[C5R-B3]`'s guard entries"* — is self-cancelling and impractical. (i) `[C5R-B3]`'s versioning entries make `POST /api/documents/:id/version` **refuse C5 documents by construction** (`versionRoutes.ts:75-81`), so C5 cannot both gate it and call it. (ii) The versioning logic is inline in a multer Express handler spanning `versionRoutes.ts:102-249`, with a `FOR UPDATE` row lock (`:191`) and three concurrency tests against it (`documents.test.ts:2156`, `:2200`, `:2267`); extracting a callable service is a refactor of a shipped path and larger than this wave. **Rev 2's answer, `[C5S-i]`:** C5 versions no `Document` at all — record-level supersession for surveys, an audited FK re-point for delivery dockets — which needs no new write path over the three columns and satisfies the review's actual concern (no divergent second writer) more completely than calling the route would. Flip condition recorded. |
| **`[C5R-B5]`** | **FOLDED, both parts.** (a) The subcontractor read row is **deleted** from §7.3 — verified independently: the portal module vocabulary is a closed six with no diary/delivery key (`projectAccess.ts:7-13`, `:382-391`), `DiaryDelivery` has no production consumer outside `backend/src/routes/diary/`, and `requireInternalProjectAccess` rejects portal roles at `:217-219` and `:226`. Recorded as **DC5-5**. *Minor line correction:* the pre-scoping reject is `:217`, not `:215` (`:215` is a default parameter). (b) `quality_manager` is confirmed absent from `DIARY_WRITE_ROLES` (`diaryAccess.ts:19-26`); Rev 2 takes the route-local-const option — `DELIVERY_EVIDENCE_EDITORS` on the §4.4a route — and **does not widen `DIARY_WRITE_ROLES`**, with the matrix row footnoted accordingly. AT-185(a). |

### Amends — eight folded, one folded with a correction, one two-thirds refuted

| Tag | Disposition |
| --- | --- |
| **`[C5R-A1]`** | **FOLDED.** Verified: the const is declared inside the PATCH handler at `crudRoutes.ts:394-398`, and the only other repo hits are prose (`validation.ts:184`) and a comment (`testResults.test.ts:5412`) — nothing imports it. §2.3c restated, §4.5 and AT-174 require C5's own **exported** const, §18.2 item 4 rewritten. |
| **`[C5R-A2]`** | **FOLDED.** Verified: `statusWorkflow.ts:17-22` records the additive widening in the exact words quoted, and `:28` gives `requested` three outbound edges. §4.5 ships `requested → received` and `requested → accepted`, plus creation at an explicit non-default status; AT-173 extended. |
| **`[C5R-A3]`** | **FOLDED.** Verified: the `drawingNumber` check is at `drawings.ts:56-60` (the review's "~:52-56" is off by four; the function ends at `:65`, not `:63`). C5's guard enforces five checks including **same lot and same kind**; a reference column was considered and rejected. §2.3a, §4.5, §7.1, AT-175. |
| **`[C5R-A4]`** | **FOLDED.** Verified: `requireLotInProject(data.lotId, diary.projectId, tx)` at `diaryItems.ts:255` (POST) and `:289` (PUT — the review said `:285`, which is a param parse). §7.1 (`project_id` derived from the lot, never the body), §8 row 3, §4.4a step 3, AT-176(f). |
| **`[C5R-A5]`** | **FOLDED.** Verified: `assertBelongsToLot` is at `folio/access.ts:72-80` (not `:62-79`) and its row type at `:73` is `{ projectId: string; lotId: string }` — `lotId` non-nullable. §8 states the `lotId === null` rule for both route shapes and narrows at the call site rather than adding a helper; AT-176(g). |
| **`[C5R-A6]`** | **FOLDED.** Twelve multer configs re-counted at `1e6ed156`. `POST /api/surveys/:id/report` now takes `{ documentId }`; "(upload)" dropped; §8 and `[C5S-B8]` updated; exit-gate item 9 asserts the count stays at twelve. |
| **`[C5R-A7]`** | **FOLDED, with a count correction.** The guard is at `projects/writeRoutes.ts:683-729` (not `:684-706`) and enumerates **fifteen** `_count` relations (`:688-702`) plus two computed (`:712-721`), not sixteen. `drawings` and `dailyDiaries` are both present, so the review's substance holds: deliveries are covered transitively, surveys are not. `surveyRecords` joins the `_count`; §8, §10 (C5.2), AT-188. |
| **`[C5R-A8]`** | **FOLDED.** Verified: `crs.ts:8-10` does state local grid as canonical with WGS84 derived and cached; the datum statement is `:13-16` and the ponytail upgrade line `:18-20` (comment block `:5-21` — the review's `:13-20` and Rev 1's `:12-20` are both partial). `[C5S-B6]` restated as *no cross-datum comparison and no absolute-position claim*, rather than a blanket ban on `localToWgs84` (`:78`). §1.2, §2.2, §3.2, §6, §18.1. |
| **`[C5R-A9]`** | **FOLDED.** Verified: `DiaryDelivery` has no `project_id` and — beyond what the review found — **no declared `@@index` at all**; `@@unique([diaryId, requestKey])` is at `schema.prisma:1272`. `diary_deliveries_supplier_idx` **deleted** from §5.1 with a flip condition; §9's target now names the `diary_id`-leading unique index as what it rests on; §18.2 item 1. |
| **`[C5R-A10]`** | **TWO-THIRDS REFUTED.** (i) *"`'Material Delivery'` is `classificationRoutes.ts:46`, not `:47`"* — **wrong.** At `1e6ed156` the array runs `:44-57` with `'Survey'` at `:45`, `'Compaction'` at `:46` and **`'Material Delivery'` at `:47`**. Rev 1 was correct. (ii) *"`DailyDocket` has 21 scalar columns, not twenty"* — **wrong.** Scalars are `:1462-1481`, twenty of them; the six relation fields (`subcontractorCompany`, `project`, `labourEntries`, `plantEntries`, `diaryPersonnel`, `diaryPlant`) are excluded. Rev 1 was correct. (iii) *"the `crs.ts` comment is `:13-20`"* — **partially right**; the comment block is `:5-21`, and Rev 2 cites the precise sub-ranges (§18.1, `[C5R-A8]`). Both refuted items are recorded here rather than silently ignored, per the standing rule that a reviewer's evidence is verified before it is encoded. |

### Notes — all six folded

| Tag | Disposition |
| --- | --- |
| **`[C5R-N1]`** | **FOLDED.** RG-9 restated in §3.1 as an **entity-expansion / parser-DoS** question rather than XXE, with the 20 MB bound at `alignmentFileImport.ts:14` named as the only current limit, the two OOXML configs (`excelParser.ts:154`, `:157-162`; `wordParser.ts:176-183`) recorded as sharing the exposure **today**, the one hostile-fixture test kept, and the install caveat added (§18.2 item 8). |
| **`[C5R-N2]`** | **FOLDED.** §9 now records that the ceiling is **per lot** (`assemble.ts:326`, `:336-360`) against a reference dataset sized per *project* (`:43-50`), and §16 item 4 carries the wrinkle: the refusal text is *"Split the lot or contact support."* (`:374-376`), which a user cannot act on if the overflow came from deliveries they did not file. |
| **`[C5R-N3]`** | **FOLDED**, §12 — plus a finding the review did not make: the delete is a bare `deleteMany` that writes **no audit log** (`diaryItems.ts:327-332`), recorded as §18.2 item 5. |
| **`[C5R-N4]`** | **FOLDED**, §4.4a's edge-case table and §7.2. Re-verified: one `delivery_save` queue type (`offline/core.ts:141`), one enqueue with `action: 'create'` hard-coded (`diaryQuickAdd.ts:225-231`), one always-POST executor (`syncWorker.ts:479`), fixed seven-field body plus `requestKey` (`:494-511`). The review's *"the offline-captured delivery is exactly the one needing later evidence edits"* is stated in the spec. Rev 2 adds the standing constraint the review implied: `lotId` **is** in the offline body, so `createDiaryItemOnce` must stay create-only or a delayed sync would clobber a later link — AT-185(d). |
| **`[C5R-N5]`** | **FOLDED**, §5.2's closing paragraph — an explicit DB-enforced vs route-only split with the reason for each, and the rule that DB constraints are asserted by raw SQL (AT-172) because a route-level test of a `CHECK` proves nothing about the `CHECK`. |
| **`[C5R-N6]`** | **FOLDED**, §11 — the parse is spelled out verbatim in the `readinessSnapshotsEnabled()` shape (`recordDecision.ts:236-239`) with the header comment's mandate quoted and the `!== 'false'` inversion named as the thing to avoid. |

### The review's own line-number drift, recorded

Not weighted against the review — its substance held everywhere it mattered — but recorded so a future reader does not re-derive the same corrections: `diaryItems.ts` delivery handlers are `:254`/`:288`/`:327` (not `:255`/`:281`); `requireEditableDiaryForWrite` spans `:92-123`; `isDiaryLocked` `:37-48`; `projectAccess.ts` pre-scoping reject `:217` (not `:215`); `drawings.ts` guard `:36-65` with the identity check `:56-60`; `folio/access.ts` `assertBelongsToLot` `:72-80`; `evidenceLinkGuards.ts` array `:25-69` with the entry type `:14-23`, delete guard `:102-116`, metadata guard `:120-133`; `versionRoutes.ts` versioning guard `:56-82`; `deleteRoutes.ts` chain repair `:124-182`; `assemble.ts` refusal `:369-380`; `accountPrivacyRoutes.ts` `version` at `:400`; `errorHandler.ts` P2003 block `:319-327`; `projects/writeRoutes.ts` retention guard `:683-729`. `READINESS_REASON_CODES` entries are bare string literals, not objects.

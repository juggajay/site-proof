# Wave C3 Execution Specification — the map shows the testing, and the LIMS format has never been read

**Date:** 28 July 2026 · **Rev 1** · **Status:** implementation-ready for Phases A and B. **Phase C (LIMS) is BLOCKED on a research pass and is deliberately under-specified below** — see §3.

**All `file:line` citations were re-opened in this worktree at HEAD `a21cb3c7f3e1f84941abc37d302e2bae5d6a5ebe`** (= `origin/master`, `feat(importer): B3 — Word ITP import (#1638)`). Nothing in this document is carried forward from a sibling spec without being re-derived; the citations that had moved are listed in §18.

**Program contract:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` §3 Wave C, **line 77** (*"C3. Spatial + LIMS: tested/under-tested map overlay; TfNSW LIMS tabulated ingestion; controlled overrides (selectable spec regimes + audited free override)"*), §7 line 134 (threat-model gate), §8 lines 138–146 (performance targets), §9 line 149 (execution-spec requirement).

**Parent specs, read not remembered:**
- `docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md` (Rev 2.2) — C3 is named there as the owner of the spatial limb at **line 151**, **line 957** (*"No spatial coverage check … C3 (program line 77) restores it"*), **line 1092** (*"Register column / map overlay: OUT … the overlay is C3"*), **line 1127** (per-lot waiver = a C3 controlled override) and **line 1362** (the dropped chainage clause).
- `docs/plans/wave-c2-test-lifecycle-spec-2026-07-28.md` (Rev 2, shipped #1636/#1637) — **§5.4 `[C2L-B4]`, line 464**: *"No LIMS, in any form … The first PR in any wave that touches LIMS reads that document first and records a research pass."* This spec is that wave. §3 discharges the obligation by **not** discharging it.
- `docs/plans/wave-b-migration-importer-spec-2026-07-26.md` — **line 371**: `ImportBatch.kind` reserves `'test_register'`, parked until *"the Wave C sample/test lifecycle model is final"*. C2 §13.1 J1 made it final. §6.1 collects the debt.
- `docs/plans/spatial-lot-map-spec-2026-07-13.md` — the shipped map program (Phases 0–5). **Line 154** already named *"Test-result spatial context"* as Phase 4 work; what shipped is a **lot** geometry thumbnail, not a test location (§2.3).

**House style** matches the C1, C2, D14, F1 and sync-centre specs: numbered sections, an explicit non-goal disposal of every clause of the program line, a decision register with flip conditions, per-phase rollback, named acceptance tests continuing the shared series, an exit gate.

**Tag namespace.** `[C3S-*]` (C3 **S**patial) for this spec's own decisions, `[C3S-B*]` for blockers it must not violate. `[C1C-*]`, `[C1R-*]`, `[C2L-*]`, `[C2R-*]`, `[D14R-*]`, `[D14X-*]`, `[F1C-*]` and `[WBR2-*]` are taken; `[C1R-C3]` already exists (`wave-c1-test-sufficiency-spec-2026-07-26.md:849`), and `C3-` is a live SA DIT spec-number fragment throughout `docs/research/sa-dit-*.md`. **Never use a bare `C3` tag.**

**Ponytail note.** Two of this wave's three limbs need almost no code. The tested/under-tested overlay needs **zero new data and zero new engine** — the verdict it wants is already computed per lot by C1 and already batchable in constant queries (§2.4), and the map already knows how to recolour lots from a derived map (§2.1). The test pin needs **two nullable columns and one existing route parameter** (§5). The third limb — LIMS — needs a research pass nobody has done, and the honest answer to "how much code" is *unknown, and unknowable until someone opens the PDF*. This document ships the two that are real and refuses to design the third from a document title.

---

## 0. What this slice is, and what it deliberately is not

### 0.1 The one-paragraph version

A quality manager can open the lot map, turn on **Testing**, and see at a glance which lots have enough verified tests, which are short, and which CIVOS has no rule for — using exactly the verdict the lot page already shows, never a second number. Where a sample's location was actually captured, the test appears as a **pin** at that location; where it was not, the test appears in a count of unlocated tests and **nowhere on the map**, because CIVOS does not know where it was taken and will not guess. And lab data files continue to arrive the way they arrive today — one certificate at a time, read by a human — until someone has read the TfNSW LIMS specification and can say what a LIMS file actually contains.

### 0.2 The scope cut, stated honestly

| Program line 77 clause | Disposition |
| --- | --- |
| *"tested/under-tested map overlay"* | **IN — Phase A.** Ships first. No migration, no new data. |
| *"TfNSW LIMS tabulated ingestion"* | **BLOCKED — Phase C.** §3 is a research gate, not a design. No code, no schema, no `kind` registration until the confirmation pass lands. |
| *"controlled overrides (selectable spec regimes + audited free override)"* | **OUT of C3 v1 — recommended split (J4).** §1.3. It is a rule-authoring feature, not a spatial or ingestion one, and it needs the F0 `RequirementDefinition`/`ExceptionOrWaiver` model that does not exist. |
| *(inherited)* C1's dropped chainage sentence — *"no sample for CH 1,240–1,310"* | **NOT delivered in v1**, and §5.7 says so plainly. Phase B supplies the coordinate that sentence needs; the sentence itself needs a spatial-coverage rule limb no shipped pack declares. |

**Phase B (test pins) is the only phase with a migration.** It is additive, nullable, and named loudly in §7.

### 0.3 The honesty rule this whole wave turns on `[C3S-B1]`

**A location on a test record is evidence. CIVOS never writes one it did not receive from a human or an instrument.**

Concretely, and enforced by AT-84/AT-85: no lot-centroid fallback pin, no parse of `sampleLocation` free text into a coordinate, no AI-proposed coordinate written without confirmation, no coordinate inferred from the lot's chainage. A test with no captured location is displayed as *"no location captured"* — a fact — and not as a dot in the middle of a lot, which is a claim.

---

## 1. Outcome, scope and non-goals

### 1.1 Outcome

1. **The map answers "where is the testing short?"** using `SufficiencyEvaluation.state` (`backend/src/lib/readiness/sufficiency/evaluate.ts:60-62`) — the same three-valued verdict (`satisfied` | `insufficient` | `unknown`, `types.ts:408`) the lot page already renders. One definition, two surfaces.
2. **A test that was located shows where it was taken.** Captured on purpose, by a person, with the same GPS primitives the ITP and photo flows already use.
3. **Nothing about testing gets automatically decided.** The overlay is a view; it turns no gate on, changes no count, and writes nothing. Verification remains `TEST_VERIFIERS` (`backend/src/routes/testResults/accessControl.ts:41`).
4. **The LIMS question is answered honestly** — with a research deliverable, not a feature.

### 1.2 Non-goals (explicit — do not build in C3 v1)

- **No new map engine, no new tile provider, no new rendering library.** Leaflet + react-leaflet 4 (`frontend/package.json:50`, `:58`), MapTiler satellite / OSM (`LotMapView.tsx:1189-1208`). No bulk tile prefetch may be added — the licence caps are test-enforced (`frontend/src/lib/pwaRuntimeCaching.test.ts:75-80`, licence note `pwaRuntimeCaching.ts:6-10`).
- **No live laboratory integration.** No lab API client, no polling, no credentials for a lab system, no outbound submission. The only evidence CIVOS holds on lab connectivity is grade **B** and self-caveated (§17).
- **No auto-verification, ever.** No import, no extraction and no map action may move a `TestResult` to `verified`. That transition has one guard and it stays (`workflowRoutes.ts:210`, `:309`).
- **No second sufficiency engine, no cached verdict column, no recalculation job.** `[C3S-B2]`, inherited from `[C2L-B3]`.
- **No new count semantics and no snapshot change.** `[C3S-B3]` / `[C3S-B4]`, inherited from `[C2L-B1]` / `[C2L-B2]`.
- **No editing of a verified test's location without an audit row.** §5.6.
- **No `Sample` entity, no `Laboratory` entity, no accreditation model.** C2 §13.1 J1 settled the first (final: `TestResult` **is** the sample record); the rest are C4 (program line 78).
- **No controlled overrides / tenant-authored rulesets.** §1.3, J4.
- **No spatial coverage RULE.** The engine gains no spatial limb; `requiredTestCount` (`counts.ts:49-59`) is untouched.

### 1.3 Why "controlled overrides" is not in this wave

Program line 77 bundles three things that share a wave number and nothing else. The first two are about *where tests are and whether there are enough*; the third is about *who may change the rule*. Concretely it needs: a place to store a tenant-selected regime (C1 deliberately made rulesets **shipped code**, not tenant data — `wave-c1-test-sufficiency-spec-2026-07-26.md:260-262`), an override record with reason/authority/scope/expiry (that is F0's `ExceptionOrWaiver`, `CIVOS-Validated-Buildout-Plan-2026-07-24.md:36` — **NOT FOUND** in `backend/prisma/schema.prisma`), and an audit surface for it. C1 already routes the per-lot waiver question here (`:1127`) and already ships the escape hatch it replaces (force-conform).

**Recommendation (J4): split it out as its own spec, sequenced after F0's definition model exists.** Building an override table inside a map-and-import wave would be the third place this program has invented a definition store ahead of F0.

---

## 2. Current-state map (read at `a21cb3c7`)

### 2.1 The spatial stack that ships

Eighteen PRs (#1413–#1431) plus two polish waves (#1433–#1438, #1444–#1446); closed and live-verified (`docs/agent-handoff.md:687-739`).

| Thing | Where |
| --- | --- |
| The map | `frontend/src/pages/lots/map/LotMapView.tsx` (1,376 lines). `<MapContainer>` `:1173-1327`; base layers `:1188-1208`. |
| Hosts | `frontend/src/pages/lots/LotsPage.tsx:54` (lazy) `:460-478`; foreman shell `frontend/src/shell/screens/lots/LotMapScreen.tsx:28-30`, `:102-109`. |
| Lot polygons | `LotGeometryLayer` `LotMapView.tsx:258-312`; colour from `getStatusColor(g.status)` (`frontend/src/components/lots/linearMapViewHelpers.ts:53-54`, palette `:37-46`, legend `:48-51`). |
| Photo pins | `PHOTO_PIN_ICON` `LotMapView.tsx:104-115`; `PhotoPin` `:317-346`; armed toggle + `localStorage` key `siteproof.mapPhotos.${projectId}` `:547-561`; viewport refetch debounced 600 ms `:678-689`; render `:1238-1249`. **This is the template a test-pin layer copies.** |
| Toolbar | `ToolbarButton` `:479-517`; the eight buttons `:1060-1131`; five mutually-exclusive tools `:708-760` (**Photos is deliberately not in that set** `:556-561`). |
| Geometry | `LotGeometry` `backend/prisma/schema.prisma:485-505` — `geometryWgs84 Json` `:494` (GeoJSON Feature), `areaM2 Decimal?` `:495`, `kind` `:488` (`chainage_offset`\|`drawn`\|`point`), `@@index([lotId])` `:503`. `ControlLine` `:466-483`, `PlanSheet` `:517-539`. |
| Read routes | `GET /api/projects/:projectId/lot-geometries` `backend/src/routes/projectLotGeometries.ts:62-106`; `GET /api/projects/:projectId/lots/status-timeline` `backend/src/routes/lotStatusTimeline.ts:46-116`; `GET /api/projects/:projectId/coverage` `backend/src/routes/projectCoverage.ts:127-212` (**internal-only**, `requireInternalProjectAccess` `:131`); `POST /api/projects/:projectId/spatial-search` `backend/src/routes/spatialSearch.ts:61-202`. |
| Timeline scrubber | `frontend/src/pages/lots/map/HistoryPanel.tsx:33-95`; wiring `LotMapView.tsx:585-587`, `:749-760`, `:1122-1130`. |
| Offline stage 1 | `frontend/src/lib/pwaRuntimeCaching.ts` — tiles `:18-19`/`:47` (1,500 entries, 30 d), plan rasters `:24-25`, map data `:32-33` NetworkFirst (80 entries, 7 d). `spatial-search` and `coverage` are **not** cached (POST / not in `MAP_DATA_URL`). Authed caches cleared on sign-out, `frontend/src/lib/auth.tsx:139`. |
| Cap enforcement | `frontend/src/lib/pwaRuntimeCaching.test.ts:75-80` — *"every rule has bounded entries and age"*. `RESULT_CAP = 500` `spatialSearch.ts:40`. **NOT FOUND:** any per-tenant MapTiler request metering in app code. |

**The recolour pattern, which Phase A reuses verbatim.** History mode does not touch `LotGeometryLayer`. It derives a `Map<lotId, status>` (`frontend/src/pages/lots/map/statusTimelineData.ts:97-108`) and rebuilds the geometry array in a memo — `out.push(status === g.status ? g : { ...g, status })`, `LotMapView.tsx:880-889` — then renders `displayGeometries` instead of `filteredGeometries` (`:1230-1236`). Lazy fetch behind an armed toggle, 5-minute `staleTime`/`cacheTime` (`statusTimelineData.ts:38-39`).

### 2.2 The test row, and what it knows about *where*

`backend/prisma/schema.prisma:857-912`. The fields C3 cares about:

| Line | Field | Note |
| --- | --- | --- |
| 860 | `lotId String?` | Nullable; `onDelete: SetNull` `:898`. A test may have no lot at all. |
| **867** | **`sampleLocation String?`** | **Free text.** Max 500 chars (`backend/src/routes/testResults/validation.ts:20`). Nothing parses it. |
| 870 | `resultValue Decimal?` | **One scalar per row.** A multi-parameter lab result is N rows, not one. |
| 875/877 | `passFail` / `status` | |
| 880-881 | `verifiedById` / `verifiedAt` | |
| 885/888 | `sentToLabAt` / `expectedResultDate` | C2 Phase 3, shipped (#1637). |
| 892-893 | `aiExtracted` / `aiConfidence` | |

Indexes `:906-910`: `[projectId]`, `[projectId, status]`, `[lotId]`, `[projectId, passFail]`, `[enteredById, createdAt]`.

**NOT FOUND on `TestResult`:** any latitude, longitude, easting, northing, chainage or geometry field. The only coordinate-bearing models in the schema are `Project` (`:386-387`), `ITPCompletion.gpsLatitude/gpsLongitude` (`:728-729`, both `Decimal?`) and `Document.gpsLatitude/gpsLongitude` (`:1589-1590`, both `Decimal?`, written from EXIF by `extractImageMetadata`, `backend/src/routes/documents.ts:164-230`). **Those two pairs are the column precedent Phase B copies.**

**`sampleLocation` is worse than merely unstructured — part of it is machine-guessed.** `inferLocationFromFilename` (`backend/src/routes/testResults/certificateExtraction.ts:62-73`) regexes a chainage out of an uploaded file's *name* and emits e.g. `"CH 100+20"` at confidence **0.4**, on the degraded path taken whenever the AI call fails or no API key is configured (`:75-80`, `:243-245`). The shipped fixtures show three mutually incompatible conventions in the same field — `'CH 100-120 LHS'` (`frontend/src/lib/pdf/__tests__/fixtures/testCertificateFixture.ts:11`), `'CH 1234+50'` (`frontend/src/pages/tests/certificateReview.test.ts:54`), `'CH 100.000'` (`frontend/src/pages/tests/components/EnterResultsModal.test.tsx:43`) — and the form's own placeholder invites a fourth (*"e.g., CH 1000+50, 2m LHS"*, `frontend/src/pages/tests/components/CreateTestModal.tsx:324`). **Any coordinate derived from this field would be a guess built on a guess.** §5.1.

### 2.3 How a test reaches the map today

Only through its lot. `POST /api/projects/:projectId/spatial-search` (`backend/src/routes/spatialSearch.ts:61-202`) intersects **lot geometries** with the drawn box (`:119-137`), then loads test results **for those lots** (`:170-191`, `select { id, status, lotId, testType, testRequestNumber }` `:178-184`). The file says so in its own header: *"the test results for those intersecting lots"* (`:5-6`). Results render as list rows in `frontend/src/pages/lots/map/FindByAreaPanel.tsx`, never as map features.

The spatial spec's *"Test-result spatial context: lot geometry thumbnail on test request/cert detail"* (`docs/plans/spatial-lot-map-spec-2026-07-13.md:154`) shipped as exactly that — **the lot's** outline (`frontend/src/pages/lots/map/geometrySvg.ts`), not the test's location.

**NOT FOUND:** any location-capture control on any test surface. `CreateTestModal.tsx:318-325` is a plain text `<Input>`; `useGeoLocation` and `useLotAtMyLocation` appear nowhere under `frontend/src/pages/tests/`.

### 2.4 The verdict Phase A wants already exists, and is already batchable

- **Per lot:** `GET /api/lots/:id/readiness` (`backend/src/routes/lots/qualityRoutes.ts:270`) and `GET /api/lots/:id/conform-status` (`:369`) both return `sufficiency` (`:84`, `:351`).
- **For many lots in constant queries:** `checkConformancePrerequisitesBatch(lotIds, client, options)` — `backend/src/lib/conformancePrerequisites.ts:811`. Sufficiency for the whole set is resolved in **one pass** via `resolveSufficiencyBatch` (`:879`, definition `backend/src/lib/readiness/sufficiency/resolve.ts:215`); the comment at `:856-868` records the guarantee: *"one `lot.findMany`, at most one `holdPoint.findMany`, at most one legacy-checklist `findMany`"*, and with a fetcher *"at most ONE grouped query per distinct STREAM — never one per member, which a per-lot loop would have made 5,000 reads"*.
- **The value itself:** `SufficiencyEvaluation.state` — *"Worst state across rules; `unknown` when no rule resolved"* (`evaluate.ts:60-62`); `SufficiencyState = 'satisfied' | 'insufficient' | 'unknown'` (`types.ts:408`); per-rule counts on `RuleSufficiency` (`types.ts:435-442`: `requiredCount`, `passingCount`, `pendingCount`, `failedCount`); lot-level causes `unknownCauses` (`evaluate.ts:81`, vocabulary `types.ts:410-417`).
- **What counts:** `testPassing = passFail === 'pass' && status === 'verified'` (`backend/src/lib/readiness/predicates.ts:162-164`). Phase A displays this and changes none of it.

**The trap, named before anyone falls in it `[C3S-B5]`.** The regime fold is optional. `checkConformancePrerequisitesBatch` called **without** `options.regimeFetcher` evaluates every rule at regime `full` (the safe, over-testing direction — `resolve.ts:327-329`), while the lot readiness route passes `prismaRegimeStreamFetcher` (`backend/src/routes/lots/qualityRoutes.ts:12`). A Phase A route that omits the fetcher would show a lot as `insufficient` that its own lot page shows as `satisfied`. **The overlay route MUST pass the same fetcher the lot page passes.** AT-82 asserts equality against the lot page, which is what makes this mechanically impossible to get wrong twice.

### 2.5 The import envelope that ships, and the slot reserved for exactly this

`ImportBatch` `backend/prisma/schema.prisma:2037-2074`. `kind` at `:2041` carries the reservation in the schema comment itself (`:2039-2040`): *"'itp_template' | 'lot_register' (open set; **'test_register' is RESERVED and deliberately unimplemented until the Wave C sample/test model is final**)"*. `status` `:2043` (`uploaded|parsed|mapped|dry_run|review|applied|rolled_back|cancelled|failed`), `sourceFormat` `:2046` (**`'excel' | 'pdf' | 'word'`**), `parseResult Json` `:2057`, `dryRun Json` `:2058`, `proposal AiProposal?` `:2068`, indexes `:2072-2074`.

Apply and rollback ride `AiProposal` (`:2002-2028`), whose `appliedRecordIds` (`:2015`) is the rollback target and whose `importBatchId` is `@unique` (`:2020`) — one batch, exactly one proposal.

The extension points, all four of them:
- `IMPORT_KINDS` registry — `backend/src/routes/copilot/import/importKinds.ts:157-160`, with the doc comment at `:162-163`: *"`test_register` is RESERVED and deliberately unimplemented … it resolves to nothing here on purpose."* Unknown kind → `IMPORT_KIND_UNSUPPORTED`, `:164-173`.
- `TARGETS_BY_KIND` field-map allow-list — `backend/src/routes/copilot/import/mappingProfiles.ts:55-58` (no `test_register` entry); enforced at save **and** apply by `assertAllowedFieldMap` `:87-125`.
- `DryRunRow.unit: 'template' | 'checklist_row' | 'lot'` — `backend/src/routes/copilot/import/dryRunTypes.ts:55`.
- Frontend `type ImportKind = 'itp_template' | 'lot_register'` — `frontend/src/pages/projects/copilot/importData.ts:8`.

**The ledger already supports the shape a LIMS file needs.** `DryRunOutcome` includes `'update'` (`dryRunTypes.ts:10`) and `DryRunCounts` carries `willUpdate` (`:75-82`) — neither shipped kind exercises them, because both shipped kinds create records. Landing lab results onto **existing** `TestResult` rows is an `update` import, which the envelope anticipated and nothing has yet used.

### 2.6 The certificate path (C2, shipped)

`POST /api/test-results/upload-certificate` (`backend/src/routes/testResults.ts:185`), `POST /:id/certificate?extract=true` (`:220`), `PATCH /:id/confirm-extraction` (`:288`), `POST /batch-upload` ≤10 files (`:315`). Upload: multer, **10 MB**, mimetype allow-list `application/pdf, image/jpeg, image/png, image/jpg` (`backend/src/routes/testResults/certificateStorage.ts:51-62`) — **no CSV, no XLSX**. Extraction: one Anthropic call per certificate, ten flat fields with per-field confidence (`certificateExtraction.ts:22-32`), prompt `:212-224`, 120 s timeout. Nothing extracted is persisted before a human confirms (`testResults.ts:213-217`, `[C2R-B6]`).

**It is a one-document-one-result reader.** Not a grid parser. §6.1.

### 2.7 What is not there

- **NOT FOUND:** any occurrence of `LIMS` or `tabulated` (in the LIMS sense) anywhere under `docs/research/`, `backend/` or `frontend/`; any file named `*lims*`; any `.xsd`; any sample lab-data file in the repo or in the test-plan kit at `C:\Users\jayso\siteproof-test-plans\`. §3.
- **NOT FOUND:** any threat-model artifact under `docs/` (as C2 §7.3 also recorded).
- **NOT FOUND:** any per-test location, anywhere, in any form.

---

## 3. The LIMS evidence gate `[C3S-B6]` — **this is the blocking item**

### 3.1 What the program actually rests on

One row. `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md:27`, verbatim:

```
| TfNSW mandates standardised electronic lab data: "LIMS Data Submission Requirements — Specified Tabulated Format" | https://www.transport.nsw.gov.au/system/files/media/documents/2023/LIMS-data-submission-requirements.pdf | 2023 | 24 Jul 2026 | A | C3 lab ingestion format | NSW | Confirm currency at C3 start |
```

Read against the appendix's own column header (*Claim · Source · Published/effective · Checked · Grade · Decision supported · Jurisdiction/version · Caveat & revalidate-by*):

- The **claim** is that a mandate and a document exist. It says nothing about the document's contents.
- The **source** is a URL. **It has never been fetched by any CIVOS pass.**
- The **grade `A`** is a grade on the *source class* — the appendix defines `A` as *"primary authority / specification / legal source"* (`:8`). It is not a statement that anybody read it.
- The **caveat** is *"Confirm currency at C3 start"* — a *currency* caveat. There is no caveat recording that the contents are unknown, which is the material gap.

The appendix's own hygiene rule (`:15`) requires specification claims to gain **edition, clause/table and PDF page** at revalidation. The LIMS row has none of the three.

### 3.2 The verdict

**There is no capture, at any grade, of the TfNSW LIMS tabulated format.** Zero column names. Zero field list. Zero file type, extension, delimiter or encoding. Zero cardinality. Zero worked example. Zero sample file. The word *"tabulated"* in this program comes from the document's **title**, not from anyone having seen a table.

C2 reached this independently and blocked on it (`wave-c2-test-lifecycle-spec-2026-07-28.md:464-466`, `[C2L-B4]`): *"Not live integration, and not 'format-compatible ingestion' either. The distinction presupposes the format is known; it is not."* **That block is correct and this spec does not soften it.**

### 3.3 Two risks that are not merely "we haven't read it yet"

1. **The arrow may point the other way.** The document is titled *"LIMS **Data Submission** Requirements"*. Submission by whom, to whom, is unknown. If it specifies how a laboratory or contractor **submits** test data **to TfNSW**, then the program's phrasing — *"LIMS tabulated ingestion"* (plan line 77) — has the direction backwards, and the correct CIVOS feature is an **export**, not an import. That would change the phase from "parse a supplier file" to "generate a compliant submission from verified results", a materially different build with a materially different acceptance test. **Nobody can currently say which it is.**
2. **The same appendix author, the same date, the same unread-URL pattern, was wrong once already.** The adjacent grade-`A` TfNSW row (R44, `:25`) pointed at a portal GUID that the `tfnsw-r44-confirm` pass resolved to a **different specification entirely** — *"I resolved that portal record. **It is not R44.**"* (`docs/research/c1-pack-confirmation-tfnsw-r44-2026-07-27.md:39`). The encoded numbers turned out to belong to Q6, *"Characteristic Density Ratio"* turned out not to be TfNSW terminology at all, and the flat `n = 6` turned out to be one cell of a two-dimensional table. The LIMS row's grade is untested in precisely the way that one was untested.

### 3.4 The gate: C3.0, a confirmation pass, before any Phase C artifact exists

**Deliverable:** `docs/research/c3-lims-format-confirmation-<date>.md`, produced by a primary-source research pass, reproducing the anatomy of the two existing exemplars — `docs/research/c1-pack-confirmation-tfnsw-r44-2026-07-27.md` and `docs/research/c1-pack-confirmation-vicroads-204-2026-07-27.md`:

> provenance header → editions identified with a **currency proof** (the TfNSW portal stamps a `SUPERSEDED` watermark into the text layer of retired editions — that is the control) → what the document actually says, with clause and PDF page → **the direction of the data flow, stated explicitly** (§3.3 risk 1) → the field/column schema verbatim, or an explicit NOT FOUND → file type, delimiter, encoding, cardinality → recommendation → evidence-grade honesty note → sources.

It must answer, at minimum, and **record NOT FOUND rather than infer** for any it cannot:

1. Who submits to whom, and under what contractual trigger.
2. The exact column set, with names as published, and which columns are mandatory.
3. File type and physical format (CSV? fixed-width? XLSX? XML with a tabulated payload?), delimiter, encoding, header conventions.
4. Whether one row is one *test*, one *sample*, or one *parameter* — this decides whether a file maps to N `TestResult` rows or to something the current model cannot hold (`resultValue` is one `Decimal?`, `schema.prisma:870`).
5. How a row identifies the lot / sample / job it belongs to — i.e. whether an imported row can be reconciled to an existing planned `TestResult` at all, or only appended.
6. Whether the format carries a laboratory identity or accreditation reference (which would be C4's, program line 78 — not C3's to encode).
7. Current edition and revalidation date.

**One process note, from the pavements pass:** `pdftotext -layout` **silently misaligned table columns** and had to be replaced with `-table` (`docs/research/c1-q6-pavements-2026-07-27.md:95`). A pass extracting a column specification out of a PDF that gets this wrong will produce a confidently wrong schema.

### 3.5 What may not be written before C3.0 lands `[C3S-B6]`

Until that document exists and is reviewed, **no PR may**: register a `test_register` (or any LIMS) entry in `IMPORT_KINDS` (`importKinds.ts:157-160`); add a `TARGETS_BY_KIND` entry (`mappingProfiles.ts:55-58`); widen `DryRunRow.unit` (`dryRunTypes.ts:55`) or the frontend `ImportKind` union (`importData.ts:8`); add a `sourceFormat` value; add a column to `TestResult` "for LIMS"; or use the words *LIMS-ready*, *LIMS-compatible* or *format-compatible* in any user-facing string, marketing copy, or Clancy knowledge entry. The CI contract the C1 packs already live under is the model: `evidenceGrade === 'A'` with non-empty `edition` / `clause` / `sourceUrl` / `pdfPage` / `checkedOn` / `revalidateBy` (`wave-c1-test-sufficiency-spec-2026-07-26.md:1046`). **A row nobody has read satisfies none of those fields today.**

**And the appendix row should be corrected as part of C3.0**, not left as-is: it is under-caveated relative to the appendix's own standard. Its nearest neighbour — *"VicRoads/DTP as-constructed data format"* (`CIVOS-Research-Appendix-2026-07-24.md:59`) — is an unread data-format document too, and it is flagged `UNVERIFIED — open research item`. LIMS is the same class of thing carrying a bare `A`.

---

## 4. Phase A — the overlay that needs no new data

### 4.1 What it is

A ninth toolbar toggle, **Testing**, beside Photos. Armed → the lot polygons recolour from the shipped conformance-status palette to a three-value testing palette, a legend swaps, and a panel lists the shortfalls. Disarmed → the map is byte-identical to today.

### 4.2 The colours, and the third one that matters most

| State | Fill | Legend label | Meaning |
| --- | --- | --- | --- |
| `satisfied` | green | **Testing satisfied** | `passingCount >= requiredCount` on every resolved rule. |
| `insufficient` | amber | **N of M verified** | At least one rule short. Copy carries the real numbers from `RuleSufficiency` (`types.ts:439-441`). |
| `unknown` | grey | **No rule** | No ruleset/rule resolved. The cause is displayed from `unknownCauses` (`evaluate.ts:81`, vocabulary `types.ts:410-417`), e.g. *"no pack for this authority"*, *"lot has no canonical activity"*, *"no quantity recorded"*. |
| *(no lot geometry)* | — | *"N lots not on the map"* | Counted in the panel; not drawn. Same honesty as §0.3. |

**`unknown` is never coloured as "under-tested" and never coloured as "fine" `[C3S-B7]`.** It means CIVOS has no opinion. Colouring it green would assert compliance CIVOS did not check; colouring it amber would accuse a contractor of a shortfall against a rule that does not exist. Grey, with the reason, is the only honest option — and it doubles as the most useful setup diagnostic in the product, because a project that is all grey is a project whose lots have no activity slug or no quantity.

### 4.3 How it is built (the lazy path)

1. **Backend:** `GET /api/projects/:projectId/lots/test-coverage`. Load the project's lot ids (scoped, §10.1), call `checkConformancePrerequisitesBatch(lotIds, prisma, { regimeFetcher: prismaRegimeStreamFetcher })` — **the fetcher is mandatory, `[C3S-B5]`** — and project each result down to `{ lotId, state, ruleset: { id, status } | null, rules: [{ testType, state, requiredCount, passingCount, pendingCount, failedCount }], unknownCauses }`. **No new evaluation, no new count, no new query pattern.**
2. **Frontend:** a `useTestCoverage(projectId, enabled)` hook shaped exactly like `useLotStatusTimeline` (`statusTimelineData.ts:27-41`) — lazy on `enabled`, 5-minute `staleTime`/`cacheTime` (`:38-39`; note **TanStack Query v4** — `cacheTime`, not `gcTime`).
3. **Recolour:** the History trick, one prop. `LotGeometryLayer` (`LotMapView.tsx:258-312`) gains an optional `fillOverrideByLotId?: Map<string, string>`; when present it replaces the `getStatusColor(g.status)` fill and nothing else. Three lines. The alternative — deriving a fake `status` string per lot the way History does (`:880-889`) — would put a value into `status` that is not a lot status, and `StatusLegend` and every downstream consumer of that field would then be lying.
4. **Panel:** `TestCoveragePanel.tsx`, modelled on `CoveragePanel.tsx` — the shortfall list, the unknown-cause breakdown, the two counts (*unlocated tests*, *lots not on the map*), each row clicking through to the lot.
5. **Legend:** `StatusLegend` (`LotMapView.tsx:348-360`) swaps to the testing legend while armed.

### 4.4 What Phase A must not do

- Not write anything. It is a `GET`.
- Not change `testSufficiencyMode` (`schema.prisma:377`), not turn a gate on, not block a conform or a claim. The block-mode acceptance gate (`docs/plans/block-mode-gate-status-2026-07-28.md`) is untouched and no C3 phase may move a project's mode.
- Not invent a fourth state, a percentage, or a project-level "testing score". `evaluate.ts:60-62` defines the vocabulary; three values is the vocabulary.
- Not go in the offline map-data cache. §10.3.

---

## 5. Phase B — a pin where the sample was actually taken

### 5.1 The location question, decided

Three options were live. Two are rejected on the honesty rule `[C3S-B1]`, and the rejections are the cheapest outcomes anyway.

| Option | Verdict |
| --- | --- |
| **(i) Derive a coordinate from `sampleLocation` free text** | **REJECTED.** It needs a control line, an offset sign convention, a chainage datum and a format the text does not carry; the shipped corpus contains at least three incompatible conventions in the same column (§2.2); and part of that column is itself a **machine guess off a filename at confidence 0.4** (`certificateExtraction.ts:62-73`). A derived pin would also move silently whenever someone edits a text field. |
| **(ii) Fall back to the lot centroid** | **REJECTED.** `featureCentroid` exists and would make this a one-line change (`frontend/src/pages/lots/map/lotMapHelpers.ts:208-231`) — which is exactly why it needs an explicit refusal. A centroid pin **asserts** the sample was taken at the middle of the lot. The lot polygon is already on the map, so the pin adds no information and one false claim. Zero code is also less code. |
| **(iii) Capture the location explicitly, at the moment a human knows it** | **ADOPTED.** Two mechanisms, both already in the codebase: *Use my location* (GPS) and *Pick on map*. |

**A "the text says CH 1000+50 — place the pin there?" proposal** is a legitimate future feature and is explicitly **deferred** (`[C3S-c]`). It is a *proposal a human confirms*, not a derivation — but it needs a control line, a parse dictionary and a confirm step, and it is worth nothing until people are capturing locations at all. Flip condition: a pilot project with a control line asks for it.

### 5.2 The columns

Three, all nullable, on `TestResult`, mirroring `Document.gpsLatitude/gpsLongitude` (`schema.prisma:1589-1590`) and `ITPCompletion.gpsLatitude/gpsLongitude` (`:728-729`):

```prisma
/// Wave C3 Phase B. Where the sample was taken, WGS84. Written ONLY from an
/// explicit human capture (device GPS or a map tap) [C3S-B1] — never derived
/// from `sampleLocation` text, never defaulted to a lot centroid.
sampleLatitude       Decimal? @map("sample_latitude")
sampleLongitude      Decimal? @map("sample_longitude")
/// 'gps' | 'map_pick' — provenance of the pair above. NULL iff both are NULL.
/// A future imported source adds a value here; it never overloads an existing one.
sampleLocationSource String?  @map("sample_location_source")
```

`sampleLocation` (`:867`) is **untouched and remains the human-readable location of record**. The pair is an addition to it, not a replacement: a chainage string is what appears on a lab request and a conformance certificate (`frontend/src/lib/pdf/testCertificatePdf.ts:174`), and a decimal degree pair is not.

**No new index in v1** `[C3S-e]`. The pin query rides `@@index([projectId])` (`:906`) with a bbox filter and the shipped `RESULT_CAP` of 500 — the identical choice the photo layer already makes, which filters GPS in the DB against `Document`'s `[projectId, documentType]` index with no GPS index at all (`spatialSearch.ts:145-163`, indexes `schema.prisma:1617-1621`). *ponytail: no coordinate index; add one when a project's located-test count makes the bbox scan measurable, not before.*

### 5.3 Capture, on the two surfaces where a person knows the answer

**Where:** `CreateTestModal.tsx` (beside the Sample Location input, `:319-323`) and `EnterResultsModal.tsx` — the two places a human is already describing the sample. A small control under the text field: **📍 Use my location** · **Pick on map** · and, once set, the coordinate plus a **Clear** action.

**Reuse, not new primitives:**
- GPS: `useLotAtMyLocation` (`frontend/src/hooks/useLotAtMyLocation.ts:14-27`) is the closest fit — one fix, no polling, and it already discards fixes coarser than `MAX_ACCURACY_M = 30` (`:12`), which is the right guard for a test location. Prefer it over `useGeoLocation` (`frontend/src/hooks/useGeoLocation.ts:25`), which fires on mount (`:83-85`) and writes into the foreman store (`:34`) — side effects a modal does not want.
- Map pick: the existing map, in pick mode, reusing the tool-toggle machinery (`LotMapView.tsx:708-760`).
- Validation: `parseOptionalGpsCoordinate` (`backend/src/routes/itp/completionValidation.ts:36-67`) already exists, already range-checks, already throws `AppError.badRequest`. Use it.

**Capture is optional and never gates anything (J2).** No status transition, no verification, no conform and no claim may require a coordinate. A required field here would add a tap to a field flow whose standard is *"frequent field actions < 2 minutes"* (program line 66) and would push people to accept whatever the GPS said from the site office.

### 5.4 Rendering

Copy the photo layer exactly. A module-level `TEST_PIN_ICON` beside `PHOTO_PIN_ICON` (`LotMapView.tsx:104-115`) in a **deliberately distinct colour** from both the violet photo pin and every status fill; a `TestPin` component modelled on `PhotoPin` (`:317-346`) whose popup shows test type, status, pass/fail and a link to the test; an armed toggle with its own `localStorage` key `siteproof.mapTests.${projectId}`, **default off**, outside the mutually-exclusive tool set (`:547-561` is the pattern); viewport-debounced refetch (`:678-689`).

**Data:** extend the shipped `only` parameter — `only: z.literal('photos').optional()` becomes `only: z.enum(['photos', 'tests']).optional()` (`spatialSearch.ts:54`) — and, in that mode, query `TestResult` by its **own** bbox instead of by intersecting lots, adding `sampleLatitude`/`sampleLongitude` to the select at `:178-184`. **No new route, no new tenancy surface, no new cap** — the subcontractor scoping (`:79-112`), the 500-row cap (`:40`, `:57-59`) and the `RESULT_CAP + 1` truncation detection all apply unchanged. Frontend coercion reuses `toCoord` / the shape of `normaliseSpatialPhotoCoords` (`frontend/src/pages/lots/map/spatialSearchData.ts:26-45`) — Prisma `Decimal` arrives as a string, and blank must not become `0`.

**Unlocated tests are counted, never drawn.** The panel reads *"14 tests in view · 9 with a captured location · 5 without"*. `[C3S-B1]`.

### 5.5 Editing a location

Same rules as any other substantive test edit. A `verified` row requires `TEST_VERIFIERS` to PATCH at all (`backend/src/routes/testResults/crudRoutes.ts:251`). Beyond that: **any change to the coordinate pair on a `verified` row writes an audit row** (`AuditAction.TEST_RESULT_*`, the pattern at `workflowRoutes.ts:427-435`) recording old and new values. Silently moving where a compliance sample was taken, on a record a QM has signed, is precisely the class of edit the program's quality-and-audit standard forbids (`CIVOS-Validated-Buildout-Plan-2026-07-24.md:125`).

**Open sub-decision `[C3S-f]`:** whether a coordinate edit should also join C2's substantive-edit **exemption** list (`[C2R-B5]`, the `expectedResultDate` precedent at `crudRoutes.ts:367`) so it does not reset a verified row to `entered`. **Recommendation: yes, exempt + audit.** Correcting a mistyped pin is not a new result and should not un-verify a test; the audit row is the control. Named here so the builder does not decide it silently.

### 5.6 What Phase B does not touch

`conformancePrerequisites.ts:408-416` selects five `TestResult` fields and `prismaStream.ts:43-51` selects four. New columns appear in **neither**, so no readiness path reads them, no count moves, no snapshot changes. AT-81/AT-88.

### 5.7 The chainage sentence, and why it still does not come back

C1 dropped *"no sample for CH 1,240–1,310"* from the explanation text and assigned its return to C3 (`wave-c1-test-sufficiency-spec-2026-07-26.md:720`, `:957`, `:1362`). **It does not return in v1**, and pretending otherwise would be the exact over-claim this program keeps catching. It needs three things: (1) a per-test coordinate — Phase B delivers this; (2) a projection of that coordinate onto a control line to yield a chainage — buildable with the shipped `@turf/turf` (`backend/package.json:54`) and `ControlLine.geometryWgs84` (`schema.prisma:472`), but only for projects that have a control line; and (3) **a rule limb that declares spatial coverage a requirement** — no shipped pack declares one, and `requiredTestCount` (`counts.ts:49-59`) has no spatial term. Item 3 is a pack-class change, not a map feature. **Flip condition:** a confirmed authority pack declares a spatial-distribution requirement.

---

## 6. Phase C — LIMS ingestion, designed only as far as the evidence allows

**Phase C does not start until §3.4 lands.** What follows is the *decision about which machinery it rides* — which is answerable now, from the shape of the two candidates, and is worth recording so the question is not reopened.

### 6.1 It rides the Wave B import envelope, not the certificate path `[C3S-a]`

| | Wave B `ImportBatch` envelope | C2 certificate path |
| --- | --- | --- |
| Input shape | A tabulated grid, N rows (`parseResult`, `schema.prisma:2057`) | One document, one result (`certificateExtraction.ts:212-224`) |
| Accepted file types | `.xlsx`, `.pdf`, `.docx` + magic-byte gate (`routes.ts:178-196`) | PDF/JPEG/PNG only, 10 MB (`certificateStorage.ts:51-62`) |
| Review UX | Source beside proposal, per-row outcome + reason, dry-run counts (`ImportReviewModal.tsx`, `dryRunTypes.ts:52-90`) | One extraction form |
| Writes | Only through `decideProposal`, with `appliedRecordIds` as the rollback target (`schema.prisma:2015`) | Through `PATCH /:id/confirm-extraction` |
| Rollback | Batch rollback, shipped | Per-row manual correction |
| Update-existing-rows | `DryRunOutcome` includes `'update'`, `DryRunCounts.willUpdate` (`dryRunTypes.ts:10`, `:75-82`) — supported, unexercised | Creates a row, or attaches to one chosen by hand |
| Provenance | `sourceDocumentId`, `mappingProfileId`, reconciliation report + CSV (`reconciliation.ts`) | `certificateDocId` |

**Decisive:** a LIMS file is many rows that must be *reviewed as a grid* and *reconciled against tests that already exist*, with a rollback if the mapping was wrong. That is the envelope's entire purpose, and every one of those capabilities already ships. The certificate path would have to grow a grid parser, a per-row review UI, a dedup key, a dry run and a rollback — i.e. become the envelope, badly, a second time.

**One `kind`, not two `[C3S-b]`.** Use the reserved `'test_register'` (`schema.prisma:2041`) rather than minting a `lims_result` sibling. A historical register migration and a LIMS result file differ in their *source format and column mapping* — which is exactly what `ImportMappingProfile` (`:2079-2103`) is for — not in what they produce. Two kinds would mean two dry-run implementations, two allow-lists and two executors producing the same rows. **This also discharges the Wave B debt:** `wave-b-migration-importer-spec-2026-07-26.md:371` parks the test-register importer on *"the Wave C sample/test lifecycle model is final"*, C2 §13.1 J1 made it final, and C2 exit item 8 required that answer be written back. **NOT FOUND:** any amendment at `wave-b-migration-importer-spec-2026-07-26.md:371` recording it. §15 item 9 collects the debt.

### 6.2 The rules the executor will have to obey, whatever the format turns out to be

Recorded now because they follow from the shipped model, not from the unread PDF:

1. **It writes `TestResult` rows and nothing else.** No new model, no new engine, no `Sample`, no `Laboratory`.
2. **It never writes `verified`.** An applied row lands at `entered` with `enteredById` = the human who approved the batch, matching `buildConfirmationUpdateData` (`extractionConfirmation.ts:106-117`). A QM then verifies each row through the shipped path (`workflowRoutes.ts:193-282`). `[C3S-B8]`
3. **Pass/fail is recomputed server-side**, never trusted from the file — the `applyConfirmedPassFailBackstop` rule (`extractionConfirmation.ts:48-67`).
4. **One row is one `resultValue`.** `TestResult.resultValue` is a single `Decimal?` (`schema.prisma:870`); a multi-parameter LIMS row becomes N `TestResult` rows or it is not imported. If §3.4 finds the format is parameter-per-column, that mapping is the executor's central problem and it must be designed then, not now.
5. **Sufficiency reads do not change.** No new count semantics `[C3S-B3]`, no snapshot change `[C3S-B4]`; imported rows are counted by exactly the same predicate as every other row (`predicates.ts:162-164`).
6. **Extracted file content is data, never instruction** (program §7 line 135) — the same prompt-injection posture as the shipped importers.

### 6.3 What cannot be written down yet

The `runDryRun` implementation, the `TARGETS_BY_KIND` target list, the dedup/reconciliation key, whether `sourceFormat` needs a fourth value, the `DryRunRow.unit` value, the header alias table, and whether the feature is an import at all (§3.3 risk 1). **All of it waits on §3.4.** An estimate given today would be a number invented to fill a cell.

---

## 7. Data model and migrations

**Phase A: no migration.** Phase C: unknown, and unknowable (§6.3).

**Phase B: ONE additive migration — `20260729000000_test_sample_point`.**

```sql
ALTER TABLE "test_results" ADD COLUMN "sample_latitude"        DECIMAL(65,30);
ALTER TABLE "test_results" ADD COLUMN "sample_longitude"       DECIMAL(65,30);
ALTER TABLE "test_results" ADD COLUMN "sample_location_source" TEXT;
```

Three nullable columns, no index, no backfill, no default, no data movement, no drop. Matches the C2 Phase 3 migration shape exactly (`backend/prisma/migrations/20260728090000_c2_lab_lifecycle_stamps/migration.sql:11-12`).

**There is no backfill and there cannot be one.** No historical row carries a coordinate, and deriving one from `sampleLocation` is forbidden `[C3S-B1]`. Every existing test starts unlocated, and the panel says so. Stated here so nobody writes a "helpful" backfill later.

**Production apply** follows the established procedure (reviewed Prisma migration, `prisma migrate deploy` from a workstation against a fresh backup, never `db push`, never `--accept-data-loss`, Railway start/pre-deploy commands stay blank).

---

## 8. Invariants C3 must not break

| Tag | Invariant | Proof |
| --- | --- | --- |
| `[C3S-B1]` | No fabricated location — no centroid pin, no text-derived coordinate, no unconfirmed AI coordinate. | AT-84, AT-85 |
| `[C3S-B2]` | No parallel engine. `evaluateSufficiency` stays pure and synchronous; C3 adds no cached verdict, no recalculation job, no second evaluator. Inherited from `[C2L-B3]`. | AT-83, AT-89 |
| `[C3S-B3]` | No count changed. The characterization corpus regenerates to an empty diff. Inherited from `[C2L-B1]`. | AT-81 |
| `[C3S-B4]` | No snapshot changed. `RequirementEvaluation.result` byte-identical; `resultSchemaVersion` still `1`. Inherited from `[C2L-B2]`. | AT-88 |
| `[C3S-B5]` | The overlay's verdict equals the lot page's verdict, for the same lot, at the same instant — including the regime fold (§2.4). | AT-82 |
| `[C3S-B6]` | No LIMS artifact of any kind before the §3.4 confirmation pass. | §15 item 6 (mechanical `git diff` check) |
| `[C3S-B7]` | `unknown` is never rendered as satisfied and never as insufficient. | AT-86 |
| `[C3S-B8]` | Nothing in C3 moves a test to `verified`, and no C3 phase changes `testSufficiencyMode`. | AT-90 |
| `[C3S-B9]` | Sufficiency still never blocks a claim; `getClaimBlockingReasonsForConformedLot` (`backend/src/lib/conformancePrerequisites.ts:192`) output is byte-identical. Inherited from `[C2L-B11]`. | AT-87 |
| `[C3S-B10]` | No bulk map-tile prefetch, and no new runtime-caching rule without bounded entries and age. | The shipped `pwaRuntimeCaching.test.ts:75-80` |

---

## 9. API and UI surface

### 9.1 Backend

| Phase | Change |
| --- | --- |
| A | **NEW** `GET /api/projects/:projectId/lots/test-coverage`. Read-only. Mounted beside the other project-scoped map routes (`backend/src/server.ts:150-156`). |
| B | **EXTENDED** `POST /api/projects/:projectId/spatial-search` — `only` widens to `'photos' \| 'tests'` (`spatialSearch.ts:54`); the two coordinate columns join the test select (`:178-184`). |
| B | **EXTENDED** `POST /api/test-results` and `PATCH /api/test-results/:id` (`crudRoutes.ts`) — accept and persist the three columns, validated by `parseOptionalGpsCoordinate` (`backend/src/routes/itp/completionValidation.ts:36`). Guard unchanged: `TEST_CREATORS` (`accessControl.ts:32-39`), and `TEST_VERIFIERS` for a `verified` row (`crudRoutes.ts:251`). |
| B | Both columns added to the response shapers that already return `sampleLocation`. |
| C | **NOTHING** until §3.4. |

### 9.2 Frontend

| Phase | Change |
| --- | --- |
| A | `useTestCoverage` hook; `TestCoveragePanel.tsx`; `fillOverrideByLotId` prop on `LotGeometryLayer` (`LotMapView.tsx:258-312`); a testing legend in `StatusLegend` (`:348-360`); a ninth `ToolbarButton` (`:479-517`, cluster `:1060-1131`); a `queryKeys.ts` entry beside `projectCoverage` (`frontend/src/lib/queryKeys.ts:15`). |
| B | `TEST_PIN_ICON` + `TestPin` (mirroring `:104-115`, `:317-346`); the armed toggle + `localStorage` key; the capture control in `CreateTestModal.tsx` and `EnterResultsModal.tsx`; `SpatialTestResult` gains the coordinate pair (`spatialSearchData.ts:47-54`). |
| — | **`LotMapView.test.tsx:25-61` mocks every react-leaflet primitive as a passthrough div. Any new primitive must be added there or the suite breaks.** |

### 9.3 Permission matrix

| Action | Who | Cite |
| --- | --- | --- |
| See the testing overlay | Internal project roles only, v1 (J3) | §10.1 |
| See test pins | Anyone who can already see the test — including a subcontractor, scoped to assigned lots | `spatialSearch.ts:79-112`, unchanged |
| Capture / change a test location | `TEST_CREATORS` (`accessControl.ts:32-39`) | §9.1 |
| Change it on a `verified` row | `TEST_VERIFIERS` (`crudRoutes.ts:251`), audited (§5.5) | |
| Verify a test | `TEST_VERIFIERS` (`accessControl.ts:41`) — **unchanged by this wave** | `[C3S-B8]` |
| Import lab results | Not built | §3 |

---

## 10. Security, tenancy and privacy

### 10.1 Tenancy

Phase B introduces **no new query surface** — it widens a parameter on a route whose subcontractor scoping is already the same as the lots list (`spatialSearch.ts:12-16`, `:79-112`). Phase A adds one route, and it is the only genuinely new surface in the wave; it takes `checkProjectAccess` plus, per J3, **`requireInternalProjectAccess`** — the stricter guard `projectCoverage.ts:131` already uses for the coverage report, which is the closest analogue in both content and sensitivity.

**J3, and the recommendation.** A sufficiency shortfall is CIVOS's computed judgement about whether a subcontractor's work has been tested enough. Publishing that judgement into a subcontractor portal as a colour makes a contractual conversation into an automated accusation, at a point where the pack is `warn`-mode advisory on every project and one NSW pack still ships `draft` (`wave-c1-test-sufficiency-spec-2026-07-26.md:1320`). **Recommend internal-only for v1**; revisit when a pilot head contractor asks for it. Test **pins** are different and stay on the existing scoping — a subbie seeing where a sample was taken on their own lot is a fact, not a verdict.

### 10.2 Threat model

Program §7 line 134 gates C2, D2, E and A3 on a threat-model artifact; C3 is not on that list, and **NOT FOUND:** any such artifact under `docs/`. C3 v1 adds **no upload surface, no external link, no unauthenticated route and no new file parser** — the one thing in the wave that would have needed one is Phase C, which is blocked anyway. **The moment Phase C starts, the file-upload threat model becomes a hard precondition**, because it inherits C2's deferred `[C2L-B12]` obligation on a new parser and a new file type. Recorded, not quietly passed.

### 10.3 Data sensitivity, and the deliberate offline refusal

The coordinate pair is a **work-site** location, not a person's location — but it is captured from a person's device, so it is minimised the same way the photo GPS path minimises: stored only when explicitly captured, never continuously, never as a track, and cleared with the record.

**The testing overlay is deliberately NOT added to `MAP_DATA_URL`** (`pwaRuntimeCaching.ts:32-33`). That rule is `NetworkFirst` with a 7-day cache (`:75-83`), which would serve a **stale compliance verdict** to a field user with no network — the single most dangerous thing this wave could cache. Offline, the layer states it is unavailable. Test **pins** ride `spatial-search`, which is a POST and is already uncached (`:29-31`), so they are online-only too, exactly like photo pins. `[C3S-d]`

---

## 11. Phases and PR slicing

Each phase is independently shippable, independently revertible, and useful on its own.

### Phase A — the testing overlay (M) — *ships first*
- **Depends on:** nothing. C1 is shipped (`docs/plans/wave-c1-exit-evidence-2026-07-28.md`).
- **Why first:** it is the only phase with no migration and no new data, and it makes a wave of already-shipped engine work visible for the first time.
- **Zero behaviour change by construction:** one GET, one optional prop defaulting to `undefined`, one toggle defaulting to off.
- **Exit:** AT-81, AT-82, AT-83, AT-86, AT-87, AT-88, AT-89, AT-90, AT-91.

### Phase B — the test pin (M)
- **Depends on:** nothing (independent of A; sequenced after it because A is worth more and costs less).
- Migration §7; capture control on two modals; `only=tests`; the pin layer; the audited-edit rule §5.5.
- **Exit:** AT-81, AT-84, AT-85, AT-88, AT-92, AT-93, AT-94.

### C3.0 — the LIMS confirmation pass (research, no code)
- **Depends on:** Jay commissioning it (J1). Runs in parallel with A and B; blocks only C.
- **Deliverable:** `docs/research/c3-lims-format-confirmation-<date>.md` per §3.4, plus the appendix-row correction per §3.5.
- **Exit:** the seven questions in §3.4 each answered or explicitly NOT FOUND, and a recommendation: *build as import* / *build as export* / *do not build*.

### Phase C — LIMS ingestion — **BLOCKED, deliberately unspecified**
- **Depends on:** C3.0's verdict **and** a file-upload threat model (§10.2). Not designed in this document beyond §6.1–6.2. Recorded so it can be picked up cold rather than silently forgotten.

### Deliberately outside C3
- **Controlled overrides / tenant rulesets** — J4, §1.3.
- **The chainage-gap sentence** — §5.7.

---

## 12. Scale and performance

Measured against the program's reference dataset (5,000 lots, 10,000 map features, 50 GB evidence, 10k-row registers — plan line 138).

| Path | Budget | Note |
| --- | --- | --- |
| `GET .../lots/test-coverage`, 5,000 lots | **p95 < 3,000 ms**, and it is a **lazy, armed, 5-minute-cached** fetch — never on a page render | It runs the same batch the claim-readiness path runs; that path's accepted budget is p95 < 3,000 ms at 5,000 members (`[C1C-14]`, #1581 `0d94beba`, accepted by Jay 2026-07-27). Adopting a different budget for the same work would be inventing a second number. |
| Query count on that route | Constant in lot count — one `lot.findMany`, at most one `holdPoint.findMany`, at most one legacy-checklist `findMany`, plus at most one grouped query per distinct regime stream (`conformancePrerequisites.ts:856-868`) | AT-91 asserts it does not grow with N. |
| Conformance + claim-readiness paths | **Zero additional queries**, unchanged | AT-89 |
| `spatial-search?only=tests` | Same envelope as `only=photos`: one bounded query, `take: RESULT_CAP + 1` | `spatialSearch.ts:145-163` |
| Map render | 10,000 features at interactive frame rates (plan line 142) | Phase A adds no features — it recolours existing ones. Phase B adds markers, which are capped at 500 per viewport. |

*ponytail, with the ceiling named:* Phase A deliberately reuses the **full** conformance batch rather than a narrower sufficiency-only select, because reuse is what guarantees `[C3S-B5]`. **The ceiling is that route's p95;** the upgrade path, if measurement fails the budget, is a sufficiency-only lot select feeding the *same* `resolveSufficiencyBatch` + `evaluateSufficiency` pair (`resolve.ts:215`, `evaluate.ts:450`) — narrowing the query, never forking the verdict.

---

## 13. Rollback and recovery

| Phase | Rollback |
| --- | --- |
| A | Revert. Nothing was written; the toggle defaults off; `fillOverrideByLotId` is optional. No data to recover. |
| B | Revert the code; **leave the columns.** Three nullable, unindexed, unread columns cost nothing, and dropping them destroys every location a crew captured. Captured coordinates remain readable via the API. |
| C | N/A. |

**Data-loss risk: none.** No column is dropped, no row is deleted, no value is overwritten by any C3 code path. Phase B's only write is a coordinate a human supplied, into a column that was NULL.

---

## 14. Acceptance tests

Continuing the shared series — C1 ended at AT-21, D14 at AT-55b, F1 at AT-62, C2 at AT-80. **C3 starts at AT-81.** Every item is a real assertion in a real test file.

| AT | Phase | Assertion | Where |
| --- | --- | --- | --- |
| **AT-81** | A, B | **No count changed.** The regenerated characterization corpus (`backend/src/lib/readiness/characterization/`) produces an empty diff; `predicates.parity.test.ts` extended with the three new columns present and populated. `[C3S-B3]` | `backend/src/lib/readiness/` |
| **AT-82** | A | **One verdict, two surfaces.** For a seeded project spanning all three states, every `lotId` returned by `GET .../lots/test-coverage` has a `state` **identical** to the `sufficiency.state` returned by `GET /api/lots/:id/readiness` for the same lot — **including a lot whose regime fold differs from `full`**, which fails if the route omits `prismaRegimeStreamFetcher`. `[C3S-B5]` | new `testCoverage.db.test.ts` |
| **AT-83** | A | **No second engine.** The route calls `checkConformancePrerequisitesBatch`; `git diff` touches none of `sufficiency/counts.ts`, `evaluate.ts`, `regime.ts`, `predicates.ts`, `snapshot.ts`, `testCategories.ts`. `[C3S-B2]` | mechanical, in the PR body |
| **AT-84** | B | **No fabricated pin.** A test with `sampleLocation = 'CH 1000+50, 2m LHS'`, a lot with a polygon geometry, and NULL coordinates returns **no** `sampleLatitude`/`sampleLongitude` from every read path and renders **no** marker; it is counted in "without a location". `[C3S-B1]` | `spatialSearch.test.ts` + `LotMapView.test.tsx` |
| **AT-85** | B | **The columns are written only by explicit capture.** Creating a test with only `sampleLocation` leaves all three columns NULL; `sampleLocationSource` is non-NULL **iff** both coordinates are non-NULL; an out-of-range value is a 400 from `parseOptionalGpsCoordinate`. `[C3S-B1]` | `crudRoutes` coverage |
| **AT-86** | A | **`unknown` is its own colour and carries its cause.** A lot with no ruleset renders grey with the `no_ruleset_for_project` copy — never the satisfied colour, never the insufficient colour — and is excluded from the shortfall list. `[C3S-B7]` | `TestCoveragePanel.test.tsx` |
| **AT-87** | A, B | **Claims still unblockable.** `getClaimBlockingReasonsForConformedLot` returns byte-identical output with the overlay route exercised and with located tests present — extending AT-11/AT-71. `[C3S-B9]` | `conformancePrerequisites.test.ts` |
| **AT-88** | A, B | **No snapshot changed.** `RequirementEvaluation.result` is byte-identical for a lot before and after Phase B's columns exist and are populated; `resultSchemaVersion` still `1`. `[C3S-B4]` | `recordDecision.db.test.ts` |
| **AT-89** | A, B | **Query count unchanged** on `checkConformancePrerequisites` and the claim-readiness batch. | `readiness` benchmark |
| **AT-90** | A, B | **Nothing verifies, nothing switches mode.** No C3 code path writes `status='verified'`, `verifiedById`, `verifiedAt` or `Project.testSufficiencyMode`. `[C3S-B8]` | grep assertion + route coverage |
| **AT-91** | A | **The batch stays constant-query.** The route's query count for 5 lots equals its query count for 500 lots (± the per-stream grouped reads), and the p95 is recorded against the reference dataset. | `testCoverage` benchmark |
| **AT-92** | B | **Tenancy.** `spatial-search?only=tests` for a subcontractor returns only tests on assigned lots and never a test on an unassigned lot, even when that test's captured coordinate is inside the box. A cross-company `projectId` is refused. | `spatialSearch.test.ts` |
| **AT-93** | B | **A verified row's location edit is audited and does not un-verify.** PATCHing only the coordinate pair on a `verified` row (as `TEST_VERIFIERS`) leaves `status='verified'` and `verifiedById`/`verifiedAt` intact **and** writes an audit row carrying the previous and new values; the same PATCH as a non-verifier is 403. `[C3S-f]` | `crudRoutes` coverage |
| **AT-94** | B | **Offline behaviour is honest.** The testing overlay and the test-pin layer are not in `MAP_DATA_URL`; `pwaRuntimeCaching.test.ts`'s bounded-entries/age assertion still passes over every rule; offline, the layers state they are unavailable rather than showing stale data. `[C3S-d]` `[C3S-B10]` | `pwaRuntimeCaching.test.ts` + `LotMapView.test.tsx` |

---

## 15. Exit gate

1. **`[C3S-B3]` proven, not asserted** — AT-81's regenerated corpus diff is empty and is shown in the PR body.
2. **`[C3S-B5]` proven** — AT-82 green, including the regime-fold case. *One verdict, two surfaces* is the claim Phase A lives or dies on.
3. **`[C3S-B1]` proven** — AT-84 and AT-85 green, and the PR body states in one line that no location is ever derived or defaulted.
4. **A real project round-trips, owner Jay:** open the lot map on a live project → **Testing** on → at least one lot in each of the three states, each matching its own lot page → create a test, capture the location on a phone → the pin appears where the sample was taken → a second test with no location is counted, not drawn.
5. **`[C3S-B4]` and `[C3S-B9]` green** — AT-88, AT-87.
6. **`[C3S-B6]` checked mechanically:** `git diff` across the wave touches **none** of `importKinds.ts`, `mappingProfiles.ts`, `dryRunTypes.ts`, `importData.ts`, and the strings `LIMS`, `lims`, `LIMS-ready` and `format-compatible` appear nowhere outside this spec and §3's research deliverable.
7. **The offline refusal is deliberate and stated** — AT-94 green, and the PR body says why a compliance verdict is not cached.
8. **§12 budgets met** — AT-89 and AT-91 green; the `test-coverage` p95 against the reference dataset is **named in the PR body, not discovered in production**.
9. **The Wave B debt is discharged** — `wave-b-migration-importer-spec-2026-07-26.md:371` is amended to record that the C2 model is final and that `'test_register'` is unparked *pending the C3.0 research pass, not pending the model*. (C2 exit item 8 required this; **NOT FOUND** as of `a21cb3c7`.)
10. **Tenancy green** — AT-92.
11. **`npm run fallow:audit` verdict recorded in every PR body.**
12. **Docs and the Clancy knowledge mirror updated** (standing boundary, plan line 5) — the overlay, its three states, and what a captured test location means. Note the standing gap C1 recorded at `docs/plans/wave-c1-exit-evidence-2026-07-28.md:43`: `backend/src/routes/copilot/chat/productKnowledge.ts` still contains **zero** occurrences of *sufficiency*. A C3 PR that teaches Clancy the map overlay without teaching it the underlying verdict would make that worse.

**Not in this gate, deliberately:** anything about Phase C. C3 exits on A + B; Phase C has its own gate, written after C3.0.

---

## 16. Decisions

### 16.1 Jay's decisions

1. **J1 — Commission the LIMS confirmation pass (§3.4) now, or shelve Phase C?**
   **Recommendation: commission it now, as a research-only pass, in parallel with Phases A and B.** *One-line why:* it is one agent-hour against a wave-sized commitment, and it has three possible outcomes — unblock the build, redirect it from import to export (§3.3 risk 1), or kill it — all of which are worth more than continuing to cite a document nobody has opened.
2. **J2 — Is capturing a test location optional, or required for field-entered tests?**
   **Recommendation: optional, always, and never a gate.** *One-line why:* a mandatory field on a two-minute field flow gets satisfied by whatever the GPS said from the site office, which is a fabricated location with a provenance stamp on it — the exact failure `[C3S-B1]` exists to prevent.
3. **J3 — Does the testing overlay reach subcontractors, or internal roles only?**
   **Recommendation: internal only for v1** (`requireInternalProjectAccess`, the guard `projectCoverage.ts:131` already uses). *One-line why:* a shortfall is CIVOS's advisory judgement about a subbie's work — every project is still in `warn` mode and one NSW pack is still `draft` — and that is a conversation, not a portal colour. Pins stay on the existing scoping.
4. **J4 — Split "controlled overrides" (the third clause of plan line 77) out of C3?**
   **Recommendation: yes — split it, sequence it after F0's definition model.** *One-line why:* it shares a wave number with this work and nothing else, and building an override store here would be the third place this program has invented a definition table ahead of F0.
5. **J5 — Ninth toolbar button on the mobile map: does this need the shell go-ahead?**
   **Recommendation: no — build it.** *One-line why:* the map toolbar is not foreman shell chrome (the shell-touch boundary is the 48px/sync-centre work, plan line 116), and the mobile map already carries eight buttons plus the register view switcher (#1438). Flagged rather than assumed.

### 16.2 The spec's own decisions

- **`[C3S-a]` — LIMS rides the Wave B envelope, not the certificate path.** §6.1. *Flip condition:* C3.0 finds the format is one-document-one-result, in which case the certificate path is the right home and this decision inverts.
- **`[C3S-b]` — One import kind (`test_register`), not a LIMS sibling.** §6.1. *Flip condition:* C3.0 finds a LIMS file cannot share a dry-run or an allow-list with a register migration.
- **`[C3S-c]` — No chainage-text proposal in v1.** §5.1. *Flip condition:* a pilot with a control line asks, at which point it is built as a human-confirmed proposal, never a derivation.
- **`[C3S-d]` — The testing overlay is not cached offline.** §10.3. *Flip condition:* none foreseeable — a stale compliance verdict in the field is a worse failure than an unavailable one.
- **`[C3S-e]` — No coordinate index in v1.** §5.2, matching the shipped photo-GPS choice. *Flip condition:* a project's located-test count makes the bbox scan measurable.
- **`[C3S-f]` — A coordinate edit is exempt from the substantive-edit reset, and audited.** §5.5, following C2's `expectedResultDate` precedent (`[C2R-B5]`, `crudRoutes.ts:367`). *Flip condition:* an auditor argues a location correction is a new result.
- **`[C3S-g]` — `fillOverrideByLotId`, not a synthesised `status`.** §4.3. Writing a non-status value into `status` would make `StatusLegend` and every downstream reader of that field lie. *Flip condition:* none.
- **`[C3S-h]` — `ponytail:` two of three limbs are almost free.** The over-build available here — a spatial rule limb, a `TestLocation` model, a derived-chainage service, a tenant override table, a LIMS parser written from a title string — is several times the code for zero additional answered questions, and at least two of those answers would be wrong.

---

## 17. Research register

| Item | Supplies | Grade | Status |
| --- | --- | --- | --- |
| `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md:27` | TfNSW *LIMS Data Submission Requirements — Specified Tabulated Format* (2023) | **A (source class only — unread)** | **BLOCKING.** §3. Never opened by any CIVOS pass. Under-caveated relative to `:59`'s treatment of the same class of item. |
| `CIVOS-Research-Appendix-2026-07-24.md:28` | Australian labs return PDF certificates; 1–5 business days; **no universal lab API** | **B**, self-caveated (*"two labs ≠ the industry — treat as directional"*) | Sufficient to justify §1.2's "no live lab integration". Insufficient for any SLA. |
| `docs/research/c1-pack-confirmation-tfnsw-r44-2026-07-27.md` | The precedent that an unread grade-`A` appendix URL was **wrong** | **A (primary)** | §3.3 risk 2. |
| `docs/research/c1-pack-confirmation-vicroads-204-2026-07-27.md`, `docs/research/c1-q6-pavements-2026-07-27.md` | The confirmation-pass anatomy C3.0 reproduces; the `pdftotext -table` gotcha (`c1-q6-pavements-2026-07-27.md:95`) | **A** | §3.4. |
| `docs/research/feature-gap-research-2026-07-13.md`, `docs/research/international-competitor-research-2026-07-14.md` | CivilPro ships chainage lot mapping; the moat is the modality | **B/C** | Already priced into plan line 13. C3 changes nothing here. |

**Must be researched before it is encoded — never inferred:** the LIMS format (§3); the direction of the LIMS data flow (§3.3); whether any authority pack declares a **spatial distribution** requirement (§5.7 — none of the shipped packs does); laboratory accreditation metadata (C4, plan line 78); chain-of-custody (C4 — **zero** occurrences of *"chain of custody"* in `docs/` or `tasks/`, as C2 §14.2 recorded).

---

## 18. Verification notes — derived at `a21cb3c7`

### 18.1 Sibling-spec claims re-derived, and the citations that moved

Every C2-spec citation this document depends on was re-opened. C2 was written at `c9a16fac`; **#1637 added `sentToLabAt` and `expectedResultDate` to `TestResult`**, so every schema citation *after* line 881 has shifted by +7.

| Claim | C2 cited (`c9a16fac`) | Correct at `a21cb3c7` |
| --- | --- | --- |
| `TestResult` model span | `schema.prisma:857-905` | **`:857-912`** |
| `TestResult.sampleLocation` free text | `:867` | **`:867`** (unmoved) |
| `rejectedById`/`rejectedAt`/`rejectionReason` | `:882-884` | **`:889-891`** |
| `TestResult` indexes | `:899-903` | **`:906-910`** |
| Certificate route entry points | `testResults.ts:185/214/250/281/307/331` | **`:185/220/257/288/315/339`** — `POST /:id/certificate` moved to `:220` with the `extract=true` behaviour C2 Phase 1 added |
| `/verify` guard | `workflowRoutes.ts:163-168` | **`:210`** (`/verify` handler now `:193-282`) |
| `/status` handler + `verified` guard | `workflowRoutes.ts:240` / `:265-267` | **`:284`** / **`:309`** |
| `buildConfirmationUpdateData` | `extractionConfirmation.ts:104-115` | **`:106-117`** |
| The substantive-edit exemption list (`[C2R-B5]`) | `crudRoutes.ts:344` | **`crudRoutes.ts:367`** — `NON_SUBSTANTIVE_EDIT_FIELDS = ['itpChecklistItemId', 'expectedResultDate']`, rationale at **`:363`**. `:344` is now unrelated. `[C3S-B5]` builds on this list, so the stale citation would have sent a builder to the wrong line. |

C1-spec citations used here (`:151`, `:260-262`, `:720`, `:957`, `:1092`, `:1127`, `:1320`, `:1362`, `:1046`) were re-opened at `a21cb3c7` and are correct as printed.

### 18.2 Observations for whoever builds this — none blocking

1. **`LotMapView.tsx` is 1,376 lines with eight toolbar buttons and five mutually-exclusive tools** (`:708-760`). Phases A and B add two more toggles. Neither belongs in the exclusion set (both are passive layers, like Photos at `:556-561`), but the file is at the point where the next feature after these should extract the toolbar and the layer registry rather than add a tenth `useState`. Not C3's to do; noted so it is not discovered twice.
2. **Five client-only test form fields are silently dropped on every submit** — `sampleDepth`, `materialType`, `layerLift`, `sampledBy`, `specificationRef` (`frontend/src/pages/tests/types.ts:73-98`, defaults `constants.ts:265-287`; none is destructured by `crudRoutes.ts` or persisted). This is the same class of bug C2 J3 fixed by deleting `nataSiteNumber`. **The Phase B capture control must not become the sixth** — its fields have real columns (§7). Cleaning up the other five is out of scope and worth its own small PR.
3. **`itpChecklistItemId` still has no index** (`schema.prisma:861`, indexes `:906-910`) despite being the strong-match key in the conformance gate. Not C3's to fix; recorded for the third time.
4. **`ITPCompletion.gpsLatitude/gpsLongitude` (`schema.prisma:728-729`) are written but never rendered on any map.** An ITP-completion pin layer is the obvious sibling of Phase B and would need no migration at all. Deliberately out of scope — it is a different record type with a different meaning — but if Phase B's pin layer is built generically enough to take a second source later, that is where it goes.
5. **`GET /:id/request-form` and `GET /:id/workflow` remain dead frontend-side** (C2 `[C2R-B1]`). Still true at `a21cb3c7`. Not C3's.

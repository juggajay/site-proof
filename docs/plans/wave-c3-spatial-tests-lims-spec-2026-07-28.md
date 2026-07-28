# Wave C3 Execution Specification — the map shows the testing, and the LIMS document turned out not to be ours

**Date:** 28 July 2026 · **Rev 1:** authored 28 Jul at `a21cb3c7`, merged #1639 · **Rev 2:** 28 Jul, folding **two** inputs — (a) the C3.0 LIMS confirmation pass (`docs/research/c3-lims-format-research-2026-07-28.md`, merged #1640), which **re-scopes Phase C out of existence**, and (b) the Opus 5 adversarial review of Rev 1 (verdict **6.5/10**; seven blockers `[C3R-B1]`…`[C3R-B7]`, fourteen advisories `[C3R-A1]`…`[C3R-A14]`).

**Status:** implementation-ready for Phases A, B1 and B2. **Phase C is CLOSED as scoped** — see §3 and §6. **No phase is gated on a Jay decision any more** (J1 was discharged by the research pass; J2–J5 resolved in §16.1).

**All `file:line` citations in this revision were re-opened in this worktree at HEAD `5265a6495160c9d65df882b0691d21459b33fbb4`** (= `origin/master`, `docs(research): C3.0 LIMS confirmation — arrow points lab->TfNSW; neither import nor export is the right build (#1640)`). Rev 1 was written at `a21cb3c7`; **every** citation carried forward was re-derived at `5265a649`, not re-copied. The ones that were wrong in Rev 1 — including two the reviewer flagged and two the reviewer got wrong in the other direction — are corrected in §18 and tagged `[C3R-A14]`.

**Program contract:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` §3 Wave C, **line 77** (*"C3. Spatial + LIMS: tested/under-tested map overlay; TfNSW LIMS tabulated ingestion; controlled overrides (selectable spec regimes + audited free override)"*), §7 line 134 (threat-model gate), §8 lines 138–146 (performance targets), §9 line 149 (execution-spec requirement). **Rev 2 recommends amending clause 2 of line 77** — it describes a data flow that does not exist (§3.2).

**Parent specs, read not remembered:**
- `docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md` (Rev 2.2/2.3) — C3 is named there as the owner of the spatial limb at **line 151**, **line 957** (*"No spatial coverage check … C3 (program line 77) restores it"*), **line 1092** (*"Register column / map overlay: OUT … the overlay is C3"*), **line 1127** (per-lot waiver = a C3 controlled override) and **line 1362** (the dropped chainage clause).
- `docs/plans/wave-c1-exit-evidence-2026-07-28.md` — C1's shipped-state record. **Its exit item 8 is `⛔ OPEN`**, and that fact is load-bearing for §12 `[C3R-B2]`.
- `docs/plans/wave-c2-test-lifecycle-spec-2026-07-28.md` (Rev 2, shipped #1636/#1637) — **§5.4 `[C2L-B4]`, line 464**: *"No LIMS, in any form … The first PR in any wave that touches LIMS reads that document first and records a research pass."* **That obligation is now discharged** (§3), and the answer is that there is nothing to build.
- `docs/plans/wave-b-migration-importer-spec-2026-07-26.md` — **line 371**: `ImportBatch.kind` reserves `'test_register'`, parked. §6 re-parks it on a *named* blocker instead of an unread document.
- `docs/plans/spatial-lot-map-spec-2026-07-13.md` — the shipped map program (Phases 0–5). **Line 154** already named *"Test-result spatial context"* as Phase 4 work; what shipped is a **lot** geometry thumbnail, not a test location (§2.3).

**House style** matches the C1, C2, D14, F1 and sync-centre specs: numbered sections, a Rev header plus a §0.x fold changelog, an explicit non-goal disposal of every clause of the program line, a decision register with flip conditions, per-phase rollback, named acceptance tests continuing the shared series, an exit gate.

**Tag namespace.** `[C3S-*]` (C3 **S**patial) for this spec's own decisions, `[C3S-B*]` for blockers it must not violate, `[C3R-B*]` / `[C3R-A*]` for the Rev 2 review fold. `[C1C-*]`, `[C1R-*]`, `[C2L-*]`, `[C2R-*]`, `[D14R-*]`, `[D14X-*]`, `[F1C-*]` and `[WBR2-*]` are taken; `[C1R-C3]` already exists (`wave-c1-test-sufficiency-spec-2026-07-26.md:849`), and `C3-` is a live SA DIT spec-number fragment throughout `docs/research/sa-dit-*.md`. **Never use a bare `C3` tag.**

**Ponytail note, restated for Rev 2.** Rev 1 said two of the wave's three limbs need almost no code and the third was unknowable. The research pass resolved the third: **it needs no code either, because it is not our flow**. What is left is one read-only route, one recolour prop, four nullable columns and one capture control. The review's net effect on the size of the build is *negative* — it deleted a capture surface (`[C3R-B3]`), deleted a count from Phase A (`[C3R-A3]`), and replaced a wrapper hook with a direct one (`[C3R-B4]`) — while adding three DB constraints and one two-line fix that makes an existing route honest (`[C3R-B6]`). The one thing it *grew* is the tenancy shape of `only=tests`, and that grew because Rev 1 had it wrong (`[C3R-B1]`).

---

## 0. What this slice is, what it deliberately is not, and what Rev 2 changed

### 0.1 The one-paragraph version

A quality manager can open the lot map, turn on **Testing**, and see at a glance which lots have enough verified tests, which are short, and which CIVOS has no rule for — using exactly the verdict the lot page already shows, never a second number. Where a sample's location was actually captured, the test appears as a **pin** at that location; where it was not, the test appears **nowhere on the map**, because CIVOS does not know where it was taken and will not guess. And lab data files continue to arrive the way they arrive today — one certificate at a time, read by a human — **permanently**, because someone has now read the TfNSW LIMS specification and it turns out to describe a laboratory's fortnightly submission to TfNSW, a pipeline CIVOS is not in and cannot join without fabricating a lab record.

### 0.2 The scope cut, stated honestly

| Program line 77 clause | Disposition |
| --- | --- |
| *"tested/under-tested map overlay"* | **IN — Phase A.** Ships first. No migration, no new data. |
| *"TfNSW LIMS tabulated ingestion"* | **CLOSED — not built, in either direction.** §3. The flow named in the program line does not exist: the format is lab→TfNSW, CIVOS is not a party, export would be fabricating a lab record, and import is blocked on a commercial-access question no document can answer. `[C3S-B6]` becomes permanent rather than provisional. **The program line should be amended.** |
| *"controlled overrides (selectable spec regimes + audited free override)"* | **OUT of C3 v1 — recommended split (J4).** §1.3. It is a rule-authoring feature, not a spatial or ingestion one, and it needs the F0 `RequirementDefinition`/`ExceptionOrWaiver` model that does not exist. |
| *(inherited)* C1's dropped chainage sentence — *"no sample for CH 1,240–1,310"* | **NOT delivered in v1**, and §5.8 says so plainly. Phase B2 supplies the coordinate that sentence needs; the sentence itself needs a spatial-coverage rule limb no shipped pack declares. **New in Rev 2:** the research pass supplies the grade-A *vocabulary* for it (§3.4). |

**Phase B1 is the only phase with a migration.** It is additive, nullable, constrained, and named loudly in §7.

### 0.3 Rev 2 changelog (a) — the adversarial-review fold

Every finding below was **re-verified independently at `5265a649`** before folding. The *Confirmed at HEAD* column is evidence, not agreement; two findings were **partly refuted** and are marked as such.

| Tag | Finding | Confirmed at HEAD? | Fold |
| --- | --- | --- | --- |
| **`[C3R-B1]`** | Rev 1 §5.4 said "no new tenancy surface" while specifying a bbox-by-test-coordinate query. Tests are scoped **only** transitively, via `intersectingLotIds` derived from the subbie-scoped `lotWhere`. Query tests by their own coordinates and that scoping vanishes. `TestResult.lotId` is nullable, so an unlinked located test would leak too. And `take: RESULT_CAP + 1` exists on the photo query only — the test query is unbounded. | **YES, in full.** `spatialSearch.ts:170-185` — `where: { projectId, lotId: { in: intersectingLotIds } }`, **no `take`**. Scoping is built at `:84-112` and consumed by the *geometry* query at `:121-127`; the test query never touches `visibleLotIds`. Photos at `:145-167` do it properly: DB bbox `:149-150`, `take: RESULT_CAP + 1` `:153`, app-side `p.lotId != null && visibleLotIds!.has(p.lotId)` `:164-167`. `lotId String?` `schema.prisma:860`. | **§5.5 rewritten to copy the photo path shape exactly** — DB bbox + `take: RESULT_CAP + 1` + app-side `visibleLotIds` filter + the `lotId != null` rule. **This is the wave's only security-shaped risk** and is stated as such in §10.1; **AT-92 asserts it**, and it is an exit-gate item. |
| **`[C3R-B2]`** | Rev 1 §12 borrowed "p95 < 3,000 ms accepted" from `[C1C-14]`. C1's own exit record has that target **OPEN** with no passing measurement; it also conflates two different paths, and the overlay is the heavier of them. | **YES.** `wave-c1-exit-evidence-2026-07-28.md` item 8 is **`⛔ OPEN — orchestrator`**: *"Target 1 has no passing measurement on any C1 tree"*, series **3,091 / 3,218 / 3,990 / 4,334 / 3,390 / 3,716 / 3,393 / 3,250 ms**. Separately it records claim-**readiness pages** at 63–92 ms and 163–258 ms — a different path. The regime fetcher is the heavy shape: `sufficiency/prismaStream.ts:29-54` is a grouped `lot.findMany` with a **nested `testResults` select carrying a nested `itpChecklistItem`**. | **§12 restated honestly.** No borrowed pass. The closest measured analogue is a **3.2–4.3 s series that is itself over budget**; a claim-perf fix is **in flight and pending, not done**; the overlay is the *heavier* shape because it always supplies the fetcher; **no measurement exists for this route at all**. The budget becomes an **OPEN C1 exit item this wave does not close**, and the exit gate requires the **measured number in the PR body**. |
| **`[C3R-B3]`** | Rev 1 put the capture control on **two** modals. `EnterResultsModal` has no `sampleLocation` field at all; it is the days-later lab-results form, so a GPS button there stamps the office as the sample point. | **YES.** `grep -n sampleLocation frontend/src/pages/tests/components/EnterResultsModal.tsx` → **zero hits**. Its six fields are result value / unit / spec min / spec max / test method / pass-fail (`:184-246`). Rev 1 inferred the field from a *test fixture* (`EnterResultsModal.test.tsx:43`). | **Capture on ONE surface: `CreateTestModal` only.** `EnterResultsModal` dropped entirely. And the order is inverted: **Pick on map is primary; GPS is secondary and labelled *"I'm at the sample point now"***, because even on `CreateTestModal` a test is often requested from the office. §5.4. |
| **`[C3R-B4]`** | Rev 1's "prefer `useLotAtMyLocation` over `useGeoLocation`" cannot compile: it *wraps* `useGeoLocation` (inheriting fire-on-mount and the foreman-store writes), fetches every project geometry, and returns a **lot**, not a coordinate. | **YES, in full.** `useLotAtMyLocation.ts:15` calls `useGeoLocation()`; `:16` calls `useProjectLotGeometries`; `:18-24` returns `lotAtPoint(...)`. `useGeoLocation.ts:83-85` `useEffect(() => { getCurrentPosition(); })`; store writes at `:34`, `:50`, `:59-60`. | **Implementation path corrected in §5.4:** use `useGeoLocation` **directly**, adding an `immediate?: boolean` option (default `true`, so no caller changes) so the modal can opt out of fire-on-mount; the foreman-store writes are accepted as-is (they are idempotent setters, and a shipped location is not wrong). `MAX_ACCURACY_M = 30` moves to the **call site** — it is a `useLotAtMyLocation` local (`:12`), not a shared export. `maximumAge: 60_000` (`useGeoLocation.ts:22`) is noted: a one-minute-old fix is fine for lot suggestion and **wrong for a sample point** — the modal passes `maximumAge: 0`. |
| **`[C3R-B5]`** | History mode disarms every tool and closes Plans *"so nothing that does not make sense against a past date stays open"*. A Testing overlay left armed would paint **today's** verdict onto a **past** map. | **YES.** `toggleHistory` `LotMapView.tsx:749-760` clears search, coverage, gap focus, draw-lot and Plans. `displayGeometries` `:880-889` rewrites `status` per the historical map and is what renders at `:1230-1236`. | **The Testing toggle and the test-pin layer join `toggleHistory`'s disarm list** — that direction, not the reverse (arming Testing does **not** exit History; History is the stricter mode and owns the map). Specified in §4.4, asserted by **AT-95**. |
| **`[C3R-B6]`** | Rev 1 §2.4 claimed both `/readiness` and `/conform-status` return sufficiency with the regime fold. `/conform-status` supplies **no** fetcher, so it evaluates every rule at regime `full`. The `:84` citation points somewhere else entirely. | **YES, in full.** `qualityRoutes.ts:396` — `await checkConformancePrerequisites(id)`, no client, no options. `:313` — `checkConformancePrerequisites(id, prisma, { regimeFetcher: prismaRegimeStreamFetcher() })`. No fetcher ⇒ `regimeByRuleId` empty ⇒ *"every rule then reads `full`, the over-testing (safe) direction"* (`sufficiency/resolve.ts:327-329`). And `:84` is inside `lotConformanceSnapshot` (`:63-87`), the **decision-transaction** snapshot builder — not a route return. | **§2.4 corrected, and Phase A fixes it:** thread `prismaRegimeStreamFetcher()` into `/conform-status`. It is a **two-line change** and it is what makes "one verdict, everywhere" true rather than true-of-two-of-three. Deleting the route was the alternative — it has **zero non-test consumers** (`grep -rn conform-status frontend/src backend/src` → only `qualityRoutes.ts` and test files) — but a shipped API surface is not removed without a Jay call, so it is **noted, not taken**. §4.3 step 0; **AT-96**. |
| **`[C3R-B7]`** | `sampleLocationSource` was specced as unvalidated unbounded `TEXT` at a trust boundary, with the pair-null and source-null-iff rules living only in prose. | **YES** — Rev 1 §7's SQL had no constraint of any kind, and §5.2's prose rules had nowhere to be enforced. | **Three `CHECK` constraints written verbatim into the migration** (§7), plus a Zod enum at the route. **Honesty note added:** a constraint can prove the *shape* of provenance, never its *truth* — a user can pick a map point anywhere. Provenance stays tests-plus-review, and §7 says so. |
| `[C3R-A1]` | Batch over **geometry-bearing** lots only; `lot.count()` the rest. | **YES.** `projectLotGeometries.ts:96-102` already applies the subbie-scoped `lot: lotWhere`, so a geometry-bearing lot-id set is one already-scoped query. | Folded, §4.3. **The biggest latency lever in the wave** — the overlay can only recolour lots that are drawn, so evaluating undrawn lots is pure waste. The rest become one `lot.count()` for the *"N lots not on the map"* line. |
| `[C3R-A2]` | Trim the payload. | n/a (design) | Folded, §4.3: `{ lotId, state }` for every lot; the `rules` / `unknownCauses` detail **only** for `insufficient` and `unknown`. A 5,000-lot mostly-green project ships a small response. |
| `[C3R-A3]` | The unlocated-test count is Phase B data; Phase A cannot produce it. | **YES** — the columns do not exist until B1. | **Dropped from Phase A entirely.** §4.2's fourth row keeps only *"N lots not on the map"*. The unlocated-test count moves to B2's pin panel. |
| `[C3R-A4]` | Add `sample_location_accuracy_m`; it is unrecoverable after capture. | **YES.** `useGeoLocation` already returns `accuracy` (`:51-55`), and `useLotAtMyLocation` already gates on it (`:20`). | Folded into **the same migration** (§7). A ±40 m pin and a ±4 m pin are different evidence and there is no second chance to record which one it was. |
| `[C3R-A5]` | Render provenance + accuracy where the pin is read. | n/a (design) | Folded: the pin popup and the test detail both show *"GPS ±6 m"* or *"Picked on map"*. §5.5, §5.7. |
| `[C3R-A6]` | The `[C3S-B6]` exit grep as written fails on innocent files. | **YES.** `grep -rln LIMS docs/` → `d14-q6-pack-spec-2026-07-27.md`, `wave-c1-test-sufficiency-spec-2026-07-26.md`, `wave-c2-test-lifecycle-spec-2026-07-28.md`, this spec, and the research report. | **Scoped to the wave's diff** (`git diff origin/master...HEAD`), not the tree. §15 item 6. |
| `[C3R-A7]` | The PATCH route already audits with new values; adding old values is two lines. Rev 1's audit citation was wrong. | **YES.** `crudRoutes.ts:404-412` already calls `createAuditLog({ action: AuditAction.TEST_RESULT_UPDATED, changes: updateData })`. The pre-image is in hand — `prisma.testResult.findUnique({ where: { id } })` at **`:236-238`**, unselected, so the whole row. Rev 1 cited `workflowRoutes.ts:427-435`, which is **not** an audit site; the real ones are **`:178-186`** (rejected), **`:269-277`** (verified), **`:480-488`** (status changed). | §5.6 rewritten: **extend the existing audit call** to carry old **and** new coordinate values. No new audit site. Citations corrected. |
| `[C3R-A8]` | The substantive-edit exemption must name **all three** keys, not "the coordinate". | **YES.** `NON_SUBSTANTIVE_EDIT_FIELDS = ['itpChecklistItemId', 'expectedResultDate']` at `crudRoutes.ts:367`; the trust-boundary comment above it is at `:355-366`. `hasSubstantiveEdit` at `:368-370` iterates **`Object.keys(updateData)`** — so a key omitted from the list un-verifies the row. | §5.6: the list gains **`sampleLatitude`, `sampleLongitude`, `sampleLocationSource`** — and `sampleLocationAccuracyM`, which the reviewer did not name because A4 introduced it. **Four keys.** AT-93 asserts each one individually. |
| `[C3R-A9]` | An overlay of a live verdict on a 5-minute cache needs a stamp and a refresh. | **YES.** `statusTimelineData.ts:38-39` — `cacheTime`/`staleTime` `5 * 60 * 1000`, TanStack Query **v4** (`cacheTime`, not `gcTime`), and Rev 1 copied that shape verbatim. | Folded, §4.3: the panel header carries **"as at 14:32"** from `dataUpdatedAt` and a manual **Refresh**. The staleness is owned openly rather than hidden. |
| `[C3R-A10]` | J5 concerns the **ninth and tenth** toolbar items; add a 360 px check. | **YES.** Eight buttons at `LotMapView.tsx:1060-1128`: Find by area, Coverage, Plans, Photos, Draw lot *(role-gated)*, Snapshot, My location, History. Testing is the ninth; the pin toggle is the tenth. | J5 restated for both. **A 360 px viewport check joins the Phase B2 exit** (§15 item 13); the toolbar is `flex-wrap` (`:1059`), so the failure mode is a second row eating map, not a clipped button. |
| `[C3R-A11]` | Pass a **resolved** fill per child, not a Map; and `Polyline` uses that colour as a **stroke**. | **YES.** `LotGeometryLayer({ geometry, onViewDetails })` at `:258-264`, mapped at `:1230-1236`. `Polygon` uses the status colour as `fillColor` with a constant `POLYGON_STROKE_COLOR` casing (`:275-283`); **`Polyline` at `:288-292` passes it as `color`** — the stroke. `CircleMarker` follows at `:294+`. | §4.3: the prop is **`fillOverride?: string`**, resolved by the parent per geometry. The stroke-vs-fill asymmetry is **named in the spec** so a linear lot's testing colour is understood to arrive as its stroke — which is correct, and is how status already reaches it. |
| `[C3R-A12]` | Negative-assert the new route in the runtime-caching test. | **YES.** `pwaRuntimeCaching.test.ts:63-72` is the *"does not match"* `it.each` (login, `/api/lots/l-1`, document file, `spatial-search`, sheet image, sheet). | Folded: **append `/api/projects/p-1/lots/test-coverage`** to that list. This is what makes `[C3S-d]` a test rather than a paragraph. AT-94. |
| `[C3R-A13]` | Name the loading and error UX. | n/a (design) | Folded, §4.3 step 5. |
| `[C3R-A14]` | Citation fixes: `TEST_CREATORS :31-38`, `TEST_VERIFIERS :40`, `unknownCauses evaluate.ts:83`, `RuleSufficiency types.ts:438-441`, `productKnowledge` now has 2 sufficiency hits. | **PARTLY — two of five refuted.** ✅ `unknownCauses` **is** `evaluate.ts:83` (Rev 1's `:81` is `rules: RuleSufficiency[]`). ✅ `productKnowledge.ts` now has **exactly 2** occurrences of *sufficiency*, **both inside comments** (`:19`, `:23`) — C1's "zero occurrences" record is stale. ❌ `TEST_CREATORS` is **`:32-39`** (Rev 1 was right; the review is off by one). ❌ `TEST_VERIFIERS` is **`:41`** (Rev 1 was right). ⚠️ `RuleSufficiency` is `types.ts:435`, and its four counts are **`:439-442`** — Rev 1's `:439-441` drops `failedCount`, and the review's `:438-441` is also wrong. | All five landed at their **verified** values, not as printed by either document. §18.1. |

### 0.4 Rev 2 changelog (b) — the C3.0 research fold

`docs/research/c3-lims-format-research-2026-07-28.md` (#1640) discharged §3.4 of Rev 1 in full. Its effect on this spec:

| Research finding | Effect here |
| --- | --- |
| **The arrow points laboratory → TfNSW.** It is a lab's fortnightly submission to TfNSW's eMFT portal, a Category-L registration criterion. The head contractor appears nowhere in the pipeline. | **Phase C is closed as scoped**, §3.2, §6. Program line 77 clause 2 should be amended. |
| **Export is impossible and should be closed permanently** — files are keyed on the *lab's* NATA accreditation site number and carry raw instrument data (gauge calibration constants, mould masses, standard counts) plus a field-level audit trail from **inside the lab's LIMS**. | **A CIVOS-generated submission would be a fabricated lab record.** That is the same failure class as `[C3S-B1]`, one level up, and it is written into §1.2 as a permanent non-goal. |
| **Import is not backed by the cited mandate**, but is the only survivable version. Blocked on **NOT FOUND #2**: no evidence at any grade that labs hand these files to clients. | `'test_register'` stays parked — **re-parked on a named blocker** (a real lab conversation), not on an unread document. §6. |
| **The real prize is Table 1's spatial field schema** — a published, mandated, government-standard vocabulary for lot and sample location: `UniqueLotNumber`, `LotLocationStartChainageGPSCoordinates`, `LotLocationFinishChainageGPSCoordinates`, `LotLocationLeftOffsetsGPSCoordinates` / `...RightOffsets...`, `ControlLine`, `LotLocationLayerNumber`, `LayerLocationRL`, `SampleLocationChainageGPSCoordinates`, `SampleLocationOffsetGPSCoordinates`; offsets are **control-line relative**. | **Phase B gains grade-A validation, per field**, §3.4. The columns Rev 1 derived from first principles turn out to match a mandated schema, and §5.8's future chainage/offset work now has published names instead of invented ones. |
| **The cited appendix URL is a superseded edition.** Current is **v6, an XLSX, published 29 Aug 2024 / distributed 5 Nov 2024**; the 2023 PDF is pre-v3 (proved structurally by the `Version Control` sheet). TfNSW itself still deep-links the stale PDF. | The appendix-row correction is now a **specific** instruction, §3.5. Rev 1's expected `SUPERSEDED`-watermark currency control **does not apply here** and the spec says so. |

### 0.5 The honesty rule this whole wave turns on `[C3S-B1]`

**A location on a test record is evidence. CIVOS never writes one it did not receive from a human or an instrument.**

Concretely, and enforced by AT-84/AT-85: no lot-centroid fallback pin, no parse of `sampleLocation` free text into a coordinate, no AI-proposed coordinate written without confirmation, no coordinate inferred from the lot's chainage. A test with no captured location is displayed as *"no location captured"* — a fact — and not as a dot in the middle of a lot, which is a claim.

**Rev 2 extends the same rule one level up.** CIVOS does not generate a laboratory's submission record either (§0.4 row 2). The reason is identical: a document that asserts where a sample was taken, or who tested it and on what instrument, is evidence, and evidence CIVOS did not receive is evidence CIVOS must not manufacture.

---

## 1. Outcome, scope and non-goals

### 1.1 Outcome

1. **The map answers "where is the testing short?"** using `SufficiencyEvaluation.state` (`backend/src/lib/readiness/sufficiency/evaluate.ts:60-62`) — the same three-valued verdict (`satisfied` | `insufficient` | `unknown`, `types.ts:408`) the lot page already renders. One definition, now genuinely on every surface: Phase A also fixes the one route that was quietly computing a different one (`[C3R-B6]`).
2. **A test that was located shows where it was taken**, with its provenance and its accuracy. Captured on purpose, by a person, with the same GPS primitives the ITP and photo flows already use.
3. **Nothing about testing gets automatically decided.** The overlay is a view; it turns no gate on, changes no count, and writes nothing. Verification remains `TEST_VERIFIERS` (`backend/src/routes/testResults/accessControl.ts:41`).
4. **The LIMS question is answered** — and the answer is that the feature the program named does not exist to be built. §3.

### 1.2 Non-goals (explicit — do not build in C3)

- **No new map engine, no new tile provider, no new rendering library.** Leaflet + react-leaflet 4 (`frontend/package.json:50`, `:58`), MapTiler satellite / OSM (`LotMapView.tsx:1189-1208`). No bulk tile prefetch may be added — the licence caps are test-enforced (`frontend/src/lib/pwaRuntimeCaching.test.ts:75-80`, licence note `pwaRuntimeCaching.ts:6-10`).
- **No LIMS import.** §3, §6. Blocked on a commercial-access question, not a format one.
- **No LIMS export, ever, as currently evidenced.** CIVOS is not a registered Category-L laboratory, does not hold a NATA accreditation site number, and does not hold the instrument data or the lab-internal audit trail the format mandates. Generating one would be fabricating a lab record. **This is a permanent non-goal, not a deferral** — its only conceivable flip is NOT FOUND #5 of the research pass (whether TfNSW Q6 places a test-data obligation on the *contractor*), and that would be a different document describing a different artifact.
- **No "LIMS-ready" / "LIMS-compatible" / "format-compatible" claim** in any user-facing string, marketing copy, or Clancy knowledge entry. **Permanent** `[C3S-B6]`. A NSW civil buyer knows who is in that pipeline.
- **No live laboratory integration.** No lab API client, no polling, no credentials for a lab system, no outbound submission. The only evidence CIVOS holds on lab connectivity is grade **B** and self-caveated (§17).
- **No auto-verification, ever.** No import, no extraction and no map action may move a `TestResult` to `verified`. That transition has one guard and it stays (`workflowRoutes.ts:210`, `:309`).
- **No second sufficiency engine, no cached verdict column, no recalculation job.** `[C3S-B2]`, inherited from `[C2L-B3]`.
- **No new count semantics and no snapshot change.** `[C3S-B3]` / `[C3S-B4]`, inherited from `[C2L-B1]` / `[C2L-B2]`.
- **No editing of a coordinate on a verified test without an audit row.** §5.6.
- **No `Sample` entity, no `Laboratory` entity, no accreditation model.** C2 §13.1 J1 settled the first (final: `TestResult` **is** the sample record); the rest are C4 (program line 78). Note the research pass confirms the LIMS format carries `AccreditationSiteNumber` — that is C4's territory if it is ever anyone's.
- **No controlled overrides / tenant-authored rulesets.** §1.3, J4.
- **No spatial coverage RULE.** The engine gains no spatial limb; `requiredTestCount` (`counts.ts:49-59`) is untouched.

### 1.3 Why "controlled overrides" is not in this wave

Program line 77 bundles three things that share a wave number and nothing else. The first two are about *where tests are and whether there are enough*; the third is about *who may change the rule*. Concretely it needs: a place to store a tenant-selected regime (C1 deliberately made rulesets **shipped code**, not tenant data — `wave-c1-test-sufficiency-spec-2026-07-26.md:260-262`), an override record with reason/authority/scope/expiry (that is F0's `ExceptionOrWaiver`, `CIVOS-Validated-Buildout-Plan-2026-07-24.md:36` — **NOT FOUND** in `backend/prisma/schema.prisma`), and an audit surface for it. C1 already routes the per-lot waiver question here (`:1127`) and already ships the escape hatch it replaces (force-conform).

**Recommendation (J4): split it out as its own spec, sequenced after F0's definition model exists.** Building an override table inside a map wave would be the third place this program has invented a definition store ahead of F0.

---

## 2. Current-state map (read at `5265a649`)

### 2.1 The spatial stack that ships

Eighteen PRs (#1413–#1431) plus two polish waves (#1433–#1438, #1444–#1446); closed and live-verified (`docs/agent-handoff.md:687-739`).

| Thing | Where |
| --- | --- |
| The map | `frontend/src/pages/lots/map/LotMapView.tsx` (1,376 lines). `<MapContainer>` `:1173-1327`; base layers `:1188-1208`. |
| Hosts | `frontend/src/pages/lots/LotsPage.tsx:54` (lazy) `:460-478`; foreman shell `frontend/src/shell/screens/lots/LotMapScreen.tsx:28-30`, `:102-109`. |
| Lot polygons | `LotGeometryLayer` `LotMapView.tsx:258-312`; colour from `getStatusColor(g.status)` `:268`; palette `frontend/src/components/lots/linearMapViewHelpers.ts:37-46`, legend `:48-51`. **Polygon uses it as `fillColor` over a constant `POLYGON_STROKE_COLOR` casing (`:275-283`); `Polyline` uses it as the STROKE (`:288-292`)** `[C3R-A11]`. |
| Photo pins | `PHOTO_PIN_ICON` `LotMapView.tsx:104-115`; `PhotoPin` `:317-346`; armed toggle + `localStorage` key `siteproof.mapPhotos.${projectId}` `:547-561`; viewport refetch debounced 600 ms `:678-689`; render `:1238-1249`. **This is the template a test-pin layer copies — including its query shape** (§5.5). |
| Toolbar | `ToolbarButton` `:479-517`; the **eight** buttons `:1060-1128` (Find by area, Coverage, Plans, Photos, Draw lot *(role-gated)*, Snapshot, My location, History); `flex-wrap` container `:1059`; five mutually-exclusive tools `:708-760` (**Photos is deliberately not in that set** `:556-561`). |
| Geometry | `LotGeometry` `backend/prisma/schema.prisma:485-505` — `geometryWgs84 Json` `:494` (GeoJSON Feature), `areaM2 Decimal?` `:495`, `kind` `:488` (`chainage_offset`\|`drawn`\|`point`), `@@index([lotId])` `:503`. `ControlLine` `:466-483`, `PlanSheet` `:517-539`. |
| Read routes | `GET /api/projects/:projectId/lot-geometries` `backend/src/routes/projectLotGeometries.ts:62-106` (**subbie-scoped at `:78-94`, geometry query `:96-102`**); `GET /api/projects/:projectId/lots/status-timeline` `backend/src/routes/lotStatusTimeline.ts:46-116`; `GET /api/projects/:projectId/coverage` `backend/src/routes/projectCoverage.ts:127-212` (**internal-only**, `requireInternalProjectAccess` `:131`); `POST /api/projects/:projectId/spatial-search` `backend/src/routes/spatialSearch.ts:61-202`. |
| Timeline scrubber | `frontend/src/pages/lots/map/HistoryPanel.tsx:33-95`; wiring `LotMapView.tsx:585-587`, `:749-760`, `:1122-1128`. |
| Offline stage 1 | `frontend/src/lib/pwaRuntimeCaching.ts` — tiles `:18-19`/`:47` (1,500 entries, 30 d), plan rasters `:24-25`, map data `:32-33` NetworkFirst (80 entries, 7 d). `spatial-search` and `coverage` are **not** cached; the negative `it.each` that pins this is `pwaRuntimeCaching.test.ts:63-72`. Authed caches cleared on sign-out, `frontend/src/lib/auth.tsx:139`. |
| Cap enforcement | `pwaRuntimeCaching.test.ts:75-80` — *"every rule has bounded entries and age"*. `RESULT_CAP = 500` `spatialSearch.ts:40`. **NOT FOUND:** any per-tenant MapTiler request metering in app code. |

**The recolour pattern, which Phase A reuses.** History mode does not touch `LotGeometryLayer`'s internals. It derives a `Map<lotId, status>` (`frontend/src/pages/lots/map/statusTimelineData.ts:97-108`) and rebuilds the geometry array in a memo — `out.push(status === g.status ? g : { ...g, status })`, `LotMapView.tsx:880-889` — then renders `displayGeometries` (`:1230-1236`). Lazy fetch behind an armed toggle, 5-minute `staleTime`/`cacheTime` (`statusTimelineData.ts:38-39`, **TanStack Query v4 — `cacheTime`, not `gcTime`**). **Phase A copies the laziness and the toggle, but NOT the status rewrite** — see `[C3S-g]`.

### 2.2 The test row, and what it knows about *where*

`backend/prisma/schema.prisma:857-912`. The fields C3 cares about:

| Line | Field | Note |
| --- | --- | --- |
| **860** | **`lotId String?`** | **Nullable**; `onDelete: SetNull` `:898`. A test may have no lot at all — which is why `[C3R-B1]`'s `lotId != null` rule is load-bearing and not defensive noise. |
| **867** | **`sampleLocation String?`** | **Free text.** Max 500 chars (`backend/src/routes/testResults/validation.ts:20`). Nothing parses it. |
| 870 | `resultValue Decimal?` | **One scalar per row.** A multi-parameter lab result is N rows, not one. |
| 875/877 | `passFail` / `status` | |
| 880-881 | `verifiedById` / `verifiedAt` | |
| 885/888 | `sentToLabAt` / `expectedResultDate` | C2 Phase 3, shipped (#1637). |
| 892-893 | `aiExtracted` / `aiConfidence` | |

Indexes `:906-910`: `[projectId]`, `[projectId, status]`, `[lotId]`, `[projectId, passFail]`, `[enteredById, createdAt]`.

**NOT FOUND on `TestResult`:** any latitude, longitude, easting, northing, chainage or geometry field. The only coordinate-bearing models in the schema are `Project` (`:386-387`), `ITPCompletion.gpsLatitude/gpsLongitude` (`:728-729`, both `Decimal?`) and `Document.gpsLatitude/gpsLongitude` (`:1589-1590`, both `Decimal?`, written from EXIF by `extractImageMetadata`, `backend/src/routes/documents.ts:164-230`). **Those two pairs are the column precedent Phase B1 copies.**

**`sampleLocation` is worse than merely unstructured — part of it is machine-guessed.** `inferLocationFromFilename` (`backend/src/routes/testResults/certificateExtraction.ts:62-73`) regexes a chainage out of an uploaded file's *name* and emits e.g. `"CH 100+20"` at confidence **0.4**, on the degraded path taken whenever the AI call fails or no API key is configured (`:75-80`, `:243-245`). The shipped fixtures show three mutually incompatible conventions in the same field — `'CH 100-120 LHS'` (`frontend/src/lib/pdf/__tests__/fixtures/testCertificateFixture.ts:11`), `'CH 1234+50'` (`frontend/src/pages/tests/certificateReview.test.ts:54`), `'CH 100.000'` (`frontend/src/pages/tests/components/EnterResultsModal.test.tsx:43`) — and the form's own placeholder invites a fourth (*"e.g., CH 1000+50, 2m LHS"*, `frontend/src/pages/tests/components/CreateTestModal.tsx:324`). **Any coordinate derived from this field would be a guess built on a guess.** §5.1.

*(Note, `[C3R-B3]`: the third of those fixtures is a **test fixture for a modal that has no such field**. Rev 1 read it as evidence the field existed. It does not — §2.3a.)*

### 2.3 How a test reaches the map today

Only through its lot. `POST /api/projects/:projectId/spatial-search` (`spatialSearch.ts:61-202`) intersects **lot geometries** with the drawn box (`:119-137`), then loads test results **for those lots** (`:170-185`, `select { id, status, lotId, testType, testRequestNumber }` `:178-184`). The file says so in its own header: *"the test results for those intersecting lots"* (`:5-6`). Results render as list rows in `frontend/src/pages/lots/map/FindByAreaPanel.tsx`, never as map features.

**The tenancy consequence, which Rev 1 missed `[C3R-B1]`.** Subcontractor scoping is built at `:84-112` into `lotWhere` + `visibleLotIds`, and reaches tests **only transitively**, because the test query filters on `intersectingLotIds` — ids derived from the already-scoped geometry query at `:121-127`. Query tests by their own coordinates instead and there is no scoping left at all. The photo layer is the correct model precisely because it has this problem and solves it explicitly: DB bbox at `:149-150`, `take: RESULT_CAP + 1` at `:153`, then `p.lotId != null && visibleLotIds!.has(p.lotId)` at `:164-167`. **Note also that the shipped test query has no `take` at all** — it is bounded only by `cap()` after the fact (`:57-59`, `:191`).

The spatial spec's *"Test-result spatial context: lot geometry thumbnail on test request/cert detail"* (`docs/plans/spatial-lot-map-spec-2026-07-13.md:154`) shipped as exactly that — **the lot's** outline (`frontend/src/pages/lots/map/geometrySvg.ts`), not the test's location.

### 2.3a The two test modals, and which one knows where the sample is `[C3R-B3]`

| Modal | Fields | Does it know the sample location? |
| --- | --- | --- |
| `CreateTestModal.tsx` | Includes **Sample Location** as a free-text `<Input>` at `:318-325`, placeholder *"e.g., CH 1000+50, 2m LHS"* | **Sometimes.** It is the *request* form — often filled at the office, before anyone has stood at the sample point. |
| `EnterResultsModal.tsx` | **Six fields: result value, unit, spec min, spec max, test method, pass/fail** (`:184-246`). **Zero occurrences of `sampleLocation`** (grep, this worktree). | **No, and it never can.** It is the days-later lab-results form. A GPS button here stamps whoever is typing, wherever they are — the office — as the sample point. |

**Consequence:** capture ships on `CreateTestModal` **only**, and even there **Pick on map is primary and GPS is secondary**, labelled to state its own precondition. §5.4.

**NOT FOUND:** any location-capture control on any test surface. `useGeoLocation` and `useLotAtMyLocation` appear nowhere under `frontend/src/pages/tests/`.

### 2.4 The verdict Phase A wants already exists — and one route computes a different one `[C3R-B6]`

- **Per lot:** `GET /api/lots/:id/readiness` (`backend/src/routes/lots/qualityRoutes.ts:270`) returns `sufficiency` at `:351`, computed at **`:313`** with `checkConformancePrerequisites(id, prisma, { regimeFetcher: prismaRegimeStreamFetcher() })`.
- **`GET /api/lots/:id/conform-status` (`:370`) does NOT.** Its call is `await checkConformancePrerequisites(id)` at **`:396`** — no client, no options, **no fetcher**. *(Rev 1 cited `:84` as the second return site. `:84` is inside `lotConformanceSnapshot` (`:63-87`), the builder that records the decision snapshot **inside the conform transaction**. Corrected.)*
- **For many lots in constant queries:** `checkConformancePrerequisitesBatch(lotIds, client, options)` — `backend/src/lib/conformancePrerequisites.ts:811`. Sufficiency for the whole set resolves in **one pass** via `resolveSufficiencyBatch` (`:879`, definition `backend/src/lib/readiness/sufficiency/resolve.ts:215`); the comment at `:856-868` records the guarantee: *"one `lot.findMany`, at most one `holdPoint.findMany`, at most one legacy-checklist `findMany`"*, and with a fetcher *"at most ONE grouped query per distinct STREAM — never one per member"*.
- **The value itself:** `SufficiencyEvaluation.state` — *"Worst state across rules; `unknown` when no rule resolved"* (`evaluate.ts:60-62`); `SufficiencyState = 'satisfied' | 'insufficient' | 'unknown'` (`types.ts:408`); per-rule counts on `RuleSufficiency` (`types.ts:435`, the four counts at **`:439-442`**: `requiredCount`, `passingCount`, `pendingCount`, `failedCount`); lot-level causes `unknownCauses` (**`evaluate.ts:83`** for the field, `:467` where it is computed, `:524` where it is returned; vocabulary `types.ts:410-417`).
- **What counts:** `testPassing = passFail === 'pass' && status === 'verified'` (`backend/src/lib/readiness/predicates.ts:162-164`). Phase A displays this and changes none of it.

**The trap, named before anyone falls in it `[C3S-B5]`.** The regime fold is optional. Called **without** `options.regimeFetcher`, `resolveSufficiency` leaves `regimeByRuleId` empty and *"every rule then reads `full`, the over-testing (safe) direction"* (`resolve.ts:327-329`). A Phase A route that omits the fetcher would show a lot as `insufficient` that its own lot page shows as `satisfied`. **The overlay route MUST pass the same fetcher the lot page passes** — and, per `[C3R-B6]`, **so must `/conform-status`, which currently does not.** AT-82 asserts overlay ≡ readiness; AT-96 asserts conform-status ≡ readiness. Two assertions, one verdict.

### 2.5 The import envelope that ships, and the slot that stays reserved

`ImportBatch` `backend/prisma/schema.prisma:2037-2074`. `kind` at `:2041` carries the reservation in the schema comment itself (`:2039-2040`): *"'itp_template' | 'lot_register' (open set; **'test_register' is RESERVED and deliberately unimplemented until the Wave C sample/test model is final**)"*. `status` `:2043`, `sourceFormat` `:2046` (`'excel' | 'pdf' | 'word'`), `parseResult Json` `:2057`, `dryRun Json` `:2058`, `proposal AiProposal?` `:2068`.

The extension points, all four of them, and **none of them changes in C3**:
- `IMPORT_KINDS` registry — `backend/src/routes/copilot/import/importKinds.ts:157-160`, doc comment `:162-163`. Unknown kind → `IMPORT_KIND_UNSUPPORTED`, `:164-173`.
- `TARGETS_BY_KIND` field-map allow-list — `mappingProfiles.ts:55-58`; enforced at save **and** apply by `assertAllowedFieldMap` `:87-125`.
- `DryRunRow.unit: 'template' | 'checklist_row' | 'lot'` — `dryRunTypes.ts:55`.
- Frontend `type ImportKind = 'itp_template' | 'lot_register'` — `frontend/src/pages/projects/copilot/importData.ts:8`.

### 2.6 The certificate path (C2, shipped) — and it stays the only lab-data path

`POST /api/test-results/upload-certificate` (`backend/src/routes/testResults.ts:185`), `POST /:id/certificate?extract=true` (`:220`), `PATCH /:id/confirm-extraction` (`:288`), `POST /batch-upload` ≤10 files (`:315`). Upload: multer, **10 MB**, mimetype allow-list `application/pdf, image/jpeg, image/png, image/jpg` (`certificateStorage.ts:51-62`). Extraction: one Anthropic call per certificate, ten flat fields with per-field confidence (`certificateExtraction.ts:22-32`), 120 s timeout. Nothing extracted is persisted before a human confirms (`testResults.ts:213-217`, `[C2R-B6]`).

**It is a one-document-one-result reader, and after §3 it is what CIVOS has.** Australian labs return PDF certificates (§17, grade B). That remains the shape of the input.

### 2.7 What is not there

- **NOT FOUND:** any threat-model artifact under `docs/` (as C2 §7.3 also recorded).
- **NOT FOUND:** any per-test location, anywhere, in any form.
- **NOT FOUND:** any `sampleLocation` field on `EnterResultsModal` (§2.3a).
- **Stale, and restated `[C3R-A14]`:** C1's exit record says `productKnowledge.ts` contains *zero* occurrences of *sufficiency* (`wave-c1-exit-evidence-2026-07-28.md` item 11). At `5265a649` it contains **two**, at `:19` and `:23`, **both inside comments** — the sufficiency knowledge landed in #1628 and the comments point at it. Clancy still has no *prose* about sufficiency for a user to receive. §15 item 12.

---

## 3. The LIMS question — **answered, and the answer is "not ours"**

Rev 1 §3 was a research gate. **The pass ran** (#1640, `docs/research/c3-lims-format-research-2026-07-28.md`) and answered all seven questions. This section is now a record of the answer and its consequences, not a gate.

### 3.1 What the program rested on, and what was actually there

One appendix row (`C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md:27`), grade `A`, pointing at a 2023 TfNSW PDF that **no CIVOS pass had ever fetched**. Rev 1's §3 predicted two specific failure modes. **Both occurred:**

1. **"The arrow may point the other way."** It does. §3.2.
2. **"The same unread-URL pattern was wrong once already"** (the R44 precedent, `docs/research/c1-pack-confirmation-tfnsw-r44-2026-07-27.md:39`). It was wrong again, differently: the URL resolves to a **superseded edition**. §3.5.

Recorded because it is the argument for running these passes at all: the gate cost one agent-hour and removed a wave-sized limb from the program.

### 3.2 The verdict

**The format is a laboratory's submission to TfNSW.** A NATA-accredited, TfNSW-registered (Category L) laboratory uploads six tables fortnightly over TfNSW's own eMFT portal, as a condition of staying on the Construction Industry Contractor register. Three independent primary sources agree on the direction (research §2, evidence rows 9–11), and **the head contractor appears nowhere in the pipeline**.

| | Why it is not built |
| --- | --- |
| **Export — closed permanently** | Files are keyed on the **laboratory's** NATA accreditation site number; mandatory fields are raw instrument data (nuclear-gauge calibration constants A/B/C, mould and container masses, standard counts) plus Table 2, a complete field-level audit trail of every change made **inside the lab's LIMS**. CIVOS holds none of it. A head contractor producing this file would be **fabricating a lab record** — `[C3S-B1]` one level up (§0.5). |
| **Import — parked on a named blocker** | The files provably exist in a stable, versioned schema, and the lab generates them anyway. A contractor *could* ask for a copy. **Nothing obliges a lab to hand one over**, and the pass found **no evidence at any grade** that labs emit this format to clients (research NOT FOUND #2; QESTLab, the dominant AU construction-materials LIMS, documents AGS and generic CSV export, grade C). That is a **commercial-access question, not a format question** — it needs a real lab conversation, not another research pass. |

**Recommendation to the program: amend plan line 77 clause 2.** *"TfNSW LIMS tabulated ingestion"* describes a flow that does not exist as described.

### 3.3 The one ambiguity, kept honest

Registration criterion 3 requires the lab's LIMS to be capable of providing *"any requested test results and data"* in the format — **it does not say requested by whom**. That is the only textual hook on which a contractor could argue entitlement, it is not a mandate, and the pass found nothing that resolves it. Recorded so nobody rediscovers it and mistakes it for a green light.

A second open thread, from the pass's NOT FOUND #5: whether **TfNSW Q6** places any test-data obligation on the *contractor* as opposed to the lab. The Q6 text sits behind the TfNSW Standards portal and was not obtained. **This is the only thing that could reopen the export question**, and it would reopen it as a different document describing a different artifact.

### 3.4 The prize: Table 1 is a mandated vocabulary for exactly what Phase B builds

The pass's actual deliverable. Table 1 (Metadata, 34 fields, one row per test) is a **published, mandated, government-standard schema for lot and sample spatial location** — and it validates, field by field, design choices Phase B made from first principles:

| Table 1 field (verbatim) | Validates |
| --- | --- |
| `SampleLocationChainageGPSCoordinates` | **The coordinate pair belongs on the test row, not on a separate entity.** One row per test carries its own sample location — the same cardinality §5.2 chose, and the reason C2 §13.1 J1's "`TestResult` **is** the sample record" holds. Note the field name pairs *chainage* with *GPS coordinates*: the authority treats them as **the same fact in two notations**, which is exactly §5.8's position. |
| `SampleLocationOffsetGPSCoordinates` + the Table 1 note *"The 'offset' is relative to the Control Line."* | **Offsets are control-line relative and meaningless without one.** This is the published confirmation of §5.8 item 2: chainage/offset is derivable only for projects that have a `ControlLine` (`schema.prisma:466-483`). It also kills option (i) in §5.1 outright — free text like `'2m LHS'` carries no control-line reference, so it cannot be resolved to a position by any parser. |
| `ControlLine` (a mandated Table 1 field in its own right) | **The control line is a first-class attribute of a sample's location, not an implementation detail.** CIVOS already models it. When §5.8 is built, the projection stores *which* line it projected against. |
| `LotLocationStartChainageGPSCoordinates` / `LotLocationFinishChainageGPSCoordinates` | The **lot** extent is start+finish chainage — which is what the shipped `LotGeometry.kind = 'chainage_offset'` (`schema.prisma:488`) already encodes. No change; a confirmation that the shipped model matches the authority's. |
| `LotLocationLeftOffsetsGPSCoordinates` / `LotLocationRightOffsetsGPSCoordinates` | Left/right offsets are **separate mandated fields**, not a signed scalar. Anyone who later builds §5.8's chainage projection must not collapse them into one signed number without deciding a sign convention — a decision the authority declined to make. |
| `UniqueLotNumber` (mandatory) | The lot number is the join key an authority expects to see on a sample record. `TestResult.lotId` → `Lot.lotNumber` already carries it. |
| `LotLocationLayerNumber`, `LayerLocationRL` | **Vertical position is part of a sample's location and CIVOS does not model it.** A pin is a 2-D answer to a 3-D question on any layered pavement. Named as a known gap in §5.9, not built. |

**How this is used:** as **grade-A vocabulary and validation**, nothing more. No column is renamed to a 40-character PascalCase identifier, no table is reproduced, no file is parsed. When §5.8's chainage/offset limb is eventually built, **these are the field names and semantics it adopts** rather than inventing its own. `[C3S-i]`.

### 3.5 The appendix correction, now specific

`CIVOS-Research-Appendix-2026-07-24.md:27` must be corrected — it is not merely under-caveated, it **cites a superseded edition**:

- **Replace the URL** with the current v6 XLSX (`…/2025/20241119v6-lims-data-submission-requirements.xlsx`), served from the TfNSW *Registration scheme for Construction Industry Contractors* landing page.
- **Edition:** `v6` · **Published:** `2024-08-29` · **Distributed:** `2024-11-05` · **Checked:** `2026-07-28`.
- **Rewrite the "Decision supported" cell.** It currently reads *"C3 lab ingestion format"*. This pass disproves that. It supports **"C3 Phase B spatial vocabulary (Table 1); no ingestion"**.
- **Note in the caveat** that the superseded 2023 PDF is *still deep-linked by TfNSW's own current Registration Scheme guidelines* (Ed 5 Rev 22, Oct 2025, pp 8–9) while the same site's landing page serves v6. **That stale official link is how the appendix acquired the wrong URL.** The appendix author was not careless; the source was.
- **Rev 1's expected currency control does not apply here** and the note should say so: the 2023 PDF carries **no version, edition, revision, date marker or `SUPERSEDED` watermark of any kind**. The currency proof is structural instead — the v6 `Version Control` sheet records that v3 merged Tables 1 and 2 and renamed 4a–4e to 3a–3e, and the 2023 PDF still has the pre-v3 structure.

### 3.6 `[C3S-B6]`, now permanent

**No PR, in this wave or any later one, may** register a `test_register` (or any LIMS) entry in `IMPORT_KINDS` (`importKinds.ts:157-160`); add a `TARGETS_BY_KIND` entry (`mappingProfiles.ts:55-58`); widen `DryRunRow.unit` (`dryRunTypes.ts:55`) or the frontend `ImportKind` union (`importData.ts:8`); add a `sourceFormat` value; add a column to `TestResult` "for LIMS"; or use the words *LIMS-ready*, *LIMS-compatible* or *format-compatible* in any user-facing string, marketing copy, or Clancy knowledge entry.

**What changed in Rev 2:** the prohibition was provisional on a research pass. The pass ran. **It is now permanent**, with one named unlock — a real lab confirming in writing that it will supply the files (§3.2), which unblocks *import only*, never export.

---

## 4. Phase A — the overlay that needs no new data

### 4.1 What it is

A **ninth** toolbar toggle, **Testing**, beside Photos. Armed → the lot polygons recolour from the shipped conformance-status palette to a three-value testing palette, a legend swaps, and a panel lists the shortfalls. Disarmed → the map is byte-identical to today. Entering History disarms it (`[C3R-B5]`).

### 4.2 The colours, and the third one that matters most

| State | Fill | Legend label | Meaning |
| --- | --- | --- | --- |
| `satisfied` | green | **Testing satisfied** | `passingCount >= requiredCount` on every resolved rule. |
| `insufficient` | amber | **N of M verified** | At least one rule short. Copy carries the real numbers from `RuleSufficiency` (`types.ts:439-442`). |
| `unknown` | grey | **No rule** | No ruleset/rule resolved. The cause is displayed from `unknownCauses` (`evaluate.ts:83`, vocabulary `types.ts:410-417`), e.g. *"no pack for this authority"*, *"lot has no canonical activity"*, *"no quantity recorded"*. |
| *(no lot geometry)* | — | *"N lots not on the map"* | Counted in the panel from a `lot.count()`; not drawn. Same honesty as §0.5. |

*(Rev 1 had a fifth row here — an unlocated-test count. **Dropped** `[C3R-A3]`: the columns it counts do not exist until Phase B1. It reappears in B2's pin panel, §5.5.)*

**`unknown` is never coloured as "under-tested" and never coloured as "fine" `[C3S-B7]`.** It means CIVOS has no opinion. Colouring it green would assert compliance CIVOS did not check; colouring it amber would accuse a contractor of a shortfall against a rule that does not exist. Grey, with the reason, is the only honest option — and it doubles as the most useful setup diagnostic in the product, because a project that is all grey is a project whose lots have no activity slug or no quantity.

### 4.3 How it is built (the lazy path)

**0. First, make "one verdict" true `[C3R-B6]`.** Thread the fetcher into `/conform-status`: `qualityRoutes.ts:396` becomes `checkConformancePrerequisites(id, prisma, { regimeFetcher: prismaRegimeStreamFetcher() })`, matching `:313`. Two lines, no new import (`prismaRegimeStreamFetcher` is already imported at `:12`). Without it, this wave ships a slogan with a known counter-example inside the same file. **AT-96.** *(The alternative — deleting a route with zero non-test consumers — is noted in §18.2 and deliberately not taken.)*

1. **Backend:** `GET /api/projects/:projectId/lots/test-coverage`.
   - **Scope to geometry-bearing lots `[C3R-A1]`.** The overlay can only recolour lots that are **drawn**. Take the lot-id set from the same already-subbie-scoped geometry query the map uses (`projectLotGeometries.ts:96-102`), and evaluate **only those**. Everything else in the project resolves to a single `prisma.lot.count()` for the *"N lots not on the map"* line. On a project with 5,000 lots and 400 drawn, this is a 92 % reduction in the batch's input — **the biggest latency lever in the wave**, and it costs one `where` clause.
   - Call `checkConformancePrerequisitesBatch(geometryBearingLotIds, prisma, { regimeFetcher: prismaRegimeStreamFetcher() })` — **the fetcher is mandatory, `[C3S-B5]`**.
   - **Trim the payload `[C3R-A2]`:** `{ lotId, state }` for every lot; `ruleset`, `rules[]` and `unknownCauses` **only** for lots whose state is `insufficient` or `unknown`. The map needs a colour per lot; the panel needs detail only for the lots it lists. A mostly-green project ships a small response.
   - **No new evaluation, no new count, no new query pattern.**
2. **Frontend:** a `useTestCoverage(projectId, enabled)` hook shaped exactly like `useLotStatusTimeline` (`statusTimelineData.ts:27-41`) — lazy on `enabled`, 5-minute `staleTime`/`cacheTime` (`:38-39`; **TanStack Query v4** — `cacheTime`, not `gcTime`).
3. **Recolour `[C3R-A11]`:** `LotGeometryLayer` (`LotMapView.tsx:258-264`) gains an optional **`fillOverride?: string`** — a **resolved colour for that one geometry**, not a Map the child looks itself up in. The parent resolves it at the existing `displayGeometries.map(...)` call site (`:1230-1236`). When present it replaces `getStatusColor(geometry.status)` (`:268`) and nothing else.
   **The naming, stated so it is not a surprise:** `Polygon` uses that colour as `fillColor` behind a constant stroke casing (`:275-283`), but **`Polyline` passes it as `color` — the stroke** (`:288-292`), and `CircleMarker` follows the polygon shape. So on a linear (chainage/offset) lot the testing colour arrives as the **line's stroke**. That is correct — it is already how status reaches a linear lot — and the prop keeps the name `fillOverride` because it overrides exactly what `getStatusColor` fed. `[C3S-g]`.
4. **Panel:** `TestCoveragePanel.tsx`, modelled on `CoveragePanel.tsx` — the shortfall list, the unknown-cause breakdown, the *"N lots not on the map"* count, each row clicking through to the lot.
   **Staleness is stamped, not hidden `[C3R-A9]`:** the panel header reads **"as at 14:32"** from the query's `dataUpdatedAt`, with a manual **Refresh**. A 5-minute cache on a compliance verdict is fine; a 5-minute cache that *looks* live is not.
5. **Loading and error UX, named `[C3R-A13]`:** while the query is in flight the toggle stays pressed, the polygons keep their **status** colours (never a flash of grey — grey is a *verdict*), and the panel shows a skeleton. On error the panel shows *"Testing coverage is unavailable — the map is showing lot status"* with a retry, and the polygons stay on status colours. **A failed fetch must never look like `unknown`.**
6. **Legend:** `StatusLegend` (`LotMapView.tsx:348-360`) swaps to the testing legend while armed.

### 4.4 What Phase A must not do

- Not write anything. It is a `GET` (plus step 0's two-line read-path fix).
- **Not survive History `[C3R-B5]`.** `toggleHistory` (`LotMapView.tsx:749-760`) already disarms every tool and closes Plans *"so nothing that does not make sense against a past date stays open"*. **The Testing toggle joins that list** — and so does the B2 pin layer. The overlay's verdict is computed **now**, from **today's** verified tests; painting it over `displayGeometries`' historical statuses (`:880-889`) would be two different dates in one picture. The reverse is deliberately **not** wired: arming Testing does not exit History. History is the stricter mode and owns the map. AT-95.
- Not change `testSufficiencyMode` (`schema.prisma:377`), not turn a gate on, not block a conform or a claim. The block-mode acceptance gate (`docs/plans/block-mode-gate-status-2026-07-28.md`) is untouched and no C3 phase may move a project's mode.
- Not invent a fourth state, a percentage, or a project-level "testing score". `evaluate.ts:60-62` defines the vocabulary; three values is the vocabulary.
- Not go in the offline map-data cache. §10.3, and **negatively asserted** by `[C3R-A12]`.

---

## 5. Phase B — a pin where the sample was actually taken

**Sliced in two `[C3R]` slicing note:** **B1** = migration + API + tenancy, **no UI**. **B2** = the capture control and the pin layer. §11.

### 5.1 The location question, decided

Three options were live. Two are rejected on the honesty rule `[C3S-B1]`, and the rejections are the cheapest outcomes anyway.

| Option | Verdict |
| --- | --- |
| **(i) Derive a coordinate from `sampleLocation` free text** | **REJECTED.** It needs a control line, an offset sign convention, a chainage datum and a format the text does not carry; the shipped corpus contains at least three incompatible conventions in the same column (§2.2); and part of that column is itself a **machine guess off a filename at confidence 0.4** (`certificateExtraction.ts:62-73`). A derived pin would also move silently whenever someone edits a text field. **Now confirmed against a published authority (§3.4):** the mandated schema pairs offsets with an explicit `ControlLine` field precisely because an offset without one is not a position — and free text carries no control-line reference. |
| **(ii) Fall back to the lot centroid** | **REJECTED.** `featureCentroid` exists and would make this a one-line change (`frontend/src/pages/lots/map/lotMapHelpers.ts:208-231`) — which is exactly why it needs an explicit refusal. A centroid pin **asserts** the sample was taken at the middle of the lot. The lot polygon is already on the map, so the pin adds no information and one false claim. Zero code is also less code. |
| **(iii) Capture the location explicitly, at the moment a human knows it** | **ADOPTED.** Two mechanisms, both already in the codebase: **Pick on map** (primary) and device GPS (secondary). §5.4. |

**A "the text says CH 1000+50 — place the pin there?" proposal** is a legitimate future feature and is explicitly **deferred** (`[C3S-c]`). It is a *proposal a human confirms*, not a derivation — but it needs a control line, a parse dictionary and a confirm step, and it is worth nothing until people are capturing locations at all. Flip condition: a pilot project with a control line asks for it.

### 5.2 The columns

Four, all nullable, on `TestResult`, mirroring `Document.gpsLatitude/gpsLongitude` (`schema.prisma:1589-1590`) and `ITPCompletion.gpsLatitude/gpsLongitude` (`:728-729`):

```prisma
/// Wave C3 Phase B1. Where the sample was taken, WGS84. Written ONLY from an
/// explicit human capture (a map tap or a device GPS fix) [C3S-B1] — never
/// derived from `sampleLocation` text, never defaulted to a lot centroid.
/// Vocabulary validated against TfNSW LIMS v6 Table 1
/// `SampleLocationChainageGPSCoordinates` (spec §3.4).
sampleLatitude          Decimal? @map("sample_latitude")
sampleLongitude         Decimal? @map("sample_longitude")
/// 'gps' | 'map_pick' — provenance of the pair above. NULL iff both are NULL.
/// A future imported source adds a value here; it never overloads an existing one.
sampleLocationSource    String?  @map("sample_location_source")
/// Metres, from the GPS fix that produced the pair. NULL for 'map_pick' and for
/// any unlocated row. Unrecoverable after capture, which is why it is captured
/// [C3R-A4] — a +/-40 m pin and a +/-4 m pin are different evidence.
sampleLocationAccuracyM Decimal? @map("sample_location_accuracy_m")
```

`sampleLocation` (`:867`) is **untouched and remains the human-readable location of record**. The pair is an addition to it, not a replacement: a chainage string is what appears on a lab request and a conformance certificate (`frontend/src/lib/pdf/testCertificatePdf.ts:174`), and a decimal degree pair is not. *(The mandated schema agrees — §3.4 carries chainage and GPS coordinates in the same field name.)*

**No new index in v1** `[C3S-e]`. The pin query rides `@@index([projectId])` (`:906`) with a bbox filter and the shipped `RESULT_CAP` of 500 — the identical choice the photo layer already makes, which filters GPS in the DB against `Document`'s `[projectId, documentType]` index with no GPS index at all (`spatialSearch.ts:145-163`, indexes `schema.prisma:1617-1621`). *ponytail: no coordinate index; add one when a project's located-test count makes the bbox scan measurable, not before.*

### 5.3 The constraints, at the trust boundary `[C3R-B7]`

`sampleLocationSource` is user-supplied `TEXT` reaching the database through a PATCH body. Prose rules do not survive the next route that forgets them, so the rules live in the schema. §7 has the SQL verbatim. Three:

1. **Pair-null** — `sample_latitude IS NULL` ⟺ `sample_longitude IS NULL`. Half a coordinate is not a location.
2. **Source-null-iff** — `sample_location_source IS NULL` ⟺ `sample_latitude IS NULL`. Provenance without a coordinate is noise; a coordinate without provenance is unattributable evidence.
3. **Source enum** — `sample_location_source IN ('gps', 'map_pick')` or NULL. Mirrored by a Zod `z.enum(['gps', 'map_pick'])` at the route so the user gets a 400, not a 500.

**The honesty note that belongs with it.** A `CHECK` constraint proves the *shape* of provenance, never its *truth*. Nothing stops a user tapping "Pick on map" on a point they never stood at, and nothing could. `sampleLocationSource` records **which control the user used**, not that the user was there. **Provenance is enforced by tests and by review, not by structure** — the constraints stop malformed and unattributed rows, and `[C3S-B1]` (no CIVOS-fabricated location) is the invariant that is actually testable. Do not let the constraints be cited as more than they are.

### 5.4 Capture, on the one surface where a person can know the answer `[C3R-B3]`

**Where: `CreateTestModal.tsx` only**, beside the Sample Location input (`:318-325`). `EnterResultsModal` is **excluded by design** — it has no location field, it is the days-later lab-results form, and a GPS button there would stamp the office (§2.3a).

**The order is deliberate — Pick on map is primary:**

| Control | Label | Why |
| --- | --- | --- |
| **📍 Pick on map** *(primary)* | *"Pick on map"* | The honest default. A test is frequently *requested* from the office for a sample point someone else will take, or has taken. Picking says "here is where the sample is", which is what the user actually knows. |
| **Use my location** *(secondary)* | **"I'm at the sample point now"** | The label states its own precondition. A button called *"Use my location"* is true and useless; this one is a question the user answers by not pressing it. |
| **Clear** *(once set)* | shows the coordinate + provenance + accuracy | Removing a wrong pin must be as easy as setting one. Clearing writes all four columns back to NULL — which constraints 1 and 2 (§5.3) require to happen together. |

**Implementation path, corrected `[C3R-B4]`.** Rev 1 said "prefer `useLotAtMyLocation`". That hook **wraps** `useGeoLocation` (`useLotAtMyLocation.ts:15`), inherits its fire-on-mount and store writes, fetches every project geometry (`:16`), and returns **a lot, not a coordinate** (`:18-24`). It cannot do this job.

- **Use `useGeoLocation` directly**, adding an **`immediate?: boolean`** option (default `true`, so no existing caller changes) guarding the mount effect at `useGeoLocation.ts:83-85`. The modal passes `immediate: false` and calls `refresh()` from the button. This is the smaller of the two available diffs — the alternative, accepting the fire-on-mount, would ask for a GPS permission prompt every time anyone opens the create-test form.
- **Accept the foreman-store writes** (`:34`, `:50`, `:59-60`). They are idempotent setters for the user's own current location; a real fix landing there is not wrong. *ponytail: not worth a second hook to avoid.*
- **`MAX_ACCURACY_M = 30` moves to the call site.** It is a `useLotAtMyLocation` local (`:12`), not a shared export. A fix coarser than 30 m is **rejected with its number shown** — *"GPS accuracy ±85 m — too coarse for a sample point. Pick on map instead."* — never silently discarded, and never silently saved.
- **`maximumAge: 0`.** The hook's default is `60_000` (`useGeoLocation.ts:22`) — a one-minute-old fix is fine for suggesting which lot you are standing in and **wrong for a sample point**, where a minute is a truck-length of walking.
- **`accuracy` is persisted** into `sampleLocationAccuracyM` for `'gps'` captures `[C3R-A4]`; `'map_pick'` writes NULL there.
- **Map pick** reuses the existing map in pick mode via the tool-toggle machinery (`LotMapView.tsx:708-760`).
- **Validation:** `parseOptionalGpsCoordinate` (`backend/src/routes/itp/completionValidation.ts:36-67`) already exists, already range-checks, already throws `AppError.badRequest`. Use it.

**Capture is optional and never gates anything (J2).** No status transition, no verification, no conform and no claim may require a coordinate. A required field here would add a tap to a field flow whose standard is *"frequent field actions < 2 minutes"* (program line 66) and would push people to accept whatever the GPS said from the site office.

### 5.5 Rendering, and the tenancy shape that goes with it `[C3R-B1]`

**The layer.** A module-level `TEST_PIN_ICON` beside `PHOTO_PIN_ICON` (`LotMapView.tsx:104-115`) in a **deliberately distinct colour** from both the violet photo pin and every status fill; a `TestPin` component modelled on `PhotoPin` (`:317-346`); an armed toggle with its own `localStorage` key `siteproof.mapTests.${projectId}`, **default off**, outside the mutually-exclusive tool set (`:547-561` is the pattern) but **inside `toggleHistory`'s disarm list** (`[C3R-B5]`, §4.4); viewport-debounced refetch (`:678-689`).

**The popup shows provenance and accuracy `[C3R-A5]`:** test type, status, pass/fail, **"GPS ±6 m"** or **"Picked on map"**, and a link to the test. A pin whose accuracy is unstated invites a reader to trust it more than it deserves.

**The data path — copy the PHOTO query shape, not the test one.** Extend the shipped `only` parameter (`spatialSearch.ts:54`) from `z.literal('photos').optional()` to `z.enum(['photos', 'tests']).optional()`. In `tests` mode, the query is built the way the **photo** query at `:145-167` is built, **not** the way the existing test query at `:170-185` is built:

1. **DB-side bbox on the test's own coordinates** — `sampleLatitude: { gte: south, lte: north }`, `sampleLongitude: { gte: west, lte: east }`, alongside `projectId`. (This alone also excludes every unlocated test: NULL fails both range predicates.)
2. **`take: RESULT_CAP + 1`** — the shipped test query has **no `take` at all** (`:175-185`); the photo query has it at `:153` so `cap()` can still detect truncation from the one extra row. The bounded version is the one that gets copied.
3. **App-side subcontractor filter, explicit** — `t.lotId != null && visibleLotIds!.has(t.lotId)` for subcontractors, exactly `:164-167`. **This is the whole finding.** In `tests` mode there are no `intersectingLotIds`, so the transitive scoping that protects the shipped query (§2.3) is gone; without this line a subcontractor sees every located test in the project. **`TestResult.lotId` is nullable (`schema.prisma:860`)**, so an unlinked located test would otherwise leak to a subbie as well — the `!= null` half is not defensive noise.
4. **`cap()` after the filter**, as photos do at `:168` — a scoped subbie may legitimately see fewer than `RESULT_CAP`.
5. The two coordinate columns, `sampleLocationSource` and `sampleLocationAccuracyM` join the select.

**Frontend coercion** reuses `toCoord` and the shape of `normaliseSpatialPhotoCoords` (`frontend/src/pages/lots/map/spatialSearchData.ts:26-45`) — Prisma `Decimal` arrives as a string, `Number('')` is `0`, and a blank coordinate must not become the Gulf of Guinea. `SpatialTestResult` (`:47-54`) gains the four fields.

**Unlocated tests are counted, never drawn.** The panel reads *"14 tests in view · 9 with a captured location · 5 without"*. `[C3S-B1]`. *(This is the count `[C3R-A3]` moved out of Phase A — it lives here, where the data exists.)*

### 5.6 Editing a location

A `verified` row requires `TEST_VERIFIERS` to PATCH at all (`crudRoutes.ts:251-255`, guard reading `testResult.status === 'verified' && !TEST_VERIFIERS.includes(userProjectRole)`). Beyond that, two changes, both small:

**1. The audit already exists — extend it, don't add one `[C3R-A7]`.** `crudRoutes.ts:404-412` already calls `createAuditLog({ action: AuditAction.TEST_RESULT_UPDATED, changes: updateData, ... })` on every PATCH. It records **new** values only. The pre-image is already in hand — `prisma.testResult.findUnique({ where: { id } })` at `:236-238` selects the whole row. **So old values are a two-line addition** at the existing call site: when any of the four location keys is in `updateData`, include the previous values. No new audit site, no new action.
*(Rev 1 cited `workflowRoutes.ts:427-435` as the pattern. That is not an audit site. The real `TEST_RESULT_*` audit sites are `workflowRoutes.ts:178-186` (rejected), `:269-277` (verified) and `:480-488` (status changed). Corrected.)*

**2. All four keys join the exemption list `[C3R-A8]` `[C3S-f]`.** `NON_SUBSTANTIVE_EDIT_FIELDS` at `crudRoutes.ts:367` is currently `['itpChecklistItemId', 'expectedResultDate']`, and `hasSubstantiveEdit` at `:368-370` iterates **`Object.keys(updateData)`** — so **any key not named in that list un-verifies the row**. Naming "the coordinate" in prose would leave three of the four keys resetting a verified test to `entered`. The list becomes:

```ts
const NON_SUBSTANTIVE_EDIT_FIELDS = [
  'itpChecklistItemId',
  'expectedResultDate',
  'sampleLatitude',
  'sampleLongitude',
  'sampleLocationSource',
  'sampleLocationAccuracyM',
];
```

The trust-boundary comment above it (`:355-366`) says *"anything added here is asserting 'this field is not evidence'"*. **A location IS evidence — and that is precisely why it is exempted.** Correcting a mistyped pin is not a new *result*; the result was verified on the sample, not on the pin. Un-verifying a passing test because someone dragged a marker three metres would destroy the count the whole wave exists to display. **The audit row is the control**, and it is why change 1 above is a precondition of change 2, not an optional companion. AT-93 asserts each of the four keys individually — a single-key test would pass while three keys stayed broken.

### 5.7 Where else a location is shown

The test detail view renders coordinate, provenance and accuracy in the same words as the pin popup (`[C3R-A5]`) — *"Sample point: −33.8688, 151.2093 · GPS ±6 m"* — and, where absent, *"No location captured"*. `sampleLocation` free text renders as it does today, unchanged and above it: the words are the record; the pin is the position.

### 5.8 What Phase B does not touch

`conformancePrerequisites.ts:408-416` selects five `TestResult` fields and the regime fetcher's nested `testResults` select (`sufficiency/prismaStream.ts:43-51`) takes four — `testType`, `passFail`, `status`, and the nested `itpChecklistItem.testType`. New columns appear in **neither**, so no readiness path reads them, no count moves, no snapshot changes. AT-81/AT-88.

### 5.9 The chainage sentence, and why it still does not come back

C1 dropped *"no sample for CH 1,240–1,310"* from the explanation text and assigned its return to C3 (`wave-c1-test-sufficiency-spec-2026-07-26.md:720`, `:957`, `:1362`). **It does not return in v1.** It needs three things:

1. **A per-test coordinate** — Phase B1/B2 delivers this.
2. **A projection of that coordinate onto a control line to yield a chainage and an offset** — buildable with the shipped `@turf/turf` (`backend/package.json:54`) and `ControlLine.geometryWgs84` (`schema.prisma:472`), **and only for projects that have a control line**. §3.4 is now the published confirmation of that precondition: the mandated schema carries `ControlLine` as a field of the sample's location, and states that *"the 'offset' is relative to the Control Line."* **When this is built, it adopts §3.4's field names and semantics** — including left and right offsets as **separate** values, which the authority declined to collapse into a signed scalar. `[C3S-i]`.
3. **A rule limb that declares spatial coverage a requirement** — no shipped pack declares one, and `requiredTestCount` (`counts.ts:49-59`) has no spatial term. This is a pack-class change, not a map feature.

**A fourth thing, newly visible and newly named.** Table 1 mandates `LotLocationLayerNumber` and `LayerLocationRL` — **vertical** position. CIVOS models neither, and a 2-D pin is an incomplete answer on any layered pavement, where three samples at the same chainage on three lifts are three different tests. Recorded as a known gap so the pin is not mistaken for a complete location. Not built: no shipped pack has a vertical term either.

**Flip condition:** a confirmed authority pack declares a spatial-distribution requirement.

---

## 6. Phase C — closed

**Phase C is not built, in either direction.** §3.2 has the reasoning; this section records the disposition so it can be read cold.

- **Export: closed permanently.** §1.2. Its only conceivable reopener is the research pass's NOT FOUND #5 (whether TfNSW Q6 obliges the *contractor*), and that would be a different artifact under a different name.
- **Import: parked on a named blocker.** `'test_register'` stays reserved in `ImportBatch.kind` (`schema.prisma:2041`) and unimplemented in `IMPORT_KINDS` (`importKinds.ts:157-160`). **What changed is what it is parked on.** Rev 1 parked it on an unread document. It is now parked on **research NOT FOUND #2: no evidence at any grade that laboratories supply these files to their clients.** That is answered by a lab saying yes in writing, not by another research pass.
- **The Wave B debt is discharged by that sentence.** `wave-b-migration-importer-spec-2026-07-26.md:371` parks the test-register importer on *"the Wave C sample/test lifecycle model is final"*. **The model is final** (C2 §13.1 J1: `TestResult` **is** the sample record). The importer is now parked on a *different, named* blocker. §15 item 9 requires that amendment be written back — C2 exit item 8 asked for it and **NOT FOUND** at `5265a649`.
- **If it is ever unblocked, it rides the Wave B envelope, not the certificate path `[C3S-a]`.** A grid of many rows, reviewed as a grid, reconciled against tests that already exist, with a rollback if the mapping was wrong, is the envelope's entire purpose — and `DryRunOutcome` already includes `'update'` with `DryRunCounts.willUpdate` (`dryRunTypes.ts:10`, `:75-82`), supported and unexercised by both shipped kinds. **This decision now has evidence rather than inference:** the format is 34 metadata fields per test across six separate files, one row per test, parameters as columns (research §1) — a grid, not a document.
- **And it would need a file-upload threat model first** (§10.2), inheriting C2's deferred `[C2L-B12]`.

**Everything else Rev 1 §6.2–6.3 speculated about — the dedup key, `TARGETS_BY_KIND` targets, the `DryRunRow.unit` value, whether `sourceFormat` needs a fourth value — is deleted rather than carried forward.** It was reasoning about a file CIVOS will not receive. If the access question is ever answered yes, it is a fresh spec against a real sample file, and the research report's §1 (field counts, naming conventions, cardinality, formats) is its starting point.

---

## 7. Data model and migrations

**Phase A: no migration.** Phase C: none, ever, as scoped.

**Phase B1: ONE additive migration — `20260729000000_test_sample_point`.**

```sql
ALTER TABLE "test_results" ADD COLUMN "sample_latitude"            DECIMAL(65,30);
ALTER TABLE "test_results" ADD COLUMN "sample_longitude"           DECIMAL(65,30);
ALTER TABLE "test_results" ADD COLUMN "sample_location_source"     TEXT;
ALTER TABLE "test_results" ADD COLUMN "sample_location_accuracy_m" DECIMAL(65,30);

-- [C3R-B7] Half a coordinate is not a location.
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_sample_point_pair_check"
  CHECK (("sample_latitude" IS NULL) = ("sample_longitude" IS NULL));

-- [C3R-B7] Provenance without a coordinate is noise; a coordinate without
-- provenance is unattributable evidence. Neither may exist alone.
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_sample_location_source_pair_check"
  CHECK (("sample_location_source" IS NULL) = ("sample_latitude" IS NULL));

-- [C3R-B7] The value is user-supplied TEXT at a trust boundary. Mirrored by a
-- Zod z.enum(['gps','map_pick']) at the route so users get a 400, not a 500.
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_sample_location_source_enum_check"
  CHECK ("sample_location_source" IS NULL
         OR "sample_location_source" IN ('gps', 'map_pick'));
```

Four nullable columns, three constraints, no index, no backfill, no default, no data movement, no drop. The column shape matches the C2 Phase 3 migration exactly (`backend/prisma/migrations/20260728090000_c2_lab_lifecycle_stamps/migration.sql:11-12`).

**`sample_location_accuracy_m` is deliberately unconstrained.** Constraining it to `> 0`, or to null-when-`map_pick`, would buy nothing the two pair constraints do not already cover, and a zero or absent accuracy on a GPS row is a fact worth recording rather than rejecting. *ponytail: add a range check when a real value proves nonsense, not before.*

**On what the constraints do and do not prove:** see §5.3's honesty note. They enforce shape. They cannot enforce that anyone stood where they tapped.

**There is no backfill and there cannot be one.** No historical row carries a coordinate, and deriving one from `sampleLocation` is forbidden `[C3S-B1]`. Every existing test starts unlocated, and the panel says so. Stated here so nobody writes a "helpful" backfill later.

**Production apply** follows the established procedure (reviewed Prisma migration, `prisma migrate deploy` from a workstation against a fresh backup, never `db push`, never `--accept-data-loss`, Railway start/pre-deploy commands stay blank). Per C1's residual improvement, **record the apply as a comment on the PR at apply time**, not only in a session transcript.

---

## 8. Invariants C3 must not break

| Tag | Invariant | Proof |
| --- | --- | --- |
| `[C3S-B1]` | No fabricated location — no centroid pin, no text-derived coordinate, no unconfirmed AI coordinate. **And no CIVOS-generated laboratory record** (§0.5). | AT-84, AT-85 |
| `[C3S-B2]` | No parallel engine. `evaluateSufficiency` stays pure and synchronous; C3 adds no cached verdict, no recalculation job, no second evaluator. Inherited from `[C2L-B3]`. | AT-83, AT-89 |
| `[C3S-B3]` | No count changed. The characterization corpus regenerates to an empty diff. Inherited from `[C2L-B1]`. | AT-81 |
| `[C3S-B4]` | No snapshot changed. `RequirementEvaluation.result` byte-identical; `resultSchemaVersion` still `1`. Inherited from `[C2L-B2]`. | AT-88 |
| `[C3S-B5]` | The overlay's verdict equals the lot page's verdict, for the same lot, at the same instant — including the regime fold. **And so does `/conform-status`'s, which it did not before this wave** `[C3R-B6]`. | AT-82, **AT-96** |
| `[C3S-B6]` | **No LIMS artifact of any kind, permanently** (§3.6). No `IMPORT_KINDS` / `TARGETS_BY_KIND` / `DryRunRow.unit` / `ImportKind` / `sourceFormat` change; no *LIMS-ready* / *LIMS-compatible* / *format-compatible* copy. | §15 item 6 (`git diff` check, **scoped to the wave's diff** `[C3R-A6]`) |
| `[C3S-B7]` | `unknown` is never rendered as satisfied and never as insufficient — **and a failed or in-flight fetch is never rendered as `unknown`** `[C3R-A13]`. | AT-86 |
| `[C3S-B8]` | Nothing in C3 moves a test to `verified`, and no C3 phase changes `testSufficiencyMode`. | AT-90 |
| `[C3S-B9]` | Sufficiency still never blocks a claim; `getClaimBlockingReasonsForConformedLot` (`conformancePrerequisites.ts:192`) output is byte-identical. Inherited from `[C2L-B11]`. | AT-87 |
| `[C3S-B10]` | No bulk map-tile prefetch, and no new runtime-caching rule without bounded entries and age. | `pwaRuntimeCaching.test.ts:75-80` |
| **`[C3S-B11]`** | **A subcontractor never receives a test on a lot they are not assigned, and never an unlinked test, in any `spatial-search` mode** `[C3R-B1]`. **The wave's only security-shaped risk.** | **AT-92** |

---

## 9. API and UI surface

### 9.1 Backend

| Phase | Change |
| --- | --- |
| A | **FIXED** `GET /api/lots/:id/conform-status` — supply `prismaRegimeStreamFetcher()` at `qualityRoutes.ts:396`, matching `:313`. Two lines. `[C3R-B6]` |
| A | **NEW** `GET /api/projects/:projectId/lots/test-coverage`. Read-only. Batches **geometry-bearing lots only** `[C3R-A1]`; payload trimmed `[C3R-A2]`. Mounted beside the other project-scoped map routes (`backend/src/server.ts:150-156`). |
| B1 | **MIGRATION** §7 — four columns, three constraints. |
| B1 | **EXTENDED** `POST /api/projects/:projectId/spatial-search` — `only` widens to `'photos' \| 'tests'` (`spatialSearch.ts:54`); in `tests` mode the query **copies the photo shape**: DB bbox on the test's own coordinates, `take: RESULT_CAP + 1`, app-side `visibleLotIds` + `lotId != null` filter, then `cap()`. `[C3R-B1]` |
| B1 | **EXTENDED** `POST /api/test-results` and `PATCH /api/test-results/:id` (`crudRoutes.ts`) — accept and persist the four columns; coordinates validated by `parseOptionalGpsCoordinate` (`backend/src/routes/itp/completionValidation.ts:36`), source by `z.enum(['gps','map_pick'])`. `NON_SUBSTANTIVE_EDIT_FIELDS` (`:367`) gains all four keys `[C3R-A8]`; the existing audit call (`:404-412`) gains old values `[C3R-A7]`. Guards unchanged: `TEST_CREATORS` (`accessControl.ts:32-39`), and `TEST_VERIFIERS` (`:41`) for a `verified` row (`crudRoutes.ts:251-255`). |
| B1 | All four columns added to the response shapers that already return `sampleLocation`. |
| C | **NOTHING.** §6. |

### 9.2 Frontend

| Phase | Change |
| --- | --- |
| A | `useTestCoverage` hook; `TestCoveragePanel.tsx` (with the *"as at HH:MM"* stamp + Refresh `[C3R-A9]`, and the named loading/error states `[C3R-A13]`); **`fillOverride?: string`** prop on `LotGeometryLayer` (`LotMapView.tsx:258-264`), resolved by the parent at `:1230-1236` `[C3R-A11]`; a testing legend in `StatusLegend` (`:348-360`); a **ninth** `ToolbarButton` (`:479-517`, cluster `:1060-1128`) added to `toggleHistory`'s disarm list (`:749-760`) `[C3R-B5]`; a `queryKeys.ts` entry beside `projectCoverage` (`frontend/src/lib/queryKeys.ts:15`). |
| B2 | `TEST_PIN_ICON` + `TestPin` (mirroring `:104-115`, `:317-346`), popup showing provenance + accuracy `[C3R-A5]`; the **tenth** toolbar toggle + `localStorage` key, also in the History disarm list; the capture control in **`CreateTestModal.tsx` only** `[C3R-B3]`; `immediate?: boolean` added to `useGeoLocation` `[C3R-B4]`; `SpatialTestResult` gains the four fields (`spatialSearchData.ts:47-54`); provenance + accuracy on the test detail. |
| — | **`LotMapView.test.tsx:25-61` mocks every react-leaflet primitive as a passthrough div. Any new primitive must be added there or the suite breaks.** |

### 9.3 Permission matrix

| Action | Who | Cite |
| --- | --- | --- |
| See the testing overlay | Internal project roles only, v1 (J3) | §10.1 |
| See test pins | Anyone who can already see the test — including a subcontractor, **scoped explicitly to assigned lots, `lotId != null`** | §5.5, `[C3S-B11]` |
| Capture / change a test location | `TEST_CREATORS` (`accessControl.ts:32-39`) | §9.1 |
| Change it on a `verified` row | `TEST_VERIFIERS` (`accessControl.ts:41`, guard `crudRoutes.ts:251-255`), audited, non-un-verifying (§5.6) | AT-93 |
| Verify a test | `TEST_VERIFIERS` — **unchanged by this wave** | `[C3S-B8]` |
| Import lab results | **Not built, and not planned** | §3, §6 |

---

## 10. Security, tenancy and privacy

### 10.1 Tenancy — the wave's one security-shaped risk `[C3R-B1]`

**Say it plainly: Phase B1 introduces a new tenancy surface, and Rev 1 said it did not.** Widening `only` looks like a parameter change, but `only=tests` replaces the filter that carried the scoping. The shipped test query is safe *because* it filters on `intersectingLotIds`, which come from a subbie-scoped geometry query (§2.3). A bbox on the test's own coordinates has no such derivation. **The photo query is the shape to copy precisely because it already has this problem and solves it explicitly** (`spatialSearch.ts:145-167`), and `TestResult.lotId` being nullable (`schema.prisma:860`) means the `!= null` half of that filter is load-bearing, not decorative.

**AT-92 asserts it**, with a subcontractor, an unassigned lot whose test's captured coordinate is **inside** the box, and an unlinked located test. It is an exit-gate item (§15 item 10) and `[C3S-B11]`.

Phase A adds one route, and it takes `checkProjectAccess` plus, per J3, **`requireInternalProjectAccess`** — the stricter guard `projectCoverage.ts:131` already uses for the coverage report, the closest analogue in both content and sensitivity. Its lot set comes from the same already-scoped geometry query the map uses (`projectLotGeometries.ts:96-102`) `[C3R-A1]`.

**J3, and the recommendation.** A sufficiency shortfall is CIVOS's computed judgement about whether a subcontractor's work has been tested enough. Publishing that judgement into a subcontractor portal as a colour makes a contractual conversation into an automated accusation, at a point where the pack is `warn`-mode advisory on every project and one NSW pack still ships `draft` (`wave-c1-test-sufficiency-spec-2026-07-26.md:1320`). **Internal-only for v1**; revisit when a pilot head contractor asks. Test **pins** are different and stay on the existing scoping — a subbie seeing where a sample was taken on their own lot is a fact, not a verdict.

### 10.2 Threat model

Program §7 line 134 gates C2, D2, E and A3 on a threat-model artifact; C3 is not on that list, and **NOT FOUND:** any such artifact under `docs/`. C3 adds **no upload surface, no external link, no unauthenticated route and no new file parser** — the one thing in the wave that would have needed one was Phase C, which is now closed (§6). **If the import question is ever unblocked, the file-upload threat model is a hard precondition**, inheriting C2's deferred `[C2L-B12]`. Recorded, not quietly passed.

### 10.3 Data sensitivity, and the deliberate offline refusal

The coordinate pair is a **work-site** location, not a person's location — but it is captured from a person's device, so it is minimised the same way the photo GPS path minimises: stored only when explicitly captured, never continuously, never as a track, and cleared with the record. `sampleLocationAccuracyM` is a property of the fix, not of the person.

**The testing overlay is deliberately NOT added to `MAP_DATA_URL`** (`pwaRuntimeCaching.ts:32-33`). That rule is `NetworkFirst` with a 7-day cache (`:75-83`), which would serve a **stale compliance verdict** to a field user with no network — the single most dangerous thing this wave could cache. Offline, the layer states it is unavailable. **`[C3R-A12]` makes this a test rather than a paragraph:** `/api/projects/p-1/lots/test-coverage` is appended to `pwaRuntimeCaching.test.ts:63-72`'s negative `it.each`. Test **pins** ride `spatial-search`, which is a POST and already in that same negative list, so they are online-only too, exactly like photo pins. `[C3S-d]`

---

## 11. Phases and PR slicing

**Rev 2 slices Phase B in two.** Rev 1's single Phase B mixed a migration, a tenancy change and two UI surfaces in one PR — and the tenancy change is the one thing in the wave a reviewer must be able to see on its own. Each phase is independently shippable, independently revertible, and useful on its own.

### Phase A — the testing overlay + the conform-status fetcher fix (M) — *ships first*
- **Depends on:** nothing. C1 is shipped (`docs/plans/wave-c1-exit-evidence-2026-07-28.md`).
- **Why first:** it is the only phase with no migration and no new data, and it makes a wave of already-shipped engine work visible for the first time. It also carries the two-line `[C3R-B6]` fix, which is a correctness bug on a shipped route.
- **Zero behaviour change by construction**, except the intended one: one GET, one optional prop defaulting to `undefined`, one toggle defaulting to off — plus `/conform-status` starting to agree with `/readiness`.
- **Exit:** AT-81, AT-82, AT-83, AT-86, AT-87, AT-88, AT-89, AT-90, AT-91, AT-94, AT-95, AT-96.

### Phase B1 — the columns, the constraints, the API, the tenancy (S/M) — *no UI*
- Migration §7 (four columns, three constraints); `only=tests` with the photo-shaped query `[C3R-B1]`; POST/PATCH accepting the four columns; the exemption-list and audit changes (§5.6).
- **Why alone:** the tenancy change is the wave's one security-shaped risk. A reviewer reading a diff that is a migration + one query + one filter can see it. A reviewer reading that plus a modal plus a map layer cannot.
- Ships **inert**: no UI writes a coordinate yet, so every column stays NULL and every `only=tests` response is empty.
- **Exit:** AT-81, AT-85, AT-88, **AT-92**, AT-93.

### Phase B2 — capture and pins (M)
- The capture control on `CreateTestModal` (map-pick primary), `useGeoLocation`'s `immediate` option, the pin layer, the popup, the panel counts, the test-detail display.
- **Exit:** AT-84, AT-94, AT-95, AT-97, plus the 360 px viewport check `[C3R-A10]`.

### Phase C — **CLOSED**
- Not built in either direction. §3, §6. Recorded so it can be read cold rather than silently reopened.

### Deliberately outside C3
- **Controlled overrides / tenant rulesets** — J4, §1.3.
- **The chainage-gap sentence** — §5.9, now with grade-A vocabulary waiting for it (§3.4).
- **Vertical position** (layer number / RL) — §5.9.

---

## 12. Scale and performance `[C3R-B2]`

Measured against the program's reference dataset (5,000 lots, 10,000 map features, 50 GB evidence, 10k-row registers — plan line 138).

**Rev 1 claimed this route inherits an accepted p95 < 3,000 ms budget. It does not, and the claim is withdrawn.** Three corrections, stated rather than papered over:

1. **There is no passing measurement to inherit.** `wave-c1-exit-evidence-2026-07-28.md` exit item 8 is **`⛔ OPEN`** — *"Target 1 has no passing measurement on any C1 tree"*. Every C1-era run is over the revised 3 s budget, on the branch and on its own base: **3,091 / 3,218 · 3,990 / 4,334 · 3,390 / 3,716 · 3,393 / 3,250 ms**. The budget was revised 2 s → 3 s on a **pre-C1** 2,964 ms measurement.
2. **A claim-perf fix is in flight — pending, not done.** It is referenced here as the reason the numbers above may move, not as a reason to assume they have. **No C3 PR may cite it as a passing measurement.**
3. **Rev 1 conflated two paths, and picked the wrong one.** C1's 63–92 ms and 163–258 ms figures are **claim-readiness pages**, not the batch. The 3–4 s series is claim **creation**. And **the overlay is heavier than either**, because it always supplies `prismaRegimeStreamFetcher` (`sufficiency/prismaStream.ts:29-54`) — a grouped `lot.findMany` per stream with a **nested `testResults` select carrying a nested `itpChecklistItem`**. That is the fetcher C1's measured path may or may not have exercised depending on the fixture.

**So: the honest position is that no measurement exists for this route, and this wave does not close C1's open budget item.**

| Path | Position | Note |
| --- | --- | --- |
| `GET .../lots/test-coverage`, reference dataset | **No budget inherited. The number must be MEASURED and named in the PR body** (§15 item 8). It is a **lazy, armed, 5-minute-cached** fetch — never on a page render — so a slow first paint of the panel is a very different failure from a slow page. | Closest measured analogue is a **3.2–4.3 s series that is itself over budget** and belongs to a *lighter* shape. C1 exit item 8 stays **OPEN** and is not closed by this wave. |
| The lever that makes it survivable | **Batch geometry-bearing lots only** `[C3R-A1]`, plus a trimmed payload `[C3R-A2]` | A 5,000-lot project with 400 drawn lots evaluates **400**, not 5,000. This is applied before any measurement is taken, so the measurement is of the shipped shape. |
| Query count on that route | Constant in lot count — one `lot.findMany`, at most one `holdPoint.findMany`, at most one legacy-checklist `findMany`, plus at most one grouped query per distinct regime stream (`conformancePrerequisites.ts:856-868`), plus one `lot.count()` | AT-91 asserts it does not grow with N. |
| Conformance + claim-readiness paths | **Zero additional queries**, unchanged | AT-89 |
| `/conform-status` after `[C3R-B6]` | Gains **at most one grouped query per regime-bearing stream**, and **zero** when no rule in the resolved set is regime-bearing (`sufficiency/prismaStream.ts:26-27`) | The cost of the route being correct. Named, not hidden. |
| `spatial-search?only=tests` | One bounded query, `take: RESULT_CAP + 1`, then an app-side filter | `spatialSearch.ts:145-163` is the shape; note the **shipped** test query has no `take` and the new mode does. |
| Map render | 10,000 features at interactive frame rates (plan line 142) | Phase A adds no features — it recolours existing ones. Phase B2 adds markers, capped at 500 per viewport. |

*ponytail, with the ceiling named:* Phase A deliberately reuses the **full** conformance batch rather than a narrower sufficiency-only select, because reuse is what guarantees `[C3S-B5]`. **The ceiling is that route's p95, and it is unmeasured;** the upgrade path, if the measurement is unacceptable, is a sufficiency-only lot select feeding the *same* `resolveSufficiencyBatch` + `evaluateSufficiency` pair (`resolve.ts:215`, `evaluate.ts:450`) — narrowing the query, never forking the verdict. `[C3R-A1]`'s geometry-bearing scope is the first, free version of that narrowing.

---

## 13. Rollback and recovery

| Phase | Rollback |
| --- | --- |
| A | Revert. Nothing was written; the toggle defaults off; `fillOverride` is optional. The `/conform-status` fetcher fix reverts with it — note that reverting it restores the **wrong** verdict, so prefer reverting the overlay alone. |
| B1 | Revert the code; **leave the columns and the constraints.** Four nullable, unindexed, unread columns cost nothing; the constraints hold over an all-NULL table trivially. Dropping them would destroy every location a crew captured. |
| B2 | Revert the UI. Captured coordinates remain readable via the API and remain valid under the constraints. |
| C | N/A — nothing was built. |

**Data-loss risk: none.** No column is dropped, no row is deleted, no value is overwritten by any C3 code path. Phase B's only write is a coordinate a human supplied, into a column that was NULL.

---

## 14. Acceptance tests

Continuing the shared series — C1 ended at AT-21, D14 at AT-55b, F1 at AT-62, C2 at AT-80. **C3 starts at AT-81.** Every item is a real assertion in a real test file.

| AT | Phase | Assertion | Where |
| --- | --- | --- | --- |
| **AT-81** | A, B1 | **No count changed.** The regenerated characterization corpus (`backend/src/lib/readiness/characterization/`) produces an empty diff; `predicates.parity.test.ts` extended with the four new columns present and populated. `[C3S-B3]` | `backend/src/lib/readiness/` |
| **AT-82** | A | **One verdict, two surfaces.** For a seeded project spanning all three states, every `lotId` returned by `GET .../lots/test-coverage` has a `state` **identical** to `sufficiency.state` from `GET /api/lots/:id/readiness` for the same lot — **including a lot whose regime fold differs from `full`**, which fails if the route omits `prismaRegimeStreamFetcher`. `[C3S-B5]` | new `testCoverage.db.test.ts` |
| **AT-83** | A | **No second engine.** The route calls `checkConformancePrerequisitesBatch`; `git diff` touches none of `sufficiency/counts.ts`, `evaluate.ts`, `regime.ts`, `predicates.ts`, `snapshot.ts`, `testCategories.ts`. `[C3S-B2]` | mechanical, in the PR body |
| **AT-84** | B2 | **No fabricated pin.** A test with `sampleLocation = 'CH 1000+50, 2m LHS'`, a lot with a polygon geometry, and NULL coordinates returns **no** coordinates from every read path and renders **no** marker; it is counted in "without a location". `[C3S-B1]` | `spatialSearch.test.ts` + `LotMapView.test.tsx` |
| **AT-85** | B1 | **The columns are written only by explicit capture, and only in valid shapes.** Creating a test with only `sampleLocation` leaves all four columns NULL; **each of the three `CHECK` constraints rejects its own violation at the DB** (lat without lng; source without coordinates; `source='inferred'`); an out-of-range coordinate is a 400 from `parseOptionalGpsCoordinate`; an unknown source is a 400 from the Zod enum, not a 500. `[C3S-B1]` `[C3R-B7]` | `crudRoutes` coverage + a DB-backed constraint test |
| **AT-86** | A | **`unknown` is its own colour and carries its cause — and only `unknown` gets it.** A lot with no ruleset renders grey with the `no_ruleset_for_project` copy and is excluded from the shortfall list; **a loading and a failed fetch both render lots on their STATUS colours, never grey.** `[C3S-B7]` `[C3R-A13]` | `TestCoveragePanel.test.tsx` |
| **AT-87** | A, B1 | **Claims still unblockable.** `getClaimBlockingReasonsForConformedLot` returns byte-identical output with the overlay route exercised and with located tests present — extending AT-11/AT-71. `[C3S-B9]` | `conformancePrerequisites.test.ts` |
| **AT-88** | A, B1 | **No snapshot changed.** `RequirementEvaluation.result` is byte-identical for a lot before and after the columns exist and are populated; `resultSchemaVersion` still `1`. `[C3S-B4]` | `recordDecision.db.test.ts` |
| **AT-89** | A, B1 | **Query count unchanged** on `checkConformancePrerequisites` and the claim-readiness batch. | `readiness` benchmark |
| **AT-90** | A, B | **Nothing verifies, nothing switches mode.** No C3 code path writes `status='verified'`, `verifiedById`, `verifiedAt` or `Project.testSufficiencyMode`. `[C3S-B8]` | grep assertion + route coverage |
| **AT-91** | A | **The batch stays constant-query, and scopes to drawn lots.** The route's query count for 5 geometry-bearing lots equals its count for 500 (± the per-stream grouped reads); **a project with 500 lots of which 40 have geometry evaluates 40**, with the other 460 reported by a single count. `[C3R-A1]` | `testCoverage` benchmark |
| **AT-92** | **B1** | **Tenancy — the wave's one security assertion `[C3S-B11]`.** `spatial-search?only=tests` for a subcontractor returns only tests on assigned lots: **(a)** a test on an **unassigned** lot whose captured coordinate is **inside** the box is absent; **(b)** a test with `lotId = NULL` whose coordinate is inside the box is absent; **(c)** an internal user in the same project sees both; **(d)** a cross-company `projectId` is refused; **(e)** `testResultsTruncated` is true at `RESULT_CAP + 1` rows. | `spatialSearch.test.ts` |
| **AT-93** | B1 | **A verified row's location edit is audited and does not un-verify — for all four keys.** PATCHing **each** of `sampleLatitude`, `sampleLongitude`, `sampleLocationSource`, `sampleLocationAccuracyM` on a `verified` row (as `TEST_VERIFIERS`) leaves `status='verified'` and `verifiedById`/`verifiedAt` intact **and** writes a `TEST_RESULT_UPDATED` audit row carrying **previous and new** values; a PATCH that also changes `resultValue` **does** un-verify; the same PATCH as a non-verifier is 409. `[C3S-f]` `[C3R-A7]` `[C3R-A8]` | `crudRoutes` coverage |
| **AT-94** | A, B2 | **Offline behaviour is honest.** `MAP_DATA_URL` does **not** match `/api/projects/p-1/lots/test-coverage` (appended to the negative `it.each` at `pwaRuntimeCaching.test.ts:63-72`) and does not match `spatial-search`; the bounded-entries/age assertion still passes over every rule; offline, the layers state they are unavailable rather than showing stale data. `[C3S-d]` `[C3S-B10]` `[C3R-A12]` | `pwaRuntimeCaching.test.ts` + `LotMapView.test.tsx` |
| **AT-95** | A, B2 | **History disarms Testing.** With the Testing overlay and the pin layer both armed, pressing **History** leaves both disarmed and the map on historical statuses; the reverse (arming Testing while in History) is **not** wired and the Testing toggle is unavailable in History mode. `[C3R-B5]` | `LotMapView.test.tsx` |
| **AT-96** | A | **`/conform-status` agrees with `/readiness`.** For a lot whose regime fold differs from `full`, `GET /api/lots/:id/conform-status` and `GET /api/lots/:id/readiness` return the **same** `sufficiency.state` and the same per-rule `requiredCount`. **This test fails at `5265a649`** and is the proof `[C3R-B6]` was real. | `routes/lots/conformanceSufficiency.db.test.ts` |
| **AT-97** | B2 | **Capture is honest at the edges.** A GPS fix with `accuracy > 30` is refused **with its number shown** and writes nothing; a successful GPS capture persists `sampleLocationAccuracyM`; a map pick persists NULL accuracy and `source='map_pick'`; **Clear** nulls all four together; `EnterResultsModal` has **no** capture control. `[C3R-B3]` `[C3R-B4]` `[C3R-A4]` | `CreateTestModal.test.tsx` + `EnterResultsModal.test.tsx` |

---

## 15. Exit gate

1. **`[C3S-B3]` proven, not asserted** — AT-81's regenerated corpus diff is empty and is shown in the PR body.
2. **`[C3S-B5]` proven twice** — AT-82 **and AT-96** green. *One verdict, everywhere* is the claim Phase A lives or dies on, and AT-96 is the half Rev 1 would have shipped false.
3. **`[C3S-B1]` proven** — AT-84, AT-85 and AT-97 green, and the PR body states in one line that no location is ever derived or defaulted.
4. **A real project round-trips, owner Jay:** open the lot map on a live project → **Testing** on → at least one lot in each of the three states, each matching its own lot page → create a test, **pick the sample point on the map** → the pin appears there → create a second test at the sample point using GPS → its accuracy shows in the popup → a third test with no location is counted, not drawn.
5. **`[C3S-B4]` and `[C3S-B9]` green** — AT-88, AT-87.
6. **`[C3S-B6]` checked mechanically, scoped to the wave `[C3R-A6]`:** `git diff origin/master...HEAD` touches **none** of `importKinds.ts`, `mappingProfiles.ts`, `dryRunTypes.ts`, `importData.ts`, and the strings `LIMS`, `lims`, `LIMS-ready`, `LIMS-compatible` and `format-compatible` appear nowhere **in the wave's diff** outside this spec. *(A tree-wide grep is meaningless: `LIMS` already appears in `d14-q6-pack-spec-2026-07-27.md`, `wave-c1-test-sufficiency-spec-2026-07-26.md`, `wave-c2-test-lifecycle-spec-2026-07-28.md` and the research report.)*
7. **The offline refusal is deliberate, stated and asserted** — AT-94 green including the new negative `it.each` entry, and the PR body says why a compliance verdict is not cached.
8. **§12's number is MEASURED and named in the PR body, not inherited.** No C3 PR may cite `[C1C-14]`'s budget as accepted, and none may cite the in-flight claim-perf fix as a passing measurement. **C1 exit item 8 remains OPEN after this wave** and the PR body says so. `[C3R-B2]`
9. **The Wave B debt is discharged** — `wave-b-migration-importer-spec-2026-07-26.md:371` is amended to record that the C2 model is final and that `'test_register'` is parked on a **named commercial-access blocker** (research NOT FOUND #2), not on an unread document. (C2 exit item 8 required this; **NOT FOUND** as of `5265a649`.)
10. **Tenancy green, and reviewed on its own** — AT-92 green, in the **B1 PR**, whose diff contains no UI. `[C3S-B11]`
11. **The appendix row is corrected** per §3.5 — v6 XLSX, edition, published/checked dates, and a rewritten "Decision supported" cell. **And plan line 77 clause 2 is flagged for amendment.**
12. **Docs and the Clancy knowledge mirror updated** (standing boundary, plan line 5) — the overlay, its three states, and what a captured test location means. **Restated at HEAD `[C3R-A14]`:** `backend/src/routes/copilot/chat/productKnowledge.ts` now contains **two** occurrences of *sufficiency*, **both in comments** (`:19`, `:23`) — C1's "zero occurrences" record is stale, but the substance is unchanged: no user-facing prose explains the verdict. A C3 PR that teaches Clancy the map overlay without teaching it the underlying verdict would make that worse.
13. **The mobile map still works at 360 px `[C3R-A10]`** — with the ninth and tenth toolbar items present, a 360 px viewport check shows the toolbar wrapping without clipping and leaving usable map. The container is `flex-wrap` (`LotMapView.tsx:1059`), so the failure mode is a stolen row, not a hidden button — check how much map is left.
14. **`npm run fallow:audit` verdict recorded in every PR body.**

**Not in this gate:** anything about Phase C. It is closed, not deferred (§6).

---

## 16. Decisions

### 16.1 Jay's decisions

1. **J1 — Commission the LIMS confirmation pass?** ✅ **DISCHARGED.** Commissioned and delivered (#1640). One agent-hour; outcome: **Phase C closed**, an appendix row corrected, a program line flagged for amendment, and a grade-A spatial vocabulary harvested for Phase B (§3.4). Recorded as the argument for the next one of these.
2. **J2 — Is capturing a test location optional, or required for field-entered tests?**
   **Optional, always, and never a gate.** *One-line why:* a mandatory field on a two-minute field flow gets satisfied by whatever the GPS said from the site office, which is a fabricated location with a provenance stamp on it — the exact failure `[C3S-B1]` exists to prevent. **Strengthened in Rev 2:** `[C3R-B3]` showed the same failure was designed *in* on `EnterResultsModal`, so the surface itself is gone.
3. **J3 — Does the testing overlay reach subcontractors, or internal roles only?**
   **Internal only for v1** (`requireInternalProjectAccess`, the guard `projectCoverage.ts:131` already uses). *One-line why:* a shortfall is CIVOS's advisory judgement about a subbie's work — every project is still in `warn` mode and one NSW pack is still `draft` — and that is a conversation, not a portal colour. Pins stay on the existing scoping, **now enforced explicitly** (`[C3S-B11]`).
4. **J4 — Split "controlled overrides" (the third clause of plan line 77) out of C3?**
   **Yes — split it, sequence it after F0's definition model.** *One-line why:* it shares a wave number with this work and nothing else, and building an override store here would be the third place this program has invented a definition table ahead of F0.
5. **J5 — Ninth *and tenth* toolbar buttons on the mobile map: shell go-ahead needed? `[C3R-A10]`**
   **No — build them.** *One-line why:* the map toolbar is not foreman shell chrome (the shell-touch boundary is the 48 px/sync-centre work, plan line 116), and the mobile map already carries eight buttons plus the register view switcher (#1438). **Flagged, with a check attached** rather than assumed: §15 item 13 requires a 360 px pass on Phase B2.

### 16.2 The spec's own decisions

- **`[C3S-a]` — If LIMS import is ever unblocked, it rides the Wave B envelope, not the certificate path.** §6. *Rev 2: now evidence-backed rather than inferred* — the format is six tables of one-row-per-test with parameters as columns, a grid. *Flip condition:* none foreseeable; the inversion Rev 1 imagined (one-document-one-result) is disproved.
- **`[C3S-b]` — One import kind (`test_register`), not a LIMS sibling.** §6. Moot while parked. *Flip condition:* a real file proves a register migration and a lab file cannot share a dry-run.
- **`[C3S-c]` — No chainage-text proposal in v1.** §5.1. *Flip condition:* a pilot with a control line asks, at which point it is built as a human-confirmed proposal, never a derivation.
- **`[C3S-d]` — The testing overlay is not cached offline.** §10.3, now test-asserted `[C3R-A12]`. *Flip condition:* none foreseeable — a stale compliance verdict in the field is worse than an unavailable one.
- **`[C3S-e]` — No coordinate index in v1.** §5.2, matching the shipped photo-GPS choice. *Flip condition:* a project's located-test count makes the bbox scan measurable.
- **`[C3S-f]` — A coordinate edit is exempt from the substantive-edit reset, and audited — all four keys.** §5.6 `[C3R-A8]`. *Flip condition:* an auditor argues a location correction is a new result.
- **`[C3S-g]` — `fillOverride?: string` resolved per child, not a synthesised `status` and not a Map.** §4.3 `[C3R-A11]`. Writing a non-status value into `status` would make `StatusLegend` and every downstream reader of that field lie. *Flip condition:* none.
- **`[C3S-h]` — `ponytail:` the over-build here is several times the code for zero additional answered questions.** A spatial rule limb, a `TestLocation` model, a derived-chainage service, a tenant override table, a LIMS parser — and the research pass proved the last of those would have been written against a file CIVOS will never receive.
- **`[C3S-i]` — When chainage/offset is built, it adopts TfNSW LIMS v6 Table 1's field vocabulary.** §3.4, §5.9. Control-line-relative offsets, left and right kept separate, start/finish chainage for the lot extent. *One-line why:* it is a mandated government schema for exactly this, obtained at grade A, and inventing a second vocabulary next to it would be a choice to be non-standard. *Flip condition:* an authority CIVOS actually serves publishes a conflicting one.
- **`[C3S-j]` — Phase C is closed, not deferred.** §3, §6. *Flip condition, named and singular:* a real laboratory confirms in writing that it will supply TfNSW LIMS-format files to the head contractor. That unblocks **import only**. **Export has no flip condition** short of a different document placing the obligation on the contractor (research NOT FOUND #5).

---

## 17. Research register

| Item | Supplies | Grade | Status |
| --- | --- | --- | --- |
| **`docs/research/c3-lims-format-research-2026-07-28.md` (#1640)** | The LIMS answer: direction (lab→TfNSW), v6 edition, six tables / 34+ fields, fortnightly eMFT submission, **and Table 1's mandated lot/sample spatial schema** | **A** (30 evidence rows, 26 at grade A; 5 explicit NOT FOUNDs) | **DISCHARGED.** Closes Phase C (§3, §6); supplies §3.4 and `[C3S-i]`. |
| `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md:27` | The original TfNSW LIMS row | **A on source class; the cited URL is a SUPERSEDED edition** | **NEEDS CORRECTION** per §3.5 — v6 XLSX, edition/date fields, rewritten "Decision supported". |
| `CIVOS-Research-Appendix-2026-07-24.md:28` | Australian labs return PDF certificates; 1–5 business days; **no universal lab API** | **B**, self-caveated (*"two labs ≠ the industry — treat as directional"*) | Sufficient to justify §1.2's "no live lab integration". Insufficient for any SLA. **Now corroborated in direction** by NOT FOUND #2. |
| `docs/research/c1-pack-confirmation-tfnsw-r44-2026-07-27.md` | The precedent that an unread grade-`A` appendix URL was **wrong** | **A** | §3.1. The pattern recurred, differently. |
| `docs/research/c1-pack-confirmation-vicroads-204-2026-07-27.md`, `docs/research/c1-q6-pavements-2026-07-27.md` | The confirmation-pass anatomy C3.0 reproduced; the `pdftotext -table` gotcha (`c1-q6-pavements-2026-07-27.md:95`) | **A** | **The gotcha recurred** — `-layout` misaligned the 2023 PDF's field/definition tables by one row; the pass took all schema claims from the v6 XLSX sheet XML instead. |
| `docs/research/feature-gap-research-2026-07-13.md`, `docs/research/international-competitor-research-2026-07-14.md` | CivilPro ships chainage lot mapping; the moat is the modality | **B/C** | Already priced into plan line 13. C3 changes nothing here. |

**Must be researched before it is encoded — never inferred:** whether laboratories will supply LIMS files to contractors (research NOT FOUND #2 — **a lab conversation, not a research pass**); whether TfNSW Q6 places test-data obligations on the *contractor* (NOT FOUND #5 — the only export reopener); whether any authority pack declares a **spatial distribution** requirement (§5.9 — none of the shipped packs does); laboratory accreditation metadata (C4, plan line 78 — note the LIMS format carries `AccreditationSiteNumber`); chain-of-custody (C4 — **zero** occurrences of *"chain of custody"* in `docs/` or `tasks/`, as C2 §14.2 recorded).

---

## 18. Verification notes — derived at `5265a649`

### 18.1 Citations corrected in Rev 2

Rev 1 was written at `a21cb3c7`. `5265a649` adds one docs-only commit (#1640), so **no source line moved**; every correction below is a Rev 1 error or a reviewer error, not drift.

| Claim | Rev 1 said | Reviewer said | **Correct at `5265a649`** |
| --- | --- | --- | --- |
| `/conform-status` returns sufficiency | `qualityRoutes.ts:84` | *"`:84` is inside the decision tx"* | **Reviewer right.** `:84` is inside `lotConformanceSnapshot` (`:63-87`), the decision-transaction snapshot builder. The route is `:370`, its call `:396`, **and it supplies no fetcher at all.** `[C3R-B6]` |
| `TEST_CREATORS` | `accessControl.ts:32-39` | `:31-38` | **`:32-39`** — Rev 1 was right; the review is off by one. `export const TEST_CREATORS = [` is line 32. |
| `TEST_VERIFIERS` | `accessControl.ts:41` | `:40` | **`:41`** — Rev 1 was right. |
| `unknownCauses` | `evaluate.ts:81` | `:83` | **`:83`** for the field on `SufficiencyEvaluation` (`:81` is `rules: RuleSufficiency[]`); computed at `:467`, returned at `:524`. **Reviewer right.** |
| `RuleSufficiency` counts | `types.ts:439-441` | `:438-441` | **`types.ts:435`** for the interface; the **four** counts at **`:439-442`** (`requiredCount`, `passingCount`, `pendingCount`, `failedCount`). **Both documents were wrong** — Rev 1 dropped `failedCount`, the review shifted the start. |
| The substantive-edit audit pattern | `workflowRoutes.ts:427-435` | *"real audit sites `:178-186`/`:269-277`/`:480-488`"* | **Reviewer right.** `:427-435` is not an audit site. Confirmed at HEAD: `TEST_RESULT_REJECTED` `:178-186`, `TEST_RESULT_VERIFIED` `:269-277`, `TEST_RESULT_STATUS_CHANGED` `:480-488` — and the one C3 actually extends is `crudRoutes.ts:404-412`. |
| `LotGeometryLayer` | `:258-312` | `:258-264` | **Both right.** `:258-312` is the component, `:258-264` its signature; mapped call site `:1230-1236`. Carried unchanged. |
| Toolbar buttons | *"the eight buttons `:1060-1131`"* | *"ninth AND tenth"* | **Eight, `:1060-1128`.** Testing is ninth, the pin toggle tenth. Container `flex-wrap` at `:1059`. |
| `toggleHistory` | `:749-760` | `:749-760` | **Both right, `:749-760`.** The comment above it at `:746-748` states the rule the `[C3R-B5]` fold relies on. |
| `statusTimelineData` cache | `:38-39` | `:38-39` | **Both right, `:38-39`** (`cacheTime` `:38`, `staleTime` `:39`; TanStack Query **v4**). |
| `prismaRegimeStreamFetcher` | *(not cited)* | `prismaStream.ts:33-53` | **`backend/src/lib/readiness/sufficiency/prismaStream.ts:29-54`** — note the path includes `sufficiency/`, which Rev 1 omitted in §5.6. Zero-query note at `:26-27`. |
| `productKnowledge` sufficiency hits | *(cited C1's "zero")* | *"2 comment-only hits `:19`, `:23`"* | **Reviewer right.** Exactly two, both in comments. C1's exit record is stale on the count, unchanged on the substance. |

C1-spec citations used here (`:151`, `:260-262`, `:720`, `:957`, `:1092`, `:1127`, `:1320`, `:1362`) and the C2-spec `[C2L-B4]` citation (`:464`) were re-opened at `5265a649` and are correct as printed. Rev 1's §18.1 table of C2→`a21cb3c7` schema drift (+7 after line 881) still holds and is not repeated.

### 18.2 Observations for whoever builds this — none blocking

1. **`GET /api/lots/:id/conform-status` has zero non-test consumers.** `grep -rn conform-status frontend/src backend/src` returns only its own definition (`qualityRoutes.ts:368`, `:370`) and six test files. **Deleting it was the alternative to `[C3R-B6]`'s two-line fix** and would have been less code. It is **not taken**: a shipped API surface is not removed without a Jay call, and a route that is merely unused is not a route that is unusable. Recorded so the choice is visible rather than accidental. *ponytail: fix now, delete when someone confirms nothing external calls it.*
2. **`LotMapView.tsx` is 1,376 lines with eight toolbar buttons and five mutually-exclusive tools** (`:708-760`). Phases A and B2 add two more toggles. Neither belongs in the exclusion set (both are passive layers, like Photos at `:556-561`) but both belong in `toggleHistory`'s disarm list (`[C3R-B5]`) — and that asymmetry is itself the signal: the file is at the point where the **next** feature after these should extract the toolbar and a layer registry rather than add an eleventh `useState`. Not C3's to do; noted so it is not discovered twice.
3. **The shipped `spatial-search` test query has no `take`** (`:175-185`), unlike the photo query (`:153`). It is bounded only by `cap()` after the rows are in memory, and by the size of `intersectingLotIds` (itself capped at 500 lots — but 500 lots can carry many thousands of tests). **The new `only=tests` mode fixes this for itself.** Fixing the shipped path is a one-line change in the same file and would be a reasonable rider on the B1 PR; it is not required by this spec because it changes a shipped response shape (`testResultsTruncated` could start returning `true`).
4. **Five client-only test form fields are silently dropped on every submit** — `sampleDepth`, `materialType`, `layerLift`, `sampledBy`, `specificationRef` (`frontend/src/pages/tests/types.ts:73-98`, defaults `constants.ts:265-287`; none is destructured by `crudRoutes.ts` or persisted). **The Phase B capture control must not become the sixth** — its fields have real columns (§7). Note `layerLift` is the client-side ghost of §3.4's mandated `LotLocationLayerNumber`: someone already knew it mattered. Cleaning up the other five is out of scope and worth its own small PR.
5. **`itpChecklistItemId` still has no index** (`schema.prisma:861`, indexes `:906-910`) despite being the strong-match key in the conformance gate. Not C3's to fix; recorded for the fourth time.
6. **`ITPCompletion.gpsLatitude/gpsLongitude` (`schema.prisma:728-729`) are written but never rendered on any map.** An ITP-completion pin layer is the obvious sibling of Phase B2 and would need no migration at all. Deliberately out of scope — a different record type with a different meaning — but if B2's pin layer is built generically enough to take a second source later, that is where it goes.
7. **`GET /:id/request-form` and `GET /:id/workflow` remain dead frontend-side** (C2 `[C2R-B1]`). Still true at `5265a649`. Not C3's.

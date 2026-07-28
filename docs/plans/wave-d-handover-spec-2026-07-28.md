# Wave D Execution Specification — handover: the folio is a compilation, and the asset record is not ours to author

**Date:** 28 July 2026 · **Rev 1** · **Status:** D1 is implementation-ready in four phases. **D2 and D3 are BLOCKED on a D.0 research confirmation pass** (§3) and, for D2, on a named external milestone that is Jay's to reach (§5.3). No D2 or D3 code is written until D.0 is merged.

**All `file:line` citations were opened in this worktree at HEAD `bd3bf36a02dd934860f41024dcb5e17a6f99ddac`** (= `origin/master`, `feat(map): C3 Phase B2 — sample-point capture + test pins (#1653)`). Citations carried in from the current-state survey and not personally re-opened are marked in §18.2; everything load-bearing in §2, §4 and §7 was re-derived.

**Program contract:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` §3 Wave D, **lines 81–92** — D1 at line 82, D2's eight clauses at lines 83–91, D3 at line 92. Also §5 line 117 (Jay decision 3, the D2 jurisdiction order), §5 line 119 (design partners / Highways AU — the D2.1 counterparties), §7 line 134 (threat model gated before D2), §8 lines 138–146 (performance targets), §9 line 149 (this document's existence), §10 line 152 (the evidence-grade scheme), §4 line 110 (survey modelling is a deliberate non-build).

**Research contract:** `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md` §C, **lines 51–59** — the nine Wave D claim rows and their grades. Line 59 is the one explicitly marked `UNVERIFIED`. §G line 98 is the standing never-assert list.

**Parent specs, read not remembered:**
- `docs/plans/f0-execution-spec-2026-07-24.md` — **line 23** parks "new evidence-link tables" on D1, **line 35** parks `ExceptionOrWaiver` on D1, and **line 167 item 4** parks the docket/diary readiness inputs on D1 as a "wire in D1 or drop" product decision. This spec discharges all three (§4.5, §7, §16.1).
- `docs/plans/wave-c3-spatial-tests-lims-spec-2026-07-28.md` — the C3.0 precedent this spec's §3 copies deliberately, and the source of the sample-point columns D2 would one day link against.
- `docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md`, `docs/plans/wave-c2-test-lifecycle-spec-2026-07-28.md` — the evidence whose completeness a folio asserts.
- `docs/plans/wave-e-approvals-spec-2026-07-28.md` + `docs/plans/wave-e0-threat-model-2026-07-28.md` — the gated-artifact-before-code pattern D.0 reproduces on the research axis rather than the security axis.
- `docs/plans/spatial-lot-map-spec-2026-07-13.md` — the shipped spatial program D2 would have to extend.

**House style** matches the C1, C2, C3, E, D14, F1 and sync-centre specs: numbered sections, an explicit disposal of every clause of the program lines, a current-state map read at a named SHA, a decision register with flip conditions, per-phase rollback, named acceptance tests continuing the shared series, an exit gate.

**Tag namespace.** `[DH-*]` (**D**, **H**andover) for this spec's own decisions, `[DH-B*]` for the invariants it must not violate. `[C1C-*]`, `[C1R-*]`, `[C2L-*]`, `[C2R-*]`, `[C3S-*]`, `[C3R-*]`, `[D14R-*]`, `[D14X-*]`, `[E-*]`, `[ER-*]`, `[SC-*]`, `[F1C-*]` and `[WBR2-*]` are taken. `[DH-*]` returns zero hits across `docs/` at this SHA. **Never use a bare `D` tag** — `D14` is a live C1 slice name and `D1`/`D2`/`D3` are program clause names, not tags.

**Acceptance-test numbering.** The highest allocated number at this SHA is **AT-118** (`docs/plans/wave-e-approvals-spec-2026-07-28.md:800`). Wave D takes **AT-119 onward**. Several specs are being authored concurrently in this session; whoever merges second re-bases their block rather than reusing numbers.

**Ponytail note.** This wave looks like the biggest in the program and its first three shippable phases add **one new table, one new column on an existing table, one new dependency, and no new PDF renderer at all**. That is not scope evasion — it is the consequence of two findings in §2: the "lot conformance folio PDF" the program asks for is already generated today in four authority formats (`conformanceReportPdf.ts:168`), and the async/lock/retry/checksum/storage machinery a bulk export needs is already built and running for scheduled reports (`scheduledReports.ts:1322`). What is genuinely missing is *persistence with an identity* — CIVOS renders a conformance report and then throws it away. The expensive half of Wave D is D2, and the honest answer for D2 today is that nobody in this program has read an ADAC schema.

---

## 0. What this wave is, and the two things it must never do

### 0.1 The one-paragraph version

A project manager can see, at any moment and without asking anyone, which lots are ready to hand over and exactly what is missing from the ones that are not — using the same blocker vocabulary the lot page and the claim screen already use, never a second opinion. When a lot is closed out, the conformance report CIVOS already draws becomes an **issued folio**: stored, checksummed, attributed, and versioned, so that the document handed to the client in March is still byte-identical in October. At handover, those issued folios plus the original evidence files are assembled by a background job into one archive with a searchable manifest — an assembly job that renders nothing and therefore cannot quietly produce a different document than the one that was issued. And CIVOS does not build an as-constructed asset record, in this wave or any wave, until somebody has read an ADAC schema and confirmed that the contractor is in the pipeline at all.

### 0.2 The honesty rule this wave turns on `[DH-B1]`

**A folio is a compilation, not an assertion. CIVOS states what evidence exists and what is absent; it never certifies conformance, never fills a gap, and never silently changes a document it has already issued.**

Concretely, and enforced by AT-121 / AT-127 / AT-129:
- A folio for a lot with three of five test certificates present lists **two as missing, by name** — it does not omit them, does not round the count, and does not print "conformance achieved".
- The word "certified", "certifies", "compliant" or "approved by CIVOS" appears nowhere in any folio artefact. The folio reproduces decisions that named humans made, with their names and timestamps.
- Re-generating a folio for a lot produces a **new version** with a new id and a new checksum. The previous version stays downloadable and unaltered. Nothing in the system rewrites an issued artefact in place. This is program line 82's *"re-generation never silently alters historical content"*, and it is satisfied structurally rather than by convention (§4.2).
- The bulk archive **collects issued folios; it never renders one**. A lot with no issued folio appears in the manifest as `folio: none` — a fact — and not as a freshly rendered PDF that claims to be the historical record (§4.3, `[DH-B2]`).

### 0.3 The second rule, one level up `[DH-B3]`

**CIVOS never authors survey geometry, a coordinate, a level, or a certification.** Program line 86 states this for D2. It is restated here as an invariant because the pressure to violate it is real and arrives disguised as convenience: CIVOS holds lot polygons (`LotGeometry`, `schema.prisma:485`), chainage/offset (`Lot`, `:551-554`) and now sample points (`TestResult`, `:894-903`), and it would be a short step to "derive" a pipe centreline from a lot polygon and call it as-constructed. That derived line would be a survey claim CIVOS did not receive, in the same failure class as `[C3S-B1]`'s lot-centroid pin, one level up and with a legal certification attached to it.

**The technical proof that this rule is not optional is in the codebase.** `backend/src/lib/spatial/crs.ts:13-20` deliberately treats GDA94 and GDA2020 as WGS84-aligned (`towgs84=0,0,0`), accepting ~1.8 m of GDA94 error, with an explicit `ponytail:` note that no 7-parameter datum shift exists. That is a correct decision for a map display and a **disqualifying** one for an as-constructed asset record submitted to a council. CIVOS's coordinate stack is not survey-grade and is not going to become survey-grade; it can carry, link to and re-emit a surveyor's coordinates unchanged, and that is the whole of its role.

### 0.4 The C3.0 precedent, applied deliberately

Wave C3 planned three limbs. One of them — "TfNSW LIMS tabulated ingestion" — rested on a cited grade-A appendix row that **nobody had opened**. When someone finally read the document (`docs/research/c3-lims-format-research-2026-07-28.md`, #1640), it described a laboratory's fortnightly submission *to* TfNSW; the head contractor appears nowhere in the pipeline, and a CIVOS-generated submission would have been a fabricated lab record. The limb was closed, not built. The research pass cost one PR; building the limb first would have cost a wave.

**D2 has exactly the same shape and a larger blast radius.** The program's ADAC position was already corrected once (Rev 1.2: 12d Model already generates and validates ADAC; the versions are council-specific and moving; CIVOS has no asset model). That correction fixed the *competitive* premise. It did not touch the *directional* premise — who produces the file, who submits it, and whether the head contractor ever holds it. §3 turns that into a blocking research pass, **D.0**, on the same terms C3.0 ran on.

---

## 1. Outcome, scope and non-goals

### 1.1 Outcome

**D1:** a live handover-readiness view over the existing readiness engine; an issued, versioned, checksummed lot conformance folio; and a background-assembled project archive with a manifest. Shipped in four independently releasable phases, three of which are unconditional and one of which (CCTV) is gated on D.0-Q3.

**D2:** not built in Rev 1. §5 specifies the gate, the questions, the acceptance milestone, and the boundary the eventual design must respect. The data model is deliberately *not* designed here — designing it before D.0 would encode guesses as schema.

**D3:** not built in Rev 1. §6 states why the evidence available today does not support scoping it, and what would change that.

### 1.2 Every clause of program lines 82–92, disposed of

| Program clause (line) | Disposition |
| --- | --- |
| "live handover readiness by project/area/activity/lot" (82) | **D1a.** Built over the shipped engine, using the already-written `HandoverReadinessVerdict` contract (`futureConsumers.ts:111-120`). §4.1. |
| "configurable requirements" (82) | **DEFERRED out of D1**, deliberately, with the reason recorded. §4.5, `[DH-c]`. |
| "lot conformance folio PDF (progressive AND bulk)" (82) | **D1b** (progressive: issue at any time, versioned) + **D1c** (bulk: archive assembly). §4.2, §4.3. |
| "project rollup" (82) | **D1a.** The same verdict at `subjectType: 'project'`, which the shipped contract already admits (`futureConsumers.ts:112`). §4.1. |
| "searchable manifest + checksums" (82) | **D1c.** Manifest as CSV + JSON at archive root; SHA-256 per file, reusing `calculateScheduledReportArtifactSha256` (`artifacts.ts:177`). §4.3. |
| "deterministic folder export" (82) | **D1c.** Ordering and path rules specified in §4.3.3 and asserted by AT-128. |
| "async generation with recovery" (82) | **D1c.** Reuses the scheduled-report worker anatomy — conditional-`updateMany` claim, stale-lock reclaim, failure backoff, resume-incomplete-run (`scheduledReports.ts:176-197`, `:451-484`, `:661-701`). §4.3.4. |
| "CCTV (WSA 05-2020) linkage for drainage" (82) | **D1d, GATED on D.0-Q3.** The artefact's shape is unknown; two candidate scopes differ by an order of magnitude. §4.4. |
| "re-generation never silently alters historical content" (82) | **`[DH-B1]`/`[DH-B2]`**, satisfied structurally: issued folios are immutable rows, bulk assembly never renders. §4.2.4, AT-127, AT-129. |
| D2 clauses 1–8 (83–91) | **BLOCKED on D.0** (§3) and on the real-council acceptance milestone (§5.3). Boundary and non-negotiables specified; data model deliberately not designed. §5. |
| D3 (92) | **BLOCKED on D.0-Q10.** §6. |

### 1.3 Non-goals — the over-build this wave explicitly forbids

Each of these is a thing a reasonable engineer would drift into. None is in scope.

1. **No asset-management product.** No asset register UI, no maintenance schedule, no condition rating, no defect-liability period tracker, no O&M manual builder, no warranty register. Program line 110 already names asset/survey modelling a deliberate non-build; this restates it at the feature level.
2. **No survey engine.** No coordinate authoring, no level/RL computation, no volume or surface modelling, no datum transformation beyond the display-grade one that ships. `[DH-B3]`.
3. **No ADAC authoring from scratch.** If D2 is ever built, it imports survey-controlled assets and re-emits them with evidence links. It never composes an asset from CIVOS's own geometry. Program line 86; `[DH-B3]`.
4. **No new "handover" lot status.** `Lot.status` (`schema.prisma:585`) gains nothing. Handover readiness is *computed*, exactly as lot readiness and claim readiness are, and for the same reason F0 gives: a stored `ready=true` goes stale the moment evidence is superseded. `[DH-B4]`.
5. **No server-side re-render of any of the eight jsPDF documents.** The renderer stays in the browser (§2.2). D1c assembles; it does not draw. `[DH-B2]`.
6. **No BIM, IFC, COBie or CDE integration.** The TfNSW DE standard row (appendix line 57) is grade A on the *document* and silent on whether any of it lands on a Tier-2 subcontractor. §6.
7. **No email delivery of archives.** A 2 GB handover archive is not an email attachment. Delivery is an authenticated download of a stored artefact, as scheduled reports already do (`artifacts.ts:380-395`).
8. **No client-portal, no external handover recipient login.** Program line 110's "external reviewer accounts/portals" non-build stands. If a client needs the archive, someone in the project downloads it and sends it.
9. **No AI in this wave.** Nothing about a folio or a manifest wants a language model. Named because every other wave has an AI limb and this one deliberately has none.

---

## 2. Current-state map (read at `bd3bf36a`)

### 2.1 The readiness engine — and the handover contract already written for it

The engine is pure functions over passed-in inputs, no Prisma: `backend/src/lib/evidenceReadiness.ts:397` (`buildLotReadinessFromInputs`), with types and primitives in `backend/src/lib/evidenceReadiness/core.ts` (`EvidenceReadinessItem:19`, `ReadinessBucket:41`, `LotEvidenceReadiness:82`, `LotReadinessInput:144`, `splitItems:260`, `bucketState:268`, `summarize:287`). Items carry `severity` split into `blockers`/`warnings`/`support`, plus a separate `blocksAction` boolean — a blocker that does not block action is a real state (`evidenceReadiness.ts:202-215`).

Conformance prerequisites live in `backend/src/lib/conformancePrerequisites.ts`: `computeConformanceResult:515`, the batch form `checkConformancePrerequisitesBatch:911`, and the post-conformance regression check `getClaimBlockingReasonsForConformedLot:195`.

Consumers today: `GET /api/lots/:id/readiness` (`backend/src/routes/lots/qualityRoutes.ts:271`, builds at `:334`), the conform gate (`:411`, blocking at `:488`), the status override (`:558`), and claim readiness (`backend/src/routes/claims/readRoutes.ts:327`). **Readiness is computed on every read.** The only persistence is a decision-time snapshot into `RequirementEvaluation` (`schema.prisma:1743`) written by `backend/src/lib/readiness/recordDecision.ts:497`, and that is off unless `READINESS_SNAPSHOTS_ENABLED=true` (`:234`).

**The load-bearing find:** `backend/src/lib/readiness/contracts/futureConsumers.ts:99-120` already declares `HandoverReasonCode` and `HandoverReadinessVerdict`. `subjectType` already admits `'lot' | 'project'` (`:112`). All eight reason codes in the `Extract<>` at `:101-108` — `no_itp_assigned`, `itp_incomplete`, `no_passing_verified_test`, `open_ncrs`, `open_major_ncrs`, `na_hold_point_not_released`, `unreleased_hold_points`, `not_conformed` — are **already produced** by `computeConformanceResult:515` and `getClaimBlockingReasonsForConformedLot:195`. Nothing computes the verdict; the contract has no implementation and no callers. D1a implements exactly this interface and adds no code to the vocabulary.

The contract also carries its own open question at `:117-119`: docket and diary inputs are hardcoded 0 in the engine, and whether handover requires them is *"a 'wire or drop' product decision, not settled here"*. `f0-execution-spec-2026-07-24.md:167` parks it on D1 by name. §16.1 J1 discharges it.

### 2.2 The PDF stack — eight generators, all in the browser

`frontend/src/lib/pdfGenerator.ts` is a **25-line re-export barrel**; the generators live in `frontend/src/lib/pdf/` (~5,530 source lines + ~1,790 test lines). Library: `jspdf ^4.2.1` (`frontend/package.json:49`), lazily loaded through `frontend/src/lib/pdf/jsPdfRuntime.ts:3-8`. No pdfkit, no puppeteer, no pdf-lib anywhere.

The one that matters: **`generateConformanceReportPDF(data, options)` at `frontend/src/lib/pdf/conformanceReportPdf.ts:168`** (889 lines), which already supports four authority formats via `ConformanceFormatOptions` (`frontend/src/lib/pdf/types.ts:4`, defaults `:72`) — standard, TMR, TfNSW, VicRoads, per the doc comment at `:164-166`. Its payload is assembled by the pure `buildConformanceReportData` (`frontend/src/pages/lots/lib/buildConformanceReportData.ts:67`, 128 lines), which already gathers lot identity + chainage + layer + `conformedAt`/`conformedBy`, project, company branding, the ITP template and completions, test results, NCRs, hold-point releases with public-link attribution (`:88-94`), a photo count and coverage.

**Every generator terminates in a browser download.** The single choke point is `savePdf` (`frontend/src/lib/pdf/pdfSave.ts:7-13`), and for the conformance report the sole call site is `conformanceReportPdf.ts:888`. There is no way today to obtain the PDF as bytes.

Backend PDF is a hand-rolled ASCII-only text writer — `createTextPdf(lines: string[]): Buffer` at `backend/src/lib/scheduledReports/pdf.ts:69`, raw `%PDF-1.4` emission, Helvetica, 52 lines/page, no images, no logo, no tables. It serves scheduled reports and nothing else.

Test harness: operation-recording, not visual. `frontend/src/lib/pdf/__tests__/pdfTestRecorder.ts:6-110` is a `JsPdfRecorder` fake capturing every jsPDF call, with `renderedText()`. Consumers include `pdfGenerator.characterization.test.ts` (1,134 lines) and `conformanceReportPdf.test.ts`. **NOT FOUND:** any golden-PDF fixture or byte/visual diff.

**The standing rule:** `docs/agent-handoff.md:516-517` — the barrel stays a barrel, and behaviour changes are pinned by extending `pdf/__tests__/pdfGenerator.characterization.test.ts` rather than rewriting the generator. `docs/plans/downloadable-files-improvement-plan-2026-07-05.md:58` states it as *"pdfGenerator is jurisdictional — DO NOT refactor"*. §4.2 respects this: the only edit inside `conformanceReportPdf.ts` is **one line, at `:888`**.

### 2.3 The async artefact machinery — already does everything D1c needs

No job-queue library (no BullMQ, Redis, Agenda). Four hand-rolled `setInterval` workers start at `backend/src/server.ts:208-211` and stop at `:239-242`. The relevant one is `startScheduledReportWorker` (`backend/src/lib/scheduledReports.ts:1322-1378`, 60 s default at `:40`, env-gated at `:1303-1320`, in-process re-entry guard at `:1328`), with a CLI twin `npm run reports:send-due` → `backend/scripts/process-scheduled-reports.ts`.

It already implements, and D1c reuses the anatomy of, every property program line 82 asks for:
- **Claim/lock:** conditional `updateMany` (`scheduledReports.ts:176-197`, 15-minute lock at `:38`); stale-lock reclaim via `lockedUntil: { lte: now }` (`:99-113`).
- **Idempotency:** artifact upload with `upsert: false` / `flag: 'wx'` and re-read on collision (`backend/src/lib/scheduledReports/artifacts.ts:225-292`); short-circuit when the artefact already exists (`scheduledReports.ts:750-785`).
- **Retry:** `recordScheduledReportFailure:661-701`, 15-minute backoff (`:39`), auto-disable at three failures (`:43`).
- **Recovery:** `findRetryableScheduledReportRun:451-484` resumes an incomplete run rather than restarting it.
- **Progress:** run-level status ∈ `processing|sent|failed|partial_failed|cancelled` plus counts, finalised in `finalizeScheduledReportRun:878-1036`. **No percent-complete channel exists.**

Storage and delivery: `getScheduledReportArtifactStoragePath` → `scheduled-reports/{projectId}/{scheduleId}/{runId}.pdf` with an `assertSafeStorageId` charset guard (`artifacts.ts:122-131`, `:51-55`); `calculateScheduledReportArtifactSha256:177`; `storeScheduledReportArtifact:200-292` (Supabase when `isSupabaseConfigured()`, else local disk); `loadScheduledReportArtifactBuffer:294-335` with an ownership check at `:133-146`; `sendScheduledReportArtifactFile:380-395`, which **verifies the SHA-256 before sending and throws on mismatch** (`:385-388`) but buffers the whole file into memory and `res.send()`s it — not streamed. Supabase `createSignedUrl` is **not used anywhere**; the app has its own HMAC scheme in `backend/src/lib/signedStorageUrls.ts` (`createSignedStorageAccessToken:24`, `validateSignedStorageAccessToken:35`, `buildSignedStorageFileUrl:62`).

### 2.4 The evidence trail that hangs off a lot

`Lot` relations at `schema.prisma:612-631`. Attachment-bearing children: `ITPCompletion:712` (`signatureUrl:720`, `attachments:738` → `ITPCompletionAttachment:745` → `Document`), `HoldPoint:761` (`releaseSignatureUrl:778`, `evidencePackageUrl:779`), `TestResult:857` (`certificateDocId` → `Document`), `NCR:933` via `NCREvidence:1030`, `ClaimedLot:1524` (`evidencePackageUrl:1533`), `Variation:1543` via `VariationEvidence`. Diary children (`DiaryActivity:1126`, `DiaryEvent:1192`, …) and docket links (`DocketLabourLot:1434`, `DocketPlantLot:1469`) carry no files.

`Document` (`schema.prisma:1592-1638`) is one model for both photos and documents, discriminated by `documentType`, with `lotId?:1594`, `fileUrl`, `mimeType`, EXIF GPS + `captureTimestamp` (`:1604-1606`), and version tracking added as Feature #481 — `version:1613`, `parentDocumentId:1614`, `isLatestVersion:1615`, self-relation at `:1622-1623`. **There is no checksum column on `Document`.** There is no separate photo model and no `HoldPointCompletion` model (hold-point release is fields on `HoldPoint` itself: `status:767`, `releasedAt:775`).

`Lot.status` is `String @default("not_started")` (`:585`) — **there are no Prisma enums in this schema at all**. The vocabulary is Zod-only: `backend/src/routes/lots/validation.ts:10-17` (`not_started`, `in_progress`, `awaiting_test`, `hold_point`, `ncr_raised`, `completed`) plus `terminalStatuses = ['conformed', 'claimed']` at `:19`, which are not settable through the normal status route.

### 2.5 The spatial stack, and the two things it does not know

Built, and more than the program assumes: `ProjectArea:447` (chainage range), `ControlLine:466` (`coordinateSystem:469` as an EPSG code, ordered `points:470`, derived `geometryWgs84:471`), `LotGeometry:485` (`kind:488` ∈ `chainage_offset|drawn|point`, `chainageStart/End:490-491`, offsets `:492-493`, GeoJSON `geometryWgs84:494`, `areaM2/lengthM:495-496`), `PlanSheet:517` (georeferenced raster, affine `registration:528`, RMS error), `Lot.chainageStart/End/offset:551-554`, and C3's sample points on `TestResult:894-903`.

CRS handling is real: `backend/src/lib/spatial/crs.ts` on `proj4`, MGA zones 49–56 (`:26`), EPSG presets for GDA2020 (7849–7856) and GDA94 (28349–28356) (`:34-41`), bidirectional transforms at `:82`/`:91`. Frontend mirror at `frontend/src/lib/spatial/coordinateSystems.ts:17-31`, default `EPSG:7856` at `:40`.

Two gaps that matter to D2 and to nothing else:
1. **No elevation, anywhere.** `backend/src/lib/spatial/landxmlParser.ts:74` states it outright — *"LandXML points are 'northing easting' (plus optional elevation, ignored)"*. No RL, IL, surface level or layer number exists on any model. C3 recorded the same gap against TfNSW LIMS Table 1's `LayerLocationRL` (`wave-c3-spatial-tests-lims-spec-2026-07-28.md:264`).
2. **No datum shift.** `crs.ts:13-20`, quoted in §0.3. Display-grade, by design, with the upgrade path already written in the file.

Importers today: **LandXML** (`landxmlParser.ts`, 198 lines — `Line` and `Curve` only, spirals rejected with a named warning at `:116-119`, `fast-xml-parser` with `preserveOrder` at `:24`) and **DXF** (`dxfParser.ts`), dispatched by `alignmentFileImport.ts:16-22` with a 20 MB cap at `:13`. **GeoPDF** is frontend-only and byte-scans `/VP → /Measure /GEO` out of raw PDF bytes (`frontend/src/pages/projects/settings/geoPdf.ts:5-12`, documented ceiling at `:14-20`). GeoJSON is a storage format, not an importer. **KML and shapefile: NOT FOUND.**

### 2.6 Documents, drawings and revisions

`Drawing` (`schema.prisma:1657-1684`) tracks `drawingNumber:1660`, `revision:1662`, `issueDate:1663`, `status:1664` (default `preliminary`), `supersededById:1666`, self-relation `DrawingSupersedes:1671-1672`, unique `[projectId, drawingNumber, revision]:1674`. Supersession is *enforced*, not merely stored: `backend/src/routes/drawings.ts:39-64` rejects self-reference (`:43`), cross-project (`:48-53`), a different drawing number (`:58`) and chaining onto an already-superseded revision (`:62-63`).

**Not tracked — NOT FOUND:** acknowledgement, receipt, transmittal, distribution list, "for construction" gating, or any per-user drawing read-receipt. The program's F1 ("who received/acknowledged; which lots were performed under the old revision") is therefore **partly shipped and partly absent**, and **no F1 execution spec exists in `docs/plans/` at this SHA**. D1 does not depend on the missing half: a folio reproduces the drawing revisions *recorded against the lot's evidence*, and says "not recorded" where none is.

### 2.7 What is not there — the NOT FOUND list

Stated plainly, because §5 rests on it:

- **Asset model — NOT FOUND, entirely.** No `Asset`, `AssetClass`, `Pit`, `Pipe`, `Manhole`, `Node` or `Conduit` model in the 78-model schema. No topology, no upstream/downstream, no from-node/to-node.
- **ADAC — NOT FOUND.** The single grep hit is `A-spec` inside the word "QA-specific" (`backend/src/routes/copilot/chat/tools.ts:112`). **A-SPEC / ASPEC — NOT FOUND.**
- **RPEQ / surveyor certification — NOT FOUND.** Zero hits for `RPEQ`.
- **CCTV — NOT FOUND in source.** Two hits total, both string literals in one test file (`backend/src/lib/readiness/sufficiency/testCategories.test.ts:171`, `:325` — `'cctv per wsa 05:2020'`). The string does not appear in the source `testCategories.ts`. `WSA` appears only as a standards-name token in ITP keyword lists (`backend/src/lib/activityTaxonomy.ts:190,195`; `backend/src/lib/itpMatcher.ts:88,96`).
- **XML generation — NOT FOUND.** `fast-xml-parser ^5.10.1` is installed and used at three read sites (`landxmlParser.ts:1`, `copilot/import/excelParser.ts:22`, `copilot/import/wordParser.ts:31`); `XMLBuilder` is never imported. **XSD validation — NOT FOUND**; zero `.xsd` files, zero validator dependency.
- **ZIP writer — NOT FOUND.** No `archiver`, `jszip`, `adm-zip`, `yazl`, `fflate` in either `package.json`. `backend/src/lib/zipSafety.ts` is inbound zip-bomb defence, not an archive writer.
- **Manifest — NOT FOUND.** Nothing in the codebase emits a package index. The nearest analogue is the account export's `truncatedCollections` block (`backend/src/routes/auth/accountPrivacyRoutes.ts:591-603`).
- **Bulk PDF generation — NOT FOUND.** Every generator is single-subject and click-driven. Lot bulk operations are mutations only (`frontend/src/pages/lots/hooks/useLotsActions.ts:210,227,255,278`).
- **`handover` / `asConstructed` / `practicalCompletion` / `defectsLiability` — NOT FOUND** as any field, route, status or component. The only occurrences are the type-only contract at `futureConsumers.ts:99-120` and prose in `backend/src/routes/copilot/chat/prompt.ts:149`.
- **`RequirementDefinition`, `RequirementInstance`, `EvidenceLink`, `ActionAssignment`, `Decision`, `ExceptionOrWaiver` — NOT FOUND as Prisma models.** Only `RequirementEvaluation` (`schema.prisma:1743`) shipped; the rest are code contracts or deferred by design (`f0-execution-spec-2026-07-24.md:29-35`).

---

## 3. The research gate — **D.0, BLOCKING for D2 and D3**

### 3.1 What the program actually rests on, and at what grade

Appendix §C (lines 51–59) is nine rows. Read honestly, they establish:

| Established | Grade | Line |
| --- | --- | --- |
| Councils require WAE drawings + ADAC XML + CCTV before completion certificates (NSW/QLD examples) | A (council) / C (surveyor article) | 51 |
| Logan mandates ADAC **5.01** for Operational Works handover since 1 Jul 2024 | **A** | 52 |
| Sunshine Coast accepts 5.02/6.00 now, **6.00-only from 1 Sep 2026**; RPEQ + surveyor certification required | **A** | 53 |
| 12d Model reads/writes/validates ADAC in survey workflows | B | 54 |
| CivilPro ships a "Build Conformance Folio" + Lot Summary Report + progressive per-lot close | B | 55 |
| Closeout is painful | D (vendor marketing) | 56 |
| TfNSW Digital Engineering Standard **v4.1 (2022)** exists and prescribes its own asset model | **A** | 57 |
| Retention expectations | D (consultancy blog) | 58 |
| VicRoads/DTP as-constructed format | **—, explicitly UNVERIFIED** | 59 |

**What none of them establishes**, and what D2 cannot be designed without:
- What is *in* an ADAC file — the element set, mandatory attributes, coordinate/datum requirements, or whether any field can carry a reference to quality evidence at all.
- **Who produces the file and who holds it.** Every row is about the *receiving* end (councils require it) or the *producing* tool (12d makes it). The head contractor's position in that pipeline is unstated in all nine rows.
- What "accepted by a real receiving authority" (program line 91) mechanically means — portal upload, validation report, attached certification.
- Whether the schema or a validator is obtainable, and on what terms.

### 3.2 The A-SPEC hole

Program §5 line 117 puts a standing decision to Jay: *"D2 jurisdiction order: ADAC-QLD councils (best-documented mandates) vs A-SPEC-NSW (network geography)"*. It reads as a choice between two comparably-evidenced options.

It is not. **The appendix contains zero rows mentioning A-SPEC, and `docs/research/**` in this repository contains zero occurrences of `A-SPEC`, `ASPEC` or `ADAC` at any grade.** The QLD arm has two grade-A council mandates with version numbers and effective dates; the NSW arm has nothing behind it but the phrase "network geography". A decision framed as a balanced fork is, on the evidence in hand, a decision between something and nothing.

This does not mean A-SPEC is unreal — it means nobody in this program has looked. §16.1 J5 puts the decision back to Jay with that stated, and with a recommendation.

### 3.3 The C3.0-shaped risk, named

The single question that decides whether D2 exists is: **which direction does the ADAC arrow point, and is the contractor on it?**

Three outcomes are consistent with everything the appendix proves today:
- **(a) The contractor never touches it.** The developer engages a surveyor; the surveyor's 12d produces and validates the ADAC file; the surveyor or the developer submits it. CIVOS's linkage is internal-only value with no exported artefact — and D2 as scoped (import → link → validate → export → council acceptance) **closes**, exactly as C3's Phase C closed.
- **(b) The contractor assembles and submits, using the surveyor's data.** D2 as scoped is real, and its differentiator (clause 87 — linking assets to lots, ITP evidence, tests, NCRs, CCTV, approvals) is the correct wedge.
- **(c) The contractor's obligation is the *evidence pack that accompanies* the ADAC file** — WAE drawings, CCTV reports, test certificates, conformance records — while the XML itself stays with the surveyor. Then **D2 collapses into D1**: the differentiating build is the folio, keyed to the surveyor's asset identifiers, and there is no XML writer at all.

Outcome (c) is the one worth flagging, because it is the cheapest, the most likely to be missed, and the one where a wave of XML work would be wasted while the actual product was already 80% built.

### 3.4 D.0 — the confirmation pass, and its questions

**D.0 is a research PR, docs-only, merged before any D2 or D3 code.** Output: `docs/research/d0-handover-asset-confirmation-2026-XX-XX.md`, in the shape of `docs/research/c3-lims-format-research-2026-07-28.md` — every claim a row with a source, an edition, a date checked and a grade; every unanswered question an explicit **NOT FOUND** rather than an inference.

| # | Question | Gates | What discharges it |
| --- | --- | --- | --- |
| **Q1** | **Which party produces, holds and submits the ADAC file on a typical QLD Operational Works job — and does the head contractor ever hold it?** (§3.3) | **All of D2** | A named council's or a surveyor's published submission procedure identifying the submitting party, at grade A or B. Not an inference from "councils require it". |
| **Q2** | **What is actually in an ADAC file?** Element set, mandatory attributes, geometry/datum requirements, identifier scheme — and **is there any field capable of carrying a reference to quality evidence?** | **D2 clauses 2, 4, 6** | The ADAC 5.01 and 6.00 schema documents or XSDs, read. If no evidence-carrying field exists, clause 87's "linkage is the differentiator" is a CIVOS-internal claim, not an exported one, and the spec must say so. |
| **Q3** | **What is the CCTV deliverable under WSA 05-2020?** A video file set, a coded defect report, a structured inspection record keyed to pipe assets — and which of those does the contractor produce vs receive? | **D1d** (and D2 clause 4) | The WSA conduit inspection reporting standard, read, plus one council's stated CCTV submission requirement. Q3 is the *only* D.0 question that gates a D1 phase. |
| **Q4** | **How is a submission mechanically made and what does "accepted" mean?** Portal, email, validation report, required certifications attached. | **D2 clause 8 / the exit gate** | A council's published submission process. Without it the exit gate is unmeasurable. |
| **Q5** | **Are the ADAC schema and a conformance validator obtainable, by whom and on what licence terms?** (ADAC is an IPWEA-sphere standard; the appendix cites council guidelines, never the schema itself.) | **D2 clauses 6, 9** | The schema custodian's published terms. If the schema is not obtainable, "XSD validation" is unbuildable and D2 must be rescoped. |
| **Q6** | **What does a 12d ADAC export contain versus a 12d LandXML export, and which is realistically handed to a contractor?** Are DXF and CSV realistic import paths or plan-writing optimism (program clause 86 lists four formats)? | **D2 clause 3** | A 12d ADAC/LandXML export specification or a real sample file. Note §2.5: the shipped LandXML parser ignores elevation and rejects spirals — either would need work before it could carry asset geometry. |
| **Q7** | **A-SPEC: does it exist as a distinct NSW standard, is it mandated by any named council, and what is its relationship to ADAC?** (§3.2 — currently zero evidence at any grade.) | **Jay decision J5; D2 jurisdiction order** | Any grade-A or grade-B source at all. The current state is not "weakly evidenced" — it is unexamined. |
| **Q8** | **Is ADAC 6.00 a superset of 5.01, or a break?** Sunshine Coast goes 6.00-only on **1 Sep 2026** (appendix line 53) — inside the plausible D2 build window. | **D2 clause 5 (versioned profiles)** | The 6.00 release notes or migration guide. If it is a break, "versioned jurisdiction profiles" is the *minimum* architecture rather than future-proofing. |
| **Q9** | **What accuracy/datum does an ADAC submission require, and is a GDA94→GDA2020 transform ever CIVOS's to perform?** | **D2 clauses 2, 3; `[DH-B3]`** | The schema's coordinate requirements (Q2). The expected answer is that CIVOS re-emits the surveyor's coordinates unchanged and performs no transform — `crs.ts:13-20` is display-grade (§0.3). Any other answer is a stop-and-replan. |
| **Q10** | **TfNSW Digital Engineering: is v4.1 (2022) current, and does any of it bind the tier of contractor CIVOS serves — or only principal contractors and designers on major projects?** | **All of D3** | The current DE standard edition plus one applicability statement. Appendix line 57 itself says *"check for a newer edition at D3"*. |

**Also to be settled by D.0, and currently on the standing never-assert list (appendix line 98):** the VicRoads/DTP as-constructed format (appendix line 59). No Victorian D2 support is scoped, mentioned or implied until it is answered.

### 3.5 What D.0 must not do

- **It must not design.** No schema proposals, no table sketches, no API shapes. C3.0's value was that it *deleted* a limb; a research pass that arrives with a design has stopped being a research pass.
- **It must not upgrade a grade to make a decision possible.** A council's guideline PDF is grade A; a surveyor's blog summarising it is grade C; a consultant's LinkedIn post is grade D and carries nothing alone (program line 152).
- **It must not approximate a link.** Appendix §H exists because sources whose exact URL was not captured are marked for re-location, never reconstructed. The same rule binds D.0.
- **It must not answer Q1 by reasoning from Q2.** "The schema has contractor-ish fields, therefore contractors submit it" is precisely the inference C3.0 disproved on the LIMS format.

---

## 4. D1 — the design

### 4.1 Phase D1a — handover readiness (S, no migration)

**What it is.** One read-only endpoint and one panel. `GET /api/projects/:projectId/handover-readiness` returns `HandoverReadinessVerdict[]` exactly as declared at `futureConsumers.ts:111-120` — one row per lot plus one aggregate row at `subjectType: 'project'` — with optional `areaId` and `activityType` filters supplying program line 82's "by project/area/activity/lot".

**How it is built — the lazy path.** The verdict is a **projection of the existing conformance computation, not a new evaluation**. `checkConformancePrerequisitesBatch` (`conformancePrerequisites.ts:911`) already produces every one of the eight `HandoverReasonCode` values in one batched pass, and `getClaimBlockingReasonsForConformedLot:195` supplies the post-conformance regression codes. D1a adds a pure mapper from those results to the contract shape and a project-level fold. **No new rule, no new vocabulary, no new severity model, no second opinion** — `[DH-B5]`: a lot that the lot page calls blocked is blocked on the handover panel, for the identical stated reason, asserted by AT-119.

**What it must not do:**
- Not store a verdict (`[DH-B4]`). Computed per read, like every other consumer.
- Not add a reason code. The `Extract<>` at `futureConsumers.ts:99-109` is the closed set for this phase. Widening it is a `reasonCodes.ts` change and a separate decision.
- Not gate anything. D1a is a view. Nothing in the system starts refusing an action because handover readiness says so.

**UI.** One project-level page section listing blocked lots grouped by reason code, and a per-lot line on the lot page. Uniform-card rules apply. No new navigation entry until a real user asks for one.

### 4.2 Phase D1b — the lot folio, issued once and versioned (M, one migration)

**What it is.** The conformance report CIVOS already draws becomes a **stored artefact with an identity**: `FolioIssue`. A quality manager clicks "Issue folio" on a conformed lot; the browser renders the PDF it already knows how to render, uploads the bytes, and the backend stores them with a SHA-256, an issuer, a timestamp and a record of what the folio was compiled from.

**4.2.1 Getting the bytes — one line inside a file we must not refactor.**

`generateConformanceReportPDF` already takes an options object (`conformanceReportPdf.ts:170`, type at `types.ts:4`). D1b adds one optional field to that type:

```ts
/** When present, the PDF is delivered to this sink instead of being downloaded. */
sink?: (blob: Blob, filename: string) => void | Promise<void>;
```

and changes the single terminal line `conformanceReportPdf.ts:888` from an unconditional `savePdf(...)` to a sink-or-save branch. **That is the entire edit inside the 889-line generator** — no restructuring, no extraction, no change to any drawing call, and therefore no change to a single operation recorded by `JsPdfRecorder`. The existing characterization suite passes unmodified, which is the point of using the choke point rather than the body (§2.2). AT-122 pins that download behaviour is byte-identical with and without the sink.

`[DH-a]` — **the sink is threaded through options, not through a module-level collector.** A global "capture mode" would be shorter and would make every generator bulk-capable at once. It is not taken: ambient mutable state that changes what a save does is exactly the thing someone debugs at 3am, and D1 needs precisely one generator to do this. *ponytail: thread one param; promote to a shared sink when a second generator needs it.*

**4.2.2 The record.** One new table, `FolioIssue` (§7). It stores what the artefact is, where it lives, what it hashes to, who issued it, and — load-bearing for `[DH-B1]` — a **compiled-from fingerprint**: the counts and latest-updated timestamps of the evidence that fed it (ITP completions, verified tests, released hold points, open NCRs, attached documents), plus the `format` used (standard/TMR/TfNSW/VicRoads) and the conformance state at issue time. The fingerprint is not a security control; it is how the UI can say *"this folio was issued before the last two test certificates arrived"* without re-rendering anything.

**4.2.3 Versioning.** `FolioIssue` rows are append-only. Issuing again for the same lot creates version *n+1*; the row for version *n* is never updated and its stored object is never overwritten (`upsert: false` / `flag: 'wx'`, the pattern already proven at `artifacts.ts:225-292`). Storage path is deterministic and ownership-checkable: `folios/{projectId}/{lotId}/{folioIssueId}.pdf`, through the same `assertSafeStorageId` charset guard used at `artifacts.ts:51-55`.

**4.2.4 Why this is the whole of "re-generation never silently alters historical content".** There is no code path that re-renders into an existing row, because there is no update path on the table at all. The invariant is a schema property, not a discipline. `[DH-B1]`, AT-127.

**4.2.5 What D1b does not do.** No new PDF content, no folio-specific layout, no attachment embedding into the PDF, no cover letter, no signature block. The folio *is* the conformance report at this phase. Adding content is a later, cheap, independent change; conflating it with persistence is how a one-migration phase becomes a wave.

### 4.3 Phase D1c — the project archive that renders nothing (L, one migration)

**What it is.** A background job assembles a ZIP for a selected scope (project, area, or an explicit lot list): the issued folio PDFs, the original evidence files, and a manifest. Delivered as an authenticated download of a stored artefact.

**4.3.1 The rule that makes it small `[DH-B2]`.** **The archive collects; it never renders.** A lot with no issued folio is written into the manifest as `folio: none` and contributes its originals only. The UI shows "12 of 40 lots have no issued folio" before the job starts and offers to take the user to issue them (D1b), which is a human act on a human's screen. Consequences, all of them good:
- No jsPDF in Node, no shared rendering package, no duplicated renderer, no divergence between the folio a client received and the folio in the archive.
- The archive is reproducible from immutable inputs.
- The backend's ASCII-only `createTextPdf` (`scheduledReports/pdf.ts:69`) stays where it is and is not asked to grow images and tables.

`[DH-b]` — the alternative was running jsPDF server-side so the archive could self-render missing folios. Rejected: it needs the generator to live in a package both sides can import, which is precisely the pdfGenerator refactor the standing rule forbids (`docs/agent-handoff.md:516`, `downloadable-files-improvement-plan-2026-07-05.md:58`), and it would let a background job emit a document nobody ever reviewed. *ponytail: collect-only; revisit if and only if pilots show progressive issuance is not happening — and then the fix is a nag, not a renderer.*

**4.3.2 The manifest.** Two files at archive root, same content: `manifest.csv` (opens in Excel — that is what "searchable" means to the person who receives it) and `manifest.json`. One row per file: archive path, SHA-256, byte size, source record type and id, lot number, document type, original filename, uploaded-at, uploaded-by. Plus a `manifest-summary.json` carrying scope, generated-at, generated-by, CIVOS version, per-lot folio status, and an explicit `omissions[]` list — files that could not be included and why (missing from storage, size cap, permission-scoped out). **An omission is never silent** (`[DH-B1]`, AT-129).

**4.3.3 Determinism.** Archive paths are `{lotNumber}/{category}/{sanitized-filename}`; lots ordered by `lotNumber` ascending using the same comparator the reports already use (`backend/src/lib/scheduledReports/reportDocument.ts:107`); categories in a fixed declared order; files within a category by `uploadedAt` then id. Filename collisions get a ` (2)` suffix by that same order, never a random one. Two runs over unchanged data produce identical manifests and identical archive member ordering — AT-128 asserts this on the manifest bytes, not on the ZIP bytes (ZIP central-directory timestamps are not worth fighting).

**4.3.4 The job.** A new `HandoverExport` row + a worker that follows the scheduled-report anatomy (§2.3) rather than inventing a second one: conditional-`updateMany` claim with a lock expiry, stale-lock reclaim, failure count with backoff, and resume-incomplete rather than restart. Progress is coarse and honest — `processedLots / totalLots` on the row, polled by the UI. **No percent-complete streaming channel**; none exists in the codebase and a ZIP job does not justify inventing one.

**4.3.5 The size cap, surfaced before the job starts.** Program §8 line 145 requires the storage/egress cost of a 50 GB-evidence project to be measured before it is promised. D1c therefore ships with a **configurable byte cap and a pre-flight estimate shown to the user** (total bytes, file count, estimated time) before they confirm — the same courtesy §8 line 143 demands of offline packages. Exceeding the cap is a refusal with a stated number, never a truncated archive that looks complete. AT-130.

**4.3.6 Delivery.** Reuse `storeScheduledReportArtifact`'s two-backend pattern and `sendScheduledReportArtifactFile`'s ownership-checked, SHA-verified download (`artifacts.ts:200-292`, `:380-395`) — but **streamed, not buffered**. `sendScheduledReportArtifactFile:380-395` reads the whole file into memory, which is defensible for a 200 KB text PDF and not for a 2 GB archive. D1c's download path streams; the scheduled-report path is left alone.

`[DH-c]` — **new dependency: one streaming ZIP writer.** No zip writer is installed (§2.7). Hand-rolling the ZIP container means CRC-32, local headers, the central directory, UTF-8 flags and zip64 above 4 GB — real code with real edge cases, in a path where a corrupt archive is a corrupt legal record. Recommendation: **`fflate`** — no transitive dependencies, streaming API, and it runs in both Node and the browser, so if a client-side variant is ever needed it is the same writer. `archiver` is the more conventional choice and pulls a dependency tree. Either is acceptable; a hand-rolled writer is not.

### 4.4 Phase D1d — CCTV linkage — **GATED on D.0-Q3**

Program line 82 asks for "CCTV (WSA 05-2020) linkage for drainage". The repository contains nothing (§2.7), and the two candidate scopes differ by more than an order of magnitude:

- **Scope A (hours):** CCTV is a deliverable *file set* the contractor receives from a specialist. Linkage = a `documentType` value, a lot association, and a manifest category. It is already 90% built by `Document`.
- **Scope B (a wave):** CCTV is a *structured inspection record* — per-conduit runs, coded defects, condition grades, keyed to pipe assets that CIVOS does not have (§2.7). Scope B is not a D1 phase; it is a D2 dependency, and it is not built before D2 is unblocked.

**D1d does not start until D.0-Q3 says which.** If the answer is Scope A, D1d is a trivial rider on D1c. If it is Scope B, D1d is deleted from D1 and re-parked on D2. Nothing is built "to cover both".

### 4.5 "Configurable requirements" — deferred out of D1, deliberately

Program line 82 lists it. It is not in D1, for two reasons.

1. **There is no evidence yet for what to configure.** A configurable handover-requirement set is only useful if it can be pointed at a real receiving authority's real requirement list, and D.0-Q1/Q3/Q4 are exactly the questions that would produce one. Shipping a configuration UI first means shipping empty checkboxes and then discovering the shape is wrong.
2. **F0 already parked the mechanism.** `f0-execution-spec-2026-07-24.md:35` defers `ExceptionOrWaiver` to D1 and `:23` defers "new evidence-link tables" to D1. Both are configurability machinery. **This spec declines both** — D1a/b/c need neither, and building a waiver table with no consumer is the definition of scaffolding for later.

`[DH-d]` — the deferral is recorded rather than dropped: configurable requirements and `ExceptionOrWaiver` return as a **D1e**, specified in its own revision, once D.0 supplies a real requirement list to configure against. Until then, "requirements" means the shipped conformance prerequisites, which is a defensible default because it is the thing the company already treats as the definition of done for a lot.

### 4.6 What does not change, in any phase

- `Lot.status` and its Zod vocabulary (`validation.ts:10-19`). No `handover` status. `[DH-B4]`.
- The conform gate (`qualityRoutes.ts:411`, `:488`) and the claim gate (`backend/src/routes/claims/inclusionDecision.ts:140`). D1 blocks nothing new.
- Any of the eight PDF generators' output, including the conformance report's. The only edit is the sink branch at `conformanceReportPdf.ts:888`.
- The scheduled-report worker and its download path.
- `Document`, `Drawing`, `TestResult`, `HoldPoint`, `NCR` — no columns added to any of them by D1.

---

## 5. D2 — evidence-to-asset-record: the shape, and the gate in front of it

### 5.1 The eight clauses and their gates

| Clause (line) | Gate |
| --- | --- |
| 1. Validate with surveyors, contractors, ≥3 receiving councils (84) | **This IS D.0-Q1 plus a human milestone.** The desk research answers *who is in the pipeline*; the conversations confirm it. Both required. Jay owns the counterparties (program line 119). |
| 2. Define the civil asset / as-constructed data model (85) | **D.0-Q2, Q9.** Designing an asset model before reading the schema it must round-trip is how you get a model that cannot round-trip. |
| 3. Import from 12d / LandXML / DXF / CSV, never author (86) | **D.0-Q6.** Note §2.5: the shipped LandXML parser ignores elevation and rejects spirals — neither is a blocker for alignments, both are for asset geometry. |
| 4. Link assets to lots, ITP evidence, tests, NCRs, CCTV, approvals (87) | **D.0-Q2 and Q3.** If ADAC carries no evidence-reference field, this linkage is internal value only, and the spec must say so out loud rather than implying an exported one. |
| 5. Versioned jurisdiction profiles (88) | **D.0-Q7, Q8.** 6.00-only at Sunshine Coast from **1 Sep 2026** (appendix line 53) — inside the build window; revalidate the date before any build, per the row's own caveat. |
| 6. XSD + council-specific validation (89) | **D.0-Q5.** Unbuildable if the schema is not obtainable. |
| 7. Preserve the surveyor/RPEQ certification boundary (90) | **No gate — an invariant, `[DH-B3]`.** Binding from now, including on D1. |
| 8. Exit gate: an export accepted by a real receiving authority (91) | **D.0-Q4** defines what "accepted" means; §5.3 owns reaching it. |

### 5.2 What may be sketched now, and what may not

**May be sketched** (direction only, no schema, no migration): that imported certified geometry is stored immutably and versioned, exactly as program line 86 requires and as `[DH-B3]` restates; that CIVOS's own evidence attaches to it by reference and never inside it; that a jurisdiction profile is data, not a code branch per council.

**May not be designed:** tables, columns, identifier schemes, topology representation, import file formats, validation architecture, export shape. Every one of those is downstream of a D.0 answer. A Rev 2 of this spec designs them, after D.0 merges.

### 5.3 The real-council acceptance gate — an external human milestone

Program line 91's exit gate is not a test that engineering can run. It requires a named receiving authority to accept a CIVOS-assembled submission on a real job.

**This is Jay's, and it is the same dependency §5 line 119 already names** (design partners + Highways AU, Sydney, October 2026). Stated as a gate rather than an aspiration:

- **Before D2 phase 1 code:** at least one surveyor and one head contractor who will talk about their actual as-constructed workflow, plus D.0 merged.
- **Before D2 phase 2 code:** ≥3 receiving councils reached, per clause 84.
- **Before D2 is called done:** one named authority has accepted one real submission. Not a validator pass. Not a council officer saying it looks fine. An acceptance on a job.

If the first milestone cannot be reached, **D2 does not start**, and that is a legitimate outcome rather than a failure — it is the same outcome C3.0 produced, reached earlier and more cheaply.

### 5.4 What D2 must never become

An asset-management product (§1.3.1). A survey tool (§1.3.2, `[DH-B3]`). A generic XML export framework. A second spatial engine parallel to the shipped one. A per-council `if` ladder (clause 88 forbids "one 'council-ready' exporter"; a code branch per council is the same mistake with more files).

---

## 6. D3 — TfNSW Digital Engineering: gated, and possibly not ours

The evidence is one grade-A row: the DE Standard Part 2 v4.1, **2022**, which prescribes CDE integration, metadata, and TfNSW's own asset model (appendix line 57). The row's own caveat is *"check for a newer edition at D3"*. Supporting repo research is thin and older: `docs/research/05-regulatory-compliance.md:51` records the DE Framework as "business as usual" on most road and rail projects, requiring IFC design files with custom TfNSW attributes — **IFC design files**, which is a designer's obligation, not a QA platform's.

Two things are unknown and both are decisive: whether v4.1 is current, and whether any DE obligation reaches the tier of contractor CIVOS serves rather than stopping at principal contractors and designers on major projects. **D.0-Q10 answers both.** Until then D3 has no scope, no phases and no acceptance tests, and this spec does not invent them. The most likely honest outcome, given `05-regulatory-compliance.md:51`, is that DE alignment means *"CIVOS's exports must be ingestible by a CDE"* — which is a file-naming and metadata concern, not a wave.

---

## 7. Data model and migrations — **loud, and there are two**

Both migrations are additive; neither touches an existing column; neither is destructive. Reviewed Prisma migrations only, applied to production per Wave 0 change management. No `db push`, ever.

**Migration 1 (D1b) — `FolioIssue`.** New table. Fields: `id`, `projectId`, `lotId`, `version Int`, `format String` (`standard|tmr|tfnsw|vicroads` — the shipped `ConformanceFormatOptions` vocabulary, `types.ts:4`), `fileUrl`, `fileSize Int`, `sha256 String`, `issuedById`, `issuedAt`, `compiledFrom Json` (§4.2.2 fingerprint), `lotStatusAtIssue String`, `conformedAtIssue DateTime?`. Unique `[lotId, version]`. Indexes `[projectId, issuedAt]`, `[lotId, version]`. **No `updatedAt`** — the table has no update path, and its absence is the invariant made visible (`[DH-B1]`).

**Migration 2 (D1c) — `HandoverExport`.** New table for the job. Fields: `id`, `projectId`, `scope Json` (`{kind: 'project'|'area'|'lots', areaId?, lotIds?}`), `status String` (`queued|processing|complete|failed|cancelled`), `requestedById`, `requestedAt`, `lockedUntil DateTime?`, `failureCount Int @default(0)`, `lastFailureReason String?`, `totalLots Int?`, `processedLots Int @default(0)`, `fileUrl String?`, `fileSize Int?`, `sha256 String?`, `manifestSummary Json?`, `completedAt DateTime?`. Index `[projectId, requestedAt]`, and `[status, lockedUntil]` for the worker claim.

**No enums** — the schema has none anywhere (§2.4); status vocabularies stay Zod-validated at the route, consistent with `Lot.status`.

**Explicitly not created by D1:** `Asset` or anything asset-shaped; `ExceptionOrWaiver` (§4.5, `[DH-d]`); any new evidence-link table (`f0-execution-spec-2026-07-24.md:23` parked it here and D1 declines it); a checksum column on `Document` (D1c hashes bytes at archive time — adding a column to a 78-model schema's busiest table to save a hash is not a trade D1 needs).

**Rollback.** Both tables are additive and unreferenced by existing code paths; rollback is dropping them plus reverting the feature flag. No data migration, no backfill, nothing to un-write.

---

## 8. Invariants Wave D must not break

| Tag | Invariant | Asserted by |
| --- | --- | --- |
| `[DH-B1]` | A folio is a compilation, never an assertion; an issued folio is never altered; an omission is never silent. | AT-121, AT-127, AT-129 |
| `[DH-B2]` | The bulk archive collects issued folios; it never renders one. | AT-126 |
| `[DH-B3]` | CIVOS never authors survey geometry, a coordinate, a level or a certification. | AT-131 (a documentation/lint assertion in D1; a real one in D2) |
| `[DH-B4]` | Handover readiness is computed, never stored; no `handover` lot status exists. | AT-120 |
| `[DH-B5]` | One verdict everywhere — handover readiness reuses the shipped conformance computation and its vocabulary; no second opinion. | AT-119 |
| `[DH-B6]` | No archive, folio or manifest ever contains a record the requesting user could not read through the normal API. | AT-132, AT-133 |
| `[DH-B7]` | Commercial values are redacted from handover surfaces for non-commercial roles, exactly as `filterCommercialReadiness` (`evidenceReadiness.ts:458`) already does. | AT-134 |

---

## 9. API and UI surface

**Backend**
- `GET /api/projects/:projectId/handover-readiness` — D1a. Optional `areaId`, `activityType`. Returns lot verdicts + the project aggregate.
- `POST /api/lots/:id/folio` — D1b. Multipart upload of the rendered PDF + the `compiledFrom` fingerprint; creates the next `FolioIssue` version. Rate-limited.
- `GET /api/lots/:id/folios` — D1b. Version list.
- `GET /api/folios/:folioIssueId/download` — D1b. Ownership-checked, SHA-verified before send (the `artifacts.ts:385-388` pattern).
- `POST /api/projects/:projectId/handover-exports` — D1c. Creates a queued `HandoverExport`. Returns the pre-flight estimate.
- `GET /api/projects/:projectId/handover-exports` / `GET /api/handover-exports/:id` — D1c. Status + progress.
- `GET /api/handover-exports/:id/download` — D1c. Streamed, ownership-checked.

**Frontend**
- Project handover panel (D1a): blocked lots grouped by reason code, project rollup, filters.
- Lot page: readiness line + "Issue folio" + folio version list (D1a/D1b).
- Handover export screen (D1c): scope picker, pre-flight estimate with the folio-coverage warning, progress, download.

**Permission matrix**

| Action | Roles |
| --- | --- |
| View handover readiness | Any role with project read access; commercial items redacted per `[DH-B7]` |
| Issue a folio | `owner`, `admin`, `project_manager`, `quality_manager` |
| Download a folio | Any role with read access to that lot |
| Request a handover export | `owner`, `admin`, `project_manager`, `quality_manager` |
| Download a handover export | The requester, plus `owner`/`admin`/`project_manager` on that project |
| Subcontractor roles | **No handover surface at all.** No readiness view, no folio issue, no export. Not a scoping question — handover is not their workflow. |

---

## 10. Security, tenancy and privacy

**Tenancy.** Every new route resolves `projectId` through a project-read guard of the shape each route folder already defines — note there is **no single shared `requireProjectReadAccess`**; four per-domain copies exist (`backend/src/routes/testResults/accessControl.ts:92`, `backend/src/routes/dockets/access.ts:112`, `backend/src/routes/holdpoints/access.ts:41`, `backend/src/routes/notifications/access.ts:50`). Wave D follows the local convention of the folder it lands in and does **not** unify them; that is a separate refactor with its own characterization burden. No route trusts a client-supplied `projectId`. `FolioIssue` and `HandoverExport` both carry `projectId` and are read only through project-scoped queries. Cross-tenant refusal is asserted per surface (AT-132), per §7 of the program (*"tenant-isolation tests on every new query surface"*).

**The archive is the highest-value object CIVOS will ever emit.** One file containing a project's entire evidence trail. Therefore:
- Downloads are authenticated app requests, ownership-checked at the storage-path level (`getOwnedScheduledReportArtifactStoragePath:133-146` pattern), with private `no-store` headers (`artifacts.ts:114-120`).
- No public link, no Supabase signed URL, no email attachment (§1.3.7). Wave E's capability-token machinery is for hold-point decisions and is not extended here.
- **Assembly is scoped to the requester's permissions, and the manifest records it.** A file the requester could not read is not silently dropped — it is listed in `omissions[]` with `reason: 'not_permitted'` (`[DH-B1]`, `[DH-B6]`, AT-133).
- **Storage objects must be deleted explicitly, not by cascade.** Dropping a `HandoverExport` or `FolioIssue` row removes the pointer, not the bytes. The shipped precedent is `deleteScheduledReportArtifactFile` (`artifacts.ts:337`), called from exactly one place — the schedule-delete route (`backend/src/routes/reports/scheduleRoutes.ts:728`). Wave D's delete paths do the same, and **`dataRetentionWorker.ts` handles no artefacts at all today** (§18.3.8), so nothing sweeps up after a missed call.

**Uploads.** `POST /api/lots/:id/folio` is a new upload surface and gets what §7 of the program requires of every new upload surface: file-type validation (PDF only, magic-byte checked), a size cap, filename sanitisation through the shipped `sanitizeDownloadFilename` path, and the same malware-scanning posture as existing document uploads. The uploaded bytes are treated as **data, never as a claim** — the backend recomputes the SHA-256 rather than trusting a client-supplied one.

**Threat model.** Program §7 line 134 gates a threat model before **D2**, not before D1. That gate stands and is unaffected by D1 shipping. D1's own surfaces are covered by the standing requirements above; if D1c's archive scope grows to include externally-shared delivery, that is a new threat model, not a rider.

---

## 11. Phases and PR slicing

Each phase is independently releasable and independently valuable. Each ships behind a feature flag, default off, enabled per environment.

| Phase | Size | Migration | Depends on | Ships |
| --- | --- | --- | --- | --- |
| **D1a** — handover readiness | S | none | nothing | first; useful alone |
| **D1b** — issued folio | M | 1 (`FolioIssue`) | nothing (independent of D1a) | second |
| **D1c** — archive + worker | L | 1 (`HandoverExport`) | D1b (it collects folios) | third |
| **D1d** — CCTV linkage | ? | ? | **D.0-Q3** | only if Scope A |
| **D.0** — research pass | — | — | nothing | **any time; blocks D2/D3/D1d** |
| **D1e** — configurable requirements | ? | ? | D.0 + a real requirement list | later revision |
| **D2** phases | XL | ? | **D.0 + §5.3 milestone 1** | not scoped here |
| **D3** | ? | ? | **D.0-Q10** | not scoped here |

**D.0 should be dispatched immediately and in parallel with D1a/D1b.** It blocks nothing that D1a–D1c builds, and it is the only thing standing between the program and knowing whether its second-ranked moat exists.

**Deliberately outside Wave D:** the F1 acknowledgement/transmittal half (§2.6); `ExceptionOrWaiver`; any evidence-link table; server-side rendering; anything asset-shaped.

---

## 12. Scale and performance

Measured against the program's reference dataset (§8 lines 138–139: 5,000 lots, 10,000 map features, 50 GB evidence, 10k-row registers).

| Target | Rationale |
| --- | --- |
| Handover readiness for a 5,000-lot project: **p95 < 2 s** server-side | Same budget as the §8 register-filter target; it is one batched conformance pass (`checkConformancePrerequisitesBatch:911`) plus a fold. If it misses, the fix is the batch query, not a cache — `[DH-B4]` forbids storing the verdict. |
| Folio issue (single lot): **p95 < 5 s** end to end on a mid-tier device over 4G | Render is client-side and already happens today; the new cost is one upload. |
| Archive pre-flight estimate: **p95 < 3 s** | Counts and sums only; no file reads. |
| Archive job: no wall-clock target; **must not block the event loop and must not hold the whole archive in memory** | Streamed ZIP writing (§4.3.6, `[DH-c]`). A 2 GB buffer is an outage. |
| Archive download: streamed, constant memory regardless of size | The existing buffer-and-send (`artifacts.ts:380-395`) is explicitly not reused here. |
| **Storage/egress cost of a full-project archive on the reference dataset: measured before any size promise appears in pricing or marketing** | Program §8 line 145 requires it. An archive is a full re-read of a project's evidence and is the single most expensive egress event the product can produce. |

---

## 13. Rollback and recovery

- **D1a:** flag off. Nothing persisted, nothing to undo.
- **D1b:** flag off hides issue + download. `FolioIssue` rows remain and are harmless; storage objects remain and are removed by normal project deletion. Full rollback = revert plus drop table.
- **D1c:** flag off hides the screen; the worker is separately env-gated (the `SCHEDULED_REPORT_WORKER_ENABLED` pattern, `scheduledReports.ts:1303-1320`) so it can be stopped without a deploy. In-flight jobs resume on restart via the stale-lock reclaim; if the worker stays off they sit `queued`, which is visible rather than lost. Partial archives are never stored — the artefact is written once, complete, with `flag: 'wx'`.
- **Migrations:** both additive, both revertible by drop, no backfill.

---

## 14. Acceptance tests

Continuing the shared series from **AT-119** (§ header note).

| # | Phase | Assertion | Kind |
| --- | --- | --- | --- |
| **AT-119** | D1a | **One verdict everywhere `[DH-B5]`.** For a lot the lot-readiness endpoint reports blocked on `open_ncrs`, the handover endpoint reports `ready: false` with `open_ncrs` — same code, same lot, same request. | DB-backed |
| **AT-120** | D1a | **Nothing is stored `[DH-B4]`.** After a handover-readiness read, no row anywhere records a handover verdict; a second read after the blocking NCR is closed returns `ready: true` with no invalidation step. | DB-backed |
| **AT-121** | D1a | **Absence is named `[DH-B1]`.** A lot with no ITP assigned returns `no_itp_assigned` — not an empty `reasonCodes` array and not a generic "incomplete". | unit |
| **AT-122** | D1b | **The sink changes nothing.** `generateConformanceReportPDF` with no `sink` produces the identical `JsPdfRecorder` operation sequence as before the change, and calls `savePdf` exactly once; with a `sink`, the same operation sequence and `savePdf` zero times. | unit (recorder) |
| **AT-123** | D1b | **Versioning appends.** Issuing twice yields versions 1 and 2 with different ids, different storage paths and different `issuedAt`; version 1's row and stored bytes are unchanged. | DB-backed |
| **AT-124** | D1b | **The checksum is the server's.** A client-supplied `sha256` that disagrees with the uploaded bytes is ignored; the stored value matches the bytes. | DB-backed |
| **AT-125** | D1b | **Download verifies.** A stored object mutated out-of-band fails the SHA check and the download errors rather than serving it (the `artifacts.ts:385-388` behaviour, re-asserted on the new path). | DB-backed |
| **AT-126** | D1c | **The archive renders nothing `[DH-B2]`.** With a project whose lots have zero issued folios, the job completes, the archive contains zero folio PDFs, and the manifest marks every lot `folio: none`. No PDF generator is reachable from the worker's import graph. | DB-backed + import assertion |
| **AT-127** | D1c | **Historical content is intact `[DH-B1]`.** A folio issued, then evidence changed, then an archive generated: the archive's folio bytes hash-match the original `FolioIssue.sha256`. | DB-backed |
| **AT-128** | D1c | **Deterministic.** Two runs over unchanged data produce byte-identical `manifest.csv` and identical archive member ordering. | DB-backed |
| **AT-129** | D1c | **No silent omission `[DH-B1]`.** A document row whose storage object is missing appears in `omissions[]` with a reason; the job completes rather than failing, and the summary states the count. | DB-backed |
| **AT-130** | D1c | **The cap refuses, it does not truncate.** A scope exceeding the byte cap is refused at pre-flight with the measured size; no partial archive is produced or stored. | DB-backed |
| **AT-131** | D1 (all) | **`[DH-B3]` holds.** No Wave D code writes a coordinate, level or geometry field on any model. Asserted as a grep-style guard over the new modules, in the spirit of the C3 honesty tests. | static |
| **AT-132** | D1 (all) | **Tenancy.** Every new route refuses a cross-tenant `:id` with the shipped guard's status, for `FolioIssue`, `HandoverExport` and the readiness endpoint. | DB-backed |
| **AT-133** | D1c | **Permission-scoped assembly `[DH-B6]`.** An export requested by a user who cannot read some lots contains none of their files, and the manifest lists them as `not_permitted`. | DB-backed |
| **AT-134** | D1a | **Commercial redaction `[DH-B7]`.** A non-commercial role's handover response carries no `area: 'budget'` items, matching `filterCommercialReadiness` (`evidenceReadiness.ts:458`). | DB-backed |
| **AT-135** | D1c | **Recovery.** A job killed mid-run is reclaimed after its lock expires and resumes rather than restarting; the completed artefact is written exactly once. | DB-backed |

---

## 15. Exit gate

**D1 is done when all of the following are true and evidenced:**

1. AT-119 … AT-135 pass in CI, DB-backed tests against the local disposable Postgres.
2. Handover readiness measured on the reference dataset at 5,000 lots, p95 under budget (§12), with the number recorded.
3. A folio issued, evidence changed, a second folio issued, and both downloaded — with the version-1 bytes hash-identical to issue time. Demonstrated on a real project, not a fixture.
4. A full-project archive generated on the reference dataset, opened, and its manifest checked against the project's actual document count, with omissions reconciled.
5. Archive storage + egress cost measured and recorded (§12, program §8 line 145).
6. Peak memory during archive generation recorded and flat with respect to archive size.
7. The pdfGenerator characterization suite passes **unmodified**, proving the `:888` edit changed no output (`docs/agent-handoff.md:516-517`).
8. Docs + the Clancy knowledge mirror updated in the same PRs, per the program's standing boundaries.
9. **Pilot acceptance:** one real quality manager issues a folio and produces an archive without being walked through it, and the receiving client accepts the output without reformatting (program §6, output standard).

**D.0 is done when** every question Q1–Q10 in §3.4 is answered or explicitly recorded as NOT FOUND with a named next action, at a stated grade, in a merged `docs/research/` document — and this spec's Rev 2 folds the result, closing whatever the answers close.

**D2 and D3 have no exit gate in Rev 1** because they have no scope in Rev 1.

---

## 16. Decisions

### 16.1 Jay's decisions

| # | Decision | Blocks | Recommendation |
| --- | --- | --- | --- |
| **J1** | **Docket/diary inputs to handover readiness: wire or drop?** Parked on D1 by name at `futureConsumers.ts:117-119` and `f0-execution-spec-2026-07-24.md:167`. Both are hardcoded 0 in the engine today. | D1a | **Drop.** Handover readiness is a *quality* verdict — conformance, tests, hold points, NCRs. A missing docket is a commercial fact and already surfaces in claim readiness. Wiring them makes the handover panel disagree with the lot page, which breaks `[DH-B5]` for no gain. Flip if a pilot client's handover checklist actually asks for docket completeness. |
| **J2** | **Does a folio go out under CIVOS branding or the contractor's?** The generator already supports company branding (`buildConformanceReportData.ts:114`, `pdf/branding.ts`). | D1b polish, not D1b | **Contractor's, as today.** The folio is the contractor's document; CIVOS's name on a document handed to a council is a claim CIVOS is not making. No change needed — recording it so nobody "improves" it later. |
| **J3** | **Archive size cap for the first release.** Program §8 line 145 wants the cost measured before a number is promised. | D1c default config | **Ship with a conservative cap (order 5 GB) and the pre-flight estimate visible**, then raise it once §12's cost measurement lands. A cap that refuses loudly is safer than an archive that half-succeeds. |
| **J4** | **Zip dependency: `fflate` or `archiver`** (`[DH-c]`). | D1c | **`fflate`.** Zero transitive dependencies, streams, and runs both sides. Either is fine; hand-rolling is not. |
| **J5** | **D2 jurisdiction order — ADAC-QLD vs A-SPEC-NSW** (program §5 line 117). | D2 (already gated) | **QLD/ADAC, and the choice is not close on current evidence.** The QLD arm has two grade-A council mandates with versions and effective dates (appendix lines 52–53); the NSW/A-SPEC arm has **zero rows at any grade in the appendix and zero occurrences anywhere in `docs/research/**`** (§3.2). Recommend confirming this in D.0-Q7 before finalising — if A-SPEC turns out to be substantially the same standard under a different name, the decision dissolves rather than being made. |
| **J6** | **Is D2 worth pursuing at all before a design partner exists?** §5.3's first milestone needs a surveyor and a head contractor willing to talk. | D2 start | **Run D.0 now regardless — it is one docs PR and it can close a wave.** Do not start D2 code before milestone 1. If the counterparties are not reachable by the time D1 exits, that is the answer, and D1's folio + archive is a complete, sellable handover story on its own. |

### 16.2 The spec's own decisions

| Tag | Decision | Flip condition |
| --- | --- | --- |
| `[DH-a]` | The PDF sink is threaded through the existing options object, not a module-level capture mode. | A second generator needs bulk capability — then promote to a shared sink, still not a global. |
| `[DH-b]` | The archive collects; it never renders. No jsPDF in Node. | Pilots show progressive issuance is not happening — and even then the first fix is a prompt to issue, not a server renderer. |
| `[DH-c]` | One new dependency: a streaming ZIP writer (`fflate` recommended). No hand-rolled ZIP container. | None. Hand-rolling stays rejected. |
| `[DH-d]` | Configurable requirements and `ExceptionOrWaiver` are deferred out of D1 to a later D1e. | D.0 supplies a real receiving-authority requirement list to configure against. |
| `[DH-e]` | No checksum column on `Document`; D1c hashes at archive time. | Hashing dominates archive job time on the reference dataset — measure before adding a column. |
| `[DH-f]` | The folio is the shipped conformance report, unchanged in content. | A pilot client rejects the output for a *content* reason — then it is a content PR against a stable persistence layer. |
| `[DH-g]` | D1c's download streams; the scheduled-report buffer-and-send path (`artifacts.ts:380-395`) is left alone rather than refactored. | Someone needs streaming for scheduled reports too — then extract, with characterization coverage. |

---

## 17. Research register

| Item | Supplies | Grade | Status |
| --- | --- | --- | --- |
| `CIVOS-Research-Appendix-2026-07-24.md:51` | Councils require WAE + ADAC + CCTV before completion certificates | A (council) / C (article) | Sufficient for "handover deliverables exist and are demanding". **Insufficient for who produces them** — D.0-Q1. |
| `:52` (Logan, ADAC 5.01, since 1 Jul 2024) | A named mandate with a version | **A** | Load-bearing for J5. Row's own caveat: **revalidate quarterly**. |
| `:53` (Sunshine Coast, 6.00-only from 1 Sep 2026) | A moving version target inside the build window | **A** | Load-bearing for D2 clause 5. **Revalidate before any D2 build** — the row says so itself. |
| `:54` (12d reads/writes/validates ADAC) | The "import, never author" position | B | Sufficient for the position; **silent on who runs 12d and who receives its output** — D.0-Q1, Q6. |
| `:55` (CivilPro Build Conformance Folio) | The folio is table stakes; the benchmark to match | B | Sufficient to justify D1 existing. **Nobody has read the article's contents list** — advisory for D1's folio contents, not gating (`[DH-f]` keeps content changeable). |
| `:57` (TfNSW DE Standard v4.1, 2022) | D3's only evidence | **A on the document** | **Edition currency and applicability both unknown** — D.0-Q10. |
| `:59` (VicRoads/DTP format) | — | **explicitly UNVERIFIED** | On the never-assert list (`:98`). No Victorian D2 support is implied anywhere in this spec. |
| **ADAC schema / XSD (5.01, 6.00)** | The element set, mandatory attributes, datum requirements, evidence-field question | **NOT READ BY ANYONE** | **D.0-Q2, Q5, Q8, Q9. The single largest hole in the program's second-ranked moat.** |
| **A-SPEC (NSW)** | The other half of Jay decision 3 | **NOT FOUND at any grade, anywhere** | D.0-Q7. §3.2. |
| **WSA 05-2020 conduit inspection deliverable** | What "CCTV linkage" means | **NOT READ** | D.0-Q3. Gates D1d only. |
| `docs/research/c3-lims-format-research-2026-07-28.md` (#1640) | The precedent and the anatomy D.0 copies | A | The proof that reading the document first is cheaper than building on it. §0.4. |
| `docs/research/c1-pack-confirmation-tfnsw-r44-2026-07-27.md`, `...-vicroads-204-2026-07-27.md` | Two prior cases of an unread grade-A appendix URL being wrong | A | The pattern has now recurred twice. Assume it will recur here. |
| `docs/research/05-regulatory-compliance.md:51` | TfNSW DE requires **IFC design files** with custom attributes | C (undated internal research) | Suggests DE is a designer's obligation. **Not sufficient to scope or to dismiss D3** — D.0-Q10. |

**Must be researched before it is encoded — never inferred:** who submits an ADAC file (Q1); anything about the ADAC element set (Q2); the CCTV deliverable's shape (Q3); what council "acceptance" is (Q4); schema availability and licence (Q5); what a 12d export actually contains (Q6); whether A-SPEC exists as a distinct standard (Q7); whether 6.00 breaks 5.01 (Q8); required submission accuracy and datum (Q9); TfNSW DE currency and applicability (Q10); the VicRoads/DTP format (appendix line 59). **None of these may be answered by inference from another.**

---

## 18. Verification notes — derived at `bd3bf36a`

### 18.1 Findings that changed this spec's shape

1. **`HandoverReadinessVerdict` already exists** (`futureConsumers.ts:99-120`), with `subjectType` already admitting `'project'` and all eight reason codes already produced by the shipped conformance computation. D1a was expected to be a design problem and is a mapping problem.
2. **The conformance report already supports four authority formats** (`conformanceReportPdf.ts:164-170`, `types.ts:4`). "Lot conformance folio PDF" was expected to be a new document and is a persistence feature.
3. **`savePdf` is a single 13-line choke point and the conformance generator calls it exactly once, at `:888`.** This is why D1b can obtain PDF bytes with a one-line edit inside a file the project has a standing rule against refactoring.
4. **The scheduled-report worker already implements claim/lock, stale-lock reclaim, retry with backoff, resume-incomplete and SHA-verified storage** (`scheduledReports.ts:176-197`, `:451-484`, `:661-701`; `artifacts.ts:177`, `:200-292`, `:380-395`). D1c reuses the anatomy and invents no second job system.
5. **`crs.ts:13-20` deliberately omits the GDA94→GDA2020 datum shift.** This is correct for the map and disqualifying for an as-constructed record, and it is the concrete technical reason `[DH-B3]` is an invariant rather than a preference.
6. **The appendix has no A-SPEC row and the repository has no A-SPEC or ADAC occurrence at all** (`tools.ts:112` is `"QA-specific"`). Jay decision 3 is not a balanced fork on current evidence.
7. **`fast-xml-parser ^5.10.1` is installed and exercised at three read sites; `XMLBuilder` is never imported and no `.xsd` file exists.** If D2 ever happens, its XML writer adds no dependency — which is worth knowing and is *not* a reason to start it.

### 18.2 Citation provenance

Personally re-opened at `bd3bf36a`: `futureConsumers.ts` (whole file), `pdfSave.ts` (whole file), `conformanceReportPdf.ts:160-180` and `:888`, `buildConformanceReportData.ts` (whole file), `schema.prisma:585`, `:612-613`, `:889-903`, `:1592-1655`, `:1657-1667`, `lots/validation.ts:10-19`, `spatial/crs.ts:13-41`, `artifacts.ts` export list, `f0-execution-spec-2026-07-24.md:23/35/167`, program lines 81–92 and appendix lines 51–59.

Carried from the current-state survey and **not** individually re-opened: the readiness-engine internals in §2.1 (`evidenceReadiness.ts` / `core.ts` / `conformancePrerequisites.ts` line numbers), the scheduled-report worker line numbers in §2.3, the spatial model line numbers in §2.5 other than those listed above, the drawings-route guard line numbers in §2.6, and the NOT-FOUND greps in §2.7. **Whoever builds a phase re-derives the citations in that phase's section before relying on them** — this repository has now produced two documented cases of a confidently-cited line number being wrong by one or by a lot (`wave-c3-spatial-tests-lims-spec-2026-07-28.md:762`).

### 18.3 Observations for whoever builds this — none blocking

1. **`sendScheduledReportArtifactFile` buffers whole files into memory** (`artifacts.ts:380-395`). Fine at 200 KB, not at 2 GB. D1c writes its own streamed path rather than fixing the shipped one (`[DH-g]`), but the shipped one is a latent problem the day someone schedules a report over a large dataset.
2. **`Document` has no checksum column** (`schema.prisma:1592-1638`). D1c hashes at archive time (`[DH-e]`). If archive jobs ever become frequent, that changes.
3. **The `Drawing` model tracks revision and supersession but nothing about receipt or acknowledgement** (§2.6), and no F1 execution spec exists at this SHA. A folio can therefore state *which* drawing revision a lot's evidence references, but never *whether the crew had it*. Say that plainly in the folio rather than implying the stronger claim.
4. **`landxmlParser.ts` ignores elevation** (`:74`) **and rejects spirals** (`:116-119`). Both are correct for alignments and both would need work for asset geometry. Noted so D2 does not discover it as a surprise.
5. **There are no Prisma enums anywhere in this schema.** Every new status vocabulary in §7 follows the existing Zod-at-the-route convention. Do not introduce the first enum here.
6. **`ITPCompletion.gpsLatitude/gpsLongitude` (`schema.prisma:728-729`) are written but rendered nowhere** — C3 recorded the same thing. Still true. Not Wave D's.
7. **The archive is the product's largest egress event by an order of magnitude.** §12's cost measurement is not a formality; it is the number that decides whether a "50 GB evidence project" is a pricing promise or a pricing mistake.
8. **`dataRetentionWorker.ts` contains no artefact handling** — grep for `artifact` in it returns nothing at this SHA. Scheduled-report artefact bytes are deleted only by the schedule-delete route (`scheduleRoutes.ts:728`). Wave D's new artefacts must not assume a sweeper exists, and whether one should exist for all three artefact kinds is worth its own small PR. Not Wave D's to fix.

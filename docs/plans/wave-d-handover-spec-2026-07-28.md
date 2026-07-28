# Wave D Execution Specification — handover: the folio is the product

**Date:** 28 July 2026 · **Rev 2** · **Status:** D1 is respecced and build-ready in **eight** phases (§4.0). **D2's XML limb is DELETED** on grade-A evidence (§5). **D3 is CLOSED** (§6). D1d is unblocked at **Scope A**. Rev 1's slicing is superseded.

**All `file:line` citations were opened in this worktree at HEAD `f2defa173446d62ba030ccf3eea26306096e512b`** (= `origin/master`, `docs(research): D.0 ADAC confirmation — D2 killed twice; Logan PSP5 evidence pack IS the folio spec (#1660)`). Rev 1 cited `bd3bf36a`; **five commits landed between them and two moved code this spec depends on** — see §0.6. Everything load-bearing in §2, §3 and §4 was re-derived at `f2defa17`, not carried.

**The two inputs Rev 2 folds:**
1. **`docs/research/d0-adac-handover-research-2026-07-28.md`** (#1660, merged `f2defa17`) — the D.0 research gate Rev 1 §3 demanded. It killed D2 twice over and returned a published, mandatory, council-enforced requirement list that Rev 1 §4.5 said did not exist.
2. **The standing engineering review of Rev 1, score 2/10, "Not build-ready"** — eight blockers `[DR-B1]`–`[DR-B8]`, nine advisories `[DR-A1]`–`[DR-A9]`, and a slicing verdict of NO-GO on D1a, D1b and D1c as written. Every finding was re-verified at `f2defa17` before folding; **one is now partly discharged by a merged fix and one is stale on line numbers only** (§0.5). Nothing was refuted on substance.

**Program contract:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` §3 Wave D, **lines 81–92**. Rev 2 closes clauses at lines 83–91 (D2) and line 92 (D3) on evidence, and re-slices line 82 (D1). Also §5 line 117 (Jay decision 3 — **void as framed**, §16.1 J5), §5 line 119, §7 line 134 (threat model — **pulled forward from D2 to D1b.0**, §4.3), §8 lines 138–146, §10 line 152.

**Research contract:** `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md` §C lines 51–59. D.0 **re-graded three of those rows** and answered the one marked `UNVERIFIED` (§17.2).

**Parent specs, read not remembered:** `docs/plans/f0-execution-spec-2026-07-24.md` (lines 23, 35, 167 — all three discharged, §4.9, §7, §16.1); `docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md` and `docs/plans/wave-c2-test-lifecycle-spec-2026-07-28.md` (the evidence a folio compiles); `docs/plans/wave-c3-spatial-tests-lims-spec-2026-07-28.md` (the C3.0 precedent D.0 reproduced, and the precedent for closing a limb on research); `docs/plans/wave-e-approvals-spec-2026-07-28.md` + `docs/plans/wave-e0-threat-model-2026-07-28.md` (the gated-threat-model-before-code pattern D1b.0 now copies).

**House style** matches the C1, C2, C3, E, D14, F1 and sync-centre specs: numbered sections, explicit disposal of every program clause, a current-state map read at a named SHA, a decision register with flip conditions, per-phase rollback, named acceptance tests continuing the shared series, an exit gate.

**Tag namespace.** `[DH-*]` for this spec's decisions, `[DH-B*]` for its invariants, `[DR-*]` for the review findings being folded (review-owned; this spec disposes of them but does not author them). `[C1C-*]`, `[C1R-*]`, `[C2L-*]`, `[C2R-*]`, `[C3S-*]`, `[C3R-*]`, `[D14R-*]`, `[D14X-*]`, `[E-*]`, `[ER-*]`, `[SC-*]`, `[F1C-*]`, `[WBR2-*]` are taken. `[DR-*]` returns zero hits across `docs/` at this SHA (verified).

**Acceptance-test numbering.** The highest allocated number across `docs/plans/` at this SHA is **AT-135** — Wave D Rev 1's own ceiling (verified by grep). Rev 2 keeps AT-119…AT-135 where the assertion survives, **restates** those whose meaning changed, and takes **AT-136 onward** for the new phases.

---

## 0. Rev 2 changelog

### 0.1 What changed, in one paragraph

Rev 1 was built on a guess it correctly refused to make and a set of code claims it did not check hard enough. The guess was D2: whether the head contractor is anywhere near an ADAC XML file. D.0 answered it — **no, twice over, at grade A** — so the XML limb is deleted rather than deferred, and with it the largest phase in the program. In exchange D.0 returned something Rev 1 explicitly said did not exist: **a published, mandatory, council-enforced list of exactly what the contractor must produce**, which is now the thing D1's folio is compiled against (§2). The review supplied the other half: Rev 1's three D1 phases were all NO-GO, not because the direction was wrong but because **the shipped PDF contradicts the wave's own honesty rule, the readiness contract it planned to map is incomplete, and the issuance boundary trusted the browser**. Rev 2 folds all of it: three new phases in front of the old three (`D1a-respec`, `D1b.0`, `D1c.0`), a folio that is a **new mode** rather than an edit to the certificate QMs use today, server-controlled issuance, and a retention/PII section that Rev 1 did not have at all.

### 0.2 The product claim, restated

Rev 1's implicit claim was that CIVOS would eventually produce a council submission. D.0 makes that indefensible: on a Queensland developer Operational Works job the submitting party is the **consulting engineer (RPEQ)**, the duty holder is the **developer**, and *"an inspection and testing certificate signed by the consultant"* is what the council receives (Logan PSP5 §5.6.5(1)(a), grade A, read by the D.0 author). Across 14 councils **no document names the civil head contractor as producer, holder or submitter of the ADAC XML**, and two councils state that officers *"will not deal directly with Contractors."*

> **The claim CIVOS may make: "produce a clean, certifiable evidence bundle your engineer can lodge."**
>
> **The claim CIVOS may never make: that it submits to, is accepted by, or certifies anything for a council.**

This is not marketing copy pinned into an engineering spec. It is a **build constraint**, and it decides §2.4 (there is no signature block), §4.3 (the folio removes certification language), §5 (there is no exporter) and §15 (the exit gate is measured at the consultant, not the council).

`[DH-B8]` — **CIVOS never claims to submit, lodge, or be accepted by a receiving authority, and never presents itself or the contractor as the certifying party.** Asserted by AT-136 (a string guard over folio artefacts) and AT-137 (the wording assertions of §2.4).

### 0.3 Disposition of every review finding

| Tag | Verified at `f2defa17`? | Disposition |
| --- | --- | --- |
| **`[DR-B1]`** existing PDF violates `[DH-B1]` | **Yes, with one half already fixed.** Certification language confirmed live: `LOT CONFORMANCE CERTIFICATE` (`conformanceReportPdf.ts:78,86,94,102`), `CONFORMANCE CERTIFICATION` (`:838`), `I hereby certify that this lot has been constructed in accordance with the contract` (`:850`), `Prepared in accordance with…` (`:904-908`). **The unverified-PASS half is FIXED** — see §0.5. | **FOLDED. New phase `D1b.0` (§4.3).** The folio is a **new mode**, not an edit of the shipped certificate. Existing formats remain untouched for their shipped purpose. Folio mode strips certification language, carries expected-vs-present-vs-missing against the §2 pack list, and is characterized per format — **all five, including DIT**. |
| **`[DR-B2]`** D1a is not a mapper | **Yes, still true at HEAD.** The `HandoverReasonCode` union is **unchanged** at `futureConsumers.ts:99-109` (verified: `#1656`/`#1658` touched `futureConsumers.ts` and `reasonCodes.ts` but not this union). `insufficient_test_count` is a live blocking code at `evidenceReadiness/conformanceItems.ts:182-192` and is **absent** from the union. `getClaimBlockingReasonsForConformedLot` returns `string[]` (`conformancePrerequisites.ts:195-198`), not codes. `ProjectArea` is a chainage interval with no lot FK (`schema.prisma:447-459`); `Lot` carries `areaZone`, `activityType`, `activitySlug` (`:556-568`). | **FOLDED. New phase `D1a-respec` (§4.1).** Union widened to every currently-blocking code; complete batched handover snapshot; `areaId` **defined** as chainage-window overlap with a named `unplacedLots` escape (§4.1.3); exhaustive parity ATs, not one example. |
| **`[DR-B3]`** a client can issue doctored bytes | **Yes.** `useConformanceReportGeneration.ts:110-116` assembles the payload from **six independent `apiFetch` reads** in one `Promise.all` plus React lot state, then renders at `:156`. No transactionally coherent snapshot exists. | **FOLDED, option 1 (server-controlled issuance).** Server-created immutable source snapshot; server-computed `compiledFrom`; server-bound issue ID; server-side verification of content derivation. `D1b.0` carries its own threat model (§4.3.4), pulling program line 134's gate forward from D2. |
| **`[DR-B4]`** four-format / one-line claims false | **Yes, and worse than stated.** Five formats confirmed at `pdf/types.ts:2` (`standard \| tmr \| tfnsw \| vicroads \| dit`) — Rev 1's `FolioIssue.format` vocabulary omitted DIT. `JsPdfRecorder` has `save()` at `pdfTestRecorder.ts:63-66` and **no `output()`**. `savePdf` is a genuine sole choke point (`pdfSave.ts:7-13`) — that narrow claim was correct. | **FOLDED into `D1b.0`.** DIT included; all five characterized; recorder gains Blob/`output()` support; one real-jsPDF byte test under fixed metadata. **Rev 1's "the characterization suite passes unmodified" claim is withdrawn** — see §0.5. |
| **`[DR-B5]`** the worker cannot resume a ZIP | **Yes.** Four of five properties hold; **resume does not**. `findRetryableScheduledReportRun:451-484` resumes *recipient deliveries*; missing PDFs are regenerated from scratch at `:750-784`. `processedLots` is not a ZIP checkpoint. | **FOLDED as written into `D1c.1`/`D1c.2` (§4.6, §4.7).** Renewable lease, `leaseOwner`, fencing token, heartbeat; durable `HandoverExportMember` rows with states and checksums; explicit restart semantics; cancellation fencing; two-competing-worker tests. **AT-135 is rewritten** — it was unimplementable as Rev 1 phrased it. |
| **`[DR-B6]`** the 5 GB plan contradicts itself | **Yes, every limb.** `fileSize Int` caps at 2,147,483,647 on Postgres. Hold-point `releaseSignatureUrl`/`evidencePackageUrl` are bare strings with **no stored byte size** (`schema.prisma:777-779`), so a counts-and-sums preflight cannot measure them. | **FOLDED. New phase `D1c.0` (§4.5)** — a production-shaped streaming spike: ZIP64-capable writer, backpressure-aware pipeline, Supabase TUS/S3 multipart, `BigInt` byte counts, the `[DR-A3]` cap formula, and a benchmark of the candidate writers (`[DR-A4]`). |
| **`[DR-B7]`** neither migration enforces history | **Yes.** Absent `updatedAt` prevents nothing; Rev 1 simultaneously claimed "no update path" (`:289-291`) and required delete paths (`:460`). `@@unique([lotId, version])` already indexes — Rev 1's extra identical index was redundant. | **FOLDED as written.** A **DB trigger rejecting `UPDATE` on `FolioIssue`** (§7.1); preallocate-UUID-then-upload-then-insert in a version-allocating transaction; **one** authorized deletion procedure, audited (§10.4); `compiledFrom` gains a schema version and exact source row identity; redundant index dropped. |
| **`[DR-B8]`** permissions/retention/storage inconsistent | **Yes.** `[DH-B6]` (no unreadable record in a manifest) directly contradicted Rev 1 `:459`/AT-133 (list them in `omissions[]`). `CLAUDE.md:266` confirms the local-disk fallback is **ephemeral**. Rev 1 had no retention, expiry, legal-hold or PII section. | **FOLDED as written.** Fail **closed** in production when durable storage is unavailable; **aggregate-only** unauthorized counts (no ids, no filenames, no lot associations); a full retention/PII policy section (§10.5). **AT-133 is rewritten.** |
| `[DR-A1]` J1 quality-only without a checklist | Yes. | **FOLDED both halves.** D1a is renamed **"quality closeout readiness"** throughout. And D.0 supplied the receiving checklist the advisory asked for: **Logan PSP5 §5.6.5 IS that list** — recorded in §2, which is why J1's "drop dockets and diaries" now stands on evidence rather than on assertion (§16.1 J1). |
| `[DR-A2]` branding ≠ issuer/signatory | Yes. Branding is shipped (`buildConformanceReportData.ts:114`). | **FOLDED, decided together.** Contractor branding, **no signature block at all**, and explicit wording that neither CIVOS nor the contractor certifies. Wording specified verbatim in §2.4 and asserted by AT-137. D.0's consultant-signs finding is what resolves it. |
| `[DR-A3]` 5 GB cap | Yes. | **FOLDED.** Replaced by the effective-cap formula (§4.5.3), with binary units, unknown-size behaviour, member-count limits and an input-vs-output ruling. |
| `[DR-A4]` `fflate` chosen on the wrong axis | Yes — zero transitive deps is not the deciding requirement. | **FOLDED into `D1c.0` (§4.5.2).** Benchmark `fflate`, `archiver`, `yazl` and a Web Streams/ZIP64 option against >4 GB, 50,000-file, cancellation and memory fixtures. **J4 is withdrawn as a recommendation** and becomes a spike output. |
| `[DR-A5]` QLD-before-NSW is not a jurisdiction argument | Superseded. | **REPLACED by the D.0 verdict.** There is no jurisdiction fork left to make: D2 is deleted, A-SPEC is a **Victorian commercial product with a member-restricted licence and zero NSW adoption**, and NSW's structured-format councils are on ADAC. Rev 2 is **QLD folio-first with no jurisdiction fork** (§16.1 J5). |
| `[DR-A6]` D.0 may not fit one docs PR | Yes — and it did fit, at grade A, with paywalled items honestly marked NOT FOUND. | **DISCHARGED by outcome.** D.0 merged as #1660. The advisory's rule ("do not convert inability to obtain proprietary material into an inferred answer") was honoured — WSA 05 Appendix A5 is marked NOT FOUND at AUD $792 rather than guessed. |
| `[DR-A7]` D.0 missing decision-critical questions | Yes. | **FOLDED into §17**, a residual-questions section with an explicit outcome per question — `unblocks` / `rescope` / `closes limb` / `remains blocked`. Repo-answerable items are recorded as **code facts**, not re-researched. |
| `[DR-A8]` `[DH-B3]` stated too broadly | **Yes, confirmed false as absolutely worded.** `controlLineGeometry.ts:44-51` converts local control points to WGS84; `lotGeometry.ts:100` (`generateChainageOffsetPolygon`) computes offset polygons; `geoPdf.ts` implements a separate forward MGA projection. | **FOLDED — invariant reworded verbatim as directed** (§8, `[DH-B3]`). |
| `[DR-A9]` citation and scope hygiene | Yes, all five inaccuracies confirmed. | **FOLDED.** Corrections listed in §0.4. |

### 0.4 The `[DR-A9]` corrections, made

| Rev 1 said | Rev 2 says |
| --- | --- |
| `:24` "one new table, one new column on an existing table" | **Wrong, and §7 contradicted it in the same document.** Rev 2 creates **three** tables (`FolioIssue`, `HandoverExport`, `HandoverExportMember`) plus one `FolioSnapshot`, and **no** column on any existing table. §7. |
| "four authority formats" | **Five** — `standard`, `tmr`, `tfnsw`, `vicroads`, **`dit`** (`pdf/types.ts:2`). |
| "all eight codes already produced by the batch computations" | **False.** `computeConformanceResult` returns prerequisite booleans; `getClaimBlockingReasonsForConformedLot` returns human strings; `open_major_ncrs` is produced in `claimReview.ts:230`, whose severity input the conformance batch does not fetch. §4.1. |
| "the archive is reproducible from immutable inputs" | **Only once inputs are frozen.** Mutable/superseded document selection made it non-reproducible. `HandoverExportMember` freezes exact row ids, versions, sizes and checksums (§7.3). |
| "identical manifests" | Qualified: `manifest.csv`/`manifest.json` are byte-identical across runs; `manifest-summary.json` carries generated-at and is **excluded from the determinism assertion** (§4.7.2, AT-128). |
| "the only edit is one line at `conformanceReportPdf.ts:888`" | **Stale and withdrawn.** See §0.5. |

### 0.5 Two findings that moved between the review's SHA and this one

The review was performed at `9bd83dd9`. This spec is at `f2defa17`. Two things changed, and both are recorded rather than quietly absorbed.

**1. `[DR-B1]`'s unverified-PASS half is FIXED — by `#1658` (`2dd1adf0`, `fix(pdf): conformance report never prints PASS for an unverified test`).** The review's finding was: *"It ignores `TestResult.status`, so an unverified row whose `passFail` is `pass` prints `PASS`."* At `f2defa17` that is no longer true. `conformanceReportPdf.ts:112-135` now carries `isVerifiedTest()` (`status === 'verified'`) and `getTestVerdict()`, which returns `Pending Verification` or `Awaiting Result` for an unverified row and reaches `PASS` only through the verified branch; the summary line at `:367-385` counts `Passed`/`Failed` **only over verified rows** and prints an explicit `Unverified: n`. **This is the single strongest piece of evidence that `[DR-B1]`'s remaining half is real:** the same file, the same authority formats, the same reviewer-identified failure class — and it took a dedicated PR to fix one instance of it. The certification-language half (`:78-102`, `:838`, `:850`, `:904-908`) is untouched and remains a live contradiction of `[DH-B1]`.

**2. Rev 1's `:888` citation is stale, and its headline claim with it.** `#1658` added 33 lines above the terminal call. `savePdf` for the conformance generator is now at **`conformanceReportPdf.ts:922`**, in a **923-line** file (was 889). More importantly, Rev 1's *"the existing characterization suite passes unmodified, which is the point"* (`:283`, `:549`, exit-gate item 7) **is withdrawn**: `#1658` changed rendered output — verdict strings, a new summary field, and column widths `[38,30,42,22,38] → [38,30,42,28,32]` — and correspondingly modified `conformanceReportPdf.test.ts` (+76 lines). A characterization suite that must be edited when behaviour legitimately changes is working correctly; a spec that promises it will never be edited is making a promise it does not control. **Rev 2 promises the narrower, true thing:** the folio mode adds a code path and changes **no** operation recorded for any existing format, asserted per format by AT-122.

### 0.6 Commits between `bd3bf36a` and `f2defa17`

`6891a559` (E1 hold-point awaiting-release predicate — moved `reasonCodes.ts` provenance and `futureConsumers.ts` comments, **not** the handover union), `e2e2f4e4` + `d9117e21` (C3 exit-gate docs), `2dd1adf0` (`#1658`, above), `f2defa17` (`#1660`, D.0). Two of the five touched files this spec depends on; both are folded above.

---

## 1. The honesty rules, and the precedent that produced this revision

### 1.1 `[DH-B1]` — a folio is a compilation, not an assertion

**CIVOS states what evidence exists and what is absent; it never certifies conformance, never fills a gap, and never silently changes a document it has already issued.**

Concretely, and enforced by AT-121 / AT-127 / AT-129 / AT-136 / AT-137:
- A folio for a lot with three of five test certificates present lists **two as missing, by name**. Rev 1 asserted the shipped renderer could already do this; it cannot — its payload carries only actual `testResults` (`pdf/types.ts`), it renders at most 15 actual rows, and it has **no expected-requirement input at all**. That gap is exactly what §2's pack list and §4.3's content contract close.
- The words "certified", "certifies", "compliant", "I hereby certify" and "approved by CIVOS" appear nowhere in a **folio** artefact. (They remain in the shipped **certificate** formats, which are a different product for a different purpose — §4.3.1.)
- Re-issuing produces a **new version** with a new id and a new checksum. The previous version stays downloadable and unaltered — enforced by a **database trigger**, not by the absence of a column (§7.1, `[DR-B7]`).
- The bulk archive **collects issued folios; it never renders one** (`[DH-B2]`).

### 1.2 `[DH-B3]` — reworded, as `[DR-A8]` directed

Rev 1 said *"CIVOS never authors survey geometry, a coordinate, a level, or a certification."* That is **already false for the shipped map product** and the review proved it: `controlLineGeometry.ts:44-51` converts local control points to WGS84, `lotGeometry.ts:100` computes offset polygons from a chainage window, and `geoPdf.ts` implements its own forward MGA projection. An invariant that the codebase already violates is not an invariant; it is a slogan, and the first engineer to notice stops believing the rest of the list.

> **`[DH-B3]` (Rev 2): Wave D outputs never present CIVOS-derived map geometry as surveyed or as-constructed geometry. Any re-emitted coordinate carries its provenance.**

The technical proof that this matters is unchanged and was re-confirmed at HEAD: `backend/src/lib/spatial/crs.ts:13-20` deliberately treats GDA94 and GDA2020 as WGS84-aligned (`towgs84=0,0,0`), accepting ~1.8 m of GDA94 error, with an explicit `ponytail:` note that no 7-parameter datum shift exists. **D.0-Q9 confirms this is the correct posture and not a gap:** the ADAC schema contains no transformation, epoch or reprojection element of any kind — it records a datum *label* only — and no council or utility document authorises a datum transform by the receiving software. Wrong-datum files are returned for correction, not converted. `crs.ts` stays display-grade. No stop-and-replan.

### 1.3 The C3.0 precedent, now discharged twice

Wave C3 planned a "TfNSW LIMS tabulated ingestion" limb on a cited grade-A appendix row that nobody had opened. When someone read it (`docs/research/c3-lims-format-research-2026-07-28.md`, #1640), it described a laboratory's submission *to* TfNSW; the head contractor appears nowhere, and a CIVOS-generated submission would have been a fabricated lab record. The limb was closed, not built.

**Rev 1 predicted D2 had the same shape. D.0 confirmed it, and the pattern has now recurred three times** (`c1-pack-confirmation-tfnsw-r44`, `c3-lims-format-research`, and now D.0). One docs PR closed a wave-sized limb, for the third consecutive time. Assume it recurs; §17 is written on that assumption.

---

## 2. The requirement list — Logan PSP5 §5.6.5, mapped to shipped features

This section is new in Rev 2 and it is the most valuable thing D.0 returned. Rev 1 §4.5 deferred configurable requirements because *"there is no evidence yet for what to configure."* **There is now.**

### 2.1 What the list is, and why it binds

Logan City Council Planning Scheme Policy 5 §5.6.5 is a **published, mandatory, enumerated** list of what must accompany an as-constructed submission. It is **grade A** (downloaded, text-extracted and read directly by the D.0 author, not accepted from a delegated fetch). It **gates on-maintenance approval**, and on-maintenance in turn **gates plan sealing** (§5.4) and reaches **bonds** at Ipswich, Whitsunday and Redland. Gold Coast, Moreton Bay, Rockhampton and Unitywater publish comparable lists.

`[DR-A1]` asked for *"an actual receiving checklist before permanently dropping either dimension."* **This is that checklist**, and it is recorded here so the next revision does not go looking for it again. It is also notable for what it does **not** contain: no docket, no diary, no labour or plant record appears anywhere in it — which is what turns §16.1 J1 from an assertion into a finding.

### 2.2 The pack, mapped to shipped CIVOS features or an honest gap

| # | PSP5 §5.6.5 item | Shipped CIVOS feature that feeds it | Verdict |
| --- | --- | --- | --- |
| **1** | *"an inspection and testing certificate signed by the consultant"* (§5.6.5(1)(a)) | Nothing, **by design**. CIVOS compiles the evidence the consultant certifies **over**; it does not produce the certificate and does not sign. | **GAP, deliberate and permanent.** This is the honesty line (§0.2, §2.4). The folio is the input to this item, never the item. |
| **2** | Test results across **18 named categories** (fill/trench compaction, sub-grade CBR and compaction, CBR 15 quality and compaction, sub-soil drain filter grading, bedding grading, base/sub-base quality and compaction, prime and primer seal rates, AC core tests, concrete testing, sewer and water main pressure tests, water quality) | `TestResult` (`schema.prisma:857`) with `status`/`passFail`, C1's sufficiency engine, and F1's canonical categoriser (`readiness/sufficiency/testCategories.ts`). Verified-only counting shipped in `#1658`. | **SHIPPED, with a named crosswalk gap.** `TestCategory` is `type TestCategory = string` (`testCategories.ts:22`) — an **open** vocabulary derived at read time, not a closed 18-item list. **No Logan-18 crosswalk exists in the repo.** That crosswalk is the first real content of D1e (§4.9) and is *not* built in D1. |
| **3** | ***"details of the retesting or rectification carried out where any test result fails"*** | Partial. `NCR.rectificationNotes` / `rectificationSubmittedAt` (`schema.prisma:955-956`) carry the trail **when an NCR was raised**. C2's test lifecycle carries the fail. | **PARTIAL — the gap is precise and worth naming.** There is **no structural retest→original-test link on `TestResult`**. A failed test followed by a passing retest with no NCR raised leaves the two rows unassociated. The folio must therefore state *"failed test, rectification not linked"* rather than implying a clean trail. Closing it is a C2-family column, not a D1 phase. |
| **4** | *"CCTV video for underground stormwater infrastructure work"* (§5.6.5(1)(e)) | `Document` with a `documentType` value + lot association + manifest category. | **UNBLOCKED at Scope A** by D.0-Q3. Logan specifies **video container formats** (*"WINCAM (version 7 or later) or CCTV footage or DVD-ROM … or MPEG 4"*) and run endpoints (*"first drainage maintenance hole upstream and downstream"*) — a file set, not a structured record. §4.8. |
| **5** | ***"date-stamped photographs of work that will not be visible after construction, taken prior to backfilling, with a chainage or exact location reference in the filename"*** | `Document.captureTimestamp` + `gpsLatitude`/`gpsLongitude` (`schema.prisma:1604-1606`), the shipped photo-pin and chainage-generator work, and `Lot.chainageStart`/`chainageEnd` (`:551-554`). | **SHIPPED — and the filename requirement is free.** `Document` has **no chainage column** and does not need one: the archive's deterministic naming rule (§4.7.3) derives it from the owning lot. This is the single closest fit in the whole pack and it lands as a **naming rule**, not a migration. |
| **6** | *"an asset list in editable spreadsheet format"* | Nothing. The 78-model schema has **no `Asset`, `Pit`, `Pipe`, `Manhole`, `Node` or `Conduit` model** (§3.6, re-verified). | **GAP, and deliberately not closed.** This is the surveyor's and consultant's deliverable, produced from the same survey that produces the XML. Building an asset register to fill it is §1.3's forbidden over-build wearing a requirement-list costume. |
| **7** | Vendor **O&M manuals** | `Document` with a `documentType` value and a manifest category. | **SHIPPED as storage.** A manifest category and nothing more. Explicitly **not** an O&M manual builder (§1.3). |

**Score, stated plainly: of seven mandatory pack items, CIVOS materially feeds four (2, 4, 5, 7), partially feeds one (3), and deliberately does not feed two (1, 6) — one because certification is not ours to make, one because asset registers are not our product.** That is the honest shape of "a clean, certifiable evidence bundle your engineer can lodge", and it is a good shape: the items CIVOS covers are exactly the ones the head contractor is on the hook for.

### 2.3 What the mapping changes about D1

1. **The folio gets an expected-requirements input it does not have today.** Rev 1's folio was the shipped certificate with a database row attached; it could not say "two missing, by name" because nothing tells it what to expect. §2.2 is now that list. `D1b.0` defines the content contract as **expected → present → missing**, per pack item (§4.3.2).
2. **Determinism gets a purpose.** §4.7.3's deterministic archive paths were a nice property in Rev 1. Pack item 5 makes them a **requirement**: chainage in the filename is a council-enforced condition. D.0 also notes this is the shape the engineer's ADAC `SupportingFile` field (a bare 254-character filename string, no type, no hash, no URI) can reference — a free consequence, not new work.
3. **D1e's stated blocker is gone but D1e still is not built.** `[DH-d]`'s flip condition was *"D.0 supplies a real requirement list."* It did. That means D1e can now be **specified** when someone wants it; it does not mean it is in D1 (§4.9).

### 2.4 Who signs — and the exact wording that follows `[DR-A2]`

`[DR-A2]` found that contractor branding does not answer who is certifying, and that the shipped authority formats make the contractor appear to certify CIVOS-generated text over an empty signature block. D.0 resolves it: **the consultant signs.** So, decided together as the advisory required:

| Question | Decision |
| --- | --- |
| Issuer organisation | The **contractor's**, via the shipped company branding (`buildConformanceReportData.ts:114`, `pdf/branding.ts`). Unchanged from J2. |
| Signatory authority | **None. The folio has no signature block at all.** Not an empty one — an empty signature line under compiled text is an invitation to sign over a claim nobody made. This is the concrete change `[DR-A2]` asked for and Rev 1's J2 missed. |
| CIVOS attribution | One line, factual, non-prominent: `Compiled in CIVOS by {name} on {date}. Folio {id} v{n}.` |
| Legal wording (verbatim, asserted by **AT-137**) | *"This folio is a compilation of records held in CIVOS at the date and time stated. It is not a certification. Certification of the works is the responsibility of the certifying consultant and is not made by this document, by the contractor named above, or by CIVOS."* |
| Branding snapshot | The branding in force **at issue time** is frozen into the `FolioSnapshot` (§7.2), so a v1 folio does not silently re-brand when the company logo changes. |

---

## 3. Current-state map (re-read at `f2defa17`)

### 3.1 The readiness engine, and the contract that is not as complete as Rev 1 claimed

Pure functions over passed-in inputs, no Prisma: `backend/src/lib/evidenceReadiness.ts:397` (`buildLotReadinessFromInputs`), types in `backend/src/lib/evidenceReadiness/core.ts`. Items carry `severity` split into `blockers`/`warnings`/`support` plus a separate `blocksAction` boolean.

Conformance prerequisites: `backend/src/lib/conformancePrerequisites.ts` — `computeConformanceResult:515`, batch form `checkConformancePrerequisitesBatch:911`, post-conformance regression check `getClaimBlockingReasonsForConformedLot:195`.

**`futureConsumers.ts:99-109` declares `HandoverReasonCode` as a closed eight-member `Extract<>`, and `:111-120` declares `HandoverReadinessVerdict` with `subjectType: 'lot' | 'project'`. Nothing implements it; there are no callers.** That much of Rev 1 was right. What Rev 1 got wrong, confirmed at HEAD:

- **The union is incomplete.** `insufficient_test_count` is emitted as a `severity: 'blocker'`, `blocksAction: true` item at `evidenceReadiness/conformanceItems.ts:182-192` and is **not** in the union. A handover panel that refuses to widen (Rev 1 `:263-266`) is guaranteed to disagree with the lot page — the exact violation `[DH-B5]` exists to prevent.
- **The cited computations do not return codes.** `computeConformanceResult:515` returns `ConformanceCheckResult` — prerequisite booleans plus human-readable strings. `getClaimBlockingReasonsForConformedLot:195-198` returns `string[]`.
- **`open_major_ncrs` comes from a different pass.** It is produced at `evidenceReadiness/claimReview.ts:230`; the conformance batch select does not fetch NCR severity.
- **`unreleased_hold_points` depends on a separate count** performed by the lot-readiness route (`backend/src/routes/lots/qualityRoutes.ts:301-360`); the conformance batch queries only the N/A-bypass subset.

Readiness is **computed on every read**. The only persistence is a decision-time snapshot into `RequirementEvaluation` (`schema.prisma:1743`), off unless `READINESS_SNAPSHOTS_ENABLED=true`.

### 3.2 The PDF stack — five formats, one choke point, one moved line

`frontend/src/lib/pdfGenerator.ts` is a 25-line re-export barrel; generators live in `frontend/src/lib/pdf/`. `jspdf ^4.2.1`, lazily loaded via `jsPdfRuntime.ts:3-8`. No pdfkit, no puppeteer, no pdf-lib.

**`generateConformanceReportPDF` at `conformanceReportPdf.ts:168`**, now **923 lines** (was 889 before `#1658`). **Five** selectable formats — `standard | tmr | tfnsw | vicroads | dit` (`pdf/types.ts:2`), surfaced by `ConformanceReportModal.tsx:10-37`. Payload assembled by `buildConformanceReportData.ts:67`.

**`savePdf` (`pdfSave.ts:7-13`) is a genuine sole choke point** and the conformance generator calls it exactly once, now at **`:922`**. There is no way today to obtain the PDF as bytes: capturing a Blob needs `doc.output('blob')`, and **`JsPdfRecorder` has `save()` (`pdfTestRecorder.ts:63-66`) and no `output()`** — `[DR-B4]`.

Existing conformance characterization exercises the **standard format only** (`conformanceReportPdf.test.ts`, extended by `#1658`). **NOT FOUND:** any golden-PDF fixture or byte/visual diff.

The standing rule holds: `docs/agent-handoff.md:516-517` and `downloadable-files-improvement-plan-2026-07-05.md:58` — *"pdfGenerator is jurisdictional — DO NOT refactor."* §4.3 respects it by **adding a mode**, not restructuring the file.

Backend PDF is a hand-rolled ASCII-only text writer (`backend/src/lib/scheduledReports/pdf.ts:69`) serving scheduled reports and nothing else.

### 3.3 The issuance boundary, as it actually is

`frontend/src/pages/lots/hooks/useConformanceReportGeneration.ts:110-116` assembles the report payload from **six independent `apiFetch` calls in one `Promise.all`** — project, ITP instance, test results, NCRs, branding, coverage — combined with React lot state, then dynamically imports the generator and renders at `:156`. **There is no transactionally coherent source snapshot anywhere in this flow**, and Rev 1's `POST /api/lots/:id/folio` would have accepted whatever bytes came back plus a client-computed `compiledFrom`. `[DR-B3]`. §4.3.3 replaces it.

### 3.4 The async artefact machinery — four of five properties

No job-queue library. Four hand-rolled `setInterval` workers start at `backend/src/server.ts:208-211`. The relevant one is `startScheduledReportWorker` (`scheduledReports.ts:1322-1378`).

| Property | Shipped? | Evidence |
| --- | --- | --- |
| Conditional claim/lease | **Yes** | `scheduledReports.ts:176-197` (15-min lock at `:38`) |
| Stale-lock reclaim | **Yes** | `:99-113` |
| Retry / backoff | **Yes** | `recordScheduledReportFailure:661-701`, auto-disable at three failures |
| **Resume incomplete artefact generation** | **NO** | `findRetryableScheduledReportRun:451-484` resumes **recipient deliveries**; missing PDFs are regenerated from scratch at `:750-784` |
| SHA verification | Yes, but | `artifacts.ts:294-335`, `:380-395` — verifies **after loading the entire object into memory** |

Rev 1 claimed all five. `[DR-B5]` is correct: **`processedLots` is not a durable ZIP checkpoint**, and there is no lease renewal or fencing token, so a stale worker and its replacement can both continue past lock expiry.

Storage: `getScheduledReportArtifactStoragePath` with an `assertSafeStorageId` charset guard (`artifacts.ts:122-131`, `:51-55`); `calculateScheduledReportArtifactSha256:177`; `storeScheduledReportArtifact:200-292` — **Supabase when `isSupabaseConfigured()`, else local disk**. `CLAUDE.md:266`: that fallback is **ephemeral — files vanish on the next redeploy**. `[DR-B8]`. Storage accepts and returns a `Buffer`; a streaming ZIP writer does not produce a streaming Supabase upload for free.

### 3.5 The evidence trail, and what has no measurable size

`Lot` relations at `schema.prisma:612-631`. Attachment-bearing children: `ITPCompletion:712` (`signatureUrl:720`, `attachments:738`), **`HoldPoint:761`** (`releaseSignatureUrl:777`, `evidencePackageUrl:779`), `TestResult:857` (`certificateDocId`), `NCR:933` via `NCREvidence:1030`, `ClaimedLot:1524`, `Variation:1543`.

**Re-verified for `[DR-B6]`: `HoldPoint.releaseSignatureUrl` and `evidencePackageUrl` are bare `String?` columns with no companion size or checksum.** A counts-and-sums preflight physically cannot measure them (§4.5.4).

`Document` (`:1592-1638`): one model for photos and documents, discriminated by `documentType`, with `lotId`, `fileUrl`, `mimeType`, `gpsLatitude`/`gpsLongitude`/`captureTimestamp` (`:1604-1606`), and version tracking (`version:1613`, `parentDocumentId:1614`, `isLatestVersion:1615`). **No checksum column. No chainage column** (§2.2 item 5 does not need one).

`NCR.rectificationNotes` / `rectificationSubmittedAt` at `:955-956` (§2.2 item 3).

`Lot.status` is `String @default("not_started")` (`:585`) — **there are no Prisma enums in this schema at all.**

### 3.6 What is still not there

- **Asset model — NOT FOUND, entirely.** No `Asset`, `AssetClass`, `Pit`, `Pipe`, `Manhole`, `Node`, `Conduit`. No topology.
- **ADAC / A-SPEC — NOT FOUND.** The single grep hit is `A-spec` inside `"QA-specific"` (`copilot/chat/tools.ts:112`). **This is now permanent** (§5).
- **RPEQ — NOT FOUND.** Zero hits.
- **CCTV — NOT FOUND in source.** Two string literals in one test file.
- **XML generation — NOT FOUND.** `fast-xml-parser ^5.10.1` is installed at three **read** sites; `XMLBuilder` is never imported. **XSD validation — NOT FOUND.** Both are now permanently moot (§5).
- **ZIP writer — NOT FOUND.** No `archiver`, `jszip`, `adm-zip`, `yazl`, `fflate`. `backend/src/lib/zipSafety.ts` is inbound zip-bomb defence, not a writer.
- **Manifest — NOT FOUND.** Nearest analogue is `accountPrivacyRoutes.ts:591-603`.
- **`handover` / `asConstructed` / `practicalCompletion` — NOT FOUND** as any field, route, status or component.
- **Resumable / multipart upload — NOT FOUND.** No TUS client, no S3 multipart path. Supabase `createSignedUrl` is not used anywhere.

---

## 4. D1 — the design, re-sliced

### 4.0 The phase map

The review's slicing verdict was **NO-GO on D1a, D1b and D1c as written, HOLD on D1d**. Rev 2 adopts the corrected sequence in full, with D.0 struck out because it has merged:

```
D1a-respec → D1a → D1b.0 → D1b → D1c.0 → D1c.1 → D1c.2 → D1d (Scope A rider)
```

| Phase | Size | Migration | Depends on | Why it exists |
| --- | --- | --- | --- | --- |
| **D1a-respec** | S | none | nothing | `[DR-B2]`. Repairs the reason-code contract and defines the batched snapshot **before** anything reads it. Docs + types + tests only. |
| **D1a** — quality closeout readiness | S | none | D1a-respec | The view. Renamed per `[DR-A1]`. |
| **D1b.0** | M | none (spike + contract) | nothing | `[DR-B1]`, `[DR-B3]`, `[DR-B4]`. Content contract, threat model, server-controlled issuance architecture, recorder Blob support. |
| **D1b** — issued folio | M | 2 (`FolioSnapshot`, `FolioIssue` + trigger) | D1b.0 | Persistence with identity. |
| **D1c.0** | M | none (spike) | nothing | `[DR-B6]`, `[DR-A3]`, `[DR-A4]`. Streaming/storage benchmark; the cap formula; the writer decision. |
| **D1c.1** | M | 1 (`HandoverExport` + `HandoverExportMember`) | D1b, D1c.0 | `[DR-B5]`, `[DR-B7]`. Frozen-member ledger + job schema with lease/fencing. |
| **D1c.2** | L | none | D1c.1 | The worker, the manifest, the streamed download, the UI. |
| **D1d** — CCTV, **Scope A** | XS | none | D1c.2 | A `documentType`, a lot association, a manifest category. |
| **D1e** — configurable requirements | ? | ? | a later revision | Blocker removed (§2.3), still not built. |

**The old parallelism is gone.** Rev 1 said D1a and D1b were independent and could ship in either order. They are not: both now depend on a contract phase, and D1b depends on an architecture decision that does not exist yet. `D1a-respec`, `D1b.0` and `D1c.0` **can** run in parallel with each other — they touch disjoint files — and that is the only parallelism this wave has.

### 4.1 Phase `D1a-respec` — repair the contract before anything reads it

No runtime code. Output: an amended `futureConsumers.ts` contract, a defined input snapshot, and the parity tests that will govern D1a.

**4.1.1 Widen the union to every currently-blocking code.** Rev 1's "no widening" rule (`:263-266`) is inverted. `HandoverReasonCode` becomes **every code that currently blocks a lot**, which at this SHA means the eight already present **plus `insufficient_test_count`** (`conformanceItems.ts:182-192`). The rule that replaces it, and which is the honest form of `[DH-B5]`:

> The handover union is **derived from**, and asserted equal to, the set of `ReadinessReasonCode` values that any shipped path emits with `severity: 'blocker'` and `blocksAction: true`. A new blocking code anywhere is a **compile error or a test failure** here, never a silent divergence.

Asserted by **AT-138**, which enumerates blocking codes from the shipped emitters and fails when the union does not match. This is the difference between "we listed eight" and "we cannot drift".

**4.1.2 Define the complete batched handover input snapshot.** D1a is **not** a mapper over `checkConformancePrerequisitesBatch` — that batch does not fetch NCR severity and does not perform the normal hold-point count (§3.1). `D1a-respec` specifies one batched query set producing, per lot, in one pass: conformance prerequisites; **NCR severity** (for `open_major_ncrs`, the `claimReview.ts:230` definition); the **normal unreleased hold-point count** (the `qualityRoutes.ts:301-360` definition, not the N/A-bypass subset); and sufficiency (for `insufficient_test_count`). Where two shipped paths disagree on a definition, **the lot page's definition wins and the divergence is recorded**, because the lot page is what the user is looking at when they disbelieve the panel.

**4.1.3 `areaId` — defined, not dropped.** `ProjectArea` is a chainage interval with `chainageStart`/`chainageEnd` and **no lot relation** (`schema.prisma:447-459`); `Lot` carries its own `chainageStart`/`chainageEnd` (`:551-554`) plus free-text `areaZone`.

> **`areaId` selects lots whose `[chainageStart, chainageEnd]` overlaps the `ProjectArea` window on the same project.** A lot with a null chainage on either end is **never matched** and is reported in a top-level **`unplacedLots`** count on the response.

That count is the whole point: a chainage filter that silently drops every unchainaged lot is a filter that lies, and this is a codebase where lots without chainage are ordinary. **AT-139.**

**4.1.4 Activity filtering uses `activitySlug`, and says so when it cannot.** `Lot.activityType` is free text never constrained to canonical activities; `activitySlug` (`:556-568`) is the folded canonical value and is **nullable** — null means fold confidence `family` or `none`. The filter matches on `activitySlug`; lots with a null slug are reported in an **`unclassifiedLots`** count, same principle. **AT-139.**

**4.1.5 Exhaustive parity, not one example.** Rev 1's AT-119 asserted parity for `open_ncrs` alone. **AT-119 is rewritten**: for **every** code in the union, a fixture lot that triggers exactly that code is asserted to produce the identical code from both the lot-readiness endpoint and the handover endpoint. `[DR-B2]`'s closing sentence, taken literally.

### 4.2 Phase `D1a` — quality closeout readiness (S, no migration)

Renamed from "handover readiness" per `[DR-A1]`, everywhere including the UI. The name is the honesty fix: this is a **quality** verdict — conformance, tests, hold points, NCRs — and calling it "handover readiness" implies it covers the commercial and record dimensions it deliberately does not (§16.1 J1).

`GET /api/projects/:projectId/closeout-readiness` returns `HandoverReadinessVerdict[]` — one row per lot plus one aggregate at `subjectType: 'project'` — with `areaId` and `activitySlug` filters per §4.1.3–4.1.4 and the two escape counts.

**What it must not do:** not store a verdict (`[DH-B4]`); not add a code outside the derived union (§4.1.1); **not gate anything** — D1a is a view, and nothing in the system starts refusing an action because it says so.

**UI.** One project-level section listing blocked lots grouped by reason code, plus a per-lot line on the lot page. Uniform-card rules apply. No new navigation entry until a real user asks.

### 4.3 Phase `D1b.0` — the content contract, the threat model, and server-controlled issuance

The phase Rev 1 did not have, and the reason its D1b was NO-GO. No migration. Outputs: a written content contract, a threat model, a decided issuance architecture, and the test-harness capability the rest depends on.

**4.3.1 The folio is a NEW MODE. The certificate formats stay.**

This is the load-bearing scoping decision and it is easy to get backwards. `[DR-B1]` is not a request to delete "I hereby certify" from the product. Quality managers use the TMR/TfNSW/VicRoads/DIT conformance **certificate** today, for its shipped purpose, with signature blocks a human signs. **That is a real document and it is not Wave D's to remove.**

> `[DH-h]` — **`format: 'folio'` is a sixth value of `ConformanceFormat`, not an edit of the five that exist.** The five existing formats render exactly as they do today. Folio mode is selected only by the folio issuance path.

*ponytail: one added branch in an existing switch beats a second renderer, and beats editing a document people already sign.*

**4.3.2 The content contract.** Folio mode:

1. **Removes certification language.** No `LOT CONFORMANCE CERTIFICATE` title (`:78-102`), no `CONFORMANCE CERTIFICATION` heading (`:838`), no `I hereby certify…` (`:850`), no `Prepared in accordance with…` (`:904-908`), **no signature block** (§2.4). Replaced by the §2.4 wording verbatim.
2. **Carries expected → present → missing**, per §2's pack list. This is the input the shipped renderer does not have: today its payload contains only actual `testResults`. The folio payload gains an **expected-requirements** limb, and every expected item resolves to `present` (with its evidence), `missing` (**named**), or `not_applicable` (**with the reason**). "Three of five present, the other two named" becomes structurally possible for the first time.
3. **Never promotes an unverified result.** Already true as of `#1658` (`:112-135`, `:367-385`) and now **asserted for folio mode specifically** so a future refactor cannot regress it.
4. **States the §2.2 item-3 gap honestly.** A failed test with no linked rectification prints *"failed — rectification not linked"*, never a silent omission and never an implied clean trail.
5. **Is characterized for all six modes**, including DIT, which Rev 1's `FolioIssue.format` vocabulary omitted entirely (`[DR-B4]`).

**4.3.3 Server-controlled issuance — `[DR-B3]` option 1.**

The four properties are **mandated**, not optional:

| Property | Mechanism |
| --- | --- |
| Server-created immutable source snapshot | `POST /api/lots/:id/folio/sessions` assembles the **entire** report payload server-side in **one transaction** — replacing the browser's six independent reads (§3.3) — and writes it to `FolioSnapshot` (§7.2). |
| Server-bound issue ID | The same transaction preallocates the `FolioIssue` UUID and allocates `version` via a serializable/version-allocating transaction (`[DR-B7]`). The client never chooses either. |
| Server-computed `compiledFrom` | Derived from the snapshot, never from the client. It carries a **schema version** and the **exact source row ids and versions** — not counts and timestamps (`[DR-B7]`). |
| Server-side verification of content derivation | The client renders **only from the returned snapshot**. `PUT /api/folios/:id/bytes` stores the bytes at the preallocated path, computes the SHA server-side, and runs a **derivation check** before the folio becomes visible. |

**The one thing `D1b.0` decides rather than inherits: the derivation-check mechanism.** Two candidates, and the threat model picks:

- **(i) Text-layer assertion.** Extract the returned PDF's text and assert every load-bearing snapshot value appears (lot number, folio id, version, the counts, the named-missing list) **and** that no banned certification string appears. Costs one Node PDF text-extraction dependency. Strongest.
- **(ii) Snapshot-as-authority.** The `FolioSnapshot` is the authoritative record; the PDF is a rendering of it, and any dispute is resolved against the snapshot. Costs nothing. Weaker — a doctored PDF is still what the client received.

**Recommendation: (i), with (ii) as the fallback that ships regardless** — the snapshot is authoritative either way, so (ii) is not an alternative so much as the floor. `D1b.0` names the dependency and benchmarks the extraction cost before committing.

**4.3.4 The threat model.** Program §7 line 134 gated a threat model before **D2**. D2 is deleted, and the review is explicit that the gap is already shaping an unsafe boundary — so **the gate is pulled forward to `D1b.0`** and follows the `wave-e0-threat-model-2026-07-28.md` pattern: a written artefact, merged before D1b code. Minimum coverage: an authorized-but-malicious issuer; a stale-snapshot race (evidence changes between session and upload); replay of a prior folio's bytes against a new session; cross-tenant session and snapshot ids; the storage-path guard; and the **fail-closed production storage** requirement (`[DR-B8]`, §10.3).

**4.3.5 The test harness gap.** `JsPdfRecorder` has `save()` and no `output()` (`pdfTestRecorder.ts:63-66`), and operation equality does not prove byte equality between jsPDF's `save()` and `output('blob')`. `D1b.0` adds Blob/`output()` support to the shared recorder and **one real-jsPDF byte test under fixed metadata and a fixed clock**. `[DR-B4]`.

### 4.4 Phase `D1b` — the issued folio (M, two migrations)

With `D1b.0` merged, D1b is the small phase Rev 1 wanted it to be: wire the session/upload routes, write the two tables, ship the UI.

**4.4.1 Getting the bytes.** `generateConformanceReportPDF` gains one optional option:

```ts
/** When present, the PDF is delivered to this sink instead of being downloaded. */
sink?: (blob: Blob, filename: string) => void | Promise<void>;
```

and the terminal `savePdf` call — now at **`conformanceReportPdf.ts:922`**, not `:888` (§0.5) — becomes a sink-or-save branch. `[DH-a]` stands: **threaded through options, never a module-level capture mode.** Ambient mutable state that changes what a save does is exactly what someone debugs at 3am, and D1 needs precisely one generator to do this. *ponytail: thread one param; promote to a shared sink when a second generator needs it.*

**AT-122 is restated per format:** for each of the five existing formats, the recorded operation sequence is identical with and without a sink, and `savePdf` is called exactly once without and zero times with. Rev 1's "the whole suite passes unmodified" claim is not made (§0.5).

**4.4.2 Versioning and immutability.** `FolioIssue` rows are append-only and **a database trigger rejects `UPDATE`** (§7.1). Storage path `folios/{projectId}/{lotId}/{folioIssueId}.pdf`, written with `upsert: false` / `flag: 'wx'` (the pattern proven at `artifacts.ts:225-292`), through the `assertSafeStorageId` charset guard. **Order is preallocate-UUID → upload → insert row in the version-allocating transaction, with cleanup of the orphaned object on failure** — Rev 1 specified neither order and both failure modes (`[DR-B7]`).

**4.4.3 What D1b does not do.** No attachment embedding, no cover letter, no signature block (§2.4). Folio **content** is `D1b.0`'s contract; D1b is persistence and identity.

### 4.5 Phase `D1c.0` — the streaming and storage spike

The phase that stops D1c from being specified against arithmetic that does not work. No migration, no product surface. Output: a benchmark report and four decisions.

**4.5.1 What it must prove, on production-shaped fixtures.** A `>4 GB` archive; a 50,000-file archive; cancellation mid-write; and memory flat with respect to archive size. Anything that fails a fixture is not selected.

**4.5.2 The writer decision (`[DR-A4]`).** `J4`'s "`fflate`, zero transitive dependencies" is **withdrawn as a recommendation** — zero deps is not the deciding axis. The axes are **ZIP64 support**, Node stream backpressure, large-member support, event-loop behaviour, and whether it composes with a resumable upload. Benchmark `fflate`, `archiver`, `yazl` and a Web Streams/ZIP64 option. Note against `fflate` specifically: it advertises support only up to 4 GB files, so it is **not proven** for the proposed cap. **A hand-rolled ZIP container remains rejected** — CRC-32, local headers, central directory, UTF-8 flags and ZIP64 in a path where a corrupt archive is a corrupt legal record.

**4.5.3 The cap formula (`[DR-A3]`).** "Order 5 GB" is replaced by:

```
effective_cap = min(product_cap,
                    bucket_limit,
                    upload_protocol_limit,
                    zip_writer_member_limit,
                    service_resource_limit)
```

with, decided here rather than left implicit: **binary units** (GiB) throughout; **unknown-size members** (§4.5.4) counted at a declared conservative estimate and the estimate's uncertainty surfaced in the preflight; an explicit **member-count limit**; and the cap applied to **output bytes**, because output is what storage and egress are billed on. Supabase standard upload tops out at 5 GB and recommends TUS above 6 MB; TUS/S3 paths reach 50 GB. **The 50 GB reference exit gate and a 5 GB first-release cap are mutually exclusive** — `D1c.0` decides between raising the cap onto a TUS/S3 path, split archives, or an object-tree package, and **§15's exit gate is amended to whichever it picks.**

**4.5.4 The preflight cannot measure everything, and must say so.** `HoldPoint.releaseSignatureUrl` and `evidencePackageUrl` are bare strings with no stored size (`schema.prisma:777-779`), and `Document` has no checksum. A counts-and-sums preflight is therefore an **estimate with a named unmeasured set**, not a measurement. The UI states the estimate, the count of unmeasured members, and the assumption used. `[DR-B6]`.

**4.5.5 `BigInt`, everywhere.** `fileSize Int` caps at 2,147,483,647 bytes on Postgres. Every byte count in `HandoverExport` and `HandoverExportMember` is `BigInt` (§7).

**4.5.6 The cost gate gets a threshold.** Program §8 line 145 requires the cost measured; Rev 1 gave no pass/fail. `D1c.0` records bytes per leg — original reads, archive upload, storage duration, first download, repeat downloads — plus Railway CPU/RSS and egress, and **states a per-archive cost ceiling above which the feature does not ship at that cap**. Railway bills service egress including uploads to object storage, so backend-mediated delivery is more than one transfer leg.

### 4.6 Phase `D1c.1` — the frozen-member ledger and the job schema

One migration: `HandoverExport` + **`HandoverExportMember`** (§7.3–7.4). No worker yet.

**4.6.1 Frozen members (`[DR-B7]`).** Rev 1's archive was "reproducible from immutable inputs" while selecting mutable, supersedable documents. `HandoverExportMember` rows freeze, at snapshot time: exact `FolioIssue`/`Document` id, **version**, storage locator, byte size (`BigInt`), source checksum, member state, and archive path. **If a folio is reissued mid-archive, the archive continues from its frozen snapshot and records the cutoff.** It never switches versions halfway through.

**4.6.2 Lease, fencing and heartbeat (`[DR-B5]`).** `HandoverExport` carries `leaseOwner`, `leaseToken` (fencing), `leaseExpiresAt` and `heartbeatAt`. A worker renews its lease on a heartbeat interval; **every state write is conditional on the fencing token**, so a stale worker that wakes after expiry cannot finalize, cannot upload, and cannot cancel. Cancellation is fenced the same way.

**4.6.3 Restart semantics, stated exactly.** The honest default: **ZIP assembly restarts from the frozen member ledger**; completed member checksums are reused, no bytes are re-read that already verified, and the ZIP itself is rebuilt. Resumable multipart chunk state is persisted **only if `D1c.0` selects an upload path that supports it**, in which case the exact chunk/multipart state lives on the export row. **What is not permitted is Rev 1's implication that `processedLots` alone constitutes resume.**

### 4.7 Phase `D1c.2` — the worker, the manifest, the download, the UI

**4.7.1 `[DH-B2]` — the archive collects; it never renders.** A lot with no issued folio is written into the manifest as `folio: none` — a fact — and contributes its originals only. The UI shows "12 of 40 lots have no issued folio" before the job starts and offers to take the user to issue them, which is a human act on a human's screen. `[DH-b]` stands: no jsPDF in Node, because that needs the generator in a shared package, which is the refactor the standing rule forbids, and because it would let a background job emit a document nobody reviewed. *ponytail: collect-only; if pilots show progressive issuance is not happening, the fix is a nag, not a renderer.*

**4.7.2 The manifest.** `manifest.csv` (opens in Excel — that is what "searchable" means to the person who receives it) and `manifest.json`, same content, at archive root. One row per member: archive path, SHA-256, byte size, source record type and **id and version**, lot number, document type, original filename, uploaded-at, uploaded-by. Plus `manifest-summary.json` carrying scope, generated-at, generated-by, CIVOS version, per-lot folio status, the frozen-snapshot cutoff, and `omissions[]`. **`manifest-summary.json` is excluded from the determinism assertion** because it carries generated-at (`[DR-A9]`).

**4.7.3 Determinism, and the chainage filename rule.** Archive paths are `{lotNumber}/{category}/{sanitized-filename}`, lots ordered by `lotNumber` ascending with the comparator the reports already use (`scheduledReports/reportDocument.ts:107`), categories in a fixed declared order, files within a category by `uploadedAt` then id, collisions suffixed ` (2)` by that same order.

**New in Rev 2, from §2.2 item 5:** for photo-category members on a lot with a chainage, the sanitized filename is prefixed with the lot's chainage reference. Logan requires *"a chainage or exact location reference in the filename"*, and this is where that requirement is satisfied — a naming rule over `Lot.chainageStart`/`chainageEnd`, **not** a column on `Document`. Where the lot has no chainage the rule falls back to the lot number and the manifest records which rule applied. **AT-140.**

**4.7.4 Delivery, streamed.** `sendScheduledReportArtifactFile:380-395` buffers whole files into memory — defensible at 200 KB, an outage at 2 GB. D1c.2 writes its own **streamed**, ownership-checked, SHA-verified download path. `[DH-g]`: the scheduled-report path is left alone, not refactored.

**4.7.5 Progress.** `processedMembers / totalMembers` on the export row, polled. **No percent-complete streaming channel** — none exists in the codebase and a ZIP job does not justify inventing one.

### 4.8 Phase `D1d` — CCTV linkage, **Scope A**, unblocked

D.0-Q3 answered it at grade A: Logan specifies CCTV as **video files with named container formats** (§5.7.1(1)(a)) and Unitywater's deliverable is a digital-plus-hardcopy file set. WSA 05 Appendix A5 *does* define a per-observation XML, but **no Australian authority was found mandating that file by name**, and producing a conforming coded record is the specialist CCTV subcontractor's job in WinCan or PipeTech. The head contractor's obligation is **custody, completeness and timely submission**.

**Scope A, and nothing more:** a `documentType` value, a lot association, a manifest category. Logan's run-endpoint requirement (*"first drainage maintenance hole upstream and downstream"*) and its accepted container formats are surfaced as **guidance text on the upload surface**, not as a data model. **Scope B is deleted**, not deferred — it was a D2 dependency and D2 is gone.

### 4.9 "Configurable requirements" — blocker removed, still not built

`[DH-d]`'s flip condition was *"D.0 supplies a real receiving-authority requirement list to configure against."* **It did** (§2). The deferral therefore changes character: it is no longer blocked, it is **unprioritised**.

D1e, when someone wants it, is: the Logan-18 test-category crosswalk (§2.2 item 2), a per-authority pack profile, and `ExceptionOrWaiver`. **It is not in D1.** Building a configuration UI before one pilot has issued one folio against the one requirement list we have is scaffolding for later. `f0-execution-spec-2026-07-24.md:23` and `:35` parked "new evidence-link tables" and `ExceptionOrWaiver` on D1; **D1 declines both**, and now declines them with a reason stronger than "no evidence" — we have the evidence and still do not need the machinery.

### 4.10 What does not change, in any phase

- `Lot.status` and its Zod vocabulary. No `handover` status. `[DH-B4]`.
- The conform gate (`qualityRoutes.ts:411`, `:488`) and the claim gate. **D1 blocks nothing new.**
- The five existing conformance formats' output (`[DH-h]`), and the other seven generators entirely.
- The scheduled-report worker and its download path (`[DH-g]`).
- `Document`, `Drawing`, `TestResult`, `HoldPoint`, `NCR` — **no columns added to any of them by D1.**

---

## 5. D2 — deleted, on grade-A evidence

D.0 killed the XML limb **twice over, with either kill sufficient.**

**Kill 1 — the contractor is not on the arrow.** On a QLD developer Operational Works job the duty holder is *"the person who has the benefit of the development approval"* — the developer — and the operational interface with council is the **consulting engineer (RPEQ)**, with a Registered Surveyor certifying position and level. Across **14 councils, no document names the civil head contractor as producer, holder or submitter of the ADAC XML.** In Logan's 6,331-line infrastructure policy "contractor" appears 11 times and **never** within reach of *submit*, *as-constructed*, *certify* or *maintenance*. Moreton Bay and Ipswich both state, in near-identical words, that officers *"will not deal directly with Contractors."* The one apparent counter-example is defused: Rockhampton and Moreton Bay's contractor-addressed sections are the **council capital-works** path, where the council is the client — a parallel, separate pipeline.

**Kill 2 — the file cannot carry our differentiator anyway.** The ADAC v6.00 schema has **1,006 unique element and attribute names and not one carries quality evidence**. Zero occurrences of `certificat`, `conform`, `evidence`, `warrant`, `defect`, `CCTV`, `NCR`, `hold point`, `witness` or `audit` across 951 KB of XSD (downloaded and grepped by the D.0 author). `Lot` is **cadastral**, not a construction lot. `DataQuality` is AS5488 **positional confidence**, not QA. The only file carrier is `SupportingFile` — a bare 254-character filename string with no type, role, hash or URI — and `Notes`, 254 characters of free text.

### 5.1 Clause-by-clause disposition of program lines 83–91

| Clause (line) | Disposition |
| --- | --- |
| 1. Validate with surveyors, contractors, ≥3 councils (84) | **CLOSED as a D2 gate.** Survives as **customer discovery for the folio** — worth having, gating nothing. |
| 2. Define the civil asset / as-constructed data model (85) | **CLOSED PERMANENTLY.** |
| 3. Import from 12d / LandXML / DXF / CSV (86) | **CLOSED PERMANENTLY.** D.0-Q6 additionally retires the §3.6 concern about the LandXML parser's elevation and spiral gaps as **moot**: 12d's own documentation calls LandXML *"some geometric data"*, and DXF/DWG carries geometry, not assets. LandXML was never going to carry an asset record. |
| 4. Link assets to lots, ITP evidence, tests, NCRs, CCTV, approvals (87) | **SURVIVES AS INTERNAL-ONLY VALUE, and the spec says so out loud.** The linkage is real product value. It **does not survive export, because there is nothing to export it into.** Program clause 87 called this "the differentiator"; it is a differentiator **inside CIVOS**, and **`[DH-B8]` forbids implying otherwise in any artefact, UI string or public claim.** |
| 5. Versioned jurisdiction profiles (88) | **CLOSED PERMANENTLY.** Recorded for the file: 6.00 is **formally a break**, not a superset — the version attribute is `fixed="6.0.0"` and the schema explicitly forbids cross-version validation. Had D2 proceeded, versioned profiles would have been the *minimum* architecture. Moot. |
| 6. XSD + council-specific validation (89) | **CLOSED PERMANENTLY.** The schema is freely downloadable (verified by direct curl), so this was *buildable*; it is simply not *needed*. Recorded: **there is no official validator** — the custodian refers you to vendors — and **no published licence text ships with the XSD package** while mirrored copies are marked all-rights-reserved. |
| 7. Preserve the surveyor/RPEQ certification boundary (90) | **SURVIVES as `[DH-B3]`**, now with grade-A backing that the boundary is real and signed by **named parties**: dual sign-off, RPEQ plus Registered Surveyor, with **no contractor signature block**. Rockhampton stamps the principal contractor's **name** on the As Constructed stamp — named on the document, not a signatory. That distinction is exactly §2.4's. |
| 8. Exit gate: accepted by a real receiving authority (91) | **UNREACHABLE BY DESIGN, and that is now a finding rather than a risk.** A head-contractor product cannot meet it because the submitting party is the consulting engineer. §15 replaces it with the reachable equivalent. |

### 5.2 The internal-linkage claim stays internal

Stated once, plainly, because it is the sentence most likely to be softened by someone writing marketing copy later:

> The linkage between assets and ITP evidence, tests, NCRs, CCTV and approvals is real product value and it is **CIVOS-internal**. It does not survive export. There is nothing to export it into. No CIVOS surface, document, manifest or public claim may imply an exported linkage, a council submission, or an acceptance. `[DH-B8]`, AT-136.

### 5.3 What is retained from the dead limb

Two things, both free:

1. **`WorksApprovalID` is the stable external key, not surveyor asset ids.** Rev 1 §3.3(c) proposed keying the folio to *"the surveyor's asset identifiers"*. **Wrong** — `ADACId` is generated by whichever software wrote the file. `WorksApprovalID` is *"The works approval ID for the development that this information represents"* (`ADAC_V600.xsd:141`), i.e. the OPW number, which Logan §5.6.2(2)(f) requires on **every drawing** (e.g. `OW/254/2012`). If a folio ever carries an external key, it is that one. **Not built in D1** — recorded so it is not re-derived.
2. **`SupportingFile` is a bare filename, and §4.7.3 already produces the right shape for it.** Deterministic archive paths are exactly what an engineer's ADAC file can reference. A free consequence of D1c, not new work.

---

## 6. D3 — closed

Not "gated pending a newer edition" — **closed**, on four independent grounds from D.0-Q10:

1. **v4.1 (Dec 2022) is current**, with its review date lapsed 19 months ago and no successor.
2. **It applies only where the contract specifies DE** — opt-in, per project.
3. **It was built for IP Major Works and Professional Services Contracts**, a tier above CIVOS's customer. Subcontractor exposure arrives through the head contractor's DEXP and the subcontract, not through the Standard.
4. **Decisively: Part 2 — the document that actually imposes obligations — contains zero occurrences of "ITP", "Inspection and Test", "hold point", "witness point", "non-conformance" or "NCR" across 143 pages.** TfNSW DE is a design-model-and-asset-data regime with nothing to say about conformance records. The only structured test data it names is geotechnical (`*.ags`).

Two corrections to the working assumptions, recorded so nobody re-derives them: **there is no Part 3**, and the numbering is `DMS-ST-202` / `DMS-ST-207`, not `T MU DE 00009 ST`.

**There is no version of D3 that serves CIVOS's customer.** It has no scope, no phases, no acceptance tests, and Rev 2 does not invent them.

---

## 7. Data model and migrations — **four tables and one trigger**

All additive. No column is added to, or altered on, any existing table. Reviewed Prisma migrations only. **No `db push`, ever.** Rev 1's headline said "one new table and one new column on an existing table"; that was wrong in its own document (`[DR-A9]`).

**No Prisma enums** — the schema has none anywhere; status vocabularies stay Zod-validated at the route.

### 7.1 Migration 1 (D1b) — `FolioIssue`, with an UPDATE trigger

Fields: `id`, `projectId`, `lotId`, `snapshotId`, `version Int`, `format String` (**`standard|tmr|tfnsw|vicroads|dit|folio`** — the full shipped vocabulary plus folio mode; Rev 1 omitted `dit`), `fileUrl`, `fileSize BigInt`, `sha256 String`, `issuedById`, `issuedAt`, `compiledFrom Json` (**schema-versioned, carrying exact source row ids and versions**), `lotStatusAtIssue String`, `conformedAtIssue DateTime?`, `derivationCheck Json?` (§4.3.3). Unique `[lotId, version]`. Index `[projectId, issuedAt]`. **The Rev 1 `[lotId, version]` index is dropped as redundant** — the unique constraint already indexes it (`[DR-B7]`).

**The trigger is the invariant.** Absence of `updatedAt` prevents nothing — not Prisma `update`, not raw `UPDATE`. The migration ships a **database trigger that rejects `UPDATE` on `folio_issues`**. `[DH-B1]` becomes a database property. **AT-141.**

`DELETE` is permitted **only** through the one authorized procedure (§10.4).

### 7.2 Migration 1 (D1b) — `FolioSnapshot`

The immutable source snapshot (`[DR-B3]`). Fields: `id`, `projectId`, `lotId`, `createdById`, `createdAt`, `payload Json` (the full server-assembled report payload including the frozen branding, §2.4), `payloadSchemaVersion Int`, `sourceRowRefs Json` (exact ids + versions), `expiresAt DateTime?`. Index `[lotId, createdAt]`. Same UPDATE trigger. A snapshot with no folio issued against it before `expiresAt` is swept (§10.5).

### 7.3 Migration 2 (D1c.1) — `HandoverExport`

Fields: `id`, `projectId`, `scope Json` (`{kind:'project'|'area'|'lots', areaId?, lotIds?}`), `status String` (`queued|snapshotting|processing|complete|failed|cancelled`), `requestedById`, `requestedAt`, **`leaseOwner String?`, `leaseToken String?`, `leaseExpiresAt DateTime?`, `heartbeatAt DateTime?`** (`[DR-B5]`), `nextAttemptAt DateTime?`, `failureCount Int @default(0)`, `lastFailureReason String?`, `snapshotCutoffAt DateTime?`, `totalMembers Int?`, `processedMembers Int @default(0)`, **`totalBytes BigInt?`, `fileSize BigInt?`** (`[DR-B6]`), `fileUrl String?`, `sha256 String?`, `uploadState Json?` (multipart/TUS state, only if `D1c.0` selects a resumable path), `manifestSummary Json?`, `completedAt DateTime?`. Indexes `[projectId, requestedAt]`, `[status, leaseExpiresAt]`.

### 7.4 Migration 2 (D1c.1) — `HandoverExportMember`

The frozen ledger (`[DR-B7]`). Fields: `id`, `exportId`, `sourceType String` (`folio|document|holdpoint_signature|holdpoint_evidence|itp_attachment|ncr_evidence`), `sourceId`, `sourceVersion Int?`, `storageLocator String`, `archivePath String`, `byteSize BigInt?` (**nullable — §4.5.4's unmeasured set**), `sourceChecksum String?`, `state String` (`pending|verified|written|omitted`), `omissionReason String?`, `orderKey String`. Unique `[exportId, archivePath]`. Index `[exportId, state]`.

### 7.5 Explicitly not created

`Asset` or anything asset-shaped (§5, permanent); `ExceptionOrWaiver` (§4.9); any evidence-link table (`f0-execution-spec-2026-07-24.md:23` parked it here and D1 declines it); **a checksum or chainage column on `Document`** (`[DH-e]`; §4.7.3 derives chainage from the lot).

### 7.6 Rollback

All four tables are additive and unreferenced by existing code paths. Rollback = drop the trigger, drop the tables, revert the flag. No data migration, no backfill, nothing to un-write.

---

## 8. Invariants

| Tag | Invariant | Asserted by |
| --- | --- | --- |
| `[DH-B1]` | A folio is a compilation, never an assertion; an issued folio is never altered; an omission is never silent. | AT-121, AT-127, AT-129, **AT-141** (the trigger) |
| `[DH-B2]` | The bulk archive collects issued folios; it never renders one. | AT-126 |
| `[DH-B3]` | **Wave D outputs never present CIVOS-derived map geometry as surveyed or as-constructed geometry. Any re-emitted coordinate carries its provenance.** *(Reworded per `[DR-A8]`; the absolute Rev 1 form was already false for the shipped map.)* | AT-131 |
| `[DH-B4]` | Closeout readiness is computed, never stored; no `handover` lot status exists. | AT-120 |
| `[DH-B5]` | One verdict everywhere — the handover union is **derived from** the shipped blocking codes and asserted equal to them, never hand-listed. | **AT-119 (rewritten, exhaustive)**, **AT-138** |
| `[DH-B6]` | No archive, folio or manifest ever contains — **or names, ids, or otherwise discloses** — a record the requesting user could not read. Unauthorized exclusions appear as an **aggregate count only**. *(Rev 1's version contradicted itself; `[DR-B8]`.)* | AT-132, **AT-133 (rewritten)** |
| `[DH-B7]` | Commercial values are redacted for non-commercial roles, exactly as `filterCommercialReadiness` (`evidenceReadiness.ts:458`) already does. | AT-134 |
| **`[DH-B8]`** | **CIVOS never claims to submit to, be accepted by, or certify for a receiving authority, and never presents itself or the contractor as the certifying party. The asset-evidence linkage is never implied to be exported.** | **AT-136**, **AT-137** |

---

## 9. API and UI surface

**Backend**
- `GET /api/projects/:projectId/closeout-readiness` — D1a. Optional `areaId`, `activitySlug`. Returns lot verdicts, the project aggregate, `unplacedLots` and `unclassifiedLots`.
- `POST /api/lots/:id/folio/sessions` — D1b. **Server** assembles + stores the `FolioSnapshot`, preallocates the `FolioIssue` id and version, returns the snapshot. Rate-limited.
- `PUT /api/folios/:folioIssueId/bytes` — D1b. Uploads the rendered PDF against a preallocated id. PDF magic-byte validation, size cap, filename sanitisation, **server-computed SHA**, derivation check (§4.3.3). Never accepts a client-supplied `compiledFrom` or checksum.
- `GET /api/lots/:id/folios` — D1b. Version list.
- `GET /api/folios/:folioIssueId/download` — D1b. Ownership-checked, SHA-verified before send.
- `POST /api/projects/:projectId/handover-exports` — D1c.2. Returns the preflight estimate **with its unmeasured-member count** (§4.5.4).
- `GET /api/projects/:projectId/handover-exports` / `GET /api/handover-exports/:id` — status + progress.
- `GET /api/handover-exports/:id/download` — **streamed**, ownership-checked.

**Frontend**
- Project **closeout readiness** panel (D1a): blocked lots grouped by reason code, project rollup, filters, the two escape counts shown rather than hidden.
- Lot page: readiness line + "Issue folio" + version list.
- Handover export screen (D1c.2): scope picker, preflight estimate with folio-coverage warning, progress, download.

**Permission matrix**

| Action | Roles |
| --- | --- |
| View closeout readiness | Any role with project read access; commercial items redacted per `[DH-B7]` |
| Issue a folio | `owner`, `admin`, `project_manager`, `quality_manager` |
| Download a folio | Any role with read access to that lot |
| Request a handover export | `owner`, `admin`, `project_manager`, `quality_manager` |
| Download a handover export | The requester, plus `owner`/`admin`/`project_manager` on that project |
| **Delete a folio or export** (§10.4) | `owner` only, audited, one procedure |
| Subcontractor roles | **No handover surface at all.** Not a scoping question — handover is not their workflow. |

---

## 10. Security, retention and privacy

### 10.1 Tenancy

Every new route resolves `projectId` through a project-read guard of the shape the destination route folder already defines — there is **no single shared `requireProjectReadAccess`**; four per-domain copies exist (`testResults/accessControl.ts:92`, `dockets/access.ts:112`, `holdpoints/access.ts:41`, `notifications/access.ts:50`). Wave D follows the local convention and does **not** unify them. No route trusts a client-supplied `projectId`. All four new tables carry `projectId` and are read only through project-scoped queries. AT-132.

### 10.2 The archive is the highest-value object CIVOS will ever emit

Downloads are authenticated app requests, ownership-checked at the storage-path level, `no-store`. **No public link, no Supabase signed URL, no email attachment.** Wave E's capability-token machinery is not extended here.

### 10.3 Fail closed in production (`[DR-B8]`)

`storeScheduledReportArtifact` falls back to local Railway disk when `isSupabaseConfigured()` is false, and `CLAUDE.md:266` states those files **vanish on the next redeploy**. Railway additionally treats deployment storage as ephemeral and may force-stop a service that exceeds it.

> **Wave D artefacts do not use that fallback in production.** If durable storage is unavailable, folio issuance and archive generation **refuse with a stated reason**. A folio silently written to ephemeral disk is worse than no folio: it is a legal record that reports success and then disappears. **AT-142.**

### 10.4 The one authorized deletion procedure (`[DR-B7]`)

Rev 1 claimed "no update path" and simultaneously required delete paths. Rev 2 resolves it: **`UPDATE` is impossible** (§7.1 trigger); **`DELETE` happens through exactly one procedure**, which is `owner`-only, requires a stated reason, **writes an audit event before the delete**, and explicitly removes the storage object rather than relying on cascade (the `deleteScheduledReportArtifactFile` precedent, `artifacts.ts:337`). Normal project deletion routes through the same procedure. **Unrestricted hard deletion is not called immutability anywhere in this spec.**

### 10.5 Retention, PII and legal hold — new in Rev 2

Rev 1 had none of this, and the review is right that an archive containing names, emails, signatures, GPS/EXIF and potentially CCTV cannot ship without it.

| Concern | Policy |
| --- | --- |
| **Classification** | A handover archive is classified as containing personal data: names, emails, **signature images**, GPS coordinates with capture timestamps, and photographs of workplaces. It is treated as the highest-sensitivity artefact the product produces. |
| **Retention** | Export artefacts carry a **TTL**, default conservative, configurable per project; expired artefacts are deleted by a sweeper and the `HandoverExport` row retains the metadata record. **`FolioIssue` rows and bytes are NOT swept** — a folio is the record. `FolioSnapshot` rows with no issued folio expire (§7.2). |
| **The sweeper does not exist yet** | `dataRetentionWorker.ts` handles **no artefacts at all** at this SHA (grep for `artifact` returns nothing). D1c.2 either extends it or ships its own; **it may not assume one exists.** |
| **Legal hold** | An export or folio under hold is exempt from the sweeper and from §10.4's procedure until released. Hold state is an explicit flag, not a convention. |
| **Unauthorized exclusions** | **Aggregate count only** — no ids, no filenames, no lot associations, no document types. Rev 1's `omissions[] { reason: 'not_permitted' }` with per-file detail **was itself the disclosure** `[DH-B6]` forbids. Non-permission omissions (missing object, over cap) keep their per-file detail; those are not disclosures. `[DR-B8]`. **AT-133 (rewritten).** |
| **Audit** | Export request, export download, folio issue, folio download and every §10.4 deletion emit audit events. |
| **PII redaction** | Out of scope for D1 as a **feature**, in scope as a **decision**: the archive is delivered whole to a user who already has read access to every member. It is not redacted, and it is not shared externally (§1.3, no client portal). If external delivery is ever added, **that is a new threat model, not a rider.** |

### 10.6 Threat model

Program §7 line 134 gated a threat model before D2. **D2 is deleted; the gate moves to `D1b.0`** (§4.3.4) and covers D1b and D1c.

---

## 11. Non-goals — the over-build this wave forbids

1. **No asset-management product.** No asset register, no maintenance schedule, no condition rating, no defects-liability tracker, no O&M manual builder, no warranty register. §2.2 item 6 is a **gap we are choosing**, not a backlog item.
2. **No survey engine.** `[DH-B3]`.
3. **No ADAC anything.** §5. Permanent.
4. **No new `handover` lot status.** `[DH-B4]`.
5. **No server-side re-render of any of the eight jsPDF documents.** `[DH-B2]`.
6. **No BIM, IFC, COBie or CDE integration.** §6.
7. **No email delivery of archives.**
8. **No client portal, no external handover recipient login.**
9. **No AI in this wave.** Named because every other wave has an AI limb and this one deliberately has none.
10. **No authority-branded folio variants, no second manifest format, no large export UI before issuance semantics work.** The review's named over-build bait, recorded so it is recognised on sight.

---

## 12. Scale and performance

Measured against the program's reference dataset (§8 lines 138–139: 5,000 lots, 10,000 map features, 50 GB evidence, 10k-row registers).

| Target | Rationale |
| --- | --- |
| Closeout readiness, 5,000 lots: **p95 < 2 s** server-side | One batched pass (§4.1.2) plus a fold. If it misses, the fix is the query, not a cache — `[DH-B4]` forbids storing the verdict. |
| Folio session creation: **p95 < 2 s** | Now a **server-side** assembly (§4.3.3) that replaces six browser round-trips; it should be faster than today, and if it is not that is a finding. |
| Folio issue end-to-end: **p95 < 8 s** on a mid-tier device over 4G | Raised from Rev 1's 5 s: the flow gained a session round-trip and a server-side derivation check. An honest number beats a flattering one. |
| Archive preflight: **p95 < 3 s** | Counts and sums, **plus a named unmeasured set** (§4.5.4). |
| Archive job | No wall-clock target. **Must not block the event loop; memory must be flat with respect to archive size.** Proven in `D1c.0`, not asserted here. |
| Archive download | Streamed, constant memory. The shipped buffer-and-send is explicitly not reused. |
| **Cost per archive on the reference dataset** | Measured **with a pass/fail ceiling** in `D1c.0` (§4.5.6), per program §8 line 145. Rev 1 required the measurement and set no threshold, which is a measurement nobody can fail. |

---

## 13. Rollback

- **D1a-respec:** types and tests only. Revert.
- **D1a:** flag off. Nothing persisted.
- **D1b.0:** a docs artefact plus recorder capability. Revert; the recorder addition is additive and harmless.
- **D1b:** flag off hides issue + download. Rows and objects remain, removed only by §10.4. Full rollback = revert, drop trigger, drop tables.
- **D1c.0:** a benchmark report. Nothing to roll back.
- **D1c.1:** additive tables, drop to revert.
- **D1c.2:** flag off hides the screen; the worker is separately env-gated (the `SCHEDULED_REPORT_WORKER_ENABLED` pattern) so it can be stopped without a deploy. In-flight jobs are reclaimed on lease expiry; if the worker stays off they sit `queued`, which is visible rather than lost. **Partial archives are never stored** — written once, complete, `flag: 'wx'`.
- **D1d:** a `documentType` value. Revert.

---

## 14. Acceptance tests

AT-119…AT-135 carried from Rev 1 where the assertion survives; **rewritten entries are marked**; AT-136 onward is new.

| # | Phase | Assertion | Kind |
| --- | --- | --- | --- |
| **AT-119** *(rewritten)* | D1a | **Exhaustive parity `[DH-B5]`.** For **every** code in the handover union, a fixture lot triggering exactly that code produces the identical code from both the lot-readiness endpoint and the closeout endpoint. Not one example. | DB-backed |
| **AT-120** | D1a | **Nothing is stored `[DH-B4]`.** No row records a verdict; a second read after the blocker clears returns `ready: true` with no invalidation step. | DB-backed |
| **AT-121** | D1a | **Absence is named `[DH-B1]`.** A lot with no ITP returns `no_itp_assigned`, not an empty array and not a generic "incomplete". | unit |
| **AT-122** *(rewritten)* | D1b | **The sink changes nothing, per format.** For each of the five existing formats, the recorded operation sequence is identical with and without a `sink`; `savePdf` is called once without and zero times with. | unit (recorder) |
| **AT-123** | D1b | **Versioning appends.** Two issues yield versions 1 and 2 with different ids, paths and timestamps; version 1's row and bytes are unchanged. | DB-backed |
| **AT-124** *(rewritten)* | D1b | **The server owns the fingerprint.** A client-supplied `sha256` **or** `compiledFrom` is rejected outright, not merely ignored; the stored values derive from the server's snapshot and the uploaded bytes. | DB-backed |
| **AT-125** | D1b | **Download verifies.** A stored object mutated out-of-band fails the SHA check and errors rather than serving. | DB-backed |
| **AT-126** | D1c.2 | **The archive renders nothing `[DH-B2]`.** A project with zero issued folios completes with zero folio PDFs and every lot marked `folio: none`. No PDF generator is reachable from the worker's import graph. | DB-backed + import assertion |
| **AT-127** | D1c.2 | **Historical content is intact `[DH-B1]`.** Folio issued → evidence changed → archive generated: archive folio bytes hash-match the original `FolioIssue.sha256`. | DB-backed |
| **AT-128** *(rewritten)* | D1c.2 | **Deterministic.** Two runs over unchanged data produce byte-identical `manifest.csv` and `manifest.json` and identical member ordering. `manifest-summary.json` is excluded (it carries generated-at). | DB-backed |
| **AT-129** | D1c.2 | **No silent omission `[DH-B1]`.** A member whose storage object is missing appears in `omissions[]` with a reason; the job completes and the summary states the count. | DB-backed |
| **AT-130** | D1c.2 | **The cap refuses, it does not truncate.** A scope over the effective cap (§4.5.3) is refused at preflight with the measured size **and the unmeasured-member count**; no partial archive is produced or stored. | DB-backed |
| **AT-131** | D1 (all) | **`[DH-B3]` holds, as reworded.** No Wave D output presents CIVOS-derived geometry as surveyed geometry; any re-emitted coordinate carries provenance. | static + unit |
| **AT-132** | D1 (all) | **Tenancy.** Every new route refuses a cross-tenant `:id`, for all four tables and the readiness endpoint. | DB-backed |
| **AT-133** *(rewritten)* | D1c.2 | **Aggregate-only unauthorized exclusion `[DH-B6]`.** An export requested by a user who cannot read some lots contains none of their files **and the manifest discloses no id, filename, lot number or document type for them** — only a count. | DB-backed |
| **AT-134** | D1a | **Commercial redaction `[DH-B7]`.** A non-commercial role's response carries no `area: 'budget'` items. | DB-backed |
| **AT-135** *(rewritten)* | D1c.2 | **Fencing, not just reclaim.** Two competing workers, an expired lease, and process death during upload: the stale worker cannot finalize, cannot upload and cannot cancel after its fencing token is superseded; the completed artefact is written exactly once. | DB-backed |
| **AT-136** | D1b, D1c.2 | **`[DH-B8]` — no submission claim.** A string guard over every folio and manifest artefact: no "submit", "lodge", "accepted by", "certified by CIVOS" or council-acceptance phrasing appears. | static + unit |
| **AT-137** | D1b | **The §2.4 wording, verbatim.** Folio mode renders the compilation disclaimer exactly as specified, renders **no signature block**, and renders none of `:78-102`, `:838`, `:850`, `:904-908`'s certification strings. | unit (recorder) |
| **AT-138** | D1a-respec | **The union cannot drift `[DH-B5]`.** The handover union is asserted equal to the set of codes emitted anywhere with `severity: 'blocker'` ∧ `blocksAction: true`. Adding a blocking code without adding it here fails. | unit |
| **AT-139** | D1a | **Filters do not silently hide.** `areaId` returns only chainage-overlapping lots and reports `unplacedLots`; `activitySlug` reports `unclassifiedLots`. Both counts are non-zero in the fixture. | DB-backed |
| **AT-140** | D1c.2 | **Chainage reaches the filename.** A photo member on a chainaged lot carries the chainage reference in its archive filename; on an unchainaged lot it falls back to the lot number and the manifest records which rule applied. | DB-backed |
| **AT-141** | D1b | **Immutability is a database property.** A direct `UPDATE` on `folio_issues` — Prisma **and** raw SQL — is rejected by the trigger. | DB-backed |
| **AT-142** | D1b, D1c.2 | **Fail closed.** With durable storage unavailable, folio issuance and archive generation refuse with a stated reason and write nothing to local disk. | DB-backed |
| **AT-143** | D1b.0 | **Derivation check rejects.** A PDF that does not derive from its session's snapshot — wrong lot, altered counts, a banned certification string — is rejected and no `FolioIssue` becomes visible. | DB-backed |

---

## 15. Exit gate

**D1 is done when all of the following are true and evidenced:**

1. AT-119 … AT-143 pass in CI, DB-backed tests against the local disposable Postgres.
2. Closeout readiness measured on the reference dataset at 5,000 lots, p95 under budget (§12), number recorded.
3. A folio issued, evidence changed, a second folio issued, both downloaded — version-1 bytes hash-identical to issue time. On a real project, not a fixture.
4. A full-project archive generated **at whatever cap `D1c.0` selected** (§4.5.3), opened, manifest reconciled against the project's actual document count with omissions accounted for. **Rev 1's "50 GB reference dataset" gate is amended to `D1c.0`'s decided cap** — the two were mutually exclusive and Rev 1 asserted both.
5. Archive storage + egress cost measured **against `D1c.0`'s stated ceiling** (§4.5.6), pass or fail recorded.
6. Peak memory during archive generation recorded and flat with respect to archive size.
7. The pdfGenerator characterization suite passes with **only** the folio-mode additions — every pre-existing format's recorded operations unchanged (AT-122). *(Rev 1's "unmodified" promise is withdrawn, §0.5.)*
8. `D1b.0`'s threat model merged before D1b code (§4.3.4).
9. Docs + the Clancy knowledge mirror updated in the same PRs.
10. **Pilot acceptance, restated at the reachable party (§5.1 clause 8).** Rev 1 required *"one named authority has accepted one real submission"* — **unreachable by design**, because the submitter is the consulting engineer. Replaced with: **one RPEQ consultant lodges an on-maintenance submission whose evidence pack was compiled in CIVOS**, and confirms the pack needed no reformatting. Same value, measured at the party who actually exists in the pipeline.

**D2 and D3 have no exit gate because they have no scope.** Both are closed on evidence, not deferred.

---

## 16. Decisions

### 16.1 Jay's decisions — re-put against D.0 and the review

| # | Decision | Blocks | Recommendation |
| --- | --- | --- | --- |
| **J1** | **Docket/diary inputs to closeout readiness: wire or drop?** Parked on D1 at `futureConsumers.ts:117-119` and `f0-execution-spec-2026-07-24.md:167`. | D1a | **DROP — and now on evidence, not assertion.** `[DR-A1]` correctly said Rev 1 was deciding this without a receiving checklist. We have one: **Logan PSP5 §5.6.5 contains no docket, diary, labour or plant item** (§2.2). The pack is quality evidence. `[DR-A1]`'s other half is also taken — the phase is **renamed "quality closeout readiness"** so nothing implies it covers dimensions it does not. Flip if a pilot client's own handover checklist asks for docket completeness. |
| **J2** | **Issuer, signatory and legal wording** — `[DR-A2]` requires these decided together, not branding alone. | D1b (content, not polish) | **Contractor branding; NO signature block; the §2.4 wording verbatim.** D.0 resolves the underlying question: *"an inspection and testing certificate signed by the consultant"*. An empty signature line under CIVOS-compiled text is the failure mode `[DR-A2]` named, and Rev 1's J2 missed it by treating branding as the whole question. |
| **J3** | **Archive size cap.** | D1c.0 output, D1c.2 config | **WITHDRAWN as a number.** "Order 5 GB" fails the 50 GB exit gate, exceeds `fileSize Int`, and is unproven for the recommended writer. Replaced by the §4.5.3 formula, decided by measurement in `D1c.0`. `[DR-A3]`. |
| **J4** | **ZIP dependency.** | D1c.0 output | **WITHDRAWN as a recommendation.** Zero transitive dependencies is the wrong axis; ZIP64, backpressure, large-member support and resumable-upload composition are the right ones — and `fflate` advertises only 4 GB. Decided by benchmark in `D1c.0` (§4.5.2). Hand-rolling stays rejected. `[DR-A4]`. |
| **J5** | **D2 jurisdiction order.** | — | **VOID AS FRAMED, and the question no longer exists.** D.0: **A-SPEC is a Victorian commercial product of GISSA International Pty Ltd**, its licence restricts use *"to A-SPEC Consortium members only"*, and **zero NSW councils mandate it** across twelve tested — while NSW's structured-format councils are on **ADAC**. Both arms of the fork were wrong. The likely source of the confusion is **AUS-SPEC** (NATSPEC), a different product with a near-identical name. With D2 deleted the jurisdiction question evaporates: **Rev 2 is QLD folio-first with no jurisdiction fork.** `[DR-A5]` is satisfied by the evidence rather than by leaving it open. |
| **J6** | **Is D2 worth pursuing?** | — | **ANSWERED: no.** D.0 was one docs PR and it closed a wave — the third time this pattern has paid (§1.3). Rev 1's fallback line was *"D1's folio + archive is a complete, sellable handover story on its own."* That is now the **only** story, and §2 makes it a stronger one than Rev 1 could claim: the folio is compiled against a **mandatory, council-enforced, grade-A requirement list**. |
| **J7** *(new)* | **The derivation-check dependency.** §4.3.3 option (i) needs a Node PDF text extractor; option (ii) is free and weaker. | D1b.0 output | **Take (i) if the benchmark is cheap; ship (ii) regardless** — the snapshot is authoritative either way. Surfaced as a decision because it is the one new runtime dependency Rev 2 might add outside the ZIP writer. |

### 16.2 The spec's own decisions

| Tag | Decision | Flip condition |
| --- | --- | --- |
| `[DH-a]` | The PDF sink is threaded through the existing options object, never a module-level capture mode. | A second generator needs bulk capability — promote to a shared sink, still not a global. |
| `[DH-b]` | The archive collects; it never renders. No jsPDF in Node. | Pilots show progressive issuance is not happening — and even then the first fix is a prompt, not a renderer. |
| `[DH-c]` | One new dependency: a streaming ZIP writer, **selected by benchmark in `D1c.0`**, not by recommendation. | None. Hand-rolling stays rejected. |
| `[DH-d]` | Configurable requirements and `ExceptionOrWaiver` deferred out of D1. **Blocker removed (§2), priority not raised.** | Someone asks for a second authority's pack profile. |
| `[DH-e]` | No checksum or chainage column on `Document`; D1c hashes at archive time and derives chainage from the lot. | Hashing dominates archive job time on the reference dataset — measure first. |
| `[DH-f]` | **Superseded.** Rev 1 said "the folio is the shipped conformance report, unchanged in content". `[DR-B1]` makes that impossible: the shipped report certifies. Replaced by `[DH-h]`. | — |
| `[DH-g]` | D1c's download streams; the scheduled-report buffer-and-send path is left alone. | Someone needs streaming for scheduled reports — then extract, with characterization coverage. |
| **`[DH-h]`** | **`format: 'folio'` is a sixth format value, not an edit of the five that exist.** The shipped certificates keep their certification language and their signature blocks for their shipped purpose. | A QM confirms the certificate formats are unused — then deprecate them deliberately, in their own PR, never as a side effect of Wave D. |

---

## 17. Residual questions — `[DR-A7]` folded, with an outcome each

`[DR-A7]` required that "NOT FOUND with a next action" must not unblock anything, and that every question carries an explicit outcome: **`unblocks` / `rescope` / `closes limb` / `remains blocked`**.

### 17.1 D.0's ten questions

| Q | Outcome | Note |
| --- | --- | --- |
| Q1 — who submits | **closes limb** | Grade A across 14 councils. Kill 1 (§5). |
| Q2 — what is in the file | **closes limb** | 1,006 names, zero evidence fields. Kill 2 (§5). |
| Q3 — CCTV deliverable | **unblocks** | Scope A. §4.8. |
| Q4 — what "accepted" means | **rescope** | "Accepted" = **On Maintenance**, which gates plan sealing and bonds. Rescoped §15's exit gate to the consultant. |
| Q5 — schema/validator obtainable | **closes limb** | Freely downloadable; no official validator; **no published licence text**. Buildable, not needed. |
| Q6 — 12d export reality | **closes limb** | LandXML is *"some geometric data"*; DXF/DWG is geometry, not assets. Also retires §3.6's parser concern as moot. |
| Q7 — A-SPEC | **closes limb** | Both arms of J5 wrong. §16.1 J5. |
| Q8 — 6.00 vs 5.01 | **closes limb** | `fixed="6.0.0"`; formally a break. Moot. |
| Q9 — datum and accuracy | **unblocks** | `[DH-B3]` holds; `crs.ts` stays display-grade. No stop-and-replan. Note for the folio: Logan's 20 mm **survey** tolerance is explicitly not a **construction** tolerance — do not conflate them in any UI. |
| Q10 — TfNSW DE | **closes limb** | D3 closed. §6. |

### 17.2 `[DR-A7]`'s added questions

| Question | Outcome | Disposition |
| --- | --- | --- |
| Rights to store/transform/redistribute surveyor and council source files | **closes limb** | Moot: D2 is deleted, so CIVOS ingests no surveyor or council source files. |
| PII and sensitive-infrastructure handling (signatures, GPS, CCTV, personnel metadata) | **remains blocked → answered in-spec** | The only one of these that survived D2's deletion, and the most important. **§10.5 is the answer.** Not researched — decided. |
| Professional liability, PI insurance, whether re-emission is authorship | **closes limb** | Moot: nothing is re-emitted (§5). §2.4's wording is the residual mitigation. |
| Council fees, portals, credentials, turnaround, resubmission workload, support | **closes limb** | Moot for CIVOS: we never submit. Recorded because it is useful product knowledge — Logan is **email plus an ad-hoc file share**, 15 business days, chargeable after one free resubmission; only Cairns has a real validating portal; Moreton Bay still accepts USB and CD. **Validation is usually a human officer reading a prose checklist.** |
| Asset identifier ownership, correction/withdrawal, superseding a revision | **closes limb** | Moot. §5.3 retains `WorksApprovalID` as the one stable key if a folio ever needs an external one. |
| Legally usable real sample files; file-size/asset-count distributions | **rescope** | Rescoped from ADAC samples to **`D1c.0`'s production-shaped fixtures** (§4.5.1), which is what the size question was actually for. |
| Required evidence of acceptance (receipt ids, validation reports, acceptance records) | **rescope** | Rescoped to §15 item 10: the consultant confirms the pack needed no reformatting. |

### 17.3 Repo-answerable items, recorded as code facts rather than researched

Per `[DR-A7]`'s closing instruction:

- **Five PDF formats**, not four (`pdf/types.ts:2`).
- **The issuance boundary is client-side today** — six independent reads plus React state (`useConformanceReportGeneration.ts:110-116`).
- **The CRS stack is display-grade by deliberate decision**, with the ponytail note in the file (`crs.ts:13-20`).
- **No XSD, no XML writer, no ZIP writer, no asset model** exist (§3.6).
- **The worker resumes deliveries, not artefact generation** (`scheduledReports.ts:451-484` vs `:750-784`).
- **`HoldPoint` file pointers have no stored size** (`schema.prisma:777-779`).
- **`TestCategory` is an open `string` vocabulary**, not a closed list (`testCategories.ts:22`).

### 17.4 Still genuinely open, and named

- **Logan's "ADAC 5.01 since 1 Jul 2024"** (appendix line 52) was **not re-confirmed** — Logan's ADAC page is Akamai-403 to every automated method. Not contradicted; **unverified**, and should be re-graded until someone opens it in a real browser. It is no longer load-bearing for anything (D2 is deleted), which is why this is a note rather than a blocker.
- **VicRoads/DTP** (appendix line 59) moves from `UNVERIFIED` to **answered**: Victoria has NTS 019 (Oct 2025), handover is **IFC 4.3**, and there is **zero ADAC adoption anywhere in Victoria**. Victoria remains out of scope, now on evidence.
- **WSA 05 Appendix A5 body text** — paywalled at AUD $792, front matter and TOC only. Does not block Scope A.

---

## 18. Verification notes — derived at `f2defa17`

### 18.1 What changed this revision's shape

1. **D.0 killed D2 twice**, and returned a mandatory requirement list in exchange. The largest phase in the program is deleted and the smallest one got a specification. §2, §5.
2. **The shipped conformance PDF certifies**, and the wave's central rule forbids certifying. Rev 1 planned to persist that document unchanged. `[DR-B1]` is the finding that produced `D1b.0`.
3. **`#1658` fixed half of `[DR-B1]` between the review and this revision** — and in doing so proved the other half is real and invalidated Rev 1's "the characterization suite passes unmodified" claim and its `:888` citation. §0.5.
4. **The handover reason-code union is incomplete at HEAD** — `insufficient_test_count` blocks lots and is not in it. Rev 1's "no widening" rule guaranteed the divergence `[DH-B5]` exists to prevent. §4.1.1.
5. **Issuance trusted the browser.** Six independent reads, client-rendered bytes, client-supplied fingerprint. §4.3.3.
6. **The worker resumes deliveries, not artefact generation** — four of five properties, and the missing one is the one a ZIP needs. §3.4.
7. **`[DH-B3]` was false as absolutely worded**, and the map code proves it. Reworded. §1.2.

### 18.2 Citation provenance

**Personally opened at `f2defa17`:** `futureConsumers.ts:90-121`; `reasonCodes.ts` diff vs `bd3bf36a`; `conformanceItems.ts:170-195`; `conformancePrerequisites.ts:195-210`, `:515-530`; `claimReview.ts:230`; `conformanceReportPdf.ts` diff vs `bd3bf36a` (whole `#1658` hunk) plus `:78-102`, `:112-135`, `:838`, `:850`, `:904-908`, `:922`, and its line count; `pdf/types.ts:1-8`; `ConformanceReportModal.tsx:8-30`; `pdfSave.ts` (whole file); `pdfTestRecorder.ts:17,63-66`; `useConformanceReportGeneration.ts:110-156`; `schema.prisma:447-459`, `:545-568`, `:761-790`, `:955-956`, `:1592-1638`; `testCategories.ts:1-30`; `controlLineGeometry.ts:44-52`; `lotGeometry.ts:91-110`; `CLAUDE.md:266`; the AT-number ceiling and the `[DR-*]`/`[DH-*]` tag-collision greps; the full text of `docs/research/d0-adac-handover-research-2026-07-28.md`.

**Carried from Rev 1 and NOT individually re-opened at `f2defa17`:** the readiness-engine internals in §3.1 other than those listed above; the scheduled-report worker line numbers in §3.4; the spatial model line numbers in §3.5; the four project-guard copies in §10.1; the NOT-FOUND greps in §3.6 other than the asset/ADAC/ZIP ones.

**Whoever builds a phase re-derives that phase's citations first.** This repository has now produced **three** documented cases of a confidently-cited line number being wrong — and Rev 1's own `:888` became one of them within five commits (§0.5). Treat every carried citation as a hypothesis.

### 18.3 Observations for whoever builds this — none blocking

1. **`sendScheduledReportArtifactFile` buffers whole files into memory.** Fine at 200 KB, not at 2 GB. D1c writes its own path (`[DH-g]`), but the shipped one is a latent problem the day someone schedules a report over a large dataset.
2. **`dataRetentionWorker.ts` handles no artefacts at all.** §10.5 says D1c may not assume a sweeper exists. Whether one should exist for all three artefact kinds is worth its own small PR. Not Wave D's to fix.
3. **`Drawing` tracks revision and supersession but nothing about receipt or acknowledgement**, and no F1 execution spec exists at this SHA. A folio can state *which* drawing revision a lot's evidence references, never *whether the crew had it*. Say that plainly in the folio rather than implying the stronger claim.
4. **There are no Prisma enums anywhere.** Do not introduce the first one here.
5. **`ITPCompletion.gpsLatitude/gpsLongitude` are written and rendered nowhere.** C3 recorded the same. Still true. Not Wave D's.
6. **The archive is the product's largest egress event by an order of magnitude.** §4.5.6's ceiling is not a formality; it is the number that decides whether "50 GB evidence project" is a pricing promise or a pricing mistake.
7. **The §2.2 item-3 gap (no retest→original-test link) is the most product-visible hole in the pack mapping.** It is a C2-family column, it is small, and a pilot will notice it before anything else on this list.

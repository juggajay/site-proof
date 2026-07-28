# Wave D Execution Specification — handover: the folio is the product

**Date:** 28 July 2026 · **Rev 3** · **Status:** D1 is respecced in **eight** phases (§4.0). **D2's XML limb is DELETED** on grade-A evidence (§5). **D3 is CLOSED** (§6). **The folio renders SERVER-SIDE** (§4.3) — Rev 2's client-render-then-upload boundary is deleted, not hardened. Rev 1's slicing is superseded; Rev 2's phase map survives with three phases re-scoped.

**This revision is written at HEAD `75eea0b9910c24c7c55d4c6c49ec6507a1feb888`** (= `origin/master`, `feat(holdpoints): E2 — the consolidated chase digest, canary-bound (#1662)`).

**Two SHA deltas, both recorded rather than absorbed.** The delta review being folded was performed at `84eac1a7`, and Rev 2 cited `f2defa17`.

1. **`f2defa17` → `84eac1a7`: one commit, Rev 2's own docs merge.** `git diff --stat f2defa17..84eac1a7` returns exactly one file — this spec, +553/−382. **No code moved**, so every Rev 2 code citation and every delta-review citation was still live when verified.
2. **`84eac1a7` → `75eea0b9`: `#1662` (Wave E2) landed mid-revision, and it moved `schema.prisma`.** A single `@@index([holdPointId])` plus its comment was inserted into `HoldPointReleaseToken` at `:824-829` — **five lines, above `NCR` and `Document` and below `Lot`, `ProjectArea` and `ITPCompletion`.** Every `NCR` and `Document` citation in this document is therefore **+5 from where the delta review and Rev 2 left it**, and all of them were re-derived at `75eea0b9` rather than shifted arithmetically. §0.10 lists the moved lines. *This is the third time in four revisions that a line number moved under this spec while it was being written; §18.2 is the standing instruction that follows from it.*

The delta review's contested citations were re-opened at `84eac1a7` and again at `75eea0b9` where the schema moved; §0.3 records what that found.

**The input Rev 3 folds:** the standing **delta review of Rev 2, score 4/10, "not build-ready"** — seven blockers `[DR2-B1]`–`[DR2-B7]`, three advisories `[DR2-A1]`–`[DR2-A3]`, and a phase verdict of **NO-BUILD on D1a-respec, D1a and D1b.0**. Every finding was verified at `84eac1a7` before folding.

> **Six of the seven blockers are upheld in full and folded as prescribed. One — `[DR2-B2]` — is upheld in its diagnosis and its prescribed fix is *narrowed*, because the runtime registry it asks us to introduce already ships (§0.6). Nothing is refuted on substance.**

**The one place Rev 3 goes further than the review asked.** `[DR2-B4]` offered a choice: *"server rendering of folio bytes **or** complete canonical verification of all rendered content."* Rev 3 takes the first, absolutely — **there is no upload route, no client-supplied bytes, and no derivation check, because there is nothing to check.** Rev 2's fallback option (ii) is deleted, J7 is deleted, and the doctored-bytes class is closed structurally rather than by test. §4.3 states the cost of that honestly: one new backend PDF dependency, and a folio renderer that shares no code with the shipped conformance generator.

**Program contract:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` §3 Wave D, **lines 81–92**. Rev 2 closes clauses at lines 83–91 (D2) and line 92 (D3) on evidence, and re-slices line 82 (D1). Also §5 line 117 (Jay decision 3 — **void as framed**, §16.1 J5), §5 line 119, §7 line 134 (threat model — **pulled forward from D2 to D1b.0**, §4.3), §8 lines 138–146, §10 line 152.

**Research contract:** `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md` §C lines 51–59. D.0 **re-graded three of those rows** and answered the one marked `UNVERIFIED` (§17.2).

**Parent specs, read not remembered:** `docs/plans/f0-execution-spec-2026-07-24.md` (lines 23, 35, 167 — all three discharged, §4.9, §7, §16.1); `docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md` and `docs/plans/wave-c2-test-lifecycle-spec-2026-07-28.md` (the evidence a folio compiles); `docs/plans/wave-c3-spatial-tests-lims-spec-2026-07-28.md` (the C3.0 precedent D.0 reproduced, and the precedent for closing a limb on research); `docs/plans/wave-e-approvals-spec-2026-07-28.md` + `docs/plans/wave-e0-threat-model-2026-07-28.md` (the gated-threat-model-before-code pattern D1b.0 now copies).

**House style** matches the C1, C2, C3, E, D14, F1 and sync-centre specs: numbered sections, explicit disposal of every program clause, a current-state map read at a named SHA, a decision register with flip conditions, per-phase rollback, named acceptance tests continuing the shared series, an exit gate.

**Tag namespace.** `[DH-*]` for this spec's decisions, `[DH-B*]` for its invariants, `[DR-*]` for the Rev 1 review findings and `[DR2-*]` for the Rev 2 delta-review findings (both review-owned; this spec disposes of them but does not author them). `[C1C-*]`, `[C1R-*]`, `[C2L-*]`, `[C2R-*]`, `[C3S-*]`, `[C3R-*]`, `[D14R-*]`, `[D14X-*]`, `[E-*]`, `[ER-*]`, `[SC-*]`, `[F1C-*]`, `[WBR2-*]` are taken. `[DR2-*]` and `[DH-i]` return **zero** hits across `docs/` at this SHA (verified by grep).

**Acceptance-test numbering.** The highest allocated number across `docs/` at this SHA is **AT-143** — Rev 2's own ceiling (verified by grep). Rev 3 keeps AT-119…AT-143 where the assertion survives, **restates** those the review found unassertable or mis-phased, **deletes none**, and takes **AT-144 onward** for the new obligations.

---

## 0. Rev 3 changelog

### 0.1 What changed, in one paragraph

Rev 2 fixed the direction and left three phases unbuildable. The delta review found why, and the finding underneath all seven blockers is the same one: **Rev 2 wrote contracts it could not execute.** A "derived union" that is a TypeScript type, so nothing can enumerate it at runtime. A pack score of "four fed" asserted over a table whose own cells say *partial* and *gap*. An issuance session that allocates a version in prose and persists it nowhere. A spike whose pass/fail was to be chosen after the measurement. A fencing invariant enforced on database rows while the bytes go to object storage unfenced. Rev 3's single organising move is to make every one of those **executable or absent**: a runtime reason-code registry built on the one that already ships (§4.1.1), a versioned requirement profile with a per-item resolver (§2.3), a persisted issuance reservation row (§7.2), predeclared spike thresholds with the cost ceiling written down before anyone measures (§4.5.6), and lease-token-keyed object writes published through a compare-and-swap (§4.6.2). And one structural deletion that removes a whole class rather than testing it: **the folio renders on the server** (§4.3), so the browser never holds folio bytes, `PUT /folios/:id/bytes` is gone, and with it Rev 2's derivation check, its PDF-sink option, its recorder work, and J7.

### 0.2 The product claim, restated

Rev 1's implicit claim was that CIVOS would eventually produce a council submission. D.0 makes that indefensible: on a Queensland developer Operational Works job the submitting party is the **consulting engineer (RPEQ)**, the duty holder is the **developer**, and *"an inspection and testing certificate signed by the consultant"* is what the council receives (Logan PSP5 §5.6.5(1)(a), grade A, read by the D.0 author). Across 14 councils **no document names the civil head contractor as producer, holder or submitter of the ADAC XML**, and two councils state that officers *"will not deal directly with Contractors."*

> **The claim CIVOS may make: "produce a clean, certifiable evidence bundle your engineer can lodge."**
>
> **The claim CIVOS may never make: that it submits to, is accepted by, or certifies anything for a council.**

This is not marketing copy pinned into an engineering spec. It is a **build constraint**, and it decides §2.5 (there is no signature block), §4.3 (the folio **never contains** certification language, because it is rendered by a module that does not import the file holding it), §5 (there is no exporter) and §15 (the exit gate is measured at the consultant, not the council).

`[DH-B8]` — **CIVOS never claims to submit, lodge, or be accepted by a receiving authority, and never presents itself or the contractor as the certifying party.** Asserted by AT-136 (a string guard over folio artefacts) and AT-137 (the wording assertions of §2.5).

### 0.3 Disposition of every `[DR2-*]` finding

| Tag | Verified at `84eac1a7`? | Disposition |
| --- | --- | --- |
| **`[DR2-B1]`** the PSP5 "four fed" score is false | **Yes — and §2.2's own cells contradicted its own score line.** Test coverage: `TestCategory = string` (`testCategories.ts:22`) and the alias table's governance note names **`vicroads-204.v1` as the only resolved pack**, with the QLD/SA/WA compaction phrasings "deliberately absent" (`:29-85`) — so the canonical resolver is Victorian-compaction-only and there is no Logan-18 crosswalk. CCTV: `ALLOWED_DOCUMENT_MIME_TYPES` contains **zero video types** (`documents/fileHelpers.ts:35-47`) and multer caps uploads at **50 MB** (`documents.ts:278`) — a CCTV run is routinely GB-scale, so the upload path rejects the deliverable twice. Rectification: `NCR.linkedTestResultId` (`schema.prisma:947`, relation `:1004`), `rectificationNotes`/`rectificationSubmittedAt` (`:960-961`), `NCREvidence` (`:1035-1046`) — real, and only via an NCR. Photos: `captureTimestamp` + `gpsLatitude`/`gpsLongitude` (`:1609-1611`), but **no pre-backfill qualifier and no chainage**, and the filename rule is unbuilt. | **FOLDED, re-scored to the reviewer's mapping.** §2.2 becomes **one shipped-as-storage / three partial / three gaps** with the file:line evidence in the table. A versioned **`LoganPsp5RequirementProfile` with an executable per-item resolver** is specified in `D1b.0` (§2.3, §4.3.2) — the profile is the thing the folio's expected-vs-present limb reads, and a mapping nothing executes is what produced this blocker. The **Logan-18 crosswalk moves from D1e into `D1b.0`** (§4.3.2). **CCTV upload capability — MIME allowance and a size ceiling — is assigned to `D1d`** (§4.8), which stops being an XS `documentType` phase. Photo and O&M classification are made explicit. **D1e reduces to multi-authority configurability**, named and unbuilt (§4.9). **AT-144**, **AT-145**, **AT-149**. |
| **`[DR2-B2]`** the parity contract is not executable | **Yes on the diagnosis, in full.** `EvidenceReadinessItem.code` is plain `string` (`evidenceReadiness/core.ts:19`), so nothing constrains an emitter. A TypeScript union has no runtime extension. And the overlap is real: one open **major** NCR emits `open_ncrs` (predicate `ncrOpen`, `reasonCodes.ts:112`) *and* `open_major_ncrs` (predicate `ncrSeriousIncludingCritical`, `:180`), so "a fixture triggering exactly that code" is impossible for that pair. | **FOLDED — with the prescribed fix narrowed, because the registry already ships.** See §0.6. `HANDOVER_BLOCKING_REASON_CODES` is a runtime `as const` **subset of the shipped `READINESS_REASON_CODES`** (`reasonCodes.ts:29-85`), not a new parallel vocabulary; `HandoverReasonCode` derives from it, replacing today's `Extract<>`; `EvidenceReadinessItem.code` narrows `string → ReadinessReasonCode`; blocker emitters go through a typed helper. **AT-119 becomes set-membership**, never single-code isolation. §4.1.1, **AT-119**, **AT-138**. |
| **`[DR2-B3]`** issuance binds neither issue id nor version | **Yes.** §4.3.3 allocated id and version "in the same transaction"; §4.4.2 ordered upload *before* the version-allocating insert; §7.2's `FolioSnapshot` carried **no `issueId`, no reserved version and no unique reservation**. Two sessions could reserve the same apparent version and `PUT /folios/:id/bytes` had no row to resolve against. The `compiledFrom` limb is also verified: `ITPCompletion` (`schema.prisma:712-743`, read in full) has **neither `version` nor `updatedAt`**, so "exact ids and versions" was unimplementable for it. | **FOLDED as prescribed.** A **`FolioIssueReservation`** table with `issueId`, `lotId`, `snapshotId`, reserved `version`, issuer, `expiresAt` and **unique `[lotId, version]`** (§7.2). **Revision tokens are defined per model** — `version`, `updatedAt`, or a canonical row digest — with the choice named for each source type rather than assumed uniform (§7.7). **AT-146**. |
| **`[DR2-B4]`** J7 lets `[DR-B3]` survive | **Yes, and the argument is unanswerable.** A malicious PDF can carry every expected string and still alter everything else; text presence is not derivation. AT-143 could not pass under fallback (ii), and was mis-phased into `D1b.0`, before any upload route or `FolioIssue` exists. | **FOLDED — the choice is taken absolutely, not benchmarked.** `[DR2-B4]` offered *server rendering* **or** *complete canonical verification*. **Rev 3 takes server rendering: the folio is produced by the backend from the immutable snapshot, and no route anywhere accepts client-supplied folio bytes.** There is no derivation check because there is nothing to derive-check. Fallback option (ii) is **deleted**; **J7 is deleted**; `[DH-h]` is withdrawn and `[DH-i]` replaces it. **AT-143 is restated as a cannot-exist assertion and moved to `D1b` integration.** §4.3, and §0.7 for everything this deletes. |
| **`[DR2-B5]`** the data model contradicts two invariants | **Yes, all three limbs.** §7.1's `format` vocabulary was the full six values even though only `folio` is reachable on the folio path; §7.3's `HandoverExport` had **no expiry field** while §10.5 promised a TTL; **no hold state existed on either artefact**; and a mutable hold flag on `FolioIssue` would have contradicted §7.1's own UPDATE-rejecting trigger. | **FOLDED as prescribed.** `format = 'folio'` enforced by **route validation and a database `CHECK`** (§7.1). **`HandoverExport.expiresAt`** added (§7.3). A separate **append-only `ArtifactLegalHold`** table (§7.6) — append-only precisely so hold state never becomes a mutable column on an immutable row. **AT-147**, **AT-148**. |
| **`[DR2-B6]`** `D1c.0` has no measurable pass/fail | **Yes, and the second half is the sharper one.** "Memory flat", "cancellation mid-write" and "benchmark cheap" carried no numbers — but the decisive flaw is that §4.5.6 set the cost ceiling **after** measurement, which is a gate that cannot fail. The formula also applied an **output-byte cap to an admission preflight that cannot know compressed output**. | **FOLDED as prescribed.** §4.5.1 predeclares **RSS ceiling, event-loop stall maximum, cancellation-cleanup deadline, and integrity/resume assertions as numbers**. §4.5.6 writes the **commercial cost ceiling down before anyone measures**, and records who may move it. §4.5.3 splits **estimated-input admission** from the **hard streaming-output cap**. **AT-150**. |
| **`[DR2-B7]`** AT-135 demands fencing the design lacks | **Yes.** A conditional database write cannot un-write an object-storage `PUT` that a stale worker already issued. Rev 2's `[DR-B5]` fold said a fenced worker "cannot upload", which no database predicate can enforce. | **FOLDED as prescribed.** Workers upload to a **lease-token-specific object key**; publication is a **fencing-token compare-and-swap** on the export row. A superseded worker's object is written but **unreachable**, and is swept. **AT-135 is rewritten as cannot-*publish*, not cannot-*upload*.** §4.6.2. |
| **`[DR2-A1]`** AT assertability | **Yes, per AT.** | **FOLDED, every named AT.** AT-135, AT-138 and AT-143 restated as assertable. **AT-136 scoped to product-owned template strings** — it would otherwise false-fail on a user-authored note containing "submit" or "lodge", which is a test that punishes a customer for their own vocabulary. **AT-140** given an exact chainage format and an explicit sanitise-then-collide ordering. **AT-142 re-kinded `storage-integration`**, not DB-backed. §14. |
| **`[DR2-A2]`** exit item 10 is weaker and ambiguous | **Yes.** "Needed no reformatting" cannot describe the whole submission when §2.2 items 1 and 6 — the consultant's certificate and the editable asset list — are deliberate, permanent CIVOS gaps. The consultant *must* add those. | **FOLDED, worded as the reviewer put it.** §15 item 10 now has four parts: the **CIVOS sub-bundle** needed no renaming or re-export; the consultant's **deliberate additions are recorded**; the **on-maintenance outcome is observed**; and **no CIVOS acceptance is claimed**. |
| **`[DR2-A3]`** D.0 copy hygiene is otherwise clean | **Yes — re-grepped independently.** No operative text says CIVOS submits; historical references are marked; certification language survives only in the five shipped certificate formats by explicit decision. | **ACKNOWLEDGED, no action beyond `[DR2-B5]`**, which closes the one named structural leak (`FolioIssue.format`). Recorded here so a later revision does not re-audit copy that has already passed. |

### 0.4 Disposition of every Rev 1 `[DR-*]` finding — carried from Rev 2

Unchanged except where a `[DR2-*]` finding above supersedes it, which is noted inline. §0.5 records the delta review's re-score of these dispositions.

| Tag | Verified at `f2defa17`? | Disposition |
| --- | --- | --- |
| **`[DR-B1]`** existing PDF violates `[DH-B1]` | **Yes, with one half already fixed.** Certification language confirmed live: `LOT CONFORMANCE CERTIFICATE` (`conformanceReportPdf.ts:78,86,94,102`), `CONFORMANCE CERTIFICATION` (`:838`), `I hereby certify that this lot has been constructed in accordance with the contract` (`:850`), `Prepared in accordance with…` (`:904-908`). **The unverified-PASS half is FIXED** — see §0.9. | **FOLDED. New phase `D1b.0` (§4.3). SUPERSEDED IN MECHANISM by `[DR2-B4]`.** Rev 2 made the folio a **sixth mode of the frontend generator**. Rev 3 makes it a **separate server-side renderer** that shares no code with `conformanceReportPdf.ts`, so the certification language is not stripped — **it is never in the folio's code path at all**. The five shipped formats are untouched by construction rather than by discipline. §4.3.1, §0.7. |
| **`[DR-B2]`** D1a is not a mapper | **Yes, still true at HEAD.** The `HandoverReasonCode` union is **unchanged** at `futureConsumers.ts:99-109` (verified: `#1656`/`#1658` touched `futureConsumers.ts` and `reasonCodes.ts` but not this union). `insufficient_test_count` is a live blocking code at `evidenceReadiness/conformanceItems.ts:182-192` and is **absent** from the union. `getClaimBlockingReasonsForConformedLot` returns `string[]` (`conformancePrerequisites.ts:195-198`), not codes. `ProjectArea` is a chainage interval with no lot FK (`schema.prisma:447-459`); `Lot` carries `areaZone`, `activityType`, `activitySlug` (`:556-568`). | **FOLDED. New phase `D1a-respec` (§4.1).** Union widened to every currently-blocking code; complete batched handover snapshot; `areaId` **defined** as chainage-window overlap with a named `unplacedLots` escape (§4.1.3); exhaustive parity ATs, not one example. |
| **`[DR-B3]`** a client can issue doctored bytes | **Yes.** `useConformanceReportGeneration.ts:110-116` assembles the payload from **six independent `apiFetch` reads** in one `Promise.all` plus React lot state, then renders at `:156`. No transactionally coherent snapshot exists. | **FOLDED, option 1 (server-controlled issuance). STRENGTHENED by `[DR2-B3]` and `[DR2-B4]`.** Server-created immutable source snapshot; server-computed `compiledFrom`; server-bound issue ID **now persisted in a `FolioIssueReservation` row** (§7.2) rather than asserted in prose. **"Server-side verification of content derivation" is deleted as unnecessary** — the server renders the bytes, so no client bytes exist to verify. §4.3.3. `D1b.0` still carries its own threat model (§4.3.4), pulling program line 134's gate forward from D2. |
| **`[DR-B4]`** four-format / one-line claims false | **Yes, and worse than stated.** Five formats confirmed at `pdf/types.ts:2` (`standard \| tmr \| tfnsw \| vicroads \| dit`) — Rev 1's `FolioIssue.format` vocabulary omitted DIT. `JsPdfRecorder` has `save()` at `pdfTestRecorder.ts:63-66` and **no `output()`**. `savePdf` is a genuine sole choke point (`pdfSave.ts:7-13`) — that narrow claim was correct. | **LARGELY MOOT under `[DR2-B4]`.** Rev 2 needed the sink, the recorder's `output()` and per-format characterization only because the browser had to hand bytes back. **It does not, so none of that is built** (§0.7). What survives: the **five-format count is correct and `pdf/types.ts` is unchanged by Wave D**, and `FolioIssue.format` no longer carries the vocabulary at all — it is `'folio'`, CHECK-constrained (`[DR2-B5]`, §7.1). |
| **`[DR-B5]`** the worker cannot resume a ZIP | **Yes.** Four of five properties hold; **resume does not**. `findRetryableScheduledReportRun:451-484` resumes *recipient deliveries*; missing PDFs are regenerated from scratch at `:750-784`. `processedLots` is not a ZIP checkpoint. | **FOLDED as written into `D1c.1`/`D1c.2` (§4.6, §4.7).** Renewable lease, `leaseOwner`, fencing token, heartbeat; durable `HandoverExportMember` rows with states and checksums; explicit restart semantics; cancellation fencing; two-competing-worker tests. **AT-135 is rewritten** — it was unimplementable as Rev 1 phrased it. |
| **`[DR-B6]`** the 5 GB plan contradicts itself | **Yes, every limb.** `fileSize Int` caps at 2,147,483,647 on Postgres. Hold-point `releaseSignatureUrl`/`evidencePackageUrl` are bare strings with **no stored byte size** (`schema.prisma:777-779`), so a counts-and-sums preflight cannot measure them. | **FOLDED. New phase `D1c.0` (§4.5)** — a production-shaped streaming spike: ZIP64-capable writer, backpressure-aware pipeline, Supabase TUS/S3 multipart, `BigInt` byte counts, the `[DR-A3]` cap formula, and a benchmark of the candidate writers (`[DR-A4]`). |
| **`[DR-B7]`** neither migration enforces history | **Yes.** Absent `updatedAt` prevents nothing; Rev 1 simultaneously claimed "no update path" (`:289-291`) and required delete paths (`:460`). `@@unique([lotId, version])` already indexes — Rev 1's extra identical index was redundant. | **FOLDED as written; ORDERING SUPERSEDED by `[DR2-B3]`.** A **DB trigger rejecting `UPDATE` on `FolioIssue`** (§7.1) — unchanged; **one** authorized deletion procedure, audited (§10.4) — unchanged; redundant index dropped — unchanged. **Rev 2's "preallocate-UUID-then-upload-then-insert in a version-allocating transaction" gave two contradictory orderings and persisted the allocation nowhere; §4.4.2 now states one sequence against a `FolioIssueReservation` row** (§7.2). `compiledFrom`'s "exact ids and versions" becomes **per-model revision tokens** (§7.7), because several source models have no version to carry. |
| **`[DR-B8]`** permissions/retention/storage inconsistent | **Yes.** `[DH-B6]` (no unreadable record in a manifest) directly contradicted Rev 1 `:459`/AT-133 (list them in `omissions[]`). `CLAUDE.md:266` confirms the local-disk fallback is **ephemeral**. Rev 1 had no retention, expiry, legal-hold or PII section. | **FOLDED as written.** Fail **closed** in production when durable storage is unavailable; **aggregate-only** unauthorized counts (no ids, no filenames, no lot associations); a full retention/PII policy section (§10.5). **AT-133 is rewritten.** |
| `[DR-A1]` J1 quality-only without a checklist | Yes. | **FOLDED both halves.** D1a is renamed **"quality closeout readiness"** throughout. And D.0 supplied the receiving checklist the advisory asked for: **Logan PSP5 §5.6.5 IS that list** — recorded in §2, which is why J1's "drop dockets and diaries" now stands on evidence rather than on assertion (§16.1 J1). |
| `[DR-A2]` branding ≠ issuer/signatory | Yes. Branding is shipped (`buildConformanceReportData.ts:114`). | **FOLDED, decided together.** Contractor branding, **no signature block at all**, and explicit wording that neither CIVOS nor the contractor certifies. Wording specified verbatim in §2.5 and asserted by AT-137. D.0's consultant-signs finding is what resolves it. |
| `[DR-A3]` 5 GB cap | Yes. | **FOLDED.** Replaced by the effective-cap formula (§4.5.3), with binary units, unknown-size behaviour, member-count limits and an input-vs-output ruling. |
| `[DR-A4]` `fflate` chosen on the wrong axis | Yes — zero transitive deps is not the deciding requirement. | **FOLDED into `D1c.0` (§4.5.2).** Benchmark `fflate`, `archiver`, `yazl` and a Web Streams/ZIP64 option against >4 GB, 50,000-file, cancellation and memory fixtures. **J4 is withdrawn as a recommendation** and becomes a spike output. |
| `[DR-A5]` QLD-before-NSW is not a jurisdiction argument | Superseded. | **REPLACED by the D.0 verdict.** There is no jurisdiction fork left to make: D2 is deleted, A-SPEC is a **Victorian commercial product with a member-restricted licence and zero NSW adoption**, and NSW's structured-format councils are on ADAC. Rev 2 is **QLD folio-first with no jurisdiction fork** (§16.1 J5). |
| `[DR-A6]` D.0 may not fit one docs PR | Yes — and it did fit, at grade A, with paywalled items honestly marked NOT FOUND. | **DISCHARGED by outcome.** D.0 merged as #1660. The advisory's rule ("do not convert inability to obtain proprietary material into an inferred answer") was honoured — WSA 05 Appendix A5 is marked NOT FOUND at AUD $792 rather than guessed. |
| `[DR-A7]` D.0 missing decision-critical questions | Yes. | **FOLDED into §17**, a residual-questions section with an explicit outcome per question — `unblocks` / `rescope` / `closes limb` / `remains blocked`. Repo-answerable items are recorded as **code facts**, not re-researched. |
| `[DR-A8]` `[DH-B3]` stated too broadly | **Yes, confirmed false as absolutely worded.** `controlLineGeometry.ts:44-51` converts local control points to WGS84; `lotGeometry.ts:100` (`generateChainageOffsetPolygon`) computes offset polygons; `geoPdf.ts` implements a separate forward MGA projection. | **FOLDED — invariant reworded verbatim as directed** (§8, `[DH-B3]`). |
| `[DR-A9]` citation and scope hygiene | Yes, all five inaccuracies confirmed. | **FOLDED.** Corrections listed in §0.8. |

### 0.5 The delta review's re-score of Rev 2's `[DR-*]` dispositions

The review re-checked every claim §0.4 makes. Its verdicts, and what Rev 3 does about each — recorded verbatim rather than paraphrased, because a disposition table that grades itself is worth nothing.

| Tag | The delta review's verdict | Rev 3's response |
| --- | --- | --- |
| `[DR-B1]` | **Partial.** `#1658` is real: verified-only PASS at `conformanceReportPdf.ts:115-131,367-385`. Certification text remains at `:78-108,838-891,904-908`. Folio remediation is still design intent. | **Accepted, and the remediation stops being intent.** Under `[DR2-B4]` the folio never enters that file, so "remove the certification language" becomes "never write it" — a property of the file boundary, asserted by **AT-137** over the new renderer. |
| `[DR-B2]` | **Not closed.** The missing code is verified, but the proposed derived contract is not executable. | **Accepted in full.** `[DR2-B2]`, §4.1.1. |
| `[DR-B3]` | **Not closed.** The unsafe browser assembly is verified at `useConformanceReportGeneration.ts:105-156`; the replacement has an unbound issuance session and an explicitly unsafe fallback. | **Accepted in full, and closed on both limbs.** The session binds (`[DR2-B3]`, §7.2); the fallback is deleted (`[DR2-B4]`, §4.3). |
| `[DR-B4]` | **Credible design.** Five formats, recorder gap and `savePdf` choke point are correctly cited. This is the strongest disposition. | **Accepted — and then made largely moot.** The citations stand; the work they justified is not built (§0.7). A correct design for a problem that no longer exists is still not built. |
| `[DR-B5]` | **Partial.** Lease/fencing fields are concrete, but object-storage writes are not fenced. | **Accepted in full.** `[DR2-B7]`, §4.6.2. |
| `[DR-B6]` | **Partial.** `BigInt` and a spike are appropriate, but the spike lacks fixed pass/fail thresholds. | **Accepted in full.** `[DR2-B6]`, §4.5.1, §4.5.6. |
| `[DR-B7]` | **Partial.** The UPDATE trigger is real design; version allocation and upload ordering contradict each other. | **Accepted in full.** The contradiction is resolved by the reservation row plus server rendering — there is no client upload to order against (§4.4.2, §7.2). |
| `[DR-B8]` | **Partial.** Fail-closed storage and aggregate-only exclusions are concrete. Retention/legal-hold requirements have no corresponding fields. | **Accepted in full.** `[DR2-B5]` adds the fields: `HandoverExport.expiresAt` (§7.3) and `ArtifactLegalHold` (§7.6). |

### 0.6 Where Rev 3 narrows a prescribed fix — `[DR2-B2]`

This is the single place Rev 3 does not do what the review said, and it is a narrowing rather than a refusal, so it is stated here rather than buried in §4.

`[DR2-B2]`'s diagnosis is correct in every particular and Rev 3 accepts all of it. Its **fix** says: *"introduce a runtime `HANDOVER_BLOCKING_REASON_CODES` registry and require blocker emitters to use a typed helper backed by it."*

**A runtime registry of exactly that shape already ships.** `READINESS_REASON_CODES` (`backend/src/lib/readiness/contracts/reasonCodes.ts:29-85`) is an `as const` array of **every** code the engine emits; `ReadinessReasonCode` is derived from it (`:87`), not hand-written; `REASON_CODE_PROVENANCE` (`:98`) forces every code to name the predicate that computes it; `isReadinessReasonCode` is a shipped runtime guard (`:238`); and `contracts.test.ts:152-192` already asserts each consumer union stays inside the vocabulary. Its own header states the rule Rev 3 needs — *"If the engine gains a code, add it here (and its provenance) in the same change; the contract test fails otherwise."*

> **So `HANDOVER_BLOCKING_REASON_CODES` is a runtime `as const` *subset of* `READINESS_REASON_CODES`, not a second registry.** `HandoverReasonCode` is derived from **it**, replacing today's hand-listed `Extract<>` at `futureConsumers.ts:100-109` — which is the actual defect, since an `Extract<>` is a hand-list wearing a derivation's clothes. The typed emitter helper the review asks for is the other half, and it is genuinely missing: `EvidenceReadinessItem.code` is `string` (`core.ts:19`), so **that field narrows to `ReadinessReasonCode`** and emitters go through a helper typed on it.

*ponytail: a second vocabulary next to a shipped one is two vocabularies that drift, which is the exact failure `[DH-B5]` exists to prevent. Extend the registry that already has a passing contract test.*

### 0.7 What server-side rendering deletes

`[DR2-B4]` is the largest change in this revision and almost all of its effect is **deletion**. Recorded as a list, because a reader who skims §4 will otherwise go looking for machinery that no longer exists.

| Rev 2 built | Rev 3 |
| --- | --- |
| `PUT /api/folios/:folioIssueId/bytes` | **Deleted.** No route accepts folio bytes. **AT-143.** |
| The derivation check (§4.3.3), `FolioIssue.derivationCheck Json?` | **Deleted.** Nothing to check. |
| J7 — the Node PDF text-extraction dependency decision | **Deleted.** §16.1. |
| The `sink?: (blob, filename) => void` option on `generateConformanceReportPDF` | **Deleted.** `conformanceReportPdf.ts` is **not modified by Wave D at all**. |
| `[DH-a]` — "the sink is threaded through options, never a module-level capture mode" | **Withdrawn.** There is no sink. |
| `JsPdfRecorder` Blob/`output()` support + the real-jsPDF byte test (§4.3.5) | **Deleted.** Not needed; the recorder is untouched. |
| AT-122 — "the sink changes nothing, per format" | **Restated** as a no-diff assertion over `frontend/src/lib/pdf/` — Wave D must not modify it. |
| `[DH-h]` — folio as a sixth `ConformanceFormat` value | **Withdrawn**, replaced by **`[DH-i]`**: the folio is a separate backend document. |
| `FolioIssue.format` carrying all six format values | **Replaced** by `'folio'` with a DB `CHECK` (`[DR2-B5]`, §7.1). |
| Rev 2 §0.9's withdrawal of the "characterization suite passes unmodified" promise | **Moot, and the stronger promise is now true.** Wave D changes no line of any shipped generator, so the suite genuinely does pass unmodified — not as a promise, as a diff property. **AT-122.** |

**What it adds, stated with equal honesty: one new backend dependency** — a Node PDF writer, since `backend/package.json` has **no PDF library of any kind** (verified: zero matches for `jspdf`, `pdfkit`, `pdf-lib`, `puppeteer`, `playwright`, `canvas`), and `backend/src/lib/scheduledReports/pdf.ts:69` is a hand-rolled ASCII-only text writer that cannot carry a folio. **And a second renderer for a document that has no shipped layout.** §4.3.1 argues why that is cheaper than it sounds; §4.3.6 picks the library.

### 0.8 The `[DR-A9]` corrections, still standing

| Rev 1 said | Rev 2 and Rev 3 say |
| --- | --- |
| `:24` "one new table, one new column on an existing table" | **Wrong, and §7 contradicted it in the same document.** Rev 2 creates **three** tables (`FolioIssue`, `HandoverExport`, `HandoverExportMember`) plus one `FolioSnapshot`, and **no** column on any existing table. §7. |
| "four authority formats" | **Five** — `standard`, `tmr`, `tfnsw`, `vicroads`, **`dit`** (`pdf/types.ts:2`). |
| "all eight codes already produced by the batch computations" | **False.** `computeConformanceResult` returns prerequisite booleans; `getClaimBlockingReasonsForConformedLot` returns human strings; `open_major_ncrs` is produced in `claimReview.ts:230`, whose severity input the conformance batch does not fetch. §4.1. |
| "the archive is reproducible from immutable inputs" | **Only once inputs are frozen.** Mutable/superseded document selection made it non-reproducible. `HandoverExportMember` freezes exact row ids, **revision tokens** (§7.7), sizes and checksums (§7.5). |
| "identical manifests" | Qualified: `manifest.csv`/`manifest.json` are byte-identical across runs; `manifest-summary.json` carries generated-at and is **excluded from the determinism assertion** (§4.7.2, AT-128). |
| "the only edit is one line at `conformanceReportPdf.ts:888`" | **Stale and withdrawn** (§0.9) — **and now MOOT.** Under `[DR2-B4]` Wave D edits **zero** lines of that file, or of any file under `frontend/src/lib/pdf/`. §0.7, AT-122. |

### 0.9 Two findings that moved between the Rev 1 review's SHA and Rev 2's

The review was performed at `9bd83dd9`. This spec is at `f2defa17`. Two things changed, and both are recorded rather than quietly absorbed.

**1. `[DR-B1]`'s unverified-PASS half is FIXED — by `#1658` (`2dd1adf0`, `fix(pdf): conformance report never prints PASS for an unverified test`).** The review's finding was: *"It ignores `TestResult.status`, so an unverified row whose `passFail` is `pass` prints `PASS`."* At `f2defa17` that is no longer true. `conformanceReportPdf.ts:112-135` now carries `isVerifiedTest()` (`status === 'verified'`) and `getTestVerdict()`, which returns `Pending Verification` or `Awaiting Result` for an unverified row and reaches `PASS` only through the verified branch; the summary line at `:367-385` counts `Passed`/`Failed` **only over verified rows** and prints an explicit `Unverified: n`. **This is the single strongest piece of evidence that `[DR-B1]`'s remaining half is real:** the same file, the same authority formats, the same reviewer-identified failure class — and it took a dedicated PR to fix one instance of it. The certification-language half (`:78-102`, `:838`, `:850`, `:904-908`) is untouched and remains a live contradiction of `[DH-B1]`.

**2. Rev 1's `:888` citation is stale, and its headline claim with it.** `#1658` added 33 lines above the terminal call. `savePdf` for the conformance generator is now at **`conformanceReportPdf.ts:922`**, in a **923-line** file (was 889). More importantly, Rev 1's *"the existing characterization suite passes unmodified, which is the point"* (`:283`, `:549`, exit-gate item 7) **is withdrawn**: `#1658` changed rendered output — verdict strings, a new summary field, and column widths `[38,30,42,22,38] → [38,30,42,28,32]` — and correspondingly modified `conformanceReportPdf.test.ts` (+76 lines). A characterization suite that must be edited when behaviour legitimately changes is working correctly; a spec that promises it will never be edited is making a promise it does not control. **Rev 2 promises the narrower, true thing:** the folio mode adds a code path and changes **no** operation recorded for any existing format, asserted per format by AT-122.

### 0.10 Commits between `bd3bf36a` and `f2defa17` — and none between `f2defa17` and `84eac1a7`

`6891a559` (E1 hold-point awaiting-release predicate — moved `reasonCodes.ts` provenance and `futureConsumers.ts` comments, **not** the handover union), `e2e2f4e4` + `d9117e21` (C3 exit-gate docs), `2dd1adf0` (`#1658`, above), `f2defa17` (`#1660`, D.0). Two of the five touched files this spec depends on; both are folded above.

**Between `f2defa17` and the review's `84eac1a7`: exactly one commit, `84eac1a7` itself (`#1661`, Rev 2), touching exactly one file — this spec.** `git diff --stat f2defa17..84eac1a7` → `docs/plans/wave-d-handover-spec-2026-07-28.md | 935 +++---`, one file changed. **No code moved between Rev 2's citations and the delta review's**, so every finding was verified against the code Rev 2 actually described.

### 0.11 `84eac1a7` → `75eea0b9` — the five lines that moved this revision's citations

`#1662` (`75eea0b9`, Wave E2 chase digest) landed while Rev 3 was being written. It is unrelated to Wave D in substance — hold-point chase automation, email suppression, a new digest template — but it touched `backend/prisma/schema.prisma`, which Wave D cites heavily.

**The whole schema change is five lines at `:824-829`:** an `@@index([holdPointId])` on `HoldPointReleaseToken`, with a four-line comment explaining why E2 makes an existing gap load-bearing. Nothing was renamed, removed or retyped.

**But its position matters.** It sits above `NCR` and `Document` and below `Lot`, `ProjectArea`, `ControlLine`, `LotGeometry` and `ITPCompletion`. So:

| Model | Rev 2 / delta-review citation | Re-derived at `75eea0b9` |
| --- | --- | --- |
| `ProjectArea` | `:447-459` | **unchanged** |
| `Lot` (chainage `:551-552`, `activitySlug` `:564`) | `:545-568` | **unchanged** |
| `ITPCompletion` | `:712-743` | **unchanged** |
| `HoldPoint` file pointers | `:777-779` | **unchanged** |
| `NCR.linkedTestResultId` | `:942` | **`:947`** |
| `NCR` rectification fields | `:955-956` | **`:960-961`** |
| `NCR.linkedTestResult` relation / index | `:999` / `:1012` | **`:1004`** / **`:1017`** |
| `NCREvidence` | `:1030-1041` | **`:1035-1046`** |
| `Document` model | `:1592-1638` | **`:1597-1643`** |
| `Document` GPS + capture | `:1604-1606` | **`:1609-1611`** |
| `Document` version tracking | `:1613-1615` | **`:1618-1620`** |

**Each of these was re-opened at `75eea0b9`, not shifted by arithmetic** — the arithmetic happened to be right, which is exactly why it is not evidence. The delta review's `[DR2-B1]` and `[DR2-B3]` findings are unaffected in substance: the fields it found, and the fields it found missing, are the same fields.

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
| **1** | *"an inspection and testing certificate signed by the consultant"* (§5.6.5(1)(a)) | Nothing, **by design**. CIVOS compiles the evidence the consultant certifies **over**; it does not produce the certificate and does not sign. | **GAP, deliberate and permanent.** This is the honesty line (§0.2, §2.5). The folio is the input to this item, never the item. |
| **2** | Test results across **18 named categories** (fill/trench compaction, sub-grade CBR and compaction, CBR 15 quality and compaction, sub-soil drain filter grading, bedding grading, base/sub-base quality and compaction, prime and primer seal rates, AC core tests, concrete testing, sewer and water main pressure tests, water quality) | `TestResult` (`schema.prisma:857`) with `status`/`passFail`, C1's sufficiency engine, and F1's canonical categoriser (`readiness/sufficiency/testCategories.ts`). Verified-only counting shipped in `#1658`. | **PARTIAL — Rev 2 scored this SHIPPED and that was wrong (`[DR2-B1]`).** `TestCategory` is `type TestCategory = string` (`testCategories.ts:22`) — an **open** vocabulary derived at read time. Worse, the resolver's own governance note scopes it: *"an alias ships only for a string a lot under a RESOLVED pack can actually carry… The only resolved pack is `vicroads-204.v1` (VIC, `earthworks_general` / `earthworks_subgrade_prep`), so the QLD/SA/WA 'Compaction testing'-family phrasings of §5.4 are deliberately absent"* (`testCategories.ts:29-85`). **The canonical resolver is Victorian-compaction-only and no Logan-18 crosswalk exists.** Storing a test is shipped; *resolving a Logan category* is not. The crosswalk **moves from D1e into `D1b.0`** (§2.3, §4.3.2) — the folio cannot say "expected, missing" for a category it cannot name. |
| **3** | ***"details of the retesting or rectification carried out where any test result fails"*** | `NCR.linkedTestResultId` (`schema.prisma:947`, relation `:1004`, index `:1017`), `rectificationNotes` / `rectificationSubmittedAt` (`:960-961`), and `NCREvidence` (`:1035-1046`) carry the trail **when an NCR was raised**. C2's test lifecycle carries the fail. | **PARTIAL — and the gap is precise.** The NCR limb is genuinely richer than Rev 2 credited: a failed test **links structurally** to its NCR, and the NCR carries notes, a submission timestamp and document evidence. What is missing is the **no-NCR path**: there is **no retest→original-test link on `TestResult`**, so a failed test followed by a passing retest with no NCR raised leaves the two rows unassociated. The folio states *"failed test, rectification not linked"* rather than implying a clean trail. Closing it is a C2-family column, not a D1 phase. |
| **4** | *"CCTV video for underground stormwater infrastructure work"* (§5.6.5(1)(e)) | **Nothing usable.** `ALLOWED_DOCUMENT_MIME_TYPES` (`documents/fileHelpers.ts:35-47`) contains `application/pdf`, Word, Excel, Outlook, `message/rfc822`, JPEG, PNG, GIF, WebP — and **no video type at all**. Multer caps every document upload at **50 MB** (`documents.ts:278`). | **GAP — Rev 2 scored this "UNBLOCKED at Scope A" and that was wrong (`[DR2-B1]`).** D.0-Q3 correctly established that the *deliverable* is a file set, not a structured record — that finding stands. But the shipped upload path **rejects the file twice**: the MIME filter refuses `video/mp4` outright, and a stormwater CCTV run is routinely gigabyte-scale against a 50 MB ceiling. "A `documentType` value and a manifest category" is not a capability when nothing can be uploaded. **D1d now owns the upload capability — an allowed video MIME set and a raised, separately-governed size ceiling** (§4.8). **AT-149.** |
| **5** | ***"date-stamped photographs of work that will not be visible after construction, taken prior to backfilling, with a chainage or exact location reference in the filename"*** | `Document.captureTimestamp` + `gpsLatitude`/`gpsLongitude` (`schema.prisma:1609-1611`), the shipped photo-pin and chainage-generator work, and `Lot.chainageStart`/`chainageEnd` (`:551-552`). | **PARTIAL — Rev 2 scored this SHIPPED and over-claimed twice (`[DR2-B1]`).** The date-stamp and location limbs are genuinely shipped. But **neither of the two qualifying clauses is**: nothing records that a photo depicts *work that will not be visible after construction*, and nothing records *taken prior to backfilling* — a photo of a bedded pipe and a photo of a finished surface are indistinguishable to the schema. And the filename rule is **specified, not shipped** (§4.7.3, D1c.2). Rev 3 makes the classification explicit: **`documentType` gains a pre-backfill concealed-works value in `D1d`**, alongside CCTV, since both are the same "the schema cannot tell what this photo is of" problem. **AT-149.** |
| **6** | *"an asset list in editable spreadsheet format"* | Nothing. The 78-model schema has **no `Asset`, `Pit`, `Pipe`, `Manhole`, `Node` or `Conduit` model** (§3.6, re-verified). | **GAP, and deliberately not closed.** This is the surveyor's and consultant's deliverable, produced from the same survey that produces the XML. Building an asset register to fill it is §1.3's forbidden over-build wearing a requirement-list costume. |
| **7** | Vendor **O&M manuals** | `Document` with a `documentType` value and a manifest category. | **SHIPPED as storage — and that phrase is the whole verdict.** A PDF manual uploads and files correctly today under the existing MIME allowance. CIVOS stores and lists it; it does not assemble, index or validate it, and is explicitly **not** an O&M manual builder (§1.3). Classified in the profile as `storage_only`, so the folio says *"present, as supplied"* and never implies review. |

> **Score, restated honestly and re-scored per `[DR2-B1]`: of seven mandatory pack items, CIVOS ships **one** (item 7, as storage), **partially** feeds **three** (2, 3, 5), and does **not** feed **three** (1, 4, 6).**
>
> **Rev 2 claimed four fed, one partial, two gaps. That was false, and it was false against Rev 2's own table** — three of the cells it counted as "fed" said *partial*, *no crosswalk exists* or *nothing can be uploaded* in their own text. This is the failure mode `[DH-B1]` exists to prevent, committed by the spec that authored `[DH-B1]`. It is recorded rather than quietly corrected because the next revision's score line will be read the same uncritical way this one was.

Two of the three gaps are **deliberate and permanent** (1 and 6 — certification is not ours to make, asset registers are not our product). **One is a real, closable product gap** (4, CCTV), and Rev 3 closes it in `D1d` rather than leaving it mis-scored as shipped. The honest claim remains *"a clean, certifiable evidence bundle your engineer can lodge"* — it is just a smaller bundle than Rev 2 said, and the items CIVOS does cover are still the ones the head contractor is on the hook for.

### 2.3 `LoganPsp5RequirementProfile` — the mapping becomes executable

`[DR2-B1]`'s deeper finding is not the arithmetic. It is that **§2.2 is a prose table, and D1b.0 was told to render "expected → present → missing" against it.** A folio cannot read a markdown table. A score nothing executes is a score nobody can be wrong about — which is exactly how Rev 2's was wrong for a full revision.

> **`D1b.0` ships a versioned `LoganPsp5RequirementProfile` and an executable resolver, one function per pack item.** The profile is data: a `profileVersion`, and for each of the seven items an `id`, the verbatim PSP5 clause reference and text, a `coverage` value (`shipped` | `storage_only` | `partial` | `gap_deliberate` | `gap_closable`), and the resolver it dispatches to. §2.2 is generated from it, not the other way round.

Per-item resolver contract — each returns `present` (with its evidence row ids), `missing` (**named**), `not_applicable` (**with the reason**), or **`not_assessable`** (with the reason CIVOS cannot tell). That fourth state is new in Rev 3 and it is the one that keeps the profile honest:

| Item | Resolver | Returns `not_assessable` when |
| --- | --- | --- |
| 1 — consultant's certificate | Constant `gap_deliberate`. Never resolves to `present`. | — (never assessed; it is not ours) |
| 2 — the 18 test categories | The **Logan-18 crosswalk** (below) over the lot's `TestResult` rows, verified-only. | A lot's test-type string resolves to no Logan category — reported by name, never silently dropped. |
| 3 — retest / rectification | Failed verified tests → linked NCR (`linkedTestResultId`) → `rectificationNotes` / `NCREvidence`. | A failed test has no NCR and no linkable retest — the §2.2 item-3 hole, printed as *"failed — rectification not linked"*. |
| 4 — CCTV | Documents of the CCTV type on the lot. | Until `D1d` ships the upload capability, **always** — and the folio says *"CIVOS cannot yet hold this file type"*, not *"missing"*. Blaming the customer for a gap we own is the worst thing this document could do. |
| 5 — concealed-works photos | Documents of the pre-backfill type with `captureTimestamp`. | The lot has photos but none classified pre-backfill — reported as *"photos present, none classified as concealed works"*. |
| 6 — asset list | Constant `gap_deliberate`. | — |
| 7 — O&M manuals | Documents of the O&M type. `storage_only`. | — |

**The Logan-18 crosswalk moves from D1e into `D1b.0`** and is the phase's largest single piece of content. It is a versioned data table mapping the 18 PSP5 category names onto `TestCategory` values, governed by the rules `testCategories.ts:29-85` already establishes for the alias table — **which is the model to copy, not to duplicate**: same shape, same per-entry provenance comment, same "removing an entry is a normal PR, adding one is not" governance. It ships **with** the QLD compaction-family aliases that `testCategories.ts` deliberately omits today, because Logan is a QLD pack and those strings now resolve to something. **AT-144**, **AT-145**.

*ponytail: the profile is a frozen object and seven small functions, not a rules engine. It gains a second authority the day a second authority exists (§4.9) — and `profileVersion` is there so that day is additive rather than a rewrite.*

### 2.4 What the mapping changes about D1

1. **The folio gets an expected-requirements input it does not have today.** Rev 1's folio was the shipped certificate with a database row attached; it could not say "two missing, by name" because nothing tells it what to expect. **§2.3's profile is now that input** — and it is code, so AT-144 can assert it.
2. **Determinism gets a purpose.** §4.7.3's deterministic archive paths were a nice property in Rev 1. Pack item 5 makes them a **requirement**: chainage in the filename is a council-enforced condition. D.0 also notes this is the shape the engineer's ADAC `SupportingFile` field (a bare 254-character filename string, no type, no hash, no URI) can reference — a free consequence, not new work.
3. **D1d stops being a rounding error.** Rev 2 sized it XS — "a `documentType`, a lot association, a manifest category". `[DR2-B1]` shows that buys nothing while the upload path rejects video. D1d now owns a real capability (§4.8).
4. **D1e loses its remaining content and keeps its deferral.** With the Logan-18 crosswalk pulled into `D1b.0` and CCTV into `D1d`, **D1e is exactly one thing: multi-authority configurability** — a second pack profile and the UI to pick between them. Named, scoped, and unbuilt (§4.9).

### 2.5 Who signs — and the exact wording that follows `[DR-A2]`

`[DR-A2]` found that contractor branding does not answer who is certifying, and that the shipped authority formats make the contractor appear to certify CIVOS-generated text over an empty signature block. D.0 resolves it: **the consultant signs.** So, decided together as the advisory required:

| Question | Decision |
| --- | --- |
| Issuer organisation | The **contractor's**, via the shipped company branding (`buildConformanceReportData.ts:114`, `pdf/branding.ts`). Unchanged from J2. |
| Signatory authority | **None. The folio has no signature block at all.** Not an empty one — an empty signature line under compiled text is an invitation to sign over a claim nobody made. This is the concrete change `[DR-A2]` asked for and Rev 1's J2 missed. |
| CIVOS attribution | One line, factual, non-prominent: `Compiled in CIVOS by {name} on {date}. Folio {id} v{n}.` |
| Legal wording (verbatim, asserted by **AT-137**) | *"This folio is a compilation of records held in CIVOS at the date and time stated. It is not a certification. Certification of the works is the responsibility of the certifying consultant and is not made by this document, by the contractor named above, or by CIVOS."* |
| Branding snapshot | The branding in force **at issue time** is frozen into the `FolioSnapshot` (§7.3), so a v1 folio does not silently re-brand when the company logo changes. |

---

## 3. Current-state map (read at `f2defa17` for Rev 2; the `schema.prisma` citations re-derived at `75eea0b9`, §0.11)

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

The standing rule holds: `docs/agent-handoff.md:516-517` and `downloadable-files-improvement-plan-2026-07-05.md:58` — *"pdfGenerator is jurisdictional — DO NOT refactor."* Rev 2 respected it by adding a mode. **Rev 3 respects it completely: under `[DH-i]` Wave D does not open this file.** The folio renders on the server from its own module (§4.3.1), so the strongest form of "do not refactor" — *do not edit* — is what ships. **AT-122.**

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

`Document` (`:1597-1643`): one model for photos and documents, discriminated by `documentType`, with `lotId`, `fileUrl`, `mimeType`, `gpsLatitude`/`gpsLongitude`/`captureTimestamp` (`:1609-1611`), and version tracking (`version:1618`, `parentDocumentId:1619`, `isLatestVersion:1620`). **No checksum column. No chainage column** (§2.2 item 5 does not need one). **And no field qualifying a photo as concealed-works or pre-backfill** — the §2.2 item-5 gap `[DR2-B1]` surfaced, closed by a `documentType` value in D1d (§4.8).

`NCR.linkedTestResultId` at `:947` (relation `:1004`, index `:1017`), `rectificationNotes` / `rectificationSubmittedAt` at `:960-961`, `NCREvidence` at `:1035-1046` (§2.2 item 3).

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
| **D1a-respec** | S | none | nothing | `[DR-B2]`, **`[DR2-B2]`**. Repairs the reason-code contract **as runtime data**, narrows `EvidenceReadinessItem.code`, and defines the batched snapshot **before** anything reads it. Types + tests only. |
| **D1a** — quality closeout readiness | S | none | D1a-respec | The view. Renamed per `[DR-A1]`. |
| **D1b.0** | **L** | none (contract + profile + spike) | nothing | `[DR-B1]`, `[DR-B3]`, `[DR-B4]`, **`[DR2-B1]`**, **`[DR2-B4]`**. The `LoganPsp5RequirementProfile` + resolvers + the **Logan-18 crosswalk**; the content contract; the threat model; the **Node PDF library decision and benchmark**. **Grew from M to L** — it absorbed D1e's crosswalk and the server renderer, and shed all of Rev 2's recorder/sink work (§0.7). |
| **D1b** — issued folio | M | 2 (`FolioSnapshot` + `FolioIssueReservation`, `FolioIssue` + trigger + CHECK) | D1b.0 | Persistence with identity, and the server-side renderer wired to it. |
| **D1c.0** | M | none (spike) | nothing | `[DR-B6]`, `[DR-A3]`, `[DR-A4]`, **`[DR2-B6]`**. Streaming/storage benchmark against **predeclared thresholds**; the split cap formula; the writer decision; the **pre-declared** cost ceiling. |
| **D1c.1** | M | 1 (`HandoverExport` + `HandoverExportMember` + `ArtifactLegalHold`) | D1b, D1c.0 | `[DR-B5]`, `[DR-B7]`, **`[DR2-B5]`**, **`[DR2-B7]`**. Frozen-member ledger, job schema with lease/fencing, expiry and append-only legal hold. |
| **D1c.2** | L | none | D1c.1 | The worker with **lease-keyed object writes and CAS publish**, the manifest, the streamed download, the UI. |
| **D1d** — CCTV **and concealed-works capability** | **S** | none | D1c.2 | **`[DR2-B1]`.** Video MIME allowance, a separately-governed size ceiling, the pre-backfill `documentType`, lot association, manifest categories. **Grew from XS** — Rev 2's XS bought nothing while the upload path rejected video (§2.2 item 4). |
| **D1e** — multi-authority configurability | ? | ? | a later revision | Reduced to exactly one thing (§2.4 item 4). Named, unbuilt. |

**The old parallelism is gone.** Rev 1 said D1a and D1b were independent and could ship in either order. They are not: both now depend on a contract phase, and D1b depends on an architecture decision that does not exist yet. `D1a-respec`, `D1b.0` and `D1c.0` **can** run in parallel with each other — they touch disjoint files — and that is the only parallelism this wave has.

**What the delta review's NO-BUILD verdicts required, phase by phase.** All three are addressed in this revision; whether they are *discharged* is the reviewer's call, not this document's.

| Phase | The NO-BUILD reason | Where Rev 3 answers it |
| --- | --- | --- |
| D1a-respec | "Its 'derived union' and AT-119/138 cannot be implemented as written." | §4.1.1 — runtime subset of the shipped registry; §14 — AT-119 as set membership, AT-138 over runtime data. |
| D1a | "Depends on the unresolved D1a-respec contract." | Follows D1a-respec. No independent defect was found. |
| D1b.0 | "No durable issue/version binding, no safe render-or-verify decision, and no executable pack resolver." | §7.2 reservation row; §4.3 server render (the decision, taken); §2.3 profile + resolvers. |

### 4.1 Phase `D1a-respec` — repair the contract before anything reads it

Types and tests only, no product surface. Output: an amended `futureConsumers.ts` contract **that a test can enumerate**, a narrowed `EvidenceReadinessItem.code`, a defined input snapshot, and the parity tests that will govern D1a.

**4.1.1 The union becomes runtime data — `[DR2-B2]`.**

Rev 2 said the union is *"derived from, and asserted equal to, the set of `ReadinessReasonCode` values that any shipped path emits with `severity: 'blocker'` and `blocksAction: true`"*, and asserted it with AT-138. **`[DR2-B2]` is right that this cannot be implemented: a TypeScript union has no runtime extension, so nothing can enumerate it to compare.** Rev 2 wrote a set equation between a type and a value.

The fix is smaller than the review supposed, because the runtime half already ships (§0.6). Three changes, in dependency order:

1. **`HANDOVER_BLOCKING_REASON_CODES` is a runtime `as const` array — a declared subset of `READINESS_REASON_CODES`** (`backend/src/lib/readiness/contracts/reasonCodes.ts:29-85`), living beside it and governed by the same header rule. `HandoverReasonCode` becomes `(typeof HANDOVER_BLOCKING_REASON_CODES)[number]`, **replacing the hand-listed `Extract<>` at `futureConsumers.ts:100-109`** — which is the actual defect, since an `Extract<>` over a literal list is a hand-list wearing a derivation's clothes. Its membership is asserted against `READINESS_REASON_CODES` at test time, so a typo cannot introduce a code the engine never emits. **At this SHA the set is the eight already listed plus `insufficient_test_count`** (`evidenceReadiness/conformanceItems.ts:182-192`), which is a live `severity: 'blocker'`, `blocksAction: true` item absent from today's union.
2. **`EvidenceReadinessItem.code` narrows from `string` to `ReadinessReasonCode`** (`evidenceReadiness/core.ts:19`). This is the emitter-side half `[DR2-B2]` asks for and the half that does not exist today: while `code` is `string`, any builder can emit anything and no registry can be authoritative. Narrowing it makes an unregistered code a **compile error at the emitter**, which is where it should fail.
3. **Blocking items are emitted through one typed helper** — a thin constructor over `EvidenceReadinessItem` that takes a `ReadinessReasonCode` and sets `severity: 'blocker'`, `blocksAction: true`. It exists so AT-138 has a single call site to enumerate rather than a grep.

> The rule, restated so it is checkable rather than aspirational: **`HANDOVER_BLOCKING_REASON_CODES` is asserted equal to the set of codes the shipped emitters actually produce as blockers under the D1a fixture battery.** A new blocking code is a compile error at step 2 or a test failure at AT-138 — never a silent divergence.

*ponytail: extend the registry with a passing contract test; do not stand a second vocabulary next to it. Two vocabularies is the drift `[DH-B5]` forbids, re-introduced by the fix for `[DH-B5]`.*

**Why AT-138 is now assertable and AT-119 is not, as Rev 2 wrote it.** AT-138 compares two runtime sets, which is a real comparison. AT-119 demanded *"a fixture lot that triggers **exactly** that code"* — and `[DR2-B2]` shows that is impossible for overlapping emitters: one open **major** NCR necessarily produces both `open_ncrs` (predicate `ncrOpen`, `reasonCodes.ts:112`) and `open_major_ncrs` (predicate `ncrSeriousIncludingCritical`, `:180`). **AT-119 is therefore restated as set membership** — for every code in the registry, a fixture that provokes it yields that code from **both** endpoints, and the two endpoints' full code **sets** are equal for that fixture. Set equality is the property `[DH-B5]` actually wants; single-code isolation was an accident of how Rev 1 wrote the example. §14.

**4.1.2 Define the complete batched handover input snapshot.** D1a is **not** a mapper over `checkConformancePrerequisitesBatch` — that batch does not fetch NCR severity and does not perform the normal hold-point count (§3.1). `D1a-respec` specifies one batched query set producing, per lot, in one pass: conformance prerequisites; **NCR severity** (for `open_major_ncrs`, the `claimReview.ts:230` definition); the **normal unreleased hold-point count** (the `qualityRoutes.ts:301-360` definition, not the N/A-bypass subset); and sufficiency (for `insufficient_test_count`). Where two shipped paths disagree on a definition, **the lot page's definition wins and the divergence is recorded**, because the lot page is what the user is looking at when they disbelieve the panel.

**4.1.3 `areaId` — defined, not dropped.** `ProjectArea` is a chainage interval with `chainageStart`/`chainageEnd` and **no lot relation** (`schema.prisma:447-459`); `Lot` carries its own `chainageStart`/`chainageEnd` (`:551-554`) plus free-text `areaZone`.

> **`areaId` selects lots whose `[chainageStart, chainageEnd]` overlaps the `ProjectArea` window on the same project.** A lot with a null chainage on either end is **never matched** and is reported in a top-level **`unplacedLots`** count on the response.

That count is the whole point: a chainage filter that silently drops every unchainaged lot is a filter that lies, and this is a codebase where lots without chainage are ordinary. **AT-139.**

**4.1.4 Activity filtering uses `activitySlug`, and says so when it cannot.** `Lot.activityType` is free text never constrained to canonical activities; `activitySlug` (`:556-568`) is the folded canonical value and is **nullable** — null means fold confidence `family` or `none`. The filter matches on `activitySlug`; lots with a null slug are reported in an **`unclassifiedLots`** count, same principle. **AT-139.**

**4.1.5 Set parity, not one example and not single-code isolation.** Rev 1's AT-119 asserted parity for `open_ncrs` alone; Rev 2 over-corrected into an impossible assertion (§4.1.1). **AT-119 is restated once more**: for every code in `HANDOVER_BLOCKING_REASON_CODES`, a fixture lot provoking it yields that code from **both** the lot-readiness endpoint and the closeout endpoint, and the two endpoints' emitted code **sets** are equal for that fixture. `[DR-B2]`'s closing sentence, taken literally but not impossibly.

### 4.2 Phase `D1a` — quality closeout readiness (S, no migration)

Renamed from "handover readiness" per `[DR-A1]`, everywhere including the UI. The name is the honesty fix: this is a **quality** verdict — conformance, tests, hold points, NCRs — and calling it "handover readiness" implies it covers the commercial and record dimensions it deliberately does not (§16.1 J1).

`GET /api/projects/:projectId/closeout-readiness` returns `HandoverReadinessVerdict[]` — one row per lot plus one aggregate at `subjectType: 'project'` — with `areaId` and `activitySlug` filters per §4.1.3–4.1.4 and the two escape counts.

**What it must not do:** not store a verdict (`[DH-B4]`); not add a code outside the derived union (§4.1.1); **not gate anything** — D1a is a view, and nothing in the system starts refusing an action because it says so.

**UI.** One project-level section listing blocked lots grouped by reason code, plus a per-lot line on the lot page. Uniform-card rules apply. No new navigation entry until a real user asks.

### 4.3 Phase `D1b.0` — the requirement profile, the content contract, the threat model, and the server-side renderer

The phase Rev 1 did not have and Rev 2 under-specified. No migration. Outputs: the `LoganPsp5RequirementProfile` and its resolvers (§2.3), a written content contract, a threat model, and a decided-and-benchmarked Node PDF path.

**4.3.1 The folio renders on the SERVER, and is a separate document — `[DR2-B4]`.**

Rev 2 made the folio a sixth mode of `conformanceReportPdf.ts`, rendered in the browser and uploaded. `[DR2-B4]` showed the upload boundary cannot be made safe by inspection: a malicious PDF can contain every value the server expects and still alter everything else, so a text-presence derivation check proves nothing about what the recipient reads. The review offered server rendering **or** complete canonical verification of all rendered content. **Complete verification of arbitrary rendered content is not a thing anyone ships.** So:

> **`[DH-i]` — folio bytes are produced by the backend, from the `FolioSnapshot`, and by nothing else. No route accepts folio bytes from any client. The folio is a separate backend document that shares no code with `frontend/src/lib/pdf/`.** *(Replaces `[DH-h]`, which made the folio a sixth `ConformanceFormat`.)*

This closes the doctored-bytes class **structurally**: there is no untrusted byte stream to check, so there is no check to get wrong, no fallback to quietly ship, and no J7. It is the only change in this revision that removes a threat rather than testing for it.

**Why a second renderer is cheaper than it sounds, and where it is not.** The instinct — *"you now maintain two PDF renderers"* — is worth taking seriously, and three facts defuse most of it:

- **The folio has no shipped layout to preserve.** Every argument for reusing `conformanceReportPdf.ts` was an argument about characterization debt on the five certificate formats. The folio is a **new document with no users, no golden fixtures and no signature block**. Sharing code with a 923-line jurisdictional file buys it nothing and couples it to a file the standing rule forbids refactoring (`docs/agent-handoff.md:516-517`).
- **It removes work rather than adding it.** Rev 2 needed the `sink` option, `JsPdfRecorder.output()`, a real-jsPDF byte test and per-format characterization **only** to get bytes out of the browser safely. All of it is deleted (§0.7). `conformanceReportPdf.ts` is now touched by **zero** Wave D lines — a stronger guarantee than Rev 2's, and one AT-122 can assert as a diff property.
- **`[DH-b]` is not violated, because `[DH-b]` was never about this.** `[DH-B2]` forbids **the archive worker** rendering folios — a background job emitting a document nobody reviewed. Folio issuance is a **human act on a human's screen**, synchronous with a user request. §8 restates `[DH-B2]` to say what it always meant.

**Where it is genuinely a cost, stated plainly:** one new backend dependency (§4.3.6), and PDF layout code now exists in two repositories-worth of context rather than one. That is the price of deleting the upload boundary, and Rev 3 judges it worth paying because the alternative is a legal record whose bytes arrive from the browser.

*ponytail: the laziest safe design here is the one with fewer moving parts, not fewer renderers — no sink, no recorder work, no extraction dependency, no derivation check, no fallback branch, no J7.*

**4.3.2 The content contract.** The folio renderer:

1. **Contains no certification language, by construction.** Not "strips" — the strings at `conformanceReportPdf.ts:78-102`, `:838`, `:850`, `:904-908` are in a file the folio renderer does not import. It renders the §2.5 wording verbatim and **no signature block**. **AT-137.**
2. **Carries expected → present → missing → not-assessable**, resolved by the **`LoganPsp5RequirementProfile`** (§2.3) — not read from a prose table. Every one of the seven pack items resolves through its own function, and the folio prints the resolver's verdict and its reason. "Three of five present, the other two named" is structurally possible for the first time, and **so is "CIVOS cannot yet assess this"**, which §2.3 shows is the honest answer for CCTV until D1d ships.
3. **Ships the Logan-18 crosswalk** (§2.3) — pulled into this phase from D1e, because item 2's resolver cannot name a missing category without it.
4. **Never promotes an unverified result.** Already true of the shipped certificate as of `#1658` (`conformanceReportPdf.ts:112-135`, `:367-385`); asserted independently for the folio renderer, which is a different file and therefore does not inherit it.
5. **States the §2.2 item-3 gap honestly.** A failed verified test with no linked NCR and no linkable retest prints *"failed — rectification not linked"* — never a silent omission, never an implied clean trail.
6. **Renders one format.** There is no folio format vocabulary. `FolioIssue.format` is `'folio'`, CHECK-constrained (`[DR2-B5]`, §7.1). Rev 1's DIT omission and Rev 2's six-value vocabulary are both moot.

**4.3.3 Server-controlled issuance — `[DR-B3]` and `[DR2-B3]`, closed.**

| Property | Mechanism |
| --- | --- |
| Server-created immutable source snapshot | `POST /api/lots/:id/folio/sessions` assembles the **entire** payload server-side in **one transaction** — replacing the browser's six independent reads (§3.3) — resolves the §2.3 profile against it, and writes `FolioSnapshot` (§7.3). |
| **Durably reserved issue id and version** | The same transaction writes a **`FolioIssueReservation`** row carrying `issueId`, `lotId`, `snapshotId`, the reserved `version`, the issuer and an `expiresAt`, under **unique `[lotId, version]`** (§7.2). `[DR2-B3]`: two concurrent sessions cannot reserve the same version, because the database refuses the second. The client never sees a choice. |
| Server-computed `compiledFrom` | Derived from the snapshot, never from a client. Carries a **schema version** and exact source row identity, with the **revision token named per source model** (§7.7) rather than assuming every model has a `version`. |
| **Server-rendered bytes** | The backend renders from the snapshot and writes to storage itself. **There is no `PUT /folios/:id/bytes`, no client bytes, no SHA to trust and no derivation check** (`[DR2-B4]`). **AT-143.** |

**Why the reservation is a row and not just a transaction.** Rendering and uploading are slow I/O; holding a database transaction open across an object-storage write is how a connection pool dies under load. The reservation row is the standard answer: reserve cheaply and durably, do the slow work outside the transaction, then insert the `FolioIssue` against the reservation and retire it. An expired reservation with no issue is swept (§10.5).

**4.3.4 The threat model.** Program §7 line 134 gated a threat model before **D2**. D2 is deleted, and the review is explicit that the gap was already shaping an unsafe boundary — so **the gate is pulled forward to `D1b.0`**, following the `wave-e0-threat-model-2026-07-28.md` pattern: a written artefact, merged before D1b code. Minimum coverage, updated for the server-render boundary: an authorized-but-malicious issuer; a **stale-snapshot race** (evidence changes between session creation and render); **reservation exhaustion** (a caller opening sessions to burn version numbers — hence `expiresAt` and rate limiting); cross-tenant session, snapshot and reservation ids; the storage-path guard; **resource exhaustion in the renderer**, which is new and real now that PDF generation runs in the API process (§4.3.6); and the **fail-closed production storage** requirement (`[DR-B8]`, §10.3).

**4.3.5 What is NOT built, and was in Rev 2.** The `sink` option, `JsPdfRecorder.output()`/Blob support, the real-jsPDF byte test, per-format folio characterization, the text-extraction dependency, the derivation check, and fallback option (ii). §0.7 lists them with their replacements. **Wave D modifies no file under `frontend/src/lib/pdf/`** — asserted by **AT-122**.

**4.3.6 The Node PDF path — named, and benchmarked before it is chosen.**

`backend/package.json` has **no PDF library of any kind** (verified at `84eac1a7`: zero matches for `jspdf`, `pdfkit`, `pdf-lib`, `puppeteer`, `playwright`, `canvas`), and `backend/src/lib/scheduledReports/pdf.ts:69` is a hand-rolled ASCII-only text writer that cannot carry a folio's tables. So this is a real new dependency and `D1b.0` picks it on evidence, the way `D1c.0` picks the ZIP writer.

**Candidates, and the axes that decide.** `jspdf` (the same engine the frontend already runs at `^4.2.1`, run in Node — familiarity, and no layout idioms to relearn), `pdfkit` (the boring, long-standing Node choice), `pdf-lib` (pure JS, strongest at document assembly). **Axes, in order:** runs in Node with **no native build step** — anything pulling `canvas` or a headless browser is rejected outright, because Railway image size and cold-start are real and a browser in the API process is a new attack surface the threat model would have to absorb; deterministic output under a fixed clock and fixed metadata, since **AT-127** hashes folio bytes; text and table layout adequate for the §4.3.2 contract; memory and wall-clock per folio; and installed footprint.

**Predeclared pass/fail, written before measuring** — the `[DR2-B6]` discipline applied here too, since this is the same failure shape:

| Threshold | Value | Why |
| --- | --- | --- |
| Render wall-clock, p95, reference lot | **< 1.5 s** server-side | §12 budgets 2 s for the whole session; the render is the largest limb. |
| Peak RSS delta per concurrent render | **< 96 MiB** | The API process serves everything else; a renderer that doubles baseline RSS is not selectable. |
| Native build step | **none** | Hard reject, not a score. |
| Byte-determinism | **identical bytes** across two renders of one snapshot under fixed clock + metadata | AT-127 is unimplementable otherwise. |
| Installed footprint | recorded, **no threshold** | Informational — it decides ties, not selection. |

**If no candidate passes, `D1b.0` fails and says so** rather than lowering a number. The fallback is not "render in the browser after all" — that is the boundary `[DR2-B4]` deleted — it is to re-scope the folio's layout to what a passing library can do. **AT-151.**

*ponytail: whichever wins, the folio renderer is one module with one entry point taking a `FolioSnapshot` and returning a Buffer. No format switch, no shared abstraction with the frontend, no plugin seam. It gains one the day a second server-rendered document exists.*

### 4.4 Phase `D1b` — the issued folio (M, two migrations)

With `D1b.0` merged, D1b is the small phase Rev 1 wanted it to be: wire the session route, wire the renderer to it, write the three tables, ship the UI.

**4.4.1 Getting the bytes — there is nothing to get.** Under `[DH-i]` the backend renders them. **`generateConformanceReportPDF` is not modified. No `sink` option exists. `frontend/src/lib/pdf/` is untouched by Wave D**, and `[DH-a]` is withdrawn along with the sink it governed (§0.7). Rev 2's `:922`-vs-`:888` citation problem disappears with the edit that needed it.

**AT-122 is restated as a diff property:** Wave D's merged changes contain **no modification to any file under `frontend/src/lib/pdf/`**, and the shipped pdfGenerator characterization suite passes **unmodified**. Rev 1 promised that and could not keep it (§0.9); Rev 2 withdrew it; Rev 3 can promise it because it stopped touching the file. That is the difference between a promise about behaviour and a promise about a diff — the second one CI can enforce.

**4.4.2 The issuance sequence, stated once and unambiguously.** Rev 2 gave two contradictory orderings — §4.3.3 allocating in the session transaction, §4.4.2 uploading before a version-allocating insert (`[DR2-B3]`). There is one:

1. **Session transaction.** Assemble the payload, resolve the §2.3 profile against it, insert `FolioSnapshot`, insert `FolioIssueReservation` with the next `version` for that lot under **unique `[lotId, version]`** (§7.2). Commit. A losing concurrent session takes a unique violation and retries with the next version; it never silently shares one.
2. **Outside any transaction.** Render the folio from the snapshot (§4.3.6), compute the SHA over the produced bytes, and write to `folios/{projectId}/{lotId}/{folioIssueId}.pdf` with `upsert: false` / `flag: 'wx'` (the pattern proven at `artifacts.ts:225-292`), through the `assertSafeStorageId` charset guard.
3. **Issue transaction.** Insert `FolioIssue` against the reservation; retire the reservation.

Rendering and uploading are slow I/O, which is exactly why the reservation is a durable row and not an open transaction — holding one across an object-storage write is how a connection pool dies under load. **Failure at step 2 or 3 leaves an orphaned object and an expired reservation; both are swept (§10.5), and the version they held is not reused** — a gap in a version sequence is harmless, reuse is not. **Failure is never partially visible: a `FolioIssue` row exists only once its bytes are durable.** **AT-146.**

**4.4.3 Versioning and immutability.** `FolioIssue` rows are append-only and **a database trigger rejects `UPDATE`** (§7.1), with `format` CHECK-constrained to `'folio'` (`[DR2-B5]`). `DELETE` only through §10.4.

**4.4.4 What D1b does not do.** No attachment embedding, no cover letter, no signature block (§2.5). Folio **content** is `D1b.0`'s contract; D1b is persistence and identity.

### 4.5 Phase `D1c.0` — the streaming and storage spike

The phase that stops D1c from being specified against arithmetic that does not work. No migration, no product surface. Output: a benchmark report and four decisions.

**4.5.1 What it must prove, on production-shaped fixtures — with the numbers written down first (`[DR2-B6]`).**

Rev 2 asked for "memory flat", "cancellation mid-write" and "event-loop behaviour" and gave no thresholds, which is a spike whose author grades their own homework. **Every threshold below is predeclared. A candidate that misses one is not selected; a spike that cannot meet any of them fails and says so rather than relaxing a row.**

| # | Fixture | Predeclared pass condition |
| --- | --- | --- |
| 1 | **>4 GiB archive** (single member >4 GiB **and** total >4 GiB, tested separately — they exercise different ZIP64 limbs) | Archive completes; **peak RSS delta ≤ 256 MiB** and **flat**, i.e. peak RSS at 8 GiB output is within **±15%** of peak RSS at 1 GiB output. "Flat" was Rev 2's word; this is the measurement of it. |
| 2 | **50,000-member archive** | Completes; peak RSS delta ≤ 256 MiB; **central directory correct** — every member listed, offsets valid. |
| 3 | **Event loop under load** | **Maximum single-tick stall ≤ 50 ms**, p99 ≤ 20 ms, measured continuously for the whole run. The API process serves user traffic during archive jobs; a 500 ms stall is a user-visible outage. |
| 4 | **Cancellation mid-write** | Cancellation observed within **≤ 5 s**; **all partial objects and temp files removed within ≤ 30 s**; no orphaned handle, no partial object left addressable. |
| 5 | **Integrity** | Archive opens in **Windows Explorer, macOS Archive Utility and `unzip`**; every member's extracted SHA-256 equals its recorded `sourceChecksum`; **zero** mismatches — not a rate. |
| 6 | **Resume after process kill** | Kill mid-archive, restart: the job resumes from the frozen ledger (§4.6.3), completes, and its final archive is **byte-identical** to an uninterrupted run over the same frozen members (`manifest-summary.json` excluded, §4.7.2). |

Anything that fails a fixture is not selected. **If nothing passes, `D1c.0`'s output is "no candidate passes" and D1c is re-scoped** — split archives, an object-tree package, or a lower cap. That is a legitimate spike outcome and it is named here so it does not read as failure on the day it happens.

**4.5.2 The writer decision (`[DR-A4]`).** `J4`'s "`fflate`, zero transitive dependencies" is **withdrawn as a recommendation** — zero deps is not the deciding axis. The axes are **ZIP64 support**, Node stream backpressure, large-member support, event-loop behaviour, and whether it composes with a resumable upload. Benchmark `fflate`, `archiver`, `yazl` and a Web Streams/ZIP64 option. Note against `fflate` specifically: it advertises support only up to 4 GB files, so it is **not proven** for the proposed cap. **A hand-rolled ZIP container remains rejected** — CRC-32, local headers, central directory, UTF-8 flags and ZIP64 in a path where a corrupt archive is a corrupt legal record.

**4.5.3 The cap formula (`[DR-A3]`).** "Order 5 GB" is replaced by:

```
effective_cap = min(product_cap,
                    bucket_limit,
                    upload_protocol_limit,
                    zip_writer_member_limit,
                    service_resource_limit)
```

with, decided here rather than left implicit: **binary units** (GiB) throughout; **unknown-size members** (§4.5.4) counted at a declared conservative estimate and the estimate's uncertainty surfaced in the preflight; and an explicit **member-count limit**.

**The input/output split — `[DR2-B6]`.** Rev 2 applied this cap to **output bytes** at **preflight**, which cannot work: a preflight sums *source* sizes and has no idea what the ZIP will compress to. Two caps, two places:

| Cap | Where | Measured on | Behaviour |
| --- | --- | --- | --- |
| **Admission cap** | Preflight, before the job is queued | **Estimated input bytes** — summed source sizes plus §4.5.4's conservative estimate for the unmeasured set | **Refuses** with the estimate, the unmeasured-member count and the assumption used. Never truncates. **AT-130.** |
| **Hard output cap** | Streaming, during the write | **Actual output bytes**, counted as they are produced | **Aborts** the job and removes the partial object. A job that passes admission and still exceeds the output cap is a **failed job with a stated reason**, not a truncated archive. |

The admission cap is set **below** the output cap by a declared compression-headroom margin, chosen in `D1c.0` from the measured input→output ratio on fixture 2 (evidence photos and PDFs compress poorly; the margin should be small and honest, not optimistic). Supabase standard upload tops out at 5 GB and recommends TUS above 6 MB; TUS/S3 paths reach 50 GB. **The 50 GB reference exit gate and a 5 GB first-release cap are mutually exclusive** — `D1c.0` decides between raising the cap onto a TUS/S3 path, split archives, or an object-tree package, and **§15's exit gate is amended to whichever it picks.**

**4.5.4 The preflight cannot measure everything, and must say so.** `HoldPoint.releaseSignatureUrl` and `evidencePackageUrl` are bare strings with no stored size (`schema.prisma:777-779`), and `Document` has no checksum. A counts-and-sums preflight is therefore an **estimate with a named unmeasured set**, not a measurement. The UI states the estimate, the count of unmeasured members, and the assumption used. `[DR-B6]`.

**4.5.5 `BigInt`, everywhere.** `fileSize Int` caps at 2,147,483,647 bytes on Postgres. Every byte count in `HandoverExport` and `HandoverExportMember` is `BigInt` (§7).

**4.5.6 The cost ceiling is declared BEFORE the measurement — `[DR2-B6]`.**

Program §8 line 145 requires the cost measured; Rev 1 gave no pass/fail; **Rev 2 gave a ceiling to be "stated" by `D1c.0` — i.e. chosen by the same people, after they saw the number.** That is not a gate. A ceiling set after measurement is a ceiling that always passes, and this is the single most expensive thing the product will do (§18.3 item 6).

> **The ceiling is written into this specification, now, before anyone has measured anything: a full-project archive on the program's reference dataset (§12: 5,000 lots, 50 GB evidence) must cost CIVOS ≤ AUD 12.00 ex-GST all-in for one generation plus three downloads within the retention window.**
>
> **`D1c.0` measures against that number. It does not get to choose it.** Above the ceiling, the feature does not ship at that cap — the fix is a lower cap, a cheaper delivery path, or a priced add-on, and each of those is a **Jay decision**, not an engineering one. **Only Jay may move this number, and moving it is recorded in §16 as a decision with a date — never edited in place.**

**How it is measured.** Bytes per leg — original reads, archive upload, storage duration across the retention window, first download, repeat downloads — plus Railway CPU/RSS and egress. **Railway bills service egress including uploads to object storage**, so a backend-mediated archive is at minimum a read leg, an upload leg and a download leg, and the naive "one transfer" mental model understates it by roughly 3×. The measurement records each leg separately so a future cheaper path can be evaluated against the same breakdown. **AT-150.**

### 4.6 Phase `D1c.1` — the frozen-member ledger and the job schema

One migration: `HandoverExport` + **`HandoverExportMember`** + **`ArtifactLegalHold`** (§7.4–7.6). No worker yet.

**4.6.1 Frozen members (`[DR-B7]`).** Rev 1's archive was "reproducible from immutable inputs" while selecting mutable, supersedable documents. `HandoverExportMember` rows freeze, at snapshot time: exact `FolioIssue`/`Document` id, **version**, storage locator, byte size (`BigInt`), source checksum, member state, and archive path. **If a folio is reissued mid-archive, the archive continues from its frozen snapshot and records the cutoff.** It never switches versions halfway through.

**4.6.2 Lease, fencing and heartbeat — fenced in storage, not only in the database (`[DR-B5]`, `[DR2-B7]`).**

`HandoverExport` carries `leaseOwner`, `leaseToken` (fencing), `leaseExpiresAt` and `heartbeatAt`. A worker renews its lease on a heartbeat interval, and **every state write is conditional on the fencing token**.

**Rev 2 then claimed a fenced worker "cannot upload", and `[DR2-B7]` is right that no database predicate can enforce that.** A stale worker holds an open HTTP connection to object storage; a conditional `UPDATE` in Postgres cannot un-send those bytes. Rev 2 asserted an invariant across a boundary it does not control, and AT-135 asked CI to prove it.

> **The fix is to make the stale upload harmless rather than impossible.** Workers do not write to a canonical archive key. Each writes to a **lease-token-specific key** — `handover-exports/{projectId}/{exportId}/{leaseToken}.zip` — so two workers physically cannot collide. Publication is a separate, cheap, atomic step: a **compare-and-swap on the export row** setting `fileUrl`, `sha256`, `fileSize` and `status='complete'` **only if `leaseToken` still equals the publishing worker's token**. A superseded worker's object is written, is **unreachable** — nothing points at it — and is removed by the sweeper (§10.5) alongside expired artefacts.

So the honest invariant, and the one **AT-135** now asserts: **a fenced-out worker cannot *publish*, cannot *finalize* and cannot *cancel*.** It may well finish uploading, and that is fine, because nothing can reach what it uploaded. Cancellation is fenced by the same CAS.

*ponytail: uniquely-keyed writes plus one compare-and-swap is the standard answer, and it is smaller than any scheme that tries to abort an in-flight upload. Storage costs a sweep; correctness costs nothing.*

**4.6.3 Restart semantics, stated exactly.** The honest default: **ZIP assembly restarts from the frozen member ledger**; completed member checksums are reused, no bytes are re-read that already verified, and the ZIP itself is rebuilt. Resumable multipart chunk state is persisted **only if `D1c.0` selects an upload path that supports it**, in which case the exact chunk/multipart state lives on the export row. **What is not permitted is Rev 1's implication that `processedLots` alone constitutes resume.**

### 4.7 Phase `D1c.2` — the worker, the manifest, the download, the UI

**4.7.1 `[DH-B2]` — the archive collects; it never renders.** A lot with no issued folio is written into the manifest as `folio: none` — a fact — and contributes its originals only. The UI shows "12 of 40 lots have no issued folio" before the job starts and offers to take the user to issue them, which is a human act on a human's screen. `[DH-b]` stands: no jsPDF in Node, because that needs the generator in a shared package, which is the refactor the standing rule forbids, and because it would let a background job emit a document nobody reviewed. *ponytail: collect-only; if pilots show progressive issuance is not happening, the fix is a nag, not a renderer.*

**4.7.2 The manifest.** `manifest.csv` (opens in Excel — that is what "searchable" means to the person who receives it) and `manifest.json`, same content, at archive root. One row per member: archive path, SHA-256, byte size, source record type and **id and version**, lot number, document type, original filename, uploaded-at, uploaded-by. Plus `manifest-summary.json` carrying scope, generated-at, generated-by, CIVOS version, per-lot folio status, the frozen-snapshot cutoff, and `omissions[]`. **`manifest-summary.json` is excluded from the determinism assertion** because it carries generated-at (`[DR-A9]`).

**4.7.3 Determinism, and the chainage filename rule.** Archive paths are `{lotNumber}/{category}/{sanitized-filename}`, lots ordered by `lotNumber` ascending with the comparator the reports already use (`scheduledReports/reportDocument.ts:107`), categories in a fixed declared order, files within a category by `uploadedAt` then id, collisions suffixed ` (2)` by that same order.

**From §2.2 item 5, with the format pinned per `[DR2-A1]`:** for photo-category members on a lot with a chainage, the sanitized filename is prefixed with the lot's chainage reference. Logan requires *"a chainage or exact location reference in the filename"*, and this is where that requirement is satisfied — a naming rule over `Lot.chainageStart`/`chainageEnd` (`schema.prisma:551-552`), **not** a column on `Document` (`[DH-e]`).

Rev 2 said "the chainage reference" and left the format to the implementer, which AT-140 cannot assert. **The exact format:**

```
CH{start}-{end}_{sanitized-filename}      e.g. CH1250-1310_pipe-bedding-north.jpg
CH{start}_{sanitized-filename}            when chainageStart == chainageEnd
{lotNumber}_{sanitized-filename}          when either chainage is null
```

`{start}` and `{end}` are the `Decimal` metres **rounded half-up to the nearest whole metre and rendered without separators or a decimal point** — `1250`, not `1,250.00`. Chainages are stored as `Decimal?`, so the rounding rule is stated rather than left to whatever the driver returns.

**Ordering is load-bearing and is fixed here: sanitize first, then prefix, then resolve collisions.** Sanitising after prefixing could mangle the prefix; resolving collisions before prefixing could produce two different suffixes for names that only collide once prefixed. Collisions are suffixed ` (2)` in the §4.7.3 order, **after** the prefix is applied. Where the lot has no chainage the rule falls back to the lot number **and `manifest.csv`/`manifest.json` record which rule applied**, per member. **AT-140.**

**4.7.4 Delivery, streamed.** `sendScheduledReportArtifactFile:380-395` buffers whole files into memory — defensible at 200 KB, an outage at 2 GB. D1c.2 writes its own **streamed**, ownership-checked, SHA-verified download path. `[DH-g]`: the scheduled-report path is left alone, not refactored.

**4.7.5 Progress.** `processedMembers / totalMembers` on the export row, polled. **No percent-complete streaming channel** — none exists in the codebase and a ZIP job does not justify inventing one.

### 4.8 Phase `D1d` — CCTV **and concealed-works capability**, Scope A (S, no migration)

D.0-Q3 answered the scoping question at grade A: Logan specifies CCTV as **video files with named container formats** (§5.7.1(1)(a)) and Unitywater's deliverable is a digital-plus-hardcopy file set. WSA 05 Appendix A5 *does* define a per-observation XML, but **no Australian authority was found mandating that file by name**, and producing a conforming coded record is the specialist CCTV subcontractor's job in WinCan or PipeTech. The head contractor's obligation is **custody, completeness and timely submission**. That finding stands, and **Scope B remains deleted**, not deferred — it was a D2 dependency and D2 is gone.

**What `[DR2-B1]` changed: Rev 2's Scope A was not a capability.** Rev 2 sized this XS — *"a `documentType` value, a lot association, a manifest category"* — and scored pack item 4 as unblocked. **The shipped upload path rejects the deliverable twice** (§2.2 item 4): `ALLOWED_DOCUMENT_MIME_TYPES` (`documents/fileHelpers.ts:35-47`) has **no video type at all**, and multer caps every document at **50 MB** (`documents.ts:278`) against a routinely gigabyte-scale CCTV run. A `documentType` value for a file that cannot be uploaded is a dropdown entry, not a feature.

**Scope A, corrected — four things:**

1. **A video MIME allowance.** The Logan-named containers (*"WINCAM (version 7 or later) or CCTV footage or DVD-ROM … or MPEG 4"*) reduce in practice to `video/mp4` plus a small named set. **Added as a separate allow-set, not by widening `ALLOWED_DOCUMENT_MIME_TYPES`** — that set governs every document upload in the product, and video belongs only on the surfaces that expect it. **AT-149.**
2. **A separately-governed size ceiling** for that surface, well above 50 MB, declared as a number and enforced independently of the 50 MB document limit. It interacts with §4.5.3's admission cap — a project of CCTV runs is exactly the shape that hits it — so the ceiling is chosen with that arithmetic in front of whoever picks it.
3. **A pre-backfill concealed-works `documentType`** (§2.2 item 5). Same root problem as CCTV: the schema cannot tell what a photo depicts, so the §2.3 resolver cannot distinguish "no concealed-works photos" from "photos present, none classified". One classification value fixes it; **no `Document` column is added** (`[DH-e]`).
4. **Manifest categories** for both, and lot association as Rev 2 specified.

Logan's run-endpoint requirement (*"first drainage maintenance hole upstream and downstream"*) stays **guidance text on the upload surface**, not a data model. *ponytail: an allow-set, a number and two string values. Structured CCTV observation records remain out of scope and always were — the specialist's software owns them.*

### 4.9 `D1e` — multi-authority configurability: named, scoped to one thing, and not built

`[DH-d]`'s flip condition was *"D.0 supplies a real receiving-authority requirement list to configure against."* **It did** (§2). The deferral therefore changed character in Rev 2: no longer blocked, merely unprioritised. **`[DR2-B1]` then took two of its three pieces away.**

| Rev 2 put in D1e | Rev 3 |
| --- | --- |
| The Logan-18 test-category crosswalk | **Moved into `D1b.0`** (§2.3). Item 2's resolver cannot name a missing category without it, and the folio is the whole product. |
| A per-authority pack profile | **The Logan profile is built in `D1b.0`** (§2.3), versioned, as one concrete profile. D1e is the **second** one plus the machinery to choose. |
| `ExceptionOrWaiver` | **Still declined**, in D1 and in D1e. Nobody has asked for it. |

> **So D1e is exactly one thing: a second `LoganPsp5RequirementProfile`-shaped profile for a second authority, and the surface to select between them.** `profileVersion` and the resolver dispatch built in `D1b.0` are the seam it plugs into — which is why D1e stays cheap without anything being built for it now.

**It is not in D1**, and the reason is stronger than Rev 1's "no evidence": we have the evidence, we built the concrete thing, and a configuration UI before one pilot has issued one folio against the one profile we have is scaffolding for later. `f0-execution-spec-2026-07-24.md:23` and `:35` parked "new evidence-link tables" and `ExceptionOrWaiver` on D1; **D1 declines both.** `[DH-d]`'s flip condition is restated in §16.2 to match: **someone asks for a second authority's pack**, which is a customer event, not a roadmap slot.

### 4.10 What does not change, in any phase

- `Lot.status` and its Zod vocabulary. No `handover` status. `[DH-B4]`.
- The conform gate (`qualityRoutes.ts:411`, `:488`) and the claim gate. **D1 blocks nothing new.**
- The five existing conformance formats' output — and, under `[DH-i]`, **their source too**: Wave D modifies no file under `frontend/src/lib/pdf/`, and the other seven generators are untouched entirely. **AT-122.**
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
| 7. Preserve the surveyor/RPEQ certification boundary (90) | **SURVIVES as `[DH-B3]`**, now with grade-A backing that the boundary is real and signed by **named parties**: dual sign-off, RPEQ plus Registered Surveyor, with **no contractor signature block**. Rockhampton stamps the principal contractor's **name** on the As Constructed stamp — named on the document, not a signatory. That distinction is exactly §2.5's. |
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

## 7. Data model and migrations — **six tables, one trigger and one CHECK**

All additive. No column is added to, or altered on, any existing table **except one**: `EvidenceReadinessItem.code` narrows from `string` to `ReadinessReasonCode` (§4.1.1), which is a **TypeScript** narrowing on a non-persisted shape, not a schema change. Reviewed Prisma migrations only. **No `db push`, ever.** Rev 1's headline said "one new table and one new column on an existing table"; that was wrong in its own document (`[DR-A9]`), and Rev 2's "four tables" was overtaken by `[DR2-B3]` and `[DR2-B5]`.

**No Prisma enums** — the schema has none anywhere; status vocabularies stay Zod-validated at the route, with the one exception below where a **database `CHECK`** is used because `[DR2-B5]` requires the constraint to survive a route bypass.

### 7.1 Migration 1 (D1b) — `FolioIssue`, with an UPDATE trigger and a format CHECK

Fields: `id`, `projectId`, `lotId`, `snapshotId`, `reservationId`, `version Int`, **`format String`**, `fileUrl`, `fileSize BigInt`, `sha256 String`, `issuedById`, `issuedAt`, `compiledFrom Json` (**schema-versioned, carrying exact source row identity per §7.7**), `lotStatusAtIssue String`, `conformedAtIssue DateTime?`. Unique `[lotId, version]`. Index `[projectId, issuedAt]`. **The Rev 1 `[lotId, version]` index is dropped as redundant** — the unique constraint already indexes it (`[DR-B7]`).

**`derivationCheck Json?` is deleted** — there is no client upload to check (`[DR2-B4]`, §0.7).

**`format` is `'folio'`, and the database enforces it — `[DR2-B5]`.** Rev 2 gave this column the full six-value shipped vocabulary even though only the folio path writes it, which is a structural invitation to persist an authority-certificate format on an artefact that carries no certification. The migration ships **`CHECK (format = 'folio')`** alongside route-level Zod validation. Two guards deliberately: the route stops the honest mistake, the CHECK stops the one that bypasses the route. *ponytail: a one-value column with a CHECK is smaller than a vocabulary nobody may use — and it stays a column so a second server-rendered document is additive.* **AT-147.**

**The trigger is the invariant.** Absence of `updatedAt` prevents nothing — not Prisma `update`, not raw `UPDATE`. The migration ships a **database trigger that rejects `UPDATE` on `folio_issues`**. `[DH-B1]` becomes a database property. **AT-141.**

`DELETE` is permitted **only** through the one authorized procedure (§10.4).

### 7.2 Migration 1 (D1b) — `FolioIssueReservation` — new in Rev 3, `[DR2-B3]`

The durable binding Rev 2 asserted in prose and persisted nowhere. Fields, **exactly as `[DR2-B3]` prescribes**: `issueId` (the preallocated `FolioIssue` UUID; primary key), `lotId`, `snapshotId`, **`version Int`** (the reserved version), `reservedById` (the issuer), `reservedAt`, **`expiresAt DateTime`**. Plus `projectId` for the §10.1 tenancy guard.

**Unique `[lotId, version]`** — this is the whole point. Two concurrent sessions cannot reserve the same version because the second insert fails; it retries with the next. Rev 2's "serializable/version-allocating transaction" described the intent without giving the database anything to enforce.

Index `[expiresAt]` for the sweeper. A reservation whose `FolioIssue` never lands expires and is swept with its orphaned object (§4.4.2, §10.5); **its version number is retired, not recycled.** **AT-146.**

### 7.3 Migration 1 (D1b) — `FolioSnapshot`

The immutable source snapshot (`[DR-B3]`). Fields: `id`, `projectId`, `lotId`, `createdById`, `createdAt`, `payload Json` (the full server-assembled payload including the frozen branding, §2.5, **and the resolved §2.3 profile verdicts**), `payloadSchemaVersion Int`, `profileVersion String` (§2.3), `sourceRowRefs Json` (§7.7), `expiresAt DateTime?`. Index `[lotId, createdAt]`. Same UPDATE trigger. A snapshot with no folio issued against it before `expiresAt` is swept (§10.5).

### 7.4 Migration 2 (D1c.1) — `HandoverExport`

Fields: `id`, `projectId`, `scope Json` (`{kind:'project'|'area'|'lots', areaId?, lotIds?}`), `status String` (`queued|snapshotting|processing|complete|failed|cancelled`), `requestedById`, `requestedAt`, **`leaseOwner String?`, `leaseToken String?`, `leaseExpiresAt DateTime?`, `heartbeatAt DateTime?`** (`[DR-B5]`), `nextAttemptAt DateTime?`, `failureCount Int @default(0)`, `lastFailureReason String?`, `snapshotCutoffAt DateTime?`, `totalMembers Int?`, `processedMembers Int @default(0)`, **`totalBytes BigInt?`, `fileSize BigInt?`** (`[DR-B6]`), `fileUrl String?`, `sha256 String?`, `uploadState Json?` (multipart/TUS state, only if `D1c.0` selects a resumable path), `manifestSummary Json?`, `completedAt DateTime?`, and **`expiresAt DateTime?`** — new in Rev 3.

**`expiresAt` — `[DR2-B5]`.** §10.5 promised export artefacts a TTL and Rev 2 gave the table no field to hold it, so the policy had nothing to run against. `expiresAt` is set at completion from the project's retention setting; the sweeper reads it. When the artefact is swept the **row survives** with its metadata and a null `fileUrl` — a handover export that was generated and has expired is a fact worth keeping. **AT-148.**

Indexes `[projectId, requestedAt]`, `[status, leaseExpiresAt]`, `[expiresAt]`.

### 7.5 Migration 2 (D1c.1) — `HandoverExportMember`

The frozen ledger (`[DR-B7]`). Fields: `id`, `exportId`, `sourceType String` (`folio|document|holdpoint_signature|holdpoint_evidence|itp_attachment|ncr_evidence`), `sourceId`, **`sourceRevision String?`** (the §7.7 token, stringified — **renamed from Rev 2's `sourceVersion Int?`**, which assumed every source model has an integer version and `[DR2-B3]` showed several do not), `storageLocator String`, `archivePath String`, `byteSize BigInt?` (**nullable — §4.5.4's unmeasured set**), `sourceChecksum String?`, `state String` (`pending|verified|written|omitted`), `omissionReason String?`, `orderKey String`. Unique `[exportId, archivePath]`. Index `[exportId, state]`.

### 7.6 Migration 2 (D1c.1) — `ArtifactLegalHold` — new in Rev 3, `[DR2-B5]`

§10.5 required legal hold and Rev 2 gave it no home. **`[DR2-B5]` is right that the naive fix is self-contradictory:** a mutable `onLegalHold` boolean on `FolioIssue` would be an `UPDATE` on a table whose trigger rejects `UPDATE` (§7.1). Hold state cannot live on the immutable row.

**Append-only, in its own table.** Fields: `id`, `projectId`, `artifactType String` (`folio_issue|handover_export`), `artifactId`, `action String` (`placed|released`), `reason String`, `actorId`, `createdAt`. Index `[artifactType, artifactId, createdAt]`.

**An artefact is on hold when its most recent row is `placed`.** No update, no delete, no boolean — a hold and its release are both events, and the sequence is the record. That is also the only shape that survives being asked *"who put this on hold, when, and why"* two years later, which is the question a legal hold exists to answer. The sweeper (§10.5) and §10.4's deletion procedure both consult it and **refuse** while a hold stands. **AT-148.**

### 7.7 Revision tokens — defined per model, `[DR2-B3]`

Rev 2 specified `compiledFrom` and `HandoverExportMember` as carrying *"exact source row ids and versions"*. **`[DR2-B3]` verified that several source models have no version to carry**, and `ITPCompletion` (`schema.prisma:712-743`, read in full at `84eac1a7`) has **neither `version` nor `updatedAt`** — so Rev 2's contract was unimplementable for the single most important evidence type in a folio.

**Each source type declares its revision token explicitly.** The token is stored as a string in `sourceRowRefs` and `HandoverExportMember.sourceRevision`, always prefixed with its kind so a reader never has to guess:

| Source model | Token | Form | Why |
| --- | --- | --- | --- |
| `Document` | **`version`** | `v:{n}` | Has real version tracking — `version`, `parentDocumentId`, `isLatestVersion` (`schema.prisma:1618-1620`). |
| `FolioIssue` | **`version`** | `v:{n}` | Append-only by trigger; the version *is* the identity. |
| `NCR` | **`updatedAt`** | `t:{iso8601}` | Mutable through its lifecycle; timestamp is the available discriminator. |
| `TestResult` | **`updatedAt`** | `t:{iso8601}` | Same. |
| **`ITPCompletion`** | **canonical row digest** | `d:{sha256}` | **Has neither.** A SHA-256 over a canonically-serialised, explicitly-listed field subset — `status`, `completedAt`, `verificationStatus`, `verifiedAt`, `notes`, `signatureUrl`, and the attachment id set. The field list is **versioned alongside `payloadSchemaVersion`**, because a digest whose input set changes silently is worse than no digest. |
| `HoldPoint` | **canonical row digest** | `d:{sha256}` | Same reason; its file pointers are bare strings with no size or checksum (`schema.prisma:777-779`, §4.5.4). |

**Adding a source type without declaring its token is a compile error**, via a `Record<SourceType, RevisionTokenKind>` that the resolver switches on exhaustively. **AT-146.**

*ponytail: three token kinds, chosen per table from what the table actually has. A synthetic version column on six models is a migration, a backfill and six write-path changes to produce information two of them already carry.*

### 7.8 Explicitly not created

`Asset` or anything asset-shaped (§5, permanent); `ExceptionOrWaiver` (§4.9); any evidence-link table (`f0-execution-spec-2026-07-24.md:23` parked it here and D1 declines it); **a checksum or chainage column on `Document`** (`[DH-e]`; §4.7.3 derives chainage from the lot).

### 7.9 Rollback

All six tables are additive and unreferenced by existing code paths. Rollback = drop the trigger, drop the CHECK, drop the tables, revert the flag. No data migration, no backfill, nothing to un-write. The one non-table change — narrowing `EvidenceReadinessItem.code` (§4.1.1) — is a TypeScript-only revert.

---

## 8. Invariants

| Tag | Invariant | Asserted by |
| --- | --- | --- |
| `[DH-B1]` | A folio is a compilation, never an assertion; an issued folio is never altered; an omission is never silent. | AT-121, AT-127, AT-129, **AT-141** (the trigger) |
| `[DH-B2]` | **The bulk archive collects issued folios; the archive worker never renders one.** *(Restated in Rev 3 to say what it always meant. The prohibition is on a **background job** emitting a document nobody reviewed — not on server-side rendering as such, which `[DH-i]` now requires for interactive, user-initiated issuance.)* | AT-126 |
| **`[DH-i]`** | **Folio bytes are produced by the backend from the `FolioSnapshot` and by nothing else. No route accepts folio bytes from any client, and Wave D modifies no file under `frontend/src/lib/pdf/`.** | **AT-122**, **AT-143** |
| `[DH-B3]` | **Wave D outputs never present CIVOS-derived map geometry as surveyed or as-constructed geometry. Any re-emitted coordinate carries its provenance.** *(Reworded per `[DR-A8]`; the absolute Rev 1 form was already false for the shipped map.)* | AT-131 |
| `[DH-B4]` | Closeout readiness is computed, never stored; no `handover` lot status exists. | AT-120 |
| `[DH-B5]` | One verdict everywhere — **`HANDOVER_BLOCKING_REASON_CODES` is runtime data, a declared subset of the shipped `READINESS_REASON_CODES`, asserted equal to the codes the emitters actually produce as blockers.** Never a hand-listed `Extract<>`, never a second vocabulary. *(Rev 2 stated this as a set equation over a TypeScript type, which nothing can evaluate — `[DR2-B2]`.)* | **AT-119 (restated, set membership)**, **AT-138** |
| `[DH-B6]` | No archive, folio or manifest ever contains — **or names, ids, or otherwise discloses** — a record the requesting user could not read. Unauthorized exclusions appear as an **aggregate count only**. *(Rev 1's version contradicted itself; `[DR-B8]`.)* | AT-132, **AT-133 (rewritten)** |
| `[DH-B7]` | Commercial values are redacted for non-commercial roles, exactly as `filterCommercialReadiness` (`evidenceReadiness.ts:458`) already does. | AT-134 |
| **`[DH-B8]`** | **CIVOS never claims to submit to, be accepted by, or certify for a receiving authority, and never presents itself or the contractor as the certifying party. The asset-evidence linkage is never implied to be exported.** | **AT-136**, **AT-137** |

---

## 9. API and UI surface

**Backend**
- `GET /api/projects/:projectId/closeout-readiness` — D1a. Optional `areaId`, `activitySlug`. Returns lot verdicts, the project aggregate, `unplacedLots` and `unclassifiedLots`.
- `POST /api/lots/:id/folio/sessions` — D1b. **Server** assembles the payload, resolves the §2.3 profile, stores the `FolioSnapshot`, and writes a `FolioIssueReservation` reserving the id and version (§7.2). Rate-limited — reservations consume version numbers, so an unlimited caller is a version-exhaustion vector (§4.3.4).
- `POST /api/folios/:folioIssueId/issue` — D1b. **The server renders the folio from its snapshot** (§4.3.6), writes the bytes, computes the SHA over what it produced, and inserts `FolioIssue` against the reservation (§4.4.2). **Takes no body containing document content of any kind.**
- **There is no `PUT /api/folios/:id/bytes`, and no route anywhere accepts folio bytes** — `[DH-i]`, `[DR2-B4]`. **AT-143** asserts its absence rather than its correctness.
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
| **Retention** | Export artefacts carry a **TTL**, default conservative, configurable per project; expired artefacts are deleted by a sweeper and the `HandoverExport` row retains the metadata record. The TTL is held in **`HandoverExport.expiresAt`** (§7.4, `[DR2-B5]`) — Rev 2 stated this policy against a table with no field to hold it. **`FolioIssue` rows and bytes are NOT swept** — a folio is the record. `FolioSnapshot` rows and `FolioIssueReservation` rows with no issued folio expire (§7.2, §7.3), as do orphaned objects from a failed issuance (§4.4.2) and superseded lease-keyed archive objects (§4.6.2). |
| **The sweeper does not exist yet** | `dataRetentionWorker.ts` handles **no artefacts at all** at this SHA (grep for `artifact` returns nothing). D1c.2 either extends it or ships its own; **it may not assume one exists.** |
| **Legal hold** | An export or folio under hold is exempt from the sweeper and from §10.4's procedure until released. **Hold state lives in the append-only `ArtifactLegalHold` table (§7.6), not as a flag** — Rev 2 said "an explicit flag, not a convention" and gave it no field, and `[DR2-B5]` showed a flag on `FolioIssue` would have contradicted §7.1's UPDATE-rejecting trigger. An artefact is on hold when its latest row is `placed`. Both the sweeper and §10.4 consult it and **refuse** while a hold stands. **AT-148.** |
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
5. **No server-side re-render of any of the eight shipped jsPDF documents, and no rendering of anything by the archive worker.** `[DH-B2]`. **Amended in Rev 3:** the *folio* is server-rendered by design (`[DH-i]`, §4.3.1) — it is a **new** document, not one of the eight, it shares no code with them, and it is rendered synchronously for a human who asked for it. What stays forbidden is porting a shipped generator to Node, and any background job emitting a document nobody reviewed.
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
| Folio session creation: **p95 < 2 s** | Server-side assembly plus profile resolution plus the reservation write (§4.3.3), replacing six browser round-trips. It should be faster than today, and if it is not that is a finding. |
| **Folio render, server-side: p95 < 1.5 s** | Predeclared in §4.3.6 as a **library-selection threshold**, not just a budget — a candidate that misses it is not selectable. |
| Folio issue end-to-end: **p95 < 8 s** on a mid-tier device over 4G | Held at Rev 2's number. The flow lost the client render and the derivation check and gained a server render and a reservation write; the total is roughly unchanged, and 8 s stays the honest ceiling rather than being tightened on an untested guess. |
| **Renderer peak RSS delta: < 96 MiB per concurrent render** | New in Rev 3. PDF generation now runs **in the API process**, which serves everything else. §4.3.6, §4.3.4. |
| Archive preflight: **p95 < 3 s** | Counts and sums, **plus a named unmeasured set** (§4.5.4). |
| Archive job | No wall-clock target. **Must not block the event loop; memory must be flat with respect to archive size.** Proven in `D1c.0`, not asserted here. |
| Archive download | Streamed, constant memory. The shipped buffer-and-send is explicitly not reused. |
| **Cost per archive on the reference dataset** | Measured **with a pass/fail ceiling** in `D1c.0` (§4.5.6), per program §8 line 145. Rev 1 required the measurement and set no threshold, which is a measurement nobody can fail. |

---

## 13. Rollback

- **D1a-respec:** types and tests only. Revert. The `EvidenceReadinessItem.code` narrowing (§4.1.1) reverts with it — it is a type, not a column.
- **D1a:** flag off. Nothing persisted.
- **D1b.0:** docs artefacts (threat model, benchmark report), the requirement profile and its resolvers, and one new backend dependency. Revert; **the dependency is removed with it**, since nothing else imports it until D1b.
- **D1b:** flag off hides issue + download. Rows and objects remain, removed only by §10.4. Full rollback = revert, drop trigger, drop the `format` CHECK, drop the three tables.
- **D1c.0:** a benchmark report. Nothing to roll back.
- **D1c.1:** three additive tables, drop to revert.
- **D1c.2:** flag off hides the screen; the worker is separately env-gated (the `SCHEDULED_REPORT_WORKER_ENABLED` pattern) so it can be stopped without a deploy. In-flight jobs are reclaimed on lease expiry; if the worker stays off they sit `queued`, which is visible rather than lost. **Partial archives are never stored** — written once, complete, `flag: 'wx'`.
- **D1d:** a MIME allow-set, a size ceiling and two `documentType` values. Revert. **Files already uploaded under the widened allow-set remain**, and are unreadable by no one — a revert removes the ability to add more, not the ability to read existing ones.

---

## 14. Acceptance tests

AT-119…AT-143 carried from Rev 1 and Rev 2 where the assertion survives; **entries restated in Rev 3 are marked `(Rev 3)`** with the reason; **AT-144 onward is new**. `[DR2-A1]` reviewed every AT for assertability and its verdicts are folded here: **AT-122, 137, 139 and 141 were already assertable and are unchanged in substance; AT-135, 138 and 143 were not and are restated; AT-136, 140 and 142 needed scoping, an exact format, and a kind correction respectively.**

| # | Phase | Assertion | Kind |
| --- | --- | --- | --- |
| **AT-119** *(Rev 3)* | D1a | **Set parity `[DH-B5]`.** For every code in `HANDOVER_BLOCKING_REASON_CODES`, a fixture lot provoking it yields that code from **both** the lot-readiness and closeout endpoints, **and the two endpoints' full emitted code sets are equal for that fixture**. *(Rev 2 demanded a fixture triggering **exactly** one code, which `[DR2-B2]` proved impossible: one open major NCR necessarily emits `open_ncrs` and `open_major_ncrs` together.)* | DB-backed |
| **AT-120** | D1a | **Nothing is stored `[DH-B4]`.** No row records a verdict; a second read after the blocker clears returns `ready: true` with no invalidation step. | DB-backed |
| **AT-121** | D1a | **Absence is named `[DH-B1]`.** A lot with no ITP returns `no_itp_assigned`, not an empty array and not a generic "incomplete". | unit |
| **AT-122** *(Rev 3)* | D1b | **Wave D does not touch the shipped generators `[DH-i]`.** The merged Wave D diff contains **no modification to any file under `frontend/src/lib/pdf/`**, and the shipped pdfGenerator characterization suite passes **unmodified**. *(Rev 2 asserted per-format sink equivalence; there is no sink — §0.7. A diff assertion is stronger and cheaper than an equivalence one.)* | static (diff) + the existing suite |
| **AT-123** | D1b | **Versioning appends.** Two issues yield versions 1 and 2 with different ids, paths and timestamps; version 1's row and bytes are unchanged. | DB-backed |
| **AT-124** *(Rev 3)* | D1b | **The server owns the fingerprint.** A client-supplied `sha256` **or** `compiledFrom` on any folio route is rejected outright, not merely ignored; the stored values derive from the server's snapshot and **the bytes the server itself produced**. | DB-backed |
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
| **AT-135** *(Rev 3)* | D1c.2 | **Cannot publish, not cannot upload `[DR2-B7]`.** Two competing workers, an expired lease, process death mid-upload: the superseded worker's **compare-and-swap publish fails**, it cannot finalize and cannot cancel; its lease-keyed object is unreachable and is swept; the published artefact is written exactly once. *(Rev 2 asserted the stale worker "cannot upload", which no database predicate can enforce — §4.6.2.)* | DB-backed + storage-integration |
| **AT-136** *(Rev 3)* | D1b, D1c.2 | **`[DH-B8]` — no submission claim.** A string guard over **product-owned template strings only** — folio renderer templates, manifest field names and headers, and Wave D UI copy — for "submit", "lodge", "accepted by", "certified by CIVOS" and council-acceptance phrasing. **User-authored content is explicitly out of scope:** a diary note or document filename containing "submit" is the customer's vocabulary, and failing CI on it would be a test that punishes them for it. *(`[DR2-A1]`.)* | static + unit |
| **AT-137** | D1b | **The §2.5 wording, verbatim.** The folio renderer emits the compilation disclaimer exactly as specified, emits **no signature block**, and emits none of the certification strings at `conformanceReportPdf.ts:78-102`, `:838`, `:850`, `:904-908` — which under `[DH-i]` it cannot, since it does not import that file. Asserted over the rendered text, not the source. | unit |
| **AT-138** *(Rev 3)* | D1a-respec | **The registry cannot drift `[DH-B5]`.** Two **runtime** set comparisons: (a) `HANDOVER_BLOCKING_REASON_CODES` ⊆ `READINESS_REASON_CODES`; (b) it equals the set of codes the shipped emitters produce with `severity: 'blocker'` ∧ `blocksAction: true` across the D1a fixture battery. Adding a blocking code without registering it fails — at compile time via the narrowed `EvidenceReadinessItem.code`, or here. *(Rev 2 compared a runtime set to a TypeScript union, which cannot be evaluated — `[DR2-B2]`.)* | unit |
| **AT-139** | D1a | **Filters do not silently hide.** `areaId` returns only chainage-overlapping lots and reports `unplacedLots`; `activitySlug` reports `unclassifiedLots`. Both counts are non-zero in the fixture. | DB-backed |
| **AT-140** *(Rev 3)* | D1c.2 | **Chainage reaches the filename, in the exact format `[DR2-A1]`.** A photo member on a lot with chainage 1250.4–1310.0 is named `CH1250-1310_{sanitized}`; equal start/end yields `CH{n}_{sanitized}`; a null chainage falls back to `{lotNumber}_{sanitized}`. **Sanitisation precedes prefixing precedes collision-suffixing**, asserted by a fixture whose names collide only after prefixing. The manifest records the rule applied, per member. | DB-backed |
| **AT-141** | D1b | **Immutability is a database property.** A direct `UPDATE` on `folio_issues` — Prisma **and** raw SQL — is rejected by the trigger. | DB-backed |
| **AT-142** *(Rev 3)* | D1b, D1c.2 | **Fail closed.** With durable storage unavailable, folio issuance and archive generation refuse with a stated reason and write nothing to local disk. **Kind corrected to storage-integration** — the assertion is about the storage adapter's behaviour when `isSupabaseConfigured()` is false, which a DB-backed test cannot observe (`[DR2-A1]`). | storage-integration |
| **AT-143** *(Rev 3)* | **D1b** | **There is no byte-accepting route `[DH-i]`.** A route-inventory assertion: **no Wave D route accepts a request body containing PDF or binary document content**, and the folio module's import graph reaches no client-supplied byte source. *(Rev 2 asserted a derivation check rejects a doctored PDF; `[DR2-B4]` showed that check cannot be sound, and `[DR2-A1]` that the AT was unassertable and mis-phased into `D1b.0` before any route existed. Asserting the route's **absence** is both sound and trivially checkable — and phased where the routes are.)* | integration + import assertion |
| **AT-144** | D1b.0 | **The requirement profile is executable `[DR2-B1]`.** `LoganPsp5RequirementProfile` resolves **all seven** PSP5 items for a fixture lot, each returning `present` / `missing` / `not_applicable` / `not_assessable` **with a reason**, and items 1 and 6 are structurally incapable of returning `present`. A profile whose item count or `profileVersion` changes without a test change fails. | unit |
| **AT-145** | D1b.0 | **The Logan-18 crosswalk names what it cannot resolve `[DR2-B1]`.** Every one of the 18 PSP5 categories maps to at least one `TestCategory`; a lot carrying a test-type string outside the crosswalk yields `not_assessable` **naming that string**, never a silent drop and never a false `missing`. | unit |
| **AT-146** | D1b | **Version reservation is durable and unique `[DR2-B3]`.** Two concurrent sessions on one lot produce versions 1 and 2, never two 1s — asserted against the `[lotId, version]` unique constraint, not against application ordering. An expired reservation with no issue is swept, its object removed, **and its version not reused**. Every `compiledFrom` entry carries a §7.7 revision token of the kind declared for its source type. | DB-backed |
| **AT-147** | D1b | **`format` cannot be an authority certificate `[DR2-B5]`.** Inserting a `FolioIssue` with `format = 'tmr'` — **via raw SQL, bypassing the route** — is rejected by the database CHECK. | DB-backed |
| **AT-148** | D1c.1, D1c.2 | **Expiry and legal hold `[DR2-B5]`.** An export past `expiresAt` is swept and its **row survives** with a null `fileUrl`. An artefact whose latest `ArtifactLegalHold` row is `placed` is **not** swept and **cannot** be deleted by §10.4; after a `released` row it can be. Hold state is asserted through the append-only sequence — no update, no delete. | DB-backed |
| **AT-149** | D1d | **The CCTV deliverable can actually be uploaded `[DR2-B1]`.** A `video/mp4` file **above 50 MB** uploads successfully on the CCTV surface and is rejected on the general document surface — proving the allow-set and the size ceiling are separately governed and that `ALLOWED_DOCUMENT_MIME_TYPES` was not widened. The pre-backfill `documentType` round-trips and drives §2.3's item-5 resolver. | integration |
| **AT-150** | D1c.0 | **The spike's thresholds are the ones written down `[DR2-B6]`.** The benchmark report records a measured value for **every** §4.5.1 fixture and for the §4.5.6 cost ceiling, each against the value as specified **in this document**. A selection made against a threshold not stated here fails review. Cost is reported **per leg** — reads, upload, storage, downloads. | benchmark artefact (reviewed, not CI) |
| **AT-151** | D1b.0 | **The renderer library was chosen on the declared axes `[DR2-B4]`.** The §4.3.6 benchmark records each candidate against every predeclared threshold, and the selected library **requires no native build step** and produces **byte-identical output** across two renders of one snapshot under a fixed clock and fixed metadata — the precondition AT-127 depends on. | benchmark artefact + unit |

---

## 15. Exit gate

**D1 is done when all of the following are true and evidenced:**

1. AT-119 … AT-151 pass in CI, DB-backed tests against the local disposable Postgres. The three **benchmark-artefact** ATs (AT-150, AT-151) are reviewed artefacts rather than CI jobs, and are recorded as merged documents.
2. Closeout readiness measured on the reference dataset at 5,000 lots, p95 under budget (§12), number recorded.
3. A folio issued, evidence changed, a second folio issued, both downloaded — version-1 bytes hash-identical to issue time. On a real project, not a fixture.
4. A full-project archive generated **at whatever cap `D1c.0` selected** (§4.5.3), opened, manifest reconciled against the project's actual document count with omissions accounted for. **Rev 1's "50 GB reference dataset" gate is amended to `D1c.0`'s decided cap** — the two were mutually exclusive and Rev 1 asserted both.
5. Archive storage + egress cost measured **against §4.5.6's predeclared ceiling of AUD 12.00 ex-GST** per reference-dataset archive plus three downloads, pass or fail recorded per leg. **The ceiling is not re-set after the measurement** (`[DR2-B6]`).
6. Peak memory during archive generation recorded and flat with respect to archive size.
7. The pdfGenerator characterization suite passes **unmodified**, and the merged Wave D diff touches **no file under `frontend/src/lib/pdf/`** (AT-122). *(Rev 1 promised this and could not keep it; Rev 2 withdrew it; Rev 3 keeps it by not touching the file — §0.7.)*
8. `D1b.0`'s threat model merged before D1b code (§4.3.4).
9. Docs + the Clancy knowledge mirror updated in the same PRs.
10. **Pilot acceptance, restated at the reachable party and scoped to what CIVOS produced (§5.1 clause 8, `[DR2-A2]`).** Rev 1 required *"one named authority has accepted one real submission"* — **unreachable by design**, because the submitter is the consulting engineer. Rev 2 replaced it with a consultant confirming *"the pack needed no reformatting"*, which `[DR2-A2]` correctly rejects as internally ambiguous: the consultant's own certificate (§2.2 item 1) and the editable asset list (item 6) are **deliberate, permanent CIVOS gaps**, so the consultant necessarily adds material and "no reformatting" cannot describe the whole submission. Replaced with four parts, all four required:

    a. **One RPEQ consultant lodges an on-maintenance submission whose evidence pack was compiled in CIVOS.**

    b. **The consultant confirms the CIVOS sub-bundle** — the folio, the archive and their manifests — **needed no renaming and no re-export.** Scoped to what CIVOS produced, which is the only thing CIVOS can be judged on.

    c. **The deliberate additions are recorded**: what the consultant added that CIVOS does not produce, item by item, against §2.2. This is the row that tells us whether §2.2's three gaps are the right three.

    d. **The on-maintenance outcome is observed and recorded** — approved, approved with conditions, or returned, with the reasons. **No claim of CIVOS acceptance is made or implied from it** (`[DH-B8]`). The council is accepting the consultant's submission, not our bundle, and the gate records the outcome as evidence rather than as endorsement.

**D2 and D3 have no exit gate because they have no scope.** Both are closed on evidence, not deferred.

---

## 16. Decisions

### 16.1 Jay's decisions — re-put against D.0 and the review

| # | Decision | Blocks | Recommendation |
| --- | --- | --- | --- |
| **J1** | **Docket/diary inputs to closeout readiness: wire or drop?** Parked on D1 at `futureConsumers.ts:117-119` and `f0-execution-spec-2026-07-24.md:167`. | D1a | **DROP — and now on evidence, not assertion.** `[DR-A1]` correctly said Rev 1 was deciding this without a receiving checklist. We have one: **Logan PSP5 §5.6.5 contains no docket, diary, labour or plant item** (§2.2). The pack is quality evidence. `[DR-A1]`'s other half is also taken — the phase is **renamed "quality closeout readiness"** so nothing implies it covers dimensions it does not. Flip if a pilot client's own handover checklist asks for docket completeness. |
| **J2** | **Issuer, signatory and legal wording** — `[DR-A2]` requires these decided together, not branding alone. | D1b (content, not polish) | **Contractor branding; NO signature block; the §2.5 wording verbatim.** D.0 resolves the underlying question: *"an inspection and testing certificate signed by the consultant"*. An empty signature line under CIVOS-compiled text is the failure mode `[DR-A2]` named, and Rev 1's J2 missed it by treating branding as the whole question. |
| **J3** | **Archive size cap.** | D1c.0 output, D1c.2 config | **WITHDRAWN as a number.** "Order 5 GB" fails the 50 GB exit gate, exceeds `fileSize Int`, and is unproven for the recommended writer. Replaced by the §4.5.3 formula, decided by measurement in `D1c.0`. `[DR-A3]`. |
| **J4** | **ZIP dependency.** | D1c.0 output | **WITHDRAWN as a recommendation.** Zero transitive dependencies is the wrong axis; ZIP64, backpressure, large-member support and resumable-upload composition are the right ones — and `fflate` advertises only 4 GB. Decided by benchmark in `D1c.0` (§4.5.2). Hand-rolling stays rejected. `[DR-A4]`. |
| **J5** | **D2 jurisdiction order.** | — | **VOID AS FRAMED, and the question no longer exists.** D.0: **A-SPEC is a Victorian commercial product of GISSA International Pty Ltd**, its licence restricts use *"to A-SPEC Consortium members only"*, and **zero NSW councils mandate it** across twelve tested — while NSW's structured-format councils are on **ADAC**. Both arms of the fork were wrong. The likely source of the confusion is **AUS-SPEC** (NATSPEC), a different product with a near-identical name. With D2 deleted the jurisdiction question evaporates: **Rev 2 is QLD folio-first with no jurisdiction fork.** `[DR-A5]` is satisfied by the evidence rather than by leaving it open. |
| **J6** | **Is D2 worth pursuing?** | — | **ANSWERED: no.** D.0 was one docs PR and it closed a wave — the third time this pattern has paid (§1.3). Rev 1's fallback line was *"D1's folio + archive is a complete, sellable handover story on its own."* That is now the **only** story, and §2 makes it a stronger one than Rev 1 could claim: the folio is compiled against a **mandatory, council-enforced, grade-A requirement list**. |
| **J7** | ~~**The derivation-check dependency.**~~ | — | **DELETED in Rev 3, `[DR2-B4]`.** The question only existed because the browser rendered the folio. **It does not** (`[DH-i]`, §4.3.1): there are no client bytes, so there is nothing to derive-check and no extraction dependency to weigh. Rev 2's answer — *"take (i) if cheap; ship (ii) regardless"* — was also the review's sharpest catch, because (ii) is not a fallback, it is **the doctored-bytes vulnerability with a name**. Deleted rather than re-answered, and recorded here so nobody reintroduces it as "the cheap option". |
| **J8** *(new, Rev 3)* | **The archive cost ceiling — AUD 12.00 ex-GST** per reference-dataset archive plus three downloads (§4.5.6). Declared **before** measurement per `[DR2-B6]`, which means it is declared before anyone knows whether it is achievable. | D1c.0 pass/fail; §15 item 5 | **This is Jay's number, not engineering's, and it is the one decision in this spec that a build agent may not make.** The point of predeclaring it is that it can be *missed* — and if `D1c.0` measures above it, the responses are a lower cap, a cheaper delivery path, or a priced add-on, all of which are commercial calls. **Moving the number is recorded here as a new dated row, never an edit to this one.** |

### 16.2 The spec's own decisions

| Tag | Decision | Flip condition |
| --- | --- | --- |
| `[DH-a]` | **WITHDRAWN in Rev 3.** Governed a PDF sink that no longer exists — under `[DH-i]` the browser never produces folio bytes, so `generateConformanceReportPDF` gains no option and `frontend/src/lib/pdf/` is untouched (§0.7). | — |
| `[DH-b]` | **The archive worker collects; it never renders.** *(Rev 3 narrows the second clause. "No jsPDF in Node" was a proxy for the real rule — no background job emits a document nobody reviewed — and `[DH-i]` now requires a Node renderer for interactive folio issuance, which is a different act by a different actor. §4.3.1.)* | Pilots show progressive issuance is not happening — and even then the first fix is a prompt, not a worker-side renderer. |
| `[DH-c]` | One new dependency: a streaming ZIP writer, **selected by benchmark in `D1c.0`**, not by recommendation. | None. Hand-rolling stays rejected. |
| `[DH-d]` | **Multi-authority configurability** and `ExceptionOrWaiver` deferred out of D1. Blocker removed (§2); scope now reduced to one thing, because `[DR2-B1]` pulled the Logan-18 crosswalk into `D1b.0` and the concrete Logan profile with it (§4.9). | Someone asks for a **second** authority's pack profile — a customer event, not a roadmap slot. `profileVersion` and the §2.3 resolver dispatch are the seam it plugs into. |
| `[DH-e]` | No checksum or chainage column on `Document`; D1c hashes at archive time and derives chainage from the lot. | Hashing dominates archive job time on the reference dataset — measure first. |
| `[DH-f]` | **Superseded.** Rev 1 said "the folio is the shipped conformance report, unchanged in content". `[DR-B1]` makes that impossible: the shipped report certifies. Replaced by `[DH-h]` in Rev 2, and by **`[DH-i]`** in Rev 3. | — |
| `[DH-g]` | D1c's download streams; the scheduled-report buffer-and-send path is left alone. | Someone needs streaming for scheduled reports — then extract, with characterization coverage. |
| `[DH-h]` | **WITHDRAWN in Rev 3, replaced by `[DH-i]`.** Made the folio a sixth `ConformanceFormat` rendered in the browser. `[DR2-B4]` showed the resulting upload boundary cannot be made safe by inspection. | — |
| **`[DH-i]`** | **The folio renders on the server, from the `FolioSnapshot`, in a module that shares no code with `frontend/src/lib/pdf/`. No route accepts folio bytes from any client.** The shipped certificates keep their certification language and signature blocks for their shipped purpose, and Wave D does not touch them at all. **One new backend dependency**, chosen by benchmark in `D1b.0` (§4.3.6). | A QM confirms the certificate formats are unused — then deprecate them deliberately, in their own PR, never as a side effect of Wave D. Nothing flips the server-render decision itself: reverting it reopens the class `[DR2-B4]` closed. |

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
| Professional liability, PI insurance, whether re-emission is authorship | **closes limb** | Moot: nothing is re-emitted (§5). §2.5's wording is the residual mitigation. |
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

## 18. Verification notes — derived at `84eac1a7`, re-derived at `75eea0b9` where the schema moved

### 18.1 What changed this revision's shape

Rev 2's seven items are still true and are kept below; Rev 3 adds five, all of them the same failure repeated in different places.

1. **D.0 killed D2 twice**, and returned a mandatory requirement list in exchange. The largest phase in the program is deleted and the smallest one got a specification. §2, §5.
2. **The shipped conformance PDF certifies**, and the wave's central rule forbids certifying. Rev 1 planned to persist that document unchanged. `[DR-B1]` is the finding that produced `D1b.0`.
3. **`#1658` fixed half of `[DR-B1]` between the Rev 1 review and Rev 2** — and in doing so proved the other half is real. §0.9. *(Its second consequence, invalidating Rev 1's characterization promise, is moot in Rev 3: Wave D no longer edits that file — §0.7.)*
4. **The handover reason-code union is incomplete at HEAD** — `insufficient_test_count` blocks lots and is not in it. Rev 1's "no widening" rule guaranteed the divergence `[DH-B5]` exists to prevent. §4.1.1.
5. **Issuance trusted the browser.** Six independent reads, client-rendered bytes, client-supplied fingerprint. §4.3.3.
6. **The worker resumes deliveries, not artefact generation** — four of five properties, and the missing one is the one a ZIP needs. §3.4.
7. **`[DH-B3]` was false as absolutely worded**, and the map code proves it. Reworded. §1.2.
8. **Rev 2 wrote a set equation between a TypeScript type and a runtime set.** `[DR2-B2]`. The registry that makes it executable was already in the repo, one file over from the union it was meant to constrain (`reasonCodes.ts:29-85`). §0.6, §4.1.1.
9. **Rev 2's pack score contradicted Rev 2's own table.** `[DR2-B1]`. Three cells counted as "fed" said *partial*, *no crosswalk exists*, or — for CCTV — described a feature whose upload path rejects the file type outright (`documents/fileHelpers.ts:35-47`) at a 50 MB ceiling (`documents.ts:278`). §2.2.
10. **Server rendering was available the whole time and Rev 2 designed around it.** `[DR2-B4]`. Every hard problem in Rev 2's issuance section — the derivation check, the sink, the recorder work, the fallback, J7 — existed only to make client-produced bytes trustworthy. Deleting the client render deleted all of them. §0.7, §4.3.1.
11. **A gate whose threshold is set after the measurement is not a gate.** `[DR2-B6]`. Rev 2 did this with the archive cost ceiling, which is the single most expensive thing the product does. §4.5.6.
12. **An invariant is only as strong as the system that enforces it.** `[DR2-B7]`. Rev 2 fenced database rows and claimed a property about object storage. §4.6.2.

### 18.2 Citation provenance

**Re-opened at `84eac1a7` for Rev 3** — every code claim the delta review makes, checked against the file rather than against Rev 2's account of it: `readiness/contracts/reasonCodes.ts:29-85` (the `READINESS_REASON_CODES` array, read in full), `:87`, `:98`, `:112`, `:180`, `:238`; `readiness/contracts/futureConsumers.ts:90-121`; `readiness/contracts/contracts.test.ts:152-192`; `evidenceReadiness/core.ts:1-40`; `readiness/sufficiency/testCategories.ts:18-30` and `:29-85` (the alias table **and its governance/scope note**, which is the evidence for §2.2 item 2); `routes/documents/fileHelpers.ts:34-52`; `routes/documents.ts:270-290`; `backend/package.json` (**no PDF dependency of any kind** — zero matches for `jspdf`, `pdfkit`, `pdf-lib`, `puppeteer`, `playwright`, `canvas`); `frontend/package.json:49` (`jspdf ^4.2.1`); the AT-143 ceiling grep and the `[DR2-*]` / `[DH-i]` collision greps; and `git diff --stat f2defa17..84eac1a7`, which returns **one file, this spec**.

**Re-opened again at `75eea0b9`, because `#1662` moved `schema.prisma` mid-revision (§0.11):** `:447-459` (`ProjectArea` — unmoved), `:545-570` (`Lot` — unmoved; `chainageStart`/`chainageEnd` at `:551-552`, `activitySlug` at `:564`), `:712-743` (`ITPCompletion`, read in full — unmoved; **neither `version` nor `updatedAt`**, the evidence for `[DR2-B3]`'s revision-token finding), `:824-829` (the E2 insert itself), `:947`, `:960-961`, `:1004`, `:1017`, `:1035-1046` (`NCR` + `NCREvidence` — **all +5**), `:1597-1643` (`Document` — **+5**; GPS and capture at `:1609-1611`, version tracking at `:1618-1620`).

**Personally opened at `f2defa17` for Rev 2, and still valid because no code moved (§0.10):** `conformanceItems.ts:170-195`; `conformancePrerequisites.ts:195-210`, `:515-530`; `claimReview.ts:230`; `conformanceReportPdf.ts` (the whole `#1658` hunk) plus `:78-102`, `:112-135`, `:838`, `:850`, `:904-908`, `:922`; `pdf/types.ts:1-8`; `ConformanceReportModal.tsx:8-30`; `pdfSave.ts`; `pdfTestRecorder.ts:17,63-66`; `useConformanceReportGeneration.ts:110-156`; `schema.prisma:761-790`; `controlLineGeometry.ts:44-52`; `lotGeometry.ts:91-110`; `CLAUDE.md:266`; the full text of `docs/research/d0-adac-handover-research-2026-07-28.md`.

**Still NOT individually re-opened, at either SHA:** the readiness-engine internals in §3.1 other than those listed above; the scheduled-report worker line numbers in §3.4; the spatial model line numbers in §3.5; the four project-guard copies in §10.1; the NOT-FOUND greps in §3.6 other than the asset/ADAC/ZIP ones.

**One Rev 2 citation is narrowed rather than wrong:** §2.2 item 5 cited `Lot.chainageStart`/`chainageEnd` as `:551-554`; they are at **`:551-552`** (`:553-554` are `offset` and `offsetCustom`). The range contained them, so nothing was misread — recorded because §18.2's whole purpose is that ranges get copied forward and narrow to the wrong lines.

**Whoever builds a phase re-derives that phase's citations first.** This repository has now produced **three** documented cases of a confidently-cited line number being wrong — and Rev 1's own `:888` became one of them within five commits (§0.9). Treat every carried citation as a hypothesis. **And note the sharper lesson from `[DR2-B1]`: every line number in Rev 2's §2.2 was correct, and the section's conclusion was still false.** Correct citations under a wrong summary are more dangerous than wrong citations, because they survive review.

### 18.3 Observations for whoever builds this — none blocking

1. **`sendScheduledReportArtifactFile` buffers whole files into memory.** Fine at 200 KB, not at 2 GB. D1c writes its own path (`[DH-g]`), but the shipped one is a latent problem the day someone schedules a report over a large dataset.
2. **`dataRetentionWorker.ts` handles no artefacts at all.** §10.5 says D1c may not assume a sweeper exists. Whether one should exist for all three artefact kinds is worth its own small PR. Not Wave D's to fix.
3. **`Drawing` tracks revision and supersession but nothing about receipt or acknowledgement**, and no F1 execution spec exists at this SHA. A folio can state *which* drawing revision a lot's evidence references, never *whether the crew had it*. Say that plainly in the folio rather than implying the stronger claim.
4. **There are no Prisma enums anywhere.** Do not introduce the first one here.
5. **`ITPCompletion.gpsLatitude/gpsLongitude` are written and rendered nowhere.** C3 recorded the same. Still true. Not Wave D's.
6. **The archive is the product's largest egress event by an order of magnitude.** §4.5.6's ceiling is not a formality; it is the number that decides whether "50 GB evidence project" is a pricing promise or a pricing mistake — which is why Rev 3 writes it down before measuring (`[DR2-B6]`, J8).
7. **The §2.2 item-3 gap (no retest→original-test link) is the most product-visible hole in the pack mapping.** It is a C2-family column, it is small, and a pilot will notice it before anything else on this list. **The NCR-linked path is better than Rev 2 credited** (`linkedTestResultId`, `schema.prisma:947`) — it is only the no-NCR retest that is unlinked.
8. **New in Rev 3: PDF rendering now runs in the API process.** `[DH-i]` buys a large security simplification and moves a CPU- and memory-bound workload into the process that serves every request. §4.3.6's RSS and wall-clock thresholds are load-bearing, §4.3.4's threat model covers renderer resource exhaustion, and **whoever builds D1b should watch p95 on unrelated endpoints during folio issuance** — that is the number that would say "this belongs in the worker after all".
9. **New in Rev 3: `documents.ts:278`'s 50 MB cap is a product-wide constraint that nobody has revisited.** D1d needs past it for CCTV (§4.8). Whether the general document limit is still right for a product storing site photography is a separate question worth asking once, and it is **not** Wave D's to answer — but D1d is where someone will notice it.

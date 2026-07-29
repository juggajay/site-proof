# Wave D Execution Specification — handover: the folio is the product

**Date:** 28 July 2026 · **Rev 3** · **Status:** D1 is respecced in **eight** phases (§4.0). **D2's XML limb is DELETED** on grade-A evidence (§5). **D3 is CLOSED** (§6). **The folio renders SERVER-SIDE** (§4.3) — Rev 2's client-render-then-upload boundary is deleted, not hardened. Rev 1's slicing is superseded; Rev 2's phase map survives with three phases re-scoped. **Amended 2026-07-29: `D1c.0` has run — 8 GiB cap, no writer selected, worker out of the API process — and Jay answered J8 with a priced add-on (§16.1 J9), which unblocks `D1c.1` and `D1c.2`. Read the dated amendment block immediately above §0 before §4.5.** **Amended again 2026-07-29, later the same day: §4.5.7's entry gate ran and failed as specified; Jay then amended two §4.5.1 thresholds (§16.1 **J10** — F3 binds the API process, F1's band is floored at 128 MiB) and **`archiver` 8.0.0 is SELECTED** (§4.5.2, §4.5.7). Every "no writer selected" line in this document predates that row and is superseded by it.**

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

**Acceptance-test numbering.** The highest allocated number across `docs/` at this SHA is **AT-143** — Rev 2's own ceiling (verified by grep). Rev 3 keeps AT-119…AT-143 where the assertion survives, **restates** those the review found unassertable or mis-phased, **deletes none**, and takes **AT-144 onward** for the new obligations. *(Amended: the `D1b.0` threat model, `docs/plans/wave-d1b-threat-model-2026-07-28.md` §11.2, mints **AT-152 … AT-156**. The next free number is **AT-157**.)*

---

> **Rev 3 amendments after `#1679`, `#1680` — read this before §2.** Three
> sections of Rev 3 were written against a *rendering* of Logan PSP5 §5.6.5 and
> are now regenerated from the code that read the clause:
>
> - **§2.2 and §2.3 are regenerated from
>   `backend/src/lib/handover/loganPsp5Profile.ts` and
>   `loganPsp5Crosswalk.ts`** (shipped `#1679`). **The pack has EIGHT items,
>   (a)–(h), not seven** — the dropped one is (b), *"a certification of
>   foundation conditions signed by the consultant where relevant"* — and the
>   eighteen matters under (c) differ from the prose Rev 3 expanded. The honest
>   score is **2 `storage_only` / 3 `partial` / 3 gaps, all deliberate** — `#1679`
>   scored it 1 / 3 / 4 with (e) closable, and **`#1689` (D1d) closed (e)**, which
>   is the only coverage value the profile has ever changed. Tagged `[LP5-DELTA]`
>   in both files. **AT-144** and **AT-145** are
>   restated to the shipped assertions. §2.2 is generated from the profile now;
>   where the two disagree, the profile wins.
> - **The `D1b.0` threat model is merged** —
>   `docs/plans/wave-d1b-threat-model-2026-07-28.md` (§4.3.4, §10.6, §15 item 8).
>   Eight threats, all `Mitigate before D1b`, nothing `Block`. Mints
>   **AT-152 … AT-156**.
> - **The Node PDF library is decided: `pdfkit` 0.19.1**, on the §4.3.6 axes,
>   with numbers (§4.3.6, and §10 of the threat model). **AT-151 passes and did
>   not fire** — no threshold was moved.

> **Rev 3 amendments after `D1c.0` — the spike ran, and Jay answered J8
> (2026-07-29). Read this before §4.5.** The spike is merged:
> `docs/plans/wave-d1c0-spike-report-2026-07-29.md`, with its results committed
> under `backend/scripts/bench-results/`. **The report proposed; this revision
> disposes.** Five things move:
>
> - **No writer is selected.** No candidate passed all six §4.5.1 fixtures at the
>   50 GB reference scale, which §4.5.1 named in advance as a legitimate outcome.
>   **`fflate` is rejected permanently** — above 4 GiB it emits a corrupt central
>   directory and *reports success*. §4.5.2.
> - **The cap is decided: 8 GiB of output per archive**, on the **S3 multipart**
>   path, with a **7.92 GiB admission cap**. A reference-dataset project is
>   therefore **~6 archives**, which promotes §4.7's scope selector from a
>   convenience to the mechanism by which a large project fits. §4.5.3.
> - **The archive worker runs outside the API process** — **`[DH-j]`**, §16.2.
>   Every candidate stalled the event loop by 100–700 ms; in-process, archive
>   generation is a user-visible outage.
> - **J8 is answered — the priced add-on** (§16.1 **J9**, dated 2026-07-29,
>   recorded as a new row per J8's own rule). The A$12.00 figure stops being a
>   ship/no-ship gate and becomes the **COGS reference line** against the
>   measured **A$39.77**. **`D1c.1` and `D1c.2` are UNBLOCKED.**
> - **`D1c.1` still does not start on the spike's verdicts alone.** They were
>   measured at 50 GB scale on a saturated box; **§4.5.7 defines a targeted
>   re-grade at the new cap, on a quiet box, as `D1c.1`'s entry gate.**
>
> **§15's exit gate is amended** (items 4, 5, 6 and the new item 11) and
> **§7.4–7.6 are unchanged** — the lease/heartbeat job schema already specified
> is exactly what an out-of-process worker needs, and `uploadState` resolves to
> S3 multipart state rather than being dropped.

> **Rev 3 amendments after the §4.5.7 re-grade — TWO THRESHOLDS AMENDED BY JAY,
> AND A WRITER SELECTED (2026-07-29, later the same day). This block supersedes
> the "no writer is selected" line in the block above; that block is left
> unedited.** The re-grade is merged (`#1692`), results committed at
> `backend/scripts/bench-results/d1c1-writer-regrade-2026-07-29T09-00-00-000Z.json`,
> and recorded in the spike report **§7**. Four things move:
>
> - **The gate ran and FAILED exactly as §4.5.7 specified it could.** On a quiet
>   box (11.5% idle system CPU against the spike's 72–78%, zero contended legs),
>   **`archiver` missed F3 alone** — 69.99 ms max single-tick stall against 50 ms,
>   p99 4.38 ms ✓ — and **`yazl` missed F1 alone** — 94.7% RSS flatness across
>   1 → 8 GiB against ±15%. **One row each, and a different row each.** No
>   threshold was relaxed to reach that result and none had been.
> - **Jay then amended two §4.5.1 rows, and only two — §16.1 `J10`, a new dated
>   row.** **F3 binds the API process only** (its own rationale is user-visible
>   outage, and `[DH-j]` moved the worker out of the API process **before** this
>   re-grade, for independent measured reasons); **F1's ±15% band governs only
>   above a 128 MiB peak-RSS floor**, below which the absolute ≤256 MiB cap
>   governs alone. **These amendments were made after measurement, which is what
>   predeclaration exists to prevent — which is why they carry Jay's signature
>   and a dated row rather than an engineering edit.** F4, F5, F6, F2, F1's
>   absolute cap and ZIP-standard compatibility are untouched.
> - **`archiver` 8.0.0 is SELECTED**, on §4.5.2's five axes applied in their
>   stated order to the measured evidence: three ties, and the first axis that
>   separates them — **large-member support** — goes to archiver by 26× (3.6%
>   flatness against 94.7%). yazl wins the **event-loop** axis on maximum stall
>   (16.91 vs 69.99 ms) and that axis is ranked below. §4.5.2, and the spike
>   report **§7.8**.
> - **The object-tree fallback is NOT taken.** §4.5.7 item 6's second branch does
>   not fire; the fallback stays in this specification as the fallback it is.
>   **`D1c.1` installs `archiver` as a production dependency** — nothing is
>   installed by the re-grade or by this amendment.

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
| **`[DR2-B1]`** the PSP5 "four fed" score is false | **Yes — and §2.2's own cells contradicted its own score line.** Test coverage: `TestCategory = string` (`testCategories.ts:22`) and the alias table's governance note names **`vicroads-204.v1` as the only resolved pack**, with the QLD/SA/WA compaction phrasings "deliberately absent" (`:29-85`) — so the canonical resolver is Victorian-compaction-only and there is no Logan-18 crosswalk. CCTV: `ALLOWED_DOCUMENT_MIME_TYPES` contains **zero video types** (`documents/fileHelpers.ts:35-47`) and multer caps uploads at **50 MB** (`documents.ts:278`) — a CCTV run is routinely GB-scale, so the upload path rejects the deliverable twice. Rectification: `NCR.linkedTestResultId` (`schema.prisma:947`, relation `:1004`), `rectificationNotes`/`rectificationSubmittedAt` (`:960-961`), `NCREvidence` (`:1035-1046`) — real, and only via an NCR. Photos: `captureTimestamp` + `gpsLatitude`/`gpsLongitude` (`:1609-1611`), but **no pre-backfill qualifier and no chainage**, and the filename rule is unbuilt. | **FOLDED, re-scored to the reviewer's mapping.** §2.2 becomes **one shipped-as-storage / three partial / three gaps** with the file:line evidence in the table. **Superseded by `#1679`, then again by `#1689` — see §2.2's `[LP5-DELTA]` note: the pack has EIGHT items, because §2.2 and this row were both written against a rendering of §5.6.5 rather than the clause; `#1679` re-scored it one / three / FOUR (three deliberate, one closable) and `#1689` closed the closable one, giving the current **TWO `storage_only` / three `partial` / three deliberate gaps**. §2.2 is now generated from `backend/src/lib/handover/loganPsp5Profile.ts`.** A versioned **`LoganPsp5RequirementProfile` with an executable per-item resolver** is specified in `D1b.0` (§2.3, §4.3.2) — the profile is the thing the folio's expected-vs-present limb reads, and a mapping nothing executes is what produced this blocker. The **Logan-18 crosswalk moves from D1e into `D1b.0`** (§4.3.2). **CCTV upload capability — MIME allowance and a size ceiling — is assigned to `D1d`** (§4.8), which stops being an XS `documentType` phase. Photo and O&M classification are made explicit. **D1e reduces to multi-authority configurability**, named and unbuilt (§4.9). **AT-144**, **AT-145**, **AT-149**. |
| **`[DR2-B2]`** the parity contract is not executable | **Yes on the diagnosis, in full.** `EvidenceReadinessItem.code` is plain `string` (`evidenceReadiness/core.ts:19`), so nothing constrains an emitter. A TypeScript union has no runtime extension. And the overlap is real: one open **major** NCR emits `open_ncrs` (predicate `ncrOpen`, `reasonCodes.ts:112`) *and* `open_major_ncrs` (predicate `ncrSeriousIncludingCritical`, `:180`), so "a fixture triggering exactly that code" is impossible for that pair. | **FOLDED — with the prescribed fix narrowed, because the registry already ships.** See §0.6. `HANDOVER_BLOCKING_REASON_CODES` is a runtime `as const` **subset of the shipped `READINESS_REASON_CODES`** (`reasonCodes.ts:29-85`), not a new parallel vocabulary; `HandoverReasonCode` derives from it, replacing today's `Extract<>`; `EvidenceReadinessItem.code` narrows `string → ReadinessReasonCode`; blocker emitters go through a typed helper. **AT-119 becomes set-membership**, never single-code isolation. §4.1.1, **AT-119**, **AT-138**. |
| **`[DR2-B3]`** issuance binds neither issue id nor version | **Yes.** §4.3.3 allocated id and version "in the same transaction"; §4.4.2 ordered upload *before* the version-allocating insert; §7.2's `FolioSnapshot` carried **no `issueId`, no reserved version and no unique reservation**. Two sessions could reserve the same apparent version and `PUT /folios/:id/bytes` had no row to resolve against. The `compiledFrom` limb is also verified: `ITPCompletion` (`schema.prisma:712-743`, read in full) has **neither `version` nor `updatedAt`**, so "exact ids and versions" was unimplementable for it. | **FOLDED as prescribed.** A **`FolioIssueReservation`** table with `issueId`, `lotId`, `snapshotId`, reserved `version`, issuer, `expiresAt` and **unique `[lotId, version]`** (§7.2). **Revision tokens are defined per model** — `version`, `updatedAt`, or a canonical row digest — with the choice named for each source type rather than assumed uniform (§7.7). **AT-146**. |
| **`[DR2-B4]`** J7 lets `[DR-B3]` survive | **Yes, and the argument is unanswerable.** A malicious PDF can carry every expected string and still alter everything else; text presence is not derivation. AT-143 could not pass under fallback (ii), and was mis-phased into `D1b.0`, before any upload route or `FolioIssue` exists. | **FOLDED — the choice is taken absolutely, not benchmarked.** `[DR2-B4]` offered *server rendering* **or** *complete canonical verification*. **Rev 3 takes server rendering: the folio is produced by the backend from the immutable snapshot, and no route anywhere accepts client-supplied folio bytes.** There is no derivation check because there is nothing to derive-check. Fallback option (ii) is **deleted**; **J7 is deleted**; `[DH-h]` is withdrawn and `[DH-i]` replaces it. **AT-143 is restated as a cannot-exist assertion and moved to `D1b` integration.** §4.3, and §0.7 for everything this deletes. |
| **`[DR2-B5]`** the data model contradicts two invariants | **Yes, all three limbs.** §7.1's `format` vocabulary was the full six values even though only `folio` is reachable on the folio path; §7.3's `HandoverExport` had **no expiry field** while §10.5 promised a TTL; **no hold state existed on either artefact**; and a mutable hold flag on `FolioIssue` would have contradicted §7.1's own UPDATE-rejecting trigger. | **FOLDED as prescribed.** `format = 'folio'` enforced by **route validation and a database `CHECK`** (§7.1). **`HandoverExport.expiresAt`** added (§7.3). A separate **append-only `ArtifactLegalHold`** table (§7.6) — append-only precisely so hold state never becomes a mutable column on an immutable row. **AT-147**, **AT-148**. |
| **`[DR2-B6]`** `D1c.0` has no measurable pass/fail | **Yes, and the second half is the sharper one.** "Memory flat", "cancellation mid-write" and "benchmark cheap" carried no numbers — but the decisive flaw is that §4.5.6 set the cost ceiling **after** measurement, which is a gate that cannot fail. The formula also applied an **output-byte cap to an admission preflight that cannot know compressed output**. | **FOLDED as prescribed.** §4.5.1 predeclares **RSS ceiling, event-loop stall maximum, cancellation-cleanup deadline, and integrity/resume assertions as numbers**. §4.5.6 writes the **commercial cost ceiling down before anyone measures**, and records who may move it. §4.5.3 splits **estimated-input admission** from the **hard streaming-output cap**. **AT-150**. |
| **`[DR2-B7]`** AT-135 demands fencing the design lacks | **Yes.** A conditional database write cannot un-write an object-storage `PUT` that a stale worker already issued. Rev 2's `[DR-B5]` fold said a fenced worker "cannot upload", which no database predicate can enforce. | **FOLDED as prescribed.** Workers upload to a **lease-token-specific object key**; publication is a **fencing-token compare-and-swap** on the export row. A superseded worker's object is written but **unreachable**, and is swept. **AT-135 is rewritten as cannot-*publish*, not cannot-*upload*.** §4.6.2. |
| **`[DR2-A1]`** AT assertability | **Yes, per AT.** | **FOLDED, every named AT.** AT-135, AT-138 and AT-143 restated as assertable. **AT-136 scoped to product-owned template strings** — it would otherwise false-fail on a user-authored note containing "submit" or "lodge", which is a test that punishes a customer for their own vocabulary. **AT-140** given an exact chainage format and an explicit sanitise-then-collide ordering. **AT-142 re-kinded `storage-integration`**, not DB-backed. §14. |
| **`[DR2-A2]`** exit item 10 is weaker and ambiguous | **Yes.** "Needed no reformatting" cannot describe the whole submission when §2.2 items **(a), (b) and (g)** — the consultant's inspection-and-testing certificate, the consultant's **foundation-conditions certification** (`[LP5-DELTA]`, absent from Rev 3's original list) and the editable asset list — are deliberate, permanent CIVOS gaps. The consultant *must* add those. | **FOLDED, worded as the reviewer put it.** §15 item 10 now has four parts: the **CIVOS sub-bundle** needed no renaming or re-export; the consultant's **deliberate additions are recorded**; the **on-maintenance outcome is observed**; and **no CIVOS acceptance is claimed**. |
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

> **REGENERATED FROM CODE, `[LP5-DELTA]`.** This table is no longer authored
> here. It is generated from **`backend/src/lib/handover/loganPsp5Profile.ts`**
> (`LOGAN_PSP5_ITEMS`, shipped in `#1679`) and
> **`backend/src/lib/handover/loganPsp5Crosswalk.ts`** (`LOGAN_18`), which is the
> direction §2.3 asks for — *"§2.2 is generated from it, not the other way
> round."* The `letter`, `clause`, `clauseText`, `coverage` and `coverageNote`
> columns below are the profile's own fields. **Where this table and the profile
> disagree, the profile wins and this table is wrong**, and the profile's values
> are pinned by `loganPsp5Profile.test.ts` — including the whole coverage
> distribution — so the disagreement is loud. *(The test count that used to sit
> here went stale within one phase; the pin is the file, not its cardinality.)*
>
> **Regenerated twice: `#1679` (D1b.0, the profile shipped) and again after
> `#1689` (D1d), which moved item (e) `gap_closable` → `storage_only` and made
> item (f)'s qualifying clauses recordable.**
>
> **What the regeneration changed, and why the previous version was wrong.**
> Rev 3's original §2.2 was written against a *rendering* of the clause found in
> `docs/research/d0-adac-handover-research-2026-07-28.md:23`, not against the
> clause. `#1679` read the primary document — *Logan Planning Scheme 2015,
> Planning Scheme Policy 5 (Infrastructure), 2019 Amendment*, §5.6.5 "As
> constructed documentation" — verbatim, and found two substitutions:
>
> 1. **The pack has EIGHT items, (a) through (h), not seven.** The dropped item
>    is **(b), *"a certification of foundation conditions signed by the
>    consultant where relevant"*** — a third permanent, deliberate gap of exactly
>    the same species as (a). Tagged `[LP5-DELTA]` at `loganPsp5Profile.ts:17-27`
>    and `:135`.
> 2. **The eighteen matters under (c) are not the eighteen the old prose
>    expanded to.** The clause makes *"the compaction of fill **including**
>    compaction of trench backfill"* **one** matter, and closes with **(xviii)
>    *"any other job specific testing carried out or required by the
>    engineer"***, which the rendering dropped. Expanding the prose's
>    conjunctions also yielded eighteen, which is exactly why the substitution
>    was invisible. Tagged `[LP5-DELTA]` at `loganPsp5Crosswalk.ts:23-31` and
>    `:105`.
>
> This is `[DR2-B1]` recurring one level down: Rev 2 scored a pack over a prose
> table, and Rev 3 corrected the score while still reading a rendering of the
> source. It is recorded rather than quietly fixed, for the same reason the score
> line below is.

| Cl. | # | PSP5 §5.6.5(1) item, **as the clause words it** | Profile `id` | Shipped CIVOS feature that feeds it | `coverage` |
| --- | --- | --- | --- | --- | --- |
| **(a)** | 1 | *"an inspection and testing certificate signed by the consultant"* | `inspection_testing_certificate` | Nothing, **by design**. The certificate is signed by the consulting engineer (RPEQ), who is also the submitting party. CIVOS compiles the evidence the consultant certifies **over**; the folio is the input to this item, never the item. | **`gap_deliberate`** — permanent. This is the honesty line (§0.2, §2.5). |
| **(b)** | 2 | *"a certification of foundation conditions signed by the consultant where relevant"* | `foundation_conditions_certification` | Nothing, by design — **and this item was missing from §2.2 entirely until `#1679`** (`[LP5-DELTA]`). Same species as (a): consultant-signed, therefore never ours. CIVOS also holds no foundation-condition record from which *"where relevant"* could be judged. | **`gap_deliberate`** — permanent. |
| **(c)** | 3 | *"copies of test results in respect of"* **eighteen enumerated matters, (i)–(xviii)** — each transcribed individually in `loganPsp5Crosswalk.ts`, not summarised here | `test_results` | `TestResult` (`schema.prisma:857`) with `status`/`passFail`, C1's sufficiency engine, F1's canonical categoriser (`readiness/sufficiency/testCategories.ts`), verified-only counting since `#1658`, and the **Logan-18 crosswalk** shipped in `#1679`. | **`partial`.** Storing and verifying a test is shipped. *Resolving a matter* is partial: **10 of the 18 map to a canonical category and 8 do not**, and **five of the ten share one undiscriminated `compaction` category** — `TestCategory` is `type TestCategory = string` (`testCategories.ts:22`), an open vocabulary with no layer or material discriminator. |
| **(d)** | 4 | *"details of the retesting or rectification actions carried out where any test results specified in paragraph (c) fail to meet the standard specifications"* | `retest_rectification` | `NCR.linkedTestResultId` (`schema.prisma:947`), `rectificationNotes` / `rectificationSubmittedAt` (`:960-961`), `NCREvidence` (`:1035-1046`). C2's test lifecycle carries the fail. | **`partial`, and the gap is precise.** The NCR limb is real. The **no-NCR path** is the gap: there is no retest→original-test link on `TestResult`, so a failed test followed by a passing retest with no NCR raised leaves the two rows unassociated. The folio prints *"failed — rectification not linked"* rather than implying a clean trail. Closing it is a C2-family column, not a D1 phase. |
| **(e)** | 5 | *"CCTV video for underground stormwater infrastructure work"* | `cctv_stormwater` | **`D1d` shipped the capability** (`#1689`, §4.8, **AT-149**): a **separate** video allow-set (`isAllowedCctvVideoMimeType`, `documents/fileHelpers.ts`) covering the clause's named containers, and its own **256 MiB** ceiling on `POST /api/documents/upload/cctv` — enforced independently of the 50 MB document limit, which is unchanged. The `cctv_stormwater` `documentType` is offered on the upload surface and lot-gated. | **`storage_only`** *(`[LP5-DELTA]`: was `gap_closable` until `#1689`; this is the only coverage value the profile has ever changed)*. CIVOS now **holds, files and lists** a CCTV run against a lot; it does not decode, index or validate one, and never will — the coded observation record is the CCTV specialist's deliverable, produced in WinCan or PipeTech. Same verdict as (h), for the same reason. **Two limits remain, stated not hidden:** a run larger than 256 MiB cannot be uploaded until a resumable/streaming path exists (the shipped path buffers whole files in memory), and **31 runs at the ceiling fill the entire archive admission cap on their own** *(unchanged by the 2026-07-29 decision: the admission cap is **7.92 GiB**, being 8 GiB of output less the 1.0% compression-headroom margin — §4.5.3 — and 7.92 GiB ÷ 256 MiB is still 31).* The resolver still never returns `missing` — CIVOS records nothing that says whether a lot contains underground stormwater infrastructure, so "no run held" stays `not_assessable`. |
| **(f)** | 6 | *"photographs, video or digital imagery covering major asset attributes … not covered in (e)"*, with sub-clauses **(i)** below ground / not visible after completion · **(ii)** taken prior to backfilling · **(iii)** chainage or exact location in the **filename** · **(iv)** date stamped · **(v)** *".jpg format, no less than 4MB per file **or** 720x576 resolution"* | `asset_attribute_imagery` | `Document.captureTimestamp` and `mimeType` (`schema.prisma:1609-1611`), GPS coordinates, the shipped photo-pin and chainage-generator work, `Lot.chainageStart`/`chainageEnd` (`:551-552`). | **`partial`.** (iv) date stamp and (v) format are assessable today; location is shipped via GPS and the photo-pin and chainage-generator work. Qualifying clauses **(i) and (ii) became RECORDABLE in `#1689`** (§4.8 item 3): the `concealed_works_photo` classification shipped as a `documentType` value on the upload surface, with **no `Document` column added** (`[DH-e]`). It stays `partial`, not `shipped`, for two customer-visible reasons: the value is **OPERATOR-APPLIED**, so an unclassified lot means *"not classified"* and never *"not concealed"* — the resolver says exactly that (`"photographs present, none classified under clause (f)(i)-(ii)"`, `not_assessable`, never `missing`) — and the filename rule (iii) is still D1c.2 (§4.7.3, **AT-140**). Clause (v) is a **disjunction** and is treated as one: CIVOS stores no image dimensions, so a sub-4 MB photo is reported *unconfirmed*, never failed (`PSP5_PHOTO_MIN_BYTES`, decimal reading). |
| **(g)** | 7 | *"a list of assets and/or major components in editable spreadsheet format comprising assets with design life, geographical, geometrical attributes consistent with the as-constructed drawings"* | `asset_list` | Nothing. The 78-model schema has **no `Asset`, `Pit`, `Pipe`, `Manhole`, `Node` or `Conduit` model** (§3.6, re-verified). | **`gap_deliberate`**, and deliberately not closed. This is the surveyor's and consultant's deliverable, from the same survey that produces the as-constructed data file. Building an asset register to fill it is §11's forbidden over-build wearing a requirement-list costume. |
| **(h)** | 8 | *"copies of maintenance and operation or vendor manuals"* for bridges; street lighting, traffic lights, electrical assets; gross pollutant traps; WSUD assets. **Clause (2)**: finalised on completion of commissioning, **in pdf format**, covering design, construction, operations, maintenance routines and procedures | `om_manuals` | `Document` with `documentType: 'om_manual'` and a manifest category. **`[LP5-DELTA]`:** the resolver read `om_manual` from D1b.0 but **no upload option wrote it** until the D1d follow-up added it to `DOCUMENT_TYPES` (`frontend/src/pages/documents/documentsUploadData.ts`), so (h) resolved `not_assessable` for every lot however many PDF manuals a customer uploaded. | **`storage_only` — and that phrase is the whole verdict.** A PDF manual uploads and files correctly today under the existing MIME allowance, and clause (2)(b)'s pdf requirement is assessable from `mimeType`. CIVOS stores and lists it; it does not assemble, index or validate it, and is explicitly **not** an O&M manual builder (§11). The folio says *"present, as supplied"* and never implies review. |

> **Score, regenerated from `LOGAN_PSP5_ITEMS` and pinned by test: of EIGHT
> mandatory pack items, CIVOS ships **two** as storage (e, h), **partially** feeds
> **three** (c, d, f), and does **not** feed **three** (a, b, g) — all three
> deliberate and permanent.** Distribution: **2 `storage_only` · 3 `partial` ·
> 3 `gap_deliberate` · 0 `gap_closable`. Nothing is `shipped`,** and promoting any
> item to `shipped` fails a test.
>
> **`[LP5-DELTA]` — what `#1689` (D1d) changed.** Item **(e)** moved
> `gap_closable` → `storage_only`. That is the **only** coverage value this
> profile has ever changed, and it moved because the gap was **closed**, not
> re-described: `CCTV_UPLOAD_SUPPORTED` is now `true`, the video allow-set and the
> 256 MiB ceiling ship, and the resolver reports held runs. **There is no
> `gap_closable` item left in the pack.** `LoganPsp5Coverage` keeps the value in
> its vocabulary anyway, because a future pack or a future authority may have one
> — not because this one does.
>
> **Score history, kept because each revision's line was read as uncritically as
> the last.** Rev 2 claimed four fed, one partial, two gaps over seven items.
> Rev 3 originally claimed one / three / three over seven items. `#1679` corrected
> the item count to eight and scored one / three / four (three deliberate, one
> closable). `#1689` closed the closable one, giving **two / three / three**.
> Rev 2 and Rev 3 were each wrong **against their own evidence** — Rev 2's cells
> said *partial* and *nothing can be uploaded* in their own text; Rev 3's list was
> one item short because it was read against a rendering rather than the clause.
> The only defence that has actually worked is **making the score executable**
> (§2.3): every line above is now a `distribution` assertion in
> `loganPsp5Profile.test.ts`, so a coverage change that does not reach this
> section fails a test rather than aging quietly.

**All three remaining gaps are deliberate and permanent** — (a) and (b), because
consultant certification is not ours to make, and (g), because asset registers
are not our product. **There is no longer an open closable gap:** (e), CCTV, was
the one, and `D1d` closed it rather than leaving it mis-scored as shipped —
`storage_only` with its 256 MiB ceiling named is the honest verdict, not a
promotion. The honest claim remains *"a clean, certifiable evidence bundle your
engineer can lodge"* — it is just a smaller bundle than Rev 2 said, and the items
CIVOS does cover are still the ones the head contractor is on the hook for.

**Item (c)'s eighteen matters, and the one that makes the pack open-ended.**
`LOGAN_18` (`loganPsp5Crosswalk.ts`) transcribes all eighteen with their roman
numerals. Ten map to a canonical `TestCategory`; **eight are unmapped with a
stated reason each** — three name a material *"quality"* whose constituent tests
the clause does not enumerate ((iv), (viii), (x)); one names spray and
application **rates**, a placement record rather than a test ((xii)); three name
hydraulic or water tests for which `testTypeSpecifications` has no category at
all ((xv), (xvi), (xvii)); and one is **(xviii) *"any other job specific testing
carried out or required by the engineer"***. An empty mapping with no reason is a
type error and a test failure.

**(xviii) is not a curiosity — it is the reason item (c) never reports a matter
as `missing`.** The pack's own boundary is not enumerable, so an unrecognised
test type must never be reported as *"outside the pack"*: it may be exactly the
job-specific testing the engineer required. Completeness therefore stays the
certifying consultant's determination, and every reason string the resolver emits
says so.

### 2.3 `LoganPsp5RequirementProfile` — the mapping becomes executable

`[DR2-B1]`'s deeper finding is not the arithmetic. It is that **§2.2 is a prose table, and D1b.0 was told to render "expected → present → missing" against it.** A folio cannot read a markdown table. A score nothing executes is a score nobody can be wrong about — which is exactly how Rev 2's was wrong for a full revision.

> **`D1b.0` ships a versioned `LoganPsp5RequirementProfile` and an executable resolver, one function per pack item — SHIPPED in `#1679`.** The profile is data: a `profileVersion` (`logan-psp5.v1`), and for each of the **eight** items a `letter`, `number`, `id`, the verbatim PSP5 clause reference and text, a `coverage` value (`shipped` | `storage_only` | `partial` | `gap_deliberate` | `gap_closable`), and a `coverageNote`. §2.2 is generated from it, not the other way round.

Per-item resolver contract — each returns `present` (with its evidence row ids), `missing` (**named**), `not_applicable` (**with the reason**), or **`not_assessable`** (with the reason CIVOS cannot tell). That fourth state is new in Rev 3 and it is the one that keeps the profile honest.

**The table below is regenerated from the shipped resolvers** (`loganPsp5Profile.ts:505-834`, entry point `resolveLoganPsp5Profile:836`), not from Rev 3's original prose:

| Cl. | Profile `id` | Resolver | Returns `not_assessable` when |
| --- | --- | --- | --- |
| **(a)** | `inspection_testing_certificate` | Constant `gap_deliberate` (`resolveCertificate:505`). **Structurally incapable of returning `present`** — it takes no input at all. | — (never assessed; it is not ours) |
| **(b)** | `foundation_conditions_certification` | Constant `gap_deliberate` (`resolveFoundationCertification:512`). Same: takes no input, cannot return `present`. **`[LP5-DELTA]` — this row did not exist in Rev 3's original table.** | — |
| **(c)** | `test_results` | The **Logan-18 crosswalk** over the lot's verified `TestResult` rows (`resolveTestResults:533`, `resolveLogan18Coverage:410`). | A lot's test-type string resolves to no canonical category — reported **by name**, never silently dropped. **This resolver never reports a matter as `missing`**, because (xviii) makes the pack open-ended and CIVOS has no evidence-backed mapping from a lot's work to the matters that apply to it. Its one `missing` verdict is *"no verified test result of any kind"*, which names no matter. |
| **(d)** | `retest_rectification` | Failed verified tests → linked NCR (`linkedTestResultId`) → `rectificationNotes` / `NCREvidence` (`resolveRetestRectification:622`, triage at `triageFailedTests:585`). | A failed test has no NCR and no linkable retest — the §2.2 item-(d) hole, printed as *"failed — rectification not linked"*. |
| **(e)** | `cctv_stormwater` | Documents of the CCTV type on the lot (`resolveCctv`). Since `#1689` flipped `CCTV_UPLOAD_SUPPORTED` to `true`, held runs resolve `present`. | **When no CCTV file is held** — and it is `not_assessable`, never `missing`, because CIVOS records nothing that says whether this lot contains underground stormwater infrastructure requiring a run, and a run over 256 MiB still cannot be uploaded. Blaming the customer for a gap we own is the worst thing this document could do. **The premise stays pinned in both directions:** the test asserts `isAllowedCctvVideoMimeType('video/mp4')` is `true` on the CCTV surface **and** `isAllowedDocumentMimeType('video/mp4')` is still `false` on the general document surface, because §4.8 item 1 required a separate allow-set rather than a widening. Narrowing either fails a test. The `!CCTV_UPLOAD_SUPPORTED` branch is retained as the honest rollback output. |
| **(f)** | `asset_attribute_imagery` | Documents of the photo / concealed-works types with `captureTimestamp` and `mimeType` (`resolveAssetImagery:712`). | The lot has photos but none classified as concealed works — reported as *"photos present, none classified as concealed works"*. Clause (f)(v)'s size limb is a **disjunction**: a sub-4 MB photo is *unconfirmed*, never failed, because CIVOS stores no image dimensions. |
| **(g)** | `asset_list` | Constant `gap_deliberate` (`resolveAssetList:772`). Takes no input; cannot return `present`. | — |
| **(h)** | `om_manuals` | Documents of the O&M type (`documentType: 'om_manual'`), `storage_only` (`resolveOmManuals`). Clause (2)(b)'s pdf requirement assessed from `mimeType`. | When no manual is held — CIVOS cannot determine whether the lot includes the asset types clause (h) enumerates. **`[LP5-DELTA]`: that was the answer for EVERY lot until the D1d follow-up put `om_manual` in `DOCUMENT_TYPES`** — the resolver read a value no surface could write. |

**Three of the eight — (a), (b) and (g) — are structurally incapable of returning `present`**, and that is asserted against a *maximally-populated* fixture, not merely an empty one. Two consultant-signed certifications and the surveyor's asset list: none of them ours to produce.

**The Logan-18 crosswalk moved from D1e into `D1b.0`** and was the phase's largest single piece of content. It is a versioned data table (`LOGAN_18`, version `logan-psp5-18.v1`) mapping the 18 PSP5 matters onto `TestCategory` values, governed by the rules `testCategories.ts:29-85` already establishes for the alias table — **the model to copy, not to duplicate**: same shape, same per-entry provenance comment, same "removing an entry is a normal PR, adding one is pack-class" governance. **AT-144**, **AT-145**.

**Two things the shipped crosswalk records that Rev 3 did not anticipate**, both `[LP5-DELTA]`-adjacent and both load-bearing for the folio:

- **Seven of the ten mapped matters are `ambiguous`, derived from the table itself** rather than declared per entry (`isAmbiguouslyAttributed`). Five of the eighteen are *compaction* of different materials at different levels, and the canonical vocabulary has one `compaction` with no layer or material discriminator — the same gap `vicroads-204.v1.ts:40-44` records. So a verified compaction test is **evidence toward five matters and proof of none**, and the folio must say so rather than tick a box.
- **`TEST_TYPE_ALIASES` resolves only `compaction` at the SHA `#1679` shipped against**, so five of the ten mapped matters are unreachable through resolution today. A test pins that, so widening F1's alias table forces a re-read of this crosswalk instead of a silent assumption it already worked. Rev 3's expectation that the crosswalk would ship *"with the QLD compaction-family aliases that `testCategories.ts` deliberately omits"* was **not met and deliberately so** — widening the canonical alias table is an F1-governance change, not a Wave D one.

*ponytail: the profile is a frozen object and eight small functions, not a rules engine. It gains a second authority the day a second authority exists (§4.9) — and `profileVersion` is there so that day is additive rather than a rewrite.*

### 2.4 What the mapping changes about D1

1. **The folio gets an expected-requirements input it does not have today.** Rev 1's folio was the shipped certificate with a database row attached; it could not say "two missing, by name" because nothing tells it what to expect. **§2.3's profile is now that input** — and it is code, so AT-144 can assert it.
2. **Determinism gets a purpose.** §4.7.3's deterministic archive paths were a nice property in Rev 1. Pack item **(f)(iii)** makes them a **requirement**: chainage in the filename is a council-enforced condition. D.0 also notes this is the shape the engineer's ADAC `SupportingFile` field (a bare 254-character filename string, no type, no hash, no URI) can reference — a free consequence, not new work.
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

`Document` (`:1597-1643`): one model for photos and documents, discriminated by `documentType`, with `lotId`, `fileUrl`, `mimeType`, `gpsLatitude`/`gpsLongitude`/`captureTimestamp` (`:1609-1611`), and version tracking (`version:1618`, `parentDocumentId:1619`, `isLatestVersion:1620`). **No checksum column. No chainage column** (§2.2 item (f) does not need one). **And no field qualifying a photo as concealed-works or pre-backfill** — the §2.2 item-(f) gap `[DR2-B1]` surfaced, closed by a `documentType` value in D1d (§4.8).

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
| **D1c.0** | M | none (spike) | nothing | `[DR-B6]`, `[DR-A3]`, `[DR-A4]`, **`[DR2-B6]`**. Streaming/storage benchmark against **predeclared thresholds**; the split cap formula; the writer decision; the **pre-declared** cost ceiling. **DONE 2026-07-29** — cap 8 GiB decided, ~~no writer selected~~ **`archiver` 8.0.0 SELECTED** after the §4.5.7 re-grade and Jay's §16.1 **J10** threshold amendment, cost measured over the ceiling and answered by J9. |
| **D1c.1** | M | 1 (`HandoverExport` + `HandoverExportMember` + `ArtifactLegalHold`) | D1b, D1c.0, **§4.5.7's re-grade** | `[DR-B5]`, `[DR-B7]`, **`[DR2-B5]`**, **`[DR2-B7]`**. Frozen-member ledger, job schema with lease/fencing, expiry and append-only legal hold. **UNBLOCKED by J9**; opens with the §4.5.7 re-grade, which selects the writer. **No paywall — `[DH-k]`.** |
| **D1c.2** | L | none | D1c.1 | The worker with **lease-keyed object writes and CAS publish**, the manifest, the streamed download, the UI. **The worker is a separate process, not an in-API interval — `[DH-j]`, §4.7.7.** |
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
2. **Carries expected → present → missing → not-assessable**, resolved by the **`LoganPsp5RequirementProfile`** (§2.3) — not read from a prose table. Every one of the **eight** pack items resolves through its own function, and the folio prints the resolver's verdict and its reason. "Three of five present, the other two named" is structurally possible for the first time, and **so is "CIVOS cannot yet assess this"**, which §2.3 shows is the honest answer for CCTV whenever no run is held — `#1689` shipped the capability, but CIVOS still records nothing that says whether a lot needed one.
3. **Ships the Logan-18 crosswalk** (§2.3) — pulled into this phase from D1e, because item **(c)**'s resolver cannot name a missing category without it.
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

> **SHIPPED — `docs/plans/wave-d1b-threat-model-2026-07-28.md`.** Eight threats, T-1 … T-8, all dispositioned `Mitigate before D1b` with a named mechanism and a named test; **nothing is dispositioned `Block`**, so D1b is buildable once those eight exit conditions hold. It mints **AT-152 … AT-156** and extends **AT-132**. Three findings there change what D1b has to build rather than merely what it has to check: the storage-path guard `assertSafeStorageId` is **module-private** (`scheduledReports/artifacts.ts:51`) and must be exported before it can be reused; the only rate limit a new `/api/lots` route inherits is the **global 1000/min/IP** at `server.ts:116`, which is not a mitigation for reservation exhaustion; and **AT-124's "rejected, not merely ignored" is unachievable under the repo's validation convention** — there are **zero** `.strict(` schemas against 100 `z.object(` in `backend/src/routes`, and plain `z.object()` strips unknown keys silently and returns 2xx. That last one is recorded nowhere else and is the single most likely thing for an implementer to silently reinterpret into the weaker assertion.

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

> **DECIDED — `pdfkit` 0.19.1. AT-151 passes and did not fire.** Harness `backend/scripts/bench-pdf-folio.mjs`; results committed at `backend/scripts/bench-results/pdf-folio-2026-07-28T12-04-29-843Z.json`; full write-up in **§10 of `docs/plans/wave-d1b-threat-model-2026-07-28.md`**.
>
> | Candidate | Native build step | Byte-deterministic | p95, reference lot | p95, 50-lot | Peak RSS | Footprint |
> | --- | --- | --- | --- | --- | --- | --- |
> | **pdfkit 0.19.1** | **none** | **yes** | **25.79 ms** | 117.05 ms | 28.96 MiB | **19.5 MiB** |
> | pdf-lib 1.17.1 | none | yes | 21.66 ms | 207.32 ms | 52.71 MiB | 20.8 MiB |
> | jspdf 4.2.1 | none | yes, only with `setFileId` | 16.09 ms | 154.89 ms | 43.47 MiB | 40.7 MiB |
>
> **All three cleared every bar, so no candidate was disqualified.** Wall-clock and memory are **thresholds** here, not scores — this section declares no ranking on them — so selection fell to the one tie-breaker this section does name: installed footprint. Picking jspdf for a 10 ms edge would be inventing a ranking after seeing the numbers, which is the `[DR2-B6]` failure the predeclaration exists to prevent. Corroborating but not deciding: pdfkit is the only candidate supplying **every** layout primitive the §4.3.2 contract needs natively — measurement, wrapping, pagination, retro-active page access (`bufferPages` + `switchToPage`), standard-14 fonts with no embedding, and a top-left origin.
>
> **One constraint this hands to D1b, library-independent:** the renderer must pin its document id and creation/modification dates **from the snapshot**, never from `Date.now()` or a library default. jsPDF writes a random `/ID` per render; pdfkit's `info.CreationDate` / `info.ModDate` default to the current clock. Either left alone makes **AT-127 unimplementable**.

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

> **RUN AND MERGED, 2026-07-29.** `docs/plans/wave-d1c0-spike-report-2026-07-29.md`; results in `backend/scripts/bench-results/zip-spike-2026-07-28T17-52-20-842Z.json`, `zip-spike-zipjs-2026-07-28T18-54-20-123Z.json`, `zip-cost-2026-07-28T19-22-51-347Z.json` and `d1c0-frozen-members.json`; harness `backend/scripts/bench-zip-spike.mjs`. **No threshold below was moved to manufacture a result, and AT-150 is satisfied on that basis.** §4.5.2, §4.5.3 and §4.5.6 below record what the measurement decided; **§4.5.7 states what `D1c.1` must re-measure before it selects anything.**

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

**AMENDED 2026-07-29 by Jay — rows 1 and 3 only. `§16.1 J10` is the decision; this is its effect on the table above, which is otherwise left exactly as predeclared.**

The rows above are **not rewritten and not deleted** — the numbers, and the rationale sentences that produced them, stay readable as written. Two scoping clauses are added:

| Row | Amendment | Why the row's own rationale no longer reaches the case it failed |
| --- | --- | --- |
| **3 — event-loop stall** (≤50 ms max, ≤20 ms p99) | **Binds the API process only.** Asserted against the API process during an archive job, per §15 item 11. **It does not bind the archive worker's own loop**, for which the operative bars are **row 4** (cancellation ≤5 s, cleanup ≤30 s) and the §7.4 lease/heartbeat cadence. | The row states its own rationale: *"The API process serves user traffic during archive jobs; a 500 ms stall is a user-visible outage."* **`[DH-j]` (§16.2), decided BEFORE this re-grade and on independent measured grounds, moved the archive worker out of the API process.** A stall inside a process serving no requests has no user waiting behind it. `archiver`'s measured **65.9–72.7 ms max, p99 4.38 ms** at 8,334 members is therefore **out of this row's scope — recorded, not erased** (spike report §7.2, §7.4). |
| **1 — RSS flatness** (±15% across 1 → 8 GiB) | **The ±15% band governs only where peak RSS exceeds a 128 MiB floor.** Below the floor, **the absolute ≤256 MiB cap in the same row governs alone**. The cap itself is unchanged. | The band exists to operationalise "memory flat" — to catch **unbounded growth** toward the cap. At `yazl`'s measured **19.86 → 38.67 MiB** it is instead flagging fixed startup overhead against scale overhead, at **15% of the 256 MiB cap**: a ratio artefact, not a leak. The floor keeps the band's teeth at the scales where growth could actually threaten the cap, and removes them only where the absolute number already answers the question. |

**Stated plainly, because the spec's own honesty rules require it (`[DR2-B6]`, §1): both amendments were made AFTER the measurement.** That is exactly what predeclaring thresholds exists to prevent, and it is exactly why these two carry **Jay's dated approval in §16.1** rather than an engineering edit to this table. **A build agent may not move a row here; only Jay may, and only as a new dated row.** The un-amended verdicts stand unedited in `docs/plans/wave-d1c0-spike-report-2026-07-29.md` **§7.1** and **§7.6** as the record of what the bars said before the amendment.

**Untouched, and still predeclared exactly as written:** **row 5** integrity (three readers, **zero** mismatches — not a rate), **row 4** cancellation, **row 6** byte-identical resume, **row 2** in full, **row 1's absolute ≤256 MiB cap**, and ZIP-standard compatibility. Nothing in this amendment reaches the correctness of the artefact.

**4.5.2 The writer decision (`[DR-A4]`).** `J4`'s "`fflate`, zero transitive dependencies" is **withdrawn as a recommendation** — zero deps is not the deciding axis. The axes are **ZIP64 support**, Node stream backpressure, large-member support, event-loop behaviour, and whether it composes with a resumable upload. Benchmark `fflate`, `archiver`, `yazl` and a Web Streams/ZIP64 option. Note against `fflate` specifically: it advertises support only up to 4 GB files, so it is **not proven** for the proposed cap. **A hand-rolled ZIP container remains rejected** — CRC-32, local headers, central directory, UTF-8 flags and ZIP64 in a path where a corrupt archive is a corrupt legal record.

**The measured verdict (2026-07-29) — no candidate passes, and one is disqualified for good.** *(Superseded as the standing conclusion by the selection block below — `archiver` 8.0.0, after the §4.5.7 re-grade and §16.1 `J10`. Left unedited: this is the verdict at 50 GB scale under the un-amended rows, and `fflate`'s permanent rejection is unaffected by anything that follows.)* Four writers were benchmarked against the six §4.5.1 fixtures at the 50 GB reference scale. **Every one missed at least one predeclared row**, which is the outcome §4.5.1 named in advance, and no row was relaxed:

| Candidate | Missed | The finding that matters |
| --- | --- | --- |
| **`fflate` 0.8.3** | F1, F3, **F5** | **REJECTED PERMANENTLY, and this is recorded hard.** Above 4 GiB it does not error — it emits an archive whose **central directory is corrupt** and returns success. Three independent readers refuse it: `yauzl` (*"invalid central directory file header signature"*), Info-ZIP `unzip -t` (exit 2/3), and the Windows Explorer shell handler (opens, lists **0 items**). A writer that reports success on a corrupt legal record is disqualified on that alone (§10.2). **`J4`'s withdrawal of the `fflate` recommendation is vindicated on evidence, and no re-grade at any cap reopens it.** |
| **`archiver` 8.0.0** | **F2**, F3 | The only F1 pass — flat to 6.6% across 1→8 GiB, both ZIP64 limbs valid under three readers. Fails F2 on **per-entry cost: 475.73 MiB peak RSS at 50,000 members**, and exceeds the 50 ms stall bar **even at 5,000 members** (92.3 ms). |
| **`yazl` 3.3.1** | **F1**, F3 | Closest to selectable: best memory in the field at 50,000 members (145.9 MiB), passes F2, F4, F5, F6. Its F1 flatness miss (20.00 → 39.05 MiB, **95.2%**) is **the only miss in the whole field not explained by member count**, and it was already measured across exactly the 1→8 GiB span the new cap sets. |
| **`@zip.js/zip.js` 2.8.34** | **F1**, **F2**, F3 | Correct output wherever it completed and the best refusal behaviour in the field (it *tells you* to set `zip64` rather than corrupting), but the worst memory (818.41 MiB, 3.2× the cap) and the worst stall (696.3 ms). **Two structural bars missed; it does not return to the re-grade.** |

**SELECTED, 2026-07-29 (after the §4.5.7 re-grade and Jay's §16.1 `J10` amendment): `archiver` 8.0.0.** The verdict table above is left as measured at 50 GB scale and is superseded as the standing conclusion by this paragraph and by §4.5.7's outcome block. Under the amended §4.5.1 rows both surviving candidates pass, so the selection is made where §4.5.2 always said it would be — **on the five axes, in the order this section states them**, against the re-grade's measured evidence (spike report **§7.2**, **§7.8**):

| # | Axis | `archiver` 8.0.0 | `yazl` 3.3.1 | Result |
| --- | --- | --- | --- | --- |
| 1 | **ZIP64 support** | Both limbs correct — 8,592,561,410 B total, 4,833,313,097 B single member; 8,334-entry central directory, offsets valid, names unique; accepted by **yauzl**, **Info-ZIP `unzip -t` (exit 0)** and the **Windows Explorer shell handler** | Same three readers, same result (8,592,561,826 B / 4,833,313,106 B) | **tie** |
| 2 | **Node stream backpressure** | The archive object **is** a `Readable`; native backpressure through `.pipe()` | `zip.outputStream` is a `Readable`; native backpressure | **tie** |
| 3 | **Large-member support** | Peak RSS **37.48 → 38.82 MiB** across 1 → 8 GiB (**3.6%**); single >4 GiB limb 38.10 MiB | **19.86 → 38.67 MiB** (**94.7%**) — roughly doubles across the same span | **`archiver`, by 26×** |
| 4 | **Event-loop behaviour** | Max stall **69.99 ms**, confined to the 8,334-member central-directory leg (≤16.43 ms on every other leg); **p99 4.38 ms** | Max stall **16.91 ms**; **p99 15.50 ms** | **`yazl` on the maximum (4.1×); `archiver` on p99 (3.5×)** |
| 5 | **Resumable-upload composability** | `Readable` straight in as `@aws-sdk/lib-storage` `Upload`'s `Body` — §4.5.3's decided delivery path | Identical shape via `outputStream` | **tie** |

**The reasoning, and the argument against it.** Three axes tie on measured evidence. **The first axis that separates the candidates is axis 3, and `archiver` wins it decisively** across exactly the 1 → 8 GiB span the cap sets. `yazl` wins axis 4's headline number — and **if this section's axes were ordered event-loop-first, `yazl` would be selected**. They are not, and an ordered list applied in its stated order is the only kind that decides anything; re-ordering it after seeing the numbers is the failure mode `[DR2-B6]` closed. Three measured facts weigh with that, none of them decisive on their own: the 69.99 ms tick lands in the **archive worker's** loop, not the API process (`[DH-j]`, and §4.5.1's amended row 3); on **p99** — the statistic a repeated lease heartbeat depends on — `archiver` is 3.5× better; and `archiver`'s stall is a stable, bounded per-entry cost (five probe samples, 65.9–72.7 ms) at a member count the cap fixes, not a tail that grows with archive size.

**What is honestly given up by selecting `archiver`:** a worker loop that stalls ~70 ms per archive at the central-directory write, against `yazl`'s ~17 ms. That is a real cost to the worker's own responsiveness and it is recorded here rather than argued away. **`[DH-j]` is not flipped** — its flip condition required the selected writer to hold ≤50 ms at the per-archive member ceiling, and `archiver` does not.

**Nothing is installed by this selection.** Both candidates remain dev-installed in the gitignored `backend/scripts/bench-zip-deps/` tree; **`D1c.1` installs `archiver` 8.0.0 as a production dependency**, under `[DH-c]`.

**Fixture 3 is a special case, twice over.** Every candidate passed p99 comfortably (6.0–12.9 ms against 20 ms) and every candidate failed the ≤50 ms single-tick maximum, by 2–14×. But (a) the spike's absolute stall numbers were taken on a **load-contaminated box** — 24 node processes, 72–78% system CPU busy, and one 25,000-member sample swung 28.3 → 129.4 ms on identical input — so the *shape* (monotonic in member count) is trustworthy and the absolute values are not; and (b) **the `[DH-j]` decision to run the worker outside the API process (§16.2) removes fixture 3's user-facing rationale entirely.** §4.5.1's threshold exists because it assumed the job shares the process that serves user traffic. It no longer does. The row is **not** thereby marked passed — it is re-measured under §4.5.7 and re-asserted against the API process, per §15 item 11.

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

The admission cap is set **below** the output cap by a declared compression-headroom margin, chosen in `D1c.0` from the measured input→output ratio on fixture 2 (evidence photos and PDFs compress poorly; the margin should be small and honest, not optimistic). Supabase standard upload tops out at 5 GB and recommends TUS above 6 MB; **TUS/S3 paths reach 500 GB** — *corrected 2026-07-29: Rev 3 wrote 50 GB, which was stale. Supabase raised the ceiling to 500 GB on 2025-07-18 and the current S3-uploads guide and pricing page both state it; the 50 GB figure survives only on a troubleshooting page that contradicts both. The consequence is not cosmetic: **the upload protocol is not the binding term this paragraph assumed, so the premise that would have forced split archives does not exist.*** **The 50 GB reference exit gate and a 5 GB first-release cap are mutually exclusive** — `D1c.0` decides between raising the cap onto a TUS/S3 path, split archives, or an object-tree package, and **§15's exit gate is amended to whichever it picks.**

**DECIDED, 2026-07-29 — the cap, the margin and the delivery path.**

| Term | Decided value | Basis |
| --- | --- | --- |
| **`effective_cap`** | **8 GiB of output per archive** | `zip_writer_member_limit` binds. 8 GiB total (and 4.5 GiB single member) is the largest any candidate was **measured** to produce correctly; it is a floor on the writers, not a proven ceiling, and nothing above it is asserted. |
| **`admission_cap`** | **7.92 GiB of estimated input** (`effective_cap × 0.99`) | A **1.0% compression-headroom margin**, set from the worst measured output/input ratio of **1.000919** — **deflate expands incompressible content**. The fixture-2 mix ratio of 0.944 is deliberately **not** banked: it is favourable only because that mix carries text and partly-compressible PDF, while the projects that actually reach the cap are photographs and CCTV. 1.0% is roughly an order of magnitude above both measured contributions (0.09% expansion + ~0.1% ZIP64 structural overhead at ~172 bytes/member) and is the smallest round number that is not optimistic. |
| **Delivery path** | **S3 multipart** (`@aws-sdk/lib-storage` `Upload`, the writer's `Readable` as `Body`) | Needs no total size upfront and composes directly with every viable writer. **Not TUS:** a streaming ZIP does not know its size until the last byte, so TUS needs `creation-defer-length`, and **Supabase documents no `Upload-Defer-Length` support anywhere** — the string does not appear in its docs and an `OPTIONS` probe returns no `Tus-Extension` header. Choosing TUS would force staging the whole archive on Railway's ephemeral disk to learn its size, which §10.3 forbids relying on. `@aws-sdk/lib-storage`'s default 5 MiB part size × the 10,000-part cap gives 46.6 GiB and **must be set deliberately**, not discovered. |
| **Member-count limit** | **NOT SET — deliberately** | Not certifiable on the box the spike ran on (§4.5.7). It is set by the re-grade, not by this revision. |

**A reference-dataset project is ~6 archives, and that is now the design, not a workaround.** 50 GB of evidence compresses to ~47.2 GB, i.e. **6 archives at the 8 GiB cap**. So **§4.7's scope selector — `scope Json` as `{kind:'project'|'area'|'lots'}` (§7.4) — is promoted from a convenience to the mechanism by which a large project fits under the cap**, and the preflight (§4.5.4) must say so when it refuses: a refusal names the scope that would fit, not just the number that did not. **AT-130 is unchanged** — the cap still refuses, and still never truncates.

**Splitting is not a cost saving, and reading it as one is the easiest mistake here.** One 8 GiB archive costs A$7.23, comfortably inside A$12.00; six of them cost **A$43.36**. Splitting changes *the unit the ceiling is measured in*, not the customer's bill. That is precisely why the ceiling could not be rescued by a lower cap and why J8 went to Jay — see §4.5.6 and §16.1 **J9**.

**4.5.4 The preflight cannot measure everything, and must say so.** `HoldPoint.releaseSignatureUrl` and `evidencePackageUrl` are bare strings with no stored size (`schema.prisma:777-779`), and `Document` has no checksum. A counts-and-sums preflight is therefore an **estimate with a named unmeasured set**, not a measurement. The UI states the estimate, the count of unmeasured members, and the assumption used. `[DR-B6]`.

**4.5.5 `BigInt`, everywhere.** `fileSize Int` caps at 2,147,483,647 bytes on Postgres. Every byte count in `HandoverExport` and `HandoverExportMember` is `BigInt` (§7).

**4.5.6 The cost ceiling is declared BEFORE the measurement — `[DR2-B6]`.**

Program §8 line 145 requires the cost measured; Rev 1 gave no pass/fail; **Rev 2 gave a ceiling to be "stated" by `D1c.0` — i.e. chosen by the same people, after they saw the number.** That is not a gate. A ceiling set after measurement is a ceiling that always passes, and this is the single most expensive thing the product will do (§18.3 item 6).

> **The ceiling is written into this specification, now, before anyone has measured anything: a full-project archive on the program's reference dataset (§12: 5,000 lots, 50 GB evidence) must cost CIVOS ≤ AUD 12.00 ex-GST all-in for one generation plus three downloads within the retention window.**
>
> **`D1c.0` measures against that number. It does not get to choose it.** Above the ceiling, the feature does not ship at that cap — the fix is a lower cap, a cheaper delivery path, or a priced add-on, and each of those is a **Jay decision**, not an engineering one. **Only Jay may move this number, and moving it is recorded in §16 as a decision with a date — never edited in place.**

**How it is measured.** Bytes per leg — original reads, archive upload, storage duration across the retention window, first download, repeat downloads — plus Railway CPU/RSS and egress. **Railway bills service egress including uploads to object storage**, so a backend-mediated archive is at minimum a read leg, an upload leg and a download leg, and the naive "one transfer" mental model understates it by roughly 3×. The measurement records each leg separately so a future cheaper path can be evaluated against the same breakdown. **AT-150.**

**MEASURED, 2026-07-29: A$39.77 ex-GST against a A$12.00 ceiling — 3.31× over, FAIL.** Per leg: reads A$6.46, upload A$3.39, 30 days' storage A$1.42, three downloads A$9.49 each, compute A$0.03. **The bill is ~100% network** — compute is 0.08% of it, so no writer choice, compression level or CPU efficiency moves the number. **Generation alone, before anybody downloads anything, is A$11.30**, which leaves A$0.70 for three downloads of a 47 GB object; no published rate fits. And the two most expensive legs are expensive **because §10.2 requires them**: a backend-mediated download is Supabase egress plus Railway egress, and Railway bills a service for bytes it *uploads* to a bucket as well as bytes it serves. The three download legs are 72% of the total.

**Disposition: the ceiling was missed and Jay took the decision it hands him.** §4.5.6 named three responses — a lower cap, a cheaper delivery path, or a priced add-on — and reserved all three to Jay. **He chose the priced add-on on 2026-07-29 (§16.1 J9).** The A$12.00 number is not moved and not re-set; it is **retired as a ship/no-ship gate and re-purposed as the COGS reference line** the add-on's price must clear. `D1c.0`'s measurement stands exactly as taken.

**4.5.7 `D1c.1`'s entry gate — the targeted re-grade, on a quiet box (new, 2026-07-29).**

**`D1c.1` does not select a writer from `D1c.0`'s verdicts.** Those verdicts were measured at 50 GB output and 50,000 members on a **saturated machine** (§4.5.2). The cap decided in §4.5.3 is 8 GiB and ~8,000 members per archive — **a different scale**, and the spike's own §6.1 says the stall and RSS numbers do not survive the move. So `D1c.1` opens with one re-run, not a new build: **the harness already exists** (`backend/scripts/bench-zip-spike.mjs`, re-runnable with no database, no env and no network) and the re-grade is **one invocation of it**.

**The field entering the re-grade is two candidates: `archiver` and `yazl`.** `fflate` is permanently rejected (§4.5.2 — silent corruption, not a scale problem). `@zip.js/zip.js` missed **two structural bars** (F1 and F2) by margins the cap does not close, and does not return.

1. **F1 — at the cap.** Flatness measured **1 GiB → 8 GiB output**, which is what §4.5.1 already specifies and what the spike already ran. **This is not a fresh chance for `yazl` on the arithmetic** — its 20.00 → 39.05 MiB was measured across exactly this span. It is a fresh chance only on **box quietness**: §6.1 records RSS as ±40% run-to-run under load (`yazl` itself moved 244 → 146 MiB between runs). If the quiet figure still misses ±15%, the row stays FAIL.
2. **F2 — at the per-archive member ceiling the reference dataset implies.** Derivation, stated so it can be checked: the reference dataset (§12) is 50 GB of evidence, taken at §4.5.1's fixture-2 member count of **50,000 members**; at the 8 GiB cap it delivers as **6 archives**; **50,000 ÷ 6 = 8,333.3 → the re-grade runs F2 at 8,334 members**. The sweep in the spike bracket this: `yazl` sat at 15.7–23.1 ms and 47.6–69.5 MiB across 5,000–15,000 members, and `archiver` was already **92.3 ms at 5,000** — so the expected outcome is that `yazl` clears and `archiver` does not. **An expectation is not a measurement and does not substitute for the run.**
3. **F3 — on a QUIET box, and the quietness is a precondition, not a hope.** No sibling agents on the machine, no runaway processes, no concurrent `npm ci` / vite / prisma work; the harness already records system-wide CPU busy fraction per leg and **a leg that records a busy fraction consistent with contention is re-run, not reported**. The spike's contamination note (§6.1) is the reason this is written as a gate: it measured 72–78% busy and saw a single sample swing 4× on identical input. **Operationally: the box needs Jay's reboot first** — a runaway process documented in the spike's PR is still resident.
4. **F4, F5 and F6 — re-confirmed at the cap.** All three were clean sweeps at 50 GB, so the re-run is confirmation rather than investigation; F5 in particular re-confirms integrity under three readers at 8 GiB, which is the size that ships.
5. **Thresholds are UNCHANGED from §4.5.1.** Every number — 256 MiB, ±15%, 50 ms, 20 ms p99, 5 s, 30 s, zero mismatches, byte-identical — stands exactly as predeclared. **Predeclared numbers do not move because the scale did**, and a re-grade that moved one would be the homework-grading `[DR2-B6]` closed.
6. **Outcome, both branches named.** Either **one writer is selected** and `D1c.1` proceeds, or **no candidate passes at the cap either** and D1c re-scopes to **an object-tree package** — the named fallback from §4.5.1, and the only one left now that split archives are the shipped design rather than an alternative to it. **The re-grade is recorded against AT-150**, the same assertion re-run at the decided cap, not a new acceptance test.

**THE GATE'S OUTCOME, 2026-07-29 — executed, failed as originally specified, thresholds amended by Jay, writer selected.** The items above are left exactly as written; this is what happened when they were run. `#1692`; results at `backend/scripts/bench-results/d1c1-writer-regrade-2026-07-29T09-00-00-000Z.json` (`complete: true`); report §7.

1. **Executed.** Two candidates, at the cap (8 GiB output; F2 at the derived **8,334** members), on a box the harness certified quiet: **11.5% idle system CPU** against the spike's 72–78%, 22,585 MiB free, `regrade.contendedLegs` **empty** — so item 3's mandated re-run never fired. Every threshold in `fixtureThresholds` is §4.5.1 verbatim; only fixture 2's **scale** moved, which is what item 2 derives.
2. **It FAILED, exactly as item 6's second branch allowed.** `archiver` missed **F3 alone** (69.99 ms max stall, p99 4.38 ms ✓); `yazl` missed **F1 alone** (94.7% flatness, 19.86 → 38.67 MiB). **One row each, a different row each.** Item 1's pre-commitment held: `yazl`'s quiet figure still missed ±15% (95.2% loaded → 94.7% quiet) and **the row stayed FAIL**. Item 5 held: **no threshold moved during the run**. Both misses were re-confirmed over five samples rather than taken on one (report §7.4).
3. **Item 2's stated expectation was wrong in both halves, and the measurement decided.** `archiver` was expected to fail F2 and **passes it comfortably** — 93.05 MiB at 8,334 members against 475.73 MiB at 50,000; its per-entry memory cost was a member-count artefact the cap removes. `yazl` was expected to clear and does not. The spec said an expectation is not a measurement; it was not.
4. **Jay then amended two §4.5.1 rows — §16.1 `J10`, a new dated row, on the orchestrator's recommendation.** F3 binds the API process only; F1's ±15% band is floored at 128 MiB peak RSS. **This is an amendment after measurement and it is labelled as one** (§4.5.1's amendment block). Item 5's rule — *"predeclared numbers do not move because the scale did"* — is not weakened by it: neither number moved because of scale, and neither moved by an engineer's hand.
5. **`archiver` 8.0.0 is SELECTED**, on §4.5.2's axes in their stated order (§4.5.2's selection block; report §7.8). **Item 6's second branch does not fire: D1c does NOT re-scope to an object-tree package**, and that fallback stays in this specification, unchanged, as the fallback it is.
6. **Recorded against AT-150**, as item 6 requires — the same assertion re-run at the decided cap. **`D1c.1`'s entry gate is DISCHARGED** and `D1c.1` may proceed, installing `archiver` 8.0.0 as its production dependency (`[DH-c]`).

### 4.6 Phase `D1c.1` — the frozen-member ledger and the job schema

One migration: `HandoverExport` + **`HandoverExportMember`** + **`ArtifactLegalHold`** (§7.4–7.6). No worker yet.

> **UNBLOCKED, 2026-07-29 (§16.1 J9).** J8's ceiling was the one thing standing between `D1c.0` and `D1c.1`, and Jay has answered it: the archive ships as a **priced add-on**, so D1c builds the machinery. **`D1c.1` and `D1c.2` are both unblocked**, subject to §4.5.7's entry gate. *(Amended 2026-07-29, later the same day: **that entry gate has now RUN and is DISCHARGED** — it failed on its predeclared rows, Jay amended two of them (§16.1 **J10**), and **`archiver` 8.0.0 is selected**. `D1c.1` installs it as a production dependency (`[DH-c]`). D1c does **not** re-scope to an object-tree package.)* **The migration itself needs no change** — `[DH-j]`'s out-of-process worker (§16.2) wants precisely the `leaseOwner` / `leaseToken` / `leaseExpiresAt` / `heartbeatAt` fields §7.4 already carries, which is a consonance worth naming rather than a coincidence to rely on: a lease with a fencing token is what you build when the worker is *not* the process holding the request, and Rev 3 specified it that way for `[DR-B5]`'s reasons before `[DH-j]` existed. **What `D1c.1` does not build is the paywall** — see `[DH-k]`.

**4.6.1 Frozen members (`[DR-B7]`).** Rev 1's archive was "reproducible from immutable inputs" while selecting mutable, supersedable documents. `HandoverExportMember` rows freeze, at snapshot time: exact `FolioIssue`/`Document` id, **version**, storage locator, byte size (`BigInt`), source checksum, member state, and archive path. **If a folio is reissued mid-archive, the archive continues from its frozen snapshot and records the cutoff.** It never switches versions halfway through.

**4.6.2 Lease, fencing and heartbeat — fenced in storage, not only in the database (`[DR-B5]`, `[DR2-B7]`).**

`HandoverExport` carries `leaseOwner`, `leaseToken` (fencing), `leaseExpiresAt` and `heartbeatAt`. A worker renews its lease on a heartbeat interval, and **every state write is conditional on the fencing token**.

**Rev 2 then claimed a fenced worker "cannot upload", and `[DR2-B7]` is right that no database predicate can enforce that.** A stale worker holds an open HTTP connection to object storage; a conditional `UPDATE` in Postgres cannot un-send those bytes. Rev 2 asserted an invariant across a boundary it does not control, and AT-135 asked CI to prove it.

> **The fix is to make the stale upload harmless rather than impossible.** Workers do not write to a canonical archive key. Each writes to a **lease-token-specific key** — `handover-exports/{projectId}/{exportId}/{leaseToken}.zip` — so two workers physically cannot collide. Publication is a separate, cheap, atomic step: a **compare-and-swap on the export row** setting `fileUrl`, `sha256`, `fileSize` and `status='complete'` **only if `leaseToken` still equals the publishing worker's token**. A superseded worker's object is written, is **unreachable** — nothing points at it — and is removed by the sweeper (§10.5) alongside expired artefacts.

So the honest invariant, and the one **AT-135** now asserts: **a fenced-out worker cannot *publish*, cannot *finalize* and cannot *cancel*.** It may well finish uploading, and that is fine, because nothing can reach what it uploaded. Cancellation is fenced by the same CAS.

*ponytail: uniquely-keyed writes plus one compare-and-swap is the standard answer, and it is smaller than any scheme that tries to abort an in-flight upload. Storage costs a sweep; correctness costs nothing.*

**4.6.3 Restart semantics, stated exactly.** The honest default: **ZIP assembly restarts from the frozen member ledger**; completed member checksums are reused, no bytes are re-read that already verified, and the ZIP itself is rebuilt. Resumable multipart chunk state is persisted **only if `D1c.0` selects an upload path that supports it**, in which case the exact chunk/multipart state lives on the export row. **RESOLVED 2026-07-29: it does.** §4.5.3 selects **S3 multipart**, so `uploadState` (§7.4) holds **S3 multipart state** — upload id, part numbers and ETags — and is kept, not dropped. The restart semantics above are otherwise unchanged: the ZIP is still rebuilt from the frozen ledger, and multipart state is a transport-layer resume, not an archive-assembly one. **What is not permitted is Rev 1's implication that `processedLots` alone constitutes resume.**

### 4.7 Phase `D1c.2` — the worker, the manifest, the download, the UI

**4.7.1 `[DH-B2]` — the archive collects; it never renders.** A lot with no issued folio is written into the manifest as `folio: none` — a fact — and contributes its originals only. The UI shows "12 of 40 lots have no issued folio" before the job starts and offers to take the user to issue them, which is a human act on a human's screen. `[DH-b]` stands: no jsPDF in Node, because that needs the generator in a shared package, which is the refactor the standing rule forbids, and because it would let a background job emit a document nobody reviewed. *ponytail: collect-only; if pilots show progressive issuance is not happening, the fix is a nag, not a renderer.*

**4.7.2 The manifest.** `manifest.csv` (opens in Excel — that is what "searchable" means to the person who receives it) and `manifest.json`, same content, at archive root. One row per member: archive path, SHA-256, byte size, source record type and **id and version**, lot number, document type, original filename, uploaded-at, uploaded-by. Plus `manifest-summary.json` carrying scope, generated-at, generated-by, CIVOS version, per-lot folio status, the frozen-snapshot cutoff, and `omissions[]`. **`manifest-summary.json` is excluded from the determinism assertion** because it carries generated-at (`[DR-A9]`).

**4.7.3 Determinism, and the chainage filename rule.** Archive paths are `{lotNumber}/{category}/{sanitized-filename}`, lots ordered by `lotNumber` ascending with the comparator the reports already use (`scheduledReports/reportDocument.ts:107`), categories in a fixed declared order, files within a category by `uploadedAt` then id, collisions suffixed ` (2)` by that same order.

**From §2.2 item (f)(iii), with the format pinned per `[DR2-A1]`:** for photo-category members on a lot with a chainage, the sanitized filename is prefixed with the lot's chainage reference. Logan requires *"a chainage or exact location reference in the filename"*, and this is where that requirement is satisfied — a naming rule over `Lot.chainageStart`/`chainageEnd` (`schema.prisma:551-552`), **not** a column on `Document` (`[DH-e]`).

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

**4.7.6 The scope selector is how a big project fits — promoted 2026-07-29.** `HandoverExport.scope` (§7.4) was specified as `{kind:'project'|'area'|'lots'}` for the user who wants one area's evidence. Under the decided 8 GiB cap (§4.5.3) **it is also the only way a reference-dataset project is deliverable at all**: 50 GB of evidence is ~6 archives, and the UI must present that as the normal shape of a large handover rather than as a failure. So the preflight screen states, before the job starts, **how many archives the requested scope implies at the cap**, and a refusal names a narrower scope that fits — an area, or a lot range — instead of only reporting the number that did not. **The archives are siblings, not parts of a split file**: each is independently openable, each carries its own complete `manifest.csv`/`manifest.json` over its own members, and `manifest-summary.json` records the scope it covers. No multi-volume ZIP, no `.z01` chain, nothing that requires the receiving engineer to have all six before opening one. *ponytail: the selector already exists in the schema; this is a sentence on a preflight screen and a count, not a feature.*

**4.7.7 The worker is a process, not an interval — `[DH-j]`.** §16.2 decides that the archive worker **runs outside the API process**. That changes where D1c.2's code is started, not what it does: the same lease-token-keyed write and compare-and-swap publish (§4.6.2), the same manifest, the same streamed download served **by the API process** (the download is a request; it is not the worker's job). §13's rollback story is unchanged in effect — the worker stops without a deploy — but the mechanism is stopping a service rather than flipping an env var inside the API.

### 4.8 Phase `D1d` — CCTV **and concealed-works capability**, Scope A (S, no migration)

D.0-Q3 answered the scoping question at grade A: Logan specifies CCTV as **video files with named container formats** (§5.7.1(1)(a)) and Unitywater's deliverable is a digital-plus-hardcopy file set. WSA 05 Appendix A5 *does* define a per-observation XML, but **no Australian authority was found mandating that file by name**, and producing a conforming coded record is the specialist CCTV subcontractor's job in WinCan or PipeTech. The head contractor's obligation is **custody, completeness and timely submission**. That finding stands, and **Scope B remains deleted**, not deferred — it was a D2 dependency and D2 is gone.

**What `[DR2-B1]` changed: Rev 2's Scope A was not a capability.** Rev 2 sized this XS — *"a `documentType` value, a lot association, a manifest category"* — and scored pack item 4 as unblocked. **The shipped upload path rejects the deliverable twice** (§2.2 item 4): `ALLOWED_DOCUMENT_MIME_TYPES` (`documents/fileHelpers.ts:35-47`) has **no video type at all**, and multer caps every document at **50 MB** (`documents.ts:278`) against a routinely gigabyte-scale CCTV run. A `documentType` value for a file that cannot be uploaded is a dropdown entry, not a feature.

**Scope A, corrected — four things:**

1. **A video MIME allowance.** The Logan-named containers (*"WINCAM (version 7 or later) or CCTV footage or DVD-ROM … or MPEG 4"*) reduce in practice to `video/mp4` plus a small named set. **Added as a separate allow-set, not by widening `ALLOWED_DOCUMENT_MIME_TYPES`** — that set governs every document upload in the product, and video belongs only on the surfaces that expect it. **AT-149.**
2. **A separately-governed size ceiling** for that surface, well above 50 MB, declared as a number and enforced independently of the 50 MB document limit. It interacts with §4.5.3's admission cap — a project of CCTV runs is exactly the shape that hits it — so the ceiling is chosen with that arithmetic in front of whoever picks it.
3. **A pre-backfill concealed-works `documentType`** (§2.2 item (f), sub-clauses (i) and (ii)). Same root problem as CCTV: the schema cannot tell what a photo depicts, so the §2.3 resolver cannot distinguish "no concealed-works photos" from "photos present, none classified". One classification value fixes it; **no `Document` column is added** (`[DH-e]`).
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

Fields: `id`, `projectId`, `scope Json` (`{kind:'project'|'area'|'lots', areaId?, lotIds?}`), `status String` (`queued|snapshotting|processing|complete|failed|cancelled`), `requestedById`, `requestedAt`, **`leaseOwner String?`, `leaseToken String?`, `leaseExpiresAt DateTime?`, `heartbeatAt DateTime?`** (`[DR-B5]`), `nextAttemptAt DateTime?`, `failureCount Int @default(0)`, `lastFailureReason String?`, `snapshotCutoffAt DateTime?`, `totalMembers Int?`, `processedMembers Int @default(0)`, **`totalBytes BigInt?`, `fileSize BigInt?`** (`[DR-B6]`), `fileUrl String?`, `sha256 String?`, `uploadState Json?` (**S3 multipart state — upload id, part numbers, ETags. Rev 3 wrote "only if `D1c.0` selects a resumable path"; it did, §4.5.3, so this field is kept**), `manifestSummary Json?`, `completedAt DateTime?`, and **`expiresAt DateTime?`** — new in Rev 3.

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
| **Retention** | Export artefacts carry a **TTL**, default conservative, configurable per project; expired artefacts are deleted by a sweeper and the `HandoverExport` row retains the metadata record. The TTL is held in **`HandoverExport.expiresAt`** (§7.4, `[DR2-B5]`) — Rev 2 stated this policy against a table with no field to hold it. **"Default conservative" is still not a number, and 2026-07-29 is when that started costing something:** `D1c.0` had to model retention at **30 days** to price the storage leg, and recorded it as a declared modelling assumption rather than a spec value. **The TTL default is a Jay/product number that the add-on's price depends on** — longer retention is linear storage cost against the COGS line (§16.1 J9) — and it is named in §17.4 as open rather than quietly defaulted here. **`FolioIssue` rows and bytes are NOT swept** — a folio is the record. `FolioSnapshot` rows and `FolioIssueReservation` rows with no issued folio expire (§7.2, §7.3), as do orphaned objects from a failed issuance (§4.4.2) and superseded lease-keyed archive objects (§4.6.2). |
| **The sweeper does not exist yet** | `dataRetentionWorker.ts` handles **no artefacts at all** at this SHA (grep for `artifact` returns nothing). D1c.2 either extends it or ships its own; **it may not assume one exists.** |
| **Legal hold** | An export or folio under hold is exempt from the sweeper and from §10.4's procedure until released. **Hold state lives in the append-only `ArtifactLegalHold` table (§7.6), not as a flag** — Rev 2 said "an explicit flag, not a convention" and gave it no field, and `[DR2-B5]` showed a flag on `FolioIssue` would have contradicted §7.1's UPDATE-rejecting trigger. An artefact is on hold when its latest row is `placed`. Both the sweeper and §10.4 consult it and **refuse** while a hold stands. **AT-148.** |
| **Unauthorized exclusions** | **Aggregate count only** — no ids, no filenames, no lot associations, no document types. Rev 1's `omissions[] { reason: 'not_permitted' }` with per-file detail **was itself the disclosure** `[DH-B6]` forbids. Non-permission omissions (missing object, over cap) keep their per-file detail; those are not disclosures. `[DR-B8]`. **AT-133 (rewritten).** |
| **Audit** | Export request, export download, folio issue, folio download and every §10.4 deletion emit audit events. |
| **PII redaction** | Out of scope for D1 as a **feature**, in scope as a **decision**: the archive is delivered whole to a user who already has read access to every member. It is not redacted, and it is not shared externally (§1.3, no client portal). If external delivery is ever added, **that is a new threat model, not a rider.** |

### 10.6 Threat model

Program §7 line 134 gated a threat model before D2. **D2 is deleted; the gate moves to `D1b.0`** (§4.3.4) and covers D1b and D1c.

**Merged: `docs/plans/wave-d1b-threat-model-2026-07-28.md`.** Its §11 verdict table is the authority on which mitigations block D1b; §12 records what was verified absent so nobody re-searches.

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
11. **No billing, entitlement or metering code in D1c** *(new 2026-07-29, `[DH-k]`)*. J9 makes the archive a **priced add-on**, which is a commercial decision, not a licence to build a paywall in front of a product that cannot charge anybody yet. Quotas and billing are deliberately off product-wide pre-launch; **D1c builds the machinery and measures the cost, and the gate lands when billing does.**
12. **No multi-volume ZIP** *(new 2026-07-29)*. A reference-dataset project is ~6 archives (§4.5.3), and they are **independent siblings**, each openable on its own with its own manifest — never a `.z01` chain the receiving engineer must reassemble. §4.7.6.

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
| Archive job | No wall-clock target. **Must not block the API process's event loop** — which under `[DH-j]` it structurally cannot, because it runs in a different process (§4.7.7); **memory flat with respect to archive size** as §4.5.1 fixture 1 defines it. *(Amended 2026-07-29: `D1c.0` measured 100–700 ms in-process stalls across every candidate, so "must not block the event loop" is now met by placement rather than by writer choice.)* |
| Archive download | Streamed, constant memory. The shipped buffer-and-send is explicitly not reused. Served by the **API** process, not the worker. |
| **Cost, reference dataset** | *(Amended 2026-07-29.)* Measured per leg in `D1c.0` (§4.5.6), per program §8 line 145 — **A$39.77 ex-GST** for one generation plus three downloads, against a A$12.00 ceiling. **J9 retired that ceiling as a ship gate and made it the add-on's COGS reference line.** The unit is now **the whole deliverable** — all ~6 archives — not one archive, because splitting changes the unit billed against and not the bill. |

---

## 13. Rollback

- **D1a-respec:** types and tests only. Revert. The `EvidenceReadinessItem.code` narrowing (§4.1.1) reverts with it — it is a type, not a column.
- **D1a:** flag off. Nothing persisted.
- **D1b.0:** docs artefacts (threat model, benchmark report), the requirement profile and its resolvers, and one new backend dependency. Revert; **the dependency is removed with it**, since nothing else imports it until D1b.
- **D1b:** flag off hides issue + download. Rows and objects remain, removed only by §10.4. Full rollback = revert, drop trigger, drop the `format` CHECK, drop the three tables.
- **D1c.0:** a benchmark report. Nothing to roll back. **DONE** — `docs/plans/wave-d1c0-spike-report-2026-07-29.md`.
- **D1c.1:** three additive tables, drop to revert.
- **D1c.2:** flag off hides the screen; **the worker is a separate process (`[DH-j]`, §4.7.7)**, so it is stopped by scaling that service to zero — the same "stop it without a deploy" property the `SCHEDULED_REPORT_WORKER_ENABLED` env gate gave, with a stronger blast radius: stopping the worker cannot affect the API. In-flight jobs are reclaimed on lease expiry; if the worker stays off they sit `queued`, which is visible rather than lost. **Partial archives are never stored** — written once, complete, `flag: 'wx'`.
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
| **AT-144** | D1b.0 | **The requirement profile is executable `[DR2-B1]`.** `LoganPsp5RequirementProfile` resolves **all EIGHT** PSP5 items — clause (a) through (h) — for a fixture lot, each returning `present` / `missing` / `not_applicable` / `not_assessable` **with a reason**, and items **(a), (b) and (g)** are structurally incapable of returning `present`, asserted against a maximally-populated fixture. A profile whose item count or `profileVersion` changes without a test change fails. *(Restated after `#1679`: Rev 3 said "all seven" and named items 1 and 6, against a rendering of §5.6.5 that dropped clause (b) — `[LP5-DELTA]`, §2.2.)* | unit |
| **AT-145** *(restated after `#1679`)* | D1b.0 | **The Logan-18 crosswalk names what it cannot resolve `[DR2-B1]`.** Every one of the 18 PSP5 matters is **either mapped to at least one `TestCategory` or explicitly unmappable with a stated `unmappedReason` — never silently empty**, with the counts pinned at **10 mapped / 8 unmapped**; and a lot carrying a test-type string outside the crosswalk yields `not_assessable` **naming that string**, never a silent drop and never a false `missing`. *(Rev 3 asked that every one of the 18 map to at least one `TestCategory`. **Eight cannot without inventing a mapping** — three name a material "quality" whose constituent tests the clause does not enumerate, one names spray and application rates rather than a test, three name hydraulic or water tests `testTypeSpecifications` has no category for, and one is (xviii)'s catch-all. Guessing any of them would manufacture exactly the coverage `[DR2-B1]` punished, so the shipped assertion is the honest form. An empty `canonicalCategories` with no reason is a **type error** as well as a test failure.)* | unit |
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
4. *(Amended 2026-07-29 — `D1c.0` decided the cap.)* **The reference dataset delivered as `N` archives of ≤ 8 GiB each** (§4.5.3), **each one** opened in Info-ZIP `unzip` **and** the Windows Explorer shell handler, **each** meeting the §4.5.1 fixture bars as re-graded under §4.5.7 *(and as amended 2026-07-29, §16.1 **J10** — rows 1 and 3 only)*, and **each** manifest reconciled against the members it claims, with omissions accounted for. **`N` is recorded** — for the reference dataset it is expected to be 6, and the number the customer receives is `N`, not the per-archive figure. **Rev 1's single 50 GB reference archive is WITHDRAWN as a gate**: no candidate was measured correct above 8 GiB, and this specification does not gate on an artefact nothing has been proven to produce.
5. *(Amended 2026-07-29 — J9.)* **Total cost across all `N` archives measured and recorded against the add-on COGS line**, per leg — reads, upload, storage across the retention window, downloads, compute. **A$12.00 is no longer a pass/fail ship gate**; §16.1 **J9** retired it as one and re-purposed it as the COGS reference the add-on's price must clear with margin. What this item still forbids is exactly what `[DR2-B6]` forbade: **the measurement is reported as taken, and no number is re-based after seeing it.** The measured reference figure to beat is **A$39.77 ex-GST** for one generation plus three downloads (§4.5.6).
6. *(Amended 2026-07-29.)* Peak memory during archive generation recorded and **flat as §4.5.1 fixture 1 defines it (±15% across 1→8 GiB)**. **If the writer selected under §4.5.7 is not flat by that definition, this item records the measured deviation and the absolute peak instead of claiming flatness** — `archiver` was the only candidate to achieve ±15% at 50 GB scale, and a spec that lets "flat" mean "small" is a spec that grades its own homework. *(Amended again 2026-07-29, §16.1 **J10**: the band applies above a 128 MiB peak-RSS floor. **It is not load-bearing for this item** — the selected writer, `archiver`, measures **3.6%** across 1 → 8 GiB and clears the band as originally written. The sentence above still stands as the rule: if a future writer is not flat by that definition, this item records the deviation and the absolute peak rather than claiming flatness.)*
7. The pdfGenerator characterization suite passes **unmodified**, and the merged Wave D diff touches **no file under `frontend/src/lib/pdf/`** (AT-122). *(Rev 1 promised this and could not keep it; Rev 2 withdrew it; Rev 3 keeps it by not touching the file — §0.7.)*
8. `D1b.0`'s threat model merged before D1b code (§4.3.4). **DONE — `docs/plans/wave-d1b-threat-model-2026-07-28.md`.** The gate is now the eight `Mitigate before D1b` rows in its §11, each with a named test (AT-152 … AT-156, plus AT-124, AT-132-extended, AT-141, AT-142, AT-143, AT-146).
9. Docs + the Clancy knowledge mirror updated in the same PRs.
10. **Pilot acceptance, restated at the reachable party and scoped to what CIVOS produced (§5.1 clause 8, `[DR2-A2]`).** Rev 1 required *"one named authority has accepted one real submission"* — **unreachable by design**, because the submitter is the consulting engineer. Rev 2 replaced it with a consultant confirming *"the pack needed no reformatting"*, which `[DR2-A2]` correctly rejects as internally ambiguous: the consultant's own certificate (§2.2 item 1) and the editable asset list (item 6) are **deliberate, permanent CIVOS gaps**, so the consultant necessarily adds material and "no reformatting" cannot describe the whole submission. Replaced with four parts, all four required:

    a. **One RPEQ consultant lodges an on-maintenance submission whose evidence pack was compiled in CIVOS.**

    b. **The consultant confirms the CIVOS sub-bundle** — the folio, the archive and their manifests — **needed no renaming and no re-export.** Scoped to what CIVOS produced, which is the only thing CIVOS can be judged on.

    c. **The deliberate additions are recorded**: what the consultant added that CIVOS does not produce, item by item, against §2.2. This is the row that tells us whether §2.2's **four** gaps are the right four.

    d. **The on-maintenance outcome is observed and recorded** — approved, approved with conditions, or returned, with the reasons. **No claim of CIVOS acceptance is made or implied from it** (`[DH-B8]`). The council is accepting the consultant's submission, not our bundle, and the gate records the outcome as evidence rather than as endorsement.

11. *(New 2026-07-29, `[DH-j]`.)* **The archive worker runs in a process that serves no user traffic**, and §4.5.1 fixture 3's ≤50 ms stall threshold is asserted **against the API process** during an archive job — not against the worker's own loop. Every candidate exceeded that threshold in-process at 50,000 members by 2–14× (§4.5.2); the threshold exists because §4.5.1 assumed the job shares the API process, and the cheapest sound answer is that it must not. Evidenced by the deployment shape (a separate Railway service) **and** by p95 on unrelated endpoints measured during a generation run. *(Amended 2026-07-29, §16.1 **J10**: this item's scoping is now also §4.5.1's own text — row 3 binds the API process, and the worker's loop is governed by row 4 and the §7.4 lease/heartbeat cadence. **This item becomes more load-bearing, not less**: the selected writer, `archiver`, measures **69.99 ms** in the worker's own loop, so `[DH-j]`'s flip condition is **not** met and the separate process is what keeps row 3 satisfiable at all.)*

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
| **J9** *(2026-07-29, the new dated row J8 requires — J8 above is left exactly as written)* | **J8, answered: the archive ships as a PRICED ADD-ON.** `D1c.0` measured **A$39.77 ex-GST** against J8's **A$12.00** — 3.31× over, and over before anybody downloads anything (§4.5.6). Of the three responses J8 reserved to Jay, **Jay chose the priced add-on on 2026-07-29**: archive generation is a **paid add-on**, not an included feature. | **UNBLOCKS D1c.1 and D1c.2** (both were held on J8); §15 items 4 and 5 | **Three parts, and the third is the one a build agent must not fill in.** **(1) A$12.00 is retired as a ship/no-ship gate and re-purposed as the COGS reference line** — the add-on's price must clear the measured cost (A$39.77 on the reference dataset) **with real margin**. The number is not moved, not re-based and not re-measured into passing; it changes job. **(2) The price itself is a separate Jay number, set when billing is wired.** Quotas and billing are deliberately off product-wide pre-launch, so **`D1c` builds the machinery, not the paywall** — a price written into this spec today would be a number nobody can charge. **(3) The paywall gate — which roles may trigger generation, and the billing check itself — is `[DH-k]`: a `D1c.2`-or-later surface with a flip condition, and it is explicitly NOT built into `D1c.1`.** *Consequence, stated plainly: **`D1c.1` and `D1c.2` are UNBLOCKED**, subject to §4.5.7's entry gate, which is an engineering precondition and not a commercial one.* |
| **J10** *(2026-07-29, later the same day as J9 — a new dated row, and no row above is edited)* | **TWO §4.5.1 THRESHOLDS ARE AMENDED, and only two.** §4.5.7's entry gate ran on a certified-quiet box and **failed as specified**: `archiver` missed **F3 alone** (max single-tick stall **69.99 ms** against 50 ms; p99 **4.38 ms** ✓), `yazl` missed **F1 alone** (RSS flatness **94.7%** across 1 → 8 GiB against ±15%; 19.86 → 38.67 MiB) — **one row each, and a different row each**, both re-confirmed over five samples (`d1c1-writer-regrade-2026-07-29T09-00-00-000Z.json`; report §7). **On the orchestrator's recommendation, Jay amended the two rows whose stated rationale this architecture had already removed.** **(1) F3 binds the API process only.** Its own rationale is *"the API process serves user traffic; a stall is a user-visible outage"* — and **`[DH-j]`, decided BEFORE this re-grade on independent measured grounds, moved the archive worker out of the API process.** A stall in a worker serving no requests has no user. For the worker the operative bars are **F4** (cancellation) and the **§7.4 lease/heartbeat cadence**; `archiver`'s 65.9–72.7 ms is **out of F3's scope — recorded, not erased**. **(2) F1's ±15% flatness band governs only above a 128 MiB peak-RSS floor**; below it the absolute **≤256 MiB** cap governs alone. The band operationalised *"memory flat"* to catch **unbounded growth**; at `yazl`'s 19.86 → 38.67 MiB it flags fixed startup overhead against scale overhead at **15% of the cap** — a ratio artefact, not a leak. The floor keeps the band's teeth at the scales where growth could threaten the cap. | §4.5.1 rows 1 and 3; §4.5.7's entry gate (**DISCHARGED**); the §4.5.2 selection; §15 items 4, 6 and 11 | **Stated plainly, because §1's honesty rules and `[DR2-B6]` both demand it: these amendments were made AFTER the measurement, which is exactly what predeclaration exists to prevent.** That is not excused here; it is the reason they carry **Jay's dated approval as a decision row** rather than an engineering edit to a threshold table, and the reason **the un-amended verdicts stay unedited** in the spike report **§7.1** and **§7.6**. **Untouched and still predeclared:** F5 integrity (three readers, **zero** mismatches), F4 cancellation, F6 byte-identical resume, F2 in full, **F1's absolute ≤256 MiB cap**, and ZIP-standard compatibility — nothing in this row reaches the correctness of the artefact. **Consequence: both candidates pass, §4.5.2's tie-break decides, and `archiver` 8.0.0 is SELECTED** (§4.5.2 — three axes tie, large-member support separates them 3.6% vs 94.7%, and `yazl`'s win on the event-loop axis is ranked below it). **`[DH-j]` is NOT flipped** — its condition required the selected writer to hold ≤50 ms at the member ceiling and `archiver` does not, so the out-of-process worker is load-bearing rather than theoretical. **The object-tree fallback is not taken and stays in the spec as the fallback.** *Flip: only Jay, only as a further dated row. A build agent that finds either amendment inconvenient at `D1c.1` re-scopes the phase instead.* |

### 16.2 The spec's own decisions

| Tag | Decision | Flip condition |
| --- | --- | --- |
| `[DH-a]` | **WITHDRAWN in Rev 3.** Governed a PDF sink that no longer exists — under `[DH-i]` the browser never produces folio bytes, so `generateConformanceReportPDF` gains no option and `frontend/src/lib/pdf/` is untouched (§0.7). | — |
| `[DH-b]` | **The archive worker collects; it never renders.** *(Rev 3 narrows the second clause. "No jsPDF in Node" was a proxy for the real rule — no background job emits a document nobody reviewed — and `[DH-i]` now requires a Node renderer for interactive folio issuance, which is a different act by a different actor. §4.3.1.)* | Pilots show progressive issuance is not happening — and even then the first fix is a prompt, not a worker-side renderer. |
| `[DH-c]` | One new dependency: a streaming ZIP writer, **selected by benchmark in `D1c.0`**, not by recommendation. *(Discharged 2026-07-29: the benchmark ran twice — at 50 GB scale and again at the 8 GiB cap under §4.5.7 — and the writer is **`archiver` 8.0.0**, chosen on §4.5.2's five axes after Jay's §16.1 **J10** threshold amendment. `D1c.1` installs it; nothing is installed yet.)* | None. Hand-rolling stays rejected. |
| `[DH-d]` | **Multi-authority configurability** and `ExceptionOrWaiver` deferred out of D1. Blocker removed (§2); scope now reduced to one thing, because `[DR2-B1]` pulled the Logan-18 crosswalk into `D1b.0` and the concrete Logan profile with it (§4.9). | Someone asks for a **second** authority's pack profile — a customer event, not a roadmap slot. `profileVersion` and the §2.3 resolver dispatch are the seam it plugs into. |
| `[DH-e]` | No checksum or chainage column on `Document`; D1c hashes at archive time and derives chainage from the lot. | Hashing dominates archive job time on the reference dataset — measure first. |
| `[DH-f]` | **Superseded.** Rev 1 said "the folio is the shipped conformance report, unchanged in content". `[DR-B1]` makes that impossible: the shipped report certifies. Replaced by `[DH-h]` in Rev 2, and by **`[DH-i]`** in Rev 3. | — |
| `[DH-g]` | D1c's download streams; the scheduled-report buffer-and-send path is left alone. | Someone needs streaming for scheduled reports — then extract, with characterization coverage. |
| `[DH-h]` | **WITHDRAWN in Rev 3, replaced by `[DH-i]`.** Made the folio a sixth `ConformanceFormat` rendered in the browser. `[DR2-B4]` showed the resulting upload boundary cannot be made safe by inspection. | — |
| **`[DH-i]`** | **The folio renders on the server, from the `FolioSnapshot`, in a module that shares no code with `frontend/src/lib/pdf/`. No route accepts folio bytes from any client.** The shipped certificates keep their certification language and signature blocks for their shipped purpose, and Wave D does not touch them at all. **One new backend dependency**, chosen by benchmark in `D1b.0` (§4.3.6). | A QM confirms the certificate formats are unused — then deprecate them deliberately, in their own PR, never as a side effect of Wave D. Nothing flips the server-render decision itself: reverting it reopens the class `[DR2-B4]` closed. |
| **`[DH-j]`** *(new, 2026-07-29)* | **The archive worker runs OUTSIDE the API process** — a separate Railway worker process/service, not a fifth `setInterval` in `backend/src/server.ts:208-211`. **Measured rationale, not preference:** `D1c.0` recorded maximum single-tick event-loop stalls of **100–700 ms across ALL FOUR candidates** at 50,000 members (`fflate` 71.6, `yazl` 113.4, `archiver` 523.2, `@zip.js/zip.js` 696.3 ms), and `archiver` exceeded the 50 ms bar even at 5,000 members. p99 was fine everywhere; the maximum is what matters, because **in the API process an archive job is a user-visible outage** — every request behind that tick waits. No writer choice fixes it: the cost is the central-directory write, which every ZIP writer must do. **Consequence for `D1c.1`: none, and that is the point.** §7.4's `leaseOwner` / `leaseToken` / `leaseExpiresAt` / `heartbeatAt` — specified for `[DR-B5]` before this decision existed — are **exactly** the fields an external worker needs to claim, fence and renew a job it did not receive as a request. The schema fits without a change; §4.6.2's lease-keyed writes and CAS publish already assume a worker that may be a different process on a different host. `D1c.2` gains a deployment surface (§4.7.7), not a redesign. | **The stall disappears on a quiet box under §4.5.7's re-grade AND the selected writer holds ≤50 ms at the per-archive member ceiling** — and even then, moving the job back into the API process buys nothing this product needs, so the flip is theoretical. It is recorded because a flip condition that nobody will pull is still more honest than none. **NOT MET, 2026-07-29 — measured, and recorded here rather than left ambiguous.** The re-grade satisfied the first half (`archiver` 523.2 → **69.99 ms**, `yazl` 113.4 → 16.91 ms on a quiet box) and **failed the second**: the selected writer, `archiver` 8.0.0 (§4.5.2), measures **69.99 ms** at the 8,334-member ceiling, over the 50 ms bar, across five confirming samples at 65.9–72.7 ms. **This decision stands and is now load-bearing** — §16.1 **J10** scopes §4.5.1's F3 to the API process *because* the worker is outside it, so reverting `[DH-j]` would reopen F3 against a writer that cannot pass it. |
| **`[DH-k]`** *(new, 2026-07-29, from J9)* | **The add-on paywall is NOT built in `D1c.1`.** J9 makes archive generation a **paid add-on**, and `D1c.1` builds the job schema and the ledger — **no billing check, no entitlement column, no price**. The gate has two halves and both land later: **(a) which roles may trigger a generation** — §9's permission matrix already names them (`owner`, `admin`, `project_manager`, `quality_manager`), so this is a route guard in `D1c.2` beside the request UI, not an open question — and **(b) the billing/entitlement check itself**, which cannot be built before billing exists — quotas and billing are deliberately off product-wide pre-launch. Until then, generation is governed by the ordinary project-role guard, and **the cost of every run is a measured, recorded number** (§15 item 5) rather than a metered one. *ponytail: a paywall in front of a feature nobody can be charged for is scaffolding with a lock on it.* | **Billing is wired and Jay sets the price** (J9 part 2). At that point (a) and (b) ship together in their own PR — a paywall half-built is worse than none, because it reads as enforced. |

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
- **The export-artefact retention TTL default** *(added 2026-07-29)*. §10.5 says "default conservative" and names no number; `D1c.0` had to assume **30 days** to price the storage leg. It is a **Jay/product number**, it moves the add-on's COGS linearly (§16.1 J9), and it should be set before the price is. Not a blocker for `D1c.1` — `expiresAt` (§7.4) holds whatever it turns out to be.
- **The add-on price** *(added 2026-07-29, J9 part 2)*. Deliberately open: it is set when billing is wired, and it must clear **A$39.77** on the reference dataset with margin. **Open by decision, not by omission** — this is the one row in this section that nobody should try to close with research.

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
11. **A gate whose threshold is set after the measurement is not a gate.** `[DR2-B6]`. Rev 2 did this with the archive cost ceiling, which is the single most expensive thing the product does. §4.5.6. *(Amended 2026-07-29, and this is the uncomfortable one to write down: **§16.1 `J10` amends two §4.5.1 thresholds after they were measured against.** It is not exempt from this item — it is the case this item is about. What it does instead of claiming exemption: the amendment is **Jay's**, dated, in the decision register, scoped to the two rows whose stated rationale the architecture had already removed, and it leaves the un-amended verdicts unedited in the spike report §7.1/§7.6 so anyone can read what the bars said first. **A build agent still may not move a threshold, and the cost ceiling J8/J9 governs was never re-based** — it changed job, on Jay's signature, and was not moved either.)*
12. **An invariant is only as strong as the system that enforces it.** `[DR2-B7]`. Rev 2 fenced database rows and claimed a property about object storage. §4.6.2.

### 18.2 Citation provenance

**Re-opened at `84eac1a7` for Rev 3** — every code claim the delta review makes, checked against the file rather than against Rev 2's account of it: `readiness/contracts/reasonCodes.ts:29-85` (the `READINESS_REASON_CODES` array, read in full), `:87`, `:98`, `:112`, `:180`, `:238`; `readiness/contracts/futureConsumers.ts:90-121`; `readiness/contracts/contracts.test.ts:152-192`; `evidenceReadiness/core.ts:1-40`; `readiness/sufficiency/testCategories.ts:18-30` and `:29-85` (the alias table **and its governance/scope note**, which is the evidence for §2.2 item 2); `routes/documents/fileHelpers.ts:34-52`; `routes/documents.ts:270-290`; `backend/package.json` (**no PDF dependency of any kind** — zero matches for `jspdf`, `pdfkit`, `pdf-lib`, `puppeteer`, `playwright`, `canvas`); `frontend/package.json:49` (`jspdf ^4.2.1`); the AT-143 ceiling grep and the `[DR2-*]` / `[DH-i]` collision greps; and `git diff --stat f2defa17..84eac1a7`, which returns **one file, this spec**.

**Re-opened again at `75eea0b9`, because `#1662` moved `schema.prisma` mid-revision (§0.11):** `:447-459` (`ProjectArea` — unmoved), `:545-570` (`Lot` — unmoved; `chainageStart`/`chainageEnd` at `:551-552`, `activitySlug` at `:564`), `:712-743` (`ITPCompletion`, read in full — unmoved; **neither `version` nor `updatedAt`**, the evidence for `[DR2-B3]`'s revision-token finding), `:824-829` (the E2 insert itself), `:947`, `:960-961`, `:1004`, `:1017`, `:1035-1046` (`NCR` + `NCREvidence` — **all +5**), `:1597-1643` (`Document` — **+5**; GPS and capture at `:1609-1611`, version tracking at `:1618-1620`).

**Personally opened at `f2defa17` for Rev 2, and still valid because no code moved (§0.10):** `conformanceItems.ts:170-195`; `conformancePrerequisites.ts:195-210`, `:515-530`; `claimReview.ts:230`; `conformanceReportPdf.ts` (the whole `#1658` hunk) plus `:78-102`, `:112-135`, `:838`, `:850`, `:904-908`, `:922`; `pdf/types.ts:1-8`; `ConformanceReportModal.tsx:8-30`; `pdfSave.ts`; `pdfTestRecorder.ts:17,63-66`; `useConformanceReportGeneration.ts:110-156`; `schema.prisma:761-790`; `controlLineGeometry.ts:44-52`; `lotGeometry.ts:91-110`; `CLAUDE.md:266`; the full text of `docs/research/d0-adac-handover-research-2026-07-28.md`.

**Still NOT individually re-opened, at either SHA:** the readiness-engine internals in §3.1 other than those listed above; the scheduled-report worker line numbers in §3.4; the spatial model line numbers in §3.5; the four project-guard copies in §10.1; the NOT-FOUND greps in §3.6 other than the asset/ADAC/ZIP ones.

**One Rev 2 citation is narrowed rather than wrong:** §2.2 item (f) cited `Lot.chainageStart`/`chainageEnd` as `:551-554`; they are at **`:551-552`** (`:553-554` are `offset` and `offsetCustom`). The range contained them, so nothing was misread — recorded because §18.2's whole purpose is that ranges get copied forward and narrow to the wrong lines.

**Whoever builds a phase re-derives that phase's citations first.** This repository has now produced **three** documented cases of a confidently-cited line number being wrong — and Rev 1's own `:888` became one of them within five commits (§0.9). Treat every carried citation as a hypothesis. **And note the sharper lesson from `[DR2-B1]`: every line number in Rev 2's §2.2 was correct, and the section's conclusion was still false.** Correct citations under a wrong summary are more dangerous than wrong citations, because they survive review.

### 18.3 Observations for whoever builds this — none blocking

1. **`sendScheduledReportArtifactFile` buffers whole files into memory.** Fine at 200 KB, not at 2 GB. D1c writes its own path (`[DH-g]`), but the shipped one is a latent problem the day someone schedules a report over a large dataset.
2. **`dataRetentionWorker.ts` handles no artefacts at all.** §10.5 says D1c may not assume a sweeper exists. Whether one should exist for all three artefact kinds is worth its own small PR. Not Wave D's to fix.
3. **`Drawing` tracks revision and supersession but nothing about receipt or acknowledgement**, and no F1 execution spec exists at this SHA. A folio can state *which* drawing revision a lot's evidence references, never *whether the crew had it*. Say that plainly in the folio rather than implying the stronger claim.
4. **There are no Prisma enums anywhere.** Do not introduce the first one here.
5. **`ITPCompletion.gpsLatitude/gpsLongitude` are written and rendered nowhere.** C3 recorded the same. Still true. Not Wave D's.
6. **The archive is the product's largest egress event by an order of magnitude.** §4.5.6's ceiling is not a formality; it is the number that decides whether "50 GB evidence project" is a pricing promise or a pricing mistake — which is why Rev 3 writes it down before measuring (`[DR2-B6]`, J8). *(2026-07-29: measured at **A$39.77**, i.e. it would have been a pricing mistake, and predeclaring the ceiling is what caught it before the feature shipped as included. J9 turns it into a priced add-on — the observation held.)*
7. **The §2.2 item-3 gap (no retest→original-test link) is the most product-visible hole in the pack mapping.** It is a C2-family column, it is small, and a pilot will notice it before anything else on this list. **The NCR-linked path is better than Rev 2 credited** (`linkedTestResultId`, `schema.prisma:947`) — it is only the no-NCR retest that is unlinked.
8. **New in Rev 3: PDF rendering now runs in the API process.** `[DH-i]` buys a large security simplification and moves a CPU- and memory-bound workload into the process that serves every request. §4.3.6's RSS and wall-clock thresholds are load-bearing, §4.3.4's threat model covers renderer resource exhaustion, and **whoever builds D1b should watch p95 on unrelated endpoints during folio issuance** — that is the number that would say "this belongs in the worker after all".
9. **New in Rev 3: `documents.ts:278`'s 50 MB cap is a product-wide constraint that nobody has revisited.** D1d needs past it for CCTV (§4.8). Whether the general document limit is still right for a product storing site photography is a separate question worth asking once, and it is **not** Wave D's to answer — but D1d is where someone will notice it.

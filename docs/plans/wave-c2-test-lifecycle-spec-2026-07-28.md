# Wave C2 Execution Specification — the test lifecycle: sample → lab → certificate → verify

**Date:** 28 July 2026 · **Rev 1:** authored 28 Jul at `bb28c44b` · **Rev 2:** 28 Jul, folding the Opus 5 adversarial review of Rev 1 (verdict **6/10**; six blockers `[C2R-B1]`…`[C2R-B6]`, ten advisories `[C2R-A1]`…`[C2R-A10]`, J1–J6 verdicts, and a clean-confirmed list). **Status:** implementation-ready. **J1–J6 are resolved** (§13.1) — no phase is gated on a Jay decision any more.

**All `file:line` citations in this revision were re-opened in this worktree at HEAD `c9a16fac2a0ef464c1694da0507e897b80d6c4ec` (= `origin/master`, `feat(copilot): Clancy learns the test-sufficiency engine (#1628)`).** Rev 1 was written at `bb28c44b`; every citation carried forward was re-derived, not re-copied. The stale ones are corrected in §15 and tagged `[C2R-A8]` / `[C2R-A10]`.

**Program contract:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` §3 Wave C, line 76 (C2. Sample lifecycle) and §7 line 134 (threat-model gate).
**Parent spec:** `docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md` (Rev 2.3). C2 is named there as a non-goal of C1 (§1 **line 149**) and as the owner of one deferred limb (§1 **line 150**, §7.2 **line 958**). **C1 counts `TestResult` rows that already exist; C2 makes the path to "verified" managed rather than assumed. C2 extends C1; no parallel engine.**
**Sibling specs read, not remembered:** `docs/plans/d14-q6-pack-spec-2026-07-27.md` (Rev 2), `docs/plans/test-type-canonicalization-spec-2026-07-27.md` (F1), `docs/plans/wave-b-migration-importer-spec-2026-07-26.md` (the test-register importer parked on this spec's §3.4 answer).
**Independent sibling PR, dispatched in parallel with this revision:** the **reject-notification honesty fix** (formerly J2, formerly C2.3's second half). It is **out of C2's phases entirely** — see §13.1 J2.

**Research register:**

| Report | Supplies | Grade |
| --- | --- | --- |
| `docs/research/c1-mdd-exclusion-research-2026-07-27.md` `## Nuance that affects the engine` items 1–5 | MDD as a **per-SITE paired requirement type**; RC 500.05 §7 assigned-value decay on rework; the conditional small-areas exemption | **A** |
| `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md` §A line 28 | The **only** C2-assigned evidence row: PDF certificates, 1–5 business-day turnaround, **no universal lab API** | **B**, self-caveated |
| `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md` §A line 27 | TfNSW *LIMS Data Submission Requirements — Specified Tabulated Format* (2023) | **A**, assigned to **C3**, never read by any CIVOS pass |

**House style** matches the C1, D14, F1 and sync-centre specs: numbered sections, a Rev header plus a §0.x fold changelog, a decision register, named acceptance tests continuing the shared series, per-phase rollback, an exit gate.

**Tag namespace.** `[C2L-*]` (C2 **L**ifecycle) for this spec's own tags, `[C2L-B*]` for blockers it must not violate, `[C2R-B*]` / `[C2R-A*]` for the Rev 2 review fold. `[C1C-*]`, `[C1R-*]`, `[D14R-*]`, `[D14X-*]` and `[F1C-*]` are taken. Plain `C2` is **already an unrelated change-request ID** (`docs/change-requests.md:24`, partial claiming) and a SA DIT spec-number fragment (`RD-EW-C2` and siblings throughout `docs/research/sa-dit-*.md`) — never use a bare `C2` tag.

**Ponytail note, restated for Rev 2.** Rev 1's note said the lifecycle was "already in the tree, minus two facts and one wire". The review proved the *order* of that sentence was backwards: the two facts are worth nothing until the wire exists, and the wire the user actually feels missing is not the one Rev 1 built first. Rev 2 ships **the certificate landing on the row that was waiting** first, **a "Send to lab" button** second, and **the two columns plus their display** third — because phases 1 and 2 are each one small change that is useful on its own, and phase 3 is inert until phase 2 has been adopted. Net code is *smaller* than Rev 1: the shared-shaper refactor, the server-side `?atLab` filter, the A4 card feed and one of the two 409 guards are all cut, and the extraction merge rule is replaced by a filter at one call site.

---

## 0. What this slice is, what it deliberately is not, and what Rev 2 changed

### 0.1 The one-paragraph version

A quality manager can already create a planned test, print a request form, upload a certificate, have AI extract it, confirm the extraction, and verify it. Every one of those steps ships today. Two things do not work. **First:** when the certificate for a planned test arrives, there is no way to land it on the row that was waiting — the upload path *creates a second row*, and the planned one is then stuck in `requested` forever, inflating every "tests still pending" count in the product (§2.8). **Second:** `at_lab` is a legal status that **no user interface can ever set** (§2.4a), so "what am I waiting on from the lab" is not a question CIVOS can answer at all — not badly, not at all. Rev 2 fixes those in that order, then adds the two columns that make the answer a duration rather than a boolean.

### 0.2 The scope cut, stated honestly

The program's C2 line (line 76) names nine states and three capabilities. **v1 builds one route behaviour, one button and two columns.** The gap between the program line and this spec is not an oversight — §1.2 disposes of every clause of line 76 with a reason and, where deferred, a named condition that would un-defer it. Three of the nine "states" already exist as `TestResult.status` values; one ("sufficiency recalc") requires no code at all; one ("external lab upload link") is the single reason §7 line 134 gates this wave on a threat model that has not been written.

### 0.3 Rev 2 changelog — the adversarial-review fold

Every finding below was **re-verified independently at `c9a16fac`** before folding. The verification evidence is in the *Confirmed at HEAD* column; nothing was folded on the reviewer's say-so.

| Tag | Finding | Confirmed at HEAD | Fold |
| --- | --- | --- | --- |
| `[C2R-B1]` | **`at_lab` is unreachable from any UI, so Rev 1's C2.1/C2.3 ship dead.** | **Yes.** `nextStatusMap` (`frontend/src/pages/tests/constants.ts:37-42`) lists `at_lab` only as a *key*, never as a *value*. Its two consumers — `TestResultsTable.tsx:261` and `TestResultsMobileList.tsx:262` — both fire only on the `else` branch of `isEnterResultsStep`, i.e. only for `entered → verified`. The only other `/status` POST in the app hard-codes `'entered'` (`TestResultsPage.tsx:379-382`). `GET /:id/request-form` has **no frontend caller** (only `testResults.ts:43` and tests). Full evidence §2.4a. | **Slicing inverted.** A **"Send to lab" control** is promoted to its own named phase (**Phase 2**, §3.2) and the stamp+display work moves behind it (**Phase 3**). |
| `[C2R-B2]` | **The "C1 counts it twice" justification is overstated.** | **Yes.** `passingCount` counts `testPassing` = `passFail === 'pass' && status === 'verified'` (`predicates.ts:162-164`). A planned row cannot reach `entered` without `hasRecordedResult` (`statusWorkflow.ts:49-58`, enforced `workflowRoutes.ts:303-305`), so it never verifies and contributes **0**. The certificate-created row carries **no** `lotId` and **no** `itpChecklistItemId` (`testResultMapping.ts:51-79` — neither key is in the create input) until `confirmExtraction` sets them (`extractionConfirmation.ts:126-150`). Total passing = **1**, not 2. | **The wave's justification is rewritten** (§0.1, §1.1, §2.8) around the **real** harm: `pendingCount` inflation and a forever-stuck register row. **No double-count claim appears anywhere in Rev 2.** |
| `[C2R-B3]` | **Rev 1's merge rule destroys hand-entered data when AI fails.** | **Yes.** `extractCertificateFields` degrades silently to `createManualReviewExtraction` on *any* failure and when no key is configured (`certificateExtraction.ts:185-187`, `:243-246`), which returns `emptyCertificateExtraction()` (`:38-42`) with `value: ''` for every field bar a filename guess. `parseNumberField('')` → `null` (`:300-303`); `derivePassFail(null, null, null)` → `'pending'` (`:323-328`). Applied wholesale to a populated planned row that would wipe `resultValue`/`resultUnit`/spec bounds and reset `passFail`. | **Certificate-owned fields are written only when the extracted value is non-empty**, as a filter at the one call site (§3.1.3). Rev 1's "null-only merge" and its shared-shaper refactor are both **withdrawn** — the reviewed design writes nothing server-side at all. **AT-66.** |
| `[C2R-B4]` | **The backfill predicate matches zero rows.** | **Yes.** The status-change audit writes `changes: { previousStatus: currentStatus, newStatus: status }` (`workflowRoutes.ts:433`). There is no `changes.status` key on that action. (`changes: { status: 'verified' }` exists at `:231` — but that is `TEST_RESULT_VERIFIED`, a different action.) | Backfill keyed on **`changes.newStatus`** (§4.2) — *and* honestly labelled: with `at_lab` historically unreachable it will match approximately nothing regardless. **AT-67.** |
| `[C2R-B5]` | **`expectedResultDate` on `PATCH /:id` would un-verify verified rows.** | **Yes.** `crudRoutes.ts:344` — `const hasSubstantiveEdit = Object.keys(updateData).some((key) => key !== 'itpChecklistItemId')` — exempts exactly one key; `:345-351` then sets `status = 'entered'` and nulls `verifiedById`/`verifiedAt`. `passingCount` would fall and sufficiency could flip. | `expectedResultDate` is **deliberately added to the substantive-edit exemption list**, with the reasoning stated in the code comment and in §3.3.3. **AT-80.** |
| `[C2R-B6]` | **Rev 1's C2.2 lands unreviewed AI values on a human's row.** | **Yes.** The shipped extraction-review UI exists **only** on the create path (`UploadCertificateModal.tsx` — extraction held in component state at `:116`, review form at `:52`, confirm POST at `:185`). The attach path has none: `handleAttachCertificate` (`TestResultsPage.tsx:457-495`, POST at `:464`) posts the file and refreshes. `confirmExtraction` 409s only on `verified` (`extractionConfirmation.ts:183-188`). | **The attach flow routes into the EXISTING `/confirm-extraction` review UI.** Phase 1 writes **no** extracted value to the database — it returns the extraction for review, and the shipped confirm path (unchanged) writes what the human approved. §3.1. **AT-76.** |
| `[C2R-A1]` | Protect `testType` explicitly. | **Yes.** `buildTestResultData` emits `extractedData.testType.value \|\| 'Certificate Review Required'` (`testResultMapping.ts:63`); attribution keys off the **resolved** `testType` (`counts.ts:26-32` `testAttributesToRule` over `testCategories.ts:310` `candidateCategories`). | `testType` is named as protected and **asserted**, not left implicit. Under §3.1's design `buildTestResultData` is never called on this path, so the fallback string cannot reach the row — AT-75 proves it rather than assuming it. |
| `[C2R-A2]` | "Unused `AiProposal` model" is false. | **Yes, the Rev 1 claim was wrong.** `AiProposal` has **56 references across 16 backend source files** (`copilot/proposalService.ts`, `controlLineExecutor.ts`, `lotBreakdownExecutor.ts`, `planSheetExecutor.ts`, `import/itpTemplateImportExecutor.ts`, `chat/tools.ts`, …) — it is the live Wave 1 copilot proposal subsystem. | §15 note 1 corrected. The model being *live* makes it a **better** home for C4's AI provenance, not a worse one. |
| `[C2R-A3]` | Say what reject does to the new stamp. | **Yes.** `POST /:id/reject` (`workflowRoutes.ts:56`) nulls `verifiedById`/`verifiedAt`/`enteredById`/`enteredAt` (`:95-108`). | §3.3.1 states explicitly: **reject does NOT clear `sentToLabAt`.** The sample did go to the lab; rejecting the *result* does not un-send it. |
| `[C2R-A4]` | The extract path would write status outside the audited transition. | **Yes, and wider than stated.** `confirmExtraction` writes `status = 'entered'` (`extractionConfirmation.ts:111-113`) with **no** `createAuditLog` call anywhere in that module — a pre-existing gap, which Phase 1 now aims at a *human's planned row*. | Phase 1 adds **no new status write** (§3.1), and closes the pre-existing gap with one `createAuditLog` (`TEST_RESULT_STATUS_CHANGED`, same `changes` shape as `workflowRoutes.ts:433`). **AT-77.** |
| `[C2R-A5]` | `?atLab=true` would be the first server-side status filter and duplicates a client filter. | **Yes, twice over.** `listRoutes.ts:124` builds its `whereClause` (`:154-208`) with no status parameter; the register's status filter is **client-side** (`TestFilters.tsx:127` "At Lab" option → `testResultsPageHelpers.ts:66`). | **`?atLab=true` is CUT.** The shipped client-side filter suffices. §6.1. |
| `[C2R-A6]` | The attach merge reads the row outside the transaction. | **Yes.** `loadTestResult` at `certificateAttachment.ts:61`, `verified` guard at `:82-88`, `prisma.$transaction` at `:120` — a TOCTOU window on the shipped path. | The status guard is **re-read inside the transaction**. **AT-78.** |
| `[C2R-A7]` | The 120 s AI timeout moves onto the attach route. | **Yes.** `AI_EXTRACTION_TIMEOUT_MS = 120_000` (`certificateExtraction.ts:85`), applied at `:233`. | Stated as a latency profile in §3.1.4 and §9, with the UI consequence named. |
| `[C2R-A8]` | Every `wave-c1` line citation is stale. | **Yes** — re-derived line by line, drift is **non-uniform** (−1, +24, +30 depending on region). | All eight corrected in-place and tabulated in §15.2. |
| `[C2R-A9]` | Response fields belong in the route `select` blocks, not the response envelopes. | **Yes.** `listResponses.ts`/`detailResponses.ts` shape what the route already selected; the `select` blocks are in `listRoutes.ts:212-254` and `crudRoutes.ts:353+`. | §6.1 names the `select` blocks. |
| `[C2R-A10]` | Six minor citation drifts. | **Yes, all six.** See §15.3. | All corrected. |

**Clean-confirmed by the review, re-checked here, and kept unchanged:** §2.7 (the C1 consumption invariant), §5.5's zero-C2-code sufficiency claim, and the regime-stream non-interference argument — with the reviewer's extra check folded as fresh evidence in §5.5.

### 0.4 Amendment tags

| Tag | Amendment |
| --- | --- |
| `[C2L-1]` | The C1 spec's §7.2 (**line 957**, cited by Rev 1 as line 927) cites `TestResult.sampleLocation` at `schema.prisma:836`. At `c9a16fac` the field is at **`schema.prisma:867`**. The claim (free text) is still true; the citation is stale. §15. |
| `[C2L-2]` | `predicates.ts:176` cites the reject columns at `schema.prisma:846-853`. At `c9a16fac` they are at **`schema.prisma:882-884`**. Claim true, citation stale. §15. |
| `[C2L-3]` | The C1 spec's §16.1 (**line 1346**, cited by Rev 1 as line 1316) recommends building the compaction-band field "in C2 alongside the sample lifecycle". **Superseded**, and the C1 spec says so itself at **line 1348** — D14 shipped it on `Lot.testScale` (`d14-q6-pack-spec-2026-07-27.md` §3.2, decision D14a). C2 must not re-litigate it. |
| `[C2L-4]` | Wave B's `ImportBatch.kind` reservation of `'test_register'` (`wave-b-migration-importer-spec-2026-07-26.md:371`) is parked on "the Wave C sample/test lifecycle model is final". **§3.4's answer to J1 IS that model**, and J1 is now **resolved** — the hand-off is exit item 8. |
| `[C2L-5]` | The C1 spec's §5.3 (**line 830**, cited by Rev 1 as line 800) cites `getClaimBlockingReasonsForConformedLot` at `conformancePrerequisites.ts:166-207`. At `c9a16fac` the function spans **`backend/src/lib/conformancePrerequisites.ts:192-233`** (note: the file is at `lib/`, not `lib/readiness/`). The prohibition `[C1R-B2]` is unaffected. §15. |
| `[C2L-6]` | **New in Rev 2.** Rev 1 §8's phase order (columns → attach → surfacing) is **withdrawn** per `[C2R-B1]`. The shipped order is **attach → send-to-lab → columns+display**. Anyone reading Rev 1's §8 in a branch or a PR body is reading a retracted plan. |
| `[C2L-7]` | **New in Rev 2.** Rev 1's `[C2L-B7]` "null-only merge" and its `buildTestResultData` shared-shaper extraction (with AT-68's byte-identity assertion) are **withdrawn** per `[C2R-B3]` / `[C2R-B6]`. The reviewed design has no server-side merge to make null-only. **AT-68 is retired**, not renumbered. |

---

## 1. Outcome, scope and non-goals

### 1.1 Outcome

A certificate arriving for a planned test **completes that test rather than duplicating it**, and the values it carries are shown to a human before they touch the row. A test that has been sent to the laboratory can be **recorded as sent**, and once it is, its time at the lab is a fact on screen and its lateness is a judgement that exists only where a human supplied the date it is judged against.

**Success test, stated with its adoption dependency `[C2R-B1]` / J5.** These are three different claims with three different timelines, and Rev 1 collapsed them into one sentence that was only true of the third:

1. **Day one, Phase 1:** a QM uploading a certificate for a planned test ends with **one row, not two**, and no permanent "tests still pending" warning left behind (§2.8). This is unconditional — it needs no adoption of anything, only the existing upload action.
2. **Day one, Phase 2:** a QM *can* record that a sample went to the lab. One button. Zero rows have it yet.
3. **Only as teams adopt the Phase 2 control:** "what am I waiting on from the lab, and how long has it been out?" becomes answerable — for the tests that were sent through the button, and for no others. Because `at_lab` has been unreachable for the life of the product, the backfill (§4.2) recovers approximately **nothing**, and every real project's overdue list starts **empty and stays empty until crews start using the control**. That is not a defect; it is what honest lifecycle data costs. **The spec does not claim day-one value for the overdue list, and no PR body may.**

### 1.2 Every clause of program line 76, disposed of

The program line reads: *"planned samples → request → sampled → lab pending → certificate received → AI extraction → human verification → sufficiency recalc; certificate-to-sample reconciliation; overdue-lab chasing; external lab upload link. **Threat model before build** (file upload surface)."*

| Clause | Disposition | Evidence |
| --- | --- | --- |
| **planned samples** | **ALREADY SHIPS.** `POST /api/test-results` creates a row (`crudRoutes.ts:91`); `TestResult.status` defaults to `"requested"` (`schema.prisma:877`). A planned sample is a `requested` row. No build. | `crudRoutes.ts:91`, `schema.prisma:877` |
| **request** | **ALREADY SHIPS AS A PRINT ARTIFACT — AND IS UNREACHABLE.** `GET /api/test-results/:id/request-form?format=html\|json` renders a printable, hand-signable *TEST REQUEST FORM* (`requestFormPresentation.ts:34-325`). It records nothing, and — found by `[C2R-B1]` — **no frontend code calls it**: the only references are the route (`testResults.ts:43`) and backend tests. C2 does not rebuild it and does not wire it; §13.2 `[C2L-c]`. | §2.5 |
| **sampled** | **NOT A STATE — it is a date, and the column exists.** `TestResult.sampleDate` (`schema.prisma:866`). Adding a `sampled` status would be a sixth string for a fact a nullable date already carries. **Rejected**, §13.2 `[C2L-b]`. | `schema.prisma:866` |
| **lab pending** | **STATE EXISTS, IS UNREACHABLE, AND THE FACT DOES NOT EXIST.** `at_lab` is a legal status (`statusWorkflow.ts:29`) and is already whitelisted as pending (`testResultStatus.ts:5`), but **no UI can set it** (`[C2R-B1]`, §2.4a) and nothing records **when** a test entered it. **Phase 2 makes it reachable; Phase 3 stamps it.** | §2.4a, §3.2, §3.3 |
| **certificate received** | **ALREADY SHIPS on the create path.** `results_received` (`statusWorkflow.ts:30`), written by the extraction path (`testResultMapping.ts:77`). No build. | §2.4 |
| **AI extraction** | **ALREADY SHIPS.** Anthropic Messages API via `fetchWithTimeout`, `certificateExtraction.ts:182-247`. No build. Phase 1 **reuses this exact function** — it does not fork it and does not change it. | §2.4 |
| **human verification** | **ALREADY SHIPS AND DOES NOT CHANGE.** `TEST_VERIFIERS = ['owner','admin','project_manager','quality_manager']` (`accessControl.ts:41`). **The QM stays the verifier. C2 changes no role, no gate, no verification field.** | `workflowRoutes.ts:149-235` |
| **sufficiency recalc** | **NOTHING TO BUILD — it is already synchronous and uncached.** `evaluateSufficiency` is a pure function called inside every readiness read (`conformancePrerequisites.ts:574-582`). There is no cached sufficiency, no materialized count, no recalc job. **NOT FOUND:** any stored sufficiency result outside the immutable decision snapshot. A lifecycle change is therefore reflected on the next read, for free. | §5.5 |
| **certificate-to-sample reconciliation** | **THE ONE REAL BUILD — as a human-chosen attach that routes through the shipped review UI, not a matcher.** Phase 1, §3.1. | §3.1 |
| **overdue-lab chasing** | **PARTIALLY BUILT, DELIBERATELY, AND ADOPTION-GATED.** Elapsed days ships (a fact). "Overdue" ships **only** where a human entered an expected date. **CIVOS invents no SLA** — the sole turnaround evidence is grade **B** and self-caveats *"two labs ≠ the industry — treat as directional"* (appendix §A line 28). And per §1.1 item 3, the list is empty until Phase 2 is adopted. §3.3, J5. | §3.3 |
| **external lab upload link** | **DEFERRED FROM v1. The biggest cut and the most defensible one.** It is an unauthenticated external write surface, and it is precisely why program §7 line 134 gates C2 on *"threat model as a gated artifact before A3, C2, D2, E"*. **NOT FOUND:** any threat-model artifact in `docs/`. Building it without one violates the program's own gate. §13.1 J4. | §7.3 |
| **threat model before build** | **SATISFIED FOR v1 BY SCOPE, NOT BY AN ARTIFACT.** v1 adds **no new upload surface** — Phase 1 reuses the shipped, authenticated multer path (`certificateStorage.ts:51-62`) with its existing 10 MB cap, mimetype allowlist and magic-byte re-check. §7.2 states this as a delta review, and §7.3 records that the artifact becomes a hard precondition the moment J4 flips. | §7 |

### 1.3 Non-goals (explicit — do not build in C2 v1)

- **A `Sample` entity, a `TestRequest` entity, or a `Laboratory` entity.** §3.4 argues it; J1 resolved it **on `TestResult`**. **NOT FOUND** in the schema at `c9a16fac`: `Sample`, `TestRequest`, `TestSpecification`, `Laboratory`, `TestCertificate` — confirmed absent, not merely unlocated.
- **A shared-shaper refactor of `buildTestResultData`** `[C2L-7]`. Rev 1 proposed factoring its field-shaping half into a helper both paths call, with AT-68 asserting byte-identity. **Cut.** The reviewed design (§3.1) never calls it on the attach path, so there is nothing to share. A filter over ten extracted fields at one call site replaces it.
- **A server-side `?atLab=true` filter** `[C2R-A5]`. The register's status filter is client-side and already offers *At Lab* (`TestFilters.tsx:127` → `testResultsPageHelpers.ts:66`). Adding the first server-side status filter to `listRoutes.ts:124` to duplicate it is cost without benefit.
- **An A4 *Needs Attention* card feed.** Rev 1 promised to feed `docs/plans/a4-mockups/01-needs-attention.html:367`. **Cut from this wave** — with the overdue list empty until Phase 2 is adopted (§1.1), wiring a card that renders nothing is scaffolding. The register chip is the whole surface. *Flip condition:* a real project has non-zero `at_lab` rows.
- **The reject-notification fix (old J2).** Real, agreed, and **shipping as an independent PR in parallel** — it is a pre-existing honesty bug with no dependency on any C2 phase. Out of C2's phases, out of C2's exit gate, and its acceptance test (old AT-74) travels with it. §13.1 J2.
- **Any change to count semantics.** `[C2L-B1]`, §5.1. No edit to `counts.ts`, `evaluate.ts`, `predicates.ts`, `testCategories.ts` or `regime.ts`. A lifecycle state is not a count.
- **Any change to decision snapshots.** `[C2L-B2]`, §5.2. `RequirementEvaluation` rows are immutable by schema contract (`schema.prisma:1715-1717`); C2 emits no new snapshot key and does not bump `resultSchemaVersion`.
- **A parallel engine.** `[C2L-B3]`. C1's evaluator stays the only sufficiency evaluator, and it stays pure and synchronous — the C1 spec §2.2 (**line 186**) explains why making it async destroys the batch path's constant-query guarantee and puts a history read inside the serializable transaction.
- **LIMS, in any form — including "format-compatible" ingestion.** `[C2L-B4]`, §5.4.
- **New `TestResult.status` values.** `[C2L-B5]`, §3.5.
- **Per-production-day frequency limbs**, though C2 formally owns them per `[C1R-4]` (C1 spec §1 **line 150**). §13.2 `[C2L-f]`.
- **An MDD "requirement type", or any per-site paired requirement.** §5.3.
- **Lab accreditation / NATA metadata, chain-of-custody, duplicate certificate/sample detection, preliminary-vs-final, anomaly flags.** All **C4** (program line 78).
- **Survey and material traceability.** **C5** (line 79).
- **The test-register importer.** Wave **B** owns it; §3.4's answer unblocks it `[C2L-4]`.
- **New alert types.** The overdue signal surfaces on the existing register row, not as a new stream into the A2 backlog.
- **No shell changes.** No file under `frontend/src/shell/` changes.

---

## 2. Current-state map (read at `c9a16fac`)

### 2.1 The lifecycle that already ships

`backend/src/routes/testResults/statusWorkflow.ts:27-33`, verbatim:

```ts
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  requested: ['at_lab', 'results_received', 'entered'],
  at_lab: ['results_received', 'entered'],
  results_received: ['entered'],
  entered: ['verified'],
  verified: [], // Terminal state
};
```

Labels at `:36-42`. The header comment `:14-26` records that `at_lab` and `results_received` are **optional** intermediate states and that `requested → entered` in one hop is legal, gated only by `hasRecordedResult()` (`:49-58`) which requires a non-null `resultValue` **and** a definitive `passFail`.

**Consequence C2 must respect `[C2L-B6]`:** a test can reach `verified` having never been recorded as sent to a lab. C2 must not make `at_lab` mandatory — a field density test read on site the same day legitimately never goes to a lab, and the appendix's own evidence row says field density is *"same/next day"* while lab classification is *"2–5 business days"*. §3.3 therefore stamps `at_lab` when it happens and never requires it.

### 2.2 The row itself

`backend/prisma/schema.prisma:857-905`. The fields C2 cares about:

| Line | Field | Note |
| --- | --- | --- |
| 863 | `testRequestNumber String?` | **Never written by any code path.** The request form derives a display number instead (§2.5). |
| 864 | `laboratoryName String?` | Free text. There is no `Laboratory` model. |
| 866 | `sampleDate DateTime?` | The "sampled" fact, already present. |
| 867 | `sampleLocation String?` | Free text `[C2L-1]`. |
| 875 | `passFail String @default("pending")` | |
| 877 | `status String @default("requested")` | **A planned sample is the default state of a new row.** |
| 878-881 | `enteredById/At`, `verifiedById/At` | The two transitions that **are** stamped. |
| 882-884 | `rejectedById/At`, `rejectionReason` | `[C2L-2]` |
| 885-886 | `aiExtracted`, `aiConfidence` | |

Indexes at `:899-903`: `projectId`, `(projectId, status)`, `lotId`, `(projectId, passFail)`, `(enteredById, createdAt)`. **`(projectId, status)` at `:900` is the index any at-lab query rides — C2 adds no index.**

**Zero `enum` blocks exist in the entire schema.** Every status is an unconstrained `String` with app-side enforcement only (`statusWorkflow.ts:36-42`). C2 does not change that.

### 2.3 What stamps what today

`workflowRoutes.ts`:

- `POST /:id/status` — handler at `:240`. Validity against `STATUS_LABELS` `:247`; `verified` requires `TEST_VERIFIERS` `:265-267`, everything else `TEST_CREATORS` `:270-272`; transition check `:276-289`; certificate gate `:292-298`; `RESULT_REQUIRED` gate `:303-305`. **Stamps `enteredById/enteredAt` at `:311-314` and `verifiedById/verifiedAt` at `:317-320` — and nothing else.** Audit `TEST_RESULT_STATUS_CHANGED` at `:427-435`, with `changes: { previousStatus: currentStatus, newStatus: status }` at **`:433`** `[C2R-B4]`.
- `POST /:id/verify` — `:149`, `TEST_VERIFIERS` `:80-85`-equivalent check at `:163-168`, writes `status/verifiedById/verifiedAt` `:203-209`, audit `:225-233` with `changes: { status: 'verified' }` at `:231`.
- `POST /:id/reject` — `:56`, `TEST_VERIFIERS` `:80-85`, only from `entered` `:88-92`, resets to `results_received` and **nulls all four stamp columns** `:95-108`. `[C2R-A3]`: it will **not** clear `sentToLabAt` (§3.3.1).

**The observation Rev 1 leaned on, corrected.** Rev 1 said the moment a test entered `at_lab` "is already a recorded fact — it is simply not queryable". That is true of the *audit mechanism* and false of the *data*: because no UI can set `at_lab` (§2.4a), the audit log contains essentially no such rows to materialize. The column is still worth adding — it is where the fact will live once Phase 2 exists — but it is **not** a materialization of an existing history, and §4.2's backfill is hygiene rather than recovery.

### 2.4 The certificate path that already ships

Route entry points in `backend/src/routes/testResults.ts`: `POST /upload-certificate` `:185`, `POST /:id/certificate` `:214`, `GET /:id/extraction` `:250`, `PATCH /:id/confirm-extraction` `:281`, `POST /batch-upload` `:307`, `POST /batch-confirm` `:331`.

The flow, cited:

1. **Upload** — multer configured once at module load, `certificateStorage.ts:51-62`: memory storage when Supabase is configured else disk (`:52`), **10 MB cap** (`:53`), mimetype allowlist `pdf/jpeg/png/jpg` (`:55`). Magic-byte re-check `assertUploadedFileMatchesDeclaredType`, `certificateIntake.ts:132`.
2. **Extraction** — `certificateExtraction.ts:182-247`. Anthropic Messages API via **`fetchWithTimeout`** (`:190-233`; the import is at `:2` — Rev 1's "raw `fetch`" was wrong `[C2R-A10]`), model from `ANTHROPIC_TEST_CERT_MODEL || ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022'` (`:200-203`), inline prompt template at `:212-226` (**NOT FOUND:** a separate prompt asset file), **120 s timeout** (`:85`, applied `:233`). Ten fields with per-field confidence (`:22-33`). On any failure — and when no API key is configured (`:185-187`) — it degrades to `createManualReviewExtraction` (`:243-246`, function at `:75-80`) which guesses `testType` from the filename (`:44-60`) and leaves everything else `{ value: '', confidence: 0 }` (`:38-42`).
3. **Storage** — Supabase at `certificates/<projectId>/cert-<ts>-<uuid><ext>` (`certificateStorage.ts:73-95`), else local. Cleanup on every failure branch (`certificateIntake.ts:119,127,134,151,185` — Rev 1 said `:135` `[C2R-A10]`).
4. **Write** — one transaction, `certificateIntake.ts:157-183`: `Document` (`documentType:'test_certificate'`, `:161`) then `tx.testResult.create` (`:171`). Shaping in `testResultMapping.ts:51-79`, with `testType` falling back to **`'Certificate Review Required'`** at `:63` `[C2R-A1]` and **`status: 'results_received'` at `:77`**. **Neither `lotId` nor `itpChecklistItemId` is in the create input** — a certificate-created row is unattributed until confirmation `[C2R-B2]`.
5. **Confirm** — `extractionConfirmation.ts:167-237`; forces `status='entered'` plus `enteredById/At` (`:111-113`, via `buildConfirmationUpdateData` `:104-115`); rejects an already-`verified` row with 409 (`:183-188`); validates corrected `lotId` and `itpChecklistItemId` against the effective lot (`:126-150`); recomputes pass/fail server-side (`:196`) and requires a real result (`:200`). **It does not require `aiExtracted` and works on any non-verified row** — which is what makes §3.1's design possible without touching it.

**The gap Phase 1 closes, stated precisely.** `POST /upload-certificate` **creates** a new `TestResult` (`certificateIntake.ts:171`). `POST /:id/certificate` attaches to an existing row but **runs no extraction at all** and deliberately leaves `status` and `aiExtracted` untouched (`certificateAttachment.ts:45-47`). So there is no path from "a planned test is waiting" to "its certificate arrived and was read". A user with a planned `requested` row who uploads its certificate gets **two rows for one sample** — see §2.8 for exactly what that costs.

### 2.4a The `at_lab` dead end `[C2R-B1]` — new in Rev 2

This section exists because Rev 1 built two columns and a chip for a state no user could enter. The evidence, complete:

- **`frontend/src/pages/tests/constants.ts:37-42`**, verbatim:

  ```ts
  export const nextStatusMap: Record<string, string> = {
    requested: 'entered',
    at_lab: 'entered',
    results_received: 'entered',
    entered: 'verified',
  };
  ```

  `at_lab` appears only as a **key**. Nothing maps *to* it.
- **Its only two consumers** are `TestResultsTable.tsx:261` (`onUpdateStatus(test.id, nextStatusMap[test.status])`) and `TestResultsMobileList.tsx:262` (`onUpdateStatus(test.id, nextStatus)`). Both sit in the **`else`** branch of `isEnterResultsStep(test.status)` (`constants.ts:55-57`, whose set is `{requested, at_lab, results_received}`), so both fire **only** for `entered → verified`. Every pre-`entered` row routes to the Enter Results modal instead.
- **The only other `/status` POST in the frontend** is `handleEnterResults` (`TestResultsPage.tsx:379-382`), which hard-codes `{ status: 'entered' }`.
- **`handleUpdateStatus`** (`TestResultsPage.tsx:320-344`) is a faithful pass-through — it POSTs whatever status it is handed. **The wire is missing at the caller, not at the route.**
- **The backend already offers the transition.** `buildTestResultWorkflowResponse` (`workflowResponse.ts:17-75`) returns `nextTransitions` including `at_lab` with `canPerform` — and **no frontend code reads it**.
- **`GET /:id/request-form` has no frontend caller either** (`testResults.ts:43`; the only other references are backend tests). The one artifact that would naturally accompany "send to lab" is unreachable too.

The frontend mentions `at_lab` in exactly **three files** (`constants.ts` ×5, `TestFilters.tsx:127`, `TestResultsMobileList.tsx:135`) and **not one of them is a setter** — they are a label, a colour, a badge variant, an advance-map key, and a filter option.

**Consequences Rev 1 did not price in:** the stamp is unreachable; the elapsed/overdue list is empty on every real project; the backfill finds ~zero rows; and exit-gate item 4 ("a real planned test round-trips … → *At Lab* (stamped)") was **unperformable by Jay**. Phase 2 is the missing wire.

### 2.5 The request form is a print artifact, not a record

`requestFormPresentation.ts`: `renderTestRequestFormHtml` `:34-325`, a self-contained HTML page with a `window.print()` button `:166`, titled *TEST REQUEST FORM* `:177`, ending in two blank ink-signature lines `:291-317`. Laboratory falls back to the literal `'(To be assigned)'` `:259`; Priority is hardcoded `Standard` `:263`. The request number is derived and discarded:

```ts
const requestNumber =
  testResult.testRequestNumber || 'TRF-' + testResult.id.substring(0, 8).toUpperCase();
```
`requestFormPresentation.ts:45-46`.

**It transmits nothing, records nothing, has no state, and — per §2.4a — nothing in the app links to it.** C2 v1 does not rebuild it and does not wire it; §13.2 `[C2L-c]`.

### 2.6 "Laboratory" today, and why no entity is needed for v1

`laboratoryResponses.ts` is five lines. A "laboratory" is a distinct string harvested from historical `TestResult.laboratoryName` for autocomplete, via `GET /api/test-results/laboratories` (`listRoutes.ts:30-121`, `groupBy` at `:105-117`, `take: 20` at `:116`). There is no lab record, no contact, no accreditation, no lab login. **This is sufficient for v1** — v1 never contacts a lab, so it needs no lab identity. It becomes insufficient the moment J4 flips or C4 starts.

### 2.7 How C1 consumes tests — the invariant C2 must not disturb

The engine lives at `backend/src/lib/readiness/sufficiency/`. It reads exactly five `TestResult` fields, selected at `backend/src/lib/conformancePrerequisites.ts:408-416`:

```ts
testResults: {
  select: { id: true, itpChecklistItemId: true, testType: true, passFail: true, status: true },
},
```

Counting, `evaluate.ts:315-323`, over `predicates.ts`:

```ts
export function testPassing(test: TestResultRow): boolean {
  return test.passFail === 'pass' && test.status === 'verified';   // predicates.ts:162-164
}
export function testFailing(test: TestResultRow): boolean {
  return test.passFail === 'fail' && test.status === 'verified';   // predicates.ts:178-180
}
export function testPendingByStatus(test: TestResultRow): boolean {
  return isPendingTestResultStatus(test.status);                   // predicates.ts:199-201
}
```

`passingCount` is the **only** figure compared against `requiredCount` (`evaluate.ts:425`, via `testCountSufficient`, `counts.ts:70-75`). **C1 counts verified tests only — proven, and the docstring says so at `predicates.ts:153-155`.**

`PENDING_TEST_RESULT_STATUSES` (`testResultStatus.ts:1-8`) is `{pending, submitted, requested, at_lab, results_received, entered}` — **`at_lab` is already a recognised pending status.** This is why the stamp changes no counting: the state it stamps is already classified, and the two new columns are not in the select at `:408-416`.

### 2.8 What an orphan planned row actually costs `[C2R-B2]` — new in Rev 2

Rev 1 claimed the duplicate is "counted twice". **It is not**, and the corrected chain matters because it is the whole justification for Phase 1.

Trace one sample through today's product. A QM creates a planned test → `requested`, no `resultValue`. The certificate arrives; they upload it through the only path that reads a PDF (`POST /upload-certificate`) → a **second** row is created at `results_received` with the extracted values and **no** `lotId`/`itpChecklistItemId` (`testResultMapping.ts:51-79`). In the review modal they set the lot and the checklist item, confirm (`extractionConfirmation.ts:126-150` validates them, `:111` moves it to `entered`), then verify. Now:

- **`passingCount` = 1, not 2.** The new row is verified and passing; the planned row cannot be. Reaching `entered` requires `hasRecordedResult` (`statusWorkflow.ts:49-58`, enforced at `workflowRoutes.ts:303-305`), which the planned row fails, so it can never reach `verified`, so `testPassing` is false for it forever. **No double count. `[C2R-B2]`**
- **`pendingCount` = 1, permanently.** `requested` is in `PENDING_TEST_RESULT_STATUSES` (`testResultStatus.ts:4`), so `testPendingByStatus` is true forever. `evaluate.ts:320` counts it into every rule the planned row attributes to. That number is user-visible in at least four places:
  - `conformanceItems.ts:222` — `if (rule.pendingCount > 0) parts.push(\`${rule.pendingCount} pending\`)`, on the readiness conformance item;
  - `claims/readRoutes.ts:268` — `pendingTests` on claim readiness;
  - `claims/evidenceRoutes.ts:242` and `:457` — per-lot and claim-wide pending test counts on the evidence pack;
  - `evidenceReadiness/claimReview.ts:187-200` — a `pending_tests` **warning** item, *"N test results are not verified yet"*, `severity: 'warning'`, `blocksAction: false`.
- **The register keeps a row nobody can finish.** It cannot advance (no result), it cannot be verified, and deleting it is the only exit — which means deleting the record that a sample was planned.

So the harm is **not** an inflated pass count that would flip a sufficiency verdict. It is: **a count of outstanding work that is permanently wrong, a claim-review warning that never clears, and a register row that is stuck forever.** That is worth one route behaviour. It is not worth an entity model.

---

## 3. The design

**Phase order, per `[C2R-B1]`:** §3.1 (Phase 1) → §3.2 (Phase 2) → §3.3 (Phase 3). §8 slices them into PRs.

### 3.1 Phase 1 — the certificate lands on the row that was waiting

Extend the **shipped** `POST /api/test-results/:id/certificate` (`testResults.ts:214`, handler `certificateAttachment.ts:48-182`) with an opt-in `extract=true` behaviour. Default `false` — **the shipped behaviour is unchanged unless asked for.**

#### 3.1.1 The route writes no extracted value at all `[C2R-B6]`

This is the change from Rev 1, and it makes the code *smaller*:

1. Attach the certificate exactly as today — validate → authorize → magic-byte check → store → swap `certificateDocId` in a transaction. Unchanged.
2. When `extract=true`, call `extractCertificateFields` (`certificateExtraction.ts:182`) **unmodified** — same model, same prompt, same timeout, same silent-degradation fallback.
3. **Return the extraction in the response**, in the same shape the create path returns (`{ extraction: { extractedFields, … } }`), so the shipped review UI can consume it with no new component.
4. **Write nothing else.** No `status`, no `passFail`, no `resultValue`, no `aiExtracted`, no `aiConfidence`. The row is exactly as the human left it, plus a certificate.
5. The frontend opens the **existing** extraction-review UI (the review step of `UploadCertificateModal.tsx`, whose confirm POST is at `:185`), seeded per §3.1.3, and the human confirms.
6. `PATCH /api/test-results/:id/confirm-extraction` — **shipped, unchanged** (`extractionConfirmation.ts:167-237`) — writes the reviewed values, recomputes pass/fail server-side (`:196`), requires a real result (`:200`), and moves the row to `entered`. It already works on any non-verified row and does not require `aiExtracted`.

**Why this is both safer and less code than Rev 1.** Rev 1 needed a merge rule, a shared shaper, a byte-identity test and a second 409 guard, and still landed AI values on a human's row before anyone read them. This version needs a response field and a seeding filter, and **there is no server-side merge to get wrong**. `ponytail:` the review step already exists — route into it instead of re-deciding server-side what a human is about to decide anyway.

#### 3.1.2 One `TestResult` status write on the path, and it is audited `[C2R-A4]`

Phase 1 adds **no** status write, so the audit bypass the review named cannot occur. It does close the pre-existing gap it exposed: `confirmExtraction` writes `status = 'entered'` (`extractionConfirmation.ts:111-113`) with **no `createAuditLog` call anywhere in that module**, and Phase 1 is what first aims that write at a *human's planned row*. Add one `createAuditLog` with `action: AuditAction.TEST_RESULT_STATUS_CHANGED` and `changes: { previousStatus, newStatus }` — the same shape as `workflowRoutes.ts:433`, so the audit stream stays uniform and §4.2's predicate keeps working. **AT-77.**

#### 3.1.3 The seeding filter — certificate-owned fields only when non-empty `[C2R-B3]` `[C2R-A1]`

The review form is seeded field by field:

- **Take the extracted value only when it is non-empty.** `extractCertificateFields` returns `{ value: '', confidence: 0 }` for everything it could not read, and returns *that for all ten fields* whenever the AI call fails or no key is configured (`certificateExtraction.ts:38-42`, `:185-187`, `:243-246`). An empty string is "I did not read this", not "this is blank".
- **Otherwise keep the row's current value**, so a hand-entered `sampleDate`, `sampleLocation`, `laboratoryName` or `testType` survives an extraction that read nothing.
- **`testType` is named explicitly `[C2R-A1]`.** It is the attribution key — `candidateCategories` (`testCategories.ts:310`) resolves it and `testAttributesToRule` (`counts.ts:26-32`) decides which rule the test counts toward — so overwriting a QM's `"Field Density (Nuclear)"` with the fallback `'Certificate Review Required'` (`testResultMapping.ts:63`) would silently move the test out of its rule's count. Under §3.1.1 `buildTestResultData` is **never called on this path**, so the fallback string cannot physically reach the row; **AT-75 asserts that rather than assuming it**, because the protection is a property of the design and a future refactor could quietly remove it.

This is a filter over ten fields at one call site — **not** a shared shaper, and not a server-side merge rule. `[C2L-7]`

#### 3.1.4 Guards, concurrency and latency

- **Keep the shipped 409 on `verified`** (`certificateAttachment.ts:82-88`) `[C2L-B8]`.
- **Re-read the status inside the transaction `[C2R-A6]`.** Today the guard reads at `:61-88` and the write commits at `:120-156` — a window in which a concurrent verify can slip through and have its evidence swapped. Move the `verified` check inside `prisma.$transaction`, on a row read there. **AT-78.**
- **Rev 1's extra 409 on `entered` is WITHDRAWN.** It existed because Rev 1 moved the row back to `results_received`, un-doing a human's confirmation. This design never moves the row, so re-attaching a corrected certificate to an `entered` row and re-confirming is a legitimate correction — and is exactly what the shipped attach already permits. One fewer guard. **AT-73** narrows to the `verified` case only.
- **Latency `[C2R-A7]`.** `AI_EXTRACTION_TIMEOUT_MS` is **120 s** (`certificateExtraction.ts:85`, applied `:233`). Today `POST /:id/certificate` returns in storage time; with `extract=true` it can block for up to two minutes. That profile is not new to the product — the create path has always had it — but it **is** new to this route, so: the attach control must show the same in-flight state the upload modal does, the request must not be fired from a component that unmounts on navigation, and §9 exempts this route from the general budget the way the create path already is.

#### 3.1.5 What Phase 1 is explicitly not: a matcher

There is no fuzzy certificate→sample reconciliation, no candidate scoring, no auto-attach. **The human picks the row.** An algorithm that guesses which planned sample a PDF belongs to is a confident-wrong-answer surface, and duplicate detection is C4's by the program (line 78). The reconciliation the program asks for is achieved by making the correct action *possible*, not by guessing it. `[C2L-d]`

#### 3.1.6 Known ceiling, stated

Because nothing is persisted before confirmation, a page reload mid-review loses the extraction — `GET /:id/extraction` reads `aiConfidence` off the row and there is none. The recovery is to re-attach, which re-extracts. **Deliberate:** persisting an unreviewed extraction is the thing `[C2R-B6]` exists to prevent, and a resume-able review needs a proposal record, which is C4's (§15 note 1, and see `[C2R-A2]` — `AiProposal` is a live subsystem, so that home already exists).

### 3.2 Phase 2 — "Send to lab": the missing wire `[C2R-B1]`

One button. No backend change at all — the transition `requested → at_lab` is already legal (`statusWorkflow.ts:28`), the route already accepts it (`workflowRoutes.ts:240`), and `TEST_CREATORS` already gates it (`:270-272`).

- Add `canSendToLab(test)` beside `canAdvanceTestStatus` in `frontend/src/pages/tests/constants.ts` — true when `test.status === 'requested'`.
- Render a **secondary** *Send to lab* action on the register row (`TestResultsTable.tsx`, beside the existing attach-certificate affordance) and on the mobile card (`TestResultsMobileList.tsx`, in the secondary action list), calling the shipped `onUpdateStatus(test.id, 'at_lab')`.
- Label from the shared helper (`frontend/src/lib/statusLabels.ts`); no inline status strings.

**Why not just add `at_lab` to `nextStatusMap`.** That map drives the *single primary advance button* and means "the mandatory next step" (`constants.ts:28-36` says so). Sending to a lab is optional (`[C2L-B6]` — plenty of tests never go), so making it the primary call to action would put an optional detour in front of every planned test. A secondary action is both smaller and more honest. `[C2L-h]`

**The request form stays unwired.** It would be the natural companion here, but it records nothing and is not the phase's job (§2.5, `[C2L-c]`).

### 3.3 Phase 3 — the two columns, the stamp, and the display

Only meaningful once Phase 2 has shipped and is being used (§1.1).

```prisma
sentToLabAt        DateTime? @map("sent_to_lab_at")
expectedResultDate DateTime? @map("expected_result_date")
```

#### 3.3.1 `sentToLabAt`

System-stamped in the `POST /:id/status` handler when the transition target is `at_lab`, exactly mirroring the shipped `enteredAt`/`verifiedAt` stamping at `workflowRoutes.ts:311-320`. Never user-editable. Idempotent: re-entering `at_lab` does not re-stamp (the transition map forbids `at_lab → at_lab` anyway, `statusWorkflow.ts:29`, but the guard is written rather than assumed).

**Reject does NOT clear it `[C2R-A3]`.** `POST /:id/reject` nulls `verifiedById/At` and `enteredById/At` (`workflowRoutes.ts:95-108`) because it is un-doing those two acts. The sample still went to the laboratory; rejecting the *result* does not un-send it, and clearing the stamp would erase a true fact and restart an elapsed clock that never stopped. `sentToLabAt` is absent from the reject update, deliberately and with this sentence as the reason.

#### 3.3.2 `expectedResultDate`

User-supplied, optional, editable through the existing `PATCH /:id` correction path. **CIVOS never defaults it.** Blank is the normal case and blank is honest (J5).

#### 3.3.3 `expectedResultDate` joins the substantive-edit exemption list `[C2R-B5]`

`crudRoutes.ts:344` currently reads:

```ts
const hasSubstantiveEdit = Object.keys(updateData).some((key) => key !== 'itpChecklistItemId');
```

and `:345-351` then resets a `verified` row to `entered` and nulls `verifiedById`/`verifiedAt`. Left alone, *typing an expected return date on a verified test would un-verify it* — dropping `passingCount` and potentially flipping a sufficiency verdict, which is `[C2L-B1]` breached by a side door.

The exemption becomes a named list — `itpChecklistItemId` and `expectedResultDate` — with the reasoning in the comment, because the list is a trust boundary and the next person adding a column must be made to think about it:

> A test's expected return date is a chase-up aid, not evidence. Editing it says nothing about the result that was verified, so it must not reopen verification — unlike every field that describes what the test measured, which must.

Note the asymmetry is deliberate: `sentToLabAt` needs no exemption because it is never in a PATCH body (it is system-stamped only). **AT-80** asserts both directions — `expectedResultDate` leaves a verified row verified; `resultValue` still un-verifies it.

#### 3.3.4 The display, and the SLA CIVOS must not invent

Two derived values, computed at read time, stored nowhere:

- **Elapsed** — `now − sentToLabAt`, rendered as "at lab 4 days". A **fact**. Shown whenever `sentToLabAt` is set.
- **Overdue** — `status === 'at_lab' && expectedResultDate != null && expectedResultDate < today`. A **judgement**, shown only where a human supplied the date.

**Why no default turnaround `[C2L-B9]`.** The sole evidence is appendix §A line 28, grade **B**, sourced from two lab marketing pages, and it caveats itself: *"Turnarounds are advertised, not SLAs; two labs ≠ the industry — treat as directional."* A CIVOS-computed "overdue" built on that would be a compliance-flavoured judgement resting on two web pages.

**Surfacing is the register chip and nothing else.** The A4 *Needs Attention* feed is cut from this wave (§1.3) — with the list empty until Phase 2 is adopted, wiring a card that renders nothing is scaffolding. Finding the at-lab rows uses the **shipped client-side status filter** (`TestFilters.tsx:127` → `testResultsPageHelpers.ts:66`); no server-side filter is added `[C2R-A5]`.

### 3.4 The entity question — why `TestResult` *is* the sample record (J1, resolved)

**The case for a `Sample` entity:** one physical sample can yield several tests (a single bag → grading, PI, MDD), so a 1:N `Sample → TestResult` is the domain-true shape, and C4's chain-of-custody and duplicate-sample detection both attach naturally to a sample rather than a result.

**Why v1 rejects it anyway — five reasons, in order of weight** (reason 2 corrected per the review's J1 verdict):

1. **The 1:N is real but not yet *load-bearing*.** Nothing in v1's outcome needs it. Certificate-attach, send-to-lab and elapsed-at-lab are all per-**test** facts. Building the parent to serve a child requirement that arrives in C4 is scaffolding, and later can scaffold for itself.
2. **It would force the count question open before anyone needs it answered — and answering it here is forbidden.** *(Corrected: a nullable `TestResult.sampleId` compels nothing on its own — the review is right that Rev 1 overstated this as a hard forcing function.)* The real cost is narrower and still decisive: the moment a sample parent exists, "do N tests off one sample count as N or 1?" becomes a live question that the sufficiency engine (`evaluate.ts:302-312`, distinct-row attribution) has no answer for. That is the "duplicate/re-test inflation" ceiling C1 assigned to **C4** (`wave-c1-test-sufficiency-spec-2026-07-26.md:956`), and answering it in C2 would breach `[C2L-B1]`. **The question arrives when C4 uses it, not when the column exists.**
3. **Migration cost against zero user-visible gain.** Every existing `TestResult` needs a synthesized parent, and `CONFORMANCE_LOT_SELECT` (`conformancePrerequisites.ts:408-416`), the regime stream select (`prismaStream.ts:38-52`), all the test-result routes and three role-gate helpers grow a join.
4. **The columns already exist on the row.** `sampleDate` `:866`, `sampleLocation` `:867`, `testRequestNumber` `:863`. The 1:1 case — overwhelmingly the common one for compaction — is already modelled.
5. **The upgrade path stays open and cheap.** When C4 needs it, add `Sample` and a nullable `TestResult.sampleId`, backfill 1:1, and the count question gets answered by C4 where it belongs. Nothing in v1 forecloses that.

`ponytail:` `TestResult` is the sample record. Add the `Sample` parent when C4's chain-of-custody or duplicate detection needs a subject — not before.

**This is now the final model `[C2L-4]`.** Wave B's test-register importer has been parked on this question since `wave-b-migration-importer-spec-2026-07-26.md:371`; exit item 8 writes the answer back so it un-parks.

### 3.5 What does not change

No new status values `[C2L-B5]`. No change to `VALID_STATUS_TRANSITIONS`. No change to `TEST_CREATORS`/`TEST_VERIFIERS`/`TEST_DELETERS` (`accessControl.ts:32-43`). No change to the verification route, its fields, or its audit action. No change to `extractionConfirmation`'s logic (only one audit call added). No new index. No enum. No change to the request form's HTML. No new endpoint.

---

## 4. Data model and migrations (Phase 3 only)

### 4.1 The migration

```sql
ALTER TABLE "test_results" ADD COLUMN "sent_to_lab_at" TIMESTAMP(3);
ALTER TABLE "test_results" ADD COLUMN "expected_result_date" TIMESTAMP(3);
```

Two nullable columns, no default, no index, no backfill inside the migration. Additive and reversible. Placed after `verifiedAt` in `schema.prisma` (adjacent to the other lifecycle stamps at `:878-881`), so the stamp columns read as one group.

**No index is added.** Any at-lab query filters on `(projectId, status)` — already indexed at `schema.prisma:900` — and the register's filter is client-side anyway (§3.3.4). Indexing a column that is NULL for essentially every row would be cost without benefit.

**Per CLAUDE.md operational warnings:** a reviewed Prisma migration only. Never `prisma db push`, never `--accept-data-loss`, and Railway's start/pre-deploy commands stay blank.

### 4.2 Backfill — correct, and honestly small `[C2R-B4]` `[C2R-B1]`

A one-shot script, run manually after the migration, populating `sentToLabAt` from existing `TEST_RESULT_STATUS_CHANGED` audit rows, taking the earliest per test. Idempotent (`WHERE sent_to_lab_at IS NULL`), per-project, dry-run by default.

**The predicate is `changes.newStatus === 'at_lab'`, not `changes.status`.** The audit writes `changes: { previousStatus: currentStatus, newStatus: status }` (`workflowRoutes.ts:433`) — there is no `status` key on that action, so Rev 1's predicate would have matched **zero rows and reported success**. (`changes: { status: 'verified' }` does exist, at `:231`, but that is the separate `TEST_RESULT_VERIFIED` action.)

**And it will still match approximately nothing.** `at_lab` has been unreachable from every user interface for the life of the product (§2.4a), so the only rows that ever entered it came from direct API calls or test fixtures. The backfill ships because a wrong predicate that silently succeeds is worse than no backfill, and because after Phase 2 the audit stream becomes the recovery path for a lost column — **not** because there is history to recover today. Any PR body claiming otherwise is wrong.

**`expectedResultDate` is never backfilled** — CIVOS has no basis to invent one (§3.3.4). Rows with no audit entry stay NULL and render no elapsed time. That is honest, not degraded.

---

## 5. The C1 invariants C2 must not break

### 5.1 `[C2L-B1]` No new count semantics

**Zero lines change** in `backend/src/lib/readiness/sufficiency/counts.ts`, `evaluate.ts`, `testCategories.ts`, `regime.ts`, or `backend/src/lib/readiness/predicates.ts`. `at_lab` is already whitelisted pending (`testResultStatus.ts:5`); the two new columns are not in `CONFORMANCE_LOT_SELECT` (`conformancePrerequisites.ts:408-416`). A lifecycle state is not a count.

Note what Phase 1 **does** legitimately change: a confirmed attach moves a planned row from `requested` to `entered` and, on verification, to `verified` — so `pendingCount` falls by one and `passingCount` rises by one *for that row*. That is the row's real lifecycle finally completing, not a semantics change; the predicates are untouched and would have produced the same numbers had the user reached the same state by hand.

This is also enforced by the C1 spec's own single-source clause `[C1C-20]` (`wave-c1-test-sufficiency-spec-2026-07-26.md:99`): *"Any change to attribution semantics is made in the shared helper of F1 §4.4, never in `counts.ts` alone."* C2 changes attribution nowhere at all. **AT-63** proves it with a regenerated characterization corpus showing an empty diff.

### 5.2 `[C2L-B2]` No decision-snapshot change

`RequirementEvaluation` rows are immutable by schema contract — `schema.prisma:1715-1717`: *"Rows are immutable: no update/delete API… audit + snapshot are one retention unit."* C2 emits **no** new snapshot key, does **not** bump `resultSchemaVersion`, and does **not** touch `sufficiency/snapshot.ts`. `[C1R-B3]` makes the absence of the `sufficiency` key the pre-C1 discriminator; adding a C2 key would corrupt that discriminator for no gain. **AT-64.**

### 5.3 `[C2L-B10]` MDD stays excluded, and C2 does not build a requirement type

The temptation is direct: the research says MDD is *"a distinct requirement **type**, and it is **per site, not per lot**"* (`c1-mdd-exclusion-research-2026-07-27.md` `## Nuance that affects the engine` item 1), and C2 is the wave that touches samples. **v1 builds none of it.** Four reasons:

1. **It is a new requirement type, therefore new count semantics** — barred by `[C2L-B1]`.
2. **The prerequisite does not exist.** A per-site requirement needs a site identity. `TestResult.sampleLocation` is free text (`schema.prisma:867`) and C1 §7.2 (**line 957**) already names this as the reason spatial claims are C3's.
3. **A boolean cannot decay.** The obvious shortcut — an "MDD assigned" flag — is affirmatively wrong. RC 500.05 §7: assigned values *"shall be checked in accordance with that method if material has been reworked"*, and the research concludes *"If the engine ever tracks assigned-value validity, it needs a staleness trigger, not a permanent pass"* (item 4).
4. **The exemption is conditional in the first place** (item 3): the single-reference shortcut applies only *"For small areas of work… when so permitted by the specification"*.

**Hard handoff, inherited from `[F1C-R8]`** (`test-type-canonicalization-spec-2026-07-27.md:738`): **no C2 PR may add a maximum-dry-density method code to `TEST_TYPE_ALIASES`** (`testCategories.ts:55`). Lab references go in `LAB_REFERENCE_TOKENS` (`testCategories.ts:111-124`) or nowhere; the exclusion mechanism is `candidateCategories`'s first line, `testCategories.ts:314` (`if (own === LAB_REFERENCE) return [];`). **AT-65** re-proves the exclusion after C2 ships: six verified `MDD Standard` tests linked to a compaction item still read **0 of 6** (the shipped assertion is AT-30/AT-57 at `testCategoriesEngine.db.test.ts:251`).

### 5.4 `[C2L-B4]` No LIMS, in any form

Not live integration, and not "format-compatible ingestion" either. The distinction presupposes the format is known; it is not. **NOT FOUND:** any occurrence of `LIMS` or `tabulated` in `docs/research/`. The grade-A source (appendix §A line 27) is a 2023 TfNSW PDF with the caveat *"Confirm currency at C3 start"*, and the register assigns it to **C3**. The first PR in any wave that touches LIMS reads that document first and records a research pass.

### 5.5 `[C2L-B3]` No parallel engine, the evaluator stays pure, and the regime stream cannot move

`evaluateSufficiency` remains pure and synchronous, called from `conformancePrerequisites.ts:574-582`. C2 adds no second evaluator, no cached count, no recalculation job, and no async call inside the gate. The C1 spec §2.2 (**line 186**) states the cost of breaking this: it destroys the batch path's constant-query guarantee and puts a history read inside the serializable transaction (`[C1R-B7]`).

**The frequency-regime stream cannot be moved by any C2 write — re-confirmed at `c9a16fac` with the reviewer's extra check folded in as evidence:**

- `streamEntryConforming` (`regime.ts:203-220`) requires `entry.conformedAt !== null`, no override, **at least one attributable `testPassing`** (`:217`) and **no attributable `testFailing`** (`:219`). Both predicates are `status === 'verified'`-qualified (`predicates.ts:162-164`, `:178-180`).
- Phase 1 writes no status at all, and its one confirmed outcome is `entered` — never `verified` — and it 409s on `verified` rows (§3.1.4). Phase 2 writes `at_lab`. Phase 3 writes two date columns. **No C2 write can make a test read as verified-passing or verified-failing.**
- **The extra check:** stream *ordering* is `STREAM_ORDER_DESC = [{conformedAt:'desc'},{createdAt:'desc'},{id:'desc'}]` (`regime.ts:108-113`, used at `:161`, applied at `prismaStream.ts:35`) — three `Lot` columns, none of which any C2 phase touches. The window a regime is computed over therefore cannot be re-ordered by C2 either.
- The stream select (`prismaStream.ts:38-52`) reads `testType`/`passFail`/`status` plus the linked item's `testType`. C2 touches none of those on the attach path, and the two new columns are absent from it.

### 5.6 `[C2L-B11]` Sufficiency still never blocks a claim

C1's hard prohibition `[C1R-B2]` (C1 spec §5.3, **line 830**) keeps sufficiency out of `getClaimBlockingReasonsForConformedLot` (`backend/src/lib/conformancePrerequisites.ts:192-233` `[C2L-5]`). **A lifecycle state must not enter it either** — an "at lab" or "overdue" test making a conformed lot un-claimable would be the same failure by a different door. AT-11's byte-identical assertion must still pass unchanged. **AT-71.**

---

## 6. API and UI surface

### 6.1 Backend

| Phase | Change | Route / file | Note |
| --- | --- | --- | --- |
| 1 | `extract=true` | `POST /api/test-results/:id/certificate` (`testResults.ts:214`, `certificateAttachment.ts:48-182`) | §3.1. Default `false`. Returns the extraction; writes no extracted value. |
| 1 | Status-change audit | `extractionConfirmation.ts` (beside `:111-113`) | `[C2R-A4]`. One `createAuditLog`, `changes: { previousStatus, newStatus }`. |
| 1 | Transaction-scoped `verified` guard | `certificateAttachment.ts:82-88` → inside `:120` | `[C2R-A6]`. |
| 2 | *(none)* | — | Phase 2 is frontend-only. The transition, route and role gate all ship. |
| 3 | Stamp `sentToLabAt` | `POST /api/test-results/:id/status` (`workflowRoutes.ts:240`) | Additive; mirrors `:311-320`. No role change. |
| 3 | Accept `expectedResultDate` | `POST /api/test-results` (`crudRoutes.ts:91`), `PATCH /:id` (`crudRoutes.ts:226`) | Optional, nullable, date-normalised through the shipped `validation.ts` helpers. **Added to the `crudRoutes.ts:344` exemption list** `[C2R-B5]`. |
| 3 | Both fields in responses | The `select` blocks in `listRoutes.ts:212-254` and `crudRoutes.ts` (list, detail and patch selects) | `[C2R-A9]` — the fields must be added where the rows are **selected**; `listResponses.ts`/`detailResponses.ts` only shape what was already fetched. Additive keys only. |

**CUT from Rev 1:** the `?atLab=true` filter on `GET /api/test-results` (`listRoutes.ts:124`) `[C2R-A5]`; the shared shaper over `buildTestResultData` `[C2L-7]`; the second 409 on `entered` (§3.1.4).

**No new endpoint. No new role. No change to `TEST_VERIFIERS`.**

### 6.2 Frontend

| Phase | Surface |
| --- | --- |
| 1 | An *Extract from certificate* option on the shipped `AttachCertificateButton.tsx`; on success, open the **existing** extraction-review UI (the review step of `UploadCertificateModal.tsx`) seeded per §3.1.3; confirm through the shipped `PATCH /:id/confirm-extraction` (`UploadCertificateModal.tsx:185`). In-flight state must survive a 120 s call `[C2R-A7]`. |
| 2 | A secondary *Send to lab* action on the register row and the mobile card, gated on `canSendToLab` (`constants.ts`), calling the shipped `onUpdateStatus(test.id, 'at_lab')` (`TestResultsPage.tsx:320-344`). §3.2. |
| 3 | The at-lab elapsed/overdue chip on the existing register row; an optional *Expected result date* input in the existing "Add lab & sample details" collapsible that `docs/plans/test-workflow-simplification-plan-2026-07-06.md:97-99` already specifies and ships. |
| 3 | **Delete** the `nataSiteNumber` input and its three companions (J3, §13.1). |

Status labels come from the shared helper (`frontend/src/lib/statusLabels.ts`) — no inline status strings. Uniform card rules apply: icon + label + chip + chevron, no subtitles.

---

## 7. Security, tenancy and privacy

### 7.1 Tenancy

Both new columns live on `TestResult`, which is already project-scoped (`projectId`, `schema.prisma:859`) and cascade-deleted with the project (`:890`). Every read path continues through the shipped guards: `requireProjectReadAccess` (`accessControl.ts:92`), `requireTestResultReadAccess` (`:175-181`), `getReadableProjectIds` (`:56`), and `requireTestResultsPortalAccess` (`:103`) for the subcontractor module gate. Subcontractor lot scoping (`getAssignedSubcontractorLotIds`, `:112`) is unchanged. With `?atLab=true` cut, C2 adds **no new query surface to scope** — **AT-69** therefore asserts what actually changed: the attach-with-extract route refuses a cross-tenant `:id`, and the register list is unchanged.

### 7.2 The upload surface — a delta review, not a new threat model

Phase 1 adds **no new upload surface**. It reuses the shipped, authenticated multer instance (`certificateStorage.ts:51-62`) with its 10 MB cap (`:53`), mimetype allowlist (`:55`) and magic-byte re-check (`certificateIntake.ts:132`), and the shipped Supabase path construction (`:73-95`) with its per-project prefix. The delta is: *the same authenticated user, uploading the same validated file, to the same bucket path, on an existing row, with the shipped AI extraction now reading it and the result shown to a human before anything is written.* Authorization is the existing `TEST_CREATORS` check plus the transaction-scoped `verified` 409.

One genuinely new exposure, named: the attach route now **sends an uploaded file to Anthropic**, which it did not before. Same provider, same key, same prompt and same data class as the shipped create path — no new egress destination, no new secret — but it is a new *route* doing it, and §7.4 covers what is sent.

### 7.3 The threat-model gate `[C2L-B12]`

Program §7 line 134 gates C2 on *"threat model as a gated artifact before A3, C2, D2, E (offline device storage; lab/file upload; asset import; external links)."* **NOT FOUND:** any threat-model artifact under `docs/`.

The gate is satisfied for v1 **by scope**: v1 builds no external link and no unauthenticated surface, and §7.2 is the review. **It is not satisfied in general.** The moment J4 flips and an external lab upload link is built, the threat-model artifact becomes a hard precondition — a PR, not a paragraph. Recorded as exit item 7 and §13.1 J4.

### 7.4 Data sensitivity

Neither column carries personal data. `sentToLabAt` is system-generated; `expectedResultDate` is a user-entered business date. No secret, no credential, no new external egress destination. The AI call is the shipped one — no new provider, no new key, no change to what is sent (the certificate image/PDF and the fixed prompt at `certificateExtraction.ts:212-226`).

---

## 8. Phases and PR slicing — **INVERTED from Rev 1** `[C2R-B1]` `[C2L-6]`

Each phase is independently shippable, independently revertible, PR-sized, and **useful on its own**. That last property is what Rev 1's order lacked.

### Phase 1 — the certificate lands on the existing row (M) — *ships first*

- **Depends on:** nothing.
- **Why first:** it is the only phase that fixes a harm users have today (§2.8), and it needs no adoption of any new habit — it improves the action they already take.
- `extract=true` on `POST /:id/certificate`; return the extraction, write no extracted value (§3.1.1); seeding filter at the attach call site, `testType` protected (§3.1.3); route into the shipped review UI (§3.1.1 step 5); `verified` guard re-read inside the transaction (§3.1.4); one `createAuditLog` on the confirm write (§3.1.2).
- **Zero behaviour change by construction:** `extract` defaults to `false`; the create path is not touched at all (no shared shaper — `[C2L-7]`); `confirmExtraction`'s logic is unchanged.
- **Exit:** AT-63, AT-64, AT-65, AT-66, AT-69, AT-71, AT-72, AT-73, AT-75, AT-76, AT-77, AT-78.

### Phase 2 — "Send to lab" (S) — *the missing wire*

- **Depends on:** nothing (independent of Phase 1; sequenced after it only because Phase 1 is worth more).
- `canSendToLab` in `constants.ts`; a secondary action on the register row and mobile card; no backend change. §3.2.
- **Zero behaviour change by construction:** an added optional action; `nextStatusMap` and the primary advance button are untouched.
- **Exit:** AT-79.

### Phase 3 — the columns, the stamp and the display (M) — *merged C2.1 + C2.3*

- **Depends on:** Phase 2 merged. Shipping the stamp before the control that triggers it is what Rev 1 did, and it produces a column that is NULL on every row forever.
- **Merged because they are one slice:** a stamp with no display answers nothing, and a display with no stamp renders nothing. Separating them ships two PRs neither of which is demonstrable.
- Migration §4.1; `schema.prisma` fields; stamp beside `workflowRoutes.ts:311-320`; `expectedResultDate` on create/patch **plus the `crudRoutes.ts:344` exemption** `[C2R-B5]`; both fields in the route `select` blocks `[C2R-A9]`; backfill §4.2 on `changes.newStatus` `[C2R-B4]`, shipped in this PR, run manually, dry-run by default; elapsed/overdue chip; *Expected result date* input; delete the `nataSiteNumber` input (J3).
- **Exit:** AT-63, AT-64, AT-67, AT-70, AT-71, AT-72, AT-80.

### C2.4 — external lab upload link — **DEFERRED, specified nowhere**

Not designed in this document. It does not start until the §7.3 threat-model artifact exists **and** Jay asks (J4). Recorded so the phase can be picked up cold rather than silently forgotten.

### Shipping in parallel, outside C2

The **reject-notification honesty fix** (old J2, old AT-74) is an independent PR with no dependency on any phase above. §13.1 J2.

---

## 9. Scale and performance

No new index, no new join, no new query on any readiness or claim path. No new server-side filter (`[C2R-A5]` cut the only candidate).

**Budgets, inherited unchanged:** lot readiness p95 < 2,000 ms; claim create p95 < **3,000 ms** at 5,000 members (`[C1C-14]`, #1581 `0d94beba`, accepted by Jay 2026-07-27); **zero additional queries** on the conformance and claim-readiness paths; no increase in serializable-transaction retries.

**One route is exempt, and says so `[C2R-A7]`:** `POST /:id/certificate?extract=true` inherits the 120 s AI timeout (`certificateExtraction.ts:85`, applied `:233`), exactly as the shipped `POST /upload-certificate` already does. This is a user-initiated document action, not a readiness path; it must not be measured against the readiness budget, and it must not be called from anything that blocks a page render.

**AT-72** asserts the query count on `checkConformancePrerequisites` is unchanged, because "we only added columns" is exactly the claim that stops being true when someone adds them to a select.

---

## 10. Rollback and recovery

| Phase | Rollback |
| --- | --- |
| 1 | Revert. `extract=true` is opt-in, so no shipped caller changes. Rows already completed through the review flow keep their human-confirmed values and remain correctable through the shipped `/confirm-extraction` path. **No unreviewed AI value was ever written**, so there is nothing to un-write. |
| 2 | Revert the button. Rows already at `at_lab` stay there and can still advance — `at_lab → entered` is a shipped transition (`statusWorkflow.ts:29`). |
| 3 | Revert the code; **leave the columns**. Nullable, unread, unindexed — an orphaned nullable column costs nothing and dropping it loses whatever the stamp captured. |

**Data-loss risk: none.** No column is dropped, no row deleted. The only overwrite risk Rev 1 carried — extracted values landing on a populated row — is designed out (§3.1.1), not merely guarded. After Phase 2, `sentToLabAt` is recoverable from the audit log at any time (§4.2).

---

## 11. Acceptance tests

Continuing the shared series — C1 ended at AT-21, D14 ran to AT-55b, F1 to AT-62. **C2 starts at AT-63.** Every item is a real assertion in a real test file.

| AT | Phase | Assertion | Where |
| --- | --- | --- | --- |
| **AT-63** | 1, 3 | **No count changed.** Regenerated characterization corpus (`readiness/characterization/seedCorpus.ts`) produces an empty diff; `predicates.parity.test.ts` extended with the two new columns present and populated. `[C2L-B1]` | `backend/src/lib/readiness/` |
| **AT-64** | 1, 3 | **No snapshot changed.** `RequirementEvaluation.result` is byte-identical for a lot before and after a lifecycle write; `resultSchemaVersion` still `1`. `[C2L-B2]` | `recordDecision.db.test.ts` |
| **AT-65** | 1 | **MDD still excluded.** Six verified `MDD Standard` tests linked to a compaction item read **0 of 6** after C2 ships; no MDD code appears in `TEST_TYPE_ALIASES`. `[C2L-B10]` `[F1C-R8]` | `testCategoriesEngine.db.test.ts` |
| **AT-66** | 1 | **Empty extractions never blank a populated row `[C2R-B3]`.** Given a row with hand-entered `sampleDate`, `sampleLocation`, `laboratoryName`, `resultValue`, `resultUnit` and spec bounds, and an extraction where every field is `{ value: '', confidence: 0 }` (the `createManualReviewExtraction` shape), the review form is seeded with the **row's** values for every one of them, and a confirm writes them back unchanged. Field by field. | `certificateAttachment.test.ts` + the seeding filter's own unit test |
| **AT-67** | 3 | **The stamp, and the backfill predicate.** `requested → at_lab` sets `sentToLabAt`; `requested → entered` (the legal one-hop, `statusWorkflow.ts:28`) leaves it NULL and the row still reaches `verified` `[C2L-B6]`. The backfill matches an audit row shaped `changes: { previousStatus, newStatus: 'at_lab' }` and does **not** match one shaped `changes: { status: 'at_lab' }` `[C2R-B4]`. | `workflowRoutes` coverage + backfill script test |
| ~~AT-68~~ | — | **RETIRED `[C2L-7]`.** Rev 1's `buildTestResultData` byte-identity assertion died with the shared-shaper refactor it guarded. The number is not reused. | — |
| **AT-69** | 1 | **Tenancy.** `POST /:id/certificate?extract=true` for a test result in another company returns 403/404 and stores nothing; a subcontractor is refused on a non-assigned lot's test. (Rev 1's `?atLab=true` variant is void — the filter was cut `[C2R-A5]`.) | `certificateAttachment` / route coverage |
| **AT-70** | 3 | **Overdue is only ever user-grounded.** A row at `at_lab` for 30 days with `expectedResultDate` NULL is **not** overdue and shows elapsed days; set the date in the past and it is. No default is applied anywhere. `[C2L-B9]` | new `labLifecycle.test.ts` |
| **AT-71** | 1, 3 | **Claims still unblockable.** `getClaimBlockingReasonsForConformedLot` returns byte-identical output with a test at `at_lab`, overdue, and NULL — extending AT-11. `[C2L-B11]` | `conformancePrerequisites.test.ts` |
| **AT-72** | 1, 3 | **Query count unchanged** on `checkConformancePrerequisites` and the claim-readiness batch. | `readiness` benchmark |
| **AT-73** | 1 | **The 409 holds, and only the one that is needed.** Extract-onto refuses on `verified` (`certificateAttachment.ts:82-88`). Attaching to an `entered` row **succeeds** — the Rev 1 guard is withdrawn (§3.1.4). | `certificateAttachment.test.ts` |
| ~~AT-74~~ | — | **TRANSFERRED** to the independent reject-notification PR (old J2). Not a C2 exit criterion. | — |
| **AT-75** | 1 | **`testType` is protected `[C2R-A1]`.** A row typed `Field Density (Nuclear)` attached with an extraction whose `testType.value` is `''` keeps its `testType`; the string `'Certificate Review Required'` never reaches the row; and the rule the test attributes to (`candidateCategories` → `testAttributesToRule`) is unchanged before and after. | `certificateAttachment.test.ts` + `testCategories` assertion |
| **AT-76** | 1 | **No unreviewed AI value is ever written `[C2R-B6]`.** After `POST /:id/certificate?extract=true` returns, the row in the database differs from its pre-call state **only** in `certificateDocId` — `status`, `passFail`, `resultValue`, `resultUnit`, spec bounds, `testType`, `aiExtracted` and `aiConfidence` are all untouched. The values appear only after `PATCH /:id/confirm-extraction`. | `certificateAttachment.test.ts` |
| **AT-77** | 1 | **The status move is audited `[C2R-A4]`.** Confirming an extraction writes a `TEST_RESULT_STATUS_CHANGED` audit row with `changes: { previousStatus: 'requested', newStatus: 'entered' }`. | `extractionConfirmation` coverage |
| **AT-78** | 1 | **The guard is transaction-scoped `[C2R-A6]`.** A row that becomes `verified` between the pre-read and the commit causes the attach to fail with 409 and leaves `certificateDocId` unchanged (simulated by mutating status inside the transaction callback). | `certificateAttachment.test.ts` |
| **AT-79** | 2 | **`at_lab` is reachable `[C2R-B1]`.** `canSendToLab` is true for `requested` and false for every other status; the register row and the mobile card render the action and it POSTs `{ status: 'at_lab' }`; the primary advance button's target is unchanged for every status (`nextStatusMap` untouched). | `constants.test.ts`, `TestResultsTable`/`TestResultsMobileList` coverage |
| **AT-80** | 3 | **`expectedResultDate` does not un-verify `[C2R-B5]`.** `PATCH /:id` with only `expectedResultDate` on a `verified` row leaves `status: 'verified'` and `verifiedById`/`verifiedAt` intact; the same PATCH with `resultValue` still resets to `entered` and nulls them. | `crudRoutes` coverage |

**Note on coverage shape.** Every existing test under `backend/src/routes/testResults/` is a unit test over pure helpers or mocked Prisma; the HTTP-level coverage lives in `backend/src/routes/testResults.test.ts` (supertest, 4,219 lines, already driving `/status` — including `{ status: 'at_lab' }` at `:1688` — `/request-form` and the certificate routes). AT-69, AT-73, AT-76, AT-77, AT-78 and AT-80 belong there or in the colocated unit files where the decision can be extracted into a pure helper — the pattern the directory already uses everywhere else.

---

## 12. Exit gate

1. **`[C2L-B1]` proven, not asserted** — AT-63's regenerated corpus diff is empty and is shown in the PR body. *No count changed* is the claim this wave lives or dies on.
2. **`[C2L-B2]` proven** — AT-64 green; `resultSchemaVersion` still `1`; `sufficiency/snapshot.ts` unmodified in the diff.
3. **`[C2L-B10]` re-proven after the fact** — AT-65 green, and the PR body states that no MDD alias was added.
4. **A real planned test round-trips on a real project** *(now performable, per `[C2R-B1]`)*: created `requested` → **Send to lab** (Phase 2) → stamped (Phase 3) → certificate uploaded with `extract=true` onto **that row** → **the extracted values shown for review before anything is written** → confirmed → verified by a QM — and the register shows **one row, not two**, with no lingering "tests still pending" warning. Owner **Jay**.
5. **The overdue signal is honest on screen** — a test at lab with no expected date reads "at lab 4 days" and is **not** flagged late. AT-70 green. **And the PR body states the adoption dependency** (§1.1 item 3): the list is empty until crews use the Phase 2 control, and the backfill recovered ~nothing.
6. **`git diff` touches none of** `sufficiency/counts.ts`, `evaluate.ts`, `testCategories.ts`, `regime.ts`, `predicates.ts`, `snapshot.ts`. Mechanically checkable; check it mechanically.
7. **The threat-model gate is recorded, not quietly passed** — §7.3 states in the PR body that v1 adds no new upload surface, that the attach route now sends files to the shipped AI provider (§7.2), and that the artifact remains a hard precondition for C2.4.
8. **The model is declared final and Wave B is told** `[C2L-4]` — J1's answer is written into `wave-b-migration-importer-spec-2026-07-26.md:371` as a follow-up amendment, not left implicit.
9. **§9 budgets met**, AT-72 green, zero additional queries; the `extract=true` route's 120 s profile is named in the PR body, not discovered in production.
10. **Tenancy green** — AT-69.
11. **The `[C2L-1]`/`[C2L-2]`/`[C2L-3]`/`[C2L-5]` stale citations are filed** as an amendment against the C1 spec, not silently left stale.
12. **`npm run fallow:audit` verdict recorded in every PR body.**
13. **Docs and the Clancy knowledge mirror updated** with the two new fields, the *Send to lab* action, and what "at lab" now means.

**Not in this gate, deliberately:** anything about enforcement. C2 turns no gate on. `testSufficiencyMode` defaults and the block-mode acceptance gate (`d14-q6-pack-spec-2026-07-27.md` §15.1) are untouched, and no C2 phase may change a project's mode. Also not in this gate: the reject-notification fix — it ships as its own PR with its own gate.

---

## 13. Decisions

### 13.1 Jay's decisions — **all six resolved**

1. **J1 — A `Sample` entity, or the lifecycle on `TestResult`?** → **RESOLVED: on `TestResult`.** §3.4 has the argument, with reason 2 corrected per the review: a nullable `sampleId` compels nothing by itself, and the count question ("do N tests off one sample count as N or 1?") *arrives when C4 uses the parent*, not when the column appears. The other four reasons stand and are sufficient. **This is the final model** — exit item 8 writes it back to Wave B `[C2L-4]`.
2. **J2 — Fix the reject-notification lie?** → **RESOLVED: yes — and it ships as an INDEPENDENT PR, in parallel with this spec, not inside any C2 phase.** The bug: `POST /:id/reject` builds `engineerNotified` (`workflowRoutes.ts:131`) and the handler returns at `:144` having **never created a `Notification` row and never sent an email**, while `buildTestResultRejectedResponse` reports `notification.sent` (`verificationResponses.ts:34`). *Precision `[C2R-A10]`:* that field is **conditional** — `sent: engineerNotified !== null` — so it reports `true` exactly when a recipient email exists and `false` otherwise. It is still a lie whenever it says `true`. The shipped `results_received` notification block (`workflowRoutes.ts:347-423`) is the pattern to route through. **Why independent:** it is a pre-existing honesty bug with no dependency on any C2 phase; Rev 1 bundled it only because Rev 1's C2.3 was adding a second notification beside it, and Rev 2's Phase 3 no longer does. Old AT-74 travels with that PR.
3. **J3 — The half-built `nataSiteNumber` field: delete it or persist it?** → **RESOLVED: delete the input, and all four frontend sites go together.** There is **no column, no route accepting it, and no backend reference anywhere** — `grep -ri nata` over `backend/src` and `backend/prisma` returns **zero** matches. It is silently dropped on every submit today. The four sites `[C2R-A10]`:
   - `frontend/src/pages/tests/components/CreateTestModal.tsx:407-411` — the `<Label>` / `<Input>` / `register('nataSiteNumber')` block;
   - `frontend/src/pages/tests/components/CreateTestModal.tsx:27` — `nataSiteNumber: z.string().trim()` in the zod schema;
   - `frontend/src/pages/tests/constants.ts:220` — `nataSiteNumber: ''` in the form defaults;
   - `frontend/src/pages/tests/types.ts:75` — `nataSiteNumber: string` on the form type.
   
   (Plus the fixture at `TestResultsPage.test.tsx:70`, which follows.) Deleting only the input leaves three orphans and a type that lies. This is not random dead UI: `docs/plans/test-workflow-simplification-plan-2026-07-06.md:98` specified *"lab name, NATA site, request/report numbers"* and the frontend half shipped while the backend half never did. Lab accreditation metadata is **C4** (program line 78). **One-line why:** a field that silently discards what a QM typed is worse than no field.
4. **J4 — Build the external lab upload link in v1?** → **RESOLVED: no, defer to C2.4.** It is an unauthenticated external write surface and the single clearest reason program §7 line 134 gates this wave on a threat model — and **NOT FOUND:** any threat-model artifact in `docs/`. **Binding on the build:** if this flips, the threat-model artifact ships as its own PR **before** any code, and §7.2's delta review is not a substitute.
5. **J5 — Expected result date: user-entered, or a CIVOS default turnaround?** → **RESOLVED: user-entered; blank shows elapsed days only.** The sole turnaround evidence is grade **B**, from two lab marketing pages, self-caveated *"two labs ≠ the industry — treat as directional"* (appendix §A line 28). **And the success test is restated honestly with it** (§1.1 item 3): because `at_lab` was never reachable, the overdue list starts empty on every project and fills only as teams adopt the Phase 2 control. The reasoning for user-entry is sound; the *value* is adoption-dependent, and the spec says so rather than implying day-one payoff.
6. **J6 — Make "the model is final, Wave B unblocked" an exit-gate item?** → **RESOLVED: yes** (exit item 8). Wave B's `ImportBatch.kind` reserves `'test_register'` and explicitly waits on *"the Wave C sample/test lifecycle model is final"* (`wave-b-migration-importer-spec-2026-07-26.md:371`). J1's answer **is** that model. **One-line why:** without an explicit hand-off, B stays parked forever on a question C2 already answered.

### 13.2 The spec's own decisions

- **`[C2L-a]` — Two columns, not one, not a table.** → §3.3. Elapsed is a fact and lateness is a judgement; one column forces either an invented SLA or the loss of the fact. *Rejected:* a `TestResultStatusHistory` table — the transition is already audited (`workflowRoutes.ts:427-435`) and a second history store would be a parallel record of the same event. *Flip condition:* a rule that needs the duration of a state other than `at_lab`.
- **`[C2L-b]` — No `sampled` status.** → §1.2. `sampleDate` (`schema.prisma:866`) already carries it. *Flip condition:* a rule that must distinguish "sampled but not yet sent" from "planned" — none exists in any shipped pack.
- **`[C2L-c]` — The request form is neither rebuilt nor wired, and the TRF number is not written back.** → §2.5. Writing back would make `testRequestNumber` (`schema.prisma:863`, never written by anything) semi-populated: some rows carrying a real lab reference, others a UUID prefix CIVOS invented, with nothing to tell them apart. And the form has **no caller at all** (`[C2R-B1]`), so wiring it is a second feature, not a detail of this one. *Flip condition:* a lab asks for a CIVOS-issued reference on the form.
- **`[C2L-d]` — Human-chosen attach, never a matcher.** → §3.1.5. *Flip condition:* C4 ships duplicate detection and a matcher can be built on a real identity rather than a guess.
- **`[C2L-e]` — No new index, and no server-side status filter.** → §4.1, `[C2R-A5]`. `(projectId, status)` (`schema.prisma:900`) covers anything needed; the register filters client-side already. *Flip condition:* a real project's at-lab list exceeds what the client filter can hold.
- **`[C2L-f]` — Per-production-day limbs deferred**, though `[C1R-4]` assigns them to C2. No shipped pack declares one: D14 §5.4.2 **recorded** Q6's one-shift limb rather than encoding it. *Flip condition:* a pack that would otherwise ship needs a per-day count.
- **`[C2L-g]` — `ponytail:` the lifecycle mostly exists; C2 adds one route behaviour, one button and two columns.** The over-build available here — a `Sample` entity, a `Laboratory` entity, a status-history table, an SLA model, a matcher, an external portal, a shared shaper — is roughly ten times the code for zero additional answered questions in v1, and several of those answers would be wrong.
- **`[C2L-h]` — *Send to lab* is a secondary action, not a `nextStatusMap` entry.** → §3.2. That map means "the mandatory next step" (`constants.ts:28-36`); sending to a lab is optional (`[C2L-B6]`). *Flip condition:* a customer's process makes the lab hop mandatory for a category — then it is a per-category rule, still not a global map change.
- **`[C2L-i]` — New in Rev 2: no extracted value is persisted before a human sees it.** → §3.1.1. This is stricter than the shipped create path, deliberately: the create path writes to a row it invented, and Phase 1 would be writing to a row a QM authored. *Flip condition:* C4 ships an `AiProposal`-backed intake (`[C2R-A2]` — the subsystem is live, not unused), at which point both paths route through it and neither writes live.

---

## 14. Research: settled, and what must not be invented

### 14.1 Settled — do NOT commission another pass

- **MDD does not count toward N.** Grade A, both jurisdictions, `c1-mdd-exclusion-research-2026-07-27.md` VERDICT. Enforced at `testCategories.ts:314`. C2 re-proves it (AT-65); it does not re-research it.
- **MDD is a per-SITE paired requirement, not a per-lot one.** Same doc, nuance 2: *"Do not add a '1 MDD per lot' requirement — no source supports that."* Settled as a **prohibition**; building the requirement type is a scope decision (§5.3), not a research gap.
- **Assigned MDD values decay on rework.** RC 500.05 §7, nuance 4. Settled well enough to forbid the boolean-flag shortcut. Not settled enough to build the staleness trigger.
- **Australian labs return PDFs, 1–5 business days, no universal API.** Grade **B**, appendix §A line 28 — directional only. Enough to justify the pre-cover gate's value; **not** enough to compute an SLA (J5).

### 14.2 Must be researched before it is encoded — never inferred

- **The TfNSW LIMS tabulated format.** Grade-A source identified (appendix §A line 27, 2023) and **never read by any CIVOS pass**. Assigned to **C3**. No C2 code touches it `[C2L-B4]`.
- **Lab turnaround as an SLA.** Would need real lab agreements, not marketing pages.
- **Chain-of-custody requirements.** **Zero** occurrences of "chain of custody" in `docs/` or `tasks/`. Program line 78 assigns it to **C4**.
- **QLD/TMR Q142A.** Primary text **NOT FOUND** (`c1-mdd-exclusion-research-2026-07-27.md` `## What was NOT found`). Ship no QLD-specific claim citing that research.
- **Non-cohesive materials use density *index* (AS 1289.5.6.1), not density *ratio*** — nuance 7, flagged and unresearched. Not C2's, but do not let a lifecycle PR quietly assume ratio.

---

## 15. Verification notes — re-derived at `c9a16fac`

### 15.1 Sibling-spec claims: true, citations stale

| Claim | Cited as | Actual at `c9a16fac` | Status |
| --- | --- | --- | --- |
| `TestResult.sampleLocation` is free text | C1 spec §7.2 cites `schema.prisma:836` | **`schema.prisma:867`** | `[C2L-1]` — claim true, citation stale |
| `TestResult` carries `rejectedById`/`rejectedAt`/`rejectionReason` | `predicates.ts:176` cites `schema.prisma:846-853` | **`schema.prisma:882-884`** | `[C2L-2]` — claim true, citation stale |
| `getClaimBlockingReasonsForConformedLot` is where sufficiency must never appear (`[C1R-B2]`) | C1 spec §5.3 cites `conformancePrerequisites.ts:166-207` | **`backend/src/lib/conformancePrerequisites.ts:192-233`** — and note the **path**: `lib/`, not `lib/readiness/` | `[C2L-5]` — prohibition intact, citation and path stale |

### 15.2 `[C2R-A8]` — every `wave-c1-test-sufficiency-spec-2026-07-26.md` line citation, re-derived

Rev 1's citations were correct at `bb28c44b` and moved with #1627. **The drift is not uniform** — it is −1 before ~L102, +24 between there and ~L689, and +30 after — so a blanket offset would have been wrong. Each was re-opened individually:

| Claim | Rev 1 cited | Correct at `c9a16fac` | Drift |
| --- | --- | --- | --- |
| `[C1C-20]` single-source clause | :100 | **:99** | −1 |
| §1 non-goal "C2 sample lifecycle" | :125 | **:149** | +24 |
| §1 non-goal "per-production-day owned by C2 `[C1R-4]`" | :126 | **:150** | +24 |
| §2.2 "pure and synchronous by design" / cost of async | :162 | **:186** | +24 |
| §5.3 `[C1R-B2]` prohibition | :800 | **:830** | +30 |
| §7.2 duplicate/re-test inflation ceiling (C4) | :926 | **:956** | +30 |
| §7.2 `sampleLocation` free text / spatial is C3's | :927 | **:957** | +30 |
| §7.2 "no production-day limb, owned by C2" | :928 | **:958** | +30 |
| §16.1 "build the compaction band in C2" (superseded) | :1316 | **:1346**, with its own supersession note at **:1348** | +30 |

### 15.3 `[C2R-A10]` — six shipped-code drifts in Rev 1, corrected

| Rev 1 said | Actual at `c9a16fac` |
| --- | --- |
| certificate cleanup branches at `certificateIntake.ts:119,127,**135**,151,185` | **`:134`** (`:132` is the magic-byte check itself) |
| "Anthropic Messages API by raw `fetch` (`certificateExtraction.ts:191`)" | It is **`fetchWithTimeout`** (`:190`, imported at `:2`); `:191` is the URL argument. Not raw `fetch`. |
| `nataSiteNumber` lives at `CreateTestModal.tsx:407-409` | **Four** sites: `CreateTestModal.tsx:407-411` (label/input/register), `CreateTestModal.tsx:27` (zod), `constants.ts:220` (default), `types.ts:75` (type). J3. |
| sufficiency call at `conformancePrerequisites.ts:575-583` | The statement spans **`:574-582`**; `evaluateSufficiency(` is at `:575`. File is `backend/src/lib/`, not `lib/readiness/`. |
| "`verificationResponses.ts:26-38` reports `notification.sent: true`" | `buildTestResultRejectedResponse` is at **`:26-38`**, but the field is **conditional**: `sent: engineerNotified !== null` at **`:34`**. J2. |
| status audit `changes` at `workflowRoutes.ts:427-432` | The `createAuditLog` block spans **`:427-435`**; `changes: { previousStatus, newStatus }` is at **`:433`**. `[C2R-B4]` |

### 15.4 Observations for whoever builds this — none blocking

1. **The create path still writes live rows before any human sees them — and `AiProposal` is NOT unused `[C2R-A2]`.** `POST /upload-certificate` creates a real `TestResult` at `results_received` with unreviewed AI values (`certificateIntake.ts:171`, `testResultMapping.ts:77`), and still creates one when the AI fails or `ANTHROPIC_API_KEY` is absent, from a **filename guess** at confidence 0.15–0.45 (`certificateExtraction.ts:44-60`, `:243-246`). Rev 1 called `AiProposal` (`schema.prisma:1995`) an "unused model"; that was **wrong** — it has **56 references across 16 backend source files** and is the live Wave 1 copilot proposal subsystem (`copilot/proposalService.ts`, `controlLineExecutor.ts`, `lotBreakdownExecutor.ts`, `planSheetExecutor.ts`, `import/itpTemplateImportExecutor.ts`, `chat/tools.ts`, …). That makes it a **better** home for C4's "extraction source + confidence on every AI value", not a speculative one: the table, the service and the audit pattern all exist. Moving certificate intake behind a proposal is not C2 v1 work, but Phase 1's design (`[C2L-i]` — persist nothing unreviewed) is deliberately built to be the first half of that move.
2. **Specifications are never applied.** The 13-entry `testTypeSpecifications` table (`specifications.ts:22-127`) is exposed on two GET routes and read by the verification view, but **no create or confirm path ever seeds `specificationMin`/`specificationMax` from it** — pass/fail is computed against whatever bounds the AI read off the certificate or the user typed (`derivePassFail`, `certificateExtraction.ts:323-339`). Out of C2's scope; worth knowing before anyone assumes a spec binding exists.
3. **`itpChecklistItemId` has no index** (`schema.prisma:861`, indexes at `:899-903`) despite being the strong-match key in the conformance gate. Not C2's to fix; noted so it is not discovered twice.
4. **`GET /:id/request-form` and `GET /:id/workflow` are both dead frontend-side** (`[C2R-B1]`, §2.4a). Two working backend features with no caller. Not C2's to wire, but anyone planning "the lab request flow" should know the artifact already exists and only needs a link.

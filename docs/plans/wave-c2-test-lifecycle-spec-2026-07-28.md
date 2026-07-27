# Wave C2 Execution Specification — the test lifecycle: sample → lab → certificate → verify

**Date:** 28 July 2026 · **Rev 1** · **Status:** implementation-ready pending Jay's **J1–J6** (§13.1). No phase starts until **J1** is answered — it decides the data model.
**Program contract:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` §3 Wave C, line 76 (C2. Sample lifecycle) and §7 line 134 (threat-model gate).
**Parent spec:** `docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md` (Rev 2.2). C2 is named there as a non-goal of C1 (§1 line 125) and as the owner of two deferred limbs (§1 line 126, §7.2 line 928). **C1 counts `TestResult` rows that already exist; C2 makes the path to "verified" managed rather than assumed. C2 extends C1; no parallel engine.**
**Sibling specs read, not remembered:** `docs/plans/d14-q6-pack-spec-2026-07-27.md` (Rev 2), `docs/plans/test-type-canonicalization-spec-2026-07-27.md` (F1), `docs/plans/wave-b-migration-importer-spec-2026-07-26.md` (the test-register importer parked on this spec's §3 answer).
**Research register:**

| Report | Supplies | Grade |
| --- | --- | --- |
| `docs/research/c1-mdd-exclusion-research-2026-07-27.md` `## Nuance that affects the engine` items 1–5 | MDD as a **per-SITE paired requirement type**; RC 500.05 §7 assigned-value decay on rework; the conditional small-areas exemption | **A** |
| `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md` §A line 28 | The **only** C2-assigned evidence row: PDF certificates, 1–5 business-day turnaround, **no universal lab API** | **B**, self-caveated |
| `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md` §A line 27 | TfNSW *LIMS Data Submission Requirements — Specified Tabulated Format* (2023) | **A**, assigned to **C3**, never read by any CIVOS pass |

**All `file:line` citations were read in this worktree at HEAD `bb28c44b50733dd0ab0b2fd64b7ef95e775b8a7b` (= `origin/master`, `feat(offline): sync centre Phase 2 (#1623)`).** Every line number below was opened, not remembered. Three citations carried in from sibling specs were found stale and are corrected in §15 rather than repeated.

**House style** matches the C1 and D14 specs: numbered sections, a decision register split into Jay's calls and the spec's own, named acceptance tests continuing the shared series, per-phase rollback, an exit gate.

**Tag namespace.** `[C2L-*]` (C2 **L**ifecycle) for this spec's own tags, `[C2L-B*]` for blockers it must not violate. `[C1C-*]`, `[C1R-*]`, `[D14R-*]`, `[D14X-*]` and `[F1C-*]` are taken. Plain `C2` is **already an unrelated change-request ID** (`docs/change-requests.md:24`, partial claiming) and a SA DIT spec-number fragment (`RD-EW-C2` and siblings throughout `docs/research/sa-dit-*.md`) — never use a bare `C2` tag.

**Ponytail note, stated up front because it is the whole spec.** The lifecycle the program asks for is **already in the tree, minus two facts and one wire**. `TestResult` carries `sampleDate`, `sampleLocation` and `testRequestNumber` (`schema.prisma:863-867`) and a five-state machine that already names `at_lab` (`statusWorkflow.ts:27-33`). Certificate upload, AI extraction, mapping and human confirmation all ship and work (§2.4). Sufficiency recalculation is already automatic and needs **zero** C2 code (§2.6). What is missing is that nothing records **when** a test went to the lab, nothing records **when it is due back**, and a certificate cannot land on the row that was already waiting for it. C2 v1 is **two nullable columns and one route wiring**. Everything else the program line names is either already built, owned by another wave, or gated on an artifact that does not exist. §1.2 says so item by item.

---

## 0. What this slice is, and what it deliberately is not

### 0.1 The one-paragraph version

A quality manager can already create a planned test, print a request form, click it through to *At Lab*, upload the certificate, have AI extract it, confirm the extraction, and verify it. Every one of those steps ships today. But the moment the test leaves for the lab, CIVOS forgets: it cannot say how long the test has been out, cannot say whether it is late, and when the certificate arrives it creates a **second** row rather than completing the first — which C1 then counts twice (`wave-c1-test-sufficiency-spec-2026-07-26.md:926`). C2 v1 stamps the lab hand-off, records an optional expected-return date, and lets an uploaded certificate complete the row that was already waiting for it. Verification is untouched. Counting is untouched.

### 0.2 The scope cut, stated honestly

The program's C2 line (line 76) names nine states and three capabilities. **v1 builds two facts and one wire.** The gap between the program line and this spec is not an oversight — §1.2 disposes of every clause of line 76 with a reason and, where deferred, a named condition that would un-defer it. Three of the nine "states" already exist as `TestResult.status` values; one ("sufficiency recalc") requires no code at all; one ("external lab upload link") is the single reason §7 line 134 gates this wave on a threat model that has not been written.

### 0.3 Amendment tags introduced here

| Tag | Amendment |
| --- | --- |
| `[C2L-1]` | The C1 spec's §7.2 line 927 cites `TestResult.sampleLocation` at `schema.prisma:836`. At `bb28c44b` the field is at **`schema.prisma:867`**. The claim (free text) is still true; the line number is stale by 31. §15. |
| `[C2L-2]` | `predicates.ts:176` cites the reject columns at `schema.prisma:846-853`. At `bb28c44b` they are at **`schema.prisma:882-884`**. Claim true, citation stale. §15. |
| `[C2L-3]` | The C1 spec's §16.1 line 1316 recommends building the compaction-band field "in C2 alongside the sample lifecycle". **Superseded** — D14 shipped it on `Lot.testScale` (`d14-q6-pack-spec-2026-07-27.md` §3.2, decision D14a). C2 must not re-litigate it. |
| `[C2L-4]` | Wave B's `ImportBatch.kind` reservation of `'test_register'` (`wave-b-migration-importer-spec-2026-07-26.md:371`) is parked on "the Wave C sample/test model is final". **§3's answer to J1 IS that model.** Whichever way J1 resolves, it must be recorded as final, or Wave B stays parked on a question nobody is asking again. |
| `[C2L-5]` | The C1 spec's §5.3 line 800 cites `getClaimBlockingReasonsForConformedLot` at `conformancePrerequisites.ts:166-207`. At `bb28c44b` the function spans **`conformancePrerequisites.ts:192-233`**. The prohibition `[C1R-B2]` is unaffected; the citation is stale by 26 lines. §15. |

---

## 1. Outcome, scope and non-goals

### 1.1 Outcome

A test that has left for the laboratory is visible as such, with an elapsed time that is a fact and a lateness judgement that exists only when a human supplied the date it is judged against. A certificate arriving for a planned test completes that test rather than duplicating it.

**One-sentence success test:** on a real project, a QM can answer "what am I waiting on from the lab, and how long has it been out?" without opening a spreadsheet — and when the PDF lands, the register shows one row, not two.

### 1.2 Every clause of program line 76, disposed of

The program line reads: *"planned samples → request → sampled → lab pending → certificate received → AI extraction → human verification → sufficiency recalc; certificate-to-sample reconciliation; overdue-lab chasing; external lab upload link. **Threat model before build** (file upload surface)."*

| Clause | Disposition | Evidence |
| --- | --- | --- |
| **planned samples** | **ALREADY SHIPS.** `POST /api/test-results` creates a row; `TestResult.status` defaults to `"requested"` (`schema.prisma:877`). A planned sample is a `requested` row. No build. | `crudRoutes.ts:91`, `schema.prisma:877` |
| **request** | **ALREADY SHIPS, partially.** `GET /api/test-results/:id/request-form?format=html\|json` renders a printable, hand-signable *TEST REQUEST FORM* (`requestFormPresentation.ts:34-325`). **Gap:** it records nothing — no issue timestamp, no recipient, and the TRF number is computed at render time from a UUID prefix and never written back (`requestFormPresentation.ts:45-46`). C2.1 stamps the hand-off; it does **not** rebuild the form. | §2.5 |
| **sampled** | **NOT A STATE — it is a date, and the column exists.** `TestResult.sampleDate` (`schema.prisma:866`). Adding a `sampled` status would be a sixth string for a fact a nullable date already carries. **Rejected**, §13.2 `[C2L-b]`. | `schema.prisma:866` |
| **lab pending** | **STATE EXISTS, FACT DOES NOT.** `at_lab` is a legal status (`statusWorkflow.ts:29`) and is already whitelisted as pending (`testResultStatus.ts:5`). Nothing records **when** it entered that state. **This is C2.1.** | §3.1 |
| **certificate received** | **ALREADY SHIPS.** `results_received` (`statusWorkflow.ts:30`), written by the extraction path (`testResultMapping.ts:77`). No build. | §2.4 |
| **AI extraction** | **ALREADY SHIPS.** Anthropic Messages API, `certificateExtraction.ts:182-247`. No build. C2.2 **reuses this exact function** — it does not fork it. | §2.4 |
| **human verification** | **ALREADY SHIPS AND DOES NOT CHANGE.** `TEST_VERIFIERS = ['owner','admin','project_manager','quality_manager']` (`accessControl.ts:41`). **The QM stays the verifier. C2 changes no role, no gate, no verification field.** | `workflowRoutes.ts:149-233` |
| **sufficiency recalc** | **NOTHING TO BUILD — it is already synchronous and uncached.** `evaluateSufficiency` is a pure function called inside every readiness read (`conformancePrerequisites.ts:575-583`). There is no cached sufficiency, no materialized count, no recalc job. **NOT FOUND:** any stored sufficiency result outside the immutable decision snapshot. A lifecycle change is therefore reflected on the next read, for free. | §2.6 |
| **certificate-to-sample reconciliation** | **THE ONE REAL BUILD BESIDES THE COLUMNS — as a human-chosen attach, not a matcher.** C2.2, §3.2. | §3.2 |
| **overdue-lab chasing** | **PARTIALLY BUILT, DELIBERATELY.** Elapsed days ships (a fact). "Overdue" ships **only** where a human entered an expected date. **CIVOS invents no SLA** — the sole turnaround evidence is grade **B** and self-caveats *"two labs ≠ the industry — treat as directional"* (appendix §A line 28). §3.3, J5. | §3.3 |
| **external lab upload link** | **DEFERRED FROM v1. This is the biggest cut and the most defensible one.** It is an unauthenticated external write surface, and it is precisely why program §7 line 134 gates C2 on *"threat model as a gated artifact before A3, C2, D2, E"*. **NOT FOUND:** any threat-model artifact in `docs/`. Building it without one violates the program's own gate. §13.1 J4. | §7.3 |
| **threat model before build** | **SATISFIED FOR v1 BY SCOPE, NOT BY AN ARTIFACT.** v1 adds **no new upload surface** — C2.2 reuses the shipped, authenticated multer path (`certificateStorage.ts:51-62`) with its existing 10 MB cap, mimetype allowlist and magic-byte re-check. §7 states this as a delta review, and §7.3 records that the artifact becomes a hard precondition the moment J4 flips. | §7 |

### 1.3 Non-goals (explicit — do not build in C2 v1)

- **A `Sample` entity, a `TestRequest` entity, or a `Laboratory` entity.** §3.4 argues this at length; §13.1 J1 is Jay's call. **NOT FOUND** in the schema today: `Sample`, `TestRequest`, `TestSpecification`, `Laboratory`, `TestCertificate` — confirmed absent, not merely unlocated.
- **Any change to count semantics.** `[C2L-B1]`, §5.1. No edit to `counts.ts`, `evaluate.ts`, `predicates.ts`, `testCategories.ts` or `regime.ts`. A lifecycle state is not a count.
- **Any change to decision snapshots.** `[C2L-B2]`, §5.2. `RequirementEvaluation` rows are immutable by schema contract (`schema.prisma:1715-1717`); C2 emits no new snapshot key and does not bump `resultSchemaVersion`.
- **A parallel engine.** `[C2L-B3]`. C1's evaluator stays the only sufficiency evaluator, and it stays pure and synchronous — the C1 spec §2.2 line 162 explains why making it async destroys the batch path's constant-query guarantee and puts a history read inside the serializable transaction.
- **LIMS, in any form — including "format-compatible" ingestion.** `[C2L-B4]`, §5.4. The task framing distinguishes format compatibility from live integration; **v1 forbids both**, because the distinction presumes the format is known and it is not. **NOT FOUND:** `LIMS` or `tabulated` anywhere in `docs/research/`. No CIVOS pass has ever read the 2023 TfNSW submission spec. It is also assigned to **C3**, not C2 (program line 77; appendix §A line 27, "decision supported: C3 lab ingestion format").
- **New `TestResult.status` values.** `[C2L-B5]`, §3.5. The five shipped states are enough; a sixth is a migration of every consuming predicate for no new information.
- **Per-production-day frequency limbs**, though C2 formally owns them per `[C1R-4]`. §13.2 `[C2L-f]` defers with a named condition: no shipped pack declares a per-day limb (D14 §5.4.2 recorded Q6's shift limb rather than encoding it), so building the record before a rule needs it is speculative.
- **An MDD "requirement type", or any per-site paired requirement.** §5.3. This is the most tempting over-build in the wave and the one most likely to produce a confident wrong number.
- **Lab accreditation / NATA metadata, chain-of-custody, duplicate certificate/sample detection, preliminary-vs-final, anomaly flags.** All **C4** by the program (line 78). C2 owns the record they will attach to; it does not build them.
- **Survey and material traceability.** **C5** (line 79).
- **The test-register importer.** Wave **B** owns it; C2's §3 answer unblocks it (`[C2L-4]`) but C2 does not build it.
- **New alert types.** Consistent with the C1 spec §1 non-goal — the overdue signal surfaces in existing readiness/work surfaces, not as a new stream into the A2 backlog.
- **No shell changes.** No file under `frontend/src/shell/` changes.

---

## 2. Current-state map (read at `bb28c44b`)

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

**Consequence C2 must respect `[C2L-B6]`:** a test can reach `verified` having never been recorded as sent to a lab. C2 must not make `at_lab` mandatory — a field density test read on site the same day legitimately never goes to a lab, and the appendix's own evidence row says field density is *"same/next day"* while lab classification is *"2–5 business days"*. §3.1 therefore stamps `at_lab` when it happens and never requires it.

### 2.2 The row itself

`backend/prisma/schema.prisma:857-905`. The fields C2 cares about:

| Line | Field | Note |
| --- | --- | --- |
| 863 | `testRequestNumber String?` | **Never written by any code path.** The request form derives a display number instead (§2.5). |
| 864 | `laboratoryName String?` | Free text. There is no `Laboratory` model. |
| 866 | `sampleDate DateTime?` | The "sampled" fact, already present. |
| 867 | `sampleLocation String?` | Free text `[C2L-1]`. C1 §7.2 relies on this being free text; C2 does not change it. |
| 875 | `passFail String @default("pending")` | |
| 877 | `status String @default("requested")` | **A planned sample is the default state of a new row.** |
| 878-881 | `enteredById/At`, `verifiedById/At` | The two transitions that **are** stamped. |
| 882-884 | `rejectedById/At`, `rejectionReason` | `[C2L-2]` |
| 885-886 | `aiExtracted`, `aiConfidence` | |

Indexes at `:899-903`: `projectId`, `(projectId, status)`, `lotId`, `(projectId, passFail)`, `(enteredById, createdAt)`. **`(projectId, status)` at `:900` is the index the overdue list rides — C2 adds no index.**

**Zero `enum` blocks exist in the entire schema.** Every status is an unconstrained `String` with app-side enforcement only (`statusWorkflow.ts:36-42`). C2 does not change that — introducing an enum here would be a migration across every status-bearing model for no C2 benefit.

### 2.3 What stamps what today

`workflowRoutes.ts`:

- `POST /:id/status` — handler at `:240`. Validity against `STATUS_LABELS` `:247`; `verified` requires `TEST_VERIFIERS` `:265-267`, everything else `TEST_CREATORS` `:270-272`; transition check `:276-289`; certificate gate `:292-298`; `RESULT_REQUIRED` gate `:303-305`. **Stamps `enteredById/enteredAt` at `:311-314` and `verifiedById/verifiedAt` at `:317-320` — and nothing else.** Audit `TEST_RESULT_STATUS_CHANGED` at `:427-432`.
- `POST /:id/verify` — `:149`, `TEST_VERIFIERS` `:163-168`, writes `status/verifiedById/verifiedAt` `:203-209`, audit `:225-233`.
- `POST /:id/reject` — `:56`, `TEST_VERIFIERS` `:80-85`, only from `entered` `:88-92`, resets to `results_received` and **nulls** all four stamp columns `:95-108`.

**The load-bearing observation for §3.1:** `TEST_RESULT_STATUS_CHANGED` is already audited at `:427-432` with `changes: { status, previousStatus }`. **The moment a test entered `at_lab` is therefore already a recorded fact — it is simply not queryable.** `AuditLog.changes` is a JSON column with no index supporting "every test currently at lab, ordered by how long". So the C2.1 column is a **materialization of an existing audited fact**, not a new fact — which is also why it is backfillable (§4.2) and why losing it is recoverable (§10).

### 2.4 The certificate path that already ships

Route entry points in `backend/src/routes/testResults.ts`: `POST /upload-certificate` `:185`, `POST /:id/certificate` `:214`, `GET /:id/extraction` `:250`, `PATCH /:id/confirm-extraction` `:281`, `POST /batch-upload` `:307`, `POST /batch-confirm` `:331`.

The flow, cited:

1. **Upload** — multer configured once at module load, `certificateStorage.ts:51-62`: memory storage when Supabase is configured else disk (`:52`), **10 MB cap** (`:53`), mimetype allowlist `pdf/jpeg/png/jpg` (`:55`). Magic-byte re-check `assertUploadedFileMatchesDeclaredType`, `certificateIntake.ts:132`.
2. **Extraction** — `certificateExtraction.ts:182-247`. Anthropic Messages API by raw `fetch` (`:191`), model from `ANTHROPIC_TEST_CERT_MODEL || ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022'` (`:200-203`), inline prompt template at `:212-226` (**NOT FOUND:** a separate prompt asset file), 120 s timeout (`:85`, applied `:233`). Ten fields with per-field confidence (`:22-33`). On any failure it degrades to `createManualReviewExtraction` (`:243-246`) which guesses from the filename (`:44-60`).
3. **Storage** — Supabase at `certificates/<projectId>/cert-<ts>-<uuid><ext>` (`certificateStorage.ts:73-95`), else local. Cleanup on every failure branch (`certificateIntake.ts:119,127,135,151,185`).
4. **Write** — one transaction, `certificateIntake.ts:157-183`: `Document` (`documentType:'test_certificate'`) then `tx.testResult.create`. Shaping in `testResultMapping.ts:51-79`, with **`status: 'results_received'` at `:77`**.
5. **Confirm** — `extractionConfirmation.ts:167-237`; forces `status='entered'` plus `enteredById/At` (`:104-115`); rejects an already-`verified` row with 409 (`:183-188`); validates corrected `lotId` and `itpChecklistItemId` against the effective lot (`:117-153`).

**The gap C2.2 closes, stated precisely.** `POST /upload-certificate` **creates** a new `TestResult` (`certificateIntake.ts:171`). `POST /:id/certificate` attaches to an existing row but **runs no extraction at all** and deliberately leaves `status` and `aiExtracted` untouched (`certificateAttachment.ts:45-47`). So there is no path from "a planned test is waiting" to "its certificate arrived and was read". A user with a planned `requested` row who uploads its certificate gets **two rows for one sample** — and C1 counts distinct rows, which it names as a known ceiling at `wave-c1-test-sufficiency-spec-2026-07-26.md:926`.

### 2.5 The request form is a print artifact, not a record

`requestFormPresentation.ts`: `renderTestRequestFormHtml` `:34-325`, a self-contained HTML page with a `window.print()` button `:166`, titled *TEST REQUEST FORM* `:177`, ending in two blank ink-signature lines — "Contractor Signature / Date" and "Laboratory Receipt / Date" `:291-317`. Laboratory falls back to the literal `'(To be assigned)'` `:259` and Priority is hardcoded `Standard` `:263`. The request number is derived and discarded:

```ts
const requestNumber =
  testResult.testRequestNumber || 'TRF-' + testResult.id.substring(0, 8).toUpperCase();
```
`requestFormPresentation.ts:45-46`.

**It transmits nothing, records nothing, and has no state.** Nothing connects rendering it to the `at_lab` transition. C2 v1 does not rebuild it — §13.2 `[C2L-c]` records why writing back the TRF number is a worse idea than it looks.

### 2.6 "Laboratory" today, and why no entity is needed for v1

`laboratoryResponses.ts` is five lines. A "laboratory" is a distinct string harvested from historical `TestResult.laboratoryName` for autocomplete, via `GET /api/test-results/laboratories` (`listRoutes.ts:30-121`, `groupBy` at `:105-117`, `take: 20`). There is no lab record, no contact, no accreditation, no lab login. **This is sufficient for v1** — v1 never contacts a lab, so it needs no lab identity. It becomes insufficient the moment J4 flips (an external upload link needs a party to authenticate) or C4 starts (accreditation metadata needs a subject).

### 2.7 How C1 consumes tests — the invariant C2 must not disturb

The engine lives at `backend/src/lib/readiness/sufficiency/`. It reads exactly five `TestResult` fields, selected at `conformancePrerequisites.ts:408-416`:

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

`PENDING_TEST_RESULT_STATUSES` (`testResultStatus.ts:1-8`) is `{pending, submitted, requested, at_lab, results_received, entered}` — **`at_lab` is already a recognised pending status.** This is why C2.1 changes no counting: the state it stamps is already classified, and the two new columns are not in the select list at `:408-416`.

---

## 3. The design

### 3.1 C2.1 — two nullable columns on `TestResult`, and one stamp

```prisma
sentToLabAt        DateTime? @map("sent_to_lab_at")
expectedResultDate DateTime? @map("expected_result_date")
```

- **`sentToLabAt`** — system-stamped in the `POST /:id/status` handler when the transition target is `at_lab`, exactly mirroring the shipped `enteredAt`/`verifiedAt` stamping at `workflowRoutes.ts:311-320`. Never user-editable. Idempotent: re-entering `at_lab` does not re-stamp (the transition map forbids `at_lab → at_lab` anyway, `statusWorkflow.ts:29`, but the guard is written rather than assumed).
- **`expectedResultDate`** — user-supplied, optional, editable through the existing `PATCH /:id` correction path. **CIVOS never defaults it.** Blank is the normal case and blank is honest.

**Why two columns and not one.** They answer different questions and one cannot be derived from the other. `sentToLabAt` answers *"how long has this been out"* — a fact, always displayable. `expectedResultDate` answers *"is it late"* — a judgement that only exists if a human supplied the yardstick. Collapsing them means either inventing an SLA (forbidden, §3.3) or losing the elapsed-time fact.

**Why not zero columns.** The fact is already audited (`workflowRoutes.ts:427-432`, §2.3) — but `AuditLog.changes` is an unindexed JSON column, and "every test at lab, ordered by elapsed time, per project" over JSON on the readiness path is exactly the query shape §9 exists to prevent. The column is a materialization, and §4.2 backfills it from the audit log so no history is lost.

**Why not a status change.** `[C2L-B5]`. Every one of the six consumers of `PENDING_TEST_RESULT_STATUSES` would need to learn a new string for information a nullable date already carries.

### 3.2 C2.2 — the certificate lands on the row that was waiting

Extend the **shipped** `POST /api/test-results/:id/certificate` (`testResults.ts:214`, handler `certificateAttachment.ts:48-182`) with an opt-in `extract=true` behaviour:

1. Reuse `extractCertificateFields` (`certificateExtraction.ts:182`) **unmodified** — same model, same prompt, same timeout, same silent-degradation fallback.
2. Write the extracted values onto the **existing** row via the existing mapper. `buildTestResultData` (`testResultMapping.ts:51-79`) currently returns a **create** input; C2.2 factors the field-shaping half into a shape both paths use. **This is an extraction, not a fork** — the create path must call the same helper afterwards, and AT-68 asserts the create path's output is byte-identical.
3. Move the row to `results_received`, set `aiExtracted=true` and `aiConfidence`, exactly as the create path does at `testResultMapping.ts:75-77`.
4. Everything downstream is unchanged: `GET /:id/extraction`, `PATCH /:id/confirm-extraction` (`extractionConfirmation.ts:167`), `POST /:id/verify`.

**Do not overwrite what a human already typed `[C2L-B7]`.** A planned row often carries a hand-entered `sampleDate`, `sampleLocation` and `laboratoryName`. Extraction onto an existing row fills **only fields that are currently null**, except `resultValue`/`resultUnit`/`specificationMin`/`specificationMax`/`passFail`, which are the certificate's to state and which the human then confirms or corrects through the shipped confirmation path. AT-66 asserts this field by field.

**What C2.2 is explicitly not: a matcher.** There is no fuzzy certificate→sample reconciliation, no candidate scoring, no auto-attach. **The human picks the row.** An algorithm that guesses which planned sample a PDF belongs to is a confident-wrong-answer surface, and duplicate detection is C4's by the program (line 78). The reconciliation the program asks for is achieved by making the correct action *possible*, not by guessing it.

**Preserve the 409 `[C2L-B8]`.** `certificateAttachment.ts:82-88` already refuses to touch a `verified` row. The extract path keeps that guard and adds one: it refuses on `entered` too, because moving a confirmed row back to `results_received` would silently un-do a human's confirmation.

### 3.3 C2.3 — the overdue signal, and the SLA CIVOS must not invent

Two derived values, computed at read time, stored nowhere:

- **Elapsed** — `now − sentToLabAt`, rendered as "at lab 4 days". A **fact**. Shown whenever `sentToLabAt` is set.
- **Overdue** — `status === 'at_lab' && expectedResultDate != null && expectedResultDate < today`. A **judgement**, shown only where a human supplied the date.

**Why no default turnaround `[C2L-B9]`.** The sole evidence is appendix §A line 28, grade **B**, sourced from two lab marketing pages, and it caveats itself: *"Turnarounds are advertised, not SLAs; two labs ≠ the industry — treat as directional."* A CIVOS-computed "overdue" built on that would be a compliance-flavoured judgement resting on two web pages. The same doc is the reason the pre-cover gate has value — the 1–5-day window is real enough to *plan* around and not real enough to *judge* by.

Surfacing reuses what exists. The A4 *Needs Attention* mockup already renders exactly this item shape — `"CBR / Modified Proctor — LOT-0142, sample lodged 2 Jul"` (`docs/plans/a4-mockups/01-needs-attention.html:367`). C2.3 feeds that card; it does not design a new one, and it adds **no new alert type**.

### 3.4 The entity question — why `TestResult` *is* the sample record

The task asks for the argument. Here it is, and §13.1 J1 is Jay's call.

**The case for a `Sample` entity:** one physical sample can yield several tests (a single bag → grading, PI, MDD), so a 1:N `Sample → TestResult` is the domain-true shape, and C4's chain-of-custody and duplicate-sample detection both attach naturally to a sample rather than a result.

**Why v1 rejects it anyway — five reasons, in order of weight:**

1. **The 1:N is real but not yet *load-bearing*.** Nothing in v1's outcome needs it. Elapsed-at-lab, expected-return and certificate-attach are all per-**test** facts. Building the parent to serve a child requirement that arrives in C4 is scaffolding for later, and later can scaffold for itself.
2. **It would force new count semantics — which are forbidden.** Sufficiency counts distinct `TestResult` rows attributed to a rule (`evaluate.ts:302-312`). Introduce a sample parent and the immediate question is whether N tests off one sample count as N or as 1. That is precisely the "duplicate/re-test inflation" ceiling C1 assigned to **C4** (`wave-c1-test-sufficiency-spec-2026-07-26.md:926`), and answering it in C2 would breach `[C2L-B1]`.
3. **Migration cost against zero user-visible gain.** Every existing `TestResult` needs a synthesized parent, and `CONFORMANCE_LOT_SELECT` (`conformancePrerequisites.ts:408-416`), the regime stream select (`prismaStream.ts:38-52`), all 21 routes and three role-gate helpers grow a join. §9's budgets and C1's constant-query guarantee both come under pressure for a feature nobody asked for.
4. **The columns already exist on the row.** `sampleDate` `:866`, `sampleLocation` `:867`, `testRequestNumber` `:863`. The 1:1 case — overwhelmingly the common one for compaction, the only category currently aliased (`testCategories.ts:55-102`) — is already modelled.
5. **The upgrade path stays open and cheap.** When C4 needs it, add `Sample` and a nullable `TestResult.sampleId`, backfill 1:1, and the count question gets answered by C4 where it belongs. Nothing in v1 forecloses that.

`ponytail:` `TestResult` is the sample record. Add the `Sample` parent when C4's chain-of-custody or duplicate detection needs a subject — not before.

**Whichever way J1 lands, record it as final** `[C2L-4]`, because Wave B's test-register importer has been parked on this exact question since `wave-b-migration-importer-spec-2026-07-26.md:371`.

### 3.5 What does not change

No new status values `[C2L-B5]`. No change to `VALID_STATUS_TRANSITIONS`. No change to `TEST_CREATORS`/`TEST_VERIFIERS`/`TEST_DELETERS` (`accessControl.ts:32-43`). No change to the verification route, its fields, or its audit action. No new index. No enum. No change to the request form's HTML.

---

## 4. Data model and migrations

### 4.1 The migration

```sql
ALTER TABLE "test_results" ADD COLUMN "sent_to_lab_at" TIMESTAMP(3);
ALTER TABLE "test_results" ADD COLUMN "expected_result_date" TIMESTAMP(3);
```

Two nullable columns, no default, no index, no backfill inside the migration. Additive and reversible. Placed after `verifiedAt` in `schema.prisma` (i.e. adjacent to the other lifecycle stamps at `:878-881`), so the stamp columns read as one group.

**No index is added.** The overdue query filters on `(projectId, status)` — already indexed at `schema.prisma:900` — and sorts a bounded result set in memory. AT-70 asserts the plan uses the existing index. Adding an index on a column that is NULL for the overwhelming majority of rows would be cost without benefit.

**Per CLAUDE.md operational warnings:** a reviewed Prisma migration only. Never `prisma db push`, never `--accept-data-loss`, and Railway's start/pre-deploy commands stay blank.

### 4.2 Backfill (separate from the migration)

A one-shot script, run manually after the migration, populating `sentToLabAt` from the existing `TEST_RESULT_STATUS_CHANGED` audit rows (`workflowRoutes.ts:427-432`) where `changes.status === 'at_lab'`, taking the earliest such row per test. Idempotent (`WHERE sent_to_lab_at IS NULL`), per-project, dry-run by default. **`expectedResultDate` is never backfilled** — CIVOS has no basis to invent one, which is the whole of §3.3.

Rows with no such audit entry stay NULL and render no elapsed time. That is honest, not degraded.

---

## 5. The C1 invariants C2 must not break

### 5.1 `[C2L-B1]` No new count semantics

**Zero lines change** in `backend/src/lib/readiness/sufficiency/counts.ts`, `evaluate.ts`, `testCategories.ts`, `regime.ts`, or `backend/src/lib/readiness/predicates.ts`. `at_lab` is already whitelisted pending (`testResultStatus.ts:5`); the two new columns are not in `CONFORMANCE_LOT_SELECT` (`conformancePrerequisites.ts:408-416`). A lifecycle state is not a count.

This is not merely a rule — it is enforced by the C1 spec's own single-source clause `[C1C-20]` (`wave-c1-test-sufficiency-spec-2026-07-26.md:100`): *"Any change to attribution semantics is made in the shared helper of F1 §4.4, never in `counts.ts` alone."* C2 changes attribution nowhere at all. **AT-63** proves it with a regenerated characterization corpus showing an empty diff.

### 5.2 `[C2L-B2]` No decision-snapshot change

`RequirementEvaluation` rows are immutable by schema contract — `schema.prisma:1715-1717`: *"Rows are immutable: no update/delete API… audit + snapshot are one retention unit."* C2 emits **no** new snapshot key, does **not** bump `resultSchemaVersion`, and does **not** touch `sufficiency/snapshot.ts`. `[C1R-B3]` (`snapshot.ts:3-12`) makes the absence of the `sufficiency` key the pre-C1 discriminator; adding a C2 key would corrupt that discriminator for no gain. **AT-64.**

### 5.3 `[C2L-B10]` MDD stays excluded, and C2 does not build a requirement type

The temptation is direct: the research says MDD is *"a distinct requirement **type**, and it is **per site, not per lot**"* (`c1-mdd-exclusion-research-2026-07-27.md` `## Nuance that affects the engine` item 1), and C2 is the wave that models sites and samples. **v1 builds none of it.** Four reasons:

1. **It is a new requirement type, therefore new count semantics** — barred by `[C2L-B1]` and by the task framing.
2. **The prerequisite does not exist.** A per-site requirement needs a site identity. `TestResult.sampleLocation` is free text (`schema.prisma:867`) and C1 §7.2 line 927 already names this as the reason spatial claims are C3's.
3. **A boolean cannot decay.** The obvious shortcut — an "MDD assigned" flag — is affirmatively wrong. RC 500.05 §7: assigned values *"shall be checked in accordance with that method if material has been reworked"*, and the research concludes *"If the engine ever tracks assigned-value validity, it needs a staleness trigger, not a permanent pass"* (item 4). A flag that never expires converts a conditional exemption into a permanent one — a confident wrong compliance answer, which is the exact failure Wave C exists to prevent.
4. **The exemption is conditional in the first place** (item 3): the single-reference shortcut applies only *"For small areas of work… when so permitted by the specification"*. Modelling it as universally available would be wrong on the primary source.

**Hard handoff, inherited from `[F1C-R8]`** (`test-type-canonicalization-spec-2026-07-27.md:738`): **no C2 PR may add a maximum-dry-density method code to `TEST_TYPE_ALIASES`.** Lab references go in `LAB_REFERENCE_TOKENS` (`testCategories.ts:111-124`) or nowhere. Silently reversing J2's exclusion from a sibling PR is the named risk. **AT-65** re-proves the exclusion after C2 ships: six verified `MDD Standard` tests linked to a compaction item still read **0 of 6** (the shipped assertion is AT-30/AT-57 in `testCategoriesEngine.db.test.ts:251`).

### 5.4 `[C2L-B4]` No LIMS, in any form

Not live integration, and not "format-compatible ingestion" either. The distinction presupposes the format is known; it is not. **NOT FOUND:** any occurrence of `LIMS` or `tabulated` in `docs/research/`. The grade-A source (appendix §A line 27) is a 2023 TfNSW PDF with the caveat *"Confirm currency at C3 start"*, and the register assigns it to **C3**. The first PR in any wave that touches LIMS reads that document first and records a research pass; until then, shipping a parser for a format nobody has read is fabrication.

### 5.5 `[C2L-B3]` No parallel engine, and the evaluator stays pure

`evaluateSufficiency` remains pure and synchronous, called from `conformancePrerequisites.ts:575-583`. C2 adds no second evaluator, no cached count, no recalculation job, and no async call inside the gate. The C1 spec §2.2 line 162 states the cost of breaking this: it destroys the batch path's constant-query guarantee and puts a history read inside the serializable transaction (`[C1R-B7]`).

### 5.6 `[C2L-B11]` Sufficiency still never blocks a claim

C1's hard prohibition `[C1R-B2]` (§5.3 line 800) keeps sufficiency out of `getClaimBlockingReasonsForConformedLot` (`conformancePrerequisites.ts:192-233` `[C2L-5]`). **A lifecycle state must not enter it either** — an "at lab" or "overdue" test making a conformed lot un-claimable would be the same failure by a different door. AT-11's byte-identical assertion must still pass unchanged. **AT-71.**

---

## 6. API and UI surface

### 6.1 Backend

| Change | Route | Note |
| --- | --- | --- |
| Stamp `sentToLabAt` | `POST /api/test-results/:id/status` (`workflowRoutes.ts:240`) | Additive; mirrors `:311-320`. No role change. |
| Accept `expectedResultDate` | `POST /api/test-results` (`crudRoutes.ts:91`), `PATCH /:id` (`crudRoutes.ts:226`) | Optional, nullable, date-normalised through the shipped `validation.ts` helpers. Treated as **metadata**, so per `crudRoutes.ts:344-351` editing it does **not** un-verify a verified row. |
| Both fields in responses | `listResponses.ts`, `detailResponses.ts` | Additive keys only. |
| `?atLab=true` filter | `GET /api/test-results` (`listRoutes.ts:124`) | Rides the existing `(projectId, status)` index (`schema.prisma:900`). |
| `extract=true` | `POST /api/test-results/:id/certificate` (`testResults.ts:214`) | §3.2. Default `false` — **the shipped behaviour is unchanged unless asked for.** |

**No new endpoint.** **No new role.** **No change to `TEST_VERIFIERS`.**

### 6.2 Frontend

- The at-lab elapsed/overdue chip on the existing test register row and the A4 *Needs Attention* card shape (`docs/plans/a4-mockups/01-needs-attention.html:367`).
- An optional *Expected result date* input in the existing "Add lab & sample details" collapsible that `docs/plans/test-workflow-simplification-plan-2026-07-06.md:96-97` already specifies and ships.
- An *Extract from certificate* affordance on the existing attach control.

Status labels must come from the shared helper (`frontend/src/lib/statusLabels.ts`) — no inline status strings. Uniform card rules apply: icon + label + chip + chevron, no subtitles.

---

## 7. Security, tenancy and privacy

### 7.1 Tenancy

Both new columns live on `TestResult`, which is already project-scoped (`projectId`, `schema.prisma:859`) and cascade-deleted with the project (`:890`). Every read path continues through the shipped guards: `requireProjectReadAccess` (`accessControl.ts:92`), `requireTestResultReadAccess` (`:175-186`), `getReadableProjectIds` (`:56-90`), and `requireTestResultsPortalAccess` (`:103`) for the subcontractor module gate. The `?atLab=true` filter is applied **after** the tenant scope, never instead of it. Subcontractor lot scoping (`getAssignedSubcontractorLotIds`, `:112-160`) is unchanged. **AT-69** asserts a cross-tenant `atLab` query returns nothing.

### 7.2 The upload surface — a delta review, not a new threat model

C2.2 adds **no new upload surface**. It reuses the shipped, authenticated multer instance (`certificateStorage.ts:51-62`) with its 10 MB cap (`:53`), mimetype allowlist (`:55`) and magic-byte re-check (`certificateIntake.ts:132`), and it reuses the shipped Supabase path construction (`:73-95`) with its existing per-project prefix. The delta is therefore: *the same authenticated user, uploading the same validated file, to the same bucket path, writing to an existing row instead of a new one.* Authorization is the existing `TEST_CREATORS` check, plus the new `entered`/`verified` 409 guard `[C2L-B8]`.

### 7.3 The threat-model gate `[C2L-B12]`

Program §7 line 134 gates C2 on *"threat model as a gated artifact before A3, C2, D2, E (offline device storage; lab/file upload; asset import; external links)."* **NOT FOUND:** any threat-model artifact under `docs/`.

The gate is satisfied for v1 **by scope**: v1 builds no external link and no unauthenticated surface, and §7.2 is the review. **It is not satisfied in general.** The moment J4 flips and an external lab upload link is built, the threat-model artifact becomes a hard precondition — a PR, not a paragraph. This is recorded in the exit gate as item 9 and in §13.1 J4.

### 7.4 Data sensitivity

Neither column carries personal data. `sentToLabAt` is system-generated; `expectedResultDate` is a user-entered business date. No secret, no credential, no new external egress. The AI call is the shipped one — no new provider, no new key, no change to what is sent.

---

## 8. Phases and PR slicing

Each phase is independently shippable, independently revertible, and PR-sized. **Phases run in order; each has zero behaviour change beyond its own stated delta.**

### C2.1 — the two columns and the stamp (S)

- **Depends on:** J1 resolved (§13.1). Nothing else.
- Migration §4.1; `schema.prisma` fields; stamp in `workflowRoutes.ts` beside `:311-320`; accept `expectedResultDate` on create/patch; both fields in list and detail responses.
- Backfill script §4.2, shipped **in this PR** but run manually, dry-run by default.
- **Zero behaviour change by construction:** no read path consumes either column yet; `CONFORMANCE_LOT_SELECT` is untouched; no status, role or transition changes.
- **Exit:** AT-63, AT-64, AT-67, AT-72.

### C2.2 — extraction onto an existing row (M)

- **Depends on:** C2.1 merged (not strictly — but shipping the attach before the stamp leaves the register half-lifecycled; sequence it).
- Factor the field-shaping half of `buildTestResultData` (`testResultMapping.ts:51-79`) into a helper both paths call; add `extract=true` to `POST /:id/certificate`; null-only merge `[C2L-B7]`; extend the 409 guard to `entered` `[C2L-B8]`.
- **Zero behaviour change by construction:** `extract` defaults to `false`; the create path calls the same helper and AT-68 asserts its output is byte-identical to today's.
- **Exit:** AT-66, AT-68, AT-73.

### C2.3 — surfacing, and the notification honesty fix (S)

- **Depends on:** C2.1 merged. J2 for the second half.
- `?atLab=true` filter; elapsed/overdue chip; A4 card feed; the *Expected result date* input.
- **If J2 = yes:** fix the reject notification. `workflowRoutes.ts:131` builds `engineerNotified` and the handler returns at `:144` having **never created a `Notification` row and never sent an email**, while `verificationResponses.ts:26-38` reports `notification.sent: true`. The shipped `results_received` notification block (`workflowRoutes.ts:347-423`) is the pattern to route through — one path, not two.
- **Exit:** AT-69, AT-70, AT-71, and AT-74 if J2 = yes.

### C2.4 — external lab upload link — **DEFERRED, specified nowhere**

Not designed in this document. It does not start until the §7.3 threat-model artifact exists **and** Jay asks (J4). Recorded so the phase can be picked up cold rather than silently forgotten.

---

## 9. Scale and performance

No new index, no new join, no new query on any readiness or claim path. The `?atLab=true` list rides `(projectId, status)` (`schema.prisma:900`).

**Budgets, inherited unchanged:** lot readiness p95 < 2,000 ms; claim create p95 < **3,000 ms** at 5,000 members (`[C1C-14]`, #1581 `0d94beba`, accepted by Jay 2026-07-27); **zero additional queries** on the conformance and claim-readiness paths; no increase in serializable-transaction retries.

**AT-72** asserts the query count on `checkConformancePrerequisites` is unchanged, because "we only added columns" is exactly the claim that stops being true when someone adds them to a select.

---

## 10. Rollback and recovery

| Phase | Rollback |
| --- | --- |
| C2.1 | Revert the code; **leave the columns**. Nullable, unread, unindexed — an orphaned nullable column costs nothing and dropping it loses the backfill. |
| C2.2 | Revert. `extract=true` is opt-in, so no shipped caller changes. Rows already extracted onto keep their values and remain correctable through the shipped `/confirm-extraction` path. |
| C2.3 | Revert the UI. The columns keep populating; only the display disappears. |

**Data-loss risk: none.** No column is dropped, no row deleted, no value overwritten (`[C2L-B7]` is null-only). `sentToLabAt` is recoverable from the audit log at any time (§4.2) because the fact was never CIVOS's to lose.

---

## 11. Acceptance tests

Continuing the shared series — C1 ended at AT-21, D14 ran to AT-55b, F1 to AT-62. **C2 starts at AT-63.** Every item is a real assertion in a real test file.

| AT | Assertion | Where |
| --- | --- | --- |
| **AT-63** | **No count changed.** Regenerated characterization corpus (`readiness/characterization/seedCorpus.ts`) produces an empty diff; `predicates.parity.test.ts` extended with the two new columns present and populated. `[C2L-B1]` | `backend/src/lib/readiness/` |
| **AT-64** | **No snapshot changed.** `RequirementEvaluation.result` is byte-identical for a lot before and after `sentToLabAt` is stamped; `resultSchemaVersion` still `1`. `[C2L-B2]` | `recordDecision.db.test.ts` |
| **AT-65** | **MDD still excluded.** Six verified `MDD Standard` tests linked to a compaction item read **0 of 6** after C2 ships; no MDD code appears in `TEST_TYPE_ALIASES`. `[C2L-B10]` `[F1C-R8]` | `testCategoriesEngine.db.test.ts` |
| **AT-66** | **Null-only merge.** Extraction onto an existing row with hand-entered `sampleDate`, `sampleLocation` and `laboratoryName` overwrites none of them, and does write `resultValue`/`resultUnit`/spec bounds/`passFail`. Field by field. `[C2L-B7]` | `certificateAttachment.test.ts` |
| **AT-67** | **The stamp.** `requested → at_lab` sets `sentToLabAt`; `requested → entered` (the legal one-hop, `statusWorkflow.ts:28`) leaves it NULL and the row still reaches `verified`. `[C2L-B6]` | `workflowRoutes` coverage |
| **AT-68** | **The create path is unchanged.** `buildTestResultData` output is byte-identical to `bb28c44b` for a fixed extraction input after the C2.2 refactor. | `testResultMapping.test.ts` |
| **AT-69** | **Tenancy.** `?atLab=true` from a user in another company returns zero rows; a subcontractor sees only assigned-lot rows. | `listRoutes` coverage |
| **AT-70** | **Overdue is only ever user-grounded.** A row at `at_lab` for 30 days with `expectedResultDate` NULL is **not** overdue and shows elapsed days; set the date in the past and it is. No default is applied anywhere. `[C2L-B9]` | new `labLifecycle.test.ts` |
| **AT-71** | **Claims still unblockable.** `getClaimBlockingReasonsForConformedLot` returns byte-identical output with a test at `at_lab`, overdue, and NULL — extending AT-11. `[C2L-B11]` | `conformancePrerequisites.test.ts` |
| **AT-72** | **Query count unchanged** on `checkConformancePrerequisites` and the claim-readiness batch. | `readiness` benchmark |
| **AT-73** | **The 409s hold.** Extract-onto refuses on `verified` (shipped, `certificateAttachment.ts:82-88`) **and** on `entered` (new). `[C2L-B8]` | `certificateAttachment.test.ts` |
| **AT-74** | **J2 only.** Rejecting a test creates a real `Notification` row and attempts the email; `notification.sent` reflects what happened. | `workflowRoutes` coverage |

**Note on coverage shape.** Every existing test under `backend/src/routes/testResults/` is a unit test over pure helpers or mocked Prisma — **NOT FOUND:** any HTTP/supertest test driving a real route handler in that directory. AT-67, AT-69, AT-73 and AT-74 are the first assertions over those handlers' behaviour and will need the handler logic reachable from a test. Where the shipped structure makes that expensive, extract the decision into a pure helper and test that — the pattern the directory already uses everywhere else.

---

## 12. Exit gate

1. **`[C2L-B1]` proven, not asserted** — AT-63's regenerated corpus diff is empty and is shown in the PR body. *No count changed* is the claim this wave lives or dies on.
2. **`[C2L-B2]` proven** — AT-64 green; `resultSchemaVersion` still `1`; `sufficiency/snapshot.ts` unmodified in the diff.
3. **`[C2L-B10]` re-proven after the fact** — AT-65 green, and the PR body states that no MDD alias was added.
4. **A real planned test round-trips on a real project:** created `requested` → *At Lab* (stamped) → certificate uploaded with `extract=true` onto **that row** → confirmed → verified by a QM — and the register shows **one row, not two**. Owner **Jay**.
5. **The overdue signal is honest on screen** — a test at lab with no expected date reads "at lab 4 days" and is **not** flagged late. AT-70 green.
6. **`git diff` touches none of** `sufficiency/counts.ts`, `evaluate.ts`, `testCategories.ts`, `regime.ts`, `predicates.ts`, `snapshot.ts`. Mechanically checkable; check it mechanically.
7. **§9 budgets met**, AT-72 green, zero additional queries.
8. **Tenancy green** — AT-69.
9. **The threat-model gate is recorded, not quietly passed** — §7.3 states in the PR body that v1 adds no new upload surface and that the artifact remains a hard precondition for C2.4. Owner **Jay** for the decision to leave C2.4 deferred.
10. **The model is declared final and Wave B is told** `[C2L-4]` — J1's answer is written into `wave-b-migration-importer-spec-2026-07-26.md:371` as a follow-up amendment, not left implicit. Otherwise the test-register importer stays parked on a question that has been answered.
11. **The `[C2L-1]`/`[C2L-2]` stale citations are filed** as an amendment against the C1 spec, not silently left stale.
12. **`npm run fallow:audit` verdict recorded in every PR body.**
13. **Docs and the Clancy knowledge mirror updated** with the two new fields and what "at lab" now means.

**Not in this gate, deliberately:** anything about enforcement. C2 turns no gate on. `testSufficiencyMode` defaults and the block-mode acceptance gate (`d14-q6-pack-spec-2026-07-27.md` §15.1) are untouched by this wave, and no C2 phase may change a project's mode.

---

## 13. Decisions

### 13.1 Open decisions for Jay — six, each with a recommendation

1. **J1 — A `Sample` entity, or the lifecycle on `TestResult`?** → **RECOMMEND: on `TestResult`.** `TestResult` already carries `sampleDate`, `sampleLocation` and `testRequestNumber` (`schema.prisma:863-867`) and a five-state machine naming `at_lab`; a `Sample` parent adds a 1:N nothing in v1 needs, forces the "do N tests off one sample count as N or 1" question that C1 assigned to **C4**, and grows a join in every shipped query and role gate. §3.4 has the full argument and the cheap upgrade path. **Binding on the build:** no phase starts until this is answered, and whichever way it lands it is recorded as the final model so Wave B's importer can un-park `[C2L-4]`.
2. **J2 — Fix the reject-notification lie in C2.3?** → **RECOMMEND: yes.** The API returns `notification.sent: true` while never creating a `Notification` row or sending an email (`workflowRoutes.ts:131` and `:144`; `verificationResponses.ts:26-38`). C2.3 adds a second notification through the same builders, so it is cheaper to fix now than to build the second one beside a broken first. Roughly a ten-line change routing through the shipped `results_received` block at `:347-423`. **One-line why:** shipping a new notification next to one that silently no-ops teaches the user not to trust either.
3. **J3 — The half-built `nataSiteNumber` field: delete it or persist it?** → **RECOMMEND: delete the input.** `CreateTestModal.tsx:407-409` registers a *NATA Site Number* form field with **no column, no route accepting it, and no backend reference anywhere** — `grep -ric nata` over `backend/src` and `backend/prisma` returns **zero** files. It is silently dropped on every submit today. This is not random dead UI: `docs/plans/test-workflow-simplification-plan-2026-07-06.md:98` specified *"lab name, NATA site, request/report numbers"* in the lab-details collapsible, and the frontend half shipped while the backend half never did. Lab accreditation metadata is **C4** by the program (line 78). **One-line why:** a field that silently discards what a QM typed is worse than no field, and C4 will want accreditation modelled against a lab identity rather than a loose string on a test row.
4. **J4 — Build the external lab upload link in v1?** → **RECOMMEND: no, defer to C2.4.** It is an unauthenticated external write surface and the single clearest reason program §7 line 134 gates this wave on a threat model — and **NOT FOUND:** any threat-model artifact in `docs/`. **Binding on the build:** if this flips, the threat-model artifact ships as its own PR **before** any code, and §7.2's delta review is not a substitute. **One-line why:** the program already decided this needs an artifact; v1 earns its scope cut by not needing one.
5. **J5 — Expected result date: user-entered, or a CIVOS default turnaround?** → **RECOMMEND: user-entered, blank shows elapsed days only.** The sole turnaround evidence is grade **B**, sourced from two lab marketing pages, and self-caveats *"two labs ≠ the industry — treat as directional"* (appendix §A line 28). **One-line why:** a CIVOS-computed "overdue" resting on two web pages is a compliance-flavoured judgement we cannot defend, and the elapsed-days fact is useful without it.
6. **J6 — Make "the model is final, Wave B unblocked" an exit-gate item?** → **RECOMMEND: yes** (it is item 10). Wave B's `ImportBatch.kind` reserves `'test_register'` and explicitly waits on *"the Wave C sample/test model is final"* (`wave-b-migration-importer-spec-2026-07-26.md:371`). J1's answer **is** that model. **One-line why:** without an explicit hand-off, B stays parked forever on a question C2 already answered.

### 13.2 The spec's own decisions

- **`[C2L-a]` — Two columns, not one, not a table.** → §3.1. Elapsed is a fact and lateness is a judgement; one column forces either an invented SLA or the loss of the fact. *Rejected:* a `TestResultStatusHistory` table — the transition is already audited (`workflowRoutes.ts:427-432`) and a second history store would be a parallel record of the same event. *Flip condition:* a rule that needs the duration of a state other than `at_lab`.
- **`[C2L-b]` — No `sampled` status.** → §1.2. `sampleDate` (`schema.prisma:866`) already carries it. A sixth status string means teaching six consumers of `PENDING_TEST_RESULT_STATUSES` a new word for a fact a nullable date holds. *Flip condition:* a rule that must distinguish "sampled but not yet sent" from "planned" — none exists in any shipped pack.
- **`[C2L-c]` — The request form is not rebuilt, and the TRF number is not written back.** → §2.5. Writing back would make `testRequestNumber` (`schema.prisma:863`, never written by anything) semi-populated: some rows carrying a real lab reference, others a UUID prefix CIVOS invented, with nothing to tell them apart. Leaving it wholly unwritten keeps it available for the real lab reference when C4 or a lab integration supplies one. *Flip condition:* a lab asks for a CIVOS-issued reference on the form.
- **`[C2L-d]` — Human-chosen attach, never a matcher.** → §3.2. Auto-matching a PDF to a planned sample is a confident-wrong-answer surface, and duplicate detection is **C4**'s (program line 78). *Flip condition:* C4 ships duplicate detection and a matcher can be built on top of a real identity rather than a guess.
- **`[C2L-e]` — No new index.** → §4.1. `(projectId, status)` (`schema.prisma:900`) covers the only new query. *Flip condition:* AT-70's list exceeds the §9 budget on a real project.
- **`[C2L-f]` — Per-production-day limbs deferred**, though `[C1R-4]` assigns them to C2. No shipped pack declares one: D14 §5.4.2 **recorded** Q6's one-shift limb rather than encoding it, and three separate documents state CIVOS has no production-shift record. Building the record before a rule needs it is speculative. *Flip condition:* a pack that would otherwise ship needs a per-day count — then the record is designed against that rule, not in the abstract.
- **`[C2L-g]` — `ponytail:` the lifecycle already exists; C2 adds two facts and one wire.** The whole spec. The over-build available here — a `Sample` entity, a `Laboratory` entity, a status-history table, an SLA model, a matcher, an external portal — is roughly ten times the code for zero additional answered questions in v1, and several of those answers would be wrong.

---

## 14. Research: settled, and what must not be invented

### 14.1 Settled — do NOT commission another pass

- **MDD does not count toward N.** Grade A, both jurisdictions, `c1-mdd-exclusion-research-2026-07-27.md` VERDICT. Enforced at `testCategories.ts:314`. C2 re-proves it (AT-65); it does not re-research it.
- **MDD is a per-SITE paired requirement, not a per-lot one.** Same doc, nuance 2: *"Do not add a '1 MDD per lot' requirement — no source supports that."* Settled as a **prohibition**; building the requirement type is a scope decision (§5.3), not a research gap.
- **Assigned MDD values decay on rework.** RC 500.05 §7, nuance 4. Settled well enough to forbid the boolean-flag shortcut. Not settled enough to build the staleness trigger.
- **Australian labs return PDFs, 1–5 business days, no universal API.** Grade **B**, appendix §A line 28 — directional only. Enough to justify the pre-cover gate's value; **not** enough to compute an SLA (J5).

### 14.2 Must be researched before it is encoded — never inferred

- **The TfNSW LIMS tabulated format.** Grade-A source identified (appendix §A line 27, 2023) and **never read by any CIVOS pass**. Assigned to **C3**. No C2 code touches it `[C2L-B4]`.
- **Lab turnaround as an SLA.** Would need real lab agreements, not marketing pages, before any CIVOS-computed lateness could be defended.
- **Chain-of-custody requirements.** **Zero** occurrences of "chain of custody" in `docs/` or `tasks/`. Program line 78 assigns it to **C4**; no CIVOS spec has designed it.
- **QLD/TMR Q142A.** Primary text **NOT FOUND** (`c1-mdd-exclusion-research-2026-07-27.md` `## What was NOT found`). Ship no QLD-specific claim citing that research.
- **Non-cohesive materials use density *index* (AS 1289.5.6.1), not density *ratio*** — nuance 7, flagged and unresearched. Not C2's, but do not let a lifecycle PR quietly assume ratio.

---

## 15. Verification notes — shipped code vs the sibling specs

Three citations carried in from sibling specs were re-opened at `bb28c44b` and found stale. **All three claims remain true; only the line numbers moved.** They are filed as exit item 11 rather than silently repeated. The F0 staleness lesson applies: re-verify at build time.

| Claim | Cited as | Actual at `bb28c44b` | Status |
| --- | --- | --- | --- |
| `TestResult.sampleLocation` is free text | `wave-c1-test-sufficiency-spec-2026-07-26.md:927` cites `schema.prisma:836` | **`schema.prisma:867`** | `[C2L-1]` — claim true, citation stale by 31 lines |
| `TestResult` carries `rejectedById`/`rejectedAt`/`rejectionReason` | `predicates.ts:176` cites `schema.prisma:846-853` | **`schema.prisma:882-884`** | `[C2L-2]` — claim true, citation stale |
| `getClaimBlockingReasonsForConformedLot` is where sufficiency must never appear (`[C1R-B2]`) | `wave-c1-test-sufficiency-spec-2026-07-26.md:800` cites `conformancePrerequisites.ts:166-207` | **`conformancePrerequisites.ts:192-233`** | `[C2L-5]` — prohibition intact, citation stale by 26 lines |

Three further observations recorded for whoever builds this, none blocking:

1. **AI extraction writes live rows before any human sees them.** `POST /upload-certificate` creates a real `TestResult` at `results_received` with unreviewed AI values (`certificateIntake.ts:171`, `testResultMapping.ts:77`) — and still creates one when the AI fails or `ANTHROPIC_API_KEY` is absent, from a **filename guess** at confidence 0.15–0.45 (`certificateExtraction.ts:44-60`, `:243-246`). The repo has an unused `AiProposal` model (`schema.prisma:1995`). Moving certificate intake behind a proposal is **not** C2 v1 work — but it is the honest home for C4's "extraction source + confidence on every AI value", and C2.2's null-only merge is deliberately built so it stays compatible with such a move.
2. **Specifications are never applied.** The 13-entry `testTypeSpecifications` table (`specifications.ts:22-127`) is exposed on two GET routes and read by the verification view, but **no create or confirm path ever seeds `specificationMin`/`specificationMax` from it** — pass/fail is computed against whatever bounds the AI read off the certificate or the user typed (`certificateExtraction.ts:323-341`). Out of C2's scope; worth knowing before anyone assumes a spec binding exists.
3. **`itpChecklistItemId` has no index** (`schema.prisma:861`, indexes at `:899-903`) despite being the strong-match key in the conformance gate (`conformancePrerequisites.ts:284-296`). Not C2's to fix; noted so it is not discovered twice.

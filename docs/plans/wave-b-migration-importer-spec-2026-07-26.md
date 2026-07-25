# Wave B Execution Specification — Migration Importer

**Date:** 26 July 2026 · **Status:** implementation-ready pending review · **Rev 1**
**Program contract:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` §Wave B (line 71–72), governed by §9 (delivery control) and §6 (completion standards).
**House style:** matches `docs/plans/f0-execution-spec-2026-07-24.md` (Rev 2) — current-state map with `file:line` citations, PROPOSED Prisma, staged delivery with per-stage exit gates, acceptance-test list, open-decisions section.

**Governing principle:** Wave B is a **batch layer on top of the existing AiProposal machinery** — proposal → human review → decide → apply, with rollback. It does **not** introduce a parallel review system. Every imported record group is applied inside the deciding transaction through a stage apply handler and reversed through a stage rollback handler, exactly like the Wave-1 setup executors (`backend/src/routes/copilot/lotBreakdownExecutor.ts:17,93`). It reuses the existing Anthropic extraction transport (`backend/src/routes/testResults/certificateExtraction.ts:182`) and the Wave-2 canonical activity taxonomy + matcher (`backend/src/lib/activityTaxonomy.ts`, `backend/src/lib/itpMatcher.ts`). New code is: file parsing (Excel/Word/PDF → structured rows), reusable mapping profiles, batch-scoped proposal orchestration, dry-run/reconciliation reporting, and the source-beside-proposal review surface.

All line citations were verified in this worktree at HEAD `dfbd01e0`. Re-verify line numbers at build time (the F0 staleness lesson applies).

---

## 1. Outcome, scope and non-goals

**Outcome:** a contractor migrating off spreadsheets/CivilPro/legacy PDFs imports a full project history — ITPs first, then lot registers — reviews every proposed record beside its source document, runs a dry-run to see counts before committing, applies as a reviewed batch, and can roll the whole batch back. Benchmark: **a full project history imported in under an afternoon** (beat Visibuild's "afternoon" — program §Wave B).

**Included (Wave B):**
- Formats in strict order: **Excel first, then Word, then PDF** (staged across B1/B2/B3 — §6).
- **ITP imports first** (the AU column schema — activity / description / acceptance criteria / point type / responsible party / test type — is near-universal; Q6 forces criteria into cells), landing in the Wave-2 taxonomy (`backend/src/lib/activityTaxonomy.ts:61`) and the existing `ITPTemplate` + `ITPChecklistItem` model (`backend/prisma/schema.prisma:609,630`).
- **Lot register imports** (B2), producing lots + ITP-instance links through the existing bulk-create core the lot-breakdown executor already uses (`backend/src/routes/copilot/lotBreakdownExecutor.ts:27`).
- Reusable **saved mapping profiles**, including a shipped **CivilPro mapped-Excel profile**.
- Review UX: **source document rendered beside the proposal**, ambiguity highlighting, column/field mapping, duplicate detection, **dry-run counts before commit**, batch rollback, **provenance on every imported record**, and a **reconciliation report** (imported / skipped / why).
- **Corporate-master → project-controlled-copy** flow with visible differences.
- File-upload threat model per program §7 (parser hardening, size/type limits, tenant isolation, prompt-injection containment).

**Non-goals (explicit — do not build):**
- **Test-register / certificate-register import is DEFERRED** until the Wave C sample/test model is final (program §9 sequencing correction — "otherwise it gets rebuilt"). This spec designs **nothing** for it beyond the placeholder note in §4.7. The existing single-certificate extraction (`certificateExtraction.ts:182`) is unchanged and is not a bulk register importer.
- **No direct CivilPro DB/API integration** — CivilPro migration is a mapped-Excel profile only (program §Wave B, §4).
- **No promotion of imported spec text to shared/global libraries.** All imported ITP templates are **private-tenant** (`ITPTemplate.projectId` set to the importing project — never `null`, which is the global/library scope the matcher treats as shared: `backend/src/routes/itp/templates.ts:122–128`). Imported acceptance-criteria prose is tenant data, never seeded into `backend/scripts/seeds/itp-templates/`.
- No new AI review vocabulary, no parallel proposal table, no auto-apply — every batch passes through human decision (`decideProposal`, `backend/src/routes/copilot/proposalService.ts:131`).

---

## 2. Current-state map (cited)

### 2.1 AiProposal machinery (the layer Wave B builds ON)

| Concern | Where | Note |
|---|---|---|
| Proposal model | `backend/prisma/schema.prisma:1894` | `stage` is an open string set (L1897); `payload` is **immutable, never updated** (L1902); `sourceRefs` carries `[{documentId?, fileName?, page?, note?}]` (L1901); `editedPayload` holds what was actually applied on accept-with-edits (L1906); `appliedRecordIds` is the rollback target `[{model, ids, meta?}]` (L1907). |
| Create | `proposalService.ts:67` | Supersedes any live `proposed` proposal for the same `(projectId, stage)` in one transaction (L72–75) — **at most one awaiting decision per stage**. Writes an `ai_proposal_created` audit row (L92). |
| Decide | `proposalService.ts:131` | Only `proposed` can be decided (L135). Accept runs the stage apply handler **inside** the deciding transaction (L158); with `editedPayload` the status becomes `edited` and the edited value is applied — original `payload` never mutated (L148–149, L166). Reject has no side effects (L141). |
| Rollback | `proposalService.ts:194` | Only `accepted`/`edited` can be rolled back (L198); runs the stage rollback handler, sets `rolled_back` (L215). |
| Stage registries | `proposalService.ts:48–49` | `applyHandlers` / `rollbackHandlers` keyed by stage string. Executor modules register at import time; missing handler = 400 (L153, L207). |
| Apply/rollback contract | `proposalService.ts:21–42` | `ApplyHandler` returns `AppliedRecordGroup[]` (`{model, ids, meta?}`); create-type stages leave `meta` unset and rollback deletes `ids`; update-type stages store prior values in `meta` for restore. |
| Executor exemplar | `lotBreakdownExecutor.ts:17,93` | apply re-validates the reviewed payload with the same Zod schema the manual route uses, creates through the shared core inside `tx`, returns grouped ids; rollback **guards accumulated work** before deleting (`assertCreatedLotsHaveNoProgress`, L42). Wave B copies this shape. |

### 2.2 ITP template + taxonomy model (where imported ITPs LAND)

| Concern | Where | Note |
|---|---|---|
| Template | `backend/prisma/schema.prisma:609` | `projectId` nullable — `null` = global/library, set = project-private (L611). `activityType` nullable string (L614). `specificationReference`, `stateSpec`, `version`, `isActive` present. |
| Checklist item | `backend/prisma/schema.prisma:630` | `sequenceNumber`, `description`, `acceptanceCriteria`, `pointType` (default `standard`), `responsibleParty`, `evidenceRequired`, `testType`, `notes` — this **is** the AU ITP column schema. `HoldPoint` hangs off the item (L644). |
| Canonical taxonomy | `backend/src/lib/activityTaxonomy.ts:61` | `CANONICAL_ACTIVITIES` = 38 Level-2 slugs across 10 families (`ActivityFamilySlug`, L21). `foldActivityValue(raw)` (L286) folds any legacy/free-text value → `{slug, confidence: 'exact'|'family'|'none'}`. `isCanonicalActivitySlug` (L303). Imported activity strings fold through this. |
| Matcher | `backend/src/lib/itpMatcher.ts:148` | `routeTemplateMatch` — pure, hard-filter + Tier A/B/C by candidate count (`MatchTier` L18). `matchTemplatesForProject` (L219) is the DB wrapper. `GET /templates/match` (`backend/src/routes/itp/templateMatch.ts`) exposes it. |
| Create / clone | `backend/src/routes/itp/templates.ts:216,275` | POST create (L216), POST `/templates/:id/clone` (L275), PATCH (L363). Clone copies `activityType`, `stateSpec`, checklist items — the **corporate-master → project-copy** primitive already exists at the single-template grain. |
| Seeders (do not touch) | `backend/scripts/seeds/itp-templates/index.mjs` + 40 seeders | The shared/global library. Imported tenant text is **never** written here (§1 non-goal). |

### 2.3 Existing extraction surfaces (REUSE, do not reinvent)

| Concern | Where | Note |
|---|---|---|
| Anthropic transport | `certificateExtraction.ts:182` | Calls `https://api.anthropic.com/v1/messages` directly via `fetchWithTimeout` — **no `@anthropic-ai/sdk` dependency** (confirmed absent from `backend/package.json`). `isAnthropicConfigured()` gate (L87); `AI_EXTRACTION_TIMEOUT_MS = 120_000` (L85, the 15s default aborted real vision calls). |
| Document content block | `certificateExtraction.ts:154` | `getCertificateContentBlock(file)` — **PDF → native `document` base64 block** (L159); images → `image` block (L170). Anthropic reads PDF/image natively; **it does NOT read `.xlsx`/`.docx`** (binary Office formats must be parsed to text/grid first — see §3.4). |
| JSON hygiene | `certificateExtraction.ts:139,97` | `extractJsonObject` strips code fences and slices the JSON object; `normalizeConfidence` clamps 0–1. Wave B reuses both. |
| Extraction → proposal exemplar | `backend/src/routes/copilot/lotBreakdownExtraction.ts:6` | Imports the certificate helpers; multer `memoryStorage`, `fileSize: 10 * 1024 * 1024` (L63, same as `projectFactsExtraction.ts:33–34`). **Current extraction persists no source file** — `sourceRefs` carries only `{fileName, note}` (`ControlLineReviewModal.tsx:130`); the review modal *names* the file, it does not render it. Wave B's "source beside proposal" is therefore **new** (§5). |
| Review rail | `frontend/src/pages/projects/copilot/CopilotPanel.tsx:93` | Quiet card per stage; status chip; Review CTA; **Roll back** affordance shown only for `accepted`/`edited` (L52); banner "Every suggestion is reviewed before it is applied" (L107). Wave B's batch review reuses this rail's grammar. |
| Review modal exemplar | `frontend/src/pages/projects/copilot/ControlLineReviewModal.tsx` | Upload (`.pdf,.jpg,.jpeg,.png`, L28) → extract → per-record review → apply with `editedPayload`. Wave B's import review modals follow this shape, adding the source pane. |
| Document model (provenance target) | `backend/prisma/schema.prisma:1524` | `projectId`, `filename`, `fileUrl`, `mimeType`, `documentType`, `category`, version chain. Wave B persists each import source file as a `Document` so it survives for the review pane and audit (§3.3). |

### 2.4 Parsers — the real gap

`backend/package.json` has **no** `xlsx` / `exceljs` / `mammoth` / `pdf-parse`. Excel and Word cannot be handed to Anthropic as-is. Wave B needs one Excel parser and (B2) one Word parser. PDF already works via the native document block. Dependency choice is an open decision (§9-D6); a boring, proven, actively-maintained, pure-JS parser is the bar (parser hardening, §8).

---

## 3. Proposed data model

All models below are **PROPOSED**. They add a batch envelope around AiProposal; they do **not** replace it. One import run = one `ImportBatch` + N `AiProposal` rows (one per stage/chunk), so every existing decide/rollback/audit path is inherited unchanged.

### 3.1 ImportBatch (PROPOSED)

```prisma
// PROPOSED — Wave B. The envelope over one migration run. Owns the source file,
// the chosen mapping profile, the dry-run result, and the per-row outcome ledger.
// It does NOT apply records itself — it spawns AiProposal rows that do (§3.5).
model ImportBatch {
  id              String   @id @default(uuid())
  projectId       String   @map("project_id")
  kind            String   @map("kind")            // 'itp_template' | 'lot_register' (open set; 'test_register' DEFERRED, §4.7)
  sourceFormat    String   @map("source_format")   // 'excel' | 'word' | 'pdf'
  status          String   @default("uploaded")    // uploaded|parsed|mapped|dry_run|review|applied|rolled_back|failed
  sourceDocumentId String  @map("source_document_id") // the persisted Document (provenance + review pane) — §3.3
  mappingProfileId String? @map("mapping_profile_id") // profile used/derived; null until mapping chosen
  parseResult     Json?    @map("parse_result")    // normalized sheet/section grid: {sheets:[{name, headers, rows}]} — bounded, see §8
  dryRun          Json?    @map("dry_run")          // §3.4 shape: counts + per-row outcome + reasons
  createdById     String   @map("created_by_id")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  project        Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  sourceDocument Document         @relation(fields: [sourceDocumentId], references: [id], onDelete: Restrict)
  mappingProfile ImportMappingProfile? @relation(fields: [mappingProfileId], references: [id], onDelete: SetNull)
  createdBy      User             @relation(fields: [createdById], references: [id], onDelete: Restrict)
  proposals      AiProposal[]     // the batch's proposal rows (needs the back-relation added below)

  @@index([projectId, kind, status])
  @@index([projectId, createdAt])
  @@map("import_batches")
}
```

### 3.2 ImportMappingProfile (PROPOSED)

```prisma
// PROPOSED — Wave B. A reusable, tenant-owned column/field mapping. The CivilPro
// profile ships as a seeded row with projectId = null (a shared MAPPING, not shared
// spec text — mappings carry no tenant ITP prose, so this is not a §1 violation).
model ImportMappingProfile {
  id           String   @id @default(uuid())
  projectId    String?  @map("project_id")   // null = built-in profile (CivilPro, generic AU-ITP); set = tenant-saved
  companyId    String?  @map("company_id")   // tenant reuse across a company's projects; null for built-ins
  name         String                        // 'CivilPro ITP export', 'Our standard ITP sheet', ...
  kind         String                         // matches ImportBatch.kind
  sourceFormat String   @map("source_format")
  // Ordered field map: target field <- source column header/index + transform.
  // e.g. [{ target:'description', source:{header:'Inspection / Test Activity'} },
  //       { target:'pointType',  source:{header:'W/H/S'}, transform:'whs_to_point_type' }]
  fieldMap     Json     @map("field_map")
  version      Int      @default(1)
  isBuiltIn    Boolean  @default(false) @map("is_built_in")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  project  Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)
  company  Company? @relation(fields: [companyId], references: [id], onDelete: Cascade)
  batches  ImportBatch[]

  @@index([companyId, kind])
  @@map("import_mapping_profiles")
}
```

### 3.3 Provenance & source persistence

Every imported record must carry provenance (program §Wave B). Two layers:
1. **Batch → source file.** The uploaded file is persisted as a `Document` (`schema.prisma:1524`, `documentType='import_source'`) on upload, `onDelete: Restrict` from `ImportBatch` so the source cannot vanish while the batch exists. This is what the review pane renders and what the reconciliation report links. (Current copilot extraction does NOT persist source — this is the new bit, §2.3.)
2. **Record → batch.** Each applied `AiProposal` carries the batch link (§3.5) and its `sourceRefs` cite `{documentId: sourceDocumentId, fileName, page?/sheet?}` (`AiProposal.sourceRefs`, `schema.prisma:1901`). Imported `ITPTemplate`/`Lot` rows are traceable to the batch through the proposal's `appliedRecordIds` — no new provenance column on the domain tables is required for B1 (the proposal chain is the provenance). If per-record provenance query performance demands it later, add a nullable `importBatchId` to `ITPTemplate`/`Lot` (open decision §9-D7) — deferred, not built speculatively.

### 3.4 Dry-run result shape (PROPOSED JSON, stored on `ImportBatch.dryRun`)

```
{
  counts: { willCreate, willUpdate, willSkip, needsReview, ambiguous },
  rows: [
    { rowRef: { sheet, rowIndex } | { page },
      outcome: 'create' | 'update' | 'skip' | 'needs_review',
      reason?: 'duplicate' | 'unmapped_column' | 'ambiguous_activity' | 'low_confidence' | 'empty',
      duplicateOf?: { model, id, matchedOn },     // §3.6
      proposedActivitySlug?: string, activityFold?: 'exact'|'family'|'none',  // from foldActivityValue
      fieldConfidence?: { [field]: number } }
  ]
}
```
Counts are shown **before commit** (program §Wave B). `needsReview`/`ambiguous` rows are exactly the Tier-B situations the matcher already models (`itpMatcher.ts:18`).

### 3.5 Relationship to AiProposal

- `AiProposal` gains a nullable back-relation to `ImportBatch` (**PROPOSED, additive**):
  ```prisma
  // added to model AiProposal (schema.prisma:1894)
  importBatchId String?      @map("import_batch_id")
  importBatch   ImportBatch? @relation(fields: [importBatchId], references: [id], onDelete: Cascade)
  @@index([importBatchId])   // new
  ```
  Non-import proposals leave it null — zero behaviour change to Wave-1 stages.
- **New stages** (open string set, `schema.prisma:1897`): `import_itp_templates` (B1), `import_lot_register` (B2). Each registers an apply + rollback handler in the existing registries (`proposalService.ts:48–49`), following `lotBreakdownExecutor.ts:17,93`.
- **Batch semantics on top, not around.** A batch of K ITP templates is chunked into proposals (§4.6); "apply the batch" = decide-accept each member proposal; "roll back the batch" = rollback each applied member in reverse order. Partial state is legal and honestly reported (§3.6 reconciliation). We do **not** wrap all K in one giant transaction (a 500-template single transaction is a lock/timeout risk) — **each proposal is its own atomic apply**, and the batch ledger records which succeeded. `// ponytail: per-proposal atomicity, not per-batch. Batch-wide atomicity only if a pilot proves partial-apply confuses reviewers.`

### 3.6 Duplicate detection & reconciliation

- **ITP template dedup key (PROPOSED, an open decision — §9-D2):** within the importing project, `(normalized name, folded activity slug, stateSpec)`. A pre-existing project template matching the key → row outcome `skip` with `duplicateOf`, or `update` under the corporate-master flow (§4.5). Cross-project/global templates never dedup-block an import (imports are private-tenant, §1).
- **Lot dedup key:** `(projectId, lotNumber)` — `lotNumber` is the register's natural identifier; the bulk-create core already enforces uniqueness.
- **Reconciliation report** (rendered from `ImportBatch.dryRun` + the member proposals' outcomes after apply): what imported (with new ids), what skipped and why, what still needs review, per-sheet totals. Exportable (CSV) so the contractor has a migration record. This is the "reconciliation report" of program §Wave B.

### 3.7 Migration

One additive reviewed Prisma migration: two new tables + FKs + indexes; `AiProposal` gains one nullable column, one FK, one index; `Document`/`Project`/`Company`/`User` gain back-relations only. No data backfill. Prod apply via the production-migrations workflow (CLAUDE.md operational warnings — never `db push`, never on Railway startup). The CivilPro + generic-AU-ITP built-in mapping profiles are seeded additively/idempotently (same posture as the ITP seeders).

---

## 4. Pipeline stages

```
upload → parse → map → AI-assisted extraction → dry-run → human review → batch apply → reconciliation → (rollback)
```

### 4.1 Upload
Multer `memoryStorage`, hard `fileSize` cap (§8; ≥ the current 10MB or an explicit larger cap — open decision §9-D1), MIME + extension allow-list per stage (`.xlsx`/`.xlsm` in B1; `+.docx` B2; `+.pdf` B3). File persisted as a `Document` (§3.3). `ImportBatch` created with `status='uploaded'`.

### 4.2 Parse (Excel first)
Excel → normalized grid `{sheets:[{name, headers, rows}]}` via the chosen parser (§2.4). Bounded: max sheets, max rows/sheet, max cell length (§8) — a hostile 1M-row sheet must fail fast, not OOM. `status='parsed'`, grid stored on `ImportBatch.parseResult`. PDF (B3) skips grid parse and uses the native document block (§4.4). Word (B2) → sectioned text via the Word parser.

### 4.3 Mapping (saved reusable profiles incl. CivilPro)
- If a profile is selected/auto-matched (header signature ≈ a built-in or tenant profile), apply its `fieldMap`. The **CivilPro profile** and a **generic AU-ITP profile** ship built-in (`isBuiltIn=true`, `projectId=null`).
- Otherwise present the column-mapping UI (§5) — reviewer maps each source column to a target field (`description`, `acceptanceCriteria`, `pointType`, `responsibleParty`, `testType`, `activityType`, …). Save-as-profile writes an `ImportMappingProfile` for reuse (tenant or company scope).
- `status='mapped'`.

### 4.4 AI-assisted field extraction (bounded)
AI is used **only where deterministic mapping is insufficient**, mirroring the Wave-2 "deterministic-first, AI bounded to ambiguity" rule (`wave2-itp-matching-taxonomy-spec-2026-07-15.md` §2):
- Mapped columns → deterministic transform (no AI).
- Free-text / merged / inconsistent cells, or PDF with no grid → Anthropic extraction via the existing transport (`certificateExtraction.ts:182`), same timeout/JSON hygiene, returning `{value, confidence}` per field.
- **Activity resolution** runs through `foldActivityValue` (`activityTaxonomy.ts:286`) first; only genuinely ambiguous activities get AI ranking, and the result routes through the matcher's Tier A/B/C (`itpMatcher.ts:148`) — never an AI-invented slug.
- **Prompt-injection containment (§8):** extracted document content is data, never instructions (program §7).

### 4.5 Corporate-master → project-controlled-copy
An imported ITP set can be marked a **corporate master**. Applying to a project creates project-scoped copies (the existing clone primitive, `templates.ts:275`), and the review surface shows **visible differences** vs the master (added/removed/changed checklist items). Re-import of an updated master surfaces a diff against the project copy rather than silently overwriting — the project copy is controlled (program §Wave B).

### 4.6 Human review → batch apply
- Batch chunked into member `AiProposal` rows (chunk size an open decision §9-D3; e.g. ≤ 25 templates/proposal to keep each review pane and transaction bounded — the lot-breakdown executor caps at 500 lots per apply, `lotBreakdownExecutor.ts` via the shared 500-cap schema).
- Reviewer works the source-beside-proposal surface (§5), edits inline (→ `editedPayload`, `proposalService.ts:149`), and accepts. Accept applies through the stage handler inside the deciding transaction.
- Import apply handlers create **private-tenant** `ITPTemplate` (`projectId = batch.projectId`) + `ITPChecklistItem` (B1), or lots + ITP instances (B2), returning `AppliedRecordGroup[]` for rollback.

### 4.7 Test-register placeholder (DEFERRED)
`ImportBatch.kind` reserves `'test_register'` but **no parser, no mapping profile, no apply handler, and no schema for it ships in Wave B.** It is built only after the Wave C sample/test lifecycle model is final (program §9). This section exists so the reservation is explicit and nobody wires it early.

### 4.8 Rollback
Batch rollback = rollback each applied member proposal in reverse (`proposalService.ts:194`). Each handler guards accumulated work before deleting, exactly as `assertCreatedLotsHaveNoProgress` does (`lotBreakdownExecutor.ts:42`) — an imported template already attached to a lot with completions cannot be silently deleted; the rollback names the blocker. Partial rollback is legal and reported.

---

## 5. Review UX spec

Concrete against existing patterns. The batch review is a full-page/modal surface following `ControlLineReviewModal.tsx` grammar, launched from a batch card on the copilot rail (`CopilotPanel.tsx:93`), reusing its status-chip + Review + Roll-back affordances (L52). Two-pane:

- **Left — source pane (NEW, §2.3):** the persisted `Document` rendered — PDF via the existing secure document viewer, Excel as the parsed grid with the active row highlighted, Word as sectioned text. Current copilot only *names* the file (`ControlLineReviewModal.tsx:130`); rendering the source is a Wave-B addition and is a B1 exit item.
- **Right — proposal pane:** per imported record: mapped fields with inline edit (→ `editedPayload`), **ambiguity highlighting** (low-confidence fields and `activityFold='family'|'none'` flagged, reusing `LOW_CONFIDENCE_THRESHOLD` from `certificateExtraction.ts:36`), the matcher's **why-matched chips** and Tier badge (`itpMatcher.ts`), and duplicate flags with the `duplicateOf` link.
- **Column-mapping step** (§4.3): source header ↔ target field picker; unmapped columns called out; save-as-profile.
- **Dry-run header:** the `counts` block before any commit — "N create · M update · K skip · J need review".
- **Reconciliation view** (post-apply): the ledger from §3.6, CSV-exportable.
- **Corporate-master diff** (§4.5): added/removed/changed rows highlighted vs the project copy.
- Activity pickers reuse the Wave-2 family→slug picker (`frontend/src/lib/activityTaxonomy.ts`), so imported templates are matchable from birth (`wave2-itp-matching-taxonomy-spec-2026-07-15.md` §2 custom-template rule).

---

## 6. Staged delivery

Sequencing per program §9: B and C1 may overlap only across disjoint subsystems with strict file ownership; test-register migration follows the final C model. Each stage exit-gate meets the four completion standards (program §6): field/quality/external/output as applicable, not just the happy path.

### B1 — Excel ITP import, end-to-end (M)
Upload → Excel parse → mapping (incl. CivilPro + generic profiles) → AI-assisted extraction for ambiguous cells → dry-run → source-beside-proposal review → apply via `import_itp_templates` handler → reconciliation → batch rollback. Imported templates are private-tenant and land in the taxonomy.
**Exit gate:**
- Excel ITP file → private-tenant `ITPTemplate` + `ITPChecklistItem` rows, each traceable to the batch/source (quality/audit standard: source, actor, timestamp attributable).
- Dry-run counts shown before commit; duplicate detection working on the §3.6 key.
- Batch rollback reverses a clean import; refuses when a template has accumulated work, naming it.
- CivilPro mapped-Excel profile imports a real CivilPro export without hand-mapping.
- **Afternoon benchmark measured here:** a representative full-project ITP set (target size an open decision §9-D5) imports, reviews and applies **in under an afternoon** on the reference dataset (program §8) — measured, not asserted; recorded in exit evidence.
- Parser hardening + size/type limits + tenant-isolation tests green (§8).
- One runnable characterization/self-check left behind (parse→dry-run→apply→rollback round-trip).

### B2 — Lot registers + Word (M–L)
`import_lot_register` stage producing lots + ITP-instance links through the existing bulk-create core (`lotBreakdownExecutor.ts:27`); Word (`.docx`) parser for ITP + register documents that arrive as Word tables.
**Exit gate:** lot register (Excel + Word) → lots with correct `lotNumber` dedup; ITP instances linked where the register names an activity/template; rollback guards lot progress (`assertCreatedLotsHaveNoProgress` pattern); Word tables parse to the same normalized grid; completion standards met.

### B3 — PDF + corporate-master flow (M)
PDF import via the native document block (no grid parse); corporate-master → project-controlled-copy with visible diff (§4.5).
**Exit gate:** scanned/native PDF ITP → reviewed templates with ambiguity highlighting; corporate master applied to ≥2 projects showing the controlled-copy diff; re-import of an updated master surfaces a diff, never a silent overwrite; output/audit standards met.

---

## 7. Acceptance tests

1. Excel ITP file → correct `ITPTemplate`/`ITPChecklistItem` rows; `projectId` = importing project (never null); AU columns (activity/description/criteria/point type/responsible party/test type) land in the right fields.
2. CivilPro built-in profile imports a real CivilPro export with zero manual column mapping.
3. Unknown-layout sheet → column-mapping UI → save-as-profile → re-import of a same-layout file auto-applies the saved profile.
4. Dry-run counts (`create/update/skip/needsReview/ambiguous`) computed and shown before any write.
5. Duplicate detection: re-importing the same ITP set marks rows `skip` with `duplicateOf`; no duplicate templates created.
6. Activity folding: legacy/free-text activity values fold via `foldActivityValue`; ambiguous ones route to Tier-B review, never an invented slug; wrong-state templates never Tier-A auto-fill.
7. Ambiguity highlighting: low-confidence fields and `family`/`none` activity folds are visibly flagged in review.
8. Inline edit → `editedPayload` applied; original `payload` unchanged (proposal immutability, `schema.prisma:1902`).
9. Batch apply: K-template batch chunked into member proposals; each applied atomically; partial-apply state reported honestly in reconciliation.
10. Batch rollback reverses a clean import; **refuses** when an imported template/lot has accumulated work, naming the blocker (`lotBreakdownExecutor.ts:42` pattern).
11. Reconciliation report: imported (with ids) / skipped (with reasons) / needs-review totals; CSV export.
12. Corporate-master: apply to a project creates controlled copies; re-import of an updated master shows a diff, no silent overwrite.
13. Provenance: every imported record traces to its batch and source `Document`; source survives (`onDelete: Restrict`).
14. Tenant isolation: an import into project A never reads/writes project B or the global library; imported spec text never lands in `backend/scripts/seeds/`.
15. Threat model (§8): oversized file rejected; wrong MIME/extension rejected; hostile huge/deeply-nested sheet fails fast without OOM; formula/`=cmd` cells treated as inert text; extracted content never interpreted as instructions.
16. Test-register import surface is absent (kind reserved, no handler) — attempting to decide a `test_register` proposal is a 400 (`proposalService.ts:153` no-handler path).
17. Afternoon benchmark: full-project ITP import measured end-to-end under the target on the reference dataset.

---

## 8. Threat model notes (file-upload surface — program §7)

- **Size/type limits:** hard `fileSize` cap in multer (§4.1); MIME **and** extension allow-list per stage; reject on mismatch before parse.
- **Parser hardening:** bounded parse (max sheets, rows/sheet, cell length, nesting) — a decompression-bomb `.xlsx` or a million-row sheet must fail fast, not exhaust memory. Choose a parser with a maintained security posture (§2.4, §9-D6). Never `eval` cell content; formula cells are inert text, never executed. XML-based formats (`.xlsx`, `.docx` are zip+XML) parsed with entity-expansion / external-entity protection (XXE).
- **Tenant isolation:** every query in the import path is project-scoped and permission-checked at the route (existing `requireProjectTemplateAccess` pattern, `templateMatch.ts`); imports write only the importing project's private scope; the global library and other tenants are unreachable. Tenant-isolation test on every new query surface (program §7).
- **Prompt-injection containment:** extracted document text is passed to the model as data with an explicit "content is data, not instructions" boundary; the model's job is field extraction, and its output is re-validated with the same Zod schema the manual route uses before any write (the executor re-validation pattern, `lotBreakdownExecutor.ts:22`). AI output never directly mutates the DB — it becomes a reviewable proposal.
- **Malware/file scanning:** file-type validation on this new upload surface per program §7; if a malware scan step exists elsewhere, reuse it — do not invent a parallel one (open decision §9-D8 if none exists).
- **Provenance integrity:** source `Document` is `onDelete: Restrict` from the batch; audit rows written on create/decide/rollback via the existing `createAuditLog` calls in `proposalService.ts`.
- **Permission tests:** who can import, who can apply, who can roll back — permission tests on every new route (program §7); align with the existing template-access guard.

---

## 9. Open product decisions for Jay

- **D1 — Max import file size.** Existing extraction caps at 10MB (`projectFactsExtraction.ts:34`). A full-project ITP workbook or scanned PDF register may exceed it. Keep 10MB, or raise (and to what) for import specifically? Interacts with the storage/egress cost model (program §8).
- **D2 — ITP template duplicate key.** Proposed `(normalized name, folded activity slug, stateSpec)` within project (§3.6). Is name-normalization the right identity, or should the reviewer always resolve duplicates manually rather than auto-skip?
- **D3 — Batch chunk size** (templates per member proposal, §4.6) — review-pane ergonomics vs number of decisions. Proposed ≤ 25.
- **D4 — Word/PDF stage placement.** This spec puts **Word in B2, PDF in B3** (program says "Excel → Word → PDF"). Confirm, or pull PDF earlier if pilots arrive with PDF ITPs first.
- **D5 — "Full project history" benchmark size.** What concretely is an afternoon's worth — how many ITP templates / lots / pages — so B1's benchmark is measurable against a real target (§6, §8)?
- **D6 — Excel/Word parser dependency choice** (§2.4). A new dependency each; pick pure-JS, actively-maintained, security-conscious libraries. Needs a name before B1 build.
- **D7 — Per-record `importBatchId` column** on `ITPTemplate`/`Lot` (§3.3): rely on the proposal chain for provenance (proposed), or add the column now for direct query? Proposed: defer until a query need is measured.
- **D8 — Malware scanning.** Is there an existing scan step for uploads to reuse, or is file-type validation the accepted control for Wave B? (program §7 lists malware scanning as a standing requirement).
- **D9 — Mapping-profile sharing scope.** Tenant-only, or company-wide reuse (proposed `companyId` on `ImportMappingProfile`)? And should the CivilPro built-in be `projectId=null` global (proposed) given the §1 "no shared spec text" rule — confirmed OK because a mapping carries no ITP prose.

---

**Verification note:** All `file:line` citations verified in worktree at HEAD `dfbd01e0` on branch `wave-b-spec`. The Wave-2 taxonomy + matcher and the test-certificate extraction transport are confirmed present and reused, not reinvented. No `@anthropic-ai/sdk` and no Excel/Word parser currently exist in `backend/package.json` — the parser dependency (§9-D6) is the one genuinely new external piece Wave B introduces.

# Wave G Execution Specification — Revision Governance + UX Stages 2–4 + Market Surface

**Date:** 31 July 2026 · **Rev 1** · **Status:** G1 and G2 build-ready on acceptance. G3 phases each need a mockup pass (two need Jay's shell go). G4a build-ready; G4b needs a counterparty. G5 build-ready after G1. G6 buildable now, **publishing** Jay-gated.

**Specified against:** `f944c39a` (`origin/master`, 31 Jul 2026 — "chore(bench): idle-box re-run — the owed C1 evidence, all targets pass (#1709)"). Every `file:line` below was read at this SHA. **Re-verify line numbers at build time and stamp the fresh SHA in the PR body** — the standing rule from `docs/plans/f0-execution-spec-2026-07-24.md:136`.

**Program of record:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` (Rev 1.2a). This document is the §9 execution specification for **Wave G** (§3, "Template governance + UX Stages 2–4 + market surface (M, gated)") **plus §2's `F1` Document & revision control**, which was scheduled parallel to Wave B and never built. The §9 thirteen-item list is the section structure; the checklist is §12.

**Evidence register:** `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md`. Grades A–D used verbatim. No grade-D claim carries a load-bearing decision alone.

---

## 0. How to read this

### 0.1 Three-state honesty on every factual claim

Following the Wave 0 convention (program §3) and the Wave E.0 / Wave F format:

- **Verified** — cited to code at `f944c39a`, or to a primary source with a URL. Unmarked claims below are verified.
- **[VERIFY BEFORE BUILD]** — believed true, not confirmed at this SHA or not confirmed against a current external source. Never asserted in a PR body, a UI string, or to a customer until re-checked. Each names who checks it.
- **[UNKNOWN]** — could not be established. Listed in §10; never asserted anywhere.

### 0.2 The three things this spec found that change the wave's shape

**Finding 1 — Wave G item 1 and program §2's F1 are the same feature, and the product already contains exactly one working instance of it: drawings.**

`Drawing.supersededById` (`backend/prisma/schema.prisma:1759`, self-relation `:1765-1766`, `@@index([projectId, supersededById])` `:1770`) plus `POST /api/drawings/:drawingId/supersede` (`backend/src/routes/drawings.ts:324-458`) plus the current-set filter `where: { projectId, supersededById: null }` (`backend/src/routes/drawings/readRoutes.ts:108-111`) is a complete, shipped revision chain. It is the **only** one. A repo-wide grep for `supersed|replacedBy|replaced_by|isCurrent|currentRevision|obsolete|revisionOf` returns drawings, one unrelated AI-proposal status literal (`schema.prisma:2114`), a hold-point token sweep, and prose. `replacedBy`, `replaced_by`, `currentRevision`, `obsolete` and `revisionOf` appear **nowhere in source**.

So G1 is not green-field design. It is *generalising a shipped pattern to four more document classes*, and the lazy-correct move is to copy `Drawing`'s shape rather than invent a `GovernedRecord` abstraction over it. §1.3 does exactly that.

**Finding 2 — "historical stability of project instances" is NOT what the program assumes, and it fails in three specific ways.**

The program treats `ITPInstance.templateSnapshot` (`schema.prisma:723`) as probably-sufficient and asks the spec to state what is guaranteed. Read at this SHA:

1. **The snapshot is incomplete.** `buildTemplateSnapshot` (`backend/src/routes/itp/helpers/templateSnapshot.ts:39-58`) captures `{id, name, description, activityType, checklistItems[{id, description, sequenceNumber, pointType, responsibleParty, evidenceRequired, acceptanceCriteria, testType}]}` — and nothing else. It **drops `ITPChecklistItem.notes`** (`schema.prisma:708`), which is where every seeder parks its clause citation (`'Clause 5.2 - No earthworks to commence…'`, `'MRWA Spec 820.06 HOLD.'`). It also drops `specificationReference` (`:676`) and `stateSpec` (`:677`). A conformed lot therefore cannot say which specification clause it was inspected against — the exact thing G1 exists to prove.
2. **The snapshot carries no capture-time metadata.** No `snapshotAt`, no template version, no hash. There is nothing to compare a snapshot *to*.
3. **Legacy instances silently fall back to live data.** `getChecklistItemsForInstance` (`templateSnapshot.ts:88-98`) returns `instance.template?.checklistItems ?? []` whenever `templateSnapshot` is null. Rows created before the snapshot shipped read the *current* template. That is a silent historical-integrity hole, not a stability guarantee.

What *does* hold today holds by accident: global templates cannot be edited through the API at all (`backend/src/routes/itp/templateAccess.ts:115-120` throws 403 `'Global templates cannot be modified from this endpoint'`), and project-scoped checklist edits are blocked with 409 `TEMPLATE_IN_USE` once any completion, hold point or test result references an item (`backend/src/routes/itp/templateUsage.ts:70-140`). Stability is a side effect of two guards, not a design property. And the same immutability means **a spec revision cannot be pushed into the library at all**: the seeders skip anything already present (e.g. `backend/scripts/seeds/itp-templates/seed-itp-templates-wa-structures.js:273-284`), so re-running a seeder after an authority publishes a new edition is a no-op.

**Finding 3 — a PDF visual-regression suite is currently impossible, for a reason that is one line to fix and eight call sites to plumb.**

`drawPdfFooters` (`frontend/src/lib/pdf/branding.ts:320-345`) stamps `Page X of Y · Generated {ts} · {docRef}` onto **every page of all eight documents**, and `{ts}` is `new Date(opts.generatedAt).toLocaleString('en-AU', …)` (`:324`) with no `timeZone`. All eight generators pass `generatedAt: new Date()` (e.g. `frontend/src/lib/pdf/conformanceReportPdf.ts:915`, `dailyDiaryPdf.ts:620`, `docketDetailPdf.ts:483`, `ncrDetailPdf.ts:398`, `testCertificatePdf.ts:299`). Two renders of identical data one minute apart differ on every page; the same data renders different dates in Sydney and London. Separately, all 39 characterization tests mock jsPDF away (`vi.mock('jspdf', …)`, e.g. `frontend/src/lib/pdf/__tests__/pdfGenerator.characterization.test.ts:28`), so **no frontend test produces a single PDF byte**.

The fix already exists in the repo as a worked example: `backend/src/lib/handover/folioRenderer.ts` pins its dates from the payload (`:410` `const pinnedDate = new Date(payload.folio.compiledAt)`, used at `:424-425`) and **throws rather than falling back to now** (`:411-413`); `folioRenderer.test.ts:41-51` asserts `first.equals(second)` on two renders, with a mutation guard at `:53-67` so a constant renderer cannot pass. G4a is "do that, for the eight frontend generators".

### 0.3 Standing boundaries this wave must not cross

Reproduced so this document is self-contained (program §6):

1. **SHELL FREEZE.** Any change under `frontend/src/shell/**` or global chrome requires Jay's explicit go (program §5.4). Phases affected are named in §3 and marked **[JAY-GATE: SHELL]**. All other UI phases require mockups/screenshots to Jay before build — **[JAY-GATE: MOCKUP]**.
2. **`frontend/src/lib/pdf/**` is a complexity hotspot under a standing DON'T-REFACTOR rule.** G4 **characterizes** existing output and layers configuration on top. It does not restructure the generators. The one exception G4a needs — pinning `generatedAt` at the eight call sites — is an argument change, not a refactor, and §4.2 states its bound.
3. **NEVER FABRICATE.** Every public claim must be provable in-product. G6 specifies the *mechanism* (a computed claims register), never the copy.
4. **Pricing is a hypothesis, not validated willingness-to-pay** (program §5.1). G6 stages a pricing page; publishing is DG-7.
5. **AI outputs pass a human review queue; AI never auto-judges.** The G5 learning loop *proposes* template revisions to a reviewer; it never edits a template.
6. **Readiness is computed, never a stored `ready=true` flag** (F0's governing principle, `docs/plans/f0-execution-spec-2026-07-24.md:6`). G1's superseded-document warning is a computed readiness item, not a stored flag.

---

## 1. G1 — Revision governance data model (the foundation; everything else consumes it)

### 1.1 What exists today

| Capability | Where | Status |
|---|---|---|
| Drawing revision + supersession chain | `schema.prisma:1750-1772`; `backend/src/routes/drawings.ts:324-458` | Shipped |
| Current-set query (`supersededById: null`) | `backend/src/routes/drawings/readRoutes.ts:96-137` | Shipped |
| Supersede validation (same project, same drawing number, target itself current) | `backend/src/routes/drawings.ts:36-65` | Shipped |
| Superseded presentation (dimmed row, chip, revise hidden) | `frontend/src/pages/drawings/components/DrawingRegisterTable.tsx:136,140-141,203` | Shipped |
| Document version chain (flat root→children) | `schema.prisma:1701-1703` (`version`, `parentDocumentId`, `isLatestVersion`); `backend/src/routes/documents/versionRoutes.ts:102-257` | Shipped |
| Version guard: cannot version a doc already used as ITP/NCR evidence | `versionRoutes.ts:56-82` (409 `WORKFLOW_EVIDENCE_VERSION_BLOCKED`) | Shipped |
| ITP instance snapshot | `templateSnapshot.ts:39-58`, read `:88-118` | Shipped, incomplete (§0.2) |
| Spec-set affirmation by a human | `schema.prisma:684-685`; written `backend/src/routes/copilot/import/itpTemplateImportExecutor.ts:163-164` | Shipped |
| Evidence Readiness engine (pure, input-driven) | `backend/src/lib/evidenceReadiness.ts:397`; item shape `backend/src/lib/evidenceReadiness/core.ts:21-50`; area vocabulary **already includes `'document'`** `core.ts:8-19`; closed code vocabulary `backend/src/lib/readiness/contracts/reasonCodes.ts:30+` | Shipped |
| Issue-and-open-receipt pattern to copy | `HoldPointReleaseToken` `schema.prisma:829-864` (`recipientEmail :833`, `openedAt :842`, `usedAt :843`) | Shipped |

### 1.2 What does not exist (searched, not assumed)

- **No lot ↔ drawing edge.** `Drawing` (`schema.prisma:1750-1772`) has no `lotId`; no `drawingId` column exists anywhere in the schema. "Which lots were performed under DWG C-204 Rev C" is **unanswerable today**.
- **No issue / distribution / acknowledgement record for any document or drawing.** Grep of `schema.prisma` for `acknowledg|recipient|deliveredAt|openedAt|readAt|issuedTo|distribut` returns hold-point tokens, hold-point mail consent, scheduled-report delivery attempts and webhook deliveries — nothing document-scoped.
- **No supersession on `Document`.** `isLatestVersion` (`:1703`) is the entire semantic; there is no supersession reason, no issue step, no notification.
- **`POST /api/drawings/:id/supersede` writes no audit log** while `DELETE` does (`backend/src/routes/drawings.ts:302`). Issuing a revision currently leaves no auditable actor beyond `Document.uploadedById`.
- **Document type vocabulary is frontend-only** (`frontend/src/pages/documents/documentsUploadData.ts:42-54`) and has no `itp`, `approved_method` or `client_direction`; the backend accepts any string (`schema.prisma:1684`).

### 1.3 The model — extend, do not abstract

**Design decision (recommended, reversible):** do **not** build a single polymorphic `ControlledRecord` table over drawings, specs, ITPs, methods and directions. Three reasons: `Drawing` already has a working, indexed, uniquely-constrained revision chain that a polymorphic table would have to migrate and weaken; the five classes have genuinely different natural keys (drawing number + rev; spec code + edition; template + version; product approval; direction reference); and F0's own model separates definition from instance for exactly this reason (program §2). Instead:

**(a) A shared *issue and acknowledgement* pair, keyed the way `Comment` already is.** `Comment` (`schema.prisma:2067-2088`) uses `entityType` + `entityId` with `@@index([entityType, entityId])` and no FK — a shipped, load-bearing precedent in this codebase. Two new models follow it:

```prisma
model RevisionIssue {
  id            String   @id @default(uuid())
  projectId     String   @map("project_id")
  entityType    String   @map("entity_type")   // 'drawing' | 'specification' | 'itp_template' | 'approved_method' | 'client_direction'
  entityId      String   @map("entity_id")     // the revision row's id — the NEW revision, never the superseded one
  revisionLabel String   @map("revision_label")// human rev token as issued ('C', 'Ed. 3', 'v4')
  supersedesId  String?  @map("supersedes_id") // prior revision's entityId, null for first issue
  reason        String?                        // why replaced — REQUIRED for supersession (§1.7 E3)
  issuedById    String   @map("issued_by_id")
  issuedAt      DateTime @default(now()) @map("issued_at")
  createdAt     DateTime @default(now()) @map("created_at")

  project    Project                   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  issuedBy   User                      @relation(fields: [issuedById], references: [id], onDelete: Restrict)
  recipients RevisionAcknowledgement[]

  @@index([projectId, entityType, entityId])
  @@index([projectId, issuedAt])
  @@map("revision_issues")
}

model RevisionAcknowledgement {
  id             String    @id @default(uuid())
  issueId        String    @map("issue_id")
  userId         String?   @map("user_id")        // internal recipient
  recipientEmail String?   @map("recipient_email")// external recipient
  notifiedAt     DateTime? @map("notified_at")
  openedAt       DateTime? @map("opened_at")
  acknowledgedAt DateTime? @map("acknowledged_at")

  issue RevisionIssue @relation(fields: [issueId], references: [id], onDelete: Cascade)
  user  User?         @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@unique([issueId, userId])
  @@unique([issueId, recipientEmail])
  @@index([issueId, acknowledgedAt])
  @@map("revision_acknowledgements")
}
```

Notification/open semantics reuse the `HoldPointReleaseToken` pattern (`schema.prisma:829-864`) rather than inventing one. `notifiedAt` ≠ `openedAt` ≠ `acknowledgedAt`: "we sent it", "they opened it", "they said yes" are three different contractual facts and G1 keeps them distinct.

**(b) Per-class supersession columns copying `Drawing`'s shape.** `Drawing` needs no change. Each new governed class gets `supersededById String?` + self-relation + `@@index([projectId, supersededById])`, matching `schema.prisma:1759-1770` exactly. `Document` gains `supersededById` alongside its existing `isLatestVersion` — the two answer different questions ("is this the newest upload of this file" vs "has this been formally replaced by an issued revision") and G1 does not merge them.

**(c) The lot ↔ governing-revision edge, which is the whole point.**

```prisma
model LotGoverningRevision {
  id             String   @id @default(uuid())
  lotId          String   @map("lot_id")
  entityType     String   @map("entity_type")
  entityId       String   @map("entity_id")
  revisionLabel  String   @map("revision_label")  // denormalised, frozen at link time
  linkedAt       DateTime @default(now()) @map("linked_at")
  linkedById     String?  @map("linked_by_id")
  unlinkedAt     DateTime? @map("unlinked_at")    // never deleted — history is the product

  lot Lot @relation(fields: [lotId], references: [id], onDelete: Cascade)

  @@index([lotId, unlinkedAt])
  @@index([entityType, entityId])
  @@map("lot_governing_revisions")
}
```

Rows are **never hard-deleted**; unlinking sets `unlinkedAt`. `revisionLabel` is denormalised deliberately so a folio can print what governed the work without a live join surviving.

**(d) The warning plugs into the shipped readiness engine, not a new one.** Add one code to `backend/src/lib/readiness/contracts/reasonCodes.ts` (the header at `:1-21` requires provenance in the same change or the contract test fails), emit `{severity: 'warning', area: 'document', code: 'governing_revision_superseded'}` from `evidenceReadiness.ts`. **Cost warning:** `evidenceReadiness.ts` is pure and imports no Prisma; all three callers (`backend/src/routes/claims/readRoutes.ts:262`, `backend/src/routes/lots/qualityRoutes.ts:334`, `backend/src/routes/projectCloseoutReadiness.ts:91`) must be taught to fetch and pass the new input. That plumbing, not the item, is the real work.

### 1.4 Permission matrix (G1)

| Action | owner | admin | project_manager | quality_manager | site_manager | foreman | site_engineer | subcontractor* | viewer |
|---|---|---|---|---|---|---|---|---|---|
| View revision history of a governed record | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Issue a revision (supersede) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Record distribution recipients | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Acknowledge a revision addressed to me | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Link/unlink a lot's governing revision | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| See the superseded-document warning on a lot | inherits existing lot-readiness visibility (`evidenceReadiness.ts` + `filterCommercialReadiness :458`) | | | | | | | ✗ | ✓ |

\* Nothing in G1 is exposed to `subcontractor` / `subcontractor_admin`. Issue rights mirror the shipped drawings write gate (`backend/src/routes/drawings/access.ts`); **[VERIFY BEFORE BUILD]** — read that file's exact role set at build time and match it rather than re-deriving (owner: implementing agent).

### 1.5 Migration plan (G1)

Three reviewed Prisma migrations, each independently deployable, none destructive:

1. `add_revision_issue_and_acknowledgement` — two new tables, no changes to existing ones. Additive.
2. `add_supersession_to_governed_documents` — `documents.superseded_by_id` nullable + self-FK `SetNull` + index. Additive, all-null on apply.
3. `add_lot_governing_revisions` — one new table. Additive.

Prod apply is the orchestrator's job pre-merge, via the production-migrations workflow. **Never `prisma db push`, never `--accept-data-loss`** (CLAUDE.md operational warnings). No backfill migration: existing drawings keep their `supersededById` chain untouched, and `RevisionIssue` rows are created only from the point of adoption forward — history that was never recorded is not invented. §1.7 E5 covers how the UI says so.

### 1.6 Included / excluded (G1)

**Included:** revision issue + supersession for drawings (existing chain, now audited and issue-recorded), specifications, ITP templates, approved products/methods, client directions; recipient list + notified/opened/acknowledged; lot→governing-revision links; the computed superseded warning; a revision timeline view per governed record.

**Excluded, with owner:** transmittal PDF generation (G4, if a client asks); external (no-account) acknowledgement links — Wave E owns external-link identity and its threat model, and G1 must not open a second external surface (§7); automatic inference of which lots a drawing governs (needs spatial or spec-reference matching — DG-3); document approval workflows (not in the program).

### 1.7 Edge cases (G1)

| # | Case | Behaviour |
|---|---|---|
| E1 | Revision issued while a hold-point package is out for release | Package is **not** invalidated. The lot readiness gains the `governing_revision_superseded` warning and the hold-point detail shows "issued under REV B; REV C issued {date}". Retroactively voiding a decision someone already made would violate the quality-and-audit standard (program §6). |
| E2 | Two users issue a revision of the same record concurrently | Second write fails. Enforced by the existing `@@unique([projectId, drawingNumber, revision])` (`schema.prisma:1768`) for drawings and an equivalent per-class unique for the others; the supersede handler already row-guards "only a current revision can be superseded" (`drawings.ts:371-374`) — reuse that guard verbatim. |
| E3 | Supersession with no reason given | Rejected, 400. `reason` is required on any `RevisionIssue` where `supersedesId != null`. First issues may omit it. |
| E4 | A superseded record is a lot's governing revision and the lot is already conformed | Warning shows on the lot but **does not block** anything and never appears on the folio as a defect. Conformance already happened; the record states what governed it. |
| E5 | Records that pre-date G1 (no `RevisionIssue` row) | Timeline renders "No issue record before {adoption date}" rather than implying none occurred. Never presented as "never issued". |
| E6 | Acknowledgement from someone removed from the project | Retained. `RevisionAcknowledgement.userId` is `SetNull`; the row keeps `acknowledgedAt`. Deleting the fact that someone acknowledged would be evidence destruction. |
| E7 | A lot links to a revision of a record in another project | Rejected, 400. Same-project check mirrors `requireSupersededByInProject` (`drawings.ts:36-65`). |
| E8 | `Document` already has `isLatestVersion = false` and is now formally superseded | Both fields set. They are not merged; §1.3(b). |

### 1.8 Acceptance tests (G1)

- **AT-G1** Issuing a revision of a drawing creates a `RevisionIssue` with `supersedesId` = the prior drawing id, sets the prior row's `supersededById`, and writes an audit-log row — closing the gap at `drawings.ts:324-458` where supersede writes no audit entry.
- **AT-G2** A supersession request without `reason` returns 400; a first issue without `reason` succeeds.
- **AT-G3** A lot linked to a now-superseded governing revision produces exactly one readiness item, `severity: 'warning'`, `area: 'document'`, `code: 'governing_revision_superseded'`, and produces **zero** blockers.
- **AT-G4** Conforming a lot whose governing revision is superseded still succeeds (E4).
- **AT-G5** Tenant isolation: a user in project A cannot read, issue against, or link any revision in project B — asserted on every new query surface (program §7).
- **AT-G6** `RevisionAcknowledgement` survives project-user removal with `acknowledgedAt` intact (E6).
- **AT-G7** Concurrent issue of the same revision label: exactly one succeeds, the loser gets a 409 and no partial write.

### 1.9 Flags, rollout, rollback (G1)

Flag: `REVISION_GOVERNANCE_ENABLED` env var, parsed with the shipped convention (`process.env.X?.trim().toLowerCase()` — see `backend/src/lib/readiness/recordDecision.ts:237`, `backend/src/lib/dataRetentionWorker.ts:21`). Off: new routes 404, new readiness code never emitted, existing drawings behaviour unchanged. Rollback = flag off; tables stay (additive migrations are not rolled back — the standing rule). Exit-gate evidence: AT-G1…G7 green, migration applied to prod, one governed record issued and acknowledged on a demo project with a screenshot of the timeline.

---

## 2. G2 — ITP library provenance and version governance

### 2.1 What the library carries today, and what it drops

The seeded global library is 40 seeder files across 7 jurisdiction groups (`backend/scripts/seeds/itp-templates/index.mjs`: austroads 1, national 2, nsw 7, qld 8, sa 9, vic 8, wa 5). The metadata Wave G item 1 asks for **already exists — in JavaScript comments**, and is dropped on the way to the database:

- `seed-itp-templates-wa-structures.js:3-19` — *"Specification 820 CONCRETE FOR STRUCTURES (edition 04/10134, 29/08/2025)"*, *"Specification 822 STEEL REINFORCEMENT (edition 04/10136, 21/06/2023)"*.
- `seed-itp-templates-qld-earthworks.js:1-12` — *"Based on: MRTS04 General Earthworks (March 2025) / Verified against: TMR MRTS04 specification clauses, TN216 (Nov 2025)"*.
- `index.mjs:8-49` — each manifest row carries a `label` naming the authority (`'QLD TMR earthworks'`, `'WA Main Roads WA structures'`); `index.mjs:123` only prints it.

What lands in columns (`seed-itp-templates-wa-structures.js:286-300`): `projectId: null`, `name`, `description`, `activityType`, `specificationReference`, `stateSpec`, `isActive`, and checklist items including `notes`. **Authority, spec edition, issue date, effective date and review date are never persisted.** `ITPTemplate.version` (`schema.prisma:678`) is a **dead column** — declared, defaulted to 1, and never read or written by any code in `backend/src` or `frontend/src` (searched; the only `version` hits in ITP routes are the Anthropic API header). Every row is `1` forever.

### 2.2 G2 scope

**(a) Persist the provenance that already exists in comments.** Add to `ITPTemplate`:

```prisma
  authority        String?   @map("authority")          // 'TMR' | 'TfNSW' | 'VicRoads' | 'DIT' | 'MRWA' | 'Austroads' | 'WSA' | free text
  specEdition      String?   @map("spec_edition")       // '04/10134' | 'March 2025' — as published, never normalised
  specIssuedOn     DateTime? @map("spec_issued_on")
  effectiveFrom    DateTime? @map("effective_from")
  reviewDueOn      DateTime? @map("review_due_on")
  changeSummary    String?   @map("change_summary")
  supersededById   String?   @map("superseded_by_id")
  sourceTemplateId String?   @map("source_template_id") // clone/import lineage — see (c)
```

`supersededById` copies `Drawing`'s shape (`schema.prisma:1759-1770`) and participates in G1's `RevisionIssue` with `entityType: 'itp_template'`.

**Backfill is by seeder edit, not by migration.** Each seeder writes the values its own header comment already states; the migration only adds nullable columns. That keeps the authority claim traceable to the file that cites the source. **[VERIFY BEFORE BUILD]** — the edition strings in the seeder headers were verified against primary sources at seeding time, not at this SHA; program §10 marks TMR/DIT-SA/MRWA numeric frequencies as unverified. G2 **persists what the seeders assert and records where it came from; it does not upgrade any claim's evidence grade.** The revalidation obligation stays with the appendix (owner: Jay/orchestrator, per appendix §A revalidation dates).

**(b) The annexure warning.** A template whose `specificationReference` names a specification that carries project-specific annexures must surface: *"This template follows {spec} {edition}. Project annexures may add or vary requirements — check your contract annexure."* Implemented as a per-template boolean `annexureWarning` plus the shared string; shown on the template card and on the lot's ITP tab. **Not** an AI judgement — a seeder-set flag.

**(c) Corporate-master → project-controlled-copy lineage.** Both copy mechanisms exist and **neither records lineage**: `POST /itp/templates/:id/clone` (`backend/src/routes/itp/templates.ts:290-375`) writes no source pointer — the only tie is the default name `` `${sourceTemplate.name} (Copy)` `` (`:331`) — and `sourceTemplateId` appears **nowhere in the repo** (searched schema, `backend/src`, `frontend/src`). Wave B's import executor states the controlled-copy principle in comments (`backend/src/routes/copilot/import/itpImportDryRun.ts:565-587`) but the created template carries no `importBatchId`; the only path back is a JSON-contains scan of `AiProposal.appliedRecordIds` (`schema.prisma:2123`), unindexed. G2 sets `sourceTemplateId` on clone and on import, and adds `importBatchId String?` to `ITPTemplate` so an imported template is traceable to its source document in one join.

**Also fix two silent data losses on the copy paths**, both one-line: clone drops `ITPChecklistItem.notes` (`templates.ts:338-346`) and so does the import executor (`itpTemplateImportExecutor.ts:166-174`). Clause citations vanish on every copy today.

**(d) Snapshot completeness (the §0.2 Finding-2 fix).** Extend `buildTemplateSnapshot` (`templateSnapshot.ts:39-58`) to capture `notes`, `specificationReference`, `stateSpec`, `authority`, `specEdition`, and a `snapshotAt` timestamp. **This is additive to the snapshot JSON**; `parseTemplateSnapshot` (`:60-86`) already tolerates unknown shapes defensively and filters items lacking a string `id` (`:78-81`), so old snapshots keep parsing. Characterization first: pin current snapshot output in a test before changing the builder, then assert the new fields. Existing snapshots are **not** rewritten — a lot conformed under the old snapshot keeps exactly the bytes it had.

Also **close the null-snapshot fallback** (`templateSnapshot.ts:97`): a one-off backfill script (not a migration) writes a snapshot for every `ITPInstance` where `templateSnapshot IS NULL`, stamped with a `backfilledAt` marker so it is never mistaken for a genuine assignment-time capture. Instances whose template has since been deleted are left null and render "template no longer available" rather than a fabricated snapshot.

**(e) Version compare.** Reuse `diffChecklistItems` (`backend/src/routes/copilot/import/itpImportDryRun.ts:258-298`) — it already pairs items by normalised description and returns `{added, removed, changed}` (`ChecklistDiff`, `dryRunTypes.ts:44-50`), and the UI already renders that shape (`frontend/src/pages/projects/copilot/ImportReviewPanes.tsx:39-70,343-347`). New endpoint `GET /api/itp/templates/:id/compare?against=<templateId>` returns the same `ChecklistDiff` plus a metadata diff. **No new diff engine, no new UI vocabulary.** The known limitation is already documented at `itpImportDryRun.ts:254-256` (a reworded item reads as one removed + one added) and is carried forward, stated in the UI, not fixed.

**(f) Push a spec revision into the library.** Today impossible (§0.2). G2 adds a seeder mode `--supersede` that, for a named template, creates a **new** global template row carrying the new `specEdition` / `effectiveFrom` / `changeSummary`, sets the old row's `supersededById`, and records a `RevisionIssue`. Existing project instances are untouched — they keep their snapshots, which is the point. Projects using the old template see a "newer edition available" notice with a compare link. Adoption is a human act, never automatic.

### 2.3 Permission matrix (G2)

| Action | owner | admin | PM | QM | site_manager | foreman | site_engineer | subbie | viewer |
|---|---|---|---|---|---|---|---|---|---|
| View template provenance + annexure warning | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Compare two template versions | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| Adopt a newer library edition into a project | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Supersede a **global** template | operator-only, via the seeder with `--execute` (never an API route) | | | | | | | | |

The global-template API immutability guard (`templateAccess.ts:115-120`) **stays**. G2 does not open an edit path to the shared library.

### 2.4 Migration + acceptance (G2)

One reviewed migration `add_itp_template_provenance` — eight nullable columns + one self-FK + `@@index([projectId, supersededById])`. Additive, all-null on apply. Seeder edits and the snapshot backfill are scripts, run separately with `--execute`, gated on an approved target DB (existing seeder convention, `index.mjs:177-180`).

- **AT-G8** A seeded template exposes `authority`, `specEdition` and `specIssuedOn` matching its seeder header comment (asserted for at least one template per jurisdiction group).
- **AT-G9** Cloning a template preserves `ITPChecklistItem.notes` and sets `sourceTemplateId` to the source id.
- **AT-G10** An imported template carries `importBatchId` resolving to the `ImportBatch` whose `sourceDocumentId` is the uploaded file.
- **AT-G11** Characterization: the pre-G2 snapshot fields are byte-identical after the builder change; the new fields are additionally present on newly-created instances.
- **AT-G12** An instance created before G2 with `templateSnapshot IS NULL` gets a backfilled snapshot marked `backfilledAt`, and `getChecklistItemsForInstance` stops falling through to live template data for it.
- **AT-G13** `GET /compare` between two versions returns a `ChecklistDiff` whose counts match `diffChecklistItems` called directly on the same inputs.
- **AT-G14** Superseding a global template via the seeder leaves every existing `ITPInstance.templateSnapshot` byte-identical.
- **AT-G15** Tenant isolation on `/compare`: comparing against a template in another company's project returns 404, not 403 (no existence disclosure).

Flag: `ITP_PROVENANCE_ENABLED`. Rollback: flag off hides the provenance UI and the compare endpoint; data stays.

---

## 3. G3 — UX Stages 2–4

Every phase here is **[JAY-GATE: MOCKUP]** at minimum. Two are **[JAY-GATE: SHELL]**.

### 3.1 Lot-workspace consolidation — **[JAY-GATE: MOCKUP]**

Current state: `frontend/src/pages/lots/LotDetailPage.tsx` is 602 lines and already a thin orchestrator — nine sections in render order (`:378-601`), all rendering delegated. **Seven tabs**, defined once at `frontend/src/pages/lots/constants.ts:10-18` (`itp, tests, ncrs, photos, documents, comments, history`), reordered but never reduced for foremen (`constants.ts:24-38`). Tab state is already in the URL via `useLotReadinessNavigation` (`LotDetailPage.tsx:81-89`).

**Consolidation is not the first problem here — an accessibility defect is.** `frontend/src/pages/lots/components/LotTabNavigation.tsx:27-43` renders `<button role="tab" aria-selected>` inside a `<nav>` with **no `role="tablist"` parent, no `aria-controls`, no roving tabindex and no arrow-key handling**, and `LotDetailTabPanel.tsx:144` is a single `role="tabpanel"` with conditional children so there is no `id`/`aria-labelledby` pairing. Accessibility basics are explicitly out of scope for simplification (program §6 field-workflow standard). **G3.1 fixes the tab semantics first, as its own PR, before any visual consolidation.** That work is behaviour-preserving and needs no mockup.

Consolidation proper (merging `documents`+`photos` into one Evidence tab; folding `comments`+`history` into one Activity tab — reducing 7 → 5) is a mockup decision, DG-4.

### 3.2 Map toolbar grouping — **[JAY-GATE: MOCKUP]** and **[JAY-GATE: SHELL]**

`frontend/src/pages/lots/map/LotMapView.tsx` is 1,649 lines with a **10-button** toolbar at `:1256-1350` (Find by area, Coverage, Plans, Testing, Test pins, Photos, Draw lot, Snapshot, My location, History), in a `flex flex-wrap` container (`:1255`). On a 390px foreman screen that wraps to multiple rows over the map. The growth is visible in the source: `:1281` "Ninth toolbar item (C3 Phase A)", `:1293` "Tenth toolbar item (C3 Phase B2)".

`LotMapView.tsx` itself is **not** in the frozen shell — but the shell hosts it verbatim at `frontend/src/shell/screens/lots/LotMapScreen.tsx:28-29,102`. **Any toolbar change reaches the foreman shell through that file, so this phase carries the shell gate** even though the edited file is outside `shell/`. That is the trap worth naming explicitly.

Proposed grouping (mockup, DG-4): three clusters — **Find** (Find by area, My location), **Layers** (Coverage, Plans, Testing, Test pins, Photos), **Act** (Draw lot, Snapshot, History) — with Layers collapsing to one control on narrow viewports. No new dependency; the `ToolbarButton` primitive (`:590-627`) already handles icon-only-at-44px and `aria-pressed`.

### 3.3 Save/sync/AI-state standardisation — **[JAY-GATE: SHELL]**, blocked

Four components, three different vocabularies, all reading the same `useOfflineStatus`:

| Component | Path | Vocabulary |
|---|---|---|
| `SyncChip` | `frontend/src/shell/components/SyncChip.tsx:59`; enum `frontend/src/shell/components/syncChipState.ts:8` | 6, derived: `saved / waiting / syncing / failed / conflict / offline` |
| `OfflineIndicator` | `frontend/src/components/OfflineIndicator.tsx:11` | ad-hoc, plus an `isStuck` state no other component models |
| `SyncStatusBadge` | `frontend/src/components/OfflineIndicator.tsx:195-197` | 4, prop-driven: `synced / pending / error / conflict` |
| `OfflineBadge` | `frontend/src/components/OfflineIndicator.tsx:167` | 3, derived — **and it has zero call sites. Delete it.** |

`syncChipState.ts:18-25` documents a real past bug caused by exactly this divergence (a green "All saved" chip beside an amber "1 sync conflict" pill). The canonical enum lives in the shell, so **unification necessarily touches `frontend/src/shell/**` and is Jay-gated.** The A5/A6 survey reached the same conclusion (`docs/plans/a5a6-gap-survey-2026-07-25.md:17`) and sequenced it with A3; nothing has changed. **G3.3 does not start without Jay's shell go (DG-5), and the offline sync-centre spec (`docs/plans/offline-sync-centre-spec-2026-07-28.md`) owns the shell design — G3.3 must fold into it rather than compete with it. [VERIFY BEFORE BUILD]** — read that spec's current status before scheduling (owner: orchestrator).

One piece is not blocked: deleting the dead `OfflineBadge` export is outside the shell and needs no gate.

**AI-state:** there is no generic AI-state indicator. What exists is per-feature, confidence-percentage, all modal (`AIClassificationModal.tsx:74`, `UploadCertificateModal.tsx:281-283`, `BatchUploadModal.tsx:474-617`, `ImportReviewPanes.tsx:57`, `LotEditFormFields.tsx:57`). Standardising them means one shared `<AiConfidence>` presentational component and one vocabulary — outside the shell, mockup-gated only.

### 3.4 Role-specific first-task onboarding — **[JAY-GATE: MOCKUP]**

Three unconnected systems exist: `OnboardingTour` (`frontend/src/components/OnboardingTour.tsx`, 7 modal steps, localStorage seen-marker, **foremen deliberately excluded** at `frontend/src/components/layouts/ProtectedAppShell.tsx:60-67` because it walks desktop chrome), `DashboardSetupChecklist` (`frontend/src/components/dashboard/DashboardSetupChecklist.tsx`, shown instead of an all-zero KPI grid, with a create-sample-project escape hatch), and `CompanyOnboardingPage` (`frontend/src/pages/onboarding/CompanyOnboardingPage.tsx`, a company-creation gate, not guidance). No coach marks, no spotlight system, no `firstRun` flag (searched `coachmark|walkthrough|firstRun|first_run` — zero component hits).

**Recommended shape (lazy):** do not build a tour framework. `setupChecklistState.ts` already derives ordered steps from real counts (`deriveSetupSteps`, `:1-10`) and deep-links when a single project exists (`resolveSoleProjectId`, `:44-46`) — its own comment calls it "the seed of the future project-state copilot" (`:8-9`). Generalise **that** into a role-keyed first-task list (a foreman's first task is "complete an ITP item on a lot", not "create a project"), and retire the modal tour for roles it excludes. One new file, one existing engine extended, no dependency.

### 3.5 Acceptance tests (G3)

- **AT-G16** Lot tab strip exposes `role="tablist"`, each tab has `aria-controls` pointing at a panel with a matching `id` and `aria-labelledby`, and Left/Right arrows move focus between tabs. Automated in the existing Playwright e2e suite.
- **AT-G17** At a 390px viewport, the map toolbar occupies a single row (grouped) — asserted via bounding-box height, not a screenshot.
- **AT-G18** `OfflineBadge` has no references (a grep-assertion test, matching the `folioRenderer.test.ts:186-234` import-graph-assertion precedent).
- **AT-G19** A first-run foreman on `/m` sees a role-appropriate first task and never the desktop-chrome tour.

Flags: `LOT_WORKSPACE_V2`, `MAP_TOOLBAR_GROUPED`, `ONBOARDING_FIRST_TASK` — each independently revertible; the a11y fix ships unflagged (it is a defect fix).

---

## 4. G4 — Accepted outputs

The program's success bar for this item is *"a real client accepts a CIVOS deliverable without reformatting"*. That bar needs a counterparty. This section splits accordingly.

### 4.1 What ships today

- **Eight generators**, already separate files under `frontend/src/lib/pdf/` (5,634 lines / 14 files). `frontend/src/lib/pdfGenerator.ts` is a **25-line barrel** — the DON'T-REFACTOR rule protects the directory, not a monolith.
- **Client formats already half-exist**: `ConformanceFormat = 'standard' | 'tmr' | 'tfnsw' | 'vicroads' | 'dit'` (`frontend/src/lib/pdf/types.ts:2`) with `FORMAT_CONFIGS` (`conformanceReportPdf.ts:57-107`) setting title, subtitle, header colour, `requiresSignature`, `includesSpecReference`, `specPrefix`. **Only for the conformance report; the other seven documents have no format axis.**
- **Branding is effectively complete for PDFs**: `resolvePdfBranding` three-tier fallback (`branding.ts:74-105`), logo pre-embedded as a data URL server-side so generation never does a live fetch (`fetchBranding.ts:6-10`), 1500ms logo timeout (`branding.ts:63`).
- **Pagination is manual y-cursor arithmetic with hand-guessed magic constants.** `jspdf-autotable` is not a dependency. `checkPageBreak` (`conformanceReportPdf.ts:203-212`) is called with 17 different literal space requirements in that file alone (`:360(30)`, `:406(8)`, `:447(30)`, … `:810(6)`). Nothing verifies those constants against real jsPDF text metrics — and the test harness fakes those metrics (`pdfTestRecorder.ts:47` `getTextWidth = len*2`, `:88` `splitTextToSize` splits on `\n` only, so **wrapping is never exercised**).
- **43 characterization tests / 224 assertions**, 39 of them through `JsPdfRecorder` (`frontend/src/lib/pdf/__tests__/pdfTestRecorder.ts`). They assert presence of headings, field values, section toggles and filenames. They assert **nothing** about pagination (zero references to `addPage`/`getNumberOfPages`/`setPage` in any test), layout beyond one header-collision check (`pdfGenerator.characterization.test.ts:1004-1026`), ordering, or bytes.
- **The deterministic counterexample already exists server-side**: `backend/src/lib/handover/folioRenderer.ts` (§0.2 Finding 3), with byte-equality and mutation-guard tests at `folioRenderer.test.ts:41-67` and a transitive-import purity assertion at `:186-234`.
- **No visual-regression tooling of any kind.** Searched `toHaveScreenshot|toMatchSnapshot|pixelmatch|jest-image-snapshot` across both packages and all three `package.json`s: zero. `playwright.config.ts:16` sets `screenshot: 'only-on-failure'` — failure evidence only. No committed baselines anywhere.

### 4.2 G4a — determinism, then regression (buildable now, no counterparty)

**Step 1 — pin the clock.** The eight call sites pass `generatedAt: new Date()`; change them to accept an injected value with `new Date()` as the default at the *caller* boundary, so tests can pass a fixed instant. **Bound on this change:** argument threading only, no restructuring of any generator body. That is the whole exception to boundary §0.3.2, and it is stated here so a reviewer can hold the diff to it.

**Step 2 — pin the timezone.** Ten files call `toLocaleDateString`/`toLocaleString('en-AU')` with no `timeZone` (`branding.ts:324`, `conformanceReportPdf.ts:46,182,338`, `dailyDiaryPdf.ts:23,33`, `dashboardPdf.ts:23,34`, `docketDetailPdf.ts:24,33,82,90`, `holdPointEvidencePdf.ts:13,162,171,450`, `ncrDetailPdf.ts:71,80`, `testCertificatePdf.ts:24`, `claimEvidencePackagePdf.ts:73,161,…`). The repo already has the right helper: `frontend/src/lib/localDate.ts` with `DEFAULT_APP_TIME_ZONE = 'Australia/Sydney'` (`:1`), which is why filenames are already TZ-stable while body dates are not. Route the PDF date formatters through it. Add `TZ` to `frontend/vitest.config.ts` as a belt-and-braces CI pin.

**Step 3 — the regression suite, without adding a dependency.** Once steps 1–2 land, run the real jsPDF (no `vi.mock`) in a small new test file and assert **byte equality across two renders of one fixture**, exactly as `folioRenderer.test.ts:41-51` does, plus the mutation guard from `:53-67`. Add structural assertions the recorder cannot make: page count, and that no text op's y-coordinate exceeds the page's bottom margin.

**Recommended: byte-and-structure regression, not pixel diffing.** Pixel diffing needs a rasteriser; `pdfjs-dist` is installed frontend-side (`frontend/package.json:53`) but rendering it headlessly needs `canvas`, which is not installed and is a native-build dependency on Windows. Byte equality catches every determinism regression, is free, and needs nothing new. Revisit pixel diffing only if a real client rejects an output for a reason bytes could not have caught (DG-6).

**Step 4 — golden fixtures for the layout cases the recorder structurally cannot see**: long descriptions, large ITPs (100+ items), many photographs, missing optional values (program §6 output standard names exactly these four). One fixture each, byte-pinned.

### 4.3 G4b — configurable client formats (buildable now, value needs a counterparty)

Generalise `FORMAT_CONFIGS` (`conformanceReportPdf.ts:57-107`) into a shared `ClientOutputFormat` record applied to all eight documents, and **split the two concerns it currently conflates**: presentation (title, subtitle, header colour) and legal semantics (`requiresSignature`, certificate-vs-report title). Note the live consequence of that conflation: `standard` is titled `LOT CONFORMANCE REPORT` while the four authority formats say `LOT CONFORMANCE CERTIFICATE` and set `requiresSignature: true` (`:80,88,96,104`) — and those are precisely the strings the folio's test suite **bans** from folio output (`folioRenderer.test.ts:92-100`). Certificate language is a legal assertion, not a theme.

Per-project format selection is stored on `Project`; per-document overrides are not built until asked for. Behind `CLIENT_OUTPUT_FORMATS_ENABLED`, default off.

### 4.4 What needs a counterparty (explicitly not buildable now)

The success bar itself. "A real client accepts a CIVOS deliverable without reformatting" is evidence, not code. G4's exit gate therefore has two halves:

- **Buildable now (G4a + G4b):** determinism proven by byte equality, four layout fixtures pinned, format config behind a flag. Exit-gate evidence = green tests + a screenshot of one output in two formats.
- **Needs counterparty (G4c):** one named client, one real deliverable, written acceptance or a list of what they changed. **Owner: Jay** (program §5.5 — design partners are the multiplier). Until then G4c is **[UNKNOWN]** and no acceptance claim is made anywhere, publicly or internally.

### 4.5 Acceptance tests (G4)

- **AT-G20** Two renders of one fixture produce byte-identical PDFs, for each of the eight generators.
- **AT-G21** Mutation guard: changing one field of the fixture changes the bytes (so a constant renderer cannot pass AT-G20).
- **AT-G22** Rendering the same fixture under `TZ=Australia/Sydney` and `TZ=UTC` produces byte-identical output.
- **AT-G23** For each of the four hard layout fixtures, no text operation is placed below the bottom margin, and page count matches the pinned golden.
- **AT-G24** A conformance report rendered in `tmr` format contains `LOT CONFORMANCE CERTIFICATE` and a signature block; in `standard` it contains `LOT CONFORMANCE REPORT` and no signature block.
- **AT-G25** No folio output contains certificate language (existing `folioRenderer.test.ts:92-100` must still pass after the format generalisation — a regression fence between the two output families).

---

## 5. G5 — Management learning loop

### 5.1 The data is better than expected, and the analytics endpoint is already built and unrendered

`NCR` **already carries root cause**: `rootCauseCategory` (`schema.prisma:1024`) and `rootCauseDescription` (`:1025`), plus `responsibleSubcontractorId` (`:1022`), `linkedTestResultId` (`:1015`), `severity` (`:1013`), `category` (`:1012`), `lessonsLearned` (`:1040`), and `@@index([projectId, category, status])` (`:1091`).

`GET /api/ncrs/analytics/:projectId` (`backend/src/routes/ncrs/ncrAnalytics.ts:66-308`) **already computes** root-cause and category breakdowns, monthly closure-time and volume trends (`:179-210`), **repeat issues** grouped `category::rootCause` with `count >= 2` (`:212-250`), and **repeat offenders** grouped by subcontractor (`:252-285`). **It has no frontend consumer** — grepping `ncrs/analytics` across the repo hits only the route, its tests, and an archived doc. The only frontend call into that router is `check-role` (`frontend/src/pages/ncr/hooks/useNCRData.ts:80`).

So the cheapest meaningful increment for G5 phase 1 is: **render what is already computed.** No new aggregation, no new model.

### 5.2 The four real gaps

1. **Vocabularies are free text, enforced only in the frontend.** `category` options live at `frontend/src/pages/ncr/constants.ts:20-27` (6 values) and root-cause at `:30-37` (6 values); the server validates length only (`backend/src/routes/ncrs/ncrCoreValidation.ts:7,100`, `NCR_CATEGORY_MAX_LENGTH = 120`). Trends over an unconstrained string degrade silently. G5 moves both vocabularies to a shared backend module (the `roles.ts` / `activityTaxonomy.ts` mirrored-constant pattern, which already has a pinned-equality drift test on each side) and validates server-side. Existing free-text values fold to `other` in the *aggregation*, never by rewriting stored rows.
2. **No work-type on the NCR.** Trend-by-work-type must hop `NCR → NCRLot → Lot.activitySlug` (`schema.prisma:588`), which is **nullable** when the activity fold resolved only to family level. G5 aggregates over that hop and reports the null bucket honestly as "activity not classified" rather than dropping those NCRs.
3. **Recurrence is recomputed per request over an unbounded `findMany`** (`ncrAnalytics.ts:93-108`) and hard-capped at 10 groups (`:250`). Fine at pilot scale, not at the program §8 reference dataset. §8 sets the budget.
4. **No NCR → ITP template link at all.** The only artefact is a free-text marker `[itp-item:<checklistItemId>]` written into `rectificationNotes` (`backend/src/routes/itp/instances/ncrLinks.ts:14,27-48`), whose own header comment says there is no relation in the schema. It is regex-parsed, unindexed, absent on legacy rows, and absent for NCRs raised outside the failed-ITP path.

### 5.3 The loop, end to end

Add `NCR.itpChecklistItemId String?` (nullable FK, `onDelete: SetNull`) and write it on the auto-NCR-from-failed-ITP path (`backend/src/routes/itp/completions.ts:505` already sets `category`, so the write site exists). Backfill from the existing marker where it parses; leave null otherwise — **never guess**.

Then: recurring failure by (work type × subcontractor × checklist item) → a reviewer sees "this item failed 7 times across 3 subcontractors on `earthworks_bulk`" → the reviewer **proposes** a template change → that proposal, if accepted, becomes a **new ITP template revision through G2(f)**, carrying a `changeSummary` that cites the NCR count. The loop closes into revision governance rather than editing a template in place. That dependency is why G5 sequences after G1/G2.

The proposal is a human writing a change, surfaced by data. **No AI writes a template change**, and nothing in G5 auto-edits anything (boundary §0.3.5).

### 5.4 Acceptance tests (G5)

- **AT-G26** The NCR analytics page renders root-cause breakdown, repeat issues and repeat offenders from the existing endpoint, with subcontractor **names** (today `repeatOffenders` returns bare ids, `ncrAnalytics.ts:266-278`).
- **AT-G27** An NCR created with a category outside the canonical list is rejected with 400 server-side; a pre-existing free-text value still reads and aggregates into "other".
- **AT-G28** NCRs whose lot has a null `activitySlug` appear in an explicit "activity not classified" bucket, not dropped.
- **AT-G29** An NCR auto-created from a failed ITP item has `itpChecklistItemId` set and resolvable to its template.
- **AT-G30** A recurring-failure trend produces a template-revision **proposal record**, and accepting it creates a new template revision via G2(f) — never an in-place edit of an existing template.
- **AT-G31** Tenant isolation on the analytics surface: project B's NCRs never appear in project A's trends.

Flag: `NCR_LEARNING_LOOP_ENABLED`. One reviewed migration `add_ncr_itp_checklist_item` (one nullable FK + index).

---

## 6. G6 — Marketing truth pass and pricing surface

### 6.1 The landing page is in better shape than the wave assumes, with two specific defects

`frontend/src/pages/LandingPage.tsx` (954 lines) already declares and largely keeps a truth posture: *"Copy is grounded in dogfooded product truth — no fabricated stats, logos or testimonials, by design"* (`:11-12`), *"No logos. No invented stats. Just the product."* (`:758`). There are **no testimonials, no customer logos, no "trusted by" block**. The demo board is explicitly labelled illustrative (`:402`, `:490`). The template claim carries its own disclaimer — *"starting points to review against your project specification, not a compliance guarantee"* (`:721-726`). Pricing is honestly absent: *"There's no published pricing yet, and we won't pretend there is."* (`:73-76`).

**Defect 1 — the load-bearing numbers are hand-maintained and already look inconsistent with the library.** `TEMPLATE_CELLS` (`:17-24`) lists five authorities — Austroads 6, TfNSW 14, TMR 32, DIT 32, VicRoads 32 — summing to the `116 ITP templates · 3,070 checklist points` claimed at `:520` and the `116 templates · 3,070 checklist points · 813 hold points` at `:720`. But the seeder manifest carries **seven** jurisdiction groups: austroads 1 file, national 2, nsw 7, qld 8, sa 9, vic 8, **wa 5** (`backend/scripts/seeds/itp-templates/index.mjs`). Western Australia (MRWA) and the national WSA / AUS-SPEC seeders are absent from the public breakdown. So either the public figures understate the shipped library or they are stale — **[UNKNOWN] which**, and that is precisely the point: **there is no computed check, so nobody can tell.** The 3,070 and 813 figures have no derivation recorded anywhere.

**Defect 2 — a price string ships in the product today.** `getPlanBillingLabel` returns `'$99/month'` for `professional` (`frontend/src/pages/company/companySettingsData.ts:157-167`) and `getPlanStorageLabel` returns `'100 GB'` / `'1 GB'` (`:169-178`). Meanwhile **tier quota enforcement is globally off** — `TIER_QUOTA_ENFORCEMENT_ENABLED = false` (`backend/src/lib/tierLimits.ts:14`, with an honest rationale at `:6-13`), and no storage quota code exists at all. A customer on `professional` would see "$99/month · 100 GB" with nothing metering or enforcing either. That is a truth defect in shipped code, independent of any pricing page, and G6 fixes it first.

### 6.2 The mechanism — a computed claims register, not a document

**No marketing-claims register exists** (searched `docs/` for `product-truth|claims register|marketing claim|evidence register`; all hits are the *progress-claim* product sense). The closest artefact, `docs/archive/2026-05-repo-hygiene/landing-page-spec.md`, is archived and still branded "SiteProof", pre-CIVOS-rename.

**Recommended (lazy, and the only version that stays true):** a prose register goes stale the week it is written. Build instead:

1. **`docs/marketing-claims-register.md`** — one row per public claim: claim text · where it appears (`file:line`) · claim type (`computed | code-evidenced | qualitative | external`) · evidence pointer · last verified.
2. **`backend/scripts/verify-marketing-claims.ts`** — for every `computed` claim, recompute it from the source of truth and fail if it drifts. First three: template count, checklist-point count, hold-point count, all derived by loading the seeder manifest. Follows the shipped bench-script convention (`backend/scripts/bench-*.ts`, results committed under `backend/scripts/bench-results/`).
3. **CI wiring** — the script runs on any PR touching `LandingPage.tsx` or `backend/scripts/seeds/itp-templates/**`. A number that cannot be recomputed cannot be published.
4. For `code-evidenced` claims (e.g. *"Superintendents never need an account"* `:58-59`; *"Key field workflows keep working offline"* `:53-54`), the register cites the code proving it (`HoldPointReleaseToken` `schema.prisma:829-864`; `frontend/src/lib/offline/syncWorker.ts`). Not automated — but a human check has something to check *against*.
5. `qualitative` claims (*"Built for the ute, not the office"*) are marked as such and exempt. Honest positioning is not a factual assertion.

### 6.3 Pricing page — staged, publishing gated

Pricing is a **hypothesis** (program §5.1): volume/project-banded, unlimited users, entry ≈ $400–600/mo, ~$1,500–3,000/mo multi-project Tier 2, with adoption a pending Jay decision. G6 therefore:

- **Builds** the page behind `PRICING_PAGE_ENABLED`, default **off**, unrouted and excluded from `frontend/public/sitemap.xml` (which today lists exactly three URLs: `/`, `/privacy-policy`, `/terms-of-service`) until published.
- **Fixes the shipped price strings first** (§6.1 Defect 2): either remove `'$99/month'` / storage labels until a billing path exists, or make them true. Recommended: remove — the code comment at `tierLimits.ts:6-13` already says why enforcement is off, and a displayed price with no billing path is the same class of untruth the landing page deliberately avoids.
- **Ties any published band to the storage/egress cost test** the program requires before committing to the 50GB target (§8) — a price band that is not economically survivable is a different kind of false claim.
- **Publishing is DG-7.** Not a code decision.

### 6.4 Acceptance tests (G6)

- **AT-G32** `verify-marketing-claims` recomputes the template / checklist-point / hold-point counts from the seeders and exits non-zero when they differ from the strings in `LandingPage.tsx`.
- **AT-G33** The register contains a row for every numeric claim on the landing page (asserted by a test that scans the page for digit-bearing claim strings and cross-checks the register).
- **AT-G34** With `PRICING_PAGE_ENABLED` unset, `/pricing` 404s and does not appear in `sitemap.xml`.
- **AT-G35** No price string renders anywhere in the app while `TIER_QUOTA_ENFORCEMENT_ENABLED` is false (a grep-assertion test, same shape as AT-G18).

---

## 7. Security engineering (program §7)

| # | Surface | Threat | Control | Test |
|---|---|---|---|---|
| 1 | `RevisionIssue` / `RevisionAcknowledgement` (new query surfaces) | Cross-tenant read of another company's revision history | `projectId` scoping on every query, mirroring the drawings access gate (`backend/src/routes/drawings/access.ts`) | **AT-G5** tenant-isolation test |
| 2 | `LotGoverningRevision` | Linking a lot to a revision in another project | Same-project assertion copied from `requireSupersededByInProject` (`drawings.ts:36-65`) | **E7** |
| 3 | Revision **file upload** (a new revision carries a new file) | Malicious upload; content-type spoofing | **Reuses the shipped drawings upload path** (`drawings.ts:324-458`) — G1 adds **no new upload surface**. Malware scanning / file-type validation posture is inherited, not re-implemented | Existing drawings upload tests |
| 4 | Template **compare** endpoint | Existence disclosure of another company's templates via `against=<id>` | 404 not 403 on cross-tenant | **AT-G15** |
| 5 | Acknowledgement | Repudiation ("I never acknowledged that") | Actor identity from session, never the body (the `parseProductEventItem` precedent, `backend/src/lib/productEvents.ts:84-89`); `acknowledgedAt` immutable once set; rows never deleted (**E6**) | **AT-G6** |
| 6 | Acknowledgement of an **external** recipient | Link possession ≠ identity (program §7) | **G1 ships no external acknowledgement link.** External identity is Wave E's problem and Wave E's threat model owns it. Deferred, stated, not silently skipped | — |
| 7 | NCR analytics exposure | Subcontractor sees another subcontractor's repeat-offender data | Nothing in G5 is exposed to `subcontractor` / `subcontractor_admin`; the analytics route is office-role-gated | **AT-G31** |
| 8 | New **exports** (compare output, analytics CSV, format-configured PDFs) | Permission bypass on export routes | Permission test for every new export (program §7 standing requirement) | Per-increment |
| 9 | Marketing claims script | None — reads seeders and source, writes nothing, touches no DB | Read-only by construction | — |
| 10 | Prompt injection | **Not applicable to Wave G.** No new AI extraction surface is introduced; G5 explicitly forbids AI-authored template changes (§0.3.5) | — | — |

**Threat-model artifact:** program §7 gates a dedicated threat model before A3, C2, D2 and E — Wave G is **not** on that list, and this section states why: no new upload surface (row 3), no new external link (row 6), no new AI ingestion (row 10). The three genuinely new things are query surfaces and one non-repudiation record, all covered by the standing tenant-isolation and permission-test requirements. **If DG-3 turns out to require an external acknowledgement link, that reverses this judgement and a threat model becomes a build-blocking artifact for that phase.**

---

## 8. Scale and performance (program §8 — percentile, device, network, dataset)

Measured against the defined production-like reference dataset (5,000 lots, 10,000 map features, 50GB evidence, 10k-row registers). Benchmarks follow the shipped convention: a script under `backend/scripts/bench-*.ts` driving real route handlers over supertest against a local disposable Postgres, with results committed to `backend/scripts/bench-results/` (`backend/scripts/bench-f05.ts:1-30` is the worked example).

| # | Path | Target | Conditions |
|---|---|---|---|
| P1 | Lot readiness **with** the superseded-revision input added | **p95 < 1.2× the pre-G1 baseline**, measured on the same dataset before and after | Server-side, 5,000-lot dataset. A relative target because the absolute number is owned by F0.5 and must not be restated here |
| P2 | `GET /api/itp/templates/:id/compare` | **p95 < 500ms** for two templates of 100 checklist items each | Server-side |
| P3 | Revision timeline for a record with 50 revisions | **p95 < 800ms** | Server-side |
| P4 | NCR analytics at 5,000 NCRs/project | **p95 < 2s** | Server-side. **The current implementation will not meet this**: `ncrAnalytics.ts:93-108` loads every matching NCR into memory and aggregates in JS with no pagination. G5 must move the breakdowns to SQL `groupBy` — the pattern already exists in the sibling report route (`backend/src/routes/reports/ncrRoutes.ts:84-104`). Recurrence grouping may stay in JS if bounded |
| P5 | PDF byte-determinism suite | **< 30s wall clock** for all eight generators × 2 renders in CI | Real jsPDF, no mock — this is new CI cost and it is the price of the guarantee |
| P6 | Map toolbar at 10k features, grouped | **no frame-rate regression** vs the pre-G3.2 baseline on the reference mid-tier Android over 4G | Program §8 device/network conditions |

**Production monitoring:** the shipped in-memory request metrics (`backend/src/middleware/requestLogger.ts:30-184`, p95/p99/slow per endpoint — volatile, resets on restart) cover the new routes automatically. Add Sentry breadcrumbs on `RevisionIssue` creation failures. **G3/G6 UX outcomes cannot be monitored today**: `product_events` has exactly **four** registered events, all one lot-create funnel (`backend/src/lib/productEvents.ts:33-38`, emitted only at `frontend/src/pages/lots/components/CreateLotModal.tsx:185,203,243,250`), **no read surface of any kind** (the only route is the write path, `backend/src/routes/productEvents.ts:34-56`), and 180-day retention (`backend/src/lib/dataRetention.ts:49`). The field shells `/m/*` and `/p/*` emit nothing at all (`frontend/src/lib/productEvents.ts:6-8`). **G3 must register its own funnel events and G6 must not claim any adoption metric until a read surface exists** — see DG-8.

---

## 9. Phasing, dependency edges, and gates

```
G1 (revision governance model)  ──┬──> G2 (ITP provenance + compare)  ──> G5 (learning loop)
                                  └──> G4b (client formats: certificate semantics need G2's authority data)

G3.1 (lot tab a11y)      ── independent, ships immediately, no gate
G3.2 (map toolbar)       ── independent  [JAY-GATE: MOCKUP + SHELL]
G3.3 (sync unification)  ── BLOCKED      [JAY-GATE: SHELL] + folds into offline-sync-centre spec
G3.4 (first-task onboard)── independent  [JAY-GATE: MOCKUP]

G4a (determinism + regression) ── independent, ships immediately
G4c (client acceptance)        ── needs a counterparty  [JAY: design partner]

G6a (fix shipped price strings + claims register + CI check) ── independent, ships immediately
G6b (pricing page)             ── built, publishing  [JAY-GATE: DG-7]
```

| Increment | Size | Starts | Exit-gate evidence |
|---|---|---|---|
| **G1** | M | On acceptance of this spec | AT-G1…G7 green · 3 migrations applied to prod · one record issued + acknowledged on a demo project, screenshotted |
| **G2** | M | After G1 exit | AT-G8…G15 green · migration applied · one seeded template showing full provenance · one compare screenshot · snapshot backfill run with counts reported |
| **G3.1** | S | Immediately | AT-G16 green in e2e |
| **G3.2** | S–M | On mockup + shell go | AT-G17 green · 390px screenshot |
| **G3.3** | M | On shell go only | Deferred to the offline sync-centre spec |
| **G3.4** | S–M | On mockup go | AT-G19 green |
| **G4a** | M | Immediately | AT-G20…G23 green · CI runtime recorded against P5 |
| **G4b** | S–M | After G2 | AT-G24, AT-G25 green |
| **G4c** | — | Needs counterparty | Written client acceptance, or the list of what they changed |
| **G5** | M | After G2 exit | AT-G26…G31 green · P4 benchmark committed to `bench-results/` |
| **G6a** | S | Immediately | AT-G32, AT-G33, AT-G35 green · register committed · CI check wired |
| **G6b** | S | Built now, published on DG-7 | AT-G34 green |

**Pilot acceptance owner: Jay** for every increment (program §5.5 — no other counterparty exists yet).

**Rollback:** every increment is a flag flip. All migrations are additive and are **not** rolled back — the standing rule. G4a is the one increment with no flag: determinism is a correctness fix, and reverting it means reverting the commit.

---

## 10. Honest unknowns

1. **[UNKNOWN]** Whether the landing page's `116 templates · 3,070 checklist points · 813 hold points` matches the shipped seeded library. The public breakdown omits WA (5 seeder files) and the national WSA/AUS-SPEC group (2 files). Resolved by building AT-G32 — which is the argument for building it first.
2. **[UNKNOWN]** Whether the spec editions cited in the seeder headers are still current. Program §10 lists TMR/DIT-SA/MRWA numeric frequencies as unverified and carries revalidation dates. G2 persists what the seeders assert; it does not raise any claim's evidence grade.
3. **[UNKNOWN]** Whether any real client wants a format CIVOS does not already emit. G4b generalises a mechanism on the assumption they will; that assumption is untested (DG-6).
4. **[UNKNOWN]** Whether contractors acknowledge drawing revisions in a way that maps to `notifiedAt / openedAt / acknowledgedAt`. The three-state split is derived from the shipped `HoldPointReleaseToken` pattern, not from customer research. No research report in `docs/research/` covers document distribution practice (searched).
5. **[UNKNOWN]** How lots should be linked to governing revisions — manually, by spec-reference match, or spatially. DG-3. Manual linking is specified because it is the only option that cannot be wrong.
6. **[VERIFY BEFORE BUILD]** The exact write-role set on drawings (`backend/src/routes/drawings/access.ts`) that §1.4 mirrors. Owner: implementing agent, at build time.
7. **[VERIFY BEFORE BUILD]** The status of `docs/plans/offline-sync-centre-spec-2026-07-28.md` and whether G3.3 is subsumed by it. Owner: orchestrator, before scheduling G3.3.
8. **[UNKNOWN]** Whether the entry pricing band is economically survivable at the 50GB evidence target. Program §8 requires a storage/egress cost test before committing; it has not been run. Blocks DG-7, not G6a.

---

## 11. Decisions for Jay

**DG-1 — Do specifications, approved methods and client directions get their own registers, or do they ride on the documents module?**
The drawings register is a first-class page; documents are a generic grid with a version modal. Four new registers is a lot of UI for records that may be uploaded twice a year.
*Recommendation:* ride on documents with a `governedType` facet and one shared revision timeline component. Build a dedicated register only for whichever type a pilot actually issues weekly. Cheaper, and it defers a UI decision until there is evidence for it.

**DG-2 — Acknowledgement: required, or recorded?**
Does a superseded document *block* anything if the foreman never acknowledged, or is non-acknowledgement just visible?
*Recommendation:* recorded, never blocking. Blocking work because someone did not click a button is how software gets worked around. §1.7 E1/E4 are written this way.

**DG-3 — How does a lot get linked to its governing drawing revision?**
Manual selection, or inferred (by spec reference, chainage overlap, or activity)?
*Recommendation:* manual for G1. Inference needs the spatial data model and would produce confident wrong links. If inference is wanted later it becomes an AI proposal through the existing review queue, not an automatic write. Note: if the answer involves external parties acknowledging, §7 row 6 reverses and a threat model becomes build-blocking.

**DG-4 — Lot workspace: 7 tabs → 5, and the map toolbar grouping.** Both are mockup calls. Mockups go to you before any build; naming them here so they are not a surprise.

**DG-5 — Shell go for sync-state unification (G3.3).** Same request A5 made and did not get. Still blocked. It touches `frontend/src/shell/components/syncChipState.ts` — the canonical enum lives in the frozen shell, so there is no non-shell version of this fix.

**DG-6 — Build G4b (configurable formats) now, or wait for a client to reject something?**
*Recommendation:* build the mechanism (it is small and G2 supplies the data), ship it flagged off. Do not add formats speculatively. A format nobody asked for is a maintenance liability with a testing cost.

**DG-7 — Publish the pricing page?** Program §5.1 says the band is a hypothesis and adoption is your call. Independent of that: **the `$99/month` string ships in the product today** (`companySettingsData.ts:160`) while quota enforcement is off. That is a truth defect regardless of what you decide about publishing. *Recommendation:* remove the price strings now, decide publishing separately.

**DG-8 — Does G3 get instrumentation, or ship blind?**
`product_events` has four events and no read surface (§8). Without a funnel and a way to query it, no G3 claim about improved task completion can be substantiated — and program §6's adoption metrics need it.
*Recommendation:* G3.1 adds one funnel and one minimal read surface (an admin query endpoint, not a dashboard). Otherwise G3 ships on taste alone and the wave's own exit gate cannot be evidenced.

---

## 12. Delivery-control checklist (program §9 — all thirteen items)

| # | Item | Where |
|---|---|---|
| 1 | Included / excluded behaviour | §1.6, §2.2, §3, §4.2–§4.4, §5.3, §6.2–§6.3 |
| 2 | Schema and data flow | §1.3 (3 models + 1 column), §2.2 (8 columns), §5.3 (1 FK) |
| 3 | Permission matrix | §1.4, §2.3; §7 rows 7–8 |
| 4 | Edge cases | §1.7 (E1–E8), §2.2(d), §4.2 step 4, §5.2 |
| 5 | Migration plan | §1.5, §2.4, §5.4 — reviewed Prisma migrations, all additive; prod apply is the orchestrator's job pre-merge; never `db push`, never `--accept-data-loss` |
| 6 | Security threats (§7) | §7 — including the stated reason no dedicated threat-model artifact is gated, and the condition (DG-3) that reverses it |
| 7 | Performance tests (§8, reference dataset) | §8 — P1–P6, with P4 flagged as a target the current implementation fails |
| 8 | Feature flag + rollout | §1.9, §2.4, §3.5, §4.3, §5.4, §6.3 — env-var `*_ENABLED` convention per `backend/src/lib/readiness/recordDecision.ts:237` |
| 9 | Rollback / recovery | §9 — flag flip per increment; additive migrations not rolled back; G4a is the one unflagged increment and why |
| 10 | Acceptance tests | AT-G1…AT-G35, in §1.8, §2.4, §3.5, §4.5, §5.4, §6.4 |
| 11 | Pilot acceptance owner | §9 — Jay for every increment; G4c additionally needs a named external client |
| 12 | Production monitoring | §8 — existing request metrics cover new routes; the `product_events` gap is DG-8 |
| 13 | Exit-gate evidence | §9 table, per increment |

---

## Sources

**Program:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` (Rev 1.2a) §2 (F0, F1), §3 (Wave G), §4, §5, §6, §7, §8, §9, §10, §11.
**Evidence register:** `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md`.
**Repo docs:** `docs/plans/f0-execution-spec-2026-07-24.md` · `docs/plans/a5a6-gap-survey-2026-07-25.md` · `docs/plans/a4-my-work-design-2026-07-26.md` · `docs/plans/wave-b-migration-importer-spec-2026-07-26.md` · `docs/plans/wave-f-claim-readiness-spec-2026-07-31.md` · `docs/plans/offline-sync-centre-spec-2026-07-28.md` · `docs/research/wave2-itp-matching-taxonomy-spec-2026-07-15.md`.
**Code:** every `file:line` above, read at `f944c39a`.

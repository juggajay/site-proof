# Wave G Execution Specification — Revision Governance + UX Stages 2–4 + Market Surface

**Date:** 31 July 2026 · **Rev 2** · **Status:** G1 and G2 build-ready on acceptance. G3 phases each need a mockup pass (**one** needs Jay's shell go; G3.3 no longer does — see §3.3). G4a build-ready; G4b needs a counterparty; G4d (pagination) is scoped-but-unscheduled. G5 build-ready after G1. G6 buildable now, **publishing** and **new public numbers** Jay-gated.

**Specified against:** `f944c39a` (`origin/master`, 31 Jul 2026 — "chore(bench): idle-box re-run — the owed C1 evidence, all targets pass (#1709)"). **Rev 2 re-read every load-bearing citation at `1e6ed156`** (the Rev 1 merge commit, #1714) and they all still resolve; the §3.3 survey and the §6 counts were re-derived there from scratch. **Re-verify line numbers at build time and stamp the fresh SHA in the PR body** — the standing rule from `docs/plans/f0-execution-spec-2026-07-24.md:136`.

**Rev 2** folds an adversarial review of Rev 1 (5 blockers, 11 amendments, 5 notes). Every change is tagged with its review id in-line, and §13 is the full disposition — including the four places the review was itself wrong and what the re-derivation found instead. Rev 1's §11 numbering is preserved; **DG-5 is deleted, not renumbered**.

**Acceptance-test numbering.** Wave G uses a prefixed `AT-G1…AT-G35` namespace, not the shared integer series. **This releases the reservation C5 made on its behalf** (`docs/plans/wave-c5-survey-material-traceability-spec-2026-07-31.md:23`, which holds `AT-157…AT-169` for Wave G and D1c.1): Wave G takes none of them, and any future spec may allocate 157–169 freely. **[GR-N1]**

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

**Finding 3 — a PDF visual-regression suite is currently impossible, and Rev 1 named only half the cause. The other half lives inside jsPDF and no amount of argument-threading reaches it. [GR-B1]**

The half Rev 1 found: `drawPdfFooters` (`frontend/src/lib/pdf/branding.ts:320-345`) stamps `Page X of Y · Generated {ts} · {docRef}` onto **every page of all eight documents**, and `{ts}` is `new Date(opts.generatedAt).toLocaleString('en-AU', …)` (`:324`) with no `timeZone`. All eight generators pass `generatedAt: new Date()` (e.g. `frontend/src/lib/pdf/conformanceReportPdf.ts:915`, `dailyDiaryPdf.ts:620`, `docketDetailPdf.ts:483`, `ncrDetailPdf.ts:398`, `testCertificatePdf.ts:299`). Two renders of identical data one minute apart differ on every page; the same data renders different dates in Sydney and London. Separately, all 39 characterization tests mock jsPDF away (`vi.mock('jspdf', …)`, e.g. `frontend/src/lib/pdf/__tests__/pdfGenerator.characterization.test.ts:28`), so **no frontend test produces a single PDF byte**.

**The half Rev 1 missed: jsPDF randomises the file ID and stamps a wall-clock `/CreationDate` at construction, before any generator code runs.** Verified by extracting the published `jspdf@4.2.1` tarball (npm shasum `6ba0d263…`) and reading `dist/jspdf.node.js`; also confirmed at runtime against a real install:

- `:4114` — the constructor calls `setFileId()` **with no argument**. `:1394-1410` — with no argument it rebuilds a 32-character string from `"ABCDEF0123456789".charAt(Math.floor(Math.random() * 16))`. `:3765` writes it into the trailer as `out("/ID [ <" + fileId + "> <" + fileId + "> ]")`. **Two renders of byte-identical input differ every time, with no clock involved at all.** No pinned `generatedAt` can fix this.
- `:4113` — the constructor calls `setCreationDate()` with no argument → `:1492-1494` `date = new Date()` → `:3688` `out("/CreationDate (" + … + ")")`. Entirely independent of what a generator passes as `generatedAt`.
- `convertDateToPDFDate` (`:1450-1471`) builds that string from `parmDate.getTimezoneOffset()` (`:1454`) and local `getFullYear/getMonth/getDate/getHours/getMinutes/getSeconds` (`:1462-1467`). **So even a fully pinned instant yields a different `/CreationDate` under `TZ=UTC` than under `TZ=Australia/Sydney`** — AT-G22 would fail for a reason §4.2 Step 2's `localDate.ts` routing structurally cannot reach, because the formatting happens inside the library.
- There are zero calls to `setFileId` or `setCreationDate` anywhere in `frontend/src/lib/pdf/`.

The precedent Rev 1 leaned on does not transfer. `folioRenderer.ts:415-426` pins `CreationDate`/`ModDate` through **pdfkit**'s `info:` option (`backend/package.json:75`, `pdfkit ^0.19.1`). jsPDF is a different library with a different knob, and Rev 1 never named it. Left unstated, G4a's exit gate is red on day one and presents as flaky-looking byte diffs that a build agent will chase into the harness before finding a `Math.random()` inside a dependency.

**The knob, exactly.** Both setters are public on the instance — `API.setFileId` (`:1431-1434`) and `API.setCreationDate` (`:1523-1526`). §4.2 Step 0 specifies their use. Two library behaviours the call must respect, both verified at runtime:

1. `setFileId` accepts only `/^[a-fA-F0-9]{32}$/` and **uppercases what it stores** (`:1402`). A non-matching value does **not** throw — it silently falls through to the random branch. **The pinned literal must therefore be 32 uppercase hex characters**, so input and emitted trailer are identical and a typo cannot degrade to random without failing loudly. AT-G20 is what makes a typo fail loudly.
2. `setCreationDate` takes either a `Date` — which runs the timezone-dependent formatter — or a pre-formatted `D:` string, which is stored **verbatim** and skips the formatter entirely (`:1496-1503`, regex at `:1491`). Passing the string, not a `Date`, is the half that makes AT-G22 achievable. The regex requires `D:YYYYMMDDHHmmss±HH'mm'` with the year in 1970–2037, and an optional trailing `'`.

The determinism *harness* precedent still holds and is still what G4a copies: `folioRenderer.test.ts:41-51` asserts `first.equals(second)` on two renders, with a mutation guard at `:53-67` so a constant renderer cannot pass.

### 0.3 Standing boundaries this wave must not cross

Reproduced so this document is self-contained (program §6):

1. **SHELL FREEZE.** Any change under `frontend/src/shell/**` or global chrome requires Jay's explicit go (program §5.4). Phases affected are named in §3 and marked **[JAY-GATE: SHELL]**. All other UI phases require mockups/screenshots to Jay before build — **[JAY-GATE: MOCKUP]**.
2. **`frontend/src/lib/pdf/**` is a complexity hotspot under a standing DON'T-REFACTOR rule.** G4 **characterizes** existing output and layers configuration on top. It does not restructure the generators. G4a needs exactly two exceptions, both argument-shaped, both bounded in §4.2: pinning `generatedAt` at the eight call sites, and one `pinPdfIdentity(doc, …)` line immediately after each of the eight `new jsPDF()` constructions **[GR-B1]**. Neither moves, splits or reorders any generator body. **G4d (§4.6) is the one increment that widens this boundary, and it is separately scheduled and separately gated (DG-10) precisely so the widening is a decision rather than a drift. [GR-A1]**
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

`RevisionAcknowledgement` also carries a **XOR check constraint**, added in the same migration and written by hand into the migration SQL (Prisma has no `@@check`): **[GR-A10]**

```sql
ALTER TABLE revision_acknowledgements
  ADD CONSTRAINT revision_ack_recipient_xor
  CHECK ((user_id IS NULL) <> (recipient_email IS NULL));
```

Without it a row addressed to nobody — `(null, null)` — is insertable, unconstrained and duplicable, on the exact table §7 row 5 and AT-G6 lean on for non-repudiation. The two `@@unique` pairs behave correctly under Postgres NULL semantics already (nulls compare distinct, so internal rows do not collide on `recipientEmail`); the XOR is what closes the addressed-to-nobody row.

**Tenancy decision: `RevisionIssue.projectId` stays REQUIRED, and the global ITP library does not use this table. [GR-B3]**

The review is right that Rev 1 contained a contradiction: `ITPTemplate.projectId` is `String?` (`schema.prisma:672`) and every seeded library row writes `projectId: null` (`seed-itp-templates-wa-structures.js:286-300`), while §2.2(f) told a seeder — which has neither a project id nor a user session — to "record a `RevisionIssue`" against a required `projectId` and a required `issuedById`. That row cannot be inserted.

The review offered two fixes. **Rev 2 takes neither**, and states why:

- **(a) nullable `projectId` + partial indexes + nullable `issuedById` paired with a required `issuedByLabel`.** This makes a company-less, project-less, operator-authored row legal in the *shared* table, which means every one of the table's queries acquires a null branch, §7 row 1's "`projectId` scoping on every query" stops being literally true, and AT-G5's tenant-isolation assertion has to reason about rows that belong to no tenant. That is a permanent tax on the shared governance surface, paid to accommodate one entity type.
- **(b) a second supersession table for the global library.** A whole table, a second timeline renderer and two code paths for "what governs this", for a fact that changes a few times a year.

**(c), taken:** the global library already has its supersession chain — `ITPTemplate.supersededById`, added in §2.2(a) — and it needs no issue record, because there is nobody to issue *to*. `RevisionIssue` exists to record **issue and distribution to named recipients inside a project**. A library edition change is a library fact, not a transmittal. G2(f) therefore writes `supersededById` plus two more nullable columns on `ITPTemplate` (§2.2(f)) and **no `RevisionIssue` row**, and projects learn about the new edition through the computed "newer edition available" notice, which reads the chain directly.

Why this is the smallest correct answer: global-scope is a **one-model problem, not a shape problem**. Of the five governed classes, only `itp_template` has a project-less variant — drawings always carry `projectId` (`schema.prisma:1750-1772`), and specifications, approved methods and client directions are `Document` rows, which always carry one. Rewriting the shared table's tenancy for a single entity type is disproportionate to it. A **project-scoped** ITP template (a controlled copy, which is what a project actually inspects against) is unaffected: it has a real `projectId`, and its revisions record `RevisionIssue` rows exactly like a drawing's.

Consequence to hold at build time: `entityType: 'itp_template'` on a `RevisionIssue` always refers to a **project-scoped** template. AT-G36 asserts it.

**(b) Per-class supersession columns copying `Drawing`'s shape.** `Drawing` needs no change. Each new governed class gets `supersededById String?` + self-relation + `@@index([projectId, supersededById])`, matching `schema.prisma:1759-1770` exactly. `Document` gains `supersededById` alongside its existing `isLatestVersion` — the two answer different questions ("is this the newest upload of this file" vs "has this been formally replaced by an issued revision") and G1 does not merge them.

**(c) The lot ↔ governing-revision edge, which is the whole point.**

```prisma
model LotGoverningRevision {
  id             String   @id @default(uuid())
  lotId          String   @map("lot_id")
  projectId      String   @map("project_id")      // denormalised from the lot — see below
  entityType     String   @map("entity_type")
  entityId       String   @map("entity_id")
  revisionLabel  String   @map("revision_label")  // denormalised, frozen at link time
  linkedAt       DateTime @default(now()) @map("linked_at")
  linkedById     String?  @map("linked_by_id")
  unlinkedAt     DateTime? @map("unlinked_at")    // never deleted — history is the product

  lot      Lot   @relation(fields: [lotId], references: [id], onDelete: Cascade)
  linkedBy User? @relation(fields: [linkedById], references: [id], onDelete: SetNull)

  @@index([lotId, unlinkedAt])
  @@index([projectId, entityType, entityId])
  @@map("lot_governing_revisions")
}
```

Plus one partial unique index, hand-written in the migration SQL (Prisma cannot express a partial unique): **[GR-A5]**

```sql
CREATE UNIQUE INDEX lot_governing_revision_active_uniq
  ON lot_governing_revisions (lot_id, entity_type, entity_id)
  WHERE unlinked_at IS NULL;
```

Rows are **never hard-deleted**; unlinking sets `unlinkedAt`. `revisionLabel` is denormalised deliberately so a folio can print what governed the work without a live join surviving.

Three fixes Rev 2 makes here, all from **[GR-A5]**:

- **`projectId` is denormalised onto the row.** Rev 1's model had no tenancy column and no FK on `entityId`, which left E7 ("a lot links to a revision of a record in another project → 400") requiring a polymorphic resolution of `entityId` across five tables that was never specified and, with no FK, has no cheap implementation. Carrying `projectId` makes E7 a single comparison against the lot's own project at write time, and makes every read query scope the same way every other table in the codebase does. The `Comment` precedent (`schema.prisma:2067-2088`) remains the model for the *keying*; `Comment` simply never had to answer a cross-tenant question about its `entityId`, so its lack of a project column is not a precedent for omitting one here.
- **The partial unique gives AT-G3 something to assert on.** Rev 1 promised "exactly one readiness item" while nothing prevented two active rows for the same `(lotId, entityType, entityId)`.
- **`linkedById` gains its `User` relation and an explicit `onDelete`,** matching `RevisionIssue.issuedById`'s deliberateness. `SetNull` rather than `Restrict` because a link is an administrative act, not a contractual assertion — unlike an acknowledgement (E6), losing the actor does not destroy evidence.

**(d) The warning plugs into the shipped readiness engine, not a new one.** Add one code to `backend/src/lib/readiness/contracts/reasonCodes.ts` (the header at `:1-21` requires provenance in the same change or the contract test fails), emit `{severity: 'warning', area: 'document', code: 'governing_revision_superseded'}` from `evidenceReadiness.ts`. **Cost warning:** `evidenceReadiness.ts` is pure and imports no Prisma; all three callers (`backend/src/routes/claims/readRoutes.ts:262`, `backend/src/routes/lots/qualityRoutes.ts:334`, `backend/src/routes/projectCloseoutReadiness.ts:91`) must be taught to fetch and pass the new input. That plumbing, not the item, is the real work.

### 1.4 Permission matrix (G1)

| Action | owner | admin | project_manager | quality_manager | site_manager | foreman | site_engineer | subcontractor* | viewer |
|---|---|---|---|---|---|---|---|---|---|
| View revision history of a governed record | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| **Issue a revision — `drawing`** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Issue a revision — `itp_template` (project-scoped)** | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Issue a revision — `specification` / `approved_method` / `client_direction`** | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Issue a revision — `itp_template` (global library)** | operator-only, via the seeder with `--execute`. No role, no API route, no session. (§2.3) | | | | | | | | |
| Record distribution recipients | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Acknowledge a revision addressed to me | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Link/unlink a lot's governing revision | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| See the superseded-document warning on a lot | inherits existing lot-readiness visibility (`evidenceReadiness.ts` + `filterCommercialReadiness :458`) | | | | | | | ✗ | ✓ |

\* Nothing in G1 is exposed to `subcontractor` / `subcontractor_admin`.

**Issue rights are per-class, and each row is a decision with a stated shipped precedent — not a `[VERIFY BEFORE BUILD]`. [GR-B5]**

Rev 1 had one collapsed "Issue a revision" row (owner/admin/PM/QM) with a footnote instructing the build agent to instead *"read `backend/src/routes/drawings/access.ts`'s exact role set at build time and match it"*. Those two instructions are incompatible, and Rev 2 removes the choice. The actual shipped sets, read at `1e6ed156`:

| Class | Role set | Shipped precedent | Is this a change? |
|---|---|---|---|
| `drawing` | owner, admin, project_manager, quality_manager, site_manager, site_engineer, **foreman** | `DRAWING_WRITE_ROLES`, `backend/src/routes/drawings/access.ts:4-13`, enforced on the supersede route via `requireDrawingWriteAccess` (`drawings.ts:365-370`) | **No — deliberately keeps current behaviour.** Superseding a drawing is a foreman-permitted action in shipped code today. Rev 1's narrower row would have been an uncovered regression on a live route. |
| `itp_template` (project-scoped) | owner, admin, project_manager, quality_manager, site_manager | `TEMPLATE_MANAGER_ROLES`, `backend/src/routes/itp/templateAccess.ts:9-15`, enforced at `:58-66` | **No.** Matches the shipped gate for managing a project's templates. |
| `specification`, `approved_method`, `client_direction` | owner, admin, project_manager, quality_manager, site_manager | **New action — no shipped precedent to match.** Adopts `TEMPLATE_MANAGER_ROLES`. | New capability; nothing to regress. |

Two things worth being explicit about, because a build agent will otherwise reach for the wrong constant:

1. **The drawings row is wider than the others on purpose.** It admits foreman and site_engineer because shipped code already does. Narrowing it is a product decision Jay has not been asked for, and it is not smuggled in under a governance feature.
2. **The Document-backed classes deliberately do NOT copy `DOCUMENT_WRITE_ROLES`** (`backend/src/routes/documents/access.ts:39-49`), even though specifications and client directions are `Document` rows. That set includes `subcontractor_admin` and `subcontractor` — it is an **evidence-upload** gate (note `DOCUMENT_SPECIAL_PORTAL_CATEGORIES` immediately below it), not a governance gate. Issuing a revision of a specification is not uploading evidence, and G1 exposes nothing to subcontractors.

Note for whoever eventually tidies this: `backend/src/lib/roles.ts:78` defines `ROLE_GROUPS.QUALITY` = owner/admin/PM/QM, and **neither** the drawings gate nor the template gate uses it — both hardcode their own arrays. Wave G matches the shipped arrays rather than the unused constant, and does not refactor them. If someone wants one governance role-set constant, that is its own PR with its own regression surface.

### 1.5 Migration plan (G1)

Three reviewed Prisma migrations, each independently deployable, none destructive:

1. `add_revision_issue_and_acknowledgement` — two new tables, no changes to existing ones, **plus the hand-written `revision_ack_recipient_xor` CHECK constraint** (§1.3(a)). Additive.
2. `add_supersession_to_governed_documents` — `documents.superseded_by_id` nullable + self-FK `SetNull` + index. Additive, all-null on apply.
3. `add_lot_governing_revisions` — one new table, **including `project_id` and the hand-written `lot_governing_revision_active_uniq` partial unique** (§1.3(c)). Additive.

Prod apply is the orchestrator's job pre-merge, via the production-migrations workflow. **Never `prisma db push`, never `--accept-data-loss`** (CLAUDE.md operational warnings). No backfill migration: existing drawings keep their `supersededById` chain untouched, and `RevisionIssue` rows are created only from the point of adoption forward — history that was never recorded is not invented. §1.7 E5 covers how the UI says so.

**This migration list pre-answers DG-1, and says so. [GR-A7]** Migration 2 adds `documents.superseded_by_id` — that is the *ride-on-documents* branch, which is also §11's recommendation. Stated plainly so DG-1 remains a real decision: **if Jay chooses dedicated registers instead, migration 2 is replaced by N new tables and G1 re-sizes from M to L.** Nothing else in §1 changes; the `RevisionIssue` / `LotGoverningRevision` pair is register-shape-agnostic by design.

**One piece of unscoped work on G1's critical path, now scoped. [GR-A7]** §1.3(a)'s `entityType` vocabulary names `'specification' | 'approved_method' | 'client_direction'`. Re-derived at `1e6ed156`, Rev 1 (and the review) overstated the gap: `DOCUMENT_TYPES` (`frontend/src/pages/documents/documentsUploadData.ts:42-54`, 11 entries) **already contains `'specification'` at `:43`**. Only `approved_method` and `client_direction` are missing — two entries to add. The backend field is `Document.documentType` (`schema.prisma:1684`), an **unconstrained `String`** with no enum and no check; G1 does not add one (constraining a live free-text column is its own migration with its own backfill risk), so the vocabulary stays frontend-enforced exactly as it is today. That is a known limitation carried forward, not a new one introduced. Cost: two array entries, no migration.

### 1.6 Included / excluded (G1)

**Included:** revision issue + supersession for drawings (existing chain, now audited and issue-recorded), specifications, ITP templates, approved products/methods, client directions; recipient list + notified/opened/acknowledged; lot→governing-revision links; the computed superseded warning; a revision timeline view per governed record.

**Excluded, with owner:** transmittal PDF generation (G4, if a client asks); external (no-account) acknowledgement links — Wave E owns external-link identity and its threat model, and G1 must not open a second external surface (§7); automatic inference of which lots a drawing governs (needs spatial or spec-reference matching — DG-3); document approval workflows (not in the program); **natural keys (number + revision columns) for the three `Document`-backed governed classes — owner: whichever pilot first issues one weekly, per DG-1. Until then those classes get the E9 UI warning instead of a database constraint, and E2/AT-G7 do not cover them. [GR-A6]**

### 1.7 Edge cases (G1)

| # | Case | Behaviour |
|---|---|---|
| E1 | Revision issued while a hold-point package is out for release | Package is **not** invalidated. The lot readiness gains the `governing_revision_superseded` warning and the hold-point detail shows "issued under REV B; REV C issued {date}". Retroactively voiding a decision someone already made would violate the quality-and-audit standard (program §6). |
| E2 | Two users issue a revision of the same record concurrently | Second write fails. **Scoped to `drawing` and `itp_template` only** — see the note below. Enforced for drawings by the existing `@@unique([projectId, drawingNumber, revision])` (`schema.prisma:1768`); the supersede handler already row-guards "only a current revision can be superseded" (`drawings.ts:371-374`) — reuse that guard verbatim. Status codes: **400 from the pre-check, 409 from the true race** (AT-G7). |
| E3 | Supersession with no reason given | Rejected, 400. `reason` is required on any `RevisionIssue` where `supersedesId != null`. First issues may omit it. |
| E4 | A superseded record is a lot's governing revision and the lot is already conformed | Warning shows on the lot but **does not block** anything and never appears on the folio as a defect. Conformance already happened; the record states what governed it. |
| E5 | Records that pre-date G1 (no `RevisionIssue` row) | Timeline renders "No issue record before {adoption date}" rather than implying none occurred. Never presented as "never issued". |
| E6 | Acknowledgement from someone removed from the project | Retained. `RevisionAcknowledgement.userId` is `SetNull`; the row keeps `acknowledgedAt`. Deleting the fact that someone acknowledged would be evidence destruction. |
| E7 | A lot links to a revision of a record in another project | Rejected, 400. Resolved by comparing the lot's `projectId` against the governed record's, then **persisting it on the link row** (`LotGoverningRevision.projectId`, §1.3(c)) so every later read scopes without a polymorphic lookup. Same-project check mirrors `requireSupersededByInProject` (`drawings.ts:36-65`). |
| E8 | `Document` already has `isLatestVersion = false` and is now formally superseded | Both fields set. They are not merged; §1.3(b). |
| E9 | A revision is issued for a governed record with no natural key (specification, approved method, client direction) | **No uniqueness is enforced and none is claimed. [GR-A6]** Drawings have `@@unique([projectId, drawingNumber, revision])` (`schema.prisma:1768`) and ITP templates get one in §2.4; the three `Document`-backed classes have no number+revision pair to constrain, and §1.5's migrations add none. Duplicate-revision detection for those three is a **UI warning on the issue form, not a constraint** — it reads the existing `RevisionIssue` rows for that `entityId` and says "REV C was already issued on {date}". E2 and AT-G7 do not cover them, and §1.6 lists the natural-key work as excluded. |

### 1.8 Acceptance tests (G1)

- **AT-G1** Issuing a revision of a drawing creates a `RevisionIssue` with `supersedesId` = the prior drawing id, sets the prior row's `supersededById`, and writes an audit-log row — closing the gap at `drawings.ts:324-458` where supersede writes no audit entry.
- **AT-G2** A supersession request without `reason` returns 400; a first issue without `reason` succeeds.
- **AT-G3** A lot linked to a now-superseded governing revision produces exactly one readiness item, `severity: 'warning'`, `area: 'document'`, `code: 'governing_revision_superseded'`, and produces **zero** blockers.
- **AT-G4** Conforming a lot whose governing revision is superseded still succeeds (E4).
- **AT-G5** Tenant isolation: a user in project A cannot read, issue against, or link any revision in project B — asserted on every new query surface (program §7).
- **AT-G6** `RevisionAcknowledgement` survives project-user removal with `acknowledgedAt` intact (E6).
- **AT-G7** Concurrent issue of the same revision label on a **drawing**: exactly one succeeds and there is no partial write. **Two distinct paths, two distinct statuses, both asserted: [GR-A8]**
  - *Sequential* (the loser arrives after the winner committed) → the shipped pre-check at `drawings.ts:376-388` catches it and returns **400** `AppError.badRequest('Drawing with this number and revision already exists')`. That is shipped behaviour and Wave G does not change it.
  - *True race* (both pass the pre-check, one loses at the index) → Prisma `P2002` on `@@unique([projectId, drawingNumber, revision])`, mapped to **409 `CONFLICT`** by the existing generic handler at `backend/src/middleware/errorHandler.ts:304-311`. No new mapping is written; the test asserts the existing one fires and that the failed request left no `RevisionIssue` row.

  Rev 1 asserted a bare "409" against a handler that returns 400, which is how an acceptance test gets rewritten to match whatever the code does. The two statuses are inconsistent from a client's point of view, and that inconsistency is **pre-existing and deliberately not fixed here** — collapsing them means touching a shipped route's contract, which is not Wave G's job. It is noted in §10 so it is not rediscovered as a bug.
- **AT-G36** A `RevisionIssue` with `entityType: 'itp_template'` always resolves to a template whose `projectId` is non-null; attempting to issue against a global library template (`projectId IS NULL`) is rejected. Guards the §1.3(a) tenancy decision. **[GR-B3]**
- **AT-G37** `revision_acknowledgements` rejects a row with both `user_id` and `recipient_email` null, and rejects one with both set. **[GR-A10]**
- **AT-G38** Two active `LotGoverningRevision` rows for the same `(lotId, entityType, entityId)` are impossible: the second insert violates `lot_governing_revision_active_uniq`, and re-linking after an unlink succeeds. **[GR-A5]**

### 1.9 Flags, rollout, rollback (G1)

Flag: `REVISION_GOVERNANCE_ENABLED` env var. **All five Wave G flags are opt-IN and default OFF everywhere, including production.** Parse shape, copied from `backend/src/lib/readiness/recordDecision.ts:236-239`:

```ts
const configured = process.env.REVISION_GOVERNANCE_ENABLED?.trim().toLowerCase();
return configured === 'true' || configured === '1' || configured === 'yes';
```

**Rev 1 cited two files as "the shipped convention" and they are opposites. [GR-A2]** `recordDecision.ts:236-239` is opt-**in** (unset → false); `dataRetentionWorker.ts:20-26` is opt-**out** (explicit `'false'/'0'/'no'` disables, and unset falls through to `NODE_ENV === 'production'` → **true in prod**). There is no house convention to cite — only two files that parse the same three truthy tokens and invert the default. Rev 2 therefore cites `recordDecision.ts` alone, reproduces the parse inline, and states the default in words, so `REVISION_GOVERNANCE_ENABLED` cannot ship live to production on an unset variable.

Do **not** copy `recordDecision.ts`'s doc comment along with its code: `:233-234` reads *"default FALSE everywhere, including production"* while the file header at `:27-29` records that the rollout completed on 2026-07-26 and production now runs TRUE permanently. The comment is stale relative to the file it sits in. The *parse shape* is what Wave G reuses.

Off: new routes 404, new readiness code never emitted, existing drawings behaviour unchanged. Rollback = flag off; tables stay (additive migrations are not rolled back — the standing rule).

**Exit-gate evidence:** AT-G1…G7, AT-G36…G38 green · 3 migrations applied to prod · one governed record issued and acknowledged on a demo project with a screenshot of the timeline · **the P1 pre-G1 baseline captured and committed to `backend/scripts/bench-results/` BEFORE the G1 PR merges [GR-N5]**. P1 is a *relative* target ("p95 < 1.2× the pre-G1 baseline"); once G1 is in, there is no way to measure the left-hand side, so the baseline run is a G1 precondition rather than a G1 deliverable. The directory already holds 17 committed result files (`f05-*.json`, `c3-test-coverage-*.json`, `pdf-folio-*.json`) and the naming convention is `{bench}-{ISO timestamp}.json`.

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
  supersededAt     DateTime? @map("superseded_at")      // when — see (f)
  supersededBySeedRun String? @map("superseded_by_seed_run") // which operator seeder run — see (f)
  sourceTemplateId String?   @map("source_template_id") // clone/import lineage — see (c)
```

`supersededById` copies `Drawing`'s shape (`schema.prisma:1759-1770`) and participates in G1's `RevisionIssue` with `entityType: 'itp_template'`.

**Backfill is by seeder edit, not by migration.** Each seeder writes the values its own header comment already states; the migration only adds nullable columns. That keeps the authority claim traceable to the file that cites the source. **[VERIFY BEFORE BUILD]** — the edition strings in the seeder headers were verified against primary sources at seeding time, not at this SHA; program §10 marks TMR/DIT-SA/MRWA numeric frequencies as unverified. G2 **persists what the seeders assert and records where it came from; it does not upgrade any claim's evidence grade.** The revalidation obligation stays with the appendix (owner: Jay/orchestrator, per appendix §A revalidation dates).

**(b) The annexure warning.** A template whose `specificationReference` names a specification that carries project-specific annexures must surface: *"This template follows {spec} {edition}. Project annexures may add or vary requirements — check your contract annexure."* Implemented as a per-template boolean `annexureWarning` plus the shared string; shown on the template card and on the lot's ITP tab. **Not** an AI judgement — a seeder-set flag.

**(c) Corporate-master → project-controlled-copy lineage.** Both copy mechanisms exist and **neither records lineage**: `POST /itp/templates/:id/clone` (`backend/src/routes/itp/templates.ts:290-375`) writes no source pointer — the only tie is the default name `` `${sourceTemplate.name} (Copy)` `` (`:331`) — and `sourceTemplateId` appears **nowhere in the repo** (searched schema, `backend/src`, `frontend/src`). Wave B's import executor states the controlled-copy principle in comments (`backend/src/routes/copilot/import/itpImportDryRun.ts:565-587`) but the created template carries no `importBatchId`; the only path back is a JSON-contains scan of `AiProposal.appliedRecordIds` (`schema.prisma:2123`), unindexed. G2 sets `sourceTemplateId` on clone and on import, and adds `importBatchId String?` to `ITPTemplate` so an imported template is traceable to its source document in one join.

**Also fix two silent data losses on the copy paths**, both one-line: clone drops `ITPChecklistItem.notes` (`templates.ts:338-346`) and so does the import executor (`itpTemplateImportExecutor.ts:166-174`). Clause citations vanish on every copy today.

**And add item-level lineage in the same two diffs, because template-level lineage does not deliver G5. [GR-A3]** `ITPChecklistItem` (`schema.prisma:698-717`) has `id`, `templateId` and **no source, lineage, or timestamp column of any kind** — verified field by field. Clone creates fresh rows (`templates.ts:338-346`), so the same logical checklist item has a different `id` in every project that adopted the template, and `NCR.itpChecklistItemId` (§5.3) therefore aggregates **within one project's copy only**. §5.3's stated payoff — *"this item failed 7 times across 3 subcontractors on `earthworks_bulk`"* — is a cross-project claim that `sourceTemplateId` at template level cannot resolve.

So G2(c) adds one more nullable column, `ITPChecklistItem.sourceChecklistItemId String?`, written at the same two call sites `notes` is being fixed in. It is genuinely cheap — the same `.map()`, one more field — and it is the difference between G5 delivering the wave's stated learning-loop value and G5 delivering per-project recurrence counts. Chains resolve by walking `sourceChecklistItemId` to its root; items with a null pointer (every row created before G2) aggregate as their own root and are reported as such, never merged by description-matching. **Never guess identity from text.**

**(d) Snapshot completeness (the §0.2 Finding-2 fix).** Extend `buildTemplateSnapshot` (`templateSnapshot.ts:39-58`) to capture `notes`, `specificationReference`, `stateSpec`, `authority`, `specEdition`, and a `snapshotAt` timestamp. Characterization first: pin current snapshot output in a test before changing the builder, then assert the new fields. Existing snapshots are **not** rewritten — a lot conformed under the old snapshot keeps exactly the bytes it had.

**The reader must be extended too, and Rev 1's reasoning for why it need not be was wrong. [GR-A4]** Rev 1 claimed the change was safe because *"`parseTemplateSnapshot` already tolerates unknown shapes defensively"*. Read in full at `1e6ed156`, the parser does not tolerate unknown top-level keys — it **reconstructs the object field by field and returns only the five it knows** (`:73-82`: `id`, `name`, `description`, `activityType`, `checklistItems`). There is no spread anywhere in the file. Every new top-level key is silently discarded on read, **including the `backfilledAt` marker AT-G12 asserts on**. Left as written, a build agent adds fields to the builder, the tests read through the parser, and the new metadata evaporates with green tests.

The writer/reader asymmetry is worth naming because it cuts the other way for items: `checklistItems` passes through `.filter()` (`:77-81`), which returns the **original parsed objects**, so item-level keys like `notes` and `specificationReference` *do* survive a round trip — the `ChecklistItem` interface simply will not type them. Meanwhile `buildTemplateSnapshot` `.map()`s each item to an 8-field literal (`:39-58`), so **the writer strips item extras the reader would have preserved.** The builder, the reader, and both the `TemplateSnapshot` and `ChecklistItem` interfaces are all in scope for G2(d).

One more thing found in the same read and carried as a stated limitation: a snapshot that fails to parse — corrupt JSON, or `checklistItems` not an array (`:69-71`, `:83-85`) — returns `null` and falls through to the **live template** at `:97`, silently and with no signal. That is the same historical-integrity hole as the null-snapshot case below, reached by a different route. G2 does not add error surfacing for it (that is a logging change on a hot read path), but the backfill script below must not mistake an unparseable snapshot for an absent one: it selects on `templateSnapshot IS NULL` only, and leaves malformed rows alone for a human.

Also **close the null-snapshot fallback** (`templateSnapshot.ts:97`): a one-off backfill script (not a migration) writes a snapshot for every `ITPInstance` where `templateSnapshot IS NULL`, stamped with a `backfilledAt` marker so it is never mistaken for a genuine assignment-time capture. Instances whose template has since been deleted are left null and render "template no longer available" rather than a fabricated snapshot.

**(e) Version compare.** Reuse `diffChecklistItems` (`backend/src/routes/copilot/import/itpImportDryRun.ts:258-298`) — it already pairs items by normalised description and returns `{added, removed, changed}` (`ChecklistDiff`, `dryRunTypes.ts:44-50`), and the UI already renders that shape (`frontend/src/pages/projects/copilot/ImportReviewPanes.tsx:39-70,343-347`). New endpoint `GET /api/itp/templates/:id/compare?against=<templateId>` returns the same `ChecklistDiff` plus a metadata diff. **No new diff engine, no new UI vocabulary.** The known limitation is already documented at `itpImportDryRun.ts:254-256` (a reworded item reads as one removed + one added) and is carried forward, stated in the UI, not fixed.

**(f) Push a spec revision into the library.** Today impossible (§0.2). G2 adds a seeder mode `--supersede` that, for a named template, creates a **new** global template row carrying the new `specEdition` / `effectiveFrom` / `changeSummary`, and sets the old row's `supersededById`, `supersededAt`, and `supersededBySeedRun`. Existing project instances are untouched — they keep their snapshots, which is the point. Projects using the old template see a "newer edition available" notice, computed by following `supersededById` from the template the project adopted, with a compare link. Adoption is a human act, never automatic.

**It records no `RevisionIssue`, and that is a deliberate correction to Rev 1. [GR-B3]** Rev 1 told this seeder to write one. It cannot: a seeder run has no project id and no user session, and `RevisionIssue` requires both. The full reasoning, and why Rev 2 rejected both fixes the review proposed in favour of keeping the shared table strictly project-scoped, is in §1.3(a). The two extra nullable columns above are what replace the row — `supersededBySeedRun` carries the operator run label so the change is attributable, which is the only part of an issue record a library edition change actually needs. AT-G36 fences the boundary.

### 2.3 Permission matrix (G2)

| Action | owner | admin | PM | QM | site_manager | foreman | site_engineer | subbie | viewer |
|---|---|---|---|---|---|---|---|---|---|
| View template provenance + annexure warning | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Compare two template versions | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| Adopt a newer library edition into a project | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Supersede a **global** template | operator-only, via the seeder with `--execute` (never an API route) | | | | | | | | |

The global-template API immutability guard (`templateAccess.ts:115-120`) **stays**. G2 does not open an edit path to the shared library.

### 2.4 Migration + acceptance (G2)

One reviewed migration `add_itp_template_provenance` — **ten** nullable columns on `ITPTemplate` (the eight in (a) plus `supersededAt` and `supersededBySeedRun`), one nullable column on `ITPChecklistItem` (`sourceChecklistItemId`, (c)), one self-FK, `@@index([projectId, supersededById])`, and a per-project unique on `(projectId, name, specEdition)` so E2 covers project-scoped templates. Additive, all-null on apply. Seeder edits and the snapshot backfill are scripts, run separately with `--execute`, gated on an approved target DB (existing seeder convention, `index.mjs:177-180`).

- **AT-G8** A seeded template exposes `authority`, `specEdition` and `specIssuedOn` matching its seeder header comment (asserted for at least one template per jurisdiction group).
- **AT-G9** Cloning a template preserves `ITPChecklistItem.notes`, sets `sourceTemplateId` to the source template id, and sets each new item's `sourceChecklistItemId` to the item it was copied from. Cloning a clone resolves to the same root item id. **[GR-A3]**
- **AT-G10** An imported template carries `importBatchId` resolving to the `ImportBatch` whose `sourceDocumentId` is the uploaded file.
- **AT-G11** Characterization: the pre-G2 snapshot fields are byte-identical after the builder change; the new fields are additionally present on newly-created instances. **Asserted through `parseTemplateSnapshot`, not on the raw JSON — a new field that the builder writes and the parser drops must fail this test. [GR-A4]**
- **AT-G12** An instance created before G2 with `templateSnapshot IS NULL` gets a backfilled snapshot marked `backfilledAt`, **the marker survives a `parseTemplateSnapshot` round trip**, and `getChecklistItemsForInstance` stops falling through to live template data for it. An instance whose stored snapshot is malformed (unparseable JSON, or `checklistItems` not an array) is **left untouched** by the backfill and still reports through the existing fallback. **[GR-A4]**
- **AT-G13** `GET /compare` between two versions returns a `ChecklistDiff` whose counts match `diffChecklistItems` called directly on the same inputs.
- **AT-G14** Superseding a global template via the seeder leaves every existing `ITPInstance.templateSnapshot` byte-identical.
- **AT-G15** Tenant isolation on `/compare`: comparing against a template in another company's project returns 404, not 403 (no existence disclosure).

Flag: `ITP_PROVENANCE_ENABLED`. Rollback: flag off hides the provenance UI and the compare endpoint; data stays.

---

## 3. G3 — UX Stages 2–4

Most phases here are **[JAY-GATE: MOCKUP]**. **Exactly one is [JAY-GATE: SHELL]** — G3.2, and only because the frozen shell hosts `LotMapView` verbatim. **Two are ungated and ship immediately:** G3.1's tab-semantics fix (a defect fix, behaviour-preserving) and G3.3's office sync consolidation (re-scoped in Rev 2 — see §3.3, which corrects Rev 1's central factual error). Rev 1 said "two are shell-gated"; one of those two was gated on a grant Jay had already given. **[GR-B4]**

### 3.1 Lot-workspace consolidation — **[JAY-GATE: MOCKUP]**

Current state: `frontend/src/pages/lots/LotDetailPage.tsx` is 602 lines and already a thin orchestrator — nine sections in render order (`:378-601`), all rendering delegated. **Seven tabs**, defined once at `frontend/src/pages/lots/constants.ts:10-18` (`itp, tests, ncrs, photos, documents, comments, history`), reordered but never reduced for foremen (`constants.ts:24-38`). Tab state is already in the URL via `useLotReadinessNavigation` (`LotDetailPage.tsx:81-89`).

**Consolidation is not the first problem here — an accessibility defect is.** `frontend/src/pages/lots/components/LotTabNavigation.tsx:27-43` renders `<button role="tab" aria-selected>` inside a `<nav>` with **no `role="tablist"` parent, no `aria-controls`, no roving tabindex and no arrow-key handling**, and `LotDetailTabPanel.tsx:144` is a single `role="tabpanel"` with conditional children so there is no `id`/`aria-labelledby` pairing. Accessibility basics are explicitly out of scope for simplification (program §6 field-workflow standard). **G3.1 fixes the tab semantics first, as its own PR, before any visual consolidation.** That work is behaviour-preserving and needs no mockup.

Consolidation proper (merging `documents`+`photos` into one Evidence tab; folding `comments`+`history` into one Activity tab — reducing 7 → 5) is a mockup decision, DG-4.

### 3.2 Map toolbar grouping — **[JAY-GATE: MOCKUP]** and **[JAY-GATE: SHELL]**

`frontend/src/pages/lots/map/LotMapView.tsx` is 1,649 lines with a **10-button** toolbar at `:1256-1350` (Find by area, Coverage, Plans, Testing, Test pins, Photos, Draw lot, Snapshot, My location, History), in a `flex flex-wrap` container (`:1255`). On a 390px foreman screen that wraps to multiple rows over the map. The growth is visible in the source: `:1281` "Ninth toolbar item (C3 Phase A)", `:1293` "Tenth toolbar item (C3 Phase B2)".

`LotMapView.tsx` itself is **not** in the frozen shell — but the shell hosts it verbatim at `frontend/src/shell/screens/lots/LotMapScreen.tsx:28-29,102`. **Any toolbar change reaches the foreman shell through that file, so this phase carries the shell gate** even though the edited file is outside `shell/`. That is the trap worth naming explicitly.

Proposed grouping (mockup, DG-4): three clusters — **Find** (Find by area, My location), **Layers** (Coverage, Plans, Testing, Test pins, Photos), **Act** (Draw lot, Snapshot, History) — with Layers collapsing to one control on narrow viewports. No new dependency; the `ToolbarButton` primitive (`:590-627`) already handles icon-only-at-44px and `aria-pressed`.

### 3.3 Save/sync-state standardisation — **NOT blocked, NOT shell-gated. Re-surveyed at `1e6ed156`. [GR-B4]**

**Rev 1 was factually wrong here, and the error cost Jay a decision he had already made.** Rev 1 asserted — unmarked, therefore "verified" under §0.1 — that the A5/A6 survey's conclusion stood and *"nothing has changed"*, and DG-5 asked for a shell go-ahead described as *"Same request A5 made and did not get. Still blocked."* At `1e6ed156` all three parts of that are false:

- **The shell go was granted.** `docs/plans/offline-sync-centre-spec-2026-07-28.md:5`: *"Jay approved an offline sync centre on 2026-07-27 … That approval is an explicit shell-touch grant for this surface only."*
- **It explicitly discharged the A5 item Rev 1 cited.** `:6` — *"Discharges A5-v from `docs/plans/a5a6-gap-survey-2026-07-25.md:40` ('Sync-state unification — blocked on Jay's shell go-ahead')."*
- **The work shipped.** `8c6b3dc7` (sync centre Phase 1, #1622), `bb28c44b` (Phase 2, #1623), `79e0af20` (review fixes, #1686) — all three confirmed ancestors of HEAD.

Rev 1 even carried its own `[VERIFY BEFORE BUILD]` for exactly this question and then asserted the opposite in the body. **DG-5 is deleted.**

**The surfaces at HEAD — five, not four.** Rev 1's table missed `SyncPanel`, which the sync centre added:

| Component | Path | In shell? | Vocabulary |
|---|---|---|---|
| `SyncChip` | `frontend/src/shell/components/SyncChip.tsx`; enum `frontend/src/shell/components/syncChipState.ts:8` | **Yes** | **6, canonical:** `saved / waiting / syncing / failed / conflict / offline`. Mounted `ShellScreen.tsx:191,241` |
| `SyncPanel` | `frontend/src/shell/components/SyncPanel.tsx` | **Yes** | `SyncKind` (`photos/diary/dockets/itp/defects/lots`, `:27-34`) + `UNKNOWN_KIND_ROW` `:37`. The Sync Centre sheet |
| `OfflineIndicator` | `frontend/src/components/OfflineIndicator.tsx:11` | No | ad-hoc pills — conflict/failed/offline/**stuck**/pending; `isStuck` is modelled nowhere else |
| `SyncStatusBadge` | `frontend/src/components/OfflineIndicator.tsx:195` | No | 4, prop-driven: `synced / pending / error / conflict`. **Mounted at 2 sites** — `LotEditPageChrome.tsx:47`, `QuickPhotoCapture.tsx:302` |
| `OfflineBadge` | `frontend/src/components/OfflineIndicator.tsx:167` | No | 3, derived — **zero call sites; the only repo-wide hit is the definition. Dead export.** |

Adjacent, not in scope: `SyncConflictModal.tsx:68`, `UnsyncedSignOutDialog.tsx`, `DeferredOfflineIndicator.tsx:19` (lazy wrapper, mounted `App.tsx:732`).

**Re-scoped: G3.3 is the office half the sync-centre spec deliberately left behind, and it touches no shell file.** That spec refused office unification twice, on purpose — `:219`: *"Rewriting `OfflineIndicator`'s enum, `SyncStatusBadge`, or the office surfaces | A5-v's full unification is bigger than Jay's grant. v1 unifies the shell; office stays as-is"*, and `:541` names *"a `<SyncStatus>` component to replace all four surfaces at once"* among the temptations to be refused in review. Both refusals were scoped to that PR under a shell-only grant. **The office surfaces are outside `frontend/src/shell/**` and never needed a grant at all** — they were out of scope there, not forbidden.

So G3.3, unflagged and ungated:

1. **Delete `OfflineBadge`** (zero call sites).
2. **Retire `SyncStatusBadge`'s private 4-state enum** at its two mount sites, mapping them onto the canonical `SyncState` by **importing `deriveSyncState` / `syncChipLabel` from `frontend/src/shell/components/syncChipState.ts` — read-only, no edit to any file under `shell/`.**
3. **Fold `OfflineIndicator`'s ad-hoc pills onto the same six states,** keeping `isStuck` as a presentational variant of `failed` rather than a seventh state.

**It does NOT build a shared `<SyncStatus>` component.** That is the thing `:541` names as the over-build, and it stays refused. G3.3 is net deletion — three vocabularies become one import — which is why it needs no new abstraction to get there. The one dependency it does create is `components/` importing a type and two pure functions from `shell/`; that direction is stated here so a reviewer can object to it deliberately rather than discover it.

`syncChipState.ts:18-25` documents the real past bug this closes: a green "All saved" chip beside an amber "1 sync conflict" pill.

### 3.4 Role-specific first-task onboarding — **[JAY-GATE: MOCKUP]**

Three unconnected systems exist: `OnboardingTour` (`frontend/src/components/OnboardingTour.tsx`, 7 modal steps, localStorage seen-marker, **foremen deliberately excluded** at `frontend/src/components/layouts/ProtectedAppShell.tsx:60-67` because it walks desktop chrome), `DashboardSetupChecklist` (`frontend/src/components/dashboard/DashboardSetupChecklist.tsx`, shown instead of an all-zero KPI grid, with a create-sample-project escape hatch), and `CompanyOnboardingPage` (`frontend/src/pages/onboarding/CompanyOnboardingPage.tsx`, a company-creation gate, not guidance). No coach marks, no spotlight system, no `firstRun` flag (searched `coachmark|walkthrough|firstRun|first_run` — zero component hits).

**Recommended shape (lazy):** do not build a tour framework. `setupChecklistState.ts` already derives ordered steps from real counts (`deriveSetupSteps`, `:1-10`) and deep-links when a single project exists (`resolveSoleProjectId`, `:44-46`) — its own comment calls it "the seed of the future project-state copilot" (`:8-9`). Generalise **that** into a role-keyed first-task list (a foreman's first task is "complete an ITP item on a lot", not "create a project"), and retire the modal tour for roles it excludes. One new file, one existing engine extended, no dependency.

### 3.5 AI-state vocabulary (G3.5) — **[JAY-GATE: MOCKUP]**

There is no generic AI-state indicator; this half is unchanged from Rev 1 and is split into its own section only so it is not conflated with the sync work, which now has a different gate and a different size. What exists is per-feature, confidence-percentage, all modal (`AIClassificationModal.tsx:74`, `UploadCertificateModal.tsx:281-283`, `BatchUploadModal.tsx:474-617`, `ImportReviewPanes.tsx:57`, `LotEditFormFields.tsx:57`). Standardising them means one shared `<AiConfidence>` presentational component and one vocabulary — outside the shell, mockup-gated only.

### 3.6 Acceptance tests (G3)

- **AT-G16** Lot tab strip exposes `role="tablist"`, each tab has `aria-controls` pointing at a panel with a matching `id` and `aria-labelledby`, and Left/Right arrows move focus between tabs. Automated in the existing Playwright e2e suite.
- **AT-G17** At a 390px viewport, the map toolbar occupies a single row (grouped) — asserted via bounding-box height, not a screenshot.
- **AT-G18** **No module under `frontend/src/components/` or `frontend/src/pages/` declares its own sync-state vocabulary** — asserted as a grep for a string-union type containing `'synced'`, `'pending'` or `'conflict'` outside `frontend/src/shell/` and `frontend/src/lib/offline/`. **[GR-N2]**

  Rev 1's version asserted *"`OfflineBadge` has no references"*, which becomes a tautology the moment G3.3 deletes the export: a grep for a deleted symbol matches nothing, including the definition, so the test can never fail for the reason it exists. The precedent it cited (`folioRenderer.test.ts:186-234`) asserts something structurally different — an import graph that must **stay** clean as new code is added. The replacement above has that property: it fails if anyone reintroduces a private sync vocabulary, which is the invariant G3.3 buys.
- **AT-G19** A first-run foreman on `/m` sees a role-appropriate first task and never the desktop-chrome tour.

Flags: `LOT_WORKSPACE_V2`, `MAP_TOOLBAR_GROUPED`, `ONBOARDING_FIRST_TASK` — each independently revertible, all opt-in and default off per §1.9. The a11y fix (G3.1) and the sync consolidation (G3.3) ship **unflagged**: one is a defect fix, the other is net deletion behind no behaviour change a flag could revert to.

**Build-agent caution for G3.3:** `SyncStatusBadge` is **not** dead — it is mounted at `LotEditPageChrome.tsx:47` and `QuickPhotoCapture.tsx:302`. Only `OfflineBadge` is dead. The §3.3 table says so, but "Delete it." sits one row away and is an easy over-reach. (The sync-centre spec notes at `:127` that `QuickPhotoCapture` itself has no external importers — that is a separate question from whether the badge is referenced, and G3.3 does not act on it.)

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

**Step 0 — pin jsPDF's own identity fields, or steps 1–3 cannot succeed. [GR-B1]**

Per §0.2 Finding 3, jsPDF randomises `/ID` and stamps a wall-clock `/CreationDate` at construction. No caller-side argument can reach either. All eight generators already import a single seam — `getJsPDF()` from `frontend/src/lib/pdf/jsPdfRuntime.ts` (a 9-line lazy loader) — and each then calls `new jsPDF()` itself (`claimEvidencePackagePdf.ts:47`, `conformanceReportPdf.ts:197`, `dailyDiaryPdf.ts:13`, `dashboardPdf.ts:11`, `docketDetailPdf.ts:14`, `holdPointEvidencePdf.ts:61`, `ncrDetailPdf.ts:61`, `testCertificatePdf.ts:14`).

Export one helper from `jsPdfRuntime.ts` — the seam that already exists — and call it on the line after each construction:

```ts
// jsPdfRuntime.ts
const PINNED_FILE_ID = 'C1005EV1DENCE0000000000000000000'; // 32 UPPERCASE hex; jsPDF uppercases and
                                                           // silently falls back to Math.random() on a
                                                           // value that fails /^[a-fA-F0-9]{32}$/
export function pinPdfIdentity(doc: jsPDF, pinnedInstant: Date): void {
  doc.setFileId(PINNED_FILE_ID);
  doc.setCreationDate(toPdfDateLiteral(pinnedInstant)); // "D:YYYYMMDDHHmmss+10'00'" — a STRING
}
```

Two properties this depends on, both verified against the published `jspdf@4.2.1` source and at runtime (§0.2):

- **`setCreationDate` must receive the pre-formatted `D:` string, never a `Date`.** A `Date` runs `convertDateToPDFDate`, which reads `getTimezoneOffset()` and local `getHours()` — that is precisely the path that would keep AT-G22 red. The string matches the regex at `:1491` and is stored verbatim (`:1496-1503`). `toPdfDateLiteral` formats via the existing `frontend/src/lib/localDate.ts` at `DEFAULT_APP_TIME_ZONE`, so the emitted offset is a constant `+10'00'` regardless of the machine's zone. Year must fall in 1970–2037 (the regex's range) — a constraint no realistic `generatedAt` violates, but one a test fixture using a sentinel year could.
- **`setFileId` needs 32 uppercase hex.** It uppercases what it stores (`:1402`) and does **not** throw on a bad value — it silently reverts to the random branch. AT-G20 is what turns that silence into a failure.

This is eight added lines in the eight files step 1 is already editing. It adds no dependency, no abstraction, and no new module — `jsPdfRuntime.ts` exists for exactly this reason.

**Step 1 — pin the clock.** The eight call sites pass `generatedAt: new Date()`; change them to accept an injected value with `new Date()` as the default at the *caller* boundary, so tests can pass a fixed instant. That same instant is what step 0 passes to `pinPdfIdentity`. **Bound on steps 0–1:** argument threading and one added call per generator, no restructuring, reordering or splitting of any generator body. That is the whole exception to boundary §0.3.2, and it is stated here so a reviewer can hold the diff to it.

**Step 2 — pin the timezone.** Ten files call `toLocaleDateString`/`toLocaleString('en-AU')` with no `timeZone` (`branding.ts:324`, `conformanceReportPdf.ts:46,182,338`, `dailyDiaryPdf.ts:23,33`, `dashboardPdf.ts:23,34`, `docketDetailPdf.ts:24,33,82,90`, `holdPointEvidencePdf.ts:13,162,171,450`, `ncrDetailPdf.ts:71,80`, `testCertificatePdf.ts:24`, `claimEvidencePackagePdf.ts:73,161,…`). The repo already has the right helper: `frontend/src/lib/localDate.ts` with `DEFAULT_APP_TIME_ZONE = 'Australia/Sydney'` (`:1`), which is why filenames are already TZ-stable while body dates are not. Route the PDF date formatters through it. Add `TZ` to `frontend/vitest.config.ts` as a belt-and-braces CI pin.

**Step 3 — the regression suite, without adding a dependency.** Once steps 1–2 land, run the real jsPDF (no `vi.mock`) in a small new test file and assert **byte equality across two renders of one fixture**, exactly as `folioRenderer.test.ts:41-51` does, plus the mutation guard from `:53-67`. Add structural assertions the recorder cannot make: page count, and that no text op's y-coordinate exceeds the page's bottom margin.

**Recommended: byte-and-structure regression, not pixel diffing.** Pixel diffing needs a rasteriser; `pdfjs-dist` is installed frontend-side (`frontend/package.json:53`) but rendering it headlessly needs `canvas`, which is not installed and is a native-build dependency on Windows. Byte equality catches every determinism regression, is free, and needs nothing new. Revisit pixel diffing only if a real client rejects an output for a reason bytes could not have caught (DG-6).

**Step 4 — golden fixtures for the layout cases the recorder structurally cannot see**: long descriptions, large ITPs (100+ items), many photographs, missing optional values (program §6 output standard names exactly these four). One fixture each.

**Goldens pin page count and text-op extents, NOT bytes. [GR-N3]** AT-G20/G21/G22 are self-comparing — two renders inside one test run — so they are immune to a jsPDF version change. A committed byte golden is not: `frontend/package.json:49` carries `"jspdf": "^4.2.1"` (a caret range; the lockfile resolves 4.2.1), so a transitive bump would invalidate all four fixtures at once and present as four unexplained failures. Pinning the *structural* facts — number of pages, and the bounding extents of text operations per page — keeps the fixtures meaningful across patch releases while still catching the layout regressions they exist for. **Also drop the caret** (`"jspdf": "4.2.1"`) so the bump is a deliberate PR with these four fixtures as its test plan.

### 4.3 G4b — configurable client formats (buildable now, value needs a counterparty)

Generalise `FORMAT_CONFIGS` (`conformanceReportPdf.ts:57-107`) into a shared `ClientOutputFormat` record applied to all eight documents, and **split the two concerns it currently conflates**: presentation (title, subtitle, header colour) and legal semantics (`requiresSignature`, certificate-vs-report title). Note the live consequence of that conflation: `standard` is titled `LOT CONFORMANCE REPORT` while the four authority formats say `LOT CONFORMANCE CERTIFICATE` and set `requiresSignature: true` (`:80,88,96,104`) — and those are precisely the strings the folio's test suite **bans** from folio output (`folioRenderer.test.ts:92-100`). Certificate language is a legal assertion, not a theme.

Per-project format selection is stored on `Project`; per-document overrides are not built until asked for. Behind `CLIENT_OUTPUT_FORMATS_ENABLED`, default off.

### 4.4 What needs a counterparty (explicitly not buildable now)

The success bar itself. "A real client accepts a CIVOS deliverable without reformatting" is evidence, not code. G4's exit gate therefore has two halves:

- **Buildable now (G4a + G4b):** determinism proven by byte equality, four layout fixtures pinned, format config behind a flag. Exit-gate evidence = green tests + a screenshot of one output in two formats.
- **Needs counterparty (G4c):** one named client, one real deliverable, written acceptance or a list of what they changed. **Owner: Jay** (program §5.5 — design partners are the multiplier). Until then G4c is **[UNKNOWN]** and no acceptance claim is made anywhere, publicly or internally.

### 4.5 G4d — pagination correctness (scoped, sized, NOT scheduled — DG-10)

**Program §3 lists "stable pagination" as a Wave G deliverable. Rev 1 diagnosed it forensically and then shipped only an assertion about it, which is not the same thing. [GR-A1]**

§4.1's evidence: `checkPageBreak` (`conformanceReportPdf.ts:203-212`) is called with **17 different literal space requirements in that one file** (`:360(30)`, `:406(8)`, `:447(30)`, … `:810(6)`), and nothing has ever checked those constants against real jsPDF text metrics — because the harness fakes the metrics (`pdfTestRecorder.ts:47` `getTextWidth = len*2`; `:88` `splitTextToSize` splits on `\n` only, so **wrapping is never exercised by any test**). Fixing a fixture that overflows means editing generator bodies, which §0.3.2 and §4.2's own stated bound forbid. Rev 1's exit gate therefore contained an assertion G4a had no sanctioned way to satisfy.

Rev 2 resolves it by splitting measurement from repair:

- **G4a measures and reports.** AT-G23 runs the bottom-margin check across all four hard fixtures and **enumerates the passing set in the G4a PR body**. It asserts only on the fixtures that pass, and those become the regression fence. This is not a weakened test — it is an honest one, because until step 3 runs real jsPDF for the first time in this repo's history, **nobody knows which fixtures overflow.** Guessing the answer into a gate would fail G4a for a fact rather than a defect.
- **G4d repairs, separately.** Any fixture that overflows is filed as a named increment: **G4d — pagination correctness, size M.** Scope: replace the recorder's fake metrics with real jsPDF metrics, then correct the literal space constants that the now-real measurements prove wrong. **G4d is the one increment that widens the `frontend/src/lib/pdf/**` DON'T-REFACTOR boundary** — to editing `checkPageBreak` call arguments and the wrapping paths, still not to restructuring generators. That widening is why it is **DG-10** and not an automatic follow-on.
- **"Stable pagination" moves to excluded-with-owner for G4a.** Owner: Jay, via DG-10. Recorded here rather than silently converted into a test assertion, which is what Rev 1 did.

### 4.6 Acceptance tests (G4)

- **AT-G20** Two renders of one fixture produce byte-identical PDFs, for each of the eight generators. Requires step 0 — without `pinPdfIdentity` this is red on every run, on `/ID` alone, with no clock involved.
- **AT-G21** Mutation guard: changing one field of the fixture changes the bytes (so a constant renderer cannot pass AT-G20).
- **AT-G22** Rendering the same fixture under `TZ=Australia/Sydney` and `TZ=UTC` produces byte-identical output. **Executed across two child processes, not two env assignments. [GR-A9]** `process.env.TZ` is not reliably honoured after the first `Date`/`Intl` use in a Node process (ICU caches the zone), so a single vitest worker cannot render "under Sydney" and then "under UTC" — written that way it passes while proving nothing, which is worse than not having the test. Implementation: one test spawning a tiny render script twice via `node:child_process` with `TZ` set per spawn, comparing the two sha256 digests. Stdlib only, no new dependency, no second vitest project to configure.
- **AT-G23** For each of the four hard layout fixtures, no text operation is placed below the bottom margin, and page count matches the pinned golden. **Scoped at build time to the fixtures that pass; the passing set is enumerated in the G4a PR body and any failing fixture is filed to G4d (§4.5). [GR-A1]**
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
3. **Recurrence is recomputed per request over an unbounded `findMany`** (`ncrAnalytics.ts:93-108`), and **only half of it is capped. [GR-N4]** `repeatIssues` slices to 10 (`:247-250`) — `.slice(` appears exactly once in the whole file. `repeatOffenders` (`:283-285`) is filtered and sorted with **no slice at all**, and each entry carries an unbounded `ncrIds: string[]` (`:275`) plus `categories: string[]` (`:277`). Both ship in the same response (`:303-304`). So the uncapped half is also the half with unbounded nested arrays, on the exact surface P4 targets. G5 caps `repeatOffenders` symmetrically and returns counts rather than full id arrays. Fine at pilot scale, not at the program §8 reference dataset. §8 sets the budget.
4. **No NCR → ITP template link at all.** The only artefact is a free-text marker `[itp-item:<checklistItemId>]` written into `rectificationNotes` (`backend/src/routes/itp/instances/ncrLinks.ts:14,27-48`), whose own header comment says there is no relation in the schema. It is regex-parsed, unindexed, absent on legacy rows, and absent for NCRs raised outside the failed-ITP path.

### 5.3 The loop, end to end

Add `NCR.itpChecklistItemId String?` (nullable FK, `onDelete: SetNull`) and write it on the auto-NCR-from-failed-ITP path (`backend/src/routes/itp/completions.ts:505` already sets `category`, so the write site exists). Backfill from the existing marker where it parses; leave null otherwise — **never guess**.

Then: recurring failure by (work type × subcontractor × checklist item) → a reviewer sees "this item failed 7 times across 3 subcontractors on `earthworks_bulk`" → the reviewer **proposes** a template change → that proposal, if accepted, becomes a **new ITP template revision through G2(f)**, carrying a `changeSummary` that cites the NCR count. The loop closes into revision governance rather than editing a template in place. That dependency is why G5 sequences after G1/G2.

**Cross-project aggregation depends on G2(c)'s `sourceChecklistItemId`, and would be a false promise without it. [GR-A3]** `NCR.itpChecklistItemId` points at a **per-project copy** of an item — clone mints fresh ids (`templates.ts:338-346`), so the same logical checklist item has a different id in every project that adopted the template. Aggregating on the raw FK gives within-project recurrence only, and the "across 3 subcontractors" claim above is precisely a cross-project one. G5 therefore groups on the **resolved root** (`sourceChecklistItemId` walked to its origin, §2.2(c)). Items whose pointer is null — every row created before G2 — are their own root, and the UI says how much of the corpus that is rather than implying full coverage. **No description-matching fallback:** two items with the same text in different projects are not evidence of the same requirement, and treating them as one would manufacture a trend.

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

**Defect 1 — the load-bearing numbers are hand-maintained, and they reconcile to nothing.** `TEMPLATE_CELLS` (`:17-24`) lists five authorities — Austroads 6, TfNSW 14, TMR 32, DIT 32, VicRoads 32 — summing to the `116 ITP templates · 3,070 checklist points` claimed at `:520` and the `116 templates · 3,070 checklist points · 813 hold points` at `:720`. But the seeder manifest carries **seven** jurisdiction groups: austroads 1 file, national 2, nsw 7, qld 8, sa 9, vic 8, **wa 5** (`backend/scripts/seeds/itp-templates/index.mjs`). Western Australia (MRWA) and the national WSA / AUS-SPEC seeders are absent from the public breakdown.

Rev 1 called it *"either understate or stale — [UNKNOWN] which"*. **Rev 2 measured it, and there is a third answer: neither. [GR-A11]** Using the §6.2 parse patterns at `1e6ed156`:

| | Templates | Checklist points | Hold points |
|---|---|---|---|
| Claimed on the landing page | 116 | 3,070 | 813 |
| **Measured, all 40 seeders** | **152** | **3,501** | **939** |
| Measured, excluding WA + national (the 33 files the breakdown covers) | 139 | 3,313 | 884 |

**The published figures match neither the full library nor the subset they purport to describe.** The gap is large enough to change the positioning — the product understates itself by roughly a quarter on templates — and it is a public claim under the NEVER-FABRICATE boundary that nobody could check, because there was no computed check. Note these three rows are the *script's* job to make authoritative: they are derived here to size the problem, and §6.2's guard rails are what stop the same class of error (the 39 mapper lines) from being baked into the replacement.

**Publishing corrected numbers is a Jay decision — DG-9.** AT-G32 fails the build when the computed numbers differ from the strings in `LandingPage.tsx`, so passing G6a's exit gate **necessarily rewrites public marketing copy**: `:520`, `:720`, and the five-row `TEMPLATE_CELLS` at `:17-24`. Rev 1 had no sign-off gate for that. The sequence is: (1) build the script; (2) it produces the authoritative counts; (3) a human reconciles the three-way mismatch above and decides whether the breakdown gains WA and national rows or stays five-authority with a corrected total; (4) only then does the copy change. **Computed counts become authoritative at step 2, not before** — the numbers in the table above are this spec's measurement, not the product's claim, and must not be published from here.

**Defect 2 — a price string ships in the product today.** `getPlanBillingLabel` returns `'$99/month'` for `professional` (`frontend/src/pages/company/companySettingsData.ts:157-167`) and `getPlanStorageLabel` returns `'100 GB'` / `'1 GB'` (`:169-178`). Meanwhile **tier quota enforcement is globally off** — `TIER_QUOTA_ENFORCEMENT_ENABLED = false` (`backend/src/lib/tierLimits.ts:14`, with an honest rationale at `:6-13`), and no storage quota code exists at all. A customer on `professional` would see "$99/month · 100 GB" with nothing metering or enforcing either. That is a truth defect in shipped code, independent of any pricing page, and G6 fixes it first.

### 6.2 The mechanism — a computed claims register, not a document

**No marketing-claims register exists** (searched `docs/` for `product-truth|claims register|marketing claim|evidence register`; all hits are the *progress-claim* product sense). The closest artefact, `docs/archive/2026-05-repo-hygiene/landing-page-spec.md`, is archived and still branded "SiteProof", pre-CIVOS-rename.

**Recommended (lazy, and the only version that stays true):** a prose register goes stale the week it is written. Build instead:

1. **`docs/marketing-claims-register.md`** — one row per public claim: claim text · where it appears (`file:line`) · claim type (`computed | code-evidenced | qualitative | external`) · evidence pointer · last verified.
2. **`backend/scripts/verify-marketing-claims.ts`** — for every `computed` claim, recompute it from the source of truth and fail if it drifts. First three: template count, checklist-point count, hold-point count. Follows the shipped bench-script convention (`backend/scripts/bench-*.ts`, results committed under `backend/scripts/bench-results/`).

   **It parses the seeder files AS TEXT. It never imports them, never executes them, and never opens a database connection. [GR-B2]**

   Rev 1 said the counts were *"derived by loading the seeder manifest"*, which is not possible and, implemented the obvious way, is dangerous. Three facts, all re-verified at `1e6ed156`:

   - The manifest (`backend/scripts/seeds/itp-templates/index.mjs:8-49`) carries only `{state, activity, file, label}` per row — **40 rows, 40 files, exact one-to-one, and no counts anywhere.** There is nothing to load.
   - **All 40 seeders export nothing.** Zero `^export` lines across the corpus; the template arrays are script-local `const`s (e.g. `waStructuralConcreteTemplate`, `seed-itp-templates-wa-structures.js:32`). Nothing in the corpus is importable.
   - **Every one of the 40 is an executable script with top-level side effects**, and the pattern is universal — 0 of 40 have an entry guard (no `import.meta.url`, no `require.main`, no `process.argv[1]` check anywhere in the corpus). `const prisma = new PrismaClient()` sits at module scope (`seed-itp-templates-wa-structures.js:23`) and `withItpTemplateSeedLock(prisma, main)` is called at column 0 on load (`:343`), which takes `pg_advisory_xact_lock(731452019)` (`seed-lock.mjs:1-8`) and writes global ITP templates to **whatever `DATABASE_URL` is in the environment**, then calls `process.exit`. A dynamic `import()` of a seeder *runs* it. An agent running the verification script locally with `backend/.env` loaded points that at **Railway production.** §7 row 9's "read-only by construction" was exactly backwards for the implementation Rev 1's own wording invited.

   The parse patterns, with the counts they produce at `1e6ed156` (`fs.readFileSync` + regex per file, in manifest order):

   | Quantity | Pattern | Count |
   |---|---|---|
   | Checklist points | `/^\s*pointType:\s*'/m` — a **quoted literal** | **3,501** |
   | Hold points | `/^\s*pointType:\s*'hold_point'/m` | **939** |
   | Templates | `/^  activityType:\s*'/m` — two-space indent **and** a quoted literal | **152** |

   **The quoted-literal requirement is load-bearing, not stylistic.** A naive `pointType:` grep returns **3,540** — 39 too many, because 39 of the 40 files contain one `pointType: item.pointType,` mapper line (e.g. `seed-itp-templates-qld-pavements.js:2381`; `seed-itp-templates-austroads.js` is the exception). The same artefact inflates a naive `activityType:` grep to 191. The corrected counts sum exactly: 939 `hold_point` + 2,027 `standard` + 535 `witness` = 3,501. A verification script that shipped the naive pattern would publish a number 39 too high and be *stable* about it, which is the failure mode hardest to notice.

   **The script's own guard rails, asserted by AT-G39:** it contains no `import(` or `require(` of any path under `scripts/seeds/`, and no import of `@prisma/client`. A regex over the script's own source, checked in CI. This is the cheapest possible fence around "must never touch a database", and it is worth having because the safe implementation and the dangerous one are three characters apart.

   Rejected alternative, named so it is not rediscovered: refactoring all 40 seeders to `export const templates = […]` behind an entry guard. That is real scope G6a's "S" sizing does not budget, it re-touches 40 files that write to production, and it buys nothing the regex does not.
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
- **AT-G39** `verify-marketing-claims.ts` contains no `import(`/`require(` of any path under `scripts/seeds/` and no import of `@prisma/client`; a fixture seeder file containing a `pointType: item.pointType` mapper line contributes **zero** to the counted total. **[GR-B2]**
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
| 9 | Marketing claims script | **Real, and Rev 1 understated it.** The seeders are unguarded executable scripts: importing one connects to `DATABASE_URL`, takes an advisory lock and **writes global ITP templates** — which for an agent with `backend/.env` loaded is Railway **production** | The script reads the seeder files as **text** (`fs.readFileSync` + regex, §6.2). No `import()`, no `require()`, no `@prisma/client`. Read-only by construction only because the mechanism is stated; "loading the manifest" would not have been | **AT-G39** asserts the script's own source contains neither import form |
| 10 | Prompt injection | **Not applicable to Wave G.** No new AI extraction surface is introduced; G5 explicitly forbids AI-authored template changes (§0.3.5) | — | — |

**Threat-model artifact:** program §7 gates a dedicated threat model before A3, C2, D2 and E — Wave G is **not** on that list, and this section states why: no new upload surface (row 3), no new external link (row 6), no new AI ingestion (row 10). The three genuinely new things are query surfaces and one non-repudiation record, all covered by the standing tenant-isolation and permission-test requirements. **If DG-3 turns out to require an external acknowledgement link, that reverses this judgement and a threat model becomes a build-blocking artifact for that phase.**

---

## 8. Scale and performance (program §8 — percentile, device, network, dataset)

Measured against the defined production-like reference dataset (5,000 lots, 10,000 map features, 50GB evidence, 10k-row registers). Benchmarks follow the shipped convention: a script under `backend/scripts/bench-*.ts` driving real route handlers over supertest against a local disposable Postgres, with results committed to `backend/scripts/bench-results/` (`backend/scripts/bench-f05.ts:1-30` is the worked example).

| # | Path | Target | Conditions |
|---|---|---|---|
| P1 | Lot readiness **with** the superseded-revision input added | **p95 < 1.2× the pre-G1 baseline**, measured on the same dataset before and after | Server-side, 5,000-lot dataset. A relative target because the absolute number is owned by F0.5 and must not be restated here. **The baseline run is a G1 *precondition*, committed to `bench-results/` before the G1 PR merges — once G1 is in, the left-hand side is unmeasurable. In §9's G1 exit-gate row. [GR-N5]** |
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
G3.3 (office sync consolidation) ── independent, ships immediately, NO GATE  [re-scoped, GR-B4]
G3.4 (first-task onboard)── independent  [JAY-GATE: MOCKUP]
G3.5 (AI-confidence vocabulary)  ── independent  [JAY-GATE: MOCKUP]

G4a (determinism + regression) ── independent, ships immediately
G4c (client acceptance)        ── needs a counterparty  [JAY: design partner]
G4d (pagination correctness)   ── scoped, sized, unscheduled  [JAY-GATE: DG-10]

G6a (fix shipped price strings + claims register + CI check) ── independent, ships immediately
                                  └── new public numbers  [JAY-GATE: DG-9]
G6b (pricing page)             ── built, publishing  [JAY-GATE: DG-7]
```

| Increment | Size | Starts | Exit-gate evidence |
|---|---|---|---|
| **G1** | M | On acceptance of this spec | **P1 pre-G1 baseline committed BEFORE merge [GR-N5]** · AT-G1…G7 + AT-G36…G38 green · 3 migrations applied to prod · one record issued + acknowledged on a demo project, screenshotted |
| **G2** | M | After G1 exit | AT-G8…G15 green · migration applied · one seeded template showing full provenance · one compare screenshot · snapshot backfill run with counts reported |
| **G3.1** | S | Immediately | AT-G16 green in e2e |
| **G3.2** | S–M | On mockup + shell go | AT-G17 green · 390px screenshot |
| **G3.3** | S | **Immediately — no gate [GR-B4]** | AT-G18 green · `OfflineBadge` deleted · net-negative diff · **no file under `frontend/src/shell/**` modified (asserted in the PR body)** |
| **G3.4** | S–M | On mockup go | AT-G19 green |
| **G3.5** | S | On mockup go | One `<AiConfidence>` component, five call sites converted |
| **G4a** | M | Immediately | AT-G20…G22 green · AT-G23 green **on the enumerated passing fixture set, with any failing fixture filed to G4d [GR-A1]** · CI runtime recorded against P5 · jspdf caret dropped |
| **G4b** | S–M | After G2 | AT-G24, AT-G25 green |
| **G4c** | — | Needs counterparty | Written client acceptance, or the list of what they changed |
| **G4d** | M | **On DG-10 only** | Every hard fixture passes AT-G23 · recorder uses real jsPDF metrics · boundary widening recorded in the PR body |
| **G5** | M | After G2 exit | AT-G26…G31 green · P4 benchmark committed to `bench-results/` · `repeatOffenders` capped |
| **G6a** | S | Immediately (copy change on DG-9) | AT-G32, AT-G33, AT-G35, **AT-G39** green · register committed · CI check wired · **landing-copy edit held until DG-9** |
| **G6b** | S | Built now, published on DG-7 | AT-G34 green |

**Pilot acceptance owner: Jay** for every increment (program §5.5 — no other counterparty exists yet).

**Rollback:** every increment is a flag flip. All migrations are additive and are **not** rolled back — the standing rule. G4a is the one increment with no flag: determinism is a correctness fix, and reverting it means reverting the commit.

---

## 10. Honest unknowns

1. **RESOLVED in Rev 2 — and the answer was neither option Rev 1 offered.** The landing page's `116 templates · 3,070 checklist points · 813 hold points` matches **neither** the full library (152 / 3,501 / 939) **nor** the five-authority subset it describes (139 / 3,313 / 884). See §6.1 Defect 1 for the measurement and its caveats. Making these authoritative is still AT-G32's job; **publishing them is DG-9.** **[GR-A11]**
2. **[UNKNOWN]** Whether the spec editions cited in the seeder headers are still current. Program §10 lists TMR/DIT-SA/MRWA numeric frequencies as unverified and carries revalidation dates. G2 persists what the seeders assert; it does not raise any claim's evidence grade.
3. **[UNKNOWN]** Whether any real client wants a format CIVOS does not already emit. G4b generalises a mechanism on the assumption they will; that assumption is untested (DG-6).
4. **[UNKNOWN]** Whether contractors acknowledge drawing revisions in a way that maps to `notifiedAt / openedAt / acknowledgedAt`. The three-state split is derived from the shipped `HoldPointReleaseToken` pattern, not from customer research. No research report in `docs/research/` covers document distribution practice (searched).
5. **[UNKNOWN]** How lots should be linked to governing revisions — manually, by spec-reference match, or spatially. DG-3. Manual linking is specified because it is the only option that cannot be wrong.
6. **RESOLVED in Rev 2.** The drawings write-role set was read at `1e6ed156`: `DRAWING_WRITE_ROLES` (`backend/src/routes/drawings/access.ts:4-13`) is owner, admin, project_manager, quality_manager, site_manager, site_engineer, foreman. §1.4 now carries per-class rows with per-class precedents; this is a stated decision, not a build-time lookup. **[GR-B5]**
7. **RESOLVED in Rev 2.** `docs/plans/offline-sync-centre-spec-2026-07-28.md` is merged and shipped (#1622, #1623, #1686); Jay's shell grant was given 2026-07-27 and discharged A5-v. G3.3 is **not** subsumed — it is the office half that spec deliberately deferred, and it needs no gate. See §3.3. **[GR-B4]**
8. **[UNKNOWN]** Whether the entry pricing band is economically survivable at the 50GB evidence target. Program §8 requires a storage/egress cost test before committing; it has not been run. Blocks DG-7, not G6a.
9. **[UNKNOWN]** Which of the four hard layout fixtures overflow the bottom margin. Genuinely unknowable until G4a step 3 runs real jsPDF for the first time in this repo's history — the current harness fakes text metrics (`pdfTestRecorder.ts:47,88`), so no existing test can tell. Sizes G4d. **[GR-A1]**
10. **Known inconsistency, deliberately not fixed.** The drawings supersede route returns **400** for a duplicate revision caught by its pre-check (`drawings.ts:376-388`) and **409** for the same collision caught by the unique index (`errorHandler.ts:304-311`). A client cannot branch on status. Pre-existing; collapsing it means changing a shipped route's contract, which is not Wave G's job. Recorded so it is not refiled as a Wave G bug. **[GR-A8]**

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

**DG-5 — DELETED in Rev 2. Not renumbered; the gap is deliberate. [GR-B4]**
Rev 1 asked for a shell go-ahead for sync-state unification. **You already gave it, on 2026-07-27**, and the work shipped as #1622 / #1623 / #1686. Asking again would have been asking you to re-decide something you had decided four days before the spec was written. The residual work (the office surfaces) sits outside `frontend/src/shell/**` and needs no grant at all — it is now G3.3, ungated, shipping immediately. Nothing is required of you here.

**DG-6 — Build G4b (configurable formats) now, or wait for a client to reject something?**
*Recommendation:* build the mechanism (it is small and G2 supplies the data), ship it flagged off. Do not add formats speculatively. A format nobody asked for is a maintenance liability with a testing cost.

**DG-7 — Publish the pricing page?** Program §5.1 says the band is a hypothesis and adoption is your call. Independent of that: **the `$99/month` string ships in the product today** (`companySettingsData.ts:160`) while quota enforcement is off. That is a truth defect regardless of what you decide about publishing. *Recommendation:* remove the price strings now, decide publishing separately.

**DG-8 — Does G3 get instrumentation, or ship blind?**
`product_events` has four events and no read surface (§8). Without a funnel and a way to query it, no G3 claim about improved task completion can be substantiated — and program §6's adoption metrics need it.
*Recommendation:* G3.1 adds one funnel and one minimal read surface (an admin query endpoint, not a dashboard). Otherwise G3 ships on taste alone and the wave's own exit gate cannot be evidenced.

**DG-9 — Sign off the corrected public template numbers. [GR-A11]** *(new in Rev 2)*
The landing page says `116 ITP templates · 3,070 checklist points · 813 hold points`. Measured against the shipped seeders, the library is **152 / 3,501 / 939** — and the five-authority breakdown the page shows covers 139 / 3,313 / 884. The published figures match neither. G6a's exit gate (AT-G32) **fails the build** until the strings match the computed counts, so passing it necessarily edits public marketing copy at `LandingPage.tsx:520`, `:720` and `TEMPLATE_CELLS :17-24`.

Two questions, and the copy change is held until you answer:
1. Does the breakdown gain WA (MRWA) and national (WSA / AUS-SPEC) rows — telling the true, larger story — or stay five-authority with a corrected total?
2. Does the corrected copy ride with the G6a PR, or ship as its own reviewed change?

*Recommendation:* add the two missing authority rows and publish the full figures. The product is understating itself by roughly a quarter on template count, the omission has no upside, and a bigger honest number is better positioning than a smaller unverifiable one. Ride it with the G6a PR — the script is what makes it defensible, so they belong in the same change. **Nothing publishes until the script exists and you have reconciled the three-way mismatch;** the numbers above are this spec's measurement, not yet the product's claim.

**DG-10 — Schedule G4d (pagination correctness), or wait for a complaint? [GR-A1]** *(new in Rev 2)*
Program §3 lists "stable pagination" as a Wave G deliverable. G4a will, for the first time in this repo's history, render real PDFs and measure whether the 17 hand-guessed page-break constants in `conformanceReportPdf.ts` alone actually hold. **Nobody currently knows how many of the four hard fixtures overflow** — the test harness fakes text metrics, so no existing test could have caught it. G4d (size M) is the repair, and it is the **one increment that widens the `frontend/src/lib/pdf/**` DON'T-REFACTOR boundary**, which is why it is your call rather than an automatic follow-on.

*Recommendation:* let G4a run and report first, then decide with the count in hand. If one fixture overflows, fix it in a small follow-up; if all four do, G4d is real work and should be scheduled deliberately. Deciding before the measurement exists is guessing.

---

## 12. Delivery-control checklist (program §9 — all thirteen items)

| # | Item | Where |
|---|---|---|
| 1 | Included / excluded behaviour | §1.6, §2.2, §3, §4.2–§4.4, §5.3, §6.2–§6.3 |
| 2 | Schema and data flow | §1.3 (3 models + 1 column + 1 CHECK + 1 partial unique), §2.2 (10 columns on `ITPTemplate`, 1 on `ITPChecklistItem`), §5.3 (1 FK) |
| 3 | Permission matrix | §1.4, §2.3; §7 rows 7–8 |
| 4 | Edge cases | §1.7 (E1–E9), §2.2(d), §4.2 step 4, §5.2 |
| 5 | Migration plan | §1.5, §2.4, §5.4 — reviewed Prisma migrations, all additive; prod apply is the orchestrator's job pre-merge; never `db push`, never `--accept-data-loss` |
| 6 | Security threats (§7) | §7 — including the stated reason no dedicated threat-model artifact is gated, and the condition (DG-3) that reverses it |
| 7 | Performance tests (§8, reference dataset) | §8 — P1–P6, with P4 flagged as a target the current implementation fails |
| 8 | Feature flag + rollout | §1.9, §2.4, §3.6, §4.3, §5.4, §6.3 — env-var `*_ENABLED`, **opt-in, default off everywhere including production**, parse shape per `backend/src/lib/readiness/recordDecision.ts:236-239` (and **not** `dataRetentionWorker.ts`, which is opt-out — §1.9) |
| 9 | Rollback / recovery | §9 — flag flip per increment; additive migrations not rolled back; G4a and G3.3 are the unflagged increments and why |
| 10 | Acceptance tests | **AT-G1…AT-G39**, in §1.8, §2.4, §3.6, §4.6, §5.4, §6.4. Prefixed namespace; releases C5's AT-157…AT-169 reservation (header) |
| 11 | Pilot acceptance owner | §9 — Jay for every increment; G4c additionally needs a named external client |
| 12 | Production monitoring | §8 — existing request metrics cover new routes; the `product_events` gap is DG-8 |
| 13 | Exit-gate evidence | §9 table, per increment |

---

## 13. Rev 2 review disposition

Every tag from the adversarial review of Rev 1 (6.5/10, "Rev 2 required"), with where it landed. **Folded** = the spec changed. **Folded with correction** = the finding was right, the supporting detail was not, and the correction is encoded. **Refuted** = the claim did not survive re-derivation.

### Blockers

| Tag | Disposition | Where |
|---|---|---|
| **GR-B1** jsPDF randomises `/ID` and stamps wall-clock `/CreationDate` | **Folded.** Independently re-verified: `npm pack jspdf@4.2.1`, read `dist/jspdf.node.js`, and confirmed at runtime against a real install. Every line citation held. Added two facts the review did not have: `setFileId` **uppercases** and **silently falls back to random** on a value failing `/^[a-fA-F0-9]{32}$/` (so the literal must be uppercase, and AT-G20 is what makes a typo loud), and the `D:` regex restricts the year to **1970–2037**. Also lazier than the review's prescription: `frontend/src/lib/pdf/jsPdfRuntime.ts` **already exists** as the single jsPDF seam all eight generators import, so `pinPdfIdentity` goes there — no new module | §0.2 Finding 3 · §4.2 Step 0 · §4.6 AT-G20 |
| **GR-B2** `verify-marketing-claims` cannot load the manifest, and would write to production | **Folded with correction.** All three sub-claims verified and one strengthened: the entry-guard absence is **universal** (0 of 40 files have any guard form). **Correction:** the review's own grep counts are inflated — 39 of the 3,540 `pointType:` hits are the `pointType: item.pointType` mapper line present in 39 of 40 files. Real counts are **3,501 / 939 / 152**, and the parse patterns are specified to require a **quoted literal** for exactly this reason. AT-G39 fences both the DB risk and the mapper artefact | §6.2 item 2 · §7 row 9 · §6.4 AT-G39 |
| **GR-B3** `RevisionIssue` cannot record a global template | **Folded, with a third option the review did not offer.** The contradiction is real and verified (`ITPTemplate.projectId` is `String?` `:672`; seeders write null). **Rev 2 rejects both proposed fixes.** (a) nullable `projectId` taxes every query on the shared table and breaks §7 row 1's literal truth, to accommodate one entity type; (b) a second table duplicates the timeline. Taken instead: `RevisionIssue` stays strictly project-scoped and the global library uses its **own `supersededById` chain** plus two nullable columns — because global-scope is a one-model problem (only `itp_template` has a project-less variant; drawings and the three `Document`-backed classes always carry a `projectId`) | §1.3(a) · §2.2(a),(f) · §1.8 AT-G36 |
| **GR-B4** §3.3 and DG-5 are factually wrong at HEAD | **Folded in full — the most serious finding.** All evidence confirmed: the shell grant (2026-07-27), the A5-v discharge, all three PRs as ancestors of HEAD, and `SyncPanel.tsx` as a fifth surface. Rev 1 breached §0.1 on the one claim that cost a Jay decision. DG-5 deleted, §3.3 re-surveyed at `1e6ed156` (five surfaces + three adjacent), G3.3 re-scoped to the office half — **ungated, unflagged, net deletion**, and explicitly **not** building the `<SyncStatus>` component the sync-centre spec refuses at `:541` | §3.3 · §9 · §11 DG-5 · §10 unknown 7 |
| **GR-B5** §1.4's issue row contradicts its own footnote | **Folded, with a narrower disagreement.** `DRAWING_WRITE_ROLES` verified as 7 roles including foreman. The matrix is now **per-class, each row citing its shipped precedent**. Departure from the suggested resolution: ITP templates get **`TEMPLATE_MANAGER_ROLES` (5, incl. `site_manager`)** from `templateAccess.ts:9-15`, not a 4-role quality set — narrowing to 4 would regress `site_manager`'s existing ability to manage templates, which is the same class of unrequested change the blocker objects to. Also recorded: the three `Document`-backed classes deliberately do **not** copy `DOCUMENT_WRITE_ROLES`, which admits subcontractors because it is an evidence-upload gate | §1.4 |

### Amendments

| Tag | Disposition | Where |
|---|---|---|
| **GR-A1** "Stable pagination" scoped as an assertion, not work | **Folded — decided, not left open.** AT-G23 scoped at build time to the fixtures that pass, with the passing set enumerated in the PR body; failures file to a new **G4d** (size M, the one boundary-widening increment) under **DG-10**; "stable pagination" moves to excluded-with-owner for G4a. The review asked whether the fixtures would mostly pass — **that is unknowable today**, because the harness fakes text metrics (`pdfTestRecorder.ts:47,88`), so it is recorded as unknown 9 rather than guessed | §4.5 · §4.6 · §11 DG-10 · §10 unknown 9 |
| **GR-A2** Flag convention cited from two opposite examples | **Folded, plus one more trap found.** Both verified as opposites. Additionally: `recordDecision.ts`'s doc comment at `:233` ("default FALSE … including production") is **stale relative to its own file header at `:27-29`**, which records production running TRUE since 2026-07-26. Rev 2 reuses the parse shape, not the comment | §1.9 |
| **GR-A3** Checklist-item identity is per-project | **Folded.** `ITPChecklistItem` (`:698-717`) verified to have no lineage column — and no timestamps either. Adopted the cheap fix: `sourceChecklistItemId` written at the same two call sites `notes` is being fixed in, with root-walking aggregation and an explicit no-description-matching rule | §2.2(c) · §2.4 AT-G9 · §5.3 |
| **GR-A4** `parseTemplateSnapshot` discards new top-level fields | **Folded.** Verified — field-by-field reconstruction at `:73-82`, no spread in the file. Added the asymmetry the review noted and one it did not: the **writer** `.map()`s items to an 8-field literal, so it strips item extras the **reader** would have preserved. Also: an unparseable snapshot falls through to the **live template** silently, so the backfill must select on `IS NULL` only | §2.2(d) · §2.4 AT-G11, AT-G12 |
| **GR-A5** `LotGoverningRevision` has no tenancy and no uniqueness | **Folded in full.** Added `projectId` (denormalised, indexed), the partial unique on active rows, and the `linkedBy` relation with `SetNull` | §1.3(c) · §1.7 E7 · §1.8 AT-G38 |
| **GR-A6** E2's per-class unique is unbuildable for `Document`-backed classes | **Folded.** E2 and AT-G7 scoped to drawings and ITP templates; the three `Document`-backed classes get a UI warning (new **E9**) instead of a constraint, and natural-key columns are excluded-with-owner | §1.6 · §1.7 E2, E9 |
| **GR-A7** §1.5 pre-answers DG-1; `entityType` names non-existent values | **Folded, one half refuted.** The DG-1 pre-answer is now stated with its re-sizing consequence. **Refuted:** `'specification'` **is already present** in `DOCUMENT_TYPES` (`documentsUploadData.ts:43`) — only `approved_method` and `client_direction` are missing, so the unscoped work is two array entries. Also corrected: the schema field is `Document.documentType` (`:1684`), not `type` | §1.5 |
| **GR-A8** AT-G7's 409 does not match the handler | **Folded.** Verified: both guards throw `AppError.badRequest` → 400; `errorHandler.ts:304-311` maps P2002 → 409. AT-G7 now asserts both paths with both statuses, and the 400/409 inconsistency is recorded as pre-existing and deliberately unfixed | §1.8 AT-G7 · §1.7 E2 · §10 unknown 10 |
| **GR-A9** AT-G22 cannot run in one vitest process | **Folded.** Specified as two child processes via `node:child_process` comparing sha256 digests — stdlib, no new dependency, no second vitest project | §4.6 AT-G22 |
| **GR-A10** `RevisionAcknowledgement` permits a row addressed to nobody | **Folded.** Hand-written XOR CHECK constraint in migration 1, asserted by AT-G37 | §1.3(a) · §1.5 · §1.8 AT-G37 |
| **GR-A11** No one signs off the new public numbers | **Folded, and the numbers were measured rather than estimated.** The three-way mismatch is real: claimed 116 / 3,070 / 813 vs measured **152 / 3,501 / 939** (full) or 139 / 3,313 / 884 (five-authority subset). New **DG-9** gates the copy change; the spec states its own figures are a measurement, not yet the product's claim | §6.1 Defect 1 · §11 DG-9 · §10 unknown 1 |

### Notes

| Tag | Disposition | Where |
|---|---|---|
| **GR-N1** Wave G silently declines C5's AT-157…169 reservation | **Folded.** One line in the header explicitly releases the range | Header |
| **GR-N2** AT-G18 becomes a tautology once its own increment lands | **Folded.** Repointed to an invariant with teeth — no module outside `shell/` and `lib/offline/` declares its own sync-state union. The build-agent caution about `SyncStatusBadge` being mounted (2 sites, both verified) is stated next to it | §3.6 AT-G18 |
| **GR-N3** Byte goldens break on a dependency bump | **Folded.** Goldens pin page count + text-op extents; the `^` is dropped from `jspdf` so a bump is a deliberate PR | §4.2 Step 4 |
| **GR-N4** `repeatOffenders` is uncapped | **Folded.** Verified: `.slice(` appears exactly once in the file. Added the detail that the uncapped half also carries unbounded `ncrIds` and `categories` arrays | §5.2 gap 3 · §9 |
| **GR-N5** P1's baseline must be captured before G1 merges | **Folded.** Now a G1 **precondition** in both the P-table and the exit-gate row | §8 P1 · §9 |

### What the review got wrong

Four corrections, all re-derived at `1e6ed156`. None of them changes a verdict — each blocker and amendment still lands — but each would have been encoded as a false statement:

1. **The `pointType:` counts include 39 mapper lines** (`pointType: item.pointType`, present in 39 of 40 seeders). The library is 3,501 checklist points, not 3,540. This one matters most: it was headed for public marketing copy.
2. **`'specification'` already exists** in `DOCUMENT_TYPES` (`documentsUploadData.ts:43`). Only two document types need adding, not three.
3. **The schema field is `Document.documentType`**, not `Document.type`.
4. **The seeder lock call is at `:343`**, not "`:290+`" — immaterial to the argument, which holds, but a build agent would have looked in the wrong place.

---

## Sources

**Program:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` (Rev 1.2a) §2 (F0, F1), §3 (Wave G), §4, §5, §6, §7, §8, §9, §10, §11.
**Evidence register:** `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md`.
**Repo docs:** `docs/plans/f0-execution-spec-2026-07-24.md` · `docs/plans/a5a6-gap-survey-2026-07-25.md` · `docs/plans/a4-my-work-design-2026-07-26.md` · `docs/plans/wave-b-migration-importer-spec-2026-07-26.md` · `docs/plans/wave-f-claim-readiness-spec-2026-07-31.md` · `docs/plans/offline-sync-centre-spec-2026-07-28.md` · `docs/research/wave2-itp-matching-taxonomy-spec-2026-07-15.md`.
**Code:** every `file:line` above, read at `f944c39a`; every load-bearing citation re-read at `1e6ed156` for Rev 2, with §3.3, §6.1 and the §1.4 role sets re-derived there from scratch.

**Third-party source (Rev 2):** `jspdf@4.2.1`, published tarball (npm shasum `6ba0d263999313f91f369ee80ecf235046b2acd8`), `dist/jspdf.node.js` — `:1394-1410` (`setFileId` random branch), `:1402` (uppercasing), `:1431-1434` / `:1523-1526` (public API), `:1450-1471` (`convertDateToPDFDate`), `:1491` (`D:` regex), `:1496-1503` (verbatim string branch), `:3688`, `:3765`, `:4113-4114`. Behaviour additionally confirmed at runtime against a real install; the tarball was not vendored into the repo.

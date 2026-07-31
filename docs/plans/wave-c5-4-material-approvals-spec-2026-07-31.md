# Wave C5.4 Execution Specification — approval is two stacked layers, and CIVOS records both without granting either

**Date:** 31 July 2026 · **Rev 1**, authored at `origin/master` HEAD `ed202483` (`feat(itp): G2 template provenance, snapshot integrity and version compare (#1724)`).

**Status:** **specification cycle only. The build is a separate later go from Jay** — no PR under this spec may open until he gives it. Of the four phases below, **C5.4a is unblocked and shippable on that go**, C5.4b and C5.4c are **pilot-gated** on the same terms `[C5S-B4]` already imposes on C5.2, and **C5.4d is research-gated on U1** and should not be scheduled (DC5-7).

**All `file:line` citations in this document were opened and read at `ed202483`.** Nothing is carried forward from the parent spec or from either research document without being re-derived against the tree. Where the parent spec's Rev 2 text is now stale at this HEAD, §18.1 records it rather than repeating it.

**Program contract:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` §3 Wave C, **line 79** — the three clauses this spec owns are *"material/product approvals; supplier certificates; … rejected/quarantined material state"*. Also **§3 line 84** (the D2 pilot-validation requirement C5.2 already inherits two-thirds of), **§6 lines 121–131** (definition of done), **§7 lines 134–135** (threat-model gate and standing security requirements), **§8 lines 138–146** (performance targets and reference dataset), **§9 line 149** (this document's existence), **§10** (the evidence-grade scale).

**§19 proposes a program amendment** striking *"rejected/quarantined material state"* from line 79, on the same disposal basis and in the same in-line style the program already used for C3 at **line 77**.

**Parent spec, read not remembered:**
- `docs/plans/wave-c5-survey-material-traceability-spec-2026-07-31.md` (**Rev 2**) — C5.4 was *specified and BLOCKED* there (§3.2, §10). This document discharges those blocks. Its invariants bind here in full: `[C5S-B1]` (CIVOS records verdicts, never makes them), `[C5S-B2]`, `[C5S-B3]` (the docket domain is untouched), `[C5S-B5]`, `[C5S-B7]` (no `document.delete`), `[C5S-B8]` (no thirteenth multer — every file arrives as an already-uploaded `documentId`), `[C5S-B9]` (a `Document` FK owes its guard entries in the same PR).

**The research this spec is built on — both merged 31 Jul 2026, and it is built ON them, not alongside them:**
- `docs/research/c5-material-traceability-research-2026-07-31.md` — **RG-5**, **RG-6**, **RG-8**. Grade-A primary sources read from the actual specification PDFs. Its claim numbers (5.1–5.17, 6.1–6.14, 8.1–8.15), its seven modelling consequences and its seven unanswered items (U1–U7) are cited throughout by number. **No design decision below contradicts it, and where this spec goes beyond it, it says so and marks the gap.**
- `docs/research/c5-survey-tolerance-research-2026-07-31.md` — mostly C5.5-relevant. Two findings touch C5.4 and are used: the calibration-certificate-in-an-equipment-register requirement (**cl 2.4.2–2.4.3, 2.6.x**, at `:299-307`), which is a third independent instance of the numbered/expiring/status-bearing registration pattern; and the point-to-triangulated-surface method being permitted only *with the Principal's prior approval* (`:244`), which is a fourth instance of per-contract approval consuming a general capability.

**House style** matches C1, C2, C3, C5, D, E, F and G: numbered sections, explicit disposal of every program clause, a current-state map read at a stated SHA, a decision register with flip conditions, per-phase rollback, named acceptance tests continuing the shared series, an exit gate, and program §9's thirteen delivery-control items enumerated.

**Tag namespace.** `[C54S-*]` for this spec's own decisions, `[C54S-B*]` for blockers no PR may violate. `[C5S-*]`, `[C5R-*]`, `[C1C-*]`, `[C1R-*]`, `[C2L-*]`, `[C2R-*]`, `[C3S-*]`, `[C3R-*]`, `[D14R-*]`, `[DH-*]`, `[DR2-*]`, `[FR-*]`, `[WBR2-*]` are taken. Per the parent's standing warning, **never a bare `C5` tag** — `C5` is a live clause-number fragment across `docs/research/sa-dit-*.md` and `docs/research/vic-itp/01-earthworks-pavements.md`.

**Acceptance-test numbering.** Re-measured at `ed202483`: the highest number allocated anywhere under `docs/` is **AT-188** (`docs/plans/wave-c5-survey-material-traceability-spec-2026-07-31.md:758`), and that document declares **AT-189** free at its `:24`, `:736` and `:815`. `AT-157 … AT-169` remain deliberately reserved for D1c.1's in-flight numbers. Wave G took the separate `AT-G1 … AT-G39` namespace and Wave F took `AT-F1 … AT-F3`; neither touches the shared series. **C5.4 occupies AT-189 … AT-208. Next free after this spec: AT-209.** `[C54S-i]`

**Ponytail note.** The three program clauses this spec owns look like three subsystems and are not. *Rejected/quarantined material state* is **one nullable FK on a table that already exists**, copied field-for-field from a link the same table already carries — and the enforcement the research says AU civil actually uses turns out to be **already shipped and already correct** (§4.4). *Material/product approvals* is two tables, and the only reason it is two rather than one is a grade-A finding (RG-5) that CIVOS would otherwise have got wrong in a way that is expensive to undo. *Supplier certificates* is the one clause where the honest answer is **build nothing yet**, because the standard that would define its fields is behind DRM and was not read (U1). The largest contribution this document makes is not a table: it is §4.3's finding that **the approver AU civil names — the superintendent — is not a CIVOS role and never has been**, so a permission matrix granting anyone "approve" would have been a lie, and the shipped hold-point release columns are already the correct shape for recording an external party's decision.

---

## 0. What this slice is, what it deliberately is not

### 0.1 The one-paragraph version

A quality manager can answer the question a superintendent asks on day one of a concrete pour: **"is that mix approved, and prove it."** Two things must be true and CIVOS holds neither today. First, the mix or product must be **current on the road authority's register** — a numbered entry with a status and an expiry that is valid across every project that authority lets, held by the contractor's company, not by the job. Second, **the superintendent for this contract must have approved it for this contract**, gated by a hold point, consuming the first as its evidence. CIVOS files both, attributes both, shows the expiry, and surfaces the pair in the folio — and it **grants neither**. When material turns out to be non-conforming, CIVOS does not invent a quarantine state, because AU civil does not have one: it links the existing NCR to the delivery it concerns, and the prohibition on covering the work up is the one CIVOS already enforces.

### 0.2 The scope cut — the three program clauses, disposed

| Program line 79 clause | Disposition |
| --- | --- |
| *"material/product approvals"* | **IN, and it is two entities, not one.** `ProductRegistration` (Layer 1, company-scoped, cross-project, the authority's register entry — C5.4b) and `ProjectMaterialApproval` (Layer 2, project-scoped, per-contract, superintendent-attributed — C5.4c). RG-5 consequence 1. §4.2, §4.3. |
| *"supplier certificates"* | **SPECIFIED, NOT SCHEDULED — C5.4d, gated on U1.** The filing half already shipped in C5.1 (`DiaryDelivery.docketDocumentId`, `batchRef`). The structured half is a **per-authority, per-material profile**, not fixed columns — RG-6 refutes fixed columns outright, not merely warns about them (§4.5). Its base pack cannot be written: AS 1379 cl 1.7.3's item list is known only at **grade B** through a CCAA paraphrase (claim 6.2, U1). **DC5-7 recommends not scheduling it.** |
| *"rejected/quarantined material state"* | **NO SUCH STATE IS BUILT. The clause has no referent in AU civil practice** — RG-8, and the corpus search at claim 8.1 found zero material-quality uses of the word across ~200 authority documents. What ships instead is **one nullable FK linking an NCR to the delivery it concerns** (C5.4a, §4.4), because the record AU civil actually uses is the NCR and the enforcement is a prohibition on incorporation that **CIVOS already implements** (`lotConformable`, `backend/src/lib/readiness/predicates.ts:477-486`). **§19 proposes striking the clause from the program line.** |

### 0.3 The honesty rule, inherited and sharpened `[C54S-B1]`

`[C5S-B1]` said: *a conformance verdict is a certification; CIVOS records who made one, it never makes one.* C5.4 is the same rule applied to an **approval**, and it has a second edge the survey case did not:

**CIVOS never grants an approval, and CIVOS never withdraws one either.**

The withdrawal half is the new one and it is grade A. Claim 5.14: poor field performance does not void a registration directly — the route is that the Contractor or Superintendent *requests the mix be de-registered and listed as Withdrawn*, and **"withdrawal is an authority act, not a project act."** So:

- A registration's `status` is **transcribed from the register**, never computed.
- **No job, no cron, no request-time coercion ever writes `'expired'`.** Expiry is **derived and displayed** from `validTo` against the clock, and surfaced as a `warning` readiness item — never persisted, never flipped. A background task that changed a registration's status to `expired` would be CIVOS performing a de-registration, which is precisely the authority act claim 5.14 forbids it. `[C54S-B2]`, AT-192.
- The Layer-2 approval carries the **external approver's name and organisation** alongside the **CIVOS user who transcribed it**, in the shipped `HoldPoint` release-attribution shape (§4.3). A reader can always tell a transcription from a signature.
- `'not_stated'` is a first-class status value, exactly as `surveyorVerdict` has one (`backend/prisma/schema.prisma:2721`, CHECK at `20260805000000_c5_survey_record/migration.sql:42-44`), so "this authority publishes no status for this scheme" is a recordable fact rather than a value mapped onto `'general'` to make a column non-null.
- No user-facing string says CIVOS *approves*, *registers*, *certifies*, *validates* or *checks* a material. Permanent, inherited from `[C5S-B2]`, extended with the four approval verbs. AT-206.

### 0.4 The finding that changes the shape — the approver is not a CIVOS role

RG-5 is unambiguous about who approves at Layer 2: the **superintendent-equivalent**, called the *Administrator* by TMR (claim 5.1, MRTS50 cl 8.1), the *Principal* by TfNSW (claim 5.15, B80 cl 3.9.1) and the *Superintendent* by VicRoads (claim 5.10, Section 610 cl 610.07(b)). Never the designer, never the RPEQ, never the contractor.

**CIVOS has no superintendent role.** `backend/src/lib/roles.ts:6-18` declares eleven roles and `superintendent` is not among them; `ROLE_HIERARCHY` (`:26-38`) has no entry for it. The superintendent in CIVOS is an **external party reached by emailed token links** — stated as product truth at `backend/src/routes/copilot/chat/productKnowledge.ts:116`: *"Superintendents work entirely from the emailed links. There is no CIVOS inbox or queue for them to sign into."*

There is one place the literal string appears in a role array — `HP_RELEASE_ROLES = [...HP_REQUEST_ROLES, 'superintendent']` (`backend/src/routes/holdpoints/actionRoutes.ts:65`) and `HP_SUPERINTENDENT_RELEASE_ROLES` (`backend/src/routes/holdpoints/superintendentRecipients.ts:25-30`). **That member is unreachable as an effective project role**, because effective roles resolve out of `ProjectUser.role` / `User.roleInCompany` against the vocabulary in `roles.ts`. It is vestigial. **C5.4 does not add `superintendent` to `ROLES` and does not rely on that string.** Adding a twelfth role to a hierarchy that eight route-local const arrays read from is a change with a blast radius far outside this wave, and it is not needed: the shipped answer is already in the tree.

**The shipped answer.** `HoldPoint` records an external release as attributed data, not as an actor: `releasedByName` / `releasedByOrg` / `releasedAt` / `releaseMethod` / `releaseSignatureUrl` / `releaseNotes` (`backend/prisma/schema.prisma:855-860`). A CIVOS user with an internal role performs the write; the columns say who actually decided. **`ProjectMaterialApproval` copies that shape verbatim** (§4.3). This is `[C5S-B1]` expressed as a schema rather than as prose, and it means the §7.3 permission matrix grants *"record that the superintendent approved"* — which is implementable — rather than *"approve"*, which is not.

### 0.5 What the research refuted, and what this spec does about it

Three things a competent agent would have built without the research, each now foreclosed:

1. **One `material_approval` table.** Refuted by RG-5 consequence 1. Registration data would be duplicated per project, or project approvals would be unable to differ. Two tables, §4.1.
2. **A `supplier_certificate` table with fixed columns.** Refuted — *"not merely risky"* — by RG-6 consequence 5. Four authoritative field lists exist for two materials, they are not supersets of one another (claims 6.2, 6.7, 6.9, 6.12), asphalt has **no** governing standard at all (6.11, a grade-A negative across three authority documents), and QLD declines to specify asphalt docket contents (6.14). Profile-driven, §4.5 — and not scheduled, DC5-7.
3. **A quarantine state machine.** Refuted by RG-8. Zero material-quality uses of `quarantin*` across the whole corpus (8.1); the concept is a *warehouse* one and AU civil delivery is just-in-time to a lot, so there is no inventory to hold (research §RG-8 closing); material rejected at delivery generates **no record at all** (8.14). One FK, §4.4.

**A fourth thing the research foreclosed that this spec would otherwise have got backwards:** the NCR grain. RG-8 claim 8.15 establishes that the nonconformance record is **lot-scoped by specification** (TMR MRTS50 cl 7.1, 7.2(e)–(f); TfNSW Q6 cl 3.9), which *validates CIVOS's existing `NCRLot`* against the parent spec's stated worry that it might be the wrong grain (`wave-c5-…:47`). C5.4 therefore re-grains nothing.

---

## 1. Outcome, scope and non-goals

### 1.1 Outcome

1. **A material's authority standing is answerable from the company, once.** A registration number, the scheme that issued it, its status, the dates it is valid between, and the certificate filed as a retrievable document — recorded once and readable from every project that company runs.
2. **A material's contractual standing is answerable from the project.** Who approved it for this contract, on what date, by what method, against which registration, with which hold point released — and which CIVOS user transcribed that.
3. **An expiring registration is visible before it bites**, as a `warning` readiness item on the projects that reference it — never as a status CIVOS wrote.
4. **A non-conforming delivery reaches its NCR in one click and the NCR reaches the delivery.** No new state, no second workflow, no duplicate of a shipped flow.
5. **Nothing is automatically decided.** C5.4 adds **no blocking readiness code**, moves no lot to conformed, gates no claim and releases no hold point. `[C5S-B5]` binds unchanged.
6. **The one clause with no referent is struck from the program**, with its citation, rather than built as a plausible-looking table nobody can fill in (§19).

### 1.2 Non-goals — do not build in C5.4

- **No quarantine state, no material status machine, no segregation flag, no "on hold" material.** `[C54S-B3]`. RG-8. Not behind a flag, not as a UI-only affordance.
- **No record of material rejected at delivery.** Claim 8.14: two jurisdictions, two materials, same answer — removal, not retention in a state; and under AS 4000 cl 29.3(d) it is *"not deliver it to the site"*, an exclusion rather than a state (8.13). MRTS70 cl 11.1 asks only that *"a visual record should be kept"* — **a `should`, and a photo**. A photo already has a home: category `'Material Delivery'`, `backend/src/routes/documents/classificationRoutes.ts:47`. Nothing to add.
- **No `Supplier` entity and no supplier approval.** `DiaryDelivery.supplier` stays the free-text column it is (`backend/prisma/schema.prisma`, within `:1312-1347`). RG-5 is explicit that the submitter is always the **Contractor, never the supplier directly** — so a supplier registry approves nothing and would be a directory, which is not what the clause asks for. What *is* registered per-supplier is a **product** (claim 5.5: cementitious materials must be *a registered product supplied by a registered supplier*), and that is Layer 1, where supplier is a field.
- **No CIVOS-computed approval, expiry flip, or currency verdict.** `[C54S-B1]`, `[C54S-B2]`.
- **No new role.** §0.4. `superintendent` does not join `ROLES` (`backend/src/lib/roles.ts:6-18`).
- **No change to the NCR workflow.** C5.4 adds one nullable FK and one create-time validator to `NCR`. It adds no status, changes no transition, and touches neither `CLOSED_NCR_STATUSES` (`backend/src/lib/readiness/predicates.ts:337`) nor `assertNcrLinkableLots` (`backend/src/routes/ncrs/ncrLotStatus.ts:15-26`).
- **No AI extraction.** No certificate reader, no register scraper. If one is ever built it rides `AiProposal` with a server-side whitelist normaliser (`backend/src/routes/copilot/projectFactsExtraction.ts:91-95`), never the bespoke inline loop at `backend/src/routes/testResults/certificateIntake.ts:261-271`. Inherited `[C5S-d]`.
- **No new upload route, no thirteenth multer, no new magic-byte signature kind.** `[C5S-B8]` binds unchanged: every C5.4 file arrives as an already-uploaded `documentId`, exactly as `POST /api/surveys/:id/report` does.
- **No structured certificate fields in C5.4a–C5.4c.** They are C5.4d's and C5.4d is gated (DC5-7).
- **No docket-domain change.** `[C5S-B3]` binds unchanged: nothing under `backend/src/routes/dockets/`, no column on `daily_dockets` / `docket_labour` / `docket_plant`, and the three hard-coded `approvedDockets: 0` producers stay at zero.
- **No second readiness engine, no cached verdict column, no recalculation job.** Inherited `[C2L-B3]` via `[C3S-B2]`.
- **No `ImportBatch.kind` claim.** `'test_register'` stays reserved and parked; C5.4 adds no import kind.
- **No tenant-authored registration vocabulary.** The status vocabulary is a `CHECK`. Tenant-authored rulesets are F0's definition model and C3 §1.3 already refused to invent a fourth definition store.

### 1.3 What is pilot-gated, and why the gate is real

Program line 84 requires validation *"with surveyors, contractors, and ≥3 receiving councils"* before the D2 workflow is defined; C5.2 inherited two-thirds of that as `[C5S-B4]`. C5.4 inherits it on the same terms, and the split is the same one §1.3 of the parent draws.

**Structurally safe without pilot validation** — because correctness does not depend on how anyone works: a registration row's existence, its number, its filed certificate, its dates, its company scoping, its cross-project readability, its immutability rules; the NCR↔delivery FK; the folio projection.

**NOT safe without pilot validation** — because it encodes a claim about how a real job runs: **whether a head contractor will maintain a registration register at all** (this is U2, and it is the one grade-C unblock condition RG-5 did **not** meet — *"the column set of a head contractor's own approved-materials register remains unknown"*); whether Layer 2 is one approval or a submission-plus-approval pair; and whether the hold-point link is worth capturing structurally or is just a note.

**The resolution `[C54S-B4]`:** C5.4b and C5.4c ship **behind the flag**, and the flag stays off for every tenant until **one real material approval has round-tripped with a real contractor** — a registration recorded from a real certificate, an approval recorded from a real superintendent instruction, both appearing in a folio. The status vocabulary is `CHECK`-constrained so correcting it is a reviewed migration, not a data drift. Pilot acceptance owner: **Jay**, with a design-partner contractor (§17 item 11).

**C5.4a is not pilot-gated** and ships unflagged. It is one nullable FK plus a create-time validator on a flow that already exists, it duplicates a shipped pattern exactly (`NCR.linkedTestResultId`), and it discharges a program clause on its own.

---

## 2. Current-state map (read at `ed202483`)

### 2.1 What C5.1–C5.3 shipped, and what C5.4 stands on

| Thing | Where |
| --- | --- |
| **The delivery record** | `DiaryDelivery` `backend/prisma/schema.prisma:1312-1347` — now carrying `docketDocumentId String?` `:1327` (FK `onDelete: Restrict`, relation `:1342`) and `batchRef String?` `:1329-1331`. The schema comment on `batchRef` names this wave by name: *"Free text, never parsed and never validated against a vocabulary — structuring it is C5.4, behind RG-6."* `@@index([lotId])` `:1345`; `@@unique([diaryId, requestKey])` `:1344`. |
| **The evidence-mutation route** | `PATCH /api/deliveries/:deliveryId/evidence` — `backend/src/routes/deliveries/index.ts:252-344`. `EVIDENCE_FIELDS` `:109`, `.strict()` body schema `:112-118`, `DELIVERY_EVIDENCE_EDITORS` `:71-79`, `requireEffectiveProjectRole(..., { requireWritable: true })` `:281-287`, `requireLotInProject` `:293`, same-project document check `:296-302`, hard-fail in-transaction audit `:330-337`. |
| Delivery read routes | `GET /api/lots/:lotId/deliveries` `:174`, `GET /api/projects/:projectId/deliveries` `:207` — both `requireInternalProjectAccess` (`:187`, `:211`). Mounted `backend/src/server.ts:159-160`, `:169`. **Note the mount file: `server.ts`, not `index.ts`** — `backend/src/index.ts` is a bootstrap that dynamically imports `./server.js`. |
| **The survey record** | `SurveyRecord` `backend/prisma/schema.prisma:2691-2750`; migration `backend/prisma/migrations/20260805000000_c5_survey_record/migration.sql` with **seven** CHECK constraints (`:38-60`). This is C5.4's nearest structural sibling and the source of its lifecycle idioms. |
| **The flag idiom** | `surveyRecordsEnabled()` `backend/src/routes/surveys/statusWorkflow.ts:73-76` — a verbatim copy of `readinessSnapshotsEnabled()` (`backend/src/lib/readiness/recordDecision.ts:236-239`). Enforced by **per-route** middleware `requireSurveyFlag` (`backend/src/routes/surveys/index.ts:170-176`), never `router.use` — the comment at `:164-168` records why: a router-level gate would 404 all of `/api/lots` when the flag is off. **There is no shared `featureFlags.ts`; each flag is a local function.** |
| Folio contract | `FOLIO_PAYLOAD_SCHEMA_VERSION = 2` `backend/src/lib/handover/revisionTokens.ts:121`; `FolioSourceType` `:32-40` (eight members, now including `'survey_record'` and `'diary_delivery'`); `REVISION_TOKEN_KINDS` `:49-68`; `FolioEvidencePayload` `backend/src/lib/handover/folioPayload.ts:176-191` (`surveys` `:188` flag-gated, `deliveries` `:190` unflagged); `countEvidenceRows` `:207-220`. |
| Readiness | `EvidenceReadinessArea` `backend/src/lib/evidenceReadiness/core.ts:8-22` — twelve members; `'survey'` at `:19`, and the comment at `:17-18` records that deliveries deliberately reuse `'diary'`. `READINESS_REASON_CODES` `backend/src/lib/readiness/contracts/reasonCodes.ts:29-98` with `'delivery_not_lot_linked'` `:94` and `'survey_not_accepted'` `:97`. `HANDOVER_BLOCKING_REASON_CODES` `:127-150`, nine members, **neither C5 code is one**. |

### 2.2 The NCR and hold-point machinery C5.4 links to

| Thing | Where |
| --- | --- |
| **`NCR`** | `backend/prisma/schema.prisma:1065-1155`. **Project-scoped** (`projectId` `:1067`), lot association entirely through the join table. `status String @default("open")` `:1073` — **no DB CHECK; validation is app-level only**. `severity` `:1072`. Root-cause and corrective-action columns already exist: `rootCauseCategory` `:1083`, `rootCauseDescription` `:1084`, `proposedCorrectiveAction` `:1085`. Concession machinery `:1094-1096`. |
| **The FK pattern C5.4a copies** | `linkedTestResultId String?` `:1074`; relation `linkedTestResult TestResult? @relation("NcrLinkedFailedTestResult", …, onDelete: SetNull)` `:1136`; **`@@index([linkedTestResultId])` `:1151`**. Set **create-only**: validator `requireFailedTestResultForNcr` `backend/src/routes/ncrs/ncrCore.ts:155-187`, called `:279-283`, written `:308`, audited `:373`. Present in `createNcrSchema` (`backend/src/routes/ncrs/ncrCoreValidation.ts:107`) and **absent from `updateNcrSchema`** (`:127-144`). |
| **`NCRLot`** | `:1157-1167` — a pure join table, no payload, `@@unique([ncrId, lotId])`, both FKs `Cascade`. One NCR to many lots. **No index on `lotId` alone.** |
| `NCREvidence` | `:1169-1181` — `ncrId` + `documentId` + `evidenceType String`, `@@unique([ncrId, documentId])`. |
| NCR status vocabulary | Not a CHECK and not a transition map. The only enumerated list is a **query filter**: `NCR_STATUS_FILTERS` `backend/src/routes/ncrs/ncrCoreValidation.ts:25-33`. Writes are hard-coded literals in each handler, guarded by conditional `updateMany({ where: { id, status: <expected> } })`. Terminal states are canonical at `CLOSED_NCR_STATUSES = ['closed', 'closed_concession']` `backend/src/lib/readiness/predicates.ts:337`. |
| NCR role consts | `backend/src/routes/ncrs/ncrAccess.ts` — `NCR_CREATE_ROLES` `:32-40`, `NCR_QUALITY_MANAGEMENT_ROLES` `:41-47`, `NCR_QM_APPROVAL_ROLES` `:48`, `NCR_EVIDENCE_MUTATION_ROLES` `:49-53`. |
| **The prohibition on incorporation — already shipped** | `lotConformable` `backend/src/lib/readiness/predicates.ts:477-486` has `prerequisites.noOpenNcrs` as a hard limb. Driven by `conformancePrerequisites.ts:594-603` over a Prisma set pre-filtered by `status: { notIn: CLOSED_NCR_STATUSES }` (`:450-457`). Emitted as the blocking item `open_ncrs` at `backend/src/lib/evidenceReadiness/conformanceItems.ts:134-146`, and it **is** a member of `HANDOVER_BLOCKING_REASON_CODES` (`reasonCodes.ts:134`). |
| **`HoldPoint`** | `:844-885`. Lot-scoped (`lotId` `:846`, Cascade), anchored to an ITP checklist item (`itpChecklistItemId` `:847`, **`onDelete: Restrict`**), `@@unique([lotId, itpChecklistItemId])` `:879`. **There is no free-standing hold point** — every one hangs off a checklist item. **Release attribution `:855-860`** — the shape §4.3 copies. Release route `POST /api/hold-points/:id/release` `backend/src/routes/holdpoints/actionRoutes.ts:209-210`; `HP_RELEASE_ROLES` `:65`; preconditions `:146-156`; completion guard `backend/src/routes/holdpoints/releaseCompletionGuard.ts:10-18`; sequence prerequisites `backend/src/routes/holdpoints/prerequisites.ts:36-41`. |
| **NOT FOUND** | `ProductRegistration` · `MaterialApproval` · `MixDesign` · `Consignment` · `Material` model · `quarantine` in any material sense · any material-scoped NCR. Grepped across `backend/prisma`, `backend/src`, `frontend/src`. |

### 2.3 The authority-vocabulary pattern C5.4 reuses — this is the load-bearing precedent

C1's sufficiency rulesets are the shipped answer to "per-authority reference data with provenance", and RG-6 consequence 5 points at it by name (*"the shape C1 already uses for authority vocabularies"*). Read at `ed202483`:

**Storage is code, not database rows**, and the reasoning is written down at `backend/src/lib/readiness/sufficiency/types.ts:11-13`: *"a seeded authority ruleset is shipped product data with provenance, reviewable in a PR diff, CI-testable and revertable by `git revert`."*

The type — `types.ts:289-334`:

```ts
export interface Ruleset {
  id: string;                        // 'vicroads-204.v2' — version in the id
  state: string;                     // matched case-insensitively against Project.state
  specSet: string;                   // pre-normalized via itpMatcher.normalizeSpecSet
  scaleKeys: readonly string[];
  defaultScale?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: RulesetStatus;             // 'draft' | 'confirmed'
  materialTypes?: readonly string[];
  scaleLabel?: string;
  rules: readonly FrequencyRule[];
  provenance: RulesetProvenance;
  revalidationLapsed?: boolean;      // RUNTIME-ONLY, never declared, never persisted
}
```

Provenance is **mandatory and every field required** — `types.ts:19-35`: `authority`, `document`, `edition`, `clause`, `pdfPage?`, `sourceUrl`, `evidenceGrade: 'A'|'B'|'C'|'D'`, `checkedOn`, `revalidateBy`. *"An unprovenanced rule cannot be registered."*

Resolution is `(Project.state, Project.specificationSet)` → newest in-window pack — `registry.ts:124-147`. Registration is **explicit static imports**, deliberately not a dynamic manifest — `rulesets/index.ts:53`. CI validates every shipped pack (`validateRuleset` `registry.ts:582-634`; `validateProvenance` `:512-575`): a `confirmed` pack must carry grade A, a `pdfPage`, an ISO `checkedOn` and a future `revalidateBy`.

**And the mechanism that makes stale authority data safe rather than wrong** — `registry.ts:100-122`: a `confirmed` pack past its `revalidateBy` is **degraded to `draft` at runtime**, never dropped and never blocking, because a `draft` ruleset structurally cannot block (`types.ts:299-303`). A malformed date reads as lapsed.

Three-tier exposure: the pack declares the vocabulary; one auth-only, non-project-scoped read route serves it byte-identically to every tenant (`GET /api/test-sufficiency/rulesets`, `backend/src/routes/testSufficiency.ts:21-76`, serving **live packs only**); and one route-level whitelist is the trust boundary (`assertLotSufficiencyAttributes`, `backend/src/lib/readiness/sufficiency/lotAttributeValidation.ts:52-87`, `materialType` branch `:74-86`). That whitelist's header (`:1-24`) records why a single choke point is mandatory: its module-private predecessor had one call site, so four of five write paths wrote the value unchecked — **named as a privilege bypass that was invisible afterwards**.

`Lot.materialType` `backend/prisma/schema.prisma:613` is the existing consumer, and its comment (`:605-612`) already states the generalisation C5.4d would extend: *"the PACK declares which strings it recognises (`Ruleset.materialTypes`) and the route validates against them, so the column generalises while the values stay authority-scoped."*

### 2.4 The tenancy shapes available, and the one that does not exist

| Helper | Where | What it answers | Archived-project check |
| --- | --- | --- | --- |
| `requireCompanyAdmin(user)` | `backend/src/routes/company/access.ts:6-17` | "is this JWT an **owner or admin** of a company" — returns `companyId`. **Synchronous, zero DB I/O**, reads JWT claims. | n/a |
| `requireInternalProjectAccess` | `backend/src/lib/projectAccess.ts:212-231` | "does this non-portal user hold any internal role on THIS project". Rejects portal roles twice (`:217`, `:226`). | **no** |
| `requireEffectiveProjectRole` | `:180-210` | "is the effective role in `allowedRoles`" — company owner/admin auto-granted (`:161-167`); `assertProjectAllowsWrite` at `:205-207` under `requireWritable: true`. | **yes** |

**There is no `requireCompanyMember`.** A register readable only by `requireCompanyAdmin` would be readable only by owner and admin — which excludes the quality manager, who is the persona §0.1 is written for. §4.6 resolves this without inventing a helper.

Company-scoped precedents that do exist: `ImportMappingProfile` `backend/prisma/schema.prisma:2384-2408` — nullable `projectId` `:2386` **and** nullable `companyId` `:2387`, `isBuiltIn` `:2397`, `@@index([companyId, kind])` / `@@index([projectId, kind])` `:2405-2406`; its visibility query authorises via **`project.companyId`, never the JWT's** (`backend/src/routes/copilot/import/routes.ts:473-481`, re-validated at time of use `:521-536`, scope chosen at create `:560-578`). And `GlobalSubcontractor` `:1397-1414`, a company directory whose rows are **copied** into project rows with a `SetNull` lineage FK (`SubcontractorCompany.globalSubcontractorId` `:1419`, `:1435`).

`ITPTemplate` is a **weaker** precedent than it looks: it has **no `companyId` at all** (`:680-745`); `projectId == null` means global/seeder-owned, and globals are API-read-only (`backend/src/routes/itp/templateAccess.ts:122-127`). Its manage guard is still the right *shape* to copy — company-admin **or** a project role const: `TEMPLATE_MANAGER_ROLES` `:9-15`, gate `:65-73`, `hasCompanyAdminAccess` `:57-58`.

**There is no company delete route and no company retention guard.** Grepped: `companyRouter` (`backend/src/routes/company.ts:52`) exposes GET/POST/PATCH plus mounted member and API-key routers (`:348-349`) and no `.delete`. `Project.company` is `onDelete: Restrict` (`:416`), so a Prisma-level company delete would FK-fail while any project exists, but there is no route, no guard and no message. **Consequence for C5.4:** a company-scoped table owes nothing to `RETAINED_PROJECT_RELATIONS`; a project-scoped one owes both halves (§2.5).

### 2.5 The three hand-written registries a new FK must join

Re-measured at `ed202483`. The parent spec's `[C5S-B9]` said "two"; **at this HEAD it is three**, because C5.1/C5.2 have since landed and the retention guard has grown a second half.

1. **`EVIDENCE_LINK_GUARDS`** — `backend/src/routes/documents/evidenceLinkGuards.ts:25-112`, entry type `:16-23`, four entries: `'ncr'` `:27`, `'variation'` `:50`, `'delivery_docket'` `:74`, `'survey_report'` `:96`. Consumed by `assertDocumentDeletableOutsideEvidenceWorkflow` `:145-159` and `assertEvidenceMetadataMutable` `:163-176`. **Two shipped tests assert `delivery_docket` is the third entry by position** — `backend/src/routes/documents/access.test.ts:10` and `deleteRoutes.test.ts:76`. **C5.4 appends; it does not insert.** `[C54S-B7]`
2. **`GENERIC_VERSIONING_BLOCKS`** — `backend/src/routes/documents/versionRoutes.ts:70-109`, consumed by `assertDocumentCanUseGenericVersioning` `:111-128`, called `:186`. Four probes: `'itp'` `:76-79`, `'ncr'` `:82-85`, `'delivery_docket'` `:87-97`, `'survey_report'` `:98-108`. **It explicitly does not read `EVIDENCE_LINK_GUARDS`** — the comment at `:62-67` says so. Order is precedence (`:69`).
3. **The project retention guard, both halves** — `backend/src/routes/projects/writeRoutes.ts`. `RETAINED_PROJECT_RELATIONS` `:44-68`, **eighteen** members, whose comment at `:60-64` declares it *"the AUTHORITY — the `_count` select alone is inert"*. The Prisma `_count: { select: {…} }` at `:692-716` is a **separate hand-maintained list of sixteen** (`surveyRecords: true` at `:714`); the two members List A has that List B does not (`auditLogs`, `comments`) are supplied by a manual spread at `:724-733`. Type coupling makes an *omission* a compile error, but **adding a new project-scoped table requires editing both places by hand** — which is `[C5R-A7]`'s lesson restated with the second half now visible. Conflict thrown `:736-741`.

### 2.6 Frontend — the honest state

**There is no delivery register page.** C5.1 shipped backend-only: `grep -rni "deliveries" frontend/src` returns diary, offline and PDF files only; `frontend/src/App.tsx` has no deliveries route. Any C5.4 UI claim that assumes a delivery register exists to hang off is false at this HEAD.

The shipped project-level register idiom is `frontend/src/pages/variations/VariationsPage.tsx` (routed `App.tsx:499-503`), with per-page `hooks/` + `components/` and the shared `useRegisterDeepLink`, `useIsMobile`, `usePullToRefresh`, `ContextFAB`, `ContextHelp` and `@/lib/statusLabels`. The other idiom, used by lots/tests/NCRs/hold-points, adds `@/components/registers/SavedViewsMenu`.

**The only shipped company-scoped surface is `frontend/src/pages/company/CompanySettingsPage.tsx`**, a sectioned page routed at `App.tsx:582-589` under `COMPANY_ADMIN_ROLES = ['owner', 'admin']` (`frontend/src/appRouteRoles.ts:6`). There is no third precedent for a company-wide register.

---

## 3. Research standing — what is discharged, what still gates

### 3.1 The three blocking gaps, discharged

| ID | The gap as the parent stated it | Status at this spec | Evidence |
| --- | --- | --- | --- |
| **RG-5** | Material/product approval practice: who submits, who approves, what artefact records it, per-project or per-supplier. | **DISCHARGED, grade A**, and the either/or in the question was the wrong question — the answer is **both, in a defined relationship**. Submitter: Contractor (5.2, 5.7, 5.15). Approver: superintendent-equivalent (5.1, 5.10, 5.15). Artefact: a registration certificate plus a hold-point release (5.4, 5.9, 5.10, 5.15). Scope: Layer 1 cross-project, Layer 2 per-contract (research consequence 1). **Not from the contract**: AS 4000-1997 contains no submittal, no register and no approval state (5.16). | §4.1–§4.3 |
| **RG-6** | What a supplier certificate / delivery docket must contain, for concrete and asphalt. | **DISCHARGED as a REFUTATION.** There is no single field list. Concrete has a base (AS 1379 cl 1.7.3) that authorities *extend* (6.1); asphalt has **no** governing standard (6.11, grade-A negative); QLD specifies no asphalt docket contents at all (6.14). A fixed-column table is wrong against at least two of four lists on day one (consequence 5). | §4.5, and DC5-7 |
| **RG-8** | Distinct quarantine/rejected-material state, or route through NCR. | **DISCHARGED as a NEGATIVE, grade A.** NCR, unambiguously (8.3–8.10). Zero material-quality occurrences of `quarantin*` across ~200 documents (8.1). The prohibition is a hold point on a *process*, not a status on a *material* (8.6, 8.8). Rejected-at-delivery generates no record (8.14). NCR is lot-scoped by specification (8.15), which validates `NCRLot`. | §4.4, §19 |

### 3.2 What the research explicitly did not close, and what each one gates

Carried forward verbatim from the research's own unanswered register. **A phase that needs one of these is marked gated below, not approximated.**

| ID | Question | Gates | What closes it |
| --- | --- | --- | --- |
| **U1** | The **verbatim item list of AS 1379 cl 1.7.3**, and which edition the CCAA rendering corresponds to. | **C5.4d, hard.** The base pack cannot be authored from a grade-B paraphrase that cites neither clause number nor edition. | A purchased copy of AS 1379. Specifically check whether *batch number* and *time of discharge* — in the TfNSW list (6.9), absent from the CCAA rendering (6.2) — are base-clause items or NSW additions. |
| **U2** | A **real head contractor's approved-materials register** and its actual columns. | **C5.4b's pilot gate.** RG-5's grade-C unblock condition is genuinely unmet — the *authority*-side register schema is now known (5.13), the *contractor*-side one is not. | One real register from a pilot contractor, or a practitioner interview. This is the `[C54S-B4]` round-trip. |
| **U3** | Whether contractors use "quarantine" **internally** even though no specification names it. | **Nothing.** Recorded because it would change UI vocabulary only, and the rule against inventing states binds regardless. | Practitioner interview. |
| **U4** | Whether AS/NZS ISO 9001 cl 8.7 lists **segregation** among permitted actions. | **Nothing.** The research grades this low value: even if listed, no AU civil specification adopts it as a state, and 8.14 shows practice goes the other way. | A purchased copy of AS/NZS ISO 9001. |
| **U5** | QLD asphalt **measurement**-side docket requirements (MRS30). | **Nothing.** A payment/quantity concern, and CIVOS computes no quantities or money on evidence documents. | Retrieve MRS30. |
| **U6** | SA (DIT), WA (MRWA), TAS, NT. | **C5.4b/C5.4d's national claim only.** Three of six authorities establishes a pattern, not national uniformity, and this spec does not claim uniformity. | Repeat the RG-5/RG-6 reads. Expected to confirm — the ATIC/CMRS scheme (5.5, 5.12) is already cross-jurisdictional. |
| **U7** | Certificate contents for **materials other than concrete and asphalt** — steel (AS/NZS 4671), precast, pipes, geotextiles. | **C5.4d's coverage.** Logan PSP5 (5.17) requires a supplier certificate *per delivery per material type* across **all** materials, so the question is real, just not asked yet. | A further RG-6-shaped pass. |

**Two new gaps this spec opens**, recorded here rather than discovered later:

| ID | The gap | Gates | What closes it |
| --- | --- | --- | --- |
| **RG-10** | **Whether a registration is held by the contractor's company or by the project's client.** RG-5 establishes the *authority* holds the register and the *contractor* submits; it does not establish whose CIVOS tenant the transcription belongs to when a contractor works for two clients under different specification sets. §4.6 decides company-scoped on the strength of "valid across all of that authority's projects" (5.10, 5.13) and records it as `[C54S-a]` with a flip condition. | **C5.4b's scoping only.** | The `[C54S-B4]` round-trip: ask the pilot contractor whether their mix registrations are a company asset or a job asset. One question, not a research pass. |
| **RG-11** | **Whether the Layer-2 approval and the hold-point release are one act or two.** Claims 5.4, 5.9, 5.10 and 5.15 all show approval *gated by* a hold point, but only NSW (5.15) makes the hold-point release *be* the approval act. This is RG-7's question one level over, and RG-7 was answered **differently per jurisdiction** by the tolerance research (`c5-survey-tolerance-research-2026-07-31.md:632-633`: NSW = hold point, QLD = witness points, VIC = no such act). | **C5.4c's `holdPointId` column being structural rather than a note.** | The `[C54S-B4]` round-trip. §4.3 makes the column nullable and non-load-bearing precisely so this can be answered late. |

### 3.3 What is structurally safe to build with none of it

The parent's line holds and C5.4 does not move it: **a filing structure is safe; a domain claim is not.**

Safe — a registration row's identity, number, dates, filed certificate, company scoping, immutability and folio projection; an approval row's attribution and its link to a registration; the NCR↔delivery FK; every tenancy and audit property of all three.

Unsafe — the statuses of a workflow nobody has watched (Layer 2), the fields of a certificate nobody has read the standard for (C5.4d), any CIVOS-computed currency verdict, and any state for material that AU civil does not keep a record of.

---

## 4. The design

### 4.1 Two layers, two tables, and why one table is the trap

RG-5 consequence 1, quoted because it is the whole argument: *"Modelling them as one table forces a false choice: registration data would be duplicated per project, or project approvals would be unable to differ."*

The two layers differ on **every** axis that drives a schema:

| | Layer 1 — `ProductRegistration` | Layer 2 — `ProjectMaterialApproval` |
| --- | --- | --- |
| Held by | the road authority, on a central register | the superintendent, for one contract |
| Scope | cross-project, per-authority-per-product | one project |
| Identity | a registration number issued by a scheme | a decision on a date |
| Status | a published vocabulary with an expiry (5.13) | approved / rejected — no published vocabulary exists |
| Revocation | de-registration to `withdrawn`, an **authority** act (5.14) | superseded by a new approval, a **contract** act |
| Gate | none — it is a register entry | a Hold Point (5.4, 5.9, 5.15) |
| Evidence in CIVOS | a registration certificate `Document` | an approval instruction `Document` |
| Tenancy | company | project |

**Three namespaces, not one.** Claim 5.6 is explicit that ATIC, QRS and the mix register *"are not interchangeable"*. So the registration number is not globally unique in CIVOS and must be scoped by its scheme — `@@unique([companyId, scheme, registrationNumber])`, §5.2.

**No shared abstraction, no `kind` discriminator.** `[C54S-b]`. Same reasoning as `[C5S-b]`: an abstraction over two rows with different tenancy, different lifecycles, different permission shapes and different revocation semantics is an interface with two implementations whose every method branches on the discriminator anyway.

### 4.2 Layer 1 — the product/mix registration (C5.4b)

**What it is.** One row per *(scheme, registration number)* the contractor's company relies on. A VIC concrete mix on the Register of VicRoads approved concrete mixes (5.10). A VIC asphalt mix on the DTP register at General or Conditional status (5.13). A cementitious product with an ATIC registration number (5.5, 5.12). A quarry with a Registered Quarry Reference number (5.6). One shape covers all four because all four are *a numbered entry on a named authority's register, with a status and a validity window*.

**The status vocabulary is borrowed, not invented.** `CHECK`-constrained to:

```
'general' · 'conditional' · 'expired' · 'withdrawn' · 'not_stated'
```

The first four are **published** — VicRoads/DTP Section 407 v18.0 (October 2025) cl 407.09, claim 5.13, described by the research as *"the single most useful RG-5 artefact found"*. This is exactly the class of thing `[C5S-B1]` exists to stop CIVOS guessing, and it did not have to be guessed.

`'not_stated'` is the fifth and it is load-bearing. The four published values are **one authority's, for one material** (VIC asphalt). TMR's cementitious scheme (5.5) publishes "registered" and nothing else; the Quarry Registration System (5.6) publishes a certificate with a testing-frequency schedule and no status; VIC concrete (5.10) publishes a 12-month validity and no status word. Mapping any of those onto `'general'` would be CIVOS asserting a status the register does not carry. `'not_stated'` records *"this scheme publishes no status; currency is the date window"* as a fact. It is the same call `surveyorVerdict` already ships (`backend/prisma/schema.prisma:2721`) and it is why that column has the value. `[C54S-c]`

**Expiry is derived, never written.** `[C54S-B2]`, and it is the sharpest edge in the wave.

- `validFrom` / `validTo` are nullable dates transcribed from the certificate. VIC concrete gives the semantics: *"registrations remain valid for 12 months from date of registration"* (5.10). VIC asphalt gives the test: registration *"must be current at the time of use"* (5.13).
- CIVOS computes `isCurrentAt(now)` at **read time** and shows it. It never persists the answer and never writes `status = 'expired'`.
- The reason is claim 5.14: withdrawal is an authority act. A CIVOS job that flipped a status would be performing a de-registration. **`'expired'` is in the vocabulary only because a register may publish it and a human may transcribe it** — never because CIVOS derived it.
- **The runtime-degradation precedent is exact.** `revalidationLapsed` / `degradeIfLapsed` (`backend/src/lib/readiness/sufficiency/registry.ts:100-122`) does precisely this for authority rulesets: computes lapse at read time, returns a *derived* `revalidationLapsed: true` on a copied object, persists nothing, and the field is documented `RUNTIME-ONLY, never declared in a pack, never persisted` (`types.ts:289-334`). C5.4b copies that idiom rather than inventing one. AT-192.

**Provenance is mandatory.** Copying `RulesetProvenance`'s discipline (`types.ts:19-35`) at row level rather than pack level, because these rows are tenant-transcribed rather than shipped: `authority` (required), `scheme` (required — the namespace), `sourceDocumentId` (nullable `Document` FK to the filed certificate), `recordedById` + `recordedAt` (required — who transcribed), `sourceNote` (nullable free text: which register, which page, when read).

**What it does not have.** No mix constituents, no proportions, no test results, no field list. Claim 5.3 shows TMR's mix-design submission runs to ten sub-clauses of constituent detail — that is C5.4d's territory if it is ever entered, and it is exactly the RG-6 field-list problem. Layer 1 records **that a registration exists and is current**, not what it is made of. `[C54S-d]`

**Revision.** MRTS30 cl 7.3.3 draws the line C5.4b encodes (claim 5.8): a minor grading/binder change is a **revision** (updated certified copy, 3 working days), but *"a change to the mix design constituents constitutes a new mix design"*; and MRTS70 cl 15.1 (5.4) is blunter — *"any change in material sources or types constitutes a variation."* So: a re-issued certificate for the same registration number updates the row and audits `{from, to}`; a new registration number is a **new row**, and the old row is superseded through `supersededById` in the `SurveyRecord` / `Drawing` shape. No in-place identity change. AT-194.

### 4.3 Layer 2 — the per-contract approval (C5.4c)

**What it is.** One row recording that the superintendent-equivalent for *this contract* approved *this material* for use, on a date, by a method — with the Layer-1 registration it consumed, and the hold point it released, both nullable links.

**The attribution shape is copied verbatim from `HoldPoint`** (`backend/prisma/schema.prisma:855-860`), which is the tree's existing answer to "an external party decided, an internal user recorded it":

```
approved_by_name          -- the superintendent / Administrator / Principal, as named on the instruction
approved_by_organisation  -- their organisation
approved_at               -- the date on the instruction, not the date of data entry
approval_method           -- how it was communicated: 'letter' | 'email' | 'site_instruction' | 'hold_point_release' | 'other'
approval_reference        -- their reference number, free text
approval_document_id      -- the instruction filed as a Document
recorded_by_id            -- the CIVOS user who transcribed. NOT the approver.
recorded_at
```

`recordedById` and `approvedByName` are **separate columns on purpose**, and every surface renders both — *"Approved by A. Smith (Superintendent, XYZ Pty Ltd) on 12 Aug 2026 · recorded by J. Ryan on 13 Aug 2026"*. That sentence is `[C5S-B1]` in the UI, and it is the property AT-206 asserts. §0.4.

**Statuses are minimal and pilot-gated.** `CHECK`-constrained to `'approved' | 'rejected' | 'withdrawn'`. Three, because **no published Layer-2 status vocabulary was found** — RG-5 delivers the register vocabulary (Layer 1) and nothing for Layer 2. Note there is deliberately **no `'submitted'` or `'pending'` state**: a row exists because a decision was recorded, and modelling the contractor's submission as a CIVOS state would be inventing the workflow RG-5 did not establish, on a record whose whole purpose is to hold somebody else's decision. If the pilot shows submissions need tracking before a decision arrives, that is a new state added by reviewed migration — which is why the vocabulary is a `CHECK`. `[C54S-e]`, `[C54S-B4]`.

**Consuming Layer 1.** `productRegistrationId` is a **nullable** FK, `onDelete: Restrict`. Nullable because claim 5.16 is decisive: AS 4000 has no approval regime at all, so a superintendent may approve a material under a contract with no authority register behind it, and forcing the link would make that unrecordable. `Restrict` because an approval that silently lost the registration it consumed is worse evidence than a delete that refuses — the same reasoning `docketDocumentId` used (`[C5R-B3]`'s note on `Restrict` over `SetNull`).

**Cross-tenancy on that FK is the sharp edge.** `ProjectMaterialApproval` is project-scoped; `ProductRegistration` is company-scoped. The link is only valid when the registration's `companyId` equals the **project's** `companyId` — not the acting user's. Validated inside the write transaction against `project.companyId`, exactly as `ImportMappingProfile`'s visibility does (`backend/src/routes/copilot/import/routes.ts:473-481`, re-validated at time of use `:521-536`). Taking it from the JWT would let a user who is company-admin of company A and a project member of company B's project attach A's registration to B's project. AT-200(c).

**The hold-point link is deliberately weak.** `holdPointId` is nullable, `onDelete: SetNull`, and **nothing depends on it** — no gate reads it, no readiness item requires it, no release is blocked by its absence. RG-11 (§3.2) is why: approval is gated by a hold point in all three jurisdictions, but only NSW makes the release *be* the approval act, and the tolerance research found the equivalent survey question answered three different ways by three authorities. A nullable annotation costs one column and answers the question in the pilot; a structural dependency would encode one jurisdiction's practice as CIVOS's model. `[C54S-f]`

**C5.4 releases no hold point and gates no release.** The release route (`backend/src/routes/holdpoints/actionRoutes.ts:209-210`) is untouched; `releaseCompletionGuard.ts:10-18` and `prerequisites.ts:36-41` are untouched. An approval row may *reference* a hold point that was released; it never causes one. `[C54S-B5]`

**Supersession.** Same mechanism as `SurveyRecord`, same guard shape as `requireSupersededByInProject` (`backend/src/routes/drawings.ts:37-66`), with the identity checks that make the chain meaningful. `SurveyRecord`'s identity is `(lot_id, kind)` because it has no reference column (`[C5R-A3]`); `ProjectMaterialApproval`'s identity is **`(project_id, material_key)`** — a required free-text material identifier transcribed from the instruction (the mix code, the product name). So the guard enforces **five** checks: not-self, same project, **same `material_key`**, same `product_registration_id` or both null, target-is-current. AT-201.

### 4.4 Nonconforming material — a link, not a state (C5.4a)

**The whole build is one nullable FK.** RG-8 says the record is the NCR and the enforcement is a prohibition on incorporation. CIVOS has both. What it lacks is the ability to say *which delivery* an NCR is about.

```prisma
linkedDeliveryId String? @map("linked_delivery_id")
// …
linkedDelivery DiaryDelivery? @relation("NcrLinkedDelivery", fields: [linkedDeliveryId], references: [id], onDelete: SetNull)
// …
@@index([linkedDeliveryId])
```

Copied field-for-field from `NCR.linkedTestResultId` (`backend/prisma/schema.prisma:1074`, relation `:1136`, index `:1151`) — including the `SetNull`, which means deleting the delivery nulls the link and never cascades an NCR away, and including the index, whose absence would be the easy thing to drop from the diff.

**Create-only, like its sibling.** Added to `createNcrSchema` (`backend/src/routes/ncrs/ncrCoreValidation.ts:107` is where `linkedTestResultId` sits) and **not** to `updateNcrSchema` (`:127-144`). Making it patchable would be new behaviour, not the shipped pattern. `[C54S-B6]`

**The validator mirrors `requireFailedTestResultForNcr`** (`backend/src/routes/ncrs/ncrCore.ts:155-187`) with the two assertions that matter:

1. **Same project.** The delivery reaches a project only through `daily_diaries` — `DiaryDelivery` has **no `projectId`** (`[C5R-A9]`, still true at `ed202483`) — so the check is a join to `diary.projectId`, not a column read. Without it, another tenant's delivery could be linked to this project's NCR and would then render in that project's folio. AT-190(b).
2. **Lot consistency.** If the delivery carries a `lotId` and the NCR carries lots, the delivery's lot must be among them — the same rule `requireFailedTestResultForNcr` applies at `:180-183`. A delivery with `lotId === null` links freely; that is the common case, since an NCR is often what causes someone to go and link the delivery to its lot.

There is **no** `passFail`-equivalent gate, because there is no such field on a delivery and inventing a "delivery is non-conforming" flag would be the quarantine state under another name. `[C54S-B3]`.

**The prohibition is already shipped and already correct.** This is the finding worth recording. RG-8 claims 8.6 and 8.8 give the enforcement mechanism in two jurisdictions — TfNSW Q6 cl 3.12.4 (*"do not cover up or further build on the nonconforming product until the rectified product has been accepted"*) and TMR MRTS50 cl 10.2 (*"the Contractor shall not proceed to cover up or otherwise incorporate the Nonconforming work or materials before the Administrator has approved…"*), the latter explicitly reaching **materials**. In CIVOS that is:

```
lotConformable  →  prerequisites.noOpenNcrs        backend/src/lib/readiness/predicates.ts:477-486
noOpenNcrs      →  zero NCRs on the lot not in     backend/src/lib/conformancePrerequisites.ts:594-603
                   CLOSED_NCR_STATUSES                                      predicates.ts:337
emitted as      →  open_ncrs, a hard blocker       evidenceReadiness/conformanceItems.ts:134-146
                                                    HANDOVER_BLOCKING_REASON_CODES, reasonCodes.ts:134
```

An open NCR on a lot blocks that lot conforming and blocks handover. That **is** the prohibition on incorporation, lot-scoped, which is the grain claim 8.15 specifies. C5.4 adds nothing to it, changes nothing about it, and its correctness is now evidenced rather than assumed. AT-191 asserts it holds with a delivery-linked NCR, as a characterisation test — it should pass on day one, and a red result means C5.4a broke something.

**No readiness code is added for material nonconformance.** `open_ncrs` already covers it, at blocking severity, from the correct predicate. A second code would be a second engine.

**Rejected-at-delivery: nothing is built.** Claim 8.14. The material leaves site. `[C54S-B3]`, §1.2.

### 4.5 Supplier certificates — the profile model, specified and not scheduled (C5.4d)

**Why fixed columns are refuted rather than deprioritised.** Four grade-A field lists exist and none contains the others: the AS 1379 base (6.2, **grade B** via CCAA), VIC concrete's five-item extension including a five-component water breakdown and three slumps (6.7), NSW's eighteen enumerated items (6.9), VIC asphalt's eleven (6.12). Asphalt has no standard (6.11). QLD specifies no asphalt docket contents (6.14). Any fixed schema is wrong against at least two of the four immediately.

**Two more properties break the naive model** (research consequence 6). The docket is **written on at the point of delivery** — QLD requires water added on site to be recorded *on the docket* (6.6) — so it is not an immutable supplier PDF. And VIC splits evidence into **two tiers**: some fields printed on the docket, others merely *"traceable to the batching plant and available on request"* (6.8). A profile field therefore needs a `tier: 'on_docket' | 'traceable_on_request'` marker, or the model asserts that every specified field is on the artefact, which is false.

**The design: profile-driven, in the `Ruleset` shape.**

```ts
// backend/src/lib/materials/certificateProfiles/types.ts — the shape, not the packs
export interface CertificateProfile {
  id: string;                          // 'tfnsw-b80.v1' — version in the id, per Ruleset
  authority: string;                   // 'TfNSW'
  state: string;                       // resolution key, matched as Ruleset does
  specSet: string;                     // resolution key, normalizeSpecSet-folded
  material: string;                    // 'concrete' | 'asphalt' — from Ruleset.materialTypes' authority-scoped precedent
  effectiveFrom: string;
  effectiveTo?: string;
  status: 'draft' | 'confirmed';
  fields: readonly CertificateField[];
  provenance: RulesetProvenance;       // REUSED verbatim from sufficiency/types.ts:19-35
}

export interface CertificateField {
  key: string;
  label: string;                       // <= 80 chars, per RULE_LABEL_MAX_LENGTH (registry.ts:24)
  type: 'text' | 'number' | 'date' | 'datetime';
  required: boolean;
  tier: 'on_docket' | 'traceable_on_request';   // research consequence 6 / claim 6.8
  clause: string;                      // e.g. '4.4.2(c)' — clause reference, never prose
}
```

**Five properties inherited deliberately, each from a shipped decision:**

1. **Code, not database rows** (`sufficiency/types.ts:11-13`) — reviewable in a PR diff, CI-testable, `git revert`-able.
2. **Explicit static imports, not a dynamic manifest** (`rulesets/index.ts:53`) — so fallow sees real edges.
3. **Mandatory provenance with an evidence grade** (`types.ts:19-35`) — *"an unprovenanced rule cannot be registered"*, and `validateProvenance` (`registry.ts:512-575`) fails CI on a `confirmed` pack that is not grade A. **This is the mechanism that makes U1 a hard gate rather than a judgement call**: the AS 1379 base pack's only source is grade B, so the CI validator would refuse to let it ship `confirmed`.
4. **Effective windows and runtime lapse-degradation** (`registry.ts:60-65`, `:100-122`) — an out-of-date pack degrades to `draft` and a `draft` pack structurally cannot enforce.
5. **`label` capped at 80 characters and no free-prose field** (`registry.ts:24`) — the §8.4 legal boundary against reproducing specification text. It binds harder here than for rulesets, because a certificate field list is closer to the source document than a frequency rule is. `[C54S-B8]`

**The instance record.** A `SupplierCertificate` row attached 1:1-optional to a `DiaryDelivery`, carrying `profileId`, `profileVersion`, and `fields Json` — the transcribed values, validated against the profile at write time and **stamped with the profile version they were entered under**, so a later profile revision does not silently reinterpret an old row. No fixed columns anywhere. It reuses `DiaryDelivery.docketDocumentId` as the filed artefact and adds **no** document FK, which is why C5.4d owes no `EVIDENCE_LINK_GUARDS` entry.

**Why the delivery, and not a free-standing certificate table.** Claim 6.9 shows TfNSW drafts the clause as *"Delivery Docket **or** Identification Certificate"* — it treats them as one artefact — and claim 6.5 has QLD requiring *"a manufacturer's certificate in the form of a delivery docket in accordance with AS 1379 … for each batch"*. For the two materials RG-6 covers, the certificate **is** the docket, and CIVOS already has the docket. U7 records that materials outside those two may break this, and that is one more reason C5.4d is not scheduled.

**What is already discharged without C5.4d, and it is the useful half.** Research consequence 3: the mix identifier is *required by specification* to appear on the delivery docket — VIC concrete cl 610.07(b)(xiii) → cl 610.16(e)(v) (5.11, 6.7), VIC asphalt cl 407.20(b)(vii) *"traceable to the mix registration number"* (6.12), NSW carrying nominated W/C and slump from trial mix onto the docket (6.10). And consequence 4: the docket serial number appears on test certificates *expressly to provide an audit trail for analysing nonconforming concrete* (6.3, grade B), corroborated grade A by MRTS70 cl 12.3 *"test reports shall be traceable to concrete delivery dockets and the construction lot"* (6.4).

**`DiaryDelivery.batchRef` is that token, and it already ships.** The parent spec justified it on honesty grounds alone; the research shows it is the **specified** traceability field. C5.4b uses it: the registration's `registrationNumber` and a delivery's `batchRef` are the two ends of the join, and §4.7 surfaces them side by side without needing a structured link. **No schema change is required to get the benefit** — which is the strongest single argument for not scheduling C5.4d.

### 4.6 Tenancy — company-scoped data reached through a project `[C54S-a]`

`ProductRegistration` must be **cross-project** (RG-5 consequence 1; claims 5.5, 5.6, 5.10, 5.13). CIVOS's cross-project tenant is `Company`. But §2.4 establishes there is no `requireCompanyMember`, and `requireCompanyAdmin` (`backend/src/routes/company/access.ts:6-17`) is owner/admin only — which would exclude the quality manager the feature is for.

**The resolution invents no tenancy helper.** The row is stamped `companyId`, and **every route is mounted under a project**:

```
GET  /api/projects/:projectId/product-registrations      → requireInternalProjectAccess, then
                                                            where: { companyId: project.companyId }
POST /api/projects/:projectId/product-registrations      → requireEffectiveProjectRole(..., REGISTRATION_EDITORS,
                                                            { requireWritable: true }), stamps project.companyId
```

This is `ImportMappingProfile`'s shipped shape exactly (`backend/src/routes/copilot/import/routes.ts:473-481`, `:560-578`): authorise against the **project**, scope the data by the **project's** `companyId`, never the JWT's. Four consequences, all good:

- **No new tenancy surface.** Every guard is one C5.1 already uses.
- **Cross-project readability is free.** Two projects of the same company resolve the same `companyId` and see the same rows. That is the RG-5 property, delivered by a `where` clause.
- **The archived-project check is preserved.** Writes go through `requireEffectiveProjectRole(..., { requireWritable: true })`, which reaches `assertProjectAllowsWrite` (`backend/src/lib/projectAccess.ts:205-207`); `requireInternalProjectAccess` (`:212-231`) does **not** perform it. Using the read helper on a write route would accept edits on an archived project — the trap `backend/src/routes/deliveries/index.ts:31-33` already documents. AT-199(b).
- **Company owners and admins still reach it**, via the auto-grant at `projectAccess.ts:161-167`, without a second code path.

**The cost, stated plainly.** A user with no project on a company cannot see that company's registrations. That is correct for now — every CIVOS surface is project-reached — and if a company-wide register page is ever wanted, the only precedent is a `Company*Section` on `CompanySettingsPage.tsx` under `COMPANY_ADMIN_ROLES` (`frontend/src/appRouteRoles.ts:6`), which would be owner/admin-only and therefore *narrower* than what this design gives a QM today. Recorded as `[C54S-a]`'s flip condition and DC5-6.

**Retention.** `ProductRegistration` is company-scoped and **no company delete route exists** (§2.4, grepped), so it joins **neither** half of the project retention guard. `ProjectMaterialApproval` is project-scoped and joins **both** — `RETAINED_PROJECT_RELATIONS` (`backend/src/routes/projects/writeRoutes.ts:44-68`, the declared authority) **and** the `_count` select (`:692-716`). `[C5R-A7]`'s lesson, now with the second list visible. AT-204.

### 4.7 What the consumers receive

- **Folio.** `FolioEvidencePayload` gains **one** key — `materialApprovals` — not two. The Layer-1 registration is **projected into** the approval row (number, scheme, status, validity, and the derived currency at issue time), because a folio is a record of *this lot's* evidence and a bare company register entry is not lot evidence. `FolioSourceType` gains `'project_material_approval'` with kind `'updated_at'` (the table has `updatedAt`; no digest needed). **`FOLIO_PAYLOAD_SCHEMA_VERSION` 2 → 3** (`backend/src/lib/handover/revisionTokens.ts:121`), counted in `countEvidenceRows` (`folioPayload.ts:207-220`), queried at `CEILING + 1` in `assemble.ts`. Ships **flag-gated and empty** when off, exactly as `surveys` does (`folioPayload.ts:188`).
  **The derived-currency field is a snapshot with a stated basis**, rendered as *"registration 12345 (DTP asphalt register), status General, valid to 30 Jun 2027 — current at issue"* — never as a bare "valid" chip, and never recomputed against the reader's clock when an issued folio is re-opened. `[C54S-B2]`, AT-203.
- **Hold-point evidence package.** **Nothing is added.** `[C54S-g]`. A superintendent releasing a hold point on workmanship does not need the approval register; and where the release *is* the approval (NSW, 5.15, RG-11), putting it in the package would show the superintendent their own decision back. Same call and same reasoning as `[C5S-e]` made for deliveries. *Flip condition:* a real superintendent asks for it.
- **Readiness.** One new `EvidenceReadinessArea` member is **not** minted — approvals reuse `'conformance'`, the same economy `'diary'` got for deliveries (`backend/src/lib/evidenceReadiness/core.ts:17-18`). Two new codes in `READINESS_REASON_CODES` **and** `REASON_CODE_PROVENANCE` in the same change (the contract test at `reasonCodes.ts:23-28` fails otherwise):
  - `material_approval_registration_expiring` — `warning`. Predicate: a referenced registration whose `validTo` is within 30 days or past, at read time.
  - `material_approval_missing` — `support`. Predicate: a lot with deliveries whose supplier/material has no approval row on the project.
  **Neither joins `HANDOVER_BLOCKING_REASON_CODES`** (`:127-150`). `[C5S-B5]` binds unchanged. AT-202.

---

## 5. Data model and migrations

Four migrations, all additive, in the hand-authored wave-tagged slot convention. Taken at `ed202483`: `20260801000000` … `20260809000000`. **`20260810000000` and up are free**; per the build brief, C5.4 starts at `20260811000000`.

### 5.1 `20260811000000_c54a_ncr_material_link` (C5.4a)

```sql
ALTER TABLE "ncrs" ADD COLUMN "linked_delivery_id" TEXT;

ALTER TABLE "ncrs"
  ADD CONSTRAINT "ncrs_linked_delivery_id_fkey"
  FOREIGN KEY ("linked_delivery_id") REFERENCES "diary_deliveries"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ncrs_linked_delivery_id_idx" ON "ncrs"("linked_delivery_id");
```

`SET NULL` and the index both mirror `linked_test_result_id` exactly (`backend/prisma/schema.prisma:1136`, `:1151`). Reverse migration is a column drop.

### 5.2 `20260812000000_c54b_product_registration` (C5.4b)

```sql
CREATE TABLE "product_registrations" (
    "id"                    TEXT NOT NULL,
    "company_id"            TEXT NOT NULL,
    "authority"             TEXT NOT NULL,
    "scheme"                TEXT NOT NULL,
    "registration_number"   TEXT NOT NULL,
    "product_name"          TEXT NOT NULL,
    "material"              TEXT,
    "supplier_name"         TEXT,
    "plant_location"        TEXT,
    "status"                TEXT NOT NULL DEFAULT 'not_stated',
    "valid_from"            DATE,
    "valid_to"              DATE,
    "source_document_id"    TEXT,
    "source_note"           TEXT,
    "superseded_by_id"      TEXT,
    "recorded_by"           TEXT,
    "recorded_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes"                 TEXT,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_registrations_pkey" PRIMARY KEY ("id")
);

-- The four published values are VicRoads/DTP Section 407 v18.0 (Oct 2025) cl 407.09
-- (research claim 5.13). 'not_stated' is the honesty value: schemes that publish no
-- status (ATIC 5.5, QRS 5.6, VIC concrete 5.10) are recorded as such, never mapped
-- onto 'general'. Same call as survey_records_verdict_check's 'not_stated'.
ALTER TABLE "product_registrations" ADD CONSTRAINT "product_registrations_status_check"
  CHECK ("status" IN ('general','conditional','expired','withdrawn','not_stated'));

-- Registration numbers are per-scheme. ATIC, QRS and the mix registers are three
-- namespaces and "they are not interchangeable" (claim 5.6).
ALTER TABLE "product_registrations"
  ADD CONSTRAINT "product_registrations_company_scheme_number_key"
  UNIQUE ("company_id","scheme","registration_number");

ALTER TABLE "product_registrations" ADD CONSTRAINT "product_registrations_validity_check"
  CHECK ("valid_from" IS NULL OR "valid_to" IS NULL OR "valid_to" >= "valid_from");
ALTER TABLE "product_registrations" ADD CONSTRAINT "product_registrations_self_supersede_check"
  CHECK ("superseded_by_id" IS NULL OR "superseded_by_id" <> "id");

ALTER TABLE "product_registrations" ADD CONSTRAINT "product_registrations_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;
-- Restrict: the filed certificate cannot be deleted out from under the registration.
-- Matches drawings.document_id and survey_records.report_document_id. The usable
-- error message comes from the §2.5 guard entry, not from this FK.
ALTER TABLE "product_registrations" ADD CONSTRAINT "product_registrations_source_document_id_fkey"
  FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT;
ALTER TABLE "product_registrations" ADD CONSTRAINT "product_registrations_superseded_by_id_fkey"
  FOREIGN KEY ("superseded_by_id") REFERENCES "product_registrations"("id") ON DELETE SET NULL;
ALTER TABLE "product_registrations" ADD CONSTRAINT "product_registrations_recorded_by_fkey"
  FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX "product_registrations_company_id_status_idx"
  ON "product_registrations"("company_id","status");
CREATE INDEX "product_registrations_company_id_valid_to_idx"
  ON "product_registrations"("company_id","valid_to");
```

**There is no `expires_at` trigger, no scheduled job and no computed currency column, and that is `[C54S-B2]`.** `valid_to` is data; currency is a read-time derivation in the `degradeIfLapsed` idiom (`backend/src/lib/readiness/sufficiency/registry.ts:100-122`).

`company_id` is `ON DELETE CASCADE` — consistent with `WebhookConfig` (`schema.prisma:212`) and safe because no company delete route exists (§2.4). If one is ever built, it owes a retention guard, and `product_registrations` belongs in it. Recorded in §16.

### 5.3 `20260813000000_c54c_project_material_approval` (C5.4c)

```sql
CREATE TABLE "project_material_approvals" (
    "id"                        TEXT NOT NULL,
    "project_id"                TEXT NOT NULL,
    "product_registration_id"   TEXT,
    "hold_point_id"             TEXT,
    "material_key"              TEXT NOT NULL,
    "material_description"      TEXT,
    "status"                    TEXT NOT NULL,
    "approved_by_name"          TEXT,
    "approved_by_organisation"  TEXT,
    "approved_at"               TIMESTAMP(3),
    "approval_method"           TEXT,
    "approval_reference"        TEXT,
    "approval_document_id"      TEXT,
    "conditions"                TEXT,
    "rejection_reason"          TEXT,
    "superseded_by_id"          TEXT,
    "recorded_by"               TEXT NOT NULL,
    "recorded_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes"                     TEXT,
    "created_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_material_approvals_pkey" PRIMARY KEY ("id")
);

-- No published Layer-2 vocabulary exists (RG-5 delivers the REGISTER vocabulary only).
-- Three values, pilot-gated `[C54S-B4]`. Deliberately no 'submitted'/'pending':
-- a row exists because a decision was recorded. See §4.3.
ALTER TABLE "project_material_approvals" ADD CONSTRAINT "project_material_approvals_status_check"
  CHECK ("status" IN ('approved','rejected','withdrawn'));

-- `[C54S-B1]` as a constraint, not as prose. This is the C5 lesson `[C5R-B1]`
-- taught at cost: the flagship invariant must be the one the DB actually enforces.
-- An 'approved' row with no named approver and no date is CIVOS approving.
ALTER TABLE "project_material_approvals"
  ADD CONSTRAINT "project_material_approvals_approved_requires_actor_check"
  CHECK ("status" <> 'approved'
      OR ("approved_by_name" IS NOT NULL AND "approved_at" IS NOT NULL));
ALTER TABLE "project_material_approvals"
  ADD CONSTRAINT "project_material_approvals_rejected_requires_reason_check"
  CHECK ("status" <> 'rejected' OR "rejection_reason" IS NOT NULL);
ALTER TABLE "project_material_approvals"
  ADD CONSTRAINT "project_material_approvals_approval_method_check"
  CHECK ("approval_method" IS NULL
      OR "approval_method" IN ('letter','email','site_instruction','hold_point_release','other'));
ALTER TABLE "project_material_approvals"
  ADD CONSTRAINT "project_material_approvals_self_supersede_check"
  CHECK ("superseded_by_id" IS NULL OR "superseded_by_id" <> "id");

ALTER TABLE "project_material_approvals" ADD CONSTRAINT "project_material_approvals_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;
-- Restrict: an approval that silently lost the registration it consumed is worse
-- evidence than a delete that refuses. §4.3.
ALTER TABLE "project_material_approvals" ADD CONSTRAINT "project_material_approvals_product_registration_id_fkey"
  FOREIGN KEY ("product_registration_id") REFERENCES "product_registrations"("id") ON DELETE RESTRICT;
ALTER TABLE "project_material_approvals" ADD CONSTRAINT "project_material_approvals_hold_point_id_fkey"
  FOREIGN KEY ("hold_point_id") REFERENCES "hold_points"("id") ON DELETE SET NULL;
ALTER TABLE "project_material_approvals" ADD CONSTRAINT "project_material_approvals_approval_document_id_fkey"
  FOREIGN KEY ("approval_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT;
ALTER TABLE "project_material_approvals" ADD CONSTRAINT "project_material_approvals_superseded_by_id_fkey"
  FOREIGN KEY ("superseded_by_id") REFERENCES "project_material_approvals"("id") ON DELETE SET NULL;
ALTER TABLE "project_material_approvals" ADD CONSTRAINT "project_material_approvals_recorded_by_fkey"
  FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX "project_material_approvals_project_id_status_idx"
  ON "project_material_approvals"("project_id","status");
CREATE INDEX "project_material_approvals_project_id_material_key_idx"
  ON "project_material_approvals"("project_id","material_key");
CREATE INDEX "project_material_approvals_product_registration_id_idx"
  ON "project_material_approvals"("product_registration_id");
```

**`recorded_by` is `NOT NULL` here and nullable on `product_registrations`.** Deliberate: an approval is an attributed transcription of somebody else's decision and the transcriber is the whole control (§0.4), so a row without one is meaningless; a registration is a copied fact. The FK is still `SET NULL` on user delete, which means the column is `NOT NULL` at insert and may become null if the user is deleted — the same shape `TestResult`'s verifier fields carry. If a deleted transcriber is judged unacceptable the fix is the audit log, which is immutable and already records it.

**The cross-tenancy invariant `product_registration.company_id = project.company_id` is route-enforced, not a `CHECK`** — a `CHECK` cannot join. This is the `[C5R-N5]` split stated for C5.4: **DB-enforced** = the four vocabularies, approved-requires-an-actor, rejected-requires-a-reason, no self-supersession, the validity ordering, the per-scheme uniqueness, every FK. **Route-only** = the company match, the supersession identity checks, the derived currency, and the `.strict()` bodies. Route-only invariants are asserted by AT-198, AT-200, AT-201; **the DB ones are asserted by raw SQL that bypasses the route** (AT-197), because a route-level test of a `CHECK` proves nothing about the `CHECK`.

### 5.4 `20260814000000_c54d_supplier_certificate` (C5.4d) — **NOT SCHEDULED**

Specified in §4.5, gated on **U1**, and DC5-7 recommends against scheduling it. The shape is one table — `supplier_certificates` with `delivery_id` (unique), `profile_id`, `profile_version`, `fields JSONB`, `recorded_by`, timestamps — and **no `Document` FK**, because it reuses `DiaryDelivery.docketDocumentId`. It is written down so the next agent finds a design rather than a blank space, and so that "we could just add columns" is visibly refuted before it is proposed.

**All four migrations are additive and reversible by column/table drop.** None rewrites or deletes an existing row. Production apply is the `Production Migrations` GitHub Actions workflow, manually dispatched from `master` with the exact confirmation phrase — never `db push`, never `--accept-data-loss` (`CLAUDE.md` operational warnings).

---

## 6. Invariants C5.4 must not break

| Tag | Invariant |
| --- | --- |
| **`[C54S-B1]`** | CIVOS records an approval; it never grants one. No `'approved'` row without `approved_by_name` **and** `approved_at`, enforced by `project_material_approvals_approved_requires_actor_check`. Every surface renders the external approver **and** the CIVOS transcriber, distinctly. |
| **`[C54S-B2]`** | **CIVOS never writes a registration status it derived.** No job, cron, trigger or request-time coercion writes `'expired'` or any other status. Currency is computed at read time and displayed, never persisted. Withdrawal is an authority act (claim 5.14). |
| **`[C54S-B3]`** | No quarantine state, no material status machine, no segregation flag, no "delivery is non-conforming" boolean, and no record of material rejected at delivery. RG-8. |
| **`[C54S-B4]`** | C5.4b and C5.4c stay behind the feature flag until one real material approval has round-tripped with a real contractor and the status vocabularies are confirmed or corrected. |
| **`[C54S-B5]`** | C5.4 releases no hold point, gates no release, and adds no member to `HANDOVER_BLOCKING_REASON_CODES`. Its readiness items are `warning` and `support` only. It blocks no conformance, no claim, no folio. Inherits `[C5S-B5]`. |
| **`[C54S-B6]`** | `NCR.linkedDeliveryId` is **create-only**, like `linkedTestResultId`. It is not added to `updateNcrSchema`, and no route patches it. |
| **`[C54S-B7]`** | Every `Document` FK C5.4 adds carries its `EVIDENCE_LINK_GUARDS` entry **and** its `GENERIC_VERSIONING_BLOCKS` entry, **appended not inserted** (two shipped tests assert `delivery_docket`'s position — `access.test.ts:10`, `deleteRoutes.test.ts:76`), in the same PR as the FK. Every **project-scoped** table C5.4 adds joins **both halves** of the retention guard. Extends `[C5S-B9]` from two registries to three. |
| **`[C54S-B8]`** | No certificate profile carries free prose from a specification. `label` is capped at 80 characters, `clause` holds a reference and never text. The §8.4 legal boundary, inherited from `registry.ts:24`. |
| *(inherited)* `[C5S-B1]` | CIVOS records a verdict; it never makes one. |
| *(inherited)* `[C5S-B2]` | No user-facing string says CIVOS checks, validates, verifies or certifies — extended here to *approves* and *registers*. |
| *(inherited)* `[C5S-B3]` | Nothing under `backend/src/routes/dockets/`; no column on `daily_dockets`/`docket_labour`/`docket_plant`; the three `approvedDockets: 0` producers unchanged. |
| *(inherited)* `[C5S-B7]` | No C5.4 code path calls `document.delete`. |
| *(inherited)* `[C5S-B8]` | No new upload type, no new magic-byte signature kind, **no new multer config** — the count stays at twelve. Every file arrives as an already-uploaded `documentId`. |
| *(inherited)* `[C2L-B3]` via `[C3S-B2]` | No second readiness engine, no cached verdict column, no recalculation job. |

---

## 7. API and UI surface

### 7.1 Backend

| Route | Phase | Guard |
| --- | --- | --- |
| *(no new route)* — `linkedDeliveryId` joins the existing `POST /api/ncrs` body | C5.4a | unchanged: `requireActiveProjectUser(..., NCR_CREATE_ROLES)` `backend/src/routes/ncrs/ncrCore.ts:268-272` |
| `GET /api/projects/:projectId/product-registrations` (paginated; filters: scheme, status, material, expiring-within) | C5.4b | `requireInternalProjectAccess`, then `where: { companyId: project.companyId }` — §4.6 |
| `GET /api/product-registrations/:id` | C5.4b | as above, re-checked against the project the caller presents |
| `POST /api/projects/:projectId/product-registrations` | C5.4b | `requireEffectiveProjectRole(..., REGISTRATION_EDITORS, { requireWritable: true })`; `companyId` stamped from `project.companyId`, **never from the body or the JWT** |
| `PATCH /api/product-registrations/:id` | C5.4b | as above; a re-issued certificate for the same number updates and audits `{from,to}`; changing `scheme` or `registrationNumber` is **refused** — that is a new row (§4.2) |
| `POST /api/product-registrations/:id/supersede` | C5.4b | `REGISTRATION_EDITORS`; guard in the `requireSupersededByInProject` shape (`backend/src/routes/drawings.ts:37-66`) scoped by **company** plus same scheme |
| `GET /api/projects/:projectId/material-approvals` · `GET /api/lots/:lotId/material-approvals` | C5.4c | `requireInternalProjectAccess`, plus `assertBelongsToLot` on the lot-scoped form |
| `POST /api/projects/:projectId/material-approvals` | C5.4c | `requireEffectiveProjectRole(..., MATERIAL_APPROVAL_RECORDERS, { requireWritable: true })` |
| `PATCH /api/material-approvals/:id` · `POST /api/material-approvals/:id/supersede` | C5.4c | as above; five-check identity guard on supersede (§4.3) |

Every write body is a Zod **`.strict()`** object — the `[C5R-B2]` trust boundary, shipped at `backend/src/routes/deliveries/index.ts:112-118`. An unknown key is a 400, not a silent write. AT-198.

**No new upload route** — `sourceDocumentId` and `approvalDocumentId` take already-uploaded `documentId`s, resolved within the correct tenant, exactly as `POST /api/surveys/:id/report` does. `[C5S-B8]`, `[C5R-A6]`.

**No public route, no token surface, no webhook, no email.** The superintendent does not receive a CIVOS approval request; RG-5 says the Contractor submits and CIVOS is the contractor's system. External-party surfaces are Wave E's and have a merged threat model; C5.4 does not open a second one.

**Flag enforcement is per-route middleware**, in the `requireSurveyFlag` shape (`backend/src/routes/surveys/index.ts:170-176`), **never `router.use`** — the comment at `:164-168` records that a router-level gate on a path prefix shared with `/api/lots` or `/api/projects` would 404 unrelated routes when the flag is off. C5.4b and C5.4c mount under both prefixes, so this applies twice. AT-205.

### 7.2 Frontend

- **Lot detail** — the existing "Survey & materials" section (C5.2) gains approvals for that lot's materials. No new page, no new nav entry.
- **Project registrations register** — the `VariationsPage.tsx` idiom (`frontend/src/pages/variations/VariationsPage.tsx`, routed `App.tsx:499-503`): per-page `hooks/` + `components/`, `useRegisterDeepLink`, `useIsMobile`, `usePullToRefresh`, `ContextFAB`, `ContextHelp`, and **`@/lib/statusLabels`'s `formatStatusLabel` for every user-visible status** — mandatory, and the five-value registration vocabulary is exactly the kind of thing that grows a second hand-written label map otherwise.
- **Expiry is shown, never asserted.** A registration inside 30 days of `validTo` renders as *"expires 30 Jun 2027"* with the readiness warning; past `validTo` renders *"validity lapsed — confirm with the authority"*. **It never renders as "Expired"**, because that is the register's word for a status the register assigns. `[C54S-B2]`, AT-206.
- **Approval capture is one modal on one surface** — the `[C3R-B3]` lesson (a control on a second, wrong surface stamps the wrong provenance).
- **No foreman shell change.** A shell touch needs Jay's explicit go (program §5 item 4) and C5.4 does not spend it. Approvals are an office act.
- **Honest note on what C5.1 left:** there is **no delivery register page** at `ed202483` (§2.6). C5.4a's "link this delivery to an NCR" affordance therefore lives on the **NCR create form** (an optional delivery picker, alongside the existing failed-test picker at `frontend/src/pages/tests/TestResultsPage.tsx:605`) and on lot detail — not on a delivery register that does not exist.

### 7.3 Permission matrix

Role sets are **route-local const arrays**, not hierarchy checks — the convention reasoned at `backend/src/routes/folio/access.ts:12-23` and precedented at `TEST_VERIFIERS` (`backend/src/routes/testResults/accessControl.ts:41`) and `DELIVERY_EVIDENCE_EDITORS` (`backend/src/routes/deliveries/index.ts:71-79`).

```
REGISTRATION_EDITORS        = ['owner','admin','project_manager','quality_manager']
MATERIAL_APPROVAL_RECORDERS = ['owner','admin','project_manager','quality_manager']
```

**Every row below was checked against the real access helper it would run through**, per the standing lesson that a past spec's matrix was unimplementable against `requireInternalProjectAccess`:

| Action | owner | admin | project_manager | quality_manager | site_manager | site_engineer | foreman | viewer | subcontractor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Read registrations (project-mounted) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Create / edit / supersede a registration | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Read material approvals | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| **Record / supersede a material approval** | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Link a delivery when raising an NCR | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Grant an approval** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

**Four notes, each grounded:**

1. **The read rows are implementable exactly as written.** `requireInternalProjectAccess` (`backend/src/lib/projectAccess.ts:212-231`) admits any internal project role and hard-rejects portal roles at `:217` and again at `:226`. `viewer` is an internal role and reads; `subcontractor` and `subcontractor_admin` cannot reach the route at all. No per-role branching is needed and none is written.
2. **The write rows are implementable exactly as written.** `requireEffectiveProjectRole` (`:180-210`) takes the const array directly and, with `requireWritable: true`, reaches `assertProjectAllowsWrite` (`:205-207`). Company owners and admins are auto-granted at `:161-167`, which is why `owner`/`admin` are ✓ without a second path.
3. **The last row is not decoration.** There is no CIVOS actor who approves, at any role, ever — §0.4. It is in the matrix because a reader scanning for "who approves" must find the answer, and the answer is *nobody in CIVOS*.
4. **The NCR link row inherits `NCR_CREATE_ROLES`** (`backend/src/routes/ncrs/ncrAccess.ts:32-40`) unchanged — it is one field on an existing create body, and widening or narrowing who may raise an NCR is not C5.4's call.

**Subcontractors are 403 on every C5.4 surface.** Same disposition and same reasoning as DC5-3 and DC5-5: `requireSubcontractorPortalModuleAccess` has a closed six-member module vocabulary (`projectAccess.ts:7-13`) with no materials key, and a registration names a supplier and a plant location. Recorded as **DC5-9**.

**`quality_manager` is in both write consts** because the QM is the persona §0.1 is written for, and `canApproveItems` (`backend/src/lib/roles.ts:66-68`) already resolves to exactly `owner|admin|project_manager|quality_manager` — the const arrays match that set today by intent, and are written out literally so they do not drift when a role is inserted into `ROLE_HIERARCHY`.

---

## 8. Security, tenancy and privacy

**Threat model gate.** Program §7 line 134 gates a threat-model artifact before A3, C2, D2 and E — **not before C5.4**. Line 135's standing requirements apply regardless. The disposition is the same one that made C5.1–C5.3 safe without one: **C5.4 adds no new upload mechanism, no new multer config, no new file type and no external-party surface** `[C5S-B8]`. Every file is PDF/JPEG/PNG through the shipped document-upload path and `assertUploadedFileMatchesDeclaredType` (`backend/src/lib/imageValidation.ts:232-260`).

| Threat | Disposition |
| --- | --- |
| **Cross-tenant registration attachment.** `ProductRegistration` is company-scoped, `ProjectMaterialApproval` is project-scoped; the FK crosses the boundary. | Validated **inside the write transaction** against `project.companyId`, never the JWT's `companyId` — the `ImportMappingProfile` rule (`backend/src/routes/copilot/import/routes.ts:473-481`, `:521-536`). A user who is company-admin of A and a project member of B's project must not be able to attach A's registration to B's project. AT-200(c). |
| **Tenant isolation on new read surfaces.** Four new read routes. | Every read delegates to `requireInternalProjectAccess` — **no fifth copy of `requireProjectReadAccess`**, the argument-order transposition hazard reasoned at `backend/src/routes/folio/access.ts:25-40`. Rows loaded by their own id are re-checked against the presented project; lot-scoped rows go through `assertBelongsToLot` (`folio/access.ts:72-80`) with the `[C5R-A5]` null-narrowing rule at the call site. AT-200. |
| **A write route on an archived project.** | `requireEffectiveProjectRole(..., { requireWritable: true })` on every write. `requireInternalProjectAccess` does **not** perform the archived check — the trap documented at `backend/src/routes/deliveries/index.ts:31-33`. AT-199(b). |
| **The register is a bulk-read surface** carrying supplier names and plant locations across a company. | Internal roles only; subcontractors 403 (DC5-9). Paginated with a hard `take` cap — the `[C3R-B1]` lesson (an unbounded query with only transitive scoping was C3's single security finding). AT-196. |
| **False attribution — the sharpest risk in the wave.** An approval row names an identifiable professional and asserts they approved a material. A wrong entry is a contractual and defamation-shaped risk, not a data-quality one. | `approvedByName`/`approvedByOrganisation` are **separate from** `recordedById`, both are rendered on every surface and in the folio, and every write is audited with `{from,to}` through `writeAuditLogInTransaction` (`backend/src/lib/auditLog.ts:127-129`) — **hard-fail, not `createAuditLog` (`:105`), which swallows failures (`:106-112`)**. A row whose entire justification is that it records somebody else's decision cannot have a best-effort audit trail. Exit-gate item, AT-199(c). |
| **Personal data.** `approvedByName`, `approvedByOrganisation`, `supplierName`, `plantLocation` are third-party identifiers. | Covered by existing project data-retention and export paths; no new subprocessor, no new egress. Not rendered on any public or token surface — C5.4 has none. `product_registrations` is **company-scoped and therefore outside the project privacy export's scope**; recorded as an honest unknown (§16 item 4), not asserted as handled. |
| **Retention on hard delete.** | `project_material_approvals` joins **both halves** of the project guard — `RETAINED_PROJECT_RELATIONS` (`backend/src/routes/projects/writeRoutes.ts:44-68`, the declared authority) and the `_count` select (`:692-716`). `product_registrations` is company-scoped and **no company delete route exists** (§2.4, grepped), so it joins neither; §16 item 5 records that a future company delete owes it. AT-204. |
| **Document link integrity.** Two new `Document` FKs, both `Restrict`. | Each gets its `EVIDENCE_LINK_GUARDS` entry (`evidenceLinkGuards.ts:25-112`) **and** its `GENERIC_VERSIONING_BLOCKS` entry (`versionRoutes.ts:70-109`), **appended**. Without the second, generic versioning creates a new `Document` row and flips the old to `isLatestVersion: false` while the C5.4 FK still points at the old one — stale evidence inside a signed folio. `[C54S-B7]`, AT-207. |
| **Imported files are data, never instructions.** | C5.4 runs **no AI over any file**. If C5.4d ever does, the output-side whitelist normaliser is mandatory and the result rides `AiProposal`. Inherited `[C5S-d]`. |
| **Malware.** No scanner exists anywhere in the tree. | Unchanged and not widened: C5.4 adds no accepted type and no upload route. Program §7's requirement stays **open program-wide** and C5.4 is not the wave that closes it. §16 item 6. |

---

## 9. Scale and performance

Measured against the program §8 reference dataset (5,000 lots, 10,000 map features, 50 GB evidence, 10k-row registers), server-side p95.

| Target | Value | Dataset | Why this number |
| --- | --- | --- | --- |
| Registration register p95 | **< 800 ms** at 2,000 rows | a company with 2,000 registrations | Well inside program §8 line 141's 2,000 ms, and it should be: unlike the delivery register (`[C5R-A9]`, which joins through `daily_diaries` because `diary_deliveries` has no `project_id`), `product_registrations` carries `company_id` **directly** and the query is a single indexed scan on `product_registrations_company_id_status_idx`. 2,000 is a generous ceiling — a large contractor holds tens of registrations, not thousands. |
| Expiring-soon filter p95 | **< 400 ms** | same | Served by `product_registrations_company_id_valid_to_idx`. The predicate is a date-range scan, deliberately **not** a computed-status filter — there is no computed status to filter on `[C54S-B2]`. |
| Lot-scoped approval read p95 | **< 400 ms** | reference project, a lot with 5 approvals | It renders inside the lot page, which already has a budget; C5.4 must not be what a user notices. |
| **Folio evidence-row ceiling headroom** | **C5.4's collection adds < 10 rows at p99 per lot**, and **`FOLIO_EVIDENCE_ROW_CEILING_DEFAULT` is not raised** | reference dataset, worst lot | `countEvidenceRows` (`backend/src/lib/handover/folioPayload.ts:207-220`) drives a **refusal**, not a truncation. A lot has single-digit approved materials. **Measured on the worst lot and recorded in the PR body**; if exceeded the answer is to scope the projection, **never** to raise the ceiling. AT-203. |
| Folio assemble p95 delta | **< 8%** over the pre-C5.4 baseline | reference dataset | One more query at `CEILING + 1`, with the registration projected via an include rather than a second round trip. |

No new background job, no new worker, no new async path — and specifically **no expiry sweep**, which `[C54S-B2]` forbids on correctness grounds before performance ever enters it.

---

## 10. Phases and PR slicing

### C5.4a — NCR ↔ delivery link (S) — *ships first, unflagged*

- **Depends on:** nothing. C5.1's `DiaryDelivery` columns are merged (#1720).
- **Why first:** it is one nullable FK, one index, one create-time validator and one optional form field; it duplicates a shipped pattern exactly; it has **zero research exposure** (RG-8 is a discharged negative); and it discharges a whole program clause on its own.
- **Contains:** migration §5.1; the schema field, relation and index; `linkedDeliveryId` in `createNcrSchema` (**not** `updateNcrSchema`); the `requireDeliveryForNcr` validator in the `requireFailedTestResultForNcr` shape (`backend/src/routes/ncrs/ncrCore.ts:155-187`) with the same-project join and the lot-consistency check; the audit-payload addition at the `ncrCore.ts:373` site; the NCR create-form delivery picker; the lot-detail cross-link.
- **Exit:** AT-189, AT-190, AT-191.

### C5.4b — Product/mix registration (M) — *flagged, pilot-gated*

- **Depends on:** nothing in C5.4a. Independent.
- **Contains:** migration §5.2; the model; the five-value `CHECK`; the read-time currency derivation in the `degradeIfLapsed` idiom; supersession with the scheme identity check; the `product_registration` guard entries in **both** registries (§2.5); the four routes; the register page; the `material_approval_registration_expiring` warning code **with** its `REASON_CODE_PROVENANCE` entry.
- **Ships behind the flag, off, for every tenant** `[C54S-B4]`.
- **Exit:** AT-192 … AT-196, AT-199, AT-200, AT-205, AT-206, AT-207.

### C5.4c — Per-contract material approval (M) — *flagged, pilot-gated*

- **Depends on:** C5.4b merged. The only hard dependency edge in the wave — the `product_registration_id` FK cannot exist before the table does.
- **Contains:** migration §5.3; the model with the `HoldPoint`-shaped attribution block; the three-value `CHECK` and the approved-requires-an-actor constraint; the cross-tenancy company check; supersession with the five-check identity guard; the `approval_document` guard entries in both registries; **both halves** of the retention guard; the routes; the lot-detail section; the `material_approval_missing` support code; the folio wiring and `FOLIO_PAYLOAD_SCHEMA_VERSION` **2 → 3**.
- **Note:** bumping the folio schema version is not cosmetic. Existing `FolioSnapshot` rows carry `payloadSchemaVersion: 2`; a v2 snapshot must continue to render or be refused cleanly — **never silently read as v3**. This is AT-180's problem one version on, and AT-203 asserts it again for this bump.
- **Exit:** AT-197, AT-198, AT-200 … AT-204, AT-207, AT-208.

### C5.4d — Structured supplier certificates (L) — **RESEARCH-GATED, NOT SCHEDULED**

- **Gated on:** **U1** (AS 1379 cl 1.7.3's verbatim item list and edition — currently grade B via a CCAA paraphrase that cites neither clause number nor edition). Secondarily **U6** and **U7**.
- **Why the gate is mechanical, not a judgement call:** the profile model reuses `validateProvenance` (`backend/src/lib/readiness/sufficiency/registry.ts:512-575`), which **fails CI on a `confirmed` pack that is not `evidenceGrade: 'A'`**. A base pack sourced from claim 6.2 cannot pass. The gate enforces itself.
- **DC5-7 recommends not scheduling it.** A PR opening a fixed-column `supplier_certificates` table with hard-coded fields should be closed on sight — RG-6 refutes it, and §4.5 records why.

### Deliberately outside C5.4

Any quarantine or material-state machine (`[C54S-B3]`). Any `Supplier` registry. Any new role including `superintendent` (§0.4). Any change to the NCR workflow, its statuses or `assertNcrLinkableLots`. Any hold-point release change. Any C2 certificate-deletion fix (C4's). Any unification of `GENERIC_VERSIONING_BLOCKS` with `EVIDENCE_LINK_GUARDS` (§18.2). Any company delete route or company retention guard (§16 item 5). Any tenant-authored profile (F0's definition model). C5.5 in any form.

---

## 11. Feature flag and rollout

House pattern is a backend env var parsed inline in the `readinessSnapshotsEnabled()` shape (`backend/src/lib/readiness/recordDecision.ts:236-239`), copied for C5.2 at `backend/src/routes/surveys/statusWorkflow.ts:73-76`. **There is no shared `featureFlags.ts`**; each flag is a local function, and C5.4 does not invent the shared module either — that is a refactor of two shipped call sites for no behaviour change.

**`C5_MATERIAL_APPROVALS_ENABLED`** — gates C5.4b and C5.4c's routes, their UI, their readiness items and their folio collection. One flag for both phases: they are two halves of one feature and a contractor cannot use either alone.

**Its parse must be copied verbatim, not approximated:**

```ts
export function materialApprovalsEnabled(): boolean {
  const configured = process.env.C5_MATERIAL_APPROVALS_ENABLED?.trim().toLowerCase();
  return configured === 'true' || configured === '1' || configured === 'yes';
}
```

Absent ⇒ **off**, which step 1 depends on. The shipped header comment mandates exactly this (`recordDecision.ts:232-235`: *"default FALSE everywhere, including production. Enabling is an explicit, logged rollout step — never an implicit environment default"*). A `!== 'false'` idiom would default the flag **on** in every environment that has not set it, inverting the gate. AT-205.

**Enforcement is per-route middleware**, in the `requireSurveyFlag` shape (`backend/src/routes/surveys/index.ts:170-176`), **never `router.use`** — §7.1, and it applies twice here because C5.4's routes mount under both `/api/projects` and `/api/lots`.

1. Migrations §5.2 and §5.3 applied to production via the workflow, flag absent (⇒ off).
2. Deploy disabled; confirm no route is reachable, no readiness item is emitted, and the folio collection is empty.
3. Enable for one pilot project's tenant; **one real material approval round-trips end to end with a real contractor** — a registration transcribed from a real certificate, an approval transcribed from a real superintendent instruction, both in a folio. **Confirm or correct: the Layer-1 status vocabulary, the Layer-2 three-value vocabulary, whether the hold-point link is used, and whether registrations are a company asset or a job asset (RG-10).** `[C54S-B4]`
4. Enable permanently, or ship a reviewed migration correcting the `CHECK` vocabularies and repeat step 3.

**C5.4a ships unflagged.** One nullable FK on an existing create path is not a behaviour change worth a flag, and a flag that is never turned off is a lie in the config. `[C5S-f]`'s reasoning, applied. `[C54S-h]`

---

## 12. Rollback and recovery

| Phase | Rollback |
| --- | --- |
| C5.4a | Revert the code. The column is nullable and orphans harmlessly; existing NCRs are unaffected. Dropping the column is a clean reverse migration but **is not required** to restore behaviour. |
| C5.4b | Set `C5_MATERIAL_APPROVALS_ENABLED` off — that is the whole rollback, no deploy needed. `product_registrations` rows persist and are readable by direct query. Dropping the table is a clean reverse migration and loses only C5.4-created rows — **but it must be dropped after `project_material_approvals`**, because the FK is `Restrict`. |
| C5.4c | Flag off. **The one asymmetry in the wave:** `FOLIO_PAYLOAD_SCHEMA_VERSION` returns to `2`, and `FolioSnapshot` rows written at v3 become unreadable by a reverted v2 renderer. They must be **refused with a clear error, never coerced** — the same discipline `expiresAt` already enforces and the same one AT-180 asserted for the 1 → 2 bump. Issued `FolioIssue` PDFs are unaffected: they are append-only files, already rendered. |
| C5.4d | Not scheduled. |

**Orphaned certificate documents.** A registration or approval that is deleted leaves its `Document` with no referrer. **Harmless** — the `Restrict` FK means nothing is destroyed, and the file stays in the document register where it can be re-attached or deleted deliberately. `[C5S-B7]`.

**Data-loss risk: none.** No migration rewrites or deletes an existing row; no C5.4 code path deletes a `Document`. The only recovery action touching production data is dropping a C5.4 table, which loses only C5.4-created records — and the FK ordering above is the one operational detail that must not be got wrong.

---

## 13. Acceptance tests

Continuing the shared series, **AT-189 … AT-208** (next free after this spec: **AT-209**). Every item is a real assertion in a real test file, except where marked mechanical.

| AT | Phase | Assertion | Where |
| --- | --- | --- | --- |
| **AT-189** | C5.4a | **An NCR carries its delivery, and the link survives correctly.** `POST /api/ncrs` with `linkedDeliveryId` persists it; deleting the delivery **nulls** the link and does not delete the NCR (`SET NULL`); the index exists. | `backend/src/routes/ncrs/ncrMaterialLink.db.test.ts` |
| **AT-190** | C5.4a | **The link cannot cross a project or contradict a lot.** (a) a delivery whose diary belongs to another project → 400 *"Linked delivery must belong to the NCR project"*; (b) a delivery from another **tenant** → 400, with a whole second tenant seeded; (c) a delivery whose `lotId` is not among the NCR's lots → 400; (d) a delivery with `lotId IS NULL` links freely. | same |
| **AT-191** | C5.4a | **The prohibition on incorporation is unchanged and still blocks — characterisation.** A lot with an open NCR that carries `linkedDeliveryId` is **not** `lotConformable` and emits `open_ncrs` at blocking severity; closing the NCR clears it. Asserts C5.4a broke nothing. `[C54S-B5]` | `backend/src/lib/readiness/conformancePrerequisites.test.ts` |
| **AT-192** | C5.4b | **CIVOS never writes a status it derived — the wave's flagship, proven two ways.** (a) a registration whose `valid_to` is in the past still has its **transcribed** `status` in the DB, unchanged, after being read through every route and every readiness pass; (b) the derived currency flag is present on the **response** and absent from the **row**; (c) a diff grep asserts zero identifiers matching `expireRegistrations|sweepRegistrations|markExpired` and zero cron/job registration in C5.4 code. `[C54S-B2]` | `backend/src/routes/materials/productRegistration.db.test.ts` + diff grep in the PR body |
| **AT-193** | C5.4b | **The status vocabulary is exactly the published five, enforced at the DB.** By **raw SQL bypassing the route**: each of `general`/`conditional`/`expired`/`withdrawn`/`not_stated` inserts; `'approved'`, `'current'`, `''` and `'GENERAL'` are each rejected by **`product_registrations_status_check` by name**. And `valid_to < valid_from` is rejected by `product_registrations_validity_check`. | same |
| **AT-194** | C5.4b | **Identity is per-scheme and immutable.** Two rows with the same `registrationNumber` under **different** `scheme` values both insert; a duplicate `(companyId, scheme, registrationNumber)` is rejected by the unique constraint; `PATCH` changing `scheme` or `registrationNumber` returns 400 *"a new registration number is a new registration"*; a re-issued certificate for the same number updates and audits `{from,to}`. Claims 5.6, 5.8. | same |
| **AT-195** | C5.4b | **Supersession is scoped to one registration identity.** Four refusals: self-reference; a registration of another **company**; a registration under a different `scheme`; a target that is itself superseded. Reads default to `supersededById: null`. Mirrors `requireSupersededByInProject` (`backend/src/routes/drawings.ts:37-66`). | `backend/src/routes/materials/supersede.db.test.ts` |
| **AT-196** | C5.4b | **The register is bounded.** `GET /api/projects/:id/product-registrations` applies a hard `take` cap and paginates; a company seeded past the cap returns the cap plus a next-page marker, never the full set. `[C3R-B1]` lesson. | `backend/src/routes/materials/register.db.test.ts` |
| **AT-197** | C5.4c | **CIVOS never approves — proven at the DB.** By **raw SQL bypassing the route**: (a) `INSERT … status='approved', approved_by_name=NULL, approved_at=NULL` is rejected by **`project_material_approvals_approved_requires_actor_check` by name**; (b) `status='rejected'` with a NULL `rejection_reason` is rejected by its named constraint; (c) an `approval_method` outside the five is rejected. And no route accepts a body field named `approve`, `grantApproval` or `autoApprove`: a diff grep asserts zero such identifiers. `[C54S-B1]` | `backend/src/routes/materials/materialApproval.db.test.ts` + diff grep |
| **AT-198** | C5.4c | **Bodies are strict whitelists.** Every C5.4 write body rejects an unknown key with a **400** and leaves the row unchanged — asserted per route, not once. The `[C5R-B2]` trust boundary, shipped at `backend/src/routes/deliveries/index.ts:112-118`. | `backend/src/routes/materials/*.db.test.ts` |
| **AT-199** | C5.4b, C5.4c | **Writes are narrow, archived-safe and hard-audited.** (a) `site_manager`, `site_engineer`, `foreman` and `viewer` **403** on every C5.4 write; `quality_manager` **succeeds**; (b) every write **403s on an archived project** (`requireWritable: true` reaching `assertProjectAllowsWrite`, `projectAccess.ts:205-207`); (c) an audit row exists with `{from,to}` per changed field, and **a forced audit-write failure rolls the write back** — `writeAuditLogInTransaction`, not best-effort `createAuditLog`. | `backend/src/routes/materials/access.db.test.ts` |
| **AT-200** | C5.4b, C5.4c | **Cross-tenant is refused on every new route, lettered.** Second tenant seeded: (a) another tenant's project on the register → 403; (b) another tenant's registration id presented by a user who legitimately holds *a* project → 404; **(c) the company-boundary case — a user who is company-admin of company A and a project member of company B's project cannot attach A's registration to B's project → 400**, and the check reads `project.companyId`, not the JWT's; (d) a cross-tenant `approvalDocumentId` → 400; (e) a subcontractor on **any** C5.4 route, read or write → 403 (DC5-9); (f) an approval on a lot in another project → 400 from the lot binding; (g) a project-scoped read returns rows the lot-scoped read 404s. | `backend/src/routes/materials/tenancy.db.test.ts` |
| **AT-201** | C5.4c | **Approval supersession is scoped to one material identity.** Five refusals: self; another project; a different `material_key`; a different `product_registration_id` (or one null and one not); a target already superseded. | `backend/src/routes/materials/supersede.db.test.ts` |
| **AT-202** | C5.4b, C5.4c | **Both readiness codes warn and never block.** `material_approval_registration_expiring` at `severity: 'warning'` and `material_approval_missing` at `severity: 'support'`, both `blocksAction: false`, **neither in `HANDOVER_BLOCKING_REASON_CODES`**; each has its `REASON_CODE_PROVENANCE` entry (the contract test at `reasonCodes.ts:23-28` fails otherwise); a lot with an expiring registration still conforms and still claims. `[C5S-B5]` | `backend/src/lib/evidenceReadiness/*.test.ts` + the reason-code contract test |
| **AT-203** | C5.4c | **The folio bump is honest and the ceiling is respected.** `FOLIO_PAYLOAD_SCHEMA_VERSION === 3`; a stored **v2** snapshot is refused with a clear error and is **never** read as v3; `countEvidenceRows` includes the new collection; a lot seeded past `folioEvidenceRowCeiling()` **refuses with the measured number** and does not truncate; `FOLIO_EVIDENCE_ROW_CEILING_DEFAULT` unchanged. The p99 per-lot row delta is measured and **recorded in the PR body**. | `backend/src/lib/handover/folioPayload.test.ts`, `backend/src/routes/folio/assemble.db.test.ts` + benchmark artefact |
| **AT-204** | C5.4c | **Approval evidence survives the retention guard, both halves.** A project holding one `ProjectMaterialApproval` and nothing else is **refused** a permanent delete with the shipped conflict message and a non-zero `projectMaterialApprovals` entry in `retainedRecordCounts`; archiving still succeeds. **And a mechanical assertion that the key appears in `RETAINED_PROJECT_RELATIONS` (`writeRoutes.ts:44-68`) *and* the `_count` select (`:692-716`)** — the two-list trap. | `backend/src/routes/projects/writeRoutes.test.ts` |
| **AT-205** | C5.4b, C5.4c | **The flag defaults off and gates nothing it should not.** With the env var absent, `materialApprovalsEnabled()` is `false`, every C5.4b/c route 404s, the folio collection is empty and no readiness item is emitted; `'true'`/`'1'`/`'yes'` each enable and `'false'`/`'no'`/`''`/`'TRUE '` behave correctly; **and `/api/lots/:id` and `/api/projects/:id` still resolve normally with the flag off** — the per-route-not-`router.use` property (`surveys/index.ts:164-168`). | `backend/src/routes/materials/flag.test.ts` |
| **AT-206** | C5.4b, C5.4c | **CIVOS attributes rather than asserts, in the copy.** The rendered approval prints the external approver's name **and** organisation **and** *"recorded by \<user\> on \<date\>"* as distinct strings; a registration past `validTo` renders *"validity lapsed"* and **never the word "Expired"** as CIVOS's own finding; a diff grep asserts *approves*, *registers*, *validates*, *verifies*, *certifies* and *checks* appear nowhere in C5.4 user-facing copy. `[C54S-B1]`, `[C5S-B2]` | renderer snapshot test + diff grep |
| **AT-207** | C5.4b, C5.4c | **Neither new document link can be stranded or silently deleted.** `DELETE /api/documents/:id` on a document referenced by `product_registrations.source_document_id` or `project_material_approvals.approval_document_id` returns **409 `WORKFLOW_EVIDENCE_DELETE_BLOCKED`** with the right `evidenceType` — not the bare 422 `INVALID_REFERENCE` the raw FK produces; `POST /api/documents/:id/version` returns **409 `WORKFLOW_EVIDENCE_VERSION_BLOCKED`**; an unlinked document still deletes and still versions. **And the two shipped positional assertions still pass** — `delivery_docket` is still the third `EVIDENCE_LINK_GUARDS` entry (`access.test.ts:10`, `deleteRoutes.test.ts:76`), proving C5.4 appended. `[C54S-B7]` | `backend/src/routes/documents/deleteRoutes.test.ts`, `versionRoutes.test.ts` |
| **AT-208** | all | **C5.4 built no state machine and touched no docket.** Mechanical, in the PR body: `git diff origin/master...HEAD` shows zero occurrences of `quarantin`, zero new material status column, zero change under `backend/src/routes/dockets/`, zero change to `daily_dockets`/`docket_labour`/`docket_plant`, the three `approvedDockets: 0` literals unchanged, no new member in `ROLES` (`backend/src/lib/roles.ts:6-18`), and no new `multer(` call site. `[C54S-B3]`, `[C5S-B3]`, `[C5S-B8]` | mechanical, in the PR body |

---

## 14. Exit gate

1. AT-189 … AT-208 pass in CI; the DB-backed ones against the local disposable Postgres per `CLAUDE.md`. `src/test/databaseSafety.ts` is not weakened.
2. All applicable migrations applied to production via the `Production Migrations` workflow from `master` with the confirmation phrase; **no `db push`, no `--accept-data-loss`**.
3. `C5_MATERIAL_APPROVALS_ENABLED` completes all four rollout steps (§11), including step 3's **real** round-trip and its four named confirmations. `[C54S-B4]`
4. **A real project round-trips, owner Jay:** a mix or product registration transcribed from a real authority certificate; a superintendent's approval for that contract transcribed from a real instruction, naming them and their organisation; both appearing in that lot's issued folio with the transcriber distinct from the approver; and a non-conforming delivery raised as an NCR with the delivery linked, blocking that lot until closed.
5. **The RG-10 question is answered** — company asset or job asset — and `[C54S-a]` is confirmed or flipped in this document, not in a comment.
6. The folio p99 row delta and the register p95 are **measured on the reference dataset and recorded in the PR body** — a number, not an adjective. AT-203.
7. `[C54S-B2]` grep over the wave's diff (`git diff origin/master...HEAD`, **not** the tree — the `[C3R-A6]` lesson): no scheduled job, cron, trigger or request-time write of a derived registration status. AT-192(c).
8. `[C5S-B2]` + `[C54S-B1]` grep over the diff: none of *approves / registers / validates / verifies / certifies / checks* in C5.4 user-facing copy. AT-206.
9. `[C54S-B3]` grep over the diff: zero occurrences of `quarantin` and no material status column. AT-208.
10. `[C5S-B3]` grep over the diff: no docket-domain change. AT-208.
11. `[C5S-B7]` grep over the diff: no `document.delete` in C5.4 code.
12. `[C5S-B8]` grep over the diff: no new `imageValidation.ts` signature entry, **no new `multer(` call site** (the count stays at twelve), no new multer `fileFilter` allow-set.
13. **`[C54S-B7]` mechanical check, three registries:** every `Document` FK added by the wave has its `EVIDENCE_LINK_GUARDS` entry **and** its `GENERIC_VERSIONING_BLOCKS` entry, both **appended**; every project-scoped table added has its entry in **both** `RETAINED_PROJECT_RELATIONS` and the `_count` select. A one-line grep pairing new `documents("id")` FK lines in the migrations against new entries in the two guard files, plus AT-204's assertion. AT-204, AT-207.
14. **No new member in `ROLES`** (`backend/src/lib/roles.ts:6-18`) — §0.4. AT-208.
15. The research register in `docs/research/` records U1–U7 plus **RG-10 and RG-11** as open, so the next agent finds them by grep.
16. Docs and the Clancy knowledge mirror updated in the feature PR (standing boundary, program line 5). Clancy must not gain an entry saying CIVOS approves materials.
17. **`npm run fallow:audit` verdict recorded in every PR body.**
18. §16's honest unknowns re-read at the end of the wave; any that closed are moved to a closed table with the evidence, not deleted.
19. **§19's program amendment is either applied to the program file or explicitly declined by Jay**, and this document records which.

**Not in this gate:** malware scanning (open program-wide, §8); the C2 certificate-deletion fix (C4's); the `GENERIC_VERSIONING_BLOCKS` / `EVIDENCE_LINK_GUARDS` unification (§18.2); a company delete route or company retention guard (§16 item 5); C5.4d in any form; C5.5 in any form; U3–U7.

---

## 15. Decisions

### 15.1 Decisions for Jay

**DC5-6 — Is a company-scoped register reached through a project the right tenancy, or should it be a company-settings surface?**
→ *Recommendation:* **project-reached, as specified in §4.6.** It invents no tenancy helper, delivers cross-project readability with a `where` clause, preserves the archived-project check, and — the deciding point — a company-settings surface would be `COMPANY_ADMIN_ROLES` (owner/admin) only, which **locks the quality manager out of the feature built for them**.
*One-line why:* the "proper" company page is strictly narrower than the project-mounted route for the persona who needs it.

**DC5-7 — Does C5.4d (structured supplier certificates) get scheduled, or come off the roadmap?**
→ *Recommendation:* **do not schedule it, and do not buy AS 1379 yet.** The useful half already ships: `batchRef` is the *specified* traceability token (claims 6.3, 6.4) and the docket is already filed. The remaining half needs a purchased standard (U1), a further pass for non-concrete/asphalt materials (U7), and it delivers a transcription form nobody has asked for. Revisit when a pilot contractor asks for it by name — at which point buy the standard, because the CI provenance validator will refuse a grade-B pack anyway.
*One-line why:* the join key the specifications actually mandate is already in the database, and everything past it is transcription labour.

**DC5-8 — Should the Layer-2 approval record a "submitted, awaiting decision" state?**
→ *Recommendation:* **no, not in v1** (§4.3). RG-5 gives lead times — 4 weeks for concrete mix nomination (5.2, 5.10, 5.15), 7 days for asphalt (5.8), 28 days recommended for registration (5.7) — so a submission genuinely has duration, and there is a real argument. But no source establishes what the contractor's *record* of that submission is, and a state whose only content is "we sent it" is a reminder, not evidence. Ask it in the step-3 round-trip; adding a fourth `CHECK` value later is a reviewed migration.
*One-line why:* the lead times are real, the record of them is not established, and the `CHECK` makes it cheap to add once it is.

**DC5-9 — Do subcontractors see material approvals or registrations?**
→ *Recommendation:* **no — 403 on every C5.4 surface**, same as DC5-3 and DC5-5. `requireSubcontractorPortalModuleAccess` has a closed six-member module vocabulary (`backend/src/lib/projectAccess.ts:7-13`) with no materials key, and a registration carries supplier names and plant locations across a company.
*One-line why:* it is not a matrix cell, it is a new disclosure surface spanning every project the company runs.

**DC5-10 — Does the program line get amended (§19), or does the clause stay and go unbuilt?**
→ *Recommendation:* **amend it, in the in-line style the program already used for C3 at line 77.** The research is a grade-A negative over ~200 documents. Leaving *"rejected/quarantined material state"* in the program line means the next agent handed Wave C reads it as an outstanding obligation and builds it — which is exactly how the D2 clause survived until C5's Rev 1 read the D0 research.
*One-line why:* an unstruck clause is one confident agent away from a state machine nobody in AU civil uses.

### 15.2 The spec's own decisions

- **`[C54S-a]`** — `ProductRegistration` is **company-scoped, project-reached**. *(§4.6.)* *Flip condition:* the step-3 round-trip (RG-10) shows a contractor treats registrations as job assets — in which case the column becomes `projectId` and the read `where` collapses, a smaller change than the reverse would be.
- **`[C54S-b]`** — Two tables, no shared abstraction, no `kind` discriminator. *(§4.1.)* *Flip condition:* a third layer appears with the same tenancy **and** the same lifecycle **and** the same permission shape.
- **`[C54S-c]`** — The Layer-1 status vocabulary is the four published values **plus `'not_stated'`**. *(§4.2.)* *Flip condition:* U6 shows another authority publishing a fifth status word — added by reviewed migration, never mapped onto an existing value.
- **`[C54S-d]`** — Layer 1 records *that* a registration exists and is current, never *what the material is made of*. *(§4.2.)* *Flip condition:* none foreseeable; constituent detail is the RG-6 field-list problem and belongs to C5.4d.
- **`[C54S-e]`** — Layer 2 has three states and no `'submitted'`. *(§4.3.)* *Flip condition:* DC5-8, answered in the round-trip.
- **`[C54S-f]`** — `holdPointId` is a nullable annotation that nothing depends on. *(§4.3.)* *Flip condition:* RG-11 resolves to "the release **is** the approval" for the pilot's jurisdiction — and even then the answer is a read-side projection, not a gate.
- **`[C54S-g]`** — Approvals are in the folio but **not** in the hold-point release package. *(§4.7.)* *Flip condition:* a real superintendent asks for it. Same call and reasoning as `[C5S-e]`.
- **`[C54S-h]`** — C5.4a ships unflagged; C5.4b and C5.4c share one flag. *(§11.)* *Flip condition:* none foreseeable — they are two halves of one feature.
- **`[C54S-i]`** — C5.4 takes **AT-189 … AT-208**; next free **AT-209**. `AT-157 … AT-169` stay reserved for D1c.1. *Flip condition:* none — a series gap is harmless, a collision is not.
- **`[C54S-j]`** — No new role, and `superintendent` does not join `ROLES`. *(§0.4.)* *Flip condition:* a wave that actually needs an authenticated external approver — at which point it is a role **plus** a portal module **plus** a threat model, and it is not this wave.

---

## 16. Honest unknowns

Listed rather than asserted. Each names how it gets resolved.

1. **Whether a head contractor will maintain a registration register at all.** This is **U2**, and it is the one grade-C unblock condition RG-5 did **not** meet — the *authority*-side register schema is known (claim 5.13), the *contractor*-side one is not. The whole of C5.4b assumes someone will type into it. → *Resolved by step 3 of the rollout.* ***Jay, with a design partner.*** **This is the largest risk in the wave and it is a demand risk, not a technical one.**
2. **Whether registrations are a company asset or a job asset (RG-10).** §4.6 decides company on the strength of "valid across all of that authority's projects", which is an authority-side fact being used to infer a contractor-side filing habit. → *One question in the round-trip.* `[C54S-a]` carries the flip.
3. **Whether Layer 2 and the hold-point release are one act or two (RG-11).** Grade-A sources differ by jurisdiction, and the tolerance research found the sibling survey question answered three different ways (`c5-survey-tolerance-research-2026-07-31.md:632-633`). → *`[C54S-f]` makes the column non-load-bearing so this can be answered late without a migration.*
4. **Whether `product_registrations` needs to appear in the account privacy export.** It is company-scoped and carries third-party names (`supplierName`, `plantLocation`); the shipped export path at `backend/src/routes/auth/accountPrivacyRoutes.ts` is project-shaped. **Not asserted as handled** — checked at build time against the actual export scope, and if it is out of scope that is a finding to record, not a gap to leave silent.
5. **What a company hard-delete would owe.** There is no company delete route today (§2.4, grepped) so `product_registrations` owes no retention entry. If one is ever built, it owes a `RETAINED_*` guard, and `product_registrations` belongs in it — along with `WebhookConfig`, `GlobalSubcontractor` and `ImportMappingProfile`, which have the same exposure today. → *Not C5.4's to build; recorded so it is not discovered by a data loss.*
6. **Whether malware scanning matters more than this wave thinks.** C5.4 reasons out of a threat-model artifact by adding no new file type and no upload route. Correct as far as it goes, and it does not make the program-wide gap smaller. → *Program §7's requirement stays open and unowned.*
7. **Whether the five-value Layer-1 vocabulary generalises past VIC asphalt.** It is one authority's, for one material (claim 5.13), being used as the shape for all schemes. `'not_stated'` is the pressure valve. → *U6, and the round-trip.*
8. **Whether `batchRef` free text is enough, or whether the approval→delivery join needs to be structural.** The specifications mandate the identifier appear on the docket (5.11, 6.7, 6.12) and CIVOS transcribes it — but nothing joins a `batchRef` to a `registrationNumber` programmatically, so the "prove this delivery was an approved mix" question is answered by a human reading two screens. → *Measure it on the pilot: how often do the two strings actually match? A query, not a research pass, and the cheapest unknown here.*
9. **Whether the NCR↔delivery link gets used.** C5.4a is cheap enough that this barely matters, but if nobody links, the clause was discharged on paper. → *Count linked NCRs on the pilot tenant in week one.*

---

## 17. Delivery-control checklist (program §9 — all thirteen items)

| # | Item | Where |
| --- | --- | --- |
| 1 | Exact included and excluded behaviour | §0.2, §1.1, §1.2 |
| 2 | Schema and data flow | §4, §5 |
| 3 | Permission matrix | §7.3 — every row checked against the real access helper |
| 4 | Edge cases | §4.2 (revision vs new registration), §4.3 (cross-tenancy on the layer FK), §4.4 (null lot, same project), §5.3 (DB vs route split), §12 (FK drop ordering), §13 (AT-190, AT-193, AT-197, AT-200, AT-203) |
| 5 | Migration plan | §5 — four additive reviewed Prisma migrations from slot `20260811000000`, prod apply via the production-migrations workflow, no `db push` |
| 6 | Security threats (§7) | §8 |
| 7 | Performance tests (§8, reference dataset) | §9, AT-203 |
| 8 | Feature flag + rollout | §11 |
| 9 | Rollback / recovery | §12 — including the `Restrict` FK drop ordering |
| 10 | Acceptance tests | §13 |
| 11 | Pilot acceptance owner | **Jay**, with a design-partner contractor — §1.3, §11 step 3, §14 items 4–5 |
| 12 | Production monitoring | Sentry on the new routes (shipped path, no new config); the register p95 in the existing perf series; **the count of registrations past `validTo` still referenced by an approval** as the one C5.4-specific signal worth watching, because it is the failure mode the feature exists to expose; and **the count of registrations created per tenant in the first fortnight**, which is the direct measure of whether §16 item 1's demand assumption was real |
| 13 | Exit-gate evidence | §14 |

---

## 18. Verification notes — derived at `ed202483`

### 18.1 Claims this spec corrects or records

| Claim | What was believed | **Correct at `ed202483`** |
| --- | --- | --- |
| The approver AU civil names is a CIVOS actor | The natural reading of RG-5 | **FALSE, and it reshaped the design.** `superintendent` is not in `ROLES` (`backend/src/lib/roles.ts:6-18`) or `ROLE_HIERARCHY` (`:26-38`). The superintendent is external, reached by emailed token links (`backend/src/routes/copilot/chat/productKnowledge.ts:116`). The literal string in `HP_RELEASE_ROLES` (`backend/src/routes/holdpoints/actionRoutes.ts:65`) and `HP_SUPERINTENDENT_RELEASE_ROLES` (`superintendentRecipients.ts:25-30`) is **vestigial and unreachable** as an effective project role. §0.4; the design copies `HoldPoint`'s attribution columns (`schema.prisma:855-860`) instead. |
| `[C5S-B9]`'s "a new `Document` FK owes two registry entries" | Parent spec §4.3, Rev 2 | **It is three at this HEAD.** `EVIDENCE_LINK_GUARDS` (`evidenceLinkGuards.ts:25-112`), `GENERIC_VERSIONING_BLOCKS` (`versionRoutes.ts:70-109`), **and both halves of the project retention guard** (`projects/writeRoutes.ts:44-68` **and** `:692-716`) for a project-scoped table. `[C54S-B7]`. |
| The two guard lists are order-insensitive | Implied | **FALSE.** Two shipped tests assert `delivery_docket` is the **third** `EVIDENCE_LINK_GUARDS` entry by position — `backend/src/routes/documents/access.test.ts:10` and `deleteRoutes.test.ts:76`. C5.4 must **append**. `[C54S-B7]`, AT-207. |
| The parent's `assertDocumentCanUseGenericVersioning` description | Parent §2.3(e)2, §4.3 entry 3 | **Stale in shape, correct in substance.** The probing now lives in a separate `GENERIC_VERSIONING_BLOCKS` array (`versionRoutes.ts:70-109`) with four entries; the function (`:111-128`) iterates it. The parent's substantive point holds and is restated in its own comment at `:62-67`: it **does not read `EVIDENCE_LINK_GUARDS`**. |
| The evidence route is mounted in `backend/src/index.ts` | The natural reading of the parent's §7.1 | **FALSE.** `backend/src/index.ts` is a bootstrap that dynamically imports `./server.js` (`:53`). All mounts are in `backend/src/server.ts` — deliveries at `:159-160`, `:169`; NCRs at `:177`. |
| A delivery register page exists to hang C5.4 UI from | Parent §7.2 | **FALSE.** C5.1 shipped backend-only; `frontend/src/App.tsx` has no deliveries route and no frontend file calls the delivery routes. §2.6, §7.2. |
| `RETAINED_PROJECT_RELATIONS` and the `_count` select are one list | Implied by `[C5R-A7]` | **FALSE — they are two hand-maintained lists**, eighteen members (`:44-68`) versus sixteen (`:692-716`), reconciled by a manual spread at `:724-733`. The declared authority is the const (`:60-64`: *"the `_count` select alone is inert"*). Omitting a member is a compile error; **adding a new table requires editing both by hand**. AT-204. |
| `NCR` is lot-scoped | The natural reading of RG-8 claim 8.15 | **Operationally true, structurally not.** The row hangs off `projectId` (`schema.prisma:1067`); lot association is entirely through `NCRLot` (`:1157-1167`), many-to-many. The research's claim is about the *nonconformance record's grain in practice*, and `open_ncrs` does block per-lot — so 8.15 still validates `NCRLot`. Recorded because a C5.4 reader inferring `NCR.lotId` would write a broken query. |
| `NCR.status` is constrained | Reasonable to assume | **FALSE.** No DB CHECK on `ncrs.status` or `severity` in any migration. The only enumerated list is a query **filter** (`ncrCoreValidation.ts:25-33`); writes are hard-coded literals guarded by conditional `updateMany`. C5.4 does **not** fix this — it is NCR-owned — but a C5.4 author must not assume a constraint exists. |
| There is a company-scoped access helper | Assumed while designing §4.6 | **Only `requireCompanyAdmin` (`backend/src/routes/company/access.ts:6-17`), owner/admin only, synchronous, zero DB I/O.** There is **no `requireCompanyMember`**. §4.6 routes around it rather than inventing one. |
| There is a company delete route | Assumed while designing the retention obligation | **FALSE** — grepped; `companyRouter` (`backend/src/routes/company.ts:52`) has no `.delete`. `Project.company` is `onDelete: Restrict` (`schema.prisma:416`) but there is no route, no guard, no message. §16 item 5. |
| `ITPTemplate` is the company-scoped-library precedent | The natural assumption | **It has no `companyId` at all** (`:680-745`); `projectId == null` means global/seeder-owned. The real precedent is **`ImportMappingProfile`** (`:2384-2408`), the only shipped model with a genuine three-tier null/company/project scope. Its manage-guard *shape* (`itp/templateAccess.ts:57-58`, `:65-73`) is still worth copying. |
| `requireSupersededByInProject` is `drawings.ts:36-65` | Parent spec §2.3(a), §4.5, §7.1, AT-175 — correct at `1e6ed156` | **Drifted one line by `ed202483`: it is `:37-66`**, and the `drawingNumber` identity check the parent (correctly) called the load-bearing one is `:57-60`, not `:56-60`. `:36` is now blank and `:66` is the closing brace. Corrected in this document's three citations. Recorded because the parent's own §19 warns that a reviewer's line numbers are claims, not facts — the same rule applies to a parent spec's, and this is the only drift found across the fourteen citations carried across. |

### 18.2 Observations for whoever builds this — none blocking

1. **The `Ruleset` provenance validator is the mechanism that makes C5.4d self-gating.** `validateProvenance` (`backend/src/lib/readiness/sufficiency/registry.ts:512-575`) fails CI on a `confirmed` pack that is not grade A. A certificate profile authored from claim 6.2's grade-B CCAA paraphrase **cannot ship confirmed**. Do not weaken the validator to make a pack fit; that inverts the control.
2. **`degradeIfLapsed` (`registry.ts:100-122`) is the exact idiom for registration currency** — compute at read, return a derived flag on a copy, persist nothing, treat a malformed date as lapsed. Copy it rather than reinventing; a `revalidationLapsed`-shaped field is documented `RUNTIME-ONLY, never persisted` for the same reason `[C54S-B2]` exists.
3. **`assertLotSufficiencyAttributes`'s header (`lotAttributeValidation.ts:1-24`) is required reading before building C5.4d.** Its predecessor was module-private with one call site, so four of five write paths wrote the value unchecked — **named as a privilege bypass that was invisible afterwards**. Any C5.4d field validation gets one exported choke point, called from every write path.
4. **`NCRLot` has no index on `lotId` alone** — only the composite `@@unique([ncrId, lotId])` (`schema.prisma:1157-1167`). Every lot-scoped NCR query rides that composite's leading column, which is `ncrId`. Not C5.4's to fix, and worth knowing before blaming a C5.4 query for a slow lot page.
5. **`DiaryDelivery` still has no `project_id`** (`[C5R-A9]`, re-verified). C5.4a's same-project check is a join through `daily_diaries`, not a column comparison. Writing it as a column read will compile and silently pass nothing.
6. **`HoldPoint` has no free-standing form** — every one is anchored to an ITP checklist item with `onDelete: Restrict` (`schema.prisma:847`, `@@unique([lotId, itpChecklistItemId])` `:879`). A C5.4 approval cannot create a hold point to hang itself on, which is a second reason `[C54S-f]` keeps the link weak.
7. **There is no shared `featureFlags.ts`** — `readinessSnapshotsEnabled()` (`recordDecision.ts:236-239`) and `surveyRecordsEnabled()` (`surveys/statusWorkflow.ts:73-76`) are independent local functions with identical bodies. C5.4 adds a third. Extracting them is a genuine twenty-line cleanup and it is **not C5.4's** — it would touch two shipped gates for no behaviour change.
8. **`REASON_CODE_PROVENANCE` is a second registry that must be edited in the same change as `READINESS_REASON_CODES`** (`reasonCodes.ts:23-28` states the contract; the test enforces it). Two new codes means four edits, not two.

---

## 19. Program amendment — proposed

**The clause:** program `§3` Wave C, **line 79**, currently reads in part:

> *… batch/delivery traceability (concrete/asphalt dockets → installed lot); **rejected/quarantined material state**. Feeds C4 integrity, E2 release packages, and D2 asset records.*

**The proposal:** strike *"rejected/quarantined material state"*, in the in-line style the program already uses — the C3 precedent at **line 77**, where `~~TfNSW LIMS tabulated ingestion~~` is struck with a bracketed `[CORRECTED …]` note carrying the research citation. Proposed replacement text:

> *… batch/delivery traceability (concrete/asphalt dockets → installed lot); ~~rejected/quarantined material state~~ **[CORRECTED 31 Jul 2026: no quarantine state exists in AU civil practice. Across ~200 authority specifications and council documents the string `quarantin*` occurs three times, all Red Imported Fire Ant biosecurity conditions — zero material-quality uses (`docs/research/c5-material-traceability-research-2026-07-31.md`, RG-8 claim 8.1). Nonconforming material is handled by an NCR plus a prohibition on covering up or incorporating it (TfNSW Q6 cl 3.12.4, claim 8.6; TMR MRTS50 cl 10.2, claim 8.8), and that record is lot-scoped by specification (TMR MRTS50 cl 7.1/7.2, TfNSW Q6 cl 3.9, claim 8.15) — which CIVOS already implements via `NCRLot` and `lotConformable`'s `noOpenNcrs` limb. Material rejected at delivery generates no record at all: it is removed from site (claim 8.14), or under AS 4000 cl 29.3(d) never delivered (claim 8.13). C5.4a ships the linkage — one nullable FK from `NCR` to the delivery — instead.]***

**Why it must be struck rather than left unbuilt.** The D2 precedent is the argument. *"Feeds D2 asset records"* survived in line 79 until C5's Rev 1 read the D0 research and found the receiver had been deleted — and the parent spec had to spend a scope-cut row disposing of a clause with no referent. An unstruck clause reads to the next agent as an outstanding obligation. This one is worse than D2's, because *"rejected/quarantined material state"* describes something that sounds entirely plausible and would be straightforward to build: a status column, a few values, a filter. It would be filled in wrong, and it would then be exported into a folio an engineer signs.

**The two clauses' disposal is the same class**, and the program should record it the same way. **DC5-10** is Jay's call; exit-gate item 19 requires this document to record which way it went.

**One clause this spec does *not* propose striking.** *"supplier certificates"* stays. The filing half shipped in C5.1 and the structured half is real, specified in §4.5, and blocked on a purchasable standard rather than on a missing referent. It is unscheduled (DC5-7), not disproved.

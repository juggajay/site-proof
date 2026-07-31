# Wave C5.4 Execution Specification — approval is two stacked layers, and CIVOS records both without granting either

**Date:** 31 July 2026 · **Rev 2**, re-derived at `origin/master` HEAD `e3084475` (`feat(ncr): Wave G G5 — render the NCR trends, close the loop into a template revision (#1728)`). Rev 1 was authored at `ed202483` and merged as #1727.

**Status:** **specification cycle only. The build is a separate later go from Jay** — no PR under this spec may open until he gives it. Of the four phases below, **C5.4a is unblocked and shippable on that go** (both adversarial reviews passed it; it now carries one firm G5 coexistence requirement, §10), C5.4b and C5.4c are **pilot-gated** on the same terms `[C5S-B4]` already imposes on C5.2 **and were re-specified in this revision**, and **C5.4d is research-gated on U1** and should not be scheduled (DC5-7).

**All `file:line` citations in this document were re-opened and re-read at `e3084475`.** G5 (#1728) inserted rows into the `NCR` model, so **every `schema.prisma` citation below `:1000` moved** — the Rev 1 numbers are stale and are corrected throughout (§18.1). Nothing is carried forward from the parent spec or from either research document without being re-derived against the tree.

**Program contract:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` §3 Wave C, **line 79** — the three clauses this spec owns are *"material/product approvals; supplier certificates; … rejected/quarantined material state"*. Also **§3 line 84** (the D2 pilot-validation requirement C5.2 already inherits two-thirds of), **§6 lines 121–131** (definition of done), **§7 lines 134–135** (threat-model gate and standing security requirements), **§8 lines 138–146** (performance targets and reference dataset), **§9 line 149** (this document's existence), **§10** (the evidence-grade scale).

**§19 proposes a program amendment** striking *"rejected/quarantined material state"* from line 79, on the same disposal basis and in the same in-line style the program already used for C3 at **line 77**.

**Parent spec, read not remembered:**
- `docs/plans/wave-c5-survey-material-traceability-spec-2026-07-31.md` (**Rev 2**) — C5.4 was *specified and BLOCKED* there (§3.2, §10). This document discharges those blocks. Its invariants bind here in full: `[C5S-B1]` (CIVOS records verdicts, never makes them), `[C5S-B2]`, `[C5S-B3]` (the docket domain is untouched), `[C5S-B5]`, `[C5S-B7]` (no `document.delete`), `[C5S-B8]` (no thirteenth multer — every file arrives as an already-uploaded `documentId`), `[C5S-B9]` (a `Document` FK owes its guard entries in the same PR).

**The research this spec is built on — both merged 31 Jul 2026, and it is built ON them, not alongside them:**
- `docs/research/c5-material-traceability-research-2026-07-31.md` — **RG-5**, **RG-6**, **RG-8**. Grade-A primary sources read from the actual specification PDFs. Its claim numbers (5.1–5.17, 6.1–6.14, 8.1–8.15), its seven modelling consequences and its seven unanswered items (U1–U7) are cited throughout by number. **No design decision below contradicts it, and where this spec goes beyond it, it says so and marks the gap.**
- `docs/research/c5-survey-tolerance-research-2026-07-31.md` — mostly C5.5-relevant. Two findings touch C5.4 and are used: the calibration-certificate-in-an-equipment-register requirement (**cl 2.4.2–2.4.3, 2.6.x**, at `:299-307`), which is a third independent instance of the numbered/expiring/status-bearing registration pattern; and the point-to-triangulated-surface method being permitted only *with the Principal's prior approval* (`:244`), which is a fourth instance of per-contract approval consuming a general capability.

**House style** matches C1, C2, C3, C5, D, E, F and G: numbered sections, explicit disposal of every program clause, a current-state map read at a stated SHA, a decision register with flip conditions, per-phase rollback, named acceptance tests continuing the shared series, an exit gate, and program §9's thirteen delivery-control items enumerated.

**Tag namespace.** `[C54S-*]` for this spec's own decisions, `[C54S-B*]` for blockers no PR may violate. `[C5S-*]`, `[C5R-*]`, `[C1C-*]`, `[C1R-*]`, `[C2L-*]`, `[C2R-*]`, `[C3S-*]`, `[C3R-*]`, `[D14R-*]`, `[DH-*]`, `[DR2-*]`, `[FR-*]`, `[WBR2-*]` are taken. Per the parent's standing warning, **never a bare `C5` tag** — `C5` is a live clause-number fragment across `docs/research/sa-dit-*.md` and `docs/research/vic-itp/01-earthworks-pavements.md`.

**Acceptance-test numbering.** Re-measured at `e3084475`: the highest number allocated anywhere under `docs/` is **AT-188** (`docs/plans/wave-c5-survey-material-traceability-spec-2026-07-31.md:758`), and that document declares **AT-189** free at its `:24`, `:736` and `:815`. `AT-157 … AT-169` remain deliberately reserved for D1c.1's in-flight numbers. Wave G took the separate `AT-G1 … AT-G39` namespace and Wave F took `AT-F1 … AT-F3`; neither touches the shared series. Both adversarial reviews independently re-verified that `AT-189 … AT-208` collide with nothing. **Rev 2 extends the block: C5.4 occupies AT-189 … AT-216. Next free after this spec: AT-217.** `[C54S-i]`

**Ponytail note.** The three program clauses this spec owns look like three subsystems and are not. *Rejected/quarantined material state* is **one nullable FK on a table that already exists**, copied field-for-field from a link the same table already carries — and the enforcement the research says AU civil actually uses turns out to be **already shipped and already correct** (§4.4). *Material/product approvals* is two tables, and the only reason it is two rather than one is a grade-A finding (RG-5) that CIVOS would otherwise have got wrong in a way that is expensive to undo. *Supplier certificates* is the one clause where the honest answer is **build nothing yet**, because the standard that would define its fields is behind DRM and was not read (U1). The largest contribution this document makes is not a table: it is §4.3's finding that **the approver AU civil names — the superintendent — is not a CIVOS role and never has been**, so a permission matrix granting anyone "approve" would have been a lie, and the shipped hold-point release columns are already the correct shape for recording an external party's decision.

---

## 0.0 Rev 2 changelog — every review finding, and what changed

Rev 2 folds two independent adversarial reviews of Rev 1.

| Review | Reviewer | Score | Verdict |
| --- | --- | --- | --- |
| **Gating** | **gpt-5.6-sol**, at `4bb342a9` | **3.5 / 10** | **re-spec b/c.** C5.4a build-ready; C5.4b/c not build-ready — company authorization, document scope, flag scope, status semantics, lot applicability, folio tokens, attribution, FK tenancy, lifecycle and deletion semantics all require redesign. |
| Second opinion | opus5, at `4bb342a9` | 7.5 / 10 | C5.4a build-ready (one wording fix); C5.4b + C5.4c Rev 2 required. Three blockers, **all subsumed by sol's**. |

Both reviewers audited citations independently and found the Rev 1 `file:line` claims accurate. **The failures are design failures, not sloppiness, and they cluster in exactly the two phases Rev 1 itself gated on a pilot** — which is the part of Rev 1's own judgement that held up.

**Every blocker below is resolved by a design change. No blocker is answered with a caveat.**

### The one change that drives the others

`[C54R-B3]` and `[C54R-B4]` are one fault line: **Rev 1 gave a project-held role authority over company-held data, and backed company-wide proof with a project-only document.** Rev 2 resolves it by **scoping `ProductRegistration` to the project for v1** (§4.6) rather than by inventing company-level write authority and audited company-document reads. That single decision also dissolves opus5's `[C54R-A4]` (cross-project disclosure widening) and most of sol's `[C54R-A2]` (unmountable item routes). The company-library design is written down as the flip, not deleted — **DC5-6c**.

### Sol's findings (gating)

| ID | Verdict | What changed |
| --- | --- | --- |
| **B1** — no approval→lot edge | **ACCEPTED, verified.** `ProjectMaterialApproval` had `project_id` only; `DiaryDelivery` carries no material column (`schema.prisma:1338-1373`, re-read at this HEAD). | New join table **`ProjectMaterialApprovalLot`** in the shipped `NCRLot` shape (`:1183-1194`). §4.3.1, migration §5.3. Lot reads, the folio projection and the readiness predicate are driven **from the edge exclusively**. AT-209, AT-210. |
| **B2** — folio tokens ignore the projected registration | **ACCEPTED, verified.** `REVISION_TOKEN_KINDS` is an exhaustive `Record<FolioSourceType, …>` (`revisionTokens.ts:49-68`) and Rev 1 declared one source for a two-table payload. | **Two** `FolioSourceType` members — `'project_material_approval'` **and** `'product_registration'`, both `'updated_at'`. A linked registration contributes its own token to the compiled source set. §4.7, AT-211. |
| **B3** — project role, company-wide mutation authority | **ACCEPTED, verified** against `requireEffectiveProjectRole` (`projectAccess.ts:180-210`), which checks the role held **on the presented project**. | Registrations are **project-scoped in v1** (§4.6), so project authority now matches project data exactly. The company-library alternative is DC5-6c and, if taken, carries company-level write authority. |
| **B4** — company-wide proof, project-only document | **ACCEPTED, verified.** `Document.projectId` is required (`schema.prisma:1782`) and `canReadDocument` gates on that exact project (`documents/access.ts:401-405`). | Same fix. A registration and its certificate now live in one project, so the evidence is reachable by every reader who can reach the registration. `sourceDocumentId` is **required at create** (§4.2) — a "proven" registration with no artefact is no longer expressible. |
| **B5** — boolean flag cannot do a per-tenant rollout | **ACCEPTED, verified.** `parseProjectIdAllowlist` with the `'*'` sentinel is shipped at `notificationAutomation/helpers.ts:41-54`. | The boolean is replaced by `C5_MATERIAL_APPROVALS_PROJECTS`, a **fail-closed project allowlist** parsed by the shipped helper, applied identically to routes, UI bootstrap, readiness and folio collection. §11, AT-205. |
| **B6** — attribution enforced only for `approved` | **ACCEPTED.** | Generic **decision attribution required for every status**: `decided_by_name` / `decided_at` `NOT NULL`, `decision_reason` required for non-`approved`, plus **`recording_mode`** (`transcribed_document` \| `referenced_hold_point_release`) with a CHECK requiring the matching evidence. §4.3, §5.3, AT-197. |
| **B7** — `hold_point_id` has no tenancy rule | **ACCEPTED, verified.** `HoldPoint` reaches a project only through `lot` (`schema.prisma:854-895`; no `projectId`). | In-transaction validation that the hold point's lot belongs to the approval's project **and** is one of the approval's applicable lots. §4.3, AT-212. |
| **B8** — `NOT NULL` + `ON DELETE SET NULL` | **ACCEPTED, verified.** `tx.user.delete` is live at `auth/accountDeletionRoutes.ts:175`. Identical to opus5 `[C54R-B1]`. | `recorded_by` becomes **nullable** on both tables, **required at create** in the Zod body, with an immutable **`recorded_by_label`** snapshot `NOT NULL`. §5.2, §5.3, AT-213. |
| **B9** — approval identity neither unique nor revision-safe | **ACCEPTED.** Subsumes opus5 `[C54R-A7]`. | Identity defined as the **normalised `material_key` within a project**; a **partial unique index** enforces one current approved row; supersession **no longer requires an identical registration** and is serialised by a conditional update. §4.3, §5.3, AT-201, AT-214. |
| **B10** — `not_stated` conflates two facts | **ACCEPTED.** Subsumes opus5 `[C54R-A3]`. | The `DEFAULT` is gone and the column is **nullable**: `NULL` = not recorded, `'not_published'` = the scheme publishes none. A **transcribed** `'expired'` renders as the register's word; CIVOS's derived state renders as *"validity lapsed"* and never as "Expired". §4.2, §5.2, AT-193, AT-206. |
| **A1** — "superintendent is unreachable" is false | **ACCEPTED, verified.** `getEffectiveProjectRole` returns `projectUser?.role` raw (`projectAccess.ts:169`). Same as opus5 `[C54R-N1]`. | §0.4 restated as *non-canonical and unassignable through any shipped write path, possibly extant on legacy rows*, plus an **explicit decision** on what such a row may do here. `[C54S-j]`, AT-215. |
| **A2** — item routes lack project context | **ACCEPTED.** Same as opus5 `[C54R-B2]`. | **Every** C5.4 route is mounted `/api/projects/:projectId/…`. No implicit JWT company, no unexplained query parameter. §7.1. |
| **A3** — C1's machinery is not reusable as claimed | **ACCEPTED, verified.** `validateProvenance` (`sufficiency/registry.ts:512`) and `degradeIfLapsed` (`:119`) are both module-private and `Ruleset`-typed. | §4.5 now carries a **named extraction plan** — generic provenance and effective-window validators both registries call — plus opus5 `[C54R-A2]`'s point that the CI teeth are the **sweep**, not the function. |
| **A4** — profile provenance cannot express base + extension | **ACCEPTED.** | `CertificateField` carries **full per-field provenance**, and base/authority-extension packs compose explicitly. §4.5. |
| **A5** — metadata-lock unspecified | **ACCEPTED, verified.** Every guard entry must return `metadataLocked` (`evidenceLinkGuards.ts:14-23`, consumed `:163-176`). | The lock rule is stated (**locked from the moment the link exists**, both tables) and tested before and after. AT-207. |
| **A6** — currency needs tri-state and boundaries | **ACCEPTED.** | `registrationCurrency()` returns **`current \| lapsed \| unknown`** with a reason, `validTo` is an **inclusive civil date in `Australia/Sydney`**, and midnight boundaries are tested. §4.2, AT-216. |
| **A7** — DC5-6 and DC5-9 incomplete | **ACCEPTED.** | DC5-6 split into **DC5-6a…d** (ownership, read scope, write authority, evidence scope); DC5-9 gets an owner, a pilot question and a flip condition. §15.1. |
| **N1** — G5 not merged at review time | **NOW STALE IN ITS PREMISE, FOLDED AS A FIRM REQUIREMENT.** G5 **is** in `origin/master` at `e3084475`. Verified: it took slot `20260810000000_g5_ncr_learning_loop`, added `NCR.itpChecklistItemId` (`schema.prisma:1148`, relation `:1154`, index `:1176`) and did **not** touch `createNcrSchema`. **`20260811000000` is confirmed free.** | C5.4a is **specified against post-G5 line numbers**, and the coexistence test is a firm exit condition. §10, AT-208. |
| **N2** — C5.4a matches the NCR link pattern | Confirmed, no change. | — |

### Opus5's findings not already subsumed

| ID | Verdict | What changed |
| --- | --- | --- |
| **B1, B2, B3** | Subsumed by sol B8, A2 and B1 respectively. | — |
| **A1** — the "positional assertions" do not exist | **ACCEPTED — and it corrects Rev 1's own text.** Re-verified: `access.test.ts:10` and `deleteRoutes.test.ts:76` are **comments inside a Prisma mock literal**, not assertions. | Rev 1's three claims to the contrary are struck (§2.5, `[C54S-B7]`, §18.1). Appending is still mandatory — `GENERIC_VERSIONING_BLOCKS` is first-match precedence (`versionRoutes.ts:69`) — and the **real** obligation opus5 found replaces it: both suites mock Prisma **by table name**, so a new guard needs its mock entries or both files throw. AT-207. |
| **A2** — C5.4d's gate does not enforce itself | **ACCEPTED.** | Folded into sol A3's extraction plan: export the validator **and write the shipped-pack sweep**, in the same PR. §4.5, §18.2. |
| **A5** — §4.2 and §5.2 contradict on `recorded_by` | **ACCEPTED.** | Resolved by the B8 fix: nullable column, required at create, immutable label. Both sections now say the same thing. |
| **A6** — `'hold_point_release'` with a null hold point | **ACCEPTED.** | Now impossible: the `recording_mode` CHECK (B6) requires the hold point when the decision is recorded as a release. §5.3. |
| **A8** — G5 collision surface | **ACCEPTED**, and its stale premise corrected by N1. | §10 names the `schema.prisma` NCR-model conflict, the rebase owner and the coexistence test. |
| **N3** — b→c is an ordering edge, not a hard dependency | **ACCEPTED.** | §10 restates it as a `CREATE TABLE` ordering constraint. |
| **N4** — DC5-9 is not a decision, DC5-6 is already made | **PARTLY ACCEPTED.** DC5-6 is split rather than removed (sol A7 requires the four sub-decisions to be explicit, and Rev 2 changes the answer to one of them). DC5-9 keeps its entry because sol A7 requires an owner and a flip condition for a supplier-facing disclosure call, but its recommendation is now marked **standing, not open**. | §15.1. |
| **N5** — `createNcrSchema` is not `.strict()` | **ACCEPTED, verified** (no `.strict()` in `ncrCoreValidation.ts:88-125`). | AT-198's scope is narrowed to **C5.4b and C5.4c** write bodies. This was the one wording fix C5.4a needed. |
| **N6** — the unclaimed migration-slot gap is a hazard | **ACCEPTED.** | `20260810000000` was indeed taken while this spec sat — by G5. Rev 2 takes `20260811000000 …` contiguously and **exit-gate item 20 records the reservation in `docs/agent-handoff.md`**, where other waves read. |
| **N7** — folio bump blast radius is bounded | Confirmed, no change. | — |

### Rejected, with evidence

**Nothing in either review was rejected outright.** Two findings are folded with a correction to the finding rather than to the spec:

1. **Sol N1's premise ("G5 is not merged")** was true at `4bb342a9` and is **false at this HEAD** — G5 merged as #1728. The finding's *substance* (rebase, coexistence test, slot check) is folded as a firm requirement; its *premise* is recorded as superseded. Re-verified at `e3084475`: `20260810000000_g5_ncr_learning_loop` exists, `20260811000000` does not.
2. **Sol A1's "the design conclusion is wrong" reading is not adopted** — both reviewers agree the *conclusion* (do not add a `superintendent` role) is correct; only Rev 1's word *"unreachable"* was wrong. Rev 2 fixes the word and keeps the design, and adds the decision A1 asked for.

One Rev 1 claim is **struck as factually wrong at HEAD** on opus5's evidence: the "two shipped positional assertions" (above). That is a correction to this spec, not a rejection of a finding.

---

## 0. What this slice is, what it deliberately is not

### 0.1 The one-paragraph version

A quality manager can answer the question a superintendent asks on day one of a concrete pour: **"is that mix approved, and prove it."** Two things must be true and CIVOS holds neither today. First, the mix or product must be **current on the road authority's register** — a numbered entry with a status and an expiry, transcribed from the certificate the contractor holds. Second, **the superintendent for this contract must have approved it for this contract**, gated by a hold point, consuming the first as its evidence, and **applicable to named lots**. CIVOS files both, attributes both, shows the expiry, and surfaces the pair in the folio of the lots the approval covers — and it **grants neither**. When material turns out to be non-conforming, CIVOS does not invent a quarantine state, because AU civil does not have one: it links the existing NCR to the delivery it concerns, and the prohibition on covering the work up is the one CIVOS already enforces.

**Rev 2 note on where the registration lives.** The *registration* is valid across every project that authority lets — that is a fact about the authority's register and RG-5 establishes it (claims 5.10, 5.13). Where the contractor's **transcription of it** is filed inside CIVOS is a different question, it is unanswered (RG-10, U2), and Rev 1 answered it company-wide on an inference. **Rev 2 files the transcription in the project, with the certificate that proves it** (§4.6), because a project-held role cannot be given authority over company-held compliance evidence and a project-scoped `Document` cannot back a company-wide claim. The company library is the flip, not the default — DC5-6c.

### 0.2 The scope cut — the three program clauses, disposed

| Program line 79 clause | Disposition |
| --- | --- |
| *"material/product approvals"* | **IN, and it is two entities, not one.** `ProductRegistration` (Layer 1, the authority's register entry, its own lifecycle and its own evidence — C5.4b) and `ProjectMaterialApproval` (Layer 2, per-contract, decision-attributed, applicable to named lots — C5.4c). RG-5 consequence 1. **Rev 2: both are project-scoped in v1** — the two layers are still two tables, because RG-5 consequence 1 is about *lifecycle*, not about tenancy (§4.1, §4.6). §4.2, §4.3. |
| *"supplier certificates"* | **SPECIFIED, NOT SCHEDULED — C5.4d, gated on U1.** The filing half already shipped in C5.1 (`DiaryDelivery.docketDocumentId`, `batchRef`). The structured half is a **per-authority, per-material profile**, not fixed columns — RG-6 refutes fixed columns outright, not merely warns about them (§4.5). Its base pack cannot be written: AS 1379 cl 1.7.3's item list is known only at **grade B** through a CCAA paraphrase (claim 6.2, U1). **DC5-7 recommends not scheduling it.** |
| *"rejected/quarantined material state"* | **NO SUCH STATE IS BUILT. The clause has no referent in AU civil practice** — RG-8, and the corpus search at claim 8.1 found zero material-quality uses of the word across ~200 authority documents. What ships instead is **one nullable FK linking an NCR to the delivery it concerns** (C5.4a, §4.4), because the record AU civil actually uses is the NCR and the enforcement is a prohibition on incorporation that **CIVOS already implements** (`lotConformable`, `backend/src/lib/readiness/predicates.ts:477-486`). **§19 proposes striking the clause from the program line.** |

### 0.3 The honesty rule, inherited and sharpened `[C54S-B1]`

`[C5S-B1]` said: *a conformance verdict is a certification; CIVOS records who made one, it never makes one.* C5.4 is the same rule applied to an **approval**, and it has a second edge the survey case did not:

**CIVOS never grants an approval, and CIVOS never withdraws one either.**

The withdrawal half is the new one and it is grade A. Claim 5.14: poor field performance does not void a registration directly — the route is that the Contractor or Superintendent *requests the mix be de-registered and listed as Withdrawn*, and **"withdrawal is an authority act, not a project act."** So:

- A registration's `status` is **transcribed from the register**, never computed.
- **No job, no cron, no request-time coercion ever writes `'expired'`.** Expiry is **derived and displayed** from `validTo` against the clock, and surfaced as a `warning` readiness item — never persisted, never flipped. A background task that changed a registration's status to `expired` would be CIVOS performing a de-registration, which is precisely the authority act claim 5.14 forbids it. `[C54S-B2]`, AT-192.
- The Layer-2 approval carries the **external approver's name and organisation** alongside the **CIVOS user who transcribed it**, in the shipped `HoldPoint` release-attribution shape (§4.3). A reader can always tell a transcription from a signature.
- **Three epistemic states are distinguished, not two** `[C54S-c]`. `status IS NULL` = *nobody has recorded one*. `'not_published'` = *this scheme publishes no status; currency is the date window* — a recorded fact about the register. A transcribed `'expired'` = *the register itself says expired*. Rev 1 collapsed the first two into a `'not_stated'` **default**, which made an empty form field assert a fact about an authority — the exact class of assertion this rule exists to prevent (sol `[C54R-B10]`, opus5 `[C54R-A3]`). The precedent does it correctly: `SurveyRecord.surveyorVerdict` is `String?` with **no default** (`backend/prisma/schema.prisma:2808`), so "not transcribed" and "the surveyor stated none" stay distinct.
- **A derived state and a transcribed state never share a word.** CIVOS's own read-time finding renders as *"validity lapsed — confirm with the authority"*; only a transcribed register status renders as *"Expired"*, and it is labelled as the register's word. AT-206.
- No user-facing string says CIVOS *approves*, *registers*, *certifies*, *validates* or *checks* a material. Permanent, inherited from `[C5S-B2]`, extended with the four approval verbs. AT-206.

### 0.4 The finding that changes the shape — the approver is not a CIVOS role

RG-5 is unambiguous about who approves at Layer 2: the **superintendent-equivalent**, called the *Administrator* by TMR (claim 5.1, MRTS50 cl 8.1), the *Principal* by TfNSW (claim 5.15, B80 cl 3.9.1) and the *Superintendent* by VicRoads (claim 5.10, Section 610 cl 610.07(b)). Never the designer, never the RPEQ, never the contractor.

**CIVOS has no superintendent role.** `backend/src/lib/roles.ts:6-18` declares eleven roles and `superintendent` is not among them; `ROLE_HIERARCHY` (`:26-38`) has no entry for it. The superintendent in CIVOS is an **external party reached by emailed token links** — stated as product truth at `backend/src/routes/copilot/chat/productKnowledge.ts:116`: *"Superintendents work entirely from the emailed links. There is no CIVOS inbox or queue for them to sign into."*

There is one place the literal string appears in a role array — `HP_RELEASE_ROLES = [...HP_REQUEST_ROLES, 'superintendent']` (`backend/src/routes/holdpoints/actionRoutes.ts:65`) and `HP_SUPERINTENDENT_RELEASE_ROLES` (`backend/src/routes/holdpoints/superintendentRecipients.ts:25-30`).

**Rev 2 correction — the word Rev 1 used was wrong, the conclusion was not.** Both reviews caught it (sol `[C54R-A1]`, opus5 `[C54R-N1]`), and it is verified at this HEAD: `getEffectiveProjectRole` returns `projectUser?.role` **raw, with no fold through `roles.ts`** (`backend/src/lib/projectAccess.ts:169`). So the accurate statement is:

> `superintendent` is **non-canonical and unassignable through any shipped write path** — `parseProjectTeamRole` validates against `PROJECT_TEAM_ROLES` (`backend/src/routes/projects.ts:29-37`, `:125-130`), which excludes it, so no new `ProjectUser` row can carry it. **A legacy row carrying it would nonetheless resolve as a live effective role**, and three shipped call sites still query for such rows (`superintendentRecipients.ts:25-30`, `:52`; `notificationAutomation/systemAutomation.ts:12`; `frontend/src/pages/holdpoints/HoldPointsPage.tsx:88-92`).

**The decision sol A1 asked for, made explicitly** `[C54S-j]`: a legacy `superintendent` row **may read** every C5.4 surface — it passes `requireInternalProjectAccess`, which admits any non-portal string — and **may write nothing**, because it appears in neither `REGISTRATION_EDITORS` nor `MATERIAL_APPROVAL_RECORDERS`. C5.4 offers that actor **no direct signed path**: an external decision reaches CIVOS as a transcription or as a referenced hold-point release (§4.3's `recording_mode`), never as a CIVOS login. **C5.4 does not add `superintendent` to `ROLES`.** Adding a twelfth role to a hierarchy eight route-local const arrays read from has a blast radius far outside this wave, and it is not needed. AT-215.

A corollary §7.3 must carry: **the permission matrix's role columns are an enumeration of intent, not a closed set.** `requireInternalProjectAccess` admits any string that is not `subcontractor`/`subcontractor_admin`; the *write* consts are closed and are the real boundary.

**The shipped answer.** `HoldPoint` records an external release as attributed data, not as an actor: `releasedByName` / `releasedByOrg` / `releasedAt` / `releaseMethod` / `releaseSignatureUrl` / `releaseNotes` (`backend/prisma/schema.prisma:865-870`, re-anchored at this HEAD). A CIVOS user with an internal role performs the write; the columns say who actually decided.

**And it is half a shape, which makes C5.4's version an improvement rather than a copy** (opus5 `[C54R-N2]`, verified): **`HoldPoint` has no `releasedById`**. The shipped precedent records the external decider and leaves the internal transcriber to the audit log alone. `ProjectMaterialApproval` carries **both**, in the same row, plus a hard-fail in-transaction audit — so a reader of the row itself can always tell a transcription from a signature without leaving it. That is `[C5S-B1]` expressed as a schema, and it means the §7.3 matrix grants *"record that the superintendent decided"* — implementable — rather than *"approve"*, which is not.

### 0.5 What the research refuted, and what this spec does about it

Three things a competent agent would have built without the research, each now foreclosed:

1. **One `material_approval` table.** Refuted by RG-5 consequence 1. Registration data would be duplicated per project, or project approvals would be unable to differ. Two tables, §4.1.
2. **A `supplier_certificate` table with fixed columns.** Refuted — *"not merely risky"* — by RG-6 consequence 5. Four authoritative field lists exist for two materials, they are not supersets of one another (claims 6.2, 6.7, 6.9, 6.12), asphalt has **no** governing standard at all (6.11, a grade-A negative across three authority documents), and QLD declines to specify asphalt docket contents (6.14). Profile-driven, §4.5 — and not scheduled, DC5-7.
3. **A quarantine state machine.** Refuted by RG-8. Zero material-quality uses of `quarantin*` across the whole corpus (8.1); the concept is a *warehouse* one and AU civil delivery is just-in-time to a lot, so there is no inventory to hold (research §RG-8 closing); material rejected at delivery generates **no record at all** (8.14). One FK, §4.4.

**A fourth thing the research foreclosed that this spec would otherwise have got backwards:** the NCR grain. RG-8 claim 8.15 establishes that the nonconformance record is **lot-scoped by specification** (TMR MRTS50 cl 7.1, 7.2(e)–(f); TfNSW Q6 cl 3.9), which *validates CIVOS's existing `NCRLot`* against the parent spec's stated worry that it might be the wrong grain (`wave-c5-…:47`). C5.4 therefore re-grains nothing.

---

## 1. Outcome, scope and non-goals

### 1.1 Outcome

1. **A material's authority standing is answerable, with its proof attached.** A registration number, the scheme that issued it, its transcribed status, the dates it is valid between, and the certificate filed as a **retrievable document the reader can actually open** — which is the outcome Rev 1 could not deliver, because a company-wide claim was backed by a project-scoped `Document` (sol `[C54R-B4]`). Cross-project reuse is **deliberately deferred** to DC5-6c, not asserted.
2. **A material's contractual standing is answerable from the project, per lot.** Who decided, on what date, by what method, against which registration, with which hold point, **for which lots** — and which CIVOS user transcribed that.
3. **An expiring registration is visible before it bites**, as a `warning` readiness item on the lots an approval that consumes it applies to — never as a status CIVOS wrote.
4. **A non-conforming delivery reaches its NCR in one click and the NCR reaches the delivery.** No new state, no second workflow, no duplicate of a shipped flow.
5. **Nothing is automatically decided.** C5.4 adds **no blocking readiness code**, moves no lot to conformed, gates no claim and releases no hold point. `[C5S-B5]` binds unchanged.
6. **The one clause with no referent is struck from the program**, with its citation, rather than built as a plausible-looking table nobody can fill in (§19).

### 1.2 Non-goals — do not build in C5.4

- **No quarantine state, no material status machine, no segregation flag, no "on hold" material.** `[C54S-B3]`. RG-8. Not behind a flag, not as a UI-only affordance.
- **No record of material rejected at delivery.** Claim 8.14: two jurisdictions, two materials, same answer — removal, not retention in a state; and under AS 4000 cl 29.3(d) it is *"not deliver it to the site"*, an exclusion rather than a state (8.13). MRTS70 cl 11.1 asks only that *"a visual record should be kept"* — **a `should`, and a photo**. A photo already has a home: category `'Material Delivery'`, `backend/src/routes/documents/classificationRoutes.ts:47`. Nothing to add.
- **No `Supplier` entity and no supplier approval.** `DiaryDelivery.supplier` stays the free-text column it is (`backend/prisma/schema.prisma`, within `:1338-1373`). RG-5 is explicit that the submitter is always the **Contractor, never the supplier directly** — so a supplier registry approves nothing and would be a directory, which is not what the clause asks for. What *is* registered per-supplier is a **product** (claim 5.5: cementitious materials must be *a registered product supplied by a registered supplier*), and that is Layer 1, where supplier is a field.
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

**Structurally safe without pilot validation** — because correctness does not depend on how anyone works: a registration row's existence, its number, its filed certificate, its dates, its project scoping, its immutability rules; the NCR↔delivery FK; the applicability edge; the folio projection and its revision tokens.

**Rev 2 moves one item across this line.** *Cross-project readability* was on the safe side of Rev 1's split and it does not belong there: it encodes a claim about how a contractor files, which is exactly the "depends on how someone works" test this section applies. It is now **pilot-gated as DC5-6c** (§4.6), which is the same treatment `[C54S-B4]` already gives the two vocabularies.

**NOT safe without pilot validation** — because it encodes a claim about how a real job runs: **whether a head contractor will maintain a registration register at all** (this is U2, and it is the one grade-C unblock condition RG-5 did **not** meet — *"the column set of a head contractor's own approved-materials register remains unknown"*); whether Layer 2 is one approval or a submission-plus-approval pair; and whether the hold-point link is worth capturing structurally or is just a note.

**The resolution `[C54S-B4]`:** C5.4b and C5.4c ship **behind the flag**, and the flag stays off for every tenant until **one real material approval has round-tripped with a real contractor** — a registration recorded from a real certificate, an approval recorded from a real superintendent instruction, both appearing in a folio. The status vocabulary is `CHECK`-constrained so correcting it is a reviewed migration, not a data drift. Pilot acceptance owner: **Jay**, with a design-partner contractor (§17 item 11).

**C5.4a is not pilot-gated** and ships unflagged. It is one nullable FK plus a create-time validator on a flow that already exists, it duplicates a shipped pattern exactly (`NCR.linkedTestResultId`), and it discharges a program clause on its own.

---

## 2. Current-state map (re-read at `e3084475`)

### 2.1 What C5.1–C5.3 shipped, and what C5.4 stands on

| Thing | Where |
| --- | --- |
| **The delivery record** *(re-anchored post-G5)* | `DiaryDelivery` `backend/prisma/schema.prisma:1338-1373` — now carrying `docketDocumentId String?` `:1353` (FK `onDelete: Restrict`, relation `:1368`) and `batchRef String?` `:1356`. **It has no material column and no `projectId`** — the two absences that shape §4.3.1 and §4.4. The schema comment on `batchRef` names this wave by name: *"Free text, never parsed and never validated against a vocabulary — structuring it is C5.4, behind RG-6."* `@@index([lotId])` `:1345`; `@@unique([diaryId, requestKey])` `:1344`. |
| **The evidence-mutation route** | `PATCH /api/deliveries/:deliveryId/evidence` — `backend/src/routes/deliveries/index.ts:252-344`. `EVIDENCE_FIELDS` `:109`, `.strict()` body schema `:112-118`, `DELIVERY_EVIDENCE_EDITORS` `:71-79`, `requireEffectiveProjectRole(..., { requireWritable: true })` `:281-287`, `requireLotInProject` `:293`, same-project document check `:296-302`, hard-fail in-transaction audit `:330-337`. |
| Delivery read routes | `GET /api/lots/:lotId/deliveries` `:174`, `GET /api/projects/:projectId/deliveries` `:207` — both `requireInternalProjectAccess` (`:187`, `:211`). Mounted `backend/src/server.ts:159-160`, `:169`. **Note the mount file: `server.ts`, not `index.ts`** — `backend/src/index.ts` is a bootstrap that dynamically imports `./server.js`. |
| **The survey record** | `SurveyRecord` `backend/prisma/schema.prisma:2691-2750`; migration `backend/prisma/migrations/20260805000000_c5_survey_record/migration.sql` with **seven** CHECK constraints (`:38-60`). This is C5.4's nearest structural sibling and the source of its lifecycle idioms. |
| **The flag idiom — boolean** | `surveyRecordsEnabled()` `backend/src/routes/surveys/statusWorkflow.ts:73-76` — a verbatim copy of `readinessSnapshotsEnabled()` (`backend/src/lib/readiness/recordDecision.ts:236-239`). Enforced by **per-route** middleware `requireSurveyFlag` (`backend/src/routes/surveys/index.ts:170-176`), never `router.use` — the comment at `:164-168` records why: a router-level gate would 404 all of `/api/lots` when the flag is off. **There is no shared `featureFlags.ts`; each flag is a local function.** |
| **The flag idiom — scoped allowlist (Rev 2, and this is the one C5.4 uses)** | `parseProjectIdAllowlist` `backend/src/lib/notificationAutomation/helpers.ts:41-54` — **fail-closed**: absent, empty, `' '`, `','` and `' , , '` all return `[]`, and `[]` means *no projects everywhere it is consumed*. The **one** widening escape hatch is the literal `'*'` as the whole trimmed value, returning the distinct value `'all'` — *"a separate return value, not an empty list, precisely so 'empty means all' can never creep back in"* (`:33-40`). A `'*'` **inside** a list is dropped as an invalid id and the named ids stand. Consumed by Wave E's canary at `holdPointChaseAutomation.ts:383` and `systemAutomation.ts:391`. This is what a per-tenant rollout actually requires, and Rev 1 specified a process-wide boolean instead. |
| Folio contract | `FOLIO_PAYLOAD_SCHEMA_VERSION = 2` `backend/src/lib/handover/revisionTokens.ts:121`; `FolioSourceType` `:32-40` (eight members, now including `'survey_record'` and `'diary_delivery'`); `REVISION_TOKEN_KINDS` `:49-68`; `FolioEvidencePayload` `backend/src/lib/handover/folioPayload.ts:176-191` (`surveys` `:188` flag-gated, `deliveries` `:190` unflagged); `countEvidenceRows` `:207-220`. |
| Readiness | `EvidenceReadinessArea` `backend/src/lib/evidenceReadiness/core.ts:8-22` — twelve members; `'survey'` at `:19`, and the comment at `:17-18` records that deliveries deliberately reuse `'diary'`. `READINESS_REASON_CODES` `backend/src/lib/readiness/contracts/reasonCodes.ts:29-98` with `'delivery_not_lot_linked'` `:94` and `'survey_not_accepted'` `:97`. `HANDOVER_BLOCKING_REASON_CODES` `:127-150`, nine members, **neither C5 code is one**. |

### 2.2 The NCR and hold-point machinery C5.4 links to

| Thing | Where |
| --- | --- |
| **`NCR`** *(re-anchored post-G5)* | `backend/prisma/schema.prisma:1075-1182`. **Project-scoped** (`projectId` `:1077`), lot association entirely through the join table. `status String @default("open")` `:1083` — **no DB CHECK; validation is app-level only**. `severity` `:1082`. Concession and root-cause machinery unchanged. **G5 (#1728) added `itpChecklistItemId String?` `:1148`**, relation `:1154` (`onDelete: SetNull`), index `@@index([projectId, itpChecklistItemId])` `:1176`. |
| **The FK pattern C5.4a copies** | `linkedTestResultId String?` **`:1084`**; relation `linkedTestResult TestResult? @relation("NcrLinkedFailedTestResult", …, onDelete: SetNull)` **`:1161`**; **`@@index([linkedTestResultId])` `:1177`**. Set **create-only**: validator `requireFailedTestResultForNcr` `backend/src/routes/ncrs/ncrCore.ts:156-187` — same-project check `:174-176`, pass/fail check `:178-180`, lot-consistency check `:182-184`. Present in `createNcrSchema` (`backend/src/routes/ncrs/ncrCoreValidation.ts:107`) and **absent from `updateNcrSchema`** (`:127`). **`createNcrSchema` is not `.strict()`** (`:88-125`, grepped — opus5 `[C54R-N5]`), which bounds AT-198. |
| **`NCRLot`** | **`:1183-1194`** — a pure join table, no payload, `@@unique([ncrId, lotId])`, both FKs `Cascade`. One NCR to many lots. **No index on `lotId` alone.** **This is the shape `ProjectMaterialApprovalLot` copies** (§4.3.1). |
| `NCREvidence` | **`:1195-1207`** — `ncrId` + `documentId` + `evidenceType String`, `@@unique([ncrId, documentId])`. |
| **G5's footprint, and the C5.4a overlap** | Migration `backend/prisma/migrations/20260810000000_g5_ncr_learning_loop/migration.sql` — `ALTER TABLE "ncrs" ADD COLUMN "itp_checklist_item_id" TEXT` plus `template_revision_proposals`. Verified: G5 **did not** edit `createNcrSchema`; its category/root-cause vocabulary is route-side and flag-gated (`NCR_LEARNING_LOOP_ENABLED`). **The whole C5.4a↔G5 overlap is therefore the `NCR` model block in `schema.prisma`** — two nullable FKs, two indexes, orthogonal grains. §10 carries the rebase and the coexistence test. |
| NCR status vocabulary | Not a CHECK and not a transition map. The only enumerated list is a **query filter**: `NCR_STATUS_FILTERS` `backend/src/routes/ncrs/ncrCoreValidation.ts:25-33`. Writes are hard-coded literals in each handler, guarded by conditional `updateMany({ where: { id, status: <expected> } })`. Terminal states are canonical at `CLOSED_NCR_STATUSES = ['closed', 'closed_concession']` `backend/src/lib/readiness/predicates.ts:337`. |
| NCR role consts | `backend/src/routes/ncrs/ncrAccess.ts` — `NCR_CREATE_ROLES` `:32-40`, `NCR_QUALITY_MANAGEMENT_ROLES` `:41-47`, `NCR_QM_APPROVAL_ROLES` `:48`, `NCR_EVIDENCE_MUTATION_ROLES` `:49-53`. |
| **The prohibition on incorporation — already shipped** | `lotConformable` `backend/src/lib/readiness/predicates.ts:477-486` has `prerequisites.noOpenNcrs` as a hard limb. Driven by `conformancePrerequisites.ts:594-603` over a Prisma set pre-filtered by `status: { notIn: CLOSED_NCR_STATUSES }` (`:450-457`). Emitted as the blocking item `open_ncrs` at `backend/src/lib/evidenceReadiness/conformanceItems.ts:134-146`, and it **is** a member of `HANDOVER_BLOCKING_REASON_CODES` (`reasonCodes.ts:134`). |
| **`HoldPoint`** *(re-anchored)* | **`:854-895`**. Lot-scoped (`lotId` `:856`, Cascade), anchored to an ITP checklist item (`itpChecklistItemId` `:857`, **`onDelete: Restrict`**), `@@unique([lotId, itpChecklistItemId])` `:889`. **There is no free-standing hold point** — every one hangs off a checklist item. **Release attribution `:865-870`** — the shape §4.3 extends. **There is no `projectId` and no `releasedById`**: a hold point reaches its project *only* through `lot`, which is why `[C54R-B7]`'s tenancy check must be a join inside the write transaction (§4.3), and its missing transcriber column is why C5.4's `recorded_by` improves on the precedent rather than copying it (§0.4). Release route `POST /api/hold-points/:id/release` `backend/src/routes/holdpoints/actionRoutes.ts:209-210`; `HP_RELEASE_ROLES` `:65`; completion guard `releaseCompletionGuard.ts:10-18`; sequence prerequisites `prerequisites.ts:36-41`. |
| **NOT FOUND** | `ProductRegistration` · `MaterialApproval` · `MixDesign` · `Consignment` · `Material` model · `quarantine` in any material sense · any material-scoped NCR. Grepped across `backend/prisma`, `backend/src`, `frontend/src`. |

### 2.3 The authority-vocabulary pattern C5.4 reuses — this is the load-bearing precedent

C1's sufficiency rulesets are the shipped answer to "per-authority reference data with provenance", and RG-6 consequence 5 points at it by name (*"the shape C1 already uses for authority vocabularies"*). Re-read at `e3084475`:

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

**There is no `requireCompanyMember`.** A register readable only by `requireCompanyAdmin` would be readable only by owner and admin — which excludes the quality manager, who is the persona §0.1 is written for.

**Rev 2's finding, and it is the fault line both reviews landed on.** Rev 1 routed around the missing helper by authorising **project-locally** against `requireEffectiveProjectRole` while the *data* was company-scoped. That is not a workaround, it is a scope escalation: `requireEffectiveProjectRole` (`:180-210`) checks the role the user holds **on the presented project** and nothing more, so a quality manager assigned only to Project A would have been able to edit and supersede registrations consumed by Projects B–Z (sol `[C54R-B3]`, verified). `ImportMappingProfile` is **not** a counter-example: it proves company *filtering* on reads, not that project-local authority is adequate for company-wide compliance evidence.

**There are exactly three honest options, and §4.6 takes the third:**

| Option | Write authority | Certificate evidence | Cost |
| --- | --- | --- | --- |
| Company data, project authority *(Rev 1)* | **broken** — project role over company data | **broken** — `Document.projectId` required | none, and it is wrong |
| Company data, company authority | `requireCompanyAdmin` ⇒ owner/admin only, **locks out the QM** | needs a **new audited company-document read rule** — a novel access surface with no precedent | high, on an unvalidated feature |
| **Project data, project authority** *(Rev 2, §4.6)* | correct by construction | correct by construction | duplication of a six-field transcription across projects |

Precedents that matter for the flip: `ImportMappingProfile` `backend/prisma/schema.prisma:2471-2496` — nullable `projectId` `:2473` **and** nullable `companyId` `:2474`, `@@index([companyId, kind])` / `@@index([projectId, kind])` `:2493-2494`; its visibility query authorises via **`project.companyId`, never the JWT's** (`backend/src/routes/copilot/import/routes.ts:473-481`, re-validated at time of use `:521-536`, scope chosen at create `:560-578`). And **`GlobalSubcontractor` `:1423`**, a company directory whose rows are **copied** into project rows with a `SetNull` lineage FK (`SubcontractorCompany.globalSubcontractorId` `:1445`, relation `:1461`). **`GlobalSubcontractor` is the shape DC5-6c takes if the pilot says registrations are a company asset** — a company library above project rows, added additively, with the project row remaining the evidence-bearing one. It is the direction that composes; the reverse (retro-fitting project scope onto rows already shared across projects) is a migration with ambiguity in it.

`ITPTemplate` is a **weaker** precedent than it looks: it has **no `companyId` at all** (`:680-745`); `projectId == null` means global/seeder-owned, and globals are API-read-only (`backend/src/routes/itp/templateAccess.ts:122-127`). Its manage guard is still the right *shape* to copy — company-admin **or** a project role const: `TEMPLATE_MANAGER_ROLES` `:9-15`, gate `:65-73`, `hasCompanyAdminAccess` `:57-58`.

**There is no company delete route and no company retention guard.** Grepped: `companyRouter` (`backend/src/routes/company.ts:52`) exposes GET/POST/PATCH plus mounted member and API-key routers (`:348-349`) and no `.delete`. `Project.company` is `onDelete: Restrict` (`:416`), so a Prisma-level company delete would FK-fail while any project exists, but there is no route, no guard and no message. **Consequence for C5.4, and Rev 2 changes it:** Rev 1's company-scoped registration table owed nothing to `RETAINED_PROJECT_RELATIONS` — which sounded like a saving and was actually an unguarded table. With both C5.4 tables project-scoped (§4.6), **both owe both halves** (§2.5), and the guard that already protects every other evidence table protects these too.

### 2.5 The three hand-written registries a new FK must join

Re-measured at `e3084475`. The parent spec's `[C5S-B9]` said "two"; **at this HEAD it is three**, because C5.1/C5.2 have since landed and the retention guard has grown a second half.

1. **`EVIDENCE_LINK_GUARDS`** — `backend/src/routes/documents/evidenceLinkGuards.ts:25-112`, entry type `:16-23`, four entries: `'ncr'` `:27`, `'variation'` `:50`, `'delivery_docket'` `:74`, `'survey_report'` `:96`. Consumed by `assertDocumentDeletableOutsideEvidenceWorkflow` `:145-159` and `assertEvidenceMetadataMutable` `:163-176`. Every entry **must** return `metadataLocked` — it is a required field of `EvidenceLink` (`:14`), so a new guard that omits the rule does not compile; §4.8 states C5.4's rule and AT-207 tests it.

   **Rev 2 strikes a Rev 1 claim as false** (opus5 `[C54R-A1]`, re-verified at this HEAD). Rev 1 asserted three times that *"two shipped tests assert `delivery_docket` is the third entry by position"* at `access.test.ts:10` and `deleteRoutes.test.ts:76`. **Both are comments inside a Prisma mock object literal. They assert nothing.** `grep EVIDENCE_LINK_GUARDS backend/src` returns the definition and its two `for…of` consumers; no test reads an index.

   **Appending is still mandatory** — `GENERIC_VERSIONING_BLOCKS` is explicitly first-match precedence (`versionRoutes.ts:69`) — and the real obligation Rev 1 missed is this: **both suites mock Prisma by table name.** A fifth or sixth guard probing `productRegistration` or `projectMaterialApproval` throws `Cannot read properties of undefined (reading 'findFirst')` in both files until those mocks are added, in the same PR. That is what AT-207 asserts. `[C54S-B7]`
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
| **RG-10** | **Whether a registration is held by the contractor's company or by the project's client.** RG-5 establishes the *authority* holds the register and the *contractor* submits; it does not establish whose CIVOS tenant the transcription belongs to when a contractor works for two clients under different specification sets. **Rev 1 decided company-scoped** on the strength of "valid across all of that authority's projects" (5.10, 5.13) — an authority-side fact inferring a contractor-side habit. **Rev 2 decides project-scoped** (§4.6, `[C54S-a]`), because that is the answer that assumes less and it is the only one whose write authority and document evidence are implementable today. | **C5.4b's scoping, and DC5-6c.** | The `[C54S-B4]` round-trip: ask the pilot contractor whether their mix registrations are a job asset or a company asset. One question, not a research pass. |
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
| Scope of the *fact* | valid across every project that authority lets | one contract |
| Identity | a registration number issued by a scheme | a decision about a material, on a date |
| Status | a published vocabulary with an expiry (5.13) | approved / rejected / withdrawn — no published vocabulary exists |
| Revocation | de-registration to `withdrawn`, an **authority** act (5.14) | superseded by a new approval, a **contract** act |
| Gate | none — it is a register entry | a Hold Point (5.4, 5.9, 5.15) |
| Evidence in CIVOS | a registration certificate `Document` (**required**) | a decision instruction `Document`, or a referenced hold-point release |
| Applies to | nothing in CIVOS — it is a fact about a product | **named lots**, through an explicit edge (§4.3.1) |
| **Tenancy in CIVOS v1** | **project** (§4.6, `[C54S-a]`) | **project** |

**The two tables survive Rev 2's tenancy change, and it is worth saying why.** RG-5 consequence 1 refutes *one table* on **lifecycle** grounds — *"registration data would be duplicated per project, or project approvals would be unable to differ"* — not on tenancy grounds. Every row of the table above except the last still differs. Collapsing them would still force the false choice; giving them the same tenancy does not.

**Three namespaces, not one.** Claim 5.6 is explicit that ATIC, QRS and the mix register *"are not interchangeable"*. So the registration number is not globally unique in CIVOS and must be scoped by its scheme — `@@unique([projectId, scheme, registrationNumber])`, §5.2.

**No shared abstraction, no `kind` discriminator.** `[C54S-b]`. Same reasoning as `[C5S-b]`: an abstraction over two rows with different tenancy, different lifecycles, different permission shapes and different revocation semantics is an interface with two implementations whose every method branches on the discriminator anyway.

### 4.2 Layer 1 — the product/mix registration (C5.4b)

**What it is.** One row per *(scheme, registration number)* the contractor's company relies on. A VIC concrete mix on the Register of VicRoads approved concrete mixes (5.10). A VIC asphalt mix on the DTP register at General or Conditional status (5.13). A cementitious product with an ATIC registration number (5.5, 5.12). A quarry with a Registered Quarry Reference number (5.6). One shape covers all four because all four are *a numbered entry on a named authority's register, with a status and a validity window*.

**The status vocabulary is borrowed, not invented — and Rev 2 splits the honesty value in two** `[C54S-c]`.

The column is **nullable, with no `DEFAULT`**, `CHECK`-constrained to `NULL` or:

```
'general' · 'conditional' · 'expired' · 'withdrawn' · 'not_published'
```

The first four are **published** — VicRoads/DTP Section 407 v18.0 (October 2025) cl 407.09, claim 5.13, described by the research as *"the single most useful RG-5 artefact found"*. This is exactly the class of thing `[C5S-B1]` exists to stop CIVOS guessing, and it did not have to be guessed.

**Three epistemic states, because Rev 1's two were a conflation** (sol `[C54R-B10]`, opus5 `[C54R-A3]`):

| DB value | Means | Renders as |
| --- | --- | --- |
| `NULL` | **nobody has recorded a status.** The default state of a half-filled form. | *"register status not recorded"* |
| `'not_published'` | **a recorded fact about the scheme:** it publishes no status word, so currency is the date window alone. TMR's cementitious scheme (5.5) publishes "registered" and nothing else; the QRS (5.6) publishes a testing-frequency schedule and no status; VIC concrete (5.10) publishes a 12-month validity and no status word. | *"this scheme publishes no status"* |
| `'expired'` | **the register itself says expired**, transcribed by a human who read it. | *"Register status: Expired (as transcribed)"* — the register's word, labelled as such |

Rev 1 had `'not_stated' NOT NULL DEFAULT 'not_stated'`, so leaving the field blank silently asserted the middle row. The precedent Rev 1 cited actually does it the Rev 2 way: `SurveyRecord.surveyorVerdict` is `String?` with **no default** (`backend/prisma/schema.prisma:2808`). Mapping any unstated scheme onto `'general'` remains forbidden.

**Expiry is derived, never written.** `[C54S-B2]`, and it is the sharpest edge in the wave.

- `validFrom` / `validTo` are nullable `DATE`s transcribed from the certificate. VIC concrete gives the semantics: *"registrations remain valid for 12 months from date of registration"* (5.10). VIC asphalt gives the test: registration *"must be current at the time of use"* (5.13).
- CIVOS computes currency at **read time** and shows it. It never persists the answer and never writes `status = 'expired'`.
- The reason is claim 5.14: withdrawal is an authority act. A CIVOS job that flipped a status would be performing a de-registration. **`'expired'` is in the vocabulary only because a register may publish it and a human may transcribe it** — never because CIVOS derived it.
- **The runtime-degradation precedent is exact.** `revalidationLapsed` (exported, `backend/src/lib/readiness/sufficiency/registry.ts:100-110`) / `degradeIfLapsed` (module-private, `:119-122`) do precisely this for authority rulesets: compute lapse at read time, return a *derived* flag on a copied object, persist nothing, and treat a malformed date as lapsed. C5.4b copies the **idiom**; it cannot call the functions, which are `Ruleset`-typed (sol `[C54R-A3]`). AT-192.

**Currency is tri-state with defined boundaries** `[C54S-k]` — Rev 1 described a boolean `isCurrentAt(now)` and defined neither missing dates, nor whether `validTo` is inclusive, nor the timezone of a SQL `DATE` (sol `[C54R-A6]`):

```ts
// backend/src/lib/materials/registrationCurrency.ts — PURE. No Prisma, no I/O.
export type RegistrationCurrency = 'current' | 'lapsed' | 'unknown';

export function registrationCurrency(
  registration: { validFrom: Date | null; validTo: Date | null },
  at: Date,
): { state: RegistrationCurrency; reason: string };
```

- **`validTo` is an inclusive civil date in `Australia/Sydney`.** A registration valid to `2027-06-30` is `'current'` through `2027-06-30T23:59:59.999+10:00` and `'lapsed'` from the next civil midnight. The comparison folds both sides to a civil date in that zone — never a UTC instant comparison against a `DATE`, which shifts the boundary by ten or eleven hours depending on daylight saving. The zone is the app zone the notification automation already resolves (`resolveAppTimeZone`, `notificationAutomation/helpers.ts`), not a per-project field: C5.4 introduces no timezone configuration.
- **`validTo IS NULL` ⇒ `'unknown'`**, never `'current'`. CIVOS cannot assert currency with no published end date; that is `[C54S-B2]` applied to an absence.
- **`validFrom` in the future ⇒ `'unknown'`**, reason *"not yet in effect"*. It is not `'lapsed'` and it is not `'current'`.
- A malformed or unparseable stored date reads as **`'unknown'`**, following the `revalidationLapsed` discipline of never letting a bad date buy an unbounded claim — and `'unknown'` rather than `'lapsed'` because a lapse is a finding and this is an absence of one.
- AT-216 tests every branch, both midnight boundaries, and a daylight-saving transition.

**Provenance is mandatory, and Rev 2 makes the artefact mandatory with it.** Copying `RulesetProvenance`'s discipline (`sufficiency/types.ts:19-35`) at row level rather than pack level, because these rows are tenant-transcribed rather than shipped:

- `authority` — required.
- `scheme` — required; it is the namespace (claim 5.6).
- **`sourceDocumentId` — required, `NOT NULL`.** Rev 1 made it nullable, which permitted *"a supposedly proven registration with no evidence at all"* (sol `[C54R-B4]`). A registration row is a transcription; a transcription with no source is a claim. The document is project-scoped and so is the registration, so the reader who can see the row can always open the proof — which is the whole reason §4.6 moved.
- `recordedById` — **nullable scalar, required at create, with an immutable `recordedByLabel` snapshot** (§5.2, sol `[C54R-B8]`). Rev 1's §4.2 said "required" while §5.2 shipped it nullable; both now say the same thing.
- `sourceNote` — nullable free text: which register, which page, when read.

**What it does not have.** No mix constituents, no proportions, no test results, no field list. Claim 5.3 shows TMR's mix-design submission runs to ten sub-clauses of constituent detail — that is C5.4d's territory if it is ever entered, and it is exactly the RG-6 field-list problem. Layer 1 records **that a registration exists and is current**, not what it is made of. `[C54S-d]`

**Revision.** MRTS30 cl 7.3.3 draws the line C5.4b encodes (claim 5.8): a minor grading/binder change is a **revision** (updated certified copy, 3 working days), but *"a change to the mix design constituents constitutes a new mix design"*; and MRTS70 cl 15.1 (5.4) is blunter — *"any change in material sources or types constitutes a variation."* So: a re-issued certificate for the same registration number updates the row and audits `{from, to}`; a new registration number is a **new row**, and the old row is superseded through `supersededById` in the `SurveyRecord` / `Drawing` shape. No in-place identity change. AT-194.

### 4.3 Layer 2 — the per-contract approval (C5.4c)

**What it is.** One row recording that the superintendent-equivalent for *this contract* **decided** something about *this material* — approved, rejected or withdrew — on a date, by a method, evidenced by an artefact, applicable to named lots, optionally consuming a Layer-1 registration and optionally referencing the hold point it was recorded against.

**Attribution is generic across every decision status.** Rev 1 required a named decider and a date only for `'approved'`; a rejected row needed a reason and nothing else, and a withdrawn row needed nothing — while the invariant claimed *every* decision distinguishes the external decider from the transcriber (sol `[C54R-B6]`). A rejection is somebody's decision too, and an unattributed one is exactly the false record `[C5S-B1]` exists to prevent. So the columns are decision-generic and **`NOT NULL`**:

```
decided_by_name          NOT NULL  -- the Superintendent / Administrator / Principal, as named on the instruction
decided_by_organisation            -- their organisation
decided_at               NOT NULL  -- the date ON THE INSTRUCTION, not the date of data entry
decision_method          NOT NULL  -- 'letter' | 'email' | 'site_instruction' | 'hold_point_release' | 'other'
decision_reference                 -- their reference number, free text
decision_reason                    -- required for every status EXCEPT 'approved' (CHECK)
decision_document_id               -- the instruction filed as a Document
recording_mode           NOT NULL  -- 'transcribed_document' | 'referenced_hold_point_release'
recorded_by              NULL-able -- the CIVOS user who transcribed. NOT the decider. Required at create.
recorded_by_label        NOT NULL  -- immutable snapshot; survives account deletion
recorded_at              NOT NULL
```

**`recording_mode` is how "a decision is evidenced" stops being a promise and becomes a constraint** (sol `[C54R-B6]`, and it subsumes opus5 `[C54R-A6]`). Exactly two modes are permitted in v1, each with its evidence enforced by a `CHECK`:

| `recording_mode` | Requires | Why it is enough |
| --- | --- | --- |
| `'transcribed_document'` | `decision_document_id IS NOT NULL` | the instruction itself is filed and retrievable — better evidence than a drawn signature |
| `'referenced_hold_point_release'` | `hold_point_id IS NOT NULL` | the decision already exists in CIVOS as a released hold point with its own attribution (`HoldPoint:865-870`); the approval points at it rather than re-asserting it |

There is **no third mode**, and specifically no "verbal, recorded by us" — that is a row asserting somebody's decision with nothing behind it. If the pilot produces one, it is a reviewed migration adding a `CHECK` value, not a nullable escape hatch. `[C54S-l]`

A useful side effect: Rev 1 permitted `approval_method = 'hold_point_release'` with `hold_point_id IS NULL` (opus5 `[C54R-A6]`). That is now unrepresentable.

`recordedBy*` and `decidedBy*` are **separate columns on purpose**, and every surface renders both — *"Approved by A. Smith (Superintendent, XYZ Pty Ltd) on 12 Aug 2026 · recorded by J. Ryan on 13 Aug 2026"*. That sentence is `[C5S-B1]` in the UI, and it is the property AT-206 asserts. §0.4.

**Statuses are minimal and pilot-gated.** `CHECK`-constrained to `'approved' | 'rejected' | 'withdrawn'`. Three, because **no published Layer-2 status vocabulary was found** — RG-5 delivers the register vocabulary (Layer 1) and nothing for Layer 2. Deliberately **no `'submitted'` or `'pending'` state**: a row exists because a decision was recorded, and modelling the contractor's submission as a CIVOS state would be inventing the workflow RG-5 did not establish. If the pilot shows submissions need tracking, that is a new state added by reviewed migration — which is why the vocabulary is a `CHECK`. `[C54S-e]`, `[C54S-B4]`.

**Consuming Layer 1.** `productRegistrationId` is a **nullable** FK, `onDelete: Restrict`. Nullable because claim 5.16 is decisive: AS 4000 has no approval regime at all, so a superintendent may approve a material under a contract with no authority register behind it, and forcing the link would make that unrecordable. `Restrict` because an approval that silently lost the registration it consumed is worse evidence than a delete that refuses — the same reasoning `docketDocumentId` used.

**Same-project integrity on every FK, validated inside the write transaction.** Rev 2 scopes both tables to the project, so the rule is uniform and there is no company/project asymmetry to get wrong. Three FKs, three checks, one transaction:

1. **`product_registration_id`** — the registration's `projectId` must equal the approval's. AT-200(c).
2. **`decision_document_id`** — the document's `projectId` must equal the approval's. AT-200(d).
3. **`hold_point_id`** — **new in Rev 2** (sol `[C54R-B7]`). A `HoldPoint` has no `projectId`; it reaches one only through `lot` (`schema.prisma:854-895`). So the check is a join: `holdPoint.lot.projectId` must equal the approval's `projectId`, **and** `holdPoint.lotId` must be among the approval's applicable lots (§4.3.1). Rev 1 left this FK entirely unvalidated, so a caller could attach another project's — or another tenant's — hold point and have it render in this project's folio. AT-212.

None of the three may be validated against the JWT's company or a body-supplied id; all read the row's own `projectId`, resolved from the path. This is `ImportMappingProfile`'s rule (`backend/src/routes/copilot/import/routes.ts:473-481`, re-validated at time of use `:521-536`) applied to every link.

**The hold-point link is still deliberately weak in the direction that matters.** `holdPointId` is nullable, `onDelete: SetNull`, and **no gate reads it**: no readiness item requires it, no release is blocked by its absence, nothing conditions on it. RG-11 (§3.2) is why. Rev 2 adds **integrity** on the link without adding **dependency** on it — a validated annotation is still an annotation. `[C54S-f]` survives unchanged.

**C5.4 releases no hold point and gates no release.** The release route (`backend/src/routes/holdpoints/actionRoutes.ts:209-210`) is untouched; `releaseCompletionGuard.ts:10-18` and `prerequisites.ts:36-41` are untouched. An approval row may *reference* a hold point that was released; it never causes one. `[C54S-B5]`

**Approval identity, and the two things Rev 1 got backwards** (sol `[C54R-B9]`, opus5 `[C54R-A7]`).

Rev 1 created a **non-unique** `(project_id, material_key)` index — so two independent `'approved'` rows for the same material could coexist and both project into the folio with no stated ordering — while *simultaneously* requiring supersession to carry an **identical `product_registration_id`**, so a legitimate approval against a **replacement** registration could not supersede the old one. Too loose where it mattered and too tight where it did not.

- **Identity is the normalised material key within a project:** `lower(btrim(material_key))`. `material_key` is a required free-text identifier transcribed from the instruction — the mix code, the product name.
- **One current approved row per identity, enforced by a partial unique index** (§5.3). `'rejected'` and `'withdrawn'` rows are history and are not constrained; superseded rows are not constrained.
- **Supersession may cross registration revisions.** The `product_registration_id` equality check is **removed**: MRTS30 cl 7.3.3 (claim 5.8) is explicit that a new mix design is a new registration, and the approval that consumes the replacement is precisely the one that should supersede the old. The remaining guard, in the `requireSupersededByInProject` shape (`backend/src/routes/drawings.ts:37-66`), enforces **four** checks: not-self, same project, same normalised `material_key`, target-is-current.
- **Supersession is serialised, not merely guarded.** The chain write is a conditional update inside the transaction — `updateMany({ where: { id: targetId, supersededById: null }, data: … })` — and a zero `count` is a **409**, never a silent second chain. That is the shipped NCR idiom (`updateMany` guarded on the expected state, §2.2). Two concurrent supersessions of the same target therefore produce one success and one 409, not two chains. AT-201, AT-214.

### 4.3.1 The applicability edge — which lots an approval covers (Rev 2)

Rev 1 had **no path from an approval to a lot**, and specified three consumers that need one: the lot-scoped read route, the lot folio projection, and a lot-grained readiness item. Both reviews landed on it (sol `[C54R-B1]`, opus5 `[C54R-B3]`), and it is verified: `ProjectMaterialApproval` carried `project_id` only, and `DiaryDelivery` has **no material column at all** (`schema.prisma:1338-1373` — `description`, `supplier`, `docketNumber`, `quantity`, `unit`, `lotId`, `notes`, `docketDocumentId`, `batchRef`). The only join Rev 1 left available was free-text to free-text.

**The edge is explicit and it is a join table**, because one approval genuinely covers many lots — a mix approved for a whole pavement run — and one lot genuinely has several approved materials:

```prisma
model ProjectMaterialApprovalLot {
  id         String @id @default(uuid())
  approvalId String @map("approval_id")
  lotId      String @map("lot_id")

  approval ProjectMaterialApproval @relation(fields: [approvalId], references: [id], onDelete: Cascade)
  lot      Lot                     @relation(fields: [lotId], references: [id], onDelete: Cascade)

  @@unique([approvalId, lotId])
  @@index([lotId])
  @@map("project_material_approval_lots")
}
```

**`NCRLot`'s shape, field for field** (`schema.prisma:1183-1194`) — a pure join table, no payload, `@@unique`, both FKs `Cascade` — **plus the `@@index([lotId])` that `NCRLot` lacks and that §18.2 item 4 already flags as a known cost.** Every lot-grained read here rides that index, so the C5.4 query does not inherit the shipped table's weakness.

**Three consequences, each replacing something Rev 1 could not implement:**

1. **`GET /api/projects/:projectId/lots/:lotId/material-approvals`** filters through the edge. `assertBelongsToLot` (`backend/src/routes/folio/access.ts:72-80`) destructures `row.lotId`, so it is applied to the **join row**, not to the approval — Rev 1 applied it to a row that had no such field, and it would not have compiled. AT-209.
2. **The folio projects only the approvals joined to that lot**, which is what makes the §9 row budget (*"< 10 rows at p99 per lot"*) a claim about a lot rather than about a project. Without the edge, every lot would have carried the project's entire approval set into `countEvidenceRows` (`backend/src/lib/handover/folioPayload.ts:207-220`), which drives a **refusal** against the ceiling, not a truncation — so an over-count would have **blocked folio issuance**, not degraded it. AT-203, AT-210.
3. **Applicability is asserted by a human, never inferred.** A write supplies the lot ids; nothing fuzzy-matches `DiaryDelivery.supplier` or `description` against `material_key`. §16 item 8 already concedes the sibling `batchRef` ↔ `registrationNumber` join is *"answered by a human reading two screens"*; Rev 1's `material_approval_missing` predicate quietly assumed the machine could do the harder version of it. **That readiness item is cut from v1** (§4.7).

Every lot id is validated in the write transaction against the approval's project — the `requireNcrLotsInProject` shape (`backend/src/routes/ncrs/ncrCore.ts:91-113`). AT-210.

### 4.4 Nonconforming material — a link, not a state (C5.4a)

**The whole build is one nullable FK.** RG-8 says the record is the NCR and the enforcement is a prohibition on incorporation. CIVOS has both. What it lacks is the ability to say *which delivery* an NCR is about.

```prisma
linkedDeliveryId String? @map("linked_delivery_id")
// …
linkedDelivery DiaryDelivery? @relation("NcrLinkedDelivery", fields: [linkedDeliveryId], references: [id], onDelete: SetNull)
// …
@@index([linkedDeliveryId])
```

Copied field-for-field from `NCR.linkedTestResultId` (`backend/prisma/schema.prisma:1084`, relation `:1161`, index `:1177` — re-anchored post-G5) — including the `SetNull`, which means deleting the delivery nulls the link and never cascades an NCR away, and including the index, whose absence would be the easy thing to drop from the diff.

**Create-only, like its sibling.** Added to `createNcrSchema` (`backend/src/routes/ncrs/ncrCoreValidation.ts:107` is where `linkedTestResultId` sits) and **not** to `updateNcrSchema` (`:127-144`). Making it patchable would be new behaviour, not the shipped pattern. `[C54S-B6]`

**The validator mirrors `requireFailedTestResultForNcr`** (`backend/src/routes/ncrs/ncrCore.ts:156-187`; same-project check `:174-176`, lot-consistency check `:182-184`) with the two assertions that matter:

1. **Same project.** The delivery reaches a project only through `daily_diaries` — `DiaryDelivery` has **no `projectId`** (`[C5R-A9]`, still true at `e3084475`) — so the check is a join to `diary.projectId`, not a column read. Without it, another tenant's delivery could be linked to this project's NCR and would then render in that project's folio. AT-190(b).
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
  // Rev 2, sol `[C54R-A4]`: FULL provenance per field, not a bare clause string.
  // A concrete profile is AS 1379's base list PLUS an authority's extensions, and
  // the two have different documents, editions and evidence grades. One
  // profile-level provenance object cannot express that, and C1 already
  // validates provenance per individual rule as well as per pack
  // (`registry.ts:500-509`, `:632`).
  provenance: RulesetProvenance;
}
```

**Base and extension packs compose explicitly** (sol `[C54R-A4]`). A profile declares `extends?: string` naming the base profile id; the resolver concatenates base fields then extension fields, an extension field with a duplicate `key` **replaces** the base field and inherits nothing from it — including its provenance. So `tfnsw-b80.v1 extends as1379-base.v1` keeps NSW's eighteen enumerated items (claim 6.9) provenanced to B80 and the base items provenanced to AS 1379, and **the profile's overall status is the weakest of its parts**: a `confirmed` extension over a `draft` base resolves `draft`. That is the only composition rule, and it is what stops a grade-A authority extension laundering a grade-B base into a confirmed pack.

**Five properties inherited deliberately, each from a shipped decision:**

1. **Code, not database rows** (`sufficiency/types.ts:11-13`) — reviewable in a PR diff, CI-testable, `git revert`-able.
2. **Explicit static imports, not a dynamic manifest** (`rulesets/index.ts:53`) — so fallow sees real edges.
3. **Mandatory provenance with an evidence grade** (`types.ts:19-35`) — *"an unprovenanced rule cannot be registered"*, and the rule that a `confirmed` pack must be grade A is real and verified (`registry.ts:534-538`).

   **Rev 2 corrects how that gate is reached — it is not free** (sol `[C54R-A3]`, opus5 `[C54R-A2]`). Rev 1 said C5.4d *"reuses `validateProvenance`"* and called the gate mechanical. Verified at this HEAD: **`validateProvenance` is module-private** (`registry.ts:512`, no `export`), **`degradeIfLapsed` is module-private** (`:119`), both are `Ruleset`-typed, and `validateRuleset` — the only exported entry point (`:582`) — additionally requires `scaleKeys` and `rules`, which a certificate profile does not have. Worse, **the CI teeth are not the function**: they are the sweep at `registry.test.ts:67`, which iterates `SUFFICIENCY_RULESETS` and asserts `validateRuleset` returns no problems. A new `CERTIFICATE_PROFILES` registry is covered by **nothing** until someone writes the equivalent sweep.

   **So C5.4d's first PR is an extraction, and the spec names it** — this is the C1 work the phase actually depends on:
   - export `validateSourceProvenance(provenance, { status, where }): string[]` from a new `backend/src/lib/authorityPacks/provenance.ts`, carrying the grade-A-on-`confirmed`, ISO `checkedOn` and future-`revalidateBy` rules verbatim;
   - export `effectiveWindowState(pack, at)` and `degradeIfLapsed(pack, at)` over a minimal `{ status, effectiveFrom, effectiveTo?, provenance }` structural type that both `Ruleset` and `CertificateProfile` satisfy;
   - **make `sufficiency/registry.ts` call them**, so the two registries cannot drift — behaviour-preserving, covered by the existing `registry.test.ts` sweep;
   - **ship the `CERTIFICATE_PROFILES` sweep in the same PR as the first profile**, mirroring `registry.test.ts:67`.

   Until that exists, the U1 gate is a rule someone must remember to apply, not one the CI enforces. Recorded so DC5-7 is decided on what is true.
4. **Effective windows and runtime lapse-degradation** (`registry.ts:60-65`, `:100-122`) — an out-of-date pack degrades to `draft` and a `draft` pack structurally cannot enforce.
5. **`label` capped at 80 characters and no free-prose field** (`registry.ts:24`) — the §8.4 legal boundary against reproducing specification text. It binds harder here than for rulesets, because a certificate field list is closer to the source document than a frequency rule is. `[C54S-B8]`

**The instance record.** A `SupplierCertificate` row attached 1:1-optional to a `DiaryDelivery`, carrying `profileId`, `profileVersion`, and `fields Json` — the transcribed values, validated against the profile at write time and **stamped with the profile version they were entered under**, so a later profile revision does not silently reinterpret an old row. No fixed columns anywhere. It reuses `DiaryDelivery.docketDocumentId` as the filed artefact and adds **no** document FK, which is why C5.4d owes no `EVIDENCE_LINK_GUARDS` entry.

**Why the delivery, and not a free-standing certificate table.** Claim 6.9 shows TfNSW drafts the clause as *"Delivery Docket **or** Identification Certificate"* — it treats them as one artefact — and claim 6.5 has QLD requiring *"a manufacturer's certificate in the form of a delivery docket in accordance with AS 1379 … for each batch"*. For the two materials RG-6 covers, the certificate **is** the docket, and CIVOS already has the docket. U7 records that materials outside those two may break this, and that is one more reason C5.4d is not scheduled.

**What is already discharged without C5.4d, and it is the useful half.** Research consequence 3: the mix identifier is *required by specification* to appear on the delivery docket — VIC concrete cl 610.07(b)(xiii) → cl 610.16(e)(v) (5.11, 6.7), VIC asphalt cl 407.20(b)(vii) *"traceable to the mix registration number"* (6.12), NSW carrying nominated W/C and slump from trial mix onto the docket (6.10). And consequence 4: the docket serial number appears on test certificates *expressly to provide an audit trail for analysing nonconforming concrete* (6.3, grade B), corroborated grade A by MRTS70 cl 12.3 *"test reports shall be traceable to concrete delivery dockets and the construction lot"* (6.4).

**`DiaryDelivery.batchRef` is that token, and it already ships.** The parent spec justified it on honesty grounds alone; the research shows it is the **specified** traceability field. C5.4b uses it: the registration's `registrationNumber` and a delivery's `batchRef` are the two ends of the join, and §4.7 surfaces them side by side without needing a structured link. **No schema change is required to get the benefit** — which is the strongest single argument for not scheduling C5.4d.

### 4.6 Tenancy — both tables are project-scoped in v1 `[C54S-a]` *(Rev 2 — this is the wave's largest design change)*

**What Rev 1 did, and why both reviews rejected it.** `ProductRegistration` was stamped `companyId`, mounted under a project, authorised by `requireEffectiveProjectRole`, and evidenced by a `Document`. Three of those four are individually fine. Together they are not:

- **The authority hole** (sol `[C54R-B3]`, verified). `requireEffectiveProjectRole` (`backend/src/lib/projectAccess.ts:180-210`) checks the role held **on the presented project**. A quality manager assigned to Project A alone would have been able to edit and supersede registrations that Projects B–Z consume as compliance evidence. Project-local authority over company-wide records is a privilege escalation, and it is exactly the class of thing §2.3's `assertLotSufficiencyAttributes` header names as *"a privilege bypass that was invisible afterwards"*.
- **The evidence hole** (sol `[C54R-B4]`, verified). Outcome 1 said the registration and its certificate are readable *"from every project that company runs"*. `Document.projectId` is **required** (`backend/prisma/schema.prisma:1782`) and `canReadDocument` gates on that exact project (`backend/src/routes/documents/access.ts:401-405`). A certificate uploaded on Project A is **unreadable** to a Project-B-only user. The feature's headline claim — *"and prove it"* — did not survive contact with the document layer.
- **The disclosure widening** (opus5 `[C54R-A4]`). §7.3 granted register **read** to `foreman` and `viewer` on one project, over rows carrying `supplier_name` and `plant_location` for every project the company runs. No CIVOS surface does that today, and §8's threat table addressed the role axis and the volume axis but never the project axis.

**Rev 2's resolution: `ProductRegistration` carries `projectId`, not `companyId`.** Both tables are project-scoped, every route is `/api/projects/:projectId/…`, every guard is one C5.1 already uses, and there is no cross-boundary FK anywhere in the wave.

```
GET   /api/projects/:projectId/product-registrations        → requireInternalProjectAccess, where: { projectId }
POST  /api/projects/:projectId/product-registrations        → requireEffectiveProjectRole(…, REGISTRATION_EDITORS,
                                                                { requireWritable: true }); projectId from the PATH
```

**Five consequences, and the fourth is the cost.**

- **The authority hole closes by construction.** A project role now governs project data. Nothing is escalated because nothing crosses.
- **The evidence hole closes by construction.** The certificate lives in the same project as the registration that cites it, so every reader who can see the row can open the proof. That is why `sourceDocumentId` can be made **required** (§4.2) — Rev 1 had to leave it nullable partly because it could not guarantee the reader could open it.
- **The disclosure widening disappears.** A register read returns this project's rows. §7.3's read row is implementable as written, for the roles as written, with no new threat.
- **The cost, stated plainly: a contractor using the same mix on five jobs transcribes it five times.** That is real, it is what RG-5 consequence 1 warns about *for a single conflated table*, and it is **six fields plus a document re-upload**. Set against a scope escalation and unreadable evidence, it is the cheaper wrong. It is also the **visible** wrong: `@@unique([projectId, scheme, registrationNumber])` makes the duplication countable, and §16 item 10 makes counting it a pilot measurement.
- **The archived-project check is preserved.** Writes go through `requireEffectiveProjectRole(…, { requireWritable: true })`, which reaches `assertProjectAllowsWrite` (`projectAccess.ts:205-207`); `requireInternalProjectAccess` (`:212-231`) does **not** perform it. Using the read helper on a write route would accept edits on an archived project — the trap `backend/src/routes/deliveries/index.ts:31-33` documents. AT-199(b).

**Why this is the honest direction and not merely the small one.** RG-5 establishes that the *registration* is valid across every project that authority lets. It establishes nothing about where a contractor **files their transcription of it**, and Rev 1's own §16 item 2 conceded the point: company scoping was *"an authority-side fact being used to infer a contractor-side filing habit"*. **RG-10 and U2 are open.** Building the cross-project version first meant shipping the inference as schema, in the phase the spec itself says is not safe without pilot validation. Project scope assumes less.

**The flip, and it composes** — `[C54S-a]`, **DC5-6c**. If the round-trip says registrations are a company asset, the shape is `GlobalSubcontractor` → `SubcontractorCompany` (`schema.prisma:1423`, lineage FK `:1445`, `:1461`): a company-level library table added **additively** above the project rows, with a `SetNull` lineage FK from the project row to the library row, a "copy into this project" action, and **company-level write authority on the library** — owner/admin until a company-wide QM permission exists, which is DC5-6c's real cost and the thing Rev 1 tried to avoid paying. The project row stays the evidence-bearing one, so no `Document` moves and no access rule is invented. **The reverse migration does not compose**: un-sharing rows already referenced by approvals across projects is ambiguous per row.

**Retention.** Both tables are now project-scoped, so **both** join **both halves** of the project retention guard — `RETAINED_PROJECT_RELATIONS` (`backend/src/routes/projects/writeRoutes.ts:44-68`, the declared authority, currently eighteen members) **and** the `_count` select (`:692-716`, currently sixteen). The join table `ProjectMaterialApprovalLot` does **not**: it cascades from its approval and is not independently evidence. `[C5R-A7]`'s lesson, now with the second list visible and three keys to add. AT-204.

**A company delete route still does not exist** (§2.4, grepped) and Rev 2 removes C5.4's exposure to that gap entirely — with no `companyId` anywhere in the wave, §16 item 5's obligation is now purely about the pre-existing `WebhookConfig` / `GlobalSubcontractor` / `ImportMappingProfile` case, and DC5-6c would re-open it.

### 4.7 What the consumers receive

- **Folio — one payload key, two revision-token sources.** `FolioEvidencePayload` gains **one** key, `materialApprovals`, holding the approvals joined to that lot through §4.3.1's edge. The Layer-1 registration is **projected into** the approval row (number, scheme, transcribed status, validity, and the derived currency at issue time), because a folio is a record of *this lot's* evidence and a bare register entry is not lot evidence.

  **`FolioSourceType` gains two members, not one** — `'project_material_approval'` **and** `'product_registration'`, both `'updated_at'` (sol `[C54R-B2]`). Rev 1 declared one source token, taken from the approval's `updatedAt`, for a payload that projects a **second mutable table**. Editing a registration's status, dates or certificate would then change what the folio renders **without changing the token**, and the compiled source set would not invalidate. The revision-token contract exists precisely to stop that: it is a per-source-model contract (`backend/src/lib/handover/revisionTokens.ts:1-25`) whose kinds are an exhaustive `Record<FolioSourceType, RevisionTokenKind>` (`:49-68`), so **adding a member without declaring its kind is a compile error** — the mechanism works, Rev 1 just used it once. An approval that cites a registration contributes **both** tokens to its compiled source set. AT-211.

  **`FOLIO_PAYLOAD_SCHEMA_VERSION` 2 → 3** (`revisionTokens.ts:121`), counted in `countEvidenceRows` (`folioPayload.ts:207-220`), queried at `CEILING + 1` in `assemble.ts`. Ships **flag-gated and empty** when off, exactly as `surveys` does (`folioPayload.ts:188`). The bump's blast radius is bounded and was independently verified: the only consumer of `isFolioPayloadSchemaCurrent` is `backend/src/routes/folio/index.ts:87`, which refuses an in-flight **reservation** whose snapshot predates the bump, with `FOLIO_PAYLOAD_SCHEMA_STALE`. **Issued PDFs are unaffected** (opus5 `[C54R-N7]`).

  **The derived-currency field is a snapshot with a stated basis**, rendered as *"registration 12345 (DTP asphalt register), register status General, valid to 30 Jun 2027 — current at issue"* — never as a bare "valid" chip, and never recomputed against the reader's clock when an issued folio is re-opened. `[C54S-B2]`, AT-203.
- **Hold-point evidence package.** **Nothing is added.** `[C54S-g]`. A superintendent releasing a hold point on workmanship does not need the approval register; and where the release *is* the approval (NSW, 5.15, RG-11), putting it in the package would show the superintendent their own decision back. Same call and same reasoning as `[C5S-e]` made for deliveries. *Flip condition:* a real superintendent asks for it.
- **Readiness — one code in v1, not two.** No new `EvidenceReadinessArea` member is minted; approvals reuse `'conformance'`, the same economy `'diary'` got for deliveries (`backend/src/lib/evidenceReadiness/core.ts:17-18`). One new code in `READINESS_REASON_CODES` **and** `REASON_CODE_PROVENANCE` in the same change (the contract test stated at `reasonCodes.ts:23-28` fails otherwise — two edits per code, §18.2 item 8):
  - **`material_approval_registration_expiring`** — `warning`. Predicate, **driven from the §4.3.1 edge exclusively**: a lot has an applicable, current (non-superseded) approval whose linked `ProductRegistration` returns `registrationCurrency() !== 'current'`, or returns `'current'` with `validTo` within 30 days. `'unknown'` currency **does not** raise it — an absent date is not a finding (§4.2).
  - **`material_approval_missing` is cut from v1** `[C54S-m]`. Rev 1's predicate was *"a lot with deliveries whose supplier/material has no approval row on the project"*, which requires fuzzy-matching a delivery's free-text `supplier`/`description` against a free-text `material_key` and putting the guess on the QM's main screen as a `support` item (opus5 `[C54R-B3]`, sol `[C54R-B1]`). With the applicability edge the machine now knows which lots an approval covers; it still does not know which lots **should** have one. *Flip condition:* the pilot answers §16 item 8's question — how often `batchRef` and `registrationNumber` actually correspond — with a number good enough to build a predicate on, or the pilot contractor asks for the item by name.

  **The one shipped code does not join `HANDOVER_BLOCKING_REASON_CODES`** (`reasonCodes.ts:127`). `[C5S-B5]` binds unchanged. AT-202.

### 4.8 Document evidence — the metadata lock rule (Rev 2)

Every `EVIDENCE_LINK_GUARDS` entry must return `metadataLocked`; it is a required field of `EvidenceLink` (`backend/src/routes/documents/evidenceLinkGuards.ts:14`), consumed by `assertEvidenceMetadataMutable` (`:163-176`), which throws `409 WORKFLOW_EVIDENCE_LOCKED`. Rev 1 added two guards and specified only the **delete** and **version** behaviour, leaving the lock rule undeclared and untested (sol `[C54R-A5]`).

**The rule: both C5.4 document links lock from the moment the link exists.**

The shipped guards lock at a workflow state — an NCR at or past verification, a claimed variation — because those records have a pre-decision life during which their evidence is still being assembled. **C5.4's two tables have no such state.** A `ProductRegistration` row exists because a certificate was transcribed; a `ProjectMaterialApproval` row exists because a decision was transcribed. In both cases the document *is* the justification for the row, and renaming, re-categorising or re-captioning it after the fact changes what a folio reader is shown about somebody else's decision. There is no window in which mutation is harmless, so there is no state to condition on.

`metadataLocked: true` whenever `findLink` returns a link, for both entries. Test `PATCH /api/documents/:id` **before** the link (mutable, 200) and **after** it (409, correct `evidenceType`). AT-207.

---

## 5. Data model and migrations

Four migrations, all additive, in the hand-authored wave-tagged slot convention.

**Re-measured at `e3084475`.** Taken: `20260801000000` … `20260809000000`, **and `20260810000000_g5_ncr_learning_loop`, which G5 claimed while this spec sat in review** — precisely the hazard opus5 `[C54R-N6]` named about leaving an unclaimed gap between two reservations. **`20260811000000` and up are confirmed free** (`ls backend/prisma/migrations`, re-run at this HEAD), and Rev 2 takes them **contiguously**. Exit-gate item 20 records the reservation in `docs/agent-handoff.md`, where the other waves read, rather than leaving it discoverable only inside this document.

### 5.1 `20260811000000_c54a_ncr_material_link` (C5.4a)

```sql
ALTER TABLE "ncrs" ADD COLUMN "linked_delivery_id" TEXT;

ALTER TABLE "ncrs"
  ADD CONSTRAINT "ncrs_linked_delivery_id_fkey"
  FOREIGN KEY ("linked_delivery_id") REFERENCES "diary_deliveries"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ncrs_linked_delivery_id_idx" ON "ncrs"("linked_delivery_id");
```

`SET NULL` and the index both mirror `linked_test_result_id` exactly (`backend/prisma/schema.prisma:1161`, `:1177`). Reverse migration is a column drop. **This migration lands immediately after G5's `20260810000000`** and touches the same table it did, additively — §10's coexistence requirement.

### 5.2 `20260812000000_c54b_product_registration` (C5.4b)

```sql
CREATE TABLE "product_registrations" (
    "id"                    TEXT NOT NULL,
    -- Rev 2 `[C54R-B3]`/`[C54R-B4]`: project, not company. A project-held role
    -- must not govern company-held compliance evidence, and `documents.project_id`
    -- is NOT NULL so a company-wide claim cannot be backed by its certificate.
    -- The company library is DC5-6c, added additively above these rows. §4.6.
    "project_id"            TEXT NOT NULL,
    "authority"             TEXT NOT NULL,
    "scheme"                TEXT NOT NULL,
    "registration_number"   TEXT NOT NULL,
    "product_name"          TEXT NOT NULL,
    "material"              TEXT,
    "supplier_name"         TEXT,
    "plant_location"        TEXT,
    -- NULLABLE, NO DEFAULT. NULL = nobody recorded a status. 'not_published' =
    -- the recorded fact that this scheme publishes none. They are different
    -- facts and Rev 1's `DEFAULT 'not_stated'` asserted the second from an empty
    -- form field. Matches survey_records.surveyor_verdict, which is String? with
    -- no default (schema.prisma:2808). `[C54R-B10]`.
    "status"                TEXT,
    "valid_from"            DATE,
    "valid_to"              DATE,
    -- Rev 2: NOT NULL. A registration row is a transcription; a transcription
    -- with no source artefact is a claim. `[C54R-B4]`.
    "source_document_id"    TEXT NOT NULL,
    "source_note"           TEXT,
    "superseded_by_id"      TEXT,
    -- Rev 2 `[C54R-B8]` / opus5 `[C54R-B1]`: NULLABLE scalar + SET NULL is the
    -- only valid pair — `tx.user.delete` is live (accountDeletionRoutes.ts:175)
    -- and Postgres cannot SET NULL on a NOT NULL column. Presence is enforced at
    -- CREATE by the Zod body and the route, which is where it belongs. Every
    -- sibling attribution FK in the schema is nullable + SetNull.
    "recorded_by"           TEXT,
    -- The transcriber's name AT THE TIME OF RECORDING. Immutable after insert
    -- (no route patches it), so attribution survives account deletion.
    "recorded_by_label"     TEXT NOT NULL,
    "recorded_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes"                 TEXT,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_registrations_pkey" PRIMARY KEY ("id")
);

-- The four published values are VicRoads/DTP Section 407 v18.0 (Oct 2025) cl 407.09
-- (research claim 5.13). 'not_published' is the honesty value for schemes that
-- publish no status word (ATIC 5.5, QRS 5.6, VIC concrete 5.10) — never mapped
-- onto 'general'. NULL is permitted and means "not recorded".
ALTER TABLE "product_registrations" ADD CONSTRAINT "product_registrations_status_check"
  CHECK ("status" IS NULL
      OR "status" IN ('general','conditional','expired','withdrawn','not_published'));

-- Registration numbers are per-scheme. ATIC, QRS and the mix registers are three
-- namespaces and "they are not interchangeable" (claim 5.6).
ALTER TABLE "product_registrations"
  ADD CONSTRAINT "product_registrations_project_scheme_number_key"
  UNIQUE ("project_id","scheme","registration_number");

ALTER TABLE "product_registrations" ADD CONSTRAINT "product_registrations_validity_check"
  CHECK ("valid_from" IS NULL OR "valid_to" IS NULL OR "valid_to" >= "valid_from");
ALTER TABLE "product_registrations" ADD CONSTRAINT "product_registrations_self_supersede_check"
  CHECK ("superseded_by_id" IS NULL OR "superseded_by_id" <> "id");

ALTER TABLE "product_registrations" ADD CONSTRAINT "product_registrations_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;
-- Restrict: the filed certificate cannot be deleted out from under the registration.
-- Matches drawings.document_id and survey_records.report_document_id. The usable
-- error message comes from the §2.5 guard entry, not from this FK.
ALTER TABLE "product_registrations" ADD CONSTRAINT "product_registrations_source_document_id_fkey"
  FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT;
ALTER TABLE "product_registrations" ADD CONSTRAINT "product_registrations_superseded_by_id_fkey"
  FOREIGN KEY ("superseded_by_id") REFERENCES "product_registrations"("id") ON DELETE SET NULL;
ALTER TABLE "product_registrations" ADD CONSTRAINT "product_registrations_recorded_by_fkey"
  FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX "product_registrations_project_id_status_idx"
  ON "product_registrations"("project_id","status");
CREATE INDEX "product_registrations_project_id_valid_to_idx"
  ON "product_registrations"("project_id","valid_to");
```

**There is no `expires_at` trigger, no scheduled job and no computed currency column, and that is `[C54S-B2]`.** `valid_to` is data; currency is a read-time derivation (§4.2) in the `degradeIfLapsed` idiom (`backend/src/lib/readiness/sufficiency/registry.ts:119-122`).

`project_id` is `ON DELETE CASCADE`, matching every other project-scoped evidence table — and the **retention guard is what actually protects the rows** (§4.6, AT-204), because it refuses the permanent delete before the cascade can fire.

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
    -- Rev 2 `[C54R-B6]`: attribution is DECISION-generic, not approval-only. A
    -- rejection and a withdrawal are somebody's decisions too, and an
    -- unattributed one is the false record `[C5S-B1]` exists to prevent. NOT NULL
    -- columns, so no per-status CHECK is needed to require them.
    "decided_by_name"           TEXT NOT NULL,
    "decided_by_organisation"   TEXT,
    "decided_at"                TIMESTAMP(3) NOT NULL,
    "decision_method"           TEXT NOT NULL,
    "decision_reference"        TEXT,
    "decision_reason"           TEXT,
    "decision_document_id"      TEXT,
    -- How this decision is evidenced. Exactly two modes in v1; each has its
    -- evidence enforced below. There is deliberately no "verbal" mode. §4.3.
    "recording_mode"            TEXT NOT NULL,
    "conditions"                TEXT,
    "superseded_by_id"          TEXT,
    -- Nullable + SET NULL, required at create, immutable label. Same reasoning
    -- and same citations as product_registrations. `[C54R-B8]`.
    "recorded_by"               TEXT,
    "recorded_by_label"         TEXT NOT NULL,
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

ALTER TABLE "project_material_approvals" ADD CONSTRAINT "project_material_approvals_decision_method_check"
  CHECK ("decision_method" IN ('letter','email','site_instruction','hold_point_release','other'));

-- Anything other than an approval owes a reason. An unexplained rejection or
-- withdrawal attributed to a named professional is the same defamation-shaped
-- risk §8 identifies, with less on the record.
ALTER TABLE "project_material_approvals"
  ADD CONSTRAINT "project_material_approvals_reason_required_check"
  CHECK ("status" = 'approved' OR "decision_reason" IS NOT NULL);

-- `[C54S-B1]` as a constraint, not as prose — and the constraint now covers
-- every decision status, not just 'approved'. This is the C5 lesson `[C5R-B1]`
-- taught at cost: the flagship invariant must be the one the DB enforces.
-- It also makes opus5 `[C54R-A6]` unrepresentable: a decision recorded as a
-- hold-point release must name the hold point.
ALTER TABLE "project_material_approvals"
  ADD CONSTRAINT "project_material_approvals_recording_mode_check"
  CHECK (
    ("recording_mode" = 'transcribed_document'          AND "decision_document_id" IS NOT NULL)
    OR
    ("recording_mode" = 'referenced_hold_point_release' AND "hold_point_id" IS NOT NULL)
  );

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
ALTER TABLE "project_material_approvals" ADD CONSTRAINT "project_material_approvals_decision_document_id_fkey"
  FOREIGN KEY ("decision_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT;
ALTER TABLE "project_material_approvals" ADD CONSTRAINT "project_material_approvals_superseded_by_id_fkey"
  FOREIGN KEY ("superseded_by_id") REFERENCES "project_material_approvals"("id") ON DELETE SET NULL;
ALTER TABLE "project_material_approvals" ADD CONSTRAINT "project_material_approvals_recorded_by_fkey"
  FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX "project_material_approvals_project_id_status_idx"
  ON "project_material_approvals"("project_id","status");
CREATE INDEX "project_material_approvals_product_registration_id_idx"
  ON "project_material_approvals"("product_registration_id");
CREATE INDEX "project_material_approvals_hold_point_id_idx"
  ON "project_material_approvals"("hold_point_id");

-- Rev 2 `[C54R-B9]` / opus5 `[C54R-A7]`: ONE current approved row per material
-- identity within a project. Rev 1 had a non-unique index here, so two
-- independent 'approved' rows for the same mix could coexist and both project
-- into the folio with no stated ordering. Normalised, because 'N32-20' and
-- 'n32-20 ' are one mix code and a case-sensitive index is a rule nobody can
-- see. Rejected/withdrawn rows are history and superseded rows are chain links;
-- neither is constrained.
CREATE UNIQUE INDEX "project_material_approvals_current_material_key"
  ON "project_material_approvals" ("project_id", lower(btrim("material_key")))
  WHERE "superseded_by_id" IS NULL AND "status" = 'approved';

-- The applicability edge (§4.3.1). NCRLot's shape, plus the lot index NCRLot
-- lacks (§18.2 item 4).
CREATE TABLE "project_material_approval_lots" (
    "id"          TEXT NOT NULL,
    "approval_id" TEXT NOT NULL,
    "lot_id"      TEXT NOT NULL,
    CONSTRAINT "project_material_approval_lots_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "project_material_approval_lots"
  ADD CONSTRAINT "project_material_approval_lots_approval_id_fkey"
  FOREIGN KEY ("approval_id") REFERENCES "project_material_approvals"("id") ON DELETE CASCADE;
ALTER TABLE "project_material_approval_lots"
  ADD CONSTRAINT "project_material_approval_lots_lot_id_fkey"
  FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE;

ALTER TABLE "project_material_approval_lots"
  ADD CONSTRAINT "project_material_approval_lots_approval_id_lot_id_key"
  UNIQUE ("approval_id","lot_id");
CREATE INDEX "project_material_approval_lots_lot_id_idx"
  ON "project_material_approval_lots"("lot_id");
```

**`recorded_by` is nullable on both tables, and Rev 1's asymmetry is gone** (sol `[C54R-B8]`, opus5 `[C54R-B1]`). Rev 1 shipped `recorded_by TEXT NOT NULL` alongside `ON DELETE SET NULL` and claimed *"the column is NOT NULL at insert and may become null if the user is deleted"*. **That transition is impossible** — Postgres raises `23502` and the FK behaves as a badly-worded `RESTRICT`, surfacing as a 500. It matters because `tx.user.delete` is live at `backend/src/routes/auth/accountDeletionRoutes.ts:175`, inside a transaction that already hand-anonymises three other tables for exactly this reason, plus member removal at `company/memberRoutes.ts:94`, `:744`. One recorded approval would have permanently bricked that user's account deletion. Rev 1's cited precedent says the opposite too: `TestResult.verifiedById` is `String?`. **Presence at create is enforced by the Zod body and the route**, which is where a create-time invariant belongs, and `recorded_by_label` keeps the attribution readable after the user is gone. AT-213.

**What the DB enforces and what the route enforces** — the `[C5R-N5]` split, restated for Rev 2:

**DB-enforced:** both status vocabularies (one nullable, one not), `decision_method`, the reason-required rule, **the recording-mode/evidence pairing**, no self-supersession, the validity ordering, the per-scheme uniqueness, **the one-current-approved partial unique index**, every FK, and `recorded_by_label NOT NULL`.

**Route-only, because a `CHECK` cannot join:** the three same-project link checks (registration, decision document, **hold point via its lot** — §4.3, `[C54R-B7]`), the lot-membership check on every applicability edge, the four supersession identity checks plus the conditional-update serialisation, `recorded_by` presence at create, the derived currency, and the `.strict()` bodies.

Route-only invariants are asserted by AT-198, AT-200, AT-201, AT-210, AT-212, AT-214; **the DB ones are asserted by raw SQL that bypasses the route** (AT-193, AT-197), because a route-level test of a `CHECK` proves nothing about the `CHECK`.

### 5.4 `20260814000000_c54d_supplier_certificate` (C5.4d) — **NOT SCHEDULED**

Specified in §4.5, gated on **U1**, and DC5-7 recommends against scheduling it. The shape is one table — `supplier_certificates` with `delivery_id` (unique), `profile_id`, `profile_version`, `fields JSONB`, `recorded_by`, timestamps — and **no `Document` FK**, because it reuses `DiaryDelivery.docketDocumentId`. It is written down so the next agent finds a design rather than a blank space, and so that "we could just add columns" is visibly refuted before it is proposed.

**All four migrations are additive and reversible by column/table drop.** None rewrites or deletes an existing row. Production apply is the `Production Migrations` GitHub Actions workflow, manually dispatched from `master` with the exact confirmation phrase — never `db push`, never `--accept-data-loss` (`CLAUDE.md` operational warnings).

---

## 6. Invariants C5.4 must not break

| Tag | Invariant |
| --- | --- |
| **`[C54S-B1]`** | CIVOS records a decision; it never makes one. **Every** decision row — approved, rejected or withdrawn — carries `decided_by_name` and `decided_at` (`NOT NULL`) and a `recording_mode` whose evidence the DB requires. Every surface renders the external decider **and** the CIVOS transcriber, distinctly. |
| **`[C54S-B2]`** | **CIVOS never writes a registration status it derived.** No job, cron, trigger or request-time coercion writes `'expired'` or any other status. Currency is computed at read time as `current \| lapsed \| unknown`, displayed with its basis, never persisted, and **never rendered using the register's words**. Withdrawal is an authority act (claim 5.14). |
| **`[C54S-B9]`** *(Rev 2)* | **Applicability is asserted, never inferred.** Which lots an approval covers is a row in `project_material_approval_lots` written by a human. No C5.4 code fuzzy-matches free text — not `supplier` to `material_key`, not `batchRef` to `registrationNumber` — to decide what evidence applies to a lot. §4.3.1. |
| **`[C54S-B10]`** *(Rev 2)* | **No C5.4 authority is broader than the data it governs.** Every route is mounted `/api/projects/:projectId/…`; every guard resolves the project from the path; every FK is validated same-project inside the write transaction; no check reads the JWT's `companyId`. §4.6, §7.1. |
| **`[C54S-B3]`** | No quarantine state, no material status machine, no segregation flag, no "delivery is non-conforming" boolean, and no record of material rejected at delivery. RG-8. |
| **`[C54S-B4]`** | C5.4b and C5.4c stay behind the feature flag until one real material approval has round-tripped with a real contractor and the status vocabularies are confirmed or corrected. |
| **`[C54S-B5]`** | C5.4 releases no hold point, gates no release, and adds no member to `HANDOVER_BLOCKING_REASON_CODES`. Its readiness items are `warning` and `support` only. It blocks no conformance, no claim, no folio. Inherits `[C5S-B5]`. |
| **`[C54S-B6]`** | `NCR.linkedDeliveryId` is **create-only**, like `linkedTestResultId`. It is not added to `updateNcrSchema`, and no route patches it. |
| **`[C54S-B7]`** *(Rev 2, corrected)* | Every `Document` FK C5.4 adds carries its `EVIDENCE_LINK_GUARDS` entry — **with its `metadataLocked` rule declared and tested** (§4.8) — **and** its `GENERIC_VERSIONING_BLOCKS` entry, **appended not inserted** (first-match precedence, `versionRoutes.ts:69`), **plus the Prisma-mock entries both guard test suites need by table name**, all in the same PR as the FK. Every **project-scoped** table C5.4 adds joins **both halves** of the retention guard. Extends `[C5S-B9]` from two registries to three. *Rev 1's "two shipped tests assert position" justification is struck as false — they are comments (§2.5).* |
| **`[C54S-B11]`** *(Rev 2)* | **C5.4a coexists with G5, proven.** The branch is cut at or after `e3084475`, the `NCR` model carries both `itpChecklistItemId` and `linkedDeliveryId`, and one test asserts both links persist, index and `SET NULL` independently. §10, AT-208(a). |
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

**Rev 2: every route is project-mounted, without exception** `[C54S-B10]`. Rev 1 specified five item routes — `GET/PATCH /api/product-registrations/:id`, both supersede routes, `PATCH /api/material-approvals/:id` — that carried **no project in the path**, while naming guards (`requireInternalProjectAccess`, `requireEffectiveProjectRole`) that take `projectId` as a **required argument**. It said the project would be *"the project the caller presents"* and never defined how: no path segment, no query parameter, no body field, no header (sol `[C54R-A2]`, opus5 `[C54R-B2]`). Three of the five had **no implementable guard at all**, because a company-scoped row carried no project to derive one from and there is no `requireCompanyMember`. With registrations project-scoped (§4.6), the path is the answer for all nine.

| Route | Phase | Guard |
| --- | --- | --- |
| *(no new route)* — `linkedDeliveryId` joins the existing `POST /api/ncrs` body | C5.4a | unchanged: `requireActiveProjectUser(…, NCR_CREATE_ROLES)` |
| `GET /api/projects/:projectId/product-registrations` (paginated; filters: scheme, status, material, expiring-within) | C5.4b | `requireInternalProjectAccess`, then `where: { projectId }` — §4.6 |
| `GET /api/projects/:projectId/product-registrations/:registrationId` | C5.4b | as above; the row is re-checked to belong to the **path** project, 404 otherwise |
| `POST /api/projects/:projectId/product-registrations` | C5.4b | `requireEffectiveProjectRole(…, REGISTRATION_EDITORS, { requireWritable: true })`; `projectId` from the **path**, never from the body or the JWT; `sourceDocumentId` required and validated same-project |
| `PATCH /api/projects/:projectId/product-registrations/:registrationId` | C5.4b | as above; a re-issued certificate for the same number updates and audits `{from,to}`; changing `scheme` or `registrationNumber` is **refused** — that is a new row (§4.2) |
| `POST /api/projects/:projectId/product-registrations/:registrationId/supersede` | C5.4b | `REGISTRATION_EDITORS`; guard in the `requireSupersededByInProject` shape (`backend/src/routes/drawings.ts:37-66`) scoped by **project** plus same scheme; conditional update, 409 on a lost race |
| `GET /api/projects/:projectId/material-approvals` | C5.4c | `requireInternalProjectAccess` |
| `GET /api/projects/:projectId/lots/:lotId/material-approvals` | C5.4c | as above, plus `assertBelongsToLot` (`backend/src/routes/folio/access.ts:72-80`) applied to the **join row** — §4.3.1; the `[C5R-A5]` null-narrowing rule at the call site |
| `POST /api/projects/:projectId/material-approvals` | C5.4c | `requireEffectiveProjectRole(…, MATERIAL_APPROVAL_RECORDERS, { requireWritable: true })`; body carries `lotIds`, each validated same-project in the write transaction |
| `PATCH /api/projects/:projectId/material-approvals/:approvalId` · `POST /api/projects/:projectId/material-approvals/:approvalId/supersede` | C5.4c | as above; four-check identity guard plus conditional-update serialisation on supersede (§4.3) |

**Nine routes, one prefix.** They mount under `/api/projects` only — Rev 1's *"C5.4's routes mount under both `/api/projects` and `/api/lots`"* is no longer true, because the lot-scoped read is nested under its project. The per-route flag middleware (§11) therefore applies once, to one router, and AT-205 covers one prefix rather than three unstated ones.

Every write body is a Zod **`.strict()`** object — the `[C5R-B2]` trust boundary, shipped at `backend/src/routes/deliveries/index.ts:112-118`. An unknown key is a 400, not a silent write. AT-198.

**No new upload route** — `sourceDocumentId` and `decisionDocumentId` take already-uploaded `documentId`s, resolved within the **path project**, exactly as `POST /api/surveys/:id/report` does. `[C5S-B8]`, `[C5R-A6]`.

**No public route, no token surface, no webhook, no email.** The superintendent does not receive a CIVOS approval request; RG-5 says the Contractor submits and CIVOS is the contractor's system. External-party surfaces are Wave E's and have a merged threat model; C5.4 does not open a second one.

**Flag enforcement is per-route middleware**, in the `requireSurveyFlag` shape (`backend/src/routes/surveys/index.ts:170-176`), **never `router.use`** — the comment at `:164-168` records that a router-level gate on a path prefix shared with `/api/lots` or `/api/projects` would 404 unrelated routes when the flag is off. C5.4b and C5.4c mount under both prefixes, so this applies twice. AT-205.

### 7.2 Frontend

- **Lot detail** — the existing "Survey & materials" section (C5.2) gains approvals for that lot's materials. No new page, no new nav entry.
- **Project registrations register** — the `VariationsPage.tsx` idiom (`frontend/src/pages/variations/VariationsPage.tsx`, routed `App.tsx:499-503`): per-page `hooks/` + `components/`, `useRegisterDeepLink`, `useIsMobile`, `usePullToRefresh`, `ContextFAB`, `ContextHelp`, and **`@/lib/statusLabels`'s `formatStatusLabel` for every user-visible status** — mandatory, and the five-value registration vocabulary is exactly the kind of thing that grows a second hand-written label map otherwise.
- **Expiry is shown, never asserted, and the two vocabularies never mix** (Rev 2, sol `[C54R-B10]`). Currency is `current | lapsed | unknown` (§4.2). Inside 30 days of `validTo`: *"expires 30 Jun 2027"* plus the readiness warning. Past `validTo`: *"validity lapsed — confirm with the authority"*. No `validTo` at all: *"validity not recorded"* — **not** "current". **CIVOS's derived state never renders as "Expired"**, because that is the register's word for a status the register assigns. A **transcribed** `status = 'expired'` renders separately and is labelled as the register's: *"Register status: Expired (as transcribed)"*. Both can be true at once and the UI shows both. `[C54S-B2]`, AT-206.
- **`status IS NULL` renders as *"register status not recorded"***, never as a blank chip and never as "not published" — they are different facts (§4.2).
- **Approval capture is one modal on one surface** — the `[C3R-B3]` lesson (a control on a second, wrong surface stamps the wrong provenance).
- **No foreman shell change.** A shell touch needs Jay's explicit go (program §5 item 4) and C5.4 does not spend it. Approvals are an office act.
- **Honest note on what C5.1 left:** there is **no delivery register page** at `e3084475` (§2.6). C5.4a's "link this delivery to an NCR" affordance therefore lives on the **NCR create form** (an optional delivery picker, alongside the existing failed-test picker at `frontend/src/pages/tests/TestResultsPage.tsx:605`) and on lot detail — not on a delivery register that does not exist.

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

1. **The read rows are implementable exactly as written, and Rev 2 makes them safe as written.** `requireInternalProjectAccess` (`backend/src/lib/projectAccess.ts:212-231`) admits any internal project role and hard-rejects portal roles at `:217` and again at `:226`. `viewer` is an internal role and reads; `subcontractor` and `subcontractor_admin` cannot reach the route at all. **Rev 1's version of this row was a cross-project disclosure widening** — a foreman on one project reading supplier names and plant locations for every project the company ran (opus5 `[C54R-A4]`). With registrations project-scoped (§4.6), a read returns this project's rows, which is what every other CIVOS surface does, so no narrowing const is needed. If DC5-6c ever adds the company library, **its** read scope is a separate decision and the narrow answer (`REGISTRATION_EDITORS`) is the starting point.

   **A caveat the matrix cannot express** (sol `[C54R-A1]`, opus5 `[C54R-N1]`): the role columns are an **enumeration of intent, not a closed set**. `requireInternalProjectAccess` admits *any* effective role string that is not a portal role, and `getEffectiveProjectRole` returns `ProjectUser.role` raw (`:169`) — so a legacy `superintendent` row would read. The **write** consts are closed and are the real boundary. AT-215.
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
| **Authority broader than the data it governs** — the Rev 1 finding. A project role held on Project A mutating records Projects B–Z consume. | **Removed by design, not mitigated.** Both tables are project-scoped and every route is project-mounted, so project authority governs project data (`[C54S-B10]`, §4.6). There is no company-scoped write path in the wave to escalate through. AT-199, AT-200. |
| **Cross-project link attachment.** Four FKs cross a boundary if unvalidated: registration, decision document, **hold point**, and every applicability-edge lot. | All four validated **inside the write transaction** against the **path** project — never the JWT's `companyId`, never a body-supplied id. The hold point has no `projectId` and is validated through `holdPoint.lot.projectId` **and** membership of the approval's lots — Rev 1 left this FK entirely unchecked (sol `[C54R-B7]`). AT-200(c)(d), AT-210, AT-212. |
| **Tenant isolation on new read surfaces.** Three new read routes. | Every read delegates to `requireInternalProjectAccess` — **no fifth copy of `requireProjectReadAccess`**, the argument-order transposition hazard reasoned at `backend/src/routes/folio/access.ts:25-40`. Rows loaded by their own id are re-checked against the **path** project and 404 otherwise; lot-scoped rows go through `assertBelongsToLot` (`folio/access.ts:72-80`) applied to the join row, with the `[C5R-A5]` null-narrowing rule at the call site. AT-200. |
| **A tenant seeing a feature it was not enabled for.** The flag is now a per-project allowlist, so "off" and "on" coexist in one process. | `parseProjectIdAllowlist` is **fail-closed** by construction (`helpers.ts:41-54`): absent, empty and whitespace-only values return `[]` = nobody. The **same** resolved decision gates routes, UI bootstrap, readiness and folio collection, so a project cannot be off at the route and on in the folio. AT-205. |
| **A write route on an archived project.** | `requireEffectiveProjectRole(..., { requireWritable: true })` on every write. `requireInternalProjectAccess` does **not** perform the archived check — the trap documented at `backend/src/routes/deliveries/index.ts:31-33`. AT-199(b). |
| **The register is a bulk-read surface** carrying supplier names and plant locations. | **Project-scoped in Rev 2**, so the blast radius is the project the reader already has, not the company (opus5 `[C54R-A4]`). Internal roles only; subcontractors 403 (DC5-9). Paginated with a hard `take` cap — the `[C3R-B1]` lesson (an unbounded query with only transitive scoping was C3's single security finding). AT-196. |
| **Account deletion blocked by evidence.** A `NOT NULL` attribution FK would make one recorded approval permanently prevent a GDPR self-serve deletion, as a 500. | `recorded_by` is nullable + `SET NULL` on both tables; `recorded_by_label` preserves the attribution. `tx.user.delete` (`backend/src/routes/auth/accountDeletionRoutes.ts:175`) and member removal (`company/memberRoutes.ts:94`, `:744`) both succeed with C5.4 rows present. AT-213. |
| **False attribution — the sharpest risk in the wave.** A row names an identifiable professional and asserts they decided something about a material. A wrong entry is a contractual and defamation-shaped risk, not a data-quality one. **Rev 2 widens the exposure to rejections and withdrawals**, which Rev 1 left unattributed. | `decidedByName`/`decidedByOrganisation` are **separate from** `recordedBy`/`recordedByLabel`; all are rendered on every surface and in the folio, **for every decision status**; `recording_mode` makes the evidence a DB constraint rather than a convention; and every write is audited with `{from,to}` through `writeAuditLogInTransaction` (`backend/src/lib/auditLog.ts:127-129`) — **hard-fail, not `createAuditLog` (`:105`), which swallows failures (`:106-112`)**. A row whose entire justification is that it records somebody else's decision cannot have a best-effort audit trail. Exit-gate item, AT-197, AT-199(c), AT-206. |
| **Personal data.** `decidedByName`, `decidedByOrganisation`, `recordedByLabel`, `supplierName`, `plantLocation` are third-party or user identifiers. | Covered by existing project data-retention and export paths; no new subprocessor, no new egress. Not rendered on any public or token surface — C5.4 has none. **Rev 2 makes `product_registrations` project-shaped**, so it matches the export path's shape instead of sitting outside it — but inclusion is still **checked at build time, not asserted** (§16 item 4). The **deletion** path is covered by AT-213. |
| **Retention on hard delete.** | **Both** new evidence tables join **both halves** of the project guard — `RETAINED_PROJECT_RELATIONS` (`backend/src/routes/projects/writeRoutes.ts:44-68`, the declared authority) and the `_count` select (`:692-716`). `project_material_approval_lots` joins neither: it cascades from its approval and is not independently evidence. AT-204. |
| **Document link integrity.** Two new `Document` FKs, both `Restrict`. | Each gets its `EVIDENCE_LINK_GUARDS` entry (`evidenceLinkGuards.ts:25-112`) **and** its `GENERIC_VERSIONING_BLOCKS` entry (`versionRoutes.ts:70-109`), **appended**. Without the second, generic versioning creates a new `Document` row and flips the old to `isLatestVersion: false` while the C5.4 FK still points at the old one — stale evidence inside a signed folio. `[C54S-B7]`, AT-207. |
| **Imported files are data, never instructions.** | C5.4 runs **no AI over any file**. If C5.4d ever does, the output-side whitelist normaliser is mandatory and the result rides `AiProposal`. Inherited `[C5S-d]`. |
| **Malware.** No scanner exists anywhere in the tree. | Unchanged and not widened: C5.4 adds no accepted type and no upload route. Program §7's requirement stays **open program-wide** and C5.4 is not the wave that closes it. §16 item 6. |

---

## 9. Scale and performance

Measured against the program §8 reference dataset (5,000 lots, 10,000 map features, 50 GB evidence, 10k-row registers), server-side p95.

| Target | Value | Dataset | Why this number |
| --- | --- | --- | --- |
| Registration register p95 | **< 800 ms** at 2,000 rows | a project with 2,000 registrations | Well inside program §8 line 141's 2,000 ms, and it should be: unlike the delivery register (`[C5R-A9]`, which joins through `daily_diaries` because `diary_deliveries` has no `project_id`), `product_registrations` carries `project_id` **directly** and the query is a single indexed scan on `product_registrations_project_id_status_idx`. 2,000 is a generous ceiling — a job holds tens of registrations, not thousands, and Rev 2's project scoping makes the per-query set **smaller** than Rev 1's company-wide one. |
| Expiring-soon filter p95 | **< 400 ms** | same | Served by `product_registrations_project_id_valid_to_idx`. The predicate is a date-range scan, deliberately **not** a computed-status filter — there is no computed status to filter on `[C54S-B2]`. |
| Lot-scoped approval read p95 | **< 400 ms** | reference project, a lot with 5 approvals | It renders inside the lot page, which already has a budget. Served by `project_material_approval_lots_lot_id_idx` (§4.3.1) — the index `NCRLot` lacks, added deliberately so the lot page's approval query does not inherit that table's known weakness (§18.2 item 4). |
| **Folio evidence-row ceiling headroom** | **C5.4's collection adds < 10 rows at p99 per lot**, and **`FOLIO_EVIDENCE_ROW_CEILING_DEFAULT` is not raised** | reference dataset, worst lot | `countEvidenceRows` (`backend/src/lib/handover/folioPayload.ts:207-220`) drives a **refusal**, not a truncation. A lot has single-digit approved materials. **Measured on the worst lot and recorded in the PR body**; if exceeded the answer is to scope the projection, **never** to raise the ceiling. AT-203. |
| Folio assemble p95 delta | **< 8%** over the pre-C5.4 baseline | reference dataset | One more query at `CEILING + 1`, with the registration projected via an include rather than a second round trip. |

No new background job, no new worker, no new async path — and specifically **no expiry sweep**, which `[C54S-B2]` forbids on correctness grounds before performance ever enters it.

---

## 10. Phases and PR slicing

### C5.4a — NCR ↔ delivery link (S) — *ships first, unflagged*

- **Depends on:** nothing. C5.1's `DiaryDelivery` columns are merged (#1720). **Both adversarial reviews passed this phase**; Rev 2 changes its design in no way.
- **Why first:** it is one nullable FK, one index, one create-time validator and one optional form field; it duplicates a shipped pattern exactly; it has **zero research exposure** (RG-8 is a discharged negative); and it discharges a whole program clause on its own.
- **Contains:** migration §5.1; the schema field, relation and index; `linkedDeliveryId` in `createNcrSchema` (**not** `updateNcrSchema`); the `requireDeliveryForNcr` validator in the `requireFailedTestResultForNcr` shape (`backend/src/routes/ncrs/ncrCore.ts:156-187`) with the same-project join and the lot-consistency check; the audit-payload addition; the NCR create-form delivery picker; the lot-detail cross-link.
- **G5 coexistence — firm, not advisory** `[C54S-B11]`. G5 merged as #1728 while this spec was in review, so this is now a rebase against shipped code rather than a coordination question (sol `[C54R-N1]`, opus5 `[C54R-A8]`, whose "not merged" premises are both superseded). Three requirements:
  1. **Branch from `origin/master` at or after `e3084475`.** All `NCR` line numbers in this document are post-G5 (§2.2); a branch cut earlier will conflict in `schema.prisma`.
  2. **The whole overlap is the `NCR` model block.** G5 added `itpChecklistItemId` (`:1148`, relation `:1154`, index `:1176`); C5.4a adds `linkedDeliveryId` beside it. Verified: G5 did **not** touch `createNcrSchema`, so `ncrCoreValidation.ts` is not a conflict site, and G5's category/root-cause vocabulary is route-side behind `NCR_LEARNING_LOOP_ENABLED` — orthogonal to this field.
  3. **One coexistence test, required to merge:** an NCR created carrying **both** `itpChecklistItemId` and `linkedDeliveryId` persists both, indexes both, survives deletion of either referent with the correct `SET NULL` on that link only, and appears correctly in both G5's checklist-item recurrence query and C5.4a's delivery link. AT-208.
- **Exit:** AT-189, AT-190, AT-191, AT-208.

### C5.4b — Product/mix registration (M) — *flagged, pilot-gated*

- **Depends on:** nothing in C5.4a. Independent.
- **Contains:** migration §5.2; the model, **project-scoped** (§4.6); the nullable status `CHECK` with no default; the required `sourceDocumentId`; nullable `recordedBy` plus the immutable `recordedByLabel`; the pure `registrationCurrency()` tri-state module (§4.2); supersession with the scheme identity check and conditional-update serialisation; the `product_registration` guard entries in **both** registries **with the `metadataLocked` rule and the two Prisma-mock additions** (§2.5, §4.8); **both halves** of the retention guard; the five routes; the register page; the `material_approval_registration_expiring` warning code **with** its `REASON_CODE_PROVENANCE` entry.
- **Ships behind the project allowlist, empty, so no project has it** `[C54S-B4]`.
- **Exit:** AT-192 … AT-196, AT-199, AT-200, AT-202, AT-204 … AT-207, AT-213, AT-216.

### C5.4c — Per-contract material approval (M) — *flagged, pilot-gated*

- **Depends on:** C5.4b merged. **This is a `CREATE TABLE` ordering constraint, not a product dependency** (opus5 `[C54R-N3]`): `product_registration_id` is nullable and §4.3 argues from claim 5.16 that an approval is meaningful with no register behind it. Both phases sit behind one flag and `[C54S-h]` says neither is usable alone, so the split buys one rebase and no independent shippability. Keeping it split is fine; merging the two PRs is equally defensible.
- **Contains:** migration §5.3, **including the `ProjectMaterialApprovalLot` join table** (§4.3.1); the model with the decision-generic attribution block and `recording_mode`; the three-value `CHECK`, the reason-required `CHECK` and the recording-mode/evidence `CHECK`; the **partial unique index** on the current approved row; the three in-transaction same-project link checks **including the hold-point-via-lot join**; the lot-membership validation; supersession with the four-check identity guard and conditional-update serialisation; the `decision_document` guard entries in both registries with their lock rule and mocks; **both halves** of the retention guard for the approval table (the join table joins neither — it cascades); the four routes; the lot-detail section; the folio wiring with **two** `FolioSourceType` members and `FOLIO_PAYLOAD_SCHEMA_VERSION` **2 → 3**.
- **Note:** bumping the folio schema version is not cosmetic. Existing `FolioSnapshot` rows carry `payloadSchemaVersion: 2`; a v2 snapshot must continue to render or be refused cleanly — **never silently read as v3**. The blast radius is one reservation check (`folio/index.ts:87`) and issued PDFs are unaffected (opus5 `[C54R-N7]`). AT-203.
- **Exit:** AT-197 … AT-201, AT-203, AT-204, AT-207, AT-209 … AT-214.

### C5.4d — Structured supplier certificates (L) — **RESEARCH-GATED, NOT SCHEDULED**

- **Gated on:** **U1** (AS 1379 cl 1.7.3's verbatim item list and edition — currently grade B via a CCAA paraphrase that cites neither clause number nor edition). Secondarily **U6** and **U7**.
- **Why the gate is mechanical, not a judgement call:** the profile model reuses `validateProvenance` (`backend/src/lib/readiness/sufficiency/registry.ts:512-575`), which **fails CI on a `confirmed` pack that is not `evidenceGrade: 'A'`**. A base pack sourced from claim 6.2 cannot pass. The gate enforces itself.
- **DC5-7 recommends not scheduling it.** A PR opening a fixed-column `supplier_certificates` table with hard-coded fields should be closed on sight — RG-6 refutes it, and §4.5 records why.

### Deliberately outside C5.4

Any quarantine or material-state machine (`[C54S-B3]`). Any `Supplier` registry. Any new role including `superintendent` (§0.4). Any change to the NCR workflow, its statuses or `assertNcrLinkableLots`. Any hold-point release change. Any C2 certificate-deletion fix (C4's). Any unification of `GENERIC_VERSIONING_BLOCKS` with `EVIDENCE_LINK_GUARDS` (§18.2). Any company delete route or company retention guard (§16 item 5). Any tenant-authored profile (F0's definition model). C5.5 in any form.

---

## 11. Feature flag and rollout

**Rev 2 replaces the flag, because Rev 1's could not perform Rev 1's own rollout** (sol `[C54R-B5]`). `C5_MATERIAL_APPROVALS_ENABLED` was a single process-wide boolean; step 3 said *"enable for one pilot project's tenant"*. Setting it would have exposed the feature to **every** tenant in the process. A pilot gate that cannot pilot is not a gate.

**`C5_MATERIAL_APPROVALS_PROJECTS`** — a **fail-closed project allowlist**, parsed by the **shipped** helper rather than a fourth hand-rolled parse:

```ts
// backend/src/routes/materials/flag.ts
import { parseProjectIdAllowlist } from '../../lib/notificationAutomation/helpers.js';

export function materialApprovalsEnabledForProject(projectId: string): boolean {
  const allowed = parseProjectIdAllowlist(process.env.C5_MATERIAL_APPROVALS_PROJECTS);
  return allowed === 'all' || allowed.includes(projectId);
}
```

The helper (`backend/src/lib/notificationAutomation/helpers.ts:41-54`) is pure, shipped, tested and already carries the properties this gate needs, documented in its own header at `:33-40`:

| Env value | Resolves to | Effect |
| --- | --- | --- |
| absent · `''` · `' '` · `','` · `' , , '` | `[]` | **off everywhere** — the default step 1 depends on |
| `'proj-a'` · `'proj-a, proj-b'` | those ids | on for exactly those projects |
| `'*'` (the whole trimmed value) | `'all'` | on everywhere — the one explicit widening |
| `'proj-a,*'` | `['proj-a']` | the `*` is **dropped as an invalid id** and the named project stands — *"a malformed entry must never widen the scope beyond what was spelled out"* |

`'*'` returns a **distinct value**, not an empty list, *"precisely so 'empty means all' can never creep back in"*. This is the same discipline the boolean's header mandates (`recordDecision.ts:232-235`: *"default FALSE everywhere, including production. Enabling is an explicit, logged rollout step — never an implicit environment default"*), with the scoping the rollout actually requires. **C5.4 adds no new parser and no shared `featureFlags.ts`** — the local-function convention stands, it just calls a shipped helper. AT-205.

**One decision, applied at four consumers.** The same resolved answer gates (a) the routes, as **per-route middleware** in the `requireSurveyFlag` shape (`backend/src/routes/surveys/index.ts:170-176`), **never `router.use`** — the comment at `:164-168` records that a router-level gate on a shared prefix 404s unrelated routes; (b) the UI bootstrap payload, so a disabled project renders no entry point; (c) the readiness collection, so no item is emitted; and (d) the folio collection, so the payload key is present and empty. A project must never be off at one consumer and on at another. AT-205.

**Rollout:**

1. Migrations §5.2 and §5.3 applied to production via the workflow, `C5_MATERIAL_APPROVALS_PROJECTS` **unset** (⇒ `[]` ⇒ off for every project).
2. Deploy disabled; confirm no route is reachable on any project, no readiness item is emitted, and the folio collection is empty.
3. Set the variable to **one project id**. Confirm that project has it and a second project in the **same company** does not — the property Rev 1's boolean could not deliver. Then **one real material approval round-trips end to end with a real contractor**: a registration transcribed from a real certificate with its document attached, an approval transcribed from a real superintendent instruction against named lots, both in that lot's folio. **Confirm or correct: the Layer-1 status vocabulary, the Layer-2 three-value vocabulary, whether `recording_mode` needs a third value, whether the hold-point link is used, whether the applicability edge matches how they think about coverage, and whether registrations are a project asset or a company asset (RG-10, DC5-6c).** `[C54S-B4]`
4. Widen to further named projects, or ship a reviewed migration correcting the `CHECK` vocabularies and repeat step 3. **`'*'` is set only after step 4 succeeds**, and setting it is a logged rollout step, never a cleanup.

**C5.4a ships unflagged.** One nullable FK on an existing create path is not a behaviour change worth a flag, and a flag that is never turned off is a lie in the config. `[C5S-f]`'s reasoning, applied. `[C54S-h]`

---

## 12. Rollback and recovery

| Phase | Rollback |
| --- | --- |
| C5.4a | Revert the code. The column is nullable and orphans harmlessly; existing NCRs are unaffected. Dropping the column is a clean reverse migration but **is not required** to restore behaviour. |
| C5.4b | **Remove the project id from `C5_MATERIAL_APPROVALS_PROJECTS`** — that is the whole rollback, and it is now **per project**, so one pilot project can be rolled back without touching anyone else. No deploy needed. `product_registrations` rows persist and are readable by direct query. Dropping the table is a clean reverse migration and loses only C5.4-created rows — **but it must be dropped after `project_material_approvals`**, because the FK is `Restrict`. |
| C5.4c | Same per-project flag removal. **The one asymmetry in the wave:** `FOLIO_PAYLOAD_SCHEMA_VERSION` returns to `2`, and `FolioSnapshot` rows written at v3 become unreadable by a reverted v2 renderer. They must be **refused with a clear error, never coerced** — the same discipline AT-180 asserted for the 1 → 2 bump; the refusal path is `folio/index.ts:87`. Issued `FolioIssue` PDFs are unaffected: they are append-only files, already rendered. **Drop order within the phase:** `project_material_approval_lots` (Cascade, no dependants) before `project_material_approvals`. |
| C5.4d | Not scheduled. |

**Orphaned certificate documents.** A registration or approval that is deleted leaves its `Document` with no referrer. **Harmless** — the `Restrict` FK means nothing is destroyed, and the file stays in the document register where it can be re-attached or deleted deliberately. `[C5S-B7]`.

**Data-loss risk: none.** No migration rewrites or deletes an existing row; no C5.4 code path deletes a `Document`. The only recovery action touching production data is dropping a C5.4 table, which loses only C5.4-created records — and the FK ordering above is the one operational detail that must not be got wrong.

---

## 13. Acceptance tests

Continuing the shared series, **AT-189 … AT-216** (next free after this spec: **AT-217**). Rev 2 extends the block by eight: the ten blockers needed seven new assertions of their own, plus AT-208's G5 coexistence clause. Every item is a real assertion in a real test file, except where marked mechanical.

| AT | Phase | Assertion | Where |
| --- | --- | --- | --- |
| **AT-189** | C5.4a | **An NCR carries its delivery, and the link survives correctly.** `POST /api/ncrs` with `linkedDeliveryId` persists it; deleting the delivery **nulls** the link and does not delete the NCR (`SET NULL`); the index exists. | `backend/src/routes/ncrs/ncrMaterialLink.db.test.ts` |
| **AT-190** | C5.4a | **The link cannot cross a project or contradict a lot.** (a) a delivery whose diary belongs to another project → 400 *"Linked delivery must belong to the NCR project"*; (b) a delivery from another **tenant** → 400, with a whole second tenant seeded; (c) a delivery whose `lotId` is not among the NCR's lots → 400; (d) a delivery with `lotId IS NULL` links freely. | same |
| **AT-191** | C5.4a | **The prohibition on incorporation is unchanged and still blocks — characterisation.** A lot with an open NCR that carries `linkedDeliveryId` is **not** `lotConformable` and emits `open_ncrs` at blocking severity; closing the NCR clears it. Asserts C5.4a broke nothing. `[C54S-B5]` | `backend/src/lib/readiness/conformancePrerequisites.test.ts` |
| **AT-192** | C5.4b | **CIVOS never writes a status it derived — the wave's flagship, proven two ways.** (a) a registration whose `valid_to` is in the past still has its **transcribed** `status` in the DB, unchanged, after being read through every route and every readiness pass; (b) the derived currency flag is present on the **response** and absent from the **row**; (c) a diff grep asserts zero identifiers matching `expireRegistrations|sweepRegistrations|markExpired` and zero cron/job registration in C5.4 code. `[C54S-B2]` | `backend/src/routes/materials/productRegistration.db.test.ts` + diff grep in the PR body |
| **AT-193** | C5.4b | **The status vocabulary distinguishes three epistemic states, enforced at the DB.** By **raw SQL bypassing the route**: `NULL` inserts and means *not recorded*; each of `general`/`conditional`/`expired`/`withdrawn`/`not_published` inserts; `'not_stated'`, `'approved'`, `'current'`, `''` and `'GENERAL'` are each rejected by **`product_registrations_status_check` by name**. **A `DEFAULT` on the column is asserted absent** — an insert omitting `status` yields `NULL`, never a value. `valid_to < valid_from` is rejected by `product_registrations_validity_check`. `[C54R-B10]` | same |
| **AT-194** | C5.4b | **Identity is per-scheme, per-project, and immutable.** Two rows with the same `registrationNumber` under **different** `scheme` values both insert; two rows with the same `(scheme, registrationNumber)` in **different projects** both insert (the Rev 2 duplication cost, made explicit); a duplicate `(projectId, scheme, registrationNumber)` is rejected by the unique constraint; `PATCH` changing `scheme` or `registrationNumber` returns 400 *"a new registration number is a new registration"*; a re-issued certificate for the same number updates and audits `{from,to}`. Claims 5.6, 5.8. | same |
| **AT-195** | C5.4b | **Supersession is scoped to one registration identity.** Four refusals: self-reference; a registration in another **project**; a registration under a different `scheme`; a target that is itself superseded. Reads default to `supersededById: null`. Mirrors `requireSupersededByInProject` (`backend/src/routes/drawings.ts:37-66`). | `backend/src/routes/materials/supersede.db.test.ts` |
| **AT-196** | C5.4b | **The register is bounded.** `GET /api/projects/:id/product-registrations` applies a hard `take` cap and paginates; a company seeded past the cap returns the cap plus a next-page marker, never the full set. `[C3R-B1]` lesson. | `backend/src/routes/materials/register.db.test.ts` |
| **AT-197** | C5.4c | **CIVOS never decides — proven at the DB, for every status.** By **raw SQL bypassing the route**: (a) `status='approved'` with `decided_by_name=NULL` **and** (b) with `decided_at=NULL` are each rejected by the column's `NOT NULL`; **(c) the same two, repeated for `status='rejected'` and `status='withdrawn'`** — the Rev 1 hole, where only approvals were attributed; (d) any status other than `'approved'` with a NULL `decision_reason` is rejected by **`project_material_approvals_reason_required_check` by name**; (e) `recording_mode='transcribed_document'` with a NULL `decision_document_id`, and `recording_mode='referenced_hold_point_release'` with a NULL `hold_point_id`, are each rejected by **`project_material_approvals_recording_mode_check` by name**; (f) a third `recording_mode` value, and a `decision_method` outside the five, are each rejected. And no route accepts a body field named `approve`, `grantApproval` or `autoApprove`: a diff grep asserts zero such identifiers. `[C54S-B1]`, `[C54R-B6]` | `backend/src/routes/materials/materialApproval.db.test.ts` + diff grep |
| **AT-198** | C5.4b, C5.4c | **Bodies are strict whitelists.** Every **C5.4b and C5.4c** write body rejects an unknown key with a **400** and leaves the row unchanged — asserted per route, not once. The `[C5R-B2]` trust boundary, shipped at `backend/src/routes/deliveries/index.ts:112-118`. **Scope note (opus5 `[C54R-N5]`, verified):** `createNcrSchema` (`ncrCoreValidation.ts:88-125`) is **not** `.strict()`, so C5.4a's `linkedDeliveryId` joins a permissive shipped body. That is the correct call — tightening the NCR create body is not C5.4's change — and this AT does not claim otherwise. | `backend/src/routes/materials/*.db.test.ts` |
| **AT-199** | C5.4b, C5.4c | **Writes are narrow, archived-safe and hard-audited.** (a) `site_manager`, `site_engineer`, `foreman` and `viewer` **403** on every C5.4 write; `quality_manager` **succeeds**; (b) every write **403s on an archived project** (`requireWritable: true` reaching `assertProjectAllowsWrite`, `projectAccess.ts:205-207`); (c) an audit row exists with `{from,to}` per changed field, and **a forced audit-write failure rolls the write back** — `writeAuditLogInTransaction`, not best-effort `createAuditLog`. | `backend/src/routes/materials/access.db.test.ts` |
| **AT-200** | C5.4b, C5.4c | **Cross-project and cross-tenant are refused on every new route, lettered.** Second tenant seeded: (a) another tenant's project on the register → 403; (b) a registration id from **another project** presented on this project's path → **404**, never 200 (the Rev 2 item-route property, `[C54S-B10]`); (c) `productRegistrationId` from another project attached to an approval → 400, and the check reads the **path** project, never the JWT's `companyId`; (d) a `decisionDocumentId` from another project → 400; (e) a subcontractor on **any** C5.4 route, read or write → 403 (DC5-9); (f) a `lotId` from another project in the applicability edge → 400 (AT-210); (g) the project-scoped read returns an approval that the lot-scoped read omits when no edge row joins them. | `backend/src/routes/materials/tenancy.db.test.ts` |
| **AT-201** | C5.4c | **Approval supersession is scoped to one material identity — and permits registration revisions.** Four refusals: self; another project; a different normalised `material_key` (asserted with `'N32-20'` vs `'n32-20 '` **succeeding** as the same identity); a target already superseded. **And one permission the Rev 1 guard wrongly refused: an approval citing a *different* `product_registration_id` — the replacement registration — supersedes the old approval and 200s** (claim 5.8, sol `[C54R-B9]`). | `backend/src/routes/materials/supersede.db.test.ts` |
| **AT-202** | C5.4b, C5.4c | **The one readiness code warns and never blocks.** `material_approval_registration_expiring` at `severity: 'warning'`, `blocksAction: false`, **not in `HANDOVER_BLOCKING_REASON_CODES`** (`reasonCodes.ts:127`); it has its `REASON_CODE_PROVENANCE` entry (the contract test fails otherwise — two edits per code, §18.2 item 8); a lot with an expiring registration still conforms and still claims. **It fires only through the §4.3.1 edge**: a project-level approval with no edge row to this lot emits nothing here. **And `registrationCurrency() === 'unknown'` emits nothing** — an absent date is not a finding. **`material_approval_missing` is asserted absent** from `READINESS_REASON_CODES` `[C54S-m]`. `[C5S-B5]` | `backend/src/lib/evidenceReadiness/*.test.ts` + the reason-code contract test |
| **AT-203** | C5.4c | **The folio bump is honest and the ceiling is respected.** `FOLIO_PAYLOAD_SCHEMA_VERSION === 3`; a stored **v2** snapshot is refused with a clear error at `folio/index.ts:87` and is **never** read as v3; `countEvidenceRows` includes the new collection; a lot seeded past `folioEvidenceRowCeiling()` **refuses with the measured number** and does not truncate; `FOLIO_EVIDENCE_ROW_CEILING_DEFAULT` unchanged. **And the count is per-lot, not per-project:** a project with 200 approvals of which 3 join this lot contributes **3** rows — the property the §9 budget depends on and Rev 1 could not deliver. The p99 per-lot row delta is measured and **recorded in the PR body**. | `backend/src/lib/handover/folioPayload.test.ts`, `backend/src/routes/folio/assemble.db.test.ts` + benchmark artefact |
| **AT-204** | C5.4b, C5.4c | **Both new evidence tables survive the retention guard, both halves.** A project holding one `ProductRegistration` and nothing else, and separately one holding one `ProjectMaterialApproval` and nothing else, are each **refused** a permanent delete with the shipped conflict message and a non-zero entry in `retainedRecordCounts`; archiving still succeeds. **And a mechanical assertion that both keys appear in `RETAINED_PROJECT_RELATIONS` (`writeRoutes.ts:44-68`) *and* the `_count` select (`:692-716`)** — the two-list trap, now with two tables to add. `project_material_approval_lots` is asserted **absent** from both: it cascades from its approval and is not independently evidence. | `backend/src/routes/projects/writeRoutes.test.ts` |
| **AT-205** | C5.4b, C5.4c | **The flag is fail-closed, per-project, and gates all four consumers identically.** (a) env var **absent** ⇒ `materialApprovalsEnabledForProject()` false for every project; every C5.4b/c route 404s, the folio collection is empty, no readiness item is emitted, the UI bootstrap flag is false. (b) `''`, `' '`, `','` and `' , , '` behave identically to absent. (c) A **named** project is enabled and **a second project of the same company is not** — the property Rev 1's boolean could not deliver, asserted on both. (d) `'*'` enables every project. (e) **`'proj-a,*'` enables `proj-a` only** — the malformed-entry-must-not-widen rule (`helpers.ts:33-40`). (f) With the flag off, `/api/projects/:id` and `/api/lots/:id` still resolve normally — the per-route-not-`router.use` property (`surveys/index.ts:164-168`). (g) A project enabled at the route is **not** empty at the folio, and vice versa — one decision, four consumers. | `backend/src/routes/materials/flag.test.ts` |
| **AT-206** | C5.4b, C5.4c | **CIVOS attributes rather than asserts, in the copy — and never borrows the register's words.** The rendered approval prints the external decider's name **and** organisation **and** *"recorded by \<user\> on \<date\>"* as distinct strings, **for a rejected and a withdrawn row as well as an approved one**. A registration past `validTo` renders *"validity lapsed"*; one with `status='expired'` renders *"Register status: Expired (as transcribed)"*; **a row that is both renders both, and CIVOS's derived state never uses the word "Expired"**. `status IS NULL` renders *"register status not recorded"*, distinct from `'not_published'`. A diff grep asserts *approves*, *registers*, *validates*, *verifies*, *certifies* and *checks* appear nowhere in C5.4 user-facing copy. `[C54S-B1]`, `[C5S-B2]` | renderer snapshot test + diff grep |
| **AT-207** | C5.4b, C5.4c | **Neither new document link can be stranded, silently deleted, silently re-versioned or silently re-labelled.** `DELETE /api/documents/:id` on a document referenced by `product_registrations.source_document_id` or `project_material_approvals.decision_document_id` returns **409 `WORKFLOW_EVIDENCE_DELETE_BLOCKED`** with the right `evidenceType` — not the bare 422 `INVALID_REFERENCE` the raw FK produces; `POST /api/documents/:id/version` returns **409 `WORKFLOW_EVIDENCE_VERSION_BLOCKED`**; an unlinked document still deletes and still versions. **New in Rev 2 (sol `[C54R-A5]`): `PATCH /api/documents/:id` succeeds before the link exists and returns 409 `WORKFLOW_EVIDENCE_LOCKED` after it does**, for both entries — §4.8's rule, which Rev 1 left undeclared. **And the mock obligation opus5 `[C54R-A1]` found:** both guard suites mock Prisma by table name, so `productRegistration` and `projectMaterialApproval` mocks are added in the same PR and the existing suites still pass. *(Rev 1's "two shipped positional assertions" clause is struck — they are comments, not assertions.)* `[C54S-B7]` | `backend/src/routes/documents/deleteRoutes.test.ts`, `versionRoutes.test.ts`, `access.test.ts` |
| **AT-208** | C5.4a, all | **C5.4a coexists with G5, and the wave built no state machine and touched no docket.** **(a) G5 coexistence, required to merge C5.4a** `[C54S-B11]`: an NCR created carrying **both** `itpChecklistItemId` and `linkedDeliveryId` persists and returns both; deleting the checklist item nulls **only** `itpChecklistItemId`; deleting the delivery nulls **only** `linkedDeliveryId`; neither deletes the NCR; both indexes exist; G5's checklist-item recurrence query and C5.4a's delivery link each still return it. **(b) Mechanical, in the PR body:** `git diff origin/master...HEAD` shows zero occurrences of `quarantin`, zero new material status column, zero change under `backend/src/routes/dockets/`, zero change to `daily_dockets`/`docket_labour`/`docket_plant`, the three `approvedDockets: 0` literals unchanged, no new member in `ROLES` (`backend/src/lib/roles.ts:6-18`), and no new `multer(` call site. `[C54S-B3]`, `[C5S-B3]`, `[C5S-B8]` | `backend/src/routes/ncrs/ncrMaterialLink.db.test.ts` + PR body |
| **AT-209** | C5.4c | **The lot-scoped read is driven by the applicability edge and nothing else.** `GET /api/projects/:projectId/lots/:lotId/material-approvals` returns exactly the approvals with an edge row to that lot: an approval joined to lots A and B appears on both; an approval joined to no lot appears on **neither** and still appears on the project-scoped read; an approval joined to lot A does not appear on lot B. `assertBelongsToLot` is applied to the **join row** (`folio/access.ts:72-80`). `[C54S-B9]`, sol `[C54R-B1]` | `backend/src/routes/materials/applicability.db.test.ts` |
| **AT-210** | C5.4c | **Applicability edges cannot cross a project or duplicate.** (a) `lotIds` containing a lot from another project → **400**, validated in the write transaction and the whole write rolls back; (b) a lot from another **tenant** → 400, with a second tenant seeded; (c) the same `(approvalId, lotId)` twice → rejected by the unique constraint; (d) deleting a lot removes only its edge rows and leaves the approval; (e) deleting an approval cascades its edge rows; (f) `@@index([lot_id])` exists. | same |
| **AT-211** | C5.4c | **The folio invalidates when the projected registration changes.** Compile a folio source set for a lot whose approval cites a registration. Then update **only the registration** (its status, or its `validTo`, or its `sourceDocumentId`) and assert the previously compiled source set is **stale** — `FolioSourceType` carries `'product_registration'` as its own member with its own `'updated_at'` token, so the approval's unchanged `updatedAt` cannot mask it. Also assert the exhaustive `REVISION_TOKEN_KINDS` record covers both new members. sol `[C54R-B2]` | `backend/src/lib/handover/revisionTokens.test.ts`, `backend/src/routes/folio/assemble.db.test.ts` |
| **AT-212** | C5.4c | **A hostile `holdPointId` is refused inside the write transaction.** (a) a hold point whose lot belongs to **another project** → 400; (b) whose lot belongs to **another tenant** → 400; (c) whose lot is in this project but is **not** among the approval's applicable lots → 400; (d) the valid case 201s and the FK is `SET NULL` on hold-point delete without touching the approval. The check joins `holdPoint.lot.projectId` — a `HoldPoint` has no `projectId` (`schema.prisma:854-895`) and a column read would not compile. sol `[C54R-B7]` | `backend/src/routes/materials/tenancy.db.test.ts` |
| **AT-213** | C5.4b, C5.4c | **A recorded transcription never bricks account deletion.** A user records one registration and one approval, then **`DELETE` their own account succeeds** through the real path (`backend/src/routes/auth/accountDeletionRoutes.ts`, `tx.user.delete` at `:175`); both rows survive with `recorded_by` NULL and `recorded_by_label` **unchanged and non-empty**. Removing them as a company member (`company/memberRoutes.ts:94`) likewise succeeds. **And a create omitting `recordedBy` is a 400 from the Zod body**, so nullable-in-the-DB never means optional-at-the-route. sol `[C54R-B8]` / opus5 `[C54R-B1]` | `backend/src/routes/auth/accountDeletion.db.test.ts`, `backend/src/routes/materials/access.db.test.ts` |
| **AT-214** | C5.4b, C5.4c | **One current approved row per material, and supersession is serialised.** (a) Two `'approved'`, non-superseded rows with the same normalised `material_key` in one project → the second is rejected by **`project_material_approvals_current_material_key` by name**, asserted by **raw SQL**; (b) `'rejected'` and `'withdrawn'` rows with that key insert freely; (c) a superseded `'approved'` row does not block a new one; (d) **two concurrent supersessions of the same target produce one 200 and one 409** — the conditional `updateMany` guarded on `supersededById: null`, never two chains. sol `[C54R-B9]` | `backend/src/routes/materials/supersede.db.test.ts` |
| **AT-215** | C5.4b, C5.4c | **A legacy `superintendent` project row reads and cannot write.** Seed a `ProjectUser` with `role: 'superintendent'` directly (it is unassignable through `parseProjectTeamRole`, so the test writes it as legacy data): every C5.4 **read** route 200s, every C5.4 **write** route **403s**. And `ROLES` (`backend/src/lib/roles.ts:6-18`) gains no member. The design decision of §0.4, made testable. `[C54S-j]`, sol `[C54R-A1]` | `backend/src/routes/materials/access.db.test.ts` |
| **AT-216** | C5.4b | **Currency is tri-state with defined civil-date boundaries.** Pure-function test of `registrationCurrency()`: both dates null ⇒ `'unknown'`; `validTo` null ⇒ `'unknown'`, **never `'current'`**; `validFrom` in the future ⇒ `'unknown'` with reason *"not yet in effect"*; an unparseable stored date ⇒ `'unknown'`. **Boundaries in `Australia/Sydney`:** at `validTo` 23:59:59 local ⇒ `'current'`; at the next local midnight ⇒ `'lapsed'`; the same instants evaluated as UTC would flip the answer, and the test asserts they do not. One case spans a daylight-saving transition. sol `[C54R-A6]` | `backend/src/lib/materials/registrationCurrency.test.ts` |

---

## 14. Exit gate

1. AT-189 … AT-216 pass in CI; the DB-backed ones against the local disposable Postgres per `CLAUDE.md`. `src/test/databaseSafety.ts` is not weakened.
2. All applicable migrations applied to production via the `Production Migrations` workflow from `master` with the confirmation phrase; **no `db push`, no `--accept-data-loss`**.
3. `C5_MATERIAL_APPROVALS_PROJECTS` completes all four rollout steps (§11), including step 3's **real** round-trip, its two-projects-one-company scoping proof, and its six named confirmations. `[C54S-B4]`
4. **A real project round-trips, owner Jay:** a mix or product registration transcribed from a real authority certificate **with that certificate filed and openable**; a superintendent's decision for that contract transcribed from a real instruction, naming them and their organisation, **applicable to named lots**; both appearing in those lots' issued folio with the transcriber distinct from the decider; and a non-conforming delivery raised as an NCR with the delivery linked, blocking that lot until closed.
5. **The RG-10 question is answered** — job asset or company asset — and `[C54S-a]` is confirmed or flipped in this document, not in a comment. **DC5-6c is decided on the answer**, including its write-authority cost.
5a. **C5.4a's G5 coexistence test passes** (AT-208(a)) and the branch was cut at or after `e3084475`. `[C54S-B11]`
6. The folio p99 row delta and the register p95 are **measured on the reference dataset and recorded in the PR body** — a number, not an adjective. AT-203.
7. `[C54S-B2]` grep over the wave's diff (`git diff origin/master...HEAD`, **not** the tree — the `[C3R-A6]` lesson): no scheduled job, cron, trigger or request-time write of a derived registration status. AT-192(c).
8. `[C5S-B2]` + `[C54S-B1]` grep over the diff: none of *approves / registers / validates / verifies / certifies / checks* in C5.4 user-facing copy. AT-206.
9. `[C54S-B3]` grep over the diff: zero occurrences of `quarantin` and no material status column. AT-208.
10. `[C5S-B3]` grep over the diff: no docket-domain change. AT-208.
11. `[C5S-B7]` grep over the diff: no `document.delete` in C5.4 code.
12. `[C5S-B8]` grep over the diff: no new `imageValidation.ts` signature entry, **no new `multer(` call site** (the count stays at twelve), no new multer `fileFilter` allow-set.
13. **`[C54S-B7]` mechanical check, three registries:** every `Document` FK added by the wave has its `EVIDENCE_LINK_GUARDS` entry — **with a declared `metadataLocked` rule and its Prisma-mock additions in both guard suites** — **and** its `GENERIC_VERSIONING_BLOCKS` entry, both **appended**; every project-scoped table added has its entry in **both** `RETAINED_PROJECT_RELATIONS` and the `_count` select. A one-line grep pairing new `documents("id")` FK lines in the migrations against new entries in the two guard files, plus AT-204's assertion. AT-204, AT-207.
14. **No new member in `ROLES`** (`backend/src/lib/roles.ts:6-18`) — §0.4. AT-208.
14a. **`[C54S-B9]` grep over the diff:** no C5.4 code path fuzzy-matches free text to decide applicability — zero `contains`/`ILIKE`/`startsWith` predicates joining `supplier`, `description`, `batchRef` or `material_key` across tables. Applicability comes from `project_material_approval_lots` only. AT-209.
14b. **`[C54S-B10]` grep over the diff:** every C5.4 route path contains `:projectId`; zero C5.4 route handlers read `req.user.companyId`; zero C5.4 `where` clauses key on `companyId`. AT-200.
15. The research register in `docs/research/` records U1–U7 plus **RG-10 and RG-11** as open, so the next agent finds them by grep.
16. Docs and the Clancy knowledge mirror updated in the feature PR (standing boundary, program line 5). Clancy must not gain an entry saying CIVOS approves materials.
17. **`npm run fallow:audit` verdict recorded in every PR body.**
18. §16's honest unknowns re-read at the end of the wave; any that closed are moved to a closed table with the evidence, not deleted.
19. **§19's program amendment is either applied to the program file or explicitly declined by Jay**, and this document records which.
20. **The migration-slot reservation `20260811000000 … 20260814000000` is recorded in `docs/agent-handoff.md`** before the first C5.4 PR opens — opus5 `[C54R-N6]`, whose warning was borne out when G5 took the slot Rev 1 left unclaimed. A reservation only this document knows about is not a reservation.

**Not in this gate:** malware scanning (open program-wide, §8); the C2 certificate-deletion fix (C4's); the `GENERIC_VERSIONING_BLOCKS` / `EVIDENCE_LINK_GUARDS` unification (§18.2); a company delete route or company retention guard (§16 item 5); C5.4d in any form; C5.5 in any form; U3–U7.

---

## 15. Decisions

### 15.1 Decisions for Jay

**DC5-6 — the registration tenancy question, split into the four decisions Rev 1 collapsed into one** (sol `[C54R-A7]`). Rev 1 asked only about *page mounting*, and in answering that it silently also answered write authority and evidence scope — wrongly, on both.

**DC5-6a — Who OWNS a registration row: the project or the company?**
→ *Recommendation:* **the project, in v1** (§4.6). RG-5 establishes that the *registration* is valid across the authority's projects; it establishes nothing about where a contractor files their transcription, and RG-10/U2 are open. Rev 1 shipped the inference as schema in the phase the spec itself says is not safe without pilot validation.
*One-line why:* project scope assumes less, and it is the direction that composes — a company library adds on top additively, un-sharing does not.

**DC5-6b — Who may WRITE one?**
→ *Recommendation:* **`REGISTRATION_EDITORS` on the owning project** — correct by construction once DC5-6a is answered. Rev 1's combination gave a role held on one project authority over records every other project consumed (sol `[C54R-B3]`), which is a privilege escalation, not a convenience.
*One-line why:* authority must not be broader than the data it governs.

**DC5-6c — Does the company library get built, and when?**
→ *Recommendation:* **not now; decide it on the step-3 round-trip** (`[C54S-a]`'s flip). Its shape is `GlobalSubcontractor` → `SubcontractorCompany` (`schema.prisma:1423`, `:1445`): a company-level table above the project rows with a `SetNull` lineage FK and a copy-into-project action. **Its real cost, which Rev 1 never priced:** the library needs **company-level write authority**, and `requireCompanyAdmin` (`backend/src/routes/company/access.ts:6-17`) is owner/admin only — so either the QM is locked out of the library, or CIVOS gains a company-wide QM permission, which is a new tenancy concept and its own wave.
*One-line why:* the library is a real want, but it costs a permission model CIVOS does not have, and nobody has yet confirmed the want.

**DC5-6d — Where does the certificate live?**
→ *Recommendation:* **in the project, as an ordinary `Document`.** `Document.projectId` is `NOT NULL` and reads gate on that exact project, so the alternative is a bespoke audited company-document access rule — a novel access surface, on an unvalidated feature, to solve a problem DC5-6a removes. With this answer `sourceDocumentId` becomes **required**, which is a strictly stronger evidence guarantee than Rev 1 could offer.
*One-line why:* a proof nobody can open is not a proof, and the cheapest way to make it openable is to keep it where the reader already is.

**DC5-7 — Does C5.4d (structured supplier certificates) get scheduled, or come off the roadmap?**
→ *Recommendation:* **do not schedule it, and do not buy AS 1379 yet.** The useful half already ships: `batchRef` is the *specified* traceability token (claims 6.3, 6.4) and the docket is already filed. The remaining half needs a purchased standard (U1), a further pass for non-concrete/asphalt materials (U7), and it delivers a transcription form nobody has asked for. Revisit when a pilot contractor asks for it by name — at which point buy the standard, because the CI provenance validator will refuse a grade-B pack anyway.
*One-line why:* the join key the specifications actually mandate is already in the database, and everything past it is transcription labour.

**DC5-8 — Should the Layer-2 approval record a "submitted, awaiting decision" state?**
→ *Recommendation:* **no, not in v1** (§4.3). RG-5 gives lead times — 4 weeks for concrete mix nomination (5.2, 5.10, 5.15), 7 days for asphalt (5.8), 28 days recommended for registration (5.7) — so a submission genuinely has duration, and there is a real argument. But no source establishes what the contractor's *record* of that submission is, and a state whose only content is "we sent it" is a reminder, not evidence. Ask it in the step-3 round-trip; adding a fourth `CHECK` value later is a reviewed migration.
*One-line why:* the lead times are real, the record of them is not established, and the `CHECK` makes it cheap to add once it is.

**DC5-9 — Do subcontractors see material approvals or registrations?** *(Standing, not open — but it now carries the owner, pilot question and flip condition sol `[C54R-A7]` requires, because it governs supplier-facing disclosure.)*
→ *Recommendation:* **no — 403 on every C5.4 surface**, same as DC5-3 and DC5-5. `requireSubcontractorPortalModuleAccess` has a closed six-member module vocabulary (`backend/src/lib/projectAccess.ts:7-13`, verified — no materials key), so exposing it is not a matrix cell but a new module.
*One-line why:* a registration names a supplier and a plant location, and the subcontractor reading it is often that supplier's competitor.
- **Owner:** Jay, with the pilot contractor.
- **Pilot question, asked in the step-3 round-trip:** *"when your concrete subbie asks whether the mix is approved, who tells them today — and would you want CIVOS to?"*
- **Flip condition:** the pilot says subcontractors are routinely told, **and** the disclosure can be scoped to the approvals applicable to lots that subcontractor is assigned to — the §4.3.1 edge makes that expressible, which it was not in Rev 1. Even then it is a **new portal module** with its own threat model, not a widened role array.
- **opus5 `[C54R-N4]` is right that this is not an open decision**, and it is recorded as standing rather than removed, so a future agent finds the reasoning and the flip instead of re-deriving it.

**DC5-10 — Does the program line get amended (§19), or does the clause stay and go unbuilt?**
→ *Recommendation:* **amend it, in the in-line style the program already used for C3 at line 77.** The research is a grade-A negative over ~200 documents. Leaving *"rejected/quarantined material state"* in the program line means the next agent handed Wave C reads it as an outstanding obligation and builds it — which is exactly how the D2 clause survived until C5's Rev 1 read the D0 research.
*One-line why:* an unstruck clause is one confident agent away from a state machine nobody in AU civil uses.

### 15.2 The spec's own decisions

- **`[C54S-a]`** *(Rev 2, reversed)* — `ProductRegistration` is **project-scoped**, like everything else in the wave. *(§4.6.)* Rev 1 had it company-scoped and project-reached, which gave a project role authority over company data and backed a company-wide claim with a project-only document. *Flip condition:* the step-3 round-trip (RG-10) shows contractors treat registrations as **company** assets — in which case DC5-6c adds a company library **above** these rows in the `GlobalSubcontractor` shape, with company-level write authority, and no existing row moves.
- **`[C54S-b]`** — Two tables, no shared abstraction, no `kind` discriminator. *(§4.1.)* *Flip condition:* a third layer appears with the same tenancy **and** the same lifecycle **and** the same permission shape.
- **`[C54S-c]`** *(Rev 2, split)* — The Layer-1 status column is **nullable with no default**, `CHECK`-constrained to the four published values **plus `'not_published'`**. `NULL` means *not recorded*; `'not_published'` means *this scheme publishes none*. *(§4.2.)* *Flip condition:* U6 shows another authority publishing a fifth status word — added by reviewed migration, never mapped onto an existing value.
- **`[C54S-d]`** — Layer 1 records *that* a registration exists and is current, never *what the material is made of*. *(§4.2.)* *Flip condition:* none foreseeable; constituent detail is the RG-6 field-list problem and belongs to C5.4d.
- **`[C54S-e]`** — Layer 2 has three states and no `'submitted'`. *(§4.3.)* *Flip condition:* DC5-8, answered in the round-trip.
- **`[C54S-f]`** — `holdPointId` is a nullable annotation that nothing depends on. *(§4.3.)* *Flip condition:* RG-11 resolves to "the release **is** the approval" for the pilot's jurisdiction — and even then the answer is a read-side projection, not a gate.
- **`[C54S-g]`** — Approvals are in the folio but **not** in the hold-point release package. *(§4.7.)* *Flip condition:* a real superintendent asks for it. Same call and reasoning as `[C5S-e]`.
- **`[C54S-h]`** — C5.4a ships unflagged; C5.4b and C5.4c share one flag. *(§11.)* *Flip condition:* none foreseeable — they are two halves of one feature.
- **`[C54S-i]`** *(Rev 2, extended)* — C5.4 takes **AT-189 … AT-216**; next free **AT-217**. `AT-157 … AT-169` stay reserved for D1c.1. *Flip condition:* none — a series gap is harmless, a collision is not.
- **`[C54S-j]`** — No new role, and `superintendent` does not join `ROLES`. **A legacy `superintendent` project row reads and cannot write**, and C5.4 offers that actor no direct signed path. *(§0.4, AT-215.)* *Flip condition:* a wave that actually needs an authenticated external approver — at which point it is a role **plus** a portal module **plus** a threat model, and it is not this wave.
- **`[C54S-k]`** *(Rev 2)* — Registration currency is a **pure tri-state read-time function**, `current | lapsed | unknown`, with `validTo` an inclusive civil date in `Australia/Sydney`. *(§4.2, AT-216.)* *Flip condition:* a project genuinely operating in another timezone needs a per-project zone — at which point it is a platform-wide change, not a C5.4 column.
- **`[C54S-l]`** *(Rev 2)* — A decision is evidenced by exactly two `recording_mode`s, each with its evidence enforced by a `CHECK`. There is no "verbal" mode. *(§4.3, AT-197.)* *Flip condition:* the pilot produces a real decision that fits neither — added as a `CHECK` value by reviewed migration, **never** as a nullable escape hatch.
- **`[C54S-m]`** *(Rev 2)* — `material_approval_missing` is **not built in v1**. *(§4.7.)* *Flip condition:* §16 item 8's pilot measurement yields a `batchRef`↔`registrationNumber` correspondence rate good enough to build a predicate on, or the pilot contractor asks for the item by name.

---

## 16. Honest unknowns

Listed rather than asserted. Each names how it gets resolved.

1. **Whether a head contractor will maintain a registration register at all.** This is **U2**, and it is the one grade-C unblock condition RG-5 did **not** meet — the *authority*-side register schema is known (claim 5.13), the *contractor*-side one is not. The whole of C5.4b assumes someone will type into it. → *Resolved by step 3 of the rollout.* ***Jay, with a design partner.*** **This is the largest risk in the wave and it is a demand risk, not a technical one.**
2. **Whether registrations are a job asset or a company asset (RG-10).** Rev 1 answered *company*, on the strength of "valid across all of that authority's projects" — an authority-side fact used to infer a contractor-side filing habit, as its own text conceded. **Rev 2 answers *job*, and the honest reason is that it is the answer that assumes less**, not that the evidence points that way: the evidence is silent. → *One question in the round-trip.* `[C54S-a]` and DC5-6c carry the flip, and the flip direction was chosen to be the cheap one.
3. **Whether Layer 2 and the hold-point release are one act or two (RG-11).** Grade-A sources differ by jurisdiction, and the tolerance research found the sibling survey question answered three different ways (`c5-survey-tolerance-research-2026-07-31.md:632-633`). → *`[C54S-f]` makes the column non-load-bearing so this can be answered late without a migration.*
4. **Whether `product_registrations` needs to appear in the account privacy export.** Rev 2 makes it project-scoped, so it is now the **same shape** as every other row the project-shaped export path already handles (`backend/src/routes/auth/accountPrivacyRoutes.ts`) — which removes Rev 1's mismatch but does **not** prove inclusion. It carries third-party names (`supplierName`, `plantLocation`). **Still not asserted as handled** — checked at build time against the actual export scope, and if it is out of scope that is a finding to record, not a gap to leave silent. The **deletion** path, which Rev 1 never mentioned at all, is now covered by AT-213.
5. **What a company hard-delete would owe.** There is no company delete route today (§2.4, grepped). **Rev 2 removes C5.4's exposure to that gap entirely** — with no `companyId` anywhere in the wave, both new tables ride the project retention guard. The obligation that remains is pre-existing and not C5.4's: `WebhookConfig`, `GlobalSubcontractor` and `ImportMappingProfile` have it today. **DC5-6c would re-open it for C5.4**, and that is part of the library's price. → *Recorded so it is not discovered by a data loss.*
6. **Whether malware scanning matters more than this wave thinks.** C5.4 reasons out of a threat-model artifact by adding no new file type and no upload route. Correct as far as it goes, and it does not make the program-wide gap smaller. → *Program §7's requirement stays open and unowned.*
7. **Whether the Layer-1 vocabulary generalises past VIC asphalt.** The four published values are one authority's, for one material (claim 5.13), being used as the shape for all schemes. **`'not_published'` and a nullable column are the pressure valves**, and Rev 2 separating them means a scheme CIVOS has not met yet is recorded as unrecorded rather than as a fact. → *U6, and the round-trip.*
8. **Whether `batchRef` free text is enough, or whether the approval→delivery join needs to be structural.** The specifications mandate the identifier appear on the docket (5.11, 6.7, 6.12) and CIVOS transcribes it — but nothing joins a `batchRef` to a `registrationNumber` programmatically, so the "prove this delivery was an approved mix" question is answered by a human reading two screens. → *Measure it on the pilot: how often do the two strings actually match? A query, not a research pass, and the cheapest unknown here.*
9. **Whether the NCR↔delivery link gets used.** C5.4a is cheap enough that this barely matters, but if nobody links, the clause was discharged on paper. → *Count linked NCRs on the pilot tenant in week one.*
10. **What Rev 2's project scoping actually costs in transcription labour** (new in Rev 2). The same mix recorded on five jobs is five rows and five certificate uploads. §4.6 argues that is the cheaper wrong against a scope escalation and unreadable evidence, and the argument is sound — but the **size** of the cost is a guess. → *Measure it: count `(scheme, registration_number)` pairs appearing in more than one project on the pilot tenant after a month. Zero means the company library was never needed; a high number is DC5-6c's business case, with a number attached.*
11. **Whether one current approved row per material is the right rule** (new in Rev 2, from opus5 `[C54R-A7]`). The partial unique index assumes two suppliers of one mix carry different mix codes, which is how per-plant registration works — but it is an inference. → *The step-3 round-trip: ask whether two concurrent approvals for one `material_key` is a real situation. If it is, the index comes off and §4.7 owes the folio a stated ordering and label.*
12. **Whether `recording_mode`'s two values cover real practice** (new in Rev 2). Grade-A sources give letters, emails, site instructions and hold-point releases — all of which fit. A verbal instruction later confirmed in writing fits as `transcribed_document` once the confirmation arrives, and not at all before. → *Step-3 round-trip; `[C54S-l]` carries the flip, and it is a `CHECK` value, not a nullable escape hatch.*

---

## 17. Delivery-control checklist (program §9 — all thirteen items)

| # | Item | Where |
| --- | --- | --- |
| 1 | Exact included and excluded behaviour | §0.2, §1.1, §1.2 |
| 2 | Schema and data flow | §4, §5 |
| 3 | Permission matrix | §7.3 — every row checked against the real access helper |
| 4 | Edge cases | §4.2 (revision vs new registration; tri-state currency and its civil-date boundaries), §4.3 (three same-project link checks incl. hold-point-via-lot; supersession identity and concurrency), §4.3.1 (applicability, and what it refuses to infer), §4.4 (null lot, same project), §4.8 (metadata lock), §5.3 (DB vs route split), §12 (FK drop ordering), §13 (AT-190, AT-193, AT-197, AT-200, AT-203, AT-210 … AT-216) |
| 5 | Migration plan | §5 — four additive reviewed Prisma migrations from slot `20260811000000`, prod apply via the production-migrations workflow, no `db push` |
| 6 | Security threats (§7) | §8 |
| 7 | Performance tests (§8, reference dataset) | §9, AT-203 |
| 8 | Feature flag + rollout | §11 |
| 9 | Rollback / recovery | §12 — including the `Restrict` FK drop ordering |
| 10 | Acceptance tests | §13 |
| 11 | Pilot acceptance owner | **Jay**, with a design-partner contractor — §1.3, §11 step 3, §14 items 4–5 |
| 12 | Production monitoring | Sentry on the new routes (shipped path, no new config); the register p95 in the existing perf series; **the count of registrations past `validTo` still referenced by an approval** as the one C5.4-specific signal worth watching, because it is the failure mode the feature exists to expose; **the count of registrations created per enabled project in the first fortnight**, which is the direct measure of whether §16 item 1's demand assumption was real; and **the count of `(scheme, registration_number)` pairs duplicated across projects**, which is §16 item 10's measurement of what Rev 2's project scoping actually costs and DC5-6c's business case |
| 13 | Exit-gate evidence | §14 |

---

## 18. Verification notes — derived at `e3084475`

### 18.1 Claims this spec corrects or records

**Rev 2 corrections first — these are corrections to *this document*, found by the two reviews and by re-reading at `e3084475`.**

| Rev 1 claim | **Correct at `e3084475`** |
| --- | --- |
| *"Two shipped tests assert `delivery_docket` is the third `EVIDENCE_LINK_GUARDS` entry by position"* (§2.5, `[C54S-B7]`, §18.1, AT-207) | **FALSE.** Both are **comments inside a Prisma mock object literal** — `access.test.ts:10-14`, `deleteRoutes.test.ts:76`. They assert nothing; `grep EVIDENCE_LINK_GUARDS backend/src` returns the definition and two `for…of` consumers, no index read. Appending remains correct on the `GENERIC_VERSIONING_BLOCKS` first-match-precedence argument (`versionRoutes.ts:69`). **The real obligation Rev 1 missed:** both suites mock Prisma **by table name**, so a new guard needs `productRegistration` / `projectMaterialApproval` mocks or both files throw. opus5 `[C54R-A1]`. |
| *"`recorded_by TEXT NOT NULL` … may become null if the user is deleted"* (§5.3) | **IMPOSSIBLE.** Postgres raises `23502`; the FK behaves as a badly-worded `RESTRICT` and surfaces as a 500. `tx.user.delete` is live (`accountDeletionRoutes.ts:175`). The cited precedent is wrong too — `TestResult.verifiedById` is `String?`. Both reviews, independently. §5.2, §5.3, AT-213. |
| *"`superintendent` … is unreachable as an effective project role"* (§0.4) | **OVERSTATED.** `getEffectiveProjectRole` returns `projectUser?.role` **raw** (`projectAccess.ts:169`). It is *unassignable through any shipped write path*; a legacy row would resolve. The design conclusion is unchanged. §0.4, AT-215. |
| *"C5.4d reuses `validateProvenance`, so the gate is mechanical"* (§4.5, §10, §18.2, DC5-7) | **NOT AS SHIPPED.** `validateProvenance` (`registry.ts:512`) and `degradeIfLapsed` (`:119`) are module-private and `Ruleset`-typed; the only export, `validateRuleset` (`:582`), needs `scaleKeys` and `rules`. **And the CI teeth are the sweep** at `registry.test.ts:67`, which a new registry is not covered by. §4.5 now specifies the extraction and the sweep. sol `[C54R-A3]`, opus5 `[C54R-A2]`. |
| *"`20260810000000` and up are free"* (§5) | **STALE.** G5 took `20260810000000_g5_ncr_learning_loop` while this spec was in review. `20260811000000` and up are free, re-verified. Exit-gate item 20 now records the reservation where other waves read it. opus5 `[C54R-N6]`. |
| **Every `schema.prisma` citation between `:844` and `:1200`** | **MOVED, by G5's insertions.** Re-anchored throughout: `HoldPoint` `:844-885` → **`:854-895`**, release attribution `:855-860` → **`:865-870`**; `NCR` `:1065-1155` → **`:1075-1182`**, `linkedTestResultId` `:1074` → **`:1084`**, its relation `:1136` → **`:1161`**, its index `:1151` → **`:1177`**; `NCRLot` `:1157-1167` → **`:1183-1194`**; `NCREvidence` `:1169-1181` → **`:1195-1207`**; `DiaryDelivery` `:1312-1347` → **`:1338-1373`**; `GlobalSubcontractor` `:1397` → **`:1423`**; `ImportMappingProfile` `:2384-2408` → **`:2471-2496`**; `surveyorVerdict` `:2721` → **`:2808`**. The parent spec's own warning — *a reviewer's line numbers are claims, not facts* — applies to a spec's own numbers one merge later. |

**Rev 1's corrections of earlier documents, re-verified at `e3084475` and still true except where re-anchored above.**

| Claim | What was believed | **Correct at HEAD** |
| --- | --- | --- |
| The approver AU civil names is a CIVOS actor | The natural reading of RG-5 | **FALSE, and it reshaped the design.** `superintendent` is not in `ROLES` (`backend/src/lib/roles.ts:6-18`) or `ROLE_HIERARCHY` (`:26-38`). The superintendent is external, reached by emailed token links (`backend/src/routes/copilot/chat/productKnowledge.ts:116`). The literal string in `HP_RELEASE_ROLES` (`backend/src/routes/holdpoints/actionRoutes.ts:65`) and `HP_SUPERINTENDENT_RELEASE_ROLES` (`superintendentRecipients.ts:25-30`) is **vestigial and unassignable through any shipped write path** — *not* "unreachable"; see the Rev 2 correction above. §0.4; the design extends `HoldPoint`'s attribution columns (`schema.prisma:865-870`) rather than copying them, because `HoldPoint` has no transcriber column. |
| `[C5S-B9]`'s "a new `Document` FK owes two registry entries" | Parent spec §4.3, Rev 2 | **It is three at this HEAD.** `EVIDENCE_LINK_GUARDS` (`evidenceLinkGuards.ts:25-112`), `GENERIC_VERSIONING_BLOCKS` (`versionRoutes.ts:70-109`), **and both halves of the project retention guard** (`projects/writeRoutes.ts:44-68` **and** `:692-716`) for a project-scoped table. `[C54S-B7]`. |
| The two guard lists are order-insensitive | Implied | **FALSE.** Two shipped tests assert `delivery_docket` is the **third** `EVIDENCE_LINK_GUARDS` entry by position — `backend/src/routes/documents/access.test.ts:10` and `deleteRoutes.test.ts:76`. C5.4 must **append**. `[C54S-B7]`, AT-207. |
| The parent's `assertDocumentCanUseGenericVersioning` description | Parent §2.3(e)2, §4.3 entry 3 | **Stale in shape, correct in substance.** The probing now lives in a separate `GENERIC_VERSIONING_BLOCKS` array (`versionRoutes.ts:70-109`) with four entries; the function (`:111-128`) iterates it. The parent's substantive point holds and is restated in its own comment at `:62-67`: it **does not read `EVIDENCE_LINK_GUARDS`**. |
| The evidence route is mounted in `backend/src/index.ts` | The natural reading of the parent's §7.1 | **FALSE.** `backend/src/index.ts` is a bootstrap that dynamically imports `./server.js` (`:53`). All mounts are in `backend/src/server.ts` — deliveries at `:159-160`, `:169`; NCRs at `:177`. |
| A delivery register page exists to hang C5.4 UI from | Parent §7.2 | **FALSE.** C5.1 shipped backend-only; `frontend/src/App.tsx` has no deliveries route and no frontend file calls the delivery routes. §2.6, §7.2. |
| `RETAINED_PROJECT_RELATIONS` and the `_count` select are one list | Implied by `[C5R-A7]` | **FALSE — they are two hand-maintained lists**, eighteen members (`:44-68`) versus sixteen (`:692-716`), reconciled by a manual spread at `:724-733`. The declared authority is the const (`:60-64`: *"the `_count` select alone is inert"*). Omitting a member is a compile error; **adding a new table requires editing both by hand**. AT-204. |
| `NCR` is lot-scoped | The natural reading of RG-8 claim 8.15 | **Operationally true, structurally not.** The row hangs off `projectId` (`schema.prisma:1077`); lot association is entirely through `NCRLot` (`:1183-1194`), many-to-many. **`ProjectMaterialApproval` has exactly the same shape for exactly the same reason** (§4.3.1). The research's claim is about the *nonconformance record's grain in practice*, and `open_ncrs` does block per-lot — so 8.15 still validates `NCRLot`. Recorded because a C5.4 reader inferring `NCR.lotId` would write a broken query. |
| `NCR.status` is constrained | Reasonable to assume | **FALSE.** No DB CHECK on `ncrs.status` or `severity` in any migration. The only enumerated list is a query **filter** (`ncrCoreValidation.ts:25-33`); writes are hard-coded literals guarded by conditional `updateMany`. C5.4 does **not** fix this — it is NCR-owned — but a C5.4 author must not assume a constraint exists. |
| There is a company-scoped access helper | Assumed while designing §4.6 | **Only `requireCompanyAdmin` (`backend/src/routes/company/access.ts:6-17`), owner/admin only, synchronous, zero DB I/O.** There is **no `requireCompanyMember`**. **Rev 1 routed *around* the absence and created a scope escalation doing it; Rev 2 stops needing it** (§4.6). The absence is DC5-6c's real price. |
| There is a company delete route | Assumed while designing the retention obligation | **FALSE** — grepped; `companyRouter` (`backend/src/routes/company.ts:52`) has no `.delete`. `Project.company` is `onDelete: Restrict` (`schema.prisma:416`) but there is no route, no guard, no message. §16 item 5. |
| `ITPTemplate` is the company-scoped-library precedent | The natural assumption | **It has no `companyId` at all** (`:680-745`); `projectId == null` means global/seeder-owned. The real precedent is **`ImportMappingProfile`** (`:2471-2496`), the only shipped model with a genuine three-tier null/company/project scope — and it is the shape **DC5-6c** would take, not the shape v1 takes. Its manage-guard *shape* (`itp/templateAccess.ts:57-58`, `:65-73`) is still worth copying. |
| `requireSupersededByInProject` is `drawings.ts:36-65` | Parent spec §2.3(a), §4.5, §7.1, AT-175 — correct at `1e6ed156` | **Drifted one line by `ed202483`: it is `:37-66`**, and the `drawingNumber` identity check the parent (correctly) called the load-bearing one is `:57-60`, not `:56-60`. `:36` is now blank and `:66` is the closing brace. Corrected in this document's three citations. Recorded because the parent's own §19 warns that a reviewer's line numbers are claims, not facts — the same rule applies to a parent spec's, and this is the only drift found across the fourteen citations carried across. |

### 18.2 Observations for whoever builds this — none blocking

1. **The `Ruleset` provenance validator is the mechanism that makes C5.4d self-gating.** `validateProvenance` (`backend/src/lib/readiness/sufficiency/registry.ts:512-575`) fails CI on a `confirmed` pack that is not grade A. A certificate profile authored from claim 6.2's grade-B CCAA paraphrase **cannot ship confirmed**. Do not weaken the validator to make a pack fit; that inverts the control.
2. **`degradeIfLapsed` (`registry.ts:100-122`) is the exact idiom for registration currency** — compute at read, return a derived flag on a copy, persist nothing, treat a malformed date as lapsed. Copy it rather than reinventing; a `revalidationLapsed`-shaped field is documented `RUNTIME-ONLY, never persisted` for the same reason `[C54S-B2]` exists.
3. **`assertLotSufficiencyAttributes`'s header (`lotAttributeValidation.ts:1-24`) is required reading before building C5.4d.** Its predecessor was module-private with one call site, so four of five write paths wrote the value unchecked — **named as a privilege bypass that was invisible afterwards**. Any C5.4d field validation gets one exported choke point, called from every write path.
4. **`NCRLot` has no index on `lotId` alone** — only the composite `@@unique([ncrId, lotId])` (`schema.prisma:1183-1194`). Every lot-scoped NCR query rides that composite's leading column, which is `ncrId`. Not C5.4's to fix, and worth knowing before blaming a C5.4 query for a slow lot page. **`ProjectMaterialApprovalLot` copies `NCRLot`'s shape but adds the missing `@@index([lot_id])`** (§4.3.1), deliberately, so the new lot-grained query does not inherit the known weakness.
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

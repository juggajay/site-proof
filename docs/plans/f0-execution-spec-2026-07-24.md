# F0 Execution Specification — Shared Readiness / Action / Evidence Model

**Date:** 24 July 2026 · **Status:** Draft for review (program of record: Build Strategy Rev 1.2a §2) · **Foundation:** every code claim below is cited in `docs/plans/f0-readiness-foundation-map-2026-07-24.md` (verified at `3d9b4a90`; re-verify line numbers at build time per its own rule).

**Governing principle (Rev 1.2a):** F0 **extends the existing Evidence Readiness engine** — it is not a green-field rewrite, not one linear record, and not a stored `ready` flag. Readiness is computed; evaluation snapshots are persisted only at decision points; consumers are views over one predicate vocabulary.

---

## 1. Outcome, included and excluded behaviour

**Outcome:** one definition of "missing / blocked / overdue / ready" across lot readiness, My Work, test sufficiency, hold-point packages, handover readiness and claim readiness — with decisions and waivers recorded in one auditable vocabulary.

**Included (F0):**
- A single shared **predicate library** replacing the divergent computations catalogued in the foundation map §5 (four "lot ready" definitions, five "hold point released" signals, four "test pending/passing" predicates, drifting NCR-seriousness).
- Re-expression of the two live consumers (lot readiness, claim readiness) over that library with **zero behaviour change**, characterization-tested.
- **Consumer contracts** (typed interfaces + contract tests) for the four future consumers so A4/C1/D1/E2 build against F0 instead of inventing predicates.
- A **decision-write helper** (typed decision/waiver audit actions) unifying how conform/override/release/close decisions are recorded.
- **RequirementEvaluation snapshots** persisted at decision points (conform, claim inclusion, hold-point release, NCR close) — the audit answer to "what did the system believe when this was decided".
- Pagination support on the claim-readiness read path (foundation map §6: currently unbounded).

**Excluded (deliberately, with their owning wave):**
- Spec-driven, DB-authored RequirementDefinitions and the frequency/escalation rule engine → **Wave C1** (F0 ships code-defined requirement sets only).
- The My Work UI and ball-in-court workflow → **A4** (F0 ships its data contract).
- New evidence-link tables for links that don't exist as FKs today (document→requirement) → added when D1 needs them.
- A stored/materialized work-queue or readiness cache → only if F0.5 measurement fails §9 targets (see rollback posture).
- Changing field-visible behaviour of lot auto-progression (map §5 A1#2) → surfaced as a product decision (§13), not silently "fixed".
- Notification/alert redesign → alerts remain the trigger layer; recent hygiene work (#1530–#1544) is untouched.

## 2. Domain model → existing schema mapping

Rev 1.2a's seven entities land on the codebase as follows. **New tables are introduced only where nothing exists** (bold); everything else formalizes what's already there.

| Rev 1.2a entity | F0 realization |
|---|---|
| RequirementDefinition | Code-defined, versioned requirement sets in `backend/src/lib/readiness/requirements/` (e.g. `conformance.v1.ts`): id, source ('system' now; 'spec' reserved for C1), version, applicability, predicate refs. No DB table in F0 — C1 adds authored definitions. |
| RequirementInstance | Derived at evaluation time from (definition × lot/entity context). Not stored in F0 — C1 stores instances when definitions become data. |
| EvidenceLink | The existing FKs, read through one accessor layer: `TestResult.itpChecklistItemId` (+ testType match), `ITPCompletionAttachment`, `NCRLot`, `HoldPoint.itpChecklistItemId`, docket/diary lot FKs. Freshness = "no issue ≠ no evidence" stays explicit in item output (existing `EvidenceReadinessItem` semantics). |
| RequirementEvaluation | **New table `requirement_evaluations`** — snapshot rows written at decision points only (§4). Plus the existing request-time computation (unchanged, now via shared predicates). |
| ActionAssignment | F0 ships the **contract** (typed shape: subject, owner, dueEvent, severity, state) computed from shared predicates; A4 builds storage/workflow if measurement demands it. Dashboards' recomputed "attention" queries migrate onto the same predicates. |
| Decision | `recordDecision()` helper wrapping `writeAuditLogInTransaction` with new frozen `AuditAction` values (`decision_conform`, `decision_conform_override`, `decision_claim_include`, `decision_hp_release`, `decision_ncr_close`, `decision_ncr_concession`) + the existing entity columns (Lot conformed/override trio, HoldPoint release fields, NCR decision columns). AiProposal remains the canonical AI-originated decision; its accept/edit/reject/rollback vocabulary is the model (map §4). |
| ExceptionOrWaiver | Formalized over existing structures: conformance override trio + NCR concession trio, both recorded through `recordDecision(kind: 'waiver', reason, authority, scope)`. A dedicated waiver table is deferred until D1 needs cross-entity waiver listings. |

**The predicate library** (`backend/src/lib/readiness/predicates.ts`, pure, DB-free like `evidenceReadiness/core.ts`): named, documented, single-sourced predicates with **deliberate variants kept as distinct names** — unification means one place with named semantics, not one boolean:
- `holdPointReleased` (status = released — conformance gate) vs `holdPointTerminal` (released|completed — management prep) vs `holdPointOverdue` (requested|scheduled ∧ scheduledDate < now−1d — alerts) vs `holdPointStagnant` (>7d old, not terminal — dashboard aging). Each current call site maps to exactly one (map §5 A2).
- `testPassing` (passFail=pass ∧ status=verified), `testPendingByStatus` (the `PENDING_TEST_RESULT_STATUSES` whitelist), `testMatchesItem` (direct link OR testType). The `claimReview` "not-fail-not-verified" variant is migrated to `testPendingByStatus` — flagged as a **candidate behaviour change** requiring characterization sign-off on edge statuses (§12).
- `ncrOpen` (notIn closed/closed_concession), `ncrOverdue`, `ncrSerious` — **one** seriousness definition (`severity='major'`), retiring the `category==='major'` drift and the dead `'critical'` branch (map open item 3); dashboard call sites migrate with characterization diffs reviewed.
- `lotConformable` (the authoritative `canConform` composition), `lotClaimEligible`.

## 3. Schema & data flow

**New table (one):**
```prisma
model RequirementEvaluation {
  id            String   @id @default(uuid())
  projectId     String   @map("project_id")
  entityType    String   @map("entity_type")   // 'lot' | 'hold_point' | 'ncr' | 'claim_lot'
  entityId      String   @map("entity_id")
  decisionAction String  @map("decision_action") // the AuditAction this snapshot supports
  requirementSet String  @map("requirement_set") // e.g. 'conformance.v1'
  result        Json     // full LotEvidenceReadiness-shaped snapshot (inputs summary + items + states)
  evaluatedAt   DateTime @default(now()) @map("evaluated_at")
  auditLogId    String?  @map("audit_log_id")   // link to the decision's AuditLog row
  @@index([entityType, entityId, evaluatedAt])
  @@index([projectId, decisionAction])
  @@map("requirement_evaluations")
}
```
Immutable (no update path). Written **in the same transaction** as the decision it supports, via `recordDecision()` — mirroring `writeAuditLogInTransaction` and AiProposal's in-transaction apply (map §4). Never written on reads: request-time readiness stays stateless, so a stored snapshot can never go stale as "current readiness" — it is by definition historical.

**Data flow (read path, unchanged shape):** route → fetchers (existing deep selects/batch helpers, incl. `checkConformancePrerequisitesBatch`) → predicate library → item builders (`evidenceReadiness.ts`, now importing predicates instead of inlining them) → buckets → response. `blocksAction` remains the gating flag; `filterCommercialReadiness` unchanged.

**Data flow (decision path, new):** route handler → `recordDecision({ kind, action, entity, actor, reason?, authority })` → (same tx) entity-column updates + AuditLog row + RequirementEvaluation snapshot of the readiness the decider saw.

**Migration:** one additive Prisma migration (new table + new frozen AuditAction values are code-only). Reviewed migration per CLAUDE.md; prod apply via the manual `production-migrations` workflow. No backfill — snapshots exist from enablement onward (stated honestly in audit docs).

## 4. Consumer contracts (the six)

Contract tests live in `backend/src/lib/readiness/contracts/*.test.ts`; each future consumer's contract is a typed interface + fixture-driven test the wave must keep green.

1. **Lot readiness (live):** existing `LotEvidenceReadiness` shape, byte-identical output on the characterization corpus (§12).
2. **Claim readiness (live):** existing `ProjectClaimReadiness` shape, byte-identical, plus optional cursor pagination (`take`/`cursor` params; default = current full-list behaviour so `CreateClaimModal` is untouched until it opts in).
3. **My Work / ActionAssignment (A4):** `getActionAssignments(userId, projectId, filters) → { subjectType, subjectId, title, state: needs_action|waiting_on_me|waiting_on_others|overdue, dueEvent?, severity, primaryAction }[]` — computed from the same predicates that drive dashboard attention counts; contract test pins that a lot blocked for conformance yields exactly one assignment with the same predicate verdict as lot readiness.
4. **Test sufficiency (C1):** `evaluateRequirementSet(setId, context) → EvidenceReadinessItem[]` — C1's rule engine plugs in as additional RequirementDefinition sources; contract pins that a C1-evaluated set emits standard items (no new item grammar).
5. **Hold-point package (E2):** `getHoldPointPackageReadiness(holdPointId) → { holdPoint, dependencies: EvidenceReadinessItem[] }` using `holdPointReleased`/`testPassing`/`ncrOpen` — the MRWA-201 dependency network expressed in standard items.
6. **Handover readiness (D1):** `getHandoverReadiness(projectId, scope) → rollup of per-lot buckets` — pins that handover consumes lot buckets rather than re-deriving.

**Exit gate (Rev 1.2a §2, widened form):** all six contracts green; the two live consumers re-expressed with zero behaviour change; "one definition everywhere" is not claimed until then.

## 5. Permission matrix

| Surface | Guard (unchanged unless noted) |
|---|---|
| `GET /lots/:id/readiness`, `/claim-readiness` | existing `requireAuth` + project membership checks; commercial items stripped via `filterCommercialReadiness` for non-commercial roles |
| RequirementEvaluation rows | no direct read route in F0 (surfaced later through audit/report views); written server-side only |
| `recordDecision` | never callable directly — invoked inside existing guarded handlers (conform: `LOT_FORCE_CONFORMERS` for force; NCR close: segregation-of-duties preserved; HP release: existing role + token paths) |
| ActionAssignment contract | computed per requesting user; respects `actualRole` (RoleSwitcher override), foreman/subbie shells see nothing new (no shell changes in F0) |
| Audit actions | append-only via existing auditLog helpers; no new read exposure |

## 6. Edge cases (specified, tested)

- Already-conformed lot with later evidence regression → `getClaimBlockingReasonsForConformedLot` semantics preserved exactly (subset predicate; override skips ITP/test, never NCR/N-A-hold-point).
- Overridden conformance → readiness reports `already_conformed` with override provenance; snapshot records `decision_conform_override` with reason.
- Hold point `completed` vs `released` → conformance unchanged (released only); management-prep unchanged (terminal); documented in predicate docs.
- Test with `passFail=pass` but status ≠ verified → not passing (both gates); characterization pins `claimReview` edge statuses before/after the pending-predicate migration (§12).
- Lot with zero ITP items / no instance → existing `no_itp`/`no_itp_assigned` items unchanged (navigation mapping depends on those codes).
- Retired/unparseable alert types, dormant projects → out of scope (alert layer, already handled #1530–#1544).
- Decision recorded while readiness computation fails mid-transaction → whole tx rolls back (decision never lands without its snapshot; snapshot write failure = decision failure, surfaced as 500 — deliberate: an unauditable decision must not commit).
- Snapshot JSON size: full readiness for a large lot ~10–40KB; acceptable at decision frequency (hundreds/day worst case); guard with a size assertion in tests.

## 7. Security threats (per Rev 1.2a §7)

- **Cross-tenant leakage via shared library:** predicates are pure; all data enters via existing guarded fetchers — contract tests include a cross-project fixture asserting no row from project B influences project A's evaluation.
- **Snapshot exfiltration:** `requirement_evaluations.result` contains commercial values (budget items) → snapshot stores the **unfiltered** evaluation (audit truth) but any future read surface must re-apply `filterCommercialReadiness`; recorded as a standing requirement in the table's doc comment.
- **Decision forgery:** `recordDecision` derives actor from the authenticated request only (never request body); external hold-point releases keep their token-derived identity model (map §4) — F0 does not weaken it.
- **Audit tamper resistance:** unchanged append-only AuditLog; snapshots immutable; no delete/update routes.

## 8. Performance tests (per Rev 1.2a §8, reference dataset)

Against the production-like reference dataset (5,000 lots, 10k map features):
- Single-lot readiness: **p95 < 400ms** server-side (currently ~9 queries; predicate refactor must not add queries — assert query count in a test with Prisma query logging).
- Claim-readiness, 5,000 lots: measure current full-list baseline; **p95 < 2s** paginated at 500; the unpaginated path documented with its measured ceiling.
- ActionAssignment contract query (per user per project): **p95 < 1s** on the reference dataset.
- Decision-path overhead: snapshot write adds **< 50ms** p95 to conform/release/close endpoints.
- Load test in CI for the two live endpoints at 50 concurrent users (§8 program target).

## 9. Feature flag & rollout

- F0.1–F0.2 (predicate swap + re-expression) are **behaviour-preserving refactors** gated by characterization, not runtime flags.
- Candidate behaviour changes (pending-test predicate unification, NCR-seriousness unification in dashboards) ship behind explicit review: characterization diff presented, then either accepted as intended (documented) or preserved as a named variant. No silent output changes.
- `requirement_evaluations` writes behind env flag `READINESS_SNAPSHOTS_ENABLED` (default on in prod after first verified decision snapshot) — instant off-switch with zero read-path impact.

## 10. Rollback / recovery

- Predicate refactor: revert = git revert (pure code, no data).
- Snapshot table: additive; disable via flag; rows are historical and can remain (immutable) even if disabled.
- Pagination: opt-in params; rollback = consumers stop passing them.
- If measurement (§8) fails: the fallback is **not** a stored `ready` flag — it is (a) query-shape optimization, then (b) short-TTL server cache keyed on entity-updatedAt, decided at that gate with Jay's visibility (Rev 1.2a: stored readiness must never silently go stale).

## 11. Build phases (each independently landable)

- **F0.1** Predicate library + characterization corpus (S–M): extract predicates with zero call-site changes; corpus = recorded outputs of both live endpoints across fixture permutations (seeded + synthetic edge lots).
- **F0.2** Re-express live consumers + migrate divergent call sites (M): `evidenceReadiness.ts`, `claimReview.ts`, `conformancePrerequisites.ts` internals, `evidenceRoutes.ts` inline duplicate (map §5 A5), dashboards' attention predicates, `lotsShellState` mobile derivation — **shell file untouched except import swap; zero visual diff** (hard rule: any shell behaviour change stops for Jay's go).
- **F0.3** Consumer contracts for the four future consumers (S–M).
- **F0.4** `recordDecision` + frozen decision actions + call-site adoption (conform, override, HP release, NCR close/concession, claim include) (M).
- **F0.5** RequirementEvaluation snapshots in decision transactions + flag + measurement (S–M).
- Order: F0.1 → F0.2 → {F0.3, F0.4} parallel → F0.5. A4 may start UI design against the F0.3 contract before F0.5 lands.

## 12. Acceptance tests

- Characterization: both live endpoints byte-identical across the corpus pre/post F0.2 (excluding reviewed, documented candidate changes).
- Contract suite: six consumers green (fixtures for each).
- Decision suite: each decision endpoint writes entity columns + AuditLog + snapshot atomically; forced mid-tx failure leaves no partial state.
- Cross-tenant fixture (§7). Query-count assertions (§8). Snapshot immutability (no update/delete API).
- Full backend + frontend suites + master full E2E green (the suite is now trustworthy — 411/411 as of tonight).

## 13. Open product decisions surfaced (not blocking F0.1–F0.2)

1. **Auto-progression vs conformance gap** (map §5 A1#2): a lot can reach `completed` with no passing test. Keep (field-friendly) or tighten (quality-strict)? F0 centralizes the predicates either way; changing behaviour is Jay's call.
2. **Dashboard staleness semantics** (A2#5): show `holdPointOverdue`, `holdPointStagnant`, or both on dashboards after unification.
3. **`overdue_test` alert type**: wire it in C1 (natural home: sufficiency engine) or delete it in F0.2 cleanup.
4. Docket/diary readiness inputs (hardcoded 0): wire in D1 (handover evidence) or drop from the type in F0.2.

## 14. Monitoring & exit-gate evidence

- Sentry: new named spans for predicate-library evaluation; alert on decision-path p95 breach.
- Log line per snapshot write (entity, action, size, duration) — silent failure is not acceptable for audit writes (write failure fails the decision, §6).
- Exit-gate evidence package: characterization diff report (empty or reviewed), six green contract suites, measured performance table vs §8 targets, prod verification of first real decision snapshot, updated foundation-map addendum for anything the build falsified.
- Pilot acceptance owner: Jay (as first QM-role user) confirms lot-readiness and claim-readiness surfaces unchanged in prod after F0.2.

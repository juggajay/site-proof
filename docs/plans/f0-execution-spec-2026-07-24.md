# F0 Execution Specification — Shared Readiness / Action / Evidence Model (Rev 3)

**Date:** 24 July 2026 · **Rev 2:** 26 July 2026, incorporating the independent dev review of Rev 1 (verdict 7.5/10; ten corrections, tagged `[R2-n]`) · **Rev 3:** 26 July 2026, incorporating the dev review of Rev 2 (verdict 8.5/10; four blockers + smaller corrections, tagged `[R3-n]`) · **Status:** implementation-ready pending no further review objections; F0.2a shipped under Rev 2's explicit allowance; F0.3–F0.5 only under this revision.
**Foundation:** `docs/plans/f0-readiness-foundation-map-2026-07-24.md` (verified at `3d9b4a90`; re-verify line numbers at build time). **F0.1 has shipped** (#1546, predicate library + characterization corpus on master) — phase references below treat it as done `[R2-staleness]`.

**Governing principle (unchanged):** F0 **extends the existing Evidence Readiness engine** — not a rewrite, not one linear record, not a stored `ready` flag. Readiness is computed; snapshots persist only at decision points; consumers are views over one predicate vocabulary.

---

## 1. Outcome, included and excluded behaviour

**Outcome:** one definition of "missing / blocked / overdue / ready" across lot readiness, My Work, test sufficiency, hold-point packages, handover readiness and claim readiness — with decisions and waivers recorded in one auditable, atomic shape.

**Included (F0):**
- The shared predicate library (**shipped**, #1546) and its characterization corpus.
- **F0.2a**: byte-identical re-expression of the two live consumers over the library `[R2-7]`.
- **F0.2b**: the separately-approved intentional unifications (NCR seriousness, pending-test semantics) — each shipped only after its characterization diff is reviewed and explicitly accepted `[R2-7]`.
- Consumer contracts for the four future consumers.
- `recordDecision`: one atomic decision write (entity columns + audit + snapshot in a single transaction; notifications strictly after commit) `[R2-1]`.
- `RequirementEvaluation` snapshots at decision points, with full integrity constraints `[R2-2]`.
- Claim-readiness pagination **including frontend adoption** (`CreateClaimModal`) `[R2-8]`.

**Excluded (unchanged, with owning wave):** DB-authored RequirementDefinitions / rule engine → C1; My Work UI → A4; new evidence-link tables → D1; stored/materialized readiness cache (only if F0.5 measurement fails, decided visibly); auto-progression behaviour change (product decision §13); alert redesign.

## 2. Domain model → existing schema mapping

| Rev 1.2a entity | F0 realization (Rev 2) |
|---|---|
| RequirementDefinition | Code-defined, versioned requirement sets (`backend/src/lib/readiness/requirements/*.v1.ts`). No DB table in F0. |
| RequirementInstance | Derived at evaluation time. Not stored in F0. |
| EvidenceLink | Existing FKs read through one accessor layer (unchanged from Rev 1). |
| RequirementEvaluation | **New table** `requirement_evaluations` — §3, with `[R2-2]` integrity. |
| ActionAssignment | Contract only (A4 builds storage if measured necessary). **Shape corrected `[R2-6]`, invariants fixed `[R3-small]`:** `{ subjectType, subjectId, title, status: 'waiting_on_me'\|'waiting_on_others'\|'done', needsAction: boolean, isOverdue: boolean, dueAt?: ISO, assignee: { kind: 'user'\|'role'\|'company'\|'external'\|'system', id?: string, role?: string }, severity, reasonCode: string (stable, machine-readable, from the predicate item codes), primaryAction }`. **Invariants:** `status` is exhaustive and mutually exclusive ball-in-court relative to the viewer — `needs_action` is NOT a status (that was the Rev 2 overlap): `needsAction` is derived, true iff `status='waiting_on_me'` AND `primaryAction` is executable by the viewer's role. `isOverdue` is orthogonal to `status` — an overdue item can be waiting on me or on others. Assignee kinds `company` (e.g. a subcontractor firm) and `system` (automation) added per review. |
| Decision | `recordDecision()` — **no new audit action vocabulary `[R2-4]`.** Existing actions (`hp_released`, `ncr_qm_approved`, `lot_force_conformed`, claim actions, …) are kept untouched — they have consumers. Decision semantics ride on a structured **`decisionKind`** recorded in `AuditLog.changes.decisionKind` AND as a column on the snapshot: `decisionKind: 'approval' \| 'release' \| 'closure' \| 'concession' \| 'override' \| 'waiver' \| 'inclusion'`. One vocabulary for actions (existing), one orthogonal dimension for decision-ness (new column) — never two competing audit vocabularies. |
| ExceptionOrWaiver | Existing override/concession structures + `decisionKind: 'override'\|'waiver'\|'concession'`. Dedicated table deferred to D1. |

**Actor model `[R2-5]`:** decisions are not always made by authenticated users. `recordDecision` takes a typed actor:
```
actor:
  { kind: 'user',           userId }                           // authenticated request
| { kind: 'external_token', tokenId, displayName, displayOrg } // public HP release: HoldPointReleaseToken row id (tokens are stored sha256-hashed already; the raw token NEVER touches the snapshot)
| { kind: 'system',         subsystem }                        // automation callers
```
Snapshot columns: `actorKind`, `actorUserId?` (FK SetNull), `actorTokenId?` (FK SetNull), `actorLabel` (denormalised display string for external/system). The existing public-release identity capture (foundation map §4: effective vs submitted name) is preserved and referenced, not duplicated.

## 3. Schema & data flow `[R2-2]`

```prisma
model RequirementEvaluation {
  id                  String   @id @default(uuid())
  projectId           String   @map("project_id")
  entityType          String   @map("entity_type")   // 'lot' | 'hold_point' | 'ncr' | 'claim' | 'claim_lot' | 'claim_variation'
  entityId            String   @map("entity_id")     // claim_lot rows: ClaimedLot.id (NOT the lot id); claim_variation rows: Variation.id [R3-3] — there is no claim-variation join row (variations link via Variation.claimedInId, schema.prisma:1485)
  decisionKind        String   @map("decision_kind")
  auditAction         String   @map("audit_action")  // the EXISTING AuditAction recorded alongside
  requirementSet      String   @map("requirement_set")
  resultSchemaVersion Int      @map("result_schema_version") // bump when the snapshot JSON shape changes
  result              Json
  requestKey          String?  @map("request_key")   // client idempotency key when provided
  actorKind           String   @map("actor_kind")
  actorUserId         String?  @map("actor_user_id")
  actorTokenId        String?  @map("actor_token_id")
  actorLabel          String?  @map("actor_label")
  evaluatedAt         DateTime @default(now()) @map("evaluated_at")
  auditLogId          String   @map("audit_log_id")  // REQUIRED — a snapshot always belongs to a decision's audit row

  project    Project                @relation(fields: [projectId], references: [id], onDelete: Cascade)
  auditLog   AuditLog               @relation(fields: [auditLogId], references: [id], onDelete: Restrict)
  actorUser  User?                  @relation(fields: [actorUserId], references: [id], onDelete: SetNull)
  actorToken HoldPointReleaseToken? @relation(fields: [actorTokenId], references: [id], onDelete: SetNull)

  @@unique([auditLogId, entityType, entityId]) // [R3-1] one snapshot per entity per decision — permits a claim decision's aggregate + per-member rows under one audit row while still barring duplicates. (Tighter than the review's suggested [..., requirementSet]: one decision never evaluates one entity under two requirement sets; extend the key only if that ever becomes true.)
  @@unique([entityType, entityId, requestKey]) // request-key replay returns the original, never a duplicate
  @@index([entityType, entityId, evaluatedAt])
  @@index([projectId, decisionKind])
  @@map("requirement_evaluations")
}
```
- **Claim coverage `[R2-3]` `[R3-3]`:** a claim decision snapshots at two grains — one `entityType='claim'` aggregate row (claim id; totals, member counts) plus one row per member (`claim_lot` keyed by `ClaimedLot.id`, `claim_variation` keyed by `Variation.id`). Lot-only, variation-only and mixed claims are all first-class; the aggregate row exists in all three cases.
- **Claim snapshot scale `[R3-3]`:** per-member rows store a **compact verdict** (`resultSchemaVersion`-typed: readiness booleans + blocking reason codes + claimed value, budget ≤ 1 KB serialized — never full evidence dumps; the full evidence detail remains request-time computable from the same predicates). Member rows are written with **chunked `createMany` batches** (e.g. 500 rows per call) inside the decision transaction — a single 5,001-row `createMany` risks database parameter limits (acceptance note, dev review of Rev 3). **Supported/benchmarked ceiling: 5,000 members** (the reference dataset); the F0.5 exit gate includes a measured maximum-size claim decision. The single-entity decision overhead target stays < 50ms p95; **claim decisions get their own target: p95 < 2s at the 5,000-member ceiling** — the flat 50ms target was unmeetable at 5,001 rows and is explicitly revised (review blocker 3).
- **Deletion & retention `[R2-2]`:** rows are immutable (no update/delete API). Project deletion cascades (matching every project-scoped record). `AuditLog` deletion is blocked by the `Restrict` FK — audit rows referenced by snapshots cannot be deleted. Retention: snapshots are compliance evidence and follow the audit-log retention posture (indefinite for now; any future purge must treat audit+snapshot as one unit and is a Jay decision).
- **Atomic decision flow `[R2-1]` `[R3-2]`:** inside ONE transaction: (1) evaluate readiness (reads), (2) entity-column updates, (3) `writeAuditLogInTransaction` (existing action, `changes.decisionKind` added), (4) snapshot insert(s) referencing that audit row. Any failure rolls back all four. **Notifications, emails and webhooks are dispatched strictly after the final successful commit** (post-commit call in the route handler — never inside the transaction), so a rollback or retried attempt can never have produced user-visible signals.
- **Concurrency protection `[R3-2]`:** the decision transaction runs at **`Serializable` isolation with bounded whole-transaction retries** (3 attempts on Prisma `P2034` serialization failure, re-reading readiness fresh each attempt). This covers what the entity-row optimistic guard alone cannot: related evidence (`TestResult`, `ITPCompletion`, `NCRLot`, hold-point dependencies) changing between the readiness read and the commit. The optimistic `updateMany` guard on the decided entity is retained as a cheap second line, but serializable+retry is the correctness mechanism. Retry exhaustion returns **409 with stable code `DECISION_CONFLICT`** (client refreshes readiness and re-decides); a non-conflict snapshot/audit write failure returns **500 with stable code `SNAPSHOT_WRITE_FAILED`** + Sentry — never an anonymous 500 `[R3-small]`.
- **Audit helper change `[R3-small]`:** `writeAuditLogInTransaction` (`backend/src/lib/auditLog.ts:110`, currently `Promise<void>`) is changed to return the created `AuditLog` row (or its id) so the snapshot insert can reference it in-transaction. All existing callers ignore the return value — additive, zero behaviour change.
- Read path unchanged (request-time, stateless, shared predicates).

**Migration:** one additive reviewed migration (table + FKs + uniques; AuditLog gains only a back-relation). Prod apply via the production-migrations workflow.

## 4. Consumer contracts (the six)

Structure unchanged from Rev 1 (contract tests in `backend/src/lib/readiness/contracts/`), with two amendments:
- My Work uses the corrected ActionAssignment shape `[R2-6]`.
- **Claim-readiness pagination contract `[R2-8]`:** cursor = opaque base64 of `(lotNumber, id)` under the stable order `lotNumber ASC, id ASC` (the register's natural order); page metadata `{ items, nextCursor: string | null, total?: number (first page only) }`; `take` capped at 500 server-side; a deleted/invalid cursor returns 400 with stable code `INVALID_CURSOR` and the client restarts from page one. **`CreateClaimModal` adopts pagination in F0.2a** (TanStack `useInfiniteQuery` — v4 API — with "load more"); the unpaginated default remains only for other existing callers during rollout and its removal is an F0.2a exit item, not "later".

Exit gate unchanged: all six contracts green; live consumers byte-identical (F0.2a); no "one definition everywhere" claim before then.

## 5. Permission matrix

Unchanged from Rev 1, plus: snapshot rows carry unfiltered commercial values — any future read surface must re-apply `filterCommercialReadiness`; `recordDecision` derives `actor` server-side (`user` from the session; `external_token` only from the existing token-validation path for public releases; `system` only from in-process automation callers — never from request bodies) `[R2-5]`.

## 6. Edge cases (specified, tested)

Rev 1 list retained (override provenance, released-vs-completed, no-ITP codes, snapshot size guard), plus `[R2-10]`:
- **Concurrent evidence change during a decision `[R3-2]`:** covered by serializable isolation + bounded retry (§3) — including *related* evidence (`TestResult`, `ITPCompletion`, `NCRLot`, hold-point dependencies) changing mid-decision, not only the decided entity's own row. Retry exhaustion → 409 `DECISION_CONFLICT`. Pinned by test with a concurrent related-evidence writer, not just a concurrent entity writer.
- **Request-key replay:** same `(entityType, entityId, requestKey)` returns the original decision result (200 + existing snapshot reference), performs no second write, sends no second notification.
- **Snapshot/audit write failure:** whole transaction rolls back; no entity change, no notification (post-commit only). Pinned by fault-injection test.
- **Cross-project FK mismatch:** snapshot `projectId` must match the decided entity's project; mismatches are 400 before the transaction opens.

## 7. Security threats

Unchanged from Rev 1, plus: `actorTokenId` stores the token ROW id (tokens are sha256-hashed at rest) — raw tokens never touch the snapshot `[R2-5]`; request keys are opaque client strings, size-capped, never interpreted.

## 8. Performance tests

Unchanged targets, plus: paginated claim-readiness measured at pages of 100/500 over the 5,000-lot reference dataset; `CreateClaimModal` first-page render budget p95 < 1s `[R2-8]`; the **single-entity** decision-path overhead budget (< 50ms p95) includes audit row + snapshot insert under the single transaction `[R2-1]`; **claim decisions measured separately: p95 < 2s at the 5,000-member ceiling with `createMany` member snapshots `[R3-3]`**; serializable-retry rate monitored under the concurrency test load (a hot retry loop is a perf failure, not just a correctness event) `[R3-2]`.

## 9. Feature flag & rollout `[R2-9]` (contradiction resolved)

The flag governs **whether decisions require snapshots**, with an explicit sequence — snapshots are never silently optional:
1. **Migrate:** apply the additive migration (prod, reviewed workflow). No behaviour change.
2. **Deploy disabled** (`READINESS_SNAPSHOTS_ENABLED=false`): no snapshot rows are written; `recordDecision` stamps `changes.snapshotSkipped: true` into the decision's AuditLog row — the audit gap is itself recorded and countable. **`[R3.1-R1]` Corrected claim (F0.4b plan review): flag-disabled adoption is NOT byte-identical to today.** Every current decision route writes its audit via post-commit best-effort `createAuditLog` (failures swallowed); adoption moves the audit write inside the transaction and makes it hard-fail — "decided but unaudited" stops being a reachable state. That is a deliberate integrity improvement, stated in every F0.4b PR body, and Serializable isolation introduces a new 409 `DECISION_CONFLICT` surface on routes that never returned one. Request-key replay via `recordDecision` is snapshot-backed and therefore INERT while the flag is off — routes with existing idempotency machinery (claim create's `(projectId, requestKey)` unique + P2002 race path) keep their own mechanism untouched through F0.4b; nothing migrates onto `recordDecision` replay until F0.5 enables snapshots `[R3.1-B2]`.
3. **Verify:** flip the flag for a controlled window, execute one real low-stakes decision on prod, verify the snapshot row by direct query (the established verification ritual).
4. **Enable permanently:** from this point snapshot failure **blocks the decision** (rollback, 500, Sentry alert). Disabling again is an incident action, not a tuning knob: it re-enters step-2 semantics (gaps recorded via `snapshotSkipped`), requires a logged reason, and the gap count appears in the F0.5 exit-gate evidence.
- F0.2a/F0.2b remain flag-free (characterization-gated refactors).

## 10. Rollback / recovery

Rev 1 posture, amended `[R2-9]`: the snapshot requirement cannot be quietly rolled back once decisions depend on it — recovery from snapshot-write failure is fixing the fault; the disable path exists solely for incident containment with gaps recorded as above. Predicate refactors remain plain git reverts.

## 11. Build phases `[R2-7]` `[R2-staleness]`

- **F0.1 — DONE** (#1546): predicate library + characterization corpus, merged.
- **F0.2a** (M): byte-identical re-expression of live consumers + divergent call-site migration onto named predicates, zero behaviour change, snapshot corpus as the gate. Includes the claim-readiness cursor API + `CreateClaimModal` adoption `[R2-8]`. Shell files: import swap only, zero visual diff.
- **F0.2b** (S, separately approved): the intentional unifications (NCR seriousness → `severity='major'`; pending-test semantics → single predicate). One PR per unification, each landing with its characterization diff attached and explicitly accepted in review; independently revertible. **Carried from F0.2a:** removal of the unpaginated claim-readiness default — shipped F0.2a (#1556) kept the legacy no-param full-list response for existing callers; auditing those callers and removing the legacy path moves here (honest scope note, not silently marked done).
- **F0.3** (S–M): consumer contracts for the four future consumers (ActionAssignment shape + invariants per `[R3-small]`). Was gated on the ActionAssignment overlap — resolved in this revision.
- **F0.4a** (M) `[R3-4]`: the additive migration (snapshot table ships HERE, not F0.5 — this removes the Rev 2 circularity where `recordDecision` needed a table scheduled later), the `writeAuditLogInTransaction` return change, and `recordDecision` itself (serializable+retry, typed actors, snapshot insert) **behind the flag, deployed disabled** (`snapshotSkipped` recorded). Before build starts: re-verify the foundation map's line citations at current HEAD and stamp the fresh SHA in the PR body `[R3-small]`.
- **F0.4b** (M) `[R3-4]` `[R3.1]`: call-site adoption of the decision routes, still flag-disabled — six PRs per the accepted adoption-plan review:
  - **PR 0 (prep, no routes):** `backend/src/lib/readiness/requirements/*.v1.ts` — the `requirementSet` names, `resultSchemaVersion: 1` result payload types for `lot_conformance` / `hold_point_release` / `ncr_closure` / `claim_readiness` / `claim_member` (built on `contracts/reasonCodes.ts`; member rows ≤1KB, aggregate = counts/totals only, never member-id arrays, ≤64KB) `[R3.1-B3]`; plus the `recordDecision` API addition `entityCreatedByMutate?: true` (skips the pre-transaction project-scope check and the requestKey-persistability assert for decisions that CREATE their entity — claim create) `[R3.1-B1]`.
  - **PR 1:** lot conform + force-conform + override-status (de-conform IS in scope). `decisionKind: 'override'` for both force-conform and de-conform — the §12 "waiver" wording was a spec self-contradiction, resolved: `waiver` is reserved for future explicit requirement waivers `[R3.1-B4]`. Conform additionally gains its first optimistic guard (documented behaviour change).
  - **PR 2:** NCR close + close-by-concession + qm-approve (the lot-cascade status read moves inside `evaluate(tx)`).
  - **PR 3:** HP release authenticated + public single-token (splits `runHoldPointReleasePostCommit`: audit moves in-tx, notifications/emails/webhooks stay post-commit; actor label = per-token `recipientName`, never email).
  - **PR 4:** HP public batch — **ONE `recordDecision` call per batch with N `hold_point` snapshot rows under ONE audit row** `[R3.1-R4]` (the schema's aggregate+members design; supersedes today's N uncorrelated audit rows, which was itself a defect — the affected pinned test updates its expected audit count with this rationale). The batch's N-fold duplicate notification volleys are a known pre-existing defect fixed separately, NOT in F0.4b.
  - **PR 5:** claim create (aggregate + `claim_lot`(ClaimedLot.id) + `claim_variation`(Variation.id) snapshots; existing retry loop UNIFIED with `recordDecision`'s — one classifier, never stacked; existing replay preserved per `[R3.1-B2]`).
  - Cross-cutting: each PR deletes its route's post-commit `createAuditLog` (nine sites), states the new 409 surface, updates concurrency tests to accept `400|409` WITHOUT dropping exactly-one-audit-row assertions, and notes that authorization reads stay outside the transaction (the no-stale-readiness guarantee covers evidence, not permissions) `[R3.1-R6]`.
- **F0.5** (S–M) `[R3-4]`: flag-sequence steps 3–4 (verify on prod, enable permanently) + measurement incl. the maximum-size claim benchmark. **F0.4a onward gated on this Rev 3 being accepted.**
- Order: F0.2a → {F0.2b, F0.3} → F0.4a → F0.4b → F0.5. **F0.3 runs alongside F0.2b, not behind it** (contract work has no dependency on the behaviour unifications; acceptance note, dev review of Rev 3). A4 UI design may start against the F0.3 contract.

## 12. Acceptance tests `[R2-10]`

Rev 1 suite, expanded to cover:
- Concurrent evidence changes during decisions: (a) concurrent write to the decided entity, (b) **concurrent write to related evidence** (`TestResult` / `ITPCompletion` / `NCRLot`) mid-transaction — serialization failure → bounded retry → fresh evaluation; retry exhaustion → 409 `DECISION_CONFLICT` `[R3-2]`.
- HP release decisions via all three actor paths: authenticated, public single-token, public batch (review room) — each snapshotting the correct actor.
- Normal conformance AND overridden conformance (waiver decisionKind, reason captured).
- NCR closure and closure-by-concession (segregation-of-duties preserved).
- Lot-only, variation-only and mixed claims — aggregate + per-member snapshots each correct; `claim_lot` rows keyed by `ClaimedLot.id`, `claim_variation` rows keyed by `Variation.id` `[R3-3]`.
- **Maximum-size claim** (5,000 members): decision succeeds inside its p95 < 2s budget, all member rows present, compact-verdict size budget held `[R3-3]`.
- **Snapshot JSON version decoding:** a row written at `resultSchemaVersion: 1` decodes correctly after the shape moves to version 2 (reader dispatches on the version column) `[R3-small]`.
- Request-key replay (no duplicate writes/notifications; original result returned).
- Audit-write and snapshot-write fault injection (full rollback, no post-commit signals).
- Cross-project FK mismatch rejection.
- Feature flag enabled and disabled (skip-marker recorded when disabled; blocking when enabled).
- Pagination: page boundaries, final page, deleted/invalid cursor (`INVALID_CURSOR` + restart), order stability under concurrent inserts.
- Characterization: byte-identical for F0.2a; reviewed-diff-only for F0.2b.

## 13. Open product decisions (unchanged)

1. Auto-progression vs conformance strictness gap. 2. Dashboard staleness semantics (overdue vs stagnant). 3. `overdue_test` alert type: wire in C1 or delete. 4. Docket/diary readiness inputs (hardcoded 0): wire in D1 or drop.

## 14. Monitoring & exit-gate evidence

Rev 1 list, plus: `snapshotSkipped` gap count in exit evidence `[R2-9]`; per-actor-kind decision counts (sanity: external decisions only ever HP releases); replay-rejection counter. Pilot acceptance owner: Jay.

---

**Review history:** Rev 1 (24 Jul) reviewed by independent dev 26 Jul — verdict 7.5/10, ten corrections (`[R2-1]`…`[R2-10]`) applied in Rev 2. Rev 2 reviewed by the same dev at `ed723de3` — verdict 8.5/10, four blockers: snapshot-uniqueness contradiction with claim grains `[R3-1]`, incomplete concurrency protection `[R3-2]`, claim snapshot scale + the nonexistent claim-variation row `[R3-3]`, circular F0.4/F0.5 sequencing `[R3-4]` — plus smaller corrections (`[R3-small]`: audit-helper return type, ActionAssignment invariants, company/system assignees, stable recoverable error codes, added tests, fresh foundation SHA before F0.4a). Rev 3 (this document) applies all of them. **F0.2a shipped and merged (#1556) under Rev 2's allowance — the dev's board assessment confirmed it could continue independently.** F0.2b needs per-change approval of each intentional behaviour diff; F0.3 unblocked by the ActionAssignment invariant fix; F0.4a–F0.5 gated on Rev 3 acceptance. **Rev 3 ACCEPTED by the dev at `23109f35` (26 Jul): all four blockers resolved; two non-blocking notes folded in above (chunked `createMany`; F0.3 parallel to F0.2b); implementation-ready.** Rev 3.1 (same day): F0.4a shipped (#1563 + #1565 raw-SQL-guardrail fix; prod migration applied and verified); the Opus 5 F0.4b adoption-plan review (5.5/10, five blockers) is folded in as `[R3.1-*]` — claim-create API fit, requirement-set payload vocabulary (PR 0), override-vs-waiver resolution, batch = one decision with N snapshot rows, and the corrected §9 step-2 behaviour claim.

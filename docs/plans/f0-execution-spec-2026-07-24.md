# F0 Execution Specification — Shared Readiness / Action / Evidence Model (Rev 2)

**Date:** 24 July 2026 · **Rev 2:** 26 July 2026, incorporating the independent dev review (verdict 7.5/10; all ten required corrections applied below, each tagged `[R2-n]`) · **Status:** implementation-ready pending no further review objections; F0.2a may proceed immediately (review's explicit allowance), F0.4–F0.5 only under this revision.
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
| ActionAssignment | Contract only (A4 builds storage if measured necessary). **Shape corrected `[R2-6]`:** `{ subjectType, subjectId, title, status: 'needs_action'\|'waiting_on_me'\|'waiting_on_others'\|'done', isOverdue: boolean, dueAt?: ISO, assignee: { kind: 'user'\|'role'\|'external', id?: string, role?: string }, severity, reasonCode: string (stable, machine-readable, from the predicate item codes), primaryAction }`. `isOverdue` is orthogonal to `status` — an overdue item can be waiting on me or on others. |
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
  entityId            String   @map("entity_id")     // claim_lot rows: ClaimedLot.id (NOT the lot id); claim_variation rows: the claim-variation row id
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

  @@unique([auditLogId])                       // idempotency: exactly one snapshot per decision audit row
  @@unique([entityType, entityId, requestKey]) // request-key replay returns the original, never a duplicate
  @@index([entityType, entityId, evaluatedAt])
  @@index([projectId, decisionKind])
  @@map("requirement_evaluations")
}
```
- **Claim coverage `[R2-3]`:** a claim decision snapshots at two grains — one `entityType='claim'` aggregate row (claim id; totals, member counts, per-member readiness verdicts) plus one row per member (`claim_lot` keyed by `ClaimedLot.id`, `claim_variation` keyed by the claim-variation row). Lot-only, variation-only and mixed claims are all first-class; the aggregate row exists in all three cases.
- **Deletion & retention `[R2-2]`:** rows are immutable (no update/delete API). Project deletion cascades (matching every project-scoped record). `AuditLog` deletion is blocked by the `Restrict` FK — audit rows referenced by snapshots cannot be deleted. Retention: snapshots are compliance evidence and follow the audit-log retention posture (indefinite for now; any future purge must treat audit+snapshot as one unit and is a Jay decision).
- **Atomic decision flow `[R2-1]`:** inside ONE transaction: (1) evaluate readiness (reads), (2) entity-column updates, (3) `writeAuditLogInTransaction` (existing action, `changes.decisionKind` added), (4) snapshot insert referencing that audit row. Any failure rolls back all four. **Notifications, emails and webhooks are dispatched strictly after commit** (post-commit call in the route handler — never inside the transaction), so a rollback can never have produced user-visible signals.
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
- **Concurrent evidence change during a decision:** evaluation reads and entity writes share one transaction; the entity write is an optimistic guard (`updateMany` pinning prior state, per the escalation pattern) — a conflicting concurrent update fails the transaction and the decider retries against fresh readiness. Pinned by test.
- **Request-key replay:** same `(entityType, entityId, requestKey)` returns the original decision result (200 + existing snapshot reference), performs no second write, sends no second notification.
- **Snapshot/audit write failure:** whole transaction rolls back; no entity change, no notification (post-commit only). Pinned by fault-injection test.
- **Cross-project FK mismatch:** snapshot `projectId` must match the decided entity's project; mismatches are 400 before the transaction opens.

## 7. Security threats

Unchanged from Rev 1, plus: `actorTokenId` stores the token ROW id (tokens are sha256-hashed at rest) — raw tokens never touch the snapshot `[R2-5]`; request keys are opaque client strings, size-capped, never interpreted.

## 8. Performance tests

Unchanged targets, plus: paginated claim-readiness measured at pages of 100/500 over the 5,000-lot reference dataset; `CreateClaimModal` first-page render budget p95 < 1s `[R2-8]`; the decision-path overhead budget (< 50ms p95) now includes audit row + snapshot insert under the single transaction `[R2-1]`.

## 9. Feature flag & rollout `[R2-9]` (contradiction resolved)

The flag governs **whether decisions require snapshots**, with an explicit sequence — snapshots are never silently optional:
1. **Migrate:** apply the additive migration (prod, reviewed workflow). No behaviour change.
2. **Deploy disabled** (`READINESS_SNAPSHOTS_ENABLED=false`): decisions behave exactly as today; `recordDecision` additionally stamps `changes.snapshotSkipped: true` into the decision's AuditLog row — the audit gap is itself recorded and countable.
3. **Verify:** flip the flag for a controlled window, execute one real low-stakes decision on prod, verify the snapshot row by direct query (the established verification ritual).
4. **Enable permanently:** from this point snapshot failure **blocks the decision** (rollback, 500, Sentry alert). Disabling again is an incident action, not a tuning knob: it re-enters step-2 semantics (gaps recorded via `snapshotSkipped`), requires a logged reason, and the gap count appears in the F0.5 exit-gate evidence.
- F0.2a/F0.2b remain flag-free (characterization-gated refactors).

## 10. Rollback / recovery

Rev 1 posture, amended `[R2-9]`: the snapshot requirement cannot be quietly rolled back once decisions depend on it — recovery from snapshot-write failure is fixing the fault; the disable path exists solely for incident containment with gaps recorded as above. Predicate refactors remain plain git reverts.

## 11. Build phases `[R2-7]` `[R2-staleness]`

- **F0.1 — DONE** (#1546): predicate library + characterization corpus, merged.
- **F0.2a** (M): byte-identical re-expression of live consumers + divergent call-site migration onto named predicates, zero behaviour change, snapshot corpus as the gate. Includes the claim-readiness cursor API + `CreateClaimModal` adoption `[R2-8]`. Shell files: import swap only, zero visual diff.
- **F0.2b** (S, separately approved): the intentional unifications (NCR seriousness → `severity='major'`; pending-test semantics → single predicate). One PR per unification, each landing with its characterization diff attached and explicitly accepted in review; independently revertible.
- **F0.3** (S–M): consumer contracts for the four future consumers (corrected ActionAssignment shape).
- **F0.4** (M): `recordDecision` + typed actors + atomic flow + call-site adoption (conform, override, HP release incl. public and public-batch token paths, NCR close/concession, claim create/include). **Gated on this Rev 2 being accepted.**
- **F0.5** (S–M): snapshots + flag sequence + measurement. **Gated likewise.**
- Order: F0.2a → F0.2b → {F0.3, F0.4} → F0.5. A4 UI design may start against the F0.3 contract.

## 12. Acceptance tests `[R2-10]`

Rev 1 suite, expanded to cover:
- Concurrent evidence changes during decisions (optimistic-guard rollback + retry).
- HP release decisions via all three actor paths: authenticated, public single-token, public batch (review room) — each snapshotting the correct actor.
- Normal conformance AND overridden conformance (waiver decisionKind, reason captured).
- NCR closure and closure-by-concession (segregation-of-duties preserved).
- Lot-only, variation-only and mixed claims — aggregate + per-member snapshots each correct; `claim_lot` rows keyed by `ClaimedLot.id`.
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

**Review history:** Rev 1 (24 Jul) reviewed by independent dev 26 Jul — verdict 7.5/10, ten corrections required before F0.4–F0.5. Rev 2 (this document) applies all ten (`[R2-1]`…`[R2-10]`) plus staleness fixes. Dev reviewed the file on `origin/master` at `591d731a` (their local checkout was stale — the file wasn't present locally; same trap recorded in tasks/lessons.md).

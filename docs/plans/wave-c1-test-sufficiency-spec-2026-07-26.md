# Wave C1 Execution Specification — Test Sufficiency Rules Engine + Gates

**Date:** 26 July 2026 · **Rev 1:** authored 26 Jul (`da847c55`) · **Rev 2:** 26 Jul, incorporating the Opus 5 adversarial review of Rev 1 (verdict **6/10**; 12 blockers `[C1R-B1]`…`[C1R-B12]`, 15 recommendations `[C1R-1]`…`[C1R-15]`, 12 cleared items, D1–D10 verdicts) · **Status:** implementation-ready pending no further review objections and the Jay decisions in §16.0.
**Program contract:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` §3 Wave C (line 75), governed by §9 (delivery control), §6 (completion standards), §7 (security), §8 (scale targets).
**Research register:** `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md` §A. Claims are cited **by claim text, not row ordinal** in this revision `[C1R-6]`.
**Foundation:** `docs/plans/f0-execution-spec-2026-07-24.md` (Rev 3.1). F0 is complete and live on prod. C1 extends it; no parallel engine.
**House style:** matches `docs/plans/wave-b-migration-importer-spec-2026-07-26.md` (Rev 2).

**All `file:line` citations were read in this worktree at HEAD `3fe7eadd` (= `origin/master`).** Every citation the reviewer supplied was independently re-verified before folding; two were found wrong and are refuted in §17.2 rather than encoded. Re-verify line numbers at build time — the F0 staleness lesson applies.

---

## 0. Rev 2 changelog — where each review finding landed

| Tag         | Finding                                                                                                   | Landed in                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `[C1R-B1]`  | `computeConformanceResult` is pure/sync; six fields + a relation not fetched                              | §2.2, §4.1, §5.1 (resolved-inputs parameter, `lotConformable` signature, separate warning builder, exact `select`/`include` extensions)    |
| `[C1R-B2]`  | Conformed/claimed lots early-return — the payoff is unreachable                                           | §5.1.3 (surface chosen: extend the conformed short circuit), §5.3 (hard prohibition), §11 C1.1 (corpus regenerated), §16 D11 (Jay-visible) |
| `[C1R-B3]`  | `resultSchemaVersion: 2` renames `requirement_set` on a live immutable table                              | §5.4 (no bump; optional always-emitted key at v1), §14 (the ~10 assertions), §13 (rollback)                                                |
| `[C1R-B4]`  | Folded member block busts the 1 KB budget → 500s claim create, flag-off                                   | §5.4.2 (aggregate only: state + count + worst shortfall), §12 (unbounded-rule-count assertion)                                             |
| `[C1R-B5]`  | Draft rulesets are both `unknown` and "evaluated"; day one shows nothing                                  | §4.2 (`ruleset_edition_unconfirmed` deleted), §7.1 (draft evaluates normally), §5.1.2 (structural `blocksAction` expression)               |
| `[C1R-B6]`  | Index on free-text `activityType` cannot serve a folded-slug stream key                                   | §6 (`Lot.activitySlug` stored + backfilled, index `[projectId, activitySlug, conformedAt]`), §16 D7 (layer limb decided)                   |
| `[C1R-B7]`  | No cursor ⇒ wrong regime for every already-conformed lot; regime read inside the serializable tx          | §3.4.3 (two-mode query contract, resolved outside the transaction, length guard), §14 (both modes + guard tested)                          |
| `[C1R-B8]`  | Failure side is status-unqualified; `reduced` has no authority-sourced counts                             | §3.4.2 (status-qualified failure), §3.2 + §8.2 (`reduced` structurally absent from `vicroads-204.v1` + CI assertion)                       |
| `[C1R-B9]`  | `overdue_test` has a live write path and a fail-closed read path                                          | §2.7 + §16 D10 (migration-safety steps, `byType` shape change, both `AlertType` declarations)                                              |
| `[C1R-B10]` | No bulk path for quantity/scale; bulk create untouched ⇒ dead launch                                      | §2.6, §6, §9.1, §11 C1.1                                                                                                                   |
| `[C1R-B11]` | R44 grade misstated; confirmation sequenced after encoding                                                | §8.1 (grade corrected to `'C'`), §8.3 (confirmation moved to C1.0/C1.1), §15.1 exit item 1, §16.0 (Jay-visible)                            |
| `[C1R-B12]` | Permission matrix, rollback/recovery, acceptance tests, pilot metrics, field-workflow standard all absent | §10.2, §13, §14, §15.2, §15.3                                                                                                              |
| `[C1R-1]`   | `max()` is a no-op for everything C1 ships; illustration invented                                         | §3.2.1, §16 D4, §17.2 (sourcing claim partially refuted)                                                                                   |
| `[C1R-2]`   | `TestReasonCode` is an `Extract<>` that cannot carry the new code                                         | §4.2.1, §14 AT-2                                                                                                                           |
| `[C1R-3]`   | `Lot.areaZone` catalogued then dropped                                                                    | §3.2 (`appliesTo.areaZoneAliases`)                                                                                                         |
| `[C1R-4]`   | Per-production-day dropped with no owning wave                                                            | §1 non-goals (assigned to C2)                                                                                                              |
| `[C1R-5]`   | "Fix the file path"                                                                                       | **REFUTED** — §17.2                                                                                                                        |
| `[C1R-6]`   | Appendix ordinals off by one, twice                                                                       | Header + §8 (cite by claim text)                                                                                                           |
| `[C1R-7]`   | Scope the 6/3 counts to compaction                                                                        | §8.2                                                                                                                                       |
| `[C1R-8]`   | Legal caveat has no owner/date/gate                                                                       | §15.1 exit item 10                                                                                                                         |
| `[C1R-9]`   | Confirmation edits `.v1` in place — F0 forbids it                                                         | §8.3 (confirmation emits `.v2`)                                                                                                            |
| `[C1R-10]`  | Registry route self-exempts from tenant-isolation testing                                                 | §10.1, §14 AT-19                                                                                                                           |
| `[C1R-11]`  | "0 queries" needs fields not selected today                                                               | §12 ("0 _additional_ queries")                                                                                                             |
| `[C1R-12]`  | Characterization corpus does not cover the conform gate                                                   | §11 C1.1, §14 AT-14                                                                                                                        |
| `[C1R-13]`  | Index lock; Wave B migration has already landed                                                           | §6, §11 (B/C serialization now trivial)                                                                                                    |
| `[C1R-14]`  | `RequirementEvaluation` has a second unique key                                                           | §5.4.1 (strengthens fold-over-widen)                                                                                                       |
| `[C1R-15]`  | Exit item 6 is unobservable through the panel                                                             | §15.1 exit item 7                                                                                                                          |

Cleared items `[C1R-C1]`…`[C1R-C12]` are not re-argued; two carry positive obligations and are promoted: `[C1R-C5]` into §5.1.1, `[C1R-C11]` into §17.1.

---

## 1. Outcome, scope and non-goals

**Outcome:** a contractor asks "does this lot have **enough** passing tests?" and CIVOS answers with a number, a rule citation and a plain-English explanation — before the lot is covered, conformed or claimed. Today the answer is existential ("is there at least one passing verified test per test-required ITP item?", `conformancePrerequisites.ts:437-441`); C1 makes it quantitative and spec-keyed, and makes the shortfall visible at the three moments where it costs money.

**The wedge (program §1, line 15):** CivilPro already _configures_ test frequencies. C1's differentiator is the **proactive gate** — a shortfall surfaced at pre-cover / conform / claim rather than discovered at handover — plus the honest degradation of §7 (a lot with no recorded quantity says "I cannot check", never "you're fine").

**Included (C1):**

- A declarative, versioned **frequency-rule vocabulary** (§3.2): per-lot minimum count by scale · per-quantity coverage · maximum lot size (advisory) · the escalate/de-escalate **frequency-regime state machine**.
- A **pure evaluator** producing an F0-shaped verdict over the existing `reasonCode` vocabulary (§4), satisfying and widening the already-declared `TestSufficiencyVerdict` contract (`contracts/futureConsumers.ts:27-37`).
- **Resolution** of ruleset + scale + quantity + regime, fetched **per path and passed into** the pure gate (§5.1.1) — the `releasedHoldPointItemIds` pattern already in the file.
- **Surfacing** in the shipped lot-readiness surface (`GET /api/lots/:id/readiness`, `qualityRoutes.ts:265`; `LotReadinessPanel.tsx:267`) — no new page, no new panel — **including for already-conformed and claimed lots** (§5.1.3).
- **Gates** at three decision points (§5): conform (block, opt-in per project), hold-point request/release = the pre-cover moment (warn, never block), claim inclusion (warn, never block).
- **Seed packs**: VicRoads Section 204 + one TfNSW ruleset, with the **confirmation pass performed before encoding** (§8.3).
- **Snapshot provenance** inside the existing `RequirementEvaluation` snapshot written by `recordDecision` (`recordDecision.ts:423`), as an optional always-emitted key at `resultSchemaVersion: 1` (§5.4).
- **Bulk entry** for quantity/scale (§9.1) — without it the engine has no data and the launch is dead `[C1R-B10]`.

**Non-goals (explicit — do not build in C1):**

- **C2 sample lifecycle** — planned sample → request → sampled → lab pending → certificate → extraction → verification → recalc; certificate-to-sample reconciliation; overdue-lab chasing; external lab upload link. C1 counts `TestResult` rows that already exist; it never models a sample.
- **Per-production-day frequency limbs — owned by C2** `[C1R-4]`. Nothing in CIVOS records "this lot is one day's production", and the natural place to learn it is the sample/production record C2 builds. C1 evaluates only the area limb of a lot-size cap (§3.3) and never a per-day count.
- **C3 spatial + LIMS** — tested/under-tested map overlay, TfNSW LIMS tabulated ingestion, and user-authored/overridable rulesets (program line 77). C1 rulesets are shipped code, not tenant data.
- **C4 evidence integrity** — duplicate certificate/sample detection, preliminary-vs-final, anomaly flags. C1 counts distinct `TestResult` rows and does **not** detect that two rows describe the same sample (§7.2).
- **C5 survey/material traceability.**
- **Statistical acceptance computation.** TfNSW R44's Characteristic Density Ratio with k-values is a statistic over result _values_, not a count of them. C1 encodes only the **n = 6 minimum sample count** and computes no CDR (§16 D8).
- **Test-register import** — deferred past Wave C per program §9.
- **New alert types.** Sufficiency surfaces in readiness, not as a new alert stream into the 3,669-row backlog A2 is burning down (program line 64).
- **Automatic compliance declarations.** Every output is decision support with a clause citation attached.
- **No shell changes.** No file under `frontend/src/shell/` changes. A foreman-facing indicator is valuable and is **Jay-gated** — out of scope, not silently omitted.

---

## 2. Current-state map (cited, read at `3fe7eadd`)

### 2.1 The F0 backbone C1 builds ON

| Concern                      | Where                                                      | Note                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Predicate library            | `lib/readiness/predicates.ts`                              | `testPassing` = `passFail === 'pass' && status === 'verified'` (L149-151). `testMatchesItem` (L202-208): `itpChecklistItemId` link strongest, case-insensitive `testType` equality the legacy fallback. `lotConformable` (L324-332) is the authoritative conform composition. `lotClaimEligible` (L355-361) names the claim-blocking set. |
| Closed reasonCode vocabulary | `contracts/reasonCodes.ts:29-72`                           | 41 codes, **closed**: "If the engine gains a code, add it here (and its provenance) in the same change; the contract test fails otherwise" (L26-27).                                                                                                                                                                                      |
| Contract test teeth          | `contracts/contracts.test.ts:59-64`                        | Asserts every non-`engine` provenance predicate is a real export of `../predicates.js`. Load-bearing for §4.3.                                                                                                                                                                                                                            |
| Test-sufficiency contract    | `contracts/futureConsumers.ts:22-37`                       | `TestReasonCode = Extract<ReadinessReasonCode, 'no_passing_verified_test' \| 'no_tests' \| 'failed_tests' \| 'pending_tests' \| 'passing_tests'>` — **an `Extract<>`, so it cannot carry a new code until widened** `[C1R-2]`. `TestSufficiencyVerdict` is explicitly marked extensible (L34-36).                                         |
| Atomic decision writer       | `lib/readiness/recordDecision.ts:423`                      | Serializable + bounded retry; caller-supplied `evaluate` / `mutate` / `snapshots`.                                                                                                                                                                                                                                                        |
| Snapshot size enforcement    | `recordDecision.ts:151`, `:154`, `:248-270`, called `:453` | `MEMBER_RESULT_MAX_BYTES = 1024`; `RESULT_MAX_BYTES = 64 KB`. `assertSnapshotSizes` measures `Buffer.byteLength(JSON.stringify(row.result))` **per row**, **throws 500 `SNAPSHOT_WRITE_FAILED`**, no truncation, and its doc comment states it "runs regardless of the flag".                                                             |
| Snapshot table               | `schema.prisma:1690-1725`                                  | Immutable. **Two** unique keys: `@@unique([auditLogId, entityType, entityId])` (`:1719`) and `@@unique([entityType, entityId, requestKey])` (`:1721`) `[C1R-14]`.                                                                                                                                                                         |
| Requirement-set modules      | `requirements/*.v1.ts`                                     | `shared.ts:41` `blockingReasonCodes`, `:61` `decodeAtVersion1` (**hard-throws** on any version ≠ 1), `:75` `truncateReasonText`.                                                                                                                                                                                                          |
| Version/name coupling        | `requirements/requirements.test.ts:95-108`                 | `expect(set.name.endsWith('.v' + set.version)).toBe(true)` **and** `expect(set.version).toBe(1)`. Bumping a version forces a `requirement_set` **name string** change in a live immutable column `[C1R-B3]`.                                                                                                                              |
| Aggregate built from members | `requirements/claimReadiness.v1.ts:46`                     | `buildClaimReadinessResultV1(members: readonly ClaimMemberResultV1[])` — a member-payload change drags the aggregate into the diff and is **silently ignored** unless the aggregate is taught about it.                                                                                                                                   |
| The unique-key note C1 tests | `docs/plans/f0-execution-spec-2026-07-24.md:72`            | "extend the key only if that ever becomes true." §5.4 resolves it without widening.                                                                                                                                                                                                                                                       |

### 2.2 The plug-in point is pure and sync — and the data is NOT all fetched `[C1R-B1]`

Rev 1 §5.1 said sufficiency "becomes a new prerequisite limb inside `computeConformanceResult`", and Rev 1 §4.1 headed its input table "all already fetched, except the three new lot fields". **Both were wrong.** Verified:

| Constraint                                                                                  | Where                                                                                                                                                                                                    | Consequence                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The gate is **pure and synchronous by design**                                              | `conformancePrerequisites.ts:374-382` — the M39 comment: "Pure (DB-free) conformance computation… so the single path and the batched create-claim path produce byte-identical results from one place"    | Sufficiency cannot query from inside it. Making it async destroys the batch path's constant-query guarantee and (per `[C1R-B7]`) puts a history read inside the serializable transaction. |
| Its client type has no `project`                                                            | `conformancePrerequisites.ts:9` — `type ConformancePrismaClient = Pick<typeof prisma, 'holdPoint' \| 'lot'>`                                                                                             | Even the per-path fetch helpers cannot reach `project` through this client.                                                                                                               |
| `CONFORMANCE_LOT_INCLUDE` has **no `project` and no `geometries`**                          | `conformancePrerequisites.ts:316-353`                                                                                                                                                                    | `Project.state`, `Project.specificationSet`, `Project.testSufficiencyMode`, `LotGeometry.areaM2` are all absent on **both** conformance paths.                                            |
| The readiness path uses `select:`, and takes only `project: { select: { settings: true } }` | `qualityRoutes.ts:109-127`                                                                                                                                                                               | `Lot.activityType`, `Lot.layer`, `Lot.areaZone` and the new columns are **also** absent on the readiness path.                                                                            |
| Parity is asserted on every permutation                                                     | `predicates.parity.test.ts:1-9` — "assert `lotConformable(result.prerequisites)` reproduces `result.canConform` on every permutation. If this ever diverges, the predicate has drifted from the source." | Anything entering `canConform` must enter **both** the `ConformancePrerequisites` shape and `lotConformable`.                                                                             |
| The blocker builder is contractually the five gate conditions                               | `evidenceReadiness/conformanceItems.ts:64-68` — "the five conditions the conform gate enforces (`lotConformable`), and nothing else."                                                                    | A `warn`-severity sufficiency item cannot live there. §5.1.4 adds a separate warning builder.                                                                                             |

The fix is the pattern already in the file: `releasedHoldPointItemIds` is fetched per path (`:494` single, `:557-582` batch) and passed **into** the pure function `[C1R-C5]`. §5.1.1 does the same for sufficiency.

### 2.3 Conformed and claimed lots early-return `[C1R-B2]`

`buildConformanceItems` (`evidenceReadiness.ts:28-79`) returns a **single support item and nothing else** for:

- `lot.status === 'claimed'` → `lot_already_claimed` (`:32-43`);
- `lot.status === 'conformed'` with `getClaimBlockingReasonsForConformedLot(...).length === 0` → `lot_already_conformed` (`:45-61`).

So Rev 1's headline argument for computing rather than storing the regime — "those lots immediately report a shortfall" — was **unreachable through the surface Rev 1 chose**. §5.1.3 fixes the surface.

And the tempting workaround is a trap: `getClaimBlockingReasonsForConformedLot` (`conformancePrerequisites.ts:166-207`) feeds `lotClaimEligible`'s blocking set (`predicates.ts:355-361` — any non-empty `conformanceBlockingReasons` returns `false`). Routing sufficiency through it would make retroactive shortfalls **un-claim** previously claimable lots, violating §5.3. §5.3 states the prohibition.

### 2.4 Today's test gate — existential, not quantitative

| Concern                        | Where                                      | Behaviour                                                                                                                                               |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which ITP items require a test | `conformancePrerequisites.ts:250-256`      | `isRequiredTestItem` = `evidenceRequired === 'test' \|\| Boolean(testType)`.                                                                            |
| Per-item satisfaction          | `conformancePrerequisites.ts:258-270`      | `.some()` — one matching passing verified test satisfies the item, however large the lot.                                                               |
| Lot-level gate                 | `conformancePrerequisites.ts:437-441`      | `hasPassingTest = requiredTestItems.length > 0 && requiredTestItems.every(...)`. **The ceiling C1 raises: `every` over items, `some` over tests.**      |
| Outstanding-test breakdown     | `conformancePrerequisites.ts:276-311`      | Per-item states `no_result \| awaiting_verification \| failing \| unmatched_result_exists`. C1 adds a count dimension and reuses this shape.            |
| Tests the gate already fetches | `conformancePrerequisites.ts:327-335`      | `testResults { id, itpChecklistItemId, testType, passFail, status }` — enough to count. **No new per-lot test query.**                                  |
| Single + batch entry points    | `conformancePrerequisites.ts:520`, `:543`  | `checkConformancePrerequisites` and `checkConformancePrerequisitesBatch` (one `lot.findMany` + at most one `holdPoint.findMany`) — C1 must extend both. |
| Blocker items                  | `evidenceReadiness/conformanceItems.ts:68` | `buildConformanceBlockerItems`; the test blocker `no_passing_verified_test` is L104-122 with a structured `outstandingTests[]`.                         |
| Pending-test whitelist         | `lib/testResultStatus.ts:1-8`              | pending, submitted, requested, at_lab, results_received, entered.                                                                                       |

### 2.5 Ruleset-keying data that already exists

| Key                                 | Where                                                                                                                                                 | Note                                                                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Authority / spec set                | `schema.prisma:373-374`                                                                                                                               | `Project.state` and `Project.specificationSet`, both required Strings.                                                                   |
| Spec-set normalization              | `itpMatcher.ts:74-83`                                                                                                                                 | `SPEC_SET_SYNONYMS = { rms: 'tfnsw' }`; `normalizeSpecSet` lowercases + folds. **Reused, never re-implemented** `[C1R-C7]`.              |
| National baselines                  | `itpMatcher.ts:96`                                                                                                                                    | `{austroads, aus-spec, ipwea, wsa, national}` — no authority frequency ruleset ⇒ `unknown`, never `insufficient`.                        |
| Activity taxonomy                   | `activityTaxonomy.ts:61` (38 Level-2 slugs / 10 families), `:286-297` (`foldActivityValue`)                                                           | The fold is many-to-one through `CANONICAL_SLUG_SET`, `LEGACY_FOLD` and a **case-insensitive** `LEGACY_FOLD_CI`.                         |
| **`Lot.activityType` is free text** | `schema.prisma:556`; validated only as `requiredTextSchema('activityType', MAX_SHORT_TEXT_LENGTH)` at `routes/lots/validation.ts:112`, `:174`, `:249` | **Never constrained to `CANONICAL_ACTIVITIES`.** An index on this column cannot serve a folded-slug key `[C1R-B6]` — §6 stores the slug. |
| Layer / material zone               | `schema.prisma:552-553`                                                                                                                               | `Lot.layer`, `Lot.areaZone` — free text (`bulkCreateCore.ts:33`).                                                                        |
| Test-type vocabulary                | `routes/testResults/specifications.ts:23-`                                                                                                            | 13 keys with `specificationMin/Max` and a `specReference`. What rules bind to.                                                           |
| Quantity, where it exists           | `schema.prisma:492-493`                                                                                                                               | `LotGeometry.areaM2` ("computed; user-overridable"), `lengthM`. Spatially-defined lots only.                                             |

### 2.6 Bulk paths that must carry the new fields `[C1R-B10]`

| Surface                  | Where                                | Note                                                                                                                                                                                                                                           |
| ------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bulk lot **create** core | `routes/lots/bulkCreateCore.ts:1-12` | Its own header: the shared core behind `POST /api/lots/bulk` **and the copilot `lot_breakdown` apply handler** — i.e. the primary way lots are actually created. Untouched by Rev 1, so every future lot is born with NULL scale and quantity. |
| Bulk mutation routes     | `routes/lots/bulkMutationRoutes.ts`  | `bulk-update-status`, `bulk-assign-subcontractor`, `bulk-delete`; guard `assertLotsBulkMutable` at `:74` and `:182` (`bulkMutationGuards.ts:22`).                                                                                              |

### 2.7 `overdue_test` is not inert `[C1R-B9]`

| Path                  | Where                                                                                                                                                                                                                           | Consequence of a naive removal                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Live write**        | `POST /api/notifications/alerts` → `alerts.ts:118` `parseAlertType(req.body.type)` → `:170` `createAlertRecord` → `alertPersistence.ts:43`                                                                                      | Any `ALERT_TYPES` member, including `overdue_test`, is creatable in production **today**.                                                                 |
| **Fail-closed read**  | `parseAlertType` (`alertMappers.ts:55-60`) **throws** `AppError.badRequest` on an unknown type; called unconditionally from `toAlert` (`:103`), mapped over the whole list in `GET /api/notifications/alerts` (`alerts.ts:269`) | **One legacy row turns the alerts list into a 400 for that project.**                                                                                     |
| Duplicate declaration | `notificationAlertConfig.ts:8` **and** `alertMappers.ts:22`                                                                                                                                                                     | Both must change.                                                                                                                                         |
| Public response shape | `systemAlertResponses.ts:56`                                                                                                                                                                                                    | Removing the key changes the `byType` response shape.                                                                                                     |
| Escalation scan       | `notificationAlertConfig.ts:33` `ALERT_ESCALATION_CONFIG` → `notificationAutomation/alertEscalations.ts:16` `ESCALATABLE_TYPES` → `:228` `type: { in: ESCALATABLE_TYPES }`                                                      | Narrows the escalation `IN` list. (The reviewer cited `alertEscalations.ts` without its `notificationAutomation/` directory; the line numbers are right.) |
| Tests                 | `alertMappers.test.ts:53`, `alertPersistence.test.ts:71-94` (whole-object `toEqual`), `systemAlertResponses.test.ts:64`, `:75`                                                                                                  | Four assertions to update.                                                                                                                                |

Cleared in D10's favour: **no Prisma enum, no migration**, zero frontend references, no saved user preference keyed to it.

---

## 3. Domain model — how a sufficiency ruleset is represented

### 3.1 Placement: code, not database

Rulesets are **code-defined, versioned TypeScript modules**, exactly as F0 realises `RequirementDefinition` (`f0-execution-spec-2026-07-24.md:29`: "Code-defined, versioned requirement sets … No DB table in F0"). F0 lists "DB-authored RequirementDefinitions / rule engine → C1" as excluded-with-owning-wave (`:23`) — C1 owns the **rule engine**; it deliberately does not take the _DB-authored_ half.

Why code: a seeded authority ruleset is shipped product data with provenance, not tenant data. It must be reviewable in a PR diff, CI-testable, and revertable by `git revert`. Versioning is free (`vicroads-204.v1.ts` beside `.v2.ts`). Tenant-authored / overridable rulesets are explicitly C3 (program line 77) — building a definition table in C1 for a C3 requirement is speculative.

`ponytail:` code-defined rulesets, zero ruleset DDL. The DB gets a definition table when C3 needs tenant overrides, not before.

```
backend/src/lib/readiness/sufficiency/
  types.ts            # rule vocabulary + provenance (§3.2)
  registry.ts         # resolve (state, specSet, activitySlug, layer, areaZone, date) -> ruleset
  regime.ts           # the frequency-regime lookback + fold (§3.4)
  resolve.ts          # per-path input resolution, DB-touching (§5.1.1)
  evaluate.ts         # PURE: resolved inputs -> SufficiencyVerdict (§4)
  rulesets/
    vicroads-204.v1.ts
    tfnsw-r44.v1.ts
    index.ts          # explicit static imports; NOT dynamic (unlike the ITP seeders)
```

### 3.2 The rule vocabulary (PROPOSED)

```ts
/** Authority provenance. Every field required — an unprovenanced rule cannot be registered. */
export interface RulesetProvenance {
  authority: string; // 'VicRoads' | 'TfNSW'
  document: string; // 'Section 204 — Earthworks'
  edition: string; // 'December 2015, Version 7'
  clause: string; // '204.14(c)' — clause/table, never prose
  pdfPage?: number; // recorded at the confirmation pass (§8.3)
  sourceUrl: string;
  /**
   * From the research appendix. A SPLIT grade (e.g. R44's "A (portal) / C (aetg)")
   * is encoded at its WEAKEST limb — the grade of the source the NUMBERS came
   * from, never the strongest limb available [C1R-B11].
   */
  evidenceGrade: "A" | "B" | "C" | "D";
  checkedOn: string; // ISO date a human last read the source
  revalidateBy: string; // ISO; CI fails a `confirmed` ruleset past this (§8.3)
}

export type QuantityUnit = "m2" | "m3" | "t" | "m" | "each";

export interface FrequencyRule {
  /** Stable, referenced by snapshots forever: 'vicroads-204.v1/compaction-density'. */
  id: string;
  /** Short factual label. NEVER a quotation of specification prose (§8.4). */
  label: string;
  /** Test-type key from `routes/testResults/specifications.ts`. */
  testType: string;
  appliesTo: {
    activitySlugs: readonly string[]; // Level-2 slugs (activityTaxonomy.ts:61)
    layerAliases?: readonly string[]; // case-insensitive match against Lot.layer
    /** [C1R-3] Material/zone discrimination, e.g. 'under paved areas'. */
    areaZoneAliases?: readonly string[];
  };
  /** Statistical-validity floor, per scale. Scale key set is ruleset-defined. */
  minCountByScale: Readonly<Record<string, number>>;
  /**
   * Coverage limb: one test per `every` units. OPTIONAL and, for everything C1
   * ships, ABSENT — no cited authority in the appendix supplies a per-area
   * frequency figure [C1R-1]. The limb exists because the program names it
   * (line 75) and because a confirmed edition may supply one; it ships
   * unexercised, covered by a synthetic rule only (§14 AT-4).
   */
  perQuantity?: { unit: QuantityUnit; every: number };
  /** Advisory only: the ruleset's maximum lot size. Never blocks (§3.3). */
  maxLotSize?: { unit: QuantityUnit; value: number };
  /**
   * The de-escalated regime. STRUCTURALLY ABSENT unless a CONFIRMED edition
   * supplies reduced figures [C1R-B8] — the appendix supplies the 204.14(c)
   * TRIGGER ("test every lot until 3 consecutive conform → reduced frequency;
   * any failure reverts to full testing") and NO reduced count. A guessed
   * reduced count would emit a confident wrong required count, the exact defect
   * §3.4 exists to prevent. CI asserts `reduced` cannot exist on a `draft`
   * ruleset (§8.3).
   */
  reduced?: {
    minCountByScale: Readonly<Record<string, number>>;
    perQuantity?: { unit: QuantityUnit; every: number };
    consecutiveConformingLots: number;
    /** The only escalation shape C1 implements (§3.4.1). */
    escalationShape: "reset_on_any_failure";
  };
  provenance: RulesetProvenance;
}

export interface Ruleset {
  id: string; // 'vicroads-204.v1'
  state: string; // matched case-insensitively against Project.state
  specSet: string; // pre-normalized via itpMatcher.normalizeSpecSet
  scaleKeys: readonly string[]; // what a lot may declare
  /** Applied when Lot.testScale is null (§16 D6). Absent = no default. */
  defaultScale?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  /**
   * 'draft'     — registered and EVALUATED NORMALLY, numbers shown, citation
   *               tagged unconfirmed; structurally cannot block (§5.1.2).
   * 'confirmed' — a human verified every number against the cited edition (§8.3).
   */
  status: "draft" | "confirmed";
  rules: readonly FrequencyRule[];
  provenance: RulesetProvenance;
}
```

#### 3.2.1 Required count `[C1R-1]`

```
requiredCount = max( minCountByScale[scale],
                     perQuantity ? ceil(quantity / perQuantity.every) : 0 )
```

The `max` is the right reading of a statistical-validity floor (§17.2 records the exact sourcing). **But it is a no-op for everything C1 ships**: no rule in either seed pack carries a `perQuantity` limb, because no cited authority in the appendix supplies a per-area frequency figure. The arithmetic is specified so a confirmed edition can supply one without a redesign, and it is tested against a synthetic rule only (§14 AT-4). Rev 1's illustrative "1-test-per-500 m²" was invented and is withdrawn.

Consequence, stated plainly: **`Lot.quantityValue` / `quantityUnit` are dead weight for C1 counting** — they serve only the lot-size advisory of §3.3. They ship because §3.3 needs the area, because bulk entry (§9.1) is cheapest to build once, and because the C2/C3 limbs will need them — not because a C1 count depends on them. `[C1R-1]`, §16 D5.

### 3.3 "Whichever is the lesser" is a lot-SIZING rule, not a count rule

The appendix's claim is _"Type A lot = one day's production or 5,000 m², whichever is the lesser"_ — that constrains lot size, not test count. CIVOS has no production-day record (§2.5; per-day limbs are C2 per `[C1R-4]`), so the day limb is unevaluable and C1 says so. Only the area limb is evaluated, as `maxLotSize`, and only as a **warning**:

> `lot_exceeds_max_lot_size` — "This lot is 7,400 m². VicRoads Sec 204 Table 204.142 caps a Type A lot at 5,000 m² (or one day's production, whichever is lesser — CIVOS cannot check the production-day limb). Consider splitting the lot."

It never blocks: the lot already exists, and blocking punishes a decision already taken. The "≤ 500 m² under paved areas" limb is a second `maxLotSize` on the rule whose `appliesTo.areaZoneAliases` matches paved-area zones `[C1R-3]`.

### 3.4 The frequency-regime state machine — COMPUTED, never stored

#### 3.4.1 Why computed, and the bounded reduction

F0's principle is "readiness is computed, never a stored `ready=true` flag — a stored value must not silently go stale when evidence is superseded" (F0 spec `:6`). The 204.14(c) regime is sequential, which looks like state. It is computed anyway, because a stored regime would be **wrong**:

> A test on lot 2 is later corrected to `fail`. A stored regime on lots 5–12 would still read "reduced", and every one would keep reporting 3 tests required where the authority requires 6 — invisible until handover, the precise defect Wave C exists to prevent. A computed regime re-derives on the next read.

_(Rev 1 added "…which is `conformance_no_longer_current` semantics the claim gate already implements." **That sentence is deleted** — `[C1R-B2]` proved it would route sufficiency into an action-blocking path. §5.3 forbids it.)_

Naive folding over a 5,000-lot stream would be O(n) and is unnecessary. For the only shape C1 implements (`reset_on_any_failure`):

> _Claim._ Regime is `reduced` iff the stream has **at least N** entries in the lookback window **and** the last N are all conforming.
> _Proof sketch._ Full → reduced requires N consecutive conforming entries. Any failure resets to full and discards accumulated credit, so re-entry requires N fresh consecutive conforming entries. Therefore `reduced` holds iff no failure occurred in the last N entries **and at least N entries exist**. ∎

The **length guard is part of the rule, not a footnote** `[C1R-B7]`: without it, `[].every(...)` is vacuously true and the first lot of every project reads `reduced`. It appears in the implementation sentence, in §14 AT-6, and — critically — the fold-vs-lookback property test only catches the bug if the **reference fold independently implements the guard**; §14 AT-7 says so.

`ponytail:` bounded N-row lookback, valid for `reset_on_any_failure` only. A ruleset declaring a different `escalationShape` gets its own evaluator; the registry **rejects an unknown shape** rather than silently mis-evaluating it.

#### 3.4.2 Stream membership and entry conformity

- **Stream key:** `(projectId, rulesetId, ruleId, activitySlug, layerBucket)`. "Work of the same type in the same project" is the defensible reading; subcontractor and material source are not in the key (§16 D7).
- **`layerBucket`:** for a rule with `layerAliases`, the matched alias; for a layer-agnostic rule, the constant `'*'`. A lot with a **NULL layer is a member of the layer-agnostic stream only**, never of a layer-discriminated rule's stream (§16 D7).
- **Stream order:** `conformedAt ASC, createdAt ASC, id ASC` — a total order, so the cursor of §3.4.3 is well-defined.
- **Membership requires a resolved slug.** A lot whose `activitySlug` is NULL (fold confidence `none` or `family`) is **not a stream member**, and its presence inside another lot's window makes that window **incomplete** — §16 D7 records the decision and the argument.
- **Entry conformity** = the lot conformed **and** has no _status-qualified_ failing test attributable to the rule. Status-qualified means the mirror of `testPassing` `[C1R-B8]`:

```ts
// predicates.ts (new, mirrors testPassing at :149-151)
export function testFailing(t: TestResultRow): boolean {
  return t.passFail === "fail" && t.status === "verified";
}
```

Rev 1 said "no `passFail === 'fail'` test result" with **no status filter**, which was asymmetric: a rejected or never-verified failure would permanently reset a stream while a pass must clear verification to count. `TestResult` carries `rejectedById` / `rejectedAt` / `rejectionReason` and `status` defaults to `'requested'` (`schema.prisma:846-853`), so unverified failures are a real population. Symmetry restored.

- **A force-conformed lot** (`Lot.conformanceOverriddenAt`, `schema.prisma:568`) is **non-conforming for regime purposes**. An override is a programme decision, not evidence the material passed. Deliberate, and recorded in the snapshot.

#### 3.4.3 The query contract — two modes, resolved OUTSIDE the transaction `[C1R-B7]`

Rev 1 said "`take: N`, ordered descending" for all cases. That is right for a lot being conformed now and **wrong for every already-conformed lot** — for those, "the most recent N" returns today's last N lots, not the N preceding that lot. Silently wrong `requiredCount` on the historical path, which is the commercial path. Two modes:

| Subject                                                           | Query                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `conformedAt IS NULL` (being conformed now, or not yet conformed) | No cursor. `where: { conformedAt: { not: null }, ...streamFilter }`, `orderBy: [{conformedAt:'desc'},{createdAt:'desc'},{id:'desc'}]`, `take: N`.                                                                                                      |
| `conformedAt IS NOT NULL` (already conformed / claimed)           | **Strictly-before compound cursor** over the full total order: `cursor: { id: subjectLotId }` + `skip: 1` with an `orderBy` matching the total order — **not** a simple `lt` on `conformedAt`, which is wrong whenever two lots share a `conformedAt`. |

Both modes are pinned by §14 AT-5 and AT-6.

**Where it runs: outside the serializable transaction.** `evaluate` runs inside it (`qualityRoutes.ts:464-465`) and `mutate` writes `conformedAt` (`:487-492`). A regime read placed there is a predicate read over exactly the range concurrent conforms write, guaranteeing 40001/P2034 retries for concurrent conforms in one activity stream. The regime derives from **history**, and F0's own precedent puts history-shaped reads outside: "Authorization reads stay OUTSIDE the decision transaction: the no-stale-readiness guarantee covers EVIDENCE, not permissions" (`qualityRoutes.ts:414-416`, F0 `[R3.1-R6]`).

So the regime is resolved **before** `recordDecision` opens its transaction and passed in as data — which `[C1R-B1]`'s resolved-inputs parameter already requires. The honest cost: the regime can be one commit stale relative to a concurrent conform in the same stream. That is bounded and lands in the safe direction — a stale regime is either `full` when `reduced` was just earned (over-testing) or `reduced` when a concurrent failure just reverted it, and the latter is caught on the next read by the retroactive re-derivation of §3.4.1. Trading a guaranteed retry storm for a one-commit staleness window is the right trade, recorded rather than hidden.

---

## 4. Rule evaluation — inputs, outputs, plug-in points

### 4.1 Inputs — resolved per path, passed in as data `[C1R-B1]`

Rev 1's "all already fetched" claim is withdrawn (§2.2). The resolved bundle is:

```ts
/** Everything the PURE evaluator needs. Resolved by `resolve.ts` per path. */
export interface ResolvedSufficiency {
  mode: "off" | "warn" | "block"; // Project.testSufficiencyMode
  ruleset: Ruleset | null; // null => no ruleset for this project/activity
  rules: readonly FrequencyRule[]; // the subset matching activity/layer/areaZone
  scale: { value: string | null; source: "lot" | "ruleset_default" | "none" };
  quantity: {
    value: number | null;
    unit: QuantityUnit | null;
    source: "lot" | "geometry" | "none";
  };
  /** Per rule id. Absent entry => regime unresolvable for that rule. */
  regimeByRuleId: ReadonlyMap<
    string,
    { regime: "full" | "reduced"; basisLotIds: string[] }
  >;
}
```

| Input                                                                                      | Where it comes from                                                               | Fetch change required                                          |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Lot's own tests                                                                            | `conformancePrerequisites.ts:327-335` (existing `testResults` select)             | **none**                                                       |
| Required ITP items                                                                         | `conformancePrerequisites.ts:250-256` `isRequiredTestItem`                        | **none**                                                       |
| Test attribution to a rule                                                                 | `predicates.ts:202-208` `testMatchesItem` + direct `TestResult.testType` equality | **none** — reuses the shipped matcher, no second match rule    |
| `Project.state` / `specificationSet` / `testSufficiencyMode`                               | `Project`                                                                         | **new** — see §4.1.1                                           |
| `Lot.activitySlug` / `layer` / `areaZone` / `testScale` / `quantityValue` / `quantityUnit` | `Lot`                                                                             | **new** — see §4.1.1                                           |
| `LotGeometry.areaM2` fallback                                                              | `LotGeometry`                                                                     | **new** — see §4.1.1                                           |
| Regime                                                                                     | `sufficiency/regime.ts` (§3.4.3)                                                  | **new**, one grouped query per stream, outside any transaction |

A test counts toward rule R iff `testPassing(t)` **and** (`t.itpChecklistItemId` links an item whose `testType` normalizes to `R.testType`, **or** `normalize(t.testType) === R.testType`).

#### 4.1.1 The exact fetch extensions, per path `[C1R-B1]`

**Path A — conformance (single + batch).** `CONFORMANCE_LOT_INCLUDE` (`conformancePrerequisites.ts:316-353`) gains:

```ts
// added to CONFORMANCE_LOT_INCLUDE
project: { select: { state: true, specificationSet: true, testSufficiencyMode: true } },
geometries: { select: { areaM2: true, lengthM: true } },
```

…and `LotForConformance` (`:358-372`) gains `activitySlug`, `layer`, `areaZone`, `testScale`, `quantityValue`, `quantityUnit` (all already on the row — the interface simply stops omitting them; `include` returns scalars by default). `ConformancePrismaClient` (`:9`) is **unchanged**. `[C1R-B1]` correctly notes it is `Pick<typeof prisma, 'holdPoint' | 'lot'>` with no `project` — that constrains nothing here, because the widened `include` rides the existing `lot` delegate (`lot.findUnique({ include: { project: … } })`) and the regime query is also a `lot` query. Recorded so a build agent does not widen the client type unnecessarily.

**Path B — readiness.** `fetchLotReadinessRecord` (`qualityRoutes.ts:109-127`) uses `select:`, so each field must be named:

```ts
// added to fetchLotReadinessRecord's select
activitySlug: true, layer: true, areaZone: true,
testScale: true, quantityValue: true, quantityUnit: true,
project: { select: { settings: true, state: true, specificationSet: true, testSufficiencyMode: true } },
geometries: { select: { areaM2: true, lengthM: true } },
```

Both paths then call `resolveSufficiency(...)` (which owns the registry lookup and the regime query) and pass the result **into** `computeConformanceResult(lot, releasedHoldPointItemIds, sufficiency)` — the third parameter, mirroring `releasedHoldPointItemIds` exactly `[C1R-C5]`. `computeConformanceResult` stays **sync and DB-free**; the M39 byte-identity guarantee (`:374-379`) survives because both paths feed it the same shape.

The batch path (`checkConformancePrerequisitesBatch`, `:543`) resolves sufficiency for all lots with **one grouped regime query per distinct stream**, never per lot — the same collapse it already performs for `holdPoint.findMany` (`:557-582`).

### 4.2 Outputs — three-valued, over the F0 vocabulary

```ts
export type SufficiencyState = "satisfied" | "insufficient" | "unknown";

export interface RuleSufficiency {
  ruleId: string;
  testType: string;
  state: SufficiencyState;
  requiredCount: number | null; // null only when state === 'unknown'
  passingCount: number;
  pendingCount: number;
  failedCount: number;
  regime: "full" | "reduced" | null;
  regimeBasis?: { streamKey: string; lotIds: string[] };
  unknownCauses: readonly UnknownCause[];
  citation: {
    authority: string;
    document: string;
    clause: string;
    edition: string;
    /** false for a `draft` ruleset — the carrier for "unconfirmed", NOT an UnknownCause. */
    confirmed: boolean;
  };
}

export type UnknownCause =
  | "no_ruleset_for_project" // national-baseline spec set, or no pack for this authority
  | "no_rule_for_activity" // ruleset exists, no rule matches activity/layer/zone
  | "activity_not_canonical" // activitySlug NULL (fold 'family' | 'none')
  | "scale_not_selected" // scale-keyed rule, no lot scale and no ruleset default
  | "scale_not_recognised" // Lot.testScale not in ruleset.scaleKeys
  | "quantity_missing"; // rule has a perQuantity limb, no quantity resolvable
```

**`ruleset_edition_unconfirmed` is deleted from `UnknownCause` `[C1R-B5]`.** Rev 1 contradicted itself three ways: §4.2 made draft an `UnknownCause` (⇒ `requiredCount: null`), §7's table called draft "evaluated, but", and §4.4's specimen sentence showed real counts _and_ an "unconfirmed" tag. Since **both** shipped packs may be draft, the Rev 1 wiring produced a launch where a user picks a scale, enters an area, and still gets nothing. Draft now **evaluates normally** — numbers shown, `citation.confirmed: false` — and non-blocking is made structural in §5.1.2 instead.

#### 4.2.1 The contract widening `[C1R-2]`

`TestReasonCode` is an `Extract<>` (`futureConsumers.ts:22-27`) and **cannot carry `insufficient_test_count`** until widened. C1.0 widens the `Extract<>` union and extends `TestSufficiencyVerdict`:

```ts
export interface TestSufficiencyVerdict {
  subjectType: "lot" | "itp_item";
  subjectId: string;
  sufficient: boolean; // true iff EVERY rule is 'satisfied'
  reasonCodes: TestReasonCode[]; // widened union
  // C1 additions, OPTIONAL so the shipped contract fixture keeps compiling [C1R-2]:
  state?: SufficiencyState;
  rules?: RuleSufficiency[];
}
```

`state` and `rules` are **optional**, not required: `contracts.test.ts:140-150` constructs a `TestSufficiencyVerdict` with only the four original keys, and making the additions required would break that fixture for no benefit. The real implementation always populates both; §14 AT-2 asserts it does.

`sufficient: false` for an `unknown` verdict — **unknown never reads as satisfied.** It also never blocks (§7).

### 4.3 New reason codes (extend the CLOSED vocabulary — required, not optional)

`READINESS_REASON_CODES` (`reasonCodes.ts:29-72`) is closed and contract-tested. C1.0 adds five codes **and their provenance entries in the same change**, or CI fails:

| New code                     | Severity                      | Meaning                                                        |
| ---------------------------- | ----------------------------- | -------------------------------------------------------------- |
| `insufficient_test_count`    | blocker or warning per §5.1.2 | Required N, have M passing verified.                           |
| `test_sufficiency_unknown`   | warning                       | One or more `UnknownCause` — names the missing input.          |
| `lot_exceeds_max_lot_size`   | warning                       | §3.3, never blocks.                                            |
| `tests_unlinked_to_itp_item` | warning                       | Passing tests exist that no rule could attribute.              |
| `test_sufficiency_met`       | support (positive)            | The satisfied case, so the panel shows the proof, not silence. |

**Provenance and the contract test.** `contracts.test.ts:59-64` asserts every non-`engine` predicate name is a real export of `../predicates.js`. So `predicates.ts` gains **two** exports: the new `testFailing` (§3.4.2) and one re-export:

```ts
// predicates.ts — the sufficiency evaluator's boolean limb, re-exported so the
// provenance map can cite a real predicate-library export (contracts.test.ts:59).
export { testCountSufficient } from "./sufficiency/evaluate.js";
```

No test is weakened and no provenance entry is dishonestly tagged `'engine'`.

### 4.4 Plain-English explanation

Facts only. Counts and clause references; no quotation of specification prose (§8.4); the unconfirmed tag whenever `citation.confirmed === false`; the regime sentence only when the rule has a `reduced` limb, always naming its basis:

> **Not ready to conform.** Requires **6** density tests (VicRoads Sec 204, Table 204.142, Scale B — 2015 edition, **unconfirmed**). **4** verified conforming, **1** pending at lab, **1** without a result.

The chainage clause Rev 1 showed ("no sample for CH 1,240–1,310") is **removed** — it needs per-test location data C1 does not have (§7.2). It returns with C3.

---

## 5. Decision points and gate strength

### 5.1 Conform — BLOCK, opt-in per project

`POST /api/lots/:id/conform` runs through `recordDecision` (`qualityRoutes.ts:446`) with `evaluate` calling `checkConformancePrerequisites(id, tx)` inside the serializable transaction (`:464-465`) and rejecting when `!canConform && !force` (`:472-477`).

#### 5.1.1 Where the limb goes

Sufficiency enters `computeConformanceResult` as its **third parameter** (`ResolvedSufficiency | null`), resolved per path before the call (§4.1.1). The function stays sync and DB-free. One place, so the single path (`:520`) and the batched claim path (`:543`) cannot diverge.

`ConformancePrerequisites` gains one field and `lotConformable` gains one parameter `[C1R-B1]`:

```ts
// conformancePrerequisites.ts — added to ConformancePrerequisites
/** Null when sufficiency is unresolved or mode !== 'block' — see lotConformable. */
sufficiencyBlocks: boolean;

// predicates.ts — lotConformable (:324-332) gains the limb
export function lotConformable(p: ConformablePrerequisites): boolean {
  return (
    p.itpAssigned &&
    p.itpCompleted &&
    (!p.testRequired || p.hasPassingTest) &&
    p.noOpenNcrs &&
    (p.noNaHoldPointBypass ?? true) &&
    !(p.sufficiencyBlocks ?? false) // C1: default false keeps every existing caller identical
  );
}
```

`sufficiencyBlocks` is optional with a `false` default **precisely so `predicates.parity.test.ts:1-9` keeps passing unchanged for every pre-C1 permutation**, and so the C1 permutations extend it rather than rewrite it. The mode decision is folded into the boolean by the resolver, not read inside the predicate — the predicate stays a pure function of prerequisites.

#### 5.1.2 The structural non-blocking expression `[C1R-B5]`

`sufficiencyBlocks` is computed in exactly one place, and a draft ruleset cannot block by construction:

```ts
sufficiencyBlocks =
  mode === "block" &&
  ruleset?.status === "confirmed" &&
  rules.some((r) => r.state === "insufficient");
```

`state === 'unknown'` never blocks (no branch can reach it). `mode: 'off' | 'warn'` never blocks. A `draft` ruleset never blocks. Three guarantees, one expression, one test (§14 AT-9).

| `Project.testSufficiencyMode` | Behaviour                                                                                                                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `off`                         | Evaluated and **shown** in readiness; never contributes to `canConform`.                                                                                                                                                     |
| `warn` (**proposed default**) | Same, plus items at warning severity naming the shortfall. Never blocks.                                                                                                                                                     |
| `block`                       | `insufficient` + `confirmed` ruleset ⇒ `blocksAction: true`, `canConform: false`. Force-conform (`decisionKind: 'override'`, `qualityRoutes.ts:434-436`) remains the escape hatch and records the shortfall in the snapshot. |

Why not block everywhere on day one: today a 5,000 m² earthworks lot conforms on one passing density test. Flipping that to six would mass-block live production work with no warning. Rollout mirrors F0's flag discipline (`f0-execution-spec-2026-07-24.md:117-124`): ship `warn`, flip a pilot project to `block`, measure, then decide the default.

#### 5.1.3 The surface for already-conformed and claimed lots — DECIDED `[C1R-B2]`

`buildConformanceItems` (`evidenceReadiness.ts:28-79`) early-returns one support item for `claimed` (`:32-43`) and for `conformed`-with-no-regressions (`:45-61`). **Decision (orchestrator, §16 D11 keeps it Jay-visible): extend those short circuits to carry advisory sufficiency items.** That retroactive visibility _is_ the wave's payoff — a shortfall discovered after conformance is exactly what must be visible before handover.

Concretely, both early-return branches become:

```ts
return [
  item({ code: 'lot_already_conformed', severity: 'support', ... }),
  ...buildSufficiencyAdvisoryItems(sufficiency), // §5.1.4 — warnings/support only, never blocking
];
```

Consequences accepted:

- **The characterization corpus changes.** `lot-readiness.snapshot.json` gains items for conformed/claimed lots. C1.1's gate is therefore **"regenerate the corpus, review the diff, and accept it explicitly"** — not "byte-identical" `[C1R-12]`. The diff must contain **only** added sufficiency items on lots that resolve a ruleset, and **zero** change on lots that resolve none (which is every lot in the corpus today, since the corpus project carries no C1 ruleset). In practice the regenerated file should be identical; the phase gate does not _assume_ it.
- **`blocksAction: false` always**, for every item on these branches. Enforced by the builder's type (§5.1.4), not by discipline.
- The alternative (retroactive shortfalls visible only in the claim bucket and monitoring) is preserved as §16 D11 for Jay to flip to.

#### 5.1.4 A separate warning-items builder `[C1R-B1]`

`buildConformanceBlockerItems` (`evidenceReadiness/conformanceItems.ts:64-68`) documents itself as "the five conditions the conform gate enforces (`lotConformable`), and nothing else". A warn-severity item cannot live there. C1 adds a sibling in the same file:

```ts
/**
 * Sufficiency items. Split from buildConformanceBlockerItems because that
 * function is contractually the five lotConformable conditions and nothing
 * else. The ONE blocking case (mode 'block' + confirmed + insufficient) is
 * emitted by the blocker builder via prerequisites.sufficiencyBlocks; every
 * item here is advisory by construction.
 */
export function buildSufficiencyAdvisoryItems(
  sufficiency: ResolvedSufficiency | null,
  verdict: TestSufficiencyVerdict | null,
): EvidenceReadinessItem[]; // every returned item has blocksAction: false
```

So there are two emitters with a clean split: the blocking case rides the existing blocker builder through `sufficiencyBlocks` (keeping its "five conditions" contract true, since `sufficiencyBlocks` _is_ a `lotConformable` condition once §5.1.1 lands); everything advisory rides the new builder.

### 5.2 Pre-cover — WARN, riding the hold/witness point (no new workflow)

There is **no cover event in the codebase** (§17.1, 0 grep hits). The evidence says the cover moment already has a home: the VIC earthworks seeder's witness point — `seed-itp-templates-vic-earthworks.js:118`, `notes: 'Section 204.06. W - Notify Superintendent before covering.'` In CIVOS that is a `HoldPoint` on an `ITPChecklistItem` (`schema.prisma:730-734`).

1. **At request time** — the sufficiency verdict is attached to the hold-point release-request surface. Highest-value moment: it is exactly the lab turnaround window the appendix flags (the claim _"field density same/next day; lab classification 2–5 business days; no universal lab API"_ — whose own caveat is "turnarounds are advertised, not SLAs; two labs ≠ the industry — treat as directional") `[C1R-6]`.
2. **At release time** — `POST /api/holdpoints/:id/release` already runs through `recordDecision` (`holdpoints/actionRoutes.ts:417`); the verdict is recorded in the release snapshot.
3. **WARN only, never block.** A hold-point release is the client's decision. CIVOS informs; they decide; the snapshot records what we told them. Also the External-collaboration standard (program §6).

### 5.3 Claim inclusion — WARN, never block, and one hard prohibition

`POST /api/claims` runs through `recordDecision` with `evaluateClaimInclusion` (`claims/inclusionDecision.ts:130`) and `claimInclusionSnapshots` (`:322`). Sufficiency joins as an **advisory** item, matching the shipped precedent that `unreleased_hold_points` and `pending_tests` are non-blocking (`predicates.ts:347-353`) `[C1R-C4]`.

Non-negotiable: sufficiency must never block a claim. Program §Wave F is explicit that claim surfaces are "project-management indicator, not an accounting balance or entitlement", and the appendix's security-of-payment claim warns never to imply evidence = payable amount.

**PROHIBITION `[C1R-B2]`:** sufficiency **never** enters `getClaimBlockingReasonsForConformedLot` (`conformancePrerequisites.ts:166-207`). That function's return feeds `lotClaimEligible`'s blocking set (`predicates.ts:355-361` — any non-empty `conformanceBlockingReasons` returns `false`), so a sufficiency reason placed there would silently make previously-claimable lots un-claimable on a retroactive regime change. Enforced by §14 AT-11, which asserts the function's output is unchanged across every sufficiency state.

### 5.4 Snapshot shape — fold, and do NOT bump the version

#### 5.4.1 Fold, not a second row `[C1R-14]`

`RequirementEvaluation` has **two** unique keys — `@@unique([auditLogId, entityType, entityId])` (`schema.prisma:1719`) and `@@unique([entityType, entityId, requestKey])` (`:1721`). A second `entityType: 'lot'` row under the same audit row is barred by the first, and would also collide on the second whenever a `requestKey` is present. Widening either means a migration on a live immutable table. **Fold.** This answers the question F0 left open at `f0-execution-spec-2026-07-24.md:72`: the key stays narrow.

#### 5.4.2 Do NOT bump `resultSchemaVersion` `[C1R-B3]`

Rev 1's D3 claimed a bump to `2` was free. The DDL claim was true; the cost claim was false. `requirements.test.ts:95-108` couples the version integer to the set **name string**:

```ts
expect(set.name.endsWith(`.v${set.version}`)).toBe(true);
expect(set.version).toBe(1);
```

Bumping forces `lot_conformance.v1` → `lot_conformance.v2` **in the `requirement_set` column of a live immutable table**, splitting historical from new rows — or forces relaxing a shipped contract test. Blast radius verified: `shared.ts:61-66` `decodeAtVersion1` hard-throws on 2; `requirements.test.ts:351-356` asserts version 2 _throws_ (so it keeps passing while production is broken); eleven hardcoded `resultSchemaVersion: 1` literals across `recordDecision.db.test.ts` (`:75`, `:252`, `:280`, `:287`, `:311`, `:390`, `:563`, `:570`, `:838`, `:889`, `:897`); and `buildClaimReadinessResultV1` (`claimReadiness.v1.ts:46`) consumes `ClaimMemberResultV1[]`, so a member change drags the aggregate in and is silently ignored unless taught.

**So: stay at version 1 and add `sufficiency` as an optional key that is ALWAYS EMITTED** on the three sets that carry it. Its absence then unambiguously marks a pre-C1 row — exactly the discriminator the version bump was going to provide, at zero DB cost. Safe because there is no read surface for snapshot payloads at all (`[C1R-C3]`: zero frontend references, no route selects `result` into a response, no zod `.strict()`/`.passthrough()` in `backend/src`), so an extra JSON key cannot throw at any boundary. The ~10 `toEqual` assertions in `requirements.test.ts` are updated (§14 AT-12). `buildClaimReadinessResultV1` is taught to summarise the member sufficiency states so the aggregate cannot disagree with its rows.

#### 5.4.3 Member rows carry an AGGREGATE only `[C1R-B4]`

`MEMBER_RESULT_MAX_BYTES = 1024` (`recordDecision.ts:151`); `assertSnapshotSizes` (`:248-270`) measures per row, **throws 500 `SNAPSHOT_WRITE_FAILED`**, does not truncate, and runs **regardless of the flag** — so an oversized member payload 500s claim create even with snapshots disabled. Measured worst case today: **429 bytes**, headroom **595** (reproduced independently: the 17 `CLAIM_MEMBER_REASON_CODES`, `claimedValue: 999999999.99`, `claimedPercentage: 100` — `requirements.test.ts:272-282`).

Rev 1 allowed "counts and rule ids only". At the spec's own 35-char id format, one rule costs ~50 bytes even with single-letter keys, so **~11 rules exhausts the headroom** — and `Ruleset.rules` has no cap while `CLAIM_LOTS_MAX = 5000` (`claims/workflowValidation.ts:22`). Rev 1's "worst _realistic_ rule count" was the wrong bound for a failure mode that 500s a whole claim.

**Member payload is bounded by construction — no arrays, no ids:**

```ts
/** Added to ClaimMemberResultV1. Fixed width regardless of rule count. */
sufficiency: {
  state: SufficiencyState; // <= 12 chars
  insufficientRules: number; // count only
  worstShortfall: number; // max(required - passing) across rules, 0 when none
}
```

~60 bytes, constant. `lot_conformance` and `hold_point_release` rows have the 64 KB budget (`:154`) and carry the full block including `regimeBasis` and citations. §12 asserts the member size at an **unbounded** rule count (10,000 synthetic rules), not a realistic one.

---

## 6. Schema DDL (PROPOSED — migration content only; the orchestrator applies)

```prisma
model Lot {
  // ... existing fields (schema.prisma:542-574) ...

  // C1 [C1R-B6]: the FOLDED activity slug, stored. `activityType` is free text
  // (validation.ts:112,174,249 — never constrained to CANONICAL_ACTIVITIES), so
  // an index on it cannot serve a folded-slug stream key: the fold is many-to-one
  // through LEGACY_FOLD and a CASE-INSENSITIVE LEGACY_FOLD_CI
  // (activityTaxonomy.ts:286-297), and Postgres b-tree equality is case-sensitive.
  // NULL = fold confidence 'family' or 'none' (§16 D7). This is a CLASSIFICATION,
  // not a readiness verdict, so F0's no-stored-state doctrine does not bite — and
  // Wave 2 matching plus A5 register filtering want it independently.
  activitySlug  String?  @map("activity_slug")

  // C1: the production quantity a per-quantity rule divides. NULL is
  // first-class and means "unknown" — never zero, never assumed (§7).
  // Ships unexercised by C1 counting (§3.2.1) — §3.3's lot-size advisory and
  // C2/C3 are its consumers.
  quantityValue Decimal? @map("quantity_value")
  quantityUnit  String?  @map("quantity_unit")   // 'm2'|'m3'|'t'|'m'|'each'

  // C1: the testing scale the governing specification regiments by. Validated
  // against the resolved ruleset's `scaleKeys`; NULL falls back to
  // `ruleset.defaultScale` when the ruleset declares one (§16 D6), else unknown.
  testScale     String?  @map("test_scale")

  // C1 [C1R-B6]: bounded frequency-stream lookback (§3.4.3), index-covered.
  // Existing @@index([projectId, conformedAt]) (:606) cannot serve it.
  @@index([projectId, activitySlug, conformedAt], map: "lots_project_activity_slug_conformed_idx")
}

model Project {
  // ... existing fields ...

  // C1 gate strength (§5.1.2). Default 'warn' NEVER changes conformance
  // outcomes; 'block' is opt-in per project (§16 D1).
  testSufficiencyMode String @default("warn") @map("test_sufficiency_mode")
}
```

Four nullable columns, one defaulted column, one index. **No ruleset tables** (§3.1), **no sufficiency-evaluation table** (§5.4), **no version bump** (§5.4.2), **no enum types** (the codebase uses defaulted strings throughout — `[C1R-C2]` confirms zero enums in the schema).

**Backfill.** `activitySlug` is populated in the same migration's data step by folding `activityType` through `foldActivityValue` — a one-time pass over `lots`, written as a code-driven backfill script (the fold lives in TypeScript; it cannot be expressed in SQL), invoked after the additive DDL. Lots whose fold yields `family`/`none` keep NULL. Every write path that sets `activityType` sets `activitySlug` in the same statement thereafter: `createRoutes.ts`, `bulkCreateCore.ts`, the lot PATCH path, and the Wave B lot-register importer.

`ponytail:` fold-on-write plus a one-time backfill, no trigger, no generated column — the fold is TypeScript and must stay single-sourced in `activityTaxonomy.ts`.

**Migration safety `[C1R-13]`:**

- The defaulted `Project.testSufficiencyMode` column is metadata-only on PG 11+ (no table rewrite).
- The repo has **zero** `CONCURRENTLY` index creations, so `CREATE INDEX` on `lots` takes a write-blocking `SHARE` lock. At the reference dataset's 5,000 lots that is milliseconds; stated rather than assumed. If a pilot project is materially larger the migration adds `CONCURRENTLY` and drops out of the transaction — a decision at apply time, not a guess now.
- **Wave B's migration has already landed** (`backend/prisma/migrations/20260726120000_wave_b_import_batches`), so B/C serialization is now trivially "C1 goes after". Residual contention is the `schema.prisma` **file**, not the migration order.
- Reviewed Prisma migration; prod apply via the production-migrations workflow. **Never `prisma db push`, never `--accept-data-loss`.**
- **Every DB-backed test in every C1 phase runs on a local test DB only** — `src/test/databaseSafety.ts` refuses non-local hosts. Never point a C1 test at Railway.

**Quantity is not derived-and-stored.** `LotGeometry.areaM2` (`schema.prisma:492`) is a read-time fallback for `m2` rules; it is never copied into `Lot.quantityValue`, because copying stales on the next geometry edit. The verdict records which source was used (§4.1).

---

## 7. Missing-data behaviour — honest degradation

### 7.1 The three-valued rule

`unknown` is a third state. It is **never** `satisfied` and **never** `blocked-by-default`. `draft` is **not** an unknown cause `[C1R-B5]` — it is a confidence tag on a real answer.

| Situation                                                                                           | State                                                      | Surfaced as                                                                         | Blocks?                                                  |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| No ruleset for the project's authority (incl. every national-baseline spec set, `itpMatcher.ts:96`) | `unknown` / `no_ruleset_for_project`                       | _silent_ — no item at all                                                           | No                                                       |
| Ruleset exists, no rule matches activity / layer / zone                                             | `unknown` / `no_rule_for_activity`                         | _silent_                                                                            | No                                                       |
| `activitySlug` NULL (fold `family` or `none`)                                                       | `unknown` / `activity_not_canonical`                       | warning: "classify this lot's activity to check test frequency"                     | No                                                       |
| Scale-keyed rule, no `Lot.testScale` **and** no `ruleset.defaultScale`                              | `unknown` / `scale_not_selected`                           | warning naming `ruleset.scaleKeys`                                                  | No                                                       |
| `Lot.testScale` not in `scaleKeys`                                                                  | `unknown` / `scale_not_recognised`                         | warning naming the valid keys                                                       | No                                                       |
| Rule has a `perQuantity` limb, no quantity resolvable                                               | `unknown` / `quantity_missing`                             | warning: "record this lot's area (or draw its geometry)"                            | No                                                       |
| **Ruleset `status: 'draft'`**                                                                       | **evaluated normally** — real `requiredCount`, real counts | every item tagged "unconfirmed edition" via `citation.confirmed: false`             | **No, structurally** (§5.1.2)                            |
| Passing tests exist that no rule could attribute                                                    | `insufficient` + `tests_unlinked_to_itp_item`              | warning: "N verified tests are not linked to a checklist item and were not counted" | The count blocks per §5.1.2; the warning never does      |
| Everything known, count short                                                                       | `insufficient`                                             | blocker text with required/have numbers                                             | Only when `mode === 'block'` **and** ruleset `confirmed` |

**Why the first two are silent, not warnings.** Most CIVOS projects resolve no ruleset (two packs ship). A warning per lot per rule in that state would add noise to every readiness panel in the product on day one and teach users to ignore the section. A resolved-nothing state produces nothing. The ones that _do_ warn are fixable in under a minute — the A3b field-speed standard applied to a data-quality nudge.

**`blockIfUnknown` is deliberately not built.** A contractor wanting strictness has `mode: 'block'` plus a confirmed ruleset; blocking on unknown punishes missing data rather than missing tests, and nobody has asked for it. If a pilot asks, it is one enum value.

### 7.2 Known C1 ceilings, stated rather than hidden

- **Duplicate/re-test inflation.** C1 counts distinct `TestResult` rows; two rows describing the same sample count twice. Detection is C4. The snapshot records which test ids were counted, so an auditor can see a double count. `ponytail:` count distinct rows; C4's duplicate detection tightens it.
- **No spatial coverage check.** "No sample for CH 1,240–1,310" needs per-test location; `TestResult.sampleLocation` (`schema.prisma:836`) is free text. C1 reports **counts**, not spatial gaps, and §4.4's sentence omits the chainage clause accordingly. C3 (program line 77) restores it.
- **No production-day limb** (§3.3), owned by C2 `[C1R-4]`.
- **The `perQuantity` limb ships unexercised** (§3.2.1) — no cited authority supplies a per-area frequency figure.

---

## 8. Seeding, evidence grades and the confirmation step

### 8.1 The grade correction `[C1R-B11]`

Rev 1 said "the research appendix grades the VicRoads 204 and TfNSW R44 frequency facts **A**". **That was wrong for R44.** The appendix's grade for the R44 row is verbatim **"A (portal) / C (aetg)"**: the A attaches to a TfNSW standards-portal **annotation record** (which the appendix itself flags must "be resolved to the current R44 document page"), and the numbers come from the **C-graded** aetg secondary page. VicRoads 204 (both its rows) **is** A.

`RulesetProvenance.evidenceGrade` is a single scalar, so §3.2 fixes the encoding rule: **a split grade is encoded at its weakest limb — the grade of the source the numbers came from.** Therefore:

- `vicroads-204.v1` → `evidenceGrade: 'A'`.
- `tfnsw-r44.v1` → `evidenceGrade: 'C'`. Under §8.3's CI rule (`evidenceGrade === 'A'` required for `confirmed`), R44 is **permanently unconfirmable and permanently non-blocking** until appendix §H item 5 resolves the portal record to the real specification document and someone reads it. That is the correct outcome and the spec claims it rather than obscuring it.

### 8.2 What the packs contain

- **`vicroads-204.v1`** — VIC / VicRoads, earthworks family. Minimum counts **scoped to compaction** `[C1R-7]`: the appendix's claim is _"6 tests/lot (Scale A/B compaction), 3 (Scale C)"_ — a compaction-density rule, not a blanket per-lot count for every test type. `maxLotSize` 5,000 m² (Type A) and 500 m² under paved areas (`areaZoneAliases`). **No `reduced` limb** `[C1R-B8]`: the appendix supplies the 204.14(c) trigger and no reduced figure, and CI asserts `reduced` cannot exist on a `draft` ruleset (§8.3). The regime machinery is still built and tested — against a synthetic confirmed ruleset (§14 AT-5..AT-8) — so it is ready the moment a confirmed edition supplies figures.
- **`tfnsw-r44.v1`** — NSW / TfNSW, `specSet` normalizing `rms` → `tfnsw` (`itpMatcher.ts:74-76`). Encodes the **n = 6 minimum sample count** only; no CDR statistic (§16 D8). Grade `'C'`, therefore `draft`-forever until §H item 5 resolves.
- **No TMR / DIT SA / MRWA pack, and no numbers from them.** They are on the appendix's standing never-assert list.

### 8.3 The confirmation step — BEFORE encoding `[C1R-B11]` `[C1R-9]`

Rev 1 encoded at C1.3 and confirmed afterwards, and allowed exiting with both packs draft. Combined with a `warn` default, C1 could have satisfied its whole exit gate **while gating nothing, on unconfirmed numbers**. Both source documents say otherwise: plan line 75 — currency "must be confirmed against the current published edition **before encoding**"; the appendix's VicRoads row — "revalidate against current VicRoads/DTP edition before seeding the pack (**by C1 start**)"; its R44 row — "Verify against current R44 edition **at C1 start**".

**The sequence, corrected:**

1. **C1.0 (before any pack is authored): the confirmation pass.** A human opens the **current published** VicRoads/DTP document — not the council republication — verifies every number against its cited clause/table, and records `edition`, `clause`, `pdfPage`, `sourceUrl`, `checkedOn`, `revalidateBy`. Numbers that cannot be confirmed are **not encoded**. This is a Jay-visible sequencing change because it front-loads a human verification task (§16.0).
2. **C1.1: the pack is authored from confirmed figures**, landing directly at `status: 'confirmed'` where step 1 succeeded, or `draft` where it did not (R44, necessarily).
3. **Confirmation of an already-shipped draft emits a NEW version** `[C1R-9]`: `vicroads-204.v2.ts`, with `effectiveTo` set on v1. F0 forbids editing a definition in place once instances exist (program §2: "definitions are never edited in place once instances exist"), and snapshots reference `ruleId` strings that must keep resolving. Never an in-place edit of a `.v1`.
4. **CI enforces currency** — a runnable check that survives sessions:
   - every `confirmed` ruleset has non-empty `edition`, `clause`, `sourceUrl`, `pdfPage`, `checkedOn`, `revalidateBy`;
   - `revalidateBy` is **in the future** — an expired `confirmed` ruleset **fails CI**;
   - `evidenceGrade === 'A'` for any `confirmed` ruleset;
   - **no `draft` ruleset declares a `reduced` limb** `[C1R-B8]`;
   - a `draft` ruleset is asserted non-blocking by behaviour test (§14 AT-9), not by inspection;
   - the check is itself tested against a synthetic expired `confirmed` ruleset (§14 AT-17).
5. **Revalidation cadence:** `revalidateBy` 12 months out by default, earlier where the appendix says so.

### 8.4 Legal boundary

Facts, numbers and thresholds are encoded; specification **prose is not**, and no Standards Australia text appears anywhere. `FrequencyRule.label` is a short factual label with a CI-asserted length cap, and the rule type has **no free-prose field** — there is nowhere for a copied clause to live. Test methods are referenced by AS number only, as `specifications.ts` already does.

The appendix's copyright claim is grade **C** (university guidance) with the caveat "obtain legal confirmation before shipping seeded spec packs commercially". Rev 1 restated the caveat with no owner. **Owner: Jay. Gate: §15.1 exit item 10** `[C1R-8]` — legal confirmation obtained, or the packs ship internal-only with a recorded risk acceptance, before any pack reaches a paying customer.

---

## 9. API + UI surface

### 9.1 Data entry — bulk paths included `[C1R-B10]`

Rev 1 offered `PATCH /api/lots/:id` only, which meant every lot created after C1 was **born** with NULL scale and quantity and a PM on a 500-lot project would open 500 forms. Corrected:

- **`bulkCreateCore.ts` gains a field pass-through** for `testScale`, `quantityValue`, `quantityUnit` (and sets `activitySlug` from the fold). This is the shared core behind `POST /api/lots/bulk` **and** the copilot `lot_breakdown` apply handler (`bulkCreateCore.ts:1-12`) — i.e. the chainage generator and the AI breakdown, the two ways lots are really created. Near-zero cost: three optional fields through an existing validated shape.
- **One new bulk-set route** — `POST /api/lots/bulk-set-test-attributes` — reusing `assertLotsBulkMutable` (`bulkMutationGuards.ts:22`) exactly as the three existing bulk routes do (`bulkMutationRoutes.ts:74`, `:182`). Sets scale and/or quantity across a selection.
- Wave B's lot-register importer maps these columns when present. Coordination note only; no Wave B file is touched by C1.

### 9.2 New read routes: one

`GET /api/test-sufficiency/rulesets` — the registry as data (id, authority, document, edition, `scaleKeys`, `defaultScale`, `status`, rule labels + citations). Read-only, **authenticated**, not project-scoped: it is shipped product data with no tenant content. §10.1 states the test that proves it `[C1R-10]`.

### 9.3 Extended, not added

- `GET /api/lots/:id/readiness` (`qualityRoutes.ts:265`) — the conformance bucket gains the new items, **including on the conformed/claimed branches** (§5.1.3). Additive response shape. The only read surface sufficiency needs; no per-lot `/test-sufficiency` route (`ponytail:` a second endpoint would be a second source of truth).
- `PATCH /api/lots/:id` — accepts `quantityValue`, `quantityUnit`, `testScale`.
- `PATCH /api/projects/:id` — accepts `testSufficiencyMode`; the change writes an audit row.
- `POST /api/lots/:id/conform` — no signature change; the extra prerequisite arrives through `computeConformanceResult`.

### 9.4 UI (office surfaces only)

- `frontend/src/pages/lots/components/LotReadinessPanel.tsx:267` — renders the new items through the existing blocker/warning/support buckets. **No new component**, no card-rule change.
- `LotEditFormFields.tsx` — quantity + unit, and scale as a `NativeSelect` populated from `GET /api/test-sufficiency/rulesets` (rhf `register()` needs `NativeSelect`, not Radix).
- `ConformLotDialogs.tsx` — the shortfall appears in the existing blocker list; force-conform copy names it.
- Bulk-set affordance on `LotsPage` reusing the existing bulk-selection toolbar.
- Project settings — one control for `testSufficiencyMode` with plain-English copy per mode.
- **Register column / map overlay: OUT.** Deferred until a pilot asks; the overlay is C3.
- **The mobile shell is UNTOUCHED** — no file under `frontend/src/shell/` changes. A foreman-facing indicator is **Jay-gated**.

---

## 10. Security review (program §7)

C1 is correctly **not** on §7's threat-model gate list (that list is A3, C2, D2, E) `[C1R-C10]`; a security review is the right form. It adds no upload surface, no external link, no AI call, no offline storage.

### 10.1 Threats and controls

| Threat                                      | Control                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tenant isolation on a new query surface** | The regime query is the only new cross-lot read. `projectId`-scoped in the `where`; §14 AT-18 asserts a lot in project B never appears in project A's stream. Non-negotiable per §7.                                                                                                                                                                             |
| **The registry route** `[C1R-10]`           | `GET /api/test-sufficiency/rulesets` is not project-scoped, so it cannot leak tenant data by construction — but §7 says "tenant-isolation tests on every new query surface" with no exemption. §14 AT-19 asserts it (a) requires authentication, (b) returns byte-identical payloads to two users in different companies. Stated here rather than self-exempted. |
| **Input validation at a trust boundary**    | `quantityValue`: positive, finite, bounded (reject ≤ 0, NaN, > 1e9), Decimal not float. `quantityUnit`, `testSufficiencyMode`: enum whitelist. `testScale`: must be in the resolved ruleset's `scaleKeys`, rejected at the route, never silently coerced. Bulk routes validate per row and reject the whole batch on any invalid row.                            |
| **Gate bypass via data**                    | Setting `quantityValue` low to shrink a required count is possible and **audited**: quantity/scale edits write audit rows, and the decision snapshot records the quantity and its source. Detection, not prevention — the field is legitimately user-recorded. (Also currently inert: no C1 rule divides by quantity, §3.2.1.)                                   |
| **Permission escalation**                   | §10.2. A foreman cannot weaken a gate.                                                                                                                                                                                                                                                                                                                           |
| **Authorization vs stale readiness**        | Authorization reads stay outside the decision transaction, per F0 `[R3.1-R6]` (`qualityRoutes.ts:414-416`). C1 changes nothing here and adds the regime read to the same outside-the-transaction category (§3.4.3).                                                                                                                                              |
| **Commercial leakage**                      | Sufficiency payloads contain no money. Snapshot rows carry unfiltered commercial values generally (F0 §5), so any future read surface re-applies `filterCommercialReadiness`; C1 adds no such surface.                                                                                                                                                           |
| **Copyright / DRM'd content**               | §8.4: facts only, no prose field, CI-capped label length.                                                                                                                                                                                                                                                                                                        |
| **Audit-log integrity**                     | Unchanged — sufficiency rides `recordDecision`'s existing atomic audit+snapshot write.                                                                                                                                                                                                                                                                           |

### 10.2 Permission matrix `[C1R-B12]`

The plan and appendix say nothing about who may author or override rulesets, so these are **the spec's own design calls, stated as such** and open to Jay's correction (§16 D12). Canonical role values are `backend/src/lib/roles.ts`.

| Action                                                                      | Allowed                                                                                        | Rationale                                                                                                                                               |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Author / edit a ruleset**                                                 | Nobody at runtime — code-only, PR-reviewed                                                     | §3.1. Tenant-authored rulesets are C3.                                                                                                                  |
| **Read the registry** (`GET /api/test-sufficiency/rulesets`)                | any authenticated user                                                                         | Public specification facts; needed to render scale options.                                                                                             |
| **See a sufficiency verdict** on a lot                                      | anyone with existing lot-readiness read access, incl. subcontractors within their portal scope | Rides `GET /:id/readiness`, whose authorization (`qualityRoutes.ts:277-294`) already covers subcontractor scoping. No new visibility.                   |
| **Set `Lot.testScale` / `quantityValue` / `quantityUnit`** (single or bulk) | `LOT_EDITORS` (`routes/lots/roles.ts`) — **foreman excluded**                                  | These are lot setup attributes, and foreman is deliberately not a lot setup manager. Consistent with the existing lot-edit gate rather than a new rule. |
| **Set `Project.testSufficiencyMode`**                                       | `owner`, `admin`, `project_manager`                                                            | Changing gate strength is a project governance decision, not a field one. Audited.                                                                      |
| **Force-conform past a sufficiency block**                                  | `LOT_FORCE_CONFORMERS` (existing owner/admin set, `qualityRoutes.ts:434-436`)                  | Reuses the shipped override authority; the shortfall is recorded in the snapshot. No new override concept, no new role.                                 |
| **Waive a sufficiency rule for a lot**                                      | **nobody — not built**                                                                         | A per-lot waiver is a C3 "controlled override" (program line 77). Force-conform is the C1 escape hatch. `ponytail:` one escape hatch, not two.          |

---

## 11. Build phases

Order is strict. The confirmation pass moved into C1.0/C1.1 `[C1R-B11]`, so the packs are no longer last.

### C1.0 — Confirmation pass + vocabulary + evaluator + reason codes (M) · no migration, no call sites

- **The §8.3 step-1 confirmation pass runs FIRST**, before any pack is authored. Output: verified numbers with `edition` / `clause` / `pdfPage` / `sourceUrl` / `checkedOn` / `revalidateBy`, or a recorded failure to confirm. Jay-visible (§16.0).
- `sufficiency/types.ts`, `registry.ts`, `regime.ts`, `resolve.ts`, `evaluate.ts`, `rulesets/index.ts` — **no pack content yet**; a synthetic fixture ruleset in tests only.
- Five new codes + provenance in `contracts/reasonCodes.ts`; `testFailing` added and `testCountSufficient` re-exported in `predicates.ts` (§4.3).
- `TestReasonCode` widened and `TestSufficiencyVerdict` extended with **optional** `state`/`rules` (§4.2.1) so `contracts.test.ts:140-150` keeps compiling.
- **D10:** `overdue_test` removal with its migration-safety step (§16 D10). Independent of everything else; lands here so it is not left dangling.
- Tests: §14 AT-1 … AT-9, AT-17.
- **Exit:** pure layer fully tested, zero production call sites; fallow may flag the exports unused — expected-by-design, stated in the PR body (the F0.1 precedent, `predicates.ts:15-17`, `[C1R-C1]`).

### C1.1 — Migration + packs + resolution + entry + WARN-only surfacing (L)

- The §6 migration (four nullable columns, one defaulted column, one index) plus the `activitySlug` backfill script. **Orchestrator applies to prod.**
- **The packs, authored from C1.0's confirmed figures** — `vicroads-204.v1` at its verified status, `tfnsw-r44.v1` at grade `'C'`/`draft`. CI currency assertions land with them.
- `resolve.ts` wired: registry + scale + quantity + regime, per path, with the exact `select`/`include` extensions of §4.1.1.
- `computeConformanceResult` third parameter; `ConformancePrerequisites.sufficiencyBlocks`; `lotConformable` limb (§5.1.1); `buildSufficiencyAdvisoryItems` (§5.1.4); conformed/claimed short circuits extended (§5.1.3).
- **Data entry:** `bulkCreateCore` pass-through, `POST /api/lots/bulk-set-test-attributes`, `PATCH` fields, `LotEditFormFields`, bulk affordance, project-settings control (§9).
- All projects at `warn`, so nothing blocks.
- **Characterization gate, restated `[C1R-12]` `[C1R-B2]`:** the corpus (`readiness/characterization/`) covers the **lot-readiness and claim-readiness endpoints only** (`characterization.test.ts:80`, `:98`) — it does **not** cover the conform gate. So C1.1's gate is three things, not one:
  1. **Regenerate** `lot-readiness.snapshot.json` and `claim-readiness.snapshot.json`, review the diff, accept it explicitly in the PR body. Expected diff: **empty**, because the corpus project resolves no ruleset. A non-empty diff must be only added sufficiency items on ruleset-resolving lots.
  2. **`predicates.parity.test.ts`** extended with the sufficiency permutations — it is one of the two real conform-gate pins.
  3. **`lotConformanceDecision.db.test.ts`** — the other pin — asserts the conform decision is unchanged at `mode: 'off'`/`warn`.
- **Exit:** a lot with a resolved ruleset shows real counts in the panel (including a conformed lot); no live project's conform outcome changes; local-DB tests green; `npm run fallow:audit` verdict in the PR body.

### C1.2 — Snapshots + the `block` mode (M)

- Optional always-emitted `sufficiency` key at `resultSchemaVersion: 1` on `lot_conformance`, `hold_point_release`, `claim_member` (§5.4.2); member payload is the fixed-width aggregate (§5.4.3); `buildClaimReadinessResultV1` taught to summarise it.
- `Project.testSufficiencyMode === 'block'` honoured through `sufficiencyBlocks` (§5.1.2).
- Hold-point request/release advisory (§5.2); claim-inclusion advisory + the §5.3 prohibition test.
- Batched path resolves sufficiency for N lots with one grouped regime query per stream.
- Tests: §14 AT-10 … AT-16, AT-18, AT-19.
- **Exit:** all three decision points record the block; claim create at the 5,000-member ceiling still meets F0's p95 < 2 s (§12); `block` proven on a **confirmed** pack and proven inert at `warn`/`off`.

### C1.3 — Benchmark, monitoring, exit evidence (S–M)

- §12 benchmarks against the reference dataset; §15.2 monitoring wired; §15.1 exit evidence assembled.

**B/C overlap `[C1R-13]`.** Program §9 permits overlap "only across disjoint subsystems with strict file ownership". Wave B's migration has already landed, so migration serialization is trivially "C1 goes after". Wave B owns `routes/copilot/**`, `ImportBatch`/`ImportMappingProfile`, parsers, `routes/itp/**`. C1 owns `lib/readiness/sufficiency/**`, `conformancePrerequisites.ts`, `evidenceReadiness.ts` + `evidenceReadiness/conformanceItems.ts`, `routes/lots/qualityRoutes.ts`, `routes/lots/bulk*`. **Residual contention is the `schema.prisma` file and `bulkCreateCore.ts`** (Wave B's lot-register importer writes through it) — both need a single-owner window, coordinated by the orchestrator.

---

## 12. Scale & performance targets (program §8 form: percentile + dataset + device/network)

Measured against the defined production-like reference dataset (5,000 lots, 10,000 map features, 50 GB evidence, 10k-row registers — program line 138).

| Target                                             | Budget                                                                                                                                                                | Method                                                                                                                                                                                                                                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sufficiency added to `GET /api/lots/:id/readiness` | **p95 < 25 ms** server-side, on a lot whose ITP has 500 checklist items (`templateValidation.ts:8`) at 5,000 project lots                                             | Server-side timing.                                                                                                                                                                                                                                                                  |
| Total `GET /:id/readiness`                         | **p95 < 400 ms** server-side; must not regress > 10% vs master                                                                                                        | Existing route benchmark.                                                                                                                                                                                                                                                            |
| Additional queries per readiness call `[C1R-11]`   | **≤ 1 _additional_ query** per distinct stream, memoized per request; **0 additional** when no ruleset resolves                                                       | Query-count assertion (deterministic in CI). Rev 1 said "0 queries", which was wrong: `Project.state`/`specificationSet` are not selected today. They are added to the **existing** `select`/`include` (§4.1.1), so the correct claim is zero _additional_ queries, not zero fields. |
| Regime lookback                                    | **`take: N` (N = 3), index-covered** by `lots_project_activity_slug_conformed_idx`; **p95 < 5 ms** at 5,000 lots                                                      | Assert rows fetched ≤ N per stream. Now well-founded because the index is on the **stored slug**, not free-text `activityType` `[C1R-B6]`.                                                                                                                                           |
| Conform decision overhead                          | sufficiency adds **p95 < 5 ms** inside the transaction (the regime read is outside it, §3.4.3), keeping the single-entity decision inside F0's **p95 < 50 ms** budget | F0.5's decision benchmark harness.                                                                                                                                                                                                                                                   |
| Serializable retry rate                            | **no measurable increase** vs master under the concurrency test load                                                                                                  | Directly testable because the regime read is outside the transaction; a rise here means the read leaked back in.                                                                                                                                                                     |
| Claim create at the 5,000-member ceiling           | **p95 < 2 s unchanged**; sufficiency adds ≤ 1 grouped query per stream, never per member                                                                              | F0.5's maximum-size claim benchmark.                                                                                                                                                                                                                                                 |
| `claim_member` snapshot size                       | **≤ 1 KB with an UNBOUNDED rule count** — asserted at 10,000 synthetic rules `[C1R-B4]`                                                                               | Fixed-width aggregate (§5.4.3) makes this provable, not probable. Rev 1's "worst realistic count" was the wrong bound for a 500-on-claim-create failure.                                                                                                                             |
| `activitySlug` backfill                            | completes inside the migration window at 5,000 lots; measured before prod apply                                                                                       | Batched update, progress logged.                                                                                                                                                                                                                                                     |

---

## 13. Rollback / recovery `[C1R-B12]`

Program §9 mandates a rollback/recovery process. Per phase:

| Phase                                    | Rollback                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Anything stranded?                                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **C1.0** (pure layer, D10)               | Plain `git revert`. No DB objects, no call sites. D10's alert-type removal reverts by restoring the two `AlertType` declarations and the config key.                                                                                                                                                                                                                                                                                                                      | No.                                                                                                                                                    |
| **C1.1** (migration + packs + surfacing) | **Code reverts cleanly; the migration is not reverted.** The four nullable columns and the defaulted column are inert without the code — a reverted build simply never reads them, and `testSufficiencyMode` defaulting to `'warn'` gates nothing. The index is inert. Dropping columns is **not** part of rollback (data loss for no gain).                                                                                                                              | User-entered scale/quantity survives the revert and is still there when the code returns. `activitySlug` is a classification, safe to leave populated. |
| **C1.2** (snapshots + block)             | **The no-bump decision is what makes this clean `[C1R-B3]`.** Rollback = stop emitting the optional `sufficiency` key. Rows already written keep it; `decodeAtVersion1` still decodes them because the version never changed; no reader breaks; nothing is stranded. Had the version been bumped, rolled-back code would hard-throw on every v2 row already in the immutable table (`shared.ts:61-66`) and the only recovery would be a data migration of audit evidence. | No. This is the single strongest argument for §5.4.2.                                                                                                  |
| **C1.2 `block` mode**                    | Per-project: set `testSufficiencyMode` back to `warn`. Instant, no deploy, audited.                                                                                                                                                                                                                                                                                                                                                                                       | No.                                                                                                                                                    |
| **A wrong number in a shipped pack**     | Emit a corrected `.vN+1` with `effectiveTo` on the old version (§8.3 step 3) — never an in-place edit `[C1R-9]`. Historical snapshots keep resolving their original `ruleId`, so past decisions stay readable exactly as they were made.                                                                                                                                                                                                                                  | No, by construction.                                                                                                                                   |

**Recovery from a mis-backfilled `activitySlug`:** re-run the backfill script (idempotent — it derives from `activityType`, which it never writes). A wrong slug affects stream membership only; it cannot corrupt a decision, because decisions record their own regime basis in the snapshot.

---

## 14. Acceptance tests `[C1R-B12]`

Named artifact, per program §9. Every item is a real test file assertion, not a review checklist.

**Pure layer (C1.0, no DB):**

- **AT-1** `requiredCount = max(minCount, ceil(quantity/every))` across the boundary cases; and the floor case where `perQuantity` is absent.
- **AT-2** The real evaluator satisfies `TestSufficiencyVerdict` and **always populates `state` and `rules`** even though both are optional (§4.2.1); `contracts.test.ts:140-150`'s existing four-key fixture still compiles.
- **AT-3** Every `UnknownCause` fires from its own minimal input, and each produces `sufficient: false` and `blocksAction: false`.
- **AT-4** The `perQuantity` limb, against a **synthetic** rule — explicitly marked as covering an unshipped limb `[C1R-1]`.
- **AT-5** Regime, **unconformed subject**: no cursor, `take: N`, most-recent-N semantics.
- **AT-6** Regime, **conformed subject**: strictly-before compound cursor; a stream where "most recent N" and "N preceding the subject" differ yields **different** regimes, and the conformed subject gets the latter. Plus the **length guard**: a stream with < N entries is `full`, never `reduced`.
- **AT-7** Property test: bounded lookback ≡ fold over full history, over generated conform/fail sequences. **The reference fold implements the length guard independently** — stated in the test's own comment, because a reference that shares the bug proves nothing `[C1R-B7]`.
- **AT-8** Regime asymmetries: a force-conformed lot is non-conforming; an **unverified** failing test does **not** reset the regime while a **verified** one does (`testFailing`, §3.4.2) `[C1R-B8]`.
- **AT-9** `sufficiencyBlocks` is false for every combination of `mode: 'off'|'warn'`, `status: 'draft'`, and `state: 'unknown'` — the structural non-blocking guarantee (§5.1.2) `[C1R-B5]`.
- **AT-17** The CI currency check fails on: a `confirmed` ruleset with a past `revalidateBy`; a `confirmed` ruleset at grade ≠ `'A'`; a `draft` ruleset declaring `reduced`; a missing `pdfPage` on a `confirmed` pack.

**Integration (C1.1/C1.2, local test DB only):**

- **AT-10** A lot with a resolved confirmed ruleset and a shortfall: `mode: 'off'` → item present, `canConform` unchanged; `warn` → warning; `block` → `canConform: false` with required/have numbers in the detail.
- **AT-11** **The §5.3 prohibition:** `getClaimBlockingReasonsForConformedLot` returns byte-identical output across every sufficiency state, including `insufficient` under `mode: 'block'`.
- **AT-12** The three requirement-set payloads carry `sufficiency`, always emitted; the ~10 `toEqual` assertions in `requirements.test.ts` updated; a pre-C1 row **without** the key still decodes at version 1; `set.version` is still `1` for all five sets (`requirements.test.ts:95-108` unchanged) `[C1R-B3]`.
- **AT-13** `claim_member` payload ≤ `MEMBER_RESULT_MAX_BYTES` at **10,000** synthetic rules `[C1R-B4]`; and the aggregate (`buildClaimReadinessResultV1`) summarises member sufficiency rather than ignoring it.
- **AT-14** Conform-gate pins `[C1R-12]`: `predicates.parity.test.ts` extended with sufficiency permutations (parity preserved); `lotConformanceDecision.db.test.ts` asserts an unchanged decision at `mode: 'off'`/`warn`.
- **AT-15** **Retroactivity, observable:** conform lots 1–5 into `reduced`; correct lot 2's test to a verified fail; re-read lot 5 → regime `full`, `requiredCount` risen, and **the advisory item is present on lot 5's readiness response even though lot 5 is `conformed`** (§5.1.3) — the assertion Rev 1's surface made impossible `[C1R-B2]`.
- **AT-16** Force-conform past a block records the shortfall in the `lot_conformance` snapshot.
- **AT-18** **Tenant isolation:** a lot in project B never appears in project A's stream, including when both share an `activitySlug`.
- **AT-19** **Registry route** `[C1R-10]`: requires authentication; returns byte-identical payloads to two users in different companies.
- **AT-20** Bulk paths: `bulkCreateCore` persists scale/quantity/`activitySlug`; `bulk-set-test-attributes` respects `assertLotsBulkMutable` and rejects an invalid `testScale` for the whole batch.
- **AT-21** D10 safety: with a legacy `overdue_test` row present, `GET /api/notifications/alerts` does **not** 400 (whichever mitigation §16 D10 selects).

---

## 15. Exit gate, monitoring, completion standards

### 15.1 Exit gate

1. **≥ 1 pack `confirmed`, with `block` proven end to end on it** `[C1R-B11]`. Promoted to item 1 because Rev 1's ordering let C1 exit having gated nothing on unconfirmed numbers. A lot short on tests is blocked with the numbers and clause cited; force-conform overrides it; the shortfall is verified in the snapshot by direct query (the established prod verification ritual). If **no** pack can be confirmed, C1 **does not exit** — it reports the confirmation failure and Jay decides (§16.0).
2. **The third F0 consumer contract turns green.** `TestSufficiencyVerdict` (`futureConsumers.ts:27-37`) satisfied by the real implementation, not a stub — lot readiness (live), claim readiness (live), **test sufficiency (C1)**. Three of six. "One definition everywhere" still waits on My Work, hold-point packages and handover readiness.
3. **CI currency assertions green** and demonstrably failing on the synthetic cases of AT-17.
4. **No behaviour change at `mode: 'off'`/`warn'`**, proven by the three-part gate of §11 C1.1 (regenerated corpus with an accepted diff, extended parity test, conform-decision DB test) — not by a "byte-identical" claim the corpus cannot support `[C1R-12]`.
5. **`tfnsw-r44.v1` ships `draft` at grade `'C'`** with its unconfirmability stated in the exit evidence and appendix §H item 5 named as the unblocker `[C1R-B11]`.
6. **Regime correctness proven, including retroactivity and both query modes** (AT-5, AT-6, AT-7, AT-8).
7. **Retroactivity observable** `[C1R-15]`: AT-15 asserts it three ways — a `RequirementEvaluation` row query showing the changed `requiredCount` in a later decision's snapshot, a unit test over the regime function, **and** the readiness response of an already-conformed lot. Rev 1's exit item 6 was unobservable through the panel; §5.1.3 made it observable and this item asserts all three.
8. **All §12 benchmarks met** on the reference dataset, including the unbounded-rule-count member size (AT-13) and no serializable-retry increase.
9. **Tenant isolation green** for the regime query and the registry route (AT-18, AT-19).
10. **Legal confirmation on the seeded packs obtained, or an explicit recorded risk acceptance** `[C1R-8]` — owner **Jay**, gated before any pack reaches a paying customer.
11. **Docs + Clancy knowledge mirror updated** (standing boundary, program line 5).
12. **Pilot acceptance owner: Jay** — a real lot on a real project, gate visible, explanation readable by a quality manager without training.
13. `npm run fallow:audit` verdict recorded per PR.

### 15.2 Monitoring and pilot adoption metrics `[C1R-B12]`

**Engine-internal (Rev 1's list, retained):** lots by sufficiency state per project; force-conforms that overrode an `insufficient` verdict (the number that says whether the gate is calibrated or routed around); `unknown` cause distribution; regime full-vs-reduced distribution; sufficiency query p95; serializable-retry rate.

**Program §6 pilot adoption metrics — which ones C1 moves, and how they are read.** Rev 1 omitted these entirely; §6 requires them per pilot and A6 instrumentation is the collection prerequisite.

| §6 metric                                    | C1's expected effect                                                                        | How it is read                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Same-day evidence-capture rate               | **Up** — the pre-cover warning is a same-day prompt to sample                               | A6 funnel: test-result creation date vs lot activity date                 |
| Median field completion time                 | **Neutral** — no new field task; three office-form fields only                              | A6 task timing; a regression here means the gate leaked into a field flow |
| Unsynchronised-item age                      | **Unaffected**                                                                              | —                                                                         |
| Hold points decided through CIVOS            | **Neutral to up** — the request surface gains information, not friction                     | Existing hold-point counts                                                |
| External-link completion rate                | **Unaffected**                                                                              | —                                                                         |
| Client outputs accepted without reformatting | **Unaffected in C1** (D1's folio is the consumer)                                           | —                                                                         |
| Parallel spreadsheets eliminated             | **The headline C1 metric** — a frequency-tracking spreadsheet is exactly what this replaces | Pilot interview, per §6; asked explicitly at pilot review                 |

Plus two C1-specific pilot questions: does the quality manager trust the number (if not, the citation is not doing its job), and how many lots did the pilot have to enter a scale for before the panel became useful (the D6 default's real test).

### 15.3 Completion standards (program §6) `[C1R-B12]`

- **Quality and audit standard — engaged, and satisfied.** Source, actor, timestamp and revision are attributable: every verdict carries its ruleset id, edition, clause and `citation.confirmed`; every gated decision records the verdict in an immutable snapshot with the regime basis; a force-conform past a block is recorded with its reason. No sufficiency change can rewrite an approved historical decision — snapshots are immutable and a corrected pack emits a new version rather than editing `.v1` (§8.3 step 3).
- **Field workflow standard — engaged, contrary to Rev 1's silence.** Rev 1 implied C1 was office-only. It is not: **three new lot-edit form fields and one bulk affordance ship** (§9). So the standard applies to them: the bulk-set path exists precisely so the common case is not 500 forms (`[C1R-B10]`); the scale control is populated from the registry rather than typed; the fields are optional everywhere, so no existing flow gains a required step; and they sit on `LotEditFormFields`/`LotsPage`, which are **office** surfaces on a desktop or tablet — no foreman flow, no shell file, no new field task. Accessibility and touch targets follow the existing form components unchanged. The parts of the standard about offline, reconnection, restart and duplicate submission are **not applicable**: no C1 surface is offline-capable and no C1 write is a field capture.
- **External collaboration standard — engaged at §5.2 only**, and satisfied by the warn-never-block rule: a superintendent's release is never refused by CIVOS's count.
- **Output standard — not engaged in C1.** No new client-facing output; the folio is D1.

---

## 16. Decisions

### 16.0 Jay decisions — the four that need a person, not a reviewer

1. **D11 (surface for retroactive shortfalls).** The orchestrator has decided: extend the conformed/claimed short circuits to carry advisory items (§5.1.3), which is the wave's payoff. **Jay can flip to claim-bucket-only** — cheaper, no corpus regeneration, but retroactive shortfalls then surface only in the claim bucket and monitoring.
2. **D13 (confirmation sequencing).** §8.3 moves the confirmation pass **before** encoding, per plan line 75 and the appendix. This **front-loads a human verification task on Jay or his dev** at the very start of C1.0 — reading the current published VicRoads/DTP Section 204 against every encoded number. The alternative is an explicit recorded deviation, which the plan permits only as a deviation.
3. **D1 (default gate mode).** `warn` recommended. It is also what allowed Rev 1 to exit gating nothing — which exit item 1 now closes independently.
4. **D12 (permission matrix).** §10.2's rows are the spec's own design calls because the plan and appendix are silent. Worth thirty seconds of Jay's eyes, especially "nobody may waive a rule per lot; force-conform is the only escape hatch".

### 16.1 The full list

**D1 — Default `Project.testSufficiencyMode`.** → **`warn` for all projects.** Visible wedge, zero risk of blocking live work; `block` opt-in per project. Reviewer agrees. Its one hazard (exiting having gated nothing) is closed by exit item 1.

**D2 — The pre-cover gate.** → **Ride the hold/witness point** (§5.2), warn-only. Evidence is in our own seeder (`seed-itp-templates-vic-earthworks.js:118`). A dedicated cover event means a new lot state, a new route and a **shell touch** for an event nobody asked to record. Reviewer agrees.

**D3 — Snapshot shape.** → **Fold, and do NOT bump the version** (§5.4). Rev 1 said fold at `v2`; the reviewer proved the bump renames `requirement_set` in a live immutable column (`requirements.test.ts:95-108`). Now an optional always-emitted key at `v1`, whose absence is the pre-C1 discriminator. Two unique keys (`schema.prisma:1719`, `:1721`) strengthen fold-over-widen `[C1R-14]`. Answers F0's open note at `f0-execution-spec-2026-07-24.md:72`: the key stays narrow.

**D4 — Required-count arithmetic.** → **`max`, and the framing is withdrawn** `[C1R-1]`. The floor reading is right, but **no rule C1 ships has a `perQuantity` limb**, so `max` is a no-op in practice and Rev 1's "most consequential arithmetic choice in the wave" was overstated. The limb ships unexercised (§3.2.1), tested synthetically.

**D5 — Quantity storage.** → **New `Lot.quantityValue`/`quantityUnit`, `LotGeometry.areaM2` as read-time fallback for `m2`, never copied.** Copying stales on the next geometry edit; geometry can never serve volume or tonnage. **Honest caveat:** dead weight for C1 counting (§3.2.1) — it serves §3.3's lot-size advisory and C2/C3. Ships now because bulk entry is cheapest built once.

**D6 — Scale selection grain.** → **Per-lot, WITH an optional per-project ruleset default** — changed from Rev 1's "no default" `[C1R-B5]`/`[C1R-B10]`. With no default and no bulk path, 100% of lots would read `unknown` forever, which is a dead launch. So: `Ruleset.defaultScale` supplies a fallback when `Lot.testScale` is NULL, the verdict **always names the scale's source** (`'lot' | 'ruleset_default' | 'none'`), and a lot may override. A ruleset with no defensible default declares none and its lots stay `unknown` until a scale is entered — the honest case is still reachable.

**D7 — Frequency-stream key, and its two membership holes.** → `(projectId, rulesetId, ruleId, activitySlug, layerBucket)`. **No subcontractor**: the authority regiments "work of the same type", not "work by the same crew", and no cited spec says otherwise. The reviewer's two holes, closed:

- **NULL layer** → **member of the layer-agnostic stream only** (`layerBucket = '*'`), never of a layer-discriminated rule's stream. Agrees with the orchestrator's default.
- **A lot whose `activitySlug` is NULL** (fold `family`/`none`) → **not a stream member, and its presence in another lot's window makes that window INCOMPLETE, so `reduced` cannot be earned across it.** This **differs from the orchestrator's stated default** ("absence is skipped, not counted as non-conforming"), and the argument is the spec's own doctrine: §7.1 says unknown is never satisfied, and a `reduced` regime is a **relaxation** — earning it across a history entry CIVOS cannot read is precisely "treating unknown as satisfied". The orchestrator's skip can grant 3-instead-of-6 off an unreadable history, an **under-testing** error; this version's cost is that a mis-typed lot keeps its neighbours at **full** frequency until someone classifies it — an over-testing error plus a nudge toward the data hygiene C1 wants. Note it does **not** mark the stream non-conforming permanently: classify the lot and the stream heals on the next read. Jay/orchestrator can overrule; the flag is here because the two options differ in which direction they fail.

**D8 — TfNSW pack scope.** → **Count only (n = 6); no CDR.** A statistic over result values needs C3's LIMS-grade data, and a half-implemented statistical acceptance test produces confident wrong compliance answers. Reviewer strongly agrees, and adds the sharper point now encoded in §8.1: even the count is C-graded, so R44 is `draft`-forever pending appendix §H item 5.

**D9 — New dependencies.** → **None.** Arithmetic over data already fetched plus one bounded query. Recorded as a decision, not an omission.

**D10 — The unused `overdue_test` alert type** (F0 open decision 3, `f0-execution-spec-2026-07-24.md:167`). → **Delete it in C1.0, with migration safety** `[C1R-B9]`. Rev 1 called it unconsumed; §2.7 proves it has a **live write path** (`alerts.ts:118` → `alertPersistence.ts:43`) and a **fail-closed read path** (`parseAlertType` throws → `toAlert` → `GET /api/notifications/alerts` maps the whole list, so one legacy row 400s the alerts list). Required steps:

1. **Either** a pre-deploy assertion that `SELECT count(*) FROM notification_alerts WHERE type = 'overdue_test'` is **0**, **or** make `toAlert` tolerant of unknown types (skip-and-log) **first**, in a separate earlier PR. Recommended: the tolerant-`toAlert` route, because it is a permanent robustness win and does not depend on prod state at deploy time.
2. Remove **both** `AlertType` declarations (`notificationAlertConfig.ts:8` **and** `alertMappers.ts:22`).
3. Name the **`byType` public response-shape change** (`systemAlertResponses.ts:56`) in the PR body.
4. Note the escalation `IN`-list narrowing (`notificationAlertConfig.ts:33` → `notificationAutomation/alertEscalations.ts:16` → `:228`).
5. Update four assertions: `alertMappers.test.ts:53`, `alertPersistence.test.ts:71-94`, `systemAlertResponses.test.ts:64`, `:75`.
   Cleared: no Prisma enum, no migration, zero frontend references, no saved preference keyed to it.

**D11 — Surface for retroactive shortfalls (NEW).** → **Extend the conformed/claimed short circuits** (§5.1.3), with the corpus regenerated and reviewed in C1.1 and the §5.3 prohibition enforced by AT-11. Alternative for Jay: claim-bucket-only. See §16.0.

**D12 — Permission matrix (NEW).** → §10.2 as written; the spec's own design calls, Jay-visible. See §16.0.

**D13 — Confirmation sequencing (NEW).** → **Confirm before encoding** (§8.3), per plan line 75. Front-loads a human task; the alternative is a recorded deviation. See §16.0.

---

## 17. Verification notes, plan corrections, and refutations

### 17.1 Verified, and two corrections to the plan itself

**Verified against code at `3fe7eadd`** — every `file:line` in §2, plus the absences that shape the design: no lot quantity or scale field; `Lot.activityType` free text; **zero occurrences** of any cover/pre-cover concept in `backend/src` or `frontend/src` (`grep -riE "\bpre-?cover|cover-?up|coverUp|preCover"` → 0).

**Plan correction 1 — "gates before cover".** Program line 75 lists "proactive gates before cover/conform/claim" as if cover were an existing decision point. It is not. §5.2/D2 map it onto the witness point that already models it; that is a **design decision, not an implementation of something present** — the one place the program's wording overstates the current system.

**Plan correction 2 — "whichever is lesser" `[C1R-C11]`.** Program line 15 frames the "whichever is the lesser" clause as part of the _frequency_ rule. The appendix's underlying claim scopes it to **lot size** ("Type A lot = one day's production or 5,000 m², whichever is the lesser"). §3.3 follows the appendix, not the plan; the plan's framing is the mangled one. Promoted here on the reviewer's recommendation.

**Plan tension — the chainage sentence.** The program's target explanation includes "no sample for CH 1,240–1,310", a **spatial coverage** claim needing per-test location. §4.4 drops the clause; C3 restores it.

**Carried forward without independent verification:** the VicRoads 204 figures (2015 council republication) and R44's unpinned edition. §8.3 makes confirmation a C1.0 precondition rather than a promise. TMR / DIT SA / MRWA numerics excluded entirely.

### 17.2 Reviewer claims REFUTED with evidence

Two of the fifteen recommendations do not survive checking. Both are recorded rather than folded, per the standing rule that a wrong fix must not be encoded.

**`[C1R-5]` — "Fix the file path: the gate lives at `backend/src/lib/conformancePrerequisites.ts`, NOT under `evidenceReadiness/`." → REFUTED. There is no wrong path in Rev 1.** Rev 1 contains exactly two `evidenceReadiness`-prefixed citations, and both are correct:

- `evidenceReadiness/conformanceItems.ts:68` — the file **is** `backend/src/lib/evidenceReadiness/conformanceItems.ts`, and `buildConformanceBlockerItems` **is** its export at that line.
- The §11 file-ownership list names `conformancePrerequisites.ts` **and** `evidenceReadiness/conformanceItems.ts` as two separate C1-owned files, which is right.

Every one of Rev 1's nine `conformancePrerequisites.ts` citations already used the correct un-prefixed path. Verified by `grep -n "evidenceReadiness" docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md` at Rev 1's `da847c55` content — two hits, both correct. Nothing changed.

**`[C1R-1]` (sourcing limb only) — "The 'for statistical validity' quote is plan line 15's, not the appendix's." → PARTIALLY REFUTED.** The phrase appears in **both**. Plan line 15 has "separate minimum count for statistical validity"; the appendix's R44 row states, in its Decision-supported column, "**C1 statistical-validity constraint separate from area coverage**". So Rev 1's attribution to the appendix was defensible. **The substantive half of `[C1R-1]` is accepted in full and folded** (§3.2.1): no cited authority supplies a per-area frequency figure, so `max()` is a no-op for everything C1 ships, and Rev 1's illustrative "1-test-per-500 m²" was invented and is withdrawn. Only the sourcing accusation is corrected.

**Minor citation slips in the review, folded with corrections rather than as-written:**

- `[C1R-B9]` cited `alertEscalations.ts:16`/`:228` without its directory; the file is `backend/src/lib/notificationAutomation/alertEscalations.ts` and both line numbers are right (§2.7).
- `[C1R-B3]` counted "six hardcoded `resultSchemaVersion: 1` assertions"; there are **eleven** in `recordDecision.db.test.ts` alone (`:75`, `:252`, `:280`, `:287`, `:311`, `:390`, `:563`, `:570`, `:838`, `:889`, `:897`). The finding is strengthened, not weakened (§5.4.2).
- `[C1R-B1]` notes `ConformancePrismaClient` has no `project` key. True, and it constrains nothing — the widened `include` rides the existing `lot` delegate (§4.1.1). Recorded so a build agent does not widen the client type for no reason.
- `[C1R-B4]`'s measured figures were reproduced independently: worst-case `claim_member` payload **429 bytes**, headroom **595**. Exact.

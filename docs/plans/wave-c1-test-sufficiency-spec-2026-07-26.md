# Wave C1 Execution Specification — Test Sufficiency Rules Engine + Gates

**Date:** 26 July 2026 · **Status:** Rev 1 — awaiting adversarial review and Jay's decisions D1–D10
**Program contract:** `C:\Users\jayso\Documents\CIVOS-Validated-Buildout-Plan-2026-07-24.md` §3 Wave C (line 75), governed by §9 (delivery control), §6 (completion standards), §7 (security), §8 (scale targets).
**Research register:** `C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md` §A (grades + revalidation obligations).
**Foundation:** `docs/plans/f0-execution-spec-2026-07-24.md` (Rev 3.1). F0 is **complete and live on prod** — C1 extends it and adds no parallel engine.
**House style:** matches `docs/plans/wave-b-migration-importer-spec-2026-07-26.md` (Rev 2) — cited current-state map, PROPOSED Prisma, phase slicing, benchmark targets, exit gate, numbered decisions.

**All `file:line` citations in this document were read in this worktree at HEAD `3fe7eadd` (= `origin/master` at authoring time).** Re-verify line numbers at build time — the F0 staleness lesson applies (`f0-execution-spec-2026-07-24.md:4`).

---

## 1. Outcome, scope and non-goals

**Outcome:** a contractor asks "does this lot have **enough** passing tests?" and CIVOS answers with a number, a rule citation and a plain-English explanation — _before_ the lot is covered, conformed or claimed. Today the answer is existential ("is there at least one passing verified test per test-required ITP item?", `conformancePrerequisites.ts:437-441`); C1 makes it **quantitative and spec-keyed**, and it makes the shortfall visible at the three moments where it costs money.

**The wedge (program §1, line 15):** CivilPro already _configures_ test frequencies. C1's differentiator is the **proactive gate** — a shortfall surfaced at pre-cover / conform / claim rather than discovered at handover — plus the honest degradation semantics of §7 (a lot with no recorded quantity says "I cannot check", never "you're fine").

**Included (C1):**

- A declarative, versioned **frequency-rule vocabulary** (§3) supporting: per-lot minimum count by scale · per-quantity (area / volume / tonnage / length) · maximum lot size (advisory) · the escalate/de-escalate **frequency-regime state machine**.
- A **pure evaluator** producing an F0-shaped verdict over the existing `reasonCode` vocabulary (§4), satisfying the already-declared `TestSufficiencyVerdict` contract (`backend/src/lib/readiness/contracts/futureConsumers.ts:27-37`).
- **Resolution** of ruleset + scale + quantity for a lot from data that already exists (`Project.state` / `Project.specificationSet`, `Lot.activityType`, `Lot.layer`, `LotGeometry.areaM2`) plus three new nullable lot fields (§6).
- **Surfacing** in the shipped lot-readiness surface (`GET /api/lots/:id/readiness`, `qualityRoutes.ts:265`; `LotReadinessPanel.tsx:267`) — no new page, no new panel.
- **Gates** at three decision points (§5): conform (block, opt-in per project), hold-point request/release = the pre-cover moment (warn, never block), claim inclusion (warn, never block).
- **Seed packs**: VicRoads Section 204 + one TfNSW ruleset, each gated behind the **currency-confirmation step** of §8 — encoded as `draft` and advisory-only until a human re-verifies the numbers against the current published edition.
- **Snapshot provenance**: the sufficiency verdict is recorded inside the existing `RequirementEvaluation` snapshot written by `recordDecision` (`recordDecision.ts:423`), at bumped `resultSchemaVersion` (§5.4).

**Non-goals (explicit — do not build in C1):**

- **C2 sample lifecycle** — planned sample → request → sampled → lab pending → certificate → extraction → verification → recalc; certificate-to-sample reconciliation; overdue-lab chasing; external lab upload link. C1 counts the `TestResult` rows that already exist; it never models a sample.
- **C3 spatial + LIMS** — tested/under-tested map overlay, TfNSW LIMS tabulated ingestion, and user-authored/overridable rulesets (see D3 boundary note). C1 rulesets are shipped code, not tenant data.
- **C4 evidence integrity** — duplicate certificate/sample detection, preliminary-vs-final, anomaly flags. C1 counts distinct `TestResult` rows and does **not** detect that two rows describe the same sample (§7, known ceiling).
- **C5 survey/material traceability.**
- **Statistical acceptance computation.** TfNSW R44's Characteristic Density Ratio (CDR) with k-values is a _statistic over the results_, not a count of them. C1 encodes only the **n = 6 minimum sample count** that makes the statistic valid (appendix §A row 3) and computes **no** CDR. The CDR itself is C3/LIMS work. (D8.)
- **Test-register import** — deferred past Wave C per program §9; Wave B §1 already excludes it, and it stays excluded until the C2 sample model is final.
- **New alert types.** Sufficiency surfaces in readiness, not as a new alert stream (the A2 backlog is 3,669 rows). See D10 for the fate of the existing unused `overdue_test` type.
- **Automatic compliance declarations.** Every output is decision support with a clause citation attached. CIVOS never states that a lot complies with a specification.
- **No shell changes.** `frontend/src/shell/**` (the foreman/subbie mobile shell) is untouched. A mobile sufficiency indicator is desirable and is **Jay-gated** — listed as out of scope, not silently omitted.

---

## 2. Current-state map (cited, read at `3fe7eadd`)

### 2.1 The F0 backbone C1 builds ON

| Concern                                      | Where                                           | Note                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Predicate library                            | `backend/src/lib/readiness/predicates.ts`       | `testPassing` = `passFail === 'pass' && status === 'verified'` (L149-151) — single-sourced, **not** divergent. `testMatchesItem` (L202-208): `itpChecklistItemId` link is strongest, case-insensitive `testType` equality is the legacy fallback. `lotConformable` (L324-332) is the authoritative conform composition. |
| Closed reasonCode vocabulary                 | `contracts/reasonCodes.ts:29-72`                | 41 codes; `READINESS_REASON_CODES` is **closed** — "If the engine gains a code, add it here (and its provenance) in the same change; the contract test fails otherwise" (L26-27).                                                                                                                                       |
| Provenance map                               | `contracts/reasonCodes.ts:86`                   | Every code maps to a predicate export **or** `'engine'`.                                                                                                                                                                                                                                                                |
| Contract test teeth                          | `contracts/contracts.test.ts:59-64`             | Asserts every non-`engine` provenance predicate is a real export of `../predicates.js`. **Load-bearing for §4.2.**                                                                                                                                                                                                      |
| Test-sufficiency contract (already declared) | `contracts/futureConsumers.ts:22-37`            | `TestReasonCode` = `no_passing_verified_test \| no_tests \| failed_tests \| pending_tests \| passing_tests`; `TestSufficiencyVerdict = { subjectType: 'lot' \| 'itp_item', subjectId, sufficient, reasonCodes }`. C1 **satisfies and extends** this — it is the minimum, explicitly marked as extensible (L34-36).      |
| Atomic decision writer                       | `readiness/recordDecision.ts:423`               | Serializable + bounded retry; caller-supplied `evaluate` / `mutate` / `snapshots`. Size budgets: member rows ≤ 1 KB (L151), aggregate/single ≤ 64 KB (L154).                                                                                                                                                            |
| Snapshot table                               | `backend/prisma/schema.prisma:1690`             | `RequirementEvaluation`, immutable, `@@unique([auditLogId, entityType, entityId])`.                                                                                                                                                                                                                                     |
| Requirement-set modules                      | `readiness/requirements/*.v1.ts`                | Code-defined, versioned. `lotConformance.v1.ts:16-17` fixes the set name + `resultSchemaVersion`. `shared.ts:41` `blockingReasonCodes`, `shared.ts:61` `decodeAtVersion1`, `shared.ts:75` `truncateReasonText`.                                                                                                         |
| The unique-key note C1 tests                 | `docs/plans/f0-execution-spec-2026-07-24.md:72` | "one decision never evaluates one entity under two requirement sets; extend the key only if that ever becomes true." **C1 is the first case where it could become true** — resolved in §5.4 without widening the key.                                                                                                   |

### 2.2 Today's test gate — existential, not quantitative

| Concern                        | Where                                      | Behaviour                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Which ITP items require a test | `conformancePrerequisites.ts:250-256`      | `isRequiredTestItem` = `evidenceRequired === 'test' \|\| Boolean(testType)`.                                                                                                               |
| Per-item satisfaction          | `conformancePrerequisites.ts:258-270`      | `hasVerifiedPassingTestForItem` — **`.some()`**: one matching passing verified test satisfies the item, however large the lot.                                                             |
| Lot-level gate                 | `conformancePrerequisites.ts:437-441`      | `hasPassingTest = requiredTestItems.length > 0 && requiredTestItems.every(hasVerifiedPassingTestForItem)`. **This is the count ceiling C1 raises: `every` over items, `some` over tests.** |
| Outstanding-test breakdown     | `conformancePrerequisites.ts:276-311`      | Presentation-only per-item states `no_result \| awaiting_verification \| failing \| unmatched_result_exists`. C1 adds a _count_ dimension alongside, and reuses this shape.                |
| Data the gate fetches          | `conformancePrerequisites.ts:316-353`      | `CONFORMANCE_LOT_INCLUDE` selects `testResults { id, itpChecklistItemId, testType, passFail, status }` — **already enough to count**; no extra per-lot test query is needed.               |
| Single + batch entry points    | `conformancePrerequisites.ts:520`, `:543`  | `checkConformancePrerequisites(lotId, client)` and `checkConformancePrerequisitesBatch(lotIds, client)` — the batch path is what claim create uses, so C1 must be batchable (§9).          |
| Blocker items                  | `evidenceReadiness/conformanceItems.ts:68` | `buildConformanceBlockerItems`; the test blocker `no_passing_verified_test` is L104-122 and already carries a structured `outstandingTests[]`.                                             |
| Pending-test whitelist         | `backend/src/lib/testResultStatus.ts:1-8`  | `PENDING_TEST_RESULT_STATUSES` = pending, submitted, requested, at_lab, results_received, entered.                                                                                         |

### 2.3 Ruleset-keying data that already exists

| Key                    | Where                                                                                                                                                             | Note                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authority / spec set   | `schema.prisma:373-374`                                                                                                                                           | `Project.state` (required) and `Project.specificationSet` (required).                                                                                                                                                                                                                                                                     |
| Spec-set normalization | `itpMatcher.ts:74-83`                                                                                                                                             | `SPEC_SET_SYNONYMS = { rms: 'tfnsw' }`; `normalizeSpecSet` lowercases + folds. Prod holds `{TfNSW, MRTS, rms, AUS-SPEC}` (L67-73). **C1 reuses this function — it does not write a second normalizer.**                                                                                                                                   |
| National baselines     | `itpMatcher.ts:96`                                                                                                                                                | `NATIONAL_BASELINE_SPECS = {austroads, aus-spec, ipwea, wsa, national}`. A project on a national baseline has **no authority frequency ruleset** → `unknown`, never `insufficient` (§7).                                                                                                                                                  |
| Activity taxonomy      | `activityTaxonomy.ts:61` (`CANONICAL_ACTIVITIES`, 38 Level-2 slugs / 10 families), `:286` (`foldActivityValue` → `{slug, confidence: 'exact'\|'family'\|'none'}`) | Rules key on Level-2 slugs. A **family-level** or **unmappable** fold cannot select a rule confidently → `unknown` (§7). Taxonomy spec: `docs/research/wave2-itp-matching-taxonomy-spec-2026-07-15.md` §1.                                                                                                                                |
| Layer / material zone  | `schema.prisma:552-553`                                                                                                                                           | `Lot.layer`, `Lot.areaZone` — free text (`bulkCreateCore.ts:33`). Rules that discriminate by layer match case-insensitively against a declared alias list; no match → the rule's layer-agnostic variant, or `unknown`.                                                                                                                    |
| Test-type vocabulary   | `backend/src/routes/testResults/specifications.ts:23-`                                                                                                            | 13 keys (`compaction`, `cbr`, `moisture_content`, `plasticity_index`, `liquid_limit`, `grading`, `sand_equivalent`, `concrete_slump`, `concrete_strength`, `asphalt_density`, `asphalt_thickness`, `dcp`, `permeability`) with `specificationMin/Max` and a `specReference`. **This is the existing test-type vocabulary rules bind to.** |
| Chainage               | `schema.prisma:548-549`, `:463-502`                                                                                                                               | `Lot.chainageStart/End` (Decimal), `LotGeometry.chainageStart/End`, `offsetLeft/Right`. Enables the "no sample for CH 1,240–1,310" phrasing the program asks for (line 75) **only** where tests carry a location — see §7 ceiling.                                                                                                        |

### 2.4 What does **not** exist (verified absences — these are the real gaps)

1. **No lot quantity of any kind.** `Lot` (`schema.prisma:542-609`) has `chainageStart/End`, `layer`, `areaZone`, `budgetAmount` — and **no area, volume, tonnage or production-quantity field**. The only quantity anywhere is `LotGeometry.areaM2` (`schema.prisma:492`, "computed; user-overridable") and `LotGeometry.lengthM` (`:493`), present only for spatially-defined lots. **Every per-quantity rule is unevaluable without new storage** (§6, D5).
2. **No test scale.** VicRoads 204's Scale A/B/C selection has no home. (§6, D6.)
3. **No "cover" concept — zero occurrences.** `grep -riE "\bpre-?cover|cover-?up|coverUp|preCover"` over `backend/src` + `frontend/src` returns **0 matches**. The program's "proactive gates before cover" (line 75) has **no existing event to hang on**. §5.2 proposes riding the hold/witness-point request instead of inventing a workflow; D2 is the decision.
4. **No production-day grouping.** `Lot` carries `createdAt` only — nothing records "this lot is one day's production". The "one day's production or 5,000 m², whichever the lesser" rule is therefore encoded as a **lot-sizing advisory** on the area limb only (§3.3), never as a hard count input.
5. **No frequency-regime state.** Nothing records "this stream is on reduced testing". §3.4 computes it.
6. **`overdue_test` alert type exists but is never produced.** `notificationAlertConfig.ts:8` declares it, `:32` comments "kept though unused (F0 spec)", `:44` configures it; `alertMappers.ts:22,49` and `systemAlertResponses.ts:56` carry it. F0 open decision 3 (`f0-execution-spec-2026-07-24.md:167`) is "wire in C1 or delete" → D10.
7. **No `@@index` supporting a frequency-stream lookup.** `Lot` has `@@index([projectId, conformedAt])` (`schema.prisma:606`) but nothing including `activityType`. §6 adds one.

### 2.5 Existing spec-fact precedent in the seeders

`backend/scripts/seeds/itp-templates/index.mjs` registers 41 seeders keyed `(state, activity)`; VIC/VicRoads packs exist for earthworks, asphalt, drainage, environmental, pavements, road-furniture, structures, conduits. The VIC earthworks seeder already carries clause-level provenance in prose:

- `seed-itp-templates-vic-earthworks.js:9` — "Based on: VicRoads Section 204 (Earthworks), Section 173"
- `:23` — "VicRoads Section 204 Earthworks (December 2015, Version 7)" — **the same 2015 edition the research appendix flags for revalidation**
- `:55` — `acceptanceCriteria: 'Lot sizes comply with Table 204.142; max 500 m2 under paved areas; testing scale and frequency defined per RC 500.05'`
- `:118` — `notes: 'Section 204.06. W - Notify Superintendent before covering.'` ← **the existing "cover" moment in CIVOS is a witness point on an ITP item.** This is the evidence behind §5.2/D2.

The seeders prove the provenance discipline is already practised, and they prove the numbers are currently embedded in **prose strings** that nothing can evaluate. C1 lifts the _facts_ into structured rules and leaves the prose where it is.

---

## 3. Domain model — how a sufficiency ruleset is represented

### 3.1 Placement decision: code, not database

Rulesets are **code-defined, versioned TypeScript modules**, exactly as F0 realises `RequirementDefinition` (`f0-execution-spec-2026-07-24.md:29`: "Code-defined, versioned requirement sets … No DB table in F0"). F0 §1 lists "DB-authored RequirementDefinitions / rule engine → C1" as excluded-with-owning-wave (`:23`) — C1 owns the **rule engine**; it deliberately does **not** take the _DB-authored_ half.

Why code:

- A seeded authority ruleset is **shipped product data with provenance**, not tenant data. It must be reviewable in a PR diff, testable in CI, and revertable by `git revert`. A DB table gives none of that.
- Versioning is free: `vicroads-204.v1.ts` beside `vicroads-204.v2.ts`, the registry pins which is active per effective date, and a snapshot recorded under v1 stays decodable (`shared.ts:61` `decodeAtVersion1` is the precedent).
- **Tenant-authored / overridable rulesets are explicitly C3** (program line 77: "controlled overrides (selectable spec regimes + audited free override)"). Building a definition table in C1 for a C3 requirement is speculative. When C3 needs it, the code registry becomes the seed source for the table — the shape is unchanged.

`ponytail:` code-defined rulesets, zero ruleset DDL. The DB gets a definition table when C3 needs tenant overrides, not before.

Proposed layout:

```
backend/src/lib/readiness/sufficiency/
  types.ts            # the rule vocabulary + provenance shape (§3.2)
  registry.ts         # resolve (state, specSet, activitySlug, layer, effectiveDate) -> ruleset
  regime.ts           # the frequency-regime state machine (§3.4)
  evaluate.ts         # PURE: resolved inputs -> SufficiencyVerdict (§4)
  rulesets/
    vicroads-204.v1.ts
    tfnsw-r44.v1.ts
    index.ts          # explicit static imports; NOT dynamic (unlike the ITP seeders)
```

### 3.2 The rule vocabulary (PROPOSED)

```ts
/** Authority provenance. Every field is required — an unprovenanced rule cannot be registered. */
export interface RulesetProvenance {
  authority: string; // 'VicRoads' | 'TfNSW' | ...
  document: string; // 'Section 204 — Earthworks'
  edition: string; // 'December 2015, Version 7'
  clause: string; // '204.14(c)' — clause/table, never prose
  pdfPage?: number; // recorded at the confirmation pass (§8)
  sourceUrl: string; // the URL the appendix row cites
  evidenceGrade: "A" | "B" | "C" | "D"; // from the research appendix; C1 accepts A only for gating
  checkedOn: string; // ISO date a human last read the source
  revalidateBy: string; // ISO date; CI fails a `confirmed` ruleset past this (§8)
}

export type QuantityUnit = "m2" | "m3" | "t" | "m" | "each";

export interface FrequencyRule {
  /** Stable, referenced by snapshots forever. e.g. 'vicroads-204.v1/compaction-density'. */
  id: string;
  /** Short human label. Facts only — NEVER a quotation of specification prose (§10). */
  label: string;
  /** Test-type key from `routes/testResults/specifications.ts`. */
  testType: string;
  appliesTo: {
    activitySlugs: readonly string[]; // Level-2 slugs (activityTaxonomy.ts:61)
    layerAliases?: readonly string[]; // case-insensitive match against Lot.layer
  };
  /** Statistical-validity floor, per scale. Scale key set is ruleset-defined. */
  minCountByScale: Readonly<Record<string, number>>;
  /** Coverage limb: one test per `every` units of `unit`. */
  perQuantity?: { unit: QuantityUnit; every: number };
  /** Advisory only: the ruleset's maximum lot size. Never blocks (§3.3). */
  maxLotSize?: { unit: QuantityUnit; value: number };
  /** The de-escalated regime. Absent = this rule has no reduced regime. */
  reduced?: {
    minCountByScale: Readonly<Record<string, number>>;
    perQuantity?: { unit: QuantityUnit; every: number };
    /** N consecutive conforming lots in the stream to earn it. */
    consecutiveConformingLots: number;
    /** The only escalation shape C1 implements (§3.4). */
    escalationShape: "reset_on_any_failure";
  };
  provenance: RulesetProvenance;
}

export interface Ruleset {
  id: string; // 'vicroads-204.v1'
  state: string; // matched case-insensitively against Project.state
  specSet: string; // pre-normalized via itpMatcher.normalizeSpecSet
  scaleKeys: readonly string[]; // e.g. ['A','B','C'] — what a lot may declare
  effectiveFrom: string; // ISO
  effectiveTo?: string; // ISO; set when superseded
  /**
   * 'draft'  — registered, evaluated, but ADVISORY ONLY and labelled
   *            "unconfirmed edition"; can never block (§8).
   * 'confirmed' — a human verified every number against the cited edition.
   */
  status: "draft" | "confirmed";
  rules: readonly FrequencyRule[];
  provenance: RulesetProvenance;
}
```

**Required count for a rule** (given a resolved scale + quantity, in the resolved regime):

```
requiredCount = max( minCountByScale[scale] ,
                     perQuantity ? ceil(quantity / perQuantity.every) : 0 )
```

The `max` is deliberate and is the appendix's reading: the per-lot minimum count exists "for statistical validity" **separately** from area coverage (appendix §A rows 1 and 3). A 200 m² lot at 1-test-per-500 m² still needs its 6-test floor. **D4** puts this reading to Jay explicitly because it is the single most consequential arithmetic choice in the wave.

### 3.3 "Whichever is the lesser" is a lot-SIZING rule, not a count rule

The appendix's VicRoads clause is _"Type A lot = one day's production or 5,000 m², whichever is the lesser"_ — that constrains how big a lot may be, not how many tests it needs. CIVOS has **no production-day record** (§2.4 item 4), so the day limb is unevaluable and C1 does not pretend otherwise. C1 evaluates only the area limb, as `maxLotSize`, and only as a **warning**:

> `lot_exceeds_max_lot_size` — "This lot is 7,400 m². VicRoads Sec 204 Table 204.142 caps a Type A lot at 5,000 m² (or one day's production, whichever is lesser — CIVOS cannot check the production-day limb). Consider splitting the lot."

It never blocks: the lot already exists, and blocking would punish the user for a decision already taken. The 500 m²-under-paved-areas limb (`seed-itp-templates-vic-earthworks.js:55`) is encoded as a second `maxLotSize` variant on the paved-area rule.

### 3.4 The frequency-regime state machine — COMPUTED, never stored

**The tension.** F0's governing principle is "readiness is computed, never a stored `ready=true` flag — a stored value must not silently go stale when evidence is superseded" (program §2, F0 spec `:6`). But the VicRoads 204.14(c) regime is inherently _sequential_: "test every lot until 3 consecutive conform → reduced frequency; any failure reverts to full testing" (appendix §A row 2, grade A). Sequence memory looks like state.

**Resolution: compute the regime from history at evaluation time.** Not for doctrinal tidiness — because a stored regime would be **wrong**, in exactly the way F0 warns about:

> A test on lot 2 is later corrected to `fail`. A stored regime on lots 5–12 would still read "reduced", and every one of them would keep reporting "3 tests required" when the authority requires 6. The failure would be invisible until handover — the precise defect Wave C exists to prevent. A computed regime re-derives and those lots immediately report a shortfall, which is `conformance_no_longer_current` semantics the claim gate already implements (`reasonCodes.ts:122-125`).

**The bounded computation.** A naive fold over a 5,000-lot stream would be O(n) per evaluation. It is unnecessary. For the only escalation shape C1 implements (`reset_on_any_failure`), the regime is a **function of the last N stream entries alone**:

> _Claim._ Let the stream be a sequence of decided lots, each conforming or failing. Regime is `reduced` iff the last `N` entries are all conforming.
> _Proof sketch._ Full → reduced requires N consecutive conforming entries. Any failure resets to full and discards accumulated credit, so re-entry requires N fresh consecutive conforming entries. Therefore at any point, `reduced` holds iff no failure has occurred in the last N entries and at least N entries exist — i.e. iff the last N entries are all conforming. ∎

So the query is `take: N` (N = 3 for VicRoads 204), ordered descending — **three rows, index-covered**, not five thousand.

`ponytail:` bounded 3-row lookback, valid for the `reset_on_any_failure` shape only. A ruleset with a different escalation shape (credit that survives a failure, time-windowed regimes, per-subcontractor regimes) must declare a new `escalationShape` and gets its own evaluator — the registry rejects an unknown shape rather than silently mis-evaluating it.

**Stream identity.** `streamKey = (projectId, rulesetId, ruleId, activitySlug, normalizedLayer)`. "Work of the same type in the same project" is the defensible reading; subcontractor and material source are _not_ in the key (D7).

**Stream order.** `Lot.conformedAt ASC`, tiebreak `Lot.createdAt ASC`, tiebreak `Lot.id ASC` (total order, deterministic). Only lots with a non-null `conformedAt` are stream entries — an undecided lot has not yet established conformity. This makes the dependency acyclic: lot N's regime depends only on lots decided before it, so there is no circularity between "can this lot conform" and "what regime applies".

**Stream entry conformity** for regime purposes = the lot conformed **and** has no `passFail === 'fail'` test result attributable to the rule. A force-conformed lot (`Lot.conformanceOverriddenAt`, `schema.prisma:568`) counts as **non-conforming for regime purposes** — an override is a commercial/programme decision, not evidence that the material passed. That asymmetry is deliberate and is recorded in the snapshot.

**Provenance.** The snapshot records `regime: 'full' | 'reduced'`, `regimeBasis: { streamKey, lotIds: string[] }` (≤ 3 ids) and `requiredCount` — so an auditor can see exactly which three lots earned a reduced frequency, years later, without re-running the engine.

---

## 4. Rule evaluation — inputs, outputs, plug-in points

### 4.1 Inputs (all already fetched, except the three new lot fields)

| Input                      | Source                                                                                                          | Note                                                                                                                                                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passing tests              | `conformancePrerequisites.ts:316-353` `CONFORMANCE_LOT_INCLUDE.testResults`                                     | `{id, itpChecklistItemId, testType, passFail, status}` — **no new query for the lot's own tests**.                                                                                                                                             |
| Test attribution to a rule | `predicates.ts:202-208` `testMatchesItem`, plus direct `TestResult.testType` equality                           | A test counts toward rule R iff `testPassing(t)` **and** (`t.itpChecklistItemId` links an item whose `testType` normalizes to `R.testType`, **or** `normalize(t.testType) === R.testType`). Reuses the shipped matcher — no second match rule. |
| Required ITP items         | `conformancePrerequisites.ts:250-256` `isRequiredTestItem`                                                      | Sufficiency only applies where the ITP already requires a test. A lot whose ITP has no test point gets **no** sufficiency item — mirroring the existing guard at `conformanceItems.ts:101-104`.                                                |
| Ruleset + rules            | `sufficiency/registry.ts`                                                                                       | Keyed `(normalizeSpecSet(Project.specificationSet), Project.state, foldActivityValue(Lot.activityType).slug, Lot.layer)`.                                                                                                                      |
| Scale                      | `Lot.testScale` (new, §6)                                                                                       | Must be a member of the resolved ruleset's `scaleKeys`; otherwise `unknown`.                                                                                                                                                                   |
| Quantity                   | `Lot.quantityValue`/`quantityUnit` (new, §6), falling back to `LotGeometry.areaM2` when the rule's unit is `m2` | Resolution order and the fallback are recorded in the verdict so the user can see _which_ number was used.                                                                                                                                     |
| Regime                     | `sufficiency/regime.ts`                                                                                         | One bounded `take: 3` query per (lot, rule) stream; memoized per request.                                                                                                                                                                      |

### 4.2 Outputs — three-valued, over the F0 vocabulary

```ts
export type SufficiencyState = "satisfied" | "insufficient" | "unknown";

export interface RuleSufficiency {
  ruleId: string;
  testType: string;
  state: SufficiencyState;
  requiredCount: number | null; // null when unknown
  passingCount: number;
  pendingCount: number;
  failedCount: number;
  regime: "full" | "reduced" | null;
  regimeBasis?: { streamKey: string; lotIds: string[] };
  /** Why it is unknown; empty otherwise. */
  unknownCauses: readonly UnknownCause[];
  citation: {
    authority: string;
    document: string;
    clause: string;
    edition: string;
    confirmed: boolean;
  };
}

export type UnknownCause =
  | "no_ruleset_for_project" // national-baseline spec set, or no pack for this authority
  | "no_rule_for_activity" // ruleset exists, no rule matches the activity/layer
  | "activity_not_canonical" // foldActivityValue confidence 'family' | 'none'
  | "scale_not_selected" // rule is scale-keyed, Lot.testScale is null
  | "scale_not_recognised" // Lot.testScale not in ruleset.scaleKeys
  | "quantity_missing" // rule has a perQuantity limb, no quantity resolvable
  | "ruleset_edition_unconfirmed"; // ruleset.status === 'draft' (§8) — advisory only
```

The lot-level verdict satisfies the declared contract (`futureConsumers.ts:27-37`) and extends it:

```ts
export interface TestSufficiencyVerdict {
  // extended, not replaced
  subjectType: "lot" | "itp_item";
  subjectId: string;
  sufficient: boolean; // true iff EVERY rule is 'satisfied'
  reasonCodes: TestReasonCode[]; // existing subset, unchanged
  // C1 additions:
  state: SufficiencyState; // 'unknown' when any rule is unknown and none insufficient
  rules: RuleSufficiency[];
}
```

`sufficient: false` for an `unknown` verdict — **unknown never reads as satisfied.** But `unknown` also never blocks (§7).

### 4.3 New reason codes (extend the CLOSED vocabulary — required, not optional)

`READINESS_REASON_CODES` (`reasonCodes.ts:29-72`) is closed and contract-tested. C1 adds five codes **and their provenance entries in the same change**, or CI fails:

| New code                     | Severity                        | Meaning                                                                                                                 |
| ---------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `insufficient_test_count`    | blocker (`blocksAction` per §5) | Required N, have M passing verified.                                                                                    |
| `test_sufficiency_unknown`   | warning                         | One or more `UnknownCause` — names the missing input.                                                                   |
| `lot_exceeds_max_lot_size`   | warning                         | §3.3, never blocks.                                                                                                     |
| `tests_unlinked_to_itp_item` | warning                         | Passing tests exist that no rule could attribute (the count-side twin of the existing `unmatched_result_exists` state). |
| `test_sufficiency_met`       | positive (support)              | The satisfied case, so the panel can show the _proof_, not just silence.                                                |

**Provenance and the contract test.** `contracts.test.ts:59-64` asserts every non-`engine` predicate name is a real export of `../predicates.js`. So `predicates.ts` gains **one** re-export:

```ts
// predicates.ts — the sufficiency evaluator's boolean limb, re-exported so the
// provenance map can cite a real predicate-library export (contracts.test.ts:59).
export { testCountSufficient } from "./sufficiency/evaluate.js";
```

No test is weakened, no provenance entry is dishonestly tagged `'engine'`, and the sufficiency logic still lives in its own module. This is the one structural accommodation C1 makes to F0's machinery, and it is a re-export, not a move.

### 4.4 Plain-English explanation

The program (line 75) specifies the target sentence. The evaluator produces it from facts only:

> **Not ready to conform.** Requires **6** density tests (VicRoads Sec 204, Table 204.142, Scale B, full frequency — 2015 edition, unconfirmed). **4** verified conforming, **1** pending at lab, **1** without a result. _Full frequency applies: lot LOT-0104 failed within the last 3 lots of this stream._

Rules: counts and clause references only; no quotation of specification prose (§10); the "unconfirmed" tag appears whenever `ruleset.status === 'draft'`; the regime sentence appears only when a `reduced` regime exists for the rule, and always names its basis.

---

## 5. Decision points and gate strength

### 5.1 Conform — BLOCK, opt-in per project

`POST /api/lots/:id/conform` already runs through `recordDecision` (`qualityRoutes.ts:446`) with `evaluate` calling `checkConformancePrerequisites(id, tx)` inside the serializable transaction (`:464-465`) and rejecting when `!canConform && !force` (`:472-477`).

Sufficiency becomes a **new prerequisite limb** inside `computeConformanceResult` — one place, so the single path (`:520`) and the batched claim path (`:543`) cannot diverge, and `lotConformable` (`predicates.ts:324-332`) stays the authoritative composition.

**Why not simply block everywhere on day one.** Turning sufficiency into a hard prerequisite changes conformance for every lot in every live project at once: today a 5,000 m² earthworks lot conforms on one passing density test. Flipping that to six would mass-block real production work with no warning — the "silently changes behaviour under users" failure mode. So the gate is **per-project, three-valued**, mirroring F0's flag discipline (`f0-execution-spec-2026-07-24.md:117-124`):

| `Project.testSufficiencyMode` | Behaviour                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `off`                         | Sufficiency is evaluated and **shown** in readiness; never contributes to `canConform`.                                                                                                                                                                                                                       |
| `warn` (**proposed default**) | Same, plus items rendered at warning severity with the shortfall named. Never blocks.                                                                                                                                                                                                                         |
| `block`                       | A `state === 'insufficient'` rule sets `blocksAction: true` and `canConform: false`. `state === 'unknown'` **still never blocks** (§7). Force-conform (`decisionKind: 'override'`, existing owner/admin path, `qualityRoutes.ts:434-436`) remains the escape hatch and records the shortfall in the snapshot. |

D1 puts the default to Jay. Rollout: ship `warn`, flip a pilot project to `block`, measure, then decide whether `block` becomes the default — an evidence-gated flip, not a code change.

### 5.2 Pre-cover — WARN, riding the hold/witness point (no new workflow)

There is **no cover event in the codebase** (§2.4 item 3, 0 grep hits). The program asks for a pre-cover gate; inventing a lot status transition, a new route and a new mobile affordance to carry it would be the largest and least-evidenced part of the wave.

The evidence says the cover moment already has a home: the VIC earthworks seeder's witness point _"Section 204.06. W — Notify Superintendent before covering."_ (`seed-itp-templates-vic-earthworks.js:118`). In CIVOS that is a `HoldPoint` on an `ITPChecklistItem` (`schema.prisma:730-733`, `pointType` at `:734`).

**Proposal.** The pre-cover gate rides the hold-point request/release path:

1. **At request time** — when a release is requested for a lot's hold/witness point, the sufficiency verdict is attached to the request surface. This is the highest-value moment: it is exactly the 1–5 business-day lab window the appendix identifies (§A row 5) as _why_ a pre-cover gate has value.
2. **At release time** — `POST /api/holdpoints/:id/release` already runs through `recordDecision` (`holdpoints/actionRoutes.ts:417`); the verdict is recorded in the release snapshot.
3. **WARN only, never block.** A hold-point release is the _client's_ decision. CIVOS must not refuse to record a superintendent's release because our count says six. We inform; they decide; the snapshot records what we told them. This is also the External-collaboration standard (program §6): the action must work without CIVOS inserting itself into the client's authority.

D2 asks Jay whether that satisfies "pre-cover gate", or whether a dedicated cover event is genuinely wanted (in which case it is its own spec, and it needs the shell — Jay-gated).

### 5.3 Claim inclusion — WARN, never block

`POST /api/claims` runs through `recordDecision` with `evaluateClaimInclusion` (`claims/inclusionDecision.ts:130`) and `claimInclusionSnapshots` (`:322`). Sufficiency joins as an **advisory** item, matching the shipped precedent that `pending_tests` and `unreleased_hold_points` are `blocksAction: false` (`predicates.ts:347-353`).

Non-negotiable: sufficiency must never block a claim. Program §Wave F is explicit that claim surfaces are "project-management indicator, not an accounting balance or entitlement", and appendix §F's security-of-payment row warns never to imply evidence = payable amount. A test-count gate on a claim would be CIVOS asserting an entitlement position. **Warn, always.** Not offered as a decision.

### 5.4 Snapshot shape — fold into existing requirement sets; do NOT widen F0's unique key

A sufficiency verdict is not its own decision, so it needs no decision of its own. It must ride the snapshot of the decision it informed.

`RequirementEvaluation` is `@@unique([auditLogId, entityType, entityId])` (`schema.prisma:1690`+), and the F0 spec justifies the narrowness explicitly: _"one decision never evaluates one entity under two requirement sets; extend the key only if that ever becomes true"_ (`f0-execution-spec-2026-07-24.md:72`). **C1 is the first candidate for "ever".** A second `entityType: 'lot'` row carrying `test_sufficiency.v1` under the same audit row is barred by that constraint.

Two options:

- **(A, PROPOSED) Fold.** Add an optional `sufficiency` block to the existing payloads and bump `resultSchemaVersion` 1 → 2 for `lot_conformance`, `hold_point_release` and `claim_member`. Readers dispatch on the version column — the mechanism F0 already built (`shared.ts:61`, and F0 acceptance test "snapshot JSON version decoding", `f0-execution-spec-2026-07-24.md:157`). **No migration. No index change.** One snapshot row still equals one verdict per entity per decision — the auditable shape.
- **(B) Widen** the unique key to `[auditLogId, entityType, entityId, requirementSet]` and write a second row. Costs a migration on a live prod table, and permanently loosens the invariant that a decision's verdict for an entity is _one_ row.

Option A, and it validates F0's versioning design rather than amending its schema. The size budget is the binding constraint: `claim_member` rows are capped at 1 KB (`recordDecision.ts:151`), so the folded block on a member row is **counts and rule ids only** — no `regimeBasis`, no citation strings. `lot_conformance` and `hold_point_release` rows have 64 KB (`:154`) and carry the full block. A CI test asserts the member payload stays under budget at the worst realistic rule count. D3 records the choice.

---

## 6. Schema DDL (PROPOSED — migration content only; the orchestrator applies)

```prisma
model Lot {
  // ... existing fields (schema.prisma:542-574) ...

  // C1: the production quantity a per-quantity frequency rule divides.
  // NULL is first-class and means "unknown" — never zero, never assumed
  // (§7). `quantityUnit` is validated against QuantityUnit at the route.
  quantityValue Decimal? @map("quantity_value")
  quantityUnit  String?  @map("quantity_unit")   // 'm2'|'m3'|'t'|'m'|'each'

  // C1: the testing scale the governing specification regiments by
  // (e.g. VicRoads Sec 204 Scale A/B/C). Validated against the resolved
  // ruleset's `scaleKeys`; NULL => unknown, not a default scale.
  testScale     String?  @map("test_scale")

  // C1: bounded frequency-stream lookback (§3.4) — the last 3 decided lots
  // of an (activity) stream, index-covered. Existing
  // @@index([projectId, conformedAt]) (schema.prisma:606) cannot serve it.
  @@index([projectId, activityType, conformedAt], map: "lots_project_activity_conformed_idx")
}

model Project {
  // ... existing fields ...

  // C1 gate strength (§5.1). Default 'warn' NEVER changes conformance
  // outcomes for existing projects; 'block' is opt-in per project. (D1)
  testSufficiencyMode String @default("warn") @map("test_sufficiency_mode")
}
```

That is the whole migration: **three nullable columns, one defaulted column, one index.** No ruleset tables (§3.1), no sufficiency-evaluation table (§5.4), no enum types (the codebase uses defaulted strings throughout — `Lot.status`, `HoldPoint.pointType`).

Notes:

- **Additive and backwards-compatible.** Existing rows get NULL quantities/scale and `'warn'` mode. No backfill. No data loss. Reviewed Prisma migration; prod apply via the production-migrations workflow; **never `prisma db push`**, never `--accept-data-loss`.
- **Local test DBs only** for every DB-backed test in every C1 phase — `src/test/databaseSafety.ts` refuses non-local hosts. Never point a C1 test at Railway.
- **Quantity is not derived-and-stored.** Where `LotGeometry.areaM2` exists (`schema.prisma:492`) it is used as a _read-time fallback_ for `m2` rules; it is never copied into `Lot.quantityValue`, because the geometry is the better source and copying creates a staleness bug the moment the geometry is edited. The verdict records which source was used.

---

## 7. Missing-data behaviour — honest degradation

**The semantics, stated as a rule:** `unknown` is a third state. It is **never** `satisfied` and **never** `blocked-by-default`.

| Situation                                                                                           | State                                         | Surfaced as                                                                         | Blocks?                           |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------- |
| No ruleset for the project's authority (incl. every national-baseline spec set, `itpMatcher.ts:96`) | `unknown` / `no_ruleset_for_project`          | _silent_ — no item at all                                                           | No                                |
| Ruleset exists, no rule matches the activity/layer                                                  | `unknown` / `no_rule_for_activity`            | _silent_                                                                            | No                                |
| `Lot.activityType` folds to family-level or unmappable (`activityTaxonomy.ts:286`)                  | `unknown` / `activity_not_canonical`          | warning: "classify this lot's activity to check test frequency"                     | No                                |
| Rule is scale-keyed, `Lot.testScale` null                                                           | `unknown` / `scale_not_selected`              | warning naming the scale options from `ruleset.scaleKeys`                           | No                                |
| `Lot.testScale` not in `scaleKeys`                                                                  | `unknown` / `scale_not_recognised`            | warning naming the valid keys                                                       | No                                |
| Rule has a `perQuantity` limb, no quantity resolvable                                               | `unknown` / `quantity_missing`                | warning: "record this lot's area to check test frequency (or draw its geometry)"    | No                                |
| Ruleset `status: 'draft'`                                                                           | evaluated, but                                | every item labelled "unconfirmed edition — advisory"                                | **No, even in `block` mode** (§8) |
| Passing tests exist that no rule could attribute                                                    | `insufficient` + `tests_unlinked_to_itp_item` | warning: "N verified tests are not linked to a checklist item and were not counted" | No (the warning, not the count)   |
| Rule resolved, everything known, count short                                                        | `insufficient`                                | blocker text with the required/have numbers                                         | Only when `mode === 'block'`      |

**Why the first two are silent, not warnings.** Most CIVOS projects today will resolve no ruleset (only VIC + one NSW pack ship in C1). Emitting a warning per lot per rule in that state would add noise to every readiness panel in the product on day one and teach users to ignore the section. A resolved-nothing state produces nothing. The ones that _do_ warn are the ones the user can fix in under a minute (pick a scale, enter an area, classify the activity) — the A3b field-speed standard applied to a data-quality nudge.

**`blockIfUnknown` is deliberately not built.** A contractor who wants strictness has `mode: 'block'` plus a resolvable ruleset; blocking on unknown punishes missing data rather than missing tests, and no user has asked for it (YAGNI). If a pilot asks, it is one enum value.

**Known C1 ceilings, stated rather than hidden:**

- **Duplicate/re-test inflation.** C1 counts distinct `TestResult` rows. Two rows describing the same sample count twice. Detection is C4 (`ponytail:` count distinct rows; C4's duplicate detection tightens it). The verdict is decision support, and the snapshot records exactly which test ids were counted, so an auditor can see the double-count.
- **No spatial coverage check.** "No sample for CH 1,240–1,310" (program line 75) requires per-test location; `TestResult.sampleLocation` (`schema.prisma:836`) is free text and `sampleDate`/chainage are not structured for coverage. C1 reports **counts**, not spatial gaps. Spatial under-tested overlay is C3 (program line 77). The plain-English string in §4.4 therefore omits the chainage clause until C3 — stated here so nobody ships the sentence without the data behind it.
- **No production-day limb** (§3.3).

---

## 8. Seeding + the currency-confirmation step

**The obligation.** The research appendix grades the VicRoads 204 and TfNSW R44 frequency facts **A**, but both rows carry a caveat: the VicRoads source is a **council republication of the December 2015 edition** and must be _"revalidate[d] against current VicRoads/DTP edition before seeding the pack (by C1 start)"_ (appendix §A row 1); R44's edition is **not pinned** and the TfNSW link is a _portal record_ that must be resolved to the actual specification document (§A row 3). Neither number may be asserted as current. TMR MRTS04's numeric values are on the standing **never-assert** list (appendix §G) — no TMR pack in C1, at all.

**The mechanism.** `Ruleset.status` is the enforcement point, not a comment:

1. **A pack lands as `status: 'draft'`.** It is registered and evaluated, every item is labelled _"unconfirmed edition — advisory"_, and it **cannot block** even where `Project.testSufficiencyMode === 'block'`. A draft ruleset informs; it never gates.
2. **The confirmation pass** is a discrete, human, reviewable act:
   - open the **current published** VicRoads/DTP (resp. TfNSW) document — not the council republication, not a secondary site;
   - verify every encoded number against its cited clause/table;
   - record `edition`, `clause`, `pdfPage`, `sourceUrl`, `checkedOn`, `revalidateBy` in the ruleset module;
   - flip `status` to `'confirmed'` in a PR whose body states who checked what against which edition, and lists any number that **changed** from the 2015 figures.
     Numbers that cannot be confirmed are **deleted from the pack**, not left in as drafts.
3. **CI enforces currency** — a runnable check that survives sessions:
   - every `status: 'confirmed'` ruleset has non-empty `edition`, `clause`, `sourceUrl`, `pdfPage`, `checkedOn`, `revalidateBy`;
   - `revalidateBy` is **in the future** — an expired confirmed ruleset **fails CI**, forcing a revalidation pass rather than silent drift;
   - `evidenceGrade === 'A'` for any `confirmed` ruleset (a B/C/D-graded source may inform a draft, never gate);
   - `status: 'draft'` rulesets are exempt from the date check but are asserted non-blocking by a behaviour test.
4. **Revalidation cadence.** `revalidateBy` is set 12 months out by default, or earlier where the appendix says so.

**What ships (both `draft` at authoring; confirmation is a C1.3 gate item):**

- **`vicroads-204.v1`** — VIC / VicRoads. Rules for the `earthworks` family. The figures _as cited in the 2015 edition, pending confirmation_: minimum count 6 at Scale A/B and 3 at Scale C; `maxLotSize` 5,000 m² (Type A) and 500 m² under paved areas; `reduced` regime with `consecutiveConformingLots: 3`, `escalationShape: 'reset_on_any_failure'`, per 204.14(c). **These numbers are recorded here as the research's reading of a 2015 republication and must not be treated as current until step 2 is done.**
- **`tfnsw-r44.v1`** — NSW / TfNSW, `specSet` normalizing `rms` → `tfnsw` (`itpMatcher.ts:74-76`). Encodes the **n = 6 minimum sample count** only; no CDR statistic (D8). The R44 edition must be pinned during step 2 — the appendix cannot supply it.

**Legal boundary (appendix §A row 8, grade C).** Facts, numbers and thresholds are encoded; specification **prose is not**, and no Standards Australia text appears anywhere. `FrequencyRule.label` is a short factual label, capped in length by a CI assertion, and the rule type has **no free-prose field** — there is nowhere for a copied clause to live. Test methods are referenced by AS number only, as `specifications.ts` already does. The appendix's own caveat stands: obtain legal confirmation before shipping seeded spec packs commercially.

---

## 9. API + UI surface

**New API routes: one.**

- `GET /api/test-sufficiency/rulesets` — the registry as data (id, authority, document, edition, `scaleKeys`, `status`, rule labels + citations). Read-only, authenticated, **not** project-scoped (it is shipped product data, no tenant content, no isolation surface). The lot edit form needs it to render scale options honestly instead of a hardcoded A/B/C.

**Extended, not added:**

- `GET /api/lots/:id/readiness` (`qualityRoutes.ts:265`) — the conformance bucket gains the new items. Response shape is additive; `buildLotReadinessResponse` is unchanged in structure. This is the only read surface sufficiency needs — no `/test-sufficiency` per-lot route (`ponytail:` the readiness route already answers the question; a second endpoint would be a second source of truth).
- `PATCH /api/lots/:id` — accepts `quantityValue`, `quantityUnit`, `testScale`. Permissions follow the existing lot-edit gate (`LOT_EDITORS`, `routes/lots/roles.ts`) — **foreman excluded**, per `project_foreman_not_lot_setup_manager`.
- `PATCH /api/projects/:id` — accepts `testSufficiencyMode`, restricted to `owner` / `admin` / `project_manager`. Changing the gate strength writes an audit row.
- `POST /api/lots/:id/conform` — no signature change; the extra prerequisite arrives through `computeConformanceResult`.

**UI (office surfaces only):**

- `frontend/src/pages/lots/components/LotReadinessPanel.tsx:267` — renders the new items through the existing blocker/warning/support buckets. **No new component**, no new panel, no card-rule change.
- `frontend/src/pages/lots/components/LotEditFormFields.tsx` — three fields: quantity + unit, and scale as a `NativeSelect` populated from the resolved ruleset (rhf `register()` needs `NativeSelect`, not Radix).
- `frontend/src/pages/lots/components/ConformLotDialogs.tsx` — the shortfall appears in the existing blocker list; force-conform copy names it.
- Project settings — one control for `testSufficiencyMode` with plain-English copy of what each mode does.
- **Register column / map overlay: OUT.** A lots-register sufficiency column is deferred until a pilot asks; the map overlay is C3 (program line 77).
- **The mobile shell is UNTOUCHED** — no file under `frontend/src/shell/` changes. A foreman-facing sufficiency indicator is genuinely valuable and is **Jay-gated**: it does not appear in any C1 PR without an explicit go.

---

## 10. Security review (program §7)

C1 adds no upload surface, no external link, no AI call, and no offline storage — most of §7 is not engaged. What is:

| Threat                                      | Control                                                                                                                                                                                                                                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tenant isolation on a new query surface** | The regime query is the only new cross-lot read. It is `projectId`-scoped in the `where` clause, and a DB-backed test asserts that a lot in project B never appears in project A's stream. Non-negotiable per §7.                                                                                   |
| **Input validation at a trust boundary**    | `quantityValue` — positive, finite, bounded (reject ≤ 0, NaN, > 1e9), Decimal not float. `quantityUnit` — enum whitelist. `testScale` — must be in the resolved ruleset's `scaleKeys` (rejected at the route, not silently coerced). `testSufficiencyMode` — enum whitelist.                        |
| **Gate bypass via data**                    | Setting `quantityValue` to `1` to shrink a required count is possible and is **audited**: quantity/scale edits write an audit row, and the decision snapshot records the quantity and source that produced the required count. Detection, not prevention — the field is legitimately user-recorded. |
| **Permission escalation**                   | `testSufficiencyMode` is owner/admin/PM only; a foreman cannot weaken a gate. Sufficiency reads inherit the existing readiness-route authorization (`qualityRoutes.ts:277-294`), which already covers subcontractor portal scoping.                                                                 |
| **Authorization vs stale readiness**        | Authorization reads stay **outside** the decision transaction, per F0 `[R3.1-R6]` (`qualityRoutes.ts:414-416`). C1 changes nothing here.                                                                                                                                                            |
| **Commercial leakage**                      | Sufficiency payloads contain no money. Snapshot rows carry unfiltered commercial values generally (F0 §5), so any future read surface still re-applies `filterCommercialReadiness` — C1 adds no such surface.                                                                                       |
| **Copyright / DRM'd content**               | §8: facts only; no prose field in the rule type; CI-capped label length; no Standards Australia text.                                                                                                                                                                                               |
| **Audit-log integrity**                     | Unchanged — sufficiency rides `recordDecision`'s existing atomic audit+snapshot write.                                                                                                                                                                                                              |

No new dependencies are proposed (D9).

---

## 11. Build phases

Each phase is one reviewable PR (or a small ordered set), with its own exit condition. Order is strict — later phases depend on earlier ones.

### C1.0 — Vocabulary, registry, evaluator, reason codes (S–M) · no migration, no call sites

Mirrors F0.1's shape: the pure layer lands first and is unused.

- `sufficiency/types.ts`, `registry.ts`, `regime.ts`, `evaluate.ts`, `rulesets/index.ts` — **no ruleset content yet** (a synthetic fixture ruleset in tests only).
- Five new codes + provenance in `contracts/reasonCodes.ts`; the `testCountSufficient` re-export in `predicates.ts` (§4.3).
- `TestSufficiencyVerdict` extended in `contracts/futureConsumers.ts`; `contracts.test.ts` extended to assert the real implementation satisfies it.
- Unit tests: the `max(minCount, perQuantity)` arithmetic; every `UnknownCause`; the regime state machine including the force-conform asymmetry and the "failure retroactively reverts a later lot" case; the bounded-lookback equivalence (fold-over-full-history vs `take: 3` produce identical regimes over generated sequences).
- **Exit:** the pure layer is fully tested with zero production call sites; fallow may flag the exports as unused — expected-by-design for this phase, stated in the PR body (the F0.1 precedent, `predicates.ts:15-17`).

### C1.1 — Migration + resolution + WARN-only surfacing (M)

- The §6 migration (reviewed Prisma; **orchestrator applies to prod**).
- Resolver: project/lot → ruleset + scale + quantity, with the `LotGeometry.areaM2` read-time fallback.
- Sufficiency limb inside `computeConformanceResult`, contributing items but **not** `canConform` (all projects at `warn`).
- Route + form work: `PATCH /api/lots/:id` fields, `GET /api/test-sufficiency/rulesets`, `LotEditFormFields`, `LotReadinessPanel` rendering.
- **Characterization gate:** with no ruleset registered (the state of every existing project), `GET /api/lots/:id/readiness` and the conform gate are **byte-identical to master**. Pinned by the existing readiness characterization corpus (`readiness/characterization/`).
- **Exit:** a lot with a fixture ruleset shows a shortfall in the panel; no live project's behaviour changes; local-DB tests green; `npm run fallow:audit` verdict in the PR body.

### C1.2 — Decision-point adoption + the `block` mode (M)

- `resultSchemaVersion` 1 → 2 with the optional `sufficiency` block for `lot_conformance`, `hold_point_release`, `claim_member` (§5.4), with version-dispatching readers and a v1-still-decodes test.
- `Project.testSufficiencyMode === 'block'` honoured in the conform gate; `unknown` still never blocks.
- Hold-point request/release advisory (§5.2); claim-inclusion advisory (§5.3).
- Batched path: `checkConformancePrerequisitesBatch` resolves sufficiency for N lots **without** a per-lot regime query (one grouped lookback query per stream, memoized).
- **Exit:** all three decision points record a sufficiency block; claim create at the 5,000-member ceiling still meets F0's p95 < 2s (§12); `block` mode proven on a test project and proven inert at `warn`/`off`.

### C1.3 — Seed packs + confirmation + benchmark (M)

- `vicroads-204.v1` and `tfnsw-r44.v1` land as `status: 'draft'`; the CI currency assertions land with them.
- The **confirmation pass** (§8 step 2) is performed and each pack flips to `confirmed` — or ships `draft` with that stated in the exit evidence. Numbers that cannot be confirmed are deleted.
- Benchmarks against the reference dataset (§12).
- **Exit:** §13.

**B/C overlap.** Program §9 permits B and C1 to overlap "only across disjoint subsystems with strict file ownership". They are disjoint: Wave B owns `routes/copilot/**`, `ImportBatch`/`ImportMappingProfile`, parsers, `routes/itp/**`. C1 owns `lib/readiness/sufficiency/**`, `conformancePrerequisites.ts`, `evidenceReadiness/conformanceItems.ts`, `routes/lots/qualityRoutes.ts`. **Contended files: `backend/prisma/schema.prisma` (both add models/columns) and `contracts/reasonCodes.ts` (Wave B does not touch it today, but any new import reason code would).** Schema changes must be serialized between the two waves — one migration at a time, coordinated by the orchestrator.

---

## 12. Scale & performance targets (program §8 form: percentile + dataset + device/network)

Measured against the **defined production-like reference dataset** (5,000 lots, 10,000 map features, 50 GB evidence, 10k-row registers — built once, reused).

| Target                                             | Budget                                                                                                                                                                                | Method                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Sufficiency added to `GET /api/lots/:id/readiness` | **p95 < 25 ms** server-side, on a lot whose ITP has 500 checklist items (`MAX_CHECKLIST_ITEMS`, `templateValidation.ts:8`) at 5,000 project lots                                      | Server-side timing; the lot's own tests come from the existing include (no new query).                                     |
| Total `GET /:id/readiness`                         | **p95 < 400 ms** server-side, and interactive on a mid-tier Android over 4G                                                                                                           | Regression guard: the route must not regress more than 10% vs master.                                                      |
| New queries per readiness call                     | **≤ 1** per distinct stream, memoized per request; **0** when no ruleset resolves                                                                                                     | Query-count assertion in a DB-backed test (query counting, not timing — deterministic in CI).                              |
| Regime lookback                                    | **`take: 3`, index-covered** by `lots_project_activity_conformed_idx`                                                                                                                 | Assert row count fetched ≤ 3 per stream; assert p95 < 5 ms at 5,000 lots.                                                  |
| Conform decision overhead                          | sufficiency adds **p95 < 15 ms** inside the decision transaction, keeping the whole single-entity decision inside F0's **p95 < 50 ms** budget (`f0-execution-spec-2026-07-24.md:115`) | Same harness as F0.5's decision benchmark.                                                                                 |
| Claim create at the 5,000-member ceiling           | **p95 < 2 s unchanged** (F0's revised claim target); sufficiency adds **≤ 1 grouped query per stream**, never per member                                                              | The maximum-size claim benchmark F0.5 already built.                                                                       |
| `claim_member` snapshot size                       | **≤ 1 KB** with the folded sufficiency block at the worst realistic rule count (`MEMBER_RESULT_MAX_BYTES`, `recordDecision.ts:151`)                                                   | Size assertion in the requirement-set test.                                                                                |
| Serializable retry rate                            | no measurable increase vs master under the concurrency load                                                                                                                           | The regime read is inside the decision transaction and widens its read set; a hot retry loop is a perf failure, per F0 §8. |

---

## 13. Exit gate

C1 is not complete until **all** of the following hold, with evidence in the PR bodies:

1. **The third F0 consumer contract turns green.** `TestSufficiencyVerdict` (`futureConsumers.ts:27-37`) is satisfied by the real implementation, not a stub — lot readiness (live), claim readiness (live), **test sufficiency (C1)**. Three of six. The "one definition everywhere" claim still waits on My Work, hold-point packages and handover readiness.
2. **Both seed packs are either `confirmed`** (edition + clause + PDF page + `checkedOn` + future `revalidateBy` recorded, verified against the current published edition) **or shipped `draft` and provably non-blocking**, with the choice stated in the exit evidence. No number is asserted as current without step 8.2.
3. **CI currency assertions are green** and demonstrably fail on a synthetic expired `confirmed` ruleset (the check is tested, not just present).
4. **No behaviour change at `mode: 'off'`/`warn`**, characterization-pinned against the shipped readiness corpus; no live project's conform outcome changes without an explicit mode flip.
5. **`block` mode demonstrated end to end** on a real project: a lot short on tests is blocked with the numbers and clause cited; force-conform overrides it and the shortfall is recorded in the snapshot; the snapshot is verified by direct query (the established prod verification ritual).
6. **Regime correctness proven, including retroactivity**: a corrected-to-fail test on an earlier lot flips later lots' regime and required counts on the next read, with no stored state to migrate.
7. **All §12 benchmarks met** on the reference dataset.
8. **Tenant-isolation test green** for the regime query.
9. **Docs + Clancy knowledge mirror updated** (standing boundary, program line 5).
10. **Pilot acceptance owner: Jay** — a real lot on a real project, gate visible, explanation readable by a quality manager without training.
11. `npm run fallow:audit` verdict recorded per PR.

**Monitoring after enable:** count of lots by sufficiency state per project; count of force-conforms that overrode an `insufficient` verdict (the number that says whether the gate is calibrated or being routed around); `unknown` cause distribution (tells us which missing input to chase); regime distribution full-vs-reduced; sufficiency query p95.

---

## 14. Open decisions for Jay (D1–D10)

Each carries a recommendation. D2, D3, D4 and D8 are the ones that change the shape of the wave.

**D1 — Default `Project.testSufficiencyMode`.** `off` (invisible until switched on), `warn` (visible, never blocks), or `block`?
→ **Rec: `warn` for all projects, new and existing.** It makes the wedge visible immediately with zero risk of blocking live production work, and it generates the data needed to decide whether `block` should ever become the default. `block` stays opt-in per project until a pilot proves the calibration.

**D2 — The pre-cover gate.** There is **no cover event in CIVOS** (0 grep hits). Does riding the hold/witness-point request + release path (§5.2, warn-only) satisfy the program's "proactive gates before cover", or do you want a dedicated cover event?
→ **Rec: ride the hold/witness point.** The evidence is in our own seeder (`seed-itp-templates-vic-earthworks.js:118`, "W — Notify Superintendent before covering") — the cover moment is already modelled as a witness point. A dedicated cover event means a new lot state, a new route, and a **mobile shell touch** (Jay-gated) for an event nobody has asked to record. If you want it, it is its own spec.

**D3 — Snapshot shape.** Fold sufficiency into the existing requirement sets at `resultSchemaVersion: 2` (no migration), or widen F0's `@@unique([auditLogId, entityType, entityId])` to include `requirementSet` and write a second row (migration on a live prod table)?
→ **Rec: fold.** It exercises the version-dispatch mechanism F0 built for exactly this, needs no migration, and keeps "one decision, one verdict row per entity". Note this **answers the open question F0 left at `f0-execution-spec-2026-07-24.md:72`** — the key stays narrow.

**D4 — Required-count arithmetic.** `required = max(minCountByScale, ceil(quantity / every))` — the per-lot minimum is a **floor** that a small lot cannot fall below?
→ **Rec: yes, `max`.** The appendix describes the minimum count as existing "for statistical validity", _separately_ from area coverage (§A rows 1 and 3) — that is a floor, not an alternative. Flagged because it is the single most consequential arithmetic choice in the wave and a wrong reading is silently wrong on every lot.

**D5 — Quantity storage.** New `Lot.quantityValue` + `quantityUnit`, or rely on `LotGeometry.areaM2` alone?
→ **Rec: both, in that order.** Geometry only exists for spatially-defined lots and only ever gives m² / m — volume and tonnage rules would be permanently unevaluable. Explicit lot quantity wins; geometry is the read-time fallback for `m2`; the verdict names the source used. Never copied (it would go stale on the next geometry edit).

**D6 — Scale selection grain.** Per-lot (`Lot.testScale`), per-project, or a per-activity project default?
→ **Rec: per-lot, no default.** VicRoads scale tracks the material/zone, which varies within a project. A project-level default would be silently wrong for some lots — and "silently wrong" is the failure mode this wave exists to remove. `NULL` → `unknown` → a one-click warning, not a guess. A per-activity default is a later convenience if PMs ask.

**D7 — Frequency-stream key.** `(projectId, rulesetId, ruleId, activitySlug, normalizedLayer)`, or should subcontractor / material source be in the key?
→ **Rec: as proposed, no subcontractor.** The authority regiments "work of the same type", not "work by the same subcontractor". Adding the subcontractor would let a contractor earn a reduced frequency per crew, which is a defensible-only-if-the-spec-says-so reading, and no cited spec says so. Revisit only with a clause reference.

**D8 — TfNSW pack scope.** Encode R44's **n = 6 minimum sample count only**, or also the Characteristic Density Ratio statistic with k-values?
→ **Rec: count only in C1.** The CDR is a statistic over result _values_, not a count of results — it needs the LIMS-grade structured data C3 brings, and a half-implemented statistical acceptance test would produce confident wrong answers about compliance. Count now, statistic in C3.

**D9 — New dependencies.** **None proposed.** The whole engine is arithmetic over data already fetched, plus one bounded query. Recorded explicitly so "no new deps" is a decision, not an omission.

**D10 — The unused `overdue_test` alert type** (F0 open decision 3, `f0-execution-spec-2026-07-24.md:167`; declared `notificationAlertConfig.ts:8`, commented unused at `:32`). Wire it in C1 or delete it?
→ **Rec: delete it in C1.0.** "Overdue test" is a _lab-turnaround_ concern, which is C2's sample lifecycle, not C1's count. Sufficiency surfaces in readiness where the user is already looking, not as a new alert stream into a 3,669-row backlog that A2 is still burning down. C2 can add a real, resolvable alert with a real underlying condition.

---

## 15. Verification notes and unresolved research items

Recorded plainly so a reviewer knows the difference between "verified" and "assumed".

**Verified against code at `3fe7eadd`** — every `file:line` in §2, including the three absences that shape the design: no lot quantity field, no test-scale field, and **zero occurrences of any cover/pre-cover concept** in `backend/src` or `frontend/src`.

**Program/research claims this spec carries forward without independent verification:**

- **VicRoads Sec 204 numbers** (6 tests Scale A/B, 3 Scale C, 5,000 m² / 500 m² lot caps, 204.14(c) three-consecutive-conforming regime). Sourced from a **council republication of the December 2015 edition**. Not verified against the current VicRoads/DTP edition in this session. §8 makes that verification a gate, and the pack ships `draft` until it happens.
- **TfNSW R44** (n = 6, lot ≤ one shift, narrow lots ≤ 150 m). Edition not pinned; the appendix's own portal link is a record, not the document. Only n = 6 is encoded, and only as `draft`.
- **TMR MRTS04, DIT SA, MRWA numeric frequencies** — on the appendix's standing never-assert list (§G). **No pack, no numbers, in C1.**
- **Whether CivilPro alerts on a testing shortfall** — never-assert (§G). This spec claims only that CivilPro _configures_ frequencies (appendix §A row 6, grade B) and does not claim the gate is unique.

**Contradiction found between the plan and the code:** the program specifies "proactive gates before **cover**/conform/claim" (line 75) as if cover were an existing decision point. It is not — the concept does not exist anywhere in the codebase. §5.2/D2 resolve it by mapping "cover" onto the witness point that already models it; this is a **design decision, not an implementation of something already present**, and it is the one place where the program's wording overstates the current system.

**Tension surfaced, not contradicted:** the program's C1 line asks for the plain-English explanation to include _"no sample for CH 1,240–1,310"_. That is a **spatial coverage** statement and requires per-test location data C1 does not have (`TestResult.sampleLocation` is free text). Spatial overlay is explicitly C3 (line 77). C1's explanation therefore reports counts and omits the chainage clause — stated in §7 so the sentence is never shipped without the data behind it.

**Also noted:** `ImportBatch` (`schema.prisma:1999`) and `ImportMappingProfile` (`:2041`) are already in the schema at `3fe7eadd`, so Wave B has begun landing since its spec was written as "PROPOSED". §11's file-ownership note reflects the current tree, not the Wave B spec's snapshot.

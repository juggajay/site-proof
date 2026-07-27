# F1 Execution Specification — canonical test categories, so real density tests actually count

**Date:** 27 July 2026 · **Rev 2** · **Status:** implementation-ready. §16.0's Jay decisions are resolved (J1, J2 recommended-and-standing; **J3 decided 2026-07-27**).
**Parent spec:** `docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md` (Rev 2.1). This document fixes that spec's **§4.1 attribution rule**, which is the top finding of the 2026-07-27 external review.
**Sibling spec:** `docs/plans/d14-q6-pack-spec-2026-07-27.md` (Rev 2). §10 states the exact interaction; the two slices share one alias registry and must not fork it.
**Source finding:** `civos-wave-c1-review-2026-07-27.md` **F1 — HIGH**, and its "Suggested acceptance gate before block mode" items 1 and 2.

**Shipped code read in this worktree at `66dba143` (= `origin/master`, 27 July 2026).** Rev 1 claimed a base of `7a6ed14e`; master was already three commits past that when Rev 1 was reviewed, and is further on now. **Every `file:line` in this revision was re-opened at `66dba143`** — `evaluate.ts` in particular shifted by roughly eleven lines since Rev 1 was written, so Rev 1's engine citations no longer resolve. The build agent must re-verify before editing, and the PR body must re-assert its own base `[F1C-C7]`.

**Production inventory read read-only on 2026-07-27** and reproduced verbatim in §5.1. It is the evidence base for every alias entry; no alias in this document exists without a cited source string. **Seed-corpus figures in §5.1 and §5.4 were produced by executing the §4.3 tokenizer** over all 8 `seed-itp-templates-vic-*.js` modules (264 distinct `testType` values, 355 items carrying one) and all 40 seed modules (741 distinct values, 3,501 items) — not by reading them.

**House style** matches the C1 and D14 specs: numbered sections, PR slicing, a decision register split into Jay's calls and the spec's own, named acceptance tests, per-phase rollback, an exit gate.

**Ponytail note.** The laziest correct version of F1 is **no column, no migration, no backfill, and no change to any of the write paths that author a test type** (§2.3). One leaf module, one shared resolution seam, two engine call sites. The reason that is also the _correct_ version — not merely the cheap one — is §6: the same string is denormalized into `itp_instances.template_snapshot` JSON at six sites, so a stored column would require rewriting every snapshot blob in the same migration, and the one backfill this wave already shipped has a stale-read overwrite race (review F6). We do not write; therefore we cannot race.

---

## 0. Rev 2 changelog — the adversarial review, folded

The 2026-07-27 adversarial review of Rev 1 (verdict **6/10**) executed the §4.3 tokenizer over the real corpora rather than reasoning about it. Every blocker was re-verified against `66dba143` before folding; **six of seven held exactly as written, one (B6) held but with the wrong adjudication in one of its three rows, and two of the review's own supporting facts are themselves corrected below.** The fold is tagged `[F1C-*]` and every tag appears at the section that carries it.

### 0.1 Blockers

| Tag        | Review finding                                                                                                                              | Verdict                                                                                                                                                                                                                                                                                                                                                                   | Where it lands                                                                                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[F1C-B1]` | `regime.ts:171` is a **second** production caller of `testAttributesToRule` and Rev 1's "both funnel through `candidateTestTypes`" is false | **HELD, verbatim.** Two production callers at HEAD: `evaluate.ts:145` and `regime.ts:171`. `candidateTestTypes` is private to `evaluate.ts:72-78`. `regime.ts` passes raw strings and would compile against the new signature                                                                                                                                             | §2.1 rewritten · §4.4 makes the candidate rule a **shared exported helper** both callers use · `regime.ts` added to §11 file ownership · **AT-56**                                                                                                                                       |
| `[F1C-B2]` | the item limb bypasses the MDD exclusion — six linked `MDD Standard` tests read 6 of 6                                                      | **HELD.** `evaluate.ts:77` returns `[test.testType, linked]`, `counts.ts:32` is `.some(...)`. Rev 1's exclusions were _absences_, and an absence cannot block the other limb                                                                                                                                                                                              | §4.3.2 introduces an explicit `LAB_REFERENCE` resolution distinct from "unknown" · §4.4's shared helper returns `[]` when the test's **own** type is a lab reference · §5.3 splits the exclusions into two kinds · **AT-57** pins the shipped linked-item scenario · R8 carried into §10 |
| `[F1C-B3]` | §4.5's additive-only policy routes the heavyweight review at the safe direction                                                             | **HELD.** An over-generous add opens a gate silently; an over-strict remove is loud and one-line recoverable                                                                                                                                                                                                                                                              | §4.5 **inverted**: an add that introduces a method code or a lab reference gets the §9 review; removals are the normal PR · D-F1i rewritten                                                                                                                                              |
| `[F1C-B4]` | §12's two budgets are mutually inconsistent and the measured cost exceeds the headroom                                                      | **HELD, and re-measured here.** 5,000 lots × 1 ms ≫ 36 ms headroom. Re-run at HEAD: **2.49 µs/resolve unmemoized**, **+150 / +436 / +623 ms** at 5,000 lots × 12 / 35 / 50 strings (the reviewer measured 1.88 µs and +113 / +329 / +471 ms on its machine — same conclusion, different constant)                                                                         | **New §4.6** batch-scoped memoization · §12 budgets replaced with an aggregate one · **AT-60**. Memoized re-measurement: **0.021 µs/resolve, +3.7 ms at 5,000 × 35**, 264 distinct keys                                                                                                  |
| `[F1C-B5]` | F1.2 makes the sufficiency engine and the conformance gate contradict each other inside one payload                                         | **HELD, and escalated to Jay as J3.** `conformancePrerequisites.ts:536` → `testMatchesItem` (raw equality) and `:555` → `evaluateSufficiency` (categories) run over the same rows in the same function                                                                                                                                                                    | **§16.0 J3 — DECIDED: "fix counts now, gate matcher next."** §8.4 specifies the on-screen copy that makes the divergence read as an action · **§19** is the named follow-up slice                                                                                                        |
| `[F1C-B6]` | AT-27's single-file scope does not meet acceptance-gate item 1; three VIC compaction strings miss                                           | **HELD on scope; 2 of 3 rows held on adjudication.** Widened and re-swept at HEAD: **20 of 264** VIC strings resolve under the final registry (18 under Rev 1's twelve). `Sections 204/304 (DDR, Scale C)` and `Standard / modified compaction (Section 173)` are genuine misses and are now aliased. **`RC 316.14` is refuted with the shipped item text** — see §5.3(b) | §5.1 carries the measured sweep · §5.2 gains two entries · §5.3 adjudicates `RC 316.14` explicitly · Rev 1's **AT-27 is renumbered AT-58** and widened to all 8 `vic-*` modules                                                                                                          |
| `[F1C-B7]` | the F1.2 characterization corpus diff will be empty, so exit item 10 proves nothing                                                         | **HELD, and worse than stated.** `seedCorpus.ts` writes the literal `'compaction'` at `:60, :92, :98, :104, :110, :154` and imports only `prisma.js` and `activityTaxonomy.js` — it never reads `sampleProjectData.ts`                                                                                                                                                    | §11 moves real-vocabulary corpus rows into **F1.1**, so F1.2's diff **is** the behaviour change · exit item 10 rewritten · a second corpus staleness found while verifying is recorded in §11                                                                                            |

### 0.2 Recommendations

| Tag         | Recommendation                                                     | Fold                                                                                                                                                                                                                                                                                                                                                             |
| ----------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[F1C-R1]`  | state that fragments are re-normalized after splitting             | **Folded.** §4.3.2 rule 4 now says each fragment is re-normalized (§4.3.1 is idempotent). Verified necessary: stripping `(Insitu Density)` from the shipped prod item leaves `tmr q141a/b , tmr q142a`, whose first comma-fragment is `"tmr q141a/b "`                                                                                                           |
| `[F1C-R2]`  | say parenthetical contents are **not** further split               | **Folded** into §4.3.2 rule 3, with the reason: it is what keeps `Sections 204/304 (DDR, Scale C)` from yielding a bare `ddr`, and `RC 316.00 / AS 1289 (grading, PI)` from yielding a bare `grading`                                                                                                                                                            |
| `[F1C-R3]`  | harden the lookup against prototype inheritance                    | **Folded** into §4.2. Confirmed by execution: `Object.freeze({...})['constructor']` returns a **function**; `toString`, `valueOf`, `hasOwnProperty` likewise. (`__proto__` is accidentally defused by the `_`→space rule, which is not a defence.) The registry stays an object literal for reviewability and the lookup is a `Map` built from it at module load |
| `[F1C-R4]`  | pin the slash asymmetry                                            | **Folded** into AT-23. Re-measured: `Field Density Nuclear / Sand` → `compaction`, `field density nuclear/sand` → `null`                                                                                                                                                                                                                                         |
| `[F1C-R5]`  | name the "compaction + modifier" ceiling                           | **Folded** into **new §5.4**, with the measured list, and a scoping rule that decides it and B6 together                                                                                                                                                                                                                                                         |
| `[F1C-R6]`  | §8.3's "harmless" claim is false as stated                         | **Folded, and made precise.** §8.3 rewritten. The dependency is named — and the review's description of it is corrected: the filter is an **OR**, `useLotItpTestItems.ts:15`                                                                                                                                                                                     |
| `[F1C-R7]`  | the existing advisory copy becomes false                           | **Folded** into §8.2 with the exact replacement string and the test that asserts it                                                                                                                                                                                                                                                                              |
| `[F1C-R8]`  | D14.3's alias handoff must carry J2 forward                        | **Folded** into §10 as a hard handoff condition, naming `d14-q6-pack-spec-2026-07-27.md:758` "max wet/dry density"                                                                                                                                                                                                                                               |
| `[F1C-R9]`  | §17.1's "do not unify" warning will be ignored where it is written | **Folded** into **§19** as a build requirement of the follow-up slice, and into §17.1 as an F1.2 obligation: the stale docstring at `predicates.ts:222-230` is corrected in F1.2                                                                                                                                                                                 |
| `[F1C-R10]` | the union rule's safety net is structurally inert at F1            | **Folded as an accepted, pinned ceiling** — §17.5. Confirmed live: `RC 316.00 / Survey`, `RC 316.00 / AS 1289 (grading, PI)` and `RC 316.00 / AS 2891.14.5 / RC 500.05` all resolve `compaction` today. Bounded by rule scope (§17.5) and pinned by **AT-59** so the day a second category ships, the change is a test diff                                      |

### 0.3 Corrected citations, and two corrections to the review itself

Rev 1 claimed "every `file:line` below was opened, not remembered". Seven were not. All seven are fixed; **two of the review's own replacement facts are themselves wrong**, and are refuted here with the evidence that refutes them.

| Tag        | Rev 1 claim                                                                                              | Ground truth at `66dba143`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[F1C-C1]` | §4.4: M39 byte-identity at `conformancePrerequisites.ts:374-382`                                         | **Corrected to `:461-473`.** `:372-423` is the `CONFORMANCE_LOT_SELECT` column list. Rev 1 inherited this from the stale comment at `evaluate.ts:7`; **F1.2 fixes that comment too**, or the next spec copies it again                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `[F1C-C2]` | §17.1: `predicates.ts:218-237` mirrors `conformancePrerequisites.ts:261-270` `testResultMatchesItem`     | **Corrected.** No such function exists anywhere in that file; `:259-270` is `getNaHoldPointSignoffItemIds`. `testMatchesItem` spans `predicates.ts:231-237` with its docstring at `:222-230`, and `conformancePrerequisites.ts:3` **imports** it, calling it at `:290`, `:313`, `:320`. The unification the docstring promises already happened — see R9 and §19                                                                                                                                                                                                                                                                                                                                                                       |
| `[F1C-C3]` | §7: the classifier "requires an explicit `--confirm-db=<name>`", reusing `backfill-lot-activity-slug.ts` | **Corrected, and the flag is fabricated.** `--confirm-db` does not exist anywhere in the tree — the only occurrence in the repository was Rev 1 of this document. The shipped pattern is `requireDatabaseTargetConfirmation('CONFIRM_ACTIVITY_SLUG_BACKFILL', …)` (`backfill-lot-activity-slug.ts:35-38`), an **environment variable** that must equal `` `${hostname}/${databaseName}` `` (`scripts/lib/database-target.ts:26-39`), invoked **only** under `--write` (`:33-34`). It also does **not** print the target before connecting; the target appears only inside the thrown error. §7 is rewritten accordingly                                                                                                                |
| `[F1C-C4]` | §2.4 / §6.1: `templateSnapshot` written at **nine** sites                                                | **Corrected to six**, and **the review's "seven" is refuted too.** At HEAD there are six production writes — `itp/instances.ts:196`, `lots/createRoutes.ts:164` and `:417`, `lots/bulkCreateCore.ts:222`, `projects/sampleProjectRoute.ts:175`, `itp/templateLifecycleRoutes.ts:264` — plus one benchmark script, `scripts/bench-f05.ts:368`. The review counted `templateLifecycleRoutes.ts:222-237` as a write; it is a **snapshot builder**, and the only write on that path is the `updateMany` at `:264`. It also missed the bench script. No raw-SQL writer exists: outside `prisma/migrations`, `template_snapshot` appears only at `schema.prisma:690`. **Six still carries §6's argument** — one blob rewrite is one too many |
| `[F1C-C5]` | §5.3: `rc 316.10` at VIC seed `:247`                                                                     | **Corrected to `:242`** (`testType: 'AS 1289.5.4.1, RC 316.00, RC 316.10'`; it also appears in that item's `notes` at `:243`). `:247` is the **next** item's `acceptanceCriteria` and contains no `RC 316.10` at all. The review is right                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `[F1C-C6]` | §2.3: the `_`↔space equivalence "is a **reuse**, not an invention"                                       | **Corrected to a weaker and true claim.** `specificationRoutes.ts:29` is `testType.toLowerCase().replace(/\s+/g, '_')` — space→`_`, to reach snake*case keys; F1 maps `*`→space to reach space-separated keys. Opposite direction, third vocabulary. The equivalence is **defensible on its own merits** (§4.3.1) and the "reuse not invention" rhetoric is withdrawn. Also newly found: a **second, identical** normalizer at `testResults/presentation.ts:93` that Rev 1 and the review both missed                                                                                                                                                                                                                                  |
| `[F1C-C7]` | header: "read at `7a6ed14e` (= `origin/master`)"                                                         | **Corrected.** Base re-asserted as `66dba143` in the header, and the PR body must re-assert its own                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**Two further Rev 1 facts corrected while verifying** (neither was in the review): the ITP item test-type length cap is **120**, not 100 — `templateValidation.ts:7` `MAX_SHORT_TEXT_LENGTH = 120`, shared with six other fields (§2.3); and `sampleProjectData.ts:203` is the interface field `testType: string;`, not a `'density_ratio'` literal — the literals are at `:80`, `:217`, `:229`, in `backend/src/routes/projects/`, not the frontend (§5.1, §11).

### 0.4 Amendment tags introduced here

These continue the C1 spec's `[C1C-*]` series (which D14 ran to `[C1C-14]`). §18 lists them as **required follow-up edits to the C1 spec** — **this PR does not edit the C1 spec.**

| Tag        | Amendment                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[C1C-15]` | §4.1's table row "**Test attribution to a rule** … `predicates.ts:202-208` `testMatchesItem` + direct `TestResult.testType` equality — **none** — reuses the shipped matcher, no second match rule" is **the defect**. Raw-string equality is not an attribution rule; it is a coincidence that holds only for synthetic fixtures. §4 of this document replaces it.        |
| `[C1C-16]` | §4.1's closing sentence "A test counts toward rule R iff `testPassing(t)` **and** (`t.itpChecklistItemId` links an item whose `testType` normalizes to `R.testType`, **or** `normalize(t.testType) === R.testType`)" is superseded by §4.4 here: both limbs compare **resolved categories**, and the item limb is **conditional on the test's own resolution** `[F1C-B2]`. |
| `[C1C-17]` | §3.2's `FrequencyRule.testType` doc comment (`types.ts:94`) was **correct as intent and unenforced in fact**. §4.1 here makes it a CI-asserted contract. The shipped `vicroads-204.v1` value `'compaction'` (`:105`) was right all along — the resolver was wrong, not the pack.                                                                                           |
| `[C1C-18]` | §2.4 and §7.2's implicit assumption that `predicates.ts` `testMatchesItem` and the sufficiency attribution rule are "the same matcher" is withdrawn. They are **deliberately different** for the duration of F1, and **§19** is the named slice that converges them.                                                                                                       |
| `[C1C-19]` | **New in Rev 2.** "Uncategorized" is no longer one state. The resolver distinguishes **unknown** (`null` — nobody has mapped this string) from **lab reference** (`LAB_REFERENCE` — we have mapped it, and it is deliberately not a countable field test). Any future code reading a resolution must handle three cases, not two `[F1C-B2]`.                               |
| `[C1C-20]` | **New in Rev 2.** `sufficiency/regime.ts` is a **second consumer** of the attribution rule, not a pass-through of the evaluator's. Any change to attribution semantics must be made in the shared helper of §4.4, never in `counts.ts` alone `[F1C-B1]`.                                                                                                                   |

---

## 1. Outcome, scope and non-goals

**Outcome.** A VIC earthworks lot with six verified passing tests entered as "Density Ratio", or six tests linked to the shipped VicRoads earthworks ITP item `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00`, reads **6 of 6 — met**, citing clause 204.13(a). A lot with six _laboratory MDD_ tests still reads 0 of 6 — **whether or not those tests are linked to a compaction ITP item** `[F1C-B2]` — because those are not the tests the clause asks for (§5.3). A lot whose test types nobody has ever mapped reads 0 of 6 **and** says so, through the advisory that already exists (§8.2) — it never guesses. A three-lot reduced-frequency streak is evaluated on the same vocabulary as the count, so a lot that failed six real density tests can no longer be counted as conforming `[F1C-B1]`.

**Included:**

- **One leaf module** — `backend/src/lib/readiness/sufficiency/testCategories.ts` (§4): the canonical key type, the alias registry, the lab-reference exclusion set, a pure resolver, a memoizing resolver factory (§4.6), and the **shared candidate-category helper** both engine callers use (§4.4).
- **A token-exact resolution rule** (§4.3) — explicitly **not** substring matching, with a worked non-match proof (§4.3.3).
- **Fourteen alias entries** and **six lab-reference exclusion tokens**, every one traced to a production row or a shipped file (§5.2, §5.3).
- **Three call sites changed in the engine** (§4.4) — `counts.ts` `testAttributesToRule` compares categories; `evaluate.ts` resolves once per lot; **`regime.ts` `streamEntryConforming` resolves too** `[F1C-B1]`.
- **Two user-visible copy changes** (§8.2, §8.4) — the "not counted" advisory becomes true after F1, and the unmatched-result item becomes an instruction rather than an observation `[F1C-B5]`.
- **Real-vocabulary integration fixtures** (§14 AT-58, AT-28, AT-29) — the deliverable that makes this trustworthy, not the registry file.
- **A read-only production classifier script** (§7) that reports alias coverage without writing anything.

**Non-goals — explicitly not built here:**

- **No schema change, no migration, no backfill, no data rewrite** (§6). Nothing this slice does can lose or corrupt a row.
- **No change to any write path.** All the surfaces that author a test type (§2.3) are untouched, including the AI certificate extractor, the ITP spreadsheet importer, the 40 seeders and the template-snapshot JSON.
- **No change to the Create Test modal's control** (§8.1). Free text plus datalist stays; the category is derived server-side.
- **No pack content change** (§9). `vicroads-204.v1` ships byte-identical; no re-confirmation, no `.v2`, no provenance story to tell.
- **No change to `predicates.ts` `testMatchesItem` behaviour** (§17.1). **§19 is the named slice that changes it**, with its own characterization and its own review — it is deferred, not dropped `[F1C-B5]`.
- **No substring matching, no fuzzy matching, no similarity scoring, no AI classification.** An unmapped value is unknown. Unknown attributes to nothing.
- **No new `UnknownCause`, no new reason code.** Both vocabularies are closed and contract-tested (`reasonCodes.ts:29-79`, C1 codes at `:74-78`; `UNKNOWN_CAUSES` lives at `sufficiency/types.ts:238-245`, not in `reasonCodes.ts`); §8.2 shows the shipped codes already carry this honestly.

---

## 2. Current-state map (read at `66dba143`)

### 2.1 The attribution path, exactly — and it has **two** callers `[F1C-B1]`

```
evaluate.ts:144-146   attributed = tests.filter(t => testAttributesToRule(rule.testType, candidateTestTypes(t, itemTestTypes)))
evaluate.ts:72-78     candidateTestTypes(t) = [t.testType, itemTestTypes.get(t.itpChecklistItemId)]     <- PRIVATE to evaluate.ts
evaluate.ts:68-70     itemTestTypeIndex(items) = Map<item.id, item.testType ?? null>
regime.ts:165-173     streamEntryConforming(entry, ruleTestType) =
regime.ts:171           !entry.testResults.some(t => testFailing(t) && testAttributesToRule(ruleTestType, [t.testType, t.itpChecklistItem?.testType]))
counts.ts:26-33       testAttributesToRule = candidates.some(c => normalizeTestTypeKey(c) === normalizeTestTypeKey(ruleTestType))
counts.ts:13-15       normalizeTestTypeKey = (value || '').trim().toLowerCase()
```

**Rev 1 asserted that both call paths funnel through `candidateTestTypes`, and built its whole change strategy on it. That is false.** `candidateTestTypes` is a module-private function of `evaluate.ts` (`:72`, no `export`). `regime.ts:171` builds its own two-element array inline from a nested Prisma select (`prismaStream.ts:43-51`, `itpChecklistItem: { select: { testType: true } }` at `:49`) and calls `testAttributesToRule` directly. There are exactly **two** production callers — `evaluate.ts:145` and `regime.ts:171` — and Rev 1 addressed one.

**Why this matters more than a missed call site — the failure shape.** `streamEntryConforming` is a **negative** predicate: an entry conforms iff **no failing test attributes** to the rule. Change `testAttributesToRule`'s signature to take resolved categories and leave `regime.ts` alone, and it compiles — `string` and `string | null` satisfy `readonly (string | null)[]` — while comparing a raw string like `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00` against the category `compaction`. Attribution becomes **permanently false**, so _no_ failing test can ever break a streak, so every conformed non-overridden lot reads conforming, so `deriveRegime` (`:194-230`, window check at `:219`) hands `reducedFrequencyEligible: true` (`evaluate.ts:174`) to a three-lot streak in which every lot failed six density tests. That value is user-visible, and D14 builds on it (`d14-q6-pack-spec-2026-07-27.md:911` names `testAttributesToRule` as the shipped attributable predicate; `:895` re-specs `streamEntryConforming` itself).

It would ship green. `counts.test.ts:57-69` is the only test touching this function and every case uses the literal `'compaction'`.

**Therefore the seam is not `counts.ts`.** It is a shared candidate-category helper that both callers use (§4.4) `[C1C-20]`.

### 2.2 What the rule asks for versus what exists

`rulesets/vicroads-204.v1.ts:101-121` — `testType: 'compaction'` (`:105`), `minCountByScale: { A: 6, B: 6, C: 3 }` (`:109`), scoped to `activitySlugs: ['earthworks_general', 'earthworks_subgrade_prep']` (`:106-108`).

`types.ts:94` already declares the intent: _"Test-type key from `routes/testResults/specifications.ts`."_ `compaction` **is** a key of `testTypeSpecifications` (`specifications.ts:23`, map spans `:22-127`). The pack is correct. Nothing enforces the claim, and nothing resolves anything else to that key `[C1C-17]`.

`SUFFICIENCY_RULESETS` is `[VICROADS_204_V1]` and nothing else (`rulesets/index.ts:34`); `tfnsw-r44.v1` is deliberately deregistered (`:15-33`, `[C1C-9]`). So exactly one rule consumes exactly one category at F1.

### 2.3 The write surfaces — three vocabularies, one column

**Schema.** `schema.prisma:853` `TestResult.testType String @map("test_type")` — **NOT NULL**, not indexed, no default, no constraint. `schema.prisma:674` `ITPChecklistItem.testType String? @map("test_type")` — nullable, not indexed. Length caps only: **160** chars (`routes/testResults/validation.ts:17`, `MAX_TEST_TYPE_LENGTH`) and **120** chars (`routes/itp/templateValidation.ts:7` `MAX_SHORT_TEXT_LENGTH`, applied at `:35`). **Rev 1 said 100; it is 120**, and the constant is shared with `pointType`, `category`, `responsibleParty`, `evidenceRequired`, `stateSpec` and `specificationReference` — it is not a testType-local knob.

**`test_results.test_type` writers:** `testResults/crudRoutes.ts:118,178` (manual POST — trim + length, no canonicalization) and `:311-312` (**PATCH**, which routes into the same correction mapper); `testResults/corrections.ts:60-65` (the shared correction mapper, behind PUT, PATCH, confirm-extraction and batch-confirm); `testResults/testResultMapping.ts:51-63` (**AI vision extraction — raw model output**, falling back to the literal string `'Certificate Review Required'` at `:63`); `testResults/certificateIntake.ts:171,301` (single and batch certificate upload); `testResults/certificateExtraction.ts:75-79` (**testType inferred from the uploaded filename**, inference at `:44`); `projects/sampleProjectRoute.ts:229-233` (writes `testSeed.testType`, whose `'density_ratio'` literals live at `sampleProjectData.ts:217,229`); `readiness/characterization/seedCorpus.ts:92,98,104,110,154`.

**`itp_checklist_items.test_type` writers:** `itp/templates.ts:258` (admin builder), `:345` (clone, verbatim), `:415` (PUT — **destructive delete-and-recreate at `:423-425`; item ids change**); `copilot/import/itpTemplateImportExecutor.ts:173` (**uncanonicalized spreadsheet text**, header aliases at `mappingProfiles.ts:163-174`, CivilPro columns at `:372,391`, and no `transform` entry unlike its siblings); `projects/sampleProjectRoute.ts:112` (via `sampleProjectData.ts:80`); `seedCorpus.ts:60`; and **40 global-library seeders** under `backend/scripts/seeds/itp-templates/` (count verified: exactly 40 `seed-itp-templates-*.js`).

**Frontend authoring:** `pages/tests/components/CreateTestModal.tsx:22` (`z.string().trim().min(1)` is the _entire_ client validation), `:259-296` (the datalist — a suggestion, not a constraint), `:173` (**picking an ITP item with no `testType` writes the item's free-text `description` into the column** — §8.3); `UploadCertificateModal.tsx:127`, `BatchUploadModal.tsx:148`; `itp/components/TemplateChecklistEditor.tsx:115-122` (a bare text input, the only user authoring surface for item test types, with no datalist at all — and gated on `evidenceRequired === 'test'` at `:115`, which means the **220 shipped items carrying the non-canonical value `'test_result'`** across 11 seeders cannot have their test type edited in the UI at all).

**Three vocabularies collide in one column.** Title Case with spaces (the modal datalist), snake*case (`frontend/src/pages/tests/constants.ts:131-165`, `sampleProjectData.ts:80`, and the backend spec lookups at `testResults/specificationRoutes.ts:29` **and** `testResults/presentation.ts:93`, both `toLowerCase().replace(/\s+/g,'*')`), and AS/RC/TMR method codes (the 40 seeders). §4.3's normalizer treats `\_`and a space as the same character; **that is a judgement made on its own merits (§4.3.1), not a reuse**`[F1C-C6]`.

**There is no test-result CSV or Excel importer.** The only bulk test-result ingest is the multi-file certificate batch upload. The ITP _item_ importer is the copilot one above.

### 2.4 The snapshot denormalization — load-bearing for §6 `[F1C-C4]`

A lot's ITP does **not** copy checklist-item rows. `ITPInstance` holds a JSON `templateSnapshot` (`schema.prisma:690`) and `TestResult.itpChecklistItemId` FKs the _template's_ item row directly. `routes/itp/helpers/templateSnapshot.ts:39-58` `buildTemplateSnapshot` copies item `id` at `:48` and `testType` verbatim at `:55`.

**Six production sites write that blob** (Rev 1 said nine; the review said seven):

| #   | Site                                 | Kind                                                                    |
| --- | ------------------------------------ | ----------------------------------------------------------------------- |
| 1   | `itp/instances.ts:196`               | `create` (built `:188`)                                                 |
| 2   | `lots/createRoutes.ts:164`           | `create` (built `:121`)                                                 |
| 3   | `lots/createRoutes.ts:417`           | `create`, clone-lot path                                                |
| 4   | `lots/bulkCreateCore.ts:222`         | `createMany` (`:228`)                                                   |
| 5   | `projects/sampleProjectRoute.ts:175` | `create` — **hand-rolled JSON** at `:121-136`, bypassing the helper     |
| 6   | `itp/templateLifecycleRoutes.ts:264` | `updateMany` — **hand-rolled JSON** at `:222-237`, bypassing the helper |

Plus one benchmark script, `scripts/bench-f05.ts:368`. No raw-SQL writer exists. **The review's count of seven double-counted `templateLifecycleRoutes.ts:222-237`, which is a builder rather than a write, and missed the bench script.**

Those blobs are what the checklist UI, hold-point evidence, claims evidence **and `conformancePrerequisites.ts:246, :389, :646`** actually read. Any design that canonicalizes the _column_ must rewrite every blob in the same migration — including the two hand-rolled shapes, which differ from the helper's (no `sequenceNumber` sort, no `?? null` coercion) — or the engine reads stale raw values on exactly the lots that matter. Six is fewer than nine and the argument is unchanged: one blob rewrite against production is one too many.

### 2.5 The tests that missed it

`counts.test.ts:57-69` and `routes/lots/testSufficiencyEntry.db.test.ts:306-345` build fixtures with the literal string `'compaction'`. They assert real arithmetic and would catch an operator error (the review's test-honesty table rates them Strong). They cannot catch a vocabulary mismatch, because they _are_ the mismatch — they invent a vocabulary the product never writes. §14 fixes this by deriving fixtures from shipped files rather than from imagination.

---

## 3. The defect, stated once

A lot on a VIC/`vicroads` project, activity `earthworks_general`, Scale A, with six `status: 'verified'` `passFail: 'pass'` tests:

| Test type as actually stored                | Source                                        | `normalizeTestTypeKey`  | `=== 'compaction'` |
| ------------------------------------------- | --------------------------------------------- | ----------------------- | ------------------ |
| `Density Ratio`                             | modal datalist `CreateTestModal.tsx:261`      | `density ratio`         | **no**             |
| `density_ratio`                             | prod (18 rows), `sampleProjectData.ts:80,217` | `density_ratio`         | **no**             |
| `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00` | shipped VIC seed (`:206,215,224`)             | same, lowered           | **no**             |
| `Field Density Nuclear`                     | modal datalist `:263`                         | `field density nuclear` | **no**             |
| `compaction`                                | prod (25 legacy rows)                         | `compaction`            | yes                |

`passingCount = 0`, `requiredCount = 6`, `state = 'insufficient'` (`evaluate.ts:152-163`). In `warn` the user is told they are missing six tests they have already paid for and filed. In `block` the same user cannot conform the lot, and the only escape is an owner force-conformance that records a blocker the snapshot contract currently drops (review F5).

The direction matters: this defect **over-states** the requirement. That is the safe direction for a gate, and it is why the review's release call was "leave warn running". It is not the safe direction for trust — a compliance tool that cannot see the tests in front of it does not get a second chance with a quality manager.

---

## 4. The design

### 4.1 The canonical key namespace — reused, not invented

A canonical **test category** is a key of the shipped `testTypeSpecifications` map (`backend/src/routes/testResults/specifications.ts:22-127`): `compaction` (`:23`), `cbr` (`:31`), `moisture_content` (`:39`), `plasticity_index` (`:47`), `liquid_limit` (`:55`), `grading` (`:63`), `sand_equivalent` (`:71`), `concrete_slump` (`:79`), `concrete_strength` (`:87`), `asphalt_density` (`:95`), `asphalt_thickness` (`:103`), `dcp` (`:111`), `permeability` (`:119`).

This is a **reuse of the vocabulary already in the tree**, for three reasons: `FrequencyRule.testType` already claims that map as its source (`types.ts:94`); the shipped pack's value `'compaction'` (`vicroads-204.v1.ts:105`) is already a key of it; and prod's 25 legacy `compaction` rows are already in that vocabulary. There is no new list of category names anywhere in this slice.

**Enforcement without an import.** Production code in `lib/` must not import from `routes/`, and moving the map is a bigger diff than the problem deserves. So the linkage is asserted in a **test**, which may import anything:

- every value the alias registry can produce is a key of `testTypeSpecifications`;
- every `rule.testType` across `SUFFICIENCY_RULESETS` is a key of `testTypeSpecifications`;
- every `rule.testType` across `SUFFICIENCY_RULESETS` has **at least one alias** resolving to it — a rule whose category nothing can ever resolve to is a silent zero-count rule, and that is this defect in a new hat;
- **the `LAB_REFERENCE` sentinel is _not_ a key of `testTypeSpecifications`** `[C1C-19]` — the assertion that makes it impossible for the exclusion marker to be mistaken for a category.

(§14 AT-22.) The registry file itself declares its categories as plain strings and imports nothing.

### 4.2 The alias registry

`backend/src/lib/readiness/sufficiency/testCategories.ts` — a **leaf module**, importing types only, in the same directory and of the same species as `rulesets/`: shipped product data, reviewable in a PR diff, CI-testable, revertable by `git revert`. C1 §3.1 already made this argument for rulesets; it applies unchanged.

```ts
/** Canonical test category. A key of `testTypeSpecifications` — asserted in tests, not imported. */
export type TestCategory = string;

/**
 * A token we have deliberately mapped to "known, and NOT a countable field
 * test" — distinct from `null`, which means "nobody has mapped this string".
 * The distinction is load-bearing: §4.4's item limb is suppressed for the first
 * and consulted for the second [C1C-19].
 */
export const LAB_REFERENCE = "lab_reference" as const;

export type Resolution = TestCategory | typeof LAB_REFERENCE | null;

/**
 * Alias token -> canonical category. Keys are ALREADY NORMALIZED (§4.3.1): lower
 * case, `_` folded to space, whitespace collapsed. Every entry cites the string
 * it was observed in.
 *
 * GOVERNANCE (§4.5), and it is NOT "additive is cheap":
 *   - ADDING an entry that introduces a METHOD CODE or a LAB REFERENCE is a
 *     PACK-CLASS change and needs the §9 review. An over-generous alias opens a
 *     gate silently — nobody sees a symptom.
 *   - REMOVING or repointing an entry is a normal PR. It can only over-state a
 *     shortfall, which is loud, visible and one line to recover.
 */
export const TEST_TYPE_ALIASES: Readonly<Record<string, TestCategory>> =
  Object.freeze({
    /* §5.2 */
  });

/**
 * Tokens that name a LABORATORY REFERENCE determination rather than the field
 * test a frequency clause counts (§5.3, Jay decision J2). Present so the
 * exclusion can be ENFORCED on both attribution limbs rather than merely absent.
 */
export const LAB_REFERENCE_TOKENS: ReadonlySet<string> = new Set([
  /* §5.3 */
]);
```

**The lookup is a `Map`, not a property read** `[F1C-R3]`. `test_results.test_type` is arbitrary free text from users, the AI vision extractor (`testResultMapping.ts:63`) and filename inference (`certificateExtraction.ts:75-79`) — a trust boundary. `Object.freeze({...})['constructor']` returns a **function**, and `toString`, `valueOf` and `hasOwnProperty` likewise; freezing prevents writes, not prototype reads. (`__proto__` happens to be defused by the `_`→space rule of §4.3.1 — an accident, not a defence.) So:

```ts
const ALIAS_LOOKUP = new Map(Object.entries(TEST_TYPE_ALIASES));
```

built once at module load. The literal stays for reviewability; the `Map` is prototype-free by construction and is also the fast path. One line, and AT-25 asserts `constructor`, `toString`, `valueOf`, `hasOwnProperty` and `__proto__` all resolve `null`.

**One registry, not one per pack.** Rejected alternative recorded in §16.1 D-F1c: `dry density ratio` is authority-agnostic, company-authored ITP items are not pack-scoped, and per-pack tables would duplicate the same entries across VIC, NSW and QLD and drift. Each entry carries an inline comment naming its authority and the file or prod count it came from, so per-pack provenance survives without per-pack files.

### 4.3 Resolution — token-exact, and why that is not substring matching

#### 4.3.1 Normalization

```
normalize(s) = s.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
```

Lower-case and trim are what `counts.ts:13-15` already does. Whitespace collapse handles the double spaces free-text entry produces. `_ -> space` is a **judgement**, justified on its own merits: three vocabularies collide in this column (§2.3), one of them writes `density_ratio` and another writes `Density Ratio`, and they are the same test. The claim in Rev 1 that this "reuses" `specificationRoutes.ts:29` is withdrawn — that code maps the other way, space→`_`, to reach snake_case keys `[F1C-C6]`.

**Nothing else is touched** — not `-` (`agpt-t212`), not `/` (`tmr q141a/b`), not `.` (`as 1289.5.4.1`), not `:` (`ag:pt/t250`).

`normalize` is **idempotent**: `normalize(normalize(s)) === normalize(s)`. Rule 4 below relies on that.

#### 4.3.2 Tokenization

A stored value yields a **token set**:

1. the whole normalized string;
2. the string with every parenthesised span removed, then re-normalized;
3. the contents of each parenthesised span, each re-normalized. **Parenthetical contents are NOT further split** `[F1C-R2]` — that is deliberate, and it is what keeps `Sections 204/304 (DDR, Scale C)` from yielding a bare `ddr` and `RC 316.00 / AS 1289 (grading, PI)` from yielding a bare `grading`. An implementer who "helpfully" applies rule 4 inside parentheses widens matching and breaks AT-24;
4. each fragment of (2) split on the separator set — `,` · `;` · `or` · `/` (a slash **surrounded by spaces**) — with **each fragment re-normalized** `[F1C-R1]`. This is not cosmetic: stripping `(Insitu Density)` from the shipped prod item `tmr q141a/b (insitu density), tmr q142a (mdd)` leaves `tmr q141a/b , tmr q142a`, whose first comma-fragment is `"tmr q141a/b "` — with a trailing space, it matches nothing and §4.3.3's worked example fails.

Bare `/` is deliberately **not** a separator, so `tmr q141a/b` and `as/nzs 2891.2.2` survive intact. Empty tokens are dropped.

`resolveTestCategory(value): Resolution` looks up every token and collects the distinct categories found:

- **exactly one** category -> that category;
- **two or more** categories -> `null`, plus a `conflict` flag the CI fixture asserts is never raised by a shipped seed or prod string (§14 AT-24). A string naming two categories is ambiguous, and this engine does not resolve ambiguity by picking;
- **zero** categories **and at least one token in `LAB_REFERENCE_TOKENS`** -> `LAB_REFERENCE` `[C1C-19]`;
- **zero** of both -> `null` (unknown).

**Categories win over lab references within a single string, and that ordering is the whole design.** The shipped prod item `TMR Q141a/b (Insitu Density), TMR Q142a (MDD)` contains both an in-situ density method and a lab MDD reference; it **must** resolve `compaction`, because the item genuinely requires an in-situ density test. Evaluating the exclusion only after the category union is what gets that right — and §4.4 is where the exclusion actually bites.

#### 4.3.3 Why this is not the banned substring match

The review rules out broad substring matching, and it is right to. Substring matching would false-positive: `as 1012.9 (compressive strength)` contains `1012.9`, and a substring rule keyed on `as 1012` would sweep concrete strength into whatever category it was written for.

Token-exact matching cannot do that. Worked non-match, with the real prod string — **executed, not argued**:

```
"AS 1012.9 (Compressive Strength)"
  normalize        -> "as 1012.9 (compressive strength)"
  tokens           -> { "as 1012.9 (compressive strength)",
                        "compressive strength",
                        "as 1012.9" }
  lookups          -> no category, no lab-reference token
  result           -> null (unknown) — attributes to nothing
```

And the matches it must make, with the real shipped strings:

```
"AS 1289.5.4.1 (Sand Replacement) or RC 316.00"      (vic-earthworks seed :157)
  tokens -> { whole, "sand replacement", "as 1289.5.4.1 or rc 316.00",
              "as 1289.5.4.1", "rc 316.00" }
  "as 1289.5.4.1" -> compaction ; "rc 316.00" -> compaction   => compaction

"TMR Q141a/b (Insitu Density), TMR Q142a (MDD)"      (prod itp_checklist_items, 5 rows)
  tokens -> { whole, "insitu density", "mdd", "tmr q141a/b , tmr q142a"
              -> re-normalized fragments -> "tmr q141a/b", "tmr q142a" }
  "tmr q141a/b" -> compaction ; "insitu density" -> compaction
  "tmr q142a" and "mdd" are LAB_REFERENCE_TOKENS, and a category was found
                                                              => compaction

"MDD Standard"                                        (modal datalist option :265)
  tokens -> { "mdd standard" }
  no category ; "mdd standard" is a LAB_REFERENCE_TOKEN       => LAB_REFERENCE
```

That third line is the one Rev 1 got wrong. Under Rev 1 it resolved `null`, indistinguishable from a string nobody had ever mapped — and §4.4 shows why that let six lab tests read "6 of 6".

**Flip condition, recorded now.** If a token ever produces a wrong attribution in the field, drop to whole-string-only matching: delete the tokenizer, keep the registry, and add the observed whole strings as keys. The registry survives the downgrade unchanged. That is the escape hatch, and it costs one function.

### 4.4 Where it plugs in — one shared helper, two callers `[F1C-B1]` `[F1C-B2]`

The bug Rev 1 would have shipped is a bug of _placement_, so the fix is placement: the attribution rule becomes **one exported function**, and both production callers call it. Patching `counts.ts` alone leaves the sibling caller broken — this is the guard-in-the-shared-function shape, not a guard per call site.

```ts
// testCategories.ts — THE attribution rule. Both callers use this; there is no
// second place where a test's candidate categories are decided [C1C-20].
export function candidateCategories(
  own: Resolution,
  linkedItem: Resolution,
): readonly TestCategory[] {
  // [F1C-B2] A test whose OWN type is a laboratory reference never attributes,
  // however it is linked. Six `MDD Standard` tests hung off a compaction ITP
  // item are still six lab tests. This is the limb Rev 1 left open.
  if (own === LAB_REFERENCE) return [];
  const out: TestCategory[] = [];
  if (typeof own === "string") out.push(own);
  // The item limb: consulted when the test's own type resolves to a DIFFERENT
  // category, or to nothing at all. A lab-reference ITEM contributes nothing.
  if (typeof linkedItem === "string" && linkedItem !== own)
    out.push(linkedItem);
  return out;
}
```

```ts
// counts.ts — the only change to this file
export function testAttributesToRule(
  ruleCategory: TestCategory | null,
  candidates: readonly TestCategory[],
): boolean {
  if (!ruleCategory) return false;
  return candidates.includes(ruleCategory);
}
```

```ts
// evaluate.ts — resolved ONCE per lot, before rules.map(...)
const resolve = input.resolveCategory ?? createCategoryResolver(); // §4.6
const testCategories = new Map(
  input.tests.map((t) => [t.id, resolve(t.testType)]),
);
const itemCategories = new Map(
  input.checklistItems.map((i) => [i.id, resolve(i.testType)]),
);
// candidateTestTypes(test, itemTestTypes) becomes
//   candidateCategories(
//     testCategories.get(test.id) ?? null,
//     test.itpChecklistItemId ? (itemCategories.get(test.itpChecklistItemId) ?? null) : null,
//   )
```

```ts
// regime.ts — streamEntryConforming, THE SECOND CALLER [F1C-B1]
export function streamEntryConforming(
  entry: RegimeStreamEntry,
  ruleCategory: TestCategory | null,
  resolve: CategoryResolver,
): boolean {
  if (entry.conformedAt === null) return false;
  if (entry.conformanceOverriddenAt !== null) return false;
  return !entry.testResults.some(
    (test) =>
      testFailing(test) &&
      testAttributesToRule(
        ruleCategory,
        candidateCategories(
          resolve(test.testType),
          resolve(test.itpChecklistItem?.testType),
        ),
      ),
  );
}
// deriveRegime (:219) passes resolve(rule.testType) and its own batch resolver.
```

`rule.testType` is resolved through the same function, so a pack could in principle declare an alias as its key and still work — but §4.1's assertion requires it to be a canonical key, so in practice this is an identity lookup.

**Purity is preserved.** `resolveTestCategory` is deterministic over frozen module-level data: no I/O, no clock, no randomness — the same species of pure lookup that `resolve.ts` already performs against `SUFFICIENCY_RULESETS`. Memoization (§4.6) is transparent: same input, same output. The evaluator stays sync and DB-free, so the **M39 byte-identity guarantee between the single conform path and the batched claim path survives** (`conformancePrerequisites.ts:461-473`; the single path is `:767`, the batch loop `:843-853`) `[F1C-C1]`.

**Rejected alternative — widen `SufficiencyTestRow` with a pre-resolved `category`, filled by each caller.** Recorded in §16.1 D-F1b. It looks more "resolved before evaluate", and it is strictly worse: two call paths resolving independently is two chances to diverge, which is precisely the invariant M39 exists to protect — and B1 is the demonstration that per-caller resolution is exactly the failure this codebase is prone to.

### 4.5 The alias-change policy — **inverted** `[F1C-B3]`

The registry carries **no version field**. It is not a pack: it encodes no authority's numbers and makes no claim that could be wrong about a specification. It is an interpretation of _our users' own free text_, and it is governed by one policy instead of a version. Rev 1 had this backwards; §13 contradicted it three sections later.

- **Adding** an alias that introduces a **method code** (`as …`, `rc …`, `tmr q…`, `t …`, `wa …`, a clause or section reference) or a **laboratory reference** is a **pack-class change**. It needs the §9 review and must state which lots' verdicts change. **An over-generous add is the dangerous direction**: a lot that should be blocked conforms, in `block` it is a gate that does not fire, and nobody sees a symptom. Adding `mdd standard -> compaction` is precisely the change a future agent makes while "completing datalist coverage", and Rev 1 blessed it as routine.
- **Adding** a plainly descriptive alias with no method code (`dry density ratio`, `field density sand`) is a normal PR.
- **Removing or repointing** an alias is a **normal PR**. It can only move a lot toward over-stating its shortfall — the direction `evaluate.ts:124` already calls "the safe direction". It is loud, visible on the lot's own screen, and one line to recover.

CI asserting this mechanically is not worth building (a reviewer reading a diff sees which kind of entry it is). It is stated in the registry's own header (§4.2) and in §15 exit item 6. **AT-26 is not the backstop** — it is a positive assertion the same PR can edit; the backstop is the review class.

**Snapshot interaction.** C1.2 snapshots record the _numbers_ (`requiredCount`, `passingCount`), not the vocabulary. A later alias change does not and must not rewrite a stored snapshot — a decision made on 2026-07-27 was made on the evidence visible on 2026-07-27, and that is the point of an immutable record. The deploy SHA already explains any historical number, and the registry is in git.

### 4.6 Memoization — batch-scoped, and measured `[F1C-B4]`

Rev 1 said "no memoization ships", and its own §12 numbers contradicted it. Measured at HEAD over the 264 distinct VIC seed strings:

```
unmemoized   2.49 us / resolve      5,000 lots x 12 strings => +150 ms
                                    5,000 lots x 35 strings => +436 ms   <- VIC earthworks template is ~35 items
                                    5,000 lots x 50 strings => +623 ms
memoized     0.021 us / resolve     5,000 lots x 35 strings => +3.7 ms   (264 distinct keys)
```

(The review measured 1.88 µs and +113 / +329 / +471 ms on its machine. Different constant, identical conclusion.) The headroom against the #1581 claim-create budget is **36 ms** (3,000 ms budget, 2,964 ms last measured). Unmemoized resolution overruns it by 4–17×. The claim path really does evaluate per lot: `conformancePrerequisites.ts:843-853` maps `computeConformanceResult` over every member, and `:555` calls `evaluateSufficiency` inside it.

**The design.** A `Map<string, Resolution>` **scoped to the batch call**, created by the batch entry point and passed down — the same shape C1 used when it threaded `sufficiency` in as a third parameter (`conformancePrerequisites.ts:466-473` documents that precedent explicitly).

```ts
export type CategoryResolver = (value: string | null | undefined) => Resolution;

export function createCategoryResolver(
  cache: Map<string, Resolution> = new Map(),
): CategoryResolver {
  return (value) => {
    const key = value ?? "";
    let hit = cache.get(key);
    if (hit === undefined) {
      hit = resolveTestCategory(key);
      cache.set(key, hit);
    }
    return hit;
  };
}
```

- **Bounded by construction, so no eviction policy.** The cache only ever holds strings already resident in the rows that batch fetched — 5,000 lots share ~35 template item strings and a handful of test types, so ~250,000 resolutions collapse to a few dozen entries. It is garbage-collected when the batch returns. This is why it is a plain `Map` and not an LRU: there is nothing to evict.
- **Threading.** `getConformanceResultsForLots` creates one resolver and passes it to every `computeConformanceResult` (a **fourth** optional parameter, mirroring the third); `computeConformanceResult` forwards it into the `evaluateSufficiency` input as `resolveCategory`. `resolveSufficiencyBatch` creates its own for the regime path (§4.4). Where the parameter is absent — the single-lot path, every unit test — `evaluateSufficiency` creates a fresh per-call resolver, so behaviour is identical and only the cache lifetime differs.
- **M39 is unaffected.** Memoization of a pure function is transparent; the single path and the batch path compute the same values. AT-32 asserts it over the changed seam.
- `// ponytail: plain Map, batch-scoped. No LRU, no module-level cache — an unbounded cache keyed on user-controlled strings is the design this one exists to avoid.`

Rejected alternative: a module-level cache with a size cap. Fewer signature changes, but it introduces process-lifetime state keyed on free text and a clearing discipline nobody will maintain. Recorded in §16.1 D-F1b.

---

## 5. The alias content

### 5.1 The evidence base

**Production, read-only query, 2026-07-27.** `test_results.test_type`, distinct: `compaction` (25) · `density_ratio` (18) · `dry density ratio` (1) · plus QA junk rows.

`itp_checklist_items.test_type`, distinct, top 30 by count: `as 1012.9` (24) · `survey` (16) · `as 1012.9 (compressive strength)` (15) · `level survey` (11) · `survey check` (9) · `as 1289.3.6.1` (9) · `density_ratio` (9) · `measurement` (8) · `as 1289.2.1.1` (8) · `as 2891.8` (8) · `q115 (ucs)` (7) · `as 2159` (7) · `as 5101.4` (7) · `cctv per wsa 05:2020` (6) · `field retroreflectivity (rl)` (6) · `as 1012.3.1` (5) · `rc 316.00` (5) · `austroads ag:pt/t250 (sand patch test)` (5) · `t198` (5) · `as 1379` (5) · `tp 320` (5) · `tmr q141a/b (insitu density), tmr q142a (mdd)` (5) · `survey measurement` (5) · `characteristic dry density ratio rc (per spec 201)` (5) · `as/nzs 2891.2.2 / agpt-t212` (5) · `as 1012.3.1 (slump)` (5) · `as 1289.5.4.1 or as 1289.5.7.1, rc 316.00` (4) · `austroads ag:pt/t251 (ball penetration test)` (4) · `rc 316.00 / rc 500.05` (4) · `tmr q115 (ucs)` (4).

**Shipped VIC earthworks seed** (`seed-itp-templates-vic-earthworks.js`), distinct `testType` values — **six of them are the same compaction requirement written six ways**, in one file:

| Value                                                        | ×   | Compaction?                            |
| ------------------------------------------------------------ | --- | -------------------------------------- |
| `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00`                  | 3   | yes (`:206,215,224`)                   |
| `AS 1289.5.4.1, RC 316.00, RC 316.10`                        | 1   | yes (`:242`) `[F1C-C5]`                |
| `AS 1289.5.4.1, RC 316.00`                                   | 1   | yes (`:331`)                           |
| `AS 1289.5.4.1 (Sand Replacement) or RC 316.00`              | 1   | yes (`:157`)                           |
| `AS 1289.5.4.1`                                              | 1   | yes (`:282`)                           |
| `RC 316.00`                                                  | 1   | yes (`:251`)                           |
| `AS 1289.2.1.1`                                              | 3   | no — moisture content (`:166,197,300`) |
| `AS 1289.6.1.1 (Soaked CBR), RC 324.01, RC 500.20`           | 1   | no — CBR (`:291`)                      |
| `AS 1289.3.6.1 (PI), AS 1289.6.1.1 (CBR)`                    | 1   | no (`:179`)                            |
| `AS 1289.3.1.1 (LL), AS 1289.3.3.1 (PL), AS 1289.3.6.1 (PI)` | 1   | no (`:50`)                             |

Six variants in one file is the argument for §4.3's token rule in a single line of evidence.

**The measured Victorian sweep** `[F1C-B6]`. The §4.3 tokenizer was executed at HEAD over all **8** `seed-itp-templates-vic-*.js` modules — asphalt, conduits, drainage, earthworks, environmental, pavements, road-furniture, structures — **264 distinct `testType` values across 355 items that carry one**:

| Registry                | Distinct VIC strings resolving to `compaction` | Conflicts |
| ----------------------- | ---------------------------------------------- | --------- |
| Rev 1's twelve entries  | **18**                                         | 0         |
| Rev 2's fourteen (§5.2) | **20**                                         | 0         |

The full resolving set at Rev 2, with the file and line of its first occurrence, is the checked-in expectation of AT-58:

```
RC 316.00                                                    vic-asphalt.js:914
RC 316.00 / RC 317.01                                        vic-asphalt.js:843
RC 316.00 / AS 2891.14.5 / RC 500.05                         vic-asphalt.js:923
Standard / modified compaction (Section 173)                 vic-conduits.js:140      <- new in Rev 2
RC 316.00 / AS 1289 (grading, PI)                            vic-drainage.js:113
RC 316.00 / AS 1289                                          vic-drainage.js:122
RC 500.05 / RC 316.00                                        vic-drainage.js:193
RC 316.00 / RC 500.05                                        vic-drainage.js:286
RC 316.00 / Survey                                           vic-drainage.js:317
AS 1289 / RC 316.00                                          vic-drainage.js:1358
Sections 204/304 (DDR, Scale C)                              vic-drainage.js:1826     <- new in Rev 2
AS 1289.5.4.1 (Sand Replacement) or RC 316.00                vic-earthworks.js:157
AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00                    vic-earthworks.js:206
AS 1289.5.4.1, RC 316.00, RC 316.10                          vic-earthworks.js:242
AS 1289.5.4.1                                                vic-earthworks.js:282
AS 1289.5.4.1, RC 316.00                                     vic-earthworks.js:331
RC 316.00 (Density Ratio and Moisture Ratio Lot Characteristics)   vic-environmental.js:643
AS 1289.5.4.1, RC 316.00, RC 330.03                          vic-pavements.js:567
AS 1289.5.4.1, RC 330.03, RC 316.00                          vic-pavements.js:1020
Section 173 (density ratio)                                  vic-pavements.js:1631
```

**Create Test modal datalist**, `CreateTestModal.tsx:260-268`, Compaction/Density optgroup verbatim (`:261-267`): `Density Ratio` · `Dry Density Ratio` · `Field Density Nuclear` · `Field Density Sand` · `MDD Standard` · `MDD Modified` · `Hilf Rapid`.

### 5.2 `compaction` — the fourteen entries

Every row cites where the string was observed. This is the entire content of `TEST_TYPE_ALIASES` at F1.

| Alias key (normalized)                             | Category     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compaction`                                       | `compaction` | prod `test_results` (25); identity with `specifications.ts:23`                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `density ratio`                                    | `compaction` | prod `test_results` `density_ratio` (18) + `itp_checklist_items` (9); modal option `:261`; `sampleProjectData.ts:80,217,229`                                                                                                                                                                                                                                                                                                                                                                                  |
| `dry density ratio`                                | `compaction` | prod `test_results` (1); modal option `:262`                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `characteristic dry density ratio rc`              | `compaction` | prod item `characteristic dry density ratio rc (per spec 201)` (5) — the parenthetical becomes its own inert token                                                                                                                                                                                                                                                                                                                                                                                            |
| `field density nuclear`                            | `compaction` | modal option `:263`; the nuclear-gauge field density determination                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `field density sand`                               | `compaction` | modal option `:264`; sand-replacement field density determination                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `hilf rapid`                                       | `compaction` | modal option `:267`; **AS 1289.5.7.1 is the Hilf density ratio rapid method** — a field compaction control test, not a lab reference                                                                                                                                                                                                                                                                                                                                                                          |
| `insitu density`                                   | `compaction` | prod item `tmr q141a/b (insitu density), tmr q142a (mdd)` (5)                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `tmr q141a/b`                                      | `compaction` | same prod item; TMR Q141A/B is the in-situ density method                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `as 1289.5.4.1`                                    | `compaction` | VIC seed (5 of the 6 earthworks compaction strings); AS 1289.5.4.1 = compaction control test, dry density ratio                                                                                                                                                                                                                                                                                                                                                                                               |
| `as 1289.5.7.1`                                    | `compaction` | VIC seed (`:206,215,224`); AS 1289.5.7.1 = Hilf density ratio, rapid method                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `rc 316.00`                                        | `compaction` | VIC seed (6 strings) + prod items `rc 316.00` (5) and `rc 316.00 / rc 500.05` (4); VicRoads code RC 316.00, compaction testing                                                                                                                                                                                                                                                                                                                                                                                |
| **`sections 204/304 (ddr, scale c)`**              | `compaction` | **New in Rev 2** `[F1C-B6]`. `seed-itp-templates-vic-drainage.js:1826`; the item is _"Verify compaction where DDR testing is specified"_, `evidenceRequired: 'test'`, acceptance _"…compaction to Scale C per Sections 204/304"_. **Whole-string entry deliberately** — the alternative is a bare `ddr` token plus splitting inside parentheses, which R2 forbids                                                                                                                                             |
| **`standard / modified compaction (section 173)`** | `compaction` | **New in Rev 2** `[F1C-B6]`. `seed-itp-templates-vic-conduits.js:140`; the item is _"Compact and test backfill"_, `evidenceRequired: 'test'`, acceptance _"density ratio >= 95% (standard compaction) … >= 98% (modified compaction, 3 tests per lot per Section 173)"_. **Whole-string entry deliberately** — the bare tokens `standard` and `modified compaction` name a _compactive effort_, i.e. a laboratory reference (§5.3), and must not become aliases. The whole string names the field requirement |

Coverage check against §5.1: every compaction row in the prod inventory resolves; all six VIC earthworks compaction strings resolve; the full VIC sweep resolves 20 distinct strings with zero conflicts. `rc 316.00 / rc 500.05` resolves on its `rc 316.00` limb (spaced `/` is a separator). `as 1289.5.4.1 or as 1289.5.7.1, rc 316.00` resolves three ways over.

### 5.3 Deliberately **not** `compaction` — and now in two kinds `[F1C-B2]`

Rev 1 listed six exclusions and implemented them as _absences_. An absence cannot be enforced: a test typed `MDD Standard` resolved `null`, and `null` was indistinguishable from "nobody mapped this", so the item limb attributed it anyway. Rev 2 splits them.

**(a) `LAB_REFERENCE_TOKENS` — enforced on both limbs.** These name a laboratory determination the field result is expressed _against_. A test whose own type resolves here **never** attributes, however it is linked (§4.4).

| Token           | Source                                                                                       | Why                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mdd standard`  | modal option `CreateTestModal.tsx:265`                                                       | AS 1289.5.1.1 — laboratory maximum dry density, standard compactive effort                                                                              |
| `mdd modified`  | modal option `:266`                                                                          | AS 1289.5.2.1 — laboratory MDD, modified compactive effort                                                                                              |
| `mdd`           | token of prod item `tmr q141a/b (insitu density), tmr q142a (mdd)` (5 rows)                  | Same                                                                                                                                                    |
| `tmr q142a`     | same prod item                                                                               | TMR Q142A is the MDD reference. That item still resolves `compaction` on its Q141a/b limb, which is correct — it _does_ require an in-situ density test |
| `as 1289.5.1.1` | `seed-itp-templates-austroads.js:108,182,1421`                                               | Lab MDD. This is why the exclusion is not academic: an Austroads-templated lot would otherwise falsely satisfy                                          |
| `as 1289.5.2.1` | `seed-itp-templates-qld-environmental.js:813`, `qld-pavements.js:435`, `sa-pavements.js:634` | Lab MDD, modified effort. Ships today in three seeders                                                                                                  |

**The failing scenario this closes, from shipped strings.** Item typed `AS 1289.5.4.1, RC 316.00, RC 316.10` (`vic-earthworks.js:242`) resolves `compaction`. Six test rows typed `MDD Standard`, each with `itpChecklistItemId` pointing at that item — the **common** entry path, since the modal's ITP picker is primary (`CreateTestModal.tsx:148-176`, JSX `:230-246`). Under Rev 1: each test resolves `null` on its own limb and `compaction` on the item limb, so `passingCount = 6`, `requiredCount = 6`, `state: 'satisfied'`, `sufficiencyBlocks: false` — a lot with **zero field density tests** reading "6 of 6 — met", which is the exact outcome J2 exists to prevent. It is unreachable today only because no item is typed literally `compaction`; F1 makes it reachable on **every** shipped VIC compaction item. Under Rev 2 the six tests resolve `LAB_REFERENCE`, `candidateCategories` returns `[]`, and the lot reads **0 of 6** with all six tests in `unlinkedPassingTestIds`. **AT-57** pins it with those exact strings.

**(b) Plain non-entries — unknown, and correctly so.** These are simply not aliases. They carry no exclusion semantics because nothing links them to a countable test.

| Value                                                                                             | Why not `compaction`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rc 316.10` (VIC seed `:242`, also in that item's `notes` at `:243`) `[F1C-C5]`                   | VicRoads **test-site selection** procedure, not a test. Every string containing it also contains `rc 316.00`, so excluding it costs nothing                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `rc 500.05` (prod item, VIC seed notes)                                                           | The **acceptance/assessment** procedure (characteristic value method), not a test method. Same — always co-occurs with `rc 316.00`                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **`rc 316.14`** (`seed-itp-templates-vic-pavements.js:260`) — **adjudicated in Rev 2** `[F1C-B6]` | **The review called this a missed compaction item. It is not, and the shipped item says so.** The item (`:254-262`) is _"Verify moisture ratio/dryback prior to surfacing (where specified)"_, acceptance _"Moisture ratio within specified range per RC 316.14; adequate dryback achieved before seal or asphalt placement"_, `evidenceRequired: 'test_result'`. That is a **moisture** determination, and `moisture_content` is a category no rule references at F1 (D-F1d). `null` is the correct resolution, and Rev 1's silence on the RC 316 series is closed by saying so |
| everything else in §5.1 and §5.4                                                                  | No rule references any other category (§16.1 D-F1d). `as 1012.9`, `survey`, `as 1289.2.1.1`, `as 5101.4`, `q115 (ucs)`, `cctv per wsa 05:2020` etc. stay unknown until a rule needs them                                                                                                                                                                                                                                                                                                                                                                                         |

**Failure direction of the exclusions.** If a lab reports a genuine field density result under a certificate typed `AS 1289.5.1.1`, that test stays uncounted and the lot over-reports its shortfall. That is the same conservative direction the engine takes everywhere else (`evaluate.ts:124`, "over-testing is the safe direction"), and it is visible: the test appears in the "not counted" advisory (§8.2), which is exactly the prompt a quality manager needs. **This is the one domain judgement in F1 and it is escalated as §16.0 J2.**

### 5.4 The ceilings this registry does **not** cover, measured `[F1C-R5]` `[F1C-B6]`

Two sweeps at HEAD, both executed:

**Victorian compaction-suspect misses — 30 distinct strings, all correctly `null`.** Every VIC seed item whose `testType`, `description` or `acceptanceCriteria` mentions compaction, density, DDR or MDD, and whose `testType` does not resolve, was listed and read. All 30 belong to categories with no rule at F1: asphalt in-situ density and air voids (`AS/NZS 2891.9.2 (nuclear gauge) or cores`, `Nuclear density gauge / AS/NZS 2891.9.2`, `AS/NZS 2891.8 (density/air voids from cores)`, `Section 407.27 (in-situ density/air voids)` — these are `asphalt_density`), concrete (`AS 1012.3 (slump)`, `AS 1012.3.5`), moisture (`AS 1289.2.1.1`, `In-situ moisture content vs OMC`), UCS and mix design (`AS 5101.4…`, `RC 330.02`, `RC 330.03`), grading (`AS 1141.11.1…`), test rolling (`Section 173 (test rolling)`), and one bentonite-slurry property set (`Density, Marsh funnel, pH, sand content`, `vic-structures.js:1144`). **No genuine soil field-compaction string is unresolved in any VIC seed.** That is acceptance-gate item 1, measured rather than asserted.

**The "compaction + modifier" ceiling, outside Victoria.** These ship today in QLD/SA/WA seeds and resolve `null`:

```
Compaction testing                             sa-drainage.js:180
Compaction verification testing                sa-drainage.js:290
Compaction method trial                        sa-drainage.js:171
Compaction testing per RD-EW-C2                sa-drainage.js:264
Compaction testing AS 1289.5.4.1; Level survey per MRTS56   qld-road-furniture.js:609
Relative compaction (Cl 9.2-9.3)               qld-pavements.js:1962
Q140A (relative compaction)                    qld-pavements.js:2251
Q115 (UCS), Q140A (relative compaction)        qld-pavements.js:2066
AS 1289 series (soil classification, compaction, chemical properties)  sa-environmental.js:802
```

(By contrast `Compaction (NATA-accredited lab)` and `Compaction (NATA-accredited lab; method/density per agency)` in `national-utilities.js:187,107` **do** resolve, via the bare `compaction` token after the parenthetical strip.)

**They are not aliased at F1, and the rule that decides it is:** _an alias ships in F1 only for a string a lot under a **resolved pack** can actually carry from a shipped seed._ The only resolved pack is `vicroads-204.v1`, scoped to `earthworks_general` and `earthworks_subgrade_prep` on VIC projects (`vicroads-204.v1.ts:106-108`), so VIC seed strings are in scope and QLD/SA/WA strings are not — they count toward nothing today whatever they resolve to. This is D-F1d ("a category gets its aliases in the PR that adds the rule referencing it") applied one level down, and it is what decides B6's two additions **in** and R5's nine **out** by the same principle rather than by taste.

**Flip condition, and the instrument that fires it:** the §7 classifier reports uncategorized production values by row count. The first time a VIC project's items or tests carry one of these phrasings — via a cloned interstate template or a company-authored one — the whole string is added as an entry, under §4.5's policy for its kind.

---

## 6. Why there is no column, no migration and no backfill

The alternative design — a stored `test_category` column on both tables, populated on write and backfilled — was considered and rejected. Five reasons, in descending weight:

1. **The string is denormalized into JSON at six production sites (§2.4)** `[F1C-C4]`. `itp_instances.template_snapshot` is what `conformancePrerequisites.ts:246, :389, :646` actually reads. A column migration must rewrite every blob in every instance in the same transaction — including the two hand-rolled shapes that bypass `buildTemplateSnapshot` — or the engine keeps reading stale raw values on exactly the lots under evaluation. That is a large, irreversible, hand-written JSON migration against production, to buy nothing.

2. **Aliases grow per authority; a column would need a re-backfill per pack.** The prod inventory already contains TMR Q-series and Austroads AG:PT strings. D14.3 lands NSW. Each new pack would ship a migration whose job is to re-derive a column that a lookup derives for free.

3. **This wave already shipped a backfill with a stale-read overwrite race** — review F6, `backfill-lot-activity-slug.ts:48-70`: read at `:49-54`, plan in memory at `:59`, update by id alone at `:63-66`, in separate transactions with no row locking. A canonicalization backfill has the identical shape and the identical race, against a column an editor can change at any moment through the write paths of §2.3. **We do not write, so we cannot race.**

4. **Rollback becomes complete.** `git revert` restores the previous behaviour exactly, with zero stranded data. A backfilled column cannot be un-backfilled — the raw value is gone or, if kept alongside, you have shipped two sources of truth for the same fact.

5. **Every write path stays untouched** — including the AI vision extractor, the filename inferencer, the spreadsheet importer, the 40 seeders and the offline-created tests that post through the ordinary route. A write-time derivation would have to be added to each of them, and a value written while an alias was missing would stay wrong until the _next_ backfill.

**What replaces the backfill.** Nothing needs replacing — read-time derivation is retroactive by construction; the 25 `compaction` rows, the 18 `density_ratio` rows and the one `dry density ratio` row all start counting the moment F1.2 deploys. What _is_ still needed is proof that the registry actually covers production, and that is §7.

**Cost of the choice, stated.** The column would be queryable and indexable. Nothing today wants that: sufficiency evaluates per lot over tests already fetched, and no reporting surface groups by category. If one ever does, the derivation is a pure function and a generated column or materialized view can be added then, from the same registry. **Flip condition:** a surface that needs to filter or aggregate across tenants by category.

---

## 7. The read-only production classifier `[F1C-C3]`

`backend/scripts/classify-test-types.ts` — **read-only, no `--execute` flag, no write path, ever.**

```
Reads   SELECT test_type, count(*) FROM test_results GROUP BY 1
        SELECT test_type, count(*) FROM itp_checklist_items GROUP BY 1
Reports for each distinct value: resolved category | lab_reference | null | conflict, and the row count.
Summary: rows resolved / lab-reference / unknown, and the top unknown values by count.
```

- **Host reporting, not host confirmation, and the Rev 1 mechanism was fabricated.** No `--confirm-db=<name>` flag exists anywhere in the tree; Rev 1 was the only occurrence of that string in the repository. The shipped pattern is `requireDatabaseTargetConfirmation(envName, description)` (`scripts/lib/database-target.ts:26-39`), which requires an **environment variable** equal to `` `${hostname}/${databaseName}` `` and is invoked **only under `--write`** (`backfill-lot-activity-slug.ts:33-38`). It also never prints the target — the target appears only inside the thrown error. This script has no write mode, so the confirmation gate does not apply. Instead it **prints `resolveDatabaseTarget(process.env)` (host/dbname) as its first line of output**, so the operator and the PR reader both know which database the report describes. That is the honest reuse: the helper, not a flag that does not exist.
- **Idempotence is trivial** — it is a `SELECT`. Running it twice produces the same report.
- **It ships in F1.1 and its output is pasted into the F1.2 PR body.** It is how a reviewer knows the fourteen entries are the right fourteen, and how a future pack author sizes their alias work in one command.
- It logs values and counts. It logs **no tenant identifiers, no lot ids, no project names** — a test type is product vocabulary, not tenant content.

---

## 8. Entry surfaces — no change of control, two changes of copy

### 8.1 The Create Test modal's control is not touched

The control stays: an ITP-item picker when the lot has test-bearing items, free text with the datalist otherwise (`CreateTestModal.tsx:148-176`, JSX `:230-246`, `:247-296`). The category is derived server-side and never entered.

The alternatives were considered and rejected (§16.1 D-F1e). A **category-first picker** ("choose Compaction, then describe the method") makes the field crew answer a question the engine can answer itself, on a mobile-adjacent surface, and it is wrong the moment a test does not fit a category. A **second "category" control beside the free text** doubles the input for a value with one correct answer. Both trade a real UX cost for a derivation we already have.

**One comment is added**, not a control: a `ponytail:`-style note at the datalist (`:259`) naming `testCategories.ts` so the next editor who adds an option knows where its alias lives. §14 AT-28 is the mechanical backstop.

### 8.2 The "these tests count toward nothing" advisory ships, and its copy becomes false `[F1C-R7]`

An unknown passing test is not silent. `evaluate.ts:233-238` collects `unlinkedPassingTestIds` — verified passing tests no resolved rule could attribute — and `:252` raises `tests_unlinked_to_itp_item`, which `evidenceReadiness/conformanceItems.ts:322-337` renders as a user-visible item with the related test ids attached. That is the honest surface the review asks for, and it shipped in C1.1.

**But the copy stops being true.** `conformanceItems.ts:330` reads:

> `${n} verified test${...} not linked to a checklist item, so ${...} not counted toward the required frequency.`

After F1 a test lands in that set whenever its category is unresolved — **including when it is perfectly well linked** to an item whose type nobody has aliased, and including when it resolves to a category no rule references. F1.2 replaces the detail with:

> `${n} verified test${n === 1 ? ' is' : 's are'} not counted toward the required frequency — ${n === 1 ? 'its test type is' : 'their test types are'} not recognised as one this ITP requires.`

The title (`Verified tests not counted`) and the code, severity, area and action label are unchanged. `evidenceReadiness.test.ts:215` asserts the current phrasing and is updated in the same commit. **No new reason code, no new item, no new panel.**

**Expected effect of F1.2:** this advisory gets _smaller_, because tests that previously appeared unattributable now attribute. Values that remain unknown keep appearing there, which is the prompt to add an alias.

### 8.3 The description leak — named precisely, still not fixed `[F1C-R6]`

`CreateTestModal.tsx:173` is `setValue('testType', item?.testType || item?.description || '')`: picking an ITP item that has **no** `testType` writes the item's free-text **`description`** into `test_results.test_type` — sentence-length prose in a 160-char column. Rev 1 called this "harmless under this design". **That is not true as stated, and the reason it is currently harmless is an accident.**

Measured at HEAD by running the resolver over every seeded item:

| Corpus              | Items | Picker-reachable | Reachable with **no** `testType` (the leak candidates) | Of those, description resolves |
| ------------------- | ----- | ---------------- | ------------------------------------------------------ | ------------------------------ |
| 8 VIC seed modules  | 969   | 361              | 6                                                      | **0**                          |
| All 40 seed modules | 3,501 | 1,149            | 32                                                     | **0**                          |

and separately: **9 of 988** distinct VIC item descriptions do resolve to `compaction` — e.g. `vic-pavements.js:339` _"Submit CTCR Quality Plan including mix design, production procedures, placement, **compaction**, curing, and testing regime"_, where the comma-split yields the bare token `compaction`. Two of those nine belong to items with no `testType`; **both are `evidenceRequired: 'document'`**, so neither is picker-reachable. Across all 40 seeders, five such descriptions exist and none is reachable.

**The dependency that keeps it at zero, named** — and the review's description of it corrected. It is **not** a filter on `evidenceRequired === 'test'`. `useLotItpTestItems.ts:14-15` is an **OR**:

```ts
item.evidenceRequired === "test" || Boolean(item.testType);
```

An item is offered in the picker if its evidence gate is `test` **or** it names a test type. So a leak requires `evidenceRequired === 'test'` **and** `testType` empty **and** a description that resolves — and no shipped seed item is in all three states. (Two further facts worth carrying: the hook reads `instance.template.checklistItems`, i.e. the **live** template rather than the snapshot; and 220 shipped items across 11 seeders carry the non-canonical `evidenceRequired: 'test_result'`, which is neither `'test'` nor editable in `TemplateChecklistEditor.tsx:115`.)

**Company-authored and imported templates have no such discipline** — `itpTemplateImportExecutor.ts:173` writes whatever the spreadsheet said, and `TemplateChecklistEditor.tsx` lets an admin create an `evidenceRequired: 'test'` item with an empty test type and a prose description. So the honest statement is: _the leak is real, its blast radius today is zero on shipped seeds, and the thing holding it at zero is a predicate in a frontend hook that nobody wrote for this purpose._ **AT-61** pins it — it asserts the count is zero over every seeded item, so the day a seed or a fixture creates a reachable leak, CI says so. It is recorded in §17.2 as a data-quality item for whoever next touches that modal, and it is deliberately not fixed here.

### 8.4 The unmatched-result item becomes an instruction `[F1C-B5]` — Jay's J3 copy requirement

F1.2 makes the sufficiency engine and the shipped conformance gate disagree inside a single payload, deliberately and temporarily (§16.0 J3, §19). A VIC lot with six **unlinked** verified passing `Density Ratio` tests against the seeded item `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00` will show, in one response:

- sufficiency: **"6 of 6 — met"**, `satisfied` (category-resolved, `conformancePrerequisites.ts:555`);
- `blockingReasons`: **"ITP requires a matching passing verified test result"** (`:577`, via `testMatchesItem`, raw equality, unchanged);
- `outstandingTestItems`: that item in state `unmatched_result_exists` (`:323`).

Read as two statements about the world, that is a contradiction and it is worse for a quality manager than either engine being wrong alone. Read as **one statement plus one instruction**, it is coherent: _the tests count; link them to the item and the lot conforms._ The copy is what decides which one the user sees, so it is a requirement of F1.2 and not a follow-up:

| Site                                                                                  | Today                                                              | F1.2                                       |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| `frontend/src/pages/lots/components/LotReadinessPanel.tsx:18` (per-test muted suffix) | `'result not linked'`                                              | `'link this test to its checklist item'`   |
| `evidenceReadiness/conformanceItems.ts:32-33` (count phrase)                          | `${n} with ${n === 1 ? 'an unlinked result' : 'unlinked results'}` | `${n} needing a result linked to the item` |

`evidenceReadiness.test.ts:215` and the `unmatched_result_exists` cases in `conformancePrerequisites.test.ts:1038-1057` are updated in the same commit. **AT-62** asserts the exact strings, so the day §19 removes the divergence, the copy change is a visible test diff rather than a leftover.

**The divergence is conservative in the direction that matters.** Sufficiency says "counted"; the gate still says "not conformable". The strict gate stays strict, so nothing conforms that could not conform before F1 — the movement is entirely in what the user is _told_, and it is told with an action attached. That is what makes the interim acceptable rather than merely tolerable.

---

## 9. Packs and provenance — nothing changes, and that is the point

`rulesets/vicroads-204.v1.ts` ships **byte-identical**. `testType: 'compaction'` (`:105`) was always the canonical category (`types.ts:94` `[C1C-17]`); the resolver was wrong, not the pack.

Therefore: **no re-confirmation pass, no `.v2`, no provenance story, no `revalidateBy` impact, no `evidenceGrade` impact**, and D14h's "edit `vicroads-204.v1` in place, with a pre-flight check" exemption is untouched because this slice does not edit it at all. The `registry.test.ts` currency assertions and AT-17's expired/non-A synthetic cases pass unchanged.

**The field keeps its name.** `FrequencyRule.testType` is not renamed to `category`. Renaming would touch the confirmed pack file, `RuleSufficiency.testType` — which is part of the verdict shape written into C1.2 snapshots — and every test in the wave, to buy a better word. C1 §5.4.2 says do not move the snapshot shape. The doc comment is sharpened to say "canonical test **category**"; the identifier stays (§16.1 D-F1a).

**The §9 review class**, invoked by §4.5 for a method-code or lab-reference alias addition, is the pack review: a named authority document, a clause or method reference, the string as observed in the tree or in production, and the statement of which lots' verdicts move.

---

## 10. Interaction with D14 / the NSW pack

`docs/plans/d14-q6-pack-spec-2026-07-27.md` (Rev 2) §5.2 encodes `tfnsw-q6.v1` with compaction rules keyed on the **same** `testType: 'compaction'`, and names F1 a hard dependency of block mode at `:73-74`, `:911` and `:1303`. So:

- **No fork.** D14.3 adds no second registry and no NSW-specific matcher. Its NSW method-code aliases (TfNSW T-series, and any Q6 strings the seeds carry) are added to `TEST_TYPE_ALIASES` **in the D14.3 PR**, with the same per-entry evidence citation.
- **The J2 exclusion must survive the handoff** `[F1C-R8]`. `d14-q6-pack-spec-2026-07-27.md:758` folds the R71 compaction family — explicitly including **"max wet/dry density"** — into one rule on `testType: 'compaction'`. If D14.3 adds a maximum-dry-density method code to the shared registry without reading §5.3, J2's lab-reference exclusion is silently reversed by a sibling PR. **Hard handoff condition:** D14.3's alias PR must classify **every entry it adds** as field test or laboratory reference, in the entry's own inline comment, and any lab reference goes into `LAB_REFERENCE_TOKENS` rather than `TEST_TYPE_ALIASES`. Under §4.5 that PR is pack-class by definition — every NSW entry is a method code.
- **Ordering.** F1.2 must land **before or with** D14.3. Shipping a confirmed NSW pack on top of raw-string attribution would ship the identical defect to a second state, and D14's exit gate item 12 cannot be met while it counts zero. This is a hard ordering constraint, not a preference.
- **File contention, named per house style.** F1 owns `sufficiency/testCategories.ts` (new), `sufficiency/counts.ts`, the attribution seam of `sufficiency/evaluate.ts` (`:68-78`, `:144-146`) and **`sufficiency/regime.ts` `streamEntryConforming` (`:165-173`) and its call site (`:219`)** `[F1C-B1]`. D14 owns `evaluate.ts`'s `figures`/band seam and `registry.ts` — **and D14 Rev 2 §895 re-specs `streamEntryConforming` itself**, so `regime.ts` is contended too, which Rev 1 could not have known because it did not know F1 touched that file. **`evaluate.ts` and `regime.ts` both need the single-owner window C1 §11 requires.** The edits do not overlap textually — F1 changes what is compared, D14 changes what is counted and adds a conformity condition — but they must be sequenced, not merged blind.
- **The seed-derived fixture (AT-58) generalizes for free.** It is parameterized by seed module and expected classification, so D14.3 adds the NSW seed modules as rows rather than a new test.

---

## 11. Phases and PR slicing

Two PRs, strictly ordered. Each is independently revertable; the first is provably behaviour-free, so the second's diff _is_ the behaviour change and can be reviewed as such.

### F1.1 — the registry, the corpus rows and the classifier (S) · zero behaviour change by construction

- `sufficiency/testCategories.ts`: `normalize`, `tokenize`, `TEST_TYPE_ALIASES` (§5.2), `LAB_REFERENCE_TOKENS` (§5.3), `resolveTestCategory`, `createCategoryResolver` (§4.6), `candidateCategories` (§4.4).
- Its unit tests (AT-22 … AT-26, AT-56 for the helper's contract).
- **Real-vocabulary rows added to `readiness/characterization/seedCorpus.ts`** `[F1C-B7]`. Today that file writes the literal `'compaction'` at `:60` (an item), `:92`, `:98`, `:104`, `:110`, `:154` (tests), and imports only `../../prisma.js` and `../../activityTaxonomy.js` — it never reads `sampleProjectData.ts`, so Rev 1's claim that the sample project is "a visible, intended example" of the corpus diff was wrong twice over. **Every corpus row is the identity case**, so without this step F1.2's regenerated corpus is byte-identical and exit item 10 proves nothing. F1.1 adds lots carrying `density_ratio` tests and an item typed `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00`, plus one lot with linked `MDD Standard` tests (§5.3's scenario). Under F1.1 those all count zero — the corpus regenerated in F1.1 records today's wrong numbers, deliberately — **so F1.2's diff is exactly the behaviour change.**
  - **Heads-up found while verifying:** `seedCorpus.ts:301-302` claims the corpus project's NSW lots resolve `tfnsw-r44.v1` as a draft ruleset. That ruleset was deregistered (`rulesets/index.ts:34` lists only `VICROADS_204_V1`), so those lots now resolve **no ruleset at all**. The comment is stale and the new rows must be on a **VIC/`vicroads`** project to exercise a resolved pack. Correcting that comment is in scope for F1.1; changing which ruleset the corpus resolves is **not**.
- `scripts/classify-test-types.ts` (§7), run read-only against production, output pasted in the PR body.
- **Nothing imports the module yet.** Fallow will flag every export as unused — **expected-by-design, stated in the PR body**, the F0.1 / C1.0 / D14.1 precedent.
- **Exit:** every §5.1 compaction string resolves and every §5.3 exclusion resolves to `LAB_REFERENCE` or `null` as tabulated, asserted in tests; the VIC sweep resolves exactly the 20 strings of §5.1 with zero conflicts; the classifier's production report shows the unknown remainder; `npm test` green; the regenerated corpus contains the new rows **with today's wrong numbers**.

### F1.2 — the engine switch (S) · the behaviour change

- `counts.ts` `testAttributesToRule` compares categories (§4.4).
- `evaluate.ts` resolves both maps once per lot and calls `candidateCategories` (§4.4).
- **`regime.ts` `streamEntryConforming` resolves too** (§4.4) `[F1C-B1]`.
- `conformancePrerequisites.ts` threads the batch resolver (§4.6) and its `evaluate.ts:7` M39 citation is corrected to `:461-473` `[F1C-C1]`.
- `predicates.ts:222-230`'s docstring is corrected — the mirror it names does not exist and the unification it promises already happened `[F1C-C2]` `[F1C-R9]` — and gains the §19 warning **in the code**.
- **Copy:** `conformanceItems.ts:32-33` and `:330`, `LotReadinessPanel.tsx:18` (§8.2, §8.4).
- **The real-vocabulary fixtures** (AT-57, AT-58, AT-29, AT-30) — the actual deliverable.
- `counts.test.ts:57-69` and `testSufficiencyEntry.db.test.ts:306-345` updated: their synthetic `'compaction'` fixtures stay (they still assert arithmetic) and gain real-vocabulary siblings. The synthetic ones are **not** deleted — they are the identity case.
- Characterization corpus regenerated; the diff reviewed and **accepted explicitly in the PR body**. Expected: only lots on VIC/`vicroads` projects whose tests now attribute — `passingCount` up, `state` `insufficient` -> `satisfied` where the tests exist, `unlinkedPassingTestIds` down, **and the `MDD Standard` lot unchanged at zero**. **Any diff on a lot whose project resolves no pack is a bug, not an expected change.**
- **Exit:** the review's acceptance-gate items 1 and 2 both pass (§15).

**File ownership.** This slice owns `sufficiency/testCategories.ts`, `sufficiency/counts.ts`, `sufficiency/evaluate.ts` (`:68-78`, `:144-146`), **`sufficiency/regime.ts` (`:165-173`, `:219`)**, `readiness/characterization/seedCorpus.ts`, the resolver threading in `conformancePrerequisites.ts`, the docstring at `readiness/predicates.ts:222-230`, `evidenceReadiness/conformanceItems.ts` (`:32-33`, `:330`), `scripts/classify-test-types.ts` (new), and **two frontend lines** — the comment at `CreateTestModal.tsx:259` and the copy at `LotReadinessPanel.tsx:18`. **Contended:** `evaluate.ts` **and `regime.ts`** with D14 (§10). It touches **no** route handler, **no** schema, and no `predicates.ts` _behaviour_.

---

## 12. Scale and performance `[F1C-B4]`

Measured against the reference dataset (5,000 lots, 10,000 map features, 50 GB evidence, 10k-row registers).

| Target                                                    | Budget                                                                                                                                                                                                                | Method                                                                                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Additional queries per readiness call                     | **0** — the registry is a frozen module constant; no table, no join, no fetch                                                                                                                                         | Query-count assertion, deterministic in CI (AT-33)                                                                                                |
| **Category resolution across a whole 5,000-member claim** | **< 25 ms total**, with the batch resolver of §4.6. Rev 1's "p95 < 1 ms per lot" is **withdrawn** — multiplied out it is 5,000 ms against 36 ms of headroom, which is why the two Rev 1 budgets could not both be met | AT-60: resolve-count and wall-clock over the batch, plus an assertion that the batch cache's distinct-key count is bounded by the fetched strings |
| Sufficiency evaluation on a VIC lot                       | **p95 < 25 ms**, unchanged from C1 §12                                                                                                                                                                                | Server-side timing                                                                                                                                |
| Total `GET /api/lots/:id/readiness`                       | **p95 < 400 ms**; must not regress > 10 % vs master                                                                                                                                                                   | Existing route benchmark                                                                                                                          |
| **Claim create at the 5,000-member ceiling**              | **p95 < 3,000 ms** — the #1581 budget (`0d94beba`) `[C1C-14]`, last measured 2,964 ms. **This slice must not regress it.**                                                                                            | F0.5 maximum-size claim benchmark (AT-33)                                                                                                         |
| `claim_member` snapshot size                              | **≤ 1 KB**, unchanged — this slice adds no per-rule member data                                                                                                                                                       | C1 §5.4.3 assertion                                                                                                                               |

**Memoization ships**, and §4.6 states why, with both the unmemoized and memoized measurements. Rev 1's `// ponytail: no cache` comment is replaced by §4.6's, which names the bound rather than deferring it to a benchmark that would have failed.

---

## 13. Rollback and recovery

| Phase                  | Rollback                                                                                                                                                                         | Stranded?                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **F1.1**               | `git revert`. Removes dead code, a read-only script and corpus rows.                                                                                                             | **No.** Nothing was written by anything outside the corpus fixture.                                                                                          |
| **F1.2**               | `git revert`. Attribution returns to raw-string equality; counts return to today's (wrong) numbers, i.e. to the state the review already judged safe to leave running in `warn`. | **No.** No column, no backfill, no migration, no rewritten JSON — there is nothing to un-do. This completeness is the design's main practical dividend (§6). |
| **A single bad alias** | Delete the line and deploy — and under §4.5 that is the _normal_ PR, by design.                                                                                                  | If C1.2 snapshots have landed, past snapshots keep the number computed at the time — a true historical record of the decision as it was made (§4.5).         |

**Failure mode if the registry is wrong in the generous direction** (an alias maps something that is not a compaction field test): a lot reads `satisfied` when it is not. In `warn` that is a missing warning; in `block` it is a gate that does not fire. **This is the invisible failure, and §4.5 is now aligned with it** — the review class sits on additions, not removals `[F1C-B3]`. It is also why §5.3's exclusions are individually argued and escalated (§16.0 J2), and why §15 exit item 5 requires `block` mode to stay off until Jay signs off the exclusions.

**Failure mode if the registry is wrong in the conservative direction** (a real compaction test stays unknown): today's behaviour, plus the §8.2 advisory naming the test. Recoverable by adding one line — under a pack-class review if that line carries a method code.

---

## 14. Acceptance tests

Continuing the C1 series (which ended at AT-21). **D14 Rev 2 claimed AT-34 … AT-55**, so Rev 2's new tests take **AT-56 onward**. Every item is a real assertion in a real test file.

**The registry and the resolver (F1.1, pure):**

- **AT-22 — the namespace contract.** Every value `TEST_TYPE_ALIASES` can produce is a key of `testTypeSpecifications`; every `rule.testType` across `SUFFICIENCY_RULESETS` is a key of it; every `rule.testType` has **at least one alias resolving to it**; and **`LAB_REFERENCE` is not a key of it** `[C1C-19]`. The third assertion catches "a rule nothing can ever count toward"; the fourth makes it impossible for the exclusion sentinel to be mistaken for a category.
- **AT-23 — normalization.** `Density Ratio`, `density_ratio`, `DENSITY  RATIO`, `density ratio` all resolve to `compaction`. `-`, `/`, `.` and `:` are **not** normalized away: `tmr q141a/b`, `as/nzs 2891.2.2`, `as 1289.5.4.1` and `ag:pt/t250` survive tokenization intact. **The slash asymmetry is pinned** `[F1C-R4]`: `Field Density Nuclear / Sand` -> `compaction`, `field density nuclear/sand` -> `null`, asserted together with a comment naming it a known ceiling (§17.4).
- **AT-24 — tokenization and conflict.** Table-driven over §4.3.3's three worked examples plus every string in §5.1. Asserts the produced token set, the resolution, and that **no shipped seed or prod string raises a conflict**. Includes the R1 case (`tmr q141a/b (insitu density), tmr q142a (mdd)` — the fragment `"tmr q141a/b "` must be re-normalized) and the R2 case (`Sections 204/304 (DDR, Scale C)` must **not** yield a bare `ddr`, `RC 316.00 / AS 1289 (grading, PI)` must **not** yield a bare `grading`).
- **AT-25 — the non-match proof, and the trust boundary.** `AS 1012.9 (Compressive Strength)`, `AS 1289.2.1.1`, `AS 1289.3.6.1`, `survey`, `cctv per wsa 05:2020`, `q115 (ucs)`, `field retroreflectivity (rl)` -> `null`; and `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `__proto__` -> `null` `[F1C-R3]`. **The test's header states that substring matching is prohibited and that this test is the proof** — so a future agent tempted to "improve" the matcher sees the constraint at the failure site.
- **AT-26 — the exclusions, as a positive assertion.** `MDD Standard`, `MDD Modified`, `AS 1289.5.1.1`, `AS 1289.5.2.1` resolve to **`LAB_REFERENCE`** (not merely `null`); `RC 316.10`, `RC 500.05`, `RC 316.14` resolve to `null`; each with the §5.3 rationale in an inline comment. `TMR Q141a/b (Insitu Density), TMR Q142a (MDD)` resolves to `compaction` **on its Q141a/b limb**, proving category-over-exclusion ordering.
- **AT-56 — the shared candidate rule** `[F1C-B1]` `[F1C-B2]`. Direct unit test of `candidateCategories`: `(LAB_REFERENCE, 'compaction') -> []`; `(null, 'compaction') -> ['compaction']`; `('compaction', null) -> ['compaction']`; `('compaction', 'compaction') -> ['compaction']`; `(null, LAB_REFERENCE) -> []`; `(null, null) -> []`. Its header states that **this function is the only place attribution candidates are decided, and that both `evaluate.ts` and `regime.ts` must route through it** `[C1C-20]`.

**Real vocabulary (F1.2, integration) — the deliverables:**

- **AT-57 — the MDD item-limb boundary, from shipped strings** `[F1C-B2]`. A VIC/`vicroads` `earthworks_general` Scale A lot whose ITP item is typed **`AS 1289.5.4.1, RC 316.00, RC 316.10`** (`vic-earthworks.js:242`) and which has **six verified passing tests typed `MDD Standard`, each with `itpChecklistItemId` set to that item**, reads **0 of 6, `insufficient`**, with all six in `unlinkedPassingTestIds` and `tests_unlinked_to_itp_item` raised. The linked case, not the unlinked one — this is the test Rev 1's AT-30 did not write.
- **AT-58 — the seed-derived fixture, all eight VIC modules** `[F1C-B6]`. The seeders **cannot be imported**: each constructs `new PrismaClient()` at module scope and calls `withItpTemplateSeedLock(prisma, main)`, exporting nothing, so importing one would open a database connection and start seeding. The fixture therefore **reads the files as text** and extracts every `testType: '…'` literal with one regex — no execution, no Prisma, no side effect. Three assertions over `seed-itp-templates-vic-*.js`:
  1. the set of distinct values resolving to `compaction` is **exactly** the 20 strings tabulated in §5.1 — a new resolving string, or a lost one, fails CI;
  2. **zero conflicts** across all 264 distinct values;
  3. every value whose `testType`, item `description` or `acceptanceCriteria` mentions compaction / density / DDR / MDD and which resolves to `null` appears in a checked-in adjudication list with a one-line reason (§5.4's 30). **Adding a compaction-flavoured item to any VIC seed fails CI until it is classified.**
     D14.3 adds the NSW seed modules as rows (§10).
- **AT-28 — the modal-option fixture.** Every option in the Compaction/Density optgroup of `CreateTestModal.tsx:260-268` resolves to `compaction`, **except** `MDD Standard` and `MDD Modified`, which resolve to `LAB_REFERENCE` per §5.3. The literal list is copied into the test with a citation to `:261-267`; the modal carries a reciprocal comment (§8.1). Known ceiling: this pairing is by citation, not by import — §17.3.
- **AT-29 — the review's gate, end to end.** A VIC/`vicroads` `earthworks_general` Scale A lot with **six verified passing tests** reads **6 of 6, `satisfied`, `sufficiencyBlocks: false`**, run once per entry vocabulary: `Density Ratio`; `density_ratio`; tests linked to an ITP item typed `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00`; and the legacy `compaction`. Five verified passing tests reads **5 of 6, `insufficient`**, in all four. This is acceptance-gate items 1 and 2 as one table-driven DB test.
- **AT-30 — the MDD boundary, unlinked.** The same lot with six passing **unlinked** `MDD Standard` tests reads **0 of 6, `insufficient`**, and the six appear in `unlinkedPassingTestIds` with `tests_unlinked_to_itp_item` raised. Both halves asserted: the count is not inflated, **and** the user is told why. (AT-57 is its linked sibling.)
- **AT-56b — the regime streak, real vocabulary** `[F1C-B1]`. A three-lot conformed streak in which the middle lot carries a **failing** test typed `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00` (or linked to an item so typed) yields `reducedFrequencyEligible: false`. Asserted through `regime.db.test.ts` on the same shipped strings as AT-29. Without this, the B1 failure ships green.

**Copy and leak (F1.2):**

- **AT-61 — the description leak stays at zero** `[F1C-R6]`. Over every item in all 40 seed modules, the count of items that are picker-reachable (`evidenceRequired === 'test' || Boolean(testType)`), have no `testType`, **and** whose `description` resolves to a category is **0**. Its header names `CreateTestModal.tsx:173` and `useLotItpTestItems.ts:14-15` as the two halves of the dependency.
- **AT-62 — the J3 copy** `[F1C-B5]`. Asserts the exact strings of §8.4 and §8.2 at `LotReadinessPanel.tsx:18`, `conformanceItems.ts:32-33` and `:330`, so §19 removing the divergence shows up as a test diff.

**No collateral change (F1.2):**

- **AT-31 — nothing outside a resolved pack moves.** A lot on a project resolving no ruleset produces a byte-identical readiness payload and a byte-identical `canConform` outcome before and after, at every mode — asserted through `predicates.parity.test.ts` and `lotConformanceDecision.db.test.ts`. `predicates.ts` `testMatchesItem` **behaviour** is unchanged everywhere (§17.1).
- **AT-32 — purity and byte-identity.** `evaluateSufficiency` remains sync and DB-free; the single conform path (`conformancePrerequisites.ts:767`) and the batched claim path (`:843-853`) produce byte-identical verdicts for the same lot with the new vocabulary, **with and without a shared batch resolver** (§4.6) — the M39 guarantee, re-asserted over the changed seam.
- **AT-33 — performance.** **Zero additional queries** per readiness call; claim create **p95 < 3,000 ms** at 5,000 members `[C1C-14]`; readiness p95 not regressed > 10 %.
- **AT-59 — the union ceiling, pinned** `[F1C-R10]`. Asserts that `RC 316.00 / Survey`, `RC 316.00 / AS 1289 (grading, PI)` and `RC 316.00 / AS 2891.14.5 / RC 500.05` resolve to `compaction` **today**, with a header stating that this is the mixed-method behaviour §17.5 accepts, and that the PR introducing a second category must revisit it — at which point this assertion changes and the change is visible.
- **AT-60 — the batch resolver** `[F1C-B4]`. Over a 5,000-member claim fixture: total resolution wall-clock < 25 ms, and the batch cache's distinct-key count is bounded by the distinct strings the batch fetched (not by the row count).

---

## 15. Exit gate

1. **The review's acceptance-gate item 1 passes** — a test created from each shipped Victorian compaction ITP test type maps to the canonical rule and counts (AT-58 across all 8 VIC modules, AT-29).
2. **The review's acceptance-gate item 2 passes** — actual UI choices, `Density Ratio` foremost, count correctly (AT-28, AT-29). **Stated honestly:** it passes for the _count_. The _gate_ (`testMatchesItem`) still requires the link, by J3's decision, and §8.4's copy says so on the same screen.
3. **No substring matching anywhere**, and the prohibition is asserted at the failure site rather than left in a document (AT-25).
4. **Unmapped stays uncategorized and visible; lab references stay excluded on both limbs** — the unlinked MDD case counts zero and raises the advisory (AT-30), **and the linked MDD case does too** (AT-57).
5. **The §5.3 exclusions are confirmed by a person who tests soil for a living** — owner **Jay** (§16.0 J2). Required before any project is flipped to `block`; **not** required to ship F1.2 in `warn`.
6. **The alias-change policy is written in the registry's own header**, not only here, **in its inverted form** (§4.5) `[F1C-B3]`.
7. **The classifier's production report is in the F1.2 PR body**, with the unknown remainder and its row counts stated rather than summarized, and the target host/dbname line included (§7).
8. **No pack file changed** — `git diff --stat` over `rulesets/` is empty across both PRs (§9).
9. **No schema change, no migration, no data write** — `git diff --stat` over `prisma/` is empty across both PRs (§6).
10. **Nothing outside a resolved pack moved** (AT-31), proven the three C1 ways — and the corpus is one of them **only because F1.1 put real vocabulary in it** `[F1C-B7]`: the F1.2 corpus diff must be **non-empty**, must contain the VIC lots whose counts move, and must contain **no** change to the `MDD Standard` lot or to any lot on a pack-less project.
11. **§12 budgets met**, including claim create p95 < 3,000 ms, zero additional queries, and total batch resolution < 25 ms (AT-33, AT-60).
12. **`regime.ts` is proven fixed, not merely edited** — AT-56b fails on master and passes on the branch `[F1C-B1]`.
13. **F1.2 lands before or with D14.3** (§10), so the NSW pack never ships on raw-string attribution, and D14.3's alias PR classifies every entry field-vs-lab `[F1C-R8]`.
14. **The §18 C1-spec amendments are filed** as a follow-up issue or PR — not silently left stale.
15. **§19 is filed as a named follow-up slice** before F1.2 merges, with the R9 warning landed in `predicates.ts` in F1.2 itself `[F1C-B5]` `[F1C-R9]`.
16. **`npm run fallow:audit` verdict recorded in every PR body**, with F1.1's expected unused-export warnings called out as by-design.

---

## 16. Decisions

### 16.0 Jay decisions

1. **J1 — Does F1.2 unblock `block` mode?** No, and it should not be read that way. F1 closes review findings 1 of 3; F2 (invalid `testScale` on single-lot write paths) and F3 (Section 173) remain, and both are independently sufficient to produce a wrong gate. Recommendation: **ship F1.1 and F1.2 into `warn` immediately** — they make the advisory honest, which is the whole value of `warn` — and keep `block` off until the review's full acceptance gate passes (D14 §15.1 now owns that ten-item gate). This is the review's own recommended release decision, unchanged.

2. **J2 — Are laboratory MDD tests excluded from the per-lot count?** This is the one place F1 makes a domain call rather than a mechanical one. The engineering reading is clear: clause 204.13(a)'s six are field density-ratio determinations, and AS 1289.5.1.1 / 5.2.1 (`MDD Standard` / `MDD Modified`, `TMR Q142a`) are the laboratory reference the field result is expressed _against_. Mapping them would let a lot with zero field tests read "6 of 6 — met". Recommendation: **ship the exclusion**, and have a lab or QA contact confirm it before any project is flipped to `block` (exit item 5). If they say the opposite, it is a two-line change and a corpus regeneration; the cost of being wrong the other way is a gate that does not fire. **Rev 2 strengthens the mechanism, not the judgement:** the exclusion is now enforced on both attribution limbs (§4.4, §5.3) rather than merely absent from the alias table `[F1C-B2]`.

3. **J3 — The engine and the gate will disagree inside one payload. Ship anyway? — DECIDED 2026-07-27: "fix counts now, gate matcher next."** `[F1C-B5]`

   The review escalated this correctly: after F1.2, `conformancePrerequisites.ts:555` counts by category while `:536` gates by raw string, over the same rows in the same function, so a VIC lot with six unlinked `Density Ratio` tests reads "6 of 6 — met" and "ITP requires a matching passing verified test result" on one screen.

   **Jay's decision, and its two conditions:**
   - **F1 ships the counting fix now.** The alternative — hold F1 until the gate matcher moves too — keeps every VIC quality manager looking at "0 of 6" for tests they have already filed, to avoid a transitional inconsistency that is _fixable with copy_. That trade is wrong.
   - **The copy carries it.** The `unmatched_result_exists` item must read as an **action** — "link this test to its checklist item" — so the user sees one instruction, not two contradictory claims. This is a **requirement of F1.2**, specified at §8.4 and asserted by AT-62, not a follow-up.
   - **A dedicated follow-up slice brings the gate matcher onto the same categories**, spec'd at **§19**, with its own characterization and its own review. It is filed before F1.2 merges (exit item 15).

   **Why the interim is acceptable:** the divergence is **conservative**. Sufficiency becomes more generous; the gate stays exactly as strict as it is today. Nothing conforms after F1.2 that could not conform before it. The movement is entirely in what the user is _told_, and §8.4 makes what they are told an instruction they can act on in one click.

### 16.1 The spec's own decisions

**D-F1a — The canonical key is a `testTypeSpecifications` key, and `FrequencyRule.testType` keeps its name.** -> §4.1, §9. The vocabulary already exists in the tree, the shipped pack already uses it, and `types.ts:94` already claims it — the claim just needed enforcing `[C1C-17]`. Renaming the field to `category` would touch the confirmed pack, the verdict shape that C1.2 snapshots serialize, and every test in the wave, to buy a better word. Rejected alternative: a fresh `TestCategory` union declared from scratch — a second vocabulary beside the one the product already ships is how you get three.

**D-F1b — Resolution happens inside the evaluator, once per lot, through a shared helper, with a batch-scoped cache.** -> §4.4, §4.6. Widening `SufficiencyTestRow` with a pre-resolved `category` filled by each caller reads more like "resolved before evaluate", and is worse: two call paths resolving independently is two chances to diverge, and `[F1C-B1]` is the proof that this codebase makes exactly that mistake. A frozen-data lookup is pure by every definition that matters, and memoizing a pure function is transparent. Rejected alternatives: **(i)** no cache at all — Rev 1's position, contradicted by its own budget and by measurement (§4.6); **(ii)** a module-level cache with a size cap — fewer signature changes, but process-lifetime state keyed on user-controlled free text plus a clearing discipline nobody maintains, to save one optional parameter that the file's own C1 precedent already normalizes.

**D-F1c — One alias registry, not one per pack.** -> §4.2. `dry density ratio` belongs to no authority; company-authored ITP items are not pack-scoped; and per-pack tables would duplicate the same entries across VIC, NSW and QLD and then drift apart. Per-entry inline citations preserve authority provenance without per-authority files. D14.3 adds NSW entries to the same file in its own PR, under §10's field-vs-lab handoff condition.

**D-F1d — `compaction` is the only category with aliases at F1, and only for strings a resolved pack's lots can carry.** -> §5.3, §5.4. Categories are load-bearing only where a rule references one, and exactly one rule exists (`vicroads-204.v1/compaction-density`, scoped to `earthworks_general` and `earthworks_subgrade_prep`; D14's Q6 rules key on the same category). Mapping `as 1012.9 -> concrete_strength` today would be four unexercised lines. **Rev 2 adds the second half of the rule**, which is what decides B6 and R5 by the same principle: a string earns an alias when a lot under a resolved pack can carry it from a shipped seed — so the two VIC misses are in and the nine QLD/SA phrasings are out. **Flip condition:** a category gets its aliases in the PR that adds the rule referencing it; an out-of-scope string gets one when the classifier shows it in production under a resolved pack.

**D-F1e — The Create Test modal's control is not changed.** -> §8.1. Free text plus datalist is the shipped UX and it is fine; the category is a derivation, not a user decision. A category-first picker asks the field crew to answer what the engine already knows and breaks on the first test that fits no category; a second category control doubles input for a value with one correct answer. One comment is added, AT-28 is the mechanical backstop, and the only _copy_ that changes is §8.4's.

**D-F1f — Token-exact matching, not whole-string-only.** -> §4.3. One shipped seed file writes the same compaction requirement **six ways** (§5.1); whole-string matching means six entries today and a seventh the moment someone reorders the codes, across 40 seed files. Token-exact collapses that to the method codes, which is what a civil engineer would say the vocabulary actually is. It is not the banned substring match, and AT-25 proves it at the failure site. **Whole-string entries remain available and are used deliberately** where the tokens would be unsafe — both of Rev 2's additions are whole strings (§5.2). **Flip condition:** one wrong field attribution and we delete the tokenizer, keep the registry, and add whole strings as keys — the downgrade costs one function and loses nothing.

**D-F1g — Union across tokens, conflict resolves to `null`, categories beat lab references.** -> §4.3.2. An ITP item naming several methods requires a test of each; a certificate naming several reports one. Both make "any token matches" correct. A string resolving to **two** categories is genuinely ambiguous, and this engine declines rather than picks. A string naming both a field method and its laboratory reference resolves to the field method — that is what the shipped `tmr q141a/b (insitu density), tmr q142a (mdd)` requires. **Known ceiling, accepted and pinned:** with one category the conflict rule cannot fire, so mixed-method items resolve to `compaction` (§17.5, AT-59) `[F1C-R10]`.

**D-F1h — No column, no migration, no backfill.** -> §6. Five reasons, the decisive one being that the same string is denormalized into `itp_instances.template_snapshot` JSON at six sites, so a column migration must rewrite every blob or leave the engine reading stale values on exactly the lots under evaluation. The wave's one existing backfill already has a stale-read race (review F6) whose shape a canonicalization backfill would reproduce exactly. **Flip condition:** a surface that must filter or aggregate by category across tenants.

**D-F1i — The registry has no version field, and its change policy is inverted from Rev 1.** -> §4.5 `[F1C-B3]`. It encodes no authority's numbers, so it cannot be wrong about a specification the way a pack can. It is governed by a **direction-of-risk** policy instead: an addition that introduces a method code or a lab reference is pack-class, because an over-generous alias opens a gate silently; a removal is a normal PR, because an over-strict registry over-states a shortfall loudly and recoverably. Rev 1 had this exactly backwards and §13 contradicted it three sections later. Snapshots record the numbers, not the vocabulary, and are never rewritten.

**D-F1j — `predicates.ts` `testMatchesItem` is left alone in F1, and §19 is the slice that changes it.** -> §17.1, §19 `[F1C-B5]`. It has the same class of defect, and it drives a _shipped_ conformance gate for every tenant in every state including those with no pack. Fixing it is strictly a loosening — lots that cannot conform today would become conformable — and that is a product decision with a blast radius, not a bug fix riding along `[C1C-18]`. **Rev 2 changes the framing:** deferring it is no longer free, because F1.2 manufactures a visible divergence. The price of deferral is §8.4's copy and §19's existence, both of which are F1 obligations.

**D-F1k — "Unknown" and "lab reference" are different resolutions.** -> §4.3.2, §4.4, §5.3 `[C1C-19]` `[F1C-B2]`. Rev 1 encoded its safety argument as a set of _absences_ from a lookup table, and an absence has no semantics: the item limb could not tell "we deliberately excluded this" from "nobody has mapped this", so it attributed the excluded test anyway. Representing the exclusion explicitly costs one `Set`, one branch, and one assertion that the sentinel is not a category — and it is the difference between an argument and a mechanism. Rejected alternative: keep the exclusions implicit and downgrade J2's claim to "the unlinked path only" — which is what Rev 1 actually shipped, and it would have removed the safety argument §13 and §15 rest on.

---

## 17. Known ceilings and adjacent defects deliberately not fixed

### 17.1 `predicates.ts` `testMatchesItem` — the same defect, a different blast radius

`predicates.ts:231-237` answers "does this test satisfy this required ITP item?" with `itpChecklistItemId` equality **or** raw normalized `testType` equality. The second limb has the identical vocabulary problem: a manually typed `Density Ratio` does not satisfy an item typed `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00`.

**Its behaviour is not changed here.** Routing it through categories would be strictly a **loosening** — where both sides resolve to the same category the match becomes true; where either is unknown it falls back to today's equality and nothing changes. Loosening a shipped conformance gate changes who can conform a lot **on every project in every state, including the ones with no sufficiency pack at all**, and needs its own corpus diff, its own evidence and its own decision. That is **§19**.

**Two things about this file _are_ changed in F1.2** `[F1C-C2]` `[F1C-R9]`:

- The docstring at `:222-230` is **wrong on both of its claims**. It says the function "Mirrors `conformancePrerequisites.ts:261-270` `testResultMatchesItem` (not exported there — F0.1 must not modify that file, so the logic is re-stated here; F0.2 unifies to a single source)." There is no `testResultMatchesItem` anywhere in that file; `:259-270` is `getNaHoldPointSignoffItemIds`; and the unification already happened — `conformancePrerequisites.ts:3` imports this very function and calls it at `:290`, `:313`, `:320`. F1.2 corrects it.
- **The warning lands in the code, not only in this document.** A future agent reads the docstring, not §17.1. F1.2 adds, at `predicates.ts`:

  ```
  // WARNING: this matcher and the sufficiency attribution rule
  // (sufficiency/testCategories.ts `candidateCategories`) are DELIBERATELY
  // different as of F1. This one gates conformance for every tenant in every
  // state, including projects with no sufficiency pack; that one only counts
  // within a resolved pack. Do NOT "unify" them because they look alike —
  // unifying LOOSENS a shipped gate. See docs/plans/
  // test-type-canonicalization-spec-2026-07-27.md §19.
  ```

### 17.2 The description-into-testType leak

`CreateTestModal.tsx:173` writes an ITP item's free-text **description** into `test_results.test_type` when the picked item has no test type (§8.3). Blast radius today is **zero over every shipped seed item**, held there by a predicate in `useLotItpTestItems.ts:14-15` that nobody wrote for this purpose; AT-61 pins it at zero. A data-quality item for whoever next touches that modal.

### 17.3 The modal option list is paired by citation, not by import

AT-28 copies the datalist literals into a backend test with a `file:line` citation, and the modal carries a reciprocal comment. There is no shared package between `frontend/` and `backend/`, and building one for seven strings is not warranted. **Drift is bounded and one-directional** — a new datalist option that nobody aliases is unknown, which is the safe state. The seed fixture (AT-58) gets the stronger treatment because it _can_: the seeders are files on the backend's own disk, so the test reads them rather than trusting a copy.

### 17.4 The slash asymmetry `[F1C-R4]`

`Field Density Nuclear / Sand` resolves to `compaction`; `field density nuclear/sand` resolves to `null`. Same intent, different whitespace, different count. This follows directly from §4.3.1's decision not to touch `/`, which is what keeps `tmr q141a/b` and `as/nzs 2891.2.2` intact — the asymmetry is the price of that, and it is the cheap direction (an unrecognised string under-counts and is visible in the advisory). AT-23 pins both halves. **Flip condition:** the classifier reports an unspaced compound in production, at which point the whole string is added as an entry.

### 17.5 The union rule's safety net is inert at F1 `[F1C-R10]`

§4.3.2's conflict rule is what keeps "any token matches" honest, and D-F1g concedes that in F1 only one category exists, so a cross-category union cannot arise. **That is exactly the ceiling:** with one category, no conflict can ever fire, so a mixed-method item silently resolves to `compaction`. Shipped VIC seeds already contain these — `RC 316.00 / AS 1289 (grading, PI)` (`vic-drainage.js:113`), `RC 316.00 / Survey` (`:317`), `RC 316.00 / AS 2891.14.5 / RC 500.05` (`vic-asphalt.js:923`) — and all three resolve `compaction` today. Combined with the item limb, a _grading_ test linked to a grading-and-density item counts toward the six required density tests, and §4.4's exclusion does not close that (a grading test's own type is **unknown**, not a lab reference, so the item limb applies).

**Why it is accepted rather than fixed:** the exposure is bounded by rule scope. `vicroads-204.v1/compaction-density` applies only to `activitySlugs: ['earthworks_general', 'earthworks_subgrade_prep']` (`vicroads-204.v1.ts:106-108`), and all three of those strings live in drainage and asphalt seeds. Reaching the false count requires a drainage or asphalt template assigned to an **earthworks** lot, plus a non-density test linked to that item. Closing it properly means shipping the `grading` and `asphalt_density` aliases so the conflict rule can fire, which D-F1d rules out until a rule references them.

**AT-59 pins the current behaviour**, so the PR that ships a second category sees this as a failing assertion and must decide deliberately rather than inherit silently. **Flip condition:** the second category.

### 17.6 Free text remains free text

Nothing constrains what anyone types, what the AI extractor returns (`testResultMapping.ts:63`, including its literal `'Certificate Review Required'` fallback), what a filename infers (`certificateExtraction.ts:75-79`), or what a spreadsheet import carries (`itpTemplateImportExecutor.ts:173`). That is by design: constraining entry is a much larger product change, and read-time derivation degrades honestly without it. The remainder is visible in the classifier report (§7) and in the per-lot advisory (§8.2).

---

## 18. Required follow-up amendments to the C1 spec

To be made by whoever amends `docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md`. **This PR does not edit that document.** D14 §18 filed its own list against the same file; these are additional.

| Section                                      | Amendment                                                                                                                                                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §4.1 table, row "Test attribution to a rule" | Replace "reuses the shipped matcher, no second match rule" with the §4.4 category rule here. There **is** now a second match rule, deliberately, and §17.1 and §19 say why `[C1C-15]` `[C1C-18]`.     |
| §4.1 closing sentence                        | Replace both `normalize(...)` limbs with the resolved-category rule, **including that the item limb is conditional on the test's own resolution** `[C1C-16]` `[C1C-19]`.                              |
| §3.2 `FrequencyRule.testType` comment        | "Test-type key from `routes/testResults/specifications.ts`" is now CI-enforced (§4.1 AT-22), not aspirational `[C1C-17]`.                                                                             |
| §4.x regime                                  | Note that `streamEntryConforming` is a **second consumer** of the attribution rule and must route through the shared helper `[C1C-20]`.                                                               |
| §7.2 known ceilings                          | Add: free-text test types are resolved by an alias registry; unmapped values attribute to nothing and surface through `tests_unlinked_to_itp_item`; laboratory references are excluded on both limbs. |
| §14                                          | Note that AT-22 … AT-33 and AT-56 … AT-62 are claimed by this slice and AT-34 … AT-55 by D14.                                                                                                         |

---

## 19. F1.3 — gate-matcher alignment (the named follow-up slice) `[F1C-B5]` `[F1C-R9]`

**This section is the specification of the follow-up, not a note that one is needed.** J3 accepts a temporary divergence between the sufficiency count and the conformance gate on the condition that this slice exists, is filed before F1.2 merges (exit item 15), and is held to the requirements below. It is deliberately **not** part of F1: it is the change with the blast radius, and it must be reviewed as such.

### 19.1 What it does

Route `predicates.ts:231-237` `testMatchesItem`'s second limb through `resolveTestCategory`, so that a test and an ITP item whose types resolve to the **same category** match — closing the divergence §8.4 papers over with copy. `itpChecklistItemId` equality stays the strongest limb and is untouched.

### 19.2 The blast radius, stated before anything else

This is the reason it is a separate slice, and every reviewer must read it first:

- `testMatchesItem` is imported by `conformancePrerequisites.ts:3` and called at `:290` (`hasVerifiedPassingTestForItem`), `:313` and `:320` (`buildOutstandingTestItems`). Those feed `prerequisites.hasPassingTest` (`:534-536`), the blocking reason at `:577`, and every `outstandingTestItems` state at `:317-323`.
- It runs on **every lot on every project in every state**, including projects with **no sufficiency pack at all** and companies that have never heard of VicRoads. F1's entire safety argument is AT-31 — _nothing outside a resolved pack moves_. **This slice deliberately destroys that argument**, and cannot borrow it.
- The change is strictly a **loosening**: where both sides resolve to the same category, a lot that cannot be conformed today becomes conformable. There is no direction in which it makes a gate stricter. A wrong alias here does not under-count a warning; it lets a lot through.
- It also changes `outstandingTestItems` states, so the on-screen list of what is outstanding moves for lots whose conformance verdict does **not** move.

### 19.3 Requirements — characterization

1. **A characterization corpus diff is mandatory and is the primary deliverable.** `readiness/characterization/seedCorpus.ts` must first gain rows that exercise the loosening: at minimum a lot on a project resolving **no** ruleset, with a verified passing test typed `Density Ratio` and a required item typed `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00`, unlinked. Under F1 that lot cannot conform; under this slice it can. **If the corpus diff is empty, the slice has not been tested** — this is `[F1C-B7]`'s lesson applied ahead of time.
2. **Every moved lot is enumerated in the PR body**, grouped by whether its project resolves a ruleset, with the count of lots whose `canConform` flips `false -> true` stated as a number.
3. `predicates.parity.test.ts` and `lotConformanceDecision.db.test.ts` must be **expected to change**, and their diffs reviewed line by line rather than regenerated.
4. A DB test asserts the three `outstandingTestItems` transitions: `unmatched_result_exists -> ` (item satisfied), `no_result -> awaiting_verification`, and no state moves for a test whose category is unknown.
5. The §8.4 copy is **reverted in the same PR** — `LotReadinessPanel.tsx:18` returns to a state description rather than an instruction, because the instruction is no longer the user's next action. AT-62 changes with it, which is exactly why AT-62 exists.

### 19.4 Requirements — review

1. **Pack-class review (§9) applies to the slice itself**, not only to any alias it adds: a named reviewer, the enumerated moved-lot list from 19.3(2), and an explicit statement of who can now conform a lot who could not before.
2. **Jay signs off the loosening**, separately from J2. J2 was a domain call about _which tests count_; this is a product call about _who can close a lot_.
3. **It must not land while any project is in `block` mode** unless the enumerated list is empty for that project — a loosening under an enforcing gate is the one combination with no safe failure direction.
4. The warning comment F1.2 lands at `predicates.ts` (§17.1) is **removed in this PR**, and its removal is the marker that the two matchers have converged deliberately rather than by drift.

### 19.5 Not in scope for F1.3

The registry itself. F1.3 changes _which matcher consumes_ the categories, never _what resolves to what_ — an alias change riding along inside a gate-loosening PR is exactly the combination §4.5 exists to prevent. If F1.3 needs a new alias, that alias ships in its own PR first, under §4.5's policy for its kind.

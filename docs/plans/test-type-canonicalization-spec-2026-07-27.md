# F1 Execution Specification — canonical test categories, so real density tests actually count

**Date:** 27 July 2026 · **Rev 1** · **Status:** implementation-ready pending the Jay decisions in §16.0.
**Parent spec:** `docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md` (Rev 2.1). This document fixes that spec's **§4.1 attribution rule**, which is the top finding of the 2026-07-27 external review.
**Sibling spec:** `docs/plans/d14-q6-pack-spec-2026-07-27.md` (Rev 1). §10 states the exact interaction; the two slices share one alias registry and must not fork it.
**Source finding:** `civos-wave-c1-review-2026-07-27.md` **F1 — HIGH**, and its "Suggested acceptance gate before block mode" items 1 and 2.

**Shipped code read in this worktree at `7a6ed14e` (= `origin/master`).** Every `file:line` below was opened, not remembered.
**Production inventory read read-only on 2026-07-27** and reproduced verbatim in §5.1. It is the evidence base for every alias entry; no alias in this document exists without a cited source string.

**House style** matches the C1 and D14 specs: numbered sections, PR slicing, a decision register split into Jay's calls and the spec's own, named acceptance tests, per-phase rollback, an exit gate.

**Ponytail note.** The laziest correct version of F1 is **no column, no migration, no backfill, and no change to any of the 24 write paths that author a test type** (§2.3). One leaf module, one lookup, one line changed in the evaluator. The reason that is also the _correct_ version — not merely the cheap one — is §6: the same string is denormalized into `itp_instances.template_snapshot` JSON at nine sites, so a stored column would require rewriting every snapshot blob in the same migration, and the one backfill this wave already shipped has a stale-read overwrite race (review F6). We do not write; therefore we cannot race.

---

## 0. What this slice is, and the amendment tags it introduces

C1.1 shipped an engine that asks "how many `compaction` tests does this lot have?" and answers by comparing the rule's key to the test's free-text type with `trim().toLowerCase()` equality (`counts.ts:13-33`). Nothing in the product writes the string `compaction` except a handful of legacy rows. The shipped VIC earthworks ITP writes six different AS/RC method strings; the Create Test modal offers seven Title-Case density names; the AI certificate extractor writes whatever the model returned. So a lot with six verified passing density tests reads **0 of 6** — a false shortfall in `warn`, a false block in `block`.

This slice introduces **one canonical test-category key**, resolved from the messy strings at read time by a versioned alias registry, and points the engine at categories instead of raw text. Nothing about the confirmed VicRoads pack changes.

### 0.1 Amendment tags introduced here

These continue the C1 spec's `[C1C-*]` series (which D14 ran to `[C1C-14]`). §18 lists them as **required follow-up edits to the C1 spec** — **this PR does not edit the C1 spec.**

| Tag        | Amendment                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[C1C-15]` | §4.1's table row "**Test attribution to a rule** … `predicates.ts:202-208` `testMatchesItem` + direct `TestResult.testType` equality — **none** — reuses the shipped matcher, no second match rule" is **the defect**. Raw-string equality is not an attribution rule; it is a coincidence that holds only for synthetic fixtures. §4 of this document replaces it. |
| `[C1C-16]` | §4.1's closing sentence "A test counts toward rule R iff `testPassing(t)` **and** (`t.itpChecklistItemId` links an item whose `testType` normalizes to `R.testType`, **or** `normalize(t.testType) === R.testType`)" is superseded by §4.4 here: both limbs compare **resolved categories**, never raw strings.                                                     |
| `[C1C-17]` | §3.2's `FrequencyRule.testType` doc comment ("Test-type key from `routes/testResults/specifications.ts`") was **correct as intent and unenforced in fact**. §4.1 here makes it a CI-asserted contract. The shipped `vicroads-204.v1` value `'compaction'` was right all along — the resolver was wrong, not the pack.                                               |
| `[C1C-18]` | §2.4 and §7.2's implicit assumption that `predicates.ts` `testMatchesItem` and the sufficiency attribution rule are "the same matcher" is withdrawn. They are now deliberately **different** matchers with different risk profiles, and §17.1 states why unifying them is out of scope and must not be done casually.                                               |

---

## 1. Outcome, scope and non-goals

**Outcome.** A VIC earthworks lot with six verified passing tests entered as "Density Ratio", or six tests linked to the shipped VicRoads earthworks ITP item `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00`, reads **6 of 6 — met**, citing clause 204.13(a). A lot with six _laboratory MDD_ tests still reads 0 of 6, because those are not the tests the clause asks for (§5.3). A lot whose test types nobody has ever mapped reads 0 of 6 **and** says so, through the advisory that already exists (§8.2) — it never guesses.

**Included:**

- **One leaf module** — `backend/src/lib/readiness/sufficiency/testCategories.ts` (§4): the canonical key type, the alias registry, and a pure resolver.
- **A token-exact resolution rule** (§4.3) — explicitly **not** substring matching, with a worked non-match proof (§4.3.3).
- **Twelve alias entries**, every one traced to a production row or a shipped file (§5.2), and **six deliberate non-entries** with reasons (§5.3).
- **Two lines changed in the engine** (§4.4) — `counts.ts` `testAttributesToRule` compares categories; `evaluate.ts` resolves them once per lot before `rules.map(...)`.
- **Real-vocabulary integration fixtures** (§14 AT-27, AT-28) — the deliverable that makes this trustworthy, not the registry file.
- **A read-only production classifier script** (§7) that reports alias coverage without writing anything.

**Non-goals — explicitly not built here:**

- **No schema change, no migration, no backfill, no data rewrite** (§6). Nothing this slice does can lose or corrupt a row.
- **No change to any write path.** All 24 surfaces that author a test type (§2.3) are untouched, including the AI certificate extractor, the ITP spreadsheet importer, the 40 seeders and the template-snapshot JSON.
- **No change to the Create Test modal's control** (§8). Free text plus datalist stays; the category is derived server-side.
- **No pack content change** (§9). `vicroads-204.v1` ships byte-identical; no re-confirmation, no `.v2`, no provenance story to tell.
- **No change to `predicates.ts` `testMatchesItem`** (§17.1). It has the same class of defect and fixing it _loosens a shipped conformance gate for every tenant in every state_, including those with no pack at all. That needs its own slice and its own evidence.
- **No substring matching, no fuzzy matching, no similarity scoring, no AI classification.** An unmapped value is uncategorized. Uncategorized attributes to nothing.
- **No new `UnknownCause`, no new reason code.** Both vocabularies are closed and contract-tested (`contracts/reasonCodes.ts:24-28`, `:74-78`); §8.2 shows the shipped codes already carry this honestly.

---

## 2. Current-state map (read at `7a6ed14e`)

### 2.1 The attribution path, exactly

```
evaluate.ts:133-135   attributed = tests.filter(t => testAttributesToRule(rule.testType, candidateTestTypes(t, itemTestTypes)))
evaluate.ts:61-67     candidateTestTypes(t) = [t.testType, itemTestTypes.get(t.itpChecklistItemId)]
evaluate.ts:57-59     itemTestTypeIndex(items) = Map<item.id, item.testType ?? null>
counts.ts:26-33       testAttributesToRule = candidates.some(c => normalizeTestTypeKey(c) === normalizeTestTypeKey(ruleTestType))
counts.ts:13-15       normalizeTestTypeKey = (value || '').trim().toLowerCase()
```

Two limbs — the test's own type, and the linked checklist item's type — and both terminate in the same `trim().toLowerCase()` equality against `rule.testType`.

The two call paths carry the item link differently (`counts.ts:22-24`): the lot path passes a checklist-item array, the regime path a nested `itpChecklistItem` select (`prismaStream.ts`, `regime.ts:164-172`). **Both** funnel through `candidateTestTypes`, so a fix at that seam fixes both — this is the root-cause seam, not a symptom site.

### 2.2 What the rule asks for versus what exists

`rulesets/vicroads-204.v1.ts:101-109` — `testType: 'compaction'`, `minCountByScale: { A: 6, B: 6, C: 3 }`.

`types.ts:94-95` already declares the intent: _"Test-type key from `routes/testResults/specifications.ts`."_ `compaction` **is** a key of `testTypeSpecifications` (`specifications.ts:23`). The pack is correct. Nothing enforces the claim, and nothing resolves anything else to that key `[C1C-17]`.

### 2.3 The write surfaces — 24 of them, three vocabularies, one column

**Schema.** `schema.prisma:853` `TestResult.testType String @map("test_type")` — **NOT NULL**, not indexed, no default, no constraint. `schema.prisma:674` `ITPChecklistItem.testType String? @map("test_type")` — nullable, not indexed. Length caps only: 160 chars (`routes/testResults/validation.ts:17`), 100 chars (`routes/itp/templateValidation.ts:35`).

**`test_results.test_type` writers:** `testResults/crudRoutes.ts:118,178` (manual POST — trim + length, no canonicalization); `testResults/corrections.ts:60-65` (the shared correction mapper, behind PUT, confirm-extraction and batch-confirm); `testResults/testResultMapping.ts:51-63` (**AI vision extraction — raw model output, falling back to the literal string `'Certificate Review Required'`**); `testResults/certificateIntake.ts:171,301` (single and batch certificate upload); `testResults/certificateExtraction.ts:75-79` (**testType inferred from the uploaded filename**); `projects/sampleProjectRoute.ts:229-233` (writes `'density_ratio'`, from `sampleProjectData.ts:203,217,229`); `readiness/characterization/seedCorpus.ts:246-251`.

**`itp_checklist_items.test_type` writers:** `itp/templates.ts:258` (admin builder), `:345` (clone, verbatim), `:415` (PUT — **destructive delete-and-recreate; item ids change**); `copilot/import/itpTemplateImportExecutor.ts:173` (**uncanonicalized spreadsheet text**, header aliases at `mappingProfiles.ts:163-170`, CivilPro columns at `:372,391`, and no `transform` entry unlike its siblings); `projects/sampleProjectRoute.ts:112`; `seedCorpus.ts:206-214`; and **40 global-library seeders** under `backend/scripts/seeds/itp-templates/`.

**Frontend authoring:** `pages/tests/components/CreateTestModal.tsx:22` (`z.string().trim().min(1)` is the _entire_ client validation), `:259-296` (the datalist — a suggestion, not a constraint), `:173` (**picking an ITP item with no `testType` writes the item's free-text `description` into the column**); `UploadCertificateModal.tsx:127`, `BatchUploadModal.tsx:148`; `itp/components/TemplateChecklistEditor.tsx:115-122` (a bare 28-char-wide text input, the only user authoring surface for item test types, with no datalist at all).

**Three vocabularies collide in one column.** Title Case with spaces (the modal datalist), snake*case (`frontend/src/pages/tests/constants.ts:131-160`, `sampleProjectData.ts:80`, and the existing backend spec lookup at `testResults/specificationRoutes.ts:29`, which normalizes with `toLowerCase().replace(/\s+/g,'*')`), and AS/RC/TMR method codes (the 40 seeders). **§4.3's normalizer treats `\_`and a space as the same character precisely because`specificationRoutes.ts:29` already established that equivalence in shipped code\*\* — this is a reuse, not an invention.

**There is no test-result CSV or Excel importer.** The only bulk test-result ingest is the multi-file certificate batch upload. The ITP _item_ importer is the copilot one above.

### 2.4 The snapshot denormalization — load-bearing for §6

A lot's ITP does **not** copy checklist-item rows. `ITPInstance` holds a JSON `templateSnapshot` and `TestResult.itpChecklistItemId` FKs the _template's_ item row directly. `templateSnapshot.ts:50-55` copies `testType` verbatim into that JSON, and nine sites write it: `itp/instances.ts:188-196`, `lots/createRoutes.ts:160-164` and `:413-417` (clone), `lots/bulkCreateCore.ts:222-228`, `projects/sampleProjectRoute.ts:121-136` (which hand-rolls the shape instead of calling `buildTemplateSnapshot`), `itp/templateLifecycleRoutes.ts:222-236,258-264` (propagate — `updateMany` across instances).

Those blobs are what the checklist UI, hold-point evidence, claims evidence **and `conformancePrerequisites.ts:105,347,646`** actually read. Any design that canonicalizes the _column_ must rewrite every blob in the same migration, or the engine reads stale raw values on exactly the lots that matter.

### 2.5 The tests that missed it

`counts.test.ts:57-63` and `routes/lots/testSufficiencyEntry.db.test.ts:306-345` build fixtures with the literal string `'compaction'`. They assert real arithmetic and would catch an operator error (the review's test-honesty table rates them Strong). They cannot catch a vocabulary mismatch, because they _are_ the mismatch — they invent a vocabulary the product never writes. §14 fixes this by deriving fixtures from shipped files rather than from imagination.

---

## 3. The defect, stated once

A lot on a VIC/`vicroads` project, activity `earthworks_general`, Scale A, with six `status: 'verified'` `passFail: 'pass'` tests:

| Test type as actually stored                | Source                                        | `normalizeTestTypeKey`  | `=== 'compaction'` |
| ------------------------------------------- | --------------------------------------------- | ----------------------- | ------------------ |
| `Density Ratio`                             | modal datalist `CreateTestModal.tsx:261`      | `density ratio`         | **no**             |
| `density_ratio`                             | prod (18 rows), `sampleProjectData.ts:80,203` | `density_ratio`         | **no**             |
| `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00` | shipped VIC seed (×3)                         | same, lowered           | **no**             |
| `Field Density Nuclear`                     | modal datalist                                | `field density nuclear` | **no**             |
| `compaction`                                | prod (25 legacy rows)                         | `compaction`            | yes                |

`passingCount = 0`, `requiredCount = 6`, `state = 'insufficient'` (`evaluate.ts:141-152`). In `warn` the user is told they are missing six tests they have already paid for and filed. In `block` the same user cannot conform the lot, and the only escape is an owner force-conformance that records a blocker the snapshot contract currently drops (review F5).

The direction matters: this defect **over-states** the requirement. That is the safe direction for a gate, and it is why the review's release call was "leave warn running". It is not the safe direction for trust — a compliance tool that cannot see the tests in front of it does not get a second chance with a quality manager.

---

## 4. The design

### 4.1 The canonical key namespace — reused, not invented

A canonical **test category** is a key of the shipped `testTypeSpecifications` map (`backend/src/routes/testResults/specifications.ts:22-127`): `compaction`, `cbr`, `moisture_content`, `plasticity_index`, `liquid_limit`, `grading`, `sand_equivalent`, `concrete_slump`, `concrete_strength`, `asphalt_density`, `asphalt_thickness`, `dcp`, `permeability`.

This is a **reuse of the vocabulary already in the tree**, for three reasons: `FrequencyRule.testType` already claims that map as its source (`types.ts:94-95`); the shipped pack's value `'compaction'` is already a key of it; and prod's 25 legacy `compaction` rows are already in that vocabulary. There is no new list of category names anywhere in this slice.

**Enforcement without an import.** Production code in `lib/` must not import from `routes/`, and moving the map is a bigger diff than the problem deserves. So the linkage is asserted in a **test**, which may import anything:

- every value the alias registry can produce is a key of `testTypeSpecifications`;
- every `rule.testType` across `SUFFICIENCY_RULESETS` is a key of `testTypeSpecifications`;
- every `rule.testType` across `SUFFICIENCY_RULESETS` has **at least one alias** resolving to it — a rule whose category nothing can ever resolve to is a silent zero-count rule, and that is this defect in a new hat.

(§14 AT-22.) The registry file itself declares its categories as plain strings and imports nothing.

### 4.2 The alias registry

`backend/src/lib/readiness/sufficiency/testCategories.ts` — a **leaf module**, importing types only, in the same directory and of the same species as `rulesets/`: shipped product data, reviewable in a PR diff, CI-testable, revertable by `git revert`. C1 §3.1 already made this argument for rulesets; it applies unchanged.

```ts
/** Canonical test category. A key of `testTypeSpecifications` — asserted in tests, not imported. */
export type TestCategory = string;

/**
 * Alias token -> canonical category. Keys are ALREADY NORMALIZED (§4.3.1): lower
 * case, `_` folded to space, whitespace collapsed. Every entry cites the string
 * it was observed in. ADDITIVE ONLY (§4.5) — entries are added, never repointed
 * or removed, without the pack-class review of §9.
 */
export const TEST_TYPE_ALIASES: Readonly<Record<string, TestCategory>> =
  Object.freeze({
    /* §5.2 */
  });
```

**One registry, not one per pack.** Rejected alternative recorded in §16.1 D-F1c: `dry density ratio` is authority-agnostic, company-authored ITP items are not pack-scoped, and per-pack tables would duplicate the same twelve entries across VIC, NSW and QLD and drift. Each entry carries an inline comment naming its authority and the file or prod count it came from, so per-pack provenance survives without per-pack files.

### 4.3 Resolution — token-exact, and why that is not substring matching

#### 4.3.1 Normalization

```
normalize(s) = s.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
```

Lower-case and trim are what `counts.ts:13-15` already does. `_ -> space` is the equivalence `testResults/specificationRoutes.ts:29` already established in shipped code (it maps the other way, space -> `_`, for the same reason). Whitespace collapse handles the double spaces that free-text entry produces. **Nothing else is touched** — not `-` (`agpt-t212`), not `/` (`tmr q141a/b`), not `.` (`as 1289.5.4.1`), not `:` (`ag:pt/t250`).

#### 4.3.2 Tokenization

A stored value yields a **token set**:

1. the whole normalized string;
2. the string with every parenthesised span removed (re-collapsed);
3. the contents of each parenthesised span;
4. each fragment of (2) split on the separator set: `,` · `;` · `or` · `/` (a slash **surrounded by spaces**).

Bare `/` is deliberately **not** a separator, so `tmr q141a/b` and `as/nzs 2891.2.2` survive intact. Empty tokens are dropped.

`resolveTestCategory(value)` looks up every token in `TEST_TYPE_ALIASES` and collects the distinct categories found:

- **exactly one** category -> that category;
- **zero** -> `null` (uncategorized);
- **two or more** -> `null`, plus a `conflict` flag the CI fixture asserts is never raised by a shipped seed string (§14 AT-24). A string naming two categories is ambiguous, and this engine does not resolve ambiguity by picking.

#### 4.3.3 Why this is not the banned substring match

The review rules out broad substring matching, and it is right to. Substring matching would false-positive: `as 1012.9 (compressive strength)` contains `1012.9`, and a substring rule keyed on `as 1012` would sweep concrete strength into whatever category it was written for.

Token-exact matching cannot do that. Worked non-match, with the real prod string:

```
"AS 1012.9 (Compressive Strength)"
  normalize        -> "as 1012.9 (compressive strength)"
  tokens           -> { "as 1012.9 (compressive strength)",
                        "as 1012.9",
                        "compressive strength" }
  lookups          -> none is a key of TEST_TYPE_ALIASES
  result           -> null (uncategorized) — attributes to nothing
```

And the matches it must make, with the real shipped strings:

```
"AS 1289.5.4.1 (Sand Replacement) or RC 316.00"      (vic-earthworks seed)
  tokens -> { whole, "as 1289.5.4.1 or rc 316.00", "sand replacement",
              "as 1289.5.4.1", "rc 316.00" }
  "as 1289.5.4.1" -> compaction ; "rc 316.00" -> compaction   => compaction

"TMR Q141a/b (Insitu Density), TMR Q142a (MDD)"      (prod itp_checklist_items, 5 rows)
  tokens -> { whole, "tmr q141a/b, tmr q142a", "insitu density", "mdd",
              "tmr q141a/b", "tmr q142a" }
  "tmr q141a/b" -> compaction ; "insitu density" -> compaction
  "tmr q142a" and "mdd" are NOT aliases (§5.3)                => compaction

"MDD Standard"                                        (modal datalist option)
  tokens -> { "mdd standard" }                                => null (§5.3)
```

The union rule ("any token matching a category yields it") is right for both string species: an ITP item naming several methods **requires** a test of each, and a certificate naming several methods **reports** one. In F1 only one category exists, so a cross-category union cannot arise; the conflict rule above is what keeps that true when the second category ships.

**Flip condition, recorded now.** If a token ever produces a wrong attribution in the field, drop to whole-string-only matching: delete the tokenizer, keep the registry, and add the observed whole strings as keys. The registry survives the downgrade unchanged. That is the escape hatch, and it costs one function.

### 4.4 Where it plugs in — inside `evaluate.ts`, before the rules loop

```ts
// counts.ts — the only change to this file
export function testAttributesToRule(
  ruleCategory: string | null,
  candidateCategories: readonly (string | null)[],
): boolean {
  if (!ruleCategory) return false;
  return candidateCategories.some((c) => c !== null && c === ruleCategory);
}
```

```ts
// evaluate.ts — resolved ONCE per lot, before rules.map(...)
const testCategories = new Map(
  input.tests.map((t) => [t.id, resolveTestCategory(t.testType)]),
);
const itemCategories = new Map(
  input.checklistItems.map((i) => [i.id, resolveTestCategory(i.testType)]),
);
// candidateTestTypes(...) becomes candidateCategories(test) =
//   [testCategories.get(test.id), test.itpChecklistItemId ? itemCategories.get(...) : null]
```

`rule.testType` is resolved through the same function, so a pack could in principle declare an alias as its key and still work — but §4.1's assertion requires it to be a canonical key, so in practice this is an identity lookup.

**Purity is preserved, and improved.** `resolveTestCategory` is deterministic over a frozen module-level object: no I/O, no clock, no randomness — the same species of pure lookup that `resolve.ts` already performs against `SUFFICIENCY_RULESETS`. The evaluator stays sync and DB-free, so the **M39 byte-identity guarantee between the single conform path and the batched claim path survives** (`conformancePrerequisites.ts:374-382`).

**Rejected alternative — widen `SufficiencyTestRow` with a pre-resolved `category`, filled by each caller.** Recorded in §16.1 D-F1b. It looks more "resolved before evaluate", and it is strictly worse: two call paths resolving independently is two chances to diverge, which is precisely the invariant M39 exists to protect. Resolving inside the evaluator makes byte-identity structural rather than tested.

### 4.5 The additive-only policy

The registry carries **no version field**. It is not a pack: it encodes no authority's numbers and makes no claim that could be wrong about a specification. It is an interpretation of _our users' own free text_, and it is governed by one policy instead of a version:

- **Adding** an alias is a normal PR. It can only increase attribution, i.e. move a lot from a false shortfall toward the truth.
- **Removing or repointing** an alias is a **pack-class change** — it can move a lot from `satisfied` to `insufficient`, which in `block` mode stops work. It needs the §9 review, and it must state which lots' verdicts change.

CI asserts additive-only mechanically is not worth building (a reviewer reading a diff sees a deletion). It is stated in the file header and in §15 exit item 6.

**Snapshot interaction.** C1.2 snapshots record the _numbers_ (`requiredCount`, `passingCount`), not the vocabulary. A later alias addition does not and must not rewrite a stored snapshot — a decision made on 2026-07-27 was made on the evidence visible on 2026-07-27, and that is the point of an immutable record. The deploy SHA already explains any historical number, and the registry is in git.

---

## 5. The alias content

### 5.1 The evidence base (read-only production query, 2026-07-27)

`test_results.test_type`, distinct: `compaction` (25) · `density_ratio` (18) · `dry density ratio` (1) · plus QA junk rows.

`itp_checklist_items.test_type`, distinct, top 30 by count: `as 1012.9` (24) · `survey` (16) · `as 1012.9 (compressive strength)` (15) · `level survey` (11) · `survey check` (9) · `as 1289.3.6.1` (9) · `density_ratio` (9) · `measurement` (8) · `as 1289.2.1.1` (8) · `as 2891.8` (8) · `q115 (ucs)` (7) · `as 2159` (7) · `as 5101.4` (7) · `cctv per wsa 05:2020` (6) · `field retroreflectivity (rl)` (6) · `as 1012.3.1` (5) · `rc 316.00` (5) · `austroads ag:pt/t250 (sand patch test)` (5) · `t198` (5) · `as 1379` (5) · `tp 320` (5) · `tmr q141a/b (insitu density), tmr q142a (mdd)` (5) · `survey measurement` (5) · `characteristic dry density ratio rc (per spec 201)` (5) · `as/nzs 2891.2.2 / agpt-t212` (5) · `as 1012.3.1 (slump)` (5) · `as 1289.5.4.1 or as 1289.5.7.1, rc 316.00` (4) · `austroads ag:pt/t251 (ball penetration test)` (4) · `rc 316.00 / rc 500.05` (4) · `tmr q115 (ucs)` (4).

**Shipped VIC earthworks seed** (`backend/scripts/seeds/itp-templates/seed-itp-templates-vic-earthworks.js`), distinct `testType` values — **six of them are the same compaction requirement written six ways**, in one file:

| Value                                                        | ×   | Compaction?                            |
| ------------------------------------------------------------ | --- | -------------------------------------- |
| `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00`                  | 3   | yes (`:206,215,224`)                   |
| `AS 1289.5.4.1, RC 316.00, RC 316.10`                        | 1   | yes (`:242`)                           |
| `AS 1289.5.4.1, RC 316.00`                                   | 1   | yes (`:331`)                           |
| `AS 1289.5.4.1 (Sand Replacement) or RC 316.00`              | 1   | yes (`:157`)                           |
| `AS 1289.5.4.1`                                              | 1   | yes (`:282`)                           |
| `RC 316.00`                                                  | 1   | yes (`:251`)                           |
| `AS 1289.2.1.1`                                              | 3   | no — moisture content (`:166,197,300`) |
| `AS 1289.6.1.1 (Soaked CBR), RC 324.01, RC 500.20`           | 1   | no — CBR (`:291`)                      |
| `AS 1289.3.6.1 (PI), AS 1289.6.1.1 (CBR)`                    | 1   | no (`:179`)                            |
| `AS 1289.3.1.1 (LL), AS 1289.3.3.1 (PL), AS 1289.3.6.1 (PI)` | 1   | no (`:50`)                             |

Six variants in one file is the argument for §4.3's token rule in a single line of evidence. Under whole-string matching that is six alias entries and a seventh the day someone reorders the codes; under token matching it is four method-code entries that cover every recombination.

**Create Test modal datalist**, `CreateTestModal.tsx:259-296`, Compaction/Density optgroup verbatim: `Density Ratio` · `Dry Density Ratio` · `Field Density Nuclear` · `Field Density Sand` · `MDD Standard` · `MDD Modified` · `Hilf Rapid`.

### 5.2 `compaction` — the twelve entries

Every row cites where the string was observed. This is the entire content of `TEST_TYPE_ALIASES` at F1.

| Alias key (normalized)                | Category     | Evidence                                                                                                                          |
| ------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `compaction`                          | `compaction` | prod `test_results` (25); identity with `specifications.ts:23`                                                                    |
| `density ratio`                       | `compaction` | prod `test_results` `density_ratio` (18) + `itp_checklist_items` (9); modal option `Density Ratio`; `sampleProjectData.ts:80,203` |
| `dry density ratio`                   | `compaction` | prod `test_results` (1); modal option `Dry Density Ratio`                                                                         |
| `characteristic dry density ratio rc` | `compaction` | prod item `characteristic dry density ratio rc (per spec 201)` (5) — the parenthetical becomes its own inert token                |
| `field density nuclear`               | `compaction` | modal option; the nuclear-gauge field density determination                                                                       |
| `field density sand`                  | `compaction` | modal option; sand-replacement field density determination                                                                        |
| `hilf rapid`                          | `compaction` | modal option; **AS 1289.5.7.1 is the Hilf density ratio rapid method** — a field compaction control test, not a lab reference     |
| `insitu density`                      | `compaction` | prod item `tmr q141a/b (insitu density), tmr q142a (mdd)` (5)                                                                     |
| `tmr q141a/b`                         | `compaction` | same prod item; TMR Q141A/B is the in-situ density method                                                                         |
| `as 1289.5.4.1`                       | `compaction` | VIC seed (5 of the 6 compaction strings); AS 1289.5.4.1 = compaction control test, dry density ratio                              |
| `as 1289.5.7.1`                       | `compaction` | VIC seed (`:206,215,224`); AS 1289.5.7.1 = Hilf density ratio, rapid method                                                       |
| `rc 316.00`                           | `compaction` | VIC seed (6 strings) + prod items `rc 316.00` (5) and `rc 316.00 / rc 500.05` (4); VicRoads code RC 316.00, compaction testing    |

Coverage check against §5.1: every compaction row in the prod inventory resolves, and all six VIC seed compaction strings resolve. `rc 316.00 / rc 500.05` resolves on its `rc 316.00` limb (`/` is a separator). `as 1289.5.4.1 or as 1289.5.7.1, rc 316.00` resolves three ways over.

### 5.3 Deliberately **not** aliased — the six, and why

These are the calls where getting it wrong invents a passing lot, so each is stated rather than left implicit.

| Value                                                             | Why not `compaction`                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mdd standard`, `mdd modified` (modal options)                    | **Laboratory reference tests** — AS 1289.5.1.1 / 5.2.1 determine the maximum dry density a field result is _expressed against_. Clause 204.13(a)'s six are field density-ratio determinations. Six MDD tests are not six compaction tests, and mapping them would let a lot with zero field tests read "6 of 6 — met". |
| `mdd`, `tmr q142a` (tokens of a prod item string)                 | Same. That item resolves on its `tmr q141a/b` / `insitu density` limbs, which is correct — it _does_ require an in-situ density test.                                                                                                                                                                                  |
| `as 1289.5.1.1` (`seed-itp-templates-austroads.js:108,136,145,…`) | Same — lab MDD. This is why the exclusion is not academic: an Austroads-templated lot would otherwise falsely satisfy.                                                                                                                                                                                                 |
| `rc 316.10` (VIC seed `:247`)                                     | VicRoads **test-site selection** procedure, not a test. Every string containing it also contains `rc 316.00`, so excluding it costs nothing.                                                                                                                                                                           |
| `rc 500.05` (prod item, VIC seed notes)                           | The **acceptance/assessment** procedure (characteristic value method), not a test method. Same — always co-occurs with `rc 316.00`.                                                                                                                                                                                    |
| everything else in §5.1                                           | No rule references any other category (§16.1 D-F1d). `as 1012.9`, `survey`, `as 1289.2.1.1`, `as 5101.4`, `q115 (ucs)`, `cctv per wsa 05:2020` etc. stay uncategorized until a rule needs them.                                                                                                                        |

**Failure direction of the exclusions.** If a lab reports a genuine field density result under a certificate typed `AS 1289.5.1.1`, that test stays uncounted and the lot over-reports its shortfall. That is the same conservative direction the engine takes everywhere else (`evaluate.ts:110-118`, "over-testing is the safe direction"), and it is visible: the test appears in the "not attributable to any rule" advisory (§8.2), which is exactly the prompt a quality manager needs. **This is the one domain judgement in F1 and it is escalated as §16.0 J2.**

---

## 6. Why there is no column, no migration and no backfill

The alternative design — a stored `test_category` column on both tables, populated on write and backfilled — was considered and rejected. Five reasons, in descending weight:

1. **The string is denormalized into JSON at nine sites (§2.4).** `itp_instances.template_snapshot` is what `conformancePrerequisites.ts:105,347,646` actually reads. A column migration must rewrite every blob in every instance in the same transaction, or the engine keeps reading stale raw values on exactly the lots under evaluation. That is a large, irreversible, hand-written JSON migration against production, to buy nothing.

2. **Aliases grow per authority; a column would need a re-backfill per pack.** The prod inventory already contains TMR Q-series and Austroads AG:PT strings. D14.3 lands NSW. Each new pack would ship a migration whose job is to re-derive a column that a lookup derives for free.

3. **This wave already shipped a backfill with a stale-read overwrite race** — review F6, `backfill-lot-activity-slug.ts:49-66`: plan in memory from a read, update by id alone, and a concurrent legitimate edit wins the read and loses the write. A canonicalization backfill has the identical shape and the identical race, against a column an editor can change at any moment through 24 write paths. **We do not write, so we cannot race.**

4. **Rollback becomes complete.** `git revert` restores the previous behaviour exactly, with zero stranded data. A backfilled column cannot be un-backfilled — the raw value is gone or, if kept alongside, you have shipped two sources of truth for the same fact.

5. **Every write path stays untouched** — including the AI vision extractor, the filename inferencer, the spreadsheet importer, the 40 seeders and the offline-created tests that post through the ordinary route. A write-time derivation would have to be added to each of them, and a value written while an alias was missing would stay wrong until the _next_ backfill.

**What replaces the backfill.** Nothing needs replacing — read-time derivation is retroactive by construction; the 25 `compaction` rows, the 18 `density_ratio` rows and the one `dry density ratio` row all start counting the moment F1.2 deploys. What _is_ still needed is proof that the registry actually covers production, and that is §7.

**Cost of the choice, stated.** The column would be queryable (`SELECT … WHERE test_category = 'compaction'`) and indexable. Nothing today wants that: sufficiency evaluates per lot over tests already fetched, and no reporting surface groups by category. If one ever does, the derivation is a pure function and a generated column or materialized view can be added then, from the same registry. **Flip condition:** a surface that needs to filter or aggregate across tenants by category.

---

## 7. The read-only production classifier

`backend/scripts/classify-test-types.ts` — **read-only, no `--execute` flag, no write path, ever.**

```
Reads   SELECT test_type, count(*) FROM test_results GROUP BY 1
        SELECT test_type, count(*) FROM itp_checklist_items GROUP BY 1
Reports for each distinct value: resolved category | null | conflict, and the row count.
Summary: rows resolved / rows uncategorized, and the top uncategorized values by count.
```

- **Host confirmation reuses the shipped pattern** from `backfill-lot-activity-slug.ts` — the script prints the target host and database name and requires an explicit `--confirm-db=<name>` matching it before connecting. Read-only makes this cheap insurance rather than a safety gate, and the pattern is already in the tree.
- **Idempotence is trivial** — it is a `SELECT`. Running it twice produces the same report.
- **It ships in F1.1 and its output is pasted into the F1.2 PR body.** It is how a reviewer knows the twelve entries are the right twelve, and how a future pack author sizes their alias work in one command.
- It logs values and counts. It logs **no tenant identifiers, no lot ids, no project names** — a test type is product vocabulary, not tenant content.

---

## 8. Entry surfaces — no change, and the surface that already exists

### 8.1 The Create Test modal is not touched

The control stays: an ITP-item picker when the lot has test-bearing items, free text with the datalist otherwise (`CreateTestModal.tsx:150-176,247-296`). The category is derived server-side and never entered.

The alternatives were considered and rejected (§16.1 D-F1e). A **category-first picker** ("choose Compaction, then describe the method") makes the field crew answer a question the engine can answer itself, on a mobile-adjacent surface, and it is wrong the moment a test does not fit a category. A **second "category" control beside the free text** doubles the input for a value with one correct answer. Both trade a real UX cost for a derivation we already have.

**One comment is added**, not a control: a `ponytail:`-style note at the datalist naming `testCategories.ts` so the next editor who adds an option knows where its alias lives. §14 AT-28 is the mechanical backstop.

### 8.2 The "these tests count toward nothing" advisory already ships

An uncategorized passing test is not silent. `evaluate.ts:222-227` collects `unlinkedPassingTestIds` — verified passing tests no resolved rule could attribute — and `:241` raises `tests_unlinked_to_itp_item`, which `evidenceReadiness/conformanceItems.ts:322-334` renders as a user-visible item with the related test ids attached. That is the honest surface the review asks for, and it shipped in C1.1.

**Expected effect of F1.2:** this advisory gets _smaller_, because tests that previously appeared unattributable now attribute. Values that remain uncategorized keep appearing there, which is the prompt to add an alias. No new reason code, no new item, no new panel.

### 8.3 The description leak is named, not fixed

`CreateTestModal.tsx:173`: picking an ITP item that has no `testType` writes the item's free-text **`description`** into `test_results.test_type` — sentence-length prose in a 160-char column. Under this design it is harmless (it resolves to `null`, and the test attributes through nothing because the item it links has no test type either — which is correct: that item required no test type). It is recorded in §17.2 as a data-quality item for whoever next touches that modal, and it is deliberately not fixed here.

---

## 9. Packs and provenance — nothing changes, and that is the point

`rulesets/vicroads-204.v1.ts` ships **byte-identical**. `testType: 'compaction'` was always the canonical category (`types.ts:94-95` `[C1C-17]`); the resolver was wrong, not the pack.

Therefore: **no re-confirmation pass, no `.v2`, no provenance story, no `revalidateBy` impact, no `evidenceGrade` impact**, and D14h's "edit `vicroads-204.v1` in place, with a pre-flight check" exemption is untouched because this slice does not edit it at all. The `registry.test.ts` currency assertions and AT-17's expired/non-A synthetic cases pass unchanged.

**The field keeps its name.** `FrequencyRule.testType` is not renamed to `category`. Renaming would touch the confirmed pack file, `RuleSufficiency.testType` — which is part of the verdict shape written into C1.2 snapshots — and every test in the wave, to buy a better word. C1 §5.4.2 says do not move the snapshot shape. The doc comment is sharpened to say "canonical test **category**"; the identifier stays (§16.1 D-F1a).

---

## 10. Interaction with D14 / the NSW pack

`docs/plans/d14-q6-pack-spec-2026-07-27.md` §5.2 encodes `tfnsw-q6.v1` with compaction rules keyed on the **same** `testType: 'compaction'`. So:

- **No fork.** D14.3 adds no second registry and no NSW-specific matcher. Its NSW method-code aliases (TfNSW T-series, and any Q6 strings the seeds carry) are added to `TEST_TYPE_ALIASES` **in the D14.3 PR**, with the same per-entry evidence citation.
- **Ordering.** F1.2 must land **before or with** D14.3. Shipping a confirmed NSW pack on top of raw-string attribution would ship the identical defect to a second state, and D14's exit gate item 12 ("a real NSW lot, readable by a quality manager without training") cannot be met while it counts zero. This is a hard ordering constraint, not a preference.
- **File contention, named per house style.** F1 owns `sufficiency/testCategories.ts` (new), `sufficiency/counts.ts` and the attribution seam of `sufficiency/evaluate.ts` (`:57-67`, `:133-136`). D14 owns `evaluate.ts`'s `figures`/band seam (`:118-145`) and `registry.ts`. **`evaluate.ts` is contended** and needs the single-owner window C1 §11 requires. The two edits do not overlap textually — F1 changes what is compared, D14 changes what is counted — but they must be sequenced, not merged blind.
- **The seed-derived fixture (AT-27) generalizes for free.** It is parameterized by seed module and expected classification, so D14.3 adds a row for the NSW seeds rather than a new test.

---

## 11. Phases and PR slicing

Two PRs, strictly ordered. Each is independently revertable; the first is provably behaviour-free, so the second's diff _is_ the behaviour change and can be reviewed as such.

### F1.1 — the registry and the classifier (S) · zero behaviour change by construction

- `sufficiency/testCategories.ts`: `normalize`, `tokenize`, `TEST_TYPE_ALIASES` (§5.2), `resolveTestCategory`.
- Its unit tests (AT-22 … AT-26).
- `scripts/classify-test-types.ts` (§7), run read-only against production, output pasted in the PR body.
- **Nothing imports the module yet.** Fallow will flag every export as unused — **expected-by-design, stated in the PR body**, the F0.1 / C1.0 / D14.1 precedent.
- **Exit:** every §5.1 compaction string resolves and every §5.3 exclusion does not, asserted in tests; the classifier's production report shows the uncategorized remainder and no conflicts; `npm test` green; corpus byte-identical.

### F1.2 — the engine switch (S) · the behaviour change, in twelve lines

- `counts.ts` `testAttributesToRule` compares categories (§4.4).
- `evaluate.ts` resolves both maps once per lot and passes categories (§4.4).
- **The real-vocabulary fixtures** (AT-27, AT-28) — the actual deliverable.
- `counts.test.ts:57-63` and `testSufficiencyEntry.db.test.ts:306-345` updated: their synthetic `'compaction'` fixtures stay (they still assert arithmetic) and gain real-vocabulary siblings. The synthetic ones are **not** deleted — they are the identity case.
- Characterization corpus regenerated; the diff reviewed and **accepted explicitly in the PR body**. Expected: only lots on VIC/`vicroads` projects whose tests now attribute — `passingCount` up, `state` `insufficient` -> `satisfied` where the tests exist, `unlinkedPassingTestIds` down. The sample project (`sampleProjectData.ts:80,203` — `density_ratio` on both the item and the tests) is a visible, intended example. **Any diff on a lot whose project resolves no pack is a bug, not an expected change.**
- **Exit:** the review's acceptance-gate items 1 and 2 both pass (§15).

**File ownership.** This slice owns `sufficiency/testCategories.ts`, `sufficiency/counts.ts`, and `sufficiency/evaluate.ts` lines `57-67` and `133-136`. **Contended:** `evaluate.ts` with D14 (§10). It touches **no** route, **no** schema, **no** frontend file except one comment in `CreateTestModal.tsx` (§8.1).

---

## 12. Scale and performance

Measured against the reference dataset (5,000 lots, 10,000 map features, 50 GB evidence, 10k-row registers).

| Target                                       | Budget                                                                                                                     | Method                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Additional queries per readiness call        | **0** — the registry is a frozen module constant; no table, no join, no fetch                                              | Query-count assertion, deterministic in CI (AT-33)                                  |
| Category resolution per lot                  | O(tests + items), ~6 string operations each, **p95 < 1 ms** at 50 tests/lot                                                | Resolution happens once per lot before `rules.map(...)`, not once per (rule × test) |
| Sufficiency evaluation on a VIC lot          | **p95 < 25 ms**, unchanged from C1 §12                                                                                     | Server-side timing                                                                  |
| Total `GET /api/lots/:id/readiness`          | **p95 < 400 ms**; must not regress > 10 % vs master                                                                        | Existing route benchmark                                                            |
| **Claim create at the 5,000-member ceiling** | **p95 < 3,000 ms** — the #1581 budget (`0d94beba`) `[C1C-14]`, last measured 2,964 ms. **This slice must not regress it.** | F0.5 maximum-size claim benchmark (AT-33)                                           |
| `claim_member` snapshot size                 | **≤ 1 KB**, unchanged — this slice adds no per-rule member data                                                            | C1 §5.4.3 assertion                                                                 |

**No memoization ships.** Tokenization is a handful of `split`/`replace` calls on strings under 160 characters, run once per test row. A module-level cache keyed on user-controlled strings is unbounded memory for an unmeasured win. `// ponytail: no cache — if the claim benchmark regresses, memoize with a bounded LRU keyed on the normalized string.` The benchmark in AT-33 is what would tell us.

---

## 13. Rollback and recovery

| Phase                  | Rollback                                                                                                                                                                         | Stranded?                                                                                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1.1**               | `git revert`. Removes dead code and a read-only script.                                                                                                                          | **No.** Nothing was written by anything.                                                                                                                       |
| **F1.2**               | `git revert`. Attribution returns to raw-string equality; counts return to today's (wrong) numbers, i.e. to the state the review already judged safe to leave running in `warn`. | **No.** No column, no backfill, no migration, no rewritten JSON — there is nothing to un-do. This completeness is the design's main practical dividend (§6.4). |
| **A single bad alias** | Delete the line and deploy. Affects future evaluations only.                                                                                                                     | If C1.2 snapshots have landed, past snapshots keep the number computed at the time — a true historical record of the decision as it was made (§4.5).           |

**Failure mode if the registry is wrong in the generous direction** (an alias maps something that is not a compaction test): a lot reads `satisfied` when it is not. In `warn` that is a missing warning; in `block` it is a gate that does not fire. This is why §5.3's exclusions are individually argued and escalated (§16.0 J2), and why §15 exit item 5 requires `block` mode to stay off until Jay signs off the exclusions.

**Failure mode if the registry is wrong in the conservative direction** (a real compaction test stays uncategorized): today's behaviour, plus the "not attributable" advisory naming the test. Recoverable by adding one line.

---

## 14. Acceptance tests

Continuing the C1 series (which ended at AT-21) in the range D14 left free; D14 owns AT-34 … AT-53. Every item is a real assertion in a real test file.

**The registry and the resolver (F1.1, pure):**

- **AT-22 — the namespace contract.** Every value `TEST_TYPE_ALIASES` can produce is a key of `testTypeSpecifications`; every `rule.testType` across `SUFFICIENCY_RULESETS` is a key of `testTypeSpecifications`; and every `rule.testType` has **at least one alias resolving to it**. The third assertion is the one that catches "a rule nothing can ever count toward" — this defect in a new hat.
- **AT-23 — normalization.** `Density Ratio`, `density_ratio`, `DENSITY  RATIO`, `density ratio` all resolve to `compaction`. `-`, `/`, `.` and `:` are **not** normalized away: `tmr q141a/b`, `as/nzs 2891.2.2`, `as 1289.5.4.1` and `ag:pt/t250` survive tokenization intact and are asserted individually.
- **AT-24 — tokenization and conflict.** Table-driven over §4.3.3's three worked examples plus every string in §5.1. Asserts the produced token set, the resolved category, and that **no shipped seed or prod string raises a conflict**. A synthetic string naming two categories resolves to `null`, never to either.
- **AT-25 — the non-match proof.** `AS 1012.9 (Compressive Strength)`, `AS 1289.2.1.1`, `AS 1289.3.6.1`, `survey`, `cctv per wsa 05:2020`, `q115 (ucs)` and `field retroreflectivity (rl)` all resolve to `null`. **The test's header states that substring matching is prohibited and that this test is the proof** — so a future agent tempted to "improve" the matcher sees the constraint at the failure site.
- **AT-26 — the exclusions.** `MDD Standard`, `MDD Modified`, `AS 1289.5.1.1`, `RC 316.10` and `RC 500.05` resolve to `null`, each with the §5.3 rationale in an inline comment. `TMR Q141a/b (Insitu Density), TMR Q142a (MDD)` resolves to `compaction` **on its Q141a/b limb**, proving the compound case is not solved by ignoring the string.

**Real vocabulary (F1.2, integration) — the deliverables:**

- **AT-27 — the seed-derived fixture.** The seeders **cannot be imported**: `seed-itp-templates-vic-earthworks.js` exports nothing and calls `withItpTemplateSeedLock(prisma, main)` at module scope, so importing it would open a database connection and start seeding. The fixture therefore **reads the file as text** and extracts every `testType: '…'` literal with one regex — no execution, no Prisma, no side effect — then asserts each distinct value against a checked-in expected map (`'compaction'` or `null`). The map is **exhaustive over the file**: an unlisted value fails the test, so **adding an item to the seed fails CI until it is classified**. This is the fixture that cannot drift from the shipped seed, which is the whole point — the ten distinct values and six compaction variants of §5.1 are exactly what a hand-copied list would have missed. Scoped to the VIC earthworks seed because `vicroads-204.v1` is the only pack; D14.3 adds the NSW seed files as extra rows (§10).
- **AT-28 — the modal-option fixture.** Every option in the Compaction/Density optgroup of `CreateTestModal.tsx:259-268` resolves to `compaction`, **except** `MDD Standard` and `MDD Modified`, which resolve to `null` per §5.3. The literal list is copied into the test with a citation to `CreateTestModal.tsx:259-268`; the modal carries a reciprocal comment (§8.1). Known ceiling: this pairing is by citation, not by import — §17.3.
- **AT-29 — the review's gate, end to end.** A VIC/`vicroads` `earthworks_general` Scale A lot with **six verified passing tests** reads **6 of 6, `satisfied`, `sufficiencyBlocks: false`**, run once per entry vocabulary: `Density Ratio`; `density_ratio`; tests linked to an ITP item typed `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00`; and the legacy `compaction`. Five verified passing tests reads **5 of 6, `insufficient`**, in all four. This is acceptance-gate items 1 and 2 as one table-driven DB test.
- **AT-30 — the MDD boundary, end to end.** The same lot with six passing `MDD Standard` tests reads **0 of 6, `insufficient`**, and the six tests appear in `unlinkedPassingTestIds` with `tests_unlinked_to_itp_item` raised. Both halves asserted: the count is not inflated, **and** the user is told why.

**No collateral change (F1.2):**

- **AT-31 — nothing outside a resolved pack moves.** A lot on a project resolving no ruleset produces a byte-identical readiness payload and a byte-identical `canConform` outcome before and after, at every mode — asserted through `predicates.parity.test.ts` and `lotConformanceDecision.db.test.ts`. `predicates.ts` `testMatchesItem` behaviour is unchanged everywhere (§17.1).
- **AT-32 — purity and byte-identity.** `evaluateSufficiency` remains sync and DB-free; the single conform path and the batched claim path produce byte-identical verdicts for the same lot with the new vocabulary — the M39 guarantee, re-asserted over the changed seam.
- **AT-33 — performance.** **Zero additional queries** per readiness call; claim create **p95 < 3,000 ms** at 5,000 members `[C1C-14]`; readiness p95 not regressed > 10 %.

---

## 15. Exit gate

1. **The review's acceptance-gate item 1 passes** — a test created from each shipped Victorian compaction ITP test type maps to the canonical rule and counts (AT-27, AT-29).
2. **The review's acceptance-gate item 2 passes** — actual UI choices, `Density Ratio` foremost, count correctly (AT-28, AT-29).
3. **No substring matching anywhere**, and the prohibition is asserted at the failure site rather than left in a document (AT-25).
4. **Unmapped stays uncategorized and visible** — the MDD case counts zero _and_ raises the advisory (AT-30).
5. **The §5.3 exclusions are confirmed by a person who tests soil for a living** — owner **Jay** (§16.0 J2). Required before any project is flipped to `block`; **not** required to ship F1.2 in `warn`.
6. **The additive-only policy is written in the registry's own header**, not only here (§4.5).
7. **The classifier's production report is in the F1.2 PR body**, with the uncategorized remainder and its row counts stated rather than summarized (§7).
8. **No pack file changed** — `git diff --stat` over `rulesets/` is empty across both PRs (§9).
9. **No schema change, no migration, no data write** — `git diff --stat` over `prisma/` is empty across both PRs (§6).
10. **Nothing outside a resolved pack moved** (AT-31), proven the three C1 ways: regenerated corpus with an explicitly accepted diff, `predicates.parity.test.ts`, `lotConformanceDecision.db.test.ts`.
11. **§12 budgets met**, including claim create p95 < 3,000 ms and zero additional queries (AT-33).
12. **F1.2 lands before or with D14.3** (§10), so the NSW pack never ships on raw-string attribution.
13. **The §18 C1-spec amendments are filed** as a follow-up issue or PR — not silently left stale.
14. **`npm run fallow:audit` verdict recorded in every PR body**, with F1.1's expected unused-export warnings called out as by-design.

---

## 16. Decisions

### 16.0 Jay decisions — the two that need a person

1. **J1 — Does F1.2 unblock `block` mode?** No, and it should not be read that way. F1 closes review findings 1 of 3; F2 (invalid `testScale` on single-lot write paths) and F3 (Section 173) remain, and both are independently sufficient to produce a wrong gate. Recommendation: **ship F1.1 and F1.2 into `warn` immediately** — they make the advisory honest, which is the whole value of `warn` — and keep `block` off until the review's full acceptance gate passes. This is the review's own recommended release decision, unchanged.

2. **J2 — Are laboratory MDD tests excluded from the per-lot count?** This is the one place F1 makes a domain call rather than a mechanical one. The engineering reading is clear: clause 204.13(a)'s six are field density-ratio determinations, and AS 1289.5.1.1 / 5.2.1 (`MDD Standard` / `MDD Modified`, `TMR Q142a`) are the laboratory reference the field result is expressed _against_. Mapping them would let a lot with zero field tests read "6 of 6 — met" — a wrong number in the dangerous direction. Recommendation: **ship the exclusion**, and have a lab or QA contact confirm it before any project is flipped to `block` (exit item 5). If they say the opposite, it is a two-line change and a corpus regeneration; the cost of being wrong the other way is a gate that does not fire.

### 16.1 The spec's own decisions

**D-F1a — The canonical key is a `testTypeSpecifications` key, and `FrequencyRule.testType` keeps its name.** -> §4.1, §9. The vocabulary already exists in the tree, the shipped pack already uses it, and `types.ts:94-95` already claims it — the claim just needed enforcing `[C1C-17]`. Renaming the field to `category` would touch the confirmed pack, the verdict shape that C1.2 snapshots serialize, and every test in the wave, to buy a better word. The doc comment is sharpened instead. Rejected alternative: a fresh `TestCategory` union declared from scratch — a second vocabulary beside the one the product already ships is how you get three.

**D-F1b — Resolution happens inside `evaluate.ts`, once per lot, not on the row shapes.** -> §4.4. Widening `SufficiencyTestRow` with a pre-resolved `category` reads more like "resolved before evaluate", and is worse: two call paths resolving independently is two chances to diverge, and M39 byte-identity is the invariant that protects. A frozen-object lookup is pure by every definition that matters (deterministic, no I/O) — the same species `resolve.ts` already performs against `SUFFICIENCY_RULESETS`. Resolving in one place makes byte-identity structural instead of tested. It also keeps all 24 write paths and both Prisma selects untouched.

**D-F1c — One alias registry, not one per pack.** -> §4.2. `dry density ratio` belongs to no authority; company-authored ITP items are not pack-scoped; and per-pack tables would duplicate the same twelve entries across VIC, NSW and QLD and then drift apart. Per-entry inline citations preserve authority provenance without per-authority files. D14.3 adds NSW entries to the same file in its own PR (§10).

**D-F1d — `compaction` is the only category with aliases at F1.** -> §5.3. Categories are load-bearing only where a rule references one, and exactly one rule exists (`vicroads-204.v1/compaction-density`; D14's Q6 rules key on the same category). Mapping `as 1012.9 -> concrete_strength` today would be four unexercised lines that nothing tests and nothing reads. **Flip condition:** a category gets its aliases in the PR that adds the rule referencing it — never before, never in a separate "vocabulary" PR.

**D-F1e — The Create Test modal is not changed.** -> §8.1. Free text plus datalist is the shipped UX and it is fine; the category is a derivation, not a user decision. A category-first picker asks the field crew to answer what the engine already knows and breaks on the first test that fits no category; a second category control doubles input for a value with one correct answer. One comment is added, and AT-28 is the mechanical backstop for the option list.

**D-F1f — Token-exact matching, not whole-string-only.** -> §4.3. One shipped seed file writes the same compaction requirement **six ways** (§5.1); whole-string matching means six entries today and a seventh the moment someone reorders the codes, across 40 seed files and 20 of them mentioning density. Token-exact collapses that to the method codes, which is what a civil engineer would say the vocabulary actually is. It is not the banned substring match, and AT-25 proves it at the failure site. **Flip condition:** one wrong field attribution and we delete the tokenizer, keep the registry, and add whole strings as keys — the downgrade costs one function and loses nothing.

**D-F1g — Union across tokens, conflict resolves to `null`.** -> §4.3.2. An ITP item naming several methods requires a test of each; a certificate naming several reports one. Both make "any token matches" correct. A string resolving to **two** categories is genuinely ambiguous, and this engine does not resolve ambiguity by picking — it declines, and the advisory says so.

**D-F1h — No column, no migration, no backfill.** -> §6. Five reasons, the decisive one being that the same string is denormalized into `itp_instances.template_snapshot` JSON at nine sites, so a column migration must rewrite every blob or leave the engine reading stale values on exactly the lots under evaluation. The wave's one existing backfill already has a stale-read race (review F6) whose shape a canonicalization backfill would reproduce exactly. **Flip condition:** a surface that must filter or aggregate by category across tenants.

**D-F1i — The registry has no version field.** -> §4.5. It encodes no authority's numbers, so it cannot be wrong about a specification the way a pack can. It is governed by an additive-only policy instead: adding is a normal PR, removing or repointing is a pack-class change. Snapshots record the numbers, not the vocabulary, and are never rewritten.

**D-F1j — `predicates.ts` `testMatchesItem` is deliberately left alone.** -> §17.1. It has the same class of defect, and it drives a _shipped_ conformance gate for every tenant in every state including those with no pack. Fixing it is strictly a loosening — lots that cannot conform today would become conformable — and that is a product decision with a blast radius, not a bug fix riding along `[C1C-18]`.

---

## 17. Known ceilings and adjacent defects deliberately not fixed

### 17.1 `predicates.ts` `testMatchesItem` — the same defect, a different blast radius

`predicates.ts:218-237` (mirrored at `conformancePrerequisites.ts:261-270`) answers "does this test satisfy this required ITP item?" with `itpChecklistItemId` equality **or** raw normalized `testType` equality. The second limb has the identical vocabulary problem: a manually typed `Density Ratio` does not satisfy an item typed `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00`.

**It is not fixed here.** Routing it through categories would be strictly a **loosening** — where both sides resolve to the same category the match becomes true; where either resolves to `null` it falls back to today's equality and nothing changes. Loosening a shipped conformance gate changes who can conform a lot **on every project in every state, including the ones with no sufficiency pack at all**, and would need its own corpus diff, its own evidence, and its own decision. F1's whole safety argument is that it touches nothing outside a resolved pack (AT-31); folding this in would destroy that argument.

**Warning to a future agent:** the two matchers are now deliberately different. Do **not** "unify" them because they look alike. Unifying is a product change, not a refactor.

### 17.2 The description-into-testType leak

`CreateTestModal.tsx:173` writes an ITP item's free-text **description** into `test_results.test_type` when the picked item has no test type (§8.3). Harmless under this design; a data-quality item for whoever next touches that modal.

### 17.3 The modal option list is paired by citation, not by import

AT-28 copies the datalist literals into a backend test with a file:line citation, and the modal carries a reciprocal comment. There is no shared package between `frontend/` and `backend/`, and building one for seven strings is not warranted. **Drift is bounded and one-directional** — a new datalist option that nobody aliases is uncategorized, which is the safe state. The seed fixture (AT-27) gets the stronger treatment because it _can_: the seeder is a file on the backend's own disk, so the test reads it rather than trusting a copy.

### 17.4 Free text remains free text

Nothing constrains what anyone types, what the AI extractor returns (`testResultMapping.ts:63`, including its literal `'Certificate Review Required'` fallback), what a filename infers (`certificateExtraction.ts:75-79`), or what a spreadsheet import carries (`itpTemplateImportExecutor.ts:173`). That is by design: constraining entry is a much larger product change, and read-time derivation degrades honestly without it. The remainder is visible in the classifier report (§7) and in the per-lot advisory (§8.2).

---

## 18. Required follow-up amendments to the C1 spec

To be made by whoever amends `docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md`. **This PR does not edit that document.** D14 §18 filed its own list against the same file; these are additional.

| Section                                      | Amendment                                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| §4.1 table, row "Test attribution to a rule" | Replace "reuses the shipped matcher, no second match rule" with the §4.4 category rule here. There **is** now a second match rule, deliberately, and §17.1 says why `[C1C-15]` `[C1C-18]`. |
| §4.1 closing sentence                        | Replace both `normalize(...)` limbs with resolved-category comparison `[C1C-16]`.                                                                                                          |
| §3.2 `FrequencyRule.testType` comment        | "Test-type key from `routes/testResults/specifications.ts`" is now CI-enforced (§4.1 AT-22), not aspirational `[C1C-17]`.                                                                  |
| §7.2 known ceilings                          | Add: free-text test types are resolved by an additive alias registry; unmapped values attribute to nothing and surface through `tests_unlinked_to_itp_item`.                               |
| §14                                          | Note that AT-22 … AT-33 are claimed by this slice and AT-34 … AT-53 by D14.                                                                                                                |

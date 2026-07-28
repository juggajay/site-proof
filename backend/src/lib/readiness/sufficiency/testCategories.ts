// Wave F1 — canonical test categories (spec
// `docs/plans/test-type-canonicalization-spec-2026-07-27.md`, Rev 2).
//
// A LEAF module: it imports NOTHING. Same species as `rulesets/` — shipped
// product data, reviewable in a PR diff, CI-testable, revertable by `git revert`.
//
// WHY IT EXISTS. `test_results.test_type` and `itp_checklist_items.test_type`
// are free text written by three colliding vocabularies (§2.3): Title Case from
// the Create Test modal datalist, snake_case from the sample project and the
// spec lookups, and AS/RC/TMR method codes from the 40 global seeders. The
// sufficiency engine compared those raw strings against a pack's
// `testType: 'compaction'` and therefore counted almost nothing (§3). This module
// derives the category at READ time — no column, no migration, no backfill (§6).
//
// F1.1 ships this with NO call site. The engine switch is F1.2.

/**
 * Canonical test category. A key of `routes/testResults/specifications.ts`
 * `testTypeSpecifications` — asserted in tests (AT-22), not imported, because
 * production code in `lib/` must not import from `routes/` (§4.1).
 */
export type TestCategory = string;

/**
 * A token we have deliberately mapped to "known, and NOT a countable field
 * test" — distinct from `null`, which means "nobody has mapped this string".
 * The distinction is load-bearing: {@link candidateCategories}'s item limb is
 * suppressed for the first and consulted for the second [C1C-19] [F1C-B2].
 */
export const LAB_REFERENCE = 'lab_reference' as const;

export type Resolution = TestCategory | typeof LAB_REFERENCE | null;

/**
 * Alias token -> canonical category. Keys are ALREADY NORMALIZED (§4.3.1): lower
 * case, `_` folded to space, whitespace collapsed. Every entry cites the string
 * it was observed in — no alias exists in this table without a source.
 *
 * GOVERNANCE (§4.5), and it is NOT "additive is cheap" [F1C-B3]:
 *   - ADDING an entry that introduces a METHOD CODE (`as …`, `rc …`, `tmr q…`,
 *     a clause or section reference) or a LAB REFERENCE is a PACK-CLASS change
 *     and needs the §9 review, stating which lots' verdicts change. An
 *     over-generous alias opens a gate silently — nobody sees a symptom.
 *   - ADDING a plainly descriptive alias with no method code is a normal PR.
 *   - REMOVING or repointing an entry is a NORMAL PR. It can only over-state a
 *     shortfall, which is loud, visible on the lot's own screen, and one line to
 *     recover.
 *
 * SCOPE (§5.4, D-F1d): an alias ships only for a string a lot under a RESOLVED
 * pack can actually carry from a shipped seed. TWO pack families resolve today:
 * `vicroads-204` (VIC, `.v2` since D14.2, `earthworks_general` /
 * `earthworks_subgrade_prep`) and `tfnsw-q6.v1` (NSW, D14.3/D14.5 — those same
 * two earthworks slugs plus `pavement_unbound` / `pavement_bound` /
 * `pavement_stabilisation`). The QLD/SA/WA "Compaction testing"-family phrasings
 * of §5.4 stay deliberately absent — they count toward nothing today whatever
 * they resolve to.
 *
 * THE TfNSW ROWS BELOW ARE THE F1 HALF D14.3 DID NOT SHIP. `tfnsw-q6.v1` went
 * out `status: 'confirmed'` carrying no alias of its own, so every shipped NSW
 * seed compaction string tokenised to nothing and every NSW compaction test
 * counted ZERO — `insufficient` on a correctly-tested lot, and in `block` mode
 * an unclearable gate (`docs/reviews/fable-deep-review-2026-07-28.md` H2). The
 * NSW rows of `testCategoriesSeedSweep.test.ts` are what makes the next
 * occurrence fail CI instead of a lot screen.
 */
export const TEST_TYPE_ALIASES: Readonly<Record<string, TestCategory>> = Object.freeze({
  // --- descriptive, authority-agnostic -------------------------------------
  /** prod `test_results` (25 rows); identity with `specifications.ts:23`. */
  compaction: 'compaction',
  /** prod `test_results` `density_ratio` (18) + `itp_checklist_items` (9); modal option `CreateTestModal.tsx:261`; `sampleProjectData.ts:80,217,229`. */
  'density ratio': 'compaction',
  /** prod `test_results` (1 row); modal option `CreateTestModal.tsx:262`. */
  'dry density ratio': 'compaction',
  /** prod item `characteristic dry density ratio rc (per spec 201)` (5) — the parenthetical becomes its own inert token. */
  'characteristic dry density ratio rc': 'compaction',
  /** modal option `CreateTestModal.tsx:263`; the nuclear-gauge FIELD density determination. */
  'field density nuclear': 'compaction',
  /** modal option `CreateTestModal.tsx:264`; sand-replacement FIELD density determination. */
  'field density sand': 'compaction',
  /** modal option `CreateTestModal.tsx:267`; AS 1289.5.7.1 is the Hilf density ratio RAPID method — a field compaction control test, not a lab reference. */
  'hilf rapid': 'compaction',
  /** prod item `tmr q141a/b (insitu density), tmr q142a (mdd)` (5 rows). */
  'insitu density': 'compaction',

  // --- method codes (pack-class to add; see GOVERNANCE above) --------------
  /** same prod item as `insitu density`; TMR Q141A/B is the in-situ density method. */
  'tmr q141a/b': 'compaction',
  /** VIC seed, 5 of the 6 earthworks compaction strings; AS 1289.5.4.1 = compaction control test, dry density ratio. */
  'as 1289.5.4.1': 'compaction',
  /** VIC seed `seed-itp-templates-vic-earthworks.js:206,215,224`; AS 1289.5.7.1 = Hilf density ratio, rapid method. */
  'as 1289.5.7.1': 'compaction',
  /** VIC seed (6 strings) + prod items `rc 316.00` (5) and `rc 316.00 / rc 500.05` (4); VicRoads RC 316.00 = compaction testing. */
  'rc 316.00': 'compaction',

  // --- TfNSW method codes (`tfnsw-q6.v1`; pack-class, see GOVERNANCE) -------
  // Method NAMES are verbatim from Q6 Annexure Q6/M's own test-method list (PDF
  // p. 49), transcribed at `docs/research/c1-q6-pavements-2026-07-27.md` §3.4 —
  // the grade-A pass that also checked R71/R73/R75 (2020-21) against Q6 Ed 2
  // (2024) and found NO renumbering, so the characteristic tables below and this
  // list address the same tests.
  /**
   * Q6/M: "T173 Field wet density (nuclear)". The in-situ density determination
   * R71 cl. 8.4.2, R73 cl. 8.4.1 and R75 cl. 7.4.1 each name against the
   * characteristic "Insitu density" (research §2.6-2.8) — the same field test as
   * the descriptive `field density nuclear` / `insitu density` rows above.
   * NSW seeds: `seed-itp-templates-nsw-pavements.js:184`,
   * `seed-itp-templates-nsw-drainage.js:795`, plus five composite strings.
   */
  t173: 'compaction',
  /**
   * Q6/M: "T166 Relative compaction" — the characteristic itself (R71 cl. 8.4.4,
   * R73 cl. 8.4.3, R75 cl. 7.4.3), i.e. exactly what Table Q6/L.1 counts samples
   * of.
   * NSW seeds: `seed-itp-templates-nsw-environmental.js:116`,
   * `seed-itp-templates-nsw-road-furniture.js:175`, plus three composites.
   */
  t166: 'compaction',
  // DELIBERATELY NOT ALIASED, recorded so it is not re-derived:
  //   * `T162`. Q6/M names it "Compaction control test (rapid)" — the exact name
  //     of AS 1289.5.7.1, which this table already reads as a FIELD test. But
  //     R71 cl. 8.4.3 and R75 cl. 7.4.2 cite T162 against the characteristic
  //     "Maximum wet (or dry) density", beside the T111/T112 LABORATORY
  //     determinations, i.e. the Hilf REFERENCE limb. Two grade-A readings point
  //     opposite ways and nothing forces the call: T162 never appears alone in a
  //     shipped seed (only `T173 (Nuclear) / T166 / T162` and `T173 / T162`,
  //     both of which resolve on their T173 token), so leaving it unmapped can
  //     only UNDER-state, which is the visible direction and the recoverable
  //     one. Flip condition: a seed or production string carrying T162 alone.
  //   * `T119` (field density, sand replacement) and `T111`/`T112` (dry
  //     density/moisture relationships — the laboratory MDD, hence
  //     LAB_REFERENCE material, not aliases). The R-specs cite all three, but no
  //     shipped seed emits them and the SCOPE note admits only observed strings.

  // --- WHOLE-STRING entries, deliberately (§5.2, [F1C-B6]) ----------------
  /**
   * `seed-itp-templates-vic-drainage.js:1826` — "Verify compaction where DDR
   * testing is specified", `evidenceRequired: 'test'`, acceptance "…compaction
   * to Scale C per Sections 204/304". Whole string on purpose: the alternative
   * is a bare `ddr` token plus splitting inside parentheses, which §4.3.2 rule 3
   * forbids [F1C-R2].
   */
  'sections 204/304 (ddr, scale c)': 'compaction',
  /**
   * `seed-itp-templates-vic-conduits.js:140` — "Compact and test backfill",
   * `evidenceRequired: 'test'`, acceptance "density ratio >= 95% (standard
   * compaction) … >= 98% (modified compaction, 3 tests per lot per Section
   * 173)". Whole string on purpose: the bare tokens `standard` and `modified
   * compaction` name a COMPACTIVE EFFORT, i.e. a laboratory reference, and must
   * not become aliases. The whole string names the field requirement.
   */
  'standard / modified compaction (section 173)': 'compaction',
});

/**
 * Tokens that name a LABORATORY REFERENCE determination rather than the field
 * test a frequency clause counts (§5.3, Jay decision J2). Present so the
 * exclusion can be ENFORCED on both attribution limbs rather than merely absent
 * [F1C-B2] — an absence has no semantics, and Rev 1's absences let six linked
 * `MDD Standard` tests read "6 of 6".
 */
export const LAB_REFERENCE_TOKENS: ReadonlySet<string> = new Set([
  /** modal option `CreateTestModal.tsx:265`; AS 1289.5.1.1 — laboratory maximum dry density, standard compactive effort. */
  'mdd standard',
  /** modal option `CreateTestModal.tsx:266`; AS 1289.5.2.1 — laboratory MDD, modified compactive effort. */
  'mdd modified',
  /** token of prod item `tmr q141a/b (insitu density), tmr q142a (mdd)` (5 rows). */
  'mdd',
  /** same prod item; TMR Q142A is the MDD reference. That item still resolves `compaction` on its Q141a/b limb — it DOES require an in-situ density test. */
  'tmr q142a',
  /** `seed-itp-templates-austroads.js:108,182,1421` — lab MDD. */
  'as 1289.5.1.1',
  /** `seed-itp-templates-qld-environmental.js:813`, `qld-pavements.js:435`, `sa-pavements.js:634` — lab MDD, modified effort. */
  'as 1289.5.2.1',
]);

/**
 * The lookup is a `Map`, NOT a property read [F1C-R3]. `test_results.test_type`
 * is arbitrary free text from users, the AI vision extractor
 * (`testResultMapping.ts:63`) and filename inference
 * (`certificateExtraction.ts:75-79`) — a trust boundary.
 * `Object.freeze({...})['constructor']` returns a FUNCTION, and `toString`,
 * `valueOf`, `hasOwnProperty` likewise; freezing prevents writes, not prototype
 * reads. The literal above stays for reviewability; this Map is prototype-free
 * by construction and is also the fast path. AT-25 is the assertion.
 */
const ALIAS_LOOKUP = new Map(Object.entries(TEST_TYPE_ALIASES));

/**
 * §4.3.1. Lower-case and trim are what `counts.ts` already did. Whitespace
 * collapse handles the double spaces free-text entry produces. `_ -> space` is a
 * JUDGEMENT made on its own merits: `density_ratio` and `Density Ratio` are the
 * same test (§2.3).
 *
 * NOTHING else is touched — not `-` (`agpt-t212`), not `/` (`tmr q141a/b`), not
 * `.` (`as 1289.5.4.1`), not `:` (`ag:pt/t250`).
 *
 * Idempotent: `normalize(normalize(s)) === normalize(s)`. Rule 4 of
 * {@link tokenizeTestType} relies on that.
 */
export function normalizeTestTypeValue(value: string | null | undefined): string {
  return (value || '').toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

/** `,` · `;` · ` or ` · ` / ` (a slash SURROUNDED BY SPACES). Bare `/` is deliberately not a separator. */
const FRAGMENT_SEPARATORS = /,|;|\s+or\s+|\s+\/\s+/;

const PARENTHETICAL = /\([^)]*\)/g;

/**
 * §4.3.2. A stored value yields a token SET:
 *
 *   1. the whole normalized string;
 *   2. the string with every parenthesised span removed, then re-normalized;
 *   3. the contents of each parenthesised span, each re-normalized —
 *      **NOT further split** [F1C-R2]. That is what keeps
 *      `Sections 204/304 (DDR, Scale C)` from yielding a bare `ddr` and
 *      `RC 316.00 / AS 1289 (grading, PI)` from yielding a bare `grading`. An
 *      implementer who "helpfully" applies rule 4 inside parentheses widens
 *      matching and breaks AT-24;
 *   4. each fragment of (2) split on the separator set, **each fragment
 *      re-normalized** [F1C-R1] — stripping `(Insitu Density)` from the shipped
 *      prod item leaves `tmr q141a/b , tmr q142a`, whose first comma-fragment is
 *      `"tmr q141a/b "`, and with the trailing space it matches nothing.
 *
 * Empty tokens are dropped; the set is de-duplicated in first-seen order.
 */
export function tokenizeTestType(value: string | null | undefined): readonly string[] {
  const whole = normalizeTestTypeValue(value);
  if (!whole) return [];
  const tokens: string[] = [whole];

  const stripped = normalizeTestTypeValue(whole.replace(PARENTHETICAL, ' '));
  if (stripped) tokens.push(stripped);

  for (const match of whole.match(PARENTHETICAL) ?? []) {
    const inner = normalizeTestTypeValue(match.slice(1, -1));
    if (inner) tokens.push(inner);
  }

  for (const fragment of stripped.split(FRAGMENT_SEPARATORS)) {
    const normalized = normalizeTestTypeValue(fragment);
    if (normalized) tokens.push(normalized);
  }

  return [...new Set(tokens)];
}

export interface TestCategoryResolution {
  resolution: Resolution;
  /** True when TWO OR MORE distinct categories were found; `resolution` is then `null`. */
  conflict: boolean;
  /** The §4.3.2 token set, exposed so AT-24 can assert it directly. */
  tokens: readonly string[];
}

/**
 * §4.3.2 resolution, with the token set and the conflict flag AT-24 asserts.
 *
 * - exactly ONE category                          -> that category
 * - TWO OR MORE categories                        -> `null`, `conflict: true`
 *   (a string naming two categories is ambiguous, and this engine does not
 *   resolve ambiguity by picking)
 * - zero categories, at least one lab-ref token   -> {@link LAB_REFERENCE}
 * - zero of both                                  -> `null` (unknown)
 *
 * **Categories win over lab references within a single string, and that
 * ordering is the whole design.** The shipped prod item
 * `TMR Q141a/b (Insitu Density), TMR Q142a (MDD)` names both an in-situ density
 * method and a lab MDD reference; it MUST resolve `compaction`, because the item
 * genuinely requires an in-situ density test. The exclusion bites in
 * {@link candidateCategories}, not here.
 */
export function classifyTestType(value: string | null | undefined): TestCategoryResolution {
  const tokens = tokenizeTestType(value);
  const categories = new Set<TestCategory>();
  let labReference = false;
  for (const token of tokens) {
    const category = ALIAS_LOOKUP.get(token);
    if (category !== undefined) categories.add(category);
    else if (LAB_REFERENCE_TOKENS.has(token)) labReference = true;
  }
  if (categories.size === 1) {
    return { resolution: [...categories][0], conflict: false, tokens };
  }
  if (categories.size > 1) return { resolution: null, conflict: true, tokens };
  return { resolution: labReference ? LAB_REFERENCE : null, conflict: false, tokens };
}

/**
 * The pure resolver. Deterministic over frozen module-level data: no I/O, no
 * clock, no randomness.
 *
 * NO SUBSTRING MATCHING, no fuzzy matching, no similarity scoring, no AI
 * classification — token-exact only. `AS 1012.9 (Compressive Strength)` must
 * resolve `null`, and AT-25 is the proof at the failure site.
 */
export function resolveTestCategory(value: string | null | undefined): Resolution {
  return classifyTestType(value).resolution;
}

export type CategoryResolver = (value: string | null | undefined) => Resolution;

/**
 * §4.6 [F1C-B4]. A `Map<string, Resolution>` SCOPED TO THE BATCH CALL, created by
 * the batch entry point and threaded down — the same shape C1 used when it
 * threaded `sufficiency` in as a third parameter.
 *
 * Measured at HEAD over the 264 distinct VIC seed strings: 2.49 µs/resolve
 * unmemoized (+436 ms on a 5,000-lot × 35-string claim, against 36 ms of
 * headroom), 0.021 µs memoized (+3.7 ms, 264 distinct keys).
 *
 * Bounded by construction, so no eviction policy: the cache only ever holds
 * strings already resident in the rows that batch fetched, and it is
 * garbage-collected when the batch returns.
 *
 * `ponytail:` plain Map, batch-scoped. No LRU, no module-level cache — an
 * unbounded cache keyed on user-controlled strings is the design this one exists
 * to avoid.
 */
export function createCategoryResolver(
  cache: Map<string, Resolution> = new Map(),
): CategoryResolver {
  return (value) => {
    const key = value ?? '';
    let hit = cache.get(key);
    if (hit === undefined) {
      hit = resolveTestCategory(key);
      cache.set(key, hit);
    }
    return hit;
  };
}

/**
 * A rule's `testType` as a CATEGORY, or null. `LAB_REFERENCE` is not a category
 * (AT-22 forbids a pack declaring one), so it is folded to null here rather than
 * leaking through `typeof x === 'string'` at each call site — `LAB_REFERENCE` is
 * a string, and that is exactly the trap [C1C-19].
 */
export function ruleCategoryOf(
  resolve: CategoryResolver,
  ruleTestType: string | null | undefined,
): TestCategory | null {
  const resolution = resolve(ruleTestType);
  return resolution === null || resolution === LAB_REFERENCE ? null : resolution;
}

/**
 * §4.4 — **THE attribution rule** [F1C-B1] [C1C-20]. Both production callers use
 * this; there is no second place where a test's candidate categories are decided.
 * `evaluate.ts` (the per-lot count) and `regime.ts` `streamEntryConforming` (the
 * NEGATIVE streak predicate) must BOTH route through it — patching one leaves the
 * other comparing a raw string against a category, which compiles, ships green,
 * and silently makes every conformed lot look conforming.
 *
 * [F1C-B2] A test whose OWN type is a laboratory reference NEVER attributes,
 * however it is linked. Six `MDD Standard` tests hung off a compaction ITP item
 * are still six lab tests (AT-57). This is the limb Rev 1 left open.
 */
export function candidateCategories(
  own: Resolution,
  linkedItem: Resolution,
): readonly TestCategory[] {
  if (own === LAB_REFERENCE) return [];
  const out: TestCategory[] = [];
  if (typeof own === 'string') out.push(own);
  // The item limb: consulted when the test's own type resolves to a DIFFERENT
  // category, or to nothing at all. A lab-reference ITEM contributes nothing.
  if (typeof linkedItem === 'string' && linkedItem !== LAB_REFERENCE && linkedItem !== own) {
    out.push(linkedItem);
  }
  return out;
}

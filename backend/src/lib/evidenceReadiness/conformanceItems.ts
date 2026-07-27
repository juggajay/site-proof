// What BLOCKS lot conformance, as readiness items.
//
// Lifted out of `evidenceReadiness.ts` unchanged (same items, same order, same
// prose) when F0.4b PR 1 gave these five conditions a second consumer: the
// conformance DECISION path records the blocking codes it saw inside its
// transaction, and must not re-derive "what blocks conformance" from a second
// copy of the rules.
//
// Only the blockers live here. The positive/short-circuit items
// (`lot_already_claimed`, `lot_already_conformed`, `conformance_prerequisites_met`)
// depend on lot state rather than prerequisites and stay with the readiness
// engine, which is their only consumer.

import type { EvidenceReadinessItem, LotReadinessInput } from './core.js';
import { item } from './core.js';
import type { SufficiencyEvaluation } from '../readiness/sufficiency/evaluate.js';
import type {
  QuantityUnit,
  RuleSufficiency,
  UnknownCause,
} from '../readiness/sufficiency/types.js';

type ConformancePrerequisites = LotReadinessInput['conformStatus']['prerequisites'];

type OutstandingTestState = NonNullable<
  ConformancePrerequisites['outstandingTestItems']
>[number]['state'];

// Count-summary phrase for each state (the structured outstandingTests list
// carries the per-test names, so the prose only states how many are in each
// state). Ordered for a stable, readable summary.
const OUTSTANDING_TEST_STATE_COUNT_PHRASE: Record<OutstandingTestState, (n: number) => string> = {
  no_result: (n) => `${n} without ${n === 1 ? 'result' : 'results'}`,
  awaiting_verification: (n) => `${n} awaiting verification`,
  failing: (n) => `${n} failing`,
  // F1 §8.4 [F1C-B5], Jay's J3 copy requirement. After F1.2 the sufficiency
  // COUNT resolves categories while this gate still matches raw strings
  // (`predicates.ts` `testMatchesItem`, unchanged by design — §19), so a VIC lot
  // with six unlinked verified `Density Ratio` tests shows "6 of 6 — met" and
  // "ITP requires a matching passing verified test result" in one payload. Read
  // as two claims about the world that is a contradiction; read as one statement
  // plus one INSTRUCTION it is coherent — the tests count, link them and the lot
  // conforms. The copy is what decides which one the user sees, so it is a
  // requirement of F1.2 rather than a follow-up. AT-62 asserts the exact string,
  // so §19 removing the divergence shows up as a test diff, not a leftover.
  unmatched_result_exists: (n) => `${n} needing a result linked to the item`,
};

const OUTSTANDING_TEST_STATE_ORDER: OutstandingTestState[] = [
  'no_result',
  'awaiting_verification',
  'failing',
  'unmatched_result_exists',
];

// Turn the per-item outstanding-test breakdown into the blocker detail. The
// structured list on the item names the tests, so the prose is a count summary
// only (no per-item enumeration) — e.g. "12 required tests outstanding (10
// without results, 1 awaiting verification, 1 failing)." Falls back to the
// generic line when no structured breakdown is available (back-compat).
function buildOutstandingTestDetail(
  outstanding: ConformancePrerequisites['outstandingTestItems'] | undefined,
): string {
  if (!outstanding || outstanding.length === 0) {
    return 'Add or verify a passing test result before conformance.';
  }
  const counts = new Map<OutstandingTestState, number>();
  for (const test of outstanding) {
    counts.set(test.state, (counts.get(test.state) ?? 0) + 1);
  }
  const segments = OUTSTANDING_TEST_STATE_ORDER.filter((state) => counts.has(state)).map((state) =>
    OUTSTANDING_TEST_STATE_COUNT_PHRASE[state](counts.get(state)!),
  );
  const total = outstanding.length;
  return `${total} required test${total === 1 ? '' : 's'} outstanding (${segments.join(', ')}).`;
}

/**
 * The conformance blockers implied by a prerequisites snapshot — the five
 * conditions the conform gate enforces (`lotConformable`), and nothing else.
 * Empty means nothing is standing in the way of conforming the lot.
 */
export function buildConformanceBlockerItems(
  prerequisites: ConformancePrerequisites,
  sufficiency?: SufficiencyEvaluation | null,
): EvidenceReadinessItem[] {
  const items: EvidenceReadinessItem[] = [];

  if (!prerequisites.itpAssigned) {
    items.push(
      item({
        code: 'no_itp_assigned',
        severity: 'blocker',
        area: 'itp',
        title: 'No ITP assigned',
        detail: 'Assign an ITP before this lot can be conformed.',
        blocksAction: true,
        actionLabel: 'Assign ITP',
      }),
    );
  } else if (!prerequisites.itpCompleted) {
    items.push(
      item({
        code: 'itp_incomplete',
        severity: 'blocker',
        area: 'itp',
        title: 'ITP checklist incomplete',
        detail: `${prerequisites.itpCompletedCount}/${prerequisites.itpTotalCount} checklist items are complete.`,
        blocksAction: true,
        actionLabel: 'Complete ITP',
        count: prerequisites.itpTotalCount - prerequisites.itpCompletedCount,
        relatedIds: prerequisites.itpIncompleteItems.map((itpItem) => itpItem.id),
      }),
    );
  }

  // Only surface the test blocker when the ITP actually has a test point. A
  // lot whose ITP has no test points must not be shown a blocker the conform
  // gate (which now uses testRequired) would never raise.
  if (prerequisites.testRequired && !prerequisites.hasPassingTest) {
    items.push(
      item({
        code: 'no_passing_verified_test',
        severity: 'blocker',
        area: 'test',
        title: 'Required tests outstanding',
        detail: buildOutstandingTestDetail(prerequisites.outstandingTestItems),
        blocksAction: true,
        actionLabel: 'Review tests',
        outstandingTests: (prerequisites.outstandingTestItems ?? []).map((test) => ({
          itemId: test.itemId,
          description: test.description,
          testType: test.testType,
          state: test.state,
        })),
      }),
    );
  }

  if (!prerequisites.noOpenNcrs) {
    items.push(
      item({
        code: 'open_ncrs',
        severity: 'blocker',
        area: 'ncr',
        title: 'Open NCRs must be closed',
        detail: `${prerequisites.openNcrs.length} NCR${prerequisites.openNcrs.length === 1 ? '' : 's'} ${prerequisites.openNcrs.length === 1 ? 'remains' : 'remain'} open for this lot.`,
        blocksAction: true,
        actionLabel: 'Review NCRs',
        count: prerequisites.openNcrs.length,
        relatedIds: prerequisites.openNcrs.map((ncr) => ncr.id),
      }),
    );
  }

  // N/A hold-point bypass guard: a hold-point sign-off item marked N/A is only
  // accepted when its hold point is released. Surface this as a conformance
  // blocker so field staff know exactly what still needs a superintendent sign-off.
  const naHpBlockerCount = prerequisites.naHoldPointBlockerCount ?? 0;
  if (!(prerequisites.noNaHoldPointBypass ?? true) || naHpBlockerCount > 0) {
    items.push(
      item({
        code: 'na_hold_point_not_released',
        severity: 'blocker',
        area: 'hold_point',
        title: 'Hold point items require release',
        detail: `${naHpBlockerCount} hold point item${naHpBlockerCount === 1 ? '' : 's'} marked N/A but the hold point has not been released. Release the hold point to satisfy conformance.`,
        blocksAction: true,
        actionLabel: 'Review hold points',
        count: naHpBlockerCount,
      }),
    );
  }

  // Wave C1 (§5.1.2, §5.1.4). `sufficiencyBlocks` IS a `lotConformable`
  // condition once §5.1.1 lands, so the one blocking sufficiency case belongs
  // here and this function's "five conditions and nothing else" contract holds.
  // It is already mode- and status-folded: it can only be true at
  // `mode: 'block'` on a CONFIRMED ruleset. Everything advisory rides
  // `buildSufficiencyAdvisoryItems` instead.
  if (prerequisites.sufficiencyBlocks ?? false) {
    const short = shortfallRules(sufficiency);
    items.push(
      item({
        code: 'insufficient_test_count',
        severity: 'blocker',
        area: 'test',
        title: 'Not enough tests for this lot',
        detail: short.length > 0 ? short.map(shortfallSentence).join(' ') : SUFFICIENCY_NO_DETAIL,
        blocksAction: true,
        actionLabel: 'Review tests',
        count: short.length,
      }),
    );
  }

  return items;
}

// The blocking item is emitted from `prerequisites.sufficiencyBlocks` alone, so
// a caller that has the boolean but not the evaluation (the decision snapshot
// path re-derives items from prerequisites) still gets an honest item rather
// than a fabricated count.
const SUFFICIENCY_NO_DETAIL =
  'The governing specification requires more tests for this lot than are recorded.';

function shortfallRules(sufficiency: SufficiencyEvaluation | null | undefined): RuleSufficiency[] {
  return (sufficiency?.rules ?? []).filter(
    (rule) => rule.state === 'insufficient' && rule.requiredCount !== null,
  );
}

/**
 * Facts only — counts and the clause that carries them, never a quotation of
 * specification prose (§8.4, §4.4). The unconfirmed tag fires whenever
 * `citation.confirmed === false`, which is how a `draft` pack stays honest while
 * still showing real numbers (§4.2 [C1R-B5]).
 */
function shortfallSentence(rule: RuleSufficiency): string {
  const need = rule.requiredCount ?? 0;
  const parts = [`${rule.passingCount} verified conforming`];
  if (rule.pendingCount > 0) parts.push(`${rule.pendingCount} pending`);
  const unconfirmed = rule.citation.confirmed ? '' : ', unconfirmed edition';
  return (
    `Requires ${need} ${rule.testType} test${need === 1 ? '' : 's'} ` +
    `(${rule.citation.authority} ${rule.citation.document}, clause ${rule.citation.clause}, ` +
    `${rule.citation.edition || 'edition unrecorded'}${unconfirmed}). ` +
    `${parts.join(', ')}.${smallAreaCaveat(rule)}`
  );
}

/**
 * D14 §6.2.5 `[D14X-3]` — the known ceiling rides the ITEM TEXT, not the label.
 *
 * The pack's rule label carries "unless a Sec 173 small lot", and this sentence
 * builder has never read `rule.label` — so a 300 m² lot was told flatly
 * "Requires 6", with nothing on screen about the cheaper route its own
 * specification gives it. A rule label is a developer-facing record; the item
 * text is the disclosure channel.
 *
 * The count is NOT downgraded to `unknown` on an eligible lot: the requirement
 * genuinely IS the full count unless the contractor elects otherwise, and §3.4's
 * doctrine is `unknown` for what CIVOS cannot determine, never for what it can.
 * The wording problem is fixed by fixing the wording.
 *
 * `ponytail:` one conditional clause in one sentence builder, over the
 * eligibility the evaluator already computed.
 */
function smallAreaCaveat(rule: RuleSufficiency): string {
  const basis = rule.smallAreaBasis;
  if (!basis) return '';
  return (
    ` This lot is under ${basis.maxArea.value} ${basis.maxArea.unit}: ` +
    `${smallAreaCitation(basis)} allows ${basis.requiredCount} tests instead, accepted on the ` +
    `mean, which must beat the scale requirement by ${shiftPct(basis)} %.`
  );
}

type SmallAreaBasis = NonNullable<RuleSufficiency['smallAreaBasis']>;

/** Same citation shape `shortfallSentence` already uses — a DIFFERENT document. */
function smallAreaCitation(basis: SmallAreaBasis): string {
  const unconfirmed = basis.citation.confirmed ? '' : ', unconfirmed edition';
  return (
    `${basis.citation.authority} ${basis.citation.document}, clause ${basis.citation.clause}` +
    ` (${basis.citation.edition || 'edition unrecorded'}${unconfirmed})`
  );
}

function shiftPct(basis: SmallAreaBasis): string {
  return basis.acceptanceShiftPct.toFixed(1);
}

export interface UnknownCausePromptContext {
  /** `Ruleset.scaleLabel`, lower-cased for mid-sentence use. Defaults below. */
  scaleLabel: string;
  /**
   * The unit the unsatisfied rule needed, or null when unknown. D14.1 always
   * passes null — no shipped pack declares a per-quantity limb, so
   * `quantity_missing` cannot fire yet — and D14.3's banded Q6 rules supply it.
   */
  requiredUnit: QuantityUnit | null;
}

/**
 * D14 §4.7 `[D14R-B6]` — a function, not the static `Record` this used to be.
 *
 * Two of these strings name a concept the PACK owns. VicRoads regiments by
 * "Compaction Scale A/B/C"; TfNSW Q6 regiments by specified relative compaction
 * band. A static string means an NSW lot's panel says *"Select this lot's testing
 * scale"* beside a form control labelled *"Specified relative compaction"*
 * offering `>95.0-98.0%` — the exit criterion "readable by a quality manager
 * without training" fails on the first NSW lot the pack ever touches.
 *
 * `no_ruleset_for_project` and `no_rule_for_activity` stay EMPTY: those states are
 * deliberately silent (§7.1), because most projects resolve no ruleset and a
 * warning per lot would teach every user to ignore the section.
 *
 * `ponytail:` a function of two arguments, not a per-ruleset prompt registry.
 */
export function unknownCausePrompt(cause: UnknownCause, ctx: UnknownCausePromptContext): string {
  switch (cause) {
    case 'no_ruleset_for_project':
    case 'no_rule_for_activity':
      return '';
    case 'activity_not_canonical':
      return "Classify this lot's activity to check its test frequency.";
    case 'scale_not_selected':
      return `Select this lot’s ${ctx.scaleLabel} to check its test frequency.`;
    case 'scale_not_recognised':
      return `This lot’s ${ctx.scaleLabel} is not one the governing specification uses.`;
    case 'quantity_missing':
      // Drawing a polygon supplies an AREA and nothing else, so offering it for a
      // rule counting against tonnes or chainage metres sends the user somewhere
      // that cannot help (§4.6).
      return ctx.requiredUnit === null || ctx.requiredUnit === 'm2'
        ? 'Record this lot’s quantity (or draw its geometry) to check test frequency.'
        : `Record this lot’s quantity in ${ctx.requiredUnit} to check test frequency.`;
  }
}

export const DEFAULT_SCALE_LABEL = 'testing scale';

/**
 * Sufficiency items. Split from {@link buildConformanceBlockerItems} because that
 * function is contractually the `lotConformable` conditions and nothing else. The
 * ONE blocking case is emitted there via `prerequisites.sufficiencyBlocks`; every
 * item here is advisory BY CONSTRUCTION — `blocksAction` is a hard-coded `false`,
 * never a computed value (§5.1.3, §5.1.4).
 */
export function buildSufficiencyAdvisoryItems(
  sufficiency: SufficiencyEvaluation | null | undefined,
  options?: { includeShortfall?: boolean },
): EvidenceReadinessItem[] {
  if (!sufficiency) return [];
  const items: EvidenceReadinessItem[] = [];

  // §7.1 rows 1-2 are SILENT: most projects resolve no ruleset, and a warning per
  // lot in that state would teach every user to ignore the section.
  // D14 §4.7: the pack's own word for what `Lot.testScale` carries.
  const promptContext: UnknownCausePromptContext = {
    scaleLabel: sufficiency.ruleset?.scaleLabel?.trim().toLowerCase() || DEFAULT_SCALE_LABEL,
    requiredUnit: null,
  };
  const causes = [
    ...sufficiency.unknownCauses,
    ...sufficiency.rules.flatMap((rule) => rule.unknownCauses),
  ];
  const prompts = [...new Set(causes.map((cause) => unknownCausePrompt(cause, promptContext)))]
    .filter((prompt) => prompt.length > 0)
    .join(' ');
  if (prompts) {
    items.push(
      item({
        code: 'test_sufficiency_unknown',
        severity: 'warning',
        area: 'test',
        title: 'Test frequency cannot be checked',
        detail: prompts,
        blocksAction: false,
      }),
    );
  }

  // The shortfall as a WARNING. Suppressed on the blocking path, where the
  // blocker builder already said it (`includeShortfall: false`).
  const short = shortfallRules(sufficiency);
  if (short.length > 0 && (options?.includeShortfall ?? true)) {
    items.push(
      item({
        code: 'insufficient_test_count',
        severity: 'warning',
        area: 'test',
        title: 'Fewer tests than the specification requires',
        detail: short.map(shortfallSentence).join(' '),
        blocksAction: false,
        actionLabel: 'Review tests',
        count: short.length,
      }),
    );
  }

  const satisfied = sufficiency.rules.filter((rule) => rule.state === 'satisfied');
  if (satisfied.length > 0 && short.length === 0) {
    items.push(
      item({
        code: 'test_sufficiency_met',
        severity: 'support',
        area: 'test',
        title: 'Test frequency met',
        detail: satisfied
          .map(
            (rule) =>
              `${rule.passingCount} of ${rule.requiredCount} required ${rule.testType} tests verified ` +
              `(${rule.citation.authority} ${rule.citation.document}, clause ${rule.citation.clause}).`,
          )
          .join(' '),
        blocksAction: false,
        count: satisfied.length,
      }),
    );
  }

  // [C1C-6] Eligibility is presentation only and says so: clause 204.14(c) grants
  // the right to ASK for a reduced frequency, never the reduction itself.
  const eligible = sufficiency.rules.filter((rule) => rule.reducedFrequencyEligible === true);
  if (eligible.length > 0) {
    items.push(
      item({
        code: 'test_sufficiency_met',
        severity: 'support',
        area: 'test',
        title: 'Eligible to request reduced test frequency',
        detail:
          `${eligible[0].regimeBasis?.lotIds.length ?? 0} consecutive conforming lots recorded, so you may ` +
          'ask the Superintendent to agree a reduced frequency. Until that agreement is recorded, the full ' +
          'count still applies.',
        blocksAction: false,
      }),
    );
  }

  // D14 §6.2.1 — Section 173 small-area ELIGIBILITY, disclosed. Reuses the
  // shipped `test_sufficiency_met` support code, following the reduced-frequency
  // eligibility item above: an advisory sentence does not justify widening a
  // closed, contract-tested reason-code vocabulary (§4.5).
  //
  // §6.3 is binding here: CIVOS counts tests and evaluates no density-ratio
  // VALUES, so this sentence must state the SHIFTED acceptance threshold in the
  // same breath as the reduced count. Without it a user reads "3 tests instead
  // of 6" as a free reduction, when it is a trade for a 2.0-point harder target.
  const smallArea = sufficiency.rules.filter((rule) => rule.smallAreaEligible === true);
  for (const rule of smallArea) {
    const basis = rule.smallAreaBasis;
    if (!basis) continue;
    items.push(
      item({
        code: 'test_sufficiency_met',
        severity: 'support',
        area: 'test',
        title: 'A cheaper testing route is available',
        detail:
          `This lot is under ${basis.maxArea.value} ${basis.maxArea.unit}, so ` +
          `${smallAreaCitation(basis)} lets it be tested as a small area: ${basis.requiredCount} ` +
          `${rule.testType} tests instead of ${rule.requiredCount ?? 'the full count'}, accepted ` +
          `on the mean of the ${basis.requiredCount}, which must beat the scale requirement by ` +
          `${shiftPct(basis)} %. CIVOS counts tests only — it does not check that threshold. ` +
          `The full count still applies unless you test this lot as a small area.`,
        blocksAction: false,
      }),
    );
  }

  if (sufficiency.unlinkedPassingTestIds.length > 0) {
    const n = sufficiency.unlinkedPassingTestIds.length;
    items.push(
      item({
        code: 'tests_unlinked_to_itp_item',
        severity: 'warning',
        area: 'test',
        title: 'Verified tests not counted',
        // F1 §8.2 [F1C-R7]. The old copy ("not linked to a checklist item")
        // stopped being true at F1.2: a test now lands in this set whenever its
        // CATEGORY is unresolved — including when it is perfectly well linked to
        // an item whose type nobody has aliased, and when it resolves to a
        // category no rule references. Naming the real cause is also the prompt
        // that gets an alias added (§7's classifier is the other half).
        detail: `${n} verified test${n === 1 ? ' is' : 's are'} not counted toward the required frequency — ${n === 1 ? 'its test type is' : 'their test types are'} not recognised as one this ITP requires.`,
        blocksAction: false,
        actionLabel: 'Review tests',
        count: n,
        relatedIds: sufficiency.unlinkedPassingTestIds,
      }),
    );
  }

  for (const exceedance of sufficiency.maxLotSizeExceedances) {
    items.push(
      item({
        code: 'lot_exceeds_max_lot_size',
        severity: 'warning',
        area: 'conformance',
        title: 'Lot is larger than the specification allows',
        detail: `This lot is ${exceedance.actual} ${exceedance.unit}; the governing specification caps it at ${exceedance.limit} ${exceedance.unit}. Consider splitting the lot.`,
        blocksAction: false,
      }),
    );
  }

  return items;
}

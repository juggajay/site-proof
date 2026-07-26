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
  unmatched_result_exists: (n) =>
    `${n} with ${n === 1 ? 'an unlinked result' : 'unlinked results'}`,
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

  return items;
}

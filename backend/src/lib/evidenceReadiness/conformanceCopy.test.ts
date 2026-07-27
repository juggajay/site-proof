// Wave F1.2 acceptance test AT-62 — the J3 copy [F1C-B5] (spec §8.2, §8.4).
//
// F1.2 makes the sufficiency engine and the shipped conformance gate disagree
// inside a single payload, deliberately and temporarily (§16.0 J3, §19). Jay's
// decision was "fix counts now, gate matcher next", on TWO conditions, and the
// second is that THE COPY CARRIES IT: the user must see one instruction, not two
// contradictory claims.
//
// So the exact strings are pinned here. When §19 removes the divergence, the
// copy change shows up as a TEST DIFF rather than a leftover nobody notices.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildConformanceBlockerItems, buildSufficiencyAdvisoryItems } from './conformanceItems.js';
import type { SufficiencyEvaluation } from '../readiness/sufficiency/evaluate.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function prerequisitesWithUnmatched(count: number) {
  return {
    itpAssigned: true,
    itpCompleted: true,
    itpCompletedCount: 1,
    itpTotalCount: 1,
    itpIncompleteItems: [],
    testRequired: true,
    hasPassingTest: false,
    outstandingTestItems: Array.from({ length: count }, (_unused, index) => ({
      itemId: `item-${index}`,
      description: 'Compaction test point',
      testType: 'AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00',
      state: 'unmatched_result_exists' as const,
    })),
    testResults: [],
    noOpenNcrs: true,
    openNcrs: [],
    naHoldPointBlockerCount: 0,
    noNaHoldPointBypass: true,
    sufficiencyBlocks: false,
  };
}

function evaluationWithUnlinked(count: number): SufficiencyEvaluation {
  return {
    state: 'satisfied',
    mode: 'warn',
    ruleset: { id: 'vicroads-204.v1', status: 'confirmed' },
    rules: [],
    unknownCauses: [],
    maxLotSizeExceedances: [],
    unlinkedPassingTestIds: Array.from({ length: count }, (_unused, i) => `test-${i}`),
    sufficiencyBlocks: false,
    verdict: {
      subjectType: 'lot',
      subjectId: 'lot-1',
      sufficient: false,
      reasonCodes: ['tests_unlinked_to_itp_item'],
      state: 'satisfied',
      rules: [],
    },
  };
}

describe('AT-62 §8.4 — the unmatched-result item reads as an INSTRUCTION', () => {
  it.each([
    [1, '1 required test outstanding (1 needing a result linked to the item).'],
    [3, '3 required tests outstanding (3 needing a result linked to the item).'],
  ])('%s outstanding', (count, expected) => {
    const [blocker] = buildConformanceBlockerItems(prerequisitesWithUnmatched(count));
    expect(blocker.code).toBe('no_passing_verified_test');
    expect(blocker.detail).toBe(expected);
  });

  it('the frontend per-test suffix is the matching instruction (LotReadinessPanel.tsx)', () => {
    // Paired BY CITATION, not by import — there is no shared package between
    // `frontend/` and `backend/`, and building one for one string is not
    // warranted (§17.3). Drift is bounded: this assertion is the tripwire.
    const panel = readFileSync(
      path.join(REPO_ROOT, 'frontend/src/pages/lots/components/LotReadinessPanel.tsx'),
      'utf8',
    );
    expect(panel).toContain("unmatched_result_exists: 'link this test to its checklist item'");
    expect(panel).not.toContain("unmatched_result_exists: 'result not linked'");
  });
});

describe('AT-62 §8.2 [F1C-R7] — the "not counted" advisory names the real cause', () => {
  // The old copy ("not linked to a checklist item") stopped being true at F1.2:
  // a test lands in `unlinkedPassingTestIds` whenever its CATEGORY is
  // unresolved, INCLUDING when it is perfectly well linked to an item whose type
  // nobody has aliased, and when it resolves to a category no rule references.
  it.each([
    [
      1,
      '1 verified test is not counted toward the required frequency — its test type is not recognised as one this ITP requires.',
    ],
    [
      6,
      '6 verified tests are not counted toward the required frequency — their test types are not recognised as one this ITP requires.',
    ],
  ])('%s unlinked passing tests', (count, expected) => {
    const items = buildSufficiencyAdvisoryItems(evaluationWithUnlinked(count));
    const advisory = items.find((entry) => entry.code === 'tests_unlinked_to_itp_item');
    expect(advisory?.title).toBe('Verified tests not counted');
    expect(advisory?.detail).toBe(expected);
    // Unchanged: code, severity, area, action label, blocking. NO new reason
    // code, no new item, no new panel (§8.2).
    expect(advisory).toMatchObject({
      severity: 'warning',
      area: 'test',
      blocksAction: false,
      actionLabel: 'Review tests',
      count,
    });
  });
});

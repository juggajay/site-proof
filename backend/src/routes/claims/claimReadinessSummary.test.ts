// Wave F F1 — the aggregation invariants, pinned without a database.
//
// The route tests (`claims.test.ts`) prove the endpoint reads the real
// computation; these prove the arithmetic, which is the part that has to be
// right for a dollar figure to be shown to a user at all.

import { describe, expect, it } from 'vitest';

import type { EvidenceReadinessItem, LotEvidenceReadiness } from '../../lib/evidenceReadiness.js';
import { CLAIM_MEMBER_REASON_CODES } from '../../lib/readiness/requirements/claimMember.v1.js';
import {
  summarizeClaimReadiness,
  toClaimReadinessAggregateRow,
  type ClaimReadinessAggregateRow,
} from './claimReadinessSummary.js';

function blockerItem(
  code: EvidenceReadinessItem['code'],
  blocksAction = true,
): EvidenceReadinessItem {
  return {
    code,
    severity: 'blocker',
    area: 'claim',
    title: `title ${code}`,
    detail: `detail ${code}`,
    blocksAction,
  };
}

function fixture(options: {
  lotId?: string;
  budgetAmount?: number | null;
  claimedPercentage?: number;
  claimBlockers?: EvidenceReadinessItem[];
  conformanceBlockers?: EvidenceReadinessItem[];
}): LotEvidenceReadiness {
  const claimedPercentage = options.claimedPercentage ?? 0;
  return {
    lotId: options.lotId ?? 'lot-1',
    lotNumber: `L-${options.lotId ?? 'lot-1'}`,
    status: 'conformed',
    conformStatus: {} as LotEvidenceReadiness['conformStatus'],
    conformance: {
      state: 'ready',
      blockers: options.conformanceBlockers ?? [],
      warnings: [],
      support: [],
    },
    claim: {
      state: 'ready',
      blockers: options.claimBlockers ?? [],
      warnings: [],
      support: [],
      budgetAmount: options.budgetAmount === undefined ? 1000 : options.budgetAmount,
      claimedInId: null,
      claimedPercentage,
      remainingPercentage: 100 - claimedPercentage,
    },
    summary: { blockerCount: 0, warningCount: 0, supportCount: 0, actionBlockerCount: 0 },
  } as LotEvidenceReadiness;
}

function row(options: Parameters<typeof fixture>[0] & { activityType?: string | null }) {
  return toClaimReadinessAggregateRow(
    { activityType: options.activityType ?? 'Earthworks' },
    fixture(options),
  );
}

function sumGroups(groups: { blockedValue: number }[]): number {
  return Number(groups.reduce((total, group) => total + group.blockedValue, 0).toFixed(2));
}

describe('claim-readiness summary aggregation (Wave F F1)', () => {
  it('reports zeroes for a project with no lots in scope', () => {
    expect(summarizeClaimReadiness([])).toEqual({
      totalBudget: 0,
      claimableValue: 0,
      blockedValue: 0,
      lotsInScope: 0,
      lotsBlocked: 0,
      lotsWithNullBudget: 0,
      groups: [],
    });
  });

  it('splits claimable and blocked value against the total budget', () => {
    const summary = summarizeClaimReadiness([
      row({ lotId: 'a', budgetAmount: 1000 }),
      row({ lotId: 'b', budgetAmount: 4000, claimBlockers: [blockerItem('not_conformed')] }),
    ]);

    expect(summary.totalBudget).toBe(5000);
    expect(summary.claimableValue).toBe(1000);
    expect(summary.blockedValue).toBe(4000);
    expect(summary.lotsInScope).toBe(2);
    expect(summary.lotsBlocked).toBe(1);
    expect(summary.claimableValue + summary.blockedValue).toBe(summary.totalBudget);
  });

  it('values a partially claimed lot at what is left to claim', () => {
    const summary = summarizeClaimReadiness([
      row({ lotId: 'a', budgetAmount: 1000, claimedPercentage: 40 }),
      row({
        lotId: 'b',
        budgetAmount: 1000,
        claimedPercentage: 25,
        claimBlockers: [blockerItem('missing_budget')],
      }),
    ]);

    expect(summary.totalBudget).toBe(2000);
    expect(summary.claimableValue).toBe(600);
    expect(summary.blockedValue).toBe(750);
  });

  it('counts a null-budget lot but never values it', () => {
    const summary = summarizeClaimReadiness([
      row({ lotId: 'a', budgetAmount: null, claimBlockers: [blockerItem('missing_budget')] }),
      row({ lotId: 'b', budgetAmount: 2500, claimBlockers: [blockerItem('missing_budget')] }),
    ]);

    expect(summary.lotsInScope).toBe(2);
    expect(summary.lotsBlocked).toBe(2);
    expect(summary.lotsWithNullBudget).toBe(1);
    expect(summary.totalBudget).toBe(2500);
    expect(summary.blockedValue).toBe(2500);
    expect(summary.groups).toEqual([{ code: 'missing_budget', lotCount: 2, blockedValue: 2500 }]);
  });

  it('handles a project where every lot is blocked and one where none is', () => {
    const allBlocked = summarizeClaimReadiness([
      row({ lotId: 'a', claimBlockers: [blockerItem('not_conformed')] }),
      row({ lotId: 'b', claimBlockers: [blockerItem('not_conformed')] }),
    ]);
    expect(allBlocked.claimableValue).toBe(0);
    expect(allBlocked.blockedValue).toBe(allBlocked.totalBudget);

    const noneBlocked = summarizeClaimReadiness([row({ lotId: 'a' }), row({ lotId: 'b' })]);
    expect(noneBlocked.blockedValue).toBe(0);
    expect(noneBlocked.groups).toEqual([]);
  });

  // AT-F1-OVERLAP (spec §1.2 `[FR-B2]`, §5.5). Both directions, because the
  // failure this guards against — a $100k lot rendering as $300k of blocked
  // value — is invisible to a presence-only test over the reason codes.
  it('AT-F1-OVERLAP (a): group values overlap and exceed the total when a lot carries two codes', () => {
    const summary = summarizeClaimReadiness([
      row({
        lotId: 'multi',
        budgetAmount: 100_000,
        claimBlockers: [blockerItem('not_conformed')],
        conformanceBlockers: [blockerItem('itp_incomplete')],
      }),
    ]);

    expect(summary.blockedValue).toBe(100_000);
    expect(summary.groups).toHaveLength(2);
    expect(sumGroups(summary.groups)).toBe(200_000);
    expect(sumGroups(summary.groups)).toBeGreaterThan(summary.blockedValue);
  });

  it('AT-F1-OVERLAP (b): group values sum exactly to the total when every blocked lot carries one code', () => {
    const summary = summarizeClaimReadiness([
      row({ lotId: 'a', budgetAmount: 1000, claimBlockers: [blockerItem('not_conformed')] }),
      row({ lotId: 'b', budgetAmount: 2000, claimBlockers: [blockerItem('missing_budget')] }),
      row({ lotId: 'c', budgetAmount: 3000, claimBlockers: [blockerItem('already_claimed')] }),
      row({ lotId: 'd', budgetAmount: 4000 }),
    ]);

    expect(summary.blockedValue).toBe(6000);
    expect(sumGroups(summary.groups)).toBe(summary.blockedValue);
  });

  it('groups by every code in the claim-member vocabulary', () => {
    const rows = CLAIM_MEMBER_REASON_CODES.map((code, index) =>
      row({ lotId: `lot-${index}`, budgetAmount: 100, claimBlockers: [blockerItem(code)] }),
    );

    const summary = summarizeClaimReadiness(rows);

    expect(summary.groups.map((group) => group.code).sort()).toEqual(
      [...CLAIM_MEMBER_REASON_CODES].sort(),
    );
    expect(summary.groups.every((group) => group.lotCount === 1)).toBe(true);
  });

  it('sorts groups by blocked value, then code', () => {
    const summary = summarizeClaimReadiness([
      row({ lotId: 'a', budgetAmount: 100, claimBlockers: [blockerItem('not_conformed')] }),
      row({ lotId: 'b', budgetAmount: 900, claimBlockers: [blockerItem('missing_budget')] }),
      row({ lotId: 'c', budgetAmount: 100, claimBlockers: [blockerItem('already_claimed')] }),
    ]);

    expect(summary.groups.map((group) => group.code)).toEqual([
      'missing_budget',
      'already_claimed',
      'not_conformed',
    ]);
  });

  it('ignores non-blocking items and codes outside the vocabulary', () => {
    const advisory = row({
      lotId: 'a',
      budgetAmount: 5000,
      // Severity `blocker` but `blocksAction: false` — the shipped engine emits
      // exactly this for unreleased hold points, and it must not blockade value.
      claimBlockers: [blockerItem('unreleased_hold_points', false)],
    });
    expect(advisory.blocked).toBe(false);
    expect(advisory.reasonCodes).toEqual([]);

    const outsideVocabulary = row({
      lotId: 'b',
      budgetAmount: 5000,
      claimBlockers: [blockerItem('not_conformed'), blockerItem('open_ncrs')],
    });
    expect(outsideVocabulary.reasonCodes).toEqual(['not_conformed']);

    const summary = summarizeClaimReadiness([advisory, outsideVocabulary]);
    expect(summary.claimableValue).toBe(5000);
    expect(summary.blockedValue).toBe(5000);
  });

  it('never lands a blocked lot outside every group', () => {
    const rows: ClaimReadinessAggregateRow[] = [
      row({ lotId: 'a', claimBlockers: [blockerItem('not_conformed')] }),
      row({ lotId: 'b', claimBlockers: [blockerItem('already_claimed')] }),
    ];
    for (const candidate of rows) {
      expect(candidate.blocked).toBe(true);
      expect(candidate.reasonCodes.length).toBeGreaterThan(0);
    }
  });
});

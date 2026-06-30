/**
 * Exhaustive tests for lotsShellState — the pure state derivation for the Lots
 * shell: lot tone/meta, actionable-first sort, run-item ordering + advance,
 * hold-point gating, and the derived readiness line.
 */
import { describe, it, expect } from 'vitest';
import {
  advanceToNextIncomplete,
  canCompleteItem,
  deriveLotReadinessLine,
  deriveLotShellMeta,
  firstIncompleteIndex,
  formatItpFinishedCopy,
  formatItpOutcomeSummary,
  holdPointGateDecision,
  isItpItemActionable,
  isItpItemResolved,
  itpCompletionDisposition,
  itpHubSummary,
  lotStatusTone,
  runItemOrder,
  runProgress,
  sortLotsForShell,
  type ItpHubSummary,
  type LotShellMeta,
} from '../lotsShellState';
import type { ITPChecklistItem, ITPCompletion, ITPInstance } from '@/pages/lots/types';
import type { Lot } from '@/pages/lots/lotsPageTypes';

// ── builders ────────────────────────────────────────────────────────────────

function makeLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: 'lot-1',
    lotNumber: 'LOT-001',
    description: 'Embankment',
    status: 'in_progress',
    chainageStart: null,
    chainageEnd: null,
    offset: null,
    layer: null,
    areaZone: null,
    ...overrides,
  };
}

function makeItem(overrides: Partial<ITPChecklistItem> = {}): ITPChecklistItem {
  return {
    id: 'item-1',
    description: 'Check fill',
    category: 'Earthworks',
    responsibleParty: 'contractor',
    isHoldPoint: false,
    pointType: 'standard',
    evidenceRequired: 'none',
    order: 0,
    ...overrides,
  };
}

function makeCompletion(overrides: Partial<ITPCompletion> = {}): ITPCompletion {
  return {
    id: 'c-1',
    checklistItemId: 'item-1',
    isCompleted: false,
    notes: null,
    completedAt: null,
    completedBy: null,
    isVerified: false,
    verifiedAt: null,
    verifiedBy: null,
    attachments: [],
    ...overrides,
  };
}

function makeSummary(overrides: Partial<ItpHubSummary> = {}): ItpHubSummary {
  return {
    total: 0,
    resolved: 0,
    accepted: 0,
    completed: 0,
    notApplicable: 0,
    failed: 0,
    pendingReview: 0,
    rejected: 0,
    pending: 0,
    due: 0,
    ...overrides,
  };
}

// ── lotStatusTone ─────────────────────────────────────────────────────────────

describe('lotStatusTone', () => {
  it('maps hold_point/on_hold/awaiting_test to attention', () => {
    expect(lotStatusTone('hold_point')).toBe('attention');
    expect(lotStatusTone('on_hold')).toBe('attention');
    expect(lotStatusTone('awaiting_test')).toBe('attention');
  });
  it('maps ncr_raised to bad', () => {
    expect(lotStatusTone('ncr_raised')).toBe('bad');
  });
  it('maps conformed/claimed/completed to good', () => {
    expect(lotStatusTone('conformed')).toBe('good');
    expect(lotStatusTone('claimed')).toBe('good');
    expect(lotStatusTone('completed')).toBe('good');
  });
  it('defaults unknown/in_progress to neutral', () => {
    expect(lotStatusTone('in_progress')).toBe('neutral');
    expect(lotStatusTone('weird')).toBe('neutral');
    expect(lotStatusTone('')).toBe('neutral');
  });
  it('is case-insensitive', () => {
    expect(lotStatusTone('HOLD_POINT')).toBe('attention');
  });
});

// ── deriveLotShellMeta ────────────────────────────────────────────────────────

describe('deriveLotShellMeta', () => {
  it('marks a lot with checks due actionable', () => {
    const meta = deriveLotShellMeta(makeLot(), 3);
    expect(meta.checksDue).toBe(3);
    expect(meta.isActionable).toBe(true);
  });
  it('marks a hold-point lot actionable even with zero checks due', () => {
    const meta = deriveLotShellMeta(makeLot({ status: 'hold_point' }), 0);
    expect(meta.isActionable).toBe(true);
  });
  it('a benign in-progress lot with no due is not actionable', () => {
    const meta = deriveLotShellMeta(makeLot({ status: 'in_progress' }), 0);
    expect(meta.isActionable).toBe(false);
  });
  it('coerces null description and missing counts', () => {
    const meta = deriveLotShellMeta(makeLot({ description: null }), 0);
    expect(meta.description).toBe('');
    expect(meta.itpCount).toBe(0);
    expect(meta.ncrCount).toBe(0);
  });
});

// ── sortLotsForShell ──────────────────────────────────────────────────────────

describe('sortLotsForShell', () => {
  const base = (over: Partial<LotShellMeta>): LotShellMeta => ({
    id: 'x',
    lotNumber: 'LOT-001',
    description: '',
    status: 'in_progress',
    statusLabel: 'In Progress',
    tone: 'neutral',
    itpCount: 0,
    ncrCount: 0,
    holdPointCount: 0,
    checksDue: 0,
    isActionable: false,
    ...over,
  });

  it('sorts more checks due first', () => {
    const sorted = sortLotsForShell([
      base({ id: 'a', checksDue: 1 }),
      base({ id: 'b', checksDue: 5 }),
      base({ id: 'c', checksDue: 0 }),
    ]);
    expect(sorted.map((m) => m.id)).toEqual(['b', 'a', 'c']);
  });

  it('breaks check-due ties by attention/bad tone', () => {
    const sorted = sortLotsForShell([
      base({ id: 'good', tone: 'good' }),
      base({ id: 'ncr', tone: 'bad' }),
      base({ id: 'hold', tone: 'attention' }),
      base({ id: 'plain', tone: 'neutral' }),
    ]);
    expect(sorted.map((m) => m.id)).toEqual(['ncr', 'hold', 'plain', 'good']);
  });

  it('final tiebreak is natural lot-number order', () => {
    const sorted = sortLotsForShell([
      base({ id: 'b', lotNumber: 'LOT-010' }),
      base({ id: 'a', lotNumber: 'LOT-002' }),
    ]);
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const input = [base({ id: 'a', checksDue: 0 }), base({ id: 'b', checksDue: 9 })];
    const copy = [...input];
    sortLotsForShell(input);
    expect(input.map((m) => m.id)).toEqual(copy.map((m) => m.id));
  });
});

// ── disposition + resolved ────────────────────────────────────────────────────

describe('itpCompletionDisposition / isItpItemResolved', () => {
  it('undefined → pending, not resolved', () => {
    expect(itpCompletionDisposition(undefined)).toBe('pending');
    expect(isItpItemResolved(undefined)).toBe(false);
  });
  it('completed / na / failed are resolved', () => {
    expect(itpCompletionDisposition(makeCompletion({ isCompleted: true }))).toBe('completed');
    expect(itpCompletionDisposition(makeCompletion({ isNotApplicable: true }))).toBe('na');
    expect(itpCompletionDisposition(makeCompletion({ isFailed: true }))).toBe('failed');
    expect(isItpItemResolved(makeCompletion({ isCompleted: true }))).toBe(true);
    expect(isItpItemResolved(makeCompletion({ isNotApplicable: true }))).toBe(true);
    expect(isItpItemResolved(makeCompletion({ isFailed: true }))).toBe(true);
  });
  it('N/A beats completed when backend returns both flags', () => {
    const completion = makeCompletion({ isCompleted: true, isNotApplicable: true });
    expect(itpCompletionDisposition(completion)).toBe('na');
    const p = runProgress([makeItem({ id: 'item-1' })], [completion], 0);
    expect(p.completed).toBe(0);
    expect(p.notApplicable).toBe(1);
    expect(p.accepted).toBe(1);
  });
  it('a bare completion with no flags is pending', () => {
    expect(isItpItemResolved(makeCompletion())).toBe(false);
  });
  it('pending-verification and rejected submissions are not resolved', () => {
    const pendingReview = makeCompletion({
      isCompleted: true,
      isPendingVerification: true,
      verificationStatus: 'pending_verification',
    });
    const rejected = makeCompletion({
      isCompleted: true,
      isRejected: true,
      verificationStatus: 'rejected',
    });

    expect(itpCompletionDisposition(pendingReview)).toBe('review');
    expect(isItpItemResolved(pendingReview)).toBe(false);
    expect(isItpItemActionable(pendingReview)).toBe(false);
    expect(itpCompletionDisposition(rejected)).toBe('rejected');
    expect(isItpItemResolved(rejected)).toBe(false);
    expect(isItpItemActionable(rejected)).toBe(true);
  });
});

// ── runItemOrder ──────────────────────────────────────────────────────────────

describe('runItemOrder', () => {
  it('sorts by order ascending', () => {
    const items = [
      makeItem({ id: 'c', order: 2 }),
      makeItem({ id: 'a', order: 0 }),
      makeItem({ id: 'b', order: 1 }),
    ];
    expect(runItemOrder(items).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
  it('is stable for equal orders (keeps source sequence)', () => {
    const items = [
      makeItem({ id: 'x', order: 1 }),
      makeItem({ id: 'y', order: 1 }),
      makeItem({ id: 'z', order: 1 }),
    ];
    expect(runItemOrder(items).map((i) => i.id)).toEqual(['x', 'y', 'z']);
  });
  it('does not mutate input', () => {
    const items = [makeItem({ id: 'b', order: 1 }), makeItem({ id: 'a', order: 0 })];
    runItemOrder(items);
    expect(items.map((i) => i.id)).toEqual(['b', 'a']);
  });
});

// ── firstIncompleteIndex ──────────────────────────────────────────────────────

describe('firstIncompleteIndex', () => {
  const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' }), makeItem({ id: 'c' })];

  it('returns 0 when nothing is done', () => {
    expect(firstIncompleteIndex(items, [])).toBe(0);
  });
  it('skips resolved leading items', () => {
    const completions = [makeCompletion({ checklistItemId: 'a', isCompleted: true })];
    expect(firstIncompleteIndex(items, completions)).toBe(1);
  });
  it('skips an item awaiting verification when actionable work remains', () => {
    const completions = [
      makeCompletion({
        checklistItemId: 'a',
        isCompleted: true,
        verificationStatus: 'pending_verification',
      }),
      makeCompletion({ checklistItemId: 'b', isCompleted: true }),
    ];
    expect(firstIncompleteIndex(items, completions)).toBe(2);
  });
  it('lands on an item awaiting verification when no actionable work remains', () => {
    const completions = [
      makeCompletion({
        checklistItemId: 'a',
        isCompleted: true,
        verificationStatus: 'pending_verification',
      }),
      makeCompletion({ checklistItemId: 'b', isCompleted: true }),
      makeCompletion({ checklistItemId: 'c', isCompleted: true }),
    ];
    expect(firstIncompleteIndex(items, completions)).toBe(0);
  });
  it('returns -1 when all resolved', () => {
    const completions = items.map((i) =>
      makeCompletion({ checklistItemId: i.id, isCompleted: true }),
    );
    expect(firstIncompleteIndex(items, completions)).toBe(-1);
  });
});

// ── advanceToNextIncomplete ───────────────────────────────────────────────────

describe('advanceToNextIncomplete', () => {
  const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' }), makeItem({ id: 'c' })];

  it('moves forward to the next pending item', () => {
    expect(advanceToNextIncomplete(items, [], 0)).toBe(1);
  });
  it('skips an already-resolved next item', () => {
    const completions = [makeCompletion({ checklistItemId: 'b', isCompleted: true })];
    expect(advanceToNextIncomplete(items, completions, 0)).toBe(2);
  });
  it('wraps backward to an earlier pending item when tail is done', () => {
    const completions = [makeCompletion({ checklistItemId: 'c', isCompleted: true })];
    // From index 2 (just-resolved c), wrap to a (0).
    expect(advanceToNextIncomplete(items, completions, 2)).toBe(0);
  });
  it('skips pending-review rows while actionable work remains', () => {
    const completions = [
      makeCompletion({
        checklistItemId: 'b',
        isCompleted: true,
        verificationStatus: 'pending_verification',
      }),
    ];
    expect(advanceToNextIncomplete(items, completions, 0)).toBe(2);
  });
  it('returns pending-review rows when they are the only unresolved work left', () => {
    const completions = [
      makeCompletion({ checklistItemId: 'a', isCompleted: true }),
      makeCompletion({
        checklistItemId: 'b',
        isCompleted: true,
        verificationStatus: 'pending_verification',
      }),
      makeCompletion({ checklistItemId: 'c', isCompleted: true }),
    ];
    expect(advanceToNextIncomplete(items, completions, 0)).toBe(1);
  });
  it('returns -1 when everything is resolved', () => {
    const completions = items.map((i) =>
      makeCompletion({ checklistItemId: i.id, isCompleted: true }),
    );
    expect(advanceToNextIncomplete(items, completions, 1)).toBe(-1);
  });
  it('returns -1 for an empty run', () => {
    expect(advanceToNextIncomplete([], [], 0)).toBe(-1);
  });
});

// ── runProgress ───────────────────────────────────────────────────────────────

describe('runProgress', () => {
  const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' }), makeItem({ id: 'c' })];

  it('counts resolved + reports allDone', () => {
    const completions = items.map((i) =>
      makeCompletion({ checklistItemId: i.id, isCompleted: true }),
    );
    const p = runProgress(items, completions, 0);
    expect(p.resolved).toBe(3);
    expect(p.accepted).toBe(3);
    expect(p.total).toBe(3);
    expect(p.allDone).toBe(true);
  });
  it('counts failed checks as resolved but not accepted', () => {
    const completions = [
      makeCompletion({ checklistItemId: 'a', isCompleted: true }),
      makeCompletion({ checklistItemId: 'b', isFailed: true }),
      makeCompletion({ checklistItemId: 'c', isNotApplicable: true }),
    ];
    const p = runProgress(items, completions, 0);
    expect(p.resolved).toBe(3);
    expect(p.accepted).toBe(2);
    expect(p.failed).toBe(1);
    expect(p.allDone).toBe(true);
    expect(formatItpFinishedCopy(p)).toMatchObject({
      eyebrow: 'CHECKS REVIEWED',
      title: 'Issues need attention',
      hasFailures: true,
    });
  });
  it('checkNumber is 1-based and clamped', () => {
    expect(runProgress(items, [], 0).checkNumber).toBe(1);
    expect(runProgress(items, [], 2).checkNumber).toBe(3);
    // out-of-range index clamps into [1,total]
    expect(runProgress(items, [], -1).checkNumber).toBe(1);
    expect(runProgress(items, [], 9).checkNumber).toBe(3);
  });
  it('empty run is not allDone', () => {
    expect(runProgress([], [], 0).allDone).toBe(false);
    expect(runProgress([], [], 0).checkNumber).toBe(0);
  });
});

// ── holdPointGateDecision / canCompleteItem ───────────────────────────────────

describe('holdPointGateDecision', () => {
  it('a standard item is always open', () => {
    expect(holdPointGateDecision(makeItem(), undefined).kind).toBe('open');
  });

  it('a witness item is NOT gated (witness is not a hard blocker)', () => {
    const witness = makeItem({ pointType: 'witness' });
    expect(holdPointGateDecision(witness, undefined).kind).toBe('open');
  });

  it('a superintendent witness item is open (witness exception)', () => {
    const item = makeItem({ responsibleParty: 'superintendent', pointType: 'witness' });
    expect(holdPointGateDecision(item, undefined).kind).toBe('open');
  });

  it('an un-released hold point is awaiting-release', () => {
    const hp = makeItem({ pointType: 'hold_point', isHoldPoint: true });
    expect(holdPointGateDecision(hp, undefined).kind).toBe('awaiting-release');
    // a completion that exists but has no release attribution is still awaiting
    expect(holdPointGateDecision(hp, makeCompletion()).kind).toBe('awaiting-release');
  });

  it('a released hold point is releasable/completable', () => {
    const hp = makeItem({ pointType: 'hold_point', isHoldPoint: true });
    const released = makeCompletion({
      holdPointRelease: {
        releasedByName: 'Super',
        releasedByOrg: 'Council',
        releaseMethod: 'email',
        releasedAt: '2026-06-11',
      },
    });
    expect(holdPointGateDecision(hp, released).kind).toBe('released');
  });

  it('a superintendent non-witness item is gated like a hold point', () => {
    const item = makeItem({ responsibleParty: 'superintendent', pointType: 'standard' });
    expect(holdPointGateDecision(item, undefined).kind).toBe('awaiting-release');
  });

  it('canCompleteItem is false only for awaiting-release', () => {
    const hp = makeItem({ pointType: 'hold_point' });
    expect(canCompleteItem(hp, undefined)).toBe(false);
    expect(canCompleteItem(makeItem(), undefined)).toBe(true);
    expect(canCompleteItem(makeItem({ pointType: 'witness' }), undefined)).toBe(true);
  });
});

// ── itpHubSummary ─────────────────────────────────────────────────────────────

describe('itpHubSummary', () => {
  function makeInstance(items: ITPChecklistItem[], completions: ITPCompletion[]): ITPInstance {
    return {
      id: 'inst-1',
      template: { id: 't1', name: 'Earthworks ITP', checklistItems: items },
      completions,
    };
  }

  it('null instance → totals 0, due passed through', () => {
    expect(itpHubSummary(null, 4)).toEqual(makeSummary({ due: 4 }));
  });
  it('counts accepted and failed separately', () => {
    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' }), makeItem({ id: 'c' })];
    const completions = [
      makeCompletion({ checklistItemId: 'a', isCompleted: true }),
      makeCompletion({ checklistItemId: 'b', isFailed: true }),
    ];
    const s = itpHubSummary(makeInstance(items, completions), 1);
    expect(s.total).toBe(3);
    expect(s.resolved).toBe(2);
    expect(s.accepted).toBe(1);
    expect(s.failed).toBe(1);
    expect(s.due).toBe(1);
    expect(formatItpOutcomeSummary(s)).toBe(
      '1 passed check · 1 failed check · 1 check not started',
    );
  });
  it('clamps negative due to 0', () => {
    expect(itpHubSummary(null, -3).due).toBe(0);
  });
});

// ── deriveLotReadinessLine ────────────────────────────────────────────────────

describe('deriveLotReadinessLine', () => {
  it('no ITP → honest "no ITP" line, not conformable', () => {
    const r = deriveLotReadinessLine(makeSummary(), 0);
    expect(r.conformable).toBe(false);
    expect(r.summary).toMatch(/No ITP/i);
  });
  it('all done + no issues → conformable', () => {
    const r = deriveLotReadinessLine(makeSummary({ total: 5, resolved: 5, accepted: 5 }), 0);
    expect(r.conformable).toBe(true);
    expect(r.remainingItp).toBe(0);
    expect(r.summary).toMatch(/ready for the office/i);
  });
  it('remaining ITP keeps it non-conformable', () => {
    const r = deriveLotReadinessLine(makeSummary({ total: 5, resolved: 3, accepted: 3 }), 0);
    expect(r.conformable).toBe(false);
    expect(r.remainingItp).toBe(2);
    expect(r.summary).toMatch(/2 checks left/i);
  });
  it('failed ITP items remain blockers even though the run is resolved', () => {
    const r = deriveLotReadinessLine(
      makeSummary({ total: 3, resolved: 3, accepted: 2, completed: 2, failed: 1 }),
      1,
    );
    expect(r.conformable).toBe(false);
    expect(r.remainingItp).toBe(1);
    expect(r.summary).toMatch(/1 failed check to resolve/i);
    expect(r.summary).toMatch(/1 open issue/i);
  });
  it('open issues block conformance even when ITP is done', () => {
    const r = deriveLotReadinessLine(makeSummary({ total: 5, resolved: 5, accepted: 5 }), 2);
    expect(r.conformable).toBe(false);
    expect(r.summary).toMatch(/2 open issues/i);
  });
  it('singular grammar for 1 check / 1 issue', () => {
    const r = deriveLotReadinessLine(makeSummary({ total: 5, resolved: 4, accepted: 4 }), 1);
    expect(r.summary).toMatch(/1 check left/);
    expect(r.summary).toMatch(/1 open issue/);
    expect(r.summary).not.toMatch(/checks left/);
  });
});

import { describe, expect, it } from 'vitest';
import { PENDING_TEST_RESULT_STATUSES } from '../testResultStatus.js';
import type { NcrRow } from './predicates.js';
import {
  holdPointOverdue,
  holdPointReleased,
  holdPointStagnant,
  holdPointTerminal,
  lotClaimEligible,
  lotConformable,
  ncrOpen,
  ncrOverdue,
  ncrSerious,
  ncrSeriousByCategory,
  ncrSeriousIncludingCritical,
  testMatchesItem,
  testPassing,
  testPendingByStatus,
  testPendingNotFailNotVerified,
} from './predicates.js';

// A fixed clock so time-relative predicates are deterministic.
const NOW = new Date('2026-07-24T12:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

// The full set of hold-point statuses seen in the schema/app.
const HOLD_POINT_STATUSES = [
  'pending',
  'notified',
  'requested',
  'scheduled',
  'released',
  'completed',
] as const;

describe('hold-point predicates', () => {
  describe('holdPointReleased vs holdPointTerminal (truth table)', () => {
    it.each(HOLD_POINT_STATUSES)('status=%s', (status) => {
      const released = holdPointReleased({ status });
      const terminal = holdPointTerminal({ status });
      expect(released).toBe(status === 'released');
      expect(terminal).toBe(status === 'released' || status === 'completed');
    });

    it('DIVERGES only on status="completed": released=false, terminal=true', () => {
      expect(holdPointReleased({ status: 'completed' })).toBe(false);
      expect(holdPointTerminal({ status: 'completed' })).toBe(true);
    });

    it('agrees on every other status', () => {
      for (const status of HOLD_POINT_STATUSES) {
        if (status === 'completed') continue;
        expect(holdPointReleased({ status })).toBe(holdPointTerminal({ status }));
      }
    });
  });

  describe('holdPointOverdue (alert engine: requested|scheduled ∧ scheduledDate < now-1d)', () => {
    it('true for requested/scheduled with a stale scheduledDate', () => {
      expect(holdPointOverdue({ status: 'requested', scheduledDate: daysAgo(2) }, NOW)).toBe(true);
      expect(holdPointOverdue({ status: 'scheduled', scheduledDate: daysAgo(2) }, NOW)).toBe(true);
    });
    it('false when scheduledDate is within the 1-day grace window', () => {
      expect(holdPointOverdue({ status: 'requested', scheduledDate: daysAgo(0.5) }, NOW)).toBe(
        false,
      );
    });
    it('false when scheduledDate is missing', () => {
      expect(holdPointOverdue({ status: 'requested', scheduledDate: null }, NOW)).toBe(false);
    });
    it('false for statuses outside {requested,scheduled}', () => {
      for (const status of HOLD_POINT_STATUSES) {
        if (status === 'requested' || status === 'scheduled') continue;
        expect(holdPointOverdue({ status, scheduledDate: daysAgo(30) }, NOW)).toBe(false);
      }
    });
  });

  describe('holdPointStagnant (dashboards: pending|scheduled|requested ∧ createdAt < now-7d)', () => {
    it('true for pending/scheduled/requested older than 7 days', () => {
      for (const status of ['pending', 'scheduled', 'requested'] as const) {
        expect(holdPointStagnant({ status, createdAt: daysAgo(8) }, NOW)).toBe(true);
      }
    });
    it('false when created within 7 days', () => {
      expect(holdPointStagnant({ status: 'pending', createdAt: daysAgo(3) }, NOW)).toBe(false);
    });
    it('false for statuses outside the stagnant set', () => {
      for (const status of HOLD_POINT_STATUSES) {
        if ((['pending', 'scheduled', 'requested'] as readonly string[]).includes(status)) continue;
        expect(holdPointStagnant({ status, createdAt: daysAgo(30) }, NOW)).toBe(false);
      }
    });
  });

  describe('holdPointOverdue vs holdPointStagnant DIVERGENCE (exact inputs)', () => {
    it('status="pending": overdue always false, stagnant true when old', () => {
      const hp = { status: 'pending', scheduledDate: daysAgo(30), createdAt: daysAgo(30) };
      expect(holdPointOverdue(hp, NOW)).toBe(false);
      expect(holdPointStagnant(hp, NOW)).toBe(true);
    });
    it('requested, scheduledDate old but createdAt recent: overdue true, stagnant false', () => {
      const hp = { status: 'requested', scheduledDate: daysAgo(5), createdAt: daysAgo(1) };
      expect(holdPointOverdue(hp, NOW)).toBe(true);
      expect(holdPointStagnant(hp, NOW)).toBe(false);
    });
    it('requested, createdAt old but scheduledDate recent: overdue false, stagnant true', () => {
      const hp = { status: 'requested', scheduledDate: daysAgo(0.5), createdAt: daysAgo(10) };
      expect(holdPointOverdue(hp, NOW)).toBe(false);
      expect(holdPointStagnant(hp, NOW)).toBe(true);
    });
    it('requested, 3 days old on both columns: overdue true (>1d), stagnant false (<7d)', () => {
      const hp = { status: 'requested', scheduledDate: daysAgo(3), createdAt: daysAgo(3) };
      expect(holdPointOverdue(hp, NOW)).toBe(true);
      expect(holdPointStagnant(hp, NOW)).toBe(false);
    });
  });
});

describe('test predicates', () => {
  const PASS_FAILS = ['pending', 'pass', 'fail'] as const;
  const TEST_STATUSES = [
    'pending',
    'submitted',
    'requested',
    'at_lab',
    'results_received',
    'entered',
    'verified',
    'rejected',
    '',
  ] as const;

  describe('testPassing (pass ∧ verified)', () => {
    it('true only for pass+verified', () => {
      for (const passFail of PASS_FAILS) {
        for (const status of TEST_STATUSES) {
          expect(testPassing({ passFail, status })).toBe(
            passFail === 'pass' && status === 'verified',
          );
        }
      }
    });
  });

  describe('testPendingByStatus vs testPendingNotFailNotVerified (full truth table + divergence)', () => {
    const divergences: Array<{ passFail: string; status: string }> = [];
    for (const passFail of PASS_FAILS) {
      for (const status of TEST_STATUSES) {
        it(`passFail=${passFail} status=${status || '(empty)'}`, () => {
          const byStatus = testPendingByStatus({ passFail, status });
          const notFail = testPendingNotFailNotVerified({ passFail, status });
          // Anchor each variant against its literal definition.
          expect(byStatus).toBe(
            (PENDING_TEST_RESULT_STATUSES as readonly string[]).includes(status),
          );
          expect(notFail).toBe(passFail !== 'fail' && status !== 'verified');
          if (byStatus !== notFail) divergences.push({ passFail, status });
        });
      }
    }

    it('the two variants disagree on exactly the documented edge inputs', () => {
      // (a) a FAILED test in a whitelisted status: byStatus TRUE, variant FALSE.
      expect(testPendingByStatus({ passFail: 'fail', status: 'entered' })).toBe(true);
      expect(testPendingNotFailNotVerified({ passFail: 'fail', status: 'entered' })).toBe(false);
      // (b) a non-fail test in a non-whitelisted, non-verified status: byStatus
      //     FALSE, variant TRUE.
      expect(testPendingByStatus({ passFail: 'pending', status: 'rejected' })).toBe(false);
      expect(testPendingNotFailNotVerified({ passFail: 'pending', status: 'rejected' })).toBe(true);
      expect(testPendingByStatus({ passFail: 'pass', status: '' })).toBe(false);
      expect(testPendingNotFailNotVerified({ passFail: 'pass', status: '' })).toBe(true);
    });
  });

  describe('testMatchesItem (direct link OR case-insensitive testType)', () => {
    it('matches on direct itpChecklistItemId link', () => {
      expect(
        testMatchesItem(
          { id: 'item-1', testType: null },
          { itpChecklistItemId: 'item-1', testType: 'x' },
        ),
      ).toBe(true);
    });
    it('matches on normalized testType when no direct link', () => {
      expect(
        testMatchesItem(
          { id: 'item-1', testType: 'Compaction' },
          { itpChecklistItemId: null, testType: ' compaction ' },
        ),
      ).toBe(true);
    });
    it('does not match on empty/mismatched testType with no link', () => {
      expect(
        testMatchesItem({ id: 'item-1', testType: '' }, { itpChecklistItemId: null, testType: '' }),
      ).toBe(false);
      expect(
        testMatchesItem(
          { id: 'item-1', testType: 'compaction' },
          { itpChecklistItemId: 'other', testType: 'moisture' },
        ),
      ).toBe(false);
    });
  });
});

describe('NCR predicates', () => {
  const NCR_STATUSES = [
    'open',
    'investigating',
    'rectification',
    'verification',
    'closed',
    'closed_concession',
  ] as const;

  describe('ncrOpen (notIn closed/closed_concession)', () => {
    it.each(NCR_STATUSES)('status=%s', (status) => {
      expect(ncrOpen({ status })).toBe(status !== 'closed' && status !== 'closed_concession');
    });
  });

  describe('ncrOverdue (open ∧ dueDate < now)', () => {
    it('true for an open NCR past its due date', () => {
      expect(ncrOverdue({ status: 'open', dueDate: daysAgo(1) }, NOW)).toBe(true);
    });
    it('false for a closed NCR even if past due', () => {
      expect(ncrOverdue({ status: 'closed', dueDate: daysAgo(10) }, NOW)).toBe(false);
    });
    it('false when not yet due or no due date', () => {
      expect(ncrOverdue({ status: 'open', dueDate: daysFromNow(1) }, NOW)).toBe(false);
      expect(ncrOverdue({ status: 'open', dueDate: null }, NOW)).toBe(false);
    });
  });

  describe('seriousness — 3 named variants (severity vs severity+critical vs category)', () => {
    it('ncrSerious: severity === "major" only', () => {
      expect(ncrSerious({ severity: 'major' })).toBe(true);
      expect(ncrSerious({ severity: 'minor' })).toBe(false);
      expect(ncrSerious({ severity: 'critical' })).toBe(false);
    });

    it('ncrSerious vs ncrSeriousIncludingCritical DIVERGE on severity="critical"', () => {
      expect(ncrSerious({ severity: 'critical' })).toBe(false);
      expect(ncrSeriousIncludingCritical({ severity: 'critical' })).toBe(true);
      // agree on major/minor
      expect(ncrSeriousIncludingCritical({ severity: 'major' })).toBe(true);
      expect(ncrSeriousIncludingCritical({ severity: 'minor' })).toBe(false);
    });

    it('ncrSerious vs ncrSeriousByCategory DIVERGE when severity and category disagree', () => {
      // Typed row so the combined severity+category shape reaches both predicates
      // (each Picks a different field) without excess-property complaints.
      const majorSevOtherCat: NcrRow = {
        status: 'open',
        severity: 'major',
        category: 'workmanship',
      };
      const minorSevMajorCat: NcrRow = { status: 'open', severity: 'minor', category: 'major' };
      // major severity but non-major category → severity-based TRUE, category-based FALSE
      expect(ncrSerious(majorSevOtherCat)).toBe(true);
      expect(ncrSeriousByCategory(majorSevOtherCat)).toBe(false);
      // minor severity but category tagged 'major' → severity-based FALSE, category-based TRUE
      expect(ncrSerious(minorSevMajorCat)).toBe(false);
      expect(ncrSeriousByCategory(minorSevMajorCat)).toBe(true);
    });
  });
});

describe('lot composites', () => {
  const base = {
    itpAssigned: true,
    itpCompleted: true,
    testRequired: false,
    hasPassingTest: false,
    noOpenNcrs: true,
    noNaHoldPointBypass: true,
  };

  describe('lotConformable (canConform composition)', () => {
    it('true when all gates pass and no test required', () => {
      expect(lotConformable(base)).toBe(true);
    });
    it('requires a passing test only when testRequired', () => {
      expect(lotConformable({ ...base, testRequired: true, hasPassingTest: false })).toBe(false);
      expect(lotConformable({ ...base, testRequired: true, hasPassingTest: true })).toBe(true);
    });
    it('blocks on each individual failing gate', () => {
      expect(lotConformable({ ...base, itpAssigned: false })).toBe(false);
      expect(lotConformable({ ...base, itpCompleted: false })).toBe(false);
      expect(lotConformable({ ...base, noOpenNcrs: false })).toBe(false);
      expect(lotConformable({ ...base, noNaHoldPointBypass: false })).toBe(false);
    });
    it('defaults missing noNaHoldPointBypass to true (back-compat)', () => {
      const { noNaHoldPointBypass: _omit, ...withoutBypass } = base;
      expect(lotConformable(withoutBypass)).toBe(true);
    });
  });

  describe('lotClaimEligible (mirrors buildClaimItems blocksAction gates)', () => {
    const claimBase = {
      status: 'conformed',
      claimedInId: null,
      conformanceBlockingReasons: [] as string[],
      canViewCommercial: true,
      budgetAmount: 100,
    };
    it('true for a conformed, unclaimed, unregressed, budgeted lot', () => {
      expect(lotClaimEligible(claimBase)).toBe(true);
    });
    it('false when already claimed (status or claimedInId)', () => {
      expect(lotClaimEligible({ ...claimBase, status: 'claimed' })).toBe(false);
      expect(lotClaimEligible({ ...claimBase, claimedInId: 'claim-1' })).toBe(false);
    });
    it('false when not conformed', () => {
      expect(lotClaimEligible({ ...claimBase, status: 'in_progress' })).toBe(false);
    });
    it('false when conformance has regressed', () => {
      expect(lotClaimEligible({ ...claimBase, conformanceBlockingReasons: ['1 open NCR'] })).toBe(
        false,
      );
    });
    it('false when commercial viewer sees a missing budget; true for non-commercial', () => {
      expect(lotClaimEligible({ ...claimBase, budgetAmount: null })).toBe(false);
      expect(lotClaimEligible({ ...claimBase, budgetAmount: null, canViewCommercial: false })).toBe(
        true,
      );
    });
  });
});

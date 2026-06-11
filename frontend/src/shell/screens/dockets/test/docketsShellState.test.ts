/**
 * Tests for docketsShellState — the pure filter/sort/label/validation logic that
 * backs the Dockets approval shell.
 */
import { describe, it, expect } from 'vitest';
import type { Docket } from '@/pages/dockets/docketApprovalsData';
import {
  DOCKET_FILTERS,
  approveButtonLabel,
  docketStatusLabel,
  docketStatusTone,
  filterSubmittedDockets,
  formatHours,
  isReasonValid,
  pendingDocketCount,
  sortDocketsForShell,
} from '../docketsShellState';

function makeDocket(over: Partial<Docket>): Docket {
  return {
    id: 'd1',
    docketNumber: 'DKT-0001',
    subcontractor: 'CivilWorx',
    subcontractorId: 's1',
    date: '2026-06-10',
    status: 'pending_approval',
    notes: null,
    labourHours: 8,
    plantHours: 4,
    totalLabourSubmitted: 8,
    totalLabourApproved: 0,
    totalPlantSubmitted: 4,
    totalPlantApproved: 0,
    submittedAt: '2026-06-10T08:00:00Z',
    approvedAt: null,
    foremanNotes: null,
    ...over,
  };
}

describe('filterSubmittedDockets', () => {
  const dockets = [
    makeDocket({ id: 'draft', status: 'draft' }),
    makeDocket({ id: 'p', status: 'pending_approval' }),
    makeDocket({ id: 'a', status: 'approved' }),
    makeDocket({ id: 'r', status: 'rejected' }),
  ];

  it('always excludes drafts from every view', () => {
    expect(filterSubmittedDockets(dockets, 'all').some((d) => d.status === 'draft')).toBe(false);
  });

  it('"all" returns every submitted docket', () => {
    expect(filterSubmittedDockets(dockets, 'all')).toHaveLength(3);
  });

  it('a status filter returns only that status', () => {
    const pending = filterSubmittedDockets(dockets, 'pending_approval');
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('p');
  });
});

describe('pendingDocketCount', () => {
  it('counts only pending_approval', () => {
    expect(
      pendingDocketCount([
        makeDocket({ status: 'pending_approval' }),
        makeDocket({ status: 'pending_approval' }),
        makeDocket({ status: 'approved' }),
      ]),
    ).toBe(2);
  });
});

describe('sortDocketsForShell', () => {
  it('orders pending-first, then queried, rejected, approved', () => {
    const sorted = sortDocketsForShell([
      makeDocket({ id: 'approved', status: 'approved' }),
      makeDocket({ id: 'rejected', status: 'rejected' }),
      makeDocket({ id: 'pending', status: 'pending_approval' }),
      makeDocket({ id: 'queried', status: 'queried' }),
    ]);
    expect(sorted.map((d) => d.id)).toEqual(['pending', 'queried', 'rejected', 'approved']);
  });

  it('within a status, newest submission first', () => {
    const sorted = sortDocketsForShell([
      makeDocket({ id: 'older', submittedAt: '2026-06-09T08:00:00Z' }),
      makeDocket({ id: 'newer', submittedAt: '2026-06-10T08:00:00Z' }),
    ]);
    expect(sorted.map((d) => d.id)).toEqual(['newer', 'older']);
  });

  it('does not mutate the input array', () => {
    const input = [makeDocket({ id: 'a' }), makeDocket({ id: 'b' })];
    const copy = [...input];
    sortDocketsForShell(input);
    expect(input).toEqual(copy);
  });
});

describe('approveButtonLabel', () => {
  it('embeds submitted labour + plant hours, matching the mock', () => {
    expect(approveButtonLabel({ labourHours: 48, plantHours: 16 })).toBe(
      'Approve — 48 labour + 16 plant',
    );
  });

  it('handles zero hours', () => {
    expect(approveButtonLabel({ labourHours: 0, plantHours: 0 })).toBe(
      'Approve — 0 labour + 0 plant',
    );
  });
});

describe('formatHours', () => {
  it('keeps whole numbers clean', () => {
    expect(formatHours(48)).toBe('48');
  });
  it('keeps decimals', () => {
    expect(formatHours(7.5)).toBe('7.5');
  });
  it('guards non-finite', () => {
    expect(formatHours(Number.NaN)).toBe('0');
  });
});

describe('status label + tone', () => {
  it('labels each status', () => {
    expect(docketStatusLabel('pending_approval')).toBe('Pending');
    expect(docketStatusLabel('approved')).toBe('Approved');
    expect(docketStatusLabel('rejected')).toBe('Rejected');
    expect(docketStatusLabel('queried')).toBe('Queried');
  });
  it('tones map sensibly', () => {
    expect(docketStatusTone('pending_approval')).toBe('attention');
    expect(docketStatusTone('queried')).toBe('attention');
    expect(docketStatusTone('rejected')).toBe('bad');
    expect(docketStatusTone('approved')).toBe('good');
  });
});

describe('isReasonValid', () => {
  it('rejects empty / whitespace', () => {
    expect(isReasonValid('')).toBe(false);
    expect(isReasonValid('   ')).toBe(false);
  });
  it('accepts real text', () => {
    expect(isReasonValid('Wrong rate')).toBe(true);
  });
});

describe('DOCKET_FILTERS', () => {
  it('is pending-first and contains the four shell filters', () => {
    expect(DOCKET_FILTERS.map((f) => f.key)).toEqual([
      'pending_approval',
      'approved',
      'rejected',
      'all',
    ]);
  });
});

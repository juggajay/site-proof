/**
 * Exhaustive unit tests for the pure Issues-shell state helpers: filter
 * semantics, open count, open-first ordering, pill labels/tones, and — critically
 * — the foreman respond-permission rule (research doc 14, BINDING).
 */
import { describe, it, expect } from 'vitest';
import type { NCR } from '@/pages/ncr/types';
import {
  ISSUE_FILTERS,
  canForemanRespond,
  filterIssues,
  isClosedNcr,
  issueSeverityLabel,
  issueSeverityTone,
  issueStatusLabel,
  issueStatusTone,
  openIssueCount,
  sortIssuesForShell,
} from '../issuesShellState';

function makeNcr(over: Partial<NCR>): NCR {
  return {
    id: 'n1',
    ncrNumber: 'NCR-001',
    description: 'Cracked kerb',
    category: 'workmanship',
    severity: 'minor',
    status: 'open',
    qmApprovalRequired: false,
    qmApprovedAt: null,
    raisedBy: { fullName: 'Jay', email: 'jay@x.com' },
    responsibleUserId: null,
    createdAt: '2026-06-10T08:00:00Z',
    project: { name: 'Demo', projectNumber: 'P1' },
    ncrLots: [],
    ...over,
  } as NCR;
}

describe('filter list', () => {
  it('exposes Open / Closed / All in order', () => {
    expect(ISSUE_FILTERS.map((f) => f.key)).toEqual(['open', 'closed', 'all']);
  });
});

describe('isClosedNcr', () => {
  it.each([
    ['open', false],
    ['investigating', false],
    ['rectification', false],
    ['verification', false],
    ['closed', true],
    ['closed_concession', true],
  ] as const)('status %s → closed=%s', (status, expected) => {
    expect(isClosedNcr({ status })).toBe(expected);
  });
});

describe('filterIssues', () => {
  const ncrs = [
    makeNcr({ id: 'o', status: 'open' }),
    makeNcr({ id: 'i', status: 'investigating' }),
    makeNcr({ id: 'c', status: 'closed' }),
    makeNcr({ id: 'cc', status: 'closed_concession' }),
  ];

  it('open shows every non-closed NCR', () => {
    expect(filterIssues(ncrs, 'open').map((n) => n.id)).toEqual(['o', 'i']);
  });
  it('closed shows terminal NCRs', () => {
    expect(filterIssues(ncrs, 'closed').map((n) => n.id)).toEqual(['c', 'cc']);
  });
  it('all shows everything', () => {
    expect(filterIssues(ncrs, 'all')).toHaveLength(4);
  });
  it('returns a new array (no mutation)', () => {
    const out = filterIssues(ncrs, 'all');
    expect(out).not.toBe(ncrs);
  });
});

describe('openIssueCount', () => {
  it('counts only non-closed NCRs', () => {
    expect(
      openIssueCount([
        makeNcr({ status: 'open' }),
        makeNcr({ status: 'verification' }),
        makeNcr({ status: 'closed' }),
      ]),
    ).toBe(2);
  });
  it('is 0 for an empty list', () => {
    expect(openIssueCount([])).toBe(0);
  });
});

describe('sortIssuesForShell', () => {
  it('orders open-first, then newest within a status, NCR-number tiebreak', () => {
    const out = sortIssuesForShell([
      makeNcr({ id: 'closed', ncrNumber: 'NCR-009', status: 'closed' }),
      makeNcr({
        id: 'open-old',
        ncrNumber: 'NCR-001',
        status: 'open',
        createdAt: '2026-06-01T00:00:00Z',
      }),
      makeNcr({
        id: 'open-new',
        ncrNumber: 'NCR-002',
        status: 'open',
        createdAt: '2026-06-09T00:00:00Z',
      }),
      makeNcr({ id: 'inv', ncrNumber: 'NCR-003', status: 'investigating' }),
    ]);
    expect(out.map((n) => n.id)).toEqual(['open-new', 'open-old', 'inv', 'closed']);
  });
  it('does not mutate the input', () => {
    const input = [makeNcr({ id: 'a' }), makeNcr({ id: 'b' })];
    const copy = [...input];
    sortIssuesForShell(input);
    expect(input).toEqual(copy);
  });
});

describe('pill labels + tones', () => {
  it('status labels are human-readable', () => {
    expect(issueStatusLabel('open')).toBe('Open');
    expect(issueStatusLabel('closed_concession')).toBe('Closed (concession)');
    expect(issueStatusLabel('weird')).toBe('weird');
  });
  it('open reads bad, workflow reads attention, closed reads good', () => {
    expect(issueStatusTone('open')).toBe('bad');
    expect(issueStatusTone('investigating')).toBe('attention');
    expect(issueStatusTone('verification')).toBe('attention');
    expect(issueStatusTone('closed')).toBe('good');
    expect(issueStatusTone('closed_concession')).toBe('good');
    expect(issueStatusTone('weird')).toBe('neutral');
  });
  it('severity label + tone: major is bad, minor is neutral', () => {
    expect(issueSeverityLabel('major')).toBe('Major');
    expect(issueSeverityLabel('minor')).toBe('Minor');
    expect(issueSeverityTone('major')).toBe('bad');
    expect(issueSeverityTone('minor')).toBe('neutral');
  });
});

describe('canForemanRespond (BINDING — research doc 14)', () => {
  const me = 'user-me';

  it('TRUE only when foreman is the responsibleUserId on an open NCR', () => {
    expect(canForemanRespond({ responsibleUserId: me, status: 'open' }, me)).toBe(true);
    expect(canForemanRespond({ responsibleUserId: me, status: 'investigating' }, me)).toBe(true);
  });

  it('FALSE when foreman is NOT the responsible user', () => {
    expect(canForemanRespond({ responsibleUserId: 'someone-else', status: 'open' }, me)).toBe(
      false,
    );
  });

  it('FALSE when the NCR has no responsible user', () => {
    expect(canForemanRespond({ responsibleUserId: null, status: 'open' }, me)).toBe(false);
  });

  it('FALSE when there is no current user', () => {
    expect(canForemanRespond({ responsibleUserId: me, status: 'open' }, null)).toBe(false);
    expect(canForemanRespond({ responsibleUserId: me, status: 'open' }, undefined)).toBe(false);
  });

  it('FALSE on a closed NCR even if responsible (foreman never re-opens)', () => {
    expect(canForemanRespond({ responsibleUserId: me, status: 'closed' }, me)).toBe(false);
    expect(canForemanRespond({ responsibleUserId: me, status: 'closed_concession' }, me)).toBe(
      false,
    );
  });
});

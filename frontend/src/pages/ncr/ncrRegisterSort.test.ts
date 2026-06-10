import { describe, expect, it } from 'vitest';
import { nextSortParams, sortNcrs } from './ncrRegisterSort';
import type { NCR } from './types';

function buildNcr(overrides: Partial<NCR> & { id: string }): NCR {
  return {
    ncrNumber: `NCR-${overrides.id}`,
    description: 'Test NCR',
    category: 'workmanship',
    severity: 'minor',
    status: 'open',
    qmApprovalRequired: false,
    qmApprovedAt: null,
    raisedBy: { fullName: 'Inspector', email: 'inspector@example.com' },
    createdAt: '2026-05-01T00:00:00.000Z',
    project: { name: 'Project', projectNumber: 'P-1' },
    ncrLots: [],
    ...overrides,
  };
}

const ids = (ncrs: NCR[]) => ncrs.map((ncr) => ncr.id);

describe('sortNcrs', () => {
  it('keeps the server order when no sort field is set', () => {
    const register = [
      buildNcr({ id: 'b', createdAt: '2026-05-02T00:00:00.000Z' }),
      buildNcr({ id: 'a', createdAt: '2026-05-01T00:00:00.000Z' }),
    ];

    expect(sortNcrs(register, '', 'asc')).toBe(register);
    expect(sortNcrs(register, 'not-a-field', 'desc')).toBe(register);
  });

  it('does not mutate the input array', () => {
    const register = [
      buildNcr({ id: 'b', createdAt: '2026-05-02T00:00:00.000Z' }),
      buildNcr({ id: 'a', createdAt: '2026-05-01T00:00:00.000Z' }),
    ];

    const sorted = sortNcrs(register, 'raised', 'asc');

    expect(ids(sorted)).toEqual(['a', 'b']);
    expect(ids(register)).toEqual(['b', 'a']);
  });

  it('sorts by raised date in both directions', () => {
    const register = [
      buildNcr({ id: 'mid', createdAt: '2026-05-02T00:00:00.000Z' }),
      buildNcr({ id: 'new', createdAt: '2026-05-03T00:00:00.000Z' }),
      buildNcr({ id: 'old', createdAt: '2026-05-01T00:00:00.000Z' }),
    ];

    expect(ids(sortNcrs(register, 'raised', 'asc'))).toEqual(['old', 'mid', 'new']);
    expect(ids(sortNcrs(register, 'raised', 'desc'))).toEqual(['new', 'mid', 'old']);
  });

  it('sorts by due date and keeps undated NCRs last in both directions', () => {
    const register = [
      buildNcr({ id: 'no-due' }),
      buildNcr({ id: 'late', dueDate: '2026-06-20' }),
      buildNcr({ id: 'soon', dueDate: '2026-06-12' }),
    ];

    expect(ids(sortNcrs(register, 'due', 'asc'))).toEqual(['soon', 'late', 'no-due']);
    expect(ids(sortNcrs(register, 'due', 'desc'))).toEqual(['late', 'soon', 'no-due']);
  });

  it('sorts by severity with major above minor when descending', () => {
    const register = [
      buildNcr({ id: 'minor-1', severity: 'minor' }),
      buildNcr({ id: 'major-1', severity: 'major' }),
      buildNcr({ id: 'minor-2', severity: 'minor' }),
    ];

    expect(ids(sortNcrs(register, 'severity', 'desc'))).toEqual(['major-1', 'minor-1', 'minor-2']);
    expect(ids(sortNcrs(register, 'severity', 'asc'))).toEqual(['minor-1', 'minor-2', 'major-1']);
  });

  it('sorts statuses by lifecycle order, not alphabetically', () => {
    const register = [
      buildNcr({ id: 'closed', status: 'closed' }),
      buildNcr({ id: 'verification', status: 'verification' }),
      buildNcr({ id: 'open', status: 'open' }),
      buildNcr({ id: 'concession', status: 'closed_concession' }),
      buildNcr({ id: 'investigating', status: 'investigating' }),
    ];

    // Alphabetical would put closed/closed_concession before investigating/open.
    expect(ids(sortNcrs(register, 'status', 'asc'))).toEqual([
      'open',
      'investigating',
      'verification',
      'closed',
      'concession',
    ]);
  });

  it('sorts unknown statuses after known ones', () => {
    const register = [
      buildNcr({ id: 'mystery', status: 'totally_new_status' }),
      buildNcr({ id: 'open', status: 'open' }),
    ];

    expect(ids(sortNcrs(register, 'status', 'asc'))).toEqual(['open', 'mystery']);
  });
});

describe('nextSortParams', () => {
  it('sorts a newly clicked column ascending', () => {
    expect(nextSortParams('', 'asc', 'due')).toEqual({ sort: 'due', dir: 'asc' });
    expect(nextSortParams('status', 'desc', 'raised')).toEqual({ sort: 'raised', dir: 'asc' });
  });

  it('flips the direction when the active column is clicked again', () => {
    expect(nextSortParams('due', 'asc', 'due')).toEqual({ sort: 'due', dir: 'desc' });
    expect(nextSortParams('due', 'desc', 'due')).toEqual({ sort: 'due', dir: 'asc' });
  });
});

import { describe, expect, it } from 'vitest';
import { buildDocketApprovalsPath, normalizeDockets, type Docket } from './docketApprovalsData';

const baseDocket: Docket = {
  id: 'docket-1',
  docketNumber: 'DKT-001',
  subcontractor: 'QA Civil',
  subcontractorId: 'subbie-1',
  date: '2026-06-03',
  status: 'pending_approval',
  notes: null,
  labourHours: 8,
  plantHours: 2,
  totalLabourSubmitted: 8,
  totalLabourApproved: 8,
  totalPlantSubmitted: 2,
  totalPlantApproved: 2,
  submittedAt: '2026-06-03T01:00:00.000Z',
  approvedAt: null,
  foremanNotes: null,
};

describe('docket approvals data helpers', () => {
  it('normalizes the legacy array response shape', () => {
    expect(normalizeDockets([baseDocket])).toEqual([baseDocket]);
  });

  it('normalizes the wrapped dockets response shape', () => {
    expect(normalizeDockets({ dockets: [baseDocket] })).toEqual([baseDocket]);
  });

  it('treats a wrapped response without dockets as empty', () => {
    expect(normalizeDockets({})).toEqual([]);
  });

  it('builds the unfiltered dockets endpoint when no project is scoped', () => {
    expect(buildDocketApprovalsPath(undefined, 'all')).toBe('/api/dockets');
  });

  it('includes projectId and non-all status filters in the API path', () => {
    expect(buildDocketApprovalsPath('project 1', 'pending_approval')).toBe(
      '/api/dockets?projectId=project+1&status=pending_approval',
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildAssignedLotsPath,
  buildDocketDetailPath,
  buildDocketEditRoute,
  buildExistingDocketsPath,
  buildMyCompanyPath,
  findTodayDocket,
  normalizeAssignedLots,
  normalizeExistingDockets,
  type Docket,
} from './docketEditData';

const baseDocket: Docket = {
  id: 'docket-1',
  docketNumber: 'DKT-001',
  date: '2026-06-03',
  status: 'draft',
  totalLabourSubmitted: 0,
  totalPlantSubmitted: 0,
  labourEntries: [],
  plantEntries: [],
};

describe('docket edit data – path builders', () => {
  it('builds the unscoped my-company path when no project is requested', () => {
    expect(buildMyCompanyPath(null)).toBe('/api/subcontractors/my-company');
  });

  it('encodes the requested project id in the my-company path', () => {
    expect(buildMyCompanyPath('proj 1')).toBe('/api/subcontractors/my-company?projectId=proj%201');
  });

  it('interpolates the project id into the assigned-lots path without encoding', () => {
    // Preserves the original inline behavior, which did not encode the project id.
    expect(buildAssignedLotsPath('proj 1')).toBe('/api/lots?projectId=proj 1');
  });

  it('builds the docket detail path', () => {
    expect(buildDocketDetailPath('docket-1')).toBe('/api/dockets/docket-1');
  });

  it('interpolates the project id into the existing-dockets path without encoding', () => {
    expect(buildExistingDocketsPath('proj 1')).toBe('/api/dockets?projectId=proj 1');
  });
});

describe('docket edit data – route builder', () => {
  it('omits the project query when no project id is supplied', () => {
    expect(buildDocketEditRoute('docket-1')).toBe('/subcontractor-portal/docket/docket-1');
    expect(buildDocketEditRoute('docket-1', null)).toBe('/subcontractor-portal/docket/docket-1');
  });

  it('appends an encoded project query when a project id is supplied', () => {
    expect(buildDocketEditRoute('docket-1', 'proj 1')).toBe(
      '/subcontractor-portal/docket/docket-1?projectId=proj%201',
    );
  });
});

describe('docket edit data – normalizers', () => {
  it('returns the assigned lots array, defaulting to empty', () => {
    expect(normalizeAssignedLots({ lots: [{ id: 'lot-1', lotNumber: 'L1' }] })).toEqual([
      { id: 'lot-1', lotNumber: 'L1' },
    ]);
    expect(normalizeAssignedLots({})).toEqual([]);
  });

  it('returns the existing dockets array, defaulting to empty', () => {
    expect(normalizeExistingDockets({ dockets: [baseDocket] })).toEqual([baseDocket]);
    expect(normalizeExistingDockets({})).toEqual([]);
  });
});

describe('docket edit data – findTodayDocket', () => {
  it('returns the docket whose date matches today', () => {
    const other = { ...baseDocket, id: 'docket-2', date: '2026-06-02' };
    expect(findTodayDocket([other, baseDocket], '2026-06-03')).toBe(baseDocket);
  });

  it('returns undefined when no docket matches today', () => {
    expect(findTodayDocket([baseDocket], '2026-06-04')).toBeUndefined();
    expect(findTodayDocket([], '2026-06-03')).toBeUndefined();
  });
});

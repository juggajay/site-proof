import { describe, expect, it } from 'vitest';
import {
  buildAssignedLotsPath,
  buildDocketDetailPath,
  buildDocketEditRoute,
  buildExistingDocketsPath,
  getDocketDisplayLabourEntryCost,
  getDocketDisplayLabourEntryHours,
  getDocketDisplayLabourCost,
  getDocketDisplayPlantEntryCost,
  getDocketDisplayPlantCost,
  getDocketDisplayTotalCost,
  buildMyCompanyPath,
  findTodayDocket,
  hasDocketLabourEntryAdjustment,
  hasDocketPlantEntryCostAdjustment,
  normalizeAssignedLots,
  normalizeExistingDockets,
  type Docket,
  type LabourEntry,
  type PlantEntry,
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

describe('docket edit data – display costs', () => {
  it('uses submitted costs before approval', () => {
    const docket = {
      ...baseDocket,
      status: 'pending_approval',
      totalLabourSubmitted: 1200,
      totalPlantSubmitted: 300,
      totalLabourApprovedCost: 900,
      totalPlantApprovedCost: 200,
    };

    expect(getDocketDisplayLabourCost(docket)).toBe(1200);
    expect(getDocketDisplayPlantCost(docket)).toBe(300);
    expect(getDocketDisplayTotalCost(docket)).toBe(1500);
  });

  it('uses approved costs after approval', () => {
    const docket = {
      ...baseDocket,
      status: 'approved',
      totalLabourSubmitted: 1200,
      totalPlantSubmitted: 300,
      totalLabourApprovedCost: 900,
      totalPlantApprovedCost: 200,
    };

    expect(getDocketDisplayLabourCost(docket)).toBe(900);
    expect(getDocketDisplayPlantCost(docket)).toBe(200);
    expect(getDocketDisplayTotalCost(docket)).toBe(1100);
  });

  it('falls back to submitted costs for older approved dockets without approved cost fields', () => {
    const docket = {
      ...baseDocket,
      status: 'approved',
      totalLabourSubmitted: 1200,
      totalPlantSubmitted: 300,
      totalLabourApprovedCost: null,
      totalPlantApprovedCost: undefined,
    };

    expect(getDocketDisplayTotalCost(docket)).toBe(1500);
  });
});

describe('docket edit data – display entry costs', () => {
  const labourEntry: LabourEntry = {
    id: 'labour-1',
    employee: {
      id: 'employee-1',
      name: 'Ava Singh',
      role: 'Leading hand',
      hourlyRate: 100,
    },
    startTime: '07:00',
    finishTime: '15:00',
    submittedHours: 8,
    hourlyRate: 100,
    submittedCost: 800,
    approvedHours: 6,
    approvedCost: 600,
    lotAllocations: [],
  };

  const plantEntry: PlantEntry = {
    id: 'plant-entry-1',
    plant: {
      id: 'plant-1',
      type: 'Excavator',
      description: 'CAT 320',
      dryRate: 150,
      wetRate: 180,
    },
    hoursOperated: 4,
    wetOrDry: 'dry',
    hourlyRate: 150,
    submittedCost: 600,
    approvedCost: 450,
  };

  it('uses submitted entry values before approval', () => {
    const docket = { ...baseDocket, status: 'pending_approval' };

    expect(getDocketDisplayLabourEntryHours(docket, labourEntry)).toBe(8);
    expect(getDocketDisplayLabourEntryCost(docket, labourEntry)).toBe(800);
    expect(getDocketDisplayPlantEntryCost(docket, plantEntry)).toBe(600);
    expect(hasDocketLabourEntryAdjustment(docket, labourEntry)).toBe(false);
    expect(hasDocketPlantEntryCostAdjustment(docket, plantEntry)).toBe(false);
  });

  it('uses approved entry values after approval', () => {
    const docket = { ...baseDocket, status: 'approved' };

    expect(getDocketDisplayLabourEntryHours(docket, labourEntry)).toBe(6);
    expect(getDocketDisplayLabourEntryCost(docket, labourEntry)).toBe(600);
    expect(getDocketDisplayPlantEntryCost(docket, plantEntry)).toBe(450);
    expect(hasDocketLabourEntryAdjustment(docket, labourEntry)).toBe(true);
    expect(hasDocketPlantEntryCostAdjustment(docket, plantEntry)).toBe(true);
  });

  it('falls back to submitted entry values for older approved dockets without approved fields', () => {
    const docket = { ...baseDocket, status: 'approved' };
    const legacyLabourEntry = {
      ...labourEntry,
      approvedHours: null,
      approvedCost: undefined,
    };
    const legacyPlantEntry = {
      ...plantEntry,
      approvedCost: null,
    };

    expect(getDocketDisplayLabourEntryHours(docket, legacyLabourEntry)).toBe(8);
    expect(getDocketDisplayLabourEntryCost(docket, legacyLabourEntry)).toBe(800);
    expect(getDocketDisplayPlantEntryCost(docket, legacyPlantEntry)).toBe(600);
    expect(hasDocketLabourEntryAdjustment(docket, legacyLabourEntry)).toBe(false);
    expect(hasDocketPlantEntryCostAdjustment(docket, legacyPlantEntry)).toBe(false);
  });

  it('treats explicit approved zeroes as valid values', () => {
    const docket = { ...baseDocket, status: 'approved' };

    expect(
      getDocketDisplayLabourEntryHours(docket, {
        ...labourEntry,
        approvedHours: 0,
        approvedCost: 0,
      }),
    ).toBe(0);
    expect(
      getDocketDisplayLabourEntryCost(docket, {
        ...labourEntry,
        approvedHours: 0,
        approvedCost: 0,
      }),
    ).toBe(0);
    expect(getDocketDisplayPlantEntryCost(docket, { ...plantEntry, approvedCost: 0 })).toBe(0);
  });
});

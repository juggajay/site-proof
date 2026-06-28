import { describe, expect, it } from 'vitest';

import {
  getApprovedOrSubmittedCost,
  getDocketCommercialCosts,
  splitCostByLotAllocations,
} from './docketCosts.js';

describe('docket cost helpers', () => {
  it('uses approved costs when present, including zero-dollar approvals', () => {
    expect(getApprovedOrSubmittedCost({ approvedCost: '275.50', submittedCost: '400' })).toBe(
      275.5,
    );
    expect(getApprovedOrSubmittedCost({ approvedCost: 0, submittedCost: '400' })).toBe(0);
    expect(getApprovedOrSubmittedCost({ approvedCost: null, submittedCost: '400' })).toBe(400);
  });

  it('returns approved commercial docket costs with submitted-cost fallback', () => {
    expect(
      getDocketCommercialCosts({
        totalLabourSubmitted: '800',
        totalPlantSubmitted: '300',
        totalLabourApprovedCost: '600',
        totalPlantApprovedCost: null,
      }),
    ).toEqual({
      labourCost: 600,
      plantCost: 300,
    });
  });

  it('splits an entry cost across lots by allocation hours', () => {
    expect(
      splitCostByLotAllocations({
        cost: 600,
        allocations: [
          { lotId: 'lot-a', hours: 3 },
          { lotId: 'lot-b', hours: 5 },
        ],
      }),
    ).toEqual([
      { lotId: 'lot-a', cost: 225 },
      { lotId: 'lot-b', cost: 375 },
    ]);
  });

  it('falls back to equal split when legacy allocations have no usable hours', () => {
    expect(
      splitCostByLotAllocations({
        cost: 90,
        allocations: [{ lotId: 'lot-a' }, { lotId: 'lot-b', hours: null }, { lotId: 'lot-c' }],
      }),
    ).toEqual([
      { lotId: 'lot-a', cost: 30 },
      { lotId: 'lot-b', cost: 30 },
      { lotId: 'lot-c', cost: 30 },
    ]);
  });
});

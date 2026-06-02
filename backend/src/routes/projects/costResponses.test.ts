import { describe, expect, it } from 'vitest';

import { buildProjectCostsResponse, buildProjectCreatedResponse } from './costResponses.js';

describe('project cost response helpers', () => {
  it('builds project cost summaries and preserves cost arrays', () => {
    const subcontractorCosts = [
      {
        id: 'sub-1',
        companyName: 'Demo Civil',
        totalCost: 1500,
      },
    ];
    const lotCosts = [
      {
        id: 'lot-1',
        lotNumber: 'EW-001',
        actualCost: 1500,
      },
    ];

    expect(
      buildProjectCostsResponse({
        totalLabourCost: 500,
        totalPlantCost: 1000,
        totalCost: 1500,
        budgetTotal: 2000,
        budgetVariance: 500,
        approvedDockets: 2,
        pendingDockets: 1,
        subcontractorCosts,
        lotCosts,
      }),
    ).toEqual({
      summary: {
        totalLabourCost: 500,
        totalPlantCost: 1000,
        totalCost: 1500,
        budgetTotal: 2000,
        budgetVariance: 500,
        approvedDockets: 2,
        pendingDockets: 1,
      },
      subcontractorCosts,
      lotCosts,
    });
  });

  it('wraps newly-created projects without changing the response key', () => {
    const project = {
      id: 'project-1',
      name: 'Civil Works',
      projectNumber: 'PRJ-001',
    };

    expect(buildProjectCreatedResponse(project)).toEqual({ project });
  });
});

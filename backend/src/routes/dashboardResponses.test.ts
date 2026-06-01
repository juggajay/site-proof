import { describe, expect, it } from 'vitest';
import {
  buildPortfolioCashFlowResponse,
  buildPortfolioNcrsResponse,
  buildProjectsAtRiskResponse,
} from './dashboardResponses.js';

describe('dashboardResponses', () => {
  it('builds portfolio cash flow totals with derived outstanding value', () => {
    expect(buildPortfolioCashFlowResponse(1000, 750, 250)).toEqual({
      totalClaimed: 1000,
      totalCertified: 750,
      totalPaid: 250,
      outstanding: 500,
    });
  });

  it('preserves the empty cash flow response shape', () => {
    expect(buildPortfolioCashFlowResponse(0, 0, 0)).toEqual({
      totalClaimed: 0,
      totalCertified: 0,
      totalPaid: 0,
      outstanding: 0,
    });
  });

  it('builds the portfolio NCR list envelope', () => {
    const ncrs = [{ id: 'ncr-1', category: 'major' }];

    expect(buildPortfolioNcrsResponse(ncrs)).toEqual({ ncrs });
  });

  it('builds the projects-at-risk list envelope', () => {
    const projectsAtRisk = [{ id: 'project-1', riskLevel: 'critical' }];

    expect(buildProjectsAtRiskResponse(projectsAtRisk)).toEqual({ projectsAtRisk });
  });
});

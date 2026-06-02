import { describe, expect, it } from 'vitest';
import {
  buildDashboardStatsResponse,
  buildEmptyDashboardStatsResponse,
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

  it('builds the dashboard stats response and totals attention items', () => {
    expect(
      buildDashboardStatsResponse({
        totalProjects: 3,
        activeProjects: 2,
        totalLots: 12,
        lotStatusCounts: { conformed: 4 },
        openHoldPoints: 5,
        openNCRs: 6,
        overdueNCRs: [{ id: 'ncr-1' }],
        staleHoldPoints: [{ id: 'hp-1' }, { id: 'hp-2' }],
        recentActivities: [{ id: 'activity-1' }],
      }),
    ).toEqual({
      totalProjects: 3,
      activeProjects: 2,
      totalLots: 12,
      lotStatusCounts: { conformed: 4 },
      openHoldPoints: 5,
      openNCRs: 6,
      attentionItems: {
        overdueNCRs: [{ id: 'ncr-1' }],
        staleHoldPoints: [{ id: 'hp-1' }, { id: 'hp-2' }],
        total: 3,
      },
      recentActivities: [{ id: 'activity-1' }],
    });
  });

  it('builds the empty dashboard stats response', () => {
    expect(buildEmptyDashboardStatsResponse({ not_started: 0, conformed: 0 })).toEqual({
      totalProjects: 0,
      activeProjects: 0,
      totalLots: 0,
      lotStatusCounts: { not_started: 0, conformed: 0 },
      openHoldPoints: 0,
      openNCRs: 0,
      attentionItems: {
        overdueNCRs: [],
        staleHoldPoints: [],
        total: 0,
      },
      recentActivities: [],
    });
  });
});

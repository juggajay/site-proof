import { describe, expect, it } from 'vitest';
import {
  buildCostTrendResponse,
  buildDashboardStatsResponse,
  buildEmptyCostTrendResponse,
  buildEmptyDashboardStatsResponse,
  buildEmptyForemanDashboardResponse,
  buildForemanDashboardResponse,
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

  it('builds the cost trend response with rounded running average and date range', () => {
    expect(
      buildCostTrendResponse({
        dailyCosts: [{ date: '2026-06-01', combined: 123.45 }],
        totals: { labour: 100, plant: 50, combined: 150 },
        runningAverage: 12.345,
        subcontractors: [{ id: 'subbie-1', combined: 150 }],
        start: new Date('2026-06-01T10:00:00.000Z'),
        end: new Date('2026-06-10T10:00:00.000Z'),
      }),
    ).toEqual({
      dailyCosts: [{ date: '2026-06-01', combined: 123.45 }],
      totals: { labour: 100, plant: 50, combined: 150 },
      runningAverage: 12.35,
      subcontractors: [{ id: 'subbie-1', combined: 150 }],
      dateRange: {
        start: '2026-06-01',
        end: '2026-06-10',
        daysWithData: 1,
      },
    });
  });

  it('builds the empty cost trend response', () => {
    expect(buildEmptyCostTrendResponse()).toEqual({
      dailyCosts: [],
      totals: { labour: 0, plant: 0, combined: 0 },
      runningAverage: 0,
      subcontractors: [],
    });
  });

  it('builds the empty foreman dashboard response', () => {
    expect(buildEmptyForemanDashboardResponse()).toEqual({
      todayDiary: { exists: false, status: null, id: null },
      pendingDockets: { count: 0, totalLabourHours: 0, totalPlantHours: 0 },
      inspectionsDueToday: { count: 0, items: [] },
      weather: { conditions: null, temperatureMin: null, temperatureMax: null, rainfallMm: null },
      project: null,
    });
  });

  it('builds the foreman dashboard response', () => {
    expect(
      buildForemanDashboardResponse({
        todayDiary: { id: 'diary-1', status: 'submitted' },
        pendingDockets: { count: 2 },
        inspectionItems: [{ id: 'inspection-1' }, { id: 'inspection-2' }],
        weather: { conditions: 'Fine' },
        project: { id: 'project-1' },
      }),
    ).toEqual({
      todayDiary: { exists: true, status: 'submitted', id: 'diary-1' },
      pendingDockets: { count: 2 },
      inspectionsDueToday: {
        count: 2,
        items: [{ id: 'inspection-1' }, { id: 'inspection-2' }],
      },
      weather: { conditions: 'Fine' },
      project: { id: 'project-1' },
    });
  });
});

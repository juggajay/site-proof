import { describe, expect, it, vi } from 'vitest';

import {
  buildEmptyProjectManagerDashboardResponse,
  buildProjectManagerDashboardResponse,
  buildProjectManagerLotProgress,
} from './roleDashboardResponses.js';

describe('role dashboard response helpers', () => {
  it('builds the project-manager empty response shape', () => {
    expect(buildEmptyProjectManagerDashboardResponse()).toMatchObject({
      lotProgress: {
        total: 0,
        notStarted: 0,
        inProgress: 0,
        onHold: 0,
        completed: 0,
        progressPercentage: 0,
      },
      openNCRs: { total: 0, major: 0, minor: 0, overdue: 0, items: [] },
      claimStatus: {
        totalClaimed: 0,
        totalCertified: 0,
        totalPaid: 0,
        outstanding: 0,
        pendingClaims: 0,
        recentClaims: [],
      },
      project: null,
    });
  });

  it('counts completed and conformed lots as project-manager progress', () => {
    expect(
      buildProjectManagerLotProgress([
        { status: 'not_started', _count: 2 },
        { status: 'in_progress', _count: 1 },
        { status: 'on_hold', _count: 1 },
        { status: 'completed', _count: 3 },
        { status: 'conformed', _count: 1 },
      ]),
    ).toEqual({
      total: 8,
      notStarted: 2,
      inProgress: 1,
      onHold: 1,
      completed: 4,
      progressPercentage: 50,
    });
  });

  it('formats project-manager dashboard query results without changing links or rounding', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T00:00:00.000Z'));

    try {
      const response = buildProjectManagerDashboardResponse({
        projectId: 'project-1',
        lotStats: [
          { status: 'completed', _count: 2 },
          { status: 'not_started', _count: 2 },
        ],
        majorNCRs: 1,
        minorNCRs: 2,
        overdueNCRs: 1,
        recentNCRs: [
          {
            id: 'ncr-1',
            ncrNumber: 'NCR-001',
            description: 'Fix edge drain',
            category: 'major',
            status: 'open',
            createdAt: new Date('2026-06-04T00:00:00.000Z'),
          },
        ],
        hpPending: 1,
        hpScheduled: 2,
        hpRequested: 3,
        hpReleased: 4,
        hpThisWeek: 5,
        upcomingHPs: [
          {
            id: 'hp-1',
            description: null,
            status: 'requested',
            scheduledDate: new Date('2026-06-07T00:00:00.000Z'),
            lot: { lotNumber: 'LOT-1', id: 'lot-1', projectId: 'project-1' },
          },
        ],
        claims: [
          {
            totalClaimedAmount: '1000',
            certifiedAmount: '800',
            paidAmount: '500',
            status: 'submitted',
          },
          {
            totalClaimedAmount: '400',
            certifiedAmount: '400',
            paidAmount: '200',
            status: 'paid',
          },
        ],
        recentClaims: [
          {
            id: 'claim-1',
            claimNumber: 'PC-001',
            totalClaimedAmount: '1000',
            status: 'submitted',
          },
        ],
        project: { contractValue: '1000' },
        dockets: [
          { totalLabourSubmitted: '600', totalPlantSubmitted: '455' },
          { totalLabourSubmitted: null, totalPlantSubmitted: '0' },
        ],
        overdueNCRList: [{ id: 'ncr-1', ncrNumber: 'NCR-001', description: 'Overdue NCR' }],
        majorNCRList: [{ id: 'ncr-2', ncrNumber: 'NCR-002', description: 'Major NCR' }],
        primaryProject: {
          id: 'project-1',
          name: 'Pacific Highway Upgrade',
          projectNumber: 'PHU-001',
          status: 'active',
        },
      });

      expect(response.lotProgress).toMatchObject({
        total: 4,
        completed: 2,
        progressPercentage: 50,
      });
      expect(response.openNCRs).toMatchObject({
        total: 3,
        major: 1,
        minor: 2,
        overdue: 1,
      });
      expect(response.openNCRs.items[0]).toMatchObject({
        daysOpen: 2,
        link: '/projects/project-1/ncr?ncrId=ncr-1',
      });
      expect(response.holdPointPipeline.items[0]).toMatchObject({
        description: 'Hold Point',
        scheduledDate: '2026-06-07T00:00:00.000Z',
        link: '/projects/project-1/lots/lot-1/holdpoints?hp=hp-1',
      });
      expect(response.claimStatus).toMatchObject({
        totalClaimed: 1400,
        totalCertified: 1200,
        totalPaid: 700,
        outstanding: 500,
        pendingClaims: 1,
      });
      expect(response.costTracking).toMatchObject({
        budgetTotal: 1000,
        actualSpend: 1055,
        variance: 55,
        variancePercentage: 5.5,
        trend: 'over',
      });
      expect(response.attentionItems).toEqual([
        {
          id: 'ncr-ncr-1',
          type: 'ncr',
          title: 'NCR NCR-001 overdue',
          description: 'Overdue NCR',
          urgency: 'critical',
          link: '/projects/project-1/ncr?ncrId=ncr-1',
        },
        {
          id: 'ncr-major-ncr-2',
          type: 'ncr',
          title: 'Major NCR: NCR-002',
          description: 'Major NCR',
          urgency: 'warning',
          link: '/projects/project-1/ncr?ncrId=ncr-2',
        },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});

import { describe, expect, it } from 'vitest';
import { buildProjectOverviewResponse } from './overviewResponses.js';

describe('project overview response helper', () => {
  it('builds the overview project, stats, attention, and recent activity envelope', () => {
    const response = buildProjectOverviewResponse({
      project: {
        id: 'project-1',
        name: 'Road Upgrade',
        projectNumber: 'RU-001',
        status: 'active',
        clientName: 'Transport NSW',
        state: 'NSW',
      },
      lotsTotal: 8,
      lotsCompleted: 3,
      lotsInProgress: 2,
      lotsNotStarted: 2,
      lotsOnHold: 1,
      lotsProgressPct: 38,
      ncrStats: [4, 9, 2],
      ncrByCategory: [1, 5, 3],
      holdPointStats: [6, 7],
      itpStats: [10, 11],
      docketStats: 12,
      testCount: 13,
      documentCount: 14,
      todayDiaryStatus: 'submitted',
      attentionItems: [{ id: 'ncr-1', urgency: 'critical' }],
      recentActivity: [{ id: 'activity-1' }],
    });

    expect(response).toEqual({
      project: {
        id: 'project-1',
        name: 'Road Upgrade',
        projectNumber: 'RU-001',
        status: 'active',
        client: 'Transport NSW',
        state: 'NSW',
      },
      stats: {
        lots: {
          total: 8,
          completed: 3,
          inProgress: 2,
          notStarted: 2,
          onHold: 1,
          progressPct: 38,
        },
        ncrs: {
          open: 4,
          total: 9,
          overdue: 2,
          major: 1,
          minor: 5,
          observation: 3,
        },
        holdPoints: {
          pending: 6,
          released: 7,
        },
        itps: {
          pending: 10,
          completed: 11,
        },
        dockets: {
          pendingApproval: 12,
        },
        tests: {
          total: 13,
        },
        documents: {
          total: 14,
        },
        diary: {
          todayStatus: 'submitted',
        },
      },
      attentionItems: [{ id: 'ncr-1', urgency: 'critical' }],
      recentActivity: [{ id: 'activity-1' }],
    });
  });

  it('limits recent activity to the first ten entries', () => {
    const recentActivity = Array.from({ length: 12 }, (_, index) => ({ id: `activity-${index}` }));

    const response = buildProjectOverviewResponse({
      project: {
        id: 'project-1',
        name: 'Road Upgrade',
        projectNumber: 'RU-001',
        status: 'active',
        clientName: null,
        state: null,
      },
      lotsTotal: 0,
      lotsCompleted: 0,
      lotsInProgress: 0,
      lotsNotStarted: 0,
      lotsOnHold: 0,
      lotsProgressPct: 0,
      ncrStats: [0, 0, 0],
      ncrByCategory: [0, 0, 0],
      holdPointStats: [0, 0],
      itpStats: [0, 0],
      docketStats: 0,
      testCount: 0,
      documentCount: 0,
      todayDiaryStatus: null,
      attentionItems: [],
      recentActivity,
    });

    expect(response.recentActivity).toHaveLength(10);
    expect(response.recentActivity.map((activity) => activity.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `activity-${index}`),
    );
    expect(response.project.client).toBeNull();
    expect(response.stats.diary.todayStatus).toBeNull();
  });
});

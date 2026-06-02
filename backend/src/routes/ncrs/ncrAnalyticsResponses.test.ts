import { describe, expect, it } from 'vitest';

import {
  buildNcrAnalyticsResponse,
  buildNcrAnalyticsRoleResponse,
} from './ncrAnalyticsResponses.js';

describe('NCR analytics response helpers', () => {
  it('builds analytics payloads with chart metadata, drilldowns, and repeat sections', () => {
    const response = buildNcrAnalyticsResponse({
      totalNCRs: 4,
      openNCRs: 1,
      closedNCRs: 3,
      overdueNCRs: 1,
      avgDaysToClose: 2.5,
      rootCauseChartData: [{ name: 'Process', value: 2, percentage: 50 }],
      categoryChartData: [{ name: 'major', value: 3, percentage: 75 }],
      severityBreakdown: { minor: 1, major: 3 },
      statusBreakdown: { open: 1, closed: 3 },
      closureTimeTrendData: [{ month: '2026-06', avgDays: 2.5, count: 3 }],
      volumeTrendData: [{ month: '2026-06', count: 4 }],
      rootCauseBreakdown: { Process: 2, 'Not categorized': 1 },
      categoryBreakdown: { major: 3, Uncategorized: 1 },
      ncrs: [
        { id: 'ncr-1', rootCauseCategory: 'Process', category: 'major' },
        { id: 'ncr-2', rootCauseCategory: null, category: null },
      ],
      repeatIssues: [{ category: 'major', count: 2 }],
      repeatOffenders: [{ subcontractorId: 'sub-1', ncrCount: 2 }],
    });

    expect(response.summary).toEqual({
      total: 4,
      open: 1,
      closed: 3,
      overdue: 1,
      avgDaysToClose: 2.5,
      closureRate: 75,
    });
    expect(response.charts.rootCause).toEqual({
      title: 'NCRs by Root Cause',
      data: [{ name: 'Process', value: 2, percentage: 50 }],
    });
    expect(response.charts.severity.data).toEqual([
      { name: 'minor', value: 1, percentage: 25 },
      { name: 'major', value: 3, percentage: 75 },
    ]);
    expect(response.drillDown).toEqual({
      rootCause: {
        Process: ['ncr-1'],
        'Not categorized': ['ncr-2'],
      },
      category: {
        major: ['ncr-1'],
        Uncategorized: ['ncr-2'],
      },
    });
    expect(response.repeatIssues).toEqual({
      title: 'Repeat Issues',
      description: 'NCRs grouped by category and root cause showing recurring problems',
      data: [{ category: 'major', count: 2 }],
      totalRepeatGroups: 1,
    });
  });

  it('builds role check payloads and mirrors quality-manager approval capability', () => {
    expect(buildNcrAnalyticsRoleResponse('quality_manager', true)).toEqual({
      role: 'quality_manager',
      isQualityManager: true,
      canApproveNCRs: true,
    });

    expect(buildNcrAnalyticsRoleResponse('foreman', false)).toEqual({
      role: 'foreman',
      isQualityManager: false,
      canApproveNCRs: false,
    });
  });
});

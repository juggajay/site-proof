import { describe, expect, it } from 'vitest';

import {
  buildNcrAnalyticsResponse,
  buildNcrAnalyticsRoleResponse,
} from './ncrAnalyticsResponses.js';

describe('NCR analytics response helpers', () => {
  it('builds analytics payloads with chart metadata and the three recurrence sections', () => {
    const response = buildNcrAnalyticsResponse({
      totalNCRs: 4,
      openNCRs: 1,
      closedNCRs: 3,
      overdueNCRs: 1,
      avgDaysToClose: 2.5,
      rootCauseChartData: [{ key: 'process', name: 'Process', value: 2, percentage: 50 }],
      categoryChartData: [{ key: 'materials', name: 'Materials', value: 3, percentage: 75 }],
      activityChartData: [
        { key: 'earthworks_general', name: 'earthworks_general', value: 3, percentage: 75 },
        { key: 'not_classified', name: 'Activity not classified', value: 1, percentage: 25 },
      ],
      severityBreakdown: { minor: 1, major: 3 },
      statusBreakdown: { open: 1, closed: 3 },
      closureTimeTrendData: [{ month: '2026-06', avgDays: 2.5, count: 3 }],
      volumeTrendData: [{ month: '2026-06', count: 4 }],
      repeatIssues: [
        {
          category: 'materials',
          categoryLabel: 'Materials',
          rootCause: 'process',
          rootCauseLabel: 'Process',
          count: 2,
        },
      ],
      repeatOffenders: [
        {
          subcontractorId: 'sub-1',
          subcontractorName: 'Acme Civil',
          ncrCount: 2,
          categories: ['materials'],
          categoryCount: 1,
        },
      ],
      recurringItems: [
        {
          rootChecklistItemId: 'item-root',
          description: 'Compaction test at 300mm layers',
          templateId: 'tpl-1',
          templateName: 'Bulk earthworks',
          ncrCount: 3,
          subcontractorCount: 2,
          activitySlugs: ['earthworks_general'],
          checklistItemIds: ['item-a', 'item-b'],
        },
      ],
      checklistItemCoverage: { linked: 3, total: 4, itemsWithoutLineage: 1, itemsObserved: 2 },
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
      data: [{ key: 'process', name: 'Process', value: 2, percentage: 50 }],
    });
    expect(response.charts.severity.data).toEqual([
      { key: 'minor', name: 'minor', value: 1, percentage: 25 },
      { key: 'major', name: 'major', value: 3, percentage: 75 },
    ]);
    // AT-G28's bucket survives the response assembly rather than being filtered
    // out as an "unknown" activity.
    expect(response.charts.activity.data.map((datum) => datum.key)).toContain('not_classified');
    expect(response.repeatIssues.totalRepeatGroups).toBe(1);
    expect(response.repeatOffenders.data[0].subcontractorName).toBe('Acme Civil');
    expect(response.recurringItems.coverage).toEqual({
      linked: 3,
      total: 4,
      itemsWithoutLineage: 1,
      itemsObserved: 2,
    });
  });

  it('no longer emits the unbounded per-bucket id drilldown', () => {
    const response = buildNcrAnalyticsResponse({
      totalNCRs: 0,
      openNCRs: 0,
      closedNCRs: 0,
      overdueNCRs: 0,
      avgDaysToClose: 0,
      rootCauseChartData: [],
      categoryChartData: [],
      activityChartData: [],
      severityBreakdown: {},
      statusBreakdown: {},
      closureTimeTrendData: [],
      volumeTrendData: [],
      repeatIssues: [],
      repeatOffenders: [],
      recurringItems: [],
      checklistItemCoverage: { linked: 0, total: 0, itemsWithoutLineage: 0, itemsObserved: 0 },
    });

    expect(response).not.toHaveProperty('drillDown');
    expect(response.summary.closureRate).toBe(0);
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

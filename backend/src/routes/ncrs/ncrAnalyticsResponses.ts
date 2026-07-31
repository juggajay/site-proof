/**
 * Response assembly for `GET /api/ncrs/analytics/:projectId`.
 *
 * Wave G G5 (spec §5) changed two things about the shape:
 *
 *  - **`drillDown` is gone.** It returned an array of every NCR id in every
 *    root-cause and category bucket — the same unbounded shape [GR-N4] flags on
 *    `repeatOffenders`, doubled. The endpoint had zero frontend consumers at
 *    HEAD, so nothing was reading it; the UI drills down by filtering the NCR
 *    register on a folded category, which is a route that already exists.
 *  - **Buckets carry a canonical `key` alongside their label,** because the
 *    labels are now derived from the shared vocabulary and a chart click needs
 *    the value to filter by, not the words shown to the reader.
 *
 * `repeatOffenders.data[].{subcontractorId, ncrCount}` keep their shipped names.
 */

type Breakdown = Record<string, number>;

export interface AnalyticsChecklistItemCoverage {
  /** NCRs carrying `itpChecklistItemId`. */
  linked: number;
  /** NCRs in scope, linked or not. */
  total: number;
  /** Observed items with no `sourceChecklistItemId` — their own lineage root. */
  itemsWithoutLineage: number;
  /** Distinct linked items observed. */
  itemsObserved: number;
}

export type NcrAnalyticsResponseInput<
  TChartDatum,
  TTrendData,
  TRepeatIssue,
  TRepeatOffender,
  TRecurringItem,
> = {
  totalNCRs: number;
  openNCRs: number;
  closedNCRs: number;
  overdueNCRs: number;
  avgDaysToClose: number;
  rootCauseChartData: TChartDatum[];
  categoryChartData: TChartDatum[];
  activityChartData: TChartDatum[];
  severityBreakdown: Breakdown;
  statusBreakdown: Breakdown;
  closureTimeTrendData: TTrendData[];
  volumeTrendData: TTrendData[];
  repeatIssues: TRepeatIssue[];
  repeatOffenders: TRepeatOffender[];
  recurringItems: TRecurringItem[];
  checklistItemCoverage: AnalyticsChecklistItemCoverage;
};

export function buildNcrAnalyticsResponse<
  TChartDatum,
  TTrendData,
  TRepeatIssue,
  TRepeatOffender,
  TRecurringItem,
>({
  totalNCRs,
  openNCRs,
  closedNCRs,
  overdueNCRs,
  avgDaysToClose,
  rootCauseChartData,
  categoryChartData,
  activityChartData,
  severityBreakdown,
  statusBreakdown,
  closureTimeTrendData,
  volumeTrendData,
  repeatIssues,
  repeatOffenders,
  recurringItems,
  checklistItemCoverage,
}: NcrAnalyticsResponseInput<
  TChartDatum,
  TTrendData,
  TRepeatIssue,
  TRepeatOffender,
  TRecurringItem
>) {
  const breakdownChart = (breakdown: Breakdown) =>
    Object.entries(breakdown).map(([name, value]) => ({
      key: name,
      name,
      value,
      percentage: totalNCRs > 0 ? Math.round((value / totalNCRs) * 100) : 0,
    }));

  return {
    summary: {
      total: totalNCRs,
      open: openNCRs,
      closed: closedNCRs,
      overdue: overdueNCRs,
      avgDaysToClose,
      closureRate: totalNCRs > 0 ? Math.round((closedNCRs / totalNCRs) * 100) : 0,
    },
    charts: {
      rootCause: {
        title: 'NCRs by Root Cause',
        data: rootCauseChartData,
      },
      category: {
        title: 'NCRs by Category',
        data: categoryChartData,
      },
      activity: {
        title: 'NCRs by Work Type',
        description:
          'Lot activity the NCR was raised against. An NCR spanning two activities counts in both.',
        data: activityChartData,
      },
      severity: {
        title: 'NCRs by Severity',
        data: breakdownChart(severityBreakdown),
      },
      status: {
        title: 'NCRs by Status',
        data: breakdownChart(statusBreakdown),
      },
      closureTimeTrend: {
        title: 'Average Closure Time Trend',
        description: 'Average days to close NCRs by month',
        data: closureTimeTrendData,
        overallAvg: avgDaysToClose,
      },
      volumeTrend: {
        title: 'NCR Volume Trend',
        description: 'Number of NCRs raised by month',
        data: volumeTrendData,
      },
    },
    repeatIssues: {
      title: 'Repeat Issues',
      description: 'NCRs grouped by category and root cause showing recurring problems',
      data: repeatIssues,
      totalRepeatGroups: repeatIssues.length,
    },
    repeatOffenders: {
      title: 'Subcontractors with Multiple NCRs',
      description: 'Subcontractors responsible for 2 or more NCRs',
      data: repeatOffenders,
    },
    recurringItems: {
      title: 'Recurring ITP Failures',
      description:
        'Checklist items that failed two or more times, grouped by the requirement rather than by each project copy of it',
      data: recurringItems,
      coverage: checklistItemCoverage,
    },
  };
}

export function buildNcrAnalyticsRoleResponse(role: string, isQualityManager: boolean) {
  return {
    role,
    isQualityManager,
    canApproveNCRs: isQualityManager,
  };
}

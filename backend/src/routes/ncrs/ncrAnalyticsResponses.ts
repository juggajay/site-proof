type Breakdown = Record<string, number>;

type DrilldownNcr = {
  id: string;
  rootCauseCategory?: string | null;
  category?: string | null;
};

export type NcrAnalyticsResponseInput<
  TRootCauseData,
  TCategoryData,
  TTrendData,
  TRepeatIssue,
  TRepeatOffender,
> = {
  totalNCRs: number;
  openNCRs: number;
  closedNCRs: number;
  overdueNCRs: number;
  avgDaysToClose: number;
  rootCauseChartData: TRootCauseData[];
  categoryChartData: TCategoryData[];
  severityBreakdown: Breakdown;
  statusBreakdown: Breakdown;
  closureTimeTrendData: TTrendData[];
  volumeTrendData: TTrendData[];
  rootCauseBreakdown: Breakdown;
  categoryBreakdown: Breakdown;
  ncrs: DrilldownNcr[];
  repeatIssues: TRepeatIssue[];
  repeatOffenders: TRepeatOffender[];
};

export function buildNcrAnalyticsResponse<
  TRootCauseData,
  TCategoryData,
  TTrendData,
  TRepeatIssue,
  TRepeatOffender,
>({
  totalNCRs,
  openNCRs,
  closedNCRs,
  overdueNCRs,
  avgDaysToClose,
  rootCauseChartData,
  categoryChartData,
  severityBreakdown,
  statusBreakdown,
  closureTimeTrendData,
  volumeTrendData,
  rootCauseBreakdown,
  categoryBreakdown,
  ncrs,
  repeatIssues,
  repeatOffenders,
}: NcrAnalyticsResponseInput<
  TRootCauseData,
  TCategoryData,
  TTrendData,
  TRepeatIssue,
  TRepeatOffender
>) {
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
      severity: {
        title: 'NCRs by Severity',
        data: Object.entries(severityBreakdown).map(([name, value]) => ({
          name,
          value,
          percentage: totalNCRs > 0 ? Math.round((value / totalNCRs) * 100) : 0,
        })),
      },
      status: {
        title: 'NCRs by Status',
        data: Object.entries(statusBreakdown).map(([name, value]) => ({
          name,
          value,
          percentage: totalNCRs > 0 ? Math.round((value / totalNCRs) * 100) : 0,
        })),
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
    drillDown: {
      rootCause: Object.fromEntries(
        Object.keys(rootCauseBreakdown).map((cause) => [
          cause,
          ncrs
            .filter((ncr) => (ncr.rootCauseCategory || 'Not categorized') === cause)
            .map((ncr) => ncr.id),
        ]),
      ),
      category: Object.fromEntries(
        Object.keys(categoryBreakdown).map((category) => [
          category,
          ncrs.filter((ncr) => (ncr.category || 'Uncategorized') === category).map((ncr) => ncr.id),
        ]),
      ),
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
  };
}

export function buildNcrAnalyticsRoleResponse(role: string, isQualityManager: boolean) {
  return {
    role,
    isQualityManager,
    canApproveNCRs: isQualityManager,
  };
}

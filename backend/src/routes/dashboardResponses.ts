export function buildPortfolioCashFlowResponse(
  totalClaimed: number,
  totalCertified: number,
  totalPaid: number,
) {
  return {
    totalClaimed,
    totalCertified,
    totalPaid,
    outstanding: totalCertified - totalPaid,
  };
}

export function buildPortfolioNcrsResponse(ncrs: unknown[]) {
  return { ncrs };
}

export function buildProjectsAtRiskResponse(projectsAtRisk: unknown[]) {
  return { projectsAtRisk };
}

export function buildDashboardStatsResponse<TOverdueNcr, TStaleHoldPoint, TRecentActivity>({
  totalProjects,
  activeProjects,
  totalLots,
  lotStatusCounts,
  openHoldPoints,
  openNCRs,
  overdueNCRs,
  staleHoldPoints,
  recentActivities,
}: {
  totalProjects: number;
  activeProjects: number;
  totalLots: number;
  lotStatusCounts: Record<string, number>;
  openHoldPoints: number;
  openNCRs: number;
  overdueNCRs: TOverdueNcr[];
  staleHoldPoints: TStaleHoldPoint[];
  recentActivities: TRecentActivity[];
}) {
  return {
    totalProjects,
    activeProjects,
    totalLots,
    lotStatusCounts,
    openHoldPoints,
    openNCRs,
    attentionItems: {
      overdueNCRs,
      staleHoldPoints,
      total: overdueNCRs.length + staleHoldPoints.length,
    },
    recentActivities,
  };
}

export function buildEmptyDashboardStatsResponse(lotStatusCounts: Record<string, number>) {
  return buildDashboardStatsResponse({
    totalProjects: 0,
    activeProjects: 0,
    totalLots: 0,
    lotStatusCounts,
    openHoldPoints: 0,
    openNCRs: 0,
    overdueNCRs: [],
    staleHoldPoints: [],
    recentActivities: [],
  });
}

export function buildCostTrendResponse<TDailyCost, TSubcontractor>({
  dailyCosts,
  totals,
  runningAverage,
  subcontractors,
  start,
  end,
}: {
  dailyCosts: TDailyCost[];
  totals: { labour: number; plant: number; combined: number };
  runningAverage: number;
  subcontractors: TSubcontractor[];
  start: Date;
  end: Date;
}) {
  return {
    dailyCosts,
    totals,
    runningAverage: Math.round(runningAverage * 100) / 100,
    subcontractors,
    dateRange: {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      daysWithData: dailyCosts.length,
    },
  };
}

export function buildEmptyCostTrendResponse() {
  return {
    dailyCosts: [],
    totals: { labour: 0, plant: 0, combined: 0 },
    runningAverage: 0,
    subcontractors: [],
  };
}

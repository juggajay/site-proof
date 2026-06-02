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

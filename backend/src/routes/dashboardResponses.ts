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

export function buildEmptyForemanDashboardResponse() {
  return {
    todayDiary: { exists: false, status: null, id: null },
    pendingDockets: { count: 0, totalLabourHours: 0, totalPlantHours: 0 },
    inspectionsDueToday: { count: 0, items: [] },
    weather: { conditions: null, temperatureMin: null, temperatureMax: null, rainfallMm: null },
    project: null,
  };
}

export function buildForemanDashboardResponse<TDocketStats, TInspectionItem, TWeather, TProject>({
  todayDiary,
  pendingDockets,
  inspectionItems,
  weather,
  project,
}: {
  todayDiary: { id: string; status: string } | null;
  pendingDockets: TDocketStats;
  inspectionItems: TInspectionItem[];
  weather: TWeather;
  project: TProject;
}) {
  return {
    todayDiary: {
      exists: !!todayDiary,
      status: todayDiary?.status || null,
      id: todayDiary?.id || null,
    },
    pendingDockets,
    inspectionsDueToday: {
      count: inspectionItems.length,
      items: inspectionItems,
    },
    weather,
    project,
  };
}

export function buildEmptyQualityManagerDashboardResponse() {
  return {
    lotConformance: { totalLots: 0, conformingLots: 0, nonConformingLots: 0, rate: 100 },
    ncrsByCategory: { major: 0, minor: 0, observation: 0, total: 0 },
    openNCRs: [],
    pendingVerifications: { count: 0, items: [] },
    holdPointMetrics: {
      totalReleased: 0,
      totalPending: 0,
      releaseRate: 100,
      avgTimeToRelease: 0,
    },
    itpTrends: {
      completedThisWeek: 0,
      completedLastWeek: 0,
      trend: 'stable' as const,
      completionRate: 100,
    },
    auditReadiness: { score: 100, status: 'ready' as const, issues: [] },
    project: null,
  };
}

export function buildQualityManagerDashboardResponse<TNcr, TVerification, TProject>({
  totalLots,
  conformingLots,
  nonConformingLots,
  conformanceRate,
  majorNCRs,
  minorNCRs,
  observationNCRs,
  openNCRs,
  pendingVerificationItems,
  releasedHPs,
  pendingHPs,
  releaseRate,
  avgTimeToRelease,
  completedThisWeek,
  completedLastWeek,
  trend,
  itpCompletionRate,
  auditScore,
  auditStatus,
  auditIssues,
  project,
}: {
  totalLots: number;
  conformingLots: number;
  nonConformingLots: number;
  conformanceRate: number;
  majorNCRs: number;
  minorNCRs: number;
  observationNCRs: number;
  openNCRs: TNcr[];
  pendingVerificationItems: TVerification[];
  releasedHPs: number;
  pendingHPs: number;
  releaseRate: number;
  avgTimeToRelease: number;
  completedThisWeek: number;
  completedLastWeek: number;
  trend: string;
  itpCompletionRate: number;
  auditScore: number;
  auditStatus: string;
  auditIssues: string[];
  project: TProject;
}) {
  return {
    lotConformance: {
      totalLots,
      conformingLots,
      nonConformingLots,
      rate: Math.round(conformanceRate * 10) / 10,
    },
    ncrsByCategory: {
      major: majorNCRs,
      minor: minorNCRs,
      observation: observationNCRs,
      total: majorNCRs + minorNCRs + observationNCRs,
    },
    openNCRs,
    pendingVerifications: {
      count: pendingVerificationItems.length,
      items: pendingVerificationItems,
    },
    holdPointMetrics: {
      totalReleased: releasedHPs,
      totalPending: pendingHPs,
      releaseRate: Math.round(releaseRate * 10) / 10,
      avgTimeToRelease,
    },
    itpTrends: {
      completedThisWeek,
      completedLastWeek,
      trend,
      completionRate: Math.round(itpCompletionRate * 10) / 10,
    },
    auditReadiness: {
      score: auditScore,
      status: auditStatus,
      issues: auditIssues,
    },
    project,
  };
}

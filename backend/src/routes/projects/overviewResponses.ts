type ProjectOverviewRecord = {
  id: string;
  name: string;
  projectNumber: string;
  status: string;
  clientName: string | null;
  state: string | null;
};

export function buildProjectOverviewResponse<TAttentionItem, TRecentActivity>({
  project,
  lotsTotal,
  lotsCompleted,
  lotsInProgress,
  lotsNotStarted,
  lotsOnHold,
  lotsProgressPct,
  ncrStats,
  ncrByCategory,
  holdPointStats,
  itpStats,
  docketStats,
  testCount,
  documentCount,
  todayDiaryStatus,
  attentionItems,
  recentActivity,
}: {
  project: ProjectOverviewRecord;
  lotsTotal: number;
  lotsCompleted: number;
  lotsInProgress: number;
  lotsNotStarted: number;
  lotsOnHold: number;
  lotsProgressPct: number;
  ncrStats: [number, number, number];
  ncrByCategory: [number, number, number];
  holdPointStats: [number, number];
  itpStats: [number, number];
  docketStats: number;
  testCount: number;
  documentCount: number;
  todayDiaryStatus: string | null;
  attentionItems: TAttentionItem[];
  recentActivity: TRecentActivity[];
}) {
  return {
    project: {
      id: project.id,
      name: project.name,
      projectNumber: project.projectNumber,
      status: project.status,
      client: project.clientName,
      state: project.state,
    },
    stats: {
      lots: {
        total: lotsTotal,
        completed: lotsCompleted,
        inProgress: lotsInProgress,
        notStarted: lotsNotStarted,
        onHold: lotsOnHold,
        progressPct: lotsProgressPct,
      },
      ncrs: {
        open: ncrStats[0],
        total: ncrStats[1],
        overdue: ncrStats[2],
        major: ncrByCategory[0],
        minor: ncrByCategory[1],
        observation: ncrByCategory[2],
      },
      holdPoints: {
        pending: holdPointStats[0],
        released: holdPointStats[1],
      },
      itps: {
        pending: itpStats[0],
        completed: itpStats[1],
      },
      dockets: {
        pendingApproval: docketStats,
      },
      tests: {
        total: testCount,
      },
      documents: {
        total: documentCount,
      },
      diary: {
        todayStatus: todayDiaryStatus,
      },
    },
    attentionItems,
    recentActivity: recentActivity.slice(0, 10),
  };
}

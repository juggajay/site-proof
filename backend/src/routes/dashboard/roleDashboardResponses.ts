import type { DashboardProject } from './access.js';
import { getDocketCommercialCosts, type DocketNumericLike } from '../../lib/docketCosts.js';
import { daysOverdue } from '../../lib/readiness/predicates.js';

// =============================================================================
// Role dashboard response builders. These helpers keep the route modules focused
// on authorization and data fetching while preserving the existing JSON shapes.
// =============================================================================

export type ProjectManagerLotStat = {
  status: string;
  _count: number;
};

export type ProjectManagerRecentNcr = {
  id: string;
  ncrNumber: string;
  description: string;
  category: string;
  status: string;
  createdAt: Date;
};

export type ProjectManagerUpcomingHoldPoint = {
  id: string;
  description: string | null;
  status: string;
  scheduledDate: Date | null;
  lot: {
    lotNumber: string;
    id: string;
    projectId: string;
  };
};

export type ProjectManagerClaimSummary = {
  totalClaimedAmount: unknown;
  certifiedAmount: unknown;
  paidAmount: unknown;
  status: string;
};

export type ProjectManagerRecentClaim = {
  id: string;
  claimNumber: string | number;
  totalClaimedAmount: unknown;
  status: string;
};

export type ProjectManagerProjectBudget = {
  contractValue: unknown;
} | null;

export type ProjectManagerDocketCost = {
  totalLabourSubmitted: DocketNumericLike;
  totalPlantSubmitted: DocketNumericLike;
  totalLabourApprovedCost?: DocketNumericLike;
  totalPlantApprovedCost?: DocketNumericLike;
};

export type ProjectManagerAttentionNcr = {
  id: string;
  ncrNumber: string;
  description: string;
};

type AttentionItem = {
  id: string;
  type: 'ncr' | 'holdpoint' | 'claim' | 'diary';
  title: string;
  description: string;
  urgency: 'critical' | 'warning' | 'info';
  link: string;
};

export function buildEmptyProjectManagerDashboardResponse() {
  return {
    lotProgress: {
      total: 0,
      notStarted: 0,
      inProgress: 0,
      onHold: 0,
      completed: 0,
      progressPercentage: 0,
    },
    openNCRs: { total: 0, major: 0, minor: 0, overdue: 0, items: [] },
    holdPointPipeline: {
      pending: 0,
      scheduled: 0,
      requested: 0,
      released: 0,
      thisWeek: 0,
      items: [],
    },
    claimStatus: {
      totalClaimed: 0,
      totalCertified: 0,
      totalPaid: 0,
      outstanding: 0,
      pendingClaims: 0,
      recentClaims: [],
    },
    costTracking: {
      budgetTotal: 0,
      actualSpend: 0,
      variance: 0,
      variancePercentage: 0,
      labourCost: 0,
      plantCost: 0,
      trend: 'on_track' as const,
    },
    attentionItems: [],
    project: null,
  };
}

export function buildProjectManagerLotProgress(lotStats: ProjectManagerLotStat[]) {
  const lotProgress = {
    total: 0,
    notStarted: 0,
    inProgress: 0,
    onHold: 0,
    completed: 0,
    progressPercentage: 0,
  };

  lotStats.forEach((stat) => {
    lotProgress.total += stat._count;
    switch (stat.status) {
      case 'not_started':
        lotProgress.notStarted = stat._count;
        break;
      case 'in_progress':
        lotProgress.inProgress = stat._count;
        break;
      case 'on_hold':
        lotProgress.onHold = stat._count;
        break;
      case 'completed':
      case 'conformed':
        lotProgress.completed += stat._count;
        break;
    }
  });

  lotProgress.progressPercentage =
    lotProgress.total > 0 ? (lotProgress.completed / lotProgress.total) * 100 : 0;

  return lotProgress;
}

export function buildProjectManagerDashboardResponse({
  projectId,
  lotStats,
  majorNCRs,
  minorNCRs,
  overdueNCRs,
  recentNCRs,
  hpPending,
  hpScheduled,
  hpRequested,
  hpReleased,
  hpThisWeek,
  upcomingHPs,
  claims,
  recentClaims,
  project,
  dockets,
  overdueNCRList,
  majorNCRList,
  primaryProject,
}: {
  projectId: string;
  lotStats: ProjectManagerLotStat[];
  majorNCRs: number;
  minorNCRs: number;
  overdueNCRs: number;
  recentNCRs: ProjectManagerRecentNcr[];
  hpPending: number;
  hpScheduled: number;
  hpRequested: number;
  hpReleased: number;
  hpThisWeek: number;
  upcomingHPs: ProjectManagerUpcomingHoldPoint[];
  claims: ProjectManagerClaimSummary[];
  recentClaims: ProjectManagerRecentClaim[];
  project: ProjectManagerProjectBudget;
  dockets: ProjectManagerDocketCost[];
  overdueNCRList: ProjectManagerAttentionNcr[];
  majorNCRList: ProjectManagerAttentionNcr[];
  primaryProject: DashboardProject;
}) {
  const lotProgress = buildProjectManagerLotProgress(lotStats);
  // L11: one clock read for the whole response, so two rows of identical age
  // cannot print different day counts because a millisecond fell between them.
  const now = new Date();

  let totalClaimed = 0;
  let totalCertified = 0;
  let totalPaid = 0;
  let pendingClaims = 0;

  claims.forEach((claim) => {
    totalClaimed += Number(claim.totalClaimedAmount || 0);
    totalCertified += Number(claim.certifiedAmount || 0);
    totalPaid += Number(claim.paidAmount || 0);
    if (claim.status === 'submitted' || claim.status === 'pending') {
      pendingClaims++;
    }
  });

  let labourCost = 0;
  let plantCost = 0;
  dockets.forEach((docket) => {
    const costs = getDocketCommercialCosts(docket);
    labourCost += costs.labourCost;
    plantCost += costs.plantCost;
  });

  const budgetTotal = Number(project?.contractValue || 0);
  const actualSpend = labourCost + plantCost;
  const variance = actualSpend - budgetTotal;
  const variancePercentage = budgetTotal > 0 ? (variance / budgetTotal) * 100 : 0;
  const trend = variancePercentage < -5 ? 'under' : variancePercentage > 5 ? 'over' : 'on_track';

  const attentionItems: AttentionItem[] = [];

  overdueNCRList.forEach((ncr) => {
    attentionItems.push({
      id: `ncr-${ncr.id}`,
      type: 'ncr',
      title: `NCR ${ncr.ncrNumber} overdue`,
      description: ncr.description,
      urgency: 'critical',
      link: `/projects/${projectId}/ncr?ncr=${ncr.id}`,
    });
  });

  majorNCRList.forEach((ncr) => {
    attentionItems.push({
      id: `ncr-major-${ncr.id}`,
      type: 'ncr',
      title: `Major NCR: ${ncr.ncrNumber}`,
      description: ncr.description,
      urgency: 'warning',
      link: `/projects/${projectId}/ncr?ncr=${ncr.id}`,
    });
  });

  return {
    lotProgress,
    openNCRs: {
      total: majorNCRs + minorNCRs,
      major: majorNCRs,
      minor: minorNCRs,
      overdue: overdueNCRs,
      items: recentNCRs.map((ncr) => ({
        id: ncr.id,
        ncrNumber: ncr.ncrNumber,
        description: ncr.description,
        category: ncr.category,
        status: ncr.status,
        // L11: the shared floor, same helper `roleDashboards.ts` uses — this was
        // its byte-identical twin. Anchor is `createdAt`: age, not lateness.
        daysOpen: daysOverdue(ncr.createdAt, now),
        link: `/projects/${projectId}/ncr?ncr=${ncr.id}`,
      })),
    },
    holdPointPipeline: {
      pending: hpPending,
      scheduled: hpScheduled,
      requested: hpRequested,
      released: hpReleased,
      thisWeek: hpThisWeek,
      items: upcomingHPs.map((hp) => ({
        id: hp.id,
        description: hp.description || 'Hold Point',
        lotNumber: hp.lot.lotNumber,
        status: hp.status,
        scheduledDate: hp.scheduledDate?.toISOString() || null,
        // Same target as the other role dashboards (`roleDashboards.ts`): there
        // is no `/lots/:lotId/holdpoints` route, so this dead-ended too.
        link: `/projects/${hp.lot.projectId}/hold-points?hp=${hp.id}`,
      })),
    },
    claimStatus: {
      totalClaimed,
      totalCertified,
      totalPaid,
      outstanding: totalCertified - totalPaid,
      pendingClaims,
      recentClaims: recentClaims.map((claim) => ({
        id: claim.id,
        claimNumber: claim.claimNumber,
        amount: Number(claim.totalClaimedAmount || 0),
        status: claim.status,
        link: `/projects/${projectId}/claims/${claim.id}`,
      })),
    },
    costTracking: {
      budgetTotal,
      actualSpend,
      variance,
      variancePercentage: Math.round(variancePercentage * 10) / 10,
      labourCost,
      plantCost,
      trend,
    },
    attentionItems,
    project: primaryProject,
  };
}

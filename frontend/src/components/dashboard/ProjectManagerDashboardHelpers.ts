export interface PMDashboardData {
  lotProgress: {
    total: number;
    notStarted: number;
    inProgress: number;
    onHold: number;
    completed: number;
    progressPercentage: number;
  };
  openNCRs: {
    total: number;
    major: number;
    minor: number;
    overdue: number;
    items: Array<{
      id: string;
      ncrNumber: string;
      description: string;
      category: string;
      status: string;
      daysOpen: number;
      link: string;
    }>;
  };
  holdPointPipeline: {
    pending: number;
    scheduled: number;
    requested: number;
    released: number;
    thisWeek: number;
    items: Array<{
      id: string;
      description: string;
      lotNumber: string;
      status: string;
      scheduledDate: string | null;
      link: string;
    }>;
  };
  claimStatus: {
    totalClaimed: number;
    totalCertified: number;
    totalPaid: number;
    outstanding: number;
    pendingClaims: number;
    recentClaims: Array<{
      id: string;
      claimNumber: string;
      amount: number;
      status: string;
      link: string;
    }>;
  };
  costTracking: {
    budgetTotal: number;
    actualSpend: number;
    variance: number;
    variancePercentage: number;
    labourCost: number;
    plantCost: number;
    trend: 'under' | 'over' | 'on_track';
  };
  attentionItems: Array<{
    id: string;
    type: 'ncr' | 'holdpoint' | 'claim' | 'diary';
    title: string;
    description: string;
    urgency: 'critical' | 'warning' | 'info';
    link: string;
  }>;
  project: {
    id: string;
    name: string;
    projectNumber: string;
    status: string;
  } | null;
}

export const defaultPMData: PMDashboardData = {
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
    trend: 'on_track',
  },
  attentionItems: [],
  project: null,
};

export function getProjectRoute(projectId: string | undefined, suffix: string): string {
  return projectId ? `/projects/${encodeURIComponent(projectId)}${suffix}` : '/projects';
}

export function getSafeInternalLink(link: string | undefined, fallback: string): string {
  if (link?.startsWith('/') && !link.startsWith('//')) {
    return link;
  }
  return fallback;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

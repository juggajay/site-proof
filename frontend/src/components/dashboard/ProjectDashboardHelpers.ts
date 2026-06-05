export interface AttentionItem {
  id: string;
  type: 'ncr' | 'holdpoint';
  title: string;
  description: string;
  urgency: 'critical' | 'warning';
  daysOverdue: number;
  link: string;
}

export interface ProjectDashboardData {
  project: {
    id: string;
    name: string;
    projectNumber: string;
    status: string;
    client?: string;
    state?: string;
  };
  stats: {
    lots: {
      total: number;
      completed: number;
      inProgress: number;
      notStarted: number;
      onHold: number;
      progressPct: number;
    };
    ncrs: {
      open: number;
      total: number;
      overdue: number;
      major: number;
      minor: number;
      observation: number;
    };
    holdPoints: { pending: number; released: number };
    itps: { pending: number; completed: number };
    dockets: { pendingApproval: number };
    tests: { total: number };
    documents: { total: number };
    diary: { todayStatus: 'not_started' | 'draft' | 'submitted' | null };
  };
  attentionItems: AttentionItem[];
  recentActivity: Array<{
    id: string;
    type: 'lot' | 'ncr' | 'holdpoint' | 'diary' | 'docket';
    description: string;
    timestamp: string;
    link?: string;
  }>;
}

export function getSafeProjectLink(
  link: string | undefined,
  projectRouteBase: string,
  fallback: string,
): string {
  if (
    link &&
    (link === projectRouteBase || link.startsWith(`${projectRouteBase}/`)) &&
    !link.startsWith('//')
  ) {
    return link;
  }
  return fallback;
}

export function getAttentionFallbackRoute(
  type: AttentionItem['type'],
  projectRouteBase: string,
): string {
  if (type === 'ncr') {
    return `${projectRouteBase}/ncr`;
  }
  return `${projectRouteBase}/hold-points`;
}

export function getActivityFallbackRoute(
  type: ProjectDashboardData['recentActivity'][number]['type'],
  projectRouteBase: string,
): string {
  switch (type) {
    case 'lot':
      return `${projectRouteBase}/lots`;
    case 'ncr':
      return `${projectRouteBase}/ncr`;
    case 'holdpoint':
      return `${projectRouteBase}/hold-points`;
    case 'diary':
      return `${projectRouteBase}/diary`;
    case 'docket':
      return `${projectRouteBase}/dockets`;
    default:
      return projectRouteBase;
  }
}

export function formatStatusLabel(status: string | null | undefined): string {
  const normalized = status?.trim();
  if (!normalized) return 'Draft';

  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AU');
}

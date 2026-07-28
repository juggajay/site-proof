import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  DATE_RANGE_PRESETS,
  formatDateForApi,
  type DateRangePreset,
} from '@/lib/dashboardDateRanges';
import { EMPTY_LOT_STATUS_COUNTS, type LotStatusCounts } from '@/lib/lotStatusOverview';
import type { DashboardAttentionItems } from '@/components/dashboard/ItemsRequiringAttentionWidget';
import type { DashboardRecentActivity } from '@/components/dashboard/RecentActivityWidget';

/**
 * The office dashboard stats query, shared by every surface that reads it, so
 * `queryKeys.dashboardStats(...)` has exactly ONE fetcher. Two components
 * putting differently-shaped payloads under the same key is a cache landmine —
 * A4's Needs-Attention screen reads `actionAssignments`, which the dashboard's
 * own mapper used to drop on the floor.
 */

/**
 * Frontend mirror of the F0.3 `ActionAssignment` contract
 * (`backend/src/lib/readiness/contracts/actionAssignment.ts`). Invariants worth
 * repeating here because the UI is forced to honour them: `status` is exhaustive
 * and mutually exclusive, `needsAction` is DERIVED (never authored, and the sole
 * gate on rendering a primary action), and `isOverdue` is ORTHOGONAL to `status`.
 */
export type ActionAssignmentStatus = 'waiting_on_me' | 'waiting_on_others' | 'done';

export type AssigneeKind = 'user' | 'role' | 'company' | 'external' | 'system';

export interface ActionAssignee {
  kind: AssigneeKind;
  id?: string;
  role?: string;
}

export interface PrimaryAction {
  label: string;
  href?: string;
  executableByRoles: string[];
}

export interface ActionAssignment {
  subjectType: string;
  subjectId: string;
  title: string;
  status: ActionAssignmentStatus;
  needsAction: boolean;
  isOverdue: boolean;
  /**
   * FULL days elapsed since `dueAt`, computed on the SERVER (M3). Consumers
   * RENDER it; re-deriving it from `dueAt` against the browser clock is what
   * made the dashboard widget and Needs Attention disagree across midnight.
   */
  daysOverdue: number;
  dueAt?: string;
  assignee: ActionAssignee;
  severity: 'blocker' | 'warning' | 'support';
  reasonCode: string;
  primaryAction: PrimaryAction;
}

export interface DashboardActionAssignments {
  items: ActionAssignment[];
  /** Real DB count behind the per-feed cap — never `items.length`. */
  totalCount: number;
}

export interface DashboardSetupProgress {
  controlLines: number;
  planSheets: number;
  lotsWithItp: number;
  teamMembers: number;
}

export const EMPTY_SETUP_PROGRESS: DashboardSetupProgress = {
  controlLines: 0,
  planSheets: 0,
  lotsWithItp: 0,
  teamMembers: 0,
};

export const EMPTY_ACTION_ASSIGNMENTS: DashboardActionAssignments = { items: [], totalCount: 0 };

export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalLots: number;
  lotStatusCounts?: Partial<LotStatusCounts>;
  openHoldPoints: number;
  openNCRs: number;
  attentionItems: DashboardAttentionItems;
  recentActivities: DashboardRecentActivity[];
  setupProgress: DashboardSetupProgress;
  actionAssignments: DashboardActionAssignments;
}

export const DEFAULT_DASHBOARD_STATS: DashboardStats = {
  totalProjects: 0,
  activeProjects: 0,
  totalLots: 0,
  lotStatusCounts: EMPTY_LOT_STATUS_COUNTS,
  openHoldPoints: 0,
  openNCRs: 0,
  attentionItems: { overdueNCRs: [], staleHoldPoints: [], total: 0 },
  recentActivities: [],
  setupProgress: EMPTY_SETUP_PROGRESS,
  actionAssignments: EMPTY_ACTION_ASSIGNMENTS,
};

export interface DashboardDateRange {
  preset: DateRangePreset;
  startDate: string;
  endDate: string;
  label: string;
}

/** The preset the dashboard opens on — and therefore the cache entry siblings share. */
export const DEFAULT_DASHBOARD_DATE_PRESET: DateRangePreset = 'last30days';

/**
 * Resolves a preset to the exact `{ startDate, endDate }` that feeds
 * `queryKeys.dashboardStats(...)`. One definition, so a sibling screen asking
 * for the default range lands on the dashboard's own cache entry rather than
 * refetching under a near-miss key.
 */
export function getDashboardDateRange(preset: DateRangePreset): DashboardDateRange {
  const resolved =
    DATE_RANGE_PRESETS.find((p) => p.value === preset) ??
    DATE_RANGE_PRESETS.find((p) => p.value === DEFAULT_DASHBOARD_DATE_PRESET)!;
  const range = resolved.getRange();
  return {
    preset: resolved.value,
    startDate: formatDateForApi(range.start),
    endDate: formatDateForApi(range.end),
    label: resolved.label,
  };
}

export function useDashboardStats(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.dashboardStats(startDate, endDate),
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const result = await apiFetch<DashboardStats>(`/api/dashboard/stats?${params}`);
      return {
        totalProjects: result.totalProjects || 0,
        activeProjects: result.activeProjects || 0,
        totalLots: result.totalLots || 0,
        lotStatusCounts: result.lotStatusCounts || EMPTY_LOT_STATUS_COUNTS,
        openHoldPoints: result.openHoldPoints || 0,
        openNCRs: result.openNCRs || 0,
        attentionItems: result.attentionItems || {
          overdueNCRs: [],
          staleHoldPoints: [],
          total: 0,
        },
        recentActivities: result.recentActivities || [],
        setupProgress: result.setupProgress || EMPTY_SETUP_PROGRESS,
        actionAssignments: result.actionAssignments || EMPTY_ACTION_ASSIGNMENTS,
      } as DashboardStats;
    },
  });
}

/**
 * Read-data layer for the Lot Detail page's side reads (quality access,
 * conformance status, test results, NCRs, and activity history).
 *
 * This module owns the *representation* of those reads — the request paths and
 * the response normalizers — so the page no longer hand-builds URL strings or
 * repeats `?? []` shaping inline. The one read that is cleanly isolated (quality
 * access: a single writer, no imperative refresh, feeding only derived
 * permission booleans) is also migrated to a TanStack Query hook here. The other
 * reads stay effect-driven in the page because their state is shared with
 * ITP/mutation refreshers that are out of scope for this slice.
 */

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { logError } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import type { ActivityLog, NCR, QualityAccess, TestResult } from './types';

// ===== Request path builders =====

export function buildQualityAccessPath(projectId: string): string {
  return `/api/lots/check-role/${encodeURIComponent(projectId)}`;
}

export function buildConformanceStatusPath(lotId: string): string {
  return `/api/lots/${encodeURIComponent(lotId)}/conform-status`;
}

export function buildLotTestResultsPath(projectId: string, lotId: string): string {
  return `/api/test-results?projectId=${encodeURIComponent(projectId)}&lotId=${encodeURIComponent(lotId)}`;
}

export function buildLotNcrsPath(projectId: string, lotId: string): string {
  return `/api/ncrs?projectId=${encodeURIComponent(projectId)}&lotId=${encodeURIComponent(lotId)}`;
}

export function buildLotHistoryPath(lotId: string): string {
  return `/api/audit-logs?entityType=Lot&search=${encodeURIComponent(lotId)}&limit=100`;
}

// ===== Response normalizers =====
// Equivalent to the prior inline `data.field || []`: for a `T[] | undefined`
// field the only fallback case is nullish, so `??` matches `||` exactly.

export function normalizeTestResults(data: { testResults?: TestResult[] | null }): TestResult[] {
  return data.testResults ?? [];
}

export function normalizeNcrs(data: { ncrs?: NCR[] | null }): NCR[] {
  return data.ncrs ?? [];
}

export function normalizeActivityLogs(data: { logs?: ActivityLog[] | null }): ActivityLog[] {
  return data.logs ?? [];
}

// ===== Read-only Query hooks =====

/**
 * Quality access / role permissions for the project. Preserves the prior inline
 * effect's behavior: a single attempt (`retry: false`) that logs on failure and
 * otherwise leaves the data undefined, so every derived permission boolean stays
 * false until it loads (identical to the previous null-initialized state).
 */
export function useLotQualityAccessQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.lotQualityAccess(projectId ?? ''),
    queryFn: async () => {
      try {
        return await apiFetch<QualityAccess>(buildQualityAccessPath(projectId!));
      } catch (err) {
        logError('Failed to fetch quality access:', err);
        throw err;
      }
    },
    enabled: Boolean(projectId),
    retry: false,
  });
}

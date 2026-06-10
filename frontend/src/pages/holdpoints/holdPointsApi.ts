import { apiFetch } from '@/lib/api';
import { logError, reportClientError } from '@/lib/logger';
import type { HoldPoint } from './types';

export interface HoldPointsResponse {
  holdPoints?: HoldPoint[];
  pagination?: {
    page: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}

export const HOLD_POINTS_PAGE_LIMIT = 100;

/**
 * Hard cap on the page loop so a buggy/odd pagination payload can never spin
 * forever (the previous `while (true)` loop had no upper bound). 50 pages of
 * 100 = 5,000 hold points — far beyond any real project register.
 */
export const HOLD_POINTS_MAX_PAGES = 50;

/**
 * Fetch the full hold-point register for a project, page by page. Used as the
 * TanStack Query queryFn for the register, and the deep-link lookup (?hp=<id>)
 * relies on it returning the complete, unfiltered list.
 *
 * If the page cap is ever hit, the truncated register is still returned (the
 * register stays usable) and the event is reported as telemetry — `logError`
 * in dev, `reportClientError` in production.
 */
export async function fetchAllProjectHoldPoints(projectId: string): Promise<HoldPoint[]> {
  const allHoldPoints: HoldPoint[] = [];
  let page = 1;

  while (page <= HOLD_POINTS_MAX_PAGES) {
    const data = await apiFetch<HoldPointsResponse>(
      `/api/holdpoints/project/${encodeURIComponent(projectId)}?page=${page}&limit=${HOLD_POINTS_PAGE_LIMIT}`,
    );

    allHoldPoints.push(...(data.holdPoints || []));

    if (!data.pagination?.hasNextPage || page >= data.pagination.totalPages) {
      return allHoldPoints;
    }

    page += 1;
  }

  const capError = new Error(
    `Hold point register fetch hit the ${HOLD_POINTS_MAX_PAGES}-page cap; showing the first ${allHoldPoints.length} hold points.`,
  );
  logError('Hold point register page cap reached:', capError);
  void reportClientError(capError);
  return allHoldPoints;
}

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

/**
 * Hard cap for the full-register request. The backend still bounds `all=true`
 * so a project with bad seed data cannot return an unbounded payload.
 */
export const HOLD_POINTS_MAX_PAGES = 50;
export const HOLD_POINTS_PAGE_LIMIT = 100;
export const HOLD_POINTS_REGISTER_LIMIT = HOLD_POINTS_PAGE_LIMIT * HOLD_POINTS_MAX_PAGES;

/**
 * Fetch the full hold-point register for a project. Used as the TanStack Query
 * queryFn for the register, and the deep-link lookup (?hp=<id>) relies on it
 * returning the complete, unfiltered list.
 *
 * If the page cap is ever hit, the truncated register is still returned (the
 * register stays usable) and the event is reported as telemetry — `logError`
 * in dev, `reportClientError` in production.
 */
export async function fetchAllProjectHoldPoints(projectId: string): Promise<HoldPoint[]> {
  const data = await apiFetch<HoldPointsResponse>(
    `/api/holdpoints/project/${encodeURIComponent(projectId)}?all=true`,
  );
  const holdPoints = data.holdPoints || [];

  if (data.pagination?.hasNextPage) {
    const capError = new Error(
      `Hold point register fetch hit the ${HOLD_POINTS_REGISTER_LIMIT}-item cap; showing the first ${holdPoints.length} hold points.`,
    );
    logError('Hold point register item cap reached:', capError);
    void reportClientError(capError);
  }

  return holdPoints;
}

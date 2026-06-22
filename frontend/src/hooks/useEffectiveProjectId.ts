import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/lib/auth';
import { isForemanDashboardUser } from '@/lib/subcontractorIdentity';

interface ForemanDashboardProjectResponse {
  project: { id: string } | null;
}

export interface EffectiveProjectIdResult {
  /** Project id foreman nav/capture should act on; null when none is resolved. */
  projectId: string | null;
  /** True while the active-project fallback is in flight (URL had no project). */
  isResolving: boolean;
  /** True once resolution settles and the foreman genuinely has no project. */
  hasNoProject: boolean;
}

/**
 * One source of truth for the project id foreman mobile surfaces should act on.
 *
 * Prefers the URL project id. When it is absent — e.g. the bare `/dashboard`
 * landing screen — it falls back to the foreman's active project from
 * `/api/dashboard/foreman` so the bottom nav and Capture entry point are never
 * inert. This mirrors the resolution `ForemanMobileDashboard` already does
 * inline (`projectId || data.project?.id`) and reuses the same query key so the
 * request dedupes rather than firing a second time.
 *
 * The fallback only runs for a foreman with no URL project: other roles (and any
 * caller that already has a project in the URL) just get the URL value with no
 * extra fetch, so this is safe to call from shared surfaces like MainLayout.
 */
export function useEffectiveProjectId(): EffectiveProjectIdResult {
  const { projectId: urlProjectId } = useParams();
  const [searchParams] = useSearchParams();
  const queryProjectId = searchParams.get('projectId');
  const explicitProjectId = urlProjectId ?? queryProjectId;
  const { user } = useAuth();
  const isForeman = isForemanDashboardUser(user);

  // Resolve the active-project fallback only for a foreman who has no project in
  // the URL. `/api/dashboard/foreman` returns the foreman's current project
  // regardless of route; the 'default' key matches ForemanMobileDashboard's
  // project-less render so the two observers share one request.
  const shouldResolveFallback = !explicitProjectId && isForeman;
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.foremanDashboard('default'),
    queryFn: () => apiFetch<ForemanDashboardProjectResponse>('/api/dashboard/foreman'),
    enabled: shouldResolveFallback,
  });

  if (explicitProjectId) {
    return { projectId: explicitProjectId, isResolving: false, hasNoProject: false };
  }

  if (!shouldResolveFallback) {
    // Non-foreman (or no user) with no URL project: nothing to resolve here.
    return { projectId: null, isResolving: false, hasNoProject: false };
  }

  const fallbackProjectId = data?.project?.id ?? null;
  return {
    projectId: fallbackProjectId,
    isResolving: isLoading,
    hasNoProject: !isLoading && !fallbackProjectId,
  };
}

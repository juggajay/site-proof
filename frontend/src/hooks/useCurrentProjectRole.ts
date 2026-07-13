import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

interface ProjectRoleResponse {
  project?: { currentUserRole?: string | null };
}

export function useCurrentProjectRole(projectId: string | undefined): string | null {
  const { data } = useQuery({
    queryKey: queryKeys.project(projectId ?? 'none'),
    // queryKeys.project caches the UNWRAPPED project — every consumer of this
    // key must resolve the same shape or they poison each other's cache (a raw
    // envelope here made settings pages read currentUserRole as undefined and
    // render owners read-only, depending on which query resolved last).
    queryFn: () =>
      apiFetch<ProjectRoleResponse>(`/api/projects/${encodeURIComponent(projectId ?? '')}`).then(
        (d) => d.project ?? null,
      ),
    enabled: Boolean(projectId),
  });

  return data?.currentUserRole ?? null;
}

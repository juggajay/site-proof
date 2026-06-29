import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

interface ProjectRoleResponse {
  project?: { currentUserRole?: string | null };
}

export function useCurrentProjectRole(projectId: string | undefined): string | null {
  const { data } = useQuery({
    queryKey: queryKeys.project(projectId ?? 'none'),
    queryFn: () =>
      apiFetch<ProjectRoleResponse>(`/api/projects/${encodeURIComponent(projectId ?? '')}`),
    enabled: Boolean(projectId),
  });

  return data?.project?.currentUserRole ?? null;
}

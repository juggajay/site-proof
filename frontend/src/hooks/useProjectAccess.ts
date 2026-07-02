import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { queryKeys } from '@/lib/queryKeys';

export type ProjectAccessResponse = {
  access: {
    hasProjectAccess: boolean;
    role: string | null;
    isProjectAdmin: boolean;
  };
};

export function useProjectAccess(projectId: string | null | undefined) {
  const { user } = useAuth();
  const encodedProjectId = projectId ? encodeURIComponent(projectId) : '';

  return useQuery({
    queryKey: projectId
      ? [...queryKeys.project(projectId), 'access', user?.id]
      : ['project', 'missing', 'access', user?.id],
    queryFn: () => apiFetch<ProjectAccessResponse>(`/api/projects/${encodedProjectId}/access`),
    enabled: Boolean(user?.id && projectId),
    retry: false,
    staleTime: 30_000,
  });
}

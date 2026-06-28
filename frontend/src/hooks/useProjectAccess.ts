import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type ProjectAccess = {
  hasProjectAccess: boolean;
  role: string;
  isProjectAdmin: boolean;
};

type ProjectAccessResponse = {
  access: ProjectAccess;
};

export function useProjectAccess(projectId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['project-access', userId, projectId],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      const response = await apiFetch<ProjectAccessResponse>(
        `/api/projects/${encodeURIComponent(projectId)}/access`,
      );
      return response.access;
    },
    enabled: Boolean(userId && projectId),
    retry: false,
  });
}

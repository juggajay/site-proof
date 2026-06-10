import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

interface SampleProjectResponse {
  project: {
    id: string;
    name: string;
    projectNumber: string;
    status: string;
    createdAt: string;
  };
  /** True when the company's example project already existed (idempotent re-run). */
  alreadyExisted: boolean;
}

/**
 * One-click "explore an example project" action (POST /api/projects/sample).
 *
 * The backend seeds a clearly-labelled sample project (lots across the
 * lifecycle, an ITP with completed items, hold points, an open NCR, test
 * results) — or returns the existing one, so repeat clicks never duplicate.
 * On success the projects list and dashboard stats are invalidated and the
 * user lands inside the new project.
 */
export function useCreateSampleProject() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => apiFetch<SampleProjectResponse>('/api/projects/sample', { method: 'POST' }),
    onSuccess: ({ project }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      // Prefix match: dashboardStats keys are parameterised by date range.
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      navigate(`/projects/${encodeURIComponent(project.id)}`);
    },
  });
}

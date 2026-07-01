import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RoleProtectedRoute } from '@/components/auth/RoleProtectedRoute';
import { AccessDeniedState } from '@/components/AccessDeniedState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/errorHandling';
import { hasSubcontractorPortalIdentity } from '@/lib/subcontractorIdentity';
import { getActiveShellHomePath, getShellOverrideFromSearch } from '@/shell/shellFlag';
import { ProjectDetailPage } from './appLazyPages';
import { PROJECT_WORKSPACE_ROLES } from './appRouteRoles';

function getSubcontractorWorkRoute(
  user: Parameters<typeof getActiveShellHomePath>[0],
  search: string,
  projectId?: string,
): string {
  const shellHomePath = getActiveShellHomePath(user, {
    override: getShellOverrideFromSearch(search),
  });
  const basePath = shellHomePath === '/p' ? '/p/work' : '/subcontractor-portal/work';
  return projectId ? `${basePath}?projectId=${encodeURIComponent(projectId)}` : basePath;
}

function SubcontractorProjectAccessRoute({ projectId }: { projectId?: string }) {
  const { user } = useAuth();
  const location = useLocation();
  const workRoute = getSubcontractorWorkRoute(user, location.search, projectId);
  const workHomeRoute = getSubcontractorWorkRoute(user, location.search);
  const { isLoading, error } = useQuery({
    queryKey: ['subcontractor-project-route-access', user?.id, projectId],
    queryFn: async () => {
      await apiFetch(
        `/api/subcontractors/my-company?projectId=${encodeURIComponent(projectId || '')}`,
      );
      return true;
    },
    enabled: !!user?.id && !!projectId,
    retry: false,
  });

  if (!projectId) {
    return <Navigate to={workHomeRoute} replace />;
  }

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <AccessDeniedState
        message={extractErrorMessage(
          error,
          'You do not have subcontractor portal access to this project.',
        )}
        backTo={workHomeRoute}
        backLabel="Back to Assigned Work"
      />
    );
  }

  return <Navigate to={workRoute} replace />;
}

export function ProjectDetailRoute() {
  const { user, loading } = useAuth();
  const { projectId } = useParams();

  if (!loading && hasSubcontractorPortalIdentity(user)) {
    return <SubcontractorProjectAccessRoute projectId={projectId} />;
  }

  return (
    <RoleProtectedRoute allowedRoles={PROJECT_WORKSPACE_ROLES} allowProjectScopedRole>
      <ProjectDetailPage />
    </RoleProtectedRoute>
  );
}

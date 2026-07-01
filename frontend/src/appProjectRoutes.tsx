import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ProjectProtectedRoute } from '@/components/auth/ProjectProtectedRoute';
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
  subcontractorCompanyId?: string,
): string {
  const shellHomePath = getActiveShellHomePath(user, {
    override: getShellOverrideFromSearch(search),
  });
  const basePath = shellHomePath === '/p' ? '/p/work' : '/subcontractor-portal/work';
  const params = new URLSearchParams();
  if (projectId) {
    params.set('projectId', projectId);
  }
  if (subcontractorCompanyId) {
    params.set('subcontractorCompanyId', subcontractorCompanyId);
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function SubcontractorProjectAccessRoute({ projectId }: { projectId?: string }) {
  const { user } = useAuth();
  const location = useLocation();
  const subcontractorCompanyId =
    new URLSearchParams(location.search).get('subcontractorCompanyId') ?? undefined;
  const workRoute = getSubcontractorWorkRoute(
    user,
    location.search,
    projectId,
    subcontractorCompanyId,
  );
  const workHomeRoute = getSubcontractorWorkRoute(user, location.search);
  const { isLoading, error } = useQuery({
    queryKey: ['subcontractor-project-route-access', user?.id, projectId, subcontractorCompanyId],
    queryFn: async () => {
      const params = new URLSearchParams({ projectId: projectId || '' });
      if (subcontractorCompanyId) {
        params.set('subcontractorCompanyId', subcontractorCompanyId);
      }

      await apiFetch(`/api/subcontractors/my-company?${params.toString()}`);
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
    <ProjectProtectedRoute allowedRoles={PROJECT_WORKSPACE_ROLES}>
      <ProjectDetailPage />
    </ProjectProtectedRoute>
  );
}

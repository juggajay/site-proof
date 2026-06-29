import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ProjectProtectedRoute } from '@/components/auth/ProjectProtectedRoute';
import { AccessDeniedState } from '@/components/AccessDeniedState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/errorHandling';
import { hasSubcontractorPortalIdentity } from '@/lib/subcontractorIdentity';
import { useSubbieShellActive } from '@/shell/shellFlag';
import { ProjectDetailPage } from './appLazyPages';
import { PROJECT_WORKSPACE_ROLES } from './appRouteRoles';

function SubcontractorProjectAccessRoute({ projectId }: { projectId?: string }) {
  const { user } = useAuth();
  const location = useLocation();
  const subbieShellActive = useSubbieShellActive();
  const subcontractorCompanyId = new URLSearchParams(location.search).get('subcontractorCompanyId');
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

  const assignedWorkPath = subbieShellActive ? '/p/work' : '/subcontractor-portal/work';

  if (!projectId) {
    return <Navigate to={assignedWorkPath} replace />;
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
        backTo={assignedWorkPath}
        backLabel="Back to Assigned Work"
      />
    );
  }

  const params = new URLSearchParams({ projectId });
  if (subcontractorCompanyId) {
    params.set('subcontractorCompanyId', subcontractorCompanyId);
  }

  return <Navigate to={`${assignedWorkPath}?${params.toString()}`} replace />;
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

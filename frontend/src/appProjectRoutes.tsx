import { Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ProjectProtectedRoute } from '@/components/auth/ProjectProtectedRoute';
import { AccessDeniedState } from '@/components/AccessDeniedState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/errorHandling';
import { hasSubcontractorPortalIdentity } from '@/lib/subcontractorIdentity';
import { ProjectDetailPage } from './appLazyPages';
import { PROJECT_WORKSPACE_ROLES } from './appRouteRoles';

function SubcontractorProjectAccessRoute({ projectId }: { projectId?: string }) {
  const { user } = useAuth();
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
    return <Navigate to="/subcontractor-portal/work" replace />;
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
        backTo="/subcontractor-portal/work"
        backLabel="Back to Assigned Work"
      />
    );
  }

  return (
    <Navigate
      to={`/subcontractor-portal/work?projectId=${encodeURIComponent(projectId)}`}
      replace
    />
  );
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

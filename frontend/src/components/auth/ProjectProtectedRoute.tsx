import { Navigate, useLocation, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AccessDeniedState } from '@/components/AccessDeniedState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/errorHandling';
import { useProjectAccess } from '@/hooks/useProjectAccess';

interface ProjectProtectedRouteProps {
  children: ReactNode;
  allowedRoles: readonly string[];
}

export function ProjectProtectedRoute({ children, allowedRoles }: ProjectProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { projectId } = useParams();
  const accessQuery = useProjectAccess(projectId);

  if (loading) {
    return <PageSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!projectId) {
    return <AccessDeniedState message="Project not found." />;
  }

  if (accessQuery.isLoading) {
    return <PageSkeleton />;
  }

  if (accessQuery.error) {
    return (
      <AccessDeniedState
        message={extractErrorMessage(accessQuery.error, 'You do not have access to this project.')}
      />
    );
  }

  const projectRole = accessQuery.data?.access.role;
  if (!projectRole || !allowedRoles.includes(projectRole)) {
    return <AccessDeniedState message="You do not have permission to access this project area." />;
  }

  return <>{children}</>;
}

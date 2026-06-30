import type { ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { AccessDeniedState } from '@/components/AccessDeniedState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/errorHandling';

interface ProjectProtectedRouteProps {
  children: ReactNode;
  allowedRoles: readonly string[];
  redirectTo?: string;
}

export function ProjectProtectedRoute({
  children,
  allowedRoles,
  redirectTo = '/projects',
}: ProjectProtectedRouteProps) {
  const { user, loading, sessionExpired } = useAuth();
  const location = useLocation();
  const { projectId } = useParams();
  const projectAccess = useProjectAccess(projectId, user?.id);

  if (loading) {
    return <PageSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location, sessionExpired }} replace />;
  }

  if (!projectId) {
    return (
      <AccessDeniedState
        message="A project is required before opening this page."
        backTo={redirectTo}
      />
    );
  }

  if (projectAccess.isLoading) {
    return <PageSkeleton />;
  }

  if (projectAccess.error) {
    return (
      <AccessDeniedState
        message={extractErrorMessage(
          projectAccess.error,
          'You do not have access to this project.',
        )}
        backTo={redirectTo}
      />
    );
  }

  const role = projectAccess.data?.role;
  if (!role || !allowedRoles.includes(role)) {
    return (
      <AccessDeniedState
        message="You do not have permission to access this page for this project."
        backTo={redirectTo}
      />
    );
  }

  return <>{children}</>;
}

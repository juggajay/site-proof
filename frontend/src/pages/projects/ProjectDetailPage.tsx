import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { ProjectDashboard } from '@/components/dashboard/ProjectDashboard';
import { isForemanDashboardUser } from '@/lib/subcontractorIdentity';
import { useShellV2Enabled } from '@/shell/shellFlag';

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const shellEnabled = useShellV2Enabled();

  const isForeman = isForemanDashboardUser(user);

  // M77: converge the mobile-foreman project entry point on the /m shell.
  // A foreman on the default shell lands on /m (scoped to this project via the
  // ?projectId the shell reads through useEffectiveProjectId); a foreman who
  // opted out via ?shell=off keeps the classic /foreman/today surface; everyone
  // else (incl. desktop foreman) gets the project dashboard.
  const foremanRedirect = !projectId
    ? null
    : shellEnabled
      ? `/m?projectId=${encodeURIComponent(projectId)}`
      : isForeman && isMobile
        ? `/projects/${encodeURIComponent(projectId)}/foreman/today`
        : null;

  useEffect(() => {
    if (foremanRedirect) {
      navigate(foremanRedirect, { replace: true });
    }
  }, [foremanRedirect, navigate]);

  // Show loading while the redirect settles
  if (foremanRedirect) {
    return (
      <div
        className="flex items-center justify-center h-64"
        role="status"
        aria-label="Loading foreman project"
      >
        <span className="sr-only">Loading foreman project...</span>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // For all other users (including desktop foreman), render the project dashboard
  return <ProjectDashboard />;
}

import { useAuth } from '@/lib/auth'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { ForemanMobileDashboard } from '@/components/foreman'
import { ProjectDashboard } from '@/components/dashboard/ProjectDashboard'

export function ProjectDetailPage() {
  const { user } = useAuth()
  const isMobile = useIsMobile()

  const userRole = (user as any)?.roleInCompany || (user as any)?.role
  const isForeman = userRole === 'foreman'

  // Render foreman mobile dashboard for mobile foreman users in project context
  if (isForeman && isMobile) {
    return <ForemanMobileDashboard />
  }

  // For all other users (including desktop foreman), render the project dashboard
  return <ProjectDashboard />
}

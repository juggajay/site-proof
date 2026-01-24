import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { ProjectDashboard } from '@/components/dashboard/ProjectDashboard'

export function ProjectDetailPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isMobile = useIsMobile()

  const userRole = (user as any)?.roleInCompany || (user as any)?.role
  const isForeman = userRole === 'foreman'

  // Redirect foreman mobile users to the new 5-tab foreman shell
  useEffect(() => {
    if (isForeman && isMobile && projectId) {
      navigate(`/projects/${projectId}/foreman/today`, { replace: true })
    }
  }, [isForeman, isMobile, projectId, navigate])

  // Show loading while redirecting foreman mobile users
  if (isForeman && isMobile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  // For all other users (including desktop foreman), render the project dashboard
  return <ProjectDashboard />
}

import { useParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { ForemanMobileDashboard } from '@/components/foreman'

export function ProjectDetailPage() {
  const { projectId } = useParams()
  const { user } = useAuth()
  const isMobile = useIsMobile()

  const userRole = (user as any)?.roleInCompany || (user as any)?.role
  const isForeman = userRole === 'foreman'

  // Render foreman mobile dashboard for mobile foreman users in project context
  if (isForeman && isMobile) {
    return <ForemanMobileDashboard />
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Project Overview</h1>
      <p className="text-muted-foreground">Project ID: {projectId}</p>
      {/* Project details and overview will be implemented here */}
    </div>
  )
}

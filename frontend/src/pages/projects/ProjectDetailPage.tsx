import { useParams } from 'react-router-dom'

export function ProjectDetailPage() {
  const { projectId } = useParams()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Project Overview</h1>
      <p className="text-muted-foreground">Project ID: {projectId}</p>
      {/* Project details and overview will be implemented here */}
    </div>
  )
}

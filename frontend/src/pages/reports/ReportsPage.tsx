import { useParams } from 'react-router-dom'

export function ReportsPage() {
  const { projectId } = useParams()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Reports & Analytics</h1>
      <p className="text-muted-foreground">
        Generate reports and view analytics for project {projectId}.
      </p>
      {/* Report templates, export options, dashboards will be here */}
    </div>
  )
}

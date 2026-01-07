import { useParams } from 'react-router-dom'

export function HoldPointsPage() {
  const { projectId } = useParams()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Hold Points</h1>
        <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
          Notify Hold Point
        </button>
      </div>
      <p className="text-muted-foreground">
        Track and release hold points for project {projectId}.
      </p>
      {/* Hold point list, notification workflow, release tracking will be here */}
    </div>
  )
}

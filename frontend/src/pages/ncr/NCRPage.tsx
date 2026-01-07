import { useParams } from 'react-router-dom'

export function NCRPage() {
  const { projectId } = useParams()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Non-Conformance Reports</h1>
        <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
          Raise NCR
        </button>
      </div>
      <p className="text-muted-foreground">
        Manage NCR lifecycle for project {projectId}.
      </p>
      {/* NCR list, status tracking, closure workflow will be here */}
    </div>
  )
}

import { useParams } from 'react-router-dom'

export function ITPPage() {
  const { projectId } = useParams()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Inspection & Test Plans</h1>
        <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
          Create ITP Template
        </button>
      </div>
      <p className="text-muted-foreground">
        Manage ITP templates and completions for project {projectId}.
      </p>
      {/* ITP template list and completion tracking will be implemented here */}
    </div>
  )
}

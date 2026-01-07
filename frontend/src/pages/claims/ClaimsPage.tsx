import { useParams } from 'react-router-dom'

export function ClaimsPage() {
  const { projectId } = useParams()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Progress Claims</h1>
        <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
          New Claim
        </button>
      </div>
      <p className="text-muted-foreground">
        SOPA-compliant progress claims for project {projectId}.
      </p>
      {/* Claim preparation, lot selection, evidence packages will be here */}
    </div>
  )
}

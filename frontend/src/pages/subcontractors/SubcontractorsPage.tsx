import { useParams } from 'react-router-dom'

export function SubcontractorsPage() {
  const { projectId } = useParams()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Subcontractors</h1>
        <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
          Invite Subcontractor
        </button>
      </div>
      <p className="text-muted-foreground">
        Subcontractor portal for project {projectId}.
      </p>
      {/* Subcontractor list, docket submission, employee roster, plant register will be here */}
    </div>
  )
}

import { useParams } from 'react-router-dom'

export function LotsPage() {
  const { projectId } = useParams()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Lot Register</h1>
        <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
          Create Lot
        </button>
      </div>
      <p className="text-muted-foreground">
        Manage lots for project {projectId}. The lot is the atomic unit of the system.
      </p>
      {/* Lot register, linear map, and lot list will be implemented here */}
    </div>
  )
}

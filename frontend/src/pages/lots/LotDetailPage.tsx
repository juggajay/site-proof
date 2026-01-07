import { useParams } from 'react-router-dom'

export function LotDetailPage() {
  const { projectId, lotId } = useParams()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Lot Details</h1>
      <p className="text-muted-foreground">
        Lot {lotId} in project {projectId}
      </p>
      {/* Lot details, linked evidence, ITP completions, photos, tests will be here */}
    </div>
  )
}

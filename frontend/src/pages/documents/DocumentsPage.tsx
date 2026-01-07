import { useParams } from 'react-router-dom'

export function DocumentsPage() {
  const { projectId } = useParams()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Documents & Photos</h1>
        <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
          Upload
        </button>
      </div>
      <p className="text-muted-foreground">
        Document and photo storage for project {projectId}.
      </p>
      {/* Document browser, photo gallery, linking to lots will be here */}
    </div>
  )
}

import { MapPin } from 'lucide-react'

interface AreasTabProps {
  projectId: string
}

export function AreasTab({ projectId }: AreasTabProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">Project Areas</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Define areas or zones within your project for organization and reporting.
        </p>
        <a
          href={`/projects/${projectId}/areas`}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          <MapPin className="h-4 w-4" />
          Manage Areas
        </a>
      </div>
    </div>
  )
}

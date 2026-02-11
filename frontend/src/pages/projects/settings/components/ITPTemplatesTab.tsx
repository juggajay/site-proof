import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import type { ITPTemplate } from '../types'

interface ITPTemplatesTabProps {
  projectId: string
}

export function ITPTemplatesTab({ projectId }: ITPTemplatesTabProps) {
  const navigate = useNavigate()
  const [itpTemplates, setItpTemplates] = useState<ITPTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // Fetch ITP templates on mount
  useEffect(() => {
    async function fetchItpTemplates() {
      if (!projectId) return

      setLoadingTemplates(true)

      try {
        const data = await apiFetch<{ templates: ITPTemplate[] }>(`/api/itp/templates?projectId=${projectId}&includeGlobal=true`)
        setItpTemplates(data.templates || [])
      } catch (error) {
        console.error('Failed to fetch ITP templates:', error)
      } finally {
        setLoadingTemplates(false)
      }
    }

    fetchItpTemplates()
  }, [projectId])

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">ITP Templates</h2>
            <p className="text-sm text-muted-foreground">
              Manage Inspection and Test Plan templates for this project.
            </p>
          </div>
          <button
            onClick={() => navigate(`/projects/${projectId}/itp`)}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Manage Templates
          </button>
        </div>
        {loadingTemplates ? (
          <div className="flex justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : itpTemplates.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No ITP templates found for this project.</p>
            <button
              onClick={() => navigate(`/projects/${projectId}/itp`)}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            >
              Create Your First Template
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {itpTemplates.map((template) => (
              <div key={template.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{template.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {template.checklistItems?.length || 0} checklist items • {template.activityType || 'General'}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  template.isActive !== false
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {template.isActive !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">Import Templates</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Import ITP templates from specification sets or other projects.
        </p>
        <button
          onClick={() => navigate(`/projects/${projectId}/itp`)}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
        >
          Go to ITP Page to Import
        </button>
      </div>
    </div>
  )
}

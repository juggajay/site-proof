import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getAuthToken } from '@/lib/auth'

interface ChecklistItem {
  id?: string
  description: string
  category: string
  responsibleParty: 'contractor' | 'subcontractor' | 'superintendent' | 'general'
  isHoldPoint: boolean
  pointType: 'standard' | 'witness' | 'hold_point'
  evidenceRequired: 'none' | 'photo' | 'test' | 'document'
  verificationMethod?: string
  acceptanceCriteria?: string
  testType?: string
  order: number
}

interface ITPTemplate {
  id: string
  name: string
  description: string | null
  activityType: string
  checklistItems: ChecklistItem[]
  createdAt: string
  isGlobalTemplate?: boolean
  stateSpec?: string | null
  isActive?: boolean
}

interface CrossProjectTemplate {
  id: string
  name: string
  description: string | null
  activityType: string
  checklistItemCount: number
  holdPointCount: number
}

interface ProjectWithTemplates {
  id: string
  name: string
  code: string
  templates: CrossProjectTemplate[]
}

export function ITPPage() {
  const { projectId } = useParams()
  const [templates, setTemplates] = useState<ITPTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [includeGlobalTemplates, setIncludeGlobalTemplates] = useState(true)
  const [projectSpecificationSet, setProjectSpecificationSet] = useState<string | null>(null)
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>('')

  const token = getAuthToken()
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  useEffect(() => {
    async function fetchTemplates() {
      if (!projectId || !token) return

      try {
        const url = `${apiUrl}/api/itp/templates?projectId=${projectId}&includeGlobal=${includeGlobalTemplates}`
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setTemplates(data.templates || [])
          setProjectSpecificationSet(data.projectSpecificationSet || null)
        }
      } catch (err) {
        console.error('Failed to fetch ITP templates:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTemplates()
  }, [projectId, token, apiUrl, includeGlobalTemplates])

  const handleCreateTemplate = async (data: {
    name: string
    description: string
    activityType: string
    checklistItems: Omit<ChecklistItem, 'id' | 'order'>[]
  }) => {
    if (!projectId || !token) return

    setCreating(true)
    try {
      const response = await fetch(`${apiUrl}/api/itp/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          ...data,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setTemplates([result.template, ...templates])
        setShowCreateModal(false)
      }
    } catch (err) {
      console.error('Failed to create template:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (template: ITPTemplate) => {
    if (!token || template.isGlobalTemplate) return

    try {
      const response = await fetch(`${apiUrl}/api/itp/templates/${template.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive: !template.isActive,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setTemplates(prev =>
          prev.map(t => t.id === template.id ? { ...t, isActive: result.template.isActive } : t)
        )
      }
    } catch (err) {
      console.error('Failed to toggle template status:', err)
    }
  }

  const handleCloneTemplate = async (template: ITPTemplate) => {
    if (!token || !projectId) return

    try {
      const response = await fetch(`${apiUrl}/api/itp/templates/${template.id}/clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setTemplates(prev => [result.template, ...prev])
      }
    } catch (err) {
      console.error('Failed to clone template:', err)
    }
  }

  const handleImportTemplate = async (templateId: string) => {
    if (!token || !projectId) return

    try {
      const response = await fetch(`${apiUrl}/api/itp/templates/${templateId}/clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setTemplates(prev => [result.template, ...prev])
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to import template:', err)
      return false
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inspection & Test Plans</h1>
          <p className="text-muted-foreground mt-1">
            Manage ITP templates for quality checkpoints
            {projectSpecificationSet && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                {projectSpecificationSet}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="rounded-lg border px-4 py-2 hover:bg-muted"
          >
            Import from Project
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Create ITP Template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-6 pb-2 border-b">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeGlobalTemplates}
            onChange={(e) => setIncludeGlobalTemplates(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm">
            Include {projectSpecificationSet || 'MRTS'} library templates
          </span>
        </label>

        {/* Activity Type Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Activity Type:</label>
          <select
            value={activityTypeFilter}
            onChange={(e) => setActivityTypeFilter(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="">All Activities</option>
            {[...new Set(templates.map(t => t.activityType))].sort().map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border p-8 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-semibold mb-2">No ITP Templates</h3>
          <p className="text-muted-foreground mb-4">
            Create ITP templates to define quality checkpoints for different activity types.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Create Your First Template
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates
            .filter(t => !activityTypeFilter || t.activityType === activityTypeFilter)
            .map((template) => (
            <div
              key={template.id}
              className={`rounded-lg border p-4 transition-colors ${
                template.isActive === false ? 'opacity-60 bg-muted/30' : 'hover:border-primary/50'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold">{template.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {template.isGlobalTemplate && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        {template.stateSpec || 'Library'} Template
                      </span>
                    )}
                    {template.isActive === false && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs bg-muted px-2 py-1 rounded">{template.activityType}</span>
              </div>
              {template.description && (
                <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {template.checklistItems.length} checklist items
                </span>
                <span className="text-xs text-muted-foreground">
                  {template.checklistItems.filter(i => i.isHoldPoint).length} hold points
                </span>
              </div>
              <div className="mt-3 pt-3 border-t flex items-center justify-between">
                <button
                  onClick={() => handleCloneTemplate(template)}
                  className="text-xs px-2 py-1 rounded border hover:bg-muted"
                  title="Clone template"
                >
                  Copy
                </button>
                {!template.isGlobalTemplate && (
                  <button
                    onClick={() => handleToggleActive(template)}
                    className={`text-xs px-2 py-1 rounded ${
                      template.isActive !== false
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {template.isActive !== false ? 'Active' : 'Inactive'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateTemplateModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTemplate}
          loading={creating}
        />
      )}

      {showImportModal && projectId && (
        <ImportFromProjectModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportTemplate}
          currentProjectId={projectId}
          apiUrl={apiUrl}
          token={token || ''}
        />
      )}
    </div>
  )
}

function CreateTemplateModal({
  onClose,
  onSubmit,
  loading,
}: {
  onClose: () => void
  onSubmit: (data: {
    name: string
    description: string
    activityType: string
    checklistItems: Omit<ChecklistItem, 'id' | 'order'>[]
  }) => void
  loading: boolean
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [activityType, setActivityType] = useState('')
  const [checklistItems, setChecklistItems] = useState<Omit<ChecklistItem, 'id' | 'order'>[]>([
    { description: '', category: 'general', responsibleParty: 'contractor', isHoldPoint: false, pointType: 'standard', evidenceRequired: 'none' }
  ])

  const handleAddItem = () => {
    setChecklistItems([...checklistItems, { description: '', category: 'general', responsibleParty: 'contractor', isHoldPoint: false, pointType: 'standard', evidenceRequired: 'none' }])
  }

  const handleRemoveItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...checklistItems]
    updated[index] = { ...updated[index], [field]: value }
    setChecklistItems(updated)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validItems = checklistItems.filter(item => item.description.trim())
    onSubmit({ name, description, activityType, checklistItems: validItems })
  }

  const activityTypes = ['Earthworks', 'Drainage', 'Pavement', 'Concrete', 'Structures', 'General']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Create ITP Template</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Template Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="e.g., Earthworks ITP"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Activity Type *</label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                required
              >
                <option value="">Select activity type</option>
                {activityTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
              placeholder="Optional description of this ITP template"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Checklist Items</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-sm text-primary hover:underline"
              >
                + Add Item
              </button>
            </div>
            <div className="space-y-3">
              {checklistItems.map((item, index) => (
                <div key={index} className="flex items-start gap-2 p-3 border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="Checklist item description"
                    />
                    <div className="flex items-center gap-4">
                      <select
                        value={item.responsibleParty || 'contractor'}
                        onChange={(e) => {
                          handleItemChange(index, 'responsibleParty', e.target.value)
                          handleItemChange(index, 'category', e.target.value)
                        }}
                        className="px-2 py-1 border rounded text-sm"
                      >
                        <option value="contractor">Contractor</option>
                        <option value="subcontractor">Subcontractor</option>
                        <option value="superintendent">Superintendent</option>
                      </select>
                      <select
                        value={item.pointType || 'standard'}
                        onChange={(e) => {
                          const newPointType = e.target.value as 'standard' | 'witness' | 'hold_point'
                          handleItemChange(index, 'pointType', newPointType)
                          handleItemChange(index, 'isHoldPoint', newPointType === 'hold_point')
                        }}
                        className="px-2 py-1 text-sm border rounded"
                      >
                        <option value="standard">S - Standard</option>
                        <option value="witness">W - Witness</option>
                        <option value="hold_point">H - Hold Point</option>
                      </select>
                      <select
                        value={item.evidenceRequired || 'none'}
                        onChange={(e) => handleItemChange(index, 'evidenceRequired', e.target.value)}
                        className="px-2 py-1 text-sm border rounded"
                      >
                        <option value="none">No Evidence</option>
                        <option value="photo">📷 Photo</option>
                        <option value="test">🧪 Test</option>
                        <option value="document">📄 Document</option>
                      </select>
                      {item.evidenceRequired === 'test' && (
                        <input
                          type="text"
                          value={item.testType || ''}
                          onChange={(e) => handleItemChange(index, 'testType', e.target.value)}
                          className="px-2 py-1 text-sm border rounded w-28"
                          placeholder="Test type"
                        />
                      )}
                    </div>
                  </div>
                  {checklistItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-muted"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              disabled={loading || !name || !activityType}
            >
              {loading ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ImportFromProjectModal({
  onClose,
  onImport,
  currentProjectId,
  apiUrl,
  token,
}: {
  onClose: () => void
  onImport: (templateId: string) => Promise<boolean>
  currentProjectId: string
  apiUrl: string
  token: string
}) {
  const [projects, setProjects] = useState<ProjectWithTemplates[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [importedTemplates, setImportedTemplates] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetchCrossProjectTemplates() {
      try {
        const response = await fetch(
          `${apiUrl}/api/itp/templates/cross-project?currentProjectId=${currentProjectId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (response.ok) {
          const data = await response.json()
          setProjects(data.projects || [])
          if (data.projects?.length > 0) {
            setSelectedProject(data.projects[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to fetch cross-project templates:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchCrossProjectTemplates()
  }, [apiUrl, token, currentProjectId])

  const handleImport = async (templateId: string) => {
    setImporting(templateId)
    const success = await onImport(templateId)
    if (success) {
      setImportedTemplates(prev => new Set(prev).add(templateId))
    }
    setImporting(null)
  }

  const currentProject = projects.find(p => p.id === selectedProject)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Import ITP Template from Another Project</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-semibold mb-2">No Templates Available</h3>
            <p className="text-muted-foreground">
              There are no ITP templates in other projects that you can import.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Select Project</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.code}) - {project.templates.length} template(s)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-lg">
              {currentProject?.templates.map((template) => (
                <div
                  key={template.id}
                  className="p-4 border-b last:border-b-0 flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-medium">{template.name}</h4>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span className="bg-muted px-2 py-0.5 rounded">{template.activityType}</span>
                      <span>{template.checklistItemCount} checklist items</span>
                      <span>{template.holdPointCount} hold points</span>
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleImport(template.id)}
                    disabled={importing === template.id || importedTemplates.has(template.id)}
                    className={`px-3 py-1.5 rounded text-sm ${
                      importedTemplates.has(template.id)
                        ? 'bg-green-100 text-green-700'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    } disabled:opacity-50`}
                  >
                    {importing === template.id
                      ? 'Importing...'
                      : importedTemplates.has(template.id)
                      ? '✓ Imported'
                      : 'Import'}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end mt-4 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

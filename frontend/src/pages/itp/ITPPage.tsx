import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getAuthToken } from '@/lib/auth'

interface ChecklistItem {
  id?: string
  description: string
  category: string
  isHoldPoint: boolean
  verificationMethod?: string
  acceptanceCriteria?: string
  order: number
}

interface ITPTemplate {
  id: string
  name: string
  description: string | null
  activityType: string
  checklistItems: ChecklistItem[]
  createdAt: string
}

export function ITPPage() {
  const { projectId } = useParams()
  const [templates, setTemplates] = useState<ITPTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)

  const token = getAuthToken()
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  useEffect(() => {
    async function fetchTemplates() {
      if (!projectId || !token) return

      try {
        const response = await fetch(`${apiUrl}/api/itp/templates?projectId=${projectId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setTemplates(data.templates || [])
        }
      } catch (err) {
        console.error('Failed to fetch ITP templates:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTemplates()
  }, [projectId, token, apiUrl])

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inspection & Test Plans</h1>
          <p className="text-muted-foreground mt-1">
            Manage ITP templates for quality checkpoints
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Create ITP Template
        </button>
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
          {templates.map((template) => (
            <div key={template.id} className="rounded-lg border p-4 hover:border-primary/50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold">{template.name}</h3>
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
    { description: '', category: 'general', isHoldPoint: false }
  ])

  const handleAddItem = () => {
    setChecklistItems([...checklistItems, { description: '', category: 'general', isHoldPoint: false }])
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
                        value={item.category}
                        onChange={(e) => handleItemChange(index, 'category', e.target.value)}
                        className="px-2 py-1 border rounded text-sm"
                      >
                        <option value="general">General</option>
                        <option value="materials">Materials</option>
                        <option value="workmanship">Workmanship</option>
                        <option value="testing">Testing</option>
                        <option value="documentation">Documentation</option>
                      </select>
                      <label className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={item.isHoldPoint}
                          onChange={(e) => handleItemChange(index, 'isHoldPoint', e.target.checked)}
                          className="rounded"
                        />
                        Hold Point
                      </label>
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

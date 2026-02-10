import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from '@/components/ui/toaster'
import { apiFetch } from '@/lib/api'
import { MapPin, Plus, Trash2, Edit2, X, Palette } from 'lucide-react'

interface ProjectArea {
  id: string
  name: string
  chainageStart: number | null
  chainageEnd: number | null
  colour: string | null
  createdAt: string
}

const COLOUR_OPTIONS = [
  { value: '#3B82F6', label: 'Blue' },
  { value: '#22C55E', label: 'Green' },
  { value: '#EAB308', label: 'Yellow' },
  { value: '#F97316', label: 'Orange' },
  { value: '#EF4444', label: 'Red' },
  { value: '#A855F7', label: 'Purple' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#14B8A6', label: 'Teal' },
  { value: '#6B7280', label: 'Gray' },
]

export function ProjectAreasPage() {
  const { projectId } = useParams()
  const [areas, setAreas] = useState<ProjectArea[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingArea, setEditingArea] = useState<ProjectArea | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formChainageStart, setFormChainageStart] = useState('')
  const [formChainageEnd, setFormChainageEnd] = useState('')
  const [formColour, setFormColour] = useState('#3B82F6')

  // Fetch areas
  useEffect(() => {
    async function fetchAreas() {
      if (!projectId) return

      try {
        const data = await apiFetch<{ areas: ProjectArea[] }>(`/api/projects/${projectId}/areas`)
        setAreas(data.areas || [])
      } catch (err) {
        console.error('Failed to fetch project areas:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAreas()
  }, [projectId])

  const resetForm = () => {
    setFormName('')
    setFormChainageStart('')
    setFormChainageEnd('')
    setFormColour('#3B82F6')
  }

  const openAddModal = () => {
    resetForm()
    setEditingArea(null)
    setShowAddModal(true)
  }

  const openEditModal = (area: ProjectArea) => {
    setFormName(area.name)
    setFormChainageStart(area.chainageStart != null ? String(area.chainageStart) : '')
    setFormChainageEnd(area.chainageEnd != null ? String(area.chainageEnd) : '')
    setFormColour(area.colour || '#3B82F6')
    setEditingArea(area)
    setShowAddModal(true)
  }

  const closeModal = () => {
    setShowAddModal(false)
    setEditingArea(null)
    resetForm()
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({
        title: 'Error',
        description: 'Area name is required',
        variant: 'error',
      })
      return
    }

    setSaving(true)

    try {
      const body = {
        name: formName.trim(),
        chainageStart: formChainageStart ? parseFloat(formChainageStart) : null,
        chainageEnd: formChainageEnd ? parseFloat(formChainageEnd) : null,
        colour: formColour,
      }

      const path = editingArea
        ? `/api/projects/${projectId}/areas/${editingArea.id}`
        : `/api/projects/${projectId}/areas`

      const data = await apiFetch<{ area: ProjectArea }>(path, {
        method: editingArea ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })

      if (editingArea) {
        setAreas(prev => prev.map(a => a.id === editingArea.id ? data.area : a))
        toast({
          title: 'Area updated',
          description: `${data.area.name} has been updated.`,
        })
      } else {
        setAreas(prev => [...prev, data.area])
        toast({
          title: 'Area created',
          description: `${data.area.name} has been added to the project.`,
        })
      }
      closeModal()
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to save area',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (area: ProjectArea) => {
    if (!confirm(`Are you sure you want to delete "${area.name}"?`)) {
      return
    }

    setDeletingId(area.id)

    try {
      await apiFetch(`/api/projects/${projectId}/areas/${area.id}`, {
        method: 'DELETE',
      })
      setAreas(prev => prev.filter(a => a.id !== area.id))
      toast({
        title: 'Area deleted',
        description: `${area.name} has been removed.`,
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete area',
        variant: 'error',
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Project Areas</h1>
          <p className="text-muted-foreground">Define areas or zones within the project chainage</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Area
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : areas.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <MapPin className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No areas defined</h3>
          <p className="mt-2 text-muted-foreground">
            Create areas to organize your project by chainage ranges.
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Add First Area
          </button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium">Colour</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Area Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Chainage Start</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Chainage End</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {areas.map((area) => (
                <tr key={area.id} className="hover:bg-muted/25">
                  <td className="px-4 py-3">
                    <div
                      className="h-6 w-6 rounded-full border"
                      style={{ backgroundColor: area.colour || '#6B7280' }}
                      title={area.colour || 'No colour'}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{area.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {area.chainageStart != null ? `${area.chainageStart.toLocaleString()}m` : '-'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {area.chainageEnd != null ? `${area.chainageEnd.toLocaleString()}m` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(area)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(area)}
                        disabled={deletingId === area.id}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Area Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-background rounded-lg shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingArea ? 'Edit Area' : 'Add Area'}
              </h2>
              <button onClick={closeModal} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Area Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Section A, Zone 1"
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Chainage Start (m)</label>
                  <input
                    type="number"
                    value={formChainageStart}
                    onChange={(e) => setFormChainageStart(e.target.value)}
                    placeholder="0"
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Chainage End (m)</label>
                  <input
                    type="number"
                    value={formChainageEnd}
                    onChange={(e) => setFormChainageEnd(e.target.value)}
                    placeholder="1000"
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  <div className="flex items-center gap-1.5">
                    <Palette className="h-4 w-4" />
                    Colour
                  </div>
                </label>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {COLOUR_OPTIONS.map((colour) => (
                    <button
                      key={colour.value}
                      type="button"
                      onClick={() => setFormColour(colour.value)}
                      className={`h-8 w-8 rounded-full border-2 transition-transform ${
                        formColour === colour.value
                          ? 'border-gray-900 dark:border-white scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: colour.value }}
                      title={colour.label}
                      data-testid={`color-preset-${colour.label.toLowerCase()}`}
                    />
                  ))}
                  {/* Custom color picker */}
                  <div className="relative">
                    <input
                      type="color"
                      value={formColour}
                      onChange={(e) => setFormColour(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      data-testid="custom-color-picker"
                      title="Pick custom colour"
                    />
                    <div
                      className={`h-8 w-8 rounded-full border-2 flex items-center justify-center bg-gradient-to-br from-red-500 via-green-500 to-blue-500 ${
                        !COLOUR_OPTIONS.some(c => c.value === formColour)
                          ? 'border-gray-900 dark:border-white scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      title="Custom colour"
                    >
                      <Plus className="h-4 w-4 text-white drop-shadow" />
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className="h-6 w-6 rounded border"
                    style={{ backgroundColor: formColour }}
                  />
                  <span className="text-sm text-muted-foreground" data-testid="selected-color-value">
                    Selected: {formColour}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm border rounded hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim()}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingArea ? 'Update Area' : 'Add Area'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

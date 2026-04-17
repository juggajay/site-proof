import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from '@/components/ui/toaster'
import { apiFetch } from '@/lib/api'
import { MapPin, Plus, Trash2, Edit2, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'

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
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4" />
          Add Area
        </Button>
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
          <Button onClick={openAddModal} className="mt-4">
            Add First Area
          </Button>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(area)}
                        className="text-primary hover:bg-primary/5"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(area)}
                        disabled={deletingId === area.id}
                        className="text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
        <Modal onClose={closeModal}>
          <ModalHeader>{editingArea ? 'Edit Area' : 'Add Area'}</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <Label className="mb-1">Area Name *</Label>
                <Input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Section A, Zone 1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1">Chainage Start (m)</Label>
                  <Input
                    type="number"
                    value={formChainageStart}
                    onChange={(e) => setFormChainageStart(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="mb-1">Chainage End (m)</Label>
                  <Input
                    type="number"
                    value={formChainageEnd}
                    onChange={(e) => setFormChainageEnd(e.target.value)}
                    placeholder="1000"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-1">
                  <div className="flex items-center gap-1.5">
                    <Palette className="h-4 w-4" />
                    Colour
                  </div>
                </Label>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {COLOUR_OPTIONS.map((colour) => (
                    <button
                      key={colour.value}
                      type="button"
                      onClick={() => setFormColour(colour.value)}
                      className={`h-8 w-8 rounded-full border-2 transition-transform ${
                        formColour === colour.value
                          ? 'border-foreground scale-110'
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
                          ? 'border-foreground scale-110'
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
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formName.trim()}
            >
              {saving ? 'Saving...' : editingArea ? 'Update Area' : 'Add Area'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  )
}

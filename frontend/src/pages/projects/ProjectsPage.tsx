import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, getAuthToken } from '../../lib/auth'
import { X } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004'

interface Project {
  id: string
  name: string
  projectNumber: string
  status: string
  startDate?: string
  targetCompletion?: string
  createdAt: string
}

const STATE_OPTIONS = [
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'NT', label: 'Northern Territory' },
  { value: 'ACT', label: 'Australian Capital Territory' },
]

const SPEC_SET_OPTIONS = [
  { value: 'austroads', label: 'Austroads' },
  { value: 'mrts', label: 'MRTS (QLD)' },
  { value: 'rms', label: 'RMS (NSW)' },
  { value: 'vicroads', label: 'VicRoads' },
  { value: 'mainroads_wa', label: 'Main Roads WA' },
  { value: 'custom', label: 'Custom' },
]

export function ProjectsPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    projectNumber: '',
    client: '',
    state: '',
    specSet: '',
  })

  useEffect(() => {
    const fetchProjects = async () => {
      const token = getAuthToken()
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`${API_URL}/api/projects`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch projects')
        }

        const data = await response.json()
        setProjects(data.projects)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load projects')
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchProjects()
    }
  }, [user])

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)

    const token = getAuthToken()
    if (!token) {
      setCreateError('Not authenticated')
      setCreating(false)
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          projectNumber: formData.projectNumber || null,
          clientName: formData.client || null,
          state: formData.state || null,
          specificationSet: formData.specSet || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to create project')
      }

      const data = await response.json()
      // Add new project to list
      setProjects((prev) => [...prev, data.project])
      // Reset form and close modal
      setFormData({ name: '', projectNumber: '', client: '', state: '', specSet: '' })
      setShowCreateModal(false)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Projects</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          New Project
        </button>
      </div>
      <p className="text-muted-foreground">
        Manage your civil construction projects.
      </p>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Create New Project</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-muted rounded"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Highway Upgrade Project"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label htmlFor="projectNumber" className="block text-sm font-medium mb-1">
                  Project Number *
                </label>
                <input
                  type="text"
                  id="projectNumber"
                  name="projectNumber"
                  value={formData.projectNumber}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., PRJ-2024-001"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label htmlFor="client" className="block text-sm font-medium mb-1">
                  Client
                </label>
                <input
                  type="text"
                  id="client"
                  name="client"
                  value={formData.client}
                  onChange={handleInputChange}
                  placeholder="e.g., Department of Transport"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label htmlFor="state" className="block text-sm font-medium mb-1">
                  State
                </label>
                <select
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="">Select state</option>
                  {STATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="specSet" className="block text-sm font-medium mb-1">
                  Specification Set
                </label>
                <select
                  id="specSet"
                  name="specSet"
                  value={formData.specSet}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="">Select specification set</option>
                  {SPEC_SET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !formData.name || !formData.projectNumber}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border">
          <h3 className="text-lg font-medium">No projects found</h3>
          <p className="mt-1 text-muted-foreground">Create a new project to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}/ncr`}
              className="block p-6 bg-card rounded-lg border hover:border-primary hover:shadow-md transition-all"
            >
              <h3 className="text-lg font-semibold">{project.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{project.projectNumber}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  project.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {project.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  Click to view NCRs
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

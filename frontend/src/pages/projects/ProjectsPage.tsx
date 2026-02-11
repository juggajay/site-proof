import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { apiFetch } from '@/lib/api'
import { X } from 'lucide-react'

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
  { value: 'Austroads', label: 'Austroads (National)' },
  { value: 'TfNSW', label: 'TfNSW (NSW)' },
  { value: 'MRTS', label: 'MRTS (QLD)' },
  { value: 'VicRoads', label: 'VicRoads (VIC)' },
  { value: 'DIT', label: 'DIT (SA)' },
  { value: 'MRWA', label: 'Main Roads WA' },
  { value: 'custom', label: 'Custom' },
]

// Status configuration with colors and descriptions
const STATUS_CONFIG: Record<string, { color: string; bgColor: string; description: string }> = {
  active: {
    color: 'text-green-800 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    description: 'Project is currently in progress with ongoing work',
  },
  completed: {
    color: 'text-blue-800 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    description: 'Project has been completed successfully',
  },
  on_hold: {
    color: 'text-amber-800 dark:text-amber-300',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    description: 'Project is temporarily paused',
  },
  pending: {
    color: 'text-purple-800 dark:text-purple-300',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    description: 'Project is awaiting approval or resources to start',
  },
  cancelled: {
    color: 'text-red-800 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    description: 'Project has been cancelled',
  },
  draft: {
    color: 'text-gray-800 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-700',
    description: 'Project is in draft status, not yet active',
  },
}

const DEFAULT_STATUS_CONFIG = {
  color: 'text-gray-800 dark:text-gray-300',
  bgColor: 'bg-gray-100 dark:bg-gray-700',
  description: 'Project status',
}

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
    startDate: '',
    targetCompletion: '',
    contractValue: '',
  })

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await apiFetch<{ projects: Project[] }>('/api/projects')
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

    try {
      const data = await apiFetch<{ project: Project }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          projectNumber: formData.projectNumber || null,
          clientName: formData.client || null,
          state: formData.state || null,
          specificationSet: formData.specSet || null,
          startDate: formData.startDate || null,
          targetCompletion: formData.targetCompletion || null,
          contractValue: formData.contractValue || null,
        }),
      })

      // Add new project to list
      setProjects((prev) => [...prev, data.project])
      // Reset form and close modal
      setFormData({ name: '', projectNumber: '', client: '', state: '', specSet: '', startDate: '', targetCompletion: '', contractValue: '' })
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
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-4 w-64 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
          <div className="h-10 w-32 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
        {/* Projects grid skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="flex gap-2 pt-2">
                <div className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
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
      {showCreateModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
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
                <label htmlFor="contractValue" className="block text-sm font-medium mb-1">
                  Contract Value ($)
                </label>
                <input
                  type="number"
                  id="contractValue"
                  name="contractValue"
                  value={formData.contractValue}
                  onChange={handleInputChange}
                  placeholder="e.g., 5000000"
                  className="w-full rounded-lg border px-3 py-2"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label htmlFor="startDate" className="block text-sm font-medium mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label htmlFor="targetCompletion" className="block text-sm font-medium mb-1">
                  Target Completion
                </label>
                <input
                  type="date"
                  id="targetCompletion"
                  name="targetCompletion"
                  value={formData.targetCompletion}
                  onChange={handleInputChange}
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
        </div>,
        document.body
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
              to={`/projects/${project.id}`}
              className="block p-6 bg-card rounded-lg border hover:border-primary hover:shadow-md transition-all"
            >
              <h3 className="text-lg font-semibold">{project.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{project.projectNumber}</p>
              <div className="mt-4 flex items-center justify-between">
                {(() => {
                  const statusKey = project.status?.toLowerCase() || 'draft'
                  const config = STATUS_CONFIG[statusKey] || DEFAULT_STATUS_CONFIG
                  return (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color} cursor-help`}
                      title={config.description}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          statusKey === 'active' ? 'bg-green-500' :
                          statusKey === 'completed' ? 'bg-blue-500' :
                          statusKey === 'on_hold' ? 'bg-amber-500' :
                          statusKey === 'pending' ? 'bg-purple-500' :
                          statusKey === 'cancelled' ? 'bg-red-500' :
                          'bg-gray-500'
                        }`} />
                        {project.status || 'Draft'}
                      </span>
                    </span>
                  )
                })()}
                <span className="text-xs text-muted-foreground">
                  View project →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

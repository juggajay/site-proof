import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'
import { extractErrorMessage } from '@/lib/errorHandling'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Modal, ModalHeader, ModalBody } from '@/components/ui/Modal'

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
  const queryClient = useQueryClient()

  const { data: projectsData, isLoading: loading, error: queryError } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => apiFetch<{ projects: Project[] }>('/api/projects'),
    enabled: !!user,
  })

  const projects = projectsData?.projects || []
  const error = queryError ? extractErrorMessage(queryError, 'Failed to load projects') : null

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
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

  const createProjectMutation = useMutation({
    mutationFn: (projectData: typeof formData) =>
      apiFetch<{ project: Project }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: projectData.name,
          projectNumber: projectData.projectNumber || null,
          clientName: projectData.client || null,
          state: projectData.state || null,
          specificationSet: projectData.specSet || null,
          startDate: projectData.startDate || null,
          targetCompletion: projectData.targetCompletion || null,
          contractValue: projectData.contractValue || null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects })
      setFormData({ name: '', projectNumber: '', client: '', state: '', specSet: '', startDate: '', targetCompletion: '', contractValue: '' })
      setShowCreateModal(false)
      setCreateError(null)
    },
    onError: (err) => {
      setCreateError(extractErrorMessage(err, 'Failed to create project'))
    },
  })

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    createProjectMutation.mutate(formData)
  }

  const creating = createProjectMutation.isPending

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
        <Button onClick={() => setShowCreateModal(true)}>
          New Project
        </Button>
      </div>
      <p className="text-muted-foreground">
        Manage your civil construction projects.
      </p>

      {/* Create Project Modal */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)} className="max-w-lg">
          <ModalHeader>Create New Project</ModalHeader>
          <ModalBody>
            {createError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <Label htmlFor="name" className="mb-1">Project Name *</Label>
                <Input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Highway Upgrade Project"
                />
              </div>

              <div>
                <Label htmlFor="projectNumber" className="mb-1">Project Number *</Label>
                <Input
                  type="text"
                  id="projectNumber"
                  name="projectNumber"
                  value={formData.projectNumber}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., PRJ-2024-001"
                />
              </div>

              <div>
                <Label htmlFor="client" className="mb-1">Client</Label>
                <Input
                  type="text"
                  id="client"
                  name="client"
                  value={formData.client}
                  onChange={handleInputChange}
                  placeholder="e.g., Department of Transport"
                />
              </div>

              <div>
                <Label htmlFor="contractValue" className="mb-1">Contract Value ($)</Label>
                <Input
                  type="number"
                  id="contractValue"
                  name="contractValue"
                  value={formData.contractValue}
                  onChange={handleInputChange}
                  placeholder="e.g., 5000000"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <Label htmlFor="startDate" className="mb-1">Start Date</Label>
                <Input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <Label htmlFor="targetCompletion" className="mb-1">Target Completion</Label>
                <Input
                  type="date"
                  id="targetCompletion"
                  name="targetCompletion"
                  value={formData.targetCompletion}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <Label htmlFor="state" className="mb-1">State</Label>
                <NativeSelect
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                >
                  <option value="">Select state</option>
                  {STATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div>
                <Label htmlFor="specSet" className="mb-1">Specification Set</Label>
                <NativeSelect
                  id="specSet"
                  name="specSet"
                  value={formData.specSet}
                  onChange={handleInputChange}
                >
                  <option value="">Select specification set</option>
                  {SPEC_SET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating || !formData.name || !formData.projectNumber}
                >
                  {creating ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </form>
          </ModalBody>
        </Modal>
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

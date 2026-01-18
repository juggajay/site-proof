import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getAuthToken } from '@/lib/auth'
import { Settings, Users, ClipboardList, Bell, AlertTriangle, Save, X, UserPlus, Archive, CheckCircle2 } from 'lucide-react'

interface Project {
  id: string
  name: string
  code: string
  status?: string
  startDate?: string | null
  targetCompletion?: string | null
  lotPrefix?: string
  lotStartingNumber?: number
  ncrPrefix?: string
  ncrStartingNumber?: number
  chainageStart?: number | null
  chainageEnd?: number | null
  workingHoursStart?: string | null
  workingHoursEnd?: string | null
  workingDays?: string[] | null
}

interface TeamMember {
  id: string
  userId: string
  email: string
  fullName?: string
  role: string
  status: string
  invitedAt: string
  acceptedAt?: string
}

type SettingsTab = 'general' | 'team' | 'itp-templates' | 'notifications'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'site_engineer', label: 'Site Engineer' },
  { value: 'quality_manager', label: 'Quality Manager' },
  { value: 'foreman', label: 'Foreman' },
  { value: 'viewer', label: 'Viewer' },
]

export function ProjectSettingsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  // Get active tab from URL or default to 'general'
  const activeTab = (searchParams.get('tab') as SettingsTab) || 'general'

  // Form state for General settings
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    lotPrefix: 'LOT-',
    lotStartingNumber: 1,
    ncrPrefix: 'NCR-',
    ncrStartingNumber: 1,
    chainageStart: 0,
    chainageEnd: 10000,
    workingHoursStart: '06:00',
    workingHoursEnd: '18:00',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Archive dialog state
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState('')

  // Complete project dialog state
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState('')

  // Team state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('site_engineer')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab })
  }

  useEffect(() => {
    async function fetchProject() {
      const token = getAuthToken()
      if (!token || !projectId) return

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002'

      try {
        const response = await fetch(`${apiUrl}/api/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (response.ok) {
          const data = await response.json()
          setProject(data.project)
          // Initialize form data from project
          setFormData({
            name: data.project.name || '',
            code: data.project.code || '',
            lotPrefix: data.project.lotPrefix || 'LOT-',
            lotStartingNumber: data.project.lotStartingNumber || 1,
            ncrPrefix: data.project.ncrPrefix || 'NCR-',
            ncrStartingNumber: data.project.ncrStartingNumber || 1,
            chainageStart: data.project.chainageStart ?? 0,
            chainageEnd: data.project.chainageEnd ?? 10000,
            workingHoursStart: data.project.workingHoursStart || '06:00',
            workingHoursEnd: data.project.workingHoursEnd || '18:00',
          })
        }
      } catch (error) {
        console.error('Failed to fetch project:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [projectId])

  // Fetch team members when team tab is active
  useEffect(() => {
    async function fetchTeamMembers() {
      if (activeTab !== 'team' || !projectId) return

      setLoadingTeam(true)
      const token = getAuthToken()
      if (!token) {
        setLoadingTeam(false)
        return
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002'

      try {
        const response = await fetch(`${apiUrl}/api/projects/${projectId}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (response.ok) {
          const data = await response.json()
          setTeamMembers(data.users || [])
        }
      } catch (error) {
        console.error('Failed to fetch team members:', error)
      } finally {
        setLoadingTeam(false)
      }
    }

    fetchTeamMembers()
  }, [activeTab, projectId])

  const handleDeleteClick = () => {
    setShowDeleteDialog(true)
    setDeletePassword('')
    setDeleteError('')
  }

  const handleCancelDelete = () => {
    setShowDeleteDialog(false)
    setDeletePassword('')
    setDeleteError('')
  }

  const handleConfirmDelete = async () => {
    if (!deletePassword) {
      setDeleteError('Password is required')
      return
    }

    setDeleting(true)
    setDeleteError('')

    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002'

    try {
      const response = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: deletePassword }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          setDeleteError('Incorrect password')
        } else {
          setDeleteError(data.message || 'Failed to delete project')
        }
        return
      }

      // Success - navigate to projects list
      navigate('/projects', { replace: true })
    } catch (error) {
      setDeleteError('Failed to delete project. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleArchiveClick = () => {
    setShowArchiveDialog(true)
    setArchiveError('')
  }

  const handleCancelArchive = () => {
    setShowArchiveDialog(false)
    setArchiveError('')
  }

  const handleConfirmArchive = async () => {
    setArchiving(true)
    setArchiveError('')

    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002'

    try {
      const newStatus = project?.status === 'archived' ? 'active' : 'archived'
      const response = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update project status')
      }

      // Update local project state
      setProject(prev => prev ? { ...prev, status: newStatus } : null)
      setShowArchiveDialog(false)
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : 'Failed to update project status')
    } finally {
      setArchiving(false)
    }
  }

  const handleCompleteClick = () => {
    setShowCompleteDialog(true)
    setCompleteError('')
  }

  const handleCancelComplete = () => {
    setShowCompleteDialog(false)
    setCompleteError('')
  }

  const handleConfirmComplete = async () => {
    setCompleting(true)
    setCompleteError('')

    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002'

    try {
      const newStatus = project?.status === 'completed' ? 'active' : 'completed'
      const response = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update project status')
      }

      // Update local project state
      setProject(prev => prev ? { ...prev, status: newStatus } : null)
      setShowCompleteDialog(false)
    } catch (error) {
      setCompleteError(error instanceof Error ? error.message : 'Failed to update project status')
    } finally {
      setCompleting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) || 0 : value,
    }))
    // Clear success message when user starts typing
    if (saveSuccess) setSaveSuccess(false)
  }

  const handleSaveSettings = async () => {
    setSaveError('')
    setSaveSuccess(false)

    // Client-side validation
    if (!formData.name.trim()) {
      setSaveError('Project name is required')
      return
    }

    if (formData.lotPrefix.length > 50) {
      setSaveError('Lot prefix must be 50 characters or less')
      return
    }

    if (formData.ncrPrefix.length > 50) {
      setSaveError('NCR prefix must be 50 characters or less')
      return
    }

    if (formData.lotStartingNumber < 0) {
      setSaveError('Lot starting number must be a positive number')
      return
    }

    if (formData.ncrStartingNumber < 0) {
      setSaveError('NCR starting number must be a positive number')
      return
    }

    if (formData.chainageStart < 0) {
      setSaveError('Chainage start must be a non-negative number')
      return
    }

    if (formData.chainageEnd < 0) {
      setSaveError('Chainage end must be a non-negative number')
      return
    }

    if (formData.chainageStart >= formData.chainageEnd) {
      setSaveError('Chainage end must be greater than chainage start')
      return
    }

    setSaving(true)

    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002'

    try {
      const response = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code,
          lotPrefix: formData.lotPrefix,
          lotStartingNumber: formData.lotStartingNumber,
          ncrPrefix: formData.ncrPrefix,
          ncrStartingNumber: formData.ncrStartingNumber,
          chainageStart: formData.chainageStart,
          chainageEnd: formData.chainageEnd,
          workingHoursStart: formData.workingHoursStart,
          workingHoursEnd: formData.workingHoursEnd,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to save settings')
      }

      const data = await response.json()
      setProject(data.project)
      setSaveSuccess(true)
      // Auto-hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenInviteModal = () => {
    setShowInviteModal(true)
    setInviteEmail('')
    setInviteRole('site_engineer')
    setInviteError('')
    setInviteSuccess('')
  }

  const handleInviteTeamMember = async () => {
    if (!inviteEmail.trim()) {
      setInviteError('Email is required')
      return
    }

    setInviting(true)
    setInviteError('')
    setInviteSuccess('')

    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002'

    try {
      const response = await fetch(`${apiUrl}/api/projects/${projectId}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to invite team member')
      }

      setInviteSuccess(`Invitation sent to ${inviteEmail}`)
      // Refresh team members list
      const refreshResponse = await fetch(`${apiUrl}/api/projects/${projectId}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        setTeamMembers(refreshData.users || [])
      }
      // Close modal after short delay
      setTimeout(() => {
        setShowInviteModal(false)
        setInviteSuccess('')
      }, 2000)
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Failed to invite team member')
    } finally {
      setInviting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const tabs = [
    { id: 'general' as SettingsTab, label: 'General', icon: Settings },
    { id: 'team' as SettingsTab, label: 'Team', icon: Users },
    { id: 'itp-templates' as SettingsTab, label: 'ITP Templates', icon: ClipboardList },
    { id: 'notifications' as SettingsTab, label: 'Notifications', icon: Bell },
  ]

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Project Settings</h1>
      <p className="text-muted-foreground mb-6">
        {project ? project.name : `Project ID: ${projectId}`}
      </p>

      {/* Tab Navigation */}
      <div className="border-b mb-6">
        <nav className="flex gap-4" aria-label="Settings sections">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
                }`}
                aria-selected={isActive}
                role="tab"
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6" role="tabpanel">
        {activeTab === 'general' && (
          <>
            {/* Save Status Messages */}
            {saveError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive mb-4">
                {saveError}
              </div>
            )}
            {saveSuccess && (
              <div className="rounded-lg bg-green-100 p-3 text-sm text-green-700 mb-4">
                Settings saved successfully!
              </div>
            )}

            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-2">General Settings</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Configure project name, number, and basic settings.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Project Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    placeholder="Project name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Project Code</label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    placeholder="PRJ-001"
                  />
                </div>
              </div>
              {(project?.startDate || project?.targetCompletion) && (
                <div className="mt-4 pt-4 border-t grid gap-4 sm:grid-cols-2">
                  {project?.startDate && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Start Date</label>
                      <div className="text-sm text-muted-foreground">
                        {new Date(project.startDate).toLocaleDateString('en-AU', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                  )}
                  {project?.targetCompletion && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Target Completion</label>
                      <div className="text-sm text-muted-foreground">
                        {new Date(project.targetCompletion).toLocaleDateString('en-AU', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-2">Lot Numbering</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Configure lot numbering convention and auto-increment settings.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Lot Prefix</label>
                  <input
                    type="text"
                    name="lotPrefix"
                    value={formData.lotPrefix}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    placeholder="LOT-"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Starting Number</label>
                  <input
                    type="number"
                    name="lotStartingNumber"
                    value={formData.lotStartingNumber}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    placeholder="1"
                  />
                </div>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-2">NCR Numbering</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Configure non-conformance report numbering convention.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">NCR Prefix</label>
                  <input
                    type="text"
                    name="ncrPrefix"
                    value={formData.ncrPrefix}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    placeholder="NCR-"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Starting Number</label>
                  <input
                    type="number"
                    name="ncrStartingNumber"
                    value={formData.ncrStartingNumber}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    placeholder="1"
                  />
                </div>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-2">Chainage Configuration</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Configure the chainage range for this project. Lot chainages will be constrained to this range.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Chainage Start (m)</label>
                  <input
                    type="number"
                    name="chainageStart"
                    value={formData.chainageStart}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Chainage End (m)</label>
                  <input
                    type="number"
                    name="chainageEnd"
                    value={formData.chainageEnd}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    placeholder="10000"
                    min="0"
                  />
                </div>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-2">Working Hours</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Configure the project's working hours for notifications and due date calculations.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time</label>
                  <input
                    type="time"
                    name="workingHoursStart"
                    value={formData.workingHoursStart}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Time</label>
                  <input
                    type="time"
                    name="workingHoursEnd"
                    value={formData.workingHoursEnd}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>

            {/* Complete Project */}
            <div className="rounded-lg border border-green-500/50 p-4 mt-8">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold text-green-600">
                  {project?.status === 'completed' ? 'Reactivate Project' : 'Mark as Completed'}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {project?.status === 'completed'
                  ? 'Reactivate this project to continue work. The project will become active again.'
                  : 'Mark this project as completed when all work is finished. Completed projects remain accessible.'}
              </p>
              {project?.status === 'completed' && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-green-100 text-green-800 text-sm">
                  This project has been marked as completed
                </div>
              )}
              <button
                onClick={handleCompleteClick}
                className={`rounded-lg px-4 py-2 text-sm ${
                  project?.status === 'completed'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {project?.status === 'completed' ? 'Reactivate Project' : 'Mark as Completed'}
              </button>
            </div>

            {/* Archive Project */}
            <div className="rounded-lg border border-amber-500/50 p-4 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Archive className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-amber-600">
                  {project?.status === 'archived' ? 'Restore Project' : 'Archive Project'}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {project?.status === 'archived'
                  ? 'Restore this project to make it active again. Users will be able to edit and add new data.'
                  : 'Archive this project to make it read-only. You can restore it later.'}
              </p>
              {project?.status === 'archived' && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-amber-100 text-amber-800 text-sm">
                  This project is currently archived (read-only)
                </div>
              )}
              <button
                onClick={handleArchiveClick}
                className={`rounded-lg px-4 py-2 text-sm ${
                  project?.status === 'archived'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                }`}
              >
                {project?.status === 'archived' ? 'Restore Project' : 'Archive Project'}
              </button>
            </div>

            {/* Danger Zone */}
            <div className="rounded-lg border border-destructive/50 p-4 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Once you delete a project, there is no going back. Please be certain.
              </p>
              <button
                onClick={handleDeleteClick}
                className="rounded-lg bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Project
              </button>
            </div>
          </>
        )}

        {activeTab === 'team' && (
          <div className="space-y-6">
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-2">Team Members</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Manage team members and their roles on this project.
              </p>
              {loadingTeam ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : (
                <div className="space-y-3">
                  {teamMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No team members yet.</p>
                  ) : (
                    teamMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            member.role === 'admin' ? 'bg-primary/20' : 'bg-green-100'
                          }`}>
                            <Users className={`h-5 w-5 ${
                              member.role === 'admin' ? 'text-primary' : 'text-green-600'
                            }`} />
                          </div>
                          <div>
                            <p className="font-medium">{member.fullName || 'Team Member'}</p>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {member.status === 'pending' && (
                            <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700">Pending</span>
                          )}
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            member.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-green-100 text-green-700'
                          }`}>
                            {ROLE_OPTIONS.find(r => r.value === member.role)?.label || member.role}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              <button
                onClick={handleOpenInviteModal}
                className="mt-4 flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
              >
                <UserPlus className="h-4 w-4" />
                Invite Team Member
              </button>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-2">Role Permissions</h2>
              <p className="text-sm text-muted-foreground">
                Configure what each role can access and modify in this project.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'itp-templates' && (
          <div className="space-y-6">
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-2">ITP Templates</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Manage Inspection and Test Plan templates for this project.
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Earthworks ITP</p>
                      <p className="text-sm text-muted-foreground">12 checklist items</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Pavement ITP</p>
                      <p className="text-sm text-muted-foreground">18 checklist items</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Drainage ITP</p>
                      <p className="text-sm text-muted-foreground">15 checklist items</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700">Draft</span>
                </div>
              </div>
              <button className="mt-4 rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                + Create ITP Template
              </button>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-2">Import Templates</h2>
              <p className="text-sm text-muted-foreground">
                Import ITP templates from specification sets or other projects.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-2">Notification Preferences</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Configure how and when notifications are sent for this project.
              </p>
              <div className="space-y-4">
                <label className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <div>
                    <p className="font-medium">Hold Point Releases</p>
                    <p className="text-sm text-muted-foreground">Notify when a hold point is released</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <div>
                    <p className="font-medium">NCR Assignments</p>
                    <p className="text-sm text-muted-foreground">Notify when an NCR is assigned to you</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <div>
                    <p className="font-medium">Test Results</p>
                    <p className="text-sm text-muted-foreground">Notify when test results are uploaded</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-gray-300" />
                </label>
                <label className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <div>
                    <p className="font-medium">Daily Diary Reminders</p>
                    <p className="text-sm text-muted-foreground">Remind to complete daily diary</p>
                  </div>
                  <input type="checkbox" className="h-5 w-5 rounded border-gray-300" />
                </label>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-2">Hold Point Recipients</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Default recipients for hold point notifications.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm">
                  <span className="font-medium">Superintendent:</span>
                  <span className="text-muted-foreground">superintendent@client.com</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm">
                  <span className="font-medium">Quality Manager:</span>
                  <span className="text-muted-foreground">qm@company.com</span>
                </div>
              </div>
              <button className="mt-4 rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                + Add Recipient
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invite Team Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Invite Team Member</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 hover:bg-muted rounded"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {inviteError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive mb-4">
                {inviteError}
              </div>
            )}

            {inviteSuccess && (
              <div className="rounded-lg bg-green-100 p-3 text-sm text-green-700 mb-4">
                {inviteSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="team.member@example.com"
                  className="w-full rounded-lg border bg-background px-3 py-2"
                  disabled={inviting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2"
                  disabled={inviting}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                disabled={inviting}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteTeamMember}
                disabled={inviting || !inviteEmail.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {inviting ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-lg">
            <h3 className="text-xl font-bold mb-4 text-destructive">Delete Project</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This action cannot be undone. This will permanently delete the project
              <strong className="text-foreground"> {project?.name || projectId}</strong> and all associated data.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Please enter your password to confirm deletion:
            </p>

            {deleteError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive mb-4">
                {deleteError}
              </div>
            )}

            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-lg border bg-background px-3 py-2 mb-4"
              autoFocus
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelDelete}
                disabled={deleting}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting || !deletePassword}
                className="rounded-lg bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      {showArchiveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-lg">
            <h3 className="text-xl font-bold mb-4 text-amber-600">
              {project?.status === 'archived' ? 'Restore Project' : 'Archive Project'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {project?.status === 'archived'
                ? <>Are you sure you want to restore <strong className="text-foreground">{project?.name || projectId}</strong>? The project will become active and editable again.</>
                : <>Are you sure you want to archive <strong className="text-foreground">{project?.name || projectId}</strong>? The project will become read-only but can be restored later.</>}
            </p>

            {archiveError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive mb-4">
                {archiveError}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelArchive}
                disabled={archiving}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmArchive}
                disabled={archiving}
                className={`rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50 ${
                  project?.status === 'archived'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {archiving
                  ? (project?.status === 'archived' ? 'Restoring...' : 'Archiving...')
                  : (project?.status === 'archived' ? 'Restore Project' : 'Archive Project')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Confirmation Dialog */}
      {showCompleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-lg">
            <h3 className="text-xl font-bold mb-4 text-green-600">
              {project?.status === 'completed' ? 'Reactivate Project' : 'Mark as Completed'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {project?.status === 'completed'
                ? <>Are you sure you want to reactivate <strong className="text-foreground">{project?.name || projectId}</strong>? The project will become active and editable again.</>
                : <>Are you sure you want to mark <strong className="text-foreground">{project?.name || projectId}</strong> as completed? Completed projects remain accessible but indicate all work is finished.</>}
            </p>

            {completeError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive mb-4">
                {completeError}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelComplete}
                disabled={completing}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmComplete}
                disabled={completing}
                className={`rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50 ${
                  project?.status === 'completed'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {completing
                  ? (project?.status === 'completed' ? 'Reactivating...' : 'Completing...')
                  : (project?.status === 'completed' ? 'Reactivate Project' : 'Mark as Completed')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

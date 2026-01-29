import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getAuthToken, useAuth } from '@/lib/auth'
import { Settings, Users, ClipboardList, Bell, AlertTriangle, Save, X, UserPlus, Archive, CheckCircle2, MapPin, Puzzle } from 'lucide-react'

interface Project {
  id: string
  name: string
  code: string
  status?: string
  startDate?: string | null
  targetCompletion?: string | null
  contractValue?: number | string | null
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

type SettingsTab = 'general' | 'team' | 'areas' | 'itp-templates' | 'notifications' | 'modules'

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
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  // Check if user can view contract value (admins, owners, project managers)
  // Note: user.role is the company role stored in auth context
  const canViewContractValue = user && ['admin', 'owner', 'project_manager'].includes(user.role || (user as any)?.roleInCompany || '')

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

  // HP Recipients state (Feature #697)
  const [hpRecipients, setHpRecipients] = useState<Array<{ role: string; email: string }>>([])
  const [showAddRecipientModal, setShowAddRecipientModal] = useState(false)
  const [newRecipientRole, setNewRecipientRole] = useState('')
  const [newRecipientEmail, setNewRecipientEmail] = useState('')
  const [savingRecipients, setSavingRecipients] = useState(false)

  // HP Approval Requirement state (Feature #698)
  const [hpApprovalRequirement, setHpApprovalRequirement] = useState<'any' | 'superintendent'>('any')

  // ITP Templates state
  const [itpTemplates, setItpTemplates] = useState<Array<{
    id: string
    name: string
    activityType: string
    isActive: boolean
    checklistItems: Array<{ id: string }>
  }>>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // Project Modules state (Feature #700)
  const [enabledModules, setEnabledModules] = useState<{
    costTracking: boolean
    progressClaims: boolean
    subcontractors: boolean
    dockets: boolean
    dailyDiary: boolean
  }>({
    costTracking: true,
    progressClaims: true,
    subcontractors: true,
    dockets: true,
    dailyDiary: true,
  })

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
          // Feature #697 - Load HP recipients from project settings
          // Feature #698 - Load HP approval requirement
          // Feature #700 - Load enabled modules
          if (data.project.settings) {
            try {
              const settings = typeof data.project.settings === 'string'
                ? JSON.parse(data.project.settings)
                : data.project.settings
              if (settings.hpRecipients && Array.isArray(settings.hpRecipients)) {
                setHpRecipients(settings.hpRecipients)
              }
              if (settings.hpApprovalRequirement) {
                setHpApprovalRequirement(settings.hpApprovalRequirement)
              }
              if (settings.enabledModules) {
                setEnabledModules(prev => ({ ...prev, ...settings.enabledModules }))
              }
            } catch (e) {
              // Invalid JSON, use defaults
            }
          }
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

  // Fetch ITP templates when ITP templates tab is active
  useEffect(() => {
    async function fetchItpTemplates() {
      if (activeTab !== 'itp-templates' || !projectId) return

      setLoadingTemplates(true)
      const token = getAuthToken()
      if (!token) {
        setLoadingTemplates(false)
        return
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002'

      try {
        const response = await fetch(`${apiUrl}/api/itp/templates?projectId=${projectId}&includeGlobal=true`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (response.ok) {
          const data = await response.json()
          setItpTemplates(data.templates || [])
        }
      } catch (error) {
        console.error('Failed to fetch ITP templates:', error)
      } finally {
        setLoadingTemplates(false)
      }
    }

    fetchItpTemplates()
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
    { id: 'areas' as SettingsTab, label: 'Areas', icon: MapPin },
    { id: 'itp-templates' as SettingsTab, label: 'ITP Templates', icon: ClipboardList },
    { id: 'notifications' as SettingsTab, label: 'Notifications', icon: Bell },
    { id: 'modules' as SettingsTab, label: 'Modules', icon: Puzzle },
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
              {canViewContractValue && project?.contractValue && (
                <div className="mt-4 pt-4 border-t">
                  <label className="block text-sm font-medium mb-1">Contract Value</label>
                  <div className="text-sm text-muted-foreground">
                    ${Number(project.contractValue).toLocaleString('en-AU', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </div>
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

        {activeTab === 'areas' && (
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
        )}

        {activeTab === 'itp-templates' && (
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
              <h2 className="text-lg font-semibold mb-2">Witness Point Auto-Notification</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Automatically notify clients when approaching witness points in an ITP workflow.
              </p>
              <div className="space-y-4">
                <label className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <div>
                    <p className="font-medium">Enable Witness Point Notifications</p>
                    <p className="text-sm text-muted-foreground">Send notification when approaching a witness point</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-gray-300" />
                </label>
                <div className="p-3 rounded-lg bg-muted/30">
                  <label className="block text-sm font-medium mb-2">Notification Trigger</label>
                  <p className="text-xs text-muted-foreground mb-2">When to notify the client about an upcoming witness point</p>
                  <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
                    <option value="previous_item">When previous checklist item is completed</option>
                    <option value="2_items_before">When 2 items before witness point is completed</option>
                    <option value="same_day">Same day notification (at start of working day)</option>
                  </select>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <label className="block text-sm font-medium mb-2">Client Contact Email</label>
                  <p className="text-xs text-muted-foreground mb-2">Email address for witness point notifications</p>
                  <input
                    type="email"
                    placeholder="superintendent@client.com"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <label className="block text-sm font-medium mb-2">Client Contact Name</label>
                  <input
                    type="text"
                    placeholder="John Smith"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-2">Hold Point Minimum Notice Period</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Set the minimum working days notice required before a hold point inspection can be scheduled.
              </p>
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/30">
                  <label className="block text-sm font-medium mb-2">Minimum Notice (Working Days)</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    If a user schedules an inspection with less than this notice, they'll receive a warning and must provide a reason to override.
                  </p>
                  <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
                    <option value="0">No minimum notice</option>
                    <option value="1" selected>1 working day (default)</option>
                    <option value="2">2 working days</option>
                    <option value="3">3 working days</option>
                    <option value="5">5 working days</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-2">Hold Point Approval Requirements</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Configure who can release hold points for this project.
              </p>
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/30">
                  <label className="block text-sm font-medium mb-2">Release Authorization</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Specify who is authorized to release hold points. This affects the Record Release functionality.
                  </p>
                  <select
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    value={hpApprovalRequirement}
                    onChange={async (e) => {
                      const newValue = e.target.value as 'any' | 'superintendent'
                      setHpApprovalRequirement(newValue)
                      // Save to project settings
                      const token = getAuthToken()
                      if (!token || !projectId) return
                      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002'
                      try {
                        await fetch(`${apiUrl}/api/projects/${projectId}`, {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({ settings: { hpApprovalRequirement: newValue } }),
                        })
                      } catch (e) {
                        console.error('Failed to save approval requirement:', e)
                      }
                    }}
                  >
                    <option value="any">Any Team Member</option>
                    <option value="superintendent">Superintendent Only</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-2">Hold Point Recipients</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Default recipients for hold point notifications. These will be pre-filled when requesting a hold point release.
              </p>
              <div className="space-y-2">
                {hpRecipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No default recipients configured.</p>
                ) : (
                  hpRecipients.map((recipient, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50 text-sm">
                      <div>
                        <span className="font-medium">{recipient.role}:</span>
                        <span className="text-muted-foreground ml-2">{recipient.email}</span>
                      </div>
                      <button
                        onClick={async () => {
                          const newRecipients = hpRecipients.filter((_, i) => i !== index)
                          setHpRecipients(newRecipients)
                          // Save to project settings
                          const token = getAuthToken()
                          if (!token || !projectId) return
                          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002'
                          try {
                            await fetch(`${apiUrl}/api/projects/${projectId}`, {
                              method: 'PATCH',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({ settings: { hpRecipients: newRecipients } }),
                            })
                          } catch (e) {
                            console.error('Failed to save recipients:', e)
                          }
                        }}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
              <button
                onClick={() => setShowAddRecipientModal(true)}
                className="mt-4 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
              >
                + Add Recipient
              </button>
            </div>
          </div>
        )}

        {/* Modules Tab - Feature #700 */}
        {activeTab === 'modules' && (
          <div className="space-y-6">
            <div className="rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-2">Project Modules</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Enable or disable modules for this project. Disabled modules will be hidden from the navigation.
              </p>
              <div className="space-y-3">
                {[
                  { key: 'costTracking' as const, label: 'Cost Tracking', description: 'Track project costs and budget' },
                  { key: 'progressClaims' as const, label: 'Progress Claims', description: 'Manage progress claims and payments' },
                  { key: 'subcontractors' as const, label: 'Subcontractors', description: 'Manage subcontractor information' },
                  { key: 'dockets' as const, label: 'Docket Approvals', description: 'Approve and track delivery dockets' },
                  { key: 'dailyDiary' as const, label: 'Daily Diary', description: 'Record daily site activities' },
                ].map((module) => (
                  <div
                    key={module.key}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50"
                    onClick={async () => {
                      const newValue = !enabledModules[module.key]
                      const newModules = { ...enabledModules, [module.key]: newValue }
                      setEnabledModules(newModules)
                      // Save to project settings
                      const token = getAuthToken()
                      if (!token || !projectId) return
                      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002'
                      try {
                        await fetch(`${apiUrl}/api/projects/${projectId}`, {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({ settings: { enabledModules: newModules } }),
                        })
                      } catch (e) {
                        console.error('Failed to save module settings:', e)
                      }
                    }}
                  >
                    <div>
                      <p className="font-medium">{module.label}</p>
                      <p className="text-sm text-muted-foreground">{module.description}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={enabledModules[module.key]}
                      onChange={() => {}} // Handled by parent onClick
                      className="h-5 w-5 cursor-pointer"
                    />
                  </div>
                ))}
              </div>
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

      {/* Add HP Recipient Modal (Feature #697) */}
      {showAddRecipientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-lg">
            <h3 className="text-xl font-bold mb-4">Add HP Recipient</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add a default recipient for hold point release notifications.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Role/Title</label>
                <input
                  type="text"
                  value={newRecipientRole}
                  onChange={(e) => setNewRecipientRole(e.target.value)}
                  placeholder="e.g., Superintendent, Quality Manager"
                  className="w-full rounded-lg border bg-background px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={newRecipientEmail}
                  onChange={(e) => setNewRecipientEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full rounded-lg border bg-background px-3 py-2"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowAddRecipientModal(false)
                  setNewRecipientRole('')
                  setNewRecipientEmail('')
                }}
                disabled={savingRecipients}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newRecipientRole.trim() || !newRecipientEmail.trim()) return
                  setSavingRecipients(true)
                  const newRecipient = { role: newRecipientRole, email: newRecipientEmail }
                  const newRecipients = [...hpRecipients, newRecipient]

                  const token = getAuthToken()
                  if (!token || !projectId) {
                    setSavingRecipients(false)
                    return
                  }
                  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002'
                  try {
                    const response = await fetch(`${apiUrl}/api/projects/${projectId}`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ settings: { hpRecipients: newRecipients } }),
                    })
                    if (response.ok) {
                      setHpRecipients(newRecipients)
                      setShowAddRecipientModal(false)
                      setNewRecipientRole('')
                      setNewRecipientEmail('')
                    }
                  } catch (e) {
                    console.error('Failed to save recipient:', e)
                  } finally {
                    setSavingRecipients(false)
                  }
                }}
                disabled={savingRecipients || !newRecipientRole.trim() || !newRecipientEmail.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {savingRecipients ? 'Adding...' : 'Add Recipient'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

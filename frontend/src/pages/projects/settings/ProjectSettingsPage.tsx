import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getAuthToken } from '@/lib/auth'
import { Settings, Users, ClipboardList, Bell, AlertTriangle } from 'lucide-react'

interface Project {
  id: string
  name: string
  code: string
}

type SettingsTab = 'general' | 'team' | 'itp-templates' | 'notifications'

export function ProjectSettingsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  // Get active tab from URL or default to 'general'
  const activeTab = (searchParams.get('tab') as SettingsTab) || 'general'

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

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
        }
      } catch (error) {
        console.error('Failed to fetch project:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [projectId])

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
                    defaultValue={project?.name || ''}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    placeholder="Project name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Project Code</label>
                  <input
                    type="text"
                    defaultValue={project?.code || ''}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    placeholder="PRJ-001"
                  />
                </div>
              </div>
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
                    defaultValue="LOT-"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    placeholder="LOT-"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Starting Number</label>
                  <input
                    type="number"
                    defaultValue={1}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    placeholder="1"
                  />
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="rounded-lg border border-destructive/50 p-4 mt-8">
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
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Project Manager</p>
                      <p className="text-sm text-muted-foreground">pm@example.com</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">Admin</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Site Engineer</p>
                      <p className="text-sm text-muted-foreground">engineer@example.com</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Site Engineer</span>
                </div>
              </div>
              <button className="mt-4 rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                + Invite Team Member
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
    </div>
  )
}

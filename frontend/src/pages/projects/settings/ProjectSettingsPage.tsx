import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getAuthToken } from '@/lib/auth'

interface Project {
  id: string
  name: string
  code: string
}

export function ProjectSettingsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Project Settings</h1>
      <p className="text-muted-foreground mb-4">
        {project ? project.name : `Project ID: ${projectId}`}
      </p>
      <div className="space-y-6">
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">General Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure project name, number, and basic settings.
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Lot Numbering</h2>
          <p className="text-sm text-muted-foreground">
            Configure lot numbering convention and auto-increment settings.
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Hold Point Notifications</h2>
          <p className="text-sm text-muted-foreground">
            Configure default notification recipients and timing.
          </p>
        </div>

        {/* Danger Zone */}
        <div className="rounded-lg border border-destructive/50 p-4 mt-8">
          <h2 className="text-lg font-semibold mb-2 text-destructive">Danger Zone</h2>
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

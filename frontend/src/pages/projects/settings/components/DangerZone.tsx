import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Archive, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { extractErrorMessage, isUnauthorized } from '@/lib/errorHandling'
import type { Project } from '../types'

interface DangerZoneProps {
  projectId: string
  project: Project
  onProjectUpdate: (project: Project) => void
}

export function DangerZone({ projectId, project, onProjectUpdate }: DangerZoneProps) {
  const navigate = useNavigate()

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

  // Delete handlers
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

    try {
      await apiFetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      })

      // Success - navigate to projects list
      navigate('/projects', { replace: true })
    } catch (error) {
      if (isUnauthorized(error)) {
        setDeleteError('Incorrect password')
      } else {
        setDeleteError(extractErrorMessage(error, 'Failed to delete project. Please try again.'))
      }
    } finally {
      setDeleting(false)
    }
  }

  // Archive handlers
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

    try {
      const newStatus = project?.status === 'archived' ? 'active' : 'archived'
      await apiFetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })

      // Update local project state
      onProjectUpdate({ ...project, status: newStatus })
      setShowArchiveDialog(false)
    } catch (error) {
      setArchiveError(extractErrorMessage(error, 'Failed to update project status'))
    } finally {
      setArchiving(false)
    }
  }

  // Complete handlers
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

    try {
      const newStatus = project?.status === 'completed' ? 'active' : 'completed'
      await apiFetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })

      // Update local project state
      onProjectUpdate({ ...project, status: newStatus })
      setShowCompleteDialog(false)
    } catch (error) {
      setCompleteError(extractErrorMessage(error, 'Failed to update project status'))
    } finally {
      setCompleting(false)
    }
  }

  return (
    <>
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
    </>
  )
}

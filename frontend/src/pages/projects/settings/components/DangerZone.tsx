import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Archive, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage, isUnauthorized } from '@/lib/errorHandling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Modal,
  AlertModalHeader,
  AlertModalDescription,
  ModalBody,
  AlertModalFooter,
} from '@/components/ui/Modal';
import type { Project } from '../types';

interface DangerZoneProps {
  projectId: string;
  project: Project;
  onProjectUpdate: (project: Project) => void;
}

export function DangerZone({ projectId, project, onProjectUpdate }: DangerZoneProps) {
  const navigate = useNavigate();

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);

  // Archive dialog state
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const archivingRef = useRef(false);

  // Complete project dialog state
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState('');
  const completingRef = useRef(false);

  // Delete handlers
  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
    setDeletePassword('');
    setDeleteError('');
  };

  const handleCancelDelete = () => {
    if (deletingRef.current) return;

    setShowDeleteDialog(false);
    setDeletePassword('');
    setDeleteError('');
  };

  const handleConfirmDelete = async () => {
    if (deletingRef.current) return;

    if (!deletePassword) {
      setDeleteError('Password is required');
      return;
    }

    if (!projectId) {
      setDeleteError('Project not found');
      return;
    }

    deletingRef.current = true;
    setDeleting(true);
    setDeleteError('');

    try {
      await apiFetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      });

      // Success - navigate to projects list
      navigate('/projects', { replace: true });
    } catch (error) {
      if (isUnauthorized(error)) {
        setDeleteError('Incorrect password');
      } else {
        setDeleteError(extractErrorMessage(error, 'Failed to delete project. Please try again.'));
      }
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  // Archive handlers
  const handleArchiveClick = () => {
    setShowArchiveDialog(true);
    setArchiveError('');
  };

  const handleCancelArchive = () => {
    if (archivingRef.current) return;

    setShowArchiveDialog(false);
    setArchiveError('');
  };

  const handleConfirmArchive = async () => {
    if (archivingRef.current) return;
    if (!projectId) {
      setArchiveError('Project not found');
      return;
    }

    archivingRef.current = true;
    setArchiving(true);
    setArchiveError('');

    try {
      const newStatus = project?.status === 'archived' ? 'active' : 'archived';
      await apiFetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });

      // Update local project state
      onProjectUpdate({ ...project, status: newStatus });
      setShowArchiveDialog(false);
    } catch (error) {
      setArchiveError(extractErrorMessage(error, 'Failed to update project status'));
    } finally {
      archivingRef.current = false;
      setArchiving(false);
    }
  };

  // Complete handlers
  const handleCompleteClick = () => {
    setShowCompleteDialog(true);
    setCompleteError('');
  };

  const handleCancelComplete = () => {
    if (completingRef.current) return;

    setShowCompleteDialog(false);
    setCompleteError('');
  };

  const handleConfirmComplete = async () => {
    if (completingRef.current) return;
    if (!projectId) {
      setCompleteError('Project not found');
      return;
    }

    completingRef.current = true;
    setCompleting(true);
    setCompleteError('');

    try {
      const newStatus = project?.status === 'completed' ? 'active' : 'completed';
      await apiFetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });

      // Update local project state
      onProjectUpdate({ ...project, status: newStatus });
      setShowCompleteDialog(false);
    } catch (error) {
      setCompleteError(extractErrorMessage(error, 'Failed to update project status'));
    } finally {
      completingRef.current = false;
      setCompleting(false);
    }
  };

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
        <Button
          type="button"
          onClick={handleCompleteClick}
          className={
            project?.status === 'completed'
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-green-600 text-white hover:bg-green-700'
          }
        >
          {project?.status === 'completed' ? 'Reactivate Project' : 'Mark as Completed'}
        </Button>
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
        <Button
          type="button"
          onClick={handleArchiveClick}
          className={
            project?.status === 'archived'
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-amber-600 text-white hover:bg-amber-700'
          }
        >
          {project?.status === 'archived' ? 'Restore Project' : 'Archive Project'}
        </Button>
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
        <Button type="button" variant="destructive" onClick={handleDeleteClick}>
          Delete Project
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <Modal onClose={handleCancelDelete} alert>
          <AlertModalHeader>Delete Project</AlertModalHeader>
          <AlertModalDescription>
            This action cannot be undone. This will permanently delete the project
            <strong className="text-foreground"> {project?.name || projectId}</strong> and all
            associated data.
          </AlertModalDescription>
          <ModalBody>
            <p className="text-sm text-muted-foreground mb-4">
              Please enter your password to confirm deletion:
            </p>

            {deleteError && (
              <div
                role="alert"
                className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive mb-4"
              >
                {deleteError}
              </div>
            )}

            <Label htmlFor="delete-project-password" className="mb-1">
              Password
            </Label>
            <Input
              id="delete-project-password"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your password"
              disabled={deleting}
              autoFocus
            />
          </ModalBody>
          <AlertModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelDelete}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting || !deletePassword}
            >
              {deleting ? 'Deleting...' : 'Delete Project'}
            </Button>
          </AlertModalFooter>
        </Modal>
      )}

      {/* Archive Confirmation Dialog */}
      {showArchiveDialog && (
        <Modal onClose={handleCancelArchive} alert>
          <AlertModalHeader>
            {project?.status === 'archived' ? 'Restore Project' : 'Archive Project'}
          </AlertModalHeader>
          <AlertModalDescription>
            {project?.status === 'archived' ? (
              <>
                Are you sure you want to restore{' '}
                <strong className="text-foreground">{project?.name || projectId}</strong>? The
                project will become active and editable again.
              </>
            ) : (
              <>
                Are you sure you want to archive{' '}
                <strong className="text-foreground">{project?.name || projectId}</strong>? The
                project will become read-only but can be restored later.
              </>
            )}
          </AlertModalDescription>
          <ModalBody>
            {archiveError && (
              <div
                role="alert"
                className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              >
                {archiveError}
              </div>
            )}
          </ModalBody>
          <AlertModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelArchive}
              disabled={archiving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmArchive}
              disabled={archiving}
              className={
                project?.status === 'archived'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }
            >
              {archiving
                ? project?.status === 'archived'
                  ? 'Restoring...'
                  : 'Archiving...'
                : project?.status === 'archived'
                  ? 'Restore Project'
                  : 'Archive Project'}
            </Button>
          </AlertModalFooter>
        </Modal>
      )}

      {/* Complete Confirmation Dialog */}
      {showCompleteDialog && (
        <Modal onClose={handleCancelComplete} alert>
          <AlertModalHeader>
            {project?.status === 'completed' ? 'Reactivate Project' : 'Mark as Completed'}
          </AlertModalHeader>
          <AlertModalDescription>
            {project?.status === 'completed' ? (
              <>
                Are you sure you want to reactivate{' '}
                <strong className="text-foreground">{project?.name || projectId}</strong>? The
                project will become active and editable again.
              </>
            ) : (
              <>
                Are you sure you want to mark{' '}
                <strong className="text-foreground">{project?.name || projectId}</strong> as
                completed? Completed projects remain accessible but indicate all work is finished.
              </>
            )}
          </AlertModalDescription>
          <ModalBody>
            {completeError && (
              <div
                role="alert"
                className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              >
                {completeError}
              </div>
            )}
          </ModalBody>
          <AlertModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelComplete}
              disabled={completing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmComplete}
              disabled={completing}
              className={
                project?.status === 'completed'
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }
            >
              {completing
                ? project?.status === 'completed'
                  ? 'Reactivating...'
                  : 'Completing...'
                : project?.status === 'completed'
                  ? 'Reactivate Project'
                  : 'Mark as Completed'}
            </Button>
          </AlertModalFooter>
        </Modal>
      )}
    </>
  );
}

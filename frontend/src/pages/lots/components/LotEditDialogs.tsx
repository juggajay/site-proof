import {
  AlertModalDescription,
  AlertModalFooter,
  AlertModalHeader,
  Modal,
  ModalBody,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/utils';

interface LotEditDialogsProps {
  showUnsavedDialog: boolean;
  onCancelLeave: () => void;
  onConfirmLeave: () => void;
  showConcurrentEditWarning: boolean;
  serverUpdatedAt: string | null;
  onCloseConcurrentWarning: () => void;
  onRefreshPage: () => void;
}

export function LotEditDialogs({
  showUnsavedDialog,
  onCancelLeave,
  onConfirmLeave,
  showConcurrentEditWarning,
  serverUpdatedAt,
  onCloseConcurrentWarning,
  onRefreshPage,
}: LotEditDialogsProps) {
  return (
    <>
      {showUnsavedDialog && (
        <Modal alert onClose={onCancelLeave} className="max-w-md">
          <AlertModalHeader>Unsaved Changes</AlertModalHeader>
          <AlertModalDescription>
            You have unsaved changes. Are you sure you want to leave this page? Your changes will be
            lost.
          </AlertModalDescription>
          <AlertModalFooter>
            <Button variant="outline" onClick={onCancelLeave}>
              Stay on Page
            </Button>
            <Button variant="destructive" onClick={onConfirmLeave}>
              Leave Page
            </Button>
          </AlertModalFooter>
        </Modal>
      )}

      {showConcurrentEditWarning && (
        <Modal alert onClose={onCloseConcurrentWarning} className="max-w-md">
          <AlertModalHeader>
            <span className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-warning"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </span>
              Concurrent Edit Detected
            </span>
          </AlertModalHeader>
          <AlertModalDescription>
            This lot has been modified by another user while you were editing.
          </AlertModalDescription>
          <ModalBody>
            <p className="text-sm text-muted-foreground mb-4">
              Last modified: {serverUpdatedAt ? formatDateTime(serverUpdatedAt) : 'Unknown'}
            </p>
            <p className="text-sm">
              Your changes could not be saved. Please refresh the page to see the latest version,
              then re-apply your changes.
            </p>
          </ModalBody>
          <AlertModalFooter>
            <Button variant="outline" onClick={onCloseConcurrentWarning}>
              Continue Editing
            </Button>
            <Button onClick={onRefreshPage}>Refresh Page</Button>
          </AlertModalFooter>
        </Modal>
      )}
    </>
  );
}

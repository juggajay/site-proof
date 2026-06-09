import { useCallback, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { getUnsyncedWorkCount } from '@/lib/offlineDb';
import { logError } from '@/lib/logger';
import {
  Modal,
  AlertModalHeader,
  AlertModalDescription,
  AlertModalFooter,
  ModalBody,
} from '@/components/ui/Modal';
import { AlertTriangle } from 'lucide-react';

interface UnsyncedSignOutGuard {
  // Call this from a manual sign-out control (e.g. the Sign out menu item).
  // If there is unsynced offline work it opens a confirm dialog; otherwise it
  // signs out immediately. `onSignedOut` runs after the session actually ends
  // (typically to navigate to /login).
  requestSignOut: (onSignedOut?: () => void) => Promise<void>;
  // Render this once near the control so the confirm dialog can appear.
  dialog: JSX.Element | null;
  isSigningOut: boolean;
}

/**
 * Guards a MANUAL sign-out: signing out wipes locally stored offline work
 * (queued photos, diary/docket/lot edits), so when there is unsynced work we
 * confirm with the real number before destroying it. Automatic sign-outs (the
 * inactivity timeout) instead preserve offline data and must NOT use this guard.
 */
export function useUnsyncedSignOut(): UnsyncedSignOutGuard {
  const { signOut } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [onSignedOutRef, setOnSignedOutRef] = useState<(() => void) | undefined>(undefined);

  const performSignOut = useCallback(
    async (onSignedOut?: () => void) => {
      setIsSigningOut(true);
      try {
        await signOut();
        onSignedOut?.();
      } finally {
        setIsSigningOut(false);
        setIsOpen(false);
      }
    },
    [signOut],
  );

  const requestSignOut = useCallback(
    async (onSignedOut?: () => void) => {
      let count = 0;
      try {
        count = await getUnsyncedWorkCount();
      } catch (error) {
        // If we can't read the offline store, fail safe by warning the user
        // rather than silently wiping potentially-unsynced work.
        logError('Failed to read unsynced work count before sign-out:', error);
        count = 1;
      }

      if (count > 0) {
        setPendingCount(count);
        // Stash the post-sign-out callback so the dialog's confirm can use it.
        setOnSignedOutRef(() => onSignedOut);
        setIsOpen(true);
        return;
      }

      await performSignOut(onSignedOut);
    },
    [performSignOut],
  );

  const dialog = isOpen ? (
    <Modal alert onClose={() => setIsOpen(false)} className="max-w-md w-full">
      <AlertModalHeader>
        <span className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Unsynced work will be deleted
        </span>
      </AlertModalHeader>
      <ModalBody>
        <AlertModalDescription>
          You have {pendingCount} item{pendingCount > 1 ? 's' : ''} that haven't synced yet. Signing
          out will permanently delete them from this device. Sign out anyway?
        </AlertModalDescription>
      </ModalBody>
      <AlertModalFooter>
        <button
          onClick={() => setIsOpen(false)}
          disabled={isSigningOut}
          className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted/50 transition-colors disabled:opacity-60"
          data-testid="unsynced-signout-cancel"
        >
          Stay signed in
        </button>
        <button
          onClick={() => performSignOut(onSignedOutRef)}
          disabled={isSigningOut}
          className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-60"
          data-testid="unsynced-signout-confirm"
        >
          Sign out anyway
        </button>
      </AlertModalFooter>
    </Modal>
  ) : null;

  return { requestSignOut, dialog, isSigningOut };
}

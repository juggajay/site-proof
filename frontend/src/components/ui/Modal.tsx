import { Children, ReactNode, isValidElement } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from './dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogDescription,
} from './alert-dialog';
import { cn } from '@/lib/utils';

interface ModalProps {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  /** Use AlertDialog (no backdrop-click dismiss, no Escape dismiss) for destructive confirmations */
  alert?: boolean;
}

/**
 * Modal component — backward-compatible wrapper around shadcn Dialog / AlertDialog.
 * - Regular modals: close on backdrop click + Escape + X button
 * - Alert modals: only close via explicit Cancel/action buttons
 */
export function Modal({ children, onClose, className, alert = false }: ModalProps) {
  const hasDescription = hasModalDescription(children, alert);

  if (alert) {
    return (
      <AlertDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose?.();
        }}
      >
        <AlertDialogContent className={cn('max-h-[90vh] overflow-y-auto', className)}>
          {!hasDescription && (
            <AlertDialogDescription className="sr-only">
              Use the available controls to review and complete this dialog.
            </AlertDialogDescription>
          )}
          {children}
        </AlertDialogContent>
      </AlertDialog>
    );
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose?.();
      }}
    >
      <DialogContent className={cn('max-h-[90vh] overflow-y-auto', className)}>
        {!hasDescription && (
          <DialogDescription className="sr-only">
            Use the available controls to review and complete this dialog.
          </DialogDescription>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}

/**
 * ModalHeader — wraps DialogHeader/AlertDialogHeader + DialogTitle/AlertDialogTitle.
 * The onClose prop is vestigial (Dialog's built-in X handles close).
 */
export function ModalHeader({
  children,
  onClose: _onClose,
}: {
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <DialogHeader>
      <DialogTitle>{children}</DialogTitle>
    </DialogHeader>
  );
}

/**
 * ModalDescription — optional description beneath the title.
 */
export function ModalDescription({ children }: { children: ReactNode }) {
  return <DialogDescription>{children}</DialogDescription>;
}

/**
 * AlertModalHeader — use inside alert modals for proper AlertDialog semantics.
 */
export function AlertModalHeader({ children }: { children: ReactNode; onClose?: () => void }) {
  return (
    <AlertDialogHeader>
      <AlertDialogTitle>{children}</AlertDialogTitle>
    </AlertDialogHeader>
  );
}

/**
 * AlertModalDescription — description for alert modals.
 */
export function AlertModalDescription({ children }: { children: ReactNode }) {
  return <AlertDialogDescription>{children}</AlertDialogDescription>;
}

function hasModalDescription(children: ReactNode, alert: boolean): boolean {
  let found = false;

  Children.forEach(children, (child) => {
    if (found || !isValidElement(child)) {
      return;
    }

    if (child.type === (alert ? AlertModalDescription : ModalDescription)) {
      found = true;
      return;
    }

    const childProps = child.props as { children?: ReactNode };
    if (childProps.children) {
      found = hasModalDescription(childProps.children, alert);
    }
  });

  return found;
}

/**
 * ModalBody — consistent content area.
 */
export function ModalBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('py-4', className)}>{children}</div>;
}

/**
 * ModalFooter — wraps DialogFooter/AlertDialogFooter.
 */
export function ModalFooter({ children }: { children: ReactNode }) {
  return <DialogFooter>{children}</DialogFooter>;
}

/**
 * AlertModalFooter — use inside alert modals.
 */
export function AlertModalFooter({ children }: { children: ReactNode }) {
  return <AlertDialogFooter>{children}</AlertDialogFooter>;
}

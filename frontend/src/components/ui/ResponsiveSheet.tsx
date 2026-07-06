import type { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { BottomSheet } from '@/components/foreman/sheets/BottomSheet';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

interface ResponsiveSheetProps {
  /** Whether the sheet/modal is open. Alias: `isOpen`. */
  open?: boolean;
  /** Alias for `open` — matches BottomSheet's prop name for easier migration. */
  isOpen?: boolean;
  /** Called when the user closes the sheet/modal. */
  onClose: () => void;
  /** Title shown in the sheet header (mobile) or modal header (desktop). */
  title: string;
  /** The form/content body. */
  children: ReactNode;
  /**
   * Optional footer content (action buttons etc.).
   * On mobile the footer is rendered sticky at the bottom of the viewport
   * outside the scrollable body. On desktop it sits inside the Modal, which
   * scrolls as a whole.
   */
  footer?: ReactNode;
  /**
   * Extra className forwarded to the Modal's DialogContent on desktop only.
   * Ignored on mobile — BottomSheet manages its own sizing.
   */
  className?: string;
}

/**
 * ResponsiveSheet — thin adapter that renders a bottom sheet on mobile and a
 * centred modal on desktop.
 *
 * Use for any form/action dialog reachable on mobile. Keep all form state and
 * mutation logic in the parent; this component is purely presentational.
 *
 * @example
 * <ResponsiveSheet open={open} onClose={onClose} title="Approve Docket" footer={<SubmitButton />}>
 *   <MyFormBody />
 * </ResponsiveSheet>
 */
export function ResponsiveSheet({
  open,
  isOpen,
  onClose,
  title,
  children,
  footer,
  className,
}: ResponsiveSheetProps) {
  const resolvedOpen = open ?? isOpen ?? false;
  const isMobile = useIsMobile();

  if (isMobile) {
    // BottomSheet itself carries role="dialog" aria-modal aria-label={title},
    // so it must be the ONLY dialog node — an extra wrapper with role="dialog"
    // makes role-based queries resolve to two elements (Playwright strict mode).
    if (!resolvedOpen) return null;
    return (
      <BottomSheet isOpen={resolvedOpen} onClose={onClose} title={title}>
        {/* Body scrolls; footer is sticky at the bottom of the fixed sheet */}
        <div className="flex flex-col gap-4">
          {children}
          {footer && (
            <div className={cn('sticky bottom-0 bg-background pt-3 pb-2 border-t -mx-4 px-4')}>
              {footer}
            </div>
          )}
        </div>
      </BottomSheet>
    );
  }

  if (!resolvedOpen) return null;

  return (
    <Modal onClose={onClose} className={className}>
      <ModalHeader>{title}</ModalHeader>
      {children}
      {footer && (
        <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background pt-4 pb-1">
          {footer}
        </div>
      )}
    </Modal>
  );
}

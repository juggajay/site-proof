import { X } from 'lucide-react';

interface SheetDraftRestoredHintProps {
  /** Clears the stored draft and resets the sheet's fields to pristine. */
  onDiscard: () => void;
  /** Hides the hint only — the restored values stay in the fields. */
  onDismiss: () => void;
}

/**
 * Shown when a sheet reopens with an interrupted entry restored from its
 * auto-draft. Quiet by design: the fields are already filled in, the hint just
 * explains why and offers the one explicit discard path.
 */
export function SheetDraftRestoredHint({ onDiscard, onDismiss }: SheetDraftRestoredHintProps) {
  return (
    <div
      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted p-3"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-medium text-muted-foreground">
        Draft restored — pick up where you left off.
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onDiscard}
          className="touch-target rounded-lg px-3 text-sm font-semibold text-muted-foreground active:bg-foreground/10"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss draft restored hint"
          className="touch-target flex items-center justify-center rounded-lg text-muted-foreground active:bg-foreground/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

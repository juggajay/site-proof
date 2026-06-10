import { AlertTriangle } from 'lucide-react';

interface SheetErrorBannerProps {
  onRetry: () => void;
  retrying?: boolean;
}

/**
 * Inline failure banner for the diary bottom sheets. Shown when a save fails
 * so the foreman knows the entry was NOT recorded but is still in the form.
 */
export function SheetErrorBanner({ onRetry, retrying }: SheetErrorBannerProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
        <p className="text-sm font-medium text-destructive">
          Couldn&apos;t save — your entry is kept. Try again.
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="touch-target shrink-0 rounded-lg px-3 text-sm font-semibold text-destructive active:bg-destructive/20 disabled:opacity-50"
      >
        Retry
      </button>
    </div>
  );
}

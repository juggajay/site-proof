import { AlertTriangle, SearchX, ShieldAlert } from 'lucide-react';

export type LotDetailPageError = {
  type: 'not_found' | 'forbidden' | 'error';
  message: string;
};

export function LotDetailLoadingState() {
  return (
    <div
      className="flex h-full items-center justify-center p-6"
      role="status"
      aria-label="Loading lot details"
    >
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

interface LotDetailErrorStateProps {
  error: LotDetailPageError;
  onRetry: () => void;
  onGoBack: () => void;
}

export function LotDetailErrorState({ error, onRetry, onGoBack }: LotDetailErrorStateProps) {
  const ErrorIcon =
    error.type === 'forbidden' ? ShieldAlert : error.type === 'not_found' ? SearchX : AlertTriangle;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ErrorIcon className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold text-destructive">
        {error.type === 'forbidden'
          ? 'Access Denied'
          : error.type === 'not_found'
            ? 'Lot Not Found'
            : 'Error'}
      </h1>
      <p className="text-muted-foreground text-center max-w-md">{error.message}</p>
      {error.type === 'error' && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border px-4 py-2 hover:bg-muted"
        >
          Try again
        </button>
      )}
      <button
        onClick={onGoBack}
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
      >
        Go Back
      </button>
    </div>
  );
}

export function LotDetailEmptyState() {
  return null;
}

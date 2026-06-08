import { SyncStatusBadge } from '@/components/OfflineIndicator';

export type LotEditOfflineSyncStatus = 'synced' | 'pending' | 'conflict' | 'error';

export function LotEditLoadingState() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

export function LotEditErrorState({ error, onGoBack }: { error: string; onGoBack: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <div className="text-6xl">!</div>
      <h1 className="text-2xl font-bold text-destructive">Error</h1>
      <p className="text-muted-foreground text-center max-w-md">{error}</p>
      <button
        type="button"
        onClick={onGoBack}
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
      >
        Go Back
      </button>
    </div>
  );
}

export function LotEditHeader({
  lotNumber,
  offlineSyncStatus,
  isOnline,
  onCancel,
}: {
  lotNumber: string;
  offlineSyncStatus: LotEditOfflineSyncStatus;
  isOnline: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Edit Lot</h1>
          {offlineSyncStatus !== 'synced' && <SyncStatusBadge status={offlineSyncStatus} />}
          {!isOnline && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
              Offline Mode
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">Editing lot {lotNumber}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
      >
        Cancel
      </button>
    </div>
  );
}

export function LotEditLockedWarning({
  detailsLocked,
  canEditConformedBudget,
  lotStatus,
}: {
  detailsLocked: boolean;
  canEditConformedBudget: boolean;
  lotStatus: string;
}) {
  if (!detailsLocked) return null;

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-warning">
      <strong>Note:</strong>{' '}
      {canEditConformedBudget
        ? 'Only the commercial budget can be edited on this conformed lot before it is claimed.'
        : `This lot is ${lotStatus} and cannot be edited.`}
    </div>
  );
}

export function LotEditSaveError({ saveError }: { saveError: string | null }) {
  if (!saveError) return null;

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
      {saveError}
    </div>
  );
}

export function LotEditFormActions({
  canSubmit,
  saving,
  onCancel,
}: {
  canSubmit: boolean;
  saving: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex justify-end gap-4">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border px-6 py-2 hover:bg-muted"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={!canSubmit || saving}
        className="rounded-lg bg-primary px-6 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

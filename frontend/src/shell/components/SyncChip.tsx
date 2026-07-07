/**
 * SyncChip — exactly three states wired to real offline data.
 *
 * States (per foreman profile §Design consequences):
 *   "All saved"    green  — online + no pending items
 *   "N waiting"    amber  — pending items in the offline queue (status-only)
 *   "Syncing…"     amber  — a flush is actively in progress
 *
 * Uses useOfflineStatus (lib/useOfflineStatus.ts) for live counts.
 * Render position is controlled by the parent; always placed in the header.
 *
 * State logic lives in syncChipState.ts (separate file, react-refresh rule).
 */

import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { deriveSyncState, type SyncState } from './syncChipState';

function syncChipLabel(state: SyncState, pendingSyncCount: number, failedSyncCount: number) {
  switch (state) {
    case 'saved':
      return 'All saved';
    case 'syncing':
      return 'Syncing…';
    case 'failed':
      return `${failedSyncCount} failed`;
    case 'offline':
      return 'Offline';
    case 'waiting':
      return `${pendingSyncCount} waiting`;
  }
}

function syncChipAriaLabel(state: SyncState, pendingSyncCount: number, failedSyncCount: number) {
  switch (state) {
    case 'saved':
      return 'All changes saved';
    case 'syncing':
      return 'Syncing changes';
    case 'failed':
      return `${failedSyncCount} change${failedSyncCount === 1 ? '' : 's'} failed to sync. Tap to retry.`;
    case 'offline':
      return 'Offline. Changes will sync when you reconnect.';
    case 'waiting':
      return `${pendingSyncCount} change${pendingSyncCount === 1 ? '' : 's'} waiting to sync. Tap to retry.`;
  }
}

function syncChipToneClass(state: SyncState) {
  if (state === 'failed') return 'text-destructive';
  if (state === 'waiting' || state === 'syncing') return 'text-warning';
  if (state === 'offline') return 'text-muted-foreground';
  return 'text-success';
}

export function SyncChip() {
  const { isOnline, pendingSyncCount, failedSyncCount, isSyncing, retryFailedSyncs } =
    useOfflineStatus();
  const state = deriveSyncState(isOnline, pendingSyncCount, isSyncing, failedSyncCount);
  const label = syncChipLabel(state, pendingSyncCount, failedSyncCount);
  const ariaLabel = syncChipAriaLabel(state, pendingSyncCount, failedSyncCount);

  const baseClass = [
    'inline-flex items-center gap-1.5 whitespace-nowrap',
    'rounded-full px-[11px] py-[7px]',
    'border border-border bg-card shadow-sm',
    'text-[12px] font-semibold leading-none',
    syncChipToneClass(state),
  ].join(' ');

  const dot = (
    <span
      aria-hidden="true"
      className={[
        'h-[7px] w-[7px] rounded-full bg-current',
        state === 'syncing' ? 'motion-safe:animate-pulse' : '',
      ].join(' ')}
    />
  );

  // Only the failed state is actionable: tapping revives dead-lettered items (the
  // app-root offline worker then flushes them), mirroring the floating pill's
  // Retry button. Other states stay a plain status indicator — no false button
  // affordance for "all saved" / "waiting" / "offline".
  if (state === 'failed') {
    return (
      <button
        type="button"
        onClick={() => void retryFailedSyncs()}
        aria-label={ariaLabel}
        className={`${baseClass} cursor-pointer`}
      >
        {dot}
        {label}
      </button>
    );
  }

  return (
    <span role="status" aria-label={ariaLabel} className={baseClass}>
      {dot}
      {label}
    </span>
  );
}

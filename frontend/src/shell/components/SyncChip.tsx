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
    case 'waiting':
      // M58: status-only — no actionable '↑'. The OfflineIndicator pill is the
      // single interactive sync surface; the chip only reports state.
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
      return `${failedSyncCount} change${failedSyncCount === 1 ? '' : 's'} failed to sync`;
    case 'waiting':
      return `${pendingSyncCount} change${pendingSyncCount === 1 ? '' : 's'} waiting to sync`;
  }
}

function syncChipToneClass(state: SyncState) {
  if (state === 'failed') return 'text-destructive';
  if (state === 'waiting' || state === 'syncing') return 'text-warning';
  return 'text-success';
}

export function SyncChip() {
  const { isOnline, pendingSyncCount, failedSyncCount, isSyncing } = useOfflineStatus();
  const state = deriveSyncState(isOnline, pendingSyncCount, isSyncing, failedSyncCount);
  const label = syncChipLabel(state, pendingSyncCount, failedSyncCount);

  return (
    <span
      role="status"
      aria-label={syncChipAriaLabel(state, pendingSyncCount, failedSyncCount)}
      className={[
        'inline-flex items-center gap-1.5 whitespace-nowrap',
        'rounded-full px-[11px] py-[7px]',
        'border border-border bg-card shadow-sm',
        'text-[12px] font-semibold leading-none',
        syncChipToneClass(state),
      ].join(' ')}
    >
      {/* Status dot */}
      <span
        aria-hidden="true"
        className={[
          'h-[7px] w-[7px] rounded-full bg-current',
          state === 'syncing' ? 'motion-safe:animate-pulse' : '',
        ].join(' ')}
      />

      {label}
    </span>
  );
}

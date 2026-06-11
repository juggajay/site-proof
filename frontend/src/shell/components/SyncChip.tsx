/**
 * SyncChip — exactly three states wired to real offline data.
 *
 * States (per foreman profile §Design consequences):
 *   "All saved"    green  — online + no pending items
 *   "N waiting ↑"  amber  — pending items in the offline queue
 *   "Syncing…"     amber  — a flush is actively in progress
 *
 * Uses useOfflineStatus (lib/useOfflineStatus.ts) for live counts.
 * Render position is controlled by the parent; always placed in the header.
 *
 * State logic lives in syncChipState.ts (separate file, react-refresh rule).
 */

import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { deriveSyncState } from './syncChipState';

export function SyncChip() {
  const { isOnline, pendingSyncCount, isSyncing } = useOfflineStatus();
  const state = deriveSyncState(isOnline, pendingSyncCount, isSyncing);

  const isAmber = state === 'waiting' || state === 'syncing';

  return (
    <span
      role="status"
      aria-label={
        state === 'saved'
          ? 'All changes saved'
          : state === 'syncing'
            ? 'Syncing changes'
            : `${pendingSyncCount} change${pendingSyncCount === 1 ? '' : 's'} waiting to sync`
      }
      className={[
        'inline-flex items-center gap-1.5 whitespace-nowrap',
        'rounded-full px-[11px] py-[7px]',
        'border border-border bg-card shadow-sm',
        'text-[12px] font-semibold leading-none',
        isAmber ? 'text-warning' : 'text-success',
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

      {state === 'saved' && 'All saved'}
      {state === 'syncing' && 'Syncing…'}
      {state === 'waiting' && `${pendingSyncCount} waiting ↑`}
    </span>
  );
}

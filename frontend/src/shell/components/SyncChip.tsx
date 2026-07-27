/**
 * SyncChip — the shell header's sync state, and the way into the Sync Centre.
 *
 * States (per foreman profile §Design consequences):
 *   "All saved"    green  — online + no pending items
 *   "N waiting"    amber  — pending items in the offline queue
 *   "Syncing…"     amber  — a flush is actively in progress
 *   "N failed"     red    — dead-lettered items
 *   "Offline"      muted  — offline with an empty queue
 *
 * Uses useOfflineStatus (lib/useOfflineStatus.ts) for live counts.
 * Render position is controlled by the parent; always placed in the header.
 *
 * State logic and labels live in syncChipState.ts (separate file, react-refresh
 * rule) so the panel below shows exactly the same words.
 */

import { Suspense, lazy, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { deriveSyncState, syncChipLabel, type SyncState } from './syncChipState';

// Lazy so BottomSheet → framer-motion never enters the chunk both shell headers
// load on first paint. /m carries no framer-motion today; a static import here
// would change that for every foreman screen.
const SyncPanel = lazy(() => import('./SyncPanel').then((m) => ({ default: m.SyncPanel })));

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
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const status = useOfflineStatus();
  const { isOnline, pendingSyncCount, failedSyncCount, isSyncing } = status;
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

  // The chip is a button in EVERY state now: there is always something behind
  // it — the Sync Centre, which carries the counts by kind, the last successful
  // sync and (when there are dead-lettered items) Retry. role="status" moves
  // into the panel, which is where a state change is worth announcing.
  return (
    <>
      <button
        type="button"
        onClick={() => setIsPanelOpen(true)}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={isPanelOpen}
        className={`${baseClass} shell-tap48 cursor-pointer`}
      >
        {dot}
        {label}
      </button>
      {isPanelOpen &&
        // Portalled to <body> because the shell header is `sticky z-10`, i.e. its
        // own stacking context: a sheet rendered inside it is capped at z-10 and
        // the camera bar paints over its footer — burying the Retry button.
        createPortal(
          <Suspense fallback={null}>
            <SyncPanel isOpen onClose={() => setIsPanelOpen(false)} state={state} status={status} />
          </Suspense>,
          document.body,
        )}
    </>
  );
}

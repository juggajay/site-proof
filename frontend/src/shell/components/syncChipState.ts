/**
 * syncChipState — pure state computation and labelling for SyncChip.
 * Exported separately from SyncChip.tsx so tests (and SyncPanel, which must
 * show the same words as the chip that opened it) can import the logic without
 * violating react-refresh/only-export-components.
 */

export type SyncState = 'saved' | 'waiting' | 'syncing' | 'failed' | 'conflict' | 'offline';

export function deriveSyncState(
  isOnline: boolean,
  pendingSyncCount: number,
  isSyncing: boolean,
  failedSyncCount = 0,
  conflictCount = 0,
): SyncState {
  if (isSyncing) return 'syncing';
  if (failedSyncCount > 0) return 'failed';
  // A lot_edit conflict is REMOVED from the queue by the sync worker (the
  // conflict is tracked on the lot record instead), so it is invisible to both
  // counts above. Without this clause the chip went green "All saved" while the
  // floating pill showed amber "1 sync conflict" centimetres away — and the
  // reassuring one was the new one. Same source of truth as the pill:
  // useOfflineStatus.conflictCount -> getConflictedLotsCount().
  if (conflictCount > 0) return 'conflict';
  // Offline with an empty queue is its own state — showing "0 waiting" here read
  // as broken. Once something is actually queued we fall through to "N waiting".
  if (!isOnline && pendingSyncCount === 0) return 'offline';
  if (!isOnline || pendingSyncCount > 0) return 'waiting';
  return 'saved';
}

// One label source for the chip and the panel it opens, so the two can never
// disagree about what state the queue is in.
export function syncChipLabel(
  state: SyncState,
  pendingSyncCount: number,
  failedSyncCount: number,
  conflictCount = 0,
): string {
  switch (state) {
    case 'saved':
      return 'All saved';
    case 'syncing':
      return 'Syncing…';
    case 'failed':
      return `${failedSyncCount} failed`;
    // Same words as the floating pill, so the two never read as two problems.
    case 'conflict':
      return `${conflictCount} sync conflict${conflictCount === 1 ? '' : 's'}`;
    case 'offline':
      return 'Offline';
    case 'waiting':
      return `${pendingSyncCount} waiting`;
  }
}

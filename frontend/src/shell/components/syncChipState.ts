/**
 * syncChipState — pure state computation and labelling for SyncChip.
 * Exported separately from SyncChip.tsx so tests (and SyncPanel, which must
 * show the same words as the chip that opened it) can import the logic without
 * violating react-refresh/only-export-components.
 */

export type SyncState = 'saved' | 'waiting' | 'syncing' | 'failed' | 'offline';

export function deriveSyncState(
  isOnline: boolean,
  pendingSyncCount: number,
  isSyncing: boolean,
  failedSyncCount = 0,
): SyncState {
  if (isSyncing) return 'syncing';
  if (failedSyncCount > 0) return 'failed';
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
): string {
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

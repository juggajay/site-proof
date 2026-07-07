/**
 * syncChipState — pure state computation for SyncChip.
 * Exported separately from SyncChip.tsx so tests can import the logic
 * without violating react-refresh/only-export-components.
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

/**
 * syncChipState — pure state computation for SyncChip.
 * Exported separately from SyncChip.tsx so tests can import the logic
 * without violating react-refresh/only-export-components.
 */

export type SyncState = 'saved' | 'waiting' | 'syncing' | 'failed';

export function deriveSyncState(
  isOnline: boolean,
  pendingSyncCount: number,
  isSyncing: boolean,
  failedSyncCount = 0,
): SyncState {
  if (isSyncing) return 'syncing';
  if (failedSyncCount > 0) return 'failed';
  if (!isOnline || pendingSyncCount > 0) return 'waiting';
  return 'saved';
}

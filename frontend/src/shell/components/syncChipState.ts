/**
 * syncChipState — pure state computation for SyncChip.
 * Exported separately from SyncChip.tsx so tests can import the logic
 * without violating react-refresh/only-export-components.
 */

export type SyncState = 'saved' | 'waiting' | 'syncing';

export function deriveSyncState(
  isOnline: boolean,
  pendingSyncCount: number,
  isSyncing: boolean,
): SyncState {
  if (isSyncing) return 'syncing';
  if (!isOnline || pendingSyncCount > 0) return 'waiting';
  return 'saved';
}

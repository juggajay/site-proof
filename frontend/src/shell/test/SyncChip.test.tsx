/**
 * Tests for SyncChip.
 *
 * States wired to real offline data:
 *   saved   — online, no pending items
 *   waiting — pending items > 0 (or offline with a non-empty queue)
 *   offline — offline with an empty queue (never "0 waiting")
 *   syncing — isSyncing is true (unreachable from this instance in the app:
 *             the chip's hook runs with enableSyncWorker false)
 *   failed  — dead-lettered items
 *
 * The chip is a button in EVERY state and opens the Sync Centre sheet; retry
 * lives in the sheet, not on the chip.
 *
 * The offline lib (useOfflineStatus) is mocked so tests run without IndexedDB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncChip } from '../components/SyncChip';
import { deriveSyncState } from '../components/syncChipState';
import { emptySyncKindCounts } from '@/lib/offline/syncKinds';

// ── deriveSyncState pure-function tests ───────────────────────────────────────

describe('deriveSyncState', () => {
  it('returns "syncing" when isSyncing is true regardless of pending count', () => {
    expect(deriveSyncState(true, 0, true)).toBe('syncing');
    expect(deriveSyncState(false, 5, true)).toBe('syncing');
    expect(deriveSyncState(true, 0, true, 2)).toBe('syncing');
  });

  it('returns "failed" when failed sync items exist and no sync is active', () => {
    expect(deriveSyncState(true, 0, false, 1)).toBe('failed');
    expect(deriveSyncState(true, 3, false, 2)).toBe('failed');
  });

  it('returns "offline" when offline with an empty queue (never "0 waiting")', () => {
    expect(deriveSyncState(false, 0, false)).toBe('offline');
  });

  it('returns "waiting" when offline with queued items', () => {
    expect(deriveSyncState(false, 2, false)).toBe('waiting');
  });

  it('returns "waiting" when online but pending > 0', () => {
    expect(deriveSyncState(true, 3, false)).toBe('waiting');
  });

  it('returns "saved" when online and no pending items', () => {
    expect(deriveSyncState(true, 0, false)).toBe('saved');
  });

  // [M9-1] A lot_edit conflict is REMOVED from the queue (syncWorker.ts), so it
  // is invisible to every count above. Without conflict awareness the chip went
  // green "All saved" while the floating pill showed amber "1 sync conflict"
  // centimetres away — and the reassuring one was the new one.
  it('never claims "saved" while a conflict is waiting to be resolved', () => {
    expect(deriveSyncState(true, 0, false, 0, 1)).toBe('conflict');
    expect(deriveSyncState(true, 0, false, 0, 1)).not.toBe('saved');
  });

  it('ranks an outright failure above a conflict, and a live flush above both', () => {
    expect(deriveSyncState(true, 0, false, 2, 1)).toBe('failed');
    expect(deriveSyncState(true, 0, true, 0, 1)).toBe('syncing');
  });

  it('still reports "conflict" when offline — the conflict is the actionable fact', () => {
    expect(deriveSyncState(false, 0, false, 0, 1)).toBe('conflict');
  });
});

// ── SyncChip render tests (mock useOfflineStatus) ─────────────────────────────

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: vi.fn(),
}));

import { useOfflineStatus } from '@/lib/useOfflineStatus';

const mockOfflineStatus = useOfflineStatus as ReturnType<typeof vi.fn>;
const retryFailedSyncs = vi.fn();

function mockStatus(overrides: Record<string, unknown>) {
  mockOfflineStatus.mockReturnValue({
    isOnline: true,
    pendingSyncCount: 0,
    failedSyncCount: 0,
    isSyncing: false,
    conflictCount: 0,
    oldestPendingItemAge: null,
    pendingByKind: emptySyncKindCounts(),
    failedItems: [],
    lastSyncedAt: null,
    retryFailedSyncs,
    ...overrides,
  });
}

describe('SyncChip — render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "All saved" when online and no pending', () => {
    mockStatus({});
    render(<SyncChip />);
    const chip = screen.getByRole('button');
    expect(chip).toHaveTextContent('All saved');
    expect(chip).toHaveAttribute('aria-label', 'All changes saved');
  });

  it('shows "N waiting" when pending > 0', () => {
    mockStatus({ pendingSyncCount: 3 });
    render(<SyncChip />);
    expect(screen.getByRole('button')).toHaveTextContent('3 waiting');
  });

  it('shows "Syncing…" when isSyncing is true', () => {
    mockStatus({ pendingSyncCount: 2, isSyncing: true });
    render(<SyncChip />);
    expect(screen.getByRole('button')).toHaveTextContent('Syncing…');
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Syncing changes');
  });

  it('shows "Offline" (never "0 waiting") when offline with an empty queue', () => {
    mockStatus({ isOnline: false });
    render(<SyncChip />);
    const chip = screen.getByRole('button');
    expect(chip).toHaveTextContent('Offline');
    expect(chip).not.toHaveTextContent('waiting');
    expect(chip).toHaveAttribute('aria-label', 'Offline. Changes will sync when you reconnect.');
  });

  // [M9-1] The chip and the legacy floating pill read the SAME conflictCount
  // (useOfflineStatus -> getConflictedLotsCount), in the same words.
  it('shows an unresolved conflict in the same words as the floating pill', () => {
    mockStatus({ conflictCount: 1 });
    render(<SyncChip />);
    const chip = screen.getByRole('button');
    expect(chip).toHaveTextContent('1 sync conflict');
    expect(chip).not.toHaveTextContent('All saved');
  });

  it('shows failed syncs with the retry-tap aria label', () => {
    mockStatus({ failedSyncCount: 2 });
    render(<SyncChip />);
    const chip = screen.getByRole('button');
    expect(chip).toHaveTextContent('2 failed');
    expect(chip).toHaveAttribute('aria-label', '2 changes failed to sync. Tap to retry.');
  });
});

describe('SyncChip — opens the Sync Centre', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('advertises the sheet it opens and tracks its open state', async () => {
    mockStatus({});
    render(<SyncChip />);
    const chip = screen.getByRole('button');
    expect(chip).toHaveAttribute('aria-haspopup', 'dialog');
    expect(chip).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(chip);
    await screen.findByRole('dialog');
    expect(chip).toHaveAttribute('aria-expanded', 'true');
  });

  it.each([
    ['saved', {}, 'All saved'],
    [
      'waiting',
      { pendingSyncCount: 3, pendingByKind: { ...emptySyncKindCounts(), photos: 3 } },
      '3 waiting',
    ],
    [
      'failed',
      { failedSyncCount: 1, pendingByKind: { ...emptySyncKindCounts(), photos: 1 } },
      '1 failed',
    ],
    ['offline', { isOnline: false }, 'Offline'],
  ])('opens the panel from the %s state', async (_state, overrides, label) => {
    mockStatus(overrides as Record<string, unknown>);
    render(<SyncChip />);

    fireEvent.click(screen.getByRole('button'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'Sync');
    // Panel and chip show the same state, always.
    expect(screen.getByRole('status')).toHaveTextContent(label as string);
  });

  it('does not retry on tap — retry lives in the panel', async () => {
    mockStatus({ failedSyncCount: 2, pendingByKind: { ...emptySyncKindCounts(), photos: 2 } });
    render(<SyncChip />);

    fireEvent.click(screen.getByRole('button', { name: /failed to sync/ }));
    await screen.findByRole('dialog');
    expect(retryFailedSyncs).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry failed' }));
    expect(retryFailedSyncs).toHaveBeenCalledTimes(1);
  });
});

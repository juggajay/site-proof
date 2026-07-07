/**
 * Tests for SyncChip.
 *
 * States wired to real offline data:
 *   saved   — online, no pending items
 *   waiting — pending items > 0 (or offline with a non-empty queue)
 *   offline — offline with an empty queue (never "0 waiting")
 *   syncing — isSyncing is true
 *   failed  — dead-lettered items; the chip taps through to retry them
 *
 * The offline lib (useOfflineStatus) is mocked so tests run without IndexedDB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncChip } from '../components/SyncChip';
import { deriveSyncState } from '../components/syncChipState';

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
    retryFailedSyncs,
    ...overrides,
  });
}

describe('SyncChip — render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "All saved" as a plain status (not a button) when online and no pending', () => {
    mockStatus({});
    render(<SyncChip />);
    expect(screen.getByRole('status')).toHaveTextContent('All saved');
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'All changes saved');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows "N waiting" as a plain status when pending > 0', () => {
    mockStatus({ pendingSyncCount: 3 });
    render(<SyncChip />);
    expect(screen.getByRole('status')).toHaveTextContent('3 waiting');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows "Syncing…" when isSyncing is true', () => {
    mockStatus({ pendingSyncCount: 2, isSyncing: true });
    render(<SyncChip />);
    expect(screen.getByRole('status')).toHaveTextContent('Syncing…');
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Syncing changes');
  });

  it('shows "Offline" (never "0 waiting") when offline with an empty queue', () => {
    mockStatus({ isOnline: false });
    render(<SyncChip />);
    expect(screen.getByRole('status')).toHaveTextContent('Offline');
    expect(screen.getByRole('status')).not.toHaveTextContent('waiting');
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Offline. Changes will sync when you reconnect.',
    );
  });

  it('shows failed syncs as a real button that taps through to retry', () => {
    mockStatus({ failedSyncCount: 2 });
    render(<SyncChip />);
    const chip = screen.getByRole('button');
    expect(chip).toHaveTextContent('2 failed');
    expect(chip).toHaveAttribute('aria-label', '2 changes failed to sync. Tap to retry.');

    fireEvent.click(chip);
    expect(retryFailedSyncs).toHaveBeenCalledTimes(1);
  });
});

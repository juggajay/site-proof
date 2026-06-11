/**
 * Tests for SyncChip.
 *
 * Covers the three states wired to real offline data:
 *   saved   — online, no pending items
 *   waiting — pending items > 0
 *   syncing — isSyncing is true
 *
 * The offline lib (useOfflineStatus) is mocked so tests run without IndexedDB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyncChip } from '../components/SyncChip';
import { deriveSyncState } from '../components/syncChipState';

// ── deriveSyncState pure-function tests ───────────────────────────────────────

describe('deriveSyncState', () => {
  it('returns "syncing" when isSyncing is true regardless of pending count', () => {
    expect(deriveSyncState(true, 0, true)).toBe('syncing');
    expect(deriveSyncState(false, 5, true)).toBe('syncing');
  });

  it('returns "waiting" when offline', () => {
    expect(deriveSyncState(false, 0, false)).toBe('waiting');
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

describe('SyncChip — render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "All saved" when online and no pending', () => {
    mockOfflineStatus.mockReturnValue({
      isOnline: true,
      pendingSyncCount: 0,
      isSyncing: false,
    });
    render(<SyncChip />);
    expect(screen.getByRole('status')).toHaveTextContent('All saved');
    // Accessible label
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'All changes saved');
  });

  it('shows "N waiting ↑" when pending > 0', () => {
    mockOfflineStatus.mockReturnValue({
      isOnline: true,
      pendingSyncCount: 3,
      isSyncing: false,
    });
    render(<SyncChip />);
    expect(screen.getByRole('status')).toHaveTextContent('3 waiting ↑');
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', '3 changes waiting to sync');
  });

  it('shows "1 waiting ↑" with singular label for count 1', () => {
    mockOfflineStatus.mockReturnValue({
      isOnline: true,
      pendingSyncCount: 1,
      isSyncing: false,
    });
    render(<SyncChip />);
    expect(screen.getByRole('status')).toHaveTextContent('1 waiting ↑');
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', '1 change waiting to sync');
  });

  it('shows "Syncing…" when isSyncing is true', () => {
    mockOfflineStatus.mockReturnValue({
      isOnline: true,
      pendingSyncCount: 2,
      isSyncing: true,
    });
    render(<SyncChip />);
    expect(screen.getByRole('status')).toHaveTextContent('Syncing…');
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Syncing changes');
  });

  it('shows "waiting" when offline (no pending)', () => {
    mockOfflineStatus.mockReturnValue({
      isOnline: false,
      pendingSyncCount: 0,
      isSyncing: false,
    });
    render(<SyncChip />);
    expect(screen.getByRole('status')).toHaveTextContent('0 waiting ↑');
  });
});

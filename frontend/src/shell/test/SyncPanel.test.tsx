/**
 * Tests for SyncPanel — the Sync Centre sheet.
 *
 * The panel is presentational (every value arrives as a prop from the chip's
 * useOfflineStatus instance), so these tests need no mocks and no IndexedDB.
 *
 * The load-bearing assertions: exactly ONE row per kind, exactly ONE action
 * ("Retry failed", and only while there are dead-lettered items — there is no
 * "Sync now"), and a status line that always matches the chip that opened it.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncPanel, type SyncPanelStatus } from '../components/SyncPanel';
import { syncChipLabel, type SyncState } from '../components/syncChipState';
import { emptySyncKindCounts } from '@/lib/offline/syncKinds';
import { STUCK_SYNC_THRESHOLD_MS } from '@/lib/useOfflineStatus';

const retryFailedSyncs = vi.fn();

function status(overrides: Partial<SyncPanelStatus> = {}): SyncPanelStatus {
  return {
    isOnline: true,
    pendingSyncCount: 0,
    failedSyncCount: 0,
    oldestPendingItemAge: null,
    pendingByKind: emptySyncKindCounts(),
    lastSyncedAt: null,
    retryFailedSyncs,
    ...overrides,
  };
}

function renderPanel(state: SyncState, overrides: Partial<SyncPanelStatus> = {}) {
  const onClose = vi.fn();
  render(<SyncPanel isOpen onClose={onClose} state={state} status={status(overrides)} />);
  return { onClose };
}

describe('SyncPanel — container', () => {
  it('renders inside the shared BottomSheet dialog and closes on Escape', () => {
    const { onClose } = renderPanel('saved');
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Sync');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SyncPanel — kind rows', () => {
  it('renders one row per kind with a non-zero total, in the fixed order', () => {
    renderPanel('waiting', {
      pendingSyncCount: 5,
      pendingByKind: { ...emptySyncKindCounts(), photos: 3, dockets: 2 },
    });

    const rows = screen.getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(['3 photosWaiting', '2 docketsWaiting']);
  });

  it('pluralises the kind noun and never renders a chevron/navigation affordance', () => {
    renderPanel('waiting', {
      pendingSyncCount: 3,
      pendingByKind: { ...emptySyncKindCounts(), photos: 1, diary: 2 },
    });

    expect(screen.getByText('1 photo')).toBeInTheDocument();
    expect(screen.getByText('2 diary entries')).toBeInTheDocument();
    // Rows navigate nowhere, so they must not be tappable (decision D3).
    expect(screen.getByText('1 photo').closest('button')).toBeNull();
    expect(screen.getByText('1 photo').closest('a')).toBeNull();
  });

  it('keeps one row for a kind that has both live and dead-lettered items, plus one failure line', () => {
    renderPanel('failed', {
      pendingSyncCount: 2,
      failedSyncCount: 1,
      // byKind counts live + failed, so a kind with one of each is still 1 row.
      pendingByKind: { ...emptySyncKindCounts(), photos: 3 },
    });

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('3 photos')).toBeInTheDocument();
    expect(screen.getByText('1 failed — tap Retry')).toBeInTheDocument();
  });

  it('renders no rows when the queue is empty', () => {
    renderPanel('saved');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});

describe('SyncPanel — last synced', () => {
  it('shows the time for a sync earlier today', () => {
    const at = new Date();
    at.setHours(10, 42, 0, 0);
    renderPanel('saved', { lastSyncedAt: at.toISOString() });
    expect(
      screen.getByText(
        `Last synced ${at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`,
      ),
    ).toBeInTheDocument();
  });

  it('includes the date for a sync on an earlier day', () => {
    const at = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    renderPanel('saved', { lastSyncedAt: at.toISOString() });
    const line = screen.getByText(/^Last synced /);
    expect(line.textContent).toContain(
      at.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
    );
  });

  it('never synthesises a timestamp when none has been recorded', () => {
    renderPanel('saved');
    expect(screen.getByText('Not synced on this device yet')).toBeInTheDocument();
  });
});

describe('SyncPanel — actions', () => {
  it('offers "Retry failed" only when items are dead-lettered, and calls retryFailedSyncs', () => {
    renderPanel('failed', {
      failedSyncCount: 2,
      pendingByKind: { ...emptySyncKindCounts(), itp: 2 },
    });

    const retry = screen.getByRole('button', { name: 'Retry failed' });
    fireEvent.click(retry);
    expect(retryFailedSyncs).toHaveBeenCalledTimes(1);
  });

  it('renders NO action button while work is merely waiting (there is no "Sync now")', () => {
    renderPanel('waiting', {
      pendingSyncCount: 3,
      pendingByKind: { ...emptySyncKindCounts(), photos: 3 },
    });

    // The sheet's own close control is the only button on the surface.
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Close',
    ]);
  });
});

describe('SyncPanel — context lines', () => {
  it('reassures when offline', () => {
    renderPanel('offline', { isOnline: false });
    expect(screen.getByText(/saved on this phone/)).toBeInTheDocument();
  });

  it('warns when the queue is stuck, in the same words as the floating pill', () => {
    renderPanel('waiting', {
      pendingSyncCount: 1,
      oldestPendingItemAge: STUCK_SYNC_THRESHOLD_MS + 1,
      pendingByKind: { ...emptySyncKindCounts(), photos: 1 },
    });
    expect(
      screen.getByText("Some items haven't synced yet — keep the app open while on signal"),
    ).toBeInTheDocument();
  });

  it('does not warn about being stuck while offline', () => {
    renderPanel('waiting', {
      isOnline: false,
      pendingSyncCount: 1,
      oldestPendingItemAge: STUCK_SYNC_THRESHOLD_MS + 1,
      pendingByKind: { ...emptySyncKindCounts(), photos: 1 },
    });
    expect(screen.queryByText(/keep the app open/)).toBeNull();
  });
});

describe('SyncPanel — status line', () => {
  it.each([
    ['saved', {}],
    ['waiting', { pendingSyncCount: 4 }],
    ['failed', { failedSyncCount: 2 }],
    ['offline', { isOnline: false }],
  ] as [SyncState, Partial<SyncPanelStatus>][])(
    'matches the chip label in the %s state',
    (state, overrides) => {
      const s = status(overrides);
      renderPanel(state, overrides);
      expect(screen.getByRole('status')).toHaveTextContent(
        syncChipLabel(state, s.pendingSyncCount, s.failedSyncCount),
      );
    },
  );
});

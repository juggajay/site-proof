// The offline indicator must surface dead-lettered ("failed") sync items as a
// distinct, retryable state, and must NOT show a misleading "Sync Complete"
// toast while failures remain. useOfflineStatus is mocked so the test controls
// the exact counts and captures the onSyncComplete callback the indicator wires.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { SyncCompleteResult } from '@/lib/useOfflineStatus';

const { hookState, retryFailedSyncs, toast } = vi.hoisted(() => ({
  hookState: {
    isOnline: true,
    pendingSyncCount: 0,
    failedSyncCount: 0,
    isSyncing: false,
    conflictCount: 0,
    onSyncComplete: undefined as ((result: SyncCompleteResult) => void) | undefined,
  },
  retryFailedSyncs: vi.fn().mockResolvedValue(undefined),
  toast: vi.fn(),
}));

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: (callbacks: { onSyncComplete?: (r: SyncCompleteResult) => void }) => {
    // Capture the indicator's completion handler so the test can fire it.
    hookState.onSyncComplete = callbacks.onSyncComplete;
    return {
      isOnline: hookState.isOnline,
      pendingSyncCount: hookState.pendingSyncCount,
      failedSyncCount: hookState.failedSyncCount,
      isSyncing: hookState.isSyncing,
      syncPendingChanges: vi.fn(),
      retryFailedSyncs,
      conflictCount: hookState.conflictCount,
    };
  },
}));
vi.mock('@/components/ui/toaster', () => ({ toast }));
vi.mock('./SyncConflictModal', () => ({ SyncConflictModal: () => null }));

import { OfflineIndicator } from './OfflineIndicator';

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(hookState, {
    isOnline: true,
    pendingSyncCount: 0,
    failedSyncCount: 0,
    isSyncing: false,
    conflictCount: 0,
    onSyncComplete: undefined,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OfflineIndicator failed state', () => {
  it('renders a retryable failed indicator when items are dead-lettered', () => {
    hookState.failedSyncCount = 2;
    render(<OfflineIndicator />);

    expect(screen.getByText('2 items failed to sync')).toBeInTheDocument();

    fireEvent.click(screen.getByText('2 items failed to sync'));
    expect(retryFailedSyncs).toHaveBeenCalledTimes(1);
  });

  it('shows nothing when online, fully synced, and no failures', () => {
    const { container } = render(<OfflineIndicator />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('OfflineIndicator positioning', () => {
  it('anchors above the mobile bottom nav instead of a fixed bottom offset', () => {
    // A plain bottom-4 pill sits on top of the bottom nav's rightmost tab
    // (Lots) and intercepts its taps. The pill must use the clearance utility
    // driven by the nav-published --bottom-nav-height variable instead.
    hookState.failedSyncCount = 1;
    const { container } = render(<OfflineIndicator />);

    const pill = container.firstElementChild;
    expect(pill).toHaveClass('fixed', 'right-4', 'above-bottom-nav');
    expect(pill).not.toHaveClass('bottom-4');
  });
});

describe('OfflineIndicator sync-complete toast', () => {
  it('suppresses the success toast when failures remain', () => {
    render(<OfflineIndicator />);

    hookState.onSyncComplete?.({ syncedCount: 3, failedCount: 1 });

    expect(toast).not.toHaveBeenCalled();
  });

  it('fires the success toast when nothing failed', () => {
    render(<OfflineIndicator />);

    hookState.onSyncComplete?.({ syncedCount: 3, failedCount: 0 });

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Sync Complete', variant: 'success' }),
    );
  });
});

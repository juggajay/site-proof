// The offline indicator must surface dead-lettered ("failed") sync items as a
// distinct, retryable state, and must NOT show a misleading "Sync Complete"
// toast while failures remain. useOfflineStatus is mocked so the test controls
// the exact counts and captures the onSyncComplete callback the indicator wires.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { SyncCompleteResult } from '@/lib/useOfflineStatus';
import { STUCK_SYNC_THRESHOLD_MS } from '@/lib/useOfflineStatus';

const { hookState, retryFailedSyncs, toast } = vi.hoisted(() => ({
  hookState: {
    isOnline: true,
    pendingSyncCount: 0,
    failedSyncCount: 0,
    isSyncing: false,
    conflictCount: 0,
    oldestPendingItemAge: null as number | null,
    onSyncComplete: undefined as ((result: SyncCompleteResult) => void) | undefined,
  },
  retryFailedSyncs: vi.fn().mockResolvedValue(undefined),
  toast: vi.fn(),
}));

vi.mock('@/lib/useOfflineStatus', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/useOfflineStatus')>();
  return {
    ...original,
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
        oldestPendingItemAge: hookState.oldestPendingItemAge,
      };
    },
  };
});
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
    oldestPendingItemAge: null,
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
    // Uses above-quick-add-bar which incorporates --quick-add-bar-height
    // (diary screen) AND --bottom-nav-height. When the bar is absent the var
    // is 0px, so the offset is identical to above-bottom-nav.
    expect(pill).toHaveClass('fixed', 'right-4', 'above-quick-add-bar');
    expect(pill).not.toHaveClass('bottom-4');
    expect(pill).not.toHaveClass('above-bottom-nav');
  });
});

describe('OfflineIndicator pending-upload state', () => {
  it('shows waiting-to-upload text and a spinner button when online with pending items', () => {
    hookState.pendingSyncCount = 3;
    hookState.oldestPendingItemAge = 30_000; // 30 seconds — not stuck
    render(<OfflineIndicator />);

    expect(screen.getByText('3 items waiting to upload')).toBeInTheDocument();
  });

  it('shows singular form for a single pending item', () => {
    hookState.pendingSyncCount = 1;
    hookState.oldestPendingItemAge = 10_000;
    render(<OfflineIndicator />);

    expect(screen.getByText('1 item waiting to upload')).toBeInTheDocument();
  });
});

describe('OfflineIndicator stuck-sync state', () => {
  it('shows the stuck warning when online and oldest item exceeds the 2-hour threshold', () => {
    hookState.pendingSyncCount = 2;
    // Just over the threshold.
    hookState.oldestPendingItemAge = STUCK_SYNC_THRESHOLD_MS + 1;
    render(<OfflineIndicator />);

    expect(
      screen.getByText(/haven't synced yet — keep the app open while on signal/i),
    ).toBeInTheDocument();
    // Should NOT show the "waiting to upload" button in stuck state.
    expect(screen.queryByText(/waiting to upload/i)).not.toBeInTheDocument();
  });

  it('shows the waiting-to-upload pill (not stuck) when age is just below threshold', () => {
    hookState.pendingSyncCount = 1;
    hookState.oldestPendingItemAge = STUCK_SYNC_THRESHOLD_MS - 1;
    render(<OfflineIndicator />);

    expect(screen.getByText('1 item waiting to upload')).toBeInTheDocument();
    expect(screen.queryByText(/haven't synced yet/i)).not.toBeInTheDocument();
  });

  it('does not show stuck warning when offline even if age exceeds threshold', () => {
    hookState.isOnline = false;
    hookState.pendingSyncCount = 2;
    hookState.oldestPendingItemAge = STUCK_SYNC_THRESHOLD_MS + 1;
    render(<OfflineIndicator />);

    // Should show offline mode instead.
    expect(screen.getByText('Offline Mode')).toBeInTheDocument();
    expect(screen.queryByText(/haven't synced yet/i)).not.toBeInTheDocument();
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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ApiError } from '@/lib/api';

// Force the reduced-motion path so the submit control is the plain button (the
// slide-to-submit drag gesture is not reproducible in jsdom).
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});
vi.mock('./useDiaryShellData', () => ({ useDiaryShellData: vi.fn() }));
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'p1' }),
}));
vi.mock('@/hooks/useHaptics', () => ({ useHaptics: () => ({ trigger: vi.fn() }) }));
// ShellScreen chrome reads the offline status, which hits Dexie/IndexedDB —
// unavailable in jsdom. Stub it to a stable online state.
vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({
    isOnline: true,
    pendingSyncCount: 0,
    failedSyncCount: 0,
    isSyncing: false,
    syncPendingChanges: vi.fn(),
    retryFailedSyncs: vi.fn(),
    conflictCount: 0,
    oldestPendingItemAge: null,
  }),
}));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
// H16: the offline submit must actually queue a diary_submit the sync worker can
// replay. Mock only the submit primitive so we can assert it is invoked.
vi.mock('@/lib/offlineDb', () => ({ submitDiaryOffline: vi.fn() }));

import { ReviewScreen } from './ReviewScreen';
import { useDiaryShellData } from './useDiaryShellData';
import { apiFetch } from '@/lib/api';
import { submitDiaryOffline } from '@/lib/offlineDb';
import { toast } from '@/components/ui/toaster';

const useDiaryShellDataMock = vi.mocked(useDiaryShellData);
const apiFetchMock = vi.mocked(apiFetch);
const submitDiaryOfflineMock = vi.mocked(submitDiaryOffline);
const toastMock = vi.mocked(toast);

const draftDiary = {
  id: 'd1',
  date: '2026-06-20',
  status: 'draft',
  activities: [{ id: 'a1', description: 'Kerb pour', lot: null }],
  delays: [],
  deliveries: [],
  events: [],
  personnel: [],
  plant: [],
  weatherConditions: 'Fine',
};

function warn422(warnings: string[]): ApiError {
  return new ApiError(
    422,
    JSON.stringify({ error: { details: { requiresAcknowledgement: true, warnings } } }),
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
  toastMock.mockReset();
  submitDiaryOfflineMock.mockReset();
  submitDiaryOfflineMock.mockResolvedValue(undefined);
  useDiaryShellDataMock.mockReturnValue({ diary: draftDiary } as unknown as ReturnType<
    typeof useDiaryShellData
  >);
});

describe('ReviewScreen server-422 warning gate (M30)', () => {
  it('surfaces the server warnings and stays on the review screen when the submit is gated', async () => {
    apiFetchMock.mockRejectedValueOnce(warn422(['No personnel recorded']));

    renderWithProviders(<ReviewScreen />);

    fireEvent.click(screen.getByRole('button', { name: /Submit diary/i }));

    // The previously-dead warnings UI now shows the server's warnings.
    await screen.findByText('Review before submitting');
    expect(screen.getByText('No personnel recorded')).toBeInTheDocument();

    // Still on review — the gate did not let the diary through.
    expect(screen.getByRole('button', { name: /Submit diary/i })).toBeInTheDocument();
  });
});

describe('ReviewScreen offline submit (H16)', () => {
  it('queues a replayable diary submit when the network is unavailable, not just the ceremony', async () => {
    // A retriable network failure (offline) on the submit POST.
    apiFetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    renderWithProviders(<ReviewScreen />);

    fireEvent.click(screen.getByRole('button', { name: /Submit diary/i }));

    // The offline branch must enqueue the submit (keyed by projectId + diary
    // date) so the sync worker can replay it — otherwise the "saved, will send
    // when back online" ceremony is a lie and the diary is silently lost.
    await vi.waitFor(() => {
      expect(submitDiaryOfflineMock).toHaveBeenCalledWith('p1', '2026-06-20');
    });
  });

  it('shows an error instead of a false "queued" ceremony when the offline enqueue fails', async () => {
    apiFetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    submitDiaryOfflineMock.mockRejectedValueOnce(new Error('IndexedDB unavailable'));

    renderWithProviders(<ReviewScreen />);

    fireEvent.click(screen.getByRole('button', { name: /Submit diary/i }));

    await vi.waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    });
  });
});

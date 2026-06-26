import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/renderWithProviders';
import { apiFetch } from '@/lib/api';
import * as apiModule from '@/lib/api';
import { submitDiaryOffline } from '@/lib/offlineDb';
import { DiaryFinishFlow } from './DiaryFinishFlow';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));

// H16: the legacy offline submit must enqueue a replayable diary_submit too.
vi.mock('@/lib/offlineDb', () => ({ submitDiaryOffline: vi.fn() }));
const submitDiaryOfflineMock = vi.mocked(submitDiaryOffline);

// useHaptics is a no-op in test — navigator.vibrate doesn't exist in jsdom
vi.mock('@/hooks/useHaptics', () => ({
  useHaptics: () => ({ trigger: vi.fn(), isSupported: false }),
  triggerHaptic: vi.fn(),
}));

// useReducedMotion — default to false so animation branches run normally.
// Individual tests can override.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

const PAST_DATE = '2020-01-02';

const pastDiary = {
  id: 'diary-past',
  date: PAST_DATE,
  status: 'draft',
  weatherConditions: 'Sunny',
  personnel: [{ name: 'Sam', hours: 8, role: 'Carpenter' }],
  plant: [{ description: 'Excavator', hoursOperated: 4 }],
  activities: [{ description: 'Framing' }, { description: 'Pour slab' }],
  delays: [{ description: 'Rain delay', durationHours: 1 }],
};

function renderFlow(date: string) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  renderWithProviders(
    <Routes>
      <Route
        path="/projects/:projectId/diary"
        element={<DiaryFinishFlow isOpen date={date} onClose={onClose} onSubmit={onSubmit} />}
      />
    </Routes>,
    { initialEntries: ['/projects/p1/diary'] },
  );
  return { onSubmit, onClose };
}

describe('DiaryFinishFlow selected-date submission', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches the selected date's diary, not today's", async () => {
    vi.mocked(apiFetch).mockResolvedValue(pastDiary);

    renderFlow(PAST_DATE);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(`/api/diary/p1/${PAST_DATE}`);
    });
  });

  it('submits the fetched past-date draft by its own id', async () => {
    vi.mocked(apiFetch).mockResolvedValue(pastDiary);

    const { onSubmit, onClose } = renderFlow(PAST_DATE);

    // Wait for the loaded draft's submit button to appear.
    const submitButton = await screen.findByRole('button', { name: 'Submit Diary' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/api/diary/${pastDiary.id}/submit`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    // onClose is NOT called immediately — the ceremony shows first
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the selected date in the header', async () => {
    vi.mocked(apiFetch).mockResolvedValue(pastDiary);

    renderFlow(PAST_DATE);

    // 2020-01-02 is a Thursday; the header renders an en-AU long date.
    expect(await screen.findByText(/Thursday/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Ceremony tests — real timers for all except the auto-dismiss test
// ---------------------------------------------------------------------------

describe('DiaryFinishFlow — submit ceremony', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    submitDiaryOfflineMock.mockReset();
    submitDiaryOfflineMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders the success ceremony with counts after online submit', async () => {
    // First call: load diary; second call (submit): resolves
    vi.mocked(apiFetch).mockResolvedValueOnce(pastDiary).mockResolvedValueOnce(undefined);

    renderFlow(PAST_DATE);

    const submitButton = await screen.findByRole('button', { name: 'Submit Diary' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByTestId('submit-ceremony')).toBeInTheDocument();
    });

    // Heading
    expect(screen.getByText('Diary submitted')).toBeInTheDocument();

    // Activities count (diary has 2) — getByText('2') is unambiguous
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Activities')).toBeInTheDocument();

    // Personnel, Plant, Delays labels all present
    expect(screen.getByText('People')).toBeInTheDocument();
    expect(screen.getByText('Plant')).toBeInTheDocument();
    expect(screen.getByText('Delays')).toBeInTheDocument();

    // Three count-badges show the number 1 (people, plant, delays)
    expect(screen.getAllByText('1')).toHaveLength(3);
  });

  it('shows offline queued copy when submit fails with network error', async () => {
    // First call: load diary; second call: network failure
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(pastDiary)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    // Make isRetriableNetworkFailure return true for the TypeError
    vi.spyOn(apiModule, 'isRetriableNetworkFailure').mockReturnValue(true);

    renderFlow(PAST_DATE);

    const submitButton = await screen.findByRole('button', { name: 'Submit Diary' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByTestId('submit-ceremony')).toBeInTheDocument();
    });

    // Offline copy — never "submitted"
    expect(screen.getByText('Diary saved')).toBeInTheDocument();
    expect(screen.getByText(/Will send when you're back on signal/)).toBeInTheDocument();

    // Must NOT show "Diary submitted"
    expect(screen.queryByText('Diary submitted')).not.toBeInTheDocument();
  });

  it('enqueues a replayable diary submit (not just the ceremony) when offline', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(pastDiary)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.spyOn(apiModule, 'isRetriableNetworkFailure').mockReturnValue(true);

    renderFlow(PAST_DATE);

    const submitButton = await screen.findByRole('button', { name: 'Submit Diary' });
    fireEvent.click(submitButton);

    // The offline branch must queue the submit keyed by projectId + diary date,
    // so the sync worker replays it — otherwise "saved, will send" is a lie.
    await waitFor(() => {
      expect(submitDiaryOfflineMock).toHaveBeenCalledWith('p1', PAST_DATE);
    });
  });

  it('Done button closes the ceremony', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(pastDiary).mockResolvedValueOnce(undefined);

    const { onClose } = renderFlow(PAST_DATE);

    const submitButton = await screen.findByRole('button', { name: 'Submit Diary' });
    fireEvent.click(submitButton);

    const doneButton = await screen.findByTestId('ceremony-done-button');
    fireEvent.click(doneButton);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('auto-dismisses after ~4 s if untouched', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    vi.mocked(apiFetch).mockResolvedValueOnce(pastDiary).mockResolvedValueOnce(undefined);

    const { onClose } = renderFlow(PAST_DATE);

    // Use real-async calls before switching to fake-timer control
    const submitButton = await screen.findByRole('button', { name: 'Submit Diary' });
    fireEvent.click(submitButton);

    await screen.findByTestId('submit-ceremony');

    // Fast-forward 4 seconds to trigger auto-dismiss
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reduced-motion: ceremony renders instantly (no animation delay)', async () => {
    const { useReducedMotion } = await import('framer-motion');
    vi.mocked(useReducedMotion).mockReturnValue(true);

    vi.mocked(apiFetch).mockResolvedValueOnce(pastDiary).mockResolvedValueOnce(undefined);

    renderFlow(PAST_DATE);

    const submitButton = await screen.findByRole('button', { name: 'Submit Diary' });
    fireEvent.click(submitButton);

    // With reduced motion the element should still appear (instant render)
    await waitFor(() => {
      expect(screen.getByTestId('submit-ceremony')).toBeInTheDocument();
    });
  });
});

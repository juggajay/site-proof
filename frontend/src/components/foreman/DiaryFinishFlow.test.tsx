import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/renderWithProviders';
import { apiFetch } from '@/lib/api';
import { DiaryFinishFlow } from './DiaryFinishFlow';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));

const PAST_DATE = '2020-01-02';

const pastDiary = {
  id: 'diary-past',
  date: PAST_DATE,
  status: 'draft',
  weatherConditions: 'Sunny',
  personnel: [{ name: 'Sam', hours: 8, role: 'Carpenter' }],
  plant: [],
  activities: [{ description: 'Framing' }],
  delays: [],
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
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the selected date in the header', async () => {
    vi.mocked(apiFetch).mockResolvedValue(pastDiary);

    renderFlow(PAST_DATE);

    // 2020-01-02 is a Thursday; the header renders an en-AU long date.
    expect(await screen.findByText(/Thursday/)).toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/renderWithProviders';
import { apiFetch } from '@/lib/api';
import { useForemanMobileStore } from '@/stores/foremanMobileStore';
import { TodayWorklist } from './TodayWorklist';

const navigateSpy = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => ({ isOnline: true, pendingSyncCount: 0 }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

const emptyWorklist = {
  blocking: [],
  dueToday: [],
  upcoming: [],
  summary: { totalBlocking: 0, totalDueToday: 0, totalUpcoming: 0 },
};

function renderTodayWorklist() {
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId/foreman/today" element={<TodayWorklist />} />
    </Routes>,
    { initialEntries: ['/projects/p1/foreman/today'] },
  );
}

describe('TodayWorklist all-clear actions', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockResolvedValue(emptyWorklist);
    useForemanMobileStore.setState({ isCameraOpen: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('offers forward actions when there is no urgent foreman work', async () => {
    renderTodayWorklist();

    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();

    expect(screen.getByRole('button', { name: "Start today's diary" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Capture a photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
  });

  it("navigates to today's diary from the all-clear state", async () => {
    renderTodayWorklist();

    fireEvent.click(await screen.findByRole('button', { name: "Start today's diary" }));

    expect(navigateSpy).toHaveBeenCalledWith('/projects/p1/diary');
  });

  it('opens the shared foreman capture modal from the all-clear state', async () => {
    renderTodayWorklist();

    fireEvent.click(await screen.findByRole('button', { name: 'Capture a photo' }));

    await waitFor(() => {
      expect(useForemanMobileStore.getState().isCameraOpen).toBe(true);
    });
  });
});

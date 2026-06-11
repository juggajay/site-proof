/**
 * Tests for DoneScreen — ceremony online vs offline-queued copy.
 *
 * Covers:
 *   - Default (no ?queued) → confirmed variant: "Sent to the office"
 *   - ?queued=1 → queued variant: "will send when you're back on signal"
 *   - Done button navigates to /m
 *   - data-testid="diary-done-screen" present
 *   - Auto-dismisses after 4s
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));

vi.mock('../useDiaryShellData', () => ({
  useDiaryShellData: () => ({
    diary: {
      id: 'diary-1',
      status: 'submitted',
      activities: [{ id: 'a1', description: 'Fill', createdAt: '' }],
      personnel: [{ id: 'p1', name: 'Jay', createdAt: '' }],
      plant: [],
      delays: [],
    },
  }),
}));

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return { ...actual, useReducedMotion: () => true };
});

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import { DoneScreen } from '../DoneScreen';

// ── Tests ─────────────────────────────────────────────────────────────────────

function renderDoneScreen(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/m/diary/done" element={<DoneScreen />} />
          <Route path="/m" element={<div data-testid="home">home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DoneScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the done screen with data-testid', () => {
    renderDoneScreen('/m/diary/done');
    expect(screen.getByTestId('diary-done-screen')).toBeInTheDocument();
  });

  it('shows "Sent to the office" for confirmed variant (no ?queued)', () => {
    renderDoneScreen('/m/diary/done');
    expect(screen.getByText(/Sent to the office/i)).toBeInTheDocument();
  });

  it('shows offline queued copy when ?queued=1', () => {
    renderDoneScreen('/m/diary/done?queued=1');
    expect(screen.getByText(/will send when you're back on signal/i)).toBeInTheDocument();
  });

  it('Done button navigates to /m', () => {
    renderDoneScreen('/m/diary/done');
    fireEvent.click(screen.getByTestId('ceremony-done-button'));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/m'),
      expect.objectContaining({ replace: true }),
    );
  });

  it('auto-dismisses after 4s', () => {
    renderDoneScreen('/m/diary/done');
    vi.advanceTimersByTime(4100);
    expect(mockNavigate).toHaveBeenCalled();
  });
});

/**
 * Mobile diary fetch-failure honesty.
 *
 * When the diary fetch fails on mobile, the page used to reset into the
 * "Start your day" empty state — indistinguishable from "no diary yet", so a
 * foreman could unknowingly write against a day they could not see. These
 * tests pin that a fetch failure renders an error banner with a Try again
 * action instead of the empty state, and that retrying recovers.
 */

import { describe, expect, it, vi, type MockInstance } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

// Force the mobile branch without a jsdom matchMedia polyfill.
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: () => true };
});

import { apiFetch, ApiError } from '@/lib/api';
import { DailyDiaryPage } from './DailyDiaryPage';

const apiFetchMock = vi.mocked(apiFetch) as unknown as MockInstance<
  (path: string, options?: RequestInit) => Promise<unknown>
>;

function mockApi({ diaryFetchFails }: { diaryFetchFails: () => boolean }) {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (path: string) => {
    if (path.includes('?missing=null')) {
      if (diaryFetchFails()) {
        throw new ApiError(500, JSON.stringify({ error: { message: 'Diary service is down' } }));
      }
      return null; // no diary for the date yet
    }
    if (path.includes('/docket-summary/')) {
      return {
        approvedDockets: [],
        pendingCount: 0,
        pendingDockets: [],
        totals: { workers: 0, labourHours: 0, machines: 0, plantHours: 0 },
      };
    }
    if (path.includes('/weather/')) return { unavailable: true };
    if (path.startsWith('/api/lots')) return { lots: [] };
    if (path === '/api/diary/project-1') return [];
    return null;
  });
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId/diary" element={<DailyDiaryPage />} />
    </Routes>,
    { initialEntries: ['/projects/project-1/diary'] },
  );
}

describe('DailyDiaryPage mobile fetch failure', () => {
  it('renders an error banner with Try again instead of the empty state', async () => {
    mockApi({ diaryFetchFails: () => true });
    renderPage();

    expect(await screen.findByText('Diary service is down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    // It must NOT look like a fresh day with no diary.
    expect(screen.queryByText('Start your day')).not.toBeInTheDocument();
  });

  it('recovers to the normal mobile view when Try again succeeds', async () => {
    let fail = true;
    mockApi({ diaryFetchFails: () => fail });
    renderPage();

    const tryAgain = await screen.findByRole('button', { name: 'Try again' });

    fail = false;
    fireEvent.click(tryAgain);

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument(),
    );
    // With no diary for today, the genuine empty state is back.
    expect(await screen.findByText('Start your day')).toBeInTheDocument();
  });
});

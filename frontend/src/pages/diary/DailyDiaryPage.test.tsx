/**
 * Mobile diary fetch-failure honesty + desktop empty-tab guidance.
 *
 * Mobile: when the diary fetch fails, the page used to reset into the
 * "Start your day" empty state — indistinguishable from "no diary yet", so a
 * foreman could unknowingly write against a day they could not see. These
 * tests pin that a fetch failure renders an error banner with a Try again
 * action instead of the empty state, and that retrying recovers.
 *
 * Desktop: before the day's diary exists (saving Weather creates it), the
 * Personnel/Plant/Activities/Delays tab panels used to render literally
 * nothing (regression from commit 822a469d). These tests pin that they now
 * render a guided card whose "Go to Weather" action switches the active tab,
 * and that the real tab components still render once the diary exists.
 */

import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

// Controllable viewport (without a jsdom matchMedia polyfill): the mobile
// tests force the mobile branch, the desktop tab tests force the desktop one.
const viewport = vi.hoisted(() => ({ isMobile: true }));
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: () => viewport.isMobile };
});

import { apiFetch, ApiError } from '@/lib/api';
import { DailyDiaryPage } from './DailyDiaryPage';
import type { DailyDiary } from './types';

const apiFetchMock = vi.mocked(apiFetch) as unknown as MockInstance<
  (path: string, options?: RequestInit) => Promise<unknown>
>;
const lazyTabLoad = { timeout: 5000 };

function buildDiary(date = '2026-06-10'): DailyDiary {
  const timestamp = `${date}T00:00:00.000Z`;
  return {
    id: 'diary-1',
    projectId: 'project-1',
    date: timestamp,
    status: 'draft',
    personnel: [
      {
        id: 'person-1',
        name: 'Desk Foreman',
        company: 'Civil Co',
        role: 'Foreman',
        createdAt: timestamp,
      },
    ],
    plant: [],
    activities: [],
    delays: [],
    deliveries: [],
    events: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function mockApi({
  diaryFetchFails = () => false,
  diaryForDate = () => null,
}: {
  diaryFetchFails?: () => boolean;
  diaryForDate?: () => DailyDiary | null;
} = {}) {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (path: string) => {
    if (path.includes('?missing=null')) {
      if (diaryFetchFails()) {
        throw new ApiError(500, JSON.stringify({ error: { message: 'Diary service is down' } }));
      }
      return diaryForDate();
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

function renderPage(initialEntry = '/projects/project-1/diary') {
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId/diary" element={<DailyDiaryPage />} />
    </Routes>,
    { initialEntries: [initialEntry] },
  );
}

describe('DailyDiaryPage mobile fetch failure', () => {
  beforeEach(() => {
    viewport.isMobile = true;
  });

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

describe('DailyDiaryPage desktop entry tabs before the diary exists', () => {
  beforeEach(() => {
    viewport.isMobile = false;
  });

  it('loads the diary date from the URL query on first render', async () => {
    mockApi({ diaryForDate: () => buildDiary('2026-06-09') });
    renderPage('/projects/project-1/diary?date=2026-06-09');

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith('/api/diary/project-1/2026-06-09?missing=null'),
    );
    expect(screen.getByLabelText('Select Date:')).toHaveValue('2026-06-09');
  });

  it('shows the guided empty state instead of a blank panel, and Go to Weather switches tabs', async () => {
    mockApi(); // by-date fetch returns null: no diary for this date yet
    renderPage();

    // No diary yet: start a new entry from the page-level empty state.
    fireEvent.click(await screen.findByRole('button', { name: /Create Diary Entry/ }));

    // Weather is the active tab first (lazy-loaded).
    expect(
      await screen.findByText('Weather & General Notes', undefined, lazyTabLoad),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'personnel' }));

    expect(await screen.findByText('No diary for this date yet')).toBeInTheDocument();
    expect(screen.getByText(/Record the weather to start the day's diary/)).toBeInTheDocument();

    // One shared card serves all four entry tabs.
    fireEvent.click(screen.getByRole('button', { name: 'delays' }));
    expect(await screen.findByText('No diary for this date yet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Go to Weather' }));

    expect(
      await screen.findByText('Weather & General Notes', undefined, lazyTabLoad),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('No diary for this date yet')).not.toBeInTheDocument(),
    );
  });

  it('renders the real tab component once the diary exists', async () => {
    mockApi({ diaryForDate: () => buildDiary() });
    renderPage();

    expect(
      await screen.findByText('Weather & General Notes', undefined, lazyTabLoad),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /personnel/ }));

    expect(
      await screen.findByText('Personnel on Site', undefined, lazyTabLoad),
    ).toBeInTheDocument();
    expect(screen.getByText('Desk Foreman')).toBeInTheDocument();
    expect(screen.queryByText('No diary for this date yet')).not.toBeInTheDocument();
  });
});

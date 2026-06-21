import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DailyDiary } from '@/pages/diary/types';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));

vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));

vi.mock('@/hooks/useHaptics', () => ({
  useHaptics: () => ({ trigger: vi.fn() }),
}));

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
  isRetriableNetworkFailure: () => false,
}));

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return { ...actual, useReducedMotion: () => true };
});

vi.mock('../../../components/ShellScreen', () => ({
  ShellScreen: ({
    title,
    sub,
    children,
  }: {
    title: string;
    sub?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {sub}
      <main>{children}</main>
    </div>
  ),
}));

let _diary: DailyDiary | null = null;

vi.mock('../useDiaryShellData', () => ({
  useDiaryShellData: () => ({
    diary: _diary,
  }),
}));

import { ReviewScreen } from '../ReviewScreen';

function makeDiary(overrides: Partial<DailyDiary> = {}): DailyDiary {
  return {
    id: 'diary-1',
    projectId: 'proj-1',
    date: '2026-06-21',
    status: 'draft',
    weatherConditions: 'Fine',
    temperatureMin: 12,
    temperatureMax: 24,
    rainfallMm: 0,
    personnel: [{ id: 'p1', name: 'Jay', createdAt: '' }],
    plant: [{ id: 'pl1', description: 'Roller', createdAt: '' }],
    activities: [{ id: 'a1', description: 'Trim subgrade', createdAt: '' }],
    delays: [],
    deliveries: [],
    events: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function renderReviewScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/m/diary/review?projectId=proj-1']}>
        <Routes>
          <Route path="/m/diary/review" element={<ReviewScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReviewScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows submit controls for a draft diary with work', () => {
    _diary = makeDiary();
    renderReviewScreen();

    expect(screen.getByRole('button', { name: /submit diary/i })).toBeInTheDocument();
    expect(screen.getByText(/Slide to lock the diary/i)).toBeInTheDocument();
  });

  it('shows a locked submitted state instead of submit controls for submitted diaries', () => {
    _diary = makeDiary({ status: 'submitted' });
    renderReviewScreen();

    expect(screen.getByText(/Diary submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/locked for the day/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit diary/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Slide to submit/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Slide to lock the diary/i)).not.toBeInTheDocument();
  });
});

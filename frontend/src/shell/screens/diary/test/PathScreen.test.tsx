/**
 * Tests for PathScreen — path renders node states from mocked queries.
 *
 * Covers:
 *   - No diary → weather=now, others locked
 *   - Weather done → crew=now
 *   - Full diary → review=now
 *   - Submitted → all done, read-only banner
 *   - Submitted diary: all 4 nodes aria-label "complete"
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DailyDiary } from '@/pages/diary/types';

// ── Mocks — must be at top level for hoisting ─────────────────────────────────

// Prevent useOfflineStatus → Dexie → MissingAPIError in jsdom.
vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));

vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

// useDiaryShellData: mutable via the ref below
let _shellData: ReturnType<typeof makeShellData> | null = null;
vi.mock('../useDiaryShellData', () => ({
  useDiaryShellData: () => _shellData,
}));

vi.mock('../../components/ShellScreen', () => ({
  ShellScreen: ({ children, bottom }: { children: React.ReactNode; bottom?: React.ReactNode }) => (
    <div>
      <main>{children}</main>
      {bottom && <div data-testid="bottom-bar">{bottom}</div>}
    </div>
  ),
}));

// ── Import the component AFTER mocks ─────────────────────────────────────────

import { PathScreen } from '../PathScreen';

// ── Helper diary factory ──────────────────────────────────────────────────────

function makeShellData(diaryOverrides: Partial<DailyDiary> | null = null) {
  const diary: DailyDiary | null = diaryOverrides
    ? {
        id: 'diary-1',
        projectId: 'proj-1',
        date: '2026-06-11',
        status: 'draft',
        personnel: [],
        plant: [],
        activities: [],
        delays: [],
        deliveries: [],
        events: [],
        createdAt: '',
        updatedAt: '',
        ...diaryOverrides,
      }
    : null;

  return {
    diary,
    loading: false,
    handlers: {
      activeLotId: null,
    },
  };
}

function renderPathScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/m/diary']}>
        <Routes>
          <Route path="/m/diary" element={<PathScreen />} />
          <Route path="/m" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PathScreen — node states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows all 4 nodes', () => {
    _shellData = makeShellData(null);
    renderPathScreen();
    expect(screen.getByText('Weather')).toBeInTheDocument();
    expect(screen.getByText('Crew & Plant')).toBeInTheDocument();
    expect(screen.getByText("Today's Work")).toBeInTheDocument();
    expect(screen.getByText('Review & Submit')).toBeInTheDocument();
  });

  it('Weather node is interactive (now) when no diary', () => {
    _shellData = makeShellData(null);
    renderPathScreen();
    const weatherBtn = screen.getByRole('button', { name: /Weather — in progress/i });
    expect(weatherBtn).not.toBeDisabled();
  });

  it('Crew & Plant is locked when no diary', () => {
    _shellData = makeShellData(null);
    renderPathScreen();
    const crewBtn = screen.getByRole('button', { name: /Crew & Plant — locked/i });
    expect(crewBtn).toBeDisabled();
  });

  it('Crew & Plant is "now" after weather done', () => {
    _shellData = makeShellData({ weatherConditions: 'Fine' });
    renderPathScreen();
    const crewBtn = screen.getByRole('button', { name: /Crew & Plant — in progress/i });
    expect(crewBtn).not.toBeDisabled();
  });

  it('Review & Submit is locked when work not done', () => {
    _shellData = makeShellData({
      weatherConditions: 'Fine',
      personnel: [{ id: 'p1', name: 'Jay', createdAt: '' }],
    });
    renderPathScreen();
    const reviewBtn = screen.getByRole('button', { name: /Review & Submit — locked/i });
    expect(reviewBtn).toBeDisabled();
  });

  it('Review & Submit is interactive when work exists', () => {
    _shellData = makeShellData({
      weatherConditions: 'Fine',
      personnel: [{ id: 'p1', name: 'Jay', createdAt: '' }],
      activities: [{ id: 'a1', description: 'Fill', createdAt: '' }],
    });
    renderPathScreen();
    const reviewBtn = screen.getByRole('button', { name: /Review & Submit — in progress/i });
    expect(reviewBtn).not.toBeDisabled();
  });

  it('shows submitted banner when diary is submitted', () => {
    _shellData = makeShellData({ status: 'submitted' });
    renderPathScreen();
    expect(screen.getByText(/Diary submitted — read only/i)).toBeInTheDocument();
  });

  it('all 4 nodes have aria-label "complete" when submitted', () => {
    _shellData = makeShellData({ status: 'submitted' });
    renderPathScreen();
    const completeNodes = screen.getAllByRole('button', { name: /— complete/i });
    expect(completeNodes).toHaveLength(4);
  });
});

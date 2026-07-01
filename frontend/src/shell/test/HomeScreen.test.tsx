/**
 * Tests for HomeScreen.
 *
 * Covers:
 *   - Renders hero in "start" state (no diary) with correct copy
 *   - Renders hero in "in-progress" state with progress percentage
 *   - Renders hero in "submitted" state
 *   - Tiles render: Lots, Dockets, Issues; Drawings is demoted off home cards
 *   - Live counts shown when data available
 *   - Tiles render without chip when count not available (no fake data)
 *   - Camera button present + opens CaptureModal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Module mocks — all at top level ──────────────────────────────────────────

vi.mock('../components/SyncChip', () => ({
  SyncChip: () => <span data-testid="sync-chip" />,
}));

vi.mock('../hooks/useTimeGreeting', () => ({
  useTimeGreeting: () => 'Morning, Jay',
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { fullName: 'Jay Ryan', roleInCompany: 'foreman' },
  }),
  getAuthToken: () => null,
}));

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn((url: string) => {
    if (url.startsWith('/api/dashboard/')) return Promise.resolve({ blocking: [], dueToday: [] });
    if (url.startsWith('/api/diary/')) return Promise.resolve(null);
    if (url.startsWith('/api/dockets')) return Promise.resolve({ data: [] });
    if (url.startsWith('/api/ncrs')) return Promise.resolve({ data: [] });
    if (url.startsWith('/api/projects')) return Promise.resolve({ projects: [] });
    return Promise.resolve({});
  }),
}));

vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: vi.fn().mockReturnValue({
    projectId: 'proj-abc',
    isResolving: false,
    hasNoProject: false,
  }),
}));

// CaptureModal spy
vi.mock('@/components/foreman/CaptureModal', () => ({
  CaptureModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="capture-modal">modal open</div> : null,
}));

// ── Render helper ─────────────────────────────────────────────────────────────

function renderWithQueryClient(queryClient: QueryClient, ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/m']}>
        <Routes>
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Lazily import HomeScreen so mocks are in place first ──────────────────────

async function getHomeScreen() {
  const mod = await import('../screens/HomeScreen');
  return mod.HomeScreen;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HomeScreen — diary hero states (data via QueryClient cache)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Start today\'s diary" when no diary exists (empty cache)', async () => {
    const HomeScreen = await getHomeScreen();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

    renderWithQueryClient(qc, <HomeScreen />);

    // When queries are disabled (no project-id dependent data), the hero
    // defaults to the "start" state
    expect(screen.getByText("Start today's diary")).toBeInTheDocument();
  });

  it('shows "Diary submitted" when diary is submitted (seeded cache)', async () => {
    const HomeScreen = await getHomeScreen();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

    const todayKey = new Intl.DateTimeFormat('en-CA').format(new Date());
    // The hero query now caches the diary object directly (canonical by-date
    // endpoint with ?missing=null), not a { data: [...] } list wrapper.
    qc.setQueryData(['diaries', 'proj-abc', todayKey], { id: 'd1', status: 'submitted' });

    renderWithQueryClient(qc, <HomeScreen />);

    expect(screen.getByText('Diary submitted')).toBeInTheDocument();
  });

  it('shows "Finish today\'s diary" in-progress state (seeded cache)', async () => {
    const HomeScreen = await getHomeScreen();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

    const todayKey = new Intl.DateTimeFormat('en-CA').format(new Date());
    qc.setQueryData(['diaries', 'proj-abc', todayKey], {
      id: 'd1',
      status: 'draft',
      weatherConditions: 'Fine',
      personnel: [{ id: 'p1' }],
      activities: [],
      delays: [],
    });

    renderWithQueryClient(qc, <HomeScreen />);

    expect(screen.getByText("Finish today's diary")).toBeInTheDocument();
    // 2 of 4 steps done = 50%
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});

describe('HomeScreen — hub tiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the daily-work tiles and keeps Drawings demoted off home cards', async () => {
    const HomeScreen = await getHomeScreen();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

    renderWithQueryClient(qc, <HomeScreen />);

    expect(screen.getByRole('button', { name: /lots/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dockets/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /issues/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /drawings/i })).not.toBeInTheDocument();
  });

  it('shows ITP checks due count when seeded', async () => {
    const HomeScreen = await getHomeScreen();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

    qc.setQueryData(['foreman-badges', 'proj-abc'], {
      blocking: [],
      dueToday: [{ id: '1' }, { id: '2' }, { id: '3' }],
    });

    renderWithQueryClient(qc, <HomeScreen />);

    expect(screen.getByText('3 due')).toBeInTheDocument();
  });

  it('shows pending dockets count when seeded', async () => {
    const HomeScreen = await getHomeScreen();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

    qc.setQueryData(['dockets', 'proj-abc', 'pending_approval'], {
      data: [{ status: 'pending_approval' }, { status: 'pending_approval' }],
    });

    renderWithQueryClient(qc, <HomeScreen />);

    expect(screen.getByText('2 waiting')).toBeInTheDocument();
  });

  it('shows open NCR count when seeded', async () => {
    const HomeScreen = await getHomeScreen();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

    qc.setQueryData(['ncrs', 'proj-abc', 'open'], {
      data: [{ status: 'open' }],
    });

    renderWithQueryClient(qc, <HomeScreen />);

    expect(screen.getByText('1 open')).toBeInTheDocument();
  });

  it('shows 0 open NCR when list is empty', async () => {
    const HomeScreen = await getHomeScreen();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

    qc.setQueryData(['ncrs', 'proj-abc', 'open'], { data: [] });

    renderWithQueryClient(qc, <HomeScreen />);

    expect(screen.getByText('0 open')).toBeInTheDocument();
  });

  it('does not show a Drawings card or fake count chip', async () => {
    const HomeScreen = await getHomeScreen();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

    renderWithQueryClient(qc, <HomeScreen />);

    expect(screen.queryByRole('button', { name: /drawings/i })).not.toBeInTheDocument();
  });
});

describe('HomeScreen — camera bar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "Take a photo" button', async () => {
    const HomeScreen = await getHomeScreen();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

    renderWithQueryClient(qc, <HomeScreen />);

    expect(screen.getByRole('button', { name: /take a photo/i })).toBeInTheDocument();
  });

  it('opens CaptureModal when camera button is clicked', async () => {
    const HomeScreen = await getHomeScreen();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

    renderWithQueryClient(qc, <HomeScreen />);

    const btn = screen.getByRole('button', { name: /take a photo/i });
    fireEvent.click(btn);

    expect(screen.getByTestId('capture-modal')).toBeInTheDocument();
  });
});
